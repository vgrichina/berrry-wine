'use strict';
// Complete production endpoint + software executor + ring decoder. Only native
// color storage and waitAsync delivery are stand-ins; no GPU/WASM is exercised.
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = process.env.REPO_ROOT || path.resolve(__dirname, '..');
const GS = require(path.join(root, 'lib/gpu-stream'));
const DB = require(path.join(root, 'lib/gpu-stream-doorbell'));
const { makeProducer } = require(path.join(root, 'test/gpu-stream-fixture'));
function load(file, globals) {
  const context = vm.createContext({ console, Uint8Array, Uint8ClampedArray, Float32Array,
    DataView, Int32Array, Atomics, performance: { now: () => 10 }, ...globals });
  vm.runInContext(fs.readFileSync(path.join(root, 'lib', file), 'utf8'), context, { filename: file });
  return context;
}
let checks = 0, failures = 0;
function check(label, actual, expected) {
  checks++;
  try { assert.deepEqual(actual, expected); }
  catch (error) { failures++; console.error('FAIL', label, { actual, expected }); }
}
async function scenario(retireFirst, busy) {
  const waits = [], tasks = [], frames = [], devices = [];
  class Device {
    constructor() { this.colors = new Map(); this.bytes = 4; this.closed = false; devices.push(this); }
    createColor(r) { assert(!this.closed); this.colors.set(r.id, new Uint8Array(4)); }
    updateColor(r, pixels) { assert(!this.closed); this.colors.get(r.id).set(pixels); }
    readColor(r) { assert(!this.closed); return { pixels: this.colors.get(r.id), pitch: 4 }; }
    destroy() { assert(!this.closed); this.closed = true; this.colors.clear(); }
  }
  const software = load('gpu-stream-software.js', { GpuStream: GS,
    D3D9SoftwareBackend: { Device } }).GpuStreamSoftware;
  const doorbell = { ...DB, supported: () => true,
    whenPublished() { return new Promise(resolve => waits.push(resolve)); } };
  const endpointAPI = load('gpu-stream-render-worker.js', { GpuStream: GS,
    GpuStreamDoorbell: doorbell, GpuStreamSoftware: software,
    GpuBackend: {}, GpuStreamWebGL: { Executor: class {} } }).GpuStreamRenderWorker;
  const p = makeProducer();
  const create = id => endpointAPI.create({ instance: { exports: {} }, memory: { buffer: p.buffer },
    endpointId: id, backend: 'software', options: { api: 'd3dim-gps' },
    schedule(fn) { tasks.push({ id, fn }); },
    sendFrame(f) { frames.push({ id, rgba: Array.from(f.pixels), seq: f.presentSeq }); } });
  const kick = e => e.execute({ t: 'gps-kick', ring: p.header, mode: 0 });
  const setup = rgba => {
    p.emit('CREATE', { id: 1, kind: GS.KIND.RT, fmt: GS.FMT.A8B8G8R8, levels: 1, width: 1, height: 1 });
    const pos = p.arenaAlloc(4); p.arenaView(pos, 4).set(rgba);
    p.emit('UPLOAD', { id: 1, w: 1, h: 1, pitch: 4, bytes: 4, src: pos });
  };
  const present = () => p.emit('PRESENT', { rt: 1, w: 1, h: 1, surface: 7 });
  const old = create(11);
  setup([200, 10, 20, 255]); kick(old);
  // A previously resolved notification is already in the process scheduler.
  waits.shift()(); await Promise.resolve();
  check('old notification queued', tasks.map(x => x.id), [11]);
  const current = create(22);
  setup([30, 180, 90, 255]); kick(current);
  if (busy) DB.busy(p.i32, p.header, true);
  const consumer = busy ? 0x40000016 : 22;
  const executor = current.identity().executor, native = executor.native;
  const seq = present(), before = p.load('read_pos');
  if (retireFirst) old.destroy();
  const oldTask = tasks.shift(); await oldTask.fn();
  check('stale callback preserves replacement read cursor', p.load('read_pos'), before);
  check('stale callback emits no obsolete frame', frames, []);
  check('foreign consumer survives stale callback', p.load('consumer'), consumer);
  if (!retireFirst) old.destroy();
  check('old shutdown preserves foreign consumer including busy bit', p.load('consumer'), consumer);
  check('replacement executor identity retained', current.identity().executor === executor, true);
  check('replacement device and bytes retained', [native.closed, Array.from(native.colors.get(1))], [false, [90, 180, 30, 255]]);
  check('old resource device retired once', devices[0].closed, true);
  // Deliver the replacement's own wait, then its production scheduled closure.
  waits.shift()(); await Promise.resolve();
  const currentTask = tasks.find(x => x.id === 22); assert(currentTask);
  await currentTask.fn();
  check('only replacement presents literal green bytes', frames, [{ id: 22, rgba: [30, 180, 90, 255], seq }]);
  check('replacement consumed present', p.load('read_pos'), p.load('write_pos'));
  check('no ring execution error', p.load('error_code'), 0);
  current.destroy();
  check('final shutdown detaches own consumer', p.load('consumer'), 0);
  check('all devices retired', devices.map(x => x.closed), [true, true]);
}
(async () => {
  for (const retireFirst of [false, true]) for (const busy of [false, true]) await scenario(retireFirst, busy);
  console.log(JSON.stringify({ checks, failures, scope: 'production JS closures; native color storage and deterministic wait stand-ins only' }));
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 2; });
