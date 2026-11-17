#!/usr/bin/env node
'use strict';

// Standalone authored controls. No production imports, Wasm, game inputs or
// existing browser endpoint. --browser creates a fresh disposable fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const {spawn} = require('node:child_process');
const {Worker, MessageChannel} = require('node:worker_threads');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// state: terminal, active, absolute deadline, ack, generation, script entered,
// message entered, ready published. Terminal is sticky for this generation.
function physicalGuard() {
  self.onmessage = event => {
    const {state, port, generation, delayReady = 0} = event.data;
    const s = new BigInt64Array(state);
    Atomics.store(s, 6, BigInt(Date.now()));
    const unknown = reason => {
      Atomics.compareExchange(s, 0, 0n, 1n);
      port.postMessage({t:'PERMANENT_UNKNOWN', reason, generation, at:Date.now()});
      self.close();
    };
    if (delayReady) Atomics.wait(s, 0, 0n, delayReady);
    if (Atomics.load(s, 4) !== BigInt(generation) || Atomics.load(s, 0) !== 0n)
      return unknown('retired generation');
    if (BigInt(Date.now()) >= Atomics.load(s, 2)) return unknown('startup expired');
    Atomics.store(s, 7, BigInt(Date.now()));
    Atomics.store(s, 3, 0n); Atomics.notify(s, 3);
    port.postMessage({t:'ready', generation, at:Date.now(), fixedMilliseconds:3000});
    for (;;) {
      if (Atomics.load(s, 4) !== BigInt(generation)) return unknown('generation replaced');
      if (Atomics.load(s, 0) !== 0n) { self.close(); return; }
      const active = Atomics.load(s, 1);
      if (active === -1n) {
        port.postMessage({t:'stopped', generation, at:Date.now()});
        Atomics.store(s, 3, -1n); Atomics.notify(s, 3); self.close(); return;
      }
      if (active > 0n) {
        Atomics.store(s, 3, active); Atomics.notify(s, 3);
        if (BigInt(Date.now()) >= Atomics.load(s, 2) && Atomics.load(s, 1) === active)
          return unknown('operation expired');
      }
      Atomics.wait(s, 1, active, 2);
    }
  };
}

function newState() {
  const state = new SharedArrayBuffer(64), s = new BigInt64Array(state);
  const generation = crypto.randomInt(1, 0x7fffffff), start = Date.now();
  Atomics.store(s, 2, BigInt(start + 3000));
  Atomics.store(s, 3, -2n); Atomics.store(s, 4, BigInt(generation));
  return {state, s, generation, start};
}

