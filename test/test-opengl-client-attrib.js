#!/usr/bin/env node
'use strict';
// Client attribute stack (glPush/PopClientAttrib) in the WAT encoder, observed
// on the command stream it emits: draw payloads, and the finished RGBA8
// texture rows (_glTexImage2D) WAT unpacks with the restored pixel-store
// state. (The host-side FixedFunctionGL that used to mirror unpack state is
// retired with lib/gl-compat.js; unpacking happens only in WAT.)
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const Stream = require('../lib/gl-command-stream');
const { CALL_INDEX: O } = Stream;

(async () => {
  let memory, e;
  const draws = [];
  const uploads = [];
  const harness = await bootRenderHarness({ fonts: 'none', extraHostOverrides: {
    gpu_gl_call(op, at, length) {
      if (op !== Stream.WAT_STREAM_FLUSH_OPCODE) return 0;
      return Stream.replay({ buffer: memory.buffer, byteOffset: at, bytes: length }, (code, aux, capture) => {
        const words = new DataView(capture.buffer, capture.stackOffset);
        const arg = i => words.getUint32(4 + i * 4, true);
        if (code === O.wglMakeCurrent || code === O.wglDeleteContext) return 1;
        if (code === Stream.PACKED_DRAW_OPCODE || code === Stream.EXACT_DRAW_OPCODE) {
          draws.push(Array.from(new Float32Array(capture.buffer, capture.pointerOffset, capture.pointerLength / 4)));
        } else if (code === O._glTexImage2D) {
          const width = arg(3), height = arg(4), pointer = arg(8), n = width * height * 4;
          const pixels = capture.pointerGuest === pointer && !capture.pointerBorrowed && capture.pointerOffset
            ? new Uint8Array(capture.buffer, capture.pointerOffset, n)
            : new Uint8Array(memory.buffer, e.guest_to_wasm(pointer) >>> 0, n);
          uploads.push({ pixels: Array.from(pixels) });
        }
        return 0;
      });
    },
  }});
  memory = harness.memory;
  e = harness.exports;
  const guest = e.guest_alloc(4096) >>> 0;
  const wa = p => e.guest_to_wasm(p) >>> 0;
  const stack = wa(guest), dv = new DataView(memory.buffer);
  function call(name, args = []) {
    args.forEach((x,i) => dv.setUint32(stack + 4 + i*4, x >>> 0, true));
    return e.gl_wat_encoder_call(O[name], stack, 0) >>> 0;
  }
  const query = (pname, float = false) => {
    call(float ? 'glGetFloatv' : 'glGetIntegerv', [pname, guest + 128]);
    return float ? dv.getFloat32(wa(guest + 128), true) : dv.getUint32(wa(guest + 128), true);
  };
  const depth = () => query(0xBB1);
  const push = mask => call('glPushClientAttrib', [mask]);
  const pop = () => call('glPopClientAttrib');
  const error = () => call('glGetError');
  const pixel = (p, v) => call('glPixelStorei', [p,v]);
  const flush = () => call('glFinish');
  call('wglMakeCurrent', [7,1]);
  assert.strictEqual(depth(), 0);
  assert.strictEqual(query(0xD3B), 16);
  assert.strictEqual(query(0xD3B, true), 16);
  pop(); assert.strictEqual(error(), 0x504); assert.strictEqual(error(), 0);

  // All supported descriptors, explicit stride, both texture units, and enables.
  const ptr = guest + 256;
  for (let i=0;i<100;i++) dv.setFloat32(wa(ptr)+i*4, (i+1)/100, true);
  call('glVertexPointer', [3,0x1406,16,ptr]);
  call('glNormalPointer', [0x1406,16,ptr+64]);
  call('glColorPointer', [4,0x1406,20,ptr+128]);
  for (const cap of [0x8074,0x8075,0x8076]) call('glEnableClientState',[cap]);
  for (let unit=0;unit<2;unit++) {
    call('glClientActiveTextureARB',[0x84C0+unit]);
    call('glTexCoordPointer',[4,0x1406,20,ptr+192+unit*64]);
    call('glEnableClientState',[0x8078]);
  }
  const draw = () => { call('glDrawArrays',[4,0,3]); flush(); return draws.pop(); };
  const original = draw(); assert.strictEqual(original.length, 3*19);
  push(2);
  call('glVertexPointer',[2,0x1406,0,ptr+32]);
  call('glNormalPointer',[0x1406,0,ptr]);
  call('glColorPointer',[3,0x1406,0,ptr]);
  for (const cap of [0x8075,0x8076]) call('glDisableClientState',[cap]);
  for (let unit=0;unit<2;unit++) {
    call('glClientActiveTextureARB',[0x84C0+unit]);
    call('glTexCoordPointer',[2,0x1406,0,ptr]);
    call('glDisableClientState',[0x8078]);
  }
  call('glClientActiveTextureARB',[0x84C0]);
  pixel(0xCF5,1); pop();
  assert.strictEqual(query(0x84E1),0x84C1);
  assert.strictEqual(query(0xCF5),1,'vertex mask leaves pixel state changed');
  assert.deepStrictEqual(draw(),original,'restored descriptors and enables produce identical vertex payload');
  push(2); call('glColor4ub',[255,0,128,255]); pop();
  call('glDisableClientState',[0x8076]);
  const changedColor = draw();
  assert.deepStrictEqual(changedColor.slice(3,5),[1,0],'client pop does not restore server current color');
  call('glEnableClientState',[0x8076]);

  const pnames = [0xCF5,0xCF2,0xCF3,0xCF4,0xCF1];
  const saved = [8,19,2,3,1];
  pnames.forEach((p,i)=>pixel(p,saved[i]));
  push(1);
  pnames.forEach(p=>pixel(p,p===0xCF5?2:0));
  call('glClientActiveTextureARB',[0x84C0]);
  pop(); flush();
  assert.deepStrictEqual(pnames.map(p=>query(p)),saved,'pixel mask restores all supported bitmap unpack modes');
  new Uint8Array(memory.buffer,wa(ptr)+137,6).set([11,23,37,41,53,67]);
  new Uint8Array(memory.buffer,wa(ptr)+201,6).set([71,83,97,101,113,127]);
  call('glTexImage2D',[0xDE1,0,3,2,2,0,0x1907,0x1401,ptr]); flush();
  assert.strictEqual(uploads.at(-1).pixels.length,16,'native unpack capture reaches the canonical RGBA upload payload');
  assert.deepStrictEqual(uploads.at(-1).pixels,[11,23,37,255,41,53,67,255,71,83,97,255,101,113,127,255],'restored row length and skips select actual source bytes');
  assert.strictEqual(query(0x84E1),0x84C0,'pixel mask leaves array state changed');
  call('glPushAttrib',[0xffffffff]); pixel(0xCF5,2); call('glPopAttrib'); flush();
  assert.strictEqual(query(0xCF5),2,'server attrib pop does not restore native client unpack state');
  for (const mask of [0,0x80000000]) {
    push(mask); pixel(0xCF5,1); pop(); assert.strictEqual(query(0xCF5),1);
  }
  pixel(0xCF5,8); push(0xffffffff); pixel(0xCF5,2);
  call('glClientActiveTextureARB',[0x84C1]); pop();
  assert.strictEqual(query(0xCF5),8); assert.strictEqual(query(0x84E1),0x84C0);
  for(let i=0;i<16;i++) push(0);
  push(1); assert.strictEqual(error(),0x503); assert.strictEqual(depth(),16);
  for(let i=0;i<16;i++) pop();
  assert.strictEqual(depth(),0); pop(); assert.strictEqual(error(),0x504);
  call('glBegin',[4]); push(3); pop(); call('glEnd');
  assert.strictEqual(error(),0x502); assert.strictEqual(depth(),0);
  push(1); call('wglMakeCurrent',[7,2]); assert.strictEqual(depth(),0);
  pop(); assert.strictEqual(error(),0x504); push(0);
  call('wglMakeCurrent',[7,1]); assert.strictEqual(depth(),1); pop();
  call('wglDeleteContext',[2]); call('wglMakeCurrent',[7,2]);
  assert.strictEqual(depth(),0,'deletion frees pending client frames');
  push(2); call('glVertexPointer',[3,0x1406,0,ptr]); pop();
  call('glEnableClientState',[0x8074]);
  const drawCount = draws.length;
  call('glDrawArrays',[4,0,3]); flush();
  assert.strictEqual(draws.length,drawCount,'restoring initial pointer validity must not retain a later pointer');
  // Client pushes/pops are immediate and absent from the compiled list.
  call('glNewList',[500,0x1300]); push(1); assert.strictEqual(depth(),1);
  pop(); call('glEndList'); call('glCallList',[500]);
  assert.strictEqual(depth(),0); assert.strictEqual(error(),0);
  flush();
  console.log('PASS OpenGL client attribute stack: native draw restoration, selective pixel modes, errors, contexts, lists and the unpacked upload rows');
})().catch(e => { console.error(e); process.exitCode=1; });
