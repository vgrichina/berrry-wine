'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {createRequire}=require('node:module');
const {VirtualFS}=require('../lib/filesystem'),byteProvider=require('../lib/byte-provider');
const source=fs.readFileSync(path.join(__dirname,'../host.js'),'utf8');
function fixture(fetch){const context={console,URL,URLSearchParams,Uint8Array,AbortController,setTimeout,clearTimeout,fetch};vm.runInNewContext(source+'\n;globalThis.WineAssembly=WineAssembly;',context);context.window={byteProvider};const wine=Object.create(context.WineAssembly.prototype);wine._helpCtx={vfs:new VirtualFS()};return{wine,vfs:wine._helpCtx.vfs};}
function response(size=200000){return async(_url,init={})=>{assert(!init.headers?.Range,'no HTTP Range');assert(!init.method,'no HEAD');return{status:200,arrayBuffer:async()=>Uint8Array.from({length:size},(_,i)=>i%251).buffer};};}

test('6000 known-size files mount with zero requests; actual VFS read downloads the touched file',async()=>{
 let calls=0;const fetch=response(),{wine,vfs}=fixture((...args)=>{calls++;return fetch(...args);});
 await wine.loadFiles(Array.from({length:6000},(_,i)=>({url:`asset${i}`,vfsPath:`c:\\data\\${i}`,size:200000,loadMode:'lazy'})),{required:true});assert.equal(calls,0);assert.equal(vfs.files.size,6000);
 const h=vfs.createFile('c:\\data\\42',0x80000000,3),buf=new Uint8Array(8),pending=vfs.readFile(h,buf,8);assert(pending.pending);await vfs.fillPendingRead(pending.pending);const read=vfs.readFile(h,buf,8);assert.equal(read.bytesRead,8);assert.deepEqual([...buf],[0,1,2,3,4,5,6,7]);assert.equal(calls,1);
});
test('aliases share one complete download',async()=>{
 // 1MB chunks (lib/byte-provider.js): a 5MB file, read in its second chunk.
 const calls=[],fetch=response(5000000),{wine,vfs}=fixture((u,i)=>{calls.push(i.headers?.Range);return fetch(u,i);});await wine.loadFiles([{url:'x',size:5000000,loadMode:'lazy',vfsPaths:['c:\\x','d:\\x']}]);const a=vfs.files.get('c:\\x')._provider,b=vfs.files.get('d:\\x')._provider;assert.equal(a,b);await a.fill(1500000,4);assert.deepEqual(calls,[undefined]);assert.equal(a.gameData,true);
});
test('invalid modes, sizes, contradictory aliases and synchronous decode fail without I/O',async()=>{
 let calls=0;const{wine}=fixture(async()=>{calls++;throw Error('network');});for(const item of [{size:-1,loadMode:'lazy'},{size:1.2,loadMode:'lazy'},{size:4,loadMode:'magic'},{size:4,loadMode:'required',optional:true},{size:4,loadMode:'lazy',decodeImage:true}])await assert.rejects(wine.loadFiles([{url:'x',...item}]));await assert.rejects(wine.loadFiles([{url:'x',size:4,loadMode:'lazy'},{url:'x',size:5,loadMode:'lazy'}]));assert.equal(calls,0);
});
test('required bytes are awaited; lazy error fails honestly and can retry',async()=>{
 let status=503,calls=0;const{wine,vfs}=fixture(async(_u,init)=>{calls++;return{ok:true,status: _u==='lazy'?status:200,headers:{get:n=>n==='content-range'?'bytes 0-3/4':null},arrayBuffer:async()=>Uint8Array.of(1,2,3,4).buffer};});await wine.loadFiles([{url:'required',size:4,loadMode:'required',httpRange:true}],{required:true});assert.equal(calls,1);assert.deepEqual([...vfs.files.get('c:\\required').data],[1,2,3,4]);await wine.loadFiles([{url:'lazy',size:4,loadMode:'lazy'}]);const cache=vfs.files.get('c:\\lazy')._provider;await assert.rejects(cache.fill(0,4),/503/);status=200;await cache.fill(0,4);assert.deepEqual([...cache.tryRead(0,4)],[1,2,3,4]);
});
test('background is explicit, bounded to eight prefixes, and abort leaves future guest reads separate from launch signal',async()=>{
 let calls=0;const fetch=response(),{wine,vfs}=fixture((...args)=>{calls++;return fetch(...args);});const launch=new AbortController();await wine.loadFiles(Array.from({length:20},(_,i)=>({url:`b${i}`,size:200000,loadMode:'background'})),{transfer:{signal:launch.signal}});assert.equal(calls,0);launch.abort();const state=await wine.startBackgroundAssets();assert.equal(state.completed,8);assert.equal(state.deferred,12);assert.equal(calls,8);await vfs.files.get('c:\\b19')._provider.fill(0,1);assert.equal(calls,9);
 const other=fixture(async()=>{throw Error('should not start');});await other.wine.loadFiles([{url:'x',size:200000,loadMode:'background'}]);other.wine._manifestAssetAbort.abort();assert.equal((await other.wine.startBackgroundAssets()).cancelled,true);
});
test('background failure is retained without rejecting startup or suppressing later retries',async()=>{
 let fail=true;const real=response(),{wine,vfs}=fixture((...args)=>fail?Promise.reject(Error('offline')):real(...args));await wine.loadFiles([{url:'x',size:200000,loadMode:'background'}]);const state=await wine.startBackgroundAssets();assert.equal(state.failed.length,1);fail=false;await vfs.files.get('c:\\x')._provider.fill(0,1);
});
test('actual preparation emits stat sizes and lazy data but keeps native modules/fonts required',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'wa-manifest-'));try{fs.mkdirSync(root+'/game');for(const n of ['game.exe','SDL.dll','font.ttf','data.bin'])fs.writeFileSync(root+'/game/'+n,Buffer.alloc(n.length));let script=fs.readFileSync(path.join(__dirname,'../tools/fetch-candidate-corpus.js'),'utf8');script=script.slice(0,script.indexOf('\n(async () => {'))+'\n;globalThis.prepareManifest=writeBrowserManifest;';const ctx={require:createRequire(path.join(__dirname,'../tools/fetch-candidate-corpus.js')),__dirname:path.join(__dirname,'../tools'),process:{argv:[]},console};vm.runInNewContext(script,ctx);ctx.prepareManifest({id:'test',browser:{fileRoot:'game',exe:'game/game.exe',defaultLoadMode:'lazy',fileLoadModes:{'data.bin':'background'}}},root);const files=JSON.parse(fs.readFileSync(root+'/.wine-assembly-browser.json')).files;assert.equal(files.length,3);assert.equal(files.find(f=>f.url.endsWith('SDL.dll')).loadMode,'required');assert.equal(files.find(f=>f.url.endsWith('font.ttf')).loadMode,'required');const data=files.find(f=>f.url.endsWith('data.bin'));assert.equal(data.loadMode,'background');assert.equal(data.size,8);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('actual stop aborts a pending background fetch and prevents subsequent jobs',async()=>{
 let enter;const entered=new Promise(r=>enter=r);let calls=0;
 const{wine}=fixture((_url,init)=>{calls++;enter();return new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Object.assign(Error('stop'),{name:'AbortError'})),{once:true}));});
 await wine.loadFiles([{url:'a',size:100000,loadMode:'background'},{url:'b',size:100000,loadMode:'background'}]);
 // Keep stop's actual asset lifecycle and stub unrelated UI/scheduler teardown.
 for(const name of ['_cancelPresentFrame','_cancelDelayedStep','_cancelVblankWait','_frozenUnregister','_removeVisibilityPause','_removeInputWake','_stopAudioIdleWatch','_stopPerfCounterPoll','_cleanupAudio'])wine[name]=()=>{};
 const running=wine.startBackgroundAssets();await entered;wine.stop({repaint:false});const state=await running;assert.equal(state.cancelled,true);assert.equal(calls,1);
});
test('explicit required failure rejects even when legacy requiredFiles is absent; pre-abort mounts nothing',async()=>{
 const{wine,vfs}=fixture(async()=>({ok:false,status:404}));await assert.rejects(wine.loadFiles([{url:'native.dll',size:4,loadMode:'required'}]),/failed to load/);const controller=new AbortController();controller.abort();await assert.rejects(wine.loadFiles([{url:'x',size:4,loadMode:'lazy'}],{transfer:{signal:controller.signal}}),{name:'AbortError'});assert.equal(vfs.files.size,0);
});
test('known-size first read rejects partial bodies or stale decoded size without HEAD',async()=>{
 let status=206,length=4,calls=0;const{wine,vfs}=fixture(async()=>{calls++;return{status,arrayBuffer:async()=>new Uint8Array(length).buffer};});await wine.loadFiles([{url:'x',size:4,loadMode:'lazy'}]);assert.equal(calls,0);const cache=vfs.files.get('c:\\x')._provider;await assert.rejects(cache.fill(0,4),/206/);status=200;length=8;await assert.rejects(cache.fill(0,4),/8 decoded bytes, expected 4/);length=4;await cache.fill(0,4);assert.equal(cache.tryRead(0,4).length,4);
});
test('reload after stop has a new background lifetime; old providers retain aborted signals',async()=>{
 const signals=[],real=response(5000000);const{wine,vfs}=fixture((u,i)=>{signals.push(i.signal);if(i.signal.aborted)return Promise.reject(Object.assign(Error('aborted'),{name:'AbortError'}));return real(u,i);});
 await wine.loadFiles([{url:'old',size:5000000,loadMode:'background'}]);await wine.startBackgroundAssets();const old=vfs.files.get('c:\\old')._provider;wine._manifestAssetAbort.abort();
 await wine.loadFiles([{url:'new',size:5000000,loadMode:'background'}]);await wine.startBackgroundAssets();assert.equal(signals.length,2);assert.notEqual(signals[0],signals[1]);assert.equal(old.provider._downloadOptions.signal.aborted,true);assert.equal(signals[1].aborted,false);
 // A chunk the background prefix did not cover (1MB chunks: past the first).
 await old.fill(2000000,1);assert.equal(signals.length,2,'resident whole bytes need no request after abort');assert.equal(wine.backgroundAssets.completed,1);
});
