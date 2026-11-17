#!/usr/bin/env python3
"""Dedicated waiting launch owner, pinned to one actual task worker process.

The outer remains the normal ParentProcessSupervisor. No unsafe-ancestor mode.
The independent watchdog is armed before launching that outer.
"""
import ctypes, importlib.util, json, os, pathlib, select, signal, subprocess, sys, time
ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('lifecycle',ROOT/'tools/boids-current-supervise.py')
B=importlib.util.module_from_spec(spec);spec.loader.exec_module(B)

def pin(pid,expected):
    before,state=B.identity(pid)
    assert before==expected and state!='Z','owner identity unavailable'
    fd=os.pidfd_open(pid)
    assert B.identity(pid)[0]==expected
    poll=select.poll();poll.register(fd,select.POLLIN)
    assert not poll.poll(0)
    return fd,poll

def anchor(pid,expected):
    # Require the named worker to be an actual ancestor at startup. Pin before
    # clearing the inherited spawning-thread policy, then check for the race.
    ancestor=os.getppid();chain=[]
    while ancestor>1:
        chain.append(ancestor)
        if ancestor==pid:break
        s=pathlib.Path(f'/proc/{ancestor}/stat').read_text().rsplit(')',1)[1].split();ancestor=int(s[1])
    assert pid in chain,'worker must be an actual ancestor'
    fd,poll=pin(pid,expected)
    libc=ctypes.CDLL(None,use_errno=True);inherited=ctypes.c_int()
    assert libc.prctl(2,ctypes.byref(inherited),0,0,0)==0
    assert inherited.value in (0,signal.SIGTERM),'unsupported inherited PDEATHSIG'
    assert libc.prctl(1,0,0,0,0)==0
    assert not poll.poll(0),'worker died during safe handover'
    return fd,poll,dict(pid=pid,startToken=expected,pidfd=fd,ancestorChain=chain,inheritedPdeathsig=inherited.value,clearedPdeathsig=0)

def watchdog(out,pid,token,seconds):
    out=pathlib.Path(out);fd,poll=pin(pid,token);end=time.monotonic()+seconds
    B.write(out/'owner-watchdog-armed.json',dict(pid=os.getpid(),ownerPid=pid,ownerStartToken=token,seconds=seconds,independent=True,at=time.time()))
    fired=False
    while not poll.poll(20):
        if (out/'owner-watchdog-cancel').exists():break
        if time.monotonic()>=end:
            signal.pidfd_send_signal(fd,signal.SIGTERM);fired=True;break
    B.write(out/'owner-watchdog-result.json',dict(fired=fired,ownerDead=bool(poll.poll(0)),at=time.time()))
    os.close(fd)

def owner(out,worker,token,seconds,command):
    out=pathlib.Path(out);out.mkdir(parents=True,exist_ok=True)
    fd,poll,identity=anchor(worker,token)
    requests=[]
    for sig in (signal.SIGTERM,signal.SIGINT):signal.signal(sig,lambda s,f:requests.append(s))
    B.write(out/'worker-owner-armed.json',dict(**identity,ownerPid=os.getpid(),ownerStartToken=B.identity(os.getpid())[0],at=time.time()))
    w=subprocess.Popen([sys.executable,'-B',__file__,'watchdog',str(out),str(os.getpid()),B.identity(os.getpid())[0],str(seconds)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    c=None;capture=None;cfd=None
    try:
        due=time.monotonic()+5
        while not (out/'owner-watchdog-armed.json').exists():
            assert w.poll() is None and time.monotonic()<due;time.sleep(.005)
        assert not poll.poll(0)
        c=subprocess.Popen(command,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
        cfd,cpoll=pin(c.pid,B.identity(c.pid)[0]);capture=B.Capture(c,out,'outer-')
        B.write(out/'outer-child.json',dict(pid=c.pid,startToken=B.identity(c.pid)[0],pidfd=cfd,args=command,at=time.time()))
        cancelled=False
        while c.poll() is None:
            capture.pump()
            if (poll.poll(0) or requests) and not cancelled:
                signal.pidfd_send_signal(cfd,signal.SIGTERM);cancelled=True
                B.write(out/'owner-cancellation.json',dict(workerDied=bool(poll.poll(0)),signals=requests,at=time.time()))
            time.sleep(.01)
        rc=c.wait();end=time.monotonic()+15
        while not all(capture.eof.values()) and time.monotonic()<end:capture.pump();time.sleep(.005)
        B.write(out/'owner-outer-wait.json',dict(pid=c.pid,returncode=rc,actualWait=True,stdoutEOF=capture.eof['stdout'],stderrEOF=capture.eof['stderr'],workerAlive=not bool(poll.poll(0)),at=time.time()))
        assert all(capture.eof.values()),'outer EOF missing'
        return rc
    finally:
        if c is not None and c.poll() is None:
            signal.pidfd_send_signal(cfd,signal.SIGTERM)
            c.wait(timeout=20)
        (out/'owner-watchdog-cancel').touch()
        a,b=w.communicate(timeout=10)
        B.write(out/'owner-watchdog-wait.json',dict(pid=w.pid,returncode=w.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
        if capture:capture.close()
        if cfd is not None:os.close(cfd)
        os.close(fd)

if __name__=='__main__':
    if sys.argv[1]=='watchdog':watchdog(sys.argv[2],int(sys.argv[3]),sys.argv[4],float(sys.argv[5]))
    else:sys.exit(owner(sys.argv[2],int(sys.argv[3]),sys.argv[4],float(sys.argv[5]),sys.argv[6:]))
