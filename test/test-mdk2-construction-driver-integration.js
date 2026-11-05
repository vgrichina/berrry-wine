'use strict';
// Actual retained-driver composition and bounded trace in the shipped Worker.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const cp = require('node:child_process');
const integration = require('../tools/mdk2-construction-driver-integration.cjs');
const {Worker, MessageChannel, isMainThread, parentPort, workerData} = require('node:worker_threads');
const EVIDENCE = process.env.MDK2_TEST_EVIDENCE || fs.mkdtempSync(path.join(integration.RUNS, 'mdk2-construction-driver-test-'));
assert.equal(path.dirname(EVIDENCE), integration.RUNS, 'direct owned test evidence run required');
fs.mkdirSync(EVIDENCE, {recursive: true});

function actualDriver(candidate = integration) {
  const run = fs.mkdtempSync(path.join(EVIDENCE, 'protocol-'));
  const {file, source} = candidate.compose(run);
  const end = source.indexOf('main().catch(');
  assert(end > 0); assert.equal(source.split('main().catch(').length, 2);
  const m = new Module(file, module); m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  const nativeRequire = m.require.bind(m);
  m.require = name => name === require.resolve('../tools/mdk2-construction-driver-integration.cjs') ? candidate : nativeRequire(name);
  // Export the actual functions before the sole bootstrap invocation. No
  // implementation substitution, new observer, or guest runtime is involved.
  m._compile(source.slice(0, end) + `module.exports={RUN,OUT,preload,command,main,inspectionGuard,
    traceDriver, pageForTest(p){page=p},deadlineForTest(d){deadline=d},sessions,haltForTest(){halted=true}};`, file);
  const api = m.exports;
  fs.mkdirSync(api.OUT); fs.mkdirSync(path.join(api.OUT, 'commands'));
  fs.writeFileSync(path.join(api.OUT, 'identity.json'), JSON.stringify({testOnly: 'offline protocol fixture'}));
  return {api, source, run};
}
function write(out, file, value) {fs.writeFileSync(path.join(out, file), JSON.stringify(value));}
function review(api) {
  const png = Buffer.from('OFFLINE PROTOCOL FIXTURE: no game pixels');
  const shot = {sha256: integration.sha(png), state: {main: {frozen: {steps: 3344}}}};
  fs.writeFileSync(path.join(api.OUT, 'construction.png'), png);
  write(api.OUT, 'commands/0.json', {action: 'shot', name: 'construction'});
  write(api.OUT, 'reply-0.json', {i: 0, ok: true});
  api.inspectionGuard.capture('construction', shot, 0);
  const {approve} = require(path.join(integration.RUNS, '20261104-mdk2-fresh-pending-scene/inspection-guard.cjs'));
  approve(api.OUT, {capture: 'construction', sha256: shot.sha256, steps: 3344,
    personallyInspected: true, inspector: 'offline protocol fixture only'});
}

if (isMainThread) {
fs.writeFileSync(path.join(EVIDENCE,'ownership-negatives.jsonl'),'');
// Real pinned production classes, without starting a Worker or guest. Only the
// transport response is a fixture; wrapper/WorkerLink.readExports are executed.
function ownershipFixture() {
  const cache = new Map(), pins = new Map(integration.pinnedRuntime().pins.files.map(r => [r.path,r]));
  function load(name) {
    if (cache.has(name)) return cache.get(name).exports;
    const bytes = integration.gitFile(integration.SOURCE,name), pin = pins.get(name);
    assert(pin); assert.equal(integration.sha(bytes),pin.sha256);
    const filename=path.join(integration.ROOT,name), m=new Module(filename,module); cache.set(name,m);
    m.filename=filename; m.paths=Module._nodeModulePaths(path.dirname(filename));
    const native=m.require.bind(m);
    m.require=request=>request.startsWith('.') ? load(path.relative(integration.ROOT,require.resolve(path.resolve(path.dirname(filename),request)))) : native(request);
    if(name.endsWith('.json'))m.exports=JSON.parse(bytes);else m._compile(bytes.toString(),filename);
    return m.exports;
  }
  const {GuestThreadHost,WorkerLink}=load('lib/guest-thread-host.js');
  const host=new GuestThreadHost({}), main=new WorkerLink({slot:0}), file=new WorkerLink({slot:1});
  const state={frozen:true,hosts:1,steps:3360,ticks:100,guestMs:1};
  const traffic=[];let mutate=()=>{};
  for(const [link,tid] of [[main,1],[file,2]]){
    link.worker={postMessage:message=>{
      traffic.push({slot:link.slot,...message});assert.equal(message.t,'readExports');
      assert.equal(link._pending.size,1);
      queueMicrotask(()=>{
        // Exact production exportsRead envelope. _onMessage drains the real
        // _ask queue before readExports returns its plain values object.
        const core={get_current_thread_id:tid,get_eip:0x401000,get_esp:0x7400000};
        link._onMessage({t:'exportsRead',seq:message.seq,values:Object.fromEntries(message.names.map(n=>[n,core[n]??0]))});
        mutate(link);
      });
    }};
  }
  host.link=main;host.threadLinks.set(1,file);
  const thread={link:file,inFlight:false,freeRunPending:false,importRetryPreparing:false};
  const wine={guestWorker:host,threadManager:{threads:new Map([[921600,thread]]),workerBackend:host},_frozenBudget:0};
  // Use realm-native Map for queue type checks and serialize the actual page fn.
  const realm=vm.createContext({wine,WineFrozen:{status:()=>({...state})},Map});
  const invoke=persist=>vm.runInContext('('+integration.frozenOwnership.toString()+')('+JSON.stringify(persist)+')',realm);
  return {host,main,file,thread,wine,state,traffic,invoke,realm,setMutation:fn=>{mutate=fn;}};
}
test('actual pinned wrapper reproduces accepted rejection; repaired barrier preserves main+file identities',async()=>{
  const f=ownershipFixture();
  const values=await f.host.readExports(['get_current_thread_id','get_eip','get_esp']);
  assert.equal(values.get_current_thread_id,1);assert.equal(f.host.slot,undefined);
  const original=integration.gitFile('6d5121b5f96ee6032a9e347e2db64db29c478518','tools/mdk2-construction-driver-integration.cjs').toString();
  const fn=original.slice(original.indexOf('async function frozenOwnership()'),original.indexOf('\nfunction correlateSnapshots'));
  await assert.rejects(vm.runInContext('('+fn+')()',f.realm),/foreign main ownership/);
  const result=JSON.parse(JSON.stringify(await f.invoke(false)));
  assert.deepEqual(result.owners.map(r=>[r.handle,r.slot,r.endpointIdentity,r.values.get_current_thread_id]),[[null,0,1,1],[921600,1,2,2]]);
  assert.deepEqual(result.frozen,f.state);assert(f.traffic.every(r=>r.t==='readExports'));
  f.wine.memory={buffer:new ArrayBuffer(16384)};
  f.wine._guestToWasmAddress=address=>{
    if(address>=0x7400000&&address<0x7401000)return address-0x7400000+0x1000;
    if(address===0x4b7ce4)return 0x2000;if(address===0x4b87d4)return 0x2004;
    throw Error('unexpected passive fixture address');
  };
  const {mainState}=require(path.join(integration.RUNS,integration.MAIN));
  const {ownerState}=require(path.join(integration.RUNS,'20261104-mdk2-explicit-capture-native-onward/read-only.cjs'));
  const mainSidecar=await vm.runInContext('('+mainState.toString()+')()',f.realm);
  const fileSidecar=await vm.runInContext('('+ownerState.toString()+')()',f.realm);
  assert.equal(mainSidecar.values.get_current_thread_id,1);assert.equal(fileSidecar.values.get_current_thread_id,2);
  assert.equal(mainSidecar.values.get_eip,result.owners[0].values.get_eip);
  assert.equal(fileSidecar.values.get_eip,result.owners[1].values.get_eip);
  fs.writeFileSync(path.join(EVIDENCE,'offline-wrapper-contract.json'),JSON.stringify({
    source:integration.SOURCE,actualClasses:['GuestThreadHost','WorkerLink'],transport:'offline exportsRead fixture; real _ask/_onMessage/readExports',
    historicalRejection:'foreign main ownership',wrapperSlot:f.host.slot??null,wrapperEndpoint:f.host.endpointIdentity??null,wrapperValues:values,repaired:result},null,2));
});
for(const mode of ['foreign-slot','foreign-endpoint','foreign-thread','malformed','local-main','pending-main','pending-file','starting-main','starting-file','inflight','free-run','import-retry','stopped',
 'changed-tick','changed-tick-ms','changed-status-field','changed-step','changed-time','changed-hosts','thawed','budget','replaced-wrapper','replaced-link','replaced-manager','replaced-backend','replaced-table','replaced-thread','replaced-file','replaced-worker','changed-endpoint','changed-slot','new-queue','queued-after','starting-after','inflight-after','added-thread','duplicate-link']) {
 test('executable all-Worker ownership fence rejects '+mode,async()=>{
  const f=ownershipFixture();
  const initial={
   'foreign-slot':()=>{f.main.slot=3;},'foreign-endpoint':()=>{f.main.endpointIdentity=3;},
   'foreign-thread':()=>{f.main._ask=async()=>({values:{get_current_thread_id:2,get_eip:1,get_esp:1}});},
   malformed:()=>{f.main._ask=async()=>({values:{get_current_thread_id:1,get_eip:null,get_esp:1}});},
   'local-main':()=>{f.host.localMainExports=()=>({});},'pending-main':()=>f.main._pending.set(9,{}),'pending-file':()=>f.file._pending.set(9,{}),
   'starting-main':()=>{f.wine._guestWorkerStarting={};},'starting-file':()=>f.host._startingLinks.add({}),inflight:()=>{f.thread.inFlight=true;},
   'free-run':()=>{f.thread.freeRunPending=true;},'import-retry':()=>{f.thread.importRetryPreparing=true;},stopped:()=>{f.main._stopped=true;},
   'duplicate-link':()=>{f.thread.link=f.main;}
  };
  if(initial[mode])initial[mode]();else f.setMutation(link=>{
   if(link!==f.file)return;
   switch(mode){
    case 'changed-tick':f.state.ticks++;break;case 'changed-step':f.state.steps++;break;case 'changed-time':f.state.guestMs++;break;
    case 'changed-tick-ms':f.state.tickMs=5;break;case 'changed-status-field':f.state.extra='changed';break;
    case 'changed-hosts':f.state.hosts++;break;case 'thawed':f.state.frozen=false;break;case 'budget':f.wine._frozenBudget=16;break;
    case 'replaced-wrapper':f.wine.guestWorker={...f.host};break;case 'replaced-link':f.host.link={...f.main};break;
    case 'replaced-manager':f.wine.threadManager={...f.wine.threadManager};break;case 'replaced-table':f.wine.threadManager.threads=new Map(f.wine.threadManager.threads);break;
    case 'replaced-backend':f.wine.threadManager.workerBackend={...f.host};break;
    case 'replaced-thread':f.wine.threadManager.threads.set(921600,{...f.thread});break;case 'replaced-file':f.thread.link={...f.file};break;
    case 'replaced-worker':f.main.worker={};break;case 'changed-endpoint':f.main.endpointIdentity++;break;case 'changed-slot':f.main.slot++;break;
    case 'new-queue':f.main._pending=new Map();break;case 'queued-after':f.main._pending.set(9,{});break;
    case 'starting-after':f.host._startingLinks.add({});break;case 'inflight-after':f.thread.inFlight=true;break;
    case 'added-thread':f.wine.threadManager.threads.set(7,{});break;default:throw Error(mode);
   }
  });
  const result=await f.invoke(true);assert(result.rejection,mode);
  fs.appendFileSync(path.join(EVIDENCE,'ownership-negatives.jsonl'),JSON.stringify({mode,...result})+'\n');
  assert.equal(typeof result.rejection.reason,'string');assert(Array.isArray(result.rejection.owners));
  if(mode==='foreign-thread'){assert.equal(result.rejection.owners[0].values.get_current_thread_id,2);}
  assert(f.traffic.every(r=>r.t==='readExports'),'no guest work or scheduling');
 });
}
test('candidate resolver explicitly checks both immutable historical resolver and recorded new entry',async()=>{
 const hash=integration.sha(fs.readFileSync(require.resolve('../tools/mdk2-construction-driver-integration.cjs')));
 const {adapter,provenance}=integration.candidateResolver(hash);
 assert.equal(typeof adapter.installAdapter,'function');assert.equal(provenance.candidateSHA256,hash);
 assert.equal(provenance.historicalAccepted,'6d5121b5f96ee6032a9e347e2db64db29c478518');
 assert.throws(()=>integration.candidateResolver('0'.repeat(64)),/changed recorded driver candidate/);
 assert.throws(()=>adapter.createResolver({binding:'historical'}),/actual entry requires current binding/);
 const historical=require('../tools/mdk2-immutable-runtime-resolver.cjs').createResolver({binding:'historical'});
 await assert.rejects(adapter.installAdapter(historical),/complete current source\/module pair/);
});
test('quiet candidate manifest amends only the exact historical bridge',()=>{
 const original=integration.pinnedRuntime();
 const manifest=JSON.parse(integration.quietManifest(require('zlib').gunzipSync(fs.readFileSync(path.join(integration.RUNS,'20261104-mdk2-fresh-pending-scene/runtime-pins.json.gz')))));
 const differences=manifest.files.filter((row,i)=>JSON.stringify(row)!==JSON.stringify(original.pins.files[i]));
 assert.deepEqual(differences.map(r=>r.path),['lib/guest-rpc.js']);
 assert.deepEqual(manifest.moduleFiles,original.pins.moduleFiles);
 assert.equal(differences[0].sha256,integration.QUIET_BRIDGE.sha256);
 assert.throws(()=>integration.quietRuntimeBytes('lib/guest-rpc.js',Buffer.from(original.files['lib/guest-rpc.js']+' ')),/exact 1329 bridge/);
 assert.deepEqual(manifest.amendments[0].source,integration.SOURCE);
});
test('explicit candidate adapter executes actual 432 filesystem and HTTP checks in dedicated process',()=>{
 const code=`const fs=require('node:fs'),i=require('./tools/mdk2-construction-driver-integration.cjs');
 (async()=>{const h=i.sha(fs.readFileSync(require.resolve('./tools/mdk2-construction-driver-integration.cjs')));
 const {adapter,provenance}=i.candidateResolver(h);const runtime=await adapter.installAdapter(adapter.createResolver());
 try{console.log(JSON.stringify({filesystem:runtime.filesystem.length,http:runtime.http.length,provenance}));}finally{runtime.restore();}
 })().catch(e=>{console.error(e.stack);process.exitCode=1});`;
 const result=cp.spawnSync(process.execPath,['-e',code],{cwd:integration.ROOT,encoding:'utf8',timeout:60000});
 assert.equal(result.status,0,result.stderr);const report=JSON.parse(result.stdout);
 assert.equal(report.filesystem,439);assert.equal(report.http,439);
 fs.writeFileSync(path.join(EVIDENCE,'offline-candidate-adapter.json'),JSON.stringify(report,null,2));
});
test('exact retained closure and historical runtime pins resolve offline', () => {
  const rows = integration.verifyClosure(); assert.equal(rows.length, Object.keys({...integration.CLOSURE,...integration.HELPERS}).length);
  const runtime = integration.pinnedRuntime(); assert.equal(runtime.pins.files.length, 432);
  assert.equal(runtime.pins.moduleFiles[0].sha256, 'cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee');
});

test('causal closure negatives reject missing dependency and same-length altered actual driver before composition', () => {
  const read = name => fs.readFileSync(path.join(integration.RUNS, name));
  assert.throws(() => integration.verifyClosure(name => {
    if (name === integration.DRIVER) throw Error('fixture: missing actual driver');
    return read(name);
  }), /missing actual driver/);
  assert.throws(() => integration.verifyClosure(name => {
    const bytes = read(name);
    if (name === integration.DRIVER) bytes[0] ^= 1;
    return bytes;
  }), /retained closure mismatch/);
});

test('positive actual composition compiles main/state/command/preload without invoking bootstrap', () => {
  const {api, source, run} = actualDriver();
  assert.equal(api.RUN, run); assert.equal(api.OUT, path.join(run, 'browser'));
  assert.equal(typeof api.main, 'function'); assert.equal(typeof api.command, 'function');
  assert.equal(api.preload, integration.preloadSource());
  const original = require(path.join(integration.RUNS, integration.MAIN)).sourceForRun(run);
  assert.notEqual(source, original);
  assert(source.includes('integration.createTraceDriver'));
  assert(source.includes("await traceDriver.finish('terminal-cleanup')"));
  assert(!fs.existsSync(path.join(api.OUT, 'bootstrap-failure.json')));
});

test('actual driver admits exactly the reviewed 16-slice command and forwards its result', async () => {
  const {api} = actualDriver(), calls = [];
  review(api);
  const result = {ran: 16, timedOut: false, marker: 'offline frozen response'};
  api.pageForTest({evaluate: async (fn, n) => {calls.push({fn: fn.toString(), n}); return result;}});
  await api.command({action: 'step', n: 16}, 1);
  assert.equal(calls.length, 1); assert.equal(calls[0].n, 16);
  assert(calls[0].fn.includes('WineFrozen.step(n)'));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(api.OUT, 'step-1.json'))), result);
});

