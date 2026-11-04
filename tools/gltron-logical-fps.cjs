'use strict';

// Production counter diagnostics. Offline fixtures are not gameplay samples.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { APPS } = require('../lib/apps');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const ORIGINAL_SHA = '85fb5184262490f0b5967c2b12ee27c77da058364e594b0fc86be7b5814e40ec';
const BOUNDARY = Object.freeze({
  callbackTable: 0x42a200, currentCallbacks: 0x42b230,
  idle: 0x40518f, nonzeroDt: 0x4051a9, gameIdle: 0x4040de,
  display: 0x40eef1, game2Pointer: 0x43d284, dtOffset: 0x30,
});

function inspectOriginal(bytes) {
  if (sha256(bytes) !== ORIGINAL_SHA) throw Error('original executable hash mismatch');
  // These VAs equal file offsets + ImageBase only in this pinned original's
  // text and initialized data sections. Never use this as a runtime g2w map.
  const at = (va, hex) => {
    const expected = Buffer.from(hex, 'hex');
    if (!bytes.subarray(va - 0x400000, va - 0x400000 + expected.length).equals(expected)) {
      throw Error('original boundary bytes mismatch at ' + va.toString(16));
    }
  };
  at(0x42a200, 'f1ee40008f514000fe854000c45140005a524000d6624000a452400064524000984b4200');
  at(0x424b98, '67616d6500');
  at(0x40518f, '558bece8e8740000e843e1ffffa184d24300837830007502eb19e830efffffe8245d0000e8f83b0000e887af0000e826b300005dc3');
  at(0x41049a, 'a130b24200ff10832534b2420000eb08a130b24200ff5004');
  at(0x4104ce, '558bec8b4508a330b242005dc3');
  return { sha256: ORIGINAL_SHA, bytes: bytes.length, ...BOUNDARY,
    status: 'static-candidate-only',
    distinction: 'idle entry includes zero-dt polls; nonzero-dt path calls Game_Idle once; physics may substep',
    runtimeOwnershipVerified: false };
}

function audit(root = path.resolve(__dirname, '..')) {
  const app = APPS.gltron;
  const media = app.files.map(file => {
    const relative = 'test/' + file.url;
    const bytes = fs.readFileSync(path.join(root, relative));
    const actual = sha256(bytes);
    if (actual !== file.sha256 || bytes.length !== file.size) throw Error('registered media mismatch: ' + relative);
    return { path: relative, bytes: bytes.length, sha256: actual };
  });
  const original = inspectOriginal(fs.readFileSync(path.join(root, 'test/' + app.exe)));
  const wasmPath = 'build/wine-assembly.wasm';
  const wasm = fs.readFileSync(path.join(root, wasmPath));
  const module = new WebAssembly.Module(wasm); // compile only; no instance or guest
  return {
    original, registration: { exe: app.exe, logicalFrame: app.perf?.logicalFrame || null }, media,
    module: { path: wasmPath, bytes: wasm.length, sha256: sha256(wasm), executed: false,
      logicalExports: WebAssembly.Module.exports(module).filter(e => /logical_frame|trace_eip|dbg_tier/.test(e.name)) },
    blocker: {
      code: 'LIVE_OWNER_AND_INTERVAL_NOT_OBSERVED',
      detail: 'Production marker count deltas can measure average logical update FPS without callback timestamps. Exact compiled boundary and live owner must be validated before measurement.',
      logicalFPS: null, browserLaunches: 0, liveEndpoint: null,
      actualBackend: null, context: null, renderer: null,
    },
  };
}

