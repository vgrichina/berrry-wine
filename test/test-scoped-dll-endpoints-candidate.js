'use strict';
// Canonical native module + production endpoints. No compiler, export mocks or
// direct beginScopedLibraryYield calls. Run only in an admitted runtime lane.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { GuestThreadHost } = require('../lib/guest-thread-host');
const { ThreadManager } = require('../lib/thread-manager');
const { createHostImports } = require('../lib/host-imports');
const { prepareScopedLibrary, publishScopedDlls } = require('../lib/process-boot');
const { X86, pe, BASE, DATA } = require('./test-dll-lifecycle-real-pe');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;
// Historical commands keep their original module pin. Combined-build runs
// must explicitly supply the hash recorded by their admitted build controller.
const CANONICAL = process.env.WA_TEST_WASM_SHA256 ||
  'a948a826f71c1935c4d00f7054decdaf4d1e8115314d8779727b7e30069f5b48';
assert.match(CANONICAL, /^[a-f0-9]{64}$/);
const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24];
const args = (frameToken, hwnd = 42, lparam = 0) => ({ frameToken, hwnd, msg: 0x400, wparam: 0, lparam });
const dispatch = (link, token, hwnd, lparam) => {
  // Manual barrier stepping and the automatic host driver share one token
  // sequence. Keep its allocator in sync; retired tokens cannot be reused.
  assert(token > (link.nextThreadSendFrameToken || 0));
  link.nextThreadSendFrameToken = token;
  return link.dispatchThreadSend(args(token, hwnd, lparam));
};
const latch = () => { let release; const promise = new Promise(r => { release = r; }); return { promise, release }; };

function images() {
  const load = new X86().push(BASE + 0x1500).api('LoadLibraryA').emit(0xc2, 16, 0).finish();
  const free = new X86().emit(0xff, 0x74, 0x24, 16).api('FreeLibrary').emit(0xc2, 16, 0).finish();
  const dll = nested => {
    const x = new X86().emit(0x53, 0x8b, 0x5c, 0x24, 8, 0x8b, 0x44, 0x24, 12,
      0xff, 0x04, 0x85, u32(DATA + (nested ? 0 : 0x20)));
    if (nested) {
      x.emit(0x83, 0xf8, 1).branch([0x0f, 0x85], 'detach');
      x.emit(0x8d, 0x83, u32(0x1500), 0x50).api('LoadLibraryA', true);
      x.emit(0x89, 0x83, u32(0x1700)).branch(0xe9, 'done');
      x.label('detach').emit(0x85, 0xc0).branch([0x0f, 0x85], 'done');
      x.emit(0xff, 0xb3, u32(0x1700)).api('FreeLibrary', true);
    }
    x.label('done').emit(0xb8, 1, 0, 0, 0, 0x5b, 0xc2, 12, 0);
    return pe([[0x1000, x.finish()], [0x1500, 'nested.dll\0']], true);
  };
  return { exe: pe([[0x2000, load], [0x2100, free],
    [0x2200, [0xb8, 77, 0, 0, 0, 0xc2, 16, 0]], [0x1500, 'scoped.dll\0']]),
  'scoped.dll': dll(true), 'nested.dll': dll(false) };
}

