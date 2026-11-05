#!/usr/bin/env node
'use strict';
// Production Wasm, real decoder/NE relocations and browser log_i32 collector.
// All x86/NE input is generated; no game media participates in this regression.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHostImports } = require('../lib/host-imports');
const { neLifecycleImage } = require('./helpers/ne-lifecycle-image');
const { makeWorkerApiLogger } = require('../lib/worker-imports');

function image({ library = false, target = 0xffef, wrap = false, relocated = false, thunk = false } = {}) {
  const b = Buffer.alloc(0x500);
  neLifecycleImage({ dependencies: thunk ? ['KERNEL'] : [] }).copy(b);
  const n = 0x80, w = (off, value) => b.writeUInt16LE(value, off);
  w(n + 12, library ? 0x8001 : 1);
  w(n + 0x12, 0x100); w(n + 0x18, 0xff00); w(n + 0x1a, 2);
  w(n + 0x4e, 0); // full data/stack segment
  b.fill(0x90, 0x200, 0x300);
  // ES:[BX+24h] must select DS copied into ES, and wrap its 16-bit offset.
  const bx = wrap ? 0xfff0 : 0x80, operand = (bx + 0x24) & 0xffff;
  b.set([0xbb, bx & 255, bx >>> 8, 0xbe, 0x40, 0, 0x1e, 0x07,
    0x26, 0xff, 0x5f, 0x24, 0xeb, 0xfe], 0x200);
  b.set([0xb8, 0x34, 0x12, 0xcb], 0x250);
  w(0x300 + operand, relocated || thunk ? 0xffff : 0xbeef);
  w(0x302 + operand, target);
  if (relocated || thunk) {
    w(n + 0x4c, 0x101); // data segment has a relocation table
    w(0x400, 1);
    b.set([3, thunk ? 1 : 0], 0x402); // POINTER32, internal/importordinal
    w(0x404, operand); w(0x406, 1); w(0x408, thunk ? 3 : 0x50);
  }
  return { bytes: b, operand, bx };
}

