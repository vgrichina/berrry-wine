'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {Lifecycle, connect, observeHTTP} = require('../tools/hexen2-startup-trace.cjs');

test('trace exhaustion rejects the actual in-flight reply and closes without later dispatch', async () => {
  const Original=globalThis.WebSocket, rows=[], sent=[];
  class Socket extends EventTarget {
    constructor(){super();queueMicrotask(()=>this.dispatchEvent(new Event('open')));}
    send(value){sent.push(JSON.parse(value));}
    close(){queueMicrotask(()=>this.dispatchEvent(new Event('close')));}
  }
  globalThis.WebSocket=Socket;
  const life=new Lifecycle({cancelFile:'/nonexistent-hexen-cancel',deadline:Date.now()+5000,floor:null});
  let c;
  try {
    c=connect(life,'ws://unused',r=>rows.push(r));await c.ready;
    const pending=c.send('Runtime.evaluate',{expression:'passive observation'},'owner');
    // One open + request + sent + 4093 events exactly fills the existing cap.
    for(let n=0;n<4093;n++)c.ws.dispatchEvent(new MessageEvent('message',
      {data:JSON.stringify({method:'Page.frameStoppedLoading',params:{frameId:'f'}})}));
    c.ws.dispatchEvent(new MessageEvent('message',
      {data:JSON.stringify({id:1,sessionId:'owner',result:{value:'must not resolve'}})}));
    await assert.rejects(pending,/UNKNOWN startup trace metadata limit/);
    assert.equal(c.closed,true);assert.match(life.reason,/metadata limit/);
    await assert.rejects(c.send('Page.enable'),/metadata limit/);
    assert.equal(sent.length,1);assert.equal(rows.length,4096);
    await c.close();await life.drain();
  } finally {globalThis.WebSocket=Original;}
});

test('exact navigation wire identity and in-flight cancellation reply survive; no later dispatch', async () => {
  const Original = globalThis.WebSocket, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hxtrace-'));
  const rows = [], sent = [];
  class Socket extends EventTarget {
    constructor() { super(); queueMicrotask(() => this.dispatchEvent(new Event('open'))); }
    send(s) { sent.push(JSON.parse(s)); }
    close() { queueMicrotask(() => this.dispatchEvent(new Event('close'))); }
  }
  globalThis.WebSocket = Socket;
  const life = new Lifecycle({cancelFile: dir+'/cancel', deadline: Date.now()+5000, floor: null});
  let c;
  try {
    c = connect(life, 'ws://unused', r => rows.push(r)); await c.ready;
    const params = {url: 'http://127.0.0.1:1234/index.html?debug&threads', referrer: 'http://localhost/'};
    const request = c.send('Page.navigate', params, 'session');
    fs.writeFileSync(dir+'/cancel', 'controlled cancellation');
    c.ws.dispatchEvent(new MessageEvent('message', {data: JSON.stringify({id: 1, sessionId: 'session', result: {frameId: 'f'}})}));
    await assert.rejects(request, /cancelled/);
    await assert.rejects(c.send('Page.enable'), /cancelled/);
    assert.equal(sent.length, 1);
    assert.deepEqual(rows.find(r => r.kind === 'request').params, params);
    assert.equal(rows.find(r => r.kind === 'request').deadline - rows.find(r => r.kind === 'request').sentAt, 15000);
    assert.equal(rows.find(r => r.kind === 'reply').result.frameId, 'f');
  } finally { await life.drain(); if(c) await c.close(); globalThis.WebSocket = Original; fs.rmSync(dir, {recursive:true,force:true}); }
});

