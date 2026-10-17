'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { VirtualFS } = require('../lib/filesystem');
const byteProvider = require('../lib/byte-provider');
const source = fs.readFileSync(process.env.HOST_SOURCE_UNDER_TEST || path.join(__dirname, '../host.js'), 'utf8');
const turn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };
const body = bytes => ({ok:true, status:200, arrayBuffer:async () => Uint8Array.from(bytes).buffer});

function fixture(fetch) {
  const context = {console, URL, URLSearchParams, Uint8Array, setTimeout, clearTimeout, fetch};
  vm.runInNewContext(source + '\n;globalThis.WineAssembly = WineAssembly;', context, {filename:'host.js'});
  // Define browser facilities after loading the class, avoiding unrelated UI startup.
  context.window = {byteProvider};
  // Exercise individual asset cancellation independently of bundle prefetch.
  context.WineAssembly._bundleUnsupported = true;
  const wine = Object.create(context.WineAssembly.prototype);
  wine._helpCtx = {vfs:new VirtualFS()};
  return {W:context.WineAssembly, wine, vfs:wine._helpCtx.vfs};
}

test('pre-aborted retained fetch and mounts do no work or progress', async () => {
  let calls = 0, progress = 0;
  const {W,wine,vfs} = fixture(async () => { calls++; return body([1]); });
  const controller = new AbortController(); controller.abort();
  const transfer = {signal:controller.signal, retained:new Map([['kept.bin',Uint8Array.of(1,2)]]), onTransfer:() => progress++};
  await assert.rejects(W.fetchAssetBytes('kept.bin',transfer), {name:'AbortError'});
  await assert.rejects(wine.loadFiles(['kept.bin'],{transfer}), {name:'AbortError'});
  assert.equal(calls,0); assert.equal(progress,0); assert(!vfs.files.has('c:\\kept.bin'));
});

test('retention preserves downloaded source across actual VFS writes and retry writes', async () => {
  let calls = 0;
  const {W,wine,vfs} = fixture(async () => {calls++; return body([1,2,3,4]);});
  const retained = new Map();
  await wine.loadFiles(['data.bin'],{transfer:{retained}});
  const handle = vfs.createFile('c:\\data.bin',0x40000000,3);
  assert.equal(vfs.writeFile(handle,Uint8Array.of(99),1).bytesWritten,1);
  const retry = await W.fetchAssetBytes('data.bin',{retained});
  assert.deepEqual(Array.from(retry),[1,2,3,4]);
  retry[1] = 88;
  assert.deepEqual(Array.from(await W.fetchAssetBytes('data.bin',{retained})),[1,2,3,4]);
  assert.equal(calls,1);
});

test('whole discovery GET receives launch cancellation; abort does not trigger eager fallback', async () => {
  const controller = new AbortController(); let calls = 0;
  const entered = deferred();
  const {wine,vfs} = fixture((_url,init) => {
    calls++; assert.notEqual(init.method,'HEAD'); assert.equal(init.headers?.Range,undefined);
    entered.resolve(init.signal);
    return new Promise((_resolve,reject) => init.signal?.addEventListener('abort',() => reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true}));
  });
  const loading = wine.loadFiles([{url:'archive.bin',httpRange:true}],{transfer:{signal:controller.signal},required:true});
  const signal = await entered.promise;
  assert.equal(signal.aborted,false);
  controller.abort();
  assert.equal(signal.aborted,true);
  await assert.rejects(loading,{name:'AbortError'});
  assert.equal(calls,1); assert(!vfs.files.has('c:\\archive.bin'));
});

test('abort releases a hung discovery GET and its late completion cannot mount', async () => {
  const controller = new AbortController(), late = deferred(), entered = deferred();
  const calls = [];
  const {wine,vfs} = fixture((url,init) => {
    calls.push(url);
    if (url === 'archive.bin') {entered.resolve();return late.promise;}
    return new Promise((_resolve,reject) => init.signal.addEventListener('abort',() => reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true}));
  });
  let settled = false;
  const loading = wine.loadFiles([{url:'archive.bin',httpRange:true},'eager.bin','never.bin'],{concurrency:2,transfer:{signal:controller.signal}});
  const rejection = assert.rejects(loading,{name:'AbortError'}).then(() => {settled=true;});
  await entered.promise; await turn(); controller.abort(); await turn();
  assert.equal(settled,true,'abort must not wait for an unresponsive network adapter');
  late.resolve(body([1,2,3,4])); await rejection; await turn();
  assert(!vfs.files.has('c:\\archive.bin')); assert(!vfs.files.has('c:\\eager.bin'));
  assert.deepEqual(calls,['archive.bin','eager.bin']);
});

test('cancel during image decode prevents mount and launching next item', async () => {
  const controller = new AbortController(), decode = deferred(), entered = deferred();
  const calls = [];
  const {wine,vfs} = fixture(async url => {calls.push(url); return body([1,2]);});
  wine._decodeMountedImage = async () => {entered.resolve();return decode.promise;};
  const loading = wine.loadFiles([{url:'image.bin',decodeImage:true},'never.bin'],{concurrency:1,transfer:{signal:controller.signal}});
  const rejection = assert.rejects(loading,{name:'AbortError'});
  await entered.promise; controller.abort(); decode.resolve({width:1,height:1,rgba:Uint8Array.of(0,0,0,255)});
  await rejection;
  assert(!vfs.files.has('c:\\image.bin')); assert.deepEqual(calls,['image.bin']);
});

test('sized whole-file provider remains lazy and usable after launch signal ends', async () => {
  const controller = new AbortController(), calls = [];
  const {wine,vfs} = fixture(async (_url,init) => {
    calls.push(init);
    return body([1,2,3,4]);
  });
  await wine.loadFiles([{url:'archive.bin',httpRange:true,size:4}],{transfer:{signal:controller.signal},required:true});
  assert.equal(calls.length,0,'known size mounts without downloading');
  controller.abort();
  const entry = vfs.files.get('c:\\archive.bin');
  assert(entry._provider);
  assert.deepEqual(Array.from(await entry._provider.readRange(0,4)),[1,2,3,4]);
  assert.equal(calls.length,1); assert.equal(calls[0].signal.aborted,false);
  assert.equal(calls[0].headers?.Range,undefined);
});
