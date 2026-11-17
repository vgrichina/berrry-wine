#!/usr/bin/env python3
"""Detached AoWII browser custody. No guest requests; all exits use real waits.

launch OUT SECONDS DRIVER [ARGS...] returns after watchdog readiness. A detached
keeper owns the supervisor, which directly owns Chrome, controller and watchdog.
Chrome is connected to, never launched by the disposable controller. The caller
may disappear. cancel is an OUT/cancel file. All pipes drain during startup,
runtime and cleanup. The independent watchdog survives supervisor TERM/death.
Capture/identity are the same primitives used by the HL2 d525/b211 lifecycle.
"""
import ctypes, importlib.util, json, os, pathlib, select, signal, subprocess, sys, time
ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('aow_capture',ROOT/'tools/boids-current-supervise.py')
BASE=importlib.util.module_from_spec(spec);spec.loader.exec_module(BASE)
write=BASE.write

def detached():
    # Transient tool spawn threads must not own this service's lifetime.
    assert ctypes.CDLL(None).prctl(1,0,0,0,0)==0

def identity(pid):
    start,state=BASE.identity(pid)
    return dict(pid=pid,start=start,sid=os.getsid(pid))

def rows(out):
    """Unique sessions are created only by our direct children, pinned by start."""
    if not (out/'sessions.json').exists():return []
    result=[]
    for root in json.loads((out/'sessions.json').read_text()):
        try:
            if BASE.identity(root['pid'])[0]!=root['start']:continue
        except FileNotFoundError:pass
        for p in pathlib.Path('/proc').iterdir():
            if not p.name.isdigit():continue
            try:
                v=identity(int(p.name))
                if v['sid']==root['sid'] and int(v['start'])>=int(root['start']):result.append(v)
            except (FileNotFoundError,ProcessLookupError):pass
    return result

def send(row,sig):
    fd=None
    try:
        fd=os.pidfd_open(row['pid'])
        if identity(row['pid'])==row:signal.pidfd_send_signal(fd,sig);return True
    except (FileNotFoundError,ProcessLookupError):pass
    finally:
        if fd is not None:os.close(fd)
    return False

def child_rows():
    found=[]
    for task in pathlib.Path('/proc/self/task').iterdir():
        for pid in (task/'children').read_text().split():
            try:found.append(identity(int(pid)))
            except (FileNotFoundError,ProcessLookupError):pass
    return found

def await_file(p,seconds=10):
    end=time.monotonic()+seconds
    while not p.exists():
        if time.monotonic()>end:raise TimeoutError(str(p))
        time.sleep(.02)
    return json.loads(p.read_text())

def watch(out,deadline,parent):
    fd=os.pidfd_open(parent);poll=select.poll();poll.register(fd,select.POLLIN)
    write(out/'watchdog-ready.json',dict(**identity(os.getpid()),deadline=deadline,independentSession=True,owner=identity(parent),at=time.time()))
    reason=None
    while True:
        if (out/'watchdog-cancel').exists():break
        if poll.poll(0):reason='supervisor process lost';break
        if time.time()>=deadline:reason='independent deadline';break
        st=os.statvfs('/home')
        if st.f_bavail*st.f_frsize<1500000000:reason='disk floor';break
        time.sleep(.05)
    actions=[]
    if reason:
        if not poll.poll(0):send(identity(parent),signal.SIGTERM)
        # Allow owner to perform actual waits and drain. Emergency escalation
        # still uses exact session/start+pidfd identity; it never fabricates waits.
        end=time.monotonic()+5
        while time.monotonic()<end and not (out/'watchdog-cancel').exists():time.sleep(.02)
        if not (out/'watchdog-cancel').exists():
            for row in rows(out):actions.append(dict(**row,sent=send(row,signal.SIGKILL)))
    write(out/'watchdog-result.json',dict(reason=reason,fired=bool(reason),actions=actions,at=time.time()))
    os.close(fd)

