#!/usr/bin/env python3
"""One Neverhood pipeline; all preparation and admission precede fixed clocks.

Git and explicit own patches recover source. Transient sealed memfds hold the
source pool, compiled module, guard and existing CD without archiving them.
"""
import pathlib, subprocess, sys, os, time, json, signal, threading, fcntl, hashlib, importlib.util, socket
ROOT=pathlib.Path(__file__).resolve().parent.parent
RUN=ROOT/'scratch/runs/20261116-neverhood-original-install-after-setupx'
PRELOAD='tools/disciples2-current-native-source-view.cjs'
HELPER='tools/disciples2-current-supervisor.py'
OWN=('tools/neverhood-original-current-runtime.py','tools/neverhood-original-current-control.py',
     'tools/neverhood-original-current-preflight.cjs','test/test-neverhood-original-current.cjs')
POLICY=dict(confirmationMs=500,physicalUpMs=1750,observationMs=3000,gameFreshnessSeconds=5,menuFreshnessSeconds=30)
def helper():
    spec=importlib.util.spec_from_file_location('published_sealing',ROOT/HELPER)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
H=helper()
def save(out,name,value):H.save(out,name,value)
def checked(out,name,args,env=None,timeout=240,pass_fds=()):
    p=subprocess.Popen(args,cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,pass_fds=pass_fds,start_new_session=True)
    timedout=False
    try:a,b=p.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        timedout=True;os.killpg(p.pid,signal.SIGKILL);a,b=p.communicate()
    (out/(name+'.stdout.log')).write_bytes(a);(out/(name+'.stderr.log')).write_bytes(b)
    save(out,name+'-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,args=args,timedOut=timedout,at=time.time()))
    assert p.returncode==0,name+': '+b.decode(errors='replace')[-3000:]
    return a
def prepare(out,revision,patches):
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
    deadline=time.time()+7200;save(out,'holder-deadline.json',dict(deadline=deadline,prearmed=True))
    while not (out/'stop.json').exists() and time.time()<deadline:time.sleep(.05)
    for fd in (source,preload,module,manifestfd,mediafd):os.close(fd)
    save(out,'holder-closed.json',dict(at=time.time(),descriptorsClosed=True))
def validate_recipe(recipe):
    assert recipe['seconds']==2400 and recipe['watchdogGrace']==20 and recipe['reserveSeconds']==240
    assert recipe['inputPolicy']==POLICY and recipe['childInheritance']=='sealed-node-v1'
    assert pathlib.Path(recipe['cwd']).resolve()==ROOT
    args=recipe['args'];assert args[:2]==['node','test/run.js']
    for flag in ('--iso-drive=D','--iso-exe=SETUP95.EXE','--max-seconds=2400','--real-ticks','--threads','--spawn-processes','--no-build'):
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
        '--no-build','--no-close','--spawn-processes','--threads','--real-ticks','--max-seconds=2400',
        '--max-batches=1000000000','--stuck-after=0','--control='+str(port),'--quiet-api','--quiet-blocks','--png-canvas',
        '--pipe-child-args=--control='+str(childport)+' --threads --real-ticks --png-canvas',
        '--vfs-mount='+str(ROOT/inputs['ne']['path'])+'=C:\\Windows\\System\\COMMCTRL.DLL',
        '--vfs-mount='+str(ROOT/inputs['setupx']['path'])+'=C:\\Windows\\System\\SETUPX.DLL',
        '--overlay-dir='+str(out/'guest-overlay'),'--overlay-flush-ms=0','--reg-export='+str(out/'guest-registry.json'),
        '--trace-api=ThunkConnect32,FT_Prolog,DirectXSetup,LoadLibraryA,GetProcAddress,CreateDialogParamA,DialogBoxParamA,MessageBoxA,CopyFileA,RegSetValueExA,CreateProcessA,ExitProcess']
    r=dict(cwd=str(ROOT),args=args,seconds=2400,watchdogGrace=20,reserveSeconds=240,inputPolicy=POLICY,
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
    assert not (RUN/'original-spawned.json').exists(),'one pipeline permanently consumed'
    start=time.time();deadline=start+2400
    w=subprocess.Popen([sys.executable,'-B',__file__,'watchdog',str(out),str(start+2420)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    while not (out/'watchdog-armed.json').exists():assert w.poll() is None;time.sleep(.01)
    port=int(next(a.split('=')[1] for a in args if a.startswith('--control=')))
    childport=int(next(a.split('--control=')[1].split()[0] for a in args if a.startswith('--pipe-child-args=')))
    save(out,'launch.json',dict(at=start,deadline=deadline,gameplayCutoff=deadline-240,reserveSeconds=240,rootPort=port,childPort=childport,args=args,clock='real-defaults',inputPolicy=POLICY))
    save(RUN,'original-spawned.json',dict(at=time.time(),ordinal=1,secondOriginalForbidden=True))
    p=subprocess.Popen(args,cwd=ROOT,env=env,pass_fds=fds,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    info=dict(pid=p.pid,startToken=H.token(p.pid),at=time.time());save(out,'native-pid.json',info)
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
    save(out,'native-wait.json',dict(**info,exit=rc,actualWait=True,stdoutEOF=eof.get('stdout',False),stderrEOF=eof.get('stderr',False),drainErrors=errors,atWait=time.time()))
    a,b=w.communicate();save(out,'watchdog-wait.json',dict(pid=w.pid,exit=w.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
    for fd in fds:os.close(fd)
    save(out,'runtime-closed.json',dict(at=time.time(),nativeExit=rc,watchdogExit=w.returncode,descriptorsClosed=True))
def main():
    mode=sys.argv[1];out=pathlib.Path(sys.argv[2]).resolve()
    if mode=='prepare':prepare(out,sys.argv[3],list(OWN) if '--owned-patches' in sys.argv else [])
    elif mode=='recipe':save(out,'recipe.json',recipe(pathlib.Path(sys.argv[3]),out))
    elif mode=='watchdog':H.watchdog(out,float(sys.argv[3]))
    elif mode in ('run','admit'):run(out,json.loads(pathlib.Path(sys.argv[3]).read_text()),mode=='admit')
    elif mode=='owner':
        p=subprocess.Popen([sys.executable,'-B',__file__,*sys.argv[3:]],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
        save(out,'wait-owner-child.json',dict(pid=p.pid,startToken=H.token(p.pid),owner=os.getpid()))
        a,b=p.communicate();(out/'owner.stdout.log').write_bytes(a);(out/'owner.stderr.log').write_bytes(b)
        save(out,'owner-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True))
    else:raise ValueError(mode)
if __name__=='__main__':main()
