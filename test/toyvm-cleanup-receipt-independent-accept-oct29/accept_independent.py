"""Independent production loader/adapter/evaluate tests. All backend I/O is fake.

Run via owned supervisor.py, never a predecessor supervisor. No process is
created by this script. Optional caller path is only for the rejecting mutation.
"""
import contextlib,copy,hashlib,importlib.util,io,json,pathlib,runpy,sys,tempfile,types
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[2]
SOURCE=ROOT/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
source=pathlib.Path(sys.argv[2]) if len(sys.argv)>2 else SOURCE
if source==SOURCE:
    assert hashlib.sha256(source.read_bytes()).hexdigest()=='73c5bd33eb8af3887f5c6f21a8c6354aef591baf2d41589eb673c9d275448b60'
spec=importlib.util.spec_from_file_location('production_caller',source)
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
receipt=pathlib.Path(sys.argv[1])
LIMITS=dict(live_limit=32768,write_limit=65536,file_limit=16384,rss_limit=128*1024**2,cpu_limit=1.25,wall_limit=2.5,output_limit=4096)
COMMAND=['deterministic-not-executed']
BASE=dict(unmountExit=0,remainingMounts=[],serverExit=-15,unmountStdout='',unmountStderr='',serverStdout='',serverStderr='')
STATE=dict(live=12288,peak=12288,written=5,failure=None,openHandles=0)
MISSING=object()
checks=[]
real_spec=importlib.util.spec_from_file_location
real_read=pathlib.Path.read_text
real_exists=pathlib.Path.exists

