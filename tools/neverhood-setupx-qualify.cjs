'use strict';
// Qualify unchanged local media and actual NE attachment. Never launches the
// installer, calls DirectXSetup, seeds installed state, or patches guest bytes.
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),path=require('node:path');
const iso=require('../lib/iso9660'),{inspectNeDll,neBuiltinDependency}=require('../lib/ne-image');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const PINS=Object.freeze({
  windows:['scratch/media/win98se-oem-x05-29232.iso',655591424,'2adfb46df8a9c7bbd2f67bff07461cc2f9d9ec8e01f0e112cb044c9e3e62f607'],
  neverhood:['scratch/media/neverhood-original.iso',651438080,'94de724bb47eb2aa588ac4eff28ddc6fd10edebcf2be4dd131ef76875ef5ffd3'],
  cabinet:['win98\\PRECOPY2.CAB',1335443,'a52d6e1fad1b85aef3e0eba4ed1d35a8b982cc572fdcb358fba09b2ce282af81'],
  dsetup:['setup\\DSETUP6E.DLL',45104,'a3feb8e3a947d8c6b6c594b80b5c0db0c5bd26968f3d749c27781cb60d6c7d7d'],
  setupx:['setupx.dll',745168,'6cd5c194743fdf676112c0808b724a78f8f8650a54059d046a15fe270f5f55f4'],
});
function check(bytes,pin){assert.equal(bytes.length,pin[1]);assert.equal(sha(bytes),pin[2]);return bytes;}
function member(pin,name){
  const fd=fs.openSync(pin[0],'r');
  try {
    const stat=fs.fstatSync(fd),hash=crypto.createHash('sha256'),chunk=Buffer.alloc(1024*1024);
    for(let at=0;at<stat.size;){const n=fs.readSync(fd,chunk,0,Math.min(chunk.length,stat.size-at),at);assert(n>0);hash.update(chunk.subarray(0,n));at+=n;}
    assert.equal(stat.size,pin[1]);assert.equal(hash.digest('hex'),pin[2]);
    const provider={size:stat.size,readRange(offset,length){const b=Buffer.alloc(length);assert.equal(fs.readSync(fd,b,0,length,offset),length);return b;}};
    const image=iso.parseIso(provider),entry=iso.findEntry(image,name);assert(entry,name);
    return Buffer.from(iso.readEntry(image,entry));
  } finally {fs.closeSync(fd);}
}
function describe(bytes){
  const i=inspectNeDll(bytes),n=bytes.readUInt32LE(60);
  return {bytes:bytes.length,sha256:sha(bytes),expectedWinVersion:i.expectedWinVersion,
    flags:bytes.readUInt16LE(n+12),headerInitializer:{segment:bytes.readUInt16LE(n+22),offset:bytes.readUInt16LE(n+20)},
    dllEntryOrdinal:i.dllEntryOrdinal,dependencies:i.dependencies.map(name=>({name,builtin:neBuiltinDependency(name)})),
    imports:[...new Map(i.imports.map(x=>[x.module+'.'+x.symbol,x])).values()],
    names:Object.fromEntries(i.names),entries:Object.fromEntries(i.entries)};
}
async function native(bytes,wasmFile){
  const {createHostImports}=require('../lib/host-imports'),{makeFixture}=require('./kernel32-native-fixture');
  const {createNeLifecycle}=require('../lib/ne-lifecycle');
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),logs=[],words=[],entries=[];
  const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});imports.host.memory=memory;
  imports.host.log=(ptr,len)=>{const s=Buffer.from(memory.buffer,ptr,len).toString();logs.push(s);if(s==='DirectXSetup')throw new Error('ORIGINAL_UNSUPPORTED_BOUNDARY: DirectXSetup');};
  imports.host.log_i32=value=>words.push(value>>>0);
  const wasm=fs.readFileSync(wasmFile),e=(await WebAssembly.instantiate(wasm,imports)).instance.exports;
  const fixture=makeFixture();new Uint8Array(memory.buffer).set(fixture,e.get_staging());
  assert.equal(e.load_pe(fixture.length),0x402000);e.set_eip(0x402100);e.set_esp(0x7408000);
  const context=()=>['eip','esp','ebp','ebx','esi','edi','sreg_cs','sreg_ds','sreg_es','sreg_ss','sync_msg_depth'].map(n=>e['get_'+n]());
  const {neFixedLifecycleImage}=require('../test/helpers/ne-fixed-lifecycle-image');
  const baseline=context(),usage=e.win16_bridge_fixed_usage(1);
  const aliasLife=createNeLifecycle(e,memory,[
    ['ALIAS',neFixedLifecycleImage({name:'KRNL386.EXE'})],
    ['INTERNAL',neFixedLifecycleImage({name:'KERNEL'})],
    ['NEAR',neFixedLifecycleImage({name:'KRNL387.EXE'})],
  ],{maxBlocks:10000});
  const alias=aliasLife.load('ALIAS'),internal=aliasLife.load('INTERNAL');
  const aliasHandle=aliasLife.call(alias,7)&65535,internalHandle=aliasLife.call(internal,7)&65535;
  assert(aliasHandle>=32);assert.equal(aliasHandle,internalHandle,'file and resident names have one fixed identity');
  assert.equal(e.win16_bridge_fixed_usage(1),usage+6,'ordinary explicit loads and dependency references counted');
  for(const id of [alias,internal]){aliasLife.call(id,4);aliasLife.call(id,4);aliasLife.release(id);}
  assert.equal(e.win16_bridge_fixed_usage(1),usage,'balanced ordinary FreeLibrary and unload');
  assert.throws(()=>aliasLife.load('NEAR'),WebAssembly.RuntimeError,'near names stay unsupported');
  assert.equal(e.win16_bridge_fixed_usage(1),usage);assert.deepEqual(context(),baseline);
  const aliasRegression={aliasHandle,internalHandle,usageBefore:usage,usageAfter:e.win16_bridge_fixed_usage(1),nearNameRejected:true,contextRestored:true};
  logs.length=0;words.length=0;
  let fault=null;
  const before=context(),owner={...e,win16_bridge_invoke_begin(...args){entries.push({far:args[1]>>>0,offset:args[1]&65535});return e.win16_bridge_invoke_begin(...args);},
    run(blocks){try{return e.run(blocks);}catch(error){
      const esp=e.get_esp()>>>0,stack=Array.from({length:16},(_,i)=>e.guest_read8(esp+i*2)|(e.guest_read8(esp+i*2+1)<<8));
      const module=e.win16_last_module(),ordinal=e.win16_last_ordinal();
      fault={context:context(),module,ordinal,stack};
      if(module===1&&ordinal===95){
        const address=e.win16_far_to_guest(stack[3],stack[2])>>>0,chars=[];
        for(let i=0;i<260;i++){const c=e.guest_read8(address+i);if(!c)break;chars.push(c);}
        fault.loadLibrary={selector:stack[3],offset:stack[2],address,name:Buffer.from(chars).toString('latin1')};
      }
      throw error;
    }}};
  const life=createNeLifecycle(owner,memory,[['SETUPX',bytes]],{maxBlocks:100000});let id=null,error=null,attached=false,retired=false;
  try {id=life.load('SETUPX');attached=life.liveModule('SETUPX');assert(attached);assert.deepEqual(context(),before);life.release(id);retired=!life.liveModule('SETUPX');assert(retired);assert.deepEqual(context(),before);}
  catch(failure){error={message:failure.message,stack:failure.stack,causes:failure.errors?.map(x=>String(x))};}
  return {wasmFile,wasmSHA256:sha(wasm),aliasRegression,id,attached,retired,error,fault,logs,words,entries,before,after:context(),installerExecuted:false,guestPatched:false};
}
async function main(){
  const out=process.argv[2];assert(out,'usage: node tools/neverhood-setupx-qualify.cjs NEW_OUTPUT_DIR [WASM]');fs.mkdirSync(out,{recursive:false});
  const cab=check(member(PINS.windows,PINS.cabinet[0]),PINS.cabinet),cabFile=path.join(out,'PRECOPY2.CAB');fs.writeFileSync(cabFile,cab,{flag:'wx'});
  let bytes,stderr;
  try {const r=cp.spawnSync('cabextract',['-s','-p','-F','setupx.dll',cabFile],{timeout:30000,maxBuffer:2*1024*1024});stderr=r.stderr?.toString();assert.equal(r.status,0,stderr);bytes=r.stdout;assert(bytes?.length);}
  finally {fs.unlinkSync(cabFile);}
  check(bytes,PINS.setupx);fs.writeFileSync(path.join(out,'setupx.dll'),bytes,{flag:'wx'});
  const original=check(member(PINS.neverhood,PINS.dsetup[0]),PINS.dsetup);
  const setupx=describe(bytes),dsetup=describe(original),target=inspectNeDll(bytes);
  const required=[...new Set(dsetup.imports.filter(x=>x.module==='SETUPX').map(x=>x.symbol))];
  assert(required.every(n=>target.entries.has(n)),'all genuine DSETUP6E SETUPX ordinals exist');
  assert(setupx.dependencies.every(x=>x.builtin==='fixed'),'actual static closure has only fixed system dependencies');
  const result={pins:PINS,cabextractStderr:stderr,setupx,dsetup,requiredSetupxOrdinals:required,native:process.argv[3]?await native(bytes,process.argv[3]):null};
  fs.writeFileSync(path.join(out,'qualification.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({setupxSHA256:setupx.sha256,dependencies:setupx.dependencies,required,native:result.native&&{attached:result.native.attached,retired:result.native.retired,error:result.native.error}},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={PINS,describe,native};