// Execute the original dt branch and CALL instruction, stopping by the ordinary
// block budget before the callee. Data/register setup is an offline fixture;
// original executable code is never patched. This is not an original app launch.
async function probeCompiled(wasmPath = 'build/wine-assembly.wasm') {
  const assert = require('node:assert/strict');
  const { createHostImports } = require('../lib/host-imports');
  const bytes = fs.readFileSync('test/binaries/gltron-0.70/gltron.exe');
  inspectOriginal(bytes);
  const wasm = fs.readFileSync(wasmPath);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer, guestNowMs: () => 1000 };
  const { host } = createHostImports(ctx);
  host.memory = memory;
  host.log = () => {}; host.log_i32 = () => {};
  const { instance } = await WebAssembly.instantiate(wasm, { host });
  const e = ctx.exports = instance.exports;
  const vm = require('node:vm');
  const hostContext = vm.createContext({ console });
  vm.runInContext(fs.readFileSync('host.js', 'utf8'), hostContext);
  const P = vm.runInContext('WineAssembly.prototype', hostContext);
  const owner = { instance };
  new Uint8Array(memory.buffer).set(bytes, e.get_staging());
  assert(e.load_pe(bytes.length));
  const game = e.guest_alloc(4096) >>> 0, stack = e.guest_alloc(4096) >>> 0;
  e.guest_write32(BOUNDARY.game2Pointer, game);
  e.guest_write32(BOUNDARY.currentCallbacks, BOUNDARY.callbackTable);
  const rows = [];
  for (const [chain, uop] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    e.set_block_chain(chain); e.set_uop(uop);
    await P._setLogicalFrame.call(owner, BOUNDARY.nonzeroDt, 0);
    for (const dt of [0, 16, 0, 1, 32]) {
      e.clear_yield(); e.set_handler_set_eip(0);
      e.set_esp(stack + 4080); e.set_eip(0x40519c);
      e.guest_write32(game + BOUNDARY.dtOffset, dt);
      const before = e.get_logical_frame_count() >>> 0;
      const guards = { tier: e.get_dbg_tier_guard() };
      assert.equal(guards.tier, 0);
      e.run(1);
      const branchEnd = e.get_eip() >>> 0;
      assert.equal(branchEnd, dt ? BOUNDARY.nonzeroDt : 0x4051a7);
      assert.equal(e.get_logical_frame_count() >>> 0, before);
      e.run(1);
      const end = e.get_eip() >>> 0;
      assert.equal(end, dt ? BOUNDARY.gameIdle : 0x4051c2);
      const delta = ((e.get_logical_frame_count() >>> 0) - before) >>> 0;
      assert.equal(delta, dt ? 1 : 0);
      assert.equal(await P._readLogicalFrameCount.call(owner), e.get_logical_frame_count() >>> 0);
      assert.equal(e.get_logical_frame_pace(), 0);
      assert.equal(e.get_sleep_yielded(), 0);
      assert.equal(e.get_block_chain(), chain); assert.equal(e.get_uop(), uop);
      rows.push({ chain, uop, dt, before, delta, branchEnd, end, guards });
    }
    // Setter does not reset the lifetime count; disabling must flush a cached
    // marker. Re-arm the same original code to verify both transitions.
    await P._setLogicalFrame.call(owner, 0, 0);
    const before = e.get_logical_frame_count() >>> 0;
    e.set_esp(stack + 4080); e.set_eip(BOUNDARY.nonzeroDt); e.run(1);
    assert.equal(e.get_logical_frame_count() >>> 0, before);
  }
  return { wasm: { path: wasmPath, sha256: sha256(wasm), bytes: wasm.length },
    original: { sha256: ORIGINAL_SHA }, rows, status: 'compiled-original-boundary-pass',
    limitation: 'Offline data/register fixture, not live scene or FPS; enabled uop is not proof this tiny branch entered a uop program.' };
}

