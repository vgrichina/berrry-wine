'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const file=path.join(__dirname,'message-completion-owner.js'),source=fs.readFileSync(file,'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(sha(source),'5feb6cd914a7c93e58b719107887960783883d78af6c18ce7a45e79e1f077f0c');
function factory(s=source){const box={module:{exports:{}}};vm.runInNewContext(s,box,{filename:file});return box.module.exports.createMessageCompletionOwner;}
const original=factory();let cases=0;
function schedule(make=original){
 const seen=[],tokens=[],expected=[];let gaps=0;
 const o=make({enabled:()=>true,observe:d=>{seen.push(JSON.parse(JSON.stringify(d)));},gap:()=>gaps++}),i=o.imports;
 for(let n=0;n<96;n++){
  const args=[n%4+1,1,1000+n*100,20000+n*28,n,0x100,0x300,n%2],t=i.message_begin(...args);assert(t>0);tokens.push(t);
  if(n%3===0){i.message_park(t);i.message_complete(t,999);assert.equal(i.message_begin(...args),t,'park reentry conserves token');}
  i.message_bind(t,n%2+1,30000+n*32);i.message_complete(t,888);
 }
 assert.equal(seen.length,0,'bound/parked tokens cannot publish stale EAX');
 // Independent asynchronous ownership schedule: reverse order, unrelated context/kind,
 // double resume, duplicates, and stale tokens after slots are reused.
 for(let n=95;n>=0;n--){
  const kind=n%2+1,ctx=30000+n*32,t=tokens[n];
  assert.equal(i.message_resume(3-kind,ctx),0);assert.equal(i.message_resume(kind,ctx+1),0);
  assert.equal(i.message_resume(kind,ctx),t);assert.equal(i.message_resume(kind,ctx),0,'resume consumes continuation binding');
  if(n%4===0){i.message_bind(t,3-kind,ctx+100000);assert.equal(i.message_resume(3-kind,ctx+100000),t);}
  i.message_complete(t,n);expected.push(t);i.message_complete(t,-1);
 }
 assert.deepEqual(seen.map(d=>d.invocation),expected);assert.equal(new Set(expected).size,96);assert.equal(gaps,0);
 for(let n=0;n<300;n++){const t=i.message_begin(3,1,1000,2000,0,0,0,1);assert(t>96);i.message_complete(tokens[n%96],100);i.message_complete(t,1);}
 assert.equal(seen.length,396);assert.equal(gaps,0);assert.equal(o.status().backingBytes,6144);cases++;
}
function capacity(make=original){
 let gaps=0,count=0;const o=make({enabled:()=>true,observe:()=>count++,gap:()=>gaps++}),i=o.imports,ts=[];
 for(let n=0;n<128;n++){let t=i.message_begin(n%4+1,1,1000+n*4,2000,0,0,0,1);assert(t>0);ts.push(t);if(n%2)i.message_park(t);else i.message_bind(t,2,3000+n*4);}
 assert.equal(i.message_begin(1,1,99999,2000,0,0,0,1),0);assert.equal(gaps,1);assert.equal(o.status().lost,true);
 for(let n=0;n<128;n++){const t=ts[n];if(n%2)i.message_begin(n%4+1,1,1000+n*4,2000,0,0,0,1);else i.message_resume(2,3000+n*4);i.message_complete(t,1);}
 assert.equal(count,0,'loss suppresses ownership claims');assert.equal(i.message_begin(1,1,500,2000,0,0,0,1),0);assert.equal(gaps,1);cases++;
}
function mismatch(make=original){
 let count=0,gaps=0;const o=make({enabled:()=>true,observe:()=>count++,gap:()=>gaps++}),i=o.imports;
 const args=[2,1,1000,2000,100,0,999,0],t=i.message_begin(...args);i.message_park(t);args[3]++;
 assert.equal(i.message_begin(...args),0);assert.equal(gaps,1);i.message_complete(t,1);assert.equal(count,0);cases++;
}
function collision(make=original){
 let gaps=0,count=0;const o=make({enabled:()=>true,observe:()=>count++,gap:()=>gaps++}),i=o.imports;
 const a=i.message_begin(1,1,1000,2000,0,0,0,0),b=i.message_begin(4,1,1200,2400,0,0,0,1);i.message_bind(a,2,1300);i.message_bind(b,2,1300);
 assert.equal(o.status().lost,true);assert.equal(gaps,1);assert.equal(i.message_resume(2,1300),0);i.message_complete(a,1);i.message_complete(b,1);assert.equal(count,0);cases++;
}
schedule();capacity();mismatch();collision();
const controls=[];
for(const [name,a,b,oracle] of [
 ['bound-state-guard','if (p < 0 || slots[p] !== 1) return;','if (p < 0) return;',schedule],
 ['terminal-slot-consumption','slots[p] = 0;','/* omitted terminal slot consumption */',schedule],
 ['retry-argument-identity','!args.every((v, i) => slots[p + 2 + i] === v)','false',mismatch],
 ['collision-invalidates-context','slots[p] = slots[q] = 4;','/* omitted collision invalidation */',collision],
 ['loss-suppresses-observation','enabled() && !lost','enabled()',capacity],
]){assert(source.includes(a));const mutant=factory(source.replace(a,b));assert.throws(()=>oracle(mutant),assert.AssertionError,name);controls.push({name,rejected:true});}
fs.writeFileSync(path.join(process.argv[2],'ownership-result.json'),JSON.stringify({pass:true,candidate:'e8bceb042bc3eff6bab73642988be29a7522287e',sourceSHA256:sha(source),cases,completedSchedule:396,capacity:128,controls,compiled:false,canonicalRuntimeQualified:false,qualification:'Exact production JS owner; deterministic independent deferred schedule. No real guest threads or host event-loop continuation execution.'},null,2));
console.log('PASS independent ownership schedule396 completions + capacity/collision/identity; 5 omissions rejected');
