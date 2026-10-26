'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=process.env.MNE_REVIEW_REPO;
const H=require(path.join(root,'tools/maelstrom-native-errno-latch.cjs'));
const {createAdapter}=require(path.join(root,'tools/maelstrom-original-errno-adapter.cjs'));
const SELECT=['started','phase','token','entries','parks','completions','fault','capped','active','thread','regs','pre','post','ret','result'];
let cases=0;const results=[];
function test(name,fn){try{fn();cases++;results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:String(e.stack||e)});}}
function fixture(legacy){
 const n=Object.fromEntries(H.FIELDS.map(k=>[k,0])),d=Object.fromEntries(H.DIAGNOSTIC_FIELDS.map(k=>[k,0])),s=Object.fromEntries(SELECT.map(k=>[k,0]));
 const count={},effects=[],rows=[];let live=()=>{},persist=()=>{};
 const e={mne_start(){n.status=1;}};
 for(const [prefix,fields,values] of [['mne_',H.FIELDS,n],...(!legacy?[['mne_',H.DIAGNOSTIC_FIELDS,d]]:[]),['msc_',SELECT,s]])
  for(const k of fields){count[prefix+k]=0;e[prefix+k]=()=>{count[prefix+k]++;return values[k];};}
 const a=createAdapter({exports:e},{readLive(){effects.push('live');live();return {sentinel:'live'};},persist(r){effects.push('persist');rows.push(r);persist(r);}});
 a.start();effects.length=0;rows.length=0;
 return {n,d,s,e,count,effects,rows,a,hooks(l,p){live=l||(()=>{});persist=p||(()=>{});}};
}
function poison(f){for(const k of Object.keys(f.count))f.e[k]=()=>{throw Error('post-terminal export '+k);};for(const obj of [f.n,f.d,f.s])for(const k of Object.keys(obj))obj[k]=0x12345678;}
function noRead(f){const before={...f.count},effects=f.effects.length;assert.equal(f.a.observe(444),null);assert.deepEqual(f.count,before);assert.equal(f.effects.length,effects);}
function diag(f,reason){
 Object.assign(f.d,{rejectReason:reason,rejectExpectedRet:H.SELECT_RETURN,rejectObservedRet:H.SELECT_RETURN,rejectPhase:3,rejectCompletions:1});
 if(reason<=3)f.d.rejectModes=1<<(reason-1);
 else f.d[({4:'rejectObservedRet',5:'rejectPhase',6:'rejectCompletions',7:'rejectFault',8:'rejectActive',9:'rejectCapped'})[reason]]=reason===4?H.SELECT_RETURN+1:reason<=6?0:1;
}
const variants=[];
for(const legacy of [true,false])for(const [status,event] of [[4,3],[5,0],[5,1],[5,2]])variants.push({legacy,status,event,reason:0});
for(let reason=1;reason<=9;reason++)variants.push({legacy:false,status:5,event:0,reason});
const markers=[{kind:'return',value:null},{kind:'error',value:Error('identity')},{kind:'object',value:{tag:'identity'}},{kind:'undefined',value:undefined},{kind:'symbol',value:Symbol('identity')}];
for(const v of variants)for(const which of ['live','persist'])for(const marker of markers)test(JSON.stringify(v)+' '+which+' '+marker.kind,()=>{
 const f=fixture(v.legacy);Object.assign(f.n,{status:v.status,event:v.event});if(v.status===4)f.n.errno=-1;if(v.reason)diag(f,v.reason);
 Object.assign(f.s,{token:42,result:-1});const prior={...f.count};
 const check=r=>{assert.equal(r.historicalNativeLatch.status,v.status);assert.equal(r.historicalNativeLatch.event,v.event);assert.equal(r.historicalNativeLatch.errno,v.status===4?0xffffffff:0);assert.equal(r.historicalSelectLatch.token,42);assert.equal(r.historicalSelectLatch.result,0xffffffff);if(!v.legacy)assert.equal(r.historicalNativeRejection?.reason||0,v.reason);};
 const hook=r=>{for(const k of Object.keys(prior))assert.equal(f.count[k],prior[k]+1,'exactly one read '+k);if(r)check(r);noRead(f);poison(f);noRead(f);if(marker.kind!=='return')throw marker.value;};
 f.hooks(which==='live'?()=>hook():null,which==='persist'?hook:check);
 let returned,caught=false,error;try{returned=f.a.observe(73);}catch(e){caught=true;error=e;}
 if(marker.kind!=='return'){assert.equal(caught,true);assert.equal(error,marker.value);}
 else if(v.status===5){assert.equal(caught,true);assert.match(error.message,/native latch status rejection/);}
 else{assert.equal(caught,false);assert.equal(returned.kind,'captured');check(returned);}
 assert.deepEqual(f.effects,which==='live'&&marker.kind!=='return'?['live']:['live','persist']);
 if(f.rows.length)check(f.rows[0]);noRead(f);assert.throws(()=>f.a.start(),/one invocation only/);
});
for(const legacy of [true,false])for(const which of ['live','persist'])test('nonterminal callback stays observable '+legacy+' '+which,()=>{
 const f=fixture(legacy),sentinel=Symbol('pending');Object.assign(f.n,{status:2,event:1});const before={...f.count};
 const hook=()=>{const counts={...f.count};assert.equal(f.a.observe(2),null);for(const k of Object.keys(counts))assert.equal(f.count[k],counts[k]+1,'nonterminal still samples');throw sentinel;};
 f.hooks(which==='live'?hook:null,which==='persist'?hook:null);let caught=false;try{f.a.observe(1);}catch(e){caught=true;assert.equal(e,sentinel);}assert.equal(caught,true);
 for(const k of Object.keys(before))assert.equal(f.count[k],before[k]+2);f.hooks();assert.equal(f.a.observe(3),null);Object.assign(f.n,{status:3,event:2});assert.equal(f.a.observe(4).kind,'pending');Object.assign(f.n,{status:4,event:3});assert.equal(f.a.observe(5).kind,'captured');poison(f);noRead(f);
});
const report={candidate:'bbcc8685a900c1714e11b2eda4b7ac99f3d6f105',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,cases,results,syntheticOnly:true,authenticBatch36170Cause:'UNKNOWN'};
fs.writeFileSync(path.join(__dirname,'challenge-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed,cases,failures:results.filter(x=>!x.pass)},null,2));process.exitCode=report.failed?1:0;
