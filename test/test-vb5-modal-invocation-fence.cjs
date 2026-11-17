'use strict';
// Real native effects and actual CPUWorker RPC. No original or shadow execution.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createGuardedInput}=require('../lib/cli-guarded-input');
const {bootRenderHarness}=require('./render-helper');
async function buttons(module,worker){
 const pe=require('./test-vb5-native-dialog-identity.cjs').fixture({simpleButton:true});
 const h=await bootRenderHarness({prebuiltModule:module,fonts:'none'}),e=h.exports,memory=h.memory;
 new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));e.set_process_id(1000);
 let host,call=async(n,...a)=>e[n](...a),slice=async()=>e.run(128);
 if(worker){
  const imports=require('../lib/host-imports').createHostImports({getMemory:()=>memory.buffer,resourceJson:{}}).host;imports.memory=memory;
  host=new (require('../lib/guest-thread-host').GuestThreadHost)({memory,module,hostImports:imports,
   sigs:require('../lib/host-import-sigs.generated.json').sigs,workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0});
  await host.start();await host.loadPe(pe,'native-button-owner.exe');call=(n,...a)=>host.callExport(n,...a);
  slice=async()=>{const r=await host.link.slice(128);assert(!r.trapped,JSON.stringify(r));};
 }
 try{
  await call('set_process_id',1000);await call('set_current_thread_id',1);await call('set_eip',0x402000);
  await call('set_esp',0x7408000);await call('guest_write32',0x7408000,0);
  for(let n=0;n<200;n++){const d=await call('dialogbox_hwnd');if(d&&((await call('wnd_get_style_export',d))&0x10000000)&&await call('get_yield_reason')===7)break;if([1,6,7,15].includes(await call('get_yield_reason')))await call('clear_yield');await slice();}
  const parent=await call('dialogbox_hwnd');assert(parent);
  let button=0,slot=-1;while((slot=await call('wnd_next_child_slot',parent,slot+1))>=0){const h=await call('wnd_slot_hwnd',slot);if(await call('ctrl_get_class',h)===1){button=h;break;}}
  assert(button);const x=(await call('wnd_window_screen_x',button))+5,y=(await call('wnd_window_screen_y',button))+5;
  const before=await call('native_button_receipt_word',0,0);
  await call('set_current_thread_id',99);
  assert.equal(await call('dialog_route_mouse_screen',parent,0x201,1,x,y),0);
  assert.equal(await call('native_button_receipt_word',0,0),before);
  assert.equal(await call('wnd_lookup_live',parent),1);
  await call('set_current_thread_id',1);
  const peer=new WebAssembly.Instance(module,{host:h.host}).exports;
  peer.init_thread(1,e.get_image_base(),e.get_code_start(),e.get_code_end(),e.get_thunk_base(),e.get_thunk_end(),e.get_num_thunks(),e.get_rsrc_rva());
  assert.equal(peer.get_current_thread_id(),2);
  assert.equal(peer.dialog_route_mouse_screen(parent,0x201,1,x,y),0);
  assert.equal(peer.native_button_receipt(0),0n);
  assert.equal(await call('wnd_lookup_live',parent),1);
  assert.equal(await call('dialog_route_mouse_screen',parent,0x201,1,x,y),1,JSON.stringify({worker,parent,button,x,y,thread:await call('get_window_thread',parent),style:await call('wnd_get_style_export',parent),childstyle:await call('wnd_get_style_export',button),xy:await call('ctrl_get_xy',button)}));
  assert.equal(await call('native_button_receipt_word',0,0),before+1);
  assert(await call('native_button_receipt_word',8,0));assert(await call('native_button_receipt_word',9,0));
  return {worker,wrongActor99Refused:true,validSibling2Refused:true,owner1ActualNativeReturn:true,exactInvocation:true};
 }finally{if(host)await host.stop();}
}
async function run(out){
 fs.mkdirSync(out,{recursive:true});
 const module=new WebAssembly.Module(fs.readFileSync(process.env.DELPHI5_MODULE_FD));
 const results=[],buttonResults=[];
 for(const worker of [false,true])for(const fault of [null,'late-return']){
  let clock=Date.now();
  let guard,token=0,edge=null,initialFocus;
  const input={check_input:()=>{if(!edge)return 0;const value=edge;edge=null;token=guard.dequeued(value);return value.msg|(value.wParam<<16);},check_input_token:()=>token,check_input_hwnd:()=>initialFocus,check_input_lparam:()=>0};
  const pe=require('./test-vb5-installed-native.cjs').fixture();
  const h=await bootRenderHarness({prebuiltModule:module,fonts:'none',extraHostOverrides:input}),e=h.exports,memory=h.memory;
  new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
  e.set_process_id(1000);e.set_current_thread_id(1);
  let host,call=async(n,...a)=>e[n](...a),slice=async()=>e.run(128),imports=h.host,ctx=h.hostCtx;
  if(worker){
   const {createHostImports}=require('../lib/host-imports');
   ctx={getMemory:()=>memory.buffer,resourceJson:{},g2w:p=>p-e.get_image_base()+e.get_guest_base()};
   imports=createHostImports(ctx).host;Object.assign(imports,input);imports.memory=memory;
   const {GuestThreadHost}=require('../lib/guest-thread-host');
   host=new GuestThreadHost({memory,module,hostImports:imports,sigs:require('../lib/host-import-sigs.generated.json').sigs,
    workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0});
   await host.start();await host.loadPe(pe,'modal-fence-worker.exe');
   call=(n,...a)=>host.callExport(n,...a);slice=async()=>{const r=await host.link.slice(128);assert(!r.trapped,JSON.stringify(r));};
  }
  // The broker observer reads the active child's shared private publication;
  // it executes no guest consumer and owns no continuation.
  ctx.g2w=p=>p-e.get_image_base()+e.get_guest_base();
  ctx.nativeInputActor=()=>e;
  const queue=[],refs={queue,buffer:memory.buffer,actorExports:e,tid:1};
  guard=createGuardedInput({snapshot:()=>({healthy:true,refs}),cleanup:()=>{},nativeDelivery:true,nativeProofRequired:true,now:()=>clock,monotonic:()=>clock,
   captureDelivery:()=>initialFocus,validateDelivery:f=>f===(worker?(Number(e.native_modal_key_fence_word(9))||initialFocus):e.get_focus_hwnd())});
  ctx.guardedInput=guard;
  const modal=guard.nativeModal.bind(guard);let negatives=0;
  guard.nativeModal=(t,p)=>{
   for(const bad of [{...p,buffer:new ArrayBuffer(16)},{...p,actorExports:{}},{...p,threadId:99},{...p,ptr:p.ptr+4},
     {...p,msg:p.msg+1},...([0,1,3,6,8,10,11,12,13,14,16,23].map(i=>({...p,fence:p.fence.map((n,j)=>j===i?n+1n:n)})))]){
    assert.equal(modal(t,bad),false,'mismatched actual invocation cannot claim/return');negatives++;
   }
   if(fault&&p.apiKind===5)clock+=501;
   return modal(t,p);
  };
  const owner=guard.bind();const consumed=[];
  const until=async pred=>{for(let n=0;n<400;n++){if(await pred())return;if([1,6,7,15].includes(await call('get_yield_reason')))await call('clear_yield');await slice();}throw Error('native deadline '+JSON.stringify({worker,token,edge,focus:await call('get_focus_hwnd'),state:guard.status('modal-9')}));};
  try{
   await call('set_process_id',1000);await call('set_current_thread_id',1);
   await call('set_eip',0x402000);await call('set_esp',0x7408000);await call('guest_write32',0x7408000,0);
   await until(async()=>!!await call('get_main_hwnd'));const main=await call('get_main_hwnd');
   await call('post_message_q',main,0x100,79,0);await until(async()=>!!await call('modal_dialog_hwnd'));
   for(const key of [9,27]){
    initialFocus=await call('get_focus_hwnd');
    const event={msg:0x100,wParam:key,lParam:0,hwnd:initialFocus};
    const ticket=guard.prepare({...owner,nonce:'modal-'+key,reviewed:true,deadline:clock+500},{action:'keydown'});
    guard.consume(ticket,()=>queue.push(event));edge=event;if(worker)host.broker.publish({inputPending:1});
    await until(async()=>{const r=guard.status('modal-'+key);return r.consumed||r.state==='UNKNOWN';});
    if(fault){assert.equal(guard.status('modal-'+key).state,'UNKNOWN');assert(!guard.status('modal-'+key).consumed);assert.notEqual(await call('get_focus_hwnd'),initialFocus,'legitimate Tab effect preserved');break;}
    const r=guard.status('modal-'+key);assert.equal(r.receiptBoundary,'native-modal-invocation-return');consumed.push(r);
    assert.equal(e.native_modal_key_fence_word(0),0n,'no active publication survives return');
   }
   if(!fault){assert.equal(await call('modal_dialog_hwnd'),0);assert.equal(await call('get_focus_hwnd'),main);}
   results.push({worker,fault,consumed,actualNative:true,negatives,lateNativeEffectUnacknowledged:!!fault});
  }finally{guard.close();if(host)await host.stop();}
 }
 for(const worker of [false,true])buttonResults.push(await buttons(module,worker));
 fs.writeFileSync(path.join(out,'modal-fence-proof.json'),JSON.stringify({passed:true,results,buttonResults},null,2)+'\n');
}
async function main(){
 const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
 const cp=require('node:child_process'),w=cp.spawn(process.execPath,['-e',`const t=setTimeout(()=>{try{process.kill(-${process.pid},'SIGKILL')}catch{};process.exit(2)},20000);console.log('ARMED');process.stdin.on('end',()=>clearTimeout(t));process.stdin.resume();`],{detached:true});
 let stdout='',stderr='';w.stdout.on('data',b=>stdout+=b);w.stderr.on('data',b=>stderr+=b);const wait=new Promise(r=>w.on('close',(exit,signal)=>r({exit,signal})));
 while(!stdout.includes('ARMED'))await new Promise(r=>setTimeout(r,5));
 fs.writeFileSync(path.join(out,'watchdog-armed.json'),JSON.stringify({pid:w.pid,prearmed:true,deadlineMs:20000}));
 try{await run(out);}finally{w.stdin.end();const r=await wait;fs.writeFileSync(path.join(out,'watchdog-wait.json'),JSON.stringify({...r,actualWait:true,stdoutEOF:w.stdout.readableEnded,stderrEOF:w.stderr.readableEnded,stdout,stderr}));assert.equal(r.exit,0);}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
