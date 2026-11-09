'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {run}=require('./q3-input-phase-service.cjs');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]);
assert(out.startsWith(root+'/scratch/runs/')&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
async function test(mode){
 const dir=path.join(out,mode);fs.mkdirSync(dir);const capture={sha256:'a'.repeat(64),identity:{worker:'exact-worker',module:'exact-module'}};
 fs.writeFileSync(dir+'/fixture-startup-capture.json',JSON.stringify(capture));
 process.env.Q3_INPUT_SERVICE_REVIEW='1';process.env.Q3_EXECUTION_BOUNDARY_OUT=dir+'/boundary.jsonl.gz';
 let captured=false,input=false,polls=0;
 const controls={run:async options=>{await options.capture('fixture-startup');input=true;assert(fs.existsSync(dir+'/input-service-arm.json'));}};
 const options={out:dir,capture:async()=>{captured=true;},wait:async()=>{
  polls++;assert(captured&&!input);assert(!fs.existsSync(dir+'/input-service-arm.json'));
  assert(fs.existsSync(dir+'/input-service-review-ready.json'));
  const review={...capture,clear:true,review:'separate model fixture review'};
  if(mode==='wrong-sha')review.sha256='b'.repeat(64);
  if(mode==='ambiguous')review.clear=false;
  if(mode==='wrong-identity')review.identity={worker:'other'};
  if(mode==='terminal')throw Error('first terminal; no later input');
  fs.writeFileSync(dir+'/input-service-model-review.json',JSON.stringify(review));
 }};
 if(mode==='positive'){await run(controls,options);assert(input);}
 else {await assert.rejects(()=>run(controls,options));assert(!input);assert(!fs.existsSync(dir+'/input-service-arm.json'));}
 assert.equal(polls,1);
}
(async()=>{for(const mode of ['positive','wrong-sha','wrong-identity','ambiguous','terminal'])await test(mode);console.log(JSON.stringify({passed:true,reviewControls:5,protocolWork:0}));})().catch(e=>{console.error(e);process.exitCode=1;});
