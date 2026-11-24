'use strict';
// Intel SDM vol.1 section 8.1.3 / vol.2 FIST/FISTP: masked invalid
// stores integer indefinite and raises IE, without ES (unmasked summary).
// Literal IEEE-754 inputs and little-endian integer bytes, frozen before baseline.
// Exact valid values avoid this engine's separate precision-flag limitation.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const {compileSrcWasm} = require(path.join(root,'test/compile-src'));
const {createHostImports} = require(path.join(root,'lib/host-imports'));
const extra = `
(func (export "ti_seed") (param $top i32)
 (global.set $fpu_top (local.get $top))
 (global.set $fpu_tag (i32.const 0)) (global.set $fpu_raw_tag (i32.const 0))
 (global.set $fpu_sw (i32.const 0)) (call $fpu_push (f64.const 9.25)))
(func (export "ti_st") (param $i i32) (result f64) (call $fpu_get (local.get $i)))
(func (export "ti_cw") (result i32) (global.get $fpu_cw))
`;
const forms = [
 {name:'FIST16',op:0xdf,modrm:0x15,size:2,pop:false,width:16},
 {name:'FISTP16',op:0xdf,modrm:0x1d,size:2,pop:true,width:16},
 {name:'FIST32',op:0xdb,modrm:0x15,size:4,pop:false,width:32},
 {name:'FISTP32',op:0xdb,modrm:0x1d,size:4,pop:true,width:32},
 {name:'FISTP64',op:0xdf,modrm:0x3d,size:8,pop:true,width:64},
];
const indefinite = {16:'0080',32:'00000080',64:'0000000000000080'};
// [IEEE f64 bits, expected bytes, IE, applicable RC values]
const rows = {
 16:[['40e0000000000000','0080',1], // +32768
     ['c0e0002000000000','0080',1], // -32769
     ['40dfffc000000000','ff7f',0], // +32767
     ['c0e0000000000000','0080',0], // -32768, same bytes but no IE
     ['40dfffc000000001','0080',1,[2]], // next f64 above +32767, ceil overflows
     ['40dfffe000000000','0080',1,[0,2]], // +32767.5 nearest/up
     ['c0e0001000000000','0080',1,[1]]], // -32768.5 down
 32:[['41e0000000000000','00000080',1],
     ['c1e0000000200000','00000080',1],
     ['41dfffffffc00000','ffffff7f',0],
     ['c1e0000000000000','00000080',0],
     ['41dfffffffe00000','00000080',1,[0,2]]], // 2147483647.5
 64:[['43e0000000000000','0000000000000080',1],
     ['c3e0000000000001','0000000000000080',1],
     ['43dfffffffffffff','00fcffffffffff7f',0], // 2^63 - 1024
     ['c3e0000000000000','0000000000000080',0]],
};
async function main() {
 const bytes=compileSrcWasm((file,s)=>file==='13-exports.wat'?s+extra:s);
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={exports:null,getMemory:()=>memory.buffer}; const {host}=createHostImports(ctx);
 Object.assign(host,{memory,log:()=>{},log_i32:()=>{},exit:()=>{},wait_multiple:()=>0,shell_execute:()=>33,
  crash_unimplemented:()=>{throw Error('unexpected unsupported instruction');}});
 const {instance}=await WebAssembly.instantiate(bytes,{host}); const e=ctx.exports=instance.exports;
 const mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
 const exe=fs.readFileSync(path.join(root,'test/binaries/notepad.exe'));
 mem.set(exe,e.get_staging()); assert(e.load_pe(exe.length));
 const base=e.get_image_base()>>>0,g=a=>e.guest_to_wasm(a)>>>0;
 const input=base+0x200000,out=input+32,cwp=input+64,swp=input+80,stack=base+0xd00000;
 const le=a=>[a&255,(a>>>8)&255,(a>>>16)&255,a>>>24];
 let code=base+0x100000,cases=0,failures=0;
 for(const form of forms) {
  const special=['7ff0000000000000','fff0000000000000','7ff8000000000001'].map(bits=>[bits,indefinite[form.width],1]);
  for(const [bits,want,ie,modes] of [...rows[form.width],...special])
  for(const rc of modes||[0,1,2,3]) for(const top of [0,3,7]) {
   const cw=0x037f|(rc<<10); e.ti_seed(top);
   dv.setBigUint64(g(input),BigInt('0x'+bits),true); dv.setUint16(g(cwp),cw,true);
   mem.fill(0xa5,g(out)-8,g(out)+16); dv.setUint16(g(swp),0xdead,true);
   e.set_esp(stack); dv.setUint32(g(stack),0,true);
   const program=[0xd9,0x2d,...le(cwp),0xdd,0x05,...le(input),form.op,form.modrm,...le(out),0xdd,0x3d,...le(swp),0xc3];
   mem.set(program,g(code)); e.set_eip(code); e.run(100000);
   const label=`${form.name} bits=${bits} RC${rc} TOP${top}`;
   const finalTop=(top+(form.pop?7:6))&7;
   assert.strictEqual(e.get_eip(),0,label+' return');
   assert.strictEqual(e.get_esp(),stack+4,label+' ESP');
   assert.strictEqual(e.ti_cw(),cw,label+' CW');
   assert.strictEqual(e.get_fpu_top(),finalTop,label+' TOP');
   assert.strictEqual(e.get_fpu_tags(),form.pop?1<<((top+7)&7):(1<<((top+7)&7))|(1<<finalTop),label+' tags');
   assert.strictEqual(e.ti_st(form.pop?0:1),9.25,label+' preserved ST');
   assert.deepStrictEqual([...mem.slice(g(out)-8,g(out))],Array(8).fill(0xa5),label+' prefix');
   assert.deepStrictEqual([...mem.slice(g(out)+form.size,g(out)+16)],Array(16-form.size).fill(0xa5),label+' suffix');
   const got=Buffer.from(mem.slice(g(out),g(out)+form.size)).toString('hex');
   const sw=dv.getUint16(g(swp),true),expectedSW=(finalTop<<11)|ie;
   if(got!==want||sw!==expectedSW) { failures++; console.error(`FAIL ${label} bytes=${got} want=${want} SW=${sw.toString(16)} want=${expectedSW.toString(16)}`); }
   cases++; code+=32;
  }
 }
 console.log(JSON.stringify({cases,failures})); assert.strictEqual(failures,0,'literal integer conversion bytes/status/stack');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
