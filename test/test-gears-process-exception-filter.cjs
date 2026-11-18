'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const { controlImage, faultImage } = require('../tools/gears-process-exception-filter.cjs');
async function main() {
  const wasm = process.env.GEARS_TEST_WASM ? fs.readFileSync(process.env.GEARS_TEST_WASM)
    : compileSrcWasm(undefined, { tailCalls: !process.argv.includes('--no-tail-calls') });
  async function run(b, expected, trap = false) {
    const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true }), exits = [];
    const ctx = { getMemory: () => memory.buffer, renderer: null,
      resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit: code => exits.push(code >>> 0) };
    const imports = createHostImports(ctx); imports.host.memory = memory; imports.host.log_i32 = () => {};
    const { instance } = await WebAssembly.instantiate(wasm, imports); const x = ctx.exports = instance.exports;
    new Uint8Array(memory.buffer, x.get_staging(), b.length).set(b); assert.equal(x.load_pe(b.length), 0x402000);
    const dv = new DataView(memory.buffer), sp = x.guest_alloc(0x10000) + 0xfff0;
    dv.setUint32(x.guest_to_wasm(sp), 0, true); x.set_esp(sp); x.set_eip(0x402000); x.clear_yield();
    const execute = () => { for (let i = 0; i < 10000 && !exits.length; i++) x.run(1); };
    if (trap) { assert.throws(execute, WebAssembly.RuntimeError); assert.deepEqual(exits, []); return; }
    execute(); assert.deepEqual(exits, [expected >>> 0]);
    if (expected === 0) assert.equal(dv.getUint32(x.guest_to_wasm(0x4014d0), true), 0x600dcafe);
  }
  await run(controlImage(), 0);
  // New memories repeat first-registration=NULL and cannot inherit a dead process.
  await run(controlImage(), 0);
  for (const hardware of [false, true]) {
    for (const disposition of [-1, 0, 1]) await run(faultImage({ hardware, disposition }),
      disposition === -1 ? 0 : hardware ? 0xc0000094 : 0xe1234567);
  }
  await run(faultImage({ flags: 1 }), 0xc0000025);
  await run(faultImage({ disposition: 2 }), 0xc0000026);
  await run(faultImage({ unsupported: true }), 0, true);
  console.log('PASS process filter real PE: replacement/NULL/CRT cdecl, nested callbacks/GPR/ESP, fault CONTEXT edits/software arguments, all dispositions/noncontinuable, lifetime isolation, unsupported API remains trap');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
