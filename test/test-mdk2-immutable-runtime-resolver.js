'use strict';
// Real original bytes, no source/module/media fixture copies or guest execution.
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const cp = require('node:child_process');
const api = require('../tools/mdk2-immutable-runtime-resolver.cjs');
const entry = require('../tools/mdk2-construction-driver-integration.cjs');
const RUN = path.join(api.ROOT, 'scratch/runs/20261104-mdk2-immutable-runtime-resolver');
fs.mkdirSync(RUN, {recursive:true});
const temporary = fs.mkdtempSync(path.join(RUN, 'paths-'));
after(() => fs.rmSync(temporary, {recursive:true, force:true}));
let resolver;
// Faults affect only this VM's reads of real files/Git blobs. No shared file
// is changed, and successful controls below use the production module itself.
function faulted({file, gitPath, truncate = false, symlink, decodedModule} = {}) {
  const alter = bytes => truncate ? bytes.subarray(0, bytes.length - 1) : Buffer.concat([Buffer.from([bytes[0] ^ 1]), bytes.subarray(1)]);
  const facade = Object.create(fs);
  facade.readFileSync = function(p, ...args) {
    const bytes = fs.readFileSync(p, ...args);
    const name = typeof p === 'number' ? fs.readlinkSync('/proc/self/fd/' + p) : String(p);
    return name === path.join(api.ROOT, file || 'NEVER') ? alter(bytes) : bytes;
  };
  facade.lstatSync = function(p, ...args) {
    const stat = fs.lstatSync(p, ...args);
    return p === path.join(api.ROOT, symlink || 'NEVER') ? new Proxy(stat, {get:(s,k) => k === 'isSymbolicLink' ? () => true : Reflect.get(s,k)}) : stat;
  };
  const child = Object.create(cp);
  child.execFileSync = function(command, args, ...rest) {
    const bytes = cp.execFileSync(command, args, ...rest);
    return args.includes(api.SOURCE + ':' + gitPath) ? alter(bytes) : bytes;
  };
  const filename = path.join(api.ROOT, 'tools/mdk2-immutable-runtime-resolver.cjs');
  const mod = {exports:{}};
  const gzip = Object.create(require('node:zlib'));
  gzip.gunzipSync = function(...args) {
    const bytes = require('node:zlib').gunzipSync(...args);
    return decodedModule && api.sha(bytes) === decodedModule ? alter(bytes) : bytes;
  };
  const load = name => name === 'node:fs' ? facade : name === 'node:child_process' ? child : name === 'node:zlib' ? gzip : require(name);
  new vm.Script(Module.wrap(fs.readFileSync(filename, 'utf8')), {filename}).runInThisContext()(mod.exports, load, mod, filename, path.dirname(filename));
  return mod.exports;
}
test('real filesystem resolver validates all original432 pins and retains references', () => {
  resolver = api.createResolver();
  const rows = resolver.verify();
  assert.equal(rows.length,432);
  assert.equal(rows.filter(r => r.source.kind === 'live').length,419);
  assert.equal(rows.filter(r => r.source.kind === 'git').length,11);
  assert.equal(rows.filter(r => r.source.kind === 'gzip' || r.source.kind === 'retained').length,2);
  assert.equal(api.sha(resolver.manifest()),api.PINS_SHA);
  const independent = entry.pinnedRuntime();
  for (const name of Object.keys(independent.files)) assert.equal(resolver.read(name).toString(), independent.files[name]);
  for (const row of independent.pins.moduleFiles) assert.deepEqual(resolver.read(row.path),entry.retainedModule(row));
  // A returned buffer or inventory mutation must not alter subsequent reads.
  const a = resolver.read('host.js'); a[0] ^= 1;
  assert.notEqual(api.sha(a), api.sha(resolver.read('host.js')));
  fs.writeFileSync(path.join(RUN,'filesystem.json'),JSON.stringify(rows,null,2)+'\n');
});
test('stale or truncated manifest rejects before source selection', () => {
  for (const bytes of [Buffer.from('{}'), resolver.manifest().subarray(1)]) assert.throws(() => api.createResolver({manifestBytes:bytes}),/stale original manifest/);
});
for (const truncate of [false,true]) {
  test((truncate ? 'truncated' : 'altered') + ' historical Git source rejects against original pin', () => {
    assert.throws(() => faulted({gitPath:'host.js',truncate}).createResolver(), /runtime (SHA|size) mismatch/);
  });
  test((truncate ? 'truncated' : 'altered') + ' retained compressed module rejects', () => {
    const module = entry.pinnedRuntime().pins.moduleFiles[0];
    const storage = fs.existsSync(path.join(api.ROOT,module.localReference)) ? module.localReference : module.localReference + '.gz';
    assert.throws(() => faulted({file:storage,truncate}).createResolver());
  });
  test((truncate ? 'truncated' : 'altered') + ' decoded original module rejects its exact SHA/size', () => {
    const module = entry.pinnedRuntime().pins.moduleFiles[0];
    assert.throws(() => faulted({decodedModule:module.sha256,truncate}).createResolver(), /runtime (SHA|size) mismatch/);
  });
  test((truncate ? 'truncated' : 'altered') + ' live-only media rejects instead of substituting', () => {
    assert.throws(() => faulted({file:'test/binaries/candidates/mdk2-demo/installed/mdk2demo/data/base.zip',truncate}).createResolver());
  });
}
test('a previously selected live source cannot fall back to Git after mutation', () => {
  // Build the VM resolver before enabling a byte fault in a matching Git file.
  const fsRead = fs.readFileSync;
  const filename = path.join(api.ROOT,'tools/mdk2-immutable-runtime-resolver.cjs');
  let armed = false;
  const facade = Object.create(fs);
  facade.readFileSync = function(p,...rest) {
    const bytes = fsRead(p,...rest);
    if (armed && typeof p === 'number' && fs.readlinkSync('/proc/self/fd/'+p) === path.join(api.ROOT,'lib/apps.js')) return bytes.subarray(1);
    return bytes;
  };
  const mod = {exports:{}};
  new vm.Script(Module.wrap(fsRead(filename,'utf8'))).runInThisContext()(mod.exports,n => n === 'node:fs' ? facade : require(n),mod,filename,path.dirname(filename));
  const r = mod.exports.createResolver(); armed = true;
  assert.throws(() => r.read('lib/apps.js'),/runtime size mismatch/);
});
test('foreign, absolute, out-of-root, encoded and traversal paths reject', () => {
  for (const name of ['../host.js','lib/../host.js','/host.js',api.ROOT+'/host.js','lib//apps.js','./host.js','lib\\apps.js','%68ost.js','tools/mdk2-entry-staging.cjs']) assert.throws(() => resolver.read(name));
  for (const url of ['//foreign/host.js','http://foreign/host.js','/../host.js','/%2e%2e/host.js','/lib/../host.js','/%2fhost.js']) assert.throws(() => api.requestPath(url));
});
test('real symlink root and foreign symlink paths reject; selected runtime symlink rejects', () => {
  const alias = path.join(temporary,'root'); fs.symlinkSync(api.ROOT,alias);
  assert.throws(() => api.createResolver({root:alias}), /symlink root/);
  const link = path.join(temporary,'host.js'); fs.symlinkSync(path.join(api.ROOT,'host.js'),link);
  assert.throws(() => resolver.read(path.relative(api.ROOT,link)),/foreign runtime/);
  assert.throws(() => faulted({symlink:'host.js'}).createResolver(),/symlink runtime/);
});
test('forged resolver cannot install an unchecked filesystem or HTTP hook', async () => {
  const forged = {...resolver, read:() => Buffer.from('wrong')};
  await assert.rejects(api.installAdapter(forged), /unverified resolver/);
  await assert.rejects(api.startServer(forged), /unverified resolver/);
});
test('real loopback endpoint fetches all432 full bodies, ranges and original endpoint preflight', async () => {
  const server = await api.startServer(resolver);
  try {
    const rows = await api.verifyHTTP(resolver,server); assert.equal(rows.length,432);
    const result = await require('../scratch/runs/20261104-mdk2-measured-escape-original/endpoint-preflight.cjs').check(server,JSON.parse(resolver.manifest()));
    assert.equal(result.rows.length,4);
    const base = 'http://127.0.0.1:'+server.address().port;
    const response = await fetch(base+'/build/wine-assembly.wasm',{headers:{range:'bytes=0-31'}});
    assert.equal(response.status,206); assert.deepEqual(Buffer.from(await response.arrayBuffer()),resolver.read('build/wine-assembly.wasm').subarray(0,32));
    const head = await fetch(base+'/host.js',{method:'HEAD'}); assert.equal(head.status,200); assert.equal((await head.arrayBuffer()).byteLength,0);
    const badRange = await fetch(base+'/host.js',{headers:{range:'bytes=999999999-'}}); assert.equal(badRange.status,416); await badRange.arrayBuffer();
    for (const name of ['/tools/mdk2-entry-staging.cjs','/%2e%2e%2fhost.js','/lib%2f..%2fhost.js','//foreign/host.js']) {
      const bad = await fetch(base+name); assert.equal(bad.status,403); await bad.arrayBuffer();
    }
    fs.writeFileSync(path.join(RUN,'http.json'),JSON.stringify({rows,endpoint:result,range:true,head:true,foreignRejected:true},null,2)+'\n');
  } finally { await api.close(server); }
  assert.equal(server.listening,false);
});
test('unchanged accepted preflight loops and HTTP audit consume the installed exact adapter', async () => {
  const originalRead = fs.readFileSync;
  const staticModule = require('../test/static-server.js'), originalStart = staticModule.startStaticServer;
  const adapter = await api.installAdapter(resolver);
  let server;
  try {
    assert.equal(adapter.inspection.closure.length,111); assert.equal(adapter.http.length,432);
    const runSource = entry.run.toString();
    const loop = runSource.slice(runSource.indexOf('for (const row of JSON.parse(bytes).files)'),runSource.indexOf('  const {file, source}'));
    assert(loop.startsWith('for (const row')); assert(loop.includes('fs.readFileSync(path.join(ROOT, row.path))'));
    new Function('fs','path','ROOT','bytes','assert','sha',loop)(fs,path,api.ROOT,resolver.manifest(),assert,api.sha);
    const composed = entry.compose(path.join(RUN,'NEVER-LAUNCH')).source;
    const start = composed.indexOf('for(const item of pins.files)'), end = composed.indexOf('  const puppeteer=',start);
    assert(start > 0 && end > start);
    new Function('fs','path','ROOT','pins','sha',composed.slice(start,end))(fs,path,api.ROOT,JSON.parse(resolver.manifest()),api.sha);
    const callbackStart = composed.indexOf('headers:(req,resolved)=>');
    const callbackEnd = composed.indexOf('}});',callbackStart);
    assert(callbackStart>0 && callbackEnd>callbackStart);
    const logs = [], pins = JSON.parse(resolver.manifest());
    const callback = new Function('path','ROOT','fs','sha','pins','log','let halted=false;return ('+composed.slice(callbackStart+'headers:'.length,callbackEnd+1)+');')(path,api.ROOT,fs,api.sha,pins,(_file,row) => logs.push(row));
    server = await staticModule.startStaticServer({root:api.ROOT,port:0,crossOriginIsolated:true,headers:callback});
    await api.verifyHTTP(resolver,server);
    assert.equal(logs.length,432); assert(logs.every(r => r.match));
    assert.throws(() => fs.readFileSync(api.ROOT+'/lib/../host.js'),/noncanonical filesystem/);
    // Original release gate still fails before controllers, output or bootstrap.
    assert.throws(() => entry.run(path.join(RUN,'ABSENT-FRESH-RELEASE')),/ENOENT/);
    assert(!fs.existsSync(path.join(RUN,'ABSENT-FRESH-RELEASE')));
    await assert.rejects(api.installAdapter(resolver),/clean dedicated process/);
    fs.writeFileSync(path.join(RUN,'integration.json'),JSON.stringify({accepted:api.ACCEPTED,helpers:adapter.inspection.closure.length,
      filesystemLoops:[432,432],httpAudit:logs.length,allAuditMatch:true,originalEndpoint:true,releaseGate:'ENOENT before output',
      gameplay:false,controllersCreated:false,box:{id:null,state:'NA',expiry:'NA',shutdownOwner:'coordinator'}},null,2)+'\n');
  } finally { if(server) await api.close(server); adapter.restore(); }
  assert.equal(fs.readFileSync,originalRead); assert.equal(staticModule.startStaticServer,originalStart);
});
