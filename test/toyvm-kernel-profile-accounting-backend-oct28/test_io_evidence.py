#!/usr/bin/env python3
"""WRITE/RELEASE evidence through the production serve loop, without a mount."""
import contextlib
import copy
import errno
import hashlib
import io
import json
import tempfile
import types
import unittest
from unittest import mock
import test_setattr_evidence as se

ns = se.ns
production = ns.production
MAX = ns.MAX


@contextlib.contextmanager
def wire(limit=64, *, module=production, explicit=True, **options):
    kw = dict(io_evidence_limit=limit) if explicit else {}
    backend = module.Backend('/unused-private', 20480, 65536, 16384, **kw, **options)
    with mock.patch.object(tempfile, 'TemporaryDirectory', se.ShortDirectory):
        w = ns.transport.Wire(backend)
    try:
        yield w
    finally:
        w.close()


def write(w, ino, data, off=0, fh=None):
    # Linux fuse_write_in is 40 bytes; data follows it, not the input header.
    return w.call(16, ino, production.pack('2QI', ino if fh is None else fh, off, len(data))+b'\0'*20+data)


class IOEvidenceTests(unittest.TestCase):
    def boundary(self, *, module=production, limit=64, explicit=True):
        with wire(limit, module=module, explicit=explicit) as w:
            source = w.create(b'private-source,retained')
            old = w.create(b'private-destination,retained')
            expected = []
            observations = []

            def request(op, ino, payload, err=0):
                before = se.counters(w.state())
                result = w.call(op, ino, payload)
                self.assertEqual(result[0], -err)
                state = w.state()
                after = se.counters(state)
                expected.append(dict(opcode=op, unique=w.unique, inode=ino, errno=err,
                    callbackCount=len(expected)+1, before=before, after=after))
                if limit:
                    self.assertEqual(state.pop('ioEvidence'), dict(limit=limit,
                        callbackCount=len(expected),countSaturated=False,records=expected[-limit:]))
                else:
                    self.assertNotIn('ioEvidence', state)
                    self.assertFalse(hasattr(w.backend, 'io_callbacks'))
                    self.assertFalse(hasattr(w.backend, 'io_evidence'))
                observations.append((result, state))
                return before, after

            for ino, data in ((source,b'S'*4096),(old,b'D'*4096)):
                request(16, ino, production.pack('2QI',ino,0,len(data))+b'\0'*20+data)
            self.assertEqual(se.counters(w.state()),dict(live=20480,peak=20480,written=8192,inodes=3,openHandles=2))
            self.assertEqual(w.rename(b'private-source,retained',b'private-destination,retained'),0)
            self.assertEqual(w.call(15, old, production.pack('2QI',old,0,4096))[1],b'D'*4096)
            # A nonfinal old-destination release must not collect its charge.
            self.assertEqual(w.call(14, old)[0],0)
            before, after = request(18,old,production.pack('Q',old))
            self.assertEqual((before['live'],after['live'],after['inodes']),(20480,20480,3))
            before, after = request(18,old,production.pack('Q',old))
            self.assertEqual(before,dict(live=20480,peak=20480,written=8192,inodes=3,openHandles=2))
            self.assertEqual(after,dict(live=12288,peak=20480,written=8192,inodes=2,openHandles=1))
            before, after = request(16,source,production.pack('2QI',source,4096,1)+b'\0'*20+b'X')
            self.assertEqual(after,dict(live=16384,peak=20480,written=8193,inodes=2,openHandles=1))
            self.assertEqual(w.call(15,source,production.pack('2QI',source,0,8192))[1],b'S'*4096+b'X')
            request(18,source,production.pack('Q',source))
            self.assertEqual(w.call(10,1,b'private-destination,retained\0')[0],0)
            self.assertEqual(se.counters(w.state()),dict(live=4096,peak=20480,written=8193,inodes=1,openHandles=0))
            if limit:
                ev = w.state()['ioEvidence']
                encoded = json.dumps(ev)
                for secret in ('private','SSSS','DDDD','987654','876543','765432','payload','offset','fh'):
                    self.assertNotIn(secret,encoded)
                for rec in ev['records']:
                    self.assertEqual(set(rec),{'opcode','unique','inode','errno','callbackCount','before','after'})
                    for k,v in rec.items():
                        if k in ('before','after'):
                            self.assertEqual(set(v),set(se.COUNTERS))
                            self.assertTrue(all(type(n) is int and 0<=n<=MAX for n in v.values()))
                        else:self.assertTrue(type(v) is int and 0<=v<=MAX)
                ev['records'][0]['before']['live']=999
                self.assertEqual(w.state()['ioEvidence']['records'],expected[-limit:])
            return observations

    def test_00_production_serve_release_reuse(self):
        self.boundary()

    def test_default_off_equivalence(self):
        self.assertEqual(self.boundary(limit=0),self.boundary(limit=0,explicit=False))
        self.assertEqual(self.boundary(limit=0),self.boundary())

    def test_rejecting_missing_identity_accounting_controls(self):
        source=ns.SOURCE.read_text()
        hook='self.record_io_callback(op,unique,ino,error,before)'
        controls={'missing':'pass # removed','wrong-op':'self.record_io_callback(18,unique,ino,error,before)',
            'wrong-unique':'self.record_io_callback(op,unique+1,ino,error,before)',
            'wrong-inode':'self.record_io_callback(op,unique,1,error,before)',
            'post-as-pre':'self.record_io_callback(op,unique,ino,error,self.accounting_counters())'}
        for name,new in controls.items():
            with self.subTest(control=name):
                self.assertEqual(source.count(hook),1)
                module=types.ModuleType(name)
                exec(compile(source.replace(hook,new,1),str(ns.SOURCE),'exec'),module.__dict__)
                with self.assertRaises(AssertionError):self.boundary(module=module)

    def test_limits_eviction_saturation_errors(self):
        for limit in range(1,65):
            with self.subTest(limit=limit),wire(limit) as w:
                ino=w.create(b'private-file')
                for count in range(1,limit+3):
                    w.unique=(MAX if count%2 else 0)-1
                    before=se.counters(w.state());nodes=copy.deepcopy(w.backend.nodes)
                    op=16 if count%2 else 18
                    payload=production.pack('2QI',ino+1,0,1)+b'\0'*20+b'X' if op==16 else production.pack('Q',ino+1)
                    self.assertEqual(w.call(op,ino,payload)[0],-errno.EIO if op==16 else -errno.EBADF)
                    ev=w.state()['ioEvidence']
                    self.assertEqual(ev['callbackCount'],count)
                    self.assertEqual(len(ev['records']),min(count,limit))
                    self.assertEqual(ev['records'][-1],dict(opcode=op,unique=w.unique,inode=ino,
                        errno=errno.EIO if op==16 else errno.EBADF,callbackCount=count,before=before,after=before))
                    self.assertEqual(w.backend.nodes,nodes)
                w.unique=0
                ev=w.state()['ioEvidence'];self.assertEqual(w.call(3,ino)[0],0)
                self.assertEqual(w.state()['ioEvidence'],ev)
                w.backend.io_callbacks=MAX-1
                for op in (16,18,16):
                    self.assertEqual(w.call(op,ino,b'')[0],-errno.EIO)
                    ev=w.state()['ioEvidence']
                    self.assertEqual(ev['callbackCount'],MAX);self.assertTrue(ev['countSaturated'])
                    self.assertEqual(ev['records'][-1]['errno'],errno.EIO)

    def test_combined_status_bound(self):
        with wire(64,namespace_evidence_limit=64,rename_evidence_limit=64,setattr_evidence_limit=64) as w:
            for _ in range(66):
                w.unique=MAX-5
                self.assertEqual(w.call(9,MAX,production.pack('2I',0o700,0)+b'private\0')[0],-errno.ENOENT)
                self.assertEqual(w.rename(b'private-missing',b'private-other'),-errno.ENOENT)
                self.assertEqual(se.resize(w,1,0,flags=0x80000000)[0],-errno.EOPNOTSUPP)
                self.assertEqual(w.call(16,MAX,b'')[0],-errno.EIO)
            state=w.state()
            for key in ('namespaceEvidence','renameEvidence','setattrEvidence','ioEvidence'):
                self.assertEqual(len(state[key]['records']),64)
            self.assertLess(len(json.dumps(state).encode()),98304)

    def test_pins_option_wiring(self):
        adapter=ns.load(ns.SOURCE.with_name('supervise_accounted.py'),'adapter')
        caller=ns.load(ns.SOURCE.parents[1]/'toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py','caller')
        self.assertTrue(callable(caller.load_backend()))
        for rel,pin in caller.BACKEND_PINS.items():
            self.assertEqual(hashlib.sha256((caller.ROOT/'test'/rel).read_bytes()).hexdigest(),pin)
        for bad in (True,False,-1,65,1.0,'1',None):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):production.Backend('/unused',io_evidence_limit=bad)
                with mock.patch.object(adapter.subprocess,'Popen') as spawn:
                    with self.assertRaises(ValueError):adapter.supervise_accounted([], '/unused',io_evidence=bad)
                    spawn.assert_not_called()
                result=caller.qualify(domain='tiny-fixture',receipt='unused',command=[],work='unused',io_evidence=bad)
                self.assertIn('io evidence limit',result['error'])
        for n in (0,1,64):
            with mock.patch.object(adapter.subprocess,'Popen',side_effect=RuntimeError('captured')) as spawn:
                with self.assertRaisesRegex(RuntimeError,'captured'):adapter.supervise_accounted([], '/unused',io_evidence=n)
                argv=spawn.call_args.args[0]
                self.assertEqual('--io-evidence' in argv,bool(n))
                if n:self.assertEqual(argv[-2:],['--io-evidence',str(n)])
            with se.ShortDirectory.original(dir=ns.SOURCE.parents[3]) as temp:
                backend=mock.Mock(return_value={})
                with mock.patch.object(caller,'validate_receipt'),mock.patch.object(caller,'load_backend',return_value=backend),mock.patch.object(caller,'evaluate',return_value={}):
                    caller.qualify(domain='tiny-fixture',receipt='unused',command=['/bin/true'],work=temp,io_evidence=n,**caller.MAX_LIMITS)
                self.assertEqual(backend.call_args.kwargs.get('io_evidence',0),n)
            with mock.patch.object(production.Backend,'mount'),mock.patch.object(production.Backend,'serve'):
                production.main(['/unused','/unused/status','--io-evidence',str(n)])
            argv=['--domain','tiny-fixture','--receipt','unused','--work','unused','--io-evidence',str(n)]
            for key,value in caller.MAX_LIMITS.items():argv.extend(['--'+key.replace('_','-'),str(value)])
            with mock.patch.object(caller,'qualify',return_value={'accepted':True}) as q,contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(caller.main(argv+['--','/bin/true']),0)
                self.assertEqual(q.call_args.kwargs['io_evidence'],n)
        for arg in ('-1','65','true','1.0'):
            with contextlib.redirect_stderr(io.StringIO()),self.assertRaises(SystemExit):
                production.main(['/unused','/unused/status','--io-evidence',arg])


if __name__=='__main__':unittest.main()
