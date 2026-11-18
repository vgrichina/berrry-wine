#!/usr/bin/env node
'use strict';

// DXSDK Globe textures its sphere from one 256x256 SYSTEMMEMORY surface it
// never touches after loading. That surface is a guest heap block, so its
// partial first and last 4 KB pages are shared with heap objects d3drm
// rewrites every frame; page-generation tracking alone re-decoded and
// re-uploaded the texture on every draw (1040 uploads for 1040 draws).
// The texture cache now keys interior pages on generations and verifies
// edge pages by the texture's own bytes (src/09abg-d3dim-gps.wat
// $d3g_tex_edge_hash): one upload, and every later hit is counted.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(__dirname, 'binaries', 'dx-sdk', 'bin', 'globe.exe');
const WASM = path.join(ROOT, 'build', 'wine-assembly.wasm');

if (!fs.existsSync(EXE) || !fs.existsSync(WASM)) {
  console.log('SKIP: Globe binary or built WASM is unavailable');
  process.exit(0);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd3dim-globe-texcache-'));
const pngPath = path.join(dir, 'frame.png');
try {
  const result = spawnSync('node', [
    path.join(__dirname, 'run.js'),
    '--app=dx_globe',
    '--batch-size=100000',
    '--max-batches=110',
    '--quiet-api',
    '--no-build',
    '--no-close',
    `--png=${pngPath}`,
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 90000,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.error) throw result.error;
  assert.strictEqual(result.status, 0, `Globe exited ${result.status}\n${out.slice(-4000)}`);
  assert(!/RuntimeError|UNHANDLED EXCEPTION/.test(out), `Globe trapped\n${out.slice(-4000)}`);

  const stat = (line, name) => {
    const m = new RegExp(`(?:^| )${name}=(\\d+)`).exec(line || '');
    assert(m, `missing ${name} in d3dim-gps stats\n${out.slice(-4000)}`);
    return Number(m[1]);
  };
  const lines = out.split('\n');
  const main = lines.find(s => s.startsWith('[d3dim-gps] draws='));
  const sites = lines.find(s => s.startsWith('[d3dim-gps] readback sites'));
  const draws = stat(main, 'draws');
  const textureUploads = stat(main, 'textureUploads');
  const verified = stat(sites, 'texEdgeVerified');
  assert(draws >= 100, `Globe drew too little to judge its texture cache (draws=${draws})`);
  assert(textureUploads <= 2,
    `Globe's unchanged texture was re-uploaded (${textureUploads} uploads for ${draws} draws)`);
  assert(verified >= draws - 2,
    `edge-page hits were not proved by the texture's bytes (${verified} for ${draws} draws)`);

  // The cached texture must still be the one drawn: a lit, textured sphere.
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  let lit = 0;
  for (let y = 62; y < Math.min(316, png.height); y++) {
    for (let x = 24; x < Math.min(316, png.width); x++) {
      const off = (y * png.width + x) * 4;
      if (png.data[off] || png.data[off + 1] || png.data[off + 2]) lit++;
    }
  }
  assert(lit > 5000, `Globe's sphere is missing (${lit} lit client pixels)`);
  console.log(`PASS  Globe texture cache: ${textureUploads} upload(s) for ${draws} draws, `
    + `${verified} edge-verified hits, ${lit} lit client pixels`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
