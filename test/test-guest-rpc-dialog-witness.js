'use strict';
// Transport contract only. A native callback return is not a browser receipt.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const RPC=require('../lib/guest-rpc');
async function main(){
 const moduleBytes=fs.readFileSync(process.argv[2]||'build/wine-assembly.wasm');
 const sha=b=>require('node:crypto').createHash('sha256').update(b).digest('hex');
 const module=new WebAssembly.Module(moduleBytes);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dialog-witness-'));
 const results=[];
 try{
  for(const mode of ['valid','missing','missing-scene','slot','endpointIdentity','token','thread','process','ptr','kind','remove','stage','tag','truncated','number','overflow','replay','return-token']){
   const h=await require('./render-helper').bootRenderHarness({prebuiltModule:module,fonts:'none'});
   const memory=h.memory,records=[];let pending=false,target=0,attempts=0,rejected=false,first;
   const table={...h.host,input_validate:t=>t===0?0x424e49:1,
    check_input:()=>{if(!pending)return 0;pending=false;return 0x201|(1<<16);},
    check_input_token:()=>99,check_input_hwnd:()=>target,check_input_lparam:()=>0,
    input_consumed:(...a)=>{assert.equal(a.length,17);const w=a[16],f=w.words;
     assert(Object.isFrozen(w)&&Object.isFrozen(f));assert.equal(f.length,32);
     assert.equal(f[1],99n);assert.equal(f[2],BigInt(a[2]>>>0));assert.equal(f[3],1n);assert.equal(f[4],1000n);
     assert.equal(f[9],BigInt(target));assert.notEqual(f[5],f[9],'root and control remain distinct');
     assert(f[6]>0n&&f[10]>0n&&f[11]>0n&&f[12]>0n&&f[13]>0n&&f[23]>0n);
     assert.equal(f[27],0x44494e50n);
     // The actor is parked inside the import. Verify every transported i64
     // against its actual retained native frame, including high halves.
     assert.equal(f[2],f[11]+256n);
     const nativeFrame=new DataView(memory.buffer,(a[15]>>>0)-256,256);
     for(let i=0;i<32;i++)assert.equal(f[i],nativeFrame.getBigUint64(i*8,true),'actual native word '+i);
     records.push(w);return 1;}};
   const host=new(require('../lib/guest-thread-host').GuestThreadHost)({memory,module,hostImports:table,
    sigs:require('../lib/host-import-sigs.generated.json').sigs,workerUrl:path.resolve('lib/guest-worker.js'),clockIntervalMs:0});
   await host.start();
   const serve=host.broker.serveRpc.bind(host.broker);
   host.broker.serveRpc=(slot,wait,w,endpoint)=>{
    if(w){attempts++;first??=w;
     if(mode==='missing')w=undefined;
     else if(mode==='missing-scene')RPC.views(memory,slot).i32[RPC.SLOT.ARGC]=6;
     else if(['slot','endpointIdentity','token','thread','ptr','kind','remove'].includes(mode)){
      const k=mode==='thread'?'threadId':mode;w={...w,[k]:w[k]+1};
     }else if(['stage','tag','number','overflow','process'].includes(mode)){
      w={...w,words:w.words.slice()};const i=mode==='tag'?27:mode==='process'?4:0;
      w.words[i]=mode==='number'?1:mode==='overflow'?1n<<64n:w.words[i]+1n;
     }else if(mode==='truncated')w={...w,words:w.words.slice(0,31)};
     else if(mode==='replay'&&attempts===2)w={...w,sequence:first.sequence};
     else if(mode==='return-token'&&attempts===2)w={...w,words:w.words.map((v,i)=>i===1?v+1n:v)};
    }
    const before=records.length,r=serve(slot,wait,w,endpoint);if(attempts&&before===records.length)rejected=true;return r;
   };
   try{
    const bytes=fs.readFileSync(require('../tools/ut-goty-listbox-wizard.cjs').prepare(path.join(root,mode),{transition:true,destroyTarget:false}));
    await host.loadPe(bytes,'dialog-witness.exe');const call=(n,...a)=>host.callExport(n,...a);
    await call('set_process_id',1000);await call('set_current_thread_id',1);await call('set_esp',0x7408000);await call('guest_write32',0x7408000,0);
    const until=async pred=>{for(let i=0;i<800;i++){if(await pred())return;if([1,6,7,15].includes(await call('get_yield_reason')))await call('clear_yield');const r=await host.link.slice(128);assert(!r.trapped,JSON.stringify(r));}throw Error('deadline '+mode);};
    await until(async()=>!!await call('dialogbox_hwnd')&&[7,15].includes(await call('get_yield_reason')));
    const dialog=await call('dialogbox_hwnd');let slot=-1;
    while((slot=await call('wnd_next_child_slot',dialog,slot+1))>=0){const hw=await call('wnd_slot_hwnd',slot);if(await call('ctrl_get_class',hw)===1&&await call('wnd_get_proc_export',hw)<0xffff0000){target=hw;break;}}
    assert(target);pending=true;host.broker.publish({inputPending:1});
    const complete=['valid','replay','return-token'].includes(mode);
    await until(()=>attempts===(complete?2:1));
    if(mode==='valid'){
     assert.deepEqual(records.map(w=>w.kind),[6,7]);assert.equal(records[0].words[0],1n);assert.equal(records[1].words[0],2n);
     for(const i of [1,2,3,4,5,6,9,10,11,12,13,14,23,24,25,29])assert.equal(records[0].words[i],records[1].words[i],'retained field '+i);
     assert.equal(records[1].words[31],records[0].words[29]);
     assert.equal(h.exports.native_dialog_input_fence_word(0),0n,'disposed native witness cannot be sampled later');
    }else{assert(rejected,mode);assert.equal(records.length,complete?1:0,mode);}
    results.push({mode,attempts,acceptedTransportCalls:records.length,inputSHA256:sha(bytes)});
   }finally{await host.stop();}
  }
  console.log('PASS real CPUWorker DialogBox 32xi64 entry/return transport and negatives '+JSON.stringify({moduleSHA256:sha(moduleBytes),results}));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
