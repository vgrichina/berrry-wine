#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const Stream = require('../lib/gl-command-stream');
const { CALL_INDEX: O } = require('../lib/gl-command-stream');

(async () => {
  let memory, queued = false;
  const draws = [];
  const h = await bootRenderHarness({ fonts: 'none', extraWat: `
    (func (export "mask_stencil") (result i32) (global.get $gl_stencil_pixels))
    (func (export "mask_raster") (result i32) (global.get $rast_color_mask))
    (func (export "mask_format") (param $fmt i32)
      (call $dx_surf_fmt_set (global.get $gl_sw_rt) (local.get $fmt)))`,
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
  memory=h.memory;
  const e=h.exports,guest=e.guest_alloc(256)>>>0,wa=p=>e.guest_to_wasm(p)>>>0;
  const stack=wa(guest),dv=new DataView(memory.buffer);
  const call=(name,args=[])=>{args.forEach((v,i)=>dv.setUint32(stack+4+i*4,v>>>0,true));return e.gl_wat_encoder_call(O[name],stack,0)>>>0;};
  const f=x=>{dv.setFloat32(stack+200,x,true);return dv.getUint32(stack+200,true);};
  const mask=m=>call('glColorMask',[0,1,2,3].map(i=>(m>>i)&1));
  const query=(name='glGetIntegerv')=>{call(name,[0xc23,guest+128]);return [0,1,2,3].map(i=>name==='glGetFloatv'?dv.getFloat32(stack+128+i*4,true):dv.getUint32(stack+128+i*4,true));};
  const clear=(rgba=[.2,.4,.6,.8],bits=0x4000)=>{call('glClearColor',rgba.map(f));call('glClear',[bits]);};
  const point=(z=0,rgba=[1,0,1,1])=>{call('glColor4f',rgba.map(f));call('glBegin',[0]);call('glVertex3f',[f(-.75),f(-.6875),f(z)]);call('glEnd');};
  const addr=(x=2,y=2)=>{const rt=e.gl_sw_entry();return dv.getUint32(rt+20,true)+(15-y)*dv.getUint16(rt+18,true)+x*(dv.getUint16(rt+16,true)/8);};
  const color=(x=2,y=2)=>dv.getUint32(addr(x,y),true);
  const merge=(old,value,m)=>{const raw=[0xff0000,0xff00,0xff,0xff000000].reduce((v,b,i)=>v|((m&(1<<i))?b:0),0);return ((old&~raw)|(value&raw))>>>0;};
  call('wglMakeCurrent',[1,1]);e.gl_sw_set_enabled(1);call('glViewport',[0,0,16,16]);
  assert.deepStrictEqual(query(),[1,1,1,1]);
  mask(15);clear();const base=color();
  for(let m=0;m<16;m++) {
    mask(15);clear();mask(m);clear([1,0,1,1]);
    assert.strictEqual(color(),merge(base,0xffff00ff,m),`clear mask ${m}`);
    mask(15);clear();mask(m);point();
    assert.strictEqual(color(),merge(base,0xffff00ff,m),`point mask ${m}`);
    assert.strictEqual(e.mask_raster()>>>0,0xffffffff,'GL restores shared D3DIM all-write default');
  }
  // GLboolean uses its low byte, including noncanonical true values.
  call('glColorMask',[256,2,255,0]);assert.deepStrictEqual(query(),[0,1,1,0]);assert.deepStrictEqual(query('glGetFloatv'),[0,1,1,0]);
  call('glBegin',[0]);mask(0);call('glEnd');assert.strictEqual(call('glGetError'),0x502);assert.deepStrictEqual(query(),[0,1,1,0]);
  call('glPushAttrib',[0x4000]);mask(1);call('glPopAttrib');assert.deepStrictEqual(query(),[0,1,1,0]);
  call('glPushAttrib',[0x2000]);mask(4);call('glPopAttrib');assert.deepStrictEqual(query(),[0,0,1,0]);
  call('wglMakeCurrent',[1,2]);assert.deepStrictEqual(query(),[1,1,1,1]);mask(2);
  call('wglMakeCurrent',[1,1]);assert.deepStrictEqual(query(),[0,0,1,0]);
  call('wglDeleteContext',[2]);call('wglMakeCurrent',[1,2]);assert.deepStrictEqual(query(),[1,1,1,1]);call('wglMakeCurrent',[1,1]);
  const list=call('glGenLists',[1]);mask(15);call('glNewList',[list,0x1300]);mask(1);call('glEndList');assert.deepStrictEqual(query(),[1,1,1,1]);call('glCallList',[list]);assert.deepStrictEqual(query(),[1,0,0,0]);
  mask(15);clear();mask(2);call('glEnable',[0xc11]);call('glScissor',[2,2,1,1]);clear([1,1,1,1]);call('glDisable',[0xc11]);
  assert.strictEqual(color(),merge(base,0xffffffff,2));assert.strictEqual(color(3,2),base);
  // All-zero color writes must still run depth and stencil updates.
  mask(15);clear();call('glClear',[0x100|0x400]);mask(0);call('glEnable',[0xb71]);call('glDepthFunc',[0x201]);
  call('glEnable',[0xb90]);call('glStencilFunc',[0x207,7,255]);call('glStencilOp',[0x1e00,0x1e02,0x1e01]);point(-.5);
  assert.strictEqual(color(),base);assert.strictEqual(dv.getUint8(e.mask_stencil()+13*16+2),7);
  mask(15);point(.5);assert.strictEqual(color(),base,'near hidden fragment occludes farther visible fragment');assert.strictEqual(dv.getUint8(e.mask_stencil()+13*16+2),8);
  call('glDisable',[0xb71]);call('glDisable',[0xb90]);
  // Masking applies after blending, preserving the exact destination bits.
  mask(15);clear();call('glEnable',[0xbe2]);call('glBlendFunc',[0x302,0x303]);point(0,[1,0,1,.5]);const blended=color();
  mask(15);clear();mask(5);point(0,[1,0,1,.5]);assert.strictEqual(color(),merge(base,blended,5));call('glDisable',[0xbe2]);
  // Lines, triangles and raster bitmap pixels share the final store.
  for(const mode of [1,4]) {
    mask(15);clear();mask(1);call('glColor4f',[f(1),f(0),f(1),f(1)]);call('glBegin',[mode]);
    for(const [x,y] of mode===1?[[-.875,-.6875],[.875,-.6875]]:[[-1,-1],[1,-1],[-1,1]])call('glVertex3f',[f(x),f(y),f(0)]);call('glEnd');
    assert.strictEqual(color(),merge(base,0xffff00ff,1),`primitive ${mode}`);
  }
  mask(15);clear();mask(4);call('glRasterPos2f',[f(-.75),f(-.75)]);dv.setUint8(stack+160,128);
  call('glBitmap',[1,1,f(0),f(0),f(0),f(0),guest+160]);assert.strictEqual(color(),merge(base,0xffff00ff,4));
  // Real native 565 and 555 target storage: channel bits and X padding stay exact.
  const rt=e.gl_sw_entry(),oldBpp=dv.getUint16(rt+16,true);
  for(const [fmt,seed,want] of [[1,0x1357,0xfb57],[2,0x9357,0xff57]]) {
    dv.setUint16(rt+16,16,true);e.mask_format(fmt);mask(1);dv.setUint16(addr(),seed,true);clear([1,0,0,0]);assert.strictEqual(dv.getUint16(addr(),true),want);
    dv.setUint16(addr(),seed,true);point(0,[1,0,0,0]);assert.strictEqual(dv.getUint16(addr(),true),want);
  }
  dv.setUint16(rt+16,oldBpp,true);e.mask_format(5);
  mask(6);e.gl_sw_set_default_size(8,8);assert.deepStrictEqual(query(),[0,1,1,0]);e.gl_sw_set_default_size(16,16);
  mask(15);clear();call('gpuPresent');queued=true;mask(1);point(0,[1,0,0,1]);mask(2);point(0,[0,1,0,1]);mask(0);
  assert.strictEqual(draws.length,2);
  for(const [snap,rec] of draws) {const p=wa(e.guest_alloc(snap.length+rec.length));new Uint8Array(memory.buffer,p,snap.length).set(snap);new Uint8Array(memory.buffer,p+snap.length,rec.length).set(rec);assert.strictEqual(e.gl_sw_worker_draw(p,p+snap.length),1);}
  assert.strictEqual(color(),0x00ffff00,'queued draws retain distinct copied masks after setter changes');
  assert.strictEqual(call('glGetError'),0);
  console.log('PASS native GL all 16 color masks, clears/draws/formats/blend, zero-mask depth/stencil, state and worker snapshots');
})().catch(error=>{console.error(error);process.exitCode=1;});
