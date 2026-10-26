#!/usr/bin/env node
'use strict';

// Requires the serialized runtime/build slot. No game assets are needed.
// This compiles the real WAT source closure, then executes its API, descriptor,
// decoder and page-watch exports in Chrome against the production GPU backend.
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const launchControl = require('./helpers/palette-browser-launch');
// Reject wrapper side effects before identity Git, compilation, server or browser.
const launchConfig = launchControl.launchConfiguration();
if (process.argv.includes('--launch-config-check')) {
  console.log(JSON.stringify(launchConfig));
  process.exit(0);
}
launchControl.ensureSupervised();
const puppeteer = require('puppeteer');
const extraWat = require('./helpers/palette-gpu-wat');
const root = path.resolve(__dirname, '..');
// A separately pinned baseline checkout supplies its own compiler, closure and
// production JS. Only the identical test exports/browser oracle come from here.
const sourceRoot = path.resolve(process.env.PALETTE_GPU_SOURCE_ROOT || root);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const identity = launchControl.gitIdentity;
const saveEvidence = evidence => {
  if (process.env.PALETTE_GPU_EVIDENCE)
    fs.writeFileSync(process.env.PALETTE_GPU_EVIDENCE,JSON.stringify(evidence,null,2)+'\n');
};

(async () => {
  const sourceIdentity=identity(sourceRoot), fixtureIdentity=identity(root);
  const evidence = {source:sourceIdentity.head,diff:sourceIdentity.diff,
    sourceRoot,fixture:fixtureIdentity,extraWatSha256:sha256(extraWat),stage:'compile',results:[],
    route:'cooperative full-VM WebGL; production guest/render Worker queue is not covered'};
  let wasm;
  try {
    const { compileSrcWasm } = require(path.join(sourceRoot,'test/compile-src.js'));
    wasm = compileSrcWasm((file,source) => file === '13-exports.wat' ? `${source}\n${extraWat}` : source);
  } catch(error) {
    evidence.error=error.stack || String(error);saveEvidence(evidence);throw error;
  }
  evidence.wasmSha256=sha256(wasm);evidence.stage='browser setup';
  const scripts = ['gpu-backend','d3d9-shader','d3d9-fixed','render-clear','d3d9-backend','d3dim-gpu']
    .map(name=>`lib/${name}.js`).concat('test/helpers/palette-gpu-browser.js');
  const assets = new Map(scripts.map(name=>['/'+name,fs.readFileSync(path.join(
    name.startsWith('test/') ? root : sourceRoot,name))]));
  evidence.scripts=Object.fromEntries(scripts.map(name=>[name,sha256(assets.get('/'+name))]));
  assets.set('/fixture.wasm',wasm);
  const server = http.createServer((req,res) => {
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    if (req.url === '/') {
      res.setHeader('Content-Type','text/html');
      res.end(scripts.map(name=>`<script src="/${name}"></script>`).join('\n')); return;
    }
    const body=assets.get(req.url);
    if (!body) { res.statusCode=404; res.end(); return; }
    res.setHeader('Content-Type',req.url.endsWith('.wasm')?'application/wasm':'text/javascript'); res.end(body);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser,page;
  try {
    evidence.launchControl=launchConfig.checked;
    browser=await puppeteer.launch(launchConfig.options);
    evidence.browser=await browser.version();
    for (const version of [1,2]) {
      page=await browser.newPage();
      page.setDefaultTimeout(120000);
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      evidence.stage=`WebGL${version} fixture setup and pixel assertions`;
      const result=await page.evaluate(version=>runPaletteGpu(version),version);
      evidence.results.push({version,...result});
      console.log(`PASS WebGL${version}: ${result.observations.length} real palette draw/clear/alpha framebuffer checks`);
      await page.close();
      page=null;
    }
    evidence.stage='passed';
  } catch (error) {
    evidence.error=error.stack || String(error);
    if(page)evidence.partial=await page.evaluate(()=>globalThis.paletteGpuEvidence||null).catch(()=>null);
    throw error;
  }
  finally {
    saveEvidence(evidence);
    if (browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error.stack || error);process.exitCode=1;});
