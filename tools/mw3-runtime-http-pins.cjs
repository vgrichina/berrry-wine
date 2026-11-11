'use strict';
// Refresh preparation metadata only. The ordinary controller still checks the
// actual HTTP response before Chrome or native input can start.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function prepareHttpPins(pins, root) {
  assert(Array.isArray(pins.httpPins) && pins.httpPins.length, 'HTTP routes required');
  const routes = new Set();
  const httpPins = pins.httpPins.map(old => {
    assert(typeof old.url === 'string' && /^\/[a-zA-Z0-9_./-]+$/.test(old.url) &&
      !old.url.slice(1).split('/').some(part => !part || part === '.' || part === '..'),
    'literal static HTTP route required');
    assert(!routes.has(old.url), 'duplicate HTTP route');
    routes.add(old.url);
    const relative = old.url.slice(1);
    const select = name => {
      assert(Array.isArray(pins[name]), name + ' required');
      const rows = pins[name].filter(row => row.path === relative);
      assert.equal(rows.length, 1, 'exact staged HTTP input required: ' + relative);
      return rows[0];
    };
    const file = select('files'), upload = select('uploadFiles');
    const filename = path.join(root, relative);
    assert(fs.lstatSync(filename).isFile(), 'regular HTTP input required');
    const bytes = fs.readFileSync(filename), size = bytes.length, sha256 = sha(bytes);
    for (const row of [file, upload]) {
      assert.equal(row.size, size, 'staged HTTP input size: ' + relative);
      assert.equal(row.sha256, sha256, 'staged HTTP input SHA: ' + relative);
    }
    return {...old, size, sha256};
  });
  return {...pins, httpPins};
}

module.exports = {prepareHttpPins};
if (require.main === module) {
  assert(process.argv.length === 4 || process.argv.length === 5,
    'usage: node tools/mw3-runtime-http-pins.cjs INPUT_JSON NEW_OUTPUT_JSON [ROOT]');
  const [input, output] = process.argv.slice(2);
  assert.notEqual(path.resolve(input), path.resolve(output), 'preserve original pins');
  const root = process.argv[4] || path.resolve(__dirname, '..');
  const result = prepareHttpPins(JSON.parse(fs.readFileSync(input)), root);
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', {flag:'wx'});
}
