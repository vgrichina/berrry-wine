#!/usr/bin/env python3
"""Independent offline acceptance of caller 2baa8c7; never invokes returned backend."""
import builtins
import copy
import hashlib
import importlib.util
from importlib._bootstrap_external import _code_to_timestamp_pyc
import pathlib
import tempfile
import types
import unittest
from unittest.mock import patch

REPO = pathlib.Path(__file__).resolve().parents[1]
CALLER = REPO/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
CALLER_SHA = 'f0e7d5ecc55613c64706e2849b33852cb577c18adc811ef7e869fc8b5ae7ab09'
ADAPTER = 'toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py'
PINS = {
 ADAPTER: 'e45f6f6d1eaf24a06e92ffe2521ee4026fcc1cdccf22a15be4c7e99911424acb',
 'toyvm-kernel-profile-accounting-backend-oct28/confine.py': '0b10df6497f359f9684f1dbb0752eba3816d0e6568c492c39f62ba3a3f2076d8',
 'toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py': '13bf42f071f5eb84542286f35faf2dc814aaf63bf1bcfe7bb306e3e2f7f4f963',
 'toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py': '9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85',
}
POISON = b'def supervise_accounted(*a, **kw):\n    return "EXECUTABLE_POISON"\n'

def caller(transform=None):
    raw=CALLER.read_bytes()
    assert hashlib.sha256(raw).hexdigest()==CALLER_SHA
    text=raw.decode()
    if transform:
        old,new=transform
        assert text.count(old)==1
        text=text.replace(old,new)
    m=types.ModuleType('independent_caller')
    m.__file__=str(CALLER)
    exec(compile(text,str(CALLER),'exec',dont_inherit=True),m.__dict__)
    return m

def good():
    return dict(filesystem=dict(live=8192,peak=12288,written=5,failure=None,openHandles=0),
        cleanupComplete=True,filesystemCleanup=dict(remainingMounts=[],unmountExit=0,serverExit=0),
        stopReason=None,cpuSeconds=1.25,wallSeconds=2.5,peakRSS=8192,exit=0,output=b'\0ok\xff')

