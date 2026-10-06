// What a worker thread inherits from the process that spawned it.
//
// A guest thread runs in its own WASM instance, so every host import it calls
// is a fresh closure over a fresh context object. That makes "what is shared"
// an explicit decision at exactly two places -- test/run.js and host.js -- and
// they drifted: each host had its own literal list, neither list was written
// down as a rule, and the only way to compare them was to read both.
//
// The rule, in one sentence: a worker shares everything that belongs to the
// PROCESS, and nothing that belongs to a thread. A file handle opened by the
// main thread is visible to a worker; a LAN socket is the process's, not the
// caller's; there is one clock, not one per thread; a bitmap created on the
// main thread must still be there when a worker blits it. Anything that is
// genuinely per-thread -- the instance, the thread id, the logger's own
// "was the last call traced" latch -- is built per worker instead.

// Keys copied from the main context into a worker's, with the reason each one
// is process-scoped. A key absent from the main context stays absent from the
// worker's: this list is what MAY be shared, not what must exist. That is what
// lets the two hosts have legitimately different sets -- the browser has a
// `sharedMixer` because several apps can play audio in one page, the CLI has
// `_waveStats` because a test asserts on them -- without either being drift.
const PROCESS_SHARED_KEYS = [
  'glideBridge',        // one virtual Glide board and command order per process
  'vfs',                // one filesystem: a worker must see main-thread writes
  'vlanWire',           // one wire per process, not per thread
  'guestNowMs',         // one clock, so threads cannot disagree about "now"
  'wallNowMs',          // calendar APIs share the process's date/time policy too
  'sharedGdi',          // GDI handles, so a worker's BitBlt finds main's bitmap
  'sharedAudio',        // waveOut device state is the process's single output
  'sharedMixer',        // mixer state, when the host shares one across apps
  'audioTap',           // active guest-clock recorder is process-wide
  'registerAudioTapPump', // worker-owned looping voices flush into that recorder
  'renderMidiForTap',   // headless TinySynth rendition follows process MIDI
  '_audioOutFd',        // the CLI's audio capture file
  '_audioOutCount',     // its --audio-out-max cap and process-wide byte count
  '_waveStats',         // audio counters, so a worker's writes reach the summary
  'audioStatsStride',
  'sharedCom',          // one process-local table of registered COM factories
  'closeSyncHandle',    // CloseHandle on a worker must recycle process sync slots
  'signalSyncHandle',   // VFS mutations wake the process's directory watchers
  'resetSyncHandle',    // FindNext rearms those same shared wait objects
  'win16StageModule',   // a second Win16 task (WinExec) LoadLibrarys its own DLLs
];

// Copy the process-scoped half of a context. Callers add the per-thread half
// (instance, exports, threadId, memory) themselves, since only they know it.
// A key the main context exposes as a getter is copied AS a getter, not as
// the value it happens to hold at spawn time. Process state can be replaced
// after a thread exists -- a virtual LAN wire joined when the guest first asks
// for a room is the case that found this -- and a snapshot leaves that thread
// looking at the state the process had when it started.
function processSharedCtx(mainCtx) {
  const out = {};
  if (!mainCtx) return out;
  for (const key of PROCESS_SHARED_KEYS) {
    const own = Object.getOwnPropertyDescriptor(mainCtx, key);
    if (own && typeof own.get === 'function') {
      Object.defineProperty(out, key, { get: own.get, enumerable: true, configurable: true });
      continue;
    }
    if (mainCtx[key] !== undefined) out[key] = mainCtx[key];
  }
  return out;
}

// The thread and synchronization imports. lib/host-imports.js declares safe
// fallbacks so the WASM import shape is always complete; a host that has a
// ThreadManager must replace every entry. Miss one and the guest gets silent
// success from a wait that never waited -- which is why the list lives here
// rather than being retyped.
//
// The browser satisfies this implicitly: its worker imports come from the same
// getImports() method that installs the overrides, closed over the same
// ThreadManager. The CLI builds worker imports from a free function, so it
// adopts them from the main thread's table explicitly.
const THREAD_PRIMITIVE_IMPORTS = [
  'create_thread', 'duplicate_current_thread',
  'suspend_thread', 'resume_thread',
  'thread_apc_target', 'thread_alert',
  'get_thread_priority', 'set_thread_priority',
  'get_thread_locale', 'set_thread_locale',
  'com_initialize_thread', 'com_uninitialize_thread', 'exit_thread',
  'terminate_thread', 'get_exit_code_thread',
  'create_event', 'open_event', 'set_event', 'reset_event',
  'wait_single', 'wait_multiple',
  'create_semaphore', 'open_semaphore', 'release_semaphore',
];

