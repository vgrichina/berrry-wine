'use strict';
// Real Node resolution with transient sealed inputs; no live dependency writes.
// (JS form of Codex's ad27fc08f test, which drove tools/lmarbles-supervisor.py
// from embedded python; the supervisor is tools/lmarbles-supervisor.cjs now.)
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const sup = require('../tools/lmarbles-supervisor.cjs');
const c = require('../tools/native-supervisor-common.cjs');

const root = path.resolve(__dirname, '..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
assert(!fs.existsSync(path.join(root, 'lib/__sealed_absent_dependency.js')));
const files = {
  'lib/__sealed_entry.js': "module.exports=require('./nested/../__sealed_absent_dependency')",
  'lib/__sealed_absent_dependency.js': "module.exports={value:42,json:require('./__sealed_data.json'),pkg:require('__sealed_pkg')}",
  'lib/__sealed_data.json': '{"pinned":true}',
  'node_modules/__sealed_pkg/package.json': '{"main":"dist/entry.js"}',
  'node_modules/__sealed_pkg/dist/entry.js': "module.exports='package-pinned'",
  // Real live file exists, but its bytes must never be compiled.
  'lib/host-imports.js': "module.exports='sealed-mismatch'",
  'lib/__sealed_escape.js': "require('../../outside-inventory.js')",
};
const rows = Object.entries(files).map(([p, s]) => {
  const b = Buffer.from(s);
  return { path: p, sha256: sha(b), body: b.toString('base64') };
});
const [packed, pin] = sup.indexedSource(rows);
const source = sup.seal('resolution-test', packed);
const fdPath = process.platform === 'linux' ? '/proc/self/fd/' + source : c.fdPath(source);
const env = { ...process.env,
  NODE_OPTIONS: '--require=' + path.join(root, 'tools/lmarbles-native-source-view.cjs'),
  LMARBLES_SOURCE_FD: fdPath, LMARBLES_SOURCE_INDEX_SHA256: pin };
const stdio = ['ignore', 'pipe', 'pipe'];
while (stdio.length <= source) stdio.push('ignore');
stdio[source] = source;
const run = code => {
  const r = spawnSync(process.execPath, ['-e', code], { cwd: root, env, stdio, encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' });
  return [r.status, r.stdout || '', r.stderr || ''];
};

let [rc, out, err] = run("const a=require('node:assert/strict');const m=require('./lib/__sealed_entry');" +
  "a.deepEqual(m,{value:42,json:{pinned:true},pkg:'package-pinned'});" +
  "a.equal(require.resolve('./lib/__sealed_absent_dependency')," + JSON.stringify(path.join(root, 'lib/__sealed_absent_dependency.js')) + ");" +
  "a.equal(require('./lib/host-imports.js'),'sealed-mismatch');console.log('PINNED_OK')");
assert(rc === 0 && out.includes('PINNED_OK'), JSON.stringify([rc, out, err]));
for (const request of ['./lib/process-desktop', './lib/__unlisted_absent', './lib/__sealed_escape']) {
  [rc, out, err] = run('require(' + JSON.stringify(request) + ')');
  assert(rc !== 0 && err.includes('unsealed runtime input'), JSON.stringify([request, rc, out, err]));
}
fs.closeSync(source);
console.log('PASS absent-live dependency, normalized relative import, JSON, package main, require.resolve, existing-live mismatch, outside-inventory refusal; actual Node waits and both EOFs');
