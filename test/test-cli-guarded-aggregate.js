'use strict';
// Authored server state-machine controls. Actual SDL/USER acceptance is in
// test-native-capture-binding.cjs, including post-chord status and next Escape.
const assert=require('node:assert/strict');
const {createGuardedInput}=require('../lib/cli-guarded-input');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  const queue=[],up=[],tickets=[],actorExports={get_window_thread:()=>7};
  const refs={queue,actorExports,buffer:{},tid:7,hwnd:1};let healthy=true,serial=0;
  const g=createGuardedInput({nativeDelivery:true,nativeProofRequired:true,
    snapshot:()=>({refs,healthy}),cleanup:(_refs,event)=>up.push(event.code)});
  const owner=g.bind(),keys=[{action:'keydown',code:39},{action:'keydown',code:32}];
  const envelope=(nonce='chord')=>({...owner,nonce,reviewed:true,deadline:Date.now()+10000});
  const enqueue=(event,t)=>{tickets.push(t);g.consume(t,()=>queue.push({hwnd:1,msg:256,wParam:event.code,lParam:++serial}));};
  const ack=()=>{const event=queue.shift(),token=g.dequeued(event);assert(token);assert(g.nativeConsumed(token,{...event,token,buffer:refs.buffer,actorExports,threadId:7,apiKind:1,remove:1}));};
  return {g,owner,keys,envelope,enqueue,ack,up,tickets,replace:()=>{healthy=false;}};
}
(async()=>{
  let checks=0;
  for(const fault of ['complete','partial','failed-edge','lost-ack','cancel-pending','cancel-partial','owner-pending','owner-partial','enqueue-error']){
    const f=fixture(),{g,owner,keys,envelope,enqueue,ack}=f;
    const run=g.compound(envelope(),keys,(event,t)=>{
      if(fault==='enqueue-error'&&f.tickets.length===1)throw Error('authored enqueue error');
      if(fault==='failed-edge'&&f.tickets.length===1){
        f.tickets.push(t);g.consume(t,()=>{throw Error('authored handler may already have applied');});return;
      }
      enqueue(event,t);
    });
    try{
      let s=g.status('chord');assert.equal(s.epoch,owner.epoch);assert.equal(s.owner,owner.owner);
      assert.equal(s.state,'DELIVERY_PENDING');assert(!s.consumed);assert.equal(s.edges.length,1);
      if(['cancel-pending','owner-pending'].includes(fault)){
        if(fault==='cancel-pending')run.cancel('authored lost pending reply');else g.bind();
      }else{
        ack();await turn();
        s=g.status('chord');
        if(!['enqueue-error','failed-edge'].includes(fault)){assert.equal(s.edges.length,2);assert.equal(s.state,'DELIVERY_PENDING');assert(s.edges[0].consumed);assert(!s.consumed);}
        if(fault==='complete'||fault==='lost-ack'){ack();await turn();}
        else if(fault==='cancel-partial')run.cancel('authored disconnect');
        else if(fault==='owner-partial')g.bind();
        if(['partial','failed-edge'].includes(fault))g.release(owner.owner);
      }
      const receipt=await run;
      if(fault==='lost-ack')run.cancel('authored reply lost after real edge receipts');
      s=g.status('chord');
      if(fault==='complete'){
        assert(receipt.consumed&&s.consumed);assert.equal(s.state,'CONSUMED');
        g.release(owner.owner);const released=g.status('chord');
        assert(released.consumed);assert.equal(released.state,'CANCELLED');assert.equal(released.reason,'independent release');
        assert(released.edges.every(e=>e.consumed&&e.state==='CANCELLED'));
        assert.deepEqual(f.up,[39,32]);
        // Returned JSON is detached; a client cannot forge server-owned state.
        released.edges[0].state='UNKNOWN';assert.equal(g.status('chord').state,'CANCELLED');
        const replacement=g.bind();assert.notEqual(replacement.owner,owner.owner);
        assert.equal(g.status('chord').owner,owner.owner);
      }else{
        assert.equal(s.state,'UNKNOWN',fault);
        assert(!s.consumed);g.release(owner.owner);assert.equal(g.status('chord').state,'UNKNOWN');
        assert(f.up.includes(39),'independent UP for applied first DOWN');
      }
      assert.throws(()=>g.compound(envelope(),keys,enqueue),/nonce/);
      assert.throws(()=>g.prepare(envelope(),keys[0]),/nonce/);
      assert.throws(()=>g.prepare(envelope('chord/1'),keys[0]),/nonce/);
      assert.throws(()=>g.status('foreign/chord'),/unknown guarded nonce/);
      checks++;
    }finally{g.close();}
  }
  for(const collision of ['base-edge','child-edge','child-compound','reserved-child']){
    const f=fixture(),{g,keys,envelope,enqueue}=f;
    try{
      if(collision==='base-edge')g.prepare(envelope('chord'),keys[0]);
      if(collision==='child-edge')g.prepare(envelope('chord/1'),keys[0]);
      let prior;
      if(collision==='child-compound')prior=g.compound(envelope('chord/1'),keys,()=>{});
      if(collision==='reserved-child')prior=g.compound(envelope(),keys,()=>{});
      if(collision==='reserved-child'){
        assert.throws(()=>g.compound(envelope('chord/1'),keys,enqueue),/nonce/);
        assert.throws(()=>g.prepare(envelope('chord/1'),keys[0]),/nonce/);
      }else assert.throws(()=>g.compound(envelope(),keys,enqueue),/nonce/);
      assert.equal(f.tickets.length,0,'collision refused before any handler effect');
      if(prior){prior.cancel();await prior;}
      checks++;
    }finally{g.close();}
  }
  const f=fixture();
  try{
    const foreign={...f.envelope(),owner:'foreign'};
    assert.throws(()=>f.g.compound(foreign,f.keys,f.enqueue),/owner/);
    assert.throws(()=>f.g.status('chord'),/unknown/);
    const run=f.g.compound(f.envelope(),f.keys,()=>{});
    assert.equal(f.g.status('chord').state,'QUEUED');
    f.g.release(f.owner.owner);await run;
    assert.equal(f.g.status('chord').state,'CANCELLED');assert(!f.g.status('chord').handlerApplied);
    assert.deepEqual(f.up,[]);checks++;
  }finally{f.g.close();}
  console.log('PASS aggregate authored controls: '+checks+' cases; actual native acceptance requires SDL integration');
})().catch(e=>{console.error(e);process.exitCode=1;});