// Mutable WebAssembly globals are instance-local even when linear memory is
// shared. These are process configuration, not thread state, so every fresh
// instance must receive the same setter calls as the process's main instance.
// Keep this list declarative: the cooperative ThreadManager path and the real
// guest-worker path both consume inheritedWasmCalls(), which makes adding a
// setter in only one backend impossible.
//
// `getter` is used when the main instance exposes the current value. The other
// setters are recorded when command-line/browser configuration applies them.
// `skipZero` is appropriate only for fresh-default-zero debug addresses; zero
// means "nothing to inherit", while feature toggles must preserve zero because
// zero often disables a default-on optimization.
const INHERITED_WASM_GLOBALS = Object.freeze([
  { setter: 'set_cpu_mmx', getter: 'get_cpu_mmx' },
  { setter: 'set_winver', getter: 'get_winver' },
  { setter: 'set_bp', getter: 'get_bp_addr', skipZero: true },
  { setter: 'set_watchpoint_size', getter: 'get_watch_size', skipZero: true },
  { setter: 'set_watchpoint', getter: 'get_watch_addr', skipZero: true },
  { setter: 'set_cs_steal_after' },
  { setter: 'set_fault_unmapped' },
  { setter: 'set_callstack_enabled' },
  { setter: 'set_trace_eip_range' },
  { setter: 'set_count', repeat: true },
  { setter: 'set_loop_trace' },
  { setter: 'set_loop_emit' },
  { setter: 'set_loop_lut_emit' },
  { setter: 'set_loop_copy_emit' },
  { setter: 'set_loop_aoe_fill_emit' },
  { setter: 'set_loop_aoe_span_emit' },
  { setter: 'set_loop_mmx_fill_emit' },
  { setter: 'set_sib_fusion' },
  { setter: 'set_store_span_fusion' },
  { setter: 'set_x87_pipeline4_fusion' },
  { setter: 'set_x87_affine_fusion' },
  // ON by default, so ZERO (--no-x87-island-predecode) is the value to carry.
  { setter: 'set_x87_island_predecode', getter: 'get_x87_island_predecode' },
  // (mask, lo, hi). Defaults leave every fold family and every address in, so
  // a thread that missed this would bisect against the unrestricted decoder.
  { setter: 'set_x87_fuse_debug' },
  { setter: 'set_jump_table' },
  { setter: 'set_rle_run' },
  // The remaining exact folds' off switches (--no-fold=NAME, the fold-vs-uop
  // A/B). ON by default, so ZERO is the meaningful value; before these were
  // listed, a fold's off switch reached the main instance only.
  { setter: 'set_implode_cmp_run' },
  { setter: 'set_mmx_copy64' },
  { setter: 'set_fold_off_mask' },
  { setter: 'set_tree_fold' },
  { setter: 'set_tree_trace' },
  { setter: 'set_region_fold' },
  // Block chaining. OFF by default, so ONE is the meaningful value, and a
  // worker that missed it would be running the other arm of every A/B.
  // set_block_exec clears it on the instance, so the two cannot both be live
  // whatever order this list replays in.
  { setter: 'set_block_chain' },
  { setter: 'set_branch_end_stats' },
  { setter: 'set_block_exec' },
  { setter: 'set_block_exec_min_uops' },
  { setter: 'set_block_exec_max_uops' },
  { setter: 'set_block_exec_trace' },
  // Round 11's load/op split. ON by default, so ZERO is the meaningful value
  // here -- --no-block-exec-split is the A/B partner and a worker that missed
  // it would be running the other arm.
  { setter: 'set_block_exec_split' },
  // Round 12's x87 widening. ON by default, so ZERO is the meaningful value --
  // --block-exec-x87 is the opt-in; this one defaults OFF, so ONE is the
  // meaningful value to propagate (section 17.5).
  { setter: 'set_block_exec_x87' },
  // Round 16's region half of it. ON by default, so ZERO is the meaningful
  // value -- --no-block-exec-x87-regions is the A/B partner and a worker that
  // missed it would be running the other arm.
  { setter: 'set_block_exec_x87_regions' },
  // Round 12's cross-edge fact carry. ON by default, so ZERO is the meaningful
  // value -- --no-block-exec-carry is the A/B partner.
  { setter: 'set_block_exec_carry' },
  // Round 12's RMW store split. ON by default, so ZERO is the meaningful
  // value -- --no-block-exec-rmw is the A/B partner.
  { setter: 'set_block_exec_rmw' },
  // Round 16's one-block leaf entry point. ON by default, so ZERO is the
  // meaningful value -- --no-block-exec-leaf is the A/B partner and a worker
  // that missed it would be running the other arm.
  { setter: 'set_block_exec_leaf' },
  // Round 17's fallback-carrying leaf (H464). ON by default, so ZERO is the
  // meaningful value -- --no-block-exec-leaf-fb is the A/B partner.
  { setter: 'set_block_exec_leaf_fb' },
  // Round 18's unmodelled-terminator side exit (term_kind 10). ON by default,
  // so ZERO is the meaningful value -- --no-block-exec-tail-exits is the A/B
  // partner, and a worker that missed it would install region shapes the main
  // thread declined.
  { setter: 'set_block_exec_tail_exits' },
  // Round 17's per-page descriptor-chunk reserve. Default 0, so NONZERO is the
  // meaningful value here and a worker that missed it would admit one-block
  // descriptors the main thread declined.
  { setter: 'set_page_desc_rg_reserve' },
  // The multi-block half and its two discovery knobs. Zero is meaningful for
  // all three -- `regions 0` is how an A/B turns the matcher off while leaving
  // the executor armed -- so none of them carries skipZero.
  { setter: 'set_block_exec_regions' },
  { setter: 'set_block_exec_walk_k' },
  { setter: 'set_block_exec_walk_budget' },
  // --branch-clock: one block of budget per executed x86 branch instead of per
  // block end (05-alu). OFF by default, so ONE is the meaningful value; a
  // worker that missed it would run its slices on the decode-dependent clock
  // that the micro-op tier A/B turns this on to avoid.
  { setter: 'set_branch_clock' },
  // --code-write-legacy: the old span-based store filter (04-cache). OFF by
  // default, so ONE is the meaningful value; a worker that missed it would
  // decode sparse code without marking the span, and that arm would be a mix.
  { setter: 'set_code_write_legacy' },
  // The micro-op tier (07d/07e). Each instance compiles into its own arena
  // (init_thread picks it), so the switch is per instance too.
  { setter: 'set_uop' },
  // --uop-census records, so a thread's verdicts are in the log too.
  { setter: 'set_uop_census' },
  // --aggressive-stack: the tier's push/pop elision (07e $uc_sp_block). A
  // compile-time choice per instance, so a thread that missed it would run
  // different programs from the main thread.
  { setter: 'set_aggressive_stack' },
  // --uop-muldiv / --uop-icall / --uop-iat: opt-in tier widenings (07e),
  // compile-time per instance like the stack elision above.
  { setter: 'set_uop_muldiv' },
  { setter: 'set_uop_icall' },
  { setter: 'set_uop_iat' },
  // Trace heads (default on, --no-uop-trace-heads): forward traces at heads with no back edge (07e
  // $uc_form_trace), and their size bounds. Compile-time, per instance.
  { setter: 'set_uop_trace_heads' },
  { setter: 'set_uop_trace_limits' },
  // --uop-poor-work: a trace's work-per-entry floor (07d $uop_poor_check).
  // Runtime policy, per instance: a thread that missed it retires traces by a
  // different rule.
  { setter: 'set_uop_poor_work' },
  // --no-uop-trace-cut: straight-line cut exits off (07e $uc_trace_cut).
  // Compile-time, per instance; ZERO is the meaningful value.
  { setter: 'set_uop_trace_cut' },
  // --no-uop-mcopy: mov-pair runs not coalesced (07e $uc_mcopy_on).
  { setter: 'set_uop_mcopy' },
  // --no-uop-hot-sticky: hot-table slots reset on sight (07c $bx_hot_sticky).
  // Runtime policy, per instance; ZERO is the meaningful value.
  { setter: 'set_uop_hot_sticky' },
  // --uop-hot-age=N: halve every hot count each N bumps (07c $bx_hot_age).
  // Runtime policy, per instance; ZERO (never) is meaningful.
  { setter: 'set_uop_hot_age' },
  // --uop-icg-mega=N: an inline-cache site failing N guards is megamorphic
  // (07d $uop_icg_mega). Runtime policy, per instance; ZERO (never) is meaningful.
  { setter: 'set_uop_icg_mega' },
  // MMX lowering (default on, --no-uop-mmx): 07e kind 27. Compile-time, per
  // instance; ZERO is the meaningful value.
  { setter: 'set_uop_mmx' },
  // --uop-mmx-fwd: MMX results forwarded op to op (07e $uc_mmx_fwd, 07d
  // 86-91). Compile-time, per instance; off by default, an experiment.
  { setter: 'set_uop_mmxfwd' },
  // REP MOVS/STOS bulk ops (default on, --no-uop-rep): 07e kind 30.
  // Compile-time, per instance; ZERO is the meaningful value.
  { setter: 'set_uop_rep' },
  // The present cap ($present_pace, 09a8) and how it is spent. Per instance,
  // so a guest thread that missed them presented uncapped whatever the main
  // thread was set to. Zero is meaningful for both (cap off, deadline mode).
  { setter: 'set_present_cap' },
  { setter: 'set_present_pace_mode' },
  // (address, pace): the app's game step, marked by the decoder of every
  // instance so whichever thread runs the step counts and paces it.
  { setter: 'set_logical_frame' },
  // --no-uop-nobump: the page index's no-bump mark (04-cache $uop_fast).
  // Default ON, so ZERO is the meaningful value.
  { setter: 'set_uop_nobump' },
  // run.js --quiet-api with no API consumer: skip the per-call log/log_i32/
  // log_api_exit host calls (09b-dispatch $api_log_on). Default is on, so
  // ZERO is the meaningful value.
  { setter: 'set_api_log' },
]);

