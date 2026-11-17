'use strict';
// Real ordinal-only PE import plus public dynamic lookup, executed as x86.
// Supply the locked canonical module; this test does not rebuild the readers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const { createHostImports } = require('../lib/host-imports');
const { VirtualFS } = require('../lib/filesystem');
const apiTable = require('../src/api_table.json');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const raw = r => r - 0x1000 + 0x200;
function image(spelling, stripped = false) {
  const b = makeFixture();
  // Second import descriptor, ILT containing only ordinal 162 and terminator.
  b.writeUInt32LE(60, 0x80 + 24 + 108);
  for (const [r, v] of [[0x1814, stripped ? 0 : 0x1940], [0x1820, 0x18c0],
    [0x1824, 0x1950], [0x1940, 0x800000a2], [0x1950, 0x800000a2]])
    b.writeUInt32LE(v, raw(r));
  b.write(spelling + '\0', raw(0x18c0));
  // Actual guest import call site: tail jump through loader-populated IAT.
  b.set([0xff, 0x25, 0x50, 0x19, 0x40, 0], raw(0x2000));
  return b;
}
async function run() {
  const wasm = fs.readFileSync(process.argv[2] || 'build/wine-assembly.wasm');
  const sims = require('./test-sims-typelib-native.cjs').resource();
  const msPath = process.env.LOADREG_MSFT || 'scratch/runs/20261117-coordinator-bw2-isprobe-input/type-libraries/ISProBENT.tlb';
  const ms = fs.readFileSync(msPath);
  assert.equal(sha(ms), '38b3d8a37e89e8899be78f7787aa2f0ced65c77772689c11115146c8f6654167');
  assert.equal(ms.toString('ascii', 0, 4), 'MSFT');
  const rows = [];
  for (const [spelling, stripped] of [['OLEAUT32.dll', false], ['OlEaUt32.DlL', true]]) {
  require('../lib/storage').clearStore();
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const vfs = new VirtualFS();
  for (const [name, data] of [['sims.tlb', sims.data], ['msft.tlb', ms]])
    vfs.files.set('c:\\' + name, { data, attrs: 0x20 });
  const ctx = { getMemory: () => memory.buffer, renderer: null, vfs, resourceJson: {}, apiTable };
  const imports = createHostImports(ctx);
  Object.assign(imports.host, { memory, create_thread: () => 0, exit_thread: () => 0,
    terminate_thread: () => 0, create_event: () => 0, set_event: () => 0,
    reset_event: () => 0, wait_single: () => 0, wait_multiple: () => 0,
    com_create_instance: () => 0x80004002 });
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const w = instance.exports; ctx.exports = w;
  const read = p => w.guest_read32(p) >>> 0, write = (p, v) => w.guest_write32(p, v);
  const alloc = n => w.guest_alloc(n) >>> 0;
  const string = (s, wide = false) => {
    const b = Buffer.from(s + '\0', wide ? 'utf16le' : 'ascii'), p = alloc(b.length);
    b.forEach((v, i) => w.guest_write8(p + i, v)); return p;
  };
  const stack = 0x074ff000;
  function call(target, args) {
    w.set_esp(stack); write(stack, 0); args.forEach((a, i) => write(stack + 4 + i * 4, a));
    write(stack + 4 + args.length * 4, 0x13579bdf);
    w.set_eip(target); w.set_yield_state(0, 0);
    for (let i = 0; i < 16 && w.get_eip(); i++) w.run(1000);
    assert.equal(w.get_eip(), 0, 'real native call returned to caller');
    assert.equal(w.get_esp() >>> 0, stack + 4 + args.length * 4, 'stdcall ESP');
    assert.equal(read(stack + 4 + args.length * 4), 0x13579bdf, 'caller canary');
    return w.get_eax() >>> 0;
  }
  const api = (name, args) => {
    const table = w.com_bridge_vtable(apiTable.find(a => a.name === name).id, 1);
    const target = read(table); w.guest_free(table); return call(target, args);
  };
  const com = (obj, slot, args = []) => call(read(read(obj) + slot * 4), [obj, ...args]);
    const pe = image(spelling, stripped);
    new Uint8Array(memory.buffer).set(pe, w.get_staging()); assert(w.load_pe(pe.length));
    assert.equal(read(read(0x401950) + 4), 3317, 'real ordinal PE IAT binds native api3317');
    const module = api('LoadLibraryA', [string('oleaut32')]);
    const dynamic = api('GetProcAddress', [module, 162]);
    assert(dynamic); assert.equal(read(dynamic + 4), 3317);
    const named = api('GetProcAddress', [module, string('LoadRegTypeLib')]);
    assert.equal(read(named + 4), read(dynamic + 4), 'named and ordinal public lookup bind the same API');
    for (const alias of ['OLEAUT32.DLL', 'C:\\WINDOWS\\SYSTEM\\oleaut32.dll'])
      assert.equal(api('LoadLibraryA', [string(alias)]), module);
    for (const ordinal of [0, 151, 164, 65535])
      assert.equal(api('GetProcAddress', [module, ordinal]), 0, 'unsupported ordinal remains NULL');
    const out = alloc(128), guid = alloc(16);
    Buffer.from('3004020000000000c000000000000046', 'hex').forEach((b, i) => w.guest_write8(guid + i, b));
    for (const target of [0x402000, dynamic]) {
      for (const version of [1, 2]) {
        assert.equal(call(target, [guid, version, 0, 0x409, out]), 0);
        const lib = read(out); assert(lib); assert(com(lib, 3) >= (version === 1 ? 6 : 27));
        assert.equal(com(lib, 1), 2); assert.equal(com(lib, 2), 1); assert.equal(com(lib, 2), 0);
      }
      write(out, 0xdeadbeef);
      assert.equal(call(target, [guid, 3, 0, 0, out]), 0x8002801d); assert.equal(read(out), 0);
      assert.equal(call(target, [guid, 1, 1, 0, out]), 0x8002801d); assert.equal(read(out), 0);
      assert.equal(call(target, [0, 1, 0, 0, out]), 0x80070057); assert.equal(read(out), 0);
      assert.equal(call(target, [guid, 1, 0, 0, 0]), 0x80004003);
    }
    for (const [file, count] of [['sims.tlb', 87], ['msft.tlb', 209]]) {
      const filename = string('c:\\' + file, true);
      assert.equal(api('LoadTypeLib', [filename, out]), 0, 'LoadTypeLib ' + file + ' ' + spelling); const first = read(out);
      assert.equal(com(first, 3), count); assert.equal(com(first, 7, [out + 4]), 0);
      const attr = read(out + 4), identity = alloc(32);
      for (let i = 0; i < 32; i++) w.guest_write8(identity + i, w.guest_read8(attr + i));
      const major = w.guest_read8(identity + 24) | w.guest_read8(identity + 25) << 8;
      const minor = w.guest_read8(identity + 26) | w.guest_read8(identity + 27) << 8;
      com(first, 12, [attr]);
      assert.equal(api('RegisterTypeLib', [first, filename, 0]), 0);
      const locale = read(identity + 16);
      for (const target of [0x402000, dynamic]) {
        assert.equal(call(target, [identity, major, minor, locale, out]), 0);
        const loaded = read(out); assert.equal(com(loaded, 3), count);
        if (file === 'sims.tlb') {
          assert.equal(com(loaded, 4, [8, out + 20]), 0); const imported = read(out + 20);
          assert.equal(com(imported, 8, [0, out + 24]), 0);
          assert.equal(com(imported, 14, [read(out + 24), out + 28]), 0, 'native stdole imported reference');
          const base = read(out + 28);
          assert.equal(com(base, 12, [0xffffffff, out + 32, 0, 0, 0]), 0);
          const name = read(out + 32);
          let text = ''; for (let i = 0; i < read(name - 4); i += 2) text += String.fromCharCode(w.guest_read8(name + i));
          assert.equal(text, 'IUnknown'); api('SysFreeString', [name]); com(base, 2); com(imported, 2);
        }
        assert.equal(com(loaded, 4, [0, out + 8]), 0); const ti = read(out + 8);
        assert.equal(com(loaded, 2), 1, 'ITypeInfo retains native ITypeLib');
        assert.equal(com(ti, 18, [out + 12, out + 16]), 0);
        assert.equal(read(out + 12), loaded); assert.equal(com(loaded, 2), 1);
        assert.equal(com(ti, 2), 0, 'last typeinfo releases native library');
        for (const args of [[major + 7, minor, locale], [major, minor + 7, locale]]) {
          write(out, 0xdeadbeef); assert.equal(call(target, [identity, ...args, out]), 0x8002801d); assert.equal(read(out), 0);
        }
      }
      // Use the actual registration locale as the positive. A locale with no
      // exact or neutral key must fail unless this library was already neutral.
      const fallback = call(dynamic, [identity, major, minor, 0x411, out]);
      assert.equal(fallback, locale === 0 ? 0 : 0x8002801d);
      if (!fallback) com(read(out), 2); else assert.equal(read(out), 0);
      assert.equal(api('StringFromGUID2', [identity, out + 48, 40]), 39);
      let guidText = ''; for (let i = 0; i < 38; i++) guidText += String.fromCharCode(w.guest_read8(out + 48 + i * 2));
      const key = string('TypeLib\\' + guidText + '\\' + major.toString(16) + '.' + minor.toString(16) + '\\0\\win32');
      assert.equal(api('RegCreateKeyExA', [0x80000000, key, 0, 0, 0, 0x20006, 0, out + 40, 0]), 0);
      const handle = read(out + 40);
      assert.equal(api('RegSetValueExW', [handle, 0, 0, 1, filename, ('c:\\' + file).length * 2 + 2]), 0);
      assert.equal(api('RegCloseKey', [handle]), 0);
      for (const target of [0x402000, dynamic]) {
        assert.equal(call(target, [identity, major, minor, 0x411, out]), 0, 'missing locale falls back to real neutral registry path');
        const neutral = read(out); assert.equal(com(neutral, 3), count); com(neutral, 2);
      }
      const mounted = vfs.files.get('c:\\' + file); vfs.files.delete('c:\\' + file);
      write(out, 0xdeadbeef); assert.equal(call(dynamic, [identity, major, minor, locale, out]), 0x80029c4a); assert.equal(read(out), 0);
      vfs.files.set('c:\\' + file, mounted);
      assert.equal(com(first, 2), 0);
      rows.push({ spelling, stripped, file, count, major, minor, locale, absentLocaleResult: fallback, neutralFallback: true });
    }
    const absent = alloc(16); for (let i = 0; i < 16; i++) w.guest_write8(absent + i, 0xab);
    assert.equal(call(dynamic, [absent, 1, 0, 0, out]), 0x8002801d); assert.equal(read(out), 0);
    assert(![...vfs.files.keys()].some(p => /oleaut32|stdole/i.test(p)), 'genuine provider files absent in execution');
  }
  console.log(JSON.stringify({ status: 'PASS', moduleSHA256: sha(wasm), x86OrdinalOnlyPE: true,
    publicGetProcAddress: true, stdcallAndCanaries: true, lifetime: true, rows,
    SLTGSHA256: sims.metadata.sha256, MSFTSHA256: sha(ms), msPath }));
}
module.exports = { image };
if (require.main === module) run().catch(e => { console.error(e); process.exitCode = 1; });
