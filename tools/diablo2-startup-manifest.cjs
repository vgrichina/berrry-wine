'use strict';

// Storage encoding is not a new manifest identity. Callers supply the original
// declared raw pin; a present but invalid raw file must never fall back to gzip.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

function pin(p) {
  assert(p && typeof p.path === 'string' && p.path.length > 0, 'missing declared path');
  assert(!path.isAbsolute(p.path) && !p.path.includes('\\') &&
    p.path.split('/').every(s => s && s !== '.' && s !== '..'), 'unsafe declared path');
  assert(Number.isSafeInteger(p.size) && p.size > 0, 'invalid declared size');
  assert(/^[0-9a-f]{64}$/.test(p.sha256), 'invalid declared SHA');
}

function read(root, expected, allowGzip = true) {
  pin(expected);
  const file = path.resolve(root, expected.path);
  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch (e) {
    if (e.code !== 'ENOENT' || !allowGzip) throw e;
    const encoded = fs.readFileSync(file + '.gz');
    if (expected.gzipSha256) assert.equal(sha(encoded), expected.gzipSha256, 'gzip SHA');
    bytes = zlib.gunzipSync(encoded, {maxOutputLength: expected.size + 1});
  }
  assert.equal(bytes.length, expected.size, 'raw size: ' + expected.path);
  assert.equal(sha(bytes), expected.sha256, 'raw SHA: ' + expected.path);
  return bytes;
}

function load(root, expected) {
  const bytes = read(root, expected);
  const pins = JSON.parse(bytes);
  assert.equal(pins.app, 'diablo2_demo', 'wrong app');
  assert(/^[0-9a-f]{40}$/.test(pins.commit), 'invalid source commit');
  assert(Array.isArray(pins.files) && pins.files.length > 0, 'missing files');
  const byPath = new Map();
  for (const p of pins.files) {
    pin(p);
    assert(!byPath.has(p.path), 'duplicate dependency: ' + p.path);
    byPath.set(p.path, p);
  }
  assert.deepEqual(pins.uploadFiles, pins.files, 'upload closure differs');
  assert(Array.isArray(pins.httpPins), 'missing HTTP pins');
  const seen = new Set();
  for (const p of pins.httpPins) {
    assert(typeof p.url === 'string' && p.url.startsWith('/'), 'invalid HTTP URL');
    const dependency = byPath.get(p.url.slice(1));
    assert(dependency && !seen.has(p.url), 'un-pinned or duplicate HTTP dependency');
    seen.add(p.url);
    assert.equal(p.size, dependency.size, 'HTTP size');
    assert.equal(p.sha256, dependency.sha256, 'HTTP SHA');
  }
  const manifestPath = path.posix.join(path.posix.dirname(expected.path), 'restore-manifest.json');
  const manifestPin = byPath.get(manifestPath);
  assert(manifestPin, 'un-pinned restore manifest');
  const mounts = JSON.parse(read(root, manifestPin));
  assert(Array.isArray(mounts) && mounts.length === 4, 'expected whole four mounts');
  const names = new Set(['samehero.d2s', 'samehero.key', 'samehero.ma0', 'samehero.map']);
  const dependencies = [];
  for (const m of mounts) {
    assert(m && typeof m.url === 'string' && m.url.startsWith('/'), 'invalid mount URL');
    const p = byPath.get(m.url.slice(1));
    assert(p, 'un-pinned save dependency');
    pin(p);
    const name = path.posix.basename(p.path);
    assert(names.delete(name), 'duplicate or unexpected save');
    assert.equal(m.vfsPath, 'c:\\save\\' + name, 'wrong VFS destination');
    const http = pins.httpPins.find(p => p.url === m.url);
    assert(http, 'save absent from HTTP closure');
    // The ordinary HTTP launcher serves these exact raw save URLs. Encoding a
    // missing save locally cannot make that URL available to the native loader.
    const b = read(root, p, false);
    dependencies.push({path: p.path, size: b.length, sha256: sha(b)});
  }
  assert.equal(names.size, 0, 'missing save');
  return {pins, mounts, manifest: {path: expected.path, size: bytes.length, sha256: sha(bytes)},
    restoreManifest: manifestPin, dependencies};
}

// Emit the actual parent consumer with the new preflight at its first statement.
// No original helper or declared pin is changed, and this function cannot create
// a browser, API client or box. The existing native consumer uses these mounts.
function prepare(root, output, expected) {
  root = path.resolve(root);
  output = path.resolve(output);
  assert.equal(path.dirname(output), path.join(root, 'scratch/runs'), 'output must be a new run prefix');
  const closure = load(root, expected);
  const parent = path.posix.dirname(expected.path);
  assert.notEqual(output, path.resolve(root, parent), 'cannot overwrite parent');
  const browserPin = closure.pins.files.find(p => p.path === parent + '/browser.cjs');
  assert(browserPin, 'un-pinned parent browser');
  let body = read(root, browserPin).toString('utf8');
  const replace = (before, after) => {
    assert.equal(body.split(before).length, 2, 'unexpected parent consumer seam');
    body = body.replace(before, after);
  };
  assert(body.startsWith("if(process.argv.includes('--startup-data-check'))"), 'missing original data seam');
  body = body.slice(body.indexOf('\n') + 1);
  replace("const startupMounts=require('./startup-data.cjs').load(root,run);", 'const startupMounts=verifiedStartup.mounts;');
  replace("const pins=JSON.parse(fs.readFileSync(run+'/runtime-pins.json'));", 'const pins=verifiedStartup.pins;');
  for (const helper of ['passive-exit.js', 'worker-observe.js']) {
    replace("run+'/" + helper + "'", 'root+' + JSON.stringify('/' + parent + '/' + helper));
  }
  const prelude = `const startupRoot=process.argv.includes('--startup-data-check')?process.argv[3]:require('node:path').resolve(__dirname,'../../..');
const verifiedStartup=require(startupRoot+'/tools/diablo2-startup-manifest.cjs').load(startupRoot,${JSON.stringify(expected)});
if(process.argv.includes('--startup-data-check')){const {pins,...startupClosure}=verifiedStartup;console.log(JSON.stringify(startupClosure));return;}
require=require('node:module').createRequire(startupRoot+${JSON.stringify('/' + parent + '/browser.cjs')});
`;
  fs.mkdirSync(output, {recursive: true});
  fs.writeFileSync(path.join(output, 'browser.cjs'), prelude + body, {flag: 'wx'});
  return closure;
}

module.exports = {read, load, prepare};
