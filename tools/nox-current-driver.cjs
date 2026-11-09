'use strict';
// Explicit composition of the accepted Nox consumer with a current source closure.
// The retained consumer and media are read-only inputs, never repinned in place.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const HISTORY='scratch/runs/20261108-nox-native-equipment';
const DRIVER_SHA='72b2eead63b36ef53fb5e3e1457536eaf1b94d1d0792eb425a3419f6a39c0705';
const MEDIA='test/binaries/candidates/nox-demo';
const HELPERS=['ack-client.cjs','bound-input.cjs','keyboard-bridge.cjs','native-mouse.cjs','ordinary-keys.cjs','transport.cjs'];
const PLAN_FIELDS=['version','app','historicalCommit','currentCommit','acceptedDriver','files','modules','changes','registry'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(ROOT,p));
const pin=(p,b=read(p))=>({path:p,size:b.length,sha256:sha(b)});
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,maxBuffer:32*1024*1024});
const json=p=>JSON.parse(fs.readFileSync(p));
function exact(text,from,to){assert.equal(text.split(from).length,2,'unique composition anchor: '+from);return text.replace(from,to);}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function checkPin(root,p){assert(!path.isAbsolute(p.path)&&!p.path.split('/').includes('..'),'relative input');const b=fs.readFileSync(path.join(root,p.path));assert.equal(sha(b),p.sha256,'immutable input '+p.path);assert.equal(b.length,p.size,p.path);}
function registry(root=ROOT){
  const file=path.join(root,'lib/apps.js');delete require.cache[require.resolve(file)];
  const {APPS}=require(file),app=APPS.nox_demo;
  assert.deepEqual(app,{exe:MEDIA+'/game/nox.exe',dlls:[MEDIA+'/game/mss32.dll'],files:[],localFileManifest:MEDIA+'/.wine-assembly-browser.json',requiredFiles:true,fileConcurrency:8},'actual registered nox_demo consumer');
  return app;
}
function mediaCheck(root,files){
  const media=files.filter(p=>p.path.startsWith(MEDIA+'/'));assert.equal(media.length,126,'125 originals plus manifest');
  media.forEach(p=>checkPin(root,p));
  const actual=walk(path.join(root,MEDIA,'game')).map(p=>path.relative(root,p)).sort();
  assert.deepEqual(actual,media.filter(p=>p.path.startsWith(MEDIA+'/game/')).map(p=>p.path).sort(),'exact original installed set');
  const manifest=json(path.join(root,MEDIA,'.wine-assembly-browser.json'));
  assert.equal(manifest.schemaVersion,1);assert.equal(manifest.files.length,124);
  assert.deepEqual([...manifest.files.map(p=>MEDIA+'/'+p.url),MEDIA+'/game/nox.exe'].sort(),actual,'registered media plus separate EXE');
}
function modules(){
  const {watxSourceClosure,compileClosure}=require('./watx-closure.js');
  const {applyToVfs}=require('../lib/dispatch-trampoline.js');
  const {layoutHash,appendSection}=require('./region-layout-hash.js');
  const closure=watxSourceClosure(),reuse=require('./watx.js').createFrontendReuse();
  return [true,false].map(tailCalls=>{
    const c=tailCalls?closure:{...closure,vfs:applyToVfs(new Map(closure.vfs))};
    const r=compileClosure(c,{tailCalls,frontendReuse:reuse});assert(r?.success&&r.wasmBinary,r?.error);
    const bytes=appendSection(Buffer.from(r.wasmBinary),layoutHash(r.regions.regions));
    const p=pin('build/wine-assembly'+(tailCalls?'':'.compat')+'.wasm',bytes);
    checkPin(ROOT,p);return {...p,tailCalls,sourceRecompiled:true};
  });
}
function historical(){
  const prior=json(path.join(ROOT,HISTORY,'runtime-pins.json'));
  assert.equal(sha(read(HISTORY+'/browser-run.cjs')),DRIVER_SHA,'accepted driver immutable');
  for(const p of prior.files.filter(p=>p.path.startsWith(HISTORY+'/')))checkPin(ROOT,p);
  mediaCheck(ROOT,prior.files);registry();return prior;
}
function inspect(){
  const prior=historical(),build=modules(),paths=new Set(prior.files.map(p=>p.path));
  // Current browser/source files include newly introduced dependencies too.
  for(const dir of ['src','lib'])for(const f of walk(path.join(ROOT,dir)))if(/\.(watx?|js|cjs)$/.test(f))paths.add(path.relative(ROOT,f));
  const visited=new Set();
  function dependencies(mod){
    if(!mod||visited.has(mod.filename))return;visited.add(mod.filename);
    if(mod.filename.startsWith(ROOT+'/tools/')||mod.filename.startsWith(ROOT+'/lib/'))paths.add(path.relative(ROOT,mod.filename));
    for(const child of mod.children)dependencies(child);
  }
  for(const name of ['./watx-closure.js','./watx.js','./region-layout-hash.js','../lib/dispatch-trampoline.js','../lib/apps.js'])dependencies(require.cache[require.resolve(name)]);
  for(const p of ['index.html','host.js','test/static-server.js','ops/browser-native-input.cjs','tools/build.sh','tools/build-compile-wat.js','tools/nox-current-driver.cjs'])paths.add(p);
  const files=[...paths].sort().map(p=>pin(p)),before=new Map(prior.files.map(p=>[p.path,p]));
  const changes=[],patches={};
  for(const current of files){
    const old=before.get(current.path);if(old?.sha256===current.sha256)continue;
    if(current.path.startsWith('build/')){changes.push({old,current,kind:'recompiled-module'});continue;}
    if(current.path.startsWith(HISTORY+'/')||current.path.startsWith(MEDIA+'/'))throw Error('immutable historical/media input '+current.path);
    // A changed historical source must be exactly recoverable from its Git base.
    if(old)assert.equal(sha(git('show',prior.commit+':'+current.path)),old.sha256,'historical Git source '+current.path);
    const tracked=cp.spawnSync('git',['ls-files','--error-unmatch',current.path],{cwd:ROOT,stdio:'ignore'}).status===0;
    const patch=tracked?git('diff','--binary',prior.commit,'--',current.path):cp.spawnSync('git',['diff','--no-index','--binary','/dev/null',current.path],{cwd:ROOT,maxBuffer:32*1024*1024}).stdout;
    const name='source-'+sha(Buffer.from(current.path)).slice(0,16)+'.patch';patches[name]=patch;
    changes.push({old:old??null,current,kind:old?'changed-source':'added-current-dependency',gitBase:prior.commit,patch:name,patchSha256:sha(patch)});
  }
  return {plan:{version:1,app:'nox_demo',historicalCommit:prior.commit,currentCommit:git('rev-parse','HEAD').toString().trim(),acceptedDriver:DRIVER_SHA,files,modules:build,changes,registry:registry()},patches};
}
function planHash(manifest){return sha(Buffer.from(JSON.stringify(Object.fromEntries(PLAN_FIELDS.map(k=>[k,manifest[k]])))));}
function verify(root,manifest,generated,expectedPlan){
  if(expectedPlan)assert.equal(planHash(manifest),expectedPlan,'immutable current plan; regenerate from explicit sources');
  assert.equal(manifest.version,1);assert.equal(manifest.app,'nox_demo');assert.equal(manifest.acceptedDriver,DRIVER_SHA);
  for(const p of manifest.files)checkPin(root,p);
  for(const p of manifest.generated)checkPin(generated,p);
  for(const p of manifest.provenance)checkPin(generated,p);
  for(const c of manifest.changes.filter(c=>c.patch))assert.equal(manifest.provenance.find(p=>p.path===c.patch)?.sha256,c.patchSha256,'exact changed-source diff identity');
  mediaCheck(root,manifest.files);registry(root);
  assert.equal(manifest.modules.length,2);
  for(const m of manifest.modules){assert(m.sourceRecompiled);checkPin(root,m);}
  assert.notEqual(manifest.modules[0].sha256,manifest.modules[1].sha256,'distinct primary and compat');
  return true;
}
function generate(planFile,destination){
  const reviewed=json(planFile),{plan,patches}=inspect();
  assert.deepEqual(plan,reviewed,'current inputs differ from explicit reviewed plan');
  assert(!fs.existsSync(destination),'fresh generated destination');fs.mkdirSync(destination,{recursive:true});
  const emit=(name,bytes)=>fs.writeFileSync(path.join(destination,name),bytes,{flag:'wx'});
  for(const name of HELPERS)emit(name,read(HISTORY+'/'+name));
  // Compose the actual current production helper with only Nox key descriptors.
  let native=read('ops/browser-native-input.cjs').toString();
  native=exact(native,'KeyI:73,','KeyI:73,KeyV:86,KeyB:66,KeyQ:81,');
  native=exact(native,"code==='KeyI'?'i':code","/^Key[A-Z]$/.test(code)?code.slice(3).toLowerCase():code");
  emit('native-input.cjs',native);
  let source=read(HISTORY+'/browser-run.cjs').toString();
  const relRoot=path.relative(destination,ROOT);
  source=exact(source,"root=path.resolve(run,'../../..')",'root=path.resolve(run,'+JSON.stringify(relRoot)+')');
  source=exact(source,"const pins=JSON.parse(fs.readFileSync(run+'/runtime-pins.json'));","const pins=JSON.parse(fs.readFileSync(run+'/runtime-pins.json'));\nrequire(root+'/tools/nox-current-driver.cjs').verify(root,pins,run,"+JSON.stringify(planHash(plan))+");");
  emit('browser-run.cjs',source);
  const generated=walk(destination).map(p=>pin(path.basename(p),fs.readFileSync(p))).sort((a,b)=>a.path.localeCompare(b.path));
  const provenance=Object.entries(patches).map(([name,b])=>pin(name,b));
  const manifest={...plan,generated,provenance,httpPins:json(path.join(ROOT,HISTORY,'runtime-pins.json')).httpPins.map(p=>({...plan.files.find(f=>f.path===p.path),url:p.url}))};
  emit('runtime-pins.json',JSON.stringify(manifest,null,2)+'\n');
  for(const [name,bytes] of Object.entries(patches))emit(name,bytes);
  verify(ROOT,manifest,destination);return manifest;
}
module.exports={ROOT,HISTORY,DRIVER_SHA,HELPERS,sha,pin,planHash,inspect,generate,verify,registry,checkPin};
if(require.main===module){
  try{
    if(process.argv[2]==='inspect'){
      const out=process.argv[3];assert(out&&!fs.existsSync(out),'fresh explicit plan');
      const {plan,patches}=inspect();
      for(const [name,bytes] of Object.entries(patches))fs.writeFileSync(path.join(path.dirname(out),name),bytes,{flag:'wx'});
      fs.writeFileSync(out,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
      console.log(JSON.stringify({plan:out,inputs:plan.files.length,changed:plan.changes.length,modules:plan.modules}));
    }else if(process.argv[2]==='generate'){
      const manifest=generate(process.argv[3],path.resolve(process.argv[4]));console.log(JSON.stringify({generated:true,inputs:manifest.files.length,modules:manifest.modules}));
    }else throw Error('usage: nox-current-driver.cjs inspect PLAN | generate PLAN FRESH_DIRECTORY');
  }catch(e){console.error(e.stack);process.exitCode=1;}
}
