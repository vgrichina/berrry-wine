#!/usr/bin/python3
"""Combined source/local-wire oracle; every real process launch is denied."""
import ast, copy, errno, hashlib, importlib.util, inspect, json, marshal
import os, pathlib, struct, subprocess, sys, tempfile, types
from contextlib import ExitStack
from unittest.mock import patch
HERE=pathlib.Path(__file__).resolve().parent
REPO=HERE.parents[1]
C='test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
A='test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py'
S='test/toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py'
F='test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
PINS=json.loads((HERE/'source-pins.json').read_text())
SOURCES={p:(REPO/p).read_bytes() for p in PINS['after']}
MALICE=b"raise AssertionError('SUBSTITUTED UNCHECKED SOURCE')\n"
results=[]; denied=[]; sentinels=[]
class Sentinel(BaseException): pass

def pin(b): return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def mod(source,path,name):
    spec=importlib.util.spec_from_file_location(name,path)
    m=importlib.util.module_from_spec(spec)
    exec(compile(source,str(path),'exec',dont_inherit=True),m.__dict__)
    return m
def identity(fn,source,path,name,attribute):
    expected=getattr(mod(source,path,'oracle_expected'),attribute)
    assert isinstance(fn,types.FunctionType)
    assert marshal.dumps(fn.__code__)==marshal.dumps(expected.__code__), 'code provenance'
    assert fn.__defaults__==expected.__defaults__ and fn.__kwdefaults__==expected.__kwdefaults__
    assert fn.__module__==name and fn.__globals__['__name__']==name
    assert pathlib.Path(fn.__globals__['__file__'])==path

def forbidden(*a,**kw):
    denied.append(repr(a)[:120])
    raise AssertionError('REAL CHILD/MOUNT/SPAWN DENIED')

def audit(event,args):
    if event in ('subprocess.Popen','os.system','os.posix_spawn','os.fork','os.forkpty','os.exec','os.spawn'):
        forbidden(event)
sys.addaudithook(audit)

def cache(path,kind):
    source=path.read_bytes(); st=path.stat()
    header=importlib.util.MAGIC_NUMBER
    if kind=='timestamp':
        header+=struct.pack('<III',0,int(st.st_mtime),len(source))
    else:
        header+=struct.pack('<I',1)+importlib.util.source_hash(source)
    cached=pathlib.Path(importlib.util.cache_from_source(str(path)))
    cached.parent.mkdir(exist_ok=True)
    cached.write_bytes(header+marshal.dumps(compile(MALICE,str(path),'exec')))

def interaction(mode='normal',boundary=A,control=None,tamper=None):
    # New owned copies for every case; never alter predecessor or production.
    with tempfile.TemporaryDirectory(prefix='interaction-',dir=REPO.parent) as td:
        root=pathlib.Path(td)
        for relative,source in SOURCES.items():
            p=root/relative; p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(source)
        caller_source=SOURCES[C]
        if control=='old-caller-loader':
            caller_source=caller_source.replace(
                b"code = compile(validated_sources[relative], str(path), 'exec', dont_inherit=True)\n    exec(code, module.__dict__)",
                b"spec.loader.exec_module(module)")
            assert b"spec.loader.exec_module(module)" in caller_source
        elif control=='old-adapter-loader':
            old=(HERE/'base-adapter.txt').read_bytes()
            (root/A).write_bytes(old)
            caller_source=caller_source.replace(PINS['after'][A]['sha256'].encode(),pin(old)['sha256'].encode())
        elif control=='old-adapter-pin':
            caller_source=(HERE/'base-caller.txt').read_bytes()
        caller=mod(caller_source,root/C,'actual_caller')
        adapter_loaded=False; reads=[]; reached=[]
        original_read=pathlib.Path.read_bytes
        def read(p):
            data=original_read(p)
            if p==root/boundary:
                reads.append('adapter-phase' if adapter_loaded else 'caller-phase')
                # Supervisor is checked once in caller and again by the adapter.
                eligible=(boundary==A or adapter_loaded)
                if mode=='replacement' and eligible:
                    p.write_bytes(MALICE)
            return data
        def popen(*args,**kwargs):
            # Only the adapter's exact first backend command may reach this sentinel.
            frame=inspect.currentframe().f_back
            try:
                assert frame.f_code.co_name=='supervise_accounted'
                supervisor=frame.f_locals['m']
                assert supervisor.__name__=='immutable_supervisor'
                assert pathlib.Path(supervisor.__file__)==root/S
                identity(supervisor.supervise,SOURCES[S],root/S,'immutable_supervisor','supervise')
                assert args==([sys.executable,'-B',str((root/A).parent/'fuse_backend.py'),
                    str(root/'work/domain'),str(root/'work/status.sock'),'32768','65536','16384'],)
                assert kwargs==dict(stdout=subprocess.PIPE,stderr=subprocess.PIPE)
                reached.append(True); sentinels.append(dict(mode=mode,boundary=boundary,control=control))
                raise Sentinel()
            finally: del frame
        with ExitStack() as stack:
            stack.enter_context(patch.object(pathlib.Path,'read_bytes',read))
            for name in ('run','call','check_call','check_output'):
                stack.enter_context(patch.object(subprocess,name,forbidden))
            stack.enter_context(patch.object(subprocess,'Popen',popen))
            for name in ('system','fork','forkpty','posix_spawn','posix_spawnp','spawnl','spawnle',
                         'spawnlp','spawnlpe','spawnv','spawnve','spawnvp','spawnvpe','execl','execle',
                         'execlp','execlpe','execv','execve','execvp','execvpe'):
                if hasattr(os,name): stack.enter_context(patch.object(os,name,forbidden))
            if mode in ('timestamp','unchecked'):
                cache(root/boundary,mode)
            if mode=='poison':
                poison=types.ModuleType('poison')
                poison.supervise=forbidden; poison.supervise_accounted=forbidden
                stack.enter_context(patch.dict(sys.modules,{'accepted_accounted_adapter':poison,
                    'immutable_supervisor':poison}))
            if tamper and tamper!='after-load-supervisor':
                (root/tamper).write_bytes(MALICE)
            try:
                fn=caller.load_backend()
                adapter_loaded=True
                identity(fn,(HERE/'base-adapter.txt').read_bytes() if control=='old-adapter-loader' else SOURCES[A],root/A,'accepted_accounted_adapter','supervise_accounted')
                if tamper=='after-load-supervisor': (root/S).write_bytes(MALICE)
                fn(['NO-CHILD'],root/'work')
            except Sentinel:
                assert reached==[True] and tamper is None
            except RuntimeError as e:
                if control=='old-adapter-pin': raise
                assert tamper is not None and not reached, str(e)
                assert 'identity mismatch' in str(e)
            else: raise AssertionError('failed to reach strict sentinel or fail closed')
            if tamper:
                assert not reached
            else:
                assert reached==[True]
            if mode=='replacement':
                assert (root/boundary).read_text()==MALICE.decode()
                assert len(reads)==(1 if boundary==A else 2),reads

