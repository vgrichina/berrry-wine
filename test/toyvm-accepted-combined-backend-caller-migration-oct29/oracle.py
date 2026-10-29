"""Caller-only source acceptance; no returned adapter invocation or child process."""
import ast, contextlib, copy, errno, hashlib, json, os, pathlib, py_compile
import struct, subprocess, tempfile, types
from unittest.mock import patch
HERE=pathlib.Path(__file__).resolve().parent
REPO=HERE.parents[1]
CALLER=REPO/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
PROOF=json.loads((HERE/'provenance.json').read_text())
SOURCE=CALLER.read_bytes()
BACKEND=REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
ADAPTER='toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py'
PIN='75842ffafd6ebd0c29fa2889a463bfd6f5245634096f4dfef9a3fd69f703e822'
STALE='b8201b2c4a1d0e1fd653bb02fda7870f626d3781bed014657fb974cc24e41c40'
RESULT=[]
def module(source,path):
    m=types.ModuleType('private_oracle');m.__file__=str(path)
    exec(compile(source,str(path),'exec',dont_inherit=True),m.__dict__)
    return m

def denied(*a,**kw):
    raise AssertionError('Popen/spawn sentinel: actual child forbidden')

@contextlib.contextmanager
def sentinels():
    with contextlib.ExitStack() as stack:
        stack.enter_context(patch.object(subprocess,'Popen',denied))
        for name in dir(os):
            if name.startswith(('spawn','posix_spawn','exec')) or name in ('fork','forkpty','system'):
                if callable(getattr(os,name)):stack.enter_context(patch.object(os,name,denied))
        yield