def one(name,cleanup,complete=True,*,expected=False,mode='normal',server_exit=-15,unmount_exit=0):
    trace=[]
    with tempfile.TemporaryDirectory(prefix='owned-fixture-',dir=ROOT) as tmp:
        work=pathlib.Path(tmp)
        # Adapter performs its real attachment of filesystemCleanup; the fake
        # supervise result injects the adversarial JSON value at that boundary.
        class Result(dict):
            def __setitem__(self,key,value):
                if key=='filesystemCleanup' and mode=='normal':
                    if cleanup is MISSING: return
                    value=copy.deepcopy(cleanup)
                super().__setitem__(key,value)
        def fake_supervise(argv,**limits):
            trace.append('tiny-supervisor-fixture')
            assert argv==[sys.executable,'-B',str(ROOT/'test/toyvm-kernel-profile-accounting-backend-oct28/confine.py'),str(work/'domain'),*COMMAND]
            assert limits['check']() is None
            r=Result(exit=0,stopReason=None,cpuSeconds=.01,wallSeconds=.1,peakRSS=10000000,output=b'ok\n')
            if complete is not MISSING:r['cleanupComplete']=complete
            return r
        class WrappedLoader:
            def __init__(self,loader):self.loader=loader
            def create_module(self,spec):return self.loader.create_module(spec)
            def exec_module(self,module):
                self.loader.exec_module(module)
                trace.append('exact-pinned-supervisor-imported')
                module.supervise=fake_supervise
        def spec_factory(name,path,*args,**kwargs):
            spec=real_spec(name,path,*args,**kwargs)
            if name=='immutable_supervisor':spec.loader=WrappedLoader(spec.loader)
            if name=='accepted_accounted_adapter':trace.append('exact-pinned-adapter-loaded')
            return spec
        class Server:
            returncode=None
            def poll(self):return self.returncode
            def terminate(self):trace.append('fake-server-terminate');self.returncode=server_exit
            def communicate(self,**kwargs):trace.append('fake-server-communicate');return b'',b''
        def popen(argv,**kwargs):
            trace.append('fake-server-Popen')
            assert argv==[sys.executable,'-B',str(ROOT/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'),str(work/'domain'),str(work/'status.sock'),'32768','65536','16384']
            return Server()
        class Socket:
            def __enter__(self):self.parts=[json.dumps(STATE).encode(),b''];return self
            def __exit__(self,*args):pass
            def settimeout(self,v):pass
            def connect(self,path):assert path==str(work/'status.sock')
            def recv(self,n):return self.parts.pop(0)
        mount_reads=[]
        def read(path,*args,**kwargs):
            if str(path)=='/proc/self/mountinfo':
                mount_reads.append(True)
                if mode in ('unmount-fails','mount-remains') and len(mount_reads)==1:return 'fixture '+str(work/'domain')
                if mode=='mount-remains':return 'fixture '+str(work/'domain')
                return ''
            return real_read(path,*args,**kwargs)
        def exists(path):return True if path==work/'status.sock' else real_exists(path)
        def unmount(argv,**kwargs):
            trace.append('fake-unmount')
            assert argv==['/usr/bin/fusermount3','-u','--',str(work/'domain')]
            return types.SimpleNamespace(returncode=unmount_exit,stdout=b'',stderr=b'fixture cleanup failure')
        args=['--domain','tiny-fixture','--receipt',str(receipt),'--work',str(work)]
        for k,v in LIMITS.items():args.extend(['--'+k.replace('_','-'),str(v)])
        with patch.object(importlib.util,'spec_from_file_location',side_effect=spec_factory),patch('subprocess.Popen',side_effect=popen),patch('subprocess.run',side_effect=unmount),patch('socket.socket',side_effect=lambda *a,**k:Socket()),patch.object(pathlib.Path,'read_text',read),patch.object(pathlib.Path,'exists',exists):
            api=c.qualify(domain='tiny-fixture',receipt=receipt,command=COMMAND,work=work,**LIMITS)
            mount_reads.clear()  # API and CLI receive independent identical mount snapshots.
            stream=io.StringIO()
            with contextlib.redirect_stdout(stream),patch.object(sys,'argv',[str(source),*args,'--',*COMMAND]):
                try:runpy.run_path(str(source),run_name='__main__')
                except SystemExit as exit:code=exit.code
                else:raise AssertionError('production CLI did not exit')
            cli=json.loads(stream.getvalue())
        witness=dict(name=name,expected=expected,api=api,cli=cli,cliExit=code,trace=trace,actualSpawns=0)
        print(json.dumps(witness,sort_keys=True),flush=True)
        assert json.loads(json.dumps(api))==cli,(name,'API CLI differ')
        assert trace.count('exact-pinned-adapter-loaded')==2 and trace.count('tiny-supervisor-fixture')==2
        assert api['accepted'] is expected and cli['accepted'] is expected and code==(0 if expected else 1),name
        assert api['browserAllowed'] is False and api['browserAllowanceRemaining']==c.BROWSER_ALLOWANCE
        if not expected: assert api['cleanupComplete'] is False,name
        checks.append(name)

# New JSON-shaped nested contents and combinations; no replay of repair's 78.
for unmount,server in [(None,0),(None,-15),(0,0),(0,-15)]:
    clean=dict(BASE,unmountExit=unmount,serverExit=server)
    one('valid-contract-'+repr((unmount,server)),clean,expected=True)
for i,contents in enumerate([[None],[False],[0],[''],[[]],[{}],[{'mountpoint':'/owned','mounted':False}],['\u0000'],['/a','/b']]):
    one('remainingMounts-nested-'+str(i),dict(BASE,remainingMounts=contents))
for i,shape in enumerate([{'0':[]},[dict(BASE)],{'cleanup':BASE},{'remainingMounts':[]},dict(BASE,unmountExit={'returncode':0}),dict(BASE,serverExit={'returncode':-15})]):
    one('JSON-shape-'+str(i),shape)
for field in ['remainingMounts','unmountExit','serverExit']:
    value=dict(BASE);value.pop(field)
    one('missing-field-with-success-diagnostics-'+field,dict(value,serverStdout='cleanup succeeded',serverStderr=''))
for i,value in enumerate([{'accepted':True},[True],{'value':True},'True']):
    one('cleanupComplete-structured-'+str(i),BASE,value)
one('missing-complete-clean-filesystem',BASE,MISSING)
one('missing-receipt-complete-true',MISSING)
# Real adapter finally raises after a successful child receipt. No injected
# cleanup override in these cases: test caller exception path and CLI status.
one('adapter-unmount-failure-after-success',None,mode='unmount-fails',unmount_exit=1)
one('adapter-mount-remains-after-success',None,mode='mount-remains')
one('adapter-server-failure-after-success',None,mode='server-fails',server_exit=9)
# Required mutation target. The repaired caller rejects JSON boolean False.
one('mutation-oracle-bool-unmount',dict(BASE,unmountExit=False))
print(json.dumps(dict(PASS=True,count=len(checks),actualSpawns=0,checks=checks)))
