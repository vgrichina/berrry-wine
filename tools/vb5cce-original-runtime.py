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

def sha(b):return hashlib.sha256(b).hexdigest()
def save(name,value):
    with (RUN/name).open('x') as f:json.dump(value,f,indent=2);f.write('\n')
def seal(name,body):
    fd=os.memfd_create(name,os.MFD_ALLOW_SEALING)
    with os.fdopen(os.dup(fd),'wb') as f:f.write(body)
    os.lseek(fd,0,0);fcntl.fcntl(fd,fcntl.F_ADD_SEALS,15)
    assert fcntl.fcntl(fd,fcntl.F_GET_SEALS)==15
    OWN_FDS.add(fd)
    return fd
def close_owned(fd):
    os.close(fd);OWN_FDS.discard(fd)
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
    # All tracked code is supplied from one Git tree, including compiler and tests.
    # Only these owned helpers overlay Git; published process-desktop is untouched.
    for name in ('tools/vb5cce-original-runtime.py','test/test-vb5cce-original-current.cjs','tools/vb5cce-reviewed-control.py','lib/cli-native-scene.js'):
        files[name]=(ROOT/name).read_bytes()
    return files
def checked(name,args,env,fds,expected=0):
    p=subprocess.Popen(args,cwd=ROOT,env=env,pass_fds=fds,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    try:a,b=p.communicate(timeout=180)
    except subprocess.TimeoutExpired:
        os.killpg(p.pid,signal.SIGTERM)
        try:a,b=p.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid,signal.SIGKILL);a,b=p.communicate()
    (RUN/(name+'.stdout.log')).write_bytes(a);(RUN/(name+'.stderr.log')).write_bytes(b)
    save(name+'-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,expected=expected))
    assert p.returncode==expected,name+' failed; original not authorized by qualification'
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
    for name in ['tools/vb5cce-original-runtime.py','test/test-vb5cce-original-current.cjs','tools/vb5cce-reviewed-control.py','lib/cli-native-scene.js']:
        tracked=subprocess.run(['git','cat-file','-e',HEAD+':'+name],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
        diff=subprocess.run(['git','diff','--binary',HEAD,'--',name] if tracked else
             ['git','diff','--no-index','--binary','--','/dev/null',name],cwd=ROOT,capture_output=True)
        assert diff.returncode in (0,1);patches.append(diff.stdout)
    (RUN/'owned-helpers.patch').write_bytes(b''.join(patches))
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
    env['DELPHI5_MODULE_SHA256']=sha(body)
    save('compile-inputs.json',dict(gitSHA=HEAD,sources={n:sha(b) for n,b in files.items()},moduleSHA256=sha(body)))
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
    if '--first-dialog-only' in sys.argv or passive:
        checked('first-dialog',['node','test/test-vb5cce-original-current.cjs','--first-dialog',str(RUN/'first-dialog')],env,(source,module))
        if not passive:return
    if '--baseline-paint' in sys.argv:
        env['DELPHI5_NATIVE_MODES']='paint-queued-fault'
        checked('native-paint-baseline',['node','test/test-delphi5-after-desktop.cjs',str(RUN/'native-qualification')],env,(source,module),expected=1)
        save('baseline.json',dict(expectedFailure=True,unmodifiedGitHost=True,originalStarted=False))
        return
    # Real Worker regression before/after: only the before child reads the old receive.
    if not passive:
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
    while not (RUN/'watchdog-armed.json').exists():assert w.poll() is None;time.sleep(.01)
    try:
        original_pipeline(env,source,module,started,deadline,passive)
    finally:
        save('pipeline-closed.json',dict(at=time.time(),originalStarted=ORIGINAL_STARTED))
        a,b=w.communicate(timeout=10)
        save('watchdog-wait.json',dict(pid=w.pid,exit=w.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,
            stdout=a.decode(),stderr=b.decode()))
def qualify(env,files,source,module):
    # The legacy source-view test intentionally replaces NODE_OPTIONS with its
    # own unsealed loader. The indexed inheritance probe above qualifies this
    # runtime's loader; retain both actual desktop transport tests here.
    checked('transport-after',['node','--test','--test-name-pattern=desktop','test/test-delphi5-original-install.cjs'],env,(source,module))
    checked('native-context-guards',['node','test/test-cli-native-scene-context.cjs','--unit'],env,(source,module))
    checked('native-controller',['node','test/test-vb5cce-original-current.cjs',str(RUN/'native-qualification')],env,(source,module))
    admission=json.loads((RUN/'native-qualification/vb-original-admission.json').read_text())
    save('qualification.json',dict(passed=admission['safeForVBOriginal'],generatedTestsPassed=True,
         admission=admission,at=time.time(),originalStarted=False))
    assert admission['safeForVBOriginal'],admission['blocker']
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
                '--pipe-child-args=--control='+str(childport)+' --winver=nt4 --threads --real-ticks --png-canvas',*extra]
            (target/'launch.json').write_text(json.dumps(dict(args=argv,at=started,deadline=deadline,
                 gameplayCutoff=deadline-(0 if passive else 240),reserveSeconds=0 if passive else 240,
                 rootPort=port,childPort=childport,winver='nt4',passiveDiagnostic=passive)))
            with (target/'native.stdout.log').open('xb') as out,(target/'native.stderr.log').open('xb') as err:
                p=subprocess.Popen(argv,cwd=ROOT,env=env,pass_fds=(source,module),stdout=out,stderr=err,start_new_session=True)
                ORIGINAL_STARTED=True
                info=dict(pid=p.pid,startToken=token(p.pid),at=time.time())
                (target/'native-pid.json').write_text(json.dumps(info))
                (RUN/'current-native-pid.json').write_text(json.dumps(info))
                if passive:
                    # First complete result/refusal closes this endpoint. No later
                    # observation, identity query or input is performed.
                    while p.poll() is None:
                        if (target/'PERMANENT-UNKNOWN.json').exists() or (target/'diagnostic.json').exists():
                            os.killpg(p.pid,signal.SIGTERM);break
                        time.sleep(.01)
                rc=p.wait()
            (target/'native-wait.json').write_text(json.dumps(dict(**info,exit=rc,actualWait=True,
                stdoutClosed=True,stderrClosed=True,outputMode='regular files; no pipe EOF claim',atWait=time.time())))
            if (target/'PERMANENT-UNKNOWN.json').exists() or rc!=0:return

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='watchdog':watchdog(float(sys.argv[2]))
    else:
        success=False
        try:run();success=True
        finally:
            for fd in list(OWN_FDS):close_owned(fd)
            if RUN.exists():save('runtime-release.json',dict(at=time.time(),supervisor=os.getpid(),success=success,
                ownDescriptorsClosed=True,originalStarted=ORIGINAL_STARTED,box=None))
