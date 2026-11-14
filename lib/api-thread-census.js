'use strict';
// api-thread-census.js -- per-guest-thread census of Win32/COM API calls,
// grouped by graphics family (d3d9, d3d8, ddraw/d3dim, glide, gl) plus the
// synchronization APIs around them. Fed by test/run.js --api-thread-census
// from the main instance's log() and every guest-thread instance's logger.
//
// It answers "which guest thread talks to which graphics object":
//   - calls per thread per family, and the top methods per thread;
//   - per COM object (`this` = first stdcall arg): which threads touched it,
//     so a device used from two threads is distinguishable from a texture
//     filled on a loader thread and then bound on the main thread;
//   - frames (delimited by Present/Flip/SwapBuffers/grBufferSwap): how many
//     contained graphics calls from more than one thread, and the per-thread
//     calls/frame split;
//   - consecutive graphics calls whose thread differs (interleaving);
//   - Lock spans: the thread that unlocked vs locked, and whether any other
//     thread made an API call while the lock was open (a thread that writes
//     through another thread's Lock pointer must at least run in the span).
// Interleaving granularity is the host's scheduling granularity: in the
// default cooperative CLI, threads switch between batches, not per
// instruction as on a preemptive Windows kernel.

const SYNC = new Set([
  'EnterCriticalSection', 'LeaveCriticalSection', 'TryEnterCriticalSection',
  'InitializeCriticalSection', 'InitializeCriticalSectionAndSpinCount', 'DeleteCriticalSection',
  'WaitForSingleObject', 'WaitForSingleObjectEx', 'WaitForMultipleObjects',
  'WaitForMultipleObjectsEx', 'MsgWaitForMultipleObjects', 'MsgWaitForMultipleObjectsEx',
  'SetEvent', 'ResetEvent', 'PulseEvent', 'CreateEventA', 'CreateEventW',
  'CreateSemaphoreA', 'CreateSemaphoreW', 'ReleaseSemaphore', 'CreateMutexA', 'CreateMutexW',
  'ReleaseMutex', 'InterlockedIncrement', 'InterlockedDecrement', 'InterlockedExchange',
  'InterlockedCompareExchange', 'InterlockedExchangeAdd', 'Sleep', 'SleepEx', 'SwitchToThread',
  'CreateThread', '_beginthreadex', '_beginthread', 'ExitThread', 'SuspendThread', 'ResumeThread',
  'SetThreadPriority', 'TlsAlloc', 'TlsGetValue', 'TlsSetValue',
]);
const GL_WIN = new Set(['SwapBuffers', 'ChoosePixelFormat', 'SetPixelFormat', 'DescribePixelFormat']);

function family(name) {
  if (/^(IDirect3D\w*9(Ex)?_|Direct3DCreate9)/.test(name)) return 'd3d9';
  if (/^(IDirect3D\w*8_|Direct3DCreate8)/.test(name)) return 'd3d8';
  if (/^(IDirectDraw|IDirect3D|DirectDrawCreate)/.test(name)) return 'ddraw';
  if (/^_?(gr|gu)[A-Z]/.test(name)) return 'glide';
  if (/^(gl|wgl)[A-Z]/.test(name) || GL_WIN.has(name)) return 'gl';
  if (SYNC.has(name)) return 'sync';
  return 'other';
}
const GFX = new Set(['d3d9', 'd3d8', 'ddraw', 'glide', 'gl']);
const isPresent = n => /_(Present|Flip)$/.test(n) || n === 'SwapBuffers' ||
  n === 'wglSwapBuffers' || n === 'wglSwapLayerBuffers' || /^_?grBufferSwap/.test(n);
const isLock = n => /_(Lock|LockRect|LockBox)$/.test(n) || /^_?grLfbLock/.test(n);
const isUnlock = n => /_(Unlock|UnlockRect|UnlockBox)$/.test(n) || /^_?grLfbUnlock/.test(n);
// Device/context lifetime, resource creation and uploads: printed per thread
// in full (not just the top names), because one call on another thread is
// exactly the finding.
const SETUP = /^(wgl|ChoosePixelFormat|SetPixelFormat|Direct3DCreate|DirectDrawCreate)|_(CreateDevice|Reset|SetCooperativeLevel|SetDisplayMode|CreateSurface|CreateTexture|CreateCubeTexture|CreateVolumeTexture|CreateVertexBuffer|CreateIndexBuffer|CreateRenderTarget|CreateDepthStencilSurface|CreateExecuteBuffer|Load|UpdateSurface|UpdateTexture)$|^_?gr(GlideInit|SstWinOpen|SstWinClose|GlideShutdown|TexDownload)|^gl(TexImage|TexSubImage|GenTextures|DeleteTextures|NewList|EndList|CallList)/;
const iface = n => (n.includes('_') && /^I[A-Z]/.test(n)) ? n.slice(0, n.indexOf('_')) : null;

