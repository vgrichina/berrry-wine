#!/usr/bin/env python3
import json,os,pathlib,signal,subprocess,sys,tempfile
import supervise_accounted as adapter

results=[]
with tempfile.TemporaryDirectory(prefix='toyvm-backend-loss-') as temp:
    original=subprocess.Popen;server=[];killed=[]
    def popen(argv,*args,**kwargs):
        p=original(argv,*args,**kwargs)
        if any(str(a).endswith('/fuse_backend.py') for a in argv):server.append(p.pid)
        return p
    adapter.subprocess.Popen=popen
    def interrupt():
        if not killed:
            os.kill(server[0],signal.SIGKILL);killed.append(server[0])
    try:
        adapter.supervise_accounted([sys.executable,'-B','-c','import time;time.sleep(.1)'],temp,check=interrupt,rss_limit=128*1024**2,cpu_limit=90,wall_limit=3,output_limit=65536)
        raise AssertionError('dead authoritative backend accepted')
    except RuntimeError as e:
        assert str(e)=='filesystem backend exited',str(e)
        remaining=[s for s in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if temp in s]
        assert not remaining,remaining
        assert not pathlib.Path('/proc/'+str(server[0])).exists()
        results.append(dict(name='authoritative-backend-loss',error=str(e),serverReaped=True,mountsRemaining=remaining))
    finally:adapter.subprocess.Popen=original

pin=adapter.PIN;adapter.PIN='0'*64
try:
    adapter.supervise_accounted([], '/tmp/never-created-toyvm-pin-control')
    raise AssertionError('wrong supervisor source accepted')
except RuntimeError as e:
    assert str(e)=='supervisor identity mismatch'
    results.append(dict(name='supervisor-pin',error=str(e)))
finally:adapter.PIN=pin

with tempfile.TemporaryFile() as file:
    p=subprocess.run([sys.executable,'-B',str(pathlib.Path(__file__).with_name('confine.py')),'/tmp','/bin/true'],stdin=file,capture_output=True,timeout=3)
    assert p.returncode!=0 and b'inherited writable regular file rejected' in p.stderr
    results.append(dict(name='inherited-writable-stdio-rejected',exit=p.returncode,stdout=p.stdout.decode(),stderr=p.stderr.decode()))
with tempfile.TemporaryDirectory(prefix='toyvm-existing-root-') as temp:
    (pathlib.Path(temp)/'domain').mkdir()
    try:
        adapter.supervise_accounted(['/bin/true'],temp)
        raise AssertionError('backend setup failure accepted')
    except RuntimeError as e:
        assert str(e)=='filesystem mount/backend failed',str(e)
        assert 'FileExistsError' in e.filesystemCleanup['serverStderr']
        assert e.filesystemCleanup['unmountExit'] is None
        assert not e.filesystemCleanup['remainingMounts']
        results.append(dict(name='setup-failure-retains-cause',error=str(e),cleanup=e.filesystemCleanup))

with tempfile.TemporaryDirectory(prefix='toyvm-status-loss-') as temp:
    removed=[]
    def unlink_status():
        if not removed:
            os.unlink(pathlib.Path(temp)/'status.sock');removed.append(True)
    try:
        adapter.supervise_accounted([sys.executable,'-B','-c','import time;time.sleep(.1)'],temp,check=unlink_status,rss_limit=128*1024**2,cpu_limit=90,wall_limit=3,output_limit=65536)
        raise AssertionError('missing authoritative status accepted as zero')
    except FileNotFoundError as e:
        assert e.errno==2 and not e.filesystemCleanup['remainingMounts']
        results.append(dict(name='status-ENOENT-fails-closed',errno=e.errno,error=str(e),cleanup=e.filesystemCleanup))
print(json.dumps(dict(checks=5,results=results),indent=2))
