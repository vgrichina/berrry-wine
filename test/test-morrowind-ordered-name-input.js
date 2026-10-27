#!/usr/bin/env node
'use strict';

// Portable production-boundary probe, NOT Morrowind guest execution. DOM
// dispatch is deterministic; browser-input, renderer, host closures and RPC
// are unchanged production modules. The consumer is a real OS Worker.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const RPC = require('../lib/guest-rpc');
const signatures = require('../lib/host-import-sigs.generated.json').sigs;
const names = ['check_input', 'check_input_wparam', 'check_input_lparam',
  'check_input_hwnd', 'get_key_down_state'];
const sigs = Object.fromEntries(names.map(name => [name, signatures[name]]));

if (!isMainThread) {
  const { imports } = RPC.createWorkerImports(workerData.memory, sigs,
    message => parentPort.postMessage(message), { slot: 0 });
  const h = imports.host;
  parentPort.on('message', ({ id, action, keys, focus }) => {
    const rows = [];
    if (action === 'drain' || action === 'one') {
      for (let i = 0; i < 2048; i++) {
        const packed = h.check_input();
        if (!packed) break;
        rows.push({ msg: packed & 0xffff, wParam: h.check_input_wparam(),
          lParam: h.check_input_lparam() >>> 0, hwnd: h.check_input_hwnd(focus) >>> 0 });
        if (action === 'one') break;
      }
    }
    parentPort.postMessage({ id, rows,
      keys: (keys || []).map(key => [key, h.get_key_down_state(key)]) });
  });
} else {
  const { createHostImports } = require('../lib/host-imports');
  const { inputEventHwnd } = require('../lib/host-window');
  const { Win98Renderer } = require('../lib/renderer');
  const root = path.join(__dirname, '..');
  const host = fs.readFileSync(path.join(root, 'host.js'), 'utf8');
  const browser = fs.readFileSync(path.join(root, 'lib/browser-input.js'), 'utf8');
  const context = { console, createHostImports, inputEventHwnd };
  vm.runInNewContext(host + '\n;globalThis.WineAssembly = WineAssembly;', context);
  const listeners = new Map(), documentListeners = new Map();
  class Node {}
  const canvas = new Node();
  Object.assign(canvas, { width: 640, height: 480, style: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 480 }),
    focus() {}, setAttribute() {}, addEventListener() {},
    getContext: () => ({ save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
      clearRect() {}, fillRect() {}, strokeRect() {}, fillText() {}, drawImage() {},
      measureText: () => ({ width: 0 }), putImageData() {},
      getImageData: () => ({ data: new Uint8ClampedArray(4) }) }) });
  const renderer = new Win98Renderer(canvas);
  const wine = new context.WineAssembly();
  wine.memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  wine.instance = { exports: { get_focus_hwnd: () => 0x10002 } };
  wine.guestWorker = {};
  wine.logToUI = () => {};
  wine.renderer = renderer;
  renderer.wasm = renderer.mainWasm = wine.instance;
  renderer._guestWorkerWasms = new WeakSet([wine.instance]);
  renderer.windows[0x10002] = { hwnd: 0x10002, visible: true, isChild: false,
    zOrder: 1, wasm: wine.instance };
  const h = wine.getImports().host;
  const broker = RPC.createMainBroker(wine.memory, h, sigs, {});
  // Execute the unchanged production publisher initializer, including its
  // registration and burst/wake bookkeeping; do not transcribe the payload.
  wine.guestWorker.broker = broker;
  const start = host.indexOf('    if (self.renderer && self.guestWorker && self.guestWorker.broker &&\n        !self._rendererInputPendingPublisher)');
  const end = host.indexOf('    if (self.renderer && self.guestWorker && self.guestWorker.broker &&\n        !self._rendererMousePublisher)', start);
  assert(start >= 0 && end > start, 'exact production publisher initializer');
  vm.runInNewContext(host.slice(start, end), { self: wine });
  const publish = () => wine._rendererInputPendingPublisher(renderer.inputQueue.length, false);
  const window = { addEventListener(type, fn) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(fn);
  }, removeEventListener() {} };
  const document = { activeElement: canvas, body: new Node(), documentElement: new Node(),
    getElementById: () => null, querySelectorAll: () => [],
    addEventListener(type, fn) { documentListeners.set(type, fn); } };
  vm.runInNewContext(browser, { window, document, Node, console,
    setInterval: () => 1, clearInterval() {}, setTimeout, clearTimeout });
  window.browserInput.wireCanvasInput(canvas, renderer, { runningApps: [] });
  const callTrace = [];
  for (const name of ['handleKeyDown', 'handleKeyPress', 'handleKeyUp']) {
    const original = renderer[name];
    renderer[name] = function (...args) {
      assert.equal(this, renderer, 'production callback receiver preserved');
      callTrace.push([name, ...args]);
      return Reflect.apply(original, this, args);
    };
  }
  let rpcCalls = 0, sequence = 0;
  const pending = new Map();
  const worker = new Worker(__filename, { workerData: { memory: wine.memory } });
  worker.on('message', message => {
    if (message.t === 'rpc') { rpcCalls++; broker.serveRpc(message.slot); }
    else if (pending.has(message.id)) {
      pending.get(message.id)(message); pending.delete(message.id);
    }
  });
  worker.on('error', error => { console.error(error); process.exitCode = 1; });
  const request = (action, keys = [], focus = 0x10002) => new Promise(resolve => {
    const id = ++sequence; pending.set(id, resolve);
    worker.postMessage({ id, action, keys, focus });
  });
  const send = (type, key, extra = {}) => {
    const vk = key.length === 1 ? key.toUpperCase().charCodeAt(0) :
      ({ Shift: 16, Control: 17, ArrowLeft: 37 })[key];
    const event = { type, target: canvas, key, keyCode: vk, charCode: key.charCodeAt(0),
      code: key.length === 1 ? 'Key' + key.toUpperCase() : key + 'Left',
      preventDefault() {}, stopPropagation() {}, ...extra };
    for (const fn of listeners.get(type) || []) fn(event);
  };
  const down = (key, extra) => send('keydown', key, extra);
  const up = (key, extra) => send('keyup', key, extra);
  const edge = key => {
    const shifted = /^[A-Z]$/.test(key);
    if (shifted) down('Shift', { code: 'ShiftLeft', location: 1 });
    down(key); send('keypress', key); // browsers that still emit keypress
    up(key);
    if (shifted) up('Shift', { code: 'ShiftLeft', location: 1 });
  };
  const expected = text => [...text].flatMap(ch => [
    ...(/^[A-Z]$/.test(ch) ? [[0x100,16]] : []),
    [0x100, ch.toUpperCase().charCodeAt(0)], [0x102, ch.charCodeAt(0)],
    [0x101, ch.toUpperCase().charCodeAt(0)],
    ...(/^[A-Z]$/.test(ch) ? [[0x101,16]] : []) ]);
  const pairs = rows => rows.map(row => [row.msg, row.wParam]);
  const observations = [];
  async function run() {
    publish();
    // FIRST behavioral checkpoint: ordinary Codex through complete modules
    // and actual blocking Worker RPC, rather than a character concatenator.
    for (const ch of 'Codex') edge(ch);
    const queued = JSON.parse(JSON.stringify(renderer.inputQueue));
    const rapid = await request('drain', [67, 79, 68, 69, 88]);
    assert.deepEqual(pairs(rapid.rows), expected('Codex'));
    assert(rapid.rows.every(row => row.hwnd === 0x10002 && (row.lParam & 0xffff) === 1));
    assert(rapid.keys.every(([, state]) => state === 0));
    assert(rpcCalls > 15, 'actual RPC crossed OS Worker boundary');
    assert.deepEqual(callTrace.slice(0, 5).map(row => row[0]),
      ['handleKeyDown', 'handleKeyDown', 'handleKeyPress', 'handleKeyUp', 'handleKeyUp']);
    observations.push({ scenario: 'rapid-Codex', queued, consumer: rapid, rpcCalls });
    // Reject a real missing input, without modifying any production source.
    for (const ch of 'Coex') edge(ch);
    const omitted = await request('drain');
    assert.throws(() => assert.deepEqual(pairs(omitted.rows), expected('Codex')));
    observations.push({ scenario: 'omitted-d-control', consumer: omitted,
      firstMismatchIndex: 8, rejected: true });
    const paced = [];
    for (const ch of 'Codex') {
      const shifted = /^[A-Z]$/.test(ch);
      if (shifted) down('Shift', { code: 'ShiftLeft', location: 1 });
      down(ch);
      const held = await request('sample', [ch.toUpperCase().charCodeAt(0)]);
      assert.equal(held.keys[0][1], 0x8000);
      send('keypress', ch);
      paced.push(...(await request('drain')).rows);
      up(ch);
      if (shifted) up('Shift', { code: 'ShiftLeft', location: 1 });
      paced.push(...(await request('drain')).rows);
    }
    assert.deepEqual(pairs(paced), expected('Codex'));
    observations.push({ scenario: 'paced-Codex-poll-held-and-message-drain', rows: paced });
    // Partial queue drains and live guest focus between RPCs.
    for (const ch of 'Codex') edge(ch);
    const split = [];
    for (let i = 0; i < expected('Codex').length; i++) {
      const result = await request('one', [], i < 6 ? 0x10002 : 0x10003);
      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0].hwnd, i < 6 ? 0x10002 : 0x10003);
      split.push(...result.rows);
    }
    await request('drain');
    assert.deepEqual(pairs(split), expected('Codex'));
    observations.push({ scenario: 'one-event-per-worker-command-focus-switch', rows: split });
    down('c'); down('c', { repeat: true }); up('c');
    const repeats = await request('drain');
    assert.deepEqual(pairs(repeats.rows), [[256,67],[258,99],[256,67],[258,99],[257,67]]);
    assert(repeats.rows[2].lParam & 0x40000000);
    observations.push({ scenario: 'repeat', consumer: repeats });
    down('Shift', { code: 'ShiftLeft', location: 1 });
    down('Shift', { code: 'ShiftRight', location: 2 });
    up('Shift', { code: 'ShiftLeft', location: 1 });
    const sides = await request('sample', [16,160,161]);
    assert.deepEqual(sides.keys, [[16,32768],[160,0],[161,32768]]);
    down('ArrowLeft'); up('ArrowLeft');
    for (const fn of listeners.get('blur')) fn({});
    const focused = await request('drain', [16,160,161,37]);
    assert(focused.keys.every(([, state]) => !state));
    assert.deepEqual(pairs(focused.rows), [[256,16],[256,16],[257,16],[256,37],[257,37],[257,16]]);
    observations.push({ scenario: 'modifier-sides-game-key-blur-release', sides, consumer: focused });
    // A live bitmap is a sample, not a buffered event history. No WM_CHAR
    // missing observation occurred; no Morrowind/DirectInput cause inferred.
    for (const ch of 'Codex') edge(ch);
    const lateSample = await request('sample', [67,79,68,69,88]);
    assert(lateSample.keys.every(([, state]) => state === 0));
    const afterSample = await request('drain');
    assert.deepEqual(pairs(afterSample.rows), expected('Codex'));
    observations.push({ scenario: 'poll-only-after-all-edges', lateSample,
      messagesStillIntact: afterSample.rows });
    console.log(JSON.stringify({ source: 'be0eb25fc33f3b057847d6c4e2c4fe5a6a9a426c',
      consumer: 'node worker_threads using unchanged production guest-rpc imports',
      guestExecuted: false, browserExecuted: false, rpcCalls, observations,
      conclusion: 'Codex WM_CHAR loss not reproduced; bitmap sampling is schedule-dependent; true game consumer remains unobserved' }, null, 2));
  }
  run().catch(error => { console.error(error); process.exitCode = 1; })
    .finally(() => worker.terminate());
}
