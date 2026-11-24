'use strict';
// Diagnostic overlay only. All compiler/source dependencies execute in place.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = '/home/user/wine-assembly-shadow-man-span-static-canonical-oct23';
const H = path.resolve(__dirname, '../../ops');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const manifestPath = ROOT + '/docs/re-notes/shadow-man-span-static-canonical-20261023/manifest.json';
const m = JSON.parse(fs.readFileSync(manifestPath));
assert.equal(m.candidate, 'b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a');
assert.equal(m.files.length, 140);
const pins = JSON.parse(fs.readFileSync(path.join(__dirname, '../test/fixtures/maelstrom-select-hook-pins.json')));
const hookPath = path.join(__dirname, 'maelstrom-select-completion-hook.cjs');
assert.equal(sha(fs.readFileSync(hookPath)), 'b7c77c20b12cd582d6fcfbe246e1f0abdcb644266fc3f161bf5d683d93b13930');
const inputSeals = m.files.map(row => {
  const b = fs.readFileSync(path.join(ROOT, row.path));
  assert.equal(b.length, row.bytes, row.path); assert.equal(sha(b), row.sha256, row.path);
  return { path: row.path, bytes: b.length, sha256: sha(b), blob: row.blob };
});
const {watxSourceClosure, compileClosure} = require(ROOT + '/tools/watx-closure.js');
const {sourceTextFromBytes} = require(ROOT + '/tools/watx.js');
const hook = require(hookPath);
const original = Object.fromEntries(Object.keys(pins.files).map(p => [p, fs.readFileSync(ROOT + '/' + p, 'utf8')]));
const changed = hook.transform(original, {enabled: true});
const closure = watxSourceClosure();
assert.equal(closure.entry, 'src/main.watx');
const overlays = [];
for (const [p, text] of Object.entries(changed)) {
  if (text === original[p]) continue;
  const f = path.basename(p), decoded = sourceTextFromBytes(Buffer.from(text));
  for (const k of [f, 'src/' + f, './' + f]) closure.vfs.set(k, decoded);
  overlays.push({path:p, originalSHA256:sha(original[p]), transformedSHA256:sha(text), compilerTextSHA256:sha(decoded), bytes:Buffer.byteLength(text)});
}
assert.deepEqual(overlays.map(x => x.path).sort(), ['src/09b-dispatch.wat','src/09d-winsock.wat']);
assert(closure.vfs.get('09d-winsock.wat').includes('(call $msc_end (local.get $msc_token) (i32.const 3))'));
// Walk the actual entry's include edges. No second source-order list.
const reached = new Set();
function visit(key, text) {
  if (reached.has(key)) return; reached.add(key);
  for (const hit of text.matchAll(/\(include\s+"([^"]+)"\s*\)/g)) {
    const f = path.basename(hit[1]);
    assert(closure.vfs.has(hit[1]), 'unresolved include ' + hit[1]);
    visit('src/' + f, closure.vfs.get(hit[1]));
  }
}
visit(closure.entry, closure.source);
for (const row of overlays) assert(reached.has(row.path), 'instrumentation must be reached');
for (const p of reached) {
  const f = path.basename(p);
  for (const k of [f,'src/'+f,'./'+f]) assert.equal(closure.vfs.get(k),closure.vfs.get(f));
}
const {layoutHash, appendSection} = require(ROOT + '/tools/region-layout-hash.js');
const compat = closure; // compat dispatch is (if-const (target tail-calls) ...) in source
const seal = {sourceRoot:ROOT, revision:m.candidate, entry:closure.entry, inputSeals, overlays,
  reached:[...reached].map(p=>({path:p,sha256:sha(p===closure.entry?closure.source:closure.vfs.get(path.basename(p)))})),
  compilerDependencies:inputSeals.filter(r=>!r.path.startsWith('src/')), hookSHA256:sha(fs.readFileSync(hookPath)),
  options:{mode:'production',standardWat:true,runtimeBuiltins:false,strictDeclarations:true,tailCalls:[true,false],names:false,shake:false},
  noMaterializedSources:true, sourceFilesUnchanged:true};
fs.writeFileSync(H+'/build-inputs.json',JSON.stringify(seal,null,2));
if (process.argv.includes('--preflight')) { console.log(JSON.stringify({status:'PASS',reached:reached.size,overlays})); return; }
const outputs = [];
for (const tailCalls of [true,false]) {
  console.log(JSON.stringify({beginCompile:{tailCalls,entry:closure.entry}}));
  const r = compileClosure(tailCalls?closure:compat,{tailCalls,regionShake:null});
  if (!r || !r.success || !r.wasmBinary) {
    const failure={tailCalls,error:r&&(r.error||r.message),file:r&&r.file,line:r&&r.line,col:r&&r.col,diagnostics:r&&r.diagnostics};
    fs.writeFileSync(H+'/compiler-failure.json',JSON.stringify(failure,null,2));
    throw Error('Canonical diagnostic compiler rejected: '+JSON.stringify(failure));
  }
  const computed = layoutHash(r.regions.regions);
  assert.equal(computed,'9a3bc9149d58209c');
  const bytes = appendSection(Buffer.from(r.wasmBinary),computed);
  assert(bytes.length<=8388608);
  const filename=H+(tailCalls?'/select-hook.wasm':'/select-hook.compat.wasm');
  fs.writeFileSync(filename,bytes);
  const row={path:filename,bytes:bytes.length,sha256:sha(bytes),tailCalls,layout:computed,regions:r.regions.regions};
  outputs.push(row); fs.writeFileSync(H+'/build-outputs.json',JSON.stringify(outputs,null,2));
  // Historical guard is preloaded; fixed Buffer with no async native backdoor.
  new WebAssembly.Module(bytes);
  console.log(JSON.stringify({compiled:{path:filename,bytes:row.bytes,sha256:row.sha256,layout:computed}}));
}
for (const row of inputSeals) assert.equal(sha(fs.readFileSync(ROOT+'/'+row.path)),row.sha256);
console.log(JSON.stringify({status:'PASS',compiled:outputs.length,nativeInstances:0}));
