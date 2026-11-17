#!/usr/bin/env python3
"""One Neverhood pipeline; all preparation and admission precede fixed clocks.

Git and explicit own patches recover source. Transient sealed memfds hold the
source pool, compiled module, guard and existing CD without archiving them.
"""
import pathlib, subprocess, sys, os, time, json, signal, threading, fcntl, hashlib, importlib.util, socket, types, uuid
ROOT=pathlib.Path(__file__).resolve().parent.parent
RUN=pathlib.Path(os.environ.get('NEVERHOOD_RUN',ROOT/'scratch/runs/20261117-neverhood-published-loader-normal-install-room'))
PRIOR_RUN=ROOT/'scratch/runs/20261116-neverhood-original-install-after-setupx'
PRELOAD='tools/disciples2-current-native-source-view.cjs'
HELPER='tools/disciples2-current-supervisor.py'
OWN=('tools/neverhood-original-current-runtime.py','tools/neverhood-original-current-control.py',
     'tools/neverhood-original-current-preflight.cjs','test/test-neverhood-original-current.cjs',PRELOAD)
POLICY=dict(confirmationMs=500,physicalUpMs=1750,observationMs=3000,gameFreshnessSeconds=15,menuFreshnessSeconds=30)
def helper():
    # Shared sources can change while another worker owns them. Refuse those
    # bytes before executing them; only published helpers may be borrowed.
    bodies={}
    for name in (HELPER,):
        published=subprocess.check_output(['git','show','main:'+name],cwd=ROOT)
        assert (ROOT/name).read_bytes()==published,'unpublished borrowed helper: '+name
        bodies[name]=published
    spec=importlib.util.spec_from_file_location('published_sealing',ROOT/HELPER)
    m=importlib.util.module_from_spec(spec)
    exec(compile(bodies[HELPER],str(ROOT/HELPER),'exec'),m.__dict__)
    return m
H=helper()
# Python native fixtures spawn Python watchdogs and import their controllers.
# Keep those sources on the same inventory as their Node/CPUWorker children.
FROZEN_PYTHON=r'''
import hashlib,importlib.machinery,json,os,pathlib,subprocess,sys
root=pathlib.Path(os.environ['DISCIPLES2_ROOT']).resolve()
fd=os.open(os.environ['DISCIPLES2_SOURCE_FD'],os.O_RDONLY)
size=int.from_bytes(os.pread(fd,4,0),'little');index=os.pread(fd,size,4)
assert hashlib.sha256(index).hexdigest()==os.environ['DISCIPLES2_SOURCE_INDEX_SHA256']
rows={str(root/r['path']):r for r in json.loads(index)['files']}
def body(file):
 p=str(pathlib.Path(file).resolve())
 if not p.startswith(str(root)+'/'):return None
 # Python source checks also hash JS/CJS helpers. Those reads must see the
 # same inventoried bytes as Node, even when the live checkout has advanced.
 if p not in rows:
  assert not p.endswith('.py'),'unsealed Python source: '+p
  return None
 r=rows[p];b=os.pread(fd,r['size'],4+size+r['offset'])
 assert len(b)==r['size'] and hashlib.sha256(b).hexdigest()==r['sha256']
 return b
loader=importlib.machinery.SourceFileLoader
old_code=loader.get_code
def get_code(self,name):
 b=body(self.path)
 return compile(b,self.path,'exec') if b is not None else old_code(self,name)
loader.get_code=get_code
old_read=pathlib.Path.read_bytes
def read_bytes(self):
 b=body(self)
 return b if b is not None else old_read(self)
pathlib.Path.read_bytes=read_bytes
bootstrap=os.environ['NEVERHOOD_FROZEN_PYTHON']
def argv(args):
 if isinstance(args,(list,tuple)) and len(args)>1 and pathlib.Path(str(args[0])).name.startswith('python'):
  i=1
  while i<len(args) and args[i] in ('-B','-u'):i+=1
  if i<len(args) and str(args[i]).endswith('.py') and str(pathlib.Path(args[i]).resolve()).startswith(str(root)+'/'):
   return [*args[:i],'-c',bootstrap,*args[i:]]
 return args
Popen=subprocess.Popen
class FrozenPopen(Popen):
 def __init__(self,args,*a,**k):super().__init__(argv(args),*a,**k)
subprocess.Popen=FrozenPopen
file=str(pathlib.Path(sys.argv[1]).resolve());sys.argv=sys.argv[1:];sys.argv[0]=file
namespace=dict(__name__='__main__',__file__=file,__package__=None)
exec(compile(body(file),file,'exec'),namespace)
'''
def save(out,name,value):H.save(out,name,value)
def arm_desktop_observations(out,env):
    directory=(out/'desktop-participants').resolve()
    directory.mkdir()
    env['WINE_PROCESS_DESKTOP_OBSERVE']=str(directory)
    save(out,'desktop-observation-armed.json',dict(at=time.time(),directory=str(directory),
        beforeNativeSpawn=True,environment='WINE_PROCESS_DESKTOP_OBSERVE',timeoutMs=3000,
        boundedWorkerLocalRecords=True,diagnosticsOnly=True))
    return directory
