'use strict';

// A portable on-disk closure for the actual CLI, never a mocked scanner/layout.
const fs = require('fs');
const path = require('path');
const dependencies = [
  'lib/compile-wat.js', 'lib/wat-manifest.js',
  'tools/check-region-decls.js', 'tools/region-layout.js', 'tools/watx.js',
  ...['compiler-parser.js', 'compiler-stages.js', 'compiler-codegen.js', 'compiler.js']
    .map(f => `tools/watx-src/${f}`),
];

function stage(repo, dest, census = path.join(repo, 'tools/region-census.js')) {
  fs.mkdirSync(dest, { recursive: true });
  for (const rel of dependencies) {
    fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true });
    fs.copyFileSync(path.join(repo, rel), path.join(dest, rel));
  }
  fs.copyFileSync(census, path.join(dest, 'tools/region-census.js'));
  const fixture = path.join(repo, 'test/fixtures/region-census-build-gates');
  fs.mkdirSync(path.join(dest, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'test'), { recursive: true });
  for (const f of ['00-regions.wat', '01-header.wat', 'main.watx']) {
    fs.copyFileSync(path.join(fixture, `${f}.txt`), path.join(dest, 'src', f));
  }
  fs.copyFileSync(path.join(fixture, 'host.js.txt'), path.join(dest, 'host.js'));
  fs.copyFileSync(path.join(fixture, 'baseline.json'), path.join(dest, 'tools/region-census.baseline.json'));
  return dest;
}

module.exports = { stage, dependencies };