class Independent(unittest.TestCase):
    def setUp(self):
        self.m=caller()
        self.assertEqual(self.m.BACKEND_PINS,PINS)
        self.t=tempfile.TemporaryDirectory(prefix='.independent-caller-',dir=REPO)
        self.addCleanup(self.t.cleanup)
        self.root=pathlib.Path(self.t.name)
        for rel,digest in PINS.items():
            data=(REPO/'test'/rel).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(),digest)
            p=self.root/'test'/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
        self.m.ROOT=self.root

    def assert_pin_boundary(self,m,relative):
        p=self.root/'test'/relative
        original=p.read_bytes()
        # Executable prefix: a bypass cannot be hidden by a harmless comment.
        p.write_bytes(b'raise AssertionError("UNVERIFIED_SOURCE_EXECUTED")\n'+original)
        events=[]
        read=pathlib.Path.read_bytes
        def traced_read(path):
            events.append(('read',str(path.relative_to(self.root/'test'))))
            return read(path)
        def traced_compile(*a,**kw):
            events.append(('compile',None))
            return builtins.compile(*a,**kw)
        try:
            with patch.object(pathlib.Path,'read_bytes',traced_read), patch.object(m,'compile',traced_compile,create=True):
                try:m.load_backend()
                except RuntimeError as e:
                    self.assertEqual(str(e),'accepted backend identity mismatch: '+relative)
                else:raise AssertionError('PIN BYPASS: '+relative)
            self.assertNotIn(('compile',None),events)
            self.assertEqual(events[-1],('read',relative))
            self.assertEqual([v for k,v in events],list(PINS)[:list(PINS).index(relative)+1])
        finally:p.write_bytes(original)

    def test_four_boundaries_and_read_order(self):
        for rel in PINS:
            with self.subTest(relative=rel):self.assert_pin_boundary(self.m,rel)
        # Restored plus unrelated executable decoy must succeed.
        (self.root/'test/decoy.py').write_bytes(b'raise AssertionError("DECOY")')
        f=self.m.load_backend()
        self.assertEqual(f.__code__.co_filename,str(self.root/'test'/ADAPTER))

    def test_all_validated_before_any_adapter_compile(self):
        reads=[];read=pathlib.Path.read_bytes;compiled=[]
        def observe(path):
            reads.append(str(path.relative_to(self.root/'test')))
            return read(path)
        def compile_checked(data,*args,**kw):
            self.assertEqual(reads,list(PINS))
            self.assertEqual(hashlib.sha256(data).hexdigest(),PINS[ADAPTER])
            self.assertIs(kw['dont_inherit'],True)
            compiled.append(data)
            return builtins.compile(data,*args,**kw)
        with patch.object(pathlib.Path,'read_bytes',observe),patch.object(self.m,'compile',compile_checked,create=True):
            self.assertTrue(callable(self.m.load_backend()))
        self.assertEqual(len(compiled),1)

    def assert_verified(self,m,replace_file=False):
        path=self.root/'test'/ADAPTER
        expected=self.m.load_backend().__code__
        read=pathlib.Path.read_bytes
        if replace_file:
            last=self.root/'test'/list(PINS)[-1]
            replaced=[]
            def change_after_reads(p):
                b=read(p)
                if p==last:
                    path.write_bytes(POISON);replaced.append(True)
                return b
            with patch.object(pathlib.Path,'read_bytes',change_after_reads):
                actual=m.load_backend().__code__
            self.assertEqual(replaced,[True])
            # Positive execution control for the replacement; no returned workload invoked.
            spec=importlib.util.spec_from_file_location('replacement_control',path)
            control=importlib.util.module_from_spec(spec);spec.loader.exec_module(control)
            self.assertEqual(control.supervise_accounted(),'EXECUTABLE_POISON')
        else:
            source=read(path);st=path.stat()
            cache=pathlib.Path(importlib.util.cache_from_source(str(path)))
            cache.parent.mkdir(exist_ok=True)
            cache.write_bytes(_code_to_timestamp_pyc(compile(POISON,str(path),'exec'),int(st.st_mtime),len(source)))
            spec=importlib.util.spec_from_file_location('cache_control',path)
            control=importlib.util.module_from_spec(spec);spec.loader.exec_module(control)
            self.assertEqual(control.supervise_accounted(),'EXECUTABLE_POISON')
            actual=m.load_backend().__code__
        self.assertEqual((actual.co_code,actual.co_consts),(expected.co_code,expected.co_consts),
                         'VERIFIED BUFFER BYPASS')

    def test_valid_executable_pyc_ignored(self):
        self.assert_verified(self.m)

    def test_post_validation_replacement_ignored(self):
        self.assert_verified(self.m,True)

    def test_executable_pin_bypass_mutant_is_killed(self):
        # Skip exactly the confinement pin, retaining all other validations.
        rel=list(PINS)[1]
        mutant=caller(('if hashlib.sha256(source).hexdigest() != expected:',
                       "if relative != "+repr(rel)+" and hashlib.sha256(source).hexdigest() != expected:"))
        mutant.ROOT=self.root
        # A semantic bypass really does load despite altered confinement source.
        p=self.root/'test'/rel;p.write_bytes(p.read_bytes()+b'\n# unaccepted confinement change\n')
        self.assertTrue(callable(mutant.load_backend()))
        p.write_bytes((REPO/'test'/rel).read_bytes())
        with self.assertRaisesRegex(AssertionError,'^PIN BYPASS: '+rel+'$'):
            self.assert_pin_boundary(mutant,rel)

    def test_executable_reread_mutant_is_killed(self):
        mutant=caller(("compile(validated_sources[relative], str(path), 'exec', dont_inherit=True)",
                       "compile(path.read_bytes(), str(path), 'exec', dont_inherit=True)"))
        mutant.ROOT=self.root
        with self.assertRaisesRegex(AssertionError,'VERIFIED BUFFER BYPASS'):
            self.assert_verified(mutant,True)

    def args(self):
        work=self.root/'work';work.mkdir(exist_ok=True)
        receipt=self.root/'receipt';receipt.write_bytes(b'{}')
        return dict(domain='tiny-fixture',receipt=receipt,command=['fixture-token'],work=work,**self.m.MAX_LIMITS)

    def test_real_domain_receipt_and_later_pre_dispatch_gates(self):
        args=self.args()
        def check(a,expected,stub=False):
            with patch.object(self.m,'load_backend',side_effect=AssertionError('DISPATCH FORBIDDEN')) as load:
                if stub:
                    with patch.object(self.m,'validate_receipt'):report=self.m.qualify(**a)
                else:report=self.m.qualify(**a)
            load.assert_not_called()
            self.assertFalse(report['accepted']);self.assertFalse(report['browserAllowed'])
            self.assertFalse(report['cleanupComplete']);self.assertIn(expected,report['error'])
            self.assertEqual(report['browserAllowanceRemaining'],self.m.BROWSER_ALLOWANCE)
        for domain in ['browser','','TINY-FIXTURE']:
            check(dict(args,domain=domain),'unqualified browser/domain')
        check(args,'cancellation receipt identity mismatch')
        for key in self.m.MAX_LIMITS:
            for value in [True,0,-1,float('nan'),float('inf'),self.m.MAX_LIMITS[key]+1]:
                with self.subTest(key=key,value=value):
                    check(dict(args,**{key:value}),'unsupported quota/resource limit: '+key,True)
            a=dict(args);del a[key];check(a,'all quota/resource limits must be explicit',True)
        check(dict(args,extra=1),'all quota/resource limits must be explicit',True)
        for command in [[],[''],['a\0b'],[1]]:
            check(dict(args,command=command),'nonempty argv command required',True)
        check(dict(args,file_limit=8192,live_limit=4096),'file quota exceeds live quota',True)
        (args['work']/'occupied').touch()
        check(args,'fresh empty owned work directory required',True)

    def test_authoritative_result_adversarial_matrix(self):
        limits=dict(self.m.MAX_LIMITS)
        base=good()
        self.assertTrue(self.m.evaluate(base,limits)['accepted'])
        cases=[]
        def case(path,values,reason):
            for value in values:
                r=copy.deepcopy(base);target=r
                for key in path[:-1]:target=target[key]
                target[path[-1]]=value;cases.append((r,reason))
            r=copy.deepcopy(base);target=r
            for key in path[:-1]:target=target[key]
            del target[path[-1]];cases.append((r,reason))
        fsreason='authoritative filesystem receipt rejected'
        for key,cap in [('live',limits['live_limit']),('peak',limits['live_limit']),('written',limits['write_limit'])]:
            case(['filesystem',key],[True,-1,cap+1,0.0,None],fsreason)
        case(['filesystem','failure'],['',False,'quota'],fsreason)
        case(['filesystem','openHandles'],[False,1,-1,0.0],fsreason)
        case(['filesystem'],[None,[],{}],fsreason)
        case(['cleanupComplete'],[1,False,None],'cleanup not established')
        case(['filesystemCleanup','remainingMounts'],[(),['mounted'],None],'cleanup not established')
        case(['filesystemCleanup','unmountExit'],[False,1,-1,0.0],'cleanup not established')
        case(['filesystemCleanup','serverExit'],[False,1,-9,0.0,None],'cleanup not established')
        case(['stopReason'],['',False,'quota'],'supervisor stopped or stop receipt missing')
        for key,cap in [('cpuSeconds',limits['cpu_limit']),('wallSeconds',limits['wall_limit']),('peakRSS',limits['rss_limit'])]:
            case([key],[True,-1,cap+1,float('nan'),float('inf'),None],'resource receipt rejected: '+key)
        case(['exit'],[False,1,-1,0.0,None],'child did not succeed')
        case(['output'],['',bytearray(),None,b'x'*(limits['output_limit']+1)],'output receipt rejected')
        for n,(r,reason) in enumerate(cases):
            with self.subTest(case=n,reason=reason):
                report=self.m.evaluate(r,limits)
                self.assertFalse(report['accepted']);self.assertIn(reason,report['failures'])
        # Exact inclusive edges and both allowed cleanup alternatives.
        r=good()
        for k in ['live','peak']:r['filesystem'][k]=limits['live_limit']
        r['filesystem']['written']=limits['write_limit']
        for key,lim in [('cpuSeconds','cpu_limit'),('wallSeconds','wall_limit'),('peakRSS','rss_limit')]:r[key]=limits[lim]
        r['output']=b'x'*limits['output_limit'];r['filesystemCleanup'].update(unmountExit=None,serverExit=-15)
        self.assertTrue(self.m.evaluate(r,limits)['accepted'])
        print('independent result rejection cases:',len(cases))

    def test_forwarding_and_exception_cleanup_stays_fail_closed(self):
        args=self.args();received=[]
        def backend(argv,work,**kw):
            received.append((argv,work,kw));return good()
        with patch.object(self.m,'validate_receipt'),patch.object(self.m,'load_backend',return_value=backend):
            r=self.m.qualify(**args)
        self.assertTrue(r['accepted']);self.assertFalse(r['browserAllowed'])
        self.assertEqual(received,[(args['command'],args['work'],dict(backend='synchronous-fuse',**self.m.MAX_LIMITS))])
        error=RuntimeError('synthetic backend failure')
        error.filesystemCleanup=dict(remainingMounts=[],unmountExit=0,serverExit=-15)
        with patch.object(self.m,'validate_receipt'),patch.object(self.m,'load_backend',side_effect=error):
            r=self.m.qualify(**args)
        self.assertFalse(r['accepted']);self.assertFalse(r['cleanupComplete'])
        self.assertTrue(r['filesystemCleanupComplete']);self.assertFalse(r['browserAllowed'])

if __name__=='__main__':unittest.main(verbosity=2)
