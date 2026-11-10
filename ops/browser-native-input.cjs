'use strict';
// Native CDP input only. Timer-driven release never waits for diagnostics.
const assert = require('node:assert/strict');
const KEYS = Object.freeze({ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,
  Enter:13,Escape:27,Tab:9,Home:36,KeyI:73,Space:32,Alt:18,Control:17});
function descriptor(code) {
  assert(Object.hasOwn(KEYS,code), 'unsupported native key: '+code);
  return {key:code==='Space'?' ':code==='KeyI'?'i':code,
    code:code==='Alt'?'AltLeft':code==='Control'?'ControlLeft':code,
    windowsVirtualKeyCode:KEYS[code]};
}
function validate(keys,holdMs) {
  assert(Array.isArray(keys) && (keys.length===1 || keys.length===2 && keys[0]==='ArrowUp' && ['ArrowLeft','ArrowRight'].includes(keys[1])), 'ordinary key or throttle plus steering');
  keys.forEach(descriptor);
  assert(Number.isInteger(holdMs)&&holdMs>=50&&holdMs<=2000,'bounded physical hold');
}
function assertRequired(controls) {
  for(const code of controls) descriptor(code);
  return controls.map(descriptor);
}
async function bounded({send,session,down,up,holdMs,sample=async()=>({}),saveSample=()=>{}}) {
  const attempted=[],samples=[];let error,releasePromise,releaseAt,timer;
  const started=Date.now();
  function release() {
    if(releasePromise)return releasePromise;
    releaseAt=Date.now();
    releasePromise=(async()=>{for(const base of [...attempted].reverse())try{await send(up.method,up.params(base),session);}catch(e){error??=e;}})();
    return releasePromise;
  }
  try {
    timer=setTimeout(()=>{release().catch(e=>{error??=e;});},holdMs);
    for(const base of down.bases) {
      attempted.push(base);
      await send(down.method,down.params(base),session);
      assert(!releasePromise,'input delivery exceeded hold bound');
    }
    while(!releasePromise) {
      const begin=Date.now(),value=await sample();
      const row={phase:'held',started:begin,finished:Date.now(),...value};samples.push(row);await saveSample(row);
      if(!releasePromise)await new Promise(r=>setTimeout(r,Math.min(100,Math.max(1,holdMs-(Date.now()-started)))));
    }
  }catch(e){error??=e;}
  finally{clearTimeout(timer);await release();}
  for(const s of samples)s.whollyDuringHold=s.started>=started&&s.finished<releaseAt;
  const receipt={started,releaseAt,samples,attempted:attempted.map(b=>b.code??b.button),meaning:'command-attempt interval; samples do not prove trusted delivery, guest input polls or simulation steps'};
  if(error){error.holdReceipt=receipt;throw error;}
  return receipt;
}
async function hold(options) {
  validate(options.keys,options.holdMs);
  return bounded({...options,down:{method:'Input.dispatchKeyEvent',bases:options.keys.map(descriptor),params:b=>({type:'keyDown',...b})},up:{method:'Input.dispatchKeyEvent',params:b=>({type:'keyUp',...b})}});
}
async function mouse(options) {
  const {button,x,y,holdMs}=options;
  assert(['left','right'].includes(button),'ordinary mouse button');
  assert(Number.isFinite(x)&&Number.isFinite(y),'finite pointer');
  assert(Number.isInteger(holdMs)&&holdMs>=50&&holdMs<=2000,'bounded physical hold');
  const base={button,x,y,clickCount:1};
  return bounded({...options,down:{method:'Input.dispatchMouseEvent',bases:[base],params:b=>({type:'mousePressed',...b})},up:{method:'Input.dispatchMouseEvent',params:b=>({type:'mouseReleased',...b})}});
}
// Correlate observations on the browser host's wall clock. CDP completion is
// transport evidence only: it is neither the beginning of a hold nor a guest
// read. In particular, a DOWN ACK can arrive after UP was submitted.
function correlateMousePulse({pulse,events,records,button=0}) {
  const a=pulse.downAttemptedAt,z=pulse.upAttemptedAt;
  assert(pulse.down?.ack&&pulse.up?.ack,'known balanced command acknowledgements required');
  assert([a,z,pulse.down.at,pulse.up.at].every(Number.isFinite)&&a<=z,'ordered attempt timestamps required');
  const edges=events.filter(e=>e.button===button&&['mousedown','mouseup'].includes(e.type)&&e.at>=a&&e.at<=Math.max(pulse.down.at,pulse.up.at));
  assert.equal(edges.length,2,'one observed mouse down/up pair required');
  const [down,up]=edges;
  assert(down.trusted===true&&up.trusted===true&&down.type==='mousedown'&&up.type==='mouseup'&&down.at<=up.at,'ordered trusted mouse delivery required');
  assert(down.at<=pulse.down.at&&up.at>=z&&up.at<=pulse.up.at,'delivery must match command attempts and acknowledgements');
  assert(records.every(r=>Number.isFinite(r.requestAt)&&Number.isFinite(r.at)&&r.requestAt<=r.at&&r.state?.length>=13),'complete guest read timestamps and state required');
  const successful=records.filter(r=>r.eax===0);
  const during=successful.filter(r=>r.requestAt>=down.at&&r.at<up.at);
  const pressed=during.filter(r=>(r.state[12]&128)!==0);
  const released=successful.filter(r=>r.requestAt>up.at&&(r.state[12]&128)===0);
  return {down:down.at,up:up.at,downAttempt:a,upAttempt:z,
    attemptedHoldMs:z-a,trustedHoldMs:up.at-down.at,downDeliveryDelayMs:down.at-a,
    ackIntervalInverted:pulse.down.at>z,ackIsNotConsumption:true,
    successfulCompletions:successful.length,readsWhollyDuringTrustedHold:during,
    pressed,released,allPressed:successful.filter(r=>(r.state[12]&128)!==0),
    actualPress:pressed.length>0,actualRelease:released.length>0,
    meaning:'successful guest button-state reads wholly within observed trusted delivery; no simulation or weapon consequence inferred'};
}
module.exports={KEYS,descriptor,validate,assertRequired,hold,mouse,correlateMousePulse,
  pulse:require('../tools/native-input-pulse.cjs').pulse};
