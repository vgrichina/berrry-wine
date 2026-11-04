'use strict';
// Contract/composition tests only: no Chrome, HTTP or original game attempt.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const api=require('../tools/stronghold-local-runtime.cjs'),base=require('../tools/stronghold-preset-driver-attachment.cjs');
const run=path.resolve('scratch/runs/20261104-stronghold-route-recognition-handoff/contract-test');
fs.mkdirSync(run,{recursive:true});
const pins=path.join(run,'pins.json');
fs.writeFileSync(pins,JSON.stringify({files:['build/wine-assembly.wasm','build/wine-assembly.compat.wasm'].map(file=>({path:file,sha256:base.hash(fs.readFileSync(file))}))}));
const nonce='a'.repeat(64),now=Date.parse('2026-11-04T17:45:00Z');
const release=api.createRelease({run,pins,nonce,now});
assert.equal(api.validateRelease(release,{run,pins,nonce,now}),release);
assert.equal(release.identity.pid,process.pid);assert.equal(release.identity.hostname,require('os').hostname());
const negatives=[];
function reject(name,mutate,pattern=/required|identity|binding|deadline|authorization/){
 const r=structuredClone(release),o={run,pins,nonce,now};mutate(r,o);
 assert.throws(()=>api.validateRelease(r,o),pattern,name);negatives.push(name);
}
reject('missing authorization',r=>delete r.authorization);
reject('missing current authorization',r=>delete r.freshLocalDiagnosticAuthorized);
reject('foreign assignment',r=>r.assignment='foreign');
reject('expired predecessor authorization',r=>r.assignment='stronghold-portable-local-runtime user task');
reject('previous title assignment',r=>r.assignment='stronghold-title-recognition-onward user task');
reject('previous menu assignment',r=>r.assignment='stronghold-menu-recognition-onward user task');
reject('previous ChooseType assignment',r=>r.assignment='stronghold-choosetype-recognition-onward user task');
reject('foreign shutdown owner',r=>r.shutdownOwner='worker');
reject('box as local',r=>r.kind='leased-box');
reject('fake box ID',r=>r.boxId='bx_local');
reject('box TTL in local',r=>r.expiry='2026-11-05T00:00:00Z');
reject('foreign process',r=>r.identity.pid++);
reject('recycled process',r=>r.identity.startTicks+='0');
reject('foreign boot',r=>r.identity.bootId='foreign');
reject('foreign host',r=>r.identity.hostname='foreign');
reject('foreign checkout',r=>r.identity.root='/foreign');
reject('foreign run',r=>r.binding.run+='/foreign');
reject('foreign pins',r=>r.binding.pins+='.foreign');
reject('stale manifest',r=>r.binding.pinsSHA256='0'.repeat(64));
reject('stale module',r=>r.binding.modules[0].sha256='0'.repeat(64));
reject('stale nonce',r=>r.nonce='b'.repeat(64));
reject('missing nonce',(_,o)=>delete o.nonce);
reject('stale issue',(_,o)=>o.now+=60001);
reject('future issue',r=>r.issuedAt++);
reject('expired',r=>r.closeBy=now);
reject('infinite deadline',r=>r.closeBy=Infinity);
reject('extended browser cap',r=>r.closeBy=r.issuedAt+720001);
reject('extended cutoff',r=>r.chromeCutoff=api.CUTOFF+1);
reject('extended cleanup',r=>{r.cleanupBy=api.CLEANUP+1;r.expiresAt=r.cleanupBy;});
reject('insufficient runtime reserve',r=>r.chromeCutoff=r.issuedAt+719999);
reject('insufficient cleanup reserve',r=>{r.cleanupBy=r.issuedAt+899999;r.expiresAt=r.cleanupBy;});
reject('expired process contract',r=>r.expiresAt=now);
assert.throws(()=>api.createRelease({run,pins,nonce,now:api.CUTOFF-719999}),/deadline/);
const child=execFileSync(process.execPath,['-e',`const a=require('./tools/stronghold-local-runtime.cjs');try{a.validateRelease(${JSON.stringify(release)},${JSON.stringify({run,pins,nonce,now})});process.exit(9)}catch(e){if(!/identity/.test(e.message))throw e;console.log('foreign actual child rejected')}`],{encoding:'utf8'}).trim();
assert.equal(child,'foreign actual child rejected');
// The unchanged predecessor's leased-box branch must reject this local record.
const original=base.retained(path.resolve(base.ORIGINAL)).toString();
const boxStart=original.indexOf("  if(release.authorization!=="),boxEnd=original.indexOf("  if(fs.existsSync(OUT))",boxStart);
assert(boxStart>0&&boxEnd>boxStart);
assert.throws(()=>vm.runInNewContext(original.slice(boxStart,boxEnd),{release,Date:{now:()=>now,parse:Date.parse}}),/fresh authorized finite TTL/);
const p=api.prepare({run,pins});new vm.Script(p.source);new vm.Script(p.route);
const cut=p.source.lastIndexOf('main().catch(');assert(cut>10000);
base.compileClosure(p.source.slice(0,cut),p.driver,p.route,p.evidence.retainedClosure);
assert.equal(p.evidence.retainedClosure.length,30);
assert.deepEqual(p.evidence.bounds,{navigation:16384,route:4096,arrival:3072,stability:768,perACK:64,commandMs:40000,chromeMs:720000});
assert(p.source.includes('installBeforeFirstScript'));assert(p.source.includes('activeReplyDeadline>Date.now()+40000'));
assert(p.source.includes('fresh authorized finite TTL required')===false);
assert(p.source.includes('one original launch only'));assert(p.source.includes('stale capture-bound review'));
assert(p.source.includes('executablePath:"/opt/google/chrome/chrome"'));
assert(p.route.includes('shellSamples>=4'));assert(p.route.includes('assertHistoricalShell(cap.png)'));
assert(p.route.includes('arrival===3072'));assert(p.route.includes('diagnostic scene20 observed; no readiness grant'));
// Execute the composed entry's actual guards, ending before its first side effect.
const start=p.source.indexOf('async function main(){'),end=p.source.indexOf("  if(fs.existsSync(OUT))throw Error('one original launch only');",start);
assert(start>0&&end>start);
fs.writeFileSync(path.join(run,'runtime-release.json'),JSON.stringify(release));
const guarded=p.source.slice(start,end)+'return true;\n}main();';
// The embedded random nonce must reject another preparation's release.
(async()=>{
 await assert.rejects(vm.runInNewContext(guarded,{require,fs,path,RUN:run}),/nonce/);
 // Use this exact preparation's nonce and actual process, without launching.
 const embedded=JSON.parse(p.source.match(/nonce:("[a-f0-9]{64}")/)[1]);
 const actual=api.createRelease({run,pins,nonce:embedded,now});
 const testRequire=id=>id===require.resolve('../tools/stronghold-local-runtime.cjs')
  ?{...api,validateRelease:(r,o)=>api.validateRelease(r,{...o,now})}:require(id);
 fs.writeFileSync(path.join(run,'runtime-release.json'),JSON.stringify(actual));
 assert.equal(await vm.runInNewContext(guarded,{require:testRequire,fs,path,RUN:run}),true);
 delete actual.authorization;fs.writeFileSync(path.join(run,'runtime-release.json'),JSON.stringify(actual));
 await assert.rejects(vm.runInNewContext(guarded,{require,fs,path,RUN:run}),/authorization/);
 console.log(JSON.stringify({pass:true,negativeContracts:negatives,actualChildRejected:true,retainedHelpers:30,bounds:p.evidence.bounds}));
})().catch(e=>{console.error(e);process.exitCode=1;});