def run():
    assert {p:pin(b) for p,b in SOURCES.items()}==PINS['after']
    old=(HERE/'base-caller.txt').read_bytes()
    assert pin(old)==PINS['before'][C]
    assert pin((HERE/'base-adapter.txt').read_bytes())==PINS['before'][A]
    before=PINS['before'][A]['sha256'].encode(); after=PINS['after'][A]['sha256'].encode()
    assert old.count(before)==1 and SOURCES[C]==old.replace(before,after)
    assert ast.dump(ast.parse(SOURCES[C].replace(after,before)))==ast.dump(ast.parse(old))
    # Earliest behavior: exact production caller -> returned adapter -> supervisor -> sentinel.
    interaction()
    results.append('normal exact caller/adapter/supervisor provenance and strict Popen sentinel')
    for boundary in (A,S):
        for mode in ('timestamp','unchecked','poison','replacement'):
            interaction(mode,boundary)
            results.append(mode+' substitution resisted at '+boundary)
    for dependency in SOURCES:
        if dependency==C: continue
        interaction(tamper=dependency)
        results.append('tampered caller dependency fail closed: '+dependency)
    interaction(tamper='after-load-supervisor')
    results.append('tampered supervisor after caller check fails at adapter before child')
    controls=[]
    for control,mode,boundary in (
        ('old-caller-loader','timestamp',A),
        ('old-caller-loader','replacement',A),
        ('old-adapter-loader','unchecked',S),
        ('old-adapter-loader','replacement',S),
        ('old-adapter-pin','normal',A)):
        try: interaction(mode,boundary,control)
        except (AssertionError,RuntimeError) as e:
            assert ('identity mismatch' in str(e)) if control=='old-adapter-pin' else ('SUBSTITUTED UNCHECKED SOURCE' in str(e)), (control,str(e))
            controls.append(dict(control=control,mode=mode,rejected=True,reason=str(e)))
        else: raise AssertionError('same oracle accepted negative control: '+control)
    # INIT-first local-wire namespace request, no kernel/mount/runtime.
    b=mod(SOURCES[F],REPO/F,'actual_backend').Backend(HERE/'never-mounted',
        live_limit=262144,write_limit=65536,file_limit=16384)
    pack=lambda fmt,*v:struct.pack('<'+fmt,*v)
    assert struct.unpack_from('<2I',b.handle(26,1,pack('4I',7,31,0,0)))==(7,31)
    def mkdir(parent,name):
        return struct.unpack_from('<Q',b.handle(9,parent,pack('2I',0o700,0)+name+b'\0'))[0]
    def create(parent,name):
        return struct.unpack_from('<Q',b.handle(35,parent,pack('4I',0,0o600,0,0)+name+b'\0'))[0]
    left=mkdir(1,b'left'); right=mkdir(1,b'right')
    item=create(left,b'item'); other=create(right,b'item')
    prior=copy.deepcopy(b.__dict__)
    try: b.handle(12,left,pack('Q',right)+b'item\0.\0')
    except OSError as e: assert e.errno==errno.EINVAL
    else: raise AssertionError('invalid dot namespace accepted')
    after_state=copy.deepcopy(b.__dict__)
    assert after_state.pop('operations')==prior.pop('operations')+1 and after_state==prior
    b.handle(12,left,pack('Q',right)+b'item\0moved\0')
    assert b.nodes[left]['names']=={} and b.nodes[right]['names']=={b'item':other,b'moved':item}
    assert struct.unpack_from('<Q',b.handle(1,right,b'moved\0'))[0]==item
    results.append('INIT-first namespace positive rename/lookup plus dot rejection full-state invariant')
    assert denied==[],denied
    assert {p:pin((REPO/p).read_bytes()) for p in SOURCES}==PINS['after']
    report=dict(outcome='PASS_CANDIDATE_LOCAL_INTERACTION_ONLY',checks=results,
        controls=controls,strictSentinels=len(sentinels),actualChildren=0,forbiddenAttempts=denied,
        independentCombinedAcceptance=False,scope='source/local-wire through strict Popen sentinel only',
        broadSuitesReplayed=False,sourcePins=PINS['after'])
    (HERE/'results.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(dict(outcome=report['outcome'],checks=len(results),controls=len(controls),
        strictSentinels=len(sentinels),actualChildren=0)))
if __name__=='__main__': run()
