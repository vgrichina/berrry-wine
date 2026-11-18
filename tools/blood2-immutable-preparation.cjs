'use strict';
// Blood II preparation only. Resolution and Worker loading use the unchanged
// production sealed-source loader; no runtime request can select live sources.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict');
const c = require('./native-supervisor-common.cjs');
const { indexedSource } = require('./lmarbles-supervisor.cjs');
const root = path.resolve(__dirname, '..');
function collect(extra = [], { codec = true } = {}) {
  const names = cp.execFileSync('git', ['ls-files', 'lib', 'host.js', 'test/run.js', 'src/api_table.json', 'src/win16-ordinals.generated.json', 'fonts', 'tools'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(n => /\.(js|cjs|json)$/.test(n));
  names.push(...extra, 'test/candidate-corpus/manifest.json');
  // Include current untracked runtime modules, with their bytes in the same
  // inventory and recovery patch as tracked dirty inputs.
  names.push(...fs.readdirSync(path.join(root, 'lib')).filter(n => /\.(js|json)$/.test(n)).map(n => 'lib/' + n));
  if (codec) {
    const base = 'node_modules/pngjs';
    assert(fs.statSync(path.join(root, base, 'package.json')).isFile(), 'missing pngjs package');
    for (const n of fs.readdirSync(path.join(root, base), { recursive: true })) {
      const file = path.join(base, n);
      if (/\.(js|json)$/.test(file) && fs.statSync(path.join(root, file)).isFile()) names.push(file);
    }
  }
  const selected = new Set(names);
  for (let i = 0; i < names.length; i++) {
    const file = names[i], body = fs.readFileSync(path.join(root, file), 'latin1');
    for (const m of body.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
      const base = path.join(path.dirname(file), m[1]);
      for (const suffix of ['', '.js', '.cjs', '.json', '/index.js']) {
        const n = path.normalize(base + suffix);
        if (fs.statSync(path.join(root, n), { throwIfNoEntry: false })?.isFile()) {
          if (!selected.has(n)) { selected.add(n); names.push(n); }
          break;
        }
      }
    }
  }
  return [...selected].sort().map(file => { const b = fs.readFileSync(path.join(root, file)); return { path: file, sha256: c.sha256(b), body: b.toString('base64') }; });
}
function freeze(rows, module) {
  const [packed, indexSHA256] = indexedSource(rows);
  const source = c.seal('blood2-source', packed), wasm = c.seal('blood2-module', module);
  const env = { ...process.env, NODE_OPTIONS: '--require=' + path.join(root, 'tools/lmarbles-native-source-view.cjs'),
    LMARBLES_SOURCE_FD: '/proc/self/fd/' + source, LMARBLES_MODULE_FD: '/proc/self/fd/' + wasm,
    LMARBLES_SOURCE_INDEX_SHA256: indexSHA256, LMARBLES_MODULE_SHA256: c.sha256(module) };
  return { env, fds: [source, wasm], sourceSHA256: c.sha256(packed), indexSHA256, close() { fs.closeSync(source); fs.closeSync(wasm); } };
}
// This happens before any original PID or runtime clock. It instantiates the
// actual renderer and encodes/decodes a complete native raster desktop, then
// repeats in a real Node Worker inheriting the exact same frozen descriptors.
function renderingPreflight(frozen) {
  const render = `const {createCanvas}=require('./lib/canvas-compat');
    const {Win98Renderer}=require('./lib/renderer');
    const {PNG}=require('pngjs');
    const canvas=createCanvas(1024,712), renderer=new Win98Renderer(canvas);
    const ctx=canvas.getContext('2d');ctx.fillStyle='#19324b';ctx.fillRect(0,0,1024,712);
    const bytes=canvas.toBuffer('image/png');const png=PNG.sync.read(bytes);
    require('node:assert/strict').equal(png.width,1024);require('node:assert/strict').equal(png.height,712);
    require('node:assert/strict').equal(png.data[0],25);
    require('node:assert/strict').equal(png.data[(1024*712-1)*4+2],75);`;
  const code = render + `const {Worker}=require('node:worker_threads');
    const worker=new Worker(${JSON.stringify(render)}, {eval:true});
    worker.on('error', e=>{console.error(e);process.exitCode=1;});
    worker.on('exit', code=>{if(code)process.exitCode=1;else console.log('whole PNG renderer + Worker PASS');});`;
  const r = cp.spawnSync(process.execPath, ['-e', code], { cwd: root, env: frozen.env, stdio: c.stdioWithFds(frozen.fds), timeout: 15000 });
  assert.equal(r.status, 0, 'immutable renderer preflight failed: ' + r.stderr?.toString());
  assert(r.stdout.toString().includes('whole PNG renderer + Worker PASS'));
  return { pass: true, wholePNG: [1024, 712], nativeRendererConstructed: true, workerExit: 0, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}
module.exports = { collect, freeze, renderingPreflight };
