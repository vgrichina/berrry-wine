"""Independent bounded interaction only. Never invokes an accounted adapter."""
import ast
import copy
import errno
import importlib.util
import json
import marshal
import os
import stat
import struct
import sys
import tempfile
import types
from pathlib import Path
from unittest.mock import patch
from verify_inputs import verify, pin, OUT, REPO

RESULT=dict(status='NOT_RUN',scope='SOURCE/LOCAL ONLY',childrenAttempted=[],cases=[])
PHASE='identity preflight'

def audit(event,args):
    if event in {'subprocess.Popen','os.system','os.fork','os.forkpty','os.posix_spawn','os.exec','pty.spawn'}:
        RESULT['childrenAttempted'].append(event)
        raise AssertionError('child process prohibited: '+event)
sys.addaudithook(audit)

def module_from_bytes(data,path,name):
    spec=importlib.util.spec_from_file_location(name,path)
    m=importlib.util.module_from_spec(spec)
    exec(compile(data,str(path),'exec',dont_inherit=True),m.__dict__)
    return m

def code_named(code,name):
    return next(c for c in code.co_consts if isinstance(c,types.CodeType) and c.co_name==name)

def main():
    global PHASE
    d,raw=verify()
    caller=next(p for p in raw if p.endswith('qualify_accounted.py'))
    adapter=next(p for p in raw if p.endswith('/supervise_accounted.py'))
    backend=next(p for p in raw if p.endswith('/fuse_backend.py'))
    transitive=next(p for p in raw if p.endswith('/pinned-supervisor.py'))
    source=raw[caller].decode()
    tree=ast.parse(source)
    load=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='load_backend')
    # Derive control from this caller, replacing only the exact checked-byte pair.
    pair=load.body[-3:-1]
    assert isinstance(pair[0],ast.Assign) and ast.unparse(pair[0].value)=="compile(validated_sources[relative], str(path), 'exec', dont_inherit=True)"
    assert isinstance(pair[1],ast.Expr) and ast.unparse(pair[1])=='exec(code, module.__dict__)'
    lines=source.splitlines(keepends=True)
    legacy=''.join(lines[:pair[0].lineno-1])+"    spec.loader.exec_module(module)\n"+''.join(lines[pair[1].end_lineno:])
    expected=copy.deepcopy(tree)
    expected_load=next(n for n in expected.body if isinstance(n,ast.FunctionDef) and n.name=='load_backend')
    expected_load.body[-3:-1]=ast.parse('spec.loader.exec_module(module)').body
    assert ast.dump(expected,include_attributes=False)==ast.dump(ast.parse(legacy),include_attributes=False)
    control_load=next(n for n in ast.parse(legacy).body if isinstance(n,ast.FunctionDef) and n.name=='load_backend')
    control_calls=[n for n in ast.walk(control_load) if isinstance(n,ast.Call)]
    assert sum(ast.unparse(n)=='spec.loader.exec_module(module)' for n in control_calls)==1
    assert not any(isinstance(n.func,ast.Name) and n.func.id in {'compile','exec'} for n in control_calls)
    RESULT['controlPreflight']=dict(onlyPairChanged=True,candidateCaller=pin(raw[caller]),legacyCaller=pin(legacy.encode()),pinsIdentical=True,loaderReachable='load_backend directly invoked and exact code/line traced')
    PHASE='fixture/control normal-load qualification'
    with tempfile.TemporaryDirectory(prefix='fixture-',dir=OUT) as td:
        root=Path(td)
        for p,data in raw.items():
            target=root/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
        caller_path=root/caller; adapter_path=root/adapter; backend_path=root/backend
        variants={kind:module_from_bytes(data,caller_path,'independent_'+kind) for kind,data in [('candidate',raw[caller]),('legacy',legacy.encode())]}
        assert variants['candidate'].BACKEND_PINS==variants['legacy'].BACKEND_PINS
        assert variants['candidate'].ROOT==root
        assert (root/backend).read_bytes()==raw[backend]
        assert variants['candidate'].BACKEND_PINS[backend.removeprefix('test/')]==pin(raw[backend])['sha256']
        reference=code_named(compile(raw[adapter],str(adapter_path),'exec',dont_inherit=True),'supervise_accounted')
        traced={kind:set() for kind in variants}
        def run_load(kind):
            m=variants[kind]
            def trace(frame,event,arg):
                if event=='call' and frame.f_code.co_name in {'supervise_accounted','supervise'}:
                    raise AssertionError('forbidden adapter/supervisor invocation')
                if frame.f_code is m.load_backend.__code__ and event=='line': traced[kind].add(frame.f_lineno)
                return trace
            old=sys.gettrace();sys.settrace(trace)
            try:return m.load_backend()
            finally:sys.settrace(old)
        def identity(fn):
            g=fn.__globals__
            assert fn.__code__==reference
            assert fn.__module__=='accepted_accounted_adapter' and g['supervise_accounted'] is fn
            assert g['__file__']==str(adapter_path) and g['__spec__'].origin==str(adapter_path)
            assert g['HERE']==adapter_path.parent and g['PIN']==pin(raw[transitive])['sha256']
            return dict(codeMatchesCheckedSource=True,origin=str(adapter_path.relative_to(root)),globalsOwned=True,transitivePin=g['PIN'],backendPin=variants['candidate'].BACKEND_PINS[backend.removeprefix('test/')])
        for kind in variants:
            fn=run_load(kind)
            RESULT['cases'].append(dict(case=kind+' normal source',identity=identity(fn)))
        assert pair[0].lineno in traced['candidate'] and pair[1].lineno in traced['candidate']
        control_line=control_load.body[-2].lineno
        assert control_line in traced['legacy']
        RESULT['controlPreflight']['executedLines']=dict(candidate=sorted(traced['candidate']),legacy=sorted(traced['legacy']))
        # Genuine timestamp pyc: valid source remains byte-for-byte pinned; only cache is hostile.
        cache=Path(importlib.util.cache_from_source(str(adapter_path)))
        cache.parent.mkdir(exist_ok=True)
        original_stat=adapter_path.stat()
        hostile=b"raise RuntimeError('independent poisoned timestamp bytecode')\n"
        hostile+=b' '*(len(raw[adapter])-len(hostile))
        assert len(hostile)==len(raw[adapter])
        pyc=importlib.util.MAGIC_NUMBER+struct.pack('<III',0,int(original_stat.st_mtime)&0xffffffff,len(raw[adapter]))+marshal.dumps(compile(hostile,str(adapter_path),'exec',dont_inherit=True))
        cache.write_bytes(pyc)
        header=struct.unpack('<III',cache.read_bytes()[4:16])
        assert header==(0,int(adapter_path.stat().st_mtime)&0xffffffff,adapter_path.stat().st_size)
        assert adapter_path.read_bytes()==raw[adapter] and adapter_path.stat().st_mtime_ns==original_stat.st_mtime_ns
        RESULT['fixture']=dict(source=pin(adapter_path.read_bytes()),poisonedSource=pin(hostile),pyc=pin(pyc),flags=header[0],mtime=header[1],sourceSize=header[2],sourceUnchanged=True)
        PHASE='genuine legacy poisoned-cache qualification'
        try:run_load('legacy')
        except RuntimeError as e:
            assert str(e)=='independent poisoned timestamp bytecode',repr(e)
            RESULT['cases'].append(dict(case='legacy poisoned timestamp cache',exposed=str(e)))
        else:raise AssertionError('invalid control: legacy did not consume poisoned bytecode')
        PHASE='candidate poisoned-cache production boundary'
        RESULT['cases'].append(dict(case='candidate poisoned timestamp cache',identity=identity(run_load('candidate'))))
        PHASE='candidate wrong-source-pin rejection'
        wrong=bytearray(raw[adapter]);wrong[-1]^=1;adapter_path.write_bytes(wrong)
        try:run_load('candidate')
        except RuntimeError as e:
            assert str(e)=='accepted backend identity mismatch: '+adapter.removeprefix('test/')
            RESULT['cases'].append(dict(case='candidate wrong source pin',rejected=str(e)))
        else:raise AssertionError('candidate accepted wrong source pin')
        adapter_path.write_bytes(raw[adapter])
        PHASE='tiny combined-backend identity/namespace/selector interaction'
        # The API returns a function, not a backend module. Resolve its caller-declared
        # exact backend source separately; the adapter itself is never invoked.
        bmod=module_from_bytes(backend_path.read_bytes(),backend_path,'independent_combined_backend')
        assert bmod.Backend.create.__globals__ is bmod.Backend.serve.__globals__ is bmod.__dict__
        assert bmod.Backend.serve.__code__.co_filename==str(backend_path)
        b=bmod.Backend(root/'unmounted-domain')
        ino=b.create(1,b'file',stat.S_IFREG|0o600)
        before=copy.deepcopy(vars(b))
        try:b.create(ino,b'bad-child',stat.S_IFREG|0o600)
        except OSError as e: assert e.errno==errno.ENOTDIR
        else:raise AssertionError('namespace accepted regular file as parent')
        assert vars(b)==before
        r,w=os.pipe();b.fd=r
        events=[]
        class Control:
            def bind(self,path):events.append('bind')
            def listen(self,n):events.append('listen')
            def close(self):events.append('control.close')
        class Selector:
            def __init__(self):self.count=0
            def register(self,obj,mask):
                self.count+=1;events.append('register'+str(self.count))
                if self.count==2:raise OSError(errno.EINVAL,'owned selector fixture failure')
            def close(self):events.append('selector.close')
        control=Control();selector=Selector()
        try:
            with patch.object(bmod.socket,'socket',return_value=control),patch.object(bmod.selectors,'DefaultSelector',return_value=selector):
                try:b.serve(root/'never-bound.sock')
                except OSError as e:assert e.errno==errno.EINVAL and str(e).endswith('owned selector fixture failure')
                else:raise AssertionError('fixture failed to reach selector registration')
            try:os.fstat(r)
            except OSError as e:assert e.errno==errno.EBADF
            else:raise AssertionError('backend fd leaked')
            assert events==['bind','listen','register1','register2','selector.close','control.close']
            os.fstat(w)
        finally:
            os.close(w)
        assert bmod.Backend.create.__globals__['__file__']==bmod.Backend.serve.__globals__['__file__']==str(backend_path)
        RESULT['cases'].append(dict(case='one namespace rejection plus selector registration failure cleanup',backend=pin(backend_path.read_bytes()),namespaceErrno='ENOTDIR',stateUnchanged=True,events=events,ownedFDClosed=True,borrowedFDAlive=True,sameCheckedModuleGlobals=True,transport='mock control and selector; local anonymous pipe only'))
    assert not RESULT['childrenAttempted']
    assert {p:pin((REPO/p).read_bytes()) for p in raw}==d['sourcePins']
    RESULT.update(status='ACCEPT_SOURCE_LOCAL_ONLY',sourcePinsBefore=d['sourcePins'],sourcePinsAfter=d['sourcePins'],retainedCallerChecks=41,retainedBackendChecks=52,replayedPriorChecks=False,adapterInvocations=0,children=0,nextGate='Separately reviewed transitive adapter repair/acceptance before production seven-guard wire, mounted/kernel and CLI/browser qualification; coordinator review before shared integration')

if __name__=='__main__':
    try:main()
    except BaseException as e:
        RESULT.update(status='STOP_DIAGNOSTIC',phase=PHASE,error=repr(e),classification='fixture/control failure' if PHASE in {'identity preflight','fixture/control normal-load qualification','genuine legacy poisoned-cache qualification'} else 'candidate defect or interaction diagnostic; review traceback')
        raise
    finally:
        OUT.joinpath('results.json').write_text(json.dumps(RESULT,indent=2)+'\n')
        print(json.dumps({k:RESULT[k] for k in ['status','scope','cases','childrenAttempted']}))
