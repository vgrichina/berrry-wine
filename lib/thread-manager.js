// ThreadManager: multi-instance threading for wine-assembly
// Each WASM instance = one thread, sharing the same linear memory.

// 4 was 'help_load' and is not in this map because no WAT or JS path ever sets
// it — the help engine fetches through host imports instead of parking the
// guest. Leaving it listed made worker mode look like it had two async yields
// left to port when it had one.
const YIELD_NAMES = { 1: 'wait', 2: 'exit', 3: 'com_load_dll', 5: 'load_library', 6: 'modal_dialog', 7: 'message_wait', 8: 'net_wait', 9: 'critical_section', 10: 'send_message', 11: 'self_suspend', 12: 'io_wait', 13: 'vblank_wait', 14: 'clock_spin', 15: 'peek_spin' };
// Win32 has no small ceiling on kernel synchronization objects and real
// programs rely on that: Warcraft III's startup pre-creates 2048 events in
// one loop before it does anything else. A table that runs out returns NULL
// from CreateEvent/CreateMutex, which callers spin on rather than report.
// Must stay in step with $SYNC_TABLE's declared size and lib/guest-rpc.js.
const MAX_SYNC_OBJECTS = 4096;
// How far the global deadline clock (`deadlineClock`) may trail real time.
const DEADLINE_CLOCK_MAX_LAG_MS = 100;
// Upper bound on how long a cooperative thread's clock spin park sleeps it.
// The park names the next millisecond, so this only guards a bogus deadline.
const CLOCK_PARK_MAX_MS = 50;
// Free-run worker threads re-dispatch themselves only while host steps keep
// coming; a paused or finished run stops handing out slices after this long.
const FREE_RUN_STEP_STALE_MS = 250;
const _workerGlobals = typeof require !== 'undefined'
  ? require('./worker-imports') : globalThis.workerImports;
const _threadMemUtils = typeof require !== 'undefined'
  ? require('./mem-utils') : globalThis.memUtils;
const {
  createInheritedWasmGlobals: _createInheritedWasmGlobals,
  recordInheritedWasmGlobal: _recordInheritedWasmGlobal,
  mergeInheritedWasmGlobals: _mergeInheritedWasmGlobals,
  captureInheritedWasmGlobals: _captureInheritedWasmGlobals,
  applyInheritedWasmGlobals: _applyInheritedWasmGlobals,
} = _workerGlobals;

class ThreadManager {
  constructor(wasmModule, memory, mainInstance, makeImports, opts) {
    this.module = wasmModule;
    this.memory = memory;
    this.mainInstance = mainInstance;
    this.makeImports = makeImports; // (threadId) => imports object

    this.threads = new Map(); // handle → { instance, state, startAddr, param, stackSize }
    this._nextHandle = 0xE1000;
    // DuplicateHandle(GetCurrentThread()) must turn the contextual -2 pseudo
    // handle into a durable process handle. Aliases point at the same thread
    // object so suspend counts and exit state stay shared across every handle.
    this._threadHandleAliases = new Map();
    this._mainThreadState = {
      tid: 0, win32Tid: 1, state: 'active', suspendCount: 0,
      priority: 0, locale: 0x0409,
      comApartment: 0, comInitCount: 0, isMain: true,
    };
    this._pendingThreads = []; // threads awaiting spawn
    this.lastWorkerSliceBlocks = 0;
    // Set when a worker parks on net_wait; the caller clears it after
    // yielding to the host event loop so inbound frames can land.
    this.netWaitPending = false;
    this._spawnedCount = 0; // total threads ever spawned
    // Worker slots 1..N, one decoded-cache partition each, alongside the main
    // thread's slot 0. src/00-regions.wat carves $THREAD_CACHE_BASE into ten,
    // so fifteen workers: at seven, Warcraft III's burst of thread creations
    // hit the wall and _beginthreadex returned 0 to a caller that treated it
    // as fatal (it keeps five threads alive and then asks for five more at
    // once). Raising this past the number of partitions $init_thread carves
    // silently overlaps two threads' caches, so the two numbers move together.
    this._maxWorkerThreads = 15;
    this._log = (typeof console !== 'undefined') ? console.log.bind(console) : () => {};
    this._quietTM = (typeof process !== 'undefined' && process.env && process.env.QUIET_TM) ? true : false;
    opts = opts || {};
    this._instantiateCooperative = typeof opts.instantiateCooperative === 'function'
      ? opts.instantiateCooperative
      : (module, imports) => new WebAssembly.Instance(module, imports);
    // Where this app's hwnd range starts. Read through a function rather than
    // captured: the browser shell assigns _hwndBase after init(), which is
    // when this manager is constructed, so a value snapshotted here would be
    // the default for every app but the first.
    this._appHwndBase = typeof opts.hwndBase === 'function'
      ? () => (opts.hwndBase() | 0) || 0x10001
      : () => 0x10001;
    this._traceThread = !!opts.traceThread;
    this._traceYield = !!opts.traceYield;
    this._onThreadEvent = typeof opts.onThreadEvent === 'function' ? opts.onThreadEvent : null;
    this._recordThreadEvents = !!(opts.recordThreadEvents || this._traceThread || this._onThreadEvent);
    this._threadEventSequence = 0;
    this._threadEvents = [];
    this._onThreadExit = typeof opts.onThreadExit === 'function' ? opts.onThreadExit : null;
    this._breakThreadFilter = (opts.breakThreadFilter == null) ? null : opts.breakThreadFilter|0;
    this._traceCallstack = !!opts.traceCallstack;
    this._traceCallstackDepth = opts.traceCallstackDepth || 16;
    this._traceEipRange = opts.traceEipRange || null;
    // --fault-null mode. Mutable globals are per-instance, so a worker sees
    // the setting only if we hand it over at spawn.
    this._faultUnmapped = opts.faultUnmapped || 0;
    // --count= addresses. Hit counters live in per-instance globals, so a
    // worker thread counts nothing unless its own instance is armed too.
    // Held by reference, not sliced: a `module+0xVA` spec is NaN until its DLL
    // loads and the caller resolves the list in place. A snapshot taken here
    // froze those slots at NaN, and (NaN >>> 0) is 0 -- so every worker spawn
    // re-armed the shared slot with address 0 and threw away the main
    // instance's arming.
    this._countAddrs = Array.isArray(opts.countAddrs) ? opts.countAddrs : [];
    // Feature/debug switches are process configuration stored in per-instance
    // WASM globals. Keep the explicit half here; getter-backed state (MMX,
    // breakpoint and watchpoint) is captured from main at each spawn so later
    // changes are inherited too.
    this._inheritedWasmGlobals = _createInheritedWasmGlobals();
    _mergeInheritedWasmGlobals(this._inheritedWasmGlobals, opts.inheritedWasmGlobals);
    if (opts.csStealAfter) {
      _recordInheritedWasmGlobal(this._inheritedWasmGlobals,
        'set_cs_steal_after', [opts.csStealAfter | 0]);
    }
    if (this._faultUnmapped) {
      _recordInheritedWasmGlobal(this._inheritedWasmGlobals,
        'set_fault_unmapped', [this._faultUnmapped | 0]);
    }
    if (this._traceCallstack) {
      _recordInheritedWasmGlobal(this._inheritedWasmGlobals,
        'set_callstack_enabled', [1]);
    }
    if (this._traceEipRange) {
      _recordInheritedWasmGlobal(this._inheritedWasmGlobals, 'set_trace_eip_range',
        [1, this._traceEipRange.lo >>> 0, this._traceEipRange.hi >>> 0]);
    }
    this._hasMessage = typeof opts.hasMessage === 'function' ? opts.hasMessage : null;
    // The process VFS, for servicing a spawned thread's io_wait (yield 12): a
    // provider-backed ReadFile parks until someone runs the async chunk fill.
    // A function, not a snapshot — the browser shell attaches the VFS to the
    // context after this manager is constructed.
    this._getVfs = typeof opts.getVfs === 'function' ? opts.getVfs : () => null;
    // How a spawned thread's parked lazy read gets its bytes. The page passes
    // one that shows the in-game wait window and offers Retry on a failed
    // fetch (host.js _fillParkedRead); the default is the bare VFS fill.
    this._fillIoReadHook = typeof opts.fillIoRead === 'function' ? opts.fillIoRead : null;
    this._onRenderWait = typeof opts.onRenderWait === 'function' ? opts.onRenderWait : null;
    this._renderSendTargets = new Set();
    this._renderSendContinuations = new Map();
    // Sender exports -> scheduler rounds spent waiting for its receiver to
    // reach a message call (see _sendTargetAtMessagePoint).
    this._sendParkRounds = new WeakMap();
    this._now = typeof opts.now === 'function' ? opts.now : Date.now;
    // Guest deadlines may advance by frozen steps; execution budgets must
    // still measure real elapsed time. Existing callers keep their clock.
    this._waitNow = typeof opts.waitNow === 'function' ? opts.waitNow : () => this._now();
    // Where a main-thread Sleep(n) starts counting. The headless clock's
    // batch base can sit up to one batch behind the tick the guest last read,
    // so a deadline taken from it lands a batch short or long; run.js passes
    // the last tick handed out instead. Default: the wait clock.
    this._sleepNow = typeof opts.sleepNow === 'function' ? opts.sleepNow : () => this._waitNow();
    // Global deadline clock (`?sched-arm=g`). The host runs guest threads in
    // bursts tens of milliseconds apart, so a Sleep(5) mixer's overdue wakes
    // run back to back and all see one instant. With this on, every clock
    // read -- any thread, main included -- returns one shared time that
    // stands at the earliest overdue timed-sleep deadline until that thread
    // has run: wakes see the time they asked for, in deadline order, and the
    // clock never goes backwards for anyone. Trails the real clock by at
    // most DEADLINE_CLOCK_MAX_LAG_MS; past that it jumps, as before.
    this.deadlineClock = false;
    // Cooperative clock spin parks sleep the thread to the park's deadline
    // (see postYield 14 in runSlice). `clockParkSleep: false` is the A/B arm
    // that restores "give up one turn, then run again".
    this._clockParkSleep = opts.clockParkSleep !== false;
    this._realWaitNow = this._waitNow;
    this._dcNow = 0;
    this._waitNow = () => (this.deadlineClock ? this.deadlineNow(this._realWaitNow()) : this._realWaitNow());
    this._profileThreadRun = typeof opts.profileThreadRun === 'function' ? opts.profileThreadRun : null;
    this._resolveThreadSendExternalYield = typeof opts.resolveThreadSendExternalYield === 'function'
      ? opts.resolveThreadSendExternalYield : null;
    this._audioThreadHotUntil = new Map();
    this._audioPriorityNextHotFirst = true;
    this._loadedDlls = [];
    this._callDllMain = null;

    // Which scheduler is actually in charge, and it is a readout rather than a
    // promise: a UI switch that says "threads on" while this reads 'cooperative'
    // would be reporting a lie.
    //
    //   'cooperative'  guest threads are separate WASM instances round-robined
    //                  on this JS thread. Permanent — it is the CLI default and
    //                  the fallback wherever isolation is unavailable (§3.6).
    //   'worker'       one Worker per guest thread, all running at once. Needs
    //                  a GuestThreadHost, which needs cross-origin isolation.
    this.workerBackend = opts.workerBackend || null;
    this.serialSlices = !!opts.serialSlices;   // debug: never run two guest threads at once
    this.csStealAfter = opts.csStealAfter | 0;  // 0 = keep the WAT's own default
    this.backend = this.workerBackend ? 'worker' : 'cooperative';
    // RPC slot → thread handle. ExitThread takes no arguments: the cooperative
    // backend knows who called it because it called run() on that instance a
    // moment ago, and the worker backend has to be told, because the caller is
    // not on this thread at all.
    this._slotToHandle = new Map();
    if (this.workerBackend) {
      this.workerBackend.threadManager = this;
      this.workerBackend.onRpcSlot = slot => {
        this._runningThreadHandle = this._slotToHandle.get(slot | 0) || 0;
      };
      this.workerBackend.onRpcSlotEnd = () => { this._runningThreadHandle = 0; };
    }
    this.threadsRequested = !!opts.threadsRequested;
    // addr => "0x… (module+0x…)". A trapped worker reports a raw EIP, and in a
    // DLL that number depends on load order, so it differs run to run and lines
    // up with no disassembly. Falls back to plain hex when the host has no map.
    this._describeAddr = opts.describeAddr || (addr => `0x${(addr >>> 0).toString(16)}`);
    if (this.threadsRequested && !this.workerBackend) {
      this._log('[ThreadManager] real threads requested but no worker backend was supplied; '
        + 'running the cooperative scheduler.');
    }
    // Last metadata snapshot read from the guest's main Worker. Some fields
    // advance at runtime, so _workerPeMeta refreshes it for every new thread.
    this._peMeta = null;

    // Synchronization table (SharedArrayBuffer backed)
    this.syncTableAddr = mainInstance.exports.get_sync_table();
    this.syncView = new Int32Array(
      memory.buffer, this.syncTableAddr, MAX_SYNC_OBJECTS * 4); // 4 ints per object
    // Names and reference counts are process metadata rather than guest-visible
    // synchronization state. Every cooperative WASM instance shares this one
    // manager, matching Win32's process-local named-object namespace.
    this._syncRefs = new Uint32Array(MAX_SYNC_OBJECTS);
    this._syncNames = new Array(MAX_SYNC_OBJECTS).fill(null);
    // Recycled slots need a new identity. Otherwise a delayed SetEvent or
    // CloseHandle for the old object mutates the replacement in that slot
    // (an ABA collision). Preserve the legacy first-generation handles, then
    // issue process-unique positive values from a separate handle namespace.
    this._syncCurrentHandles = new Uint32Array(MAX_SYNC_OBJECTS);
    this._syncEverUsed = new Uint8Array(MAX_SYNC_OBJECTS);
    this._syncHandleToIdx = new Map();
    this._nextSyncHandle = 0x0E000000;
    // Events, mutexes and semaphores share one case-sensitive kernel-object
    // namespace. The entry retains the type so a cross-type Create can return
    // ERROR_INVALID_HANDLE instead of quietly allocating a second object.
    this._namedSyncObjects = new Map();
  }

  // Browser launch configuration can arrive after construction (for example
  // an app manifest's copySuperops flag). Record it once and every subsequently
  // created cooperative or real Worker instance inherits it through the same
  // table. Returns false for a setter that is intentionally not inheritable.
  recordInheritedWasmGlobal(setter, ...args) {
    return _recordInheritedWasmGlobal(this._inheritedWasmGlobals, setter, args);
  }

  // The same, for state that changes while threads are already running: record
  // it for future threads AND push it into every live one. A mutable global is
  // per instance, so process-wide state set after a spawn -- the virtual LAN
  // room address, joined when the guest first asks for a room -- otherwise
  // reaches only the thread that happened to be running at the time.
  //
  // Worker-backed threads take it over their own link and the call is not
  // awaited: it lands before that worker's next slice, which is the ordering
  // that matters, and the caller is a host import that cannot await anything.
  setWasmGlobalAll(setter, ...args) {
    this.recordInheritedWasmGlobal(setter, ...args);
    for (const [, thread] of this.threads) {
      if (!thread || thread.state === 'exited') continue;
      const link = thread.link;
      if (link && typeof link.callExport === 'function') {
        Promise.resolve(link.callExport(setter, ...args)).catch(() => {});
        continue;
      }
      const fn = thread.instance && thread.instance.exports
        && thread.instance.exports[setter];
      if (typeof fn === 'function') fn(...args);
    }
  }

  // The read side of setWasmGlobalAll: call a getter on every guest thread's
  // instance and return [{ handle, value }]. A per-instance counter armed
  // process-wide counts on each thread separately -- NFS II enters its game
  // step on a worker thread, so main's own count stays at 0. An exited thread
  // keeps reporting the last value read from it, so a sum never goes backwards.
  async readWasmExportAll(getter, ...args) {
    const key = getter + '(' + args.join(',') + ')';
    const out = [];
    for (const [handle, thread] of this.threads) {
      if (!thread) continue;
      // Main is the caller's to read; never count it twice.
      const backend = this.workerBackend;
      if (backend && thread.link && (thread.link === backend.link || thread.link === backend._localLink)) continue;
      const last = thread._lastExportReads || (thread._lastExportReads = new Map());
      if (thread.state !== 'exited') {
        try {
          let value;
          if (thread.link && typeof thread.link.callExport === 'function') {
            value = await thread.link.callExport(getter, ...args);
          } else {
            const fn = thread.instance && thread.instance.exports
              && thread.instance.exports[getter];
            if (typeof fn === 'function') value = fn(...args);
          }
          if (typeof value === 'number') last.set(key, value >>> 0);
        } catch (_) {}
      }
      if (last.has(key)) out.push({ handle, value: last.get(key) });
    }
    return out;
  }

  _workerWasmGlobals(mainExports) {
    const state = _captureInheritedWasmGlobals(mainExports);
    _mergeInheritedWasmGlobals(state, this._inheritedWasmGlobals);
    // Count addresses may resolve from module+offset specs after construction,
    // so snapshot the live array for each spawn rather than recording it once.
    for (let i = 0; i < this._countAddrs.length; i++) {
      if (!Number.isFinite(this._countAddrs[i])) continue;
      _recordInheritedWasmGlobal(state, 'set_count', [i, this._countAddrs[i] >>> 0]);
    }
    return state;
  }

  // Windows calls every loaded DLL's entry point with DLL_THREAD_ATTACH before
  // the new thread procedure starts. Stock Win98 OLE32 relies on that loader
  // notification to establish per-thread COM state used by Explorer's tray.
  setLoadedDlls(results, callDllMain) {
    this._loadedDlls = Array.isArray(results)
      ? Array.from(new Map(results.filter(item => item && item.dllMain)
        .map(item => [item.loadAddr >>> 0, Object.assign({}, item)])).values())
      : [];
    this._callDllMain = typeof callDllMain === 'function' ? callDllMain : null;
  }

  _dllWantsThreadNotifications(exports, dll) {
    const query = exports && exports.dll_thread_notifications_enabled;
    // Older/external WASM modules have no query and retain the historical
    // behavior: notify every loaded DLL rather than silently dropping calls.
    return typeof query !== 'function' || !!query(dll.loadAddr | 0);
  }

  _notifyThreadDetach(thread) {
    if (!thread || thread._dllDetachNotified || !thread.instance || !this._callDllMain) return;
    thread._dllDetachNotified = true;
    const exports = thread.instance.exports;
    // The loader unwinds thread teardown in reverse load order. Run this only
    // after guest execution returns to the scheduler: ExitThread reaches us
    // through a synchronous host import, where recursively running the same
    // WASM instance would be invalid. TerminateThread bypasses this helper,
    // matching Windows' no-cleanup contract for forced death.
    for (let i = this._loadedDlls.length - 1; i >= 0; i--) {
      const dll = this._loadedDlls[i];
      if (!this._dllWantsThreadNotifications(exports, dll)) continue;
      this._callDllMain(exports, dll.loadAddr, dll.dllMain,
        this._quietTM ? null : this._log, { reason: 3, lpReserved: 0 });
    }
  }

  _emitThreadEvent(type, details) {
    const event = Object.assign({
      sequence: ++this._threadEventSequence,
      type: String(type || ''),
    }, details || {});
    if (this._recordThreadEvents) this._threadEvents.push(event);
    if (this._traceThread) this._log(`[thread-event] ${JSON.stringify(event)}`);
    // A thread that just became runnable needs a host step to get its first
    // slice; a host parked on freeRunParkBound would otherwise sit it out.
    if (this.onRunnable && (type === 'create' || type === 'spawn' || type === 'resume')) {
      try { this.onRunnable(); } catch (_) {}
    }
    if (this._onThreadEvent) {
      try {
        this._onThreadEvent(Object.assign({}, event));
      } catch (err) {
        this._log(`[ThreadManager] onThreadEvent failed: ${err && err.message ? err.message : err}`);
      }
    }
    return event;
  }

  getThreadEvents() {
    return this._threadEvents.map(event => Object.assign({}, event));
  }

  markAudioThread(tid, hotMs) {
    tid = tid | 0;
    if (tid <= 0) return;
    const ms = Math.max(250, (hotMs | 0) || 1000);
    this._audioThreadHotUntil.set(tid, this._now() + ms);
  }

  _threadEntries(options) {
    const entries = Array.from(this.threads.entries());
    const preferTarget = ordered => {
      const preferred = options && (options.preferredThreadHandle >>> 0);
      if (!preferred) return ordered;
      const index = ordered.findIndex(([handle]) => (handle >>> 0) === preferred);
      if (index > 0) ordered.unshift(ordered.splice(index, 1)[0]);
      return ordered;
    };
    const byPriority = (a, b) => ((b[1] && b[1].priority) | 0) -
      ((a[1] && a[1].priority) | 0);
    if (!options || !options.prioritizeAudioThreads || !this._audioThreadHotUntil.size) {
      return preferTarget(entries.sort(byPriority));
    }
    const now = this._now();
    for (const [tid, until] of Array.from(this._audioThreadHotUntil.entries())) {
      if (until <= now) this._audioThreadHotUntil.delete(tid);
    }
    if (!this._audioThreadHotUntil.size) return preferTarget(entries.sort(byPriority));
    return preferTarget(entries.sort((a, b) => {
      const priorityOrder = byPriority(a, b);
      if (priorityOrder) return priorityOrder;
      const aHot = this._audioThreadHotUntil.has((a[1] && a[1].tid) | 0) ? 1 : 0;
      const bHot = this._audioThreadHotUntil.has((b[1] && b[1].tid) | 0) ? 1 : 0;
      return bHot - aHot;
    }));
  }

  _hasHotAudioThreads() {
    if (!this._audioThreadHotUntil.size) return false;
    const now = this._now();
    for (const [tid, until] of Array.from(this._audioThreadHotUntil.entries())) {
      if (until <= now) this._audioThreadHotUntil.delete(tid);
    }
    return this._audioThreadHotUntil.size > 0;
  }

  _hasPendingMessage(exports) {
    if (exports && exports.has_pending_message) {
      try {
        if (exports.has_pending_message() | 0) return true;
      } catch (_) {}
    }
    if (this._hasMessage) {
      try {
        if (this._hasMessage()) return true;
      } catch (_) {}
    }
    return false;
  }

  _readWaitReturnAddress(exports) {
    let retAddr = exports.guest_read32(exports.get_esp()) >>> 0;
    const codeStart = exports.get_code_start ? (exports.get_code_start() >>> 0) : 0;
    const codeEnd = exports.get_code_end ? (exports.get_code_end() >>> 0) : 0;
    if (codeStart && codeEnd && (retAddr < codeStart || retAddr >= codeEnd) && exports.get_dbg_prev_eip) {
      const prev = exports.get_dbg_prev_eip() >>> 0;
      const imageBase = exports.get_image_base ? (exports.get_image_base() >>> 0) : 0;
      if (prev >= codeStart && prev < codeEnd && imageBase) {
        const mem8 = new Uint8Array(this.memory.buffer);
        const start = _threadMemUtils.guestToWasm(
          prev, exports, this.memory, imageBase);
        for (let off = 0; off < 16 && start + off + 5 < mem8.length; off++) {
          if (mem8[start + off] === 0xFF && mem8[start + off + 1] === 0x15) {
            retAddr = (prev + off + 6) >>> 0;
            break;
          }
          if (mem8[start + off] === 0xE8) {
            retAddr = (prev + off + 5) >>> 0;
            break;
          }
        }
      }
    }
    return retAddr;
  }

