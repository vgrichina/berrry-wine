'use strict';
// Whole actual Q3 composition, actual host init and composed generated fixture.
// Transport/Worker/guest calls are inert; only owned Node stdio children run.
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const assert=require('node:assert/strict'), cp=require('node:child_process');
const {once}=require('node:events'), {webcrypto}=require('node:crypto');
const zlib=require('node:zlib');
const startup=require('./q3-startup.cjs'), composition=require('./q3-native-driver-composition.cjs');
const root=path.resolve(__dirname,'..'), base=path.dirname(path.join(root,composition.consumerPath));
const bytes=fs.readFileSync(path.join(root,'build/wine-assembly.wasm'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const plain=x=>x===undefined?null:JSON.parse(JSON.stringify(x));
const composed=composition.compose();
assert(composed.source.includes("},20000);pending.set"),'CDP cap unchanged');
assert.equal(composition.providers['tools/q3-execution-boundary.cjs'],'1858eea7efb8875e44088ffe9f5ea434c3b22915444113204fb51673e4f5ac0d');
assert.equal(composition.providers['tools/native_kernel_custody.py'],'05b7fe42cf7ac09df5f12f0ea073ea066892efb598b64b05fae19a3492c9f32c');
assert(fs.readFileSync(base+'/transport.cjs','utf8').includes('WORK_MS=20000, ACK_MS=2000, CLEANUP_MS=30000'));
// Exercise the production preload's generated.cjs interception itself, without
// running either module or retaining global loader/fs hooks in this test.
{
  const Module=require('node:module'), ext=Module._extensions['.cjs'],append=fs.appendFileSync;
  const argv=process.argv,output=process.env.Q3_EXECUTION_BOUNDARY_OUT;
  try {
    process.argv=[process.execPath,path.join(root,composition.consumerPath)];
    process.env.Q3_EXECUTION_BOUNDARY_OUT=path.join(root,'scratch/runs/20261109-q3-parked-startup-repair-0832/hook.jsonl.gz');
    composition.install();let intercepted;
    Module._extensions['.cjs']({_compile:s=>{intercepted=s;}},path.join(root,composition.fixturePath));
    assert.equal(intercepted,composed.fixtureSource,'actual preload selects parked fixture');
  } finally {
    Module._extensions['.cjs']=ext;fs.appendFileSync=append;process.argv=argv;
    if(output===undefined)delete process.env.Q3_EXECUTION_BOUNDARY_OUT;else process.env.Q3_EXECUTION_BOUNDARY_OUT=output;
  }
}

async function scenario(mode,fixture=false,old=false) {
  const events=[], saved=new Map();let wine,guest,socket,browser,driver,html,fixtureDone;
  const dir=path.join(run,(old?'old-':'')+(fixture?'fixture-':'original-')+mode);fs.mkdirSync(dir);
  const emit=v=>socket.onmessage({data:JSON.stringify(v)});
  const announce=()=>{
    emit({method:'Target.attachedToTarget',params:{sessionId:'owner',targetInfo:{type:'worker',targetId:'owner-target',url:'http://inert/lib/guest-worker.js'}}});
    emit({method:'Debugger.scriptParsed',sessionId:'owner',params:{scriptLanguage:'WebAssembly',url:'wasm://owner',scriptId:'module'}});
    if(mode==='duplicate-module')emit({method:'Debugger.scriptParsed',sessionId:'owner',params:{scriptLanguage:'WebAssembly',url:'wasm://foreign',scriptId:'foreign'}});
  };
  const workerLink=opts=>({ ...opts,worker:{},endpointIdentity:'owning-endpoint',slot:0,
    async start(){guest=this;events.push('Worker.start');announce();await pause(mode==='park-cap'?120:1);if(mode==='unsupported-worker')this.worker=null;},
    async stop(){events.push('worker-retire-start');await pause(12);this._stopping=true;events.push('worker-retired');},
    async callExport(name){
      if(name==='get_staging')return 0;
      events.push('guest:'+name);
      // Stop the inert fixture at its first PE boundary; run/call_func cannot
      // accidentally execute a real guest in this test.
      if(name==='load_pe')throw Error('INERT_PE_BOUNDARY');
      return 0;
    }
  });
  class Guest {
    constructor(opts){Object.assign(this,opts);}
    async start(){this.link=workerLink(this);await this.link.start();guest=this.link;}
    async callExport(){}
    async stop(){await this.link.stop();this._stopped=true;}
  }
  const scope={console:{log(){},warn(){},debug(){}}, URLSearchParams, URL, ArrayBuffer,Uint8Array,Int32Array,DataView,TextDecoder,
    setTimeout,clearTimeout,crypto:webcrypto,crossOriginIsolated:true,WINE_THREADS:true,
    location:{search:'?candidates&no-log&threads'}, document:{getElementById:()=>null,createElement:()=>({}),body:{append(){}}},
    WebAssembly:{...WebAssembly,Module:WebAssembly.Module,Memory:class{constructor(){this.buffer=new ArrayBuffer(65536);}},
      compile:async b=>{events.push('compile');return WebAssembly.compile(b);},
      instantiate:async()=>({exports:{set_lock_atomic_mode(){}}})},
    RenderWorker:{observeInstance:i=>i,Manager:class{constructor(){this.ready=Promise.resolve();}async stop(){events.push('renderer-retired');}}},
    GuestThreadHost:Guest,GuestWorkerLink:class{constructor(opts){return workerLink(opts);}},
    ThreadManager:class{recordInheritedWasmGlobal(){}},runningApps:[],
    createHostImports:()=>({host:{}}),GLRenderHost:{Bridge:class{}},GuestRpc:{createMainBroker:()=>({})},
    fetch:async url=>{
      if(url.includes('host-import-sigs'))return {ok:true,json:async()=>({sigs:{}})};
      if(url.includes('api_table'))return {ok:true,json:async()=>[]};
      if(url.endsWith('calc.exe')) {const p=new Uint8Array(128);new DataView(p.buffer).setUint32(0x3c,0,true);return {arrayBuffer:async()=>p.buffer};}
      assert(url.includes('wine-assembly'));
      const b=Uint8Array.from(bytes);if(mode==='compile-mismatch')b[b.length-1]^=1;
      return {ok:true,arrayBuffer:async()=>b.buffer};
    }};
  scope.window=scope;
  const page=vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(root,'host.js'),'utf8')+'\nglobalThis.WineAssembly=WineAssembly;',page);
  const Wine=scope.WineAssembly;Wine.supportsWasmTailCalls=()=>true;Wine.versionedUrl=x=>x;
  scope.shell={launchApp:async app=>{
    assert.equal(app,'quake3_demo');events.push('shell.launchApp');
    wine=Object.create(Wine.prototype);Object.assign(wine,{_processObject:{exited:false},renderer:{},processId:1,
      ensureUiFontsReady:async()=>{},loadFiles:async()=>{},loadSubstituteFonts:async()=>{},getImports:()=>({host:{}}),
      logToUI(){},_installProcessSendBroker(){},_schedArm:()=>false});
    await wine.init(null);events.push('guest:loadExe');events.push('guest:DllMain');events.push('guest:run');
  }};
  let readCount=0,liveCount=0,mutated=false,clockShift=0;
  const mutate=()=>{
    if(mutated)return;mutated=true;
    if(mode==='owner-revoked'){if(wine)wine._stopped=true;else guest._stopping=true;}
    if(mode==='endpoint-race')guest.endpointIdentity='replacement';
    if(mode==='slot-race')guest.slot=7;
    if(mode==='flags-race')scope.WINE_THREADS=false;
    if(mode==='link-flags-race')guest.d3dimGpu=!guest.d3dimGpu;
    if(mode==='module-race')guest.module={};
    if(mode==='instance-race'&&wine)wine.instance={};
    if(mode==='detached')emit({method:'Target.detachedFromTarget',params:{sessionId:'owner'}});
    if(mode==='cancelled') {
      fs.writeFileSync(dir+'/caller-cancelled.json','{}');
      events.push('cancelled');
    }
    if(mode==='release-cap')clockShift=20000;
  };
  const evaluate=async(expression,session)=>{
    if(session==='owner') {
      if(expression!==startup.WORKER_READ)return null;
      liveCount++;
      return {endpoint:mode==='wrong-owner'?'foreign':guest.endpointIdentity,
        slot:mode==='wrong-slot'?4:guest.slot,instance:mode==='worker-instance-race'&&liveCount>1?'replacement':'actual-instance',
        gpu:mode==='wrong-worker-flags'?!guest.d3dimGpu:!!guest.d3dimGpu};
    }
    if(expression.startsWith('WINE_REDLINE_STARTUP.release('))events.push('release');
    if(mode==='late-arm'&&!scope.WINE_REDLINE_STARTUP)Wine._wasmModulePromise=Promise.resolve();
    return plain(await vm.runInContext(expression,page));
  };
  async function cdp(method,p={},session) {
    events.push(method);
    if(method==='Target.getTargets')return {targetInfos:[{type:'page',targetId:'page'}]};
    if(method==='Target.attachToTarget')return {sessionId:'page'};
    if(method==='Page.navigate') {
      events.push('navigation:'+p.url);
      if(fixture) {
        const module={exports:{}};
        vm.runInNewContext(old?fs.readFileSync(path.join(root,composition.fixturePath),'utf8'):composed.fixtureSource,
          {require,module,__dirname:base,URL});
        module.exports.handle({url:'/generated-readiness?backend=software'},{setHeader(){},end(s){html=s;}});
        // Only the actual fixture's inline source; script dependencies are inert
        // production-interface fixtures above.
        const inline=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
        if(mode==='document-delay') {
          fixtureDone=(async()=>{await pause(70);vm.runInContext(inline,page);await scope.__q3FixtureLaunch;})();
        } else {vm.runInContext(inline,page);fixtureDone=scope.__q3FixtureLaunch;}
      } else if(p.url.includes('app=quake3_demo'))await scope.shell.launchApp('quake3_demo');
      return {};
    }
    if(method==='Runtime.evaluate') {
      try{return {result:{value:await evaluate(p.expression,session)}};}
      catch(e){return {exceptionDetails:{text:String(e)}};}
    }
    if(method==='Debugger.getScriptSource') {
      readCount++;events.push('module-bytecode');
      // The consumer also takes a post-scriptParsed observation. The startup
      // controller's second read is the authentication boundary under test.
      if(readCount>=2)mutate();
      if(mode==='no-bytecode')return {};
      const b=Buffer.from(bytes);if(mode==='live-module-mismatch')b[b.length-1]^=1;
      return {bytecode:b.toString('base64')};
    }
    if(method==='Browser.close'){browser.stdin.end('close\n');return {};}
    return {};
  }
  class Socket extends EventTarget {
    constructor(){super();socket=this;this.readyState=1;queueMicrotask(()=>this.onopen());}
    send(raw){const q=JSON.parse(raw);cdp(q.method,q.params,q.sessionId).then(
      result=>this.onmessage?.({data:JSON.stringify({id:q.id,result})}),
      e=>this.onmessage?.({data:JSON.stringify({id:q.id,error:{message:String(e)}})}));}
    close(){this.readyState=3;}
  }
  const trace={span:async(n,fn)=>fn(),expression:()=>({}),snapshot(){},init(){}};
  const bound={createChain:()=>({})};
  const transport={publish:(p,v)=>{saved.set(path.basename(p),v);fs.writeFileSync(p,JSON.stringify(v));},closed(){}};
  const proc={env:{BROWSER_DEADLINE:String(Date.now()+10000),CASE_TAG:path.relative(base,dir),
    LOCAL_PRODUCTION_FIXTURE:fixture?'1':'',TR2_GENERATED:mode==='unsupported-path'?'1':'',
    Q3_EXECUTION_BOUNDARY_OUT:dir+'/execution.jsonl.gz'},pid:process.pid,exitCode:0};
  // Actual caller owns a real child. Its independent immutable failsafe is
  // armed before endpoint publication and before any fixture startup.
  let actualClose,stdoutEOF=false,stderrEOF=false;
  const spawn=(command,args)=>{
    assert.equal(command,'/usr/bin/google-chrome');
    const profile=args.find(x=>x.startsWith('--user-data-dir=')).slice(16);
    browser=cp.spawn(process.execPath,['-e',`
      const fs=require('fs');const timer=setTimeout(()=>process.exit(9),7000);
      fs.mkdirSync(process.argv[1],{recursive:true});fs.writeFileSync(process.argv[1]+'/DevToolsActivePort','43123\\n/devtools/browser/inert\\n');
      process.stdin.once('data',()=>{process.stdout.write('terminal before EOF\\n');setTimeout(()=>{clearTimeout(timer);process.stdin.destroy();},15)});
    `,profile],{stdio:['pipe','pipe','pipe']});
    browser.stdout.once('end',()=>{stdoutEOF=true;events.push('stdout-EOF');});
    browser.stderr.once('end',()=>{stderrEOF=true;events.push('stderr-EOF');});
    actualClose=once(browser,'close');return browser;
  };
  const fakeFs={...fs,mkdirSync(p,...args){if(path.resolve(p)===dir)return;return fs.mkdirSync(p,...args);},
    readFileSync(p,...args){if(p===base+'/runtime-pins.json')return JSON.stringify({files:[],httpPins:[],commit:'INERT_OFFLINE'});return fs.readFileSync(p,...args);},
    // No game/capture files are written by these startup-only controls.
    appendFileSync(p,data){fs.appendFileSync(p.endsWith('.jsonl')?p+'.gz':p,p.endsWith('.jsonl')?zlib.gzipSync(data):data);}};
  const mockRequire=n=>{
    if(n==='node:fs')return fakeFs;if(n==='node:child_process')return {spawn};
    if(n==='./bound-input.cjs')return bound;if(n==='./transport.cjs')return transport;if(n==='./trace.cjs')return trace;
    if(n==='./readiness.cjs')return {ready:async()=>{
      if(fixture) {await fixtureDone;while(!scope.__generatedError)await pause(1);}
      events.push('startup-next-stage');throw Error('INERT_STOP_AFTER_STARTUP');
    }};
    if(n.endsWith('/test/static-server.js'))return {startStaticServer:async()=>({address:()=>({port:1}),prependListener(){},closeAllConnections(){},close:fn=>fn()})};
    if(n==='./generated.cjs')return {handle(){}}; // actual HTML composed above
    if(n===root+'/tools/q3-startup.cjs'&&['park-cap','release-cap'].includes(mode))return {...startup,launch:options=>startup.launch({
      ...options,deadline:mode==='park-cap'?Date.now()+80:options.deadline,now:()=>Date.now()+clockShift})};
    if(n==='./local-controls.cjs')return {run:async()=>{throw Error('INERT_STOP_AFTER_STARTUP');}};
    return require(n.startsWith('.')?path.resolve(base,n):n);
  };
  // Old control uses the last production composition with just the new startup
  // transformations omitted; all existing transport/close/cap repairs remain.
  let source=composed.source;
  if(old) {
    source=source.replace(/for\(let n=0;n<100;n\+\+\)\{if\(await evaluate\("typeof WineAssembly[^\n]+\n await require\(root\+'\/tools\/q3-startup.cjs'\)\.launch\(\{evaluate,send,workers,pageSession,deadline,wait,save\}\);\n /,'');
    source=source.replace("await require(root+'/tools/q3-startup.cjs').launch({evaluate,send,workers,pageSession,deadline,fixture:true,wait,save});",'');
    source=source.replace("('&gl-renderer='", "(process.env.NO_ORIGINAL?'':'&app='+selectedApp+'&gl-renderer='");
  }
  // Recover the actual async controller promise without changing its body.
  source=source.replace('(async()=>{\n const sampleDisk=', 'globalThis.__callerDone=(async()=>{\n const sampleDisk=');
  driver=vm.createContext({require:mockRequire,__dirname:base,process:proc,console:{log(){},error(){}},Buffer,
    WebSocket:Socket,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,setImmediate,fetch:()=>assert.fail('network refused')});
  const watchdog=setTimeout(()=>{browser?.kill('SIGKILL');},8000);
  let waited;
  try {
    if(mode==='unsupported-path')assert.throws(()=>vm.runInContext(source,driver),/unsupported Q3 startup path/);
    else vm.runInContext(source,driver);
    await driver.__callerDone;
    if(browser){waited=await actualClose;assert(stdoutEOF&&stderrEOF,'separate stdio EOF');assert.equal(waited[0],0);}
    if(fixtureDone&&mode!=='cancelled')await fixtureDone;
    const entries=events.filter(e=>e.startsWith('guest:'));
    if(old){assert(entries.length>0);assert(!events.includes('release'));}
    else if(mode==='positive'||mode==='document-delay') {
      assert(entries.length>0,JSON.stringify([...saved]));assert(saved.has('startup-admission.json'));
      assert(events.indexOf('module-bytecode')<events.indexOf('release'));
      assert(events.indexOf('release')<events.findIndex(e=>e.startsWith('guest:')));
      assert(!events.some(e=>e.includes('navigation:')&&e.includes('app=')));
    } else {
      assert.equal(entries.length,0,mode+' no PE/DLL/CPU');assert(!events.includes('release'),mode+' no release');
      assert(!saved.has('startup-admission.json'));
      if(mode==='unsupported-path')assert(!browser,'unsupported path before spawn');
      else assert(saved.has('startup-refusal.json'),JSON.stringify([...saved]));
      if(events.includes('Worker.start')&&mode!=='cancelled')assert(events.includes('worker-retired'),'actual asynchronous retirement joined');
    }
    if(mode==='cancelled') {
      const terminal=saved.get('first-transport-failure.json'),count=events.length;
      await assert.rejects(vm.runInContext("execute({action:'key',key:'ArrowDown'})",driver),/terminal UNKNOWN/);
      await assert.rejects(vm.runInContext("capture('post-terminal')",driver),/terminal UNKNOWN/);
      assert.equal(events.length,count,'no post-terminal CDP');
      assert.equal(saved.get('first-transport-failure.json'),terminal,'first terminal sticky');
    }
    fs.writeFileSync(dir+'/result.json.gz',zlib.gzipSync(JSON.stringify({mode,fixture,old,events,saved:[...saved],waited,stdoutEOF,stderrEOF,nativeQualified:false,
      cancellationRetirement:mode==='cancelled'?'UNKNOWN; terminal guard permits no further CDP':null})));
    console.log((old?'OLD FAIL':'PASS')+' '+(fixture?'fixture ':'original ')+mode);
  } finally {
    clearTimeout(watchdog);if(browser&&browser.exitCode===null&&browser.signalCode===null)browser.kill('SIGKILL');if(actualClose)await actualClose;
    // Browser destruction would destroy this inert page too. Retire its local
    // VM timer after recording evidence; this is not production CDP or proof.
    if(mode==='cancelled') {
      scope.WINE_REDLINE_STARTUP?.abort('inert VM teardown after evidence');
      if(scope.__q3Launch)await scope.__q3Launch.promise;
      if(fixtureDone)await fixtureDone;
    }
  }
}
const run=path.resolve(process.env.Q3_TEST_RUN||'scratch/runs/20261109-q3-parked-startup-repair-0832/startup-'+Date.now());
fs.mkdirSync(run,{recursive:true});
(async()=>{
  for(const fixture of [false,true]) {
    await scenario('positive',fixture,true);
    for(const mode of ['positive','compile-mismatch','live-module-mismatch','wrong-owner','wrong-slot','wrong-worker-flags',
      'owner-revoked','endpoint-race','slot-race','flags-race','link-flags-race','module-race','worker-instance-race','detached',
      'duplicate-module','no-bytecode','unsupported-worker','cancelled'])await scenario(mode,fixture);
  }
  await scenario('instance-race');await scenario('late-arm');await scenario('unsupported-path');
  await scenario('park-cap');await scenario('release-cap');await scenario('release-cap',true);
  await scenario('document-delay',true);
  console.log('PASS actual production composition: parked prePE/preDLL/preCPU; unchanged native qualification UNKNOWN');
})().catch(e=>{console.error(e);process.exitCode=1;});
