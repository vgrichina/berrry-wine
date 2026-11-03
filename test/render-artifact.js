'use strict';

// Render harness handoff only. These receipts describe compilation inputs;
// they are NOT evidence that the canonical build gates or native tests passed.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const vm = require('vm');
// Keep old exports useful without changing Node's shared require cache. A
// retained caller delegates to a privately evaluated current implementation.
const evaluatedSource = module.renderSource || fs.readFileSync(__filename);
let replacement;
function currentImplementation() {
  const source = boundedRead(__filename, 24 * 1024 * 1024);
  if (source.equals(evaluatedSource)) return null;
  if (!replacement || !replacement.source.equals(source)) {
    // No parent: Node must not retain every replaced implementation in the
    // original module's children array across repeated edits.
    const fresh = new Module(__filename);
    fresh.filename = __filename;
    fresh.paths = module.paths;
    fresh.renderSource = source;
    fresh._compile(source.toString('utf8'), __filename);
    replacement = { source, exports: fresh.exports };
  }
  return replacement.exports;
}
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

function snapshot({ extraWat = '', tailCalls = true } = {}) {
  if (typeof extraWat !== 'string' || typeof tailCalls !== 'boolean')
    throw new Error('render artifact requires string extraWat and boolean tailCalls');
  // The canonical helper owns include order and compile options. Seal its
  // entire VFS input inventory, including unused fragments, rather than invent
  // a second include order or relying on a Git revision. Re-read on EVERY call.
  // Merely hashing bytes must never load watx.js (which evaluates the compiler).
  const files = [
    'test/render-helper.js', 'test/render-artifact.js', 'test/compile-src.js',
    'tools/watx-closure.js', 'tools/protected-writer-entries.js',
    'tools/watx.js', 'lib/wat-manifest.js',
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
  const contents = new Map();
  const inputs = files.sort().map(file => {
    const full = path.join(ROOT, file);
    if (!fs.lstatSync(full).isFile()) throw new Error(`render artifact non-regular input: ${file}`);
    const bytes = boundedRead(full, 24 * 1024 * 1024);
    contents.set(full, bytes);
    return { file, bytes: bytes.length, sha256: sha256(bytes) };
  });
  const receipt = { format: 'wine-render-artifact-v1', inputs,
    options: { tailCalls }, extraWat: { encoding: 'utf16le', bytes: extraWat.length * 2,
      sha256: sha256(Buffer.from(extraWat, 'utf16le')) } };
  if (!contents.get(__filename).equals(evaluatedSource))
    throw new Error('render artifact implementation changed during invocation');
  return { receipt, contents };
}

function checkExecutingHelper(captured, helperSource) {
  if (helperSource && !captured.contents.get(path.join(ROOT, 'test/render-helper.js')).equals(helperSource))
    throw new Error('render helper implementation changed during invocation');
}

function identity(options, helperSource) {
  const captured = snapshot(options);
  checkExecutingHelper(captured, helperSource);
  return captured.receipt;
}

// Each cache miss has a private CommonJS graph. Compile adapters and the loader
// are evaluated from the SAME buffers as the receipt; the loader's vm stages
// and the canonical closure's source reads also use these buffers. No shared
// cache deletion, no subprocess, and no dependence on callers' held exports.
// This is trusted project code isolation, not a sandbox for hostile JS.
function compileSnapshot({ receipt, contents }, options) {
  const cache = new Map();
  const resolve = file => path.resolve(file);
  const read = (file, encoding) => {
    const bytes = contents.get(resolve(file));
    if (!bytes) throw new Error(`render artifact unsealed read: ${file}`);
    const copy = Buffer.from(bytes);
    const enc = typeof encoding === 'string' ? encoding : encoding && encoding.encoding;
    return enc ? copy.toString(enc) : copy;
  };
  const sealedFs = Object.freeze({
    readFileSync: read,
    existsSync: file => contents.has(resolve(file)),
    readdirSync: dir => {
      const prefix = resolve(dir) + path.sep;
      const names = new Set();
      for (const file of contents.keys()) {
        if (file.startsWith(prefix)) names.add(file.slice(prefix.length).split(path.sep)[0]);
      }
      if (!names.size) throw new Error(`render artifact unsealed directory: ${dir}`);
      return [...names].sort();
    },
    // The canonical compiler is read-only. This write-only API also lets tiny
    // protocol doubles count invocations without an unsealed input channel.
    appendFileSync: fs.appendFileSync.bind(fs),
  });
  function load(file) {
    file = resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    // Match CommonJS handling of the canonical closure's executable shebang.
    const source = read(file, 'utf8').replace(/^\uFEFF/, '').replace(/^#![^\r\n]*/, '');
    const entry = { exports: {} };
    cache.set(file, entry);
    function localRequire(request) {
      const builtin = request.replace(/^node:/, '');
      if (builtin === 'fs') return sealedFs;
      if (['path', 'vm', 'assert'].includes(builtin)) return require(builtin);
      if (!request.startsWith('.') && !path.isAbsolute(request))
        throw new Error(`render artifact unsealed dependency: ${request}`);
      let target = path.resolve(path.dirname(file), request);
      if (!contents.has(target)) target += '.js';
      return load(target);
    }
    const fn = vm.runInThisContext(Module.wrap(source), { filename: file });
    fn.call(entry.exports, entry.exports, localRequire, entry, file, path.dirname(file));
    return entry.exports;
  }
  const { compileSrcWasm } = load(path.join(ROOT, 'test/compile-src.js'));
  const bytes = compileSrcWasm(extraWatTransform(options.extraWat), { tailCalls: options.tailCalls });
  if (JSON.stringify(receipt) !== JSON.stringify(identity(options)))
    throw new Error('render artifact inputs changed during compilation');
  if (!bytes.length || bytes.length > MAX_MODULE_BYTES) throw new Error('render artifact module size');
  return bytes;
}

function compileHarness(options = {}, helperSource) {
  const captured = snapshot(options);
  checkExecutingHelper(captured, helperSource);
  return { identity: captured.receipt, bytes: compileSnapshot(captured, options) };
}

function extraWatTransform(extraWat) {
  return !extraWat ? null : (file, source) =>
    file === '13-exports.wat' ? `${source}\n${extraWat}\n` : source;
}

function prepareArtifact(file, options, helperSource) {
  file = artifactPath(file);
  const { identity: before, bytes } = compileHarness(options, helperSource);
  // Publish manifest last. A partial/failed preparation cannot validate.
  fs.writeFileSync(file, bytes);
  fs.writeFileSync(`${file}.json`, JSON.stringify({ ...before,
    module: { bytes: bytes.length, sha256: sha256(bytes) } }, null, 2) + '\n');
}

function consumeArtifact(file, options, helperSource) {
  file = artifactPath(file);
  const metadata = JSON.parse(boundedRead(`${file}.json`, MAX_MANIFEST_BYTES).toString('utf8'));
  const expected = identity(options, helperSource);
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

// Consumption calls only the inventory/verification code, never load().
module.exports = {};
for (const [name, fn] of Object.entries({ identity, extraWatTransform, compileHarness, prepareArtifact, consumeArtifact })) {
  module.exports[name] = (...args) => {
    const current = currentImplementation();
    return current ? current[name](...args) : fn(...args);
  };
}
