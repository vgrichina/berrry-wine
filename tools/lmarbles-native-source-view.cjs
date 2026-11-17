'use strict';
// Immutable, transient runtime inputs. Git plus patches are the only persisted
// source archive. Every guest Worker inherits this same sealed source/module.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const crypto = require('node:crypto');
const read = fs.readFileSync.bind(fs);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const root = path.resolve(__dirname, '..');
const files = new Map();
const sourceFd = fs.openSync(process.env.LMARBLES_SOURCE_FD, 'r');
const sourceSize = fs.fstatSync(sourceFd).size;
const observeDirectory = process.env.LMARBLES_SOURCE_OBSERVE;
const threadId = require('node:worker_threads').threadId;
function observed(file, body) {
  if (!observeDirectory) return;
  fs.appendFileSync(path.join(observeDirectory, `source-${process.pid}-${threadId}.jsonl`),
    JSON.stringify({ pid: process.pid, threadId, path: path.relative(root, file),
      size: body.length, sha256: hash(body) }) + '\n');
}
function range(offset, size) {
  const b = Buffer.alloc(size);
  let done = 0;
  while (done < size) {
    const n = fs.readSync(sourceFd, b, done, size - done, offset + done);
    if (!n) throw Error('truncated sealed source');
    done += n;
  }
  return b;
}
if (process.env.LMARBLES_SOURCE_INDEX_SHA256) {
  const size = range(0, 4).readUInt32LE();
  if (size > sourceSize - 4) throw Error('invalid sealed source index length');
  const bytes = range(4, size);
  if (hash(bytes) !== process.env.LMARBLES_SOURCE_INDEX_SHA256) throw Error('sealed source index differs');
  const index = JSON.parse(bytes);
  if (index.version !== 1) throw Error('unsupported sealed source index');
  let end = 0;
  for (const row of index.files) {
    if (typeof row.path !== 'string' || path.posix.normalize(row.path) !== row.path ||
        path.isAbsolute(row.path) || row.path.startsWith('../') ||
        !Number.isSafeInteger(row.size) || row.size < 0 || row.offset !== end ||
        !/^[a-f0-9]{64}$/.test(row.sha256) || files.has(path.join(root, row.path)))
      throw Error('invalid sealed source entry');
    files.set(path.join(root, row.path), { ...row, offset: 4 + size + row.offset });
    end += row.size;
  }
  if (4 + size + end !== sourceSize) throw Error('sealed source size differs');
} else {
  // Legacy compile holders remain readable. Native launches use the indexed
  // format, avoiding full Git-pool JSON/base64 work in every Worker.
  const pool = JSON.parse(read(process.env.LMARBLES_SOURCE_FD));
  for (const row of pool.files) {
    const body = Buffer.from(row.body, 'base64');
    if (hash(body) !== row.sha256) throw Error('sealed source digest differs: ' + row.path);
    files.set(path.join(root, row.path), body);
  }
}
const wasmPath = path.join(root, 'build/wine-assembly.wasm');
let wasm;
function select(file) {
  if (typeof file !== 'string') return null;
  const full = path.resolve(file), value = files.get(full);
  if (full === wasmPath) {
    if (!wasm) {
      wasm = read(process.env.LMARBLES_MODULE_FD);
      if (hash(wasm) !== process.env.LMARBLES_MODULE_SHA256) throw Error('sealed module differs');
      observed(full, wasm);
    }
    return wasm;
  }
  if (value) {
    if (Buffer.isBuffer(value)) return value;
    const body = range(value.offset, value.size);
    if (hash(body) !== value.sha256) throw Error('sealed source digest differs: ' + value.path);
    files.set(full, body);
    observed(full, body);
    return body;
  }
  if (full.startsWith(root + '/') && /\.(?:js|cjs|json|wasm)$/.test(full) &&
      !full.startsWith(root + '/node_modules/')) throw Error('unsealed runtime input: ' + full);
  return null;
}
const decode = (b, opts) => {
  const encoding = typeof opts === 'string' ? opts : opts?.encoding;
  return encoding ? b.toString(encoding) : Buffer.from(b);
};
// Node's normal resolver stats the live tree before _extensions/readFile run.
// Resolve against the inventory itself, so deleted and replaced live paths
// cannot change which sealed module a request names.
const resolveFilename = Module._resolveFilename;
const builtin = new Set(Module.builtinModules.flatMap(n => [n, 'node:' + n]));
function sealedFile(base) {
  for (const suffix of ['', '.js', '.json', '.node']) {
    if (files.has(base + suffix)) return base + suffix;
  }
  return null;
}
function sealedPath(base, seen = new Set()) {
  const file = sealedFile(base);
  if (file) return file;
  if (seen.has(base)) return null;
  seen.add(base);
  const manifest = path.join(base, 'package.json');
  if (files.has(manifest)) {
    const pkg = JSON.parse(select(manifest).toString());
    if (typeof pkg.main === 'string') {
      const entry = path.resolve(base, pkg.main);
      if (!entry.startsWith(base + path.sep)) throw Error('unsealed package entry: ' + entry);
      const main = sealedPath(entry, seen);
      if (main) return main;
    }
  }
  return sealedFile(path.join(base, 'index'));
}
Module._resolveFilename = function(request, parent, isMain, options) {
  if (builtin.has(request)) return resolveFilename.call(this, request, parent, isMain, options);
  const from = parent?.filename ? path.dirname(parent.filename) : process.cwd();
  const local = path.isAbsolute(request) || request.startsWith('./') || request.startsWith('../');
  const inside = p => p === root || p.startsWith(root + path.sep);
  if (local) {
    const base = path.resolve(from, request);
    if (inside(base)) {
      const found = sealedPath(base);
      if (found) return found;
      throw Error('unsealed runtime input: ' + base);
    }
    if (files.has(parent?.filename)) throw Error('unsealed runtime input: ' + base);
  } else if (inside(from)) {
    for (let dir = from; inside(dir); dir = path.dirname(dir)) {
      const found = sealedPath(path.join(dir, 'node_modules', request));
      if (found) return found;
    }
    throw Error('unsealed runtime input: ' + request);
  }
  return resolveFilename.call(this, request, parent, isMain, options);
};
fs.readFileSync = (file, opts) => { const b = select(file); return b ? decode(b, opts) : read(file, opts); };
const asyncRead = fs.readFile.bind(fs), promiseRead = fs.promises.readFile.bind(fs.promises);
fs.readFile = (file, opts, callback) => {
  if (typeof opts === 'function') { callback = opts; opts = undefined; }
  let b; try { b = select(file); } catch (e) { queueMicrotask(() => callback(e)); return; }
  if (!b) return asyncRead(file, opts, callback);
  queueMicrotask(() => callback(null, decode(b, opts)));
};
fs.promises.readFile = async (file, opts) => { const b = select(file); return b ? decode(b, opts) : promiseRead(file, opts); };
const stream = fs.createReadStream.bind(fs);
fs.createReadStream = (file, opts) => {
  const b = select(file); if (!b) return stream(file, opts);
  if (opts?.start !== undefined || opts?.end !== undefined) throw Error('partial sealed stream unsupported');
  return require('node:stream').Readable.from([Buffer.from(b)]);
};
for (const extension of ['.js', '.cjs', '.json']) {
  const previous = Module._extensions[extension] || Module._extensions['.js'];
  Module._extensions[extension] = (mod, file) => {
    const b = select(file); if (!b) return previous(mod, file);
    if (extension === '.json') mod.exports = JSON.parse(b.toString());
    else mod._compile(b.toString(), file);
  };
}
