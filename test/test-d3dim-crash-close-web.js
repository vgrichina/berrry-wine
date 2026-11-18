'use strict';

// Actual browser transport and native executor; the fixture only produces
// records. No synthetic Worker events, scripted exports or recorded responses.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const vm = require('node:vm');
const {compileSrcWasm} = require('./compile-src');
const transient = require('../tools/browser-transients.cjs');
const root = path.resolve(__dirname, '..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

(async () => {
  // Capture source synchronously before compiling/serving so a shared-tree
  // edit cannot split the decoder, executor and native module across versions.
  const files = new Map(fs.readdirSync(root + '/lib').filter(n => /\.(js|json)$/.test(n))
    .map(n => ['lib/' + n, fs.readFileSync(root + '/lib/' + n)]));
  const wasm = compileSrcWasm();
  for (const [name, bytes] of files)
    assert.equal(sha(fs.readFileSync(root + '/' + name)), sha(bytes), 'source changed during compilation: ' + name);
  files.set('fixture.wasm', wasm);
  const producer = fs.readFileSync(__dirname + '/gpu-stream-fixture.js', 'utf8')
    .replace("const GS = require('../lib/gpu-stream');", 'const GS = globalThis.GpuStream;')
    .replace('module.exports = { makeProducer, encode, packLayout };',
      'globalThis.GpuFixture = { makeProducer, encode, packLayout };');
  files.set('fixture.js', Buffer.from(producer));
  files.set('fixture.html', Buffer.from('<!doctype html><title>D3DIM crash close</title>' +
    '<script src="/lib/gpu-stream.generated.js"></script><script src="/lib/gpu-stream.js"></script>' +
    '<script src="/lib/gpu-stream-doorbell.js"></script><script src="/fixture.js"></script>'));
  const workspace = transient.create(), requests = [], destroyed = [], waits = [];
  const spawn = cp.spawn;
  let browser, server, timer;
  cp.spawn = function(file, args, options) {
    const child = spawn.apply(this, arguments);
    if (file === '/opt/google/chrome/chrome') {
      child.stdout?.resume(); child.stderr?.resume();
      waits.push({child, joined:workspace.watch(child)});
    }
    return child;
  };
  try {
    server = http.createServer((req, res) => {
      const name = new URL(req.url, 'http://local').pathname.slice(1), b = files.get(name);
      requests.push({path:name, status:b ? 200 : 404, sha256:b ? sha(b) : null});
      res.writeHead(b ? 200 : 404, {'Cross-Origin-Opener-Policy':'same-origin',
        'Cross-Origin-Embedder-Policy':'require-corp', 'Content-Type':name.endsWith('.js') ?
          'text/javascript' : name.endsWith('.wasm') ? 'application/wasm' :
            name.endsWith('.html') ? 'text/html' : 'application/json'});
      res.end(b || 'missing');
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    timer = setTimeout(() => { for (const {child} of waits) child.kill('SIGKILL'); }, 35000);
    browser = await require('puppeteer').launch({executablePath:'/opt/google/chrome/chrome',
      headless:true, timeout:15000, protocolTimeout:15000, env:workspace.env(),
      args:['--no-sandbox', ...require('../tools/browser-component-update-args.cjs'), ...workspace.args]});
    browser.on('targetdestroyed', t => destroyed.push(t.url()));
    const page = (await browser.pages())[0];
    await page.goto('http://127.0.0.1:' + server.address().port + '/fixture.html');
    const mirror = {module:{exports:{}}};
    vm.runInNewContext(files.get('lib/region-map.generated.js').toString(), mirror);
    const result = await page.evaluate(require('./fixtures/d3dim-crash-close-case.cjs'),
      mirror.module.exports.BASE.GUEST_HEAP_BASE);
    assert(result.pass);
    const end = Date.now() + 3000;
    while (!destroyed.some(u => u.includes('/lib/d3d-render-worker.js')) && Date.now() < end)
      await new Promise(r => setTimeout(r, 10));
    assert(destroyed.some(u => u.includes('/lib/d3d-render-worker.js')), 'actual Worker target destroyed');
    assert(requests.some(r => r.path === 'lib/d3d-render-worker.js' && r.status === 200));
    assert(requests.some(r => r.path === 'fixture.wasm' && r.sha256 === sha(wasm)));
    console.log(JSON.stringify({browser:await browser.version(), moduleSHA256:sha(wasm), result, requests}));
  } finally {
    cp.spawn = spawn;
    if (browser) await browser.close().catch(() => {});
    for (const {child} of waits) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    const joined = await Promise.all(waits.map(w => w.joined));
    clearTimeout(timer);
    console.log('Individual Chrome waits', JSON.stringify(joined));
    if (server) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
    // Unique downloads cause retention refusal; tests never silently delete them.
    console.log('Browser cleanup', JSON.stringify(await workspace.cleanup()));
    for (const w of joined) { assert(w.actualWait && w.stdoutEOF && w.stderrEOF); assert.equal(w.code, 0); }
  }
  console.log('PASS actual-browser malformed stream, CLOSE, replacement, STOP, pixels, canaries and refused endpoints');
})().catch(e => { console.error(e); process.exitCode = 1; });
