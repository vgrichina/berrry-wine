'use strict';
// Synthetic JS export boundary only. No native/Wasm execution or source changes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const repo=process.env.MNE_REVIEW_REPO;
const h=require(path.join(repo,'tools/maelstrom-native-errno-latch.cjs'));
const {createAdapter}=require(path.join(repo,'tools/maelstrom-original-errno-adapter.cjs'));
function fixture(){
 const native=Object.fromEntries(h.FIELDS.map(k=>[k,0]));
 const effects=[],exports={mne_start(){effects.push('start');native.status=1;}};
 for(const k of h.FIELDS)exports['mne_'+k]=()=>native[k];
 for(const k of h.DIAGNOSTIC_FIELDS)exports['mne_'+k]=()=>0;
 for(const k of ['started','phase','token','entries','parks','completions','fault','capped','active','thread','regs','pre','post','ret','result'])exports['msc_'+k]=()=>0;
 const adapter=createAdapter({exports},{readLive(){effects.push('live');return {};},persist(row){effects.push(['persist',row]);}});
 return {native,effects,adapter};
}
const results=[];
function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}}
for(const errno of [0,0x12345678])test('valid status4/event3 preserves errno '+errno,()=>{
 const f=fixture();f.adapter.start();Object.assign(f.native,{status:4,event:3,errno});
 const row=f.adapter.observe(1);assert.equal(row.kind,'captured');assert.equal(row.historicalNativeLatch.errno,errno);
 const count=f.effects.length;f.native.errno=99;assert.equal(f.adapter.observe(2),null);assert.equal(f.effects.length,count);assert.equal(row.historicalNativeLatch.errno,errno);
});
for(const [status,event] of [[4,0],[4,1],[4,2],[4,99],[99,0],[1,3],[2,0],[3,1]])test('invalid status/event '+status+'/'+event+' rejects before callbacks',()=>{
 const f=fixture();f.adapter.start();f.effects.length=0;Object.assign(f.native,{status,event});
 let error=null;try{f.adapter.observe(10);}catch(e){error=e.message;}
 const published=f.effects.filter(x=>Array.isArray(x)).map(x=>({kind:x[1].kind,status:x[1].historicalNativeLatch.status,event:x[1].historicalNativeLatch.event,errno:x[1].historicalNativeLatch.errno}));
 assert.ok(error&&f.effects.length===0,'accepted invalid state; effects='+JSON.stringify(f.effects.map(x=>Array.isArray(x)?'persist':x))+' published='+JSON.stringify(published));
 assert.equal(f.adapter.observe(11),null);
});
const report={candidate:'ecd805602e7204f7dcc1b94edbf018dadae85a73',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,results,syntheticBoundaryOnly:true,authenticBatch36170Cause:'UNKNOWN'};
fs.writeFileSync(path.join(__dirname,'status-event-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
// Exit successfully to retain the complete rejecting report; the verdict is explicit above.
