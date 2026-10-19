'use strict';
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const {flags,steps,observeMovement}=require('./army-men-sign-exit-plan');
(async()=>{
  assert.deepEqual(flags,['--trace-input']);
  for(const step of ['turn','forward'])for(const failure of [null,'down','wait','release']){
    const events=[];let receipt;const spec=steps[step];
    const run=observeMovement(async(c,a)=>{events.push([c,a]);if((failure==='down'&&a==='keydown:'+spec.key)||(failure==='release'&&a==='keyup:'+spec.key))throw Error(failure);},async(ms)=>{assert.equal(ms,spec.holdMs);if(failure==='wait')throw Error('wait');},r=>receipt=r,step);
    if(failure)await assert.rejects(run);else await run;
    assert(events.some(([,a])=>a==='keyup:'+spec.key));
    if(!failure){assert.equal(receipt.released,true);assert.deepEqual(events,[['png',step+'-before.png'],['cmd','keydown:'+spec.key],['cmd','keyup:'+spec.key],['png',step+'-after.png'],['snapshot',undefined]]);}
    else assert(!events.some(([,a])=>a===step+'-after.png'));
  }
  await assert.rejects(observeMovement(()=>{},()=>{},()=>{},'unknown'));
  // Execute extracted production admission expression, no guest/runtime.
  const source=fs.readFileSync(require.resolve('./army-men-installed-sign-exit-observe'),'utf8');
  const expr=source.match(/const admit=([\s\S]*?);\nadmit\('initial'\);/)[1];
  const threshold=2847932416;
  for(const value of [threshold-1,threshold,threshold+1]){
    const admit=vm.runInNewContext('('+expr+')',{free:()=>value,assert,outputReserve:28*1024**2,transientReserve:512*1024**2,stopFloor:2214592512});
    if(value<=threshold)assert.throws(()=>admit('test'),e=>e.message.includes('"freeBytes":'+value)&&e.message.includes('"requiredFreeExclusive":'+threshold));
    else assert.equal(admit('test'),value);
  }
  console.log('PASS sign-exit steps/releases/failures and numeric strict admission; pure JS only');
})().catch(e=>{console.error(e);process.exitCode=1;});