const INHERITED_WASM_BY_SETTER = new Map(
  INHERITED_WASM_GLOBALS.map(rule => [rule.setter, rule]));

function createInheritedWasmGlobals() {
  return { calls: {} };
}

// Record the latest process setting. Ordinary setters replace their prior
// call; indexed setters (currently set_count) retain one call per slot.
function recordInheritedWasmGlobal(state, setter, args) {
  const rule = INHERITED_WASM_BY_SETTER.get(setter);
  if (!rule) return false;
  if (!state || typeof state !== 'object') throw new Error('worker-imports: inherited state is required');
  if (!state.calls || typeof state.calls !== 'object') state.calls = {};
  const call = Array.from(args || [], value => Number(value));
  if (rule.skipZero && !(call[0] | 0)) {
    delete state.calls[setter];
    return true;
  }
  if (!rule.repeat) {
    state.calls[setter] = [call];
    return true;
  }
  const key = call.length ? String(call[0] | 0) : '0';
  const previous = Array.isArray(state.calls[setter]) ? state.calls[setter] : [];
  const next = previous.filter(entry => String((entry && entry[0]) | 0) !== key);
  next.push(call);
  next.sort((a, b) => ((a && a[0]) | 0) - ((b && b[0]) | 0));
  state.calls[setter] = next;
  return true;
}

