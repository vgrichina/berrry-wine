#!/usr/bin/env node
'use strict';

// AoE2's gameplay loop exposed two artificial Worker transports: every API
// dispatch posted no-op logging messages, and GetKeyboardState parked once for
// each of its 256 entries. Keep normal logging local and snapshot the keyboard
// through one pointer-safe synchronous import.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const RPC = require('../lib/guest-rpc');
const D3D = require('../lib/d3d-command-stream');
const { GuestThreadHost, WorkerLink } = require('../lib/guest-thread-host');
const { createWindowHost } = require('../lib/host-window');

const ROOT = path.resolve(__dirname, '..');
const { parseSource } = require('../tools/watx');

// A helper may forward the upload result, but no caller may consume the
// Worker's predicted answer. Use the compiler's parser so comments, whitespace
// and nested operands cannot disguise which expression owns a call.
function checkGdiUploadResults(file, text) {
  function visit(node, parent) {
    if (!Array.isArray(node)) return;
    if (node[1] === 'call' &&
        (node[2] === '$host_gdi_surface_upload' || node[2] === '$gdi_write_surface_upload')) {
      const dropped = parent && parent[1] === 'drop' && parent.length === 3 && parent[2] === node;
      const forwarded = node[2] === '$host_gdi_surface_upload' && parent &&
        parent[1] === 'func' && parent[2] === '$gdi_write_surface_upload' &&
        parent[parent.length - 1] === node && parent.some(child =>
          Array.isArray(child) && child.length === 3 && child[1] === 'result' && child[2] === 'i32');
      assert(dropped || forwarded,
        `${file} consumes ${node[2]}'s result; the Worker answer is asynchronous`);
    }
    for (const child of node) if (Array.isArray(child)) visit(child, node);
  }
  for (const form of parseSource(text)) visit(form, null);
}

{
  const wrapper = '(func $gdi_write_surface_upload (result i32) (call $host_gdi_surface_upload))';
  checkGdiUploadResults('forwarding fixture', wrapper +
    '(func $caller (drop ;; discard the asynchronous answer\n (call $gdi_write_surface_upload)))');
  for (const name of ['$gdi_write_surface_upload', '$host_gdi_surface_upload']) {
    assert.throws(() => checkGdiUploadResults('consumed result fixture', wrapper +
      `(func $caller (result i32) (call ${name}))`), /consumes/);
    assert.throws(() => checkGdiUploadResults('nested result fixture', wrapper +
      `(func $caller (drop (i32.add (call ${name}) (i32.const 1))))`), /consumes/);
  }
}

// The Worker import factory creates views at THREAD_RPC near the end of the
// fixed 512MB address space. SharedArrayBuffer reserves this virtually; the
// test touches only one 256-byte control block.
const memory = { buffer: new SharedArrayBuffer(8192 * 65536) };

// DllMain runs synchronously inside the guest Worker. Its Sleep continuation
// therefore advances the authoritative host clock through a data-only request,
// then reads the published result locally before executing another x86 block.
const clockMemory = { buffer: new SharedArrayBuffer(8192 * 65536) };
let authoritativeTick = 125;
const clockMain = RPC.createMainBroker(clockMemory, {}, {}, {});
clockMain.publish({ tickMs: authoritativeTick });
const clockWorker = RPC.createWorkerImports(clockMemory, {
  get_ticks: { params: [], results: ['i32'] },
}, message => {
  assert.strictEqual(message.t, 'advanceGuestTime');
  authoritativeTick += message.ms;
  clockMain.serveClockAdvance(message.slot, authoritativeTick);
});
assert.strictEqual(clockWorker.imports.host.get_ticks(), 125);
assert.strictEqual(clockWorker.advanceGuestTime(500), 625);
assert.strictEqual(clockWorker.imports.host.get_ticks(), 625,
  'Worker GetTickCount observes a synchronous DllMain Sleep before resuming');

const sigs = {
  log: { params: ['i32', 'i32'], results: [] },
  log_i32: { params: ['i32'], results: [] },
  log_api_exit: { params: [], results: [] },
  dx_trace: { params: ['i32', 'i32', 'i32', 'i32', 'i32'], results: [] },
};

