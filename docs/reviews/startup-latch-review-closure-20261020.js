'use strict';
// Run from the isolated repository. Preserved artifacts are read-only inputs.
// This closes an interrupted review; it deliberately does not rerun passed suites.
const fs = require('fs'), cp = require('child_process'), path = require('path');
const crypto = require('crypto'), assert = require('assert/strict');
const REV = 'aa8f7e23362eca7db7a71beb3deab3f20bbb916e';
const ORIGINAL = 'b09ba2e350bf8789210c8bf6ad2fa3299b15045b';
const BASE = '8bcd437fa4852417b13d375e54e07280621a161a';
const out = path.resolve('..'), runs = path.dirname(out);
const old = path.join(runs, '20261020-startup-latch-independent-final-oct20');
const baseline = path.join(runs, '20261020-shell-startup-independent-accept-oct20');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const audit = {revision:REV, node:process.version, artifacts:[], inputSeals:{}, modules:{}, guards:[], replays:[]};
function bytes(d) {
  let n = 0;
  for (const e of fs.readdirSync(d, {withFileTypes:true})) {
    const p = path.join(d,e.name), s = fs.lstatSync(p);
    n += s.blocks * 512;
    if (e.isDirectory()) n += bytes(p);
  }
  return n;
}
function guard(reserve = 1024*1024) {
  const s = fs.statfsSync(out), available = s.bavail*s.bsize, allocated = bytes(out);
  assert(available-reserve >= 2285895680, `RESOURCE BLOCKER available=${available} reserve=${reserve}`);
  assert(allocated+reserve <= 16777216, `CAP BLOCKER allocated=${allocated} reserve=${reserve}`);
  audit.guards.push({available,allocated,reserve});
}
function write(p, text) { guard(Buffer.byteLength(text)+8192); fs.writeFileSync(p,text); }
const cache = new Map();
function blob(p, rev=REV) {
  const key=rev+':'+p;
  if (!cache.has(key)) cache.set(key,cp.execFileSync('git',['show',key],{maxBuffer:32*1024*1024}));
  return cache.get(key);
}
function verify(file, rev=REV) {
  const raw = fs.readFileSync(file), j = JSON.parse(raw);
  assert(j.inputs && Object.keys(j.inputs).length, 'missing input seals: '+file);
  for (const [p,hash] of Object.entries(j.inputs)) {
    assert.equal(sha(blob(p,rev)),hash,`${file}: ${rev}:${p}`);
    audit.inputSeals[rev+':'+p] = hash;
  }
  for (const field of ['assembler','machinery']) if(j[field]) {
    const x=j[field]; assert.equal(sha(blob(x.path,x.revision||REV)),x.sha256);
    audit.inputSeals[(x.revision||REV)+':'+x.path]=x.sha256;
  }
  if(j.effectiveInputs) for(const [p,hash] of Object.entries(j.effectiveInputs)) {
    if(hash!==j.inputs[p]) assert(j.controls.some(c=>c.path===p&&c.before===j.inputs[p]&&c.after===hash));
  }
  audit.artifacts.push({file,sha256:sha(raw),revision:rev,inputs:Object.keys(j.inputs).length,
    status:j.status,checks:j.checks?.length,acceptance:j.acceptance?.length,probes:j.probes?.length});
  if(j.modules?.length) {
    const {source,wasm,bytes}=j.modules.at(-1); audit.modules[path.basename(file)]={source,wasm,bytes};
  }
  return j;
}
function preserve() {
  const setup=json(out+'/setup.json');
  for(const [p,h] of Object.entries({...setup.seals,...setup.oldFiles})) assert.equal(sha(fs.readFileSync(p)),h,'preservation '+p);
}
function inventory() {
  preserve();
  const independent=verify(old+'/independent.json');
  assert.equal(independent.status,'ACCEPT_SOURCE_SLICES');
  assert.equal(independent.acceptance.length,24); assert.equal(independent.failures.length,0);
  const fixture=verify(old+'/fixture.json'); assert.equal(fixture.checks.length,24);
  assert.equal(fixture.status,'complete-source-paths-pass');
  const validation=verify(old+'/validation.json'); assert.equal(validation.checks.length,59);
  assert.equal(validation.controls.length,3);
  const submitted=verify(old+'/submitted-acceptance.json'); assert.equal(submitted.status,'acceptance-passed');
  assert.equal(submitted.probes.length,21); // 18 acceptance groups plus 3 inherited observations.
  const controls=json(old+'/controls.json'); assert.equal(controls.length,7);
  for(const c of controls) {
    const j=verify(old+'/control-'+c.label+'.json',c.env.REVIEW_REV||REV);
    assert.equal(c.exit,1); assert(c.behavioralRejection);
    assert(j.failures.length && j.failures.every(f=>f.error.startsWith('AssertionError')));
    assert(!j.failures.some(f=>/target absent|UNIMPLEMENTED FIXTURE|CompileError/.test(f.error)));
  }
  for(const m of ['explicit','info','continuation','renderer']) {
    const j=verify(old+'/negative-'+m+'.json'); assert.equal(j.mutation,m);
    assert(j.error.startsWith('AssertionError')); assert(!/mutation target missing/.test(j.error));
  }
  for(const name of ['dialog-marker','nested','removed']) {
    const j=verify(baseline+'/baseline-'+name+'.json',BASE);
    assert.equal(j.probes.length,1);
    assert(!j.probes[0].error);
  }
  // The interrupted independent script is WIP, so seal its bytes explicitly.
  const p=old+'/repo/docs/reviews/startup-latch-independent-final-20261020.js';
  audit.independentOracle={path:p,sha256:sha(fs.readFileSync(p))};
  audit.inventory={
    reused:'24 independent groups; 24 submitted cases; 59 validation checks; 18 repair acceptance groups; 3 inherited observations; 7 independent and 4 submitted rejecting controls; 3 transport controls',
    missing:['submitted iconic mutation','submitted retval mutation'],
    excluded:['fixture-expansion-limit.json: superseded harness expansion attempt','creation/activation historical mutation targets: selection boundary moved; early/commit/ownership controls cover it'],
  };
}
function replay(m) {
  guard(2*1024*1024);
  const p='docs/reviews/shell-startup-complete-path-fix-20261020.js';
  let text=blob(p).toString();
  const before="let s = fs.existsSync(p) ? fs.readFileSync(p, 'utf8')\n    : cp.execFileSync('git', ['show', `${BASE}:${p}`], {encoding:'utf8',maxBuffer:32*1024*1024});";
  assert(text.includes(before));
  text=text.replace(before,`let s = cp.execFileSync('git', ['show', '${REV}:'+p], {encoding:'utf8',maxBuffer:32*1024*1024});`);
  // Preserve every assertion and mutation; replace only the reader to prevent
  // sparse-missing paths from silently using the historical baseline.
  const r=cp.spawnSync(process.execPath,['-e',text],{env:{...process.env,STARTUP_MUTATION:m},encoding:'utf8',maxBuffer:1024*1024});
  write(out+'/negative-'+m+'.log',(r.stdout||'')+(r.stderr||''));
  assert.equal(r.status,1);
  const j=verify(out+'/negative-'+m+'.json'); assert.equal(j.mutation,m);
  assert(j.error?.startsWith('AssertionError'));
  assert(!/mutation target missing|UNIMPLEMENTED FIXTURE|CompileError/.test(j.error));
  audit.replays.push({mutation:m,exit:r.status,scriptSha256:sha(text),originalScriptSha256:sha(blob(p)),error:j.error});
}
inventory();
if(process.argv.includes('--complete')) for(const m of ['iconic','retval']) replay(m);
preserve();
audit.status=process.argv.includes('--complete')?'ACCEPT_SOURCE_SLICES':'PROVENANCE_VERIFIED';
write(out+(process.argv.includes('--complete')?'/closure.json':'/inventory.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({status:audit.status,seals:Object.keys(audit.inputSeals).length,replays:audit.replays.length,allocated:bytes(out)}));
