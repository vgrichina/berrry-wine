// Host-import broker: lets a guest thread run in a Worker while the host
// imports it calls keep executing on the main thread, unchanged.
//
// WHY A GENERIC BROKER AND NOT 178 HAND-WRITTEN PROXIES
// The module imports 178 host functions. Re-implementing them worker-side would
// be a rewrite of lib/host-imports.js and a second thing to keep correct. This
// marshals the call instead, so the one existing implementation runs — on the
// main thread, where the canvas, the audio graph and localStorage actually are.
//
// WHY IT IS AFFORDABLE
// Measured on Blobby, 600 batches (~120M guest steps): 57,155 host calls total,
// of which 44,930 are `log` / `log_api_exit`. The interpreter's hot loop is pure
// WASM; the host is called ~20 times per batch. So the cost of brokering is not
// per-instruction, it is per-host-call, and there are few.
//
//   log                  22465   void, POINTER arg  → must block (see below)
//   log_api_exit         22465   void, no args      → fire and forget
//   net_frame_peek        2407   returns            → round trip
//   check_input           2403   returns, dequeues  → round trip
//   get_ticks             2402   returns            → published slot, no trip
//   get_mouse_position    2400   returns            → round trip
//   get_window_rect       1278   returns            → round trip
//   everything else        <100  mixed
//
// So: one published slot (the clock), a five-entry allowlist of value-only void
// calls that may be fired and forgotten, and a real round trip for everything
// else. The tempting version of this — "void calls never block" — is WRONG, and
// the reason is worth keeping: a void import that takes a pointer is read by the
// main thread after the guest has already run on, so the buffer it points at may
// have been reused. `log(ptr, len)` is exactly that shape.
//
// LAYOUT
// One control block per guest thread, in THREAD_RPC — the last megabyte of the
// shared linear memory, declared in src/01-header.wat so nothing else can claim
// it. The earlier single block sat at 0x1F000000, which was 48MB INSIDE the
// CreateDIBSection pixel arena: a guest that allocated that much DIB would
// overwrite a worker's status word and park it forever. The WAT globals are the
// authority for these numbers now; test/test-wat-rpc-region.js pins them.
//
// Blocks are indexed by thread slot, not by tid, so slot 0 is the guest's main
// thread and slot N is the Nth CreateThread worker. Each is 64 ints (256 bytes),
// its own cache lines, so two threads' status words never share one.