let posted = 0;
const quiet = RPC.createWorkerImports(memory, sigs, () => { posted++; }, {
  slot: 0,
  forwardGuestLogs: false,
});
quiet.imports.host.log(0, 0);
quiet.imports.host.log_i32(0xC0DE0001);
quiet.imports.host.log_api_exit();
assert.strictEqual(posted, 0,
  'trace-disabled API hooks must not post messages to the browser');
assert.deepStrictEqual(quiet.stats, { sync: 0, async: 0, local: 3 },
  'suppressed hooks are reported as Worker-local work');

const beforeDx = posted;
quiet.imports.host.dx_trace(15, 7, 4, 0x1c4, 12);
assert.strictEqual(posted, beforeDx,
  'fire-and-forget calls are queued, not posted one message each');
quiet.flushAsync();
assert.strictEqual(posted, beforeDx + 1,
  'D3D trace values use ordered fire-and-forget Worker transport');
assert.deepStrictEqual(quiet.stats, { sync: 0, async: 1, local: 3 },
  'D3D trace must never add a synchronous Worker round trip');

const tracedMessages = [];
const traced = RPC.createWorkerImports(memory, sigs, message => tracedMessages.push(message), {
  slot: 0,
  forwardGuestLogs: true,
});
traced.imports.host.log(0, 0);
traced.imports.host.log_i32(0xC0DE0001);
traced.imports.host.log_api_exit();
traced.flushAsync();
assert.strictEqual(tracedMessages.length, 1,
  'queued fire-and-forget calls travel as one batch');
assert.strictEqual(tracedMessages[0].t, 'calls');
assert.strictEqual(tracedMessages[0].list.length, 6,
  'verbose/API-trace mode must preserve all three logging hooks');
assert.deepStrictEqual(tracedMessages[0].list.filter((_, i) => i % 2 === 0),
  ['log', 'log_i32', 'log_api_exit'].map(n => traced.names.indexOf(n)),
  'a batch keeps the order the guest made the calls in');

// Anything else the Worker posts drains the queue first, so the page can
// never see a blocking request (or a slice reply) ahead of earlier calls.
const orderSigs = { ...sigs, get_window_rect: { params: ['i32', 'i32'], results: [] } };
const orderMessages = [];
const ordered = RPC.createWorkerImports(memory, orderSigs, message => {
  orderMessages.push(message);
  if (message.t === 'rpc') {
    const w = RPC.views(memory, 0);
    Atomics.store(w.i32, RPC.SLOT.STATUS, RPC.STATUS_RESP);
  }
}, { slot: 0, forwardGuestLogs: true });
ordered.imports.host.log_i32(0xC0DE0002);
assert.strictEqual(orderMessages.length, 0);
ordered.imports.host.get_window_rect(1, 2);
assert.deepStrictEqual(orderMessages.map(m => m.t), ['calls', 'rpc'],
  'a blocking request is preceded by the queued batch');

// get_window_rect: answered from the worker's cache until GEN moves or this
// thread makes any other blocking call (the guest's only way to move a window).
{
  const rectSigs = {
    get_window_rect: { params: ['i32', 'i32'], results: [] },
    move_window: { params: ['i32', 'i32'], results: [] },
  };
  const rpcs = [];
  const RECT = 0x100000;
  const w = RPC.createWorkerImports(memory, rectSigs, message => {
    if (message.t !== 'rpc') return;
    const c = RPC.views(memory, 0);
    const fn = c.i32[RPC.SLOT.FN];
    rpcs.push(w.names[fn]);
    if (w.names[fn] === 'get_window_rect') {
      const dv = new DataView(memory.buffer);
      [10, 20, 330, 260].forEach((n, i) => dv.setInt32(c.i32[RPC.SLOT.ARGS + 1] + i * 4, n + rpcs.length, true));
    }
    Atomics.store(c.i32, RPC.SLOT.STATUS, RPC.STATUS_RESP);
  }, { slot: 0 });
  const read = () => Array.from(new Int32Array(memory.buffer, RECT, 4));
  const host = w.imports.host;
  host.get_window_rect(0x10002, RECT);
  const first = read();
  new Int32Array(memory.buffer, RECT, 4).fill(0);
  host.get_window_rect(0x10002, RECT);
  assert.deepStrictEqual(read(), first, 'a repeat query is written back from the cache');
  assert.deepStrictEqual(rpcs, ['get_window_rect'], 'without a round trip');
  host.move_window(0x10002, 0);
  host.get_window_rect(0x10002, RECT);
  assert.deepStrictEqual(rpcs, ['get_window_rect', 'move_window', 'get_window_rect'],
    'another blocking call drops the cache');
  Atomics.add(RPC.views(memory, 0).pub, RPC.SLOT.GEN, 1);
  host.get_window_rect(0x10002, RECT);
  assert.strictEqual(rpcs.length, 4, 'a publish (GEN) drops the cache');
}

