#!/usr/bin/env node
'use strict';
// Real synchronous executor, production owner snapshot and production guard.
// Only the backend/guest/window are scripted here; --native uses actual GL.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { createCliInputSnapshot } = require('../lib/cli-input-owner');
const { createGuardedInput } = require('../lib/cli-guarded-input');
const { Encoder, CTRL } = require('../lib/d3d-command-stream');
const native = process.argv.includes('--native');
function fixture() {
  let lost = false, statusThrows = false, unavailable = false, live = true;
  const listeners = new Set(), devices = [];
  const filename = path.resolve(__dirname, '../lib/d3dim-gpu.js');
  const m = new Module(filename, module); m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  class Device {
    constructor() {
      if (unavailable) throw new Error('context unavailable');
      this.gpu = {gl: {canvas: {
        addEventListener(_, fn) { listeners.add(fn); },
        removeEventListener(_, fn) { listeners.delete(fn); }
      }, isContextLost() { if (statusThrows) throw new Error('status unavailable'); return lost; }}};
      devices.push(this);
    }
    destroy() { this.destroyed = true; }
  }
  const realRequire = m.require.bind(m);
  m.require = name => name === './d3d9-backend' && !native ? {Device} : realRequire(name);
  m._compile(fs.readFileSync(filename, 'utf8'), filename);
  const memory = {buffer: new ArrayBuffer(65536)};
  const exports = {get_main_hwnd: () => 65537, get_dx_present_hwnd: () => 65537,
    get_window_thread: () => 1, get_current_thread_id: () => 1,
    get_quit_flag: () => 0, get_eip: () => 0x402000,
    d3dim_gpu_surface_live: () => live};
  const instance = {exports};
  const createCanvas = native ? (w, h) => new (require('../lib/raster-canvas').Canvas)(w, h) : () => ({});
  const make = () => new m.exports.D3DIMGpu({getExports: () => exports,
    getMemory: () => memory.buffer, createCanvas, onError() {}});
  let device = make();
  const renderer = {windows: {65537: {visible: true}}, inputQueue: [], canvas: {width: 32, height: 32}};
  const snapshot = createCliInputSnapshot({instance, memory, renderer,
    getDevice: () => device, getThreadManager: () => null});
  const guard = createGuardedInput({snapshot, cleanup() {}});
  const descriptor = {rt: 64, dib: 256, pitch: 128, width: 32, height: 32, bpp: 32, format: 0};
  const allocate = () => device._target(descriptor);
  const ticket = nonce => guard.prepare({...guard.bind(), nonce, reviewed: true, deadline: Date.now()+5000}, {action: 'keydown', code: 38});
  return {get gpu() {return device;}, guard, snapshot, allocate, descriptor, ticket,
    unavailable() {unavailable = true;}, loss(event = true) {lost = true; if(event) for(const fn of listeners) fn();},
    restore() {lost = false;}, statusThrows() {statusThrows = true;}, retire() {live = false; device.fence();},
    replace() {device = make();}, close() {guard.close(); try {device.stop();} catch (error) {assert(device.stopped); assert.match(error.message, /context lost|destroy failed|status unavailable/);}}};
}
function refused(f) {assert.equal(!!f.gpu.snapshot().ready, false); assert.throws(() => f.guard.bind(), /unavailable/);}
{
  const f = fixture();
  refused(f); // Constructing the lazy executor is not GL initialization.
  f.gpu.call(0x20002, 0); refused(f); // Guest capability READY is not input readiness.
  f.allocate();
  const inventory = f.gpu.inspectTargets();
  assert.equal(inventory.scope, 'executor-local-inventory');
  assert.equal(inventory.targets[0].context.allocationContextMatches, true);
  assert.equal(inventory.targets[0].context.identity, 1);
  assert.equal(inventory.targets[0].allocationGeneration, 1);
  assert(Object.isFrozen(inventory.targets[0].source));
  f.guard.bind(); // Baseline reproduces actual synchronous admission refusal here.
  assert.equal(f.gpu.snapshot().ready, true, 'initialized synchronous executor must admit production input');
  const t = f.ticket('live'); let effects = 0;
  f.guard.consume(t, () => effects++); assert.equal(effects, 1);
  assert.equal(f.guard.status('live').state, 'CONSUMED');
  f.close(); refused(f); f.gpu.stop();
  assert.deepEqual(f.gpu.inspectTargets().targets, []);
  assert.equal(inventory.targets.length, 1, 'retained passive inventory stays detached after shutdown');
}
if (!native) {
  {const f = fixture(); f.unavailable(); assert.equal(f.allocate(), null); refused(f); f.close();}
  for (const event of [true, false]) {
    const f = fixture(); f.allocate(); const t = f.ticket('loss');
    f.loss(event); refused(f); f.restore(); refused(f);
    f.guard.consume(t, () => assert.fail('lost context delivered input'));
    assert.equal(f.guard.status('loss').state, 'CANCELLED'); f.close();
  }
  {const f = fixture(); f.allocate(); f.statusThrows(); refused(f); f.close();}
  {const f = fixture(); const t = f.allocate(); f.loss(false);
    assert.throws(() => f.gpu._checkReadback(t), /context lost/);
    f.restore(); f.gpu.targets.delete(t.rt); f.allocate(); refused(f); f.close();}
  {const f = fixture(); const t = f.allocate(); delete t.device.gpu.gl.isContextLost; refused(f); f.close();}
  {const f = fixture(); const t = f.allocate();
    f.gpu.targets.set(128, {...t, rt: 128}); refused(f); f.gpu.targets.delete(128); f.close();}
  {const f = fixture(); const t = f.allocate(); t.device = {gpu: t.device.gpu}; refused(f); f.close();}
  {const f = fixture(); const t = f.allocate(); t.device.gpu = {gl: t.device.gpu.gl}; refused(f); f.close();}
  {const f = fixture(); const t = f.allocate(); t.device.gpu.gl = {isContextLost: () => false}; refused(f); f.close();}
  {const f = fixture(); f.allocate(); const t = f.ticket('retired'); f.retire(); refused(f);
    f.allocate(); assert.equal(f.gpu.snapshot().ready, true);
    f.guard.consume(t, () => assert.fail('reallocated target retained old owner'));
    assert.equal(f.guard.status('retired').state, 'CANCELLED'); f.close();}
  {const f = fixture(); f.allocate(); const t = f.ticket('replaced'); const old = f.gpu;
    f.replace(); refused(f); f.allocate(); assert.equal(f.gpu.snapshot().ready, true);
    f.guard.consume(t, () => assert.fail('replacement executor delivered old intent'));
    assert.equal(f.guard.status('replaced').state, 'CANCELLED'); old.stop(); f.close();}
  {const f = fixture(); f.allocate(); f.gpu._fail(new Error('submission failed')); refused(f); f.close();}
  {const f = fixture(); const t = f.allocate(); t.device.contextLost = true; refused(f);
    t.device.contextLost = false; refused(f); f.close();}
  {const f = fixture(); const t = f.allocate(); let observed;
    t.device.destroy = () => {observed = f.gpu.snapshot().ready; throw new Error('destroy failed');};
    assert.throws(() => f.gpu.stop(), /destroy failed/); assert.equal(observed, false); refused(f); f.close();}
  // Actual asynchronous producer: shared worker READY/ERROR remains authoritative,
  // including before any lazy GPU context exists on the remote owner.
  const encoder = new Encoder({workerFactory: () => ({postMessage() {}, terminate() {}})});
  assert.equal(encoder.snapshot().ready, false);
  Atomics.store(encoder.control, CTRL.READY, 1); assert.equal(encoder.snapshot().ready, true);
  Atomics.store(encoder.control, CTRL.ERROR, 1); assert.equal(encoder.snapshot().ready, false);
  Atomics.store(encoder.control, CTRL.ERROR, 0); Atomics.store(encoder.control, CTRL.READY, 0);
  assert.equal(encoder.snapshot().ready, false);
}
// The adopted GPU shutdown work must cancel closure-owned fenceFlip reads even
// when their next task never runs. Use the actual executor with a scripted GL2
// driver; no native context or guest executes in these controls.
async function pendingLifecycle() {
  for (const mode of ['stop', 'retire', 'loss']) {
    const tasks = [], events = [], listeners = new Set();
    let live = true, lost = false, destroyed = false;
    const active = () => assert.equal(destroyed, false, 'GL used after disposal');
    const objects = [];
    class Device {
      constructor() {
        const make = kind => {active(); const o = {kind, deleted: 0}; objects.push(o); return o;};
        const remove = o => {active(); assert.equal(++o.deleted, 1); events.push('delete-'+o.kind);};
        this.gpu = {version: 2, bindImplicitTarget: active, gl: {
          canvas: {addEventListener(_, fn) {listeners.add(fn);}, removeEventListener(_, fn) {listeners.delete(fn);}},
          isContextLost: () => lost, PIXEL_PACK_BUFFER: 1, STREAM_READ: 2, RGBA: 3, UNSIGNED_BYTE: 4,
          SYNC_GPU_COMMANDS_COMPLETE: 5, TIMEOUT_EXPIRED: 6, ALREADY_SIGNALED: 7, CONDITION_SATISFIED: 8,
          createBuffer: () => make('pbo'), deleteBuffer: remove, bindBuffer: active, bufferData: active,
          readPixels: active, fenceSync: () => make('sync'), deleteSync: remove, flush: active,
          clientWaitSync() {active(); return 6;}, getBufferSubData() {assert.fail('cancelled read collected');}
        }};
      }
      destroy() {assert(!destroyed); destroyed = true; events.push('destroy');}
    }
    const filename = path.resolve(__dirname, '../lib/d3dim-gpu.js');
    const m = new Module(filename, module); m.filename = filename; m.tasks = tasks;
    m.require = name => {assert.equal(name, './d3d9-backend'); return {Device};};
    m._compile('const setTimeout = fn => module.tasks.push(fn);\n'+fs.readFileSync(filename, 'utf8'), filename);
    const memory = new ArrayBuffer(4096); new Uint8Array(memory).fill(0x77);
    const gpu = new m.exports.D3DIMGpu({getExports: () => ({d3dim_gpu_surface_live: () => live,
      page_watch_write() {assert.fail('cancelled read published');}}), getMemory: () => memory, createCanvas: () => ({})});
    const t = gpu._target({rt: 64, dib: 256, pitch: 8, width: 2, height: 2, bpp: 32, format: 0});
    t.dib = 256; t.dirty = true;
    const pending = gpu.fenceFlip(); assert.equal(tasks.length, 1);
    const rejected = assert.rejects(pending, /stopped|retired|context lost/);
    if (mode === 'stop') gpu.stop();
    if (mode === 'retire') {live = false; gpu.fence();}
    if (mode === 'loss') {lost = true; for (const fn of listeners) fn(); lost = false;}
    let timer;
    try {await Promise.race([rejected, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('cancelled fence did not settle without its task')), 1000);
    })]);} finally {clearTimeout(timer);}
    assert.equal(gpu.snapshot().ready, false);
    const before = events.slice(); for (const fn of tasks.splice(0)) fn(); await Promise.resolve();
    assert.deepEqual(events, before); assert.deepEqual([...new Uint8Array(memory).slice(256,272)], Array(16).fill(0x77));
    if (mode === 'loss') assert.throws(() => gpu.stop(), /context lost/); else gpu.stop();
    gpu.stop(); assert.equal(events.filter(e => e === 'destroy').length, 1);
    for (const o of objects) assert.equal(o.deleted, mode === 'loss' ? 0 : 1, o.kind);
  }
}
const done = () => console.log('PASS synchronous lifecycle/identity, production snapshot+guard' +
  (native ? ' actual native GL' : ', pending readback retirement, asynchronous readiness unchanged'));
if (native) done(); else pendingLifecycle().then(done, error => {console.error(error.stack); process.exitCode = 1;});
