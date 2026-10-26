"""Independent stdlib fixture at production adapter/default-executor boundaries.

The outer fixture is a subreaper solely to reap an owner orphaned by the caller
exit case, and to clean deliberately broken negative controls. Production owns
and must reap its transports before any outer fixture cleanup can pass.
"""
import ctypes,json,os,pathlib,signal,subprocess,sys,tempfile,time,hashlib
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo'
F=R/'test/fixtures/ricochet-serial-controller'
sys.path.insert(0,str(F));import read as adapter;import work
C=work.capture
assert ctypes.CDLL(None,use_errno=True).prctl(36,1,0,0,0)==0
observations=[]

def identity(pid):
    try:
        s=pathlib.Path('/proc',str(pid),'stat').read_text().split(') ')[1].split()
        return [pid,s[19]]
    except FileNotFoundError:return None

def records(log):
    if not log.exists():return []
    return [json.loads(s) for s in log.read_text().splitlines()]

def wait_for(f,seconds=1):
    deadline=time.monotonic()+seconds
    while not f():
        assert time.monotonic()<deadline,'bounded condition did not become true'
        time.sleep(.005)

def program(log,mode,code):
    # Each record is one O_APPEND write. Parent records child PID before its own
    # exit, so the early-exit case cannot pass vacuously through an empty log.
    s=('import os,time,json,sys,io,contextlib\n'
       f'log={str(log)!r}\n'
       'def record(role,pid=None):\n'
       ' pid=os.getpid() if pid is None else pid\n'
       ' st=open("/proc/%d/stat"%pid).read().split(") ")[1].split()\n'
       ' fd=os.open(log,os.O_CREAT|os.O_APPEND|os.O_WRONLY,0o600)\n'
       ' os.write(fd,(json.dumps(dict(role=role,pid=pid,start=st[19]))+"\\n").encode());os.close(fd)\n'
       'record("transport")\n'
       'child=os.fork()\n'
       'if child==0:\n'
       ' os.setsid()\n')
    if mode=='doublefork':
        s+=(' grandchild=os.fork()\n'
            ' if grandchild:\n'
            '  record("grandchild",grandchild);os._exit(0)\n')
    s+=(' record("detached")\n'
        +(' os.close(1);os.close(2)\n' if mode=='success' else '')+
        ' time.sleep(20);os._exit(0)\n'
        'record("spawned",child)\n')
    if mode in ('deadline','cancel','callerexit'):s+='time.sleep(20)\n'
    elif mode=='early':s+='os._exit(7)\n'
    else:
        s+='time.sleep(.04)\n'
        if mode=='success':
            s+=('buf=io.StringIO()\n'
                f'with contextlib.redirect_stdout(buf):exec({code!r},{{}})\n'
                'j=dict(exitCode=0,success=True,timedOut=False,launcherFailed=False,oomKilled=False,signal=None,stdoutTruncated=False,stderrTruncated=False,stderr="",stdout=buf.getvalue())\n'
                'print(json.dumps(j))\n')
        else:s+='os._exit(7)\n'
    return s

def cleanup():
    # This fixture process owns no external siblings. Adoption here is only an
    # emergency cleanup/normal caller-exit owner-reap; never an acceptance oracle.
    children=pathlib.Path('/proc/self/task',str(os.getpid()),'children')
    until=time.monotonic()+2
    while True:
        try:
            pid,_=os.waitpid(-1,os.WNOHANG)
        except ChildProcessError:return
        if pid:continue
        for pid in map(int,children.read_text().split()):
            try:
                fd=os.pidfd_open(pid)
                try:signal.pidfd_send_signal(fd,signal.SIGKILL)
                finally:os.close(fd)
            except ProcessLookupError:pass
        assert time.monotonic()<until,'fixture emergency cleanup deadline'
        time.sleep(.005)

