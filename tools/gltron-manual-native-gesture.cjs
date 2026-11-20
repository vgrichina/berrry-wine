'use strict';
// A manually chosen short gesture over the existing single-edge native USER
// contract. No route selection, game-state access, retries, or new input API.
const assert=require('node:assert/strict');
const single=require('./hexen2-native-consumption-input.cjs');
const qualified=require('./quake2-native-consumption-input.cjs');
const supported=require('./gltron-current-native-input.cjs');
const POLICY=qualified.POLICY;
// Strict whole-RGBA path. Ordering follows the qualified 7bca66241 final
// publication protocol, with no manual-context capability or pixel relaxation.
function createStrictController({page,dispatch,release,close,record=()=>{},equivalence:a}){
  assert.equal(a?.capability,'native-whole-frame-equivalence-v1','strict whole-frame capability required');
  let terminal=false,active=false;const nonces=new Set();
  const stop=reason=>{if(!terminal){terminal=true;close(reason);}};
  const gate=()=>{if(terminal)throw Error('HEXEN_NATIVE_UNKNOWN permanently closed');};
  async function call(method,...args){gate();const at=Date.now();
    try{const result=await page(method,...args);record({method,at,receivedAt:Date.now(),late:terminal,result});gate();return result;}
    catch(e){stop(e.message);throw e;}}
  return {get terminal(){return terminal;},close:stop,
    async bind(deadline){gate();try{return await supported.waitForNativeOwner({deadline,
      observe:()=>call('observe'),close:()=>stop('native owner UNKNOWN'),record});}catch(e){stop(e.message);throw e;}},
    async gesture(intent,image,handle){
      gate();let armed=false,downStarted=false,error=null,proof=null,up=null;
      const check=()=>{gate();qualified.exactEdge(intent);a.validate(handle,intent,image);};
      try{
        if(active||nonces.has(intent.nonce))throw Error('HEXEN_NATIVE_UNKNOWN concurrent/stale nonce');
        check();active=true;nonces.add(intent.nonce);
        // Includes identity queries, whole capture and synchronous retention.
        // None of these starts or renews a native ticket or release deadline.
        await a.beforeDown(handle,intent,image);check();
        const arm=await release.arm(intent);armed=true;check();
        const releaseGate=()=>{
          if(!Number.isSafeInteger(arm?.at)||!Number.isSafeInteger(arm?.fallback)||
            !Number.isSafeInteger(arm?.releaseDue)||arm.fallback-arm.at!==1750||
            Date.now()+intent.ms>=arm.releaseDue||Date.now()+intent.ms>=arm.fallback||release.alive===false)
            throw Error('HEXEN_NATIVE_UNKNOWN independent release window expired/unavailable');
        };
        let state,start;const until=Date.now()+POLICY.nativeMs;
        do{
          check();releaseGate();start=Date.now();
          state=await call('prepareEquivalent',{...intent,completedAt:image.completedAt},image.completedAt,handle);
          if(!state.prepared)await new Promise(r=>setTimeout(r,5));
        }while(!state.prepared&&Date.now()<until);
        if(!state.prepared)throw Error('HEXEN_NATIVE_UNKNOWN no new native USER observation');
        const deadline=start+POLICY.nativeMs;let published=false,dispatching=false;
        // Invoked by the transport inside authority.fence, after final capture
        // and writer completion. No earlier callback can start the hold clock.
        const publish=()=>{
          if(!dispatching||published)throw Error('HEXEN_NATIVE_UNKNOWN missing/duplicate socket boundary');
          check();releaseGate();
          if(Date.now()>=deadline)throw Error('HEXEN_NATIVE_UNKNOWN final socket native 500ms expired');
          release.due(intent.nonce,Date.now()+intent.ms);
          published=true;downStarted=true;
        };
        proof=await supported.waitForNativeConsumption({deadline,
          close:()=>stop('DOWN/native 500ms UNKNOWN'),record,
          dispatch:async()=>{check();releaseGate();const at=Date.now();dispatching=true;
            try{const ack=await dispatch(intent,publish);
              if(!published)throw Error('HEXEN_NATIVE_UNKNOWN transport omitted final socket boundary');
              record({method:'DOWN',at,receivedAt:Date.now(),late:terminal,transportACK:ack});
            }finally{dispatching=false;}},
          observe:()=>{if(!published)throw Error('HEXEN_NATIVE_UNKNOWN unpublished DOWN');return call('status',intent.nonce);}});
        if(!proof.consumed||proof.receiptBoundary!=='owner-worker-native-user-return'||
          proof.nativeMessage?.consumption!=='owner-user-return'||!proof.nativeMessage.token||
          (intent.kind==='mouse'?proof.nativeMessage.msg!==0x201:
            ![0x100,0x104].includes(proof.nativeMessage.msg)||proof.nativeMessage.wParam!==intent.code))
          throw Error('HEXEN_NATIVE_UNKNOWN invalid native USER return; transport is not proof');
      }catch(e){error=e;stop(e.message);}
      finally{
        if(armed){
          if(!downStarted)try{release.cancel(intent.nonce);}catch(e){error??=e;stop(e.message);}
          try{up=await supported.finishNativeRelease(release,intent.nonce,error);}catch(e){error??=e;stop(e.message);}
        }
        active=false;
        try{a.consume(handle);}catch(e){error??=e;stop(e.message);}
      }
      if(error)throw error;
      return {proof,up,guestAttack:false,enemyConsequence:false};
    },
  };
}
// Attach before awaiting readiness. 'exit' retires authority before pipe EOF;
// a spawn error also retires it even though there may never have been a PID.
// Cleanup has its own participants and never goes through this transport.
function createTaskGuard({child,check=()=>{},close,record=()=>{}}){
  let terminal=false,reason=null;
  const stop=why=>{if(terminal)return;terminal=true;reason=String(why);
    try{record({method:'task-cancel',at:Date.now(),reason});}finally{close(reason);}};
  child.once('exit',(code,signal)=>stop('task guard exit '+code+' '+signal));
  child.once('error',error=>stop('task guard error '+error.message));
  function gate(){
    if(!terminal){
      if(child.exitCode!==null||child.signalCode!==null)stop('task guard already exited');
      else try{check();}catch(error){stop(error.message);}
    }
    if(terminal)throw Error('GLTRON_TASK_CANCELLED '+reason);
  }
  return {get terminal(){return terminal;},close:stop,check:gate,
    // Keep the final check and actual issue in the same synchronous turn.
    issue(fn,...args){gate();return fn(...args);}};
}
function validate(choice,image,authority){
  assert(choice&&choice.review?.trim()&&choice.startingPause===true,'personally reviewed starting pause required');
  assert(Number.isSafeInteger(choice.chosenAt)&&choice.chosenAt>=image.completedAt&&choice.chosenAt<=Date.now(),
    'gesture must be chosen after the actual complete frame');
  assert(Array.isArray(choice.steps)&&choice.steps.length===4,'resume, two ordinary turns, pause required');
  assert(choice.steps[0].key==='Space'&&choice.steps[3].key==='Space','ordinary resume/pause');
  assert(choice.steps.slice(1,3).every(s=>['ArrowLeft','ArrowRight'].includes(s.key)),'two explicitly chosen ordinary turns');
  assert(choice.steps.every(s=>Number.isInteger(s.ms)&&s.ms>=50&&s.ms<=150&&
    Number.isInteger(s.delayMs)&&s.delayMs>=0&&s.delayMs<=100),'short explicit intervals');
  assert(choice.steps.reduce((n,s)=>n+s.ms+s.delayMs,0)<=800,'short compound gesture');
  assert(choice.steps.every(s=>s.review===choice.review&&s.reviewedAt===choice.chosenAt&&s.mode==='game'),'one exact initial review');
  const codes={Space:32,ArrowLeft:37,ArrowRight:39};
  assert(choice.steps.every(s=>s.kind==='key'&&s.code===codes[s.key]&&s.domCode===s.key),'exact ordinary key encoding');
  for(const [i,step] of choice.steps.entries()){
    if(authority){
      qualified.exactEdge(step);
      if(i>=authority.next)authority.equivalence.validate(authority.proofs[i],step,image);
    }else single.reviewed(step,image);
  }
  assert.equal(new Set(choice.steps.map(s=>s.nonce)).size,4,'unique per-key nonce');
  assert.equal(new Set(choice.steps.map(s=>s.name)).size,4,'unique per-key evidence');
}
function createGroup({page,dispatch,releases,close,record=()=>{},fence,equivalence,manualPlan}){
  assert(!(equivalence&&manualPlan),'choose one explicit review capability');
  if(manualPlan)assert.equal(manualPlan.capability,'native-manual-plan-v1','explicit manual plan required');
  let active=false,terminal=false,controller;
  const seen=new Set(),closureErrors=[];
  const stop=reason=>{if(!terminal){terminal=true;manualPlan?.close();controller?.close(reason);try{close(reason);}catch(error){closureErrors.push(error);}}};
  return {get terminal(){return terminal;},
    async gesture(input,image,proofHandles){
      assert(!terminal&&!active,'group closed/concurrent');
      // Freeze the caller's explicit choice before any asynchronous operation.
      const choice=structuredClone(input),frame=structuredClone(image);
      // Explicit opt-in: preserve the private common implementation's handle
      // identities. Cloning a signed envelope must never create authority.
      let authority;
      if(manualPlan){try{
        authority=manualPlan.open(proofHandles,choice,frame);validate(choice,frame,authority);
      }catch(error){stop(error.message);throw error;}}
      else if(proofHandles!==undefined){try{
        assert(equivalence&&Array.isArray(proofHandles)&&proofHandles.length===4,'four explicit private equivalence proofs required');
        assert.equal(new Set(proofHandles).size,4,'one use proof per exact edge');
        authority={equivalence,proofs:proofHandles.slice(),next:0};
        validate(choice,frame,authority);
      }catch(error){stop(error.message);throw error;}}
      else validate(choice,frame);
      assert.equal(releases.length,4,'one independent release per edge');
      assert.equal(new Set(releases).size,4,'four distinct independent release participants required');
      for(const s of choice.steps){assert(!seen.has(s.nonce),'old scope never replayed');seen.add(s.nonce);}
      active=true;
      const armed=[],started=new Set(),finished=new Set(),results=[],errors=closureErrors;
      const ready=()=>{if(!manualPlan)return;
        for(const {i,receipt:r} of armed){if(finished.has(i))continue;
          assert(releases[i].alive!==false&&Number.isSafeInteger(r?.at)&&
            Number.isSafeInteger(r?.fallback)&&Number.isSafeInteger(r?.releaseDue)&&
            r.fallback-r.at===1750&&r.releaseDue-r.at===1500&&
            Date.now()+choice.steps[i].ms<r.releaseDue&&Date.now()+choice.steps[i].ms<r.fallback,
          'all pending manual plan UP participants must be READY');
        }};
      const check=async()=>{assert(!terminal,'group permanently closed');ready();validate(choice,frame,authority);await fence(choice,frame);assert(!terminal);ready();validate(choice,frame,authority);};
      try{
        await check();
        // Every UP participant is independently armed before the first DOWN.
        for(let i=0;i<4;i++){
          const receipt=await releases[i].arm(choice.steps[i]);armed.push({i,receipt});await check();
        }
        for(let i=0;i<4;i++){
          const step=choice.steps[i],participant=releases[i],receipt=armed[i].receipt;
          await check();
          if(step.delayMs)await new Promise(r=>setTimeout(r,step.delayMs));
          await check();
          controller=(authority&&!authority.manual?createStrictController:single.createController)({equivalence:authority?.manual?undefined:authority?.equivalence,manualContext:authority?.manual?authority.equivalence:undefined,page:(...args)=>{assert(!terminal,'group permanently closed');return page(...args);},close:stop,record,
            // The transport owns the sole final socket fence. Its synchronous
            // callback schedules UP only after capture, immediately before send.
            dispatch:async (edge,publish)=>{await check();
              if(!publish)started.add(i);
              return dispatch(edge,()=>{assert(!terminal,'group permanently closed');
                publish?.();started.add(i);});},
            release:{get alive(){return participant.alive;},arm:async()=>receipt,
              due:(...args)=>participant.due(...args),cancel:(...args)=>participant.cancel(...args),
              finish:async(...args)=>{try{return await participant.finish(...args);}finally{finished.add(i);}}}});
          const result=await controller.gesture(step,frame,authority?.proofs[i]),previous=results.at(-1);
          if(authority)authority.next=i+1;
          assert.equal(result.proof.nonce,step.nonce,'native receipt belongs to exact key nonce');
          assert(Number.isSafeInteger(result.proof.nativeMessage.token)&&
            result.proof.nativeMessage.token>(previous?.proof.nativeMessage.token??0),'ordered unique native return tokens');
          assert(result.up?.ok===true&&!result.up.cancelNoDown,'issued DOWN requires completed independent UP');
          results.push(result);
          record({method:'group-edge',index:i,nonce:step.nonce,proof:results.at(-1).proof,up:results.at(-1).up});
        }
      }catch(error){errors.push(error);stop(error.message);}
      finally{
        // Do not cancel an issued DOWN or query a closed runtime. All unused
        // prearmed participants still receive cancellation and a real join.
        for(const {i} of armed){if(finished.has(i))continue;
          const participant=releases[i],nonce=choice.steps[i].nonce;
          if(!started.has(i))try{participant.cancel(nonce);}catch(error){errors.push(error);stop(error.message);}
          try{await participant.finish(nonce);}catch(error){errors.push(error);stop(error.message);}
        }
        active=false;
      }
      if(errors.length){
        const error=new AggregateError(errors,'manual native group failed; all armed releases retained',{cause:errors[0]});
        // A later failure must not erase earlier native receipts or imply that
        // unused prearmed releases were dispatched. These are evidence only.
        error.partial={results,choice,initialFrame:frame,armed:armed.map(a=>a.i),
          started:[...started],finished:[...finished]};
        throw error;
      }
      return {results,choice,initialFrame:frame,turnConsequences:false,ordinaryQuit:false};
    },close:stop};
}
module.exports={validate,createGroup,createTaskGuard,createStrictController};
