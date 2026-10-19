'use strict';
// Host/source controls only: no build, guest execution or OS Worker.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { createHostImports } = require('../lib/host-imports');
const { processSharedCtx } = require('../lib/worker-imports');
const oldTZ = process.env.TZ;
try {
  process.env.TZ = 'UTC';
  const buffer = new ArrayBuffer(65536), dv = new DataView(buffer);
  let now = Date.UTC(2024, 0, 15, 12), elapsed = 123;
  const ctx = { getMemory: () => buffer, wallNowMs: () => now,
    guestNowMs: () => elapsed, realNowMs: () => 456 };
  const main = createHostImports(ctx).host;
  const peer = createHostImports({ ...processSharedCtx(ctx), getMemory: ctx.getMemory }).host;
  const input = [2000, 2, 65535, 29, 23, 58, 59, 321];
  const put = fields => fields.forEach((n, i) => dv.setUint16(256 + 2 * i, n, true));
  const read = (host, kind) => {
    assert.equal(host.wall_clock(512, kind), 1);
    return Array.from({ length: 8 }, (_, i) => dv.getUint16(512 + 2 * i, true));
  };
  put(input);
  assert.equal(peer.wall_clock(256, 4), 1);
  assert.equal(now, Date.UTC(2024, 0, 15, 12));
  assert.deepEqual(read(main, 1), [2000, 2, 2, 29, 23, 58, 59, 321]);
  assert.deepEqual(read(peer, 0), read(main, 0));
  assert.equal(main.get_ticks(), 123); assert.equal(main.real_time_ms(), 456);
  main.cmos_io(0x70, 0, 1); assert.equal(main.cmos_io(0x71, 0, 0), 0x59);
  now += 62000; elapsed += 7;
  assert.deepEqual(read(main, 0), [2000, 3, 3, 1, 0, 0, 1, 321]);
  assert.equal(main.get_ticks(), 130);
  main.wall_clock(512, 2);
  assert.equal(dv.getBigUint64(512, true), 116444736000000000n + BigInt(Date.UTC(2000, 2, 1, 0, 0, 1, 321)) * 10000n);
  for (const [field, value] of [[0, 1600], [0, 30828], [1, 0], [1, 13], [3, 0], [3, 30],
    [4, 24], [5, 60], [6, 60], [7, 1000]]) {
    const bad = input.slice(); bad[field] = value; put(bad);
    const before = ctx.calendarClock.now();
    assert.equal(main.wall_clock(256, 4), 0, `${field}=${value}`);
    assert.equal(ctx.calendarClock.now(), before);
  }
  put([1900, 2, 0, 29, 0, 0, 0, 0]); assert.equal(main.wall_clock(256, 4), 0);
  assert.equal(main.wall_clock(65530, 4), 0); assert.equal(main.wall_clock(0, 4), 0);
  const independent = { getMemory: ctx.getMemory, wallNowMs: () => now };
  createHostImports(independent); assert.equal(independent.calendarClock.now(), now);
  // The Windows current-bias rule deliberately differs from interpreting the
  // target civil date in its own DST regime. The second call corrects it.
  process.env.TZ = 'America/New_York';
  now = Date.UTC(2024, 0, 15, 12); ctx.calendarClock.offsetMs = 0;
  put([2024, 7, 0, 1, 12, 0, 0, 0]);
  assert.equal(main.wall_clock(256, 4), 1);
  assert.equal(ctx.calendarClock.now(), Date.UTC(2024, 6, 1, 17));
  assert.equal(read(main, 1)[4], 13);
  assert.equal(main.wall_clock(256, 4), 1);
  assert.equal(ctx.calendarClock.now(), Date.UTC(2024, 6, 1, 16));
  assert.equal(read(main, 1)[4], 12);
  process.env.TZ = 'Asia/Kathmandu';
  put([2024, 7, 0, 1, 12, 0, 0, 0]); assert.equal(main.wall_clock(256, 4), 1);
  assert.equal(ctx.calendarClock.now(), Date.UTC(2024, 6, 1, 6, 15));
  // Exercise production browser context reconstruction, not just shared keys.
  const browser = { console, URLSearchParams, createHostImports, performance,
    setTimeout, clearTimeout, TextDecoder };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8') +
    '\nglobalThis.WineAssembly = WineAssembly;', browser);
  const wine = new browser.WineAssembly(); wine.memory = { buffer };
  const bm = wine.getImports().host;
  const bw = wine.getImports({ ...processSharedCtx(wine.hostCtx), detached: true }).host;
  assert.equal(bw.wall_clock(256, 4), 1);
  assert.deepEqual(read(bm, 0), read(bw, 0));
  const table = require('../src/api_table.json');
  assert.equal(table[627].name, 'SetLocalTime'); assert.equal(table[627].nargs, 1);
  assert(require('../src/kernel32-exports.json').exports.some(e => e.name === 'SetLocalTime' && e.ordinal === 593));
  console.log('SetLocalTime host calendar, validation, DST, CMOS, process/browser sharing PASS');
} finally {
  if (oldTZ === undefined) delete process.env.TZ; else process.env.TZ = oldTZ;
}
