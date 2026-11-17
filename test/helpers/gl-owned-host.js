'use strict';
// The host side of WAT-owned WGL (src/09a8cw-gl-wgl.wat) for test harnesses:
// a gpu_gl_call override that answers an instance's lone 0x10008 WGL-mode
// query exactly as lib/host-imports.js does ("WAT owns", plus the GPU stream
// decision when `gps` is given) and throws on any other GL batch, because no
// other GL record may reach a host. The JS GL frontend these harnesses used
// to replay the stream into (OpenGLHostBridge, lib/gl-compat.js) is retired.
//
//   gpu_gl_call: ownedGlCall(() => memory)             // instance keeps its gps
//   gpu_gl_call: ownedGlCall(() => memory, { gps: 1 }) // host decides: gps on
//
// D3DIM's 0x20000..0x20006 endpoint opcodes answer 0 (no queued executor),
// as the harnesses did before, unless `d3d` handles them.
const Stream = require('../../lib/gl-command-stream');

function isModeQuery(buffer, at, bytes) {
  if ((bytes >>> 0) < 8 || !buffer) return false;
  const d = new DataView(buffer, at >>> 0, 8);
  return d.getUint32(0, true) === (bytes >>> 0) && d.getUint32(4, true) === 0x10008;
}

function ownedMode(gps) {
  return (0x57470000 | 1 | (gps === null || gps === undefined ? 0 : 2 | (gps ? 4 : 0))) | 0;
}

function ownedGlCall(getMemory, { gps = null, d3d = null, queries = null } = {}) {
  return function gpu_gl_call(op, at, bytes) {
    if (op === Stream.WAT_STREAM_FLUSH_OPCODE) {
      const memory = getMemory();
      const buffer = memory && memory.buffer ? memory.buffer : memory;
      if (isModeQuery(buffer, at, bytes)) {
        if (queries) queries.n = (queries.n || 0) + 1;
        return ownedMode(typeof gps === 'function' ? gps() : gps);
      }
      throw new Error('OpenGL command batch reached the host; WAT owns WGL (src/09a8cw-gl-wgl.wat)');
    }
    if (op >= 0x20000 && op <= 0x20006) return d3d ? d3d(op, at, bytes) : 0;
    throw new Error('unexpected host opcode ' + op);
  };
}

// For a harness that keeps its own gpu_gl_call: the answer to a stream flush.
function ownedAnswer(memory, at, bytes, gps = null) {
  const buffer = memory && memory.buffer ? memory.buffer : memory;
  if (isModeQuery(buffer, at, bytes)) return ownedMode(gps);
  throw new Error('OpenGL command batch reached the host; WAT owns WGL (src/09a8cw-gl-wgl.wat)');
}

// WAT-owned wglCreateContext / wglMakeCurrent accept only a drawable WAT
// knows: a live window in its window table, with a client rect (the default
// viewport). The retired JS bridge took windows from a JS renderer object
// instead, so a harness that drives GL without creating real windows
// registers them here.
function ownedWindow(e, hwnd, w, h) {
  e.wnd_table_set(hwnd >>> 0, 0);
  e.test_gdi_client_rect_set(hwnd >>> 0, 0, 0, w | 0, h | 0);
}

// A stand-in for the old `renderer.windows` map: assigning a window entry, or
// a later `.clientRect`, updates the WAT window. getExports is read at each
// write, so the map may be built before the instance exists.
function ownedRenderer(getExports, windows = {}) {
  const sync = (hwnd, win) => {
    const r = win.clientRect || win;
    ownedWindow(getExports(), Number(hwnd), r.w, r.h);
  };
  const wrap = (hwnd, win) => new Proxy(win, {
    set(target, key, value) {
      target[key] = value;
      if (key === 'clientRect') sync(hwnd, target);
      return true;
    },
  });
  const map = new Proxy({}, {
    set(target, hwnd, win) {
      target[hwnd] = wrap(hwnd, win);
      sync(hwnd, win);
      return true;
    },
  });
  for (const [hwnd, win] of Object.entries(windows)) map[hwnd] = win;
  return { windows: map, repaint() {} };
}

module.exports = { ownedGlCall, ownedAnswer, ownedMode, isModeQuery, ownedWindow, ownedRenderer };
