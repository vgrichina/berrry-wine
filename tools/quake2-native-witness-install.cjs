'use strict';
// Explicit actual-caller lifecycle. Admission and the six-copy reader remain
// the retained implementations; setup is outside all synchronous boundaries.
const passive=require('./quake2-passive-attack.cjs'),shared=require('./quake2-shared-writer-witness.cjs');
function createChain(bound,options){
 const enabled=options.writerWitnessSetup===true;
 if(options.writerWitnessSetup!==undefined&&typeof options.writerWitnessSetup!=='boolean')throw Error('boolean writer setup');
 if(!enabled)return passive.createChain(bound,options);
 if(options.writerWitnessGlobal!==undefined)throw Error('actual caller owns writer witness global');
 const globalName='__q2ActualCallerWriter',token=require('node:crypto').randomUUID();
 const chain=passive.createChain(bound,{...options,writerWitnessGlobal:globalName});
 let identity=null,setup=null,stopped=false,failure=null,teardown=null;
 const check=()=>{if(failure)throw failure;if(stopped||chain.closed)throw Error('writer lifetime closed');};
 const remember=e=>{failure??=e;return failure;};
 async function install(admitted){
  check();
  if(identity){
   // Retained same() enforces every admitted Worker/renderer/module token.
   bound.same(identity,admitted);return setup;
  }
  identity=structuredClone(admitted);
  setup=options.evaluate(shared.pageSource({globalName,identity,installationToken:token,maxBoundaries:1024}));
  try{const receipt=await setup;check();return receipt;}catch(e){throw remember(e);}
 }
 return {...chain,get closed(){return stopped||!!failure||chain.closed;},
  admit:(review,dispatch)=>{check();return chain.admit(review,async receipt=>{
   try{await install(receipt.live.identity);check();return await dispatch(receipt);}catch(e){throw remember(e);}
  });},
  capture:async label=>{check();try{return await chain.capture(label);}catch(e){throw remember(e);}},
  progress:async admitted=>{check();try{return await chain.progress(admitted);}catch(e){throw remember(e);}},
  closeWriterWitness(){
   stopped=true;
   return teardown??=Promise.resolve().then(()=>(options.cleanupEvaluate||options.evaluate)(`(async()=>{
    const key=${JSON.stringify(globalName)},slot=globalThis[key];
    if(!slot)return {status:'ABSENT'};
    if(slot.installationToken!==${JSON.stringify(token)})throw Error('writer lifetime replaced');
    // Remove the slot before awaiting close. A pending arm observes cancellation.
    delete globalThis[key];await slot.close();return {status:'CLOSED',nativeQualification:false};
   })()`));
  }};
}
module.exports={createChain};