// Exercise the real init-created cooperative import factory. Only external
// services and Wasm allocation/instantiation are faked in this lifetime check.
async function collectorLifetime(source) {
  const { processSharedCtx } = require('../lib/worker-imports');
  let childFactory, throwLog = false;
  const output = [];
  class Manager {
    constructor(_module, _memory, _instance, factory) { childFactory = factory; }
    recordInheritedWasmGlobal() {}
  }
  const sandbox = {
    createHostImports, processSharedCtx, makeWorkerApiLogger,
    window: {}, setTimeout, clearTimeout, ThreadManager: Manager,
    console: { log() {}, warn() {}, error(line) {
      if (throwLog) throw Error('sink failed');
      output.push(line);
    } },
    WebAssembly: {
      Memory: class { constructor() { this.buffer = new ArrayBuffer(65536); } },
      Module: { customSections: () => [] },
      instantiate: async () => ({ exports: { get_eax: () => 11 } }),
    },
  };
  vm.runInNewContext(source + '\n;globalThis.Host = WineAssembly;', sandbox);
  sandbox.Host.getWasmModule = async () => ({});
  const wine = new sandbox.Host();
  wine.apiTable = [];
  wine.logToUI = () => {};
  wine.ensureUiFontsReady = wine.loadFiles = wine.loadSubstituteFonts = async () => {};
  wine._schedArm = () => false;
  wine._maybeStartGuestWorker = async () => {};
  await wine.init(null);
  const mainCtx = wine.hostCtx, parent = wine._mainImports;
  const child = childFactory(9), sibling = childFactory(10);
  child.__setInstance({ exports: { get_eax: () => 99 } });
  sibling.__setInstance({ exports: { get_eax: () => 100 } });
  assert.equal(wine.hostCtx, mainCtx, 'detached children preserve main context ownership');
  const view = new DataView(wine.memory.buffer);
  // Tiny live ownership tables at arbitrary fixture addresses.
  [0x123400, 65535, 1, 7].forEach((v, i) => view.setUint32(0x110 + i * 4, v, true));
  [0x80, 4, 0x2000, 2].forEach((v, i) => view.setUint32(0x200 + i * 4, v, true));
  const words = [0x123420, 0xbeef, 0xffef, 0x1010, 0x1000,
    0x0f, 0x1000, 0x17, 0x2000, 0x2200, 0x17, 0x2000, 0x17, 0x2000,
    0x100, 2, 0x200, 1, 0x80, 2, 0x3000];
  const emit = (imports, values = words) => {
    imports.host.log_i32(0xCA165E23);
    values.forEach(v => imports.host.log_i32(v));
  };
  // Interleave half a parent record with a whole child and sibling record.
  parent.host.log_i32(0xCA165E23);
  words.slice(0, 8).forEach(v => parent.host.log_i32(v));
  assert.equal(wine.lastWin16FarFault, undefined);
  emit(child);
  const childRecord = wine.lastWin16FarFault;
  assert(childRecord, 'production cooperative imports retain failure diagnostics with verbose disabled');
  assert.equal(childRecord.threadId, 9);
  assert.equal(childRecord.registers.eax, 99, 'cooperative collector uses its own live exports');
  emit(sibling);
  assert.equal(wine.lastWin16FarFault.threadId, 10);
  assert.equal(wine.lastWin16FarFault.registers.eax, 100);
  words.slice(8).forEach(v => parent.host.log_i32(v));
  const parentRecord = wine.lastWin16FarFault;
  assert.equal(parentRecord.threadId, 0);
  assert.equal(parentRecord.registers.eax, 11);
  assert.equal(mainCtx.lastWin16FarFault, parentRecord);
  assert.equal(output.length, 3, 'all production import paths ignore verbose-off API filtering');
  const retained = JSON.stringify(childRecord);
  new Uint8Array(wine.memory.buffer).fill(0);
  assert.equal(JSON.stringify(childRecord), retained, 'retained tables are value copies');
  assert.equal(childRecord.segments[0].base, 0x123400);
  assert.equal(childRecord.modules[0].image, 0x2000);
  // A faulty table read is recorded and the collector resets before it; no
  // readback/sink exception may prevent returning to the original CS trap.
  const bad = words.slice(); bad[14] = 65535;
  emit(child, bad);
  assert.match(wine.lastWin16FarFault.captureError, /RangeError/);
  throwLog = true;
  emit(child);
  assert.match(wine.lastWin16FarFault.logError, /sink failed/);
  throwLog = false;
  wine.memory = null;
  emit(child);
  assert.match(wine.lastWin16FarFault.captureError, /TypeError/);
  assert.equal(JSON.stringify(childRecord), retained, 'retired memory is never retained by a fault record');
  wine.memory = { buffer: new ArrayBuffer(65536) };
  emit(child);
  assert.equal(wine.lastWin16FarFault.captureError, undefined, 'collector recovers after capture failures');
  assert.equal(wine.lastWin16FarFault.threadId, 9);
  assert.equal(mainCtx.lastWin16FarFault, parentRecord, 'child never overwrites parent context evidence');
  wine._releaseGuestMemory();
  assert.equal(wine.memory, null);
  assert.equal(wine.instance, null);
  assert.equal(wine.hostCtx, null);
  assert.equal(parent.host.memory, null, 'ordinary host retirement clears the import memory pin');
  assert.equal(JSON.stringify(childRecord), retained, 'copied evidence survives ordinary host retirement');
  emit(parent);
  assert.match(wine.lastWin16FarFault.captureError, /TypeError/, 'late diagnostic cannot read retired memory');
  console.log('PASS far-fault collector lifetime: production cooperative imports, isolated/interleaved contexts, copied tables, capture/sink exceptions and retired memory');
}

