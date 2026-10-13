#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX: O } = require('../lib/gl-compat');

(async () => {
  const { exports: e, memory } = await bootRenderHarness({
    fonts: 'none',
    extraHostOverrides: { gpu_gl_call: () => 1 },
  });
  const guest = e.guest_alloc(256) >>> 0;
  const stack = (guest - e.get_image_base() + e.get_guest_base()) >>> 0;
  const dv = new DataView(memory.buffer);
  function call(name, args = [], float = false) {
    assert.notStrictEqual(O[name], undefined, name);
    dv.setUint32(stack, 0, true);
    args.forEach((x, i) => float ? dv.setFloat32(stack + 4 + i * 4, x, true)
      : dv.setUint32(stack + 4 + i * 4, x >>> 0, true));
    return e.gl_wat_encoder_call(O[name], stack, 0) >>> 0;
  }
  const current = n => call('wglMakeCurrent', [7, n]);
  const translate = x => call('glTranslatef', [x, 0, 0], true);
  const identity = () => call('glLoadIdentity');
  const x = () => new Float32Array(memory.buffer, e.gl_mtx_top_ptr(), 16)[12];
  const begin = (id, mode = 0x1300) => call('glNewList', [id, mode]);
  const end = () => call('glEndList');
  const play = id => call('glCallList', [id]);
  const isList = id => call('glIsList', [id]);
  current(1);
  call('glMatrixMode', [0x1700]);
  identity();
  const first = call('glGenLists', [3]);
  assert(first > 0);
  assert.strictEqual(isList(first), 0, 'reservation is not a definition');
  assert.strictEqual(call('glGenLists', [2]), first + 3, 'contiguous disjoint reservations');
  begin(first);
  translate(7);
  assert.strictEqual(x(), 0, 'GL_COMPILE must not reach native matrix observers');
  end();
  assert.strictEqual(isList(first), 1);
  translate(2); // overwrite the original argument stack
  play(first);
  assert.strictEqual(x(), 9, 'replay owns scalar arguments and updates WAT state');
  identity();
  begin(first + 1, 0x1301);
  translate(4);
  assert.strictEqual(x(), 4, 'COMPILE_AND_EXECUTE executes once');
  end();
  play(first + 1);
  assert.strictEqual(x(), 8);
  begin(first + 2);
  play(first);
  end();
  begin(first);
  translate(11);
  end();
  identity();
  play(first + 2);
  assert.strictEqual(x(), 11, 'nested calls resolve the current definition at playback');
  call('glDeleteLists', [first, 1]);
  identity();
  play(first + 2);
  assert.strictEqual(x(), 0, 'deleted nested names do not execute stale commands');
  assert.strictEqual(isList(first), 0);
  assert.strictEqual(call('glGenLists', [1]), first, 'deleted names become available');
  begin(0xffffffff);
  end();
  assert.strictEqual(isList(0xffffffff), 1, 'explicit GLuint names do not have a small slot ceiling');
  begin(100);
  end();
  assert.strictEqual(isList(100), 1, 'empty list is defined');
  begin(101);
  play(101);
  end();
  play(101); // bounded self-recursion
  current(2);
  assert.strictEqual(isList(100), 0, 'context namespaces are independent');
  assert.strictEqual(call('glGenLists', [1]), 1);
  current(1);
  assert.strictEqual(isList(100), 1);
  assert.strictEqual(call('glGenLists', [0]), 0);
  assert.strictEqual(call('glGenLists', [-1]), 0);
  assert.strictEqual(call('glGetError'), 0x501);
  assert.strictEqual(call('glGenLists', [0x7fffffff]), 0);
  assert.strictEqual(call('glGetError'), 0x505, 'oversized reservation fails without wrap or partial allocation');
  begin(0);
  assert.strictEqual(call('glGetError'), 0x501);
  begin(200, 0);
  assert.strictEqual(call('glGetError'), 0x500);
  end();
  assert.strictEqual(call('glGetError'), 0x502);
  begin(200);
  begin(201);
  assert.strictEqual(call('glGetError'), 0x502, 'nested compilation rejected without replacing current list');
  end();
  assert.strictEqual(isList(200), 1);
  assert.strictEqual(isList(201), 0);
  begin(203);
  call('glBegin', [4]);
  end();
  assert.strictEqual(call('glGetError'), 0x502, 'EndList cannot terminate an open primitive');
  call('glEnd');
  end();
  assert.strictEqual(isList(203), 1);
  identity();
  begin(202);
  assert.throws(() => call('glLoadMatrixf', [guest]), WebAssembly.RuntimeError,
    'unsupported pointer commands trap at capture, not after mutating state');
  assert.strictEqual(x(), 0);
  e.gl_wat_encoder_reset();
  current(1);
  assert.strictEqual(isList(100), 0, 'reset releases list namespace and in-progress capture');
  console.log('OpenGL native display-list allocation/record/replay/delete/error tests PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
