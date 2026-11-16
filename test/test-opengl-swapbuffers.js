#!/usr/bin/env node
'use strict';

// Keep both authentic GDI32!SwapBuffers and Quake II ref_gl's dynamically
// resolved legacy wglSwapBuffers spelling connected to one generic present.

const assert = require('assert');
const { createHostImports } = require('../lib/host-imports');
const Stream = require('../lib/gl-command-stream');
const { compileSrcWasm } = require('./compile-src');
const apiTable = require('../src/api_table.json');

async function main() {
  const extraWat = `
  (func (export "test_call_legacy_wglSwapBuffers") (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_gpu_api
      (i32.const 55) (i32.const 1)
      (i32.const 0x1234) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_virtual_reset")
    (call $zero_memory (global.get $VIRTUAL_MAP_STATE)
      (i32.add (global.get $VIRTUAL_MAP_STATE_SIZE)
        (global.get $VIRTUAL_MAP_TABLE_SIZE)))
    (call $zero_memory (global.get $GUEST_PAGE_TABLE)
      (global.get $GUEST_PAGE_TABLE_SIZE))
    (i32.store (i32.add (global.get $VIRTUAL_MAP_STATE) (i32.const 4))
      (global.get $VIRTUAL_BACKING_BASE))
    (global.set $virtual_alloc_top (global.get $VIRTUAL_ALLOC_TOP_INIT))
    (global.set $heap_sparse_ptr (i32.const 0))
    (global.set $heap_sparse_end (i32.const 0)))
  (func (export "test_virtual_alloc_commit") (param $size i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00500000))
    (call $handle_VirtualAlloc
      (i32.const 0) (local.get $size) (i32.const 0x3000)
      (i32.const 0x04) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  `;
  // Plain append: src fragments are self-balanced now, so there is no trailing
  // `)` to splice into — the old regex matched nothing and dropped extraWat.
  const wasm = compileSrcWasm((file, source) =>
    file === '13-exports.wat' ? `${source}\n${extraWat}\n` : source);
  const memory = new WebAssembly.Memory({
    initial: 8192, maximum: 8192, shared: true,
  });
  const imports = createHostImports({
    getMemory: () => memory.buffer,
    renderer: null,
    resourceJson: {},
  });
  imports.host.memory = memory;
  Object.assign(imports.host, {
    create_thread: () => 0, exit_thread: () => 0, terminate_thread: () => 0,
    create_event: () => 0, set_event: () => 0, reset_event: () => 0,
    wait_single: () => 0, wait_multiple: () => 0,
    com_create_instance: () => 0x80004002,
  });

  const presents = [];
  let gpuResult = 1;
  imports.host.gpu_gl_call = (opcode, stackWa, aux) => {
    if ((opcode >>> 0) === Stream.WAT_STREAM_FLUSH_OPCODE) {
      return Stream.replay(Stream.memoryBatch(memory, stackWa, aux),
        (streamOpcode, streamAux, capture) => {
          if (streamOpcode === 0x10008) return 0; // WGL-mode query: this host keeps the JS path
          presents.push({ opcode: streamOpcode, stackWa: capture.stackOffset, aux: streamAux });
          return gpuResult;
        });
    }
    presents.push({ opcode, stackWa, aux });
    return gpuResult;
  };
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  instance.exports.heap_init(0x420000);

  instance.exports.test_virtual_reset();
  const sparse = instance.exports.test_virtual_alloc_commit(0x10000) >>> 0;
  assert(sparse, 'fixture obtains a real sparse guest allocation');
  const sparseWa = instance.exports.guest_to_wasm(sparse + 0x6050) >>> 0;
  assert.notStrictEqual(sparseWa, 0xf0,
    'GPU host translator resolves a committed sparse vertex pointer');

  const legacy = apiTable.find(api => api.name === 'wglSwapBuffers');
  assert(legacy && legacy.nargs === 1 && legacy.convention === 'stdcall',
    'GetProcAddress name table exposes Quake II ref_gl legacy presentation');

  // Leave native geometry pending. SwapBuffers must flush it before the
  // presentation record in the same ordered stream.
  const glStack = 0x403000;
  const glView = new DataView(memory.buffer);
  glView.setUint32(glStack + 4, 0, true); // GL_POINTS
  instance.exports.gl_wat_encoder_call(21, glStack, 0);
  [1.25, -2.5, 3.75].forEach((value, index) =>
    glView.setFloat32(glStack + 4 + index * 4, value, true));
  instance.exports.gl_wat_encoder_call(30, glStack, 0);
  instance.exports.gl_wat_encoder_call(22, glStack, 0);

  assert.strictEqual(instance.exports.test_call_SwapBuffers(0x1234), 1,
    'GDI32 SwapBuffers returns the successful GPU presentation result');
  assert.deepStrictEqual(presents.map(call => call.opcode), [Stream.PACKED_DRAW_OPCODE, 55],
    'GDI32 SwapBuffers orders pending native geometry before presentation');
  assert.strictEqual(presents[1].opcode, 55,
    'GDI32 SwapBuffers uses the GL frontend present operation');
  assert.strictEqual(presents[1].aux, 0,
    'presentation resolves the already-current GL context');

  const legacyStack = 0x074ff000;
  assert.strictEqual(instance.exports.test_call_legacy_wglSwapBuffers(legacyStack), 1,
    'legacy wglSwapBuffers returns the generic GPU presentation result');
  assert.strictEqual(instance.exports.get_esp() >>> 0, legacyStack + 8,
    'legacy wglSwapBuffers pops its one-argument stdcall frame');
  assert.strictEqual(presents.length, 3,
    'legacy wglSwapBuffers reaches the same present bridge exactly once');
  assert.strictEqual(presents[2].opcode, 55,
    'legacy wglSwapBuffers uses the backend-neutral present operation');

  gpuResult = 0;
  assert.strictEqual(instance.exports.test_call_SwapBuffers(0x1234), 0,
    'without a GL context, an unknown DC retains the legacy GDI failure');

  console.log('PASS GDI32/legacy WGL SwapBuffers share GPU present and preserve GDI fallback');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