  _completeWait(exports, result, waitStackBytes) {
    const retAddr = this._readWaitReturnAddress(exports);
    exports.clear_yield();
    exports.set_eax(result);
    exports.set_esp(exports.get_esp() + waitStackBytes);
    exports.set_eip(retAddr);
    return retAddr;
  }

  _allocateSyncHandle(idx) {
    let handle;
    if (!this._syncEverUsed[idx]) {
      handle = (0xE0000 + idx) >>> 0;
      this._syncEverUsed[idx] = 1;
    } else {
      do {
        handle = this._nextSyncHandle++ >>> 0;
        if (this._nextSyncHandle >= 0x7F000000) this._nextSyncHandle = 0x0E000000;
      } while (this._syncHandleToIdx.has(handle) || this.threads.has(handle) ||
               this._threadHandleAliases.has(handle));
    }
    this._syncCurrentHandles[idx] = handle;
    this._syncHandleToIdx.set(handle, idx);
    return handle;
  }

  // Get an index only while this exact issued handle still names the slot.
  _getSyncIdx(handle) {
    handle = handle >>> 0;
    const idx = this._syncHandleToIdx.get(handle);
    return idx === undefined || this._syncCurrentHandles[idx] !== handle ? -1 : idx;
  }

  // Called from WASM host import
  _allocateThreadHandle() {
    let handle;
    do {
      handle = this._nextHandle++ >>> 0;
    } while (this.threads.has(handle) || this._threadHandleAliases.has(handle) ||
             this._syncHandleToIdx.has(handle));
    return handle;
  }

  _resolveThreadHandle(handle) {
    handle = handle >>> 0;
    return this.threads.get(handle) ||
      this._pendingThreads.find(pending => (pending.handle >>> 0) === handle) ||
      this._threadHandleAliases.get(handle) || null;
  }

  _resolveCurrentThread(win32Tid) {
    win32Tid = win32Tid >>> 0;
    if (win32Tid === 1) return this._mainThreadState;
    for (const candidate of this.threads.values()) {
      if ((((candidate.tid | 0) + 1) >>> 0) === win32Tid) return candidate;
    }
    return this._pendingThreads.find(candidate =>
      ((((candidate.tid | 0) + 1) >>> 0) === win32Tid)) || null;
  }

  _resolvePriorityThread(handle, win32Tid) {
    return (handle >>> 0) === 0xfffffffe
      ? this._resolveCurrentThread(win32Tid)
      : this._resolveThreadHandle(handle);
  }

  getThreadPriority(handle, win32Tid) {
    const thread = this._resolvePriorityThread(handle, win32Tid);
    return thread ? ((thread.priority || 0) | 0) : 0x7fffffff;
  }

  setThreadPriority(handle, priority, win32Tid) {
    const thread = this._resolvePriorityThread(handle, win32Tid);
    if (!thread) return 0;
    thread.priority = priority | 0;
    this._emitThreadEvent('priority', {
      handle: handle >>> 0,
      tid: (thread.tid || 0) | 0,
      priority: thread.priority,
    });
    return 1;
  }

  getThreadLocale(win32Tid) {
    const thread = this._resolveCurrentThread(win32Tid);
    return thread ? ((thread.locale || 0x0409) >>> 0) : 0;
  }

  setThreadLocale(locale, win32Tid) {
    const thread = this._resolveCurrentThread(win32Tid);
    if (!thread) return 0;
    locale = locale >>> 0;
    if (!locale) return 0;
    // Win98's system and user default pseudo-LCIDs both resolve to this
    // emulated machine's en-US default. Concrete LCIDs retain their sort id.
    if (locale === 0x0400 || locale === 0x0800) locale = 0x0409;
    thread.locale = locale;
    this._emitThreadEvent('locale', {
      tid: (thread.tid || 0) | 0,
      locale: thread.locale >>> 0,
    });
    return 1;
  }

  // COM apartments belong to threads, not WASM instances. Keep the model and
  // nesting count on the same durable record as suspend/priority state so the
  // cooperative and real Worker backends observe identical Win32 behavior.
  initializeComApartment(reserved, flags, win32Tid) {
    const thread = this._resolveCurrentThread(win32Tid);
    if (!thread) return 0x8000FFFF; // E_UNEXPECTED
    reserved = reserved >>> 0;
    flags = flags >>> 0;
    // COINIT_MULTITHREADED is zero; the original Win32 flags occupy bits 1-3.
    if (reserved || (flags & ~0x0000000E)) return 0x80070057; // E_INVALIDARG
    const apartment = (flags & 0x00000002) ? 1 : 2; // 1=STA, 2=MTA
    const count = thread.comInitCount >>> 0;
    if (count) {
      if ((thread.comApartment | 0) !== apartment) return 0x80010106; // RPC_E_CHANGED_MODE
      if (count !== 0xFFFFFFFF) thread.comInitCount = (count + 1) >>> 0;
      return 1; // S_FALSE
    }
    thread.comApartment = apartment;
    thread.comInitCount = 1;
    return 0; // S_OK
  }

  uninitializeComApartment(win32Tid) {
    const thread = this._resolveCurrentThread(win32Tid);
    if (!thread) return 0;
    const count = thread.comInitCount >>> 0;
    if (!count) return 0;
    thread.comInitCount = count - 1;
    if (!thread.comInitCount) thread.comApartment = 0;
    return 1;
  }

  duplicateCurrentThread(win32Tid) {
    const thread = this._resolveCurrentThread(win32Tid);
    if (!thread) return 0;
    const handle = this._allocateThreadHandle();
    this._threadHandleAliases.set(handle, thread);
    return handle;
  }

  // QueueUserAPC: the Win32 thread id a thread HANDLE names (main is 1), or 0
  // when the handle is unknown or its thread has exited. GetCurrentThread's
  // pseudo-handle is resolved in WAT and never reaches here, but a
  // DuplicateHandle copy of it does.
  threadApcTarget(handle, callerTid) {
    handle = handle >>> 0;
    if (handle === 0xfffffffe) return callerTid >>> 0;
    const thread = this._resolveThreadHandle(handle);
    if (!thread || thread.state === 'exited') return 0;
    if (thread === this._mainThreadState) return 1;
    return (((thread.tid | 0) + 1) >>> 0);
  }

  // QueueUserAPC published an APC for `win32Tid`. If that thread is parked in
  // an alertable SleepEx, end the sleep now: its next run() delivers the APC
  // and the sleep returns WAIT_IO_COMPLETION. A thread parked in an alertable
  // WaitFor*Ex needs no nudge -- its wait is re-polled every scheduler turn,
  // and the poll asks apc_wake_wait first. In --threads worker mode the
  // thread's instance lives in another isolate and its sleep runs out on its
  // own; the APC then runs at that resumption instead.
  alertThread(win32Tid) {
    win32Tid = win32Tid >>> 0;
    if (win32Tid === 1) {
      const e = this.mainInstance && this.mainInstance.exports;
      if (!e || !e.apc_alertable_sleeping) return;
      this.noteMainSleep();
      if (e.apc_alertable_sleeping() | 0) this._mainSleepUntil = 0;
      return;
    }
    const thread = this._resolveCurrentThread(win32Tid);
    const e = thread && thread.instance && thread.instance.exports;
    if (!e || !e.apc_alertable_sleeping) return;
    if (e.apc_alertable_sleeping() | 0) {
      thread.sleepUntil = 0;
      thread.sleepCount = 0;
    }
  }

  isMainThreadSuspended() {
    return (this._mainThreadState.suspendCount | 0) > 0;
  }

  // True while the main thread is parked in a blocking wait that checkMainYield
  // is re-polling. The host's batch loop uses this to decide how much of the
  // batch belongs to the workers: a main thread waiting on a worker has nothing
  // to do until that worker signals, so the usual small per-batch worker slice
  // budget is throttling the only thread making progress.
  isMainWaitingOnThreads() {
    return (this._mainWaitPolls | 0) > 0 && this.hasActiveThreads();
  }

  // A Worker that serviced its own COM/LoadLibrary yield appended a row to the
  // shared DLL table and took thunks, but the count and the thunk cursor are
  // per-instance globals. The host's CoCreateInstance bridge looks the server
  // up through the MAIN instance, so unless main hears about the new row the
  // retried call asks for the same DLL again -- forever. Morrowind's music
  // thread reloaded l3codecx.ax 26 times, each copy 0x20000 lower, until the
  // mappings ran into live memory and the thread jumped into the main stack.
  async _publishLinkLoaderState(link) {
    const main = this.mainInstance && this.mainInstance.exports;
    if (!main || !link || typeof link.callExport !== 'function') return;
    if (this.workerBackend && link === this.workerBackend._localLink) return;
    try {
      const dllCount = (await link.callExport('get_dll_count')) | 0;
      if (main.get_dll_count && dllCount > (main.get_dll_count() | 0)) {
        if (main.set_dll_count) main.set_dll_count(dllCount);
        else if (main.test_set_dll_count) main.test_set_dll_count(dllCount);
      }
      this.publishWorkerThunkState({
        thunkEnd: (await link.callExport('get_thunk_end')) >>> 0,
        numThunks: (await link.callExport('get_num_thunks')) >>> 0,
      });
    } catch (_) {}
  }

  // The call path of a trapped worker, read out of its own stack: the EBP
  // chain (each frame's return address) while it stays inside the thread's
  // stack, then the raw dwords at ESP. A wild EIP is almost always a bad
  // return or a call through a bad pointer, and only the frames name the
  // function that did it.
  _trapFrameWalk(thread, g) {
    try {
      const main = this.mainInstance && this.mainInstance.exports;
      const lo = thread.link.stackBase >>> 0, hi = thread.link.stackTop >>> 0;
      if (!main || !main.guest_read32 || !lo) return '';
      const rd = a => main.guest_read32(a) >>> 0;
      const inStack = a => a >= lo && a + 8 <= hi;
      const hex = v => `0x${(v >>> 0).toString(16)}`;
      // A pointer argument is shown with the dwords it points at, since the
      // bad value a frame calls through usually lives one load away.
      const arg = a => {
        const v = rd(a);
        if (v < 0x10000 || v >= 0x80000000) return hex(v);
        return `${hex(v)}{${[0, 4, 8].map(o => hex(rd(v + o))).join(',')}}`;
      };
      const frames = [];
      for (let bp = g.ebp >>> 0, n = 0; n < 16 && inStack(bp); n++) {
        frames.push(`${this._describeAddr(rd(bp + 4))}@0x${bp.toString(16)}`
          + `(${[8, 12, 16, 20].map(o => arg(bp + o)).join(' ')})`);
        const next = rd(bp);
        if (next <= bp) break;
        bp = next;
      }
      const words = [];
      for (let a = g.esp >>> 0, n = 0; n < 12 && inStack(a); n++, a += 4) {
        words.push(`0x${rd(a).toString(16)}`);
      }
      return (frames.length ? `\n  frames: ${frames.join(' <- ')}` : '\n  frames: (ebp outside stack)')
        + (words.length ? `\n  [esp]: ${words.join(' ')}` : '');
    } catch (_) {
      return '';
    }
  }

  createThread(startAddr, param, stackSize, creationFlags, threadIdWa, creatorWin32Tid) {
    creationFlags = creationFlags >>> 0;
    const tid = this._allocWorkerSlot();
    if (!tid) {
      this._log(`[ThreadManager] CreateThread failed: no decoded-cache slot for start=0x${startAddr.toString(16)}`);
      return 0;
    }
    const handle = this._allocateThreadHandle();
    this._dropExitedSlotHandles(tid);
    const suspendCount = (creationFlags & 0x4) ? 1 : 0;
    const resolvedStackSize = this._threadStackReserve(stackSize, creationFlags);
    const creator = this._resolveCurrentThread((creatorWin32Tid || 1) >>> 0) ||
      this._mainThreadState;
    this._pendingThreads.push({
      handle, tid, startAddr, param, stackSize: resolvedStackSize,
      creationFlags, suspendCount, priority: 0,
      locale: (creator.locale || 0x0409) >>> 0,
      comApartment: 0, comInitCount: 0,
    });
    // CreateThread returns a kernel HANDLE but lpThreadId receives a numeric
    // thread id. Worker cache slot N is initialized with current_thread_id
    // N+1, so publish that same value before the guest can use the output.
    if (threadIdWa) {
      const out = threadIdWa >>> 0;
      if (out + 4 <= this.memory.buffer.byteLength) {
        new DataView(this.memory.buffer).setUint32(out, (tid + 1) >>> 0, true);
      }
    }
    this._log(`[ThreadManager] CreateThread handle=0x${handle.toString(16)} start=0x${startAddr.toString(16)} param=0x${param.toString(16)} flags=0x${creationFlags.toString(16)} suspendCount=${suspendCount}`);
    this._emitThreadEvent('create', {
      handle: handle >>> 0,
      tid: tid | 0,
      startAddr: startAddr >>> 0,
      param: param >>> 0,
      stackSize: resolvedStackSize >>> 0,
      creationFlags,
      suspendCount,
    });
    return handle;
  }

  suspendThread(handle) {
    handle = handle >>> 0;
    const thread = this._resolveThreadHandle(handle);
    if (!thread || thread.state === 'exited') return 0xFFFFFFFF;
    const previous = (thread.suspendCount || 0) >>> 0;
    // Win32 exposes MAXIMUM_SUSPEND_COUNT as 0x7f. Refuse the increment at
    // the limit instead of wrapping and accidentally making the thread run.
    if (previous >= 0x7f) return 0xFFFFFFFF;
    thread.suspendCount = previous + 1;
    if (this._traceThread) {
      this._log(`[ThreadManager] SuspendThread handle=0x${handle.toString(16)} previous=${previous} current=${thread.suspendCount}`);
    }
    this._emitThreadEvent('suspend', {
      handle,
      tid: (thread.tid || 0) | 0,
      previousSuspendCount: previous,
      suspendCount: thread.suspendCount >>> 0,
    });
    // The private high bit tells the WAT handler that the caller suspended
    // itself. Windows stops that thread before SuspendThread can return to its
    // next guest instruction; without an immediate dispatcher yield, old
    // Infinity Engine decoder threads execute their self-suspend loop again
    // and accumulate MAXIMUM_SUSPEND_COUNT before another thread can resume
    // them. The handler masks the tag before publishing the Win32 return value.
    return this._runningThreadHandle === handle
      ? ((previous | 0x80000000) >>> 0)
      : previous;
  }

  resumeThread(handle) {
    handle = handle >>> 0;
    const thread = this._resolveThreadHandle(handle);
    if (!thread || thread.state === 'exited') return 0xFFFFFFFF;
    const previous = (thread.suspendCount || 0) >>> 0;
    if (previous > 0) thread.suspendCount = previous - 1;
    if (this._traceThread) {
      this._log(`[ThreadManager] ResumeThread handle=0x${handle.toString(16)} previous=${previous} current=${thread.suspendCount || 0}`);
    }
    this._emitThreadEvent('resume', {
      handle,
      tid: (thread.tid || 0) | 0,
      previousSuspendCount: previous,
      suspendCount: (thread.suspendCount || 0) >>> 0,
    });
    return previous;
  }

  // Where worker `tid` starts handing out hwnds. Every window an app makes,
  // from whichever thread, has to land inside that app's own
  // [base, base+0x10000) slice -- that range is what the shell prunes when the
  // app stops and what decides whose queued input an instance may take. Main
  // keeps the bottom half; the fifteen workers divide the top half into
  // 0x800 each. See the spawn site for why the split is uneven.
  workerHwndBase(tid) {
    return this._appHwndBase() + 0x8000 + ((tid - 1) * 0x800);
  }

  // How much stack Windows gives a new thread. dwStackSize 0 means the EXE's
  // SizeOfStackReserve, not a fixed default: compilers size frames against
  // it, and Zuma's resource loader probes a frame larger than 64KB with
  // _alloca_probe, which walked off our old 64KB stack and returned to 0.
  // A nonzero size is a commit size that only grows the reserve when it is
  // larger (rounded up to 1MB), unless STACK_SIZE_PARAM_IS_A_RESERVATION
  // (0x10000) says it is the reserve itself. Our stacks are committed up
  // front, so an implausibly large header default is capped at 8MB.
  _threadStackReserve(stackSize, creationFlags) {
    const requested = stackSize >>> 0;
    if (requested && (creationFlags & 0x10000)) return requested;
    const main = this.mainInstance && this.mainInstance.exports;
    const header = main && main.get_exe_stack_reserve
      ? (main.get_exe_stack_reserve() >>> 0) : 0;
    const reserve = Math.min(Math.max(header || 0x100000, 0x10000), 0x800000);
    if (requested > reserve) return ((requested + 0xFFFFF) & ~0xFFFFF) >>> 0;
    return reserve;
  }

  // Windows zero-fills a new stack. A committed range need not be one run of
  // WASM bytes (a commit can be split across backing extents), so translate
  // each page rather than filling from the base translation.
  _zeroGuestRange(base, size) {
    const main = this.mainInstance.exports;
    const bytes = new Uint8Array(this.memory.buffer);
    let off = 0;
    while (off < size) {
      const ga = (base + off) >>> 0;
      const len = Math.min(0x1000 - (ga & 0xFFF), size - off);
      const wa = main.guest_to_wasm(ga) >>> 0;
      bytes.fill(0, wa, wa + len);
      off += len;
    }
  }

  _allocWorkerSlot() {
    const used = new Set();
    for (const [, thread] of this.threads) {
      if (thread.state !== 'exited') used.add(thread.tid);
    }
    for (const pending of this._pendingThreads) {
      if (pending.tid) used.add(pending.tid);
    }
    for (let tid = 1; tid <= this._maxWorkerThreads; tid++) {
      if (!used.has(tid)) return tid;
    }
    return 0;
  }

  _dropExitedSlotHandles(tid) {
    // Thread cache slots are reusable once a thread exits. Our Win32 handle
    // model already treats unknown thread handles as signaled, so dropping the
    // old bookkeeping here frees the slot without changing wait behavior.
    for (const [handle, thread] of this.threads) {
      if (thread.tid === tid && thread.state === 'exited') {
        // The old thread can no longer run, so its stack goes back to the
        // virtual pool; without this every thread a game spawns leaks one.
        const stack = thread.stackAlloc >>> 0;
        const main = this.mainInstance && this.mainInstance.exports;
        if (stack && main && main.guest_map_free) main.guest_map_free(stack);
        thread.stackAlloc = 0;
        this.threads.delete(handle);
      }
    }
  }

  // `_clearWorkerCacheSlot(tid)` used to live here. It zeroed the per-thread
  // direct-mapped block-cache index at `0x07152000 + tid * 0x8000` so a reused
  // worker slot could not jump a fresh thread into the previous thread's
  // decoded blocks. Two things have since made it wrong rather than merely
  // redundant:
  //   - page compilation retired CACHE_INDEX outright
  //     (docs/page-compile-design.md §§4, 4.1), and `init_thread` in
  //     src/13-exports.wat now re-points $PAGE_DIR/$PAGE_INDEX at the slot's
  //     own partition and calls $page_dir_reset, so the invalidation is done
  //     on the WAT side, for both backends;
  //   - 0x07152000 was a HAND-COPIED literal of a base the region allocator
  //     now chooses, and it currently chooses that address for $PE_STAGING —
  //     so the clear had become 32KB of zeroes written into the PE staging
  //     arena on every worker spawn and teardown.
  // Do not reintroduce it. If a slot ever needs host-side invalidation again,
  // read the region from lib/region-map.generated.js; never write the address.

  exitThread(exitCode) {
    // The WASM side sets yield_reason=2/eip=0 after this host call, but guest
    // code on another thread can query the handle before the scheduler sees
    // that yield. Record the exit synchronously so GetExitCodeThread and waits
    // observe the same state Windows would expose after ExitThread.
    const handle = this._runningThreadHandle;
    const t = handle ? this.threads.get(handle) : null;
    if (t) {
      this._markThreadExited(handle, t, exitCode, 'ExitThread');
    }
  }

  _markThreadExited(handle, thread, exitCode, reason) {
    if (!thread) return;
    const wasExited = thread.state === 'exited';
    thread.state = 'exited';
    thread.exitCode = exitCode == null ? ((thread.exitCode || 0) >>> 0) : (exitCode >>> 0);
    this._audioThreadHotUntil.delete((thread.tid || 0) | 0);
    if (!wasExited) {
      const vfs = this._getVfs();
      if (vfs && vfs.releaseIoState) vfs.releaseIoState((thread.tid | 0) + 1);
      // USER destroys every window owned by a thread when that thread
      // terminates. Prefer the cooperative thread's instance so teardown
      // callbacks run with its register set; the shared main instance is the
      // fallback for a real Worker, whose instance is no longer callable.
      const windowExports = (thread.instance && thread.instance.exports)
        || (this.mainInstance && this.mainInstance.exports);
      if (windowExports && windowExports.wnd_destroy_thread_windows) {
        try {
          windowExports.wnd_destroy_thread_windows(((thread.tid || 0) | 0) + 1);
        } catch (err) {
          this._log(`[ThreadManager] thread ${thread.tid} window cleanup failed: `
            + `${err && err.message ? err.message : err}`);
        }
      }
      // USER owns one process-shared posted-message queue per Win32 thread.
      // Drop it on every exit path, including a trapped or forcibly terminated
      // Worker whose instance can no longer release heap overflow itself.
      const queueExports = (this.mainInstance && this.mainInstance.exports)
        || (thread.instance && thread.instance.exports);
      if (queueExports && queueExports.reset_thread_message_queue) {
        try {
          queueExports.reset_thread_message_queue(((thread.tid || 0) | 0) + 1);
        } catch (err) {
          this._log(`[ThreadManager] thread ${thread.tid} message-queue cleanup failed: `
            + `${err && err.message ? err.message : err}`);
        }
      }
      this._abandonMutexesOwnedBy(((thread.tid || 0) | 0) + 1);
      // A critical section this thread still owns is not held, it is lost, and
      // every waiter parks on it forever. This is the one moment when the owner
      // is KNOWN to be gone, which is what makes releasing here defensible where
      // guessing from a timeout was not. It covers the case no guest can clean up
      // after either: a thread that ended by trapping.
      //
      // Runs on whichever instance is to hand — the registry holds WASM
      // addresses, so no image-base translation is involved — and takes
      // $current_thread_id, which for a spawned thread is tid+1.
      const ex = this.mainInstance && this.mainInstance.exports;
      if (ex && ex.release_cs_owned_by) {
        const freed = ex.release_cs_owned_by(((thread.tid || 0) | 0) + 1) | 0;
        if (freed) {
          this._log(`[ThreadManager] thread ${thread.tid} ended owning ${freed} `
            + `critical section(s) (${reason || 'exit'}); released`);
        }
      }
      this._emitThreadEvent('exit', {
        handle: handle >>> 0,
        tid: (thread.tid || 0) | 0,
        startAddr: (thread.startAddr || 0) >>> 0,
        exitCode: thread.exitCode >>> 0,
        reason: reason || 'exit',
      });
    }
    if (!thread._exitNotified && this._onThreadExit) {
      thread._exitNotified = true;
      try {
        this._onThreadExit({
          handle: handle >>> 0,
          tid: thread.tid | 0,
          startAddr: thread.startAddr >>> 0,
          param: thread.param >>> 0,
          exitCode: thread.exitCode >>> 0,
          reason: reason || 'exit',
        });
      } catch (err) {
        this._log(`[ThreadManager] onThreadExit failed: ${err && err.message ? err.message : err}`);
      }
    }
  }

