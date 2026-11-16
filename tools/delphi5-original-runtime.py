#!/usr/bin/env python3
"""Native qualification by default; --original is a separately assigned pipeline.

Never builds or changes shared outputs. Runtime sources and module are sealed
in memory; only Git identities, hashes and helper diffs persist in evidence.
"""
import base64, fcntl, hashlib, json, os, pathlib, re, signal, subprocess, sys, time

ROOT=pathlib.Path(__file__).resolve().parent.parent
RUN=pathlib.Path(os.environ.get('DELPHI5_RUN',ROOT/'scratch/runs/20261116-delphi5-native-controller-completion-repair'))
HEAD=subprocess.check_output(['git','rev-parse',os.environ.get('DELPHI5_GIT','HEAD')],cwd=ROOT).decode().strip()
OWN_FDS=set()
ORIGINAL_STARTED=False
MEDIA=ROOT/'test/binaries/candidates/delphi5-60day-eval'
ISO_SHA='bcd14e38635f4b3b4c7656f1ce884c26ba60224d7876681a7e3b7382e5c38b0e'

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
    names=[n for n in names if n.endswith(('.js','.cjs','.json','.wat','.watx')) and not n.startswith(('scratch/','test/binaries/'))]
    p=subprocess.Popen(['git','cat-file','--batch'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
    files={}
    for name in names:
        p.stdin.write((HEAD+':'+name+'\n').encode());p.stdin.flush()
        header=p.stdout.readline().split();assert len(header)==3 and header[1]==b'blob'
        files[name]=p.stdout.read(int(header[2]));assert p.stdout.read(1)==b'\n'
    p.stdin.close();assert p.wait()==0
    # All tracked code is supplied from one Git tree, including compiler and tests.
    # Only these owned helpers overlay Git; published process-desktop is untouched.
    for name in ('tools/delphi5-original-runtime.py','tools/delphi5-control.py','test/test-delphi5-after-desktop.cjs','test/run.js'):
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
        if (RUN/'native-wait.json').exists():
            save('watchdog-exit.json',dict(at=time.time(),reason='actual native wait'));return
        time.sleep(.05)
    info=json.loads((RUN/'native-pid.json').read_text())
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
        assert sha((MEDIA/'HDT50VB.iso').read_bytes())==ISO_SHA
        assert (MEDIA/'HDT50VB.iso').stat().st_size==81330176
    st=os.statvfs('/home');assert st.f_bavail*st.f_frsize>1500000000
    assert subprocess.run(['git','merge-base','--is-ancestor','c8f308b84',HEAD],cwd=ROOT).returncode==0
    files=sources()
    module=os.memfd_create('delphi5-module',os.MFD_ALLOW_SEALING)
    OWN_FDS.add(module)
    source=seal('delphi5-source',json.dumps(dict(root=str(ROOT),files={n:base64.b64encode(b).decode() for n,b in files.items()})).encode())
    patches=[]
    for name in ['tools/delphi5-original-runtime.py',
                 'tools/delphi5-control.py','test/test-delphi5-after-desktop.cjs','test/run.js']:
        tracked=subprocess.run(['git','cat-file','-e',HEAD+':'+name],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
        diff=subprocess.run(['git','diff','--binary',HEAD,'--',name] if tracked else
             ['git','diff','--no-index','--binary','--','/dev/null',name],cwd=ROOT,capture_output=True)
        assert diff.returncode in (0,1);patches.append(diff.stdout)
    (RUN/'owned-helpers.patch').write_bytes(b''.join(patches))
    if original:
        save('media.json',dict(iso=str(MEDIA/'HDT50VB.iso'),bytes=81330176,sha256=ISO_SHA,
             entry='D:\\INSTALL.EXE',files={str(p.relative_to(MEDIA/'media')):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in (MEDIA/'media').rglob('*') if p.is_file()}))
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
         'test/test-delphi5-original-install.cjs','test/test-delphi5-after-desktop.cjs','test/test-process-desktop-observation.js',
         'test/test-cli-native-scene-context.cjs','tools/delphi5-source-view.cjs','tools/delphi5-control.py','tools/delphi5-original-runtime.py')}
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
    checked('native-controller',['node','test/test-delphi5-after-desktop.cjs',str(RUN/'native-qualification')],env,(source,module))
    save('qualification.json',dict(passed=True,at=time.time(),originalStarted=False))
    if not original:
        close_owned(source);close_owned(module)
        save('runtime-release.json',dict(at=time.time(),ownDescriptorsClosed=True,box=None,originalStarted=False))
        return
    # Pause for the worker to personally inspect qualification evidence. No original restart.
    while not (RUN/'original-go.json').exists():time.sleep(.1)
    (RUN/'desktop-observations').mkdir(exist_ok=True)
    argv=['node','test/run.js','--exe='+str(MEDIA/'media/INSTALL.EXE'),'--exe-guest-path=D:\\INSTALL.EXE',
         '--cwd=D:\\','--vfs-drive=D','--vfs-include=**/*','--no-build',
         f'--wasm=/proc/{os.getpid()}/fd/{module}','--overlay-dir='+str(RUN/'guest-overlay'),
         '--reg-export='+str(RUN/'guest-registry.json'),'--spawn-processes','--threads',
         '--control=45761','--max-seconds=1200','--max-batches=1000000000','--stuck-after=0',
         '--real-ticks','--quiet-api','--quiet-blocks','--png-canvas',
         '--trace-api=LoadLibraryA,LoadLibraryExA,GetProcAddress,CreateProcessA,WinExec,ShellExecuteA,ExitProcess,HeapCreate,MakeCriticalSectionGlobal',
         '--trace-to=10000000',
         '--pipe-child-args=--control=45762 --png-canvas']
    started=time.time();deadline=started+1200
    w=subprocess.Popen([sys.executable,'-B',__file__,'watchdog',str(started+1220)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    while not (RUN/'watchdog-armed.json').exists():assert w.poll() is None;time.sleep(.01)
    save('launch.json',dict(args=argv,cwd=str(ROOT),at=started,deadline=deadline,gameplayCutoff=deadline-180,
        reserveSeconds=180,watchdogDeadline=started+1220,winIdentity='default Windows 98; no date override',supervisor=os.getpid()))
    with (RUN/'native.stdout.log').open('xb') as out,(RUN/'native.stderr.log').open('xb') as err:
        p=subprocess.Popen(argv,cwd=ROOT,env=env,pass_fds=(source,module),stdout=out,stderr=err,start_new_session=True)
        ORIGINAL_STARTED=True
        info=dict(pid=p.pid,startToken=token(p.pid),at=time.time());save('native-pid.json',info)
        rc=p.wait()
    save('native-wait.json',dict(**info,exit=rc,actualWait=True,stdoutClosed=True,stderrClosed=True,
         outputMode='regular files; no pipe EOF claim',waitAt=time.time()))
    a,b=w.communicate();save('watchdog-wait.json',dict(pid=w.pid,exit=w.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
    close_owned(source);close_owned(module)
    save('runtime-release.json',dict(at=time.time(),ownDescriptorsClosed=True,borrowedHolderUnchanged=True,
         supervisor=os.getpid(),nativeAbsent=not pathlib.Path(f'/proc/{p.pid}').exists(),watchdogAbsent=not pathlib.Path(f'/proc/{w.pid}').exists(),box=None))
if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='watchdog':watchdog(float(sys.argv[2]))
    else:
        success=False
        try:run();success=True
        finally:
            for fd in list(OWN_FDS):close_owned(fd)
            if RUN.exists() and not (RUN/'runtime-release.json').exists():
                save('runtime-release.json',dict(at=time.time(),supervisor=os.getpid(),success=success,
                     ownDescriptorsClosed=True,originalStarted=ORIGINAL_STARTED,box=None))
