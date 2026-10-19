'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createReader} = require('./readers');

test('current supported inventory stays complete with a pinned older emulator and stale data manifest', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ops-inventory-'));
  t.after(() => fs.rm(temp, {recursive:true, force:true}));
  const root = path.join(temp, 'data'), inventoryRoot = path.join(temp, 'source'), emulatorRoot = path.join(temp, 'served');
  async function put(base, name, text) {
    const file = path.join(base, name);
    await fs.mkdir(path.dirname(file), {recursive:true});
    await fs.writeFile(file, text);
  }
  const registry = {...require('../lib/apps')};
  const manifest = require('../test/candidate-corpus/manifest.json');
  await put(root, 'test/candidate-corpus/manifest.json', '{"candidates":[]}');
  await put(root, 'ops/corpus-status.json', await fs.readFile(path.join(__dirname, 'corpus-status.json')));
  await put(inventoryRoot, 'test/candidate-corpus/manifest.json', JSON.stringify(manifest));
  // Serialized production registry keeps this test independent of guest binaries.
  await put(inventoryRoot, 'lib/apps.js', 'module.exports=' + JSON.stringify(registry));
  const ids = Object.keys(registry.APPS);
  const presentId = ids.find(id => id !== 'outlaws_demo');
  const missingId = ids.find(id => id !== 'outlaws_demo' && id !== presentId);
  await put(emulatorRoot, 'lib/apps.js', 'module.exports=' + JSON.stringify({APPS:{
    [presentId]:{exe:'test/binaries/present.exe'},
    [missingId]:{exe:'test/binaries/absent.exe'},
  }}));
  await put(emulatorRoot, 'test/binaries/present.exe', 'test fixture');
  const reader = createReader({root, inventoryRoot, emulatorRoot, codexRoot:false, claudeRoot:false, processes:false});
  const state = await reader.snapshot();
  const visible = new Set(state.candidates.flatMap(c => c.appIds || []));
  assert.deepEqual(ids.filter(id => !visible.has(id)), [], 'every current registered app has a row');
  for (const entry of manifest.candidates) assert.ok(state.candidates.some(c => c.id === entry.id), entry.id);
  const outlaws = state.candidates.find(c => c.id === 'outlaws-demo');
  assert.ok(outlaws.appIds.includes('outlaws_demo'));
  assert.equal(outlaws.releaseReadiness.scope, 'game', 'Outlaws appears in the Games view');
  for (const entry of manifest.candidates.filter(c => c.kind === 'game')) {
    const candidate = state.candidates.find(c => c.id === entry.id);
    if (candidate.category.id === 'unclassified') assert.equal(candidate.releaseReadiness.scope, 'game', entry.id);
  }
  assert.deepEqual(outlaws.launch.routes, [], 'new support cannot invent a route on the older emulator');
  const routes = state.candidates.flatMap(c => c.launch.routes);
  assert.equal(routes.find(r => r.appId === presentId).available, true);
  assert.equal(routes.find(r => r.appId === missingId).available, false);
  assert.equal(routes.find(r => r.appId === missingId).url, null);
  assert.equal(state.inventoryRoot, inventoryRoot);

  // Polls must notice a newly registered app without restarting the dashboard.
  registry.APPS = {...registry.APPS, newly_supported:{exe:'test/binaries/new.exe'}};
  await put(inventoryRoot, 'lib/apps.js', 'module.exports=' + JSON.stringify(registry));
  const refreshed = await reader.snapshot();
  assert.ok(refreshed.candidates.some(c => c.appIds?.includes('newly_supported')));

  // A temporarily unavailable manifest must not hide registered applications.
  await fs.unlink(path.join(inventoryRoot, 'test/candidate-corpus/manifest.json'));
  const withoutManifest = await reader.snapshot();
  assert.ok(withoutManifest.candidates.some(c => c.appIds?.includes('outlaws_demo')));
  assert.ok(withoutManifest.warnings.some(w => w.startsWith('Candidate manifest:')));
});
