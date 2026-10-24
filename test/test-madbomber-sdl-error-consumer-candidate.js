'use strict';
// INTERNAL NATIVE CONSUMER fixture, not a public SDL_OpenAudio failure test.
// Runtime acceptance is pending; see the October 24 report and resource denial.
const fs = require('node:fs'), assert = require('node:assert/strict');
const crypto = require('node:crypto'), path = require('node:path');
const option = name => process.argv.find(a => a.startsWith('--' + name + '='))?.slice(name.length + 3);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const SOURCE = 'b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a';
const MODULE = '8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686';
const SDL = '55eced17cf8a9b7acc671cc307503de847a3c36fdafafe14cee7917433cfe410';
const BINDING = 'c8c7f3e6a80aaa41255c6a4e952dc442b795d5f6b8caac109791d0f603b910a0';
const CONSUMER = Buffer.from('81ec00010000508d4c2404685c87520051ff15c86052008d44240c83c40c8d50018a084084c975f98b8c24040100002bc2ba000100002bd0528d4404045051ff154c6252008d542400526858875200e8ec73000081c408010000c3', 'hex');
(async () => {
  const input = option('input-root'), bindingPath = option('binding');
  assert(input && bindingPath, 'explicit historical input root and sealed binding required');
  const bindingBytes = fs.readFileSync(bindingPath);
  assert.equal(hash(bindingBytes), BINDING, 'sealed historical binding');
  const binding = JSON.parse(bindingBytes);
  assert.equal(binding.source, option('expect-source') || SOURCE, 'historical source identity');
  for (const row of binding.closure) {
    const b = fs.readFileSync(path.join(input, row.path));
    assert.equal(b.length, row.bytes, row.path);
    assert.equal(hash(b), row.sha256, 'historical input ' + row.path);
  }
  const dll = fs.readFileSync(option('sdl'));
  assert.equal(dll.length, 86016); assert.equal(hash(dll), SDL, 'original SDL.dll');
  const bytes = fs.readFileSync(option('wasm'));
  assert.equal(bytes.length, 1879746);
  assert.equal(hash(bytes), option('expect-module') || MODULE, 'normal module identity');
  if (process.argv.includes('--verify-only')) { console.log('Input identities PASS; no native execution'); return; }
  const { createHostImports } = require(path.join(input, 'lib/host-imports'));
  const { makeFixture, iat } = require(path.join(input, 'tools/kernel32-native-fixture'));
  const loader = require(path.join(input, 'lib/dll-loader'));
  const module = await WebAssembly.compile(bytes);
  assert.equal(WebAssembly.Module.imports(module).length, 291);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null, resourceJson: {} };
  const imports = createHostImports(ctx); imports.host.memory = memory;
  for (const item of WebAssembly.Module.imports(module)) {
    assert.equal(item.module, 'host');
    if (item.kind === 'function' && !imports.host[item.name]) {
      imports.host[item.name] = () => { throw Error('Unexpected dependency: ' + item.name); };
    }
  }
  const e = (await WebAssembly.instantiate(module, imports)).exports; ctx.exports = e;
  const b = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const pe = makeFixture(); b.set(pe, e.get_staging()); assert(e.load_pe(pe.length));
  const mapped = loader.loadDll(e, memory.buffer, dll, 'C:\\fixture\\SDL.dll');
  loader.callDllMain(e, mapped.loadAddr, mapped.dllMain, undefined,
    { memoryBuffer: memory.buffer, requireCompletion: true });
  const base = mapped.loadAddr, wa = p => e.guest_to_wasm(p) >>> 0;
  // Compare every consumer byte, normalizing ONLY its four relocated operands.
  const actual = Buffer.from(b.slice(wa(base + 0xcff0), wa(base + 0xcff0) + CONSUMER.length));
  for (const offset of [12, 19, 65, 75]) actual.writeUInt32LE((actual.readUInt32LE(offset) - base + 0x503000) >>> 0, offset);
  assert.deepEqual(actual, CONSUMER, 'original native consumer bytes');
  const stack = e.guest_alloc(65536) + 65520;
  const put = s => { const p = e.guest_alloc(s.length + 1); assert(p); b.set(Buffer.from(s + '\0'), wa(p)); return p; };
  let calls = 0;
  function call(address, args, cdecl = false, eax = null, local = false) {
    e.set_esp(stack); e.call_func(address, ...Array.from({ length: 4 }, (_, i) => args[i] || 0));
    const entry = e.get_esp() >>> 0;
    if (eax !== null) e.set_eax(eax);
    if (local) b.fill(0xa5, wa(entry - 256), wa(entry - 256) + 256);
    for (let n = 0; n < 20000 && e.get_eip(); n++) { e.run(100); assert.equal(e.get_yield_reason(), 0, 'unexpected yield'); }
    assert.equal(e.get_eip(), 0, 'native return sentinel');
    assert.equal(e.get_esp() >>> 0, entry + (cdecl ? 4 : 4 * (args.length + 1)), 'native ABI cleanup');
    assert.equal(dv.getUint32(wa(entry), true), 0, 'return sentinel bounds');
    calls++; return { eax: e.get_eax() >>> 0, entry };
  }
  const api = (name, args) => call(dv.getUint32(wa(iat(name)), true), args).eax;
  const mm = api('LoadLibraryA', [put('winmm.dll')]); assert(mm);
  const wave = api('GetProcAddress', [mm, put('waveOutGetErrorTextA')]); assert(wave);
  // Packed SDL and this lookup receive distinct records for the same API.
  // Compare both names and pinned dispatch IDs, never pointer equality.
  const { describeSystemThunk } = require('./system-thunk-identity');
  const consumerWave = dv.getUint32(wa(base + 0x2324c), true);
  const thunkIdentity = [consumerWave, wave].map(address => describeSystemThunk(e,
    memory.buffer, address, 'waveOutGetErrorTextA', 4590));
  const getError = api('GetProcAddress', [base, put('SDL_GetError')]);
  assert.equal(getError, base + 0x14400, 'original public SDL_GetError');
  const readText = (p, cap) => { let s = ''; for (let i = 0; i < cap; i++) { const c = b[wa(p + i)]; if (!c) return s; s += String.fromCharCode(c); } throw Error('unterminated SDL output'); };
  const results = [];
  for (const label of ['waveOutOpen()', 'waveOutPrepareHeader()']) {
    // Actual caller: push MMRESULT; mov eax,label; call RVA cff0; add esp,4.
    // No waveOutOpen failure is induced and its API expectations are unchanged.
    const code = 32, p = put(label);
    const result = call(base + 0xcff0, [code], true, p, true);
    const expected = label + ': The audio format is not supported.';
    assert.equal(readText(result.entry - 256, 256), expected, 'native local formatting');
    const localBytes = Buffer.from(b.slice(wa(result.entry - 256), wa(result.entry - 256) + 256));
    assert(localBytes.subarray(expected.length + 1).every(v => v === 0xa5), 'local trailing canary');
    assert.equal(dv.getUint32(wa(result.entry + 4), true), code, 'caller argument bounds');
    const output = readText(call(getError, [], true).eax, 1024);
    const oracle = process.argv.includes('--reject-output') ? expected.replace('supported.', 'SUPPORTED.') : expected;
    assert.equal(output, oracle, 'original SDL consumer output oracle');
    results.push({ label, code, output, nativeLocalCapacity: 256, winmmCapacity: 256 - label.length - 2 });
  }
  console.log(JSON.stringify({ scope: 'internal original native SDL consumer', source: SOURCE, module: MODULE,
    sdl: SDL, consumerRVA: 'cff0', waveIATRVA: '2324c', thunkIdentity, calls, results, terminalEIP: e.get_eip(), yield: e.get_yield_reason() }));
})().catch(error => { console.error(error); process.exitCode = 1; });
