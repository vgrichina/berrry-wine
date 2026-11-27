'use strict';
// tl;dr: the WebGL GPU-stream executor makes at most ONE gl.getError() per
// drawn frame, and by default one per 120 presents. getError is a pipeline
// sync; checks around every COPY (D3D9 StretchRect) cost 2.5-5.4% of the page
// in Spelunky Classic HD's title room (scratch/runs/20261125-spelunky-hd-
// gameplay-profile p5), and one per PRESENT still cost ~2% (the sync, not the
// call count, is the price: scratch/runs/20261125-webgl-geterror).
// Runs on a stub GL (a Proxy that accepts every call and counts getError), so
// it needs no display and no headless GL:
//
//   1. A StretchRect-shaped frame (clear, same-size COPY, stretched COPY by
//      blit, opaque COPY by quad draw, COPY into a texture) repeated 250
//      times: getError only at presents 0, 120 and 240; with
//      errorCheckInterval 1, exactly one per PRESENT.
//   2. The shared pixel scenario (draws, uploads, fog, stencil...) at
//      interval 1: every PRESENT interval without a sync-required record
//      (READBACK, a D16/D24S8 CREATE, or a COPY that reads pixels back) has at
//      most one getError.
//   3. Error handling kept: an INVALID_OPERATION is counted in stats and
//      warned about, not thrown; OUT_OF_MEMORY fails the PRESENT whose check
//      finds it; CONTEXT_LOST_WEBGL throws "context lost", and a lost context
//      is refused on the next record by isContextLost() whatever the
//      interval; syncErrors (the WINE_GPS_GL_SYNC_ERRORS debug switch) checks
//      around each COPY again and names it.
//
//   node test/test-gpu-stream-webgl-geterror.js

const path = require('path');
const ROOT = path.join(__dirname, '..');
const GS = require(path.join(ROOT, 'lib', 'gpu-stream'));
const { WebGLBackend } = require(path.join(ROOT, 'lib', 'gpu-backend'));
const { Executor } = require(path.join(ROOT, 'lib', 'gpu-stream-webgl'));
const { makeProducer } = require('./gpu-stream-fixture');
const scenario = require('./gpu-stream-webgl-scenario');

const { CONST } = GS;
let checks = 0;
const failures = [];
const check = (name, ok, detail) => { checks++; if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };

