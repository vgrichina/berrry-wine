'use strict';
// Complete production CommonJS modules. Only time and Worker transport are fixtures.
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.env.REPAINT_ROOT || path.resolve(__dirname, '..');
const { Manager } = require(path.join(root, 'lib/render-worker'));
const { Win98Renderer } = require(path.join(root, 'lib/renderer'));
const { createHostImports } = require(path.join(root, 'lib/host-imports'));
const { createCanvas } = require(path.join(root, 'lib/raster-canvas'));
const G = require(path.join(root, 'lib/gpu-stream.generated'));
const failures = [];
let checks = 0;
function check(label, actual, expected) {
  checks++;
  try { assert.deepEqual(actual, expected, label); }
  catch (error) { failures.push(label); console.error(error.message); }
}
const tick = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
function clock() {
  let now = 100, id = 0;
  const timers = new Map(), frames = new Map();
  return { timers, frames, now: () => now,
    setTimeout(fn, delay) { const key = ++id; timers.set(key, {fn, at: now + delay}); return key; },
    clearTimeout(key) { timers.delete(key); },
    requestAnimationFrame(fn) { const key = ++id; frames.set(key, fn); return key; },
    frame() { now += 16; const pending = [...frames.values()]; frames.clear(); for (const fn of pending) fn(now); },
  };
}
function transport() {
  const handlers = new Map(), sent = [];
  let terminations = 0, release;
  const terminated = new Promise(resolve => { release = resolve; });
  const emit = message => handlers.get('message')(message);
  const worker = { on(type, fn) { handlers.set(type, fn); },
    postMessage(m) {
      sent.push(m);
      if (m.t === 'render-open') emit({t: 'render-event', endpointId: m.endpointId, message: {t: 'ready'}});
      if (m.t === 'render-message') {
        emit({t: 'render-event', endpointId: m.endpointId, message: {t: 'render-response',
          requestId: m.message.requestId, value: {result: 1, stats: {}}}});
        emit({t: 'render-done', transportId: m.transportId});
      }
    },
    terminate() { terminations++; return terminated; },
  };
  const manager = new Manager({workerFactory: () => worker, shutdownTimeoutMs: 500});
  emit({t: 'render-ready'});
  return { manager, emit, sent, release, terminations: () => terminations,
    acknowledge() { emit({t: 'render-stopped', heapHead: 0}); },
  };
}
async function bridge(t, renderer) {
  const memory = new SharedArrayBuffer(4096);
  const api = G.LAYOUTS.GpsRing.fields.find(f => f.name === 'api').offset;
  new DataView(memory).setUint32(256 + api, 4, true);
  let endpoint, delivered = 0;
  const ctx = { getMemory: () => memory, renderer, createCanvas,
    exports: { d3d9_gps_active: () => 0 }, sharedRenderWorkerEnabled: true,
    createRenderEndpoint: async options => {
      endpoint = t.manager.createEndpoint(options);
      endpoint.addEventListener('message', event => { if (event.data.t === 'frame') delivered++; });
      return endpoint;
    },
  };
  const {host} = createHostImports(ctx);
  await host.gpu_stream_kick(256, 1);
  return { endpoint, ctx, delivered: () => delivered,
    frame(stamp, rgba) {
      const pixels = new Uint8Array(8 * 8 * 4);
      for (let p = 0; p < pixels.length; p += 4) pixels.set(rgba, p);
      t.emit({t: 'render-event', endpointId: endpoint.id, message: {t: 'frame', frame: {
        hwnd: 0x10001, width: 8, height: 8, stamp, pixels,
      }}});
    },
  };
}
function renderer() {
  const r = new Win98Renderer(createCanvas(8, 8));
  r._isNode = false;
  r.windows[0x10001] = {hwnd: 0x10001, x: 0, y: 0, w: 8, h: 8,
    visible: true, style: 0x80000000, _backCanvas: createCanvas(8, 8)};
  return r;
}
const pixel = r => Array.from(r.ctx.getImageData(4, 4, 1, 1).data);
async function run() {
  const c = clock(), names = ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'performance'];
  const descriptors = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  for (const name of names) Object.defineProperty(globalThis, name, {configurable: true, writable: true,
    value: name === 'performance' ? {now: c.now, timeOrigin: 0} : c[name].bind(c)});
  try {
    const r = renderer(), foreign = renderer(), old = transport(), next = transport(), other = transport();
    const a = await bridge(old, r), b = await bridge(next, r), f = await bridge(other, foreign);
    a.frame(1, [255, 0, 0, 255]); f.frame(1, [0, 0, 255, 255]); c.frame();
    check('live frame displays', pixel(r), [255, 0, 0, 255]);
    check('foreign frame displays', pixel(foreign), [0, 0, 255, 255]);
    check('ordinary frames delivered once', [a.delivered(), f.delivered()], [1, 1]);
    const firstLayer = r.windows[0x10001]._dxFrameLayer;
    const stop = old.manager.stop(); let settled = false;
    stop.then(() => { settled = true; });
    check('endpoint closes synchronously at stop', a.endpoint.closed, true);
    check('accepted layer retires synchronously at stop', firstLayer.stale(), true);
    check('stop promise identity stable', old.manager.stop() === stop, true);
    await tick();
    check('stop command sent once', old.sent.filter(m => m.t === 'render-stop').length, 1);
    check('stop waits for acknowledgement', settled, false);
    b.frame(1, [0, 255, 0, 255]); c.frame();
    check('replacement frame displays', pixel(r), [0, 255, 0, 255]);
    const replacement = r.windows[0x10001]._dxFrameLayer;
    const publication = r._immutablePublicationSequence;
    a.frame(2, [255, 0, 255, 255]);
    check('stopped endpoint cannot deliver late frame before acknowledgement', a.delivered(), 1);
    check('replacement layer survives late frame', r.windows[0x10001]._dxFrameLayer === replacement, true);
    check('late frame queues no repaint', c.frames.size, 0);
    c.frame();
    check('late old frame cannot overwrite displayed replacement', pixel(r), [0, 255, 0, 255]);
    check('late frame creates no publication', r._immutablePublicationSequence, publication);
    check('foreign renderer unchanged by old frame', pixel(foreign), [0, 0, 255, 255]);
    old.acknowledge(); await tick();
    check('physical termination requested once', old.terminations(), 1);
    check('stop still waits for physical termination', settled, false);
    a.frame(3, [255, 255, 0, 255]);
    check('late frame while physical termination pending ignored', a.delivered(), 1);
    old.release(); await stop;
    a.frame(4, [255, 255, 255, 255]);
    check('late frame after stop ignored', a.delivered(), 1);
    check('closed manager owns no endpoints or credits',
      [old.manager.ports.size, old.manager.pending.size, old.manager.closing.size, old.manager.queuedBytes], [0, 0, 0, 0]);
    b.frame(2, [0, 128, 0, 255]); f.frame(2, [0, 0, 128, 255]); c.frame();
    check('replacement still updates after old stop', pixel(r), [0, 128, 0, 255]);
    check('foreign renderer remains live', pixel(foreign), [0, 0, 128, 255]);
    check('replacement and foreign frame delivery counts', [b.delivered(), f.delivered()], [2, 2]);
    for (const t of [next, other]) {
      const stopping = t.manager.stop(); await tick(); t.acknowledge(); await tick(); t.release(); await stopping;
      check('transport terminated exactly once', t.terminations(), 1);
    }
    check('all deterministic timers drained', c.timers.size, 0);
    check('no queued frames remain', c.frames.size, 0);
  } finally {
    names.forEach((name, n) => descriptors[n] ? Object.defineProperty(globalThis, name, descriptors[n]) : delete globalThis[name]);
  }
  console.log(JSON.stringify({checks, failures, productionModules: Object.keys(require.cache).filter(p => p.startsWith(root + '/lib/'))}));
  assert.equal(failures.length, 0, 'renderer stop/frame lifecycle invariants');
}
run().catch(error => { console.error(error.stack); process.exitCode = 1; });