  getExitCodeThread(handle) {
    const t = this._resolveThreadHandle(handle);
    if (!t) return 0;
    return t.state === 'exited' ? (t.exitCode >>> 0) : 0x103; // STILL_ACTIVE
  }

  terminateThread(handle, exitCode) {
    const thread = this._resolveThreadHandle(handle);
    if (thread) {
      this._markThreadExited(handle >>> 0, thread, exitCode >>> 0, 'TerminateThread');
    }
    // Several Win9x installers terminate helper handles after the helper has
    // already disappeared. Treat stale handles as a successful no-op so setup
    // cleanup does not take down the whole process.
    return 1;
  }

  _findNamedSyncObject(name) {
    const entry = this._namedSyncObjects.get(name);
    if (!entry) return null;
    const idx = this._getSyncIdx(entry.handle);
    if (idx < 0 || Atomics.load(this.syncView, idx * 4 + 1) !== entry.type) {
      this._namedSyncObjects.delete(name);
      return null;
    }
    return { handle: entry.handle >>> 0, idx, type: entry.type | 0 };
  }

  _createNamedSyncReference(name, type) {
    if (!name) return 0;
    const existing = this._findNamedSyncObject(name);
    if (!existing) return 0;
    // The private bit-31 result tag has no handle bits when a different kind
    // already owns the name. WAT maps that sentinel to ERROR_INVALID_HANDLE.
    if (existing.type !== type) return 0x80000000;
    this._syncRefs[existing.idx]++;
    return ((existing.handle | 0x80000000) >>> 0);
  }

  _openNamedSyncObject(name, type) {
    if (!name) return 0;
    const existing = this._findNamedSyncObject(name);
    if (!existing) return 0;
    if (existing.type !== type) return 0x80000000;
    this._syncRefs[existing.idx]++;
    return existing.handle;
  }

  createEvent(manualReset, initialState, name) {
    name = name ? String(name) : '';
    if (name) {
      const existing = this._createNamedSyncReference(name, 1);
      if (existing) return existing;
    }
    // Find free slot in sync table
    let idx = -1;
    for (let i = 0; i < MAX_SYNC_OBJECTS; i++) {
      if (this.syncView[i * 4 + 1] === 0) { // Type=0 (Free)
        idx = i;
        break;
      }
    }
    if (idx === -1) return 0;

    const handle = this._allocateSyncHandle(idx);
    Atomics.store(this.syncView, idx * 4 + 2, initialState ? 1 : 0); // State
    Atomics.store(this.syncView, idx * 4 + 3, manualReset ? 1 : 0); // ManualReset
    Atomics.store(this.syncView, idx * 4 + 0, handle | 0); // issued handle mirror
    // Publish the type last so a Worker never observes a half-created object.
    Atomics.store(this.syncView, idx * 4 + 1, 1); // Type=1 (Event)
    this._syncRefs[idx] = 1;
    this._syncNames[idx] = name || null;
    if (name) this._namedSyncObjects.set(name, { handle, type: 1 });

    if (this._traceThread) {
      this._log(`[ThreadManager] CreateEvent handle=0x${handle.toString(16)} idx=${idx} manual=${!!manualReset} initial=${!!initialState}${name ? ` name=${name}` : ''}`);
    }
    return handle;
  }

  openEvent(name) {
    name = name ? String(name) : '';
    return this._openNamedSyncObject(name, 1);
  }

  // Mutex: Type=3, slot[2]=owning Win32 thread id, slot[3]=recursion count.
  // Names share the process synchronization namespace, while owner/recursion
  // live in SharedArrayBuffer so real browser Workers observe one lock.
  createMutex(initialOwner, name, threadId = 1) {
    name = name ? String(name) : '';
    threadId = (threadId | 0) || 1;
    if (name) {
      const existing = this._createNamedSyncReference(name, 3);
      if (existing) return existing;
    }
    let idx = -1;
    for (let i = 0; i < MAX_SYNC_OBJECTS; i++) {
      if (Atomics.load(this.syncView, i * 4 + 1) === 0) { idx = i; break; }
    }
    if (idx < 0) return 0;
    const handle = this._allocateSyncHandle(idx);
    Atomics.store(this.syncView, idx * 4 + 2, initialOwner ? threadId : 0);
    Atomics.store(this.syncView, idx * 4 + 3, initialOwner ? 1 : 0);
    Atomics.store(this.syncView, idx * 4 + 0, handle | 0);
    Atomics.store(this.syncView, idx * 4 + 1, 3); // publish type last
    this._syncRefs[idx] = 1;
    this._syncNames[idx] = name || null;
    if (name) this._namedSyncObjects.set(name, { handle, type: 3 });
    return handle >>> 0;
  }

  openMutex(name) {
    name = name ? String(name) : '';
    return this._openNamedSyncObject(name, 3);
  }

  // The Win32 thread id of the guest thread whose code is calling into the
  // host right now: the thread a cooperative slice or a worker RPC is running
  // for, else the main thread (1). Mutex ownership must be charged to THIS id.
  // Every thread's import table shares the main thread's sync primitives, so a
  // closure over the host ctx always said 1 -- and a worker's
  // WaitForSingleObject(mutex, 0) then "re-entered" a mutex main held. Bink's
  // reader thread did exactly that and overfilled its IO ring while main was
  // consuming it, so Morrowind's intro videos decoded garbage and hung.
  currentWin32ThreadId() {
    const handle = this._runningThreadHandle;
    const thread = handle ? this.threads.get(handle) : null;
    return thread ? (((thread.tid | 0) + 1) | 0) : 1;
  }

  // 1=success, 0=ERROR_NOT_OWNER, -1=invalid handle/type.
  releaseMutex(handle, threadId = 1) {
    const idx = this._getSyncIdx(handle);
    if (idx < 0 || Atomics.load(this.syncView, idx * 4 + 1) !== 3) return -1;
    threadId = (threadId | 0) || 1;
    if (Atomics.load(this.syncView, idx * 4 + 2) !== threadId) return 0;
    const recursion = Atomics.sub(this.syncView, idx * 4 + 3, 1) - 1;
    if (recursion <= 0) {
      Atomics.store(this.syncView, idx * 4 + 3, 0);
      Atomics.store(this.syncView, idx * 4 + 2, 0);
      Atomics.notify(this.syncView, idx * 4 + 2);
      this._wakeWaitersSoon();
    }
    return 1;
  }

  _abandonMutexesOwnedBy(threadId) {
    threadId = (threadId | 0) || 1;
    for (let idx = 0; idx < MAX_SYNC_OBJECTS; idx++) {
      if (Atomics.load(this.syncView, idx * 4 + 1) !== 3 ||
          Atomics.load(this.syncView, idx * 4 + 2) !== threadId) continue;
      // -1 means the next successful waiter receives WAIT_ABANDONED_0.
      Atomics.store(this.syncView, idx * 4 + 3, -1);
      Atomics.store(this.syncView, idx * 4 + 2, 0);
      Atomics.notify(this.syncView, idx * 4 + 2);
    }
  }

  // CloseHandle releases duplicated thread handles and kernel synchronization
  // objects. Storm creates short-lived event triplets while streaming Diablo's
  // MPQ, so the final close must recycle the fixed table slot. Named opens can
  // add references; an intermediate close must leave their shared object live.
  closeSyncHandle(handle) {
    handle = handle >>> 0;
    if (this._threadHandleAliases.delete(handle)) return true;
    const idx = this._getSyncIdx(handle);
    if (idx < 0 || Atomics.load(this.syncView, idx * 4 + 1) === 0) return false;
    if (this._syncRefs[idx] > 1) {
      this._syncRefs[idx]--;
      return true;
    }
    const name = this._syncNames[idx];
    const named = name ? this._namedSyncObjects.get(name) : null;
    if (named && (named.handle >>> 0) === handle) {
      this._namedSyncObjects.delete(name);
    }
    this._syncRefs[idx] = 0;
    this._syncNames[idx] = null;
    Atomics.store(this.syncView, idx * 4 + 0, 0); // issued handle mirror
    Atomics.store(this.syncView, idx * 4 + 2, 0); // event state / semaphore count
    Atomics.store(this.syncView, idx * 4 + 3, 0); // manual reset / maximum count
    // Publish Type=Free last so an allocator cannot observe a half-cleared slot.
    Atomics.store(this.syncView, idx * 4 + 1, 0);
    this._syncHandleToIdx.delete(handle);
    this._syncCurrentHandles[idx] = 0;
    return true;
  }

  setEvent(handle) {
    const idx = this._getSyncIdx(handle);
    if (idx >= 0 && this.syncView[idx * 4 + 1] === 1) {
      // Set state to signaled (1) and wake up any waiters
      Atomics.store(this.syncView, idx * 4 + 2, 1);
      Atomics.notify(this.syncView, idx * 4 + 2);
      // In the cooperative backend a main-thread SetEvent is the only point
      // at which an awakened guest worker can plausibly preempt its signaler.
      // Record only workers demonstrably parked on this exact event; the
      // browser drive loop will let each one finish its awakened turn.
      if (!this.workerBackend && !this._runningThreadHandle) {
        if (!this._cooperativeWakeTargets) this._cooperativeWakeTargets = new Map();
        for (const [threadHandle, thread] of this.threads) {
          const e = thread && thread.instance && thread.instance.exports;
          if (thread.state === 'active' && e && e.get_yield_reason &&
              (e.get_yield_reason() | 0) === 1 && e.get_wait_handle &&
              (e.get_wait_handle() >>> 0) === (handle >>> 0)) {
            this._cooperativeWakeTargets.set(threadHandle >>> 0, handle >>> 0);
          }
        }
      }
      if (this._traceThread) this._log(`[ThreadManager] SetEvent 0x${handle.toString(16)}`);
      this._wakeWaitersSoon();
    }
    return 1;
  }

  // Free-run: a signal (SetEvent, ReleaseSemaphore, ReleaseMutex) served for
  // one Worker can satisfy what another is parked on. Parked waits are polled
  // on this page, and only at slice ends and page steps, so a signal raised
  // mid-slice used to reach its waiter late: StarCraft's main thread queued a
  // Storm read and SetEvent'ed the read thread, which then sat parked ~25ms
  // (or its whole 250ms timeout), and main's WaitForMultipleObjects on the
  // finished reads ran out its 50ms timeout twice before noticing. Offer the
  // waiters their slice as soon as the serving call returns, and release a
  // parked page step so the main thread's own parked wait is re-polled too.
  _wakeWaitersSoon() {
    if (!this.workerBackend || !this.workerFreeRun || this._signalWakeQueued) return;
    this._signalWakeQueued = true;
    queueMicrotask(() => {
      this._signalWakeQueued = false;
      this.offerSatisfiedWaiters(null);
      const wake = this._sliceDoneWake;
      this._sliceDoneWake = null;
      if (wake) wake();
    });
  }

  async drainCooperativeWakes(options) {
    options = options || {};
    if (this.workerBackend || !this._cooperativeWakeTargets || !this._cooperativeWakeTargets.size) {
      return { steps: 0, blocks: 0, threadsRun: 0 };
    }
    const targets = [...this._cooperativeWakeTargets];
    this._cooperativeWakeTargets.clear();
    const total = { steps: 0, blocks: 0, threadsRun: 0 };
    // A wake should get a real preemption turn, including any provider fill it
    // encounters, but background media work must not monopolize the browser.
    // Input-triggered transitions are different: the signaler is about to tear
    // down/reuse screen resources, so let the awakened worker reach its idle
    // boundary (subject to the caller's still-finite cap).
    const STEP_BUDGET = Math.max(100000,
      (options.maxTotalSteps | 0) || (2 * 1024 * 1024));
    for (const [threadHandle, eventHandle] of targets) {
      let spent = 0;
      while (spent < STEP_BUDGET) {
        const thread = this.threads.get(threadHandle);
        if (!thread || thread.state !== 'active') break;
        const e = thread.instance && thread.instance.exports;
        // A woken worker may dynamically load its provider before it can
        // finish the job. Service that asynchronous host boundary inside the
        // same preemption turn; otherwise main resumes one slice too early.
        if (e && (e.get_yield_reason() | 0) === 5 &&
            typeof options.serviceLoadLibraries === 'function') {
          await options.serviceLoadLibraries();
          continue;
        }
        // Returning to the same wait proves the awakened job reached its idle
        // boundary; merely consuming the event does not.
        if (spent && e && (e.get_yield_reason() | 0) === 1 &&
            (e.get_wait_handle() >>> 0) === eventHandle) {
          break;
        }
        const stats = this.runSlice(100000, {
          quantumSteps: 50000,
          maxWallMs: 12,
          preferredThreadHandle: threadHandle,
          onlyThreadHandle: threadHandle,
        });
        const ran = stats.steps | 0;
        total.steps += ran;
        total.blocks += stats.blocks || 0;
        total.threadsRun += stats.threadsRun | 0;
        if (!ran) {
          // Provider-backed ISO reads complete on the browser event loop. Keep
          // the main thread behind this preemption boundary while the awakened
          // worker's exact read lands, then retry its parked ReadFile thunk.
          if (thread.ioFill) {
            await thread.ioFill;
            continue;
          }
          break;
        }
        spent += ran;
      }
    }
    return total;
  }

  resetEvent(handle) {
    const idx = this._getSyncIdx(handle);
    if (idx >= 0 && this.syncView[idx * 4 + 1] === 1) {
      Atomics.store(this.syncView, idx * 4 + 2, 0);
    }
    return 1;
  }

  // Semaphore: Type=2, slot[2]=current count, slot[3]=max count.
  // Wait succeeds by atomically decrementing count when count > 0.
  createSemaphore(initialCount, maxCount, name) {
    name = name ? String(name) : '';
    // Win32 opens an existing same-name semaphore before looking at the new
    // counts; lInitialCount and lMaximumCount are ignored in that case.
    if (name) {
      const existing = this._createNamedSyncReference(name, 2);
      if (existing) return existing;
    }
    // A genuinely new object rejects lMaximumCount <= 0 and any initial count
    // outside [0, max].
    initialCount |= 0; maxCount |= 0;
    if (maxCount <= 0 || initialCount < 0 || initialCount > maxCount) return 0;
    let idx = -1;
    for (let i = 0; i < MAX_SYNC_OBJECTS; i++) {
      if (this.syncView[i * 4 + 1] === 0) { idx = i; break; }
    }
    if (idx === -1) return 0;
    const handle = this._allocateSyncHandle(idx);
    Atomics.store(this.syncView, idx * 4 + 2, initialCount); // count
    Atomics.store(this.syncView, idx * 4 + 3, maxCount); // max
    Atomics.store(this.syncView, idx * 4 + 0, handle | 0); // issued handle mirror
    Atomics.store(this.syncView, idx * 4 + 1, 2); // Type=Semaphore, published last
    this._syncRefs[idx] = 1;
    this._syncNames[idx] = name || null;
    if (name) this._namedSyncObjects.set(name, { handle, type: 2 });
    if (this._traceThread) {
      this._log(`[ThreadManager] CreateSemaphore handle=0x${handle.toString(16)} init=${initialCount} max=${maxCount}${name ? ` name=${name}` : ''}`);
    }
    return handle;
  }

  openSemaphore(name) {
    name = name ? String(name) : '';
    return this._openNamedSyncObject(name, 2);
  }

  releaseSemaphore(handle, releaseCount, lpPrevCountWA) {
    const idx = this._getSyncIdx(handle);
    if (idx < 0 || this.syncView[idx * 4 + 1] !== 2) return 0;
    // Win32 rejects lReleaseCount <= 0; without this, a negative release was
    // added as an increment — success returned while the count went DOWN, and
    // a previously signaled semaphore started timing out.
    releaseCount |= 0;
    if (releaseCount <= 0) return 0;
    const max = this.syncView[idx * 4 + 3];
    while (true) {
      const cur = Atomics.load(this.syncView, idx * 4 + 2);
      const next = cur + releaseCount;
      if (next > max) return 0;                              // would overflow → fail
      if (Atomics.compareExchange(this.syncView, idx * 4 + 2, cur, next) === cur) {
        if (lpPrevCountWA) {
          new Int32Array(this.memory.buffer)[lpPrevCountWA >>> 2] = cur;
        }
        Atomics.notify(this.syncView, idx * 4 + 2, releaseCount);
        this._wakeWaitersSoon();
        return 1;
      }
    }
  }

  waitSingle(handle, timeout, threadId = 1) {
    timeout = timeout >>> 0;
    threadId = (threadId | 0) || 1;
    // OpenProcess handles for this emulator's one live process. They remain
    // unsignaled until process teardown, unlike unknown handles (which retain
    // the historical immediate-success fallback for legacy callers).
    if (((handle >>> 0) & 0xFFFFF000) === 0x000E2000) {
      return timeout === 0 ? 0x102 : 0xFFFF;
    }
    // A child process CreateProcess started (src/09d7-pipes.wat): signaled
    // once it has exited. The host that started it sets processCtl.
    if (((handle >>> 0) & 0xFFFF0000) === 0x00E40000) {
      const code = this.processCtl ? this.processCtl(0, handle & 0xFFFF, 0) : -1;
      if (code !== 259) return 0;  // exited, or unknown: signaled, as before
      return timeout === 0 ? 0x102 : 0xFFFF;
    }
    const idx = this._getSyncIdx(handle);
    if (idx >= 0 && this.syncView[idx * 4 + 1] === 2) {
      // Semaphore: try to decrement count; CAS loop tolerates other waiters racing.
      while (true) {
        const cur = Atomics.load(this.syncView, idx * 4 + 2);
        if (cur > 0) {
          if (Atomics.compareExchange(this.syncView, idx * 4 + 2, cur, cur - 1) === cur) {
            return 0; // WAIT_OBJECT_0
          }
          continue;
        }
        if (timeout === 0) return 0x102;
        return 0xFFFF; // cooperative scheduler will poll after other threads run
      }
    }
    if (idx >= 0 && this.syncView[idx * 4 + 1] === 1) {
      let state = Atomics.load(this.syncView, idx * 4 + 2);
      if (state === 1) {
        if (this.syncView[idx * 4 + 3] === 0) { // Auto-reset
          Atomics.store(this.syncView, idx * 4 + 2, 0);
        }
        return 0; // WAIT_OBJECT_0
      }
      if (timeout === 0) return 0x102; // WAIT_TIMEOUT

      return 0xFFFF; // blocking wait: yield to cooperative scheduler
    }
    if (idx >= 0 && this.syncView[idx * 4 + 1] === 3) {
      while (true) {
        const owner = Atomics.load(this.syncView, idx * 4 + 2);
        if (owner === threadId) {
          Atomics.add(this.syncView, idx * 4 + 3, 1);
          return 0;
        }
        if (owner === 0 &&
            Atomics.compareExchange(this.syncView, idx * 4 + 2, 0, threadId) === 0) {
          const abandoned = Atomics.load(this.syncView, idx * 4 + 3) < 0;
          Atomics.store(this.syncView, idx * 4 + 3, 1);
          return abandoned ? 0x80 : 0; // WAIT_ABANDONED_0 / WAIT_OBJECT_0
        }
        if (timeout === 0) return 0x102;
        return 0xFFFF;
      }
    }
    // Handle might be a thread handle — wait for thread exit
    const thread = this._resolveThreadHandle(handle);
    if (thread && thread.state === 'exited') return 0;
    if (thread) return timeout === 0 ? 0x102 : 0xFFFF; // live thread: poll or wait
    // A CreateThread handle is valid before the asynchronous worker instance
    // has been spawned.  Treating that short pending interval as an unknown
    // (therefore signaled) handle makes WaitForMultipleObjects report a thread
    // exit before the thread has executed its first instruction.
    const pending = this._pendingThreads.find(item => (item.handle >>> 0) === (handle >>> 0));
    if (pending) return timeout === 0 ? 0x102 : 0xFFFF;
    return 0;
  }

  // A synchronous guest callback (for example WM_DESTROY sent from
  // DestroyWindow) cannot preserve its call frame if WaitForSingleObject
  // yields out of the recursive interpreter run. When the main instance is
  // waiting for a guest worker thread, give that worker a bounded chance to
  // observe its shutdown flag and exit before returning control to WAT.
  waitSingleCooperative(handle, timeout, threadId = 1) {
    let result = this.waitSingle(handle, timeout, threadId);
    if (result !== 0xFFFF || (timeout >>> 0) !== 0xFFFFFFFF) return result;
    // Worker backend: nothing to pump inline (see waitMultipleCooperative).
    if (this.workerBackend) return result;
    // Never recursively enter a worker instance that is already executing.
    // The nested callback cannot yield safely, so report a Win32 wait failure
    // and let its cleanup path continue instead of returning our internal
    // cooperative-scheduler sentinel (0xFFFF).
    if (this._runningThreadHandle) return 0xFFFFFFFF;
    let target = this._resolveThreadHandle(handle);
    if (target && this._pendingThreads.includes(target) && !this.workerBackend) {
      // WebAssembly.Module is already compiled. Instantiate it synchronously
      // so a CreateThread followed immediately by a nested infinite wait can
      // actually run the new thread without unwinding the guest callback.
      this.spawnPending();
      target = this._resolveThreadHandle(handle);
    }
    if (!target || target.isMain || target.state !== 'active') return 0xFFFFFFFF;
    const canonicalHandle = Array.from(this.threads.entries())
      .find(([, thread]) => thread === target)?.[0] || (handle >>> 0);

    const STEP_BUDGET = 64 * 1024 * 1024;
    let spent = 0;
    while (spent < STEP_BUDGET && target.state === 'active') {
      // Stop flags are commonly set while the target is in Sleep. The
      // blocking waiter should not have to wait for browser wall time before
      // the worker can observe that flag.
      target.sleepUntil = 0;
      const stats = this.runSlice(100000, {
        quantumSteps: 50000,
        maxWallMs: 12,
        preferredThreadHandle: canonicalHandle,
        onlyThreadHandle: canonicalHandle,
      });
      result = this.waitSingle(handle, 0, threadId);
      if (result === 0) return 0;
      if (!(stats.steps | 0)) break;
      spent += stats.steps | 0;
    }
    return 0xFFFFFFFF;
  }