for (const failure of ['unreviewed', 'wrong-ack', 'failed-ack', 'changed-capture']) {
  test('actual driver rejects ' + failure + ' before a slice', async () => {
    const {api} = actualDriver(); let called = false;
    api.pageForTest({evaluate: async () => {called = true; throw Error('must not call');}});
    if (failure !== 'unreviewed') review(api);
    if (failure === 'wrong-ack') write(api.OUT, 'reply-0.json', {i: 9, ok: true});
    if (failure === 'failed-ack') write(api.OUT, 'reply-0.json', {i: 0, ok: false});
    if (failure === 'changed-capture') fs.appendFileSync(path.join(api.OUT, 'construction.png'), 'changed');
    await assert.rejects(api.command({action: 'step', n: 16}, 1));
    assert.equal(called, false);
  });
}

test('actual driver rejects incomplete response; terminal guard prevents later steps and input', async () => {
  const {api, source} = actualDriver(); review(api); let calls = 0;
  api.pageForTest({evaluate: async () => {calls++; return {ran: 15, timedOut: false};}});
  await assert.rejects(api.command({action: 'step', n: 16}, 1), /incomplete frozen step/);
  // main's unchanged catch performs this latch; assert its actual source too.
  assert(source.includes("catch(e){halted=true;await traceDriver.finish('first-command-failure');save('reply-'+i+'.json',{i,ok:false"));
  api.haltForTest();
  await assert.rejects(api.command({action: 'step', n: 16}, 2), /first failure preserved/);
  await assert.rejects(api.command({action: 'keydown', key: 'Enter'}, 2), /first failure preserved/);
  assert.equal(calls, 1);
});

test('actual Worker injection occurs before resume; preload exception is terminal and never resumes', async () => {
  const {source, api} = actualDriver();
  const lo = source.indexOf("cdp.on('Target.attachedToTarget'");
  const hi = source.indexOf("await cdp.send('Target.setAutoAttach'", lo);
  assert(lo > 0 && hi > lo);
  for (const fault of [false, true]) {
    const sent = [], pending = [], logs = []; let handler;
    const handlers=new Map();
    const session = {on:(name,fn)=>handlers.set(name,fn),off:name=>handlers.delete(name),send: async (name, args) => {
      sent.push(name);
      if(name==='Debugger.setInstrumentationBreakpoint')return {breakpointId:'first-script'};
      if(name==='Runtime.runIfWaitingForDebugger'){
        handlers.get('Debugger.scriptParsed')({scriptId:'original',url:'http://offline/lib/guest-worker.js'});
        handlers.get('Debugger.paused')({reason:'instrumentation',callFrames:[{callFrameId:'owning-frame',location:{scriptId:'original'}}]});
      }
      if (name === 'Debugger.evaluateOnCallFrame') {
        assert.equal(args.expression, integration.preloadSource({targetId:'owning-main',workerURL:'http://offline/lib/guest-worker.js'}));
        return fault ? {exceptionDetails: {text: 'offline preload failure'}} : {};
      }
    }};
    const context = {cdp: {on: (name, fn) => {handler = fn;}, connection: () => ({session: () => session})},
      pending, sessions: new Map(), preload: api.preload, sha: integration.sha, halted: false,
      integration,deadline:Date.now()+30000, traceDriver:{finish:async()=>{}}, log: (name, value) => logs.push({name, value})};
    vm.runInNewContext(source.slice(lo, hi), context);
    handler({sessionId: 'offline', targetInfo: {type: 'worker', targetId: 'owning-main', url:'http://offline/lib/guest-worker.js'}, waitingForDebugger: true});
    await Promise.all(pending);
    const prefix=['Runtime.enable','Debugger.enable','Debugger.setInstrumentationBreakpoint','Runtime.runIfWaitingForDebugger','Debugger.evaluateOnCallFrame'];
    assert.deepEqual(sent, fault ? prefix : [...prefix,'Debugger.removeBreakpoint','Debugger.resume','Debugger.disable']);
    assert.equal(context.halted, fault);
    assert.equal(logs[0].name, fault ? 'first-failures.jsonl' : 'worker-preloads.jsonl');
  }
});

test('concrete composed route checks offline with finite one-shot trace', () => {
  const report = integration.inspect();
  assert.equal(report.observerRepairSHA256,integration.sha(fs.readFileSync(path.join(integration.ROOT,'tools/mdk2-lua-construction-observer.cjs'))));
  assert.equal(report.status, 'offline-composition-checked');
  assert.deepEqual(report.limits, {traceMs:360000,boundaries:50000000,records:512,constructionSlices:[16,32,64],restart:false});
  assert.equal(integration.assertRunnable().composedSHA256, report.composedSHA256);
  const preload=integration.preloadSource({targetId:'offline-main',workerURL:'http://offline/lib/guest-worker.js'});
  assert(preload.includes('getEpoch: () => entry.binding'));
  assert(preload.includes("'record-byte-limit'"));
});

test('actual first-script installer rejects foreign context and deadline without executing/resuming the script',async()=>{
  for(const mode of ['foreign','deadline']){
    const handlers=new Map(),calls=[];
    const session={on:(n,f)=>handlers.set(n,f),off:n=>handlers.delete(n),send:async(n,args)=>{
      calls.push(n);
      if(n==='Debugger.setInstrumentationBreakpoint')return {breakpointId:'first'};
      if(n==='Runtime.runIfWaitingForDebugger'&&mode==='foreign'){
        handlers.get('Debugger.paused')({reason:'instrumentation',callFrames:[{callFrameId:'wrong',url:'http://foreign/worker.js'}]});
      }
    }};
    await assert.rejects(integration.installBeforeFirstScript(session,'throw Error("must not execute")','http://offline/lib/guest-worker.js',Date.now()+(mode==='deadline'?20:1000)),/foreign|deadline/);
    assert(!calls.includes('Debugger.evaluateOnCallFrame'));assert(!calls.includes('Debugger.resume'));
    assert.equal(handlers.size,0);
  }
});

test('actual CLI run entry fails before creating output or calling original main', () => {
  const future = path.join(EVIDENCE, 'must-never-allocate');
  assert(!fs.existsSync(future));
  const result = cp.spawnSync(process.execPath, [path.join(integration.ROOT, 'tools/mdk2-construction-driver-integration.cjs'), '--run', future],
    {cwd: integration.ROOT, encoding: 'utf8'});
  assert.equal(result.status, 2); assert(result.stderr.includes('runtime-release.json'));
  assert(!fs.existsSync(future));
});

test('actual CLI rejects stale or unbound releases before bootstrap/Puppeteer/HTTP',()=>{
  for(const mode of ['stale','unbound']){
    const run=fs.mkdtempSync(path.join(EVIDENCE,'release-'));
    const release={runDirectory:mode==='unbound'?'/foreign':run,assignment:'20261104-mdk2-bounded-trace-driver-repair',
      authorization:'RUNTIME RELEASE MDK2 TARGET ONWARD',shutdownOwner:'coordinator',boxId:'offline-fixture',
      expiry:'2000-01-01T00:00:00Z',closeBy:'2000-01-01T00:00:00Z',recoverBy:'2000-01-01T00:00:00Z'};
    write(run,'runtime-release.json',release);
    const result=cp.spawnSync(process.execPath,[path.join(integration.ROOT,'tools/mdk2-construction-driver-integration.cjs'),'--run',run],{encoding:'utf8'});
    assert.equal(result.status,2);assert(!fs.existsSync(path.join(run,'browser')));assert(!fs.existsSync(path.join(run,'author.py')));
  }
});

// The page realm runs the exact composed preload. Its Worker envelope is then
// structured-cloned by a real worker_thread into the shipped Worker bootstrap.
async function nativeOne(row, mode = 'success') {
  const {api} = actualDriver(), memory = new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const {port1,port2} = new MessageChannel();
  const url = 'http://offline/lib/guest-worker.js?v=pinned', targetId = 'offline-main';
  const sigs = require('../lib/host-import-sigs.generated.json').sigs;
  let brokerLogBlocks=0;
  const broker = require('../lib/guest-rpc').createMainBroker(memory,Object.fromEntries(Object.keys(sigs).map(n=>[n,()=>{if(n==='log_block'){brokerLogBlocks++;if(mode.includes('bridge-exception'))throw Error('bridge fixture exception');}return 0;}])),sigs);
  const worker = new Worker(__filename,{workerData:{mode,port:port2,wasmHash:row.sha256,url,targetId,acceptedSource:row.localReference===row.path},transferList:[port2]});
  let envelope, pendingSlice = 0; const commands=[],sliceResults=[];
  class PageWorker {
    constructor(url) { this.url=url; }
    postMessage(message) {
      envelope = message;
      if(mode==='wrong-module') message={...message,__mdk2Binding:{...message.__mdk2Binding,sha256:'0'.repeat(64)}};
      if(mode==='wrong-endpoint') message={...message,endpointIdentity:99};
      worker.postMessage(message);
    }
  }
  const realm = {document:{},location:{href:'http://offline/index.html'},URL,Worker:PageWorker,
    WebAssembly:{...WebAssembly,Module:WebAssembly.Module,compile:WebAssembly.compile,instantiate:WebAssembly.instantiate},
    ArrayBuffer,Uint8Array,crypto:require('node:crypto').webcrypto,Date,setTimeout,clearTimeout,addEventListener(){}};
  // Explicit historical fixtures retain their exact module; production's
  // default preload admits only the accepted pair.
  vm.createContext(realm); vm.runInContext(integration.preloadSource({moduleHashes:[row.sha256]}),realm);
  const module = await realm.WebAssembly.compile(integration.retainedModule(row));
  const pageWorker = new realm.Worker(url);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(Error('native integration timeout')),360000);
    const finish=async(error,value)=>{clearTimeout(timer);await worker.terminate();port1.close();error?reject(error):resolve({value,envelope,page:realm.__mdk2BoundTrace.report()});};
    worker.on('error',error=>mode.startsWith('wrong-')?finish(null,{rejected:String(error)}):finish(error));
    worker.on('message',m=>{
      if(m.t==='ready') port1.postMessage({t:'start'});
      else if(m.t==='rpc') broker.serveRpc(m.slot,m.waitEntry);
      else if(m.t==='call') broker.serveCall(m);
      else if(m.t==='calls') broker.serveCalls(m);
      else if(m.t==='fixtureSliceRequest'){const c={t:'slice',seq:++pendingSlice,steps:mode.includes('measured')?1000:1};commands.push(c);worker.postMessage(c);}
      else if(m.t==='sliceDone'){sliceResults.push(m);port1.postMessage({t:'slice',message:m});}
      else if(m.t==='fixtureFailure'||m.t==='error')finish(Error(JSON.stringify(m)));
      else if(m.pass||m.rejected)finish(null,{...m,commands,...(mode.includes('rpc-diagnosis')||mode.includes('decoder-context')?{brokerLogBlocks,sliceResults}:{})});
    });
    pageWorker.postMessage({t:'init',seq:0,module,memory,sigs,slot:0,endpointIdentity:1,
      ...(mode.includes('bridge-forward')||mode.includes('bridge-exception')?{forwardGuestLogs:true}:{})});
  });
}

// Pin validation cost: use original PE bytes and independently placed individual
// guest bytes. No assumption about affine mappings, page size, or continuity.
const PIN_COST_BASE = '36305d9c09ee1be1a4d86fa3ff9bdf2149253c64';
function pinCostObserver(previous=false) {
  if(!previous)return require('../tools/mdk2-lua-construction-observer.cjs');
  const filename=path.join(integration.ROOT,'tools/mdk2-lua-construction-observer.cjs');
  const m=new Module(filename,module);m.filename=filename;
  const bytes=integration.gitFile(PIN_COST_BASE,'tools/mdk2-lua-construction-observer.cjs');
  assert.equal(integration.sha(bytes),'dd37b5ba98bf052078bc81c72f4850f4e73caeea5b72c81698c4b0805269dfc3');
  m._compile(bytes.toString(),filename);return m.exports;
}
function pinCostFixture(api,{scattered=true,track=true,...extra}={}) {
  const media=path.join(integration.ROOT,'test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe');
  const exe=fs.readFileSync(media),pe=require('../lib/pe').readPE(media);
  assert.equal(integration.sha(exe),api.EXE_SHA256);
  const memory={buffer:new ArrayBuffer(0x200000)},b=new Uint8Array(memory.buffer),mapping=new Map(),events=[];
  let next=1024,translations=0,originalCalls=0,clock=0,ordinal=1,epoch=1,thread=1,base=0x400000,foreign=false;
  const address=a=>{if(!mapping.has(a)){mapping.set(a,scattered?(next++*8191)%b.length:a-0x400000+256);}return mapping.get(a);};
  const put=(a,bytes)=>{for(let i=0;i<bytes.length;i++)b[address(a+i)]=bytes[i];};
  // Header and instructions come from the original PE, not expected hex strings.
  for(const [a,n]of [[0x400000,4],[0x40003c,4],[0x400000+exe.readUInt32LE(0x3c),4],...api.PINS.map(p=>[p.pc,p.hex.length/2])])
    {const offset=a<0x401000?a-0x400000:pe.va2off(a);assert(offset>=0);put(a,exe.subarray(offset,offset+n));}
  const ex={memory,guest_to_wasm(a){translations++;if(track)events.push(a);const w=address(a);if(w===-1)throw Error('fixture translation failure');return w;},
    get_current_thread_id:()=>thread,get_image_base:()=>base,get_eip:()=>0x47d8f3,get_esp:()=>0x074ffc84};
  const original=function(...args){originalCalls++;return this===host&&args[2]==='tail'?37:19;};
  const host={log_block:original};
  const opts={host,getExports:()=>foreign?{...ex}:ex,getSlice:()=>({ordinal}),getEpoch:()=>epoch,
    workerSlot:0,exeSha256:api.EXE_SHA256,wasmSha256:'0'.repeat(64),deadline:30000,now:()=>clock,...extra};
  const observer=api.attach(opts);
  return {api,b,mapping,events,ex,host,observer,opts,address,put,
    set(values){({clock=clock,ordinal=ordinal,epoch=epoch,thread=thread,base=base,foreign=foreign}=values);},
    fire:()=>host.log_block.call(host,ex.get_eip(),ex.get_esp(),'tail'),
    counts:()=>({translations,originalCalls}),
    result(){return {report:structuredClone(this.observer.report),events:[...events],counts:{translations,originalCalls},memoryHash:integration.sha(b)};}};
}
test('pin cost equivalence: every byte mutation on boundary and sample, independent discontinuous mappings',()=>{
  const old=pinCostObserver(true),candidate=pinCostObserver();
  assert.deepEqual(candidate.PINS,old.PINS);assert.deepEqual(candidate.CUTS,old.CUTS);
  let cases=0;
  for(const scattered of [false,true])for(const action of ['boundary','sample']){
    const original=pinCostFixture(old,{scattered}),optimized=pinCostFixture(candidate,{scattered});
    for(const f of [original,optimized]){assert.equal(f.fire(),37);f.observer.sample();}
    assert.deepEqual(optimized.result(),original.result());
    for(const {pc,hex}of old.PINS)for(let i=0;i<hex.length/2;i++){
      const a=pc+i;
      original.events.length=optimized.events.length=0;
      for(const f of [original,optimized]){
        const saved=f.b[f.address(a)];f.b[f.address(a)]=saved^0xff;
        if(action==='sample')f.observer.sample();else assert.equal(f.fire(),37);
        assert.equal(f.observer.report.error,'original bytes changed');
        f.b[f.address(a)]=saved;
      }
      assert.deepEqual(optimized.result(),original.result());cases++;
      // A new attachment for each negative; the successful prefix proves there
      // is no remembered acceptance from a prior boundary or frozen sample.
      for(const f of [original,optimized]){
        f.observer=f.api.attach(f.opts);
        assert.equal(f.fire(),37);f.observer.sample();
      }
    }
    for(const f of [original,optimized])f.observer.finish('fixture-end');
  }
  write(EVIDENCE,'pin-cost-mutations.json',{pass:true,cases,pins:old.PINS.length,bytes:old.PINS.reduce((n,p)=>n+p.hex.length/2,0),actions:['boundary','sample'],mappings:['affine','individual-byte-scatter']});
});
test('pin cost equivalence: remapping, owner, unmapped/bounds/failure precedence and limits',()=>{
  const rows=[];
  const scenarios={
    'remapped-every-byte':f=>{for(const p of f.api.PINS)for(let i=0;i<p.hex.length/2;i++){const a=p.pc+i,w=f.address(a),v=f.b[w];f.mapping.set(a,w+1);f.b[w+1]=v;f.b[w]=v^255;}},
    'remapped-changed':f=>{const a=f.api.PINS[0].pc,w=f.address(a);f.mapping.set(a,w+1);f.b[w+1]=f.b[w]^255;},
    'wrong-thread':f=>f.set({thread:2}), 'wrong-loader':f=>f.set({base:0x500000}),
    'foreign-instance':f=>f.set({foreign:true}), 'foreign-epoch':f=>f.set({epoch:2}),
    'stale-slice':f=>f.set({ordinal:0}), 'replaced-import':f=>{f.host.log_block=()=>23;},
    'unmapped-sentinel':f=>f.mapping.set(f.api.PINS[0].pc,0xf0),
    'unmapped-end':f=>f.mapping.set(f.api.PINS[0].pc,f.b.length),
    'negative-mapping':f=>f.mapping.set(f.api.PINS[0].pc,-2),
    'translation-throws':f=>f.mapping.set(f.api.PINS[0].pc,-1),
    'mismatch-then-unmapped-same-pin':f=>{const pc=f.api.PINS[0].pc;f.b[f.address(pc)]^=255;f.mapping.set(pc+1,0xf0);},
    'mismatch-then-throw-same-pin':f=>{const pc=f.api.PINS[0].pc;f.b[f.address(pc)]^=255;f.mapping.set(pc+1,-1);},
    'mismatch-then-unmapped-next-pin':f=>{f.b[f.address(f.api.PINS[0].pc)]^=255;f.mapping.set(f.api.PINS[1].pc,0xf0);},
    'deadline':f=>f.set({clock:30000}),
    'original-import-throws':f=>{f.observer.finish();f.host.log_block=()=>{throw Error('original import failure');};f.observer=f.api.attach(f.opts);},
    'changed-pin-and-import-throws':f=>{f.observer.finish();f.host.log_block=()=>{throw Error('original import failure');};f.observer=f.api.attach(f.opts);f.b[f.address(f.api.PINS[0].pc)]^=255;},
    'invalid-native-read':f=>{f.put(0x40003c,[255,255,255,127]);},
  };
  for(const [name,mutate]of Object.entries(scenarios))for(const action of ['boundary','sample']){
    const results=[];
    for(const api of [pinCostObserver(true),pinCostObserver()]){
      const f=pinCostFixture(api);f.fire();f.observer.sample();mutate(f);
      let returned,error;try{returned=action==='sample'?f.observer.sample().status:f.fire();}catch(e){error=e.message;}
      results.push({...f.result(),returned,error});f.observer.finish();
    }
    assert.deepEqual(results[1],results[0],name+' '+action);
    if(name==='mismatch-then-unmapped-same-pin')assert.equal(results[1].report.error,'unmapped native read');
    if(name==='mismatch-then-unmapped-next-pin')assert.equal(results[1].report.error,'original bytes changed');
    if(name==='remapped-every-byte')assert.equal(results[1].report.status,'running');
    rows.push({name,action,status:results[1].report.status,error:results[1].report.error,counts:results[1].counts});
  }
  for(const limits of [{maxRecords:1},{maxRecordBytes:1},{maxBoundaries:1}]){
    const results=[];for(const api of [pinCostObserver(true),pinCostObserver()]){
      const f=pinCostFixture(api,limits);f.fire();f.observer.sample();f.fire();f.observer.sample();results.push(f.result());
    }assert.deepEqual(results[1],results[0]);rows.push({limits,status:results[1].report.status});
  }
  for(const options of [{workerSlot:1},{exeSha256:'0'.repeat(64)},{wasmSha256:'bad'},
    {maxRecords:0},{maxRecords:513},{maxRecordBytes:0},{maxRecordBytes:8193},
    {maxBoundaries:0},{maxBoundaries:50000001},{deadline:0},{deadline:360001}]){
    const errors=[];for(const api of [pinCostObserver(true),pinCostObserver()]){
      const f=pinCostFixture(api);f.observer.finish();
      assert.throws(()=>api.attach({...f.opts,...options}),e=>{errors.push(e.message);return true;});
    }assert.equal(errors[1],errors[0]);rows.push({options,error:errors[1]});
  }
  write(EVIDENCE,'pin-cost-negatives.json',{pass:true,rows});
});
test('pin cost separated observer timing and exact work counts (getter-only, no native execution)',()=>{
  const apis=[pinCostObserver(true),pinCostObserver()],rounds=[],boundaries=10000;
  for(let round=0;round<7;round++){
    const row=[];
    for(const which of round%2?[1,0]:[0,1]){
      const f=pinCostFixture(apis[which],{scattered:false,track:false});
      for(let i=0;i<1000;i++)f.fire();
      const before=f.counts(),hash=integration.sha(f.b),at=performance.now();
      for(let i=0;i<boundaries;i++)f.fire();
      const ms=performance.now()-at,after=f.counts();
      assert.equal(f.observer.report.status,'running');assert.equal(integration.sha(f.b),hash);
      assert.equal(after.translations-before.translations,534*boundaries);
      assert.equal(after.originalCalls-before.originalCalls,boundaries);
      row[which]={ms,boundaries,translations:after.translations-before.translations,originalCalls:after.originalCalls-before.originalCalls};f.observer.finish();
    }rounds.push(row);
  }
  const median=which=>rounds.map(r=>r[which].ms).sort((a,b)=>a-b)[3];
  const result={fixtureOnly:true,nativeExecuted:false,baseline:PIN_COST_BASE,boundariesPerRound:boundaries,
    rounds,baselineMedianMs:median(0),candidateMedianMs:median(1),reductionPercent:100*(1-median(1)/median(0)),
    translationsPerBoundary:534,pinnedBytesPerBoundary:502,pinsPerBoundary:35,
    removedPerBoundary:{hexByteConversions:502,hexArrayMaps:35,hexStringJoins:35},
    nativeTimingClaim:false,adaptiveSchedulingChanged:false};
  write(EVIDENCE,'pin-cost-timing.json',result);console.log('PIN_COST_TIMING '+JSON.stringify(result));
});