def service(out,seconds,command):
    assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0
    signals=[]
    for s in (signal.SIGTERM,signal.SIGINT,signal.SIGHUP):signal.signal(s,lambda n,f:signals.append(n))
    captures={};children={};sessions=[];waits=[];adopted=[];reason=None;error=None
    deadline=time.time()+seconds
    def spawn(name,cmd,env=None):
        p=subprocess.Popen(cmd,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
            start_new_session=True,close_fds=True,env=env)
        children[name]=p;captures[name]=BASE.Capture(p,out,name+'-')
        row=identity(p.pid);write(out/(name+'-process.json'),row)
        if name!='watchdog':sessions.append(row);write(out/'sessions.json',sessions)
        return p
    def pump():
        for c in captures.values():c.pump()
        time.sleep(.01)
    def receipt(name):
        p=children[name];rc=p.wait(timeout=.2);c=captures[name]
        v=dict(name=name,pid=p.pid,returncode=rc,actualWait=True,stdoutEOF=c.eof['stdout'],stderrEOF=c.eof['stderr'],pipeBytes=c.bytes,eofAt=c.eof_at,errors=c.errors,at=time.time())
        waits.append(v);write(out/(name+'-wait.json'),v)
    write(out/'supervisor-ready.json',dict(**identity(os.getpid()),deadline=deadline,command=command))
    try:
        w=spawn('watchdog',[sys.executable,'-B',__file__,'_watch',str(out),str(deadline),str(os.getpid())])
        await_file(out/'watchdog-ready.json')
        if signals:raise RuntimeError('cancelled before Chrome')
        profile=out/'profile'
        chrome=spawn('chrome',['/opt/google/chrome/chrome','--headless=new','--no-sandbox','--disable-breakpad','--disable-crash-reporter','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+str(profile),'--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','about:blank'])
        end=min(time.monotonic()+45,time.monotonic()+max(0,deadline-time.time()))
        while True:
            pump()
            try:parts=(profile/'DevToolsActivePort').read_text().splitlines()
            except FileNotFoundError:parts=[]
            if len(parts)==2 and parts[0].isdigit() and parts[1].startswith('/devtools/browser/'):
                port,route=parts;break
            if chrome.poll() is not None or signals or time.monotonic()>end:raise RuntimeError('Chrome endpoint startup failed')
        endpoint='ws://127.0.0.1:'+port+route
        write(out/'browser.json',dict(**identity(chrome.pid),endpoint=endpoint,profile=str(profile)))
        env=dict(os.environ,AOW_BROWSER_ENDPOINT=endpoint,AOW_CUSTODY_OUT=str(out))
        driver=spawn('driver',command,env)
        write(out/'runtime-ready.json',dict(at=time.time(),deadline=deadline,watchdogPid=w.pid,chromePid=chrome.pid,driverPid=driver.pid))
        while True:
            pump()
            if signals:reason='parent TERM' if signal.SIGTERM in signals else 'supervisor signal';break
            if (out/'cancel').exists():reason='explicit cancel';break
            if time.time()>=deadline:reason='deadline';break
            if w.poll() is not None:reason='watchdog ended';break
            if driver.poll() is not None:
                reason='controller completion' if driver.returncode==0 else 'controller failure';break
            if chrome.poll() is not None:reason='Chrome ended before controller';break
    except BaseException as e:error=repr(e);reason=reason or 'supervisor error'
    finally:
        # Driver may be finalizing its release on TERM; do not kill its pipes.
        if 'driver' in children and children['driver'].poll() is None:send(identity(children['driver'].pid),signal.SIGTERM)
        end=time.monotonic()+3
        while 'driver' in children and children['driver'].poll() is None and time.monotonic()<end:pump()
        # Browser.close ACK is never a wait. A normal controller closes Chrome;
        # for failure/cancel we explicitly terminate our Chrome session instead.
        end=time.monotonic()+1
        while 'chrome' in children and children['chrome'].poll() is None and reason=='controller completion' and time.monotonic()<end:pump()
        end=time.monotonic()+3
        while True:
            live=rows(out)
            direct={p.pid for p in children.values()}
            live.extend(row for row in child_rows() if row['pid'] not in direct and row not in live)
            if not live:break
            for row in live:send(row,signal.SIGTERM if time.monotonic()<end else signal.SIGKILL)
            pump()
            # Poll direct children so zombie leaders can be reaped.
            for name,p in children.items():
                if name!='watchdog':p.poll()
            # Reap only adopted descendants, never a Popen direct child.
            direct={p.pid for p in children.values()}
            for row in live:
                if row['pid'] in direct:continue
                try:
                    pid,status=os.waitpid(row['pid'],os.WNOHANG)
                    if pid:adopted.append(dict(pid=pid,status=status,returncode=os.waitstatus_to_exitcode(status),actualWait=True))
                except ChildProcessError:pass
            if time.monotonic()>end+3:error=error or 'scope drain deadline';break
        end=time.monotonic()+2
        while not all(all(c.eof.values()) for n,c in captures.items() if n!='watchdog') and time.monotonic()<end:pump()
        for name in children:
            if name!='watchdog':
                try:receipt(name)
                except subprocess.TimeoutExpired:error=error or name+' missing actual wait'
        # All native waits/EOF and empty scope precede watchdog release.
        native_ok=not rows(out) and all(v['actualWait'] and v['stdoutEOF'] and v['stderrEOF'] and not v['errors'] for v in waits)
        if native_ok:(out/'watchdog-cancel').touch()
        if 'watchdog' in children:
            end=time.monotonic()+7
            while (children['watchdog'].poll() is None or not all(captures['watchdog'].eof.values())) and time.monotonic()<end:pump()
            try:receipt('watchdog')
            except subprocess.TimeoutExpired:error=error or 'watchdog missing wait'
        # Reap every remaining adopted child. ECHILD is scope closure only,
        # never substituted for any direct child's recorded wait.
        while True:
            try:
                pid,status=os.waitpid(-1,os.WNOHANG)
                if not pid:break
                adopted.append(dict(pid=pid,status=status,returncode=os.waitstatus_to_exitcode(status),actualWait=True))
            except ChildProcessError:break
        for c in captures.values():c.close()
        remaining_children=child_rows()
        clean=native_ok and not error and not remaining_children and all(v['stdoutEOF'] and v['stderrEOF'] and not v['errors'] for v in waits)
        normal_children=all(any(v['name']==name and v['returncode']==0 for v in waits) for name in ('chrome','driver'))
        if reason=='controller completion' and not normal_children:reason='native child failure'
        rc=0 if clean and normal_children and reason=='controller completion' else 143 if signals else 124 if reason=='deadline' else 1
        write(out/'supervisor-wait.json',dict(reason=reason,error=error,signals=signals,waits=waits,adoptedWaits=adopted,remainingScope=rows(out),remainingChildren=remaining_children,clean=clean,exitCode=rc,at=time.time()))
    return rc

def keeper(out,seconds,command):
    assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0
    pending=[]
    for sig in (signal.SIGTERM,signal.SIGINT,signal.SIGHUP):signal.signal(sig,lambda n,f:pending.append(n))
    p=subprocess.Popen([sys.executable,'-B',__file__,'_service',str(out),str(seconds),*command],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,close_fds=True)
    c=BASE.Capture(p,out,'supervisor-')
    write(out/'keeper-ready.json',dict(**identity(os.getpid()),supervisor=identity(p.pid),detachedFromCaller=True))
    while p.poll() is None or not all(c.eof.values()):
        if pending:
            for s in pending: p.send_signal(s)
            pending.clear()
        c.pump();time.sleep(.01)
    rc=p.wait();c.close()
    write(out/'parent-wait.json',dict(pid=p.pid,returncode=rc,actualWait=True,stdoutEOF=c.eof['stdout'],stderrEOF=c.eof['stderr'],pipeBytes=c.bytes,errors=c.errors,at=time.time()))
    return rc

def main():
    action,out,*args=sys.argv[1:];out=pathlib.Path(out).resolve()
    if action=='launch':
        out.mkdir(parents=True,exist_ok=False)
        with (out/'keeper.log').open('xb') as f:
            p=subprocess.Popen([sys.executable,'-B',__file__,'_keeper',str(out),*args],stdin=subprocess.DEVNULL,stdout=f,stderr=f,start_new_session=True,close_fds=True,preexec_fn=detached)
        ready=await_file(out/'watchdog-ready.json');print(json.dumps(dict(keeperPid=p.pid,watchdog=ready)))
    elif action=='_keeper':return keeper(out,float(args[0]),args[1:])
    elif action=='_service':return service(out,float(args[0]),args[1:])
    elif action=='_watch':watch(out,float(args[0]),int(args[1]))
    else:raise ValueError(action)
    return 0
if __name__=='__main__':sys.exit(main())
