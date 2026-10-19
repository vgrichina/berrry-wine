'use strict';
const assert=require('assert/strict'),{flags,observeMovement}=require('./army-men-movement-plan');
(async()=>{
  assert.deepEqual(flags,['--trace-input']);
  for(const failure of [null,'down','wait']){
    const events=[];let receipt;
    const run=observeMovement(async(c,a)=>{events.push([c,a]);if(failure==='down'&&a==='keydown:104')throw Error('down');},async(ms)=>{assert.equal(ms,750);if(failure==='wait')throw Error('wait');},r=>{receipt=r;});
    if(failure)await assert.rejects(run);else await run;
    assert(events.some(([c,a])=>c==='cmd'&&a==='keyup:104'));
    if(!failure){assert.equal(receipt.released,true);assert.deepEqual(events,[['png','movement-before.png'],['cmd','keydown:104'],['cmd','keyup:104'],['png','movement-after.png'],['snapshot',undefined]]);}
    else assert(!events.some(([,a])=>a==='movement-after.png'));
  }
  console.log('PASS movement ordering, bounded hold, release after failed acknowledgement/wait; pure JS mocks only');
})().catch(e=>{console.error(e);process.exitCode=1;});
