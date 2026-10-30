// Glide packets lowered to the production WAT shader VM and rasterizer.
// JS owns packet/texture conversion; native code owns every shaded pixel.
(function (root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const api = factory(
    node ? require('./glide-backend') : root.GlideBackend,
    node ? require('./d3d9-software-backend') : root.D3D9SoftwareBackend
  );
  if (node) module.exports = api;
  else root.GlideSoftware = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Glide, Native) {
  'use strict';
  const fail = (reason) => {
    throw new Error('Glide software: ' + reason);
  };
  const source = (bank, index = 0, swizzle = 228, negate = false) =>
    (0x80000000 | (bank << 28) | index | (swizzle << 16) | (negate ? 1 << 24 : 0)) >>> 0;
  const dest = (index, mask = 15, sat = false) =>
    (0x80000000 | index | (mask << 16) | (sat ? 1 << 20 : 0)) >>> 0;
  const alpha = (operand) => ((operand & ~0xff0000) | 0xff0000) >>> 0;
  function pixelShader(s, textured, second = null) {
    const chain = Glide.textureChain(s, second);
    const instructions = [],
      emit = (op, ...args) => instructions.push({ op, args });
    const r0 = source(0),
      r1 = source(0, 1),
      tex = source(0, 2),
      vertex = source(1),
      constant = source(2);
    const one = source(2, 1),
      zero = source(2, 2),
      negate = (value) => (value ^ (1 << 24)) >>> 0;
    if (textured) {
      // PS1.4 destination register selects the sampler; preserve both local
      // samples before evaluating the physical TMU1 -> TMU0 cascade.
      if (chain.local0) emit(66, dest(0), (source(3) | (10 << 24)) >>> 0);
      else emit(1, dest(0), zero);
      emit(1, dest(3), r0);
      if (chain.local1) emit(66, dest(1), (source(3, 1) | (10 << 24)) >>> 0);
      else emit(1, dest(1), zero);
      emit(1, dest(2), r1);
      if (chain.useSecond) {
        channel([second[46], second[47], 0, 2, second[50]], 7, true, zero);
        channel([second[48], second[49], 0, 2, second[51]], 8, true, zero);
        emit(1, dest(4), r0);
      } else emit(1, dest(4), zero);
      emit(1, dest(2), source(0, 3));
      channel([s[46], s[47], 0, 2, s[50]], 7, true, source(0, 4));
      channel([s[48], s[49], 0, 2, s[51]], 8, true, source(0, 4));
      emit(1, dest(2), r0);
    } else emit(1, dest(2), one);
    if (s[20]) {
      // Chroma compares the color-combine OTHER source before combining.
      // max(abs(other.rgb-key.rgb)) < half an 8-bit quantum is a match.
      emit(3, dest(1), [vertex, tex, constant][s[3]], source(2, 3));
      emit(11, dest(1), r1, negate(r1));
      emit(11, dest(1, 1), source(0, 1, 0), source(0, 1, 85));
      emit(11, dest(1), source(0, 1, 0), source(0, 1, 170));
      emit(3, dest(1), r1, source(2, 4));
      emit(65, dest(1));
    }
    function channel(params, mask, tmu = false, incoming = zero) {
      const [fn, factor, local, other, invert] = params;
      const l = tmu ? tex : [vertex, constant][local],
        o = tmu ? incoming : [vertex, tex, constant][other];
      if (l === undefined || o === undefined) fail('combiner source');
      const factors = [
        zero,
        l,
        alpha(o),
        alpha(l),
        alpha(tex),
        tex,
        null,
        null,
        one,
        l,
        alpha(o),
        alpha(l),
        alpha(tex),
        tex
      ];
      const f = factors[factor];
      if (f === undefined || f === null) fail('combiner factor ' + factor);
      if (factor >= 9) emit(3, dest(1), one, f);
      else emit(1, dest(1), f);
      const d = dest(0, mask, true),
        la = alpha(l);
      if (fn === 0) emit(1, d, zero);
      else if (fn === 1) emit(1, d, l);
      else if (fn === 2) emit(1, d, la);
      else if (fn === 3) emit(5, d, r1, o);
      else if (fn === 4 || fn === 5) emit(4, d, r1, o, fn === 4 ? l : la);
      else if (fn === 6 || fn === 7 || fn === 8) {
        emit(3, dest(0, mask), o, l);
        if (fn === 6) emit(5, d, r1, r0);
        else emit(4, d, r1, r0, fn === 7 ? l : la);
      } else if (fn === 9 || fn === 16) emit(4, d, r1, negate(l), fn === 9 ? l : la);
      else fail('combiner function ' + fn);
      if (invert) emit(3, d, one, r0);
    }
    channel(s.slice(0, 5), 7);
    channel(s.slice(5, 10), 8);
    const bytes = new Uint8Array(32 + instructions.length * 128),
      u = new Uint32Array(bytes.buffer);
    u.set([0x44534952, 1, 1, 0xffff0104, instructions.length, instructions.length + 2, bytes.length, 1]);
    instructions.forEach(({ op, args }, i) => {
      const at = 8 + i * 32;
      u.set([op, i + 1, args.length, 0], at);
      args.forEach((token, j) =>
        u.set(
          [
            (token >>> 28) & 7,
            token & 2047,
            j === 0 ? (token >>> 16) & 15 : (token >>> 16) & 255,
            j === 0 ? ((token >>> 20) & 1) | (((token >>> 24) & 15) << 8) : (token >>> 24) & 15
          ],
          at + 4 + j * 4
        )
      );
    });
    return { irVersion: 1, nativeBytes: bytes };
  }
  const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  class Device {
    constructor(options) {
      this.options = options;
      this.canvas = options.canvas;
      this.native = null;
      this.nowMs = options.nowMs || (() => performance.now());
      this.stats = {
        draws: 0,
        triangles: 0,
        presents: 0,
        uploads: 0,
        uploadBytes: 0,
        shaderVariants: 0,
        lfbReads: 0,
        lfbWrites: 0,
        gpuReadbackCount: 0,
        gpuReadbackBytes: 0,
        gpuReadbackCpuMs: 0,
        cpuLfbReadCount: 0,
        cpuLfbReadBytes: 0,
        cpuLfbReadCpuMs: 0,
        cpuPresentReadCount: 0,
        cpuPresentReadBytes: 0,
        cpuPresentReadCpuMs: 0,
        presentConversionCpuMs: 0,
        lfbConversionCpuMs: 0,
        lfbReadPacketBytes: 0,
        lfbReadPixelBytes: 0,
        errors: 0
      };
      this.ram = new Uint8Array(Glide.TEXTURE_BYTES);
      this.ram1 = new Uint8Array(Glide.TEXTURE_BYTES);
      this.ranges1 = [];
      this.palette = new Uint32Array(256);
      this.ranges = [];
      this.textures = new Map();
      this.programs = new Map();
    }
    submit(op, bytes) {
      try {
        const result = this.execute(op, bytes);
        if (this.frontDirty && this.active) this.present();
        return result;
      } catch (error) {
        this.stats.errors++;
        throw error;
      }
    }
    execute(op, bytes) {
      const need = (n) => {
        if (bytes.length < n) fail('truncated packet');
      };
      const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        u = (i) => v.getUint32(i * 4, true);
      if (op === 0) {
        let at = 0;
        while (at < bytes.length) {
          if (bytes.length - at < 8) fail('batch header');
          const command = v.getUint32(at, true),
            n = v.getUint32(at + 4, true);
          if (!command || n > bytes.length - at - 8) fail('batch bounds');
          let payload = bytes.subarray(at + 8, at + 8 + n);
          at += 8 + ((n + 3) & ~3);
          if (command === 5 && n >= 436) {
            const draws = [payload];
            let size = n;
            while (at + 8 <= bytes.length && v.getUint32(at, true) === 5) {
              const length = v.getUint32(at + 4, true);
              if (length < 436 || length > bytes.length - at - 8 || size + length - 256 > 256 + 252 * 60)
                break;
              let equal = true;
              for (let j = 0; j < 256; j++)
                if (bytes[at + 8 + j] !== payload[j]) {
                  equal = false;
                  break;
                }
              if (!equal) break;
              draws.push(bytes.subarray(at + 8, at + 8 + length));
              size += length - 256;
              at += 8 + ((length + 3) & ~3);
            }
            if (draws.length > 1) {
              const merged = new Uint8Array(size);
              merged.set(payload);
              let offset = payload.length;
              for (let i = 1; i < draws.length; i++) {
                merged.set(draws[i].subarray(256), offset);
                offset += draws[i].length - 256;
              }
              payload = merged;
            }
          }
          this.execute(command, payload);
        }
        if (at !== bytes.length) fail('batch alignment');
        return 1;
      }
      if (op === 1) {
        need(20);
        if (this.native) fail('already open');
        this.hwnd = u(0);
        this.width = u(1);
        this.height = u(2);
        this.colorFormat = u(3);
        this.origin = u(4);
        this.native = new Native.Device({
          width: this.width,
          height: this.height,
          getExports: this.options.getExports,
          getMemory: this.options.getMemory
        });
        // Word 5 is nColBuffers (older 20-byte packets mean 2). One color
        // buffer: front and back are one surface, a swap only presents it.
        this.singleBuffered = bytes.length >= 24 && u(5) === 1;
        this.colorIds = this.singleBuffered ? [1, 1] : [1, 2];
        // Both color buffers share the board's 16-bit depth surface.
        this.depthAttachment = { id: 1, width: this.width, height: this.height, format: 80 };
        this.active = true;
        this.gamma = 1;
        this.gammaTable = null;
        for (let i = 0; i < (this.singleBuffered ? 1 : 2); i++) this.native.createColor(this.target(i));
        if (this.canvas) {
          this.canvas.width = this.width;
          this.canvas.height = this.height;
        }
        return 1;
      }
      if (op === 2) {
        this.destroy();
        return 1;
      }
      if (!this.native) fail('closed context');
      if (op === 19) {
        if (bytes.length) fail('completion barrier payload');
        // All preceding native raster calls have completed synchronously.
        return 1;
      }
      if (op === 13 || op === 14) {
        this.gammaTable = Glide.gammaTable(op, bytes, this.gammaTable, this.gamma);
        this.frontDirty = true;
        return 1;
      }
      if (op === 3) {
        need(12);
        const base = bytes.length >= 268 ? 64 : 0,
          c = Glide.color(u(base), this.colorFormat);
        c[3] = (u(base + 1) & 255) / 255;
        const target = base ? u(45) : 1;
        if (base) this.active = !!u(61);
        const rect = base
          ? [[u(26), u(25) ? this.height - u(29) : u(27), u(28), u(25) ? this.height - u(27) : u(29)]]
          : null;
        this.native.clear(
          c,
          base ? (u(30) || u(31) ? 1 : 0) | (u(13) ? 2 : 0) : 3,
          u(base + 2) / 65535,
          rect,
          this.depthAttachment,
          0,
          this.target(target),
          base ? (u(30) ? 7 : 0) | (u(31) ? 8 : 0) : 15
        );
        if (target === 0) this.frontDirty = true;
        return 1;
      }
      if (op === 4) {
        this.colorIds.reverse();
        this.stats.swaps = (this.stats.swaps || 0) + 1;
        if (bytes.length >= 256) {
          this.active = !!u(61);
          this.gamma = v.getFloat32(53 * 4, true);
        }
        this.frontDirty = true;
        if (this.active) this.present();
        return 1;
      }
      if (op === 5) {
        this.draw(bytes);
        return 1;
      }
      if (op === 11 || op === 12) {
        this.primitive(op, bytes);
        return 1;
      }
      if (op >= 15 && op <= 17) {
        if (op === 15) this.draw(bytes, true);
        else this.primitive(op === 16 ? 11 : 12, bytes, true);
        return 1;
      }
      if (op === 18) {
        need(4);
        const unit = u(0);
        if (unit > 1) fail('TMU upload selector');
        return this.upload(bytes.subarray(4), unit);
      }
      if (op === 6) return this.upload(bytes, 0);
      if (op === 7) {
        need(1024);
        for (let i = 0; i < 256; i++) this.palette[i] = u(i);
        this.invalidateTextures();
        return 1;
      }
      if (op === 8) {
        need(64);
        this.fogTable = bytes.slice(0, 64);
        return 1;
      }
      if (op === 9 || op === 10) {
        need(20);
        if (u(0) > 1 || u(1) > 1 || u(2) !== 0 || u(3) !== this.width || u(4) !== this.height)
          fail('LFB mode');
        need(20 + this.width * this.height * 2);
        if (op === 9) {
          const bgra = this.readCpuColor(u(0), 'cpuLfbRead');
          const convertStart = this.nowMs();
          for (let y = 0; y < this.height; y++)
            for (let x = 0; x < this.width; x++) {
              const p = ((u(1) ? this.height - 1 - y : y) * this.width + x) * 4;
              v.setUint16(
                20 + (y * this.width + x) * 2,
                ((bgra[p + 2] >> 3) << 11) | ((bgra[p + 1] >> 2) << 5) | (bgra[p] >> 3),
                true
              );
            }
          this.stats.lfbReads++;
          this.stats.lfbConversionCpuMs += this.nowMs() - convertStart;
          this.stats.lfbReadPacketBytes += bytes.byteLength;
          this.stats.lfbReadPixelBytes += this.width * this.height * 2;
        } else {
          const bgra = new Uint8Array(this.width * this.height * 4);
          for (let y = 0; y < this.height; y++)
            for (let x = 0; x < this.width; x++) {
              const c = v.getUint16(20 + (y * this.width + x) * 2, true),
                p = ((u(1) ? this.height - 1 - y : y) * this.width + x) * 4;
              bgra.set(
                [
                  Math.round(((c & 31) * 255) / 31),
                  Math.round((((c >> 5) & 63) * 255) / 63),
                  Math.round(((c >> 11) * 255) / 31),
                  255
                ],
                p
              );
            }
          this.native.updateColor(this.target(u(0)), bgra, this.width * 4);
          this.stats.lfbWrites++;
          if (u(0) === 0) this.frontDirty = true;
        }
        return 1;
      }
      fail('packet opcode ' + op);
    }
    upload(bytes, unit) {
      const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        u = (i) => v.getUint32(i * 4, true),
        ram = unit ? this.ram1 : this.ram,
        need = (n) => {
          if (bytes.length < n) fail('truncated upload');
        };
      let ranges = unit ? this.ranges1 : this.ranges;
      need(28);
      const start = u(0),
        layout = Glide.textureLayout(u(1), u(2), u(3), u(4), u(5)),
        n = u(6);
      need(28 + n);
      if (
        n < layout.levels.reduce((sum, l) => sum + l.size, 0) ||
        start > ram.length ||
        n > ram.length - start
      )
        fail('texture bounds');
      ram.set(bytes.subarray(28, 28 + n), start);
      ranges.push([start, start + n]);
      ranges.sort((a, b) => a[0] - b[0]);
      const merged = [];
      for (const range of ranges) {
        const last = merged[merged.length - 1];
        if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
        else merged.push(range);
      }
      ranges = merged;
      if (unit) this.ranges1 = ranges;
      else this.ranges = ranges;
      this.invalidateTextures();
      this.stats.uploads++;
      this.stats.uploadBytes += n;
      return 1;
    }
    readCpuColor(buffer, category) {
      // Native software copies existing CPU pixels; never call this a GPU readback.
      const start = this.nowMs();
      this.stats[category + 'Count']++;
      try {
        const pixels = this.native.readColor(this.target(buffer)).pixels;
        this.stats[category + 'Bytes'] += pixels.byteLength;
        return pixels;
      } finally { this.stats[category + 'CpuMs'] += this.nowMs() - start; }
    }
    present() {
      const rgba = this.readCpuColor(0, 'cpuPresentRead'),
        gamma = this.gamma > 0 ? this.gamma : 1;
      const convertStart = this.nowMs();
      for (let i = 0; i < rgba.length; i += 4) {
        const r = rgba[i];
        rgba[i] = rgba[i + 2];
        rgba[i + 2] = r;
        // The RGB565 display is opaque. Preserve render-target alpha for
        // blending, but never turn it into transparency in the page canvas.
        rgba[i + 3] = 255;
        if (this.gammaTable)
          for (let j = 0; j < 3; j++) rgba[i + j] = this.gammaTable[j * 256 + rgba[i + j]];
        else if (gamma !== 1)
          for (let j = 0; j < 3; j++) rgba[i + j] = Math.round(255 * Math.pow(rgba[i + j] / 255, 1 / gamma));
      }
      this.stats.presentConversionCpuMs += this.nowMs() - convertStart;
      // The process render Worker sends an owned pixel snapshot. Never hand
      // the compositor a view into a target the rasterizer can overwrite.
      if (this.options.presentPixels) {
        this.stats.presents++;
        this.frontDirty = false;
        this.options.presentPixels({ pixels: new Uint8ClampedArray(rgba),
          hwnd: this.hwnd, width: this.width, height: this.height,
          stats: { ...this.stats } });
        return;
      }
      const ctx = this.canvas.getContext('2d'),
        image = ctx.createImageData(this.width, this.height);
      image.data.set(rgba);
      ctx.putImageData(image, 0, 0);
      this.stats.presents++;
      this.frontDirty = false;
      if (this.options.onPresent)
        this.options.onPresent({
          surface: this.canvas,
          hwnd: this.hwnd,
          width: this.width,
          height: this.height,
          stats: this.stats
        });
    }
    target(index) {
      if (index > 1) fail('aux color buffer');
      return { id: this.colorIds[index], width: this.width, height: this.height, format: 21 };
    }
    primitive(op, bytes, dual = false) {
      const stateBytes = dual ? Glide.DUAL_STATE_BYTES : Glide.STATE_BYTES;
      const count = op === 11 ? 2 : 1;
      if (bytes.length !== stateBytes + count * 60) fail('primitive packet');
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        a = Array.from({ length: 15 }, (_, i) => view.getFloat32(stateBytes + i * 4, true)),
        b =
          count === 2
            ? Array.from({ length: 15 }, (_, i) => view.getFloat32(stateBytes + 60 + i * 4, true))
            : a;
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        length = Math.hypot(dx, dy);
      if (count === 2 && !length) return;
      const ox = count === 1 ? 0.5 : (-dy / length) * 0.5,
        oy = count === 1 ? 0.5 : (dx / length) * 0.5;
      // Geometry expansion only: native shared-edge coverage shades the quad.
      // This rectangular one-pixel line does not yet match diamond-exit edges.
      const corners =
        count === 1
          ? [
              [a, -0.5, -0.5],
              [a, 0.5, -0.5],
              [a, -0.5, 0.5],
              [a, 0.5, 0.5]
            ]
          : [
              [a, ox, oy],
              [a, -ox, -oy],
              [b, ox, oy],
              [b, -ox, -oy]
            ];
      const packet = new Uint8Array(stateBytes + 6 * 60),
        v = new DataView(packet.buffer);
      packet.set(bytes.subarray(0, stateBytes));
      v.setUint32(24 * 4, 0, true);
      [0, 1, 2, 2, 1, 3].forEach((k, i) => {
        const [vertex, x, y] = corners[k];
        vertex.forEach((value, j) =>
          v.setFloat32(stateBytes + i * 60 + j * 4, value + (j === 0 ? x : j === 1 ? y : 0), true)
        );
      });
      this.draw(packet, dual);
      this.stats[count === 2 ? 'lines' : 'points'] =
        (this.stats[count === 2 ? 'lines' : 'points'] || 0) + 1;
    }
    invalidateTextures() {
      this.textures.clear();
      this.native.releaseTextures([...this.native.residentTextures.keys()]);
    }
    texture(s, unit = 0) {
      const ram = unit ? this.ram1 : this.ram;
      const key = unit + '/' + s.slice(32, 38).join('/');
      let t = this.textures.get(key);
      if (t) return t;
      const start = s[32],
        layout = Glide.textureLayout(s[33], s[34], s[35], s[36], s[37]),
        end = start + layout.levels.reduce((n, l) => n + l.size, 0);
      // A Voodoo TMU samples whatever its RAM holds; Glide never requires the
      // bytes to have been downloaded first. Myth TFL draws from texture
      // addresses 0x0..0x13fff before (and without) downloading there; the
      // hardware shows the RAM's contents, so this does too (zero-initialised).
      if (s[37] !== 3 || end > ram.length)
        fail(`texture source: TMU${unit} 0x${start.toString(16)}..0x${end.toString(16)} evenOdd=${s[37]}`
          + ` lod ${s[33]}..${s[34]} aspect=${s[35]} format=${s[36]}`
          + (end > ram.length ? ` exceeds the ${ram.length}-byte TMU RAM` : ' needs a second TMU for split even/odd chains'));
      const levels = layout.levels.map((l) => ({
        key: 'glide/' + key + '/' + l.lod,
        width: l.width,
        height: l.height,
        pixels: Glide.decodeTexture(
          ram.subarray(start + l.offset, start + l.offset + l.size),
          s[36],
          this.palette
        )
      }));
      t = { width: levels[0].width, height: levels[0].height, levels };
      this.textures.set(key, t);
      return t;
    }
    draw(bytes, dual = false) {
      const stateBytes = dual ? Glide.DUAL_STATE_BYTES : Glide.STATE_BYTES,
        second = dual ? Glide.secondTMU(bytes) : null;
      if (bytes.length < stateBytes + 3 * Glide.VERTEX_BYTES) fail('draw packet');
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        s = Array.from({ length: 64 }, (_, i) => dv.getUint32(i * 4, true));
      if (s[45] > 1 || s[11] > 2 || s[22] > 3) fail('render buffer, depth or fog mode');
      if ([4, 5, 12, 13].includes(s[47]) || [4, 5, 12, 13].includes(s[49]))
        fail('TMU detail/LOD combine factor');
      this.active = !!s[61];
      this.gamma = dv.getFloat32(53 * 4, true) || 1;
      const chain = Glide.textureChain(s, second),
        textured = chain.textured;
      if (
        chain.useSecond &&
        ([4, 5, 12, 13].includes(second[47]) || [4, 5, 12, 13].includes(second[49]))
      )
        fail('TMU detail/LOD combine factor');
      const t = chain.local0 ? this.texture(s) : null,
        t1 = chain.local1 ? this.texture(second, 1) : null,
        key = s
          .slice(0, 10)
          .concat(
            s.slice(46, 52),
            s[20],
            s[22],
            textured ? 1 : 0,
            second ? second.slice(46, 52) : []
          )
          .join('/');
      let ps = this.programs.get(key);
      if (!ps) {
        ps = pixelShader(s, textured, second);
        this.programs.set(key, ps);
        this.stats.shaderVariants++;
      }
      const count = (bytes.length - stateBytes) / Glide.VERTEX_BYTES;
      if (!Number.isInteger(count) || count % 3 || count > 252) fail('vertex count');
      const nominal = Glide.dimensions(0, s[35]),
        nominal1 = Glide.dimensions(0, second ? second[35] : 3);
      const vertices = new Float32Array(count * 16);
      for (let i = 0; i < count; i++) {
        const p = stateBytes + i * Glide.VERTEX_BYTES,
          f = (j) => dv.getFloat32(p + j * 4, true);
        vertices.set(
          [
            // The native D3D rasterizer samples at integer centers; Glide's
            // screen coordinates use the half-integer centers of WebGL.
            f(0) - 0.5,
            (s[25] ? this.height - f(1) : f(1)) - 0.5,
            // The native W-depth hook uses oow. Only Z fog still consumes
            // this lane in W mode; all other cases may leave guest ooz unset.
            s[11] === 2 && s[22] !== 3
              ? 0
              : Math.min(1, Math.max(0, (f(6) + ((s[44] << 16) >> 16)) / 65535)),
            1,
            f(3) / 255,
            f(4) / 255,
            f(5) / 255,
            f(7) / 255,
            f(9) / nominal[0],
            f(10) / nominal[1],
            f(8),
            s[54] & 2 ? f(11) : f(8),
            f(12) / nominal1[0],
            f(13) / nominal1[1],
            0,
            dual ? f(14) : 1
          ],
          i * 16
        );
      }
      const blend = (n, src) => {
        const list = [1, 5, src ? 9 : 3, 7, 2, 6, src ? 10 : 4, 8];
        if (n === 15 && src) return 11;
        if (list[n] === undefined) fail('blend factor');
        return list[n];
      };
      const constants = new Float32Array(20);
      constants.set(Glide.color(s[10], this.colorFormat));
      constants.set([1, 1, 1, 1], 4);
      constants.set(Glide.color(s[21], this.colorFormat), 12);
      constants.fill(0.5 / 255, 16);
      this.native.draw({
        primitive: 4,
        primitiveCount: count / 3,
        stride: 64,
        vertices: new Uint8Array(vertices.buffer),
        colorAttachment: this.target(s[45]),
        depthAttachment: this.depthAttachment,
        glide:
          s[11] === 2 || s[22]
            ? {
                depthMode: s[11],
                fogMode: s[22],
                bias: (s[44] << 16) >> 16,
                color:
                  (0xff000000 |
                    (Math.round(Glide.color(s[23], this.colorFormat)[0] * 255) << 16) |
                    (Math.round(Glide.color(s[23], this.colorFormat)[1] * 255) << 8) |
                    Math.round(Glide.color(s[23], this.colorFormat)[2] * 255)) >>>
                  0,
                table: this.fogTable || new Uint8Array(64)
              }
            : undefined,
        attributes: [
          { register: 0, usage: 9, usageIndex: 0, type: 3, offset: 0 },
          { register: 5, usage: 10, usageIndex: 0, type: 3, offset: 16 },
          { register: 7, usage: 5, usageIndex: 0, type: 3, offset: 32 },
          { register: 8, usage: 5, usageIndex: 1, type: 3, offset: 48 }
        ],
        vertexShader: null,
        pixelShader: ps,
        pixelConstants: constants,
        fixedFunction: {
          lighting: false,
          fog: false,
          specular: false,
          world: identity(),
          view: identity(),
          projection: identity(),
          stages: [
            {
              colorOp: 2,
              colorArg1: 2,
              alphaOp: 2,
              alphaArg1: 2,
              transformFlags: 0,
              texCoordIndex: 0
            },
            {
              colorOp: 2,
              colorArg1: 2,
              alphaOp: 2,
              alphaArg1: 2,
              transformFlags: 0,
              texCoordIndex: 1
            },
            { colorOp: 1 }
          ]
        },
        state: {
          zenable: !!s[11],
          zwrite: !!s[13],
          zfunc: s[12] + 1,
          cull: s[24] ? (s[24] === 1 ? 2 : 3) : 1,
          blend: true,
          separateAlpha: true,
          srcblend: blend(s[14], true),
          dstblend: blend(s[15], false),
          srcblendalpha: blend(s[16], true),
          dstblendalpha: blend(s[17], false),
          colorWriteMask: (s[30] ? 7 : 0) | (s[31] ? 8 : 0),
          alphaTest: s[18] !== 7,
          alphaFunc: s[18] + 1,
          alphaRef: s[19]
        },
        scissor: {
          enabled: true,
          left: s[26],
          top: s[25] ? this.height - s[29] : s[27],
          right: s[28],
          bottom: s[25] ? this.height - s[27] : s[29]
        },
        textures: [t, t1].map((texture, unit) =>
          texture
            ? {
                ...texture,
                sampler: {
                  addressU: (unit ? second : s)[38] ? 3 : 1,
                  addressV: (unit ? second : s)[39] ? 3 : 1,
                  min: (unit ? second : s)[40] ? 2 : 1,
                  mag: (unit ? second : s)[41] ? 2 : 1,
                  mip: (unit ? second : s)[42] ? 1 : 0
                }
              }
            : null
        )
      });
      this.stats.draws++;
      this.stats.triangles += count / 3;
      if (s[45] === 0) this.frontDirty = true;
    }
    destroy() {
      if (this.native) this.native.destroy();
      this.native = null;
      this.textures.clear();
      this.programs.clear();
      this.ranges = [];
      this.ranges1 = [];
    }
  }
  return { Device, pixelShader };
});
