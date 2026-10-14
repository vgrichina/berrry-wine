'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Machine } = require('../tools/toyvm/dos');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toyvm-rename-'));
const put = (m, at, s) => m.mem.set(Buffer.from(s + '\0'), at);
function setup() { return new Machine(new Uint8Array(1 << 20), { fileRoot: dir }); }
function rename(m, source, target) {
  put(m, 0x2000, source); put(m, 0x3000, target);
  const v = { ax: 0x5600, ds: 0x200, dx: 0, es: 0x300, di: 0, cf: true };
  const r = { get: k => v[k] || 0, set: (k, n) => { v[k] = n; }, setResultCf: on => { v.cf = on; }, ret: { cs: 0x100, ip: 0x200, sp: 0x100 } };
  v.handled = m.int21(0x56, 0, r);
  return v;
}
function seed(m, name = 'install.tmp', attributes = 0) {
  const rec = { data: Buffer.from('payload'), len: 7, attributes, attributesActive: true };
  m.tempFiles.set(name, rec); return rec;
}
let groups = 0;
function test(name, fn) { fn(); groups++; console.log('PASS ' + name); }
function error(v, code) { assert.strictEqual(v.handled, true); assert.strictEqual(v.cf, true); assert.strictEqual(v.ax, code); }
try {
  test('closed guest file rename publishes identical bytes and removes old name', () => {
    const m = setup(), rec = seed(m), v = rename(m, 'C:\\INSTALL.TMP', 'C:\\SETUP.EXE');
    assert.strictEqual(v.handled, true, 'DOS rename must be handled'); assert.strictEqual(v.cf, false);
    assert(!m.tempFiles.has('install.tmp')); assert.strictEqual(m.tempFiles.get('setup.exe'), rec);
    assert.strictEqual(m.readWholeFile('SETUP.EXE').toString(), 'payload'); assert.strictEqual(m.readWholeFile('INSTALL.TMP'), null);
  });
  test('installer sequence closes renames then reuses temporary name without corrupting published file', () => {
    fs.mkdirSync(path.join(dir, 'DEMO'));
    const m = setup(), h = m.createFile('C:\\DEMO\\INSTALL.TMP'); m.mem.set(Buffer.from('one'), 0x4000);
    m.writeFile(m.files.get(h), 0x4000, 3); m.files.delete(h);
    assert.strictEqual(rename(m, 'C:\\DEMO\\INSTALL.TMP', 'C:\\DEMO\\FIRST.EXE').cf, false);
    const h2 = m.createFile('C:\\DEMO\\INSTALL.TMP'); m.mem.set(Buffer.from('two'), 0x4000);
    m.writeFile(m.files.get(h2), 0x4000, 3); m.files.delete(h2);
    assert.strictEqual(rename(m, 'C:\\DEMO\\INSTALL.TMP', 'C:\\DEMO\\SECOND.EXE').cf, false);
    assert.strictEqual(m.readWholeFile('DEMO/FIRST.EXE').toString(), 'one'); assert.strictEqual(m.readWholeFile('DEMO/SECOND.EXE').toString(), 'two');
    assert.strictEqual(m.readWholeFile('FIRST.EXE'), null);
  });
  test('missing source returns2 and preserves destination', () => { const m = setup(), rec = seed(m, 'dest.exe'); error(rename(m, 'absent.tmp', 'dest.exe'), 2); assert.strictEqual(m.tempFiles.get('dest.exe'), rec); });
  test('existing destination returns5 without replacing either identity', () => { const m = setup(), a = seed(m), b = seed(m, 'setup.exe'); error(rename(m, 'install.tmp', 'SETUP.EXE'), 5); assert.strictEqual(m.tempFiles.get('install.tmp'), a); assert.strictEqual(m.tempFiles.get('setup.exe'), b); });
  test('host destination remains immutable', () => { fs.writeFileSync(path.join(dir, 'host.exe'), 'HOST'); const m = setup(); seed(m); error(rename(m, 'install.tmp', 'HOST.EXE'), 5); assert.strictEqual(fs.readFileSync(path.join(dir, 'host.exe'), 'utf8'), 'HOST'); });
  test('read-only host source is refused instead of writing or hiding corpus files', () => { const m = setup(); error(rename(m, 'HOST.EXE', 'renamed.exe'), 5); assert.strictEqual(m.tempFiles.size, 0); assert.strictEqual(fs.readFileSync(path.join(dir, 'host.exe'), 'utf8'), 'HOST'); });
  test('different drives return17 and preserve source', () => { const m = setup(), rec = seed(m); error(rename(m, 'C:\\INSTALL.TMP', 'D:\\SETUP.EXE'), 17); assert.strictEqual(m.tempFiles.get('install.tmp'), rec); });
  test('guest file shadowing a host source refuses rename without revealing host bytes', () => {
    const m = setup(), rec = seed(m, 'host.exe');
    error(rename(m, 'HOST.EXE', 'renamed.exe'), 5);
    assert.strictEqual(m.tempFiles.get('host.exe'), rec);
    assert.strictEqual(m.readWholeFile('HOST.EXE').toString(), 'payload');
    assert.strictEqual(m.readWholeFile('renamed.exe'), null);
    assert.strictEqual(fs.readFileSync(path.join(dir, 'host.exe'), 'utf8'), 'HOST');
  });
  test('unmounted drive and unavailable directory moves fail explicitly', () => { const m = setup(); seed(m); error(rename(m, 'D:\\INSTALL.TMP', 'D:\\SETUP.EXE'), 3); error(rename(m, 'C:\\ONE\\INSTALL.TMP', 'C:\\TWO\\SETUP.EXE'), 3); });
  test('wildcards and directory-only names are refused', () => { const m = setup(); seed(m); error(rename(m, 'INSTALL.TMP', '*.EXE'), 3); error(rename(m, 'INSTALL.TMP', 'C:\\'), 3); });
  test('read-only hidden and system records are preserved on refusal', () => { for (const attr of [1, 2, 4]) { const m = setup(), rec = seed(m, 'install.tmp', attr); error(rename(m, 'install.tmp', 'setup.exe'), 5); assert.strictEqual(m.tempFiles.get('install.tmp'), rec); } });
  test('open source is refused without disturbing position or buffers', () => { const m = setup(), rec = seed(m), h = m.openFile('INSTALL.TMP'); m.files.get(h).pos = 3; error(rename(m, 'INSTALL.TMP', 'SETUP.EXE'), 5); assert.strictEqual(m.files.get(h).pos, 3); assert.strictEqual(m.files.get(h).rec, rec); });
  test('failed calls update extended error and later successful rename clears it', () => { const m = setup(); error(rename(m, 'missing.tmp', 'setup.exe'), 2); assert.strictEqual(m.lastError, 2); seed(m); assert.strictEqual(rename(m, 'install.tmp', 'setup.exe').cf, false); assert.strictEqual(m.lastError, 0); });
  test('protected paged path strings use guest translation for both pointers', () => {
    const m = setup(), rec = seed(m), strings = new Map();
    for (const [at, s] of [[0x10002000, 'C:\\INSTALL.TMP'], [0x10003000, 'C:\\SETUP.EXE']]) Buffer.from(s + '\0').forEach((b, i) => strings.set(at + i, b));
    const reads = []; m.vmExports = { get_cr0: () => -2147483647, get_dsb: () => 0x10002000, get_esb: () => 0x10003000, get_vm86: () => 0, get_cs: () => 3, pg_read: (at, n, user) => { assert.strictEqual(n, 1); assert.strictEqual(user, 1); reads.push(at); return strings.get(at) || 0; } };
    // This test supplies the paging memory interface, while the actual DOS
    // handler still owns pointer decoding, lookup and the rename transaction.
    const v = rename(m, 'irrelevant', 'irrelevant'); assert.strictEqual(v.cf, false); assert.strictEqual(m.tempFiles.get('setup.exe'), rec);
    assert(reads.some(at => at >= 0x10003000)); assert(reads.every(at => at >= 0x10002000));
  });
  console.log(JSON.stringify({ groups, status: 'PASS' }));
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

// Opt-in native instruction acceptance, run serially on the temporary box.
// The default contracts above do not compile or execute a native module.
if (process.argv.includes('--native')) {
  const nativeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toyvm-rename-com-'));
  const bytes = [], labels = {}, fixups = [];
  const emit = (...v) => bytes.push(...v);
  const address = name => { const at = bytes.length; emit(0, 0); fixups.push({ at, name, relative: false }); };
  const branch = opcode => { emit(0x0f, opcode); const at = bytes.length; emit(0, 0); fixups.push({ at, name: 'fail', relative: true }); };
  const dx = name => { emit(0xba); address(name); };
  const interrupt = ax => emit(0xb8, ax & 255, ax >>> 8, 0xcd, 0x21);
  dx('old'); emit(0x31, 0xc9); interrupt(0x3c00); branch(0x82); emit(0x89, 0xc3);
  dx('data'); emit(0xb9, 7, 0); interrupt(0x4000); branch(0x82);
  emit(0x3d, 7, 0); branch(0x85); interrupt(0x3e00); branch(0x82);
  dx('old'); emit(0xbf); address('new'); interrupt(0x5600); branch(0x82);
  dx('old'); interrupt(0x3d00); branch(0x83); emit(0x3d, 2, 0); branch(0x85);
  dx('new'); interrupt(0x3d00); branch(0x82); emit(0x89, 0xc3);
  dx('buffer'); emit(0xb9, 7, 0); interrupt(0x3f00); branch(0x82);
  emit(0x3d, 7, 0); branch(0x85);
  for (let i = 0; i < 7; i++) { emit(0x80, 0x3e); const at = bytes.length; emit(0, 0); fixups.push({ at, name: 'buffer', add: i, relative: false }); emit(Buffer.from('payload')[i]); branch(0x85); }
  emit(0xb2, 0x52); interrupt(0x0200); interrupt(0x4c00);
  labels.fail = 0x100 + bytes.length; emit(0xb2, 0x58); interrupt(0x0200); interrupt(0x4c01);
  for (const [name, value] of [['old', 'TEMP.DAT\0'], ['new', 'PUBLISHED.DAT\0'], ['data', 'payload'], ['buffer', '\0'.repeat(7)]]) { labels[name] = 0x100 + bytes.length; emit(...Buffer.from(value)); }
  for (const f of fixups) { const value = labels[f.name] + (f.add || 0) - (f.relative ? 0x100 + f.at + 2 : 0); bytes[f.at] = value & 255; bytes[f.at + 1] = value >>> 8 & 255; }
  const exe = path.join(nativeDir, 'RENAME.COM'); fs.writeFileSync(exe, Buffer.from(bytes));
  (async () => {
    try {
      const { runDos, conText } = require('../tools/toyvm/run-dos');
      for (const variant of ['tailcall', 'switch', 'calls', 'repl_tailcall']) {
        const result = await runDos({ exe, variant, seconds: 10, budget: 2000000, autoKey: false });
        assert.strictEqual(conText(result.machine.con).trim(), 'R', variant);
        assert.strictEqual(result.machine.exited, true, variant); assert.strictEqual(result.machine.exitCode, 0, variant);
        assert.strictEqual(result.machine.tempFiles.has('temp.dat'), false);
        assert.strictEqual(Buffer.from(result.machine.tempFiles.get('published.dat').data.subarray(0, 7)).toString(), 'payload');
        console.log('PASS native DOS create/write/close/rename/open/read/exit ' + variant);
      }
    } finally { fs.rmSync(nativeDir, { recursive: true, force: true }); }
  })().catch(e => { console.error(e); process.exitCode = 1; });
}
