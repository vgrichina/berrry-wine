'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto');
const {bootRenderHarness}=require('./render-helper');
const {GuestThreadHost}=require('../lib/guest-thread-host');
const {createGuestMainOwner}=require('../lib/guest-main-owner');
const {configureExeOwned,stageAndLoadPeOwned}=require('../lib/process-boot');
const {BASE}=require('../lib/region-map.generated');
const sigs=require('../lib/host-import-sigs.generated.json').sigs;
const root=path.resolve(__dirname,'..');

(async()=>{
 const bytes=fs.readFileSync(path.join(__dirname,'binaries/calc.exe'));
 const optional=bytes.readUInt32LE(0x3c)+24;
 const imageBase=bytes.readUInt32LE(optional+28),entry=imageBase+bytes.readUInt32LE(optional+16);
 const rows=[];
 for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
  const wasm=fs.readFileSync(path.join(root,'build',name)),module=await WebAssembly.compile(wasm);
  for(const remote of [false,true]){
   const h=await bootRenderHarness({fonts:'none',prebuiltModule:module});
   let worker;
   try{
    if(remote){
     h.exports.set_host_shadow(1);
     worker=new GuestThreadHost({module,memory:h.memory,hostImports:h.host,sigs,
      workerUrl:path.join(root,'lib/guest-worker.js'),clockIntervalMs:0});
     await worker.start();
    }
    const owner=createGuestMainOwner(remote?{worker}:{localExports:h.exports});
    await owner.call('set_startup_show',0);
    const identity={name:'games\\owner-calc.exe',drive:0x44,args:'-test "owned boot"'};
    let actual;
    if(remote)actual=await worker.loadPe(bytes,identity.name,42,{exeDrive:identity.drive,extraArgs:identity.args});
    else{
     await configureExeOwned(owner,h.memory.buffer,identity);
     actual=(await stageAndLoadPeOwned(owner,h.memory.buffer,bytes,()=>{})).entry;
    }
    assert.equal(actual,entry);
    const state=await owner.read(['get_image_base','get_eip']);
    assert.equal(state.get_image_base,imageBase);
    assert.equal(state.get_eip,entry);
    if(remote)assert.equal(h.exports.get_image_base(),0,'host shadow did not load PE or acquire guest registers');
    const view=new DataView(h.memory.buffer),p=BASE.PROCESS_IMAGE_STATE;
    assert.equal(view.getUint32(BASE.STARTUP_SHOW_STATE,true),1,'explicit startup show retained');
    assert.equal(view.getUint32(BASE.STARTUP_SHOW_STATE+4,true),0,'SW_HIDE is not treated as absent');
    assert.equal(view.getUint32(p+12,true),identity.drive);
    assert.equal(Buffer.from(h.memory.buffer,view.getUint32(p+4,true),view.getUint32(p+8,true)).toString(),identity.name);
    assert.equal(Buffer.from(h.memory.buffer,BASE.EXTRA_CMDLINE_BUFFER,identity.args.length).toString(),identity.args);
    rows.push({module:name,sha256:crypto.createHash('sha256').update(wasm).digest('hex'),owner:owner.kind,entry:actual,...state});
   }finally{await worker?.stop();}
  }
 }
 let called=false;
 await assert.rejects(stageAndLoadPeOwned({read:async()=>({}),call:()=>{called=true;}},new ArrayBuffer(32),bytes),/placement export/);
 assert.equal(called,false,'invalid owner placement never invokes load_pe');
 const memory=new ArrayBuffer(32);new Uint8Array(memory).fill(0xa5);
 await assert.rejects(configureExeOwned({read:async()=>({get_staging:30,get_staging_size:4}),call:()=>{called=true;}},memory,{name:'x'}),/staging range/);
 assert(new Uint8Array(memory).every(n=>n===0xa5),'invalid metadata placement never writes shared memory');
 console.log(JSON.stringify({status:'pass',rows},null,2));
 if(process.env.CLI_OWNER_BOOT_EVIDENCE){
  fs.mkdirSync(process.env.CLI_OWNER_BOOT_EVIDENCE,{recursive:true});
  fs.writeFileSync(path.join(process.env.CLI_OWNER_BOOT_EVIDENCE,'test-result.json'),JSON.stringify({status:'pass',rows},null,2)+'\n');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
