'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const apis = require('../src/api_table.json');
const extraWat = String.raw`
 (func (export "output") (param $buf i32) (result i32)
   (call $d3dim_execbuf_output_guest (local.get $buf) (i32.const 0)))
 (func (export "device") (result i32)
   (local $p i32) (local $s i32)
   (local.set $p (call $dx_create_com_obj (i32.const 20) (global.get $DX_VTBL_D3DDEV1)))
   (local.set $s (call $heap_alloc (i32.const 4096)))
   (call $d3ddev_init_state (local.get $s))
   (i32.store offset=16 (call $dx_from_this (local.get $p)) (local.get $s))
   (local.get $p))
 (func (export "viewport") (result i32)
   (call $dx_create_com_obj (i32.const 23) (global.get $DX_VTBL_D3DVP1)))
 (func (export "state") (param $p i32) (result i32) (call $d3ddev_state (local.get $p)))
 (func (export "extent_rt") (result i32) (global.get $d3dim_exec_extent_rt))
 (func (export "extent_scope") (result i32) (global.get $d3dim_exec_extent_guest))
 (func (export "set_extent_scope") (param $rect i32) (param $dev i32)
   (global.set $d3dim_exec_extent_guest (local.get $rect))
   (global.set $d3dim_exec_extent_rt (call $d3ddev_rt_entry (local.get $dev))))
 (func (export "outside_draw") (param $dev i32)
   (call $viewport_fill_rect (call $d3ddev_rt_entry (local.get $dev))
     (i32.const 25) (i32.const 25) (i32.const 2) (i32.const 2) (i32.const 0xffffff)))
 (func (export "unit_viewport") (param $p i32)
   (local $s i32)
   (local.set $s (call $g2w (call $d3ddev_state (local.get $p))))
   (f32.store (i32.add (local.get $s) (global.get $D3DIM_OFF_VP_SCALE)) (f32.const 1))
   (f32.store offset=4 (i32.add (local.get $s) (global.get $D3DIM_OFF_VP_SCALE)) (f32.const 1))
   (i64.store (i32.add (local.get $s) (global.get $D3DIM_OFF_VP_ORIGIN)) (i64.const 0)))
 (func (export "buffer") (param $p i32) (param $buf i32)
   (store.field DxObject misc0 (call $dx_from_this (local.get $p)) (local.get $buf)))
 (func (export "matrix") (param $n i32) (result i32)
   (i32.add (global.get $D3DIM_MATRICES) (i32.mul (local.get $n) (i32.const 64))))
 (func (export "ddraw") (result i32)
   (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
 (func (export "target") (param $dev i32) (param $surf i32) (result i32)
   (call $d3dim_set_render_target (local.get $dev) (local.get $surf))
   (i32.load offset=20 (call $dx_from_this (local.get $surf))))
 (func (export "invoke") (param $id i32) (param $sp i32) (param $a i32) (param $b i32) (param $c i32) (result i32)
   (i32.store offset=16 (global.get $reg_base) (local.get $sp))
   (call $dispatch_api_table (local.get $id) (local.get $a) (local.get $b) (local.get $c)
     (i32.const 0) (i32.const 0) (i32.const 0))
   (i32.load (global.get $reg_base)))
`;
(async () => {
  const trace = [];
  let queuedGpuDraws = null;
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none',
    extraHostOverrides: {
      dx_trace: (...args) => { if (args[0] === 7) trace.push(args.slice(1)); },
      gpu_gl_call: (opcode, descriptor) => {
        if (!queuedGpuDraws) return 0;
        if (opcode === 0x20000) queuedGpuDraws.push(descriptor);
        return 1; // Acceptance only: replay has a different instance's globals.
      },
    } });
  e.init_dx_com_thunks();
  const dev = e.device(), state = e.state(dev), sp = e.guest_alloc(128);
  const desc = e.guest_alloc(20), out = e.guest_alloc(48), data = e.guest_alloc(48);
  const size = 24576, regular = e.guest_alloc(size), base = 0x40000000;
  for (let page = 0; page < 7; page++) {
    e.test_virtual_map_commit(base + page * 4096, 4096);
    e.test_virtual_map_commit(base + 0x10000 + page * 4096, 4096);
    for (let i = 0; i < 4096; i++) e.guest_write8(base + 0x10000 + page * 4096 + i, 0xa7);
  }
  assert.notStrictEqual(e.guest_to_wasm(base + 4096), e.guest_to_wasm(base) + 4096);
  const call = (name, pop, a, b = 0, c = 0) => {
    e.guest_write32(sp + pop, 0xdeadbeef);
    assert.strictEqual(e.invoke(apis.find(api => api.name === name).id, sp, a, b, c) >>> 0, 0, name);
    assert.strictEqual(e.get_esp(), sp + pop);
    assert.strictEqual(e.guest_read32(sp + pop) >>> 0, 0xdeadbeef);
  };
  [20, 1, 0, size, 0].forEach((v, i) => e.guest_write32(desc + i * 4, v));
  call('IDirect3DDevice_CreateExecuteBuffer', 20, dev, desc, out);
  const eb = e.guest_read32(out);
  call('IDirect3DExecuteBuffer_Lock', 12, eb, desc);
  const ownedBuffer = e.guest_read32(desc + 16);
  const words = [], expectedTrace = [];
  function op(code, stride, records) {
    expectedTrace.push([code, stride, records.length, words.length * 4]);
    words.push(code | (stride << 8) | (records.length << 16), ...records.flat());
  }
  op(4, 8, [[2, 1], [3, 2]]);
  op(5, 12, [[4, 2, 3]]);
  op(6, 8, [[1, 4]]);
  op(7, 8, [[2, 0x11223344], [3, 0x55667788]]);
  op(8, 8, [[8, 1], [9, 2]]);
  op(9, 16, [[2, 2 << 16, 1, 0]]); // COPY vertex 0 to vertex 2.
  op(12, 16, [[0, 0, 0, 32]]); // Skip the following render-state instruction.
  words.push(8 | (8 << 8) | (1 << 16), 8, 99);
  op(14, 24, [[1, 0xabcdef01, 11, 22, 33, 44]]);
  op(12, 16, [[0, 1, 0, 0]]); // Untaken branch.
  op(11, 0, []);
  words.push(0); // Padding keeps the pre-existing end-of-range policy out of this test.
  const stream = Buffer.alloc(words.length * 4);
  words.forEach((v, i) => stream.writeUInt32LE(v >>> 0, i * 4));
  function run(buf, offset, bytes = stream, large = false) {
    e.buffer(eb, buf);
    for (let i = 0; i < 96; i++) e.guest_write8(buf + i, i < 32 ? i + 1 : 0xcc);
    for (let i = -4; i < bytes.length + 4; i++) e.guest_write8(buf + offset + i, 0xcc);
    for (let i = 0; i < bytes.length; i++) e.guest_write8(buf + offset + i, bytes[i]);
    const matrices = new Float32Array(memory.buffer, e.matrix(0), 64);
    matrices.fill(0);
    for (let i = 0; i < 4; i++) matrices[i * 5] = 2;
    [48, 0, 3, offset, bytes.length, 0, 0, 0, 0, 0, 0, 0].forEach((v, i) => e.guest_write32(data + i * 4, v));
    call('IDirect3DExecuteBuffer_SetExecuteData', 12, eb, data);
    call('IDirect3DExecuteBuffer_Unlock', 8, eb);
    e.guest_write32(state + 288, 0);
    trace.length = 0;
    const cursor = e.guest_span_cursor_bytes(), overflow = e.guest_span_overflow_count();
    call('IDirect3DDevice_Execute', 20, dev, eb);
    assert.strictEqual(e.guest_read32(state + 288), large ? 2199 : 1, `render state at offset=${offset}`);
    if (!large) {
      assert.strictEqual(e.guest_read32(state + 292), 2);
      assert.strictEqual(e.guest_read32(state + 2312) >>> 0, 0x11223344);
      assert.strictEqual(e.guest_read32(state + 2316) >>> 0, 0x55667788);
      for (let i = 0; i < 16; i++) {
        assert.strictEqual(matrices[48 + i], i % 5 === 0 ? 4 : 0);
        assert.strictEqual(new Float32Array(memory.buffer, e.guest_to_wasm(state), 16)[i], matrices[48 + i]);
      }
      for (let i = 0; i < 32; i++) {
        assert.strictEqual(e.guest_read8(e.output(buf) + 64 + i), i + 1, 'COPY driver output');
        assert.strictEqual(e.guest_read8(buf + 64 + i), 0xcc, 'COPY preserves application source');
      }
      call('IDirect3DExecuteBuffer_GetExecuteData', 12, eb, out);
      [1, 0xabcdef01, 0, 0, 0, 0].forEach((v, i) => assert.strictEqual(e.guest_read32(out + 24 + i * 4) >>> 0, v));
      assert.deepStrictEqual(trace, expectedTrace.map(([code, stride, n, rel]) => [code, stride, n, offset + rel]));
    }
    for (let i = 0; i < bytes.length; i++) assert.strictEqual(e.guest_read8(buf + offset + i), bytes[i], 'instructions unchanged');
    for (let i = 1; i <= 4; i++) assert.strictEqual(e.guest_read8(buf + offset - i), 0xcc);
    for (let i = 0; i < 4; i++) assert.strictEqual(e.guest_read8(buf + offset + bytes.length + i), 0xcc);
    assert.strictEqual(e.guest_span_cursor_bytes(), cursor);
    assert.strictEqual(e.guest_span_overflow_count(), overflow);
  }
  run(regular, 256);
  // Move the page boundary across every instruction header and record byte.
  for (let split = 1; split < stream.length; split++) run(base + 64, 4096 - 64 - split);
  const large = Buffer.alloc(4 + 2200 * 8 + 4);
  large.writeUInt32LE(8 | (8 << 8) | (2200 << 16));
  for (let i = 0; i < 2200; i++) { large.writeUInt32LE(8, 4 + i * 8); large.writeUInt32LE(i, 8 + i * 8); }
  large.writeUInt32LE(11, large.length - 4);
  run(base + 64, 256, large, true); // No whole-group 16KiB scratch limit.
  let branchCases = 0;
  // Status comes either from SetExecuteData or an executed SETSTATUS record.
  // Use a high bit and noncanonical TRUE to catch signed/boolean shortcuts.
  for (const status of [0, 0x80000000, 0xa5a55a5a, 0xffffffff])
    for (const mask of [0, 0x80000000, 0xff, 0xffffffff])
      for (const value of [0, 0x80000000, 0x5a, 0xffffffff])
        for (const negate of [0, 1, 2]) for (const seedOpcode of [false, true])
          for (const split of [0, 7, 17]) {
            const buf = split ? base + 64 : regular;
            const offset = split ? 4096 - 64 - split : 256;
            e.buffer(eb, buf);
            const branchWords = seedOpcode ? [14 | (24 << 8) | (1 << 16), 1, status, 0, 0, 0, 0] : [];
            branchWords.push(12 | (16 << 8) | (1 << 16), mask, value, negate, 32,
              8 | (8 << 8) | (1 << 16), 8, 7, 11, 0);
            branchWords.forEach((v, i) => e.guest_write32(buf + offset + i * 4, v));
            // Unlock ensures the existing per-buffer status owner before seeding.
            call('IDirect3DExecuteBuffer_Unlock', 8, eb);
            [48, 0, 0, offset, branchWords.length * 4, 0, 1, seedOpcode ? 0 : status, 0, 0, 0, 0]
              .forEach((v, i) => e.guest_write32(data + i * 4, v));
            call('IDirect3DExecuteBuffer_SetExecuteData', 12, eb, data);
            e.guest_write32(state + 288, 0);
            call('IDirect3DDevice_Execute', 20, dev, eb);
            const equal = ((status & mask) >>> 0) === value;
            const taken = negate ? !equal : equal;
            assert.strictEqual(e.guest_read32(state + 288), taken ? 0 : 7,
              `branch status=${status} mask=${mask} value=${value} negate=${negate} opcode=${seedOpcode} split=${split}`);
            call('IDirect3DExecuteBuffer_GetExecuteData', 12, eb, out);
            assert.strictEqual(e.guest_read32(out + 28) >>> 0, status, 'branch preserves status');
            branchCases++;
          }
  let multiCases = 0;
  // First, middle, last and no matching branch; distinct destinations make
  // first-match ordering observable. Also cover taken zero-offset termination.
  for (const count of [0, 1, 3]) for (const match of [-1, 0, 1, 2])
    for (const terminate of [false, true]) for (const split of [0, 7, 23, 39]) {
      if (match >= count) continue;
      const buf = split ? base + 64 : regular;
      const offset = split ? 4096 - 64 - split : 256;
      const program = [12 | (16 << 8) | (count << 16)];
      const destinations = 4 + count * 16;
      for (let i = 0; i < count; i++) program.push(0xffffffff, i >= match && match >= 0 ? 5 : 6, 0,
        terminate ? 0 : destinations + (i + 1) * 16);
      // Four independently observable write-and-exit destinations.
      for (let i = 0; i < 4; i++) program.push(8 | (8 << 8) | (1 << 16), 8, i + 1, 11);
      program.push(0);
      e.buffer(eb, buf);
      program.forEach((v, i) => e.guest_write32(buf + offset + i * 4, v));
      call('IDirect3DExecuteBuffer_Unlock', 8, eb);
      [48, 0, 0, offset, program.length * 4, 0, 1, 5, 0, 0, 0, 0]
        .forEach((v, i) => e.guest_write32(data + i * 4, v));
      call('IDirect3DExecuteBuffer_SetExecuteData', 12, eb, data);
      e.guest_write32(state + 288, 0);
      call('IDirect3DDevice_Execute', 20, dev, eb);
      assert.strictEqual(e.guest_read32(state + 288), match < 0 ? 1 : terminate ? 0 : match + 2,
        `multi branch count=${count} match=${match} terminate=${terminate} split=${split}`);
      multiCases++;
    }
  for (const count of [0, 1, 3]) for (const split of [0, 7, 29, 53]) {
    const buf = split ? base + 64 : regular;
    const offset = split ? 4096 - 64 - split : 256;
    const program = [14 | (24 << 8) | (count << 16)];
    for (let i = 0; i < count; i++) program.push(1, 0x100 + i, 0, 0, 0, 0);
    program.push(11, 0);
    e.buffer(eb, buf);
    program.forEach((v, i) => e.guest_write32(buf + offset + i * 4, v));
    call('IDirect3DExecuteBuffer_Unlock', 8, eb);
    [48, 0, 0, offset, program.length * 4, 0, 1, 5, 0, 0, 0, 0]
      .forEach((v, i) => e.guest_write32(data + i * 4, v));
    call('IDirect3DExecuteBuffer_SetExecuteData', 12, eb, data);
    call('IDirect3DDevice_Execute', 20, dev, eb);
    call('IDirect3DExecuteBuffer_GetExecuteData', 12, eb, out);
    assert.strictEqual(e.guest_read32(out + 28), count ? 0x100 + count - 1 : 5, `status count=${count} split=${split}`);
    multiCases++;
  }
  // Extents-only/no-op SETSTATUS must not change what a subsequent branch sees.
  let statusFlagCases = 0;
  for (const flags of [0, 1, 2, 3]) for (const split of [0, 7, 17, 27]) {
    const buf = split ? base + 64 : regular, offset = split ? 4096 - 64 - split : 256;
    const program = [14 | (24 << 8) | (1 << 16), flags, 0, 101, 102, 103, 104,
      12 | (16 << 8) | (1 << 16), 0xff, 0x55, 0, 0,
      8 | (8 << 8) | (1 << 16), 8, 123, 11, 0];
    e.buffer(eb, buf);
    program.forEach((v, i) => e.guest_write32(buf + offset + i * 4, v));
    [48, 0, 0, offset, program.length * 4, 0, 3, 0x55, 11, 22, 33, 44]
      .forEach((v, i) => e.guest_write32(data + i * 4, v));
    call('IDirect3DExecuteBuffer_SetExecuteData', 12, eb, data);
    e.guest_write32(state + 288, 0);
    call('IDirect3DDevice_Execute', 20, dev, eb);
    call('IDirect3DExecuteBuffer_GetExecuteData', 12, eb, out);
    assert.strictEqual(e.guest_read32(out + 28), flags & 1 ? 0 : 0x55, 'selected status');
    assert.strictEqual(e.guest_read32(state + 288), flags & 1 ? 123 : 0, 'selected status drives branch');
    (flags & 2 ? [101, 102, 103, 104] : [11, 22, 33, 44]).forEach((v, i) =>
      assert.strictEqual(e.guest_read32(out + 32 + i * 4), v, 'selected extent payload'));
    statusFlagCases++;
  }
  console.log(`PASS SETSTATUS field selection: ${statusFlagCases} public branch cases`);
  // Real render target: vary instruction and vertex crossings independently.
  const surfaceDesc = e.guest_alloc(128);
  for (let i = 0; i < 128; i++) e.guest_write8(surfaceDesc + i, 0);
  for (const [off, value] of [[0, 108], [4, 0x1007], [8, 32], [12, 32],
    [72, 32], [76, 0x40], [84, 16], [88, 0xf800], [92, 0x7e0], [96, 0x1f], [104, 0x40]])
    e.guest_write32(surfaceDesc + off, value);
  call('IDirectDraw_CreateSurface', 20, e.ddraw(), surfaceDesc, out);
  const dib = e.target(dev, e.guest_read32(out));
  const pixels = new Uint8Array(memory.buffer, dib, 32 * 32 * 2);
  const bits = value => new Uint32Array(new Float32Array([value]).buffer)[0];
  let primitiveCases = 0;
  let vertexCases = 0;
  for (const [code, stride, records] of [[1, 4, [1, 0x00010001]],
    [2, 4, [0x00010000, 0x00020001]], [3, 8, [0, 0, 0x00010000, 2]]]) {
    const primitive = [code | (stride << 8) | (2 << 16), ...records, 11, 0];
    function draw(buf, offset, fill = 1, visible = 7) {
      e.buffer(eb, buf);
      [[2, 2], [20, 2], [2, 20]].forEach(([x, y], i) => {
        [bits(x), bits(y), bits(0.5), bits(visible & (1 << i) ? 1 : -1), 0xffff0000, 0, 0, 0]
          .forEach((v, j) => e.guest_write32(buf + i * 32 + j * 4, v));
      });
      primitive.forEach((v, i) => e.guest_write32(buf + offset + i * 4, v));
      [48, 0, 3, offset, primitive.length * 4, 0, 3, 0, 2048, 2048, 0, 0]
        .forEach((v, i) => e.guest_write32(data + i * 4, v));
      call('IDirect3DExecuteBuffer_SetExecuteData', 12, eb, data);
      e.guest_write32(state + 288, fill);
      const before = Array.from({ length: 96 }, (_, i) => e.guest_read8(buf + i));
      const cursor = e.guest_span_cursor_bytes(), overflow = e.guest_span_overflow_count();
      pixels.fill(0);
      call('IDirect3DDevice_Execute', 20, dev, eb);
      assert.deepStrictEqual(Array.from({ length: 96 }, (_, i) => e.guest_read8(buf + i)), before, 'vertices unchanged');
      call('IDirect3DExecuteBuffer_GetExecuteData', 12, eb, out);
      const bounds = [2048, 2048, 0, 0];
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (pixels[y * 64 + x * 2] || pixels[y * 64 + x * 2 + 1]) {
        bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
        bounds[2] = Math.max(bounds[2], x + 1); bounds[3] = Math.max(bounds[3], y + 1);
      }
      assert.deepStrictEqual(Array.from({ length: 4 }, (_, i) => e.guest_read32(out + 32 + i * 4)), bounds,
        `opaque raster extent code=${code} fill=${fill} visible=${visible}`);
      assert.strictEqual(e.guest_span_cursor_bytes(), cursor, 'primitive spans released');
      assert.strictEqual(e.guest_span_overflow_count(), overflow);
      return Buffer.from(pixels);
    }
    const expected = draw(regular, 256);
    assert(expected.some(byte => byte !== 0), `opcode ${code} rendered`);
    for (let split = 1; split < primitive.length * 4; split++) {
      assert.deepStrictEqual(draw(base + 64, 4096 - 64 - split), expected, `opcode=${code} split=${split}`);
      primitiveCases++;
    }
    for (const fill of code === 3 ? [1, 2, 3] : [1]) {
      for (const visible of code === 3 ? [0, 1, 2, 3, 4, 5, 6, 7] : [7]) {
        const control = draw(regular, 256, fill, visible);
        if (visible === 7) assert(control.some(byte => byte !== 0), `opcode=${code} fill=${fill} rendered`);
        for (let split = 1; split < 96; split++) {
          assert.deepStrictEqual(draw(base + 4096 - split, 256, fill, visible), control,
            `vertex opcode=${code} fill=${fill} visible=${visible} split=${split}`);
          vertexCases++;
        }
      }
    }
  }
  // Globe seeds DEFAULT, transforms vertices, then exits if a common clip plane remains.
  // Exercise the public stream/status/branch contract, not only projected coordinates.
  let clipCases = 0;
  const inside = [0, 0, 0.5];
  const outside = [[-2, 0, 0.5], [2, 0, 0.5], [0, 2, 0.5], [0, -2, 0.5], [0, 0, -1], [0, 0, 2]];
  const clips = [{ vertices: [inside], union: 0, intersection: 0 },
    { vertices: [], union: 0, intersection: 63 }];
  outside.forEach((v, plane) => {
    clips.push({ vertices: [v, v], union: 1 << plane, intersection: 1 << plane });
    clips.push({ vertices: [v, inside], union: 1 << plane, intersection: 0 });
  });
  clips.push({ vertices: outside, union: 63, intersection: 0 });
  clips.push({ vertices: [[1.5, 0, 0.5]], w: 2, union: 0, intersection: 0 });
  clips.push({ vertices: [inside], w: -1, union: 47, intersection: 47 });
  clips.push({ vertices: [[0.0001, 0, 0.000005]], w: 0.00001, union: 2, intersection: 2 });
  for (const buf of [regular, base + 4090, base + 4030]) for (const mode of [0, 1, 2]) for (const grouped of [false, true]) {
    for (const { vertices, union, intersection, w = 1 } of clips) {
      e.buffer(eb, buf);
      const matrices = new Float32Array(memory.buffer, e.guest_to_wasm(state), 48);
      matrices.fill(0);
      for (let matrix = 0; matrix < 3; matrix++) for (let axis = 0; axis < 4; axis++)
        matrices[matrix * 16 + axis * 5] = 1;
      matrices[47] = w;
      vertices.forEach((v, i) => {
        const f = new Float32Array([...v, 0, 0, 1, 0, 0]);
        new Uint32Array(f.buffer).forEach((word, j) => e.guest_write32(buf + i * 32 + j * 4, word));
      });
      const instructions = [14 | (24 << 8) | (1 << 16), 1, 0x01fff000, 0, 0, 0, 0,
        9 | (16 << 8) | ((grouped ? 1 : vertices.length) << 16)];
      if (grouped) instructions.push(mode, 8 << 16, vertices.length, 0);
      else vertices.forEach((_, i) => instructions.push(mode, i | ((i + 8) << 16), 1, 0));
      instructions.push(12 | (16 << 8) | (1 << 16), 0x3f000, 0, 1, 0,
        8 | (8 << 8) | (1 << 16), 8, 123, 11, 0);
      instructions.forEach((v, i) => e.guest_write32(buf + 512 + i * 4, v));
      [48, 0, vertices.length, 512, instructions.length * 4, 0, 0, 0, 0, 0, 0, 0]
        .forEach((v, i) => e.guest_write32(data + i * 4, v));
      call('IDirect3DExecuteBuffer_SetExecuteData', 12, eb, data);
      call('IDirect3DExecuteBuffer_Unlock', 8, eb);
      e.guest_write32(state + 288, 0);
      const cursor = e.guest_span_cursor_bytes(), overflow = e.guest_span_overflow_count();
      call('IDirect3DDevice_Execute', 20, dev, eb);
      e.guest_write32(out, 48);
      call('IDirect3DExecuteBuffer_GetExecuteData', 12, eb, out);
      const expected = mode === 2 ? 0x01fff000 : 0x01fc0000 | union | (intersection << 12);
      assert.strictEqual(e.guest_read32(out + 28) >>> 0, expected >>> 0,
        `clip status mode=${mode} vertices=${JSON.stringify(vertices)} buf=${buf.toString(16)}`);
      assert.strictEqual(e.guest_read32(state + 288), (expected & 0x3f000) ? 0 : 123, 'clip branch');
      assert.strictEqual(e.guest_span_cursor_bytes(), cursor);
      assert.strictEqual(e.guest_span_overflow_count(), overflow);
      clipCases++;
    }
  }
  console.log(`PASS Execute clip status: ${clipCases} public stream/status/branch cases`);
  const outerRect = e.guest_alloc(16);
  // GPU callback updates the current Execute owner only. Inactive, wrong-RT,
  // and empty rectangles cannot mutate status or a later caller's rectangle.
  [2048, 2048, 0, 0].forEach((v, i) => e.guest_write32(outerRect + i * 4, v));
  const gpuRect = () => Array.from({length: 4}, (_, i) => e.guest_read32(outerRect + i * 4) | 0);
  e.d3dim_gpu_extent(0, 1, 2, 8, 9);
  assert.deepStrictEqual(gpuRect(), [2048, 2048, 0, 0]);
  e.set_extent_scope(outerRect, dev);
  const gpuRT = e.extent_rt();
  assert(gpuRT, 'real render target owns GPU coverage');
  e.d3dim_gpu_extent(gpuRT + 32, 1, 2, 8, 9);
  e.d3dim_gpu_extent(gpuRT, 1, 2, 1, 9);
  assert.deepStrictEqual(gpuRect(), [2048, 2048, 0, 0]);
  e.d3dim_gpu_extent(gpuRT, 3, 4, 8, 9);
  e.d3dim_gpu_extent(gpuRT, 2, 6, 10, 7);
  assert.deepStrictEqual(gpuRect(), [2, 4, 10, 9]);
  e.set_extent_scope(0, dev);
  e.d3dim_gpu_extent(gpuRT, 0, 0, 32, 32);
  assert.deepStrictEqual(gpuRect(), [2, 4, 10, 9]);
  console.log('PASS GPU Execute extent scope: active owner, union, wrong target, empty and inactive guards');
  let extentCases = 0;
  for (const buf of [regular, base + 4090, base + 4030]) for (const mode of [0, 1, 2])
    for (const update of [0, 8]) for (const count of [0, 2]) {
      e.buffer(eb, buf);
      const matrices = new Float32Array(memory.buffer, e.guest_to_wasm(state), 48);
      matrices.fill(0);
      for (let m = 0; m < 3; m++) for (let axis = 0; axis < 4; axis++) matrices[m * 16 + axis * 5] = 1;
      e.unit_viewport(dev);
      const program = [9 | (16 << 8) | (1 << 16), mode | update, 4 << 16, count, 0, 11, 0];
      program.forEach((v, i) => e.guest_write32(buf + 512 + i * 4, v));
      [48, 0, count, 512, program.length * 4, 0, 3, 0x01fff000, 2048, 2048, 0, 0]
        .forEach((v, i) => e.guest_write32(data + i * 4, v));
      call('IDirect3DExecuteBuffer_SetExecuteData', 12, eb, data);
      const expected = [2048, 2048, 0, 0];
      for (const vertices of [[[2, 3], [5, 7]], [[-4, -8], [1, 2]]]) {
        vertices.forEach(([x, y], i) => [bits(x), bits(mode === 2 ? y : -y), bits(0.5), bits(1), 0xffffffff, 0, 0, 0]
          .forEach((v, j) => e.guest_write32(buf + i * 32 + j * 4, v)));
        call('IDirect3DExecuteBuffer_Unlock', 8, eb);
        call('IDirect3DDevice_Execute', 20, dev, eb);
        assert.strictEqual(e.extent_scope(), 0, 'Execute scope restored');
        if (update && count) for (const [x, y] of vertices) {
          expected[0] = Math.min(expected[0], x); expected[1] = Math.min(expected[1], y);
          expected[2] = Math.max(expected[2], x + 1); expected[3] = Math.max(expected[3], y + 1);
        }
        call('IDirect3DExecuteBuffer_GetExecuteData', 12, eb, out);
        assert.deepStrictEqual(Array.from({ length: 4 }, (_, i) => e.guest_read32(out + 32 + i * 4) | 0), expected,
          `rolling transform extent mode=${mode} update=${update} count=${count}`);
        extentCases++;
      }
      // A reset installs its rectangle even on a real device, after prior work.
      const reset = [14 | (24 << 8) | (1 << 16), 2, 0xdeadbeef, 19, 20, 21, 22, 11, 0];
      reset.forEach((v, i) => e.guest_write32(buf + 512 + i * 4, v));
      e.guest_write32(out + 16, reset.length * 4);
      call('IDirect3DExecuteBuffer_SetExecuteData', 12, eb, out);
      [100, 100, 101, 101].forEach((v, i) => e.guest_write32(outerRect + i * 4, v));
      e.set_extent_scope(outerRect, dev);
      call('IDirect3DDevice_Execute', 20, dev, eb);
      assert.strictEqual(e.extent_scope(), outerRect, 'enclosing scope restored');
      assert.deepStrictEqual(Array.from({ length: 4 }, (_, i) => e.guest_read32(outerRect + i * 4)), [100, 100, 101, 101]);
      call('IDirect3DExecuteBuffer_GetExecuteData', 12, eb, out);
      assert.deepStrictEqual(Array.from({ length: 4 }, (_, i) => e.guest_read32(out + 32 + i * 4)), [19, 20, 21, 22]);
      e.set_extent_scope(0, dev);
      e.outside_draw(dev);
      call('IDirect3DExecuteBuffer_GetExecuteData', 12, eb, out);
      assert.deepStrictEqual(Array.from({ length: 4 }, (_, i) => e.guest_read32(out + 32 + i * 4)), [19, 20, 21, 22], 'later draw cannot alter retired Execute scope');
    }
  console.log(`PASS Execute transform extents: ${extentCases} flag/mode/count/sparse/rolling cases + ${extentCases / 2} reset/scope-lifetime cases`);
  // Two real public allocations: interleaving, resetting and retiring one
  // owner must not change the other buffer's accumulated drawing rectangle.
  function extentBuffer() {
    [20, 1, 0, 512, 0].forEach((v, i) => e.guest_write32(desc + i * 4, v));
    call('IDirect3DDevice_CreateExecuteBuffer', 20, dev, desc, out);
    const handle = e.guest_read32(out);
    call('IDirect3DExecuteBuffer_Lock', 12, handle, desc);
    const address = e.guest_read32(desc + 16);
    [48, 0, 1, 64, 48, 0, 3, 0, 2048, 2048, 0, 0]
      .forEach((v, i) => e.guest_write32(data + i * 4, v));
    call('IDirect3DExecuteBuffer_SetExecuteData', 12, handle, data);
    call('IDirect3DExecuteBuffer_Unlock', 8, handle);
    return { handle, address };
  }
  function extentPoint(buffer, x, y, reset = false) {
    call('IDirect3DExecuteBuffer_Lock', 12, buffer.handle, desc);
    assert.strictEqual(e.guest_read32(desc + 16), buffer.address);
    [bits(x), bits(y), bits(0.5), bits(1), 0xffff0000, 0, 0, 0]
      .forEach((v, i) => e.guest_write32(buffer.address + i * 4, v));
    const program = reset ? [14 | (24 << 8) | (1 << 16), 2, 0, 2048, 2048, 0, 0] : [];
    program.push(1 | (4 << 8) | (1 << 16), 1, 11, 0);
    for (let i = 0; i < 12; i++) e.guest_write32(buffer.address + 64 + i * 4, program[i] || 0);
    call('IDirect3DExecuteBuffer_Unlock', 8, buffer.handle);
    call('IDirect3DDevice_Execute', 20, dev, buffer.handle);
    assert.strictEqual(e.extent_scope(), 0, 'interleaved scope retired');
  }
  function assertExtent(buffer, expected) {
    e.guest_write32(out, 48);
    call('IDirect3DExecuteBuffer_GetExecuteData', 12, buffer.handle, out);
    assert.deepStrictEqual(Array.from({ length: 4 }, (_, i) => e.guest_read32(out + 32 + i * 4)), expected);
  }
  const ownerA = extentBuffer(), ownerB = extentBuffer();
  extentPoint(ownerA, 2, 3);
  assertExtent(ownerA, [2, 3, 4, 5]);
  assertExtent(ownerB, [2048, 2048, 0, 0]);
  extentPoint(ownerB, 20, 21);
  assertExtent(ownerB, [20, 21, 22, 23]);
  assertExtent(ownerA, [2, 3, 4, 5]);
  extentPoint(ownerA, 8, 9);
  assertExtent(ownerA, [2, 3, 10, 11]);
  assertExtent(ownerB, [20, 21, 22, 23]);
  extentPoint(ownerA, -10, -10); // Fully clipped XY draw contributes nothing.
  assertExtent(ownerA, [2, 3, 10, 11]);
  extentPoint(ownerA, 31, 31, true); // Reset then clip the 2x2 point to the RT.
  assertExtent(ownerA, [31, 31, 32, 32]);
  assertExtent(ownerB, [20, 21, 22, 23]);
  call('IDirect3DExecuteBuffer_Release', 8, ownerA.handle);
  extentPoint(ownerB, 10, 11);
  assertExtent(ownerB, [10, 11, 22, 23]);
  call('IDirect3DExecuteBuffer_Release', 8, ownerB.handle);
  console.log('PASS Execute extent owners: interleaved draw/Unlock, reset, XY clipping and release isolation');
  // An asynchronous GPU transport accepts the batch without rasterizing on
  // this instance. GetExecuteData must already contain coverage on return.
  e.buffer(eb, regular);
  e.d3dim_gpu_enable(1);
  queuedGpuDraws = [];
  e.guest_write32(state + 344, 1); // no culling
  for (const fill of [2, 3]) for (const viewport of [false, true])
    for (const [coords, bounds] of [
    [[[4, 5], [13, 5], [4, 14]], [2, 3, 15, 16]],
    [[[20, 21], [40, 21], [20, 40]], [18, 19, 32, 32]],
    [[[-20, -20], [-10, -20], [-20, -10]], [2048, 2048, 0, 0]],
  ]) {
    e.guest_write32(state + 288, fill); // wireframe and solid
    (viewport ? [8, 9, 10, 11] : [0, 0, 32, 32]).forEach((v, i) =>
      e.guest_write32(state + 3088 + i * 4, v));
    const expected = viewport && bounds[0] !== 2048
      ? [Math.max(8, bounds[0]), Math.max(9, bounds[1]), Math.min(18, bounds[2]), Math.min(20, bounds[3])]
      : bounds;
    if (expected[2] <= expected[0] || expected[3] <= expected[1]) expected.splice(0, 4, 2048, 2048, 0, 0);
    coords.forEach(([x, y], i) => [bits(x), bits(y), bits(0.5), bits(1), 0xffffffff, 0, 0, 0]
      .forEach((v, j) => e.guest_write32(regular + i * 32 + j * 4, v)));
    const program = [14 | (24 << 8) | (1 << 16), 2, 0, 2048, 2048, 0, 0,
      3 | (8 << 8) | (1 << 16), 1 << 16, 2, 11, 0];
    program.forEach((v, i) => e.guest_write32(regular + 512 + i * 4, v));
    [48, 0, 3, 512, program.length * 4, 0, 3, 0, 2048, 2048, 0, 0]
      .forEach((v, i) => e.guest_write32(data + i * 4, v));
    call('IDirect3DExecuteBuffer_SetExecuteData', 12, eb, data);
    call('IDirect3DExecuteBuffer_Unlock', 8, eb);
    const before = queuedGpuDraws.length;
    call('IDirect3DDevice_Execute', 20, dev, eb);
    assert(queuedGpuDraws.length > before, 'real Execute submitted a GPU batch');
    call('IDirect3DExecuteBuffer_GetExecuteData', 12, eb, out);
    assert.deepStrictEqual(Array.from({ length: 4 }, (_, i) => e.guest_read32(out + 32 + i * 4)),
      expected, 'queued GPU coverage belongs to the producer Execute');
    assert.strictEqual(e.extent_scope(), 0, 'queued Execute retires its scope');
  }
  queuedGpuDraws = null;
  e.d3dim_gpu_enable(0);
  console.log('PASS queued GPU Execute extents: producer ownership, moving/reset bounds, lines/triangles, target/viewport clipping');
  // DX1 Execute selects its viewport independently of Device2 current state.
  // Globe's retained-mode DLL supplies equal X/Y scales in a nonsquare
  // rectangle. Dropping the descriptor's clip transform makes spheres oval.
  const vp = e.viewport(), vpDesc = e.guest_alloc(44);
  call('IDirect3DDevice_AddViewport', 12, dev, vp);
  const readFloat = address => new Float32Array(new Uint32Array([e.guest_read32(address)]).buffer)[0];
  for (const [width, height, scaleX, scaleY] of [[292, 254, 146, 146], [676, 532, 338, 338], [120, 80, 30, 20], [292, 254, 146, 127]]) {
    [44, 7, 11, width, height, bits(scaleX), bits(scaleY), bits(1), bits(1), bits(0), bits(1)]
      .forEach((v, i) => e.guest_write32(vpDesc + i * 4, v));
    call('IDirect3DViewport_SetViewport', 12, vp, vpDesc);
    e.d3dim_gpu_enable(0);
    e.buffer(eb, regular);
    const program = [9 | (16 << 8) | (1 << 16), 1, 0, 2, 0, 11, 0];
    program.forEach((v, i) => e.guest_write32(regular + 512 + i * 4, v));
    [48, 0, 2, 512, program.length * 4, 0, 0, 0, 0, 0, 0, 0]
      .forEach((v, i) => e.guest_write32(data + i * 4, v));
    call('IDirect3DExecuteBuffer_SetExecuteData', 12, eb, data);
    // Identity world/view/projection; two symmetric LVERTEX inputs.
    for (let slot = 0; slot < 3; slot++) for (let i = 0; i < 16; i++)
      e.guest_write32(state + slot * 64 + i * 4, bits(i % 5 === 0 ? 1 : 0));
    for (const [i, x, y] of [[0, 0.25, 0], [1, 0, 0.25]])
      [bits(x), bits(y), bits(0.5), 0, 0xffffffff, 0, 0, 0]
        .forEach((v, j) => e.guest_write32(regular + i * 32 + j * 4, v));
    call('IDirect3DExecuteBuffer_Unlock', 8, eb);
    call('IDirect3DDevice_Execute', 20, dev, eb, vp);
    const expected = [[7 + width / 2 + 0.25 * scaleX, 11 + height / 2],
      [7 + width / 2, 11 + height / 2 - 0.25 * scaleY]];
    for (let i = 0; i < 2; i++) for (let axis = 0; axis < 2; axis++)
      assert(Math.abs(readFloat(e.output(regular) + i * 32 + axis * 4) - expected[i][axis]) < 0.0001,
        `DX1 Execute must honor descriptor scale ${width}x${height} vertex=${i} axis=${axis}`);
  }
  console.log('PASS DX1 Execute viewport transform: equal scaling in nonsquare original Globe sizes, offset, explicit unequal scales and normalization reset');
  for (let page = 0; page < 7; page++) for (let i = 0; i < 4096; i++)
    assert.strictEqual(e.guest_read8(base + 0x10000 + page * 4096 + i), 0xa7, 'neighbor backing');
  e.buffer(eb, ownedBuffer); // Borrowed test mappings are not heap owners.
  call('IDirect3DExecuteBuffer_Release', 8, eb);
  console.log(`PASS Execute instruction walker: control + ${stream.length - 1} sparse splits + 2200-record group + ${primitiveCases} record / ${vertexCases} vertex pixel comparisons + ${branchCases} masked branches + ${multiCases} multi-record cases, trace/ABI/guards`);
})().catch(error => { console.error(error); process.exitCode = 1; });
