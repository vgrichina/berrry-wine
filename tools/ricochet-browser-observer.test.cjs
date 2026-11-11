'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {connectObserver} = require('./ricochet-browser-observer.cjs');

test('observer refuses an endpoint outside the owned loopback browser', async () => {
  let called = false;
  await assert.rejects(connectObserver({connect() { called = true; }}, 'ws://example.com:9222/'), /owned loopback/);
  assert.equal(called, false);
});

test('second observer preserves live viewport and canvas hit coordinates', async () => {
  const pp = require('../node_modules/.stronghold-runtime/node_modules/puppeteer');
  const profile = fs.mkdtempSync(path.join('/dev/shm', 'ricochet-observer-test-'));
  let browser;
  try {
    browser = await pp.launch({executablePath: process.env.RICOCHET_CHROME || '/opt/google/chrome.before-betterchromium/chrome',
      headless: true, userDataDir: profile, args: ['--no-sandbox']});
    const page = await browser.newPage();
    await page.setViewport({width: 1024, height: 768});
    await page.setContent('<canvas style="position:absolute;left:480px;top:240px;width:160px;height:120px"></canvas>');
    await page.addScriptTag({path: path.join(__dirname, '../lib/presentation-filter.js')});
    const backend = await page.evaluate(() => {
      const source = document.createElement('canvas');
      source.width = source.height = 16;
      source.getContext('2d').fillRect(0, 0, 16, 16);
      const output = document.querySelector('canvas');
      const filter = new presentationFilter.PresentationFilter(output);
      if (!filter.present(source, 'nearest')) throw Error('presentation failed');
      globalThis.observerTestEvents = [];
      for (const type of ['mousemove', 'mousedown', 'mouseup', 'keydown', 'keyup']) {
        document.addEventListener(type, e => observerTestEvents.push({type, trusted: e.isTrusted}), true);
      }
      return filter.lastBackend;
    });
    assert.equal(backend, 'canvas-nearest');
    await page.mouse.move(490, 265);
    await page.mouse.down();
    await page.mouse.up();
    await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    const events = await page.evaluate(() => observerTestEvents);
    assert.ok(events.every(e => e.trusted));
    assert.deepEqual(events.map(e => e.type), ['mousemove', 'mousedown', 'mouseup', 'keydown', 'keyup']);
    const geometry = () => page.evaluate(() => ({width: innerWidth, height: innerHeight,
      target: document.elementFromPoint(490, 265)?.tagName}));
    const before = await geometry();
    assert.deepEqual(before, {width: 1024, height: 768, target: 'CANVAS'});
    // Reproduce the causal control failure, then restore the owned viewport.
    const oldObserver = await pp.connect({browserWSEndpoint: browser.wsEndpoint()});
    await oldObserver.pages();
    assert.equal((await geometry()).width, 800);
    oldObserver.disconnect();
    await page.setViewport({width: 1024, height: 768});
    const observer = await connectObserver(pp, browser.wsEndpoint());
    try {
      const observed = (await observer.pages()).find(p => p.target()._targetId === page.target()._targetId);
      assert.ok(observed);
      assert.deepEqual(await observed.evaluate(() => ({width: innerWidth, height: innerHeight,
        target: document.elementFromPoint(490, 265)?.tagName})), before);
      assert.deepEqual(await geometry(), before);
    } finally { observer.disconnect(); }
    assert.deepEqual(await geometry(), before);
  } finally {
    if (browser) await browser.close();
    fs.rmSync(profile, {recursive: true, force: true});
  }
});