async function context(module, twoWorkers, suppliedImages, workerUrl) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit() {} };
  const imports = createHostImports(ctx); imports.host.memory = memory; imports.host.has_dll_file = () => 1;
  const instance = await WebAssembly.instantiate(module, imports), ex = instance.exports;
  ctx.exports = ex;
  const files = suppliedImages || images();
  new Uint8Array(memory.buffer, ex.get_staging(), files.exe.length).set(files.exe);
  ex.load_pe(files.exe.length);
  for (const [hwnd, rva] of [[42, 0x2000], [43, 0x2100], [44, 0x2200]]) ex.test_wnd_table_set(hwnd, BASE + rva);
  const host = new GuestThreadHost({ memory, module, sigs, hostImports: imports.host,
    localMainExports: () => ex, clockIntervalMs: 0,
    workerUrl: workerUrl || path.resolve(__dirname, '../lib/guest-worker.js') });
  await host.start();
  const manager = new ThreadManager(module, memory, instance, null, { workerBackend: host });
  const spawn = async tid => {
    const link = await host.spawnThread({ tid, imageBase: BASE, codeStart: ex.get_code_start(),
      codeEnd: ex.get_code_end(), thunkBase: ex.get_thunk_base(), thunkEnd: ex.get_thunk_end(),
      numThunks: ex.get_num_thunks(), startAddr: BASE + 0x2200, param: 0, stackSize: 0x10000 });
    // Register the actual endpoint with the production resolver. The bounded
    // fixture drives callbacks itself; no ordinary thread slice may consume
    // the parked start routine while a deterministic barrier is held.
    manager.threads.set(0x7000 + tid, { tid, link, state: 'active', suspendCount: 0, inFlight: true });
    return link;
  };
  try {
    const a = twoWorkers ? await spawn(1) : host._localLink;
    const b = await spawn(2);
    const view = new DataView(memory.buffer), publications = [], registrations = [];
    ctx.registerModule = (name, base, generation) => registrations.push({ name, base, generation });
    const resolve = (link, r, state) => manager.resolveThreadSendYield(link, r, state, new Set([link]));
    manager._resolveThreadSendExternalYield = async (_link, _r, captured, inspect) => ({
      ...await prepareScopedLibrary(captured, name => files[name] || null, null, inspect),
      publish: result => { publications.push(result); publishScopedDlls(ctx, ex, memory.buffer, result); },
    });
    host.threadSendYieldResolver = (l, r, s, active) => manager.resolveThreadSendYield(l, r, s, active);
    return { memory, ex, host, a, b, manager, files, view, publications, registrations, resolve,
      count: offset => view.getUint32(ex.guest_to_wasm(DATA + offset), true),
      gate: () => Array.from(new Int32Array(memory.buffer, ex.get_dll_callback_lock(), 2)),
      close: () => host.stop() };
  } catch (error) { await host.stop(); throw error; }
}

const state = link => Promise.all(['eip', 'esp', 'eax', 'yield_reason'].map(n => link.callExport('get_' + n)));
async function finish(c, link, r, s = {}) {
  for (let turn = 0; turn < 100; turn++) {
    assert(!r.trapped, r.trapped);
    if (r.done) return r.result >>> 0;
    const action = await c.resolve(link, r, s);
    if (action === 'resume') r = await link.resumeThreadSendDispatch(undefined, r.frameToken, r.waitEpoch);
    else assert.equal(action, 'pending');
  }
  throw new Error('Native endpoint callback exceeded 100 protocol turns');
}

