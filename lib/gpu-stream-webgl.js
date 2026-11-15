// GPU stream v2 WebGL executor (docs/gpu-stream-v2.md).
//
// Executes the byte records the WAT frontends write on a WebGL context
// through lib/gpu-backend.js. It derives no API state: every value it uses is
// in a record. The pixel shader is the frontend's native shader IR, compiled
// by lib/d3d9-shader.js compileNativeIR(); this file only wraps it with the
// raster stages the RASTER record names (alpha test, fog, W-buffer depth) and
// pairs it with a vertex shader generated from the LAYOUT.
//
// Conventions (docs/gpu-stream-v2.md "Core executor contract"):
//   - RT color lives in a texture + FBO in GL-natural bottom-up orientation;
//     UPLOAD/READBACK rows are top-down and are flipped here.
//   - TEX2D level 0 is the largest level; rows are uploaded as given (row 0 at
//     t = 0). Each texture gets a complete chain down to 1x1 (levels past the
//     record's count are zero) and mip sampling clamps the LOD in the shader
//     to the last real level.
//   - Vertices are pretransformed POSITIONT (x, y, z, rhw) in RT pixels with
//     pixel centres at integer coordinates (D3D); GL's centres are at +0.5,
//     so the vertex shader adds half a pixel. RASTER.linear 1 interpolates
//     every varying screen-linearly (rhw feeds only W depth/fog); 0 is
//     perspective-correct (clip w = 1/rhw).
//
// Fail fast: anything unexpected throws a GpsError; nothing is skipped.
//
// Node: require('./gpu-stream-webgl'); browser/workers: globalThis.GpuStreamWebGL
// (load gpu-stream.generated.js, gpu-stream.js, gpu-backend.js,
// d3d-shader-ir.js and d3d9-shader.js first).
(function (root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const GS = node ? require('./gpu-stream') : root.GpuStream;
  const GB = node ? require('./gpu-backend') : root.GpuBackend;
  const SH = node ? require('./d3d9-shader') : root.D3D9Shader;
  if (!GS || !GB || !SH) throw new Error('gpu-stream-webgl.js: load gpu-stream.js, gpu-backend.js and d3d9-shader.js first');
  const api = factory(GS, GB, SH);
  if (node) module.exports = api;
  if (root) root.GpuStreamWebGL = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (GS, GB, SH) {
  'use strict';

  const { OP, KIND, FMT, ERR, CONST } = GS;
  const MAX_CONSTS = 8;
  const MAX_SLOTS = 8;
  const MAX_TEXCOORDS = 8;

  // D3DCMP 1..8 -> GLSL test of a (fragment alpha) against b (reference).
  const ALPHA_TEST = [null, 'false', 'a<b', 'a==b', 'a<=b', 'a>b', 'a!=b', 'a>=b', 'true'];

  // The contract's W-buffer encoding of interpolated rhw q: 16-bit floating
  // W (4-bit exponent, 12-bit mantissa), as the Voodoo stores it.
  const W_DEPTH = 'float gps_wdepth(float q){if(q>=1.0)return 0.0;if(q<=1.0/65536.0)return 65535.0;' +
    'float e=max(0.0,ceil(-log2(q))-1.0);return clamp(e*4096.0+8192.0-floor(q*exp2(e+13.0)),0.0,65535.0);}';

  const PRESENT_VS = 'attribute vec2 p;uniform vec4 area;varying vec2 uv;void main(){gl_Position=vec4(p,0.,1.);uv=(p*.5+.5)*area.xy+area.zw;}';
  // LUT index (floor(c*255+0.5)+0.5)/256.
  const PRESENT_FS = 'precision highp float;varying vec2 uv;uniform sampler2D image;uniform sampler2D gammaRamp;uniform float useGammaRamp;' +
    'void main(){vec3 c=texture2D(image,uv).rgb;if(useGammaRamp>0.5){vec3 t=(floor(c*255.0+0.5)+0.5)/256.0;' +
    'c=vec3(texture2D(gammaRamp,vec2(t.r,0.5)).r,texture2D(gammaRamp,vec2(t.g,0.5)).g,texture2D(gammaRamp,vec2(t.b,0.5)).b);}' +
    'gl_FragColor=vec4(c,1.0);}';

  function isGLSLES(gl) {
    if (gl.__wineIsES === undefined) {
      let v = '';
      try { v = String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || ''); } catch (_) { /* treat as desktop */ }
      gl.__wineIsES = /ES|WebGL/.test(v);
    }
    return gl.__wineIsES;
  }

  function fullChain(w, h) {
    let n = 1;
    while ((w >> n) > 0 || (h >> n) > 0) n++;
    return n;
  }

  class Executor {
    constructor(options = {}) {
      const { canvas, backend, onPresent, createBackend } = options;
      let b = backend;
      if (!b) {
        if (typeof createBackend === 'function') b = createBackend(canvas);
        else {
          if (!canvas) throw new Error('gpu-stream-webgl: a canvas or backend is required');
          b = new GB.WebGLBackend(canvas, { apiVersion: 'auto' }); // throws when WebGL is unavailable
        }
      }
      if (!b || !b.gl) throw new Error('gpu-stream-webgl: backend has no WebGL context');
      this.backend = b;
      this.gl = b.gl;
      this.ownsBackend = !backend;
      this.canvas = b.canvas || canvas;
      this.onPresent = onPresent || null;
      this.isES = isGLSLES(this.gl);
      const gl = this.gl;
      const units = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) | 0;
      // The fog table takes the unit after the last sampler slot.
      this.maxSamplers = Math.max(2, Math.min(MAX_SLOTS, units - 1));
      this.fogUnit = this.maxSamplers;
      this._caps = Object.freeze({
        flags: CONST.CAP_STENCIL,
        maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) | 0,
        maxSamplers: this.maxSamplers,
        maxAniso: 1,
        formats: (1 << FMT.A8B8G8R8) | (1 << FMT.D16) | (1 << FMT.D24S8),
      });
      this.res = new Map();       // id -> resource record
      this.filled = new Set();
      this.target = null;         // { rt, ds }
      this.viewport = null;       // {x, y, w, h} or null = the whole target
      this.raster = null;
      this.binds = [];
      this.consts = new Float32Array(MAX_CONSTS * 4);
      this.boundFbo = undefined;
      this.blendKey = '';
      this.sized = false;
      this.vbo = null;
      this.ibo = null;
      this.present = null;        // { program, buffer }
      this.closed = false;
      this._stats = {
        records: 0, counts: {}, draws: 0, vertices: 0, triangles: 0, presents: 0, readbacks: 0, readbackBytes: 0,
        uploads: 0, uploadBytes: 0, clears: 0, programs: 0,
      };
    }

    caps() { return this._caps; }

    _fail(rec, msg, code) {
      throw new GS.GpsError(`webgl executor: ${rec.name} seq ${rec.seq}: ${msg}`, code || ERR.EXECUTOR, rec.seq);
    }
    _unsupported(rec, msg) { this._fail(rec, msg, ERR.UNSUPPORTED); }

    _get(rec, id, what, kinds) {
      const r = this.res.get(id);
      if (!r) this._fail(rec, `${what} ${id} was never created or was released`);
      if (kinds && !kinds.includes(r.kind)) this._fail(rec, `${what} ${id} is kind ${r.kind}, expected ${kinds.join('/')}`);
      return r;
    }

    _define(rec, id, kind) {
      if (id === 0) this._fail(rec, 'id 0 is reserved for none');
      const prev = this.res.get(id);
      const fills = rec.op !== OP.CREATE && prev && prev.kind === kind && !this.filled.has(id) && !prev.gl;
      if (prev && !fills) this._fail(rec, `id ${id} is already live (kind ${prev.kind})`);
      if (rec.op !== OP.CREATE) this.filled.add(id);
    }

    _bindFbo(fbo) {
      if (this.boundFbo === fbo) return;
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);
      this.boundFbo = fbo;
    }

    // getError is sticky: drain (and warn about) earlier errors so only an
    // error the next call raises is blamed on it.
    _staleErrors(rec) {
      const gl = this.gl, stale = [];
      for (let e = gl.getError(); e !== gl.NO_ERROR && stale.length < 8; e = gl.getError()) stale.push(e);
      if (stale.length) console.warn(`[gpu-stream-webgl] earlier GL error(s) 0x${stale.map(x => x.toString(16)).join(',0x')} before ${rec.name} seq ${rec.seq}`);
      return stale;
    }

    execute(rec) {
      if (this.closed) this._fail(rec, 'executor is closed');
      switch (rec.op) {
        case OP.CREATE: this._create(rec); break;
        case OP.UPLOAD: this._upload(rec); break;
        case OP.RELEASE: this._release(rec); break;
        case OP.SHADER: this._shader(rec); break;
        case OP.LAYOUT: this._layout(rec); break;
        case OP.SAMPLER: this._sampler(rec); break;
        case OP.TARGETS: this._targets(rec); break;
        case OP.VIEWPORT: this._viewport(rec); break;
        case OP.RASTER: this._raster(rec); break;
        case OP.BIND: this._bind(rec); break;
        case OP.CONSTS: this._consts(rec); break;
        case OP.DRAW_UP: this._draw(rec); break;
        case OP.CLEAR: this._clear(rec); break;
        case OP.FENCE:
          if (rec.fields.kind !== CONST.FENCEK_FENCE) this._unsupported(rec, `fence kind ${rec.fields.kind} (no GPS_CAP_OCCLUSION)`);
          this.gl.flush();
          break;
        case OP.READBACK: this._readback(rec); break;
        case OP.PRESENT: this._present(rec); break;
        case OP.MARK: break;
        case OP.DRAW: case OP.COPY:
          this._unsupported(rec, 'not produced by any frontend this executor serves yet');
          break;
        default: throw new GS.GpsError(`webgl executor: unknown op ${rec.op} (seq ${rec.seq})`, ERR.UNKNOWN_OP, rec.seq);
      }
      const s = this._stats;
      s.counts[rec.name] = (s.counts[rec.name] || 0) + 1;
      s.records++;
    }

    // ── resources ────────────────────────────────────────────────────────

    _create(rec) {
      const f = rec.fields, gl = this.gl, b = this.backend;
      this._define(rec, f.id, f.kind);
      const w = f.width, h = f.height;
      const limit = this._caps.maxTexture;
      if (!(w >= 1 && h >= 1 && w <= limit && h <= limit)) this._fail(rec, `bad dimensions ${w}x${h}`);
      if (f.kind === KIND.RT) {
        if (f.fmt !== FMT.A8B8G8R8 || f.levels !== 1) this._unsupported(rec, `RT fmt ${f.fmt} levels ${f.levels}`);
        // The first RT sizes the canvas; later ones (offscreen targets) leave it.
        if (this.canvas && !this.sized && (this.canvas.width !== w || this.canvas.height !== h)) {
          this.canvas.width = w;
          this.canvas.height = h;
        }
        this.sized = true;
        const tex = b.createTexture();
        b.uploadTexture2D(tex, { width: w, height: h, internalFormat: gl.RGBA, format: gl.RGBA,
          type: gl.UNSIGNED_BYTE, pixels: new Uint8Array(w * h * 4) });
        for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) b.setTextureParameter(tex, p, gl.NEAREST);
        for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) b.setTextureParameter(tex, p, gl.CLAMP_TO_EDGE);
        const fbo = gl.createFramebuffer();
        if (!fbo) this._fail(rec, 'framebuffer allocation failed');
        this._bindFbo(fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) this._fail(rec, 'RT framebuffer incomplete');
        this.res.set(f.id, { kind: KIND.RT, gl: true, tex, fbo, w, h, levels: 1, depth: null });
      } else if (f.kind === KIND.DS) {
        const stencil = f.fmt === FMT.D24S8;
        if ((f.fmt !== FMT.D16 && !stencil) || f.levels !== 1) this._unsupported(rec, `DS fmt ${f.fmt} levels ${f.levels} (want D16 or D24S8, 1)`);
        const rb = gl.createRenderbuffer();
        if (!rb) this._fail(rec, 'renderbuffer allocation failed');
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
        const stale = this._staleErrors(rec);
        const internal = !stencil ? gl.DEPTH_COMPONENT16 : this.backend.version === 2 ? gl.DEPTH24_STENCIL8 : gl.DEPTH_STENCIL;
        gl.renderbufferStorage(gl.RENDERBUFFER, internal, w, h);
        const error = gl.getError();
        if (error !== gl.NO_ERROR) this._fail(rec, `${stencil ? 'D24S8' : 'D16'} renderbuffer ${w}x${h} allocation failed (GL error 0x${error.toString(16)}`
          + (stale.length ? `, earlier unreported 0x${stale.map(x => x.toString(16)).join(',0x')})` : ')'));
        this.res.set(f.id, { kind: KIND.DS, gl: true, rb, w, h, stencil, bits: stencil ? 24 : 16, fresh: true });
      } else if (f.kind === KIND.TEX2D) {
        if (f.fmt !== FMT.A8B8G8R8) this._unsupported(rec, `TEX2D fmt ${f.fmt} (only A8B8G8R8; producers convert at UPLOAD)`);
        const chain = fullChain(w, h);
        if (!(f.levels >= 1 && f.levels <= chain)) this._fail(rec, `${f.levels} levels for ${w}x${h}`);
        const tex = b.createTexture();
        for (let i = 0; i < chain; i++) {
          const lw = Math.max(1, w >> i), lh = Math.max(1, h >> i);
          b.uploadTexture2D(tex, { level: i, width: lw, height: lh, internalFormat: gl.RGBA, format: gl.RGBA,
            type: gl.UNSIGNED_BYTE, pixels: new Uint8Array(lw * lh * 4) });
        }
        if (b.version === 2) b.setTextureParameter(tex, gl.TEXTURE_MAX_LEVEL, f.levels - 1);
        this.res.set(f.id, { kind: KIND.TEX2D, gl: true, tex, w, h, levels: f.levels, fmt: f.fmt });
      } else if (f.kind === KIND.SHADER || f.kind === KIND.LAYOUT || f.kind === KIND.SAMPLER) {
        this.res.set(f.id, { kind: f.kind, gl: false });  // filled by its SHADER/LAYOUT/SAMPLER record
      } else this._unsupported(rec, `CREATE kind ${f.kind}`);
    }

    _upload(rec) {
      const f = rec.fields, gl = this.gl, b = this.backend;
      const r = this._get(rec, f.id, 'upload target', [KIND.TEX2D, KIND.RT]);
      if (f.face !== 0) this._fail(rec, `face ${f.face}`);
      const levels = r.kind === KIND.RT ? 1 : r.levels;
      if (f.level >= levels) this._fail(rec, `level ${f.level} of ${levels}`);
      const lw = Math.max(1, r.w >> f.level), lh = Math.max(1, r.h >> f.level);
      const { x, y, w, h, pitch } = f;
      if (!(w >= 1 && h >= 1) || x + w > lw || y + h > lh) this._fail(rec, `rect ${x},${y} ${w}x${h} outside ${lw}x${lh}`);
      if (pitch < w * 4 || f.bytes < pitch * (h - 1) + w * 4) this._fail(rec, `pitch ${pitch} / bytes ${f.bytes} too small for ${w}x${h}`);
      const src = rec.arena(f.src, f.bytes);
      const out = new Uint8Array(w * h * 4);
      const flip = r.kind === KIND.RT;
      for (let row = 0; row < h; row++) {
        const s = row * pitch, d = (flip ? h - 1 - row : row) * w * 4;
        out.set(src.subarray(s, s + w * 4), d);
      }
      b.updateTexture2D(r.tex, { level: f.level, x, y: flip ? r.h - y - h : y, width: w, height: h,
        format: gl.RGBA, type: gl.UNSIGNED_BYTE, pixels: out });
      this._stats.uploads++;
      this._stats.uploadBytes += f.bytes;
    }

    _detachDepth(rt) {
      const gl = this.gl;
      this._bindFbo(rt.fbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, rt.depth && rt.depth.stencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT,
        gl.RENDERBUFFER, null);
      rt.depth = null;
    }

    _release(rec) {
      const id = rec.fields.id, gl = this.gl, b = this.backend;
      const r = this._get(rec, id, 'release of id');
      if (r.kind === KIND.RT) {
        if (this.target && this.target.rt === r) this.target = null;
        if (this.boundFbo === r.fbo) this._bindFbo(null);
        gl.deleteFramebuffer(r.fbo);
        b.deleteTexture(r.tex);
      } else if (r.kind === KIND.DS) {
        if (this.target && this.target.ds === r) this.target = null;
        for (const o of this.res.values()) if (o.kind === KIND.RT && o.depth === r) this._detachDepth(o);
        gl.deleteRenderbuffer(r.rb);
      } else if (r.kind === KIND.TEX2D) {
        b.deleteTexture(r.tex);
      } else if (r.kind === KIND.SHADER && r.variants) {
        for (const p of r.variants.values()) this._deleteProgram(p.program);
      }
      this.res.delete(id);
      this.filled.delete(id);
    }

    _deleteProgram(program) {
      this.gl.deleteProgram(program.handle);
      if (this.backend._programs) this.backend._programs.delete(program.handle);
      if (this.backend._currentProgram === program.handle) this.backend.useProgram(null);
    }

    _shader(rec) {
      const f = rec.fields;
      this._define(rec, f.id, KIND.SHADER);
      if (f.stage !== CONST.STAGE_PS) this._unsupported(rec, `stage ${f.stage} (only pixel shaders; vertices are pretransformed)`);
      const ir = GS.shaderIR(rec).slice();
      let compiled;
      try { compiled = SH.compileNativeIR({ irVersion: 1, nativeBytes: ir }); } catch (e) { this._fail(rec, `shader IR: ${e.message}`); }
      const src = compiled.source;
      if (src.split('gl_FragColor = r0;').length !== 2) this._fail(rec, 'compiled shader has no single gl_FragColor = r0 epilogue');
      if (src.split('void main() {').length !== 2) this._fail(rec, 'compiled shader has no single main()');
      const samplers = [];
      for (const m of src.matchAll(/uniform (sampler\w+) d3d_s(\d+);/g)) {
        if (m[1] !== 'sampler2D') this._unsupported(rec, `${m[1]} d3d_s${m[2]}`);
        samplers.push(+m[2]);
      }
      if (samplers.some((n) => n >= this.maxSamplers)) this._unsupported(rec, `sampler slots ${samplers} (caps ${this.maxSamplers})`);
      // The varyings the pixel shader reads; the vertex shader writes these.
      const varyings = [];
      for (const m of src.matchAll(/varying vec4 d3d_(color|tex)(\d+);/g)) varyings.push({ color: m[1] === 'color', n: +m[2] });
      this.res.set(f.id, { kind: KIND.SHADER, gl: false, compiled, samplers, varyings, variants: new Map() });
    }

    _layout(rec) {
      const f = rec.fields;
      this._define(rec, f.id, KIND.LAYOUT);
      const L = GS.validateLayout(GS.decodeLayoutElems(rec), f.stride, (m) => this._fail(rec, m));
      for (const e of L.elems)
        if (e.usage === CONST.USAGE_TEXCOORD && e.index >= MAX_TEXCOORDS) this._unsupported(rec, `TEXCOORD${e.index}`);
      const name = (e) => (e.usage === CONST.USAGE_POSITIONT ? 'gps_pos' : e.usage === CONST.USAGE_COLOR ? `gps_c${e.index}` : `gps_t${e.index}`);
      const attrs = L.elems.map((e) => ({
        name: name(e), usage: e.usage, index: e.index, offset: e.offset,
        size: e.type === CONST.VTYPE_D3DCOLOR ? 4 : e.type + 1,
        color: e.type === CONST.VTYPE_D3DCOLOR,
      }));
      const sig = attrs.map((a) => `${a.name}${a.color ? 'b' : a.size}`).sort().join(',');
      this.res.set(f.id, { kind: KIND.LAYOUT, gl: false, stride: f.stride, attrs, sig });
    }

    _sampler(rec) {
      const f = rec.fields;
      this._define(rec, f.id, KIND.SAMPLER);
      for (const [k, a] of [['u', f.address_u], ['v', f.address_v], ['w', f.address_w]]) {
        if (k === 'w' && a === 0) continue;
        if (!(a >= CONST.ADDR_WRAP && a <= CONST.ADDR_MIRRORONCE)) this._fail(rec, `address_${k} ${a}`);
        if (a === CONST.ADDR_MIRRORONCE) this._unsupported(rec, `address_${k} MIRRORONCE (no GPS_CAP_MIRRORONCE)`);
      }
      if (![1, 2].includes(f.min) || ![1, 2].includes(f.mag) || f.mip > 2) this._unsupported(rec, `filter ${f.min}/${f.mag}/${f.mip}`);
      const border = f.address_u === CONST.ADDR_BORDER || f.address_v === CONST.ADDR_BORDER;
      // Border is applied in the shader on the point-sampled texel only.
      if (border && (f.min !== 1 || f.mag !== 1 || f.mip === 2))
        this._unsupported(rec, 'BORDER addressing with linear filtering (no GPS_CAP_BORDER_LINEAR)');
      if (f.max_aniso > this._caps.maxAniso) this._unsupported(rec, `max_aniso ${f.max_aniso} (caps ${this._caps.maxAniso})`);
      if (!Number.isFinite(f.lod_bias)) this._fail(rec, `lod_bias ${f.lod_bias}`);
      const c = f.border >>> 0;
      this.res.set(f.id, { kind: KIND.SAMPLER, gl: false, u: f.address_u, v: f.address_v, min: f.min, mag: f.mag,
        mip: f.mip, bias: f.lod_bias, maxLevel: f.max_level,
        border: [(c & 255) / 255, ((c >>> 8) & 255) / 255, ((c >>> 16) & 255) / 255, (c >>> 24) / 255] });
    }

    // ── state ────────────────────────────────────────────────────────────

    _targets(rec) {
      const f = rec.fields, gl = this.gl;
      if (f.color === 0) this._unsupported(rec, 'implicit backbuffer target');
      const rt = this._get(rec, f.color, 'color target', [KIND.RT]);
      const ds = f.depth ? this._get(rec, f.depth, 'depth target', [KIND.DS]) : null;
      if (ds && (ds.w !== rt.w || ds.h !== rt.h)) this._fail(rec, `depth ${ds.w}x${ds.h} differs from color ${rt.w}x${rt.h}`);
      this._bindFbo(rt.fbo);
      if (rt.depth !== ds) {
        if (rt.depth) this._detachDepth(rt);
        if (ds) gl.framebufferRenderbuffer(gl.FRAMEBUFFER, ds.stencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, ds.rb);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) this._fail(rec, 'color/depth framebuffer incomplete');
        rt.depth = ds;
      }
      if (ds && ds.fresh) {
        // CREATE starts resources zeroed: depth 0, stencil 0.
        const b = this.backend;
        b.setCapability(gl.SCISSOR_TEST, false);
        b.setDepthMask(true);
        if (ds.stencil) b.setStencilMask(255);
        b.clear(null, gl.DEPTH_BUFFER_BIT | (ds.stencil ? gl.STENCIL_BUFFER_BIT : 0), 0, ds.stencil ? 0 : undefined);
        ds.fresh = false;
      }
      this.target = { rt, ds };
      this.viewport = null;
    }

    _viewport(rec) {
      const f = rec.fields;
      if (!this.target) this._fail(rec, 'VIEWPORT without TARGETS');
      const { rt } = this.target;
      const x = f.x | 0, y = f.y | 0, w = f.w | 0, h = f.h | 0;
      if (!(x >= 0 && y >= 0 && w >= 1 && h >= 1 && x + w <= rt.w && y + h <= rt.h)) this._fail(rec, `rect ${x},${y} ${w}x${h} outside ${rt.w}x${rt.h}`);
      if (!(Number.isFinite(f.zmin) && Number.isFinite(f.zmax) && f.zmin >= 0 && f.zmin <= f.zmax && f.zmax <= 1))
        this._fail(rec, `z range ${f.zmin}..${f.zmax}`);
      this.viewport = { x, y, w, h };
    }

    _raster(rec) {
      const f = GS.validateRaster(rec.fields, (m) => this._fail(rec, m));
      const bad = (m) => this._unsupported(rec, m);
      if (f.logic_op) bad(`logic_op ${f.logic_op} (no GPS_CAP_LOGIC_OP)`);
      if (f.blend && (f.dst_rgb === 11 || f.dst_alpha === 11)) bad('SRC_ALPHA_SATURATE as a destination factor');
      if (f.blend && [f.blend_op, f.blend_op_alpha].some((o) => o >= 4) && this.backend.version !== 2 && !this.gl.getExtension('EXT_blend_minmax'))
        bad('MIN/MAX blend ops need WebGL2 or EXT_blend_minmax');
      if (f.fill !== 3) bad(`fill ${f.fill}`);
      if (f.fog_mode === CONST.FOG_TABLE_W) {
        const t = this._get(rec, f.fog_table, 'fog table', [KIND.TEX2D]);
        if (t.w !== 64 || t.h !== 1) this._fail(rec, `fog table ${f.fog_table} is ${t.w}x${t.h}, not 64x1`);
      }
      this.raster = f;
    }

    _bind(rec) {
      const binds = [];
      for (const e of GS.decodeBind(rec)) {
        if (e.slot >= this.maxSamplers) this._unsupported(rec, `slot ${e.slot} (caps ${this.maxSamplers})`);
        if (binds[e.slot]) this._fail(rec, `slot ${e.slot} bound twice`);
        if (!e.texture) continue;
        const texture = this._get(rec, e.texture, `slot ${e.slot} texture`, [KIND.TEX2D, KIND.RT]);
        const sampler = this._get(rec, e.sampler, `slot ${e.slot} sampler`, [KIND.SAMPLER]);
        if (!this.filled.has(e.sampler)) this._fail(rec, `sampler ${e.sampler} was never defined`);
        binds[e.slot] = { texture, sampler, id: e.texture };
      }
      this.binds = binds;
    }

    _consts(rec) {
      const f = rec.fields;
      if (f.stage !== CONST.STAGE_PS) this._unsupported(rec, `stage ${f.stage}`);
      if (f.first + f.count > MAX_CONSTS) this._unsupported(rec, `constants ${f.first}+${f.count} > ${MAX_CONSTS}`);
      this.consts.set(GS.decodeConsts(rec), f.first * 4);
    }

    // ── programs ─────────────────────────────────────────────────────────

    _program(rec, shader, layout, raster) {
      const gl = this.gl, b = this.backend;
      const w = raster.depth_mode === CONST.DEPTH_W;
      const linear = !!raster.linear;
      const slot = (n) => (shader.samplers.includes(n) ? this.binds[n] : null);
      const mips = [], borders = [], flips = [];
      for (let n = 0; n < this.maxSamplers; n++) {
        const s = slot(n);
        mips[n] = !!(s && s.sampler.mip > 0);
        borders[n] = s ? (s.sampler.u === CONST.ADDR_BORDER ? 1 : 0) | (s.sampler.v === CONST.ADDR_BORDER ? 2 : 0) : 0;
        // RT texels are stored bottom-up; t = 0 is still the top row.
        flips[n] = !!(s && s.texture.kind === KIND.RT);
      }
      const key = `${layout.sig}|${linear ? 1 : 0}|${w ? 1 : 0}|${raster.fog_mode}|${raster.fog_flags}|${raster.alpha_func}|` +
        `${mips.map(Number).join('')}|${borders.join('')}|${flips.map(Number).join('')}`;
      let v = shader.variants.get(key);
      if (v) return v;
      const desktop = !this.isES && b.version !== 2;
      if (w && b.version !== 2 && !gl.getExtension('EXT_frag_depth')) this._unsupported(rec, 'W buffering requires EXT_frag_depth');
      const mipmapped = mips.some(Boolean);
      if (mipmapped && b.version !== 2 && this.isES &&
          (!gl.getExtension('OES_standard_derivatives') || !gl.getExtension('EXT_shader_texture_lod')))
        this._unsupported(rec, 'mip sampling requires derivatives and explicit texture LOD');

      // Vertex shader from the layout.
      const has = new Map(layout.attrs.map((a) => [a.name, a]));
      const input = (name, dflt) => {
        const a = has.get(name);
        return !a ? dflt : a.color ? `${name}.zyxw` : name;
      };
      const vs = [];
      for (const a of layout.attrs) vs.push(`attribute vec4 ${a.name};`);
      vs.push('uniform vec4 gps_target;varying vec4 gps_aux;');
      for (const x of shader.varyings) vs.push(`varying vec4 d3d_${x.color ? 'color' : 'tex'}${x.n};`);
      vs.push('void main(){vec4 p=gps_pos;',
        linear ? 'float W=1.0;' : 'float W=1.0/p.w;',
        // Integer pixel centres (contract) -> GL's half-integer ones. GL's
        // tie-break is top-left in its y-up window, which is bottom-left in
        // the RT's y-down rows; perspective (D3D) draws lift y by 1/128 px so
        // an edge exactly on a centre follows D3D's top-left rule. Linear
        // (Glide) draws keep the unshifted position.
        `vec2 ndc=vec2((p.x+0.5)*2.0/gps_target.x-1.0,1.0-(p.y+${linear ? '0.5' : '0.4921875'})*2.0/gps_target.y);`,
        `gl_Position=vec4(ndc*W,${w ? '0.0' : '(p.z*2.0-1.0)*W'},W);gl_PointSize=1.0;`);
      for (const x of shader.varyings) {
        const src = x.color ? input(`gps_c${x.n}`, x.n === 0 ? 'vec4(1.0)' : 'vec4(0.0)') : input(`gps_t${x.n}`, 'vec4(0.0,0.0,0.0,1.0)');
        vs.push(`d3d_${x.color ? 'color' : 'tex'}${x.n}=${src};`);
      }
      vs.push(`gps_aux=vec4(${input('gps_c0', 'vec4(1.0)')}.a,p.z,p.w,0.0);}`);

      let src = shader.compiled.source.replace('gl_FragColor = r0;', 'gps_out(r0);');
      for (const n of shader.samplers) src = src.split(`texture2D(d3d_s${n},`).join(`gps_tex${n}(`);
      if (/texture2D\(d3d_s/.test(src) || /textureCube/.test(src)) this._unsupported(rec, 'shader samples outside texld');
      const ext = [];
      if (w && !desktop) ext.push('#extension GL_EXT_frag_depth : require');
      if (mipmapped) ext.push('#extension GL_OES_standard_derivatives : require', '#extension GL_EXT_shader_texture_lod : require');
      const helpers = ['uniform float gps_alpha_ref;uniform float gps_depth_bias;uniform vec4 gps_fog_color;uniform sampler2D gps_fog_table;',
        'varying vec4 gps_aux;', W_DEPTH,
        `float gps_q(){return ${linear ? 'gps_aux.z' : 'gl_FragCoord.w'};}`];
      for (const n of shader.samplers) {
        const bm = borders[n];
        const out = bm ? `uniform vec4 gps_border${n};` : '';
        const test = [bm & 1 ? 'uv.x<0.0||uv.x>=1.0' : '', bm & 2 ? 'uv.y<0.0||uv.y>=1.0' : ''].filter(Boolean).join('||');
        const guard = (bm ? `if(${test})return gps_border${n};` : '') + (flips[n] ? 'uv.y=1.0-uv.y;' : '');
        if (mips[n]) {
          // Isotropic LOD from level-0 texels, biased, floored at max_level
          // and clamped to the last real level.
          helpers.push(`uniform vec4 gps_size${n};uniform float gps_bias${n};${out}`,
            `vec4 gps_tex${n}(vec2 uv){${guard}vec2 dx=dFdx(uv)*gps_size${n}.xy;vec2 dy=dFdy(uv)*gps_size${n}.xy;` +
            `float lod=0.5*log2(max(max(dot(dx,dx),dot(dy,dy)),1.0e-16))+gps_bias${n};` +
            `return texture2DLodEXT(d3d_s${n},uv,min(max(lod,gps_size${n}.w),gps_size${n}.z));}`);
        } else helpers.push(`${out}vec4 gps_tex${n}(vec2 uv){${guard}return texture2D(d3d_s${n},uv);}`);
      }
      const out = ['void gps_out(vec4 c){c=clamp(c,0.0,1.0);'];
      if (raster.alpha_func !== 8) out.push(`float a=c.a;float b=gps_alpha_ref;if(!(${ALPHA_TEST[raster.alpha_func]}))discard;`);
      if (raster.fog_mode) {
        const fog = raster.fog_mode === CONST.FOG_VERTEX_ALPHA ? 'clamp(gps_aux.x,0.0,1.0)'
          : raster.fog_mode === CONST.FOG_Z ? 'clamp(gps_aux.y,0.0,1.0)'
            : 'texture2D(gps_fog_table,vec2((clamp((gps_wdepth(gps_q())+gps_depth_bias)/1024.0,0.0,63.0)+0.5)/64.0,0.5)).r';
        out.push(`float fog=${fog};c.rgb=${raster.fog_flags & CONST.FOGF_NO_MULT ? 'vec3(0.0)' : 'c.rgb*(1.0-fog)'}+` +
          `${raster.fog_flags & CONST.FOGF_NO_ADD ? 'vec3(0.0)' : 'gps_fog_color.rgb*fog'};`);
      }
      if (w) out.push(`${desktop ? 'gl_FragDepth' : 'gl_FragDepthEXT'}=clamp((gps_wdepth(gps_q())+gps_depth_bias)/65535.0,0.0,1.0);`);
      out.push('gl_FragColor=c;}');
      src = src.replace('void main() {', `${helpers.join('\n')}\n${out.join('')}\nvoid main() {`);
      const fs = ext.length ? `${ext.join('\n')}\n${src}` : src;
      const uniforms = ['gps_target', 'gps_alpha_ref', 'gps_depth_bias', 'gps_fog_color', 'gps_fog_table'];
      for (let n = 0; n < this.maxSamplers; n++) uniforms.push(`gps_size${n}`, `gps_bias${n}`, `gps_border${n}`, `d3d_s${n}`);
      for (let i = 0; i < MAX_CONSTS; i++) uniforms.push(`d3d_ps_c${i}`);
      let program;
      try {
        program = b.createProgram(vs.join(''), fs, layout.attrs.map((a) => a.name), uniforms);
      } catch (e) {
        this._fail(rec, `program link failed: ${e.message}\n--- vertex ---\n${vs.join('')}\n--- fragment ---\n${fs}`);
      }
      v = { program, key };
      shader.variants.set(key, v);
      this._stats.programs++;
      return v;
    }

    _setBlend(enabled, f) {
      const gl = this.gl, b = this.backend;
      b.setCapability(gl.BLEND, enabled);
      if (!enabled) return;
      const map = [null, gl.ZERO, gl.ONE, gl.SRC_COLOR, gl.ONE_MINUS_SRC_COLOR, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA,
        gl.DST_ALPHA, gl.ONE_MINUS_DST_ALPHA, gl.DST_COLOR, gl.ONE_MINUS_DST_COLOR, gl.SRC_ALPHA_SATURATE];
      const minmax = b.version === 2 ? gl : gl.getExtension('EXT_blend_minmax');
      const op = (o) => (o === 1 ? gl.FUNC_ADD : o === 2 ? gl.FUNC_SUBTRACT : o === 3 ? gl.FUNC_REVERSE_SUBTRACT
        : o === 4 ? (minmax.MIN || minmax.MIN_EXT) : (minmax.MAX || minmax.MAX_EXT));
      const key = `${f.src_rgb},${f.dst_rgb},${f.src_alpha},${f.dst_alpha},${f.blend_op},${f.blend_op_alpha}`;
      if (key === this.blendKey) return;
      gl.blendFuncSeparate(map[f.src_rgb], map[f.dst_rgb], map[f.src_alpha], map[f.dst_alpha]);
      gl.blendEquationSeparate(op(f.blend_op), op(f.blend_op_alpha));
      this.blendKey = key;
    }

    _setStencil(r, ds) {
      const gl = this.gl, b = this.backend;
      b.setCapability(gl.STENCIL_TEST, !!r.stencil_enable);
      if (!r.stencil_enable) return;
      if (!ds || !ds.stencil) return;
      const OPS = [null, gl.KEEP, gl.ZERO, gl.REPLACE, gl.INCR, gl.DECR, gl.INVERT, gl.INCR_WRAP, gl.DECR_WRAP];
      const fn = (c) => gl.NEVER + c - 1;
      b.setStencilMask(r.stencil_wmask);
      // Visual winding survives the y flip, so with frontFace(CCW) GL BACK is
      // a clockwise triangle on screen: the main set. FRONT (counter-clockwise)
      // takes the ccw set when two-sided.
      const main = [fn(r.stencil_func), r.stencil_ref, r.stencil_mask];
      const mops = [OPS[r.stencil_fail], OPS[r.stencil_zfail], OPS[r.stencil_pass]];
      const cfun = r.two_sided ? [fn(r.ccw_func), r.stencil_ref, r.stencil_mask] : main;
      const cops = r.two_sided ? [OPS[r.ccw_fail], OPS[r.ccw_zfail], OPS[r.ccw_pass]] : mops;
      b.setFrontFace(gl.CCW);
      b.setStencilFunc(gl.BACK, ...main);
      b.setStencilOp(gl.BACK, ...mops);
      b.setStencilFunc(gl.FRONT, ...cfun);
      b.setStencilOp(gl.FRONT, ...cops);
    }

    _scissor(left, top, right, bottom, height) {
      const gl = this.gl, b = this.backend;
      b.setCapability(gl.SCISSOR_TEST, true);
      b.setScissor(left, height - bottom, right - left, bottom - top);
    }

    _draw(rec) {
      const f = rec.fields, gl = this.gl, b = this.backend;
      if (f.vs !== 0) this._unsupported(rec, `vertex shader ${f.vs} (only pretransformed vertices)`);
      if (f.vbuf !== 0 || f.ibuf !== 0) this._fail(rec, 'DRAW_UP names a vertex or index buffer');
      const shader = this._get(rec, f.ps, 'ps', [KIND.SHADER]);
      if (!shader.compiled) this._fail(rec, `ps ${f.ps} was never defined`);
      const layout = this._get(rec, f.layout, 'layout', [KIND.LAYOUT]);
      if (!layout.attrs) this._fail(rec, `layout ${f.layout} was never defined`);
      if (f.stride !== layout.stride) this._fail(rec, `stride ${f.stride} differs from layout ${f.layout}'s ${layout.stride}`);
      if (!this.target) this._fail(rec, 'draw without TARGETS');
      const r = this.raster;
      if (!r) this._fail(rec, 'draw without RASTER');
      const { rt, ds } = this.target;
      if (r.depth_mode && !ds) this._fail(rec, 'depth test without a depth target');
      if (r.stencil_enable && (!ds || !ds.stencil)) this._fail(rec, 'stencil without a D24S8 depth target');
      for (const n of shader.samplers) {
        const bnd = this.binds[n];
        if (!bnd) this._fail(rec, `shader samples slot ${n}, which BIND left empty`);
        if (bnd.texture === rt) this._fail(rec, `slot ${n} samples RT ${bnd.id}, which is the bound color target`);
        if (!this.res.has(bnd.id) || this.res.get(bnd.id) !== bnd.texture) this._fail(rec, `slot ${n} texture ${bnd.id} was released`);
      }
      const prim = GS.assemble(rec, f, (m) => this._fail(rec, m));
      const { program } = this._program(rec, shader, layout, r);

      let left = r.scissor_left, top = r.scissor_top, right = Math.min(r.scissor_right, rt.w), bottom = Math.min(r.scissor_bottom, rt.h);
      if (this.viewport) {
        const vp = this.viewport;
        left = Math.max(left, vp.x); top = Math.max(top, vp.y);
        right = Math.min(right, vp.x + vp.w); bottom = Math.min(bottom, vp.y + vp.h);
      }
      this._stats.draws++;
      if (right <= left || bottom <= top) return;

      this._bindFbo(rt.fbo);
      b.setViewport(0, 0, rt.w, rt.h);
      this._scissor(left, top, right, bottom, rt.h);
      b.setCapability(gl.DEPTH_TEST, r.depth_mode !== CONST.DEPTH_OFF);
      b.setDepthFunc(gl.NEVER + r.zfunc - 1);
      b.setDepthMask(!!r.zwrite);
      const offset = r.depth_mode === CONST.DEPTH_Z && (r.z_bias || r.slope_bias);
      b.setCapability(gl.POLYGON_OFFSET_FILL, !!offset);
      if (offset) b.setPolygonOffset(r.slope_bias, r.z_bias * Math.pow(2, ds.bits));
      b.setColorMask(!!(r.colormask & 1), !!(r.colormask & 2), !!(r.colormask & 4), !!(r.colormask & 8));
      this._setBlend(!!r.blend, r);
      this._setStencil(r, ds);
      b.setCapability(gl.CULL_FACE, r.cull !== 1);
      if (r.cull !== 1) {
        // RASTER.cull is D3DCULL in render-target pixel space: 2 drops
        // triangles clockwise on screen, 3 counter-clockwise. The y flip into
        // NDC keeps the on-screen winding, so with frontFace(CCW) a clockwise
        // triangle is a back face.
        b.setFrontFace(gl.CCW);
        b.setCullFace(r.cull === 2 ? gl.BACK : gl.FRONT);
      }

      // Parameters first: the backend sets them through unit 0.
      for (const n of shader.samplers) {
        const { texture: t, sampler: s } = this.binds[n];
        const wrap = (a) => (a === CONST.ADDR_WRAP ? gl.REPEAT : a === CONST.ADDR_MIRROR ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE);
        b.setTextureParameter(t.tex, gl.TEXTURE_WRAP_S, wrap(s.u));
        b.setTextureParameter(t.tex, gl.TEXTURE_WRAP_T, wrap(s.v));
        // An RT has one level: its minification filter never names a mip.
        const mip = t.kind === KIND.RT ? 0 : s.mip;
        b.setTextureParameter(t.tex, gl.TEXTURE_MIN_FILTER, mip
          ? (s.min === 2 ? (mip === 2 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR_MIPMAP_NEAREST)
            : (mip === 2 ? gl.NEAREST_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_NEAREST))
          : (s.min === 2 ? gl.LINEAR : gl.NEAREST));
        b.setTextureParameter(t.tex, gl.TEXTURE_MAG_FILTER, s.mag === 2 ? gl.LINEAR : gl.NEAREST);
        b.setUniform(program, `gps_size${n}`, '4f', [t.w, t.h, t.levels - 1, s.maxLevel]);
        b.setUniform(program, `gps_bias${n}`, '1f', s.bias);
        b.setUniform(program, `gps_border${n}`, '4f', s.border);
        b.setUniform(program, `d3d_s${n}`, '1i', n);
      }
      let fogTex = null;
      if (r.fog_mode === CONST.FOG_TABLE_W) {
        fogTex = this._get(rec, r.fog_table, 'fog table', [KIND.TEX2D]).tex;
        for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) b.setTextureParameter(fogTex, p, gl.LINEAR);
        for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) b.setTextureParameter(fogTex, p, gl.CLAMP_TO_EDGE);
      }
      for (const n of shader.samplers) b.bindTexture(this.binds[n].texture.tex, n);
      if (fogTex) { b.bindTexture(fogTex, this.fogUnit); b.setUniform(program, 'gps_fog_table', '1i', this.fogUnit); }

      b.setUniform(program, 'gps_target', '4f', [rt.w, rt.h, 0, 0]);
      b.setUniform(program, 'gps_alpha_ref', '1f', r.alpha_ref / 255);
      b.setUniform(program, 'gps_depth_bias', '1f', r.depth_bias);
      const fc = r.fog_color >>> 0;
      b.setUniform(program, 'gps_fog_color', '4f', [(fc & 255) / 255, ((fc >>> 8) & 255) / 255, ((fc >>> 16) & 255) / 255, (fc >>> 24) / 255]);
      for (let i = 0; i < MAX_CONSTS; i++) b.setUniform(program, `d3d_ps_c${i}`, '4f', this.consts.subarray(i * 4, i * 4 + 4));

      if (!this.vbo) this.vbo = b.createBuffer();
      b.updateBuffer(this.vbo, gl.ARRAY_BUFFER, rec.arena(f.voff, prim.vcount * f.stride), gl.STREAM_DRAW);
      const mode = prim.kind === 3 ? gl.TRIANGLES : prim.kind === 2 ? gl.LINES : gl.POINTS;
      const attributes = layout.attrs.map((a) => (a.color
        ? { name: a.name, size: 4, offset: a.offset, type: gl.UNSIGNED_BYTE, normalized: true }
        : { name: a.name, size: a.size, offset: a.offset }));
      const cmd = { program, vertexBuffer: this.vbo, stride: f.stride, attributes, mode, count: prim.idx.length };
      // Non-indexed lists draw the vertices as given; everything else (indexed
      // draws, strips) draws the assembled index list.
      const direct = f.index_size === 0 && f.prim !== CONST.PRIM_LINESTRIP && f.prim !== CONST.PRIM_TRIANGLESTRIP;
      if (!direct) {
        let idx = prim.idx, type = gl.UNSIGNED_INT;
        if (prim.vcount <= 65536) { idx = Uint16Array.from(prim.idx); type = gl.UNSIGNED_SHORT; }
        else if (b.version !== 2 && !gl.getExtension('OES_element_index_uint')) this._unsupported(rec, `${prim.vcount} vertices need 32-bit indices`);
        if (!this.ibo) this.ibo = b.createBuffer();
        b.updateBuffer(this.ibo, gl.ELEMENT_ARRAY_BUFFER, idx, gl.STREAM_DRAW);
        cmd.indexBuffer = this.ibo;
        cmd.indexType = type;
      }
      if (cmd.count) b.draw(cmd);
      this._stats.vertices += prim.idx.length;
      if (prim.kind === 3) this._stats.triangles += prim.idx.length / 3;
    }

    _clear(rec) {
      const f = rec.fields, gl = this.gl, b = this.backend;
      if (f.mask & ~(CONST.CLEAR_COLOR | CONST.CLEAR_DEPTH | CONST.CLEAR_STENCIL)) this._fail(rec, `mask ${f.mask}`);
      if (!this.target) this._fail(rec, 'clear without TARGETS');
      const { rt, ds } = this.target;
      const left = f.left | 0, top = f.top | 0, right = f.right | 0, bottom = f.bottom | 0;
      if (right < left || bottom < top) this._fail(rec, 'inverted clear rect');
      let bits = 0;
      if (f.mask & CONST.CLEAR_COLOR) {
        bits |= gl.COLOR_BUFFER_BIT;
        b.setColorMask(!!(f.colormask & 1), !!(f.colormask & 2), !!(f.colormask & 4), !!(f.colormask & 8));
      }
      if (f.mask & CONST.CLEAR_DEPTH) {
        if (!ds) this._fail(rec, 'depth clear without a depth target');
        bits |= gl.DEPTH_BUFFER_BIT;
        b.setDepthMask(true);
      }
      if (f.mask & CONST.CLEAR_STENCIL) {
        if (!ds || !ds.stencil) this._fail(rec, 'stencil clear without a D24S8 depth target');
        if ((f.stencil >>> 0) > 255) this._fail(rec, `stencil ${f.stencil >>> 0}`);
        bits |= gl.STENCIL_BUFFER_BIT;
        b.setStencilMask(255);
      }
      this._stats.clears++;
      if (!bits) return;
      if (!Number.isFinite(f.z)) this._fail(rec, `clear z ${f.z}`);
      this._bindFbo(rt.fbo);
      this._scissor(left, top, right, bottom, rt.h);
      const c = f.rgba >>> 0;
      b.clear([(c & 255) / 255, ((c >>> 8) & 255) / 255, ((c >>> 16) & 255) / 255, (c >>> 24) / 255], bits, f.z,
        (f.mask & CONST.CLEAR_STENCIL) ? f.stencil >>> 0 : undefined);
    }

    _readback(rec) {
      const f = rec.fields, gl = this.gl;
      const rt = this._get(rec, f.rt, 'readback rt', [KIND.RT]);
      if (f.fmt !== FMT.A8B8G8R8) this._unsupported(rec, `readback fmt ${f.fmt} (only A8B8G8R8)`);
      const { x, y, w, h, pitch } = f;
      if (!(w >= 1 && h >= 1) || x + w > rt.w || y + h > rt.h) this._fail(rec, `rect ${x},${y} ${w}x${h} outside ${rt.w}x${rt.h}`);
      if (pitch < w * 4) this._fail(rec, `pitch ${pitch} < ${w * 4}`);
      const px = new Uint8Array(w * h * 4);
      this._bindFbo(rt.fbo);
      this._staleErrors(rec);
      gl.readPixels(x, rt.h - y - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const err = gl.getError();
      if (err !== gl.NO_ERROR) this._fail(rec, `readPixels GL error 0x${err.toString(16)}`);
      const dst = rec.arena(f.dst, pitch * (h - 1) + w * 4);
      for (let row = 0; row < h; row++) {
        const s = (h - 1 - row) * w * 4;
        dst.set(px.subarray(s, s + w * 4), row * pitch);
      }
      this._stats.readbacks++;
      this._stats.readbackBytes += px.length;
    }

    _present(rec) {
      const f = rec.fields, gl = this.gl, b = this.backend;
      const rt = this._get(rec, f.rt, 'present rt', [KIND.RT]);
      const lut = f.gamma ? this._get(rec, f.gamma, 'gamma table', [KIND.TEX2D]) : null;
      if (lut && (lut.w !== 256 || lut.h !== 1 || lut.fmt !== FMT.A8B8G8R8)) this._fail(rec, `gamma table ${lut.w}x${lut.h} fmt ${lut.fmt}`);
      const { x, y, w, h } = f;
      if (!(w >= 1 && h >= 1) || x + w > rt.w || y + h > rt.h) this._fail(rec, `rect ${x},${y} ${w}x${h} outside ${rt.w}x${rt.h}`);
      if (!this.present) {
        const program = b.createProgram(PRESENT_VS, PRESENT_FS, ['p'], ['area', 'image', 'gammaRamp', 'useGammaRamp']);
        const buffer = b.createBuffer();
        b.updateBuffer(buffer, gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        this.present = { program, buffer };
      }
      const { program, buffer } = this.present;
      const cw = this.canvas ? this.canvas.width : rt.w, ch = this.canvas ? this.canvas.height : rt.h;
      if (x + w > cw || y + h > ch) this._fail(rec, `rect ${x},${y} ${w}x${h} outside the ${cw}x${ch} canvas`);
      if (lut) {
        for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) b.setTextureParameter(lut.tex, p, gl.NEAREST);
        for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) b.setTextureParameter(lut.tex, p, gl.CLAMP_TO_EDGE);
      }
      // The RT texture's sampling parameters may have been set by a BIND.
      for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) b.setTextureParameter(rt.tex, p, gl.NEAREST);
      for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) b.setTextureParameter(rt.tex, p, gl.CLAMP_TO_EDGE);
      this._bindFbo(null);
      for (const cap of [gl.DEPTH_TEST, gl.STENCIL_TEST, gl.BLEND, gl.CULL_FACE, gl.SCISSOR_TEST, gl.POLYGON_OFFSET_FILL]) b.setCapability(cap, false);
      b.setColorMask(true, true, true, true);
      b.setViewport(x, ch - y - h, w, h);
      b.bindTexture(rt.tex, 0);
      b.bindTexture(lut ? lut.tex : rt.tex, 1);
      b.setUniform(program, 'image', '1i', 0);
      b.setUniform(program, 'gammaRamp', '1i', 1);
      b.setUniform(program, 'useGammaRamp', '1f', lut ? 1 : 0);
      b.setUniform(program, 'area', '4f', [w / rt.w, h / rt.h, x / rt.w, (rt.h - y - h) / rt.h]);
      b.draw({ program, vertexBuffer: buffer, stride: 8, attributes: [{ name: 'p', size: 2, offset: 0 }],
        mode: gl.TRIANGLE_STRIP, count: 4 });
      // Never leave an RT bound for sampling while it may become a target.
      b.bindTexture(null, 0);
      b.bindTexture(null, 1);
      const surface = b.present();
      // Headless RasterCanvas snapshots lazily from the bound framebuffer;
      // make the snapshot while the default framebuffer is still bound.
      if (surface && typeof surface.markGlPresented === 'function') void surface._data;
      this._stats.presents++;
      if (this.onPresent) {
        const frame = { surface, width: w, height: h, hwnd: f.surface, dstX: f.dst_x | 0, dstY: f.dst_y | 0,
          stamp: f.stamp >>> 0, stats: this._stats };
        let pixels = null;
        Object.defineProperty(frame, 'pixels', {
          enumerable: true,
          get: () => {
            if (pixels) return pixels;
            const raw = new Uint8Array(w * h * 4);
            this._bindFbo(null);
            gl.readPixels(x, ch - y - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
            pixels = new Uint8Array(w * h * 4);
            for (let row = 0; row < h; row++) pixels.set(raw.subarray((h - 1 - row) * w * 4, (h - row) * w * 4), row * w * 4);
            return pixels;
          },
        });
        this.onPresent(frame);
      }
    }

    stats() {
      const s = this._stats;
      return Object.assign({}, s, { counts: Object.assign({}, s.counts), backend: `webgl${this.backend.version}` });
    }

    close() {
      if (this.closed) return;
      this.closed = true;
      const gl = this.gl, b = this.backend;
      try {
        this._bindFbo(null);
        for (const r of this.res.values()) {
          if (r.kind === KIND.RT) { gl.deleteFramebuffer(r.fbo); b.deleteTexture(r.tex); }
          else if (r.kind === KIND.DS) gl.deleteRenderbuffer(r.rb);
          else if (r.kind === KIND.TEX2D) b.deleteTexture(r.tex);
          else if (r.kind === KIND.SHADER && r.variants) for (const v of r.variants.values()) this._deleteProgram(v.program);
        }
        if (this.vbo) b.deleteBuffer(this.vbo);
        if (this.ibo) b.deleteBuffer(this.ibo);
        if (this.present) { this._deleteProgram(this.present.program); b.deleteBuffer(this.present.buffer); }
      } finally {
        this.res.clear();
        this.filled.clear();
        this.target = null;
        this.vbo = null;
        this.ibo = null;
        this.present = null;
        if (this.ownsBackend) b.destroy();
      }
    }
  }

  return { Executor };
});