async function nodeControl(mode) {
  const {state, s, generation, start} = newState();
  const channel = new MessageChannel(), receipts = [], events = [];
  channel.port1.on('message', message => receipts.push({...message, deliveredAt:Date.now()}));
  const source = `const {parentPort,workerData}=require('node:worker_threads');
    global.self={close(){parentPort.close();},set onmessage(fn){parentPort.on('message',data=>fn({data}));}};
    Atomics.store(new BigInt64Array(workerData),5,BigInt(Date.now()));
    (${physicalGuard})();`;
  const worker = new Worker(mode==='startFailure'?"throw Error('authored startup failure');":source,
    {eval:true, workerData:state, stdout:true, stderr:true});
  const threadId=worker.threadId;
  let stdout='', stderr='', stdoutEOF=false, stderrEOF=false, error=null;
  worker.stdout.on('data', b => stdout += b); worker.stderr.on('data', b => stderr += b);
  worker.stdout.on('end', () => {stdoutEOF=true;}); worker.stderr.on('end', () => {stderrEOF=true;});
  worker.on('error', e => {error=String(e); Atomics.store(s, 0, 1n);});
  const exit = new Promise(resolve => worker.once('exit', code => resolve({code, at:Date.now()})));
  const terminal = reason => {
    Atomics.compareExchange(s, 0, 0n, 1n); events.push({t:'terminal', reason, at:Date.now()});
  };
  let actualRequests=0, refused=0;
  const request = () => {
    if (Atomics.load(s, 0) !== 0n || Atomics.load(s, 4) !== BigInt(generation)) {refused++; return false;}
    actualRequests++; return true;
  };
  worker.postMessage({state, port:channel.port2, generation, delayReady:mode==='lateACK'?3100:0}, [channel.port2]);
  let closure;
  try {
    if (mode==='earlyEOF') {await worker.terminate(); terminal('earlyEOF');}
    else if (mode==='cancel') {terminal('cancel');}
    else {
      while (Atomics.load(s, 3)===-2n && Date.now()<start+3000 && Atomics.load(s, 0)===0n) await sleep(2);
      if (Atomics.load(s, 3)!==0n || Date.now()>=start+3000) terminal('startup deadline');
      else if (mode==='generation') {Atomics.add(s, 4, 1n); terminal('generation replaced');}
      else {
        const armedAt=Date.now(); Atomics.store(s, 2, BigInt(armedAt+3000));
        Atomics.store(s, 1, 1n); Atomics.notify(s, 1);
        while (Atomics.load(s, 3)!==1n && Date.now()<armedAt+3000) await sleep(2);
        assert.equal(Atomics.load(s, 3), 1n);
        events.push({t:'prearmed', at:Date.now(), deadline:armedAt+3000});
        assert(request());
        if (mode==='stalledParent') {
          // Parent event loop cannot enforce this deadline. The physical
          // watchdog must set terminal while the parent remains blocked.
          Atomics.wait(s, 5, Atomics.load(s, 5), 3150);
          assert.equal(Atomics.load(s, 0), 1n);
        } else {
          Atomics.store(s, 1, -1n); Atomics.notify(s, 1);
          while (Atomics.load(s, 3)!==-1n) await sleep(2);
        }
      }
    }
    if (mode!=='normal') {
      assert.equal(request(), false); assert.equal(request(), false);
      // Even a late publication cannot clear terminal or permit replay.
      Atomics.store(s, 3, 0n); assert.equal(request(), false);
    }
  } finally {
    if (mode==='normal') await exit;
    else {await sleep(mode==='lateACK'?150:10); await worker.terminate();}
    const waited=await exit;
    await sleep(5); channel.port1.close();
    assert(stdoutEOF && stderrEOF, 'actual Worker stdout and stderr EOF');
    if(mode==='startFailure') assert.match(error,/authored startup failure/);
    else assert.equal(error, null);
    assert.equal(actualRequests, mode==='normal'||mode==='stalledParent'?1:0);
    if (mode==='normal') {
      assert(receipts.some(x=>x.t==='ready'&&x.generation===generation));
      assert(receipts.some(x=>x.t==='stopped'&&x.generation===generation));
    }
    closure = {mode, generation, threadId, scriptSHA256:crypto.createHash('sha256').update(
      mode==='startFailure'?"throw Error('authored startup failure');":source).digest('hex'),
      start, finishedAt:Date.now(), fixedMilliseconds:3000,
      actualRequests, refused, terminal:Number(Atomics.load(s,0)), state:Array.from(s,String),
      receipts, events, exit:{...waited, actualWait:true, stdoutEOF, stderrEOF, stdout, stderr}};
  }
  return closure;
}

