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

  // GL window y (rows down) of a perspective (D3D) draw's contract y = 0:
  // half a pixel on, less a lift so an edge exactly on a pixel centre falls
  // to D3D's top-left rule rather than GL's bottom-left one (GL's tie-break
  // is top-left in its y-up window). The lift must survive the GPU snapping
  // vertices to its subpixel grid, and GL ES only promises 4 bits: a 1/128
  // px lift (0.4921875, before 2026-11-16) rounded back to 0.5 on SwiftShader,
  // so every row on a tile edge went to the tile above and sampled its far
  // edge (Heretic II's main-menu book: a 1 px dark seam where the tiles
  // meet). 1/16 px is on every grid. Linear (Glide) draws are unlifted.
  const Y_CENTRE = '0.4375';

  // D3DCMP 1..8 -> GLSL test of a (fragment alpha) against b (reference).
  const ALPHA_TEST = [null, 'false', 'a<b', 'a==b', 'a<=b', 'a>b', 'a!=b', 'a>=b', 'true'];

  // The contract's W-buffer encoding of interpolated rhw q: 16-bit floating
  // W (4-bit exponent, 12-bit mantissa), as the Voodoo stores it.
  const W_DEPTH = 'float gps_wdepth(float q){if(q>=1.0)return 0.0;if(q<=1.0/65536.0)return 65535.0;' +
    'float e=max(0.0,ceil(-log2(q))-1.0);return clamp(e*4096.0+8192.0-floor(q*exp2(e+13.0)),0.0,65535.0);}';

  // RASTER.logic_op (1 + GL op - GL_CLEAR; n = op - 1 is GL's truth table,
  // result bit = n >> ((1-s)*2 + (1-d)) & 1) -> how a draw does it. Ops
  // with an exact blend or output form need no destination copy; the rest
  // ('dst') read a snapshot of the RT and apply n per bit in the shader.
  const BLEND_INVERT = { src_rgb: 10, dst_rgb: 1, src_alpha: 8, dst_alpha: 1, blend_op: 1, blend_op_alpha: 1 };
  const COUNT_BLEND = { src_rgb: 2, dst_rgb: 2, src_alpha: 2, dst_alpha: 2, blend_op: 1, blend_op_alpha: 1 };
  function logicMode(op) {
    switch (op) {
      case 0: case 4: return {};                              // off, COPY
      case 1: return { out: 'clear' };                        // CLEAR
      case 16: return { out: 'set' };                         // SET
      case 13: return { out: 'cinv' };                        // COPY_INVERTED
      case 11: return { out: 'set', blend: BLEND_INVERT };    // INVERT: 1 * (1 - dst)
      case 6: return { noop: true };                          // NOOP: colour untouched
      default: return { out: 'dst' };
    }
  }
  const LOGIC_DST = 'uniform sampler2D gps_dst;uniform vec4 gps_dst_size;uniform vec4 gps_logic;' +
    'vec4 gps_logic_op(vec4 c){vec4 s=floor(c*255.0+0.5);vec4 d=floor(texture2D(gps_dst,gl_FragCoord.xy*gps_dst_size.xy)*255.0+0.5);' +
    'vec4 r=vec4(0.0);float p=1.0;for(int k=0;k<8;k++){vec4 a=mod(s,2.0);vec4 e=mod(d,2.0);' +
    'r+=p*(a*e*gps_logic.x+a*(1.0-e)*gps_logic.y+(1.0-a)*e*gps_logic.z+(1.0-a)*(1.0-e)*gps_logic.w);' +
    's=floor(s*0.5);d=floor(d*0.5);p*=2.0;}return r/255.0;}';
  const MAX_RUN_SHAPES = 256;

  // Do two run shapes cover a common pixel? Touching is not overlapping.
  function overlaps(a, b) {
    if (a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0) return false;
    if (!a.tri || !b.tri) return true;
    for (const t of [a.tri, b.tri]) {
      for (let e = 0; e < 3; e++) {
        const px = t[e * 2], py = t[e * 2 + 1], qx = t[((e + 1) % 3) * 2], qy = t[((e + 1) % 3) * 2 + 1];
        const nx = py - qy, ny = qx - px;
        if (nx === 0 && ny === 0) continue;
        let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
        for (let k = 0; k < 3; k++) {
          const da = (a.tri[k * 2] - px) * nx + (a.tri[k * 2 + 1] - py) * ny;
          const db = (b.tri[k * 2] - px) * nx + (b.tri[k * 2 + 1] - py) * ny;
          amin = Math.min(amin, da); amax = Math.max(amax, da); bmin = Math.min(bmin, db); bmax = Math.max(bmax, db);
        }
        if (amax <= bmin || bmax <= amin) return false;
      }
    }
    return true;
  }

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
      // The fog table and the logic-op destination copy take the two units
      // after the last sampler slot.
      this.maxSamplers = Math.max(2, Math.min(MAX_SLOTS, units - 2));
      this.fogUnit = this.maxSamplers;
      this.dstUnit = this.maxSamplers + 1;
      // Vertex shaders: c0..c255 plus the viewport uniforms, and every
      // output varying (oD0-1, oT0-7, the aux lane).
      this.vsIR = (gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) | 0) >= 256 + 4
        && (gl.getParameter(gl.MAX_VARYING_VECTORS) | 0) >= 11 && (gl.getParameter(gl.MAX_VERTEX_ATTRIBS) | 0) >= 16;
      // User clip planes: six more vertex uniforms and one more varying (the
      // distances; there is no gl_ClipDistance in GLSL ES, so the fragment
      // stage discards on the interpolated values).
      this.clipPlanes = this.vsIR && (gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) | 0) >= 256 + 4 + 6
        && (gl.getParameter(gl.MAX_VARYING_VECTORS) | 0) >= 12;
      // D3D W-buffer (depth_mode 3): a per-pixel depth write, which only
      // those draws' programs carry (they lose early depth rejection).
      this.wBuffer = this.backend.version === 2 || !this.isES || !!gl.getExtension('EXT_frag_depth');
      this._caps = Object.freeze({
        flags: (this.vsIR ? CONST.CAP_VS_IR : 0) | CONST.CAP_STENCIL | CONST.CAP_LOGIC_OP | CONST.CAP_OCCLUSION
          | CONST.CAP_BORDER_LINEAR | (this.clipPlanes ? CONST.CAP_CLIP_PLANES : 0) | (this.wBuffer ? CONST.CAP_WBUFFER : 0) | CONST.CAP_COPY,
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
      this.vconsts = new Float32Array(256 * 4);
      this.clip = { mask: 0, planes: new Float32Array(24) };  // CLIP, D3D clip space
      this.boundFbo = undefined;
      this.blendKey = '';
      this.sized = false;
      this.vbo = null;
      this.ibo = null;
      this.present = null;        // { program, buffer }
      this.occlusion = null;      // open occlusion query: { total, batches, rt, tex, fbo, ds }
      this.closed = false;
      this._stats = {
        records: 0, counts: {}, draws: 0, vertices: 0, triangles: 0, presents: 0, readbacks: 0, readbackBytes: 0,
        uploads: 0, uploadBytes: 0, clears: 0, programs: 0, logicDraws: 0, logicCopies: 0, occlusionQueries: 0,
        occlusionPasses: 0,
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
      // A lost context accepts GL calls silently. Let the stream's existing
      // fault/retirement path refuse the record before any blank PRESENT.
      if (this.gl.isContextLost && this.gl.isContextLost())
        throw new Error('gpu-stream-webgl: context lost');
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
        case OP.CLIP: this._clip(rec); break;
        case OP.DRAW_UP: case OP.DRAW: this._draw(rec); break;
        case OP.CLEAR: this._clear(rec); break;
        case OP.FENCE: this._fence(rec); break;
        case OP.READBACK: this._readback(rec); break;
        case OP.PRESENT: this._present(rec); break;
        case OP.MARK: break;
        case OP.COPY: this._copy(rec); break;
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
      if (f.kind === KIND.VBUF || f.kind === KIND.IBUF) {
        // Buffers stay CPU bytes; a draw streams the range it reads.
        GS.checkBufferCreate(f, (m) => this._fail(rec, m));
        this.res.set(f.id, { kind: f.kind, gl: true, bytes: new Uint8Array(f.size) });
        return;
      }
      const w = f.width, h = f.height;
      const limit = this._caps.maxTexture;
      if (!(w >= 1 && h >= 1 && w <= limit && h <= limit)) this._fail(rec, `bad dimensions ${w}x${h}`);
      if (f.kind === KIND.RT) {
        if (f.fmt !== FMT.A8B8G8R8 || f.levels !== 1) this._unsupported(rec, `RT fmt ${f.fmt} levels ${f.levels}`);
        // The first RT sizes the canvas; later ones (offscreen targets) leave it.
        // One resize, not width then height: the transient w x oldH (often
        // w x 1) cannot exist on a HiDPI headless-GL drawable, whose window
        // is half the framebuffer, so its resize fails and loses the context.
        if (this.canvas && !this.sized && (this.canvas.width !== w || this.canvas.height !== h)) {
          if (typeof this.canvas.setSize === 'function') this.canvas.setSize(w, h);
          else { this.canvas.width = w; this.canvas.height = h; }
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
      } else if (f.kind === KIND.CUBE) {
        if (f.fmt !== FMT.A8B8G8R8) this._unsupported(rec, `CUBE fmt ${f.fmt} (only A8B8G8R8; producers convert at UPLOAD)`);
        if (w !== h) this._fail(rec, `CUBE ${w}x${h} is not square`);
        const chain = fullChain(w, h);
        if (!(f.levels >= 1 && f.levels <= chain)) this._fail(rec, `${f.levels} levels for ${w}x${h}`);
        const tex = b.createTexture();
        for (let face = 0; face < 6; face++) {
          for (let i = 0; i < chain; i++) {
            const lw = Math.max(1, w >> i);
            b.uploadCubeFace(tex, face, { level: i, width: lw, height: lw, internalFormat: gl.RGBA, format: gl.RGBA,
              type: gl.UNSIGNED_BYTE, pixels: new Uint8Array(lw * lw * 4) });
          }
        }
        if (b.version === 2) b.setTextureParameter(tex, gl.TEXTURE_MAX_LEVEL, f.levels - 1, gl.TEXTURE_CUBE_MAP);
        this.res.set(f.id, { kind: KIND.CUBE, gl: true, tex, w, h, levels: f.levels, fmt: f.fmt });
      } else if (f.kind === KIND.SHADER || f.kind === KIND.LAYOUT || f.kind === KIND.SAMPLER) {
        this.res.set(f.id, { kind: f.kind, gl: false });  // filled by its SHADER/LAYOUT/SAMPLER record
      } else this._unsupported(rec, `CREATE kind ${f.kind}`);
    }

    _upload(rec) {
      const f = rec.fields, gl = this.gl, b = this.backend;
      const r = this._get(rec, f.id, 'upload target', [KIND.TEX2D, KIND.CUBE, KIND.RT, KIND.VBUF, KIND.IBUF]);
      if (r.kind === KIND.VBUF || r.kind === KIND.IBUF) {
        GS.bufferUpload(f, r.bytes.length, (m) => this._fail(rec, m));
        r.bytes.set(rec.arena(f.src, f.bytes), f.x);
        this._stats.uploads++;
        this._stats.uploadBytes += f.bytes;
        return;
      }
      if (r.kind === KIND.CUBE ? f.face > 5 : f.face !== 0) this._fail(rec, `face ${f.face} of kind ${r.kind}`);
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
      if (r.kind === KIND.CUBE) {
        // Cube faces are stored as given, row 0 at t = 0, as D3D and GL agree.
        b.bindTexture(r.tex, 0, gl.TEXTURE_CUBE_MAP);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + f.face, f.level, x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, out);
      } else {
        b.updateTexture2D(r.tex, { level: f.level, x, y: flip ? r.h - y - h : y, width: w, height: h,
          format: gl.RGBA, type: gl.UNSIGNED_BYTE, pixels: out });
      }
      if (flip) r.writes = (r.writes || 0) + 1;
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
        if (this.occlusion && this.occlusion.rt === r) this._fail(rec, `RT ${id} released inside an occlusion query`);
        if (this.boundFbo === r.fbo) this._bindFbo(null);
        gl.deleteFramebuffer(r.fbo);
        b.deleteTexture(r.tex);
        if (r.snap) b.deleteTexture(r.snap.tex);
      } else if (r.kind === KIND.DS) {
        if (this.target && this.target.ds === r) this.target = null;
        if (this.occlusion && this.occlusion.ds === r) this._fail(rec, `DS ${id} released inside an occlusion query`);
        for (const o of this.res.values()) if (o.kind === KIND.RT && o.depth === r) this._detachDepth(o);
        gl.deleteRenderbuffer(r.rb);
      } else if (r.kind === KIND.TEX2D || r.kind === KIND.CUBE) {
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
      if (f.stage !== CONST.STAGE_PS && f.stage !== CONST.STAGE_VS) this._fail(rec, `stage ${f.stage}`);
      const ir = GS.shaderIR(rec).slice();
      if (f.stage === CONST.STAGE_VS) {
        if (!this.vsIR) this._unsupported(rec, 'vertex shaders (no GPS_CAP_VS_IR on this context)');
        const dv = new DataView(ir.buffer, ir.byteOffset, ir.byteLength);
        if (ir.length < 32 || dv.getUint32(8, true) !== 0 || dv.getUint32(12, true) !== 0xfffe0200 || (dv.getUint32(28, true) & ~1) !== 8)
          this._unsupported(rec, 'vertex IR other than core vertex IR (stage 0, 0xfffe0200, flag 8)');
        let vs;
        try { vs = SH.compileNativeIR({ irVersion: 1, nativeBytes: ir }); } catch (e) { this._fail(rec, `vertex shader IR: ${e.message}`); }
        this.res.set(f.id, { kind: KIND.SHADER, gl: false, stage: CONST.STAGE_VS, ir, vs });
        return;
      }
      const shader = { kind: KIND.SHADER, gl: false, ir, sources: new Map(), variants: new Map() };
      const base = this._compile(rec, shader, 0);
      if (base.samplers.some((n) => n >= this.maxSamplers)) this._unsupported(rec, `sampler slots ${base.samplers} (caps ${this.maxSamplers})`);
      Object.assign(shader, { stage: CONST.STAGE_PS, compiled: base.compiled, samplers: base.samplers, varyings: base.varyings });
      this.res.set(f.id, shader);
    }

    // The IR compiled with the slots in cubeMask declared samplerCube (the
    // IR names no texture type; BIND decides it). Cached per mask.
    _compile(rec, shader, cubeMask) {
      let c = shader.sources.get(cubeMask);
      if (c) return c;
      const cubeStages = [];
      for (let n = 0; n < MAX_SLOTS; n++) if (cubeMask & (1 << n)) cubeStages.push(n);
      let compiled;
      try { compiled = SH.compileNativeIR({ irVersion: 1, nativeBytes: shader.ir }, { cubeStages }); } catch (e) { this._fail(rec, `shader IR: ${e.message}`); }
      const src = compiled.source;
      if (src.split('gl_FragColor = r0;').length !== 2) this._fail(rec, 'compiled shader has no single gl_FragColor = r0 epilogue');
      if (src.split('void main() {').length !== 2) this._fail(rec, 'compiled shader has no single main()');
      const samplers = [];
      for (const m of src.matchAll(/uniform (sampler\w+) d3d_s(\d+);/g)) {
        const want = cubeMask & (1 << +m[2]) ? 'samplerCube' : 'sampler2D';
        if (m[1] !== want) this._unsupported(rec, `${m[1]} d3d_s${m[2]} (want ${want})`);
        samplers.push(+m[2]);
      }
      // The varyings the pixel shader reads; the vertex shader writes these.
      const varyings = [];
      for (const m of src.matchAll(/varying vec4 d3d_(color|tex)(\d+);/g)) varyings.push({ color: m[1] === 'color', n: +m[2] });
      c = { compiled, samplers, varyings };
      shader.sources.set(cubeMask, c);
      return c;
    }

    _layout(rec) {
      const f = rec.fields;
      this._define(rec, f.id, KIND.LAYOUT);
      const L = GS.validateLayout(GS.decodeLayoutElems(rec), f.stride, (m) => this._fail(rec, m));
      if (L.programmable) {
        // Vertex shader inputs, bound to DCLs by (usage, index) at draw time.
        const elems = L.elems.map((e) => ({ usage: e.usage, index: e.index, offset: e.offset,
          size: e.type === CONST.VTYPE_D3DCOLOR ? 4 : e.type + 1, color: e.type === CONST.VTYPE_D3DCOLOR }));
        this.res.set(f.id, { kind: KIND.LAYOUT, gl: false, stride: f.stride, programmable: true, elems, attrs: [], pos: null,
          sig: elems.map((e) => `${e.usage}.${e.index}${e.color ? 'b' : e.size}@${e.offset}`).join(',') });
        return;
      }
      for (const e of L.elems)
        if (e.usage === CONST.USAGE_TEXCOORD && e.index >= MAX_TEXCOORDS) this._unsupported(rec, `TEXCOORD${e.index}`);
      const name = (e) => (e.usage === CONST.USAGE_POSITIONT ? 'gps_pos' : e.usage === CONST.USAGE_COLOR ? `gps_c${e.index}` : `gps_t${e.index}`);
      const attrs = L.elems.map((e) => ({
        name: name(e), usage: e.usage, index: e.index, offset: e.offset,
        size: e.type === CONST.VTYPE_D3DCOLOR ? 4 : e.type + 1,
        color: e.type === CONST.VTYPE_D3DCOLOR,
      }));
      const sig = attrs.map((a) => `${a.name}${a.color ? 'b' : a.size}`).sort().join(',');
      this.res.set(f.id, { kind: KIND.LAYOUT, gl: false, stride: f.stride, attrs, sig, pos: L.pos });
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
      // BORDER has no WebGL wrap mode: the shader applies it (_samplerMode).
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
        // A created DS starts at depth 1.0 (far) and stencil 0, as the
        // software executor's does: a draw before the first CLEAR passes LESS.
        const b = this.backend;
        b.setCapability(gl.SCISSOR_TEST, false);
        b.setDepthMask(true);
        if (ds.stencil) b.setStencilMask(255);
        b.clear(null, gl.DEPTH_BUFFER_BIT | (ds.stencil ? gl.STENCIL_BUFFER_BIT : 0), 1, ds.stencil ? 0 : undefined);
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
      this.viewport = { x, y, w, h, zmin: f.zmin, zmax: f.zmax };
    }

    _raster(rec) {
      const f = GS.validateRaster(rec.fields, (m) => this._fail(rec, m));
      const bad = (m) => this._unsupported(rec, m);
      if (f.blend && (f.dst_rgb === 11 || f.dst_alpha === 11)) bad('SRC_ALPHA_SATURATE as a destination factor');
      if (f.blend && [f.blend_op, f.blend_op_alpha].some((o) => o >= 4) && this.backend.version !== 2 && !this.gl.getExtension('EXT_blend_minmax'))
        bad('MIN/MAX blend ops need WebGL2 or EXT_blend_minmax');
      if (f.fill !== 3) bad(`fill ${f.fill}`);
      if (f.depth_mode === CONST.DEPTH_WBUFFER && !this.wBuffer) bad('W-buffer needs WebGL2 or EXT_frag_depth');
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
        const texture = this._get(rec, e.texture, `slot ${e.slot} texture`, [KIND.TEX2D, KIND.CUBE, KIND.RT]);
        const sampler = this._get(rec, e.sampler, `slot ${e.slot} sampler`, [KIND.SAMPLER]);
        if (!this.filled.has(e.sampler)) this._fail(rec, `sampler ${e.sampler} was never defined`);
        binds[e.slot] = { texture, sampler, id: e.texture };
      }
      this.binds = binds;
    }

    _consts(rec) {
      const f = rec.fields;
      if (f.stage !== CONST.STAGE_PS && f.stage !== CONST.STAGE_VS) this._fail(rec, `stage ${f.stage}`);
      const vs = f.stage === CONST.STAGE_VS, max = vs ? 256 : MAX_CONSTS;
      if (f.first + f.count > max) this._unsupported(rec, `constants ${f.first}+${f.count} > ${max}`);
      (vs ? this.vconsts : this.consts).set(GS.decodeConsts(rec), f.first * 4);
    }

    // ── programs ─────────────────────────────────────────────────────────

    // WebGL has no border wrap mode. A point-sampled BORDER axis is a guard
    // on the coordinate (in _program); with any linear filtering the shader
    // does the whole filter (_filteredTex) from exact texel fetches, the
    // software executor's arithmetic: null, or how this sampler on this
    // texture is filtered.
    _samplerMode(s, t) {
      if (t.kind === KIND.CUBE || (s.u !== CONST.ADDR_BORDER && s.v !== CONST.ADDR_BORDER)) return null;
      const mip = t.kind === KIND.RT ? 0 : s.mip;
      if (s.min === 1 && s.mag === 1 && mip !== 2) return null;
      return { key: `${s.min}${s.mag}${mip}${s.u}${s.v}`, min: s.min, mag: s.mag, mip, u: s.u, v: s.v,
        lod: mip > 0 || s.min !== s.mag };
    }

    // gps_tex<n> for a shader-filtered sampler (the texture's own filters
    // are NEAREST, so a fetch at a texel centre is that texel). As the
    // software executor's VM (09ag $d3d_shader_vm_sample*): the coordinate
    // is first folded per axis (wrap, mirror, clamp to [0, 1], border to
    // [-1, 2]); point takes texel floor(uv * size), linear blends the four
    // around uv * size - 0.5; a texel outside the image on a BORDER axis is
    // the border colour, on any other axis the hardware wrap mode (exact at
    // a texel centre) finds it. The filter is mag at LOD <= 0, else min; mip
    // 1 rounds the clamped LOD to a level, mip 2 blends two levels.
    _filteredTex(n, m, flip) {
      const A = CONST;
      const fold = (c, a) => (a === A.ADDR_WRAP ? `fract(${c})` : a === A.ADDR_MIRROR ? `(1.0-abs(1.0-mod(${c},2.0)))`
        : a === A.ADDR_CLAMP ? `clamp(${c},0.0,1.0)` : `clamp(${c},-1.0,2.0)`);
      const oob = [m.u === A.ADDR_BORDER ? 'c.x<0.0||c.x>=z.x' : '', m.v === A.ADDR_BORDER ? 'c.y<0.0||c.y>=z.y' : '']
        .filter(Boolean).join('||');
      const fetch = m.mip ? `texture2DLodEXT(d3d_s${n},q,l)` : `texture2D(d3d_s${n},q)`;
      const lin = (f) => (f === 2 ? 'true' : 'false');
      const pick = m.min === m.mag ? lin(m.min) : `(lod<=0.0?${lin(m.mag)}:${lin(m.min)})`;
      let body;
      if (!m.mip) body = `return gps_fl${n}(uv,0.0,${pick});`;
      else {
        body = `float L=min(max(lod,gps_size${n}.w),gps_size${n}.z);` + (m.mip === 1
          ? `return gps_fl${n}(uv,floor(L+0.5),${pick});`
          : `float L0=floor(L);vec4 a=gps_fl${n}(uv,L0,${pick});float r=L-L0;if(r==0.0)return a;` +
            `return mix(a,gps_fl${n}(uv,L0+1.0,${pick}),r);`);
      }
      return [
        `uniform vec4 gps_size${n};uniform float gps_bias${n};uniform vec4 gps_border${n};`,
        `vec4 gps_fx${n}(vec2 c,vec2 z,float l){if(${oob})return gps_border${n};vec2 q=(c+0.5)/z;` +
          `${flip ? 'q.y=1.0-q.y;' : ''}return ${fetch};}`,
        `vec4 gps_fl${n}(vec2 uv,float l,bool lin){vec2 z=max(floor(gps_size${n}.xy/exp2(l)),1.0);` +
          `if(!lin)return gps_fx${n}(floor(uv*z),z,l);vec2 t=uv*z-0.5;vec2 i=floor(t);vec2 f=t-i;` +
          `return mix(mix(gps_fx${n}(i,z,l),gps_fx${n}(i+vec2(1.0,0.0),z,l),f.x),` +
          `mix(gps_fx${n}(i+vec2(0.0,1.0),z,l),gps_fx${n}(i+vec2(1.0,1.0),z,l),f.x),f.y);}`,
        `vec4 gps_tex${n}(vec2 uv){` + (m.lod ? `vec2 dx=dFdx(uv)*gps_size${n}.xy;vec2 dy=dFdy(uv)*gps_size${n}.xy;` +
          `float lod=0.5*log2(max(max(dot(dx,dx),dot(dy,dy)),1.0e-16))+gps_bias${n};` : '') +
          `uv=vec2(${fold('uv.x', m.u)},${fold('uv.y', m.v)});${body}}`,
      ].join('\n');
    }

    // Sticky user clip planes for draws with a vertex shader (vs 0 ignores
    // them): distances dot(plane, oPos) ride a varying, the fragment stage
    // discards where an enabled one is negative.
    _clip(rec) {
      const f = rec.fields;
      if (!Number.isInteger(f.mask) || f.mask < 0 || f.mask > 63) this._fail(rec, `clip mask ${f.mask}`);
      const planes = Float32Array.from(f.planes);
      for (let i = 0; i < 24; i++) if (!Number.isFinite(planes[i])) this._fail(rec, `non-finite clip plane ${i >> 2}`);
      if (f.mask && !this.clipPlanes) this._unsupported(rec, 'user clip planes need 266 vertex uniforms and 12 varyings');
      this.clip = { mask: f.mask, planes };
    }

    _program(rec, shader, layout, raster, opts = {}) {
      const gl = this.gl, b = this.backend;
      const cubeMask = opts.cubeMask || 0;
      const comp = this._compile(rec, shader, cubeMask);
      const wb = raster.depth_mode === CONST.DEPTH_WBUFFER;
      const w = raster.depth_mode === CONST.DEPTH_W || wb;
      const linear = !!raster.linear;
      const clipMask = opts.vs ? this.clip.mask : 0;
      const slot = (n) => (comp.samplers.includes(n) ? this.binds[n] : null);
      const mips = [], borders = [], flips = [], filtered = [];
      for (let n = 0; n < this.maxSamplers; n++) {
        const s = slot(n);
        const cube = !!(cubeMask & (1 << n));
        // Cube samplers take the GL sampler's own LOD; no border or flip.
        mips[n] = !cube && !!(s && s.sampler.mip > 0);
        borders[n] = s && !cube ? (s.sampler.u === CONST.ADDR_BORDER ? 1 : 0) | (s.sampler.v === CONST.ADDR_BORDER ? 2 : 0) : 0;
        // RT texels are stored bottom-up; t = 0 is still the top row.
        flips[n] = !!(s && s.texture.kind === KIND.RT);
        filtered[n] = s && !cube ? this._samplerMode(s.sampler, s.texture) : null;
      }
      const key = `${layout.sig}|${linear ? 1 : 0}|${w ? raster.depth_mode : 0}|${raster.fog_mode}|${raster.fog_flags}|${raster.alpha_func}|` +
        `${mips.map(Number).join('')}|${borders.join('')}|${flips.map(Number).join('')}|${cubeMask}|${opts.logic || ''}|${opts.count ? 1 : 0}|${opts.vs ? this._vsKey(opts.vs) : ''}|` +
        filtered.map((m) => (m ? m.key : '')).join(',') + `|${clipMask}`;
      let v = shader.variants.get(key);
      if (v) return v;
      const desktop = !this.isES && b.version !== 2;
      if (w && b.version !== 2 && !gl.getExtension('EXT_frag_depth')) this._unsupported(rec, 'W buffering requires EXT_frag_depth');
      // Explicit LOD for mip sampling; derivatives for that LOD, and for a
      // shader-filtered sampler choosing between differing min/mag filters.
      const mipmapped = mips.some(Boolean);
      const derived = mipmapped || filtered.some((m) => m && m.lod);
      if (derived && b.version !== 2 && this.isES &&
          (!gl.getExtension('OES_standard_derivatives') || (mipmapped && !gl.getExtension('EXT_shader_texture_lod'))))
        this._unsupported(rec, 'mip or min/mag filter selection requires derivatives and explicit texture LOD');

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
        // Integer pixel centres (contract) -> GL's half-integer ones; see
        // Y_CENTRE for the perspective draws' y lift.
        `vec2 ndc=vec2((p.x+0.5)*2.0/gps_target.x-1.0,1.0-(p.y+${linear ? '0.5' : Y_CENTRE})*2.0/gps_target.y);`,
        `gl_Position=vec4(ndc*W,${w ? '0.0' : '(p.z*2.0-1.0)*W'},W);gl_PointSize=1.0;`);
      for (const x of shader.varyings) {
        const src = x.color ? input(`gps_c${x.n}`, x.n === 0 ? 'vec4(1.0)' : 'vec4(0.0)') : input(`gps_t${x.n}`, 'vec4(0.0,0.0,0.0,1.0)');
        vs.push(`d3d_${x.color ? 'color' : 'tex'}${x.n}=${src};`);
      }
      vs.push(`gps_aux=vec4(${input('gps_c0', 'vec4(1.0)')}.a,p.z,p.w,0.0);}`);
      if (opts.vs) { vs.length = 0; vs.push(this._vsSource(rec, opts.vs, shader, layout, clipMask)); }

      let src = comp.compiled.source.replace('gl_FragColor = r0;', 'gps_out(r0);');
      const flat = comp.samplers.filter((n) => !(cubeMask & (1 << n)));
      for (const n of flat) src = src.split(`texture2D(d3d_s${n},`).join(`gps_tex${n}(`);
      if (/texture2D\(d3d_s/.test(src)) this._unsupported(rec, 'shader samples outside texld');
      for (const m of src.matchAll(/textureCube\(d3d_s(\d+)/g)) if (!(cubeMask & (1 << +m[1]))) this._unsupported(rec, `textureCube on 2D slot ${m[1]}`);
      const ext = [];
      if (w && !desktop) ext.push('#extension GL_EXT_frag_depth : require');
      if (derived) ext.push('#extension GL_OES_standard_derivatives : require');
      if (mipmapped) ext.push('#extension GL_EXT_shader_texture_lod : require');
      const helpers = ['uniform float gps_alpha_ref;uniform float gps_depth_bias;uniform float gps_w_far;uniform vec4 gps_fog_color;uniform sampler2D gps_fog_table;',
        'varying vec4 gps_aux;', W_DEPTH,
        `float gps_q(){return ${linear ? 'gps_aux.z' : 'gl_FragCoord.w'};}`];
      if (opts.logic === 'dst' && !opts.count) helpers.push(LOGIC_DST);
      for (const n of flat) {
        if (filtered[n]) { helpers.push(this._filteredTex(n, filtered[n], flips[n])); continue; }
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
      // W-buffer: w / w_far with w = 1 / interpolated 1/w (gl_FragCoord.w).
      if (w) out.push(`${desktop ? 'gl_FragDepth' : 'gl_FragDepthEXT'}=` + (wb ? 'clamp(1.0/(gps_q()*gps_w_far),0.0,1.0);'
        : 'clamp((gps_wdepth(gps_q())+gps_depth_bias)/65535.0,0.0,1.0);'));
      // Logic op after alpha test and fog; the colour mask applies after it.
      if (opts.count) out.push('c=vec4(1.0/255.0,0.0,0.0,0.0);');
      else if (opts.logic === 'clear') out.push('c=vec4(0.0);');
      else if (opts.logic === 'set') out.push('c=vec4(1.0);');
      else if (opts.logic === 'cinv') out.push('c=(255.0-floor(c*255.0+0.5))/255.0;');
      else if (opts.logic === 'dst') out.push('c=gps_logic_op(c);');
      out.push('gl_FragColor=c;}');
      if (clipMask) helpers.push('varying vec4 gps_cd;');
      const lanes = ['gps_cd.x', 'gps_cd.y', 'gps_cd.z', 'gps_cd.w', 'gps_aux.y', 'gps_aux.w'];
      const kill = lanes.filter((_, i) => clipMask & (1 << i)).map((l) => `${l}<0.0`).join('||');
      src = src.replace('void main() {', `${helpers.join('\n')}\n${out.join('')}\nvoid main() {${kill ? `if(${kill})discard;` : ''}`);
      const fs = ext.length ? `${ext.join('\n')}\n${src}` : src;
      const uniforms = ['gps_target', 'gps_alpha_ref', 'gps_depth_bias', 'gps_w_far', 'gps_fog_color', 'gps_fog_table', 'gps_dst', 'gps_dst_size', 'gps_logic'];
      for (let n = 0; n < this.maxSamplers; n++) uniforms.push(`gps_size${n}`, `gps_bias${n}`, `gps_border${n}`, `d3d_s${n}`);
      for (let i = 0; i < MAX_CONSTS; i++) uniforms.push(`d3d_ps_c${i}`);
      if (opts.vs) uniforms.push('gps_vp', 'd3d_vs_c[0]');
      if (clipMask) uniforms.push('gps_clip[0]');
      const attrNames = opts.vs ? opts.vs.vs.inputs.map((x) => `d3d_a${x.register}`) : layout.attrs.map((a) => a.name);
      let program;
      try {
        program = b.createProgram(vs.join(''), fs, attrNames, uniforms);
      } catch (e) {
        this._fail(rec, `program link failed: ${e.message}\n--- vertex ---\n${vs.join('')}\n--- fragment ---\n${fs}`);
      }
      v = { program, key };
      shader.variants.set(key, v);
      this._stats.programs++;
      return v;
    }

    _vsKey(vsh) {
      if (!vsh.key) vsh.key = `v${++this._vsSerial || (this._vsSerial = 1)}`;
      return vsh.key;
    }

    // The DCL'd inputs a programmed draw reads, bound by (usage, index) to
    // the layout's elements. D3DCOLOR arrives B,G,R,A and is swizzled in the
    // shader (_vsSource), as D3D presents it to the shader as R,G,B,A.
    _vsInputs(rec, vsh, layout) {
      return vsh.vs.inputs.map((x) => {
        const e = layout.elems.find((el) => el.usage === x.usage && el.index === x.usageIndex);
        if (!e) this._fail(rec, `layout has no usage ${x.usage} index ${x.usageIndex} for vertex input v${x.register}`);
        return { name: `d3d_a${x.register}`, size: e.size, offset: e.offset, color: e.color };
      });
    }

    // The programmed vertex stage: the core VS printed by d3d9-shader.js
    // plus the D3D viewport transform onto this executor's pixel-centre
    // convention (the pretransformed path's: x + 0.5, y + Y_CENTRE), clip z
    // 0..w onto GL's -w..w (the depth range maps it into zmin..zmax), oFog as
    // the fragment's fog amount, and zero for pixel inputs nothing writes.
    _vsSource(rec, vsh, shader, layout, clipMask = 0) {
      const c = vsh.vs;
      let src = c.source;
      const inputs = this._vsInputs(rec, vsh, layout);
      const pre = [];
      for (let i = 0; i < c.inputs.length; i++) {
        const r = c.inputs[i].register;
        const decl = `attribute vec4 d3d_v${r};`;
        if (src.split(decl).length !== 2) this._fail(rec, `vertex source declares v${r} ${src.split(decl).length - 1} times`);
        src = src.replace(decl, `attribute vec4 d3d_a${r};vec4 d3d_v${r};`);
        pre.push(`d3d_v${r}=d3d_a${r}${inputs[i].color ? '.zyxw' : ''};`);
      }
      const extra = ['uniform vec4 gps_target;uniform vec4 gps_vp;varying vec4 gps_aux;'], zero = [];
      // Clip distances: planes 0-3 in gps_cd, 4-5 in gps_aux.y/.w (unused by
      // the programmed path's fragment stage).
      if (clipMask) extra.push('uniform vec4 gps_clip[6];varying vec4 gps_cd;');
      for (const x of shader.varyings) {
        const written = x.color ? c.colors.includes(x.n) : c.texcoords.includes(x.n);
        if (!written) { extra.push(`varying vec4 d3d_${x.color ? 'color' : 'tex'}${x.n};`); zero.push(`d3d_${x.color ? 'color' : 'tex'}${x.n}=vec4(0.0);`); }
      }
      if (src.split('void main() {').length !== 2 || src.split('// gps epilogue').length !== 2) this._fail(rec, 'vertex source shape');
      src = src.replace('void main() {', `${extra.join('')}\nvoid main() {${pre.join('')}${zero.join('')}`);
      src = src.replace('// gps epilogue', 'vec4 p=gps_opos;' +
        'gl_Position=vec4(((gps_vp.x+0.5)*2.0/gps_target.x-1.0)*p.w+(p.x+p.w)*gps_vp.z/gps_target.x,' +
        `(1.0-(gps_vp.y+${Y_CENTRE})*2.0/gps_target.y)*p.w-(p.w-p.y)*gps_vp.w/gps_target.y,p.z*2.0-p.w,p.w);` +
        'gl_PointSize=1.0;gps_aux=vec4(1.0-gps_ofog.x,0.0,p.w,0.0);' +
        (clipMask ? 'gps_cd=vec4(dot(gps_clip[0],p),dot(gps_clip[1],p),dot(gps_clip[2],p),dot(gps_clip[3],p));' +
          'gps_aux.y=dot(gps_clip[4],p);gps_aux.w=dot(gps_clip[5],p);' : ''));
      return src;
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
      if (rec.op === OP.DRAW_UP && (f.vbuf !== 0 || f.ibuf !== 0)) this._fail(rec, 'DRAW_UP names a vertex or index buffer');
      const shader = this._get(rec, f.ps, 'ps', [KIND.SHADER]);
      if (!shader.compiled || shader.stage !== CONST.STAGE_PS) this._fail(rec, `ps ${f.ps} was never defined as a pixel shader`);
      const layout = this._get(rec, f.layout, 'layout', [KIND.LAYOUT]);
      if (!layout.attrs) this._fail(rec, `layout ${f.layout} was never defined`);
      if (f.stride !== layout.stride) this._fail(rec, `stride ${f.stride} differs from layout ${f.layout}'s ${layout.stride}`);
      GS.checkDrawLayout(f, layout, (m) => this._fail(rec, m));
      let vsh = null;
      if (f.vs !== 0) {
        vsh = this._get(rec, f.vs, 'vs', [KIND.SHADER]);
        if (vsh.stage !== CONST.STAGE_VS) this._fail(rec, `vs ${f.vs} was never defined as a vertex shader`);
      }
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
      if (vsh) {
        // The programmed path has no rhw lane and no screen-space position.
        if (r.depth_mode === CONST.DEPTH_W) this._unsupported(rec, 'W depth with a vertex shader');
        if (r.fog_mode === CONST.FOG_TABLE_W || r.fog_mode === CONST.FOG_Z) this._unsupported(rec, `fog_mode ${r.fog_mode} with a vertex shader`);
        if (r.fog_mode === CONST.FOG_VERTEX_ALPHA && !vsh.vs.fogOutput) this._unsupported(rec, 'vertex fog with a vertex shader that writes no oFog');
        if (r.linear) this._unsupported(rec, 'linear varyings with a vertex shader');
        if (r.z_bias || r.slope_bias) this._unsupported(rec, 'z_bias/slope_bias with a vertex shader');
      }
      const bytes = GS.drawBytes(rec, f, (id, kind) => this._get(rec, id, kind === KIND.VBUF ? 'vbuf' : 'ibuf', [kind]).bytes, (m) => this._fail(rec, m));
      const prim = GS.assemble(rec, f, (m) => this._fail(rec, m), undefined, bytes.indices);
      let cubeMask = 0;
      for (const n of shader.samplers) if (this.binds[n].texture.kind === KIND.CUBE) cubeMask |= 1 << n;
      const logic = logicMode(r.logic_op);
      const { program } = this._program(rec, shader, layout, r, { cubeMask, logic: logic.out, vs: vsh });
      const occ = this.occlusion;
      const count = occ ? this._program(rec, shader, layout, r, { cubeMask, logic: logic.out, count: true, vs: vsh }).program : null;

      let left = r.scissor_left, top = r.scissor_top, right = Math.min(r.scissor_right, rt.w), bottom = Math.min(r.scissor_bottom, rt.h);
      if (this.viewport) {
        const vp = this.viewport;
        left = Math.max(left, vp.x); top = Math.max(top, vp.y);
        right = Math.min(right, vp.x + vp.w); bottom = Math.min(bottom, vp.y + vp.h);
      }
      this._stats.draws++;
      if (right <= left || bottom <= top) return;

      const offset = r.depth_mode === CONST.DEPTH_Z && (r.z_bias || r.slope_bias);
      // The real pass, and the occlusion count pass: the same tests into the
      // count target, adding 1/255 per covered pixel, with depth and stencil
      // left unwritten so the real pass that follows sees what it saw.
      const apply = (counting) => {
        this._bindFbo(counting ? this._countTarget(rec, rt, ds).fbo : rt.fbo);
        b.setViewport(0, 0, rt.w, rt.h);
        // Programmed z is clip z/w in 0..1, mapped into the viewport's range.
        const vz = vsh && this.viewport ? this.viewport : null;
        b.setDepthRange(vz ? vz.zmin : 0, vz ? vz.zmax : 1);
        this._scissor(left, top, right, bottom, rt.h);
        b.setCapability(gl.DEPTH_TEST, r.depth_mode !== CONST.DEPTH_OFF);
        b.setDepthFunc(gl.NEVER + r.zfunc - 1);
        b.setDepthMask(!counting && !!r.zwrite);
        b.setCapability(gl.POLYGON_OFFSET_FILL, !!offset);
        if (offset) b.setPolygonOffset(r.slope_bias, r.z_bias * Math.pow(2, ds.bits));
        const cm = counting ? 15 : logic.noop ? 0 : r.colormask;
        b.setColorMask(!!(cm & 1), !!(cm & 2), !!(cm & 4), !!(cm & 8));
        if (counting) this._setBlend(true, COUNT_BLEND);
        else this._setBlend(!!r.blend || !!logic.blend, logic.blend || r);
        this._setStencil(r, ds);
        if (counting && r.stencil_enable) b.setStencilMask(0);
      };
      apply(false);
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
        const target = t.kind === KIND.CUBE ? gl.TEXTURE_CUBE_MAP : gl.TEXTURE_2D;
        // Cube faces are sampled clamped to the face edge (the contract).
        const wrap = (a) => (t.kind === KIND.CUBE ? gl.CLAMP_TO_EDGE : a === CONST.ADDR_WRAP ? gl.REPEAT
          : a === CONST.ADDR_MIRROR ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE);
        b.setTextureParameter(t.tex, gl.TEXTURE_WRAP_S, wrap(s.u), target);
        b.setTextureParameter(t.tex, gl.TEXTURE_WRAP_T, wrap(s.v), target);
        // An RT has one level: its minification filter never names a mip.
        const mip = t.kind === KIND.RT ? 0 : s.mip;
        // A shader-filtered sampler fetches single texels.
        const point = !!this._samplerMode(s, t);
        b.setTextureParameter(t.tex, gl.TEXTURE_MIN_FILTER, point
          ? (mip ? gl.NEAREST_MIPMAP_NEAREST : gl.NEAREST)
          : mip
            ? (s.min === 2 ? (mip === 2 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR_MIPMAP_NEAREST)
              : (mip === 2 ? gl.NEAREST_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_NEAREST))
            : (s.min === 2 ? gl.LINEAR : gl.NEAREST), target);
        b.setTextureParameter(t.tex, gl.TEXTURE_MAG_FILTER, s.mag === 2 && !point ? gl.LINEAR : gl.NEAREST, target);
      }
      let fogTex = null;
      if (r.fog_mode === CONST.FOG_TABLE_W) {
        fogTex = this._get(rec, r.fog_table, 'fog table', [KIND.TEX2D]).tex;
        for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) b.setTextureParameter(fogTex, p, gl.LINEAR);
        for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) b.setTextureParameter(fogTex, p, gl.CLAMP_TO_EDGE);
      }
      const snap = logic.out === 'dst' ? this._snapshot(rt) : null;
      for (const n of shader.samplers) {
        const t = this.binds[n].texture;
        b.bindTexture(t.tex, n, t.kind === KIND.CUBE ? gl.TEXTURE_CUBE_MAP : gl.TEXTURE_2D);
      }
      if (fogTex) b.bindTexture(fogTex, this.fogUnit);
      if (snap) b.bindTexture(snap.tex, this.dstUnit);
      const fc = r.fog_color >>> 0;
      const n4 = (r.logic_op || 1) - 1;
      const uniforms = (p) => {
        for (const n of shader.samplers) {
          const { texture: t, sampler: s } = this.binds[n];
          b.setUniform(p, `gps_size${n}`, '4f', [t.w, t.h, t.levels - 1, s.maxLevel]);
          b.setUniform(p, `gps_bias${n}`, '1f', s.bias);
          b.setUniform(p, `gps_border${n}`, '4f', s.border);
          b.setUniform(p, `d3d_s${n}`, '1i', n);
        }
        if (fogTex) b.setUniform(p, 'gps_fog_table', '1i', this.fogUnit);
        if (snap) {
          b.setUniform(p, 'gps_dst', '1i', this.dstUnit);
          b.setUniform(p, 'gps_dst_size', '4f', [1 / rt.w, 1 / rt.h, 0, 0]);
          b.setUniform(p, 'gps_logic', '4f', [n4 & 1, (n4 >> 1) & 1, (n4 >> 2) & 1, (n4 >> 3) & 1]);
        }
        b.setUniform(p, 'gps_target', '4f', [rt.w, rt.h, 0, 0]);
        b.setUniform(p, 'gps_alpha_ref', '1f', r.alpha_ref / 255);
        b.setUniform(p, 'gps_depth_bias', '1f', r.depth_bias);
        b.setUniform(p, 'gps_w_far', '1f', r.w_far);
        b.setUniform(p, 'gps_fog_color', '4f', [(fc & 255) / 255, ((fc >>> 8) & 255) / 255, ((fc >>> 16) & 255) / 255, (fc >>> 24) / 255]);
        for (let i = 0; i < MAX_CONSTS; i++) b.setUniform(p, `d3d_ps_c${i}`, '4f', this.consts.subarray(i * 4, i * 4 + 4));
        if (vsh) {
          const vp = this.viewport || { x: 0, y: 0, w: rt.w, h: rt.h };
          b.setUniform(p, 'gps_vp', '4f', [vp.x, vp.y, vp.w, vp.h]);
          const n = vsh.vs.constantCount;
          if (n > 0) {
            // DEF'd constants replace the bank's values (as in the VM).
            const c = this.vconsts.slice(0, n * 4);
            for (const [k, v] of vsh.vs.defs) if (k < n) c.set(v, k * 4);
            b.setUniform(p, 'd3d_vs_c[0]', '4f', c);
          }
          if (this.clip.mask) b.setUniform(p, 'gps_clip[0]', '4f', this.clip.planes);
        }
      };
      uniforms(program);
      if (count) uniforms(count);

      if (!this.vbo) this.vbo = b.createBuffer();
      b.updateBuffer(this.vbo, gl.ARRAY_BUFFER, bytes.vertices, gl.STREAM_DRAW);
      const mode = prim.kind === 3 ? gl.TRIANGLES : prim.kind === 2 ? gl.LINES : gl.POINTS;
      const attributes = (vsh ? this._vsInputs(rec, vsh, layout) : layout.attrs).map((a) => (a.color
        ? { name: a.name, size: 4, offset: a.offset, type: gl.UNSIGNED_BYTE, normalized: true }
        : { name: a.name, size: a.size, offset: a.offset }));
      const cmd = { program, vertexBuffer: this.vbo, stride: f.stride, attributes, mode, count: prim.idx.length };
      const indices = (idx) => {
        let type = gl.UNSIGNED_INT;
        if (prim.vcount <= 65536) { idx = Uint16Array.from(idx); type = gl.UNSIGNED_SHORT; }
        else if (b.version !== 2 && !gl.getExtension('OES_element_index_uint')) this._unsupported(rec, `${prim.vcount} vertices need 32-bit indices`);
        if (!this.ibo) this.ibo = b.createBuffer();
        b.updateBuffer(this.ibo, gl.ELEMENT_ARRAY_BUFFER, idx, gl.STREAM_DRAW);
        cmd.indexBuffer = this.ibo;
        cmd.indexType = type;
        cmd.count = idx.length;
      };
      this._stats.vertices += prim.idx.length;
      if (prim.kind === 3) this._stats.triangles += prim.idx.length / 3;
      if (!prim.idx.length) return;
      if (!snap && !occ) {
        // Non-indexed lists draw the vertices as given; everything else
        // (indexed draws, strips) draws the assembled index list.
        const direct = f.index_size === 0 && f.prim !== CONST.PRIM_LINESTRIP && f.prim !== CONST.PRIM_TRIANGLESTRIP;
        if (!direct) indices(prim.idx);
        b.draw(cmd);
        if (!logic.noop) rt.writes = (rt.writes || 0) + 1;
        return;
      }
      // Destination-reading logic ops and occlusion counting draw runs of
      // primitives that cover no pixel twice. A logic op reads a copy of the
      // RT made before the run; a count pass precedes each run's real pass.
      const runs = this._runs(rec, f, layout, prim, snap, rt, bytes.vertices);
      for (const run of runs) {
        if (snap && run.copy) this._copySnapshot(rt, snap);
        indices(run.idx);
        if (occ) {
          apply(true);
          b.draw(Object.assign({}, cmd, { program: count }));
          this._stats.occlusionPasses++;
          if (++occ.batches >= 255) this._occlusionReduce();
          apply(false);
        }
        b.draw(cmd);
      }
      if (snap) this._stats.logicDraws++;
      else if (!logic.noop) rt.writes = (rt.writes || 0) + 1;
    }

    // ── logic op destination copies and occlusion counting ──────────────

    _snapshot(rt) {
      const gl = this.gl, b = this.backend;
      if (rt.snap) return rt.snap;
      const tex = b.createTexture();
      b.uploadTexture2D(tex, { unit: this.dstUnit, width: rt.w, height: rt.h, internalFormat: gl.RGBA, format: gl.RGBA,
        type: gl.UNSIGNED_BYTE, pixels: null });
      for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) b.setTextureParameter(tex, p, gl.NEAREST);
      for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) b.setTextureParameter(tex, p, gl.CLAMP_TO_EDGE);
      rt.snap = { tex, version: -1, shapes: [] };
      return rt.snap;
    }

    _copySnapshot(rt, snap) {
      const gl = this.gl, b = this.backend;
      this._bindFbo(rt.fbo);
      b.bindTexture(snap.tex, this.dstUnit);
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, rt.w, rt.h);
      snap.version = rt.writes || 0;
      this._stats.logicCopies++;
    }

    // Splits the primitives into runs that cover no pixel twice. Triangles
    // are separated by SAT on their edge normals, projected relative to the
    // edge's first vertex so two triangles sharing an edge touch exactly and
    // do not overlap; lines and points use their bounding box grown by a
    // pixel. With a snapshot the shapes since its copy count too, and a run
    // that needs a fresh copy says so.
    _runs(rec, f, layout, prim, snap, rt, bytes) {
      // A programmed draw has no screen position here: every primitive is
      // taken to cover the whole target (one primitive per run).
      const pos = layout.attrs.find((a) => a.name === 'gps_pos');
      if (!pos && !layout.programmable) this._fail(rec, 'layout has no position');
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const X = (v) => (pos ? dv.getFloat32(v * f.stride + pos.offset, true) : NaN);
      const Y = (v) => (pos ? dv.getFloat32(v * f.stride + pos.offset + 4, true) : NaN);
      const per = prim.kind === 3 ? 3 : prim.kind === 2 ? 2 : 1;
      const idx = prim.idx, runs = [];
      // A stale snapshot (the RT was written by anything but a logic op
      // since the copy) is copied before the first run.
      let stale = !!snap && snap.version !== (rt.writes || 0);
      let shapes = snap && !stale ? snap.shapes : [];
      let cur = null;
      for (let i = 0; i + per <= idx.length; i += per) {
        let s;
        if (per === 3) {
          const t = [X(idx[i]), Y(idx[i]), X(idx[i + 1]), Y(idx[i + 1]), X(idx[i + 2]), Y(idx[i + 2])];
          s = { tri: t, x0: Math.min(t[0], t[2], t[4]), y0: Math.min(t[1], t[3], t[5]), x1: Math.max(t[0], t[2], t[4]), y1: Math.max(t[1], t[3], t[5]) };
        } else {
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (let k = 0; k < per; k++) {
            const x = X(idx[i + k]), y = Y(idx[i + k]);
            x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
          }
          s = { tri: null, x0: x0 - 1, y0: y0 - 1, x1: x1 + 1, y1: y1 + 1 };
        }
        if (!(s.x0 === s.x0 && s.y0 === s.y0 && s.x1 === s.x1 && s.y1 === s.y1)) s = { tri: null, x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };
        const conflict = shapes.length >= MAX_RUN_SHAPES || shapes.some((o) => overlaps(o, s));
        if (!cur || conflict || stale) {
          cur = { copy: !!snap && (conflict || stale), list: [] };
          runs.push(cur);
          if (conflict) shapes = [];
          stale = false;
        }
        shapes.push(s);
        for (let k = 0; k < per; k++) cur.list.push(idx[i + k]);
      }
      if (snap) snap.shapes = shapes;
      return runs.map((r) => ({ copy: r.copy, idx: Uint32Array.from(r.list) }));
    }

    _countTarget(rec, rt, ds) {
      const gl = this.gl, b = this.backend, occ = this.occlusion;
      let c = occ.targets.get(rt);
      if (!c) {
        const tex = b.createTexture();
        b.uploadTexture2D(tex, { width: rt.w, height: rt.h, internalFormat: gl.RGBA, format: gl.RGBA,
          type: gl.UNSIGNED_BYTE, pixels: new Uint8Array(rt.w * rt.h * 4) });
        for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) b.setTextureParameter(tex, p, gl.NEAREST);
        const fbo = gl.createFramebuffer();
        if (!fbo) this._fail(rec, 'occlusion framebuffer allocation failed');
        this._bindFbo(fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        c = { tex, fbo, depth: null, w: rt.w, h: rt.h };
        occ.targets.set(rt, c);
      }
      this._bindFbo(c.fbo);
      if (c.depth !== ds) {
        if (c.depth) gl.framebufferRenderbuffer(gl.FRAMEBUFFER, c.depth.stencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, null);
        if (ds) gl.framebufferRenderbuffer(gl.FRAMEBUFFER, ds.stencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, ds.rb);
        c.depth = ds;
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) this._fail(rec, 'occlusion count framebuffer incomplete');
      }
      if (ds) occ.ds = ds;
      occ.rt = rt;
      return c;
    }

    // Sums the count targets into the query total and zeroes them.
    _occlusionReduce() {
      const gl = this.gl, b = this.backend, occ = this.occlusion;
      for (const c of occ.targets.values()) {
        const px = new Uint8Array(c.w * c.h * 4);
        this._bindFbo(c.fbo);
        gl.readPixels(0, 0, c.w, c.h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += px[i];
        occ.total += sum;
        b.setCapability(gl.SCISSOR_TEST, false);
        b.setColorMask(true, true, true, true);
        b.clear([0, 0, 0, 0], gl.COLOR_BUFFER_BIT);
      }
      occ.batches = 0;
    }

    _occlusionFree() {
      const gl = this.gl, b = this.backend;
      for (const c of this.occlusion.targets.values()) {
        if (this.boundFbo === c.fbo) this._bindFbo(null);
        gl.deleteFramebuffer(c.fbo);
        b.deleteTexture(c.tex);
      }
      this.occlusion = null;
    }

    _fence(rec) {
      const f = rec.fields;
      if (f.kind === CONST.FENCEK_FENCE) { this.gl.flush(); return; }
      if (f.kind === CONST.FENCEK_OCCLUSION_BEGIN) {
        if (this.occlusion) this._fail(rec, 'occlusion BEGIN while one is open');
        this.occlusion = { total: 0, batches: 0, targets: new Map(), rt: null, ds: null };
        this._stats.occlusionQueries++;
      } else if (f.kind === CONST.FENCEK_OCCLUSION_END) {
        if (!this.occlusion) this._fail(rec, 'occlusion END without a BEGIN');
        this._occlusionReduce();
        const total = this.occlusion.total;
        this._occlusionFree();
        const out = rec.arena(f.dst, 4);
        new DataView(out.buffer, out.byteOffset, 4).setUint32(0, Math.min(total, 0xffffffff), true);
      } else this._fail(rec, `fence kind ${f.kind}`);
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
      if (bits & gl.COLOR_BUFFER_BIT) rt.writes = (rt.writes || 0) + 1;
    }

    // COPY (CAP_COPY): an RT rect into an RT (stretched: each dst pixel
    // samples its center mapped into the src rect, clamped to it -- the
    // software executor's d3d_software_copy_color arithmetic, done here in
    // JS on read pixels) or into a TEX2D/CUBE level (same size, point).
    // Same-size point copies without the alpha override stay on the GPU.
    _copy(rec) {
      const f = rec.fields, gl = this.gl, b = this.backend;
      const src = this._get(rec, f.src, 'copy src', [KIND.RT]);
      const dst = this._get(rec, f.dst, 'copy dst', [KIND.RT, KIND.TEX2D, KIND.CUBE]);
      if (f.src === f.dst) this._fail(rec, 'copy onto itself');
      const filter = f.filter & 255, level = (f.filter >>> 8) & 255, face = (f.filter >>> 16) & 255;
      const opaque = (f.filter >>> 24) & 1;
      if (filter > 2 || (f.filter >>> 25)) this._fail(rec, `copy filter word 0x${(f.filter >>> 0).toString(16)}`);
      const sx = f.sx | 0, sy = f.sy | 0, sw = f.sw | 0, sh = f.sh | 0, dx = f.dx | 0, dy = f.dy | 0, dw = f.dw | 0, dh = f.dh | 0;
      if (!(sw >= 1 && sh >= 1 && sx >= 0 && sy >= 0) || sx + sw > src.w || sy + sh > src.h) this._fail(rec, `src rect ${sx},${sy} ${sw}x${sh} outside ${src.w}x${src.h}`);
      const isRT = dst.kind === KIND.RT;
      if (isRT ? (level || face) : (dst.kind === KIND.CUBE ? face > 5 : face !== 0)) this._fail(rec, `level ${level} face ${face} of kind ${dst.kind}`);
      if (!isRT && level >= dst.levels) this._fail(rec, `level ${level} of ${dst.levels}`);
      const lw = isRT ? dst.w : Math.max(1, dst.w >> level), lh = isRT ? dst.h : Math.max(1, dst.h >> level);
      if (!(dw >= 1 && dh >= 1 && dx >= 0 && dy >= 0) || dx + dw > lw || dy + dh > lh) this._fail(rec, `dst rect ${dx},${dy} ${dw}x${dh} outside ${lw}x${lh}`);
      const same = dw === sw && dh === sh && filter !== 2;
      if (!isRT && !same) this._unsupported(rec, 'a texture COPY is same-size and point');
      const target = dst.kind === KIND.CUBE ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + face : gl.TEXTURE_2D;
      this._bindFbo(src.fbo);
      this._staleErrors(rec);
      if (same && !opaque) {
        b.bindTexture(dst.tex, 0, dst.kind === KIND.CUBE ? gl.TEXTURE_CUBE_MAP : gl.TEXTURE_2D);
        if (isRT) gl.copyTexSubImage2D(target, 0, dx, dst.h - dy - dh, sx, src.h - sy - sh, sw, sh);
        // RT rows are bottom-up, texture rows top-down: one row at a time.
        else for (let r = 0; r < sh; r++) gl.copyTexSubImage2D(target, level, dx, dy + r, sx, src.h - 1 - (sy + r), sw, 1);
      } else {
        const px = new Uint8Array(sw * sh * 4);
        gl.readPixels(sx, src.h - sy - sh, sw, sh, gl.RGBA, gl.UNSIGNED_BYTE, px);
        // px rows are bottom-up: source row y (top-down) is px row sh-1-y.
        const at = (x, y) => ((sh - 1 - y) * sw + x) * 4;
        const out = new Uint8Array(dw * dh * 4), linear = filter === 2;
        for (let y = 0; y < dh; y++) {
          let fy = (y + 0.5) * sh / dh;
          if (linear) fy = Math.min(Math.max(fy - 0.5, 0), sh - 1);
          const y0 = Math.trunc(fy), y1 = y0 + 1 < sh ? y0 + 1 : y0, wy = fy - y0;
          for (let x = 0; x < dw; x++) {
            let fx = (x + 0.5) * sw / dw;
            if (linear) fx = Math.min(Math.max(fx - 0.5, 0), sw - 1);
            const x0 = Math.trunc(fx), o = (y * dw + x) * 4, a = at(x0, y0);
            if (linear) {
              const x1 = x0 + 1 < sw ? x0 + 1 : x0, wx = fx - x0, bb = at(x1, y0), cc = at(x0, y1), d = at(x1, y1);
              for (let l = 0; l < 4; l++) {
                const top = px[a + l] * (1 - wx) + px[bb + l] * wx, bottom = px[cc + l] * (1 - wx) + px[d + l] * wx;
                out[o + l] = Math.trunc(0.5 + (top * (1 - wy) + bottom * wy));
              }
            } else for (let l = 0; l < 4; l++) out[o + l] = px[a + l];
            if (opaque) out[o + 3] = 255;
          }
        }
        if (isRT) {
          const flipped = new Uint8Array(out.length);
          for (let r = 0; r < dh; r++) flipped.set(out.subarray(r * dw * 4, (r + 1) * dw * 4), (dh - 1 - r) * dw * 4);
          b.updateTexture2D(dst.tex, { level: 0, x: dx, y: dst.h - dy - dh, width: dw, height: dh,
            format: gl.RGBA, type: gl.UNSIGNED_BYTE, pixels: flipped });
        } else {
          b.bindTexture(dst.tex, 0, dst.kind === KIND.CUBE ? gl.TEXTURE_CUBE_MAP : gl.TEXTURE_2D);
          gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
          gl.texSubImage2D(target, level, dx, dy, dw, dh, gl.RGBA, gl.UNSIGNED_BYTE, out);
        }
      }
      const err = gl.getError();
      if (err !== gl.NO_ERROR) this._fail(rec, `COPY GL error 0x${err.toString(16)}`);
      if (isRT) dst.writes = (dst.writes || 0) + 1;
      this._stats.copies = (this._stats.copies || 0) + 1;
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
          stamp: f.stamp >>> 0, rt: f.rt >>> 0, presentSeq: rec.seq >>> 0, stats: this._stats };
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
          if (r.kind === KIND.RT) { gl.deleteFramebuffer(r.fbo); b.deleteTexture(r.tex); if (r.snap) b.deleteTexture(r.snap.tex); }
          else if (r.kind === KIND.DS) gl.deleteRenderbuffer(r.rb);
          else if (r.kind === KIND.TEX2D || r.kind === KIND.CUBE) b.deleteTexture(r.tex);
          else if (r.kind === KIND.SHADER && r.variants) for (const v of r.variants.values()) this._deleteProgram(v.program);
        }
        if (this.vbo) b.deleteBuffer(this.vbo);
        if (this.ibo) b.deleteBuffer(this.ibo);
        if (this.occlusion) this._occlusionFree();
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
