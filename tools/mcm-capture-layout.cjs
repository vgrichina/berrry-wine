'use strict';
const assert=require('node:assert/strict');

// A real debugger call frame permits synchronous inspector reads while page
// timers/messages remain queued. Workers and independent UP stay live. Failed
// transactions remain paused for scope destruction, with no recovery queries.
function createLayoutCapture({send:raw,session,checkpoint}) {
 let frame=null,waiting=null,busy=false,closed=false;
 function event(v){
  if(v.sessionId!==session||v.method!=='Debugger.paused')return;
  if(waiting&&v.params.callFrames?.[0]?.callFrameId){frame=v.params.callFrames[0].callFrameId;waiting.resolve();waiting=null;}
 }
 function send(method,params={},target){
  if(frame&&target===session&&method==='Runtime.evaluate'){
   assert(params.returnByValue===true,'by-value synchronous capture inspection required');
   return raw('Debugger.evaluateOnCallFrame',{callFrameId:frame,expression:params.expression,returnByValue:true},target);
  }
  assert(!frame||!method.startsWith('Input.'),'input forbidden inside capture transaction');
  return raw(method,params,target);
 }
 async function capture({geometry,capture,retain}){
  assert(!busy&&!closed,'closed or concurrent capture transaction');busy=true;
  let value,before,after,trigger,timer;
  try{
   checkpoint();
   const paused=new Promise((resolve,reject)=>{waiting={resolve,reject};timer=setTimeout(()=>reject(Error('UNKNOWN capture pause fixed5000ms')),5000);});
   trigger=raw('Runtime.evaluate',{expression:'debugger;0',returnByValue:true},session);
   trigger.catch(e=>{waiting?.reject(e);});
   await paused;clearTimeout(timer);checkpoint();
   before=await geometry();value=await capture();
   await retain({value,before,after:null,verified:false});
   checkpoint();after=await geometry();
   await retain({value,before,after,verified:false});
   assert.deepEqual(after,before,'capture viewport/screen changed');
   checkpoint();await raw('Debugger.resume',{},session);frame=null;
   await trigger;checkpoint();
   await retain({value,before,after,verified:true});
   return {value,geometry:after};
  }catch(error){closed=true;error.captureLayout={before,after:after??null,pixelsRetained:!!value};throw error;}
  finally{clearTimeout(timer);waiting=null;busy=false;}
 }
 return {event,send,capture,get closed(){return closed;}};
}
module.exports={createLayoutCapture};