// A synchronous getter is bracketed in the page's monotonic clock domain.
// Midpoints yield a nominal rate; the enclosing brackets yield time/rate bounds.
// No poll timestamp is a callback timestamp. Limit wrap ambiguity by an explicit
// generous maximum count, and reject backwards resets outside the wrap seam.
function summarizeCounterWindow(rows, { maxReadMs = 5, maxGapMs = 1500,
  maxFrames = 40000 } = {}) {
  if (!Array.isArray(rows) || rows.length < 2) throw Error('missing interval');
  const first = rows[0];
  let frames = 0, wraps = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !Number.isFinite(r.beforeMs) || !Number.isFinite(r.afterMs) ||
        r.beforeMs < 0 || r.afterMs < r.beforeMs || r.afterMs - r.beforeMs > maxReadMs)
      throw Error('invalid read latency');
    if (!Number.isInteger(r.count) || r.count < 0 || r.count > 0xffffffff)
      throw Error('invalid unsigned counter');
    if (r.owner !== first.owner || !r.owner || r.endpoint !== 'page-main' || r.threadId !== 1)
      throw Error('wrong owner');
    if (r.generation !== first.generation || !Number.isInteger(r.generation) || r.generation < 1)
      throw Error('stale generation');
    if (r.currentCallbacks !== BOUNDARY.callbackTable || r.marker !== BOUNDARY.nonzeroDt || r.pace !== 0)
      throw Error('wrong gameplay marker or scene');
    if (r.tierGuard !== 0 || r.chain !== first.chain || r.uop !== first.uop ||
        ![0, 1].includes(r.chain) || ![0, 1].includes(r.uop)) throw Error('execution tier changed');
    if (i) {
      const prev = rows[i - 1];
      if (r.beforeMs < prev.afterMs || r.afterMs - prev.beforeMs > maxGapMs)
        throw Error('nonmonotonic or stale observation');
      if (r.count < prev.count) {
        if (prev.count < 0x100000000 - maxFrames || r.count > maxFrames)
          throw Error('counter reset');
        wraps++;
      }
      frames += (r.count - prev.count) >>> 0;
      if (frames > maxFrames || wraps > 1) throw Error('ambiguous counter delta');
    }
  }
  const last = rows[rows.length - 1];
  const minElapsedMs = last.beforeMs - first.afterMs;
  const maxElapsedMs = last.afterMs - first.beforeMs;
  if (minElapsedMs < 5000 || maxElapsedMs > 10000) throw Error('interval outside bounds');
  const elapsedMs = (minElapsedMs + maxElapsedMs) / 2;
  return { frames, wraps, elapsedMs, minElapsedMs, maxElapsedMs,
    logicalFPS: frames * 1000 / elapsedMs,
    minLogicalFPS: frames * 1000 / maxElapsedMs,
    maxLogicalFPS: frames * 1000 / minElapsedMs,
    meaning: 'nonzero-dt GameMode_Idle updates entered per monotonic wall second',
    limitations: ['Read brackets bound observation timing, not uninstrumented performance.',
      'Count-only marker adds a threaded block boundary and guest tick read per update; this rate includes that overhead.',
      'Active callback table is sampled between guest slices; transitions entirely within a slice are not observed.',
      'Not display, present, physics-substep, or completed-update FPS.'] };
}

