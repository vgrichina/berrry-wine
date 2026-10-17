'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {createHash, webcrypto} = require('node:crypto');
const {startStaticServer, closeServer} = require('./static-server');
const {preflightDelivery, preflightAssets, installPageDeliveryGuard} = require('../tools/kkrieger-canonical-delivery');
const bytes = Buffer.from('small canonical delivery fixture');
const hash = createHash('sha256').update(bytes).digest('hex');

async function fixture(t, options = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-delivery-'));
  const root = path.join(base, 'root');
  fs.mkdirSync(root);
  const build = path.join(options.external ? base : root, 'build');
  fs.mkdirSync(build);
  fs.writeFileSync(path.join(build, 'wine-assembly.wasm'), bytes);
  if (options.external) fs.symlinkSync(build, path.join(root, 'build'));
  const server = await startStaticServer({root, handleRequest: options.handleRequest});
  t.after(async () => { await closeServer(server); fs.rmSync(base, {recursive: true, force: true}); });
  return {root, url: 'http://127.0.0.1:' + server.address().port + '/build/wine-assembly.wasm'};
}

test('contained canonical bytes are verified through the actual static server', async t => {
  const {root, url} = await fixture(t);
  const receipt = await preflightDelivery(root, url, hash);
  assert.equal(receipt.status, 200);
  assert.equal(receipt.sha256, hash);
  assert.equal(receipt.bytes, bytes.length);
});
test('external build symlink is rejected despite matching local bytes; server returns 403', async t => {
  const {root, url} = await fixture(t, {external: true});
  assert.equal((await fetch(url)).status, 403);
  await assert.rejects(preflightDelivery(root, url, hash), /outside served root/);
});
test('HTTP 403 is rejected even when local module matches', async t => {
  const {root, url} = await fixture(t, {handleRequest: (_req, res) => {
    res.writeHead(403); res.end(bytes); return true;
  }});
  await assert.rejects(preflightDelivery(root, url, hash), /HTTP 403/);
});
test('HTTP 200 wrong body is rejected despite matching local file', async t => {
  const {root, url} = await fixture(t, {handleRequest: (_req, res) => {
    res.writeHead(200); res.end('substituted bytes'); return true;
  }});
  await assert.rejects(preflightDelivery(root, url, hash), /hash mismatch/);
});

test('asset preflight catches missing parent manifest even when EXE is present', async t => {
  const {root, url} = await fixture(t);
  fs.mkdirSync(path.join(root, 'game'));
  fs.writeFileSync(path.join(root, 'game/demo.exe'), bytes);
  const origin = new URL(url).origin;
  const pins = {'game/demo.exe': hash, '.wine-assembly-browser.json': hash};
  await assert.rejects(preflightAssets(root, origin, pins), /ENOENT/);
  fs.writeFileSync(path.join(root, '.wine-assembly-browser.json'), bytes);
  const receipts = await preflightAssets(root, origin, pins);
  assert.deepEqual(receipts.map(r => r.path), Object.keys(pins));
  assert(receipts.every(r => r.status === 200 && r.sha256 === hash));
});
for (const [status, body, expected] of [[404, bytes, /HTTP 404/], [200, 'wrong manifest', /hash mismatch/]]) {
  test('asset preflight rejects served manifest ' + status + ' or substituted bytes', async t => {
    const {root, url} = await fixture(t, {handleRequest: (req, res) => {
      if (req.url !== '/.wine-assembly-browser.json') return false;
      res.writeHead(status); res.end(body); return true;
    }});
    fs.writeFileSync(path.join(root, '.wine-assembly-browser.json'), bytes);
    await assert.rejects(preflightAssets(root, new URL(url).origin,
      {'.wine-assembly-browser.json': hash}), expected);
  });
}

function pageGuard(body = bytes, status = 200) {
  let calls = 0;
  const context = vm.createContext({URL, Uint8Array, crypto: webcrypto,
    location: {href: 'http://127.0.0.1:1234/', origin: 'http://127.0.0.1:1234'},
    fetch: async () => { calls++; return new Response(body, {status}); }});
  vm.runInContext('(' + installPageDeliveryGuard.toString() + ')(' + JSON.stringify(hash) + ')', context);
  return {context, calls: () => calls};
}
test('page fetch returns canonical bytes only after its digest is verified', async () => {
  const {context} = pageGuard();
  const response = await context.fetch('/build/wine-assembly.wasm?v=test');
  assert.equal(context.__kkriegerDelivery.status, 'verified');
  assert.equal(context.__kkriegerDelivery.sha256, hash);
  assert.equal(Buffer.from(await response.arrayBuffer()).equals(bytes), true);
});
for (const [name, body, status, error] of [
  ['403', bytes, 403, /HTTP 403/], ['wrong hash', 'substituted', 200, /hash mismatch/],
]) test('page prevents ' + name + ' bytes reaching host and forbids WAT fallback', async () => {
  const {context, calls} = pageGuard(body, status);
  await assert.rejects(context.fetch('/build/wine-assembly.wasm'), error);
  await assert.rejects(context.fetch('/src/main.watx?v=1'), /compilation forbidden/);
  assert.equal(calls(), 1);
  assert.equal(context.__kkriegerDelivery.status, 'failed');
});
test('page rejects compat substitution and remains failed after a later valid fetch', async () => {
  const {context, calls} = pageGuard();
  await assert.rejects(context.fetch('/build/wine-assembly.compat.wasm'), /Unexpected canonical/);
  assert.equal(calls(), 0);
  await assert.rejects(context.fetch('/build/wine-assembly.wasm'), /Unexpected canonical/);
  assert.equal(context.__kkriegerDelivery.status, 'failed');
});
