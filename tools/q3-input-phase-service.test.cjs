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
  if(mode==='cancelled')fs.writeFileSync(dir+'/caller-cancelled.json','{}');
  if(mode==='browser-failed')fs.writeFileSync(dir+'/first-browser-failure.json','{}');
  fs.writeFileSync(dir+'/input-service-model-review.json',JSON.stringify(review));
 }};
 if(mode==='positive'){await run(controls,options);assert(input);}
 else {await assert.rejects(()=>run(controls,options));assert(!input);assert(!fs.existsSync(dir+'/input-service-arm.json'));}
 assert.equal(polls,1);
}
(async()=>{
 for(const mode of ['positive','wrong-sha','wrong-identity','ambiguous','terminal','cancelled','browser-failed'])await test(mode);
 const dir=out+'/native-wire';fs.mkdirSync(dir);
 process.env.Q3_NATIVE_PHASE='cancellation';process.env.Q3_EXECUTION_BOUNDARY_OUT=dir+'/boundary.jsonl.gz';
 let sent=0;
 class Socket extends EventTarget{send(){sent++;}close(){}}
 const Transport=require('./q3-current-module.cjs').installTransportDiagnostics({WebSocket:Socket,write:()=>{}});
 const socket=new Transport();
 socket.send(JSON.stringify({id:1,method:'Runtime.enable'}));assert.equal(sent,1);
 fs.writeFileSync(dir+'/caller-cancelled.json','{}');
 for(const capped of [false,true]){
  if(capped)socket.q3Transport.stop('record limit');
  for(const method of ['Page.captureScreenshot','Input.dispatchKeyEvent','Runtime.evaluate','Browser.close'])
   assert.throws(()=>socket.send(JSON.stringify({id:2,method})),/native owner cancelled/);
 }
 assert.equal(sent,1,'no subsequent native send even after recording stops');socket.close();
 delete process.env.Q3_NATIVE_PHASE;
 console.log(JSON.stringify({passed:true,reviewControls:7,nativeWireRevocation:8,protocolWork:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