// Runs inside one entirely fresh browser fixture, with no native imports.
async function browserControl(mode, guardSource) {
  const state=new SharedArrayBuffer(64), s=new BigInt64Array(state), generation=1;
  const receipts=[], producerEvents=[], entryEvents=[], refusedRequestAttempts=[];
  let terminal=false,laterRequests=0;
  const start=Date.now(), deadline=start+3000;
  Atomics.store(s,2,BigInt(deadline)); Atomics.store(s,3,-2n); Atomics.store(s,4,1n);
  const channel=new MessageChannel();
  let finish=()=>{};
  channel.port1.onmessage=event=>{
    receipts.push({...event.data,deliveredAt:Date.now()});
    if(event.data.t==='PERMANENT_UNKNOWN'){terminal=true;Atomics.store(s,0,1n);finish();}
  };
  const entryName='guard-entry-'+crypto.randomUUID(),entryChannel=new BroadcastChannel(entryName);
  entryChannel.onmessage=event=>entryEvents.push({...event.data,deliveredAt:Date.now()});
  const source=`Atomics.store(new BigInt64Array(eventState),5,BigInt(Date.now()));`;
  // entry evidence is written before installing the child's message handler.
  const guard=`{const entry=new BroadcastChannel(${JSON.stringify(entryName)});
    entry.postMessage({t:'script-entry',at:Date.now()});entry.close();}
    ${mode==='startFailure'?"throw Error('authored browser startup failure');":''}
    self.onmessage=e=>{const eventState=e.data.state;${source}(${guardSource})();self.onmessage(e);};`;
  const guardURL=URL.createObjectURL(new Blob([guard],{type:'text/javascript'}));
  function producer() {
    self.onmessage=async e=>{
      const {state,port,url,mode,deadline}=e.data,s=new BigInt64Array(state);
      postMessage({t:'launch',at:Date.now()});
      const child=new Worker(url); child.onerror=e=>{Atomics.store(s,0,1n);postMessage({t:'child-error',error:e.message,at:Date.now()});};
      child.postMessage({state,port,generation:1,delayReady:mode==='lateACK'?3100:0},[port]);
      if(mode==='earlyEOF')child.terminate();
      if(mode==='cancel'){Atomics.store(s,0,1n);child.terminate();}
      if(mode==='sync') Atomics.wait(s,3,-2n,Math.max(0,deadline-Date.now()));
      else while(Atomics.load(s,3)===-2n&&Atomics.load(s,0)===0n&&Date.now()<deadline) await new Promise(r=>setTimeout(r,2));
      const ready=Atomics.load(s,3)===0n&&Atomics.load(s,0)===0n&&Date.now()<deadline;
      const readySeenAt=Date.now();
      if(!ready) Atomics.compareExchange(s,0,0n,1n);
      if(ready&&mode==='stalledParent'){
        const armedAt=Date.now();Atomics.store(s,2,BigInt(armedAt+3000));
        Atomics.store(s,1,1n);Atomics.notify(s,1);
        Atomics.wait(s,3,0n,Math.max(0,armedAt+3000-Date.now()));
        postMessage({t:'prearmed',at:Date.now(),deadline:armedAt+3000,ack:String(Atomics.load(s,3))});
        Atomics.wait(s,5,Atomics.load(s,5),3150);
      }
      if(ready&&mode==='generation'){
        Atomics.store(s,4,2n);Atomics.wait(s,5,Atomics.load(s,5),20);
      }
      if(ready&&Atomics.load(s,0)===0n){
        const previous=Atomics.load(s,3),stopDeadline=Date.now()+3000;
        Atomics.store(s,1,-1n);Atomics.notify(s,1);
        Atomics.wait(s,3,previous,Math.max(0,stopDeadline-Date.now()));
        if(Atomics.load(s,3)!==-1n)Atomics.store(s,0,1n);
      }
      const healthy=ready&&Atomics.load(s,0)===0n&&Atomics.load(s,3)===-1n;
      postMessage({t:healthy?'producer-ready':'PERMANENT_UNKNOWN',at:Date.now(),readySeenAt,
        stopAcknowledged:Atomics.load(s,3)===-1n,state:Array.from(s,String)});
      if(mode==='lateACK')await new Promise(resolve=>setTimeout(resolve,200));
      // End this generation. The host never reuses this endpoint.
      child.terminate(); self.close();
    };
  }
  const producerSource='('+producer+')()';
  const producerURL=URL.createObjectURL(new Blob([producerSource],{type:'text/javascript'}));
  const worker=new Worker(producerURL);
  const dispatchAfterTerminal=name=>{
    if(terminal||Atomics.load(s,0)!==0n||Atomics.load(s,4)!==1n){
      refusedRequestAttempts.push({name,at:Date.now(),terminal,sharedTerminal:String(Atomics.load(s,0))});
      return false;
    }
    laterRequests++;worker.postMessage({t:'forbidden-after-terminal',name});return true;
  };
  await new Promise(resolve=>{
    finish=()=>{clearTimeout(timer);resolve();};
    const timer=setTimeout(()=>{terminal=true;Atomics.store(s,0,1n);worker.terminate();resolve();},3500);
    worker.onmessage=event=>{
      producerEvents.push(event.data);
      if(event.data.t==='producer-ready'||event.data.t==='PERMANENT_UNKNOWN'){
        terminal=terminal||event.data.t==='PERMANENT_UNKNOWN';clearTimeout(timer);resolve();
      }
    };
    worker.postMessage({state,port:channel.port2,url:guardURL,mode,deadline},[channel.port2]);
  });
  if(terminal){dispatchAfterTerminal('replay');dispatchAfterTerminal('rebind');}
  await new Promise(resolve=>setTimeout(resolve,mode==='lateACK'?200:30));
  if(terminal)dispatchAfterTerminal('late-ready');
  worker.terminate();channel.port1.close();entryChannel.close();URL.revokeObjectURL(guardURL);URL.revokeObjectURL(producerURL);
  const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
  return {mode,start,deadline,finishedAt:Date.now(),terminal,receipts,entryEvents,producerEvents,state:Array.from(s,String),
    guardSourceSHA256:await digest(guard),producerSourceSHA256:await digest(producerSource),
    guardSourceBytes:new TextEncoder().encode(guard).length,producerSourceBytes:new TextEncoder().encode(producerSource).length,
    fixtureOrigin:location.origin,crossOriginIsolated,userAgent:navigator.userAgent,
    actualGLRequests:0,laterRequests,refusedRequestAttempts,urls:[guardURL,producerURL]};
}

