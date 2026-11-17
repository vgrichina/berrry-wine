"""Detached owner of native+watchdog waits. No pipe to the invoking tool."""
import pathlib, subprocess, sys, os, time, json, signal, threading, fcntl, hashlib, re, struct
BASE=pathlib.Path(__file__).resolve().parent
def seal(label,body):
    fd=os.memfd_create(label,os.MFD_ALLOW_SEALING)
    with os.fdopen(os.dup(fd),'wb') as f:f.write(body)
    os.lseek(fd,0,0);fcntl.fcntl(fd,fcntl.F_ADD_SEALS,15)
    assert fcntl.fcntl(fd,fcntl.F_GET_SEALS)==15
    return fd
OWNED={'tools/disciples2-current-supervisor.py','tools/disciples2-current-native-source-view.cjs',
       'tools/disciples2-current-preflight.cjs','tools/disciples2-current-controller.py',
       'test/test-disciples2-current-quest.cjs',
       'lib/cli-native-pointer-coordinates.js','lib/cli-native-scene.js','lib/cli-native-user-windows.js',
       'test/run.js','test/test-cli-native-pointer-coordinates.cjs',
       'test/test-disciples2-native-paint-binding.cjs','test/test-vb5-native-dialog-identity.cjs'}
PRELOAD='tools/disciples2-current-native-source-view.cjs'
def digest(body):return hashlib.sha256(body).hexdigest()
def indexed_sources(bodies):
    rows=[];offset=0
    for name,body in sorted(bodies.items()):
        rows.append(dict(path=name,sha256=digest(body),size=len(body),offset=offset));offset+=len(body)
    index=json.dumps(dict(version=1,files=rows),separators=(',',':')).encode()
    return struct.pack('<I',len(index))+index+b''.join(bodies[n] for n in sorted(bodies)),index,rows
def validate_sources(pool,manifest):
    size=struct.unpack('<I',pool[:4])[0];index=pool[4:4+size]
    assert digest(index)==manifest['sourceIndexSHA256'],'source index differs'
    parsed=json.loads(index);assert parsed['version']==1 and parsed['files']==manifest['sources'],'source inventory differs'
    end=0;seen=set()
    for row in parsed['files']:
        name=row['path'];assert name not in seen and not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts,'source path inventory'
        seen.add(name);assert row['offset']==end and isinstance(row['size'],int) and row['size']>=0,'source inventory range'
        body=pool[4+size+end:4+size+end+row['size']];assert len(body)==row['size'] and digest(body)==row['sha256'],'source inventory hash'
        end+=row['size']
    assert end+4+size==len(pool),'source inventory closure'
    return parsed['files']
def git(root,*args):return subprocess.check_output(['git',*args],cwd=root)
def selected(name):
    return ((name.startswith(('src/','lib/','tools/','fonts/')) or
             (name.startswith('test/') and name.count('/')==1) or name.startswith('test/helpers/') or
             name in ('host.js','test/candidate-corpus/manifest.json'))
            and name.endswith(('.js','.cjs','.json','.wat','.watx','.py')))
