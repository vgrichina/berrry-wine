'use strict';
// Original generated PE/x86. Both shipped modules, real host imports, durable
// Node overlay and a fresh compiled-guest reader process. No game or browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {VirtualFS} = require('../lib/filesystem');
const {createHostImports} = require('../lib/host-imports');
const {attach} = require('../lib/vfs-overlay');
const {nodeDirStore} = require('../lib/overlay-store');
const bp = require('../lib/byte-provider');
const ROOT = path.resolve(__dirname, '..');
const B = 0x400000, C = 0x402000, IAT = 0x401500, S = 0x074fff20;
const OUT = 0x405000, COUNT = OUT + 0x100, HIGH = OUT + 0x110;
const RESULT = OUT + 0x120, DONE = OUT + 0x128, NAME = 0x406000;
const G = 0x30000000, SOURCE = G + 4093, SIZE = 1024 * 1024 + 37;
const EDIT = 65534, PAYLOAD = Uint8Array.of(11, 22, 33, 44, 55, 66, 77, 88);
const APIS = ['CreateFileA', 'SetFilePointer', 'WriteFile', 'SetEndOfFile', 'CloseHandle', 'ReadFile', 'GetLastError'];
const d32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
const pattern = n => (29 * n + 7 * Math.trunc(n / 251)) & 255;

function pe() {
  const img = Buffer.alloc(0x10200), at = r => 0x200 + r - 0x1000;
  const u16 = (p, v) => img.writeUInt16LE(v, p), u32 = (p, v) => img.writeUInt32LE(v >>> 0, p);
  const p = 0x80, o = p + 24, s = o + 0xe0;
  u16(0, 0x5a4d); u32(0x3c, p); u32(p, 0x4550); u16(p + 4, 0x14c); u16(p + 6, 1); u16(p + 20, 0xe0); u16(p + 22, 0x102);
  u16(o, 0x10b); u32(o + 4, 0x10000); u32(o + 16, C - B); u32(o + 20, 0x1000); u32(o + 28, B);
  u32(o + 32, 0x1000); u32(o + 36, 0x200); u16(o + 40, 4); u16(o + 48, 4);
  u32(o + 56, 0x11000); u32(o + 60, 0x200); u16(o + 68, 2);
  for (const [k, v] of [[72, 0x100000], [76, 0x1000], [80, 0x100000], [84, 0x1000], [92, 16]]) u32(o + k, v);
  u32(o + 104, 0x1400); u32(o + 108, 40);
  img.write('.text', s); u32(s + 8, 0x10000); u32(s + 12, 0x1000); u32(s + 16, 0x10000); u32(s + 20, 0x200); u32(s + 36, 0xe0000060);
  u32(at(0x1400), 0x1480); u32(at(0x1400) + 12, 0x1580); u32(at(0x1400) + 16, IAT - B);
  img.write('kernel32.dll\0', at(0x1580));
  APIS.forEach((name, i) => {
    const r = 0x1600 + i * 40;
    u32(at(0x1480) + i * 4, r); u32(at(IAT - B) + i * 4, r); img.write(name + '\0', at(r) + 2);
  });
  return img;
}

function mount(vfs) {
  const reads = [];
  for (const name of ['large', 'trim', 'truncate', 'always', 'reject']) {
    vfs.setProviderFile('c:\\' + name + '.dat', {provider: bp.cached({size: SIZE,
      async readRange(off, len) {
        reads.push({name, off, len});
        return Uint8Array.from({length: len}, (_, i) => pattern(off + i));
      },
    }, {chunkSize: 4096, maxChunks: 2, readAhead: 0, prefetch: 0})});
  }
  return reads;
}