async function runBrowser(mode) {
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'gl-watchdog-startup-'));
  const httpReceipts=[],html=Buffer.from('<!doctype html><title>Fresh watchdog startup fixture</title>');
  const server=http.createServer((req,res)=>{
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    httpReceipts.push({path:req.url,at:Date.now(),bytes:html.length,sha256:crypto.createHash('sha256').update(html).digest('hex')});
    res.end(html);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const chromeArgs=[process.env.CHROME||'/usr/bin/google-chrome',
    '--headless=new','--no-sandbox','--no-first-run','--disable-background-networking',
    '--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'
  ];
  // Start a unique PID blocked on stdin, arm its independent supervisor, then
  // exec Chrome in that same PID/group. Chrome cannot run before the receipt.
  const chrome=spawn('python3',['-u','-c',
    'import os,sys; assert sys.stdin.buffer.readline()==b"GO\\n"; os.execvp(sys.argv[1],sys.argv[1:])',
    ...chromeArgs],{stdio:['pipe','pipe','pipe'],detached:true});
  let stdout='',stderr='',stdoutEOF=false,stderrEOF=false;
  chrome.stdout.on('data',b=>stdout+=b);chrome.stderr.on('data',b=>stderr+=b);
  chrome.stdout.on('end',()=>{stdoutEOF=true;});chrome.stderr.on('end',()=>{stderrEOF=true;});
  const closed=new Promise(resolve=>chrome.once('close',(code,signal)=>resolve({code,signal})));
  const generation=fs.readFileSync('/proc/'+chrome.pid+'/stat','utf8').split(') ')[1].split(' ')[19];
  // Independent physical watchdog armed before any CDP/page request. It owns
  // only this new Chrome process group, and checks its PID generation.
  const supervisor=new Worker(`const {workerData:d,parentPort:p}=require('node:worker_threads'),fs=require('node:fs');
    const t=setTimeout(()=>{try{const g=fs.readFileSync('/proc/'+d.pid+'/stat','utf8').split(') ')[1].split(' ')[19];
      if(g===d.generation)process.kill(-d.pid,'SIGKILL');p.postMessage({expired:true});}catch(e){p.postMessage({absent:true});}},20000);
    p.on('message',()=>{clearTimeout(t);p.close();});p.postMessage({armed:true,pid:d.pid,generation:d.generation,at:Date.now()});`,
    {eval:true,workerData:{pid:chrome.pid,generation},stdout:true,stderr:true});
  const supervisorEvents=[];supervisor.on('message',m=>supervisorEvents.push(m));
  const supervisorThreadId=supervisor.threadId;
  let supervisorStdout='',supervisorStderr='',supervisorStdoutEOF=false,supervisorStderrEOF=false;
  supervisor.stdout.on('data',b=>supervisorStdout+=b);supervisor.stderr.on('data',b=>supervisorStderr+=b);
  supervisor.stdout.on('end',()=>{supervisorStdoutEOF=true;});supervisor.stderr.on('end',()=>{supervisorStderrEOF=true;});
  const supervisorExit=new Promise(resolve=>supervisor.once('exit',code=>resolve({code,at:Date.now()})));
  let ws, result, error=null, serial=0; const pending=new Map();
  let chromeReleasedAt=null;
  try {
    while(!supervisorEvents.some(x=>x.armed))await sleep(2);
    chromeReleasedAt=Date.now();chrome.stdin.end('GO\n');
    const file=path.join(profile,'DevToolsActivePort'), until=Date.now()+10000;
    while(!fs.existsSync(file)){assert(Date.now()<until,'Chrome startup');await sleep(25);}
    const port=Number(fs.readFileSync(file,'utf8').split('\n')[0]);
    const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
    ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
    ws.addEventListener('message',event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
    ws.addEventListener('close',()=>{for(const p of pending.values())p.reject(Error('fresh fixture CDP closed'));pending.clear();});
    await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve);ws.addEventListener('error',reject);});
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
    await send('Page.enable');await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
    for(;;){const r=await send('Runtime.evaluate',{expression:'crossOriginIsolated && location.hostname==="127.0.0.1"',returnByValue:true});if(r.result.value)break;await sleep(10);}
    const r=await send('Runtime.evaluate',{expression:'('+browserControl+')('+JSON.stringify(mode)+','+JSON.stringify(physicalGuard.toString())+')',returnByValue:true,awaitPromise:true});
    assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));result=r.result.value;
  } catch(e) {error=String(e.stack||e);}
  finally {
    // Fixture host stop; no more CDP/native commands after UNKNOWN.
    ws?.close();try{process.kill(-chrome.pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}
    const waited=await closed;
    supervisor.postMessage('stop');const supervisorWait=await supervisorExit;
    await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});
    assert(stdoutEOF&&stderrEOF);
    assert(supervisorStdoutEOF&&supervisorStderrEOF);
    let groupAbsent=false;try{process.kill(-chrome.pid,0);}catch(e){groupAbsent=e.code==='ESRCH';}
    return {mode,result,error,httpReceipts,supervisorEvents,supervisorWait:{...supervisorWait,threadId:supervisorThreadId,
      actualWait:true,stdoutEOF:supervisorStdoutEOF,stderrEOF:supervisorStderrEOF,stdout:supervisorStdout,stderr:supervisorStderr},
      chrome:{pid:chrome.pid,generation,...waited,actualWait:true,stdoutEOF,stderrEOF,stdout,stderr,groupAbsent,
        gatedUntilSupervisorArmed:true,releasedAt:chromeReleasedAt,fixtureHostStop:true}};
  }
}

