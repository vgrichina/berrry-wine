'use strict';

// An explicit byte adapter for the unchanged accepted entry. Never stages files.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const SOURCE = '1329b1ba6eb00144ff77d4cd92a8513d4fc953ad';
const ACCEPTED = '6d5121b5f96ee6032a9e347e2db64db29c478518';
const ENTRY = 'tools/mdk2-construction-driver-integration.cjs';
const ENTRY_SHA = '6cdfd208f802daac8cb5f3fd67f51f07c5195b294a9c86a58d8c168a973a378f';
const PINS_SHA = '4a8bb12508a5f6b402880a3af9532e28ca4bd7fc18fb94bd0ccaf6c9c3ceb4ed';
const BASE = 'scratch/runs/20261104-mdk2-fresh-pending-scene/';
const nativeRead = fs.readFileSync;
const resolvers = new WeakSet();
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function relative(name) {
  assert(typeof name === 'string' && name.length && !name.includes('\\') && !name.includes('%') && !name.includes('\0'), 'invalid runtime path');
  assert(!path.isAbsolute(name) && name.split('/').every(p => p && p !== '.' && p !== '..'), 'noncanonical runtime path');
  return name;
}
function local(root, name) {
  relative(name);
  assert.equal(fs.realpathSync(root), root, 'noncanonical root');
  let file = root;
  for (const part of name.split('/')) {
    file = path.join(file, part);
    assert(!fs.lstatSync(file).isSymbolicLink(), 'symlink runtime path: ' + name);
  }
  assert(fs.statSync(file).isFile(), 'not a runtime file');
  return file;
}
function readLocal(root, name) {
  const file = local(root, name);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(fd), bytes = nativeRead(fd), after = fs.fstatSync(fd);
    assert(before.isFile() && before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs, 'runtime changed during read');
    assert.equal(fs.realpathSync(file), file, 'runtime path changed during read');
    return bytes;
  } finally { fs.closeSync(fd); }
}
function exact(bytes, pin) {
  assert.equal(bytes.length, pin.bytes, 'runtime size mismatch: ' + pin.path);
  assert.equal(sha(bytes), pin.sha256, 'runtime SHA mismatch: ' + pin.path);
  return bytes;
}
function git(root, revision, name) {
  relative(name);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  Object.assign(env, {GIT_CONFIG_NOSYSTEM:'1', GIT_CONFIG_GLOBAL:'/dev/null', GIT_NO_REPLACE_OBJECTS:'1'});
  return cp.execFileSync('git', ['--no-replace-objects', 'show', revision + ':' + name], {cwd:root, env, timeout:10000, maxBuffer:4000000, stdio:['ignore','pipe','pipe']});
}
function createResolver({root = ROOT, manifestBytes} = {}) {
  assert.equal(root, path.resolve(root), 'absolute canonical root required');
  assert.equal(fs.realpathSync(root), root, 'symlink root');
  const manifest = manifestBytes === undefined ? zlib.gunzipSync(readLocal(root, BASE + 'runtime-pins.json.gz')) : Buffer.from(manifestBytes);
  assert.equal(sha(manifest), PINS_SHA, 'stale original manifest');
  const pins = JSON.parse(manifest);
  assert.equal(pins.commit, SOURCE); assert.equal(pins.files.length, 432);
  const rows = new Map(), sources = new Map();
  for (const row of pins.files) {
    relative(row.path); assert(!rows.has(row.path), 'duplicate runtime path');
    rows.set(row.path, Object.freeze({...row}));
  }
  const modules = new Map(pins.moduleFiles.map(row => [row.path, row]));
  for (const row of rows.values()) {
    const module = modules.get(row.path);
    if (module) {
      assert.equal(module.bytes, row.bytes); assert.equal(module.sha256, row.sha256);
      relative(module.localReference);
      let storage = module.localReference;
      try { fs.lstatSync(path.join(root, storage)); } catch (e) { if (e.code !== 'ENOENT') throw e; storage += '.gz'; }
      sources.set(row.path, Object.freeze({kind:storage.endsWith('.gz') ? 'gzip' : 'retained', path:storage}));
    } else {
      // Existing matching files stay path references. A later change must fail;
      // it cannot silently switch to Git or to a different live path.
      const bytes = readLocal(root, row.path);
      if (bytes.length === row.bytes && sha(bytes) === row.sha256) sources.set(row.path, Object.freeze({kind:'live', path:row.path}));
      else {
        exact(git(root, SOURCE, row.path), row);
        sources.set(row.path, Object.freeze({kind:'git', commit:SOURCE, path:row.path}));
      }
    }
  }
  function read(name) {
    relative(name);
    const pin = rows.get(name), source = sources.get(name);
    assert(pin && source, 'foreign runtime path: ' + name);
    // Reject symlink aliases even when the selected bytes come from Git.
    local(root, name);
    let bytes = source.kind === 'git' ? git(root, SOURCE, source.path) : readLocal(root, source.path);
    if (source.kind === 'gzip') bytes = zlib.gunzipSync(bytes, {maxOutputLength:pin.bytes + 1});
    return exact(bytes, pin);
  }
  function verify() {
    return [...rows.values()].map(row => { const bytes = read(row.path); return {path:row.path, bytes:bytes.length, sha256:sha(bytes), source:sources.get(row.path)}; });
  }
  verify();
  const resolver = Object.freeze({root, manifest:() => Buffer.from(manifest), files:() => [...rows.values()].map(r => ({...r})), read, verify});
  resolvers.add(resolver); return resolver;
}