// Served in order on the main side, one served count per call.
const servedOrder = [];
const batchMain = RPC.createMainBroker(memory, {
  log_i32: v => servedOrder.push(v >>> 0),
  log: () => servedOrder.push('log'),
  log_api_exit: () => servedOrder.push('exit'),
  dx_trace: () => servedOrder.push('dx'),
}, sigs, {});
const ids = n => traced.names.indexOf(n);
batchMain.serveCalls({ slot: 0, list: [ids('log_i32'), [7], ids('dx_trace'), [1, 2, 3, 4, 5], ids('log_api_exit'), []] });
assert.deepStrictEqual(servedOrder, [7, 'dx', 'exit']);

// A published key bitmap answers get_key_down_state with no round trip while
// no input event is open; before anything is published it still asks.
{
  const keyMemory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const keySigs = {
    get_key_down_state: { params: ['i32'], results: ['i32'] },
    check_input: { params: [], results: ['i32'] },
  };
  const keyMessages = [];
  const keyMain = RPC.createMainBroker(keyMemory, {}, keySigs, {});
  const keyWorker = RPC.createWorkerImports(keyMemory, keySigs, message => {
    keyMessages.push(message);
    if (message.t === 'rpc') {
      const w = RPC.views(keyMemory, 0);
      w.i32[RPC.SLOT.RESULT] = 0x1234;
      Atomics.store(w.i32, RPC.SLOT.STATUS, RPC.STATUS_RESP);
    }
  }, { slot: 0 });
  assert.strictEqual(keyWorker.imports.host.get_key_down_state(0x41), 0x1234,
    'nothing published yet: the page answers');
  assert.strictEqual(keyMessages.length, 1);
  const keys = new Int32Array(8);
  keys[0x41 >>> 5] |= 1 << (0x41 & 31);
  keyMain.publish({ keys });
  keyMessages.length = 0;
  assert.strictEqual(keyWorker.imports.host.get_key_down_state(0x41), 0x8000);
  assert.strictEqual(keyWorker.imports.host.get_key_down_state(0x42), 0);
  assert.strictEqual(keyMessages.length, 0, 'the published bitmap answers locally');
  // An open event (check_input returned one) routes back to the page, whose
  // answer comes from that event's own key snapshot.
  keyMain.publish({ inputPending: 1 });
  assert.notStrictEqual(keyWorker.imports.host.check_input(), 0);
  keyMessages.length = 0;
  assert.strictEqual(keyWorker.imports.host.get_key_down_state(0x41), 0x1234);
  assert.strictEqual(keyMessages.length, 1, 'an open event asks the page');
}