  // One bounded inline turn for the worker threads, for a main instance that
  // cannot yield. A critical section contended from inside a synchronous
  // wndproc is the third face of the problem waitSingleCooperative and
  // waitMultipleCooperative already solve: the yield returns to the recursive
  // interpreter loop in $wnd_send_message rather than to the host, so the
  // thread holding the section never gets scheduled and the wndproc is
  // abandoned once that loop runs out of rounds. WAT calls this in a loop and
  // re-checks the section's owner itself; 0 means there is nobody we may run
  // (no active worker, or we are already executing inside one).
  pumpThreadsOnce() {
    // Worker-backed threads are already executing on their own host threads.
    // There is no cooperative instance to enter here, and runSlice() rejects
    // this backend deliberately. Returning zero is the contract cs_pump's WAT
    // caller already uses for "no inline cooperative turn available"; its
    // bounded atomic retry observes the real owner directly.
    if (this.workerBackend) return 0;
    if (this._runningThreadHandle) return 0;
    const stats = this.runSlice(100000, { quantumSteps: 50000, maxWallMs: 12 });
    return stats.threadsRun | 0;
  }

  // The multi-object form of the same problem waitSingleCooperative solves.
  // Storm's sound loader hands an event to WaitForMultipleObjects from inside
  // Diablo's WM_INITDIALOG, which arrives through a synchronous SendMessage:
  // the yield path cannot preserve that recursive interpreter frame, so
  // $wnd_send_message abandons the dialog procedure halfway and the dialog is
  // never initialised. Give the worker that signals the event a bounded
  // chance to run inline instead of yielding.
  waitMultipleCooperative(nCount, lpHandlesWA, bWaitAll, timeout, threadId = 1) {
    let result = this.waitMultiple(nCount, lpHandlesWA, bWaitAll, timeout, threadId);
    if (result !== 0xFFFF || (timeout >>> 0) !== 0xFFFFFFFF) return result;
    // Worker-backed threads already run on their own host threads; there is
    // nothing to pump inline, and runSlice() rejects this backend. Answer as
    // the ordinary wait does (host.js never calls in here then; run.js did,
    // and Diablo's Storm wait inside WM_INITDIALOG threw under --threads).
    if (this.workerBackend) return result;
    // Never recursively enter a worker instance that is already executing.
    if (this._runningThreadHandle) return 0xFFFFFFFF;
    // INFINITE has to mean it. This loop used to stop after eight slices and
    // report WAIT_FAILED, which is a lie about a wait the guest asked to be
    // unbounded -- and a caller that ignores the return value (Storm's MPQ
    // reader does) then carries on with whatever the worker had managed so
    // far. Eight slices is 800k steps; Storm's PKWARE explode runs about
    // twelve steps a byte, so a 128KB chunk got cut off almost exactly
    // halfway and Diablo decoded 16 of a file's 32 sectors, leaving the rest
    // of the image zero. Zero bytes are opaque black once the PCX RLE loop
    // paints them, which is the blacked-out menu art.
    //
    // So keep pumping while the wait can still be satisfied, and stop only on
    // a reason: nothing active is left to signal the object, or a whole slice
    // executed no instructions at all. The step budget below is the backstop
    // for a worker that spins instead of progressing -- it is sized well
    // above a full chunk (128KB at even 100 steps a byte is 13M) so that a
    // slow decode finishes and only a genuine livelock hits it.
    const STEP_BUDGET = 64 * 1024 * 1024;
    let spent = 0;
    while (spent < STEP_BUDGET) {
      if (!this.hasActiveThreads()) break;
      const stats = this.runSlice(100000, { quantumSteps: 50000, maxWallMs: 12 });
      result = this.waitMultiple(nCount, lpHandlesWA, bWaitAll, 0, threadId);
      if (result !== 0x102 && result !== 0xFFFF) return result;
      if (!(stats.steps | 0)) break;
      spent += stats.steps | 0;
    }
    this._noteNestedIoPark('WaitForMultipleObjects');
    return 0xFFFFFFFF; // WAIT_FAILED — the caller's cleanup path can proceed
  }

  // A guest thread run inline from a nested synchronous wait parked on a lazy
  // byte range. runSlice is synchronous, so that fill cannot land until the
  // wait gives up, and the waiter gets WAIT_FAILED instead of its data (Storm
  // then decodes an empty buffer: Diablo's black menu art). Say so once per
  // range: the remedy is to preload it (lib/apps.js `preloadRanges`, measured
  // with tools/io-range-census.js), not anything in the guest.
  _noteNestedIoPark(api) {
    for (const thread of this.threads.values()) {
      const read = thread && thread.ioFill && thread.ioFillRead;
      if (!read) continue;
      const key = `${read.path}@${read.offset}+${read.length}`;
      if (!this._nestedIoParks) this._nestedIoParks = new Set();
      if (this._nestedIoParks.has(key)) continue;
      this._nestedIoParks.add(key);
      this._log(`[io] needs-preload: T${thread.tid} parked on ${read.path} ` +
        `@${read.offset}+${read.length} inside a nested synchronous ${api}; ` +
        `the wait fails instead of waiting for the fetch`);
    }
  }

  waitMultiple(nCount, lpHandlesWA, bWaitAll, timeout, threadId = 1) {
    threadId = (threadId | 0) || 1;
    const mem = new Int32Array(this.memory.buffer);
    const wa = lpHandlesWA >>> 2;
    const handles = [];
    for (let i = 0; i < nCount; i++) {
      handles.push(mem[wa + i]);
    }

    if (bWaitAll) {
      // Observe every object before consuming any auto-reset event or
      // semaphore count. Calling waitSingle while probing used to reset the
      // first ready event even when a later object was not ready, making a
      // wait-all impossible to satisfy on a later scheduler poll.
      let allReady = true;
      let abandonedIndex = -1;
      for (let i = 0; i < nCount; i++) {
        const handle = handles[i] >>> 0;
        const idx = this._getSyncIdx(handle);
        let ready;
        if (idx >= 0 && this.syncView[idx * 4 + 1] === 1) {
          ready = Atomics.load(this.syncView, idx * 4 + 2) === 1;
        } else if (idx >= 0 && this.syncView[idx * 4 + 1] === 2) {
          ready = Atomics.load(this.syncView, idx * 4 + 2) > 0;
        } else if (idx >= 0 && this.syncView[idx * 4 + 1] === 3) {
          const owner = Atomics.load(this.syncView, idx * 4 + 2);
          ready = owner === 0 || owner === threadId;
          if (ready && owner === 0 && Atomics.load(this.syncView, idx * 4 + 3) < 0 && abandonedIndex < 0) {
            abandonedIndex = i;
          }
        } else {
          const thread = this._resolveThreadHandle(handle);
          const pending = this._pendingThreads.find(item => (item.handle >>> 0) === handle);
          ready = thread ? thread.state === 'exited' : !pending;
        }
        if (!ready) {
          allReady = false;
          break;
        }
      }
      if (allReady) {
        // The current backend is cooperative, so no guest thread can change
        // these objects between the readiness pass and this consume pass.
        for (let i = 0; i < nCount; i++) {
          const idx = this._getSyncIdx(handles[i] >>> 0);
          if (idx < 0) continue;
          const type = this.syncView[idx * 4 + 1];
          if (type === 1 && this.syncView[idx * 4 + 3] === 0) {
            Atomics.store(this.syncView, idx * 4 + 2, 0); // auto-reset event
          } else if (type === 2) {
            Atomics.sub(this.syncView, idx * 4 + 2, 1); // semaphore
          } else if (type === 3) {
            const owner = Atomics.load(this.syncView, idx * 4 + 2);
            if (owner === threadId) Atomics.add(this.syncView, idx * 4 + 3, 1);
            else if (Atomics.compareExchange(this.syncView, idx * 4 + 2, 0, threadId) === 0) {
              Atomics.store(this.syncView, idx * 4 + 3, 1);
            }
          }
        }
        return abandonedIndex < 0 ? 0 : 0x80 + abandonedIndex;
      }
    } else {
      for (let i = 0; i < nCount; i++) {
        const result = this.waitSingle(handles[i], 0, threadId);
        if (result === 0) return i; // WAIT_OBJECT_0 + i
        if (result === 0x80) return 0x80 + i; // WAIT_ABANDONED_0 + i
      }
    }

    if (timeout === 0) return 0x102; // WAIT_TIMEOUT
    return 0xFFFF; // must wait — yield
  }

  // Instantiate pending threads (async)
  // ---- worker backend (docs/design-real-threads.md phase 2) -----------------
  //
  // The cooperative backend below and this one share everything that is
  // bookkeeping — handles, the sync table, exit codes, suspend counts — because
  // all of it lives in JS or in shared memory. What differs is where the guest's
  // instructions execute: there, in an instance on this thread; here, in a
  // Worker that runs while this thread is doing something else.
  //
  // waitSingle/waitMultiple therefore need no changes at all: they read the sync
  // table out of shared memory and consult `this.threads`, and a worker-backed
  // thread is a record in exactly the same map.

  // PE metadata comes from the guest's MAIN thread, not from this.mainInstance,
  // and must be read for every spawn rather than cached at the first thread:
  // in worker mode the main-thread instance never loaded the image, so its
  // $image_base, $code_start and thunk globals are all zero. Meanwhile the real
  // guest Worker can advance dll_count, the thunk cursor and TLS index between
  // CreateThread calls. Reusing T1's snapshot initialized Diablo's later Storm
  // worker with pre-game state and made every async MPQ read report EOF.
  async _workerPeMeta() {
    const v = await this.workerBackend.readExports([
      'get_image_base', 'get_code_start', 'get_code_end',
      'get_thunk_base', 'get_thunk_end', 'get_num_thunks',
      'get_dll_count', 'get_vlan_local_ip', 'get_tls_next_index',
    ]);
    this._peMeta = {
      imageBase: v.get_image_base | 0,
      codeStart: v.get_code_start | 0,
      codeEnd: v.get_code_end | 0,
      thunkBase: v.get_thunk_base | 0,
      thunkEnd: v.get_thunk_end | 0,
      numThunks: v.get_num_thunks | 0,
      dllCount: v.get_dll_count | 0,
      vlanIp: v.get_vlan_local_ip | 0,
      tlsNextIndex: v.get_tls_next_index | 0,
    };
    return this._peMeta;
  }

  async _spawnPendingWorkers() {
    const main = this.mainInstance.exports;
    for (const pending of this._pendingThreads) {
      const meta = await this._workerPeMeta();
      let link = null;
      try {
        link = await this.workerBackend.spawnThread({
          tid: pending.tid,
          imageBase: meta.imageBase,
          codeStart: meta.codeStart,
          codeEnd: meta.codeEnd,
          thunkBase: meta.thunkBase,
          thunkEnd: meta.thunkEnd,
          numThunks: meta.numThunks,
          dllCount: meta.dllCount,
          vlanIp: meta.vlanIp,
          tlsNextIndex: meta.tlsNextIndex,
          loadedDlls: this._loadedDlls.map(dll => ({
            loadAddr: dll.loadAddr >>> 0,
            dllMain: dll.dllMain >>> 0,
          })),
          stackSize: pending.stackSize,
          param: pending.param,
          startAddr: pending.startAddr,
          // Same per-thread hwnd partition the cooperative backend uses: without
          // it a worker's stub dialog hwnd collides with the main window and the
          // renderer entry gets clobbered.
          hwndBase: this.workerHwndBase(pending.tid),
          wasmGlobals: this._workerWasmGlobals(main),
        });
      } catch (err) {
        this._log(`[ThreadManager] worker spawn for tid ${pending.tid} failed: ${err.message}`);
        continue;
      }
      const activeThread = {
        link,
        stackAlloc: (link && link.stackMapped) >>> 0,  // released when the slot is reused
        state: 'active',
        tid: pending.tid,
        startAddr: pending.startAddr >>> 0,
        param: pending.param >>> 0,
        creationFlags: pending.creationFlags >>> 0,
        suspendCount: pending.suspendCount || 0,
        priority: pending.priority | 0,
        locale: (pending.locale || 0x0409) >>> 0,
        comApartment: pending.comApartment | 0,
        comInitCount: pending.comInitCount >>> 0,
        sleepCount: 0,
        sleepUntil: 0,
        waitPolls: 0,
        waitStartedAt: 0,
        inFlight: false,
      };
      this.threads.set(pending.handle, activeThread);
      // A duplicate can be created while the worker is still pending. Retarget
      // it to the live record so suspend counts and priority stay shared after
      // the pending object is released below, just as in cooperative mode.
      for (const [alias, target] of this._threadHandleAliases) {
        if (target === pending) this._threadHandleAliases.set(alias, activeThread);
      }
      this._slotToHandle.set(link.slot | 0, pending.handle);
      this._spawnedCount++;
      this._log(`[ThreadManager] spawned WORKER thread ${pending.tid} handle=0x${pending.handle.toString(16)} `
        + `slot=${link.slot} EIP=0x${pending.startAddr.toString(16)}`);
      this._emitThreadEvent('spawn', {
        handle: pending.handle >>> 0,
        tid: pending.tid | 0,
        startAddr: pending.startAddr >>> 0,
        creationFlags: pending.creationFlags >>> 0,
        suspendCount: (pending.suspendCount || 0) >>> 0,
        eip: link.startEip >>> 0,
        esp: link.startEsp >>> 0,
        backend: 'worker',
      });
    }
    this._pendingThreads = [];
  }

  // Run one slice on every runnable worker-backed thread, all at once. There is
  // no quantum, no wall-clock budget and no round-robin here on purpose: those
  // exist in the cooperative backend because one JS thread has to be shared, and
  // that is the constraint this backend removes.
  //
  // Returns how many threads were given a slice, so a caller can tell "nothing
  // to run" from "everything is parked".
  // `workerLocalSleep` ({ epoch, maxMs } or null), set by the host for the
  // current step: each thread's Worker waits out a short Sleep itself and keeps
  // its slice until the host ends the step epoch (lib/guest-worker.js).
  async runWorkerSlices(sliceSize) {
    this.lastWorkerSliceBlocks = 0;
    if (!this.workerBackend) return 0;
    if (this._pendingThreads.length) await this._spawnPendingWorkers();
    const now = this._waitNow();
    const runnable = [];
    const skipped = [];
    for (const [handle, thread] of this._threadEntries()) {
      // "Why did this thread not get a slice?" is the first question in worker
      // mode and the hardest to answer from the outside, so the filter reports
      // its own decision rather than leaving a silent thread to be inferred from
      // a slice count at the end of the run.
      const reason = this._workerSkipReason(thread, now, !!this.workerLocalSleep);
      if (reason) { skipped.push(`T${thread.tid}:${reason}`); continue; }
      runnable.push([handle, thread]);
    }
    if (this._traceThread && skipped.length) {
      const sig = skipped.join(' ');
      if (sig !== this._lastSkipSig) {
        this._lastSkipSig = sig;
        this._log(`[ThreadManager] no slice this batch: ${sig}`);
      }
    }
    if (!runnable.length) return 0;
    const sync = this.workerSyncState();
    const localSleep = this.workerLocalSleep;
    if (this.workerFreeRun && !this.serialSlices) {
      // Free-running (host arm f): dispatch and do not wait. Each thread's
      // result is handled when it arrives, and a thread still inside its slice
      // is skipped above as 'inflight' -- so a thread that sleeps through its
      // slice keeps running while the page presents, lays out or stalls,
      // instead of standing still until the next host step hands it a turn.
      this._freeRunLocalSleep = localSleep;
      this._freeRunStepAt = now;
      this._freeRunSliceSize = sliceSize;
      for (const [handle, thread] of runnable) this._freeRunDispatch(handle, thread, sliceSize, sync);
      this.lastWorkerSliceBlocks = this._freeRunBlocks || 0;
      this._freeRunBlocks = 0;
      return runnable.length;
    }
    if (this.serialSlices) {
      // One thread at a time — the same switch the browser has as
      // `?threads-serial`. It exists to answer one question and answer it fast:
      // a symptom that survives serialisation is per-thread state (an instance
      // global that was never propagated), and one that disappears is a race
      // (usually the guest's own, since EnterCriticalSection excludes nothing).
      for (const [handle, thread] of runnable) {
        await this._runWorkerThread(handle, thread, sliceSize, sync, localSleep);
      }
    } else {
      await Promise.all(runnable.map(([handle, thread]) =>
        this._runWorkerThread(handle, thread, sliceSize, sync, localSleep)));
    }
    this.lastWorkerSliceBlocks = runnable.reduce((sum, [, thread]) => sum + (thread.lastRunBlocks || 0), 0);
    return runnable.length;
  }

  // Why a worker-backed thread gets no slice now (null: it may run). With
  // `localSleepOk` its Worker may wait out the rest of a local Sleep itself.
  _workerSkipReason(thread, now, localSleepOk) {
    return (thread.state !== 'active' || !thread.link) ? thread.state
      : (thread.inFlight || thread.freeRunPending) ? 'inflight'  // still executing its last slice
      : thread.link._waveOffer ? 'wave-callback-offer'
      : thread.link.threadSendDepth > 0 ? 'send-callback'
      : thread.suspendCount > 0 ? 'suspended'
      : (thread.sleepUntil && now < thread.sleepUntil)
        ? `sleep(${thread.sleepUntil - now}ms)`
        // The rest of a Sleep a Worker was waiting out locally: only a Worker
        // that may wait it out again (arm w on this step) gets the slice.
        : (!localSleepOk && thread.localSleepUntil && now < thread.localSleepUntil)
          ? `sleep(${thread.localSleepUntil - now}ms)`
          : (thread.parkedWait && !this._pollParkedWait(thread)) ? 'wait'
          : null;
  }

  // A worker parked on an unsatisfied WaitFor* (yield 1) has nothing to run: its
  // next slice would return at once with the same yield, and the only work in
  // that round trip is resolveWait, which runs here on the page anyway. So the
  // wait stays with the page and is polled here, and the thread is handed a
  // slice only once it is satisfied. Free-running, that round trip used to
  // repeat as fast as postMessage allowed -- ~10k empty slices a second per
  // waiting thread (StarCraft: three of them). Returns true once satisfied; the
  // result is held for _runWorkerThread to complete, because resolveWait has
  // already consumed the signal (an auto-reset event, a semaphore count).
  _pollParkedWait(thread) {
    if (!thread.parkedWaitDone) {
      thread.parkedWaitDone = this.resolveWait(thread.parkedWait, thread,
        { threadId: ((thread.tid || 0) | 0) + 1 });
    }
    return !!thread.parkedWaitDone;
  }

  // Free-run (host arm f): one slice, not awaited. When it returns, the thread
  // is handed its next slice at once if it may run -- not at the next host
  // step, which is the point: a thread sleeping through its slices keeps its
  // own cadence while the page presents, lays out or stalls. A page whose steps
  // stopped (paused or ended) ends the chain after FREE_RUN_STEP_STALE_MS; the
  // next step starts it again.
  _freeRunDispatch(handle, thread, sliceSize, sync) {
    // Set before the first await inside _runWorkerThread, so a step cannot hand
    // the same thread a second slice.
    thread.freeRunPending = true;
    this._runWorkerThread(handle, thread, sliceSize, sync, this._freeRunLocalSleep)
      .catch(err => this._log(`[ThreadManager] worker thread ${thread.tid} slice: ${err && err.message}`))
      .finally(() => {
        thread.freeRunPending = false;
        this._freeRunBlocks = (this._freeRunBlocks || 0) + (thread.lastRunBlocks || 0);
        const wake = this._sliceDoneWake;
        this._sliceDoneWake = null;
        if (wake) wake();
        const now = this._waitNow();
        if (this.workerFreeRun && !this.serialSlices && this.threads.get(handle) === thread
            && now - (this._freeRunStepAt || 0) < FREE_RUN_STEP_STALE_MS
            && !this._workerSkipReason(thread, now, true)) {
          this._freeRunDispatch(handle, thread, sliceSize, this.workerSyncState());
        }
        // This slice may have signalled what another thread is parked on
        // (SetEvent, ReleaseSemaphore, its own exit). Waiters are not re-sliced
        // to find out, so offer them their slice now rather than at the next
        // page step.
        this.offerSatisfiedWaiters(thread);
      });
  }

  // Free-run: hand a slice to every thread parked on a wait that is now
  // satisfied. Called when any slice returns -- a sibling's here, the main
  // thread's from host.js -- since that slice may have signalled the wait.
  // Without the main-thread call, a thread the main thread just woke (Storm's
  // read thread, handed a job by SFileReadFile) sat parked until the next page
  // step scanned it, and the main thread waited that step out on every read.
  offerSatisfiedWaiters(except) {
    if (!this.workerFreeRun || this.serialSlices || !this._freeRunSliceSize) return 0;
    const now = this._waitNow();
    if (now - (this._freeRunStepAt || 0) >= FREE_RUN_STEP_STALE_MS) return 0;
    let n = 0;
    for (const [h, t] of this.threads) {
      if (t !== except && t.parkedWait && !this._workerSkipReason(t, now, true)) {
        this._freeRunDispatch(h, t, this._freeRunSliceSize, this.workerSyncState());
        n++;
      }
    }
    return n;
  }

  // Free-run mode: resolve when any in-flight thread slice completes, or after
  // `ms`. The host parks on this when a step found nothing to run, rather than
  // spinning steps against threads that are all mid-slice.
  waitForWorkerSlice(ms) {
    let inflight = false;
    for (const [, thread] of this.threads) if (thread.freeRunPending) { inflight = true; break; }
    if (!(ms > 0)) return Promise.resolve(false);
    if (!inflight) return new Promise(resolve => setTimeout(() => resolve(false), ms));
    return new Promise(resolve => {
      const timer = setTimeout(() => { if (this._sliceDoneWake === done) this._sliceDoneWake = null; resolve(false); }, ms);
      const prev = this._sliceDoneWake;
      const done = () => { clearTimeout(timer); if (prev) prev(); resolve(true); };
      this._sliceDoneWake = done;
    });
  }

  // Process-wide state that the WAT keeps in per-instance globals. The main
  // instance is the rendezvous point in both backends: everyone publishes their
  // high-water mark to it after a slice and reads it back before the next one.
  //
  // This is a slice-boundary rendezvous, not a lock, so two instances that both
  // allocate a thunk inside the SAME slice can still collide. The real fix is a
  // process cursor in shared memory, the way the heap got one — it needs the ~30
  // `global.set $num_thunks (+1)` sites reworked to reserve an index first, which
  // is a mechanical change worth doing on its own. Recorded in
  // docs/design-real-threads.md rather than left as a surprise.
  workerSyncState() {
    const main = this.mainInstance.exports;
    return {
      // Per-instance like everything else here, so a threshold set on main means
      // nothing to the threads that actually park unless it rides along.
      csStealAfter: this.csStealAfter || 0,
      dllCount: main.get_dll_count ? main.get_dll_count() | 0 : 0,
      thunkEnd: main.get_thunk_end ? main.get_thunk_end() >>> 0 : 0,
      numThunks: main.get_num_thunks ? main.get_num_thunks() >>> 0 : 0,
    };
  }

