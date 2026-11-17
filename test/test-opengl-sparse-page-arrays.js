#!/usr/bin/env node
'use strict';

// glDrawElements with client arrays that cross a guest page boundary into a
// sparse page backed somewhere else in wasm memory.
//
// The WAT encoder used to translate the index pointer ONCE with $g2w and then
// walk that wasm pointer through all `count` indices, and read each vertex's
// components off one translation of the vertex's first byte. A $g2w result is
// good for one guest page only. Warcraft III keeps its index and vertex
// buffers in sparse VirtualAlloc pages, so every index past the page end was
// read out of unrelated memory: vertices at 1.7e38 and a cliff mesh smeared
// across the left of the Prologue cinematic, in both GL backends (the packed
// stream is what both consume). See docs/re-notes/warcraft3-demo.md.
//
// Same draw twice -- arrays wholly inside one page, then straddling the
// boundary -- and the packed vertices must be identical.

const assert = require('assert');
const { compileSrcWasm } = require('./compile-src');
const Stream = require('../lib/gl-command-stream');
const RegionMap = require('../lib/region-map.generated');
const { CALL_INDEX } = require('../lib/gl-command-stream');

const STACK = RegionMap.BASE.GUEST_STACK + 0x1000;
const GL_TRIANGLES = 0x0004, GL_FLOAT = 0x1406, GL_UNSIGNED_SHORT = 0x1403;
const GL_VERTEX_ARRAY = 0x8074;

const binary = compileSrcWasm((file, source) => file !== '09a8e-gl-state.wat' ? source
  : `${source}\n(func (export "test_sp_map") (param i32) (result i32)
      (call $virtual_map_commit (local.get 0) (i32.const 4096)))
    (func (export "test_border_ptr") (param i32) (result i32)
      (call $gl_sw_border_ptr (call $gl_sw_tex_slot (local.get 0))))\n`);
const module_ = new WebAssembly.Module(binary);
const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
const imports = { host: { memory } };
for (const imp of WebAssembly.Module.imports(module_)) {
  if (imp.kind === 'function') (imports[imp.module] ||= {})[imp.name] = () => 0;
}
let draws = [];
let copiedBorder = null;
let copiedUpload = null;
imports.host.gpu_gl_call = (_opcode, streamWa, byteLength) => {
  Stream.replay(Stream.memoryBatch(memory, streamWa >>> 0, byteLength >>> 0), (opcode, _aux, capture) => {
    if (opcode === Stream.PACKED_DRAW_OPCODE) {
      draws.push(Array.from(new Float32Array(memory.buffer.slice(
        capture.pointerOffset, capture.pointerOffset + capture.pointerLength))));
    }
    if (opcode === CALL_INDEX.glTexParameterfv) {
      assert.strictEqual(capture.pointerBorrowed,false,'border vector is copied, never borrowed');
      copiedBorder=Array.from(new Float32Array(memory.buffer.slice(
        capture.pointerOffset,capture.pointerOffset+capture.pointerLength)));
    }
    if(opcode===CALL_INDEX.glTexSubImage2D){
      assert.strictEqual(capture.pointerBorrowed,false);
      copiedUpload=Array.from(new Uint8Array(capture.buffer,capture.pointerOffset,capture.pointerLength));
    }
    return 0;
  });
  return 0;
};
const e = new WebAssembly.Instance(module_, imports).exports;
e.init_thread(0, 0x400000, 0, 0, 0, 0, 0);
e.heap_init(0x420000);

const page = 0x30000000, other = 0x28000000;
// Interleaving the `other` pages makes each page+N backed away from its
// guest neighbour: two boundaries, one for the vertices, one for the indices.
for (const ga of [page, other, page + 4096, other + 4096, page + 8192]) {
  assert.strictEqual(e.test_sp_map(ga) >>> 0, ga);
}
const w = ga => e.guest_to_wasm(ga) >>> 0;
for (const b of [page + 4096, page + 8192]) {
  assert.notStrictEqual(w(b), w(b - 4096) + 4096,
    'the pages must be backed non-adjacently for this test to mean anything');
}
// The interleaved pages hold junk, which is what a straddling read used to see.
for (const ga of [other, other + 4096]) new Uint8Array(memory.buffer, w(ga), 4096).fill(0xEE);

