#!/usr/bin/env python3
"""Native qualification by default; --original is a separately assigned pipeline.

Never builds or changes shared outputs. Runtime sources and module are sealed
in memory; only Git identities, hashes and helper diffs persist in evidence.
"""
import fcntl, hashlib, json, os, pathlib, signal, socket, subprocess, sys, time, types, uuid

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
OWN_SOURCES=('tools/vb5cce-original-runtime.py','test/run.js',
    'lib/installed-dll-closure.js','test/test-installed-dll-closure.cjs')

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
    normal=False
    try:
        rc=p.wait(timeout=timeout);normal=True;return rc
    finally:
        # poll/absence is never represented as a join: always call wait.
        rc=terminate_owned(p)
        publish(target/'native-wait.json',dict(**info,exit=rc,actualWait=True,
            disposition='normal' if normal else 'cleanup',
            outputMode='regular files; no pipe EOF claim',atWait=time.time(),atWaitMono=time.monotonic()))
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
def native_identity(p):
    return dict(pid=p.pid,startToken=token(p.pid),invocationToken=str(uuid.uuid4()),
        bootId=pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip())
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
    assert not (working and any(x in sys.argv for x in ('--original','--passive-original','--installed-original')))
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
    installed='--installed-original' in sys.argv
    original='--original' in sys.argv or installed or passive
    if installed:
        prepared={ref:subprocess.check_output(['git','rev-parse',ref],cwd=ROOT).decode().strip()
                  for ref in ('HEAD','origin/main')}
        assert all(value==HEAD for value in prepared.values()), 'prepare from CURRENT published main'
        save('preparation-published-main.json',dict(gitSHA=HEAD,refs=prepared,at=time.time(),
             policy='owner199: retain exact published preparation through unrelated later publication'))
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
    if installed or '--closure-only' in sys.argv or '--complete-qualification' in sys.argv:
        checked('authentic-dll-closure',['node','test/test-installed-dll-closure.cjs',str(RUN/'authentic-dll-closure')],env,(source,module))
        if '--closure-only' in sys.argv:return
    if '--installed-qualification' in sys.argv or '--modal-fence-only' in sys.argv or '--complete-qualification' in sys.argv or installed:
        checked('modal-invocation-fence',['node','test/test-vb5-modal-invocation-fence.cjs',str(RUN/'modal-invocation-fence')],env,(source,module))
        if '--modal-fence-only' in sys.argv:return
        checked('common-control-state',['node','test/test-vb5-installed-native.cjs',str(RUN/'common-control-state'),'--state'],env,(source,module))
        checked('nested-common',['node','test/test-vb5-installed-native.cjs',str(RUN/'nested-common'),'--nested'],env,(source,module))
        checked('installed-scope',['node','test/test-vb5-installed-native.cjs',str(RUN/'installed-scope'),'--run'],env,(source,module))
        proof=json.loads((RUN/'installed-scope/qualification.json').read_text())
        state=json.loads((RUN/'common-control-state/state-proof.json').read_text())
        nested=json.loads((RUN/'nested-common/nested-proof.json').read_text())
        fence=json.loads((RUN/'modal-invocation-fence/modal-fence-proof.json').read_text())
        assert proof['passed'] and proof['boundary'] is None and proof['nativeQuit']
        assert state['nestingBoundary'] is None and nested['passed'] and fence['passed']
        save('installed-protocol-qualification.json',dict(passed=True,nativeProtocolQualified=True,
            fullQualificationPending=True,personalOriginalReviewRequired=True,originalStarted=False))
        if not installed and '--complete-qualification' not in sys.argv:return
    if '--normal-exit-only' in sys.argv:
        checked('normal-exit',['python3','-B','test/test-vb5-normal-exit-completion.py',str(RUN/'normal-exit')],env,(source,module))
        checked('runtime-shutdown',['python3','-B','test/test-vb5-runtime-shutdown.py',str(RUN/'shutdown-qualification')],env,(source,module))
        checked('native-nested-owned',['node','test/test-vb5-nested-owned-modal.cjs',str(RUN/'nested-qualification')],env,(source,module))
        checked('native-dialogbox',['node','test/test-vb5-native-dialog-identity.cjs',str(RUN/'dialogbox-qualification')],env,(source,module))
        checked('native-controller',['node','test/test-vb5cce-original-current.cjs',str(RUN/'native-qualification')],env,(source,module))
        return
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
    if installed or '--complete-qualification' in sys.argv:
        save('complete-native-qualification.json',dict(passed=True,gitSHA=HEAD,moduleSHA256=sha(body),
            fullSourceSHA256=sha(pool),nativeProtocolAndFullRegression=True,originalStarted=False,
            personalFreshFrameRequired=True,immutableIntentLimitsMs=dict(confirmation=500,physicalUp=1750,completion=3000)))
    if not original:return
    if installed:installed_inputs=prepare_installed()
    while not (RUN/'original-go.json').exists():time.sleep(.1)
    if installed:
        later={ref:subprocess.check_output(['git','rev-parse',ref],cwd=ROOT).decode().strip()
               for ref in ('HEAD','origin/main')}
        for value in later.values():
            assert subprocess.run(['git','merge-base','--is-ancestor',HEAD,value],cwd=ROOT).returncode==0, 'published preparation left main graph'
        for fd,expected in ((source,sha(pool)),(module,sha(body))):
            assert fcntl.fcntl(fd,fcntl.F_GET_SEALS)==15
            assert sha(os.pread(fd,os.fstat(fd).st_size,0))==expected, 'sealed runtime changed'
        for name in ('tools/vb5cce-original-runtime.py','tools/vb5cce-reviewed-control.py','test/test-vb5cce-original-current.cjs'):
            assert (ROOT/name).read_bytes()==files[name], 'prepared helper changed: '+name
        save('prepared-execution-boundary.json',dict(gitSHA=HEAD,laterRefs=later,
             sourceSHA256=sha(pool),moduleSHA256=sha(body),sameSealedRuntime=True,
             sourceRefresh=False,helperPins=True,mainGraph=True,at=time.time()))
    started=time.time();native_seconds=120 if passive else 1800 if installed else 2400;watchdog_seconds=140 if passive else 1820 if installed else 2420
    reserve_seconds=0 if passive else 180 if installed else 240
    deadline=started+native_seconds
    save('pipeline-launch.json',dict(at=started,deadline=deadline,watchdogDeadline=started+watchdog_seconds,
         reserveSeconds=reserve_seconds,gameplayCutoff=deadline-reserve_seconds,
         winver='nt4',secondPipeline=False,passiveDiagnostic=passive,inputsAuthorized=not passive))
    w=subprocess.Popen([sys.executable,'-B',__file__,'watchdog',str(started+watchdog_seconds)],
         stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    try:
        while not (RUN/'watchdog-armed.json').exists():assert w.poll() is None;time.sleep(.01)
        original_pipeline(env,source,module,started,deadline,passive,installed_inputs if installed else None)
    finally:
        save('pipeline-closed.json',dict(at=time.time(),originalStarted=ORIGINAL_STARTED))
        join_watchdog(w)
def qualify(env,files,source,module,include_progress=True):
    checked('normal-exit',['python3','-B','test/test-vb5-normal-exit-completion.py',str(RUN/'normal-exit')],env,(source,module))
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
def prepare_installed():
    # Previously authenticated installer output. Pin the complete verification
    # manifest, then rehash every original blob/registry/provenance byte before
    # creating this invocation's writable overlay. The old endpoint is closed.
    manifest_path=ROOT/'scratch/runs/20261117-vb5-native-common-dialog-focus-state-repair/authentic-recovery-manifest.json'
    body=manifest_path.read_bytes()
    assert sha(body)=='7b162aeb1206c40382f915c57ede6b74461a1a3414acd09184f5518854eb20bb'
    m=json.loads(body);assert m['passed'] and m['records']==258 and m['files']==86 and m['registryEntries']==836
    for item in [*m['provenance'].values(),*m['blobs']]:
        actual=(ROOT/item['path']).read_bytes()
        assert len(actual)==item['bytes'] and sha(actual)==item['sha256'],item['path']
    index_item=m['provenance']['original-published/guest-overlay/index.json']
    registry_item=m['provenance']['original-published/guest-registry.json']
    index=json.loads((ROOT/index_item['path']).read_bytes())
    assert len(index['records'])==258
    assert len(json.loads((ROOT/registry_item['path']).read_bytes()))==836
    overlay=RUN/'guest-overlay';(overlay/'blobs').mkdir(parents=True)
    (overlay/'index.json').write_bytes((ROOT/index_item['path']).read_bytes())
    # Opaque store blobs are immutable and replaced with fresh UUIDs. Symlinks
    # reference existing verified media; cleanup unlinks only our references.
    for item in m['blobs']:
        target=ROOT/item['path'];(overlay/'blobs'/target.name).symlink_to(target)
    (RUN/'guest-registry.json').write_bytes((ROOT/registry_item['path']).read_bytes())
    guest='c:\\program files\\vb5cce\\vb5cce.exe'
    sample='c:\\program files\\vb5cce\\samples\\axbutton\\axbutton.vbp'
    exe=next(item for item in m['blobs'] if item['guest'].lower()==guest)
    sample_item=next(item for item in m['blobs'] if item['guest'].lower()==sample)
    save('authentic-installed-recovery.json',dict(passed=True,manifest=str(manifest_path.relative_to(ROOT)),
        manifestSHA256=sha(body),records=258,blobCount=86,registryEntries=836,exe=exe,sample=sample_item,
        provenance=m['provenance'],blobs=m['blobs'],originalInvocationsBeforeThisTask=0,
        oldUnknown='closed; no endpoint request/rebind/replay',mediaCopied=False,registryEdited=False))
    return ROOT/exe['path'],guest,sample

def original_pipeline(env,source,module,started,deadline,passive,installed_inputs=None):
    global ORIGINAL_STARTED
    reserve_seconds=0 if passive else 180 if installed_inputs else 240
    for stage in range(1 if passive or installed_inputs else 3):
            if stage:
                while not (RUN/f'stage-{stage}-go.json').exists():
                    if (RUN/'stop-pipeline.json').exists() or time.time()>=deadline-240:return
                    time.sleep(.05)
            assert time.time()<deadline-reserve_seconds
            if installed_inputs:
                exe,guest,sample=installed_inputs;cwd='C:\\Program Files\\VB5CCE\\'
                extra=['--reg-import='+str(RUN/'guest-registry.json'),'--args="'+sample+'"']
            elif stage==0:
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
            invocation=str(uuid.uuid4())
            argv=['node','test/run.js','--exe='+str(exe),'--exe-guest-path='+guest,'--cwd='+cwd,
                '--native-exit-receipt='+str(target/'native-exit.json'),'--native-invocation-token='+invocation,
                '--winver=nt4','--no-build',f'--wasm=/proc/{os.getpid()}/fd/{module}',
                '--overlay-dir='+str(RUN/'guest-overlay'),'--overlay-flush-ms=0',
                '--reg-export='+str(RUN/'guest-registry.json'),'--spawn-processes','--threads',
                '--control='+str(port),'--max-seconds='+str(max(1,int(deadline-time.time()))),
                '--max-batches=1000000000','--stuck-after=0','--real-ticks',
                '--quiet-api','--quiet-blocks','--png-canvas',
                '--pipe-child-args=--control='+str(childport)+' --winver=nt4 --threads --real-ticks --png-canvas',*SUPPORT_MOUNTS,*extra]
            publish(target/'launch.json',dict(args=argv,at=started,deadline=deadline,
                 gameplayCutoff=deadline-reserve_seconds,reserveSeconds=reserve_seconds,
                 rootPort=port,childPort=childport,winver='nt4',passiveDiagnostic=passive))
            with (target/'native.stdout.log').open('xb') as out,(target/'native.stderr.log').open('xb') as err:
                p=subprocess.Popen(argv,cwd=ROOT,env=env,pass_fds=(source,module),stdout=out,stderr=err,start_new_session=True)
                info=native_identity(p)
                info['invocationToken']=invocation
                try:
                    ORIGINAL_STARTED=True
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
                            disposition='cleanup',outputMode='regular files; no pipe EOF claim',
                            atWait=time.time(),atWaitMono=time.monotonic()))
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
