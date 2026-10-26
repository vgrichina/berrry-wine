'use strict';
// Independent synthetic export-boundary challenges; no native/Wasm execution.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=process.env.MNE_REVIEW_REPO;
const h=require(path.join(root,'tools/maelstrom-native-errno-latch.cjs'));
const {createAdapter}=require(path.join(root,'tools/maelstrom-original-errno-adapter.cjs'));
const SELECT=['started','phase','token','entries','parks','completions','fault','capped','active','thread','regs','pre','post','ret','result'];
function fixture(legacy=false){
 const n=Object.fromEntries(h.FIELDS.map(k=>[k,0])),effects=[],rows=[];
 let reads=0,liveHook=()=>{},persistHook=()=>{};
 const e={mne_start(){effects.push('start');n.status=1;}};
 for(const k of h.FIELDS)e['mne_'+k]=()=>{reads++;return n[k];};
 if(!legacy)for(const k of h.DIAGNOSTIC_FIELDS)e['mne_'+k]=()=>{reads++;return 0;};
 for(const k of SELECT)e['msc_'+k]=()=>{reads++;return 0;};
 const a=createAdapter({exports:e},{readLive(){effects.push('live');liveHook();return {eax:999};},persist(r){effects.push('persist');rows.push(r);persistHook(r);}});
 return {n,e,a,effects,rows,reads:()=>reads,hooks(l,p){liveHook=l||(()=>{});persistHook=p||(()=>{});}};
}
const results=[];let cases=0;
function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}}
function state(f,s,e){Object.assign(f.n,{status:s,event:e});}
function closed(f){const count=f.reads(),effects=f.effects.length;assert.equal(f.a.observe(999),null);assert.equal(f.reads(),count,'terminal adapter must close before further export reads');assert.equal(f.effects.length,effects);assert.throws(()=>f.a.start(),/one invocation/);}
for(const legacy of [false,true]){
 test('legal monotonic and skipped observations; legacy='+legacy,()=>{
  for(const seq of [[[1,0],[2,1],[3,2],[4,3]],[[2,1],[4,3]],[[3,2],[4,3]],[[4,3]],[[1,0],[1,0],[3,2],[4,3]]]){
   const f=fixture(legacy);f.a.start();
   for(const [s,e]of seq){state(f,s,e);f.a.observe(cases++);}
   closed(f);assert.equal(f.rows.at(-1).kind,'captured');
  }
 });
 test('all reachable rejection event stages close; legacy='+legacy,()=>{
  for(const [prior,ev]of [[1,0],[1,1],[1,2],[2,1],[2,2],[3,2]]){
   const f=fixture(legacy);f.a.start();if(prior>1){state(f,prior,prior-1);f.a.observe(0);}
   state(f,5,ev);assert.throws(()=>f.a.observe(1),/status rejection/);closed(f);assert.equal(f.rows.at(-1).kind,'rejected');cases++;
  }
 });
 test('backward and illegal skips reject before callbacks; legacy='+legacy,()=>{
  for(const [prior,s,e]of [[1,0,0],[2,1,0],[3,2,1],[2,5,0],[3,5,0],[3,5,1]]){
   const f=fixture(legacy);f.a.start();if(prior>1){state(f,prior,prior-1);f.a.observe(0);}
   const count=f.effects.length;state(f,s,e);assert.throws(()=>f.a.observe(1),/invalid native/);assert.equal(f.effects.length,count);closed(f);cases++;
  }
 });
 test('pristine start cannot skip native start state; legacy='+legacy,()=>{
  for(const [s,e]of [[2,1],[3,2],[4,3]]){
   const f=fixture(legacy);f.e.mne_start=()=>state(f,s,e);assert.throws(()=>f.a.start(),/invalid native/);assert.equal(f.effects.length,0);closed(f);cases++;
  }
 });
 test('callback order and historical snapshot survives live export mutation; legacy='+legacy,()=>{
  const f=fixture(legacy);f.a.start();f.effects.length=0;state(f,4,3);f.n.errno=-1;
  f.hooks(()=>{f.n.errno=77;f.n.status=1;},()=>{f.n.errno=88;});
  const r=f.a.observe(1);assert.deepEqual(f.effects,['live','persist']);assert.equal(r.historicalNativeLatch.status,4);assert.equal(r.historicalNativeLatch.errno,0xffffffff);closed(f);cases++;
 });
 for(const terminal of [[4,3],[5,0],[5,1],[5,2]])for(const which of ['live','persist'])test('terminal callback throw closes '+terminal+' '+which+' legacy='+legacy,()=>{
  const f=fixture(legacy);f.a.start();f.effects.length=0;state(f,...terminal);
  const sentinel=Error('callback sentinel');f.hooks(which==='live'?()=>{throw sentinel;}:null,which==='persist'?()=>{throw sentinel;}:null);
  assert.throws(()=>f.a.observe(1),e=>e===sentinel);
  assert.deepEqual(f.effects,which==='live'?['live']:['live','persist']);
  closed(f);cases++;
 });
}
const report={candidate:'7508a8c20f8dd172a1a341112695ba5e4f72918d',passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,cases,results,syntheticBoundaryOnly:true,authenticBatch36170Cause:'UNKNOWN'};
fs.writeFileSync(path.join(__dirname,'remaining-results.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,failed:report.failed,cases,failures:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error.split('\n').slice(0,2).join(' ')}))},null,2));
process.exitCode=report.failed?1:0;