const put16 = (ga, v) => new DataView(memory.buffer).setUint16(w(ga), v, true);
const putF = (ga, v) => new DataView(memory.buffer).setFloat32(w(ga), v, true);
const call = (op, args) => {
  const view = new DataView(memory.buffer);
  args.forEach((a, i) => view.setUint32(STACK + 4 + i * 4, a >>> 0, true));
  return e.gl_wat_encoder_call(op, STACK, 0);
};

const VERTS = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]];
const INDICES = [0, 1, 2, 2, 1, 3, 3, 0, 1];
function draw(vbuf, ibuf) {
  VERTS.forEach((v, i) => v.forEach((c, k) => putF(vbuf + i * 12 + k * 4, c)));
  INDICES.forEach((v, i) => put16(ibuf + i * 2, v));
  draws = [];
  call(CALL_INDEX.glEnableClientState, [GL_VERTEX_ARRAY]);
  call(CALL_INDEX.glVertexPointer, [3, GL_FLOAT, 12, vbuf]);
  call(CALL_INDEX.glDrawElements, [GL_TRIANGLES, INDICES.length, GL_UNSIGNED_SHORT, ibuf]);
  e.gl_wat_stream_flush();
  assert.strictEqual(draws.length, 1, 'one packed draw');
  const floats = draws[0], stride = floats.length / INDICES.length;
  return INDICES.map((_, i) => floats.slice(i * stride, i * stride + 3));
}

const want = INDICES.map(i => VERTS[i]);
assert.deepStrictEqual(draw(page + 0x100, page + 0x200), want, 'arrays inside one page');
// Vertices: vertex 1 has x on the near page and y, z on the far one.
// Indices: the first four on the near page, the rest on the far one.
assert.deepStrictEqual(draw(page + 4096 - 16, page + 8192 - 8), want,
  'index and vertex arrays straddling a sparse page boundary');
console.log('PASS glDrawElements reads indices and vertices across a sparse page boundary');

const uploadAt=page+4096-512,uploadBytes=Array.from({length:1024},(_,i)=>i%251);
uploadBytes.forEach((v,i)=>new DataView(memory.buffer).setUint8(w(uploadAt+i),v));
call(CALL_INDEX.glTexSubImage2D,[0x0DE1,0,0,0,16,16,0x1908,0x1401,uploadAt]);
assert.strictEqual(copiedUpload,null,'small sparse texture upload stays queued');
uploadBytes.forEach((_,i)=>new DataView(memory.buffer).setUint8(w(uploadAt+i),0));
e.gl_wat_stream_flush();
assert.deepStrictEqual(copiedUpload,uploadBytes,'texture snapshot gathers nonadjacent sparse pages before mutation');
console.log('PASS small texture upload snapshots across sparse pages');

e.gl_sw_set_enabled(1);
call(CALL_INDEX.glBindTexture,[0xDE1,7]);
const borderAt=page+4096-8,border=[0.125,0.25,0.5,1];
border.forEach((v,i)=>putF(borderAt+i*4,v));
call(CALL_INDEX.glTexParameterfv,[0xDE1,0x1004,borderAt]);
assert.deepStrictEqual(Array.from(new Float32Array(memory.buffer,e.test_border_ptr(7),4)),border,
  'software observer gathers a border vector across nonadjacent backing pages');
border.forEach((_,i)=>putF(borderAt+i*4,0));
e.gl_wat_stream_flush();
assert.deepStrictEqual(copiedBorder,border,'replay retains copied sparse vector after guest mutation');
console.log('PASS texture border vector copied across sparse pages into software state and replay');
