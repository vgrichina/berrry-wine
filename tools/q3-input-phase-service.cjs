'use strict';
// Gate only the native fixture's first input. No protocol work or guard changes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function run(controls,options){
 if(!process.env.Q3_INPUT_SERVICE_REVIEW)return controls.run(options);
 const parent=path.dirname(process.env.Q3_EXECUTION_BOUNDARY_OUT);
 const check=()=>{
  for(const file of [path.join(parent,'caller-cancelled.json'),...['first-browser-failure.json','first-transport-failure.json','first-failure.json'].map(n=>path.join(options.out,n))])
   assert(!fs.existsSync(file),'terminal native fixture: '+file);
 };
 check();
 return controls.run({...options,capture:async label=>{
  check();
  const result=await options.capture(label);
  check();
  if(label!=='fixture-startup')return result;
  const capture=JSON.parse(fs.readFileSync(options.out+'/'+label+'-capture.json'));
  const ready=path.join(parent,'input-service-review-ready.json');
  fs.writeFileSync(ready,JSON.stringify({capture,label,at:Date.now(),image:path.resolve(options.out,label+'.png'),captureFile:path.resolve(options.out,label+'-capture.json')}),{flag:'wx'});
  const due=Date.now()+60000,reviewFile=path.join(parent,'input-service-model-review.json');
  while(!fs.existsSync(reviewFile)){check();assert(Date.now()<due,'fixture model review unavailable');await options.wait(20);}
  check();
  const review=JSON.parse(fs.readFileSync(reviewFile));
  assert.equal(review.sha256,capture.sha256,'reviewed returned capture');
  assert.deepEqual(review.identity,capture.identity,'reviewed exact identity');
  assert.equal(review.clear,true,'reliable model presentation required');
  assert(review.review?.trim(),'separate model review required');
  check();
  fs.writeFileSync(path.join(parent,'input-service-arm.json'),JSON.stringify({
   at:Date.now(),monotonicNs:process.hrtime.bigint().toString(),capture,review,
   recordLimit:512,deadlineMs:5000}),{flag:'wx'});
  return result;
 }});
}
module.exports={run};
