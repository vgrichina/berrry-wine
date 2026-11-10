#!/usr/bin/env node
'use strict';
// The __bundle route (lib/file-bundle.js): many whole files in one response,
// read back by host.js WineAssembly.parseFileBundle. Both servers that answer
// it must check every name exactly as a single GET of it would.
const assert = require('assert');
const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { startStaticServer } = require('./static-server');
const { readBundle } = require('../lib/file-bundle');
const { createServer } = require('../tools/dev-server');
const { createEmulatorHandler, LOCAL_DESKTOP } = require('../ops/emulator-server');

const ROOT = path.join(__dirname, '..');
const context = { console, TextDecoder, URL };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'host.js'), 'utf8') +
  '\n;globalThis.WineAssembly = WineAssembly;', context);
const parse = bytes => context.WineAssembly.parseFileBundle(new Uint8Array(bytes));

function get(port, url) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: url }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}
const header = body => JSON.parse(body.subarray(8, 8 + body.readUInt32LE(4)).toString('utf8'));
const listen = server => new Promise(r => server.listen(0, '127.0.0.1', () => r(server.address().port)));

(async () => {
  // Round trip, a missing file, and a file of zero bytes.
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'file-bundle-'));
  try {
    await fsp.writeFile(path.join(dir, 'a.dll'), Buffer.from('MZ dll bytes'));
    await fsp.writeFile(path.join(dir, 'empty.ini'), Buffer.alloc(0));
    const body = await readBundle(['a.dll', 'gone.cfg', 'empty.ini'],
      async name => (name === 'gone.cfg' ? null : path.join(dir, name)));
    assert.deepStrictEqual(header(body),
      [{ f: 'a.dll', size: 12 }, { f: 'gone.cfg', status: 404 }, { f: 'empty.ini', size: 0 }]);
    const files = parse(body);
    assert.deepStrictEqual([...files.keys()], ['a.dll', 'empty.ini'], 'only the files that came');
    assert.strictEqual(Buffer.from(files.get('a.dll')).toString(), 'MZ dll bytes');
    assert.strictEqual(files.get('empty.ini').length, 0);
    assert.strictEqual(parse(Buffer.from('<!doctype html><html></html>')), null,
      "a static host's index page is not a bundle");
    assert.strictEqual(parse(body.subarray(0, body.length - 3)), null, 'a truncated body is refused');
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
  console.log('ok: bundle round trip, missing entry, empty file, non-bundle and truncated bodies');

  // Which URLs can go in a bundle: the name is the page-relative path the
  // server resolves. browser-shell hands manifest entries over as hrefs.
  {
    const name = (url, page) => context.WineAssembly.bundleName(url, page);
    const page = 'http://127.0.0.1:8199/emulator/?app=game';
    assert.strictEqual(name('test/binaries/a.dll', page), 'test/binaries/a.dll');
    assert.strictEqual(name('http://127.0.0.1:8199/emulator/test/binaries/My%20Game/a.dll', page),
      'test/binaries/My Game/a.dll', 'a same-origin href under the page dir, decoded');
    assert.strictEqual(name('http://elsewhere.example/emulator/a.dll', page), null, 'another origin');
    assert.strictEqual(name('http://127.0.0.1:8199/other/a.dll', page), null, 'outside the page dir');
    assert.strictEqual(name('../secret', page), null);
    assert.strictEqual(name('http://127.0.0.1:8199/emulator/a.dll?v=2', page), null, 'a query is not a file name');
    assert.strictEqual(name('data:application/octet-stream,xx', page), null);
  }
  console.log('ok: bundleName takes relative and same-origin page-dir URLs only');

  // tools/dev-server.js: names are page-relative and confined to ROOT.
  {
    const server = createServer({ quiet: true });
    const port = await listen(server);
    try {
      const res = await get(port, '/__bundle?f=package.json&f=lib%2Ffile-bundle.js&f=..%2F..%2Fetc%2Fpasswd&f=no%2Fsuch.file');
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(header(res.body).map(e => e.status || 'ok'), ['ok', 'ok', 404, 404],
        'path traversal and a missing file are 404 entries');
      const files = parse(res.body);
      assert.deepStrictEqual(Buffer.from(files.get('package.json')),
        fs.readFileSync(path.join(ROOT, 'package.json')), 'the bytes are the file on disk');
    } finally {
      await new Promise(r => server.close(r));
    }
  }
  console.log('ok: dev-server __bundle serves repo files and refuses traversal');

  // ops/emulator-server.js: only allowlisted names, never index.html.
  {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'emulator-bundle-'));
    const files = {
      'index.html': '<html>\n' + LOCAL_DESKTOP + '\n</html>',
      'lib/apps.js': "module.exports={APPS:{game:{exe:'test/binaries/game/game.exe',files:['test/binaries/game/data.bin']}},DESKTOP_APPS:[['game','Game']]};",
      'build/wine-assembly.wasm': 'wasm',
      'test/binaries/game/game.exe': 'executable',
      'test/binaries/game/data.bin': '0123456789',
      'scratch/secret.txt': 'secret',
    };
    for (const [name, content] of Object.entries(files)) {
      await fsp.mkdir(path.dirname(path.join(root, name)), { recursive: true });
      await fsp.writeFile(path.join(root, name), content);
    }
    const serve = createEmulatorHandler(root);
    const server = await startStaticServer({ root, async handleRequest(req, res) {
      if (!await serve(req, res)) { res.writeHead(404); res.end(); }
    } });
    const port = server.address().port;
    try {
      const res = await get(port, '/emulator/__bundle?f=test%2Fbinaries%2Fgame%2Fdata.bin' +
        '&f=scratch%2Fsecret.txt&f=index.html&f=..%2Flib%2Fapps.js');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers['cross-origin-embedder-policy'], 'require-corp');
      assert.deepStrictEqual(header(res.body).map(e => e.status || e.size), [10, 404, 404, 404],
        'outside the allowlist, the rewritten index page and traversal are all refused');
      assert.strictEqual(Buffer.from(parse(res.body).get('test/binaries/game/data.bin')).toString(), '0123456789');
    } finally {
      await new Promise(r => server.close(r));
      await fsp.rm(root, { recursive: true, force: true });
    }
  }
  console.log('ok: emulator __bundle applies the per-file allowlist');
  console.log('PASS test-file-bundle');
})().catch(err => { console.error(err); process.exit(1); });
