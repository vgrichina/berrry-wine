'use strict';
// Real guest DialogBox DLGPROC -> MessageBoxA -> outer DLGPROC restoration.
// Authored fixtures only; automation here never applies to original media.
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {run,fixture}=require('./test-vb5-native-dialog-identity.cjs');
async function workerProof(out){
 const {GuestThreadHost}=require('../lib/guest-thread-host');
 const {createHostImports}=require('../lib/host-imports');
 const module=await WebAssembly.compile(fs.readFileSync(process.env.DELPHI5_MODULE_FD));
 const cases=[];
 for(const mode of ['return','wrong-owner','parent-generation','actor','callback','retirement']){
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});imports.host.memory=memory;
  const logs=[],host=new GuestThreadHost({memory,module,hostImports:imports.host,
   sigs:require('../lib/host-import-sigs.generated.json').sigs,workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),
   clockIntervalMs:0,log:s=>logs.push(s)});
  const call=(n,...a)=>host.callExport(n,...a);
  const identity=async(kind,i)=>BigInt((await call('native_modal_identity_word',kind,i,0))>>>0)|(BigInt((await call('native_modal_identity_word',kind,i,1))>>>0)<<32n);
  const f=i=>identity(1,i),outerIdentity=i=>identity(0,i);
  const until=async pred=>{for(let n=0;n<200;n++){if(await pred())return;const y=await call('get_yield_reason');if([1,6,7,15].includes(y))await call('clear_yield');const r=await host.link.slice(128);assert(!r.trapped,JSON.stringify(r));}const h=await call('dialogbox_hwnd'),s=[];for(let i=0;i<256;i++)if(await call('wnd_slot_hwnd',i)===h)s.push(i);const base=require('../lib/region-map.generated').BASE.NATIVE_DIALOGBOX_IDENTITIES,v=new DataView(memory.buffer);throw Error('actual Worker native modal deadline '+JSON.stringify({eip:await call('get_eip'),yield:await call('get_yield_reason'),dialog:h,thread:await call('get_current_thread_id'),windowThread:await call('get_window_thread',h),process:await call('get_process_id'),callback:await call('dialog_get_proc_export',h),generation:String(await call('wnd_lookup_generation',h)),records:s.map(i=>Array.from({length:8},(_,j)=>v.getUint32(base+i*32+j*4,true))),logs}));};
  let link;
  try{
   await host.start();link=host.link;await host.loadPe(fixture({nestedBox:true}),'nested-worker.exe');
   await call('set_process_id',1000);await call('set_current_thread_id',1);
   await call('set_eip',0x402000);await call('set_esp',0x7408000);await call('guest_write32',0x7408000,0);
   await until(async()=>!!await outerIdentity(0));
   const outer=await Promise.all(Array.from({length:7},(_,i)=>outerIdentity(i)));
   await call('post_message_q',Number(outer[0]),0x111,1,0);
   await until(async()=>!!await f(0));
   const box=[await f(0),await f(1),await f(2)];assert.equal(box[2],outer[1]);assert.notEqual(box[0],outer[0]);
   assert.equal(await call('wnd_get_owner',Number(box[0])),Number(outer[0]));
   assert.equal(await call('ctrl_get_class',Number(box[0])),16);
   assert.equal(await call('wnd_lookup_live',Number(outer[0])),1);
   const parent=Number(outer[0]),h=Number(box[0]),view=new DataView(memory.buffer);
   const slot=async hwnd=>{for(let s=0;s<256;s++)if(await call('wnd_slot_hwnd',s)===hwnd)return s;throw Error('native slot missing');};
   if(mode==='return'){
    await call('modal_cancel_if_hwnd',h);await until(async()=>!(await call('modal_dialog_hwnd')));
    assert.equal(await f(0),0n);assert.deepEqual(await Promise.all(outer.map((_,i)=>outerIdentity(i))),outer);
   }else{
    if(mode==='wrong-owner')view.setUint32(require('../lib/region-map.generated').BASE.OWNER_TABLE+await slot(h)*4,0,true);
    if(mode==='callback')view.setUint32(require('../lib/region-map.generated').BASE.DIALOG_STATE_TABLE+await slot(parent)*16,0x402400,true);
    if(mode==='actor')await call('set_process_id',99);
    if(mode==='retirement')await call('wnd_lookup_retire',parent);
    if(mode==='parent-generation'){await call('destroy_dialog_frame',parent);await call('wnd_table_set',parent,0xffff0001);}
    assert.equal(await f(0),0n,'actual Worker creation seal must refuse '+mode);
   }
   assert(logs.some(s=>s.includes('instantiated')),'actual CPU Worker');
   cases.push({mode,outer:outer.map(String),box:box.map(String),native:true,actualCPUWorker:true});
  }finally{await host.stop();}
  assert(link._stopped,'actual Worker stop joined');
 }
 fs.writeFileSync(path.join(out,'actual-worker.json'),JSON.stringify({passed:true,cases},null,2)+'\n');
}
async function main(){const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});if(process.argv[3]!=='--worker')await run(out,{modes:[
 'positive-box','nested-wrong-owner','nested-parent-generation',
 'nested-foreign-thread','nested-foreign-process','nested-callback','nested-retired',
 'nested-generation','nested-focus','nested-disabled'
]});
 const watchdog=cp.spawn(process.execPath,['-e',`const t=setTimeout(()=>{try{process.kill(-${process.pid},'SIGKILL')}catch{};process.exit(2)},60000);console.log('ARMED');process.stdin.on('end',()=>clearTimeout(t));process.stdin.resume();`],{detached:true,stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='';watchdog.stdout.on('data',b=>stdout+=b);watchdog.stderr.on('data',b=>stderr+=b);
 const joined=new Promise(r=>watchdog.on('close',(exit,signal)=>r({exit,signal})));
 while(!stdout.includes('ARMED'))await new Promise(r=>setTimeout(r,5));
 fs.writeFileSync(path.join(out,'worker-watchdog-armed.json'),JSON.stringify({pid:watchdog.pid,independent:true,prearmed:true,deadlineMs:60000}));
 try{await workerProof(out);}finally{
  watchdog.stdin.end();const receipt=await joined;
  fs.writeFileSync(path.join(out,'worker-watchdog-wait.json'),JSON.stringify({...receipt,actualWait:true,stdoutEOF:watchdog.stdout.readableEnded,stderrEOF:watchdog.stderr.readableEnded,stdout,stderr}));
  assert.equal(receipt.exit,0);
 }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
