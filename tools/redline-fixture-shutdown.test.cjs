'use strict';
// Executes the retained and repaired whole fixture scripts in a CDP seam with
// real local HTTP, inert native Node children, and real gzip pipelines. No Chrome.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const zlib = require('node:zlib');
const {once, EventEmitter} = require('node:events');
const {Writable} = require('node:stream');
const {createLifecycle} = require('./redline-fixture-shutdown.cjs');
const root = path.resolve(__dirname, '..');
const base = process.env.REDLINE_SHUTDOWN_TEST_RUN || path.join(root, 'scratch/runs/20261109-redline-fixture-shutdown-repair-0740/test');
fs.mkdirSync(base,{recursive:true});
const out = fs.mkdtempSync(path.join(base,'suite-'));
const retained = path.join(root, 'scratch/runs/20261109-redline-admitted-side-door-0724/owned-run-inputs.patch.gz');
function oldSource() {
  const patch = zlib.gunzipSync(fs.readFileSync(retained)).toString();
  const section = patch.split('diff --git ').find(s => s.split('\n')[0].endsWith('/fixture.cjs'));
  assert(section, 'retained Gitbase + small patch fixture');
  return section.split('\n').filter(s => s.startsWith('+') && !s.startsWith('+++')).map(s => s.slice(1)).join('\n')+'\n';
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = [];
async function composition(name, source, mode) {
  const dir = path.join(out, name); fs.mkdirSync(dir, {recursive:true});
  // Prearmed independent observable deadline, before creating fixture children.
  let child, server, context;
  const watchdog = setTimeout(() => { child?.kill('SIGKILL'); server?.closeAllConnections(); server?.close(); }, mode==='delay-real'?15000:5000);
  const events = [];
  let error, actualWait, stdioClose;
  try {
    child = cp.spawn(process.execPath, ['-e', `process.stdin.on('data',()=>setTimeout(()=>process.exit(0),${mode==='delay-real'?12000:mode==='delay'?250:10}));process.stdout.write('ready\\n');process.stderr.write('inert only\\n');`], {stdio:['pipe','pipe','pipe']});
    const waited = once(child, 'exit').then(([code,signal]) => { actualWait={code,signal}; events.push('actualWait'); });
    const pipes = once(child, 'close').then(() => {stdioClose=true;events.push('childStdioClose');});
    await once(child.stdout, 'data');
    const processSeam = new EventEmitter(); processSeam.cwd=()=>root; processSeam.env={REDLINE_RUN:dir};
    let counts=[0,0], current=[0,0], polls=0, terminalAt;
    const primary = Error('first body failure');
    const streamFault = Error('gzip destination failure');
    class CDP {
      constructor() {this.readyState=1;queueMicrotask(()=>this.onopen());}
      send(text) {
        const c=JSON.parse(text);events.push(c.method);
        if (c.method==='Browser.close') {
          terminalAt ??= events.length;
          if (mode==='close-fail'||mode==='body-fail') throw Error('close write failed');
          if (mode==='close-reject') {queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({id:c.id,error:{message:'close refused'}})}));return;}
          child.stdin.write('close');
        }
        let result={};
        if(c.method==='Target.getTargets') result={targetInfos:[{type:'page',targetId:'inert'}]};
        if(c.method==='Target.attachToTarget') result={sessionId:'inert-session'};
        if(c.method==='Runtime.evaluate') {
          const e=c.params.expression; let value=true;
          if(e==='__redlineLaunch') value={settled:true};
          else if(e.startsWith('({endpoint:')) value={endpoint:1,slot:0};
          else if(e.includes('fixtureEntry.cpu=true')) {
            polls++;
            if(mode==='body-fail' && polls===2) {terminalAt=events.length;throw primary;}
            if(mode==='cancel' && polls===2) {terminalAt=events.length;processSeam.emit('SIGTERM');return;}
            value={results:Array(8).fill(0),keys:[...current],counts:[...counts],endpoint:1,slot:0};
          }
          result={result:{value}};
        }
        queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({id:c.id,result})}));
      }
      close(){this.readyState=3;}
    }
    const realFS={...fs,
      existsSync:p=>String(p).endsWith('DevToolsActivePort')||fs.existsSync(p),
      readFileSync:(p,...a)=>String(p).endsWith('DevToolsActivePort')?'1\n/inert':fs.readFileSync(p,...a),
      createWriteStream:(p,...a)=>mode==='stream-fail'&&String(p).endsWith('stderr.gz')?
        new Writable({write(chunk,encoding,callback){terminalAt ??= events.length;callback(streamFault);}}):fs.createWriteStream(p,...a)};
    const requireSeam = n => {
      if(n==='fs') return realFS;
      if(n==='child_process') return {spawn:()=>child};
      if(n.endsWith('/test/static-server.js')) return {startStaticServer:async options=>{
        server=await require('../test/static-server.js').startStaticServer(options);
        server.on('close',()=>events.push('serverJoin'));return server;
      }};
      if(n.endsWith('/tools/redline-startup.cjs')) return {launch:async()=>{}};
      if(n.endsWith('/bound-input.cjs')) return {hold:async ({keys,sample})=>{
        const i=keys[0]===','?0:1;current[i]=128;counts[i]++;
        const s=await sample();current[i]=0;return {samples:[{...s,whollyDuringHold:true}]};
      }};
      if(n==='./redline-fixture-shutdown.cjs') {
        const real=require(n);
        return {...real,createLifecycle:options=>real.createLifecycle(mode==='delay-real'?options:{...options,exitWaitMs:50})};
      }
      return require(n);
    };
    // Strip only the CLI invocation, leaving the actual main/body/cleanup intact.
    source=source.slice(0,source.lastIndexOf('\nmain().catch'));
    context=vm.createContext({require:requireSeam,process:processSeam,console,Buffer,WebSocket:CDP,AbortController,
      setTimeout:(fn,ms,...a)=>setTimeout(fn,ms===10000&&mode!=='delay-real'?50:ms,...a),clearTimeout});
    vm.runInContext(source,context,{filename:name+'.cjs'});
    const began=Date.now();
    await vm.runInContext('main()',context).catch(e=>{error=e;});
    const leaked=server.listening;
    if(name.startsWith('old')) {
      assert(leaked,'oldFAIL must reproduce an actual listening HTTP leak');
      assert(!stdioClose,'oldFAIL returns before stream joins');
      assert.match(error.message,/actual Chrome exit missing/);
    } else {
      assert.equal(leaked,false,'server joined before caller settles');
      const cleanup=JSON.parse(fs.readFileSync(path.join(dir,'fixture-cleanup.json')));
      assert(cleanup.actualBrowserExit,'actual child wait is separate from stream EOF');
      assert(actualWait,'child exit observed before main returns');
      assert.equal(cleanup.streamEOF,mode!=='stream-fail');
      for(const n of mode==='stream-fail'?['stdout']:['stdout','stderr']) zlib.gunzipSync(fs.readFileSync(path.join(dir,'fixture-chrome-'+n+'.gz')));
      if(mode==='delay'||mode==='delay-real') {
        assert.match(error.message,/actual Chrome exit missing/);
        assert(events.indexOf('serverJoin')<events.indexOf('actualWait'),'server is independent of delayed child');
      }
      if(mode==='delay-real') assert(Date.now()-began>=10000,'actual unchanged 10-second wait');
      if(mode==='close-fail') assert.equal(error.message,'close write failed');
      if(mode==='close-reject') assert.match(error.message,/close refused/);
      if(mode==='body-fail') assert.equal(error,primary,'original failure object preserved');
      if(mode==='cancel') assert.match(error.message,/cancelled by SIGTERM/);
      if(mode==='normal') assert.equal(error,undefined);
      if(mode==='stream-fail') assert.equal(error,streamFault);
      assert.equal(events.slice(terminalAt).some(e=>e.startsWith('Input.')||e==='Runtime.evaluate'||e==='Page.captureScreenshot'),false);
      await assert.rejects(vm.runInContext("send('Input.dispatchKeyEvent')",context));
      await assert.rejects(vm.runInContext("event({method:'Target.attachedToTarget'})",context));
    }
    results.push({name,mode,oldFAIL:name.startsWith('old'),serverLeaked:leaked,error:error?.message});
    // Old path intentionally leaks; the harness owns and joins it after observing FAIL.
    if(server.listening) {server.closeAllConnections();await new Promise(r=>server.close(r));}
    if(child.exitCode===null&&child.signalCode===null) child.kill('SIGKILL');
    await waited;await pipes;
    assert(actualWait);assert(stdioClose);
    results.at(-1).actualWait=actualWait;results.at(-1).stdioClose=stdioClose;
  } finally {
    clearTimeout(watchdog);
    if(server?.listening){server.closeAllConnections();await new Promise(r=>server.close(r));}
    if(child && child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await once(child,'close');}
  }
}

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  await composition('old-delay',oldSource(),'delay');
  const source=fs.readFileSync(path.join(__dirname,'redline-native-fixture.cjs'),'utf8');
  for(const mode of ['delay','delay-real','close-fail','close-reject','body-fail','cancel','stream-fail','normal']) await composition('new-'+mode,source,mode);
  // A stream rejection must not skip server/child cleanup or replace a prior error.
  let closed=0;const first=Error('stream failure');
  const lifecycle=createLifecycle({resources:()=>({streams:[Promise.reject(first)]}),closeBrowser:()=>{},stopProtocol:()=>{closed++;}});
  await assert.rejects(lifecycle.run(async()=>{throw Error('body failure');}),/body failure/);
  assert.equal(closed,1);
  // Cancellation while the actual HTTP listen is still being acquired must join
  // the body before taking the resource inventory; no child may start afterward.
  let acquired,bodyJoined=false,spawned=false;
  const cancellation=new AbortController();
  const late=createLifecycle({resources:()=>({server:acquired}),signal:cancellation.signal,
    closeBrowser:()=>{},stopProtocol:()=>{}});
  const cancelled=late.run(async()=>{
    try {
      await sleep(20);
      acquired=await require('../test/static-server.js').startStaticServer({root});
      late.guard();spawned=true;
    } finally {bodyJoined=true;}
  });
  cancellation.abort(Error('cancelled during acquisition'));
  await assert.rejects(cancelled,/cancelled during acquisition/);
  assert(bodyJoined);assert(acquired);assert.equal(acquired.listening,false);assert.equal(spawned,false);
  assert.equal(late.close(),late.close(),'cleanup is idempotent');
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,results},null,2));
  console.log(JSON.stringify({passed:true,results}));
})().catch(e=>{console.error(e);process.exitCode=1;});
