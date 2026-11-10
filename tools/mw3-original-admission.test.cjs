'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {verifyInputs, admitOriginal} = require('./mw3-original-admission.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mw3-admission-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const requiredPaths = ['browser.cjs', 'isolation-page.html'];
  const files = requiredPaths.map(name => {
    const bytes = Buffer.from(name.endsWith('.html') ? '<script src="/lib/guest-rpc.js"></script>' : '// candidate');
    fs.writeFileSync(path.join(root, name), bytes);
    return {path:name, size:bytes.length, sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  });
  const state = Array(16).fill(0); state[12] = 128;
  const control = mode => ({mode, isolated:true, installed:true,
    capture:{beforeInstantiation:true, imports:[{module:'host', kind:'function', name:'get_mouse_buttons_live'}]}, state,
    trace:{drops:0, errors:[], reads:[{eax:0,state,size:16,buffer:0x530000,esp:0x510000,
      completionEsp:0x510010,requestAt:1,at:2,requestMono:1,completionMono:2}], imports:[{name:'get_mouse_buttons_live'}]}});
  return {root, requiredPaths, pins:{files, uploadFiles:structuredClone(files)}, candidatePath:'browser.cjs',
    candidate:{passed:true, exactCandidateSHA256:files[0].sha256},
    parent:{passed:true, originalLaunches:0, rows:[{code:0, actualParentWait:true, readersJoined:true, separateEOF:{stdout:true, stderr:true}}]},
    chrome:{code:0, signal:null, actualWait:true, separateEOF:{stdout:true,stderr:true}},
    production:{passed:true, fixtureOnly:true, moduleSHA256:'e'.repeat(64), controls:['unwrapped','inactive','active'].map(control)}, expectedModule:'e'.repeat(64)};
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
    f=>f.production.controls[2].capture.imports=[]]) {
    const f=structuredClone(baseline);mutate(f);let starts=0;
    assert.throws(()=>{admitOriginal(f);starts++});assert.equal(starts,0);
  }
});
test('exact staged graph and completed controls admit once at caller boundary', t => {
  const f=fixture(t);assert.equal(admitOriginal(f).passed,true);
  fs.appendFileSync(path.join(f.root,'browser.cjs'),'changed');
  assert.throws(()=>admitOriginal(f),/runtime input size/);
});
