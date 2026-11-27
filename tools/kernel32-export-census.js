#!/usr/bin/env node
'use strict';
// KERNEL32 export census: every implemented API that Wine places in KERNEL32
// must be named in src/kernel32-exports.json, or GetProcAddress (and the
// packers/unpackers that resolve their whole import table through it) cannot
// find it. HeidiSQL's UPX-style stub calls ExitProcess(0) on the first NULL.
//
//   node tools/kernel32-export-census.js           report
//   node tools/kernel32-export-census.js --check   build gate: exit 1 on a gap
//   node tools/kernel32-export-census.js --fix     append the gaps to the
//        manifest with the next free emulator-ABI ordinals; then run
//        node tools/gen-kernel32-image.js
//   node tools/kernel32-export-census.js --refresh-wine=PATH/kernel32.spec
//        rewrite tools/kernel32-wine-names.json from a Wine spec file
//
// "Implemented" means: the API id's case in 09b2-dispatch-table.generated.wat
// calls a $handle_X, and X is not a direct fail-fast handler (a body of at most
// six lines that calls $crash_unimplemented). A partial handler that traps on
// an unsupported branch is implemented: GetProcAddress must find it so the
// trap names it, instead of the app failing on a NULL with no trail.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { collectHandlers, callsOf } = require('./aw-census');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(ROOT, 'src/kernel32-exports.json');
const WINE = path.join(__dirname, 'kernel32-wine-names.json');
const DISPATCH = path.join(ROOT, 'src/09b2-dispatch-table.generated.wat');

function wineNamesFromSpec(text) {
  const names = new Set();
  for (const line of text.split('\n')) {
    if (!/^(@|\d+)\s/.test(line)) continue;
    const tokens = line.split(/\s+/).slice(2).filter(t => !t.startsWith('-'));
    const name = (tokens[0] || '').split('(')[0];
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) names.add(name);
  }
  return [...names].sort();
}

function dispatchTargets(text) {
  const out = new Map();
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/;; (\d+): (\S+)\s*$/);
    if (!m) continue;
    const call = (lines[i + 1] || '').match(/^\s*\(call \$handle_([A-Za-z0-9_]+) /);
    out.set(m[2], call ? call[1] : null);
  }
  return out;
}

// The build runs this inside gen-kernel32-image.js --check with the manifest
// and API table that process already holds, so the gate costs no process and
// no tree read: dispatch and handler sources are read only when a Wine name
// with an API id is missing from the manifest (none, in a passing tree).
function census(manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')),
  apis = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/api_table.json'), 'utf8'))) {
  const wine = new Set(JSON.parse(fs.readFileSync(WINE, 'utf8')).names);
  const exported = new Set(manifest.exports.map(e => e.api));
  const candidates = apis.filter(api => wine.has(api.name) && !exported.has(api.name));
  const missing = [], failFast = [];
  if (!candidates.length) return { manifest, missing, failFast };
  const targets = dispatchTargets(fs.readFileSync(DISPATCH, 'utf8'));
  const handlers = collectHandlers(path.join(ROOT, 'src'));
  for (const api of candidates) {
    const target = targets.get(api.name);
    const h = target && handlers.get(target);
    if (!h) { failFast.push(api.name); continue; }
    if (callsOf(h).has('crash_unimplemented') && h.lines <= 6) { failFast.push(api.name); continue; }
    missing.push(api.name);
  }
  return { manifest, missing, failFast };
}

function fix(manifest, missing) {
  let ordinal = Math.max(...manifest.exports.map(e => e.ordinal));
  const text = fs.readFileSync(MANIFEST, 'utf8');
  const close = text.lastIndexOf(']');
  const head = text.slice(0, close).replace(/\s*$/, '');
  const added = missing.map(name => `    { "name": "${name}", "api": "${name}", "ordinal": ${++ordinal} }`);
  if (ordinal > 1024) throw new Error('KERNEL32 ordinal space (1..1024) exhausted');
  fs.writeFileSync(MANIFEST, `${head},\n${added.join(',\n')}\n  ${text.slice(close)}`);
}

function main() {
  const refresh = process.argv.find(a => a.startsWith('--refresh-wine='));
  if (refresh) {
    const file = refresh.split('=')[1];
    const text = fs.readFileSync(file, 'utf8');
    const old = JSON.parse(fs.readFileSync(WINE, 'utf8'));
    const names = wineNamesFromSpec(text);
    fs.writeFileSync(WINE, '{\n' +
      `  "source": ${JSON.stringify(old.source)},\n` +
      `  "sourceSha256": "${crypto.createHash('sha256').update(text).digest('hex')}",\n` +
      `  "note": ${JSON.stringify(old.note)},\n` +
      '  "names": [\n' + names.map(n => `    "${n}"`).join(',\n') + '\n  ]\n}\n');
    console.log(`kernel32-wine-names.json: ${names.length} names`);
    return;
  }
  const { manifest, missing, failFast } = census();
  if (process.argv.includes('--fix')) {
    if (missing.length) fix(manifest, missing);
    console.log(`kernel32 exports: appended ${missing.length}: ${missing.join(' ')}`);
    return;
  }
  if (missing.length) {
    console.error(`kernel32-export-census: ${missing.length} implemented KERNEL32 API(s) not exported ` +
      `(GetProcAddress cannot find them): ${missing.join(' ')}\n` +
      '  fix: node tools/kernel32-export-census.js --fix && node tools/gen-kernel32-image.js');
    if (process.argv.includes('--check')) process.exitCode = 1;
    return;
  }
  console.log(`kernel32 exports OK: ${manifest.exports.length} exported, every implemented Wine-KERNEL32 API named` +
    ` (${failFast.length} fail-fast/unhandled ids left out)`);
}

if (require.main === module) main();
module.exports = { wineNamesFromSpec, dispatchTargets, census };
