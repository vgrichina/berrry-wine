'use strict';
// Harmless Chromium fixture: real DOM listener checkpoints, production bridge,
// renderer, host and full compiled COM GetDeviceData; serialized ordinary
// execute()/transport/throttle/timed/pulse. Synthetic guest object and identity,
// no game/media launch. Run inputs/profiles live only in /dev/shm.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const vm = require('node:vm'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const retained = root + '/scratch/runs/20261111-mw3-complete-helper-cockpit-0500';
const {BASE, SIZE} = require('../lib/region-map.generated');
const {attach, correlate, correlateEdges} = require('./mw3-throttle-observer.cjs');
const {readCompletion} = require('./mw3-keyboard-completion.js');
const wait = ms => new Promise(r => setTimeout(r, ms));

test('trusted post-producer receipts through serialized ordinary movement controller', {timeout:90000}, async t => {
  const dir = fs.mkdtempSync('/dev/shm/mw3-key-witness-');
  const evidence = process.env.MW3_WITNESS_EVIDENCE;
  const saveEvidence = (name, value) => {
    if (evidence) fs.writeFileSync(path.join(evidence, name), JSON.stringify(value, null, 2) + '\n');
  };
  cp.execFileSync('python3', ['-B', root+'/tools/mw3-retention-repair.py', retained, dir]);
  const source = fs.readFileSync(dir+'/browser.cjs', 'utf8');
  // Independent fixed watchdog is observable BEFORE Chrome is created. Normal
  // completion joins its actual wait and EOF, just as it joins Chrome's.
  const deadline = Date.now()+75000;
  const watchdog = cp.spawn('python3', ['-B', '-c', `
import os,sys,time,json,signal
from pathlib import Path
r=Path(sys.argv[1]);due=int(sys.argv[2])/1000
(r/'armed').write_text(json.dumps(dict(pid=os.getpid(),deadline=due,independent=True)))
while time.time()<due and not (r/'done').exists():time.sleep(.05)
expired=not (r/'done').exists()
if expired and (r/'chrome-pid').exists():
 try:os.killpg(int((r/'chrome-pid').read_text()),signal.SIGTERM)
 except ProcessLookupError:pass
print(json.dumps(dict(expired=expired,deadline=due)))
`, dir, String(deadline)], {stdio:['ignore','pipe','pipe']});
  const join = child => {
    const streams = {}, eof = {};
    for (const name of ['stdout','stderr']) {
      const chunks = []; child[name].on('data', b=>chunks.push(b));
      child[name].once('end', ()=>{eof[name]=true;streams[name]=Buffer.concat(chunks).toString();});
    }
    return new Promise(resolve=>child.once('close', (status, signal)=>resolve({pid:child.pid,status, signal,
      actualParentWait:true, separateEOF:eof, streams})));
  };
  const watchWait = join(watchdog);
  while (!fs.existsSync(dir+'/armed')) { assert.equal(watchdog.exitCode,null); await wait(10); }
  saveEvidence('watchdog-armed.json', JSON.parse(fs.readFileSync(dir+'/armed')));
  let browser, chromeWait, server, socket, sequence = 0, page;
  const pending = new Map();
  const send = (method, params={}, sessionId=page) => new Promise((resolve,reject)=>{
    const id=++sequence, timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP unknown; no replay: '+method));},10000);
    pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,sessionId}));
  });
  const evaluate = async expression => {
    const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;
  };
  try {
    server=await require('../test/static-server').startStaticServer({root,crossOriginIsolated:true});
    browser=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run',
      '--remote-debugging-port=0','--user-data-dir='+dir+'/profile','about:blank'],
      {stdio:['ignore','pipe','pipe'],detached:true});
    chromeWait=join(browser);fs.writeFileSync(dir+'/chrome-pid',String(browser.pid));
    const ep=await require('./mw3-devtools-endpoint.cjs').waitForEndpoint(dir+'/profile/DevToolsActivePort',browser,{deadline});
    socket=new WebSocket('ws://127.0.0.1:'+ep.debugPort+ep.browserPath);
    await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
    socket.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(!p)return;
      pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);};
    const target=(await send('Target.getTargets',{},undefined)).targetInfos.find(x=>x.type==='page');
    page=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},undefined)).sessionId;
    await send('Page.enable');await send('Runtime.enable');
    // Extract the EXACT prepared ordinary early observer, including its
    // serialized function, rather than writing a second fixture observer.
    const begin=source.indexOf(" await send('Page.addScriptToEvaluateOnNewDocument',{source:`globalThis.__nativeEvidence=");
    const end=source.indexOf('},pageSession);',begin)+15;
    assert(begin>=0&&end>begin);
    await vm.runInNewContext('(async()=>{'+source.slice(begin,end)+'})()', {send,pageSession:page,inputBase:BASE.DI_MOUSE_INPUT_STATE});
    await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/index.html?debug&no-log'});
    for(let i=0;i<150;i++){
      if(await evaluate("typeof Win98Renderer==='function'&&typeof createWindowHost==='function'&&!!window.browserInput"))break;
      await wait(50);
    }
    const setup = async () => {
      const bytes=await(await fetch('/build/wine-assembly.wasm')).arrayBuffer();
      const module=await WebAssembly.compile(bytes);
      const memory=new WebAssembly.Memory({initial:8192,maximum:32768,shared:true});
      const renderer=Object.create(Win98Renderer.prototype);
      Object.assign(renderer,{inputQueue:[],windows:{},_stepWakeHooks:new Set(),_diKeyboardSequence:0,
        wasm:{exports:{},_runsInGuestWorker:true}});
      renderer.wasm._guestWorker=true;renderer._guestWorkerWasms=new WeakSet([renderer.wasm]);
      // A harmless ordinary bridge owner, without starting an app.
      runningApps.push({wine:{renderer,memory,running:true}});
      const table={};
      for(const i of WebAssembly.Module.imports(module)) table[i.name]=i.kind==='memory'?memory:
        ()=>{throw Error('unexpected import '+i.name);};
      table.di_keyboard_buffer=createWindowHost({renderer,getMemory:()=>memory.buffer},{}).imports.di_keyboard_buffer;
      table.get_ticks=()=>Date.now()>>>0;
      for(const name of ['beep_process_begin','beep_thread_begin','log','log_i32','log_api_exit'])table[name]=()=>{};
      let ex;
      const observer=ATTACH(table,{getExports:()=>ex,memory,readCompletion:READ,
        objectsBase:LAYOUT.objectsBase,objectsSize:LAYOUT.objectsSize});
      ex=(await WebAssembly.instantiate(module,{host:table})).exports;
      ex.init_thread(0,0x400000,0x400000,0x600000,0x7500000,0x7500010,2);
      const d=new DataView(memory.buffer),g=a=>ex.guest_to_wasm(a)>>>0,put=(a,v)=>d.setUint32(a,v>>>0,true);
      put(LAYOUT.thunk,0x80000000);put(LAYOUT.thunk+4,1094);
      put(LAYOUT.thunk+8,0x80000000);put(LAYOUT.thunk+12,LAYOUT.acquire);
      [7,0,1,128,0x700,256,0,0x100].forEach((v,i)=>put(LAYOUT.objectsBase+i*4,v));
      put(g(0x520004),0);new Uint8Array(memory.buffer,g(0x4f76c8),2).set([0xeb,0xfe]);
      const call=(index,args)=>{
        ex.set_esp(0x510000);ex.set_eip(0x7500000+index*8);ex.clear_yield();
        [0x4f76c8,...args].forEach((v,i)=>put(g(0x510000+i*4),v));ex.run(1);
        if(ex.get_eax()!==0)throw Error('compiled HRESULT');
      };
      call(1,[0x520000]);
      const poll=()=>{put(g(0x540000),128);call(0,[0x520000,16,0x530000,0x540000,0]);};
      globalThis.fixture={renderer,observer,poll};
      globalThis.instance={exports:ex};globalThis.endpointIdentity='fixture';globalThis.workerSlot=0;
      globalThis.__mw3ThrottleBinding={beforeInstantiation:true,publishedObserver:'ce3ba1da0381304cf5ecc61e9db169cf71936708'};
      globalThis.__mw3ThrottleObservers={ArrowUp:observer,Digit0:observer};
      // Browser bridge once-per-page. No hand-written key producer listener.
      browserInput.wireCanvasInput(document.getElementById('screen'),renderer,{runningApps,debugMode:true});
      // These diagnostics expose the checkpoint which broke the old witness.
      for(const type of ['keydown','keyup'])addEventListener(type,e=>{
        const row=__nativeEvidence.findLast(r=>r.type===type&&r.code===e.code);
        if(row)row.bridgeAfter=renderer._diKeyboardSequence;
      },true);
      fixture.pollTimer=setInterval(poll,10);
      return {isolated:crossOriginIsolated,wired:browserInput.isWired(),
        moduleSHA256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('')};
    };
    const api=JSON.parse(fs.readFileSync(root+'/src/api_table.json'));
    const layout={objectsBase:BASE.DX_OBJECTS,objectsSize:SIZE.DX_OBJECTS,thunk:BASE.THUNK_BASE,
      acquire:api.findIndex(x=>(typeof x==='string'?x:x.name)==='IDirectInputDevice_Acquire')};
    const setupSource='('+setup.toString().replace('ATTACH', '('+attach+')').replace('READ','('+readCompletion+')').replaceAll('LAYOUT',JSON.stringify(layout))+')()';
    const module=await evaluate(setupSource);assert(module.isolated&&module.wired);
    const identity=Object.fromEntries(require(retained+'/bound-input.cjs').FIELDS.map(n=>[n,'fixture-'+n]));
    // Synthetic owner binding is explicit. All key events, producer receipts,
    // timed screenshots and compiled completions below are real Chromium.
    const chain={readLive:async()=>({identity,worker:{sessionId:'fixture'}}),
      admit:async(review,fn)=>fn({live:{identity}})};
    const preparedThrottle={exports:{}};
    vm.runInNewContext(fs.readFileSync(dir+'/throttle.cjs','utf8'),{exports:preparedThrottle.exports,
      require:n=>n.endsWith('mw3-throttle-observer.cjs')?require('./mw3-throttle-observer.cjs'):
        n==='./bound-input.cjs'?require(retained+'/bound-input.cjs'):require(n)});
    const results=[];
    // Each ordinary movement arm is single-use; reload a fresh observer while
    // retaining the same actual DOM bridge and controller for each next case.
    for(const [mode,key] of [['normal','ArrowUp'],['loaded','ArrowUp'],['ignored','ArrowUp']]) {
      if(mode!=='normal') await evaluate(`{
        fixture.observer.restore();
      }`);
      // attach() captured imports cannot be replaced post-instantiation.
      // A fresh document gives each single-use observer its ordinary lifetime.
      if(mode!=='normal') {
        await send('Page.reload');
        for(let i=0;i<150;i++){if(await evaluate("typeof Win98Renderer==='function'&&typeof createWindowHost==='function'&&!!window.browserInput"))break;await wait(50);}
        await evaluate(setupSource);
        if(mode==='loaded')await evaluate(`fixture.load=setInterval(()=>{const until=performance.now()+25;while(performance.now()<until){}},50);true`);
        if(mode==='ignored')await evaluate(`{const input=document.createElement('input');document.body.append(input);input.focus();}`);
      }
      const out=dir+'/'+mode;fs.mkdirSync(out);fs.mkdirSync(out+'/commands');
      const saves={};
      const save=(n,v)=>{assert.notEqual(v,undefined,'missing ordinary output '+n);saves[n]=v;fs.writeFileSync(out+'/'+n,JSON.stringify(v));};
      const bound=require(retained+'/bound-input.cjs');
      const latest={label:'reviewed',sha256:'fixture-sha'};
      const scopedRequire=n=>n==='./throttle.cjs'?preparedThrottle.exports:
        n==='./timed.cjs'?require(retained+'/timed.cjs'):
        n==='./seal.cjs'?{seal(){}}:require(n.startsWith('.')?path.resolve(retained,n):n);
      let nativeCount=0;
      const controllerSend=async(method,params,session)=>{
        if(method.startsWith('Input.'))nativeCount++;
        const value=await send(method,params,session);
        // Unrelated trusted edges between target DOWN/UP must not become the
        // target's receipt or imply that its release is DOWN's sequence + 1.
        if(mode==='loaded'&&method==='Input.dispatchKeyEvent'&&params.type==='keyDown'){
          await send(method,{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37},session);
          await send(method,{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37},session);
        }
        return value;
      };
      const context=vm.createContext({require:scopedRequire,process:{env:{}},root,run:dir,out,assert,
        Date,Promise,setTimeout,clearTimeout,wait,save,evaluate,chain,bound,
        send:controllerSend,pageSession:page,pointer:{x:320,y:240},deadline:Date.now()+60000,
        commandWorkEnd:Infinity,preInputObserved:true,latest,sha:()=>latest.sha256,
        observation:require(retained+'/observation.cjs').create(),
        fs:{...fs,readFileSync:file=>file.endsWith('-review.json')?'{}':file.endsWith('reviewed.png')?Buffer.from('fixture'):fs.readFileSync(file)},
        ordinary:require(retained+'/input.cjs'),capture:async()=>{},captureRaw:async()=>{}});
      const start=source.indexOf('async function execute('),end=source.indexOf('\n(async()=>{',start);
      vm.runInContext(source.slice(start,end),context);
      const runEnd=Date.now()+60000;
      fs.writeFileSync(out+'/execution-window.json',JSON.stringify({browserStop:new Date(runEnd).toISOString()}));
      const workEnd=Date.now()+8000;
      const command={id:mode,action:'key',key,holdMs:key==='ArrowUp'?2000:1000,
        waitMs:0,label:mode,reviewRef:'reviewed',timing:{workEnd,ackEnd:workEnd+2000,runEnd}};
      fs.writeFileSync(out+'/commands/0.json',JSON.stringify(command));
      const transport=require('./mw3-run-transport.cjs');
      let failure;
      try{await transport.consume(out,0,vm.runInContext('execute',context));}catch(error){failure=error;}
      const allEdges=saves[mode+'-throttle-edges.json'];
      const edges=allEdges.filter(e=>e.code===(key==='0'?'Digit0':'ArrowUp'));
      const raw=saves[mode+'-throttle-raw.json'], pulse=saves['input-'+mode+'-pulse.json'];
      assert.equal(edges.length,2);assert(edges.every(e=>e.trusted));
      if(mode==='ignored'){
        assert(failure);assert.match(String(failure),/post-producer edge witness/);
        assert(edges.every(e=>!e.keyWitness),'trusted browser event alone is insufficient');
        assert(raw.records.every(r=>r.decoded.records.length===0));
        const before=nativeCount;
        await assert.rejects(()=>transport.consume(out,0,()=>{throw Error('unexpected replay')}));
        await assert.rejects(()=>transport.request(out,'later',{action:'capture',waitMs:0}));
        assert.equal(nativeCount,before);
        results.push({mode,edges,pulse,raw,failure:String(failure),stickyNoReplay:true,nativeCount});
        continue;
      }
      assert(!failure,mode+': '+String(failure));
      assert(edges.every(e=>e.after?.diSequence!==e.bridgeAfter), 'actual native capture microtask precedes producer');
      assert(edges.every(e=>e.keyWitness.records[0].sequence===e.bridgeAfter));
      if(mode==='loaded')assert.equal(edges[1].keyWitness.records[0].sequence-edges[0].keyWitness.records[0].sequence,3);
      assert.throws(()=>correlate(raw,{code:edges[0].code,downAt:edges[0].at,upAt:edges[1].at,
        downSequence:edges[0].after?.diSequence,upSequence:edges[1].after?.diSequence}),/sequence|missing/);
      assert(saves[mode+'-throttle-correlation.json'].consumedDuringHold);
      const reject=mutate=>{const bad=structuredClone(edges);mutate(bad);assert.throws(()=>correlateEdges(raw,bad,pulse,edges[0].code));};
      reject(e=>delete e[0].keyWitness);
      reject(e=>e[0].keyWitness.records[0].sequence=e[0].after?.diSequence);
      reject(e=>e[0].keyWitness.records[0].sequence+=10);
      reject(e=>e.push(structuredClone(e[0])));
      reject(e=>e[0].keyWitness.records.push({...e[0].keyWitness.records[0]}));
      reject(e=>e[0].keyWitness.records[0].vk=32);
      reject(e=>e[0].keyWitness.records[0].down=false);
      reject(e=>e[0].keyWitness.trusted=false);
      reject(e=>e[0].keyWitness.completed=false);
      reject(e=>e[0].keyWitness.errors.push('producer failed'));
      const bad=structuredClone(raw);bad.records.push(structuredClone(raw.records.find(r=>r.decoded.records.length)));
      assert.throws(()=>correlateEdges(bad,edges,pulse,edges[0].code),/duplicate/);
      const unrelated=structuredClone(raw);for(const r of unrelated.records)for(const edge of r.decoded.records)edge.offset=0x39;
      assert.throws(()=>correlateEdges(unrelated,edges,pulse,edges[0].code),/missing/);
      results.push({mode,edges,allEdges,pulse,raw,correlation:saves[mode+'-throttle-correlation.json'],
        timing:saves[mode+'-during-timing.json']});
    }
    saveEvidence('trusted-controller-results.json',{passed:true,module,results,
      scope:'actual native Chrome ordering and ordinary serialized controller; synthetic guest object/owner identity; no original'});
    await evaluate('clearInterval(fixture.pollTimer);clearInterval(fixture.load);true');
    await send('Browser.close',{},undefined);
    const receipt=await chromeWait;assert.equal(receipt.status,0);assert.deepEqual(receipt.separateEOF,{stdout:true,stderr:true});
    saveEvidence('chrome-parent-wait.json',receipt);
  } finally {
    socket?.close();
    for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('fixture closed'));}
    if(browser&&browser.exitCode===null&&browser.signalCode===null)browser.kill('SIGTERM');
    if(chromeWait)saveEvidence('chrome-final-wait.json',await chromeWait);
    if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
    fs.writeFileSync(dir+'/done','done');
    const receipt=await watchWait;saveEvidence('watchdog-parent-wait.json',receipt);
    assert.equal(receipt.status,0);assert(!JSON.parse(receipt.streams.stdout).expired);
    fs.rmSync(dir,{recursive:true,force:true});
    saveEvidence('local-stop-receipt.json',{createdBoxes:0,browserPid:browser?.pid,
      browserStatus:browser?.exitCode,watchdogPid:watchdog.pid,watchdogStatus:receipt.status,
      fixedDeadline:deadline,temporaryDirectory:dir,temporaryDirectoryAbsent:!fs.existsSync(dir),
      browserActualWaitAndEOF:!!chromeWait,watchdogActualWaitAndEOF:true,serverClosed:true});
  }
});
