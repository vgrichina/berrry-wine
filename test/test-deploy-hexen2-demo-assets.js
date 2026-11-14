#!/usr/bin/env node
'use strict';

// The Hexen II demo is published on the desktop from its local file manifest
// (owner's decision, test/binaries/SOURCES.md). Check the deploy ships exactly
// the exe, the manifest and the files it mounts -- the bundled sublicence
// among them -- and that the installer and source archive beside them stay
// local.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { DESKTOP_APPS, LOCAL_CANDIDATE_APPS, APPS } = require('../lib/apps');
const { desktopAssetPaths } = require('../tools/deploy-berrry');
const iconManifest = require('../lib/app-icon-manifest.json');

const ROOT = path.join(__dirname, '..');
const id = 'hexen2_demo';
const app = APPS[id];

assert(DESKTOP_APPS.some(([name]) => name === id), 'Hexen II must appear on the desktop');
assert(!LOCAL_CANDIDATE_APPS.some(([name]) => name === id), 'Hexen II is listed twice');
assert(iconManifest.icons.includes(id), 'Hexen II must have a desktop icon');
assert(fs.existsSync(path.join(ROOT, 'icons', 'apps', `${id}.png`)), 'Hexen II icon is missing');
assert(app.localFileManifest, 'Hexen II mounts through its local file manifest');

const manifestPath = path.join(ROOT, app.localFileManifest);
if (!fs.existsSync(manifestPath)) {
  console.log('SKIP  Hexen II assets are not installed in this tree');
  process.exit(0);
}

const deployed = desktopAssetPaths();
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const dir = path.posix.dirname(app.localFileManifest);
const mounted = new Set([app.exe, app.localFileManifest,
  ...manifest.files.map(f => path.posix.normalize(path.posix.join(dir, f.url)))]);

for (const file of mounted) assert(deployed.has(file), `deploy is missing ${file}`);
assert(deployed.has(`${dir}/installed/HEXEN II SUBLICENSE.doc`), 'the sublicence must ship with the demo');
const extra = [...deployed].filter(p => p.startsWith(dir + '/') && !mounted.has(p));
assert.deepStrictEqual(extra, [], 'deploy ships Hexen II files the game does not mount');
for (const local of ['setup/', 'sources/']) {
  assert(![...deployed].some(p => p.startsWith(`${dir}/${local}`)), `deploy ships ${local}`);
}

console.log(`PASS  Hexen II desktop entry, icon and ${mounted.size} manifest assets ship; installer and sources do not`);
