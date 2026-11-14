"""Detached owner of native+watchdog waits. No pipe to the invoking tool."""
import pathlib, subprocess, sys, os, time, json, signal, threading, fcntl
BASE=pathlib.Path(__file__).resolve().parent
def save(out,name,value):
    p=out/name
    assert not p.exists(),str(p)
    tmp=p.with_name(p.name+'.pending')
    with tmp.open('x') as f:
        json.dump(value,f,indent=2); f.write('\n'); f.flush(); os.fsync(f.fileno())
    os.rename(tmp,p)
def token(pid):
    s=pathlib.Path(f'/proc/{pid}/stat').read_text()
    return s[s.rindex(')')+2:].split()[19]
def kill_owned(info,sig):
    try:
        if token(info['pid'])==info['startToken']: os.killpg(info['pid'],sig)
    except (FileNotFoundError,ProcessLookupError): pass
def watchdog(out,deadline):
    save(out,'watchdog-armed.json',dict(pid=os.getpid(),deadline=deadline,at=time.time(),independent=True))
    while time.time()<deadline:
        if (out/'native-wait.json').exists():
            save(out,'watchdog-exit.json',dict(reason='actual-native-wait',at=time.time())); return
        st=os.statvfs('/home')
        if st.f_bavail*st.f_frsize<1500000000: break
        time.sleep(.05)
    signals=[]
    p=out/'native-pid.json'
    if p.exists():
        info=json.loads(p.read_text());kill_owned(info,signal.SIGTERM);signals.append('TERM')
        time.sleep(3);kill_owned(info,signal.SIGKILL);signals.append('KILL-if-still-owned')
    save(out,'watchdog-exit.json',dict(reason='deadline-or-disk',at=time.time(),signals=signals))
def run(out,recipe):
    stop=[]
    for sig in (signal.SIGTERM,signal.SIGINT,signal.SIGHUP):
        signal.signal(sig,lambda s,f:stop.append(s))
    lock=None
    if recipe.get('heavy'):
        lock=open('/tmp/wine-heavy-runtime.lock','a')
        queueEnd=time.monotonic()+2500
        prior=[out.parents[0]/n for n in recipe.get('fairAfter',[])]
        save(out,'heavy-queue.json',dict(at=time.time(),fairAfter=[str(p) for p in prior],boundedQueueSeconds=2500))
        while not all((p/'supervisor-complete.json').exists() or (p/'preflight-blocker.json').exists() for p in prior):
            assert time.monotonic()<queueEnd and not stop,'bounded fair queue ended without launch'
            time.sleep(.25)
        while True:
            assert time.monotonic()<queueEnd and not stop,'bounded lock queue ended without launch'
            try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);break
            except BlockingIOError:time.sleep(.25)
        save(out,'heavy-lock.json',dict(pid=os.getpid(),at=time.time()))
    if recipe.get('preflight'):
        pre=subprocess.run(recipe['preflight'],cwd=recipe['cwd'],capture_output=True)
        save(out,'preflight-wait.json',dict(exit=pre.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=pre.stdout.decode(),stderr=pre.stderr.decode(),at=time.time()))
        if pre.returncode:
            save(out,'preflight-blocker.json',dict(exit=pre.returncode,originalLaunched=False,at=time.time()))
            return
    deadline=time.time()+recipe['seconds']
    watchdog_deadline=deadline+recipe.get('watchdogGrace',0)
    w=subprocess.Popen([sys.executable,'-u','-B',__file__,'watchdog',str(out),str(watchdog_deadline)],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    while not (out/'watchdog-armed.json').exists():
        assert w.poll() is None,'watchdog died before arm';time.sleep(.01)
    assert not stop,'supervisor cancelled before native launch'
    save(out,'launch.json',dict(args=recipe['args'],deadline=deadline,at=time.time(),supervisor=os.getpid(),clock=recipe.get('clock')))
    env=os.environ.copy();env.update(recipe.get('env',{}))
    p=subprocess.Popen(recipe['args'],cwd=recipe['cwd'],env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    info=dict(pid=p.pid,startToken=token(p.pid),at=time.time());save(out,'native-pid.json',info)
    eof={};errors=[]
    def drain(pipe,name):
        try:
            with (out/f'native.{name}.log').open('xb') as f:
                while chunk:=pipe.read1(65536): f.write(chunk);f.flush()
            eof[name]=True
        except BaseException as e:errors.append(repr(e))
    threads=[threading.Thread(target=drain,args=(p.stdout,'stdout')),threading.Thread(target=drain,args=(p.stderr,'stderr'))]
    for t in threads:t.start()
    sent=False
    while p.poll() is None:
        if (stop or (out/'cancel-request.json').exists()) and not sent:
            kill_owned(info,signal.SIGTERM);sent=True
            save(out,'cancellation.json',dict(at=time.time(),signals=stop,requestFile=(out/'cancel-request.json').exists(),nativeQuit=False))
        time.sleep(.02)
    rc=p.wait()
    for t in threads:t.join()
    save(out,'native-wait.json',dict(pid=p.pid,exit=rc,actualWait=True,stdoutEOF=eof.get('stdout',False),stderrEOF=eof.get('stderr',False),drainErrors=errors,at=time.time()))
    a,b=w.communicate()
    save(out,'watchdog-wait.json',dict(pid=w.pid,exit=w.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode(),at=time.time()))
    if lock:fcntl.flock(lock,fcntl.LOCK_UN);lock.close()
    save(out,'supervisor-complete.json',dict(pid=os.getpid(),nativeWait=rc,watchdogWait=w.returncode,heavyReleased=bool(lock),actualChildWaits=True,bothEOF=eof=={'stdout':True,'stderr':True},at=time.time()))
if __name__=='__main__':
    mode=sys.argv[1];out=pathlib.Path(sys.argv[2]).resolve()
    if mode=='watchdog':watchdog(out,float(sys.argv[3]))
    elif mode=='run':run(out,json.loads((out/'recipe.json').read_text()))
    elif mode=='outerwait':
        p=subprocess.Popen([sys.executable,'-u','-B',__file__,'run',str(out)],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,close_fds=True)
        save(out,'detached-parent.json',dict(pid=p.pid,startToken=token(p.pid),outerPid=os.getpid(),at=time.time()))
        a,b=p.communicate()
        (out/'supervisor.stdout.log').write_bytes(a);(out/'supervisor.stderr.log').write_bytes(b)
        save(out,'outer-child-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,at=time.time()))
        raise SystemExit(p.returncode)
    elif mode=='detach':
        with (out/'supervisor.stdout.log').open('xb') as a,(out/'supervisor.stderr.log').open('xb') as b:
            p=subprocess.Popen([sys.executable,'-u','-B',__file__,'run',str(out)],stdin=subprocess.DEVNULL,stdout=a,stderr=b,start_new_session=True,close_fds=True)
        save(out,'detached-parent.json',dict(pid=p.pid,startToken=token(p.pid),launcherPid=os.getpid(),at=time.time(),stdio='devnull/files; no outer tool pipe'))
        print(json.dumps(dict(detachedSupervisor=p.pid)),flush=True)
        if len(sys.argv)>3:time.sleep(30) # control-only: invoking launcher killed by test
