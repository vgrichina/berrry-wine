'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {verifyInputs, admitOriginal} = require('./mw3-original-admission.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mw3-admission-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const requiredPaths = ['worker-prefix.js', 'worker-fixture.js', 'browser.cjs', 'isolation-page.html'];
  const files = requiredPaths.map(name => {
    const bytes = Buffer.from(name.endsWith('.html') ? '<script src="/lib/guest-rpc.js"></script>' : '// candidate');
    fs.writeFileSync(path.join(root, name), bytes);
    return {path:name, size:bytes.length, sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  });
  const state = Array(16).fill(0); state[12] = 128;
  const control = mode => ({mode, isolated:true, installed:true,
    capture:{beforeInstantiation:true, capturedAt:1, instantiateStartedAt:2, instantiatedAt:3, imports:[{module:'host', kind:'function', name:'get_mouse_buttons_live'}]}, state,
    trace:{importNames:['get_mouse_buttons_live'], drops:0, errors:[], reads:[{eax:0,state,size:16,buffer:0x530000,esp:0x510000,
      completionEsp:0x510010,requestAt:1,at:2,requestMono:1,completionMono:2}], imports:[{name:'get_mouse_buttons_live'}]}});
  const controls=['unwrapped','inactive','active','noise-delayed','selected-overflow','excluded-exception','decoder-failure'].map(control);
  Object.assign(controls[3], {delayedMs:451,beforeDelayed:{active:true,reads:[],imports:[],excludedImports:80000}});
  Object.assign(controls[4], {selectedRows:65536,trace:{importNames:['get_mouse_buttons_live'],imports:[{name:'get_mouse_buttons_live'}],drops:1,errors:['import capacity'],active:false,reads:[]}});
  Object.assign(controls[5], {caught:'fixture excluded original exception',trace:{importNames:['get_mouse_buttons_live'],imports:[],drops:0,errors:['original import threw: log'],active:false,reads:[]}});
  Object.assign(controls[6], {trace:{importNames:['get_mouse_buttons_live'],imports:[],drops:0,errors:['Error: standard mouse format'],active:false,reads:[]}});
  return {root, requiredPaths, pins:{files, uploadFiles:structuredClone(files)}, candidatePath:'browser.cjs',
    candidate:{passed:true, exactCandidateSHA256:files[2].sha256},
    parent:{passed:true, originalLaunches:0, rows:[{code:0, actualParentWait:true, readersJoined:true, separateEOF:{stdout:true, stderr:true}}]},
    chrome:{code:0, signal:null, actualWait:true, separateEOF:{stdout:true,stderr:true}},
    production:{passed:true, fixtureOnly:true, moduleSHA256:'e'.repeat(64), prefixSHA256:files[0].sha256, fixtureSHA256:files[1].sha256, controls}, expectedModule:'e'.repeat(64)};
}
test('omitted HTML refuses before any original launch effect', t => {
  const f=fixture(t); f.pins.uploadFiles.pop(); let starts=0;
  assert.throws(() => {verifyInputs(f.root,f.pins,f.requiredPaths);starts++;}, /omitted.*isolation-page.html/);
  assert.equal(starts,0);
});
test('failed or incomplete private controls cannot admit the original', t => {
  const baseline=fixture(t);
  for(const mutate of [f=>f.parent.passed=false, f=>f.parent.rows[0].code=1,
    f=>f.parent.rows[0].separateEOF.stderr=false, f=>f.chrome.actualWait=false,
    f=>f.production.controls[2].trace.drops=1, f=>f.production.moduleSHA256='f'.repeat(64),
    f=>f.candidate.exactCandidateSHA256='f'.repeat(64),
    f=>f.production.controls[2].trace.reads[0].completionEsp++,
    f=>f.production.controls[2].trace.reads[0].requestAt=3,
    f=>f.production.controls[2].trace.reads[0].requestMono=3,
    f=>f.production.controls[2].capture.imports=[],
    f=>f.production.controls.pop(), f=>f.production.controls[3].beforeDelayed.excludedImports=79999,
    f=>f.production.controls[3].delayedMs=0, f=>f.production.controls[4].trace.drops=0,
    f=>f.production.controls[5].trace.errors=[], f=>f.production.controls[6].trace.active=true,
    f=>f.production.controls[2].capture.capturedAt=4, f=>f.production.prefixSHA256='f'.repeat(64),
    f=>f.production.controls[2].trace.imports.push({name:'log'})]) {
    const f=structuredClone(baseline);mutate(f);let starts=0;
    assert.throws(()=>{admitOriginal(f);starts++});assert.equal(starts,0);
  }
});
test('exact staged graph and completed controls admit once at caller boundary', t => {
  const f=fixture(t);assert.equal(admitOriginal(f).passed,true);
  fs.appendFileSync(path.join(f.root,'browser.cjs'),'changed');
  assert.throws(()=>admitOriginal(f),/runtime input size/);
});

test('passive snapshot handles the actual legacy WebGL adapter without inventing target evidence', () => {
  const {snapshotRenderEndpoints} = require('./mw3-passive-render-snapshot.cjs');
  const adapter = require('../lib/d3dim-render-worker.js').create({
    instance:{exports:{}}, memory:{buffer:new ArrayBuffer(1024)}, backend:'webgl',
  });
  const entry = {adapter, options:{api:'legacy',backend:'webgl'},
    control:new Int32Array([1,1153,0,0,576,576])};
  const endpoints = new Map([[1,entry]]);
  // The actual failed diagnostic assumed a field the production adapter does
  // not expose. Construction and both snapshots issue no GPU commands.
  assert.throws(() => Array.from(adapter.targets.values()), TypeError);
  const row = snapshotRenderEndpoints(endpoints).endpoints[0];
  assert.equal(row.adapterPresent,true);
  assert.equal(row.targetsAvailable,false);
  assert.equal(row.targets,null);
  assert.equal(row.stats,null);
  assert.match(row.targetsUnavailableReason,/no target collection/);
  assert.deepEqual(row.control,[1,1153,0,0,576,576]);
  assert.equal(adapter.d3dimSoftwareDrawCallsCompleted,0);
  // The exact serialized function is what a Worker evaluation executes.
  const evaluate = require('node:vm').runInNewContext('('+snapshotRenderEndpoints.toString()+')', {performance});
  assert.equal(evaluate(endpoints).endpoints[0].targets,null);
  adapter.destroy();
});

test('passive target evidence preserves exposed maps and refuses malformed collections', () => {
  const {snapshotRenderEndpoints:snapshot} = require('./mw3-passive-render-snapshot.cjs');
  const targets=new Map([[7,{width:640,height:480,bpp:16,format:'rgb565',nativeStorage:{}}]]);
  const entry={adapter:{targets},options:{api:'gl'}};
  const row=snapshot(new Map([[1,entry]])).endpoints[0];
  assert.equal(row.targetsAvailable,true);
  assert.equal(row.targetsUnavailableReason,null);
  assert.deepEqual(row.targets,[{width:640,height:480,bpp:16,format:'rgb565',nativeStorage:true}]);
  assert.equal(targets.size,1);
  entry.adapter.targets={};
  assert.throws(()=>snapshot(new Map([[1,entry]])),/target collection unsupported/);
});