function mergeInheritedWasmGlobals(target, source) {
  if (!source || !source.calls) return target;
  for (const rule of INHERITED_WASM_GLOBALS) {
    const calls = source.calls[rule.setter];
    if (!Array.isArray(calls)) continue;
    for (const args of calls) recordInheritedWasmGlobal(target, rule.setter, args);
  }
  return target;
}

function captureInheritedWasmGlobals(exports) {
  const state = createInheritedWasmGlobals();
  if (!exports) return state;
  for (const rule of INHERITED_WASM_GLOBALS) {
    if (!rule.getter || typeof exports[rule.getter] !== 'function') continue;
    recordInheritedWasmGlobal(state, rule.setter, [exports[rule.getter]()]);
  }
  return state;
}

function inheritedWasmCalls(state) {
  const out = [];
  if (!state || !state.calls) return out;
  for (const rule of INHERITED_WASM_GLOBALS) {
    const calls = state.calls[rule.setter];
    if (!Array.isArray(calls)) continue;
    for (const args of calls) out.push({ setter: rule.setter, args: args.slice() });
  }
  return out;
}

function applyInheritedWasmGlobals(exports, state) {
  for (const call of inheritedWasmCalls(state)) {
    const setter = exports && exports[call.setter];
    if (typeof setter === 'function') setter(...call.args);
  }
}

// Point a worker's thread/event imports at the main thread's, so every thread
// in the process schedules against one ThreadManager. Throws on a name the main
// table does not implement: a missing primitive here is a guest that waits on
// nothing and continues, and that failure is far cheaper to find now.
function adoptThreadPrimitives(workerHost, mainHost) {
  for (const name of THREAD_PRIMITIVE_IMPORTS) {
    if (typeof mainHost[name] !== 'function') {
      throw new Error(`worker-imports: main host has no ${name}() to adopt — ` +
        `a worker would get the return-0 stub and wait on nothing`);
    }
    workerHost[name] = mainHost[name];
  }
  return workerHost;
}

