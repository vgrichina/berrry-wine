'use strict';
// Exact production module smoke: no compiler, transforms or test-only exports.
const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { createHostImports } = require('../lib/host-imports');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');
process.env.TZ = 'UTC';
const option = name => process.argv.find(a => a.startsWith('--' + name + '='))?.slice(name.length + 3);
(async () => {
  const file = option('wasm'), expected = option('sha256');
  assert(file); assert.match(expected || '', /^[a-f0-9]{64}$/);
  const bytes = fs.readFileSync(file);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected);
  const module = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  let now = Date.UTC(2024, 0, 1);
  const ctx = { getMemory: () => memory.buffer, wallNowMs: () => now, guestNowMs: () => 123, renderer: null, resourceJson: {} };
  const imports = createHostImports(ctx);
  imports.host.memory = memory;
  // The file/loader path uses real host implementations. Any unrelated missing
  // dependency must fail loudly if reached, never simulate successful work.
  for (const item of WebAssembly.Module.imports(module)) {
    assert.equal(item.module, 'host');
    if (item.kind === 'function' && !imports.host[item.name]) {
      imports.host[item.name] = () => { throw Error('Unexpected host dependency: ' + item.name); };
    }
  }
  const e = (await WebAssembly.instantiate(module, imports)).exports;
  ctx.exports = e;
  const pe = makeFixture();
  new Uint8Array(memory.buffer).set(pe, e.get_staging()); assert(e.load_pe(pe.length));
  const wa = p => e.guest_to_wasm(p) >>> 0, dv = new DataView(memory.buffer);
  const stack = e.guest_alloc(65536) + 65520;
  const put = text => {
    const p = e.guest_alloc(text.length + 1); assert(p);
    new Uint8Array(memory.buffer).set(Buffer.from(text + '\0'), wa(p)); return p;
  };
  const call = (address, args) => {
    e.set_esp(stack); e.call_func(address, ...Array.from({ length: 4 }, (_, i) => args[i] || 0));
    const before = e.get_esp() >>> 0;
    for (let i = 4; i < args.length; i++) dv.setUint32(wa(before + 4 * (i + 1)), args[i] >>> 0, true);
    for (let n = 0; n < 20000 && e.get_eip(); n++) {
      e.run(100); assert.equal(e.get_yield_reason(), 0, 'nonblocking file API');
    }
    assert.equal(e.get_eip(), 0); assert.equal(e.get_esp() >>> 0, before + 4 * (args.length + 1));
    return e.get_eax() >>> 0;
  };
  const api = (name, args) => call(dv.getUint32(wa(iat(name)), true), args);
  const kernel = api('GetModuleHandleA', [put('kernel32.dll')]); assert(kernel && kernel !== 0x400000);
  const resolve = name => { const p = api('GetProcAddress', [kernel, put(name)]); assert(p, name); return p; };
  const set = resolve('SetLocalTime'), utc = resolve('GetSystemTime');
  const local = resolve('GetLocalTime'), filetime = resolve('GetSystemTimeAsFileTime');
  assert.equal(api('GetProcAddress', [kernel, 593]), set);
  const input = e.guest_alloc(16), output = e.guest_alloc(16);
  const fields = [2000, 2, 65535, 29, 23, 59, 59, 321];
  const fill = p => fields.forEach((n, i) => { e.guest_write8(p + i * 2, n & 255); e.guest_write8(p + i * 2 + 1, n >>> 8); });
  const read = () => Array.from({ length: 8 }, (_, i) => dv.getUint16(wa(output) + 2 * i, true));
  fill(input); api('SetLastError', [12345]);
  assert.equal(call(set, [input]), 1); assert.equal(api('GetLastError', []), 12345);
  assert.equal(now, Date.UTC(2024, 0, 1));
  call(local, [output]); assert.deepEqual(read(), [2000, 2, 2, 29, 23, 59, 59, 321]);
  now += 2000;
  call(utc, [output]); assert.deepEqual(read(), [2000, 3, 3, 1, 0, 0, 1, 321]);
  call(filetime, [output]);
  assert.equal(dv.getBigUint64(wa(output), true), 116444736000000000n + BigInt(Date.UTC(2000, 2, 1, 0, 0, 1, 321)) * 10000n);
  assert.equal(call(set, [0]), 0); assert.equal(api('GetLastError', []), 87);
  fields[3] = 30; fill(input);
  assert.equal(call(set, [input]), 0); assert.equal(api('GetLastError', []), 87);
  call(utc, [output]); assert.deepEqual(read(), [2000, 3, 3, 1, 0, 0, 1, 321]);
  // Reserve two guest pages, commit them on either side of another allocation
  // so the input record cannot be represented by one affine host span.
  const alloc = resolve('VirtualAlloc'), free = resolve('VirtualFree');
  const reservation = call(alloc, [0, 8192, 0x2000, 4]); assert(reservation);
  assert.equal(call(alloc, [reservation, 4096, 0x1000, 4]), reservation);
  const gap = call(alloc, [0, 4096, 0x3000, 4]); assert(gap);
  assert.equal(call(alloc, [reservation + 4096, 4096, 0x1000, 4]), reservation + 4096);
  assert.notEqual(wa(reservation + 4096), wa(reservation) + 4096, 'fixture must be noncontiguous');
  fields[3] = 29; const split = reservation + 4088; fill(split);
  for (let i = 0; i < 100; i++) assert.equal(call(set, [split]), 1, 'gathered input span released');
  call(utc, [output]); assert.deepEqual(read(), [2000, 2, 2, 29, 23, 59, 59, 321]);
  assert.equal(call(free, [reservation, 0, 0x8000]), 1);
  assert.equal(call(free, [gap, 0, 0x8000]), 1);
  assert.equal(imports.host.get_ticks(), 123);
  console.log('SetLocalTime exact production public API/stdcall/calendar/noncontiguous input PASS ' + expected);
})().catch(error => { console.error(error); process.exitCode = 1; });

