'use strict';

// Called by the protocol unit test. REAL compile-src, closure and watx.js;
// four tiny vm stage doubles and host/instantiate doubles. Never native Wasm.
module.exports = async function executableCacheControls({ inputRoot, loaderRoot } = {}) {
  const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert');
  const root = inputRoot || path.resolve(__dirname, '..');
  const temp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'render-executable-'));
  const originalWasm = global.WebAssembly;
  const put = (file, bytes) => {
    const full = path.join(temp, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, bytes);
  };
  const get = file => fs.readFileSync(path.join(temp, file), 'utf8');
  let checks = 0, hostCalls = 0;
  function pass(label) { checks++; console.log(`PASS executable ${label}`); }
  try {
    for (const file of ['test/render-helper.js', 'test/render-artifact.js', 'test/compile-src.js',
      'tools/watx-closure.js', 'tools/protected-writer-entries.js', 'tools/watx.js', 'lib/wat-manifest.js'])
      put(file, fs.readFileSync(path.join(file === 'tools/watx.js' && loaderRoot ? loaderRoot : root, file)));
    put('src/main.watx', '(module (include "13-exports.wat"))');
    const armedGlobal = '(global $rep_store_step (mut i32) (i32.const 0))\n';
    put('src/13-exports.wat', armedGlobal + 'BASE');
    put('tools/watx-src/compiler-parser.js', 'function watxSourceTextFromBytes(b){return b.toString("utf8")}');
    put('tools/watx-src/compiler-stages.js', '// tiny stage');
    put('tools/watx-src/compiler-codegen.js', '// tiny codegen');
    function stage(marker) {
      return `function compile(source,vfs,options){
        if(source!=='(module (include "13-exports.wat"))')throw Error('entry mismatch');
        const base=vfs.get('13-exports.wat');
        if(base!==vfs.get('src/13-exports.wat')||base!==vfs.get('./13-exports.wat'))throw Error('alias mismatch');
        const prefix=${JSON.stringify(armedGlobal)};
        const suffix='\\nEXTRA\\n\\n;; Protected external entry wrappers; internal calls retain their targets.\\n\\n';
        if(base!==prefix+'BASE'+suffix&&base!==prefix+'BASE CHANGED'+suffix)throw Error('extraWat mismatch');
        if(options.mode!=='production'||!options.standardWat||options.runtimeBuiltins!==false||
           !options.strictDeclarations||typeof options.tailCalls!=='boolean')throw Error('canonical options mismatch');
        return {success:true,wasmBinary:Uint8Array.from([0,97,115,109,1,0,0,${marker}+(base.includes('CHANGED')?10:0)+(options.tailCalls?0:20)])};
      }`;
    }
    put('tools/watx-src/compiler.js', stage(1));
    put('lib/canvas-compat.js', 'exports.createCanvas=()=>({});');
    put('lib/host-imports.js', 'exports.createHostImports=()=>({host:{},gdi:{}});');
    put('lib/renderer.js', 'exports.Win98Renderer=class{};');
    global.WebAssembly = {
      Module: class {}, Memory: class { constructor() { throw Error('native memory forbidden'); } },
      instantiate: async bytes => {
        hostCalls++;
        return { instance: { exports: { marker: bytes[7] } }, module: {} };
      },
    };
    const helper = require(path.join(temp, 'test/render-helper'));
    const protocol = require(path.join(temp, 'test/render-artifact'));
    const heldCompile = require(path.join(temp, 'test/compile-src'));
    const heldClosure = require(path.join(temp, 'tools/watx-closure'));
    const transform = (file, source) => file === '13-exports.wat' ? source + '\nEXTRA\n' : source;
    assert.equal(heldCompile.compileSrcWasm(transform)[7], 1);
    const heldLoader = require.cache[path.join(temp, 'tools/watx.js')];
    const opts = { fonts: 'none', extraWat: 'EXTRA', memory: { buffer: new ArrayBuffer(8) } };
    const boot = helper.bootRenderHarness; // Retain this export for EVERY change.
    const expectMarker = async n => assert.equal((await boot(opts)).exports.marker, n);
    const artifact = path.join(temp, 'module.wasm');
    protocol.prepareArtifact(artifact, { extraWat: 'EXTRA', tailCalls: true });
    assert.equal(protocol.consumeArtifact(artifact, { extraWat: 'EXTRA', tailCalls: true })[7], 1);
    await expectMarker(1);
    pass('actual loader vm stages + canonical adapters/options/three aliases + held exports');

    put('tools/watx-src/compiler.js', stage(2));
    await expectMarker(2);
    assert.equal(heldCompile.compileSrcWasm(transform)[7], 1);
    assert.strictEqual(require.cache[path.join(temp, 'tools/watx.js')], heldLoader);
    assert.strictEqual(require(path.join(temp, 'tools/watx-closure')), heldClosure);
    pass('changed vm stage executes marker 2; shared loader/closure and old exports untouched');

    const loader = get('tools/watx.js');
    put('tools/watx.js', loader + '\nconst prior=module.exports.compile;module.exports.compile=(...a)=>{const r=prior(...a);r.wasmBinary[7]+=3;return r};');
    await expectMarker(5);
    pass('changed actual loader executes new wrapper marker 5');
    put('src/13-exports.wat', armedGlobal + 'BASE CHANGED');
    await expectMarker(15);
    put('src/13-exports.wat', armedGlobal + 'BASE');
    await expectMarker(5);
    assert.equal((await boot({ ...opts, tailCalls: false })).exports.marker, 25);
    pass('changed source and tailCalls compile exact new VFS/options');

    const adapter = get('test/compile-src.js');
    put('test/compile-src.js', adapter + '\nconst prior=module.exports.compileSrcWasm;module.exports.compileSrcWasm=(...a)=>{const r=prior(...a);r[7]+=7;return r};');
    await expectMarker(12);
    const closure = get('tools/watx-closure.js');
    put('tools/watx-closure.js', closure + '\nconst prior=module.exports.compileClosure;module.exports.compileClosure=(...a)=>{const r=prior(...a);r.wasmBinary[7]+=5;return r};');
    await expectMarker(17);
    protocol.prepareArtifact(artifact, { extraWat: 'EXTRA', tailCalls: true });
    assert.equal(protocol.consumeArtifact(artifact, { extraWat: 'EXTRA', tailCalls: true })[7], 17);
    assert.equal(heldCompile.compileSrcWasm(transform)[7], 1);
    pass('changed compile-src and closure execute new code; prepare/consume marker 17 matches');

    for (const file of ['test/compile-src.js', 'tools/watx-closure.js', 'tools/protected-writer-entries.js', 'tools/watx.js', 'tools/watx-src/compiler.js']) {
      const good = get(file), before = hostCalls;
      put(file, 'throw Error("changed executable sentinel")');
      await assert.rejects(async () => boot(opts), /changed executable sentinel/);
      assert.throws(() => protocol.prepareArtifact(artifact, { extraWat: 'EXTRA', tailCalls: true }), /changed executable sentinel/);
      assert.equal(hostCalls, before);
      put(file, good);
    }
    pass('throw-only adapter/closure/loader/vm stage fail with their own sentinel before host');

    const artifactSource = get('test/render-artifact.js');
    const changedArtifact = artifactSource.replace('  return bytes;\n}\n\nfunction compileHarness', '  bytes[7] += 11;\n  return bytes;\n}\n\nfunction compileHarness');
    assert.notEqual(changedArtifact, artifactSource);
    put('test/render-artifact.js', changedArtifact);
    await expectMarker(28);
    // Same retained protocol object delegates to new evaluated artifact code.
    protocol.prepareArtifact(artifact, { extraWat: 'EXTRA', tailCalls: true });
    assert.equal(protocol.consumeArtifact(artifact, { extraWat: 'EXTRA', tailCalls: true })[7], 28);
    pass('changed artifact implementation via retained exports executes marker 28');

    const helperSource = get('test/render-helper.js');
    put('test/render-helper.js', helperSource + '\nconst prior=module.exports.bootRenderHarness;module.exports.bootRenderHarness=async(...a)=>({...await prior(...a),freshHelper:true});');
    assert.throws(() => protocol.identity({}, Buffer.from(helperSource)), /helper implementation changed/);
    const fresh = await boot(opts);
    assert.equal(fresh.freshHelper, true);
    assert.equal(fresh.exports.marker, 28);
    const helperModule = require.cache[path.join(temp, 'test/render-helper.js')];
    const artifactModule = require.cache[path.join(temp, 'test/render-artifact.js')];
    const childCounts = [helperModule.children.length, artifactModule.children.length];
    for (let revision = 0; revision < 3; revision++) {
      put('test/render-helper.js', helperSource + `\n// helper revision ${revision}`);
      put('test/render-artifact.js', changedArtifact + `\n// artifact revision ${revision}`);
      await expectMarker(28);
      assert.deepStrictEqual([helperModule.children.length, artifactModule.children.length], childCounts);
    }
    pass('changed helper executes fresh body via retained boot export');
    for (const file of ['test/render-helper.js', 'test/render-artifact.js']) {
      const good = get(file), before = hostCalls;
      put(file, 'throw Error("changed orchestration sentinel")');
      await assert.rejects(async () => boot(opts), /changed orchestration sentinel/);
      assert.equal(hostCalls, before);
      put(file, good);
    }
    pass('changed throw-only helper/artifact fail before host through old exports');

    // No accidental fallback to an unsealed filesystem read in the graph.
    const goodLoader = get('tools/watx.js');
    put('outside-input', 'not inventoried');
    put('tools/watx.js', goodLoader + '\nrequire("fs").readFileSync(require("path").join(__dirname,"../outside-input"));');
    await assert.rejects(async () => boot(opts), /unsealed read/);
    put('tools/watx.js', goodLoader);
    pass('new unsealed executable dependency read fails closed');
    console.log(`PASS ${checks} executable cache controls; tiny stages/host doubles, no native qualification`);
  } finally {
    global.WebAssembly = originalWasm;
    fs.rmSync(temp, { recursive: true, force: true });
  }
};