async function race(module, twoWorkers) {
  const c = await context(module, twoWorkers);
  const first = latch(), lookup = latch(), nested = latch(), nestedLookup = latch();
  let work;
  try {
    const { a, b, ex, manager } = c;
    const owners = await Promise.all([a, b].map(l => l.callExport('get_dll_callback_owner')));
    assert.notEqual(owners[0], owners[1], 'actual native owner identities differ');
    const before = await Promise.all([state(a), state(b)]);
    const normalResolver = manager._resolveThreadSendExternalYield;
    let topLookups = 0;
    manager._resolveThreadSendExternalYield = async (link, r, captured, inspect) => {
      const prepared = await prepareScopedLibrary(captured, async name => {
        if (name === 'scoped.dll') { topLookups++; lookup.release(); await first.promise; }
        if (name === 'nested.dll') { nestedLookup.release(); await nested.promise; }
        return c.files[name] || null;
      }, null, inspect);
      return { ...prepared, publish: result => {
        c.publications.push(result);
        const destination = { registerModule: (name, base, generation) => c.registrations.push({ name, base, generation }) };
        publishScopedDlls(destination, ex, c.memory.buffer, result);
        // Negative control injects a genuine duplicate host publication after
        // native completion. Native attach counters still pass; independently
        // observed module registrations must detect the extra side effect.
        if (process.env.WA_SCOPED_DUPLICATE_PUBLICATION_CONTROL === '1') {
          publishScopedDlls(destination, ex, c.memory.buffer, result);
        }
      } };
    };
    const ar = await dispatch(a, 101), as = {};
    assert.equal(ar.yield, 5);
    work = c.resolve(a, ar, as); await lookup.promise;
    assert.equal(c.gate()[0], owners[0]);
    let br = await dispatch(b, 201); const bs = {};
    assert.equal(br.yield, 9, 'native API gates foreign owner before byte lookup');
    assert.equal(await c.resolve(b, br, bs), 'resume');
    br = await b.resumeThreadSendDispatch(undefined, br.frameToken, br.waitEpoch);
    assert.equal(br.yield, 9, 'foreign owner remains gated on an actual retry');
    assert.equal(topLookups, 1);
    assert.equal(c.count(4), 0, 'byte lookup barrier precedes actual x86 attach');
    assert.equal(c.registrations.length, 0);
    assert((await a.scopedThreadSendLoader({ ...ar, waitEpoch: ar.waitEpoch + 1 })).ownershipMismatch);
    assert((await b.scopedThreadSendLoader(ar)).ownershipMismatch, 'A frame cannot command B endpoint');
    assert.deepEqual(c.gate(), [owners[0], 1], 'rejected commands leave exact owner and depth intact');
    const nestedFrame = await dispatch(a, 102, 44);
    assert(nestedFrame.done); assert.equal(nestedFrame.result, 77);

    // Drop the successful endpoint reply, not the operation. Resolver must
    // retry its retained command without remapping or executing attach twice.
    const original = a.scopedThreadSendLoader.bind(a);
    let lostMap = false, lostPublication = false;
    a.scopedThreadSendLoader = async (token, request) => {
      const answer = await original(token, request);
      if (request?.bytes && !lostMap) { lostMap = true; throw new Error('injected lost map ack'); }
      if (request?.publish && !lostPublication) { lostPublication = true; throw new Error('injected lost publish ack'); }
      return answer;
    };
    first.release(); assert.equal(await work, 'pending'); work = null;
    assert.equal(await c.resolve(a, ar, as), 'resume');
    assert((await original(ar, { bytes: c.files['scoped.dll'] })).duplicate);
    let r = await a.resumeThreadSendDispatch(undefined, ar.frameToken, ar.waitEpoch);
    // Real outer DllMain calls LoadLibraryA(nested.dll) before returning TRUE.
    assert.equal(r.yield, 5);
    work = c.resolve(a, r, as); await nestedLookup.promise;
    const life = ex.get_dll_lifecycle_table(), stride = ex.get_dll_lifecycle_stride();
    const rows = [];
    for (let i = 0; i < ex.get_dll_count(); i++) {
      if (c.view.getUint32(life + i * stride, true) === 1) rows.push(i);
    }
    assert.equal(rows.length, 1, 'outer mapping INITIALIZING during nested byte barrier');
    const row = rows[0], address = life + row * stride, generation = ex.get_dll_generation(row);
    assert(generation); assert(c.view.getUint32(address + 12, true) > 0, 'initializing image remains pinned');
    assert.equal(c.count(4), 1); assert.equal(c.count(0x24), 0);
    assert.equal(await c.resolve(b, br, bs), 'resume');
    br = await b.resumeThreadSendDispatch(undefined, br.frameToken, br.waitEpoch);
    assert.equal(br.yield, 9, 'INITIALIZING still gates the foreign native caller');
    assert.equal(c.registrations.length, 0, 'INITIALIZING is never externally published');
    assert.equal(c.gate()[0], owners[0]); assert(c.gate()[1] >= 2, 'nested admission is reentrant');
    nested.release(); assert.equal(await work, 'resume'); work = null;
    const handle = await finish(c, a, await a.resumeThreadSendDispatch(undefined, r.frameToken, r.waitEpoch), as);
    assert(handle); assert(lostMap && lostPublication);
    assert.equal(c.view.getUint32(address, true), 2);
    assert.equal(c.view.getUint32(address + 12, true), 0);
    assert.equal(c.registrations.filter(m => m.base === handle).length, 1,
      'first owner publishes exactly once despite lost acknowledgement');
    assert.equal(await finish(c, b, br, bs), handle, 'second owner receives the same mapping');
    assert.equal(ex.get_dll_generation(row), generation);
    assert.equal(c.count(4), 1); assert.equal(c.count(0x24), 1);
    const mapped = c.publications.flatMap(p => p.mapped || []).filter(m => m.result.loadAddr === handle);
    assert.equal(mapped.length, 1, 'B uses native existing-module fast path without another mapping publication');
    assert.equal(mapped.filter(m => !m.result.existing).length, 1, 'exactly one new native mapping');
    assert(mapped.every(m => m.result.generation === generation));
    assert.equal(c.registrations.filter(m => m.base === handle).length, 1);
    assert.equal(topLookups, 1, 'native existing-module fast path never reacquires bytes');
    assert.deepEqual(c.gate(), [0, 0]);
    assert.deepEqual(await Promise.all([state(a), state(b)]), before, 'both callback owners restore registers and ESP');
    manager._resolveThreadSendExternalYield = normalResolver;
    for (const link of [a, b]) {
      assert.equal(await c.host._dispatchThreadSendToLink(link, args(0, 43, handle), 0, null, {}), 1);
    }
    assert.equal(c.count(0), 1); assert.equal(c.count(0x20), 1, 'actual nested detach executes once');
    assert.equal(c.view.getUint32(address, true), 0);
    assert.equal(c.publications.flatMap(p => p.retired || []).filter(p => p.generation === generation && p.loadAddr === handle).length, 1);
    assert.deepEqual(c.gate(), [0, 0]);
    console.log(`PASS native scoped ${twoWorkers ? 'Worker/Worker' : 'local/Worker'} lookup race, nested attach/detach, receipts and registers`);
  } finally { first.release(); nested.release(); if (work) await work.catch(() => {}); await c.close(); }
}

