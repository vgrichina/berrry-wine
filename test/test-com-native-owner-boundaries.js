#!/usr/bin/env node
'use strict';
// No build. Default is OFFLINE; native mode requires the previously gated module.
// Public CoRegisterClassObject -> real storage.js -> exported COM -> x86 AddRef.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const option = n => process.argv.find(x => x.startsWith(`--${n}=`))?.slice(n.length + 3);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const SOURCE = 'ee139a0947c82e3a8eba4920508cb760d99882f5';
const MODULE = '5e66c75862052b13b73f80bdcbcd67a1a65fd99d3e9e79d33f96548d00cc2a21';
const B = 0x400000, ENTRY = B + 0x2000, RELEASE = B + 0x2800;
const method = i => B + 0x3000 + 128 * i;
const record = i => B + 0x6000 + 64 * i;
const DONE = B + 0x7100;
const REGS = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];
const d32 = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24];
class Code {
  constructor() { this.b = []; }
  emit(...v) { this.b.push(...v.flat()); return this; }
  push(v) { return this.emit(0x68, d32(v)); }
  call(iat) { return this.emit(0xff, 0x15, d32(iat)); }
  ret(n) { return this.emit(0xc2, n, 0); }
}
function fixture(count = 63, badRet = false) {
  assert(count === 63 || count === 64);
  // One executable/readable/writable section; PE header and import layout
  // follow the existing native COM fixture, with disjoint unrolled methods.
  const img = Buffer.alloc(0x7200), at = rva => 0x200 + rva - 0x1000;
  const u16 = (p, v) => img.writeUInt16LE(v, p);
  const u32 = (p, v) => img.writeUInt32LE(v >>> 0, p);
  const pe = 0x80, opt = pe + 24, sec = opt + 0xe0;
  u16(0, 0x5a4d); u32(0x3c, pe); u32(pe, 0x4550);
  u16(pe + 4, 0x14c); u16(pe + 6, 1); u16(pe + 20, 0xe0); u16(pe + 22, 0x102);
  u16(opt, 0x10b); u32(opt + 4, 0x7000); u32(opt + 16, ENTRY - B);
  u32(opt + 20, 0x1000); u32(opt + 28, B); u32(opt + 32, 0x1000);
  u32(opt + 36, 0x200); u16(opt + 40, 4); u16(opt + 48, 4);
  u32(opt + 56, 0x8000); u32(opt + 60, 0x200); u16(opt + 68, 2);
  for (const [p, v] of [[72, 0x100000], [76, 0x1000], [80, 0x100000], [84, 0x1000], [92, 16]])
    u32(opt + p, v);
  u32(opt + 104, 0x1400); u32(opt + 108, 40);
  img.write('.text', sec); u32(sec + 8, 0x7000); u32(sec + 12, 0x1000);
  u32(sec + 16, 0x7000); u32(sec + 20, 0x200); u32(sec + 36, 0xe0000060);
  u32(at(0x1400), 0x1440); u32(at(0x1400) + 12, 0x1480); u32(at(0x1400) + 16, 0x1460);
  img.write('ole32.dll\0', at(0x1480));
  ['CoRegisterClassObject', 'CoRevokeClassObject'].forEach((s, i) => {
    const rva = 0x14a0 + i * 48;
    u32(at(0x1440) + i * 4, rva); u32(at(0x1460) + i * 4, rva);
    img.write(s + '\0', at(rva) + 2);
  });
  const register = (c, i) => c.push(record(i) + 48).push(1).push(1)
    .push(record(i) + 16).push(record(i)).call(B + 0x1460);
  const revoke = (c, i) => c.emit(0xff, 0x35, d32(record(i) + 48)).call(B + 0x1464);
  const put = (addr, c) => {
    assert(c.b.length <= 128);
    Buffer.from(c.b).copy(img, at(addr - B));
  };
  const main = register(new Code(), 0);
  revoke(main, 0).emit(0xc7, 5, d32(DONE), d32(0xc001c0de), 0xb8, d32(0)).ret(16);
  put(ENTRY, main);
  put(RELEASE, new Code().emit(0xb8, d32(1)).ret(4));
  for (let i = 0; i < count; i++) {
    const r = record(i);
    u32(at(r - B), 0x13570000 + i); // distinct CLSIDs
    u32(at(r - B + 16), r + 24);
    u32(at(r - B + 28), method(i)); u32(at(r - B + 32), RELEASE);
    const c = new Code().emit(0xff, 5, d32(r + 52)); // guest execution counter
    if (i + 1 < count) revoke(register(c, i + 1), i + 1);
    c.emit(0xb8, d32(2)).ret(badRet && i === 62 ? 8 : 4);
    put(method(i), c);
  }
  return img;
}
function checkAbi(row) {
  assert.equal(row.ret, 0, 'native callback sentinel');
  assert.equal(row.thisArg, record(row.index) + 16, 'native callback this argument');
  assert.equal(row.endEsp, row.esp + 8, 'native ret 4 cleanup before restore');
  assert.equal(row.eip, 0, 'native callback returned');
  assert.equal(row.yield, 0, 'native callback did not yield');
  assert.equal(row.eax, row.release ? 1 : 2, 'native callback EAX');
}
function unchanged(before, after) {
  assert.deepEqual(after, before, 'rejected exported operation changed state');
}
function offline() {
  const a = fixture();
  assert.deepEqual(a, fixture());
  assert.notDeepEqual(a, fixture(64));
  assert.notDeepEqual(a, fixture(63, true));
  let negatives = 0;
  const row = { index: 62, ret: 0, thisArg: record(62) + 16,
    esp: 0x700000, endEsp: 0x700008, eip: 0, yield: 0, eax: 2, release: false };
  checkAbi(row);
  for (const key of ['ret', 'thisArg', 'endEsp', 'eip', 'yield', 'eax']) {
    assert.throws(() => checkAbi({ ...row, [key]: row[key] + 4 }), assert.AssertionError);
    negatives++;
  }
  const state = { memory: 'hash', instances: [{ depth: 63, arena: [1, 0], regs: [7] }] };
  unchanged(state, structuredClone(state));
  for (const change of [
    s => { s.memory = 'changed'; }, s => { s.instances[0].depth--; },
    s => { s.instances[0].arena[1]++; }, s => { s.instances[0].regs[0]++; },
  ]) {
    const after = structuredClone(state); change(after);
    assert.throws(() => unchanged(state, after), assert.AssertionError); negatives++;
  }
  return { status: 'PASS', mode: 'offline', native: 'UNEXECUTED', oracleNegatives: negatives,
    fixtureHashes: { positive: sha(a), overflow: sha(fixture(64)), badRet: sha(fixture(63, true)) } };
}
async function native(evidence) {
  const root = path.resolve(option('runtime-root') || path.join(__dirname, '..'));
  assert.equal(option('source'), SOURCE, 'exact old source receipt required');
  assert.equal(option('sha256'), MODULE, 'exact gated module required');
  const bytes = fs.readFileSync(option('wasm'));
  assert.equal(sha(bytes), MODULE);
  const mod = await WebAssembly.compile(bytes);
  const { createHostImports } = require(path.join(root, 'lib/host-imports'));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const instances = [], active = [], rows = evidence.rows, rejects = evidence.rejects;
  const badRet = process.argv.includes('--bad-ret'), overflow = process.argv.includes('--overflow');
  const image = fixture(overflow ? 64 : 63, badRet);
  let e, ctx, probeDone = false, rejectedEnter = false, retained;
  const read = (x, p) => new DataView(memory.buffer).getUint32(x.guest_to_wasm(p) >>> 0, true);
  const registers = x => ({
    regs: REGS.map(r => x['get_' + r]() >>> 0),
    eip: x.get_eip() >>> 0, ip: x.com_callback_get_ip() >>> 0,
    thunk: x.com_callback_get_thunk() >>> 0, steps: x.get_steps(),
    handler: x.get_handler_set_eip(), yield: [x.get_yield_reason(), x.get_yield_flag()],
    seh: x.get_fs_base() ? read(x, x.get_fs_base()) : null,
  });
  const state = () => ({
    // Hash ALL shared bytes, including serial/roots, stack and parent registers.
    memory: sha(new Uint8Array(memory.buffer)),
    instances: instances.map(x => ({ ...registers(x), depth: x.get_sync_msg_depth(),
      tid: x.get_current_thread_id(), arena: Array.from({ length: 12 }, (_, k) => x.test_arena_get(k)) })),
  });
  const reject = (fn, label, fault = false) => {
    const before = state();
    assert.throws(fn, WebAssembly.RuntimeError, label + ': must trap');
    // Negative control deliberately corrupts a real observed register after a
    // genuine trap. It must be rejected by the same unchanged-state oracle.
    if (fault) e.set_eax(e.get_eax() ^ 1);
    const after = state(); unchanged(before, after);
    rejects.push({ label, before, after });
  };
  function instantiate() {
    const c = { getMemory: () => memory.buffer, renderer: null, resourceJson: {} };
    const imports = createHostImports(c); imports.host.memory = memory;
    let x;
    for (const name of ['com_register_class_object', 'com_revoke_class_object']) {
      const real = imports.host[name]; assert.equal(typeof real, 'function');
      imports.host[name] = (...args) => {
        const before = registers(x), start = rows.length;
        const result = real(...args);
        assert.deepEqual(registers(x), before, 'public host bridge restores parent');
        evidence.routes.push({ name, args, result: result >>> 0,
          completedCallbacks: rows.length - start, parent: before });
        return result;
      };
    }
    for (const i of WebAssembly.Module.imports(mod)) {
      assert.equal(i.module, 'host');
      if (i.kind === 'function' && !imports.host[i.name])
        imports.host[i.name] = () => { throw Error('Unexpected import: ' + i.name); };
    }
    x = new WebAssembly.Instance(mod, imports).exports;
    c.exports = x; instances.push(x); return { x, c, imports };
  }
  const main = instantiate(); e = main.x; ctx = main.c;
  const facade = Object.fromEntries(Object.entries(e));
  facade.com_callback_enter = () => {
    if (active.length === 63) {
      // Called from the genuine 64th public registration's storage bridge.
      const before = state();
      try { e.com_callback_enter(); assert.fail('64th child accepted'); }
      catch (error) {
        assert(error instanceof WebAssembly.RuntimeError);
        const after = state(); unchanged(before, after);
        rejects.push({ label: 'public 64th child', before, after });
        rejectedEnter = true; throw error; // no fabricated result/unwind
      }
    }
    const parent = registers(e), token = e.com_callback_enter();
    assert.equal(typeof token, 'bigint');
    active.push({ token, parent, row: null });
    assert.equal(e.get_sync_msg_depth(), active.length);
    return token;
  };
  facade.run = n => {
    const frame = active.at(-1);
    if (frame && !frame.row) {
      const pc = e.get_eip() >>> 0, esp = e.get_esp() >>> 0;
      const thisArg = read(e, esp + 4), index = (thisArg - record(0) - 16) / 64;
      assert(Number.isInteger(index) && index >= 0 && index < 64);
      assert(pc === RELEASE || pc === method(index), 'actual x86 callback entry');
      frame.row = { index, method: pc, release: pc === RELEASE, esp,
        thisArg, ret: read(e, esp), depth: active.length, token: frame.token.toString(),
        parent: frame.parent };
      evidence.entered.push(frame.row);
      if (active.length === 63 && !probeDone) {
        probeDone = true; retained = frame.token;
        assert.equal(new Set(active.map(f => f.token)).size, 63);
        reject(() => e.com_callback_enter(), 'capacity at 63 actual public children',
          process.argv.includes('--state-corruption'));
        for (const token of [active[0].token, frame.token + (1n << 32n)]) {
          for (const name of ['com_callback_check', 'com_callback_leave'])
            reject(() => e[name](token), `retained/high-word at depth63 ${name}`);
        }
        e.com_callback_check(frame.token);
      }
    }
    return e.run(n);
  };
  facade.com_callback_leave = token => {
    const frame = active.at(-1); assert.equal(token, frame.token);
    Object.assign(frame.row, { endEsp: e.get_esp() >>> 0, eax: e.get_eax() >>> 0,
      eip: e.get_eip() >>> 0, yield: e.get_yield_reason() });
    evidence.lastReturn = frame.row; checkAbi(frame.row);
    e.com_callback_leave(token); rows.push(frame.row); active.pop();
  };
  ctx.exports = facade;
  new Uint8Array(memory.buffer).set(image, e.get_staging()); assert(e.load_pe(image.length));
  const stack = e.guest_alloc(65536); assert(stack);
  e.set_esp(stack + 65520); e.call_func(ENTRY, 0, 0, 0, 0);
  try {
    for (let n = 0; n < 100 && e.get_eip(); n++) {
      e.run(1000); assert.equal(e.get_yield_reason(), 0);
    }
  } catch (error) {
    if (!overflow || !rejectedEnter) throw error;
    assert(error instanceof WebAssembly.RuntimeError);
    assert.equal(active.length, 63);
    assert.equal(read(e, DONE), 0, 'overflow must not complete parent');
    return { status: 'PASS', mode: 'native-overflow', rejectedAtExport: true,
      noSyntheticUnwind: true, liveChildren: active.length };
  }
  assert(!overflow, 'overflow control did not reach rejection');
  assert.equal(e.get_eip(), 0); assert.equal(read(e, DONE), 0xc001c0de);
  assert.equal(active.length, 0); assert.equal(e.get_sync_msg_depth(), 0);
  assert.equal(e.get_esp() >>> 0, stack + 65520, 'public caller stack balance');
  assert.equal(rows.filter(r => !r.release).length, 63);
  assert.equal(rows.filter(r => r.release).length, 63);
  for (let i = 0; i < 63; i++) assert.equal(read(e, record(i) + 52), 1);
  assert(rows.every(r => r.parent.ip && r.parent.thunk), 'real suspended public API thunks');
  const sibling = e.com_callback_enter();
  for (const name of ['com_callback_check', 'com_callback_leave'])
    reject(() => e[name](retained), 'retired child against sibling ' + name);
  e.com_callback_check(sibling); e.com_callback_leave(sibling);
  const init = x => x.init_thread(1, B, e.get_code_start(), e.get_code_end(),
    e.get_thunk_base(), e.get_thunk_end(), e.get_num_thunks(), 0);
  const old = instantiate().x; init(old);
  const oldToken = old.com_callback_enter();
  const replacement = instantiate().x; init(replacement);
  const live = replacement.com_callback_enter();
  for (const name of ['com_callback_enter', 'com_callback_check', 'com_callback_leave'])
    reject(() => name.endsWith('enter') ? old[name]() : old[name](oldToken), 'stale slot ' + name);
  replacement.com_callback_check(live); replacement.com_callback_leave(live);
  // A production PE load publishes a new process epoch. Retire old instances
  // through that real loader, without editing ownership bytes or globals.
  const epochToken = replacement.com_callback_enter();
  replacement.com_callback_check(epochToken);
  new Uint8Array(memory.buffer).set(image, e.get_staging()); assert(e.load_pe(image.length));
  for (const name of ['com_callback_enter', 'com_callback_check', 'com_callback_leave'])
    reject(() => name.endsWith('enter') ? replacement[name]() : replacement[name](epochToken),
      'stale epoch ' + name);
  const valid = e.com_callback_enter(); e.com_callback_check(valid); e.com_callback_leave(valid);
  return { status: 'PASS', mode: 'native', publicChildren: 63, nativeCallbacks: rows.length,
    rejectionChecks: rejects.length, fixtureSha256: sha(image),
    limits: 'No private invocation globals exported; memory, public control state, arena/pins/depth checked. No races/spill pressure/current-main claim.' };
}
async function main() {
  const evidence = { source: SOURCE, moduleSha256: MODULE, node: process.version,
    arch: process.arch, rows: [], entered: [], rejects: [], routes: [] };
  const out = option('out');
  try {
    const result = process.argv.includes('--native') ? await native(evidence) : offline();
    Object.assign(evidence, result);
    if (out) { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(evidence, null, 2)); }
    console.log(JSON.stringify({ ...result, rows: evidence.rows.length, rejects: evidence.rejects.length }));
  } catch (error) {
    Object.assign(evidence, { status: 'FAIL', error: error.stack });
    if (out) { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify(evidence, null, 2)); }
    console.error(error); process.exitCode = 1;
  }
}
if (require.main === module) main();
module.exports = { fixture, checkAbi, unchanged };