def boundary(source,kind):
    with tempfile.TemporaryDirectory(prefix='.fixture-',dir=HERE) as directory:
        root=pathlib.Path(directory)
        for name in PROOF['beforeSourcePins']:
            if name.endswith('/qualify_accounted.py'):continue
            target=root/name;target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes((REPO/name).read_bytes())
        adapter=root/'test'/ADAPTER
        original=adapter.read_bytes();stat=adapter.stat()
        poison=b"def supervise_accounted(*a, **kw): return 'POISON'\n"
        poison+=b'#'*(len(original)-len(poison))
        if kind in ('timestamp-pyc','unchecked-pyc'):
            adapter.write_bytes(poison)
            os.utime(adapter,ns=(stat.st_atime_ns,stat.st_mtime_ns))
            mode=py_compile.PycInvalidationMode.TIMESTAMP if kind=='timestamp-pyc' else py_compile.PycInvalidationMode.UNCHECKED_HASH
            py_compile.compile(str(adapter),doraise=True,invalidation_mode=mode)
            adapter.write_bytes(original);os.utime(adapter,ns=(stat.st_atime_ns,stat.st_mtime_ns))
        m=module(source,CALLER);m.ROOT=root
        if kind=='backend-mismatch':
            (root/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').write_bytes(b'bad backend')
            try:m.load_backend()
            except RuntimeError as e:
                assert 'identity mismatch' in str(e);return
            raise AssertionError('backend mismatch accepted')
        expected=module(original,adapter).supervise_accounted
        read=pathlib.Path.read_bytes;reads=[]
        def replace_after_read(path):
            data=read(path)
            if path==adapter:
                reads.append(path);path.write_bytes(poison)
            return data
        with patch.object(pathlib.Path,'read_bytes',replace_after_read if kind=='checked-read-replacement' else read):
            function=m.load_backend()
        assert function.__name__==expected.__name__
        assert function.__module__=='accepted_accounted_adapter'
        assert function.__globals__['__file__']==str(adapter)
        assert function.__code__.co_filename==str(adapter)
        assert function.__code__.co_code==expected.__code__.co_code
        assert function.__code__.co_consts==expected.__code__.co_consts
        assert function.__globals__['PIN']==expected.__globals__['PIN']
        assert function.__globals__['HERE']==expected.__globals__['HERE']
        assert function.__globals__['__spec__'].origin==str(adapter)
        if kind=='checked-read-replacement':assert reads==[adapter]
        # Deliberately never invoke function.

def small_backend():
    source=BACKEND.read_bytes()
    assert hashlib.sha256(source).hexdigest()==PIN
    m=module(source,BACKEND)
    b=m.Backend(str(HERE));b.fd=13579
    P=lambda fmt,*args:struct.pack('<'+fmt,*args)
    init=P('2I',7,31)
    request=P('2I2Q4I',48,26,101,1,0,0,0,0)+init
    events=[];answers=[];snapshot=[];reads=iter([request,b''])
    class Conn:
        def __enter__(self):return self
        def __exit__(self,*a):pass
        def sendall(self,data):snapshot.append(json.loads(data))
    class Listener:
        def bind(self,path):events.append('bind')
        def listen(self,n):events.append('listen')
        def accept(self):return Conn(),None
        def close(self):events.append('listener-close')
    listener=Listener()
    class Selector:
        def register(self,*args):events.append('register')
        def select(self,timeout):
            if not snapshot:return [(types.SimpleNamespace(fileobj=listener),1)]
            return [(types.SimpleNamespace(fileobj=b.fd),1)]
        def close(self):events.append('selector-close')
    m.socket=types.SimpleNamespace(socket=lambda *a:listener,AF_UNIX=1)
    m.selectors=types.SimpleNamespace(DefaultSelector=Selector,EVENT_READ=1)
    m.os=types.SimpleNamespace(getuid=os.getuid,getgid=os.getgid,read=lambda *a:next(reads),write=lambda fd,data:answers.append(data),close=lambda fd:events.append(('fd-close',fd)))
    b.serve(HERE/'.unused-status')
    assert snapshot[0]['operations']==0
    assert len(answers)==1 and struct.unpack_from('<IiQ',answers[0])==(len(answers[0]),0,101)
    assert struct.unpack_from('<2I',answers[0],16)==(7,31)
    assert events[-3:]==['selector-close','listener-close',('fd-close',13579)]
    # Exact Backend.handle follows INIT already delivered by exact serve above.
    directory=struct.unpack_from('<Q',b.handle(9,1,P('2I',0o700,0)+b'dir\0'))[0]
    file=struct.unpack_from('<Q',b.handle(35,1,P('4I',0,0o600,0,0)+b'file\0'))[0]
    for op,ino,data,error in [(35,file,P('4I',0,0o600,0,0)+b'bad\0',errno.ENOTDIR),(12,999,P('Q',1)+b'file\0moved\0',errno.ENOENT),(12,1,P('Q',file)+b'file\0moved\0',errno.ENOTDIR)]:
        before=copy.deepcopy(vars(b))
        try:b.handle(op,ino,data)
        except OSError as e:assert e.errno==error
        else:raise AssertionError('namespace guard absent')
        after=copy.deepcopy(vars(b));assert after.pop('operations')==before.pop('operations')+1
        assert after==before
    b.handle(16,file,P('2QI',file,0,2)+bytes(20)+b'ok')
    assert b.handle(15,file,P('2QI',file,0,2))==b'ok'
    return dict(serve='exact production source, synthetic selector/read/write only',initFirst=True,namespaceRejections=3,postRejectionReadWrite=True,cleanup=events[-3:])

def main():
    assert len(SOURCE)==8392 and hashlib.sha256(SOURCE).hexdigest()==PROOF['afterCaller']['sha256']
    for name,pin in PROOF['beforeSourcePins'].items():
        if name.endswith('/qualify_accounted.py'):continue
        data=(REPO/name).read_bytes();assert len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256']
    with sentinels():
        # Earliest relevant production boundary first, no broad regression replay.
        for kind in ('normal','backend-mismatch','timestamp-pyc','unchecked-pyc','checked-read-replacement'):
            boundary(SOURCE,kind);RESULT.append(kind)
        interaction=small_backend()
        stale=SOURCE.replace(PIN.encode(),STALE.encode())
        try:boundary(stale,'normal')
        except RuntimeError as e:assert 'identity mismatch' in str(e)
        else:raise AssertionError('stale pin control accepted')
        RESULT.append('stale-pin-control-rejected')
        tree=ast.parse(SOURCE);node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='load_backend')
        lines=SOURCE.decode().splitlines(keepends=True)
        legacy=''.join(lines[:node.lineno-1])+ast.get_source_segment(SOURCE.decode(),node).replace("code = compile(validated_sources[relative], str(path), 'exec', dont_inherit=True)\n    exec(code, module.__dict__)","spec.loader.exec_module(module)")+ '\n'+''.join(lines[node.end_lineno:])
        assert legacy.encode()!=SOURCE
        try:boundary(legacy.encode(),'unchecked-pyc')
        except AssertionError:pass
        else:raise AssertionError('legacy loader control accepted')
        RESULT.append('legacy-loader-control-rejected')
    output=dict(PASS=True,checks=RESULT,interaction=interaction,children=0,adapterInvocations=0,scope='source and synthetic local dispatch only; no mount/kernel/CLI/browser or transitive adapter acceptance')
    (HERE/'results.json').write_text(json.dumps(output,indent=2)+'\n')
    print(json.dumps(output))
if __name__=='__main__':main()
