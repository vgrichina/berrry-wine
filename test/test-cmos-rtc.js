'use strict';
// Host-only contract test: no wasm build or guest execution.
const assert = require('assert');
const { createHostImports } = require('../lib/host-imports');
const { processSharedCtx } = require('../lib/worker-imports');
process.env.TZ = 'UTC';
let now = Date.UTC(1999, 11, 31, 23, 59, 59, 998);
const ctx = { getMemory: () => new ArrayBuffer(65536), wallNowMs: () => now };
const main = createHostImports(ctx).host;
const workerCtx = { ...processSharedCtx(ctx), getMemory: ctx.getMemory };
const worker = createHostImports(workerCtx).host;
const select = a => main.cmos_io(0x70, a, 1);
const read = a => { select(a); return main.cmos_io(0x71, 0, 0); };
const write = (a, v) => { select(a); main.cmos_io(0x71, v, 1); };
assert.strictEqual(ctx.cmosRtc, workerCtx.cmosRtc);
assert.strictEqual(read(0), 0x59);
for (let i = 0; i < 100; i++) assert.strictEqual(read(0), 0x59, 'reads never advance clock');
select(0x80); // NMI mask must not select a different CMOS bank
assert.strictEqual(worker.cmos_io(0x71, 0, 0), 0x59, 'worker uses shared index latch');
assert.strictEqual(read(0xa), 0x26);
now++;
assert.strictEqual(read(0xa), 0xa6, 'UIP asserted before update');
write(0xa, 0xa6);
now++;
assert.strictEqual(read(0xa), 0x26, 'UIP cannot be written');
assert.deepStrictEqual([0, 2, 4, 7, 8, 9, 0x32].map(read), [0, 0, 0, 1, 1, 0, 0x20]);
assert.strictEqual(read(0xc) & 0x10, 0x10, 'update flag latched');
assert.strictEqual(worker.cmos_io(0x71, 0, 0), 0, 'worker sees status read-clear');
write(0xd, 0); assert.strictEqual(read(0xd), 0x80, 'validity read-only');
now = Date.UTC(2000, 0, 1, 13, 45, 23);
assert.strictEqual(read(4), 0x13);
write(0xb, 0x06);
assert.deepStrictEqual([0, 2, 4].map(read), [23, 45, 13], 'binary calendar');
write(0xb, 0x00);
assert.strictEqual(read(4), 0x81, '12-hour PM');
write(0xb, 0x82);
const held = read(0);
now += 3500;
assert.strictEqual(read(0), held, 'SET inhibits calendar transfers');
assert.strictEqual(read(0xa) & 0x80, 0, 'SET clears UIP');
write(0xb, 2);
assert.strictEqual(read(0), 0x26, 'calendar resumes existing clock');
write(0x10, 0x5a); assert.strictEqual(read(0x10), 0x5a, 'CMOS RAM');
write(1, 0xc0); write(3, 0xc0); write(5, 0xc0);
read(0xc); now += 1000;
assert.strictEqual(read(0xc) & 0x30, 0x30, 'alarm and update latch without IRQ enabled');
read(0xc); now += 1;
assert.strictEqual(read(0xc) & 0x40, 0x40, 'periodic flag independent of interrupt enable');
write(0xc, 0xff); assert.strictEqual(read(0xc), 0, 'status writes do not synthesize flags');
now += 3 * 86400000;
assert.strictEqual(read(0xc) & 0x20, 0x20, 'wildcard alarm survives long calendar jump');
write(1, 0x12); write(3, 0x34); write(5, 0x05);
now += 3 * 86400000;
assert.strictEqual(read(0xc) & 0x20, 0x20, 'ordinary UTC alarm included in bounded long-jump history');
assert.throws(() => write(0xb, 0x42), /IRQ/);
assert.throws(() => write(0, 5), /calendar setting/);
assert.throws(() => write(0xa, 0x66), /oscillator/);
// Rebinding the existing calendar policy must affect the already-created RTC.
ctx.wallNowMs = () => Date.UTC(2000, 0, 1, 1, 2, 3);
assert.strictEqual(read(0), 3);
process.env.TZ = 'Etc/GMT-3';
assert.strictEqual(read(4), 4, 'same local timezone policy as GetLocalTime');
console.log('CMOS host contract PASS (no guest/build)');

// Exercise the actual OS-worker RPC routing, with a synchronous broker pump.
// This instantiates neither a Worker nor wasm. cmos_io must not become a
// worker-local cache or fire-and-forget write: index selection is ordered.
const RPC = require('../lib/guest-rpc');
const { sigs: generated } = require('../lib/host-import-sigs.generated.json');
const sigs = { cmos_io: generated.cmos_io };
assert.deepStrictEqual(sigs.cmos_io, { params: ['i32', 'i32', 'i32'], results: ['i32'] });
const memory = { buffer: new SharedArrayBuffer(8192 * 65536) };
const broker = RPC.createMainBroker(memory, main, sigs);
const rpc = RPC.createWorkerImports(memory, sigs, message => {
  assert.strictEqual(message.t, 'rpc'); broker.serveRpc(message.slot);
}, { slot: 3 });
rpc.imports.host.cmos_io(0x70, 0x82, 1);
assert.strictEqual(main.cmos_io(0x71, 0, 0), 2, 'worker selection reaches process device');
select(0);
assert.strictEqual(rpc.imports.host.cmos_io(0x71, 0, 0), 3, 'worker reads existing process clock');
assert.strictEqual(rpc.stats.local, 0);
assert.strictEqual(rpc.stats.async, 0);
assert.strictEqual(rpc.stats.sync, 2);
console.log('CMOS synchronous broker routing PASS (no OS Worker/guest/build)');