  // Fold a slice result's thunk high-water mark back into the main instance, so
  // the next slice hands it to everyone else.
  publishWorkerThunkState(r) {
    if (!r || !r.numThunks) return;
    const main = this.mainInstance.exports;
    if (!main.sync_thunk_state || !main.get_num_thunks) return;
    if ((r.numThunks >>> 0) > (main.get_num_thunks() >>> 0)) {
      main.sync_thunk_state(r.thunkEnd >>> 0, r.numThunks >>> 0);
    }
  }

  async _runWorkerThread(handle, thread, sliceSize, sync, localSleepArg) {
    thread.lastRunBlocks = 0;
    if (thread.link.threadSendDepth > 0) return;
    if (thread.link._waveOffer) return;
    if (thread.renderWait) {
      if (!thread.renderWait.done) return;
      thread.renderWait = null;
      await thread.link.callExport('clear_yield');
    }
    if (thread.parkedWait) {
      // Reached without the skip filter (a nested cross-thread send pumps
      // workers directly), so poll here too; unsatisfied means no slice.
      if (!this._pollParkedWait(thread)) return;
      const r = thread.parkedWait, done = thread.parkedWaitDone;
      thread.parkedWait = thread.parkedWaitDone = null;
      await this._completeWorkerWait(thread, r, done);
    }
    // Same event the cooperative backend emits, for the same reason: it is what
    // proves a CREATE_SUSPENDED thread did not execute before its ResumeThread.
    // Emitting it in only one backend would mean the test that checks that can
    // only be run against one of them.
    if (!thread._firstRunEmitted) {
      thread._firstRunEmitted = true;
      this._emitThreadEvent('first_run', {
        handle: handle >>> 0,
        tid: thread.tid | 0,
        startAddr: thread.startAddr >>> 0,
        creationFlags: (thread.creationFlags || 0) >>> 0,
        suspendCount: (thread.suspendCount || 0) >>> 0,
        eip: (thread.lastEip !== undefined ? thread.lastEip : (thread.link.startEip || 0)) >>> 0,
      });
    }
    thread.inFlight = true;
    let r = null;
    try {
      let localSleep = localSleepArg === undefined ? this.workerLocalSleep : localSleepArg;
      if (localSleep && thread.localSleepUntil) {
        localSleep = Object.assign({}, localSleep,
          { preWaitMs: Math.max(0, thread.localSleepUntil - this._waitNow()) });
      }
      thread.localSleepUntil = 0;
      r = await thread.link.slice(sliceSize, sync || this.workerSyncState(), localSleep);
    } catch (err) {
      this._log(`[ThreadManager] worker thread ${thread.tid} slice failed: ${err.message}`);
      this._markThreadExited(handle, thread, 1, 'worker-error');
      this.workerBackend.dropThread(thread.link);
      return;
    } finally {
      thread.inFlight = false;
    }
    // Worker-side guard covers a send admitted after this slice was selected.
    // This is a skipped turn, not a guest yield or thread exit.
    if (r && r.threadSendPending) return;
    // Where this thread got to, kept on the record so --trace-sched can describe
    // a worker-backed thread without a round trip into another OS thread. Without
    // it the scheduler trace shows only the main thread, which on a hang report is
    // worse than showing nothing — it reads as "no threads are running".
    if (r) {
      thread.lastRunBlocks = !r.trapped && Number.isFinite(r.blocks) ? Math.max(0, r.blocks) : 0;
      thread.lastEip = r.eip >>> 0;
      thread.lastYield = r.yield | 0;
      // Sleeps the Worker waited out inside its slice (host arm w), cumulative.
      thread.localSleeps = r.localSleeps | 0;
      thread.workerSlices = (thread.workerSlices | 0) + 1;
      thread.workerSliceMs = (thread.workerSliceMs || 0) + (Number(r.ms) || 0);
      thread.csWaits = r.csWaits | 0;
      thread.csSteals = r.csSteals | 0;
      thread.csWaitAddr = r.csWaitAddr | 0;
      thread.csWaitOwner = r.csWaitOwner | 0;
      thread.csBadLeaves = r.csBadLeaves | 0;
      thread.csBarges = r.csBarges | 0;
      if (r.uop) thread.uop = r.uop;
      // --esp-audit: a handler that left ESP somewhere other than 4*(nargs+1)
      // above where it found it. Reported the first time each API offends,
      // because one bad handler is called thousands of times and the name is
      // the whole finding.
      if (r.espAudit) thread.espAudit = r.espAudit;
      if (r.espAudit && r.espAudit.bad && r.espAudit.bad.length) {
        for (const b of r.espAudit.bad) {
          const key = `${thread.tid}:${b.name}`;
          if (!this._espAuditSeen) this._espAuditSeen = new Set();
          if (this._espAuditSeen.has(key)) continue;
          this._espAuditSeen.add(key);
          this._log(`[esp-audit] T${thread.tid} ${b.name} moved ESP by ${b.delta}, `
            + `expected ${b.expected} (esp=0x${(b.esp >>> 0).toString(16)} `
            + `eip=0x${(b.eip >>> 0).toString(16)})`);
        }
      }
      thread.csBadLeaveAddr = r.csBadLeaveAddr | 0;
      thread.csBadLeaveOwner = r.csBadLeaveOwner | 0;
    }

    if (!r || thread.state !== 'active') return;  // exited under us (ExitThread)

    if (r.trapped) {
      // The slice reply already carries the registers on a trap; printing only
      // EIP throws away the one thing that matters when EIP is the symptom.
      // Where it jumped FROM is prev_eip, and the section counters say whether
      // the thread had been fighting for a lock on its way here.
      const g = r.regs || {};
      const h = v => `0x${(v >>> 0).toString(16)}`;
      this._log(`[ThreadManager] worker thread ${thread.tid} trapped at EIP=${this._describeAddr(r.eip)}: ${r.trapped}`
        + (r.regs ? `\n  prev_eip=${this._describeAddr(g.prevEip)} prev2_eip=${this._describeAddr(g.prev2Eip)} esp=${h(g.esp)} ebp=${h(g.ebp)} eax=${h(g.eax)} `
          + `ebx=${h(g.ebx)} ecx=${h(g.ecx)} edx=${h(g.edx)} esi=${h(g.esi)} edi=${h(g.edi)}` : '')
        + `\n  csPark=${r.csWaits | 0} csSteal=${r.csSteals | 0}`
        // Where the thread was born. A thread executing blank memory either
        // started at a bad address or called through a bad pointer, and this is
        // the one line that tells the two apart.
        + `\n  startEip=${this._describeAddr(thread.link.startEip || 0)}`
        // Where ESP sits relative to the stack this thread was given. Below it
        // is an overflow: the thread has been writing over whatever is under its
        // stack, and its own return addresses are the first casualties. That
        // reads as a corrupted return with no bad pointer anywhere near the
        // crash, so it is worth one comparison here.
        + (thread.link.stackBase
          ? `\n  stack=0x${(thread.link.stackBase >>> 0).toString(16)}-`
            + `0x${(thread.link.stackTop >>> 0).toString(16)} `
            + `esp is ${(g.esp >>> 0) < (thread.link.stackBase >>> 0) ? 'BELOW IT (overflow)'
              : (g.esp >>> 0) > (thread.link.stackTop >>> 0) ? 'above it'
              : `inside, ${((g.esp >>> 0) - (thread.link.stackBase >>> 0))} bytes of headroom left`}`
          : '')
        + this._trapFrameWalk(thread, g));
      this._markThreadExited(handle, thread, 1, 'trap');
      this.workerBackend.dropThread(thread.link);
      return;
    }

    // A thread that allocated thunks moved the end of a zone every instance
    // shares. Publish it so the next slice hands the new mark to everyone.
    this.publishWorkerThunkState(r);

    if (r.yield === 2 || !r.eip) {
      this._markThreadExited(handle, thread, thread.exitCode, r.yield === 2 ? 'yield=2' : 'eip=0');
      this._log(`[ThreadManager] worker thread ${thread.tid} exited (${r.yield === 2 ? 'yield=2' : 'eip=0'})`);
      // EIP 0 without ExitThread is a return into the thread's zero return
      // address or a call through NULL; say where from, as the cooperative
      // backend does (Thread N EIP=0 ... prev_eip=).
      const g = r.regs;
      if (r.yield !== 2 && g) {
        const h = v => '0x' + ((v >>> 0).toString(16));
        this._log(`[ThreadManager]   EIP=0 prev_eip=${this._describeAddr ? this._describeAddr(g.prevEip) : h(g.prevEip)} `
          + `prev2_eip=${h(g.prev2Eip)} esp=${h(g.esp)} eax=${h(g.eax)} ebx=${h(g.ebx)} ecx=${h(g.ecx)} `
          + `edx=${h(g.edx)} esi=${h(g.esi)} edi=${h(g.edi)} ebp=${h(g.ebp)}`);
      }
      this.workerBackend.dropThread(thread.link);
      return;
    }

    if(thread.waveWaitSaved && !r.waveCallbackActive) {
      Object.assign(thread,thread.waveWaitSaved);thread.waveWaitSaved=null;
    }
    if (r.yield === 1) {
      const done = this.resolveWait(r, thread, { threadId: ((thread.tid || 0) | 0) + 1 });
      if (done) await this._completeWorkerWait(thread, r, done);
      else thread.parkedWait = r;  // polled on the page; see _pollParkedWait
      return;
    }
    if (r.yield === 7) {
      // Keep the live WaitMessage/GetMessage frame parked. At the top of the
      // next Worker slice resumeMessageWait checks both the instance's USER
      // queue and the process-shared browser-input marker, and completes the
      // frame only when one is ready. Clearing here used to re-enter the API on
      // every scheduler turn, turning an idle Win32 message wait into a poll.
      return;
    }
    if (r.yield === 9) {
      // Critical section held elsewhere. Clearing re-enters the same call; the
      // other threads in this round get their slice either way.
      await thread.link.callExport('clear_yield');
      return;
    }
    if (r.yield === 8) {
      // net_wait: EIP is still on the thunk, so clearing the yield re-enters the
      // same call once the wire has moved. Frames arrive on the host event loop,
      // so the caller has to give it a turn — that is what netWaitPending says.
      await thread.link.callExport('clear_yield');
      try { await thread.link.callExport('vlan_pump'); } catch (_) {}
      this.netWaitPending = true;
      return;
    }
    if (r.yield === 10) {
      const toMain = (r.sendTargetTid | 0) === 1 && this.workerBackend.mainAtMessagePoint;
      // A send to the main thread waits until main is inside a message call
      // (guest-thread-host mainAtMessagePoint). Leave this thread parked and
      // ask main's next message call to stop; a later round delivers it. Never
      // wait here: this round is what keeps main from running.
      if (toMain && !(await this.workerBackend.mainAtMessagePoint())) {
        thread.mainSendDeferred = true;
        await this.workerBackend.armMainIncomingSend();
        return;
      }
      thread.mainSendDeferred = false;
      await this.workerBackend.resolveThreadSend(thread.link, {
        targetTid: r.sendTargetTid | 0,
        hwnd: r.sendHwnd | 0, msg: r.sendMsg | 0,
        wparam: r.sendWparam | 0, lparam: r.sendLparam | 0,
        postKind: r.sendPostKind | 0,
      });
      if (toMain && !this.hasDeferredMainSends()) await this.workerBackend.releaseMainMessagePoint();
      return;
    }
    if (r.yield === 11) {
      // See the cooperative branch: once another thread has resumed this
      // worker, clear the private self-suspend yield before its next slice.
      await thread.link.callExport('clear_yield');
      return;
    }
    if ((r.yield === 3 || r.yield === 5) && this._resolveThreadSendExternalYield) {
      // A normal worker slice can request the same asynchronous COM/LoadLibrary
      // host work as a nested cross-thread SendMessage frame. The nested path
      // already used this callback; omitting it here left installer extraction
      // workers permanently parked at the first plug-in DLL they loaded.
      await this._resolveThreadSendExternalYield(thread.link, r);
      await this._publishLinkLoaderState(thread.link);
      return;
    }
    if (r.yield === 16) {
      this._startRenderWait(thread, r.renderToken, thread);
      return;
    }
    if (r.yield === 12) {
      // io_wait: this thread's brokered ReadFile hit a provider-backed chunk
      // that is not resident (a mounted ISO read through the async File API).
      // Select only this guest thread's request, never a peer's last import.
      const vfs = this._getVfs();
      const pending = vfs && vfs.getPendingRead((thread.tid | 0) + 1);
      if (pending) {
        try { await this._fillIoRead(vfs, pending); }
        catch (e) { this._log(`[io] T${thread.tid} ${pending.path}: ${e && e.message}`); }
      }
      await thread.link.callExport('clear_yield');
      return;
    }
    if (r.yield === 13) {
      // vblank_wait: this thread called IDirectDraw::WaitForVerticalBlank.
      // EIP is on the thunk, so clearing re-enters the same call, which
      // re-tests the model and completes once the display has moved on. The
      // main instance is the one the host arms a requestAnimationFrame for
      // (host.js _awaitVblank); a worker just retries against the same clock,
      // which is what keeps it from falling through to a thread abort.
      await thread.link.callExport('clear_yield');
      return;
    }
    if (r.yield === 17) {
      // Only the cooperative scheduler raises incoming_send_pending, so a
      // Worker instance should never park here; if one does, re-run the call
      // rather than throw the thread away.
      await thread.link.callExport('clear_yield');
      return;
    }
    if (r.yield === 14 || r.yield === 15) {
      // A spin park (clock / empty message queue) on a guest thread. The
      // detector state lives in that thread's own instance globals, so this is
      // its own spin and not the main thread's. Clearing re-enters the same
      // call, which re-reads the clock or the queue on the next slice — the
      // slice boundary is this thread's sleep. Falling through to 'abort'
      // would throw a worker away over a busy-wait.
      await thread.link.callExport('clear_yield');
      return;
    }
    if (r.sleepLeftMs > 0) {
      // Still inside a Sleep the Worker was waiting out when the step ended.
      thread.localSleepUntil = this._waitNow() + r.sleepLeftMs;
      thread.sleepUntil = 0;
      thread.sleepCount++;
    } else if (r.sleepYielded) {
      thread.sleepUntil = r.sleepMs ? this._waitNow() + r.sleepMs : 0;
      thread.sleepCount++;
    } else {
      thread.sleepUntil = 0;
      thread.sleepCount = 0;
    }
  }

  // Resolve a wait a worker parked on, from the wait parameters its slice result
  // carried. Runs here, on the main thread, because the sync table bookkeeping
  // (auto-reset events, semaphore counts, thread-exit handles) is shared and
  // single-owner. Returns null while the wait is unsatisfied.
  //
  // NOT COMPLETING A PARKED WAIT IS NOT A NO-OP, which is the trap this exists to
  // avoid. $run pops the saved return address whenever a handler leaves EIP
  // alone, so by the time the yield is visible the guest's EIP is already past
  // the call — with the stdcall arguments still on the stack. Completing the wait
  // is what drops them. "Just clear the yield and let it re-poll" leaks 12 bytes
  // of guest stack per wait, and the app dies later, somewhere else, at
  // EIP=0xffffffff.
  resolveWait(r, state, opts) {
    opts = opts || {};
    const threadId = (opts.threadId | 0) || 1;
    const waitStackBytes = r.waitStackBytes || (r.waitHandlesPtr ? 20 : 12);
    const hasMessage = () => (this._hasMessage ? !!this._hasMessage() : false);
    let result;
    if (waitStackBytes === 24 && !r.waitHandlesPtr) {
      // MsgWaitForMultipleObjects: input satisfies it as well as the object does.
      result = hasMessage() ? r.waitHandle : 0xFFFF;
    } else if (r.waitHandlesPtr) {
      // An ordinary WaitForMultipleObjects is never message-aware. Treating a
      // queued paint/input message as WAIT_OBJECT_0+nCount wakes the caller
      // while every requested object may still be unsignaled.
      result = this.waitMultiple(r.waitHandle, r.waitHandlesPtr, !!r.waitAll, 0, threadId);
    } else {
      result = this.waitSingle(r.waitHandle, 0, threadId);
    }
    if (result === 0xFFFF || result === 0x102) {
      const timeout = r.waitTimeout >>> 0;
      const syncIdx = r.waitHandlesPtr ? -1 : this._getSyncIdx(r.waitHandle);
      if (opts.main && !this.hasActiveThreads() && timeout === 0xFFFFFFFF
          && syncIdx >= 0 && this.syncView[syncIdx * 4 + 1] === 1) {
        // Nobody is left who could signal this event, so waiting forever is a
        // hang rather than a wait. Same escape the cooperative main path takes.
        result = 0;
      } else if (timeout !== 0 && timeout !== 0xFFFFFFFF) {
        const now = opts.wallClock ? Date.now() : this._waitNow();
        if (!state.waitStartedAt) state.waitStartedAt = now;
        // Keep the isolated-Worker path consistent with checkMainYield's
        // cooperative bounded-wait rule. The guest clock can advance by more
        // than a short timeout in one host round, even though a decompressor
        // Worker received only one slice. Storm waits 255ms for MPQ jobs and
        // treats WAIT_TIMEOUT as a usable short read; completing that timeout
        // after one or two slices feeds partial data to D2CMP. While the main
        // guest has runnable workers, require a bounded number of scheduler
        // polls as well as elapsed guest time. A signal still wins immediately.
        const minPolls = opts.main && this.hasActiveThreads()
          ? Math.min(1024, Math.max(4, timeout))
          : 0;
        if ((now - state.waitStartedAt) < timeout || (state.waitPolls || 0) < minPolls) {
          state.waitPolls = (state.waitPolls || 0) + (opts.pollWeight || 1);
          return null;
        }
        result = 0x102;                            // WAIT_TIMEOUT
      } else {
        state.waitPolls++;
        return null;                               // still waiting; re-poll next slice
      }
    }
    state.waitPolls = 0;
    state.waitStartedAt = 0;
    return { result, waitStackBytes };
  }

  // The guest MAIN thread's wait, in worker mode. host.js drives slot 0, so it
  // asks for the decision and applies it to that worker.
  //
  // `parked`: host.js is polling a wait it holds on the page (arm m) instead of
  // re-slicing the Worker. The poll floor above assumed ~1 poll per ms, which
  // held while an unsatisfied wait cost a Worker round trip each time; polled
  // from a parked step it comes far less often, and StarCraft's 50ms
  // WaitForMultipleObjects took ~110ms to time out. Weight each parked poll by
  // the wall time since the previous one, so the floor still means "this much
  // real time with the siblings running beside it" and a guest-clock jump
  // still cannot expire the wait early.
  resolveMainWorkerWait(r, opts) {
    if (!this._mainWaitState) this._mainWaitState = { waitPolls: 0, waitStartedAt: 0 };
    const state = this._mainWaitState;
    const wall = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const pollWeight = opts && opts.parked && state.lastPollAt
      ? Math.max(1, Math.floor(wall - state.lastPollAt)) : 1;
    const done = this.resolveWait(r, state, { main: true, threadId: 1, pollWeight });
    state.lastPollAt = done ? 0 : wall;
    return done;
  }

  async _completeWorkerWait(thread, r, done) {
    const { result, waitStackBytes } = done;
    const woke = await thread.link.completeWait(result, waitStackBytes);
    if (woke && woke.rewrote) {
      // See the note in guest-worker.js: the stack's return address was
      // rejected and guessed at. Rare and load-bearing, so it is never silent.
      this._log(`[wait-resume] T${thread.tid} return address rewritten `
        + `${this._describeAddr(woke.rewrote.from)} -> ${this._describeAddr(woke.rewrote.to)}`);
    }
    if (this._traceThread) {
      this._log(`[ThreadManager] worker thread ${thread.tid} resumed from wait, `
        + `handle=0x${(r.waitHandle >>> 0).toString(16)} result=0x${(result >>> 0).toString(16)}`);
    }
  }

  async _pumpWorkersForThreadSend(activeLinks) {
    if (!this.workerBackend) return 0;
    const work = [];
    const sync = this.workerSyncState();
    for (const [handle, thread] of this.threads) {
      if (thread.state !== 'active' || thread.suspendCount > 0 || thread.inFlight) continue;
      if (activeLinks && activeLinks.has(thread.link)) continue;
      work.push(this._runWorkerThread(handle, thread, 20000, sync));
    }
    if (work.length) await Promise.all(work);
    return work.length;
  }

  // A WndProc entered for cross-thread SendMessage can block just like ordinary
  // guest code. Resolve the same yield protocol without abandoning the nested
  // interpreter frame; while an object/message wait is unsatisfied, give every
  // unrelated Worker a slice so a third thread can signal it.
  async resolveThreadSendYield(link, r, state, activeLinks) {
    const isMain = !!(this.workerBackend
      && (link === this.workerBackend.link || link === this.workerBackend._localLink));
    if (r.yield === 16) {
      const wait = this._startRenderWait(state, r.renderToken, link);
      if (!wait.done) {
        await this._pumpWorkersForThreadSend(activeLinks);
        return 'pending';
      }
      state.renderWait = null;
      await link.callExport('clear_yield');
      return 'resume';
    }
    if (r.yield === 1) {
      const done = this.resolveWait(r, state, {
        main: isMain,
        wallClock: true,
        threadId: isMain ? 1 : (((state && state.tid) || 0) | 0) + 1,
      });
      if (done) {
        await link.completeWait(done.result, done.waitStackBytes);
        return 'resume';
      }
      await this._pumpWorkersForThreadSend(activeLinks);
      return 'pending';
    }
    if (r.yield === 7) {
      const resumed = await link.resumeThreadSendMessageWait(this._hasPendingMessage(null));
      if (resumed && resumed.resumed) return 'resume';
      state.waitPolls++;
      await this._pumpWorkersForThreadSend(activeLinks);
      return 'pending';
    }
    if (r.yield === 8) {
      await link.callExport('clear_yield');
      try { await link.callExport('vlan_pump'); } catch (_) {}
      this.netWaitPending = true;
      await this._pumpWorkersForThreadSend(activeLinks);
      await new Promise(resolve => setTimeout(resolve, 0));
      return 'resume';
    }
    if (r.yield === 9) {
      await link.callExport('clear_yield');
      await this._pumpWorkersForThreadSend(activeLinks);
      return 'resume';
    }
    if (r.yield === 6) {
      await this._pumpWorkersForThreadSend(activeLinks);
      await new Promise(resolve => setTimeout(resolve, 0));
      return 'resume';
    }
    if ((r.yield === 3 || r.yield === 5) && this._resolveThreadSendExternalYield) {
      const resolved = await this._resolveThreadSendExternalYield(link, r);
      await this._publishLinkLoaderState(link);
      return resolved === false ? 'abort' : 'resume';
    }
    if (r.yield === 12) {
      // io_wait inside a nested frame: same service as the ordinary worker
      // slice — fill the pending provider chunk and re-enter the ReadFile.
      // 'abort' here would throw the thread away over a cache miss.
      const vfs = this._getVfs();
      const pending = vfs && vfs.getPendingRead(isMain ? 1 : ((state.tid | 0) + 1));
      if (pending) {
        try { await this._fillIoRead(vfs, pending); } catch (_) {}
      }
      await link.callExport('clear_yield');
      return 'resume';
    }
    if (r.yield === 13) {
      // vblank_wait inside a nested frame — same service as the ordinary
      // worker slice. 'abort' would throw the thread away over a frame wait.
      await link.callExport('clear_yield');
      return 'resume';
    }
    if (r.yield === 14 || r.yield === 15) {
      // A spin park inside a nested frame — same service as the ordinary
      // worker slice above. 'abort' would throw the thread away over a
      // busy-wait it was going to leave on its own.
      await link.callExport('clear_yield');
      return 'resume';
    }
    return 'abort';
  }