for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm'])
test('pin cost separated observer timing with final module native translator (no instruction replay) '+variant,async()=>{
  const file='build/'+variant,bytes=fs.readFileSync(path.join(integration.ROOT,file)),module=await WebAssembly.compile(bytes);
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={memory};
  for(const row of WebAssembly.Module.imports(module))if(row.kind==='function'){
    assert.equal(row.module,'host');imports[row.name]=()=>0;
  }
  const {exports:e}=await WebAssembly.instantiate(module,{host:imports}),b=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
  const media='test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe',exe=fs.readFileSync(path.join(integration.ROOT,media));
  assert.equal(integration.sha(exe),pinCostObserver().EXE_SHA256);b.set(exe,e.get_staging());assert(e.load_pe(exe.length));
  e.set_current_thread_id(1);e.set_eip(0x47d8f3);e.set_esp(0x074ffc84);
  for(const a of [0x4b87d4,0x4b7d14,0x4b87cc,0x4b87d0,0x5ce08c])dv.setUint32(e.guest_to_wasm(a),0,true);
  let translations=0,calls=0;
  const ex={...e,guest_to_wasm(a){translations++;return e.guest_to_wasm(a);}};
  const state=()=>Object.fromEntries(['eip','esp','ebp','eax','ebx','ecx','edx','esi','edi','flag_op','flag_a','flag_b','flag_res','flag_sign_shift','yield_reason'].map(n=>[n,e['get_'+n]()>>>0]));
  const before={hash:integration.sha(b),state:state()},apis=[pinCostObserver(true),pinCostObserver()],rounds=[],boundaries=10000;
  for(let round=0;round<7;round++){
    const row=[];for(const which of round%2?[1,0]:[0,1]){
      const host={log_block(){calls++;return 37;}},o=apis[which].attach({host,getExports:()=>ex,workerSlot:0,
        exeSha256:apis[which].EXE_SHA256,wasmSha256:integration.sha(bytes),now:()=>0,deadline:30000});
      for(let i=0;i<1000;i++)host.log_block(0x47d8f3,0x074ffc84);
      const t=translations,c=calls,at=performance.now();
      for(let i=0;i<boundaries;i++)host.log_block(0x47d8f3,0x074ffc84);
      row[which]={ms:performance.now()-at,boundaries,translations:translations-t,originalCalls:calls-c};
      assert.equal(o.report.status,'running');assert.equal(translations-t,534*boundaries);assert.equal(calls-c,boundaries);o.finish();
    }rounds.push(row);
  }
  assert.deepEqual({hash:integration.sha(b),state:state()},before,'passive timing preserves complete native memory and GPRs');
  const median=which=>rounds.map(r=>r[which].ms).sort((a,b)=>a-b)[3];
  const result={fixtureOnly:true,guestInstructionsExecuted:false,nativeTranslator:true,path:file,sha256:integration.sha(bytes),
    rounds,baselineMedianMs:median(0),candidateMedianMs:median(1),reductionPercent:100*(1-median(1)/median(0)),before,translationsPerBoundary:534};
  write(EVIDENCE,variant+'.pin-cost-native-translator-timing.json',result);
  console.log('PIN_COST_NATIVE_TRANSLATOR '+JSON.stringify({path:file,baselineMedianMs:median(0),candidateMedianMs:median(1),reductionPercent:result.reductionPercent}));
});

for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm'])
test('pin cost final module short original-byte native fragments full memory/GPR/commands/traps '+variant,async()=>{
  const file='build/'+variant,bytes=fs.readFileSync(path.join(integration.ROOT,file));
  const row={path:file,localReference:file,bytes:bytes.length,sha256:integration.sha(bytes)};
  // Explicit final-build offline qualification, separate from the immutable
  // accepted historical manifest. No runtime binding or inventory is rewritten.
  const baseline=await nativeOne(row,'pin-cost-baseline'),candidate=await nativeOne(row),control=await nativeOne(row,'control');
  for(const r of [baseline,candidate,control])assert(r.value.pass,JSON.stringify(r.value));
  for(const key of ['segments','before','trap','commands','workerSource']){
    assert.deepEqual(candidate.value[key],baseline.value[key],key+' old/new');
    assert.deepEqual(candidate.value[key],control.value[key],key+' observed/control');
  }
  assert.deepEqual(candidate.value.report.observer,baseline.value.report.observer,'complete observer report');
  assert.equal(integration.sha(fs.readFileSync(path.join(integration.ROOT,file))),row.sha256,'shared final module changed during test');
  write(EVIDENCE,variant+'.pin-cost-final-native.json',{fixtureOnly:true,row,baseline:baseline.value,candidate:candidate.value,control:control.value});
});

for(const row of integration.selectedRuntime().pins.moduleFiles)
test('accepted complete Worker source/module pair preserves original native fragment and control '+row.path,async()=>{
 const observed=await nativeOne(row),control=await nativeOne(row,'control');
 assert(observed.value.pass,JSON.stringify(observed.value));assert(control.value.pass,JSON.stringify(control.value));
 for(const key of ['segments','before','trap','commands','workerSource'])assert.deepEqual(observed.value[key],control.value[key],key);
 assert.equal(observed.envelope.__mdk2Binding.sha256,row.sha256);
});
for(const row of integration.pinnedRuntime().pins.moduleFiles)
for(const [mode,status]of [['boundary','boundary-limit'],['record','record-limit'],['recordbytes','record-byte-limit'],['deadline','deadline']])test('observation '+mode+' exhaustion retains real Worker terminal trace: '+row.path,async()=>{
  const result=await nativeOne(row,'measured-'+mode+'-stop');
  if(!['boundary','recordbytes'].includes(mode)){
    const old=await nativeOne(row,'measured-old-'+mode+'-stop');
    write(EVIDENCE,path.basename(row.path)+'.old-terminal-'+mode+'.json',old.value);
    assert(old.value.rejected,JSON.stringify(old.value));
  }
  write(EVIDENCE,path.basename(row.path)+'.retained-'+mode+'.json',result.value);
  assert(result.value.pass,JSON.stringify(result.value));assert(result.value.terminal.terminal);
  assert.equal(result.value.terminal.observer.status,status);assert.equal(result.value.terminal.traced,false);
});

