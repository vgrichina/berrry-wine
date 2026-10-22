'use strict';
// Synthetic mechanics qualify instrumentation; original outcomes are a separate
// future evidence requirement. This gate never authorizes a runtime action.
const assert=require('assert/strict'),fs=require('fs');
function validate(x){
  assert.equal(x.pass,true);assert.equal(x.actualHistoricalWasm,true);
  assert.equal(x.syntheticProgramsAndData,true);assert.equal(x.originalNativeXmlEvidence,false);
  assert.equal(x.moduleSha256,'f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7');
  assert.equal(x.instances,2);assert(x.readOnlySeals>=50);
  assert(x.unrelatedMockReadPairsPerInstance>=800);
  for(const n of ['missing return','stale pre-return EAX','wrong instance','stale dynamic UTF16'])assert(x.negativeControls.includes(n));
  for(const id of [1,2])for(const ip of [0x8e98b1,0x8e98b7,0x8e98bf,0x8e98ca,0x8e98dc,0x8e9904,0x486e30,0x486fd7,0x918670,0x8e4603,0x8e46ca]){
    const r=x.rows.find(r=>r.instanceId===id&&r.ip===ip);assert(r,'missing mechanical boundary');
    assert(x.raw.some(a=>a.instanceId===id&&a.ip===ip&&JSON.stringify(a.regs)===JSON.stringify(r.regs)),'wrong mechanical context');
  }
  return {pass:true,mechanicsReadyForNextAssignedOriginalTrace:true,originalRouteEvidence:false,guestRunAuthorized:false,firstLostTextBoundary:'UNKNOWN'};
}
if(require.main===module){
 const x=JSON.parse(fs.readFileSync(process.argv[2]));const result=validate(x);
 const missing=structuredClone(x);missing.rows=missing.rows.filter(r=>r.ip!==0x8e98dc);assert.throws(()=>validate(missing));
 const mislabeled=structuredClone(x);mislabeled.syntheticProgramsAndData=false;assert.throws(()=>validate(mislabeled));
 console.log(JSON.stringify(result));
}
module.exports=validate;
