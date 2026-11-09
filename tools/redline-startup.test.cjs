'use strict';
// Actual composed controller + actual host compile/init/Worker-start methods.
// Every process, transport, Worker and guest entry is inert. Native Module
// compilation is real; these tests cannot qualify Chrome/native input/custody.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const {webcrypto, createHash} = require('node:crypto');
const {EventEmitter} = require('node:events');
const {SELECTED, install} = require('../lib/redline-startup-admission.js');
const startup = require('./redline-startup.cjs');
const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'lib/redline-startup-admission.js'), 'utf8');
const hostSource = fs.readFileSync(path.join(ROOT, 'host.js'), 'utf8');
const callerSource = fs.readFileSync(path.join(__dirname, 'redline-browser-run.cjs'), 'utf8');
const selectedBytes = fs.readFileSync(path.join(ROOT, 'build/wine-assembly.wasm'));
const sha = b => createHash('sha256').update(b).digest('hex');
assert.equal(sha(selectedBytes), SELECTED.sha256);
assert.equal(selectedBytes.length, SELECTED.bytes);
const delay = ms => new Promise(r => setTimeout(r, ms));

function pageFixture(mode, emit, events) {
  let wine, worker, compiles = 0, originalEntries = 0, cleanups = 0;
  const keys=[0,0],counts=[0,0];
  const canvas={focus(){},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:640,height:480})};
  class InertGuest {
    constructor(opts) { Object.assign(this, opts); this.d3dimLazySync = true; }
    async start() {
      events.push('worker-start'); worker = this;
      if (mode === 'worker-failure') throw Error('inert Worker start failure');
      this.link = {module:this.module,worker:{},endpointIdentity:'fixture-endpoint',slot:0};
      emit({method:'Target.attachedToTarget',params:{sessionId:'worker-session',targetInfo:{
        type:'worker',targetId:'worker-target',url:'http://fixture/lib/guest-worker.js'}}});
      emit({method:'Debugger.scriptParsed',sessionId:'worker-session',params:{
        scriptLanguage:'WebAssembly',url:'wasm://fixture',scriptId:'worker-module',hash:'fixture'}});
      if (mode==='duplicate-module') emit({method:'Debugger.scriptParsed',sessionId:'worker-session',params:{
        scriptLanguage:'WebAssembly',url:'wasm://foreign',scriptId:'foreign-module',hash:'foreign'}});
      await delay(1);
      if (mode === 'foreign-module') this.link.module = await WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0]));
      if (mode === 'flag-race') scope.WINE_DRAKAN_OBSERVER=true;
      if (mode === 'missing-worker') this.link.worker=null;
    }
    async callExport() {}
    async loadDlls(){events.push('fixture-loadDlls');}
    async slice(){for(let i=0;i<2;i++)if(keys[i])counts[i]+=128;events.push('fixture-slice');return {};}
    stop() {
      if (!this.stopping) this.stopping = (async () => {
        events.push('cleanup-start'); await delay(15);
        cleanups++; this._stopped = true; events.push('cleanup-joined');
        if (mode === 'cleanup-failure') throw Error('inert retirement failure');
      })();
      return this.stopping;
    }
  }
  const exports = {set_lock_atomic_mode() {},guest_read32:a=>({[0x401450]:keys[0],[0x401454]:keys[1],[0x401458]:counts[0],[0x40145c]:counts[1]})[a]??0};
  const scope = {
    console:{log(){},warn(){}}, URLSearchParams, ArrayBuffer, Uint8Array, TextDecoder,
    setTimeout, clearTimeout, crypto:webcrypto, crossOriginIsolated:true,
    location:{search:'?candidates&no-log&threads'},
    document:{getElementById:id=>id==='screen'?canvas:null},
    Win98Renderer:class {constructor(){this.canvas=canvas;}peekKeyDownState(){return 0;}},
    browserInput:{wireCanvasInput(){}},
    RenderWorker:{observeInstance:i=>i}, GuestThreadHost:InertGuest,
    ThreadManager:class { recordInheritedWasmGlobal() {} },
    WebAssembly:{...WebAssembly, Module:WebAssembly.Module,
      Memory:class {constructor(){this.buffer=new ArrayBuffer(65536);}},
      compile:async bytes=>{ compiles++; events.push('compile');return WebAssembly.compile(bytes); },
      instantiate:async module=>{assert(module instanceof WebAssembly.Module);return {exports};}},
    fetch:async url=>{
      if(url.includes('host-import-sigs')) return {ok:true,json:async()=>({sigs:{}})};
      assert(url.includes('wine-assembly'));
      let bytes = Uint8Array.from(selectedBytes);
      if(mode==='wrong-compile-bytes') bytes[bytes.length-1]^=1;
      return {ok:true,arrayBuffer:async()=>bytes.buffer};
    },
    runningApps:[], apps:{redline_demo:{}},
  };
  scope.window=scope; scope.WINE_THREADS=true;
  const context=vm.createContext(scope);
  vm.runInContext(hostSource+'\nglobalThis.WineAssembly=WineAssembly;',context);
  const Wine=scope.WineAssembly;
  Object.assign(Wine.prototype,{ensureUiFontsReady:async()=>{},loadFiles:async()=>{},loadSubstituteFonts:async()=>{},
    getImports:()=>({host:{}}),logToUI(){},_installProcessSendBroker(){},_schedArm:()=>false,
    async loadExe(){wine=this;events.push('fixture-loadExe');originalEntries++;}});
  Wine.supportsWasmTailCalls=()=>true; Wine.versionedUrl=x=>x;
  if(mode==='source-compile') {
    scope.location.search='?compile-wat';
    scope.watxLauncher={compileDetailed:async()=>({bytes:selectedBytes,layout:{}})};
    Wine._assertSourceBuildLayout=()=>{};
  }
  if(mode==='late-arm')Wine._wasmModulePromise=Promise.resolve();
  if(mode==='flags-conflict')scope.WINE_DRAKAN_OBSERVER=true;
  scope.shell={launchApp:async app=>{
    assert.equal(app,'redline_demo'); events.push('launch-request');
    wine=Object.create(Wine.prototype);
    Object.assign(wine,{_processObject:{exited:false},renderer:{},processId:1,
      ensureUiFontsReady:async()=>{},loadFiles:async()=>{},loadSubstituteFonts:async()=>{},
      getImports:()=>({host:{}}),logToUI(){},_installProcessSendBroker(){},
      _schedArm:()=>false});
    try {
      await wine.init(null);
      events.push('original-loadExe'); originalEntries++;
      events.push('original-loadDlls'); events.push('original-run');
      scope.runningApps.push({name:app,wine});
    } catch(e) { events.push('launch-refused:'+e.message); throw e; }
  }};
  async function evaluate(expression,session) {
    if(session==='worker-session') {
      if(expression===startup.WORKER_READ) {
        if(mode==='wrong-endpoint') return {endpoint:'foreign',slot:0,instance:'instance'};
        if(mode==='wrong-slot') return {endpoint:'fixture-endpoint',slot:1,instance:'instance'};
        if(mode==='owner-race'&&events.includes('bytecode-read')) wine.memory={buffer:new ArrayBuffer(1)};
        return {endpoint:'fixture-endpoint',slot:0,instance:'instance'};
      }
      if(expression===require('../scratch/runs/20261108-redline-car-door-native/bound-input.cjs').WORKER_READ)return {endpointIdentity:'fixture-endpoint',slot:0,instance:'instance'};
      return null;
    }
    if(expression==='exitProof') return [['keydown','Delete'],['keyup','Delete'],['keydown','PageDown'],['keyup','PageDown']].map(([type,key])=>({type,key,trusted:true}));
    if(expression.startsWith('window.exitProof=')) return null;
    if(expression.includes('window.__nativeMouseEvents=')) return null;
    if(expression.includes('globalThis.__inputConsumption')) return null;
    if(expression.includes('return {at:new Date().toISOString(),isolated:')) return {apps:[],owningRenderer:[]};
    if(expression.startsWith('({events:globalThis.__nativeMouseEvents')) return {events:[],locked:false};
    const result=await vm.runInContext(expression,context);
    if(expression==='WINE_REDLINE_STARTUP.status()'&&result.phase==='parked'&&scope.fixtureEntry){assert.deepEqual(JSON.parse(JSON.stringify(scope.fixtureEntry)),{exe:false,dll:false,cpu:false});events.push('fixture-preCPU-preDLLmain');}
    return result===undefined?null:JSON.parse(JSON.stringify(result));
  }
  return {scope,evaluate,keys,get wine(){return wine;},get worker(){return worker;},
    get originalEntries(){return originalEntries;},get cleanups(){return cleanups;},get compiles(){return compiles;}};
}

