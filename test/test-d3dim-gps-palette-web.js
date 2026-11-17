#!/usr/bin/env node
'use strict';

// Run the existing native palette oracle in Chrome. Only boot and executor
// selection change; the oracle's pixel expectations and tolerances do not.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const crypto = require('crypto');
const { startStaticServer, closeServer } = require('./static-server');
const ROOT = path.resolve(__dirname, '..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

(async () => {
  const temporary = !process.env.PALETTE_WEB_EVIDENCE_DIR;
  const out = temporary ? fs.mkdtempSync(path.join(os.tmpdir(), 'wine-palette-web-'))
    : path.resolve(process.env.PALETTE_WEB_EVIDENCE_DIR);
  fs.mkdirSync(out, { recursive: true });
  const evidence = { results: [], browserProcesses: [], pageErrors: [] };
  evidence.harness = { path: 'test/test-d3dim-gps-palette-web.js',
    sha256: sha(fs.readFileSync(__filename)) };
  const spawn = cp.spawn, closes = [];
  let browser, server;
  cp.spawn = function (command) {
    const child = spawn.apply(this, arguments);
    if (/chrom(?:e|ium)/i.test(String(command))) {
      const record = { pid: child.pid, exit: false, close: false,
        stdoutEOF: child.stdout ? false : null, stderrEOF: child.stderr ? false : null };
      evidence.browserProcesses.push(record);
      child.once('exit', (code, signal) => Object.assign(record, { exit: true, code, signal }));
      closes.push(new Promise(resolve => child.once('close', () => { record.close = true; resolve(); })));
      child.stdout?.once('end', () => { record.stdoutEOF = true; });
      child.stderr?.once('end', () => { record.stderrEOF = true; });
    }
    return child;
  };
  require('module').syncBuiltinESMExports();
  try {
    const oracleFiles = ['test/helpers/d3dim-gps-device.js', 'test/test-d3dim-gps-palette.js'];
    const oracleBefore = new Map(oracleFiles.map(file => [file, fs.readFileSync(path.join(ROOT, file))]));
    const wasmPath = path.join(out, 'tested.wasm');
    const env = { ...process.env, WINE_RENDER_ARTIFACT_PREPARE: wasmPath };
    delete env.WINE_RENDER_ARTIFACT;
    const prepared = cp.spawnSync(process.execPath, [path.join(__dirname, 'test-d3dim-gps-palette.js')],
      { cwd: ROOT, env, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 });
    evidence.preparation = { status: prepared.status, signal: prepared.signal,
      stdout: prepared.stdout, stderr: prepared.stderr, error: prepared.error?.message };
    assert.strictEqual(prepared.status, 0, 'native oracle module preparation: ' + prepared.stderr);
    const pool = new Map(), pins = [];
    function retain(relative) {
      const bytes = fs.readFileSync(path.join(ROOT, relative));
      if (oracleBefore.has(relative)) assert(bytes.equals(oracleBefore.get(relative)),
        'oracle input changed during native preparation: ' + relative);
      pool.set('/' + relative, bytes);
      pins.push({ path: relative, bytes: bytes.length, sha256: sha(bytes) });
    }
    const scripts = ['region-map.generated', 'mem-utils', 'gpu-backend',
      'gpu-stream.generated', 'gpu-stream', 'd3d-shader-ir', 'd3d-geometry-batches',
      'render-clear', 'd3d9-shader', 'd3d9-software-backend', 'gpu-stream-software', 'gpu-stream-webgl'];
    for (const name of scripts) retain('lib/' + name + '.js');
    for (const file of oracleFiles) retain(file);
    const wasm = fs.readFileSync(wasmPath);
    pool.set('/palette-module.wasm', wasm);
    evidence.inputs = pins;
    evidence.module = { path: 'tested.wasm', bytes: wasm.length, sha256: sha(wasm), retainedBeforeExecution: true };
    server = await startStaticServer({ root: ROOT, crossOriginIsolated: true,
      handleRequest(req, res) {
        const name = new URL(req.url, 'http://localhost').pathname;
        if (name === '/palette-test') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<!doctype html><title>Native GPS palette oracle</title>');
          return true;
        }
        const bytes = pool.get(name);
        if (!bytes) return false;
        res.writeHead(200, { 'Content-Type': name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' });
        res.end(bytes);
        return true;
      } });
    const puppeteer = require('puppeteer');
    const executablePath = process.env.CHROME || [
      '/opt/google/chrome/chrome', '/usr/bin/chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ].find(file => fs.existsSync(file)) || await puppeteer.executablePath();
    browser = await puppeteer.launch({ headless: true, executablePath,
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], protocolTimeout: 120000 });
    evidence.browser = await browser.version();
    evidence.hardwareClaim = false;
    for (const backend of ['software', 'webgl']) {
      const page = await browser.newPage();
      page.on('pageerror', error => evidence.pageErrors.push(String(error)));
      try {
        await page.goto(`http://127.0.0.1:${server.address().port}/palette-test`);
        for (const name of scripts) await page.addScriptTag({ url: '/lib/' + name + '.js' });
        const result = await page.evaluate(async ({ backend, helper, oracle }) => {
          const failure = (label, actual, expected) => {
            throw Error(label + ': ' + JSON.stringify({ actual, expected }));
          };
          const assert = (value, label) => { if (!value) failure(label, value, true); };
          assert.strictEqual = (a, b, label) => { if (!Object.is(a, b)) failure(label, a, b); };
          assert.deepStrictEqual = (a, b, label) => {
            if (JSON.stringify(a) !== JSON.stringify(b)) failure(label, a, b);
          };
          const module = await WebAssembly.compile(await (await fetch('/palette-module.wasm')).arrayBuffer());
          let context = null, records = 0;
          const Base = backend === 'software' ? GpuStreamSoftware.Executor
            : class extends GpuStreamWebGL.Executor {
              constructor(options) {
                super({ ...options, canvas: document.createElement('canvas') });
                const gl = this.gl, debug = gl.getExtension('WEBGL_debug_renderer_info');
                context = { version: gl.getParameter(gl.VERSION),
                  renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) };
              }
            };
          const Executor = class extends Base {
            execute(record) { records++; return super.execute(record); }
          };
          const bootRenderHarness = async ({ extraHostOverrides }) => {
            const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
            const host = { memory };
            for (const imp of WebAssembly.Module.imports(module)) if (imp.kind === 'function') {
              host[imp.name] = () => { throw Error('unhandled native host import ' + imp.name); };
            }
            for (const name of ['log', 'log_i32', 'log_block', 'log_eip', 'log_api_exit', 'dx_trace']) host[name] = () => {};
            Object.assign(host, { math_pow: Math.pow, math_pow2: x => 2 ** x, get_ticks: () => 0 }, extraHostOverrides);
            const instance = await WebAssembly.instantiate(module, { host });
            return { instance, exports: instance.exports, memory };
          };
          const loaded = { exports: {} };
          new Function('require', 'module', helper)(name => {
            if (name === '../../lib/gpu-stream') return GpuStream;
            if (name === '../../lib/gpu-stream-software') return { Executor };
            if (name === '../render-helper') return { bootRenderHarness };
            throw Error('unmapped fixture dependency ' + name);
          }, loaded);
          const at = oracle.lastIndexOf('\n(async () => {');
          assert(at > 0, 'existing native oracle entrypoint located');
          // Remove only Node's shebang and automatic runner. Execute arm(1)
          // unchanged, including its expected unsupported-combination trap.
          const body = oracle.slice(oracle.indexOf('\n') + 1, at) + '\nreturn arm(1);';
          const result = await new Function('require', body)(name => {
            if (name === 'assert') return assert;
            if (name === './helpers/d3dim-gps-device') return loaded.exports;
            throw Error('unmapped oracle dependency ' + name);
          });
          if (backend === 'webgl') assert(context, 'real WebGL executor without software fallback');
          return { ...result, backend, context, records };
        }, { backend, helper: pool.get('/test/helpers/d3dim-gps-device.js').toString(),
          oracle: pool.get('/test/test-d3dim-gps-palette.js').toString() });
        assert(result.n > 0 && result.records > 0, backend + ' executed the native pixel oracle');
        evidence.results.push(result);
        console.log(`PASS Chrome native GPS palette ${backend}: ${result.n} pixel observations`);
      } finally { await page.close(); }
    }
    assert.strictEqual(evidence.results[0].n, evidence.results[1].n);
    assert.deepStrictEqual(evidence.pageErrors, []);
  } catch (error) {
    evidence.error = error.stack || String(error);
    throw error;
  } finally {
    try {
      if (browser) { await browser.close(); await Promise.all(closes); }
      if (server) await closeServer(server);
      fs.writeFileSync(path.join(out, 'pixels.json'), JSON.stringify(evidence, null, 2) + '\n');
      if (!evidence.error) {
        assert(evidence.browserProcesses.length > 0, 'actual browser process observed');
        for (const record of evidence.browserProcesses) {
          assert(record.exit && record.close && record.code === 0 && record.stdoutEOF && record.stderrEOF,
            'browser actual exit/close and both EOFs: ' + JSON.stringify(record));
        }
      }
    } finally {
      cp.spawn = spawn;
      require('module').syncBuiltinESMExports();
      if (temporary) fs.rmSync(out, { recursive: true, force: true });
    }
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
