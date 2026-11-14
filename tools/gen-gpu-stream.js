#!/usr/bin/env node
'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// gen-gpu-stream.js — lib/gpu-stream.generated.js from the WAT wire format
//
// tl;dr
//   src/09a8gs-gpu-stream.wat  --(vendored WATX parser + lowerIR layoutsOnly)-->
//     $GPS_* i32.const globals + Gps* (layout ...) declarations
//   --> lib/gpu-stream.generated.js   (constants, layouts, op->layout, decoders)
//   --> tools/gpu-stream-ops.json     (append-only op id baseline)
//
//   node tools/gen-gpu-stream.js           regenerate (and append new ops)
//   node tools/gen-gpu-stream.js --check   fail if stale, or an op id moved
//
// docs/gpu-stream-v2.md "One source of truth": the record layouts are declared
// once, in WAT. The offsets here are the compiler's own (lowerIR), never a
// second field-width table. Op ids are APPEND-ONLY like api_table.json: an op
// that changes value or disappears from the WAT fails both modes.
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'src', '09a8gs-gpu-stream.wat');
const OUT = path.join(ROOT, 'lib', 'gpu-stream.generated.js');
const OPS_BASELINE = path.join(__dirname, 'gpu-stream-ops.json');

// Ops whose payload layout does not follow GPS_OP_FOO_BAR -> GpsFooBar.
const OP_LAYOUT_OVERRIDES = { DRAW_UP: 'GpsDraw' };
// Ops with no payload layout at all.
const OP_NO_LAYOUT = new Set(['WRAP']);

function fail(msg) { console.error(`gen-gpu-stream: ${msg}`); process.exit(1); }

