// GPU stream v2 WebGL executor (docs/gpu-stream-v2.md).
//
// Executes the byte records the WAT frontends write (Glide first) on a WebGL
// context through lib/gpu-backend.js. It derives no API state: every value it
// uses is in a record. The pixel shader is the frontend's native shader IR,
// compiled by lib/d3d9-shader.js compileNativeIR(); this file only wraps it
// with the raster stages the RASTER record names (alpha test, fog, W-buffer
// depth) and pairs it with a pretransformed vertex shader.
//
// Conventions (match the retired lib/glide-backend.js device this replaces):
//   - RT color lives in a texture + FBO in GL-natural bottom-up orientation;
//     UPLOAD/READBACK rows are top-down and are flipped here.
//   - TEX2D level 0 is the largest level; rows are uploaded as given (row 0 at
//     t = 0). Each texture gets a complete chain down to 1x1 (levels past the
//     record's count are zero) and mip sampling clamps the LOD in the shader
//     to the last real level, as the old backend did.
//   - Vertices are pretransformed: pos (x, y top-down, z 0..1, 1), color,
//     tex0 (s, t, oow, q0), tex1 (s1, t1, 0, q1); varyings are screen-linear.
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
  const VERTEX_BYTES = 64;
  const MAX_CONSTS = 8;
  const FOG_UNIT = 2;

  // D3DCMP 1..8 -> GLSL test of a (fragment alpha) against b (reference).
  const ALPHA_TEST = [null, 'false', 'a<b', 'a==b', 'a<=b', 'a>b', 'a!=b', 'a>=b', 'true'];

  // Voodoo 12.4 floating W depth of 1/W (the retired glide-backend.js wDepth()).
  const W_DEPTH = 'float gps_wdepth(float q){if(q>=1.0)return 0.0;if(q<=1.0/65536.0)return 65535.0;' +
    'float e=max(0.0,ceil(-log2(q))-1.0);return clamp(e*4096.0+8192.0-floor(q*exp2(e+13.0)),0.0,65535.0);}';

  const PRESENT_VS = 'attribute vec2 p;uniform vec4 area;varying vec2 uv;void main(){gl_Position=vec4(p,0.,1.);uv=(p*.5+.5)*area.xy+area.zw;}';
  // The retired glide-backend.js present(): LUT index (floor(c*255+0.5)+0.5)/256.
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
      this.res = new Map();       // id -> resource record
      this.filled = new Set();
      this.target = null;         // { rt, ds }
      this.raster = null;
      this.binds = [];
      this.consts = new Float32Array(MAX_CONSTS * 4);
      this.boundFbo = undefined;
      this.blendKey = '';
      this.vbo = null;
      this.present = null;        // { program, buffer }
      this.closed = false;
      this._stats = {
        records: 0, counts: {}, draws: 0, vertices: 0, triangles: 0, presents: 0, readbacks: 0, readbackBytes: 0,
        uploads: 0, uploadBytes: 0, clears: 0, programs: 0,
      };
    }

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
        case OP.RASTER: this._raster(rec); break;
        case OP.BIND: this._bind(rec); break;
        case OP.CONSTS: this._consts(rec); break;
        case OP.DRAW_UP: this._draw(rec); break;
        case OP.CLEAR: this._clear(rec); break;
        case OP.FENCE: this.gl.flush(); break;
        case OP.READBACK: this._readback(rec); break;
        case OP.PRESENT: this._present(rec); break;
        case OP.MARK: break;
        case OP.VIEWPORT: case OP.DRAW: case OP.COPY:
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
      const limit = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      if (!(w >= 1 && h >= 1 && w <= limit && h <= limit)) this._fail(rec, `bad dimensions ${w}x${h}`);
      if (f.kind === KIND.RT) {
        if (f.fmt !== FMT.A8B8G8R8 || f.levels !== 1) this._unsupported(rec, `RT fmt ${f.fmt} levels ${f.levels}`);
        if (this.canvas && (this.canvas.width !== w || this.canvas.height !== h)) {
          this.canvas.width = w;
          this.canvas.height = h;
        }
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
        this.res.set(f.id, { kind: KIND.RT, gl: true, tex, fbo, w, h, depth: null });
      } else if (f.kind === KIND.DS) {
        if (f.fmt !== FMT.D16) this._unsupported(rec, `DS fmt ${f.fmt}`);
        const rb = gl.createRenderbuffer();
        if (!rb) this._fail(rec, 'renderbuffer allocation failed');
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
        // getError is sticky: report only an error this allocation raised,
        // naming any earlier one instead of blaming the allocation for it.
        const stale = [];
        for (let e = gl.getError(); e !== gl.NO_ERROR && stale.length < 8; e = gl.getError()) stale.push(e);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
        const error = gl.getError();
        if (error !== gl.NO_ERROR) this._fail(rec, `D16 renderbuffer ${w}x${h} allocation failed (GL error 0x${error.toString(16)}`
          + (stale.length ? `, earlier unreported 0x${stale.map(x => x.toString(16)).join(',0x')})` : ')'));
        if (stale.length) console.warn(`[gpu-stream-webgl] earlier GL error(s) 0x${stale.map(x => x.toString(16)).join(',0x')} before CREATE seq ${rec.seq}`);
        this.res.set(f.id, { kind: KIND.DS, gl: true, rb, w, h, fresh: true });
      } else if (f.kind === KIND.TEX2D) {
        if (f.fmt !== FMT.A8B8G8R8 && f.fmt !== FMT.L8) this._unsupported(rec, `TEX2D fmt ${f.fmt}`);
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
      const bpp = r.kind === KIND.TEX2D && r.fmt === FMT.L8 ? 1 : 4;
      const levels = r.kind === KIND.RT ? 1 : r.levels;
      if (f.level >= levels) this._fail(rec, `level ${f.level} of ${levels}`);
      const lw = Math.max(1, r.w >> f.level), lh = Math.max(1, r.h >> f.level);
      const { x, y, w, h, pitch } = f;
      if (!(w >= 1 && h >= 1) || x + w > lw || y + h > lh) this._fail(rec, `rect ${x},${y} ${w}x${h} outside ${lw}x${lh}`);
      if (pitch < w * bpp || f.bytes < pitch * (h - 1) + w * bpp) this._fail(rec, `pitch ${pitch} / bytes ${f.bytes} too small for ${w}x${h}`);
      const src = rec.arena(f.src, f.bytes);
      const out = new Uint8Array(w * h * 4);
      const flip = r.kind === KIND.RT;
      for (let row = 0; row < h; row++) {
        const s = row * pitch, d = (flip ? h - 1 - row : row) * w * 4;
        if (bpp === 4) out.set(src.subarray(s, s + w * 4), d);
        else for (let i = 0; i < w; i++) {
          const v = src[s + i];
          out[d + i * 4] = v; out[d + i * 4 + 1] = v; out[d + i * 4 + 2] = v; out[d + i * 4 + 3] = 255;
        }
      }
      b.updateTexture2D(r.tex, { level: f.level, x, y: flip ? r.h - y - h : y, width: w, height: h,
        format: gl.RGBA, type: gl.UNSIGNED_BYTE, pixels: out });
      this._stats.uploads++;
      this._stats.uploadBytes += f.bytes;
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
        for (const o of this.res.values()) if (o.kind === KIND.RT && o.depth === r) {
          this._bindFbo(o.fbo);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, null);
          o.depth = null;
        }
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
      if (samplers.some((n) => n > 1)) this._unsupported(rec, `sampler slots ${samplers}`);
      this.res.set(f.id, { kind: KIND.SHADER, gl: false, compiled, samplers, variants: new Map() });
    }

    _layout(rec) {
      const f = rec.fields;
      this._define(rec, f.id, KIND.LAYOUT);
      const e = GS.decodeLayoutElems(rec);
      const want = [[CONST.USAGE_POSITIONT, 0], [CONST.USAGE_COLOR, 0], [CONST.USAGE_TEXCOORD, 0], [CONST.USAGE_TEXCOORD, 1]];
      const ok = f.stride === VERTEX_BYTES && e.length === 4 && e.every((x, i) => x.slot === 0 &&
        x.type === CONST.VTYPE_FLOAT4 && x.usage === want[i][0] && x.index === want[i][1] && x.offset === i * 16);
      if (!ok) this._unsupported(rec, 'layout other than POSITIONT/COLOR/TEXCOORD0/TEXCOORD1 float4, stride 64');
      this.res.set(f.id, { kind: KIND.LAYOUT, gl: false });
    }

    _sampler(rec) {
      const f = rec.fields;
      this._define(rec, f.id, KIND.SAMPLER);
      if (![1, 3].includes(f.address_u) || ![1, 3].includes(f.address_v)) this._unsupported(rec, `address ${f.address_u}/${f.address_v}`);
      if (![1, 2].includes(f.min) || ![1, 2].includes(f.mag) || f.mip > 2) this._unsupported(rec, `filter ${f.min}/${f.mag}/${f.mip}`);
      if (!Number.isFinite(f.lod_bias)) this._fail(rec, `lod_bias ${f.lod_bias}`);
      this.res.set(f.id, { kind: KIND.SAMPLER, gl: false, u: f.address_u, v: f.address_v, min: f.min, mag: f.mag,
        mip: f.mip, bias: f.lod_bias });
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
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, ds ? ds.rb : null);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) this._fail(rec, 'color/depth framebuffer incomplete');
        rt.depth = ds;
      }
      if (ds && ds.fresh) {
        // CREATE starts resources zeroed: depth 0.
        const b = this.backend;
        b.setCapability(gl.SCISSOR_TEST, false);
        b.setDepthMask(true);
        b.clear(null, gl.DEPTH_BUFFER_BIT, 0);
        ds.fresh = false;
      }
      this.target = { rt, ds };
    }

    _raster(rec) {
      const f = Object.assign({}, rec.fields);
      f.depth_bias |= 0;
      for (const k of ['scissor_left', 'scissor_top', 'scissor_right', 'scissor_bottom']) f[k] |= 0;
      const bad = (m) => this._unsupported(rec, m);
      if (f.depth_mode > 2) bad(`depth_mode ${f.depth_mode}`);
      if (!(f.zfunc >= 1 && f.zfunc <= 8)) bad(`zfunc ${f.zfunc}`);
      if (!(f.cull >= 1 && f.cull <= 3)) bad(`cull ${f.cull}`);
      if (!(f.alpha_func >= 1 && f.alpha_func <= 8)) bad(`alpha_func ${f.alpha_func}`);
      for (const k of ['src_rgb', 'dst_rgb', 'src_alpha', 'dst_alpha']) if (!(f[k] >= 1 && f[k] <= 11)) bad(`${k} ${f[k]}`);
      if (f.dst_rgb === 11 || f.dst_alpha === 11) bad('SRC_ALPHA_SATURATE as a destination factor');
      if (f.fog_mode > 3 || f.fog_flags > 3) bad(`fog ${f.fog_mode}/${f.fog_flags}`);
      if (f.fill !== 3) bad(`fill ${f.fill}`);
      if (f.colormask > 15) bad(`colormask ${f.colormask}`);
      if (f.fog_mode === 2) {
        if (!f.fog_table) this._fail(rec, 'table fog without a fog table');
        this._get(rec, f.fog_table, 'fog table', [KIND.TEX2D]);
      }
      if (f.scissor_right < f.scissor_left || f.scissor_bottom < f.scissor_top) this._fail(rec, 'inverted scissor');
      this.raster = f;
    }

    _bind(rec) {
      const binds = [];
      for (const e of GS.decodeBind(rec)) {
        if (e.slot > 1) this._unsupported(rec, `slot ${e.slot}`);
        if (binds[e.slot]) this._fail(rec, `slot ${e.slot} bound twice`);
        const texture = this._get(rec, e.texture, `slot ${e.slot} texture`, [KIND.TEX2D]);
        const sampler = this._get(rec, e.sampler, `slot ${e.slot} sampler`, [KIND.SAMPLER]);
        if (!this.filled.has(e.sampler)) this._fail(rec, `sampler ${e.sampler} was never defined`);
        binds[e.slot] = { texture, sampler };
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

    _program(rec, shader, raster) {
      const gl = this.gl, b = this.backend;
      const w = raster.depth_mode === CONST.DEPTH_W;
      const mips = [0, 1].map((n) => shader.samplers.includes(n) && this.binds[n] && this.binds[n].sampler.mip > 0);
      const key = `${w ? 1 : 0}|${raster.fog_mode}|${raster.fog_flags}|${raster.alpha_func}|${mips[0] ? 1 : 0}${mips[1] ? 1 : 0}`;
      let v = shader.variants.get(key);
      if (v) return v;
      const desktop = !this.isES && b.version !== 2;
      if (w && b.version !== 2 && !gl.getExtension('EXT_frag_depth')) this._unsupported(rec, 'W buffering requires EXT_frag_depth');
      const mipmapped = mips[0] || mips[1];
      if (mipmapped && b.version !== 2 && this.isES &&
          (!gl.getExtension('OES_standard_derivatives') || !gl.getExtension('EXT_shader_texture_lod')))
        this._unsupported(rec, 'mip sampling requires derivatives and explicit texture LOD');
      const vs = 'attribute vec4 gps_pos;attribute vec4 gps_color;attribute vec4 gps_tex0;attribute vec4 gps_tex1;' +
        'uniform vec4 gps_target;' +
        'varying vec4 d3d_color0;varying vec4 d3d_tex0;varying vec4 d3d_tex1;varying vec4 gps_aux;' +
        'void main(){gl_Position=vec4(gps_pos.x*2.0/gps_target.x-1.0,1.0-gps_pos.y*2.0/gps_target.y,' +
        `${w ? '0.0' : 'gps_pos.z*2.0-1.0'},1.0);gl_PointSize=1.0;` +
        'd3d_color0=gps_color;d3d_tex0=gps_tex0;d3d_tex1=gps_tex1;gps_aux=vec4(gps_color.a,gps_pos.z,gps_tex0.z,0.0);}';
      let src = shader.compiled.source.replace('gl_FragColor = r0;', 'gps_out(r0);');
      for (const n of shader.samplers) src = src.split(`texture2D(d3d_s${n},`).join(`gps_tex${n}(`);
      if (/texture2D\(d3d_s/.test(src) || /textureCube/.test(src)) this._unsupported(rec, 'shader samples outside texld');
      const ext = [];
      if (w && !desktop) ext.push('#extension GL_EXT_frag_depth : require');
      if (mipmapped) ext.push('#extension GL_OES_standard_derivatives : require', '#extension GL_EXT_shader_texture_lod : require');
      const helpers = ['uniform float gps_alpha_ref;uniform float gps_depth_bias;uniform vec4 gps_fog_color;uniform sampler2D gps_fog_table;',
        'varying vec4 gps_aux;', W_DEPTH];
      for (const n of shader.samplers) {
        if (mips[n]) {
          // The retired glide-backend.js mip path: isotropic LOD from level-0 texels,
          // biased, clamped to the last real level.
          helpers.push(`uniform vec4 gps_size${n};uniform float gps_bias${n};`,
            `vec4 gps_tex${n}(vec2 uv){vec2 dx=dFdx(uv)*gps_size${n}.xy;vec2 dy=dFdy(uv)*gps_size${n}.xy;` +
            `float lod=0.5*log2(max(max(dot(dx,dx),dot(dy,dy)),1.0e-16))+gps_bias${n};` +
            `return texture2DLodEXT(d3d_s${n},uv,min(lod,gps_size${n}.z));}`);
        } else helpers.push(`vec4 gps_tex${n}(vec2 uv){return texture2D(d3d_s${n},uv);}`);
      }
      const out = ['void gps_out(vec4 c){c=clamp(c,0.0,1.0);'];
      if (raster.alpha_func !== 8) out.push(`float a=c.a;float b=gps_alpha_ref;if(!(${ALPHA_TEST[raster.alpha_func]}))discard;`);
      if (raster.fog_mode) {
        const fog = raster.fog_mode === CONST.FOG_VERTEX_ALPHA ? 'clamp(gps_aux.x,0.0,1.0)'
          : raster.fog_mode === CONST.FOG_Z ? 'clamp(gps_aux.y,0.0,1.0)'
            : 'texture2D(gps_fog_table,vec2((clamp((gps_wdepth(gps_aux.z)+gps_depth_bias)/1024.0,0.0,63.0)+0.5)/64.0,0.5)).r';
        out.push(`float fog=${fog};c.rgb=${raster.fog_flags & CONST.FOGF_NO_MULT ? 'vec3(0.0)' : 'c.rgb*(1.0-fog)'}+` +
          `${raster.fog_flags & CONST.FOGF_NO_ADD ? 'vec3(0.0)' : 'gps_fog_color.rgb*fog'};`);
      }
      if (w) out.push(`${desktop ? 'gl_FragDepth' : 'gl_FragDepthEXT'}=clamp((gps_wdepth(gps_aux.z)+gps_depth_bias)/65535.0,0.0,1.0);`);
      out.push('gl_FragColor=c;}');
      src = src.replace('void main() {', `${helpers.join('\n')}\n${out.join('')}\nvoid main() {`);
      const fs = ext.length ? `${ext.join('\n')}\n${src}` : src;
      const uniforms = ['gps_target', 'gps_alpha_ref', 'gps_depth_bias', 'gps_fog_color', 'gps_fog_table',
        'gps_size0', 'gps_bias0', 'gps_size1', 'gps_bias1', 'd3d_s0', 'd3d_s1'];
      for (let i = 0; i < MAX_CONSTS; i++) uniforms.push(`d3d_ps_c${i}`);
      let program;
      try {
        program = b.createProgram(vs, fs, ['gps_pos', 'gps_color', 'gps_tex0', 'gps_tex1'], uniforms);
      } catch (e) {
        this._fail(rec, `program link failed: ${e.message}\n--- fragment ---\n${fs}`);
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
      const key = `${f.src_rgb},${f.dst_rgb},${f.src_alpha},${f.dst_alpha}`;
      if (key === this.blendKey) return;
      gl.blendFuncSeparate(map[f.src_rgb], map[f.dst_rgb], map[f.src_alpha], map[f.dst_alpha]);
      this.blendKey = key;
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
      if (f.stride !== VERTEX_BYTES) this._unsupported(rec, `stride ${f.stride}`);
      const shader = this._get(rec, f.ps, 'ps', [KIND.SHADER]);
      if (!shader.compiled) this._fail(rec, `ps ${f.ps} was never defined`);
      this._get(rec, f.layout, 'layout', [KIND.LAYOUT]);
      if (!this.filled.has(f.layout)) this._fail(rec, `layout ${f.layout} was never defined`);
      const mode = f.prim === CONST.PRIM_TRIANGLELIST ? gl.TRIANGLES : f.prim === CONST.PRIM_LINELIST ? gl.LINES
        : f.prim === CONST.PRIM_POINTLIST ? gl.POINTS : null;
      if (mode === null) this._unsupported(rec, `prim ${f.prim}`);
      const per = f.prim === CONST.PRIM_TRIANGLELIST ? 3 : f.prim === CONST.PRIM_LINELIST ? 2 : 1;
      if (f.count === 0 || f.count % per) this._fail(rec, `${f.count} vertices for prim ${f.prim}`);
      if (!this.target) this._fail(rec, 'draw without TARGETS');
      const r = this.raster;
      if (!r) this._fail(rec, 'draw without RASTER');
      const { rt, ds } = this.target;
      if (r.depth_mode && !ds) this._fail(rec, 'depth test without a depth target');
      for (const n of shader.samplers) if (!this.binds[n]) this._fail(rec, `shader samples slot ${n}, which BIND left empty`);
      const { program } = this._program(rec, shader, r);

      this._bindFbo(rt.fbo);
      b.setViewport(0, 0, rt.w, rt.h);
      this._scissor(r.scissor_left, r.scissor_top, r.scissor_right, r.scissor_bottom, rt.h);
      b.setCapability(gl.DEPTH_TEST, r.depth_mode !== CONST.DEPTH_OFF);
      b.setDepthFunc(gl.NEVER + r.zfunc - 1);
      b.setDepthMask(!!r.zwrite);
      b.setColorMask(!!(r.colormask & 1), !!(r.colormask & 2), !!(r.colormask & 4), !!(r.colormask & 8));
      this._setBlend(!!r.blend, r);
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
        b.setTextureParameter(t.tex, gl.TEXTURE_WRAP_S, s.u === 3 ? gl.CLAMP_TO_EDGE : gl.REPEAT);
        b.setTextureParameter(t.tex, gl.TEXTURE_WRAP_T, s.v === 3 ? gl.CLAMP_TO_EDGE : gl.REPEAT);
        b.setTextureParameter(t.tex, gl.TEXTURE_MIN_FILTER, s.mip
          ? (s.min === 2 ? (s.mip === 2 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR_MIPMAP_NEAREST)
            : (s.mip === 2 ? gl.NEAREST_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_NEAREST))
          : (s.min === 2 ? gl.LINEAR : gl.NEAREST));
        b.setTextureParameter(t.tex, gl.TEXTURE_MAG_FILTER, s.mag === 2 ? gl.LINEAR : gl.NEAREST);
        b.setUniform(program, `gps_size${n}`, '4f', [t.w, t.h, t.levels - 1, 0]);
        b.setUniform(program, `gps_bias${n}`, '1f', s.bias);
        b.setUniform(program, `d3d_s${n}`, '1i', n);
      }
      let fogTex = null;
      if (r.fog_mode === CONST.FOG_TABLE_W) {
        fogTex = this._get(rec, r.fog_table, 'fog table', [KIND.TEX2D]).tex;
        for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) b.setTextureParameter(fogTex, p, gl.LINEAR);
        for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) b.setTextureParameter(fogTex, p, gl.CLAMP_TO_EDGE);
      }
      for (const n of shader.samplers) b.bindTexture(this.binds[n].texture.tex, n);
      if (fogTex) { b.bindTexture(fogTex, FOG_UNIT); b.setUniform(program, 'gps_fog_table', '1i', FOG_UNIT); }

      b.setUniform(program, 'gps_target', '4f', [rt.w, rt.h, 0, 0]);
      b.setUniform(program, 'gps_alpha_ref', '1f', r.alpha_ref / 255);
      b.setUniform(program, 'gps_depth_bias', '1f', r.depth_bias);
      const fc = r.fog_color >>> 0;
      b.setUniform(program, 'gps_fog_color', '4f', [(fc & 255) / 255, ((fc >>> 8) & 255) / 255, ((fc >>> 16) & 255) / 255, (fc >>> 24) / 255]);
      for (let i = 0; i < MAX_CONSTS; i++) b.setUniform(program, `d3d_ps_c${i}`, '4f', this.consts.subarray(i * 4, i * 4 + 4));

      if (!this.vbo) this.vbo = b.createBuffer();
      b.updateBuffer(this.vbo, gl.ARRAY_BUFFER, rec.arena(f.voff, f.count * VERTEX_BYTES), gl.STREAM_DRAW);
      b.draw({
        program, vertexBuffer: this.vbo, stride: VERTEX_BYTES,
        attributes: [
          { name: 'gps_pos', size: 4, offset: 0 }, { name: 'gps_color', size: 4, offset: 16 },
          { name: 'gps_tex0', size: 4, offset: 32 }, { name: 'gps_tex1', size: 4, offset: 48 },
        ],
        mode, count: f.count,
      });
      this._stats.draws++;
      this._stats.vertices += f.count;
      if (mode === gl.TRIANGLES) this._stats.triangles += f.count / 3;
    }

    _clear(rec) {
      const f = rec.fields, gl = this.gl, b = this.backend;
      if (f.mask & ~(CONST.CLEAR_COLOR | CONST.CLEAR_DEPTH)) this._unsupported(rec, `mask ${f.mask}`);
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
      this._stats.clears++;
      if (!bits) return;
      if (!Number.isFinite(f.z)) this._fail(rec, `clear z ${f.z}`);
      this._bindFbo(rt.fbo);
      this._scissor(left, top, right, bottom, rt.h);
      const c = f.rgba >>> 0;
      b.clear([(c & 255) / 255, ((c >>> 8) & 255) / 255, ((c >>> 16) & 255) / 255, (c >>> 24) / 255], bits, f.z);
    }

    _readback(rec) {
      const f = rec.fields, gl = this.gl;
      const rt = this._get(rec, f.rt, 'readback rt', [KIND.RT]);
      if (f.fmt !== FMT.RGB565) this._unsupported(rec, `readback fmt ${f.fmt}`);
      const { x, y, w, h, pitch } = f;
      if (!(w >= 1 && h >= 1) || x + w > rt.w || y + h > rt.h) this._fail(rec, `rect ${x},${y} ${w}x${h} outside ${rt.w}x${rt.h}`);
      if (pitch < w * 2) this._fail(rec, `pitch ${pitch} < ${w * 2}`);
      const px = new Uint8Array(w * h * 4);
      this._bindFbo(rt.fbo);
      // getError is sticky: drain (and warn about) earlier errors so only one
      // readPixels itself raised fails the record.
      const stale = [];
      for (let e = gl.getError(); e !== gl.NO_ERROR && stale.length < 8; e = gl.getError()) stale.push(e);
      if (stale.length) console.warn(`[gpu-stream-webgl] earlier GL error(s) 0x${stale.map(x => x.toString(16)).join(',0x')} before READBACK seq ${rec.seq}`);
      gl.readPixels(x, rt.h - y - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const err = gl.getError();
      if (err !== gl.NO_ERROR) this._fail(rec, `readPixels GL error 0x${err.toString(16)}`);
      const dst = rec.arena(f.dst, pitch * h);
      for (let row = 0; row < h; row++) {
        let s = (h - 1 - row) * w * 4, d = row * pitch;
        for (let i = 0; i < w; i++, s += 4, d += 2) {
          const v = ((px[s] >> 3) << 11) | ((px[s + 1] >> 2) << 5) | (px[s + 2] >> 3);
          dst[d] = v & 255;
          dst[d + 1] = v >> 8;
        }
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
      this._bindFbo(null);
      for (const cap of [gl.DEPTH_TEST, gl.STENCIL_TEST, gl.BLEND, gl.CULL_FACE, gl.SCISSOR_TEST]) b.setCapability(cap, false);
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
        const frame = { surface, width: w, height: h, hwnd: f.surface, stats: this._stats };
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
        if (this.present) { this._deleteProgram(this.present.program); b.deleteBuffer(this.present.buffer); }
      } finally {
        this.res.clear();
        this.filled.clear();
        this.target = null;
        this.vbo = null;
        this.present = null;
        if (this.ownsBackend) b.destroy();
      }
    }
  }

  return { Executor };
});
