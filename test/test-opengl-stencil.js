#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const Stream = require('../lib/gl-command-stream');
const { CALL_INDEX: O } = require('../lib/gl-compat');

(async () => {
  let memory, queued = false;
  const draws = [];
  const h = await bootRenderHarness({ fonts: 'none', extraWat: `
    (func (export "stencil_pixels") (result i32) (global.get $gl_stencil_pixels))
    (func (export "stencil_pitch") (result i32) (global.get $gl_stencil_pitch))
    (func (export "stencil_allocation_failure") (param $tmp i32) (result i32)
      (local $rt i32) (local $pixels i32) (local $result i32)
      (local.set $rt (global.get $gl_sw_rt))
      (local.set $pixels (global.get $gl_stencil_pixels))
      (memory.copy (local.get $tmp) (local.get $rt) (i32.const 32))
      (i32.store offset=12 (local.get $tmp) (i32.const -1))
      (global.set $gl_sw_rt (local.get $tmp))
      (global.set $gl_stencil_pixels (i32.const 0))
      (local.set $result (call $gl_stencil_ensure))
      (global.set $gl_sw_rt (local.get $rt))
      (global.set $gl_stencil_pixels (local.get $pixels))
      (local.get $result))`,
    extraHostOverrides: { gpu_gl_call(op, at, bytes) {
      if (op === 0x20005 && queued) {
        const d = new Uint32Array(memory.buffer, at, 4);
        draws.push([new Uint8Array(memory.buffer,d[0],d[1]).slice(),
          new Uint8Array(memory.buffer,d[2],d[3]).slice()]); return 1;
      }
      if (op !== Stream.WAT_STREAM_FLUSH_OPCODE) return 0;
      return Stream.replay({buffer:memory.buffer,byteOffset:at,bytes}, code =>
        code === O.wglMakeCurrent || code === O.wglDeleteContext ? 1 : 0);
    }}});
  memory = h.memory;
  const e = h.exports, guest = e.guest_alloc(256) >>> 0;
  const wa = p => e.guest_to_wasm(p) >>> 0;
  const stack = wa(guest), dv = new DataView(memory.buffer);
  const call = (name,args=[]) => {
    args.forEach((v,i)=>dv.setUint32(stack+4+i*4,v>>>0,true));
    return e.gl_wat_encoder_call(O[name],stack,0) >>> 0;
  };
  const f = x => {dv.setFloat32(stack+200,x,true);return dv.getUint32(stack+200,true);};
  const query = p => {call('glGetIntegerv',[p,guest+128]);return dv.getUint32(wa(guest+128),true);};
  const enable = (cap,on=true)=>call(on?'glEnable':'glDisable',[cap]);
  const func = (op,ref=0,mask=255)=>call('glStencilFunc',[op,ref,mask]);
  const ops = (fail=0x1e00,zfail=0x1e00,pass=0x1e00)=>call('glStencilOp',[fail,zfail,pass]);
  const clear = v=>{call('glClearStencil',[v]);call('glClear',[0x400]);};
  const point = (z=0,alpha=1)=>{
    call('glColor4f',[f(1),f(0),f(0),f(alpha)]);call('glBegin',[0]);
    // Native point projection rounds x; choose an exact integer center.
    call('glVertex3f',[f(-.75),f(-.6875),f(z)]);call('glEnd');
  };
  const stencil = (x=2,y=2)=>dv.getUint8(e.stencil_pixels()+(15-y)*e.stencil_pitch()+x);
  const color = (x=2,y=2)=>{const rt=e.gl_sw_entry();return dv.getUint32(dv.getUint32(rt+20,true)+(15-y)*dv.getUint16(rt+18,true)+x*4,true);};
  call('wglMakeCurrent',[1,1]);e.gl_sw_set_enabled(1);call('glViewport',[0,0,16,16]);
  assert.strictEqual(query(0xd57),8);assert.strictEqual(query(0xb98),0xffffffff);
  assert.strictEqual(query(0xb92),0x207);assert.strictEqual(query(0xb90),0);
  clear(0xaa);call('glStencilMask',[0x0f]);clear(5);assert.strictEqual(stencil(),0xa5);
  enable(0xc11);call('glScissor',[2,2,1,1]);clear(9);
  assert.strictEqual(stencil(),0xa9);assert.strictEqual(stencil(3,2),0xa5);enable(0xc11,false);
  call('glStencilMask',[255]);clear(0);enable(0xb90);func(0x207,7);ops(0x1e00,0x1e00,0x1e01);
  point();assert.strictEqual(stencil(),7);assert.strictEqual(color(),0xffff0000);
  // Alpha rejection precedes stencil and depth; stencil rejection cannot write depth.
  func(0x207,9);enable(0xbc0);call('glAlphaFunc',[0x204,f(.5)]);point(0,0);assert.strictEqual(stencil(),7);enable(0xbc0,false);
  func(0x200);ops(0x1e02);point();assert.strictEqual(stencil(),8);
  enable(0xb71);call('glDepthFunc',[0x200]);func(0x207);ops(0x1e00,0x1e03);point();assert.strictEqual(stencil(),7);
  enable(0xb71,false);ops(0x1e00,0x1e03,0x150a);point();assert.strictEqual(stencil(),248);
  for(const [i,pass] of [false,true,false,true,false,true,false,true].entries()) {
    clear(5);func(0x200+i,3);ops(0x1e00,0x1e00,0x1e02);point();
    assert.strictEqual(stencil(),pass?6:5,`comparison ${i}: reference compared against stored value`);
  }
  clear(0);enable(0xb71);call('glClear',[0x100]);call('glDepthFunc',[0x201]);
  func(0x200,7);ops(0x1e00,0x1e00,0x1e01);point(-.5);func(0x207,7);point(.5);
  assert.strictEqual(stencil(),7,'stencil rejection cannot write near depth and reject a farther fragment');
  enable(0xb71,false);func(0x207);
  for (const [old,op,want] of [[255,0x1e02,255],[0,0x1e03,0],[7,0,0],[6,0x1e00,6]]) {
    clear(old);ops(0x1e00,0x1e00,op);point();assert.strictEqual(stencil(),want);
  }
  clear(0x91);func(0x202,1,0x0f);ops(0x1e00,0x1e00,0x1e02);point();assert.strictEqual(stencil(),0x92);
  call('glStencilMask',[0x0f]);func(0x207,5);ops(0x1e00,0x1e00,0x1e01);point();assert.strictEqual(stencil(),0x95);
  call('glStencilMask',[255]);clear(0);func(0x207,12);
  call('glBegin',[4]);for(const [x,y] of [[-1,-1],[1,-1],[-1,1]]) call('glVertex3f',[f(x),f(y),f(0)]);call('glEnd');
  assert.strictEqual(stencil(),12,'triangle spans write stencil');
  func(0x207,13);call('glBegin',[1]);for(const x of [-.875,.875])call('glVertex3f',[f(x),f(-.6875),f(0)]);call('glEnd');
  assert.strictEqual(stencil(),13,'line spans write stencil');
  func(0x207,-5);assert.strictEqual(query(0xb97),0);func(0x207,300);assert.strictEqual(query(0xb97),255);
  const oldFunc=query(0xb92);func(0xdead);assert.strictEqual(call('glGetError'),0x500);assert.strictEqual(query(0xb92),oldFunc);
  ops(0x1e00,0xdead,0);assert.strictEqual(call('glGetError'),0x500);
  call('glBegin',[0]);call('glStencilMask',[0]);call('glEnd');assert.strictEqual(call('glGetError'),0x502);assert.strictEqual(query(0xb98),255);
  call('glPushAttrib',[0x400]);call('glStencilMask',[17]);enable(0xb90,false);call('glPopAttrib');
  assert.strictEqual(query(0xb98),255);assert.strictEqual(query(0xb90),1);
  call('glPushAttrib',[0x2000]);call('glStencilMask',[19]);enable(0xb90,false);call('glPopAttrib');
  assert.strictEqual(query(0xb98),19);assert.strictEqual(query(0xb90),1);
  call('glPushAttrib',[0]);enable(0xb90,false);call('glPopAttrib');assert.strictEqual(query(0xb90),0);
  call('wglMakeCurrent',[1,2]);assert.strictEqual(query(0xb98),0xffffffff);call('glStencilMask',[123]);
  call('wglMakeCurrent',[1,1]);assert.strictEqual(query(0xb98),19);
  call('wglDeleteContext',[2]);call('wglMakeCurrent',[1,2]);assert.strictEqual(query(0xb98),0xffffffff);
  call('wglMakeCurrent',[1,1]);call('glStencilMask',[255]);
  assert.throws(()=>call('glReadPixels',[0,0,1,1,0x1901,0x1401,guest+128]),WebAssembly.RuntimeError,
    'unsupported stencil-index readback cannot return fabricated color bytes');
  const list=call('glGenLists',[1]);call('glNewList',[list,0x1300]);call('glStencilMask',[37]);call('glEndList');
  assert.strictEqual(query(0xb98),255);call('glCallList',[list]);assert.strictEqual(query(0xb98),37);
  call('glClear',[0x400000]);assert.strictEqual(call('glGetError'),0x501);
  call('glNewList',[list+1,0x1300]);func(0xdead);assert.strictEqual(call('glGetError'),0x500);call('glEndList');
  assert.strictEqual(e.stencil_allocation_failure(stack+160),0);assert.strictEqual(call('glGetError'),0x505);
  e.gl_sw_set_default_size(8,8);call('glStencilMask',[255]);clear(23);
  assert.strictEqual(e.stencil_pitch(),8);assert(new Uint8Array(memory.buffer,e.stencil_pixels(),64).every(v=>v===23));
  e.gl_sw_set_default_size(16,16);clear(0);assert.strictEqual(e.stencil_pitch(),16);
  call('glStencilMask',[255]);clear(0);enable(0xb90);func(0x207,3);ops(0x1e00,0x1e00,0x1e01);
  call('gpuPresent'); // The next frame retries a worker previously unavailable.
  queued=true;point();func(0x202,3);ops(0x1e00,0x1e00,0x1e02);point();func(0x200,99);
  assert.strictEqual(draws.length,2);
  for (const [snap,rec] of draws) {
    const p=wa(e.guest_alloc(snap.length+rec.length));
    new Uint8Array(memory.buffer,p,snap.length).set(snap);new Uint8Array(memory.buffer,p+snap.length,rec.length).set(rec);
    assert.strictEqual(e.gl_sw_worker_draw(p,p+snap.length),1);
  }
  assert.strictEqual(stencil(),4,'queued worker draws use immutable stencil snapshots');
  e.gl_sw_reset();assert.strictEqual(e.stencil_pixels(),0,'reset releases the owned stencil attachment');
  console.log('PASS native GL stencil state, masks, scissor, operations, alpha/depth ordering, context/list/attrib and worker snapshots');
})().catch(error=>{console.error(error);process.exitCode=1;});
