#!/usr/bin/env node
'use strict';

// gpu-stream.js — inspect and replay GPU stream v2 dumps (docs/gpu-stream-v2.md)
//
// tl;dr
//   node tools/gpu-stream.js list  FILE [--tail]   one line per record: seq, op, key fields
//                                                  (--tail: the record tail as u32 words)
//   node tools/gpu-stream.js stats FILE [--json]   counts per op, bytes, draws, vertices,
//                                                  presents, hash (NullExecutor)
//   node tools/gpu-stream.js replay FILE --executor=null|soft|webgl
//                                   [--png=OUT.png] [--frame=N] [--width=W --height=H]
//
// Dumps come from `test/run.js --gpu-stream-dump=FILE` (lib/gpu-stream.js
// DumpWriter). replay --executor=soft boots the WAT software rasterizer the
// way test/test-gpu-stream-software.js does; --executor=webgl needs headless GL
// (lib/headless-gl.js). --png writes the RGBA of the last PRESENT, or of the
// Nth (1-based) with --frame=N.

const fs = require('fs');
const path = require('path');
const GS = require('../lib/gpu-stream');

const ROOT = path.join(__dirname, '..');

function usage(msg) {
  if (msg) console.error(`gpu-stream: ${msg}`);
  console.error('usage: gpu-stream.js list|stats|replay FILE [--json] [--executor=null|soft|webgl] [--png=OUT.png] [--frame=N]');
  process.exit(2);
}

const argv = process.argv.slice(2);
const cmd = argv[0];
const file = argv[1];
const flag = (name) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
const has = (name) => argv.includes(`--${name}`);
if (!cmd || !file || file.startsWith('--')) usage();
if (!fs.existsSync(file)) usage(`no such file: ${file}`);
const bytes = new Uint8Array(fs.readFileSync(file));

// Key fields for `list`: all scalar fields except padding/reserved.
function keyFields(rec) {
  const parts = [];
  for (const [k, v] of Object.entries(rec.fields)) {
    if (/^(pad\d*|reserved)$/.test(k) || Array.isArray(v)) continue;
    parts.push(`${k}=${typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(4) : v}`);
  }
  if (rec.tail.length) parts.push(`tail=${rec.tail.length}B`);
  // --tail: the variable-length tail as little-endian u32 words (BIND
  // entries {slot, texture, sampler}, CONSTS floats as bits, ...).
  if (rec.tail.length && has('tail')) {
    const t = rec.tail;
    const words = [];
    for (let o = 0; o + 4 <= t.length; o += 4) words.push((t[o] | (t[o + 1] << 8) | (t[o + 2] << 16) | (t[o + 3] << 24)) >>> 0);
    parts.push(`[${words.join(',')}]`);
  }
  return parts.join(' ');
}

function list() {
  for (const rec of new GS.DumpReader(bytes).records()) {
    console.log(`${String(rec.seq).padStart(8)}  ${rec.name.padEnd(9)} ${keyFields(rec)}`);
  }
}

function stats() {
  const ex = new GS.NullExecutor();
  GS.replay(bytes, ex);
  const s = Object.assign({ file, dumpBytes: bytes.length }, ex.stats());
  if (has('json')) { console.log(JSON.stringify(s)); return; }
  console.log(`${file}: ${s.records} records, ${s.bytes} record bytes, ${s.dumpBytes} dump bytes`);
  console.log(`draws ${s.draws}, vertices ${s.vertices}, presents ${s.presents}, hash ${s.hash}`);
  for (const [op, n] of Object.entries(s.counts).sort((a, b) => b[1] - a[1])) console.log(`  ${op.padEnd(9)} ${n}`);
}

function loadExecutorModule(name) {
  const mod = path.join(ROOT, 'lib', `gpu-stream-${name}.js`);
  if (!fs.existsSync(mod)) {
    console.error(`gpu-stream: --executor=${name === 'software' ? 'soft' : name} needs ${path.relative(ROOT, mod)}, which does not exist yet`);
    process.exit(1);
  }
  const m = require(mod);
  if (typeof m.Executor !== 'function') {
    console.error(`gpu-stream: ${path.relative(ROOT, mod)} does not export class Executor`);
    process.exit(1);
  }
  return m.Executor;
}

function writePng(out, info) {
  const { PNG } = require('pngjs');
  const png = new PNG({ width: info.width, height: info.height });
  png.data = Buffer.from(info.pixels.buffer, info.pixels.byteOffset, info.width * info.height * 4);
  fs.writeFileSync(out, PNG.sync.write(png));
}

async function replay() {
  const kind = flag('executor') || 'null';
  const pngOut = flag('png');
  const frameN = flag('frame') !== null ? Number(flag('frame')) : null;
  if (frameN !== null && !(Number.isInteger(frameN) && frameN >= 1)) usage('--frame=N is 1-based');
  let presents = 0;
  let captured = null;
  const onPresent = (info) => {
    presents++;
    if (!pngOut) return;
    if (frameN !== null && presents !== frameN) return;
    if (!info || !info.pixels) throw new Error('executor present gave no pixels (onPresent({pixels,width,height}))');
    captured = { width: info.width, height: info.height, pixels: Uint8Array.from(info.pixels) };
  };

  let executor;
  if (kind === 'null') {
    executor = new GS.NullExecutor();
  } else if (kind === 'soft') {
    const Executor = loadExecutorModule('software');
    const { bootRenderHarness } = require(path.join(ROOT, 'test', 'render-helper'));
    const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
    executor = new Executor({ getExports: () => e, getMemory: () => memory.buffer, onPresent });
  } else if (kind === 'webgl') {
    const Executor = loadExecutorModule('webgl');
    const hgl = require(path.join(ROOT, 'lib', 'headless-gl'));
    if (!hgl.available()) { console.error(`gpu-stream: --executor=webgl: ${hgl.unavailableReason()}`); process.exit(1); }
    const { createCanvas } = require(path.join(ROOT, 'lib', 'canvas-compat'));
    const { WebGLBackend } = require(path.join(ROOT, 'lib', 'gpu-backend'));
    const canvas = createCanvas(Number(flag('width') || 640), Number(flag('height') || 480));
    const backend = new WebGLBackend(canvas);
    executor = new Executor({ canvas, backend, onPresent });
  } else usage(`unknown executor '${kind}'`);

  const t0 = process.hrtime.bigint();
  const r = GS.replay(bytes, executor);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (executor.close) executor.close();
  const line = [`${r.records} records`, `${ms.toFixed(1)} ms`];
  if (kind === 'null') {
    const s = executor.stats();
    line.push(`presents ${s.presents}`, `draws ${s.draws}`, `vertices ${s.vertices}`, `hash ${s.hash}`);
  } else line.push(`presents ${presents}`);
  console.log(`replay --executor=${kind}: ${line.join(', ')}`);
  if (pngOut) {
    if (kind === 'null') usage('--png needs a pixel executor (soft or webgl)');
    if (!captured) {
      console.error(`gpu-stream: no PRESENT ${frameN !== null ? `#${frameN}` : ''} to capture (${presents} presents)`);
      process.exit(1);
    }
    writePng(pngOut, captured);
    console.log(`wrote ${pngOut} (${captured.width}x${captured.height})`);
  }
}

(async () => {
  if (cmd === 'list') list();
  else if (cmd === 'stats') stats();
  else if (cmd === 'replay') await replay();
  else usage(`unknown command '${cmd}'`);
})().catch((err) => {
  console.error(`gpu-stream: ${err && err.stack || err}`);
  process.exit(1);
});
