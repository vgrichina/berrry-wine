'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {decodeOne,setCpuLevel}=require('../tools/toyvm/decode');setCpuLevel(386);
function decode(bytes,ip=0,d32=false){const m=new Map(bytes.map((b,i)=>[ip+i,b]));return decodeOne(a=>m.get(a)||0,0,ip,0,0xffffff,d32,null,true);}
let groups=0;function test(n,f){f();groups++;console.log('PASS '+n);}
test('16-bit relative JMP CALL and Jcc wrap taken targets in protected mode',()=>{
 for(const b of [[0xe9,0xfc,0xff],[0xe8,0xfc,0xff],[0x0f,0x84,0xfb,0xff],[0xeb,0xfd],[0x74,0xfd]])
  assert.equal(decode(b).fixups[0].ip,0xffff,'16-bit near target truncates independent of fetch width');
 for(const b of [[0xe9,0,0],[0xe8,0,0],[0x0f,0x84,0,0],[0xeb,0],[0x74,0]])
  assert.equal(decode(b,0xffff).fixups[0].ip,(0xffff+b.length)&0xffff);
});
test('66 override chooses branch operand width in both D-bit defaults',()=>{
 for(const b of [[0xe9,0,0,0,0],[0xe8,0,0,0,0],[0x0f,0x84,0,0,0,0],[0xeb,0],[0x74,0]])
  assert.equal(decode([0x66,...b],0x20000).fixups[0].ip,0x20001+b.length);
 for(const b of [[0xe9,0,0],[0xe8,0,0],[0x0f,0x84,0,0],[0xeb,0],[0x74,0]])
  assert.equal(decode([0x66,...b],0x20000,true).fixups[0].ip,1+b.length);
});
test('D0 high-EIP fetch and not-taken fallthrough stay wide',()=>{
 const j=decode([0x74,0],0x20000);assert.equal(j.fixups[0].ip,2);assert.equal(j.fixups[1].ip,0x20002);
 const d=decode([0x66,0xb8,0x78,0x56,0x34,0x12],0x23e60);assert(d);assert.equal(d.length,6);
});
test('16-bit CALL shadow return offset matches the pushed word',()=>{
 const d=decode([0xe8,0,0],0xffff);assert.equal(d.fixups[1].ip,2);
});
console.log(JSON.stringify({groups,status:'PASS'}));
if(process.argv.includes('--native')){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'toyvm-near-')),b=[],fix=[];
 const emit=(...x)=>b.push(...x),word=x=>[x&255,x>>>8&255];
 const chunks=[
  {seg:0x8000,off:0,data:Buffer.from([0,0,0,0,0,0,0,0, 0xff,0xff,0,0,9,0x9b,0,0, 0xff,0xff,0,0,0,0x93,0x0f,0])},
  {seg:0x9000,off:0x10,data:Buffer.from([0xe9,0x6d,0xff])},
  {seg:0x9000,off:0xff80,data:Buffer.from([0xbb,0x34,0x12,0xe9,0x9a,0])},
  {seg:0x9000,off:0xff00,data:Buffer.from([0x43,0xc3])},
  {seg:0x9000,off:0x20,data:Buffer.from([0xe8,0xdd,0xfe,0x81,0xfb,0x35,0x12,0x75,0x0b,0xb8,0x10,0,0x8e,0xd8,0xc7,6,0,5,0xef,0xbe,0xf4,0xeb,0xfd])}
 ];
 emit(0xfa,0xfc);
 for(const c of chunks){emit(0xb8,...word(c.seg),0x8e,0xc0,0xbf,...word(c.off),0xbe);fix.push({at:b.length,c});emit(0,0,0xb9,...word(c.data.length),0xf3,0xa4);}
 emit(0x0f,1,0x16);const gd=b.length;emit(0,0,0x0f,0x20,0xc0,0x0c,1,0x0f,0x22,0xc0,0xea,0x10,0,8,0);
 const gdaddr=b.length+0x100;b[gd]=gdaddr&255;b[gd+1]=gdaddr>>>8;emit(23,0,0,0,8,0);
 for(const f of fix){const a=b.length+0x100;b[f.at]=a&255;b[f.at+1]=a>>>8;emit(...f.c.data);}
 const exe=path.join(dir,'NEAR.COM');fs.writeFileSync(exe,Buffer.from(b));
 (async()=>{try{const {runDos}=require('../tools/toyvm/run-dos');
 for(const variant of ['tailcall','switch','calls','repl_tailcall']){const r=await runDos({exe,variant,budget:10000,seconds:3});
 assert.equal(r.vm.mem[0x500]|r.vm.mem[0x501]<<8,0xbeef,variant+' protected16 relative underflow/overflow and CALL');
 assert.equal(r.vm.get('bx')&0xffff,0x1235);console.log('PASS native protected16 near target wrapping '+variant);}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
}
