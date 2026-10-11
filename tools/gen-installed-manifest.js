#!/usr/bin/env node
'use strict';

// gen-installed-manifest.js <installed-dir> <exe-relative-path>
//
// Write <installed-dir>/.wine-assembly-browser.json for a game tree that an
// original installer produced inside the emulator (exported from the VFS), so
// lib/apps.js can register it with `localFileManifest`. Same schema and rules
// as tools/fetch-candidate-corpus.js writeBrowserManifest: every file except
// the exe, URL relative to the manifest, vfsPath "c:\<relative>", size. The
// candidate-corpus path covers trees a fetch step can extract by itself; this
// covers the ones only a guest installer can build (Quake III Arena demo's
// Installer VISE package, Little Fighter 2).

const fs = require('fs');
const path = require('path');

const [dir, exe] = process.argv.slice(2);
if (!dir || !exe) {
  console.error('usage: node tools/gen-installed-manifest.js <installed-dir> <exe-relative-path>');
  process.exit(2);
}
const root = path.resolve(dir);
const exeRel = path.normalize(exe);
if (!fs.statSync(path.join(root, exeRel)).isFile()) throw new Error(`exe not found: ${exe}`);

function walk(relative = '', out = []) {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const name = relative ? path.join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) walk(name, out);
    else if (entry.isFile() && !name.startsWith('.wine-assembly-')) out.push(name);
  }
  return out;
}

const files = walk().sort((a, b) => a.localeCompare(b))
  .filter(relative => path.normalize(relative) !== exeRel)
  .map(relative => ({
    url: relative.split(path.sep).join('/'),
    vfsPath: 'c:\\' + relative.split(path.sep).join('\\'),
    size: fs.statSync(path.join(root, relative)).size,
  }));
fs.writeFileSync(path.join(root, '.wine-assembly-browser.json'),
  `${JSON.stringify({ schemaVersion: 1, files }, null, 2)}\n`);
console.log(`wrote ${files.length} entries to ${path.join(root, '.wine-assembly-browser.json')}`);