async function fixture(module, dir) {
  const memory = new WebAssembly.Memory({initial: 8192, maximum: 8192, shared: true});
  const vfs = new VirtualFS(), reads = mount(vfs), store = nodeDirStore(dir);
  const overlay = attach(vfs, {store}), ctx = {exports: null, vfs, getMemory: () => memory.buffer, trace: new Set(['fs'])};
  const imports = createHostImports(ctx), bridge = [];
  for (const name of ['fs_create_file_result', 'fs_seek_result', 'fs_write_file_result', 'fs_set_end_of_file_result', 'fs_close_handle', 'fs_read_file_result']) {
    const original = imports.host[name];
    if (original) imports.host[name] = (...args) => { const result = original(...args); bridge.push({name, args, result}); return result; };
  }
  Object.assign(imports.host, {memory, exit() {}, log() {}, log_i32() {}, crash_unimplemented() {throw Error('unexpected unimplemented API');}, wait_multiple() {return 0;}, shell_execute() {return 33;}});
  const {instance} = await WebAssembly.instantiate(fs.readFileSync(module), imports), e = ctx.exports = instance.exports;
  const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer), img = pe();
  mem.set(img, e.get_staging()); e.load_pe(img.length);
  const g2w = a => e.guest_to_wasm(a) >>> 0;
  const put = (a, bytes) => { for (let i = 0; i < bytes.length; i++) mem[g2w(a + i)] = bytes[i]; };
  const u = (a, n) => e.guest_write32(a, n), get = a => e.guest_read32(a) >>> 0;
  const calls = [];
  async function call(name, args, expected) {
    // A real x86 indirect CALL through the loader-patched IAT; guest stores
    // EAX and ESP after stdcall cleanup, before signaling completion.
    const code = [];
    for (const arg of [...args].reverse()) code.push(0x68, ...d32(arg));
    code.push(0xff, 0x15, ...d32(IAT + APIS.indexOf(name) * 4), 0xa3, ...d32(RESULT),
      0x89, 0x25, ...d32(RESULT + 4), 0xc7, 0x05, ...d32(DONE), ...d32(1), 0xeb, 0xfe);
    put(C, code); e.invalidate_code_range(C, code.length);
    u(DONE, 0); u(RESULT, 0xdeadbeef); u(S - 64, 0xcafebabe); u(S, 0x1234abcd);
    e.clear_yield(); e.set_eip(C); e.set_esp(S); e.set_uop(0); e.set_stack_fusion(0);
    let parks = 0;
    for (let i = 0; i < 128 && !get(DONE); i++) {
      if (e.get_yield_reason() === 12) {
        const pending = vfs.getIoState(1).pendingRead;
        assert(pending, name + ': real pending read'); await vfs.fillPendingRead(pending); e.clear_yield(); parks++;
      }
      e.run(1);
    }
    assert.equal(get(DONE), 1, name + ': generated caller completed');
    assert.equal(get(RESULT + 4), S, name + ': guest-observed ESP'); assert.equal(e.get_esp() >>> 0, S);
    assert.equal(get(S - 64), 0xcafebabe); assert.equal(get(S), 0x1234abcd);
    const result = get(RESULT); if (expected !== undefined) assert.equal(result, expected >>> 0, name);
    calls.push({name, args, eax: result, esp: get(RESULT + 4), parks,
      count: get(COUNT), high: get(HIGH), stackCanaries: [get(S - 64), get(S)]}); return result;
  }
  async function open(name, access, disposition = 3) {
    put(NAME, Buffer.from('c:\\' + name + '.dat\0'));
    const h = await call('CreateFileA', [NAME, access, 3, 0, disposition, 0x80, 0]);
    assert(h && h !== 0xffffffff, 'guest open ' + name); return h;
  }
  async function seek(h, n) {
    u(HIGH - 4, 0xaabbccdd); u(HIGH, 0); u(HIGH + 4, 0xddccbbaa);
    await call('SetFilePointer', [h, n, HIGH, 0], n);
    assert.equal(get(HIGH), 0); assert.equal(get(HIGH - 4), 0xaabbccdd); assert.equal(get(HIGH + 4), 0xddccbbaa);
  }
  async function write(h, expected = 1) {
    u(COUNT - 4, 0x55667788); u(COUNT, 0xdeadbeef); u(COUNT + 4, 0x88776655);
    await call('WriteFile', [h, SOURCE, PAYLOAD.length, COUNT, 0], expected);
    assert.equal(get(COUNT), expected ? PAYLOAD.length : 0);
    assert.equal(get(COUNT - 4), 0x55667788); assert.equal(get(COUNT + 4), 0x88776655);
  }
  async function read(h, offset, expected) {
    await seek(h, offset);
    put(OUT - 1, new Uint8Array(expected.length + 2).fill(0xa5));
    u(COUNT, 0xdeadbeef); await call('ReadFile', [h, OUT, expected.length, COUNT, 0], 1);
    assert.equal(get(COUNT), expected.length);
    assert.deepEqual(mem.slice(g2w(OUT), g2w(OUT) + expected.length), expected);
    assert.equal(mem[g2w(OUT - 1)], 0xa5); assert.equal(mem[g2w(OUT + expected.length)], 0xa5);
  }
  return {e, vfs, reads, store, overlay, bridge, calls, call, open, seek, write, read, g2w, put};
}

