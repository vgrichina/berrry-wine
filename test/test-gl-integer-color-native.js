#!/usr/bin/env node
'use strict';
// Cheap production-handler fixture: real width loads and normalization,
// fragmented guest pages, exact vector extent and fail-before-state behavior.
const assert = require('assert');
const fs = require('fs');
const {compile} = require('../tools/watx');
const {shapes} = require('./gl-integer-color-cases');
function form(s,name) {
  const start=s.indexOf('(func '+name+' ');assert(start>=0,name);
  let depth=0;
  for(let i=start;i<s.length;i++) {
    if(s[i]===';'&&s[i+1]===';'){i=s.indexOf('\n',i);continue;}
    if(s[i]==='(')depth++;
    if(s[i]===')'&&!--depth)return s.slice(start,i+1);
  }
  throw Error('unterminated '+name);
}
const handler=fs.readFileSync('src/09a8b-handlers-opengl.wat','utf8');
const registers=fs.readFileSync('src/03-registers.wat','utf8');
function boot(mutation='') {
  let body=form(handler,'$gl_color_integer_component')+'\n'+form(handler,'$handle_glColor_integer');
  if(mutation) {
    const before=body;
    if(mutation==='bias')body=body.replace('(f64.const 1))))','(f64.const 0))))');
    if(mutation==='sign')body=body.replace('(i32.shr_s (i32.shl','(i32.shr_u (i32.shl');
    if(mutation==='alpha')body=body.replace('(local.set $a (f32.const 1))','(local.set $a (f32.const 0))');
    if(mutation==='stride')body=body.replace('(i32.const 3)) (local.get $bits)','(i32.const 2)) (local.get $bits)');
    assert.notStrictEqual(body,before,'mutation anchor '+mutation);
  }
  const wat=`(memory 64) (export "memory" (memory 0))
    (global $reg_base i32 (i32.const 256))
    (global $NULL_SENTINEL i32 (i32.const 240))
    (global $fault_sync_epoch (mut i32) (i32.const 0))
    (import "fixture" "translate" (func $g2w (param i32) (result i32)))
    (import "fixture" "allocate" (func $gl_alloc_affine (param i32) (result i32)))
    (import "fixture" "free" (func $heap_free (param i32)))
    (import "fixture" "encode" (func $gl_wat_encode_call (param i32 i32 i32) (result i32)))
    (defmacro (g2w-fast $p) (call $g2w $p))
    ${['$gl8','$gl16','$gl32'].map(n=>form(registers,n)).join('\n')}
    ${body}
    (export "invoke" (func $handle_glColor_integer))`;
  let allocations=0,frees=0,failAlloc=false,missing=-1,captured=null,calls=0;
  const t=p=>(p>>>12)===missing?240:p>=0x50000000?
    0x8000+(((p-0x50000000)>>>12)*0x2000)+(p&4095):p-0x400000+4096;
  let v;
  const e=new WebAssembly.Instance(new WebAssembly.Module(compile(wat,new Map(),{mode:'production'}).wasmBinary),{fixture:{
    translate:t,allocate:n=>{assert.strictEqual(n,20);allocations++;return failAlloc?0:0x420000;},
    free:p=>{assert.strictEqual(p,0x420000);frees++;},
    encode:(op,p,aux)=>{assert.strictEqual(op,25);assert.strictEqual(aux,0);calls++;captured=Array.from({length:4},(_,i)=>v.getFloat32(p+4+4*i,true));return 0;}
  }}).exports;
  v=new DataView(e.memory.buffer);
  return {e,v,t,missing:p=>{missing=p;},fail:()=>{failAlloc=true;},
    state:()=>({allocations,frees,calls,captured})};
}
function acceptance(h) {
  const {e,v,t}=h;
  function invoke(s,p,values) {
    const esp=0x402800;
    for(let i=0;i<8;i++)v.setUint32(256+i*4,0x12340000+i,true);
    v.setUint32(272,esp,true);
    new Uint8Array(e.memory.buffer,t(esp),64).fill(0xaa);
    const stride=s.vector?s.bits/8:4,src=s.vector?p:esp+4;
    const bytes=Buffer.alloc((s.n-1)*stride+s.bits/8,0xcd);
    values.slice(0,s.n).forEach((x,i)=>s.bits===8?bytes.writeUInt8(x&255,i*stride):s.bits===16?bytes.writeUInt16LE(x&65535,i*stride):bytes.writeUInt32LE(x>>>0,i*stride));
    for(let i=0;i<bytes.length;i++)v.setUint8(t(src+i),bytes[i]);
    const stack=Buffer.from(new Uint8Array(e.memory.buffer,t(esp),64));
    e.invoke(s.n,s.bits,+s.signed,+s.vector,src);
    const expected=values.map(x=>Math.fround((s.signed?2*x+1:x)/(2**s.bits-1)));
    if(s.n===3)expected[3]=1;
    assert.deepStrictEqual(h.state().captured,expected,s.name);
    assert.strictEqual(v.getUint32(272,true),esp+(s.vector?8:4*(s.n+1)));
    for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(v.getUint32(256+i*4,true),0x12340000+i);
    assert.deepStrictEqual(Buffer.from(new Uint8Array(e.memory.buffer,t(esp),64)),stack);
  }
  for(const s of shapes) {
    const max=s.signed?2**(s.bits-1)-1:2**s.bits-1,min=s.signed?-(2**(s.bits-1)):0;
    invoke(s,0x50000fff,[min,max,0,s.signed?-1:1]);
    // A Color3 vector ending at the page boundary must not fetch alpha.
    if(s.vector&&s.n===3) {
      h.missing(0x50002);invoke(s,0x50002000-s.n*s.bits/8,[max,0,min,1]);h.missing(-1);
    }
  }
  assert.strictEqual(h.state().allocations,h.state().frees,'synthetic stacks freed');
}
acceptance(boot());
for(const mutation of ['bias','sign','alpha','stride'])assert.throws(()=>acceptance(boot(mutation)),assert.AssertionError,mutation+' rejected');
for(const [p,missing,allocation] of [[0xfffffff8,-1,false],[0x50000fff,0x50001,false],[0x50000fff,-1,true]]) {
  const h=boot();h.v.setUint32(272,0x402800,true);
  h.missing(missing);if(allocation)h.fail();
  assert.throws(()=>h.e.invoke(4,32,1,1,p),WebAssembly.RuntimeError);
  assert.strictEqual(h.state().calls,0,'failure cannot install color');
  assert.strictEqual(h.v.getUint32(272,true),0x402800,'failure preserves ESP');
  if(!allocation)assert.strictEqual(h.state().allocations,0,'invalid pointer allocates nothing');
}
console.log('Integer color native widths, fragmented pages, exact vector bounds, ABI, failures and mutation negatives pass');
