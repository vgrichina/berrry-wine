'use strict';

// Real compiled WAT, guest x86 and native Workers. A held-section diagnostic
// at process exit is observable state, not evidence that the host crashed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createHostImports } = require('../lib/host-imports');
const { ThreadManager } = require('../lib/thread-manager');
const { GuestThreadHost } = require('../lib/guest-thread-host');
const { createGuestMainOwner } = require('../lib/guest-main-owner');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return [...b]; };
const call = (fn, args = []) => [
  ...args.slice().reverse().flatMap(v => [0x68, ...u32(v)]), 0xb8, ...u32(fn), 0xff, 0xd0,
];
const store = (address, value) => [0xc7, 0x05, ...u32(address), ...u32(value)];
const ret = [0xc2, 4, 0];

async function fixture(module, remote, workerMain = false) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const exits = [], logs = [];
  const ctx = { getMemory: () => memory.buffer,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit: code => exits.push(code) };
  const imports = createHostImports(ctx); imports.host.memory = memory;
  let tm, host;
  imports.host.exit_thread = code => tm.exitThread(code);
  const instance = await WebAssembly.instantiate(module, imports), e = instance.exports;
  ctx.exports = e;
  const pe = makeFixture();
  new Uint8Array(memory.buffer, e.get_staging(), pe.length).set(pe);
  assert(e.load_pe(pe.length));
  if (remote) host = new GuestThreadHost({ module, memory, hostImports: imports.host, sigs,
    workerUrl: path.resolve(__dirname, '../lib/guest-worker.js'), clockIntervalMs: 0,
    localMainExports: workerMain ? undefined : () => e, log: line => logs.push(line) });
  tm = new ThreadManager(module, memory, instance, () => imports, { workerBackend: host });
  tm._log = line => logs.push(line);
  const write = bytes => {
    const a = e.guest_alloc(bytes.length) >>> 0;
    new Uint8Array(memory.buffer, e.guest_to_wasm(a), bytes.length).set(bytes);
    return a;
  };
  const string = s => write([...Buffer.from(s + '\0')]);
  const stack = e.get_esp();
  const invoke = (fn, args) => {
    const code = write([...call(fn, args), 0xc3]);
    e.clear_yield(); e.set_esp(stack); e.call_func(code, 0, 0, 0, 0); e.run(10000);
    assert.equal(e.get_eip(), 0); return e.get_eax() >>> 0;
  };
  const k = invoke(e.guest_read32(iat('LoadLibraryA')), [string('KERNEL32.DLL')]);
  const api = Object.fromEntries(['EnterCriticalSection', 'LeaveCriticalSection', 'ExitThread',
    'ExitProcess', 'Sleep'].map(name => {
    const fn = invoke(e.guest_read32(iat('GetProcAddress')), [k, string(name)]);
    assert(fn, name); return [name, fn];
  }));
  const state = cs => [e.guest_read32(cs + 4) | 0, e.guest_read32(cs + 8), e.guest_read32(cs + 12)];
  return { memory, e, tm, host, exits, logs, write, api, state, ctx };
}

async function threadCase(module, remote, kind, packed) {
  const f = await fixture(module, remote);
  const { e, tm, host, write, api, state } = f;
  const cs = write(Array(32).fill(0)) + (packed ? 1 : 0), entered = write([0,0,0,0]), after = write([0,0,0,0]);
  e.test_cs_init(cs);
  const ownerCode = write([...call(api.EnterCriticalSection, [cs]),
    ...call(api.EnterCriticalSection, [cs]), ...store(entered, 1),
    ...call(api.Sleep, [100000]),
    ...(kind === 'trap' ? [0x0f, 0x0b] : kind === 'ExitThread' ? call(api.ExitThread, [37]) : [0xb8, ...u32(19), ...ret])]);
  const waiterCode = write([...call(api.EnterCriticalSection, [cs]), ...store(after, 1),
    ...call(api.LeaveCriticalSection, [cs]), ...ret]);
  const step = async () => remote ? tm.runWorkerSlices(100) : tm.runSlice(100, { quantumSteps: 100 });
  const until = async predicate => {
    for (let i = 0; i < 40 && !predicate(); i++) await step();
    assert(predicate(), 'bounded scheduler progress');
  };
  try {
    if (host) await host.start();
    const handle = tm.createThread(ownerCode, 0, 65536, 0, 0);
    await tm.spawnPending(); const owner = tm.threads.get(handle);
    await until(() => e.guest_read32(entered) === 1);
    const ownerId = owner.tid + 1;
    assert.deepEqual(state(cs), [1, 2, ownerId]);
    const waiterHandle = tm.createThread(waiterCode, 0, 65536, 0, 0);
    await tm.spawnPending(); const waiter = tm.threads.get(waiterHandle);
    await until(() => remote ? !!waiter.parkedCriticalSection : waiter.instance.exports.get_cs_waits() > 0);
    assert.equal(e.guest_read32(after), 0, 'live owner excludes real waiter');
    assert.deepEqual(state(cs), [1, 2, ownerId]);
    if (kind === 'STOP') {
      // Race the actual scheduler's pending native slice with endpoint STOP.
      // Its error path must retire the section, then STOP must join writers.
      assert(host);
      const link = owner.link;
      const pending = tm._runWorkerThread(handle, owner, 100, tm.workerSyncState());
      await host.stop(); await pending;
      await assert.rejects(link.callExport('test_cs_try_enter', cs), /retir|stopp/i);
      assert(link._retirementComplete); assert.equal(link.worker, null);
      assert.equal(owner.state, 'exited');
      assert.equal(owner.exitCode, 1, 'transport retirement is not a successful guest exit');
      assert.equal(owner._exitCleanup.reason, 'worker-error');
      assert.equal(owner._exitCleanup.complete, true);
      assert.equal(e.release_cs_owned_by(ownerId), 0);
      assert.deepEqual(state(cs), [-1, 0, 0]);
      assert.equal(e.guest_read32(after), 0, 'stopped waiter never resumes guest code');
      return { remote, kind, packed, stopped: true, lateCallbackRejected: true, logs: f.logs };
    }
    if (kind === 'TerminateThread') {
      tm.terminateThread(handle, 23);
      // A native writer must be joined before the test can reuse its slot.
      if (host) await host.dropThread(owner.link);
    } else {
      owner.sleepUntil = 0;
      if (remote) await owner.link.callExport('clear_yield'); else owner.instance.exports.clear_yield();
      await until(() => owner.state === 'exited');
    }
    assert.equal(owner.state, 'exited');
    assert.equal(owner.exitCode, kind === 'trap' ? 1 : kind === 'ExitThread' ? 37 : kind === 'TerminateThread' ? 23 : 19);
    assert.equal(owner._exitCleanup.complete, true);
    await until(() => e.guest_read32(after) === 1 && waiter.state === 'exited');
    assert.deepEqual(state(cs), [-1, 0, 0], 'real parked waiter acquired once and released');
    assert.equal(e.release_cs_owned_by(ownerId), 0, 'late duplicate retirement cannot touch another owner');
    const warning = f.logs.filter(line => /ended owning 1 critical section/.test(line));
    assert.equal(warning.length, 1, 'one diagnostic for actual abandoned recursive section');
    const trap = f.logs.some(line => /trap|crash|slice failed/i.test(line));
    if (kind === 'trap') assert(trap, 'genuine trap retains error diagnostics');
    return { remote, kind, packed, exitCode: owner.exitCode, reason: owner._exitCleanup.reason,
      waiterProgress: true, warningCount: warning.length, logs: f.logs };
  } finally { await host?.stop(); f.ctx.stopAudio?.(); }
}

