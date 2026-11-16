'use strict';
// The real WAT texture decoder (src/09ae1-d3d9-texture-decode.wat), compiled on
// its own into a tiny module, for tests that have no guest module: plain
// decode of a byte array, and a D3D9 DrawProducer `textureDecoder` over a
// plain ArrayBuffer guest memory. The fragment is pure (wasm addresses in and
// out, no globals), so this is the same code the shipped module runs.
const fs = require('fs');
const path = require('path');
const { compile } = require('../../tools/watx');

const SOURCE = path.join(__dirname, '../../src/09ae1-d3d9-texture-decode.wat');
const DXT = { 0x31545844: 8, 0x32545844: 16, 0x33545844: 16, 0x34545844: 16, 0x35545844: 16 };
const TEXEL = { 20: 3, 21: 4, 22: 4, 23: 2, 24: 2, 25: 2, 26: 2, 28: 1, 50: 1, 51: 2, 62: 4, 63: 4, 81: 2 };
let cached = null, compiled = null;

function module_() {
  if (compiled) return compiled;
  const wat = `(memory 1 1024)\n(export "memory" (memory 0))\n${fs.readFileSync(SOURCE, 'utf8')}`;
  const r = compile(wat, new Map(), { mode: 'production', standardWat: true, runtimeBuiltins: false, strictDeclarations: true });
  if (!r.success) throw new Error(`09ae1 standalone compile failed: ${JSON.stringify(r.errors || r).slice(0, 2000)}`);
  compiled = new WebAssembly.Module(r.wasmBinary);
  return compiled;
}

function instance() {
  if (!cached) cached = new WebAssembly.Instance(module_(), {}).exports;
  return cached;
}

function pitchOf(format, width) {
  if (DXT[format]) return Math.ceil(width / 4) * DXT[format];
  if (TEXEL[format]) return width * TEXEL[format];
  return 0;
}

function ensure(e, bytes) {
  const need = Math.ceil(bytes / 65536) - e.memory.buffer.byteLength / 65536;
  if (need > 0) e.memory.grow(need);
}

// Decode a whole level: Uint8Array source -> Uint8Array RGBA (A8B8G8R8).
function decode(src, width, height, format, { y0 = 0, rows = height } = {}) {
  const e = instance(), pitch = pitchOf(format, width), out = width * Math.max(0, Math.min(rows, height - y0)) * 4;
  const srcAt = 0, dstAt = (src.length + 15) & ~15;
  ensure(e, dstAt + out + 16);
  new Uint8Array(e.memory.buffer, srcAt, src.length).set(src);
  new Uint8Array(e.memory.buffer, dstAt, out).fill(0xA5);
  if (!e.d3d9_tex_decode(srcAt, pitch, format, width, height, y0, rows, dstAt)) throw new Error(`WAT decoder refused format ${format}`);
  return new Uint8Array(e.memory.buffer, dstAt, out).slice();
}

// DrawProducer option: reads the level record (w,h,pitch,bytes,bits) from the
// producer's own memory, decodes bands of up to `bandRows` rows (a multiple of
// four, like the shipped 64 KB band) and counts calls for cache assertions.
function producerDecoder({ getMemory, guestToWasm, bandRows = 8 }) {
  const stats = { levels: 0, bands: 0 };
  let band = new Uint8Array(0);
  return {
    stats,
    rows(mip, format, y0) {
      const view = new DataView(getMemory()), u32 = p => view.getUint32(p, true);
      const width = u32(mip), height = u32(mip + 4), bytes = u32(mip + 12), bits = guestToWasm(u32(mip + 16));
      if (y0 === 0) stats.levels++;
      stats.bands++;
      const rows = Math.min(bandRows, height - y0);
      const src = new Uint8Array(getMemory(), bits, bytes);
      band = decode(src, width, height, format, { y0, rows });
      return rows;
    },
    band: n => band.subarray(0, n),
  };
}

// A guest memory that is the decoder's own wasm memory: `memory.buffer` is
// the producer's getMemory(), texels are decoded in place by the WAT into a
// scratch band at `scratchAt` (keep it clear of the texels), like the shipped
// module's $D3D9_TEXTURE_DECODE band. No JS reads or copies of the source.
function inPlace({ bytes, scratchAt, bandRows = 16 }) {
  const e = new WebAssembly.Instance(module_(), {}).exports;
  ensure(e, bytes);
  const stats = { levels: 0, bands: 0 };
  const decoder = {
    stats,
    rows(mip, format, y0) {
      const view = new DataView(e.memory.buffer), u32 = q => view.getUint32(q, true);
      const width = u32(mip), height = u32(mip + 4), pitch = u32(mip + 8), bits = u32(mip + 16);
      if (y0 === 0) stats.levels++;
      stats.bands++;
      const rows = Math.min(bandRows, height - y0);
      return e.d3d9_tex_decode(bits, pitch, format, width, height, y0, rows, scratchAt) ? rows : 0;
    },
    band: n => new Uint8Array(e.memory.buffer, scratchAt, n),
  };
  return { memory: e.memory, decoder };
}

// For producer tests with no guest module: route lib/d3d9-host.js uploads
// through this standalone build of the same WAT. Returns the shared stats.
const installedStats = { levels: 0, bands: 0 };
function installStandalone(Host = require('../../lib/d3d9-host')) {
  Host.setStandaloneTextureDecoder(options => {
    const d = producerDecoder({ getMemory: options.getMemory, guestToWasm: options.guestToWasm });
    return { rows(mip, format, y0) { if (y0 === 0) installedStats.levels++; installedStats.bands++; return d.rows(mip, format, y0); },
      band: d.band };
  });
  return installedStats;
}

module.exports = { decode, producerDecoder, pitchOf, installStandalone, inPlace };
