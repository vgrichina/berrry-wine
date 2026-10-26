'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {extract,parse,machine}=require('./independent-wat-fixture');
const {createMessageBoundaryTrace}=require('./message-boundary-trace');
const {createMessageCompletionOwner}=require('./message-completion-owner');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sources=['src/09a5-handlers-window.wat','src/09a5b-handlers-window-late.wat','src/09a-handlers4-late.wat','test/fixtures/enigma-independent-dispatch.wat'].map(read);
const names=['handle_GetMessageA','handle_GetMessageW','handle_PeekMessageA','handle_PeekMessageW','handle_GetMessage_observed','handle_PeekMessage_observed','keyboard_hook_begin','getmessage_hook_begin','getmessage_hook_continue','keyboard_hook_finish','win32_dispatch_inner','handle_GetMessageA_pump','handle_PeekMessageA_pump','handle_GetMessageA_fetch','handle_PeekMessageA_fetch'];
const texts=Object.fromEntries(names.map(n=>[n,extract(sources.find(s=>s.includes('(func $'+n+' ')||s.includes('(func $'+n+'\n')),n)]));
const cached=Object.fromEntries(Object.entries(texts).map(([n,s])=>['$'+n,parse(s)]));
function harness({on=true,mutate=null,actualPump=false}={}){
 const memory=new Uint8Array(65536),dv=new DataView(memory.buffer),log=[],wires=[],tokens=[],observed=[],order=[];
 const g={$reg_base:64,$DISPDIB_STATE:32,$message_completion_on:+on,$message_completion_active:0,$current_thread_id:1,$yield_flag:0,$code16:0,$hook_active_node:707,$font_enum_ret_thunk:0x750088,$steps:100,$eip:999,$msg_extra_info:8,$quit_flag:2,$main_hwnd:0x10001,$user_queue_input_flags:0,$spin_peek_activity_marked:0,$thunk_guest_base:0x750000,$spin_dispatch_seq:0,$cs_park_pending:0,$handler_hist_enabled:0,$edge_hist_enabled:0,$API_ID_PeekMessageA:11,$API_ID_PeekMessageW:12,$spin_nonpoll_seq:0};
 const load=p=>dv.getInt32(p,true),store=(p,n)=>dv.setInt32(p,n,true);
 let hook=0,mode='immediate',value=1,phase=0,leaveAction=null;
 const trace=createMessageBoundaryTrace({enabled:on,logs:log,snapshot:()=>({batch:phase}),getContext:()=>({exports:{},memory,translate:x=>x})});trace.qualifyCompletion();trace.arm(true);
 const owner=createMessageCompletionOwner({enabled:()=>on&&trace.status().armed&&!trace.status().saturated,observe:d=>{observed.push({detail:d,sp:load(80),eax:load(64),eip:g.$eip,node:g.$hook_active_node,phase});order.push('observe');trace.completed(d);},gap:()=>trace.completionGap()});
 const deps={$gl32:load,$gs32:store,$dispdib_present(){},$getmessage_hook_take(){let n=hook;hook=0;return n;},$hook_node_proc:()=>9000,$hook_dispatch_enter:()=>8000,$hook_dispatch_leave(){order.push('keyboard-leave');},$getmessage_hook_leave(){order.push('message-leave');if(leaveAction)leaveAction();},$dx_sync_thread_vtables_if_needed(){},$thunk_metadata_addr:()=>128,$spin_is_clock_read:()=>0,$vsock_pump(){},$mciavi_tick_all(){},$present_pump:()=>0,$incoming_send_yield(){if(mode==='park'){g.$yield_flag=1;return 1;}return 0;},$omitted:()=>0};
 for(const [n,f] of Object.entries(owner.imports))deps['$host_'+n]=(...a)=>{wires.push([n,...a]);const result=f(...a);if(n==='message_begin')tokens.push(result);return result;};
 const funcs=mutate?Object.fromEntries(Object.entries(texts).map(([n,s])=>{const changed=mutate(s,n);return ['$'+n,changed===s?cached['$'+n]:parse(changed)];})):cached;
 const m=machine(funcs,g,memory,deps);
 function putMSG(ptr,n){[0x10001,n,0xfeed,-1,123,-77,400].forEach((x,i)=>store(ptr+4*i,x));}
 function pump(bytes,msg){
  if(mode==='park'){g.$yield_flag=1;return;}
  const sp=load(80),ret=load(sp);putMSG(msg,0x101+phase);store(64,value);store(80,sp+bytes);
  // Ordinary pumps leave immediate EIP to outer dispatcher; completion does not infer ownership from it.
  if(mode==='keyboard')m.call('$keyboard_hook_begin',[ret,0,65,0x1e0001,msg]);
 }
 if(!actualPump){deps.$handle_GetMessageA_pump=msg=>pump(20,msg);deps.$handle_PeekMessageA_pump=msg=>pump(24,msg);}
 function invoke(api,{sp=4096,msg=2048,flags=1,result=1,which='immediate',hasHook=false}={}){
  mode=which;value=result;hook=hasHook?99:0;g.$yield_flag=0;g.$eip=0xabc;g.$steps=100;store(80,sp);store(sp,0x123456);putMSG(msg,0x100);return m.call('$handle_'+api,[msg,0,0,0,flags,0]);
 }
 function ret(){store(80,load(80)+16);store(64,-888);phase++;store(128,0xcaca0011);store(132,0);m.call('$win32_dispatch_inner',[17]);}
 const records=()=>log.map(s=>JSON.parse(s.slice('[message-boundary] '.length))).filter(x=>x.kind==='message-completion');
 return {g,m,memory,tokens,store,load,owner,trace,invoke,ret,records,wires,observed,order,putMSG,setHook:n=>hook=n,setPhase:n=>phase=n,setLeave:f=>leaveAction=f};
}
let cases=0;const controls=[];
function checkImmediate(){
 for(const api of ['GetMessageA','GetMessageW','PeekMessageA','PeekMessageW']){
  const h=harness({actualPump:true});h.invoke(api);const r=h.records();assert.equal(r.length,1);assert.equal(r[0].api,api);assert.equal(r[0].msg.message,0x12);assert.equal(r[0].result,api.startsWith('Get')?0:1);assert.equal(h.g.$quit_flag,0);assert.equal(h.observed[0].sp,4096+(api.startsWith('Get')?20:24));cases++;
  const p=harness({actualPump:true});p.invoke(api,{which:'park'});assert.equal(p.records().length,0);const token=p.wires.find(x=>x[0]==='message_park')[1];p.invoke(api);assert.equal(p.records()[0].invocation,token);cases++;
 }
}
function hookScenario(config={}){
 const h=harness(config);h.invoke('GetMessageW',{which:'keyboard'});const outer=h.load(80);assert.equal(h.records().length,0);const outerToken=h.tokens[0];
 // A different retrieval completes while the keyboard callback remains outstanding.
 h.invoke('PeekMessageA',{sp:3000,msg:2500,hasHook:true});const inner=h.load(80);h.putMSG(2500,0x3aa);h.ret();assert.equal(h.records().length,1);assert.equal(h.records()[0].api,'PeekMessageA');assert.equal(h.records()[0].msg.message,0x3aa);
 h.store(80,outer);h.setHook(99);h.putMSG(2048,0x3ab);h.ret();assert.equal(h.records().length,1,'keyboard handoff cannot publish interim MSG');
 const deferred=h.load(80);assert.notEqual(deferred,inner);h.putMSG(2048,0x3ac);h.ret();assert.equal(h.records().length,2);const r=h.records()[1];assert.equal(r.api,'GetMessageW');assert.equal(r.invocation,outerToken);assert(r.msg,'final completion must carry a successful MSG');assert.equal(r.msg.message,0x3ac);assert.equal(r.result,1);
 const o=h.observed[1];assert.equal(o.sp,4116);assert.equal(o.eip,0x123456);assert.equal(o.eax,1);assert.equal(o.node,707);assert.equal(o.phase,3);
 assert(h.order.lastIndexOf('message-leave')<h.order.lastIndexOf('observe'));
 h.owner.imports.message_complete(outerToken,8);assert.equal(h.records().length,2,'stale/duplicate terminal completion');return h;
}
function checkDeferred(){
 hookScenario();cases++;
 for(const api of ['GetMessageA','GetMessageW','PeekMessageA','PeekMessageW']){
  for(const which of ['immediate','keyboard']){
   const h=harness();h.invoke(api,{which,hasHook:which==='immediate'});assert.equal(h.records().length,0);h.putMSG(2048,0x400);h.ret();assert.equal(h.records().length,1);assert.equal(h.records()[0].api,api);assert.equal(h.records()[0].msg.message,0x400);cases++;
  }
 }
 const omit=[['actual-keyboard-router','win32_dispatch_inner','(then (call $keyboard_hook_finish) (return))','(then (return))'],['actual-message-router','win32_dispatch_inner','(then (call $getmessage_hook_continue) (return))','(then (return))'],['keyboard-token-handoff','keyboard_hook_finish','$host_message_resume','$omitted'],['final-message-owner','getmessage_hook_continue','$host_message_resume','$omitted'],['keyboard-bind','keyboard_hook_begin','$host_message_bind','$omitted'],['message-bind','getmessage_hook_begin','$host_message_bind','$omitted'],['message-final-observe','getmessage_hook_continue','$host_message_complete','$omitted']];
 for(const [label,target,a,b] of omit){assert(texts[target].includes(a));assert.throws(()=>hookScenario({mutate:(s,n)=>n===target?s.replace(a,b):s}),assert.AssertionError,label);controls.push({label,rejected:true});}
 // Force early completion before restored caller state. The same observer-state oracle rejects.
 const late='(call $host_message_complete (local.get $token) (i32.load (global.get $reg_base)))';
 assert.throws(()=>hookScenario({mutate:(s,n)=>n==='getmessage_hook_continue'?s.replace(late,'(call $omitted (local.get $token) (i32.load (global.get $reg_base)))').replace('(local.set $tid',late+'\n    (local.set $tid'):s}),assert.AssertionError);controls.push({label:'completion-before-caller-restoration',rejected:true});
}
function checkResults(){
 for(const api of ['GetMessageA','GetMessageW','PeekMessageA','PeekMessageW'])for(const value of [-1,0,7]){
  const h=harness();h.invoke(api,{result:value,flags:0});const r=h.records()[0];assert.equal(r.api,api);assert.equal(r.successfulReturn,api.startsWith('Get')?value>=0:value!==0);assert.equal(r.msg===null,!r.successfulReturn);assert.equal(r.pmRemove,api.startsWith('Get'));cases++;
 }
 // Yield remains owned by a bound callback; arbitrary stale exits and unrelated contexts do not consume it.
 const a=harness();a.invoke('PeekMessageW',{which:'keyboard'});const token=a.tokens[0];
 for(const k of [1,2])assert.equal(a.owner.imports.message_resume(k,100),0);a.owner.imports.message_complete(token,100);assert.equal(a.records().length,0);a.ret();assert.equal(a.records()[0].invocation,token);cases++;
 // Synchronous diagnostic off/on state comparison for nested typed continuations, exact wrappers and real dispatcher.
 for(const which of ['immediate','keyboard','park']){
  const a=harness(),b=harness({on:false});for(const h of [a,b]){h.invoke('PeekMessageW',{which,hasHook:which==='immediate'});if(which!=='park')h.ret();}
  assert.deepEqual(a.memory,b.memory);for(const [k,v] of Object.entries(a.g))if(!k.startsWith('$message_completion'))assert.equal(v,b.g[k],k);assert.equal(b.wires.length,0);cases++;
 }
}
checkImmediate();checkDeferred();checkResults();
fs.writeFileSync(path.join(process.argv[2],'continuations-result.json'),JSON.stringify({candidate:'e8bceb042bc3eff6bab73642988be29a7522287e',pass:true,cases,controls,functions:Object.fromEntries(Object.entries(texts).map(([n,s])=>[n,{bytes:Buffer.byteLength(s),sha256:sha(s)}])),qualification:'Uncompiled exact functions including full unchanged dispatcher and real WM_QUIT/pump early-park paths. Hook callback body and other pump paths supplied dependencies. No actual x86/Wasm/guest execution.',compiled:false,canonicalRuntimeQualified:false},null,2));
console.log('PASS independent actual-function continuations',cases,'cases',controls.length,'omissions/order controls');
