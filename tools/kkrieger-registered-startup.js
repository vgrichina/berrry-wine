#!/usr/bin/env node
'use strict';

// Bounded diagnostic of the actual registry route. Never registers a probe app
// or patches guest state. Invoke only after acquiring the shared runtime slot.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(process.env.WA_TEST_ROOT || path.join(__dirname, '..'));
const out = path.resolve(process.env.WA_RUN_OUT || path.join(root, 'scratch/runs/kkrieger-registered-startup'));
const seconds = Number(process.env.WA_MAX_SECONDS || 300);
if (!Number.isInteger(seconds) || seconds < 15 || seconds > 600) throw Error('WA_MAX_SECONDS must be 15..600');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hashFile = name => sha(fs.readFileSync(path.join(root, name)));
const git = (...args) => execFileSync('git', ['-C', root, ...args], {encoding: 'utf8'}).trim();
// The shell drops currentWine.memory on exit, so memory cannot be an exit
// predicate. Require evidence that this run started, then trust running=false.
function shouldStop(state, hasStarted) {
  return !!state.oom?.count || (hasStarted && state.running === false);
}

async function main() {
  const {APPS} = require(path.join(root, 'lib/apps'));
  const app = APPS.kkrieger_beta;
  if (!app || app.bigMemory !== true || app.requiredFiles !== true) throw Error('Registered memory candidate missing');
  const exeSha256 = hashFile(app.exe);
  if (exeSha256 !== 'ac2192b740c57125067a29d2e0ea6d95b222543398188c5f67bbf01157622685') throw Error('Original executable hash mismatch');
  const wasmSha256 = hashFile('build/wine-assembly.wasm');
  if (!process.env.WA_EXPECT_WASM_SHA256 || process.env.WA_EXPECT_WASM_SHA256 !== wasmSha256)
    throw Error('Set WA_EXPECT_WASM_SHA256 only after recording build/source equivalence');
  // Exclusive output directory avoids overwriting an earlier evidence run.
  fs.mkdirSync(out, {recursive: false});
  const meta = {startedAt: new Date().toISOString(), seconds, appId: 'kkrieger_beta',
    candidateId: 'kkrieger-beta', root, head: git('rev-parse', 'HEAD'), wasmSha256,
    exeSha256, appsSha256: hashFile('lib/apps.js'), app,
    instrumentation: 'read-only memory series and first-OOM census; ordinary registry URL; no worker override',
    gameplayVerified: false};
  fs.writeFileSync(path.join(out, 'tested-source.patch'), git('diff', 'HEAD', '--', 'src', 'host.js', 'lib', 'index.html'));
  const {startStaticServer, closeServer} = require(path.join(root, 'test/static-server'));
  const puppeteer = require(path.join(root, 'node_modules/puppeteer'));
  const server = await startStaticServer({root});
  let browser;
  const watchdog = setTimeout(() => {
    fs.appendFileSync(path.join(out, 'controller.log'), 'Hard watchdog expired\n');
    browser?.process()?.kill('SIGKILL');
    process.exitCode = 1;
    server.close();
  }, (seconds + 90) * 1000);
  try {
    browser = await puppeteer.launch({executablePath: '/usr/bin/google-chrome', headless: true,
      args: ['--no-sandbox', '--enable-unsafe-swiftshader'], protocolTimeout: 20000});
    meta.browser = await browser.version();
    // A follow-up observer can preserve the current viewport by connecting
    // with defaultViewport:null. Never alter the bound by pausing this process.
    fs.writeFileSync(path.join(out, 'browser-endpoint.json'), JSON.stringify({
      wsEndpoint: browser.wsEndpoint(), observerConnectOptions: {defaultViewport: null},
    }, null, 2));
    const page = await browser.newPage();
    await page.setViewport({width: 1100, height: 800});
    page.on('console', m => fs.appendFileSync(path.join(out, 'browser.log'), m.type() + ': ' + m.text() + '\n'));
    page.on('pageerror', e => fs.appendFileSync(path.join(out, 'browser.log'), 'PAGEERROR: ' + e.message + '\n'));
    const probes = ['arm-backing-census.js', 'arm-memory-series.js'];
    // arm-kkrieger-declaration.js patched the old JS D3D9Backend (deleted, d3d9-retire S4).
    if (process.env.WA_CAPTURE_DECLARATION === '1') throw new Error('WA_CAPTURE_DECLARATION: the D3D9Backend probe was removed with the old JS D3D9 path');
    if (process.env.WA_CAPTURE_AUDIO === '1') probes.push('arm-kkrieger-audio.js');
    meta.audioCapture = process.env.WA_CAPTURE_AUDIO === '1';
    meta.declarationCapture = process.env.WA_CAPTURE_DECLARATION === '1';
    for (const probe of probes)
      await page.evaluateOnNewDocument(fs.readFileSync(path.join(root, 'tools/page-probes', probe), 'utf8'));
    meta.route = 'http://127.0.0.1:' + server.address().port + '/?debug&app=kkrieger_beta';
    await page.goto(meta.route, {waitUntil: 'domcontentloaded', timeout: 30000});
    const start = Date.now();
    let hasStarted = false;
    for (let i = 0; Date.now() - start < seconds * 1000; i++) {
      await new Promise(resolve => setTimeout(resolve, Math.min(15000, seconds * 1000 - (Date.now() - start))));
      const state = await page.evaluate(() => {
        const wine = window.wineShell?.currentWine;
        const e = wine?.instance?.exports;
        return {at: new Date().toISOString(), text: document.body.innerText.slice(-6000),
          running: wine?.running ?? null, wasmBytes: wine?.memory?.buffer?.byteLength ?? null,
          bigMemory: wine?.bigMemory ?? null, census: window.__backingCensus || null,
          series: window.__memSeries || null, oom: window.__memOom || null,
          declaration: window.__kkriegerDeclaration || null,
          audio: window.__kkriegerAudio || null,
          regs: e ? Object.fromEntries(['eip','yield_reason','eax'].map(k => [k, e['get_' + k]?.() >>> 0])) : null};
      });
      fs.writeFileSync(path.join(out, 'state-' + i + '.json'), JSON.stringify(state));
      hasStarted ||= !!state.wasmBytes;
      if (i % 2 === 0 || state.oom?.count || state.running === false)
        await page.screenshot({path: path.join(out, 'screen-' + i + '.png')});
      console.log(JSON.stringify({sample: i, wasmBytes: state.wasmBytes, running: state.running, oom: state.oom?.count, regs: state.regs}));
      if (shouldStop(state, hasStarted)) break;
    }
    await page.screenshot({path: path.join(out, 'final.png')});
  } catch (error) {
    meta.error = error.stack;
    throw error;
  } finally {
    clearTimeout(watchdog);
    meta.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 2));
    if (browser) await browser.close();
    await closeServer(server);
  }
}
module.exports = {shouldStop};
if (require.main === module) main().catch(error => {console.error(error); process.exitCode = 1;});
