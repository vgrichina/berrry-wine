'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
let source = fs.readFileSync(path.join(__dirname, 'independent-original.cjs'), 'utf8');
assert.equal(crypto.createHash('sha256').update(source).digest('hex'), '9109256868d2eb66ff936072b897220ca42f99577f25a885ff0dc51b554b9677');
const changes = [
  [
    "b360f892416309bc0f492ff77da5f939ee93af0c53585a7629c035eb8b7ecfc3",
    "4c1ce40b92aa990a4bc689bd98d5c0d92ab3af44dafeb93ca52ccbaf2c6124f7"
  ],
  [
    "pre-existing boundary: empty vfsPaths host fallback differs from policy (outside new assertions)",
    "repaired boundary: empty vfsPaths host fallback agrees with policy"
  ],
  [
    "assert.equal(classify(file, names).httpRange, true, 'existing policy treats [] as no paths');",
    "assert.equal(classify(file, names), file, 'empty aliases fall back to the actual mounted path');"
  ]
];
if (process.env.ADAPT_REPAIRED === '1') for (const [from, to] of changes) {
  assert.equal(source.split(from).length, 2, 'exact unique adaptation');
  source = source.replace(from, to);
}
const filename = path.resolve(__dirname, '../repo/test/app-files-url-contract-independent-oct26.test.cjs');
const fixture = new Module(filename, module);
fixture.filename = filename;
fixture.paths = Module._nodeModulePaths(path.dirname(filename));
fixture._compile(source, filename);
