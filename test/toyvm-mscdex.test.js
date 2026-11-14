'use strict';

// PURE_JS_ONLY_NO_NATIVE: prototype/register/memory protocol tests. No Machine
// construction, guest execution, native fixtures, WASM, browser, or game.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHash } = require('node:crypto');
const { Machine } = require('../tools/toyvm/dos');
const { createCdromMedia } = require('../tools/toyvm/cdrom-media');
const S = 2048;
const hash = b => createHash('sha256').update(b).digest('hex');
function both16(b, at, n) { b.writeUInt16LE(n, at); b.writeUInt16BE(n, at + 2); }
function both32(b, at, n) { b.writeUInt32LE(n, at); b.writeUInt32BE(n, at + 4); }
function record(id, lba, length, flags) {
  const b = Buffer.alloc(34); b[0] = 34; both32(b, 2, lba); both32(b, 10, length);
  b[25] = flags; both16(b, 28, 1); b[32] = 1; b[33] = id; return b;
}
function iso() {
  const b = Buffer.alloc(24 * S);
  for (let i = 0; i < 16 * S; i++) b[i] = (i * 13 + (i >>> 11)) & 255;
  const pvd = b.subarray(16 * S, 17 * S);
  pvd.set([1, 67, 68, 48, 48, 49, 1]); pvd.write('MSCDEX_TEST', 40);
  both32(pvd, 80, 24); both16(pvd, 128, S); pvd.set(record(0, 20, S, 2), 156);
  b.set([255, 67, 68, 48, 48, 49, 1], 17 * S);
  b.set(Buffer.concat([record(0, 20, S, 2), record(1, 20, S, 2)]), 20 * S);
  return b;
}
function machine() {
  return Object.assign(Object.create(Machine.prototype), {
    mem: new Uint8Array(0x100000).fill(0xcc), isoVolumes: new Map(), floppyVolumes: new Map(),
    driveDirectories: new Map(), mediaChanges: [],
  });
}
function mount(m, b = iso(), drive = 'D', opts = {}) { m.mountIso(b, { format: 'iso', drive, ...opts }); return b; }
function call(m, al, args = {}, ah = 0x15) {
  const v = { ax: ah * 256 + al, bx: 0x100, cx: 3, dx: 1, si: 0, di: 0, es: 0x200, cf: true, ...args };
  const r = { get: k => v[k] || 0, set: (k, n) => { v[k] = n & 0xffff; }, setResultCf: on => { v.cf = on; } };
  const handled = m.int2f(ah, al, r); return { handled, v };
}
function error(result, code) {
  assert.equal(result.handled, true); assert.equal(result.v.cf, true); assert.equal(result.v.ax, 0x1500 | code);
}
function mixed(origin = 0) {
  const b = iso(), raw = Buffer.alloc((origin + 27) * 2352, 0xa7);
  for (let s = 0; s < 24; s++) {
    const at = (origin + s) * 2352;
    raw[at] = raw[at + 11] = 0; raw.fill(255, at + 1, at + 11); raw[at + 15] = 1;
    raw.set(b.subarray(s * S, (s + 1) * S), at + 16);
  }
  const msf = n => `00:00:${String(n).padStart(2, '0')}`;
  const cue = `FILE "disc.bin" BINARY\n TRACK 01 MODE1/2352\n${origin ? ' INDEX 00 00:00:00\n' : ''} INDEX 01 ${msf(origin)}\n` +
    ` TRACK 02 AUDIO\n INDEX 00 ${msf(origin + 24)}\n INDEX 01 ${msf(origin + 25)}\n`;
  return { b, raw, cue };
}

test('uninstalled discovery and unrelated XMS/Windows multiplex behavior', () => {
  const m = machine();
  assert.deepEqual(call(m, 0, { bx: 55, cx: 99 }).v,
    { ax: 0x1500, bx: 0, cx: 99, dx: 1, si: 0, di: 0, es: 0x200, cf: true });
  assert.equal(call(m, 0x0b).handled, false);
  assert.equal(call(m, 0, {}, 0x43).v.ax, 0x4380);
  assert.equal(call(m, 0x10, {}, 0x43).handled, true);
  assert.equal(call(m, 0, {}, 0x16).v.ax, 0x1600);
  assert.equal(call(m, 0x87, {}, 0x16).handled, false);
});