function loadCompilerContext() {
  const SRC = path.join(ROOT, 'tools', 'watx-src');
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    TextEncoder, TextDecoder,
    Float32Array, Float64Array, Uint8Array, ArrayBuffer,
    Map, Set, RegExp, Array, Object, String, Number, Math,
    parseInt, parseFloat, isNaN,
  };
  vm.createContext(ctx);
  for (const f of ['compiler-parser.js', 'compiler-stages.js', 'compiler-codegen.js', 'compiler.js']) {
    vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

function parseNumber(text) {
  const t = String(text).replace(/_/g, '');
  const n = /^-?0x[0-9a-f]+$/i.test(t) ? parseInt(t, 16) : /^-?\d+$/.test(t) ? parseInt(t, 10) : NaN;
  if (!Number.isFinite(n)) return null;
  return n | 0;
}

// Read the one source file through the compiler: globals from the parsed
// forms, layouts from lowerIR. The file is a plain list of module fields, so
// it parses on its own without the rest of the closure.
function readModel() {
  const ctx = loadCompilerContext();
  const text = fs.readFileSync(SOURCE, 'utf8');
  const rel = path.relative(ROOT, SOURCE);
  let forms = ctx.parseSource(text, rel);
  forms = ctx.expandMacros(forms);
  const V = (n) => ctx.watxValue(n);
  const At = (f, i) => ctx.watxAt(f, i);

  const constants = {};
  for (const form of forms) {
    if (!Array.isArray(form) || V(At(form, 0)) !== 'global') continue;
    const name = V(At(form, 1));
    if (typeof name !== 'string' || !name.startsWith('$GPS_')) continue;
    const init = At(form, 3);
    if (V(At(form, 2)) !== 'i32' || !Array.isArray(init) || V(At(init, 0)) !== 'i32.const')
      fail(`${name}: expected (global ${name} i32 (i32.const N))`);
    const value = parseNumber(V(At(init, 1)));
    if (value === null) fail(`${name}: unparsable constant '${V(At(init, 1))}'`);
    const key = name.slice('$GPS_'.length);
    if (Object.prototype.hasOwnProperty.call(constants, key)) fail(`duplicate constant ${name}`);
    constants[key] = value;
  }

  const layouts = {};
  for (const l of ctx.lowerIR(forms, { layouts: new Map() }, { layoutsOnly: true })) {
    if (l.type !== 'layout-lowered') continue;
    if (!/^Gps[A-Z]/.test(l.name)) continue;
    layouts[l.name] = {
      size: l.totalSize,
      fields: l.fields.map((f) => ({ name: f.name, type: f.type, offset: f.offset, size: f.size, count: f.count })),
    };
  }
  if (!layouts.GpsRecord || !layouts.GpsRing) fail('GpsRecord / GpsRing layout missing');

  const ops = {};
  for (const [k, v] of Object.entries(constants)) if (k.startsWith('OP_')) ops[k.slice(3)] = v;
  const seen = new Map();
  for (const [name, id] of Object.entries(ops)) {
    if (id < 0 || id > 0xffff) fail(`GPS_OP_${name} = ${id} does not fit the u16 op field`);
    if (seen.has(id)) fail(`GPS_OP_${name} and GPS_OP_${seen.get(id)} share id ${id}`);
    seen.set(id, name);
  }

  const opLayout = {};
  for (const name of Object.keys(ops)) {
    if (OP_NO_LAYOUT.has(name)) continue;
    const layoutName = OP_LAYOUT_OVERRIDES[name] ||
      'Gps' + name.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
    if (!layouts[layoutName]) fail(`GPS_OP_${name} has no payload layout '${layoutName}' in ${rel}`);
    opLayout[name] = layoutName;
  }
  return { constants, layouts, ops, opLayout };
}

// ── op id baseline (append-only) ──────────────────────────────────────────

function readBaseline() {
  if (!fs.existsSync(OPS_BASELINE)) return {};
  const j = JSON.parse(fs.readFileSync(OPS_BASELINE, 'utf8'));
  return j.ops || {};
}

function opDrift(baseline, ops) {
  const errors = [];
  const added = [];
  for (const [name, id] of Object.entries(baseline)) {
    if (!(name in ops)) errors.push(`GPS_OP_${name} (id ${id}) DISAPPEARED — op ids are append-only`);
    else if (ops[name] !== id) errors.push(`GPS_OP_${name} changed ${id} -> ${ops[name]} — op ids are append-only`);
  }
  const used = new Map(Object.entries(baseline).map(([n, id]) => [id, n]));
  for (const [name, id] of Object.entries(ops)) {
    if (name in baseline) continue;
    if (used.has(id)) errors.push(`GPS_OP_${name} reuses id ${id}, which belonged to retired op ${used.get(id)}`);
    added.push(name);
  }
  return { errors, added };
}

function serializeBaseline(baseline, ops, added) {
  const out = Object.assign({}, baseline);
  for (const n of added) out[n] = ops[n];
  return JSON.stringify({
    _comment: [
      'APPEND-ONLY baseline of GPU stream v2 op ids (src/09a8gs-gpu-stream.wat).',
      'Written by tools/gen-gpu-stream.js; --check fails if an id changes or an op disappears.',
    ],
    ops: out,
  }, null, 2) + '\n';
}

// ── code generation ───────────────────────────────────────────────────────

function readerExpr(type, at) {
  switch (type) {
    case 'u8': return `v.getUint8(${at})`;
    case 's8': return `v.getInt8(${at})`;
    case 'u16': return `v.getUint16(${at}, true)`;
    case 's16': return `v.getInt16(${at}, true)`;
    case 'i32': case 'ptr': case 'weak': return `v.getUint32(${at}, true)`;
    case 'f32': return `v.getFloat32(${at}, true)`;
    case 'f64': return `v.getFloat64(${at}, true)`;
    case 'i64': return `v.getBigUint64(${at}, true)`;
    default:
      if (/^ptr/.test(type)) return `v.getUint32(${at}, true)`;
      throw new Error(`gen-gpu-stream: no decoder for field type '${type}'`);
  }
}

function decoderSource(name, L) {
  const lines = [];
  lines.push(`    ${name}(v, o) {`);
  lines.push(`      return {`);
  for (const f of L.fields) {
    if (f.count > 1) {
      const stride = f.size / f.count;
      const items = [];
      for (let i = 0; i < f.count; i++) items.push(readerExpr(f.type, `o + ${f.offset + i * stride}`));
      lines.push(`        ${f.name}: [${items.join(', ')}],`);
    } else {
      lines.push(`        ${f.name}: ${readerExpr(f.type, `o + ${f.offset}`)},`);
    }
  }
  lines.push(`      };`);
  lines.push(`    },`);
  return lines.join('\n');
}

function groupConstants(constants) {
  const groups = {};
  for (const [k, v] of Object.entries(constants)) {
    const i = k.indexOf('_');
    if (i < 0) continue;
    const g = k.slice(0, i);
    (groups[g] = groups[g] || {})[k.slice(i + 1)] = v;
  }
  return groups;
}

function render(model) {
  const { constants, layouts, ops, opLayout } = model;
  const groups = groupConstants(constants);
  const opNames = {};
  for (const [n, id] of Object.entries(ops)) opNames[id] = n;
  const J = (x) => JSON.stringify(x);
  const layoutLines = Object.keys(layouts).map((n) => {
    const L = layouts[n];
    const fields = L.fields.map((f) => `        ${J(f)},`).join('\n');
    return `    ${n}: Object.freeze({ size: ${L.size}, fields: Object.freeze([\n${fields}\n      ]) }),`;
  }).join('\n');
  const groupLines = Object.keys(groups).map((g) => `    ${g}: Object.freeze(${J(groups[g])}),`).join('\n');
  const decoders = Object.keys(layouts).map((n) => decoderSource(n, layouts[n])).join('\n');

  return `// GENERATED by tools/gen-gpu-stream.js from src/09a8gs-gpu-stream.wat — DO NOT EDIT.
//
// The JS mirror of the GPU stream v2 wire format (docs/gpu-stream-v2.md).
// Constants are the $GPS_* globals without the prefix; layouts and offsets
// come from the WATX compiler's own lowerIR. i32 fields decode UNSIGNED (ids,
// positions, sizes); a field with signed meaning (coordinates, depth_bias)
// is read with |0 by its consumer. To change the format, edit the WAT and run:
//     node tools/gen-gpu-stream.js
//
// Node: require('./gpu-stream.generated'); browser/workers: GpuStreamGenerated.
(function (root) {
  'use strict';

  const CONST = Object.freeze(${J(constants)});

  const GROUPS = {
${groupLines}
  };

  const OP_NAMES = Object.freeze(${J(opNames)});

  const LAYOUTS = Object.freeze({
${layoutLines}
  });

  // Payload layout of each op (WRAP has none).
  const OP_LAYOUT = Object.freeze(${J(opLayout)});

  // decode.Name(view, offset) -> plain object of that layout's fields.
  const decode = Object.freeze({
${decoders}
  });

  const api = Object.freeze(Object.assign({ CONST, OP_NAMES, LAYOUTS, OP_LAYOUT, decode }, GROUPS));
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GpuStreamGenerated = api;
})(typeof globalThis !== 'undefined' ? globalThis :
   typeof self !== 'undefined' ? self : this);
`;
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const model = readModel();
  const baseline = readBaseline();
  const { errors, added } = opDrift(baseline, model.ops);
  if (errors.length) {
    for (const e of errors) console.error(`gen-gpu-stream: ${e}`);
    console.error(`baseline: ${path.relative(ROOT, OPS_BASELINE)}`);
    process.exit(1);
  }
  const text = render(model);
  const baselineText = serializeBaseline(baseline, model.ops, added);
  if (check) {
    const stale = [];
    if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== text) stale.push(path.relative(ROOT, OUT));
    if (!fs.existsSync(OPS_BASELINE) || fs.readFileSync(OPS_BASELINE, 'utf8') !== baselineText)
      stale.push(path.relative(ROOT, OPS_BASELINE) + (added.length ? ` (new ops: ${added.join(', ')})` : ''));
    if (stale.length) {
      console.error(`gen-gpu-stream: STALE: ${stale.join('; ')}\nRegenerate with: node tools/gen-gpu-stream.js`);
      process.exit(1);
    }
    console.log(`gpu stream mirror OK — ${Object.keys(model.ops).length} ops, ${Object.keys(model.layouts).length} layouts`);
    return;
  }
  fs.writeFileSync(OUT, text);
  fs.writeFileSync(OPS_BASELINE, baselineText);
  console.log(`wrote ${path.relative(ROOT, OUT)} (${Object.keys(model.ops).length} ops, ` +
    `${Object.keys(model.layouts).length} layouts)` + (added.length ? `; appended ops: ${added.join(', ')}` : ''));
}

module.exports = { readModel };
if (require.main === module) main();
