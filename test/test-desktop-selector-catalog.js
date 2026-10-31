'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { DESKTOP_APPS, LOCAL_CANDIDATE_APPS, DEBUG_ONLY_APPS } = require('../lib/apps');
const html = fs.readFileSync(process.argv[2] || require.resolve('../index.html'), 'utf8');
// Exercise the real selector population code without allocating a guest/browser.
const start = html.indexOf('    function initAppSelector()');
const body = start >= 0
  ? html.slice(start + '    function initAppSelector() {'.length, html.indexOf('\n    }\n    initAppSelector();', start))
  : html.slice(html.indexOf('      const sel = document.getElementById(\'app-select\');',
    html.indexOf('    function initDesktop()')), html.indexOf("      const grid = document.getElementById('desktop-icons');",
    html.indexOf('    function initDesktop()')));
assert(body.includes('selectorAppSet'), 'find the desktop selector initialization');

for (const [local, debug] of [[false, false], [true, false], [false, true], [true, true]]) {
  const catalog = DESKTOP_APPS.concat(debug ? DEBUG_ONLY_APPS : [], local ? LOCAL_CANDIDATE_APPS : []);
  const options = [...html.matchAll(/<option value="([^"]+)">([^<]*)<\/option>/g)]
    .map(([, value, textContent]) => ({ value, textContent,
      remove() { options.splice(options.indexOf(this), 1); } }));
  const select = {
    querySelectorAll: selector => selector === 'option' ? [...options] : [],
    appendChild: option => options.push(option),
    set value(value) { this.selected = options.find(o => o.value === value)?.value || ''; },
    get value() { return this.selected || ''; },
  };
  const context = { DEFAULT_APPS: DESKTOP_APPS, LOCAL_CANDIDATE_APPS, DEBUG_ONLY_APPS,
    DEBUG_MODE: debug, LOCAL_DESKTOP: local,
    selectorApps: catalog, selectorAppSet: new Set(catalog.map(a => a[0])),
    document: { getElementById: () => select, createElement: () => ({}) } };
  vm.runInNewContext(`(() => {${body}})()`, context);
  assert.deepEqual(new Set(options.map(o => o.value)), context.selectorAppSet,
    'every visible catalog app must be selectable, with no hidden apps');
  assert.equal(options.length, context.selectorAppSet.size, 'no duplicate options');
  for (const [value] of catalog) {
    select.value = value;
    assert.equal(select.value, value, `selection must retain ${value}`);
  }
  // Reinitialization must not duplicate options or lose the current selection.
  vm.runInNewContext(`(() => {${body}})()`, context);
  assert.equal(options.length, context.selectorAppSet.size);
  assert.equal(select.value, catalog.at(-1)[0]);
}
console.log('PASS desktop selector catalog: public, private candidates, debug, selection and idempotence');
