'use strict';

// PROTOCOL tests only: isolated canonical-helper/compiler doubles and fake host
// instantiation. No full source compilation, guest memory or native renderer.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'render-artifact-protocol-'));
const wasm = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
let checks = 0;
function put(file, bytes) {
  const full = path.join(temp, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, bytes);
}
function copy(file) { put(file, fs.readFileSync(path.join(root, file))); }
function ok(label, fn) { fn(); checks++; console.log(`PASS ${label}`); }
const originalLoad = Module._load, originalWasm = global.WebAssembly;
const originalEnv = { ...process.env };
let compilerDenied = false, deniedImports = 0, instantiations = 0;
try {
  for (const file of ['test/render-helper.js', 'test/render-artifact.js', 'test/compile-src.js', 'lib/wat-manifest.js', 'tools/protected-writer-entries.js']) copy(file);
  put('src/main.watx', '(include "13-exports.wat")\n');
  put('src/13-exports.wat', ';; fixture exports\n');
  put('tools/watx.js', 'throw new Error("full compiler must never load in protocol tests");');
  put('tools/watx-src/compiler.js', '// identity-only fixture compiler\n');
  // Exercise the REAL compile-src transform adapter, using a tiny closure double.
  // It verifies all three VFS aliases and the exact options at its boundary.
  put('tools/watx-closure.js', `
const fs=require('fs'),path=require('path');
exports.watxSourceClosure=()=>{const source=fs.readFileSync(path.join(__dirname,'../src/13-exports.wat'),'utf8');
 return {source:'fixture',vfs:new Map(['13-exports.wat','src/13-exports.wat','./13-exports.wat'].map(k=>[k,source]))};};
exports.compileClosure=(closure,options)=>{
 const expected=fs.readFileSync(path.join(__dirname,'../src/expected.wat'),'utf8');
 const base=fs.readFileSync(path.join(__dirname,'../src/13-exports.wat'),'utf8');
 const value=expected?base+'\\n'+expected+'\\n':base;
 require('assert').deepStrictEqual([...closure.vfs.values()],[value,value,value]);
 require('assert').strictEqual(options.tailCalls,process.env.EXPECT_TAIL!=='false');
 fs.appendFileSync(path.join(__dirname,'../compile-calls'),'called\\n');
 return {success:true,wasmBinary:Uint8Array.from([0,97,115,109,1,0,0,0])};};`);
  // Preparation must exit without resolving these dependencies or allocating.
  for (const file of ['canvas-compat', 'renderer', 'host-imports', 'font-substitutions'])
    put(`lib/${file}.js`, 'throw new Error("host dependency loaded during preparation");');
  const artifact = path.join(temp, 'module.wasm');
  function prepare(extraWat, tailCalls = true) {
    put('src/expected.wat', extraWat);
    const script = `global.WebAssembly={Memory:class{constructor(){throw Error('guest memory during prepare')}},instantiate(){throw Error('instantiate during prepare')}};
require('./test/render-helper').bootRenderHarness(${JSON.stringify({ extraWat, tailCalls })}).catch(e=>{console.error(e);process.exitCode=1});
process.on('beforeExit',()=>{throw Error('prepare failed to exit before test body')});`;
    assert(Number(/MemAvailable:\s+(\d+)/.exec(fs.readFileSync('/proc/meminfo', 'utf8'))[1]) * 1024 >= 805306368);
    const r = spawnSync(process.execPath, ['--max-old-space-size=256', '-e', script], {
      cwd: temp, stdio: 'inherit', timeout: 10000,
      env: { ...process.env, WINE_RENDER_ARTIFACT_PREPARE: artifact, EXPECT_TAIL: String(tailCalls) },
    });
    assert.strictEqual(r.status, 0, r.stderr || String(r.error));
    assert.deepStrictEqual(fs.readFileSync(artifact), wasm);
  }
  // Inspect the unchanged real entrypoints; no copied export strings here.
  const targetExtras = ['test-d3d-software-compaction.js', 'test-d3d-software-ctx-arena-reuse.js'].map(name => {
    const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
    const match = /bootRenderHarness\(\{fonts:'none',extraWat:`([^`]+)`\}\)/.exec(source);
    assert(match, `unchanged target entrypoint ${name}`);
    return match[1];
  });
  assert.notStrictEqual(targetExtras[0], targetExtras[1]);
  const protocol = require(path.join(temp, 'test/render-artifact'));
  ok('extraWat identity preserves exact JS code units', () => assert.notDeepStrictEqual(
    protocol.identity({ extraWat: '\ud800' }).extraWat,
    protocol.identity({ extraWat: '\ud801' }).extraWat));
  for (const extraWat of targetExtras) {
    ok('prepare real target extraWat through actual harness/compile-src without host or memory', () => prepare(extraWat));
    ok('consume exact target identity', () => assert.deepStrictEqual(protocol.consumeArtifact(artifact, { extraWat, tailCalls: true }), wasm));
  }
  const options = { extraWat: targetExtras[1], tailCalls: true };
  const goodManifest = fs.readFileSync(`${artifact}.json`);
  ok('preparation isolates an already-loaded compiler without deleting held exports', () => {
    const compilerPath = path.join(temp, 'tools/watx.js');
    const held = { exports: {} };
    require.cache[compilerPath] = held;
    try {
      protocol.prepareArtifact(artifact, options);
      assert.deepStrictEqual(protocol.consumeArtifact(artifact, options), wasm);
      assert.strictEqual(require.cache[compilerPath], held);
    }
    finally { delete require.cache[compilerPath]; }
  });
  function reject(label, mutate, restore, pattern) {
    ok(label, () => {
      mutate();
      try { assert.throws(() => protocol.consumeArtifact(artifact, options), pattern); }
      finally { restore(); }
    });
  }
  ok('changed extraWat rejects', () => assert.throws(() => protocol.consumeArtifact(artifact, { ...options, extraWat: options.extraWat + ' ' }), /provenance/));
  ok('changed tailCalls rejects', () => assert.throws(() => protocol.consumeArtifact(artifact, { ...options, tailCalls: false }), /provenance/));
  for (const file of ['src/13-exports.wat', 'src/main.watx', 'tools/watx-src/compiler.js', 'tools/watx.js', 'tools/watx-closure.js', 'tools/protected-writer-entries.js', 'test/compile-src.js', 'test/render-helper.js']) {
    const good = fs.readFileSync(path.join(temp, file));
    reject(`changed ${file} rejects without cached identity`, () => put(file, Buffer.concat([good, Buffer.from('\n;;change')])), () => put(file, good), /provenance/);
  }
  reject('new source input rejects', () => put('src/unlisted.wat', ';; added'), () => fs.unlinkSync(path.join(temp, 'src/unlisted.wat')), /provenance/);
  reject('module hash rejects', () => put('module.wasm', Buffer.from([0,97,115,109,2,0,0,0])), () => put('module.wasm', wasm), /module mismatch/);
  reject('missing module rejects', () => fs.unlinkSync(artifact), () => put('module.wasm', wasm), /ENOENT/);
  reject('missing manifest rejects', () => fs.unlinkSync(`${artifact}.json`), () => put('module.wasm.json', goodManifest), /ENOENT/);
  reject('malformed JSON rejects', () => put('module.wasm.json', '{'), () => put('module.wasm.json', goodManifest), SyntaxError);
  for (const bad of [null, {}, { ...JSON.parse(goodManifest), extra: 1 }, { ...JSON.parse(goodManifest), module: { bytes: 8388609, sha256: 'a'.repeat(64) } }])
    reject('malformed/unknown/oversized metadata rejects', () => put('module.wasm.json', JSON.stringify(bad)), () => put('module.wasm.json', goodManifest), /metadata|provenance/);
  // Stat doubles exercise rejection before allocation/read without staging an
  // oversized module inside this task's small disk allocation.
  for (const [name, limit] of [['module.wasm', 8388608], ['module.wasm.json', 131072]]) {
    ok(`${name} size bound rejects before reading`, () => {
      const original = fs.fstatSync;
      const target = fs.statSync(path.join(temp, name));
      fs.fstatSync = fd => {
        const s = original(fd);
        if (s.dev === target.dev && s.ino === target.ino)
          return { isFile: () => true, size: limit + 1 };
        return s;
      };
      try { assert.throws(() => protocol.consumeArtifact(artifact, options), /size\/type/); }
      finally { fs.fstatSync = original; }
    });
  }
  // Runtime dependency fixtures. Call the actual helper, with a tiny supplied
  // buffer and an instantiate double: this is not native qualification.
  put('lib/canvas-compat.js', 'exports.createCanvas=(width,height)=>({width,height});');
  put('lib/host-imports.js', 'exports.createHostImports=()=>({host:{},gdi:{}});');
  put('lib/renderer.js', 'exports.Win98Renderer=class{};');
  global.WebAssembly = {
    Module: class {}, Memory: class { constructor() { throw Error('unexpected guest memory'); } },
    instantiate: async value => { instantiations++; const instance = { exports: {} };
      return value instanceof global.WebAssembly.Module ? instance : { instance, module: new global.WebAssembly.Module() }; },
  };
  Module._load = function(request, parent, ...rest) {
    if (compilerDenied && /(?:compile-src|watx(?:\.js|-src|\-closure))/.test(request)) {
      deniedImports++; throw Error(`compiler import forbidden: ${request}`);
    }
    return originalLoad.call(this, request, parent, ...rest);
  };
  const { bootRenderHarness } = require(path.join(temp, 'test/render-helper'));
  const harnessOptions = { ...options, fonts: 'none', memory: { buffer: new ArrayBuffer(64) } };
  (async () => {
    compilerDenied = true;
    process.env.WINE_RENDER_ARTIFACT = artifact;
    const beforeCalls = fs.readFileSync(path.join(temp, 'compile-calls'), 'utf8');
    await bootRenderHarness(harnessOptions);
    assert.strictEqual(deniedImports, 0);
    assert.strictEqual(require.cache[path.join(temp, 'test/compile-src.js')], undefined);
    assert.strictEqual(require.cache[path.join(temp, 'tools/watx.js')], undefined);
    assert.strictEqual(fs.readFileSync(path.join(temp, 'compile-calls'), 'utf8'), beforeCalls);
    checks++; console.log('PASS actual consume harness imports/invokes no compiler');
    fs.unlinkSync(`${artifact}.json`);
    await assert.rejects(bootRenderHarness(harnessOptions), /ENOENT/);
    assert.strictEqual(instantiations, 1);
    assert.strictEqual(deniedImports, 0);
    put('module.wasm.json', goodManifest);
    checks++; console.log('PASS actual consume missing manifest fails before instantiate and no compile fallback');
    await assert.rejects(bootRenderHarness({ ...harnessOptions, extraWat: '' }), /provenance/);
    assert.strictEqual(instantiations, 1);
    assert.strictEqual(deniedImports, 0);
    checks++; console.log('PASS actual consume mismatched extraWat fails before instantiate and no compile fallback');
    process.env.WINE_RENDER_ARTIFACT_PREPARE = artifact;
    await assert.rejects(bootRenderHarness(harnessOptions), /mutually exclusive/);
    delete process.env.WINE_RENDER_ARTIFACT_PREPARE;
    await assert.rejects(bootRenderHarness({ ...harnessOptions, prebuiltModule: new WebAssembly.Module() }), /cannot be combined/);
    process.env.WINE_RENDER_ARTIFACT = '';
    await assert.rejects(bootRenderHarness(harnessOptions), /absolute/);
    delete process.env.WINE_RENDER_ARTIFACT;
    compilerDenied = false;
    put('src/expected.wat', options.extraWat);
    await bootRenderHarness(harnessOptions);
    await bootRenderHarness(harnessOptions);
    assert.strictEqual(fs.readFileSync(path.join(temp, 'compile-calls'), 'utf8'), beforeCalls + 'called\n');
    checks++; console.log('PASS default canonical helper transform and unchanged-input cache');
    put('src/13-exports.wat', ';; changed between default calls\n');
    await bootRenderHarness(harnessOptions);
    assert.strictEqual(fs.readFileSync(path.join(temp, 'compile-calls'), 'utf8'), beforeCalls + 'called\ncalled\n');
    checks++; console.log('PASS default source change invalidates cache');
    put('src/expected.wat', '');
    process.env.EXPECT_TAIL = 'false';
    await bootRenderHarness({ fonts: 'none', memory: harnessOptions.memory, extraWat: null, tailCalls: false });
    delete process.env.EXPECT_TAIL;
    checks++; console.log('PASS default falsy extraWat and non-tail compatibility');
    compilerDenied = true;
    const h = await bootRenderHarness({ fonts: 'none', memory: harnessOptions.memory, prebuiltModule: new WebAssembly.Module() });
    assert(h.instance && h.module);
    await assert.rejects(bootRenderHarness({ prebuiltModule: {}, extraWat: '' }), /prebuiltModule requires/);
    await assert.rejects(bootRenderHarness({ prebuiltModule: new WebAssembly.Module(), extraWat: '(export)' }), /no extraWat/);
    checks++; console.log('PASS prebuilt callers retain overload and extraWat rejection without compiler');
    compilerDenied = false;
    prepare('', false);
    assert.deepStrictEqual(protocol.consumeArtifact(artifact, { extraWat: '', tailCalls: false }), wasm);
    checks++; console.log('PASS no-extraWat non-tail artifact protocol');
    console.log(`PASS ${checks} protocol checks; no production/native renderer qualification`);
    await require('./render-executable-cache-controls')();
  })().catch(e => { console.error(e); process.exitCode = 1; }).finally(cleanup);
} catch (e) { cleanup(); throw e; }

function cleanup() {
  Module._load = originalLoad;
  global.WebAssembly = originalWasm;
  for (const key of ['WINE_RENDER_ARTIFACT', 'WINE_RENDER_ARTIFACT_PREPARE', 'EXPECT_TAIL']) {
    if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  }
  fs.rmSync(temp, { recursive: true, force: true });
}
