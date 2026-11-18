'use strict';
// A separate passive phase after a completed pre-main warning gesture. No
// input, capture, forced pump, guest execution or clock mutation occurs here.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const c=require('./native-supervisor-common.cjs');
const a=require('./drakan-authentic-reviewed.cjs');
function fixture(){
 const b=require('./drakan-retired-modal-focus.cjs').fixture({delay:4500});
 const raw=r=>r-0x1000+0x200,u=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 // Ordinary WM_SHOWWINDOW callback spends 700 real guest milliseconds in
 // initialization before delegating to DefWindowProc and returning to USER.
 const code=[0x83,0x7c,0x24,0x08,0x18,0x75,0],emit=(...a)=>code.push(...a);
 emit(0x53,0xff,0x15,...u(0x401904),0x89,0xc3);const loop=code.length;
 emit(0xff,0x15,...u(0x401904),0x29,0xd8,0x3d,...u(700),0x72,0);
 code[code.length-1]=(loop-code.length)&255;emit(0x5b);code[6]=code.length-7;
 emit(0xff,0x25,...u(0x401944));b.set(code,raw(0x2900));return b;
}
const diagnosticCode=`(()=>{
 const actors=new Map([[instance,'main-instance']]);
 for(const w of Object.values(renderer?.windows||{}))if(w.wasm)actors.set(w.wasm,'renderer-window-instance');
 return [...actors].map(([inst,source])=>{const e=inst.exports;
  const names=['get_process_id','get_current_thread_id','get_eip','get_esp','get_yield_reason','get_focus_hwnd','get_main_hwnd','get_dll_callback_lock','get_dll_callback_owner','get_send_target_tid','get_send_hwnd','get_send_msg','pending_context_callback_version','pending_context_callback_entries','pending_context_callback_returns'];
  const values=Object.fromEntries(names.map(n=>[n,typeof e[n]==='function'?e[n]():null]));
  const esp=values.get_esp>>>0,stack=[];
  for(let i=0;i<16;i++){const p=e.guest_to_wasm(esp+i*4)>>>0;stack.push(p>=4096&&p+4<=memory.buffer.byteLength?new DataView(memory.buffer).getUint32(p,true):null);}
  return {source,mainInstance:inst===instance,values,stack,windows:Object.values(renderer?.windows||{}).filter(w=>w.wasm===inst).map(w=>({hwnd:w.hwnd,rendererVisible:!!w.visible,live:!!e.wnd_lookup_live(w.hwnd),generation:String(e.wnd_lookup_generation(w.hwnd)),thread:e.get_window_thread(w.hwnd),style:e.wnd_get_style_export(w.hwnd)}))};
 });
})()`;
function identity(reply,completed){
 assert.equal(reply.contract,'native-startup-readiness-v1');
 const s=reply.snapshot;
 assert.deepEqual(s.nativeProcess,completed.nativeProcess,'startup process changed');
 assert.deepEqual(s.screen,completed.screen,'startup screen changed');
 assert.equal(s.physicalUp,true);assert.equal(s.capture,'0x0');assert.equal(s.quit,false);
 assert.notEqual(s.eip,'0x0');assert(Array.isArray(reply.failures));
 for(const key of ['processId','threadId'])if(reply.ordinaryOwner?.[key])
  assert.equal(reply.ordinaryOwner[key],completed.actor[key],'startup observer actor changed');
 if(reply.ready){
  assert.equal(reply.failures.length,0);assert.equal(reply.ordinaryOwner.healthy,true);
  assert.equal(reply.ordinaryOwner.actorContext,true);
  assert.equal(reply.ordinaryOwner.processId,completed.actor.processId);
  assert.equal(reply.ordinaryOwner.threadId,completed.actor.threadId);
 }
}
async function wait(name){
 try{
  a.opened();assert(/^[a-zA-Z0-9-]+$/.test(name));
  const done=a.read(name+'-input-complete.json'),launch=a.read('launch.json');
  assert.equal(done.contract,'drakan-completed-warning-input-v1');
  assert(done.consumed&&done.physicalUp&&done.progressed&&done.at<done.deadline);
  assert.deepEqual(a.read('last-intent.json').nonces,done.nonces);
  const seconds=launch.startupReadinessSeconds;
  assert(Number.isInteger(seconds)&&seconds>0&&seconds<=60,'predeclared finite startup bound required');
  const start=c.now(),deadline=done.startupDeadline;
  assert.equal(deadline,Math.min(done.at+seconds,a.reserve()));assert(deadline<launch.deadline-2);
  assert(start<deadline);a.save(name+'-startup-intent.json',{start,deadline,seconds,afterCompletedInput:done.at,passive:true});
  let diagnosticAt=0;
  for(;;){
   a.opened();assert(c.now()<deadline,'passive startup readiness deadline exceeded');
   const reply=await a.call({action:'native-startup-readiness'},Math.min(3,deadline-c.now()));
   fs.appendFileSync(path.join(a.R,name+'-startup.jsonl'),JSON.stringify({at:c.now(),deadline,reply})+'\n');
   assert(c.now()<deadline,'passive startup readiness deadline exceeded');identity(reply,done);
   if(c.now()>=diagnosticAt){
    a.opened();assert(c.now()<deadline,'passive startup readiness deadline exceeded');
    const diagnostics=await a.call({action:'eval',code:diagnosticCode},Math.min(3,deadline-c.now()));
    fs.appendFileSync(path.join(a.R,name+'-startup-actors.jsonl'),JSON.stringify({at:c.now(),diagnostics})+'\n');
    diagnosticAt=c.now()+1;
   }
   if(reply.ready){a.save(name+'-startup-ready.json',{at:c.now(),deadline,reply});return reply;}
   await c.sleep(Math.min(100,Math.max(0,(deadline-c.now())*1000)));
  }
 }catch(e){a.fail(e,name+'-startup');throw e;}
}
module.exports={wait,identity,diagnosticCode,fixture};
