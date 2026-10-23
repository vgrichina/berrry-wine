'use strict';
// Independent protocol evidence: real adapters, tiny loader/host doubles only.
// No compiler evaluation, Wasm compile/instantiate, or large memory allocation.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert');
const {spawnSync}=require('child_process');
const repo=path.join(__dirname,'reviewed-inputs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'independent-render-'));
const results=[];
const put=(p,s)=>{p=path.join(temp,p);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);};
const loader=`exports.sourceTextFromBytes=b=>b.toString('utf8');exports.compile=(source,vfs,options)=>{require('assert').deepStrictEqual(options,{mode:'production',standardWat:true,runtimeBuiltins:false,tailCalls:true,strictDeclarations:true});return {success:true,wasmBinary:Uint8Array.from([0,97,115,109,1,0,0,0])}};`;
function child(label,body,env={}) {
  const r=spawnSync(process.execPath,['--max-old-space-size=256','-e',body],{cwd:temp,env:{...process.env,WINE_RENDER_ARTIFACT:undefined,WINE_RENDER_ARTIFACT_PREPARE:undefined,...env},encoding:'utf8',timeout:10000,maxBuffer:16384});
  assert.strictEqual(r.status,0,`${label}: ${r.stderr}`);results.push({label,status:0,stdout:r.stdout.trim()});
}
try {
  for(const p of ['test/render-helper.js','test/render-artifact.js','test/compile-src.js','tools/watx-closure.js','lib/wat-manifest.js','test/test-d3d-software-compaction.js','test/test-d3d-software-ctx-arena-reuse.js']) put(p,fs.readFileSync(path.join(repo,p)));
  put('src/main.watx','(module (include "13-exports.wat"))');put('src/13-exports.wat',';; tiny fixture');
  put('tools/watx.js',loader);put('tools/watx-src/compiler.js','// inventory fixture');
  put('lib/canvas-compat.js','exports.createCanvas=()=>({});');put('lib/host-imports.js','exports.createHostImports=()=>({host:{},gdi:{}});');put('lib/renderer.js','exports.Win98Renderer=class{};');
  const artifact=path.join(temp,'module.wasm');
  assert.equal(require(path.join(repo,'tools/test-tiers')).classifyTest('test/test-render-artifact-protocol.js'),'unit');
  results.push({label:'actual main test-tier classifier includes protocol regression in unit/quick',status:0});
  child('positive actual canonical closure/options/transform and exact consume',`
    const assert=require('assert'),p=require('./test/render-artifact');
    p.prepareArtifact(${JSON.stringify(artifact)},{extraWat:'(export "tiny" (func $tiny))',tailCalls:true});
    assert.equal(p.consumeArtifact(${JSON.stringify(artifact)},{extraWat:'(export "tiny" (func $tiny))',tailCalls:true}).length,8);
    assert.throws(()=>p.consumeArtifact(${JSON.stringify(artifact)},{extraWat:'',tailCalls:true}),/provenance/);
    assert.throws(()=>p.consumeArtifact(${JSON.stringify(artifact)},{extraWat:'(export "tiny" (func $tiny))',tailCalls:false}),/provenance/);
    console.log('positive + extraWat/tailCalls rejecting controls PASS');`);
  // A compile-src import does NOT load watx.js: its actual dependency is lazy.
  const goodAdapter=fs.readFileSync(path.join(temp,'test/compile-src.js'));
  child('REPRO prepare accepts receipt for unevaluated changed adapter',`
    const fs=require('fs'),assert=require('assert');require('./test/compile-src');
    assert.equal(require.cache[require.resolve('./tools/watx.js')],undefined);
    fs.writeFileSync('./test/compile-src.js','throw Error("CHANGED adapter must reject")');
    const p=require('./test/render-artifact');p.prepareArtifact(${JSON.stringify(artifact)},{extraWat:'',tailCalls:true});
    assert.equal(p.consumeArtifact(${JSON.stringify(artifact)},{extraWat:'',tailCalls:true}).length,8);
    console.log('DEFECT: changed throw-only compile-src was sealed, cached previous adapter executed, consume accepted');`);
  put('test/compile-src.js',goodAdapter);
  child('REPRO default compiler invalidation executes stale loader',`
    const fs=require('fs'),assert=require('assert');let calls=0;
    global.WebAssembly={Module:class{},instantiate:async()=>{calls++;return {instance:{exports:{}},module:{}}}};
    (async()=>{const h=require('./test/render-helper'),p=require('./test/render-artifact');
    const opts={fonts:'none',memory:{buffer:new ArrayBuffer(8)}};
    await h.bootRenderHarness(opts);const before=JSON.stringify(p.identity());
    fs.writeFileSync('./tools/watx.js','throw Error("CHANGED compiler must reject")');
    assert.notEqual(JSON.stringify(p.identity()),before);
    await h.bootRenderHarness(opts);assert.equal(calls,2);
    console.log('DEFECT: fresh identity sees throw-only compiler; second default boot succeeds with cached old loader');
    })().catch(e=>{console.error(e);process.exitCode=1});`);
  put('tools/watx.js',loader);
  for(const name of ['test-d3d-software-compaction.js','test-d3d-software-ctx-arena-reuse.js']) {
    child(`PREPARATION ONLY actual ${name}`,`
      const Module=require('module'),load=Module._load;
      Module._load=function(r,...a){if(r.includes('d3d9-software-backend')||r.includes('fixtures/d3d9-triangle-edge-cases'))return {};return load.call(this,r,...a)};
      global.WebAssembly={Memory:class{constructor(){throw Error('forbidden memory')}},instantiate(){throw Error('forbidden instantiate')}};
      require('./test/${name}');process.on('beforeExit',()=>{throw Error('preparation did not exit')});`,{WINE_RENDER_ARTIFACT_PREPARE:artifact});
    const m=JSON.parse(fs.readFileSync(artifact+'.json'));
    const source=fs.readFileSync(path.join(temp,'test',name),'utf8');
    const extra=/bootRenderHarness\(\{fonts:'none',extraWat:`([^`]+)`\}\)/.exec(source)[1];
    const hash=require('crypto').createHash('sha256').update(Buffer.from(extra,'utf16le')).digest('hex');
    assert.equal(m.extraWat.sha256,hash);
    results.push({label:`${name} distinct exact extraWat bound; assertions unexecuted`,sha256:hash});
  }
  // Descriptor size doubles plus an independent allocation sentinel, no large files.
  child('independent descriptor allocation bounds and no compiler import',`
    const fs=require('fs'),assert=require('assert'),Module=require('module');
    const load=Module._load;Module._load=function(r,...a){if(/compile-src|watx/.test(r))throw Error('compiler import');return load.call(this,r,...a)};
    const p=require('./test/render-artifact'),f=${JSON.stringify(artifact)},alloc=Buffer.alloc;
    const opts={extraWat:${JSON.stringify(/bootRenderHarness\(\{fonts:'none',extraWat:`([^`]+)`\}\)/.exec(fs.readFileSync(path.join(temp,'test/test-d3d-software-ctx-arena-reuse.js'),'utf8'))[1])},tailCalls:true};
    assert.equal(p.consumeArtifact(f,opts).length,8);
    Buffer.alloc=n=>{assert(n<=8388608,'oversized allocation');return alloc(n)};
    const stat=fs.fstatSync;let oversized=f;
    fs.fstatSync=fd=>{const s=stat(fd),target=fs.statSync(oversized);if(s.ino===target.ino&&s.dev===target.dev)return {isFile:()=>true,size:oversized===f?8388609:131073};return s};
    assert.throws(()=>p.consumeArtifact(f,opts),/size/);
    oversized=f+'.json';assert.throws(()=>p.consumeArtifact(f,opts),/size/);
    console.log('oversized module + manifest descriptors rejected before allocation; no compiler evaluation');`);
  console.log(JSON.stringify({verdict:'REJECT candidate: executable module cache not bound to receipt',results},null,2));
} finally {fs.rmSync(temp,{recursive:true,force:true});}
