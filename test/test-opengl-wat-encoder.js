#!/usr/bin/env node
'use strict';

// Independent byte oracle for the production WAT OpenGL encoder. The JS
// encoder remains the deliberately separate reference implementation.

const assert = require('assert');
const Stream = require('./helpers/gl-reference-encoder');
const { compileSrcWasm } = require('./compile-src');
const RegionMap = require('../lib/region-map.generated');

// Direct-WASM stack pointer contract. Keep it in the compiler-owned stack
// region: the low heap grows during pressure tests and may legitimately pass
// through arbitrary low addresses such as the old 0x403000 fixture.
const STACK = RegionMap.BASE.GUEST_STACK + 0x1000;
const DATA = 0x404000;
const STREAM_CALL = 0x10001;
const sectionArg = process.argv.find(arg => arg.startsWith('--section='));
const SECTION = sectionArg ? sectionArg.slice('--section='.length) : 'all';
const SECTIONS = new Set(['all', 'primitive', 'state', 'arrays', 'generic',
  'pressure', 'context', 'isolation', 'hardening', 'errors', 'boundary', 'pool']);
if (!SECTIONS.has(SECTION)) throw new Error(`unknown parity section: ${SECTION}`);
const sectionEnabled = name => SECTION === 'all' || SECTION === name;

const u32 = value => ({ kind: 'u32', value });
const f32 = value => ({ kind: 'f32', value });

function submissionResult(bytes, memory, guestToWasm = pointer => pointer) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 0, opcode = -1, lastAt = 0;
  while (at < bytes.length) {
    lastAt = at;
    const length = view.getUint32(at, true);
    assert(length >= Stream.HEADER_BYTES && at + length <= bytes.length,
      'submitted stream has a valid record walk');
    opcode = view.getUint32(at + 4, true) | 0;
    at += length;
  }
  assert.strictEqual(at, bytes.length, 'submitted stream ends on a record boundary');
  if (opcode === 103 && memory) {
    const output = view.getUint32(lastAt + Stream.HEADER_BYTES + 8, true);
    new DataView(memory.buffer).setUint32(guestToWasm(output) >>> 0, 0xAABBCCDD, true);
  }
  if (opcode === 113 && memory) {
    const output=view.getUint32(lastAt+Stream.HEADER_BYTES+12,true);
    new DataView(memory.buffer).setFloat32(guestToWasm(output)>>>0,0.25,true);
  }
  if (opcode === 12) return 0x504;
  if (opcode === 48) return 0xC001;
  if (opcode === 49) {
    return view.getUint32(lastAt + Stream.HEADER_BYTES + 4, true) === 0xDEAD ? 0 : 1;
  }
  if (opcode === 51) {
    return view.getUint32(lastAt + Stream.HEADER_BYTES + 8, true) === 0xC0DE ? 0 : 1;
  }
  if (opcode === 55) return 1;
  return 0;
}

function writeArgs(memory, args, stackWa = STACK) {
  const bytes = new Uint8Array(memory.buffer, stackWa,
    stackWa === STACK ? 96 : 4 + args.length * 4);
  bytes.fill(0);
  const view = new DataView(memory.buffer);
  view.setUint32(stackWa, 0xDEC0ADDE, true);
  args.forEach((arg, index) => {
    const at = stackWa + 4 + index * 4;
    if (arg && arg.kind === 'f32') view.setFloat32(at, arg.value, true);
    else view.setUint32(at, (arg && arg.kind === 'u32' ? arg.value : arg) >>> 0, true);
  });
}

function jsRunner(memory, capacity, submissions, guestToWasm) {
  const encoder = new Stream.Encoder({
    exactColors: true,
    getMemory: () => memory.buffer,
    guestToWasm,
    shared: false,
    capacity,
    submit: batch => {
      const bytes = Buffer.from(new Uint8Array(batch.buffer, 0, batch.bytes));
      submissions.push(bytes);
      return submissionResult(bytes, memory, guestToWasm);
    },
  });
  return {
    call(opcode, args = [], aux = 0) {
      writeArgs(memory, args);
      return encoder.call(opcode, STACK, aux) | 0;
    },
    callAt(opcode, args, stackWa, aux = 0) {
      writeArgs(memory, args, stackWa);
      return encoder.call(opcode, stackWa, aux) | 0;
    },
    flush: () => encoder.flush() | 0,
  };
}

function watRunner(memory, exports) {
  return {
    call(opcode, args = [], aux = 0) {
      writeArgs(memory, args);
      return exports.gl_wat_encoder_call(opcode, STACK, aux) | 0;
    },
    callAt(opcode, args, stackWa, aux = 0) {
      writeArgs(memory, args, stackWa);
      return exports.gl_wat_encoder_call(opcode, stackWa, aux) | 0;
    },
    flush: () => exports.gl_wat_stream_flush() | 0,
  };
}

function compareSubmissions(label, expected, actual) {
  assert.strictEqual(actual.length, expected.length, `${label}: submission count`);
  for (let i = 0; i < expected.length; i++) {
    if (actual[i].length !== expected[i].length) {
      const summary = bytes => {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let at = 0, records = 0, last = 0;
        while (at < bytes.length) { last = view.getUint32(at, true); at += last; records++; }
        return `${bytes.length} bytes/${records} records/last=${last}`;
      };
      assert.fail(`${label}: submission ${i} byte length: JS ${summary(expected[i])}, WAT ${summary(actual[i])}`);
    }
    if (Buffer.compare(actual[i], expected[i]) !== 0) {
      let diff = 0;
      while (diff < expected[i].length && actual[i][diff] === expected[i][diff]) diff++;
      const locate = bytes => {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let at = 0, index = 0;
        while (at < bytes.length) {
          const length = view.getUint32(at, true);
          if (diff < at + length) return `record ${index} opcode ${view.getUint32(at + 4, true)} +${diff - at}`;
          at += length; index++;
        }
        return 'after final record';
      };
      assert.fail(`${label}: submission ${i} differs at byte ${diff} (`
        + `JS ${locate(expected[i])}, WAT ${locate(actual[i])}); `
        + `JS=0x${expected[i][diff].toString(16)}, WAT=0x${actual[i][diff].toString(16)}`);
    }
  }
}