// get_mouse_position reads the published pointer while no event is open; a
// set_mouse_position this thread sent asynchronously forces one round trip.
{
  const mMemory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const mSigs = {
    get_mouse_position: { params: [], results: ['i32'] },
    set_mouse_position: { params: ['i32', 'i32'], results: [] },
  };
  const mMessages = [];
  const mMain = RPC.createMainBroker(mMemory, {}, mSigs, {});
  const mWorker = RPC.createWorkerImports(mMemory, mSigs, message => {
    mMessages.push(message);
    if (message.t === 'rpc') {
      const w = RPC.views(mMemory, 0);
      w.i32[RPC.SLOT.RESULT] = 0x00070009;
      Atomics.store(w.i32, RPC.SLOT.STATUS, RPC.STATUS_RESP);
    }
  }, { slot: 0 });
  const h = mWorker.imports.host;
  assert.strictEqual(h.get_mouse_position(), 0x00070009, 'nothing published: the page answers');
  mMain.publish({ mouseX: 300, mouseY: 200 });
  mMessages.length = 0;
  assert.strictEqual(h.get_mouse_position(), (200 << 16) | 300);
  assert.strictEqual(mMessages.length, 0, 'the published pointer answers locally');
  h.set_mouse_position(5, 6);
  assert.strictEqual(h.get_mouse_position(), 0x00070009,
    'the read after this thread moved the cursor asks the page');
  assert.deepStrictEqual(mMessages.map(m => m.t), ['calls', 'rpc'],
    'and flushes the queued set_mouse_position ahead of it');
  mMessages.length = 0;
  assert.strictEqual(h.get_mouse_position(), (200 << 16) | 300);
  assert.strictEqual(mMessages.length, 0);
}

