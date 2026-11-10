'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const vm = require('node:vm');
const d = require('./zuma-initializer-diagnostic.cjs');
const loaderPath = path.resolve(__dirname, '../lib/dll-loader.js');
const source = fs.readFileSync(loaderPath, 'utf8');
const m = new Module(loaderPath, module); m.filename = loaderPath;
m.paths = Module._nodeModulePaths(path.dirname(loaderPath));
m._compile(d.instrument(source), loaderPath);
assert.throws(() => d.instrument(source.replace('function* dllMainSteps(', 'function* changed(')), /anchor/);

function exercise(loader, mode, sink) {
  // Deliberately tiny synthetic host, never loads canonical game code.
  const memory = { buffer: new ArrayBuffer(0x10000) };
  let eip = 0x401234, esp = 0x408000, eax = 9, yieldReason = 5, halt = 0, runs = 0;
  const writes = [];
  const e = { memory, get_image_base: () => 0x400000, guest_to_wasm: a => a >= 0x400000 && a < 0x410000 ? a - 0x400000 : 0xf0,
    get_eip: () => eip, get_esp: () => esp, get_eax: () => eax, get_fs_base: () => 0,
    get_yield_reason: () => yieldReason, get_yield_flag: () => 1, get_last_run_halt: () => halt,
    set_eip: v => { writes.push(['eip', v]); eip = v; }, set_esp: v => { writes.push(['esp', v]); esp = v; },
    set_eax: v => { writes.push(['eax', v]); eax = v; }, clear_yield: () => { yieldReason = 0; },
    set_yield_state: v => { yieldReason = v; },
    run: () => { runs++; if (mode === 'trap') { eip = 0x405555; throw new Error('real trap'); }
      if (mode === 'wait') { eip = 0x405666; halt = 4; return; }
      if (mode === 'exit') { eip = 0; yieldReason = 2; return; }
      eip = 0; esp += 16; eax = mode === 'false' ? 0 : 1; halt = 2;
    } };
  new DataView(memory.buffer).setUint32(0x8000, 0x49b2a6, true);
  globalThis.__zumaInitializerDiagnostic = sink;
  try {
    const outcome = loader.callDllMain(e, 0x989000, 0x405000, null, { maxBlocks: 1 });
    return { outcome: { ...outcome, fault: outcome.fault?.message }, writes, runs, eip, esp, eax, yieldReason };
  } finally { delete globalThis.__zumaInitializerDiagnostic; }
}
for (const mode of ['true', 'false', 'trap', 'wait', 'exit']) {
  const records = [];
  const expected = exercise(require(loaderPath), mode);
  assert.deepEqual(exercise(m.exports, mode, d.createObserver(r => records.push(r))), expected);
  assert.deepEqual(exercise(m.exports, mode, () => { throw new Error('observer failed'); }), expected);
  assert.equal(records.length, 3);
  assert.equal(records[0].regs.eip, 0x401234);
  assert.ok(records[0].stack.hex.startsWith('a6b24900'));
  assert.ok(records[1].stack.hex.startsWith('00000000009098000100000000000000'));
  if (mode === 'trap') { assert.equal(records[2].regs.eip, 0x405555); assert.equal(records[2].detail.fault, 'real trap'); }
  if (mode === 'wait') assert.equal(records[2].detail.halt, 4);
}
const e = { memory: { buffer: new ArrayBuffer(32) }, get_image_base: () => 0x400000,
  guest_to_wasm: a => a === 0x1000 ? 3 : 0xf0 };
assert.equal(d.readGuest(e, 0x1000, 2).unavailable, 'mapping');
assert.equal(d.readGuest(e, 0xffffffff, 2).unavailable, 'range');
let calls = 0; const observe = d.createObserver(() => calls++);
observe({}, 0x1234, 0, 'caller'); assert.equal(calls, 0);
const realm = { memUtils: require('../lib/mem-utils'), console: { log: () => {} } };
vm.runInNewContext(d.browserObserverSource(), realm);
assert.equal(typeof realm.__zumaInitializerDiagnostic, 'function');
assert.throws(() => d.browserObserverSource('0;evil()'), /Invalid target/);
// A real row/path/lifecycle match, not a module-name guess from the base.
const fixture = { memory: { buffer: new ArrayBuffer(4096) },
  guest_to_wasm: a => a >= 0x400000 && a < 0x401000 ? a - 0x400000 : 0xf0,
  get_image_base: () => 0x400000, get_eip: () => 0x400400, get_esp: () => 0x400500,
  get_dll_count: () => 1, get_dll_table: () => 0x100, get_dll_path_table: () => 0x140,
  get_dll_lifecycle_table: () => 0x180, get_dll_lifecycle_stride: () => 64 };
const view = new DataView(fixture.memory.buffer);
view.setUint32(0x100, 0x989000, true); view.setUint32(0x140, 0x400300, true);
view.setUint32(0x184, 7, true);
new Uint8Array(fixture.memory.buffer).set(Buffer.from('C:\\bass.dll\0'), 0x300);
const captured = [];
const capped = d.createObserver(r => captured.push(r));
for (let i = 0; i < 10; i++) capped(fixture, 0x989000, 0x9de043, 'caller');
assert.equal(captured.length, 3); assert.equal(captured[0].rows[0].lifecycle[1], 7);
assert.ok(captured[0].rows[0].path.hex.startsWith(Buffer.from('C:\\bass.dll\0').toString('hex')));
assert.equal(captured[0].entry.unavailable, 'mapping');
const audit = d.audit();
assert.equal(audit.images.length, 2);
assert.equal(audit.images.find(i => /bass/.test(i.file)).bassStage2HasRaw, false);
assert.equal(audit.images.find(i => /bass/.test(i.file)).hypotheticalEntryAt989000, 0x9de043);
console.log('PASS passive actual-loader source: TRUE/FALSE/trap/wait/exit preserve outcomes, writes and run counts; pre-restore frame/code, throwing sink, bounds, canonical inventory');
