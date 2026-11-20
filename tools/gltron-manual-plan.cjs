'use strict';
// Explicit plan authority layered over the exact qualified native manual-context
// implementation. No automatic conversion from strict frame equivalence.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {validate:validateChoice}=require('./gltron-manual-native-gesture.cjs');
const digest=value=>JSON.stringify(value);
function immutable(value){
  if(Buffer.isBuffer(value)){const bytes=Buffer.from(value);return Object.freeze({
    encoding:'base64',data:bytes.toString('base64')});}
  if(Array.isArray(value))return Object.freeze(value.map(immutable));
  if(value&&typeof value==='object')return Object.freeze(Object.fromEntries(Object.entries(value).map(([k,v])=>[k,immutable(v)])));
  return value;
}
function createManualPlan({createNativeManualContext,evidenceSink,...options}){
  assert.equal(typeof createNativeManualContext,'function','qualified manual context factory required');
  assert.equal(typeof evidenceSink,'function','synchronous immutable evidence sink required');
  const key=crypto.randomBytes(32),session=crypto.randomUUID(),plans=new WeakMap();
  let closed=false,busy=false,issued=false,active=null;
  function retain(evidence){
    const result=evidenceSink(immutable(evidence));
    assert.equal(result,true,'evidence sink must synchronously retain complete capture');return true;
  }
  const context=createNativeManualContext({...options,evidenceSink:retain});
  assert.equal(context.capability,'native-manual-context-v1');
  const close=()=>{closed=true;context.close();};
  const gate=()=>assert(!closed&&!context.closed,'manual plan permanently closed');
  function check(handle,choice,image){
    gate();const p=plans.get(handle);assert(p&&!p.released,'missing/forged/released manual plan');
    assert.equal(handle.payload,p.payload);assert.equal(handle.signature,p.signature);
    assert.equal(digest(choice),p.choice,'exact four-key plan changed');
    assert.equal(digest(image),p.image,'complete reviewed source changed');return p;
  }
  function failure(error){close();throw error;}
  return {capability:'native-manual-plan-v1',get closed(){return closed||context.closed;},close,
    // The page key stays the qualified manual-context key. Plan HMAC and private
    // handle never enter the page; only its exact per-edge signed proofs do.
    get nativeKey(){return context.key;},
    async captureReview(name){try{gate();const source=await context.captureReview(name);
      retain({version:'native-manual-plan-evidence-v1',stage:'full-review-source',authoritative:false,source});
      return source;
    }catch(e){return failure(e);}},
    async authorize(name,input,image){try{
      gate();assert(!busy&&!issued,'one personally chosen plan per session');busy=true;
      const choice=structuredClone(input),frame=structuredClone(image);
      validateChoice(choice,frame,{next:0,proofs:[],equivalence:{validate(){}}});
      assert.notEqual(choice.steps[1].key,choice.steps[2].key,'other ordinary turn required');
      // Every byte including names, nonces, order, holds and delays is bound.
      const proofs=[];for(const step of choice.steps)proofs.push(await context.prove(name,step,frame));
      const payload=digest({version:'native-manual-plan-v1',session,id:crypto.randomUUID(),choice,frame,
        edges:proofs.map(p=>({payload:p.payload,signature:p.signature}))});
      const signature=crypto.createHmac('sha256',key).update(payload).digest('hex');
      const handle=Object.freeze({payload,signature});
      plans.set(handle,{payload,signature,choice:digest(choice),image:digest(frame),proofs,next:0,phase:'ready',opened:false,released:false});issued=true;
      return handle;
    }catch(e){return failure(e);}finally{busy=false;}},
    open(handle,choice,image){try{
      const p=check(handle,choice,image);assert(!p.opened,'manual plan repeated');p.opened=true;
      const index=h=>{const i=p.proofs.indexOf(h);assert(i>=p.next&&i>=0,'wrong order/repeated plan edge');return i;};
      const exact=(h,intent,frame,current=false)=>{check(handle,choice,image);const i=index(h);
        assert.equal(digest(intent),JSON.parse(p.choice).steps.map(digest)[i],'plan edge mutated');
        assert.equal(digest(frame),p.image);if(current)assert.equal(i,p.next,'wrong plan order');context.validate(h,intent,frame);};
      const authority={capability:'native-manual-context-v1',
        validate(h,intent,frame){try{exact(h,intent,frame);return true;}catch(e){return failure(e);}},
        async beforeDown(h,intent,frame){try{exact(h,intent,frame,true);assert.equal(p.phase,'ready');p.phase='capturing';await context.beforeDown(h,intent,frame);exact(h,intent,frame,true);p.phase='fresh';}catch(e){return failure(e);}},
        fence(h,intent,frame,publish){try{exact(h,intent,frame,true);assert.equal(p.phase,'fresh','missing fresh capture/repeated publication');return context.fence(h,intent,frame,()=>{exact(h,intent,frame,true);assert.equal(p.phase,'fresh');p.phase='published';publish?.();});}catch(e){return failure(e);}},
        consume(h){try{assert.equal(index(h),p.next);assert.equal(p.phase,'published','unpublished edge retired');context.consume(h);p.next++;p.phase='ready';if(p.next===4){p.released=true;close();}}catch(e){return failure(e);}},
      };
      active={p,authority};return {equivalence:authority,proofs:p.proofs.slice(),next:0,manual:true};
    }catch(e){return failure(e);}},
    // Transport uses the private current proof, never reconstructs it from the
    // signed envelope. Its callback must immediately publish on the socket.
    fence(intent,image,publish){try{gate();assert(active,'manual plan not opened');
      return active.authority.fence(active.p.proofs[active.p.next],intent,image,publish);
    }catch(e){return failure(e);}},
  };
}
module.exports={createManualPlan};