// dxTraceLocal: Lock/Unlock stay in the Worker as shared counters; presents,
// surface lifetime and a slot's first sighting are still forwarded.
{
  const dMemory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const dSigs = {
    dx_trace: { params: ['i32', 'i32', 'i32', 'i32', 'i32'], results: [] },
    gdi_surface_create: { params: Array(12).fill('i32'), results: ['i32'] },
    gdi_surface_attach: { params: ['i32', 'i32'], results: ['i32'] },
    gdi_surface_upload: { params: ['i32', 'i32', 'i32', 'i32', 'i32'], results: ['i32'] },
    gdi_surface_delete: { params: ['i32'], results: ['i32'] },
  };
  const dMessages = [];
  const dMain = RPC.createMainBroker(dMemory, {
    gdi_surface_attach: () => 0,
  }, dSigs, {});
  let rpcAnswer = 1;
  const dWorker = RPC.createWorkerImports(dMemory, dSigs, message => {
    dMessages.push(message);
    if (message.t === 'rpc') {
      const w = RPC.views(dMemory, 0);
      w.i32[RPC.SLOT.RESULT] = rpcAnswer;
      Atomics.store(w.i32, RPC.SLOT.STATUS, RPC.STATUS_RESP);
    }
  }, { slot: 0, dxTraceLocal: true });
  const h = dWorker.imports.host;
  const forwarded = () => {
    dWorker.flushAsync();
    const out = [];
    for (const m of dMessages.splice(0)) {
      if (m.t === 'calls') for (let i = 0; i < m.list.length; i += 2) out.push([dWorker.names[m.list[i]], ...m.list[i + 1]]);
      else out.push([m.t, dWorker.names[RPC.views(dMemory, 0).i32[RPC.SLOT.FN]]]);
    }
    return out;
  };
  h.dx_trace(1, 3, 0, 0, 0);
  assert.deepStrictEqual(dMain.dxState(), { dirty: 0, locks: 1 });
  h.dx_trace(1, 3, 0, 0, 0);
  h.dx_trace(2, 3, 0, 0, 0);
  assert.deepStrictEqual(dMain.dxState(), { dirty: 1, locks: 1 }, 'nested lock still held');
  h.dx_trace(2, 3, 0, 0, 0);
  h.dx_trace(2, 3, 0, 0, 0);
  assert.deepStrictEqual(dMain.dxState(), { dirty: 3, locks: 0 }, 'an unpaired Unlock never goes negative');
  h.dx_trace(3, 4, 3, 0, 0);
  h.dx_trace(3, 4, 3, 0, 0);
  h.dx_trace(5, 3, 0, 0, 0);
  assert.deepStrictEqual(forwarded(), [
    ['dx_trace', 13, 3, 0, 0, 0],
    ['dx_trace', 3, 4, 3, 0, 0],
    ['dx_trace', 5, 3, 0, 0, 0],
  ], 'only first sightings (lock as kind 13) and the present travel');
  h.dx_trace(22, 3, 0, 0, 0);
  h.dx_trace(1, 3, 0, 0, 0);
  assert.deepStrictEqual(forwarded(), [
    ['dx_trace', 22, 3, 0, 0, 0],
    ['dx_trace', 13, 3, 0, 0, 0],
  ], 'a released slot is announced again');

  const DX = 0x200003;
  const create = bits => h.gdi_surface_create(DX, 640, 480, 8, bits, 640, 1, 0x5000, 256, 0, 0, 0);
  assert.strictEqual(create(0x9000), 1);
  assert.strictEqual(h.gdi_surface_attach(DX, 0x10002), 1);
  assert.strictEqual(h.gdi_surface_upload(DX, 0, 0, 640, 480), 1);
  assert.deepStrictEqual(forwarded().map(r => r[0]), ['rpc', 'rpc', 'gdi_surface_upload'],
    'first present: create and attach ask, an upload never waits');
  assert.strictEqual(create(0xA000), 1, 'Flip moved the bits: still the same surface');
  assert.strictEqual(h.gdi_surface_attach(DX, 0x10002), 1);
  assert.strictEqual(h.gdi_surface_upload(DX, 0, 0, 640, 480), 1);
  assert.deepStrictEqual(forwarded(), [
    ['gdi_surface_create', DX, 640, 480, 8, 0xA000, 640, 1, 0x5000, 256, 0, 0, 0],
    ['gdi_surface_attach', DX, 0x10002],
    ['gdi_surface_upload', DX, 0, 0, 640, 480],
  ], 'a repeat present travels without waiting, arguments intact');
  assert.strictEqual(h.gdi_surface_attach(DX, 0x10004), 1);
  assert.deepStrictEqual(forwarded().map(r => r[0]), ['rpc'], 'a new target asks again');
  assert.strictEqual(h.gdi_surface_upload(0x610001, 0, 0, 1, 1), 1);
  assert.strictEqual(h.gdi_surface_upload(0x610001, 0, 0, 1, 1), 1);
  assert.deepStrictEqual(forwarded(), [
    ['gdi_surface_upload', 0x610001, 0, 0, 1, 1],
    ['gdi_surface_upload', 0x610001, 0, 0, 1, 1],
  ], 'every WAT caller drops the upload result, so a GDI upload travels without waiting too');
  // That answer is a constant 1 in a Worker. It is only honest while no WAT
  // caller looks at it.
  const srcDir = path.join(__dirname, '..', 'src');
  for (const file of fs.readdirSync(srcDir).filter(f => f.endsWith('.wat'))) {
    const text = fs.readFileSync(path.join(srcDir, file), 'utf8');
    checkGdiUploadResults(file, text);
  }
  // The page reports a predicted call that failed; the Worker drops its memo.
  dMain.serveCalls({ slot: 0, list: [dWorker.names.indexOf('gdi_surface_attach'), [DX, 0x10004]] });
  assert.strictEqual(h.gdi_surface_attach(DX, 0x10004), 1);
  assert.deepStrictEqual(forwarded().map(r => r[0]), ['rpc'], 'a failed prediction asks again');
  rpcAnswer = 0;
  assert.strictEqual(h.gdi_surface_attach(DX, 0x10006), 0);
  assert.strictEqual(h.gdi_surface_attach(DX, 0x10006), 0, 'a failure is never memoized');
  rpcAnswer = 1;
  forwarded();
  assert.strictEqual(h.gdi_surface_delete(DX), 1);
  assert.strictEqual(h.gdi_surface_attach(DX, 0x10004), 1);
  assert.deepStrictEqual(forwarded().map(r => r[0]), ['rpc', 'rpc'], 'delete drops the memo');
}

// Without dxTraceLocal every dx_trace travels (--trace-dx prints them all).
{
  const plain = [];
  const w = RPC.createWorkerImports(memory, sigs, m => plain.push(m), { slot: 0 });
  w.imports.host.dx_trace(1, 3, 0, 0, 0);
  w.imports.host.dx_trace(2, 3, 0, 0, 0);
  w.flushAsync();
  assert.strictEqual(plain[0].list.length, 4);
}

