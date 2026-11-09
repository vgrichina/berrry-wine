'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const Module = require('node:module');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const {once} = require('node:events');
const root = path.resolve(__dirname, '..');
const composition = require('./q3-native-driver-composition.cjs');
const retained = path.join(root, composition.consumerPath);
const base = path.dirname(retained);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// These subprocess modes own only Node children and local stdio. They cannot
// start Chrome, a static server, a guest or a network connection.
if (process.env.Q3_NODE_FIXTURE === 'preload') {
  const load = Module._load, read = fs.readFileSync, spawn = cp.spawn;
  const dir = process.env.Q3_FIXTURE_DIR;
  let browser;
  fs.readFileSync = function(file, ...args) {
    if (file === base + '/runtime-pins.json') return JSON.stringify({files:[], httpPins:[], commit:'NODE_PROTOCOL_FIXTURE_ONLY'});
    return read.call(this, file, ...args);
  };
  cp.spawn = function(command, args) {
    assert.equal(command, '/usr/bin/google-chrome', 'only the actual consumer launch site is intercepted');
    const profile = args.find(a => a.startsWith('--user-data-dir=')).slice(16);
    browser = spawn(process.execPath, [__filename, 'node-browser', profile], {
      env:{...process.env, Q3_NODE_FIXTURE:'browser', Q3_NATIVE_COMPOSITION:''}, stdio:['pipe', 'pipe', 'pipe']
    });
    browser.once('close', (code, signal) => fs.writeFileSync(dir + '/browser-actual-wait.json.gz', zlib.gzipSync(JSON.stringify({code, signal, childClose:true, stdoutEOF:browser.stdout.readableEnded, stderrEOF:browser.stderr.readableEnded}))));
    fs.writeFileSync(dir + '/node-browser-pid', String(browser.pid));
    return browser;
  };
  const png = Buffer.from('node-protocol-capture-fixture');
  let physicalPage;
  Module._load = function(name, parent, main) {
    // Lifecycle-only controls have no page/guest. Parked admission is exercised
    // by q3-startup.test.cjs through the whole production composition.
    if (parent?.filename === retained && name === root + '/tools/q3-startup.cjs') return {launch:async()=>({fixture:'lifecycle only; no startup proof'})};
    if (name === root + '/test/static-server.js') return {startStaticServer:async() => ({
      prependListener() {}, address:() => ({port:1}), closeAllConnections() {}, close:fn => fn()
    })};
    if (parent?.filename === retained && name === './bound-input.cjs' && process.env.Q3_PHYSICAL_CASE) {
      const bound=load.call(this,name,parent,main);
      return {...bound,createChain:options=>{
        options.workers.set('fixture-owner',{targetId:'fixture-owner',closed:false,url:'inert-owning-worker'});
        const chain=bound.createChain(options);
        const identity=()=>({...physicalPage.evaluate(bound.PAGE_READ).apps[0],workerTarget:'fixture-owner'});
        return {establishReady:async()=>({scope:'inert fixture'}),
          capture:async label=>({png,before:{},after:{},capture:{label,sha256:require('node:crypto').createHash('sha256').update(png).digest('hex')}}),
          admit:async(review,dispatch)=>dispatch({live:{identity:identity()}}),
          progress:async(...args)=>{
            if(process.env.Q3_PHYSICAL_CASE==='source-race')physicalPage.scope.runningApps[0].wine.renderer={};
            return chain.progress(...args);
          }};
      }};
    }
    if (parent?.filename === retained && name === './bound-input.cjs') return {...(process.env.Q3_INPUT_CASE?load.call(this,name,parent,main):{}),createChain:() => ({
      establishReady:async() => ({fixture:'no guest'}),
      capture:async label => ({png, before:{}, after:{}, capture:{label,sha256:require('node:crypto').createHash('sha256').update(png).digest('hex')}}),
      admit:async(review,dispatch)=>dispatch({live:{identity:{fixture:'inert'}}}),
      progress:async()=>{if(process.env.Q3_INPUT_CASE==='sample-error')throw Error('FIRST inert sample failure');return {fixture:'no guest'};}
    })};
    if (parent?.filename === retained && name === './readiness.cjs') return {ready:async() => ({fixture:'no guest'})};
    if (parent?.filename === retained && name === './local-controls.cjs' && (process.env.Q3_NATIVE_CANCEL_PROBE === '1'||process.env.Q3_NATIVE_JOINED_FIXTURE === '1')) return {run:async({out,capture})=>{
      if(process.env.Q3_PHYSICAL_CASE){
        await capture('fixture-startup');
        const review=JSON.parse(fs.readFileSync(out+'/fixture-startup-capture.json'));review.review='inert generated fixture';
        fs.writeFileSync(out+'/fixture-startup-review.json',JSON.stringify(review));
      }
      if(process.env.Q3_NATIVE_JOINED_FIXTURE==='1'){
        // A Node-only prior ACK tests numbering, never guest input proof.
        fs.writeFileSync(out+'/commands/0.json',JSON.stringify({id:'node_prior'}));
        fs.writeFileSync(out+'/reply-0.json',JSON.stringify({id:'node_prior',ok:true}));
      }
    }};
    return load.call(this, name, parent, main);
  };
  class ProtocolSocket extends EventTarget {
    constructor() { super(); this.readyState = 1; setImmediate(() => this.onopen?.()); }
    send(text) {
      const v = JSON.parse(text);
      fs.appendFileSync(dir + '/protocol.jsonl', JSON.stringify({at:Date.now(), method:v.method, params:v.params}) + '\n');
      if (v.method === 'Page.addScriptToEvaluateOnNewDocument') {
        // Execute the actual retained GL preload. The assignment is the module
        // boundary; the host import is deliberately constructed afterward.
        const sandbox = {performance:{now:() => 1}, console:{debug() {}}, addEventListener() {}};
        require('node:vm').runInNewContext(v.params.source, sandbox);
        let armed = false;
        sandbox.GLRenderHost = {configureDiagnostics(options) { assert.equal(options.enabled, true); armed = true; }};
        assert(armed, 'actual GL module assignment must configure before host import');
        sandbox.createHostImports = () => assert(armed);
        sandbox.createHostImports();
        fs.writeFileSync(dir + '/gl-call-order', 'configureDiagnostics then createHostImports');
      }
      if (v.method === 'Browser.close') {
        fs.writeFileSync(dir + '/close-request-at', String(Date.now()));
        if (process.env.Q3_FIXTURE_CLOSE !== 'escalate') browser.stdin.end('close\n');
        // A genuine unanswered request; consumer must reject its pending entry
        // on terminal/EOF. It must never synthesize a successful CDP result.
        return;
      }
      if (v.method === 'Input.dispatchKeyEvent' && process.env.Q3_INPUT_CASE) {
        const mode=process.env.Q3_INPUT_CASE;
        const reply=()=>{const message=new MessageEvent('message',{data:JSON.stringify({id:v.id,result:{}})});this.dispatchEvent(message);this.onmessage?.(message);};
        const applied=()=>fs.appendFileSync(dir+'/application.jsonl',JSON.stringify({at:Date.now(),type:v.params.type,key:v.params.key})+'\n');
        if(mode==='delayed-application')setTimeout(applied,650).unref();else applied();
        if(mode==='stalled-down'&&v.params.type==='keyDown')return;
        if(mode==='independent-up'&&v.params.type==='keyUp'&&v.params.key==='Control')return;
        if(mode==='delayed-reply'||mode==='delayed-application')setTimeout(reply,650).unref();
        else queueMicrotask(reply);
        return;
      }
      if(v.method==='Input.dispatchKeyEvent'&&process.env.Q3_PHYSICAL_CASE){
        physicalPage.dispatch(v.params,process.env.Q3_PHYSICAL_CASE);
      }
      if(v.method==='Page.navigate'&&process.env.Q3_PHYSICAL_CASE){
        let selected=composition;
        if(process.env.Q3_INPUT_OLD==='1'){
          const control=new Module(path.join(__dirname,'q3-native-driver-composition.control.cjs'),module);
          control.filename=path.join(__dirname,'q3-native-driver-composition.control.cjs');control.paths=module.paths;
          control._compile(cp.execFileSync('git',['show',process.env.Q3_INPUT_BASE+':tools/q3-native-driver-composition.cjs'],{cwd:root}).toString(),control.filename);
          selected=control.exports;
        }
        require('./q3-fixture-input.test.cjs').createPage(selected.compose()).then(value=>{
          physicalPage=value;
          const message=new MessageEvent('message',{data:JSON.stringify({id:v.id,result:{}})});
          this.dispatchEvent(message);this.onmessage?.(message);
        }).catch(error=>{console.error(error);browser.kill('SIGTERM');});
        return;
      }
      if (v.method === 'Runtime.evaluate' && fs.existsSync(dir + '/arm-terminal')) {
        fs.writeFileSync(dir + '/pending-cdp-at', String(Date.now()));
        if(process.env.Q3_FIXTURE_STALL_CDP==='1'){
          const timer=setInterval(()=>{if(fs.existsSync(dir+'/release-cdp')){
            clearInterval(timer);const message=new MessageEvent('message',{data:JSON.stringify({id:v.id,result:{result:{value:{apps:[]}}}})});
            this.dispatchEvent(message);this.onmessage?.(message);
          }},5);timer.unref();
        }else setTimeout(() => browser.kill('SIGKILL'), 25);
        return; // Real pending CDP promise; termination must cancel it promptly.
      }
      let result = {};
      if (v.method === 'Target.getTargets') result = {targetInfos:[{type:'page', targetId:'node-protocol-page'}]};
      if (v.method === 'Target.attachToTarget') result = {sessionId:'node-protocol-session'};
      if (v.method === 'Runtime.evaluate') result = {result:{value:process.env.Q3_PHYSICAL_CASE&&physicalPage&&v.params.expression.includes('__mcmPassiveIdentityV1')
        ?physicalPage.evaluate(v.params.expression):{apps:[]}}};
      queueMicrotask(() => {
        const message = new MessageEvent('message', {data:JSON.stringify({id:v.id, result})});
        this.dispatchEvent(message); this.onmessage?.(message);
      });
    }
    close() { this.readyState = 3; }
  }
  globalThis.WebSocket = ProtocolSocket;
  if(process.env.Q3_INPUT_OLD==='1'){
    const control=new Module(path.join(__dirname,'q3-native-driver-composition.control.cjs'),module);
    control.filename=path.join(__dirname,'q3-native-driver-composition.control.cjs');control.paths=module.paths;
    control._compile(cp.execFileSync('git',['show',process.env.Q3_INPUT_BASE+':tools/q3-native-driver-composition.cjs'],{cwd:root}).toString(),control.filename);
    control.exports.install();
  }
  if (process.env.Q3_FIXTURE_OLD === '1') {
    const result = composition.compose(), ext = Module._extensions['.cjs'] || Module._extensions['.js'];
    fs.appendFileSync = result.append;
    // Apply only the owner's current disk floor to the old control, so the
    // historical 5GB guard cannot mask the real old startup selection.
    const old = result.retainedSource.replace('floor:5000000000', 'floor:1500000000')
      .replace("assert(free>5000000000,'5GB disk floor')", "assert(free>1500000000,'1.5GB disk floor')");
    Module._extensions['.cjs'] = (module, filename) => filename === retained
      ? module._compile(old, filename) : ext(module, filename);
  }
} else if (process.env.Q3_NODE_FIXTURE === 'browser') {
  const profile = process.argv[3], dir = process.env.Q3_FIXTURE_DIR;
  fs.mkdirSync(profile, {recursive:true});
  const timer = setTimeout(() => {
    if (process.env.Q3_FIXTURE_TERMINAL === '1') { clearTimeout(failsafe); process.exitCode = 7; process.stdin.destroy(); return; }
    fs.writeFileSync(profile + '/DevToolsActivePort', '43123\n/devtools/browser/node-owned-fixture\n');
    process.stdout.write('DevTools published\n');
    fs.writeFileSync(dir + '/publication-at', String(Date.now()));
  }, Number(process.env.Q3_FIXTURE_DELAY));
  const failsafe = setTimeout(() => { clearTimeout(timer); process.exit(0); }, process.env.Q3_FIXTURE_CLOSE === 'escalate' ? 45000 : 15000);
  process.stdin.once('data', () => {
    clearTimeout(timer); clearTimeout(failsafe);
    const writer = cp.spawn(process.execPath, ['-e', "setTimeout(()=>{process.stdout.write('late pipe EOF\\n')}," + (process.env.Q3_FIXTURE_CLOSE === 'drain-cap' ? 35000 : 350) + ')'], {stdio:['ignore', process.stdout, process.stderr]});
    fs.writeFileSync(dir + '/pipe-writer-pid', String(writer.pid));
    if (process.env.Q3_FIXTURE_CLOSE === 'drain-cap') process.exit(0); // adopted and actually waited by fixture subreaper
    writer.once('close', (code, signal) => {
      fs.writeFileSync(dir + '/writer-actual-wait.json.gz', zlib.gzipSync(JSON.stringify({code, signal, actualClose:true})));
      process.exit(code || 0);
    });
  });
  process.on('SIGTERM', () => { clearTimeout(timer); clearTimeout(failsafe); process.exit(0); });
} else if (require.main === module) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}