function createApiThreadCensus(opts = {}) {
  const threadName = opts.threadName || (id => `tid${id}`);
  const perThread = new Map();    // tid -> { fam: Map, names: Map, first, last }
  const objects = new Map();      // this -> { iface, tids: Map<tid, Map<name,count>> }
  const frames = [];              // completed frames: Map<tid, gfxCalls>
  let frame = new Map();
  let frameEndScene = 0;
  let lastGfxTid = -1;
  let gfxCalls = 0, gfxSwitches = 0;
  const openLocks = new Map();    // key -> { tid, name, batch, foreign:Set }
  const lockStats = { locks: 0, crossUnlock: 0, foreignDuring: 0, foreignTids: new Map(), maxSpan: 0, examples: [] };
  const sample = { crossUnlock: [], foreign: [] };
  let calls = 0;
  const setup = new Map();         // tid -> Map<name,count>
  const createDevice = [];

  function record(tid, name, batch, thisPtr, readArg) {
    calls++;
    const fam = family(name);
    let t = perThread.get(tid);
    if (!t) { t = { fam: new Map(), names: new Map(), first: batch, last: batch }; perThread.set(tid, t); }
    t.last = batch;
    t.fam.set(fam, (t.fam.get(fam) || 0) + 1);
    if (fam !== 'other') t.names.set(name, (t.names.get(name) || 0) + 1);
    // Any call by a thread other than a lock's owner, inside the span.
    for (const L of openLocks.values()) if (L.tid !== tid) L.foreign.add(tid);
    if (!GFX.has(fam)) return;
    if (SETUP.test(name)) {
      let m = setup.get(tid); if (!m) { m = new Map(); setup.set(tid, m); }
      m.set(name, (m.get(name) || 0) + 1);
    }
    if (/^IDirect3D[89]_CreateDevice$/.test(name) && readArg && createDevice.length < 8) {
      const f = readArg(4) >>> 0;
      const bits = [[0x4, 'MULTITHREADED'], [0x20, 'SOFTWARE_VP'], [0x40, 'HARDWARE_VP'], [0x80, 'MIXED_VP'], [0x2, 'FPU_PRESERVE'], [0x10, 'PUREDEVICE']].filter(([b]) => f & b).map(([, n]) => n);
      createDevice.push(`${name} on ${threadName(tid)} @b${batch} BehaviorFlags=0x${f.toString(16)} ${bits.join('|')}`);
    }
    gfxCalls++;
    if (lastGfxTid >= 0 && lastGfxTid !== tid) gfxSwitches++;
    lastGfxTid = tid;
    frame.set(tid, (frame.get(tid) || 0) + 1);
    const ifc = iface(name);
    if (ifc && thisPtr) {
      let o = objects.get(thisPtr);
      if (!o || o.iface !== ifc) { o = { iface: ifc, tids: new Map() }; objects.set(thisPtr, o); }
      let m = o.tids.get(tid);
      if (!m) { m = new Map(); o.tids.set(tid, m); }
      m.set(name, (m.get(name) || 0) + 1);
    }
    const key = ifc ? `${thisPtr >>> 0}` : name.replace(/^_/, '').replace(/(Un)?[Ll]ock.*$/, '');
    if (isLock(name)) {
      lockStats.locks++;
      openLocks.set(key, { tid, name, batch, foreign: new Set() });
    } else if (isUnlock(name)) {
      const L = openLocks.get(key);
      if (L) {
        openLocks.delete(key);
        const span = batch - L.batch;
        if (span > lockStats.maxSpan) lockStats.maxSpan = span;
        if (L.tid !== tid) {
          lockStats.crossUnlock++;
          if (sample.crossUnlock.length < 8) sample.crossUnlock.push(`${L.name} by ${threadName(L.tid)} @b${L.batch}, ${name} by ${threadName(tid)} @b${batch}`);
        }
        if (L.foreign.size) {
          lockStats.foreignDuring++;
          for (const f of L.foreign) lockStats.foreignTids.set(f, (lockStats.foreignTids.get(f) || 0) + 1);
          if (sample.foreign.length < 8) sample.foreign.push(`${L.name} ${threadName(L.tid)} b${L.batch}..b${batch} other threads ran: ${[...L.foreign].map(threadName).join(',')}`);
        }
      }
    }
    if (/_EndScene$/.test(name)) frameEndScene++;
    if (isPresent(name)) { frames.push(frame); frame = new Map(); }
  }

  function report() {
    const out = [];
    const fams = ['d3d9', 'd3d8', 'ddraw', 'glide', 'gl', 'sync', 'other'];
    out.push(`\nAPI thread census: ${calls} calls, ${perThread.size} threads`);
    out.push('  thread    batches        ' + fams.map(f => f.padStart(9)).join(''));
    for (const [tid, t] of [...perThread].sort((a, b) => a[0] - b[0])) {
      out.push(`  ${threadName(tid).padEnd(8)}  ${String(t.first).padStart(6)}..${String(t.last).padEnd(6)} ` +
        fams.map(f => String(t.fam.get(f) || 0).padStart(9)).join(''));
    }
    for (const [tid, t] of [...perThread].sort((a, b) => a[0] - b[0])) {
      const top = [...t.names].sort((a, b) => b[1] - a[1]).slice(0, 14);
      if (top.length) out.push(`  ${threadName(tid)} top: ` + top.map(([n, c]) => `${n}=${c}`).join(' '));
    }
    for (const [tid, m] of [...setup].sort((a, b) => a[0] - b[0])) {
      out.push(`  ${threadName(tid)} setup/upload: ` + [...m].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n}=${c}`).join(' '));
    }
    for (const s of createDevice) out.push('  ' + s);
    out.push(`  gfx calls ${gfxCalls}, consecutive gfx calls on different threads: ${gfxSwitches}`);
    const multi = frames.filter(f => f.size > 1);
    const tot = new Map();
    for (const f of frames) for (const [tid, n] of f) tot.set(tid, (tot.get(tid) || 0) + n);
    out.push(`  frames (Present/Flip/SwapBuffers/grBufferSwap) ${frames.length}, EndScene ${frameEndScene}, ` +
      `frames with gfx calls from >1 thread: ${multi.length}`);
    if (frames.length) out.push('  calls/frame by thread: ' + [...tot].map(([tid, n]) => `${threadName(tid)}=${(n / frames.length).toFixed(1)}`).join(' '));
    if (frame.size) out.push('  after last present: ' + [...frame].map(([tid, n]) => `${threadName(tid)}=${n}`).join(' '));
    const shared = [...objects].filter(([, o]) => o.tids.size > 1);
    const byIface = new Map();
    for (const [, o] of objects) {
      const k = o.iface; const e = byIface.get(k) || { n: 0, shared: 0 };
      e.n++; if (o.tids.size > 1) e.shared++; byIface.set(k, e);
    }
    out.push('  objects by interface (total/touched by >1 thread): ' + [...byIface].map(([k, e]) => `${k}=${e.n}/${e.shared}`).join(' '));
    for (const [ptr, o] of shared.slice(0, 12)) {
      out.push(`  shared ${o.iface}@0x${(ptr >>> 0).toString(16)}: ` + [...o.tids].map(([tid, m]) =>
        `${threadName(tid)}{${[...m].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => `${n.slice(n.indexOf('_') + 1)}=${c}`).join(' ')}}`).join(' | '));
    }
    out.push(`  locks ${lockStats.locks}, unlocked by another thread ${lockStats.crossUnlock}, ` +
      `other thread made API calls inside the span ${lockStats.foreignDuring} ` +
      `(${[...lockStats.foreignTids].map(([t, n]) => `${threadName(t)}=${n}`).join(' ')}), max span ${lockStats.maxSpan} batches, still open ${openLocks.size}`);
    for (const s of sample.crossUnlock) out.push('    cross-unlock: ' + s);
    for (const s of sample.foreign) out.push('    foreign-in-span: ' + s);
    return out.join('\n');
  }

  return { record, report, family };
}

module.exports = { createApiThreadCensus, family };