test('discovery counts only CDs and enumerates sorted noncontiguous drive bytes', () => {
  const m = machine(); mount(m, iso(), 'Z'); mount(m); mount(m, iso(), 'F');
  m.floppyVolumes.set(0, {}); m.floppyVolumes.set(1, {});
  const q = call(m, 0, { cf: false });
  assert.equal(q.v.ax, 0x1500); assert.equal(q.v.bx, 3); assert.equal(q.v.cx, 3); assert.equal(q.v.cf, false);
  const before = m.mem.slice(); const list = call(m, 0x0d);
  assert.equal(list.handled, true); assert.equal(list.v.cf, true); assert.equal(list.v.bx, 0x100);
  before.set([3, 5, 25], 0x2100); assert.deepEqual(m.mem, before);
  for (const cx of [0, 1, 2, 4, 26, 0x103, 0xffff, 3, 5, 25]) {
    const checked = call(m, 0x0b, { cx });
    assert.equal(checked.v.ax, [3, 5, 25].includes(cx) ? 1 : 0);
    assert.equal(checked.v.bx, 0xadad); assert.equal(checked.v.cf, true);
  }
});

test('VTOC returns actual descriptor bytes, primary/terminator/other status and CF', () => {
  const m = machine(), b = mount(m), before = hash(b);
  for (const [dx, ax] of [[0, 1], [1, 255]]) {
    const q = call(m, 5, { dx }); assert.equal(q.v.ax, ax); assert.equal(q.v.cf, false);
    assert.deepEqual(m.mem.slice(0x2100, 0x2900), new Uint8Array(b.subarray((16 + dx) * S, (17 + dx) * S)));
  }
  // A supplementary descriptor is a real descriptor but has status 0.
  b.set([2, 67, 68, 48, 48, 49, 1], 18 * S);
  assert.equal(call(m, 5, { dx: 2 }).v.ax, 0);
  b.fill(0, 18 * S, 18 * S + 7); assert.equal(hash(b), before);
  m.mem[0x2100] ^= 255; assert.equal(hash(b), before);
});

test('absolute reads copy real 2048-byte sectors and preserve unspecified registers', () => {
  const m = machine(), b = mount(m), identity = hash(b);
  const q = call(m, 8, { dx: 3, di: 4 });
  assert.deepEqual(q.v, { ax: 0x1508, bx: 0x100, cx: 3, dx: 3, si: 0, di: 4, es: 0x200, cf: false });
  assert.deepEqual(m.mem.slice(0x2100, 0x2100 + 3 * S), new Uint8Array(b.subarray(4 * S, 7 * S)));
  m.mem.fill(0, 0x2100, 0x2900); assert.equal(hash(b), identity);
});

test('SI is high word and DI low word; no signed shift or 16-bit LBA truncation', () => {
  const m = machine(); mount(m);
  const marker = Uint8Array.from({ length: S }, (_, i) => (i * 5 + 17) & 255);
  m.isoVolumes.get(3).media.source = { size: (0x10002 + 1) * S, readRange(offset, length) {
    assert.equal(offset, 0x10002 * S); assert.equal(length, S); return marker;
  } };
  assert.equal(call(m, 8, { si: 1, di: 2 }).v.cf, false);
  assert.deepEqual(m.mem.slice(0x2100, 0x2900), marker);
  error(call(m, 8, { si: 0xffff, di: 0xffff }), 21);
});

test('invalid drives, zero/huge counts, EOF and malformed descriptors do not write', () => {
  const m = machine(); mount(m); const before = hash(m.mem);
  for (const al of [5, 8]) for (const cx of [0, 2, 4, 0x103, 0xffff]) error(call(m, al, { cx }), 15);
  for (const args of [{ dx: 0 }, { dx: 0xffff }, { di: 24 }, { di: 23, dx: 2 }, { si: 1 }]) error(call(m, 8, args), 21);
  error(call(m, 5, { dx: 8 }), 21); error(call(m, 5, { dx: 2 }), 21);
  assert.equal(hash(m.mem), before);
});

test('segment end, A20 boundary and backing-memory bounds refuse transfers atomically', () => {
  const m = machine(); mount(m); const before = hash(m.mem);
  for (const args of [{ bx: 0xf801 }, { es: 0xffff, bx: 0 }, { bx: 0, dx: 33 }]) error(call(m, 8, args), 21);
  assert.equal(hash(m.mem), before);
  assert.equal(call(m, 8, { bx: 0xf800 }).v.cf, false); // exact segment end
  m.mem = new Uint8Array(0x2200).fill(0xcc); const small = hash(m.mem);
  error(call(m, 8), 21); assert.equal(hash(m.mem), small);
  mount(m, iso(), 'Z');
  assert.equal(call(m, 0x0d, { bx: 0xffff }).handled, false);
  assert.equal(hash(m.mem), small);
});

test('short, asynchronous, throwing and truncated providers return not ready without partial data', () => {
  const m = machine(); mount(m); const media = m.isoVolumes.get(3).media, before = hash(m.mem);
  for (const readRange of [() => new Uint8Array(1), () => Promise.resolve(new Uint8Array(S)),
    () => { throw Error('closed/truncated'); }]) {
    media.source = { size: 24 * S, readRange }; error(call(m, 8), 21);
    assert.equal(hash(m.mem), before);
  }
});

