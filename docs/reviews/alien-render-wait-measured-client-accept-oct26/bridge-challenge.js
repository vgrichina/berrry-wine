'use strict';
const assert=require('assert/strict');
const {make,micro,checkpoint}=require('./challenge');
async function main(){
 const traces=[];
 for(const old of [false,true]){
  const trace=[];
  for(const mode of ['value','reject','generation','finalizer-throw','closed','sync-value','sync-throw','deferred','full-drain','full-no-drain','ordinary-throw']){
   const h=make({old}),b=h.bridge,entry={queue:{generation:2}};let resolve,reject;
   const p=new Promise((a,z)=>{resolve=a;reject=z;});p.catch(()=>{});b.value=p;
   let outcome,token,error=null;
   const finalize=x=>{trace.push(['finalize',x]);if(mode==='finalizer-throw')throw Error('finalizer-sentinel');return 37;};
   if(mode==='sync-value')b.value=12;
   if(mode==='sync-throw')b.submit=()=>{throw Error('submit-sentinel');};
   if(['deferred','full-drain','full-no-drain','ordinary-throw'].includes(mode))b.deferrable=true;
   if(mode==='ordinary-throw')b.submit=()=>{throw Error('plain-sentinel');};
   let drain,submits=0;
   if(mode.startsWith('full-')){
    if(mode==='full-drain')entry.deferred=new Set([new Promise(r=>{drain=r;})]);
    b.submit=()=>{if(++submits===1)throw Object.assign(Error('queue-full'),{code:'FULL'});return p;};
   }
   try{token=b._issue(entry,17,{},finalize);}catch(e){error=e.message;}
   if(token<0){
    const record=b.requests.get(token);assert(record);
    if(!old)assert.equal(record.renderWaitOperation,'DRAW');
    assert.equal(b._poll(token),token);
    if(mode==='generation')entry.queue.generation++;
    if(mode==='closed')b.closed=true;
    if(drain){assert.equal(submits,1);drain();await micro();assert.equal(submits,2);}
    const ready=b.wait(token);if(mode==='reject')reject(Error('reject-sentinel'));else resolve(12);
    await ready;assert(record.done);outcome=b._poll(token);await record.consumed;
    assert.equal(b.requests.size,0);assert.equal(b._poll(token),-1);
   }else {resolve(12);await micro();outcome=token;}
   trace.push({mode,outcome,error,bridgeError:b.lastError||null,submits,deferred:entry.deferred?.size||0});
   if(['reject','generation','closed','finalizer-throw'].includes(mode))assert.equal(outcome,-77);
   if(mode==='value'||mode==='full-drain'||mode==='sync-value')assert.equal(outcome,37);
   if(mode==='deferred'){assert.equal(outcome,37);assert.equal(entry.deferred.size,0);}
   if(['sync-throw','ordinary-throw','full-no-drain'].includes(mode))assert(error);
  }
  traces.push(trace);
 }
 assert.deepEqual(traces[0],traces[1]);checkpoint('bridge-result-issue-poll-noninterference',traces[0],[]);
 console.log('PASS11 exact bridge schedules including sync/async results, throws, stale generation, closed, deferred, FULL-drain/FULL-no-drain; values/exceptions/finalize/consume/order identical to original');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
