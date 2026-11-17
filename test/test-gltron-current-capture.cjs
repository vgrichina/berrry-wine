'use strict';
const assert=require('node:assert/strict');
const {completeCapture}=require('../tools/gltron-current-capture.cjs');
async function fixture(failure) {
  let at=0,fire,resolveLate,retained=0,closed=0,calls=[];const phases=[];
  const pending=new Promise(r=>resolveLate=r);
  const step=async(name,value)=>{calls.push(name);if(failure===name){await pending;return value;}return value;};
  const task=completeCapture({now:()=>at,timers:{set:(fn,ms)=>{assert.equal(ms,3000);fire=fn;return 1;},clear:()=>{}},
    record:v=>phases.push(v),close:()=>closed++,requestTicket:()=>step('request',true),
    readTicket:()=>step('ticket',{status:'complete',metadata:{publication:7},receipt:{publication:7}}),
    captureHost:()=>step('host',{data:'pixels'}),retain:()=>{retained++;}});
  if(failure){for(let n=0;n<20&&!calls.includes(failure);n++)await Promise.resolve();
    assert(calls.includes(failure));at=3000;fire();await assert.rejects(task,/DISPLAY_UNKNOWN/);
    const stopped=[...calls];resolveLate(true);for(let n=0;n<20;n++)await Promise.resolve();
    assert.deepEqual(calls,stopped,'no dependent call after UNKNOWN');assert.equal(retained,0);assert.equal(closed,1);
    assert.equal(phases.at(-1).phase,'UNKNOWN');
    assert.equal(phases.at(-1).pendingPhase,{request:'request-ticket',ticket:'read-ticket',host:'host-capture'}[failure]);
  }else{await task;assert.equal(retained,1);assert.equal(closed,0);assert.equal(phases.at(-1).phase,'complete');}
}
(async()=>{for(const mode of [null,'request','ticket','host'])await fixture(mode);
  console.log('PASS capture success and request/ticket/host deadline: phase retained, late pixels discarded, zero later calls');
})().catch(e=>{console.error(e);process.exitCode=1;});
