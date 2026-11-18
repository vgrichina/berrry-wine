'use strict';
// Real Chrome DOM/controller transitions, using the production observer expression.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const {createObserver, CandidateWait} = require('../tools/revolt-capture-integration.cjs');
const {createGate} = require('../tools/revolt-display-admission.cjs');
const {READ, classify} = require('../tools/revolt-startup-readiness.cjs');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const transient = require('../tools/browser-transients.cjs').create();
  const server = http.createServer((req, res) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.end('<!doctype html><canvas id="screen" width="640" height="480"></canvas>');
  });
  let browser, joined;
  const observations = [];
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    browser = await require('puppeteer').launch({executablePath: '/opt/google/chrome/chrome', headless: true,
      userDataDir: transient.profile, env: transient.env(), args: ['--no-sandbox', ...transient.args,
        ...require('../tools/browser-component-update-args.cjs')]});
    joined = transient.watch(browser.process());
    const page = (await browser.pages())[0];
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.addScriptTag({content: fs.readFileSync(require.resolve('../lib/game-wait.js'), 'utf8')});
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = '[hidden]{display:none!important}.wa-game-wait{position:absolute;width:400px;height:200px;background:#ccc;z-index:10}.wa-launch-bar{height:20px;background:white}';
      document.head.append(style);
      const instance = {}, canvas = document.getElementById('screen');
      const w = {running: true, processId: 1, instance, guestWorker: {link: {endpointIdentity: 'native-fixture', worker: {}, module: {}}},
        renderer: {canvas, peekKeyDownState: () => 0, windows: {1: {hwnd: 1, visible: true, w: 640, h: 480, processId: 1, wasm: instance}}}};
      globalThis.runningApps = [{name: 're_volt_demo', wine: w}];
      // This is the real controller and DOM view, not a hand-authored snapshot.
      w._gameWait = GameWait.createGameWaitController({revealDelayMs: 0, mergeGapMs: 0});
      w._gameWait.setView(GameWait.createDomView(document, {anchor: () => canvas.getBoundingClientRect()}));
      globalThis.productionGameWait = w._gameWait;
    });
    let pin, reads = 0;
    const gate = createGate();
    const evaluate = async expression => { gate.check(); reads++; return page.evaluate(expression); };
    const sameOwner = (a, b) => {
      for (const k of ['processObject', 'epoch', 'windowObject', 'windowInstance', 'outputCanvasObject']) assert.equal(a[k], b[k], 'owner changed ' + k);
    };
    const observer = createObserver({evaluate, owner: () => pin, sameOwner, expectedName: 're_volt_demo',
      check: () => gate.check(), onObservation: v => observations.push(v)});
    pin = (await observer.identity()).apps[0];
    const begin = async () => {
      await page.evaluate(() => { globalThis.waitToken = productionGameWait.begin({file: 'nhood1i.bmp'}); });
      await page.waitForFunction(() => productionGameWait.visible);
    };
    const end = async () => {
      await page.evaluate(() => productionGameWait.end(waitToken));
      await page.waitForFunction(() => !productionGameWait.visible);
    };
    await begin();
    assert.equal(classify(await evaluate(READ)), 'waiting');
    const obstructedCurrent = await evaluate(READ);
    assert.throws(() => observer.acceptIdentity(obstructedCurrent), e => e.code === 'LOCAL_NOT_SENT', 'second live-owner snapshot cannot admit through loading');
    await assert.rejects(observer.identity(), e => e.code === 'LOCAL_NOT_SENT');
    await assert.rejects(observer.identity(true), CandidateWait);
    let captures = 0;
    const ready = observer.capture({deadline: Date.now() + 2000, candidate: async () => ++captures, discard: () => {}});
    await wait(70); assert.equal(captures, 0); await end();
    assert.equal((await ready).candidate, 1);
    let discarded = 0;
    const result = await observer.capture({deadline: Date.now() + 3000, candidate: async () => {
      const n = ++captures;
      if (n === 2) { await begin(); setTimeout(() => { void end(); }, 90); }
      return {n, pixels: await page.screenshot()};
    }, discard: () => { discarded++; }});
    assert.equal(result.candidate.n, 3, 'midcapture obstruction discards first whole image');
    assert(observations.some(v => v.discarded));
    // Loading discovered by an internal identity read also discards locally.
    let first = true;
    await observer.capture({deadline: Date.now() + 3000, candidate: async () => {
      if (first) { first = false; await begin(); setTimeout(() => { void end(); }, 90); }
      return observer.identity(true);
    }, discard: () => { discarded++; }});
    assert.equal(discarded, 1);
    await begin();
    await page.evaluate(() => { const e = document.createElement('button'); e.id = 'wrong'; e.textContent = 'foreign'; e.style = 'position:absolute;left:100px;top:100px'; document.body.append(e); });
    await assert.rejects(observer.observe(), /unexpected startup obstruction/);
    await page.evaluate(() => document.getElementById('wrong').remove());
    await page.evaluate(() => { void productionGameWait.fail(waitToken, Error('HTTP 503')); });
    await assert.rejects(observer.observe(), /unexpected startup obstruction/);
    assert.equal(await page.evaluate(() => document.querySelector('.wa-game-wait-retry').hidden), false, 'error remains visible');
    await page.evaluate(() => productionGameWait.action('retry'));
    await assert.rejects(observer.capture({deadline: Date.now() + 80, candidate: async () => assert.fail('obstructed'), discard: () => {}}), /deadline/);
    await end();
    await assert.rejects(observer.capture({deadline: Date.now() + 1000, candidate: async () => { throw Error('transport UNKNOWN'); }, discard: () => assert.fail('UNKNOWN cannot discard')}), /transport UNKNOWN/);
    await page.evaluate(() => { runningApps[0].wine = {...runningApps[0].wine}; });
    await assert.rejects(observer.observe(), /owner changed/);
    gate.seal('authored true UNKNOWN'); const closedReads = reads;
    await assert.rejects(observer.capture({deadline: Date.now() + 1000, candidate: async () => assert.fail('closed'), discard: () => {}}), /UNKNOWN/);
    assert.equal(reads, closedReads, 'no request after permanent closure');
    console.log('PASS actual Chrome productionGameWait DOM loading/resume, before/midcapture discard, local NOT_SENT, mixed/wrong/error obstruction, deadline, owner change, UNKNOWN closure');
  } finally {
    if (browser) { await browser.close(); const receipt = await joined; assert.equal(receipt.code, 0); console.log('native Chrome actual wait ' + JSON.stringify(receipt)); }
    await new Promise(r => server.close(r));
    await transient.cleanup();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
