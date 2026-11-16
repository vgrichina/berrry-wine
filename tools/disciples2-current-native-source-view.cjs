'use strict';
// Immutable, transient runtime inputs. Git plus patches are the only persisted
// source archive. Every guest Worker inherits this same sealed source/module.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const crypto = require('node:crypto');
const read = fs.readFileSync.bind(fs);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const pool = JSON.parse(read(process.env.DISCIPLES2_SOURCE_FD));
const root = path.resolve(__dirname, '..');
const files = new Map(pool.files.map(row => {
  const body = Buffer.from(row.body, 'base64');
  if (hash(body) !== row.sha256) throw Error('sealed source digest differs: ' + row.path);
  return [path.join(root, row.path), body];
}));
const wasm = read(process.env.DISCIPLES2_MODULE_FD);
if (hash(wasm) !== process.env.DISCIPLES2_MODULE_SHA256) throw Error('sealed module differs');
files.set(path.join(root, 'build/wine-assembly.wasm'), wasm);
function select(file) {
  if (typeof file !== 'string') return null;
  const full = path.resolve(file), value = files.get(full);
  if (value) return value;
  if (full.startsWith(root + '/') && /\.(?:js|cjs|json|wasm)$/.test(full) &&
      !full.startsWith(root + '/node_modules/')) throw Error('unsealed runtime input: ' + full);
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
    const b = select(file); if (!b) return previous(mod, file);
    if (extension === '.json') mod.exports = JSON.parse(b.toString());
    else mod._compile(b.toString(), file);
  };
}
