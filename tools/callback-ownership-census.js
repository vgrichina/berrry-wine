#!/usr/bin/env node
'use strict';

// Source inventory, not a claim that callbacks are already instrumented.
// --dump emits UNREVIEWED entries; there is intentionally no --record switch.
// The separate nonlocal gate stays closed until retained-context ownership is
// implemented. An EIP-write count or sync depth is not an invocation identity.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseSource } = require('./watx');
const ROOT = path.resolve(__dirname, '..');
const CENSUS = path.join(__dirname, 'callback-ownership-census.json');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const head = node => Array.isArray(node) ? node[1] : null;
// An export clause names a string; a bare `(export)` is a WATX advice
// selector (src/13a-export-guards.wat), not an export.
const isExportClause = node => head(node) === 'export' && typeof node[2] === 'string' && node[2].startsWith('"');
function walk(node, visit) {
  if (!Array.isArray(node)) return;
  visit(node);
  for (const child of node.slice(2)) walk(child, visit);
}
// Drop parser source positions, retaining strings, operands and ordering.
const canonical = node => Array.isArray(node) ? node.slice(1).map(canonical) : node;
function scanWat(src, file) {
  return scanWatForms(parseSource(src, file), file);
}
function scanWatForms(forms, file) {
  const entries = [];
  for (const form of forms) {
    const writes = [];
    const calls = [];
    const exports = [];
    const ownershipWrites = [];
    walk(form, node => {
      if (head(node) === 'global.set' && node[2] === '$eip') writes.push(node);
      if (head(node) === 'global.set' && (String(node[2]).startsWith('$invocation_') ||
          ['$qsort_owner', '$qsort_depth', '$bsearch_owner', '$bsearch_depth', '$crt_callback_owner', '$crt_callback_depth', '$mm_callback_owner', '$mm_callback_depth'].includes(node[2]))) ownershipWrites.push(node[2]);
      if (head(node) === 'call') calls.push(node[2]);
      if (isExportClause(node)) exports.push(JSON.parse(node[2]));
    });
    const boundaryCalls = calls.filter(name =>
      ['$run', '$sync_depth_enter', '$sync_depth_leave'].includes(name) || name.startsWith('$invocation_') || name.startsWith('$crt_callback_'));
    if (!writes.length && !boundaryCalls.length && !ownershipWrites.length &&
        !['$sync_depth_enter', '$sync_depth_leave'].includes(form[2]) &&
        !(head(form) === 'func' && (String(form[2]).startsWith('$invocation_') ||
          String(form[2]).startsWith('$crt_callback_') || ['$qsort_frame_at', '$bsearch_frame_at'].includes(form[2])))) continue;
    // Includes macro bodies and top-level forms: moving a write out of a func
    // does not remove it from this inventory.
    const name = typeof form[2] === 'string' && form[2].startsWith('$')
      ? form[2] : exports.length ? `export:${exports[0]}` : `form:${entries.length}`;
    entries.push({ file, name, writes: writes.length, boundaryCalls, exports,
      targets: writes.map(node => canonical(node[3])),
      ...(ownershipWrites.length ? { ownershipWrites } : {}),
      sha256: hash(JSON.stringify(canonical(form))) });
  }
  return entries;
}
function sourceFiles(root) {
  const files = fs.readdirSync(path.join(root, 'src')).filter(f => /\.watx?$/.test(f))
    .map(f => `src/${f}`);
  const addJS = dir => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const file = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory() && dir) addJS(file);
      else if (entry.isFile() && /\.js$/.test(file)) files.push(file);
    }
  };
  addJS('');
  addJS('lib');
  return files.sort();
}
// Conservative lexical search also sees bracket-property strings and aliases
// obtained by destructuring. Whole JS files are pinned so moving/reordering a
// begin/end or exception path cannot pass merely by keeping the same count.
function scanSources(sources) {
  const entries = [];
  // Exports can inject a context by calling a helper without spelling an EIP
  // write themselves. Compute direct-call reachability to all inventoried
  // boundaries, including recursive call graphs; pin each such wrapper too.
  const functions = new Map();
  for (const { file, src } of sources.filter(s => /\.watx?$/.test(s.file))) {
    const forms = parseSource(src, file);
    entries.push(...scanWatForms(forms, file));
    for (const form of forms) {
      if (head(form) !== 'func') continue;
      const calls = [], exports = [];
      walk(form, node => {
        if (head(node) === 'call' || head(node) === 'return_call') calls.push(node[2]);
        if (isExportClause(node)) exports.push(JSON.parse(node[2]));
      });
      const name = typeof form[2] === 'string' ? form[2] : `export:${exports[0]}`;
      // Keep the complete graph, but not every parsed file's AST. Seal
      // exported wrappers while their forms are live; unexported graph nodes
      // need only names and edges for the same fixed-point reachability.
      functions.set(name, { file, name, calls, exports,
        sha256: exports.length ? hash(JSON.stringify(canonical(form))) : undefined });
    }
  }
  const reaches = new Set(entries.map(entry => entry.name));
  let changed = true;
  while (changed) {
    changed = false;
    for (const fn of functions.values()) {
      if (!reaches.has(fn.name) && fn.calls.some(name => reaches.has(name))) {
        reaches.add(fn.name); changed = true;
      }
    }
  }
  const inventoried = new Set(entries.map(key));
  for (const fn of functions.values()) {
    if (!fn.exports.length || !reaches.has(fn.name) || inventoried.has(key(fn))) continue;
    entries.push({ file: fn.file, name: fn.name, writes: 0, boundaryCalls: fn.calls,
      exports: fn.exports, targets: [], sha256: fn.sha256 });
  }
  const names = new Set(['init_thread', 'load_pe', 'load_ne', 'run']);
  for (const entry of entries) for (const name of entry.exports) {
    if (!name.startsWith('test_')) names.add(name);
  }
  const escaped = [...names].map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const otherNames = escaped.filter(n => n !== 'run').join('|');
  const hostBoundary = new RegExp(`${otherNames ? `\\b(${otherNames})\\b|` : ''}(?:\\.\\s*run\\s*\\(|["']run["'])`);
  for (const { file, src } of sources.filter(s => /\.js$/.test(s.file))) {
    if (hostBoundary.test(src)) entries.push({ file, name: 'host-file',
      sha256: hash(src) });
  }
  return entries.sort((a, b) => key(a).localeCompare(key(b)));
}
const key = entry => `${entry.file}:${entry.name}`;
const kinds = new Set(['guest-control', 'lifecycle', 'callback', 'continuation',
  'mixed-dispatch', 'context-restore', 'host-entry', 'test-entry']);
