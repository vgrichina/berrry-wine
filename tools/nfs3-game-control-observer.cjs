'use strict';

// Opt-in, bounded native dispatcher observation. Reads the calling instance's
// registers and returned buffers; never calls a guest API, pumps input or yields.
const nargs = {
  GetKeyboardState: 1, GetKeyState: 1, GetAsyncKeyState: 1,
  PeekMessageA: 5, PeekMessageW: 5, GetMessageA: 4, GetMessageW: 4,
  IDirectInputDevice_GetDeviceState: 3, IDirectInputDevice_GetDeviceData: 5,
  IDirectInputDevice_SetDataFormat: 2, IDirectInputDevice_SetProperty: 3,
  IDirectInputDevice_SetCooperativeLevel: 3, IDirectInputDevice_Acquire: 1,
  IDirectInputDevice_Unacquire: 1, IDirectInputDevice_Poll: 1,
};

function createObserver({capacity = 4096, now = Date.now, mono = () => performance.now(),
  translate, apiNames = [], game = false} = {}) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 16384) throw Error('capacity');
  const ring = new Array(capacity), configurations = [], totals = {}, errors = [];
  let count = 0, instances = 0;
  function record(row) { ring[count++ % capacity] = row; }
  function wrapImports(imports) {
    const h = imports.host;
    if (!h?.memory || typeof h.log !== 'function') return () => {};
    const id = ++instances, memory = h.memory;
    let e, pending = null, ordinal = -1, lastIdle = -Infinity;
    const readBytes = (ptr, length) => {
      if (!Number.isInteger(length) || length < 0 || length > 4096) throw Error('bounded read');
      const address = translate(ptr >>> 0, e.get_image_base(), memory.buffer);
      return Array.from(new Uint8Array(memory.buffer, address, length));
    };
    const read32 = ptr => {
      const a = readBytes(ptr, 4);
      return (a[0] | a[1] << 8 | a[2] << 16 | a[3] << 24) >>> 0;
    };
    const fail = error => { if (errors.length < 32) errors.push(String(error)); };
    const oldInt = h.log_i32;
    if (oldInt) h.log_i32 = function(value) {
      if ((value >>> 16) === 0xc0de) ordinal = value & 65535;
      return Reflect.apply(oldInt, this, arguments);
    };
    const oldLog = h.log;
    h.log = function(ptr, length) {
      pending = null;
      try {
        if (e) {
          const bytes = new Uint8Array(memory.buffer, ptr >>> 0, Math.min(length >>> 0, 256));
          let name = ''; for (const b of bytes) { if (!b) break; name += String.fromCharCode(b); }
          if (name === '<ord>' && ordinal >= 0) name = apiNames[ordinal]?.name || name;
          ordinal = -1;
          if (Object.hasOwn(nargs, name)) {
            const sp = e.get_esp() >>> 0;
            pending = {instance: id, thread: e.get_current_thread_id(), process: e.get_process_id(),
              name, at: now(), mono: mono(), sp,
              args: Array.from({length:nargs[name]}, (_, i) => read32(sp + 4 + i * 4)), liveReads: []};
            if (name.endsWith('_SetDataFormat')) {
              const f = pending.args[1], header = readBytes(f, 24), objects = read32(f + 16), stride = read32(f + 4);
              pending.format = {header, objects: stride >= 16 && stride <= 32 && objects <= 256
                ? readBytes(read32(f + 20), Math.min(4096, objects * stride)) : null};
            }
          }
        }
      } catch (error) { fail(error); }
      return Reflect.apply(oldLog, this, arguments);
    };
    for (const name of ['get_key_down_state', 'get_async_key_state', 'di_keyboard_buffer']) {
      const original = h[name]; if (typeof original !== 'function') continue;
      h[name] = function(...args) {
        const result = Reflect.apply(original, this, args);
        if (pending && pending.liveReads.length < 64 && (name === 'di_keyboard_buffer' || [27,37,38,39].includes(args[0])))
          pending.liveReads.push({host: name, args, result, at: now()});
        return result;
      };
    }
    const oldExit = h.log_api_exit;
    h.log_api_exit = function(...args) {
      // Observe before downstream diagnostics can re-enter native code.
      const p = pending; pending = null;
      try {
        if (p && e) {
          const row = {...p, returnedAt: now(), returnedMono: mono(), eax: e.get_eax() >>> 0,
            doneSp: e.get_esp() >>> 0, yieldReason: e.get_yield_reason(), yieldFlag: e.get_yield_flag(),
            boundary: 'native-handler-return', gameAction: false};
          row.complete = !row.yieldReason && !row.yieldFlag && row.doneSp === row.sp + 4 * (p.args.length + 1);
          if (row.complete) {
            if (p.name === 'GetKeyboardState' && row.eax) row.bytes = readBytes(p.args[0], 256);
            if (p.name.endsWith('_GetDeviceState') && !row.eax) row.bytes = readBytes(p.args[2], p.args[1]);
            if (p.name.endsWith('_GetDeviceData') && (row.eax === 0 || row.eax === 1)) {
              row.records = read32(p.args[3]);
              if (p.args[2]) row.bytes = readBytes(p.args[2], Math.min(4096, row.records * p.args[1]));
            }
            if (/^(Get|Peek)Message[AW]$/.test(p.name) && row.eax) row.msg = readBytes(p.args[0], 16);
            if (game && e.get_image_base() === 0x400000 &&
                (!/Message[AW]$/.test(p.name) || row.msg || p.at - lastIdle >= 1000)) row.game = {
              keyScans: readBytes(0x562f28, 256), installedBindings: readBytes(0x79a340, 52),
              configuredBindings: readBytes(0x6fb20c, 104), mode: read32(0x6fb3b0),
              transmission: read32(0x6fb2d4), packet: readBytes(0x79a338, 4),
              simulationPacket: readBytes(0x79a4a8, 4), pollCounter: read32(0x79a4ac),
              playerSelector: read32(0x7cba58), queueGate: read32(0x6fb3a0),
            };
          }
          const key = `${id}:${p.thread}:${p.name}:${p.name.startsWith('IDirectInput') ? p.args[0] : ''}`;
          const t = totals[key] ||= {calls:0, complete:0, firstAt:p.at, lastAt:null, maxIntervalMs:0};
          t.calls++; if (row.complete) t.complete++;
          if (t.lastAt !== null) t.maxIntervalMs = Math.max(t.maxIntervalMs, p.at - t.lastAt);
          t.lastAt = p.at;
          if (/_(Set|Acquire|Unacquire)/.test(p.name) && configurations.length < 256) configurations.push(row);
          if (!/Message[AW]$/.test(p.name) || row.msg || p.at - lastIdle >= 1000) {
            record(row);
            if (/Message[AW]$/.test(p.name) && !row.msg) lastIdle = p.at;
          }
        }
      } catch (error) { fail(error); }
      if (oldExit) return Reflect.apply(oldExit, this, args);
    };
    return instance => { e = instance.exports; };
  }
  return {wrapImports, report() {
    const kept = Math.min(count, capacity), start = count - kept;
    return {passive:true, extraNativeCalls:0, capacity, count, overwritten:start, instances,
      errors, totals, configurations, rows:Array.from({length:kept}, (_, i) => ring[(start+i)%capacity])};
  }};
}

