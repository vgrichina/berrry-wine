'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..'),{modalImage}=require('./helpers/ne-modal-destroy-image');
const {createHostImports}=require(root+'/lib/host-imports');const ctx={createHostImports,console:{log(){},error(){}}};
vm.runInNewContext(fs.readFileSync(root+'/host.js','utf8')+'\n;globalThis.Host=WineAssembly;',ctx);

async function run(module,detach){
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),wine=new ctx.Host();wine.memory=memory;wine.logToUI=()=>{};
 const imports=wine.getImports({detached:true,threadId:1});imports.host.memory=memory;
 const instance=await WebAssembly.instantiate(module,imports);wine.instance=instance;
 const e=instance.exports,{b}=modalImage(detach);new Uint8Array(memory.buffer).set(b,e.get_staging());assert(e.load_ne(b.length)>0);
 const data=e.win16_seg_base_of(3);const get=o=>e.guest_read8(data+o)|(e.guest_read8(data+o+1)<<8);
 let rounds=0;while(rounds++<50){e.run(200);if(get(0x7e)===0x600d)break;}
 const words=Array.from({length:64},(_,i)=>get(2*i));

 assert.equal(get(0x7e),0x600d,'generated modal program completes');assert.equal(get(2),42,'EndDialog result');assert(get(8)&&get(10),'real dialog and child handles');assert.equal(get(0x18),4,'real nested child callback');
 assert.equal(get(0x24),get(0x20),'native modal stack restores');assert.equal(get(0x26),get(0x22),'native modal BP restores');assert.equal(get(10),get(0x4a),'freed narrow child handle is reused by a new lifetime');assert.equal(get(0x28),0,'child is retired');assert.equal(get(0x2a),0,'retired child USER53 rejects');
 assert.equal(e.get_ebx()&65535,0x5a5a);assert.equal(e.get_esi()&65535,0x6b6b);assert.equal(e.get_edi()&65535,0x7c7c);
 return {words};
}
(async()=>{
 const file=process.env.WINE_TEST_WASM||root+'/build/wine-assembly.wasm';
 const module=await WebAssembly.compile(fs.readFileSync(file));
 for(const detach of [true,false]) {
   const result=await run(module,detach);
   for(const off of [0x10,0x12,0x14,0x16])assert.equal(result.words[off/2],2,'root and child receive actual destroy notifications on both lifetimes');
   assert.equal(result.words[12/2],detach?0:0xcafe,'only the guest NCDESTROY handler clears its own map');
 }
 console.log('PASS native Win16 modal destruction, reentrant callbacks, handle reuse, stack/result and guest-owned detach');
})().catch(error=>{console.error(error);process.exitCode=1;});
