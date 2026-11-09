'use strict';
// Q3 uses the existing host init/compile seam (WINE_REDLINE_STARTUP). The
// shared provider is read-only; exact transforms add Q3's live flag checks.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {SELECTED} = require('../lib/redline-startup-admission.js');
const sha = b => createHash('sha256').update(b).digest('hex');
function replace(source, before, after) {
  assert.equal(source.split(before).length, 2, 'Q3 startup provider seam changed');
  return source.replace(before, after);
}
function admissionSource(root = path.resolve(__dirname, '..')) {
  let s = fs.readFileSync(path.join(root, 'lib/redline-startup-admission.js'), 'utf8');
  s = replace(s, 'function sameOwner() {', `function flags(l) { return {
    threads:scope.WINE_THREADS, isolated:scope.crossOriginIsolated,
    serial:!!scope.WINE_THREADS_SERIAL, gpu:!!l.d3dimGpu,
    shared:!!l.sharedRenderWorker, lazy:l.d3dimLazySync!==false,
    pageGpu:scope.WINE_D3DIM_GPU===true, pageLazy:scope.WINE_D3DIM_LAZY_SYNC!==false
  }; }
    function sameOwner() {`);
  s = replace(s, "const w = owner.wine, g = w.guestWorker, l = g?.link;", `const w = owner.wine, g = w.guestWorker, l = g?.link;
      check(scope.WINE_THREADS===true && scope.crossOriginIsolated===true &&
        l?.sharedRenderWorker===true && owner.flags.gpu===owner.flags.pageGpu &&
        owner.flags.lazy===owner.flags.pageLazy && JSON.stringify(flags(l))===JSON.stringify(owner.flags),
        'owning Worker flags changed');`);
  s = replace(s, 'instance: wine.instance, memory: wine.memory, token: scope.crypto.randomUUID()',
    'instance: wine.instance, memory: wine.memory, flags:Object.freeze(flags(link)), token: scope.crypto.randomUUID()');
  s = replace(s, 'token: owner.token, endpoint: owner.endpoint, slot: 0,',
    'token: owner.token, endpoint: owner.endpoint, slot: 0, flags:owner.flags,');
  s = replace(s, 'proof.sha256 === record.sha256 && proof.bytes === record.bytes &&',
    'proof.sha256 === record.sha256 && proof.bytes === record.bytes && JSON.stringify(proof.flags)===JSON.stringify(owner.flags) &&');
  return s;
}

const WORKER_READ = `(() => {
  if(typeof endpointIdentity==='undefined'||typeof workerSlot==='undefined'||
     typeof instance==='undefined'||!instance||typeof d3dimGpuEnable==='undefined') return null;
  if(!globalThis.__q3StartupInstance) Object.defineProperty(globalThis,'__q3StartupInstance',
    {value:{instance,token:crypto.randomUUID()}});
  const s=globalThis.__q3StartupInstance;
  if(s.instance!==instance) throw Error('Q3 startup Worker instance replaced');
  return {endpoint:endpointIdentity,slot:workerSlot,instance:s.token,gpu:d3dimGpuEnable};
})()`;

// The generated fixture has no WineAssembly host. Give its SAME production
// GuestWorkerLink the compile/park seam before the first PE/export call.
function composeFixture(source, root) {
  source = replace(source,
    "const module=await WebAssembly.compile(await(await fetch('/build/wine-assembly.wasm')).arrayBuffer());",
    `const admission=WINE_REDLINE_STARTUP;
 const module=await admission.compile(await(await fetch('/build/wine-assembly.wasm')).arrayBuffer());`);
  source = replace(source, '});await link.start();', '});try {await link.start();');
  source = replace(source, "const raw=(name,...args)=>link.callExport(name,...args);", `const owner={instance:{},memory,_wasmModule:module,guestWorker:{module,link}};
 await admission.park(owner);
 const raw=(name,...args)=>link.callExport(name,...args);`);
  source = replace(source, 'globalThis.__generatedReady=true;', `globalThis.__generatedReady=true;
 } catch(error) {
  let result;try {await link.stop();await manager.stop();result={ok:true};}
  catch(cleanupError){result={ok:false,error:String(cleanupError)};}
  admission.retired(result);throw error;
 }`);
  source = replace(source, "'<script>globalThis.runningApps=[];('",
    `'<script>globalThis.runningApps=[];globalThis.WINE_THREADS=true;'+${JSON.stringify(admissionSource(root))}+
';RedlineStartupAdmission.install({WineAssembly:{},deadline:Date.now()+18500});globalThis.__q3FixtureLaunch=(' `);
  return source;
}

