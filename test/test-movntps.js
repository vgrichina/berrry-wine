#!/usr/bin/env node
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {compileSrcWasm}=require('./compile-src');
const {createHostImports}=require('../lib/host-imports');
(async()=>{
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={exports:null,getMemory:()=>memory.buffer},logs=[],exits=[];
 const {host}=createHostImports(ctx);
 Object.assign(host,{memory,log(){},log_i32:v=>logs.push(v>>>0),exit:v=>exits.push(v>>>0)});
 const {instance}=await WebAssembly.instantiate(compileSrcWasm(),{host});
 const e=ctx.exports=instance.exports,exe=fs.readFileSync(path.join(__dirname,'binaries/notepad.exe'));
 new Uint8Array(memory.buffer).set(exe,e.get_staging());assert(e.load_pe(exe.length));
 const base=e.get_image_base(),src=base+0x80000,out=src+64,stack=base+0xd00000;
 const le32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 const put=(p,b)=>b.forEach((v,i)=>e.guest_write8(p+i,v));
 const read=p=>Array.from({length:16},(_,i)=>new Uint8Array(memory.buffer)[e.guest_to_wasm(p+i)]);
 let next=base+0x1000;
 function run(code){const pc=next;next+=256;put(pc,code);e.guest_write32(stack,0);e.set_esp(stack);e.set_eip(pc);e.run(10000);return pc;}
 const payload=[0x7fa12345,0x80000000,0xdeadbeef,0x01234567].flatMap(le32);
 put(src,payload);
 const sparse=e.guest_map_alloc(8192)>>>0;assert(sparse);
 for(let reg=0;reg<8;reg++)for(const [dest,shape]of[[out,'abs'],[out,'sib'],[sparse+4080,'abs']]){
   put(dest-1,Array(18).fill(0xa5));
   const load=[0x0f,0x10,0x05+(reg<<3),...le32(src)];
   const store=shape==='abs'?[0x0f,0x2b,0x05+(reg<<3),...le32(dest)]
     :[0xb8,...le32(dest-32),0xb9,...le32(4),0x0f,0x2b,0x44+(reg<<3),0x88,16];
   run([...load,...store,0xc3]);
   assert.strictEqual(e.get_eip(),0);assert.strictEqual(e.get_esp()>>>0,stack+4);
   assert.deepStrictEqual(read(dest),payload,`xmm${reg} ${shape} preserves all128 bits`);
   assert.strictEqual(read(dest-1)[0],0xa5);assert.strictEqual(read(dest+16)[0],0xa5);
 }
 const oldFS=e.get_fs_base();e.set_fs_base(out-0x2000);
 run([0x0f,0x10,0x05,...le32(src),0x64,0x0f,0x2b,0x05,...le32(0x2000),0xc3]);
 assert.deepStrictEqual(read(out),payload,'segment base applies to the destination');e.set_fs_base(oldFS);
 // Store into an already compiled block: gs128 must retire the old code.
 const target=base+0x30000;put(target,[0xb8,...le32(11),0xc3,...Array(10).fill(0x90)]);
 const callTarget=()=>run([0xb8,...le32(target),0xff,0xd0,0xc3]);
 callTarget();assert.strictEqual(e.get_eax(),11);
 put(src,[0xb8,...le32(77),0xc3,...Array(10).fill(0x90)]);
 run([0x0f,0x10,0x05,...le32(src),0x0f,0x2b,0x05,...le32(target),0xc3]);
 callTarget();assert.strictEqual(e.get_eax(),77,'non-temporal store invalidates cached guest code');
 for(const code of [[0x0f,0x2b,0xc1],...[0x66,0xf2,0xf3,0xf0].map(p=>[p,0x0f,0x2b,0x05,...le32(out)])])
   assert.throws(()=>run([...code,0xc3]),WebAssembly.RuntimeError,'unsupported/invalid forms must not execute another instruction');
 // Misalignment raises before any write; instruction address includes the
 // leading NOPs rather than reporting only the containing block's start.
 put(out,Array(32).fill(0x5a));e.set_fs_base(base+0x60000);e.guest_write32(base+0x60000,0xffffffff);
 logs.length=0;const faultPc=run([0x90,0x90,0x0f,0x2b,0x05,...le32(out+1),0xc3]);
 assert.deepStrictEqual(read(out),Array(16).fill(0x5a));assert.deepStrictEqual(read(out+16),Array(16).fill(0x5a));
 const marker=logs.indexOf(0xcae8c000);assert(marker>=0);
 assert.deepStrictEqual(logs.slice(marker+1,marker+3),[0xc0000005,faultPc+2]);
 assert.deepStrictEqual(exits,[(0xde00|0xc0000005)>>>0]);
 e.guest_map_free(sparse);
 console.log('PASS MOVNTPS: eight XMM registers, absolute/SIB/segment/sparse stores, exact bits, SMC and alignment fault');
})().catch(e=>{console.error(e);process.exitCode=1;});