async function main() {
  const reports=[];
  let failure=null;
  if(process.argv.includes('--browser')) {
    const mode=process.argv.find(x=>x.startsWith('--mode='))?.split('=')[1];
    assert(['sync','yield','stalledParent','lateACK','earlyEOF','cancel','startFailure','generation'].includes(mode),'choose one fresh browser mode');
    reports.push(await runBrowser(mode));
    failure=reports[0].error;
  } else for(const mode of ['normal','stalledParent','lateACK','earlyEOF','cancel','generation','startFailure']) reports.push(await nodeControl(mode));
  const report={at:new Date().toISOString(),authoredOnly:true,nativeGLQualification:false,
    sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),reports};
  if(process.env.GL_STARTUP_OUTPUT)fs.writeFileSync(process.env.GL_STARTUP_OUTPUT,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
  assert.equal(failure,null,'fresh browser fixture error (closure retained in report)');
  for(const item of reports) if(item.chrome){
    assert(item.chrome.groupAbsent,'new browser PID group absent');
    assert(item.supervisorEvents.some(x=>x.armed),'independent browser supervisor armed');
    assert(item.chrome.releasedAt>=item.supervisorEvents.find(x=>x.armed).at,
      'Chrome exec released only after independent supervisor armed');
    assert(!item.supervisorEvents.some(x=>x.expired),'outer browser deadline did not expire');
    const value=item.result;
    assert.equal(value.actualGLRequests,0);assert.equal(value.laterRequests,0);
    if(item.mode==='yield'){
      assert.equal(value.terminal,false,'yielding startup completes within unchanged deadline');
      assert(value.receipts.some(x=>x.t==='ready'),'direct physical guard ready event delivered');
      assert(value.producerEvents.some(x=>x.t==='producer-ready'&&x.readySeenAt<value.deadline&&x.stopAcknowledged));
      assert(value.receipts.some(x=>x.t==='stopped'),'direct physical guard stop delivered');
    }else if(item.mode!=='sync'){
      assert.equal(value.terminal,true,'negative browser control stays terminal');
      assert.equal(value.state[0],'1','shared terminal cannot be cleared');
      assert.equal(value.refusedRequestAttempts.length,3,'replay/rebind/late-ready attempts refused before dispatch');
      if(item.mode==='stalledParent'){
        assert(value.producerEvents.some(x=>x.t==='prearmed'&&x.ack==='1'));
        assert(value.receipts.some(x=>x.t==='PERMANENT_UNKNOWN'&&x.reason==='operation expired'),
          'direct independent deadline reaches host while producer is blocked');
      }
      if(item.mode==='lateACK'){
        assert.equal(value.state[7],'0','no late ready publication');
        assert(value.receipts.some(x=>x.t==='PERMANENT_UNKNOWN'&&x.at>=value.deadline),
          'late physical guard wake observes permanent refusal');
      }
      if(item.mode==='startFailure')assert(value.producerEvents.some(x=>x.t==='child-error'));
    }
  }
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={physicalGuard,browserControl};
