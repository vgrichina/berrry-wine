'use strict';
// Source-only registration/scope check; does not compile or run guest code.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const cp = require('node:child_process');
const root = path.join(__dirname, '..');
const baseline = cp.execFileSync('git', ['show', '7c9434f1f202c00044f2edd6c7b3e331740b9960:lib/apps.js'], { cwd: root, encoding: 'utf8' });
const current = fs.readFileSync(path.join(root, 'lib/apps.js'), 'utf8');
function registry(source, browser) {
  const context = browser ? { window: {} } : { module: { exports: {} } };
  // Both paths omit optional download-size metadata so comparison is exact.
  vm.runInNewContext(source, context);
  return JSON.parse(JSON.stringify((browser ? context.window.wineApps : context.module.exports).APPS));
}
for (const browser of [false, true]) {
  const before = registry(baseline, browser), after = registry(current, browser);
  assert.equal(after.dungeon_siege_demo.reservedPageFaults, true);
  assert.equal(before.dungeon_siege_demo.reservedPageFaults, undefined);
  delete after.dungeon_siege_demo.reservedPageFaults;
  assert.deepEqual(after, before, 'All other app capabilities, assets and launch preferences stay identical');
}
console.log('PASS: CLI/browser Dungeon reserved-page registration; all other registry data unchanged.');
