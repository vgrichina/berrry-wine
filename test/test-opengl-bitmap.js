#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX: O } = require('../lib/gl-compat');

(async () => {
  const { exports: e, memory } = await bootRenderHarness({fonts:'none', extraHostOverrides:{gpu_gl_call:()=>1}});
  const dv = new DataView(memory.buffer);
  const toWasm = p => (p - e.get_image_base() + e.get_guest_base()) >>> 0;
  const stack = toWasm(e.guest_alloc(256));
  const source = e.guest_alloc(256) >>> 0, src = toWasm(source);
  const output = e.guest_alloc(32) >>> 0, out = toWasm(output);
  function call(name, args=[], floats=[]) {
    assert.notStrictEqual(O[name], undefined, name);
    args.forEach((v,i) => floats.includes(i) ? dv.setFloat32(stack+4+i*4,v,true) : dv.setUint32(stack+4+i*4,v>>>0,true));
    return e.gl_wat_encoder_call(O[name],stack,0) >>> 0;
  }
  const bitmap = (w,h,xo=0,yo=0,xm=0,ym=0,p=source) => call('glBitmap',[w,h,xo,yo,xm,ym,p],[2,3,4,5]);
  const raster = (x,y) => call('glRasterPos2f',[x/16-1,y/16-1],[0,1]);
  const color = (r,g,b,a=1) => call('glColor4f',[r,g,b,a],[0,1,2,3]);
  const query = (pname, integer=false) => {
    call(integer ? 'glGetIntegerv':'glGetFloatv',[pname,output]);
    return Array.from(integer ? new Uint32Array(memory.buffer,out,4) : new Float32Array(memory.buffer,out,4));
  };
  const pos = () => query(0xB07);
  call('wglMakeCurrent',[7,1]);
  e.gl_sw_set_enabled(1);
  call('glViewport',[0,0,32,32]);
  call('glMatrixMode',[0x1700]); call('glLoadIdentity');
  call('glMatrixMode',[0x1701]); call('glLoadIdentity');
  call('glPixelStorei',[0xCF5,1]);
  color(1,0,0); raster(4,5);
  dv.setUint8(src,0xA0); dv.setUint8(src+1,0x40);
  const glyph = call('glGenLists',[2]);
  call('glNewList',[glyph,0x1300]); bitmap(3,2,0,0,4,1); call('glEndList');
  assert.deepStrictEqual(pos().slice(0,2),[4,5], 'compile must not advance raster position');
  assert.strictEqual(e.gl_sw_entry(),0,'compile must not allocate/draw a surface');
  dv.setUint8(src,0); dv.setUint8(src+1,0); // source lifetime ends after compilation
  color(0,1,0); // raster colour was already captured as red
  call('glCallList',[glyph]);
  assert.deepStrictEqual(pos().slice(0,2),[8,6]);
  const entry=e.gl_sw_entry()>>>0;
  assert(entry,'bitmap replay creates a surface');
  const height=dv.getUint16(entry+14,true), pitch=dv.getUint16(entry+18,true), pixels=dv.getUint32(entry+20,true);
  const pixel=(x,y)=>dv.getUint32(pixels+(height-1-y)*pitch+x*4,true)>>>0;
  const clear=()=>new Uint8Array(memory.buffer,pixels,pitch*height).fill(0);
  assert.notStrictEqual(pixel(4,5),0,'owned first source bit produces a fragment');
  const red=pixel(4,5);
  assert.strictEqual(pixel(6,5),red); assert.strictEqual(pixel(5,6),red);
  assert.strictEqual(pixel(5,5),0,'zero bitmap bits leave destination untouched');
  assert.strictEqual(pixel(4,6),0,'row origin is bottom-left');
  assert.deepStrictEqual(query(0xB04),[1,0,0,1],'raster colour survives current colour changes');
  assert.deepStrictEqual(query(0xB04,true),[0x7fffffff,0,0,0x7fffffff],'integer colour query uses normalized conversion');

  clear(); raster(10,10); bitmap(0,0,0,0,2.5,-1.25,0);
  assert.deepStrictEqual(pos().slice(0,2),[12.5,8.75],'NULL bitmap still moves raster position');
  raster(40,10); assert.strictEqual(query(0xB08,true)[0],0);
  bitmap(3,2,0,0,100,100); assert.strictEqual(pixel(4,5),0,'clipped raster position produces no fragments');
  assert.deepStrictEqual(pos().slice(0,2),[12.5,8.75],'invalid raster position is not advanced');

  // Normalization honours LSB-first, row stride, skipped rows and skipped bits.
  call('glPixelStorei',[0xCF5,4]); call('glPixelStorei',[0xCF2,16]);
  call('glPixelStorei',[0xCF3,1]); call('glPixelStorei',[0xCF4,2]); call('glPixelStorei',[0xCF1,1]);
  dv.setUint8(src+4,0b00010100); dv.setUint8(src+8,0b00001000);
  raster(2,2); bitmap(3,2);
  const green=pixel(2,2); assert(green); assert.notStrictEqual(green,red);
  assert.strictEqual(pixel(4,2),green); assert.strictEqual(pixel(3,3),green); assert.strictEqual(pixel(3,2),0);
  for(const pname of [0xCF2,0xCF3,0xCF4,0xCF1])call('glPixelStorei',[pname,0]);
  call('glPixelStorei',[0xCF5,1]);

  // NWN's LIST_BIT push, base, unsigned-byte CallLists, and pop sequence.
  call('glListBase',[0xFEDCBA98]); call('glPushAttrib',[0x20000]); call('glListBase',[glyph]);
  dv.setUint8(src,0); raster(10,4); call('glCallLists',[1,0x1401,source]);
  assert.strictEqual(pixel(10,4),green);
  call('glPopAttrib'); assert.strictEqual(query(0xB32,true)[0],0xFEDCBA98,'full GLuint list base restored');
  call('glNewList',[glyph+1,0x1300]); call('glCallLists',[1,0x1401,source]); call('glEndList');
  dv.setUint8(src,99); call('glListBase',[glyph]); raster(20,4); call('glCallList',[glyph+1]);
  assert.strictEqual(pixel(20,4),green,'CallLists capture owns decoded source offsets');
  // All ten list-offset encodings reach a real matrix command, including
  // signed negative offsets and big-endian GL_2/3/4_BYTES encodings.
  const scalar=call('glGenLists',[1]);
  call('glNewList',[scalar,0x1300]);call('glTranslatef',[3,0,0],[0,1,2]);call('glEndList');
  call('glMatrixMode',[0x1700]);
  for(const [type,bytes,base] of [
    [0x1400,[255],scalar+1],[0x1401,[1],scalar-1],
    [0x1402,[255,255],scalar+1],[0x1403,[1,0],scalar-1],
    [0x1404,[255,255,255,255],scalar+1],[0x1405,[1,0,0,0],scalar-1],
    [0x1406,[0,0,192,63],scalar-1], // 1.5 truncates to 1
    [0x1407,[0,1],scalar-1],[0x1408,[0,0,1],scalar-1],[0x1409,[0,0,0,1],scalar-1],
  ]) {
    new Uint8Array(memory.buffer,src,bytes.length).set(bytes);call('glLoadIdentity');call('glListBase',[base]);call('glCallLists',[1,type,source]);
    assert.strictEqual(new Float32Array(memory.buffer,e.gl_mtx_top_ptr(),16)[12],3,'typed CallLists '+type.toString(16));
  }
  call('glLoadIdentity');call('glListBase',[glyph]);
  call('glDeleteLists',[glyph,1]); clear(); raster(20,4); call('glCallList',[glyph+1]);
  assert.strictEqual(pixel(20,4),0,'deleted nested bitmap list cannot replay stale pixels');

  call('glPushAttrib',[1]); raster(3,4); call('glPopAttrib');
  assert.deepStrictEqual(pos().slice(0,2),[20,4],'CURRENT_BIT restores raster state');
  dv.setUint8(src,0x80); raster(2,2);
  call('glEnable',[0xC11]); call('glScissor',[4,4,2,2]); bitmap(1,1);
  assert.strictEqual(pixel(2,2),0,'bitmap fragments honour scissor'); call('glDisable',[0xC11]);
  call('glEnable',[0xBC0]); call('glAlphaFunc',[0x200,0],[1]); bitmap(1,1);
  assert.strictEqual(pixel(2,2),0,'bitmap fragments honour alpha test'); call('glDisable',[0xBC0]);
  bitmap(1,1); assert.strictEqual(pixel(2,2),green);
  call('glEnable',[0xB71]);call('glDepthFunc',[0x201]);bitmap(1,1);
  color(0,0,1);call('glTranslatef',[0,0,.5],[0,1,2]);raster(2,2);bitmap(1,1);
  assert.strictEqual(pixel(2,2),green,'farther bitmap fragments fail the shared depth test');
  call('glDisable',[0xB71]);call('glLoadIdentity');color(0,1,0);raster(2,2);
  const both=call('glGenLists',[1]);
  call('glNewList',[both,0x1301]);bitmap(1,1,0,0,2,0);call('glEndList');
  assert.deepStrictEqual(pos().slice(0,2),[4,2],'bitmap COMPILE_AND_EXECUTE advances once');
  dv.setUint8(src,0);call('glCallList',[both]);assert.strictEqual(pixel(4,2),green);
  assert.deepStrictEqual(pos().slice(0,2),[6,2]);
  call('glBegin',[0]);call('glCallList',[both]);call('glEnd');
  assert.strictEqual(call('glGetError'),0x502,'replayed bitmap is illegal within Begin/End');
  dv.setUint8(src,0x80);
  bitmap(-1,1); assert.strictEqual(call('glGetError'),0x501);
  call('glPixelStorei',[0xCF5,3]); assert.strictEqual(call('glGetError'),0x501);
  call('glCallLists',[1,0xFFFF,source]); assert.strictEqual(call('glGetError'),0x500);

  for(const cap of [0xDE1,0xB60]) {
    call('glEnable',[cap]); assert.throws(()=>bitmap(1,1),WebAssembly.RuntimeError,'unsupported raster effects must fail visibly'); call('glDisable',[cap]);
  }
  call('glEnable',[0xB50]); assert.throws(()=>raster(2,2),WebAssembly.RuntimeError,'lit raster colour is not silently approximated');
  console.log('PASS native bitmap owned capture, pixel orientation, raster state, unpack, CallLists, attribute, fragment and unsupported-state checks');
})().catch(e=>{console.error(e);process.exitCode=1;});