function install(observer, wasm = WebAssembly) {
  const Instance = wasm.Instance, instantiate = wasm.instantiate;
  wasm.Instance = new Proxy(Instance, {construct(target, args, receiver) {
    const bind = observer.wrapImports(args[1] || {});
    const instance = Reflect.construct(target, args, receiver); bind(instance); return instance;
  }});
  wasm.instantiate = async function(module, imports, ...rest) {
    const bind = observer.wrapImports(imports || {});
    const result = await Reflect.apply(instantiate, this, [module, imports, ...rest]);
    bind(result.instance || result); return result;
  };
  return () => { wasm.Instance = Instance; wasm.instantiate = instantiate; };
}

module.exports = {createObserver, install};
if (process.env.NFS_GAME_CONTROL_TRACE) {
  const {threadId} = require('node:worker_threads');
  const observer = createObserver({translate:require('../lib/mem-utils').g2w,
    apiNames:require('../src/api_table.json'), game:process.env.NFS_GAME_CONTROL_ORIGINAL === '1'});
  install(observer);
  globalThis.nfs3GameControlReport = () => observer.report();
  // Render Workers inherit NODE_OPTIONS too. Each writer keeps its own file;
  // an empty render-worker report must never replace the CPU owner's report.
  process.once('exit', () => require('node:fs').writeFileSync(
    `${process.env.NFS_GAME_CONTROL_TRACE}.${process.pid}-${threadId}.json`,
    JSON.stringify({pid:process.pid, hostThread:threadId, ...observer.report()})));
}
