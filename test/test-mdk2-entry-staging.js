'use strict';
// Real accepted entry, minimal inherited-module fixture. No Chrome/HTTP/game.
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const Module = require('node:module');
const zlib = require('node:zlib');
const staging = require('../tools/mdk2-entry-staging.cjs');
const integration = require('../tools/mdk2-construction-driver-integration.cjs');
const ROOT = path.resolve(__dirname, '..');
const RUN = path.join(ROOT,'scratch/runs/20261104-mdk2-entry-staging');
fs.mkdirSync(RUN,{recursive:true});
const temporary = [];
after(()=>{for(const dir of temporary) fs.rmSync(dir,{recursive:true,force:true});});
const payload = staging.prepare(), pins = staging.validate(payload).pins;
const clone = () => JSON.parse(JSON.stringify(payload));
function fixture() {
  const root = fs.mkdtempSync(path.join(RUN,'inherited-')); temporary.push(root);
  // The inherited originals already exist. Fixtures reference their gzip
  // storage in place through retained references and build links; no copies.
  for (const row of pins.moduleFiles) {
    const reference = path.join(ROOT,row.localReference);
    const suffix = fs.existsSync(reference) ? '' : '.gz';
    fs.mkdirSync(path.dirname(path.join(root,row.path)),{recursive:true});
    fs.symlinkSync(reference+suffix,path.join(root,row.path)+suffix);
  }
  return root;
}
let root;
test('payload has exactly 111 helpers, two accepted tools, two pin inputs and minimal Git path proofs',()=>{
  const v=staging.validate(payload);
  assert.equal(v.helpers,111); assert.equal(v.inputs.size,115);
  assert.equal(v.pins.files.length,432);
  assert.equal(payload.objects.filter(o=>o.type==='blob').length,6);
  assert(!payload.inputs.some(r=>r.path.startsWith('src/')||r.path.endsWith('.wasm')||r.path.includes('binaries')));
  fs.writeFileSync(path.join(RUN,'payload-summary.json'),JSON.stringify({bytes:Buffer.byteLength(JSON.stringify(payload)),
    sha256:staging.sha(JSON.stringify(payload)),inputs:[...v.inputs].map(([p,b])=>({path:p,bytes:b.length,sha256:staging.sha(b)})),
    objects:payload.objects.map(({id,type})=>({id,type}))},null,2));
});
test('actual inherited blocker repairs the absent entry/helpers and old mismatched wrapper',()=>{
  root=fixture();
  const mismatch=path.join(root,'scratch/runs/20261104-mdk2-unhighlighted-menu-onward/driver-wrapper.cjs');
  const helpers=payload.inputs.filter(row=>row.path.startsWith('scratch/runs/')&&!row.path.endsWith('.gz')&&path.join(root,row.path)!==mismatch);
  // Reproduce the accepted audit: 65 present matches, 45 missing, one old wrapper.
  for(const row of helpers.slice(45)) {
    const file=path.join(root,row.path);fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,Buffer.from(row.data,'base64'));
  }
  fs.mkdirSync(path.dirname(mismatch),{recursive:true}); fs.writeFileSync(mismatch,'old wrapper');
  const peer=path.join(root,'old-wrapper-peer');fs.linkSync(mismatch,peer);
  const report=staging.stage(payload,root);
  assert.equal(report.helpers,111); assert.equal(report.repaired.length,1);
  assert.equal(report.missing.length,49);assert.equal(fs.readFileSync(peer,'utf8'),'old wrapper');
  assert.equal(report.repaired[0].previousSHA256,staging.sha('old wrapper'));
  assert(!fs.existsSync(path.join(root,'.git')));
  assert(!fs.existsSync(path.join(root,'src')));
  assert(!fs.existsSync(path.join(root,'host.js')));
  assert(!fs.existsSync(path.join(root,'test')));
  assert.equal(fs.readdirSync(path.join(root,staging.PROOF,'refs/heads')).length,0);
  fs.writeFileSync(path.join(RUN,'stage-result.json'),JSON.stringify(report,null,2));
});
test('unchanged accepted --check runs in the minimal fixture using real Git show',()=>{
  const report=JSON.parse(staging.invoke(root,['--check']));
  assert.equal(report.status,'offline-composition-checked'); assert.equal(report.closure.length,111);
  assert.equal(report.source,staging.SOURCE); assert.equal(report.observer,staging.OBSERVER);
  assert.deepEqual(report.moduleReferences.map(r=>r.sha256),pins.moduleFiles.map(r=>r.sha256));
  fs.writeFileSync(path.join(RUN,'accepted-check.json'),JSON.stringify(report,null,2));
});
test('actual composed entry loads all top-level dependencies and exact six controller sources',()=>{
  const script=String.raw`
    const assert=require('node:assert/strict'),Module=require('node:module'),vm=require('node:vm');
    const i=require('./tools/mdk2-construction-driver-integration.cjs');
    const run=require('node:path').join(process.cwd(),'scratch/runs/offline-never-run');
    const composed=i.compose(run), end=composed.source.indexOf('main().catch(');
    assert(end>0);assert.equal(composed.source.split('main().catch(').length,2);
    const entry=new Module(composed.file,module);entry.filename=composed.file;
    entry.paths=Module._nodeModulePaths(require('node:path').dirname(composed.file));
    entry._compile(composed.source.slice(0,end)+'module.exports={main,command,preload,traceDriver};',composed.file);
    assert.equal(typeof entry.exports.main,'function');assert.equal(typeof entry.exports.command,'function');
    assert.equal(entry.exports.preload,i.preloadSource());
    const controllers=i.controllerSources(run);assert.equal(Object.keys(controllers).length,6);
    new vm.Script(Module.wrap(controllers['native-menu.cjs']));
    assert.equal(typeof require('./scratch/runs/20261104-mdk2-measured-escape-original/native-menu.cjs').select,'function');
    require('./scratch/runs/20261104-mdk2-measured-escape-original/endpoint-preflight.cjs');
    console.log(JSON.stringify({status:'actual-composed-dependencies-loaded',controllers:Object.keys(controllers),
      gitDependencies:Object.keys(i.pinnedRuntime().files),sourceSHA256:i.sha(composed.source)}));`;
  const result=cp.spawnSync(process.execPath,['-e',script],{cwd:root,env:staging.environment(path.join(root,staging.PROOF)),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).gitDependencies.length,4);
  assert(!fs.existsSync(path.join(root,'scratch/runs/offline-never-run')));
  fs.writeFileSync(path.join(RUN,'composed-dependencies.json'),result.stdout);
});
for(const mode of ['missing-helper','mismatched-wrapper','wrong-observer','wrong-entry']) test('validation and accepted entry both reject '+mode,()=>{
  const name=mode==='wrong-observer'?'tools/mdk2-lua-construction-observer.cjs':mode==='wrong-entry'?staging.ENTRY:
    'scratch/runs/20261104-mdk2-unhighlighted-menu-onward/driver-wrapper.cjs';
  const file=path.join(root,name), before=fs.readFileSync(file);
  try {
    if(mode==='missing-helper')fs.unlinkSync(file);else {const b=Buffer.from(before);b[0]^=1;fs.writeFileSync(file,b);}
    assert.throws(()=>staging.invoke(root,['--check']),/ENOENT|staged input mismatch/);
    const actual=cp.spawnSync(process.execPath,[path.join(root,staging.ENTRY),'--check'],
      {cwd:root,env:staging.environment(path.join(root,staging.PROOF)),encoding:'utf8'});
    assert.notEqual(actual.status,0);
    if(mode==='wrong-observer')assert.match(actual.stderr,/published observer changed/);
    if(mode==='mismatched-wrapper')assert.match(actual.stderr,/retained closure mismatch/);
  }finally{fs.writeFileSync(file,before);}
});
for (const dependency of staging.DEPENDENCIES) test('wrong live Git-backed bytes reject for '+dependency,()=>{
  const pin=pins.files.find(row=>row.path===dependency);
  const obj=payload.objects.find(o=>o.type==='blob'&&staging.sha(Buffer.from(o.data,'base64'))===pin.sha256);
  assert(obj);
  const file=path.join(root,staging.PROOF,'objects',obj.id.slice(0,2),obj.id.slice(2)), before=fs.readFileSync(file);
  try{
    const b=Buffer.from(obj.data,'base64');b[0]^=1;
    fs.writeFileSync(file,zlib.deflateSync(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])));
    assert.throws(()=>staging.invoke(root,['--check']),/staged Git object mismatch/);
    const actual=cp.spawnSync(process.execPath,[path.join(root,staging.ENTRY),'--check'],
      {cwd:root,env:staging.environment(path.join(root,staging.PROOF)),encoding:'utf8'});
    assert.equal(actual.status,2); assert.match(actual.stderr,/Expected values|hash mismatch|bad object|corrupt/);
  }finally{fs.writeFileSync(file,before);}
});
for(const mode of ['changed-git-blob','changed-commit','missing-git-object','extra-object','missing-helper','changed-helper','extra-input','changed-entry','changed-pins'])
test('transfer proof rejects '+mode,()=>{
  const p=clone();
  if(mode==='changed-git-blob'||mode==='changed-commit'){
    const row=p.objects.find(o=>o.type===(mode==='changed-commit'?'commit':'blob'));
    const b=Buffer.from(row.data,'base64');b[0]^=1;row.data=b.toString('base64');
  }else if(mode==='missing-git-object')p.objects.shift();
  else if(mode==='extra-object'){
    const bytes=Buffer.from('unrelated');p.objects.push({id:staging.oid('blob',bytes),type:'blob',data:bytes.toString('base64')});
  }else if(mode==='extra-input')p.inputs.push({path:'../escape',data:''});
  else if(mode==='missing-helper')p.inputs.splice(2,1);
  else {
    const row=mode==='changed-entry'?p.inputs[0]:mode==='changed-pins'?p.inputs.find(r=>r.path.endsWith('runtime-pins.json.gz')):p.inputs[2];
    const b=Buffer.from(row.data,'base64');b[0]^=1;row.data=b.toString('base64');
  }
  assert.throws(()=>staging.validate(p));
});
test('self-consistently rehashed wrong Git-backed bytes cannot replace historical commit path',()=>{
  const p=clone(), row=p.objects.find(o=>o.type==='blob');
  const b=Buffer.from(row.data,'base64');b[0]^=1;
  row.data=b.toString('base64');row.id=staging.oid('blob',b);
  assert.throws(()=>staging.validate(p),/missing Git proof object/);
});
test('missing proof cannot fall through to parent checkout Git metadata',()=>{
  const proof=path.join(root,staging.PROOF), moved=proof+'-hidden';fs.renameSync(proof,moved);
  try {
    assert.throws(()=>staging.invoke(root,['--check']),/ENOENT/);
    const actual=cp.spawnSync(process.execPath,[path.join(root,staging.ENTRY),'--check'],
      {cwd:root,env:staging.environment(proof),encoding:'utf8'});
    assert.notEqual(actual.status,0);assert.match(actual.stderr,/not a git repository/);
  }finally{fs.renameSync(moved,proof);}
});
test('inherited wrong module fails staging without current-build substitution',()=>{
  const bad=fixture(), modulePath=path.join(bad,pins.moduleFiles[0].path);
  fs.writeFileSync(modulePath,'wrong original module');
  assert.throws(()=>staging.stage(payload,bad));
  assert(!fs.existsSync(path.join(bad,staging.PROOF)));
});
test('staging rejects shared checkout and symlink helper writes',()=>{
  assert.throws(()=>staging.stage(payload,ROOT),/Git checkout/);
  const bad=fixture();fs.symlinkSync(path.join(root,'tools'),path.join(bad,'tools'));
  assert.throws(()=>staging.stage(payload,bad),/symlink staging destination/);
});
test('actual run entry still rejects absent fresh release before controller/output creation',()=>{
  const fresh=path.join(root,'scratch/runs/must-never-allocate');
  assert.throws(()=>staging.invoke(root,['--run',fresh]),/runtime-release.json/);
  assert(!fs.existsSync(fresh));
});