async function launch({evaluate, send, workers, pageSession, deadline, fixture = false,
  wait = ms => new Promise(r => setTimeout(r, ms)), now = Date.now, save = () => {},
  source = admissionSource()}) {
  const cap = Math.min(deadline, now() + 18500);
  let armed = fixture;
  const checkTime = () => assert(now() < cap, 'Q3 startup deadline');
  try {
    checkTime();
    if (!fixture) {
      await evaluate(`(() => {
        if(typeof runningApps==='undefined'||runningApps.length!==0||typeof WineAssembly==='undefined'||typeof shell==='undefined')
          throw Error('Q3 startup requires neutral ready document');
        ${source}
        RedlineStartupAdmission.install({WineAssembly,deadline:${cap}});
        return WINE_REDLINE_STARTUP.status();
      })()`);
      armed = true;
      await evaluate('WineAssembly.getWasmModule().then(() => WINE_REDLINE_STARTUP.status())');
      checkTime();
      await evaluate(`(() => {
        if(WINE_REDLINE_STARTUP.status().phase!=='compiled') throw Error('Q3 compile admission absent');
        globalThis.__q3Launch={settled:false,error:null};
        __q3Launch.promise=Promise.resolve(shell.launchApp('quake3_demo')).then(
          ()=>{__q3Launch.settled=true},e=>{__q3Launch.error=String(e);__q3Launch.settled=true});
        return true;
      })()`);
    }
    let status;
    while(now() < cap) {
      status = await evaluate("typeof WINE_REDLINE_STARTUP==='undefined'?null:WINE_REDLINE_STARTUP.status()");
      assert(!status?.failure, status?.failure);
      if(status?.phase==='parked') break;
      assert(!await evaluate(fixture ? '!!globalThis.__generatedError' : '__q3Launch.settled'), 'Q3 launch settled without park');
      await wait(20);
    }
    assert.equal(status?.phase, 'parked', 'Q3 preCPU/preDLLmain barrier not reached');
    assert.equal(status.selected.sha256, SELECTED.sha256);
    assert.equal(status.selected.bytes, SELECTED.bytes);
    assert(status.flags.threads===true && status.flags.isolated===true && status.flags.shared===true, 'Q3 Worker flags');
    const matches=[];
    for(const w of workers.values()) {
      if(w.closed || !w.url.includes('guest-worker')) continue;
      const live=await evaluate(WORKER_READ,w.sessionId);
      if(live?.endpoint===status.endpoint && live.slot===status.slot) matches.push({w,live});
    }
    assert.equal(matches.length,1,'unique live Q3 owning Worker required');
    const {w,live}=matches[0];
    assert.equal(live.slot,0,'Q3 owning slot');
    assert.equal(live.gpu,status.flags.gpu,'Q3 owning Worker GPU flag');
    assert(typeof live.instance==='string' && live.instance.length>0,'Q3 owning instance');
    const scripts=[...new Map(w.scripts.map(s=>[s.scriptId,s])).values()];
    assert.equal(scripts.length,1,'unique actual Q3 Worker module required');
    const r=await send('Debugger.getScriptSource',{scriptId:scripts[0].scriptId},w.sessionId);
    assert(r.bytecode,'actual Q3 Worker bytecode required');
    const bytes=Buffer.from(r.bytecode,'base64');
    assert.equal(sha(bytes),SELECTED.sha256,'Q3 live selected CPU SHA-256');
    assert.equal(bytes.length,SELECTED.bytes,'Q3 live selected CPU length');
    assert.deepEqual(await evaluate(WORKER_READ,w.sessionId),live,'Q3 Worker identity changed');
    assert.deepEqual(await evaluate('WINE_REDLINE_STARTUP.status()'),status,'Q3 parked owner changed');
    checkTime();assert(!w.closed,'Q3 owning Worker detached');
    const proof={token:status.token,endpoint:status.endpoint,slot:status.slot,flags:status.flags,
      sha256:sha(bytes),bytes:bytes.length,workerTarget:w.targetId,workerInstance:live.instance};
    const receipt=await evaluate(`WINE_REDLINE_STARTUP.release(${JSON.stringify(proof)})`);
    assert.equal(receipt.phase,'released','Q3 explicit release required');
    save('startup-admission.json',{receipt,fixture,nativeQualified:false});
    return receipt;
  } catch(error) {
    if(armed) {
      try { error.startupRefusal=await evaluate(`(async () => {
        WINE_REDLINE_STARTUP.abort('Q3 caller refusal');
        if(globalThis.__q3FixtureLaunch) await __q3FixtureLaunch;
        if(globalThis.__q3Launch) await __q3Launch.promise;
        return WINE_REDLINE_STARTUP.status();
      })()`); }
      catch(cleanupError) {error.cleanupError=String(cleanupError);}
    }
    save('startup-refusal.json',{error:String(error),refusal:error.startupRefusal??null,cleanupError:error.cleanupError??null,noReplay:true});
    throw error;
  }
}
module.exports={launch,admissionSource,composeFixture,WORKER_READ,SELECTED};
