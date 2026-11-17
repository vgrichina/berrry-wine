'use strict';
// Immutable, transient runtime inputs. Git plus patches are the only persisted
// source archive. Every guest Worker inherits this same sealed source/module.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const crypto = require('node:crypto');
const read = fs.readFileSync.bind(fs);
const preloadStarted = performance.now();
function observed(phase) {
  if (process.env.DISCIPLES2_SOURCE_OBSERVE)
    fs.appendFileSync(process.env.DISCIPLES2_SOURCE_OBSERVE, JSON.stringify({phase,
      pid:process.pid,threadId:require('node:worker_threads').threadId,
      elapsedMs:performance.now()-preloadStarted,at:Date.now()})+'\n');
}
observed('preload-start');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const root = path.resolve(process.env.DISCIPLES2_ROOT);
if (!['runtime', 'compile'].includes(process.env.DISCIPLES2_PHASE)) throw Error('sealed phase missing');
const sourceFd = fs.openSync(process.env.DISCIPLES2_SOURCE_FD, 'r');
const sourceSize = fs.fstatSync(sourceFd).size;
function range(offset, size) {
  const body = Buffer.alloc(size);
  for (let done = 0; done < size;) {
    const n = fs.readSync(sourceFd, body, done, size-done, offset+done);
    if (!n) throw Error('truncated sealed source');
    done += n;
  }
  return body;
}
const indexSize = range(0,4).readUInt32LE();
if (indexSize > sourceSize-4) throw Error('invalid sealed index size');
const indexBytes = range(4,indexSize);
if (hash(indexBytes) !== process.env.DISCIPLES2_SOURCE_INDEX_SHA256) throw Error('sealed source index differs');
const pool = JSON.parse(indexBytes);
if (pool.version !== 1) throw Error('unsupported sealed source inventory');
const seen = new Set();let end = 0;
const files = new Map(pool.files.map(row => {
  if (typeof row.path !== 'string' || path.posix.normalize(row.path) !== row.path ||
      path.isAbsolute(row.path) || row.path.startsWith('../') || seen.has(row.path)) throw Error('sealed path inventory differs');
  if (!Number.isSafeInteger(row.size) || row.size < 0 || row.offset !== end || !/^[a-f0-9]{64}$/.test(row.sha256))
    throw Error('sealed source range differs');
  seen.add(row.path);
  end += row.size;
  return [path.join(root, row.path), {...row,offset:4+indexSize+row.offset}];
}));
if (4+indexSize+end !== sourceSize) throw Error('sealed source closure differs');
observed('source-inventory-validated');
if (process.env.DISCIPLES2_PHASE === 'runtime') {
  if (!/^[a-f0-9]{64}$/.test(process.env.DISCIPLES2_MANIFEST_SHA256 || '')) throw Error('runtime manifest missing');
  const wasm = read(process.env.DISCIPLES2_MODULE_FD);
  if (hash(wasm) !== process.env.DISCIPLES2_MODULE_SHA256) throw Error('sealed module differs');
  files.set(path.join(root, 'build/wine-assembly.wasm'), wasm);
  globalThis.__disciples2Manifest = process.env.DISCIPLES2_MANIFEST_SHA256;
}
observed('preload-complete');
function select(file, code = false) {
  if (file instanceof URL) file = require('node:url').fileURLToPath(file);
  if (Buffer.isBuffer(file)) file = file.toString();
  if (typeof file !== 'string') return null;
  const full = path.resolve(file), value = files.get(full);
  if (value) {
    if (Buffer.isBuffer(value)) return value;
    const body = range(value.offset,value.size);
    if (hash(body) !== value.sha256) throw Error('sealed source digest differs: ' + value.path);
    files.set(full,body);return body;
  }
  // Run receipts are data. Requiring executable/source JSON from scratch is
  // still refused by the module hook below.
  if (!code && full.startsWith(root + '/scratch/') && full.endsWith('.json')) return null;
  if (full.startsWith(root + '/') && /\.(?:js|cjs|json|wasm|wat|watx)$/.test(full)) throw Error('unsealed runtime input: ' + full);
  return null;
}
const decode = (b, opts) => {
  const encoding = typeof opts === 'string' ? opts : opts?.encoding;
  return encoding ? b.toString(encoding) : Buffer.from(b);
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
    const b = select(file, true); if (!b) return previous(mod, file);
    if (extension === '.json') mod.exports = JSON.parse(b.toString());
    else mod._compile(b.toString(), file);
  };
}
// The supported child routes must retain the same preloaded manifest. Refuse
// an explicit environment or execArgv that would silently drop it.
if (process.env.DISCIPLES2_PHASE === 'runtime') {
  const keys = Object.keys(process.env).filter(k => k.startsWith('DISCIPLES2_'));
  function childOptions(options = {}) {
    if (options.env && options.env !== require('node:worker_threads').SHARE_ENV) {
      for (const k of [...keys, 'NODE_OPTIONS'])
        if (options.env[k] !== process.env[k]) throw Error('sealed child inheritance omitted: ' + k);
    }
    if (options.execArgv && JSON.stringify(options.execArgv) !== JSON.stringify(process.execArgv))
      throw Error('sealed child execArgv differs');
  }
  const threads = require('node:worker_threads'), Worker = threads.Worker;
  threads.Worker = class extends Worker {
    constructor(file, options) { childOptions(options); super(file, options); }
  };
  const cp = require('node:child_process');
  for (const name of ['spawn', 'spawnSync', 'fork', 'execFile', 'execFileSync']) {
    const original = cp[name];
    cp[name] = function(command, args, options, ...rest) {
      childOptions(Array.isArray(args) ? options : args);
      return original.call(this, command, args, options, ...rest);
    };
  }
}