// Evaluated in the browser page AFTER personally reviewing actual gameplay.
// Reject worker ownership instead of silently adding unrelated instance counts.
// The only production setter is the existing count-only logical marker.
async function installPageCounter(boundary, token) {
  if (window.__gltronCounter) throw Error('counter already attached');
  const w = window.wine, instance = w?.instance, e = instance?.exports;
  if (!w || !e || w.guestWorker || w._stopped || !w.running) throw Error('unsupported main owner');
  const memory = e.memory, buffer = memory.buffer, tm = w.threadManager;
  if (e.get_current_thread_id() !== 1 || e.get_image_base() !== 0x400000)
    throw Error('wrong main thread or image');
  if (e.get_logical_frame_addr() !== 0 || e.get_logical_frame_pace() !== 0)
    throw Error('existing logical marker');
  const observation = window.__gltronModuleObservation;
  const generationRow = observation?.instances.find(row => row.instance === instance);
  const generation = generationRow?.generation;
  if (!generation) throw Error('owning module generation not observed');
  const initial = { chain: e.get_block_chain(), uop: e.get_uop() };
  const rows = [], state = { token, rows, invalid: null, generation, timer: null };
  const invalidate = why => { state.invalid ||= why; };
  const read32 = va => {
    const offset = e.guest_to_wasm(va) >>> 0;
    if (offset < 0x100 || offset + 4 > buffer.byteLength) throw Error('untranslated guest address');
    return { va, offset, value: new DataView(buffer).getUint32(offset, true) };
  };
  const children = () => [...(tm?.threads || [])].map(([handle, t]) => {
    if (t.link || !t.instance?.exports) throw Error('unsupported child endpoint');
    const ex = t.instance.exports;
    return { handle, state: t.state, threadId: ex.get_current_thread_id(),
      count: ex.get_logical_frame_count() >>> 0 };
  });
  function read() {
    const observationStartMs = performance.now();
    if (state.invalid) throw Error(state.invalid);
    if (rows.length >= 64 || (rows.length && observationStartMs - rows[0].beforeMs > 10000))
      throw Error('bounded observation deadline or capacity');
    if (window.wine !== w || w.instance !== instance || e.memory !== memory || memory.buffer !== buffer ||
        w.guestWorker || w.threadManager !== tm || w._stopped || !w.running)
      throw Error('owning runtime changed');
    if (window.__gltronModuleObservation !== observation || generationRow.generation !== generation ||
        !observation.instances.includes(generationRow)) throw Error('stale module generation');
    if (document.visibilityState !== 'visible' || window.WineFrozen?.status().frozen)
      throw Error('hidden or frozen interval');
    const childReads = children();
    if (childReads.some(r => r.count !== 0)) throw Error('foreign thread counted gameplay');
    const callbacks = read32(boundary.currentCallbacks), game = read32(boundary.game2Pointer);
    const dt = read32(game.value + boundary.dtOffset);
    const beforeMs = performance.now(), count = e.get_logical_frame_count() >>> 0, afterMs = performance.now();
    const r = { beforeMs, afterMs, count, owner: token, endpoint: 'page-main', generation,
      threadId: e.get_current_thread_id(), currentCallbacks: callbacks.value,
      translations: { callbacks, game, dt }, childReads,
      marker: e.get_logical_frame_addr() >>> 0, pace: e.get_logical_frame_pace(),
      tierGuard: e.get_dbg_tier_guard(), chain: e.get_block_chain(), uop: e.get_uop() };
    if (r.currentCallbacks !== boundary.callbackTable || r.marker !== boundary.nonzeroDt || r.pace ||
        r.tierGuard || r.chain !== initial.chain || r.uop !== initial.uop || r.threadId !== 1)
      throw Error('scene, marker, owner or tier changed');
    r.observerMs = performance.now() - observationStartMs;
    rows.push(r); return r;
  }
  const visibility = () => { if (document.visibilityState !== 'visible') invalidate('page became hidden'); };
  state.read = () => { try { return read(); } catch (error) { invalidate(error.message); throw error; } };
  state.finish = () => {
    clearInterval(state.timer);
    document.removeEventListener('visibilitychange', visibility);
    try {
      try { state.read(); } catch (_) { /* Return the latched reason and raw reads. */ }
      return { rows, invalid: state.invalid, token, generation };
    }
    finally { if (window.wine === w && w.instance === instance) w._setLogicalFrame(0, 0); }
  };
  // Check the authentic scene before arming; dt at an arbitrary host boundary
  // need not be positive. The original branch, not this snapshot, filters dt0.
  const callbacksBeforeArm = read32(boundary.currentCallbacks);
  if (callbacksBeforeArm.value !== boundary.callbackTable) {
    // Preserve the rejected live translation before the runner closes. A prior
    // personally reviewed screenshot does not prove the scene still owns idle.
    const beforeMs = performance.now();
    window.__gltronCounterRejection = {
      code: 'NOT_ACTIVE_GAME_CALLBACKS', token, generation,
      expectedCallbacks: boundary.callbackTable, callbacks: callbacksBeforeArm,
      game: read32(boundary.game2Pointer), threadId: e.get_current_thread_id(),
      count: e.get_logical_frame_count() >>> 0, marker: e.get_logical_frame_addr() >>> 0,
      pace: e.get_logical_frame_pace(), tierGuard: e.get_dbg_tier_guard(),
      chain: e.get_block_chain(), uop: e.get_uop(), beforeMs, afterMs: performance.now(),
    };
    throw Error('not active gameCallbacks; observed 0x' + callbacksBeforeArm.value.toString(16));
  }
  children();
  await w._setLogicalFrame(boundary.nonzeroDt, 0);
  window.__gltronCounter = state;
  document.addEventListener('visibilitychange', visibility);
  try { state.read(); }
  catch (error) { state.finish(); throw error; }
  state.timer = setInterval(() => {
    try { state.read(); }
    catch (_) {
      clearInterval(state.timer);
      if (window.wine === w && w.instance === instance) w._setLogicalFrame(0, 0);
    }
  }, 250);
  return { token, generation, initial, row: rows[0] };
}

module.exports = { BOUNDARY, ORIGINAL_SHA, sha256, inspectOriginal, audit,
  probeCompiled, summarizeCounterWindow, installPageCounter };
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--probe-compiled' && args.length <= 2) {
    probeCompiled(args[1]).then(out => process.stdout.write(JSON.stringify(out, null, 2) + '\n'))
      .catch(error => { console.error(error); process.exitCode = 1; });
  } else {
    if (args.length) throw Error('usage: node tools/gltron-logical-fps.cjs [--probe-compiled [WASM]]');
    process.stdout.write(JSON.stringify(audit(), null, 2) + '\n');
  }
}
