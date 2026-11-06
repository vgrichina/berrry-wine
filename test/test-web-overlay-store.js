#!/usr/bin/env node
'use strict';

// Real OPFS and Web Locks across two same-origin tabs. This exercises the
// browser storage implementation without booting an unrelated guest program.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const { startStaticServer } = require('./static-server');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const sourceResponses = [];
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function startServer() {
  return startStaticServer({ root: ROOT, handleRequest(request, response) {
    if (/^\/lib\/[a-z-]+(?:\.generated)?\.js$/.test(new URL(request.url, 'http://localhost').pathname)) return false;
    response.writeHead(404); response.end(); return true;
  } });
}

async function preparePage(browser, base) {
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  page.on('response', response => {
    const pathname = new URL(response.url()).pathname;
    if (!pathname.startsWith('/lib/')) return;
    sourceResponses.push(response.buffer().then(bytes => {
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
      const localSha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, pathname))).digest('hex');
      assert.strictEqual(sha256, localSha256, `served source changed: ${pathname}`);
      return { path: pathname, sha256, bytes: bytes.length };
    }));
  });
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/__overlay-store-test__.html') {
      void request.respond({ status: 200, contentType: 'text/html',
        body: '<!doctype html>' + ['region-map.generated', 'mem-utils', 'byte-provider', 'filesystem', 'overlay-store', 'vfs-overlay'].map(name => `<script src="/lib/${name}.js"></script>`).join('') });
    } else void request.continue();
  });
  await page.goto(new URL('/__overlay-store-test__.html', base).href, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.OverlayStore);
  assert(await page.evaluate(() => !!navigator.storage.getDirectory && !!navigator.locks),
    'the browser must provide real OPFS and Web Locks');
  return page;
}

