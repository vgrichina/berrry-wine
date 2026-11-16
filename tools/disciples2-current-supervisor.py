"""Detached owner of native+watchdog waits. No pipe to the invoking tool."""
import pathlib, subprocess, sys, os, time, json, signal, threading, fcntl, hashlib, base64, re
BASE=pathlib.Path(__file__).resolve().parent
def seal(label,body):
    fd=os.memfd_create(label,os.MFD_ALLOW_SEALING)
    with os.fdopen(os.dup(fd),'wb') as f:f.write(body)
    os.lseek(fd,0,0);fcntl.fcntl(fd,fcntl.F_ADD_SEALS,15)
    assert fcntl.fcntl(fd,fcntl.F_GET_SEALS)==15
    return fd
def frozen_inputs(out,recipe):
    root=pathlib.Path(recipe['cwd']).resolve()
    names=subprocess.check_output(['git','ls-files'],cwd=root).decode().splitlines()
    selected=[p for p in names if (p.startswith('lib/') and p.endswith(('.js','.json'))) or
              p in ('host.js','test/run.js','src/api_table.json','src/win16-ordinals.generated.json','fonts/substitutions.json')]
    selected+=['tools/disciples2-current-native-source-view.cjs','test/test-disciples2-current-quest.cjs']
    for arg in recipe['args']:
        path=pathlib.Path(arg)
        if path.suffix not in ('.js','.cjs'):continue
        path=path if path.is_absolute() else root/path
        if path.is_file() and path.is_relative_to(root):selected.append(str(path.relative_to(root)))
    selected+=['test/candidate-corpus/manifest.json','test/binaries/candidates/disciples2-demo/.wine-assembly-browser.json']
    # Literal dependencies of the actual runtime closure, including CLI helpers.
    for p in selected:
        body=(root/p).read_bytes()
        for relative in re.findall(rb'require\([\'\"](\.[^\'\"]+)[\'\"]\)',body):
            candidate=(pathlib.Path(p).parent/relative.decode())
            for suffix in ('','.js','.cjs','.json','/index.js'):
                found=os.path.normpath(str(candidate)+suffix)
                if (root/found).is_file() and found not in selected:
                    selected.append(found);break
    codec=root/'node_modules/pngjs'
    selected += [str(p.relative_to(root)) for p in codec.rglob('*') if p.is_file() and p.suffix in ('.js','.json')]
    rows=[]
    for p in sorted(set(selected)):
        body=(root/p).read_bytes()
        rows.append(dict(path=p,sha256=hashlib.sha256(body).hexdigest(),body=base64.b64encode(body).decode()))
    holder=json.loads(pathlib.Path(recipe.get('moduleHolder') or os.environ['DISCIPLES2_MODULE_HOLDER']).read_text())
    assert token(holder['pid'])==holder['startToken'] and holder['sealed']==15
    body=pathlib.Path(holder['fdPath']).read_bytes()
    assert hashlib.sha256(body).hexdigest()==holder['sha256']
    module=seal('disciples2-current-module',body)
    source=seal('disciples2-current-sources',json.dumps(dict(files=rows)).encode())
    head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip()
    patches=[]
    for p in sorted(set(selected)):
        tracked=p in names
        if p.startswith('node_modules/'):continue
        diff=subprocess.run(['git','diff','--binary',head,'--',p] if tracked else
                            ['git','diff','--no-index','--binary','--','/dev/null',p],cwd=root,capture_output=True)
        assert diff.returncode in ((0,) if tracked else (1,)) and not diff.stderr
        patches.append(diff.stdout)
    (out/'runtime-source.patch').write_bytes(b''.join(patches))
    save(out,'runtime-inputs.json',dict(gitSHA=head,moduleSHA256=holder['sha256'],moduleSeals=15,sourceSeals=15,
         sources=[{k:v for k,v in row.items() if k!='body'} for row in rows],sourceArchive='Git plus binary patch; no persisted source/module bundle'))
    env=os.environ.copy();assert not env.get('NODE_OPTIONS')
    env.update(NODE_OPTIONS='--require='+str(BASE/'disciples2-current-native-source-view.cjs'),
               DISCIPLES2_SOURCE_FD='/proc/self/fd/'+str(source),DISCIPLES2_MODULE_FD='/proc/self/fd/'+str(module),
               DISCIPLES2_MODULE_SHA256=holder['sha256'])
    return env,(source,module)
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
        lock=open('/tmp/wine-heavy-runtime.lock','a');fcntl.flock(lock,fcntl.LOCK_EX)
        save(out,'heavy-lock.json',dict(pid=os.getpid(),at=time.time()))
    if recipe.get('preflight'):
        pre=subprocess.run(recipe['preflight'],cwd=recipe['cwd'],capture_output=True)
        save(out,'preflight-wait.json',dict(exit=pre.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=pre.stdout.decode(),stderr=pre.stderr.decode(),at=time.time()))
        if pre.returncode:
            save(out,'preflight-blocker.json',dict(exit=pre.returncode,originalLaunched=False,at=time.time()))
            return
    # Seal inputs before arming any child. A source refusal must not strand an
    # independent watchdog with neither a native PID nor an actual wait.
    frozen=recipe.get('moduleHolder') or (os.environ.get('DISCIPLES2_MODULE_HOLDER') and recipe['args'][0]=='node')
    env,fds=frozen_inputs(out,recipe) if frozen else (None,())
    reserve=recipe.get('reserveSeconds',180)
    assert reserve==180 and recipe['seconds']>reserve
    if recipe.get('completionSession'):
        assert recipe['seconds']==1200 and recipe.get('watchdogGrace')==20 and reserve==180
        assert recipe.get('inputPolicy')==dict(confirmationMs=500,physicalUpMs=1750,observationMs=3000,gameFreshnessSeconds=5,menuFreshnessSeconds=30)
        assert '--max-seconds=1200' in recipe['args']
    deadline=time.time()+recipe['seconds']
    watchdog_deadline=deadline+recipe.get('watchdogGrace',0)
    w=subprocess.Popen([sys.executable,'-u','-B',__file__,'watchdog',str(out),str(watchdog_deadline)],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    while not (out/'watchdog-armed.json').exists():
        assert w.poll() is None,'watchdog died before arm';time.sleep(.01)
    assert not stop,'supervisor cancelled before native launch'
    save(out,'launch.json',dict(args=recipe['args'],deadline=deadline,gameplayCutoff=deadline-reserve,reserveSeconds=reserve,at=time.time(),supervisor=os.getpid(),clock=recipe.get('clock'),nativeScene=bool(recipe.get('nativeScene')),inputPolicy=recipe.get('inputPolicy')))
    p=subprocess.Popen(recipe['args'],cwd=recipe['cwd'],env=env,pass_fds=fds,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    for fd in fds:os.close(fd)
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
    save(out,'native-wait.json',dict(pid=p.pid,startToken=info['startToken'],exit=rc,actualWait=True,stdoutEOF=eof.get('stdout',False),stderrEOF=eof.get('stderr',False),drainErrors=errors,at=time.time()))
    a,b=w.communicate()
    save(out,'watchdog-wait.json',dict(pid=w.pid,exit=w.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode(),at=time.time()))
    if lock:fcntl.flock(lock,fcntl.LOCK_UN);lock.close()
    save(out,'supervisor-complete.json',dict(pid=os.getpid(),nativeWait=rc,watchdogWait=w.returncode,heavyReleased=bool(lock),actualChildWaits=True,bothEOF=eof=={'stdout':True,'stderr':True},at=time.time()))
if __name__=='__main__':
    mode=sys.argv[1];out=pathlib.Path(sys.argv[2]).resolve()
    if mode=='hold-module':
        body=(BASE.parent/'build/wine-assembly.wasm').read_bytes()
        fd=seal('disciples2-current-qualified-module',body)
        save(out,'holder.json',dict(pid=os.getpid(),startToken=token(os.getpid()),sealed=15,
             sha256=hashlib.sha256(body).hexdigest(),fdPath='/proc/'+str(os.getpid())+'/fd/'+str(fd),at=time.time()))
        while not (out/'stop.json').exists():time.sleep(.05)
        os.close(fd);save(out,'holder-closed.json',dict(closed=True,at=time.time()))
    elif mode=='watchdog':watchdog(out,float(sys.argv[3]))
    elif mode=='run':run(out,json.loads((out/'recipe.json').read_text()))
    elif mode=='outerwait':
        p=subprocess.Popen([sys.executable,'-u','-B',__file__,'run',str(out)],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,close_fds=True)
        save(out,'detached-parent.json',dict(pid=p.pid,startToken=token(p.pid),outerPid=os.getpid(),at=time.time()))
        a,b=p.communicate()
        (out/'supervisor.stdout.log').write_bytes(a);(out/'supervisor.stderr.log').write_bytes(b)
        save(out,'outer-child-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,at=time.time()))
    elif mode=='durablewait':
        # This actual wait owner has no invoking-tool pipes. TERM/HUP are
        # recorded while it finishes reaping the detached outerwait child.
        received=[]
        for sig in (signal.SIGTERM,signal.SIGINT,signal.SIGHUP):
            signal.signal(sig,lambda s,f:received.append(s))
        p=subprocess.Popen([sys.executable,'-u','-B',__file__,'outerwait',str(out)],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,close_fds=True)
        save(out,'outer-pid.json',dict(pid=p.pid,startToken=token(p.pid),waitOwner=os.getpid(),at=time.time()))
        a,b=p.communicate()
        (out/'outer.stdout.log').write_bytes(a);(out/'outer.stderr.log').write_bytes(b)
        save(out,'outer-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,receivedSignals=received,at=time.time()))
    elif mode=='detach':
        with (out/'supervisor.stdout.log').open('xb') as a,(out/'supervisor.stderr.log').open('xb') as b:
            p=subprocess.Popen([sys.executable,'-u','-B',__file__,'run',str(out)],stdin=subprocess.DEVNULL,stdout=a,stderr=b,start_new_session=True,close_fds=True)
        save(out,'detached-parent.json',dict(pid=p.pid,startToken=token(p.pid),launcherPid=os.getpid(),at=time.time(),stdio='devnull/files; no outer tool pipe'))
        print(json.dumps(dict(detachedSupervisor=p.pid)),flush=True)
        if len(sys.argv)>3:time.sleep(30) # control-only: invoking launcher killed by test
