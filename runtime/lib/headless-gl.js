// A real WebGL context for headless Node runs, so the OpenGL guests are not
// browser-only.
//
// WHY THIS EXISTS
//   lib/gl-compat.js reaches the GPU through `document.createElement('canvas')`
//   and `canvas.getContext('webgl')`. Node has neither, so every OpenGL guest
//   -- Warcraft III, Quake II, the D3D paths that land on the GL backend --
//   could only ever be driven through tools/profile-web-frames.js and a real
//   Chrome. That is why the WC3 investigation was a browser-automation problem
//   rather than an emulator one: `wglCreateContext` returns 0 headless, the
//   guest takes its "no 3D hardware" path, and test/run.js's whole tracing
//   arsenal (--trace-api, --count, --break, --handler-hist, --time-scale) was
//   unreachable for exactly the apps that most needed it.
//
// WHAT BACKS IT: @node-3d/webgl + @node-3d/glfw
//   Node-API addons, which is the property that matters. A Node-API binary is
//   ABI-stable, so one prebuild serves every current and future Node with no
//   per-version release -- verified here: 50 `napi_` symbols and zero V8
//   symbols in webgl.node.
//
//   The two alternatives were measured and rejected:
//     - `gl` (stackgl/headless-gl) publishes per-ABI prebuilds for 108/115/127
//       only (Node 18/20/22) and CANNOT be built from source on anything
//       newer: its vendored ANGLE uses std::auto_ptr, removed in C++17, while
//       Node 23+ V8 headers #error below C++20. No overlapping standard exists.
//     - `@kmamal/gl` is the same nan/V8 design with one more ABI (131, Node
//       23). Node 24 is ABI 137 and its newest release predates it, so it dies
//       on upgrade and its source fallback hits the same auto_ptr wall.
//   Both would have made a Node upgrade a breaking change. This one does not.
//
//   Rendering needs a drawable, so "headless" here means a HIDDEN GLFW window,
//   not the absence of one. Measured on an M1: `WebGL 1.0`, renderer
//   `Apple M1`, MAX_TEXTURE_SIZE 16384 -- native GL, not a software rasterizer
//   and not ANGLE.
//
// ONE SHARED CONTEXT -- THE ONE REAL LIMITATION
//   Unlike headless-gl, where each createGl() is independent, @node-3d/webgl
//   exports a SINGLETON `gl` bound to whichever window is current. Two
//   simultaneous contexts therefore share one state machine, and the last
//   makeCurrent() wins. Every entry point here makes its own window current
//   first, which is correct as long as the guest is not interleaving draw
//   calls between two contexts inside one frame. WC3 and Quake II use one
//   context; createContext warns on the second so this cannot fail silently.
//
// OPTIONAL BY CONSTRUCTION
//   Both packages are optionalDependencies. Everything degrades to `null`, and
//   a caller that gets null behaves exactly as Node behaved before this file
//   existed. The browser never loads it.
//
// WEBGL 1, NOT 2
//   lib/gpu-backend.js already falls back to `webgl`/`experimental-webgl` when
//   not asked for version 2. The one thing that genuinely needs WebGL2 is
//   transform feedback on the d3d9 shader path, which throws its own clear
//   error rather than rendering wrongly.

let Glfw = null;
let webgl = null;
let loadError = null;
let loaded = false;

// Loading is deferred and memoized: requiring a native module costs real time,
// and the overwhelmingly common case is a run that never asks for GL at all.
function load() {
  if (loaded) return !loadError;
  loaded = true;
  try {
    Glfw = require('@node-3d/glfw');
    // The package exports { classes, webgl }; the context is the `webgl`
    // member, not the module. Getting this wrong yields an object whose every
    // GL method is undefined, which reads as a dead driver.
    webgl = require('@node-3d/webgl').webgl;
    if (!Glfw || !Glfw.Document || !webgl) throw new Error('unexpected module shape');
    Glfw.Document.setWebgl(webgl);
  } catch (err) {
    loadError = err;
    Glfw = null;
    webgl = null;
  }
  return !loadError;
}

function available() { return load(); }

// GLFW needs a real display, and on macOS the display LIST GOES EMPTY when the
// screen sleeps -- glfwInit() still succeeds, so nothing looks wrong until a
// window creation fails. This is the single most likely reason a --headless-gl
// run that worked an hour ago does not work now, and it has nothing to do with
// machine load or with how many contexts are live. Returns the monitor count,
// or -1 when the build cannot be asked.
function displayCount() {
  if (!load()) return -1;
  try {
    const g = Glfw.glfw;
    if (!g || typeof g.getMonitors !== 'function') return -1;
    if (typeof g.init === 'function') g.init();
    const mons = g.getMonitors();
    return Array.isArray(mons) ? mons.length : -1;
  } catch (_) { return -1; }
}

// Non-null when GL is installed and loadable but cannot actually open a window,
// so a caller can say so at startup instead of letting the guest discover it.
function noDisplayReason() {
  if (!available()) return null;
  const n = displayCount();
  if (n !== 0) return null;
  return 'headless GL loaded but GLFW sees ZERO displays -- the screen is almost'
    + ' certainly asleep. Wake it, or hold it awake for the run with:'
    + ' caffeinate -d node test/run.js ...';
}

