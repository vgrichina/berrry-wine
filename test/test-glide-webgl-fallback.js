'use strict';
// A browser without WebGL must still run a Glide game: the page bridge and the
// render Worker both fall back to the software executor instead of failing
// the guest's first kick (grSstWinOpen). Before this, NFS III Glide crashed
// straight after "[Glide] WebGL is unavailable" on a GPU-less page.
//
// tl;dr: a JS producer (test/gpu-stream-fixture.js) writes CREATE / CLEAR /
// PRESENT into a ring inside the harness wasm memory; the bridge (WebGL
// backend creation throws) and the Worker endpoint (no OffscreenCanvas in
// Node) must both drain it through the software executor and present the
// cleared colour. Also checks the CLI wiring: run.js hands Glide its own
// drawable factory.
const assert = require('assert');
const GS = require('../lib/gpu-stream');
const regions = require('../lib/region-map.generated');
const { makeProducer } = require('./gpu-stream-fixture');
const { bootRenderHarness } = require('./render-helper');
const { Bridge } = require('../lib/glide-host');
const GlideRenderWorker = require('../lib/gpu-stream-render-worker');

const { KIND, FMT, CONST } = GS;
const W = 16, H = 8;
(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
  // Scratch ring inside the (unused) guest heap of the harness instance.
  const base = regions.BASE.GUEST_HEAP_BASE + 0x200000;
  const producer = () => makeProducer({ buffer: memory.buffer, headerAddr: base,
    ringData: base + 0x1000, ringBytes: 0x4000, arenaData: base + 0x8000, arenaBytes: 0x4000 });
  const frameRecords = p => {
    p.emit('CREATE', { id: 1, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: W, height: H });
    p.emit('TARGETS', { color: 1, depth: 0 });
    p.emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff996633, z: 1, left: 0, top: 0, right: W, bottom: H });
    p.emit('PRESENT', { rt: 1, gamma: 0, x: 0, y: 0, w: W, h: H, surface: 0 });
  };
  const canvas = { width: 0, height: 0, getContext: () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
  }) };

  // Page bridge: WebGL backend creation throws.
  const errors = [], frames = [];
  const bridge = new Bridge({
    getMemory: () => memory, getExports: () => e, renderer: () => null,
    createCanvas: () => canvas,
    createBackend: () => { throw new Error('WebGL is unavailable'); },
    onError: error => errors.push(error.message),
    onPresent: (layer, frame) => frames.push(frame),
  });
  frameRecords(producer());
  assert.strictEqual(bridge.kick(base, CONST.KICK_SYNC), 1, 'the first kick succeeds without WebGL');
  assert(errors.some(m => /WebGL is unavailable/.test(m)), 'the WebGL failure is still reported');
  assert(errors.some(m => /software executor/.test(m)), 'and the fallback is named');
  assert.strictEqual(frames.length, 1, 'the software executor presented');
  const px = Array.from(frames[0].pixels.subarray(0, 4));
  assert.deepStrictEqual(px, [0x33, 0x66, 0x99, 0xff], 'software PRESENT carries the cleared colour as RGBA');
  bridge.kick(base, CONST.KICK_CLOSE);
  bridge.close();

  // Render Worker endpoint: no OffscreenCanvas in Node, so the WebGL branch fails.
  const warn = console.warn; const warned = [], sent = [];
  console.warn = m => warned.push(String(m));
  try {
    const endpoint = GlideRenderWorker.create({ instance: { exports: e }, memory, backend: 'webgl',
      sendFrame(frame) { sent.push(frame); } });
    frameRecords(producer());
    const reply = await endpoint.execute({ t: 'gps-kick', ring: base, mode: CONST.KICK_SYNC });
    assert.strictEqual(reply.result, 1, 'worker kick succeeds without WebGL');
    assert(warned.some(m => /software executor/.test(m)));
    assert.strictEqual(sent.length, 1, 'the Worker sent the software frame');
    assert.deepStrictEqual(Array.from(sent[0].pixels.subarray(0, 4)), [0x33, 0x66, 0x99, 0xff]);
    await endpoint.execute({ t: 'gps-kick', ring: base, mode: CONST.KICK_CLOSE });
    assert.throws(() => endpoint.execute({ t: 'glide-command', op: 1 }), /Unknown GPU stream render message/,
      'the retired packet protocol is refused');
    endpoint.destroy();
  } finally { console.warn = warn; }

  // The CLI host wiring. run.js keeps ctx.createCanvas null unless
  // --headless-gl or --glide-renderer=software (GL and D3D9 key their
  // no-3D-hardware path off it); ctx.glideCreateCanvas is Glide's own.
  const runJs = require('fs').readFileSync(require('path').join(__dirname, 'run.js'), 'utf8');
  assert(/glideCreateCanvas: createCanvas \|\| null/.test(runJs),
    'test/run.js hands the Glide bridge its own drawable factory');
  const hostJs = require('fs').readFileSync(require('path').join(__dirname, '..', 'lib', 'host-imports.js'), 'utf8');
  assert(/createCanvas: ctx\.glideCreateCanvas \|\| ctx\.createCanvas \|\| null/.test(hostJs),
    'host-imports prefers the Glide drawable factory');
  console.log('PASS Glide without WebGL falls back to the software executor on the page and in the render Worker');
})().catch(error => { console.error(error); process.exitCode = 1; });
