// Headless WebGL: does a Node canvas hand out a real GL context, and do the
// pixels it draws come back out through the ordinary 2D read paths?
//
// That second half is the whole risk. The frame lives in the driver's drawing
// buffer, not in the canvas's byte array, so every reader in the compositor --
// drawImage, toBuffer, getImageData -- would see an empty surface unless the
// read pulls it back. A test that only checks `getContext('webgl') !== null`
// passes while the screen is black.
//
// Skips cleanly when the optional native deps are absent: they are
// optionalDependencies precisely so a machine without them still runs the
// suite.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const hgl = require('../lib/headless-gl');
const { createCanvas } = require('../lib/canvas-compat');
const { WebGLBackend } = require('../lib/gpu-backend');

// The canvas and bridge can both work while the CLI still forgets to connect
// them. Keep the opt-in wiring pinned here: that omission made --headless-gl
// print an enablement message and then fail every device with "requires a GPU
// window".
const runSource = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
assert.match(runSource, /const HEADLESS_GL = hasFlag\('headless-gl'\)/,
  'run.js does not recognize --headless-gl');
assert.match(runSource, /createCanvas:\s*HEADLESS_GL\b[^?\n]*\?\s*createCanvas\s*:\s*null/,
  'run.js does not pass the opt-in Node canvas factory to its GPU bridges');

if (!hgl.available()) {
  console.log(`SKIP test-headless-gl: ${hgl.unavailableReason()}`);
  process.exit(0);
}

const W = 32, H = 16;
const canvas = createCanvas(W, H);
const gl = canvas.getContext('webgl', { alpha: false });
assert.ok(gl, 'canvas.getContext("webgl") returned null with the deps installed');
assert.strictEqual(canvas.getContext('webgl'), gl, 'getContext must be idempotent');

// A 2D context is still available on the same canvas object; asking for one
// must not disturb the GL context.
assert.ok(canvas.getContext('2d'), '2d context unavailable after webgl');
assert.strictEqual(canvas.getContext('webgl'), gl, 'gl context lost after asking for 2d');

console.log('renderer:', gl.getParameter(gl.RENDERER),
  '| version:', gl.getParameter(gl.VERSION),
  '| shading language:', gl.getParameter(gl.SHADING_LANGUAGE_VERSION));

// Generated D3D/OpenGL shaders are GLSL ES. The native provider exposes
// desktop GLSL 1.10, where an ES precision statement is a syntax error unless
// the generic backend ports it. Test an actual program, not just clear().
const gpu = new WebGLBackend(canvas);
const precisionProgram = gpu.createProgram(
  'attribute vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }',
  '#extension GL_OES_standard_derivatives : require\n' +
  'precision highp float; uniform highp vec4 tint; void main(){' +
  ' float slope=dFdx(gl_FragCoord.x); gl_FragColor=tint*max(slope,1.0); }',
  ['p'], ['tint']);
assert.ok(precisionProgram && precisionProgram.handle,
  'native headless context did not port ESSL precision/derivative syntax');
// lib/gl-compat.js's GL_CLAMP border program samples with an explicit LOD;
// the ESSL EXT directive is "unsupported" on desktop GLSL (Descent 3 crashed
// at its first clamped draw under --headless-gl).
const lodProgram = gpu.createProgram(
  'attribute vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }',
  '#extension GL_OES_standard_derivatives : require\n' +
  '#extension GL_EXT_shader_texture_lod : require\n' +
  'precision highp float; uniform sampler2D t; void main(){' +
  ' gl_FragColor=texture2DLodEXT(t,gl_FragCoord.xy/16.0,0.0); }',
  ['p'], ['t']);
assert.ok(lodProgram && lodProgram.handle,
  'native headless context did not port the ESSL explicit-LOD extension');
const precisionBuffer = gpu.createBuffer();
gpu.updateBuffer(precisionBuffer, gl.ARRAY_BUFFER,
  new Float32Array([-1, -1, 3, -1, -1, 3]));
