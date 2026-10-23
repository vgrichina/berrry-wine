'use strict';

// Render harness handoff only. These receipts describe compilation inputs;
// they are NOT evidence that the canonical build gates or native tests passed.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const MAX_MODULE_BYTES = 8 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 128 * 1024;
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function boundedRead(file, limit) {
  // Check and read the same open file, including a growth check before use.
  const fd = fs.openSync(file, 'r');
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > limit) throw new Error(`render artifact size/type: ${file}`);
    const bytes = Buffer.alloc(stat.size);
    let n = 0;
    while (n < bytes.length) {
      const got = fs.readSync(fd, bytes, n, bytes.length - n, n);
      if (!got) throw new Error(`render artifact truncated: ${file}`);
      n += got;
    }
    if (fs.fstatSync(fd).size !== bytes.length) throw new Error(`render artifact changed: ${file}`);
    return bytes;
  } finally { fs.closeSync(fd); }
}

function artifactPath(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || !file.endsWith('.wasm'))
    throw new Error('render artifact requires an absolute .wasm path');
  return file;
}

function identity({ extraWat = '', tailCalls = true } = {}) {
  if (typeof extraWat !== 'string' || typeof tailCalls !== 'boolean')
    throw new Error('render artifact requires string extraWat and boolean tailCalls');
  // The canonical helper owns include order and compile options. Seal its
  // entire VFS input inventory, including unused fragments, rather than invent
  // a second include order or relying on a Git revision. Re-read on EVERY call.
  // Merely hashing bytes must never load watx.js (which evaluates the compiler).
  const files = [
    'test/render-helper.js', 'test/render-artifact.js', 'test/compile-src.js',
    'tools/watx-closure.js', 'tools/watx.js', 'lib/wat-manifest.js',
  ];
  for (const f of fs.readdirSync(path.join(ROOT, 'src')).sort()) {
    if (/\.(wat|watx)$/.test(f)) files.push(`src/${f}`);
  }
  if (!files.includes('src/main.watx') || !files.includes('src/13-exports.wat'))
    throw new Error('render artifact requires canonical main.watx and 13-exports.wat');
  function compilerFiles(dir) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) {
      const rel = `${dir}/${f}`, stat = fs.lstatSync(path.join(ROOT, rel));
      if (stat.isDirectory()) compilerFiles(rel);
      else if (stat.isFile()) files.push(rel);
      else throw new Error(`render artifact non-regular compiler input: ${rel}`);
    }
  }
  compilerFiles('tools/watx-src');
  const inputs = files.sort().map(file => {
    const full = path.join(ROOT, file);
    if (!fs.lstatSync(full).isFile()) throw new Error(`render artifact non-regular input: ${file}`);
    const bytes = boundedRead(full, 24 * 1024 * 1024);
    return { file, bytes: bytes.length, sha256: sha256(bytes) };
  });
  return { format: 'wine-render-artifact-v1', inputs,
    options: { tailCalls }, extraWat: { encoding: 'utf16le', bytes: extraWat.length * 2,
      sha256: sha256(Buffer.from(extraWat, 'utf16le')) } };
}

function extraWatTransform(extraWat) {
  return !extraWat ? null : (file, source) =>
    file === '13-exports.wat' ? `${source}\n${extraWat}\n` : source;
}

function prepareArtifact(file, options) {
  file = artifactPath(file);
  const before = identity(options);
  if (require.cache[require.resolve('../tools/watx.js')])
    throw new Error('render artifact preparation requires a fresh compiler process');
  // Lazy import: consumption never imports compile-src or evaluates WATX.
  const { compileSrcWasm } = require('./compile-src');
  const bytes = compileSrcWasm(extraWatTransform(options.extraWat), { tailCalls: options.tailCalls });
  if (JSON.stringify(before) !== JSON.stringify(identity(options)))
    throw new Error('render artifact inputs changed during compilation');
  if (!bytes.length || bytes.length > MAX_MODULE_BYTES) throw new Error('render artifact module size');
  // Publish manifest last. A partial/failed preparation cannot validate.
  fs.writeFileSync(file, bytes);
  fs.writeFileSync(`${file}.json`, JSON.stringify({ ...before,
    module: { bytes: bytes.length, sha256: sha256(bytes) } }, null, 2) + '\n');
}

function consumeArtifact(file, options) {
  file = artifactPath(file);
  const metadata = JSON.parse(boundedRead(`${file}.json`, MAX_MANIFEST_BYTES).toString('utf8'));
  const expected = identity(options);
  const module = metadata && metadata.module;
  if (!module || !Number.isInteger(module.bytes) || module.bytes < 1 ||
      module.bytes > MAX_MODULE_BYTES || typeof module.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(module.sha256))
    throw new Error('render artifact malformed module metadata');
  // Compare the complete schema, rejecting unknown fields and missing fields.
  const receipt = { ...expected, module: { bytes: module.bytes, sha256: module.sha256 } };
  if (JSON.stringify(metadata) !== JSON.stringify(receipt))
    throw new Error('render artifact provenance mismatch');
  const bytes = boundedRead(file, MAX_MODULE_BYTES);
  if (bytes.length !== module.bytes || sha256(bytes) !== module.sha256)
    throw new Error('render artifact module mismatch');
  return bytes;
}

module.exports = { identity, extraWatTransform, prepareArtifact, consumeArtifact };