// The API trace pair. WAT calls log(name) before a handler and log_i32(value)
// after it, so the return belongs to the call just logged and is shown only
// when that call was -- the latch is why these two cannot be written
// independently, and both hosts had rediscovered it.
//
// Filtering is the caller's business (--trace-api=NAMES and --quiet-api in the
// CLI, the toolbar's name set in the browser) and so is where the text goes,
// but the decode, the 256-byte clamp and the latch are the same everywhere. The
// filter is not a nicety: without it a two-process run emitted 2.3M lines from
// worker idle polls alone and died of heap exhaustion inside console.log.
// `formatCall(name)` / `formatReturn(name, value)` are optional: supply them and
// the worker trace carries typed arguments and a decoded return exactly like the
// main thread's, instead of a bare name. They need the *worker* instance's esp,
// which does not exist yet when the import table is built, so they are called
// lazily here and may return null (before the instance exists, or for an API
// with no args:[] typing in api_table.json) to fall back to the bare form.
function makeWorkerApiLogger(opts) {
  const getBuffer = opts.getBuffer;
  const shouldLog = opts.shouldLog || (() => false);
  const emit = opts.emit;
  const onCall = opts.onCall || null;
  const formatValue = opts.formatValue || ((v) => `0x${(v >>> 0).toString(16)}`);
  const formatCall = opts.formatCall || null;
  const formatReturn = opts.formatReturn || null;
  const tid = opts.threadId | 0;
  // COM methods dispatch by api id: 09b-dispatch.wat sends a 0xC0DE0000|id
  // marker through log_i32 and then logs the placeholder name '<ord>'. The
  // main-thread trace resolves it; without the same step here a worker's
  // IDirectSoundBuffer_Lock is '<ord>' and no --trace-api=NAMES filter can
  // ever match it. `resolveComName(id)` returns the api_table name or null.
  const resolveComName = opts.resolveComName || null;
  let visible = false;
  let pending = '';
  let pendingComId = -1;

  return {
    log: (ptr, len) => {
      const bytes = new Uint8Array(getBuffer(), ptr, Math.min(len, 256));
      let name = '';
      for (let i = 0; i < bytes.length && bytes[i]; i++) name += String.fromCharCode(bytes[i]);
      if (name === '<ord>' && pendingComId >= 0 && resolveComName) {
        const resolved = resolveComName(pendingComId);
        if (resolved) name = resolved;
      }
      pendingComId = -1;
      if (onCall) onCall(name);
      visible = !!shouldLog(name);
      if (!visible) { pending = ''; return; }
      pending = name;
      let header = null;
      if (formatCall) { try { header = formatCall(name); } catch (_) { header = null; } }
      emit(`[API T${tid}] ${header || name}`);
    },
    log_i32: (val) => {
      if (((val >>> 0) >>> 16) === 0xC0DE) { pendingComId = (val >>> 0) & 0xFFFF; return; }
      if (!visible) return;
      let decoded = null;
      if (formatReturn) { try { decoded = formatReturn(pending, val); } catch (_) { decoded = null; } }
      emit(`  => ${decoded || formatValue(val)}`);
    },
  };
}

// The CLI's worker-trace policy. An explicit --trace-api=NAMES logs those
// names from every thread, as it does on the main thread: --quiet-api only
// suppresses the unconditional one-liner, and an earlier `&& !quietApi` here
// hid every guest-thread call from a filtered trace (Anachronox's Miles mixer
// thread looked as if it never touched DirectSound). A bare --trace-api still
// stays quiet on workers under --quiet-api, since that unfiltered firehose of
// idle polls is what once exhausted the heap.
function workerApiShouldLog({ traceApi, quietApi, filter }, name) {
  if (!traceApi) return false;
  if (filter) return filter.has(name);
  return !quietApi;
}

const workerImports = {
  workerApiShouldLog,
  PROCESS_SHARED_KEYS,
  processSharedCtx,
  THREAD_PRIMITIVE_IMPORTS,
  adoptThreadPrimitives,
  makeWorkerApiLogger,
  INHERITED_WASM_GLOBALS,
  createInheritedWasmGlobals,
  recordInheritedWasmGlobal,
  mergeInheritedWasmGlobals,
  captureInheritedWasmGlobals,
  inheritedWasmCalls,
  applyInheritedWasmGlobals,
};

if (typeof globalThis !== 'undefined') globalThis.workerImports = workerImports;
if (typeof module !== 'undefined') module.exports = workerImports;
