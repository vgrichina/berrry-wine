#!/usr/bin/env node
'use strict';
// Full production dispatch -> checked guest doubles -> canonical matrix/list
// encoder -> native matrix observer and captured replay payload.
const assert = require('assert');
const {bootRenderHarness} = require('./render-helper');
const {CALL_INDEX: GL} = require('../lib/gl-command-stream');
const {multiply} = require('./helpers/gl-matrix-reference');
const api = require('../src/api_table.json');
const id = api.findIndex(a=>a.name==='glMultMatrixd');
function checkSparseAndFailureBoundary() {
  const fs=require('fs'),{compile}=require('../tools/watx');
  // Production globals the extracted bodies read (gl32's SEH redirect check, ...).
  const {supply}=require('./helpers/wat-closure-fixture');
  const source=fs.readFileSync('src/09a8b-handlers-opengl.wat','utf8')+'\n'+
    fs.readFileSync('src/09a8c-gl-encoder.wat','utf8')+'\n'+fs.readFileSync('src/03-registers.wat','utf8');
  function extract(name){
    const start=source.indexOf('(func $'+name+' ');assert(start>=0,name);
    let depth=0;
    for(let i=start;i<source.length;i++){
      if(source[i]===';'&&source[i+1]===';'){i=source.indexOf('\n',i);continue;}
      if(source[i]==='(')depth++;
      if(source[i]===')'&&--depth===0)return source.slice(start,i+1);
    }
    throw Error(name);
  }
  const handler=extract('handle_glMultMatrixd');
  function boot(mutation='',failAlloc=false,missing=-1){
    let memory,v,captured,freed=0,allocated=0;
    const t=p=>(p>>>12)===missing?240:p>=0x50000000?
      0x8000+(((p-0x50000000)>>>12)*0x2000)+(p&4095):p-0x400000+4096;
    let body=handler;
    if(mutation==='stride')body=body.replace('(i32.shl (local.get $i) (i32.const 3))','(i32.shl (local.get $i) (i32.const 2))');
    if(mutation==='opcode')body=body.replace('(i32.const 109)','(i32.const 34)');
    if(mutation==='cleanup')body=body.replace('(i32.const 8))))','(i32.const 4))))');
    if(mutation)assert.notStrictEqual(body,handler);
    const wat=`(memory 8) (export "memory" (memory 0))
      (import "fixture" "g2w" (func $g2w (param i32) (result i32)))
      (import "fixture" "alloc" (func $heap_alloc (param i32) (result i32)))
      (import "fixture" "free" (func $heap_free (param i32)))
      (import "fixture" "encode" (func $gl_wat_encode_call (param i32 i32 i32) (result i32)))
      ;; $gl32/$gl64 test the Win98 shared-heap range first (2ef390475); no
      ;; fixture address lies there, and the import throws if one ever does.
      (import "fixture" "sharedHeap" (func $host_shared_heap (param i32 i32 i32 i32 i32) (result i32)))
      ${extract('shared_heap_address')}
      (global $reg_base i32 (i32.const 256)) (global $image_base i32 (i32.const 4194304))
      (global $GUEST_BASE i32 (i32.const 4096)) (global $NULL_SENTINEL i32 (i32.const 240))
      (global $fault_sync_epoch (mut i32) (i32.const 0))
      (defmacro (g2w-fast $ga) (call $g2w $ga))
      ;;@supply
      ${extract('gl_alloc_affine')} ${extract('gl32')} ${extract('gl64')} ${body}
      (func (export "invoke") (param $p i32)
        (call $handle_glMultMatrixd (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))`;
    const binary=compile(wat.replace(';;@supply',supply(wat)).replaceAll('(region.end $DIRECT_WINDOW)','(i32.const 65536)'),new Map(),{mode:'production'}).wasmBinary;
    const e=new WebAssembly.Instance(new WebAssembly.Module(binary),{fixture:{g2w:t,
      sharedHeap:(op,ga)=>{throw Error(`fixture reached the shared heap: op ${op} ga 0x${(ga>>>0).toString(16)}`);},
      alloc:n=>{allocated++;assert.strictEqual(n,72);return failAlloc?0:0x410000;},free:()=>freed++,
      encode:(op,stack,aux)=>{assert.strictEqual(op,109);assert.strictEqual(aux,0);
        captured=Array.from(new Float32Array(memory.buffer,t(v.getUint32(stack+4,true)),16));return 0;}}}).exports;
    memory=e.memory;v=new DataView(memory.buffer);
    return {e,t,v,captured:()=>captured,freed:()=>freed,allocated:()=>allocated};
  }
  const values=[-0,Math.PI,1+2**-24,1e-300,Infinity,-Infinity,NaN,...Array.from({length:9},(_,i)=>i-.25)];
  function accept(h){
    const {v,t,e}=h,p=0x50000ffd,b=Buffer.alloc(128);values.forEach((x,i)=>b.writeDoubleLE(x,i*8));
    [...b].forEach((x,i)=>v.setUint8(t(p+i),x));v.setUint32(272,0x402800,true);
    e.invoke(p);assert.deepStrictEqual(h.captured(),values.map(Math.fround));
    assert.strictEqual(v.getUint32(272,true),0x402808);assert.strictEqual(h.freed(),1);
  }
  accept(boot());
  for(const mutation of ['stride','opcode','cleanup'])assert.throws(()=>accept(boot(mutation)),assert.AssertionError,mutation);
  for(const args of [['',true],['',false,0x50000],['',false,0x50001]]){
    const h=boot(...args);h.v.setUint32(272,0x402800,true);h.v.setUint32(256,0xdeadbeef,true);
    assert.throws(()=>h.e.invoke(0x50000ffd),WebAssembly.RuntimeError);
    assert.strictEqual(h.v.getUint32(272,true),0x402800);assert.strictEqual(h.v.getUint32(256,true),0xdeadbeef);
    assert.strictEqual(h.captured(),undefined);
    if(args[2])assert.strictEqual(h.allocated(),0,'validate both pages before allocation');
  }
}
checkSparseAndFailureBoundary();
(async()=>{
  const {exports:e,memory} = await bootRenderHarness({extraWat:`
    (func (export "matrix_dispatch") (param $p i32)
      (call $dispatch_api_table (i32.const ${id}) (local.get $p)
        (i32.const 11) (i32.const 22) (i32.const 33) (i32.const 44) (i32.const 0)))
    (func (export "matrix_regs") (result i32) (global.get $reg_base))
    (func (export "matrix_context") (global.set $gl_current_context (i32.const 1)))
    (func (export "matrix_available") (result i32) (call $wgl_api_available (i32.const ${id})))`});
  const wa=p=>(p-e.get_image_base()+e.get_guest_base())>>>0;
  const v=new DataView(memory.buffer), regs=e.matrix_regs();
  const p=e.guest_alloc(128), stack=e.guest_alloc(128), scratch=e.guest_alloc(128);
  const top=()=>Array.from(new Float32Array(memory.buffer,e.gl_mtx_top_ptr(),16));
  const put=a=>a.forEach((x,i)=>v.setFloat64(wa(p)+i*8,x,true));
  const call=(name,args=[])=>{
    v.setUint32(wa(scratch),0xcafebabe,true);
    args.forEach((x,i)=>v.setUint32(wa(scratch)+4+i*4,x>>>0,true));
    return e.gl_wat_encoder_call(GL[name],wa(scratch),0);
  };
  const invoke=()=>{
    for(let i=0;i<8;i++)v.setUint32(regs+i*4,0x77770000+i,true);
    v.setUint32(regs+16,stack,true);
    v.setUint32(wa(stack),0xcafebabe,true);v.setUint32(wa(stack)+4,p,true);
    const before=Buffer.from(new Uint8Array(memory.buffer,wa(stack),32));
    e.matrix_dispatch(p);
    assert.strictEqual(v.getUint32(regs+16,true),stack+8,'one pointer + return stdcall');
    assert.strictEqual(v.getUint32(regs,true),0);
    for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(v.getUint32(regs+i*4,true),0x77770000+i);
    assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,wa(stack),32)),before,'guest arguments preserved');
  };
  const f=x=>{const b=Buffer.alloc(4);b.writeFloatLE(x);return b.readUInt32LE();};
  e.matrix_context();assert.strictEqual(e.matrix_available(),1);
  // Noncommuting scale/translation, all sixteen ordered values, f32 rounding,
  // and every supported selected matrix stack.
  const base=[2,0,0,0,0,3,0,0,0,0,4,0,5,6,7,1];
  const m=[1,2,3,.25,4,5,6,.5,7,8,9,.75,Math.PI,-3.25,11,1];
  for(const mode of [0x1700,0x1701,0x1702]){
    call('glMatrixMode',[mode]);call('glLoadIdentity');
    call('glScalef',[2,3,4].map(f));
    call('glTranslatef',[2.5,2,1.75].map(f));
    assert.deepStrictEqual(top(),base);
    put(m);invoke();
    assert.deepStrictEqual(top(),Array.from(multiply(base,m.map(Math.fround))).map(Math.fround),'postmultiply in column-major order');
    // WAT owns WGL (9192def5a): the call executes in WAT and no stream record
    // reaches a host, so the by-value claim is read back from the matrix stack.
    // Rewriting the guest doubles after the call cannot change what was applied.
    const applied=top();
    put(Array(16).fill(99));
    assert.deepStrictEqual(top(),applied,'pointed payload consumed by value');
  }
  // List definition captures values. Compile defers; compile-and-execute
  // applies immediately. Source changes and temporary frees cannot alter replay.
  call('glMatrixMode',[0x1700]);
  for(const mode of [0x1300,0x1301]){
    call('glLoadIdentity');const identity=top();const list=call('glGenLists',[1]);assert(list>0);
    call('glNewList',[list,mode]);put(m);invoke();call('glEndList');
    assert.deepStrictEqual(top(),mode===0x1300?identity:m.map(Math.fround));
    put(Array(16).fill(99));call('glLoadIdentity');call('glCallList',[list]);
    assert.deepStrictEqual(top(),m.map(Math.fround),'list retains converted values');
    // Replay inside Begin rejects before modifying native matrix state.
    call('glLoadIdentity');call('glBegin',[0]);call('glCallList',[list]);call('glEnd');
    assert.deepStrictEqual(top(),identity);assert.strictEqual(call('glGetError'),0x502);
  }
  call('glLoadIdentity');const unchanged=top();
  call('glBegin',[0]);put(m);invoke();call('glEnd');
  assert.deepStrictEqual(top(),unchanged);assert.strictEqual(call('glGetError'),0x502);
  const list=call('glGenLists',[1]);call('glNewList',[list,0x1300]);call('glBegin',[0]);invoke();call('glEnd');call('glEndList');
  assert.strictEqual(call('glGetError'),0x502);call('glCallList',[list]);assert.deepStrictEqual(top(),unchanged);
  // Bad pointers fail before changing matrix or consuming the guest stack.
  for(const bad of [0xffffff81,0xffffffff]){
    v.setUint32(regs+16,stack,true);assert.throws(()=>e.matrix_dispatch(bad),WebAssembly.RuntimeError);
    assert.strictEqual(v.getUint32(regs+16,true),stack);assert.deepStrictEqual(top(),unchanged);
  }
  console.log('PASS glMultMatrixd real dispatch, matrix modes/postmultiply, ABI, by-value/list capture and Begin errors');
})().catch(e=>{console.error(e);process.exitCode=1;});