test('HTTP arrival precedes handler and finish/close retain status without body', async () => {
  const http = require('node:http'), rows=[];
  const server=http.createServer((req,res)=>{assert.equal(rows.at(-1).kind,'http-arrival');res.statusCode=201;res.end('private body');});
  observeHTTP(server,r=>rows.push(r));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try {const response=await fetch('http://127.0.0.1:'+server.address().port+'/test');await response.text();assert(rows.some(r=>r.kind==='http-finish'&&r.status===201));assert(!JSON.stringify(rows).includes('private body'));}
  finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('independent Node GET validates actual listen address and metadata-only trace before Chrome', async () => {
  const http=require('node:http'),cp=require('node:child_process'),rows=[];
  const server=http.createServer((req,res)=>res.end('private loopback fixture'));
  observeHTTP(server,r=>rows.push(r));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try {
    const address=server.address();
    const script='require(process.argv[1]).probeLoopback(JSON.parse(process.argv[2])).then(r=>process.stdout.write(JSON.stringify(r)),e=>{process.stderr.write(String(e));process.exitCode=1;})';
    const child=cp.spawn(process.execPath,['-e',script,require.resolve('../tools/hexen2-startup-trace.cjs'),JSON.stringify(address)],{stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
    const code=await new Promise(r=>child.once('close',r));assert.equal(code,0,stderr);
    const result=JSON.parse(stdout),arrival=rows.find(r=>r.kind==='http-arrival');
    assert(result.complete);assert.equal(result.bytes,Buffer.byteLength('private loopback fixture'));assert.equal(result.remotePort,address.port);
    assert.equal(arrival.remotePort,result.localPort);assert.equal(arrival.url,'/loopback-probe');
    assert.deepEqual(rows.find(r=>r.kind==='http-listening').address,address);
    assert(!JSON.stringify({rows,result}).includes('private loopback fixture'));
    const {probeLoopback}=require('../tools/hexen2-startup-trace.cjs');
    await assert.rejects(probeLoopback({...address,address:'0.0.0.0'}),/exact IPv4 loopback/);
  } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('Hexen launcher supplies installed runtime settings and adopts before readiness', async () => {
  const common=require('../tools/browser-startup-lifecycle.cjs'),original=common.launchChrome;
  const events=[],life={deadline:Date.now()+60000,run(){},checkpoint(){},note:(...v)=>events.push(v)},child=new (require('node:events').EventEmitter)();child.pid=42;
  let adopted=false;
  common.launchChrome=async(l,options)=>{
    assert(l.deadline<=Date.now()+15000&&l.deadline<life.deadline);
    assert(options.args.includes('--password-store=basic'));
    assert(options.args.includes('--disable-component-update'));
    assert(options.args.includes('--use-gl=angle'));
    assert(options.args.includes('--use-angle=swiftshader'));
    assert.equal(options.args.filter(v=>v.startsWith('--bw-timezone=')).length,1);
    assert(options.args.includes('--bw-timezone=Europe/Paris'));
    options.adopt({child});assert(adopted);child.emit('exit',0,null);
    return {ready:true};
  };
  try {
    assert.deepEqual(await require('../tools/hexen2-startup-trace.cjs').launchChrome(life,
      {args:['--bw-timezone=Europe/Paris'],adopt:o=>{assert.equal(o.child,child);adopted=true;}}),{ready:true});
    assert.deepEqual(events,[['chrome-exit',{pid:42,code:0,signal:null}]]);
  } finally {common.launchChrome=original;}
});

test('intentional drained socket close cannot become a new connect failure', async () => {
  const Original=globalThis.WebSocket,rows=[];
  class Socket extends EventTarget {
    constructor(){super();queueMicrotask(()=>this.dispatchEvent(new Event('open')));}
    close(){queueMicrotask(()=>{this.dispatchEvent(new Event('error'));this.dispatchEvent(new Event('close'));});}
  }
  globalThis.WebSocket=Socket;
  const life=new Lifecycle({cancelFile:'/nonexistent-hexen-cancel',deadline:Date.now()+5000,floor:null});
  try {
    const c=connect(life,'ws://unused',r=>rows.push(r));await c.ready;await life.drain();await c.close();
    assert(!rows.some(r=>r.kind==='terminal'));assert.equal(life.reason,null);
    assert(rows.some(r=>r.kind==='socket-error'&&r.requestedClose));
  } finally {globalThis.WebSocket=Original;}
});
