'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const crypto=require('node:crypto'),{createRequire}=require('node:module');
const {transform}=require('../tools/maelstrom-initialized-runner-arm.cjs');
const {transformLoader}=require('../tools/maelstrom-loader-boundary.cjs');
const {host}=require('./maelstrom-loader-host-fixture.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const [ops,donor,review]=process.argv.slice(2);assert(ops&&donor&&review);
const captured=fs.readFileSync(donor+'/ops/capture-run.js'),loaderInput=fs.readFileSync(ops+'/loader-original.js');
const runner=transform(captured),loader=transformLoader(loaderInput),source=runner.output.toString();
const boundary='  for (let batch = 0; batch < MAX_BATCHES && !stopped; batch++) {\n';
const setup=source.slice(source.indexOf('  let startupDllStage;'),source.indexOf(boundary));
const fixturePath=donor+'/repo/test/test-maelstrom-mode-transition.cjs',fixtureText=fs.readFileSync(fixturePath,'utf8');
assert.equal(sha(fixtureText),'57758fa0a9b6d769fce63d873a2ebf7aca3fb62f18f1c7298d5e309054384491');
const fc={require:createRequire(fixturePath),__dirname:path.dirname(fixturePath),module:{exports:{}},Buffer,WebAssembly,console,process};
vm.runInNewContext(fixtureText.slice(0,fixtureText.indexOf("test('authentic early-start ordering"))+'\nmodule.exports={fresh,finish,createAdapter,createRunnerExperiments};',fc,{timeout:30000});
const f=fc.module.exports,actualRequire=createRequire(donor+'/repo/test/fixture.cjs');
const diagnostic=actualRequire('../tools/maelstrom-original-errno-adapter.cjs');
const files={exe:fs.readFileSync(ops+'/Maelstrom.exe'),crt:fs.readFileSync(ops+'/msvcrt.dll'),sdl:fs.readFileSync(ops+'/SDL.dll'),net:fs.readFileSync(ops+'/SDL_net.dll')};
const pins=actualRequire('../tools/maelstrom-native-errno-latch.cjs').BINARY_PINS;
for(const n of ['exe','crt','net'])assert.equal(sha(files[n]),pins[n]);
function harness({fail=null,noDll=false}={}) {
  const real=f.fresh(),events=[],rows=[],cleanups=[];let armed=false,starts=0;
  const low=host({real,events,files,fail,isArmed:()=>armed});
  low.exports.finish_dll_unload_locked=(i)=>{new DataView(low.memory.buffer).setUint32(0x2000+i*64,0,true);return 1;};
  const target=low.exports;
  target.set_uop=n=>{assert(!armed);events.push('mode:'+n);if(fail==='mode')throw Error('fixture:mode');real.exports.set_uop(n);};
  const ex=new Proxy(target,{get(t,n){if(n in t)return t[n];if(typeof n==='string'&&n.startsWith('set_'))return ()=>{assert(!armed);events.push(n);if(fail===n)throw Error('fixture:'+n);};}});
  const lc=vm.createContext({module:{exports:{}},Buffer,console:{log(){}},require:n=>{assert.equal(n,'./mem-utils');return low.memUtils;}});
  vm.runInContext(loader.output.toString(),lc,{timeout:2000});
  const api=lc.module.exports,globals={};
  for(const name of setup.match(/\b[A-Z][A-Z_0-9]+\b/g)||[])globals[name]=false;
  Object.assign(globals,{instance:{exports:ex},memory:low.memory,Buffer,JSON,path,console:{log(){}},
    dlls:noDll?[]:[{name:'msvcrt.dll',bytes:files.crt},{name:'SDL.dll',bytes:files.sdl},{name:'SDL_net.dll',bytes:files.net}],
    exeBytes:files.exe,EXE_PATH:'Maelstrom.exe',EXTRA_ARGS:'',moduleBases:{},ctx:{vfs:null},
    stageDlls:api.stageDlls,callDllMain:api.callDllMain,
    onLoadLibraryYield:()=>{if(fail==='async-lookup')return Promise.resolve(true);if(fail==='sync-lookup')throw Error('fixture:lookup');throw Error('unexpected lookup');},
    mountLoadedDllFiles(){},threadManager:{setLoadedDlls:r=>events.push('registered:'+r.length)},
    getArg:(n,d=null)=>n==='original-native-record'?'fixture':d,fs:{appendFileSync:(p,text)=>rows.push(JSON.parse(text))},
    require:n=>{
      if(n==='../lib/dib')return {extractBitmapBytes:()=>({})}; // Resource decoding is a host seam.
      if(n==='../tools/maelstrom-original-errno-adapter.cjs')return {
        verifyLoaded:(...args)=>{events.push('verify');if(fail==='verify')new Uint8Array(low.memory.buffer)[low.wa(0x52e430)]^=1;
          // No-DLL uses a small independent stage test below. This full runner
          // must keep real validation and reject missing required modules.
          return diagnostic.verifyLoaded(...args);},
        createAdapter:(i,o)=>{const a=f.createAdapter(i,{...o,persist:r=>rows.push(r)});return {
          start(){events.push('arm');starts++;if(fail==='arm')throw Error('fixture:arm');a.start();armed=true;},observe:a.observe};},
      };
      if(n==='../tools/maelstrom-native-errno-latch.cjs')return actualRequire(n);
      if(n==='../tools/disasm')return {disasmAt(){throw Error('unexpected disassembly');}};
      throw Error('unexpected require:'+n);
    },
    WATCH_VALUE:null,WATCH_START_BATCH:0,HANDLER_HIST_THREADS:[],hasFlag:()=>false,signalExitWake:null,
    onFailure:fn=>{cleanups.push(fn);events.push('failure-hook');},
    deferredResolveAddrs:()=>events.push('resolve'),performance:{now:()=>{if(fail==='clock')throw Error('fixture:clock');return 1;}},
    experiments:f.createRunnerExperiments({hasFlag:()=>false,getArg:(n,d=null)=>d,env:{},log(){},appPolicy:()=>null}),
    apiLogOff:true,TRACE_CODE_WRITES:true,TRACE_CODE_WRITES_ALL:true});
  const context=vm.createContext(globals);
  return {events,rows,low,api,ex,context,real,get starts(){return starts;},
    async execute(){try{return await vm.runInContext('(async()=>{'+setup+'\nreturn {stage:startupDllStage,observe:originalNativeObserve};})()',context,{timeout:3000});}
      catch(error){for(const cleanup of cleanups.reverse()){try{await cleanup();}catch(e){events.push('cleanup:'+e.message);}}throw error;}}};
}
const results=[];
async function test(name,fn){if(process.argv[5]&&!new RegExp(process.argv[5]).test(name))return;await fn();results.push({name,pass:true});}
async function main(){
 await test('unchanged original global ordering reproducer remains rejecting',()=>{
   const p=review+'/global-order-reproducer.cjs';assert.equal(sha(fs.readFileSync(p)),'0b9b4be5e0a8a1ff0b69140ea13e01ea3ce402a2dcabc36a986488682cd95808');
   const r=require(p);assert.equal(r.reproduce()[0].armed,false);assert(!r.reproduce({validationFails:true}).some(e=>e.event==='arm'));
 });
 await test('deterministic derivatives and missing/duplicate/wrong boundaries reject',()=>{
   for(const [fn,b] of [[transform,captured],[transformLoader,loaderInput]]) {
     assert(fn(b).output.equals(fn(b).output));
     for(const bad of [Buffer.alloc(0),b.subarray(0,-1),Buffer.concat([b,b]),fn(b).output,Buffer.from(b.toString().replace('loadDlls','wrongBoundary'))])assert.throws(()=>fn(bad),/SHA-256 mismatch/);
   }
   new vm.Script(source);new vm.Script(loader.output.toString());
   assert.equal((source.match(/nativeAdapter\.start\(\);/g)||[]).length,1);
   assert(source.indexOf('nativeAdapter.start();')<source.indexOf('startupDllStage.initialize();'));
   // All unchanged initializer bytes, including nested calls and error handling,
   // survive exactly, except the single new yield before the original loop.
   const original=loaderInput.toString(),start=original.indexOf('  for (const r of orderDllInitializers'),end=original.indexOf('\n  return results;',start);
   assert(loader.output.toString().includes(original.slice(start,end)));
 });
 await test('real pinned PE mapping/relocations/anchor validation, setup, one arm, then every DLL call',async()=>{
   const h=harness(),eip=h.low.eip,esp=h.low.esp;const r=await h.execute();
   assert.equal(h.starts,1);assert.equal(h.ex.get_uop(),1);assert.equal(h.ex.mne_rejectReason(),0);
   const first=h.events.findIndex(e=>e.startsWith('dll-run:')),arm=h.events.indexOf('arm');assert(first>arm);
   assert(h.events.indexOf('verify')<h.events.indexOf('mode:1'));assert(h.events.indexOf('mode:1')<arm);
   assert(h.events.indexOf('set_code_write_trace')<arm);
   assert.equal(h.events.filter(e=>e.startsWith('dll-run:')).length,3);
   assert.equal(h.low.eip,eip);assert.equal(h.low.esp,esp);assert.equal(h.ex.get_eax(),7);
   assert.deepEqual([...h.low.callbackWords],[0,0]);assert.throws(()=>r.stage.initialize(),/already consumed/);
   assert(h.rows.some(r=>r.stage==='loaded-verified'&&r.verified.authenticLoadedAnchors));
   assert(h.events.indexOf('seal')>first);
 });
 for(const fail of ['mapping','verify','mode','set_code_write_trace','clock','arm'])await test(fail+' failure executes zero guest and releases gate',async()=>{
   const h=harness({fail});await assert.rejects(h.execute());assert(!h.events.some(e=>e.startsWith('dll-run:')));assert.deepEqual([...h.low.callbackWords],[0,0]);assert.equal(h.starts,fail==='arm'?1:0);
 });
 await test('missing DLL path preserves genuine validation rejection without arming',async()=>{
   const h=harness({noDll:true});await assert.rejects(h.execute(),/incompatible original loaded bases/);assert.equal(h.starts,0);assert(!h.events.some(e=>e.startsWith('dll-run:')));
 });
 for(const fail of ['initializer','async-lookup','sync-lookup'])await test(fail+' initializer failure propagates with callback gate release',async()=>{
   const h=harness({fail});await assert.rejects(h.execute(),error=>{
     assert.match(error.message,/DLL initializer did not return/);
     assert.match(error.cause.message,fail==='async-lookup'?/Asynchronous DLL lookup requires callDllMainAsync/:fail==='sync-lookup'?/fixture:lookup/:/fixture:initializer/);
     return true;
   });assert.equal(h.starts,1);assert.deepEqual([...h.low.callbackWords],[0,0]);
 });
 await test('no-DLL staged API completes once, preserving sealing',()=>{
   const h=harness();const s=h.api.stageDlls(h.ex,h.low.memory.buffer,files.exe,[],null,{});
   assert.equal(s.results.length,0);assert.equal(s.initialize().length,0);assert.deepEqual([...h.low.callbackWords],[0,0]);assert.throws(()=>s.initialize(),/already consumed/);
 });
 const sites=[source.match(/if \(!mainExecutionSuspended\(\)\) \{ instance\.exports\.run\(BATCH_SIZE\); originalNativeObserve\(batch\); \}/)[0],
   ...[...source.matchAll(/let originalNativeReturned=false;\n\s+try \{ instance\.exports\.run\(BATCH_SIZE\); originalNativeReturned=true; \} catch \(e\) \{[^}]*\}\n\s+if\(originalNativeReturned\) originalNativeObserve\(batch\);/g)].map(m=>m[0])];assert.equal(sites.length,3);
 for(let i=0;i<3;i++)await test('preserved run observation '+i+': success/throw/mode guard',async()=>{
   for(const mode of ['success','throw','drift']) {
     const h=harness(),r=await h.execute();let observations=0;
     if(mode==='drift'){h.real.exports.fixture_enter();h.real.exports.set_uop(0);assert.equal(h.ex.mne_rejectReason(),15);}else f.finish(h.real.exports);
     const run=()=>{if(mode==='throw')throw Error('run fault');h.events.push('main-run');};
     Object.assign(h.context,{instance:{exports:{...h.ex,run}},originalNativeObserve:n=>{observations++;return r.observe(n);},BATCH_SIZE:1,batch:i,mainExecutionSuspended:()=>false});
     const execute=()=>vm.runInContext('for(let once=0;once<1;once++){'+sites[i]+'}',h.context);
     if(mode==='drift')assert.throws(execute,/status rejection/);else if(mode==='throw'&&i===0)assert.throws(execute,/run fault/);else execute();
     assert.equal(observations,mode==='throw'?0:1);assert.equal(h.starts,1);
     if(mode==='success')assert(h.rows.some(r=>r.kind==='captured'));
   }
 });
 console.log(JSON.stringify({pass:true,results,runner:runner.receipt,loader:loader.receipt,fixtureSHA256:sha(fixtureText),
   sourceSHA256:sha(fs.readFileSync(__filename)),hostFixtureSHA256:sha(fs.readFileSync(__dirname+'/maelstrom-loader-host-fixture.cjs')),
   qualification:'Full archived JS loader-derived startup and complete pinned runner setup. Real pinned PE sections/relocations/import resolution and genuine verifyLoaded; WASM load_dll and guest run are explicit offline JS mocks. Small existing guard fixture only; no native guest execution.',rss:process.memoryUsage().rss}));
}
module.exports={harness,files,runner,loader,source,setup,f,sha};
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
