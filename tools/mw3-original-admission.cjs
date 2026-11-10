'use strict';
// Admission for the optional, single-original MW3 browser experiment. Validate
// the exact staged graph and completed private controls before starting it.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function verifyInputs(root, pins, requiredPaths) {
  assert(Array.isArray(requiredPaths) && requiredPaths.length, 'explicit runtime graph required');
  const files = new Map(pins.files.map(p => [p.path, p]));
  const uploads = new Map(pins.uploadFiles.map(p => [p.path, p]));
  for (const name of requiredPaths) {
    assert(!path.isAbsolute(name) && !name.split('/').includes('..'), 'relative input path');
    const pin = files.get(name), upload = uploads.get(name);
    assert(pin && upload, 'runtime input omitted from staged graph: ' + name);
    const bytes = fs.readFileSync(path.join(root, name));
    for (const record of [pin, upload]) {
      assert.equal(record.size, bytes.length, 'runtime input size: ' + name);
      assert.equal(record.sha256, sha(bytes), 'runtime input hash: ' + name);
    }
  }
  return true;
}

function admitOriginal({root, pins, requiredPaths, candidatePath, candidate,
    parent, production, chrome, expectedModule}) {
  verifyInputs(root, pins, requiredPaths);
  assert(requiredPaths.includes(candidatePath), 'candidate must belong to staged graph');
  assert.equal(candidate.passed, true, 'exact-candidate controls failed');
  assert.equal(candidate.exactCandidateSHA256, sha(fs.readFileSync(path.join(root, candidatePath))),
    'candidate controls belong to different source');
  assert.equal(parent.passed, true, 'private control parent failed');
  assert.equal(parent.originalLaunches, 0, 'control launched an original');
  assert(parent.rows.length, 'private control parent wait missing');
  for (const row of parent.rows) {
    assert.equal(row.code, 0, 'private control failed');
    assert.equal(row.actualParentWait, true, 'private control parent did not wait');
    assert.equal(row.readersJoined, true, 'private control readers not joined');
    assert.equal(row.separateEOF.stdout, true, 'control stdout EOF missing');
    assert.equal(row.separateEOF.stderr, true, 'control stderr EOF missing');
  }
  assert.equal(chrome.code, 0, 'control Chrome failed');
  assert.equal(chrome.signal, null, 'control Chrome was signalled');
  assert.equal(chrome.actualWait, true, 'control Chrome wait missing');
  assert.equal(chrome.separateEOF.stdout, true, 'Chrome stdout EOF missing');
  assert.equal(chrome.separateEOF.stderr, true, 'Chrome stderr EOF missing');
  assert.equal(production.passed, true, 'production Worker control failed');
  assert.equal(production.fixtureOnly, true);
  assert.match(expectedModule, /^[a-f0-9]{64}$/);
  assert.equal(production.moduleSHA256, expectedModule, 'production module changed');
  assert.deepEqual(production.controls.map(c => c.mode), ['unwrapped', 'inactive', 'active']);
  for (const c of production.controls) {
    assert.equal(c.isolated, true, 'production Worker isolation missing');
    assert.equal(c.state[12], 128, 'compiled pressed state missing');
    if (c.mode === 'unwrapped') continue;
    assert(c.installed && c.capture.beforeInstantiation, 'production recorder binding missing');
    assert.equal(c.trace.drops, 0); assert.deepEqual(c.trace.errors, []);
    assert.equal(c.trace.reads.length, 1);
    assert.equal(c.trace.reads[0].eax, 0);
    assert.equal(c.trace.reads[0].state[12], 128);
    assert(c.trace.imports.some(i => i.name === 'get_mouse_buttons_live'));
  }
  return {passed: true, candidateSHA256: candidate.exactCandidateSHA256, moduleSHA256: expectedModule};
}

module.exports = {verifyInputs, admitOriginal};

if (require.main === module) {
  // A nonzero exit must stop the caller before its sandbox commands API call.
  const run = path.resolve(process.argv[2]);
  const root = path.resolve(run, '../../..');
  const read = name => JSON.parse(fs.readFileSync(path.join(run, name)));
  const prefix = path.relative(root, run) + '/';
  const requiredPaths = ['browser.cjs', 'isolation-control.cjs', 'isolation-page.html',
    'worker-prefix.js', 'worker-fixture.js', 'control-launch.py', 'launch.py'].map(n => prefix + n);
  const pins = read('runtime-pins.json');
  verifyInputs(root, pins, requiredPaths);
  const results = read('private-control-results.json');
  const proof = admitOriginal({root, pins, requiredPaths, candidatePath:prefix+'browser.cjs',
    candidate:read('candidate-controls.json'), parent:results['control-parent-complete.json'],
    production:results['production-worker-repaired-production.json'],
    chrome:results['production-worker-repaired-actual-wait.json'],
    expectedModule:pins.files.find(p => p.path === 'build/wine-assembly.wasm').sha256});
  process.stdout.write(JSON.stringify(proof) + '\n');
}
