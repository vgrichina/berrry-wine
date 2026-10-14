'use strict';

// Pure JS INT 21h contracts, also against both shipped bundles. No guest,
// browser, Wasm compiler or original game fixture is run by this test.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { Machine } = require('../tools/toyvm/dos');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'toyvm-paths-'));
const payload = { 'DATA.FIL': 'root', 'PLAIN': 'plain', 'CRISIS.': 'legacy' };
for (const dir of ['DATA', 'FLICS', 'GFX', 'LFX', 'SFX']) payload[dir + '/DATA.FIL'] = dir;
payload['DATA/SECOND.TXT'] = 'second';
payload['DATA/SUB/DEEP.DAT'] = 'deep';
for (const [name, data] of Object.entries(payload)) {
  fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
  fs.writeFileSync(path.join(root, name), data);
}
function put(m, value, at = 0x2000) { m.mem.set(Buffer.from(value + '\0', 'latin1'), at); }
function string(m, at) { let end = at; while (m.mem[end]) end++; return Buffer.from(m.mem.slice(at, end)).toString('latin1'); }
function call(m, ah, name, args = {}, al = 0) {
  if (name !== undefined) put(m, name);
  const v = { ds: 0x200, dx: 0, ...args };
  const r = { get: k => v[k] || 0, set: (k, n) => v[k] = n, setResultCf: b => v.cf = b };
  v.handled = m.int21Call(ah, al, r);
  assert.equal(v.handled, true);
  return v;
}
function fail(v, code) { assert.equal(v.cf, true); assert.equal(v.ax, code); }
let groups = 0;
function suite(label, Klass, fileRoot) {
  const fresh = () => new Klass(new Uint8Array(1 << 20), { fileRoot });
  const test = (name, fn) => { fn(); groups++; console.log('PASS ' + label + ': ' + name); };
  test('five same-basename files return five distinct original byte strings', () => {
    const m = fresh();
    for (const dir of ['DATA', 'FLICS', 'GFX', 'LFX', 'SFX']) {
      const v = call(m, 0x3d, dir + '\\DATA.FIL'); assert.equal(v.cf, false);
      assert.equal(Buffer.from(m.files.get(v.ax).buf).toString(), dir);
    }
    assert.equal(m.readWholeFile('data.fil').toString(), 'root');
  });
  test('case separators dot and parent normalization preserve the namespace', () => {
    const m = fresh();
    for (const name of ['c:\\DaTa\\DATA.FIL', './data//data.fil', 'DATA/SUB/.././data.fil']) assert.equal(m.readWholeFile(name).toString(), 'DATA');
    assert.equal(m.readWholeFile('../../PLAIN').toString(), 'plain');
    assert.equal(m.readWholeFile('CRISIS.ÿ').toString(), 'legacy');
    for (const name of ['MISSING/DATA.FIL', 'D:/DATA.FIL', '//server/DATA.FIL', 'DATA:FILE', 'DATA/*.FIL', 'DATA/']) assert.equal(m.readWholeFile(name), null, name);
    fail(call(m, 0x3d, 'MISSING/DATA.FIL'), 3);
    fail(call(m, 0x3d, 'DATA/MISSING.FIL'), 2);
    fail(call(m, 0x3d, 'DATA'), 5);
  });
  test('cwd and C:relative versus root-relative paths; invalid chdir is atomic', () => {
    const m = fresh(); assert.equal(call(m, 0x3b, 'data/sub').cf, false);
    assert.equal(m.readWholeFile('C:DEEP.DAT').toString(), 'deep');
    assert.equal(m.readWholeFile('\\DATA.FIL').toString(), 'root');
    assert.equal(call(m, 0x47, undefined, { si: 0x100, dx: 3 }).cf, false);
    assert.equal(string(m, 0x2100), 'DATA\\SUB');
    for (const name of ['D:\\', '../missing', '../DATA.FIL']) fail(call(m, 0x3b, name), 3);
    assert.equal(m.currentDirectory, 'data/sub');
    fail(call(m, 0x47, undefined, { dx: 4 }), 15);
    assert.equal(call(m, 0x0e, undefined, { dx: 3 }).ax & 255, 3);
    assert.equal(call(m, 0x19).ax & 255, 2);
    assert.equal(call(m, 0x3b, '..').cf, false);
    assert.equal(m.readWholeFile('C:DATA.FIL').toString(), 'DATA');
  });
  test('overlay copies on write remember opening directory after cwd changes', () => {
    const m = fresh(), handle = call(m, 0x3d, 'DATA/DATA.FIL').ax;
    call(m, 0x3b, 'SFX'); put(m, 'new');
    assert.equal(call(m, 0x40, undefined, { bx: handle, cx: 3 }).cf, false);
    assert.equal(m.readWholeFile('C:/DATA/DATA.FIL').toString(), 'newA');
    assert.equal(m.readWholeFile('DATA.FIL').toString(), 'SFX');
    assert.equal(m.readWholeFile('C:/DATA.FIL').toString(), 'root');
    fail(call(m, 0x41, 'C:/DATA/DATA.FIL'), 5);
    assert.equal(fresh().readWholeFile('DATA/DATA.FIL').toString(), 'DATA');
  });
  test('create and temporary-file names are directory scoped; missing parent fails', () => {
    const m = fresh();
    for (const d of ['DATA', 'SFX']) {
      const v = call(m, 0x3c, d + '/NEW.DAT'); assert.equal(v.cf, false);
      put(m, d); call(m, 0x40, undefined, { bx: v.ax, cx: d.length }); call(m, 0x3e, undefined, { bx: v.ax });
      assert.equal(m.readWholeFile(d + '/NEW.DAT').toString(), d);
    }
    fail(call(m, 0x3c, 'MISSING/NEW.DAT'), 3);
    fail(call(m, 0x3c, 'DATA'), 3);
    assert.equal(m.readWholeFile('NEW.DAT'), null);
    assert.equal(call(m, 0x5a, 'DATA/').cf, false);
    assert.match(string(m, 0x2000), /^DATA\/[A-Z0-9]{8}$/);
    assert.equal(call(m, 0x41, 'DATA/NEW.DAT').cf, false);
    assert.equal(m.readWholeFile('DATA/NEW.DAT'), null);
    assert.equal(m.readWholeFile('SFX/NEW.DAT').toString(), 'SFX');
    fail(call(m, 0x41, 'absent'), 2);
    fail(call(m, 0x41, 'DATA/DATA.FIL'), 5);
  });
  test('rename moves a closed overlay between existing directories', () => {
    const m = fresh(), h = call(m, 0x3c, 'DATA/NEW.DAT').ax;
    put(m, 'written'); call(m, 0x40, undefined, { bx: h, cx: 7 }); call(m, 0x3e, undefined, { bx: h });
    put(m, 'SFX/NEW.DAT', 0x3000);
    assert.equal(call(m, 0x56, 'DATA/NEW.DAT', { es: 0x300 }).cf, false);
    assert.equal(m.readWholeFile('DATA/NEW.DAT'), null);
    assert.equal(m.readWholeFile('SFX/NEW.DAT').toString(), 'written');
    put(m, 'MISSING/NEW.DAT', 0x3000); fail(call(m, 0x56, 'SFX/NEW.DAT', { es: 0x300 }), 3);
    assert.equal(m.readWholeFile('SFX/NEW.DAT').toString(), 'written');
  });
  test('FindFirst uses its directory and copied DTA survives cwd and nested searches', () => {
    const m = fresh(); call(m, 0x1a, undefined, { dx: 0x500 });
    assert.equal(call(m, 0x4e, 'DATA/*.*').cf, false);
    assert.equal(string(m, 0x251e), 'DATA.FIL');
    m.mem.copyWithin(0x2600, 0x2500, 0x252b);
    call(m, 0x3b, 'SFX'); call(m, 0x1a, undefined, { dx: 0x700 });
    assert.equal(call(m, 0x4e, '*.FIL').cf, false);
    assert.equal(string(m, 0x271e), 'DATA.FIL');
    call(m, 0x1a, undefined, { dx: 0x600 }); assert.equal(call(m, 0x4f).cf, false);
    assert.equal(string(m, 0x261e), 'SECOND.TXT'); fail(call(m, 0x4f), 18);
    fail(call(m, 0x4e, 'MISSING/*.FIL'), 3);
    assert.equal(call(m, 0x4e, 'C:/DATA/SUB', { cx: 0x10 }).cf, false);
    assert.equal(m.mem[0x2615], 0x10);
    const tokens = m.directorySearches.size;
    for (let i = 0; i < 10; i++) call(m, 0x4e, 'C:/DATA/*.FIL');
    assert.equal(m.directorySearches.size, tokens);
  });
  test('attributes distinguish directories, originals and overlay files', () => {
    const m = fresh(); assert.equal(call(m, 0x43, 'DATA').cx, 0x10);
    assert.equal(call(m, 0x43, 'DATA/DATA.FIL').cx, 0x20);
    fail(call(m, 0x43, 'DATA/DATA.FIL', { cx: 1 }, 1), 5);
    call(m, 0x3c, 'DATA/NEW.DAT'); assert.equal(call(m, 0x43, 'DATA/NEW.DAT').cx, 0x20);
    fail(call(m, 0x43, 'SFX/NEW.DAT'), 2);
    assert(m.openFile('NUL'));
  });
}
try {
  suite('Node', Machine, root);
  const m = new Machine(new Uint8Array(1 << 20), { fileRoot: root });
  fs.symlinkSync(os.tmpdir(), path.join(root, 'OUTSIDE'));
  assert.equal(m.hostPath('OUTSIDE/anything'), null);
  assert.equal(m.isDirectory(m.resolvePath('OUTSIDE', true)), false);
  fs.unlinkSync(path.join(root, 'OUTSIDE'));
  for (const bundle of ['toyvm-bundle.js', 'toyvm-jit-bundle.js']) {
    const sandbox = { self: {}, atob: s => Buffer.from(s, 'base64').toString('binary'), TextDecoder, TextEncoder, Uint8Array, console };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../docs/dos-corpus/live', bundle), 'utf8'), sandbox);
    const api = sandbox.self.ToyVM;
    for (const [name, bytes] of Object.entries(payload)) api.mount(name, Buffer.from(bytes));
    suite(bundle, api.require('tools/toyvm/dos.js').Machine, '.');
  }
  for (const [name, data] of Object.entries(payload)) assert.equal(fs.readFileSync(path.join(root, name), 'utf8'), data);
  console.log(JSON.stringify({ status: 'PASS', groups, hostPayloadUnchanged: true, guestExecuted: false }));
} finally { fs.rmSync(root, { recursive: true, force: true }); }
