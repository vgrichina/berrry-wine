'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { verify } = require('../tools/gfx-runtime-coverage');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gfx-evidence-fixture-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifest = { version: 1, apps: [{ app: 'fixture-app', build: 'fixture-build-sha' }] };
  const evidence = { version: 1, records: ['software', 'webgl'].map(backend => {
    const bytes = `SYNTHETIC verifier fixture only: ${backend}\n`;
    const name = `${backend}.txt`;
    fs.writeFileSync(path.join(root, name), bytes);
    return { app: 'fixture-app', backend, build: 'fixture-build-sha', kind: 'runtime',
      run: `fixture-${backend}`, observation: 'Synthetic assertion; not actual gameplay.',
      artifact: { path: name, sha256: crypto.createHash('sha256').update(bytes).digest('hex') } };
  }) };
  return { root, manifest, evidence, check: () => verify(manifest, evidence, root) };
}

test('accepts two distinct synthetic records; deterministic output', t => {
  const f = fixture(t), result = f.check();
  assert.equal(result.complete, true);
  assert.deepEqual(result.apps[0].backends.map(x => x.status), ['accepted', 'accepted']);
  assert.deepEqual(f.check(), result);
});
test('missing backend remains missing', t => {
  const f = fixture(t); f.evidence.records.pop();
  assert.equal(f.check().complete, false);
  assert.equal(f.check().apps[0].backends[1].status, 'missing');
});
test('same bytes in separate files with distinct runs pass; hashes still checked', t => {
  const f = fixture(t);
  fs.copyFileSync(path.join(f.root, 'software.txt'), path.join(f.root, 'webgl.txt'));
  f.evidence.records[1].artifact.sha256 = f.evidence.records[0].artifact.sha256;
  const result = f.check();
  assert.equal(result.complete, true);
  assert.deepEqual(result.rejected, []);
  assert.deepEqual(result.apps[0].backends.map(x => x.status), ['accepted', 'accepted']);
  fs.appendFileSync(path.join(f.root, 'webgl.txt'), 'changed');
  const changed = f.check();
  assert.equal(changed.complete, false);
  assert.deepEqual(changed.rejected.map(x => x.reasons), [['artifact-sha256-mismatch']]);
});
const mutations = [
  ['duplicate pair rejects all candidates', f => f.evidence.records.push(structuredClone(f.evidence.records[0])), 'duplicate-app-backend'],
  ['missing backend', f => delete f.evidence.records[0].backend, 'unknown-or-missing-backend'],
  ['unknown backend', f => f.evidence.records[0].backend = 'opengl', 'unknown-or-missing-backend'],
  ['app mismatch', f => f.evidence.records[0].app = 'other-app', 'unknown-app'],
  ['build mismatch', f => f.evidence.records[0].build = 'other-build', 'build-mismatch'],
  ['missing build', f => delete f.evidence.records[0].build, 'build-mismatch'],
  ['static imports only', f => { f.evidence.records[0] = { app: 'fixture-app', backend: 'software', imports: ['glDrawArrays'] }; }, 'not-runtime-evidence'],
  ['static kind', f => f.evidence.records[0].kind = 'static-imports', 'not-runtime-evidence'],
  ['imports field cannot smuggle static census', f => f.evidence.records[0].imports = ['glDrawArrays'], 'invalid-record-schema'],
  ['missing observation', f => delete f.evidence.records[0].observation, 'missing-runtime-observation'],
  ['missing run', f => delete f.evidence.records[0].run, 'missing-run'],
  ['shared run', f => f.evidence.records[1].run = f.evidence.records[0].run, 'duplicate-run'],
  ['same artifact', f => f.evidence.records[1].artifact = structuredClone(f.evidence.records[0].artifact), 'reused-artifact'],
  ['artifact deleted', f => fs.unlinkSync(path.join(f.root, 'software.txt')), 'artifact-unavailable'],
  ['artifact changed', f => fs.appendFileSync(path.join(f.root, 'software.txt'), 'changed'), 'artifact-sha256-mismatch'],
  ['malformed hash', f => f.evidence.records[0].artifact.sha256 = 'bogus', 'invalid-artifact-schema'],
  ['directory artifact', f => f.evidence.records[0].artifact.path = '.', 'artifact-not-file'],
  ['symlink alias', f => { fs.symlinkSync('software.txt', path.join(f.root, 'alias')); f.evidence.records[1].artifact = { ...f.evidence.records[0].artifact, path: 'alias' }; }, 'reused-artifact'],
  ['outside-root symlink', f => { fs.symlinkSync(__filename, path.join(f.root, 'outside')); f.evidence.records[0].artifact.path = 'outside'; }, 'artifact-outside-root'],
  ['null record', f => f.evidence.records[0] = null, 'invalid-record-schema'],
];
for (const [name, mutate, reason] of mutations) test(name, t => {
  const f = fixture(t); mutate(f); const result = f.check();
  assert.equal(result.complete, false);
  assert.ok(result.rejected.some(row => row.reasons.includes(reason)), JSON.stringify(result));
  if (reason === 'duplicate-app-backend') {
    assert.equal(result.apps[0].backends[0].status, 'rejected');
    assert.equal(result.rejected.filter(row => row.reasons.includes(reason)).length, 2);
  }
});
test('manifest identities and schemas fail closed', t => {
  const f = fixture(t);
  for (const manifest of [null, { version: 1, apps: [] }, { version: 2, apps: f.manifest.apps },
    { version: 1, apps: [...f.manifest.apps, ...f.manifest.apps] },
    { version: 1, apps: [{ app: 'fixture-app' }] }]) {
    assert.throws(() => verify(manifest, f.evidence, f.root));
  }
  assert.throws(() => verify(f.manifest, [], f.root));
});
test('explicit additional expected app cannot disappear; apps sort by ID', t => {
  const f = fixture(t); f.manifest.apps.push({ app: 'a-missing-app', build: 'build' });
  const result = f.check(); assert.equal(result.complete, false);
  assert.equal(result.apps[0].app, 'a-missing-app');
  assert.deepEqual(result.apps[0].backends.map(x => x.status), ['missing', 'missing']);
});
test('CLI exit codes 0/1/2 and parseable deterministic JSON', t => {
  const f = fixture(t), tool = path.resolve(__dirname, '../tools/gfx-runtime-coverage.js');
  const manifestPath = path.join(f.root, 'manifest.json'), evidencePath = path.join(f.root, 'evidence.json');
  fs.writeFileSync(manifestPath, JSON.stringify(f.manifest));
  const run = () => spawnSync(process.execPath, ['--max-old-space-size=128', tool, manifestPath, evidencePath, f.root],
    { timeout: 5000, maxBuffer: 32768, encoding: 'utf8' });
  fs.writeFileSync(evidencePath, JSON.stringify(f.evidence));
  const good = run(); assert.equal(good.status, 0, good.stderr); assert.equal(JSON.parse(good.stdout).complete, true);
  assert.equal(run().stdout, good.stdout);
  fs.appendFileSync(path.join(f.root, 'software.txt'), 'tampered');
  const invalid = run(); assert.equal(invalid.status, 1);
  assert.ok(JSON.parse(invalid.stdout).rejected[0].reasons.includes('artifact-sha256-mismatch'));
  f.evidence.records.pop(); fs.writeFileSync(evidencePath, JSON.stringify(f.evidence));
  const missing = run(); assert.equal(missing.status, 1); assert.equal(JSON.parse(missing.stdout).complete, false);
  fs.writeFileSync(evidencePath, '{'); const malformed = run(); assert.equal(malformed.status, 2);
  assert.equal(JSON.parse(malformed.stdout).complete, false);
  fs.unlinkSync(evidencePath); assert.equal(run().status, 2);
  const help = spawnSync(process.execPath, [tool, '--help'], { encoding: 'utf8', timeout: 5000, maxBuffer: 32768 });
  assert.equal(help.status, 0); assert.match(help.stdout, /Usage:/);
  const noArgs = spawnSync(process.execPath, [tool], { encoding: 'utf8', timeout: 5000, maxBuffer: 32768 });
  assert.equal(noArgs.status, 2);
});
