#!/usr/bin/env node
'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// gen-gl-gps-declines.js — the GL GPS decline-reason names, machine-readable
//
// tl;dr
//   src/09a8gt-gl-gps.wat header table ";; Decline reasons ... ;; Readback sites"
//     (one row per code: "NN name<2+ spaces>executor growth", continuation
//      rows indented under the growth column)
//   --> lib/gl-gps-declines.generated.json   (native hosts copy this)
//   --> lib/gl-gps-declines.generated.js     (Node require / browser GlGpsDeclines)
//
//   node tools/gen-gl-gps-declines.js           regenerate
//   node tools/gen-gl-gps-declines.js --check   fail if either output is stale
//
// The comment table is the one source of truth: $glg_decline's callers pass
// these codes as literals, so the table is what a reader already maintains.
// The diagnostics contract around it (strict trap base, fail log tag, stat
// indices) is verified against the WAT text here, so a moved number fails
// the build rather than going stale in a host.
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'src', '09a8gt-gl-gps.wat');
const VS_SOURCE = path.join(ROOT, 'src', '09a8gv-gl-gps-vs.wat');
const OUT_JSON = path.join(ROOT, 'lib', 'gl-gps-declines.generated.json');
const OUT_JS = path.join(ROOT, 'lib', 'gl-gps-declines.generated.js');

function fail(msg) { console.error(`gen-gl-gps-declines: ${msg}`); process.exit(1); }

// One table: the rows after the line matching $head, up to the line
// matching $end.
function parseTable(text, head = /^\s*;; Decline reasons \(gl_gps_stat 16 \+ r\)/, end = /^\s*;; Readback sites/) {
  const lines = text.split('\n');
  const start = lines.findIndex(l => head.test(l));
  if (start < 0) fail(`no ${head} header in 09a8gt-gl-gps.wat`);
  const reasons = [];
  let last = null;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (end.test(l)) return reasons;
    const row = /^\s*;;\s{1,3}(\d+) (\S.*?)(?:\s{2,}(\S.*))?$/.exec(l);
    if (row) {
      const code = Number(row[1]);
      if (reasons.some(r => r.code === code)) fail(`decline code ${code} listed twice`);
      if (last && code <= last.code) fail(`decline code ${code} out of order after ${last.code}`);
      let name = row[2].trim(), growth = (row[3] || '').trim();
      // A row whose name ran into the growth column with one space ("11 unit
      // 1 on a line/point none (WAT: ...)"): the column's words start it.
      const run = !growth && /^(.*?) (none\b.*)$/.exec(name);
      if (run) { name = run[1]; growth = run[2]; }
      last = { code, name, executorGrowth: growth };
      reasons.push(last);
      continue;
    }
    const cont = /^\s*;;\s{4,}(\S.*)$/.exec(l);
    if (cont && last) { last.executorGrowth = (last.executorGrowth + ' ' + cont[1].trim()).trim(); continue; }
    fail(`unparsable decline-table line ${i + 1}: ${l}`);
  }
  fail(`decline table has no ${end} terminator`);
}

// The contract hosts depend on, each checked against the WAT text.
const CONTRACT = {
  strictTrapBase: 100,       // gl_gps_strict(1): $glg_fail(100 + reason)
  lostDepthFailCode: 20,     // $glg_fail(20): depth/stencil lost, no readback cap
  failLogTag: 0x474c4750,    // 'GLGP': $glg_fail logs this, then the code
  stats: {                   // gl_gps_stat(i)
    readbacks: 5, declines: 14, declinedFrames: 15, reasonBase: 16, dsReadbacks: 67,
    // Fixed-function T&L as a vertex shader (09a8gv): per-draw declines to
    // the CPU path at vsReasonBase + r (vsReasons), and its counters.
    // Unit 0's mip chain is 09a8gt's chain cache for both paths: textures
    // it created (mipChains) and level uploads (mipLevelUploads).
    vsDraws: 80, vsTriangles: 81, vsVertices: 82, vsBuilds: 84,
    cpuVertices: 86, vsReasonBase: 96, mipChains: 72, mipLevelUploads: 73,
  },
  exports: {
    gl_gps_strict: '(param i32)',
    gl_gps_last_decline: '(result i32)',
    gl_gps_last_decline_eip: '(result i32)',
    gl_gps_decline_seq: '(result i32)',
    gl_gps_readback_count: '(result i32)',
    gl_gps_stat: '(param i32) (result i32)',
    gl_gps_active: '(result i32)',
  },
};

