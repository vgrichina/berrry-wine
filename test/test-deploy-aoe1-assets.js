#!/usr/bin/env node
'use strict';

// The Age of Empires trial is on the desktop under the terms of its own
// eula.txt: unlimited noncommercial copies, each true and complete and
// accompanied by the EULA (test/binaries/SOURCES.md). Check the deploy ships
// every file of the extracted trial -- the EULA among them -- and nothing from
// outside it, and that the desktop entry has its icon and does not claim to be
// the full game.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { DESKTOP_APPS, LOCAL_CANDIDATE_APPS, DEBUG_ONLY_APPS, APPS, appFileUrl } = require('../lib/apps');
const { desktopAssetPaths } = require('../tools/deploy-berrry');
const iconManifest = require('../lib/app-icon-manifest.json');

const ROOT = path.join(__dirname, '..');
const id = 'aoe1';
const app = APPS[id];
const entry = DESKTOP_APPS.find(([name]) => name === id);

assert(entry, 'Age of Empires must appear on the desktop');
assert(/\b(trial|demo)\b/i.test(entry[1]), `desktop name "${entry[1]}" must say it is the trial`);
assert(![...LOCAL_CANDIDATE_APPS, ...DEBUG_ONLY_APPS].some(([name]) => name === id), 'Age of Empires is listed twice');
assert(iconManifest.icons.includes(id), 'Age of Empires must have a desktop icon');
assert(fs.existsSync(path.join(ROOT, 'icons', 'apps', `${id}.png`)), 'Age of Empires icon is missing');

const dir = path.posix.dirname(app.exe);
const mounted = new Set([app.exe, ...app.files.map(appFileUrl)]);
assert(mounted.has(`${dir}/eula.txt`), 'the registry must mount the EULA');

const local = path.join(ROOT, dir);
if (!fs.existsSync(local)) {
  console.log('SKIP  Age of Empires trial files are not installed in this tree');
  process.exit(0);
}

// "True and complete": every file of the extracted trial is mounted.
const onDisk = [];
const walk = (abs, rel) => {
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(path.join(abs, e.name), r);
    else onDisk.push(`${dir}/${r}`);
  }
};
walk(local, '');
for (const file of onDisk) assert(mounted.has(file), `registry does not mount ${file}`);

const deployed = desktopAssetPaths();
for (const file of mounted) assert(deployed.has(file), `deploy is missing ${file}`);
const extra = [...deployed].filter(p => p.startsWith(path.posix.dirname(dir) + '/') && !mounted.has(p));
assert.deepStrictEqual(extra, [], 'deploy ships Age of Empires files outside the extracted trial');

console.log(`PASS  Age of Empires trial desktop entry, icon and all ${mounted.size} files ship, eula.txt included`);
