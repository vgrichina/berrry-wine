'use strict';
// Pure validation/browser-state mocks; no browser, guest, build or fixtures.
const assert = require('assert');
const vm = require('vm');
const { validateSample, measureWindow, armBrowserCapture } = require('./measure-gameplay-presentations');

const keys = ['draws', 'drawCalls', 'triangles', 'clears', 'fallbacks', 'errors', 'declinedClears'];
const sample = n => ({ atMs: n * 1000, visibility: 'visible',
  presentsTotal: n * 25, uploadsTotal: n * 20, blocksTotal: n * 100,
  gpu: Object.fromEntries(keys.map(k => [k, n])) });
const a = sample(1), b = sample(2);
assert.equal(measureWindow(a, b).presentationsPerSecond, 25);
assert.equal(measureWindow(a, b).gpuDelta.fallbacks, 1);
assert.equal(measureWindow({ ...a, gpu: null }, { ...b, gpu: null }).gpuDelta, null);
for (const value of [undefined, null, NaN, Infinity, -Infinity, -1, '3']) {
  for (const key of ['atMs', 'presentsTotal', 'uploadsTotal', 'blocksTotal'])
    assert.throws(() => validateSample({ ...a, [key]: value }), /finite counter/);
  for (const key of keys)
    assert.throws(() => validateSample({ ...a, gpu: { ...a.gpu, [key]: value } }), /finite counter/);
}
for (const key of ['presentsTotal', 'uploadsTotal', 'blocksTotal'])
  assert.throws(() => measureWindow(a, { ...b, [key]: 0 }), /decreased/);
for (const key of keys)
  assert.throws(() => measureWindow(a, { ...b, gpu: { ...b.gpu, [key]: 0 } }), /decreased/);
assert.throws(() => measureWindow(a, { ...b, atMs: a.atMs }), /elapsed/);
assert.throws(() => measureWindow(a, { ...b, atMs: 0 }), /elapsed/);
assert.throws(() => measureWindow(a, { ...b, gpu: null }), /availability changed/);
assert.throws(() => measureWindow(a, { ...b, visibility: 'hidden' }), /hidden/);

function browserMock() {
  const events = new Map();
  const perf = { enabled: true, paceLog: null, stopped: false,
    start() { this.enabled = true; },
    recordPacing(on) { this.paceLog = on ? { present: [] } : null; },
    stop() { this.stopped = true; this.enabled = false; } };
  const context = {
    window: { wine: { instance: {}, guestWorker: null }, WinePerf: perf,
      WINE_WASM_IDENTITY: { sha256: 'module-a', source: 'artifact', bytes: 123 } },
    document: { visibilityState: 'visible',
      addEventListener(name, fn) { events.set(name, fn); },
      removeEventListener(name) { events.delete(name); } },
    performance: { now: () => 100 },
    setInterval(fn) { context.tick = fn; return 1; },
    clearInterval() { context.cleared = true; },
  };
  vm.createContext(context);
  context.expected = JSON.stringify(context.window.WINE_WASM_IDENTITY);
  vm.runInContext('(' + armBrowserCapture.toString() + ')("owner", expected)', context);
  return { context, events, state: context.window.__winePresentationCapture, perf };
}
{
  const { context, events, state } = browserMock();
  context.document.visibilityState = 'hidden'; events.get('visibilitychange')();
  context.document.visibilityState = 'visible'; events.get('visibilitychange')();
  assert.match(state.check(), /hidden/); // hidden mid-window, visible at both endpoints
  assert.equal(state.visibility.length, 2);
  state.cleanup();
  assert.equal(events.size, 0);
  assert.equal(context.cleared, true);
}
for (const mutate of [
  c => { c.window.wine = { ...c.window.wine }; },
  c => { c.window.wine.instance = {}; },
  c => { c.window.wine.guestWorker = {}; },
  c => { c.window.WINE_WASM_IDENTITY.sha256 = 'module-b'; },
  c => { c.window.WINE_WASM_IDENTITY = { ...c.window.WINE_WASM_IDENTITY }; },
  c => { c.window.WinePerf = { ...c.window.WinePerf }; },
  c => { c.window.WinePerf.paceLog = {}; },
  c => { c.window.WinePerf.enabled = false; },
]) {
  const { context, state } = browserMock();
  mutate(context);
  context.tick();
  assert.match(state.check(), /changed/);
  state.cleanup();
}
{
  const { context, state, perf } = browserMock();
  const original = context.window.wine.instance;
  context.window.wine.instance = {};
  context.tick();
  context.window.wine.instance = original;
  assert.match(state.check(), /instance changed/); // invalidity is sticky
  const otherLog = {};
  perf.paceLog = otherLog;
  state.cleanup();
  assert.strictEqual(perf.paceLog, otherLog); // never tear down a replacement capture
  assert.equal(perf.stopped, false);
}
console.log('PASS gameplay presentation sampler validation and browser-state mocks');
