'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const { BASE: REGION } = require('../lib/region-map.generated');
const { controlImage, vectors } = require('../tools/gears-encode-pointer.cjs');
async function main() {
  const wasm = process.env.GEARS_TEST_WASM ? fs.readFileSync(process.env.GEARS_TEST_WASM)
    : compileSrcWasm(undefined, { tailCalls: !process.argv.includes('--no-tail-calls') });
  async function processMemory(entropy) {
    const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
    const dv = new DataView(memory.buffer), exits = [];
    async function instance(tid) {
      const ctx = { getMemory: () => memory.buffer, renderer: null,
        resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit: n => exits.push(n) };
      const imports = createHostImports(ctx); imports.host.memory = memory; imports.host.log_i32 = () => {};
      if (entropy) imports.host.entropy_u32 = entropy;
      const { instance } = await WebAssembly.instantiate(wasm, imports); const x = ctx.exports = instance.exports;
      return x;
    }
    const x = await instance(0), b = controlImage();
    new Uint8Array(memory.buffer, x.get_staging(), b.length).set(b); assert.equal(x.load_pe(b.length), 0x402000);
    const sp = x.guest_alloc(0x10000) + 0xfff0;
    function begin(who, entry, stack = sp) {
      dv.setUint32(who.guest_to_wasm(stack), 0, true);
      who.set_esp(stack); who.set_eip(entry); who.clear_yield();
    }
    function finish(who) {
      for (let i = 0; i < 10000 && (who.get_eip() >>> 0) > 2 && !exits.length; i++) who.run(1);
    }
    const get = r => dv.getUint32(x.guest_to_wasm(0x400000 + r), true);
    function probe(who, value, decode = false) {
      exits.length = 0; dv.setUint32(x.guest_to_wasm(0x4014e0), value, true);
      begin(who, decode ? 0x402d40 : 0x402d00); finish(who);
      assert.equal(who.get_esp() >>> 0, sp + 4, 'stdcall API removes argument, cdecl probe RET removes return');
      return get(0x14e4);
    }
    return { x, instance, memory, dv, exits, begin, finish, probe, get };
  }
  const p = await processMemory();
  p.begin(p.x, 0x402000); p.finish(p.x);
  assert.deepEqual(p.exits, [0], 'real PE asserts vectors, inverse, stability, GPRs, last error, ESP and CRT constructor');
  assert.equal(p.get(0x14d0), 0x600dcafe);
  const w = await p.instance(1);
  w.init_thread(1, p.x.get_image_base(), p.x.get_code_start(), p.x.get_code_end(),
    p.x.get_thunk_base(), p.x.get_thunk_end(), p.x.get_num_thunks(), p.x.get_rsrc_rva());
  for (const v of vectors) {
    const encoded = p.probe(p.x, v); assert.equal(p.probe(w, v), encoded, 'same process, distinct thread/instance');
    assert.equal(p.probe(w, encoded, true), v);
  }
  const oldNull = p.probe(p.x, 0), q = await processMemory();
  assert.notEqual(q.probe(q.x, 0), oldNull, 'new process/lifetime uses fresh entropy even with same default PID');
  // Deterministic entropy and a reentrant contender demonstrate atomic winner
  // selection. The outer first-use resumes after another instance publishes.
  let calls = 0, contender, r;
  r = await processMemory(() => {
    calls++; if (calls === 1) { r.probe(contender, 0); return 0x12345678; }
    return 0x80000001;
  });
  contender = await r.instance(1);
  contender.init_thread(1, r.x.get_image_base(), r.x.get_code_start(), r.x.get_code_end(),
    r.x.get_thunk_base(), r.x.get_thunk_end(), r.x.get_num_thunks(), r.x.get_rsrc_rva());
  const encoded = r.probe(r.x, 0);
  assert.equal(r.dv.getUint32(REGION.POINTER_SECRET, true), 0x80000001);
  assert.equal(r.probe(contender, 0), encoded); assert.equal(calls, 2, 'one immutable winning process secret');
  let zeroCalls = 0; const z = await processMemory(() => ++zeroCalls === 1 ? 0 : 0xdeadbeef);
  assert.equal(z.probe(z.x, z.probe(z.x, 0xffffffff), true), 0xffffffff); assert.equal(zeroCalls, 2);
  console.log('PASS imported pointer APIs: opaque inverse/all DWORDs/NULL/-1, stdcall/cdecl/GPR/ESP/last-error, CRT constructor, process lifetime, thread instances and atomic first-use winner');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