async function reader(module, dir) {
  const f = await fixture(module, dir), hydrated = await f.overlay.hydrate();
  assert.deepEqual(hydrated.errors, []); assert.equal(hydrated.files, 5); assert.deepEqual(f.reads, []);
  const h = await f.open('large', 0x80000000);
  await f.read(h, EDIT, PAYLOAD); assert.deepEqual(f.reads, [], 'dirty-only guest read fetches no base');
  const tail = new Uint8Array(116); tail.set(PAYLOAD, 100);
  await f.read(h, SIZE, tail); assert.deepEqual(f.reads, [], 'extension holes fetch no base');
  const expected = Uint8Array.from({length: 28}, (_, i) => pattern(EDIT - 10 + i)); expected.set(PAYLOAD, 10);
  await f.read(h, EDIT - 10, expected);
  await f.read(h, 123, Uint8Array.from({length: 31}, (_, i) => pattern(123 + i)));
  await f.call('CloseHandle', [h], 1);
  const trim = await f.open('trim', 0x80000000); await f.read(trim, 17, new Uint8Array(12)); await f.call('CloseHandle', [trim], 1);
  for (const name of ['empty', 'truncate', 'always']) {
    const handle = await f.open(name, 0x80000000); await f.read(handle, 0, new Uint8Array(0));
    // Ask for one byte to prove EOF, not merely a zero-count operation.
    await f.call('ReadFile', [handle, OUT, 1, COUNT, 0], 1);
    assert.equal(f.e.guest_read32(COUNT), 0); await f.call('CloseHandle', [handle], 1);
  }
  assert.deepEqual(f.overlay.dirtyPaths(), []);
  assert(f.reads.length > 0); assert(f.reads.every(r => r.len <= 4096));
  assert(f.reads.reduce((n, r) => n + r.len, 0) <= 5 * 4096);
  assert(f.bridge.some(r => r.name === 'fs_seek_result' && r.args[2] === HIGH));
  assert(f.calls.some(r => r.name === 'ReadFile' && r.parks > 0));
  return {pid: process.pid, module, reads: f.reads, calls: f.calls, bridge: f.bridge};
}