(async () => {
  if (!fs.existsSync(CHROME)) {
    console.log('SKIP Chrome not found for OPFS browser test');
    return;
  }
  const server = process.env.BASE_URL ? null : await startServer();
  const base = process.env.BASE_URL || `http://127.0.0.1:${server.address().port}`;
  const scope = 'test-' + crypto.randomUUID();
  let browser;
  let first;
  try {
    browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
      args: ['--no-sandbox', '--no-first-run', '--disable-gpu'] });
    console.log('RUNTIME_IDENTITY ' + JSON.stringify({ pid: browser.process().pid, port: server ? server.address().port : null,
      profile: browser.process().spawnargs.find(arg => arg.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length) || null }));
    const pages = await Promise.all([preparePage(browser, base), preparePage(browser, base)]);
    [first] = pages;
    await Promise.all(pages.map(page => page.evaluate(async scope => {
      window.overlay = OverlayStore.opfsStore(scope);
      await window.overlay.list(); // Both stores see the same empty index first.
    }, scope)));

    await Promise.all(pages.map((page, tab) => page.evaluate(async tab => {
      for (let i = 0; i < 12; i++) {
        await window.overlay.writeBatch([{
          path: `c:\\tab-${tab}\\save-${i}`, kind: 'file',
          data: new TextEncoder().encode(`tab=${tab};save=${i};payload`),
        }]);
      }
    }, tab)));

    // Two additional stores in one tab exercise the same-origin instance
    // case separately from independent JS realms in different tabs.
    await first.evaluate(async scope => {
      const a = OverlayStore.opfsStore(scope), b = OverlayStore.opfsStore(scope);
      await Promise.all([a.list(), b.list()]);
      await Promise.all([a, b].map((store, i) => store.writeBatch([{
        path: `c:\\same-tab-${i}`, kind: 'file', data: Uint8Array.of(20 + i),
      }])));
    }, scope);

    for (const page of pages) {
      await page.reload({ waitUntil: 'load' });
      const snapshot = await page.evaluate(async scope => {
        const store = OverlayStore.opfsStore(scope);
        const records = await store.readSnapshot();
        const readbacks = [];
        for (const record of records) {
          if (record.readError) throw record.readError;
          const reopened = await store.read(record.path);
          readbacks.push({ path: record.path, size: record.size,
            data: Array.from(record.data), reopened: Array.from(reopened) });
        }
        return readbacks;
      }, scope);
      assert.strictEqual(snapshot.length, 26, 'different writers must preserve every record');
      for (const record of snapshot) {
        const match = /tab-(\d)\\save-(\d+)$/.exec(record.path);
        const expected = match
          ? [...Buffer.from(`tab=${match[1]};save=${match[2]};payload`)]
          : [20 + Number(record.path.slice(-1))];
        assert.deepStrictEqual(record.data, expected, `snapshot corruption: ${record.path}`);
        assert.deepStrictEqual(record.reopened, expected, `read corruption: ${record.path}`);
        assert.strictEqual(record.size, expected.length);
      }
    }

    // Actual OPFS payloads plus public host imports and VFS lazy reads. Every
    // source byte is generated on demand; this cannot hide a whole-base copy.
    await first.evaluate(async scope => {
      const size = 128 * 1024 * 1024 + 37;
      const pattern = at => (at * 29 + Math.floor(at / 251) * 7) & 255;
      window.sparseFetched = 0;
      window.mountSparse = () => {
        const vfs = new FilesystemImports.VirtualFS();
        vfs.setProviderFile('C:\\large.dat', { provider: byteProvider.cached({ size,
          async readRange(off, len) {
            window.sparseFetched += len;
            return Uint8Array.from({ length: len }, (_, n) => pattern(off + n));
          },
        }, { chunkSize: 4096, maxChunks: 2, readAhead: 0 }) });
        return vfs;
      };
      const vfs = window.mountSparse();
      const overlay = VfsOverlay.attach(vfs, { store: OverlayStore.opfsStore(scope) });
      const memory = new ArrayBuffer(65536);
      new Uint8Array(memory).set(new TextEncoder().encode('C:\\large.dat\0'), 1024);
      const imports = FilesystemImports.createFilesystemImports({ vfs, getMemory: () => memory });
      const h = imports.fs_create_file(1024, 0x40000000, 3, 0, 0);
      if (!h || h === 0xffffffff) throw new Error('lazy write open failed');
      vfs.setFilePointer(h, 400003, 0);
      if (!vfs.writeFile(h, Uint8Array.of(11, 12, 13), 3).ok) throw new Error('partial write failed');
      vfs.setFilePointer(h, size + 10, 0);
      if (!vfs.writeFile(h, Uint8Array.of(77), 1).ok) throw new Error('extension failed');
      const result = await overlay.flush();
      if (result.failed || window.sparseFetched !== 0) throw new Error('checkpoint fetched base or failed');
      vfs.closeHandle(h);
    }, scope);
    await first.reload({ waitUntil: 'load' });
    const sparseResult = await first.evaluate(async scope => {
      const size = 128 * 1024 * 1024 + 37;
      const pattern = at => (at * 29 + Math.floor(at / 251) * 7) & 255;
      let fetched = 0;
      const vfs = new FilesystemImports.VirtualFS();
      vfs.setProviderFile('C:\\large.dat', { provider: byteProvider.cached({ size,
        async readRange(off, len) { fetched += len; return Uint8Array.from({ length: len }, (_, n) => pattern(off + n)); },
      }, { chunkSize: 4096, maxChunks: 2, readAhead: 0 }) });
      const store = OverlayStore.opfsStore(scope);
      const report = await VfsOverlay.attach(vfs, { store }).hydrate();
      if (report.errors.length) throw new Error(JSON.stringify(report.errors));
      const hydratedFetch = fetched;
      const h = vfs.createFile('C:\\large.dat', 0x80000000, 3);
      const read = async (off, len) => {
        vfs.setFilePointer(h, off, 0);
        const out = new Uint8Array(len);
        let result = vfs.readFile(h, out, len);
        if (result.pending) { await vfs.fillPendingRead(result.pending); result = vfs.readFile(h, out, len); }
        if (!result.ok || result.bytesRead !== len) throw new Error('lazy read failed');
        return [...out];
      };
      const prefix = await read(399999, 11), tail = await read(size - 2, 13);
      vfs.closeHandle(h);
      return { hydratedFetch, fetched, prefix, tail,
        payload: (await store.read('c:\\large.dat')).length,
        expectedPrefix: [pattern(399999), pattern(400000), pattern(400001), pattern(400002), 11, 12, 13,
          pattern(400006), pattern(400007), pattern(400008), pattern(400009)],
        expectedTail: [pattern(size - 2), pattern(size - 1), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 77] };
    }, scope);
    assert.strictEqual(sparseResult.hydratedFetch, 0);
    assert.strictEqual(sparseResult.payload, 4);
    assert.deepStrictEqual(sparseResult.prefix, sparseResult.expectedPrefix);
    assert.deepStrictEqual(sparseResult.tail, sparseResult.expectedTail);
    assert.ok(sparseResult.fetched <= 16384, JSON.stringify(sparseResult));
    console.log('PASS real Chrome OPFS: sparse host-import partial write/extension survives page reload, four-byte payload, bounded base reads', JSON.stringify(sparseResult));
    console.log('SOURCE_IDENTITIES ' + JSON.stringify(await Promise.all(sourceResponses)));
    console.log('PASS real Chrome OPFS: concurrent two-tab and same-tab stores preserve 26 files across reload and eager snapshot reads');
  } finally {
    try {
      if (first && !first.isClosed()) {
        await first.evaluate(scope => OverlayStore.removeOpfsScope(scope), scope);
      }
    } finally {
      if (browser) await browser.close();
      if (server) await new Promise(resolve => server.close(resolve));
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
