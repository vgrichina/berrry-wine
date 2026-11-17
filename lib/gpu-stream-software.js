// GPU stream v2 software executor (docs/gpu-stream-v2.md).
//
// Executes byte records (lib/gpu-stream.js record objects) on the production
// WAT shader VM and quad rasterizer behind lib/d3d9-software-backend.js
// (Native.Device). Frontends (Glide today, D3DIM next) have already lowered
// everything: textures arrive decoded as A8B8G8R8, pixel shaders as native
// IR, state as RASTER/BIND/CONSTS, vertices as pretransformed POSITIONT
// records described by a LAYOUT. This file only maps records onto the
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
  const NATIVE_DS = { [FMT.D16]: 80, [FMT.D24S8]: 75 };
  const MAX_SIZE = 2048;
  // Native draws are cut at the old backend's packet limit (84 triangles);
  // triangles stay in order, so the split is invisible.
  const MAX_TRIANGLES = 84;
  // Native fixed-function vertex lowering carries six texture outputs.
  const MAX_TEXCOORDS = 6;
  // The native shader VM (09ag) carries six sampler stages; caps say so.
  const MAX_SLOTS = 6;
  // Native VS input registers per internal slot (any distinct values < 16).
  const REG_POS = 0, REG_COLOR = 5, REG_TEX = 7;
  const VTYPE_SIZE = [4, 8, 12, 16, 4];
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

  const CAPS = Object.freeze({
    flags: CONST.CAP_VS_IR | CONST.CAP_STENCIL | CONST.CAP_LOGIC_OP | CONST.CAP_OCCLUSION | CONST.CAP_BORDER_LINEAR | CONST.CAP_MIRRORONCE | CONST.CAP_CLIP_PLANES | CONST.CAP_WBUFFER | CONST.CAP_COPY,
    maxTexture: MAX_SIZE, maxSamplers: MAX_SLOTS, maxAniso: 1,
    formats: (1 << FMT.A8B8G8R8) | (1 << FMT.D16) | (1 << FMT.D24S8),
  });

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
      this.layouts = new Map();   // id -> decoded layout
      this.samplers = new Map();  // id -> native sampler object
      this.target = { color: 0, depth: 0 };
      this.viewport = null;       // {x, y, w, h} or null = the whole target
      this.raster = null;
      this.bound = [];            // slot -> {texture, sampler}
      this.consts = new Float32Array(32);
      this.constCount = 0;
      this.vconsts = new Float32Array(1024);  // VS c0..c255
      this.vconstCount = 0;
      this.occlusion = false;
      this.clip = { mask: 0, planes: new Float32Array(24) };  // CLIP, D3D clip space
      this.closed = false;
      this.s = {
        records: 0, counts: {}, draws: 0, nativeDraws: 0, triangles: 0, points: 0, lines: 0,
        degenerateLines: 0, clears: 0, presents: 0, uploads: 0, uploadBytes: 0, readbacks: 0,
        readbackBytes: 0, marks: 0, fences: 0, shaders: 0, creates: 0, releases: 0,
        drawCpuMs: 0, presentCpuMs: 0, readbackCpuMs: 0,
      };
    }

    caps() { return CAPS; }

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
    _depthRes(r) { return { id: r.id, width: r.width, height: r.height, format: NATIVE_DS[r.fmt] }; }
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
          this.viewport = null;
          break;
        case OP.VIEWPORT: this._viewport(rec, f); break;
        case OP.RASTER: this._raster(rec, f); break;
        case OP.BIND: this._bind(rec); break;
        case OP.CONSTS: this._consts(rec, f); break;
        case OP.CLIP: this._clip(rec, f); break;
        case OP.DRAW: this._draw(rec, f); break;
        case OP.DRAW_UP: this._draw(rec, f); break;
        case OP.CLEAR: this._clear(rec, f); break;
        case OP.COPY: this._copy(rec, f); break;
        case OP.FENCE: this._fence(rec, f); break; // drain() completes the slot
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
      if (f.kind === KIND.VBUF || f.kind === KIND.IBUF) {
        GS.checkBufferCreate(f, (m) => this._fail(rec, m));
        this.res.set(f.id, { id: f.id, kind: f.kind, bytes: new Uint8Array(f.size) });
        this.s.creates++;
        return;
      }
      const w = f.width, h = f.height;
      if (!(w >= 1 && h >= 1 && w <= MAX_SIZE && h <= MAX_SIZE)) this._fail(rec, `bad size ${w}x${h}`);
      if (f.kind === KIND.RT) {
        if (f.fmt !== FMT.A8B8G8R8 || f.levels !== 1) this._unsupported(rec, `RT fmt ${f.fmt} levels ${f.levels} (want A8B8G8R8, 1)`);
        if (!this.native) {
          this.native = new Native.Device({
            width: w, height: h,
            getExports: this.options.getExports, getMemory: this.options.getMemory,
          });
          this.width = w; this.height = h;
          if (this.canvas) { this.canvas.width = w; this.canvas.height = h; }
        }
        // A later RT (an offscreen target) may be larger than the first: native
        // colour resources carry their own size, as the old D3D9 path's did.
        const r = { id: f.id, kind: KIND.RT, fmt: f.fmt, width: w, height: h };
        this.native.createColor(this._colorRes(r));
        this.res.set(f.id, r);
      } else if (f.kind === KIND.DS) {
        if (!NATIVE_DS[f.fmt] || f.levels !== 1) this._unsupported(rec, `DS fmt ${f.fmt} levels ${f.levels} (want D16 or D24S8, 1)`);
        if (!this.native) this._unsupported(rec, 'a depth surface before any color RT');
        const r = { id: f.id, kind: KIND.DS, fmt: f.fmt, width: w, height: h };
        // Allocated now so storage failures surface here. Native depth
        // surfaces start at 1.0 (far), as the old Glide backend's did.
        this.native.depthSurface(this._depthRes(r), Math.min(w, this.width), Math.min(h, this.height));
        this.res.set(f.id, r);
      } else if (f.kind === KIND.TEX2D) {
        if (f.fmt !== FMT.A8B8G8R8) this._unsupported(rec, `TEX2D fmt ${f.fmt} (only A8B8G8R8; producers convert at UPLOAD)`);
        if (!(f.levels >= 1 && f.levels <= 12)) this._unsupported(rec, `TEX2D with ${f.levels} levels`);
        const levels = [];
        for (let i = 0; i < f.levels; i++) {
          const lw = Math.max(1, w >> i), lh = Math.max(1, h >> i);
          levels.push({ width: lw, height: lh, pixels: new Uint8Array(lw * lh * 4) });
        }
        this.res.set(f.id, { id: f.id, kind: KIND.TEX2D, fmt: f.fmt, width: w, height: h, levels, gen: 0, keys: new Set() });
      } else if (f.kind === KIND.CUBE) {
        // Six faces in D3D/GL order (+X, -X, +Y, -Y, +Z, -Z), each a full
        // level list; UPLOAD names the face.
        if (f.fmt !== FMT.A8B8G8R8) this._unsupported(rec, `CUBE fmt ${f.fmt} (only A8B8G8R8; producers convert at UPLOAD)`);
        if (w !== h) this._fail(rec, `CUBE ${w}x${h} is not square`);
        if (!(f.levels >= 1 && f.levels <= 12 && (w >> (f.levels - 1)) >= 1)) this._unsupported(rec, `CUBE with ${f.levels} levels`);
        const faces = [];
        for (let face = 0; face < 6; face++) {
          const levels = [];
          for (let i = 0; i < f.levels; i++) {
            const lw = Math.max(1, w >> i);
            levels.push({ width: lw, height: lw, pixels: new Uint8Array(lw * lw * 4) });
          }
          faces.push(levels);
        }
        this.res.set(f.id, { id: f.id, kind: KIND.CUBE, fmt: f.fmt, width: w, height: h, faces, levels: faces[0], gen: 0, keys: new Set() });
      } else this._unsupported(rec, `CREATE kind ${f.kind}`);
      this.s.creates++;
    }

    _upload(rec, f) {
      const r = this._res(rec, f.id, 'upload target');
      if (r.kind === KIND.VBUF || r.kind === KIND.IBUF) {
        GS.bufferUpload(f, r.bytes.length, (m) => this._fail(rec, m));
        r.bytes.set(rec.arena(f.src, f.bytes), f.x);
        this.s.uploads++;
        this.s.uploadBytes += f.bytes;
        return;
      }
      const x = f.x | 0, y = f.y | 0, w = f.w | 0, h = f.h | 0, pitch = f.pitch;
      if (r.kind === KIND.CUBE ? f.face > 5 : f.face !== 0) this._fail(rec, `face ${f.face} of kind ${r.kind}`);
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
      } else if (r.kind === KIND.TEX2D || r.kind === KIND.CUBE) {
        const lv = (r.kind === KIND.CUBE ? r.faces[f.face] : r.levels)[f.level];
        if (!lv) this._fail(rec, `level ${f.level} of a ${r.levels.length}-level texture`);
        this._rect(rec, x, y, w, h, lv.width, lv.height);
        const row = w * 4;
        if (pitch < row || f.bytes < pitch * (h - 1) + row) this._fail(rec, `pitch ${pitch}/bytes ${f.bytes} too small for ${w}x${h}`);
        const src = rec.arena(f.src, f.bytes);
        for (let i = 0; i < h; i++)
          lv.pixels.set(src.subarray(i * pitch, i * pitch + row), ((y + i) * lv.width + x) * 4);
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
      } else if (r.kind === KIND.TEX2D || r.kind === KIND.CUBE) this._dropTextureKeys(r);
      this.res.delete(id);
      if (this.target.color === id) this.target.color = 0;
      if (this.target.depth === id) this.target.depth = 0;
      this.s.releases++;
    }

    _shader(rec, f) {
      if (!f.id) this._fail(rec, 'id 0 is reserved for none');
      if (this._isLive(f.id)) this._fail(rec, `id ${f.id} is already live`);
      if (f.stage !== CONST.STAGE_PS && f.stage !== CONST.STAGE_VS) this._fail(rec, `shader stage ${f.stage}`);
      const bytes = GS.shaderIR(rec).slice();
      if (bytes.length < 32 || (bytes.length & 3)) this._fail(rec, `IR of ${bytes.length} bytes`);
      const dv = new DataView(bytes.buffer);
      if (dv.getUint32(0, true) !== IR_MAGIC) this._fail(rec, `IR magic 0x${dv.getUint32(0, true).toString(16)}`);
      if (dv.getUint32(4, true) !== 1) this._unsupported(rec, `IR ABI ${dv.getUint32(4, true)}`);
      if (dv.getUint32(24, true) !== bytes.length) this._fail(rec, `IR says ${dv.getUint32(24, true)} bytes, record has ${bytes.length}`);
      const irStage = dv.getUint32(8, true), version = dv.getUint32(12, true), flags = dv.getUint32(28, true);
      if (f.stage === CONST.STAGE_VS) {
        // Core vertex IR (09af1): stage 0, vs_2_0 register model, flag 8.
        if (irStage !== 0 || version !== 0xfffe0200 || (flags & ~1) !== 8) this._unsupported(rec, `vertex IR stage ${irStage} version 0x${version.toString(16)} flags ${flags} (core vertex IR only)`);
      } else if (irStage !== 1) this._fail(rec, `pixel shader record carries IR stage ${irStage}`);
      else if (version === 0xffff0200) {
        // Sampler-naming core IR: texld names its sampler; this VM has six.
        for (let i = 0; i < dv.getUint32(16, true); i++) {
          const at = 32 + i * 128;
          if (dv.getUint32(at, true) === 66 && dv.getUint32(at + 48, true) === 10 && dv.getUint32(at + 52, true) >= MAX_SLOTS)
            this._unsupported(rec, `texld s${dv.getUint32(at + 52, true)} (caps: ${MAX_SLOTS} samplers)`);
        }
      }
      this.shaders.set(f.id, { irVersion: 1, nativeBytes: bytes, stage: f.stage });
      this.s.shaders++;
    }

    _layout(rec, f) {
      if (!f.id) this._fail(rec, 'id 0 is reserved for none');
      if (this._isLive(f.id)) this._fail(rec, `id ${f.id} is already live`);
      const L = GS.validateLayout(GS.decodeLayoutElems(rec), f.stride, (m) => this._fail(rec, m));
      if (L.programmable) {
        // Vertex shader inputs: every element repacks to one FLOAT4 lane.
        if (L.elems.length * 16 > 255) this._unsupported(rec, `${L.elems.length} elements (native vertices are at most 255 bytes)`);
        this.layouts.set(f.id, { stride: f.stride, pos: null, elems: L.elems, programmable: true });
        return;
      }
      for (const e of L.elems)
        if (e.usage === CONST.USAGE_TEXCOORD && e.index >= MAX_TEXCOORDS) this._unsupported(rec, `TEXCOORD${e.index} (native vertex lowering carries ${MAX_TEXCOORDS})`);
      // Internal vertex: one float4 slot per element, POSITIONT first,
      // COLOR0 always present (D3D's default diffuse is opaque white).
      const slots = [L.pos];
      if (!L.elems.some((e) => e.usage === CONST.USAGE_COLOR && e.index === 0))
        slots.push({ usage: CONST.USAGE_COLOR, index: 0, type: -1, offset: 0 });
      for (const e of L.elems) if (e !== L.pos) slots.push(e);
      const texUsed = new Set(L.elems.filter((e) => e.usage === CONST.USAGE_TEXCOORD).map((e) => e.index));
      let free = -1;
      for (let i = 0; i < MAX_TEXCOORDS; i++) if (!texUsed.has(i)) { free = i; break; }
      this.layouts.set(f.id, { stride: f.stride, slots, free, pos: L.pos });
    }

    _sampler(rec, f) {
      if (!f.id) this._fail(rec, 'id 0 is reserved for none');
      if (this._isLive(f.id)) this._fail(rec, `id ${f.id} is already live`);
      const addr = (a) => a >= CONST.ADDR_WRAP && a <= CONST.ADDR_MIRRORONCE;
      if (!addr(f.address_u) || !addr(f.address_v)) this._unsupported(rec, `address ${f.address_u}/${f.address_v}`);
      if (f.address_w !== 0 && !addr(f.address_w)) this._unsupported(rec, `address_w ${f.address_w}`);
      if (![1, 2].includes(f.min) || ![1, 2].includes(f.mag) || ![0, 1, 2].includes(f.mip))
        this._unsupported(rec, `filter min ${f.min} mag ${f.mag} mip ${f.mip}`);
      if (f.max_aniso > CAPS.maxAniso) this._unsupported(rec, `max_aniso ${f.max_aniso} (caps ${CAPS.maxAniso})`);
      if (!Number.isFinite(f.lod_bias)) this._fail(rec, `lod_bias ${f.lod_bias}`);
      const b = f.border >>> 0;
      this.samplers.set(f.id, {
        addressU: f.address_u, addressV: f.address_v, min: f.min, mag: f.mag, mip: f.mip, lodBias: f.lod_bias,
        maxMipLevel: f.max_level,
        // R|G<<8|B<<16|A<<24 -> D3DCOLOR ARGB.
        borderColor: (((b >>> 24) << 24) | ((b & 255) << 16) | (((b >>> 8) & 255) << 8) | ((b >>> 16) & 255)) >>> 0,
      });
    }

    _viewport(rec, f) {
      const color = this._res(rec, this.target.color, 'color target', KIND.RT);
      const x = f.x | 0, y = f.y | 0, w = f.w | 0, h = f.h | 0;
      this._rect(rec, x, y, w, h, color.width, color.height);
      if (!(Number.isFinite(f.zmin) && Number.isFinite(f.zmax) && f.zmin >= 0 && f.zmin <= f.zmax && f.zmax <= 1))
        this._fail(rec, `z range ${f.zmin}..${f.zmax}`);
      this.viewport = { x, y, w, h, zmin: f.zmin, zmax: f.zmax };
    }

    _raster(rec, f) {
      const r = GS.validateRaster(f, (m) => this._fail(rec, m), (m) => this._unsupported(rec, m));
      if (r.fog_mode && r.fog_flags)
        this._unsupported(rec, `fog_flags ${r.fog_flags} (no-multiply/no-add fog is not in the native W/fog fragment)`);
      if (r.fill !== 3) this._unsupported(rec, `fill ${r.fill}`);
      if (r.fog_mode === CONST.FOG_TABLE_W) this._fogTable(rec, r.fog_table);
      this.raster = r;
    }

    _fogTable(rec, id) {
      const t = this._res(rec, id, 'fog table', KIND.TEX2D);
      if (t.width !== 64 || t.height !== 1) this._fail(rec, `fog table ${id} is ${t.width}x${t.height}, not 64x1`);
      const px = t.levels[0].pixels, table = new Uint8Array(64);
      for (let i = 0; i < 64; i++) table[i] = px[i * 4];
      return table;
    }

    _bind(rec) {
      const bound = [];
      for (const e of GS.decodeBind(rec)) {
        if (e.slot >= MAX_SLOTS) this._unsupported(rec, `sampler slot ${e.slot}`);
        if (bound[e.slot]) this._fail(rec, `slot ${e.slot} bound twice`);
        if (!e.texture) continue;
        const t = this._res(rec, e.texture, `slot ${e.slot} texture`);
        if (t.kind !== KIND.TEX2D && t.kind !== KIND.CUBE && t.kind !== KIND.RT) this._fail(rec, `slot ${e.slot} texture ${e.texture} is kind ${t.kind}`);
        const s = this.samplers.get(e.sampler);
        if (!s) this._fail(rec, `slot ${e.slot} sampler ${e.sampler} is not live`);
        bound[e.slot] = { texture: e.texture, sampler: e.sampler };
      }
      this.bound = bound;
    }

    _consts(rec, f) {
      if (f.stage !== CONST.STAGE_PS && f.stage !== CONST.STAGE_VS) this._fail(rec, `constants for stage ${f.stage}`);
      const vs = f.stage === CONST.STAGE_VS, max = vs ? 256 : 8;
      if (f.first + f.count > max) this._unsupported(rec, `constants ${f.first}+${f.count} beyond c${max - 1}`);
      const v = GS.decodeConsts(rec);
      for (let i = 0; i < v.length; i++) if (!Number.isFinite(v[i])) this._fail(rec, `non-finite constant c${f.first + (i >> 2)}`);
      if (vs) { this.vconsts.set(v, f.first * 4); this.vconstCount = Math.max(this.vconstCount, f.first + f.count); return; }
      this.consts.set(v, f.first * 4);
      this.constCount = Math.max(this.constCount, f.first + f.count);
    }

    // Sticky user clip planes; the native rasterizer clips VS draws in D3D
    // clip space (d3d_software_create_deferred_clipped). vs 0 ignores them.
    _clip(rec, f) {
      if (!Number.isInteger(f.mask) || f.mask < 0 || f.mask > 63) this._fail(rec, `clip mask ${f.mask}`);
      const planes = Float32Array.from(f.planes);
      for (let i = 0; i < 24; i++) if (!Number.isFinite(planes[i])) this._fail(rec, `non-finite clip plane ${i >> 2}`);
      this.clip = { mask: f.mask, planes };
    }

    _texture(rec, slot) {
      const b = this.bound[slot];
      if (!b) return null;
      const t = this._res(rec, b.texture, `slot ${slot} texture`);
      const sampler = this.samplers.get(b.sampler);
      if (!sampler) this._fail(rec, `slot ${slot} sampler ${b.sampler} was released`);
      if (t.kind === KIND.RT) {
        if (b.texture === this.target.color) this._fail(rec, `slot ${slot} samples RT ${b.texture}, which is the bound color target`);
        if (sampler.mip && sampler.maxMipLevel) this._unsupported(rec, 'max_level on a one-level RT');
        return { width: t.width, height: t.height, sampler,
          levels: [{ width: t.width, height: t.height, resource: this._colorRes(t) }] };
      }
      const chain = (list, face) => list.map((lv, i) => {
        const key = `gps/${t.id}/${t.gen}/${face}/${i}`;
        t.keys.add(key);
        return { key, width: lv.width, height: lv.height, pixels: lv.pixels };
      });
      if (t.kind === KIND.CUBE) {
        // Cube faces are sampled clamped to the face edge whatever the
        // sampler's address modes say (the contract; the native VM needs it).
        return { width: t.width, height: t.height, sampler: Object.assign({}, sampler, { addressU: 3, addressV: 3 }),
          faces: t.faces.map((list, face) => ({ levels: chain(list, face) })) };
      }
      return { width: t.width, height: t.height, levels: chain(t.levels, 0), sampler };
    }

    // The native W depth/fog fragment: W-buffer depth and table/alpha/Z fog
    // from interpolated rhw (q). qTexcoord names where q lives in the native
    // output vertex: -1 = position w (perspective varyings), n = texture n.
    // depth_mode 3 (D3D W-buffer) is depth 1 / (q * w_far).
    _wFragment(rec, r, qTexcoord) {
      if (r.depth_mode !== CONST.DEPTH_W && r.depth_mode !== CONST.DEPTH_WBUFFER && r.fog_mode === CONST.FOG_NONE) return undefined;
      const table = r.fog_mode === CONST.FOG_TABLE_W ? this._fogTable(rec, r.fog_table) : new Uint8Array(64);
      const c = r.fog_color >>> 0;
      return {
        depthMode: r.depth_mode, fogMode: r.fog_mode, bias: r.depth_bias | 0, table, qTexcoord, wFar: r.w_far,
        color: (0xff000000 | ((c & 255) << 16) | (((c >>> 8) & 255) << 8) | ((c >>> 16) & 255)) >>> 0,
      };
    }

    _draw(rec, f) {
      const r = this.raster;
      if (!r) this._fail(rec, 'no RASTER before the draw');
      if (rec.op === OP.DRAW_UP && (f.vbuf !== 0 || f.ibuf !== 0)) this._fail(rec, `DRAW_UP names vbuf ${f.vbuf} / ibuf ${f.ibuf}`);
      const L = this.layouts.get(f.layout);
      if (!L) this._fail(rec, `layout ${f.layout} is not live`);
      if (f.stride !== L.stride) this._fail(rec, `stride ${f.stride} differs from layout ${f.layout}'s ${L.stride}`);
      GS.checkDrawLayout(f, L, (m) => this._fail(rec, m));
      const ps = this.shaders.get(f.ps);
      if (!ps || ps.stage !== CONST.STAGE_PS) this._fail(rec, `pixel shader ${f.ps} is not live`);
      const bytes = GS.drawBytes(rec, f, (id, kind) => this._res(rec, id, kind === KIND.VBUF ? 'vbuf' : 'ibuf', kind).bytes, (m) => this._fail(rec, m));
      const color = this._res(rec, this.target.color, 'color target', KIND.RT);
      const depth = this.target.depth ? this._res(rec, this.target.depth, 'depth target', KIND.DS) : null;
      if (r.depth_mode && !depth) this._fail(rec, 'depth test without a depth target');
      if (r.stencil_enable && (!depth || depth.fmt !== FMT.D24S8)) this._fail(rec, 'stencil without a D24S8 depth target');
      if (f.vs !== 0) return this._drawVS(rec, f, r, L, ps, bytes, color, depth);
      const prim = GS.assemble(rec, f, (m) => this._fail(rec, m), (m) => this._unsupported(rec, m), bytes.indices);
      const wNeeded = r.depth_mode === CONST.DEPTH_W || r.fog_mode !== CONST.FOG_NONE;
      const qLane = r.linear && wNeeded ? L.free : -1;
      if (r.linear && wNeeded && qLane < 0) this._unsupported(rec, `linear W depth/fog needs a free TEXCOORD0..${MAX_TEXCOORDS - 1}`);
      const { vtx, F } = this._vertices(rec, f, L, prim.vcount, r.linear, qLane, bytes.vertices);
      let tris;
      if (prim.kind === 3) {
        tris = new Float32Array(prim.idx.length * F);
        for (let i = 0; i < prim.idx.length; i++) tris.set(vtx.subarray(prim.idx[i] * F, prim.idx[i] * F + F), i * F);
        this.s.triangles += prim.idx.length / 3;
      } else tris = this._expand(prim, vtx, F);
      this.s.draws++;
      if (!tris.length) return;
      if (r.depth_mode === CONST.DEPTH_Z && (r.z_bias || r.slope_bias)) this._zBias(tris, F, r.z_bias, r.slope_bias);
      const ns = this._nativeState(rec, r);
      if (!ns) return;
      const { textures, scissor, state } = ns;
      const glide = this._wFragment(rec, r, r.linear ? qLane : -1);
      const attributes = L.slots.map((e, i) => ({
        register: e.usage === CONST.USAGE_POSITIONT ? REG_POS : e.usage === CONST.USAGE_COLOR ? REG_COLOR + e.index : REG_TEX + e.index,
        usage: e.usage, usageIndex: e.index, type: 3, offset: i * 16,
      }));
      if (qLane >= 0) attributes.push({ register: REG_TEX + qLane, usage: CONST.USAGE_TEXCOORD, usageIndex: qLane, type: 3, offset: L.slots.length * 16 });
      const pixelConstants = this.consts.slice(0, Math.max(1, this.constCount) * 4);
      const fixedFunction = Object.assign({}, FIXED, { world: identity(), view: identity(), projection: identity() });
      const stride = F * 4;
      const start = this.nowMs();
      const total = tris.length / F / 3;
      for (let first = 0; first < total; first += MAX_TRIANGLES) {
        const count = Math.min(MAX_TRIANGLES, total - first);
        const part = tris.subarray(first * 3 * F, (first + count) * 3 * F);
        this.native.draw({
          primitive: 4, primitiveCount: count, stride,
          vertices: new Uint8Array(part.buffer, part.byteOffset, part.byteLength),
          colorAttachment: this._colorRes(color),
          depthAttachment: depth ? this._depthRes(depth) : null,
          glide,
          attributes,
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

    // Native state, scissor and textures of a draw; null = the viewport
    // and scissor leave nothing to draw.
    _nativeState(rec, r) {
      const textures = [];
      for (let i = 0; i < MAX_SLOTS; i++) textures.push(this._texture(rec, i));
      while (textures.length > 2 && !textures[textures.length - 1]) textures.pop();
      let left = r.scissor_left | 0, top = r.scissor_top | 0, right = r.scissor_right | 0, bottom = r.scissor_bottom | 0;
      const vp = this.viewport;
      if (vp) {
        left = Math.max(left, vp.x); top = Math.max(top, vp.y);
        right = Math.min(right, vp.x + vp.w); bottom = Math.min(bottom, vp.y + vp.h);
        if (right <= left || bottom <= top) return null;
      }
      const scissor = { enabled: true, left, top, right, bottom };
      const state = {
        zenable: r.depth_mode !== 0, zwrite: !!r.zwrite, zfunc: r.zfunc, cull: r.cull,
        blend: !!r.blend, separateAlpha: true,
        srcblend: r.src_rgb, dstblend: r.dst_rgb, srcblendalpha: r.src_alpha, dstblendalpha: r.dst_alpha,
        blendop: r.blend ? r.blend_op : 1, blendopalpha: r.blend ? r.blend_op_alpha : 1,
        colorWriteMask: r.colormask, logicOp: r.logic_op,
        alphaTest: r.alpha_func !== 8, alphaFunc: r.alpha_func, alphaRef: r.alpha_ref,
      };
      if (r.stencil_enable) Object.assign(state, {
        stencilEnable: true, twoSidedStencil: !!r.two_sided,
        stencilRef: r.stencil_ref, stencilMask: r.stencil_mask, stencilWriteMask: r.stencil_wmask,
        stencilFunc: r.stencil_func, stencilFail: r.stencil_fail, stencilZFail: r.stencil_zfail, stencilPass: r.stencil_pass,
        ccwStencilFunc: r.two_sided ? r.ccw_func : 8, ccwStencilFail: r.two_sided ? r.ccw_fail : 1,
        ccwStencilZFail: r.two_sided ? r.ccw_zfail : 1, ccwStencilPass: r.two_sided ? r.ccw_pass : 1,
      });
      return { textures, scissor, state };
    }

    // A programmed draw: the core vertex IR runs in the native VM. Each
    // layout element repacks to one FLOAT4 lane matched to the shader's DCL
    // by (usage, index); the native device splits and indexes the batch.
    _drawVS(rec, f, r, L, ps, bytes, color, depth) {
      const vs = this.shaders.get(f.vs);
      if (!vs || vs.stage !== CONST.STAGE_VS) this._fail(rec, `vertex shader ${f.vs} is not live`);
      if (r.depth_mode === CONST.DEPTH_W) this._unsupported(rec, 'W depth with a vertex shader (no rhw lane)');
      // W-buffer: the native position w lane holds the interpolated 1/w;
      // fog stays the shader's (fogMode 0 keeps the bound vertex fog).
      const glide = r.depth_mode === CONST.DEPTH_WBUFFER
        ? Object.assign(this._wFragment(rec, Object.assign({}, r, { fog_mode: CONST.FOG_NONE }), -1), { fogMode: 0 }) : undefined;
      if (r.fog_mode === CONST.FOG_TABLE_W || r.fog_mode === CONST.FOG_Z) this._unsupported(rec, `fog_mode ${r.fog_mode} with a vertex shader`);
      if (r.linear) this._unsupported(rec, 'linear varyings with a vertex shader');
      if (r.z_bias || r.slope_bias) this._unsupported(rec, 'z_bias/slope_bias with a vertex shader');
      const prim = GS.assemble(rec, f, (m) => this._fail(rec, m), (m) => this._unsupported(rec, m), bytes.indices);
      if (prim.vcount > 65536) this._unsupported(rec, `${prim.vcount} vertices (native indices are 16-bit)`);
      this.s.draws++;
      const per = prim.kind === 3 ? 3 : prim.kind === 2 ? 2 : 1;
      if (prim.kind === 3) this.s.triangles += prim.idx.length / 3;
      else if (prim.kind === 2) this.s.lines += prim.idx.length / 2;
      else this.s.points += prim.idx.length;
      if (!prim.idx.length) return;
      const ns = this._nativeState(rec, r);
      if (!ns) return;
      const E = L.elems.length, F = E * 4;
      const dv = new DataView(bytes.vertices.buffer, bytes.vertices.byteOffset, bytes.vertices.byteLength);
      const vtx = new Float32Array(prim.vcount * F);
      for (let v = 0; v < prim.vcount; v++) for (let e = 0; e < E; e++) GS.readElement(dv, v * f.stride, L.elems[e], vtx, v * F + e * 4);
      const attributes = L.elems.map((e, i) => ({ register: i, usage: e.usage, usageIndex: e.index, type: 3, offset: i * 16 }));
      const vp = this.viewport;
      const viewport = vp ? { x: vp.x, y: vp.y, width: vp.w, height: vp.h, minZ: vp.zmin, maxZ: vp.zmax }
        : { x: 0, y: 0, width: color.width, height: color.height, minZ: 0, maxZ: 1 };
      const fc = r.fog_color >>> 0;
      const fogState = r.fog_mode === CONST.FOG_VERTEX_ALPHA
        ? { enabled: true, color: (0xff000000 | ((fc & 255) << 16) | (((fc >>> 8) & 255) << 8) | ((fc >>> 16) & 255)) >>> 0, tableMode: 0 }
        : undefined;
      const start = this.nowMs();
      // Native batches: at most 256 primitives and 256 distinct vertices,
      // in order; each batch gets its own compact vertex copy.
      const total = prim.idx.length / per;
      for (let first = 0; first < total;) {
        const map = new Map(), list = [];
        let n = 0;
        while (first + n < total && n < 84) {
          const at = (first + n) * per;
          let fresh = 0;
          for (let k = 0; k < per; k++) if (!map.has(prim.idx[at + k])) fresh++;
          if (map.size + fresh > 256) break;
          for (let k = 0; k < per; k++) {
            const v = prim.idx[at + k];
            if (!map.has(v)) map.set(v, map.size);
            list.push(map.get(v));
          }
          n++;
        }
        const part = new Float32Array(map.size * F);
        for (const [v, i] of map) part.set(vtx.subarray(v * F, v * F + F), i * F);
        // Point and line batches need the native minimum vertex count.
        const verts = new Uint8Array(part.buffer);
        const need = per === 3 ? 3 : per;
        const padded = map.size >= need ? verts : (() => { const p = new Uint8Array(need * F * 4); p.set(verts); return p; })();
        this.native.draw({
          primitive: per === 3 ? 4 : per === 2 ? 2 : 1, primitiveCount: n, stride: F * 4,
          vertices: padded, indices: Uint16Array.from(list),
          colorAttachment: this._colorRes(color),
          depthAttachment: depth ? this._depthRes(depth) : null,
          attributes, viewport, fogState, glide,
          vertexShader: { irVersion: 1, nativeBytes: vs.nativeBytes },
          userClipPlanes: this.clip.mask ? { space: 'clip', mask: this.clip.mask, planes: this.clip.planes } : undefined,
          vertexConstants: this.vconsts.slice(0, Math.max(1, this.vconstCount) * 4),
          pixelShader: ps,
          pixelConstants: this.consts.slice(0, Math.max(1, this.constCount) * 4),
          state: ns.state, scissor: ns.scissor, textures: ns.textures,
        });
        this.s.nativeDraws++;
        first += n;
      }
      this.s.drawCpuMs += this.nowMs() - start;
    }

    // Decode vcount vertices into float4 slots (+ the q lane). Screen-linear
    // varyings get rhw 1 so the native perspective step is the identity.
    _vertices(rec, f, L, vcount, linear, qLane, src) {
      const nslots = L.slots.length + (qLane >= 0 ? 1 : 0), F = nslots * 4;
      const dv = new DataView(src.buffer, src.byteOffset, src.byteLength);
      const vtx = new Float32Array(vcount * F);
      for (let v = 0; v < vcount; v++) {
        const base = v * f.stride, o = v * F;
        for (let s = 0; s < L.slots.length; s++) GS.readElement(dv, base, L.slots[s], vtx, o + s * 4);
        const rhw = vtx[o + 3];
        if (linear) vtx[o + 3] = 1;
        if (qLane >= 0) { const q = o + L.slots.length * 4; vtx[q] = rhw; vtx[q + 1] = 0; vtx[q + 2] = 0; vtx[q + 3] = 1; }
      }
      return { vtx, F };
    }

    // D3D DEPTHBIAS + SLOPESCALEDEPTHBIAS, applied per triangle in z.
    _zBias(tris, F, bias, slope) {
      for (let t = 0; t < tris.length; t += 3 * F) {
        const ax = tris[t], ay = tris[t + 1], az = tris[t + 2];
        const bx = tris[t + F], by = tris[t + F + 1], bz = tris[t + F + 2];
        const cx = tris[t + 2 * F], cy = tris[t + 2 * F + 1], cz = tris[t + 2 * F + 2];
        let off = bias;
        if (slope) {
          const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
          const den = ux * vy - uy * vx;
          if (den) off += slope * Math.max(Math.abs((uz * vy - uy * vz) / den), Math.abs((ux * vz - uz * vx) / den));
        }
        for (let k = 0; k < 3; k++) {
          const i = t + k * F + 2;
          tris[i] = Math.min(1, Math.max(0, tris[i] + off));
        }
      }
    }

    // Points and lines as the old backend drew them: a one-pixel square per
    // point, a one-pixel-wide quad per line (zero-length lines draw nothing).
    _expand(prim, vtx, F) {
      const per = prim.kind;
      const out = [];
      for (let i = 0; i < prim.idx.length; i += per) {
        const ia = prim.idx[i], a = vtx.subarray(ia * F, ia * F + F);
        const b = per === 2 ? vtx.subarray(prim.idx[i + 1] * F, prim.idx[i + 1] * F + F) : a;
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
      const tris = new Float32Array(out.length * F);
      out.forEach((q, i) => tris.set(q, i * F));
      return tris;
    }

    _clear(rec, f) {
      if (f.mask & ~7) this._unsupported(rec, `clear mask ${f.mask}`);
      const color = this._res(rec, this.target.color, 'color target', KIND.RT);
      const depth = this.target.depth ? this._res(rec, this.target.depth, 'depth target', KIND.DS) : null;
      if ((f.mask & 2) && !depth) this._fail(rec, 'depth clear without a depth target');
      if ((f.mask & 4) && (!depth || depth.fmt !== FMT.D24S8)) this._fail(rec, 'stencil clear without a D24S8 depth target');
      if (f.colormask > 15) this._fail(rec, `colormask ${f.colormask}`);
      if (!Number.isFinite(f.z) || f.z < 0 || f.z > 1) this._fail(rec, `z ${f.z}`);
      if (f.stencil >>> 0 > 255) this._fail(rec, `stencil ${f.stencil >>> 0}`);
      this.s.clears++;
      if (!f.mask) return;
      const c = f.rgba >>> 0;
      const rgba = [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24].map((v) => v / 255);
      const rect = [f.left | 0, f.top | 0, f.right | 0, f.bottom | 0];
      this.native.clear(rgba, f.mask, f.z, [rect], depth ? this._depthRes(depth) : null, f.stencil >>> 0,
        this._colorRes(color), f.colormask);
    }

    // COPY (CAP_COPY): an RT rectangle into an RT (stretched, the native
    // d3d_software_copy_color arithmetic: center-sampled, clamped to the
    // source rect) or into a TEX2D/CUBE level (same size, point). filter
    // packs filter | dst level << 8 | dst face << 16 | opaque << 24.
    _copy(rec, f) {
      const src = this._res(rec, f.src, 'copy src', KIND.RT);
      const dst = this._res(rec, f.dst, 'copy dst');
      if (f.src === f.dst) this._fail(rec, 'copy onto itself');
      const filter = f.filter & 255, level = (f.filter >>> 8) & 255, face = (f.filter >>> 16) & 255;
      const opaque = (f.filter >>> 24) & 1;
      if (filter > 2 || (f.filter >>> 25)) this._fail(rec, `copy filter word 0x${(f.filter >>> 0).toString(16)}`);
      const sx = f.sx | 0, sy = f.sy | 0, sw = f.sw | 0, sh = f.sh | 0, dx = f.dx | 0, dy = f.dy | 0, dw = f.dw | 0, dh = f.dh | 0;
      this._rect(rec, sx, sy, sw, sh, src.width, src.height);
      const exp = this.options.getExports();
      if (dst.kind === KIND.RT) {
        if (level || face) this._fail(rec, `copy into RT level ${level} face ${face}`);
        this._rect(rec, dx, dy, dw, dh, dst.width, dst.height);
        const copy = exp.d3d_software_copy_color;
        if (typeof copy !== 'function') this._unsupported(rec, 'native color copy unavailable');
        const n = this.native;
        n.idle();
        const s = n.colorSurface(this._colorRes(src)), d = n.colorSurface(this._colorRes(dst));
        const packet = n.alloc(112);
        try {
          const v = new DataView(n.memory(), packet.wa, 112), put = (o, x) => v.setUint32(o, x >>> 0, true);
          for (let i = 0; i < 112; i += 4) put(i, 0);
          put(8, NATIVE_COLOR); put(12, s.wa); put(16, s.pitch);
          put(40, opaque ? 22 : NATIVE_COLOR); put(44, d.wa); put(48, d.pitch);
          [sx, sy, sw, sh, dx, dy, dw, dh].forEach((x, i) => put(64 + i * 4, x));
          put(96, filter);
          copy(packet.wa);
        } finally { n.free(packet); }
      } else if (dst.kind === KIND.TEX2D || dst.kind === KIND.CUBE) {
        if (dst.kind === KIND.CUBE ? face > 5 : face !== 0) this._fail(rec, `face ${face} of kind ${dst.kind}`);
        const lv = (dst.kind === KIND.CUBE ? dst.faces[face] : dst.levels)[level];
        if (!lv) this._fail(rec, `level ${level} of a ${dst.levels.length}-level texture`);
        if (dw !== sw || dh !== sh || filter === 2) this._unsupported(rec, 'a texture COPY is same-size and point');
        this._rect(rec, dx, dy, dw, dh, lv.width, lv.height);
        const img = this.native.readColor(this._colorRes(src)), px = img.pixels, sp = img.pitch;
        for (let row = 0; row < sh; row++) {
          let s = (sy + row) * sp + sx * 4, d = ((dy + row) * lv.width + dx) * 4;
          for (let i = 0; i < sw; i++, s += 4, d += 4) {
            lv.pixels[d] = px[s + 2]; lv.pixels[d + 1] = px[s + 1]; lv.pixels[d + 2] = px[s];
            lv.pixels[d + 3] = opaque ? 255 : px[s + 3];
          }
        }
        this._dropTextureKeys(dst);
        dst.gen++;
      } else this._fail(rec, `copy dst ${f.dst} is kind ${dst.kind}`);
      this.s.copies = (this.s.copies || 0) + 1;
    }

    _fence(rec, f) {
      this.s.fences++;
      if (f.kind === CONST.FENCEK_FENCE) return;
      if (f.kind === CONST.FENCEK_OCCLUSION_BEGIN) {
        if (this.occlusion) this._fail(rec, 'occlusion BEGIN while one is open');
        this.native.queryBegin(1);
        this.occlusion = true;
      } else if (f.kind === CONST.FENCEK_OCCLUSION_END) {
        if (!this.occlusion) this._fail(rec, 'occlusion END without a BEGIN');
        const q = this.native.queryEnd(1);
        this.native.queryRelease(1);
        this.occlusion = false;
        new DataView(rec.arena(f.dst, 4).buffer).setUint32(rec.arena(f.dst, 4).byteOffset,
          q.samplesHigh ? 0xffffffff : q.samplesLow >>> 0, true);
      } else this._unsupported(rec, `fence kind ${f.kind}`);
    }

    _readback(rec, f) {
      const r = this._res(rec, f.rt, 'readback rt', KIND.RT);
      if (f.fmt !== FMT.A8B8G8R8) this._unsupported(rec, `readback fmt ${f.fmt} (only A8B8G8R8)`);
      const x = f.x | 0, y = f.y | 0, w = f.w | 0, h = f.h | 0;
      this._rect(rec, x, y, w, h, r.width, r.height);
      if (f.pitch < w * 4) this._fail(rec, `pitch ${f.pitch} < ${w * 4}`);
      const start = this.nowMs();
      const img = this.native.readColor(this._colorRes(r));
      const src = img.pixels, sp = img.pitch;
      const dst = rec.arena(f.dst, f.pitch * h);
      for (let row = 0; row < h; row++) {
        let s = (y + row) * sp + x * 4, d = row * f.pitch;
        for (let i = 0; i < w; i++, s += 4, d += 4) {
          dst[d] = src[s + 2]; dst[d + 1] = src[s + 1]; dst[d + 2] = src[s]; dst[d + 3] = src[s + 3];
        }
      }
      this.s.readbacks++;
      this.s.readbackBytes += w * h * 4;
      this.s.readbackCpuMs += this.nowMs() - start;
    }

    _present(rec, f) {
      const r = this._res(rec, f.rt, 'present rt', KIND.RT);
      const x = f.x | 0, y = f.y | 0, w = f.w | 0, h = f.h | 0;
      this._rect(rec, x, y, w, h, r.width, r.height);
      let lut = null;
      if (f.gamma) {
        const g = this._res(rec, f.gamma, 'gamma table', KIND.TEX2D);
        if (g.width !== 256 || g.height !== 1) this._fail(rec, `gamma ${f.gamma} is not 256x1`);
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
          // A presented frame is opaque; RT alpha never becomes page transparency.
          pixels[d + 3] = 255;
        }
      }
      this.s.presents++;
      this.s.presentCpuMs += this.nowMs() - start;
      const frame = { pixels, width: w, height: h, hwnd: f.surface >>> 0, dstX: f.dst_x | 0, dstY: f.dst_y | 0,
        stamp: f.stamp >>> 0, rt: f.rt >>> 0, presentSeq: rec.seq >>> 0, stats: this.stats() };
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
      this.bound = [];
      this.raster = null;
    }
  }

  return { Executor, CAPS };
});
