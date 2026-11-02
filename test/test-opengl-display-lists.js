#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const GL = require('../lib/gl-compat');
const { CALL_INDEX: O } = GL;
const Stream = require('../lib/gl-command-stream');

(async () => {
  const extraWat = `(func (export "material_api_test") (param $op i32) (param $frame i32)
    (local $saved i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $frame))
    (call $handle_gpu_api (local.get $op) (i32.const 3)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (if (i32.ne (i32.load offset=16 (global.get $reg_base))
      (i32.add (local.get $frame) (i32.const 16))) (then (unreachable)))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved)))`;
  const mutation = process.env.GL_MATERIAL_MUTATION;
  let prebuiltModule;
  if (mutation) {
    const { compileSrcWasm } = require('./compile-src');
    prebuiltModule = new WebAssembly.Module(compileSrcWasm((file, source) => {
      if (file === '13-exports.wat') return source + extraWat;
      if (mutation === 'late-lighting' && file === '09a8c-gl-encoder.wat')
        return source.replace('      (call $gl_material_light_pending)', '      (nop)');
      if (mutation === 'borrow-list-vector' && file === '09a8ca-gl-lists.wat')
        return source.replace('(i32.store offset=20 (local.get $p) (call $w2g (i32.add (local.get $p) (i32.const 24))))', '(nop)');
      if (mutation === 'skip-validation' && file === '09a8ca-gl-lists.wat')
        return source.replace('(if (call $gl_material_validate (local.get $ctx) (local.get $op) (local.get $stack))', '(if (i32.const 0)');
      return source;
    }));
  }
  const submissions = [];
  let memoryRef;
  const { exports: e, memory } = await bootRenderHarness({
    fonts: 'none',
    ...(prebuiltModule ? {prebuiltModule} : {extraWat}),
    extraHostOverrides: { gpu_gl_call: (op, at, bytes) => {
      if (op === Stream.WAT_STREAM_FLUSH_OPCODE && memoryRef)
        { const b = Buffer.from(new Uint8Array(memoryRef.buffer, at, bytes));
          submissions.push(b);
          let last; Stream.replay({buffer: b.buffer, byteOffset: b.byteOffset, bytes: b.length}, op => {last=op; return 0;});
          if(last === O.glGetError) return 0;
        }
      return op === Stream.WAT_STREAM_FLUSH_OPCODE ? 1 : 0;
    } },
  });
  memoryRef = memory;
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
  // Matrix pointers now have genuine value capture; images remain unsupported.
  assert.throws(() => call('glTexImage2D', [0x0DE1, 0, 0x1908, 1, 1, 0, 0x1908, 0x1401, guest]), WebAssembly.RuntimeError,
    'unsupported pointer commands trap at capture, not after mutating state');
  assert.strictEqual(x(), 0);
  e.gl_wat_encoder_reset();
  current(1);
  assert.strictEqual(isList(100), 0, 'reset releases list namespace and in-progress capture');
  // Real material updates inside one TRIANGLE_STRIP. Different colours at
  // adjacent vertices catch both final-material leakage and primitive splitting.
  const vecGuest = e.guest_alloc(16) >>> 0;
  const vecWa = vecGuest - e.get_image_base() + e.get_guest_base();
  const vector = values => new Float32Array(memory.buffer, vecWa, values.length).set(values);
  const material = values => { vector(values); call('glMaterialfv', [0x408, 0x1600, vecGuest]); };
  const vertex = (x, y) => call('glVertex3f', [x, y, 0], true);
  const records = () => {
    e.gl_wat_stream_flush();
    const result = [];
    for (const buffer of submissions.splice(0)) Stream.replay({buffer: buffer.buffer,
      byteOffset: buffer.byteOffset, bytes: buffer.length}, (op, mode, capture) => {
      if (op === Stream.PACKED_DRAW_OPCODE) result.push({mode,
        v: Array.from(new Float32Array(capture.buffer, capture.pointerOffset, capture.pointerLength / 4))});
      return 0;
    });
    return result;
  };
  call('glEnable', [0x0B50]);
  // Ambient/diffuse zero isolates emission, independently of light defaults.
  vector([0, 0, 0, 1]); call('glMaterialfv', [0x408, 0x1602, vecGuest]);
  records();
  call('glBegin', [5]);
  material([1, 0, 0, 1]); vertex(-.8, -.8);
  call('glMaterialfv', [0, 0x1600, 0]); // enum rejection precedes pointer access

  material([0, 1, 0, 1]); vertex(.8, -.8);
  material([0, 0, 1, 1]); vertex(-.8, .8);
  material([1, 1, 0, 1]); vertex(.8, .8);
  call('glEnd');
  let draw = records();
  assert.strictEqual(draw.length, 1);
  assert.strictEqual(draw[0].mode, 0x20004, 'prelit independent triangles retain strip winding');
  assert.strictEqual(draw[0].v.length, 6 * 19);
  assert.strictEqual(call('glGetError'), 0x500, 'invalid in-Begin material leaves its primitive intact');
  const colors = draw[0].v.filter((_, i) => i % 19 >= 3 && i % 19 < 7);
  assert.deepStrictEqual(colors, [1,0,0,1, 0,1,0,1, 0,0,1,1, 0,0,1,1, 0,1,0,1, 1,1,0,1]);
  assert.deepStrictEqual(Array.from(new Float32Array(memory.buffer, e.gl_mtx_material_ptr(3), 4)), [1,1,0,1],
    'material state survives End');
  // Invalid enum/value calls must neither overwrite state nor enter a list.
  call('glMaterialfv', [0, 0x1600, vecGuest]);
  assert.strictEqual(call('glGetError'), 0x500);
  call('glMaterialf', [0x408, 0x1600, 0]);
  assert.strictEqual(call('glGetError'), 0x500);
  vector([129]); call('glMaterialfv', [0x408, 0x1601, vecGuest]);
  assert.strictEqual(call('glGetError'), 0x501);
  assert.strictEqual(e.gl_mtx_shininess(), 0);
  begin(210);
  call('glBegin', [0]);
  material([.25, .5, .75, 1]); vertex(0, 0);
  call('glEnd'); end();
  material([1, 1, 1, 1]); // overwrites caller vector after compilation
  records(); play(210); draw = records();
  assert.deepStrictEqual(draw[0].v.slice(3, 7), [.25,.5,.75,1], 'list owns pointed material payload');
  assert.strictEqual(call('glGetError'), 0);
  // A subsequent primitive without material updates uses ordinary lighting.
  call('glBegin', [0]); vertex(0, 0); call('glEnd');
  assert.strictEqual(records()[0].mode, 0, 'prelit transport does not leak into following draws');
  begin(211, 0x1301);
  call('glBegin', [0]); material([.5, .25, .125, 1]); vertex(0, 0); call('glEnd'); end();
  assert.deepStrictEqual(records()[0].v.slice(3, 7), [.5,.25,.125,1], 'compile-and-execute runs material once');
  material([1, 1, 1, 1]); records(); play(211);
  assert.deepStrictEqual(records()[0].v.slice(3, 7), [.5,.25,.125,1], 'compile-and-execute also owns material data');
  // Production stdcall path consumes exactly return + three arguments and
  // snapshots the vector before the guest can reuse it.
  vector([.125, .25, .5, 1]);
  call('glMaterialfv', [0x408, 0x1600, vecGuest]);
  dv.setUint32(stack + 16, 0x13579bdf, true);
  e.material_api_test(O.glMaterialfv, guest);
  assert.strictEqual(dv.getUint32(stack, true), 0);
  assert.strictEqual(dv.getUint32(stack + 16, true), 0x13579bdf);
  for (const name of ['glMaterialf', 'glMateriali']) {
    dv.setUint32(stack + 4, 0x408, true); dv.setUint32(stack + 8, 0x1601, true);
    if (name === 'glMaterialf') dv.setFloat32(stack + 12, 17, true);
    else dv.setInt32(stack + 12, 23, true);
    e.material_api_test(O[name], guest);
    assert.strictEqual(e.gl_mtx_shininess(), name === 'glMaterialf' ? 17 : 23);
    assert.strictEqual(dv.getUint32(stack + 16, true), 0x13579bdf);
  }
  dv.setUint32(stack + 4, 0, true); // bad face, checked before pointed bytes
  e.material_api_test(O.glMaterialfv, guest);
  assert.strictEqual(dv.getUint32(stack + 16, true), 0x13579bdf);
  assert.strictEqual(call('glGetError'), 0x500, 'rejected material still performs stdcall cleanup');
  // Actual software consumption: material after a point must not recolour
  // it, and already-lit data must not be lit a second time with green.
  call('glMatrixMode', [0x1700]); identity();
  call('glMatrixMode', [0x1701]); identity();
  e.gl_sw_set_default_size(16, 16);
  e.gl_sw_set_enabled(1);
  call('glViewport', [0, 0, 16, 16]);
  material([1, 0, 0, 1]);
  call('glBegin', [0]); vertex(0, 0); material([0, 1, 0, 1]); call('glEnd');
  const entry = e.gl_sw_entry();
  assert(entry, 'software draw created its target');
  const pitch = dv.getUint16(entry + 18, true), pixels = dv.getUint32(entry + 20, true);
  let red = 0, green = 0;
  for(let y=0;y<16;y++) for(let x=0;x<16;x++) {
    const rgb = dv.getUint32(pixels + y*pitch + x*4, true) & 0xffffff;
    if (rgb === 0xff0000) red++;
    if (rgb === 0x00ff00) green++;
  }
  assert(red > 0, 'native raster draws the point with its earlier red material');
  assert.strictEqual(green, 0, 'final green material is not applied to an earlier vertex');
  e.gl_sw_set_enabled(0);
  // The JS replay bypass is scoped to this draw and survives a draw exception.
  const events = [], f = {
    enabled: new Set([0x0B50]),
    flushPendingDraw() { events.push('flush'); },
    setEnabled(cap, on) { if(on) this.enabled.add(cap); else this.enabled.delete(cap); events.push(on); },
    enqueuePacked(mode) { assert.strictEqual(mode, 4); assert(!this.enabled.has(0x0B50)); events.push('draw'); },
  };
  const fakeBridge = {_current: () => ({frontend: f}), _capture: {
    buffer: new ArrayBuffer(76), pointerOffset: 4, pointerLength: 0,
  }};
  GL.OpenGLHostBridge.prototype._call.call(fakeBridge, Stream.PACKED_DRAW_OPCODE, 0, 0x20004);
  assert(f.enabled.has(0x0B50));
  assert.deepStrictEqual(events, ['flush', false, 'draw', 'flush', true]);
  f.enqueuePacked = () => {throw new Error('draw failure');};
  assert.throws(() => GL.OpenGLHostBridge.prototype._call.call(fakeBridge,
    Stream.PACKED_DRAW_OPCODE, 0, 0x20004), /draw failure/);
  assert(f.enabled.has(0x0B50), 'replay restores lighting after failure');
  call('glDisable', [0x0B50]);
  call('glColor4f', [.25,.5,.75,.5], true);
  call('glBegin', [0]); material([1,0,0,1]); vertex(0,0); call('glEnd');
  const unlit = records().at(-1);
  assert.strictEqual(unlit.mode, 0);
  assert.deepStrictEqual(unlit.v.slice(3,7), [.25,.5,.75,.5], 'unlit material leaves current colour intact');
  call('glBegin', [0]);
  const beforeRejectedBinding=e.gl_wat_stream_used();
  call('glBindTexture', [0x0DE1, 1]);
  assert.strictEqual(e.gl_wat_stream_used(),beforeRejectedBinding,'illegal binding emits no command');
  call('glEnd');
  assert.strictEqual(call('glGetError'),0x502,'in-Begin texture binding reports INVALID_OPERATION');
  console.log('OpenGL native display-list allocation/record/replay/delete/error tests PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
