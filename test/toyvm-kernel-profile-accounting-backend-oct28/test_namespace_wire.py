#!/usr/bin/env python3
"""Local production-wire contract only; no mounted/kernel/browser claim."""
import contextlib,copy,errno,hashlib,importlib.util,json,pathlib,tempfile,types,unittest
from unittest import mock
import test_rename_wire as transport
production=transport.production
SOURCE=transport.SOURCE
MAX=(1<<64)-1

def load(path,name):
    m=types.ModuleType(name);m.__file__=str(path)
    exec(compile(path.read_bytes(),str(path),'exec',dont_inherit=True),m.__dict__)
    return m

@contextlib.contextmanager
def wire(limit=0,*,module=production,rename=0,explicit=True):
    options={'namespace_evidence_limit':limit} if explicit else {}
    b=module.Backend('/unused-namespace',1048576,65536,16384,rename_evidence_limit=rename,**options)
    w=transport.Wire(b)
    try:yield w
    finally:w.close()

def stable(w):
    s=w.state();s.pop('operations');s.pop('namespaceEvidence',None)
    return s

class Acceptance(unittest.TestCase):
    def boundary(self,module=production,limit=16,explicit=True):
        observations=[]
        with wire(limit,module=module,explicit=explicit) as w:
            parent=w.mkdir(b'private-parent');empty=w.mkdir(b'private-empty',parent)
            file=w.create(b'private-file',parent);directory=w.mkdir(b'private-nonempty',parent)
            child=w.create(b'private-child',directory)
            self.assertEqual(w.call(16,file,module.pack('2QI',file,0,4)+b'\0'*20+b'Q7z!')[0],0)
            # Setup above now contributes five actual MKDIR/CREATE callbacks.
            count=5
            for op,p,name,expected,identity in [(10,parent,b'private-empty',errno.EISDIR,MAX),(11,parent,b'private-file',errno.ENOTDIR,9),(11,parent,b'private-nonempty',errno.ENOTEMPTY,9),(10,parent,b'private-absent',errno.ENOENT,0),(11,parent,b'private-absent',errno.ENOENT,24),(10,parent,b'private-file',0,26),(11,parent,b'private-empty',0,25),(10,directory,b'private-child',0,4),(11,parent,b'private-nonempty',0,3)]:
                before=stable(w);w.unique=identity-1
                error,answer=w.call(op,p,name+b'\0');count+=1
                self.assertEqual((error,answer),(-expected,b''))
                state=w.state()
                if limit:
                    ev=state.pop('namespaceEvidence')
                    self.assertEqual(ev['callbackCount'],count)
                    self.assertEqual(ev['records'][-1],dict(opcode=op,unique=identity,inode=p,errno=expected,callbackCount=count))
                else:
                    self.assertNotIn('namespaceEvidence',state)
                    self.assertFalse(hasattr(w.backend,'namespace_callbacks'))
                    self.assertFalse(hasattr(w.backend,'namespace_evidence'))
                if expected:self.assertEqual(stable(w),before)
                if op==10 and not expected:
                    # Unlinked open files remain charged until their last release.
                    self.assertEqual(stable(w),before)
                observations.append((error,answer,state))
                # The unrelated request starts a fresh valid uint64 identity.
                w.unique=0
                self.assertEqual(w.call(3)[0],0)
                if limit:self.assertEqual(w.state()['namespaceEvidence']['callbackCount'],count)
            self.assertEqual(w.call(18,file,module.pack('Q',file))[0],0)
            self.assertEqual(w.call(18,child,module.pack('Q',child))[0],0)
            self.assertEqual(w.call(11,1,b'private-parent\0')[0],0)
            final=w.state();self.assertEqual((final['live'],final['inodes'],final['openHandles'],final['written']),(4096,1,0,4))
            self.assertEqual(final['failure'],None)
            if limit:
                encoded=json.dumps(final)
                for secret in ('private-','987654','876543','765432','unused-namespace','Q7z!'):
                    self.assertNotIn(secret,encoded)
            return observations

    def test_00_production_boundary(self):self.boundary()

    def test_default_off_equivalence(self):
        self.assertEqual(self.boundary(limit=0),self.boundary(limit=0,explicit=False))
        self.assertEqual(self.boundary(limit=0),self.boundary(limit=16))

    def test_limits_eviction_saturation_and_unrelated(self):
        for limit in range(1,65):
            with self.subTest(limit=limit),wire(limit,rename=1) as w:
                expected=[]
                for count in range(1,limit+3):
                    op=10 if count%2 else 11
                    self.assertEqual(w.call(op,1,b'missing\0')[0],-errno.ENOENT)
                    expected.append(dict(opcode=op,unique=w.unique,inode=1,errno=errno.ENOENT,callbackCount=count))
                    ev=w.state()['namespaceEvidence']
                    self.assertEqual(ev,dict(limit=limit,callbackCount=count,countSaturated=False,records=expected[-limit:]))
                before=w.state()['namespaceEvidence']
                self.assertEqual(w.rename(b'missing',b'x'),-errno.ENOENT)
                self.assertEqual(w.call(999)[0],-errno.EOPNOTSUPP)
                self.assertEqual(w.state()['namespaceEvidence'],before)
                self.assertEqual(w.state()['renameEvidence']['callbackCount'],1)
                w.backend.namespace_callbacks=MAX-1
                for op in (10,11,10):
                    self.assertEqual(w.call(op,1,b'missing\0')[0],-errno.ENOENT)
                    ev=w.state()['namespaceEvidence'];self.assertEqual(ev['callbackCount'],MAX)
                    self.assertTrue(ev['countSaturated']);self.assertEqual(ev['records'][-1]['callbackCount'],MAX)

    def test_rejecting_source_controls(self):
        source=SOURCE.read_text()
        controls={
            'removed':('                        self.record_namespace_callback(op,unique,ino,error)','                        pass # removed hook'),
            'wrong-op':('self.record_namespace_callback(op,unique,ino,error)','self.record_namespace_callback(10,unique,ino,error)'),
            'wrong-id':('self.record_namespace_callback(op,unique,ino,error)','self.record_namespace_callback(op,unique+1,ino,error)'),
            'wrong-parent':('self.record_namespace_callback(op,unique,ino,error)','self.record_namespace_callback(op,unique,1,error)'),
            'wrong-errno':('self.record_namespace_callback(op,unique,ino,error)','self.record_namespace_callback(op,unique,ino,0)')}
        for name,(old,new) in controls.items():
            with self.subTest(control=name):
                self.assertIn(old,source)
                m=types.ModuleType(name);exec(compile(source.replace(old,new,1),str(SOURCE),'exec'),m.__dict__)
                with self.assertRaises(AssertionError):self.boundary(module=m)

    def test_api_validation_and_propagation(self):
        adapter=load(SOURCE.with_name('supervise_accounted.py'),'adapter')
        caller=load(SOURCE.parents[1]/'toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py','caller')
        # Actual loader must verify every updated transitive identity before plumbing probes.
        self.assertTrue(callable(caller.load_backend()))
        for bad in (True,False,-1,65,1.0,'1',None):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):production.Backend('/unused',namespace_evidence_limit=bad)
                with mock.patch.object(adapter.subprocess,'Popen') as spawn:
                    with self.assertRaises(ValueError):adapter.supervise_accounted([], '/unused',namespace_evidence=bad)
                    spawn.assert_not_called()
                result=caller.qualify(domain='tiny-fixture',receipt='unused',command=[],work='unused',namespace_evidence=bad)
                self.assertIn('namespace evidence limit',result['error'])
        for n in (0,1,64):
            with mock.patch.object(adapter.subprocess,'Popen',side_effect=RuntimeError('captured')) as spawn:
                with self.assertRaisesRegex(RuntimeError,'captured'):adapter.supervise_accounted([], '/unused',namespace_evidence=n,rename_evidence=2)
                argv=spawn.call_args.args[0]
                self.assertEqual(argv[-2:] if n else argv[-2:],['--namespace-evidence',str(n)] if n else ['--rename-evidence','2'])
            with tempfile.TemporaryDirectory(dir=SOURCE.parents[3]) as temp:
                backend=mock.Mock(return_value={})
                with mock.patch.object(caller,'validate_receipt'),mock.patch.object(caller,'load_backend',return_value=backend),mock.patch.object(caller,'evaluate',return_value={}):
                    caller.qualify(domain='tiny-fixture',receipt='unused',command=['/bin/true'],work=temp,namespace_evidence=n,**caller.MAX_LIMITS)
                self.assertEqual(backend.call_args.kwargs.get('namespace_evidence',0),n)
            with mock.patch.object(production.Backend,'mount'),mock.patch.object(production.Backend,'serve') as serve:
                production.main(['/unused','/unused/status','--namespace-evidence',str(n)])
                serve.assert_called_once()
        for arg in ('65','-1','true','1.0'):
            with contextlib.redirect_stderr(__import__('io').StringIO()),self.assertRaises(SystemExit):production.main(['/unused','/unused/status','--namespace-evidence',arg])
        with mock.patch.object(caller,'qualify',return_value={'accepted':True}) as q:
            argv=['--domain','tiny-fixture','--receipt','unused','--work','unused','--namespace-evidence','64']
            for k,v in caller.MAX_LIMITS.items():argv+=['--'+k.replace('_','-'),str(v)]
            with contextlib.redirect_stdout(__import__('io').StringIO()):self.assertEqual(caller.main(argv+['--','/bin/true']),0)
            self.assertEqual(q.call_args.kwargs['namespace_evidence'],64)

if __name__=='__main__':unittest.main(verbosity=2)
