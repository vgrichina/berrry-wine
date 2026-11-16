#!/usr/bin/env python3
"""Native qualification by default; --original is a separately assigned pipeline.

Never builds or changes shared outputs. Runtime sources and module are sealed
in memory; only Git identities, hashes and helper diffs persist in evidence.
"""
import base64, fcntl, hashlib, json, os, pathlib, re, signal, socket, subprocess, sys, time

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
    names=[n for n in names if n.endswith(('.js','.cjs','.json','.wat','.watx','.py')) and not n.startswith(('scratch/','test/binaries/'))]
    p=subprocess.Popen(['git','cat-file','--batch'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
    files={}
    for name in names:
        p.stdin.write((HEAD+':'+name+'\n').encode());p.stdin.flush()
        header=p.stdout.readline().split();assert len(header)==3 and header[1]==b'blob'
        files[name]=p.stdout.read(int(header[2]));assert p.stdout.read(1)==b'\n'
    p.stdin.close();assert p.wait()==0
    # All tracked code is supplied from one Git tree, including compiler and tests.
    # Only these owned helpers overlay Git; published process-desktop is untouched.
    for name in ('tools/vb5cce-original-runtime.py','test/test-vb5cce-original-current.cjs','tools/vb5cce-reviewed-control.py','test/run.js','lib/cli-native-scene.js','lib/cli-native-user-windows.js','src/13-exports.wat'):
        if name=='test/run.js' and '--baseline-paint' in sys.argv:continue
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
    original='--original' in sys.argv
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
    source=seal('delphi5-source',json.dumps(dict(root=str(ROOT),files={n:base64.b64encode(b).decode() for n,b in files.items()})).encode())
    patches=[]
    for name in ['tools/delphi5-original-runtime.py',
                 'tools/delphi5-control.py','test/test-delphi5-after-desktop.cjs','test/run.js','tools/vb5cce-original-runtime.py','test/test-vb5cce-original-current.cjs','tools/vb5cce-reviewed-control.py','lib/cli-native-scene.js','lib/cli-native-user-windows.js','src/13-exports.wat']:
        tracked=subprocess.run(['git','cat-file','-e',HEAD+':'+name],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
        diff=subprocess.run(['git','diff','--binary',HEAD,'--',name] if tracked else
             ['git','diff','--no-index','--binary','--','/dev/null',name],cwd=ROOT,capture_output=True)
        assert diff.returncode in (0,1);patches.append(diff.stdout)
    (RUN/'owned-helpers.patch').write_bytes(b''.join(patches))
    (RUN/'desktop-observations').mkdir(exist_ok=True)
    env=os.environ.copy();assert not env.get('NODE_OPTIONS')
    env.update(NODE_OPTIONS='--require='+str(ROOT/'tools/delphi5-source-view.cjs'),
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
    selected={n for n in files if n.startswith('lib/') or n in
        ('host.js','test/run.js','src/api_table.json','src/win16-ordinals.generated.json','fonts/substitutions.json',
         'test/test-vb5cce-original-current.cjs','test/test-delphi5-original-install.cjs','test/test-delphi5-after-desktop.cjs','test/test-process-desktop-observation.js',
         'test/test-cli-native-scene-context.cjs','tools/delphi5-source-view.cjs','tools/delphi5-control.py','tools/delphi5-original-runtime.py','tools/vb5cce-reviewed-control.py','test/test-disciples2-native-paint-binding.cjs')}
    pending=list(selected)
    while pending:
        name=pending.pop()
        for relative in re.findall(rb'require\([\'\"](\.[^\'\"]+)[\'\"]\)',files[name]):
            base=os.path.normpath(str(pathlib.Path(name).parent/relative.decode()))
            for suffix in ('','.js','.cjs','.json','/index.js'):
                dep=base+suffix
                if dep in files:
                    if dep not in selected:selected.add(dep);pending.append(dep)
                    break
    files={n:files[n] for n in sorted(selected)}
    close_owned(source)
    source=seal('delphi5-runtime-source',json.dumps(dict(root=str(ROOT),files={n:base64.b64encode(b).decode() for n,b in files.items()})).encode())
    env['DELPHI5_SOURCE_FD']=f'/proc/{os.getpid()}/fd/{source}'
    save('runtime-inputs.json',dict(gitSHA=HEAD,moduleSHA256=sha(body),moduleBytes=len(body),moduleSeals=15,sourceSeals=15,
         sources={n:sha(b) for n,b in files.items()},foreignWIPAdopted=False,
         recovery='Git plus owned-helpers.patch; exact compileClosure tailCalls and layout stamp',ownModuleDescriptor=module))
    if '--baseline-paint' in sys.argv:
        env['DELPHI5_NATIVE_MODES']='paint-queued-fault'
        checked('native-paint-baseline',['node','test/test-delphi5-after-desktop.cjs',str(RUN/'native-qualification')],env,(source,module),expected=1)
        save('baseline.json',dict(expectedFailure=True,unmodifiedGitHost=True,originalStarted=False))
        return
    # Real Worker regression before/after: only the before child reads the old receive.
    oldfiles=dict(files);oldfiles['lib/process-desktop.js']=subprocess.check_output(['git','show','c8f308b84^:lib/process-desktop.js'],cwd=ROOT)
    oldsource=seal('delphi5-before-source',json.dumps(dict(root=str(ROOT),files={n:base64.b64encode(b).decode() for n,b in oldfiles.items()})).encode())
    oldenv=dict(env,DELPHI5_SOURCE_FD=f'/proc/{os.getpid()}/fd/{oldsource}')
    checked('transport-before',['node','--test','--test-name-pattern=desktop receiver ignores','test/test-delphi5-original-install.cjs'],oldenv,(oldsource,module),expected=1)
    close_owned(oldsource)
    checked('transport-after',['node','--test','test/test-delphi5-original-install.cjs'],env,(source,module))
    checked('desktop-regression',['node','test/test-process-desktop-observation.js'],env,(source,module))
    checked('native-context-guards',['node','test/test-cli-native-scene-context.cjs','--unit'],env,(source,module))
    checked('native-controller',['node','test/test-vb5cce-original-current.cjs',str(RUN/'native-qualification')],env,(source,module))
    admission=json.loads((RUN/'native-qualification/vb-original-admission.json').read_text())
    save('qualification.json',dict(passed=admission['safeForVBOriginal'],generatedTestsPassed=True,
         admission=admission,at=time.time(),originalStarted=False))
    if not original:
        return
    assert admission['safeForVBOriginal'],admission['blocker']
    while not (RUN/'original-go.json').exists():time.sleep(.1)
    started=time.time();deadline=started+2400
    save('pipeline-launch.json',dict(at=started,deadline=deadline,watchdogDeadline=started+2420,
         reserveSeconds=240,gameplayCutoff=deadline-240,winver='nt4',secondPipeline=False))
    w=subprocess.Popen([sys.executable,'-B',__file__,'watchdog',str(started+2420)],
         stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    while not (RUN/'watchdog-armed.json').exists():assert w.poll() is None;time.sleep(.01)
    try:
        for stage in range(3):
            if stage:
                while not (RUN/f'stage-{stage}-go.json').exists():
                    if (RUN/'stop-pipeline.json').exists() or time.time()>=deadline-240:return
                    time.sleep(.05)
            assert time.time()<deadline-240
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
                 gameplayCutoff=deadline-240,reserveSeconds=240,rootPort=port,childPort=childport,winver='nt4')))
            with (target/'native.stdout.log').open('xb') as out,(target/'native.stderr.log').open('xb') as err:
                p=subprocess.Popen(argv,cwd=ROOT,env=env,pass_fds=(source,module),stdout=out,stderr=err,start_new_session=True)
                ORIGINAL_STARTED=True
                info=dict(pid=p.pid,startToken=token(p.pid),at=time.time())
                (target/'native-pid.json').write_text(json.dumps(info))
                (RUN/'current-native-pid.json').write_text(json.dumps(info))
                rc=p.wait()
            (target/'native-wait.json').write_text(json.dumps(dict(**info,exit=rc,actualWait=True,
                stdoutClosed=True,stderrClosed=True,outputMode='regular files; no pipe EOF claim',atWait=time.time())))
            if (target/'PERMANENT-UNKNOWN.json').exists() or rc!=0:return
    finally:
        save('pipeline-closed.json',dict(at=time.time(),originalStarted=ORIGINAL_STARTED))
        a,b=w.communicate(timeout=10)
        save('watchdog-wait.json',dict(pid=w.pid,exit=w.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,
            stdout=a.decode(),stderr=b.decode()))

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='watchdog':watchdog(float(sys.argv[2]))
    else:
        success=False
        try:run();success=True
        finally:
            for fd in list(OWN_FDS):close_owned(fd)
            if RUN.exists():save('runtime-release.json',dict(at=time.time(),supervisor=os.getpid(),success=success,
                ownDescriptorsClosed=True,originalStarted=ORIGINAL_STARTED,box=None))