const legacyMessages = [];
const legacy = RPC.createWorkerImports(memory, sigs, message => legacyMessages.push(message), {
  slot: 0,
  forwardGlLogs: true,
});
legacy.imports.host.log_i32(0xC0DE0001);
legacy.flushAsync();
assert.strictEqual(legacyMessages.length, 1,
  'cached callers using the old transport option remain compatible');

const linkOptions = {
  slot: 1, memory, module: {}, sigs, broker: {}, workerUrl: 'unused',
};
assert.strictEqual(new WorkerLink({ ...linkOptions, forwardGuestLogs: true }).forwardGuestLogs, true,
  'WorkerLink accepts the accurately named diagnostic transport option');
assert.strictEqual(new WorkerLink({ ...linkOptions, forwardGlLogs: true }).forwardGuestLogs, true,
  'WorkerLink preserves the cached OpenGL-era option as an input alias');
assert.strictEqual(new GuestThreadHost({
  memory, module: {}, sigs, hostImports: {}, forwardGuestLogs: true,
}).forwardGuestLogs, true, 'GuestThreadHost forwards the complete guest diagnostic channel');

const cliSource = fs.readFileSync(path.join(ROOT, 'test', 'run.js'), 'utf8');
assert(cliSource.includes('forwardGuestLogs: VERBOSE || TRACE_API || TRACE_API_COUNTS ||'),
  'CLI Worker diagnostics must opt into transport when explicit trace flags are active');

const keyboardMemory = new ArrayBuffer(1024);
const renderer = {
  canvas: { style: { cursor: 'default' } },
  peekKeyDownState(vKey) {
    return vKey === 0x01 || vKey === 0x41 ? 0x8000 : 0;
  },
};
const windowHost = createWindowHost({
  renderer,
  getMemory: () => keyboardMemory,
}, {
  readStr: () => '',
  readStrW: () => '',
  cursorCssForHandle: () => '',
  cursorCssFromPixels: () => '',
  builtCursorCssFor: () => '',
});
assert.strictEqual(windowHost.imports.get_keyboard_state(128), 1,
  'keyboard snapshot succeeds for an in-bounds 256-byte destination');
const keys = new Uint8Array(keyboardMemory, 128, 256);
assert.strictEqual(keys[0x01], 0x80, 'mouse-button VK state is included');
assert.strictEqual(keys[0x41], 0x80, 'held keyboard VK state is included');
assert.strictEqual(keys[0x40], 0, 'released keys remain clear');
assert.strictEqual(windowHost.imports.get_keyboard_state(900), 0,
  'out-of-bounds snapshots fail without partially writing memory');

windowHost.imports.set_cursor(0);
assert.strictEqual(renderer.canvas.style.cursor, 'none',
  'SetCursor(NULL) hides the browser cursor for software-cursor games');
windowHost.imports.set_cursor(0x67F00);
assert.strictEqual(renderer.canvas.style.cursor, 'default',
  'selecting IDC_ARROW restores the browser cursor');

const wat = require('./wat-source-closure').readWatSourceClosure();
const begin = wat.indexOf('(func $handle_GetKeyboardState');
const end = wat.indexOf('\n  (func ', begin + 1);
assert(begin >= 0 && end > begin, 'GetKeyboardState handler is present');
const handler = wat.slice(begin, end);
assert(handler.includes('(call $host_get_keyboard_state'),
  'GetKeyboardState uses the batched host snapshot');
assert(!handler.includes('$host_get_key_down_state') && !handler.includes('(loop'),
  'GetKeyboardState no longer performs 256 scalar host calls');

const generated = require('../lib/host-import-sigs.generated.json');
assert.deepStrictEqual(generated.sigs.get_keyboard_state,
  { params: ['i32'], results: ['i32'] },
  'generated Worker signature includes the snapshot import');

