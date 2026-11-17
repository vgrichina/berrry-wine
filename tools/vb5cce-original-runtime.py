#!/usr/bin/env python3
"""Native qualification by default; --original is a separately assigned pipeline.

Never builds or changes shared outputs. Runtime sources and module are sealed
in memory; only Git identities, hashes and helper diffs persist in evidence.
"""
import fcntl, hashlib, json, os, pathlib, signal, socket, subprocess, sys, time, types

ROOT=pathlib.Path(__file__).resolve().parent.parent
RUN=pathlib.Path(os.environ.get('DELPHI5_RUN',ROOT/'scratch/runs/20261116-vb5cce-reviewed-context-install-ide'))
HEAD=subprocess.check_output(['git','rev-parse',os.environ.get('DELPHI5_GIT','HEAD')],cwd=ROOT).decode().strip()
OWN_FDS=set()
ORIGINAL_STARTED=False
MEDIA=ROOT/'test/binaries/candidates/vb5cce-original'
SUPPORT_PACKAGE=ROOT/'test/binaries/win98-games-a-d/Colin-Mcrae-Rally2-demo-D3D/extracted/dx7aeng.exe'
SUPPORT_PACKAGE_SHA256='564de93dcc50691480332e2ccb5565908760b295faa70f8c68854f69dad87189'
CFGMGR32_SHA256='572387372791a7bc8d336fbbb6af6a9651a627124599f862ac2bd235145b7b80'
SUPPORT_MOUNTS=[]
OWN_SOURCES=('tools/vb5cce-original-runtime.py','test/test-vb5-native-dialog-identity.cjs',
    'test/test-vb5-nested-owned-modal.cjs','test/test-vb5-runtime-shutdown.py','lib/cli-native-scene.js','lib/cli-native-user-windows.js',
    'src/13-exports.wat','src/09a5-handlers-window.wat')

class ShutdownRequested(SystemExit):pass
def shutdown_signal(signum,frame):
    # Complete joins and descriptor release even if the launcher repeats TERM.
    signal.signal(signal.SIGTERM,signal.SIG_IGN)
    signal.signal(signal.SIGINT,signal.SIG_IGN)
    raise ShutdownRequested(128+signum)
def install_shutdown_handlers():
    signal.signal(signal.SIGTERM,shutdown_signal)
    signal.signal(signal.SIGINT,shutdown_signal)
def terminate_owned(p):
    if p.poll() is None:
        try:os.killpg(p.pid,signal.SIGTERM)
        except ProcessLookupError:pass
    try:return p.wait(timeout=10)
    except subprocess.TimeoutExpired:
        try:os.killpg(p.pid,signal.SIGKILL)
        except ProcessLookupError:pass
        return p.wait(timeout=10)
def wait_native(p,target,info,timeout=None):
    try:return p.wait(timeout=timeout)
    finally:
        # poll/absence is never represented as a join: always call wait.
        rc=terminate_owned(p)
        publish(target/'native-wait.json',dict(**info,exit=rc,actualWait=True,
            outputMode='regular files; no pipe EOF claim',atWait=time.time()))
def join_watchdog(w):
    try:a,b=w.communicate(timeout=10)
    except subprocess.TimeoutExpired:
        terminate_owned(w);a,b=w.communicate(timeout=10)
    save('watchdog-wait.json',dict(pid=w.pid,exit=w.returncode,actualWait=True,
        stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))

