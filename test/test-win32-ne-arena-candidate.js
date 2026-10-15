'use strict';
// Explicit prebuilt full-module allocator proof. No compilation or guest API
// dispatch substitutes; NE initialization/QT remain intentionally unactivated.
const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const { createHostImports } = require('../lib/host-imports');
const R = require('../lib/region-map.generated');
const SIZE = 944 * 65536, BASE = 0x400000;
function fixture() {
  const b = Buffer.alloc(0x400), p = 0x80, o = p + 24, s = o + 0xe0;
  b.write('MZ'); b.writeUInt32LE(p, 0x3c); b.writeUInt32LE(0x4550, p);
  b.writeUInt16LE(0x14c, p + 4); b.writeUInt16LE(1, p + 6); b.writeUInt16LE(0xe0, p + 20);
  b.writeUInt16LE(0x10e, p + 22); b.writeUInt16LE(0x10b, o); b.writeUInt32LE(0x1000, o + 16);
  b.writeUInt32LE(BASE, o + 28); b.writeUInt32LE(0x1000, o + 32); b.writeUInt32LE(0x200, o + 36);
  b.writeUInt32LE(0x2000, o + 56); b.writeUInt32LE(0x200, o + 60); b.writeUInt16LE(3, o + 68);
  b.writeUInt32LE(0x100000, o + 72); b.writeUInt32LE(0x1000, o + 76); b.writeUInt32LE(16, o + 92);
  b.write('.text', s); b.writeUInt32LE(0x1000, s + 8); b.writeUInt32LE(0x1000, s + 12);
  b.writeUInt32LE(0x200, s + 16); b.writeUInt32LE(0x200, s + 20); b.writeUInt32LE(0xe0000060, s + 36);
  b[0x200] = 0xc3; return b;
}
async function boot(module, memory, init) {
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  imports.host.memory = memory;
  for (const item of WebAssembly.Module.imports(module)) {
    assert.equal(item.module, 'host');
    if (item.kind === 'function' && !imports.host[item.name])
      imports.host[item.name] = () => { throw Error('Unexpected host import ' + item.name); };
  }
  const e = (await WebAssembly.instantiate(module, imports)).exports;
  if (init) e.init_thread(...init);
  return e;
}
async function child() {
  const e = await boot(workerData.module, workerData.memory, workerData.init);
  parentPort.once('message', () => {
    parentPort.postMessage({ base: e.win16_process_arena_ensure() >>> 0,
      slot: e.win16_dynamic_module_slot(0) >>> 0 }); parentPort.close();
  });
  parentPort.postMessage('ready');
}
async function concurrent(module, memory, e) {
  const workers = [], phases = [], result = []; let failure, wake;
  const changed = () => { if (wake) { const f = wake; wake = null; f(); } };
  const fail = error => { failure = error; changed(); };
  const timer = setTimeout(() => fail(Error('native arena Workers timeout ' + JSON.stringify(phases))), 10000);
  async function until(predicate) {
    while (!predicate()) { if (failure) throw failure; await new Promise(resolve => { wake = resolve; }); }
    if (failure) throw failure;
  }
  try {
    for (let slot = 1; slot <= 2; slot++) {
      const i = slot - 1; phases[i] = [];
      const worker = new Worker(__filename, { workerData: { module, memory,
        init: [slot, e.get_image_base(), e.get_code_start(), e.get_code_end(), e.get_thunk_base(), e.get_thunk_end(), e.get_num_thunks(), 0] } });
      workers.push(worker);
      worker.on('error', fail);
      worker.on('message', event => { if (event === 'ready') phases[i].push('ready'); else { result[i] = event; phases[i].push('done'); } changed(); });
      worker.on('exit', code => {
        phases[i].push('exit:' + code);
        if (code || !result[i]) fail(Error('native arena early exit ' + JSON.stringify(phases[i])));
        changed();
      });
    }
    await until(() => phases.every(p => p.includes('ready')));
    for (const worker of workers) worker.postMessage('go');
    await until(() => phases.every(p => p.includes('exit:0')));
    assert.deepEqual(result[0], result[1]); assert(result[0].base); return result[0];
  } finally { clearTimeout(timer); await Promise.all(workers.map(w => w.terminate())); }
}
async function main() {
  const wasm = process.env.WA_TEST_WASM; assert(wasm, 'explicit prebuilt WA_TEST_WASM required');
  const module = await WebAssembly.compile(fs.readFileSync(wasm));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
  const e = await boot(module, memory), pe = fixture();
  const counts = () => [view.getUint32(R.BASE.VIRTUAL_MAP_STATE, true), view.getUint32(R.BASE.VIRTUAL_MAP_STATE + 16, true)];
  const publication = () => [view.getUint32(R.BASE.WIN16_PROCESS_ARENA, true), view.getUint32(R.BASE.WIN16_PROCESS_ARENA + 4, true)];
  const load = () => { bytes.set(pe, e.get_staging()); assert.equal(e.load_pe(pe.length) >>> 0, BASE + 0x1000); assert.equal(e.get_image_base(), BASE); assert.equal(e.is_win16(), 0); };
  const check = base => {
    assert(base && base % 65536 === 0); assert.deepEqual(publication(), [base, 0]);
    const wa = e.guest_to_wasm(base) >>> 0; assert(wa > R.BASE.VIRTUAL_BACKING_BASE - 1);
    for (let off = 0; off < SIZE; off += 4096) {
      assert.equal(e.guest_to_wasm(base + off) >>> 0, wa + off, 'entire real allocation is affine');
      assert.equal(bytes[wa + off], 0, 'all committed pages initialized');
    }
    assert.equal(e.guest_to_wasm(base + SIZE - 1) >>> 0, wa + SIZE - 1);
    assert.equal(e.win16_dynamic_module_slot(0) >>> 0, wa + 943 * 65536 + 0x8400);
    assert.equal(e.get_image_base(), BASE); assert.equal(e.is_win16(), 0);
    return wa;
  };
  load(); const initial = counts();
  const foreign = e.guest_map_alloc(65536) >>> 0; assert(foreign);
  e.guest_write32(foreign, 0x12345678); e.guest_write32(foreign + 65532, 0x23456789);
  e.guest_write32(BASE + 0x1100, 0x3456789a);
  const before = counts(); const base = e.win16_process_arena_ensure() >>> 0; check(base);
  assert(base + SIZE <= foreign || foreign + 65536 <= base);
  assert.equal(e.win16_process_arena_ensure() >>> 0, base);
  assert.equal(e.guest_read32(foreign) >>> 0, 0x12345678); assert.equal(e.guest_read32(foreign + 65532) >>> 0, 0x23456789);
  assert.equal(e.guest_read32(BASE + 0x1100) >>> 0, 0x3456789a);
  assert.equal(e.win16_process_arena_release(), 1); assert.deepEqual(publication(), [0, 0]); assert.deepEqual(counts(), before);
  assert.equal(e.guest_map_free(foreign), 1); assert.deepEqual(counts(), initial);
  const raced = await concurrent(module, memory, e); const wa = check(raced.base);
  assert.equal(raced.slot, wa + 943 * 65536 + 0x8400);
  assert.equal(counts()[1], initial[1] + 1, 'two real Workers own one reservation');
  // Reload performs release before clearing the old virtual map.
  load(); assert.deepEqual(publication(), [0, 0]); assert.deepEqual(counts(), initial);
  const filler = e.guest_map_alloc(240 * 1024 * 1024) >>> 0; assert(filler, 'controlled real backing exhaustion');
  e.guest_write32(filler, 0x456789ab); const exhausted = counts();
  assert.equal(e.win16_process_arena_ensure(), 0, 'less than 59 MiB backing must fail');
  assert.deepEqual(publication(), [0, 0]); assert.deepEqual(counts(), exhausted, 'failed commit releases new reservation');
  assert.equal(e.guest_read32(filler) >>> 0, 0x456789ab);
  assert.equal(e.guest_map_free(filler), 1); check(e.win16_process_arena_ensure() >>> 0);
  assert.equal(e.win16_process_arena_release(), 1); assert.deepEqual(counts(), initial);
  console.log(JSON.stringify({ passed: true, fixtureSha256: crypto.createHash('sha256').update(pe).digest('hex'),
    arenaBytes: SIZE, concurrentWorkers: 2, realAllocatorExhaustion: true, processReload: true,
    neDllInitialization: false, originalGameRun: false }));
}
(isMainThread ? main() : child()).catch(error => { console.error(error); process.exitCode = 1; });
