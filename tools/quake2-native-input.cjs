'use strict';
// Native physical input only. One reviewed command per scene; never a route.
const assert = require('node:assert/strict');
const KEYS = Object.freeze({ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,
  Alt:18,Control:17,Space:32,Escape:27,Enter:13,Tab:9,a:65,',':188,'.':190});
function validate(key, ms) {
  assert(Object.hasOwn(KEYS,key), 'allowlisted native key');
  assert(Number.isInteger(ms) && ms>=50 && ms<=2000, 'bounded physical hold');
}
function validateCombo(keys, ms) {
  assert(Array.isArray(keys) && keys.length===2 && keys[0]==='ArrowUp' &&
    ['ArrowLeft','ArrowRight','a','Control'].includes(keys[1]),
  'forward plus one reviewed steering or crouch key');
  for(const key of keys)validate(key,ms);
}
async function hold({send,session,keys,holdMs,sample=async()=>({}),saveSample=()=>{},checkSample=()=>{}}) {
  if(keys?.length===1)validate(keys[0],holdMs);else validateCombo(keys,holdMs);
  const attempted=[],samples=[],releases=[];let error,releasePromise,releaseAt;
  const started=Date.now();
  function release() {
    if(releasePromise)return releasePromise;
    releaseAt=Date.now();
    releasePromise=(async()=>{
      for(const base of [...attempted].reverse()){
        try{await send('Input.dispatchKeyEvent',{type:'keyUp',...base},session);releases.push({key:base.key,ack:true});}
        catch(e){releases.push({key:base.key,ack:false,error:String(e)});error??=e;}
      }
    })();
    return releasePromise;
  }
  const timer=setTimeout(()=>{release().catch(e=>{error??=e;});},holdMs);
  try {
    for(const key of keys){
      assert(!releasePromise,'input delivery exceeded physical hold');
      const base={key:key==='Space'?' ':key,code:({Control:'ControlLeft',Alt:'AltLeft',a:'KeyA',',':'Comma','.':'Period'})[key]||key,windowsVirtualKeyCode:KEYS[key]};
      attempted.push(base);await send('Input.dispatchKeyEvent',{type:'keyDown',...base},session);
      assert(!releasePromise,'input delivery exceeded physical hold');
    }
    while(!releasePromise){
      const began=Date.now(),value=await sample();
      const row={phase:'held',started:began,finished:Date.now(),...value};samples.push(row);
      // Latch a rejected required observation before persistence or more work.
      // Preserve that first failure if saving or independent release also fails.
      try{checkSample(row);}catch(e){error??=e;}
      try{await saveSample(row);}catch(e){error??=e;}
      if(error)throw error;
      if(!releasePromise)await new Promise(r=>setTimeout(r,Math.min(100,Math.max(1,holdMs-(Date.now()-started)))));
    }
  }catch(e){error??=e;}
  finally{clearTimeout(timer);await release();}
  for(const row of samples)row.whollyDuringHold=row.started>=started&&row.finished<releaseAt;
  const receipt={started,releaseAt,attempted:attempted.map(v=>v.key),releases,samples,
    physicalRelease:releases.length===attempted.length&&releases.every(v=>v.ack)?'ACK':'UNKNOWN',
    meaning:'physical host interval; passive counters do not prove DirectInput polls or simulation steps'};
  if(error){error.holdReceipt=receipt;throw error;}
  return receipt;
}
module.exports={validate,validateCombo,hold,
  combo:(send,session,keys,holdMs)=>hold({send,session,keys,holdMs})};