async function composed(caller,mode='positive',liveRun=null) {
  const events=[],saved=new Map(),pendingEvents=[];
  let socket,driver,page,closed=false;
  const emit=v=>socket?.onmessage?socket.onmessage({data:JSON.stringify(v)}):pendingEvents.push(v);
  page=pageFixture(mode,emit,events);
  async function cdp(method,p={},session) {
    events.push(method);
    if(method==='Target.getTargets')return {targetInfos:[{type:'page',targetId:'page-target'}]};
    if(method==='Target.attachToTarget')return {sessionId:'page-session'};
    if(method==='Page.navigate') {
      events.push('navigate:'+p.url);
      if(p.url.includes('app=redline_demo')) await page.scope.shell.launchApp('redline_demo');
      return {};
    }
    if(method==='Runtime.evaluate') {
      try{return {result:{value:await page.evaluate(p.expression,session)}};}
      catch(e){return {exceptionDetails:{text:String(e)}};}
    }
    if(method==='Debugger.getScriptSource') {
      events.push('bytecode-read');
      if(mode==='no-bytecode')return {};
      const bytes=Buffer.from(selectedBytes);
      if(mode==='wrong-live-bytes'||mode==='cleanup-failure')bytes[bytes.length-1]^=1;
      if(mode==='detached')emit({method:'Target.detachedFromTarget',params:{sessionId:'worker-session'}});
      return {bytecode:bytes.toString('base64')};
    }
    if(method==='Input.dispatchKeyEvent'&&[',','.'].includes(p.key)){
      events.push(p.type+':'+p.key);
      if(mode==='keydown-service-delay'&&p.type==='keyDown')await delay(750);
      page.keys[p.key===','?0:1]=p.type==='keyDown'?128:0;
      events.push('applied-'+p.type+':'+p.key);
      if(mode==='keydown-response-delay'&&p.type==='keyDown')await delay(750);
      if(mode==='keydown-stalled'&&p.type==='keyDown')return new Promise(()=>{});
      if(mode==='release-failure'&&p.type==='keyUp')throw Error('inert keyUp service failure');
    }
    if(method==='Page.captureScreenshot')return {data:Buffer.from('inert-png').toString('base64')};
    if(method==='Browser.close'){closed=true;events.push('browser-closed');if(liveRun){browser.stdin.end('close');if(mode==='close-no-ack')return new Promise(()=>{});}}
    return {};
  }
  class Socket {
    constructor(){socket=this;this.readyState=1;}
    set onopen(fn){queueMicrotask(fn);}
    send(raw) {const q=JSON.parse(raw);cdp(q.method,q.params,q.sessionId).then(
      result=>this.onmessage({data:JSON.stringify({id:q.id,result})}),
      e=>this.onmessage({data:JSON.stringify({id:q.id,error:{message:String(e)}})}));}
    close(){this.readyState=3;}
  }
  const pins={commit:'fixture',files:[{path:'build/wine-assembly.wasm',sha256:SELECTED.sha256,size:SELECTED.bytes}],httpPins:[]};
  for(const p of ['host.js','tools/redline-browser-run.cjs','tools/redline-startup.cjs','lib/redline-startup-admission.js','tools/redline-fixture-shutdown.cjs','tools/redline-chrome-startup.cjs','tools/redline-key-delivery.cjs']) {
    const bytes=fs.readFileSync(path.join(ROOT,p));pins.files.push({path:p,sha256:sha(bytes),size:bytes.length});
  }
  if(liveRun)for(const p of ['tools/redline-native-fixture.cjs','tools/redline-production-fixture.cjs']){const bytes=fs.readFileSync(path.join(ROOT,p));pins.files.push({path:p,sha256:sha(bytes),size:bytes.length});}
  const fakeFs={...fs,existsSync:p=>String(p).endsWith('DevToolsActivePort'),mkdirSync(){},
    openSync:()=>99,appendFileSync(){},rmSync(){},writeFileSync(){},
    readFileSync:(p,...args)=>{
      if(String(p).endsWith('/runtime-pins.json'))return JSON.stringify(pins);
      if(String(p).endsWith('/DevToolsActivePort'))return '1234\n/fixture';
      if(String(p).endsWith('/input-observer.js'))return '';
      return fs.readFileSync(p,...args);
    }};
  const transport={publish:(p,v)=>{
    saved.set(path.basename(p),v);
    if(path.basename(p)==='first-browser-failure.json')events.push('first-terminal-failure');
    if(path.basename(p)==='ready.json')vm.runInContext('closing=true',driver);
  },closed(){events.push('transport-closed');}};
  const bound={createChain:()=>({capture:async()=>{
    assert.equal(page.originalEntries,1);events.push('capture');
    return {png:Buffer.from('inert-png'),capture:{label:'startup'},before:{},after:{}};
  }})};
  const browser=liveRun?cp.spawn(process.execPath,['-e',`process.stdout.write('inert browser ready\\n');process.stderr.write('inert browser stderr\\n');process.stdin.once('data',()=>{process.stdout.end('separate stdout EOF\\n');process.stderr.end('separate stderr EOF\\n');setTimeout(()=>process.exit(0),80)});`],{stdio:['pipe','pipe','pipe']}):new EventEmitter();
  if(liveRun){browser.once('exit',()=>events.push('actual-inert-browser-wait'));browser.stdout.once('end',()=>events.push('inert-browser-stdout-EOF'));browser.stderr.once('end',()=>events.push('inert-browser-stderr-EOF'));}
  if(!liveRun){browser.pid=123;browser.exitCode=0;}
  const server={address:()=>({port:123}),prependListener(){},closeAllConnections(){},close:r=>r()};
  const proc={env:{BROWSER_DEADLINE:String(Date.now()+120000),REDLINE_RUN:liveRun||'/inert-run',...(liveRun?{REDLINE_NATIVE_FIXTURE:'1'}:{})},pid:process.pid,exitCode:0,...(liveRun?{once:(signal,fn)=>process.once(signal,fn)}:{})};
  const liveFs={...fs,writeFileSync:(p,...args)=>{if(/\/module-[a-f0-9]+\.wasm$/.test(String(p)))return;return fs.writeFileSync(p,...args);},existsSync:p=>String(p).endsWith('DevToolsActivePort')||fs.existsSync(p),readFileSync:(p,...args)=>{
    if(String(p).endsWith('/runtime-pins.json'))return JSON.stringify(pins);
    if(String(p).endsWith('/DevToolsActivePort'))return '1234\n/fixture';
    if(String(p).endsWith('/input-observer.js'))return '';
    return fs.readFileSync(p,...args);
  }};
  const mockRequire=n=>{
    if(n==='node:fs')return liveRun?liveFs:fakeFs;
    if(n==='node:child_process')return {spawn:()=>browser};
    // Endpoint publication is a service seam in this guest-admission suite.
    // redline-chrome-startup.test.cjs exercises the actual filesystem/child branch.
    if(n==='./redline-chrome-startup.cjs')return {observeStartup:()=>({}),
      publicationSnapshot:()=>({fixture:true}),
      portPublication:async()=>({debugPort:1234,browserPath:'/fixture'})};
    if(n.endsWith('/bound-input.cjs'))return liveRun?require('../scratch/runs/20261108-redline-car-door-native/bound-input.cjs'):bound;
    if(n.endsWith('/transport.cjs')){if(!liveRun)return transport;const real=require('../scratch/runs/20261108-redline-car-door-native/transport.cjs');return {...real,publish:(p,v)=>{if(path.basename(p)==='first-browser-failure.json')events.push('first-terminal-failure');return real.publish(p,v);}};}
    if(n.endsWith('/ordinary-keys.cjs'))return liveRun?require('../scratch/runs/20261108-redline-car-door-native/ordinary-keys.cjs'):{hold:async()=>{}};
    if(n.endsWith('/test/static-server.js'))return {startStaticServer:async()=>server};
    if(n==='./redline-production-fixture.cjs'||n==='./redline-fixture-shutdown.cjs')return require(n);
    return require(n);
  };
  driver=vm.createContext({require:mockRequire,__dirname:path.join(ROOT,'tools'),
    process:proc,console:{log(){},error(){}},Buffer,WebSocket:Socket,fetch:()=>assert.fail('no external fetch'),
    setTimeout:(fn,ms)=>setTimeout(fn,ms===15000?0:ms),clearTimeout});
  // Await the actual top-level controller's promise, including its real catch.
  await vm.runInContext(caller,driver);
  for(const v of pendingEvents)emit(v);
  // Successful fixture stops after first capture; real ordinary shutdown is
  // exercised too, without allocating a browser or issuing a game command.
  if(!closed)await vm.runInContext("closing=false;close('inert fixture complete')",driver);
  if(liveRun&&proc.exitCode){const before=events.length;await assert.rejects(vm.runInContext("send('Input.dispatchKeyEvent',{type:'keyDown',key:','},pageSession)",driver));await assert.rejects(vm.runInContext("capture('after-terminal')",driver));assert.equal(events.length,before,'terminal probes issue zero CDP');}
  if(liveRun)fs.writeFileSync(path.join(liveRun,'inert-events.json'),JSON.stringify({events,exitCode:proc.exitCode,inertKeys:page.keys,nativeQualified:false},null,2));
  return {events,saved,page,closed,exitCode:proc.exitCode,
    probe:expression=>vm.runInContext(expression,driver)};
}

