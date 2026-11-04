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
test('candidate resolver explicitly checks both immutable historical resolver and recorded new entry',()=>{
 const hash=integration.sha(fs.readFileSync(require.resolve('../tools/mdk2-construction-driver-integration.cjs')));
 const {adapter,provenance}=integration.candidateResolver(hash);
 assert.equal(typeof adapter.installAdapter,'function');assert.equal(provenance.candidateSHA256,hash);
 assert.equal(provenance.historicalAccepted,'6d5121b5f96ee6032a9e347e2db64db29c478518');
 assert.throws(()=>integration.candidateResolver('0'.repeat(64)),/changed recorded driver candidate/);
});
test('explicit candidate adapter executes actual 432 filesystem and HTTP checks in dedicated process',()=>{
 const code=`const fs=require('node:fs'),i=require('./tools/mdk2-construction-driver-integration.cjs');
 (async()=>{const h=i.sha(fs.readFileSync(require.resolve('./tools/mdk2-construction-driver-integration.cjs')));
 const {adapter,provenance}=i.candidateResolver(h);const runtime=await adapter.installAdapter(adapter.createResolver());
 try{console.log(JSON.stringify({filesystem:runtime.filesystem.length,http:runtime.http.length,provenance}));}finally{runtime.restore();}
 })().catch(e=>{console.error(e.stack);process.exitCode=1});`;
 const result=cp.spawnSync(process.execPath,['-e',code],{cwd:integration.ROOT,encoding:'utf8',timeout:60000});
 assert.equal(result.status,0,result.stderr);const report=JSON.parse(result.stdout);
 assert.equal(report.filesystem,432);assert.equal(report.http,432);
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
  assert.deepEqual(report.limits, {traceMs:10000,boundaries:100000,records:512,constructionSlices:16,restart:false});
  assert.equal(integration.assertRunnable().composedSHA256, report.composedSHA256);
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
  const broker = require('../lib/guest-rpc').createMainBroker(memory,Object.fromEntries(Object.keys(sigs).map(n=>[n,()=>0])),sigs);
  const worker = new Worker(__filename,{workerData:{mode,port:port2,wasmHash:row.sha256,url,targetId},transferList:[port2]});
  let envelope, pendingSlice = 0; const commands=[];
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
  vm.createContext(realm); vm.runInContext(api.preload,realm);
  const module = await realm.WebAssembly.compile(integration.retainedModule(row));
  const pageWorker = new realm.Worker(url);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(Error('native integration timeout')),45000);
    const finish=async(error,value)=>{clearTimeout(timer);await worker.terminate();port1.close();error?reject(error):resolve({value,envelope,page:realm.__mdk2BoundTrace.report()});};
    worker.on('error',error=>mode.startsWith('wrong-')?finish(null,{rejected:String(error)}):finish(error));
    worker.on('message',m=>{
      if(m.t==='ready') port1.postMessage({t:'start'});
      else if(m.t==='rpc') broker.serveRpc(m.slot,m.waitEntry);
      else if(m.t==='call') broker.serveCall(m);
      else if(m.t==='calls') broker.serveCalls(m);
      else if(m.t==='fixtureSliceRequest'){const c={t:'slice',seq:++pendingSlice,steps:1};commands.push(c);worker.postMessage(c);}
      else if(m.t==='sliceDone')port1.postMessage({t:'slice',message:m});
      else if(m.t==='fixtureFailure'||m.t==='error')finish(Error(JSON.stringify(m)));
      else if(m.pass||m.rejected)finish(null,{...m,commands});
    });
    pageWorker.postMessage({t:'init',seq:0,module,memory,sigs,slot:0,endpointIdentity:1});
  });
}

