'use strict';
// Offline inputs for the legacy composition contract, not a gameplay recording.
const assert = require('assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const {createHash} = require('crypto');
const root = path.resolve(__dirname, '../..');
const sha = b => createHash('sha256').update(b).digest('hex');
const fonts = ['System', 'Fixedsys', 'Terminal', 'MSSansSerif', 'SmallFonts'].map(n => 'fonts/' + n + '.fon');
function systemFiles() {
  return require('../../lib/process-boot').SYSTEM_DATA_FILES.map(f => {
    const bytes = fs.readFileSync(path.join(root, f.url));
    return {path: f.url, bytes: bytes.length, sha256: sha(bytes), exists: true};
  });
}
function pins() {
  // A small tracked payload exercises three concurrent owning sessions without
  // requiring the ignored original game corpus. It is never labeled game media.
  return {files: [...systemFiles(), ...[...fonts, 'index.html',
    'test/fixtures/return-fire-body-entry.cjs'].map(relative => {
    const bytes = fs.readFileSync(path.join(root, relative));
    return {path: relative, bytes: bytes.length, sha256: sha(bytes)};
  })]};
}
function absent(ledger, relative, url, status, method, base) {
  return status === 404 && method === 'GET' && !url.search &&
    ledger.files.some(f => !f.exists && f.missingRequests.includes(relative) &&
      !fs.existsSync(path.join(base, f.path)));
}
async function exercise({origin, page}) {
  // Execute the production host's actual bundle refusal and ordinary per-file
  // fetch paths. No host constructor, WASM, browser or guest is instantiated.
  const context = {console, URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    window: {}, location: {search: '', href: origin + '/index.html'},
    fetch: async (url, options) => {
      const r = await fetch(new URL(url, origin), options);
      const bytes = Buffer.from(await r.arrayBuffer());
      page.emit('response', {url: () => r.url, status: () => r.status, buffer: async () => bytes});
      return new Response(bytes, {status: r.status, headers: r.headers});
    }};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'host.js'), 'utf8') +
    '\nglobalThis.Host = WineAssembly;', context);
  const Host = context.Host;
  const entries = fonts.map(name => ({url: name, name}));
  assert.equal((await Host._prefetchBundled(entries)).size, 0);
  assert(Host._bundleUnsupported);
  for (const file of fonts) {
    const bytes = await Host.fetchAssetBytes(file);
    assert.equal(sha(bytes), sha(fs.readFileSync(path.join(root, file))));
  }
}
module.exports = {root, sha, fonts, systemFiles, pins, absent, exercise};