def run(mode):
    with tempfile.TemporaryDirectory(dir=O) as td:
        t=pathlib.Path(td);log=t/'pids';source=t/'empty';source.write_bytes(b'')
        dest=t/'dest';dest.write_bytes(b'unchanged')
        original=work.python_argv;oldroot=adapter.R;poll=C._ProcessJob.poll
        unrelated=subprocess.Popen([sys.executable,'-S','-c','import time;time.sleep(20)'])
        unrelated_id=identity(unrelated.pid);owners=[];calls=[];error=None
        original_start=C.SubprocessExecutor.start
        def argv(code,remaining):
            intended=original(code,remaining)
            assert intended[:5]==['boat','--no-update','--json','exec','--timeout']
            calls.append(code)
            return [sys.executable,'-S','-c',program(log,mode,code)]
        def start(ex,code,remaining):
            job=original_start(ex,code,remaining);owners.append(job);return job
        def interrupted(job):
            if len(records(log))>=3:raise KeyboardInterrupt('fixture caller cancellation')
            return poll(job)
        work.python_argv=argv;adapter.R=str(t);C.SubprocessExecutor.start=start
        began=time.monotonic()
        try:
            if mode=='callerexit':
                ownerlog=t/'owner'
                caller=('import os,sys,time,pathlib\n'
                        f'sys.path.insert(0,{str(F)!r})\n'
                        'import read as adapter,work\n'
                        f'adapter.R={str(t)!r}\n'
                        'factory=work.python_argv\n'
                        f'program={program(log,mode,"ignored")!r}\n'
                        'def argv(code,remaining):\n'
                        ' assert factory(code,remaining)[:5]==["boat","--no-update","--json","exec","--timeout"]\n'
                        ' return [sys.executable,"-S","-c",program]\n'
                        'work.python_argv=argv\n'
                        'start=work.capture.SubprocessExecutor.start\n'
                        'def exiting(ex,code,remaining):\n'
                        ' job=start(ex,code,remaining)\n'
                        f' pathlib.Path({str(ownerlog)!r}).write_text(str(job.process.pid))\n'
                        ' deadline=time.monotonic()+1\n'
                        f' log=pathlib.Path({str(log)!r})\n'
                        ' while not log.exists() or len(log.read_text().splitlines())<3:\n'
                        '  assert time.monotonic()<deadline;time.sleep(.005)\n'
                        ' os._exit(0)\n'
                        'work.capture.SubprocessExecutor.start=exiting\n'
                        f'adapter.readfile("empty",{str(dest)!r},deadline=time.monotonic()+3)\n')
                p=subprocess.Popen([sys.executable,'-S','-c',caller]);assert p.wait(timeout=2)==0
                owner=int(ownerlog.read_text());ownerid=identity(owner)
                def owner_done():
                    try:
                        pid,status=os.waitpid(owner,os.WNOHANG)
                        if pid:assert os.waitstatus_to_exitcode(status)==1;return True
                    except ChildProcessError:return not pathlib.Path('/proc',str(owner)).exists()
                    return False
                wait_for(owner_done)
                assert not pathlib.Path('/proc',str(owner)).exists()
            else:
                if mode=='cancel':C._ProcessJob.poll=interrupted
                try:
                    receipt=adapter.readfile('empty',dest,deadline=began+(.3 if mode=='deadline' else 2))
                except (C.ReadbackError,KeyboardInterrupt) as e:error=type(e).__name__+': '+str(e)
                if mode=='success':assert error is None and receipt['bytes']==0 and dest.read_bytes()==b''
                elif mode=='cancel':assert error and error.startswith('KeyboardInterrupt:'),error
                else:assert error and error.startswith('ReadbackError:'),error
                if mode=='deadline':assert 'deadline' in error and .3<=time.monotonic()-began<.7
                for job in owners:
                    assert job.closed and job.process.poll() is not None
                    job.cancel() # idempotence
                    assert not pathlib.Path('/proc',str(job.process.pid)).exists()
            rr=records(log);assert len(rr)>=2,rr
            # Require actual transport/grandchild identity disappearance before
            # fixture reaping, rejecting zombies as well as live survivors.
            assert all(not pathlib.Path('/proc',str(x['pid'])).exists() for x in rr),rr
            assert unrelated.poll() is None and identity(unrelated.pid)==unrelated_id
            if mode!='success':assert dest.read_bytes()==b'unchanged'
            assert not list(t.glob('.*.readback-*'))
            observation=dict(mode=mode,elapsed=time.monotonic()-began,requests=len(calls),
                             error=error,records=rr,allTransportsAbsent=True,unrelatedSurvived=True,
                             owners=[job.process.pid for job in owners])
            observations.append(observation)
        finally:
            work.python_argv=original;adapter.R=oldroot;C._ProcessJob.poll=poll;C.SubprocessExecutor.start=original_start
            unrelated.kill();unrelated.wait();cleanup()

if __name__=='__main__':
    modes=sys.argv[1:] or ['detached','doublefork','early','deadline','success','cancel','callerexit']
    for mode in modes:run(mode)
    path=O/('ownership-'+('-'.join(modes) if len(modes)==1 else 'all')+'.json')
    path.write_text(json.dumps(dict(helperSHA256=hashlib.sha256((R/'tools/boat-capture-readback.py').read_bytes()).hexdigest(),observations=observations),indent=2))
    print('PASS independent ownership '+','.join(modes))