  spawnPending() {
    if (this.workerBackend) return this._spawnPendingWorkers();
    for (const pending of this._pendingThreads) {
      const tid = pending.tid;
      const imports = this.makeImports(tid);
      const instance = this._instantiateCooperative(this.module, imports);
      if (imports && typeof imports.__setInstance === 'function') {
        imports.__setInstance(instance);
      }

      // Get PE metadata from main instance
      const main = this.mainInstance.exports;
      instance.exports.init_thread(
        tid,
        main.get_image_base(),
        main.get_code_start(),
        main.get_code_end(),
        main.get_thunk_base(),
        main.get_thunk_end(),
        main.get_num_thunks(),
        main.get_rsrc_rva ? main.get_rsrc_rva() : 0
      );
      // DLL metadata lives in shared memory, but dll_count is a per-instance
      // global. Worker LoadLibrary/GetProcAddress must see the main thread's
      // loaded DLL table, especially for Winamp visualization plug-ins.
      if (main.get_dll_count) {
        const dllCount = main.get_dll_count() | 0;
        if (instance.exports.set_dll_count) instance.exports.set_dll_count(dllCount);
        else if (instance.exports.test_set_dll_count) instance.exports.test_set_dll_count(dllCount);
      }
      // The virtual LAN room address is a property of the process, not of one
      // thread. The socket table itself lives in shared memory, but the local
      // address is a per-instance global, so a worker that opens a socket
      // would otherwise send frames from address 0. Liquid War connects to its
      // server on a worker thread, so this is the normal case, not a corner.
      if (main.get_vlan_local_ip && instance.exports.set_vlan_local_ip) {
        instance.exports.set_vlan_local_ip(main.get_vlan_local_ip() | 0);
      }

      // Set up thread stack in shared memory
      // Allocate stack space from main heap (guest addresses)
      const stackSize = pending.stackSize;
      // Above the main thread's stack, as Win9x's VirtualAlloc'd thread
      // stacks are: a single-threaded Watcom CRT judges every thread's ESP
      // against the main thread's floor (guest_stack_alloc in 13-exports.wat).
      const mappedStack = main.guest_stack_alloc ? main.guest_stack_alloc(stackSize) >>> 0 : 0;
      const stackBase = (mappedStack || main.guest_alloc(stackSize)) >>> 0;
      const stackTop = stackBase + stackSize;

      // Zero the stack — Windows zero-fills new stack pages
      this._zeroGuestRange(stackBase, stackSize);

      // Set ESP to top of stack
      instance.exports.set_esp(stackTop);

      // Push parameter and return address (ExitThread thunk) onto stack
      // Push parameter
      instance.exports.set_esp(stackTop - 4);
      instance.exports.guest_write32(stackTop - 4, pending.param);
      // Push return address = 0 (will halt thread when it returns)
      instance.exports.set_esp(stackTop - 8);
      instance.exports.guest_write32(stackTop - 8, 0);

      // Set EIP to thread start function
      instance.exports.set_eip(pending.startAddr);

      // Partition hwnd allocator per-thread. Without this, T1 reuses main's
      // range — when a worker thread calls e.g. PrintDlgA the stub dialog
      // hwnd collides with the main window and the renderer entry gets
      // clobbered (size, title). Same shape as the thread-cache fix.
      //
      // The slices are carved out of THIS APP's range, not the whole hwnd
      // space. They used to be `0x10001 + tid * 0x10000`, which ignored the
      // app entirely, and two things fell out of that. A worker window of the
      // app based at 0x10001 got 0x20001 -- outside its own owner's range, so
      // _removeAppWindows left it in the renderer forever when the app
      // closed, and the repaint that follows a stop then saw a live window
      // and put the page back into exclusive fullscreen over a dead guest:
      // desktop icons hidden, nothing drawing, no way to launch anything.
      // The same range test decides which queued input an instance may take.
      // And the second app's range collided with the first app's T1 outright.
      //
      // Split unevenly on purpose. $next_hwnd only ever counts up, so a slice
      // is a budget of window *creations* for the life of the app, not of
      // windows alive at once -- and the main thread is where nearly all of
      // them happen (every dialog, every control). So main keeps the bottom
      // half of the app's 0x10000, and the fifteen workers divide the top half
      // into 0x800 each, which is far more than a render or audio thread has
      // ever needed.
      instance.exports.set_hwnd_base(this.workerHwndBase(tid));

      // Allocate TIB/FS base and a per-thread TLS slot block. Real Win32 gives
      // each thread its own TIB and TLS values while sharing TLS indexes across
      // the process. Worker WASM instances have their own globals, so make the
      // WAT-visible fs_base/tls_slots point at the blocks allocated here.
      const tib = main.guest_alloc(0x34);
      const tlsSlots = instance.exports.ensure_tls_slots() >>> 0;
      if (!tlsSlots) throw new Error('Unable to allocate thread TLS vector');
      instance.exports.guest_write32(tib, 0xFFFFFFFF); // SEH head = -1
      instance.exports.guest_write32(tib + 4, stackTop);  // stack top
      instance.exports.guest_write32(tib + 8, stackBase);  // stack bottom
      instance.exports.guest_write32(tib + 0x18, tib);     // self pointer
      instance.exports.guest_write32(tib + 0x2c, tlsSlots); // ThreadLocalStoragePointer
      // Win9x process database: shared by every thread, copied from main's TIB.
      instance.exports.guest_write32(tib + 0x30, main.guest_read32(main.get_fs_base() + 0x30));
      if (instance.exports.set_fs_base) instance.exports.set_fs_base(tib);
      if (instance.exports.set_tls_next_index && main.get_tls_next_index) {
        instance.exports.set_tls_next_index(main.get_tls_next_index());
      }
      // Every process configuration global (CPU features, debugger state,
      // counters and decoder switches) is applied from the same declarative
      // call list that initGuestThread receives in the real Worker backend.
      _applyInheritedWasmGlobals(instance.exports, this._workerWasmGlobals(main));

      // Deliberately NOT copying heap_ptr / free_list / heap_sparse_ptr /
      // virtual_alloc_top from main. Those cursors used to be marshalled in
      // before each slice and out after it, which made a per-instance global
      // behave like shared state — but only because exactly one instance ran at
      // a time and JS got to run in between. It breaks in worker mode, where
      // `main` is the idle main-thread instance and the guest actually runs
      // somewhere else, and it cannot work at all once two instances run
      // concurrently. The WAT now reserves a private arena per instance from a
      // cursor in shared memory (see $heap_low_reserve, $virtual_reserve_down),
      // so init_thread's zeroing is the correct state.

      // Loader notifications run on the new thread, with its TIB/TLS already
      // installed, and before the application-supplied start address. Keep the
      // normal start EIP/ESP intact: callDllMain saves and restores both.
      if (this._callDllMain && this._loadedDlls.length) {
        for (const dll of this._loadedDlls) {
          if (!this._dllWantsThreadNotifications(instance.exports, dll)) continue;
          this._callDllMain(instance.exports, dll.loadAddr, dll.dllMain,
            this._quietTM ? null : this._log, { reason: 2, lpReserved: 0 });
        }
        // Whatever DllMain allocated is recorded in the shared cursors, not in
        // main's copy of a global — nothing to publish back. See the note above.
      }

      const activeThread = {
        instance,
        state: 'active',
        tid,
        startAddr: pending.startAddr >>> 0,
        param: pending.param >>> 0,
        creationFlags: pending.creationFlags >>> 0,
        suspendCount: pending.suspendCount || 0,
        priority: pending.priority | 0,
        locale: (pending.locale || 0x0409) >>> 0,
        comApartment: pending.comApartment | 0,
        comInitCount: pending.comInitCount >>> 0,
        fsBase: tib,
        stackAlloc: mappedStack,  // released when the slot is reused
        sleepCount: 0,  // track consecutive Sleep yields for deprioritization
        sleepUntil: 0,
        waitPolls: 0,
        waitStartedAt: 0,
      };
      this.threads.set(pending.handle, activeThread);
      // A duplicate may have been created while this slot was still pending.
      // Keep that handle attached to the instantiated thread object.
      for (const [alias, target] of this._threadHandleAliases) {
        if (target === pending) this._threadHandleAliases.set(alias, activeThread);
      }
      this._spawnedCount++;

      this._log(`[ThreadManager] Spawned thread ${tid} handle=0x${pending.handle.toString(16)} EIP=0x${pending.startAddr.toString(16)} ESP=0x${(stackTop - 8).toString(16)}`);
      this._emitThreadEvent('spawn', {
        handle: pending.handle >>> 0,
        tid: tid | 0,
        startAddr: pending.startAddr >>> 0,
        creationFlags: pending.creationFlags >>> 0,
        suspendCount: pending.suspendCount >>> 0,
        eip: pending.startAddr >>> 0,
        esp: (stackTop - 8) >>> 0,
      });
    }
    this._pendingThreads = [];
  }

  // Run one batch across all active threads, interleaved in small slices.
  // Threads that repeatedly yield via Sleep (idle loops like timer/monitor
  // threads) are deprioritized: they run only every Nth slice, freeing
  // instruction budget for compute-heavy threads (MP3 decode, audio output).
  _startRenderWait(holder, token, thread) {
    token |= 0;
    if (token > -2 || !this._onRenderWait) throw new Error('render_wait requires a valid token and onRenderWait');
    if (holder.renderWait && holder.renderWait.token === token) return holder.renderWait;
    const wait = { token, done:false };
    holder.renderWait = wait;
    let owner = thread;
    if (thread === this.mainInstance.exports || thread === this.workerBackend?.link || thread === this.workerBackend?._localLink)
      owner = this._mainThreadState;
    else for (const candidate of this.threads.values()) {
      if (candidate.link === thread || candidate.instance?.exports === thread) { owner = candidate; break; }
    }
    wait.promise = Promise.resolve().then(() => this._onRenderWait(token, owner))
      .catch(error => { this._log(`[render] readiness failed: ${error && error.message}`); })
      .then(() => { wait.done = true; });
    return wait;
  }