function requestPath(raw) {
  assert(typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//'), 'foreign request target');
  const pathname = decodeURIComponent(raw.split('?')[0]);
  return relative(pathname === '/' ? 'index.html' : pathname.slice(1));
}
function handler(resolver, options, serverModule) {
  return async (req, res) => {
    try {
      assert(req.method === 'GET' || req.method === 'HEAD', 'unsupported method');
      const name = requestPath(req.url), bytes = resolver.read(name);
      if (options.handleRequest) assert.equal(await options.handleRequest(req, res), false, 'foreign HTTP handler');
      assert(!res.headersSent && !res.writableEnded, 'foreign HTTP response');
      const resolved = {file:path.join(resolver.root, name), pathname:'/' + name, stat:{size:bytes.length, isFile:() => true}, status:200};
      // Preserve the original driver's audit and first-failure callback.
      const extra = typeof options.headers === 'function' ? options.headers(req, resolved) : (options.headers || {});
      const headers = {...extra, 'Content-Type':serverModule.mimeType(name), 'Content-Length':bytes.length,
        'Cache-Control':'no-store', 'Cross-Origin-Opener-Policy':'same-origin', 'Cross-Origin-Embedder-Policy':'require-corp', 'Accept-Ranges':'bytes'};
      let body = bytes, status = 200;
      if (req.headers.range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        let start = m && m[1] !== '' ? Number(m[1]) : NaN;
        let end = m && m[2] !== '' ? Number(m[2]) : bytes.length - 1;
        if (m && m[1] === '' && m[2] !== '') { start = Math.max(0, bytes.length - Number(m[2])); end = bytes.length - 1; }
        if (!m || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= bytes.length || end < start) {
          res.writeHead(416, {...headers, 'Content-Length':0, 'Content-Range':`bytes */${bytes.length}`}); res.end(); return true;
        }
        end = Math.min(end, bytes.length - 1); body = bytes.subarray(start, end + 1); status = 206;
        headers['Content-Length'] = body.length; headers['Content-Range'] = `bytes ${start}-${end}/${bytes.length}`;
      }
      res.writeHead(status, headers); res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      if (res.headersSent) res.destroy(error);
      else { res.writeHead(403, {'Cache-Control':'no-store'}); res.end('runtime request rejected'); }
    }
    return true;
  };
}
async function startServer(resolver, options = {}, start) {
  assert(resolvers.has(resolver), 'unverified resolver');
  assert.equal(options.root || resolver.root, resolver.root, 'foreign server root');
  assert(!options.host || options.host === '127.0.0.1', 'loopback only');
  assert(!options.rewritePath && !options.allowedRealRoots && !options.mimeType && !options.mimeTypes, 'foreign server mapping');
  assert(options.crossOriginIsolated !== false && options.cacheControl !== false, 'isolation/no-store required');
  const serverModule = require(path.join(resolver.root, 'test/static-server.js'));
  return (start || serverModule.startStaticServer)({...options, root:resolver.root, host:'127.0.0.1', crossOriginIsolated:true,
    handleRequest:handler(resolver, options, serverModule)});
}
async function close(server) {
  server.closeAllConnections(); await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
}
async function verifyHTTP(resolver, server) {
  assert(resolvers.has(resolver), 'unverified resolver');
  const rows = [];
  const deadline = Date.now() + 30000;
  for (const pin of resolver.files()) {
    assert(Date.now() < deadline, 'HTTP prerequisite deadline');
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/' + pin.path, {signal:AbortSignal.timeout(Math.max(1, Math.min(10000,deadline-Date.now())))});
    assert.equal(response.status, 200, pin.path);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal(response.headers.get('cross-origin-embedder-policy'), 'require-corp');
    const bytes = exact(Buffer.from(await response.arrayBuffer()), pin);
    rows.push({path:pin.path, bytes:bytes.length, sha256:sha(bytes)});
  }
  return rows;
}
let active = false;
async function installAdapter(resolver) {
  assert(resolvers.has(resolver), 'unverified resolver');
  assert(!active && fs.readFileSync === nativeRead, 'adapter requires clean dedicated process');
  exact(readLocal(resolver.root, ENTRY), {path:ENTRY, bytes:git(resolver.root, ACCEPTED, ENTRY).length, sha256:ENTRY_SHA});
  const entry = require(path.join(resolver.root, ENTRY));
  const inspection = entry.inspect(); // Original 111 helpers, observer, four Git dependencies and modules.
  const filesystem = resolver.verify();
  const proofServer = await startServer(resolver);
  let http;
  try { http = await verifyHTTP(resolver, proofServer); } finally { await close(proofServer); }
  const serverModule = require(path.join(resolver.root, 'test/static-server.js')), originalStart = serverModule.startStaticServer;
  const names = new Set(resolver.files().map(r => r.path));
  const read = function(file, options) {
    if (typeof file === 'string') {
      const absolute = path.resolve(file), name = path.relative(resolver.root, absolute);
      if (names.has(name)) {
        assert.equal(file, absolute, 'noncanonical filesystem pin path');
        const bytes = resolver.read(name), encoding = typeof options === 'string' ? options : options?.encoding;
        return encoding ? bytes.toString(encoding) : bytes;
      }
    }
    return Reflect.apply(nativeRead, this, arguments);
  };
  const start = options => startServer(resolver, options, originalStart);
  fs.readFileSync = read; serverModule.startStaticServer = start; active = true;
  return {inspection, filesystem, http, restore() {
    assert(fs.readFileSync === read, 'filesystem adapter replaced');
    // The accepted endpoint wrapper may wrap start after installation. Restore
    // only in the dedicated process after its server is closed.
    fs.readFileSync = nativeRead; serverModule.startStaticServer = originalStart; active = false;
  }};
}
module.exports = {ROOT, SOURCE, ACCEPTED, ENTRY, PINS_SHA, sha, exact, relative, requestPath, createResolver, startServer, verifyHTTP, close, installAdapter};
if (require.main === module) {
  // Deliberately no --run mode: gameplay requires a fresh separate assignment.
  (async () => {
    assert.equal(process.argv.length, 3); assert.equal(process.argv[2], '--check');
    const resolver = createResolver(), adapter = await installAdapter(resolver);
    try { console.log(JSON.stringify({status:'exact-filesystem-and-http-prerequisites', pinsSHA256:PINS_SHA,
      filesystem:adapter.filesystem, http:adapter.http, accepted:adapter.inspection.status, gameplay:false}, null, 2)); }
    finally { adapter.restore(); }
  })().catch(e => { console.error(e.stack); process.exitCode = 1; });
}
