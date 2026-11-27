#!/usr/bin/env node
'use strict';
// Pure JS admission checks; no compiler, module, guest or original game files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kernel32-generator-'));
try {
  for (const folder of ['src', 'tools']) fs.mkdirSync(path.join(dir, folder));
  const files = ['src/kernel32-exports.json', 'src/api_table.json',
    'src/08-pe-loader.wat', 'tools/gen-kernel32-image.js', 'tools/kernel32-export-census.js',
    'tools/aw-census.js', 'tools/kernel32-wine-names.json'];
  for (const file of files) fs.copyFileSync(path.join(root, file), path.join(dir, file));
  const original = fs.readFileSync(path.join(dir, 'src/08-pe-loader.wat'), 'utf8');
  const manifest = require('../src/kernel32-exports.json');
  const apis = require('../src/api_table.json');
  const run = (...args) => spawnSync(process.execPath,
    [path.join(dir, 'tools/gen-kernel32-image.js'), ...args], { encoding: 'utf8' });
  assert.equal(run('--check').status, 0);
  for (const [ordinal,api] of [[35,'LoadLibrary16'],[36,'FreeLibrary16'],[37,'GetProcAddress16']])
    assert(manifest.exports.some(e => e.ordinal === ordinal && e.api === api && !e.name), 'implemented legacy ordinal');
  assert(manifest.exports.some(e => e.name === 'QT_Thunk' && e.api === 'QT_Thunk'));
  // Reindexing current API data must regenerate thunk IDs, not reuse history.
  const changed = apis.map(a => ({ ...a, id: a.id + 10000 }));
  fs.writeFileSync(path.join(dir, 'src/api_table.json'), JSON.stringify(changed));
  assert.notEqual(run('--check').status, 0, 'stale generated IDs rejected');
  assert.equal(run().status, 0);
  const regenerated = fs.readFileSync(path.join(dir, 'src/08-pe-loader.wat'), 'utf8');
  const emitted = [...regenerated.matchAll(/call \$kernel32_emit_export .*?\(i32.const (\d+)\) \(i32.const (\d+)\) \(i32.const (\d+)\)/g)];
  assert.equal(emitted.length, manifest.exports.length);
  for (const [, , ordinal, id] of emitted) {
    const item = manifest.exports.find(e => e.ordinal === Number(ordinal));
    assert.equal(Number(id), changed.find(a => a.name === item.api).id);
  }
  fs.writeFileSync(path.join(dir, 'src/08-pe-loader.wat'), original);
  fs.writeFileSync(path.join(dir, 'src/api_table.json'), JSON.stringify(apis));
  for (const [label, mutate] of [
    ['duplicate ordinal', m => { m.exports[1].ordinal = m.exports[0].ordinal; }],
    ['unknown API', m => { m.exports[0].api = 'MissingKernelAPI'; }],
    ['invalid ordinal', m => { m.exports[0].ordinal = 1025; }],
    ['duplicate name', m => { const named=m.exports.filter(e=>e.name); named[1].name = named[0].name; }],
    ['code overflow', m => { while (m.exports.length <= 2048) m.exports.push({ ...m.exports[0] }); }],
  ]) {
    const mutated = structuredClone(manifest); mutate(mutated);
    fs.writeFileSync(path.join(dir, 'src/kernel32-exports.json'), JSON.stringify(mutated));
    assert.notEqual(run().status, 0, label);
    assert.equal(fs.readFileSync(path.join(dir, 'src/08-pe-loader.wat'), 'utf8'), original,
      'rejected manifest must not partially rewrite source');
  }
  console.log('PASS KERNEL32 generator: current IDs, stale output and five invalid-manifest controls');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