  runSlice(batchSize, options) {
    options = options || {};
    // The cooperative backend only. Worker-backed threads keep a Worker where
    // this expects an instance, and calling e.run() on them would throw halfway
    // through the loop — better to say so than to half-run a batch.
    if (this.workerBackend) {
      throw new Error('ThreadManager.runSlice is the cooperative backend; use runWorkerSlices()');
    }
    const main = this.mainInstance.exports;
    const stats = {
      elapsedMs: 0,
      steps: 0,
      blocks: 0,
      threadsRun: 0,
      hitDeadline: false,
      stoppedForMessage: false,
    };
    const startedAt = this._now();
    const maxWallMs = Number.isFinite(options.maxWallMs) ? Math.max(0, options.maxWallMs) : 0;
    const deadline = maxWallMs > 0 ? startedAt + maxWallMs : 0;
    const finishStats = () => {
      stats.elapsedMs = Math.max(0, this._now() - startedAt);
      this._lastCooperativeRunHadWork = stats.threadsRun > 0;
      return stats;
    };
    const shouldStop = () => {
      if (deadline && this._now() >= deadline) {
        stats.hitDeadline = true;
        return true;
      }
      if (options.stopIfMessagePending && this._hasPendingMessage(main)) {
        stats.stoppedForMessage = true;
        return true;
      }
      return false;
    };
    // Count active non-idle threads to divide budget
    let activeCount = 0;
    for (const [, t] of this.threads) {
      if (t.state === 'active' && !(t.suspendCount > 0)) activeCount++;
    }
    if (!activeCount) return finishStats();
    const requestedQuantum = (options.quantumSteps | 0) > 0 ? (options.quantumSteps | 0) : 0;
    const sliceSize = requestedQuantum || Math.max(1000, Math.floor(batchSize / Math.min(activeCount, 4)));
    const numSlices = Math.ceil(Math.max(0, batchSize | 0) / Math.max(1, sliceSize));
    // Hot waveOut workers still lead often enough to keep buffers filled, but
    // alternating prevents them from consuming every small wall-clock budget.
    const audioPriorityActive = !!(options.prioritizeAudioThreads && this._hasHotAudioThreads());
    const hotFirst = !!(audioPriorityActive && this._audioPriorityNextHotFirst);
    const threadOrderOptions = Object.assign({}, options, { prioritizeAudioThreads: hotFirst });
    if (audioPriorityActive) {
      this._audioPriorityNextHotFirst = !hotFirst;
    } else {
      this._audioPriorityNextHotFirst = true;
    }

    for (let slice = 0; slice < numSlices; slice++) {
      if (shouldStop()) return finishStats();
      for (const [handle, thread] of this._threadEntries(threadOrderOptions)) {
        if (options.onlyThreadHandle &&
            (handle >>> 0) !== (options.onlyThreadHandle >>> 0)) continue;
        if (shouldStop()) return finishStats();
        if (thread.state !== 'active') continue;
        if (thread.suspendCount > 0) continue;
        if (thread.sleepUntil && this._waitNow() < thread.sleepUntil) continue;
        // Deprioritize idle threads: if a thread has called Sleep 3+ times
        // consecutively, only run it every 8th slice to save budget for
        // compute-heavy threads.
        // A thread whose Sleep carried a real duration is already paced by
        // sleepUntil above; demoting it as well only makes it late. Sleep(0)
        // spinners are the idle loops this demotion is for.
        if (thread.sleepCount >= 3 && (slice & 7) !== 0 &&
            !((options.exemptTimedSleepers || this.deadlineClock) && thread.lastSleepMs > 0)) continue;
        if (options.onlyDueSleepers && !(thread.sleepCount > 0 && thread.sleepUntil > 0)) continue;

        const e = thread.instance.exports;
        if (this._renderSendTargets.has(e)) continue;

        // Track state transitions for --trace-thread / --trace-yield
        if (this._traceThread || this._traceYield) {
          const curState = thread.state;
          const yr = e.get_yield_reason();
          const eipNow = e.get_eip();
          const sig = `${curState}|${yr}`;
          if (thread._lastSig !== sig) {
            if (this._traceThread) {
              const desc = yr === 1 ? `wait(h=0x${e.get_wait_handle().toString(16)})` :
                           yr === 2 ? 'exited' :
                           yr === 3 ? 'com_load_dll' :
                           yr === 4 ? 'help_load' :
                           curState;
              this._log(`[thread] T${thread.tid} ${thread._lastSig || 'init'} → ${desc} eip=0x${eipNow.toString(16)}`);
            }
            if (this._traceYield && yr) {
              const name = YIELD_NAMES[yr] || '?';
              const extra = yr === 1 ? ` h=0x${e.get_wait_handle().toString(16)}` : '';
              this._log(`[yield] T${thread.tid} reason=${yr} (${name})${extra} eip=0x${eipNow.toString(16)}`);
            }
            thread._lastSig = sig;
          }
        }

        // Check if thread is waiting
        const yieldReason = e.get_yield_reason();
        if (yieldReason === 7) {
          if (!this._hasPendingMessage(e)) {
            thread.waitPolls++;
            continue;
          }
          thread.waitPolls = 0;
          const retAddr = e.guest_read32 ? e.guest_read32(e.get_esp()) : 0;
          if (e.resume_message_wait && (e.resume_message_wait() | 0)) {
            e.set_eip(retAddr);
          } else {
            continue;
          }
        } else if (yieldReason === 1 && e.apc_wake_wait && (e.apc_wake_wait() | 0)) {
          // An alertable WaitFor*Ex with a user APC queued to this thread: the
          // export abandoned the wait and pointed EIP at the APC routine; the
          // call returns WAIT_IO_COMPLETION after it. Run the thread.
          thread.waitPolls = 0;
          thread.waitStartedAt = 0;
        } else if (yieldReason === 1) {
          const waitHandle = e.get_wait_handle();
          const waitHandlesPtr = e.get_wait_handles_ptr ? e.get_wait_handles_ptr() : 0;
          const waitAll = e.get_wait_all ? !!e.get_wait_all() : false;
          const waitTimeout = e.get_wait_timeout ? (e.get_wait_timeout() >>> 0) : 0xFFFFFFFF;
          const waitStackBytes = e.get_wait_stack_bytes ? (e.get_wait_stack_bytes() | 0) : (waitHandlesPtr ? 20 : 12);
          let result;
          if (waitStackBytes === 24 && !waitHandlesPtr) {
            result = this._hasPendingMessage(e) ? waitHandle : 0xFFFF;
          } else if (waitHandlesPtr) {
            result = this.waitMultiple(
              waitHandle, waitHandlesPtr, waitAll, 0, e.get_current_thread_id()); // nCount is in waitHandle
          } else {
            result = this.waitSingle(waitHandle, 0, e.get_current_thread_id());
          }
          if (result === 0xFFFF || result === 0x102) {
            if (waitTimeout !== 0 && waitTimeout !== 0xFFFFFFFF) {
              const now = this._waitNow();
              if (!thread.waitStartedAt) thread.waitStartedAt = now;
              if ((now - thread.waitStartedAt) >= waitTimeout) {
                result = 0x102;
              } else {
                thread.waitPolls++;
                continue;
              }
            } else {
              thread.waitPolls++;
              continue; // still waiting
            }
          }
          thread.waitPolls = 0;
          thread.waitStartedAt = 0;
          // Signaled — resume thread
          // Stack depends on which API yielded: 12/20/24 bytes for the
          // single/multiple/message-aware wait variants respectively.
          const retAddr = this._completeWait(e, result, waitStackBytes);
          // Unlike the lifecycle lines around it, this one fires on every
          // satisfied wait — a game loop signalling a worker each frame logs
          // it hundreds of thousands of times. It belongs behind the thread
          // trace, not in the default output.
          if (this._traceThread) {
            this._log(`[ThreadManager] Thread ${thread.tid} resumed from wait, handle=0x${waitHandle.toString(16)} ret=0x${retAddr.toString(16)}`);
          }
        } else if (yieldReason === 8) {
          // net_wait: a blocking socket call parked itself. EIP is still on the
          // thunk, so clearing the yield re-enters the same handler with the
          // same arguments once the wire has moved. Give up the slice rather
          // than spinning here — frames arrive on the host event loop.
          e.clear_yield();
          if (e.vlan_pump) e.vlan_pump();
          // Frames arrive on the host event loop, and runSlice is synchronous:
          // spinning here would poll a wire that nothing can refill. Record
          // that a thread is parked so the caller gives the event loop a turn
          // before the next slice — without that, a worker blocked in connect
          // starves the very delivery it is waiting for.
          this.netWaitPending = true;
          thread.waitPolls++;
          continue;
        } else if (yieldReason === 9) {
          // EnterCriticalSection left EIP/ESP on the import thunk. Clear only
          // the yield and retry after another scheduler turn; the owner lives
          // in shared guest memory and LeaveCriticalSection will release it.
          if (this._traceThread && thread.waitPolls < 3) {
            const cs = e.get_wait_handle() >>> 0;
            const esp = e.get_esp() >>> 0;
            this._log(`[ThreadManager] T${thread.tid} critical wait cs=0x${cs.toString(16)} ` +
              `lock=${e.guest_read32((cs + 4) >>> 0) | 0} recursion=${e.guest_read32((cs + 8) >>> 0) >>> 0} ` +
              `owner=${e.guest_read32((cs + 12) >>> 0) >>> 0} tid=${e.get_current_thread_id() >>> 0} ` +
              `eip=0x${e.get_eip().toString(16)} esp=0x${esp.toString(16)} ` +
              `stack=[0x${(e.guest_read32(esp) >>> 0).toString(16)},0x${(e.guest_read32((esp + 4) >>> 0) >>> 0).toString(16)},0x${(e.guest_read32((esp + 8) >>> 0) >>> 0).toString(16)}]`);
          }
          e.clear_yield();
          thread.waitPolls++;
          continue;
        } else if (yieldReason === 11) {
          // A resumed self-suspended thread still carries the dispatcher yield
          // that parked it. Its suspend count has reached zero or this thread
          // would have been filtered above, so consume the private yield and
          // continue at the instruction after SuspendThread.
          e.clear_yield();
        } else if (yieldReason === 13) {
          // vblank_wait on a cooperative guest thread. The call is parked on
          // its import thunk with the stdcall frame intact, exactly like the
          // Worker backend handled in _afterWorkerSlice. Clear it only when
          // this thread gets another scheduler turn, then give up that turn:
          // the next slice re-enters WaitForVerticalBlank after the shared
          // guest clock/display beat has had a chance to advance. Omitting
          // this branch left the instance permanently halted on the thunk.
          e.clear_yield();
          thread.waitPolls++;
          continue;
        } else if (yieldReason === 14 || yieldReason === 15) {
          // A spin park on a cooperative guest thread: it is busy-waiting on
          // the clock or on an empty message queue and has asked to be let go.
          // `continue` is load-bearing — it gives up this thread's turn, which
          // is what a park MEANS here. Clearing the yield and falling through
          // instead re-enters the same call in the same turn, so the thread
          // spins exactly as hard as before and pays a park on top: measured
          // on Abe's Oddysee, whose 56.9 MILLION clock reads over 800 batches
          // live on a spawned thread and did not move at all until this line
          // said `continue`.
          e.clear_yield();
          thread.waitPolls++;
          continue;
        } else if (yieldReason === 10) {
          if (!this.resolveCooperativeThreadSend(e)) continue;
        } else if (yieldReason === 17) {
          // Parked in a message call for a send addressed to this thread.
          this.serviceIncomingSends(e);
          if (e.get_yield_reason() | 0) continue;
        } else if (yieldReason === 16) {
          const wait = this._startRenderWait(thread, e.get_d3d_render_token(), thread);
          if (!wait.done) { thread.waitPolls++; continue; }
          thread.renderWait = null;
          e.clear_yield();
        } else if (yieldReason === 12) {
          // io_wait: a provider-backed ReadFile needs a chunk only an async
          // fill can bring in, and runSlice is synchronous. Start the fill
          // once and leave the thread parked on the thunk; the first slice
          // after the fill lands clears the yield, so the same ReadFile
          // re-runs and takes the cache hit. If its request was retired (for
          // example by CloseHandle), retry to observe the current file state.
          if (thread.ioFillDone) {
            thread.ioFillDone = false;
            e.clear_yield();
          } else if (thread.ioFill) {
            thread.waitPolls++;
            continue; // fill still in flight
          } else {
            const vfs = this._getVfs();
            const pending = vfs && vfs.getPendingRead((thread.tid | 0) + 1);
            if (pending) {
              thread.ioFillRead = pending;
              thread.ioFill = Promise.resolve(this._fillIoRead(vfs, pending))
                .catch(() => false)
                .then(() => { thread.ioFill = null; thread.ioFillRead = null; thread.ioFillDone = true; });
              thread.waitPolls++;
              continue;
            }
            e.clear_yield();
          }
        } else if (yieldReason === 2) {
          const prev = e.get_dbg_prev_eip ? e.get_dbg_prev_eip() : 0;
          this._notifyThreadDetach(thread);
          this._markThreadExited(handle, thread, thread.exitCode, 'yield=2');
          this._log(`[ThreadManager] Thread ${thread.tid} exited (yield=2) prev_eip=0x${prev.toString(16)} esp=0x${e.get_esp().toString(16)}`);
          continue;
        }

        if (!e.get_eip()) {
          const prev = e.get_dbg_prev_eip ? e.get_dbg_prev_eip() : 0;
          this._log(`[ThreadManager] Thread ${thread.tid} EIP=0 (likely call/jmp to NULL), prev_eip=0x${prev.toString(16)} esp=0x${e.get_esp().toString(16)} eax=0x${e.get_eax().toString(16)} ebx=0x${e.get_ebx().toString(16)} ecx=0x${e.get_ecx().toString(16)} edx=0x${e.get_edx().toString(16)} esi=0x${e.get_esi().toString(16)} edi=0x${e.get_edi().toString(16)}`);
          // Dump near-stack so we can see where the threadproc ret popped 0 from
          try {
            const espNow = e.get_esp() >>> 0;
            const mem32 = new Uint32Array(e.memory.buffer);
            const wEsp = _threadMemUtils.guestToWasm(
              espNow, e, this.memory, e.get_image_base() >>> 0);
            let stk = '';
            for (let i = -8; i < 16; i++) {
              const v = mem32[(wEsp >> 2) + i] >>> 0;
              stk += `[esp${i>=0?'+':''}${i*4}]=0x${v.toString(16)} `;
            }
            this._log(`[ThreadManager]   stack: ${stk}`);
          } catch (_) {}
          this._notifyThreadDetach(thread);
          this._markThreadExited(handle, thread, 0, 'eip=0');
          continue;
        }

        // No heap-cursor sync-in here — see the note in the spawn path. The
        // allocator's shared state lives in memory, which this instance already
        // sees; its own arena bounds must survive across slices.
        this.adoptMainGlobals(e);
        const eipBeforeRun = e.get_eip();
        if (!thread._firstRunEmitted) {
          thread._firstRunEmitted = true;
          this._emitThreadEvent('first_run', {
            handle: handle >>> 0,
            tid: thread.tid | 0,
            startAddr: thread.startAddr >>> 0,
            creationFlags: (thread.creationFlags || 0) >>> 0,
            suspendCount: (thread.suspendCount || 0) >>> 0,
            eip: eipBeforeRun >>> 0,
          });
        }
        this._runningThreadHandle = handle;
        const profileStartedAt = this._profileThreadRun ? this._now() : 0;
        let eipAfterRun = 0;
        let yieldReasonAfterRun = 0;
        let sleepYielded = false;
        let sleepMs = 0;
        let runError = null;
        let ranBlocks = 0;
        try {
          e.run(sliceSize);
          ranBlocks = e.get_last_run_blocks ? e.get_last_run_blocks() >>> 0 : 0;
        } catch (err) {
          runError = err;
          // Every CS counter is a per-instance global and this thread has its own
          // instance, so the crash has to read them here — the process-wide
          // summary in test/run.js sees the main instance's copy, which is 0.
          const cs = (name) => (e[name] ? e[name]() | 0 : 0);
          const abandoned = cs('get_cs_abandoned');
          const prev = e.get_dbg_prev_eip ? e.get_dbg_prev_eip() >>> 0 : 0;
          const prev2 = e.get_dbg_prev2_eip ? e.get_dbg_prev2_eip() >>> 0 : 0;
          const reason = e.get_yield_reason ? e.get_yield_reason() >>> 0 : 0;
          this._log(`[ThreadManager] Thread ${thread.tid} crashed at `
            + `EIP=${this._describeAddr(cs('get_eip'))} ESP=0x${(cs('get_esp') >>> 0).toString(16)}: ${err.message}`
            + `\n  prev_eip=${this._describeAddr(prev)} prev2_eip=${this._describeAddr(prev2)} yield=${reason} `
            + `csPark=${cs('get_cs_waits')} csBarge=${cs('get_cs_barges')} `
            + `csAbandoned=${abandoned}`
            + (abandoned ? ` (last dispatched at ${this._describeAddr(cs('get_cs_abandoned_eip'))})` : '')
            + ` espDeltaAcrossPark=${cs('get_cs_resume_esp_delta')}`
            + ` parkEip=${this._describeAddr(cs('get_cs_park_eip'))}`);
          this._markThreadExited(handle, thread, 1, 'crash');
        } finally {
          this._runningThreadHandle = 0;
          try {
            eipAfterRun = e.get_eip ? (e.get_eip() >>> 0) : 0;
            yieldReasonAfterRun = e.get_yield_reason ? (e.get_yield_reason() >>> 0) : 0;
            if (!runError && e.get_sleep_yielded) {
              sleepYielded = !!e.get_sleep_yielded();
              if (sleepYielded && e.get_sleep_timeout) sleepMs = e.get_sleep_timeout() >>> 0;
            }
          } catch (_) {}
          if (this._profileThreadRun && profileStartedAt) {
            try {
              this._profileThreadRun({
                handle: handle >>> 0,
                tid: thread.tid | 0,
                startAddr: thread.startAddr >>> 0,
                param: thread.param >>> 0,
                steps: sliceSize | 0,
                eipBefore: eipBeforeRun >>> 0,
                eipAfter: eipAfterRun >>> 0,
                yieldReason: yieldReasonAfterRun >>> 0,
                sleepYielded,
                sleepMs: sleepMs >>> 0,
                hotAudio: this._audioThreadHotUntil.has((thread.tid || 0) | 0),
                state: thread.state || '',
                elapsedMs: Math.max(0, this._now() - profileStartedAt),
                crashed: !!runError,
              });
            } catch (_) {}
          }
        }
        if (runError) continue;
        stats.threadsRun++;
        stats.steps += sliceSize;
        // run() budgets basic blocks; a parked/yielding guest may retire none.
        // Never substitute the requested scheduler budget for measured work.
        stats.blocks += ranBlocks;
        // ...and no sync-out. What this thread allocated is recorded in the
        // shared cursor, not in main's copy of a global.
        if (main.sync_thunk_state && main.get_num_thunks && e.get_num_thunks && e.get_thunk_end) {
          const mainThunkCount = main.get_num_thunks() >>> 0;
          const workerThunkCount = e.get_num_thunks() >>> 0;
          if (workerThunkCount > mainThunkCount) {
            main.sync_thunk_state(e.get_thunk_end() >>> 0, workerThunkCount);
          }
        }
        // Surface bp halts on this thread's instance.
        if (e.get_bp_addr) {
          const bp = e.get_bp_addr();
          const eipNow = e.get_eip();
          if (bp && eipNow === bp) {
            // --break-thread filter: only surface bp if tid matches
            if (this._breakThreadFilter !== null && this._breakThreadFilter !== thread.tid) {
              if (e.set_bp) e.set_bp(bp); // re-arm and continue silently
            } else {
              const prev = e.get_dbg_prev_eip ? e.get_dbg_prev_eip() : 0;
              const esp = e.get_esp() >>> 0;
              let stack = '';
              if (e.guest_read32) {
                const words = [];
                for (let i = 0; i < 8; i++) {
                  words.push(`+${i * 4}=0x${(e.guest_read32((esp + i * 4) >>> 0) >>> 0).toString(16)}`);
                }
                stack = ` stack{${words.join(' ')}}`;
              }
              this._log(`[ThreadManager] T${thread.tid} BP hit at 0x${eipNow.toString(16)} prev_eip=0x${prev.toString(16)} esp=0x${esp.toString(16)} eax=0x${e.get_eax().toString(16)} ebx=0x${e.get_ebx().toString(16)} ecx=0x${e.get_ecx().toString(16)} edx=0x${e.get_edx().toString(16)} esi=0x${e.get_esi().toString(16)} edi=0x${e.get_edi().toString(16)}${stack}`);
              if (this._traceCallstack && e.get_callstack_depth) {
                const d = e.get_callstack_depth() | 0;
                const n = Math.min(d, this._traceCallstackDepth);
                this._log(`  [stack T${thread.tid} depth=${d}]`);
                for (let i = 0; i < n; i++) {
                  this._log(`    #${i} ret=0x${(e.get_callstack_entry(i) >>> 0).toString(16)}`);
                }
              }
              if (e.set_bp) e.set_bp(bp);
            }
          }
        }
        // Surface watchpoint halts on this thread's instance. WAT halts the
        // run loop when the watched memory changes; main's watch_val won't
        // see the new value, so we resync main here and report the change.
        if (e.get_watch_addr && main.get_watch_addr) {
          const wa = e.get_watch_addr();
          if (wa) {
            const newVal = e.get_watch_val();
            const mainVal = main.get_watch_val();
            if (newVal !== mainVal) {
              const prev = e.get_dbg_prev_eip ? e.get_dbg_prev_eip() : 0;
              this._log(`[ThreadManager] T${thread.tid} WATCH 0x${wa.toString(16)} 0x${mainVal.toString(16)} -> 0x${newVal.toString(16)} eip=0x${e.get_eip().toString(16)} prev_eip=0x${prev.toString(16)} esp=0x${e.get_esp().toString(16)} ebp=0x${e.get_ebp().toString(16)} eax=0x${e.get_eax().toString(16)} ebx=0x${e.get_ebx().toString(16)} ecx=0x${e.get_ecx().toString(16)} edx=0x${e.get_edx().toString(16)} esi=0x${e.get_esi().toString(16)} edi=0x${e.get_edi().toString(16)}`);
              if (main.set_watchpoint) main.set_watchpoint(wa); // resync to suppress dup log on next slice
            }
          }
        }

        // Track Sleep yielding: get_sleep_yielded atomically reads and clears
        // the flag. Threads that repeatedly call Sleep (idle polling loops)
        // get deprioritized so compute-heavy threads get more budget.
        if(thread.waveWaitSaved && !e.is_mm_timer_callback_active()) {
          Object.assign(thread,thread.waveWaitSaved);thread.waveWaitSaved=null;
        }
        const postYield = yieldReasonAfterRun;
        if (postYield === 2) {
          const prev = e.get_dbg_prev_eip ? e.get_dbg_prev_eip() : 0;
          this._markThreadExited(handle, thread, thread.exitCode, 'postYield=2');
          this._log(`[ThreadManager] Thread ${thread.tid} exited (postYield=2) prev_eip=0x${prev.toString(16)} esp=0x${e.get_esp().toString(16)}`);
        } else if (postYield === 9) {
          // Blocked on a critical section another thread holds. EIP is still on
          // the thunk, so clearing the yield re-enters EnterCriticalSection; the
          // point of parking was to let the holder run, and it just did (or is
          // about to, later in this same round).
          if (this._traceThread && thread.waitPolls < 3) {
            const csWa = e.get_cs_wait_addr ? e.get_cs_wait_addr() >>> 0 : 0;
            const cs = csWa && e.get_image_base
              ? (csWa - 0x12000 + (e.get_image_base() >>> 0)) >>> 0 : 0;
            const esp = e.get_esp() >>> 0;
            this._log(`[ThreadManager] T${thread.tid} critical park cs=0x${cs.toString(16)} ` +
              `lock=${e.guest_read32((cs + 4) >>> 0) | 0} recursion=${e.guest_read32((cs + 8) >>> 0) >>> 0} ` +
              `owner=${e.guest_read32((cs + 12) >>> 0) >>> 0} tid=${e.get_current_thread_id() >>> 0} ` +
              `eip=0x${e.get_eip().toString(16)} esp=0x${esp.toString(16)} ` +
              `stack=[0x${(e.guest_read32(esp) >>> 0).toString(16)},0x${(e.guest_read32((esp + 4) >>> 0) >>> 0).toString(16)},0x${(e.guest_read32((esp + 8) >>> 0) >>> 0).toString(16)}]`);
          }
          e.clear_yield();
          thread.waitPolls++;
        } else if (postYield === 10) {
          this.resolveCooperativeThreadSend(e);
        } else if (postYield === 17) {
          this.serviceIncomingSends(e);
        } else if (postYield === 14 && this._clockParkSleep) {
          // A clock spin park ($clock_spin_arm): the detector proved this
          // thread is re-reading the same millisecond from one call site with
          // no API and almost no guest work in between, so nothing it can do
          // before the clock moves is observable. Sleep it to the deadline the
          // park named instead of handing it the next turn: re-slicing it at
          // once only re-reads the same value (the one-park-per-ms latch then
          // lets it spin out the rest of its slice), and a thread left with
          // yield 14 still pending is "not idle" to parkedThreadDelay, so the
          // host never slept either. Blobby Volley's frame limiter
          // (0x445242, `GetTickCount; cmp; jb`) burned ~30% of page CPU that
          // way. The yield is cleared now so the due turn re-enters the call.
          const owed = e.get_spin_deadline_ms && e.get_tick_count
            ? ((e.get_spin_deadline_ms() >>> 0) - (e.get_tick_count() >>> 0)) | 0 : 1;
          e.clear_yield();
          thread.sleepUntil = this._waitNow() + Math.max(1, Math.min(CLOCK_PARK_MAX_MS, owed));
          thread.sleepCount = 0;
          thread.lastSleepMs = 0;
          thread.clockParkSleeps = (thread.clockParkSleeps || 0) + 1;
        } else if (sleepYielded) {
          // Catch-up: a periodic sleeper that was run late counts its next
          // deadline from the one it was due at, not from now, so the wakes
          // it missed while the host was busy happen back to back instead of
          // being lost. Bounded, so a thread parked for long does not spin.
          const nowW = this._waitNow();
          let base = nowW;
          if (options.catchUpSleep && sleepMs > 0 && thread.sleepUntil > 0 &&
              thread.sleepUntil <= nowW && nowW - thread.sleepUntil < 100) {
            base = thread.sleepUntil;
          }
          thread.sleepUntil = sleepMs ? base + sleepMs : 0;
          thread.sleepCount++;
          thread.lastSleepMs = sleepMs | 0;
        } else {
          thread.sleepUntil = 0;
          thread.sleepCount = 0;
        }
      }
    }
    return finishStats();
  }

  // The global deadline clock at real time `real` (see the constructor).
  deadlineNow(real) {
    if (!(real >= 0) || this.workerBackend) return real;
    if (this._dcNow > real) {
      // A clock reset (new session) rather than lag: follow it down.
      if (this._dcNow - real > DEADLINE_CLOCK_MAX_LAG_MS) this._dcNow = real;
      return this._dcNow;
    }
    let pin = real;
    for (const [, t] of this.threads) {
      if (t.state !== 'active' || t.suspendCount > 0) continue;
      if (!(t.sleepCount > 0 && t.lastSleepMs > 0 && t.sleepUntil > 0)) continue;
      if (t.sleepUntil < pin) pin = t.sleepUntil;
    }
    if (pin < real - DEADLINE_CLOCK_MAX_LAG_MS) pin = real - DEADLINE_CLOCK_MAX_LAG_MS;
    if (pin > this._dcNow) this._dcNow = pin;
    return this._dcNow;
  }

  // How far the deadline clock trails real time right now, in ms (0 when off).
  deadlineLagMs() {
    if (!this.deadlineClock || this.workerBackend) return 0;
    const real = this._realWaitNow();
    const lag = real - this.deadlineNow(real);
    return lag > 0 ? lag : 0;
  }

  // A thread that slept for a real duration and whose deadline has passed.
  // Such a thread (a DirectSound mixer on Sleep(5)) is owed a turn now, not at
  // the next host step, which can be tens of milliseconds away.
  hasDueSleeper() {
    if (this.workerBackend) return false;
    let now = -1;
    for (const [, t] of this.threads) {
      if (t.state !== 'active' || t.suspendCount > 0) continue;
      if (!(t.sleepCount > 0 && t.lastSleepMs > 0 && t.sleepUntil > 0)) continue;
      if (now < 0) now = this._waitNow();
      if (now >= t.sleepUntil) return true;
    }
    return false;
  }

  runDueSleepers(options) {
    options = options || {};
    const quantumSteps = Math.max(1, (options.quantumSteps | 0) || 10000);
    // An extra turn in the middle of a host step; it must not disturb the
    // step-level bookkeeping runSlice keeps for the regular thread phase.
    const hadWork = this._lastCooperativeRunHadWork;
    const hotFirst = this._audioPriorityNextHotFirst;
    const maxWallMs = Number.isFinite(options.maxWallMs) ? options.maxWallMs : 2;
    const rounds = Math.max(1, options.rounds | 0);
    const startedAt = this._now();
    let stats = null;
    for (let i = 0; i < rounds; i++) {
      const left = maxWallMs - (this._now() - startedAt);
      if (i && (left <= 0 || !this.hasDueSleeper())) break;
      const s = this.runSlice(quantumSteps, {
        quantumSteps,
        maxWallMs: Math.max(0.5, left),
        onlyDueSleepers: true,
        exemptTimedSleepers: true,
        catchUpSleep: !!options.catchUpSleep,
      });
      if (!stats) stats = s;
      else { stats.blocks += s.blocks || 0; stats.steps += s.steps || 0; stats.threadsRun += s.threadsRun || 0; }
    }
    this._lastCooperativeRunHadWork = hadWork;
    this._audioPriorityNextHotFirst = hotFirst;
    return stats;
  }

  runBudgeted(options) {
    options = options || {};
    const quantumSteps = Math.max(1, (options.quantumSteps | 0) || 1000);
    const maxTotalSteps = Math.max(quantumSteps, (options.maxTotalSteps | 0) || quantumSteps);
    return this.runSlice(maxTotalSteps, {
      quantumSteps,
      maxWallMs: Number.isFinite(options.maxWallMs) ? options.maxWallMs : 0,
      stopIfMessagePending: !!options.stopIfMessagePending,
      prioritizeAudioThreads: !!options.prioritizeAudioThreads,
      exemptTimedSleepers: !!options.exemptTimedSleepers,
      catchUpSleep: !!options.catchUpSleep,
    });
  }

  // Threads parked on the LoadLibraryA yield (reason 5). runSlice cannot serve
  // that one: the host has to read the file and relocate the image, and both
  // hosts do that asynchronously, so the load happens in the caller's own loop
  // where it can await. A worker left parked here never resumes -- the Winamp
  // NSIS installer runs its whole extraction on a worker and stops dead at the
  // first plug-in it loads.
  threadsAwaitingLoadLibrary() { return this._threadsParkedOn(5); }

  // Same for the COM in-proc server yield (reason 3): a worker whose
  // CoCreateInstance needs a DLL not yet loaded. DirectShow creates its
  // filters on its own worker thread, so Morrowind's music graph parked
  // forever at the first filter DLL that thread asked for.
  threadsAwaitingComDll() { return this._threadsParkedOn(3); }

  _threadsParkedOn(reason) {
    const out = [];
    for (const [, thread] of this.threads) {
      if (!thread.instance || thread.state === 'exited') continue;
      const e = thread.instance.exports;
      if (e.get_yield_reason && (e.get_yield_reason() | 0) === reason) out.push(thread);
    }
    return out;
  }

  // The reverse of publishWorkerGlobals: bring a worker's private copies of
  // the loaded-DLL count and thunk cursor up to main's. Every slice does this
  // on entry; a host servicing a parked worker's DLL load between slices must
  // too, or the loader appends at a stale DLL-table row and reissues thunk
  // slots main has handed out since that worker last ran.
  adoptMainGlobals(e) {
    const main = this.mainInstance && this.mainInstance.exports;
    if (!e || !main || e === main) return;
    if (main.get_dll_count) {
      const dllCount = main.get_dll_count() | 0;
      if (e.set_dll_count) e.set_dll_count(dllCount);
      else if (e.test_set_dll_count) e.test_set_dll_count(dllCount);
    }
    if (main.get_thunk_end && main.get_num_thunks && e.get_thunk_end && e.get_num_thunks && e.sync_thunk_state) {
      const mainThunkEnd = main.get_thunk_end() >>> 0;
      const mainThunkCount = main.get_num_thunks() >>> 0;
      if ((e.get_thunk_end() >>> 0) !== mainThunkEnd || (e.get_num_thunks() >>> 0) !== mainThunkCount) {
        e.sync_thunk_state(mainThunkEnd, mainThunkCount);
      }
    }
  }

  // Publish the per-instance globals a worker can advance on its own. Guest
  // memory is shared, but the heap cursors, the thunk arena and the loaded-DLL
  // count are instance-local mutable globals, and every thread's next slice
  // copies them from main -- so work done on a worker outside runSlice has to
  // be handed back here or it is silently reverted.
  publishWorkerGlobals(e) {
    const main = this.mainInstance.exports;
    if (!e || !main) return;
    if (main.set_heap_ptr && e.get_heap_ptr) main.set_heap_ptr(e.get_heap_ptr());
    if (main.set_free_list && e.get_free_list) main.set_free_list(e.get_free_list());
    if (main.set_heap_sparse_ptr && e.get_heap_sparse_ptr) main.set_heap_sparse_ptr(e.get_heap_sparse_ptr());
    if (main.set_heap_sparse_end && e.get_heap_sparse_end) main.set_heap_sparse_end(e.get_heap_sparse_end());
    if (main.set_virtual_alloc_top && e.get_virtual_alloc_top) main.set_virtual_alloc_top(e.get_virtual_alloc_top());
    if (main.sync_thunk_state && main.get_num_thunks && e.get_num_thunks && e.get_thunk_end) {
      if ((e.get_num_thunks() >>> 0) > (main.get_num_thunks() >>> 0)) {
        main.sync_thunk_state(e.get_thunk_end() >>> 0, e.get_num_thunks() >>> 0);
      }
    }
    if (main.get_dll_count && e.get_dll_count) {
      const workerCount = e.get_dll_count() | 0;
      if (workerCount > (main.get_dll_count() | 0)) {
        if (main.set_dll_count) main.set_dll_count(workerCount);
        else if (main.test_set_dll_count) main.test_set_dll_count(workerCount);
      }
    }
  }

  // Also check main thread for yield (WaitForSingleObject)
  async resolveMainThreadSend() {
    if (!this.workerBackend) return false;
    const e = this.mainInstance.exports;
    if (!e.get_yield_reason || (e.get_yield_reason() | 0) !== 10) return false;
    await this.workerBackend.resolveThreadSend(this.workerBackend._localLink, {
      targetTid: e.get_send_target_tid() | 0,
      hwnd: e.get_send_hwnd() | 0, msg: e.get_send_msg() | 0,
      wparam: e.get_send_wparam() | 0, lparam: e.get_send_lparam() | 0,
      postKind: e.get_send_post_kind ? e.get_send_post_kind() | 0 : 0,
    });
    return true;
  }