test('retained Medium keyup stalls in decoder at exactly the adaptive minimum',()=>{
  const zlib=require('node:zlib'),base='scratch/runs/20261104-mdk2-medium-release-gameplay/browser/';
  const mapping=new Map();
  for(const name of ['released-headroom-2209.jsonl','released-headroom-2230.jsonl'])
    for(const line of fs.readFileSync(path.join(integration.ROOT,'scratch/usage-watch',name),'utf8').trim().split('\n')){
      const row=JSON.parse(line);if(row.original)mapping.set(row.original,row);
    }
  const inputs=[];
  // These three small readbacks were never archived by either release sweep.
  const unarchived=[
    ['045a66244599d39aedd6c2114eaca8e5b75d3c922c2be4d383bcd8890ae8e45d',3366],
    ['5a52d8f890373d468d51d5b21b6606ba979d58999834008b1c97126c9d7ad418',4036],
    ['8d62160c8de58adc8f048a3bf0dc8e18c772e69b4da1412e0a72ef362bb3eea5',4706]
  ];
  function read(name){
    const relative=base+name,file=path.join(integration.ROOT,relative);
    const bytes=fs.existsSync(file)?fs.readFileSync(file):zlib.gunzipSync(fs.readFileSync(file+'.gz'));
    const index=/^bounded-trace-end-([012])\.json$/.exec(name)?.[1];
    const pin=mapping.get(relative)||(index===undefined?null:{sha256:unarchived[index][0],bytes:unarchived[index][1]});
    assert(pin,'retained release mapping '+relative);
    assert.equal(integration.sha(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);
    inputs.push({path:relative,sha256:pin.sha256,bytes:pin.bytes});return JSON.parse(bytes);
  }
  const checkpoints=Array.from({length:29},(_,i)=>read('bounded-trace-end-'+i+'.json'));
  for(const [i,current]of checkpoints.entries()){
    assert.equal(current.report.fatal,null);assert.equal(current.report.observer.status,'running');
    assert.equal(current.report.traceEnd,checkpoints[0].report.traceEnd);
    assert(current.report.observer.records.every(r=>r.kind==='sample'));
    if(i<2)continue;
    const previous=checkpoints[i-1];
    assert.equal(current.result.steps-previous.result.steps,16);
    assert.equal(current.report.observer.blocks-previous.report.observer.blocks,16000);
    const pc=current.report.observer.records.at(-1).pc;
    assert(pc>=0x47cea0&&pc<0x47e100,'original decoder range');
  }
  const final=read('native-selector-75-released-71.json').main;
  assert.equal(final.frozen.steps,4128);
  assert.deepEqual(final.inputQueue,[{type:'key',hwnd:0,wParam:13,msg:257,lParam:3223060481}]);
  assert.equal(final.nativeSelection.command.raw,1);assert.equal(final.nativeSelection.command.previous,1);
  assert.equal(final.nativeSelection.current.value,'diff');
  const original=integration.pinnedRuntime().files['lib/guest-rpc.js'];
  assert(original.includes("(name === 'log' || name === 'log_i32' || name === 'log_api_exit'))"));
  write(EVIDENCE,'retained-native-minimum.json',{inputs,
    firstStep:checkpoints[0].result.steps,lastStep:final.frozen.steps,
    decoderCheckpoints:27,boundariesPerStep:1000,keyup:final.inputQueue,
    claim:'Frozen retained readbacks, not a resumed game or reconstructed decoder state'});
});

for(const row of integration.pinnedRuntime().pins.moduleFiles) test('bounded owning decoder context and native replay: '+row.path,async()=>{
  const result=await nativeOne(row,'measured-decoder-context');
  const forward=await nativeOne(row,'measured-decoder-context-bridge-forward');
  const control=await nativeOne(row,'control-measured-decoder-context');
  assert.deepEqual(control.value.state,result.value.state,'passive decoder context register/flag parity');
  assert.deepEqual(control.value.decodedOutput,result.value.decodedOutput,'passive decoder output parity');
  assert.equal(result.value.brokerLogBlocks,0);assert(forward.value.brokerLogBlocks>0);
  assert.deepEqual(forward.value.replay.expected,result.value.replay.expected);
  assert.deepEqual(forward.value.state,result.value.state);
  const exceptions=[];
  for(const suffix of ['', '-pinned']){
    const fault=await nativeOne(row,'measured-decoder-context-bridge-exception'+suffix);
    assert.match(fault.value.rejected,/host import log_block threw/);
    assert.equal(fault.value.report.observer.status,'original-import-failure');
    exceptions.push(fault.value);
  }
  assert.deepEqual(exceptions[0].faultState,exceptions[1].faultState,'original/amended exception native parity');
  assert(result.value.replay.returned);assert.equal(result.value.report.fatal,null);
  assert.equal(result.value.replay.context.registers.eip,0x47d9c8);
  assert.equal(result.value.replay.context.fields.inputRemaining,8192);
  assert.equal(result.value.replay.context.cursors.requestedBytes,8);
  assert(result.value.replay.context.capturedBytes<=256);
  assert.equal(result.value.replay.context.output.bytes.length,8);
  assert.equal(result.value.replay.end.fields.decodedWords,0);
  assert.equal(result.value.report.nativeSlice.budget,1000);
  assert.equal(result.value.replay.context.slice.budget,1000);
  assert.equal(result.value.replay.context.slice.completed,false);
  write(EVIDENCE,path.basename(row.path)+'.decoder-context.json',{fixtureOnly:true,quiet:result.value,forward:forward.value,control:control.value,exceptions});
});

for(const row of integration.pinnedRuntime().pins.moduleFiles) test('original native decoder RPC diagnosis: '+row.path,async()=>{
  const pinned=await nativeOne(row,'measured-rpc-diagnosis-pinned');
  const quiet=await nativeOne(row,'measured-rpc-diagnosis-quiet');
  const traceOnly=await nativeOne(row,'control-measured-rpc-diagnosis-quiet');
  for(const arm of [pinned,quiet]){
    assert(arm.value.returned);assert.equal(arm.value.report.fatal,null);
    assert.equal(arm.value.report.observer.status,'measured-return');
    assert(arm.value.checkpoints>1);assert(arm.value.blocks<50000000);
  }
  assert.equal(pinned.value.brokerLogBlocks,pinned.value.blocks);
  assert.equal(quiet.value.brokerLogBlocks,0);
  assert.equal(traceOnly.value.brokerLogBlocks,0);assert(traceOnly.value.returned);
  for(const key of ['state','guestHash','outputHash','outputFirst','commands'])
    assert.deepEqual(traceOnly.value[key],quiet.value[key],key);
  for(const key of ['state','guestHash','outputHash','outputFirst','commands','trap']){
    // Trap's full-memory hash includes the transport's differing RPC sequence.
    if(key==='trap')assert.deepEqual(quiet.value.trap.state,pinned.value.trap.state);
    else assert.deepEqual(quiet.value[key],pinned.value[key],key);
  }
  const host=integration.gitFile(integration.SOURCE,'host.js').toString();
  const lo=host.indexOf('        const ranBlocks = r.trapped ? 0 : r.blocks | 0;');
  const hi=host.indexOf('        // Nothing ran this step',lo);assert(lo>0&&hi>lo);
  const adapt=(r,steps)=>{
    const self={_workerAdaptiveSteps:100000},context={self,r,steps,inputBurstSlice:false,configuredSteps:100000};
    vm.runInNewContext(host.slice(lo,hi),context);return self._workerAdaptiveSteps;
  };
  const summary=arm=>({elapsedMs:arm.value.elapsedMs,brokerLogBlocks:arm.value.brokerLogBlocks,
    slices:arm.value.slices,blocks:arm.value.blocks,
    samples:arm.value.sliceResults.slice(0,-1).map(r=>({blocks:r.blocks,ms:r.ms,nextBudget:adapt(r,1000)}))});
  assert.equal(adapt({blocks:1000,ms:100,trapped:false},1000),1000);
  assert.equal(adapt({blocks:1000,ms:1,trapped:false},1000),12000);
  write(EVIDENCE,path.basename(row.path)+'.rpc-diagnosis.json',{fixtureOnly:true,
    claim:'Same original decoder and fixed slice commands; no release/callback/gameplay claim',
    pinned:summary(pinned),quiet:summary(quiet),traceOnly:summary(traceOnly),
    results:{pinned:pinned.value,quiet:quiet.value,traceOnly:traceOnly.value}});
});

for(const row of integration.pinnedRuntime().pins.moduleFiles) test('measured unchanged native decoder exceeds old boundary contract: '+row.path,async()=>{
  const old=await nativeOne(row,'measured-old'),observed=await nativeOne(row,'measured'),control=await nativeOne(row,'control-measured');
  write(EVIDENCE,path.basename(row.path)+'.measured-native.json',{old:old.value,observed:observed.value,control:control.value});
  assert(old.value.rejected || !old.value.returned);assert.equal(old.value.report.observer.status,'boundary-limit');
  assert(observed.value.returned,JSON.stringify(observed.value));assert(observed.value.blocks>100000);
  assert(observed.value.checkpoints>1);assert.equal(observed.value.report.fatal,null);
  assert.deepEqual(observed.value.outputFirst,[29,17,29,17,17,29,17,29,29,17,29,17,17,29,17,29]);
  for(const key of ['state','memoryHash','outputHash','outputFirst','commands','trap'])assert.deepEqual(observed.value[key],control.value[key],key);
});

for(const row of integration.pinnedRuntime().pins.moduleFiles) {
  test('actual queued first fault stops before original POP ESI on '+row.path,async()=>{
    const old=await nativeOne(row,'missing-history-old-binding'),fixed=await nativeOne(row,'missing-history-stop');
    write(EVIDENCE,path.basename(row.path)+'.first-fault-native-stop.json',{fixtureOnly:true,old:old.value,fixed:fixed.value});
    assert.match(old.value.rejected,/first rejected boundary returned/);
    assert.match(fixed.value.rejected,/finalizer history missing/);
    assert.equal(old.value.faultState.esp,0x74ff008);assert.equal(fixed.value.faultState.esp,0x74ff000);
    assert.equal(fixed.value.faultState.eip,0x44f515);assert.equal(old.value.faultState.eip,0x1800000);
    // The rejected paths end at different decoded PCs; retain both complete
    // hashes, and compare guest bytes rather than demand decoder-cache parity.
    assert.match(fixed.value.memoryHash,/^[a-f0-9]{64}$/);assert.equal(fixed.value.guestHash,old.value.guestHash);
    for(const name of ['ebp','eax','ebx','ecx','edx','edi','flag_op','flag_a','flag_b','flag_res','flag_sign_shift'])
      assert.equal(fixed.value.faultState[name],old.value.faultState[name],name);
    assert.deepEqual(fixed.value.commands,old.value.commands);assert.equal(fixed.value.commands.length,1);
  });
  test('old real observer rejects sealed original Medium review interval on '+row.path,async()=>{
    const r=await nativeOne(row,'continuity-historical-old-review-early');
    assert.match(r.value.report.fatal,/trace continuation deadline|native construction history ended/);
    assert.equal(r.value.checkpoints,1);assert(r.value.report.traceEnd-r.value.traceStartedAt>=10000);
    assert(r.value.report.traceEnd-r.value.traceStartedAt<=10010);
    write(EVIDENCE,path.basename(row.path)+'.historical-review-deadline.json',{fixtureOnly:true,...r.value});
  });
  test('fixed whole-sequence deadline survives retained review without renewal on '+row.path,async()=>{
    const observed=await nativeOne(row,'continuity-historical-review-early'),control=await nativeOne(row,'control-early');
    write(EVIDENCE,path.basename(row.path)+'.latest-observed.json',observed.value);
    assert(observed.value.pass,JSON.stringify(observed.value));
    for(const key of ['segments','before','trap','commands','workerSource'])assert.deepEqual(observed.value[key],control.value[key],key);
    assert.equal(observed.value.report.fatal,null);
    assert(observed.value.checkpoints>5);
    assert(observed.value.report.traceEnd-observed.value.traceStartedAt>=200000);
    assert(observed.value.report.traceEnd-observed.value.traceStartedAt<=200010);
    write(EVIDENCE,path.basename(row.path)+'.fixed-historical-review.json',{fixtureOnly:true,...observed.value});
  });
  test('genuine queued demand entry precedes finalizer across retained checkpoints: '+row.path, async()=>{
    const observed=await nativeOne(row,'continuity-early'),control=await nativeOne(row,'control-early');
    assert(observed.value.pass,JSON.stringify(observed.value));
    for(const key of ['segments','before','trap','commands','workerSource'])assert.deepEqual(observed.value[key],control.value[key],key);
    const records=observed.value.report.observer.records;
    assert.equal(records.filter(r=>r.kind==='demand-call').length,1);
    const kinds=records.map(r=>r.kind);
    assert(kinds.indexOf('demand-call')<kinds.indexOf('completion-finalizer-entry'));
    for(const k of ['completion-consume','completion-finalizer-return','poll-return','demand-return','script-buffer-entry'])assert(kinds.indexOf(k)>kinds.indexOf('demand-call'),k);
    assert(!kinds.includes('poll-prefix-unobserved'));
    assert.equal(observed.value.report.fatal,null);
    const late=await nativeOne(row,'late-early');
    assert.match(late.value.report.fatal,/demand return history\/completion missing/);
    assert(!late.value.report.observer.records.some(r=>r.kind==='demand-call'));
    const old=await nativeOne(row,'old-early'),wrong=await nativeOne(row,'wrong-register-early');
    for(const r of [old,wrong]){
      assert.match(r.value.report.fatal,/wrong demand request/);
      assert(!r.value.report.observer.records.some(r=>r.kind==='demand-call'));
    }
    assert.equal(records.find(r=>r.kind==='demand-call').resource.request,0);
    assert(records.find(r=>r.kind==='demand-call').argument.request>0);
    write(EVIDENCE,path.basename(row.path)+'.early-demand-native.json',{fixtureOnly:true,observed:observed.value,control:control.value,late:late.value,old:old.value,wrong:wrong.value});
  });
  test('sequential queued native slices retain one observer and exact state across checkpoints: '+row.path, async()=>{
    const observed=await nativeOne(row,'continuity'),control=await nativeOne(row,'control');
    assert(observed.value.pass,JSON.stringify(observed.value));
    for(const key of ['segments','before','trap','commands','workerSource'])assert.deepEqual(observed.value[key],control.value[key],key);
    assert(observed.value.checkpoints>5);
    assert.equal(observed.value.report.fatal,null);
    assert(observed.value.report.observer.records.some(r=>r.kind==='demand-return'));
    write(EVIDENCE,path.basename(row.path)+'.continuity.json',{fixtureOnly:true,observed:observed.value,control:control.value});
  });
  test('actual Sleep return at mid-poll attachment preserves unknown prefix: '+row.path, async()=>{
    const old=await nativeOne(row,'mid-poll-old');
    assert.match(old.value.report.fatal,/poll history missing/);
    assert.equal(old.value.report.observer.blocks,2);
    const repaired=await nativeOne(row,'mid-poll');
    assert(repaired.value.pass,JSON.stringify(repaired.value));
    assert.equal(repaired.value.report.fatal,null);
    const report=repaired.value.report.observer;
    for(const kind of ['poll-prefix-unobserved','poll-suffix-read','poll-suffix-end'])assert(report.records.some(r=>r.kind===kind),kind);
    assert(!report.records.some(r=>r.kind==='poll-return'),'unobserved prefix never becomes poll history');
    assert.equal(report.pending.poll,null);
    assert.equal(report.pending.unobservedPollPrefix,null);
    assert(report.records.every(r=>r.resource.completion===0),'actual pending request stays incomplete');
    // segments include the full-memory hash at the identical poll endpoint.
    // The old rejection disables tracing one boundary earlier; the following
    // caller slice therefore no longer compares identical trace configurations.
    for(const key of ['segments','guestHash','state','commands','workerSource'])assert.deepEqual(repaired.value[key],old.value[key],key);
    fs.writeFileSync(path.join(EVIDENCE,path.basename(row.path)+'.mid-poll.json'),JSON.stringify({old:old.value,repaired:repaired.value},null,2));
    for(const mode of ['bad-stack','stale-stack','foreign-request','wrong-order','demand-return']){
      const negative=await nativeOne(row,'mid-poll-'+mode);
      assert(negative.value.rejected,JSON.stringify(negative.value));
      assert(negative.value.report.fatal,JSON.stringify(negative.value));
      assert.equal(negative.value.report.traced,false);
      if(mode==='demand-return'){
        assert.match(negative.value.report.fatal,/demand return history\/completion missing/);
        assert(!negative.value.report.observer.records.some(r=>r.kind==='demand-call'));
      }
      write(EVIDENCE,path.basename(row.path)+'.mid-poll-negative-'+mode+'.json',{fixtureOnly:true,...negative.value});
    }
  });
  test('composed original preload delivers original native fragment in real shipped Worker: '+row.path, async()=>{
    const result=await nativeOne(row);
    const control=await nativeOne(row,'control');
    assert(result.value.pass,JSON.stringify(result.value));
    for(const key of ['segments','before','trap','commands','workerSource'])assert.deepEqual(result.value[key],control.value[key],key);
    const report=result.value.report;
    assert.equal(report.fatal,null);assert.equal(report.traced,false);assert.equal(report.started,true);
    assert(report.observer.blocks>0 && report.observer.blocks<=100000);
    for(const kind of ['completion-consume','completion-finalizer-entry','completion-finalizer-return','poll-return','demand-return','script-buffer-entry'])
      assert(report.observer.records.some(r=>r.kind===kind),kind);
    assert.deepEqual(report.binding,JSON.parse(JSON.stringify(result.envelope.__mdk2Binding)));
    assert.equal(report.binding.sha256,row.sha256);
    assert.deepEqual(Array.from(result.page.audit,r=>r.kind),['compiled','sent']);
    fs.writeFileSync(path.join(EVIDENCE,path.basename(row.path)+'.native.json'),JSON.stringify({observed:result.value,control:control.value},null,2));
  });
}
for(const row of integration.pinnedRuntime().pins.moduleFiles)
for(const mode of ['continuity-deadline','continuity-registers','continuity-paused-boundary','continuity-boundary-overflow','continuity-record-overflow','wrong-module','wrong-endpoint','wrong-thread','wrong-instance','foreign-module-object','missing-history','import-failure','terminal','deadline','active-deadline','late']) {
  test('real composed Worker lifecycle rejects '+mode+' '+row.path, async()=>{
    const result=await nativeOne(row,mode);
    assert(result.value.rejected,JSON.stringify(result.value));
    if(result.value.report)assert.equal(result.value.report.traced,false);
    if(mode==='continuity-deadline'){
      assert.equal(result.value.checkpoints,1,'expiry occurs inside the retained review pause');
      assert.equal(result.value.report.observer.status,'deadline');
    }
    if(mode==='continuity-record-overflow'){
      assert.equal(result.value.report.observer.status,'record-limit');assert.equal(result.value.report.observer.records.length,512);
    }
  });
}

test('observer GC prefix failure remains terminal and queryable in actual current Worker without later execution',async()=>{
 for(const row of integration.selectedRuntime().pins.moduleFiles){
  const result=await nativeOne({...row,localReference:row.path},'gc-prefix-preserve');
  assert(result.value.pass,JSON.stringify(result.value));
  assert.match(result.value.report.fatal,/gc return history missing/);
  assert.equal(result.value.report.observer.status,'unsupported-or-unobservable');
  assert.equal(result.value.report.observer.blocks,1);
  assert.equal(result.value.report.terminal,true);assert.equal(result.value.report.traced,false);
  assert(!result.value.report.observer.records.some(r=>r.kind==='gc-entry'||r.kind==='gc-return'));
  assert.equal(result.value.noLaterExecution,true);
  write(EVIDENCE,path.basename(row.path)+'.gc-prefix-preserve.json',{fixtureOnly:true,...result.value});
 }
});

test('continuous early GC: genuine collector CALL/RET and late start in both accepted Workers',async()=>{
 for(const row of integration.selectedRuntime().pins.moduleFiles){
  const observed=await nativeOne(row,'continuous-gc'),control=await nativeOne(row,'control-continuous-gc');
  write(EVIDENCE,path.basename(row.path)+'.continuous-gc.json',{fixtureOnly:true,observed:observed.value,control:control.value});
  assert(observed.value.pass,JSON.stringify(observed.value));assert(control.value.pass,JSON.stringify(control.value));
  for(const key of ['state','memoryHash','guestHash','commands'])assert.deepEqual(observed.value[key],control.value[key],key);
  const records=observed.value.report.observer.records,entry=records.findIndex(r=>r.kind==='gc-entry'),returned=records.findIndex(r=>r.kind==='gc-return');
  assert(entry>=0&&returned>entry);assert.equal(records[returned].esp,records[entry].esp+4);
  assert.equal(observed.value.checkpoints,1);assert.equal(observed.value.report.traceEnd,observed.value.traceEnd);
  const late=await nativeOne(row,'late-continuous-gc');
  write(EVIDENCE,path.basename(row.path)+'.late-continuous-gc.json',{fixtureOnly:true,...late.value});
  assert(late.value.pass,JSON.stringify(late.value));assert.match(late.value.report.fatal,/gc return history missing/);
  assert.equal(late.value.noLaterExecution,true);assert.equal(late.value.initialPC,0x449096);
 }
});
test('continuous early GC: native pending-frame faults preserve first report and reject next slice',async()=>{
 for(const row of integration.selectedRuntime().pins.moduleFiles)for(const mode of ['pin','owner','epoch','esp','caller','expiry','boundary-limit','record-limit']){
  const r=await nativeOne(row,'continuous-gc-'+mode);
  write(EVIDENCE,path.basename(row.path)+'.continuous-gc-'+mode+'.json',{fixtureOnly:true,...r.value});
  assert(r.value.pass,JSON.stringify(r.value));assert.equal(r.value.noLaterExecution,true);
  const pattern={pin:/original bytes changed/,owner:/replacement owning instantiation/,epoch:/foreign observation epoch/,
    esp:/changed owning registers/,caller:/gc return history missing/,expiry:/continuation deadline/,
    'boundary-limit':/boundary-limit/,'record-limit':/record-limit/}[mode];
  assert.match(r.value.report.fatal||r.value.report.observer.status,pattern);
  assert.equal(r.value.report.observer.records.some(x=>x.kind==='gc-entry'),mode!=='caller');
  assert(!r.value.report.observer.records.some(x=>x.kind==='gc-return'));
 }
});

test('genuine original import failure still traps in actual current Worker',async()=>{
 for(const row of integration.selectedRuntime().pins.moduleFiles){
  const result=await nativeOne({...row,localReference:row.path},'import-failure');
  assert(result.value.rejected,JSON.stringify(result.value));
  assert.match(result.value.rejected,/original import fixture failure/);
  assert.match(result.value.report.fatal,/original import fixture failure/);
  assert.equal(result.value.report.traced,false);
  write(EVIDENCE,path.basename(row.path)+'.genuine-import-failure.json',{fixtureOnly:true,...result.value});
 }
});

test('page hook rejects late installation, unhashed and ambiguous replacement Module sends', async()=>{
  for(const mode of ['late','unhashed','replacement']){
    class W{postMessage(){}}
    const realm={document:{},location:{href:'http://offline/'},URL,Worker:W,ArrayBuffer,Uint8Array,
      WebAssembly:{Module:WebAssembly.Module,compile:WebAssembly.compile,instantiate:WebAssembly.instantiate},crypto:require('crypto').webcrypto,Date,setTimeout,clearTimeout};
    vm.createContext(realm);
    if(mode==='late')realm.__mdk2Observe={events:[{kind:'instantiated'}]};
    const install='('+integration.installBinding.toString()+')('+JSON.stringify({moduleHashes:integration.pinnedRuntime().pins.moduleFiles.map(r=>r.sha256)})+')';
    if(mode==='late'){assert.throws(()=>vm.runInContext(install,realm),/late/);continue;}
    vm.runInContext(install,realm);
    const bytes=integration.retainedModule(integration.pinnedRuntime().pins.moduleFiles[0]);
    const module=await (mode==='unhashed'?WebAssembly:realm.WebAssembly).compile(bytes),w=new realm.Worker('http://offline/lib/guest-worker.js');
    const msg={t:'init',slot:0,module,endpointIdentity:1};
    if(mode==='replacement')w.postMessage(msg);
    assert.throws(()=>w.postMessage(msg),/unhashed|replacement/);
  }
});

function sealedSidecars() {
  const base=path.join(integration.RUNS,'20261104-mdk2-measured-escape-original');
  const retained=name=>{const p=path.join(base,name);return fs.existsSync(p)?fs.readFileSync(p):require('node:zlib').gunzipSync(fs.readFileSync(p+'.gz'));};
  const seal=JSON.parse(retained('seal.json')),bytes=retained('remote-recovery-inventory.json');
  const pin=seal.files.find(r=>r.path==='remote-recovery-inventory.json');assert.equal(integration.sha(bytes),pin.sha256);
  const inventory=JSON.parse(bytes);
  function read(suffix){const name='comic-control-112'+suffix+'.json',p=path.join(base,'recovered/browser',name);
    const b=fs.existsSync(p)?fs.readFileSync(p):require('node:zlib').gunzipSync(fs.readFileSync(p+'.gz'));
    const row=inventory.find(r=>r.path==='browser/'+name);assert.equal(b.length,row.bytes);assert.equal(integration.sha(b),row.sha256);return JSON.parse(b);}
  return {main:read('-native-main'),file:read('-owner')};
}

test('earlier checkpoint retains request publication without inventing progress or call history',()=>{
  const after=sealedSidecars(),before=structuredClone(after);
  before.main.request=0;before.main.rawRequestWords=null;
  const result=integration.correlateSnapshots(before,after,{observer:{records:[]}});
  assert.equal(result.requestChanged,true);assert.deepEqual(result.requests,[0,after.main.request]);
  assert.equal(result.outputProgress,null);assert.equal(result.completedBytesDelta,null);
  assert.deepEqual(result.mainEvents,[]);
  const changed=structuredClone(after);changed.main.rawRequestWords[0]++;
  assert.throws(()=>integration.correlateSnapshots(after,changed,{observer:{records:[]}}),/buffer\/size\/name changed/);
  write(EVIDENCE,'earlier-request-correlation.json',{fixtureOnly:true,result});
});

// Explicit protocol fixtures around the actual composed command functions.
// Sidecars are sealed original readbacks; fake CDP replies are not runtime proof.
for(const mode of ['early','early-old','medium-unobserved','success','post-quantum-scene','ambiguous','wrong-module','wrong-thread','wrong-target','replacement','missing-history','failure','terminal','deadline','unfrozen','ownership-rejected','changed-frozen','changed-owner','old-terminal','old-skip']) {
  test('actual composed construction command / attachment '+mode,async()=>{
    let candidate=integration;
    if(mode==='old-terminal'||mode==='old-skip'||mode==='early-old'){
      const filename=require.resolve('../tools/mdk2-construction-driver-integration.cjs'),old=new Module(filename,module);
      old.filename=filename;old.paths=module.paths;
      const historical=integration.gitFile(mode==='early-old'?'1b1eada7d4885008e51a379142f22391c1fd0e7b':mode==='old-skip'?'91d6a3a1583b956c1c0de4e41309f8eaaac3f0e1^':'91d6a3a1583b956c1c0de4e41309f8eaaac3f0e1','tools/mdk2-construction-driver-integration.cjs').toString();
      // Hold today's observer constant while comparing actual producer logic.
      old._compile(historical.replace(/const OBSERVER_REPAIR_SHA256 = '[a-f0-9]{64}';/,
        "const OBSERVER_REPAIR_SHA256 = '"+integration.sha(fs.readFileSync(require.resolve('../tools/mdk2-lua-construction-observer.cjs')))+"';"),filename);
      candidate=old.exports;
    }
    const {api}=actualDriver(candidate);review(api);
    const approval=JSON.parse(fs.readFileSync(path.join(api.OUT,'inspection-approval.json')));
    Object.assign(approval,{screen:'post-medium-construction',originalScene:'level-destruction-construction',selection:'none',constructionBlackVisible:true,
      transitioning:true,loadingVisible:false,comicPanelsVisible:false,tutorialVisible:false,unsupportedSceneVisible:false});
    if(mode==='medium-unobserved')Object.assign(approval,{screen:'difficulty',selection:'Medium',transitioning:false,mediumHighlighted:true,difficultyDialogVisible:true});
    write(api.OUT,'inspection-approval.json',approval);write(api.OUT,'native-selector-ledger.json',{newgame:true,medium:true});
    const {main,file}=sealedSidecars();main.frozen.steps=3344;file.frozen.steps=3344;
    if(mode.startsWith('early')){main.request=0;main.rawRequestWords=null;}
    const url='http://offline/lib/guest-worker.js',sent={kind:'sent',sha256:integration.pinnedRuntime().pins.moduleFiles[0].sha256,
      compilation:0,bytes:2143540,workerURL:url,slot:0,endpointIdentity:1};
    const barrier={frozen:main.frozen,owners:[{handle:null,slot:0,endpointIdentity:1,values:{get_current_thread_id:1,get_eip:main.values.get_eip}},
      {handle:921600,slot:1,endpointIdentity:2,values:{get_current_thread_id:2,get_eip:file.values.get_eip}}]};
    const calls=[];let starts=0,finishes=0,steps=0,checkpoints=0,resumes=0;
    const session={send:async(name,args)=>{
      calls.push(args.expression);
      const r={targetId:mode==='wrong-target'?'foreign':'fixture',workerURL:url,binding:{...sent},thread:mode==='wrong-thread'?2:1,
        fatal:null,traced:starts>0,terminal:false,traceEnd:Date.now()+10000,observer:starts>0?{status:'running',blocks:10,records:[]}:null};
      if(mode==='wrong-module')r.binding.sha256='f'.repeat(64);
      if(args.expression.includes('invoke("start"')){starts++;r.traced=true;
        if(mode==='replacement')api.sessions.set('fixture',{session:{},info:{url}});}
      if(args.expression.includes('invoke("resume"')){resumes++;r.traced=true;}
      if(args.expression.includes('invoke("checkpoint"')){checkpoints++;r.paused=true;r.traced=true;r.observer={status:'running',blocks:mode==='missing-history'?0:10,records:[]};if(mode==='failure')r.fatal='fixture observer unsupported history';}
      if(args.expression.includes('invoke("finish"')){finishes++;r.observer={blocks:mode==='missing-history'?0:10,records:[]};
        if(mode==='failure')r.fatal='fixture observer unsupported history';}
      return {result:{value:JSON.stringify(r)}};
    }};
    api.sessions.set('fixture',{session,info:{url}});
    if(mode==='ambiguous')api.sessions.set('other',{session,info:{url}});
    api.deadlineForTest(Date.now()+(mode==='deadline'?100000:900000));
    api.pageForTest({evaluate:async(fn,n)=>{
      if(fn.name==='frozenOwnership'){if(mode==='unfrozen')throw Error('fixture unfrozen barrier');if(mode==='ownership-rejected')return {rejection:{reason:'foreign main ownership',owners:barrier.owners}};return structuredClone(barrier);}
      if(fn.name==='mainState')return structuredClone(main);if(fn.name==='ownerState')return structuredClone(file);
      if(fn.name==='passiveOuterState')return {available:false,reason:'explicit fixture has no supplemental memory hook'};
      if(fn.toString().includes('WineFrozen.step')){steps++;return {ran:n,timedOut:false};}
      return {input:{inputQueue:[],activeInput:null,mouseButtonsMask:0},binding:{audit:[sent]},frozen:main.frozen};
    }});
    if(mode==='terminal')await api.traceDriver.finish('fixture-terminal');
    if(mode==='medium-unobserved'){
      await assert.rejects(api.command({action:'step',n:16},1),/Medium trusted input receipt missing/);
      assert.equal(steps,0);assert.equal(starts,0);
    }else if(mode.startsWith('early')){
      await api.command({action:'step',n:16},1);
      assert.equal(steps,1);assert.equal(starts,mode==='early'?1:0);
      assert.equal(checkpoints,mode==='early'?1:0);
      write(EVIDENCE,'early-attachment-producer-'+mode+'.json',{fixtureOnly:true,starts,steps,checkpoints,requestAtAttachment:main.request});
      await api.traceDriver.finish('fixture-terminal');
    }else if(['success','post-quantum-scene','changed-frozen','changed-owner','old-terminal','old-skip'].includes(mode)){
      await api.command({action:'step',n:16},1);assert.equal(starts,1);assert.equal(checkpoints,mode.startsWith('old-')?0:1);assert.equal(finishes,mode.startsWith('old-')?1:0);assert.equal(steps,1);
      if(mode==='success')assert.throws(()=>api.traceDriver.noteInput({action:'keydown',key:'Escape',reviewRef:approval.capture},2),/observation scene does not authorize/);
      assert(fs.existsSync(path.join(api.OUT,'bounded-trace-correlation.json')));
      write(api.OUT,'reply-1.json',{i:1,ok:true});
      if(mode==='post-quantum-scene')write(api.OUT,'inspection-approval.json',{...approval,screen:'post-medium-pending'});
      if(mode==='changed-frozen')main.values.get_eip++;
      if(mode==='changed-owner')api.sessions.set('fixture',{session,info:{url}});
      let secondError;
      try{await api.command({action:'step',n:16},2);}catch(error){secondError=error;}
      write(EVIDENCE,'continuation-producer-'+mode+'.json',{fixtureOnly:true,mode,starts,finishes,checkpoints,resumes,steps,error:secondError?.message||null});
      if(mode==='success'){
        assert.equal(secondError,undefined);assert.equal(checkpoints,2);assert.equal(resumes,1);assert.equal(steps,2);assert.equal(finishes,0);
        await api.traceDriver.finish('fixture-terminal');
      }else if(mode==='old-skip'){
        assert.equal(secondError,undefined);assert.equal(steps,2);assert.equal(checkpoints,0);assert.equal(resumes,0);assert.equal(finishes,1);
      }else{
        assert.match(secondError?.message||'unobserved continuation admitted',/native construction history ended|changed construction scene|changed frozen state|replacement construction owner|lost\/replacement owning Worker|foreign main endpoint|Expected values/);
        assert.equal(steps,1,'no unobserved second quantum');
      }
      assert.equal(starts,1,'trace never restarts');
    }else{
      await assert.rejects(api.command({action:'step',n:16},1));
      await assert.rejects(api.command({action:'step',n:16},2),/first failure|terminal/);
      assert(steps<=1);
      if(mode==='ownership-rejected'){
        assert.equal(steps,0);assert.equal(starts,0);
        const saved=JSON.parse(fs.readFileSync(path.join(api.OUT,'bounded-trace-ownership-before.json')));
        assert.deepEqual(saved.rejection.owners,barrier.owners);
      }
    }
  });
}

test('run-local controller composition retains actual operator/author and measured Escape',()=>{
  const sources=integration.controllerSources('/home/user/wine-assembly/scratch/runs/FRESH-MDK2');
  assert(sources['operator.py'].includes("str(E/'author.py')"));assert(sources['operator.py'].includes("str(E/'next.py')"));
  assert(sources['runtime_io.py'].includes("v['runDirectory'] == str(E)"));
  assert(!sources['runtime_io.py'].includes('bx_p6qbh9x9'));
  assert(sources['native-menu.cjs'].includes('mdk2-local-runtime.cjs'));
  assert(sources['native-menu.cjs'].includes('.menuSelector()'));
  for(const [name,source] of Object.entries(sources)){
    if(name.endsWith('.py')){const result=cp.spawnSync('python3',['-c','import ast,sys;ast.parse(sys.stdin.read())'],{input:source,encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
  }
});

// Execute the actual selector and continuation controllers through the actual
// composed command/ACK/inspection path. Transport/native states below are
// explicit protocol fixtures; the separate both-module queue tests execute x86.
// Read-only native-state model for the actual owning binding/observer. This is
// explicitly not a game instance. The both-module queued tests above separately
// establish original instruction, memory, command and trap parity.
async function producerObserver(candidate) {
  const observer=require('../tools/mdk2-lua-construction-observer.cjs');
  const media=path.join(integration.ROOT,'test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe');
  const exe=fs.readFileSync(media),pe=require('../lib/pe').readPE(media);
  assert.equal(integration.sha(exe),observer.EXE_SHA256);
  const bytes=Buffer.alloc(exe.length+4096);exe.copy(bytes);
  const addresses=new Map();let next=exe.length;
  for(const a of [0x4b87d4,0x4b7d14,0x4b87cc,0x4b87d0,0x5ce08c,0x4b7ce4,0x4b712c,0x4b7494,0x5ccb48]){addresses.set(a,next);next+=4;}
  const wa=a=>{for(const [p,o]of addresses)if(a>=p&&a<p+4)return o+a-p;
    if(a>=0x400000&&a<0x400400)return a-0x400000;
    try{return pe.va2off(a);}catch{return 0xf0;}};
  const ex={memory:{buffer:bytes.buffer},guest_to_wasm:wa,set_trace_esp(){}};
  for(const n of ['current_thread_id','image_base','eip','esp','ebp','eax','ebx','ecx','edx','esi','edi',
    'flag_op','flag_a','flag_b','flag_res','flag_sign_shift','yield_reason'])
    ex['get_'+n]=()=>({current_thread_id:1,image_base:0x400000,eip:0x401800,esp:0x74ff000}[n]||0);
  const row=integration.pinnedRuntime().pins.moduleFiles[0],url='http://offline/lib/guest-worker.js';
  let listener;
  let clockOffset=0;
  const realm={URL,Date:{now:()=>Date.now()+clockOffset},setTimeout,clearTimeout,Uint8Array,ArrayBuffer,
    WebAssembly:{Module:WebAssembly.Module,compile:WebAssembly.compile,instantiate:async()=>({exports:ex})},
    addEventListener(type,fn){assert.equal(type,'message');listener=fn;}};
  vm.createContext(realm);
  vm.runInContext(fs.readFileSync(path.join(integration.ROOT,'tools/mdk2-lua-construction-observer.cjs'),'utf8'),realm);
  vm.runInContext('('+candidate.installBinding.toString()+')('+JSON.stringify({moduleHashes:[row.sha256],targetId:'fixture',workerURL:url})+')',realm);
  const module=await WebAssembly.compile(integration.retainedModule(row));
  const sent={kind:'sent',sha256:row.sha256,compilation:0,bytes:row.bytes,workerURL:url,slot:0,endpointIdentity:1};
  listener({data:{t:'init',module,slot:0,endpointIdentity:1,__mdk2Binding:sent}});
  const host={log_block:()=>37};await realm.WebAssembly.instantiate(module,{host});
  return {sent,bound:realm.__mdk2BoundTrace,evaluate:expression=>vm.runInContext(expression,realm),
    advance(ms){clockOffset+=ms;},
    boundary(){assert.equal(host.log_block(0x401800,0x74ff000),37);}};
}
async function personalView(name) {
  const images={'title':'startup-3072','menu':'native-selector-76','fixture-difficulty':'native-selector-79',
    'fixture-fade':'native-selector-88','fixture-pending':'pending-control-97',
    'fixture-absent':'pending-control-103','fixture-published':'comic-control-106','fixture-loading':'comic-control-112'};
  const file=path.join(EVIDENCE,'historical-'+images[name]+'.png'),sha256=integration.sha(fs.readFileSync(file));
  const at=Date.now(),receipt=path.join(EVIDENCE,'personal-view-'+name+'.json');
  assert(!fs.existsSync(receipt),'fresh personal view receipt required');
  write(EVIDENCE,'personal-view-request.json',{name,file,sha256,at,receipt,
    claim:'Historical image personal-view timing rehearsal; synthetic native scene is independent of these pixels'});
  while(!fs.existsSync(receipt)){
    assert(Date.now()-at<180000,'personal review rehearsal deadline');
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  const r=JSON.parse(fs.readFileSync(receipt));
  assert.equal(r.name,name);assert.equal(r.sha256,sha256);assert.equal(r.personallyViewed,true);
  assert(r.viewedAt>=at&&r.viewedAt<=Date.now());
}
async function mediumProducer(candidate=integration, negative=null, personal=false, early=false) {
  const {api}=actualDriver(candidate), prior=path.join(integration.RUNS,'20261104-mdk2-fresh-pending-scene');
  const readJSON=name=>JSON.parse(fs.readFileSync(path.join(api.OUT,name)));
  const {main,file}=sealedSidecars();
  const original=JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(path.join(integration.RUNS,
    '20261104-mdk2-measured-escape-original/recovered/browser/native-selector-79.json.gz')))).state.main;
  const m=structuredClone(original);m.frozen.steps=3344;
  if(early){
    const retained=JSON.parse(fs.readFileSync(path.join(integration.RUNS,'20261105-mdk2-post-medium-timer-onward/browser/startup-3584-native-main.json')));
    const menu=JSON.parse(fs.readFileSync(path.join(integration.RUNS,'20261105-mdk2-post-medium-timer-onward/browser/startup-3584.json'))).state.main;
    Object.assign(main,retained);m.frozen=structuredClone(retained.frozen);
    m.nativeSelection=structuredClone(menu.nativeSelection);m.observation.inputs=structuredClone(menu.observation.inputs);
    if(negative==='unsupported-stack')main.stack[47]=0;
    if(negative==='unsupported-pc')main.values.get_eip=0x449096;
    if(negative==='native-not-rest')m.nativeSelection.command.raw=1;
  }
  const sync=()=>{main.frozen=structuredClone(m.frozen);file.frozen=structuredClone(m.frozen);};sync();
  const model=await producerObserver(candidate),sent=model.sent;
  let starts=0,resumes=0,checkpoints=0,held=false,pressed=0,released=0,traceEnd=null,selectionPhase=early?'newgame':'medium';
  const quanta=[];
  const session={send:async(_,args)=>{
    if(args.expression.includes('invoke("start"'))starts++;
    if(args.expression.includes('invoke("resume"'))resumes++;
    if(args.expression.includes('invoke("checkpoint"'))checkpoints++;
    let r;try{r=JSON.parse(model.evaluate(args.expression));}catch(error){return {exceptionDetails:{text:String(error)}};}
    if(traceEnd!==null)assert.equal(r.traceEnd,traceEnd,'whole-sequence deadline never changes');
    if(r.traceEnd!==null)traceEnd=r.traceEnd;
    return {result:{value:JSON.stringify(r)}};
  }};
  api.sessions.set('fixture',{session,info:{url:sent.workerURL}});
  api.deadlineForTest(Date.now()+900000);
  api.pageForTest({keyboard:Object.fromEntries(['down','up'].map(method=>[method,async key=>{
    if(method==='down'){pressed=0;released=0;}
    held=method==='down';m.observation.inputs.push({type:held?'keydown':'keyup',key,trusted:negative!=='untrusted',target:'screen'});
    m.inputQueue=[{type:'key',hwnd:0,wParam:13,msg:held?0x100:0x101,lParam:held?0:0xc0000000}];
  }])),screenshot:async()=>Buffer.from('explicit offline fixture, no original pixels'),evaluate:async(fn,n)=>{
    if(fn.name==='frozenOwnership')return {frozen:structuredClone(m.frozen),owners:[
      {handle:null,slot:0,endpointIdentity:1,values:{get_current_thread_id:1,get_eip:main.values.get_eip}},
      {handle:921600,slot:1,endpointIdentity:2,values:{get_current_thread_id:2,get_eip:file.values.get_eip}}]};
    if(fn.name==='mainState')return structuredClone(main);
    if(fn.name==='ownerState')return structuredClone(file);
      if(fn.name==='passiveOuterState')return {available:false,reason:'explicit fixture has no supplemental memory hook'};
    if(fn.name==='rawPixels')return {base64:Buffer.from('fixture').toString('base64'),steps:m.frozen.steps};
    if(fn.toString().includes('WineFrozen.setTickMs'))return {tickMs:n};
    if(fn.toString().includes('WineFrozen.step(n)')){
      if(starts)model.boundary();
      quanta.push(n);m.frozen.steps+=n;m.inputQueue=[];sync();
      if(held){pressed++;m.nativeSelection.command.raw=m.nativeSelection.command.previous=pressed>=(early?1:2)?1:0;}
      else if(pressed){released++;m.nativeSelection.command.raw=m.nativeSelection.command.previous=0;
        if(released>=(early?1:2)){
          if(selectionPhase==='newgame')Object.assign(m.nativeSelection,{freeze:{tag:-6,value:null},current:{tag:-2,value:'diff'},showmenu:{tag:-1,value:1},conscheme:{tag:-2,value:'menu'},newconscheme:{tag:-6,value:null}});
          else {m.nativeSelection.freeze={tag:-1,value:1};m.nativeSelection.showmenu={tag:-1,value:0};}
        }}
      return {requested:n,ran:n,timedOut:false};
    }
    if(fn.toString().includes('binding: __mdk2BoundTrace')){
      const input={inputQueue:structuredClone(m.inputQueue),activeInput:m.activeInput,mouseButtonsMask:0};
      if(negative==='extra-queue')input.inputQueue.push({type:'key',wParam:32});
      if(negative==='foreign-active')input.activeInput={type:'key',wParam:32};
      const observation=structuredClone(m.observation);
      if(negative==='changed-history')observation.inputs[0].trusted=false;
      return {input,observation,nativeSelection:structuredClone(m.nativeSelection),binding:{audit:[sent]},frozen:m.frozen};
    }
    return structuredClone(m);
  }});
  write(api.OUT,'identity.json',{commit:integration.SOURCE,deadline:new Date(Date.now()+900000).toISOString()});
  write(api.OUT,'selector.json',{app:'mdk2_demo',renderer:'webgl',isolated:true});
  write(api.OUT,'native-selector-ledger.json',{startedAt:Date.now(),steps:0,commands:0,commandLimit:113,open:true,newgame:!early,medium:false});
  const {Spool}=require(path.join(prior,'native-menu.cjs'));
  let spool;
  spool=new Spool(api.OUT,{pause:async()=>{
    const i=spool.next-1,c=readJSON('commands/'+i+'.json');
    await api.command(c,i);write(api.OUT,'reply-'+i+'.json',{i,ok:true});
  }});
  async function approve(name,classification) {
    await spool.send({action:'shot',name});
    const p=readJSON('inspection-state.json');
    if(personal)await personalView(name);
    return require(path.join(prior,'inspection-guard.cjs')).approve(api.OUT,{capture:name,sha256:p.sha256,steps:p.steps,
      personallyInspected:true,inspector:'offline protocol fixture only',...classification});
  }
  const mainMenu={screen:'main-menu',selection:'New Game',transitioning:false,newGameLabelVisible:true,controllerIconVisible:true,controllerIconHighlighted:true,legalOverlayVisible:false};
  let failure=null;
  try {
    if(early){
      const initial=await approve('fixture-startup3584',mainMenu);
      if(negative==='stale-review')write(api.OUT,'inspection-approval.json',{...initial,steps:3583});
      if(negative==='bad-ack')write(api.OUT,'reply-0.json',{i:0,ok:false});
      const selector=require(path.join(integration.RUNS,'20261104-mdk2-measured-escape-original/native-menu.cjs'));
      await selector.select(api.OUT,initial,'observe',{spool,maxCommands:113});
      const newgame=await approve('fixture-newgame',mainMenu);
      await selector.select(api.OUT,newgame,'newgame',{spool,maxCommands:113});
      assert.deepEqual(quanta,[16,16,32]);assert.equal(starts,1);
      selectionPhase='medium';
      if(negative==='review-expired')model.advance(360001);
    }
    const r=await approve('fixture-difficulty',{screen:'difficulty',selection:'Medium',transitioning:false,difficultyDialogVisible:true,mediumHighlighted:true});
    if(early&&negative==='stale-difficulty')write(api.OUT,'inspection-approval.json',{...r,capture:'fixture-newgame'});
    if(early&&negative==='bad-difficulty-ack')write(api.OUT,'reply-'+r.command+'.json',{i:r.command,ok:false});
    if(early&&negative==='foreign-difficulty-input')m.observation.inputs.push(
      {type:'keydown',key:' ',trusted:true,target:'screen'},{type:'keyup',key:' ',trusted:true,target:'screen'});
    await require(path.join(integration.RUNS,'20261104-mdk2-measured-escape-original/native-menu.cjs')).select(api.OUT,r,'medium',{spool,maxCommands:113});
    if(early){
      assert.deepEqual(quanta,[16,16,32,16,32]);
      await api.traceDriver.finish('fixture-terminal');
      return {starts,resumes,checkpoints,quanta,failure,report:model.bound.report(),traceEnd};
    }
    assert.deepEqual(quanta,[16,16,32,16],'actual repeated press and release polls');
    if(negative==='historical-review')model.advance(20007);
    if(negative==='review-expired'){
      model.bound.invoke('finish',{reason:'deadline'});
    }
    const common={selection:'none',transitioning:true,loadingVisible:false,comicPanelsVisible:false,tutorialVisible:false,unsupportedSceneVisible:false};
    const fade=await approve('fixture-fade',{...common,screen:'medium-transition',visualTransition:'medium-fade',mediumFadeVisible:true,
      difficultyDialogVisible:false,newGameLabelVisible:false,legalOverlayVisible:false});
    await require(path.join(integration.RUNS,'20261104-mdk2-measured-escape-original/native-menu.cjs')).select(api.OUT,fade,'observe',{spool,maxCommands:113});
    // Actual pending -> absent Level -> published Level -> eight loading chunks.
    m.nativeSelection=structuredClone(original.nativeSelection);
    Object.assign(m.nativeSelection,{freeze:{tag:-1,value:1},showmenu:{tag:-1,value:0}});
    let review=await approve('fixture-pending',{...common,screen:'post-medium-pending',originalScene:'unproved',playableReadiness:false,visualTransition:'medium-fade',constructionBlackVisible:false});
    require(path.join(prior,'phase-gate.cjs')).gate(api.OUT,review,'pending-control','observe-pending');
    await require(path.join(prior,'pending-control.cjs')).control(api.OUT,review,'observe-pending',{spool});
    const loading=JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(path.join(integration.RUNS,
      '20261104-mdk2-measured-escape-original/recovered/browser/comic-control-112.json.gz')))).state.main.nativeSelection;
    m.nativeSelection=structuredClone(loading);m.nativeSelection.scene.lifecycle='absent';m.nativeSelection.scene.levelTag=-6;m.nativeSelection.level=null;
    review=await approve('fixture-absent',{...common,screen:'post-medium-construction',originalScene:'level-destruction-construction',constructionBlackVisible:true});
    require(path.join(prior,'phase-gate.cjs')).gate(api.OUT,review,'construction-control','observe-construction');
    await require(path.join(prior,'construction-control.cjs')).control(api.OUT,review,'observe-construction',{spool});
    m.nativeSelection=structuredClone(loading);
    // Explicit native-state fixture for the controller's other actual branch.
    m.nativeSelection.level=0x610000;m.nativeSelection.file={tag:-2,value:'l1'};
    Object.assign(m.nativeSelection.scene,{lifecycle:'table',levelTag:-3,loadscreen:{tag:-2,value:'loadscreen1'},doscenegraph:{tag:-1,value:1}});
    review=await approve('fixture-published',{...common,screen:'post-medium-construction',originalScene:'level-destruction-construction',constructionBlackVisible:true});
    require(path.join(prior,'phase-gate.cjs')).gate(api.OUT,review,'construction-control','observe-construction');
    await require(path.join(prior,'construction-control.cjs')).control(api.OUT,review,'observe-construction',{spool});
    review=await approve('fixture-loading',{...common,screen:'comic-loading',originalScene:'level1-initial-loading',transitioning:false,loadingVisible:true});
    require(path.join(prior,'phase-gate.cjs')).gate(api.OUT,review,'comic-control','observe-loading');
    await require(path.join(prior,'comic-control.cjs')).control(api.OUT,review,'observe-loading',{spool});
  } catch(error){failure=error;}
  await api.traceDriver.finish('fixture-terminal');
  return {starts,resumes,checkpoints,quanta,failure,report:model.bound.report(),traceEnd};
}
test('continuous early GC producer: actual observe16 NewGame fullrest fresh difficulty Medium fullrest',async()=>{
 const r=await mediumProducer(integration,null,false,true);
 write(EVIDENCE,'early-menu-producer.json',{fixtureOnly:true,...r});
 assert.equal(r.failure,null,r.failure?.stack);assert.equal(r.starts,1);assert.equal(r.resumes,4);assert.equal(r.checkpoints,5);
 assert.deepEqual(r.quanta,[16,16,32,16,32]);assert.equal(r.report.fatal,null);
});
for(const mode of ['unsupported-stack','unsupported-pc','native-not-rest','stale-review','bad-ack','untrusted','extra-queue','foreign-active','changed-history','review-expired','stale-difficulty','bad-difficulty-ack','foreign-difficulty-input'])
 test('continuous early GC producer rejects '+mode+' before dependent execution',async()=>{
  const r=await mediumProducer(integration,mode,false,true);
  write(EVIDENCE,'early-menu-negative-'+mode+'.json',{fixtureOnly:true,...r,failure:r.failure?.message});
  assert(r.failure,mode);
  assert.deepEqual(r.quanta,mode==='untrusted'?[16]:['review-expired','stale-difficulty','bad-difficulty-ack','foreign-difficulty-input'].includes(mode)?[16,16,32]:[]);
  assert(r.starts<=1);
 });
test('actual selector and all loading producers retain one trace over 16/32/64 and eight-chunk branch',async()=>{
  const r=await mediumProducer();assert.equal(r.failure,null,r.failure?.stack);
  assert.equal(r.starts,1);assert.equal(r.checkpoints,r.quanta.length);assert.equal(r.resumes,r.quanta.length-1);
  assert.deepEqual(r.quanta,[16,16,32,16,16,16,16,64,...Array(8).fill(64)]);
  write(EVIDENCE,'whole-producer-protocol.json',{fixtureOnly:true,...r});
});
if(process.env.MDK2_PERSONAL_REHEARSAL==='1')test('personally reviewed complete producer and actual observer rehearsal',async()=>{
  const started=Date.now();await personalView('title');await personalView('menu');
  const r=await mediumProducer(integration,null,true);
  write(EVIDENCE,'personal-complete-producer.json',{fixtureOnly:true,started,finished:Date.now(),...r,
    claim:'Real personal-view delays and actual controllers/driver/owning observer over read-only native-state model; not gameplay'});
  assert.equal(r.failure,null,r.failure?.stack);assert.equal(r.starts,1);assert.equal(r.checkpoints,16);
  assert.equal(r.resumes,15);assert.equal(r.report.fatal,null);
  assert(r.report.observer.blocks>0);assert(r.report.observer.records.length<512);
  assert(Date.now()<r.traceEnd,'complete personal review must fit the single sequence deadline');
});
test('whole producer path rejects untrusted Medium before execution',async()=>{
  const r=await mediumProducer(integration,'untrusted');assert(r.failure);assert.equal(r.quanta.length,0);assert.equal(r.starts,0);
});
for(const mode of ['extra-queue','foreign-active','changed-history'])test('whole producer rejects '+mode+' before first execution',async()=>{
  const r=await mediumProducer(integration,mode);assert(r.failure);assert.equal(r.starts,0);assert.deepEqual(r.quanta,[]);
});
test('whole producer review pause cannot renew its original wall deadline',async()=>{
  const r=await mediumProducer(integration,'review-expired');assert.match(r.failure?.message||'',/continuous trace stopped/);
  assert.deepEqual(r.quanta,[16,16,32,16]);assert.equal(r.starts,1);
});
test('actual whole producer and owning observer: historical 20.007s review fails old and passes fixed window',async()=>{
  const filename=require.resolve('../tools/mdk2-construction-driver-integration.cjs'),old=new Module(filename,module);
  old.filename=filename;old.paths=module.paths;
  old._compile(integration.gitFile('6055aa7e43d7c3505b6796d447663366e3b85146','tools/mdk2-construction-driver-integration.cjs').toString().replace('e886e6d868a6690867113526a66df106b024cedb89f2d5024aaf6cf89568a0ea',integration.sha(fs.readFileSync(require.resolve('../tools/mdk2-lua-construction-observer.cjs')))),filename);
  const before=await mediumProducer(old.exports,'historical-review'),after=await mediumProducer(integration,'historical-review');
  assert(before.failure,'old fixed 10s bound must reject before further execution');
  assert.deepEqual(before.quanta,[16,16,32,16]);assert.equal(before.starts,1);
  assert.equal(after.failure,null,after.failure?.stack);assert.equal(after.starts,1);assert.equal(after.resumes,15);
  assert.equal(after.checkpoints,16);assert.equal(after.report.fatal,null);
  write(EVIDENCE,'whole-producer-historical-before-after.json',{fixtureOnly:true,elapsed:20007,before,after});
});
test('input producer old gap and actual 64-slice contract fail before repaired whole producer passes',async()=>{
  const filename=require.resolve('../tools/mdk2-construction-driver-integration.cjs'),old=new Module(filename,module);
  old.filename=filename;old.paths=module.paths;
  old._compile(integration.gitFile('86dc176a3b25a1eda252d1f4b83a1e30a8bb417b','tools/mdk2-construction-driver-integration.cjs').toString().replace('e886e6d868a6690867113526a66df106b024cedb89f2d5024aaf6cf89568a0ea',integration.sha(fs.readFileSync(require.resolve('../tools/mdk2-lua-construction-observer.cjs')))),filename);
  const r=await mediumProducer(old.exports);
  assert.match(r.failure?.message||'',/trace construction quantum must be 16/);
  assert.equal(r.starts,1);assert.equal(r.checkpoints,1);
  assert.deepEqual(r.quanta,[16,16,32,16,16,16,16]);
  write(EVIDENCE,'whole-producer-old-failure.json',{fixtureOnly:true,...r,failure:r.failure.message});
});
test('actual Python operator -> author -> next routes every dependent review, including cancel input preflight',()=>{
  const dir=fs.mkdtempSync(path.join(EVIDENCE,'python-path-')),sources=integration.controllerSources(dir);
  const code=String.raw`
import sys,json,types,pathlib,hashlib
v=json.load(sys.stdin);E=pathlib.Path(v['dir']);sources=v['sources'];(E/'recovered/browser').mkdir(parents=True,exist_ok=True)
io=types.ModuleType('runtime_io');io.E=E;io.ROOT=v['root'];io.remote=lambda *a:dict(stdout=json.dumps(dict(capture='fixture')))
sys.modules['runtime_io']=io
import subprocess
traffic=[]
def execute(name,args):
 old=sys.argv;sys.argv=[str(E/name),*args]
 try:exec(compile(sources[name],str(E/name),'exec'),dict(__name__='__main__',__file__=str(E/name)))
 finally:sys.argv=old
def run(args,**kw):
 name=pathlib.Path(args[1]).name;traffic.append(args)
 if name in ('author.py','next.py'):execute(name,args[2:])
 return types.SimpleNamespace(returncode=0)
subprocess.run=run
out={}
for mode in ('open','opening','newgame','medium','fade','pending','construction','loading','cancel','post','cinematic'):
 png=b'explicit offline Python routing fixture';h=hashlib.sha256(png).hexdigest()
 (E/'recovered/browser/fixture.png').write_bytes(png)
 (E/'recovered/browser/fixture.json').write_text(json.dumps({'sha256':h,'state':{'main':{'frozen':{'steps':1}}}}))
 review=dict(capture='fixture',sha256=h,steps=1,personallyInspected=True,inspector='offline fixture',screen='fixture',selection='none',reviewMode=mode)
 p=E/'personal.json';p.write_text(json.dumps(review));traffic.clear()
 execute('operator.py',[mode,'fixture',str(p)])
 out[mode]=list(traffic)
print('RESULT '+json.dumps(out))
`;
  const result=cp.spawnSync('python3',['-c',code],{input:JSON.stringify({dir,sources,root:integration.ROOT}),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const routes=JSON.parse(result.stdout.split('\n').find(s=>s.startsWith('RESULT ')).slice(7));
  const expected={medium:['native-menu','medium'],fade:['pending-control','observe-pending'],pending:['pending-control','observe-pending'],
    construction:['construction-control','observe-construction'],loading:['comic-control','observe-loading'],cancel:['comic-control','skip-comic'],
    post:['comic-control','observe-post-cancel'],cinematic:['comic-control','observe-post-cancel']};
  for(const [mode,pair]of Object.entries(expected)){
    const command=routes[mode].find(a=>a[2]==='review');assert.deepEqual(command.slice(-2),pair,mode);
    assert(routes[mode].some(a=>path.basename(a[1])==='author.py'));
    assert(routes[mode].some(a=>path.basename(a[1])==='next.py'));
  }
  assert(routes.cancel.some(a=>a[0]==='node'&&a[1].endsWith('/preflight-input-review.cjs')&&a.at(-1)==='cancel'));
  assert(fs.existsSync(path.join(dir,'input-review-fixture.json')));
  const oldSources={...sources};
  for(const name of ['operator.py','author.py'])oldSources[name]=fs.readFileSync(path.join(integration.RUNS,'20261104-mdk2-measured-escape-original',name),'utf8');
  const old=cp.spawnSync('python3',['-c',code],{input:JSON.stringify({dir,sources:oldSources,root:integration.ROOT}),encoding:'utf8'});
  assert.equal(old.status,1);assert.match(old.stderr,/AssertionError/);
  assert(!old.stdout.includes('RESULT '));
  write(EVIDENCE,'whole-python-review-routing.json',{fixtureOnly:true,routes});
});
test('sealed actual Medium producer timing exceeds ten-second wall budget before first pending continuation',()=>{
  const base=path.join(integration.RUNS,'20261104-mdk2-measured-escape-original');
  const retained=name=>{const p=path.join(base,name);return fs.existsSync(p)?fs.readFileSync(p):require('node:zlib').gunzipSync(fs.readFileSync(p+'.gz'));};
  const seal=JSON.parse(retained('seal.json')),inventoryBytes=retained('remote-recovery-inventory.json');
  assert.equal(integration.sha(inventoryBytes),seal.files.find(r=>r.path==='remote-recovery-inventory.json').sha256);
  const bytes=retained('recovered/browser/commands.jsonl'),pin=JSON.parse(inventoryBytes).find(r=>r.path==='browser/commands.jsonl');
  assert.equal(integration.sha(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);
  const rows=bytes.toString().trim().split('\n').map(JSON.parse),first=rows.find(r=>r.i===91),next=rows.find(r=>r.i===98);
  assert.deepEqual([first.action,first.n,next.action,next.n],['step',16,'step',16]);
  const elapsed=Date.parse(next.at)-Date.parse(first.at);assert.equal(elapsed,20007);assert(elapsed>10000);
  write(EVIDENCE,'sealed-original-review-wall.json',{sourcePath:path.join(base,'recovered/browser/commands.jsonl.gz'),
    sha256:integration.sha(bytes),first,next,elapsed,limit:10000,claim:'Historical interval, not a fresh gameplay observation'});
});
for(const mode of ['expired-review','command-fault'])test('actual composed polling loop normally closes on '+mode,async()=>{
  const {api,source}=actualDriver(),events=[];
  const lo=source.indexOf('  while(!closing&&Date.now()<deadline){'),hi=source.indexOf("  if(!closing)await close('fifteen minute browser bound');",lo);
  assert(lo>0&&hi>lo);
  write(api.OUT,'commands/0.json',{action:'step',n:16});
  const context=vm.createContext({closing:false,deadline:Date.now()+60000,number:0,OUT:api.OUT,halted:false,fs,path,Date,
    traceDriver:{health:async()=>{events.push('health');if(mode==='expired-review')throw Error('fixture observer deadline');},finish:async()=>events.push('finish')},
    log:(name,value)=>events.push({name,value}),save:(name,value)=>events.push({name,value}),
    close:async reason=>{events.push({closed:reason});context.closing=true;},pause:async()=>{throw Error('unexpected idle');},
    command:async()=>{events.push('command');throw Error('fixture native first fault');}});
  await vm.runInContext('(async()=>{'+source.slice(lo,hi)+'})()',context);
  assert.equal(context.halted,true);assert.equal(context.closing,true);
  assert.equal(events.filter(e=>e?.closed).length,1);
  if(mode==='expired-review')assert(!events.includes('command'));
  else {assert(events.includes('finish'));assert(events.some(e=>e.name==='reply-0.json'&&e.value.ok===false));}
});
} else {
  nativeChild().catch(error=>parentPort.postMessage({t:'fixtureFailure',error:error.stack}));
}

async function nativeChild() {
  const {EXE_SHA256,PINS,CUTS,attach}=require('../tools/mdk2-lua-construction-observer.cjs');
  const exe=fs.readFileSync(path.join(integration.ROOT,'test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe'));
  assert.equal(integration.sha(exe),EXE_SHA256);
  const H=integration.sha;
  globalThis.addEventListener=(type,fn)=>{if(type==='message')parentPort.on('message',data=>fn({data}));};
  // The exact worker-specific preload string from the actual CDP seam.
  let preload=workerData.mode.startsWith('control')
    ? fs.readFileSync(path.join(integration.RUNS,'20261104-mdk2-fresh-pending-scene/observe-browser.js'),'utf8')
    : integration.preloadSource({targetId:workerData.targetId,workerURL:workerData.url,moduleHashes:[workerData.wasmHash]});
  if(workerData.mode==='pin-cost-baseline')preload=preload.replace(
    fs.readFileSync(path.join(integration.ROOT,'tools/mdk2-lua-construction-observer.cjs'),'utf8'),
    integration.gitFile('36305d9c09ee1be1a4d86fa3ff9bdf2149253c64','tools/mdk2-lua-construction-observer.cjs').toString());
  if(['measured-old','measured-old-record-stop','measured-old-deadline-stop','mid-poll-old','missing-history-old-binding','continuity-historical-old-review-early'].includes(workerData.mode)){
    // The old failed observer also uses its actual historical fault-containment
    // adapter. The new adapter aborts the faulting slice immediately.
    const source=integration.gitFile(workerData.mode.startsWith('measured-old')?'cd788045394d877eb28cdb9f01c3acc62cc13bb4':workerData.mode==='continuity-historical-old-review-early'?'6055aa7e43d7c3505b6796d447663366e3b85146':'86dc176a3b25a1eda252d1f4b83a1e30a8bb417b','tools/mdk2-construction-driver-integration.cjs').toString();
    preload=preload.replace(integration.installBinding.toString(),source.slice(source.indexOf('function installBinding(options)'),source.indexOf('\nfunction preloadSource')).trim());
  }
  if(workerData.mode==='measured-boundary-stop')preload=preload.replaceAll('50000000','1000');
  if(workerData.mode==='continuous-gc-boundary-limit')preload=preload.replaceAll('50000000','8');
  if(workerData.mode==='continuous-gc-record-limit')preload=preload.replaceAll('maxRecords=512','maxRecords=2');
  if(workerData.mode==='measured-recordbytes-stop')preload=preload.replace('maxRecordBytes=8192','maxRecordBytes=1000');
  if(workerData.mode.endsWith('record-stop'))preload=preload.replaceAll('maxRecords=512','maxRecords=2').replaceAll('records.length >= 512','records.length >= 2');
  if(workerData.mode==='mid-poll-old')preload=preload.replace(
    fs.readFileSync(path.join(integration.ROOT,'tools/mdk2-lua-construction-observer.cjs'),'utf8'),
    integration.gitFile(integration.OBSERVER,'tools/mdk2-lua-construction-observer.cjs').toString());
  if(workerData.mode==='old-early')preload=preload.replace(
    fs.readFileSync(path.join(integration.ROOT,'tools/mdk2-lua-construction-observer.cjs'),'utf8'),
    integration.gitFile('1b1eada7d4885008e51a379142f22391c1fd0e7b','tools/mdk2-lua-construction-observer.cjs').toString());
  vm.runInThisContext(preload);
  if(workerData.mode==='late'){
    assert.throws(()=>vm.runInThisContext(preload),/late|duplicate/);
    parentPort.postMessage({rejected:'late preload'});return;
  }
  const bound=globalThis.__mdk2BoundTrace,hook=WebAssembly.instantiate;
  let captured;
  WebAssembly.instantiate=async function(module,imports,...args){
    if(workerData.mode==='import-failure')imports.host.log_block=()=>{throw Error('original import fixture failure');};
    const result=await Reflect.apply(hook,this,[module,imports,...args]);
    captured={e:(result.instance||result).exports,memory:imports.host.memory,host:imports.host,module};return result;
  };
  // The shipped Worker source is loaded as shipped, without replacing its queue,
  // init handler, native interpreter, imports, or slice dispatch implementation.
  const filename=path.join(integration.ROOT,'lib/guest-worker.js'),entry=new Module(filename,module);
  entry.filename=filename;entry.paths=Module._nodeModulePaths(path.dirname(filename));
  // Reconstruct only required pinned dependencies in memory from Git. Today's
  // checkout is never substituted for the original shipped Worker closure.
  const selected=workerData.acceptedSource?integration.selectedRuntime():integration.pinnedRuntime();
  const sourceCommit=selected.pins.commit;
  const pins=new Map(selected.pins.files.map(r=>[r.path,r]));
  for(const extension of ['.js','.json']){
    const original=Module._extensions[extension];
    Module._extensions[extension]=(m,file)=>{
      const relative=path.relative(integration.ROOT,file),pin=pins.get(relative);
      if(!pin)return original(m,file);
      const bytes=integration.gitFile(sourceCommit,relative);
      assert.equal(bytes.length,pin.bytes);assert.equal(H(bytes),pin.sha256,'original Worker dependency '+relative);
      if(relative==='lib/guest-rpc.js'&&(workerData.mode.includes('rpc-diagnosis-quiet')||workerData.mode.includes('decoder-context')&&!workerData.mode.endsWith('-pinned'))){
        // Read through the actual candidate resolver used by local.start(),
        // including original verification and the explicit amendment manifest.
        const {adapter}=integration.candidateResolver(H(fs.readFileSync(require.resolve('../tools/mdk2-construction-driver-integration.cjs'))));
        const resolver=adapter.createResolver();
        const served=resolver.read(relative);assert.equal(H(served),integration.QUIET_BRIDGE.sha256);
        m._compile(served.toString(),file);return;
      }
      if(extension==='.json')m.exports=JSON.parse(bytes.toString());else m._compile(bytes.toString(),file);
    };
  }
  const source=integration.gitFile(sourceCommit,'lib/guest-worker.js').toString();entry._compile(source,filename);
  const baseline=integration.gitFile(integration.OBSERVER,'test/test-mdk2-lua-construction-observer.js').toString();
  const fixtureBytes=s=>s.slice(s.indexOf('async function fixture(access){'),s.indexOf('if(!isMainThread){'));
  // Keep this exact original fixture independent of the new timer fixtures.
  // Passing it does not qualify a current filesystem/HTTP historical closure.
  assert.equal(H(fixtureBytes(baseline)),'9c5ce247fc627d1ba5734bb80f5c5ab85e28a0cb0682c4c24fc461ed274ee1ec','original qualification fixture changed');
  let fixtureSource=baseline.slice(baseline.indexOf('async function fixture(access){'),baseline.indexOf('  // Diagnostic failures'));
  let checkpoints=0;
  let traceStartedAt=null;
  const realClock=Date.now;let reviewOffset=0;
  Date.now=()=>realClock()+reviewOffset;
    if(workerData.mode.includes('measured'))fixtureSource=fixtureSource.replace(
    '  e.set_esp(stack);u(stack,caller);u(stack+4,entry);', `
  {
  // Actual unchanged decoder at the prior fault PC. Initialized fixture input
  // and caller are explicit; the lost original bitstream/state remain unknown.
  const decoder=entry+0x4000,input=entry+0x5000,output=entry+0x10000,table=entry+0x200000;
  const rows=65536;
  u(decoder+0x10,input);u(decoder+0x14,rows/8);u(decoder+0x18,0);u(decoder+0x1c,0);
  u(decoder+0x24,1);u(decoder+0x28,rows);u(decoder+0x34,output);u(0x5cc408,table+2);
  put(input,Buffer.alloc(rows/8,0xa5));put(table,[17,0,29,0]);
  e.set_esp(stack);u(stack,caller);u(stack+4,decoder);u(stack+8,0);u(stack+12,1);
  e.set_eip(0x47cea0);
  if(workerData.mode.includes('decoder-context')||workerData.mode==='measured-recordbytes-stop'){
    // Small explicit fixture for the owning output/return path, not game state.
    u(decoder+0x20,1);u(decoder+0x4c,output);u(decoder+0x50,4);u(decoder+0x48,0);
    for(let i=0;i<4;i++)u(output+i*4,100+i*20);
    u(stack+8,output+0x100);u(stack+12,8);e.set_eip(0x47d980);
  }
  if(workerData.mode.endsWith('deadline-stop'))reviewOffset=360001;
  const at=performance.now();let slices=0;
  while(e.get_eip()>>>0!==caller && slices++<2000){
    const result=await slice();
    if(!workerData.mode.startsWith('control') && bound.report().terminal)break;
    if(!workerData.mode.startsWith('control') && slices%16===0){
      const end=Date.now()+20000;
      bound.invoke('checkpoint',{commandEnd:end,absoluteEnd:traceStartedAt+360000});
      checkpoints++;
      bound.invoke('resume',{commandEnd:end,absoluteEnd:traceStartedAt+360000});
    }
  }
  if(workerData.mode.endsWith('-stop')){
    const stopped=state(),hash=H(b);await slice();
    assert.deepEqual(state(),stopped,'terminal observer cannot advance native state');assert.equal(H(b),hash);
    parentPort.postMessage({pass:true,terminal:bound.report(),state:stopped,checkpoints});return;
  }
  const returned=e.get_eip()>>>0===caller;
  const report=workerData.mode.startsWith('control')?null:bound.report();
  const result={pass:true,returned,slices,checkpoints,elapsedMs:performance.now()-at,
    blocks:report?.observer.blocks,report,state:state(),memoryHash:H(b),
    outputHash:H(b.subarray(wa(output),wa(output)+rows*4)),
    outputFirst:Array.from(new Uint32Array(memory.buffer,wa(output),16)),
    originalHistory:'Unknown after retained 87000 checkpoint; this is original native decoding with explicit fixture data.'};
  if(workerData.mode.includes('decoder-context'))result.decodedOutput=Array.from(b.subarray(wa(output+0x100),wa(output+0x100)+8));
  if(workerData.mode.includes('rpc-diagnosis')){
    const region=require('../lib/region-map.generated.js').REGIONS.GUEST_BASE;
    result.guestHash=H(b.subarray(region.base,region.end));
  }
  if(returned){
    if(workerData.mode.includes('decoder-context')&&!workerData.mode.startsWith('control')){
      const context=report.observer.records.find(r=>r.kind==='decoder-output')?.decoder;
      const end=report.observer.records.find(r=>r.kind==='decoder-return')?.decoder;
      assert(context&&end,JSON.stringify(report));
      const expected=Array.from(b.subarray(wa(output+0x100),wa(output+0x100)+8));
      // Restore only the captured frame/object/source and actual GPRs. At C8
      // MOV/ADD/SAR recompute flags before any conditional branch; incoming
      // lazy flags are retained evidence, not guessed/set by this replay.
      context.stack.forEach((v,i)=>u(context.registers.esp+i*4,v));
      context.objectWords.forEach((v,i)=>u(context.object+i*4,v));
      put(context.decoded.address,context.decoded.bytes);put(output+0x100,Buffer.alloc(8));
      for(const n of ['esp','ebp','eax','ebx','ecx','edx','esi','edi'])e['set_'+n](context.registers[n]);
      e.set_eip(context.registers.eip);await slice();
      assert.equal(e.get_eip()>>>0,caller);assert.deepEqual(Array.from(b.subarray(wa(output+0x100),wa(output+0x100)+8)),expected);
      const replayState=state();
      for(const name of Object.keys(context.registers))assert.equal(replayState[name],result.state[name],'replayed '+name);
      result.replay={context,end,expected,returned:true,state:replayState};
    }
    if(!workerData.mode.startsWith('control'))bound.invoke('finish',{reason:'measured-return'});
    e.set_trace_esp(0,0,0);put(caller+16,[0x0f,0x0b]);e.invalidate_code_range(caller+16,2);e.set_eip(caller+16);
    let trap;try{await slice();}catch(error){trap=String(error);}assert(trap);result.trap={text:trap,hash:H(b),state:state()};
  }
  parentPort.postMessage(result);return;
  }
  e.set_esp(stack);u(stack,caller);u(stack+4,entry);`);
  if(workerData.mode.endsWith('-early')){
    // Execute the original PUSH/CALL before completion fragments. Only fixture
    // setup repositions between fragments; the observer's load history is never
    // seeded, cleared or reconstructed at any checkpoint.
  fixtureSource=fixtureSource.replace('  e.set_esp(stack);u(stack,caller);u(stack+4,entry);', `
  e.set_esp(stack);e.set_esi(entry);e.set_edi(entry+12);u(0x4b87d4,0);u(0x4b7d14,0);
  if(workerData.mode==='wrong-register-early')e.set_esi(entry+32);
  await run('genuine-demand-entry',CUTS.loadCall,0x44fc40);
  if(workerData.mode==='late-early'){const end=Date.now()+9000;bound.invoke('start',{commandEnd:end,absoluteEnd:end});}
  u(0x4b87d4,entry);u(0x4b7d14,entry);
  e.set_esp(stack);u(stack,caller);u(stack+4,entry);`).replace(
      "await run('demand-load-return',CUTS.loadCall,0x41fcf4);",
      "e.set_esp(stack-4);u(stack-4,entry);await run('demand-load-return',CUTS.loadReturned,0x41fcf4);");
  }
  if(workerData.mode.startsWith('continuity'))fixtureSource=fixtureSource.replace(
    'const slice=()=>new Promise', 'const rawSlice=()=>new Promise').replace(
    "  workerData.port.on('message'", `  const slice=async()=>{
      const value=await rawSlice();
      const before=state(),end=Date.now()+9000;
      const paused=bound.invoke('checkpoint',{commandEnd:end,absoluteEnd:end});
      assert(paused.paused && !paused.terminal,JSON.stringify(paused));
      checkpoints++;
      if(workerData.mode.includes('historical')){
        // Reproduce the sealed actual command interval with an explicit test
        // clock. The old and repaired bindings use the identical retained schedule.
        const offset=[20007,38989,57614,74754,102107,118018][Math.min(checkpoints-1,5)];
        reviewOffset=offset;
      }
      if(workerData.mode==='continuity-deadline')await new Promise(resolve=>setTimeout(resolve,350));
      if(workerData.mode==='continuity-registers')e.set_eax((e.get_eax()+1)>>>0);
      if(workerData.mode==='continuity-paused-boundary')captured.host.log_block(e.get_eip(),e.get_esp());
      const resumed=bound.invoke('resume',{commandEnd:workerData.mode.includes('historical')?Date.now()+9000:end,absoluteEnd:workerData.mode.includes('historical')?Date.now()+200000:end});
      assert(!resumed.fatal,JSON.stringify(resumed));
      assert.deepEqual(state(),before);
      return value;
    };
  workerData.port.on('message'`);
  if(workerData.mode.startsWith('missing-history-'))fixtureSource=fixtureSource.replace(
    'const slice=()=>new Promise','const rawSlice=()=>new Promise').replace(
    "  workerData.port.on('message'", `  const slice=async()=>{await rawSlice();if(workerData.mode==='missing-history-stop'&&bound.report().fatal)throw Error(bound.report().fatal);throw Error('first rejected boundary returned to native producer');};
  workerData.port.on('message'`);
  if(!workerData.mode.startsWith('control'))fixtureSource=fixtureSource.replace('e.set_trace_esp(1,0x400000,0x480000);', `
    if(workerData.mode.startsWith('mid-poll')){
      // Actual frozen main's four leading words, expressed with this fixture's
      // request address. Real original RET/MOV/ADD/RET and queued producer run.
      e.set_eip(0x4515cd);e.set_esp(stack);
      u(0x4b87d0,0);put(entry+30,[1]);
      u(stack,CUTS.pollRead);u(stack+4,10);u(stack+8,0x44fb84);u(stack+12,entry);
      if(workerData.mode==='mid-poll-bad-stack')u(stack+4,11);
    }
    if(workerData.mode==='wrong-thread')e.set_current_thread_id(2);
    if(workerData.mode==='wrong-instance')await WebAssembly.instantiate(captured.module,{host:{}});
    if(workerData.mode==='foreign-module-object')await WebAssembly.instantiate(await WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0])),{host:{}});
    const end=workerData.mode==='deadline'?Date.now()-1:Date.now()+(workerData.mode.includes('historical')?200000:workerData.mode.includes('measured')?360000:workerData.mode==='active-deadline'?20:workerData.mode==='continuity-deadline'?300:9000);
    if(workerData.mode!=='late-early'){traceStartedAt=Date.now();bound.invoke('start',{commandEnd:end,absoluteEnd:end});}
    if(workerData.mode==='continuity-boundary-overflow'){
      bound.report().observer.blocks=49999999;
      e.set_eip(caller);
      for(let k=0;k<50000001 && bound.report().traced;k++)captured.host.log_block(caller,e.get_esp());
      assert.equal(bound.report().observer.status,'boundary-limit');
      throw Error('boundary overflow preserved');
    }
    if(workerData.mode==='continuity-record-overflow'){
      e.set_eip(caller);captured.host.log_block(caller,e.get_esp());
      for(let k=0;k<513;k++){
        bound.invoke('checkpoint',{commandEnd:end,absoluteEnd:end});
        bound.invoke('resume',{commandEnd:end,absoluteEnd:end});
      }
      throw Error('record overflow unexpectedly continued');
    }
    if(workerData.mode==='mid-poll-stale-stack')u(stack+8,0x401800);
    if(workerData.mode==='mid-poll-foreign-request')u(0x4b87d4,entry+32);
    if(workerData.mode==='active-deadline'){await new Promise(resolve=>setTimeout(resolve,40));assert.equal(bound.report().traced,false);throw Error('active deadline observed');}
    if(workerData.mode==='terminal'){bound.invoke('finish');bound.invoke('start',{commandEnd:end,absoluteEnd:end});}
  `);
  fixtureSource=fixtureSource.replace('  e.set_esp(stack);u(stack,caller);u(stack+4,entry);', `
  if(workerData.mode.startsWith('mid-poll')){
    const start=workerData.mode==='mid-poll-wrong-order'?CUTS.pollRead:0x4515cd;
    await run('actual-mid-poll-suffix',start,0x44fb84);
    // Deliver the original caller boundary, then stop; no game is launched.
    await slice();
    if(workerData.mode==='mid-poll-demand-return'){
      // A fully observed poll suffix supplies no demand-call entry. Real queued
      // execution must reject its later demand-return boundary, never invent it.
      e.set_eip(CUTS.loadReturned);await slice();
    }
    const report=bound.invoke('finish',{reason:'fixture-end'});
    const guestRegion=require('../lib/region-map.generated.js').REGIONS.GUEST_BASE;
    parentPort.postMessage({pass:!report.fatal,rejected:report.fatal||undefined,report,segments,memoryHash:H(b),guestHash:H(b.subarray(guestRegion.base,guestRegion.end)),state:state(),workerSource:{path:'lib/guest-worker.js',sha256:H(source)}});return;
  }
  e.set_esp(stack);u(stack,caller);u(stack+4,entry);`);
  fixtureSource=fixtureSource.replace("e.set_eip(start);let steps=0;", "if(workerData.mode.startsWith('missing-history'))start=CUTS.finalizeType10;e.set_eip(start);let steps=0;");
  if(workerData.mode==='gc-prefix-preserve')fixtureSource=fixtureSource.replace(
    "  await run('type10-finalizer',CUTS.finalize,caller);", `
  {
  // Genuine original return boundary with deliberately unobserved entry. No
  // historical stack/GC frame is invented and no game is launched.
  e.set_eip(0x40218c);await slice();
  const first=bound.report();assert.match(first.fatal,/gc return history missing/);
  const stopped=state(),memoryHash=H(b);await slice();
  assert.deepEqual(state(),stopped);assert.equal(H(b),memoryHash);
  const end=Date.now()+9000;assert.throws(()=>bound.invoke('checkpoint',{commandEnd:end,absoluteEnd:end}),/gc return history missing/);
  const report=bound.invoke('report');assert.equal(report.fatal,first.fatal);
  assert.equal(report.observer.blocks,1);assert.equal(report.observer.status,'unsupported-or-unobservable');
  parentPort.postMessage({pass:true,noLaterExecution:true,report,stopped,memoryHash});return;
  }
  await run('type10-finalizer',CUTS.finalize,caller);`);
  const trapStart=baseline.indexOf('  // Original undefined instruction trap parity');
  const trapEnd=baseline.indexOf('  parentPort.postMessage({pass:true,segments,before,trap:',trapStart);
  fixtureSource+="if(workerData.mode.startsWith('control'))e.set_trace_esp(0,0,0);\n";
  fixtureSource+=baseline.slice(trapStart,trapEnd);
  fixtureSource+=`parentPort.postMessage({pass:true,checkpoints,traceStartedAt,segments,before,trap:{text:trap,hash:H(b),state:state()},report:bound?.report()||null,workerSource:{path:'lib/guest-worker.js',sha256:H(source)}});}`;
  const fixture=workerData.mode.includes('continuous-gc')?access=>continuousGCFixture(access(),bound,ms=>{reviewOffset+=ms;}):eval('('+fixtureSource+')');
  workerData.port.once('message',()=>fixture(()=>({...captured,observer:workerData.mode.startsWith('control')?null:{
    get report(){return bound.report().observer},sample(){},finish(){return bound.invoke('finish',{reason:'fixture-end'}).observer}
  }})).catch(error=>{
    const report=bound?.invoke('finish',{reason:'fixture-failure'});
    if(workerData.mode!=='success'){
      const ex=captured?.e;
      const faultState=ex?Object.fromEntries(['eip','esp','ebp','eax','ebx','ecx','edx','esi','edi','flag_op','flag_a','flag_b','flag_res','flag_sign_shift'].map(n=>[n,ex['get_'+n]()>>>0])):null;
      const region=require('../lib/region-map.generated.js').REGIONS.GUEST_BASE;
      parentPort.postMessage({rejected:String(error),report,checkpoints,traceStartedAt,faultState,
        memoryHash:workerData.mode.startsWith('missing-history-')?H(new Uint8Array(captured.memory.buffer)):null,
        guestHash:workerData.mode.startsWith('missing-history-')?H(new Uint8Array(captured.memory.buffer,region.base,region.end-region.base)):null});
    }
    else parentPort.postMessage({t:'fixtureFailure',error:error.stack,report});
  }));
}

// Explicit synthetic Lua heap derived from original initializers444410,
// 446a00,447fd0,448ba0. Every executed instruction is unchanged PE code.
async function continuousGCFixture({e,memory,module},bound,advanceReview) {
 const mode=workerData.mode,control=mode.startsWith('control'),late=mode.startsWith('late');
 const b=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),H=integration.sha;
 const wa=a=>{const w=e.guest_to_wasm(a)>>>0;assert.notEqual(w,0xf0);return w;};
 const u=(a,v)=>dv.setUint32(wa(a),v>>>0,true),put=(a,v)=>b.set(v,wa(a));
 const exe=fs.readFileSync(path.join(integration.ROOT,'test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe'));
 b.set(exe,e.get_staging());assert(e.load_pe(exe.length));e.set_api_log(0);
 const S=0x1800000,luaStack=S+0x1000,buckets=S+0x2000,tags=S+0x3000,str=S+0x5000,list=S+0x5100;
 put(S,Buffer.alloc(0x6000));u(0x4b7ce4,S);u(S,luaStack+12);u(S+4,luaStack);u(S+8,luaStack+0x5f4);u(luaStack,-2);u(luaStack+4,str);
 u(S+0xa8,-5);u(S+0xac,0x444470);u(S+0xcc,str);u(S+0xd4,buckets);u(S+0xd8,tags);u(S+0xdc,14);u(S+0xe0,-6);
 for(let i=0;i<14*18;i++)u(tags+i*12,-6);
 u(S+0xec,150);u(S+0xf0,1);
 // One unmarked interned nil Level global rooted by a real stack TValue.
 // Original root traversal marks it; the real sweep resets that mark at449096.
 // No allocation, freeing callback, Lua execution or collector stub is needed.
 u(str+4,0);u(str+16,-6);u(str+28,5);put(str+32,Buffer.from('Level\0'));
 u(buckets+(76%61)*12,1);u(buckets+(76%61)*12+4,1);u(buckets+(76%61)*12+8,list);u(list,str);
 for(const a of [0x4b87d4,0x4b7d14,0x4b87cc,0x4b87d0,0x5ce08c,0x5ccb48])u(a,0);
 u(0x4b6570,4);e.set_current_thread_id(1);e.set_esp(0x74ff000);e.set_ebx(0);e.set_eip(0x402176);
 if(mode==='continuous-gc-caller'){
  // Negative initial input: wrong collector caller. The full real collector
  // returns to an original RET, then40218c; no matching entry may be invented.
  e.set_eip(0x443070);u(0x74ff000,0x44313b);u(0x74ff004,0x40218c);
 }
 e.set_trace_esp(1,0,0);
 const state=()=>Object.fromEntries(['eip','esp','ebp','eax','ebx','ecx','edx','esi','edi','flag_op','flag_a','flag_b','flag_res','flag_sign_shift','yield_reason','last_run_blocks','last_run_halt'].map(n=>[n,e['get_'+n]()>>>0]));
 let pending;const slice=()=>new Promise((resolve,reject)=>{pending={resolve,reject};parentPort.postMessage({t:'fixtureSliceRequest'});});
 workerData.port.on('message',m=>{if(m.t==='slice'){const p=pending;pending=null;m.message.trapped?p.reject(Error(m.message.trapped)):p.resolve(m.message);}});
 let initialPC=null,traceEnd=null,checkpoints=0,slices=0,lastBlocks=0,lastRecords=0,epochChanged=false,sawMarkedRoot=false;
 if(mode==='continuous-gc-epoch'){
  const attach=globalThis.Mdk2LuaConstructionObserver.attach;
  globalThis.Mdk2LuaConstructionObserver.attach=options=>attach({...options,getEpoch:()=>epochChanged?null:options.getEpoch()});
 }
 async function stoppedProof(){
  const first=structuredClone(bound.report()),stopped=state(),hash=H(b);await slice();
  assert.deepEqual(state(),stopped);assert.equal(H(b),hash);
  assert.deepEqual(bound.invoke('report'),first,'next queued slice preserves the complete first terminal report');
  if(first.fatal)assert.throws(()=>bound.invoke('checkpoint',{commandEnd:Date.now()+60000,absoluteEnd:traceEnd}));
  assert.deepEqual(bound.report().observer,first.observer);assert.equal(bound.report().fatal,first.fatal);
  parentPort.postMessage({pass:true,noLaterExecution:true,initialPC,report:bound.report(),state:stopped,checkpoints,traceEnd});
 }
 const start=()=>{initialPC=e.get_eip()>>>0;const r=bound.invoke('start',{commandEnd:Date.now()+60000,absoluteEnd:Date.now()+360000});traceEnd=r.traceEnd;};
 if(!control&&!late)start();
 while(e.get_eip()>>>0!==0x452450&&slices++<4000){
  if(late&&traceEnd===null&&e.get_eip()>>>0===0x449096)start();
  await slice();
  sawMarkedRoot ||= dv.getUint32(wa(str+4),true)===1;
  if(control)continue;
  const r=bound.report();
  if(r.fatal||r.terminal){
   if(late)assert.match(r.fatal,/gc return history missing/);
   else assert(mode!=='continuous-gc',JSON.stringify(r));
   await stoppedProof();return;
  }
  if(!r.started)continue;
  assert(r.observer.blocks>=lastBlocks&&r.observer.records.length>=lastRecords);lastBlocks=r.observer.blocks;lastRecords=r.observer.records.length;
  assert.equal(r.traceEnd,traceEnd);
  if(!checkpoints&&r.observer.records.some(x=>x.kind==='gc-entry')){
   assert(!r.observer.records.some(x=>x.kind==='gc-return'));
   const before=state(),hash=H(b),end=Date.now()+60000;
   let paused;
   try{paused=bound.invoke('checkpoint',{commandEnd:end,absoluteEnd:traceEnd});}
   catch(error){assert.equal(mode,'continuous-gc-record-limit');await stoppedProof();return;}
   assert(paused.paused);checkpoints++;
   assert.equal(paused.observer.records.filter(x=>x.kind==='gc-entry').length,1);
   assert(!paused.observer.records.some(x=>x.kind==='gc-return'));
   // Fault injection is explicit and limited to negative cases; successful
   // early/late/control paths never change registers or memory after setup.
   if(mode==='continuous-gc-pin')put(0x402187,[0x90]);
   if(mode==='continuous-gc-esp')e.set_esp((e.get_esp()+4)>>>0);
   if(mode==='continuous-gc-epoch')epochChanged=true;
   advanceReview(mode==='continuous-gc-expiry'?360001:20007);
   try{
    if(mode==='continuous-gc-owner')await WebAssembly.instantiate(module,{host:{}});
    const resumed=bound.invoke('resume',{commandEnd:Date.now()+60000,absoluteEnd:traceEnd});assert.equal(resumed.traceEnd,traceEnd);
   }catch(error){assert(['continuous-gc-owner','continuous-gc-esp','continuous-gc-expiry'].includes(mode),String(error));await stoppedProof();return;}
   if(mode==='continuous-gc') {assert.deepEqual(state(),before);assert.equal(H(b),hash);}
  }
 }
 assert.equal(e.get_eip()>>>0,0x452450,'real collector must return through40218c');assert(!late,'late prefix must fail');
 assert(sawMarkedRoot,'original root traversal must mark the initially unmarked string');
 assert.equal(dv.getUint32(wa(str+4),true),0,'original sweep must reset the real root mark');
 const region=require('../lib/region-map.generated.js').REGIONS.GUEST_BASE;
 const report=control?null:structuredClone(bound.invoke('finish',{reason:'fixture-end'}));
 const result={pass:true,fixtureOnly:true,initialPC,traceEnd,checkpoints,slices,state:state(),memoryHash:H(b),guestHash:H(b.subarray(region.base,region.end)),report};
 parentPort.postMessage(result);
}