function retainedCaller() {
  const patch=fs.readFileSync(path.join(ROOT,
    'scratch/runs/20261108-redline-car-door-native/owned-run-inputs.patch'),'utf8');
  const section=patch.split('diff --git ').find(s=>s.startsWith('a/scratch/runs/20261108-redline-car-door-native/browser-run.cjs '));
  assert(section,'retained real caller recovery section');
  return section.split('\n').filter(s=>s.startsWith('+')&&!s.startsWith('+++')).map(s=>s.slice(1)).join('\n')
    .replace("const run=__dirname,root=path.resolve(run,'../../..'),", "const run='/inert-run',root="+JSON.stringify(ROOT)+",")
    .replaceAll("require('./", "require('/inert-run/");
}

async function suite(){
  const results=[];
  const old=await composed(retainedCaller());
  assert.equal(old.page.originalEntries,1);
  assert(old.events.some(e=>e.includes('navigate:')&&e.includes('app=redline_demo')));
  assert(!old.saved.has('startup-admission.json'));
  const originalNavigation=old.events.findIndex(e=>e.startsWith('navigate:')&&e.includes('app=redline_demo'));
  assert(!old.events.slice(0,originalNavigation).includes('Debugger.getScriptSource'));
  assert(!old.events.slice(0,originalNavigation).includes('Page.addScriptToEvaluateOnNewDocument'));
  results.push({scenario:'old',qualification:'FAIL',events:old.events,
    originalEntries:old.page.originalEntries,preNavigationLiveReads:0,preNavigationFlagInstallations:0});
  console.log('OLD FAIL: actual recovered caller enters original without installed admission');
  const ok=await composed(callerSource);
  assert.equal(ok.exitCode,0,JSON.stringify([...ok.saved]));assert.equal(ok.page.originalEntries,1);
  assert(ok.saved.has('startup-admission.json'));
  assert(!ok.events.some(e=>e.startsWith('navigate:')&&e.includes('app=redline_demo')));
  assert(ok.events.indexOf('bytecode-read')<ok.events.indexOf('original-loadExe'));
  assert(ok.events.indexOf('compile')<ok.events.indexOf('launch-request'));
  results.push({scenario:'new',qualification:'PASS',events:ok.events,
    originalEntries:ok.page.originalEntries,admission:ok.saved.get('startup-admission.json')});
  console.log('NEW PASS: actual tracked caller compile -> parked live Worker authentication -> original entry');
  // Run the whole pre-repair tracked caller against the same failing startup.
  // Its catch publishes the terminal error, then close() reads guest trace state.
  const terminalBaseline=cp.execFileSync('git',['show',
    '2cc66eccbab3709cebe10014733ccbe34ee8cb69:tools/redline-browser-run.cjs'],{cwd:ROOT,encoding:'utf8'});
  const beforeTerminal=await composed(terminalBaseline,'wrong-live-bytes');
  const afterTerminal=await composed(callerSource,'wrong-live-bytes');
  const afterFailure=r=>r.events.slice(r.events.indexOf('first-terminal-failure')+1);
  assert(beforeTerminal.events.includes('first-terminal-failure'));
  assert(afterFailure(beforeTerminal).includes('Runtime.evaluate'),'old actual caller reads guest after terminal');
  assert(afterTerminal.events.includes('first-terminal-failure'));
  assert(!afterFailure(afterTerminal).some(e=>e==='Runtime.evaluate'||e==='Page.captureScreenshot'||e.startsWith('Input.')),
    'terminal caller issues only independent cleanup');
  assert(afterFailure(afterTerminal).includes('Browser.close'));
  const terminalEvents=afterTerminal.events.length;
  await assert.rejects(afterTerminal.probe("send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowUp'},pageSession)"),/runtime terminal/);
  await assert.rejects(afterTerminal.probe("capture('after-terminal')"),/runtime terminal/);
  assert.equal(afterTerminal.events.length,terminalEvents,'terminal input/capture perform zero CDP calls');
  results.push({scenario:'terminal-boundary',qualification:'PASS',oldFAIL:true,
    oldAfterFailure:afterFailure(beforeTerminal),newAfterFailure:afterFailure(afterTerminal)});
  console.log('PASS old FAIL/new PASS whole caller: no guest read/input/capture after first terminal failure');
  for(const mode of ['wrong-compile-bytes','wrong-live-bytes','no-bytecode','wrong-endpoint',
    'owner-race','foreign-module','worker-failure','detached','cleanup-failure',
    'duplicate-module','wrong-slot','flag-race','missing-worker','late-arm','flags-conflict']) {
    const r=await composed(callerSource,mode);
    assert.equal(r.page.originalEntries,0,mode);assert.equal(r.exitCode,1,mode);
    assert(r.closed,mode);assert(r.saved.has('first-browser-failure.json'),mode);
    if(r.page.worker) {
      assert.equal(r.page.cleanups,1,mode);
      assert(r.events.indexOf('cleanup-joined')<r.events.indexOf('browser-closed'),mode+' cleanup before close');
    }
    results.push({scenario:mode,qualification:'PASS',events:r.events,
      originalEntries:r.page.originalEntries,cleanups:r.page.cleanups,
      refusal:r.saved.get('startup-refusal.json')});
    console.log('PASS terminal refusal, zero original entry, owned cleanup: '+mode);
  }
  const sourceCompile=await composed(callerSource,'source-compile');
  assert.equal(sourceCompile.exitCode,0);assert.equal(sourceCompile.page.originalEntries,1);
  console.log('PASS actual host source compile admission');
  // Direct supported-API controls, using real selected bytes and Module objects.
  for(const mode of ['late-arm','wrong-hash','deadline','release-mismatch','owner-replacement','reused-release']) {
    const scope={crypto:webcrypto,WINE_THREADS:true,crossOriginIsolated:true};
    const Wine={};
    if(mode==='late-arm')Wine._wasmModulePromise=Promise.resolve();
    if(mode==='late-arm'){assert.throws(()=>install({scope,WineAssembly:Wine,deadline:Date.now()+1000}),/before compilation/);continue;}
    const api=install({scope,WineAssembly:Wine,deadline:Date.now()+(mode==='deadline'?100:10000)});
    if(mode==='wrong-hash'){await assert.rejects(api.compile(new Uint8Array([0,97,115,109,1,0,0,0])),/module mismatch/);continue;}
    const module=await api.compile(selectedBytes);
    const link={module,worker:{},endpointIdentity:'e',slot:0};
    const wine={_wasmModule:module,instance:{},memory:{},guestWorker:{module,link}};
    const parked=api.park(wine);const observed=parked.catch(e=>e);
    const proof={...api.status(),sha256:SELECTED.sha256,bytes:SELECTED.bytes,workerTarget:'t',workerInstance:'i'};
    if(mode==='deadline'){await observed;assert.equal(api.status().phase,'refused');}
    if(mode==='release-mismatch'){proof.token='wrong';assert.throws(()=>api.release(proof),/proof mismatch/);await observed;}
    if(mode==='owner-replacement'){link.worker={};assert.throws(()=>api.release(proof),/owner changed/);await observed;}
    if(mode==='reused-release'){api.release(proof);await parked;assert.throws(()=>api.release(proof),/one parked release/);}
    console.log('PASS supported barrier control: '+mode);
  }
  {
    const scope={crypto:webcrypto,WINE_THREADS:true,crossOriginIsolated:true};
    const api=install({scope,WineAssembly:{},deadline:Date.now()+10000});
    const storage=new Uint8Array(selectedBytes.length+16),view=storage.subarray(8,-8);
    view.set(selectedBytes);const compilation=api.compile(view);view.fill(0);
    assert(await compilation instanceof WebAssembly.Module);
    assert.equal(api.status().phase,'compiled');
    api.abort('unit fixture finished');
    console.log('PASS private offset snapshot survives caller mutation');
  }
  if(process.env.REDLINE_STARTUP_RESULT)fs.writeFileSync(process.env.REDLINE_STARTUP_RESULT,
    JSON.stringify({passed:true,selected:SELECTED,nativeQualified:false,scenarios:results},null,2));
  console.log('PASS offline composition only; no native/custody/input qualification');
  await productionFixtureSuite();
}
async function productionFixtureSuite(modes=['old-caller','positive','close-no-ack','wrong-live-bytes']){
  const base=process.env.REDLINE_PRODUCTION_TEST_RUN||path.join(ROOT,'scratch/runs/20261109-redline-production-fixture-repair-0832/controls');
  fs.mkdirSync(base,{recursive:true});
  const wrapper=fs.readFileSync(path.join(__dirname,'redline-native-fixture.cjs'),'utf8'),rows=[];
  for(const mode of modes){
    const dir=fs.mkdtempSync(path.join(base,mode+'-'));
    const childEnv={...process.env,REDLINE_RUN:dir,BROWSER_DEADLINE:String(Date.now()+120000),INERT_MODE:mode};
    const mockRequire=n=>{
      if(n==='node:child_process')return {...cp,spawn:(bin,args,opts)=>args[0]===path.join(__dirname,'redline-browser-run.cjs')?
        cp.spawn(process.execPath,[__filename,'--fixture-runner'],{...opts,env:{...opts.env,INERT_MODE:mode}}):cp.spawn(bin,args,opts)};
      if(n.endsWith('/transport.cjs'))return require('../scratch/runs/20261108-redline-car-door-native/transport.cjs');
      return require(n);
    };
    const proc={env:childEnv,execPath:process.execPath,pid:process.pid,exitCode:0};
    const context=vm.createContext({require:mockRequire,__dirname,process:proc,console,Buffer,setTimeout,clearTimeout});
    await vm.runInContext(wrapper,context);
    const joins=JSON.parse(fs.readFileSync(path.join(dir,'fixture-process-joins.json')));
    assert(joins.callerStdoutEOF&&joins.callerStderrEOF&&joins.watchdogStdoutEOF&&joins.watchdogStderrEOF);
    assert.equal(joins.watchdog.code,mode==='old-caller'?1:0,'prearmed independent watchdog joined; missing shutdown receipt requires group containment');
    for(const label of ['caller','watchdog'])for(const stream of ['stdout','stderr'])require('node:zlib').gunzipSync(fs.readFileSync(path.join(dir,'fixture-'+label+'-'+stream+'.gz')));
    const report=JSON.parse(fs.readFileSync(path.join(dir,'inert-events.json'))),events=report.events;
    const good=['positive','close-no-ack'].includes(mode);
    assert.equal(proc.exitCode,good?0:1);
    if(good){
      for(let i=0;i<3;i++){const ack=JSON.parse(fs.readFileSync(path.join(dir,'native-fixture/reply-'+i+'.json')));assert(ack.ok);assert.equal(ack.id,['comma','period','quit'][i]);}
      assert(events.includes('fixture-preCPU-preDLLmain'));
      assert(events.indexOf('bytecode-read')<events.indexOf('fixture-loadExe'));
      assert(events.indexOf('bytecode-read')<events.indexOf('fixture-loadDlls'));
      const shutdown=JSON.parse(fs.readFileSync(path.join(dir,'native-fixture/shutdown.json')));assert(shutdown.streamEOF);assert.equal(shutdown.actualBrowserExit.code,0);assert(!shutdown.terminal);
      assert(events.includes('actual-inert-browser-wait')&&events.includes('inert-browser-stdout-EOF')&&events.includes('inert-browser-stderr-EOF'),'actual exit and both EOF independently observed');
      assert(require('node:zlib').gunzipSync(fs.readFileSync(path.join(dir,'native-fixture/chrome-stdout.gz'))).includes(Buffer.from('separate stdout EOF')));
      assert(events.filter(e=>e==='Page.captureScreenshot').length===3);
    }else if(mode==='wrong-live-bytes'){
      assert(!events.includes('fixture-loadExe'));assert(!events.includes('fixture-slice'));
      assert(events.includes('cleanup-joined'));assert(events.indexOf('cleanup-joined')<events.indexOf('browser-closed'));
      assert(events.includes('first-terminal-failure'));const tail=events.slice(events.indexOf('first-terminal-failure')+1);assert(!tail.some(e=>e==='Runtime.evaluate'||e==='Page.captureScreenshot'||e.startsWith('Input.')));
    }else if(mode.includes('keydown-')||mode==='release-failure'){
      assert(events.includes('fixture-preCPU-preDLLmain'));
      assert(events.includes('first-terminal-failure'));
      const tail=events.slice(events.indexOf('first-terminal-failure')+1);
      assert(!tail.some(e=>e==='Runtime.evaluate'||e==='Page.captureScreenshot'||e.startsWith('Input.')));
      assert.equal(events.filter(e=>e==='keyDown:,').length,1);
      assert.equal(events.filter(e=>e==='keyUp:,').length,1,'independent single release');
      assert(!events.includes('keyDown:.'),'no next command/retry');
      assert.equal(events.filter(e=>e==='Page.captureScreenshot').length,1,'startup only');
      if(mode.endsWith('response-delay')){
        assert(events.indexOf('applied-keyDown:,')<events.indexOf('applied-keyUp:,'));
        assert.equal(report.inertKeys[0],0,'down was applied before its delayed reply; release cleared it');
      }
      if(mode==='keydown-service-delay'){
        assert(events.indexOf('applied-keyDown:,')>events.indexOf('applied-keyUp:,'));
        assert.equal(report.inertKeys[0],128,'inert late service can apply down after release; cleanup only');
      }
      assert(!fs.existsSync(path.join(dir,'native-qualification.json')));
      assert(!fs.existsSync(path.join(dir,'native-fixture/input-comma-hold.json')),'no successful hold receipt');
      const proof=path.join(dir,'native-fixture/input-comma-delivery.json');
      if(mode.startsWith('old-'))assert(!fs.existsSync(proof),'old caller loses holdReceipt');
      else {
        const report=JSON.parse(fs.readFileSync(proof));assert.equal(report.ok,false);
        assert.equal(report.holdMs,600);assert.equal(report.events.length,2);
        assert(report.receipt);assert.deepEqual(report.receipt.attempted,[',']);
        if(mode.startsWith('keydown-')){
          assert.equal(report.receipt.samples.length,0,'no fabricated held read');
          const [down,up]=report.events;
          assert(up.dispatch.elapsedMs>=550&&up.dispatch.elapsedMs<1000,'release remains on independent 600 ms timer');
          assert(down.response.elapsedMs>up.dispatch.elapsedMs,'late response follows release dispatch');
          if(mode==='keydown-stalled'){
            assert(report.error.includes('runtime closed; no replay'));
            const first=JSON.parse(fs.readFileSync(path.join(dir,'native-fixture/first-browser-failure.json')));
            assert(first.error.includes('command work deadline; never resend'),'existing work cap wins before the later CDP timeout');
          }else assert(report.error.includes('input delivery exceeded hold bound'));
        }else assert(report.events[1].response.error.includes('inert keyUp service failure'));
      }
      assert(events.includes('actual-inert-browser-wait')&&events.includes('inert-browser-stdout-EOF')&&events.includes('inert-browser-stderr-EOF'));
    }else{assert(!events.includes('fixture-preCPU-preDLLmain'));assert(!events.includes('fixture-loadExe'));}
    rows.push({mode,passed:true,oldFAIL:mode==='old-caller',nativeQualified:false,joins,dir});
    console.log('PASS actual production fixture composition: '+mode);
  }
  fs.writeFileSync(path.join(base,'results.json'),JSON.stringify({passed:true,nativeQualified:false,rows},null,2));
}
if(process.argv[2]==='--fixture-runner')composed(process.env.INERT_MODE==='old-caller'?cp.execFileSync('git',['show','2045a98ee7695bd031392dc16965be2eaed0882c:tools/redline-browser-run.cjs'],{cwd:ROOT,encoding:'utf8'}):process.env.INERT_MODE?.startsWith('old-')?cp.execFileSync('git',['show','045c3905f9c050a790914ca201c0575cdcdefd38:tools/redline-browser-run.cjs'],{cwd:ROOT,encoding:'utf8'}):callerSource,(process.env.INERT_MODE||'positive').replace(/^old-keydown-/,'keydown-'),process.env.REDLINE_RUN).then(r=>{process.exitCode=r.exitCode;}).catch(e=>{console.error(e);process.exitCode=1;});
else if(require.main===module)suite().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={productionFixtureSuite};