async function writer(module, dir) {
  const f = await fixture(module, dir);
  // Existing shipped setup export only; all file operations below are guest
  // stdcalls. Interleave commits to force truly noncontiguous source backing.
  for (const ga of [G, 0x28000000, G + 4096]) assert.equal(f.e.test_virtual_map_commit(ga, 4096) >>> 0, ga);
  assert.notEqual(f.g2w(G + 4096), f.g2w(G) + 4096);
  f.put(SOURCE - 1, Uint8Array.of(0xa5)); f.put(SOURCE + PAYLOAD.length, Uint8Array.of(0x5a));
  f.put(SOURCE, PAYLOAD);
  const before = [...f.overlay.dirtyPaths()];
  const reject = await f.open('reject', 0x80000000);
  await f.write(reject, 0); await f.call('GetLastError', [], 5);
  await f.call('SetEndOfFile', [reject], 0); await f.call('GetLastError', [], 5);
  await f.call('CloseHandle', [reject], 1);
  await f.write(0xdead, 0); await f.call('GetLastError', [], 6);
  await f.call('SetEndOfFile', [0xdead], 0); await f.call('GetLastError', [], 6);
  assert.deepEqual(f.overlay.dirtyPaths(), before, 'rejected handles never dirty overlay');
  assert.deepEqual(f.reads, []);
  const h = await f.open('large', 0xc0000000);
  await f.seek(h, EDIT); await f.write(h);
  await f.seek(h, SIZE + 100); await f.write(h);
  await f.seek(h, SIZE + 116); await f.call('SetEndOfFile', [h], 1); await f.call('CloseHandle', [h], 1);
  const trim = await f.open('trim', 0x40000000);
  for (const n of [17, 29]) { await f.seek(trim, n); await f.call('SetEndOfFile', [trim], 1); }
  await f.call('CloseHandle', [trim], 1);
  for (const [name, disposition] of [['empty', 1], ['truncate', 5], ['always', 2]]) {
    const handle = await f.open(name, 0x40000000, disposition); await f.call('CloseHandle', [handle], 1);
  }
  assert.deepEqual(f.reads, [], 'open/write/truncate/extend fetch no immutable base');
  assert.deepEqual(Array.from({length: PAYLOAD.length}, (_, i) => f.e.guest_read8(SOURCE + i)), [...PAYLOAD]);
  assert.equal(f.e.guest_read8(SOURCE - 1), 0xa5); assert.equal(f.e.guest_read8(SOURCE + PAYLOAD.length), 0x5a);
  const flushed = await f.overlay.flush(); assert.equal(flushed.failed, 0); assert.equal(flushed.written, 5);
  assert.deepEqual(f.overlay.dirtyPaths(), []); assert.deepEqual(f.reads, [], 'checkpoint fetches no base');
  const meta = await f.store.list(), large = meta.find(r => r.path === 'c:\\large.dat');
  assert.equal(large.size, SIZE + 116); assert.equal((await f.store.read(large.path)).length, 16);
  assert(f.bridge.some(r => r.name === 'fs_create_file_result'), 'actual guest CreateFileA import');
  assert.equal(f.bridge.filter(r => r.name === 'fs_write_file_result' && r.result === 0).length, 2);
  const child = execFileSync(process.execPath, [__filename, '--reader', module, dir], {cwd: ROOT, encoding: 'utf8', timeout: 60000});
  const report = JSON.parse(child.split('\n').find(line => line.startsWith('SPARSE_READER ')).slice(14));
  assert.notEqual(report.pid, process.pid); assert.equal(report.module, module);
  return {module, writerPid: process.pid, sourceBacking: [f.g2w(G), f.g2w(G + 4096)], calls: f.calls,
    bridge: f.bridge, reads: f.reads, payloadBytes: 16, child: report};
}

(async () => {
  if (process.argv[2] === '--reader') {
    console.log('SPARSE_READER ' + JSON.stringify(await reader(process.argv[3], process.argv[4]))); return;
  }
  const reports = [];
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'compiled-sparse-save-'));
  let passed = false;
  try {
    for (const name of ['wine-assembly.wasm', 'wine-assembly.compat.wasm']) {
      reports.push(await writer(path.join(ROOT, 'build', name), path.join(work, name)));
    }
    passed = true; console.log('PASS compiled sparse save, both shipped modules and fresh guest reader processes');
  } finally {
    if (process.env.SPARSE_SAVE_EVIDENCE) {
      fs.mkdirSync(process.env.SPARSE_SAVE_EVIDENCE, {recursive: true});
      fs.writeFileSync(path.join(process.env.SPARSE_SAVE_EVIDENCE, 'compiled-report.json'), JSON.stringify({passed, work, reports}, null, 2) + '\n');
    }
    if (passed) fs.rmSync(work, {recursive: true, force: true});
    else console.error('Failing sparse overlay retained at ' + work);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