test('legacy raw MODE1 and retained disc path read payloads, refuse audio/cross-track reads', () => {
  for (const retained of [false, true]) {
    const m = machine(), { b, raw, cue } = mixed(), identity = hash(raw);
    if (retained) {
      const disc = createCdromMedia(cue, raw);
      mount(m, disc.dataTrack(1), 'D', { cdromMedia: disc });
      assert.equal(m.isoVolumes.get(3).media.cdromMedia, disc);
    } else mount(m, raw, 'D', { format: 'mode1/2352', cue, file: 'disc.bin' });
    assert.equal(call(m, 5, { dx: 0 }).v.ax, 1);
    assert.deepEqual(m.mem.slice(0x2100, 0x2900), new Uint8Array(b.subarray(16 * S, 17 * S)));
    assert.equal(call(m, 8, { di: 15, dx: 2 }).v.cf, false);
    assert.deepEqual(m.mem.slice(0x2100, 0x3100), new Uint8Array(b.subarray(15 * S, 17 * S)));
    const before = hash(m.mem);
    for (const args of [{ di: 23, dx: 2 }, { di: 24 }, { di: 25 }, { di: 26 }]) error(call(m, 8, args), 21);
    assert.equal(hash(m.mem), before); assert.equal(hash(raw), identity);
    raw[15] = 2; error(call(m, 8), 21); assert.equal(hash(m.mem), before);
  }
});

test('nonzero BIN origin keeps descriptor offset and refuses unqualified HSG mapping', () => {
  const m = machine(), { raw, cue, b } = mixed(2);
  mount(m, raw, 'D', { format: 'mode1/2352', cue, file: 'disc.bin' });
  assert.equal(call(m, 5, { dx: 0 }).v.ax, 1);
  assert.deepEqual(m.mem.slice(0x2100, 0x2900), new Uint8Array(b.subarray(16 * S, 17 * S)));
  const before = hash(m.mem); error(call(m, 8, { di: 18 }), 21); assert.equal(hash(m.mem), before);
});

test('protected selector buffers require an extender thunk; no real-mode misaddress', () => {
  const m = machine(); mount(m);
  m.vmExports = { get_cr0: () => 1, get_vm86: () => 0 };
  const before = hash(m.mem); error(call(m, 8), 21);
  assert.equal(call(m, 0x0d).handled, false); assert.equal(hash(m.mem), before);
});

test('VM86 uses existing full page preflight and does not swallow CPU faults', () => {
  const m = machine(), b = mount(m); let probes = 0, writes = 0;
  m.vmExports = { get_cr0: () => 0x80000001 | 0, get_vm86: () => 1,
    pg_probe(at, width, user) { assert.equal(width, 1); assert.equal(user, 1); probes++; return at ^ 0x10000; },
    pg_phys_write(at, value) { assert.equal(probes, S); writes++; m.mem[at] = value; } };
  assert.equal(call(m, 8, { di: 3 }).v.cf, false); assert.equal(writes, S);
  assert.deepEqual(m.mem.slice(0x12100, 0x12900), new Uint8Array(b.subarray(3 * S, 4 * S)));
  const fault = Error('page fault'), before = hash(m.mem); probes = 0; writes = 0;
  m.vmExports.pg_probe = () => { if (++probes === 100) throw fault; return 0; };
  assert.throws(() => call(m, 8), e => e === fault); assert.equal(writes, 0); assert.equal(hash(m.mem), before);
});

test('all unsupported services remain unhandled without device pointers or driver/audio success', () => {
  const m = machine(); mount(m); const before = hash(m.mem);
  for (let al = 0; al < 256; al++) {
    if ([0, 5, 8, 0x0b, 0x0d].includes(al)) continue;
    const q = call(m, al); assert.equal(q.handled, false, `1500+${al.toString(16)}`);
    assert.deepEqual(q.v, { ax: 0x1500 + al, bx: 0x100, cx: 3, dx: 1, si: 0, di: 0, es: 0x200, cf: true });
  }
  assert.equal(hash(m.mem), before);
  m.intCount = new Map(); m.unhandledFn = new Map();
  const v = { ax: 0x1510, cx: 3, es: 0x200, bx: 0x100 };
  assert.equal(m.service(0x2f, { get: k => v[k] || 0, set: () => assert.fail('unsupported driver changed registers') }), false);
  assert.equal(m.unhandledFn.get('2f:15'), 1); // existing observable VM boundary
  assert.equal(hash(m.mem), before);
});