// Why the load failed, for a caller that wants to say so out loud rather than
// silently render nothing. A missing optional dependency, a wrong-architecture
// binary and a broken build are very different problems.
function unavailableReason() {
  if (available()) return null;
  const msg = loadError ? String(loadError.message || loadError).split('\n')[0] : 'not loaded';
  if (/Cannot find module/.test(msg)) {
    return 'headless GL needs the optional native deps: npm install @node-3d/webgl @node-3d/glfw';
  }
  if (/incompatible architecture/.test(msg)) {
    return `headless GL binary is the wrong architecture for this node (${process.arch}): ${msg}`;
  }
  return `headless GL is installed but did not load: ${msg}`;
}

// Every context, so the singleton can be pointed at the right window and so a
// harness can assert nothing leaked.
const live = new Set();

function makeCurrent(gl) {
  const doc = gl && gl.__wineDoc;
  if (!doc) return false;
  try { if (typeof doc.makeCurrent === 'function') doc.makeCurrent(); return true; }
  catch (_) { return false; }
}

// Create an offscreen WebGL 1 context sized w x h, or null if the native deps
// are not installed.
// WebGL's three *_VECTORS limits (MAX_VERTEX_UNIFORM_VECTORS 0x8DFB,
// MAX_VARYING_VECTORS 0x8DFC, MAX_FRAGMENT_UNIFORM_VECTORS 0x8DFD) are GLES
// enums. The binding passes getParameter straight to glGetIntegerv on a
// desktop context, where they do not exist: the query returns uninitialised
// stack (measured: 25693024) and leaves GL_INVALID_ENUM in the error queue.
// That queued error is what failed the D3D9 programmable-caps probe -- its
// VS1.1/PS1.1 triangle rendered pixel-exact and then `getError() !== 0` said
// no, so Black & White 2 aborted with "Pixel Shader version 1.1" headlessly.
// Desktop GL states the same limits in scalar *_COMPONENTS (4 per vector).
// The singleton is shared across contexts, so this installs once.
const GLES_VECTOR_LIMITS = {
  0x8DFB: 0x8B4A, // MAX_VERTEX_UNIFORM_VECTORS   <- MAX_VERTEX_UNIFORM_COMPONENTS
  0x8DFC: 0x8B4B, // MAX_VARYING_VECTORS          <- MAX_VARYING_FLOATS
  0x8DFD: 0x8B49, // MAX_FRAGMENT_UNIFORM_VECTORS <- MAX_FRAGMENT_UNIFORM_COMPONENTS
};
function installGlesLimitQueries(gl) {
  if (gl.__wineLimitQueries) return;
  const native = gl.getParameter;
  gl.getParameter = function (pname) {
    const scalar = GLES_VECTOR_LIMITS[pname >>> 0];
    if (scalar === undefined) return native.call(this, pname);
    const components = native.call(this, scalar);
    return typeof components === 'number' && components > 0 ? (components / 4) | 0 : 0;
  };
  gl.__wineLimitQueries = true;
}

// The binding's depthRange raises GL_INVALID_OPERATION on the GL 2.1 legacy
// context GLFW hands out on macOS, and the state does NOT change: measured
// depthRange(0.25,0.75) -> error 1282, DEPTH_RANGE still [0,1]. It is the
// other half of the failed D3D9 caps probe, which sets the viewport's
// minZ/maxZ (0..1) before its test triangle and then checks getError().
// A request that matches the range already in effect lost nothing, so its
// error is dropped; a request the binding really could not apply is said
// once, because a depth range that silently stays [0,1] would read as a
// z-fighting or sorting bug in the guest.
function installDepthRangeShim(gl) {
  if (gl.__wineDepthRange) return;
  const native = gl.depthRange;
  let warned = false;
  gl.depthRange = function (near, far) {
    native.call(this, near, far);
    const error = this.getError();
    if (!error) return;
    const range = this.getParameter(this.DEPTH_RANGE);
    if (range && range[0] === near && range[1] === far) return;
    if (!warned) {
      warned = true;
      console.log(`[gl] warning: depthRange(${near},${far}) rejected by @node-3d/webgl`
        + ` (GL error ${error}); depth range stays [${range ? Array.from(range) : '?'}]`);
    }
  };
  gl.__wineDepthRange = true;
}

