#!/usr/bin/env node
'use strict';

// The SimCity 2000 demo is the first desktop app whose files come from a
// `localFileManifest` rather than the registry's `files` list, so the deploy
// has to read that manifest to know what to upload. Check it ships the
// manifest and every file it mounts, nothing else from the installed tree, and
// that the local-only manifest apps beside it still ship nothing.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { DESKTOP_APPS, LOCAL_CANDIDATE_APPS, APPS } = require('../lib/apps');
const { desktopAssetPaths, PUBLISHABLE_OUTSIDE_BINARIES } = require('../tools/deploy-berrry');
const iconManifest = require('../lib/app-icon-manifest.json');

const ROOT = path.join(__dirname, '..');
const id = 'simcity2000_demo';
const app = APPS[id];

assert(DESKTOP_APPS.some(([name]) => name === id), 'SimCity 2000 Demo must appear on the desktop');
assert(iconManifest.icons.includes(id), 'SimCity 2000 Demo must have a desktop icon');
assert(fs.existsSync(path.join(ROOT, 'icons', 'apps', `${id}.png`)), 'SimCity 2000 icon is missing');
assert(app.localFileManifest, 'SimCity 2000 Demo mounts through its local file manifest');

const manifestPath = path.join(ROOT, app.localFileManifest);
if (!fs.existsSync(manifestPath)) {
  console.log('SKIP  SimCity 2000 demo assets are not installed in this tree');
  process.exit(0);
}

const deployed = desktopAssetPaths();
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const dir = path.posix.dirname(app.localFileManifest);
// The page fetches the executable from `exe` and everything else from the
// manifest, so the deploy must ship both.
const mounted = new Set([app.exe, app.localFileManifest,
  ...manifest.files.map(f => path.posix.normalize(path.posix.join(dir, f.url)))]);
assert(manifest.registry && Object.keys(manifest.registry).length,
  'the manifest must carry the installer registry the game refuses to start without');

for (const file of mounted) assert(deployed.has(file), `deploy is missing ${file}`);
const extra = [...deployed].filter(p => p.startsWith(dir + '/') && !mounted.has(p));
assert.deepStrictEqual(extra, [], 'deploy ships SimCity files the game does not mount');

// Reading manifests must not open a route for the local-only candidates. A
// manifest a desktop app also mounts (NFS III's, shared with its Glide icon),
// or one under a root the owner chose to publish (PUBLISHABLE_OUTSIDE_BINARIES,
// e.g. the NFS II demo), ships on purpose; anything else is a leak -- a local
// candidate registered under the publishable binaries/ root.
const desktopManifests = new Set(DESKTOP_APPS
  .map(([name]) => APPS[name] && APPS[name].localFileManifest).filter(Boolean));
const ownerApproved = p => PUBLISHABLE_OUTSIDE_BINARIES.some(root => p.startsWith(root));
for (const [other] of LOCAL_CANDIDATE_APPS) {
  const entry = APPS[other];
  if (!entry || !entry.localFileManifest) continue;
  if (desktopManifests.has(entry.localFileManifest) || ownerApproved(entry.localFileManifest)) continue;
  assert(!deployed.has(entry.localFileManifest), `deploy ships local-only ${entry.localFileManifest}`);
}

console.log(`PASS  SimCity 2000 Demo desktop entry, icon and ${mounted.size} manifest assets ship`);
