'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {compileSrcWasm}=require('./compile-src');
const {createHostImports}=require('../lib/host-imports');
const {controlImage,negativeImage,nestedImage,widthImage,alignmentImage}=require('../tools/gears-sse-arithmetic.cjs');
async function main(){
 const wasm=process.env.WINE_ASSEMBLY_WASM?fs.readFileSync(process.env.WINE_ASSEMBLY_WASM):compileSrcWasm(undefined,{tailCalls:!process.argv.includes('--no-tail-calls')});
 async function run(bytes,{trap=false,exit=0,guard=false}={}){
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),exits=[];
  const ctx={getMemory:()=>memory.buffer,renderer:null,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}},onExit:c=>exits.push(c>>>0)};
  const imports=createHostImports(ctx);imports.host.memory=memory;imports.host.log_i32=()=>{};
  const {instance}=await WebAssembly.instantiate(wasm,imports),x=ctx.exports=instance.exports;
  new Uint8Array(memory.buffer,x.get_staging(),bytes.length).set(bytes);assert.equal(x.load_pe(bytes.length),0x402000);
  const sp=x.guest_alloc(0x10000)+0xfff0;new DataView(memory.buffer).setUint32(x.guest_to_wasm(sp),0,true);x.set_esp(sp);x.set_eip(0x402000);x.clear_yield();
  if(guard)x.set_fault_unmapped(2);
  const execute=()=>{for(let i=0;i<100000&&!exits.length;i++)x.run(1);};
  if(trap){assert.throws(execute,WebAssembly.RuntimeError);assert.deepEqual(exits,[]);return;}
  execute();assert.deepEqual(exits,[exit>>>0]);if(exit===0)assert.equal(x.guest_read32(0x4014d0)>>>0,0x600dcafe);
 }
 const c=controlImage();await run(c.bytes);await run(c.bytes);await run(nestedImage());await run(widthImage(),{guard:true});await run(alignmentImage());
 for(const code of [
  [0xf0,0xf2,0x0f,0x59,0xc1],[0x66,0xf2,0x0f,0x59,0xc1],
  [0x66,0x0f,0xe6,0xc1],[0xf2,0x0f,0xe6,0xc1],[0x0f,0xe6,0xc1],
  [0xf2,0x0f,0x5a,0xc1],[0x66,0xf3,0x0f,0xe6,0xc1],
  [0x0f,0xae,0x15,0,0,0x43,0],[0x0f,0xae,0x1d,0,0,0x43,0],
 ])await run(negativeImage(code),{trap:true});
 await run(negativeImage([0x66,0x0f,0x5a,5,1,0,0x43,0]),{exit:0xc000de05});
 console.log(`PASS ${c.cases} real instruction groups twice: scalar double arithmetic, conversions, nearest-even, signed zero, infinities, NaN payload/priority, subnormals, aliases/registers/memory/SIB, upper lanes, GPRs/flags/ESP, alignment and unsupported modes`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
