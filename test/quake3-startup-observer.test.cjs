'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createObserver,install,hash}=require('../tools/quake3-startup-observer.cjs');
test('wire attribution retains exact identity, latency, exception and late terminal response without payload',()=>{
  let t=10;const rows=[],o=createObserver({emit:r=>rows.push(r),now:()=>t,wall:()=>1000+t,labels:new Map([[hash('secret()'),'known-label']])});
  o.received(JSON.stringify({method:'Target.attachedToTarget',params:{sessionId:'s',targetInfo:{targetId:'worker1',type:'worker',url:'PRIVATE_URL'}}}));
  o.sent(JSON.stringify({id:42,method:'Runtime.evaluate',sessionId:'s',params:{expression:'secret()',awaitPromise:true}}));
  t=3011;assert(o.snapshot().outstanding[0].afterDeadline);
  o.markTerminal('observed-controller-UNKNOWN');
  o.received(JSON.stringify({id:42,sessionId:'s',result:{result:{type:'string',value:'PRIVATE_PAYLOAD'},exceptionDetails:{text:'PRIVATE_EXCEPTION'}}}));
  const r=rows.find(r=>r.type==='response');assert.equal(r.targetId,'worker1');assert.equal(r.elapsedMs,3001);assert(r.afterDeadline&&r.afterTerminal&&r.expressionException&&r.sessionMatches);
  assert.equal(rows.find(r=>r.type==='request').expression.label,'known-label');
  assert(!JSON.stringify(rows).match(/PRIVATE|secret\(\)/));assert.equal(o.snapshot().terminal.reason,'observed-controller-UNKNOWN');
});
test('observer preserves every byte and event; emits no extra operations even when sink fails',()=>{
  class Fake extends EventTarget {static OPEN=1;constructor(...args){super();this.args=args;this.wire=[];}send(v){this.wire.push(v);return 73;}}
  const old=globalThis.WebSocket;const installed=install({WebSocket:Fake,emit:()=>{throw Error('sink failure');}});
  try {const w=new WebSocket('ws://example'),wire='{"id":1,"method":"Runtime.evaluate","params":{"expression":"1"}}';assert.equal(w.send(wire),73);assert.deepEqual(w.wire,[wire]);let count=0;w.onmessage=()=>{};w.addEventListener('message',()=>count++);w.dispatchEvent(new MessageEvent('message',{data:'{"id":1,"result":{"result":{"type":"number","value":1}}}'}));assert.equal(count,1);assert.equal(w.wire.length,1);assert.equal(Fake.OPEN,WebSocket.OPEN);}
  finally {installed.restore();globalThis.WebSocket=old;}
});
test('target replacement and wrong-session replies remain distinct from deadline/UNKNOWN',()=>{
  let t=0;const rows=[],o=createObserver({emit:r=>rows.push(r),now:()=>t});
  o.sent('{"id":1,"method":"Target.attachToTarget","params":{"targetId":"old"}}');o.received('{"id":1,"result":{"sessionId":"s"}}');
  o.sent('{"id":2,"method":"Runtime.evaluate","sessionId":"s","params":{"expression":"1"}}');
  o.received('{"method":"Target.detachedFromTarget","params":{"sessionId":"s","targetId":"old"}}');
  o.received('{"method":"Target.attachedToTarget","params":{"sessionId":"s2","targetInfo":{"targetId":"new","type":"page"}}}');
  t=200;o.received('{"id":2,"sessionId":"s2","error":{"code":-32000,"message":"private"}}');
  const r=rows.filter(r=>r.type==='response').at(-1);assert(!r.sessionMatches);assert.equal(r.targetId,'old');assert(!r.afterDeadline);assert.equal(o.snapshot().terminal,null);
});
test('already-received script bytes are hashed, never retained in evidence',()=>{
  const rows=[],o=createObserver({emit:r=>rows.push(r)});
  o.sent('{"id":1,"method":"Debugger.getScriptSource","sessionId":"w","params":{"scriptId":"77"}}');
  o.received(JSON.stringify({id:1,sessionId:'w',result:{bytecode:Buffer.from('PRIVATE_WASM_BYTES').toString('base64')}}));
  const r=rows.at(-1);assert.equal(r.scriptId,'77');assert.equal(r.scriptSha256,hash('PRIVATE_WASM_BYTES'));assert.equal(r.scriptBytes,18);assert(r.bytecode);assert(!JSON.stringify(rows).includes('PRIVATE_WASM_BYTES'));
});
test('real helper supplies its operation deadline and terminal trigger, and sends nothing after UNKNOWN',async()=>{
  const {connection}=require('../tools/quake3-browser-controller.cjs');
  class Socket extends EventTarget {
    constructor(){super();this.wire=[];queueMicrotask(()=>this.onopen?.({}));}
    send(data){this.wire.push(data);}
    reply(v){this.onmessage({data:JSON.stringify(v)});}
    close(){this.dispatchEvent(new Event('close'));}
  }
  const Native=globalThis.WebSocket,rows=[],o=createObserver({emit:r=>rows.push(r)});globalThis.WebSocket=Socket;
  try {
    const c=connection('ws://fixture',o);await c.ready;
    const good=c.send('Runtime.evaluate',{expression:'1'},'s');c.ws.reply({id:1,sessionId:'s',result:{result:{type:'number',value:1}}});assert.equal((await good).result.value,1);
    const pending=c.send('Runtime.evaluate',{expression:'pending'},'s');await assert.rejects(pending,/UNKNOWN Runtime.evaluate/);assert(c.closed);
    const before=c.ws.wire.length;c.ws.reply({id:2,sessionId:'s',result:{result:{type:'number',value:9}}});assert(c.closed);assert.equal(c.ws.wire.length,before);
    const request=rows.find(r=>r.type==='request'&&r.id===2);assert.equal(request.deadlineOrigin,'helper-operation-start');assert.equal(request.deadline-request.start,3000);
    const terminal=rows.find(r=>r.type==='terminal');assert.equal(terminal.terminal.reason,'deadline');assert.equal(terminal.terminal.trigger.id,2);assert(rows.some(r=>r.type==='response'&&r.id===2&&r.afterTerminal));
    c.ws.close();
  } finally {globalThis.WebSocket=Native;}
});
// Heavy controls are explicitly opt-in after the source/runtime lane releases.
if(process.env.QUAKE3_OPERATION_CHROME==='1')test('real Chrome controls',async()=>{
  const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
  const {connection}=require('../tools/quake3-browser-controller.cjs');
  const out=path.resolve(process.env.QUAKE3_OPERATION_OUT);fs.mkdirSync(out,{recursive:true});
  const rows=[];let connections=0;const observe=()=>createObserver({connectionId:'chrome-control-'+(++connections),emit:r=>{rows.push(r);fs.appendFileSync(out+'/operations.jsonl',JSON.stringify(r)+'\n');}});
  const p=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--disable-dev-shm-usage','--remote-debugging-port=0','--user-data-dir='+out+'/profile','about:blank'],{stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);
  const joined=new Promise(r=>p.once('close',(code,signal)=>r({pid:p.pid,code,signal,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded})));
  let c;const report={};const pause=ms=>new Promise(r=>setTimeout(r,ms));
  try {
    const active=out+'/profile/DevToolsActivePort',start=Date.now();while(!fs.existsSync(active)){assert(Date.now()-start<10000);await pause(50);}
    const [port,endpoint]=fs.readFileSync(active,'utf8').trim().split('\n'),url='ws://127.0.0.1:'+port+endpoint;
    async function fresh(){const c=connection(url,observe());await c.ready;const targetId=(await c.send('Target.createTarget',{url:'about:blank'})).targetId;const s=(await c.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;await c.send('Runtime.enable',{},s);return {c,s,targetId};}
    let a=await fresh();c=a.c;const evaluate=(expression)=>c.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},a.s);
    assert.equal((await evaluate('21*2')).result.value,42);
    assert((await evaluate('throw Error("fixture")')).exceptionDetails);assert(!c.closed);report.failedExpression='exception, live transport';
    const slow=evaluate('new Promise(r=>setTimeout(()=>r(17),250))');await pause(40);const duringSlow=c.ws.startupObserver.snapshot();assert(duringSlow.outstanding.some(r=>r.method==='Runtime.evaluate'&&!r.afterDeadline));assert.equal((await slow).result.value,17);report.validSlow={duringSlow,resolved:17,boundMs:3000};
    await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true},a.s);
    await evaluate('globalThis.progress=0;globalThis.worker=new Worker(URL.createObjectURL(new Blob(["postMessage(1)"],{type:"text/javascript"})));worker.onmessage=()=>progress++');
    await pause(100);assert.equal((await evaluate('progress')).result.value,1);report.progress='ordinary Worker message';
    const pending=evaluate('new Promise(r=>setTimeout(()=>r(99),3600))');await assert.rejects(pending,/UNKNOWN/);c.ws.startupObserver.markTerminal('controller-rejected-UNKNOWN');assert(c.closed);await pause(750);assert(rows.some(r=>r.type==='response'&&r.afterTerminal&&r.afterDeadline));assert(c.closed);report.late='real late reply recorded, helper permanently closed; no subsequent query';c.ws.close();
    a=await fresh();c=a.c;const blocked=evaluate('(()=>{const end=Date.now()+3400;while(Date.now()<end){}return 1})()');const liveBrowser=await c.send('Browser.getVersion');assert(liveBrowser.product);await assert.rejects(blocked,/UNKNOWN/);c.ws.startupObserver.markTerminal('controller-rejected-UNKNOWN');await pause(500);assert(c.closed);report.blocked={browserResponsiveWhilePageBlocked:true,lateResponse:true,routeReopened:false};c.ws.close();
    a=await fresh();c=a.c;const vanished=evaluate('new Promise(()=>{})').then(()=>null,e=>e);await c.send('Target.closeTarget',{targetId:a.targetId});const error=await vanished;assert(error instanceof Error);report.vanished={error:String(error),closed:c.closed};c.ws.close();
    assert(rows.some(r=>r.type==='lifecycle'&&r.method==='Target.detachedFromTarget'));
    const oldTarget=a.targetId;a=await fresh();c=a.c;assert.notEqual(a.targetId,oldTarget);report.replacement={oldTarget,newTarget:a.targetId};
    const disconnected=evaluate('new Promise(()=>{})').then(()=>null,e=>e);c.ws.close();const transportError=await disconnected;assert.match(String(transportError),/UNKNOWN CDP closed/);assert(c.closed);c.ws.startupObserver.markTerminal('controller-rejected-CDP-closed');report.transport='real websocket close while pending, zero repeated queries';
    report.noObserverCommands=true;report.inputTicketCaptureCommands=rows.filter(r=>r.type==='request'&&/^(Input\.|Page.captureScreenshot)/.test(r.method)).length;assert.equal(report.inputTicketCaptureCommands,0);
    report.passed=true;
  } finally {if(c&&!c.closed)try{await c.send('Browser.close');}catch{}if(p.exitCode===null)p.kill('SIGTERM');report.chromeWait=await joined;c?.ws.close();fs.rmSync(out+'/profile',{recursive:true,force:true});fs.writeFileSync(out+'/chrome.stdout.log',stdout);fs.writeFileSync(out+'/chrome.stderr.log',stderr);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
});