async function mainCase(module, remote, kind) {
  const f = await fixture(module, remote, true);
  const { e, host, write, api, state } = f;
  let link;
  try {
    if (host) { await host.start(); link = host.link; }
    const owner = createGuestMainOwner(remote ? { worker: host } : { localExports: e });
    // Load on the actual main owner, as the native CLI does. Shared data and
    // per-instance registers must not be confused with the idle shadow.
    if (remote) { const pe = makeFixture(); await owner.call('load_pe', pe.length); }
    const cs = await owner.call('guest_alloc', 24), marker = await owner.call('guest_alloc', 4);
    await owner.call('test_cs_init', cs);
    const code = [...call(api.EnterCriticalSection, [cs]), ...store(marker, 1),
      ...(kind === 'ordinaryExit' ? [...call(api.ExitProcess, [0]), ...store(marker, 2), 0x0f, 0x0b]
        : kind === 'trap' ? [0x0f, 0x0b] : [0xc3])];
    const addr = await owner.call('guest_alloc', code.length);
    new Uint8Array(f.memory.buffer, await owner.call('guest_to_wasm', addr), code.length).set(code);
    await owner.call('call_func', addr, 0, 0, 0, 0);
    let error;
    try { const result = await owner.run(1000); if (result?.trapped) error = result.trapped; }
    catch (caught) { error = String(caught); }
    assert.equal(e.guest_read32(marker), 1, 'post-ExitProcess continuation cannot run');
    assert.deepEqual(state(cs), [0, 1, 1], 'held-main diagnostic is reproducible without assuming a crash');
    if (kind === 'trap') { assert(error); assert.deepEqual(f.exits, []); }
    else { assert.ifError(error); assert.deepEqual(f.exits, kind === 'ordinaryExit' ? [0] : []); }
    const terminal = await owner.read(['get_eip', 'get_yield_reason']);
    if (kind === 'ordinaryExit') assert.equal(terminal.get_eip, 0);
    if (host) {
      await host.stop();
      await assert.rejects(link.callExport('test_cs_try_enter', cs), /stopp|retir/i);
      assert(link._retirementComplete); assert.equal(link.worker, null);
    }
    return { remote, kind, heldAtExit: state(cs), exits: f.exits, error: error ? String(error) : null, terminal };
  } finally { await host?.stop(); f.ctx.stopAudio?.(); }
}

async function main() {
  const bytes = require('./compile-src').compileSrcWasm();
  if (process.env.NATIVE_QUIT_CS_MODULE_OUT) fs.writeFileSync(process.env.NATIVE_QUIT_CS_MODULE_OUT, bytes);
  console.log(JSON.stringify({ moduleSHA256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }));
  const module = await WebAssembly.compile(bytes);
  for (const remote of [false, true]) {
    for (const kind of ['ordinaryExit', 'mainReturn', 'trap']) console.log(JSON.stringify(await mainCase(module, remote, kind)));
    for (const packed of [false, true]) for (const kind of ['return', 'ExitThread', 'trap', 'TerminateThread', ...(remote ? ['STOP'] : [])])
      console.log(JSON.stringify(await threadCase(module, remote, kind, packed)));
  }
  console.log('PASS 24 real compiled-WAT native main/retirement/waiter/STOP/error controls; all Workers joined');
}

if (process.argv.includes('--native-child')) main().catch(error => { console.error(error); process.exitCode = 1; });
else {
  // Independent finite watchdog, including synchronous WAT compilation and
  // blocked native Workers. Workers are threads of this one child process.
  const result = spawnSync(process.execPath, [__filename, '--native-child'], {
    encoding: 'utf8', timeout: 120000, killSignal: 'SIGKILL', maxBuffer: 8 * 1024 * 1024,
  });
  process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
  if (result.error) console.error(result.error);
  if (result.status !== 0 || result.signal || result.error) process.exitCode = 1;
}