(function (root) {
  'use strict';

  const GLCommandStream = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./gl-command-stream') : root.GLCommandStream;
  // The map, not a copy of it: generated from src/00-regions.wat's declarations
  // (docs/watx-region-safety-design.md §6). In the browser and in a web worker it
  // arrives as the global lib/region-map.generated.js installs.
  const Regions = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./region-map.generated') : root.RegionMap;

  const RPC_BASE = Regions.BASE.THREAD_RPC;  // byte offset in the shared memory
  const CTRL_INTS = 64;               // per-thread control block, in i32 slots
  const RPC_STRIDE = CTRL_INTS * 4;   // 256 bytes — a whole number of cache lines
  // The last AUDIO_BLOCKS blocks are not thread slots: they hold the AudioWorklet
  // voice descriptors (lib/audio-worklet-host.js) and the voice map, so a guest
  // Worker reads a routed voice's play cursor out of shared memory instead of
  // waiting for the page to answer voice_get_pos. See AUDIO_* below.
  const AUDIO_BLOCKS = 16;
  const RPC_MAX_SLOTS = Regions.SIZE.THREAD_RPC / RPC_STRIDE - AUDIO_BLOCKS;
  const AUDIO_BASE = RPC_BASE + RPC_MAX_SLOTS * RPC_STRIDE;
  const AUDIO_BYTES = AUDIO_BLOCKS * RPC_STRIDE;
  // Layout inside AUDIO_BASE: AUDIO_VOICES descriptors of AUDIO_DESC_INTS ints
  // (the worklet's DESC.STRIDE), then the voice map, AUDIO_VOICES entries of
  // AUDIO_MAP_INTS: [voice id, published]. Map entry i describes descriptor i.
  const AUDIO_VOICES = 32;
  const AUDIO_DESC_INTS = 16;
  const AUDIO_DESC = { PTR: 2, LEN: 3, CURSOR: 8 };   // == audio-worklet-host.js DESC
  const AUDIO_MAP_BASE = AUDIO_BASE + AUDIO_VOICES * AUDIO_DESC_INTS * 4;
  const AUDIO_MAP_INTS = 2;
  const AUDIO_MAP = { ID: 0, LIVE: 1 };
  const I32 = n => n * 4;
  const SYNC_TABLE = Regions.BASE.SYNC_TABLE;
  const SYNC_ENTRY_INTS = 4;
  const SYNC_OBJECTS = Regions.SIZE.SYNC_TABLE / (SYNC_ENTRY_INTS * 4);
  const WAIT_OBJECT_0 = 0;
  const WAIT_TIMEOUT = 0x102;
  const INFINITE = 0xFFFFFFFF;

  const SLOT = {
    STATUS: 0,        // 0 idle, 1 request pending, 2 response ready
    FN: 1,            // import id
    ARGC: 2,
    RESULT: 3,
    TICK: 4,          // main-published guest clock (ms)
    MOUSE_X: 5,
    MOUSE_Y: 6,
    GEN: 7,           // bumped by main whenever published state changes
    INPUT_PENDING: 8, // renderer input queue depth, published by main
    INPUT_WAKE: 9,    // one-shot request for slot 0 to end its current slice
    STEP_EPOCH: 10,   // bumped + notified by the page when a host step's main slice is done
    MAIL: 11,         // per slot: bumped by the page on every non-slice request it posts to that Worker
    ARGS: 12,         // 16 slots (12..27)
    F64_RESULT: 32,   // 2 slots, read via Float64Array
    // Slot 0's block doubles as the published block (views().pub), so these
    // live past its RPC words. WAT reads only INPUT_WAKE (offset=36).
    KEYS: 40,         // 8 slots (40..47): live key-down bitmap, bit vKey
    KEYS_VALID: 48,   // 1 once the page has published KEYS at all
    MOUSE_VALID: 49,  // 1 once the page has published MOUSE_X/Y at all
    // Written by guest threads, not the page (opts.dxTraceLocal): DirectDraw
    // Unlocks since start, and how many surfaces some thread holds locked.
    DX_DIRTY: 50,
    DX_LOCKS: 51,
    // Bumped by the page when a gdi_surface_* call a Worker sent without
    // waiting (see dxSurfaceMemo) failed after all; the Worker drops its memo.
    DX_SURF_EPOCH: 52,
  };

  // STATUS_ERR: the import threw on the main thread. In-process, that throw
  // unwinds out of the guest and stops the run; a worker that read 0 instead
  // carried on as if the call had merely failed (NFS II's installer saw a
  // TypeError in the VFS as an ordinary CreateFile failure). The worker
  // rethrows on it, so both modes stop at the same place.
  const STATUS_IDLE = 0, STATUS_REQ = 1, STATUS_RESP = 2, STATUS_ERR = 3;

  // Void imports whose arguments are values, never pointers into guest memory,
  // so the main thread can run them at its leisure. Everything else blocks —
  // see the note in createWorkerImports. Verified against src/01-header.wat and
  // the implementations in lib/host-imports.js.
  const ASYNC_SAFE = new Set([
    'log_i32',            // (val) — the value IS the message
    'log_eip',            // (eip)
    'log_api_exit',       // ()
    'set_cursor',         // (cursor id)
    'set_mouse_position', // (x, y)
    'paint_begin',        // (hwnd) — ordered compositor transaction marker
    'paint_end',          // (hwnd) — ordered compositor transaction marker
    // (kind, slot, a, b, c) — values only. D3DIM calls this several hundred
    // times per frame, while the ordinary host implementation only records
    // kind 5's presented surface slot. Worker messages retain FIFO order, so
    // that record still reaches the browser before the following synchronous
    // present import without parking the guest for every trace point.
    'dx_trace',
    // (ptr, len) — the exception to the pointer rule above, and it is checked
    // rather than assumed. All three callers are in $win32_dispatch: the name
    // inside the PE's import table, the fixed 0x2E0 placeholder for a resolved
    // ordinal, and the 0x2D0 scratch buffer for an unimplemented API. The first
    // two are immutable for the life of the process; the third is followed
    // immediately by $crash_unimplemented, so that thread issues no further
    // dispatch that could overwrite it before the message is read.
    //
    // Worth the check: this is called twice per Win32 API dispatch, and it was
    // 10,378 blocking round trips — half of everything Winamp's decode thread
    // did — for two lines that --quiet-api then threw away.
    'log',
  ]);

  // Pure functions of their arguments. They touch no guest memory, no renderer
  // and no main-thread state, so a worker computes them itself instead of
  // stopping until the main thread takes a turn — the same idea as the
  // published clock, minus the publishing. lib/host-imports.js implements these
  // as the bare Math functions, so the answers are identical, not approximate.
  //
  // This is not a micro-optimisation: Winamp's MP3 decoder called math_pow
  // 9,909 times in one 1200-batch run, each one a postMessage and an
  // Atomics.wait, and that was half of everything that thread did.
  const PURE_MATH = {
    math_sin: Math.sin,
    math_cos: Math.cos,
    math_tan: Math.tan,
    math_atan2: Math.atan2,
    math_log2: Math.log2,
    math_pow: Math.pow,
    math_pow2: x => 2 ** x,
  };

  function blockBase(slot) {
    const s = slot | 0;
    if (s < 0 || s >= RPC_MAX_SLOTS) throw new Error(`rpc slot ${slot} out of range`);
    return RPC_BASE + s * RPC_STRIDE;
  }

  // Each thread gets `i32`/`f64` over its OWN block for the request handshake,
  // and `pub` over block 0 for the state the main thread publishes once for
  // everybody (clock, mouse, input depth). Publishing per-thread would mean N
  // writes per 4ms tick and N clocks that could disagree.
  function views(memory, slot) {
    const base = blockBase(slot || 0);
    return {
      i32: new Int32Array(memory.buffer, base, CTRL_INTS),
      f64: new Float64Array(memory.buffer, base + I32(SLOT.F64_RESULT), 2),
      pub: new Int32Array(memory.buffer, RPC_BASE, CTRL_INTS),
    };
  }

  // Read the main thread's published input-queue depth. The guest's
  // message-wait resume needs it, and an RPC per poll would round-trip on every
  // idle spin — the one place where a published snapshot is both cheap and
  // harmless, since a stale "no input" only costs one more spin.
  function readInputPending(memory) {
    return Atomics.load(views(memory, 0).pub, SLOT.INPUT_PENDING) | 0;
  }

  // A recursive synchronous WndProc runs inside the current interpreter call.
  // Returning the emulator's 0xFFFF yield sentinel from a wait at that point
  // abandons the recursive frame, so the instruction after the wait can never
  // run. A real Worker can instead park here: the browser thread remains free
  // to broker SetEvent/ReleaseSemaphore from another guest Worker, and those
  // operations wake this shared state directly.
  //
  // `null` means at least one handle is not an event/semaphore in the shared
  // table. The caller then uses the ordinary broker path so thread/process
  // handles retain ThreadManager's existing semantics.
  function waitSharedSyncObjects(memory, handles, waitAll, timeout, namedSyncBuffer,
    syncTableAddress = SYNC_TABLE) {
    if (!memory || typeof SharedArrayBuffer !== 'function'
        || !(memory.buffer instanceof SharedArrayBuffer)) return null;
    if (!Array.isArray(handles) || handles.length === 0) return 0xFFFFFFFF;
    const sync = new Int32Array(
      memory.buffer, syncTableAddress, SYNC_OBJECTS * SYNC_ENTRY_INTS);
    const wanted = handles.map(handle => handle >>> 0);
    const timeoutMs = timeout >>> 0;
    const deadline = timeoutMs === INFINITE ? Infinity : Date.now() + timeoutMs;

    const resolve = handle => {
      for (let idx = 0; idx < SYNC_OBJECTS; idx++) {
        const base = idx * SYNC_ENTRY_INTS;
        if ((Atomics.load(sync, base) >>> 0) !== handle) continue;
        const type = Atomics.load(sync, base + 1);
        if (type === 4) {
          if (!(namedSyncBuffer instanceof SharedArrayBuffer)) return null;
          const view = new Int32Array(namedSyncBuffer);
          const slot = Atomics.load(sync, base + 2);
          const token = Atomics.load(sync, base + 3) >>> 0;
          const target = slot * SYNC_ENTRY_INTS;
          if (slot < 0 || target + 3 >= view.length
              || (Atomics.load(view, target) >>> 0) !== token) return null;
          const sharedType = Atomics.load(view, target + 1);
          if (sharedType !== 1 && sharedType !== 2) return null;
          return { base: target, type: sharedType, view };
        }
        if (type !== 1 && type !== 2) return null;
        return { base, type, view: sync };
      }
      return null;
    };
    const resolveAll = () => {
      const objects = wanted.map(resolve);
      return objects.every(Boolean) ? objects : null;
    };
    const ready = object => Atomics.load(object.view, object.base + 2) > 0;
    const consume = object => {
      const sync = object.view;
      const state = object.base + 2;
      if (object.type === 1) {
        if (Atomics.load(sync, object.base + 3)) return ready(object);
        return Atomics.compareExchange(sync, state, 1, 0) === 1;
      }
      while (true) {
        const count = Atomics.load(sync, state);
        if (count <= 0) return false;
        if (Atomics.compareExchange(sync, state, count, count - 1) === count) return true;
      }
    };
    const restore = object => {
      const sync = object.view;
      const state = object.base + 2;
      if (object.type === 1) {
        if (!Atomics.load(sync, object.base + 3)) Atomics.store(sync, state, 1);
      } else {
        Atomics.add(sync, state, 1);
      }
      Atomics.notify(sync, state);
    };

    while (true) {
      const objects = resolveAll();
      if (!objects) return null;

      if (waitAll) {
        if (objects.every(ready)) {
          const consumed = [];
          let complete = true;
          for (const object of objects) {
            // Manual-reset events are observed but never consumed.
            if (object.type === 1 && Atomics.load(object.view, object.base + 3)) continue;
            if (!consume(object)) { complete = false; break; }
            consumed.push(object);
          }
          if (complete) return WAIT_OBJECT_0;
          // Another waiter won a race between the readiness and consume
          // passes. Put back only the tokens this attempt took and retry.
          for (const object of consumed) restore(object);
        }
      } else {
        for (let i = 0; i < objects.length; i++) {
          if (consume(objects[i])) return WAIT_OBJECT_0 + i;
        }
      }

      if (timeoutMs === 0) return WAIT_TIMEOUT;
      const remaining = deadline - Date.now();
      if (remaining <= 0) return WAIT_TIMEOUT;
      // A wait-any can be woken by an object other than the one selected here.
      // Bound the sleep so it notices that signal without busy-spinning.
      const sleeper = objects.find(object => !ready(object)) || objects[0];
      const state = sleeper.base + 2;
      const observed = Atomics.load(sleeper.view, state);
      Atomics.wait(sleeper.view, state, observed, Math.min(10, remaining));
    }
  }

  // ---- worker side ---------------------------------------------------------

  // Builds the import object a worker-hosted instance is instantiated with.
  // `post` sends a message to the main thread; `sigs` is
  // lib/host-import-sigs.generated.json.
  // `opts.slot` selects this thread's control block (0 = the guest's main
  // thread). Every message this side posts carries the slot, so the main thread
  // knows which block to serve without keeping a worker→slot map of its own.
  function createWorkerImports(memory, sigs, rawPost, opts) {
    opts = opts || {};
    const slot = (opts.slot || 0) | 0;
    const v = views(memory, slot);
    const names = Object.keys(sigs).sort();          // stable ids both sides
    const host = {};
    const stats = { sync: 0, async: 0, local: 0 };
    // Fire-and-forget calls ride to the main thread in batches. One
    // postMessage each was the whole cost of an async import: DX-Ball issues
    // ~8.5K dx_trace/s, and every one was a structured clone plus a task on
    // the page's thread. Order is kept by flushing before anything else this
    // thread posts (the blocking RPC below all go through `post`, the worker
    // flushes before its own messages via flushAsync), and a batch never
    // sits longer than ASYNC_BATCH_MS or grows past ASYNC_BATCH_MAX calls.
    const ASYNC_BATCH_MAX = 256;
    const ASYNC_BATCH_MS = 4;
    const nowMs = typeof performance !== 'undefined' && performance.now
      ? () => performance.now() : () => Date.now();
    let asyncQueue = [];
    let asyncQueueAt = 0;
    const flushAsync = () => {
      if (asyncQueue.length === 0) return;
      const list = asyncQueue;
      asyncQueue = [];
      rawPost({ t: 'calls', slot, list });
    };
    const post = msg => { flushAsync(); rawPost(msg); };
    const postAsync = (id, args) => {
      stats.async++;
      if (asyncQueue.length === 0) asyncQueueAt = nowMs();
      asyncQueue.push(id, args);
      if (asyncQueue.length >= ASYNC_BATCH_MAX * 2 ||
          nowMs() - asyncQueueAt >= ASYNC_BATCH_MS) flushAsync();
    };
    // Input polling state for the fast paths below. `inputEventOpen`: this
    // thread's last check_input took an event, so the main side still holds it
    // as the active event and the next empty poll must go there to clear it.
    // `inputCacheGen`: the SLOT.GEN the cached mouse/key answers were read at.
    let inputEventOpen = false;
    let inputCacheGen = -1;
    let mouseCache = 0, mouseCacheValid = false, mouseSetPending = false;
    const keyCache = new Int32Array(256);
    const keyCacheValid = new Uint8Array(256);
    const inputCacheCurrent = () => {
      const gen = Atomics.load(v.pub, SLOT.GEN);
      if (gen === inputCacheGen) return true;
      inputCacheGen = gen;
      mouseCacheValid = false;
      keyCacheValid.fill(0);
      rectCache.clear();
      return false;
    };
    // get_window_rect answers, hwnd -> [l, t, r, b], under the same GEN rule,
    // and also dropped by any other blocking import this thread makes: that
    // is the only way the guest itself can move or size a window (none of
    // the fire-and-forget imports touch geometry).
    const rectCache = new Map();
    // DirectDraw present path (src/09a8 $dx_present): every presented frame
    // makes three blocking calls — gdi_surface_create through $gdi_dx_dc_bind,
    // then attach and upload — ~110 round trips a second each in DX-Ball and
    // StarCraft, and all three answer 1 for the same surface every frame. With
    // opts.dxTraceLocal a DirectDraw surface id (0x200000..0x2FFFFF) whose
    // call already succeeded with the same arguments is sent in the async batch
    // and answered 1 here. The call still runs on the page, in order. Create is
    // keyed without its bits pointer: Flip exchanges it every frame, and the
    // page's reuse path accepts any pointer for a DirectDraw surface.
    const dxSurfaceMemo = new Map();   // surface id -> { name: argument key }
    let dxSurfaceEpoch = 0;
    const dxSurfaceMemoFor = sid => {
      const epoch = Atomics.load(v.pub, SLOT.DX_SURF_EPOCH) | 0;
      if (epoch !== dxSurfaceEpoch) { dxSurfaceMemo.clear(); dxSurfaceEpoch = epoch; }
      let memo = dxSurfaceMemo.get(sid);
      if (!memo) { memo = {}; dxSurfaceMemo.set(sid, memo); }
      return memo;
    };

    if (sigs.gpu_gl_call && !GLCommandStream) {
      throw new Error('gpu_gl_call requires the native GL command transport');
    }

    const waitForResponse = message => {
      Atomics.store(v.i32, SLOT.STATUS, STATUS_REQ);
      try { post(message); }
      catch (err) { Atomics.store(v.i32, SLOT.STATUS, STATUS_IDLE); throw err; }
      while (Atomics.load(v.i32, SLOT.STATUS) === STATUS_REQ) {
        Atomics.wait(v.i32, SLOT.STATUS, STATUS_REQ, 1000);
      }
      const status = Atomics.load(v.i32, SLOT.STATUS);
      const out = v.i32[SLOT.RESULT];
      Atomics.store(v.i32, SLOT.STATUS, STATUS_IDLE);
      if (status === STATUS_ERR) {
        const what = message.t === 'rpc' ? names[v.i32[SLOT.FN]] : message.t;
        throw new Error(`host import ${what} threw on the main thread (its stack is in the main-thread log)`);
      }
      return out;
    };

    // Synchronous loader code cannot hand a host callback across postMessage,
    // but it still has to make Sleep visible to GetTickCount before DllMain
    // resumes. Reuse the worker's blocking control slot for a small data-only
    // clock request. The main side updates its authoritative guest clock and
    // publishes the resulting value before waking this Worker.
    const advanceGuestTime = ms => {
      const requested = Number(ms);
      const delta = Number.isFinite(requested)
        ? Math.min(0x7FFFFFFF, Math.max(0, Math.floor(requested))) : 0;
      if (!delta) return Atomics.load(v.pub, SLOT.TICK) | 0;
      return waitForResponse({ t: 'advanceGuestTime', slot, ms: delta });
    };

    const brokerCall = (id, args, returnsF64) => {
      stats.sync++;
      const n = Math.min(args.length, 16);
      for (let i = 0; i < n; i++) v.i32[SLOT.ARGS + i] = args[i] | 0;
      v.i32[SLOT.FN] = id;
      v.i32[SLOT.ARGC] = n;
      const i32Result = waitForResponse({ t: 'rpc', slot });
      return returnsF64 ? v.f64[0] : i32Result;
    };

    names.forEach((name, id) => {
      const sig = sigs[name];
      const returnsValue = sig.results.length > 0;
      const returnsF64 = sig.results[0] === 'f64';

      if (name === 'gpu_gl_call') {
        host[name] = (opcode, stackWa, aux) => {
          stats.local++;
          // D3D validation, draw, query and resource synchronization consume
          // native memory through the broker, never through the GL encoder.
          if (opcode >= 0x30000 && opcode <= 0x30017) return brokerCall(id, [opcode, stackWa, aux], false);
          if (opts.d3dCommands) {
            const d3dResult = opts.d3dCommands.call(opcode, stackWa, aux);
            if (d3dResult >= 0) return d3dResult | 0;
          }
          // Reserved for the opt-in D3DIM render consumers (the software
          // encoder and the WebGL executor above). A normal Worker instance
          // reports "not queued" so WAT renders synchronously. The range has
          // to cover the WHOLE executor protocol, CLEAR (0x20004) included:
          // a consumer-less Worker that fell through here threw
          // "unexpected direct OpenGL worker call opcode" instead of taking
          // the software path, so a guest that cleared a depth surface died
          // in the Worker and nowhere else.
          // 0x20005/0x20006 are software-OpenGL draws and texture uploads
          // for the same consumer.
          if ((opcode | 0) >= 0x20000 && (opcode | 0) <= 0x20007) return 0;
          // WAT has already encoded this batch in shared linear memory. Send
          // only its offset and length; the broker replays it before waking us,
          // so the producer may safely reuse the range on return.
          if ((opcode | 0) === GLCommandStream.WAT_STREAM_FLUSH_OPCODE) {
            stats.sync++;
            const result = waitForResponse({
              t: 'glBatch', slot,
              memoryOffset: stackWa >>> 0,
              bytes: aux >>> 0,
              softwareFront: opts.getExports?.().gl_sw_front?.() >>> 0,
              softwareConfig: opts.softwareGLConfig,
            });
            if (opts.softwareGLConfig) opts.configureSoftwareGL?.(opts.softwareGLConfig);
            return result;
          }
          throw new RangeError(`unexpected direct OpenGL worker call opcode ${opcode | 0}; WAT encoder required`);
        };
        return;
      }

      // Every Win32/COM dispatch is bracketed by entry/exit logging hooks, and
      // resolved ordinals add log_i32. In a normal browser run the receiving
      // handlers are no-ops, so posting each hook individually only floods the
      // main event loop. `forwardGuestLogs` is the wire-level opt-in set by
      // verbose/API/diagnostic trace sessions. Accept the old OpenGL-era name
      // for callers from a cached page, but new code no longer describes the
      // complete guest diagnostic channel as GL-specific.
      const forwardGuestLogs = opts.forwardGuestLogs === undefined
        ? !!opts.forwardGlLogs : !!opts.forwardGuestLogs;
      if (!forwardGuestLogs &&
          (name === 'log' || name === 'log_i32' || name === 'log_api_exit')) {
        host[name] = () => { stats.local++; };
        return;
      }

      // --- local fast paths. Each reads state the main thread publishes, so
      // the guest never waits for a main-thread turn to learn the time, where
      // the pointer is, or whether a key was pressed.
      if (name === 'get_ticks') {
        host[name] = () => { stats.local++; return Atomics.load(v.pub, SLOT.TICK); };
        return;
      }
      // A DirectSound ring the page's AudioWorklet renders straight out of
      // shared memory (lib/audio-worklet-host.js). Its play cursor is published
      // by the worklet itself, and a refresh Unlock only rewrites a descriptor
      // the worklet already holds, so neither needs the guest to stop until
      // the page takes a turn. That wait was the whole cost: fmod's mixer
      // thread polls the cursor ~70 times a second, and each poll stood still
      // for however long the page was busy presenting or laying out.
      if (name === 'voice_get_pos' || name === 'voice_play_ring') {
        const importId = id;
        let audio;
        const voices = () => (audio === undefined ? (audio = audioVoiceViews(memory)) : audio);
        host[name] = name === 'voice_get_pos'
          ? (voice) => {
              const a = voices();
              const i = a ? a.find(voice) : -1;
              if (i >= 0) {
                const len = a.len(i);
                const cursor = a.cursor(i);
                if (len > 0 && a.live(i, voice)) { stats.local++; return (cursor % len) | 0; }
              }
              return brokerCall(importId, [voice], false);
            }
          : (voice, ptr, len, startOff, loop) => {
              const args = [voice, ptr, len, startOff, loop];
              // Only the refresh (loop === 2) of a routed ring with the same
              // extent: the page's answer is a descriptor write, and the worklet
              // reads the PCM itself, so there is no pointer to go stale.
              const a = (loop | 0) === 2 ? voices() : null;
              const i = a ? a.find(voice) : -1;
              if (i >= 0 && a.ptr(i) === (ptr >>> 0) && a.len(i) === (len >>> 0)) {
                // Not batched: the worklet is waiting on this descriptor, so
                // it goes now (post drains any queued calls ahead of it).
                stats.async++;
                post({ t: 'call', id: importId, args, slot });
                return 0;
              }
              return brokerCall(importId, args, false);
            };
        return;
      }
      if (PURE_MATH[name]) {
        const fn = PURE_MATH[name];
        host[name] = (...args) => { stats.local++; return fn(...args); };
        return;
      }
      if ((name === 'wait_single' || name === 'wait_multiple') &&
          typeof opts.getSyncMsgDepth === 'function') {
        host[name] = (...args) => {
          let depth = 0;
          try { depth = opts.getSyncMsgDepth() | 0; } catch (_) {}
          if (depth > 0) {
            let handles = null;
            let waitAll = false;
            let timeout = 0;
            if (name === 'wait_single') {
              handles = [args[0] >>> 0];
              timeout = args[1] >>> 0;
            } else {
              const count = args[0] >>> 0;
              const handlesWa = args[1] >>> 0;
              waitAll = !!args[2];
              timeout = args[3] >>> 0;
              if (count > 0 && count <= 64 && handlesWa + count * 4 <= memory.buffer.byteLength) {
                const mem = new Uint32Array(memory.buffer, handlesWa, count);
                handles = Array.from(mem, handle => handle >>> 0);
              }
            }
            if (handles) {
              // A secondary guest Worker may have finished its current slice
              // just before this thread queued the work it is waiting for. Let
              // the browser scheduler keep issuing those slices while this
              // Worker is parked; the matching end is posted before the outer
              // slice reply on the same message channel.
              if (slot === 0) post({ t: 'nestedWaitBegin', slot });
              else flushAsync();
              const result = waitSharedSyncObjects(memory, handles, waitAll, timeout, opts.namedSyncBuffer);
              if (slot === 0) post({ t: 'nestedWaitEnd', slot });
              if (result !== null) { stats.local++; return result; }
            }
          }
          return brokerCall(id, args, returnsF64);
        };
        return;
      }
      // Input polling. These used to take the round trip unconditionally, on
      // a Blobby census of ~4 calls a batch. A game polling from its own loop
      // is a different animal: measured 2026-09-23 on ascii.dev, Diablo made
      // ~52K check_input + ~15K get_mouse_position round trips a second and
      // RCT ~8K get_key_down_state, each one parking the guest until the page
      // took a turn — Worker mode 11-17% slower than cooperative on both.
      //
      // Nothing here reads a published snapshot of the answers themselves:
      // renderer-input's answers depend on the event being dispatched
      // (`_activeInputEvent`), and check_input dequeues. Instead:
      //
      //  check_input answers "no input" locally only when the published queue
      //  depth is 0 AND this thread holds no open event. Every enqueue
      //  publishes the depth (renderer _wakeMessageWait/_publishInputQueueDepth),
      //  so a stale 0 is at worst one publish late. The first empty poll after
      //  an event still goes to the main side, because that call is what
      //  clears the active event there.
      //
      //  get_key_down_state reads the published key bitmap when no event is
      //  open (see below).
      //
      //  get_mouse_position / get_key_down_state are cached per SLOT.GEN. The
      //  main side bumps GEN on every publish — input arriving and the 4ms
      //  clock tick — and a check_input round trip drops the cache, since
      //  taking or clearing an event changes what both return.
      if (name === 'check_input') {
        host[name] = () => {
          if (!inputEventOpen && Atomics.load(v.pub, SLOT.INPUT_PENDING) === 0) {
            stats.local++;
            return 0;
          }
          const r = brokerCall(id, [], false);
          inputEventOpen = r !== 0;
          inputCacheGen = -1;
          mouseCacheValid = false;
          keyCacheValid.fill(0);
          return r;
        };
        return;
      }
      if (name === 'get_mouse_position') {
        host[name] = () => {
          // With no event open the main side answers from the renderer's
          // live pointer, which it publishes on every pointer move
          // (renderer _setMousePoint). A set_mouse_position this thread
          // issued rides the async batch, so the first read after one takes
          // the round trip, which flushes that batch ahead of itself.
          if (!inputEventOpen && !mouseSetPending &&
              Atomics.load(v.pub, SLOT.MOUSE_VALID) === 1) {
            stats.local++;
            return (((Atomics.load(v.pub, SLOT.MOUSE_Y) & 0xFFFF) << 16) |
              (Atomics.load(v.pub, SLOT.MOUSE_X) & 0xFFFF));
          }
          mouseSetPending = false;
          if (inputCacheCurrent() && mouseCacheValid) { stats.local++; return mouseCache; }
          mouseCache = brokerCall(id, [], false);
          mouseCacheValid = true;
          return mouseCache;
        };
        return;
      }
      // A top-level rect lives in the page's renderer, and WAT asks for it on
      // every DC bind and client-to-screen conversion: Blobby 2.6K round trips
      // a second, ~53 per frame, for a rect that changed none of those times.
      if (name === 'get_window_rect') {
        host[name] = (hwnd, rectPtr) => {
          const key = hwnd >>> 0;
          let rect = inputCacheCurrent() ? rectCache.get(key) : undefined;
          if (rect) {
            stats.local++;
          } else {
            brokerCall(id, [hwnd, rectPtr], false);
            const dv = new DataView(memory.buffer);
            rect = [dv.getInt32(rectPtr, true), dv.getInt32(rectPtr + 4, true),
              dv.getInt32(rectPtr + 8, true), dv.getInt32(rectPtr + 12, true)];
            rectCache.set(key, rect);
            return;
          }
          const dv = new DataView(memory.buffer);
          dv.setInt32(rectPtr, rect[0], true);
          dv.setInt32(rectPtr + 4, rect[1], true);
          dv.setInt32(rectPtr + 8, rect[2], true);
          dv.setInt32(rectPtr + 12, rect[3], true);
        };
        return;
      }
      if (name === 'get_key_down_state') {
        host[name] = (vKey) => {
          const key = vKey & 0xFF;
          // With no event open, the main side answers from the live key table
          // (host-window _keyDownState), which the page publishes as a bitmap
          // at every step and every queued input — the same freshness a
          // cooperative step sees. RCT sweeps ~170 keys once each per frame,
          // so a per-GEN cache never hits there; this does.
          if (!inputEventOpen && Atomics.load(v.pub, SLOT.KEYS_VALID) === 1) {
            stats.local++;
            return (Atomics.load(v.pub, SLOT.KEYS + (key >>> 5)) & (1 << (key & 31))) !== 0
              ? 0x8000 : 0;
          }
          if (inputCacheCurrent() && keyCacheValid[key]) { stats.local++; return keyCache[key]; }
          keyCache[key] = brokerCall(id, [vKey], false);
          keyCacheValid[key] = 1;
          return keyCache[key];
        };
        return;
      }

      // Fire-and-forget looked free and is not: a void import that takes a
      // POINTER is read by the main thread after the guest has already run on,
      // and by then the guest may have reused the buffer. `log(ptr, len)` is
      // that shape and is called twice per Win32 API dispatch, so the version
      // of this that skips the round trip for every void import would print
      // whatever happened to be in the buffer later.
      //
      // Nothing in an i32 signature says which arguments are pointers, so the
      // safe default is to block, and only calls known to pass values may skip
      // the round trip. This list is short and deliberate; adding to it
      // requires checking that the import reads no guest memory.
      // dx_trace fires on every Lock, Unlock, Blt and palette write — DX-Ball
      // ~8.2K a second — and a normal page wants three things from it: which
      // surface slots are live, whether a lock is held, and when a frame was
      // finished (host.js's wrapper and lib/host-imports.js). With
      // opts.dxTraceLocal the lock depth and the unlock count move to shared
      // memory (DX_LOCKS, DX_DIRTY, read by broker.dxState()), and only the
      // records the page cannot derive are forwarded: present/Flip, surface
      // allocation and release, and the first sighting of each slot. Lock and
      // Unlock sightings travel as kind 13, which notes the slot and nothing
      // else, so the page's own lock-depth map never sees a half pair.
      // Anything that prints the trace (--trace-dx) leaves this off.
      if (name === 'dx_trace' && opts.dxTraceLocal) {
        const seenSlots = new Set();
        const lockDepth = new Map();
        const firstSighting = slotId => {
          slotId >>>= 0;
          if (seenSlots.has(slotId)) return false;
          seenSlots.add(slotId);
          return true;
        };
        host[name] = (kind, slotId, a, b, c) => {
          kind |= 0;
          slotId >>>= 0;
          if (kind === 1 || kind === 2) {
            const depth = lockDepth.get(slotId) | 0;
            if (kind === 1) {
              lockDepth.set(slotId, depth + 1);
              if (depth === 0) Atomics.add(v.pub, SLOT.DX_LOCKS, 1);
            } else {
              if (depth > 1) lockDepth.set(slotId, depth - 1);
              else if (depth === 1) {
                lockDepth.delete(slotId);
                Atomics.sub(v.pub, SLOT.DX_LOCKS, 1);
              }
              Atomics.add(v.pub, SLOT.DX_DIRTY, 1);
            }
            if (firstSighting(slotId)) postAsync(id, [13, slotId, 0, 0, 0]);
            return;
          }
          if (kind === 22) {
            seenSlots.delete(slotId);
            dxSurfaceMemo.delete((0x200000 + slotId) >>> 0);
          }
          let forward = kind === 5 || kind === 6 || kind === 21 || kind === 22 || kind === 30;
          if (kind === 3 || kind === 5 || kind === 6 || (kind >= 11 && kind <= 14)) {
            if (firstSighting(slotId)) forward = true;
          }
          if (kind === 3 || kind === 6 || kind === 11 || kind === 12 || kind === 14) {
            if (firstSighting(a)) forward = true;
          }
          if (forward) postAsync(id, [kind, slotId, a, b, c]);
        };
        return;
      }
      // Every WAT caller of gdi_surface_upload drops its result: an upload
      // only marks a rect of an already-attached surface dirty, and nothing
      // in the guest can act on the answer. So it never needs to stop the
      // thread, whatever the surface. Blobby's GDI game thread uploads ~735
      // times a second, and each blocking one also emptied rectCache.
      if (name === 'gdi_surface_upload') {
        host[name] = (...args) => { postAsync(id, args); return 1; };
        return;
      }
      if (opts.dxTraceLocal && (name === 'gdi_surface_create' ||
          name === 'gdi_surface_attach')) {
        const isCreate = name === 'gdi_surface_create';
        host[name] = (...args) => {
          const sid = args[0] >>> 0;
          if (sid < 0x200000 || sid >= 0x300000) {
            if (rectCache.size) rectCache.clear();
            return brokerCall(id, args, false);
          }
          const memo = dxSurfaceMemoFor(sid);
          const key = isCreate
            ? args.slice(0, 4).concat(args.slice(5)).join(',')
            : args.join(',');
          if (memo[name] === key) {
            postAsync(id, args);
            return 1;
          }
          const r = brokerCall(id, args, false);
          memo[name] = r === 1 ? key : undefined;
          return r;
        };
        return;
      }
      if (opts.dxTraceLocal && name === 'gdi_surface_delete') {
        host[name] = (...args) => {
          dxSurfaceMemo.delete(args[0] >>> 0);
          if (rectCache.size) rectCache.clear();
          return brokerCall(id, args, false);
        };
        return;
      }
      if (name === 'set_mouse_position') {
        host[name] = (...args) => { mouseSetPending = true; postAsync(id, args); };
        return;
      }
      if (!returnsValue && ASYNC_SAFE.has(name)) {
        host[name] = (...args) => { postAsync(id, args); };
        return;
      }

      host[name] = (...args) => {
        // Block until the main thread answers. Legal in a worker, and it is
        // exactly the semantics the guest expects: the instruction that made
        // this call has not retired yet.
        if (rectCache.size) rectCache.clear();
        return brokerCall(id, args, returnsF64);
      };
    });

    // A forwarded API-name log also carries the call's stack, read here at
    // call time: ESP, the return address and the first eight argument
    // dwords. The page formats --trace-api arguments from these. It used to
    // read ESP from its own instance, which runs no guest code in Threads
    // mode, so every argument printed as 0 (seen on Age of Wonders II), and
    // `log` is batched, so by the time the page sees it the stack has moved.
    const forwardsLogs = opts.forwardGuestLogs === undefined
      ? !!opts.forwardGlLogs : !!opts.forwardGuestLogs;
    if (forwardsLogs && typeof host.log === 'function' && opts.getExports) {
      const forwardLog = host.log;
      host.log = (ptr, len) => {
        let e = null;
        try { e = opts.getExports(); } catch (_) { e = null; }
        if (!e || !e.get_esp || !e.guest_read32) return forwardLog(ptr, len);
        const esp = e.get_esp() >>> 0;
        const words = [esp, e.guest_read32(esp) >>> 0];
        for (let i = 0; i < 8; i++) words.push(e.guest_read32((esp + 4 + i * 4) >>> 0) >>> 0);
        return forwardLog(ptr, len, ...words);
      };
    }

    return {
      imports: { host: Object.assign({ memory }, host) },
      names, stats, advanceGuestTime, flushAsync,
    };
  }

  // ---- main side ----------------------------------------------------------

  // Services requests from the worker against the real host import table.
  function createMainBroker(memory, hostImports, sigs, opts) {
    opts = opts || {};
    const pub = views(memory, 0).pub;
    // One view per slot, made on demand. Which slot a request belongs to comes
    // from the message, so N threads share one broker and one import table.
    const blocks = new Map();
    const block = slot => {
      const s = (slot || 0) | 0;
      if (!blocks.has(s)) blocks.set(s, views(memory, s));
      return blocks.get(s);
    };
    const names = Object.keys(sigs).sort();
    let served = 0, missing = new Set();

    // `hostImports` is either one table every slot shares — the browser, where
    // createHostImports builds exactly one — or a function slot => table, which
    // is what the CLI needs: test/run.js builds a per-thread table so each
    // thread's log lines carry its own tid. Resolved once per slot and cached,
    // because building one is not free.
    const tables = new Map();
    const tableFor = (slot) => {
      if (typeof hostImports !== 'function') return hostImports;
      const s = (slot || 0) | 0;
      if (!tables.has(s)) tables.set(s, hostImports(s) || {});
      return tables.get(s);
    };

    // Per-slot call histogram. A blocking import in worker mode is a postMessage
    // plus an Atomics.wait — the guest thread stops until the main thread takes
    // a turn — so "which import is this thread waiting on, and how often" is the
    // first question about worker throughput, and counting it here is the only
    // place that can answer it per thread. --host-census wraps the main
    // thread's table and cannot see a worker's calls at all.
    const byName = opts.countCalls ? new Map() : null;
    const INPUT_EVENT_READS = new Set(['check_input_lparam', 'check_input_wparam', 'check_input_hwnd']);
    const inputEvents = new Map();   // slot -> the host's saved input event
    const pending = new Set();
    // A render request can finish on another Worker. Keep only its guest
    // caller parked; never block the browser owner while awaiting completion.
    const respond = (slot, name, result, threw) => {
      const v = block(slot);
      const finish = (value, failed) => {
        if (typeof value === 'number' && !Number.isInteger(value)) v.f64[0] = value;
        v.i32[SLOT.RESULT] = value | 0;
        served++;
        pending.delete(slot);
        Atomics.store(v.i32, SLOT.STATUS, failed ? STATUS_ERR : STATUS_RESP);
        Atomics.notify(v.i32, SLOT.STATUS);
      };
      if (result && typeof result.then === 'function') {
        pending.add(slot);
        Promise.resolve(result).then(finish, error => {
          try { if (opts.onError) opts.onError(name, error); }
          finally { finish(0, true); }
        });
      } else finish(result, threw);
    };
    const invoke = (id, args, slot, batched) => {
      const name = names[id];
      if (byName) {
        // Batched calls are keyed apart: they cost the guest no round trip.
        const key = `${slot | 0}:${name}${batched ? '~async' : ''}`;
        byName.set(key, (byName.get(key) || 0) + 1);
      }
      const table = tableFor(slot);
      const fn = table[name];
      if (typeof fn !== 'function') { missing.add(name); return 0; }
      // The host keeps ONE current input event for every thread, and a
      // thread asks for its lParam/wParam/hwnd in separate calls after the
      // check_input that took it. Another slot's poll can replace or clear
      // the event in between, so remember each slot's own and swap it in
      // for those reads (host.js `inputEventScope`).
      const scope = table.inputEventScope;
      if (scope) {
        const s = (slot || 0) | 0;
        if (name === 'check_input') {
          const r = fn(...args);
          if (r) inputEvents.set(s, scope.save());
          else inputEvents.delete(s);
          return r;
        }
        if (INPUT_EVENT_READS.has(name) && inputEvents.has(s)) {
          const outer = scope.save();
          scope.restore(inputEvents.get(s));
          try { return fn(...args); } finally { scope.restore(outer); }
        }
      }
      return fn(...args);
    };

    return {
      names,
      // A blocking request: read it out of the control block, run the real
      // import, publish the answer, wake the worker.
      serveRpc(slot) {
        slot = (slot || 0) | 0;
        const v = block(slot);
        if (pending.has(slot) || Atomics.load(v.i32, SLOT.STATUS) !== STATUS_REQ) return false;
        const id = v.i32[SLOT.FN];
        const argc = v.i32[SLOT.ARGC];
        const args = new Array(argc);
        for (let i = 0; i < argc; i++) args[i] = v.i32[SLOT.ARGS + i];
        let result = 0, threw = false;
        try { result = invoke(id, args, slot); } catch (err) {
          threw = true;
          if (opts.onError) opts.onError(names[id], err);
        }
        respond(slot, names[id], result, threw);
        return true;
      },
      // Completes createWorkerImports().advanceGuestTime(). This is separate
      // from the generated host-import table: it is loader orchestration, not a
      // Win32 API, and therefore needs no WAT import or signature-table entry.
      serveClockAdvance(slot, tickMs) {
        const v = block(slot);
        if (Atomics.load(v.i32, SLOT.STATUS) !== STATUS_REQ) return false;
        const tick = Number.isFinite(tickMs) ? (Math.floor(tickMs) | 0)
          : Atomics.load(pub, SLOT.TICK);
        Atomics.store(pub, SLOT.TICK, tick);
        v.i32[SLOT.RESULT] = tick;
        Atomics.store(v.i32, SLOT.STATUS, STATUS_RESP);
        Atomics.notify(v.i32, SLOT.STATUS);
        return true;
      },
      // One synchronous OpenGL command-stream submission. The command buffer
      // is shared with the worker and remains immutable until this response
      // wakes it, which also makes borrowed texture pixels safe without a copy.
      serveGlBatch(msg) {
        const slot = (msg.slot || 0) | 0;
        const v = block(slot);
        if (pending.has(slot) || Atomics.load(v.i32, SLOT.STATUS) !== STATUS_REQ) return false;
        if (byName) {
          const key = `${slot}:gpu_gl_batch`;
          byName.set(key, (byName.get(key) || 0) + 1);
        }
        let result = 0, threw = false;
        try {
          const fn = tableFor(slot).gpu_gl_batch;
          if (msg.memoryOffset === undefined) {
            throw new TypeError('OpenGL worker batch requires a shared-memory offset');
          }
          const batch = {
            memoryOffset: msg.memoryOffset >>> 0,
            bytes: msg.bytes >>> 0,
            softwareFront: msg.softwareFront >>> 0,
          };
          if (msg.softwareConfig) batch.softwareConfig = msg.softwareConfig;
          if (typeof fn === 'function') result = fn(batch, slot);
          else missing.add('gpu_gl_batch');
        } catch (err) {
          threw = true;
          if (opts.onError) opts.onError('gpu_gl_batch', err);
        }
        respond(slot, 'gpu_gl_batch', result, threw);
        return true;
      },
      // A fire-and-forget call, arguments carried in the message itself.
      serveCall(msg) {
        try { invoke(msg.id, msg.args || [], msg.slot, true); } catch (err) {
          if (opts.onError) opts.onError(names[msg.id], err);
        }
        served++;
      },
      // A batch of them, flattened as id, args, id, args... (flushAsync).
      serveCalls(msg) {
        const list = msg.list || [];
        for (let i = 0; i + 1 < list.length; i += 2) {
          let result;
          try { result = invoke(list[i], list[i + 1] || [], msg.slot, true); } catch (err) {
            if (opts.onError) opts.onError(names[list[i]], err);
          }
          // A gdi_surface_* only travels here when the Worker predicted it
          // succeeds (dxSurfaceMemo). If it did not, have the Worker ask again.
          if (result === 0 && names[list[i]].startsWith('gdi_surface_')) {
            Atomics.add(pub, SLOT.DX_SURF_EPOCH, 1);
          }
          served++;
        }
      },
      // Publish the state the worker reads locally. Cheap enough to call on
      // every slice boundary and on every input event.
      publish(state) {
        if (state.tickMs !== undefined) Atomics.store(pub, SLOT.TICK, state.tickMs | 0);
        if (state.mouseX !== undefined) Atomics.store(pub, SLOT.MOUSE_X, state.mouseX | 0);
        if (state.mouseY !== undefined) Atomics.store(pub, SLOT.MOUSE_Y, state.mouseY | 0);
        if (state.mouseX !== undefined && state.mouseY !== undefined) {
          Atomics.store(pub, SLOT.MOUSE_VALID, 1);
        }
        if (state.inputPending !== undefined) Atomics.store(pub, SLOT.INPUT_PENDING, state.inputPending | 0);
        if (state.inputWake) Atomics.store(pub, SLOT.INPUT_WAKE, 1);
        if (state.keys && state.keys.length >= 8) {
          for (let i = 0; i < 8; i++) Atomics.store(pub, SLOT.KEYS + i, state.keys[i] | 0);
          Atomics.store(pub, SLOT.KEYS_VALID, 1);
        }
        Atomics.add(pub, SLOT.GEN, 1);
      },
      // The shared DirectDraw state guest threads keep under
      // opts.dxTraceLocal: `dirty` counts Unlocks, `locks` is how many
      // surfaces are held locked right now.
      dxState() {
        return {
          dirty: Atomics.load(pub, SLOT.DX_DIRTY) | 0,
          locks: Atomics.load(pub, SLOT.DX_LOCKS) | 0,
        };
      },
      stats() {
        return {
          served,
          missing: [...missing],
          // [{ slot, name, count }], busiest first. Empty unless countCalls.
          calls: byName
            ? [...byName.entries()]
              .map(([key, count]) => {
                const cut = key.indexOf(':');
                return { slot: +key.slice(0, cut), name: key.slice(cut + 1), count };
              })
              .sort((a, b) => b.count - a.count)
            : [],
        };
      },
    };
  }

  // The host step epoch (SLOT.STEP_EPOCH). A guest thread's Worker that yields
  // for a short Sleep keeps its slice and waits out the Sleep locally until the
  // page ends the step; without this a Sleep(5) mixer thread wakes at most once
  // per host step, however far apart those are. See guest-worker.js.
  function readStepEpoch(memory) {
    return Atomics.load(views(memory, 0).pub, SLOT.STEP_EPOCH) | 0;
  }
  function endStepEpoch(memory) {
    const pub = views(memory, 0).pub;
    Atomics.add(pub, SLOT.STEP_EPOCH, 1);
    Atomics.notify(pub, SLOT.STEP_EPOCH);
  }
  // Wait until the epoch moves off `epoch` or `ms` passes. True = the step ended.
  function waitStepEpoch(memory, epoch, ms) {
    const pub = views(memory, 0).pub;
    if ((Atomics.load(pub, SLOT.STEP_EPOCH) | 0) !== (epoch | 0)) return true;
    if (ms > 0) Atomics.wait(pub, SLOT.STEP_EPOCH, epoch | 0, ms);
    return (Atomics.load(pub, SLOT.STEP_EPOCH) | 0) !== (epoch | 0);
  }

  // A Worker parked inside its own slice (a local message wait) cannot see a
  // postMessage until it returns. The page bumps the target slot's MAIL word
  // with every request it posts there, so the wait can end early and answer.
  function bumpMail(memory, slot) {
    Atomics.add(views(memory, slot).i32, SLOT.MAIL, 1);
  }
  function readMail(memory, slot) {
    return Atomics.load(views(memory, slot).i32, SLOT.MAIL) | 0;
  }

  // A guest Worker's view of the worklet voices the page published. `find(id)`
  // returns the descriptor index of a voice the worklet is rendering right now,
  // or -1; `cursor(i)`/`ptr(i)`/`len(i)` read that descriptor. The page writes a
  // map entry's LIVE word last on publish and first on retire, so a reader that
  // sees LIVE and the id both before and after its reads saw a routed voice.
  function audioVoiceViews(memory) {
    const buffer = memory.buffer;
    if (!(buffer instanceof SharedArrayBuffer)) return null;
    const desc = new Int32Array(buffer, AUDIO_BASE, AUDIO_VOICES * AUDIO_DESC_INTS);
    const map = new Int32Array(buffer, AUDIO_MAP_BASE, AUDIO_VOICES * AUDIO_MAP_INTS);
    const live = (i, id) => Atomics.load(map, i * AUDIO_MAP_INTS + AUDIO_MAP.LIVE) === 1
      && (Atomics.load(map, i * AUDIO_MAP_INTS + AUDIO_MAP.ID) | 0) === (id | 0);
    return {
      find(id) {
        for (let i = 0; i < AUDIO_VOICES; i++) if (live(i, id)) return i;
        return -1;
      },
      live,
      cursor: i => Atomics.load(desc, i * AUDIO_DESC_INTS + AUDIO_DESC.CURSOR) >>> 0,
      ptr: i => Atomics.load(desc, i * AUDIO_DESC_INTS + AUDIO_DESC.PTR) >>> 0,
      len: i => Atomics.load(desc, i * AUDIO_DESC_INTS + AUDIO_DESC.LEN) >>> 0,
    };
  }

  const api = { RPC_BASE, RPC_STRIDE, RPC_MAX_SLOTS, SLOT, CTRL_INTS,
                AUDIO_BASE, AUDIO_BYTES, AUDIO_VOICES, AUDIO_DESC_INTS,
                AUDIO_MAP_BASE, AUDIO_MAP_INTS, AUDIO_MAP, audioVoiceViews,
                STATUS_IDLE, STATUS_REQ, STATUS_RESP, STATUS_ERR, readInputPending,
                readStepEpoch, endStepEpoch, waitStepEpoch, bumpMail, readMail,
                SYNC_TABLE, SYNC_OBJECTS, SYNC_ENTRY_INTS,
                blockBase, views, waitSharedSyncObjects,
                createWorkerImports, createMainBroker };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GuestRpc = api;
})(typeof self !== 'undefined' ? self : this);
