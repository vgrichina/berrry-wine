'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const { controlImage, negativeImage, nestedImage } = require('../tools/gears-sse-reshape.cjs');
async function main() {
  const wasm = process.env.WINE_ASSEMBLY_WASM ? fs.readFileSync(process.env.WINE_ASSEMBLY_WASM)
    : compileSrcWasm(undefined, { tailCalls: !process.argv.includes('--no-tail-calls') });
  async function run(b, { trap = false, exit = 0, marker = true, verify } = {}) {
    const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true }), exits = [];
    const ctx = { getMemory: () => memory.buffer, renderer: null,
      resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit: c => exits.push(c >>> 0) };
    const imports = createHostImports(ctx); imports.host.memory = memory; imports.host.log_i32 = () => {};
    const { instance } = await WebAssembly.instantiate(wasm, imports); const x = ctx.exports = instance.exports;
    new Uint8Array(memory.buffer, x.get_staging(), b.length).set(b); assert.equal(x.load_pe(b.length), 0x402000);
    const dv = new DataView(memory.buffer), sp = x.guest_alloc(0x10000) + 0xfff0;
    dv.setUint32(x.guest_to_wasm(sp), 0, true); x.set_esp(sp); x.set_eip(0x402000); x.clear_yield();
    const execute = () => { for (let i = 0; i < 100000 && !exits.length; i++) x.run(1); };
    if (trap) { assert.throws(execute, WebAssembly.RuntimeError); assert.deepEqual(exits, []); return; }
    execute(); assert.deepEqual(exits, [exit >>> 0], JSON.stringify({
      flags: dv.getUint32(x.guest_to_wasm(0x430030), true).toString(16),
      output: Array.from({length:4}, (_,i)=>dv.getUint32(x.guest_to_wasm(0x430020+i*4), true).toString(16)) }));
    if (exit === 0 && marker) assert.equal(dv.getUint32(x.guest_to_wasm(0x4014d0), true), 0x600dcafe);
    if (verify) verify(dv, x);
  }
  const c = controlImage(); await run(c.bytes); await run(c.bytes); // distinct process memories
  await run(nestedImage()); // real nested host->guest filter callback contexts
  for (const code of [
    [0xf2, 0x0f, 0x6e, 0xc0], [0xf3, 0x0f, 0x6e, 0xc0], // unsupported MOVD variants
    [0xf0, 0x66, 0x0f, 0x6e, 0xc0], [0xf2, 0x66, 0x0f, 0x6e, 0xc0],
    [0x66, 0x0f, 0x5b, 0xc0], [0xf3, 0x0f, 0x5b, 0xc0], [0xf2, 0x0f, 0x5b, 0xc0],
    [0x0f, 0xae, 0x15, 0, 0, 0x43, 0], // LDMXCSR: unsupported environment must trap
  ]) await run(negativeImage(code), { trap: true });
  // F2 5A is supported CVTSD2SS. Check literal double 2.5 -> float 2.5,
  // preserving the three destination upper lanes for register and memory forms.
  const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
  for (const memory of [false, true]) {
    const code = [];
    for (const [i, word] of [0, 0x40040000, 0x12345678, 0x90abcdef].entries())
      code.push(0xc7, 5, ...u32(0x430000 + 4 * i), ...u32(word));
    code.push(0x0f, 0x10, 5, ...u32(0x430000)); // MOVUPS XMM0,[input]
    code.push(0xf2, 0x0f, 0x5a, ...(memory ? [5, ...u32(0x430000)] : [0xc0]));
    code.push(0x0f, 0x11, 5, ...u32(0x430020));
    await run(negativeImage(code), { exit: 251, marker: false, verify(dv, x) {
      const read = addr => Array.from({ length: 4 }, (_, i) => dv.getUint32(x.guest_to_wasm(addr + 4 * i), true));
      assert.deepEqual(read(0x430020), [0x40200000, 0x40040000, 0x12345678, 0x90abcdef]);
      assert.deepEqual(read(0x430000), [0, 0x40040000, 0x12345678, 0x90abcdef]);
    } });
  }
  // Existing default SEH termination tags unhandled exceptions with DE00;
  // the exception record/diagnostic itself retains C0000005.
  await run(negativeImage([0x0f, 0x5b, 5, 1, 0, 0x43, 0]), { exit: 0xc000de05 });
  console.log(`PASS ${c.cases} real x86 SSE reshape cases twice; nested filter callback XMM/stack contexts, GPRs/EFLAGS, lane zero/preserve, signed nearest-even, payloads/subnormals, MMX distinction, unsupported prefixes/environment and alignment fault`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