function createContext(w, h, opts) {
  if (!available()) return null;
  const width = Math.max(1, w | 0);
  const height = Math.max(1, h | 0);
  let doc = null;
  try {
    doc = new Glfw.Document({
      width, height, title: 'wine-assembly (headless)', visible: false,
      // The compositor reads the drawing buffer back with readPixels AFTER the
      // guest's present returns -- exactly the case the WebGL spec leaves
      // undefined without this. Without it the frame is whatever the driver
      // left behind: usually black, intermittently not, which is the worst way
      // for this to fail.
      ...(opts && opts.depth === false ? { depth: false } : {}),
    });
    const gl = (typeof doc.getContext === 'function' && doc.getContext('webgl')) || webgl;
    if (!gl || typeof gl.getParameter !== 'function') throw new Error('no GL context from the window');
    installGlesLimitQueries(gl);
    installDepthRangeShim(gl);
    const entry = { gl, doc };
    live.add(entry);
    // The singleton is shared, so tagging it per context is not enough on its
    // own -- but the tag is what lets makeCurrent() find the right window, and
    // it is refreshed on every create so the newest context owns the tag.
    gl.__wineDoc = doc;
    // Native desktop GL always exposes an alpha channel, even when the caller
    // requested WebGL's `{ alpha: false }`.  Remember the requested canvas
    // contract so readback can emulate the opaque default framebuffer instead
    // of leaking fragment alpha into the software compositor.
    gl.__wineAlpha = !opts || opts.alpha !== false;
    gl.__wineDestroy = () => {
      if (!live.has(entry)) return;
      live.delete(entry);
      try { doc.destroy ? doc.destroy() : (doc.window && doc.window.destroy()); } catch (_) {}
    };
    if (live.size > 1) {
      console.log(`[gl] warning: ${live.size} simultaneous GL contexts, but @node-3d/webgl`
        + ' shares one state machine between them; interleaved draws will fight');
    }
    return gl;
  } catch (err) {
    try { if (doc && doc.destroy) doc.destroy(); } catch (_) {}
    // Say so. A failed context is not a rendering bug and does not look like
    // one: the caller returns null, the guest's wglCreateContext returns 0, it
    // takes its no-3D-hardware path, and the first visible symptom is an
    // app-level "unable to initialize DirectX" message box a hundred log lines
    // later -- at a batch rate several times normal, because a guest spinning
    // behind a modal retires tiny blocks. That reads convincingly as a flaky
    // emulator. It is a window that could not be created, and the reason is
    // right here.
    console.log(`[gl] context creation FAILED (${width}x${height}, ${live.size} already live): `
      + String(err && err.message || err).split('\n')[0]);
    loadError = err;
    return null;
  }
}

// Resize an existing context in place. Returns false when it cannot be done,
// which tells the caller to recreate instead of silently rendering at the old
// size -- a wrong-sized drawing buffer reads downstream as a scaling bug in the
// compositor and is very hard to see.
function resizeContext(gl, w, h) {
  if (!gl || !gl.__wineDoc) return false;
  const width = Math.max(1, w | 0);
  const height = Math.max(1, h | 0);
  const doc = gl.__wineDoc;
  try {
    if (typeof doc.resize === 'function') doc.resize(width, height);
    else { doc.width = width; doc.height = height; }
    // Trust nothing: confirm the drawable actually changed rather than
    // assuming the setter took.
    const okW = (doc.width | 0) === width || (doc.w | 0) === width;
    if (!okW) return false;
    makeCurrent(gl);
    // The window resizing is not the drawable resizing. Under X11/Mesa
    // (llvmpipe), once the context has drawn at the old size, its buffers
    // keep that size until the next swap. GLFW reports the new window and
    // framebuffer size immediately, and event pumping does not help (measured:
    // 32 -> 64 left a clear covering 32 columns, even after 500 ms). One swap
    // makes Mesa re-read the drawable. The resized buffer's contents are
    // undefined either way, as they are for a canvas resize.
    const win = doc._window;
    if (win && Glfw && Glfw.glfw && typeof Glfw.glfw.swapBuffers === 'function') {
      Glfw.glfw.swapBuffers(win);
    }
    gl.viewport(0, 0, width, height);
    return true;
  } catch (_) { return false; }
}

function destroyContext(gl) {
  if (gl && typeof gl.__wineDestroy === 'function') gl.__wineDestroy();
}

// Read the drawing buffer into an RGBA Uint8ClampedArray laid out the way a 2D
// canvas is: top row first. GL's origin is bottom-left, so this flips. The
// destination is passed in because the caller owns a canvas-sized buffer
// already and a per-frame allocation of a 940x702 surface is 2.6 MB of garbage.
function readPixelsInto(gl, w, h, dest) {
  const width = Math.max(1, w | 0);
  const height = Math.max(1, h | 0);
  const stride = width * 4;
  const need = stride * height;
  if (!dest || dest.length < need) return false;
  makeCurrent(gl);
  const row = readPixelsInto._row && readPixelsInto._row.length === need
    ? readPixelsInto._row : (readPixelsInto._row = new Uint8Array(need));
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, row);
  for (let y = 0; y < height; y++) {
    dest.set(row.subarray((height - 1 - y) * stride, (height - y) * stride), y * stride);
  }
  if (gl.__wineAlpha === false) {
    for (let i = 3; i < need; i += 4) dest[i] = 255;
  }
  return true;
}

module.exports = {
  available, unavailableReason, displayCount, noDisplayReason,
  createContext, resizeContext, destroyContext,
  readPixelsInto, makeCurrent,
  liveContextCount: () => live.size,
};
