'use strict';
const assert=require('node:assert/strict');
const {createGuardedInput}=require('../lib/cli-guarded-input');
function units(){
 const modes=['replace-page','destroy-target','no-claim-context','pre-entry-context','stale-token','foreign-actor','foreign-process','foreign-thread','target-reused-entry','target-reused-return','target-reused-retired','retired-owner','reused-owner','parent-retired','epoch-changed','invocation-changed','callback-changed','frame-changed','wrong-message','wrong-stack','early-return','error','late-return','cancel-then-return','foreign-focus','focus-reused','dialog-callback-replaced'];
 for(const mode of modes){
  let time=1000,context=0,healthy=true,ups=0,pid=1000,tid=1;
  const queue=[],refs={queue,buffer:{},tid:1};let f=Array(32).fill(0n),gens=new Map([[11,3n],[12,4n],[10,2n],[9,1n]]),live=new Set([9,10,11,12]);
  const e={native_dialog_input_fence_word:i=>f[i],get_process_id:()=>pid,get_current_thread_id:()=>tid,
   wnd_lookup_generation:h=>gens.get(h)||0n,wnd_lookup_live:h=>+live.has(h),get_window_thread:()=>1,
   wnd_get_proc_export:()=>0x401000,wnd_get_owner:()=>9,wnd_top_level:()=>mode==='foreign-focus'?99:10,dialogbox_hwnd:()=>10};refs.actorExports=e;
  const g=createGuardedInput({snapshot:()=>({healthy,refs}),nativeDelivery:true,nativeProofRequired:true,now:()=>time,monotonic:()=>time,
   captureDelivery:()=>context,validateDelivery:c=>c===context,cleanup:()=>ups++});
  const o=g.bind(),t=g.prepare({...o,nonce:mode,reviewed:true,deadline:1500},{action:'mousedown'}),event={hwnd:11,msg:0x201,wParam:1,lParam:42};
  g.consume(t,()=>queue.push(event));const token=g.dequeued(event);assert(token>0);
  Object.assign(f,{0:1n,1:BigInt(token),2:1024n,3:1n,4:1000n,5:10n,6:2n,7:9n,8:1n,9:11n,10:3n,11:768n,12:20n,13:19n,14:1n,15:11n,16:513n,17:1n,18:42n,23:5n,24:8192n,25:0x401000n,27:0x44494e50n,29:0x402000n,30:0x401000n});
  const proof=kind=>({buffer:refs.buffer,actorExports:e,threadId:1,ptr:1024,apiKind:kind,remove:1,...event,fence:f.slice()});
  if(mode==='pre-entry-context')context++;
  if(mode==='stale-token')f[1]++;
  if(mode==='target-reused-entry')gens.set(11,30n);
  let p=proof(6);if(mode==='foreign-actor')p.actorExports={...e};
  if(mode==='foreign-process')pid=1001;if(mode==='foreign-thread')tid=2;
  const claimed=mode==='no-claim-context'?false:g.nativeDialogInput(token,p);
  if(['pre-entry-context','stale-token','foreign-actor','foreign-process','foreign-thread','target-reused-entry','no-claim-context'].includes(mode)){
   assert(!claimed,mode);context++;g.sweep();assert(!t.consumed);g.release(o.owner);g.close();continue;
  }
  assert(claimed,mode);assert(!t.consumed,'entry is never completion');
  context++;if(mode==='destroy-target'){live.delete(11);gens.delete(11);}
  if(mode==='target-reused-return')gens.set(11,30n);
  if(mode==='target-reused-retired'){gens.set(11,30n);live.delete(11);}
  if(mode==='retired-owner')live.delete(10);
  if(mode==='reused-owner')gens.set(10,20n);
  if(mode==='parent-retired')gens.delete(9);
  if(mode==='epoch-changed')f[23]++;
  if(mode==='invocation-changed')f[12]++;
  if(mode==='callback-changed')f[25]++;
  if(mode==='frame-changed')f[11]++;
  if(mode==='wrong-message')f[18]++;
  if(mode==='wrong-stack')f[24]++;
  if(mode==='late-return')time=1501;
  if(mode==='cancel-then-return')g.release(o.owner);
  if(mode==='error')healthy=false;
  g.sweep();
  if(mode!=='early-return')f[0]=2n;
  f[19]=12n;f[20]=4n;f[21]=10n;f[22]=2n;f[31]=f[29];
  if(mode==='focus-reused')gens.set(12,40n);
  if(mode==='dialog-callback-replaced')f[31]++;
  const accepted=g.nativeDialogInput(token,proof(7));
  if(['replace-page','destroy-target'].includes(mode)){
   assert(accepted,mode);assert(t.consumed);assert.equal(t.receiptBoundary,'native-dialog-input-invocation-return');assert.equal(t.nativeMessage.generation,'3');
  }else{assert(!accepted,mode);assert(!t.consumed,mode);}
  g.release(o.owner);assert.equal(ups,1,'original physical release exactly once');
  assert(!g.nativeDialogInput(token,proof(7)),'terminal return never revives');g.close();
 }
 console.log('PASS DialogBox retained input receipt '+modes.join(', '));
}
async function native(out,modulePath){
 const fs=require('node:fs'),path=require('node:path');
 const {bootRenderHarness}=require('./render-helper');
 fs.mkdirSync(out,{recursive:true});
 const module=new WebAssembly.Module(fs.readFileSync(modulePath)),results=[];
 for(const worker of [false,true])for(const destroyTarget of [false,true])for(const late of [false,true]){
  const dir=path.join(out,`${worker?'worker':'local'}-${destroyTarget?'destroy':'replace'}-${late?'late':'return'}`);
  const pe=fs.readFileSync(require('../tools/ut-goty-listbox-wizard.cjs').prepare(dir,{transition:true,destroyTarget}));
  let guard,edge,token=0,target=0,initialFocus=0,context=0,clock=1000,ups=0;
  const input={check_input:()=>{if(!edge)return 0;const v=edge;edge=null;token=guard.dequeued(v);return v.msg|(v.wParam<<16);},check_input_token:()=>token,check_input_hwnd:()=>target,check_input_lparam:()=>0};
  const h=await bootRenderHarness({prebuiltModule:module,fonts:'none',extraHostOverrides:input}),e=h.exports,memory=h.memory;
  new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
  e.set_process_id(1000);e.set_current_thread_id(1);
  let host,ctx=h.hostCtx,call=async(n,...a)=>e[n](...a),slice=async()=>e.run(128);
  if(worker){
   ctx={getMemory:()=>memory.buffer,resourceJson:{}};
   const imports=require('../lib/host-imports').createHostImports(ctx).host;Object.assign(imports,input);imports.memory=memory;
   host=new (require('../lib/guest-thread-host').GuestThreadHost)({memory,module,hostImports:imports,sigs:require('../lib/host-import-sigs.generated.json').sigs,workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0});
   await host.start();await host.loadPe(pe,'page-replacement.exe');call=(n,...a)=>host.callExport(n,...a);slice=async()=>{const r=await host.link.slice(128);assert(!r.trapped,JSON.stringify(r));};
  }
  ctx.g2w=p=>p-e.get_image_base()+e.get_guest_base();ctx.nativeInputActor=()=>e;
  const queue=[],refs={queue,buffer:memory.buffer,actorExports:e,tid:1};
  // A mutable focus mismatch is deliberately observable throughout the real
  // callback. Only its retained native invocation may own that transition.
  guard=createGuardedInput({snapshot:()=>({healthy:true,refs}),cleanup:()=>ups++,nativeDelivery:true,nativeProofRequired:true,now:()=>clock,monotonic:()=>clock,captureDelivery:()=>context,validateDelivery:c=>c===context});ctx.guardedInput=guard;
  const prove=guard.nativeDialogInput.bind(guard);let negatives=0,entry=false,returned=false;
  guard.nativeDialogInput=(t,p)=>{
   for(const bad of [{...p,buffer:{}},{...p,actorExports:{}},{...p,threadId:99},{...p,ptr:p.ptr+4},{...p,msg:p.msg+1},...[1,3,4,5,6,10,11,12,13,14,23,24,25,29].map(i=>({...p,fence:p.fence.map((v,j)=>i===j?v+1n:v)}))]){assert.equal(prove(t,bad),false);negatives++;}
   if(p.apiKind===6){entry=true;assert(!guard.status('next').consumed);}
   if(p.apiKind===7){returned=true;if(late)clock=1501;}
   const accepted=prove(t,p);
   if(p.apiKind===6){assert(accepted);assert(!guard.status('next').consumed);context++;guard.sweep();assert.equal(guard.status('next').state,'DELIVERY_PENDING');}
   return accepted;
  };
  const until=async pred=>{for(let n=0;n<800;n++){if(await pred())return;if([1,6,7,15].includes(await call('get_yield_reason')))await call('clear_yield');await slice();}throw Error('native wizard deadline '+JSON.stringify({worker,destroyTarget,late,eip:await call('get_eip'),token}));};
  try{
   await call('set_process_id',1000);await call('set_current_thread_id',1);await call('set_esp',0x7408000);await call('guest_write32',0x7408000,0);
   await until(async()=>!!await call('dialogbox_hwnd')&&[7,15].includes(await call('get_yield_reason')));
   const parent=await call('dialogbox_hwnd');let slot=-1;
   while((slot=await call('wnd_next_child_slot',parent,slot+1))>=0){const h=await call('wnd_slot_hwnd',slot);if(await call('ctrl_get_class',h)===1&&await call('wnd_get_proc_export',h)<0xffff0000){target=h;break;}}
   assert(target);initialFocus=await call('get_focus_hwnd');assert.notEqual(initialFocus,target);
   const generation=e.wnd_lookup_generation(target),owner=guard.bind(),ticket=guard.prepare({...owner,nonce:'next',reviewed:true,deadline:1500},{action:'mousedown'});
   const event={hwnd:target,msg:0x201,wParam:1,lParam:0};guard.consume(ticket,()=>queue.push(event));edge=event;if(worker)host.broker.publish({inputPending:1});
   await until(async()=>returned&&e.native_dialog_input_fence_word(0)===0n);
   assert(entry&&returned);assert.notEqual(await call('get_focus_hwnd'),initialFocus,'actual callback moved focus');
   assert.equal(await call('wnd_lookup_live',initialFocus),0,'actual callback destroyed old page');
   assert.equal(!!await call('wnd_lookup_live',target),!destroyTarget);
   if(late){assert(!ticket.consumed);assert.equal(ticket.state,'CANCELLED');}
   else{assert(ticket.consumed);assert.equal(ticket.receiptBoundary,'native-dialog-input-invocation-return');assert.equal(ticket.nativeMessage.generation,String(generation));}
   guard.release(owner.owner);assert.equal(ups,1);assert(!prove(token,{apiKind:7,buffer:refs.buffer,actorExports:e,threadId:1,fence:Array(32).fill(0n)}));
   results.push({worker,destroyTarget,late,entry,returned,negatives,physicalReleaseCount:ups,receipt:guard.receipt(ticket),publicationCleared:true});
  }finally{guard.close();if(host)await host.stop();}
 }
 fs.writeFileSync(path.join(out,'native-proof.json'),JSON.stringify({passed:true,results},null,2)+'\n');
 console.log('PASS real DialogBox page replacement/target destruction/late return: native and CPUWorker');
}
if(require.main===module){units();if(process.argv[2])native(require('node:path').resolve(process.argv[2]),process.argv[3]||'build/wine-assembly.wasm').catch(e=>{console.error(e);process.exitCode=1;});}module.exports={units,native};
