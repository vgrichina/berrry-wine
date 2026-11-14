// GPU stream v2 software executor (docs/gpu-stream-v2.md).
//
// Executes byte records (lib/gpu-stream.js record objects) on the production
// WAT shader VM and quad rasterizer behind lib/d3d9-software-backend.js
// (Native.Device). The frontend (today only Glide, src/09a8h-glide.wat) has
// already lowered everything: textures arrive decoded as RGBA, pixel shaders as
// native IR, state as RASTER/BIND/CONSTS. This file only maps records onto the
// native device -- it owns no API semantics and never reads guest memory.
//
// Fail fast: anything a record asks for that this executor cannot do exactly
// (an unknown op, a resource of the wrong kind, a format or state it does not
// implement) throws a GpsError; drain() stores it in the ring. Nothing is
// skipped silently.
//
// Byte orders: RT/TEX2D fmt A8B8G8R8 is R,G,B,A in memory. Native color
// surfaces are D3D A8R8G8B8 (B,G,R,A), so RT uploads/readbacks swizzle;
// native texture levels are R,G,B,A (format 0) and go in unchanged.
//
// Node: require('./gpu-stream-software'); browser/workers:
// globalThis.GpuStreamSoftware (load gpu-stream.generated.js, gpu-stream.js
// and d3d9-software-backend.js first).
(function (root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const GS = node ? require('./gpu-stream') : root.GpuStream;
  const Native = node ? require('./d3d9-software-backend') : root.D3D9SoftwareBackend;
  if (!GS) throw new Error('gpu-stream-software.js: load gpu-stream.js first');
  if (!Native) throw new Error('gpu-stream-software.js: load d3d9-software-backend.js first');
  const api = factory(GS, Native);
  if (node) module.exports = api;
  if (root) root.GpuStreamSoftware = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (GS, Native) {
  'use strict';

  const { OP, KIND, FMT, CONST, ERR, GpsError } = GS;
  const NATIVE_COLOR = 21;   // D3DFMT_A8R8G8B8 (alpha kept: Glide blends with destination alpha)
  const NATIVE_D16 = 80;     // D3DFMT_D16
  const STRIDE = 64;
  // Native draws are cut at the old backend's packet limit (84 triangles);
  // triangles stay in order, so the split is invisible.
  const MAX_TRIANGLES = 84;
  const LAYOUT = [
    { usage: CONST.USAGE_POSITIONT, index: 0, offset: 0 },
    { usage: CONST.USAGE_COLOR, index: 0, offset: 16 },
    { usage: CONST.USAGE_TEXCOORD, index: 0, offset: 32 },
    { usage: CONST.USAGE_TEXCOORD, index: 1, offset: 48 },
  ];
  const ATTRIBUTES = [
    { register: 0, usage: 9, usageIndex: 0, type: 3, offset: 0 },
    { register: 5, usage: 10, usageIndex: 0, type: 3, offset: 16 },
    { register: 7, usage: 5, usageIndex: 0, type: 3, offset: 32 },
    { register: 8, usage: 5, usageIndex: 1, type: 3, offset: 48 },
  ];
  const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const FIXED = Object.freeze({
    lighting: false, fog: false, specular: false,
    stages: [
      { colorOp: 2, colorArg1: 2, alphaOp: 2, alphaArg1: 2, transformFlags: 0, texCoordIndex: 0 },
      { colorOp: 2, colorArg1: 2, alphaOp: 2, alphaArg1: 2, transformFlags: 0, texCoordIndex: 1 },
      { colorOp: 1 },
    ],
  });
  const IR_MAGIC = 0x44534952;

  class Executor {
    constructor(options = {}) {
      if (typeof options.getExports !== 'function' || typeof options.getMemory !== 'function')
        throw new TypeError('GpuStreamSoftware.Executor: getExports and getMemory are required');
      this.options = options;
      this.canvas = options.canvas || null;
      this.nowMs = options.nowMs || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
      this.native = null;
      this.width = 0;
      this.height = 0;
      this.res = new Map();       // id -> resource (RT, DS, TEX2D)
      this.shaders = new Map();   // id -> {irVersion, nativeBytes}
      this.layouts = new Set();   // ids of validated layouts
      this.samplers = new Map();  // id -> native sampler object
      this.target = { color: 0, depth: 0 };
      this.raster = null;
      this.bound = [null, null];  // slot -> {texture, sampler}
      this.consts = new Float32Array(32);
      this.constCount = 0;
      this.closed = false;
      this.s = {
        records: 0, counts: {}, draws: 0, nativeDraws: 0, triangles: 0, points: 0, lines: 0,
        degenerateLines: 0, clears: 0, presents: 0, uploads: 0, uploadBytes: 0, readbacks: 0,
        readbackBytes: 0, marks: 0, fences: 0, shaders: 0, creates: 0, releases: 0,
        drawCpuMs: 0, presentCpuMs: 0, readbackCpuMs: 0,
      };
    }

    // ── helpers ──────────────────────────────────────────────────────────
    _fail(rec, msg, code = ERR.EXECUTOR) {
      throw new GpsError(`software executor: ${rec.name} seq ${rec.seq}: ${msg}`, code, rec.seq);
    }
    _unsupported(rec, msg) { this._fail(rec, msg, ERR.UNSUPPORTED); }
    _res(rec, id, what, kind) {
      if (!id) this._fail(rec, `${what} is id 0`);
      const r = this.res.get(id);
      if (!r) this._fail(rec, `${what} ${id} was never created or was released`);
      if (kind !== undefined && r.kind !== kind) this._fail(rec, `${what} ${id} is kind ${r.kind}, expected ${kind}`);
      return r;
    }
    _isLive(id) { return this.res.has(id) || this.shaders.has(id) || this.layouts.has(id) || this.samplers.has(id); }
    _colorRes(r) { return { id: r.id, width: r.width, height: r.height, format: NATIVE_COLOR }; }
    _depthRes(r) { return { id: r.id, width: r.width, height: r.height, format: NATIVE_D16 }; }
    _dropTextureKeys(t) {
      if (t.keys.size && this.native) {
        const keys = [];
        for (const k of t.keys) keys.push(k, k + ':bgra');
        this.native.releaseTextures(keys);
      }
      t.keys.clear();
    }

    // ── records ──────────────────────────────────────────────────────────
    execute(rec) {
      if (this.closed) throw new GpsError('software executor: closed', ERR.EXECUTOR, rec.seq);
      const f = rec.fields;
      switch (rec.op) {
        case OP.CREATE: this._create(rec, f); break;
        case OP.UPLOAD: this._upload(rec, f); break;
        case OP.RELEASE: this._release(rec, f); break;
        case OP.SHADER: this._shader(rec, f); break;
        case OP.LAYOUT: this._layout(rec, f); break;
        case OP.SAMPLER: this._sampler(rec, f); break;
        case OP.TARGETS:
          if (f.color) this._res(rec, f.color, 'color target', KIND.RT);
          if (f.depth) this._res(rec, f.depth, 'depth target', KIND.DS);
          this.target = { color: f.color, depth: f.depth };
          break;
        case OP.VIEWPORT: this._unsupported(rec, 'VIEWPORT is not implemented (Glide never sends it)'); break;
        case OP.RASTER: this.raster = Object.assign({}, f); break;
        case OP.BIND: this._bind(rec); break;
        case OP.CONSTS: this._consts(rec, f); break;
        case OP.DRAW: this._unsupported(rec, 'DRAW from a vertex buffer is not implemented'); break;
        case OP.DRAW_UP: this._draw(rec, f); break;
        case OP.CLEAR: this._clear(rec, f); break;
        case OP.COPY: this._unsupported(rec, 'COPY is not implemented'); break;
        case OP.FENCE: this.s.fences++; break; // drain() completes the slot
        case OP.READBACK: this._readback(rec, f); break;
        case OP.PRESENT: this._present(rec, f); break;
        case OP.MARK: this.s.marks++; break;
        default: throw new GpsError(`software executor: unknown op ${rec.op} seq ${rec.seq}`, ERR.UNKNOWN_OP, rec.seq);
      }
      this.s.counts[rec.name] = (this.s.counts[rec.name] || 0) + 1;
      this.s.records++;
    }

    _create(rec, f) {
      if (!f.id) this._fail(rec, 'id 0 is reserved for none');
      if (this._isLive(f.id)) this._fail(rec, `id ${f.id} is already live`);
      const w = f.width, h = f.height;
      if (!(w >= 1 && h >= 1 && w <= 2048 && h <= 2048)) this._fail(rec, `bad size ${w}x${h}`);
      if (f.kind === KIND.RT) {
        if (f.fmt !== FMT.A8B8G8R8 || f.levels !== 1) this._unsupported(rec, `RT fmt ${f.fmt} levels ${f.levels} (want A8B8G8R8, 1)`);
        if (!this.native) {
          this.native = new Native.Device({
            width: w, height: h,
            getExports: this.options.getExports, getMemory: this.options.getMemory,
          });
          this.width = w; this.height = h;
          if (this.canvas) { this.canvas.width = w; this.canvas.height = h; }
        } else if (w !== this.width || h !== this.height) {
          this._unsupported(rec, `RT ${w}x${h} differs from the device's ${this.width}x${this.height}`);
        }
        const r = { id: f.id, kind: KIND.RT, fmt: f.fmt, width: w, height: h };
        this.native.createColor(this._colorRes(r));
        this.res.set(f.id, r);
      } else if (f.kind === KIND.DS) {
        if (f.fmt !== FMT.D16 || f.levels !== 1) this._unsupported(rec, `DS fmt ${f.fmt} levels ${f.levels} (want D16, 1)`);
        if (!this.native) this._unsupported(rec, 'a depth surface before any color RT');
        const r = { id: f.id, kind: KIND.DS, fmt: f.fmt, width: w, height: h };
        // Allocated now so storage failures surface here. Native depth
        // surfaces start at 1.0 (far), as the old Glide backend's did.
        this.native.depthSurface(this._depthRes(r), Math.min(w, this.width), Math.min(h, this.height));
        this.res.set(f.id, r);
      } else if (f.kind === KIND.TEX2D) {
        if (f.fmt !== FMT.A8B8G8R8 && f.fmt !== FMT.L8) this._unsupported(rec, `TEX2D fmt ${f.fmt}`);
        if (!(f.levels >= 1 && f.levels <= 12)) this._unsupported(rec, `TEX2D with ${f.levels} levels`);
        const bpp = f.fmt === FMT.L8 ? 1 : 4;
        const levels = [];
        for (let i = 0; i < f.levels; i++) {
          const lw = Math.max(1, w >> i), lh = Math.max(1, h >> i);
          levels.push({ width: lw, height: lh, pixels: new Uint8Array(lw * lh * bpp) });
        }
        this.res.set(f.id, { id: f.id, kind: KIND.TEX2D, fmt: f.fmt, bpp, width: w, height: h, levels, gen: 0, keys: new Set() });
      } else this._unsupported(rec, `CREATE kind ${f.kind}`);
      this.s.creates++;
    }

    _upload(rec, f) {
      const r = this._res(rec, f.id, 'upload target');
      const x = f.x | 0, y = f.y | 0, w = f.w | 0, h = f.h | 0, pitch = f.pitch;
      if (f.face !== 0) this._unsupported(rec, `face ${f.face}`);
      if (r.kind === KIND.RT) {
        if (f.level !== 0) this._fail(rec, `RT level ${f.level}`);
        this._rect(rec, x, y, w, h, r.width, r.height);
        if (pitch < w * 4 || f.bytes < pitch * (h - 1) + w * 4) this._fail(rec, `pitch ${pitch}/bytes ${f.bytes} too small for ${w}x${h}`);
        const src = rec.arena(f.src, f.bytes);
        const bgra = new Uint8Array(w * h * 4);
        for (let row = 0; row < h; row++) {
          let s = row * pitch, d = row * w * 4;
          for (let i = 0; i < w; i++, s += 4, d += 4) {
            bgra[d] = src[s + 2]; bgra[d + 1] = src[s + 1]; bgra[d + 2] = src[s]; bgra[d + 3] = src[s + 3];
          }
        }
        this.native.updateColor(this._colorRes(r), bgra, w * 4, { x, y, width: w, height: h });
      } else if (r.kind === KIND.TEX2D) {
        const lv = r.levels[f.level];
        if (!lv) this._fail(rec, `level ${f.level} of a ${r.levels.length}-level texture`);
        this._rect(rec, x, y, w, h, lv.width, lv.height);
        const row = w * r.bpp;
        if (pitch < row || f.bytes < pitch * (h - 1) + row) this._fail(rec, `pitch ${pitch}/bytes ${f.bytes} too small for ${w}x${h}`);
        const src = rec.arena(f.src, f.bytes);
        for (let i = 0; i < h; i++)
          lv.pixels.set(src.subarray(i * pitch, i * pitch + row), ((y + i) * lv.width + x) * r.bpp);
        this._dropTextureKeys(r);
        r.gen++;
      } else this._fail(rec, `upload to kind ${r.kind}`);
      this.s.uploads++;
      this.s.uploadBytes += f.bytes;
    }

    _rect(rec, x, y, w, h, W, H) {
      if (!(x >= 0 && y >= 0 && w >= 1 && h >= 1 && x + w <= W && y + h <= H))
        this._fail(rec, `rect ${x},${y} ${w}x${h} outside ${W}x${H}`);
    }

    _release(rec, f) {
      const id = f.id;
      if (this.shaders.delete(id) || this.layouts.delete(id) || this.samplers.delete(id)) { this.s.releases++; return; }
      const r = this._res(rec, id, 'release of');
      if (r.kind === KIND.RT) this.native.releaseColor(id);
      else if (r.kind === KIND.DS) {
        const surface = this.native.depthSurfaces.get(id);
        this.native.idle();
        this.native.free(surface);
        this.native.depthSurfaces.delete(id);
      } else if (r.kind === KIND.TEX2D) this._dropTextureKeys(r);
      this.res.delete(id);
      if (this.target.color === id) this.target.color = 0;
      if (this.target.depth === id) this.target.depth = 0;
      this.s.releases++;
    }

    _shader(rec, f) {
      if (!f.id) this._fail(rec, 'id 0 is reserved for none');
      if (this._isLive(f.id)) this._fail(rec, `id ${f.id} is already live`);
      if (f.stage !== CONST.STAGE_PS) this._unsupported(rec, `shader stage ${f.stage} (only pixel shaders)`);
      const bytes = GS.shaderIR(rec).slice();
      if (bytes.length < 32 || (bytes.length & 3)) this._fail(rec, `IR of ${bytes.length} bytes`);
      const dv = new DataView(bytes.buffer);
      if (dv.getUint32(0, true) !== IR_MAGIC) this._fail(rec, `IR magic 0x${dv.getUint32(0, true).toString(16)}`);
      if (dv.getUint32(4, true) !== 1) this._unsupported(rec, `IR ABI ${dv.getUint32(4, true)}`);
      if (dv.getUint32(24, true) !== bytes.length) this._fail(rec, `IR says ${dv.getUint32(24, true)} bytes, record has ${bytes.length}`);
      this.shaders.set(f.id, { irVersion: 1, nativeBytes: bytes });
      this.s.shaders++;
    }

    _layout(rec, f) {
      if (!f.id) this._fail(rec, 'id 0 is reserved for none');
      if (this._isLive(f.id)) this._fail(rec, `id ${f.id} is already live`);
      const elems = GS.decodeLayoutElems(rec);
      const ok = f.stride === STRIDE && elems.length === LAYOUT.length && elems.every((e, i) =>
        e.slot === 0 && e.type === CONST.VTYPE_FLOAT4 && e.usage === LAYOUT[i].usage
        && e.index === LAYOUT[i].index && e.offset === LAYOUT[i].offset);
      if (!ok) this._unsupported(rec, `layout ${JSON.stringify(elems)} stride ${f.stride} (only POSITIONT,COLOR,TEXCOORD0,TEXCOORD1 float4 x4)`);
      this.layouts.add(f.id);
    }

    _sampler(rec, f) {
      if (!f.id) this._fail(rec, 'id 0 is reserved for none');
      if (this._isLive(f.id)) this._fail(rec, `id ${f.id} is already live`);
      const addr = (a) => a === 1 || a === 3;
      if (!addr(f.address_u) || !addr(f.address_v)) this._unsupported(rec, `address ${f.address_u}/${f.address_v} (wrap 1 or clamp 3)`);
      if (![1, 2].includes(f.min) || ![1, 2].includes(f.mag) || ![0, 1, 2].includes(f.mip))
        this._unsupported(rec, `filter min ${f.min} mag ${f.mag} mip ${f.mip}`);
      if (!Number.isFinite(f.lod_bias)) this._fail(rec, `lod_bias ${f.lod_bias}`);
      this.samplers.set(f.id, {
        addressU: f.address_u, addressV: f.address_v, min: f.min, mag: f.mag, mip: f.mip, lodBias: f.lod_bias,
      });
    }

    _bind(rec) {
      const bound = [null, null];
      for (const e of GS.decodeBind(rec)) {
        if (e.slot > 1) this._unsupported(rec, `sampler slot ${e.slot}`);
        if (bound[e.slot]) this._fail(rec, `slot ${e.slot} bound twice`);
        if (!e.texture) continue;
        const t = this._res(rec, e.texture, `slot ${e.slot} texture`, KIND.TEX2D);
        if (t.fmt !== FMT.A8B8G8R8) this._unsupported(rec, `sampling a fmt ${t.fmt} texture`);
        const s = this.samplers.get(e.sampler);
        if (!s) this._fail(rec, `slot ${e.slot} sampler ${e.sampler} is not live`);
        bound[e.slot] = { texture: e.texture, sampler: e.sampler };
      }
      this.bound = bound;
    }

    _consts(rec, f) {
      if (f.stage !== CONST.STAGE_PS) this._unsupported(rec, `constants for stage ${f.stage}`);
      if (f.first + f.count > 8) this._unsupported(rec, `constants ${f.first}+${f.count} beyond c7`);
      const v = GS.decodeConsts(rec);
      for (let i = 0; i < v.length; i++) if (!Number.isFinite(v[i])) this._fail(rec, `non-finite constant c${f.first + (i >> 2)}`);
      this.consts.set(v, f.first * 4);
      this.constCount = Math.max(this.constCount, f.first + f.count);
    }

    _texture(rec, slot) {
      const b = this.bound[slot];
      if (!b) return null;
      const t = this._res(rec, b.texture, `slot ${slot} texture`, KIND.TEX2D);
      const sampler = this.samplers.get(b.sampler);
      if (!sampler) this._fail(rec, `slot ${slot} sampler ${b.sampler} was released`);
      const levels = t.levels.map((lv, i) => {
        const key = `gps/${t.id}/${t.gen}/${i}`;
        t.keys.add(key);
        return { key, width: lv.width, height: lv.height, pixels: lv.pixels };
      });
      return { width: t.width, height: t.height, levels, sampler };
    }

    _glideFragment(rec, r) {
      if (r.depth_mode !== CONST.DEPTH_W && r.fog_mode === CONST.FOG_NONE) return undefined;
      let table = new Uint8Array(64);
      if (r.fog_mode === CONST.FOG_TABLE_W) {
        const t = this._res(rec, r.fog_table, 'fog table', KIND.TEX2D);
        if (t.fmt !== FMT.L8 || t.width !== 64 || t.height !== 1) this._fail(rec, `fog table ${r.fog_table} is not L8 64x1`);
        table = t.levels[0].pixels;
      }
      const c = r.fog_color >>> 0;
      return {
        depthMode: r.depth_mode, fogMode: r.fog_mode, bias: r.depth_bias | 0, table,
        color: (0xff000000 | ((c & 255) << 16) | (((c >>> 8) & 255) << 8) | ((c >>> 16) & 255)) >>> 0,
      };
    }

    _draw(rec, f) {
      const r = this.raster;
      if (!r) this._fail(rec, 'no RASTER before the draw');
      if (f.vs !== 0) this._unsupported(rec, `vertex shader ${f.vs} (only pretransformed)`);
      if (f.vbuf !== 0 || f.ibuf !== 0) this._fail(rec, `DRAW_UP names vbuf ${f.vbuf} / ibuf ${f.ibuf}`);
      if (f.stride !== STRIDE) this._unsupported(rec, `stride ${f.stride}`);
      if (!this.layouts.has(f.layout)) this._fail(rec, `layout ${f.layout} is not live`);
      const ps = this.shaders.get(f.ps);
      if (!ps) this._fail(rec, `pixel shader ${f.ps} is not live`);
      const color = this._res(rec, this.target.color, 'color target', KIND.RT);
      const depth = this.target.depth ? this._res(rec, this.target.depth, 'depth target', KIND.DS) : null;
      // RASTER validation (the whole block arrives with every pipeline).
      if (r.depth_mode > 2) this._unsupported(rec, `depth_mode ${r.depth_mode}`);
      if (r.depth_mode && !depth) this._fail(rec, 'depth test without a depth target');
      if (r.fog_mode > 3) this._unsupported(rec, `fog_mode ${r.fog_mode}`);
      if (r.fog_mode && r.fog_flags)
        this._unsupported(rec, `fog_flags ${r.fog_flags} (no-multiply/no-add fog is not in the native Glide fragment path)`);
      if (r.blend !== 1) this._unsupported(rec, `blend ${r.blend} (Glide always blends)`);
      for (const k of ['src_rgb', 'dst_rgb', 'src_alpha', 'dst_alpha'])
        if (!(r[k] >= 1 && r[k] <= 11)) this._unsupported(rec, `${k} ${r[k]}`);
      for (const k of ['zfunc', 'alpha_func'])
        if (!(r[k] >= 1 && r[k] <= 8)) this._fail(rec, `${k} ${r[k]}`);
      if (![1, 2, 3].includes(r.cull)) this._fail(rec, `cull ${r.cull}`);
      if ((r.colormask & 7) !== 0 && (r.colormask & 7) !== 7 || r.colormask > 15) this._unsupported(rec, `colormask ${r.colormask}`);
      if (r.fill !== 3) this._unsupported(rec, `fill ${r.fill}`);
      let tris;
      const n = f.count;
      const src = rec.arena(f.voff, n * STRIDE);
      const dv = new DataView(src.buffer, src.byteOffset, src.byteLength);
      const vtx = new Float32Array(n * 16);
      for (let i = 0; i < n * 16; i++) vtx[i] = dv.getFloat32(i * 4, true);
      // The native rasterizer samples at integer centers; Glide's screen
      // coordinates use half-integer centers.
      for (let i = 0; i < n; i++) { vtx[i * 16] -= 0.5; vtx[i * 16 + 1] -= 0.5; }
      if (f.prim === CONST.PRIM_TRIANGLELIST) {
        if (!n || n % 3) this._fail(rec, `${n} vertices is not a triangle list`);
        tris = vtx;
        this.s.triangles += n / 3;
      } else if (f.prim === CONST.PRIM_LINELIST || f.prim === CONST.PRIM_POINTLIST) {
        tris = this._expand(rec, f.prim, vtx, n);
      } else this._unsupported(rec, `primitive ${f.prim}`);
      this.s.draws++;
      if (!tris.length) return;
      const textures = [this._texture(rec, 0), this._texture(rec, 1)];
      const glide = this._glideFragment(rec, r);
      const scissor = {
        enabled: true, left: r.scissor_left | 0, top: r.scissor_top | 0,
        right: r.scissor_right | 0, bottom: r.scissor_bottom | 0,
      };
      const state = {
        zenable: r.depth_mode !== 0, zwrite: !!r.zwrite, zfunc: r.zfunc, cull: r.cull,
        blend: true, separateAlpha: true,
        srcblend: r.src_rgb, dstblend: r.dst_rgb, srcblendalpha: r.src_alpha, dstblendalpha: r.dst_alpha,
        colorWriteMask: r.colormask,
        alphaTest: r.alpha_func !== 8, alphaFunc: r.alpha_func, alphaRef: r.alpha_ref,
      };
      const pixelConstants = this.consts.slice(0, Math.max(1, this.constCount) * 4);
      const fixedFunction = Object.assign({}, FIXED, { world: identity(), view: identity(), projection: identity() });
      const start = this.nowMs();
      const total = tris.length / 16 / 3;
      for (let first = 0; first < total; first += MAX_TRIANGLES) {
        const count = Math.min(MAX_TRIANGLES, total - first);
        const part = tris.subarray(first * 48, (first + count) * 48);
        this.native.draw({
          primitive: 4, primitiveCount: count, stride: STRIDE,
          vertices: new Uint8Array(part.buffer, part.byteOffset, part.byteLength),
          colorAttachment: this._colorRes(color),
          depthAttachment: depth ? this._depthRes(depth) : null,
          glide,
          attributes: ATTRIBUTES,
          vertexShader: null,
          pixelShader: ps,
          pixelConstants,
          fixedFunction,
          state, scissor, textures,
        });
        this.s.nativeDraws++;
      }
      this.s.drawCpuMs += this.nowMs() - start;
    }

    // Points and lines as the old backend drew them: a one-pixel square per
    // point, a one-pixel-wide quad per line (zero-length lines draw nothing).
    _expand(rec, prim, vtx, n) {
      const per = prim === CONST.PRIM_LINELIST ? 2 : 1;
      if (!n || n % per) this._fail(rec, `${n} vertices is not a ${per === 2 ? 'line' : 'point'} list`);
      const out = [];
      for (let i = 0; i < n; i += per) {
        const a = vtx.subarray(i * 16, i * 16 + 16), b = per === 2 ? vtx.subarray((i + 1) * 16, (i + 2) * 16) : a;
        let corners;
        if (per === 1) {
          corners = [[a, -0.5, -0.5], [a, 0.5, -0.5], [a, -0.5, 0.5], [a, 0.5, 0.5]];
          this.s.points++;
        } else {
          const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
          this.s.lines++;
          if (!len) { this.s.degenerateLines++; continue; }
          const ox = (-dy / len) * 0.5, oy = (dx / len) * 0.5;
          corners = [[a, ox, oy], [a, -ox, -oy], [b, ox, oy], [b, -ox, -oy]];
        }
        for (const k of [0, 1, 2, 2, 1, 3]) {
          const [v, x, y] = corners[k];
          const q = Float32Array.from(v);
          q[0] += x; q[1] += y;
          out.push(q);
        }
      }
      const tris = new Float32Array(out.length * 16);
      out.forEach((q, i) => tris.set(q, i * 16));
      return tris;
    }

    _clear(rec, f) {
      if (f.mask & ~3) this._unsupported(rec, `clear mask ${f.mask}`);
      const color = this._res(rec, this.target.color, 'color target', KIND.RT);
      const depth = this.target.depth ? this._res(rec, this.target.depth, 'depth target', KIND.DS) : null;
      if ((f.mask & 2) && !depth) this._fail(rec, 'depth clear without a depth target');
      if ((f.colormask & 7) !== 0 && (f.colormask & 7) !== 7 || f.colormask > 15) this._unsupported(rec, `colormask ${f.colormask}`);
      if (!Number.isFinite(f.z) || f.z < 0 || f.z > 1) this._fail(rec, `z ${f.z}`);
      this.s.clears++;
      if (!f.mask) return;
      const c = f.rgba >>> 0;
      const rgba = [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24].map((v) => v / 255);
      const rect = [f.left | 0, f.top | 0, f.right | 0, f.bottom | 0];
      this.native.clear(rgba, f.mask, f.z, [rect], depth ? this._depthRes(depth) : null, 0,
        this._colorRes(color), f.colormask);
    }

    _readback(rec, f) {
      const r = this._res(rec, f.rt, 'readback rt', KIND.RT);
      if (f.fmt !== FMT.RGB565) this._unsupported(rec, `readback fmt ${f.fmt}`);
      const x = f.x | 0, y = f.y | 0, w = f.w | 0, h = f.h | 0;
      this._rect(rec, x, y, w, h, r.width, r.height);
      if (f.pitch < w * 2) this._fail(rec, `pitch ${f.pitch} < ${w * 2}`);
      const start = this.nowMs();
      const img = this.native.readColor(this._colorRes(r));
      const src = img.pixels, sp = img.pitch;
      const dst = rec.arena(f.dst, f.pitch * h);
      for (let row = 0; row < h; row++) {
        let s = (y + row) * sp + x * 4, d = row * f.pitch;
        for (let i = 0; i < w; i++, s += 4, d += 2) {
          const v = ((src[s + 2] >> 3) << 11) | ((src[s + 1] >> 2) << 5) | (src[s] >> 3);
          dst[d] = v & 255; dst[d + 1] = v >> 8;
        }
      }
      this.s.readbacks++;
      this.s.readbackBytes += w * h * 2;
      this.s.readbackCpuMs += this.nowMs() - start;
    }

    _present(rec, f) {
      const r = this._res(rec, f.rt, 'present rt', KIND.RT);
      const x = f.x | 0, y = f.y | 0, w = f.w | 0, h = f.h | 0;
      this._rect(rec, x, y, w, h, r.width, r.height);
      let lut = null;
      if (f.gamma) {
        const g = this._res(rec, f.gamma, 'gamma table', KIND.TEX2D);
        if (g.fmt !== FMT.A8B8G8R8 || g.width !== 256 || g.height !== 1) this._fail(rec, `gamma ${f.gamma} is not A8B8G8R8 256x1`);
        lut = g.levels[0].pixels;
      }
      const start = this.nowMs();
      const img = this.native.readColor(this._colorRes(r));
      const src = img.pixels, sp = img.pitch;
      const pixels = new Uint8ClampedArray(w * h * 4);
      for (let row = 0; row < h; row++) {
        let s = (y + row) * sp + x * 4, d = row * w * 4;
        for (let i = 0; i < w; i++, s += 4, d += 4) {
          const R = src[s + 2], G = src[s + 1], B = src[s];
          if (lut) { pixels[d] = lut[R * 4]; pixels[d + 1] = lut[G * 4 + 1]; pixels[d + 2] = lut[B * 4 + 2]; }
          else { pixels[d] = R; pixels[d + 1] = G; pixels[d + 2] = B; }
          // The RGB565 display is opaque; RT alpha never becomes page transparency.
          pixels[d + 3] = 255;
        }
      }
      this.s.presents++;
      this.s.presentCpuMs += this.nowMs() - start;
      const frame = { pixels, width: w, height: h, hwnd: f.surface >>> 0, stats: this.stats() };
      if (this.canvas) {
        if (this.canvas.width !== w) this.canvas.width = w;
        if (this.canvas.height !== h) this.canvas.height = h;
        const ctx = this.canvas.getContext('2d');
        const image = ctx.createImageData(w, h);
        image.data.set(pixels);
        ctx.putImageData(image, 0, 0);
        frame.surface = this.canvas;
      }
      if (this.options.presentPixels) this.options.presentPixels(frame);
      else if (this.options.onPresent) this.options.onPresent(frame);
    }

    stats() {
      const s = Object.assign({}, this.s, { counts: Object.assign({}, this.s.counts) });
      s.resources = this.res.size;
      s.nativeBytes = this.native ? this.native.bytes : 0;
      return s;
    }

    close() {
      if (this.closed) return;
      this.closed = true;
      if (this.native) this.native.destroy();
      this.native = null;
      this.res.clear(); this.shaders.clear(); this.layouts.clear(); this.samplers.clear();
      this.bound = [null, null];
      this.raster = null;
    }
  }

  return { Executor };
});
