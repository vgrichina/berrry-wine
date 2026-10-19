'use strict';
// Original-free x86 fixture, using an explicitly supplied normal-build module.
// --worker additionally executes the same port program in a real OS Worker.
const assert = require('node:assert/strict');
const fs = require('node:fs'), crypto = require('node:crypto');
const { Worker } = require('node:worker_threads');
const { createHostImports } = require('../lib/host-imports');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const RPC = require('../lib/guest-rpc');
const { sigs } = require('../lib/host-import-sigs.generated.json');
process.env.TZ = 'UTC';
(async () => {
  assert(process.env.WINE_ASSEMBLY_WASM, 'explicit candidate module required; never build implicitly');
  const wasm = fs.readFileSync(process.env.WINE_ASSEMBLY_WASM);
  const module = new WebAssembly.Module(wasm);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  let ticks = 0;
  const origin = Date.UTC(2000, 0, 1, 12, 34, 59);
  const ctx = { getMemory: () => memory.buffer, wallNowMs: () => origin + ticks, guestNowMs: () => ticks };
  const host = createHostImports(ctx).host;
  host.memory = memory; host.log = () => {}; host.log_i32 = () => {};
  const instance = new WebAssembly.Instance(module, { host });
  ctx.exports = instance.exports;
  const e = instance.exports, pe = makeFixture();
  new Uint8Array(memory.buffer).set(pe, e.get_staging()); assert(e.load_pe(pe.length));
  const stack = e.get_esp();
  const bytes = data => { const p = e.guest_alloc(data.length); data.forEach((v, i) => e.guest_write8(p + i, v)); return p; };
  const start = p => { e.set_esp(stack); e.clear_yield(); e.call_func(p, 0, 0, 0, 0); };
  const run = p => { start(p); const before = e.get_esp(); e.run(10000);
    assert.equal(e.get_eip(), 0); assert.equal(e.get_esp(), before + 4); return e.get_eax() >>> 0; };
  // Set NMI mask and register0, preserve high EAX and CF across OUT/IN.
  const immediate = bytes([0xb8, 0x80, 0x56, 0x34, 0x12, 0xe6, 0x70,
    0xb9, 0, 0, 0, 0, 0xf9, 0xe4, 0x71, 0x0f, 0x92, 0xc1, 0xc3]);
  assert.equal(run(immediate), 0x12345659); assert.equal(e.get_ecx(), 1);
  const dx = bytes([0xb8, 2, 0, 0xcd, 0xab, 0x66, 0xba, 0x70, 0, 0xee,
    0x66, 0xba, 0x71, 0, 0xec, 0xc3]);
  assert.equal(run(dx), 0xabcd0034);
  // Seconds poll / RDTSC / next seconds poll / cycle delta. The harness
  // advances the existing clock only between execution slices, never on IN.
  const loop = [0xb0, 0, 0xe6, 0x70, 0xe4, 0x71, 0x88, 0xc3,
    0xe4, 0x71, 0x38, 0xd8, 0x74, 0xfa];
  const calibrate = bytes([...loop, 0x0f, 0x31, 0x89, 0xc6, 0x89, 0xd7,
    ...loop, 0x0f, 0x31, 0x29, 0xf0, 0x19, 0xfa, 0xc3]);
  start(calibrate); e.run(1000); assert.notEqual(e.get_eip(), 0, 'stationary clock keeps poll active');
  ticks = 1000; e.run(1000); assert.notEqual(e.get_eip(), 0, 'second poll waits for another boundary');
  ticks = 2000; e.run(1000); assert.equal(e.get_eip(), 0);
  assert.equal(e.get_eax() >>> 0, 200000000); assert.equal(e.get_edx(), 0);
  if (process.argv.includes('--worker')) {
    ticks = 0;
    const metadata = [1, e.get_image_base(), e.get_code_start(), e.get_code_end(),
      e.get_thunk_base(), e.get_thunk_end(), e.get_num_thunks(), e.get_rsrc_rva()];
    const broker = RPC.createMainBroker(memory, host, sigs);
    const worker = new Worker(`
      const {parentPort,workerData:d}=require('node:worker_threads');
      const rpc=require(d.rpc).createWorkerImports(d.memory,d.sigs,m=>parentPort.postMessage(m),{slot:3});
      const e=new WebAssembly.Instance(d.module,rpc.imports).exports;
      e.init_thread(...d.metadata);e.set_esp(d.stack);e.clear_yield();e.call_func(d.pointer,0,0,0,0);
      const before=e.get_esp();e.run(10000);
      parentPort.postMessage({t:'done',eax:e.get_eax()>>>0,ecx:e.get_ecx(),eip:e.get_eip(),esp:e.get_esp(),before,stats:rpc.stats});
    `, { eval: true, workerData: { module, memory, sigs, metadata,
      rpc: require.resolve('../lib/guest-rpc'), stack: e.guest_alloc(65536) + 65520, pointer: immediate } });
    try {
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('native Worker timeout')), 15000);
        worker.on('error', error => { clearTimeout(timer); reject(error); });
        worker.on('message', m => {
          if (m.t === 'rpc') broker.serveRpc(m.slot);
          else if (m.t === 'calls') broker.serveCalls(m);
          else if (m.t === 'call') broker.serveCall(m);
          else if (m.t === 'done') { clearTimeout(timer); resolve(m); }
        });
      });
      assert.equal(result.eax, 0x12345659); assert.equal(result.ecx, 1);
      assert.equal(result.eip, 0); assert.equal(result.esp, result.before + 4);
    } finally { await worker.terminate(); }
  }
  console.log(JSON.stringify({ result: 'PASS', moduleSha256: crypto.createHash('sha256').update(wasm).digest('hex'),
    fixtureSha256: crypto.createHash('sha256').update(pe).digest('hex'), worker: process.argv.includes('--worker'), calibrationMHz: 200 }));
})().catch(error => { console.error(error); process.exitCode = 1; });
