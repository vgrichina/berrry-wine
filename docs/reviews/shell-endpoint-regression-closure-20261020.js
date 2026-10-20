#!/usr/bin/env node
'use strict';
// Run at repository root. Read-only source-slice acceptance and rejecting controls.
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const source=process.env.SOURCE_REV || '1e31aed6e412219bda266befbdc12c6b7e1f583f';
const base='ee129daaf02d3398442c34d42e8aa67fb618771e';
const prefix='docs/reviews/',nested='docs/re-notes/process-alias-correct-port-20261020.js';
const predecessor=prefix+'shell-skipped-child-lifetime-20261020.js';
const independent=prefix+'shell-endpoint-independent-accept-20261020.js';
const submitted=prefix+'shell-endpoint-lifetime-fix-20261020.js';
const lifecycle=prefix+'shell-endpoint-fixture-reconcile-20261020.js';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',maxBuffer:8e6});
const production=['host.js','lib/browser-shell.js','lib/vlan-wire.js','lib/thread-manager.js',
  'lib/host-imports.js','test/run.js','test/test-child-process-object.js',
  'src/09a0-handlers-base.wat','src/09a0b-handlers-base-late.wat','src/09a7d-handlers-shell-file.wat'];
const fixtures=[predecessor,independent,submitted,lifecycle,nested,
  prefix+'process-alias-boundary-fix-20261020.js',prefix+'shell-endpoint-regression-closure-20261020.js'];
const seals={},records=[];
for(const p of production) {
  const bytes=fs.readFileSync(p);
  assert.equal(hash(bytes),hash(git('show',`${source}:${p}`)),`exact candidate ${p}`);
  seals[p]={sha256:hash(bytes),blob:git('rev-parse',`${source}:${p}`).trim(),source};
}
for(const p of fixtures)seals[p]={sha256:hash(fs.readFileSync(p)),source:'checkout fixture'};
// Transitive historical compiler/pipe helpers and unchanged-source comparisons.
const historic='a54049d11955307d06309e146e85c1aca3196657';
for(const [rev,paths] of [
  [historic,['host.js','lib/browser-shell.js','src/09d7-pipes.wat',
    ...['compiler-parser','compiler-stages','compiler-codegen','compiler'].map(n=>`tools/watx-src/${n}.js`)]],
  ['978018d85f28b76f04e9b67b7f1009904391b632',['lib/browser-shell.js']],
  [base,['host.js','lib/browser-shell.js','lib/vlan-wire.js','lib/thread-manager.js']],
])for(const p of paths)seals[`${rev}:${p}`]={sha256:hash(git('show',`${rev}:${p}`)),blob:git('rev-parse',`${rev}:${p}`).trim(),source:rev};
function run(name,file,args=[],env={},reject=null) {
  const command=[file,...args];
  const r=cp.spawnSync(process.execPath,command,{encoding:'utf8',maxBuffer:2e6,timeout:120000,
    env:{...process.env,SOURCE_REV:source,MUTATION:'',ALIAS_BASELINE:'',ALIAS_FILTER:'',...env}});
  const record={name,command,env:{SOURCE_REV:source,...env},expected:reject?1:0,
    status:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message};
  records.push(record);
  assert.equal(r.status,record.expected,JSON.stringify(record));
  if(reject)assert.match(r.stdout+r.stderr,reject,`reject at behavioral oracle: ${name}`);
}
run('predecessor',predecessor);
run('regression',predecessor,['--regression']);
run('nested standalone',nested);
run('independent',independent);
run('submitted',submitted);
run('fixture lifecycle',lifecycle);
run('fixture retain-child',lifecycle,['--retain-child'],{},/completed child endpoint must leave segment/);
run('predecessor baseline',predecessor,['--baseline'],{},/existing already-satisfied launch must complete/);
for(const [label,file] of [['independent',independent],['submitted',submitted]]) {
  run(`${label} baseline`,file,[],{SOURCE_REV:base},/completed no-child launch must release its unused endpoint/);
  for(const mutation of label==='independent'?['retain-child','close-caller','mutable-broadcast']:
    ['retain-child','close-caller','early-close','double-eof','retain-inbox','mutable-broadcast']) {
    const oracle={
      'retain-child':/completed no-child launch must release its unused endpoint/,
      'close-caller':/caller pipe endpoint must remain attached|0 !== 1/,
      'early-close':/pending launch owns live endpoint/,
      'double-eof':/2 !== 1/,
      'retain-inbox':/retired child releases queued frames/,
      'mutable-broadcast':/self-retirement cannot skip next recipient|one broadcast delivery to live recipient/,
    }[mutation];
    run(`${label} ${mutation}`,file,[],{MUTATION:mutation},oracle);
  }
}
// Exercise the repaired nested oracle with one exact production mutation.
// fs interception changes only the read host blob in memory, never the checkout.
const control=`
const fs=require('node:fs'),assert=require('node:assert/strict'),read=fs.readFileSync;
fs.readFileSync=function(p,...args){
 let s=read.call(this,p,...args);
 if(p==='host.js'){
  const target='if (childWire) childWire.close();';
  assert.equal(s.split(target).length,2);
  s=s.replace(target,'');
 }
 return s;
};
require('./${nested}');`;
run('nested callback retain-child','-e',[control],{},/callback retires only child endpoint/);
for(const p of [...production,...fixtures])assert.equal(hash(fs.readFileSync(p)),seals[p].sha256,`input unchanged ${p}`);
console.log(JSON.stringify({verdict:'ACCEPT_SOURCE_FIXTURE_CLOSURE',source,records,seals,
  limits:'Exact JS source functions/full wire and small compiled process/wait WAT slices. Explicit environment fixtures; no full build, guest, browser, Worker IPC, game, heap or runtime qualification.'},null,2));
