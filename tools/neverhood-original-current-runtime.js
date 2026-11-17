#!/usr/bin/env node
'use strict';
/* One Neverhood pipeline; all preparation and admission precede fixed clocks.

Git and explicit own patches recover source. Transient sealed descriptors hold
the source pool, compiled module, guard and existing CD without archiving them.

Node port of the former tools/neverhood-original-current-runtime.py: same CLI
modes, environment, evidence files (seconds-based timestamps) and exit codes.
Module state (RUN) and functions are module.exports properties, called through
it, so callers may substitute them as the Python tests did.

Platform notes (no Node API exists for these Linux kernel features):
 - memfd/F_ADD_SEALS sealing is the borrowed disciples2 helper's seal(); this
   file only names the descriptors (/proc/<pid>/fd/N on Linux, /dev/fd/N with
   the descriptor passed at the same number elsewhere).
 - pidfd_open/poll -> poll the pinned start token every 20ms.
 - prctl PDEATHSIG: Node never arms a parent-death signal for its children,
   so the inherited value is recorded as 0 and nothing needs clearing.
 - The Python FROZEN_PYTHON bootstrap is gone: there are no Python children.
   Node children keep the sealed inventory through the preload's own
   Worker/child_process inheritance checks. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const cp=require('node:child_process'),net=require('node:net'),assert=require('node:assert'),{isDeepStrictEqual}=require('node:util');
const Module=require('node:module');
const proc=require('./native-proc.cjs');
const M=module.exports;
const now=proc.now,sleep=proc.sleep;
const eq=(a,b)=>isDeepStrictEqual(a,b);
const exists=p=>fs.existsSync(p);
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const ROOT=path.resolve(__dirname,'..');
M.ROOT=ROOT;
M.RUN=path.resolve(process.env.NEVERHOOD_RUN||path.join(ROOT,'scratch/runs/20261117-neverhood-published-loader-normal-install-room'));
M.PRIOR_RUN=path.join(ROOT,'scratch/runs/20261116-neverhood-original-install-after-setupx');
const PRELOAD='tools/disciples2-current-native-source-view.cjs';
const HELPER='tools/disciples2-current-supervisor.cjs';
M.PRELOAD=PRELOAD;M.HELPER=HELPER;
const OWN=['tools/neverhood-original-current-runtime.js','tools/neverhood-original-current-control.js',
  'tools/neverhood-original-current-preflight.cjs','test/test-neverhood-original-current.cjs',PRELOAD,'test/run.js',
  'tools/neverhood-installed-shortcut.cjs','test/test-neverhood-installed-shortcut.cjs',
  'lib/readonly-media-context.js','test/test-cli-iso-child-context.cjs',
  'lib/cli-child-observation.js','test/test-cli-child-observation.cjs','test/test-neverhood-child-handoff.cjs',
  'tools/native-proc.cjs'];
M.OWN=OWN;
const POLICY={confirmationMs:500,physicalUpMs:1750,observationMs:3000,gameFreshnessSeconds:15,menuFreshnessSeconds:30};
M.POLICY=POLICY;
// Exact reviewed runner delta. Its new path is qualified by real native child
// tests below; unchanged core libraries retain their historical qualification.
const CHILD_RUNNER_SHA256='4aaf21a17ba0fe3cc8aa013d35332fd1af2a2a22fb8ed7dda0670af4215629fd';
const CHILD_RUNNER_BASE='d4b41d4015bb0b5a066bfa01c82a00df741893c0';
const WAIT_RUNNER_BASE='d97dc35ad63c75abe188b14745439325c5197020';
const WAIT_RUNNER_SHA256='96cf0a27a3af9fffc201377ae66376cefdee490f34dfd49c707572f004fa378d';
Object.assign(M,{CHILD_RUNNER_SHA256,CHILD_RUNNER_BASE,WAIT_RUNNER_BASE,WAIT_RUNNER_SHA256});

const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
M.digest=digest;
function git(...args){return cp.execFileSync('git',args,{cwd:ROOT,maxBuffer:1<<30,stdio:['ignore','pipe','pipe']});}
M.git=git;
const isAncestor=(rev,ref)=>cp.spawnSync('git',['merge-base','--is-ancestor',rev,ref],{cwd:ROOT,stdio:'ignore'}).status===0;
// Named descriptor path a child (given the same fd number) can open.
const fdPath=fd=>proc.linux?`/proc/${process.pid}/fd/${fd}`:`/dev/fd/${fd}`;
M.fdPath=fdPath;

M.installed=()=>process.env.NEVERHOOD_INSTALLED_SHORTCUT==='1';
M.limits=()=>M.installed()?[1800,1820,180]:[900,920,90];
M.prior_iso_mount=function prior_iso_mount(runner){
  const old="      const { mountIso } = require('../lib/iso9660');";
  const nw="      const { mountIso } = require('../lib/readonly-media-context');";
  return runner.replaceAll(nw,old).replaceAll('mountIso(ctx.vfs, isoPath,','mountIso(ctx.vfs, new Uint8Array(fs.readFileSync(isoPath)),')
    .replaceAll("        process.on('exit', () => require('../lib/media-cli').closeMedia(result.media));\n",'');
};
M.iso_proof=function iso_proof(out,module){
  const prior=process.env.NEVERHOOD_ISO_PROOF;
  const proof=readJSON(path.join(prior,'iso-child-proof.json'));
  assert(proof.passed&&proof.moduleSHA256===digest(module));
  for(const [n,d]of Object.entries(proof.components))assert(digest(M.component_bytes(n))===d);
  for(const label of ['iso-host','iso-native']){
    const wait=readJSON(path.join(prior,label+'-wait.json'));
    assert(wait.exit===0&&['actualWait','stdoutEOF','stderrEOF'].every(k=>wait[k]));
  }
  M.save(out,'reused-iso-proof.json',{passed:true,prior,proofSHA256:digest(fs.readFileSync(path.join(prior,'iso-child-proof.json')))});
};
// Compile published bytes as the module at `file` (Python: exec(compile(body))).
function compileModule(body,file){
  const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
  m._compile(body.toString(),file);return m.exports;
}
M.helper=function helper(){
  // Shared sources can change while another worker owns them. Refuse those
  // bytes before executing them; only published helpers may be borrowed.
  const bodies={};
  for(const name of [HELPER]){
    const published=git('show','main:'+name);
    assert(fs.readFileSync(path.join(ROOT,name)).equals(published),'unpublished borrowed helper: '+name);
    bodies[name]=published;
  }
  return compileModule(bodies[HELPER],path.join(ROOT,HELPER));
};
// The borrowed sealing helper is loaded on first use, not at import: the pure
// policy/controller units need none of it.
let borrowed=null;
Object.defineProperty(M,'H',{enumerable:true,configurable:true,get(){return borrowed||(borrowed=M.helper());},set(v){borrowed=v;}});
// Atomic, never-overwriting JSON record (same contract as the helper's save()).
M.save=function save(out,name,value){
  const p=path.join(out,name);
  assert(!exists(p),p);
  const tmp=p+'.pending';
  const fd=fs.openSync(tmp,'wx');
  try{fs.writeSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.renameSync(tmp,p);
};
/* Read an explicitly published component, independent of shared-tree drift.

The same selection feeds preparation and compatibility comparisons. The
sealed source inventory, rather than another agent's current file, is the
runtime input. No other path may be substituted by this mechanism. */
M.component_bytes=function component_bytes(name){
  const components=JSON.parse(process.env.NEVERHOOD_PUBLISHED_COMPONENTS||'{}');
  assert(Object.keys(components).every(k=>['lib/cli-native-scene.js','test/run.js'].includes(k)));
  if(!(name in components))return fs.readFileSync(path.join(ROOT,name));
  const revision=components[name];
  assert(isAncestor(revision,'origin/main'));
  return git('show',revision+':'+name);
};
M.arm_desktop_observations=function arm_desktop_observations(out,env){
  const directory=path.resolve(out,'desktop-participants');
  fs.mkdirSync(directory);
  env.WINE_PROCESS_DESKTOP_OBSERVE=directory;
  M.save(out,'desktop-observation-armed.json',{at:now(),directory,
    beforeNativeSpawn:true,environment:'WINE_PROCESS_DESKTOP_OBSERVE',timeoutMs:3000,
    boundedWorkerLocalRecords:true,diagnosticsOnly:true});
  return directory;
};
M.watchdog=async function watchdog(out,deadline){
  // Preserve the borrowed watchdog's deadline, disk floor and signal policy,
  // but retain the actual triggering sample before touching the native group.
  M.save(out,'watchdog-armed.json',{pid:process.pid,deadline,at:now(),independent:true,diskFloorBytes:1500000000});
  let reason,free,t;
  for(;;){
    t=now();
    if(exists(path.join(out,'native-wait.json'))){
      M.save(out,'watchdog-exit.json',{reason:'actual-native-wait',at:t});return;
    }
    free=M.free_bytes();
    reason=t>=deadline?'deadline':free<1500000000?'disk-floor':null;
    if(reason)break;
    await sleep(50);
  }
  const trigger={reason,at:t,deadline,deadlineElapsed:t>=deadline,
    freeBytes:free,diskFloorBytes:1500000000,nativeQuit:false};
  M.save(out,'watchdog-trigger.json',trigger);
  const signals=[];
  const p=path.join(out,'native-pid.json');
  if(exists(p)){
    const info=readJSON(p);
    for(const sig of ['SIGTERM','SIGKILL']){
      let delivered=false;
      try{
        if(proc.token(info.pid)===info.startToken){proc.killpg(info.pid,sig);delivered=true;}
      }catch(e){if(!['ESRCH','ENOENT'].includes(e.code))throw e;}
      signals.push({signal:sig,at:now(),delivered});
      if(sig==='SIGTERM')await sleep(3000);
    }
  }
  M.save(out,'watchdog-exit.json',{...trigger,finishedAt:now(),signals});
};
// Free bytes for the disk floor (Linux: /home, as the Python original read).
M.free_bytes=()=>proc.freeBytes();
// stdio array that hands each listed descriptor to the child at the same number.
function stdioWith(base,fds){
  const stdio=[...base];
  for(const fd of fds){while(stdio.length<fd)stdio.push('ignore');stdio[fd]=fd;}
  return stdio;
}
M.stdioWith=stdioWith;
// Wait for a spawned child; resolves [code, signal, stdoutBuffer, stderrBuffer].
function waitChild(p){
  const out=[],err=[];
  p.stdout?.on('data',b=>out.push(b));p.stderr?.on('data',b=>err.push(b));
  return new Promise(r=>p.once('close',(code,signal)=>r([code,signal,Buffer.concat(out),Buffer.concat(err)])));
}
const returncode=(code,signal)=>code??(signal?-os.constants.signals[signal]:null);
M.checked=async function checked(out,name,args,env=null,timeout=240,pass_fds=[]){
  const p=cp.spawn(args[0],args.slice(1),{cwd:ROOT,env:env||process.env,stdio:stdioWith(['ignore','pipe','pipe'],pass_fds),detached:true});
  let timedout=false;
  const waited=waitChild(p);
  const timer=setTimeout(()=>{timedout=true;try{proc.killpg(p.pid,'SIGKILL');}catch{}},timeout*1000);
  const [code,signal,a,b]=await waited;clearTimeout(timer);
  fs.writeFileSync(path.join(out,name+'.stdout.log'),a);fs.writeFileSync(path.join(out,name+'.stderr.log'),b);
  const rc=returncode(code,signal);
  M.save(out,name+'-wait.json',{pid:p.pid,exit:rc,actualWait:true,stdoutEOF:true,stderrEOF:true,args,timedOut:timedout,at:now()});
  assert(rc===0,name+': '+b.toString().slice(-3000));
  return a;
};
// Read a whole descriptor from offset 0.
function readFd(fd){
  const size=fs.fstatSync(fd).size,b=Buffer.alloc(size);
  for(let done=0;done<size;){const n=fs.readSync(fd,b,done,size-done,done);if(!n)break;done+=n;}
  return b;
}
// Anonymous read/write descriptor (Python: memfd_create): an unlinked file.
function anonymousFd(label){
  const file=path.join(os.tmpdir(),`${label}-${process.pid}-${crypto.randomUUID()}`);
  const fd=fs.openSync(file,'wx+',0o600);fs.unlinkSync(file);return fd;
}
M.prepare=async function prepare(out,revision,patches,hold=true){
  const H=M.H;
  fs.mkdirSync(out);assert(!process.env.NODE_OPTIONS);
  assert(git('rev-parse',revision+'^{commit}').toString().trim()===revision);
  assert(isAncestor(revision,'main'));
  const names=git('ls-tree','-r','--name-only',revision).toString().split('\n').filter(Boolean)
    .filter(n=>H.selected(n)||(n.startsWith('test/helpers/')&&/\.(js|cjs|json)$/.test(n))).sort();
  const bodies={};
  {
    // git cat-file --batch, one blob per selected path.
    const input=names.map(n=>revision+':'+n+'\n').join('');
    const raw=cp.execFileSync('git',['cat-file','--batch'],{cwd:ROOT,input,maxBuffer:1<<31});
    let at=0;
    for(const n of names){
      const nl=raw.indexOf(10,at),header=raw.subarray(at,nl).toString().split(' ');
      assert(header[1]==='blob');const size=Number(header[2]);
      bodies[n]=raw.subarray(nl+1,nl+1+size);assert(raw[nl+1+size]===10);at=nl+2+size;
    }
  }
  const diffs=[];
  for(const n of patches){
    assert(OWN.includes(n),'only owned patches allowed');
    bodies[n]=fs.readFileSync(path.join(ROOT,n));
    const d=cp.spawnSync('git',names.includes(n)?['diff','--binary',revision,'--',n]:['diff','--no-index','--binary','--','/dev/null',n],{cwd:ROOT,maxBuffer:1<<30});
    assert([0,1].includes(d.status)&&!d.stderr.length);diffs.push(d.stdout);
  }
  const components=JSON.parse(process.env.NEVERHOOD_PUBLISHED_COMPONENTS||'{}');
  assert(Object.keys(components).every(k=>['lib/cli-native-scene.js','test/run.js'].includes(k)),'only passive startup components may be composed');
  for(const [n,rev]of Object.entries(components)){
    assert(isAncestor(rev,'origin/main'));
    bodies[n]=M.component_bytes(n);
    diffs.push(git('diff','--binary',revision,rev,'--',n));
  }
  M.save(out,'published-component-pins.json',{components,sha256:Object.fromEntries(Object.keys(components).map(n=>[n,digest(bodies[n])]))});
  fs.writeFileSync(path.join(out,'runtime-source.patch'),Buffer.concat(diffs));
  const inputs=readJSON(path.join(M.RUN,'media-preflight.json')).inputs;
  for(const [k,row]of Object.entries(inputs)){
    if(k==='iso')continue;
    const body=fs.readFileSync(path.join(ROOT,row.path));assert(digest(body)===row.sha256&&body.length===row.size);
    bodies[row.path]=body;
  }
  const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);
    if(e.isDirectory())walk(f);else if(e.isFile()&&/\.(js|json)$/.test(e.name))bodies[path.relative(ROOT,f)]=fs.readFileSync(f);}};
  walk(path.join(ROOT,'node_modules/pngjs'));
  const [pool,index,rows]=H.indexedSources(bodies);
  const source=H.seal('neverhood-sources',pool),preload=H.seal('neverhood-preload',bodies[PRELOAD]);
  const raw=anonymousFd('neverhood-compile');
  const env={...process.env,DISCIPLES2_ROOT:ROOT,DISCIPLES2_SOURCE_FD:fdPath(source),
    DISCIPLES2_SOURCE_SHA256:digest(pool),DISCIPLES2_SOURCE_INDEX_SHA256:digest(index),DISCIPLES2_PHASE:'compile',COMPILE_FD:String(raw)};
  const code="const c=require('./tools/watx-closure'),h=require('./tools/region-layout-hash');const r=c.compileClosure(c.watxSourceClosure(),{tailCalls:true});if(!r.success)throw Error(r.error);require('fs').writeFileSync(Number(process.env.COMPILE_FD),h.appendSection(Buffer.from(r.wasmBinary),h.layoutHash(r.regions.regions)));";
  const prepath=fdPath(preload);
  const retained=process.env.NEVERHOOD_RETAINED_PREPARATION;
  if(retained){
    const old=readJSON(path.join(retained,'manifest.json'));
    const pins=rs=>Object.fromEntries(rs.filter(r=>r.path.startsWith('src/')||r.path.startsWith('tools/watx')||['tools/region-layout-hash.js','tools/region-layout.js','lib/region-map.generated.js'].includes(r.path)).map(r=>[r.path,r.sha256]));
    assert(eq(pins(rows),pins(old.sources)),'retained module compilation inputs differ');
    const b=fs.readFileSync(path.join(retained,'module.wasm'));assert(digest(b)===old.moduleSHA256);
    fs.writeSync(raw,b);
    M.save(out,'retained-module.json',{prior:retained,moduleSHA256:digest(b),unchangedCompilationInputs:pins(rows),compiledBeforeClock:true});
  }else{
    await M.checked(out,'compile',['node','--preserve-symlinks','--require',prepath,'-e',code],env,240,[raw,source,preload]);
  }
  const module=H.seal('neverhood-module',readFd(raw));fs.closeSync(raw);
  const modulebytes=readFd(module);
  const manifest={version:1,gitSHA:revision,patchSHA256:digest(Buffer.concat(diffs)),sourceSHA256:digest(pool),moduleSHA256:digest(modulebytes),
    preloadSHA256:digest(bodies[PRELOAD]),sourceIndexSHA256:digest(index),sources:rows,installedInputs:Object.values(inputs),foreignWIPAdopted:false};
  const encoded=Buffer.from(canonical(manifest));const manifestfd=H.seal('neverhood-manifest',encoded);
  let media=fs.readFileSync(path.join(ROOT,inputs.iso.path));assert(digest(media)===inputs.iso.sha256&&media.length===inputs.iso.size);
  const mediafd=H.seal('neverhood-existing-cd',media);media=null;
  const holder={pid:process.pid,startToken:proc.token(process.pid),sealed:15,manifestSHA256:digest(encoded),
    sourcePath:fdPath(source),fdPath:fdPath(module),preloadPath:prepath,
    manifestPath:fdPath(manifestfd),mediaPath:fdPath(mediafd),mediaSHA256:inputs.iso.sha256};
  M.save(out,'manifest.json',manifest);M.save(out,'holder.json',holder);
  fs.writeFileSync(path.join(out,'module.wasm'),modulebytes);
  if(!hold)return [source,preload,module,manifestfd,mediafd];
  const deadline=now()+7200;M.save(out,'holder-deadline.json',{deadline,prearmed:true});
  while(!exists(path.join(out,'stop.json'))&&now()<deadline)await sleep(50);
  for(const fd of [source,preload,module,manifestfd,mediafd])fs.closeSync(fd);
  M.save(out,'holder-closed.json',{at:now(),descriptorsClosed:true});
};
// json.dumps(sort_keys=True,separators=(',',':')): recursively sorted keys, compact.
function canonical(v){
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
M.canonical=canonical;
M.validate_recipe=function validate_recipe(recipe){
  const [seconds,watch,reserve]=M.limits();
  assert(recipe.seconds===seconds&&recipe.watchdogGrace===watch-seconds&&recipe.reserveSeconds===reserve);
  assert(eq(recipe.inputPolicy,POLICY)&&recipe.childInheritance==='sealed-node-v1');
  assert(path.resolve(recipe.cwd)===ROOT);
  const args=recipe.args;assert(args[0]==='node'&&args[1]==='test/run.js');
  for(const flag of ['--iso-drive=D','--max-seconds='+seconds,'--real-ticks','--threads','--spawn-processes','--no-build'])
    assert(args.includes(flag),flag);
  if(M.installed()){
    const state=readJSON(path.join(M.RUN,'installed-state.json')),s=state.shortcut;
    assert(state.verified&&state.pendingRenamesUnchanged);
    for(const flag of ['--exe='+state.exePath,'--exe-guest-path='+s.exe,'--cwd='+s.cwd,
      '--reg-import='+state.registryPath,'--overlay-dir='+state.overlayPath])assert(args.includes(flag),flag);
    assert(!s.args&&!args.some(a=>a.startsWith('--iso-exe=')));
  }else assert(args.includes('--iso-exe=SETUP95.EXE'));
  assert(args.filter(a=>a.startsWith('--iso=')).length===1);
  for(const prefix of ['--tick-ms-per-batch','--winver','--force-host','--input=','--args=',...(M.installed()?[]:['--reg-import'])])
    assert(!args.some(a=>a.startsWith(prefix)),'unqualified original option '+prefix);
  assert(recipe.originalPipelineOrdinal===1);
};
async function reservePort(){
  const s=net.createServer();await new Promise((r,j)=>{s.once('error',j);s.listen(0,'127.0.0.1',r);});
  const port=s.address().port;await new Promise(r=>s.close(r));return port;
}
M.recipe=async function recipe(holderdir,out){
  const holder=readJSON(path.join(holderdir,'holder.json')),manifest=readJSON(path.join(holderdir,'manifest.json'));
  const port=await reservePort(),childport=await reservePort();
  assert(port!==childport);
  const inputs=readJSON(path.join(M.RUN,'media-preflight.json')).inputs;
  let args=['node','test/run.js','--iso='+path.join(ROOT,inputs.iso.path),'--iso-drive=D','--iso-exe=SETUP95.EXE',
    '--no-build','--no-close','--spawn-processes','--threads','--real-ticks','--max-seconds=900',
    '--max-batches=1000000000','--stuck-after=0','--control='+port,'--quiet-api','--quiet-blocks','--png-canvas',
    '--pipe-child-args=--control='+childport+' --threads --real-ticks --png-canvas',
    '--vfs-mount='+path.join(ROOT,inputs.ne.path)+'=C:\\Windows\\System\\COMMCTRL.DLL',
    '--vfs-mount='+path.join(ROOT,inputs.setupx.path)+'=C:\\Windows\\System\\SETUPX.DLL',
    '--native-exit-receipt='+path.join(out,'native-exit.json'),'--native-invocation-token='+crypto.randomUUID(),
    '--overlay-dir='+path.join(out,'guest-overlay'),'--overlay-flush-ms=0','--reg-export='+path.join(out,'guest-registry.json'),
    '--trace-api=ThunkConnect32,FT_Prolog,DirectXSetup,LoadLibraryA,GetProcAddress,CreateDialogParamA,DialogBoxParamA,MessageBoxA,CopyFileA,RegSetValueExA,CreateProcessA,ExitProcess'];
  const [seconds,watch,reserve]=M.limits();
  if(M.installed()){
    const state=readJSON(path.join(M.RUN,'installed-state.json')),s=state.shortcut;
    args=args.filter(a=>!['--iso-exe=','--max-seconds=','--overlay-dir='].some(p=>a.startsWith(p)));
    args.push('--exe='+state.exePath,'--exe-guest-path='+s.exe,'--cwd='+s.cwd,
      '--reg-import='+state.registryPath,'--overlay-dir='+state.overlayPath,'--max-seconds='+seconds);
  }
  const r={cwd:ROOT,args,seconds,watchdogGrace:watch-seconds,reserveSeconds:reserve,inputPolicy:POLICY,
    childInheritance:'sealed-node-v1',originalPipelineOrdinal:1,moduleHolder:path.join(holderdir,'holder.json'),
    immutableManifest:Object.fromEntries(['gitSHA','sourceSHA256','moduleSHA256','preloadSHA256'].map(k=>[k,manifest[k]]))};
  r.immutableManifest.manifestSHA256=holder.manifestSHA256;M.validate_recipe(r);
  return r;
};
M.admit=function admit(out,recipe){
  const H=M.H;let fds=[];
  try{
    M.validate_recipe(recipe);
    if(M.installed()){
      const state=readJSON(path.join(M.RUN,'installed-state.json'));
      assert(digest(fs.readFileSync(state.registryPath))===state.registrySHA256);
      const overlay=state.overlayPath;
      const index=path.join(overlay,'index.json');assert(digest(fs.readFileSync(index))===state.indexSHA256);
      const records=Object.fromEntries(readJSON(index).records.map(r=>[r.path,r]));
      for(const row of state.files){
        const b=fs.readFileSync(path.join(overlay,'blobs',records[row.path].blob));
        assert(b.length===row.size&&digest(b)===row.sha256);
      }
      assert(digest(fs.readFileSync(state.exePath))===state.shortcut.targetSHA256);
      M.save(out,'installed-preclock-verification.json',{passed:true,files:state.files.length,
        registrySHA256:state.registrySHA256,indexSHA256:state.indexSHA256,pendingRenamesUnchanged:true,at:now()});
    }
    let env;[env,fds]=H.frozenInputs(out,recipe);fds=[...fds];
    const holder=readJSON(recipe.moduleHolder);
    let media=H.holderBytes(holder,'mediaPath');
    assert(digest(media)===holder.mediaSHA256&&holder.mediaSHA256==='94de724bb47eb2aa588ac4eff28ddc6fd10edebcf2be4dd131ef76875ef5ffd3');
    const mediafd=H.seal('neverhood-admitted-cd',media);fds.push(mediafd);media=null;
    const manifest=readJSON(path.join(out,'runtime-inputs.json'));const pins=Object.fromEntries(manifest.sources.map(r=>[r.path,r.sha256]));
    for(const n of [HELPER,...OWN])assert(digest(M.component_bytes(n))===pins[n],'executed helper/source mismatch: '+n);
    // The exact published guard is part of the sealed source inventory.
    const guard=fs.readFileSync(path.join(ROOT,'tools/neverhood-setupx-stop.cjs'));assert(digest(guard)===pins['tools/neverhood-setupx-stop.cjs']);
    const guardfd=H.seal('neverhood-guard',guard);fds.push(guardfd);
    env.NEVERHOOD_EVIDENCE_DIR=out;
    env.WINE_COM_PROTOCOL_DIR=path.join(out,'children');
    M.arm_desktop_observations(out,env);
    env.NODE_OPTIONS+=' --require='+fdPath(guardfd);
    H.inheritanceProbe(out,recipe,env);
    const args=recipe.args.map(a=>a.startsWith('--iso=')?'--iso='+fdPath(mediafd):a);
    M.save(out,'admission.json',{passed:true,at:now(),originalSpawned:false,inputPolicy:POLICY,mediaSHA256:holder.mediaSHA256,
      childInheritance:'sealed-node-v1',manifestSHA256:holder.manifestSHA256,args,allInputsPreparedBeforeClock:true});
    return [env,fds,args];
  }catch(e){
    for(const fd of fds)try{fs.closeSync(fd);}catch{}
    M.save(out,'prelaunch-refusal.json',{error:String(e.message??e),originalLaunched:false,anyNativeOrWatchdogChild:false,at:now()});
    throw e;
  }
};
M.run=async function run(out,recipe,only_admit=false){
  fs.mkdirSync(out,{recursive:true});const [env,fds,args]=M.admit(out,recipe);
  if(only_admit){
    for(const fd of fds)fs.closeSync(fd);
    return;
  }
  assert(!exists(path.join(M.RUN,'original-spawned.json')),'one current pipeline permanently consumed');
  const [seconds,watch]=M.limits();
  const start=now(),deadline=start+seconds;
  const w=cp.spawn(process.execPath,[__filename,'watchdog',out,String(start+watch)],{stdio:['ignore','pipe','pipe'],detached:true});
  const wwait=waitChild(w);let wexit=null;w.once('exit',(c,s)=>{wexit=returncode(c,s);});
  while(!exists(path.join(out,'watchdog-armed.json'))){assert(wexit===null);await sleep(10);}
  const port=parseInt(args.find(a=>a.startsWith('--control=')).split('=')[1],10);
  const childport=parseInt(args.find(a=>a.startsWith('--pipe-child-args=')).split('--control=')[1].split(/\s+/)[0],10);
  M.save(out,'launch.json',{at:start,deadline,gameplayCutoff:deadline-M.limits()[2],reserveSeconds:M.limits()[2],rootPort:port,childPort:childport,args,clock:'real-defaults',inputPolicy:POLICY});
  M.save(M.RUN,'original-spawned.json',{at:now(),ordinal:1,secondOriginalForbidden:true});
  const p=cp.spawn(args[0],args.slice(1),{cwd:ROOT,env,stdio:stdioWith(['ignore','pipe','pipe'],fds),detached:true});
  const info={pid:p.pid,startToken:proc.token(p.pid),at:now(),
    invocationToken:(args.find(a=>a.startsWith('--native-invocation-token='))||'').split('=').slice(1).join('='),
    bootId:proc.bootId()};
  M.save(out,'native-pid.json',info);
  const eof={},errors=[];
  const drain=(stream,name)=>new Promise(resolve=>{
    let f;
    try{f=fs.openSync(path.join(out,'native.'+name+'.log'),'wx');}catch(e){errors.push(String(e));stream.resume();return resolve();}
    stream.on('data',b=>{try{fs.writeSync(f,b);}catch(e){errors.push(String(e));}});
    stream.on('end',()=>{eof[name]=true;});
    stream.on('close',()=>{fs.closeSync(f);resolve();});
    stream.on('error',e=>errors.push(String(e)));
  });
  const drained=Promise.all([drain(p.stdout,'stdout'),drain(p.stderr,'stderr')]);
  let rc=null;const exited=new Promise(r=>p.once('exit',(c,s)=>{rc=returncode(c,s);r();}));
  let sent=false;const requests=[];
  const handler=sig=>requests.push(os.constants.signals[sig]);
  const sigs=['SIGTERM','SIGINT'];for(const s of sigs)process.on(s,handler);
  try{
    while(rc===null){
      if((exists(path.join(out,'cancel-request.json'))||requests.length)&&!sent){
        proc.killOwned(info,'SIGTERM');sent=true;M.save(out,'host-cancellation.json',{at:now(),nativeQuit:false,signals:requests});
      }
      await sleep(20);
    }
  }finally{
    if(rc===null)proc.killOwned(info,'SIGTERM');
    const done=await Promise.race([exited.then(()=>true),sleep(3000).then(()=>false)]);
    if(!done){proc.killOwned(info,'SIGKILL');await exited;}
    await drained;
    M.save(out,'native-wait.json',{...info,exit:rc,actualWait:true,stdoutEOF:eof.stdout||false,stderrEOF:eof.stderr||false,drainErrors:errors,atWait:now(),atWaitMono:proc.monotonic(),disposition:sent||requests.length?'host-cancellation':'process-exit'});
    const [wc,ws,a,b]=await wwait;M.save(out,'watchdog-wait.json',{pid:w.pid,exit:returncode(wc,ws),actualWait:true,stdoutEOF:true,stderrEOF:true,stdout:a.toString(),stderr:b.toString()});
    for(const fd of fds)try{fs.closeSync(fd);}catch{}
    for(const s of sigs)process.removeListener(s,handler);
    M.save(out,'runtime-closed.json',{at:now(),nativeExit:rc,watchdogExit:returncode(wc,ws),descriptorsClosed:true});
  }
};
// Load a published helper exactly as committed at `revision`; refuse drift.
M.published=function published(name,revision){
  const body=git('show',revision+':'+name);
  assert(fs.readFileSync(path.join(ROOT,name)).equals(body),'unpublished borrowed/executed helper: '+name);
  return compileModule(body,path.join(ROOT,name));
};
M.supervised=async function supervised(out,fixture=false,working=false){
  fs.mkdirSync(out,{recursive:true});
  const revision=git('rev-parse',process.env.NEVERHOOD_PINNED_REVISION||'HEAD').toString().trim();
  if(!working)assert(isAncestor(revision,'origin/main'),'selected preparation must be published on main');
  assert(!working||fixture,'unpublished code allowed only for authored fixture');
  const own_revision=process.env.NEVERHOOD_PUBLISHED_HELPERS_REVISION||revision;
  if(!working){
    assert(git('rev-parse',own_revision+'^{commit}').toString().trim()===own_revision);
    assert(isAncestor(own_revision,'origin/main'));
  }
  for(const name of OWN)if(!working)assert(fs.readFileSync(path.join(ROOT,name)).equals(git('show',own_revision+':'+name)));
  M.save(out,'preparation-published-main.json',{gitSHA:revision,workingAuthoredOnly:working,at:now(),
    originMain:git('rev-parse','origin/main').toString().trim(),publishedHelpersRevision:own_revision,
    policy:'published main ancestor plus explicit published owned helpers, immutable through later publication'});
  fs.writeFileSync(path.join(out,'excluded-working-tree.patch'),git('diff','--binary',revision,'--','src','lib','tools','host.js','test/run.js'));
  const m=M.published('tools/gltron-current-supervise.js',revision);
  M.published('tools/boids-current-supervise.js',revision);
  const command=[process.execPath,__filename,'pipeline',out,revision];
  if(fixture)command.push('--fixture');
  if(working)command.push('--owned-patches');
  const [seconds,watch]=M.limits();
  return new m.ParentProcessSupervisor(path.join(out,'outer'),command,{preparation:600,runtime:seconds,
    preparation_watchdog:620,runtime_watchdog:watch,grace:5}).run();
};
M.material_native_pins=function material_native_pins(inputs){
  return Object.fromEntries(inputs.sources.filter(row=>['src/','lib/','tools/vb5'].some(p=>row.path.startsWith(p))||['host.js',PRELOAD].includes(row.path)
    ||(row.path.startsWith('test/')&&(!OWN.includes(row.path)||row.path==='test/run.js'))).map(row=>[row.path,row.sha256]));
};
/* Reuse only an actual focused run with the identical composed inventory. */
M.startup_proof=function startup_proof(out,module){
  const prior=process.env.NEVERHOOD_STARTUP_PROOF;
  const old=readJSON(path.join(prior,'runtime-inputs.json'));
  const current=readJSON(path.join(out,'runtime-inputs.json'));
  // Installed preparation changes only the adapter and adds its shortcut
  // recovery tests. All native, input, capture and lifecycle components match.
  const excluded=new Set(M.installed()?['tools/neverhood-original-current-runtime.js','tools/neverhood-installed-shortcut.cjs','test/test-neverhood-installed-shortcut.cjs','test/test-cli-iso-child-context.cjs']:[]);
  if(process.env.NEVERHOOD_ISO_PROOF){
    M.iso_proof(out,module);excluded.add('lib/readonly-media-context.js');excluded.add('test/run.js');
    assert(M.prior_iso_mount(M.component_bytes('test/run.js').toString())===git('show','e16a4713b:test/run.js').toString());
  }
  if(M.installed())excluded.add(path.relative(ROOT,readJSON(path.join(M.RUN,'installed-state.json')).exePath));
  const pins=m=>Object.fromEntries(m.sources.filter(r=>!excluded.has(r.path)).map(r=>[r.path,r.sha256]));
  assert(eq(pins(old),pins(current))&&old.moduleSHA256===current.moduleSHA256&&current.moduleSHA256===digest(module));
  for(const label of ['unit','participants','startup-native']){
    const wait=readJSON(path.join(prior,label+'-wait.json'));
    assert(wait.exit===0&&['actualWait','stdoutEOF','stderrEOF'].every(k=>wait[k]));
  }
  const native=path.join(prior,'native-controller');
  const q=readJSON(path.join(native,'initial-presentation-qualification.json'));
  assert(q.passed&&eq(new Set(q.modes),new Set(['startup-delayed-visible','startup-never-visible','positive','atomic-hidden-repro','atomic-hidden-positive','atomic-transition-positive'])));
  // The controller policy region must equal the reviewed controller. The
  // Python-era pin (97670c226:tools/neverhood-original-current-control.py)
  // cannot describe a JS controller; NEVERHOOD_CONTROLLER_POLICY_REVISION
  // names the published JS controller this proof was qualified against.
  const controllerRevision=process.env.NEVERHOOD_CONTROLLER_POLICY_REVISION;
  assert(controllerRevision,'reviewed JS controller policy revision required');
  const controller=fs.readFileSync(path.join(ROOT,'tools/neverhood-original-current-control.js'));
  const prior_controller=git('show',controllerRevision+':tools/neverhood-original-current-control.js');
  const policy=b=>b.subarray(b.indexOf('M.context='),b.indexOf('if(require.main===module)'));
  assert(policy(controller).equals(policy(prior_controller)),'review/bind/receipt/UP/intent policy changed');
  for(const mode of q.modes){
    for(const suffix of ['native-wait','watchdog-wait']){
      const w=readJSON(path.join(native,mode+'-'+suffix+'.json'));
      assert(w.exit===0&&['actualWait','stdoutEOF','stderrEOF'].every(k=>w[k]));
    }
  }
  M.save(out,'reused-startup-proof.json',{passed:true,prior,
    exactInventorySHA256:digest(Buffer.from(sortedJSON(pins(current)))),
    moduleSHA256:digest(module),unchangedControllerPolicySHA256:digest(policy(controller)),
    priorControllerRevision:controllerRevision,qualificationSHA256:digest(fs.readFileSync(path.join(native,'initial-presentation-qualification.json')))});
  if(M.installed())M.save(out,'startup-component-exclusions.json',{paths:[...excluded].sort(),
    reason:'adapter separately unit/lifecycle tested; authentic restored executable data independently hashed, not protocol code'});
  return prior;
};
// json.dumps(v,sort_keys=True) (default separators) for a flat string map.
function sortedJSON(v){return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+': '+JSON.stringify(v[k])).join(', ')+'}';}
M.reuse_native_proof=function reuse_native_proof(out,revision,module){
  const prior=process.env.NEVERHOOD_NATIVE_PROOF||path.join(ROOT,'scratch/runs/20261117-vb5-native-modal-continuation-fence-repair/published-final');
  const proofFile=path.join(prior,'complete-native-qualification.json');
  const proof=readJSON(proofFile);
  assert(proof.passed&&(proof.nativeProtocolAndFullRegression||proof.nativeProtocolQualified));
  if('materialSourcePins' in proof){
    const current=M.material_native_pins(readJSON(path.join(out,'runtime-inputs.json')));
    const all=[...new Set([...Object.keys(current),...Object.keys(proof.materialSourcePins)])];
    let changed=all.filter(n=>current[n]!==proof.materialSourcePins[n]).sort();
    if(eq(changed,['test/run.js'])&&current['test/run.js']===WAIT_RUNNER_SHA256){
      const old_runner=git('show',WAIT_RUNNER_BASE+':test/run.js');
      assert(digest(old_runner)===proof.materialSourcePins['test/run.js']);
      assert(digest(module)===proof.moduleSHA256);
      for(const name of ['complete-child-handoff-proof.json','wait-publication/wait-publication-proof.json'])
        assert(readJSON(path.join(out,name)).passed,'fresh native and partial-write reader proofs required');
      M.save(out,'matching-native-proof.json',{passed:true,proof:proofFile,
        proofSHA256:digest(fs.readFileSync(proofFile)),
        moduleSHA256:digest(module),unchangedPaths:Object.keys(current).length-1,runnerBase:WAIT_RUNNER_BASE,
        runnerSHA256:WAIT_RUNNER_SHA256,scope:'only atomic OS-child wait evidence replacement; exact remaining native core and module unchanged; fresh native handoff/input/UP/Quit and old/fixed independent partial-write reader regression'});
      M.save(out,'complete-native-qualification.json',{passed:true,nativeProtocolQualified:true,
        gitSHA:revision,moduleSHA256:digest(module),materialSourcePins:current,
        priorUnchangedCoreProof:proofFile,
        focusedHandoffProof:path.join(out,'complete-child-handoff-proof.json'),
        waitPublicationProof:path.join(out,'wait-publication/wait-publication-proof.json'),
        scope:'exact unchanged core; atomic wait publication tested separately, no full-suite rerun claim'});
      return true;
    }
    const child_delta=eq(changed,['lib/cli-child-observation.js','lib/cli-native-scene.js','lib/readonly-media-context.js','test/run.js']);
    let focused=null;
    if(child_delta){
      assert(digest(M.component_bytes('test/run.js'))===CHILD_RUNNER_SHA256,'unreviewed runner delta');
      focused=path.join(out,'complete-child-handoff-proof.json');
      assert(exists(focused)&&readJSON(focused).passed,'actual new native handoff proof required');
      changed=changed.filter(n=>n!=='lib/cli-child-observation.js');
    }
    if((eq(changed,['lib/cli-native-scene.js','test/run.js'])||
      (eq(changed,['lib/cli-native-scene.js','lib/readonly-media-context.js','test/run.js'])&&(process.env.NEVERHOOD_ISO_PROOF||child_delta)))&&(process.env.NEVERHOOD_STARTUP_PROOF||child_delta)){
      if(!child_delta)M.startup_proof(out,module);
      // Exact unchanged input/receipt/lease components, with only a new
      // passive command and the already tested public refusal diagnostics.
      const base=git('show','9c6eb037f:lib/cli-native-scene.js').toString();
      const scene=M.component_bytes('lib/cli-native-scene.js').toString();
      let begin=scene.indexOf('// Passive startup only:'),end=scene.indexOf('// An actual reviewed pre-main',begin);
      assert(begin>=0&&end>=0);
      assert((scene.slice(0,begin)+scene.slice(end)).replaceAll('captureFailures,startupReadiness,','captureFailures,')===base);
      let runner=(child_delta?git('show',CHILD_RUNNER_BASE+':test/run.js'):M.component_bytes('test/run.js')).toString();
      if(process.env.NEVERHOOD_ISO_PROOF||child_delta)runner=M.prior_iso_mount(runner);
      runner=runner.replaceAll("if (cmd.action === 'native-reviewed-capture' || cmd.action === 'native-presentation-capture')","if (cmd.action === 'native-reviewed-capture')");
      begin=runner.indexOf("      if (cmd.action === 'native-presentation-capture') {");
      end=runner.indexOf('      return reviewedContexts.capture(',begin);
      assert(begin>=0&&end>=0);
      runner=runner.slice(0,begin)+runner.slice(end);
      const addition="    if (cmd.action === 'native-startup-readiness')\n      return nativeScene.startupReadiness(controlSnapshot(),cliInputSnapshot(),instance,threadManager);\n";
      assert(runner.split(addition).length-1===1&&runner.replace(addition,'')===git('show',proof.gitSHA+':test/run.js').toString());
      M.save(out,'matching-native-proof.json',{passed:true,proof:proofFile,
        proofSHA256:digest(fs.readFileSync(proofFile)),proofGitSHA:proof.gitSHA,
        preparedGitSHA:revision,moduleSHA256:digest(module),unchangedPaths:Object.keys(current).length-changed.length-(child_delta?1:0),
        changedComponents:[...changed,...(child_delta?['lib/cli-child-observation.js']:[])],passiveStartupFocusedProof:true,diagnosticsPublishedRevision:'9c6eb037f',
        scope:child_delta?'unchanged native lifecycle/participants/receipt/context/lease components; startup/ISO plus exact child runner delta tested separately':'unchanged native lifecycle/participants/receipt/context/lease components; passive startup tested separately'});
      if(child_delta){
        M.save(out,'complete-native-qualification.json',{passed:true,nativeProtocolQualified:true,
          gitSHA:revision,moduleSHA256:digest(module),materialSourcePins:current,
          priorUnchangedCoreProof:proofFile,
          focusedHandoffProof:focused,runnerBase:CHILD_RUNNER_BASE,runnerSHA256:CHILD_RUNNER_SHA256,
          scope:'unchanged core libraries and prior startup/ISO runner; exact new runner+bridge tested by ordinary native handoff, input/UP/Quit, parent failure, child cancellation and ISO child tests; no full-suite rerun claim'});
      }
      return true;
    }
    if(eq(current,proof.materialSourcePins)&&digest(module)===proof.moduleSHA256){
      M.save(out,'matching-native-proof.json',{passed:true,proof:proofFile,
        proofSHA256:digest(fs.readFileSync(proofFile)),
        proofGitSHA:proof.gitSHA,preparedGitSHA:revision,moduleSHA256:digest(module),
        comparedPaths:Object.keys(current).length,sameMaterialSources:true});
      return true;
    }
    M.save(out,'prior-native-proof-mismatch.json',{changedPaths:all.filter(n=>current[n]!==proof.materialSourcePins[n]).sort(),originalStarted:false});
    return false;
  }
  // Full runtime source equality makes the native main/CPUWorker/modal proofs
  // applicable. A materially changed source fails; it is never silently waived.
  const list=rev=>git('ls-tree','-r','--name-only',rev).toString().split('\n').filter(Boolean);
  const tests=['test/run.js','test/test-vb5-normal-exit-native.cjs','test/test-vb5-native-dialog-identity.cjs','test/test-vb5-nested-owned-modal.cjs','test/test-vb5-modal-invocation-fence.cjs','test/test-vb5-installed-native.cjs','test/test-vb5-native-progress.cjs','test/test-vb5cce-original-current.cjs'];
  const names=[...[...new Set([...list(proof.gitSHA),...list(revision)])].sort().filter(n=>(n.startsWith('src/')||n.startsWith('lib/')||tests.includes(n))&&/\.(wat|watx|js|cjs|json)$/.test(n)),'host.js'];
  const changed=git('diff','--name-only',proof.gitSHA,revision,'--',...names).toString().split('\n').filter(Boolean);
  if(changed.length||digest(module)!==proof.moduleSHA256){
    M.save(out,'prior-native-proof-mismatch.json',{changedPaths:changed,priorModuleSHA256:proof.moduleSHA256,preparedModuleSHA256:digest(module),originalStarted:false});
    return false;
  }
  M.save(out,'matching-native-proof.json',{passed:true,proof:proofFile,
    proofSHA256:digest(fs.readFileSync(proofFile)),
    proofGitSHA:proof.gitSHA,preparedGitSHA:revision,moduleSHA256:digest(module),
    comparedPaths:names.length,changedPaths:changed,scope:'full native owner/refusal/focus/nested/modal/lifecycle main/CPUWorker/OSchild'});
  return true;
};
M.qualify_native=async function qualify_native(out,revision,module,env,fds){
  if(M.reuse_native_proof(out,revision,module))return;
  // VB's controller has a map-shaped helper manifest. Keep that adapter in
  // its own fixture directory; Neverhood's authenticated manifest is a list.
  const native=path.join(out,'native-protocol');fs.mkdirSync(native);
  const inputs=readJSON(path.join(out,'runtime-inputs.json'));
  const {sources,...rest}=inputs;
  M.save(native,'runtime-inputs.json',{...rest,sources:Object.fromEntries(sources.map(row=>[row.path,row.sha256]))});
  // Changed native graph: exercise the relevant actual USER routes, including
  // worker ownership, modal nesting, refusal, physical release and real exit.
  const tests=[['modal-fence',['node','test/test-vb5-modal-invocation-fence.cjs',path.join(native,'modal-fence')]],
    ['normal-exit',['node','test/test-vb5-normal-exit-completion.cjs',path.join(native,'normal-exit')]],
    ['shutdown',['node','test/test-vb5-runtime-shutdown.cjs',path.join(native,'shutdown')]],
    ['nested-owned',['node','test/test-vb5-nested-owned-modal.cjs',path.join(native,'nested-owned')]],
    ['native-dialog',['node','test/test-vb5-native-dialog-identity.cjs',path.join(native,'native-dialog')]],
    ['native-vb-controller',['node','test/test-vb5cce-original-current.cjs',path.join(native,'native-vb-controller')]],
    ['native-pointer',['node','test/test-cli-native-pointer-coordinates.cjs','--native',path.join(native,'native-pointer')]]];
  for(const [label,args]of tests){
    const partial=process.env.NEVERHOOD_NATIVE_PARTIAL;
    if(partial){
      const wait=path.join(partial,label+'-wait.json');
      const old=readJSON(path.join(partial,'runtime-inputs.json'));
      if(exists(wait)&&eq(M.material_native_pins(old),M.material_native_pins(inputs))&&old.moduleSHA256===digest(module)){
        const result=readJSON(wait);
        if(result.exit===0&&['actualWait','stdoutEOF','stderrEOF'].every(k=>result[k])){
          M.save(out,label+'-reused.json',{passed:true,priorWait:wait,priorWaitSHA256:digest(fs.readFileSync(wait)),matchingMaterialSources:true,moduleSHA256:digest(module)});
          continue;
        }
      }
    }
    await M.checked(out,label,args,env,240,fds);
  }
  const admission=readJSON(path.join(native,'native-vb-controller/vb-original-admission.json'));
  assert(admission.safeForVBOriginal,JSON.stringify(admission));
  M.save(out,'complete-native-qualification.json',{passed:true,gitSHA:revision,moduleSHA256:digest(module),
    materialSourcePins:M.material_native_pins(inputs),
    nativeProtocolAndFullRegression:true,originalStarted:false,tests:tests.map(([l])=>l),
    scope:'native CLI USER owner/refusal/focus/modal/nested/lifecycle main/CPUWorker/OSchild; excludes unrelated browser GL'});
};
M.qualify_child_handoff=async function qualify_child_handoff(out,module,env,fds){
  const inputs=readJSON(path.join(out,'runtime-inputs.json'));
  // The restored authentic launcher is a data input at a run-specific path.
  // Compare every executable source/dependency byte, including both test
  // drivers and controllers, while allowing that data path to change.
  const source_pins=Object.fromEntries(inputs.sources.filter(r=>!r.path.startsWith('scratch/')).map(r=>[r.path,r.sha256]));
  const prior=process.env.NEVERHOOD_CHILD_PROOF;
  if(prior){
    const proofFile=path.join(prior,'complete-child-handoff-proof.json'),proof=readJSON(proofFile);
    assert(proof.passed&&eq(proof.sourcePins,source_pins)&&proof.moduleSHA256===digest(module));
    for(const label of ['wait-publication','child-observation-unit','native-child-handoff','native-parent-failure','native-child-cancellation','native-iso-child']){
      const wait=readJSON(path.join(prior,label+'-wait.json'));
      assert(wait.exit===0&&['actualWait','stdoutEOF','stderrEOF'].every(k=>wait[k]));
    }
    M.save(out,'reused-child-handoff-proof.json',{passed:true,prior,proofSHA256:digest(fs.readFileSync(proofFile)),sameSealedSourcesAndModule:true});
    return;
  }
  await M.checked(out,'wait-publication',['node','test/test-neverhood-child-handoff.cjs',path.join(out,'wait-publication'),'wait-publication'],env,30,fds);
  await M.checked(out,'child-observation-unit',['node','test/test-cli-child-observation.cjs',path.join(out,'child-observation-unit')],env,30,fds);
  await M.checked(out,'native-child-handoff',['node','test/test-neverhood-child-handoff.cjs',path.join(out,'native-child-handoff')],env,80,fds);
  for(const [label,mode]of [['native-parent-failure','parent-failure'],['native-child-cancellation','child-cancellation']])
    await M.checked(out,label,['node','test/test-neverhood-child-handoff.cjs',path.join(out,label),mode],env,80,fds);
  await M.checked(out,'native-iso-child',['node','test/test-cli-iso-child-context.cjs','--native',path.join(out,'native-iso-child')],env,40,fds);
  const proof=readJSON(path.join(out,'native-child-handoff/handoff-proof.json'));
  assert(proof.passed&&proof.nativeChildQuit&&proof.childOwnedSourceModuleProcessUSER);
  M.save(out,'complete-child-handoff-proof.json',{passed:true,sourceSHA256:inputs.sourceSHA256,sourcePins:source_pins,moduleSHA256:digest(module),
    ordinaryNativePlayCreateProcessParentExit0ChildSurvives:true,childOwnedSourceModuleProcessUSER:true,
    independentChildNativeInputUPQuit:true,negativeProvenanceBeforeTransport:true,nativeParentFailureAndChildCancellation:true,
    atomicOSChildWaitPublication:true,originalStarted:false});
};
M.pipeline=async function pipeline(out,revision,fixture=false,working=false){
  const H=M.H;
  M.RUN=out;
  assert(M.free_bytes()>1500000000);
  const pre=await M.checked(out,'media-preflight',['node','tools/neverhood-original-current-preflight.cjs']);
  fs.writeFileSync(path.join(out,'media-preflight.json'),pre);
  if(M.installed()){
    const state=JSON.parse(await M.checked(out,'installed-restore',['node','tools/neverhood-installed-shortcut.cjs',out]));
    const data=JSON.parse(pre),b=fs.readFileSync(state.exePath);
    assert(digest(b)===state.shortcut.targetSHA256);
    data.inputs.installedLauncher={path:path.relative(ROOT,state.exePath),size:b.length,sha256:digest(b)};
    M.save(out,'media-with-installed.json',data);
    fs.writeFileSync(path.join(out,'media-preflight.json'),JSON.stringify(data));
  }
  const own_revision=process.env.NEVERHOOD_PUBLISHED_HELPERS_REVISION||revision;
  if(!working){
    assert(git('rev-parse',own_revision+'^{commit}').toString().trim()===own_revision);
    assert(isAncestor(own_revision,'origin/main'));
    for(const name of OWN)assert(fs.readFileSync(path.join(ROOT,name)).equals(git('show',own_revision+':'+name)));
  }
  M.save(out,'published-helper-composition.json',{baseGitSHA:revision,publishedHelpersRevision:own_revision,
    ownedPaths:[...OWN],workingAuthoredOnly:working,wholeGraphEqualityClaimed:false});
  const held=await M.prepare(path.join(out,'prepared'),revision,working||own_revision!==revision?[...OWN]:[],false);
  const qualified=path.join(out,'qualification');fs.mkdirSync(qualified);
  const r=await M.recipe(path.join(out,'prepared'),out);
  const [env,fds]=H.frozenInputs(qualified,r);
  Object.assign(env,{DELPHI5_MODULE_FD:env.DISCIPLES2_MODULE_FD,DELPHI5_SOURCE_FD:env.DISCIPLES2_SOURCE_FD,
    DELPHI5_MODULE_SHA256:env.DISCIPLES2_MODULE_SHA256});
  const pre_json=JSON.parse(pre);
  try{
    H.inheritanceProbe(qualified,r,env);
    const module=H.holderBytes(readJSON(path.join(out,'prepared/holder.json')),'fdPath');
    if(process.env.NEVERHOOD_ISO_FIXTURE==='1'){
      await M.checked(qualified,'iso-host',['node','test/test-cli-iso-child-context.cjs','--host',path.join(qualified,'iso-host')],env,30,fds);
      await M.checked(qualified,'iso-native',['node','test/test-cli-iso-child-context.cjs','--native',path.join(qualified,'iso-native')],env,40,fds);
      M.save(qualified,'iso-child-proof.json',{passed:true,moduleSHA256:digest(module),
        components:Object.fromEntries(['lib/readonly-media-context.js','test/run.js','test/test-cli-iso-child-context.cjs'].map(n=>[n,digest(fs.readFileSync(path.join(ROOT,n)))]))});
      process.env.NEVERHOOD_ISO_PROOF=qualified;
    }
    await M.qualify_child_handoff(qualified,module,env,fds);
    await M.qualify_native(qualified,revision,module,env,fds);
    const reused=process.env.NEVERHOOD_STARTUP_PROOF||process.env.NEVERHOOD_REUSE_QUALIFICATION;
    if(process.env.NEVERHOOD_STARTUP_PROOF){
      // qualify_native verified the focused inventory and actual waits.
      assert(exists(path.join(qualified,'reused-startup-proof.json')));
      M.save(qualified,'reused-controller-proof.json',{passed:true,prior:reused,
        scope:'exact composed inventory; focused startup/units/participants plus unchanged historical controller policy'});
    }else if(reused){
      const prior=reused,old=readJSON(path.join(prior,'runtime-inputs.json')),current=readJSON(path.join(qualified,'runtime-inputs.json'));
      // Runtime lifecycle/watchdog diagnostics do not change the controller,
      // native transport, source loader, or actor/freshness/modal policy.
      const test='test/test-neverhood-original-current.cjs';
      const before=git('show',process.env.NEVERHOOD_REUSE_TEST_REVISION+':'+test);
      const after=fs.readFileSync(path.join(ROOT,test));
      const oldpins=Object.fromEntries(old.sources.map(r=>[r.path,r.sha256])),newpins=Object.fromEntries(current.sources.map(r=>[r.path,r.sha256]));
      assert(digest(before)===oldpins[test]&&digest(after)===newpins[test]);
      const marker=Buffer.from("if(process.argv[2]==='--desktop-participants'){");
      const count=(b)=>{let n=0,i=-1;while((i=b.indexOf(marker,i+1))>=0)n++;return n;};
      assert(count(before)===1&&count(after)===1);
      assert(before.subarray(before.indexOf(marker)).equals(after.subarray(after.indexOf(marker))),'controller/native test components changed');
      M.save(qualified,'unchanged-test-components.json',{priorGitSHA:process.env.NEVERHOOD_REUSE_TEST_REVISION,priorWholeSHA256:digest(before),currentWholeSHA256:digest(after),unchangedComponentsSHA256:digest(after.subarray(after.indexOf(marker))),excludedPrefix:'authored independent watchdog observation diagnostic only'});
      const pins=m=>Object.fromEntries(m.sources.filter(r=>!['tools/neverhood-original-current-runtime.js',test].includes(r.path)&&(['src/','lib/','tools/vb5','test/'].some(p=>r.path.startsWith(p))||['host.js',PRELOAD,'tools/neverhood-original-current-control.js'].includes(r.path))).map(r=>[r.path,r.sha256]));
      assert(eq(pins(old),pins(current))&&old.moduleSHA256===current.moduleSHA256);
      const labels=['desktop-participants','controller-unit','provenance','native-controller'];
      for(const label of labels){
        const record=readJSON(path.join(prior,label+'-wait.json'));
        assert(record.exit===0&&['actualWait','stdoutEOF','stderrEOF'].every(k=>record[k]));
      }
      M.save(qualified,'reused-controller-proof.json',{passed:true,prior,unchangedComponentPins:pins(current),waitSHA256:Object.fromEntries(labels.map(l=>[l,digest(fs.readFileSync(path.join(prior,l+'-wait.json')))])),moduleSHA256:current.moduleSHA256});
    }else{
      M.arm_desktop_observations(qualified,env);
      await M.checked(qualified,'desktop-participants',['node','test/test-neverhood-original-current.cjs','--desktop-participants'],env,40,fds);
    }
    for(const [label,args]of (reused?[]:[['controller-unit',['node','test/test-neverhood-original-current.cjs','--unit']],
      ['provenance',['node','test/test-neverhood-original-current.cjs','--installed-provenance']],
      ['native-controller',['node','test/test-neverhood-original-current.cjs',path.join(qualified,'native-controller')]]]))
      await M.checked(qualified,label,args,env,180,fds);
    M.save(qualified,'qualification.json',{passed:true,gitSHA:revision,moduleSHA256:digest(module),originalStarted:false});
  }finally{
    for(const fd of fds)try{fs.closeSync(fd);}catch{}
  }
  if(fixture){
    M.save(path.join(out,'outer'),'prepared.json',{authoredOnly:true,compiledAndQualified:true});
    while(!exists(path.join(out,'outer/runtime-start.json')))await sleep(5);
  }else{
    // Rehash every CD member immediately before the fixed clocks.
    const final=await M.checked(out,'preclock-media',['node','tools/neverhood-original-current-preflight.cjs']);
    assert(eq(JSON.parse(final),pre_json));
    for(const ref of ['HEAD','origin/main'])assert(isAncestor(revision,ref));
    M.save(path.join(out,'outer'),'prepared.json',{compiledAndQualified:true,fullRecursiveMediaBeforeClock:true});
    while(!exists(path.join(out,'outer/runtime-start.json')))await sleep(5);
    M.save(out,'recipe.json',r);
    await M.run(out,r);
  }
  for(const fd of held)try{fs.closeSync(fd);}catch{}
  M.save(out,'holder-closed.json',{at:now(),descriptorsClosed:true});
};
/* Passively admit an actual local listener before importing the controller.

Read TCP before FDs: a listener may be created between the two reads. The
reverse order can mistake that ordinary startup transition for a foreign
socket. Preserve strict token/inode ownership and never make a probe request. */
M.wait_owned_listener=async function wait_owned_listener(out,port,seconds=30){
  assert(0<port&&port<65536&&0<seconds&&seconds<=30);
  const started=now(),deadline=proc.monotonic()+seconds;let samples=0,missing=0;
  for(;;){
    assert(!exists(path.join(out,'PERMANENT-UNKNOWN.json')),'permanent UNKNOWN');
    assert(proc.monotonic()<deadline,'owned listener readiness deadline');
    if(exists(path.join(out,'native-pid.json'))){
      const info=readJSON(path.join(out,'native-pid.json')),pid=info.pid;
      assert(proc.token(pid)===info.startToken,'native PID identity changed');
      const l=proc.listener(pid,port);
      samples++;
      if(l.listeners){
        assert(l.listeners===1,'ambiguous local listener');
        assert(proc.token(pid)===info.startToken,'native PID identity changed');
        assert(l.owned,'listener not owned by native process');
        const receipt={passed:true,target:info,port,inode:l.inode,startedAt:started,
          verifiedAt:now(),samples,pidWithoutListenerSamples:missing,
          passiveOnly:true,beforeControllerStartup:true,tcpBeforeFDs:true};
        M.save(out,'owned-listener-ready.json',receipt);
        return receipt;
      }
      missing++;
    }
    await sleep(10);
  }
};
// Pin a live process by start token (Python: pidfd_open + poll). Returns a
// probe that is true once the pinned process has exited or been replaced.
M.pin_process=function pin_process(pid,token){
  assert(proc.token(pid)===token);
  const gone=()=>{try{return proc.token(pid)!==token||!proc.alive(pid);}catch{return true;}};
  assert(proc.token(pid)===token&&!gone());
  return gone;
};
M.owner_watchdog=async function owner_watchdog(out,pid,token,seconds){
  const gone=M.pin_process(pid,token),end=proc.monotonic()+seconds;
  M.save(out,'owner-watchdog-armed.json',{pid:process.pid,ownerPid:pid,seconds,independent:true,at:now()});
  let fired=false;
  while(!gone()){
    if(exists(path.join(out,'owner-watchdog-cancel')))break;
    if(proc.monotonic()>=end){
      if(!gone()){process.kill(pid,'SIGTERM');fired=true;}
      break;
    }
    await sleep(20);
  }
  M.save(out,'owner-watchdog-result.json',{fired,at:now()});
};
M.persistent_owner=async function persistent_owner(out,worker,token,seconds,command){
  fs.mkdirSync(out,{recursive:true});
  let ancestor=process.ppid;const chain=[];
  while(ancestor>1){
    chain.push(ancestor);
    if(ancestor===worker)break;
    ancestor=proc.parentPid(ancestor);
  }
  assert(chain.includes(worker),'persistent worker must be an actual ancestor');
  const workerGone=M.pin_process(worker,token);
  // Node never arms PR_SET_PDEATHSIG for its children: nothing is inherited,
  // nothing needs clearing. The worker's death is observed by token polling.
  const inherited=0;
  assert(!workerGone());
  const requests=[],handler=s=>requests.push(os.constants.signals[s]),sigs=['SIGTERM','SIGINT'];
  for(const s of sigs)process.on(s,handler);
  M.save(out,'persistent-owner-armed.json',{pid:process.pid,startToken:proc.token(process.pid),workerPid:worker,workerStartToken:token,ancestorChain:chain,inheritedPdeathsig:inherited,clearedPdeathsig:0,at:now()});
  const w=cp.spawn(process.execPath,[__filename,'owner-watchdog',out,String(process.pid),proc.token(process.pid),String(seconds)],{stdio:['ignore','pipe','pipe']});
  const wwait=waitChild(w);let wexit=null;w.once('exit',c=>{wexit=c??-1;});
  let p=null,pwait=null,prc=null;
  try{
    const due=proc.monotonic()+5;
    while(!exists(path.join(out,'owner-watchdog-armed.json'))){
      assert(wexit===null&&proc.monotonic()<due);await sleep(5);
    }
    p=cp.spawn(command[0],command.slice(1),{cwd:ROOT,stdio:['inherit','pipe','pipe'],detached:true});
    pwait=waitChild(p);p.once('exit',(c,s)=>{prc=returncode(c,s);});
    M.save(out,'wait-owner-child.json',{pid:p.pid,startToken:proc.token(p.pid),owner:process.pid,args:command});
    let sent=false,result;
    for(;;){
      result=await Promise.race([pwait,sleep(50).then(()=>null)]);
      if(result)break;
      if((workerGone()||requests.length)&&!sent){
        p.kill('SIGTERM');sent=true;
        M.save(out,'owner-cancellation.json',{workerDied:workerGone(),signals:requests,at:now()});
      }
    }
    const [code,signal,a,b]=result;prc=returncode(code,signal);
    fs.writeFileSync(path.join(out,'owner.stdout.log'),a);fs.writeFileSync(path.join(out,'owner.stderr.log'),b);
    M.save(out,'owner-wait.json',{pid:p.pid,exit:prc,actualWait:true,stdoutEOF:true,stderrEOF:true,workerAlive:!workerGone()});
    return prc;
  }finally{
    if(p!==null&&prc===null){p.kill('SIGTERM');await Promise.race([pwait,sleep(20000)]);}
    fs.writeFileSync(path.join(out,'owner-watchdog-cancel'),'');
    const [wc,ws,a,b]=await wwait;
    M.save(out,'owner-watchdog-wait.json',{pid:w.pid,exit:returncode(wc,ws),actualWait:true,stdoutEOF:true,stderrEOF:true,stdout:a.toString(),stderr:b.toString()});
    for(const s of sigs)process.removeListener(s,handler);
  }
};
M.main=async function main(argv=process.argv.slice(1)){
  const mode=argv[1],out=path.resolve(argv[2]);
  if(mode==='supervised')return M.supervised(out,argv.includes('--fixture'),argv.includes('--owned-patches'));
  else if(mode==='pipeline')await M.pipeline(out,argv[3],argv.includes('--fixture'),argv.includes('--owned-patches'));
  else if(mode==='prepare')await M.prepare(out,argv[3],argv.includes('--owned-patches')?[...OWN]:[]);
  else if(mode==='recipe')M.save(out,'recipe.json',await M.recipe(path.resolve(argv[3]),out));
  else if(mode==='watchdog')await M.watchdog(out,parseFloat(argv[3]));
  else if(mode==='listener')await M.wait_owned_listener(out,parseInt(argv[3],10),argv.length>4?parseFloat(argv[4]):30);
  else if(mode==='owner-watchdog')await M.owner_watchdog(out,parseInt(argv[3],10),argv[4],parseFloat(argv[5]));
  else if(mode==='persistent-owner')return M.persistent_owner(out,parseInt(argv[3],10),argv[4],parseFloat(argv[5]),argv.slice(6));
  else if(mode==='run'||mode==='admit')await M.run(out,readJSON(argv[3]),mode==='admit');
  else if(mode==='owner'){
    const p=cp.spawn(process.execPath,[__filename,...argv.slice(3)],{cwd:ROOT,stdio:['inherit','pipe','pipe'],detached:true});
    const waited=waitChild(p);
    M.save(out,'wait-owner-child.json',{pid:p.pid,startToken:proc.token(p.pid),owner:process.pid});
    const [code,signal,a,b]=await waited;fs.writeFileSync(path.join(out,'owner.stdout.log'),a);fs.writeFileSync(path.join(out,'owner.stderr.log'),b);
    M.save(out,'owner-wait.json',{pid:p.pid,exit:returncode(code,signal),actualWait:true,stdoutEOF:true,stderrEOF:true});
  }else throw Error('ValueError: '+mode);
};
// sys.exit(main()): an integer result is the exit status (negative = signal,
// reported as 256+n like Python's wrap), None/true-ish objects exit 0/1.
if(require.main===module){
  M.main().then(v=>{
    if(Number.isInteger(v))process.exitCode=v&0xff;
    else if(v!=null&&v!==true&&v!==false&&typeof v!=='object')process.exitCode=1;
  }).catch(e=>{process.stderr.write((e&&e.stack||String(e))+'\n');process.exitCode=1;});
}