def prepare_holder(out,recipe):
    # Only Git bytes plus enumerated owned patches. Never sample foreign WIP.
    root=pathlib.Path(recipe['cwd']).resolve();revision=recipe['sourceRevision']
    head=git(root,'rev-parse',revision+'^{commit}').decode().strip()
    assert head==revision and subprocess.run(['git','merge-base','--is-ancestor',head,'main'],cwd=root).returncode==0,'recorded main revision required'
    names=git(root,'ls-tree','-r','--name-only',head).decode().splitlines()
    names=sorted(n for n in names if selected(n)); bodies={}
    process=subprocess.Popen(['git','cat-file','--batch'],cwd=root,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
    for name in names:
        process.stdin.write((head+':'+name+'\n').encode());process.stdin.flush()
        header=process.stdout.readline().split();assert header[1]==b'blob',name
        bodies[name]=process.stdout.read(int(header[2]));assert process.stdout.read(1)==b'\n'
    process.stdin.close();assert process.wait()==0
    patches=[]
    for name in recipe.get('ownedPatchPaths',[]):
        assert name in OWNED,'unowned source patch: '+name
        body=(root/name).read_bytes();bodies[name]=body
        diff=subprocess.run(['git','diff','--binary',head,'--',name] if name in names else
                            ['git','diff','--no-index','--binary','--','/dev/null',name],cwd=root,capture_output=True)
        assert diff.returncode in (0,1) and not diff.stderr;patches.append(diff.stdout)
    (out/'runtime-source.patch').write_bytes(b''.join(patches))
    installed=['test/binaries/candidates/disciples2-demo/.wine-assembly-browser.json',
               'scratch/runs/20261112-disciples2-postbattle-native-load-cause-0836/runtime-pins.json']
    installed += [str(p.relative_to(root)) for p in (root/'node_modules/pngjs').rglob('*') if p.is_file() and p.suffix in ('.js','.json')]
    for name in installed:bodies[name]=(root/name).read_bytes()
    pool,index,rows=indexed_sources(bodies);source=seal('disciples2-git-sources',pool)
    preload=seal('disciples2-preload',bodies[PRELOAD]);raw=os.memfd_create('disciples2-compile',os.MFD_ALLOW_SEALING)
    env=os.environ.copy();assert not env.get('NODE_OPTIONS')
    env.update(DISCIPLES2_ROOT=str(root),DISCIPLES2_SOURCE_FD=f'/proc/{os.getpid()}/fd/{source}',
               DISCIPLES2_SOURCE_SHA256=digest(pool),DISCIPLES2_SOURCE_INDEX_SHA256=digest(index),DISCIPLES2_PHASE='compile',COMPILE_FD=str(raw))
    code="const c=require('./tools/watx-closure.js'),h=require('./tools/region-layout-hash.js');const r=c.compileClosure(c.watxSourceClosure(),{tailCalls:true});if(!r.success)throw Error(JSON.stringify(r));require('fs').writeFileSync(Number(process.env.COMPILE_FD),h.appendSection(Buffer.from(r.wasmBinary),h.layoutHash(r.regions.regions)));"
    prepath=f'/proc/{os.getpid()}/fd/{preload}'
    pre=subprocess.run(['node','--preserve-symlinks','--require',prepath,'-e',code],cwd=root,env=env,pass_fds=(raw,),capture_output=True,timeout=240)
    save(out,'compile-wait.json',dict(exit=pre.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=pre.stdout.decode(),stderr=pre.stderr.decode(),at=time.time()))
    assert pre.returncode==0,'Git-only compilation failed'
    os.lseek(raw,0,0);body=os.read(raw,10000000);os.close(raw);module=seal('disciples2-qualified-module',body)
    manifest=dict(version=1,gitSHA=head,patchSHA256=digest(b''.join(patches)),sourceSHA256=digest(pool),
                  moduleSHA256=digest(body),preloadSHA256=digest(bodies[PRELOAD]),sourceIndexSHA256=digest(index),
                  sources=rows,
                  installedInputs=installed,foreignWIPAdopted=False)
    encoded=json.dumps(manifest,sort_keys=True,separators=(',',':')).encode();manifestfd=seal('disciples2-manifest',encoded)
    save(out,'manifest.json',manifest)
    holder=dict(pid=os.getpid(),startToken=token(os.getpid()),sealed=15,manifestSHA256=digest(encoded),
                sourcePath=f'/proc/{os.getpid()}/fd/{source}',fdPath=f'/proc/{os.getpid()}/fd/{module}',
                preloadPath=prepath,manifestPath=f'/proc/{os.getpid()}/fd/{manifestfd}')
    save(out,'holder.json',holder)
    while not (out/'stop.json').exists():time.sleep(.05)
    for fd in (source,preload,module,manifestfd):os.close(fd)
    save(out,'holder-closed.json',dict(closed=True,at=time.time()))
def holder_bytes(holder,key):
    path=holder[key];assert re.fullmatch('/proc/'+str(holder['pid'])+'/fd/[0-9]+',path),'holder descriptor identity'
    fd=os.open(path,os.O_RDONLY)
    try:
        assert fcntl.fcntl(fd,fcntl.F_GET_SEALS)==15,'holder descriptor is not sealed'
        with os.fdopen(os.dup(fd),'rb') as f:return f.read()
    finally:os.close(fd)
def frozen_inputs(out,recipe):
    assert recipe.get('moduleHolder'),'moduleHolder activation is mandatory; shared runtime forbidden'
    assert isinstance(recipe.get('immutableManifest'),dict),'exact immutableManifest required'
    holder=json.loads(pathlib.Path(recipe['moduleHolder']).read_text())
    assert token(holder['pid'])==holder['startToken'],'stale holder'
    assert holder['sealed']==15
    encoded=holder_bytes(holder,'manifestPath');manifest=json.loads(encoded)
    assert digest(encoded)==holder['manifestSHA256']==recipe['immutableManifest']['manifestSHA256'],'manifest identity differs'
    assert all(recipe['immutableManifest'][k]==manifest[k] for k in ('gitSHA','sourceSHA256','moduleSHA256','preloadSHA256')),'recipe manifest differs'
    assert manifest['version']==1 and manifest['foreignWIPAdopted'] is False
    pool=holder_bytes(holder,'sourcePath');module=holder_bytes(holder,'fdPath');preload=holder_bytes(holder,'preloadPath')
    assert digest(pool)==manifest['sourceSHA256'] and digest(module)==manifest['moduleSHA256'] and digest(preload)==manifest['preloadSHA256'],'holder bytes differ'
    rows=validate_sources(pool,manifest)
    assert next(r for r in rows if r['path']==PRELOAD)['sha256']==digest(preload),'preload not in source inventory'
    assert token(holder['pid'])==holder['startToken'],'holder changed during validation'
    fds=tuple(seal(label,b) for label,b in (('sources',pool),('module',module),('preload',preload)))
    env=os.environ.copy();assert not env.get('NODE_OPTIONS'),'unexpected NODE_OPTIONS'
    entry=next(r['sha256'] for r in rows if r['path']=='test/run.js')
    env.update(DISCIPLES2_ROOT=str(pathlib.Path(recipe['cwd']).resolve()),DISCIPLES2_PHASE='runtime',
               DISCIPLES2_SOURCE_FD=f'/proc/{os.getpid()}/fd/{fds[0]}',DISCIPLES2_MODULE_FD=f'/proc/{os.getpid()}/fd/{fds[1]}',
               DISCIPLES2_SOURCE_SHA256=manifest['sourceSHA256'],DISCIPLES2_SOURCE_INDEX_SHA256=manifest['sourceIndexSHA256'],DISCIPLES2_MODULE_SHA256=manifest['moduleSHA256'],
               DISCIPLES2_ENTRY_SHA256=entry,DISCIPLES2_MANIFEST_SHA256=holder['manifestSHA256'],DISCIPLES2_PRELOAD=f'/proc/{os.getpid()}/fd/{fds[2]}')
    env['NODE_OPTIONS']='--preserve-symlinks --require='+env['DISCIPLES2_PRELOAD']
    save(out,'runtime-inputs.json',dict(**manifest,manifestSHA256=holder['manifestSHA256'],holder=holder,sourceSeals=15,moduleSeals=15,preloadSeals=15))
    return env,fds
def inheritance_probe(out,recipe,env):
    assert recipe.get('childInheritance')=='sealed-node-v1','explicit sealed child inheritance required'
    assert recipe['args'][0]=='node','only qualified Node child loading supported'
    check="""const fs=require('node:fs'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const identity={manifest:globalThis.__disciples2Manifest,module:hash(fs.readFileSync('build/wine-assembly.wasm')),entry:hash(fs.readFileSync('test/run.js'))};
if(identity.manifest!==process.env.DISCIPLES2_MANIFEST_SHA256||identity.module!==process.env.DISCIPLES2_MODULE_SHA256||identity.entry!==process.env.DISCIPLES2_ENTRY_SHA256)throw Error('actual source/module identity differs');
"""
    worker=check+"require('node:worker_threads').parentPort.postMessage(identity);"
    child=check+"console.log(JSON.stringify(identity));"
    code=check+"const {Worker}=require('node:worker_threads'),cp=require('node:child_process');const w=new Worker("+json.dumps(worker)+",{eval:true});w.on('message',v=>{if(JSON.stringify(v)!==JSON.stringify(identity))throw Error('Worker identity differs');const p=cp.spawnSync(process.execPath,['-e',"+json.dumps(child)+"],{env:process.env});if(p.status!==0||JSON.stringify(JSON.parse(p.stdout))!==JSON.stringify(identity))throw Error('child identity differs: '+p.stderr);console.log(JSON.stringify({main:identity,worker:v,child:JSON.parse(p.stdout),childExit:p.status}));});"
    pre=subprocess.run(['node','--require',env['DISCIPLES2_PRELOAD'],'-e',code],cwd=recipe['cwd'],env=env,capture_output=True,timeout=30)
    save(out,'inheritance-wait.json',dict(exit=pre.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=pre.stdout.decode(),stderr=pre.stderr.decode(),at=time.time()))
    assert pre.returncode==0,'sealed child inheritance failed before native execution'
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
    # Mandatory for every supervised native route, including original recipes
    # that omit completionSession. Admission precedes preflight and watchdog.
    fds=()
    try:
        env,fds=frozen_inputs(out,recipe)
        inheritance_probe(out,recipe,env)
        reserve=recipe.get('reserveSeconds',180)
        assert reserve in (180,300) and recipe['seconds']>reserve
        original='--app=disciples2_demo' in recipe['args']
        if original or recipe.get('completionSession'):
            assert recipe.get('completionSession') is True,'original completionSession required'
            assert recipe['seconds']==3600 and recipe.get('watchdogGrace')==20 and reserve==300
            assert recipe.get('inputPolicy')==dict(confirmationMs=500,physicalUpMs=1750,observationMs=3000,gameFreshnessSeconds=5,menuFreshnessSeconds=30)
            assert '--max-seconds=3600' in recipe['args']
            assert '--app=disciples2_demo' in recipe['args'] and '--threads' in recipe['args'] and '--real-ticks' in recipe['args']
        if recipe.get('preflight'):
            pre=subprocess.run(recipe['preflight'],cwd=recipe['cwd'],env=env,capture_output=True)
            save(out,'preflight-wait.json',dict(exit=pre.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=pre.stdout.decode(),stderr=pre.stderr.decode(),at=time.time()))
            assert pre.returncode==0,'original media preflight failed'
    except BaseException as error:
        for fd in fds:os.close(fd)
        save(out,'prelaunch-refusal.json',dict(error=str(error),originalLaunched=False,anyNativeOrWatchdogChild=False,at=time.time()))
        raise
    deadline=time.time()+recipe['seconds']
    watchdog_deadline=deadline+recipe.get('watchdogGrace',0)
    w=subprocess.Popen([sys.executable,'-u','-B',__file__,'watchdog',str(out),str(watchdog_deadline)],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    while not (out/'watchdog-armed.json').exists():
        assert w.poll() is None,'watchdog died before arm';time.sleep(.01)
    assert not stop,'supervisor cancelled before native launch'
    save(out,'launch.json',dict(args=recipe['args'],deadline=deadline,gameplayCutoff=deadline-reserve,reserveSeconds=reserve,completionSession=bool(recipe.get('completionSession')),immutableManifest=recipe['immutableManifest'],at=time.time(),supervisor=os.getpid(),clock=recipe.get('clock'),nativeScene=bool(recipe.get('nativeScene')),bindingContract=recipe.get('bindingContract','native-scene-v1'),inputPolicy=recipe.get('inputPolicy')))
    p=subprocess.Popen(recipe['args'],cwd=recipe['cwd'],env=env,pass_fds=fds,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    # Keep supervisor descriptors live for Workers and forked Node processes.
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
    for fd in fds:os.close(fd)
    if lock:fcntl.flock(lock,fcntl.LOCK_UN);lock.close()
    save(out,'supervisor-complete.json',dict(pid=os.getpid(),nativeWait=rc,watchdogWait=w.returncode,heavyReleased=bool(lock),actualChildWaits=True,bothEOF=eof=={'stdout':True,'stderr':True},at=time.time()))
if __name__=='__main__':
    mode=sys.argv[1];out=pathlib.Path(sys.argv[2]).resolve()
    if mode=='hold-module':prepare_holder(out,json.loads((out/'prepare.json').read_text()))
    elif mode=='watchdog':watchdog(out,float(sys.argv[3]))
    elif mode=='holderwait':
        seconds=json.loads((out/'prepare.json').read_text()).get('holderMaxSeconds',5400)
        save(out,'holder-watchdog-armed.json',dict(pid=os.getpid(),at=time.time(),deadline=time.time()+seconds,beforeHolder=True))
        p=subprocess.Popen([sys.executable,'-u','-B',__file__,'hold-module',str(out)],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
        timedout=False
        try:a,b=p.communicate(timeout=seconds)
        except subprocess.TimeoutExpired:
            timedout=True;p.terminate();a,b=p.communicate(timeout=10)
        (out/'holder.stdout.log').write_bytes(a);(out/'holder.stderr.log').write_bytes(b)
        save(out,'holder-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,timedOut=timedout,at=time.time()))
    elif mode=='detach-holder':
        with (out/'holder-owner.stdout.log').open('xb') as a,(out/'holder-owner.stderr.log').open('xb') as b:
            p=subprocess.Popen([sys.executable,'-u','-B',__file__,'holderwait',str(out)],stdin=subprocess.DEVNULL,stdout=a,stderr=b,start_new_session=True,close_fds=True)
        save(out,'holder-wait-owner.json',dict(pid=p.pid,startToken=token(p.pid),at=time.time(),stdio='devnull/files'))
        print(json.dumps(dict(detachedHolderWaitOwner=p.pid)),flush=True)
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