async function retirement(module) {
  const c = await context(module, true), ready = latch(), release = latch();
  let work;
  try {
    c.manager._resolveThreadSendExternalYield = (_l, _r, captured) => prepareScopedLibrary(captured, async () => {
      ready.release(); await release.promise; return c.files['scoped.dll'];
    });
    const r = await dispatch(c.a, 501);
    work = c.resolve(c.a, r, {}); work.catch(() => {}); await ready.promise;
    const held = c.gate(); assert(held[0]);
    await assert.rejects(c.a._ask({ t: 'retireScopedLoaders', endpointIdentity: c.a.endpointIdentity + 1 }), /identity mismatch/);
    assert.deepEqual(c.gate(), held, 'stale lifetime cannot release another owner');
    await c.a.stop(); release.release(); await assert.rejects(work, /retired/); work = null;
    assert.deepEqual(c.gate(), [0, 0]); assert.equal(c.count(4), 0);
    assert.equal(c.a.worker, null);
    console.log('PASS native owner retirement during retained byte lookup');
  } finally { release.release(); if (work) await work.catch(() => {}); await c.close(); }
}

async function main() {
  assert(process.env.WA_TEST_WASM, 'WA_TEST_WASM must name the admitted physical canonical binary');
  const bytes = fs.readFileSync(process.env.WA_TEST_WASM);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), CANONICAL);
  const module = await WebAssembly.compile(bytes);
  await race(module, false); await race(module, true); await retirement(module);
}
if (require.main === module) {
  const deadline = setTimeout(() => { console.error('Native scoped endpoint suite exceeded 60 seconds'); process.exit(1); }, 60000);
  deadline.unref();
  main().then(() => clearTimeout(deadline), error => { console.error(error); process.exitCode = 1; });
}
module.exports = { images, CANONICAL, context, dispatch, finish, latch };
