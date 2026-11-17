'use strict';
// Read-only, run-specific source transport. The launcher supplies sealed bytes;
// a missing project source is a hard error, never a shared-tree fallback.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const crypto = require('node:crypto'), wt = require('node:worker_threads');
const original = fs.readFileSync.bind(fs), root = process.env.LTRIS_VIEW_ROOT;
const pool = original(process.env.LTRIS_VIEW_FD);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
if (sha(pool) !== process.env.LTRIS_VIEW_SHA256) throw Error('sealed source pool changed');
const manifest = JSON.parse(pool), bodies = new Map(), ledger = new Set();
for (const item of manifest.files) {
  if (path.isAbsolute(item.path) || item.path.split('/').includes('..') || bodies.has(item.path)) throw Error('invalid source path');
  const body = Buffer.from(item.body, 'base64');
  if (sha(body) !== item.sha256) throw Error('source digest mismatch ' + item.path);
  bodies.set(item.path, body);
}
function select(file) {
  if (typeof file !== 'string') return null;
  const relative = path.relative(root, path.resolve(file));
  if (bodies.has(relative)) {
    if (!ledger.has(relative)) {
      fs.appendFileSync(path.join(process.env.LTRIS_VIEW_OUT, `source-exercised-${process.pid}-${wt.threadId}.log`),
        JSON.stringify({path:relative,sha256:sha(bodies.get(relative)),pid:process.pid,threadId:wt.threadId})+'\n');
      ledger.add(relative);
    }
    return bodies.get(relative);
  }
  if (!relative.startsWith('../') && !path.isAbsolute(relative) &&
      /\.(?:js|cjs|json)$/.test(relative) && !relative.startsWith('scratch/') &&
      !relative.startsWith('test/binaries/')) throw Error('source absent from immutable view: ' + relative);
  return null;
}
const decode = (b, o) => (typeof o === 'string' ? o : o?.encoding) ? b.toString(typeof o === 'string' ? o : o.encoding) : Buffer.from(b);
fs.readFileSync = function(file, options) { const b = select(file); return b ? decode(b, options) : original(file, options); };
const asyncRead = fs.readFile.bind(fs), promiseRead = fs.promises.readFile.bind(fs.promises);
fs.readFile = function(file, options, callback) {
  if (typeof options === 'function') { callback = options; options = undefined; }
  let b; try { b = select(file); } catch (e) { queueMicrotask(() => callback(e)); return; }
  if (!b) return asyncRead(file, options, callback);
  queueMicrotask(() => callback(null, decode(b, options)));
};
fs.promises.readFile = async function(file, options) { const b = select(file); return b ? decode(b, options) : promiseRead(file, options); };
for (const extension of ['.js', '.cjs', '.json']) {
  const previous = Module._extensions[extension] || Module._extensions['.js'];
  Module._extensions[extension] = (mod, file) => {
    const body = select(file); if (!body) return previous(mod, file);
    if (extension === '.json') mod.exports = JSON.parse(body.toString()); else mod._compile(body.toString(), file);
  };
}
// Assert that every actual instantiation, including real guest Workers, uses
// the atomically captured standard module. Never alter or reconstruct it.
const wasmHash = process.env.LTRIS_WASM_SHA256, wasmSize = Number(process.env.LTRIS_WASM_SIZE);
const approved = new WeakSet(); let moduleEvent = 0;
function moduleNote(kind, extra = {}) {
  fs.writeFileSync(path.join(process.env.LTRIS_VIEW_OUT, `module-event-${process.pid}-${wt.threadId}-${++moduleEvent}.json`),
    JSON.stringify({kind,pid:process.pid,threadId:wt.threadId,sha256:wasmHash,size:wasmSize,...extra})+'\n',{flag:'wx'});
}
const compile = WebAssembly.compile;
WebAssembly.compile = function(bytes) {
  const body = Buffer.from(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength);
  if (body.length !== wasmSize || sha(body) !== wasmHash) throw Error('unexpected runtime WASM buffer');
  fs.writeFileSync(path.join(process.env.LTRIS_VIEW_OUT, `module-${process.pid}-${wt.threadId}.json`),
    JSON.stringify({pid:process.pid, threadId:wt.threadId, size:body.length, sha256:sha(body), actualCompile:true}) + '\n', {flag:'wx'});
  return compile.call(WebAssembly, bytes).then(module => { approved.add(module); return module; });
};
const post = wt.Worker.prototype.postMessage;
wt.Worker.prototype.postMessage = function(message, ...rest) {
  if (message?.module instanceof WebAssembly.Module) {
    if (!approved.has(message.module)) throw Error('Worker received unverified module');
    moduleNote('post-compiled-module',{targetThreadId:this.threadId,endpointIdentity:message.endpointIdentity});
  }
  return post.call(this,message,...rest);
};
if (wt.parentPort) wt.parentPort.on('message', message => {
  if (message?.module instanceof WebAssembly.Module) {
    // Node structured clone transports the actual compiled Module object
    // posted above, not a mutable filesystem path or a second module body.
    approved.add(message.module); moduleNote('receive-compiled-module',{endpointIdentity:message.endpointIdentity});
  }
});
const instantiate = WebAssembly.instantiate;
WebAssembly.instantiate = function(module, ...rest) {
  if (!(module instanceof WebAssembly.Module) || !approved.has(module)) throw Error('unverified actual instantiation');
  moduleNote('instantiate-compiled-module');
  return instantiate.call(WebAssembly,module,...rest);
};
process.once('exit', code => {
  fs.writeFileSync(path.join(process.env.LTRIS_VIEW_OUT, `source-${process.pid}-${wt.threadId}.json`),
    JSON.stringify({head:manifest.head, poolSHA256:sha(pool), pid:process.pid, threadId:wt.threadId, code,
      exercised:[...ledger].map(p => ({path:p,sha256:sha(bodies.get(p))}))}) + '\n', {flag:'wx'});
});
