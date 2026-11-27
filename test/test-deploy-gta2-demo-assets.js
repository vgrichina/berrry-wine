#!/usr/bin/env node
'use strict';

// GTA2 Wild Demo is published by the owner's decision (2026-11-24). Check it
// is on the desktop with an icon, that the deploy ships every file the
// registry mounts, and nothing else from the installed tree beside them.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { DESKTOP_APPS, LOCAL_CANDIDATE_APPS, APPS } = require('../lib/apps');
const { desktopAssetPaths, PUBLISHABLE_OUTSIDE_BINARIES } = require('../tools/deploy-berrry');
const iconManifest = require('../lib/app-icon-manifest.json');

const ROOT = path.join(__dirname, '..');
const id = 'gta2_demo';
const app = APPS[id];
const root = 'test/binaries/candidates/gta2-demo/installed/Program_Executable_Files/';

assert(DESKTOP_APPS.some(([name]) => name === id), 'GTA2 Demo must appear on the desktop');
assert(!LOCAL_CANDIDATE_APPS.some(([name]) => name === id), 'GTA2 Demo must not also be a local candidate');
assert(iconManifest.icons.includes(id), 'GTA2 Demo must have a desktop icon');
assert(fs.existsSync(path.join(ROOT, 'icons', 'apps', `${id}.png`)), 'GTA2 icon is missing');
assert(PUBLISHABLE_OUTSIDE_BINARIES.includes(root), 'GTA2 payload root must be owner-approved');
assert(app.exe.startsWith(root), 'GTA2 exe must live under the approved root');

if (!fs.existsSync(path.join(ROOT, app.exe))) {
  console.log('SKIP  GTA2 demo assets are not installed in this tree');
  process.exit(0);
}

const deployed = desktopAssetPaths();
const mounted = new Set([app.exe, ...(app.dlls || []),
  ...app.files.map(f => typeof f === 'string' ? f : (f.src || f.path || f.url))]);
for (const file of mounted) {
  assert(typeof file === 'string', 'unexpected GTA2 file entry shape');
  assert(deployed.has(file), `deploy is missing ${file}`);
}
const extra = [...deployed].filter(p => p.startsWith(root) && !mounted.has(p));
assert.deepStrictEqual(extra, [], 'deploy ships GTA2 files the game does not mount');
const sibling = [...deployed].filter(p =>
  p.startsWith('test/binaries/candidates/gta2-demo/') && !p.startsWith(root));
assert.deepStrictEqual(sibling, [], 'deploy ships GTA2 installer or sibling files');

console.log(`PASS  GTA2 Demo desktop entry, icon and ${mounted.size} assets ship`);
