'use strict';
// Source-only closure review: never execute a build gate or compile/instantiate
// WAT. Checks literal build/shell entry points and the reviewed external assets.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { prepare, verifyPlan } = require('./dungeon-siege-observer-plan');
function audit(plan) {
  const pins = new Set(plan.files.map(f => f.path)), scripts = new Set();
  function requireInput(file) {
    assert(pins.has(file), 'Unpinned build input: ' + file);
    assert(fs.existsSync(path.join(plan.root, file)), 'Missing build input: ' + file);
  }
  function shell(file) {
    requireInput(file);
    const source = fs.readFileSync(path.join(plan.root, file), 'utf8');
    for (const m of source.matchAll(/^\s*(?:if\s+!\s+)?(node|bash)\s+((?:tools|test)\/[^\s"'\\]+\.(?:js|sh))\b/gm)) {
      requireInput(m[2]); if (scripts.has(m[2])) continue; scripts.add(m[2]);
      if (m[1] === 'bash') shell(m[2]);
    }
  }
  shell('tools/build.sh');
  const external = ['CLAUDE.md', 'index.html', 'test/run-all.sh',
    'docs/dos-corpus/live/toyvm-bundle.js', 'docs/dos-corpus/live/toyvm-jit-bundle.js'];
  const bundle = fs.readFileSync(path.join(plan.root, 'tools/toyvm/bundle-browser.js'), 'utf8');
  const assets = bundle.match(/const ASSETS = \[([\s\S]*?)\];/); assert(assets, 'Review changed toy-VM asset declaration');
  const values = [...assets[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
  assert(values.length > 0, 'Review empty/dynamic toy-VM assets');
  for (const file of [...external, ...values]) requireInput(file);
  return { sourceOnly: true, entryScripts: [...scripts].sort(), externalInputs: [...external, ...values],
    scope: 'Literal build/shell entries and reviewed external gate assets. Broad src/lib/tools/data and test JS trees are separately blob-pinned. Generated combined.wat/modules are build outputs; no build/native execution by this audit.' };
}
if (require.main === module) {
  if (process.argv[2] === '--self-test') {
    const p = prepare('HEAD', path.join(__dirname, '..'));
    const r = audit(p);
    for (const omitted of ['test/run-all.sh', 'fonts/Terminal.fon', 'tools/check-test-timeouts.js', 'docs/dos-corpus/live/toyvm-jit-bundle.js']) {
      assert.throws(() => audit({ ...p, files: p.files.filter(f => f.path !== omitted) }), /Unpinned build input/);
    }
    console.log(`PASS source-only build-input audit: ${r.entryScripts.length} entries, ${r.externalInputs.length} external inputs; shell/font/nested-gate/bundle omission negatives.`);
  } else {
    const p = JSON.parse(fs.readFileSync(process.argv[2])); verifyPlan(p); console.log(JSON.stringify(audit(p), null, 2));
  }
}
module.exports = { audit };