// Pressure tests retain the independent 2 MiB oracle. Compare complete
// records across packet boundaries, rebasing only the packet-relative payload.
function orderedRecords(submissions) {
  return submissions.flatMap(bytes => {
    const records = [];
    for (let at = 0; at < bytes.length;) {
      const length = bytes.readUInt32LE(at);
      assert(length >= Stream.HEADER_BYTES && at + length <= bytes.length);
      const record = Buffer.from(bytes.subarray(at, at + length));
      const pointer = record.readUInt32LE(24);
      if (pointer) {
        assert(pointer >= at + Stream.HEADER_BYTES && pointer < at + length);
        record.writeUInt32LE(pointer - at, 24);
      }
      records.push(record);
      at += length;
    }
    return records;
  });
}

async function main() {
  const binary = compileSrcWasm((file, source) => {
    if (file === '09a8c-gl-encoder.wat') {
      // Fault only an allocation call, not allocator internals: exercise the
      // production rollback path after either extra affine buffer fails.
      return source.replaceAll('(call $gl_alloc_affine', '(call $test_gl_pool_alloc')
        .replaceAll('(call $heap_free', '(call $test_gl_pool_free') + `
        (global $test_pool_allocs (mut i32) (i32.const 0))
        (global $test_pool_fail (mut i32) (i32.const 0))
        (global $test_pool_frees (mut i32) (i32.const 0))
        (func $test_gl_pool_alloc (param $bytes i32) (result i32)
          (global.set $test_pool_allocs (i32.add (global.get $test_pool_allocs) (i32.const 1)))
          (if (i32.eq (global.get $test_pool_allocs) (global.get $test_pool_fail))
            (then (return (i32.const 0))))
          (call $gl_alloc_affine (local.get $bytes)))
        (func $test_gl_pool_free (param $guest i32)
          (global.set $test_pool_frees (i32.add (global.get $test_pool_frees) (i32.const 1)))
          (call $heap_free (local.get $guest)))
        (func (export "test_pool_fail_at") (param i32) (global.set $test_pool_fail (local.get 0)))
        (func (export "test_pool_alloc_count") (result i32) (global.get $test_pool_allocs))
        (func (export "test_pool_free_count") (result i32) (global.get $test_pool_frees))
      `;
    }
    if (file !== '09a8e-gl-state.wat') return source;
    // Test-only translator sentinels place vector inputs at the actual end of
    // linear memory. The production state functions remain otherwise exact;
    // ordinary guest addresses still pass through the real sparse translator.
    const instrumented = source.replaceAll('(call $g2w', '(call $test_gl_boundary_g2w');
    return `${instrumented}\n(func $test_gl_boundary_g2w (param $guest i32) (result i32)
      (if (result i32) (i32.eq (local.get $guest) (i32.const 0xFFF0000C))
        (then (i32.sub (i32.shl (memory.size) (i32.const 16)) (i32.const 12)))
        (else (if (result i32) (i32.eq (local.get $guest) (i32.const 0xFFF00008))
          (then (i32.sub (i32.shl (memory.size) (i32.const 16)) (i32.const 8)))
          (else (call $g2w (local.get $guest)))))))\n`;
  });
  const module_ = new WebAssembly.Module(binary);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  // The host/worker handoff carries only this shared offset and length. Pin its
  // range checks and its conversion of stream-relative payload offsets.
  const transportAt = DATA + 0x2000;
  const transport = new DataView(memory.buffer);
  transport.setUint32(transportAt, 44, true);
  transport.setUint32(transportAt + 4, 10, true);
  transport.setUint32(transportAt + 12, 8, true);
  transport.setUint32(transportAt + 20, 4, true);
  transport.setUint32(transportAt + 24, 40, true);
  transport.setUint32(transportAt + 28, Stream.FLAG_POINTER_COPY, true);
  let transportedCapture = null;
  Stream.replay(Stream.memoryBatch(memory, transportAt, 44), (_opcode, _aux, capture) => {
    transportedCapture = capture;
    return 0;
  });
  assert.strictEqual(transportedCapture.stackOffset, transportAt + 32);
  assert.strictEqual(transportedCapture.pointerOffset, transportAt + 40,
    'worker shared-memory offset retains stream-relative copied payload offsets');
  assert.throws(() => Stream.memoryBatch(memory, transportAt + 1, 44), RangeError);
  assert.throws(() => Stream.memoryBatch(memory, memory.buffer.byteLength - 4, 8), RangeError);
  transport.setUint32(transportAt, 43, true);
  assert.throws(() => Stream.replay(Stream.memoryBatch(memory, transportAt, 44), () => 0), RangeError);
  console.log('PASS shared-offset host/worker handoff rejects malformed ranges and records');
  let activeSubmissions = [];
  let translateGuest = pointer => pointer;
  const imports = { host: { memory } };
  for (const imp of WebAssembly.Module.imports(module_)) {
    if (imp.kind === 'function') (imports[imp.module] ||= {})[imp.name] = () => 0;
  }
  imports.host.gpu_gl_call = (opcode, streamWa, byteLength) => {
    assert.strictEqual(opcode >>> 0, STREAM_CALL,
      'production GL crosses the host boundary only as a native WAT stream');
    const bytes = Buffer.from(new Uint8Array(memory.buffer, streamWa >>> 0, byteLength >>> 0));
    activeSubmissions.push(bytes);
    return submissionResult(bytes, memory, translateGuest);
  };
  const a = new WebAssembly.Instance(module_, imports).exports;
  const b = new WebAssembly.Instance(module_, imports).exports;
  a.init_thread(0, 0x400000, 0, 0, 0, 0, 0);
  b.init_thread(1, 0x400000, 0, 0, 0, 0, 0);
  a.heap_init(0x420000);
  translateGuest = pointer => pointer === 0xFFF0000C ? memory.buffer.byteLength - 12
    : pointer === 0xFFF00008 ? memory.buffer.byteLength - 8
      : a.guest_to_wasm(pointer) >>> 0;
  for (const e of [a, b]) {
    for (const name of ['gl_wat_encoder_call', 'gl_wat_stream_flush',
      'gl_wat_encoder_reset', 'gl_wat_stream_capacity']) {
      assert.strictEqual(typeof e[name], 'function', `production export ${name}`);
    }
  }
  const capacity = a.gl_wat_stream_capacity() >>> 0;
  assert(capacity >= 256, 'production stream publishes a usable capacity');
  assert.strictEqual(a.gl_wat_encoder_set_enabled, undefined,
    'production exposes no runtime JS encoder selector');
  assert.strictEqual(a.gl_wat_encoder_enabled, undefined,
    'production GL encoding is native-only');

  function parity(label, sequence) {
    const section = label.split(':', 1)[0];
    if (!sectionEnabled(section)) return;
    const expected = [];
    const oracle = jsRunner(memory, capacity, expected, translateGuest);
    sequence(oracle, memory);
    oracle.flush();
    a.gl_wat_encoder_reset();
    activeSubmissions = [];
    const native = watRunner(memory, a);
    sequence(native, memory);
    native.flush();
    if (section === 'pressure') {
      assert.deepStrictEqual(orderedRecords(activeSubmissions), orderedRecords(expected),
        `${label}: smaller batches preserve every complete record in order`);
      if (!label.includes('partially occupied tail')) {
        assert(activeSubmissions.length > expected.length, 'dispatch starts before capacity');
        assert(Math.abs(activeSubmissions[0].length - 512 * 1024) < 300,
          'small generic/packed records submit at the 512 KiB watermark');
      }
    } else compareSubmissions(label, expected, activeSubmissions);
    console.log(`PASS ${label}`);
  }

  const primitiveNames = ['points', 'lines', 'line-loop', 'line-strip', 'triangles',
    'triangle-strip', 'triangle-fan', 'quads', 'quad-strip', 'polygon'];
  const primitiveCounts = [3, 4, 4, 4, 6, 5, 5, 8, 6, 5];
  parity('generic: clip plane owns four binary64 coefficients', (gl,mem)=>{
    const view=new DataView(mem.buffer),wa=translateGuest(DATA);
    [1.0000000000000002,-16777217,0.125,-0.75].forEach((v,i)=>view.setFloat64(wa+8*i,v,true));
    gl.call(148,[0x3005,DATA]);
    new Uint8Array(mem.buffer,wa,32).fill(0x5a);
  });
  parity('generic: texture vector copies survive mutation and query is a barrier', (gl,mem)=>{
    const view=new DataView(mem.buffer),wa=translateGuest(DATA),out=translateGuest(DATA+64);
    [0.25,0.5,0.75,1].forEach((v,i)=>view.setFloat32(wa+i*4,v,true));
    gl.call(112,[0x0DE1,0x1004,DATA]);
    new Uint8Array(mem.buffer,wa,16).fill(0);
    view.setFloat32(wa,0x2900,true);
    gl.call(112,[0x0DE1,0x2802,DATA]);
    view.setFloat32(wa,0,true);
    gl.call(112,[0x0DE0,0x1004,DATA]);
    gl.call(147,[0x2300,0x2201,DATA]);
    new Float32Array(mem.buffer,translateGuest(DATA),4).set([0x1e01,9,8,7]);
    gl.call(147,[0x2300,0x2200,DATA]);
    new Float32Array(mem.buffer,translateGuest(DATA),4).fill(0.75);
    gl.call(147,[0x2300,0xDEADBEEF,0xFFFFFFF0]);
    gl.call(147,[0x0DE1,0x2201,0xFFFFFFF0]);
    gl.call(112,[0x0DE2,0x1004,0xFFFFFFF0]);
    gl.call(112,[0x0DE1,0xDEADBEEF,0xFFFFFFF0]);
    view.setFloat32(out,-1,true);
    gl.call(113,[0x0DE1,0x1004,DATA+64]);
    assert.strictEqual(view.getFloat32(out,true),0.25,'query result visible before guest continues');
  });
  for (const shade of [0x1D01, 0x1D00]) {
    for (let mode = 0; mode <= 9; mode++) {
      parity(`primitive: ${primitiveNames[mode]} ${shade === 0x1D00 ? 'flat' : 'smooth'}`, gl => {
      gl.call(19, [shade]);
      gl.call(21, [mode]);
        for (let i = 0; i < primitiveCounts[mode]; i++) {
          gl.call(25, [f32((i + 1) / 11), f32((mode + 1) / 13), f32(shade === 0x1D00 ? 1 : 0.5), f32(1)]);
          gl.call(28, [f32(i / 7), f32((i + 2) / 9)]);
          gl.call(107, [0x84C1, f32((i + 3) / 10), f32((i + 4) / 12)]);
          gl.call(63, [f32(i - 2), f32(0.25), f32(-0.75)]);
          gl.call(30, [f32(i + 0.125), f32(mode - 4.5), f32(-i - 0.5)]);
        }
      gl.call(22);
      gl.call(11);
      });
      parity(`primitive: ${primitiveNames[mode]} ${shade === 0x1D00 ? 'flat' : 'smooth'} incomplete counts`, gl => {
        gl.call(19, [shade]);
        for (let count = 0; count <= 5; count++) {
          gl.call(21, [mode]);
          for (let i = 0; i < count; i++) {
            gl.call(25, [f32((count + 1) / 7), f32((i + 1) / 9), f32(mode / 10), f32(1)]);
            gl.call(30, [f32(i + 0.25), f32(count - 2.5), f32(mode)]);
          }
          gl.call(22);
        }
        gl.call(11);
      });
    }
  }

  parity('state: current attributes, vector inputs, attrib stack, and both texture units', (gl, mem) => {
    const view = new DataView(mem.buffer);
    const dataWa = translateGuest(DATA);
    [0.125, -0.25, 0.5, 1].forEach((v, i) => view.setFloat32(dataWa + i * 4, v, true));
    view.setUint8(dataWa + 32, 0x20); view.setUint8(dataWa + 33, 0x80); view.setUint8(dataWa + 34, 0xFE);
    const point = value => {
      gl.call(21, [0]); gl.call(30, [f32(value), f32(2), f32(3)]); gl.call(22);
    };
    gl.call(26, [DATA]); point(1);
    gl.call(24, [DATA]); point(2);
    gl.call(27, [DATA]); point(3);
    gl.call(23, [f32(0.2), f32(0.4), f32(0.6)]); point(4);
    gl.call(58, [DATA + 32]); point(5);
    gl.call(56, [0, 127, 255, 64]); point(6);
    // glColor3ub: only the low byte of each widened word counts, and alpha
    // returns to 1 after glColor4ub left it at 64/255.
    gl.call(111, [0x1FF, 0x40, 0x80]); point(6.5);
    gl.call(95, [DATA]);
    gl.call(107, [0x84C1, f32(0.375), f32(0.625)]); point(6.75);
    // glMultiTexCoord2fvARB: the same unit-1 coordinate read through a
    // pointer (Soldier of Fortune's lightmap pass).
    gl.call(117, [0x84C1, DATA]); point(6.875);
    gl.call(64, [DATA]);
    gl.call(76, [0xFFFFFFFF]);
    gl.call(25, [f32(0.9), f32(0.8), f32(0.7), f32(0.6)]); point(7);
    gl.call(77); point(8);
    gl.call(21, [0x0004]);
    gl.call(91, [DATA]);
    gl.call(97, [u32(-7), u32(9)]);
    gl.call(31, [DATA]);
    gl.call(22);
    gl.call(11);
  });

  // glTexCoord4f/4fv and glMultiTexCoord4fARB/4fvARB: r and q ride in packed
  // floats 15..18. Every two-component form puts them back to (0, 1), the
  // attribute stack and context switches keep them, and 3/4-component arrays
  // supply them (and DrawArrays restores the caller's afterwards).
  parity('state: projective texture coordinates r and q on both units', (gl, mem) => {
    const view = new DataView(mem.buffer);
    const dataWa = translateGuest(DATA);
    [0.25, 0.5, -1.5, 3].forEach((v, i) => view.setFloat32(dataWa + i * 4, v, true));
    const point = value => {
      gl.call(21, [0]); gl.call(30, [f32(value), f32(2), f32(3)]); gl.call(22);
    };
    gl.call(120, [f32(0.1), f32(0.2), f32(0.3), f32(2.5)]); point(1);
    gl.call(121, [DATA]); point(2);
    gl.call(122, [0x84C1, f32(1), f32(2), f32(-3), f32(4)]); point(3);
    gl.call(123, [0x84C1, DATA]); point(4);
    gl.call(122, [0x84C2, f32(9), f32(9), f32(9), f32(9)]); point(5);  // no unit 2
    gl.call(76, [0xFFFFFFFF]);
    gl.call(28, [f32(0.5), f32(0.5)]); point(6);              // r, q -> 0, 1
    gl.call(107, [0x84C1, f32(0.5), f32(0.5)]); point(7);
    gl.call(77); point(8);                                      // back to 4f state
    gl.call(95, [DATA]); point(9);
    gl.call(117, [0x84C1, DATA]); point(10);
    gl.call(120, [f32(1), f32(1), f32(7), f32(-2)]);
    assert.strictEqual(gl.call(51, [0x4321, 0xC001]), 1); point(11);   // fresh context: defaults
    gl.call(121, [DATA]);
    assert.strictEqual(gl.call(51, [0x1234, 0xC002]), 1); point(12);   // first context's q
    assert.strictEqual(gl.call(51, [0x4321, 0xC001]), 1); point(13);
    const vertex = DATA + 0x100, tex = DATA + 0x200;
    for (let i = 0; i < 3; i++) {
      [i, i + 1, 0].forEach((v, c) => view.setFloat32(translateGuest(vertex) + i * 12 + c * 4, v, true));
      [i / 3, 0.5, i - 1, i + 1].forEach((v, c) => view.setFloat32(translateGuest(tex) + i * 16 + c * 4, v, true));
    }
    gl.call(88, [3, 0x1406, 12, vertex]);
    gl.call(86, [0x8074]); gl.call(86, [0x8078]);
    for (const size of [4, 3, 2]) {
      gl.call(100, [size, 0x1406, 16, tex]);
      gl.call(108, [0x0004, 0, 3]);
    }
    gl.call(106, [0x84C1]); gl.call(100, [4, 0x1406, 16, tex]); gl.call(86, [0x8078]);
    gl.call(108, [0x0004, 0, 3]);
    point(14);                                                  // caller's q restored
    gl.call(11);
  });

  parity('arrays: typed strided client arrays and indexed draw', (gl, mem) => {
    const view = new DataView(mem.buffer);
    const vertex = DATA + 0x100, normal = DATA + 0x200, color = DATA + 0x280;
    const tex0 = DATA + 0x300, tex1 = DATA + 0x380, indices = DATA + 0x400;
    for (let i = 0; i < 4; i++) {
      [i + 0.25, i * -2.5, i + 10.125].forEach((v, c) => view.setFloat64(translateGuest(vertex) + i * 32 + c * 8, v, true));
      [i + 1, -i - 2, i * 3].forEach((v, c) => view.setInt16(translateGuest(normal) + i * 8 + c * 2, v, true));
      [20 + i, 80 + i, 160 + i, 240 - i].forEach((v, c) => view.setUint8(translateGuest(color) + i * 8 + c, v));
      view.setFloat32(translateGuest(tex0) + i * 12, i / 3, true); view.setFloat32(translateGuest(tex0) + i * 12 + 4, 1 - i / 4, true);
      view.setInt8(translateGuest(tex1) + i * 4, i * 20 - 30); view.setInt8(translateGuest(tex1) + i * 4 + 1, 60 - i * 10);
    }
    [2, 0, 3, 1, 2, 3].forEach((v, i) => view.setUint16(translateGuest(indices) + i * 2, v, true));
    gl.call(88, [3, 0x140A, 32, vertex]);
    gl.call(89, [0x1402, 8, normal]);
    gl.call(101, [4, 0x1401, 8, color]);
    gl.call(100, [2, 0x1406, 12, tex0]);
    gl.call(106, [0x84C1]); gl.call(100, [2, 0x1400, 4, tex1]);
    for (const array of [0x8074, 0x8075, 0x8076]) gl.call(86, [array]);
    gl.call(106, [0x84C0]); gl.call(86, [0x8078]);
    gl.call(106, [0x84C1]); gl.call(86, [0x8078]);
    const scalarTypes = [
      [0x1400, 1, 'setInt8'], [0x1401, 1, 'setUint8'],
      [0x1402, 2, 'setInt16'], [0x1403, 2, 'setUint16'],
      [0x1404, 4, 'setInt32'], [0x1405, 4, 'setUint32'],
      [0x1406, 4, 'setFloat32'], [0x140A, 8, 'setFloat64'],
    ];
    scalarTypes.forEach(([type, bytes, setter], typeIndex) => {
      const base = DATA + 0x500 + typeIndex * 0x80;
      const baseWa = translateGuest(base);
      const stride = bytes * 4;
      for (let vertexIndex = 0; vertexIndex < 2; vertexIndex++) {
        for (let component = 0; component < 3; component++) {
          const value = (type === 0x1400 || type === 0x1402 || type === 0x1404)
            ? vertexIndex * 4 + component - 3 : vertexIndex * 4 + component + 1;
          view[setter](baseWa + vertexIndex * stride + component * bytes, value, true);
        }
      }
      gl.call(88, [3, type, stride, base]);
      gl.call(21, [0]); gl.call(87, [0]); gl.call(87, [1]); gl.call(22);
    });
    gl.call(88, [3, 0x140A, 32, vertex]);
    gl.call(102, [0x0004, 6, 0x1403, indices]);
    // glDrawArrays: the same arrays walked from an offset first element, as a
    // strip, plus the degenerate forms that must draw nothing.
    gl.call(108, [0x0005, 1, 3]);
    gl.call(108, [0x0004, 0, 0]);
    gl.call(11);
  });

  parity('generic: pointer copies, borrowed uploads, and query ordering', (gl, mem) => {
    const view = new DataView(mem.buffer);
    const dataWa = translateGuest(DATA);
    for (let i = 0; i < 16; i++) view.setFloat32(dataWa + i * 4, i + 0.25, true);
    new Uint8Array(mem.buffer, translateGuest(DATA + 0x1000), 8 * 8 * 4).fill(0xA7);
    gl.call(10, [0x0BE2]);
    gl.call(34, [DATA]);
    for (let i = 0; i < 16; i++) view.setFloat32(dataWa + i * 4, 99, true);
    gl.call(45, [0x0DE1, 0, 4, 8, 8, 0, 0x1908, 0x1401, DATA + 0x1000]);
    gl.call(45, [0x0DE1, 0, 3, 7, 5, 0, 0x1907, 0x1401, DATA + 0x1000]);
    gl.call(47, [0x0DE1, 0, 1, 2, 6, 4, 0x1907, 0x8363, DATA + 0x1000]);
    gl.call(47, [0x0DE1, 0, 0, 0, 3, 3, 0x80E1, 0x8033, DATA + 0x1000]);
    assert.strictEqual(gl.call(12), 0x504, 'query returns the replay result');
    gl.call(103, [0x84E2, DATA + 0x80]);
    assert.strictEqual(view.getUint32(translateGuest(DATA + 0x80), true), 0xAABBCCDD,
      'query output is visible before its barrier returns');
  });

  parity('generic: canonical 2D float snapshots and raw read barrier', (gl,mem)=>{
    const pointer=DATA+0x1000,pixels=new Float32Array(mem.buffer,translateGuest(pointer),32);
    for(let i=0;i<pixels.length;i++)pixels[i]=(i-4)/8;
    gl.call(158,[0x0DE1,0,0x1908,2,2,0,0x1908,0x1406,pointer]);
    pixels.fill(.75);
    gl.call(159,[0x0DE1,0,1,0,1,2,0x1908,0x1406,pointer]);
    pixels.fill(.25);
    gl.call(160,[2,3,2,1,DATA+0x2000]);
    gl.call(11);
  });

  parity('generic: small texture snapshots survive mutation and remain ordered', (gl,mem)=>{
    const pixels=new Uint8Array(mem.buffer,translateGuest(DATA+0x1000),65536);
    for(const [w,h,format] of [[16,16,0x1908],[128,128,0x80E1],[3,1,0x1908]]){
      pixels.fill(0x37);
      gl.call(47,[0x0DE1,0,0,0,w,h,format,0x1401,DATA+0x1000]);
      pixels.fill(0xA9);
      gl.call(10,[0x0BE2]);
    }
    for(const alignment of [1,2,4,8]){
      gl.call(73,[0x0CF5,alignment]);
      gl.call(47,[0x0DE1,0,0,0,16,16,0x1908,0x1401,DATA+0x1000]);
    }
    gl.call(73,[0x0CF5,4]);
    gl.call(47,[0x0DE1,0,0,0,0,16,0x1908,0x1401,DATA+0x1000]);
    gl.call(47,[0x0DE1,0,0,0,16,16,0x1908,0x1401,0]);
    gl.call(11);
  });

  if(sectionEnabled('generic')){
    a.gl_wat_encoder_reset();activeSubmissions=[];
    const native=watRunner(memory,a),pointer=DATA+0x1000;
    new Uint8Array(memory.buffer,translateGuest(pointer),65536).fill(0x37);
    for(let i=0;i<22;i++)native.call(47,[0x0DE1,0,0,0,16,16,0x1908,0x1401,pointer]);
    assert.strictEqual(activeSubmissions.length,0,'22 small uploads do not force 22 RPC submissions');
    new Uint8Array(memory.buffer,translateGuest(pointer),1024).fill(0xA9);
    native.call(11);
    assert.strictEqual(activeSubmissions.length,1,'explicit finish submits all small uploads together');
    let updates=0;
    Stream.replay({buffer:activeSubmissions[0].buffer,byteOffset:activeSubmissions[0].byteOffset,
      bytes:activeSubmissions[0].length},(opcode,aux,capture)=>{
      if(opcode===47){
        updates++;assert(!capture.pointerBorrowed);
        assert.strictEqual(capture.pointerLength,1024);
        assert(new Uint8Array(capture.buffer,capture.pointerOffset,1024).every(v=>v===0x37),
          'upload snapshot retains bytes from call time');
      }
      return 0;
    });
    assert.strictEqual(updates,22);
    for(const [w,h,format,type] of [[128,128,0x1908,0x1401],[3,1,0x80E1,0x1401]]){
      activeSubmissions=[];native.call(47,[0x0DE1,0,0,0,w,h,format,type,pointer]);
      assert.strictEqual(activeSubmissions.length,0,'threshold/single-row updates copy');
      native.call(11);
    }
    for(const [w,h,format,type] of [[128,129,0x1908,0x1401],[3,2,0x1908,0x1401],
      [16,16,0x1907,0x1401],[16,16,0x1908,0x8033]]){
      activeSubmissions=[];native.call(47,[0x0DE1,0,0,0,w,h,format,type,pointer]);
      assert.strictEqual(activeSubmissions.length,1,'large/padded/unsupported uploads remain synchronous');
    }
    console.log('PASS small texture upload ownership, threshold and submission-count regressions');
  }

  parity('pressure: generic capacity preserves complete ordered records', gl => {
    const records = Math.floor(capacity / 40) + 17;
    for (let i = 0; i < records; i++) gl.call(10, [0x0B00 + (i & 31)]);
    gl.call(11);
  });

  parity('pressure: packed primitives flush only on complete records', gl => {
    const spans = Math.floor(capacity / (Stream.HEADER_BYTES + 3 * Stream.VERTEX_FLOATS * 4)) + 9;
    for (let span = 0; span < spans; span++) {
      gl.call(21, [0x0004]);
      for (let vertex = 0; vertex < 3; vertex++) {
        gl.call(30, [f32(span & 31), f32(vertex), f32(-vertex)]);
      }
      gl.call(22);
    }
    gl.call(11);
  });

  parity('pressure: packed chunk flushes before a partially occupied tail', gl => {
    gl.call(10, [0x0BE2]);
    const chunkVertices = Math.floor((capacity - Stream.HEADER_BYTES)
      / (Stream.VERTEX_FLOATS * 4 * 3)) * 3;
    gl.call(21, [0x0004]);
    for (let vertex = 0; vertex < chunkVertices + 3; vertex++) {
      gl.call(30, [f32(vertex & 255), f32((vertex >> 8) & 255), f32(-vertex)]);
    }
    gl.call(22);
    gl.call(11);
  });

  parity('context: transitions, failure, deletion, and current attributes', gl => {
    assert.strictEqual(gl.call(48, [0x1234], 0x1234), 0xC001);
    assert.strictEqual(gl.call(51, [0x1234, 0xC001]), 1);
    gl.call(25, [f32(0.25), f32(0.5), f32(0.75), f32(1)]);
    gl.call(21, [0]); gl.call(30, [f32(1), f32(2), f32(3)]); gl.call(22);
    assert.strictEqual(gl.call(51, [0x5678, 0xC002]), 1);
    gl.call(21, [0]); gl.call(30, [f32(7), f32(8), f32(9)]); gl.call(22);
    assert.strictEqual(gl.call(51, [0x1234, 0xC001]), 1);
    gl.call(21, [0]); gl.call(30, [f32(10), f32(11), f32(12)]); gl.call(22);
    assert.strictEqual(gl.call(51, [0x9999, 0xC0DE]), 0);
    gl.call(21, [0]); gl.call(30, [f32(13), f32(14), f32(15)]); gl.call(22);
    assert.strictEqual(gl.call(49, [0xDEAD]), 0);
    assert.strictEqual(gl.call(49, [0xC001]), 1);
    gl.call(21, [0]); gl.call(30, [f32(4), f32(5), f32(6)]); gl.call(22);
    gl.call(11);
  });

  parity('hardening: more than sixteen context keys including zero', gl => {
    for (let context = 0; context < 24; context++) {
      assert.strictEqual(gl.call(51, [0x8000 + context, context]), 1);
      gl.call(25, [f32((context + 1) / 32), f32(context / 31), f32(0.5), f32(1)]);
      gl.call(21, [0]); gl.call(30, [f32(context), f32(1), f32(2)]); gl.call(22);
    }
    for (let context = 23; context >= 0; context--) {
      assert.strictEqual(gl.call(51, [0x9000 + context, context]), 1);
      gl.call(21, [0]); gl.call(30, [f32(context), f32(3), f32(4)]); gl.call(22);
    }
    for (let context = 0; context < 24; context++) assert.strictEqual(gl.call(49, [context]), 1);
    gl.call(11);
  });

  parity('hardening: more than sixteen nested attribute frames', gl => {
    for (let depth = 0; depth < 24; depth++) {
      gl.call(76, [0xFFFFFFFF]);
      gl.call(25, [f32((depth + 1) / 25), f32(0.25), f32(0.75), f32(1)]);
    }
    for (let depth = 23; depth >= 0; depth--) {
      gl.call(77);
      gl.call(21, [0]); gl.call(30, [f32(depth), f32(0), f32(0)]); gl.call(22);
    }
    gl.call(11);
  });

  parity('hardening: typed extrema, special doubles, null and unknown pointers', (gl, mem) => {
    const view = new DataView(mem.buffer);
    const vertex = DATA + 0x3000, tex = DATA + 0x3100, color = DATA + 0x3200;
    const vertexWa = translateGuest(vertex), texWa = translateGuest(tex), colorWa = translateGuest(color);
    [NaN, -0, Number.MIN_VALUE].forEach((value, i) => view.setFloat64(vertexWa + i * 8, value, true));
    [NaN, -0].forEach((value, i) => view.setFloat64(texWa + i * 8, value, true));
    gl.call(88, [3, 0x140A, 32, vertex]);
    gl.call(100, [2, 0x140A, 24, tex]);
    gl.call(86, [0x8074]); gl.call(86, [0x8078]);
    const colorCases = [
      [0x1400, 1, 'setInt8', [-128, -127, 0, 127]],
      [0x1402, 2, 'setInt16', [-32768, -32767, 0, 32767]],
      [0x1404, 4, 'setInt32', [-2147483648, -2147483647, 0, 2147483647]],
      [0x1405, 4, 'setUint32', [0, 1, 0x80000000, 0xFFFFFFFF]],
    ];
    for (const [type, bytes, setter, values] of colorCases) {
      values.forEach((value, i) => view[setter](colorWa + i * bytes, value, true));
      gl.call(101, [4, type, 0, color]); gl.call(86, [0x8076]);
      gl.call(21, [0]); gl.call(87, [0]); gl.call(22);
    }
    // An unsupported vertex type and a disabled/unset pointer emit no vertex.
    gl.call(88, [3, 0xDEAD, 0, vertex]);
    gl.call(21, [0]); gl.call(87, [0]); gl.call(22);
    gl.call(99, [0x8074]);
    gl.call(21, [0]); gl.call(87, [0]); gl.call(22);
    // Pointer zero is distinct from no pointer: once configured and enabled it
    // translates through the same sparse/direct guest map as every other pointer.
    const nullWa = translateGuest(0);
    view.setFloat32(nullWa, 1.25, true); view.setFloat32(nullWa + 4, -0, true);
    view.setFloat32(nullWa + 8, Number.MIN_VALUE, true);
    gl.call(88, [3, 0x1406, 0, 0]); gl.call(86, [0x8074]);
    gl.call(21, [0]); gl.call(87, [0]); gl.call(22);
    gl.call(11);
  });

  parity('boundary: vector widths do not eagerly overread memory end', (gl, mem) => {
    const view = new DataView(mem.buffer);
    const colorWa = mem.buffer.byteLength - 12;
    const vertexWa = mem.buffer.byteLength - 8;
    const colorGuest = 0xFFF0000C;
    const vertexGuest = 0xFFF00008;
    [0.125, 0.5, 0.875].forEach((value, i) => view.setFloat32(colorWa + i * 4, value, true));
    gl.call(24, [colorGuest]);
    gl.call(21, [0]); gl.call(30, [f32(1), f32(2), f32(3)]); gl.call(22);
    view.setFloat32(vertexWa, -1.25, true); view.setFloat32(vertexWa + 4, 2.5, true);
    gl.call(21, [0]); gl.call(91, [vertexGuest]); gl.call(22);
    // The direct stack contract includes return address + exactly two args.
    // Placing that frame at the end catches a speculative third f32 load.
    gl.call(21, [0]);
    gl.callAt(29, [f32(3.25), f32(-4.5)], mem.buffer.byteLength - 12);
    gl.call(22); gl.call(11);
  });

  if (sectionEnabled('errors')) {
    const invalidCases = [
      ['nested glBegin', gl => { gl.call(21, [0x0004]); gl.call(21, [0x0004]); }],
      ['generic command inside glBegin', gl => { gl.call(21, [0x0004]); gl.call(10, [0x0BE2]); }],
      ['glShadeModel inside glBegin', gl => { gl.call(21, [0x0004]); gl.call(19, [0x1D00]); }],
      ['unknown opcode', gl => gl.call(999, [])],
      ['64-bit texture byte overflow', gl => gl.call(45,
        [0x0DE1, 0, 4, 0x80000000, 0x80000000, 0, 0x1908, 0x1401, DATA])],
      ['glDeleteTextures count shift overflow', gl => gl.call(43, [0x40000000, DATA])],
    ];
    for (const [label, action] of invalidCases) {
      const expected = [];
      const oracle = jsRunner(memory, capacity, expected, translateGuest);
      assert.throws(() => action(oracle), RangeError, `${label}: JS oracle rejects invalid input`);
      a.gl_wat_encoder_reset(); activeSubmissions = [];
      assert.throws(() => action(watRunner(memory, a)), WebAssembly.RuntimeError,
        `${label}: native encoder traps invalid input`);
      a.gl_wat_encoder_reset();
      console.log(`PASS errors: ${label}`);
    }
  }

  // Reset and per-instance state are observable in packed vertices. Interleave
  // two instances over one SharedArrayBuffer and compare each flush separately.
  if (sectionEnabled('isolation')) {
  a.gl_wat_encoder_reset(); b.gl_wat_encoder_reset();
  const expectedA = [], expectedB = [];
  const jsA = jsRunner(memory, capacity, expectedA, translateGuest);
  const jsB = jsRunner(memory, capacity, expectedB, translateGuest);
  const emitPoint = (runner, red) => {
    runner.call(25, [f32(red), f32(0), f32(0), f32(1)]);
    runner.call(21, [0]); runner.call(30, [f32(red), f32(2), f32(3)]); runner.call(22);
    runner.call(11);
  };
  emitPoint(jsA, 0.25); emitPoint(jsB, 0.75);
  activeSubmissions = []; emitPoint(watRunner(memory, a), 0.25);
  const actualA = activeSubmissions.slice();
  activeSubmissions = []; emitPoint(watRunner(memory, b), 0.75);
  compareSubmissions('thread/context instance A', expectedA, actualA);
  compareSubmissions('thread/context instance B', expectedB, activeSubmissions);
  a.gl_wat_encoder_reset();
  const resetExpected = [], resetOracle = jsRunner(memory, capacity, resetExpected, translateGuest);
  const emitDefaultPoint = runner => {
    runner.call(76, [0xFFFFFFFF]);
    runner.call(25, [f32(0.875), f32(0.5), f32(0.25), f32(1)]);
    runner.call(77);
    runner.call(21, [0]); runner.call(30, [f32(1), f32(2), f32(3)]); runner.call(22);
    runner.call(11);
  };
  emitDefaultPoint(resetOracle);
  const resetNative = watRunner(memory, a);
  resetNative.call(51, [0x1111, 1]);
  resetNative.call(76, [0xFFFFFFFF]);
  resetNative.call(25, [f32(0.125), f32(0.25), f32(0.5), f32(0.75)]);
  resetNative.call(51, [0x2222, 0]);
  resetNative.call(51, [0x1111, 1]);
  a.gl_wat_encoder_reset();
  activeSubmissions = []; emitDefaultPoint(resetNative);
  compareSubmissions('reset restores default isolated state', resetExpected, activeSubmissions);
  console.log('PASS reset plus shared-memory instance isolation');
  }
  if (sectionEnabled('pool')) {
    for (const failAt of [0, 3, 4, -1]) {
      const poolMemory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
      const published = [], poolImports = { host: { ...imports.host, memory: poolMemory } };
      let rejectNext = false;
      poolImports.host.gpu_gl_call = (opcode, base, length) => {
        assert.strictEqual(opcode, STREAM_CALL);
        if (rejectNext) { rejectNext = false; throw new Error('test rejected publication'); }
        published.push({ base, length, bytes: Buffer.from(new Uint8Array(poolMemory.buffer, base, length)) });
        return 700 + published.length;
      };
      const e = new WebAssembly.Instance(module_, poolImports).exports;
      e.init_thread(0, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x420000);
      assert.strictEqual(e.gl_wat_stream_pool_version(), 1);
      assert.strictEqual(e.gl_wat_stream_pool_enable(2), 0);
      assert.strictEqual(e.gl_wat_stream_pool_enable(-1), 0);
      assert.strictEqual(e.gl_wat_stream_pool_base(0), 0);
      assert.strictEqual(e.gl_wat_stream_pool_base(3), 0);
      assert.strictEqual(e.gl_wat_stream_pool_base(-1), 0);
      if (failAt !== -1) assert.strictEqual(e.gl_wat_stream_pool_enable(1), 1);
      e.test_pool_fail_at(Math.max(0, failAt));
      const gl = watRunner(poolMemory, e);
      gl.call(10, [0x0BE2]);
      const bases = [0, 1, 2].map(i => e.gl_wat_stream_pool_base(i) >>> 0);
      const pooled = failAt === 0;
      assert(bases[0]);
      assert.strictEqual(new Set(bases.filter(Boolean)).size, pooled ? 3 : 1);
      assert.strictEqual(e.gl_wat_stream_pool_enable(0), 0, 'cannot disable a live pool');
      assert.strictEqual(e.gl_wat_stream_pool_enable(1), 0, 'cannot reconfigure after allocation');
      if (pooled) {
        const sorted = bases.slice().sort((x, y) => x - y);
        for (let i = 1; i < sorted.length; i++) assert(sorted[i - 1] + capacity <= sorted[i], 'pool buffers disjoint');
      } else assert.deepStrictEqual(bases.slice(1), [0, 0], 'partial pool is never published');
      const allocations = e.test_pool_alloc_count();
      assert.strictEqual(allocations, failAt === -1 ? 2 : failAt || 4);
      assert.strictEqual(e.test_pool_free_count(), failAt === 4 ? 1 : 0, 'failed second extra frees the first');
      for (let i = 0; i < 4; i++) {
        if (i) gl.call(10, [0x0BE2 + i]);
        if (pooled && i === 2) {
          for (const previous of published) assert.deepStrictEqual(
            Buffer.from(new Uint8Array(poolMemory.buffer, previous.base, previous.length)), previous.bytes,
            'two published buffers remain intact while writing the third');
        }
        assert.strictEqual(gl.flush(), 701 + i, 'flush preserves host result');
        assert.strictEqual(published[i].base, bases[pooled ? i % 3 : 0]);
        assert.strictEqual(e.gl_wat_stream_base() >>> 0, bases[pooled ? (i + 1) % 3 : 0]);
        const next = e.gl_wat_stream_base();
        assert.strictEqual(gl.flush(), 0, 'empty flush does not publish or rotate');
        assert.strictEqual(e.gl_wat_stream_base(), next);
      }
      const next = e.gl_wat_stream_base();
      e.gl_wat_encoder_reset();
      assert.strictEqual(e.gl_wat_stream_base(), next, 'reset does not rewind to a possibly leased buffer');
      assert.deepStrictEqual([0, 1, 2].map(i => e.gl_wat_stream_pool_base(i) >>> 0), bases);
      gl.call(10, [0x0B71]); rejectNext = true;
      assert.throws(() => gl.flush(), /rejected publication/);
      assert.strictEqual(e.gl_wat_stream_base(), next, 'failed publication does not rotate');
      assert(e.gl_wat_stream_used() > 0, 'failed publication retains pending bytes');
      gl.flush();
      assert.strictEqual(e.test_pool_alloc_count(), allocations, 'OOM fallback and reset do not retry allocations');
      assert.strictEqual(e.test_pool_free_count(), failAt === 4 ? 1 : 0, 'published allocations are not freed');
    }
    console.log('PASS triple stream pool rotation, retained bytes, strict configuration, OOM rollback, reset and rejected publication');
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