  _cooperativeTargetExports(win32Tid) {
    if ((win32Tid | 0) === 1) return this.mainInstance.exports;
    for (const [, thread] of this.threads) {
      if ((thread.tid | 0) === ((win32Tid | 0) - 1) && thread.state === 'active'
          && thread.instance) return thread.instance.exports;
    }
    return null;
  }

  _snapshotCooperativeSend(ex) {
    const g = name => ex[name] ? ex[name]() | 0 : 0;
    return {
      eip: g('get_eip'), esp: g('get_esp'), ebp: g('get_ebp'), eax: g('get_eax'),
      ebx: g('get_ebx'), ecx: g('get_ecx'), edx: g('get_edx'),
      esi: g('get_esi'), edi: g('get_edi'),
      handlerSetEip: g('get_handler_set_eip'), steps: g('get_steps'),
      yieldReason: g('get_yield_reason'), yieldFlag: g('get_yield_flag'),
      renderToken: g('get_d3d_render_token'),
    };
  }

  _restoreCooperativeSend(ex, s) {
    ex.set_esp(s.esp); ex.set_ebp(s.ebp); ex.set_eax(s.eax);
    ex.set_ebx(s.ebx); ex.set_ecx(s.ecx); ex.set_edx(s.edx);
    ex.set_esi(s.esi); ex.set_edi(s.edi);
    ex.set_handler_set_eip(s.handlerSetEip); ex.set_steps(s.steps);
    ex.set_yield_state(s.yieldReason, s.yieldFlag); ex.set_eip(s.eip);
    if (ex.set_d3d_render_token) ex.set_d3d_render_token(s.renderToken || 0);
  }

  _dispatchCooperativeSend(target, request, depth) {
    if (!target || depth > 64) return 0;
    if (this._renderSendTargets.has(target)) return {
      resume: () => this._dispatchCooperativeSend(target, request, depth),
    };
    const saved = this._snapshotCooperativeSend(target);
    if (target.set_d3d_render_token) target.set_d3d_render_token(0);
    if ((request.postKind | 0) === 1 && (!request.wparam || !request.lparam)) {
      const result = target.thread_send_post ? target.thread_send_post(
        request.hwnd | 0, request.msg | 0, request.wparam | 0, request.lparam | 0,
        request.postKind | 0, 0) | 0 : 0;
      this._restoreCooperativeSend(target, saved);
      return result;
    }
    const asyncDispatch = target.thread_send_begin(
      request.hwnd | 0, request.msg | 0, request.wparam | 0, request.lparam | 0) | 0;
    if (!asyncDispatch) {
      const result = target.get_eax() | 0;
      const finalResult = target.thread_send_post ? target.thread_send_post(
        request.hwnd | 0, request.msg | 0, request.wparam | 0, request.lparam | 0,
        request.postKind | 0, result | 0) | 0 : result;
      this._restoreCooperativeSend(target, saved);
      return finalResult;
    }
    let result = 0, nestedPending = null;
    const state = {};
    const continuation = { resume: () => drive() };
    const park = () => { this._renderSendTargets.add(target); return continuation; };
    const drive = () => {
    if (state.renderWait) {
      if (!state.renderWait.done) return park();
      state.renderWait = null; target.clear_yield();
    }
    if (nestedPending) {
      const nested = nestedPending.resume();
      if (nested && typeof nested.resume === 'function') { nestedPending = nested; return park(); }
      nestedPending = null; target.complete_thread_send(nested | 0);
    }
    for (let round = 0; round < 64; round++) {
      try { target.run(1000000); } catch (_) { break; }
      const y = target.get_yield_reason ? target.get_yield_reason() | 0 : 0;
      if (y === 10) {
        const nestedTarget = this._cooperativeTargetExports(target.get_send_target_tid() | 0);
        const nested = this._dispatchCooperativeSend(nestedTarget, {
          hwnd: target.get_send_hwnd() | 0, msg: target.get_send_msg() | 0,
          wparam: target.get_send_wparam() | 0, lparam: target.get_send_lparam() | 0,
          postKind: target.get_send_post_kind ? target.get_send_post_kind() | 0 : 0,
        }, depth + 1);
        if (nested && typeof nested.resume === 'function') { nestedPending = nested; return park(); }
        target.complete_thread_send(nested | 0);
        continue;
      }
      if (y === 16) {
        this._startRenderWait(state, target.get_d3d_render_token(), target);
        return park();
      }
      if (y === 17) {
        // The WndProc called a message function while another send for this
        // same receiver is parked. That is a legal delivery point (Win32
        // nests it there too), and breaking out instead would abandon the
        // dispatch in progress.
        this.serviceIncomingSends(target, depth + 1);
        continue;
      }
      if (y) break;
      if (!(target.get_eip() >>> 0)) {
        result = target.thread_send_end() | 0;
        if (target.thread_send_post) result = target.thread_send_post(
          request.hwnd | 0, request.msg | 0, request.wparam | 0, request.lparam | 0,
          request.postKind | 0, result | 0) | 0;
        break;
      }
    }
    // If a trap or unrelated blocking yield aborted this nested dispatch, keep
    // sync_msg_depth balanced before restoring the interrupted context.
    if (target.get_eip() >>> 0) target.thread_send_end();
    this._restoreCooperativeSend(target, saved);
    this._renderSendTargets.delete(target);
    return result | 0;
    };
    return drive();
  }

  // Win32 delivers a SendMessage from another thread only while the receiver
  // is inside a message call: GetMessage/WaitMessage (yield 7), a PeekMessage
  // or modal-loop park (15), its own outgoing SendMessage (10), or a message
  // call that stopped for exactly this (17). Anywhere else the receiver is in
  // the middle of its own code, and running a WndProc there is reentrancy no
  // real program is written to survive -- Blobby Volley's main thread was
  // inside TControlCanvas.FreeHandle, and the paint that ran there adopted
  // the HDC it had just released. Worker-backend instances never see the
  // pending flag; this is the cooperative scheduler's rule.
  _sendTargetAtMessagePoint(target) {
    const y = target.get_yield_reason ? target.get_yield_reason() | 0 : 0;
    return y === 7 || y === 10 || y === 15 || y === 17;
  }

  // Deliver every cooperative send parked for `target` -- which is now at a
  // message point -- then let the message call it stopped in run again.
  hasDeferredMainSends() {
    for (const [, t] of this.threads) if (t && t.mainSendDeferred && t.state === 'active') return true;
    return false;
  }

  serviceIncomingSends(target, depth = 0) {
    if (!target) return;
    // Sends from Worker-backend threads to the main thread wait in the
    // backend for this moment (guest-thread-host _awaitMainMessagePoint).
    // While they run, main stays parked at yield 17; the backend clears it.
    // A Worker thread's send to main is delivered by the worker scheduler's
    // next round (yield-10 branch); keep main parked at its message call
    // until then.
    if (this.workerBackend && this.mainInstance && target === this.mainInstance.exports &&
        this.hasDeferredMainSends()) return;
    if (target.set_incoming_send_pending) target.set_incoming_send_pending(0);
    const senders = [];
    const consider = ex => {
      if (ex && ex !== target && ex.get_yield_reason && (ex.get_yield_reason() | 0) === 10 &&
          this._cooperativeTargetExports(ex.get_send_target_tid() | 0) === target) senders.push(ex);
    };
    consider(this.mainInstance && this.mainInstance.exports);
    for (const [, thread] of this.threads) {
      if (thread && thread.state === 'active' && thread.instance) consider(thread.instance.exports);
    }
    for (const sender of senders) {
      if (depth > 0 && this._renderSendContinuations.has(sender)) continue;
      this.resolveCooperativeThreadSend(sender);
    }
    if ((target.get_yield_reason() | 0) === 17 && !this._renderSendTargets.has(target)) {
      target.clear_yield();
    }
  }

  resolveCooperativeThreadSend(sender) {
    if (!sender || !sender.get_yield_reason || (sender.get_yield_reason() | 0) !== 10) return false;
    const pending = this._renderSendContinuations.get(sender);
    const target = this._cooperativeTargetExports(sender.get_send_target_tid() | 0);
    if (!pending && target && target.set_incoming_send_pending &&
        !this._sendTargetAtMessagePoint(target)) {
      // Not deliverable yet: leave the sender parked and ask the receiver's
      // next message call to stop for it.
      target.set_incoming_send_pending(1);
      const waits = (this._sendParkRounds.get(sender) || 0) + 1;
      this._sendParkRounds.set(sender, waits);
      if (waits === 20000) {
        // A receiver that never reaches a message call deadlocks here exactly
        // as it would on Windows (e.g. WaitForSingleObject on the sender).
        // Say so once rather than hang in silence.
        this._log(`[ThreadManager] SendMessage 0x${(sender.get_send_msg() >>> 0).toString(16)} ` +
          `to hwnd 0x${(sender.get_send_hwnd() >>> 0).toString(16)} has waited ${waits} rounds: ` +
          `receiver tid ${sender.get_send_target_tid() | 0} is at yield ` +
          `${target.get_yield_reason() | 0} eip=0x${(target.get_eip() >>> 0).toString(16)}, not in a message call`);
      }
      return false;
    }
    this._sendParkRounds.delete(sender);
    const result = pending ? pending.resume() : this._dispatchCooperativeSend(target, {
      hwnd: sender.get_send_hwnd() | 0, msg: sender.get_send_msg() | 0,
      wparam: sender.get_send_wparam() | 0, lparam: sender.get_send_lparam() | 0,
      postKind: sender.get_send_post_kind ? sender.get_send_post_kind() | 0 : 0,
    }, 0);
    if (result && typeof result.resume === 'function') {
      this._renderSendContinuations.set(sender, result);
      return false;
    }
    this._renderSendContinuations.delete(sender);
    sender.complete_thread_send(result | 0);
    return true;
  }

  // True while a main-thread Sleep(n) that checkMainYield recorded has not run
  // out on the guest clock. Read-only: the deadline is set and cleared there.
  isMainSleeping() {
    return !!this._mainSleepUntil && this._waitNow() < this._mainSleepUntil;
  }

  // Guest ms left on a main-thread Sleep, or 0. The headless runner uses it
  // to move its clock straight to the deadline when no other guest thread
  // could have used the idle batches.
  mainSleepRemaining() {
    return this.isMainSleeping() ? this._mainSleepUntil - this._waitNow() : 0;
  }

  hasLiveThreads() {
    for (const t of this.threads.values()) if (t && t.state !== 'exited') return true;
    return false;
  }

  // Sleep is a slice yield rather than a Win32 wait yield, so it leaves
  // yield_reason at zero. Workers consume the same sleep_yielded flag in
  // runSlice(); the main instance needs an equivalent guest-clock gate.
  // Without it Sleep(10) resumes on the next MessageChannel task, which can
  // let shutdown polling observe a worker-owned queue between mutations.
  // Consume main's flag into a deadline. Call it wherever the host decides
  // whether main may run again, not only at the end of a batch: the CLI
  // re-runs main between cooperative thread slices, and Red Alert's
  // Sleep(1000) after timeSetEvent (which starts the timer thread) resumed on
  // the very next slice, saw no timer tick and reported a timer error.
  noteMainSleep() {
    const e = this.mainInstance.exports;
    if (e.get_sleep_yielded && e.get_sleep_yielded()) {
      const sleepMs = e.get_sleep_timeout ? (e.get_sleep_timeout() >>> 0) : 0;
      this._mainSleepUntil = sleepMs ? this._sleepNow() + sleepMs : 0;
    }
  }

  checkMainYield() {
    const e = this.mainInstance.exports;
    if (this._renderSendTargets.has(e)) return true;
    const now = this._waitNow();
    this.noteMainSleep();
    if (this._mainSleepUntil) {
      if (now < this._mainSleepUntil) return true;
      this._mainSleepUntil = 0;
    }
    const yr = e.get_yield_reason();
    if (yr === 10) {
      return !this.resolveCooperativeThreadSend(e);
    }
    if (yr === 17) {
      // The main thread's message call stopped for a send another thread
      // parked on it; deliver it here, then that call runs again.
      this.serviceIncomingSends(e);
      return (e.get_yield_reason() | 0) !== 0;
    }
    if (yr === 9) {
      // Blocked on a critical section another guest thread holds. Clear it so the
      // call is re-entered next batch, by which time the caller has given the
      // other threads a turn. Never spin in WAT for this: the holder may be
      // parked in Atomics.wait for a host import only this thread can serve.
      //
      // A safety net as things stand — the guest's main thread does not park
      // (see $handle_EnterCriticalSection) — and cheap enough to keep so that a
      // change to that rule degrades instead of hanging.
      e.clear_yield();
      return false;
    }
    if (yr === 7) {
      if (!this._hasPendingMessage(e)) {
        this._mainWaitPolls = (this._mainWaitPolls || 0) + 1;
        return true;
      }
      this._mainWaitPolls = 0;
      this._mainWaitStartedAt = 0;
      // Read the resume address straight off the guest stack. NOT
      // _readWaitReturnAddress(): that helper treats "retAddr is outside
      // [get_code_start, get_code_end)" as evidence of a garbage stack and
      // re-derives the address by scanning dbg_prev_eip for a call opcode.
      // Those bounds cover the EXE image only, so a message wait that returns
      // into a loaded DLL -- which is the normal case for an MFC app, whose
      // pump lives in mfc42.dll -- looks garbage and gets rewritten to the
      // wrong instruction. The message-wait path always has a real return
      // address at [esp], so it needs no recovery heuristic.
      const retAddr = e.guest_read32 ? e.guest_read32(e.get_esp()) : 0;
      if (e.resume_message_wait && (e.resume_message_wait() | 0)) {
        e.set_eip(retAddr);
      } else {
        return true;
      }
      return false;
    }
    if (yr === 9) {
      // As with a worker, retry the same import thunk. Returning false lets
      // the caller execute one main slice; if still contended it immediately
      // yields again and workers get the rest of the scheduler turn.
      e.clear_yield();
      this._mainWaitPolls = (this._mainWaitPolls || 0) + 1;
      return false;
    }
    if (yr !== 1) return false; // not waiting
    if (e.apc_wake_wait && (e.apc_wake_wait() | 0)) {
      // Alertable wait with a user APC queued to main: run it (see runSlice).
      this._mainWaitPolls = 0;
      this._mainWaitStartedAt = 0;
      return false;
    }

    const waitHandle = e.get_wait_handle();
    const waitHandlesPtr = e.get_wait_handles_ptr ? e.get_wait_handles_ptr() : 0;
    const waitAll = e.get_wait_all ? !!e.get_wait_all() : false;
    const waitTimeout = e.get_wait_timeout ? (e.get_wait_timeout() >>> 0) : 0xFFFFFFFF;
    const waitStackBytes = e.get_wait_stack_bytes ? (e.get_wait_stack_bytes() | 0) : (waitHandlesPtr ? 20 : 12);
    let result;
    if (waitStackBytes === 24 && !waitHandlesPtr) {
      result = this._hasMessage && this._hasMessage() ? waitHandle : 0xFFFF;
    } else if (waitHandlesPtr) {
      result = this.waitMultiple(waitHandle, waitHandlesPtr, waitAll, 0, 1);
    } else {
      result = this.waitSingle(waitHandle, 0, 1);
    }
    if (result === 0xFFFF || result === 0x102) {
      const syncIdx = waitHandlesPtr ? -1 : this._getSyncIdx(waitHandle);
      if (
        !this.hasActiveThreads() &&
        waitTimeout === 0xFFFFFFFF &&
        syncIdx >= 0 &&
        this.syncView[syncIdx * 4 + 1] === 1
      ) {
        result = 0;
      } else if (waitTimeout !== 0 && waitTimeout !== 0xFFFFFFFF) {
        // A bounded wait whose object nothing can signal is already decided:
        // only guest code sets these, the main thread is the guest code, and
        // it is blocked here. Sitting out the timeout in wall-clock costs the
        // app exactly that long and cannot change the answer. Age of Empires
        // II waits 5000ms on a count-1 semaphore it has already taken (its
        // "am I the only instance" probe) before it will start.
        if (!this.hasActiveThreads()) {
          result = 0x102;
          this._mainWaitPolls = 0;
          this._mainWaitStartedAt = 0;
          const retAddr = this._completeWait(e, result, waitStackBytes);
          if (this._traceThread) {
            this._log(`[ThreadManager] Main wait on 0x${waitHandle.toString(16)} timed out early ` +
              `(nothing can signal it), ret=0x${retAddr.toString(16)}`);
          }
          return false;
        }
        // `this._waitNow`, not `Date.now`: the host supplies the clock, and the
        // CLI's is the batch counter. Every other timed decision here already
        // uses it (`thread.sleepUntil` above), and so does the clock the guest
        // itself reads — so measuring this one wait against the wall left the
        // two incoherent, a 5s wait advancing the guest's own GetTickCount by
        // millions of milliseconds. It is also the last real-clock read that
        // can change control flow, and so the last thing making a headless run
        // depend on machine load.
        const now = this._waitNow();
        if (!this._mainWaitStartedAt) this._mainWaitStartedAt = now;
        // The clock is not the only thing a bounded wait is measured against.
        // A poll here is one host batch, and the CLI's clock charges 200ms to
        // each one -- so a 255ms wait expires after two batches, which is a
        // couple of hundred thousand guest instructions. The same wait on the
        // hardware this code was written for bought its worker something like
        // a hundred million. Storm's MPQ reader is exactly that shape: it
        // waits 255ms for three decompression jobs, we hand it 1.3 batches,
        // it collects 16 of 32 sectors, ignores the WAIT_TIMEOUT and reports
        // the short read as EOF -- and Diablo's menu art comes out half
        // decoded and black below the seam.
        //
        // So while a runnable thread could still signal the object, also
        // require a floor of polls before calling time. Nothing is lost when
        // the work does finish: the wait returns the moment the object is
        // signalled, several branches above. The floor only costs batches on
        // an object that was never going to be signalled, and the
        // `!hasActiveThreads()` case above already takes the fast exit out of
        // that. Bounded above so a livelock still terminates.
        const minPolls = Math.min(1024, Math.max(4, waitTimeout));
        if ((now - this._mainWaitStartedAt) >= waitTimeout
          && (this._mainWaitPolls || 0) >= minPolls) {
          result = 0x102;
        } else {
          this._mainWaitPolls = (this._mainWaitPolls || 0) + 1;
          return true;
        }
      } else {
        this._mainWaitPolls = (this._mainWaitPolls || 0) + 1;
        return true; // still waiting
      }
    }
    this._mainWaitPolls = 0;
    this._mainWaitStartedAt = 0;

    // Signaled — complete the wait call.
    const retAddr = this._completeWait(e, result, waitStackBytes);
    // This is a per-completion event, not lifecycle information. Storm's
    // preload queue satisfies thousands of waits, so logging it by default
    // turns normal browser startup into a console-I/O benchmark. Worker wait
    // completions already obey the same trace-only policy above.
    if (this._traceThread) {
      this._log(`[ThreadManager] Main thread resumed from wait, handle=0x${waitHandle.toString(16)} ret=0x${retAddr.toString(16)}`);
    }
    return false;
  }

  // Called after runSlice, not as a replacement for its wait checks. A live
  // thread blocked on an event is not runnable work. Do not probe waitSingle
  // here: doing so would consume auto-reset events/semaphores a second time.
  // Require a no-work scheduler pass and already-observed waits; unfamiliar
  // yields and true Worker instances remain conservative (no host sleep).
  parkedThreadDelay(capMs) {
    if (this.workerBackend || this._lastCooperativeRunHadWork !== false) return 0;
    if (this._pendingThreads.some(t => !(t.suspendCount > 0))) return 0;
    const now = this._waitNow();
    let delay = capMs;
    for (const [, t] of this.threads) {
      if (t.state !== 'active' || t.suspendCount > 0) continue;
      if (t.sleepUntil > now) {
        delay = Math.min(delay, t.sleepUntil - now);
        continue;
      }
      const e = t.instance && t.instance.exports;
      if (!e || !(t.waitPolls > 0)) return 0;
      const reason = e.get_yield_reason();
      if (reason === 1) {
        const timeout = e.get_wait_timeout() >>> 0;
        if (timeout !== 0xFFFFFFFF) {
          if (!timeout || !t.waitStartedAt) return 0;
          delay = Math.min(delay, t.waitStartedAt + timeout - now);
        }
      } else if (reason === 7) {
        if (this._hasPendingMessage(e)) return 0;
        const due = e.next_timer_due_ms ? e.next_timer_due_ms() | 0 : -1;
        if (due >= 0) delay = Math.min(delay, due);
      } else return 0;
    }
    return Math.max(0, Math.min(capMs, delay));
  }

  // Worker free-run (host arm f): how long the host step may park before some
  // guest thread needs it. A thread mid-slice re-dispatches itself when the
  // slice ends (FREE_RUN_STEP_STALE_MS outlasts any park), and a suspended one
  // is woken through onRunnable when resumed, so neither bounds the park. One
  // waiting out a page-side Sleep or WaitFor* does, to its deadline; one that
  // is runnable and idle, or still spawning, needs the step now (0).
  freeRunParkBound(capMs) {
    if (!this.workerBackend || !this.workerFreeRun || this.serialSlices) return 0;
    if (this._pendingThreads.some(t => !(t.suspendCount > 0))) return 0;
    const now = this._waitNow();
    let delay = capMs;
    for (const [, t] of this.threads) {
      if (t.state !== 'active') continue;
      if (!t.link) return 0;
      if (t.inFlight || t.freeRunPending || t.suspendCount > 0) continue;
      if (t.sleepUntil && now < t.sleepUntil) {
        delay = Math.min(delay, t.sleepUntil - now);
        continue;
      }
      if (t.parkedWait) {
        // A live thread is not necessarily runnable. Treating an unsatisfied
        // event wait as work made an idle GetMessage main thread spin through
        // thousands of empty Worker slices per second (Collapse Crunch).
        // Reuse the scheduler poll: it retains a consumed auto-reset signal in
        // parkedWaitDone until _runWorkerThread completes that exact wait.
        if (this._pollParkedWait(t)) return 0;
        const timeout = t.parkedWait.waitTimeout >>> 0;
        if (timeout !== 0xFFFFFFFF) {
          if (!timeout || !t.waitStartedAt) return 0;
          delay = Math.min(delay, t.waitStartedAt + timeout - now);
        }
        continue;
      }
      return 0;
    }
    return Math.max(0, Math.min(capMs, delay));
  }

  // Is any spawned thread parked on a lazy-read fill that is still in flight?
  // A host whose batch loop is otherwise synchronous (test/run.js) must give
  // the event loop a turn for that fill to land.
  _fillIoRead(vfs, pending) {
    return this._fillIoReadHook ? this._fillIoReadHook(vfs, pending) : vfs.fillPendingRead(pending);
  }

  hasIoFillInFlight() {
    for (const thread of this.threads.values()) if (thread && thread.ioFill) return true;
    return false;
  }

  hasActiveThreads() {
    for (const [, t] of this.threads) {
      if (t.state === 'active' && !(t.suspendCount > 0)) return true;
    }
    return this._pendingThreads.some(thread => !(thread.suspendCount > 0));
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThreadManager };
} else if (typeof window !== 'undefined') {
  window.ThreadManager = ThreadManager;
}
