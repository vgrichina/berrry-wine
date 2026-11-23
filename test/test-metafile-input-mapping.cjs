'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.cwd();
const { bootRenderHarness } = require(path.join(root, 'test/render-helper'));
const apiTable = require(path.join(root, 'src/api_table.json'));

// Original CC0 input streams authored for this test from METAHEADER/ENHMETAHEADER and
// documented record layouts. Expected output always comes from these bytes.
function wmf(long) {
  const record = (fn, words = []) => {
    const b = Buffer.alloc(6 + words.length * 2);
    b.writeUInt32LE(b.length / 2); b.writeUInt16LE(fn, 4);
    words.forEach((v, i) => b.writeUInt16LE(v, 6 + i * 2)); return b;
  };
  const records = [record(0x02fc, [0, 0x572b, 0x00c1, 0]),
    record(0x012d, [0]), record(0x012d, [0x8008]), record(0x001e),
    record(0x0201, [0x1234, 0x0056]), record(0x001e),
    record(0x0201, [0x5678, 0x0012]), record(0x0127, [0xffff]),
    record(0x0127, [0xffff]), record(0x041b, [14, 13, 2, 6])];
  if (long) {
    records.push(record(0x001e));
    for (let i = 0; i < 1877; i++) records.push(record(0x0201, [i, 0x005a]));
    records.push(record(0x0127, [0xffff]));
  }
  records.push(record(0));
  const header = Buffer.alloc(18), size = 18 + records.reduce((n, b) => n + b.length, 0);
  header.writeUInt16LE(1); header.writeUInt16LE(9, 2); header.writeUInt16LE(0x300, 4);
  header.writeUInt32LE(size / 2, 6); header.writeUInt16LE(1, 10);
  header.writeUInt32LE(Math.max(...records.map(b => b.length / 2)), 12);
  return Buffer.concat([header, ...records]);
}
function emf(long) {
  const record = (type, words = []) => {
    const b = Buffer.alloc(8 + words.length * 4);
    b.writeUInt32LE(type); b.writeUInt32LE(b.length, 4);
    words.forEach((v, i) => b.writeUInt32LE(v >>> 0, 8 + i * 4)); return b;
  };
  const records = [record(39, [1, 0, 0x00c1572b, 0]), record(37, [1]),
    record(37, [0x80000008]), record(33), record(25, [0x00561234]),
    record(33), record(25, [0x00125678]), record(34, [-1]),
    record(34, [-1]), record(43, [6, 2, 13, 14])];
  if (long) {
    records.push(record(33));
    for (let i = 0; i < 1601; i++) records.push(record(25, [0x005a0000 | i]));
    records.push(record(34, [-1]));
  }
  records.push(record(14, [0, 0, 20]));
  const header = Buffer.alloc(88), size = 88 + records.reduce((n, b) => n + b.length, 0);
  [1, 88, 0, 0, 16, 16, 0, 0, 1600, 1600, 0x464d4520, 0x10000,
    size, records.length + 1].forEach((v, i) => header.writeUInt32LE(v, i * 4));
  header.writeUInt16LE(2, 56);
  [100, 100, 100, 100].forEach((v, i) => header.writeUInt32LE(v, 72 + i * 4));
  return Buffer.concat([header, ...records]);
}
const extraWat = String.raw`
 (func (export "mfi_used") (result i32) (global.get $DIB_PAGE_USED))
 (func (export "mfi_pages") (result i32) (global.get $DIB_PAGE_COUNT))
 (func (export "mfi_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "mfi_regs") (result i32) (global.get $reg_base))
 (func (export "mfi_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "mfi_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "mfi_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "mfi_error_set") (param i32) (global.set $last_error (local.get 0)))
 (func (export "mfi_error") (result i32) (global.get $last_error))
 (func (export "mfi_source") (param i32 i32) (result i32)
  (i32.load offset=24 (call $gdi_metafile_record (local.get 0) (local.get 1))))
`;
async function run(options = {}) {
  const stats = { calls: 0, queries: 0, comparisons: 0, mappingFailures: 0,
    controlFailures: 0, decoyCorruptions: 0, pixelControls: 0, resourceFailureCases: 0, examples: [] };
  function compare(actual, expected, label, mapping = false, decoy = false) {
    stats.comparisons++;
    if (Buffer.isBuffer(actual) ? actual.equals(expected) : JSON.stringify(actual) === JSON.stringify(expected)) return;
    stats[mapping ? 'mappingFailures' : 'controlFailures']++;
    if (decoy) stats.decoyCorruptions++;
    if (stats.examples.length < 16) {
      let at = 0;
      if (Buffer.isBuffer(actual)) while (at < actual.length && actual[at] === expected[at]) at++;
      stats.examples.push({ label, at, actual: Buffer.isBuffer(actual) ? actual.subarray(at, at + 12).toString('hex') : actual,
        expected: Buffer.isBuffer(expected) ? expected.subarray(at, at + 12).toString('hex') : expected });
    }
  }
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none', width: 32, height: 32 });
  e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.mfi_init(); e.set_api_log(0);
  const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer), regs = e.mfi_regs() >>> 0;
  const wa = p => e.guest_to_wasm(p) >>> 0;
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
  function put(p, b) { for (let i = 0; i < b.length;) { const n = Math.min(b.length - i, 4096 - ((p + i) & 4095)); bytes.set(b.subarray(i, i + n), wa(p + i)); i += n; } }
  function read(p, n) { const b = Buffer.alloc(n); for (let i = 0; i < n;) { const k = Math.min(n - i, 4096 - ((p + i) & 4095)); b.set(bytes.subarray(wa(p + i), wa(p + i) + k), i); i += k; } return b; }
  const text = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length); put(p, b); return p; };
  const frame = alloc(256), stack = frame + 64, other = alloc(64), direct = alloc(32768), out = alloc(64), bmi = alloc(40), bounds = alloc(16);
  const entries = new Map(); view.setUint32(regs + 16, stack, true);
  const mod = e.mfi_module(text('GDI32.DLL')) >>> 0; assert.ok(mod);
  const names = ['GetMetaFileBitsEx', 'GetEnhMetaFileBits', 'SetMetaFileBitsEx', 'SetEnhMetaFileBits', 'DeleteMetaFile', 'DeleteEnhMetaFile',
    'PlayMetaFile', 'PlayEnhMetaFile', 'CreateCompatibleDC', 'DeleteDC', 'CreateDIBSection', 'SelectObject', 'DeleteObject', 'GetStockObject',
    'GetCurrentObject', 'SaveDC', 'RestoreDC', 'SetTextColor', 'GetTextColor', 'SetBkColor', 'GetBkColor', 'SetBkMode', 'GetBkMode',
    'GetMapMode', 'GetROP2', 'GetPolyFillMode', 'GetStretchBltMode', 'IntersectClipRect', 'GetClipBox', 'CreateSolidBrush'];
  for (const name of names) { view.setUint32(regs + 16, stack, true); const thunk = e.mfi_resolve(mod, text(name)) >>> 0;
    const row = apiTable.find(r => r.name === name); assert.ok(thunk, name); assert.equal(row.convention, 'stdcall');
    assert.equal(e.guest_read32(thunk + 4), row.id); entries.set(name, { thunk, nargs: row.nargs }); }
  function call(name, args) {
    const entry = entries.get(name); assert.equal(args.length, entry.nargs);
    bytes.fill(0x6b, wa(frame), wa(frame) + 256); e.guest_write32(stack, 0x10293847);
    args.forEach((x, i) => e.guest_write32(stack + 4 + i * 4, x));
    const before = read(frame, 256), untouched = read(other, 64);
    const seed = [0x81234567, 0x12345678, 0x23456789, 0x3456789a, stack, 0x456789ab, 0x56789abc, 0x6789abcd];
    seed.forEach((v, i) => view.setUint32(regs + i * 4, v, true)); e.mfi_call(entry.thunk); stats.calls++;
    assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP'); assert.equal(e.get_eip() >>> 0, 0x456789ab, name + ' EIP');
    for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(view.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
    assert.deepEqual(read(frame, 256), before, name + ' stack'); assert.deepEqual(read(other, 64), untouched, name + ' unrelated'); return e.get_eax() >>> 0;
  }
  const fixtures = [];
  for (const kind of ['WMF', 'EMF']) for (const long of [false, true]) {
    const b = kind === 'WMF' ? wmf(long) : emf(long), p = alloc(b.length); put(p, b);
    const handle = call(kind === 'WMF' ? 'SetMetaFileBitsEx' : 'SetEnhMetaFileBits', [b.length, p]); assert.ok(handle, kind);
    fixtures.push({ kind, long, bytes: b, p, handle, getter: kind === 'WMF' ? 'GetMetaFileBitsEx' : 'GetEnhMetaFileBits',
      remove: kind === 'WMF' ? 'DeleteMetaFile' : 'DeleteEnhMetaFile', source: e.mfi_source(handle, kind === 'WMF' ? 6 : 7) >>> 0 });
  }
  const fragmented = 0x30000000, adjacent = 0x31000000, decoyA = 0x28000000, decoyB = 0x29000000, pages = 12;
  const spans = [];
  for (let i = 0; i < pages; i++) for (const [g, decoy] of [[fragmented + i * 4096, false], [decoyA + i * 4096, true], [decoyB + i * 4096, true]]) {
    assert.equal(e.test_virtual_map_commit(g, 4096) >>> 0, g); spans.push({ p: wa(g), n: 4096, decoy });
  }
  assert.equal(e.test_virtual_map_commit(adjacent, pages * 4096) >>> 0, adjacent); spans.push({ p: wa(adjacent), n: pages * 4096, decoy: false });
  for (let i = 0; i < pages; i++) {
    assert.equal(wa(decoyA + i * 4096), wa(fragmented + i * 4096) + 4096); assert.equal(wa(decoyB + i * 4096), wa(fragmented + i * 4096) + 8192);
    if (i + 1 < pages) { assert.notEqual(wa(fragmented + (i + 1) * 4096), wa(fragmented + i * 4096) + 4096); assert.equal(wa(adjacent + (i + 1) * 4096), wa(adjacent + i * 4096) + 4096); }
  }
  const backing = spans.map(s => Buffer.from(memory.buffer, s.p, s.n));
  const used = Buffer.from(memory.buffer, e.mfi_used() >>> 0, e.mfi_pages() >>> 0);
  function query(f, p, capacity, label, mapped = false, data = f.bytes, valid = true, playback = false, clip = [0, 0, 32, 32]) {
    label = f.kind + '/' + f.long + ' ' + label;
    backing.forEach((b, i) => b.fill(0x90 + i));
    if (p) put(p, data);
    const originals = backing.map(b => Buffer.from(b)), pagesBefore = Buffer.from(used);
    const headerMin = f.kind === 'WMF' ? 18 : 88;
    const success = !!p && capacity >= headerMin && valid && (f.kind === 'WMF' || capacity <= 0x03f00000);
    const extent = f.kind === 'WMF' ? data.readUInt32LE(6) * 2 : capacity;
    const expect = success ? read(p, extent) : null;
    const inputBefore = p ? read(p, Math.max(data.length, success ? extent : 0)) : null;
    e.mfi_error_set(0x13579bdf);
    const handle = call(f.kind === 'WMF' ? 'SetMetaFileBitsEx' : 'SetEnhMetaFileBits', [capacity, p]); stats.queries++;
    compare(!!handle, success, label + ' result', mapped);
    compare(e.mfi_error() >>> 0, 0x13579bdf, label + ' LastError', mapped);
    if (handle) {
      const size = call(f.getter, [handle, 0, 0]); compare(size, extent, label + ' independent public length', mapped);
      const n = Math.min(size, 32768), output = direct;
      // The independent output getter is kept on a separate direct buffer.
      compare(call(f.getter, [handle, n, output]), n, label + ' public byte count', mapped);
      compare(read(output, n), expect ? expect.subarray(0, n) : Buffer.alloc(0), label + ' public bytes', mapped);
      compare(Buffer.from(memory.buffer, e.mfi_source(handle, f.kind === 'WMF' ? 6 : 7) >>> 0, n), expect ? expect.subarray(0, n) : Buffer.alloc(0), label + ' retained object bytes', mapped);
      if (playback && success && read(output, n).equals(expect.subarray(0, n))) play({...f, handle}, a, label, clip);
      assert.equal(call(f.remove, [handle]), 1);
    }
    if (p) compare(read(p, inputBefore.length), inputBefore, label + ' complete input immutability', mapped);
    // direct is solely the independent readback buffer, not input backing.
    backing.forEach((b, i) => compare(b, originals[i], label + ' entire source backing ' + i, mapped, spans[i].decoy));
    compare(used, pagesBefore, label + ' all staging and object pages released', mapped);
    assert.equal(e.guest_span_cursor_bytes(), 0); assert.equal(e.guest_span_overflow_count(), 0);
  }
  function target() { const dc = call('CreateCompatibleDC', [0]); assert.ok(dc); put(bmi, Buffer.alloc(40));
    e.guest_write32(bmi, 40); e.guest_write32(bmi + 4, 32); e.guest_write32(bmi + 8, -32); e.guest_write16(bmi + 12, 1); e.guest_write16(bmi + 14, 32);
    const bitmap = call('CreateDIBSection', [dc, bmi, 0, out, 0, 0]), bits = e.guest_read32(out) >>> 0; assert.ok(bitmap && bits);
    return { dc, bitmap, bits, old: call('SelectObject', [dc, bitmap]) }; }
  const a = target(), b = target(), pixels = t => Buffer.from(memory.buffer, wa(t.bits), 4096), white = Buffer.alloc(4096, 255);
  [0, 0, 16, 16].forEach((v, i) => e.guest_write32(bounds + i * 4, v));
  function state(t) { const values = ['GetTextColor', 'GetBkColor', 'GetBkMode', 'GetMapMode', 'GetROP2', 'GetPolyFillMode', 'GetStretchBltMode'].map(n => call(n, [t.dc]));
    for (const type of [1, 2, 7]) values.push(call('GetCurrentObject', [t.dc, type])); values.push(call('GetClipBox', [t.dc, out]), read(out, 16).toString('hex')); return values; }
  call('SetTextColor', [a.dc, 0x00345678]); call('SetBkColor', [a.dc, 0x00765432]); call('SetBkMode', [a.dc, 1]); call('SetTextColor', [b.dc, 0x00123456]);
  const initial = state(a), independent = state(b);
  function play(f, t, label, clip = [0, 0, 32, 32]) {
    const before = state(t), other = t === a ? b : a; pixels(a).fill(255); pixels(b).fill(255);
    assert.equal(call(f.kind === 'WMF' ? 'PlayMetaFile' : 'PlayEnhMetaFile', f.kind === 'WMF' ? [t.dc, f.handle] : [t.dc, f.handle, bounds]), 1);
    const expected = Buffer.from(white);
    for (let y = Math.max(2, clip[1]); y < Math.min(14, clip[3]); y++) for (let x = Math.max(6, clip[0]); x < Math.min(13, clip[2]); x++) {
      const at = (y * 32 + x) * 4; expected[at] = 0xc1; expected[at + 1] = 0x57; expected[at + 2] = 0x2b; expected[at + 3] = 0;
    }
    compare(pixels(t), expected, label + ' literal pixels'); compare(pixels(other), white, label + ' independent DIB'); compare(state(t), before, label + ' restored state');
    compare(read(f.p, f.bytes.length), f.bytes, label + ' source'); compare(read(bounds, 16), Buffer.from('00000000000000001000000010000000', 'hex'), label + ' bounds'); stats.pixelControls++;
    if (options.capture) options.capture(label, Buffer.from(pixels(t)), 32, 32);
  }
  for (const f of fixtures) {
    play(f, a, 'literal control ' + f.kind + '/' + f.long);
    for (const size of [0, 1, 17, 18, 87, 88, f.bytes.length - 1, f.bytes.length, f.bytes.length + 23]) query(f, f.p, size, 'direct size ' + size, false, f.bytes, size >= f.bytes.length);
    for (let cut = 1; cut < f.bytes.length; cut++) for (const start of [fragmented, adjacent]) query(f, start + 6 * 4096 - cut, f.bytes.length, 'every byte cut ' + cut, start === fragmented);
    for (let phase = 0; phase < 4096; phase++) for (const start of [fragmented, adjacent]) query(f, start + 4096 + phase, f.bytes.length, 'DWORD/page phase ' + phase, start === fragmented);
    for (let repeat = 0; repeat < 3; repeat++) for (const start of [fragmented, adjacent]) {
      for (const size of [0, 1, 2, 3, 4, 5, 17, 18, 87, 88, f.bytes.length - 1, f.bytes.length, f.bytes.length + 37]) {
        const valid = f.kind === 'WMF' ? f.bytes.readUInt32LE(6) <= Math.floor(size / 2) : f.bytes.readUInt32LE(48) <= size;
        query(f, start + 4095, size, 'size/repeat ' + size + '/' + repeat, start === fragmented, f.bytes, valid);
      }
      for (const size of [0, 1, 17, 18, 87, 88, f.bytes.length, 0x7fffffff, 0x80000000, 0xffffffff]) query(f, 0, size, 'NULL ' + size, start === fragmented);
      query(f, start + 4095, f.bytes.length, 'mapped playback ' + repeat, start === fragmented, f.bytes, true, true);
    }
    for (const size of [0x7fffffff, 0x80000000, 0xffffffff]) for (const start of [fragmented, adjacent]) query(f, start + 4095, size, 'unsigned size ' + size, start === fragmented);
    // Preserve the existing deliberately shallow header validation policy.
    for (const [offset, value, width] of (f.kind === 'WMF' ? [[0, 2, 2], [4, 0, 2], [12, 0xffffffff, 4]] : [[4, 20000, 4], [48, 0, 4], [52, 0, 4]])) {
      const data = Buffer.from(f.bytes); data[width === 2 ? 'writeUInt16LE' : 'writeUInt32LE'](value, offset);
      for (const start of [fragmented, adjacent]) query(f, start + 4095, data.length, 'accepted header policy ' + offset, start === fragmented, data, true);
    }
    const mutations = f.kind === 'WMF' ? [[0, 3, 2], [2, 8, 2], [6, 8, 4], [6, 0xffffffff, 4]] : [[0, 2, 4], [4, 87, 4], [40, 0, 4], [48, 0xffffffff, 4]];
    for (const [offset, value, width] of mutations) for (const start of [fragmented, adjacent]) {
      const data = Buffer.from(f.bytes); data[width === 2 ? 'writeUInt16LE' : 'writeUInt32LE'](value, offset);
      query(f, start + 4095, data.length, 'invalid header ' + offset, start === fragmented, data, false);
    }
    // Current policies deliberately accept padding for EMF and store only
    // METAHEADER's bounded declared extent for WMF.
    for (const size of [f.bytes.length + 1, f.bytes.length + 137]) for (const start of [fragmented, adjacent]) query(f, start + 4093, size, 'padding ' + size, start === fragmented);
    play(f, a, 'after input matrix ' + f.kind + '/' + f.long);
  }
  const exhausted = [];
  for (let i = 0; i < 513; i++) { const h = call('CreateSolidBrush', [0x00123456]); if (!h) break; exhausted.push(h); }
  assert.ok(exhausted.length > 400 && exhausted.length < 513, 'public GDI object exhaustion');
  for (const f of fixtures) {
    backing.forEach((b, i) => b.fill(0x90 + i)); put(fragmented + 4095, f.bytes);
    const original = backing.map(b => Buffer.from(b)), pagesBefore = Buffer.from(used);
    e.mfi_error_set(0x13579bdf);
    const h = call(f.kind === 'WMF' ? 'SetMetaFileBitsEx' : 'SetEnhMetaFileBits', [f.bytes.length, fragmented + 4095]);
    stats.resourceFailureCases++; compare(h, 0, 'GDI object allocation failure', true); if (h) call(f.remove, [h]);
    compare(used, pagesBefore, 'GDI allocation failure releases staging and retained bits', true);
    compare(e.mfi_error() >>> 0, 0x13579bdf, 'GDI failure LastError', true);
    backing.forEach((b, i) => compare(b, original[i], 'GDI failure source backing', true));
    assert.equal(e.guest_span_cursor_bytes(), 0);
  }
  for (const h of exhausted) assert.equal(call('DeleteObject', [h]), 1);
  for (const f of fixtures) for (const freePages of [0, Math.ceil(f.bytes.length / 4096)]) {
    backing.forEach((b, i) => b.fill(0x90 + i)); put(fragmented + 4095, f.bytes);
    const before = Buffer.from(used), free = [];
    for (let i = 0; i < before.length && free.length < freePages; i++) if (!before[i]) free.push(i);
    used.fill(1); for (const i of free) used[i] = 0;
    const pressure = Buffer.from(used), original = backing.map(b => Buffer.from(b));
    e.mfi_error_set(0x13579bdf);
    const handle = call(f.kind === 'WMF' ? 'SetMetaFileBitsEx' : 'SetEnhMetaFileBits', [f.bytes.length, fragmented + 4095]);
    stats.resourceFailureCases++; compare(handle, 0, 'staging/create allocation failure', true);
    if (handle) call(f.remove, [handle]);
    compare(used, pressure, 'failure path staging released', true);
    compare(e.mfi_error() >>> 0, 0x13579bdf, 'failure LastError', true);
    backing.forEach((b, i) => compare(b, original[i], 'failure entire backing', true));
    before.copy(used); assert.equal(e.guest_span_cursor_bytes(), 0);
  }
  assert.equal(call('SaveDC', [a.dc]), 1); call('SetTextColor', [a.dc, 0x00778899]); assert.equal(call('IntersectClipRect', [a.dc, 4, 5, 9, 11]), 2); const outer = state(a);
  assert.equal(call('SaveDC', [a.dc]), 2); call('SetBkColor', [a.dc, 0x00123456]); assert.equal(call('IntersectClipRect', [a.dc, 5, 6, 8, 10]), 2); const inner = state(a);
  for (const [saved, clip, label] of [[inner, [5, 6, 8, 10], 'inner'], [outer, [4, 5, 9, 11], 'outer']]) {
    for (const f of fixtures) { query(f, fragmented + 4095, f.bytes.length, label + ' query', true, f.bytes, true, true, clip); compare(state(a), saved, label + ' query state'); play(f, a, label, clip); }
    assert.equal(call('RestoreDC', [a.dc, -1]), 1);
  }
  compare(state(a), initial, 'caller saves restored'); play(fixtures[0], b, 'independent playback'); compare(state(b), independent, 'independent state');
  for (const f of fixtures) assert.equal(call(f.remove, [f.handle]), 1);
  for (const t of [a, b]) { call('SelectObject', [t.dc, t.old]); assert.equal(call('DeleteObject', [t.bitmap]), 1); assert.equal(call('DeleteDC', [t.dc]), 1); }
  stats.fixtureHashes = fixtures.map(f => ({ kind: f.kind, long: f.long, size: f.bytes.length, sha256: crypto.createHash('sha256').update(f.bytes).digest('hex') }));
  console.log(JSON.stringify(stats)); return stats;
}
module.exports = { run, wmf, emf };
if (require.main === module) run().then(s => { assert.equal(s.controlFailures, 0, 'public controls'); assert.equal(s.mappingFailures, 0, 'mapped input');
  console.log('PASS metafile input: literal WMF/EMF, all byte cuts/page phases, bounded tails, full backing/decoys, ABI, immutability, playback and nested DC state');
}).catch(e => { console.error(e); process.exitCode = 1; });
