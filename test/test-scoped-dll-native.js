'use strict';
// Prepared native conformance: requires an explicitly built canonical module;
// never builds one. This tests the lifecycle primitive, not callback transport.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHostImports } = require('../lib/host-imports');
const boot = require('../lib/process-boot');
const { X86, pe, BASE, DATA } = require('./test-dll-lifecycle-real-pe');

async function main() {
  const module = await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM ||
    path.join(__dirname, '../build/wine-assembly.wasm')));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit() {} };
  const imports = createHostImports(ctx); imports.host.memory = memory; imports.host.has_dll_file = () => 1;
  const { exports: ex } = await WebAssembly.instantiate(module, imports); ctx.exports = ex;
  const load = new X86().push(BASE + 0x1500).api('LoadLibraryA').emit(0xc3).finish();
  const free = new X86().emit(0x50).api('FreeLibrary').emit(0xc3).finish();
  const exe = pe([[0x2000, load], [0x2200, free], [0x1500, 'scoped.dll\0']]);
  new Uint8Array(memory.buffer, ex.get_staging(), exe.length).set(exe); ex.load_pe(exe.length);
  const dll = pe([[0x1000, new X86().emit(0x8b, 0x44, 0x24, 8,
    0xff, 0x04, 0x85, [DATA & 255, DATA >>> 8 & 255, DATA >>> 16 & 255, DATA >>> 24],
    0xb8, 1, 0, 0, 0, 0xc2, 12, 0).finish()]], true);
  const view = new DataView(memory.buffer), events = [];
  const invoke = (entry, arg = 0) => {
    const stack = ex.guest_alloc(0x10000), sp = stack + 0xfff0;
    view.setUint32(ex.guest_to_wasm(sp), 0, true);
    ex.set_esp(sp); ex.set_eip(BASE + entry); ex.set_eax(arg); ex.clear_yield();
    let tx = null;
    try {
      for (let turn = 0; turn < 20000; turn++) {
        if (tx) {
          const done = tx.advance(1000);
          if (done.done) { events.push(done); tx = null; }
        } else ex.run(1000);
        if (ex.get_yield_reason() === 5) {
          assert.equal(tx, null, 'fixture DllMain contains no nested load');
          tx = boot.beginScopedLibraryYield({ exports: ex, memoryBuffer: memory.buffer });
          assert(tx);
          if (!tx.request.unload) tx.prepare({ bytes: dll });
        } else if (!tx && !ex.get_eip()) return ex.get_eax() >>> 0;
      }
      throw new Error('Native scoped operation exceeded its bound');
    } finally { tx?.cancel(); ex.guest_free(stack); }
  };
  const handle = invoke(0x2000); assert(handle);
  const row = ex.get_dll_index(handle), generation = ex.get_dll_generation(row);
  const life = ex.get_dll_lifecycle_table() + row * ex.get_dll_lifecycle_stride();
  assert.equal(view.getUint32(life, true), 2, 'actual native LIVE after attach');
  assert.equal(view.getUint32(life + 12, true), 0, 'mapping pin released');
  assert.equal(view.getUint32(ex.guest_to_wasm(DATA + 4), true), 1, 'actual x86 attach');
  assert.equal(invoke(0x2200, handle), 1);
  assert.equal(view.getUint32(life, true), 0, 'native retirement completed');
  assert.equal(view.getUint32(ex.guest_to_wasm(DATA), true), 1, 'actual x86 detach');
  assert.equal(events[0].mapped[0].result.generation, generation);
  assert.equal(events[1].retired[0].generation, generation);
  console.log('PASS native scoped load/attach/FreeLibrary/detach/generation receipt');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
