'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const { controlImage } = require('../tools/gears-initterm-e.cjs');
async function main() {
  const wasm = process.env.GEARS_TEST_WASM ? fs.readFileSync(process.env.GEARS_TEST_WASM) : compileSrcWasm(undefined,
    { tailCalls: !process.argv.includes('--no-tail-calls') });
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const exits = [], ctx = { getMemory: () => memory.buffer, renderer: null,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit: code => exits.push(code) };
  const imports = createHostImports(ctx); imports.host.memory = memory; imports.host.log_i32 = () => {};
  const { instance } = await WebAssembly.instantiate(wasm, imports); const x = ctx.exports = instance.exports;
  const b = controlImage(); new Uint8Array(memory.buffer, x.get_staging(), b.length).set(b);
  assert.equal(x.load_pe(b.length), 0x402000);
  const dv = new DataView(memory.buffer), sp = x.guest_alloc(0x10000) + 0xfff0;
  dv.setUint32(x.guest_to_wasm(sp), 0, true); x.set_esp(sp); x.set_eip(0x402000); x.clear_yield();
  for (let i = 0; i < 20000 && !exits.length; i++) x.run(1);
  assert.deepEqual(exits, [0], 'guest asserts NULL/empty/success/first-error/stop/nested/cdecl/register/ESP/void/exit callbacks');
  assert.equal(dv.getUint32(x.guest_to_wasm(0x4014d0), true), 0x600dcafe);
  console.log('PASS actual authored PE _initterm_e table/error/nesting/cdecl and existing void/exit paths');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
