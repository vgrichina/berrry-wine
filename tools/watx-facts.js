#!/usr/bin/env node
'use strict';

// build/watx-facts.json — what the WATX compile already knew, as data.
//
// The compiler's pass 1 resolves every declaration in the closure: the region
// map as allocated, every (layout ...)/(layout-union ...)/(view ...)/(enum ...)
// lowered to offsets, the export/import/function/global index spaces and the
// data segments. Several build gates used to re-derive the same answers by
// re-parsing and re-expanding the whole 25 MB tree in their own process (4-6 s
// of CPU each). tools/build-compile-wat.js now asks the compiler for these
// facts (`compile(..., { facts: true })`, a generic WATX option) and writes
// them here; a gate reads them back with loadFreshFacts().
//
// FRESHNESS IS PROVED, NOT ASSUMED. The document records the SHA-256 of every
// src/*.wat(x) byte the compile read and of the compiler sources that read
// them. loadFreshFacts() re-hashes both and returns null on any difference —
// a missing file, an edited fragment, a new fragment, a compiler edit, a shaken
// (non-canonical) build. A caller that gets null computes the answer itself the
// way it always did, so a gate is never less correct for having the file and
// never depends on build order for correctness, only for speed.
//
// Schema: docs/watx-facts.md. `WINE_WATX_FACTS=0` forces every reader onto its
// own fallback (the A/B control for "the facts path changes nothing").
//
// CLI:
//   node tools/watx-facts.js            # fresh? and a one-line summary
//   node tools/watx-facts.js --json     # print the document if fresh

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DEFAULT_PATH = path.join(ROOT, 'build', 'watx-facts.json');
const SCHEMA = 'watx-facts';
const VERSION = 1;
const COMPILER_FILES = ['compiler-parser.js', 'compiler-stages.js', 'compiler-codegen.js', 'compiler.js'];

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function compilerFingerprint() {
  const h = crypto.createHash('sha256');
  for (const f of COMPILER_FILES) {
    h.update(f + '\0');
    h.update(fs.readFileSync(path.join(__dirname, 'watx-src', f)));
    h.update('\0');
  }
  return h.digest('hex');
}

function sourceHashes(dir = SRC) {
  const out = {};
  for (const f of fs.readdirSync(dir).sort()) {
    if (!/\.(wat|watx)$/.test(f)) continue;
    out[f] = sha256(fs.readFileSync(path.join(dir, f)));
  }
  return out;
}

// The document tools/build-compile-wat.js writes: the compiler's facts plus the
// build-side provenance needed to prove them current.
function buildFactsDocument(compilerFacts, closure, shake) {
  const inputs = {};
  for (const name of Object.keys(closure.inputs || {}).sort()) inputs[name] = closure.inputs[name];
  return {
    schema: SCHEMA,
    version: VERSION,
    generator: 'tools/build-compile-wat.js',
    entry: closure.entry || null,
    canonical: !shake,
    regionShake: shake ? shake.value : null,
    compiler: compilerFingerprint(),
    inputs,
    module: compilerFacts,
  };
}

function writeFacts(doc, file = DEFAULT_PATH) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(doc) + '\n');
  fs.renameSync(tmp, file);
}

// The facts, if and only if they describe the tree and compiler on disk now.
// Returns { facts, reason } — facts null with a reason when not usable.
function loadFacts(options = {}) {
  if (process.env.WINE_WATX_FACTS === '0') return { facts: null, reason: 'disabled by WINE_WATX_FACTS=0' };
  const file = options.file || DEFAULT_PATH;
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    return { facts: null, reason: `${path.relative(ROOT, file)} unreadable (${e.code || e.message})` };
  }
  if (!doc || doc.schema !== SCHEMA || doc.version !== VERSION) return { facts: null, reason: 'schema/version mismatch' };
  if (!doc.canonical) return { facts: null, reason: 'facts are from a shaken (non-canonical) build' };
  if (doc.entry !== 'src/main.watx') return { facts: null, reason: `facts are for entry ${doc.entry}` };
  if (doc.compiler !== compilerFingerprint()) return { facts: null, reason: 'compiler sources changed since the facts were written' };
  const now = sourceHashes(options.srcDir);
  const a = Object.keys(now), b = Object.keys(doc.inputs || {});
  if (a.length !== b.length || a.some(k => doc.inputs[k] !== now[k])) {
    return { facts: null, reason: 'src/ changed since the facts were written' };
  }
  return { facts: doc, reason: null };
}

function loadFreshFacts(options) { return loadFacts(options).facts; }

// Lowered declarations in the exact shape lowerIR returns them (Maps rebuilt),
// so a consumer that used to call lowerIR({layoutsOnly:true}) can switch to the
// facts without touching the code that walks the records.
function loweredDeclarations(doc) {
  const m = doc.module;
  const out = [];
  for (const rec of m.declarations) {
    if (rec.type === 'layout-lowered') {
      out.push(Object.assign({}, rec, { fieldByName: new Map(rec.fields.map(f => [f.name, f])) }));
    } else if (rec.type === 'enum-lowered') {
      out.push(Object.assign({}, rec, { members: new Map(Object.entries(rec.members)) }));
    } else {
      out.push(rec);
    }
  }
  return out;
}

module.exports = {
  DEFAULT_PATH, SCHEMA, VERSION,
  buildFactsDocument, writeFacts, loadFacts, loadFreshFacts, loweredDeclarations, compilerFingerprint, sourceHashes,
};

if (require.main === module) {
  const { facts, reason } = loadFacts();
  if (process.argv.includes('--json')) {
    if (!facts) { console.error(`watx-facts: not fresh: ${reason}`); process.exit(1); }
    process.stdout.write(JSON.stringify(facts, null, 2) + '\n');
  } else if (!facts) {
    console.log(`watx-facts: not fresh: ${reason}`);
    process.exit(1);
  } else {
    const m = facts.module;
    console.log(`watx-facts: fresh — ${Object.keys(facts.inputs).length} inputs, ` +
      `${m.declarations.filter(d => d.type === 'layout-lowered').length} layouts, ` +
      `${m.regions ? m.regions.regions.length : 0} regions, ${m.functions.length} functions, ` +
      `${m.exports.length} exports, ${m.globals.length} globals, ${m.data.length} data segments`);
  }
}