function check(entries, census, revisions = { version: 1, revisions: [] }) {
  const errors = [];
  if (census.version !== 1) errors.push('unsupported census version');
  const expected = new Map();
  // Feature-owned new producers can be reviewed without adopting unrelated
  // shared-worktree edits to the base census. They undergo every existing
  // kind, lifetime, hash and producer-shape check, including duplicate refusal.
  const additions = revisions.additions === undefined ? [] : revisions.additions;
  if (!Array.isArray(additions)) errors.push('invalid producer additions');
  for (const entry of [...(census.entries || []), ...(Array.isArray(additions) ? additions : [])]) {
    const id = key(entry);
    if (expected.has(id)) errors.push(`duplicate inventory entry ${id}`);
    expected.set(id, entry);
    if (!kinds.has(entry.kind) || !entry.reason) errors.push(`unreviewed producer ${id}`);
    if (entry.ownership !== 'pending') errors.push(`unsupported ownership assertion ${id}`);
  }
  // Independent hash-anchored reviews let a feature revise its own producers
  // without absorbing unrelated shared-worktree inventory edits. These do not
  // grant invocation ownership or change any producer shape/lifetime assertion.
  if (revisions.version !== 1 || !Array.isArray(revisions.revisions)) {
    errors.push('unsupported producer review revisions');
  } else {
    const revised = new Set();
    for (const review of revisions.revisions) {
      const id = key(review), known = expected.get(id);
      if (revised.has(id) || !known || review.baseSHA256 !== known.sha256 ||
          !/^[a-f0-9]{64}$/.test(review.sha256 || '') || (typeof review.reason !== 'string' || !review.reason.trim()) ||
          Object.keys(review).some(k => !['file', 'name', 'baseSHA256', 'sha256', 'reason'].includes(k))) {
        errors.push(`invalid anchored producer review ${id}`);
        continue;
      }
      revised.add(id);
      expected.set(id, { ...known, sha256: review.sha256 });
    }
  }
  for (const entry of entries) {
    const id = key(entry), known = expected.get(id);
    if (!known) errors.push(`unknown producer ${id}`);
    else {
      for (const field of ['sha256', 'writes', 'boundaryCalls', 'exports', 'targets', 'ownershipWrites']) {
        if (JSON.stringify(entry[field]) !== JSON.stringify(known[field])) {
          errors.push(`changed producer ${id} (${field}); review its lifetime`);
        }
      }
      expected.delete(id);
    }
  }
  for (const id of expected.keys()) errors.push(`stale producer ${id}`);
  return errors;
}
// Temporary prerequisite REVIEW LOCK, not a runtime safety mechanism. Remove
// together with actual ownership instrumentation + negative/dual-entry tests.
function checkNonlocalAPIs(sources, api = []) {
  const errors = [];
  if (api.some(row => ['_setjmp', 'longjmp'].includes(row.name))) {
    errors.push('nonlocal API registration requires complete invocation ownership and dual-dispatch conformance');
  }
  for (const { file, src } of sources) {
    if (!/\.watx?$/.test(file)) continue;
    for (const form of parseSource(src, file)) {
      if (head(form) === 'func' && ['$handle__setjmp', '$handle_longjmp'].includes(form[2])) {
        errors.push(`${file}: nonlocal handler requires complete invocation ownership and dual-dispatch conformance`);
      }
    }
  }
  return errors;
}
// Separate feature reviews avoid committing unrelated shared-worktree registry
// edits. Each step must anchor the preceding reviewed hash; check() still
// validates the resulting review against the base inventory and producer shape.
function chainReviews(base, steps, census = {entries: []}) {
  const result = JSON.parse(JSON.stringify(base));
  if (result.version !== 1 || !Array.isArray(result.revisions)) throw Error('invalid base reviews');
  for (const step of steps) {
    if (step.version !== 1 || !Array.isArray(step.revisions) ||
        (step.additions !== undefined && !Array.isArray(step.additions)) ||
        Object.keys(step).some(k => !['version', 'revisions', 'additions'].includes(k))) throw Error('invalid feature reviews');
    for (const addition of step.additions || []) {
      if ([...census.entries, ...(result.additions || [])].some(e => key(e) === key(addition)) ||
          !kinds.has(addition.kind) || !addition.reason?.trim() || addition.ownership !== 'pending' ||
          !/^[a-f0-9]{64}$/.test(addition.sha256 || '')) throw Error(`invalid feature addition ${key(addition)}`);
      (result.additions ||= []).push(JSON.parse(JSON.stringify(addition)));
    }
    const seen = new Set();
    for (const review of step.revisions) {
      const id = key(review);
      let prior = result.revisions.find(r => key(r) === id);
      // A producer's first feature review anchors the immutable census itself.
      // Later feature reviews must still anchor the preceding reviewed hash.
      if (!prior) {
        const original = [...census.entries, ...(result.additions || [])].find(r => key(r) === id);
        if (original && original.sha256 === review.baseSHA256) {
          prior = {file: original.file, name: original.name,
            baseSHA256: original.sha256, sha256: original.sha256, reason: ''};
          result.revisions.push(prior);
        }
      }
      if (seen.has(id) || !prior || review.baseSHA256 !== prior.sha256 ||
          !/^[a-f0-9]{64}$/.test(review.sha256 || '') || !review.reason?.trim() ||
          Object.keys(review).some(k => !['file', 'name', 'baseSHA256', 'sha256', 'reason'].includes(k))) throw Error(`invalid feature review anchor ${id}`);
      seen.add(id);
      prior.sha256 = review.sha256;
      prior.reason += ' ' + review.reason;
    }
  }
  return result;
}
function loadReviews() {
  const directory = path.join(__dirname, 'callback-ownership-reviews');
  const steps = fs.existsSync(directory) ? fs.readdirSync(directory).filter(n => n.endsWith('.json')).sort().map(n => JSON.parse(fs.readFileSync(path.join(directory, n), 'utf8'))) : [];
  const reviews = chainReviews(JSON.parse(fs.readFileSync(path.join(__dirname, 'callback-ownership-revisions.json'), 'utf8')), steps,
    JSON.parse(fs.readFileSync(CENSUS, 'utf8')));
  return reviews;
}
function main() {
  const sources = sourceFiles(ROOT).map(file => ({ file, src: fs.readFileSync(path.join(ROOT, file), 'utf8') }));
  const entries = scanSources(sources);
  if (process.argv.includes('--dump')) {
    console.log(JSON.stringify({ version: 1, entries: entries.map(entry => ({ ...entry,
      kind: 'UNREVIEWED', reason: '', ownership: 'pending' })) }, null, 2));
    return;
  }
  const api = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/api_table.json'), 'utf8'));
  const reviews = loadReviews();
  const errors = check(entries, JSON.parse(fs.readFileSync(CENSUS, 'utf8')), reviews)
    .concat(checkNonlocalAPIs(sources, api));
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else console.log(`callback ownership census: ${entries.length} source boundaries unchanged; nonlocal APIs remain disabled (ownership pending)`);
}
if (require.main === module) main();
module.exports = { sourceFiles, scanWat, scanSources, check, checkNonlocalAPIs, chainReviews, loadReviews };
