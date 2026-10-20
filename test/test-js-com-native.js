#!/usr/bin/env node
'use strict';
// Offline default. --native requires a pinned canonical module; never builds.
// Direct host-bridge cases are deliberately NOT claimed as public activation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { fixtures, A, M } = require('./fixtures/js-com-native');
const option = n => process.argv.find(x => x.startsWith(`--${n}=`))?.slice(n.length + 3);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const dir = path.resolve(option('out') || 'scratch/runs/20261020-js-com-native-fixture');
const REGS = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];
let runtimeEvidence = null;
const spec = {
  [M.add]: { name: 'AddRef', args: [A.factory], hr: 2 },
  [M.release]: { name: 'Release', args: [A.factory], hr: 1 },
  [M.innerAdd]: { name: 'nested AddRef', args: [A.inner], hr: 2 },
  [M.innerRelease]: { name: 'nested Release', args: [A.inner], hr: 1 },
  [M.create]: { name: 'CreateInstance', args: [A.factory, 0x12345678, A.iid, A.out], hr: 0x80004005 },
  [M.dll]: { name: 'DllGetClassObject', args: [A.dllCls, null, null], hr: 0 },
};
function checkReturn(row) {
  const s = spec[row.method]; assert(s, 'known callback');
  assert.deepEqual(row.args.map((v, i) => s.args[i] === null ? null : v), s.args, 'argument words');
  assert.equal(row.ret, 0, 'JS callback sentinel');
  assert.equal(row.endEsp, row.esp + 4 * (s.args.length + 1), 'actual ret N cleanup before parent restore');
  assert.equal(row.hr, s.hr, 'guest HRESULT/reference count');
}
function checkSequence(sequence, parent) {
  assert.deepEqual(sequence.map(r => r.method), [M.dll, M.create], 'JS carrier sequence, not owner continuation');
  for (const row of sequence) {
    assert.equal(row.parentIp, parent.ip, 'suspended decoded stream');
    assert.equal(row.parentThunk, parent.thunk, 'suspended API thunk');
  }
}
function offline() {
  const f = fixtures(), again = fixtures();
  for (const name of ['exe', 'dll']) assert.deepEqual(f[name], again[name], 'deterministic PE');
  let negatives = 0;
  for (const [key, s] of Object.entries(spec)) {
    const row = { method: +key, args: s.args.map(v => v ?? 0x4100000), ret: 0,
      esp: 0x7401000, endEsp: 0x7401000 + 4 * (s.args.length + 1), hr: s.hr };
    checkReturn(row);
    for (const mutation of [
      r => { r.endEsp += 4; }, r => { r.hr ^= 1; }, r => { r.ret = 1; },
      r => { r.args[0] ^= 4; },
    ]) {
      const bad = structuredClone(row); mutation(bad);
      assert.throws(() => checkReturn(bad)); negatives++;
    }
  }
  const bad = fixtures(true);
  assert.notDeepEqual(f.exe, bad.exe);
  assert.equal(bad.methods.add.at(-2), 8);
  assert.equal(f.methods.add.at(-2), 4);
  const parent = { ip: 0x1a001234, thunk: 0x7500120 };
  const sequence = [M.dll, M.create].map(method =>
    ({ method, parentIp: parent.ip, parentThunk: parent.thunk }));
  checkSequence(sequence, parent);
  for (const mutate of [
    s => s.pop(), s => s.reverse(), s => { s[1].parentIp++; },
    s => { s[1].parentThunk++; },
  ]) {
    const bad = structuredClone(sequence); mutate(bad);
    assert.throws(() => checkSequence(bad, parent)); negatives++;
  }
  for (const [name, bytes] of Object.entries(f.methods)) {
    fs.writeFileSync(path.join(dir, `${name}.bin`), bytes);
    if (name !== 'park') {
      const args = spec[M[name]].args.length;
      assert.deepEqual([...bytes.subarray(-3)], [0xc2, args * 4, 0], name + ' stdcall encoding');
    }
  }
  fs.writeFileSync(path.join(dir, 'fixture.exe'), f.exe);
  fs.writeFileSync(path.join(dir, 'jscom.dll'), f.dll);
  fs.writeFileSync(path.join(dir, 'bad-ret.exe'), bad.exe);
  return { status: 'PASS', oracleNegatives: negatives, malformedRetGenerated: true,
    native: 'UNEXECUTED', hashes: { exe: hash(f.exe), dll: hash(f.dll), badRet: hash(bad.exe) } };
}
async function native() {
  const wasm = option('wasm'), sha = option('sha256');
  assert(wasm && /^[a-f0-9]{64}$/.test(sha || ''), '--wasm and --sha256 required');
  assert.equal(option('source'), 'ee139a0947c82e3a8eba4920508cb760d99882f5',
    'requires exact integrated-source canonical build receipt');
  const bytes = fs.readFileSync(wasm); assert.equal(hash(bytes), sha);
  const { createHostImports } = require('../lib/host-imports');
  const { setRegValue } = require('../lib/storage');
  const module = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null, resourceJson: {} };
  const imports = createHostImports(ctx); imports.host.memory = memory;
  for (const i of WebAssembly.Module.imports(module)) {
    assert.equal(i.module, 'host');
    if (i.kind === 'function' && !imports.host[i.name])
      imports.host[i.name] = () => { throw Error('Unexpected host dependency: ' + i.name); };
  }
  let e;
  const rows = [], active = [], routes = [];
  runtimeEvidence = { rows, routes, source: option('source'), sha256: sha };
  const read = p => new DataView(memory.buffer).getUint32(e.guest_to_wasm(p) >>> 0, true);
  const snapshot = () => ({
    regs: REGS.map(r => e['get_' + r]() >>> 0), eip: e.get_eip() >>> 0,
    ip: e.com_callback_get_ip() >>> 0, thunk: e.com_callback_get_thunk() >>> 0,
    steps: e.get_steps(), handler: e.get_handler_set_eip(),
    yield: [e.get_yield_reason(), e.get_yield_flag()],
    seh: e.get_fs_base() ? read(e.get_fs_base()) : null,
  });
  for (const name of ['com_register_class_object', 'com_revoke_class_object', 'com_create_instance']) {
    const real = imports.host[name];
    imports.host[name] = (...args) => {
      const before = snapshot(), start = rows.length;
      const result = real(...args);
      assert.deepEqual(snapshot(), before, name + ' restores suspended parent');
      routes.push({ name, args, result: result >>> 0, callbacks: rows.length - start,
        ip: before.ip, thunk: before.thunk });
      return result;
    };
  }
  e = (await WebAssembly.instantiate(module, imports)).exports;
  // Observe forwarding facade: no replaced primitive, synthetic completion,
  // rewritten flags, or host-produced return values.
  const observed = Object.fromEntries(Object.entries(e));
  observed.com_callback_enter = () => {
    const parent = snapshot(), token = e.com_callback_enter();
    assert.equal(typeof token, 'bigint');
    active.push({ parent, token, row: null }); return token;
  };
  observed.run = n => {
    const frame = active.at(-1);
    if (frame && !frame.row) {
      const method = e.get_eip() >>> 0, s = spec[method]; assert(s, 'JS route method');
      const esp = e.get_esp() >>> 0;
      frame.row = { method, esp, ret: read(esp),
        args: s.args.map((_, i) => read(esp + 4 + 4 * i)), depth: active.length,
        parentIp: frame.parent.ip, parentThunk: frame.parent.thunk };
      if (method === M.dll) {
        assert.equal(read(frame.row.args[1]), 1, 'IID_IClassFactory Data1');
        assert.equal(read(frame.row.args[1] + 8), 0xc0);
        assert.equal(read(frame.row.args[1] + 12), 0x46000000);
      }
    }
    return e.run(n);
  };
  observed.com_callback_leave = token => {
    const frame = active.at(-1); assert.equal(token, frame.token);
    assert.equal(e.get_eip(), 0); assert.equal(e.get_yield_reason(), 0);
    Object.assign(frame.row, { endEsp: e.get_esp() >>> 0, hr: e.get_eax() >>> 0 });
    checkReturn(frame.row); // production restoration must not mask malformed ret N
    e.com_callback_leave(token); rows.push(frame.row); active.pop();
  };
  ctx.exports = observed;
  const f = fixtures(process.argv.includes('--bad-ret'));
  new Uint8Array(memory.buffer).set(f.exe, e.get_staging()); assert(e.load_pe(f.exe.length));
  new Uint8Array(memory.buffer).set(f.dll, e.get_staging());
  assert.equal(e.load_dll(f.dll.length, 0x600000), 0, 'fixture has no DllMain');
  const dllIndex = e.get_last_loaded_dll_index(); assert(dllIndex >= 0, 'DLL mapping succeeded');
  assert.equal(new DataView(memory.buffer).getUint32(e.get_dll_table() + dllIndex * 32, true),
    0x600000, 'fixed fixture DLL base');
  e.mark_dll_initialized(0x600000); // genuine entry-less image, no synthetic attach
  setRegValue('HKCR\\CLSID\\{76543210-0000-0000-0000-000000000000}\\InprocServer32', '', 1, 'jscom.dll');
  const stack = e.guest_alloc(65536); assert(stack);
  e.set_esp(stack + 65520); e.call_func(0x402000, 0, 0, 0, 0);
  for (let i = 0; i < 100 && e.get_eip(); i++) {
    e.run(1000); assert.equal(e.get_yield_reason(), 0);
  }
  assert.equal(e.get_eip(), 0); assert.equal(read(A.done), 0xc001c0de);
  assert.equal(read(A.before), read(A.after), 'public stdcall balance');
  assert.equal(read(A.add), 1); assert.equal(read(A.release), 1); assert.equal(read(A.nested), 1);
  assert.equal(read(A.create), 2); assert.equal(read(A.hr), 0x80004005);
  assert.equal(read(A.dllClassHR), 0); assert.equal(read(A.dllFactory), A.factory);
  assert.equal(read(A.dllCreateHR), 0x80004005); assert.equal(read(A.dll), 2);
  assert(rows.some(r => r.depth === 2), 'real nested JS callback');
  assert.equal(rows.filter(r => r.method === M.create).length, 0, 'public activation is owner-side');
  assert.equal(rows.filter(r => r.method === M.dll).length, 0, 'public DLL activation is owner-side');
  assert(routes.some(r => r.name === 'com_create_instance' &&
    (r.args[2] & 0x40000000) && r.callbacks === 0), 'public route discriminator');
  // A real running parent is suspended at its block budget. Exercise the
  // publicly exported JS storage bridge directly, labelled as harness entry.
  e.set_eip(M.park); e.run(1);
  const parent = snapshot(); assert(parent.ip); assert(parent.thunk);
  const start = rows.length;
  const hr = imports.host.com_create_instance(e.guest_to_wasm(A.dllCls), 0x12345678,
    1, e.guest_to_wasm(A.iid), A.out) >>> 0;
  assert.equal(hr, 0x80004005); assert.equal(read(A.out), 0x55667788);
  assert.deepEqual(snapshot(), parent);
  const sequence = rows.slice(start);
  checkSequence(sequence, parent);
  assert.equal(read(A.dll), 3); assert.equal(read(A.create), 3); assert.equal(active.length, 0);
  return { status: 'PASS', source: option('source'), sha256: sha, rows, routes,
    publicActivationJS: 'BLOCKED: public handlers unconditionally set resolve-only; direct bridge coverage is not public activation' };
}
fs.mkdirSync(dir, { recursive: true });
(async () => {
  const result = process.argv.includes('--native') ? await native() : offline();
  fs.writeFileSync(path.join(dir, process.argv.includes('--native') ? 'native.json' : 'offline.json'),
    JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
})().catch(error => {
  fs.writeFileSync(path.join(dir, 'failure.json'), JSON.stringify({
    status: 'FAIL', error: error.stack, runtimeEvidence }, null, 2));
  console.error(error); process.exitCode = 1;
});