def checked(out,name,args,env=None,timeout=240,pass_fds=()):
    if env and env.get('DISCIPLES2_PHASE')=='runtime' and pathlib.Path(args[0]).name.startswith('python') and args[2].endswith('.py'):
        env=dict(env,NEVERHOOD_FROZEN_PYTHON=FROZEN_PYTHON)
        args=[*args[:2],'-c',FROZEN_PYTHON,*args[2:]]
    p=subprocess.Popen(args,cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,pass_fds=pass_fds,start_new_session=True)
    timedout=False
    try:a,b=p.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        timedout=True;os.killpg(p.pid,signal.SIGKILL);a,b=p.communicate()
    (out/(name+'.stdout.log')).write_bytes(a);(out/(name+'.stderr.log')).write_bytes(b)
    save(out,name+'-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,args=args,timedOut=timedout,at=time.time()))
    assert p.returncode==0,name+': '+b.decode(errors='replace')[-3000:]
    return a
def prepare(out,revision,patches,hold=True):
    out.mkdir();assert not os.environ.get('NODE_OPTIONS')
    assert H.git(ROOT,'rev-parse',revision+'^{commit}').decode().strip()==revision
    assert subprocess.run(['git','merge-base','--is-ancestor',revision,'main'],cwd=ROOT).returncode==0
    names=sorted(n for n in H.git(ROOT,'ls-tree','-r','--name-only',revision).decode().splitlines()
        if H.selected(n) or (n.startswith('test/helpers/') and n.endswith(('.js','.cjs','.json','.py'))))
    bodies={};p=subprocess.Popen(['git','cat-file','--batch'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
    for n in names:
        p.stdin.write((revision+':'+n+'\n').encode());p.stdin.flush();header=p.stdout.readline().split()
        assert header[1]==b'blob';bodies[n]=p.stdout.read(int(header[2]));assert p.stdout.read(1)==b'\n'
    p.stdin.close();assert p.wait()==0
    diffs=[]
    for n in patches:
        assert n in OWN,'only owned patches allowed'
        bodies[n]=(ROOT/n).read_bytes()
        d=subprocess.run(['git','diff','--binary',revision,'--',n] if n in names else ['git','diff','--no-index','--binary','--','/dev/null',n],cwd=ROOT,capture_output=True)
        assert d.returncode in (0,1) and not d.stderr;diffs.append(d.stdout)
    (out/'runtime-source.patch').write_bytes(b''.join(diffs))
    inputs=json.loads((RUN/'media-preflight.json').read_text())['inputs']
    for k,row in inputs.items():
        if k=='iso':continue
        body=(ROOT/row['path']).read_bytes();assert H.digest(body)==row['sha256'] and len(body)==row['size']
        bodies[row['path']]=body
    for p in (ROOT/'node_modules/pngjs').rglob('*'):
        if p.is_file() and p.suffix in ('.js','.json'):bodies[str(p.relative_to(ROOT))]=p.read_bytes()
    pool,index,rows=H.indexed_sources(bodies)
    source=H.seal('neverhood-sources',pool);preload=H.seal('neverhood-preload',bodies[PRELOAD])
    raw=os.memfd_create('neverhood-compile',os.MFD_ALLOW_SEALING)
    env=dict(os.environ,DISCIPLES2_ROOT=str(ROOT),DISCIPLES2_SOURCE_FD=f'/proc/{os.getpid()}/fd/{source}',
        DISCIPLES2_SOURCE_SHA256=H.digest(pool),DISCIPLES2_SOURCE_INDEX_SHA256=H.digest(index),DISCIPLES2_PHASE='compile',COMPILE_FD=str(raw))
    code="const c=require('./tools/watx-closure'),h=require('./tools/region-layout-hash');const r=c.compileClosure(c.watxSourceClosure(),{tailCalls:true});if(!r.success)throw Error(r.error);require('fs').writeFileSync(Number(process.env.COMPILE_FD),h.appendSection(Buffer.from(r.wasmBinary),h.layoutHash(r.regions.regions)));"
    prepath=f'/proc/{os.getpid()}/fd/{preload}'
    checked(out,'compile',['node','--preserve-symlinks','--require',prepath,'-e',code],env,pass_fds=(raw,))
    os.lseek(raw,0,0);module=H.seal('neverhood-module',os.read(raw,10000000));os.close(raw)
    modulebytes=pathlib.Path(f'/proc/{os.getpid()}/fd/{module}').read_bytes()
    manifest=dict(version=1,gitSHA=revision,patchSHA256=H.digest(b''.join(diffs)),sourceSHA256=H.digest(pool),moduleSHA256=H.digest(modulebytes),
        preloadSHA256=H.digest(bodies[PRELOAD]),sourceIndexSHA256=H.digest(index),sources=rows,installedInputs=list(inputs.values()),foreignWIPAdopted=False)
    encoded=json.dumps(manifest,sort_keys=True,separators=(',',':')).encode();manifestfd=H.seal('neverhood-manifest',encoded)
    media=(ROOT/inputs['iso']['path']).read_bytes();assert H.digest(media)==inputs['iso']['sha256'] and len(media)==inputs['iso']['size']
    mediafd=H.seal('neverhood-existing-cd',media);del media
    holder=dict(pid=os.getpid(),startToken=H.token(os.getpid()),sealed=15,manifestSHA256=H.digest(encoded),
        sourcePath=f'/proc/{os.getpid()}/fd/{source}',fdPath=f'/proc/{os.getpid()}/fd/{module}',preloadPath=prepath,
        manifestPath=f'/proc/{os.getpid()}/fd/{manifestfd}',mediaPath=f'/proc/{os.getpid()}/fd/{mediafd}',mediaSHA256=inputs['iso']['sha256'])
    save(out,'manifest.json',manifest);save(out,'holder.json',holder)
    (out/'module.wasm').write_bytes(modulebytes)
    if not hold:return (source,preload,module,manifestfd,mediafd)
    deadline=time.time()+7200;save(out,'holder-deadline.json',dict(deadline=deadline,prearmed=True))
    while not (out/'stop.json').exists() and time.time()<deadline:time.sleep(.05)
    for fd in (source,preload,module,manifestfd,mediafd):os.close(fd)
    save(out,'holder-closed.json',dict(at=time.time(),descriptorsClosed=True))
def validate_recipe(recipe):
    assert recipe['seconds']==900 and recipe['watchdogGrace']==20 and recipe['reserveSeconds']==90
    assert recipe['inputPolicy']==POLICY and recipe['childInheritance']=='sealed-node-v1'
    assert pathlib.Path(recipe['cwd']).resolve()==ROOT
    args=recipe['args'];assert args[:2]==['node','test/run.js']
    for flag in ('--iso-drive=D','--iso-exe=SETUP95.EXE','--max-seconds=900','--real-ticks','--threads','--spawn-processes','--no-build'):
        assert flag in args,flag
    assert sum(a.startswith('--iso=') for a in args)==1
    for prefix in ('--tick-ms-per-batch','--winver','--force-host','--input=','--reg-import','--args='):
        assert not any(a.startswith(prefix) for a in args),'unqualified original option '+prefix
    assert recipe.get('originalPipelineOrdinal')==1
def recipe(holderdir,out):
    holder=json.loads((holderdir/'holder.json').read_text());manifest=json.loads((holderdir/'manifest.json').read_text())
    with socket.socket() as reservation:
        reservation.bind(('127.0.0.1',0));port=reservation.getsockname()[1]
    with socket.socket() as reservation:
        reservation.bind(('127.0.0.1',0));childport=reservation.getsockname()[1]
    assert port!=childport
    inputs=json.loads((RUN/'media-preflight.json').read_text())['inputs']
    args=['node','test/run.js','--iso='+str(ROOT/inputs['iso']['path']),'--iso-drive=D','--iso-exe=SETUP95.EXE',
        '--no-build','--no-close','--spawn-processes','--threads','--real-ticks','--max-seconds=900',
        '--max-batches=1000000000','--stuck-after=0','--control='+str(port),'--quiet-api','--quiet-blocks','--png-canvas',
        '--pipe-child-args=--control='+str(childport)+' --threads --real-ticks --png-canvas',
        '--vfs-mount='+str(ROOT/inputs['ne']['path'])+'=C:\\Windows\\System\\COMMCTRL.DLL',
        '--vfs-mount='+str(ROOT/inputs['setupx']['path'])+'=C:\\Windows\\System\\SETUPX.DLL',
        '--native-exit-receipt='+str(out/'native-exit.json'),'--native-invocation-token='+str(uuid.uuid4()),
        '--overlay-dir='+str(out/'guest-overlay'),'--overlay-flush-ms=0','--reg-export='+str(out/'guest-registry.json'),
        '--trace-api=ThunkConnect32,FT_Prolog,DirectXSetup,LoadLibraryA,GetProcAddress,CreateDialogParamA,DialogBoxParamA,MessageBoxA,CopyFileA,RegSetValueExA,CreateProcessA,ExitProcess']
    r=dict(cwd=str(ROOT),args=args,seconds=900,watchdogGrace=20,reserveSeconds=90,inputPolicy=POLICY,
        childInheritance='sealed-node-v1',originalPipelineOrdinal=1,moduleHolder=str(holderdir/'holder.json'),
        immutableManifest={k:manifest[k] for k in ('gitSHA','sourceSHA256','moduleSHA256','preloadSHA256')})
    r['immutableManifest']['manifestSHA256']=holder['manifestSHA256'];validate_recipe(r)
    return r
def admit(out,recipe):
    fds=()
    try:
        validate_recipe(recipe)
        env,fds=H.frozen_inputs(out,recipe)
        holder=json.loads(pathlib.Path(recipe['moduleHolder']).read_text())
        media=H.holder_bytes(holder,'mediaPath');assert H.digest(media)==holder['mediaSHA256']=='94de724bb47eb2aa588ac4eff28ddc6fd10edebcf2be4dd131ef76875ef5ffd3'
        mediafd=H.seal('neverhood-admitted-cd',media);fds+= (mediafd,);del media
        manifest=json.loads((out/'runtime-inputs.json').read_text());pins={r['path']:r['sha256'] for r in manifest['sources']}
        for n in (HELPER,*OWN):assert H.digest((ROOT/n).read_bytes())==pins[n],'executed helper/source mismatch: '+n
        # The exact published guard is part of the sealed source inventory.
        guard=(ROOT/'tools/neverhood-setupx-stop.cjs').read_bytes();assert H.digest(guard)==pins['tools/neverhood-setupx-stop.cjs']
        guardfd=H.seal('neverhood-guard',guard);fds+=(guardfd,)
        env['NEVERHOOD_EVIDENCE_DIR']=str(out)
        env['WINE_COM_PROTOCOL_DIR']=str(out/'children')
        arm_desktop_observations(out,env)
        env['NODE_OPTIONS']+=' --require='+f'/proc/{os.getpid()}/fd/{guardfd}'
        H.inheritance_probe(out,recipe,env)
        args=[('--iso='+f'/proc/{os.getpid()}/fd/{mediafd}') if a.startswith('--iso=') else a for a in recipe['args']]
        save(out,'admission.json',dict(passed=True,at=time.time(),originalSpawned=False,inputPolicy=POLICY,mediaSHA256=holder['mediaSHA256'],
            childInheritance='sealed-node-v1',manifestSHA256=holder['manifestSHA256'],args=args,allInputsPreparedBeforeClock=True))
        return env,fds,args
    except BaseException as e:
        for fd in fds:os.close(fd)
        save(out,'prelaunch-refusal.json',dict(error=str(e),originalLaunched=False,anyNativeOrWatchdogChild=False,at=time.time()))
        raise
def run(out,recipe,only_admit=False):
    out.mkdir(exist_ok=True);env,fds,args=admit(out,recipe)
    if only_admit:
        for fd in fds:os.close(fd)
        return
    assert not (RUN/'original-spawned.json').exists(), 'one current pipeline permanently consumed'
    start=time.time();deadline=start+900
    w=subprocess.Popen([sys.executable,'-B',__file__,'watchdog',str(out),str(start+920)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    while not (out/'watchdog-armed.json').exists():assert w.poll() is None;time.sleep(.01)
    port=int(next(a.split('=')[1] for a in args if a.startswith('--control=')))
    childport=int(next(a.split('--control=')[1].split()[0] for a in args if a.startswith('--pipe-child-args=')))
    save(out,'launch.json',dict(at=start,deadline=deadline,gameplayCutoff=deadline-90,reserveSeconds=90,rootPort=port,childPort=childport,args=args,clock='real-defaults',inputPolicy=POLICY))
    save(RUN,'original-spawned.json',dict(at=time.time(),ordinal=1,secondOriginalForbidden=True))
    p=subprocess.Popen(args,cwd=ROOT,env=env,pass_fds=fds,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    info=dict(pid=p.pid,startToken=H.token(p.pid),at=time.time(),
        invocationToken=next(a.split('=',1)[1] for a in args if a.startswith('--native-invocation-token=')),
        bootId=pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip());save(out,'native-pid.json',info)
    eof={};errors=[]
    def drain(pipe,name):
        try:
            with (out/('native.'+name+'.log')).open('xb') as f:
                while b:=pipe.read1(65536):f.write(b);f.flush()
            eof[name]=True
        except BaseException as e:errors.append(repr(e))
    threads=[threading.Thread(target=drain,args=(p.stdout,'stdout')),threading.Thread(target=drain,args=(p.stderr,'stderr'))]
    for t in threads:t.start()
    sent=False
    while p.poll() is None:
        if (out/'cancel-request.json').exists() and not sent:
            H.kill_owned(info,signal.SIGTERM);sent=True;save(out,'host-cancellation.json',dict(at=time.time(),nativeQuit=False))
        time.sleep(.02)
    rc=p.wait()
    for t in threads:t.join()
    save(out,'native-wait.json',dict(**info,exit=rc,actualWait=True,stdoutEOF=eof.get('stdout',False),stderrEOF=eof.get('stderr',False),drainErrors=errors,atWait=time.time(),atWaitMono=time.monotonic(),disposition='normal' if rc>=0 else 'signal'))
    a,b=w.communicate();save(out,'watchdog-wait.json',dict(pid=w.pid,exit=w.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
    for fd in fds:os.close(fd)
    save(out,'runtime-closed.json',dict(at=time.time(),nativeExit=rc,watchdogExit=w.returncode,descriptorsClosed=True))
def published(name,revision):
    body=H.git(ROOT,'show',revision+':'+name)
    assert (ROOT/name).read_bytes()==body,'unpublished borrowed/executed helper: '+name
    m=types.ModuleType(name.replace('/','_'));m.__file__=str(ROOT/name)
    exec(compile(body,m.__file__,'exec'),m.__dict__)
    return m

def supervised(out,fixture=False,working=False):
    out.mkdir(parents=True,exist_ok=True)
    revision=H.git(ROOT,'rev-parse',os.environ.get('NEVERHOOD_PINNED_REVISION','HEAD')).decode().strip()
    if not working:
        assert subprocess.run(['git','merge-base','--is-ancestor',revision,'origin/main'],cwd=ROOT).returncode==0,'selected preparation must be published on main'
    assert not working or fixture,'unpublished code allowed only for authored fixture'
    own_revision=os.environ.get('NEVERHOOD_PUBLISHED_HELPERS_REVISION',revision)
    if not working:
        assert H.git(ROOT,'rev-parse',own_revision+'^{commit}').decode().strip()==own_revision
        assert subprocess.run(['git','merge-base','--is-ancestor',own_revision,'origin/main'],cwd=ROOT).returncode==0
    for name in OWN:
        if not working:assert (ROOT/name).read_bytes()==H.git(ROOT,'show',own_revision+':'+name)
    save(out,'preparation-published-main.json',dict(gitSHA=revision,workingAuthoredOnly=working,at=time.time(),
        originMain=H.git(ROOT,'rev-parse','origin/main').decode().strip(),publishedHelpersRevision=own_revision,
        policy='published main ancestor plus explicit published owned helpers, immutable through later publication'))
    (out/'excluded-working-tree.patch').write_bytes(H.git(ROOT,'diff','--binary',revision,'--','src','lib','tools','host.js','test/run.js'))
    m=published('tools/gltron-current-supervise.py',revision)
    published('tools/boids-current-supervise.py',revision)
    command=[sys.executable,'-B',__file__,'pipeline',str(out),revision]
    if fixture:command.append('--fixture')
    if working:command.append('--owned-patches')
    return m.ParentProcessSupervisor(out/'outer',command,preparation=600,runtime=900,
        preparation_watchdog=620,runtime_watchdog=920,grace=5).run()

def material_native_pins(inputs):
    return {row['path']:row['sha256'] for row in inputs['sources']
        if row['path'].startswith(('src/','lib/','tools/vb5')) or row['path'] in ('host.js',PRELOAD)
        or (row['path'].startswith('test/') and row['path'] not in OWN)}

def reuse_native_proof(out,revision,module):
    prior=pathlib.Path(os.environ.get('NEVERHOOD_NATIVE_PROOF',ROOT/'scratch/runs/20261117-vb5-native-modal-continuation-fence-repair/published-final'))
    proof=json.loads((prior/'complete-native-qualification.json').read_text())
    assert proof['passed'] and proof['nativeProtocolAndFullRegression']
    if 'materialSourcePins' in proof:
        current=material_native_pins(json.loads((out/'runtime-inputs.json').read_text()))
        if current==proof['materialSourcePins'] and H.digest(module)==proof['moduleSHA256']:
            save(out,'matching-native-proof.json',dict(passed=True,proof=str(prior/'complete-native-qualification.json'),
                proofSHA256=H.digest((prior/'complete-native-qualification.json').read_bytes()),
                proofGitSHA=proof['gitSHA'],preparedGitSHA=revision,moduleSHA256=H.digest(module),
                comparedPaths=len(current),sameMaterialSources=True))
            return True
        save(out,'prior-native-proof-mismatch.json',dict(changedPaths=sorted(n for n in set(current)|set(proof['materialSourcePins']) if current.get(n)!=proof['materialSourcePins'].get(n)),originalStarted=False))
        return False
    # Full runtime source equality makes the native main/CPUWorker/modal proofs
    # applicable. A materially changed source fails; it is never silently waived.
    names=sorted(set(H.git(ROOT,'ls-tree','-r','--name-only',proof['gitSHA']).decode().splitlines())|set(H.git(ROOT,'ls-tree','-r','--name-only',revision).decode().splitlines()))
    names=[n for n in names if (n.startswith(('src/','lib/')) or n in ('test/run.js','test/test-vb5-normal-exit-native.cjs','test/test-vb5-native-dialog-identity.cjs','test/test-vb5-nested-owned-modal.cjs','test/test-vb5-modal-invocation-fence.cjs','test/test-vb5-installed-native.cjs','test/test-vb5-native-progress.cjs','test/test-vb5cce-original-current.cjs')) and n.endswith(('.wat','.watx','.js','.cjs','.json','.py'))]+['host.js']
    changed=H.git(ROOT,'diff','--name-only',proof['gitSHA'],revision,'--',*names).decode().splitlines()
    if changed or H.digest(module)!=proof['moduleSHA256']:
        save(out,'prior-native-proof-mismatch.json',dict(changedPaths=changed,priorModuleSHA256=proof['moduleSHA256'],preparedModuleSHA256=H.digest(module),originalStarted=False))
        return False
    save(out,'matching-native-proof.json',dict(passed=True,proof=str(prior/'complete-native-qualification.json'),
        proofSHA256=H.digest((prior/'complete-native-qualification.json').read_bytes()),
        proofGitSHA=proof['gitSHA'],preparedGitSHA=revision,moduleSHA256=H.digest(module),
        comparedPaths=len(names),changedPaths=changed,scope='full native owner/refusal/focus/nested/modal/lifecycle main/CPUWorker/OSchild'))
    return True

def qualify_native(out,revision,module,env,fds):
    if reuse_native_proof(out,revision,module):return
    # VB's controller has a map-shaped helper manifest. Keep that adapter in
    # its own fixture directory; Neverhood's authenticated manifest is a list.
    native=out/'native-protocol';native.mkdir()
    inputs=json.loads((out/'runtime-inputs.json').read_text())
    save(native,'runtime-inputs.json',dict(**{k:v for k,v in inputs.items() if k!='sources'},
        sources={row['path']:row['sha256'] for row in inputs['sources']}))
    # Changed native graph: exercise the relevant actual USER routes, including
    # worker ownership, modal nesting, refusal, physical release and real exit.
    tests=[('modal-fence',['node','test/test-vb5-modal-invocation-fence.cjs',str(native/'modal-fence')]),
           ('normal-exit',['python3','-B','test/test-vb5-normal-exit-completion.py',str(native/'normal-exit')]),
           ('shutdown',['python3','-B','test/test-vb5-runtime-shutdown.py',str(native/'shutdown')]),
           ('nested-owned',['node','test/test-vb5-nested-owned-modal.cjs',str(native/'nested-owned')]),
           ('native-dialog',['node','test/test-vb5-native-dialog-identity.cjs',str(native/'native-dialog')]),
           ('native-vb-controller',['node','test/test-vb5cce-original-current.cjs',str(native/'native-vb-controller')]),
           ('native-pointer',['node','test/test-cli-native-pointer-coordinates.cjs','--native',str(native/'native-pointer')])]
    for label,args in tests:
        partial=os.environ.get('NEVERHOOD_NATIVE_PARTIAL')
        if partial:
            previous=pathlib.Path(partial);wait=previous/(label+'-wait.json')
            old=json.loads((previous/'runtime-inputs.json').read_text())
            if wait.exists() and material_native_pins(old)==material_native_pins(inputs) and old['moduleSHA256']==H.digest(module):
                result=json.loads(wait.read_text())
                if result['exit']==0 and all(result[k] for k in ('actualWait','stdoutEOF','stderrEOF')):
                    save(out,label+'-reused.json',dict(passed=True,priorWait=str(wait),priorWaitSHA256=H.digest(wait.read_bytes()),matchingMaterialSources=True,moduleSHA256=H.digest(module)))
                    continue
        checked(out,label,args,env,timeout=240,pass_fds=fds)
    admission=json.loads((native/'native-vb-controller/vb-original-admission.json').read_text())
    assert admission['safeForVBOriginal'],admission
    save(out,'complete-native-qualification.json',dict(passed=True,gitSHA=revision,moduleSHA256=H.digest(module),
        materialSourcePins=material_native_pins(inputs),
        nativeProtocolAndFullRegression=True,originalStarted=False,tests=[label for label,_ in tests],
        scope='native CLI USER owner/refusal/focus/modal/nested/lifecycle main/CPUWorker/OSchild; excludes unrelated browser GL'))

def pipeline(out,revision,fixture=False,working=False):
    global RUN
    RUN=out
    st=os.statvfs('/home');assert st.f_bavail*st.f_frsize>1500000000
    pre=checked(out,'media-preflight',['node','tools/neverhood-original-current-preflight.cjs'])
    (out/'media-preflight.json').write_bytes(pre)
    own_revision=os.environ.get('NEVERHOOD_PUBLISHED_HELPERS_REVISION',revision)
    if not working:
        assert H.git(ROOT,'rev-parse',own_revision+'^{commit}').decode().strip()==own_revision
        assert subprocess.run(['git','merge-base','--is-ancestor',own_revision,'origin/main'],cwd=ROOT).returncode==0
        for name in OWN:assert (ROOT/name).read_bytes()==H.git(ROOT,'show',own_revision+':'+name)
    save(out,'published-helper-composition.json',dict(baseGitSHA=revision,publishedHelpersRevision=own_revision,
        ownedPaths=list(OWN),workingAuthoredOnly=working,wholeGraphEqualityClaimed=False))
    held=prepare(out/'prepared',revision,list(OWN) if working or own_revision!=revision else [],hold=False)
    qualified=out/'qualification';qualified.mkdir()
    r=recipe(out/'prepared',out)
    env,fds=H.frozen_inputs(qualified,r)
    env.update(DELPHI5_MODULE_FD=env['DISCIPLES2_MODULE_FD'],DELPHI5_SOURCE_FD=env['DISCIPLES2_SOURCE_FD'],
        DELPHI5_MODULE_SHA256=env['DISCIPLES2_MODULE_SHA256'],NEVERHOOD_FROZEN_PYTHON=FROZEN_PYTHON)
    try:
        H.inheritance_probe(qualified,r,env)
        module=H.holder_bytes(json.loads((out/'prepared/holder.json').read_text()),'fdPath')
        qualify_native(qualified,revision,module,env,fds)
        arm_desktop_observations(qualified,env)
        checked(qualified,'desktop-participants',['node','test/test-neverhood-original-current.cjs','--desktop-participants'],env,timeout=40,pass_fds=fds)
        for label,args in [('controller-unit',['node','test/test-neverhood-original-current.cjs','--unit']),
                           ('provenance',['node','test/test-neverhood-original-current.cjs','--installed-provenance']),
                           ('native-controller',['node','test/test-neverhood-original-current.cjs',str(qualified/'native-controller')])]:
            checked(qualified,label,args,env,timeout=180,pass_fds=fds)
        save(qualified,'qualification.json',dict(passed=True,gitSHA=revision,moduleSHA256=H.digest(module),originalStarted=False))
    finally:
        for fd in fds:os.close(fd)
    if fixture:
        save(out/'outer','prepared.json',dict(authoredOnly=True,compiledAndQualified=True))
        while not (out/'outer/runtime-start.json').exists():time.sleep(.005)
    else:
        # Rehash every CD member immediately before the fixed clocks.
        final=checked(out,'preclock-media',['node','tools/neverhood-original-current-preflight.cjs'])
        assert json.loads(final)==json.loads(pre)
        for ref in ('HEAD','origin/main'):
            assert subprocess.run(['git','merge-base','--is-ancestor',revision,ref],cwd=ROOT).returncode==0
        save(out/'outer','prepared.json',dict(compiledAndQualified=True,fullRecursiveMediaBeforeClock=True))
        while not (out/'outer/runtime-start.json').exists():time.sleep(.005)
        save(out,'recipe.json',r)
        run(out,r)
    for fd in held:os.close(fd)
    save(out,'holder-closed.json',dict(at=time.time(),descriptorsClosed=True))

def main():
    mode=sys.argv[1];out=pathlib.Path(sys.argv[2]).resolve()
    if mode=='supervised':return supervised(out,'--fixture' in sys.argv,'--owned-patches' in sys.argv)
    elif mode=='pipeline':pipeline(out,sys.argv[3],'--fixture' in sys.argv,'--owned-patches' in sys.argv)
    elif mode=='prepare':prepare(out,sys.argv[3],list(OWN) if '--owned-patches' in sys.argv else [])
    elif mode=='recipe':save(out,'recipe.json',recipe(pathlib.Path(sys.argv[3]),out))
    elif mode=='watchdog':H.watchdog(out,float(sys.argv[3]))
    elif mode in ('run','admit'):run(out,json.loads(pathlib.Path(sys.argv[3]).read_text()),mode=='admit')
    elif mode=='owner':
        p=subprocess.Popen([sys.executable,'-B',__file__,*sys.argv[3:]],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
        save(out,'wait-owner-child.json',dict(pid=p.pid,startToken=H.token(p.pid),owner=os.getpid()))
        a,b=p.communicate();(out/'owner.stdout.log').write_bytes(a);(out/'owner.stderr.log').write_bytes(b)
        save(out,'owner-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True))
    else:raise ValueError(mode)
if __name__=='__main__':sys.exit(main())
