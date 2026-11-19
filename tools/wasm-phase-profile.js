#!/usr/bin/env node

'use strict';

// Where does a run's CPU time go, by SUBSYSTEM rather than by function?
//
//   node tools/wasm-phase-profile.js <file.cpuprofile> [--window=START:END]
//                                    [--top=N] [--funcs] [--json]
//
// A V8 profile of this emulator is ~90% `wasm-function[N]` rows, and reading it
// one row at a time answers the wrong question. The interpreter, the x87, the
// address translator, the D3D9 rasterizer and the GDI rasterizer are all
// compiled into ONE wasm module, so "87% wasm" says nothing at all about
// whether the cost is emulating instructions or drawing pixels — which is the
// only distinction that decides what to optimize. This resolves every index
// through tools/func-index.js and sums self time into subsystems.
//
// `--window=START:END` (milliseconds from the first sample) slices one phase
// out of a profile that spans several. A run's boot, its intro and its menu
// have completely different shapes, and averaging them describes no moment the
// program is ever in.
//
// Two caveats worth stating out loud, because both produce confident nonsense:
// the index→name walk reads build/combined.wat, so it is only right if that
// file is from the same build as the profiled wasm; and V8 attributes inlined
// callees to their caller, so a small leaf that got inlined shows as zero.

const fs = require('fs');
const path = require('path');
const { scan } = require('./func-index');

const COMBINED = path.join(__dirname, '..', 'build', 'combined.wat');

// Subsystem rules, applied in order — first match wins, so put the specific
// prefixes above the general ones.
const BUCKETS = [
  ['d3d-raster', /^\$?d3d_software_|^\$?d3d_render_|^\$?d3d_/],
  ['gdi-raster', /^\$?(gdi_|host_gdi_|raster_|span_|blit_)/],
  ['interp-dispatch', /^\$?(next|branch_end|block_|cache_|decode|loop_match|thread_|dispatch_)/],
  ['mem-translate', /^\$?(g2w|w2g|gs\d+|gl\d+|guest_page_translate|guest_read|guest_write|mem_)/],
  // After mem-translate: gl32/gs32 are guest loads/stores, not OpenGL.
  ['gl-gps-producer', /^\$?(glg_|gps_)/],
  ['gl-wat', /^\$?(gl_|glu_|rast_|handle_gl|handle_wgl)/],
  ['uop-engine', /^\$?(uop_|uwc_|uc_|th_uop_)/],
  ['interp-regs-flags', /^\$?(set_reg|get_reg|flag_|get_zf|get_cf|get_sf|get_of|get_pf|get_af)/],
  ['interp-fpu', /^\$?(fpu_|th_fpu|x87)/],
  ['interp-handlers', /^\$?(th_|do_|alu|shift|string_op|rep_|mmx_)/],
  ['win32-api', /^\$?(handle_|win32_dispatch|api_)/],
  ['wasm-other', /./],
];

function bucketFor(name) {
  for (const [label, re] of BUCKETS) if (re.test(name)) return label;
  return 'wasm-other';
}

function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('usage: node tools/wasm-phase-profile.js <file.cpuprofile> [--window=START:END] [--top=N] [--funcs]');
    process.exit(2);
  }
  const arg = (n, d) => {
    const hit = args.find((a) => a.startsWith(`--${n}=`));
    return hit ? hit.slice(n.length + 3) : d;
  };
  const top = Number(arg('top', '20'));
  const window = arg('window', null);
  let lo = -Infinity; let hi = Infinity;
  if (window) {
    const [a, b] = window.split(':');
    lo = Number(a) || 0;
    hi = b === undefined || b === '' ? Infinity : Number(b);
  }

  const profile = JSON.parse(fs.readFileSync(file, 'utf8'));
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const samples = profile.samples || [];
  const deltas = profile.timeDeltas || [];

  let names = null;
  if (fs.existsSync(COMBINED)) {
    const { imports, defined } = scan(fs.readFileSync(COMBINED, 'utf8'));
    names = { imports, defined };
  }
  const nameOf = (idx) => {
    if (!names) return null;
    if (idx < names.imports.length) return names.imports[idx].name;
    const d = names.defined[idx - names.imports.length];
    return d ? d.name : null;
  };

  const byBucket = new Map();
  const byFunc = new Map();
  let total = 0; let js = 0; let wasm = 0;
  let clock = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const dt = i < deltas.length ? deltas[i] : 0;
    clock += dt > 0 ? dt : 0;
    const ms = dt > 0 ? dt / 1000 : 0;
    if (!ms) continue;
    const at = clock / 1000;
    if (at < lo || at > hi) continue;
    const n = nodes.get(samples[i]);
    if (!n) continue;
    const cf = n.callFrame;
    const fn = cf.functionName || '(anonymous)';
    const url = cf.url || '';
    const isWasm = fn.startsWith('wasm-function') || url.startsWith('wasm:');
    let label;
    let bucket;
    if (isWasm) {
      // A wasm built with `--names` reports the WAT function name directly, so
      // there is nothing to resolve. Only the canonical (nameless) build needs
      // the index walk, and that is the path that can be wrong about a stale
      // combined.wat — prefer the name section whenever it is there.
      const m = fn.match(/wasm-function\[(\d+)\]/);
      const resolved = m ? nameOf(Number(m[1])) : fn;
      label = m ? (resolved ? `${resolved} (#${m[1]})` : fn) : fn;
      bucket = bucketFor(resolved ? resolved.replace(/^\$/, '') : 'unknown');
      wasm += ms;
    } else {
      label = `${fn} [${url.split('/').pop()}]`;
      bucket = 'JS';
      js += ms;
    }
    total += ms;
    byBucket.set(bucket, (byBucket.get(bucket) || 0) + ms);
    byFunc.set(label, (byFunc.get(label) || 0) + ms);
  }

  if (!total) {
    console.error('no samples in that window (profile spans '
      + `0..${(clock / 1000).toFixed(0)}ms)`);
    process.exit(1);
  }
  const span = window ? `${lo}..${hi === Infinity ? (clock / 1000).toFixed(0) : hi}ms` : 'whole profile';
  console.log(`${path.basename(file)}  ${span}  ${total.toFixed(0)}ms CPU  `
    + `(wasm ${(wasm / total * 100).toFixed(1)}%  JS ${(js / total * 100).toFixed(1)}%)`);
  if (!names) console.log('WARNING: build/combined.wat missing — wasm indices unresolved');
  console.log('--- by subsystem ---');
  for (const [k, v] of [...byBucket].sort((a, b) => b[1] - a[1])) {
    console.log(`${v.toFixed(0).padStart(8)}ms  ${(v / total * 100).toFixed(1).padStart(5)}%  ${k}`);
  }
  if (args.includes('--funcs') || !args.includes('--no-funcs')) {
    console.log(`--- top ${top} functions (self) ---`);
    for (const [k, v] of [...byFunc].sort((a, b) => b[1] - a[1]).slice(0, top)) {
      console.log(`${v.toFixed(0).padStart(8)}ms  ${(v / total * 100).toFixed(1).padStart(5)}%  ${k}`);
    }
  }
}

if (require.main === module) main();

module.exports = { bucketFor, BUCKETS };