(async () => {
  await collectorLifetime(fs.readFileSync(path.join(__dirname, '../host.js'), 'utf8'));
  if (process.env.WIN16_FAR_FAULT_COLLECTOR_ONLY === '1') return;
  const output = [];
  const context = { createHostImports, console: { log() {}, error: line => output.push(line) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../host.js'), 'utf8') +
    '\n;globalThis.Host = WineAssembly;', context);
  const module = await WebAssembly.compile(fs.readFileSync(process.env.WINE_TEST_WASM || path.join(__dirname, '../build/wine-assembly.wasm')));
  for (const config of [
    { target: 0xffef }, { target: 0, wrap: true }, { library: true, target: 0xffe7 },
    { relocated: true }, { relocated: true, wrap: true }, { thunk: true },
  ]) {
    output.length = 0;
    // Each generated task is a fresh process. Reusing another process's shared
    // memory also reuses its decoded blocks, unlike a real browser launch.
    const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
    const wine = new context.Host();
    wine.memory = memory; wine.logToUI = () => {}; wine.processId = 7;
    const imports = wine.getImports(config.library ? { detached: true, threadId: 1 } : {});
    imports.host.memory = memory;
    if (config.library) {
      const workerLog = makeWorkerApiLogger({ getBuffer: () => memory.buffer, threadId: 1,
        shouldLog: () => false, emit: line => output.push(line) });
      imports.host.log_i32 = value => {
        if (!imports.__captureWin16FarFault(value)) workerLog.log_i32(value);
      };
    }
    let captured = null, returned = false;
    const sink = imports.host.log_i32;
    imports.host.log_i32 = value => {
      sink(value);
      if (wine.lastWin16FarFault && !captured) {
        assert.equal(returned, false, 'record exists synchronously before the trap returns');
        captured = JSON.parse(JSON.stringify(wine.lastWin16FarFault));
        assert.equal(wine.instance.exports.win16_sreg(1), captured.cs, 'CS is still the source');
        assert.equal(wine.instance.exports.get_esp() >>> 0, captured.esp, 'capture precedes far return-frame push');
      }
    };
    wine.instance = await WebAssembly.instantiate(module, imports);
    const e = wine.instance.exports, bytes = new Uint8Array(memory.buffer);
    const generated = image(config);
    const stage = config.library ? image().bytes : generated.bytes;
    bytes.set(stage, e.get_staging());
    assert(e.load_ne(stage.length) > 0);
    if (config.library) {
      const occupied = new Set();
      for (let i = 1; i < 256; i++) if (e.win16_seg_base(i)) occupied.add(i);
      const staging = e.win16_dll_staging(13);
      bytes.set(generated.bytes, staging);
      assert.equal(e.load_ne_dll_sized(13, generated.bytes.length), 1);
      const added = [];
      for (let i = 1; i < 256; i++) if (!occupied.has(i) && e.win16_seg_base(i)) added.push(i);
      assert(added.length >= 2);
      e.win16_set_sreg(1, (added[0] << 3) | 7);
      e.win16_set_sreg(3, (added[1] << 3) | 7);
      e.set_eip(e.win16_seg_base(added[0]));
    }
    const cs = e.win16_sreg(1), ds = e.win16_sreg(3);
    const csBase = e.win16_seg_base(cs >>> 3) >>> 0;
    const dsBase = e.win16_seg_base(ds >>> 3) >>> 0;
    const sp = e.get_esp() >>> 0, address = dsBase + generated.operand;
    const operandBefore = Buffer.from([0, 1, 2, 3].map(i => e.guest_read8(address + i)));
    const fails = !config.relocated && !config.thunk;
    if (fails) assert.throws(() => e.run(20), WebAssembly.RuntimeError);
    else e.run(20);
    returned = true;
    if (fails) {
      assert(captured, 'real browser import retained the failure with verbose disabled');
      assert.equal(captured.captureError, undefined);
      assert.equal(captured.threadId, config.library ? 1 : 0);
      assert.equal(captured.operandAddress, address);
      assert.equal(captured.targetOffset, 0xbeef);
      assert.equal(captured.targetSelector, config.target);
      assert.equal(captured.returnAddress, csBase + 12);
      assert.equal(captured.cs, cs); assert.equal(captured.csBase, csBase);
      assert.equal(captured.ds, ds); assert.equal(captured.es, ds);
      assert.equal(captured.esp, sp); assert.equal(captured.registers.ebx & 0xffff, generated.bx);
      assert.equal(captured.registers.esi & 0xffff, 0x40);
      assert.equal(captured.segments.find(s => s.index === (cs >>> 3)).neSegment, 1);
      assert.equal(captured.segments.find(s => s.index === (ds >>> 3)).neSegment, 2);
      if (config.library) {
        const owner = captured.modules.find(m => m.id === 13);
        assert(owner && owner.segmentCount === 2);
        assert.equal((cs >>> 3) - owner.segmentBase, 1);
        assert.equal((ds >>> 3) - owner.segmentBase, 2);
      } else assert.equal(captured.taskSegments, 2);
      assert.equal(e.win16_sreg(1), cs, 'unmapped CS rejection is preserved');
      assert.equal(e.get_esp() >>> 0, sp - 4, 'existing fault path still pushes the frame');
      assert.equal(output.filter(line => line.startsWith('[Win16 far fault] ')).length, 1);
      const logged = JSON.parse(output.find(line => line.startsWith('[Win16 far fault] ')).slice(18));
      assert.deepEqual(logged, captured, 'saved diagnostic and unconditional JSON log agree');
    } else {
      assert.equal(captured, null, 'valid internal/imported targets do not produce a failure record');
      assert.equal(output.length, 0);
      if (config.relocated) assert.equal(e.get_eax() & 0xffff, 0x1234);
      assert.equal(e.get_esp() >>> 0, sp);
    }
    assert.deepEqual(Buffer.from([0, 1, 2, 3].map(i => e.guest_read8(address + i))), operandBefore,
      'diagnostic never writes the operand');
  }
  console.log('PASS Win16 far-call evidence: invalid/null/module owners before trap, ES displacement/wrap, real NE internal/import relocations, CS rejection and unchanged operand');
})().catch(error => { console.error(error); process.exitCode = 1; });