gpu.setViewport(0, 0, W, H);
gpu.setUniform(precisionProgram, 'tint', '4f', [1, 0, 1, 1]);
gpu.draw({ program: precisionProgram, vertexBuffer: precisionBuffer,
  stride: 8, attributes: [{ name: 'p', size: 2, offset: 0 }],
  mode: gl.TRIANGLES, count: 3 });
gpu.present();
const center = ((H >> 1) * W + (W >> 1)) * 4;
assert.deepStrictEqual(Array.from(canvas._data.slice(center, center + 4)), [255, 0, 255, 255],
  'backend present did not publish the completed native GL frame to the compositor canvas');

// A native desktop framebuffer has alpha storage even when WebGL was requested
// with alpha:false.  D3D backbuffers depend on the WebGL contract here: texture
// alpha may carry an unrelated mask, and must not turn otherwise-correct RGB
// translucent when the headless canvas is composited or encoded to PNG.
gl.clearColor(0.25, 0.5, 0.75, 0);
gl.clear(gl.COLOR_BUFFER_BIT);
gpu.present();
const opaquePixel = Array.from(canvas._data.slice(0, 4));
assert.deepStrictEqual(opaquePixel, [64, 128, 191, 255],
  `alpha:false headless readback was not opaque: ${opaquePixel}`);
gl.clearColor(1, 0, 1, 1);
gl.clear(gl.COLOR_BUFFER_BIT);
gpu.present();
assert.deepStrictEqual(Array.from(canvas._data.slice(0, 4)), [255, 0, 255, 255]);
gpu.destroy();

// --- the pixels must reach the byte array the compositor reads -------------
// Green, and NOT the colour a zeroed buffer would be, so a no-op read cannot
// pass by accident.
gl.viewport(0, 0, W, H);
gl.clearColor(0, 1, 0, 1);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.finish();

// Before present, the canvas still holds the previous frame -- that is the
// contract, not a bug: readPixels mid-frame would hand over a half-drawn scene.
assert.strictEqual(canvas._data[1], 0, 'canvas showed GL pixels before present()');

canvas.markGlPresented();
const px = canvas._data;
assert.strictEqual(px[0], 0, `R: expected 0, got ${px[0]}`);
assert.strictEqual(px[1], 255, `G: expected 255, got ${px[1]} -- readPixels never reached the canvas`);
assert.strictEqual(px[2], 0, `B: expected 0, got ${px[2]}`);
assert.strictEqual(px[3], 255, `A: expected 255, got ${px[3]}`);

// --- the flip must be right ------------------------------------------------
// GL's origin is bottom-left and a canvas's is top-left. Draw a scissored band
// across the BOTTOM of the GL viewport and assert it lands at the BOTTOM of the
// canvas. Without the flip in readPixelsInto this is off by the full height,
// which a solid-colour test cannot see at all.
gl.enable(gl.SCISSOR_TEST);
gl.scissor(0, 0, W, 4);            // GL y=0..4 == bottom
gl.clearColor(0, 0, 1, 1);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.disable(gl.SCISSOR_TEST);
gl.finish();
canvas.markGlPresented();

const rowAt = y => { const p = canvas._data, o = y * W * 4; return [p[o], p[o + 1], p[o + 2]]; };
assert.deepStrictEqual(rowAt(0), [0, 255, 0], `top row should be green, got ${rowAt(0)} -- image is flipped`);
assert.deepStrictEqual(rowAt(H - 1), [0, 0, 255], `bottom row should be blue, got ${rowAt(H - 1)} -- image is flipped`);

// --- it must survive being used as a drawImage source ----------------------
// This is how the compositor actually consumes a GL layer.
const screen = createCanvas(W, H);
screen.getContext('2d').drawImage(canvas, 0, 0);
const sp = screen._data;
assert.strictEqual(sp[1], 255, `composited top row lost the frame: ${[sp[0], sp[1], sp[2]]}`);

// --- and a PNG encode must see it too --------------------------------------
const png = canvas.toBufferSync();
assert.ok(png && png.length > 100, 'toBufferSync produced no PNG');

