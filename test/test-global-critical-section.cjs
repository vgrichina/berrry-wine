#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const { bootRenderHarness } = require('./render-helper');

function wrappers(promote) {
  const names = ['InitializeCriticalSection', 'EnterCriticalSection', 'TryEnterCriticalSection',
    'LeaveCriticalSection', 'DeleteCriticalSection'];
  if (promote) names.push('MakeCriticalSectionGlobal');
  return names.map(name => `(func (export "probe_${name}") (param $p i32) (result i32)
    (local $esp i32) (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_${name} (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (if (i32.eqz (global.get $yield_flag)) (then
      (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.add (local.get $esp) (i32.const 8))) (then (unreachable)))))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.load (global.get $reg_base)))`).join('\n') + `
    (func (export "probe_create") (result i32)
      (call $host_shared_heap (i32.const 1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (func (export "probe_alloc") (param $h i32) (result i32)
      (call $host_shared_heap (i32.const 3) (local.get $h) (i32.const 8) (i32.const 64) (i32.const 0)))
    (func (export "probe_read") (param $p i32) (result i32) (call $gl32 (local.get $p)))
    (func (export "probe_write") (param $p i32) (param $v i32) (call $gs32 (local.get $p) (local.get $v)))
  `;
}
function load(h) {
  const image = fs.readFileSync(path.join(__dirname, 'binaries/notepad.exe'));
  new Uint8Array(h.memory.buffer).set(image, h.exports.get_staging()); h.exports.load_pe(image.length);
}
async function boot(module, memory, init) {
  const h = await bootRenderHarness({ prebuiltModule: module, memory, fonts: 'none' });
  if (init) h.exports.init_thread(1, ...init); else load(h);
  return h;
}
const words = (e, p) => Array.from({ length: 6 }, (_, i) => e.probe_read(p + i * 4));
const api = (e, n, p) => e['probe_' + n + 'CriticalSection'](p);
const promote = (e, p) => e.probe_MakeCriticalSectionGlobal(p);
function baseline(e, p) {
  try { api(e, 'Enter', p); return { failed: false }; }
  catch (error) { return { failed: true, error: String(error) }; }
}
function launchPeer(kind, module, file, h, p, mode) {
  const init = ['get_image_base', 'get_code_start', 'get_code_end', 'get_thunk_base', 'get_thunk_end', 'get_num_thunks', 'get_rsrc_rva'].map(n => h.exports[n]());
  const peer = kind === 'worker'
    ? new Worker(__filename, { workerData: { module, memory: h.memory, init, p, mode } })
    : fork(__filename, ['--peer', file, String(p), mode], {
      env: require('../lib/thread-manager').ThreadManager.namedEventEnvironment(), stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  const messages = [], waiting = [];
  peer.on('message', x => { if (waiting.length) waiting.shift().resolve(x); else messages.push(x); });
  let exit;
  const done = new Promise((resolve, reject) => {
    peer.once('error', reject);
    peer.once('exit', code => { exit = code; if (code) reject(new Error(`${kind} exit ${code}`)); else resolve();
      for (const w of waiting.splice(0)) w.reject(new Error(`${kind} exited before message`)); });
  });
  done.catch(() => {});
  return { next: () => messages.length ? Promise.resolve(messages.shift()) : exit !== undefined
    ? Promise.reject(new Error('peer already exited')) : new Promise((resolve, reject) => waiting.push({ resolve, reject })),
    send: x => kind === 'worker' ? peer.postMessage(x) : peer.send(x), done, peer };
}
async function peerWork(data, send, receive) {
  const h = await boot(data.module, data.memory, data.init), e = h.exports, p = data.p;
  if (data.mode === 'before') { send(baseline(e, p)); return; }
  if (data.mode === 'creator') {
    api(e, 'Initialize', p); promote(e, p); api(e, 'Enter', p); api(e, 'Enter', p);
    send({ owned: true, words: words(e, p) }); await receive(); return;
  }
  if (data.mode === 'count') {
    send({ ready: true }); await receive(); await count(e, p); send({ counted: true }); return;
  }
  assert.equal(api(e, 'TryEnter', p), 0, 'peer with colliding numeric tid cannot recurse');
  const beforeLeave = words(e, p);
  assert.throws(() => api(e, 'Leave', p), /ESHARED/, 'nonowner cannot release another process lock');
  assert.deepEqual(words(e, p), beforeLeave);
  api(e, 'Enter', p); assert.equal(e.get_yield_reason(), 9);
  const esp = e.get_esp();
  for (let i = 0; i < 3; i++) { e.clear_yield(); api(e, 'Enter', p); assert.equal(e.get_yield_reason(), 9); assert.equal(e.get_esp(), esp); }
  send({ parked: true }); await receive();
  if (data.mode === 'cancel') return;
  if (data.mode === 'retired') {
    e.clear_yield(); assert.throws(() => api(e, 'Enter', p), /ESHARED/); send({ retired: true }); return;
  }
  e.clear_yield(); api(e, 'Enter', p); assert.equal(e.get_yield_reason(), 0);
  assert.equal(e.probe_read(p + 8), 1, 'retry consumes a reserved grant once');
  e.probe_write(p + 24, e.probe_read(p + 24) + 1);
  api(e, 'Enter', p); assert.equal(e.probe_read(p + 8), 2);
  api(e, 'Leave', p); api(e, 'Leave', p);
  send({ acquired: true });
}
async function count(e, p) {
  const deadline = Date.now() + 15000;
  for (let i = 0; i < 64;) {
    assert(Date.now() < deadline, 'bounded shared lock progress');
    if (!api(e, 'TryEnter', p)) { await new Promise(r => setTimeout(r, 1)); continue; }
    assert.equal(e.probe_read(p + 28), 0, 'only one native CPU in protected region');
    e.probe_write(p + 28, 1);
    const value = e.probe_read(p + 24);
    assert.equal(api(e, 'TryEnter', p), 1);
    e.probe_write(p + 24, value + 1); api(e, 'Leave', p);
    e.probe_write(p + 28, 0); api(e, 'Leave', p); i++;
    if (!(i % 8)) await new Promise(r => setImmediate(r));
  }
}
async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wine-global-cs-'));
  const peers = [];
  try {
    const hasPromote = fs.readFileSync(path.join(__dirname, '../src/09a-handlers3-sync.wat'), 'utf8').includes('(func $handle_MakeCriticalSectionGlobal ');
    const bytes = require('./compile-src').compileSrcWasm((n, s) => n === '13-exports.wat' ? s + wrappers(hasPromote) : s);
    if (process.env.GLOBAL_CS_MODULE_FILE) fs.writeFileSync(process.env.GLOBAL_CS_MODULE_FILE, bytes);
    console.log('module SHA256', require('node:crypto').createHash('sha256').update(bytes).digest('hex'));
    const file = path.join(tmp, 'probe.wasm'); fs.writeFileSync(file, bytes);
    const module = await WebAssembly.compile(bytes), h = await boot(module), e = h.exports;
    const p = e.probe_alloc(e.probe_create()) >>> 0; api(e, 'Initialize', p);
    if (process.argv.includes('--before')) {
      const results = { main: baseline(e, p) };
      for (const kind of ['worker', 'process']) {
        const child = launchPeer(kind, module, file, h, p, 'before'); peers.push(child);
        results[kind] = await child.next(); await child.done;
      }
      console.log(JSON.stringify(results));
      assert(Object.values(results).every(x => x.failed), 'all actual native CPUs reproduce the old shared-CS failure');
      return;
    }
    assert(hasPromote);
    promote(e, p); const token = e.probe_read(p + 16); assert(token);
    promote(e, p); assert.equal(e.probe_read(p + 16), token, 'promotion is idempotent');
    assert.equal(api(e, 'TryEnter', p), 1); api(e, 'Enter', p);
    assert.equal(e.probe_read(p + 8), 2);
    const worker = launchPeer('worker', module, file, h, p, 'wait'); peers.push(worker);
    assert((await worker.next()).parked);
    const child = launchPeer('process', module, file, h, p, 'wait'); peers.push(child);
    assert((await child.next()).parked);
    assert.equal(e.probe_read(p + 4), 3, 'LockCount includes recursion and two queued waiters');
    api(e, 'Leave', p); assert.equal(e.probe_read(p + 8), 1);
    api(e, 'Leave', p);
    assert.equal(api(e, 'TryEnter', p), 0, 'release reserves the first waiter; no barging');
    worker.send({ go: true }); assert((await worker.next()).acquired); await worker.done;
    child.send({ go: true }); assert((await child.next()).acquired); await child.done;
    assert.equal(e.probe_read(p + 24), 2);
    assert.deepEqual(words(e, p).slice(1, 4), [-1, 0, 0]);
    const counters = ['worker', 'process'].map(kind => launchPeer(kind, module, file, h, p, 'count'));
    peers.push(...counters);
    for (const cpu of counters) assert((await cpu.next()).ready);
    for (const cpu of counters) cpu.send({ go: true });
    await count(e, p);
    for (const cpu of counters) { assert((await cpu.next()).counted); await cpu.done; }
    assert.equal(e.probe_read(p + 24), 194, 'three actual native CPUs conserve 192 protected increments');
    api(e, 'Enter', p);
    const retired = launchPeer('worker', module, file, h, p, 'retired'); peers.push(retired);
    assert((await retired.next()).parked);
    api(e, 'Delete', p); api(e, 'Initialize', p); promote(e, p);
    retired.send({ go: true }); assert((await retired.next()).retired); await retired.done;
    const creator = launchPeer('process', module, file, h, p, 'creator'); peers.push(creator);
    assert((await creator.next()).owned);
    api(e, 'Enter', p); assert.equal(e.get_yield_reason(), 9);
    creator.send({ exit: true }); await creator.done;
    // Socket-close cleanup is asynchronous at the authority; retries are bounded.
    for (let i = 0; i < 100; i++) {
      e.clear_yield(); api(e, 'Enter', p); if (!e.get_yield_reason()) break;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.equal(e.get_yield_reason(), 0, 'creator disconnect wakes the surviving peer');
    const cancelled = launchPeer('process', module, file, h, p, 'cancel'); peers.push(cancelled);
    assert((await cancelled.next()).parked); cancelled.send({ exit: true }); await cancelled.done;
    for (let i = 0; i < 100 && e.probe_read(p + 4) !== 0; i++) await new Promise(r => setTimeout(r, 5));
    assert.equal(e.probe_read(p + 4), 0, 'disconnect removes pending waiter without consuming a grant');
    api(e, 'Leave', p); assert.equal(api(e, 'TryEnter', p), 1, 'cancelled waiter cannot retain the section');
    api(e, 'Leave', p); api(e, 'Delete', p);
    assert.throws(() => api(e, 'Enter', p), /ESHARED/);
    api(e, 'Initialize', p); promote(e, p); assert.notEqual(e.probe_read(p + 16), token, 'retired section gets a fresh generation');
    api(e, 'Delete', p);
    // Existing private path remains usable with its ordinary six words.
    const privateCS = e.get_image_base() + 0x100000;
    api(e, 'Initialize', privateCS); assert.equal(api(e, 'TryEnter', privateCS), 1);
    api(e, 'Enter', privateCS); api(e, 'Leave', privateCS); api(e, 'Leave', privateCS); api(e, 'Delete', privateCS);
    const browser = { crypto: require('node:crypto').webcrypto };
    require('node:vm').runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/shared-heap.js'), 'utf8'), browser);
    const browserBoot = async () => {
      const page = await bootRenderHarness({ prebuiltModule: module, fonts: 'none', beforeInstantiate: ctx => {
        ctx.sharedHeapOperation = browser.SharedHeapAuthority.systemOperation;
      } }); load(page); return page.exports;
    };
    const a = await browserBoot(), b = await browserBoot();
    const q = a.probe_alloc(a.probe_create()) >>> 0;
    api(a, 'Initialize', q);
    assert.throws(() => api(b, 'TryEnter', q), /ESHARED/, 'unpromoted section remains process private');
    promote(a, q); api(a, 'Enter', q);
    assert.equal(api(b, 'TryEnter', q), 0, 'separate browser process memories with TID1 cannot recurse');
    api(b, 'Enter', q); assert.equal(b.get_yield_reason(), 9);
    assert.equal(a.release_cs_owned_by(1), 1, 'explicit guest retirement releases authority ownership');
    b.clear_yield(); api(b, 'Enter', q); assert.equal(b.get_yield_reason(), 0);
    api(b, 'Leave', q); api(b, 'Delete', q);
    console.log('PASS global CS: real main/Worker/process ownership, recursive waits, reserved FIFO wake, creator exit, retirement, stdcall, private regression');
  } finally {
    for (const p of peers) { if (p.peer.threadId !== undefined && p.peer.threadId !== -1) await p.peer.terminate();
      else if (p.peer.exitCode === null && p.peer.kill) p.peer.kill('SIGKILL'); }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
const watchdog = setTimeout(() => { console.error('global CS test deadline'); process.exit(124); }, 90000);
(async () => {
  if (!isMainThread) await peerWork(workerData, x => parentPort.postMessage(x), () => new Promise(r => parentPort.once('message', r)));
  else if (process.argv[2] === '--peer') {
    await peerWork({ module: await WebAssembly.compile(fs.readFileSync(process.argv[3])), p: +process.argv[4], mode: process.argv[5] },
      x => process.send(x), () => new Promise(r => process.once('message', r))); process.disconnect();
  } else await main();
})().then(() => { clearTimeout(watchdog); if (parentPort) parentPort.close(); }, error => { clearTimeout(watchdog); console.error(error); process.exitCode = 1; });