// ── stub WebGL2 ──────────────────────────────────────────────────────────
// Upper-case names are distinct enum values (NO_ERROR is 0, the real ones
// the executor compares against are pinned); every other property is a
// method that accepts anything. `errors` is a queue getError hands out.
function stubGL() {
  const enums = new Map([['NO_ERROR', 0], ['OUT_OF_MEMORY', 0x0505], ['INVALID_OPERATION', 0x0502],
    ['CONTEXT_LOST_WEBGL', 0x9242], ['TEXTURE0', 0x84C0], ['COLOR_ATTACHMENT0', 0x8CE0],
    ['TEXTURE_CUBE_MAP_POSITIVE_X', 0x8515]]);
  let nextEnum = 0x10000, nextObj = 1;
  const state = { getError: 0, errors: [], lost: false };
  const params = (p) => {
    if (p === gl.SHADING_LANGUAGE_VERSION) return 'WebGL GLSL ES 3.00';
    if (p === gl.VERSION) return 'WebGL 2.0 (stub)';
    if (p === gl.RENDERER || p === gl.VENDOR) return 'stub';
    return 4096;
  };
  const methods = {
    getError: () => { state.getError++; return state.errors.length ? state.errors.shift() : 0; },
    isContextLost: () => state.lost,
    getParameter: params,
    getExtension: () => null,
    getSupportedExtensions: () => [],
    getContextAttributes: () => ({ stencil: true, depth: true, alpha: false, antialias: false }),
    checkFramebufferStatus: () => gl.FRAMEBUFFER_COMPLETE,
    getShaderParameter: () => true,
    getProgramParameter: (_p, pname) => (pname === gl.ACTIVE_UNIFORMS || pname === gl.ACTIVE_ATTRIBUTES ? 0 : true),
    getShaderInfoLog: () => '', getProgramInfoLog: () => '',
    getAttribLocation: () => 0,
    getUniformLocation: () => ({ id: nextObj++ }),
    getRenderbufferParameter: (_t, pname) => (pname === gl.RENDERBUFFER_STENCIL_SIZE ? 8 : 24),
    getShaderPrecisionFormat: () => ({ rangeMin: 127, rangeMax: 127, precision: 23 }),
    fenceSync: () => ({ id: nextObj++ }),
    clientWaitSync: () => gl.ALREADY_SIGNALED,
    getQueryParameter: () => 0,
  };
  const gl = new Proxy({}, {
    get(target, key) {
      if (typeof key !== 'string') return undefined;
      if (key in methods) return methods[key];
      if (/^[A-Z][A-Z0-9_]*$/.test(key)) {
        if (!enums.has(key)) enums.set(key, nextEnum++);
        return enums.get(key);
      }
      if (key === 'canvas' || key === 'drawingBufferWidth' || key === 'drawingBufferHeight') return undefined;
      if (key.startsWith('__')) return target[key];
      if (key.startsWith('create')) return () => ({ id: nextObj++ });
      return () => undefined;
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return { gl, state };
}

function stubBackend(w, h) {
  const { gl, state } = stubGL();
  const canvas = { width: w, height: h, getContext: (name) => (name === 'webgl2' ? gl : null) };
  const backend = new WebGLBackend(canvas, { apiVersion: 'auto' });
  return { gl, state, canvas, backend };
}

// An Executor that notes, per PRESENT, how many getErrors the frame made and
// whether it held a record that is allowed to check synchronously.
function countingExecutor(state, frames) {
  return class extends Executor {
    execute(rec) {
      if (!this._frame) this._frame = { start: state.getError, sync: false, ops: 0 };
      const copyReadsBefore = this._stats.copyReads || 0;
      const isSync = rec.name === 'READBACK' || (rec.name === 'CREATE' && (rec.fields.kind === CONST.KIND_DS));
      try { super.execute(rec); } finally {
        if (isSync || (this._stats.copyReads || 0) !== copyReadsBefore) this._frame.sync = true;
        this._frame.ops++;
        if (rec.name === 'PRESENT') {
          frames.push({ seq: rec.seq, getErrors: state.getError - this._frame.start, sync: this._frame.sync, ops: this._frame.ops });
          this._frame = null;
        }
      }
    }
  };
}

const W = 64, H = 64;
const ID = { DST: 1, SRC: 2, BIG: 3, TEX: 4 };

// One StretchRect-shaped frame per call, Spelunky-style: two RT copies and a
// present, plus the opaque (quad) and texture-destination COPY paths.
function copyFrames({ syncErrors, errorsAt, loseAt = -1, interval, n = 6 } = {}) {
  const { state, canvas, backend } = stubBackend(W, H);
  const frames = [];
  const Ex = countingExecutor(state, frames);
  const ex = new Ex({ canvas, backend, syncErrors: !!syncErrors, errorCheckInterval: interval });
  const p = makeProducer({ ringBytes: 1 << 16, arenaBytes: 1 << 20, buffer: new SharedArrayBuffer(1 << 22) });
  const ring = p.ring();
  const emit = (op, fields) => p.emit(op, fields);
  const drain = () => { GS.drain([ring], ex); p.store('arena_tail', p.load('arena_head')); };
  emit('CREATE', { id: ID.DST, kind: CONST.KIND_RT, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: W, height: H });
  emit('CREATE', { id: ID.SRC, kind: CONST.KIND_RT, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 16, height: 16 });
  emit('CREATE', { id: ID.BIG, kind: CONST.KIND_RT, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: W, height: H });
  emit('CREATE', { id: ID.TEX, kind: CONST.KIND_TEX2D, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 16, height: 16 });
  drain();
  const outcomes = [];
  for (let k = 0; k < n; k++) {
    if (errorsAt && errorsAt[k]) state.errors.push(...errorsAt[k]);
    if (k === loseAt) state.lost = true;
    emit('TARGETS', { color: ID.SRC, depth: 0 });
    emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff102030 + k, z: 1, left: 0, top: 0, right: 16, bottom: 16 });
    emit('COPY', { src: ID.SRC, dst: ID.BIG, sx: 0, sy: 0, sw: 16, sh: 16, dx: 4, dy: 4, dw: 16, dh: 16, filter: 2 });
    emit('COPY', { src: ID.SRC, dst: ID.DST, sx: 0, sy: 0, sw: 16, sh: 16, dx: 0, dy: 0, dw: W, dh: H, filter: 2 });
    emit('COPY', { src: ID.BIG, dst: ID.DST, sx: 0, sy: 0, sw: 32, sh: 32, dx: 0, dy: 0, dw: 16, dh: 16, filter: 1 | (1 << 24) });
    emit('COPY', { src: ID.SRC, dst: ID.TEX, sx: 0, sy: 0, sw: 16, sh: 16, dx: 0, dy: 0, dw: 16, dh: 16, filter: 1 });
    emit('PRESENT', { rt: ID.DST, x: 0, y: 0, w: W, h: H, surface: 0x77, stamp: k + 1 });
    try { drain(); outcomes.push(null); } catch (e) { outcomes.push(e); break; }
  }
  return { frames, outcomes, stats: ex.stats(), state };
}

// 1. release default: one getError every 120 presents (the first included),
// at most one in any frame, whatever the copies.
{
  const N = 250;
  const r = copyFrames({ n: N });
  check('copy frames all presented', r.frames.length === N && r.outcomes.every((e) => !e),
    `${r.frames.length} frames, ${r.outcomes.filter(Boolean).map(String).join('; ')}`);
  check('copy paths exercised (blit, quad, GPU same-size)', (r.stats.copyBlits || 0) >= N && (r.stats.copyDraws || 0) >= N
    && (r.stats.copies || 0) === 4 * N, JSON.stringify({ blits: r.stats.copyBlits, draws: r.stats.copyDraws, copies: r.stats.copies }));
  const over = r.frames.filter((f) => f.getErrors > 1);
  check('no copy frame makes more than one getError', over.length === 0, over.map((f) => `seq ${f.seq}: ${f.getErrors}`).join(', '));
  const checked = r.frames.map((f, k) => (f.getErrors ? k : -1)).filter((k) => k >= 0);
  check(`${N} copy frames: getError at presents 0, 120, 240 only`, checked.join() === '0,120,240', checked.join());
  check('stats count every getError', r.stats.glErrorChecks === r.state.getError, `${r.stats.glErrorChecks} vs ${r.state.getError}`);
  check('no GL errors reported', r.stats.glErrors === 0 && r.stats.glErrorFrames === 0);
}

// 1b. errorCheckInterval 1: exactly one getError per drawn frame.
{
  const r = copyFrames({ interval: 1 });
  for (const f of r.frames) check(`interval 1, copy frame seq ${f.seq}: one getError`, f.getErrors === 1, `${f.getErrors} getError calls`);
}

// 2. the pixel scenario's frames (draw-heavy) on the stub, checking at every
// present (the worst case for the budget).
{
  const { state, canvas, backend } = stubBackend(640, 480);
  const frames = [];
  const Counting = countingExecutor(state, frames);
  const Ex = class extends Counting { constructor(o) { super(Object.assign({}, o, { errorCheckInterval: 1 })); } };
  let threw = null;
  try {
    scenario.run({ GS, makeProducer, Executor: Ex, canvas, backend, buffer: new SharedArrayBuffer(1 << 22) });
  } catch (e) { threw = e; }
  const clean = frames.filter((f) => !f.sync);
  check('scenario ran to its presents', !threw && frames.length >= 5, threw ? String(threw.stack || threw) : `${frames.length} presents`);
  check('scenario has frames with no sync-required record', clean.length >= 3, `${clean.length} clean of ${frames.length}`);
  for (const f of clean) check(`scenario frame seq ${f.seq} (${f.ops} records): <= 1 getError`, f.getErrors <= 1, `${f.getErrors} getError calls`);
}

// 3a. a non-fatal error is counted and warned, the frame still presents.
{
  const warn = console.warn, warned = [];
  console.warn = (m) => warned.push(String(m));
  let r;
  try { r = copyFrames({ interval: 1, errorsAt: { 2: [0x0502] } }); } finally { console.warn = warn; }
  check('INVALID_OPERATION: all frames presented', r.frames.length === 6 && r.outcomes.every((e) => !e));
  check('INVALID_OPERATION counted', r.stats.glErrors === 1 && r.stats.glErrorFrames === 1 && r.stats.lastGlError === 0x0502,
    JSON.stringify({ glErrors: r.stats.glErrors, frames: r.stats.glErrorFrames }));
  check('INVALID_OPERATION warned once', warned.length === 1 && /0x502/.test(warned[0]), warned.join(' | '));
  // Default interval: the sticky error raised in frame 5 is reported at 120.
  warned.length = 0;
  console.warn = (m) => warned.push(String(m));
  try { r = copyFrames({ n: 125, errorsAt: { 5: [0x0502] } }); } finally { console.warn = warn; }
  check('default interval: INVALID_OPERATION reported at present 120', r.frames.length === 125 && r.stats.glErrors === 1
    && r.frames[120].getErrors === 2 && warned.length === 1, JSON.stringify({ glErrors: r.stats.glErrors, at120: r.frames[120] && r.frames[120].getErrors }));
}

// 3b. OUT_OF_MEMORY fails the PRESENT record whose check finds it.
{
  const warn = console.warn; console.warn = () => {};
  let r, d;
  try {
    r = copyFrames({ interval: 1, errorsAt: { 1: [0x0505] } });
    d = copyFrames({ n: 125, errorsAt: { 3: [0x0505] } });
  } finally { console.warn = warn; }
  const e = r.outcomes[1];
  check('OUT_OF_MEMORY fails the present', e instanceof GS.GpsError && /PRESENT/.test(e.message) && /out of memory/.test(e.message),
    String(e && e.message));
  check('default interval: OUT_OF_MEMORY fails present 120', d.outcomes.length === 121 && d.outcomes[120] instanceof GS.GpsError
    && d.outcomes.slice(0, 120).every((x) => !x), `${d.outcomes.length} outcomes, last ${d.outcomes[d.outcomes.length - 1]}`);
}

// 3c. a lost context: reported by getError, or seen by isContextLost() on the
// very next record whatever the interval (that call does not sync).
{
  const r = copyFrames({ interval: 1, errorsAt: { 3: [0x9242] } });
  const e = r.outcomes[3];
  check('CONTEXT_LOST_WEBGL throws context lost', e && /context lost/.test(e.message), String(e && e.message));
  const l = copyFrames({ n: 20, loseAt: 7 });
  const le = l.outcomes[7];
  check('default interval: isContextLost refuses the next record', l.outcomes.length === 8 && le && /context lost/.test(le.message),
    String(le && le.message));
}

// 3d. the debug switch: per-COPY checks that name the failing record.
{
  const r = copyFrames({ syncErrors: true });
  check('syncErrors: frames presented', r.frames.length === 6 && r.outcomes.every((e) => !e));
  for (const f of r.frames) check(`syncErrors frame seq ${f.seq}: drain+check per COPY plus present`, f.getErrors === 4 * 2 + 1,
    `${f.getErrors} getError calls`);
  const bad = copyFrames({ syncErrors: true, errorsAt: { 0: [0, 0x0502] } });
  const e = bad.outcomes[0];
  check('syncErrors: COPY error names the COPY', e instanceof GS.GpsError && /COPY seq \d+: COPY GL error 0x502/.test(e.message),
    String(e && e.message));
}

for (const f of failures) console.log(`FAIL ${f}`);
console.log(`${failures.length ? 'FAIL' : 'PASS'} test-gpu-stream-webgl-geterror: ${checks - failures.length}/${checks} checks`);
process.exit(failures.length ? 1 : 0);