function checkContract(text) {
  const need = (re, what) => { if (!re.test(text)) fail(`09a8gt-gl-gps.wat no longer matches the contract: ${what}`); };
  need(/\$glg_fail \(i32\.add \(i32\.const 100\) \(local\.get \$why\)\)/, 'strict trap $glg_fail(100 + why)');
  need(/\$glg_fail \(i32\.const 20\)/, 'lost-depth $glg_fail(20)');
  need(/\(call \$host_log_i32 \(i32\.const 0x474c4750\)\)/, "fail log tag 0x474c4750");
  need(/\$glg_stat \(i32\.const 14\) \(i32\.const 1\)/, 'stat 14 = declines');
  need(/\$glg_stat \(i32\.const 15\) \(i32\.const 1\)/, 'stat 15 = frames with a decline');
  need(/\$glg_stat \(i32\.add \(i32\.const 16\) \(local\.get \$why\)\)/, 'stat 16 + reason');
  need(/\$glg_stat \(i32\.const 5\) \(i32\.const 1\)/, 'stat 5 = colour readbacks');
  need(/\$glg_stat \(i32\.const 67\) \(i32\.const 1\)/, 'stat 67 = depth/stencil readbacks');
  need(/\$glg_stat \(i32\.const 72\) \(i32\.const 1\)/, 'stat 72 = mip chains created');
  need(/\$glg_stat \(i32\.const 73\) \(i32\.const 1\)/, 'stat 73 = mip chain level uploads');
  const vs = fs.readFileSync(VS_SOURCE, 'utf8');
  const needVs = (re, what) => { if (!re.test(vs)) fail(`09a8gv-gl-gps-vs.wat no longer matches the contract: ${what}`); };
  needVs(/\$glg_stat \(i32\.add \(i32\.const 96\) \(local\.get \$why\)\)/, 'stat 96 + VS reason');
  needVs(/\$glg_stat \(i32\.const 86\) \(local\.get \$n\)/, 'stat 86 = CPU-path vertices');
  for (const i of [80, 81, 82, 84]) needVs(new RegExp(`\\$glg_stat \\(i32\\.const ${i}\\)`), `stat ${i}`);
  for (const [name, sig] of Object.entries(CONTRACT.exports)) {
    const esc = sig.replace(/[()]/g, '\\$&').replace(/ /g, '\\s+');
    const re = new RegExp(`\\(func \\(export "${name}"\\)\\s+(?:\\(param \\$\\w+ i32\\)\\s*)?` + (sig.includes('result') ? '\\(result i32\\)' : ''));
    if (!re.test(text)) fail(`export ${name} ${sig} not found (signature ${esc})`);
  }
}

function build() {
  const text = fs.readFileSync(SOURCE, 'utf8');
  const reasons = parseTable(text);
  if (reasons.length < 20) fail(`only ${reasons.length} decline rows parsed`);
  const vsReasons = parseTable(text, /^\s*;; VS-path declines \(gl_gps_stat 96 \+ r\)/, /^\s*;; VS-path stats/);
  if (vsReasons.length < 10) fail(`only ${vsReasons.length} VS-path decline rows parsed`);
  checkContract(text);
  const model = {
    _comment: 'GENERATED by tools/gen-gl-gps-declines.js from src/09a8gt-gl-gps.wat - DO NOT EDIT.',
    source: 'src/09a8gt-gl-gps.wat',
    ...CONTRACT,
    reasons,
    vsReasons,
  };
  const json = JSON.stringify(model, null, 2) + '\n';
  const js = [
    '// GENERATED by tools/gen-gl-gps-declines.js from src/09a8gt-gl-gps.wat — DO NOT EDIT.',
    '//',
    '// GL GPS software-fallback reasons and the diagnostics contract around them',
    '// (gl_gps_strict / gl_gps_last_decline* exports, stat indices). The same',
    '// data is lib/gl-gps-declines.generated.json for native hosts. To change a',
    '// name, edit the table at the top of the WAT and run:',
    '//     node tools/gen-gl-gps-declines.js',
    '//',
    "// Node: require('./gl-gps-declines.generated'); browser: GlGpsDeclines.",
    '(function (root) {',
    "  'use strict';",
    `  const MODEL = ${JSON.stringify(model)};`,
    '  const BY_CODE = Object.freeze(Object.fromEntries(MODEL.reasons.map(r => [r.code, Object.freeze(r)])));',
    '  // Short display name for a reason code (or arm-off code); never throws.',
    "  const name = code => (BY_CODE[code] ? BY_CODE[code].name : `reason ${code}`);",
    '  const VS_BY_CODE = Object.freeze(Object.fromEntries(MODEL.vsReasons.map(r => [r.code, Object.freeze(r)])));',
    '  // The same for a VS-path decline (gl_gps_stat vsReasonBase + code).',
    "  const vsName = code => (VS_BY_CODE[code] ? VS_BY_CODE[code].name : `VS reason ${code}`);",
    '  const api = Object.freeze({ ...MODEL, BY_CODE, name, VS_BY_CODE, vsName });',
    "  if (typeof module !== 'undefined' && module.exports) module.exports = api;",
    '  else root.GlGpsDeclines = api;',
    "})(typeof globalThis !== 'undefined' ? globalThis : this);",
    '',
  ].join('\n');
  return { json, js };
}

const { json, js } = build();
if (process.argv.includes('--check')) {
  const stale = [[OUT_JSON, json], [OUT_JS, js]].filter(([f, want]) =>
    !fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== want).map(([f]) => path.relative(ROOT, f));
  if (stale.length) fail(`stale: ${stale.join(', ')} — run node tools/gen-gl-gps-declines.js`);
} else {
  fs.writeFileSync(OUT_JSON, json);
  fs.writeFileSync(OUT_JS, js);
  console.log(`wrote ${path.relative(ROOT, OUT_JSON)} and ${path.relative(ROOT, OUT_JS)} (${JSON.parse(json).reasons.length} reasons)`);
}