async function until(fn, ms = 45000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return; await pause(25); }
  throw Error('fixture observation deadline');
}
async function main() {
  const run = path.resolve(process.env.Q3_TEST_RUN || 'scratch/runs/20261108-q3-readiness-drain-integration-2305/test-' + Date.now() + '-' + process.pid);
  fs.mkdirSync(run, {recursive:true});
  const result = composition.compose();
  if (process.argv.includes('--released-caller-only')) {
    const name='tools/q3-native-launch-client.py', read=fs.readFileSync;
    assert.match(composition.providers[name],/^[a-f0-9]{64}$/,'released owning caller must have a literal provider pin');
    const retired=cp.execFileSync('git',['show','3306d8477:'+name],{cwd:root});
    const controls=[];
    try {
      for(const mode of ['missing','changed','retired']){
        fs.readFileSync=function(file,...args){
          if(file===path.join(root,name)){
            if(mode==='missing')throw Error('missing released caller');
            if(mode==='retired')return retired;
            return Buffer.concat([Buffer.from(read.call(this,file,...args)),Buffer.from('\n')]);
          }
          return read.call(this,file,...args);
        };
        assert.throws(()=>composition.compose(),mode==='missing'?/missing released caller/:/provider changed/);
        controls.push({mode,refusedBeforeLaunch:true});
      }
    }finally{fs.readFileSync=read;}
    fs.writeFileSync(run+'/released-caller-controls.json.gz',zlib.gzipSync(JSON.stringify({passed:true,controls,pin:composition.providers[name],references:result.references})));
    console.log('PASS whole composition: released caller literal pin accepted; missing, changed and retired owning callers refused before launch');
    return;
  }
  if (process.argv.includes('--joined-fixture-only')) {
    await scenario(run, {name:'joined-whole-fixture', delay:100, joinedFixture:true});
    console.log('PASS actual composed fixture command loop: retained prior ACK0, ordinary quit ACK1 only after normal close and actual wait/EOF (Node-only scope)');
    return;
  }
  if (process.argv.includes('--cancellation-only')) {
    await scenario(run, {name:'native-cancellation-checkpoint', delay:100, nativeCancel:true});
    const records=[];
    await assert.rejects(composition.cancellationCheckpoint({save:(name,value)=>records.push({name,value}),wait:async ms=>assert.equal(ms,10000)}), /elapsed without cancellation/);
    assert.equal(records[0].name,'cancellation-ready.json');
    console.log('PASS actual composed cancellation checkpoint: caller marker interrupts live wait; normal joined browser; no input/capture/ACK after cancellation; missing cancellation fails closed (Node-only scope)');
    return;
  }
  // Exercise the actual whole-composition dependency gate before any adapter
  // evaluation. The custody provider is the released c443739b repair; neither
  // its historical pin nor arbitrary replacement bytes may reach the caller.
  const dependencyControls = [];
  const dependencyRead = fs.readFileSync;
  try {
    for (const file of Object.keys(composition.providers)) {
      for (const mode of ['changed', 'missing']) {
        fs.readFileSync = function(name, ...args) {
          if (name === path.join(root, file)) {
            if (mode === 'missing') throw Object.assign(Error('missing dependency'), {code:'ENOENT'});
            return Buffer.concat([Buffer.from(dependencyRead.call(this, name, ...args)), Buffer.from('\n')]);
          }
          return dependencyRead.call(this, name, ...args);
        };
        assert.throws(() => composition.compose(), mode === 'missing' ? /missing dependency/ : /provider changed/);
        dependencyControls.push({file, mode, refused:true});
      }
    }
  } finally { fs.readFileSync = dependencyRead; }
  assert.equal(composition.providers['tools/native_kernel_custody.py'],
    '05b7fe42cf7ac09df5f12f0ea073ea066892efb598b64b05fae19a3492c9f32c');
  fs.writeFileSync(run + '/dependency-controls.json.gz', zlib.gzipSync(JSON.stringify({
    passed:true, controls:dependencyControls, references:result.references,
    callerSHA256:require('node:crypto').createHash('sha256').update(result.source).digest('hex'),
    fixtureSHA256:require('node:crypto').createHash('sha256').update(result.fixtureSource).digest('hex')
  })));
  if (process.argv.includes('--dependencies-only')) {
    console.log('PASS whole composition: current released providers compile; '+dependencyControls.length+' changed/missing dependencies refused');
    return;
  }
  assert(result.retainedSource.includes('i<100&&!fs.existsSync(active)'));
  assert(!result.source.includes('i<100&&!fs.existsSync(active)'));
  assert(result.source.includes('if(closePromise)return closePromise'));
  assert.throws(() => composition.replaceOnce('no site', 'old', 'new'), /integration/);
  assert.throws(() => composition.install(), /genuine retained/);
  const read = fs.readFileSync;
  try {
    fs.readFileSync = function(file, ...args) {
      const value = read.call(this, file, ...args);
      return file === retained ? Buffer.concat([Buffer.from(value), Buffer.from('\n')]) : value;
    };
    assert.throws(() => composition.compose(), /provider changed/);
  } finally { fs.readFileSync = read; }
  fs.writeFileSync(run + '/providers.json.gz', zlib.gzipSync(JSON.stringify(result.references)));
  for (const options of [
    {name:'old-selection', old:true, delay:11000},
    {name:'fixed-delayed', delay:11000},
    {name:'terminal-error', delay:100, terminal:true},
    {name:'pending-close', delay:100, close:'escalate'},
    {name:'drain-cap', delay:100, close:'drain-cap'},
    {name:'missing-execution-preload', missingPreload:true, delay:100},
    {name:'terminal-pending-capture', delay:100, failPending:true},
    {name:'terminal-command-wait', delay:100, failWait:true}

  ]) await scenario(run, options);
  console.log('PASS actual retained command consumer: old 10s failure; delayed actual publication; terminal error; pending CDP; unchanged 30s cap fails closed for exit before EOF; actual waits/EOF; GL/preload order; all Node children awaited');
}
async function scenario(run, options) {
  const dir = path.join(run, options.name); fs.mkdirSync(dir);
  const tag = 'offline-q3-2305-' + options.name + '-' + process.pid;
  const out = path.join(base, tag);
  const logs = require('./native-command-log.cjs').createLogs(dir);
  const nodeArgs = [process.execPath, '--require', __filename,
    '--require', path.join(__dirname, 'q3-native-driver-composition.cjs'),
    ...options.missingPreload ? [] : ['--require', path.join(__dirname, 'q3-execution-boundary.cjs')], retained];
  // Linux subreaper is fixture custody only. It actually waits any inherited
  // pipe writer after leader exit; it supplies no native game/kernel proof.
  const supervisor = `import ctypes,subprocess,sys,os,json,gzip,signal,time
assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0
child=subprocess.Popen(json.loads(sys.argv[1]),start_new_session=True)
open(sys.argv[2]+'.driver-pid','w').write(str(child.pid))
deadline=time.monotonic()+55
reaped=[]
try:
 status=child.wait(timeout=55)
except subprocess.TimeoutExpired:
 os.killpg(child.pid,signal.SIGKILL);status=child.wait()
while True:
 try:
  pid,st=os.waitpid(-1,os.WNOHANG)
  if pid:reaped.append(dict(pid=pid,status=st,actualWait=True))
  elif time.monotonic()>=deadline:
   try:os.killpg(child.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   time.sleep(.05)
  else:time.sleep(.05)
 except ChildProcessError:break
open(sys.argv[2],'wb').write(gzip.compress(json.dumps(dict(driverPID=child.pid,driverActualWait=status,adopted=reaped)).encode()))
sys.exit(status if status>=0 else 128-status)
`;
  const child = cp.spawn('python3', ['-c', supervisor, JSON.stringify(nodeArgs), dir+'/supervisor-waits.json.gz'], {
    cwd:root, env:{...process.env, Q3_NODE_FIXTURE:'preload', Q3_FIXTURE_DIR:dir,
      Q3_FIXTURE_DELAY:String(options.delay), Q3_FIXTURE_TERMINAL:options.terminal?'1':'',
      Q3_FIXTURE_CLOSE:options.close || '', Q3_FIXTURE_OLD:options.old?'1':'',
      LOCAL_PRODUCTION_FIXTURE:options.nativeCancel||options.joinedFixture?'1':'', Q3_NATIVE_CANCEL_PROBE:options.nativeCancel?'1':'',
      Q3_NATIVE_JOINED_FIXTURE:options.joinedFixture?'1':'',
      Q3_NATIVE_COMPOSITION:options.old?'':'1', CASE_TAG:tag, BROWSER_DEADLINE:String(Date.now()+150000),
      Q3_EXECUTION_BOUNDARY_OUT:dir+'/execution.jsonl.gz'}, stdio:['ignore', 'pipe', 'pipe']
  });
  const completed = once(child, 'close');
  logs.attach('driver.stdout', child.stdout); logs.attach('driver.stderr', child.stderr);
  const watchdog = setTimeout(() => {
    const file = dir+'/supervisor-waits.json.gz.driver-pid';
    if (fs.existsSync(file)) { try { process.kill(-Number(fs.readFileSync(file)), 'SIGKILL'); } catch {} }
  }, 58000);
  let ack;
  try {
    if (options.nativeCancel) {
      await until(()=>fs.existsSync(out+'/cancellation-ready.json')||child.exitCode!==null);
      assert.equal(child.exitCode,null,'real consumer waiting at opt-in cancellation checkpoint');
      const began=Date.now();fs.writeFileSync(dir+'/caller-cancelled.json',JSON.stringify({reason:'planned Node-only cancellation control'}));
      await completed;
      assert(Date.now()-began<1500,'terminal cancellation interrupts 10s wait promptly');
    } else if (!options.old && !options.terminal && !options.missingPreload) {
      await until(() => fs.existsSync(out + (options.joinedFixture?'/fixture-complete-awaiting-quit.json':'/ready.json')) || child.exitCode !== null);
      assert.equal(child.exitCode, null, 'actual consumer reaches command loop');
      const transport = require(base + '/transport.cjs');
      if(options.failPending)fs.writeFileSync(dir + '/arm-terminal','1');
      const began=Date.now();
      const request = transport.request(out, 'quit_node_fixture', options.failPending||options.failWait
        ? {action:'capture',label:'pending-fixture',waitMs:options.failWait?10000:0}
        : {action:'quit'}, 55000);
      if(options.failWait){await until(()=>fs.existsSync(out+'/consumed-quit_node_fixture'));process.kill(Number(fs.readFileSync(dir+'/node-browser-pid')),'SIGKILL');}
      if(options.failPending||options.failWait){
        ack=await request.then(value=>({value}),error=>({error:String(error)}));
        assert(ack.error,'terminal command cannot ACK');
        assert(Date.now()-began<1500,'actual command/capture settles promptly');
        assert(!fs.existsSync(out+'/reply-0.json'));
        const terminal=fs.readFileSync(out+'/first-transport-failure.json','utf8');
        await assert.rejects(transport.request(out,'later_down',{action:'key',key:'ArrowDown',holdMs:100,waitMs:0,label:'later'},55000));
        await assert.rejects(transport.request(out,'later_capture',{action:'capture',waitMs:0,label:'later-capture'},55000));
        assert(!fs.existsSync(out+'/commands/1.json'),'no later numbered request');
        assert.equal(fs.readFileSync(out+'/first-transport-failure.json','utf8'),terminal,'first failure sticky');
      }else{

      await until(() => fs.existsSync(dir + '/close-request-at'));
      assert(!fs.existsSync(out + '/reply-'+(options.joinedFixture?1:0)+'.json'), 'pending close cannot ACK quit');
      ack = await request.then(value => ({value}), error => ({error:String(error)}));
      }
    }
    const [code, signal] = await completed;
    await logs.drainStreams(); logs.close();
    if (options.nativeCancel) {
      assert.equal(code,1);
      const terminal=JSON.parse(fs.readFileSync(out+'/first-transport-failure.json'));
      assert.match(terminal.error,/owning launch transport cancelled/);
      assert(!fs.existsSync(out+'/reply-0.json'));
      const protocol=zlib.gunzipSync(fs.readFileSync(dir+'/protocol.jsonl.gz')).toString().trim().split('\n').map(JSON.parse);
      assert(!protocol.some(v=>v.method.startsWith('Input.')||v.method==='Page.captureScreenshot'),'no native input or capture in Node-only checkpoint');
      const receipt=JSON.parse(fs.readFileSync(out+'/terminal-browser.json'));
      assert(receipt.normal&&receipt.drained&&receipt.signals.length===0);
      const waited=JSON.parse(zlib.gunzipSync(fs.readFileSync(dir+'/browser-actual-wait.json.gz')));
      assert.equal(waited.code,0);assert(waited.stdoutEOF&&waited.stderrEOF);
    } else if (options.missingPreload) {
      assert.equal(code, 1);
      assert(!fs.existsSync(dir + '/node-browser-pid'), 'missing integration fails before launch');
      assert.match(zlib.gunzipSync(fs.readFileSync(dir + '/driver.stderr.gz')).toString(), /execution preload missing/);
    } else if (options.old) {
      assert.equal(code, 1);
      assert.match(fs.readFileSync(out + '/first-browser-failure.json', 'utf8'), /ENOENT.*DevToolsActivePort/);
      assert(!fs.existsSync(out + '/endpoint.json'));
      const failedAt = Date.parse(JSON.parse(fs.readFileSync(out + '/first-browser-failure.json')).at);
      assert(failedAt < Number(fs.readFileSync(dir + '/publication-at')), 'real old failure precedes actual delayed endpoint publication');
    } else if (options.terminal) {
      assert.equal(code, 1);
      assert.match(fs.readFileSync(out + '/first-browser-failure.json', 'utf8'), /terminated before DevTools/);
      assert(!fs.existsSync(out + '/endpoint.json'));
    } else if(options.failPending||options.failWait){
      assert.equal(code,1);assert(ack.error);
      assert(!fs.existsSync(out+'/pending-fixture.png'),'cancelled capture writes no result');
      const protocol=zlib.gunzipSync(fs.readFileSync(dir+'/protocol.jsonl.gz')).toString().trim().split('\n').map(JSON.parse);
      assert(!protocol.some(v=>v.method==='Input.dispatchKeyEvent'),'no later DOWN');
      const waited=JSON.parse(zlib.gunzipSync(fs.readFileSync(dir+'/browser-actual-wait.json.gz')));
      assert.equal(waited.signal,'SIGKILL');assert(waited.stdoutEOF&&waited.stderrEOF);
    } else if (options.close === 'drain-cap') {
      assert.equal(code, 1);
      assert(ack.error);
      const failed = JSON.parse(fs.readFileSync(out + '/close-error.json'));
      assert.equal(failed.receipt.drained, false);
      assert.equal(failed.receipt.normal, false);
      assert.equal(failed.receipt.terminal.code, 0, 'actual exit remains distinct from EOF');
      assert.equal(failed.receipt.capMs, 30000);
      assert(failed.receipt.elapsedMs >= 30000 && failed.receipt.elapsedMs < 32000);
      assert(!fs.existsSync(out + '/cleanup.json'), 'no profile retirement/cleanup success at cap');
      assert(!fs.existsSync(out + '/reply-0.json'), 'no quit ACK at cap');
      assert(fs.existsSync(out + '/chrome-profile'), 'profile retained at failed drain');
      const waited = JSON.parse(zlib.gunzipSync(fs.readFileSync(dir+'/supervisor-waits.json.gz')));
      assert(waited.adopted.some(row => row.pid === Number(fs.readFileSync(dir+'/pipe-writer-pid')) && row.actualWait));
    } else {
      assert.equal(code, options.close === 'escalate' ? 1 : 0);
      if (options.close === 'escalate') {
        assert(ack.error, 'existing 20s command work cap stays UNKNOWN during escalation');
        assert(!fs.existsSync(out + '/reply-0.json'), 'no ACK for command work deadline');
      } else assert.equal(ack.value?.ok, true);
      const receipt = JSON.parse(fs.readFileSync(out + '/terminal-browser.json'));
      assert.equal(receipt.drained, true);
      assert.equal(receipt.capMs, 30000);
      assert.equal(receipt.closeRequest, options.close === 'escalate' ? 'UNKNOWN' : 'pending');
      assert.equal(receipt.normal, options.close !== 'escalate');
      const terminal = zlib.gunzipSync(fs.readFileSync(out + '/terminal-browser.jsonl.gz')).toString();
      assert(terminal.includes('close-unknown'), 'pending actual CDP rejected, never fabricated ACK');
      assert(terminal.indexOf('"kind":"exit"') < terminal.indexOf('"kind":"drained"'));
      assert.equal(fs.readFileSync(dir + '/gl-call-order', 'utf8'), 'configureDiagnostics then createHostImports');
      if (options.delay > 10000) assert(JSON.parse(fs.readFileSync(out + '/endpoint.json')).elapsedMs >= 10000);
      if (options.close === 'escalate') assert(receipt.signals.some(s => s.signal === 'SIGTERM'));
    }
    if (!options.missingPreload) {
      const execution = zlib.gunzipSync(fs.readFileSync(dir + '/execution.jsonl.gz')).toString();
      assert(execution.includes('process exit'));
    }
    fs.writeFileSync(dir + '/actual-wait.json.gz', zlib.gzipSync(JSON.stringify({code, signal, stdioEOF:true, ack,
      custody:'UNKNOWN; Node protocol fixture supplies no kernel custody or historical clone/nonleader evidence'})));
  } finally {
    clearTimeout(watchdog);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await completed;
    // Retain every fixture artifact compressed in this run, never as a source
    // archive. Only this test's uniquely named disposable output is removed.
    if (fs.existsSync(out)) {
      for (const name of fs.readdirSync(out)) {
        const file = path.join(out, name);
        if (fs.statSync(file).isFile()) {
          const bytes = fs.readFileSync(file);
          fs.writeFileSync(path.join(dir, 'consumer-' + name + (name.endsWith('.gz')?'':'.gz')), name.endsWith('.gz')?bytes:zlib.gzipSync(bytes));
        }
      }
      // Keep the unique directory on failure for inspection; no peer deletion.
    }
    for (const name of ['node-browser-pid', 'pipe-writer-pid']) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) {
        const pid = Number(fs.readFileSync(file));
        await until(() => { try { process.kill(pid, 0); return false; } catch(e) { return e.code === 'ESRCH'; } }, 5000);
      }
    }
  }
}
