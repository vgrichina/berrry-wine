#!/usr/bin/env node
'use strict';
// Run from any checkout containing the historical fix and its regression.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');
const root = path.resolve(__dirname, '../..');
const git = (...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const fix = '47a5c9ab6f7baa698888ce979fec6306780fd5fe';
const main = process.argv[2] || 'origin/main';
git('merge-base', '--is-ancestor', fix, main);
const paths = ['tools/is5-extract.js', 'test/test-is5-extract-header-case.js'];
const blobs = {};
for (const file of paths) {
  blobs[file] = git('rev-parse', `${main}:${file}`);
  assert.strictEqual(blobs[file], git('rev-parse', `${fix}:${file}`));
  assert.strictEqual(fs.readFileSync(path.join(root, file), 'utf8').trim(),
    git('show', `${main}:${file}`));
}
const test = fs.readFileSync(path.join(root, paths[1]), 'utf8');
const extractor = require(path.join(root, paths[0]));
function regression(headerPath) {
  vm.runInNewContext(test, {
    require: name => name === '../tools/is5-extract' ? { headerPath } : require(name),
    console: { log() {} },
  }, { filename: paths[1] });
}
regression(extractor.headerPath);
// Recover the actual pre-fix filename expression, adapting its existsSync
// fallback to the helper's null convention. No production files are mutated.
const old = git('show', `${fix}^:${paths[0]}`);
const expression = old.match(/const hdr = (path\.join\(path\.dirname\(cab\),.*);/);
assert(expression, 'historical header expression exists');
const legacy = vm.runInNewContext(
  `(cab) => { const hdr = ${expression[1]}; return fs.existsSync(hdr) ? hdr : null; }`,
  { fs, path });
let failure;
try { regression(legacy); } catch (error) { failure = error; }
assert(failure && failure.code === 'ERR_ASSERTION',
  'existing regression must reject historical header selection');
assert.match(failure.message, /upper-case CD header/);
const source = fs.readFileSync(path.join(root, paths[0]), 'utf8');
assert.match(source, /const hdr = headerPath\(cab\);\s+const headerBuf = fs\.readFileSync\(hdr \|\| cab\);/,
  'CLI uses the tested helper and embedded-header fallback');
console.log(JSON.stringify({
  main: git('rev-parse', main), fix, blobs,
  positive: 'existing uppercase, mixed-case and absent-header regression passes',
  negative: failure.message,
  cliWiring: 'tested helper and embedded-header fallback present',
  scope: 'header selection only; no new archive extraction or runtime claim',
}, null, 2));
