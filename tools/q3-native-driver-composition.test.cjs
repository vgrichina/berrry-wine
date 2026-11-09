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
  Module._load = function(name, parent, main) {
    // Lifecycle-only controls have no page/guest. Parked admission is exercised
    // by q3-startup.test.cjs through the whole production composition.
    if (parent?.filename === retained && name === root + '/tools/q3-startup.cjs') return {launch:async()=>({fixture:'lifecycle only; no startup proof'})};
    if (name === root + '/test/static-server.js') return {startStaticServer:async() => ({
      prependListener() {}, address:() => ({port:1}), closeAllConnections() {}, close:fn => fn()
    })};
    if (parent?.filename === retained && name === './bound-input.cjs') return {createChain:() => ({
      establishReady:async() => ({fixture:'no guest'}),
      capture:async label => ({png, before:{}, after:{}, capture:{label}})
    })};
    if (parent?.filename === retained && name === './readiness.cjs') return {ready:async() => ({fixture:'no guest'})};
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
      if (v.method === 'Runtime.evaluate') result = {result:{value:{apps:[]}}};
      queueMicrotask(() => {
        const message = new MessageEvent('message', {data:JSON.stringify({id:v.id, result})});
        this.dispatchEvent(message); this.onmessage?.(message);
      });
    }
    close() { this.readyState = 3; }
  }
  globalThis.WebSocket = ProtocolSocket;
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
    if (!options.old && !options.terminal && !options.missingPreload) {
      await until(() => fs.existsSync(out + '/ready.json') || child.exitCode !== null);
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
      assert(!fs.existsSync(out + '/reply-0.json'), 'pending close cannot ACK quit');
      ack = await request.then(value => ({value}), error => ({error:String(error)}));
      }
    }
    const [code, signal] = await completed;
    await logs.drainStreams(); logs.close();
    if (options.missingPreload) {
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
