#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { startStaticServer, closeServer } = require('./static-server');
const { checkSurfaceJournal } = require('./helpers/surface-journal-browser');
const root = path.resolve(__dirname, '..');
const evidence = { startedAt: new Date().toISOString(), errors: [] };
let browser, server;
(async () => {
  server = await startStaticServer({ root, crossOriginIsolated: true, handleRequest(req, res) {
    if (req.url === '/journal-test') {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><script src="/lib/render-worker.js"></script>'); return true; }
    return false;
  } });
  browser = await require('puppeteer').launch({ headless: true,
    executablePath: process.env.CHROME || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
  evidence.browser = await browser.version(); evidence.pid = browser.process().pid;
  browser.process().once('exit', (code, signal) => { evidence.exit = { code, signal }; });
  const page = await browser.newPage();
  page.on('pageerror', error => evidence.errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.address().port}/journal-test`);
  const response = await page.evaluate(async () => {
    const bytes = await (await fetch('/lib/render-worker.js')).arrayBuffer();
    return [...new Uint8Array(bytes)];
  });
  evidence.sourceSHA256 = createHash('sha256').update(Buffer.from(response)).digest('hex');
  assert.equal(evidence.sourceSHA256, createHash('sha256').update(fs.readFileSync(root + '/lib/render-worker.js')).digest('hex'));
  evidence.controls = await page.evaluate(checkSurfaceJournal.toString() + '\ncheckSurfaceJournal(RenderWorker)');
  assert.equal(evidence.controls.status, 'PASS');
  evidence.concurrent = await page.evaluate(async () => {
    const buffer = new SharedArrayBuffer(65536), journal = new RenderWorker.SurfaceVersionJournal(buffer);
    const url = URL.createObjectURL(new Blob([`importScripts(${JSON.stringify(location.origin + '/lib/render-worker.js')});
      onmessage = e => { const j = new RenderWorker.SurfaceVersionJournal(e.data.buffer);
        try { j.finish(0, {owner:e.data.owner,palette:32768,proof:'9'.repeat(16000)}); postMessage('committed'); }
        catch (error) { postMessage('rejected:' + error.message); } };`], { type: 'text/javascript' }));
    const workers = [new Worker(url), new Worker(url)];
    try {
      const replies = await Promise.all(workers.map((w, owner) => new Promise((resolve, reject) => {
        w.onmessage = e => resolve(e.data); w.onerror = reject; w.postMessage({ buffer, owner });
      })));
      const record = journal.read(0);
      if (replies.filter(x => x === 'committed').length !== 1 || record.proof !== '9'.repeat(16000) || record.palette !== 32768)
        throw Error('concurrent writers manufactured an incoherent record');
      return { replies, owner: record.owner, bytes: Atomics.load(journal.words, 0) };
    } finally { workers.forEach(w => w.terminate()); URL.revokeObjectURL(url); }
  });
  if (process.env.JOURNAL_BENCH) evidence.cost = await page.evaluate(() => {
    const trials = [];
    for (const size of [66, 512, 4096, 16384, 65520]) {
      const record = { text: 'x'.repeat(size - 11) }, json = JSON.stringify(record);
      const j = new RenderWorker.SurfaceVersionJournal(new SharedArrayBuffer(65536)); j.finish(0, record);
      const ordinary = j.bytes.slice(16, 16 + size), decoder = new TextDecoder();
      const modes = { copy: () => j.bytes.slice(16, 16 + size).length,
        decode: () => JSON.parse(decoder.decode(ordinary)).text.length,
        read: () => j.read(0).text.length };
      let sink = 0;
      for (const fn of Object.values(modes)) for (let n = 0; n < 200; n++) sink += fn();
      for (let group = 0; group < 15; group++) for (const mode of group % 2 ? ['read', 'decode', 'copy'] : ['copy', 'decode', 'read']) {
        const start = performance.now(), iterations = 300;
        for (let n = 0; n < iterations; n++) sink += modes[mode]();
        trials.push({ size, group, mode, iterations, elapsedMs: performance.now() - start });
      }
      if (json.length !== size || sink <= 0) throw Error('benchmark fixture invalid');
    }
    return { scope: 'Chrome matched raw shared copy / ordinary decode+parse / production read; no gameplay claim', trials };
  });
  assert.deepEqual(evidence.errors, []);
})().catch(error => { evidence.error = error.stack; process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close(); if (server) await closeServer(server);
  evidence.finishedAt = new Date().toISOString(); evidence.pidAbsent = evidence.pid ? !fs.existsSync('/proc/' + evidence.pid) : null;
  if (process.env.JOURNAL_RESULT) fs.writeFileSync(process.env.JOURNAL_RESULT, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
});