for(const row of integration.pinnedRuntime().pins.moduleFiles) {
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
for(const mode of ['continuity-deadline','continuity-registers','continuity-paused-boundary','continuity-boundary-overflow','wrong-module','wrong-endpoint','wrong-thread','wrong-instance','foreign-module-object','missing-history','import-failure','terminal','deadline','active-deadline','late']) {
  test('real composed Worker lifecycle rejects '+mode+' '+row.path, async()=>{
    const result=await nativeOne(row,mode);
    assert(result.value.rejected,JSON.stringify(result.value));
    if(result.value.report)assert.equal(result.value.report.traced,false);
    if(mode==='continuity-deadline'){
      assert.equal(result.value.checkpoints,1,'expiry occurs inside the retained review pause');
      assert.equal(result.value.report.observer.status,'deadline');
    }
  });
}

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

// Explicit protocol fixtures around the actual composed command functions.
// Sidecars are sealed original readbacks; fake CDP replies are not runtime proof.
for(const mode of ['success','post-quantum-scene','ambiguous','wrong-module','wrong-thread','wrong-target','replacement','missing-history','failure','terminal','deadline','unfrozen','ownership-rejected','changed-frozen','changed-owner','old-terminal','old-skip']) {
  test('actual composed construction command / attachment '+mode,async()=>{
    let candidate=integration;
    if(mode==='old-terminal'||mode==='old-skip'){
      const filename=require.resolve('../tools/mdk2-construction-driver-integration.cjs'),old=new Module(filename,module);
      old.filename=filename;old.paths=module.paths;
      old._compile(integration.gitFile(mode==='old-skip'?'91d6a3a1583b956c1c0de4e41309f8eaaac3f0e1^':'91d6a3a1583b956c1c0de4e41309f8eaaac3f0e1','tools/mdk2-construction-driver-integration.cjs').toString(),filename);
      candidate=old.exports;
    }
    const {api}=actualDriver(candidate);review(api);
    const approval=JSON.parse(fs.readFileSync(path.join(api.OUT,'inspection-approval.json')));
    Object.assign(approval,{screen:'post-medium-construction',originalScene:'level-destruction-construction',selection:'none',constructionBlackVisible:true});
    write(api.OUT,'inspection-approval.json',approval);write(api.OUT,'native-selector-ledger.json',{newgame:true,medium:true});
    const {main,file}=sealedSidecars();main.frozen.steps=3344;file.frozen.steps=3344;
    const url='http://offline/lib/guest-worker.js',sent={kind:'sent',sha256:integration.pinnedRuntime().pins.moduleFiles[0].sha256,
      compilation:0,bytes:2143540,workerURL:url,slot:0,endpointIdentity:1};
    const barrier={frozen:main.frozen,owners:[{handle:null,slot:0,endpointIdentity:1,values:{get_current_thread_id:1,get_eip:main.values.get_eip}},
      {handle:921600,slot:1,endpointIdentity:2,values:{get_current_thread_id:2,get_eip:file.values.get_eip}}]};
    const calls=[];let starts=0,finishes=0,steps=0,checkpoints=0,resumes=0;
    const session={send:async(name,args)=>{
      calls.push(args.expression);
      const r={targetId:mode==='wrong-target'?'foreign':'fixture',workerURL:url,binding:{...sent},thread:mode==='wrong-thread'?2:1,
        fatal:null,traced:false,observer:null};
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
      if(fn.toString().includes('WineFrozen.step')){steps++;return {ran:n,timedOut:false};}
      return {input:{inputQueue:[],activeInput:null,mouseButtonsMask:0},binding:{audit:[sent]},frozen:main.frozen};
    }});
    if(mode==='terminal')await api.traceDriver.finish('fixture-terminal');
    if(['success','post-quantum-scene','changed-frozen','changed-owner','old-terminal','old-skip'].includes(mode)){
      await api.command({action:'step',n:16},1);assert.equal(starts,1);assert.equal(checkpoints,mode.startsWith('old-')?0:1);assert.equal(finishes,mode.startsWith('old-')?1:0);assert.equal(steps,1);
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
        assert.match(secondError?.message||'unobserved continuation admitted',/native construction history ended|changed construction scene|changed frozen state|replacement construction owner|foreign main endpoint/);
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
  assert(sources['native-menu.cjs'].includes('20261104-mdk2-measured-escape-original/native-menu.cjs'));
  for(const [name,source] of Object.entries(sources)){
    if(name.endsWith('.py')){const result=cp.spawnSync('python3',['-c','import ast,sys;ast.parse(sys.stdin.read())'],{input:source,encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
  }
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
  let preload=workerData.mode==='control'
    ? fs.readFileSync(path.join(integration.RUNS,'20261104-mdk2-fresh-pending-scene/observe-browser.js'),'utf8')
    : integration.preloadSource({targetId:workerData.targetId,workerURL:workerData.url});
  if(workerData.mode==='mid-poll-old')preload=preload.replace(
    fs.readFileSync(path.join(integration.ROOT,'tools/mdk2-lua-construction-observer.cjs'),'utf8'),
    integration.gitFile(integration.OBSERVER,'tools/mdk2-lua-construction-observer.cjs').toString());
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
  const pins=new Map(integration.pinnedRuntime().pins.files.map(r=>[r.path,r]));
  for(const extension of ['.js','.json']){
    const original=Module._extensions[extension];
    Module._extensions[extension]=(m,file)=>{
      const relative=path.relative(integration.ROOT,file),pin=pins.get(relative);
      if(!pin)return original(m,file);
      const bytes=integration.gitFile(integration.SOURCE,relative);
      assert.equal(bytes.length,pin.bytes);assert.equal(H(bytes),pin.sha256,'original Worker dependency '+relative);
      if(extension==='.json')m.exports=JSON.parse(bytes.toString());else m._compile(bytes.toString(),file);
    };
  }
  const source=integration.gitFile(integration.SOURCE,'lib/guest-worker.js').toString();entry._compile(source,filename);
  const baseline=integration.gitFile(integration.OBSERVER,'test/test-mdk2-lua-construction-observer.js').toString();
  const current=fs.readFileSync(path.join(integration.ROOT,'test/test-mdk2-lua-construction-observer.js'),'utf8');
  const fixtureBytes=s=>s.slice(s.indexOf('async function fixture(access){'),s.indexOf('if(!isMainThread){'));
  assert.equal(H(fixtureBytes(current)),H(fixtureBytes(baseline)),'accepted qualification fixture changed');
  let fixtureSource=baseline.slice(baseline.indexOf('async function fixture(access){'),baseline.indexOf('  // Diagnostic failures'));
  let checkpoints=0;
  if(workerData.mode.startsWith('continuity'))fixtureSource=fixtureSource.replace(
    'const slice=()=>new Promise', 'const rawSlice=()=>new Promise').replace(
    "  workerData.port.on('message'", `  const slice=async()=>{
      const value=await rawSlice();
      const before=state(),end=Date.now()+9000;
      const paused=bound.invoke('checkpoint',{commandEnd:end,absoluteEnd:end});
      assert(paused.paused && !paused.terminal,JSON.stringify(paused));
      checkpoints++;
      if(workerData.mode==='continuity-deadline')await new Promise(resolve=>setTimeout(resolve,350));
      if(workerData.mode==='continuity-registers')e.set_eax((e.get_eax()+1)>>>0);
      if(workerData.mode==='continuity-paused-boundary')captured.host.log_block(e.get_eip(),e.get_esp());
      const resumed=bound.invoke('resume',{commandEnd:end,absoluteEnd:end});
      assert(!resumed.fatal,JSON.stringify(resumed));
      assert.deepEqual(state(),before);
      return value;
    };
  workerData.port.on('message'`);
  if(workerData.mode!=='control')fixtureSource=fixtureSource.replace('e.set_trace_esp(1,0x400000,0x480000);', `
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
    const end=workerData.mode==='deadline'?Date.now()-1:Date.now()+(workerData.mode==='active-deadline'?20:workerData.mode==='continuity-deadline'?300:9000);
    bound.invoke('start',{commandEnd:end,absoluteEnd:end});
    if(workerData.mode==='continuity-boundary-overflow'){
      e.set_eip(caller);
      for(let k=0;k<100001 && bound.report().traced;k++)captured.host.log_block(caller,e.get_esp());
      assert.equal(bound.report().observer.status,'boundary-limit');
      throw Error('boundary overflow preserved');
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
  fixtureSource=fixtureSource.replace("e.set_eip(start);let steps=0;", "if(workerData.mode==='missing-history')start=CUTS.finalizeType10;e.set_eip(start);let steps=0;");
  const trapStart=baseline.indexOf('  // Original undefined instruction trap parity');
  const trapEnd=baseline.indexOf('  parentPort.postMessage({pass:true,segments,before,trap:',trapStart);
  fixtureSource+="if(workerData.mode==='control')e.set_trace_esp(0,0,0);\n";
  fixtureSource+=baseline.slice(trapStart,trapEnd);
  fixtureSource+=`parentPort.postMessage({pass:true,checkpoints,segments,before,trap:{text:trap,hash:H(b),state:state()},report:bound?.report()||null,workerSource:{path:'lib/guest-worker.js',sha256:H(source)}});}`;
  const fixture=eval('('+fixtureSource+')');
  workerData.port.once('message',()=>fixture(()=>({...captured,observer:workerData.mode==='control'?null:{
    get report(){return bound.report().observer},sample(){},finish(){return bound.invoke('finish',{reason:'fixture-end'}).observer}
  }})).catch(error=>{
    const report=bound?.invoke('finish',{reason:'fixture-failure'});
    if(workerData.mode!=='success')parentPort.postMessage({rejected:String(error),report,checkpoints});
    else parentPort.postMessage({t:'fixtureFailure',error:error.stack,report});
  }));
}
