'use strict';

// Offline source composition and explicit preload for the retained Q3 consumer.
// Launch with --require this file BEFORE --require q3-execution-boundary.cjs,
// Q3_NATIVE_COMPOSITION=1 and Q3_EXECUTION_BOUNDARY_OUT=<unique>.jsonl.gz.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const Module = require('node:module');
const assert = require('node:assert/strict');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const consumerPath = 'scratch/runs/20261108-q3-gl-readiness-gameplay/browser-run.cjs';
const adapterPath = 'scratch/runs/20261108-q3-instrumented-webgl-gameplay-2248/adapter.cjs';
const fixturePath = 'scratch/runs/20261108-q3-gl-readiness-gameplay/generated.cjs';
const providers = Object.freeze({
  'tools/q3-fixture-input.cjs': '3136d15840a90e1eb601979b89f92b2bbfa592d32c310528686d4db1cf8689f1',
  'lib/renderer-input.js': '10c34564b422f7fc2669153b3662a658ea70271c87fb5a9d9213c0f1a297f21d',
  'tools/q3-input-delivery.cjs': 'b0106da3fa7b2b806fe5c56d9aab940c5d9e235c1d3144195f8248db7af3a7c7',
  [fixturePath]: 'fb46f1b5f4aa6ad4f4c8874af4a1b507986dd8248f5abee086e09c2c061e89ec',
  'test/binaries/calc.exe': 'cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b',
  'tools/q3-startup.cjs': 'b3c419924809e4e27a5f4119a0d401c81dff01f1f98538e68a5ce0b74ac11b1c',
  'lib/redline-startup-admission.js': 'afcb3bae5807a0b08e8d49262af33c1c64ecfa601717173b630658198de185e2',
  [consumerPath]: '689b05aed1724c2998131818a558dfc2d4e87605df579b97ce2ae3c598883416',
  [adapterPath]: '84c8419f7848fabc8f2c75a7949c6aa6d61a730cb72e71c5e3436f786ce3ac2a',
  'tools/supertux-native-lifecycle.cjs': '56536226dfd28666b50b902df26005f25641718aa9a398daff65aefdcb3e9d06',
  'tools/native-browser-close.cjs': '1f4fe08b501ed27c90f4256e85574a788e7dd8adff60638f2c69d6a3ca2ea9b2',
  'tools/native-devtools-ready.cjs': '9ba9ae8b94ebd8a134045608074403d81f68d3cfdf6c0e3f9dbcb875e0632c1b',
  'tools/q3-execution-boundary.cjs': '1858eea7efb8875e44088ffe9f5ea434c3b22915444113204fb51673e4f5ac0d',
  'tools/q3-screenshot-completion.cjs': 'b0d8efd89e061d06b8ceb014e3eae7a3c42809f9360c47d86bfd6c61c25d85f9',
  'tools/native-command-log.cjs': '979b3a8bbd8625ef6bffb009650778736e20ade2d781918b83f59d9944c88f5e',
  'tools/q3-native-launch-client.py': 'd3b9927b17372e74ef0abc8f43b59e709b1822d4927d7793c0153b07cda6509d',
  'scratch/runs/20261108-q3-gl-readiness-gameplay/transport.cjs': '54d7576d40df790ecf72153e289b25c6235b4e92b3f8b7332e480637bf07a9e8',
  'scratch/runs/20261108-q3-gl-readiness-gameplay/trace.cjs': '6f440f2d1bdd9e02598a768ad041681ae1969245e9512939dff24a3970bb8b86',
  'scratch/runs/20261108-q3-gl-readiness-gameplay/bound-input.cjs': '175033bc07bda95dd2d618511729d901908d60a9e8ec970cdbc8d7e2d61dcd70',
  'scratch/runs/20261108-q3-gl-readiness-gameplay/producer-ready.cjs': 'e400a370c681974dd3b9cce294ac8853e9779d8922e15f8063b23e5ed84dc5e8',
  'tools/native_kernel_custody.py': '05b7fe42cf7ac09df5f12f0ea073ea066892efb598b64b05fae19a3492c9f32c'
});
function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, 'missing/nonunique Q3 integration: ' + before.slice(0, 70));
  return source.replace(before, after);
}
function compose({root = path.resolve(__dirname, '..')} = {}) {
  root = path.resolve(root);
  const references = Object.entries(providers).map(([file, hash]) => {
    const bytes = fs.readFileSync(path.join(root, file));
    assert.equal(sha(bytes), hash, 'Q3 provider changed: ' + file);
    return {path:file, sha256:hash, size:bytes.length};
  });
  // Execute the owning adapter's exact transform in isolation. It may neither
  // install global hooks nor write back into the historical evidence directory.
  const extensions = {...Module._extensions};
  const localFs = {...fs, writeFileSync() {}};
  vm.runInNewContext(fs.readFileSync(path.join(root, adapterPath), 'utf8'), {
    __dirname:path.dirname(path.join(root, adapterPath)),
    process:{cwd:() => root}, Buffer,
    require(name) {
      if (name === 'node:fs') return localFs;
      if (name === 'node:module') return {_extensions:extensions};
      return require(name);
    }
  }, {filename:path.join(root, adapterPath)});
  let source;
  extensions['.cjs']({_compile(s) { source = s; }}, path.join(root, consumerPath));
  assert.equal(typeof source, 'string');
  const retainedSource = source;
  source = replaceOnce(source, "const bound=require('./bound-input.cjs'),trace=", "const bound={...require('./bound-input.cjs'),hold:options=>require('./bound-input.cjs').hold({...options,onFailure:error=>observeTerminal(error)})},trace=");
  source = replaceOnce(source, "bound.hold({send,session:pageSession,keys:", "bound.hold({send,saveReceipt:value=>save('input-'+c.id+'-delivery.json',value),session:pageSession,keys:");
  source = replaceOnce(source, 'return chain.progress(receipt.live.identity)', "return chain.progress(receipt.live.identity,c.action==='combo'?c.keys:[c.key])");
  source = replaceOnce(source, "const start=Date.now()", "assert(!process.env.TR2_GENERATED&&!process.env.WEBGL_QUALIFY,'unsupported Q3 startup path; no launch');const start=Date.now()");
  // Navigate to a neutral document. Only the authenticated one-shot startup
  // controller may release the original; app= navigation is not admission.
  source = replaceOnce(source,
    "(process.env.TR2_GENERATED||process.env.NO_ORIGINAL?'':'&app='+selectedApp+'&gl-renderer='+(process.env.RENDER_BACKEND||'software')+'&d3d-renderer='+(process.env.RENDER_BACKEND||'software'))",
    "('&gl-renderer='+(process.env.RENDER_BACKEND||'software')+'&d3d-renderer='+(process.env.RENDER_BACKEND||'software'))");
  source = replaceOnce(source, "await require('./readiness.cjs').ready(evaluate,'dx_tunnel',{attempts:300,wait});",
    "await require(root+'/tools/q3-startup.cjs').launch({evaluate,send,workers,pageSession,deadline,fixture:true,wait,save});await require('./readiness.cjs').ready(evaluate,'dx_tunnel',{attempts:300,wait});");
  source = replaceOnce(source, "save('launch.json'", `for(let n=0;n<100;n++){if(await evaluate("typeof WineAssembly!=='undefined' && typeof shell!=='undefined' && typeof runningApps!=='undefined'"))break;await wait(100);}
 await require(root+'/tools/q3-startup.cjs').launch({evaluate,send,workers,pageSession,deadline,wait,save});
 save('launch.json'`);
  source = replaceOnce(source, 'productionDirectRoute:!process.env.TR2_GENERATED', 'productionDirectRoute:false,parkedStartup:true');
  // Opt-in native cancellation evidence runs the whole fixture first, then
  // waits with the real browser/Workers alive. The existing terminal abort
  // must interrupt this wait; reaching its end is a failure, never proof.
  source = replaceOnce(source, "await close('production startup fixture complete');return;",
    `if(process.env.Q3_NATIVE_CANCEL_PROBE==='1')await require(root+'/tools/q3-native-driver-composition.cjs').cancellationCheckpoint({save,wait});
 if(process.env.Q3_NATIVE_JOINED_FIXTURE==='1'){
  save('fixture-complete-awaiting-quit.json',{at:new Date().toISOString(),nextNumber:1,nativeQualified:false});
  for(let n=1;!closing;n++){while(!closing&&!fs.existsSync(out+'/commands/'+n+'.json'))await wait(100);if(closing)break;await t.consume(out,n,execute);}
  return;
 }
 await close('production startup fixture complete');return;`);
  // Observe the exact transport send/receive/deadline boundaries. The retained
  // transport and screenshot options, work/CDP caps and ACK rules stay intact.
  source = replaceOnce(source, 'const pending=new Map(),workers=new Map(),workerPromises=[];',
    "const pending=new Map(),workers=new Map(),workerPromises=[];const screenshotCompletion=require(root+'/tools/q3-screenshot-completion.cjs').create({trace,write:v=>log('screenshot-completion.jsonl',v),probe:({shotId,kind,sessionId,params})=>send('Runtime.evaluate',params,sessionId,{shotId,kind})});");
  // First terminal observation is immutable. Reject pending protocol work and
  // cancellable waits before cleanup, so a suspended command cannot later send.
  source = replaceOnce(source, 'let floorTimer,passive;', `let floorTimer,passive;
let terminalFailure=null;const terminalAbort=new AbortController();
const callerCancellation=path.join(path.dirname(process.env.Q3_EXECUTION_BOUNDARY_OUT),'caller-cancelled.json');
function checkTerminal(){if(!terminalFailure&&fs.existsSync(callerCancellation))observeTerminal('owning launch transport cancelled');if(terminalFailure)throw terminalFailure;}
const callerMonitor=setInterval(()=>{if(fs.existsSync(callerCancellation))observeTerminal('owning launch transport cancelled');},20);callerMonitor.unref();
function observeTerminal(reason){
 if(terminalFailure)return terminalFailure;
 terminalFailure=Error('Q3 terminal UNKNOWN; no replay: '+reason);
 save('first-transport-failure.json',{at:new Date().toISOString(),error:String(terminalFailure),noReplay:true});
 clearInterval(callerMonitor);terminalAbort.abort(terminalFailure);
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(terminalFailure);}pending.clear();
 if(!closing)close('first transport failure').catch(error=>{process.exitCode=1;console.error(error);});
 return terminalFailure;
}`);
  source = replaceOnce(source, 'new Promise(r=>setTimeout(r,ms))', `new Promise((resolve,reject)=>{
 checkTerminal();const done=()=>{clearTimeout(timer);terminalAbort.signal.removeEventListener('abort',abort);resolve();};
 const abort=()=>{clearTimeout(timer);terminalAbort.signal.removeEventListener('abort',abort);reject(terminalFailure);};
 const timer=setTimeout(done,ms);terminalAbort.signal.addEventListener('abort',abort,{once:true});
})`);
  source = replaceOnce(source, "const n=++id,w=workers.get(sessionId)", "if(method!=='Browser.close')checkTerminal();const n=++id,w=workers.get(sessionId)");
  source = replaceOnce(source, 'async function executeImpl(c,markDispatch){', 'async function executeImpl(c,markDispatch){checkTerminal();');
  source = replaceOnce(source, 'async function captureImpl(label){', 'async function captureImpl(label){checkTerminal();');
  source = replaceOnce(source, 'function send(method,params={},sessionId)',
    'function send(method,params={},sessionId,captureProbe=null)');
  source = replaceOnce(source, 'meta={requestId:n,method,sessionId:',
    'meta={captureProbe,requestId:n,method,sessionId:');
  source = replaceOnce(source, 'expression:params.expression?trace.expression(params.expression):null',
    "expression:params.expression?{...trace.expression(params.expression),...(params.expression===require(root+'/scratch/runs/20261108-q3-gl-readiness-gameplay/producer-ready.cjs').READ?{kind:'renderer.producer'}:{})}:null");
  source = replaceOnce(source, "trace.snapshot('CDP deadline',meta);pending.delete(n);",
    "trace.snapshot('CDP deadline',meta);screenshotCompletion.deadline(meta);pending.delete(n);");
  source = replaceOnce(source, 'ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));',
    'screenshotCompletion.request(meta,params);try{ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));screenshotCompletion.submitted(meta);}catch(error){screenshotCompletion.sendFailed(meta,error);observeTerminal(error);throw error;}');
  source = replaceOnce(source, 'const v=JSON.parse(msg.data);if(v.id){',
    'const v=JSON.parse(msg.data);screenshotCompletion.receive(v,pending.get(v.id));if(v.id){');
  source = replaceOnce(source, "ws=new WebSocket('ws://127.0.0.1:'+debugPort+debugPath);",
    "ws=new WebSocket('ws://127.0.0.1:'+debugPort+debugPath);for(const event of ['close','error'])ws.addEventListener(event,()=>{screenshotCompletion.transport(event);if(!closing)observeTerminal('CDP '+event);});");
  source = replaceOnce(source,
    "const active=out+'/chrome-profile/DevToolsActivePort';for(let i=0;i<100&&!fs.existsSync(active);i++)await wait(100);const [debugPort,debugPath]=fs.readFileSync(active,'utf8').trim().split('\\n');save('endpoint.json',{debugPort:Number(debugPort),browserPath:debugPath});",
    "const endpoint=await require(root+'/tools/supertux-native-lifecycle.cjs').ready({browser,profile:out+'/chrome-profile',deadline,record:v=>log('startup-browser.jsonl',v)});const debugPort=endpoint.debugPort,debugPath=endpoint.browserPath;save('endpoint.json',endpoint);");
  source = replaceOnce(source, "browser.once('exit',(code,signal)=>save('chrome-exit.json'",
    "browser.once('error',error=>{browser.__q3SpawnError=error;if(!closing)observeTerminal(error);save('chrome-error.json',{error:String(error),noReplay:true});});browser.once('exit',(code,signal)=>save('chrome-exit.json'");
  source = replaceOnce(source, "save('process.json',{pid:process.pid", "browser.once('exit',(code,signal)=>{if(!closing)observeTerminal('browser exit '+code+'/'+signal);});save('process.json',{pid:process.pid");
  // Check the actual launch error before and during readiness, rather than
  // allowing ChildProcess 'error' to become an unhandled event or success.
  source = replaceOnce(source, "const endpoint=await require(root+'/tools/supertux-native-lifecycle.cjs').ready(",
    "const endpoint=await require(root+'/tools/q3-native-driver-composition.cjs').ready(");
  const begin = source.indexOf('async function close(reason)');
  const end = source.indexOf('\nasync function executeImpl', begin);
  assert(begin >= 0 && end > begin, 'Q3 real close call site missing');
  source = source.slice(0, begin) + `let closePromise;
function close(reason){
 if(closePromise)return closePromise;
 closing=true;clearInterval(callerMonitor);clearTimeout(timer);clearInterval(floorTimer);clearInterval(passive);
 closePromise=(async()=>{
  save('close-reason.json',{at:new Date().toISOString(),reason});
  let receipt,failure;
  try{
   if(browser){receipt=await require(root+'/tools/supertux-native-lifecycle.cjs').close({browser,requestClose:()=>ws?.readyState===1?send('Browser.close'):Promise.reject(Error('endpoint unavailable')),record:v=>log('terminal-browser.jsonl',v)});save('terminal-browser.json',receipt);}
  }catch(error){failure=error;save('close-error.json',{error:String(error),receipt:error.receipt??null,noReplay:true});}
  finally{
   // This rejects actual pending CDP promises; it is never a successful ACK.
   for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('runtime closed; UNKNOWN; no replay'));}pending.clear();
   await new Promise(resolve=>setImmediate(resolve));
   ws?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  }
  if(failure)throw failure;
  if(browser){await commandLogs.drainStreams();commandLogs.close();}
  // Terminal/EOF permits local profile retirement only. Kernel completion and
  // historical UNKNOWN/untraced/nonleader limits remain the supervisor's job.
  fs.rmSync(out+'/chrome-profile',{recursive:true,force:true});
  t.closed(out,browser?.exitCode);console.log('TERMINAL '+reason);
  return receipt;
 })();
 return closePromise;
}` + source.slice(end);
  source = replaceOnce(source, 'floor:5000000000', 'floor:1500000000');
  source = replaceOnce(source, "assert(free>5000000000,'5GB disk floor')", "assert(free>1500000000,'1.5GB disk floor')");
  assert(source.includes('value.configureDiagnostics({enabled:true,maxRecords:64})'), 'GL configure-before-hostimport missing');
  assert(source.indexOf("Page.addScriptToEvaluateOnNewDocument") < source.indexOf("await send('Page.navigate'"), 'GL preload must precede navigation');
  new vm.Script(Module.wrap(source), {filename:path.join(root, consumerPath)});
  let fixtureSource = require('./q3-startup.cjs').composeFixture(fs.readFileSync(path.join(root, fixturePath), 'utf8'), root);
  fixtureSource = replaceOnce(fixtureSource, "'host-window','host-imports'", "'host-window','host-imports','renderer-input'");
  fixtureSource = replaceOnce(fixtureSource, "globalThis.runningApps=[{name:'dx_tunnel',wine}];",
    `(${require('./q3-fixture-input.cjs').installFixtureInput.toString()})({renderer,wine,link});\n globalThis.runningApps=[{name:'dx_tunnel',wine}];`);
  new vm.Script(Module.wrap(fixtureSource), {filename:path.join(root, fixturePath)});
  return {source, fixtureSource, retainedSource, references, hook:extensions['.cjs'], append:localFs.appendFileSync};
}
async function ready(options) {
  // The real consumer records spawn errors before this poll. Throw on the next
  // accepted poll so no losing readiness promise or timer survives a race.
  const browser = new Proxy(options.browser, {get(target, key) {
    if (key === 'exitCode' && target.__q3SpawnError) throw target.__q3SpawnError;
    return Reflect.get(target, key);
  }});
  return require('./supertux-native-lifecycle.cjs').ready({...options, browser});
}
async function cancellationCheckpoint({save, wait}) {
  save('cancellation-ready.json', {at:new Date().toISOString(), nativeQualified:false,
    scope:'whole fixture complete; live browser waiting for owning caller cancellation', waitMs:10000});
  await wait(10000);
  throw Error('Q3 native cancellation checkpoint elapsed without cancellation; no replay');
}
function install({root = path.resolve(__dirname, '..')} = {}) {
  assert.equal(path.resolve(process.argv[1] || ''), path.join(root, consumerPath), 'genuine retained Q3 consumer required');
  assert(process.env.Q3_EXECUTION_BOUNDARY_OUT?.endsWith('.jsonl.gz'), 'execution preload output required');
  const result = compose({root}), original = Module._extensions['.cjs'] || Module._extensions['.js'];
  fs.appendFileSync = result.append;
  Module._extensions['.cjs'] = function(module, filename) {
    if (filename === path.join(root, consumerPath)) {
      assert(globalThis.WebSocket?.name === 'ObservedSocket', 'Q3 execution preload missing or wrong order');
      return module._compile(result.source, filename);
    }
    if (filename === path.join(root, fixturePath)) return module._compile(result.fixtureSource, filename);
    if (filename === path.join(root, path.dirname(consumerPath), 'bound-input.cjs')) {
      return compileBoundInput(result, module, filename, path.dirname(path.resolve(process.env.Q3_EXECUTION_BOUNDARY_OUT)));
    }
    return original(module, filename);
  };
  return result.references;
}
function compileBoundInput(result, module, filename, evidenceDirectory) {
  const historical = path.join(path.dirname(filename), '../20261108-q3-instrumented-webgl-gameplay-2248/physical-completion.jsonl');
  const destination = path.join(path.resolve(evidenceDirectory), 'physical-completion.jsonl');
  assert.notEqual(destination, historical, 'unique Q3 physical evidence directory required');
  return result.hook({_compile(source, name) {
    // Preserve the immutable owner's identity/admission chain. Replace only
    // its hold implementation in the genuine module loaded by this consumer.
    const begin=source.indexOf('async function hold({'), end=source.indexOf('\nmodule.exports =',begin);
    assert(begin>=0&&end>begin,'Q3 physical hold integration missing');
    assert(source.includes(JSON.stringify(historical)),'Q3 historical telemetry anchor missing');
    const helper=JSON.stringify(path.join(__dirname,'q3-fixture-input.cjs'));
    const replacement=`function hold(options){return require(${helper}).hold({...options,fixture:process.env.LOCAL_PRODUCTION_FIXTURE==='1',record:value=>require('node:fs').appendFileSync(${JSON.stringify(destination)},JSON.stringify(value)+'\\n')});}`;
    let integrated=source.slice(0,begin)+replacement+source.slice(end);
    integrated=replaceOnce(integrated, 'physical:[37,38,39,40].map', "physicalSource:{kind:'renderer-input.peekKeyDownState',renderer:token(w?.renderer),endpoint:l?.endpointIdentity,worker:token(l?.worker),module:token(l?.module),reader:token(w?.renderer?.peekKeyDownState)},physical:[37,38,39,40].map");
    integrated=replaceOnce(integrated, 'async function progress(identity) {\n    const page = await evaluate(PAGE_READ)',
      `async function progress(identity, keys) {\n    const page = await evaluate(keys ? PAGE_READ.replace('[37,38,39,40]',JSON.stringify(keys.map(k=>require(${helper}).KEYS[k]))) : PAGE_READ)`);
    integrated=replaceOnce(integrated, "'renderWorkerObject'])\n      assert.equal(a[f], identity[f], 'held identity changed: '+f);",
      "'renderWorkerObject','pageRendererObject','canvasObject'])\n      assert.equal(a[f], identity[f], 'held identity changed: '+f);");
    integrated=replaceOnce(integrated, 'physical:a.physical, render}', 'physical:a.physical, physicalSource:a.physicalSource, render}');
    return module._compile(integrated, name);
  }}, filename);
}
module.exports = {compose, ready, cancellationCheckpoint, install, compileBoundInput, providers, consumerPath, adapterPath, fixturePath, replaceOnce};
if (process.env.Q3_NATIVE_COMPOSITION === '1') install();