// D3DIM's opt-in Worker transport must own every byte before the guest handler
// frees/reuses its temporary packed vertices. A synchronous fake consumer also
// exercises sequence publication and the mandatory fence without timing races.
const d3dMemory = { buffer: new SharedArrayBuffer(16384) };
const d3dBytes = new Uint8Array(d3dMemory.buffer);
const descriptor = 64;
const state = 512;
const vertices = 8192;
new Uint32Array(d3dMemory.buffer, descriptor, 6).set([
  0x1000, 4, 3, vertices, 3, state,
]);
d3dBytes.fill(0x5a, state, state + D3D.STATE_BYTES);
d3dBytes.fill(0xa5, vertices, vertices + 96);
const replayed = [];
class FakeRenderWorker {
  postMessage(message) {
    if (message.t === 'init') {
      this.control = new Int32Array(message.control);
      this.buffers = message.buffers;
      Atomics.store(this.control, D3D.CTRL.READY, 1);
      return;
    }
    if (message.t === 'batch') {
      replayed.push(new Uint8Array(this.buffers[message.index], 0, message.bytes).slice());
      Atomics.store(this.control, D3D.CTRL.COMPLETED, message.seq);
      Atomics.notify(this.control, D3D.CTRL.COMPLETED);
    }
  }
  terminate() {}
}

let defaultWorkerUrl = null;
const savedWorker = global.Worker;
const savedSourceVersion = global.WINE_SOURCE_VERSION;
global.WINE_SOURCE_VERSION = 'worker test/1';
global.Worker = class extends FakeRenderWorker {
  constructor(url) {
    super();
    defaultWorkerUrl = url;
  }
};
const defaultD3d = new D3D.Encoder({
  memory: d3dMemory, module: {}, sigs: {}, capacity: 8192, bufferCount: 2,
  guestToWasm: value => value, getImageBase: () => 0x400000,
});
defaultD3d.stop();
if (savedWorker === undefined) delete global.Worker;
else global.Worker = savedWorker;
if (savedSourceVersion === undefined) delete global.WINE_SOURCE_VERSION;
else global.WINE_SOURCE_VERSION = savedSourceVersion;
const guestWorkerSource = fs.readFileSync(path.join(ROOT, 'lib', 'guest-worker.js'), 'utf8');
assert.strictEqual(defaultWorkerUrl, 'd3d-render-worker.js?v=worker%20test%2F1',
  'the standalone Encoder default must encode the shared source version');
assert(guestWorkerSource.includes("workerUrl: versionedWorkerUrl('d3d-render-worker.js')"),
  'guest-worker must pass its inherited source version to the D3D render worker');

const d3d = new D3D.Encoder({
  memory: d3dMemory, module: {}, sigs: {}, capacity: 8192, bufferCount: 2,
  guestToWasm: value => value, getImageBase: () => 0x400000,
  workerFactory: () => new FakeRenderWorker(),
});
assert.strictEqual(d3d.call(D3D.DRAW_OPCODE, descriptor), 1,
  'valid D3DIM draw is accepted by the render command stream');
d3dBytes.fill(0, state, state + D3D.STATE_BYTES);
d3dBytes.fill(0, vertices, vertices + 96);
assert.strictEqual(d3d.call(D3D.FENCE_OPCODE, 0), 1,
  'D3DIM fence waits through the last submitted sequence');
assert.strictEqual(replayed.length, 1, 'fence submitted exactly one pending batch');
assert.strictEqual(replayed[0][D3D.HEADER_BYTES], 0x5a,
  'device state was copied before the guest reused it');
assert.strictEqual(replayed[0][D3D.HEADER_BYTES + D3D.STATE_BYTES], 0xa5,
  'canonical vertices were copied before the guest freed them');
assert.deepStrictEqual(d3d.stats,
  {
    queued: 1, submissions: 1, fences: 1, waits: 0, fallbacks: 0,
    bytes: D3D.STATE_BYTES + 96, waitMs: 0,
    maxBatchBytes: D3D.HEADER_BYTES + D3D.STATE_BYTES + 96,
  },
  'single draw/fence command accounting is exact');
assert.strictEqual(d3d.call(D3D.FENCE_OPCODE, 0), 1,
  'an idle fence still observes the completed sequence');
assert.strictEqual(replayed.length, 1,
  'an idle fence must not resubmit stale bytes from a rotated ring slot');

console.log('PASS Worker API logging, keyboard snapshots, and D3D draws are batched');