def sha(b):return hashlib.sha256(b).hexdigest()
def publish(path,value):
    pending=path.with_name(path.name+'.'+str(os.getpid())+'.pending')
    with pending.open('x') as f:
        json.dump(value,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
    os.link(pending,path);pending.unlink()
def save(name,value):publish(RUN/name,value)
def seal(name,body):
    fd=os.memfd_create(name,os.MFD_ALLOW_SEALING)
    with os.fdopen(os.dup(fd),'wb') as f:f.write(body)
    os.lseek(fd,0,0);fcntl.fcntl(fd,fcntl.F_ADD_SEALS,15)
    assert fcntl.fcntl(fd,fcntl.F_GET_SEALS)==15
    OWN_FDS.add(fd)
    return fd
def close_owned(fd):
    os.close(fd);OWN_FDS.discard(fd)
def genuine_setupapi_support():
    # The exact NT SetupAPI from this package statically imports CFGMGR32.
    # Keep both original PE bodies intact. Nothing is installed or copied into
    # the media directory; the native loader binds and attaches the companion.
    assert sha(SUPPORT_PACKAGE.read_bytes())==SUPPORT_PACKAGE_SHA256
    cfg=subprocess.check_output(['7z','e','-so',str(SUPPORT_PACKAGE),'cfgmgr32.dll'],cwd=ROOT)
    assert len(cfg)==41984 and sha(cfg)==CFGMGR32_SHA256
    fd=seal('vb5-genuine-cfgmgr32',cfg)
    SUPPORT_MOUNTS.append('--vfs-mount='+f'/proc/{os.getpid()}/fd/{fd}'+'=c:\\cfgmgr32.dll')
    save('genuine-support.json',dict(package=str(SUPPORT_PACKAGE.relative_to(ROOT)),
        packageSHA256=SUPPORT_PACKAGE_SHA256,member='cfgmgr32.dll',sha256=CFGMGR32_SHA256,
        size=len(cfg),seals=15,guestPath='c:\\cfgmgr32.dll',modified=False))
    return fd
def token(pid):
    s=pathlib.Path(f'/proc/{pid}/stat').read_text();return s[s.rindex(')')+2:].split()[19]
def sources():
    names=subprocess.check_output(['git','ls-tree','-r','--name-only',HEAD],cwd=ROOT).decode().splitlines()
    names=[n for n in names if n.endswith(('.js','.cjs','.json','.wat','.watx','.py')) and
           (n.startswith(('src/','lib/','tools/','fonts/','test/')) or n=='host.js') and not n.startswith('test/binaries/')]
    p=subprocess.Popen(['git','cat-file','--batch'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
    files={}
    for name in names:
        p.stdin.write((HEAD+':'+name+'\n').encode());p.stdin.flush()
        header=p.stdout.readline().split();assert len(header)==3 and header[1]==b'blob'
        files[name]=p.stdout.read(int(header[2]));assert p.stdout.read(1)==b'\n'
    p.stdin.close();assert p.wait()==0
    # Qualification can test this worker's explicit patch in memory. An original
    # always requires one exact published tree and never consumes this overlay.
    working='--working-qualification' in sys.argv
    assert not (working and any(x in sys.argv for x in ('--original','--passive-original')))
    for name in OWN_SOURCES:
        if working:files[name]=(ROOT/name).read_bytes()
        elif name.endswith('.py'):assert files[name]==(ROOT/name).read_bytes(), 'publish helper before sealing: '+name
    return files
def checked(name,args,env,fds,expected=0):
    p=subprocess.Popen(args,cwd=ROOT,env=env,pass_fds=fds,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    timed_out=False
    try:a,b=p.communicate(timeout=180)
    except subprocess.TimeoutExpired:
        timed_out=True
        os.killpg(p.pid,signal.SIGTERM)
        try:a,b=p.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid,signal.SIGKILL);a,b=p.communicate()
    except BaseException:
        terminate_owned(p);a,b=p.communicate(timeout=10)
        (RUN/(name+'.stdout.log')).write_bytes(a);(RUN/(name+'.stderr.log')).write_bytes(b)
        save(name+'-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,interrupted=True))
        raise
    (RUN/(name+'.stdout.log')).write_bytes(a);(RUN/(name+'.stderr.log')).write_bytes(b)
    save(name+'-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,expected=expected,timedOut=timed_out))
    assert not timed_out and p.returncode==expected,name+' failed; original not authorized by qualification'
def watchdog(deadline):
    save('watchdog-armed.json',dict(pid=os.getpid(),at=time.time(),deadline=deadline,independent=True,prearmed=True))
    while time.time()<deadline:
        if (RUN/'pipeline-closed.json').exists():
            save('watchdog-exit.json',dict(at=time.time(),reason='actual native wait'));return
        time.sleep(.05)
    info=json.loads((RUN/'current-native-pid.json').read_text())
    sent=[]
    for sig in (signal.SIGTERM,signal.SIGKILL):
        try:
            if token(info['pid'])==info['startToken']:os.killpg(info['pid'],sig);sent.append(int(sig))
        except (FileNotFoundError,ProcessLookupError):pass
        if sig==signal.SIGTERM:time.sleep(3)
    save('watchdog-exit.json',dict(at=time.time(),reason='independent fixed deadline',signals=sent))
def run():
    global ORIGINAL_STARTED
    RUN.mkdir(parents=True,exist_ok=True)
    passive='--passive-original' in sys.argv
    original='--original' in sys.argv or passive
    assert not (original and '--baseline-paint' in sys.argv)
    if original:
        assert not os.environ.get('VB5_DIALOG_MODES') and not os.environ.get('DELPHI5_NATIVE_MODES'), 'original requires full default qualification'
        body=(MEDIA/'vb5ccein.exe').read_bytes()
        assert len(body)==7479944 and sha(body)=='022af94b651cd9d31e0676a6819dd5085940893f1ecc4abaa85b48c30de6f318'
        assert sha((MEDIA/'setupapi.dll').read_bytes())=='51f2682279e28386aa9c0eb8ba4f8ac3000c9ff75cf7e2456e8cdd9f0c544159'
    st=os.statvfs('/home');assert st.f_bavail*st.f_frsize>1500000000
    assert subprocess.run(['git','merge-base','--is-ancestor','c8f308b84',HEAD],cwd=ROOT).returncode==0
    files=sources()
    module=os.memfd_create('delphi5-module',os.MFD_ALLOW_SEALING)
    OWN_FDS.add(module)
    # Reuse the published indexed fail-closed loader; it validates each exact
    # source body on demand and preserves sealed child inheritance.
    helper=types.ModuleType('sealed_supervisor')
    helper.__file__=str(ROOT/'tools/disciples2-current-supervisor.py')
    exec(compile(files['tools/disciples2-current-supervisor.py'],helper.__file__,'exec'),helper.__dict__)
    for p in (ROOT/'node_modules/pngjs').rglob('*'):
        if p.is_file() and p.suffix in ('.js','.json'):files[str(p.relative_to(ROOT))]=p.read_bytes()
    pool,index,rows=helper.indexed_sources(files)
    source=seal('vb5-source',pool)
    preload=seal('vb5-preload',files['tools/disciples2-current-native-source-view.cjs'])
    patches=[]
    for name in OWN_SOURCES if '--working-qualification' in sys.argv else ():
        tracked=subprocess.run(['git','cat-file','-e',HEAD+':'+name],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
        diff=subprocess.run(['git','diff','--binary',HEAD,'--',name] if tracked else
             ['git','diff','--no-index','--binary','--','/dev/null',name],cwd=ROOT,capture_output=True)
        assert diff.returncode in (0,1);patches.append(diff.stdout)
    (RUN/'owned-helpers.patch').write_bytes(b''.join(patches))
    if '--working-qualification' not in sys.argv:
        # Retain relevant excluded WIP as a diff, never apply it to the source
        # pool. Recovery of a published run uses Git alone (empty owned patch).
        excluded=subprocess.check_output(['git','diff','--binary',HEAD,'--','src','lib','tools','host.js','test/run.js'],cwd=ROOT)
        (RUN/'excluded-worktree.patch').write_bytes(excluded)
    (RUN/'desktop-observations').mkdir(exist_ok=True)
    env=os.environ.copy();assert not env.get('NODE_OPTIONS')
    env.update(NODE_OPTIONS='--preserve-symlinks --require='+f'/proc/{os.getpid()}/fd/{preload}',
         DISCIPLES2_ROOT=str(ROOT),DISCIPLES2_SOURCE_FD=f'/proc/{os.getpid()}/fd/{source}',
         DISCIPLES2_SOURCE_SHA256=sha(pool),DISCIPLES2_SOURCE_INDEX_SHA256=sha(index),DISCIPLES2_PHASE='compile',
         DELPHI5_SOURCE_FD=f'/proc/{os.getpid()}/fd/{source}',DELPHI5_MODULE_FD=f'/proc/{os.getpid()}/fd/{module}',
         DELPHI5_MODULE_SHA256=sha(b''),WINE_COM_PROTOCOL_DIR=str(RUN/'children'),
         WINE_PROCESS_DESKTOP_OBSERVE=str(RUN/'desktop-observations'))
    # Compile exact Git bytes directly into our descriptor, never shared outputs.
    compile_code="""const fs=require('node:fs');
const {watxSourceClosure,compileClosure}=require('./tools/watx-closure');
const {layoutHash,appendSection}=require('./tools/region-layout-hash');
const r=compileClosure(watxSourceClosure(),{tailCalls:true});
if(!r.success)throw Error(JSON.stringify(r));
fs.writeFileSync(process.env.DELPHI5_MODULE_FD,appendSection(Buffer.from(r.wasmBinary),layoutHash(r.regions.regions)));
"""
    checked('exact-git-compile',['node','-e',compile_code],env,(source,module))
    os.lseek(module,0,0);body=os.read(module,os.fstat(module).st_size)
    fcntl.fcntl(module,fcntl.F_ADD_SEALS,15);assert body[:4]==b'\0asm'
    (RUN/'module.wasm').write_bytes(body)
    assert sha((RUN/'module.wasm').read_bytes())==sha(body)
    env['DELPHI5_MODULE_SHA256']=sha(body)
    save('compile-inputs.json',dict(gitSHA=HEAD,sources={n:sha(b) for n,b in files.items()},moduleSHA256=sha(body),
        workingQualification='--working-qualification' in sys.argv))
    manifest=dict(gitSHA=HEAD,sourceSHA256=sha(pool),sourceIndexSHA256=sha(index),moduleSHA256=sha(body),
                  preloadSHA256=sha(files['tools/disciples2-current-native-source-view.cjs']),sources=rows,foreignWIPAdopted=False)
    encoded=json.dumps(manifest,sort_keys=True).encode();manifestfd=seal('vb5-manifest',encoded)
    env.update(DISCIPLES2_PHASE='runtime',DISCIPLES2_MODULE_FD=f'/proc/{os.getpid()}/fd/{module}',
         DISCIPLES2_MODULE_SHA256=sha(body),DISCIPLES2_MANIFEST_SHA256=sha(encoded),
         DISCIPLES2_ENTRY_SHA256=sha(files['test/run.js']),DISCIPLES2_PRELOAD=f'/proc/{os.getpid()}/fd/{preload}')
    save('immutable-manifest.json',manifest)
    env['DELPHI5_SOURCE_FD']=f'/proc/{os.getpid()}/fd/{source}'
    save('runtime-inputs.json',dict(gitSHA=HEAD,moduleSHA256=sha(body),moduleBytes=len(body),moduleSeals=15,sourceSeals=15,
         sources={n:sha(b) for n,b in files.items()},foreignWIPAdopted=False,
         recovery='Git plus owned-helpers.patch; exact compileClosure tailCalls and layout stamp',ownModuleDescriptor=module))
    helper.inheritance_probe(RUN,dict(childInheritance='sealed-node-v1',args=['node'],cwd=str(ROOT)),env)
    if '--repair-only' in sys.argv:
        checked('native-nested-owned',['node','test/test-vb5-nested-owned-modal.cjs',str(RUN/'nested-qualification')],env,(source,module))
        checked('runtime-shutdown',['python3','-B','test/test-vb5-runtime-shutdown.py',str(RUN/'shutdown-qualification')],env,(source,module))
        checked('native-context-guards',['node','test/test-cli-native-scene-context.cjs','--unit'],env,(source,module))
        checked('vb-context-guards',['node','test/test-vb5cce-original-current.cjs','--unit'],env,(source,module))
        checked('native-button-guards',['node','test/test-vb5-native-dialog-identity.cjs','--unit'],env,(source,module))
        checked('first-dialog',['node','test/test-vb5cce-original-current.cjs','--first-dialog',str(RUN/'first-dialog')],env,(source,module))
        checked('native-dialogbox',['node','test/test-vb5-native-dialog-identity.cjs',str(RUN/'dialogbox-qualification')],env,(source,module))
        return
    if '--nested-only' in sys.argv or '--nested-worker-only' in sys.argv:
        checked('native-nested-owned',['node','test/test-vb5-nested-owned-modal.cjs',str(RUN/'nested-qualification'),
            *(['--worker'] if '--nested-worker-only' in sys.argv else [])],env,(source,module))
        return
    if '--shutdown-only' in sys.argv:
        checked('runtime-shutdown',['python3','-B','test/test-vb5-runtime-shutdown.py',str(RUN/'shutdown-qualification')],env,(source,module))
        return
    if original or '--setupapi-only' in sys.argv:
        cfgfd=genuine_setupapi_support()
        env['VB5_CFGMGR32']=f'/proc/{os.getpid()}/fd/{cfgfd}'
        checked('genuine-setupapi',['node','test/test-vb5-genuine-setupapi.cjs',str(RUN/'setupapi-native'),'--run'],env,(source,module,cfgfd))
        if '--setupapi-only' in sys.argv:return
    if '--progress-state-only' in sys.argv:
        checked('native-progress-state',['node','test/test-vb5-native-progress.cjs','--state',str(RUN/'state-qualification')],env,(source,module))
        return
    if '--progress-observe-only' in sys.argv:
        checked('native-progress-observe',['node','test/test-vb5-native-progress.cjs','--observe',str(RUN/'observe-qualification')],env,(source,module))
        return
    if '--progress-only' in sys.argv:
        progress_qualify(env,source,module)
        return
    if '--regressions-only' in sys.argv:
        checked('first-dialog',['node','test/test-vb5cce-original-current.cjs','--first-dialog',str(RUN/'first-dialog')],env,(source,module))
        qualify(env,files,source,module,include_progress=False)
        return
    if '--dialogbox-only' in sys.argv:
        checked('native-dialogbox',['node','test/test-vb5-native-dialog-identity.cjs',str(RUN/'dialogbox-qualification')],env,(source,module))
        return
    if '--first-dialog-only' in sys.argv or original:
        checked('first-dialog',['node','test/test-vb5cce-original-current.cjs','--first-dialog',str(RUN/'first-dialog')],env,(source,module))
        if '--first-dialog-only' in sys.argv:return
    if '--baseline-paint' in sys.argv:
        env['DELPHI5_NATIVE_MODES']='paint-queued-fault'
        checked('native-paint-baseline',['node','test/test-delphi5-after-desktop.cjs',str(RUN/'native-qualification')],env,(source,module),expected=1)
        save('baseline.json',dict(expectedFailure=True,unmodifiedGitHost=True,originalStarted=False))
        return
    # Real Worker regression before/after: only the before child reads the old receive.
    if not passive:
        if original:
            checked('native-nested-owned',['node','test/test-vb5-nested-owned-modal.cjs',str(RUN/'nested-qualification')],env,(source,module))
            checked('runtime-shutdown',['python3','-B','test/test-vb5-runtime-shutdown.py',str(RUN/'shutdown-qualification')],env,(source,module))
        qualify(env,files,source,module)
    if not original:return
    while not (RUN/'original-go.json').exists():time.sleep(.1)
    started=time.time();native_seconds=120 if passive else 2400;watchdog_seconds=140 if passive else 2420
    deadline=started+native_seconds
    save('pipeline-launch.json',dict(at=started,deadline=deadline,watchdogDeadline=started+watchdog_seconds,
         reserveSeconds=0 if passive else 240,gameplayCutoff=deadline if passive else deadline-240,
         winver='nt4',secondPipeline=False,passiveDiagnostic=passive,inputsAuthorized=not passive))
    w=subprocess.Popen([sys.executable,'-B',__file__,'watchdog',str(started+watchdog_seconds)],
         stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    try:
        while not (RUN/'watchdog-armed.json').exists():assert w.poll() is None;time.sleep(.01)
        original_pipeline(env,source,module,started,deadline,passive)
    finally:
        save('pipeline-closed.json',dict(at=time.time(),originalStarted=ORIGINAL_STARTED))
        join_watchdog(w)
def qualify(env,files,source,module,include_progress=True):
    # The legacy source-view test intentionally replaces NODE_OPTIONS with its
    # own unsealed loader. The indexed inheritance probe above qualifies this
    # runtime's loader; retain both actual desktop transport tests here.
    checked('transport-after',['node','--test','--test-name-pattern=desktop','test/test-delphi5-original-install.cjs'],env,(source,module))
    checked('native-context-guards',['node','test/test-cli-native-scene-context.cjs','--unit'],env,(source,module))
    checked('vb-context-guards',['node','test/test-vb5cce-original-current.cjs','--unit'],env,(source,module))
    checked('native-button-guards',['node','test/test-vb5-native-dialog-identity.cjs','--unit'],env,(source,module))
    if include_progress:progress_qualify(env,source,module)
    checked('native-pointer-mapping',['node','test/test-cli-native-pointer-coordinates.cjs','--native',str(RUN/'mapping-qualification')],env,(source,module))
    checked('native-dialogbox',['node','test/test-vb5-native-dialog-identity.cjs',str(RUN/'dialogbox-qualification')],env,(source,module))
    checked('native-controller',['node','test/test-vb5cce-original-current.cjs',str(RUN/'native-qualification')],env,(source,module))
    admission=json.loads((RUN/'native-qualification/vb-original-admission.json').read_text())
    save('qualification.json',dict(passed=admission['safeForVBOriginal'],generatedTestsPassed=True,
         admission=admission,at=time.time(),originalStarted=False))
    assert admission['safeForVBOriginal'],admission['blocker']
def progress_qualify(env,source,module):
    checked('native-progress-guards',['node','test/test-vb5-native-progress.cjs','--review-unit'],env,(source,module))
    checked('native-progress-state',['node','test/test-vb5-native-progress.cjs','--state',str(RUN/'state-qualification')],env,(source,module))
    checked('native-progress-dialogs',['node','test/test-vb5-native-progress.cjs','--native',str(RUN/'progress-qualification')],env,(source,module))
    checked('native-progress-refusals',['node','test/test-vb5-native-progress.cjs','--refusals',str(RUN/'progress-refusals')],env,(source,module))
def original_pipeline(env,source,module,started,deadline,passive):
    global ORIGINAL_STARTED
    for stage in range(1 if passive else 3):
            if stage:
                while not (RUN/f'stage-{stage}-go.json').exists():
                    if (RUN/'stop-pipeline.json').exists() or time.time()>=deadline-240:return
                    time.sleep(.05)
            assert time.time()<deadline-(0 if passive else 240)
            if stage==0:
                exe=MEDIA/'vb5ccein.exe';guest='C:\\vb5ccein.exe';cwd='C:\\';extra=['--vfs-include=setupapi.dll']
            else:
                request=json.loads((RUN/f'stage-{stage}-go.json').read_text())
                guest=request['guest'];assert guest.lower().startswith('c:\\')
                exe=RUN/'guest-overlay'/guest[3:].replace('\\','/')
                assert exe.is_file()
                cwd=request['cwd'];extra=['--reg-import='+str(RUN/'guest-registry.json')]
                if request.get('args'):extra+=['--args='+request['args']]
            with socket.socket() as reservation:
                reservation.bind(('127.0.0.1',0));port=reservation.getsockname()[1]
            with socket.socket() as reservation:
                reservation.bind(('127.0.0.1',0));childport=reservation.getsockname()[1]
            assert port!=childport
            target=RUN/f'stage-{stage}';target.mkdir()
            (target/'runtime-inputs.json').write_bytes((RUN/'runtime-inputs.json').read_bytes())
            argv=['node','test/run.js','--exe='+str(exe),'--exe-guest-path='+guest,'--cwd='+cwd,
                '--winver=nt4','--no-build',f'--wasm=/proc/{os.getpid()}/fd/{module}',
                '--overlay-dir='+str(RUN/'guest-overlay'),'--overlay-flush-ms=0',
                '--reg-export='+str(RUN/'guest-registry.json'),'--spawn-processes','--threads',
                '--control='+str(port),'--max-seconds='+str(max(1,int(deadline-time.time()))),
                '--max-batches=1000000000','--stuck-after=0','--real-ticks',
                '--quiet-api','--quiet-blocks','--png-canvas',
                '--pipe-child-args=--control='+str(childport)+' --winver=nt4 --threads --real-ticks --png-canvas',*SUPPORT_MOUNTS,*extra]
            publish(target/'launch.json',dict(args=argv,at=started,deadline=deadline,
                 gameplayCutoff=deadline-(0 if passive else 240),reserveSeconds=0 if passive else 240,
                 rootPort=port,childPort=childport,winver='nt4',passiveDiagnostic=passive))
            with (target/'native.stdout.log').open('xb') as out,(target/'native.stderr.log').open('xb') as err:
                p=subprocess.Popen(argv,cwd=ROOT,env=env,pass_fds=(source,module),stdout=out,stderr=err,start_new_session=True)
                info=dict(pid=p.pid,at=time.time())
                try:
                    ORIGINAL_STARTED=True
                    info['startToken']=token(p.pid)
                    publish(target/'native-pid.json',info)
                    # Stage replacement is one complete atomic watchdog identity.
                    pending=RUN/'current-native-pid.pending'
                    pending.write_text(json.dumps(info));os.replace(pending,RUN/'current-native-pid.json')
                    if passive:
                        while p.poll() is None:
                            if (target/'PERMANENT-UNKNOWN.json').exists() or (target/'diagnostic.json').exists():
                                os.killpg(p.pid,signal.SIGTERM);break
                            time.sleep(.01)
                    rc=wait_native(p,target,info)
                finally:
                    # Exceptions before entering wait must also reap the child.
                    if not (target/'native-wait.json').exists():
                        terminate_owned(p)
                        publish(target/'native-wait.json',dict(**info,exit=p.returncode,actualWait=True,
                            outputMode='regular files; no pipe EOF claim',atWait=time.time()))
            if (target/'PERMANENT-UNKNOWN.json').exists() or rc!=0:return

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='watchdog':watchdog(float(sys.argv[2]))
    else:
        install_shutdown_handlers()
        success=False
        try:run();success=True
        finally:
            for fd in list(OWN_FDS):close_owned(fd)
            if RUN.exists():save('runtime-release.json',dict(at=time.time(),supervisor=os.getpid(),success=success,
                ownDescriptorsClosed=True,originalStarted=ORIGINAL_STARTED,box=None))