// --- resize must not leave the drawing buffer at the old size --------------
canvas.width = 64;
assert.strictEqual(canvas.width, 64);
const gl2 = canvas.getContext('webgl');
assert.ok(gl2, 'no GL context after resize');
gl2.viewport(0, 0, 64, canvas.height);
gl2.clearColor(1, 0, 1, 1);
gl2.clear(gl2.COLOR_BUFFER_BIT);
gl2.finish();
canvas.markGlPresented();
const rp = canvas._data;
assert.strictEqual(rp.length, 64 * canvas.height * 4, 'pixel buffer not resized');
assert.strictEqual(rp[0], 255, 'R after resize');
assert.strictEqual(rp[2], 255, 'B after resize');
// The far end of the widened row is the part that stays stale if the drawing
// buffer was never resized.
const last = (64 * 1 - 1) * 4;
assert.strictEqual(rp[last + 2], 255, 'right edge stale: drawing buffer was not resized');

hgl.destroyContext(gl2);

// Fixed grow/shrink matrix: pending old-size work, both axes, non-power-of-two
// row strides, all edge pixels, and repeated native window lifetimes. These
// are independent assertions, never retries of an earlier failed case.
for (let lifetime = 0; lifetime < 4; lifetime++) {
  const c = createCanvas(32, 16);
  const g = c.getContext('webgl', { alpha: false });
  try {
    const texture = g.createTexture();
    for (const [w, h] of [[64, 16], [17, 9], [96, 48], [9, 60], [65, 17], [32, 16]]) {
      g.clearColor(0, 1, 0, 1);
      g.clear(g.COLOR_BUFFER_BIT); // deliberately no finish before resize
      c.width = w;
      c.height = h;
      assert.strictEqual(c.getContext('webgl'), g, 'resize replaced the context');
      g.bindTexture(g.TEXTURE_2D, texture);
      assert.deepStrictEqual(g.getParameter(g.TEXTURE_BINDING_2D), texture,
        'resize lost native resource ownership');
      g.clearColor(1, 0, 1, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      c.markGlPresented();
      const pixels = c._data;
      assert.strictEqual(pixels.length, w * h * 4);
      for (let i = 0; i < pixels.length; i += 4) {
        assert.deepStrictEqual(Array.from(pixels.subarray(i, i + 4)), [255, 0, 255, 255],
          `lifetime ${lifetime}, ${w}x${h}, pixel ${i / 4}`);
      }
      const copy = createCanvas(w, h);
      copy.getContext('2d').drawImage(c, 0, 0);
      assert.deepStrictEqual(copy._data, pixels, 'resized compositor source differs');
    }
    g.deleteTexture(texture);
  } finally { c.releaseWebGLContext(); }
  assert.strictEqual(hgl.liveContextCount(), 0);
}

// Retain delayed native-extent and timeout controls. Cached Document.width is
// already the requested size while the native extent is still outstanding.
// A swap must not run during that interval. The real driver still performs
// every resize, swap and readback; only completion reporting is delayed here.
{
  const provider = require('@node-3d/glfw'), glfw = provider.glfw;
  let remaining = 3, confirmed = false, swaps = 0;
  let getSize = win => {
    if (remaining-- > 0) return { width: 32, height: 16 };
    const size = glfw.getFramebufferSize(win);
    confirmed = size.width === 64 && size.height === 16;
    return size;
  };
  // Native exports are immutable. Load the exact production modules with a
  // forwarding provider, rather than pretending assignments patched the addon.
  const controlGlfw = new Proxy({}, { get: (_, key) => {
    if (key === 'getFramebufferSize') return win => getSize(win);
    if (key === 'swapBuffers') return win => {
      assert.ok(confirmed, 'swapped before native resize completion');
      swaps++;
      return glfw.swapBuffers(win);
    };
    return glfw[key];
  } });
  function loadControl(file, overrides) {
    const filename = path.join(__dirname, '..', 'lib', file);
    const req = require('module').createRequire(filename), mod = { exports: {} };
    new Function('require', 'module', 'exports', fs.readFileSync(filename, 'utf8'))(
      name => Object.hasOwn(overrides, name) ? overrides[name] : req(name), mod, mod.exports);
    return mod.exports;
  }
  const controlHgl = loadControl('headless-gl.js', {
    '@node-3d/glfw': { ...provider, glfw: controlGlfw },
  });
  const c = loadControl('raster-canvas.js', { './headless-gl': controlHgl }).createCanvas(32, 16);
  const g = c.getContext('webgl');
  try {
    c.width = 64;
    assert.strictEqual(swaps, 1, 'resize must refresh the completed drawable once');
    g.clearColor(0, 0, 1, 1); g.clear(g.COLOR_BUFFER_BIT);
    c.markGlPresented();
    assert.strictEqual(c._data[(64 * 16 - 1) * 4 + 2], 255);
    getSize = () => ({ width: 64, height: 16 });
    const start = performance.now();
    assert.throws(() => { c.height = 31; }, /native canvas resize failed/);
    const elapsed = performance.now() - start;
    assert.ok(elapsed >= 900 && elapsed < 2000, `resize timeout ${elapsed}ms`);
    assert.strictEqual(swaps, 1, 'failed resize swapped an unconfirmed extent');
    assert.strictEqual(controlHgl.liveContextCount(), 0, 'failed resize leaked its window');
    assert.strictEqual(controlHgl.resizeContext(g, 4, 4), false);
    assert.strictEqual(controlHgl.readPixelsInto(g, 4, 4, new Uint8Array(64)), false);
    assert.throws(() => g.clear(g.COLOR_BUFFER_BIT), /destroyed/);
  } finally {
    c.releaseWebGLContext();
  }
}

// The provider dispatch object is a singleton. Canvas ownership must not be:
// another canvas's creation, resize, readback or release cannot steal it.
{
  const a = createCanvas(8, 8), b = createCanvas(11, 7);
  const ga = a.getContext('webgl', { alpha: false });
  const gb = b.getContext('webgl', { alpha: true });
  try {
    assert.notStrictEqual(ga, gb, 'canvases alias the native dispatch singleton');
    ga.clearColor(1, 0, 0, 0); ga.clear(ga.COLOR_BUFFER_BIT);
    gb.clearColor(0, 0, 1, 0); gb.clear(gb.COLOR_BUFFER_BIT);
    a.markGlPresented(); b.markGlPresented();
    assert.deepStrictEqual(Array.from(a._data.slice(0, 4)), [255, 0, 0, 255]);
    assert.deepStrictEqual(Array.from(b._data.slice(0, 4)), [0, 0, 255, 0]);
    a.width = 23;
    ga.clearColor(0, 1, 0, 1); ga.clear(ga.COLOR_BUFFER_BIT);
    a.markGlPresented();
    assert.deepStrictEqual(Array.from(a._data.slice(-4)), [0, 255, 0, 255]);
    a.releaseWebGLContext();
    hgl.destroyContext(ga); // idempotent, including after another context exists
    assert.strictEqual(hgl.liveContextCount(), 1);
    assert.strictEqual(hgl.makeCurrent(ga), false);
    gb.clearColor(1, 1, 0, 1); gb.clear(gb.COLOR_BUFFER_BIT);
    b.markGlPresented();
    assert.deepStrictEqual(Array.from(b._data.slice(-4)), [255, 255, 0, 255]);
  } finally { a.releaseWebGLContext(); b.releaseWebGLContext(); }
  assert.strictEqual(hgl.liveContextCount(), 0);
}

// D3D9 uses this same factory in Node. Its capability probe must not require a
// browser document, and its short-lived probe context must be released before
// the real device asks the singleton native GL provider for another drawable.
const { Bridge } = require('../lib/d3d9-host');
const memory = new ArrayBuffer(128 * 1024);
let d3dCanvasRequests = 0;
const bridge = new Bridge({
  backend: 'webgl', enableProgrammable: true,
  getMemory: () => memory, guestToWasm: p => p,
  renderer: () => ({ windows: { 1: {} }, getWindowCanvas() {} }),
  createCanvas: (w, h) => { d3dCanvasRequests++; return createCanvas(w, h); },
});
// The three WebGL *_VECTORS limits are GLES enums a desktop context rejects;
// unmapped they returned garbage AND queued GL_INVALID_ENUM, which failed the
// probe below after a pixel-exact draw. A native GL context must report them
// like a browser does: a sane count and a clean error queue.
{
  const limitGl = createCanvas(4, 4).getContext('webgl');
  limitGl.getError();
  for (const [name, floor] of [['MAX_VERTEX_UNIFORM_VECTORS', 96],
    ['MAX_FRAGMENT_UNIFORM_VECTORS', 16], ['MAX_VARYING_VECTORS', 8]]) {
    const value = limitGl.getParameter(limitGl[name]);
    const error = limitGl.getError();
    assert.strictEqual(error, 0, `${name} query left GL error ${error}`);
    assert.ok(Number.isInteger(value) && value >= floor && value <= 65536,
      `${name} = ${value}, not a WebGL-shaped limit`);
  }
  hgl.destroyContext(limitGl);
}
const programmable = bridge.call(0x30005, 0, 0);
assert.strictEqual(programmable, 1,
  'D3D9 programmable-caps probe failed on a real native GL context (VS1.1/PS1.1 would be reported absent)');
assert.strictEqual(d3dCanvasRequests, 1, 'D3D9 capability probe did not use the headless canvas factory');
assert.strictEqual(hgl.liveContextCount(), 0, 'D3D9 capability probe leaked its native context');

const desc = 0x100, program = 0x1000, outputState = 0x8000;
const dv = new DataView(memory);
dv.setUint32(desc, 7, true);
dv.setUint32(desc + 4, program, true);
dv.setUint32(desc + 12, 16, true);
dv.setUint32(desc + 16, 16, true);
dv.setUint32(desc + 20, 1, true);
dv.setUint32(desc + 40, outputState, true);
assert.strictEqual(bridge.call(0x30003, desc, 0), 1,
  `D3D9 device creation failed headless: ${bridge.lastError || 'unknown error'}`);
assert.strictEqual(hgl.liveContextCount(), 1, 'D3D9 device did not own a native context');
assert.strictEqual(bridge.call(0x30004, 0, 7), 1, 'D3D9 device release failed');
assert.strictEqual(hgl.liveContextCount(), 0, 'D3D9 device release leaked its native context');

// Native context allocation alone missed a desktop shader-port regression in
// the MRT shader used by WGL. Exercise the real bridge through drawable readback.
{
  const { OpenGLHostBridge } = require('../lib/gl-compat');
  const storage = new ArrayBuffer(4096);
  const wgl = new OpenGLHostBridge({
    backend: 'webgl', createCanvas, getMemory: () => storage,
    renderer: { windows: { 1: { hwnd: 1, w: 8, h: 8 } } },
  });
  try {
    const handle = wgl.createContext(1);
    assert.notStrictEqual(handle, 0, 'WGL rejected a usable native context');
    assert.strictEqual(wgl.makeCurrent(handle, 1), 1);
    const context = wgl.contexts.get(handle);
    assert.ok(context.frontend.program.handle, 'fixed-function drawable shader failed to link');
    context.backend.clear([1, 0, 0, 1], 0x4000);
    const pixel = new Uint8Array(4);
    context.backend.readPixels(0, 0, 1, 1, 0x1908, 0x1401, pixel);
    assert.deepStrictEqual(Array.from(pixel), [255, 0, 0, 255]);
  } finally {
    // The harness owns the native window supplied by its canvas factory.
    const nativeGl = wgl._webglBackend && wgl._webglBackend.gl;
    wgl.destroy();
    if (nativeGl) hgl.destroyContext(nativeGl);
  }
  assert.strictEqual(hgl.liveContextCount(), 0, 'WGL probe leaked its native context');
}

console.log('PASS test-headless-gl');
