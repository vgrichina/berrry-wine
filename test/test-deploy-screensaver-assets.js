#!/usr/bin/env node
'use strict';

// The desktop's Screen Savers applet is a WAT-native catalog
// (src/09ca-screensavers.wat): Preview hands a .SCR file name to ShellExecute,
// which boots the lib/apps.js entry with that exe. Those scr_* entries are not
// on the desktop themselves, and from 2026-10-30 to 2026-11-13 the deploy
// shipped none of their files, so every Preview on the live site was a 404.
// Check every catalog name resolves to a registry entry whose exe and files ship.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { APPS, DESKTOP_APPS, appFileUrl } = require('../lib/apps');
const { desktopAssetPaths } = require('../tools/deploy-berrry');

const ROOT = path.join(__dirname, '..');
assert(DESKTOP_APPS.some(([id]) => id === 'screensavers'), 'Screen Savers must be on the desktop');

const wat = fs.readFileSync(path.join(ROOT, 'src', '09ca-screensavers.wat'), 'utf8');
const catalog = [...wat.matchAll(/"([A-Z0-9_]+\.SCR)\\00"/g)].map(m => m[1]);
assert(catalog.length > 0, 'no .SCR names found in the catalog');

const launches = new Set(APPS.screensavers.launches || []);
const byExe = new Map(Object.entries(APPS)
  .filter(([, app]) => app && app.exe)
  .map(([id, app]) => [path.posix.basename(app.exe).toUpperCase(), id]));

if (!fs.existsSync(path.join(ROOT, 'binaries', 'screensavers', catalog[0]))) {
  console.log('SKIP  screensaver binaries are not installed in this tree');
  process.exit(0);
}

const deployed = desktopAssetPaths();
let files = 0;
for (const name of catalog) {
  const id = byExe.get(name);
  assert(id, `catalog entry ${name} has no registry app`);
  assert(launches.has(id), `${id} (${name}) is not in APPS.screensavers.launches`);
  const app = APPS[id];
  for (const file of [app.exe, ...(app.files || []).map(appFileUrl)]) {
    assert(deployed.has(file), `deploy is missing ${file} for ${id}`);
    files++;
  }
}

console.log(`PASS  ${catalog.length} catalog screen savers resolve to shipped apps (${files} files)`);
