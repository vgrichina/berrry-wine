#!/usr/bin/env node
'use strict';
// Shipped module, real x86 public COM vtables, normally created resources.
// No compilation, renderer substitutes, browser, or invalid draw inputs.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {createHostImports}=require('../lib/host-imports');
const apis=require('../src/api_table.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Microsoft D3DBLEND defines the four-component factors, including alpha:
// https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dblend
// ADD: C = clamp(Cs*Fs + Cd*Fd). All operands below are integer UNORM8.
// Independent integer numerator /255, nearest-byte rounding. Allow ONE byte
// for native f32 interpolation/quantization; endpoints, masks, background exact.
function blend(s,d,sf,df,separate){
 const factor=k=>({1:0,2:255,5:s[3],6:255-s[3],7:d[3],8:255-d[3]})[k];
 return s.map((c,i)=>Math.min(255,Math.floor(((separate&&i===3?c*255:c*factor(sf)+d[i]*factor(df))+127)/255)));
}
// Reject common visual failures independently of the renderer: opaque alpha,
// swapped source/destination factors, and writing a disabled channel.
const controlSource=[201,73,149,128],controlDest=[37,181,59,128];
assert.notDeepEqual(blend(controlSource,controlDest,5,6,false),[...controlSource.slice(0,3),255]);
assert.notDeepEqual(blend(controlSource,controlDest,2,1,false),blend(controlSource,controlDest,1,2,false));
assert.notEqual(blend(controlSource,controlDest,5,6,false)[0],controlDest[0]);
(async()=>{
 const wasm=fs.readFileSync(process.argv[2]||path.join(__dirname,'../build/wine-assembly.wasm'));
 console.log('module sha256',sha(wasm));
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={getMemory:()=>memory.buffer,renderer:null,resourceJson:{},d3d9Backend:'software',d3d9Programmable:true};
 const imports=createHostImports(ctx);
 Object.assign(imports.host,{memory,create_thread:()=>0,exit_thread:()=>0,terminate_thread:()=>0,
  create_event:()=>0,set_event:()=>0,reset_event:()=>0,wait_single:()=>0,wait_multiple:()=>0,com_create_instance:()=>0x80004002});
 const {instance:{exports:e}}=await WebAssembly.instantiate(wasm,imports);ctx.exports=e;
 const pe=fs.readFileSync(path.join(__dirname,'binaries/calc.exe'));
 new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));e.init_dx_com_thunks();
 const read=p=>e.guest_read32(p)>>>0,write=(p,n)=>e.guest_write32(p,n>>>0);
 const alloc=n=>{const p=e.guest_alloc(n)>>>0;assert(p);return p;};
 const stack=alloc(8192)+4096,out=alloc(64),lr=alloc(16),result=alloc(8);
 let calls=0;
 function invoke(args,obj,slot,target){
  const code=[],word=n=>code.push(n&255,n>>>8&255,n>>>16&255,n>>>24&255);
  for(const a of args.slice().reverse()){code.push(0x68);word(a);}
  if(obj){
   const thunk=read(read(obj)+slot*4);assert(thunk,'published method');
   assert.equal(read(thunk),0xcaca0010,'real COM thunk');
   code.push(0xb8);word(obj);code.push(0x8b,0x00,0xff,0x90);word(slot*4);
  }else{code.push(0xb8);word(target);code.push(0xff,0xd0);}
  code.push(0xa3);word(result);code.push(0x89,0x25);word(result+4);code.push(0xc3);
  const pc=alloc(code.length);code.forEach((v,i)=>e.guest_write8(pc+i,v));
  e.set_esp(stack);e.call_func(pc,0,0,0,0);
  for(let n=0;n<100&&e.get_eip();n++)e.run(10000);
  assert.equal(e.get_eip(),0,'bounded guest return');assert.equal(read(result+4),stack-20,'stdcall cleanup');
  assert.equal(e.get_esp()>>>0,stack-16);calls++;return read(result);
 }
 const com=(obj,slot,...args)=>invoke([obj,...args],obj,slot);
 const ok=(obj,slot,...args)=>assert.equal(com(obj,slot,...args),0,`COM slot ${slot}`);
 const thunk=e.get_thunk_base()>>>0;
 const api=(name,args)=>{const saved=read(thunk+4);
  try{write(thunk+4,apis.find(a=>a.name===name).id);return invoke(args,0,0,thunk);}
  finally{write(thunk+4,saved);}
 };
 const string=s=>{const p=alloc(s.length+1);Buffer.from(s+'\0').forEach((v,i)=>e.guest_write8(p+i,v));return p;};
 const hwnd=api('CreateWindowExA',[0,string('STATIC'),string('D3D9 alpha fixture'),0x10000000,0,0,32,32,0,0,0,0]);assert(hwnd);
 const parent=api('Direct3DCreate9',[32]);assert(parent);
 const pp=alloc(64);for(let i=0;i<16;i++)write(pp+i*4,0);
 // Windowed X8 backbuffer, no depth. A lockable A8 target below retains alpha.
 [8,8,22,1,0,0,1,hwnd,1,0,0,0,0,0x80000000].forEach((n,i)=>write(pp+i*4,n));
 ok(parent,16,0,1,hwnd,0x20,pp,out);const device=read(out);assert(device);
 ok(device,18,0,0,0,out);const backbuffer=read(out);assert(backbuffer);
 ok(device,28,8,8,21,0,0,1,out,0);const target=read(out);assert(target);
 ok(device,37,0,target);ok(device,39,0);
 ok(device,89,0x44); // XYZRHW + D3DCOLOR, all vertices valid and in the target.
 for(const [k,v]of[[7,0],[14,0],[15,0],[22,1],[28,0],[29,0],[137,0],[27,1],[171,1],[207,2],[208,1],[209,1]])ok(device,57,k,v);
 // SELECTARG1(DIFFUSE) for color and alpha; stage1 disabled.
 for(const [k,v]of[[1,2],[2,0],[4,2],[5,0]])ok(device,67,0,k,v);
 ok(device,67,1,1,1);
 const vertices=alloc(60),bits=n=>new Uint32Array(new Float32Array([n]).buffer)[0];
 [[0,0],[6,0],[0,6]].forEach(([x,y],i)=>[x,y,.5,1].forEach((n,j)=>write(vertices+i*20+j*4,bits(n))));
 const argb=c=>(c[3]<<24|c[0]<<16|c[1]<<8|c[2])>>>0;
 const failures=[],rows=[];let cases=0,maxError=0;
 for(const [sf,df]of[[5,6],[2,1],[7,8],[1,2]])for(const a of[0,128,255])for(const da of[0,128,255])
 for(const separate of[false,true])for(let mask=0;mask<16;mask++){
  const s=[201,73,149,a],d=[37,181,59,da],want=blend(s,d,sf,df,separate);
  for(let i=0;i<3;i++)write(vertices+i*20+16,argb(s));
  for(const [k,v]of[[19,sf],[20,df],[206,+separate],[168,mask]])ok(device,57,k,v);
  ok(device,43,0,0,1,argb(d),bits(1),0);
  ok(device,41);ok(device,83,4,1,vertices,20);ok(device,42);
  ok(target,13,lr,0,16);const pitch=read(lr),pixels=read(lr+4);let mismatch=0,first=null;
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   // Integer sample centers; top/left included, diagonal excluded.
   const covered=x+y<6,word=read(pixels+y*pitch+x*4),got=[word>>>16&255,word>>>8&255,word&255,word>>>24];
   for(let c=0;c<4;c++){
    const enabled=covered&&(mask&(1<<c)),expected=enabled?want[c]:d[c];
    const tolerance=enabled&&sf!==2&&sf!==1&&a===128?1:0;
    const error=Math.abs(got[c]-expected);maxError=Math.max(maxError,error);
    if(error>tolerance){mismatch++;first??={x,y,c,got:got[c],expected,tolerance};}
   }
  }
  ok(target,14);cases++;const row={sf,df,a,da,separate,mask,want,mismatch,first};rows.push(row);
  if(mismatch){failures.push(row);if(failures.length<4)console.log('MISMATCH',JSON.stringify(row));}
 }
 ok(device,37,0,backbuffer);com(target,2);com(backbuffer,2);com(device,2);com(parent,2);
 assert.equal(api('DestroyWindow',[hwnd]),1);
 const report={moduleSHA256:sha(wasm),node:process.version,cases,calls,maxError,failures,rows,
  scope:'Native public COM software rendering only; original games, WebGL and 27-app goal remain unproved.'};
 if(process.env.D3D9_ALPHA_EVIDENCE)fs.writeFileSync(path.join(process.env.D3D9_ALPHA_EVIDENCE,'pixels.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({cases,calls,maxError,failedCases:failures.length}));
 assert.equal(failures.length,0,'valid alpha blend exact pixel equations');
})().catch(error=>{console.error(error);process.exitCode=1;});
