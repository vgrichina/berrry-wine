'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {APPS, DESKTOP_APPS, LOCAL_CANDIDATE_APPS} = require('../lib/apps');
const manifest = require('../test/candidate-corpus/manifest.json');
const {inventory} = require('./corpus-inventory');
const {buildCatalog, launchFor} = require('./emulator-server');
const root = path.resolve(__dirname, '..');

test('Mad Bomber preserves the accepted original guest closure and DLL seeds', () => {
  const app = APPS.madbomber;
  assert.equal(app.exe, 'test/binaries/candidates/madbomber/original/madbomber.exe');
  assert.equal(app.exeGuestPath, 'C:\\MADBOMBER\\madbomber.exe');
  assert.equal(app.workingDirectory, 'C:\\MADBOMBER');
  assert.equal(app.requiredFiles, true);
  assert.equal(app.threads, false);
  // Independent digest of the 140 ordered --vfs-mount pairs in the accepted
  // input/launch.json, replacing only the remote asset-root prefix.
  const pairs = app.files.map(({url, vfsPath}) => ({url, vfsPath}));
  assert.equal(pairs.length, 140);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(pairs)).digest('hex'),
    'a9a2e8010509322265c515cb103322a58771e2bf38552e91e59a9bed5bb84983');
  assert.deepEqual(app.dlls, [
    'jpeg.dll', 'libpng1.dll', 'msvcr70.dll', 'SDL_image.dll',
    'SDL_mixer.dll', 'SDL.dll', 'zlib.dll',
  ].map(name => 'test/binaries/candidates/madbomber/original/' + name)
    .concat('test/binaries/candidates/madbomber/dependencies/msvcrt.dll'));
  for (const name of [app.exe, ...app.dlls, ...pairs.map(p => p.url)]) {
    assert.ok(name.startsWith('test/binaries/candidates/madbomber/'));
    assert.ok(!name.split('/').includes('..'));
  }
});

test('one private corpus row links accepted evidence and honest recovery limits', () => {
  const rows = inventory(manifest, APPS, [], LOCAL_CANDIDATE_APPS);
  const matches = rows.filter(row => row.appIds.includes('madbomber'));
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'madbomber');
  assert.equal(matches[0].origin, 'manifest');
  assert.equal(matches[0].scope, 'game-or-game-installer');
  assert.equal(DESKTOP_APPS.some(([id]) => id === 'madbomber'), false);
  assert.equal(LOCAL_CANDIDATE_APPS.filter(([id]) => id === 'madbomber').length, 1);
  const candidate = manifest.candidates.find(c => c.id === 'madbomber');
  assert.equal(candidate.localOnly, true);
  assert.deepEqual(candidate.packages, []);
  const links = candidate.notes.match(/docs\/re-notes\/[a-zA-Z0-9._-]+\.md/g);
  assert.deepEqual(links, [
    'docs/re-notes/madbomber-after-midi-original-20261020.md',
    'docs/re-notes/madbomber-corpus-launch-20261020.md',
  ]);
  for (const link of links) assert.ok(fs.statSync(path.join(root, link)).isFile());
  assert.match(candidate.notes, /Scoring, sustained gameplay, audio, FPS and browser execution unqualified/);
  const recipe = fs.readFileSync(path.join(root, links[1]), 'utf8');
  for (const reference of ['original-assets.tar.gz', 'original-closure-required.json',
    'closure.json', 'input/launch.json', 'input/sample-5s.png', 'input/sample-9s.png']) {
    assert.ok(recipe.includes(reference), reference);
  }
});

test('actual catalog reports absent Mad Bomber files without inventing launch availability', async () => {
  // Read the real filesystem only. No fabricated executables, server or runtime.
  const catalog = await buildCatalog(root);
  const route = catalog.routes.find(r => r.appId === 'madbomber');
  const app = APPS.madbomber;
  const required = [...new Set([app.exe, ...app.dlls, ...app.files.map(f => f.url)])];
  const missing = required.filter(p => !fs.existsSync(path.join(root, p)));
  assert.deepEqual([...route.missingPaths].sort(), missing.sort());
  assert.equal(route.available, missing.length === 0);
  assert.equal(route.url, missing.length ? null : '/emulator/?debug&app=madbomber');
  const launch = launchFor({appIds:['madbomber']}, catalog, {
    status:'verified', appIds:DESKTOP_APPS.map(([id]) => id), url:'https://example.invalid',
  });
  assert.deepEqual(launch.productionRoutes, []);
});
