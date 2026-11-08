'use strict';
// Real localhost WebSocket traffic through the exact composed send/receive
// functions and retained numbered transport. No browser, game or GPU proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const crypto = require('node:crypto');
const {once} = require('node:events');
const {create} = require('./q3-screenshot-completion.cjs');
const composition = require('./q3-native-driver-composition.cjs');
const root = path.resolve(__dirname, '..');
const retained = path.dirname(path.join(root, composition.consumerPath));
const transport = require(retained+'/transport.cjs');
const bound = require(retained+'/bound-input.cjs');
const pause = ms => new Promise(r => setTimeout(r, ms));
async function until(fn) {
  const end=Date.now()+3000;
  while(!fn()){assert(Date.now()<end,'local protocol response deadline');await pause(5);}
}
async function main() {
  const out=process.env.Q3_SCREENSHOT_TEST_OUT;
  assert(out && path.isAbsolute(out),'unique absolute Q3_SCREENSHOT_TEST_OUT required');
  fs.mkdirSync(out,{recursive:true});
  const source=composition.compose().source;
  const sendSource=source.slice(source.indexOf('function send('),source.indexOf('\nasync function evaluate'));
  const receiveSource=source.slice(source.indexOf('ws.onmessage=')+13,source.indexOf('\n save(\'browser-version.json\''));
  assert(receiveSource.endsWith(';'));
  const diagnosticRows=[], traceRows=[], pending=new Map(), timers=new Set();
  const trace={span:async(name,fn)=>fn(), expression:require(retained+'/trace.cjs').expression,
    snapshot:reason=>traceRows.push(reason)};
  const diagnostic=create({trace,write:row=>diagnosticRows.push(row)});
  const server=http.createServer();let peer, buffered=Buffer.alloc(0), received=[];
  function response(value) {
    const data=Buffer.from(JSON.stringify(value));
    const head=Buffer.alloc(data.length<126?2:4);head[0]=0x81;
    if(data.length<126)head[1]=data.length;else{head[1]=126;head.writeUInt16BE(data.length,2);}
    peer.write(Buffer.concat([head,data]));
  }
  server.on('upgrade',(req,socket)=>{
    peer=socket;
    const accept=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
    socket.on('data',chunk=>{
      buffered=Buffer.concat([buffered,chunk]);
      while(buffered.length>=2){
        const opcode=buffered[0]&15, masked=!!(buffered[1]&128);let size=buffered[1]&127, offset=2;
        if(size===126){if(buffered.length<4)return;size=buffered.readUInt16BE(2);offset=4;}
        assert(size<65536);if(buffered.length<offset+4+size)return;
        assert(masked);const mask=buffered.subarray(offset,offset+4);offset+=4;
        const data=Buffer.from(buffered.subarray(offset,offset+size));
        for(let i=0;i<data.length;i++)data[i]^=mask[i%4];
        buffered=buffered.subarray(offset+size);
        if(opcode===8){socket.end(Buffer.from([0x88,0]));continue;}
        received.push(JSON.parse(data));
      }
    });
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const ws=new WebSocket('ws://127.0.0.1:'+server.address().port);await once(ws,'open');
  const scope=vm.createContext({trace,pending,workers:new Map(),pageSession:'page',id:0,ws,
    process:{env:{}}, screenshotCompletion:diagnostic, event:async()=>{}, log(){},
    setTimeout(fn,ms){assert.equal(ms,20000,'actual unchanged CDP cap');const timer=setTimeout(()=>{timers.delete(timer);fn();},ms);timers.add(timer);return timer;},
    clearTimeout(timer){timers.delete(timer);clearTimeout(timer);}});
  vm.runInContext(sendSource+'\nglobalThis.send=send;globalThis.receive='+receiveSource,scope);
  ws.onmessage=scope.receive;
  for(const event of ['close','error'])ws.addEventListener(event,()=>diagnostic.transport(event));
  let tests=0;
  async function request(method,params={},session='page') {
    const index=received.length, promise=scope.send(method,params,session);
    await until(()=>received.length>index);
    return {wire:received[index],promise};
  }
  try {
    // Existing owner reads remain separate, and the exact screenshot request
    // is sent once with its original options and session.
    const owner=await request('Runtime.evaluate',{expression:bound.RENDER_READ},'render');
    const render=[{id:'render-owner',epoch:'epoch-1',control:{completed:4,error:0,commands:9}}];
    response({id:owner.wire.id,sessionId:'render',result:{result:{value:render}}});await owner.promise;
    const shot=await request('Page.captureScreenshot',{format:'png'});
    assert.deepEqual(shot.wire.params,{format:'png'});assert.equal(shot.wire.sessionId,'page');
    response({id:shot.wire.id,sessionId:'page',result:{data:'cG5n'}});
    assert.equal((await shot.promise).data,'cG5n');
    let row=diagnostic.snapshot('success').records.at(-1);
    assert.equal(row.routePending,true);assert.equal(row.routeSessionMatches,true);
    assert(row.sendReturnedNodeMs>=row.sentNodeMs);
    assert.equal(row.ownerRepliesBefore[0].value[0].control.completed,4);
    assert.equal(row.dataSha256,crypto.createHash('sha256').update('cG5n').digest('hex'));tests++;

    const error=await request('Page.captureScreenshot',{format:'png'});
    const rejected=assert.rejects(error.promise,/-32000/);
    response({id:error.wire.id,sessionId:'page',error:{code:-32000,message:'protocol failure'}});await rejected;
    assert.equal(diagnostic.snapshot('error').records.at(-1).status,'CDP error');tests++;

    // Expose the retained numeric-ID routing behavior without silently fixing
    // or treating a wrong-session response as compositor proof.
    const mismatch=await request('Page.captureScreenshot',{format:'png'});
    response({id:mismatch.wire.id,sessionId:'other-page',result:{data:'cG5n'}});await mismatch.promise;
    assert.equal(diagnostic.snapshot('route mismatch').records.at(-1).routeSessionMatches,false);tests++;

    // Actual numbered consumer: a late screenshot cannot issue a command ACK.
    const commands=path.join(out,'numbered');fs.mkdirSync(commands);fs.mkdirSync(commands+'/commands');
    const runEnd=Date.now()+90000;
    fs.writeFileSync(commands+'/execution-window.json',JSON.stringify({browserStop:new Date(runEnd).toISOString()}));
    fs.writeFileSync(commands+'/commands/0.json',JSON.stringify({id:'pending_screenshot',timing:{runEnd,workEnd:Date.now()+100,ackEnd:Date.now()+2200}}));
    let actualShot,executeDone;
    const consume=transport.consume(commands,0,async(c,mark)=>{
      mark();actualShot=await request('Page.captureScreenshot',{format:'png'});
      await actualShot.promise;executeDone=true;
    });
    // The retained transport imports its own trace singleton.
    const actualTrace=require(retained+'/trace.cjs'), originalSnapshot=actualTrace.snapshot;
    actualTrace.snapshot=(reason,...args)=>{trace.snapshot(reason);return originalSnapshot(reason,...args);};
    try{
      await until(()=>actualShot);
      response({method:'Page.frameNavigated',sessionId:'page',params:{frame:{id:'frame-2',loaderId:'loader-2'}}});
      response({method:'Runtime.executionContextsCleared',sessionId:'page',params:{}});
      response({method:'Target.detachedFromTarget',params:{sessionId:'render',targetId:'renderer-target'}});
      const page=await request('Runtime.evaluate',{expression:bound.PAGE_READ});
      response({id:page.wire.id,sessionId:'page',result:{result:{value:{apps:[{epoch:'document-2'}]}}}});await page.promise;
      const rendering=await request('Runtime.evaluate',{expression:bound.RENDER_READ},'render');
      response({id:rendering.wire.id,sessionId:'render',result:{result:{value:[{...render[0],control:{completed:5,error:0,commands:10}}]}}});await rendering.promise;
      await assert.rejects(consume,/command work deadline/);
      response({id:actualShot.wire.id,sessionId:'page',result:{data:'bGF0ZQ=='}});await actualShot.promise;await until(()=>executeDone);
      assert(fs.existsSync(commands+'/first-failure.json'));assert(!fs.existsSync(commands+'/reply-0.json'));
      await assert.rejects(transport.consume(commands,0,()=>assert.fail('replayed')),/duplicate|sticky/);
      row=diagnostic.snapshot('late after first UNKNOWN').records.at(-1);
      assert.equal(row.commandUnknown,true);assert.equal(row.late,true);
      assert(diagnosticRows.some(r=>r.event==='owner.reply.duringScreenshot'&&r.kind==='page.owner'));
      assert(diagnosticRows.some(r=>r.event==='owner.reply.duringScreenshot'&&r.kind==='renderer.owner'&&r.value[0].control.completed===5));
      assert(diagnosticRows.some(r=>r.method==='Target.detachedFromTarget'));tests++;
    }finally{actualTrace.snapshot=originalSnapshot;}

    // Real 20s cap; a subsequent raw response is visible before the retained
    // handler discards it for absence from pending. UNKNOWN remains terminal.
    const timeout=await request('Page.captureScreenshot',{format:'png'});
    await assert.rejects(timeout.promise,/CDP UNKNOWN/);
    assert(!pending.has(timeout.wire.id));
    response({id:timeout.wire.id,sessionId:'page',result:{data:'bGF0ZQ=='}});
    await until(()=>diagnosticRows.some(r=>r.event==='screenshot.response'&&r.requestId===timeout.wire.id));
    row=diagnostic.snapshot('late after CDP deadline').records.at(-1);
    assert.equal(row.status,'CDP deadline; UNKNOWN');assert.equal(row.routePending,false);assert.equal(row.late,true);tests++;
    assert.equal(received.filter(r=>r.method==='Page.captureScreenshot').length,5,'no extra screenshot or retry');
    assert.equal(timers.size,0);assert.equal(pending.size,0);
  } finally {
    for(const timer of timers)clearTimeout(timer);
    const closed=once(ws,'close');ws.close();await closed;
    peer.destroy();await new Promise(resolve=>server.close(resolve));
    fs.writeFileSync(out+'/protocol.jsonl.gz',require('node:zlib').gzipSync(diagnosticRows.map(r=>JSON.stringify(r)).join('\n')+'\n'));
  }
  // Bounded diagnostic memory, no arbitrary payload retention and an observer
  // output failure cannot change a send/response or the transport deadline.
  const tiny=create({trace:{snapshot(){}},write(){throw Error('disk fixture');},capacity:1});
  tiny.request({requestId:1,method:'Page.captureScreenshot',sessionId:'page'},{});
  tiny.request({requestId:2,method:'Page.captureScreenshot',sessionId:'page'},{});
  const bounded=tiny.snapshot('bounded');assert.equal(bounded.records.length,1);assert.equal(bounded.dropped,1);assert(bounded.observerErrors>0);tests++;
  tiny.sendFailed({requestId:2},Error('socket closed'));
  assert.equal(tiny.snapshot('failed send').records[0].status,'send threw; UNKNOWN');
  assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(root+'/tools/q3-execution-boundary.cjs')).digest('hex'),composition.providers['tools/q3-execution-boundary.cjs']);
  console.log(JSON.stringify({passed:true,tests,localhostWebSocket:true,actualComposedSendReceive:true,actualNumberedTransport:true,browserStarted:false,gameStarted:false,unchangedCDPDeadlineMs:20000,noReplay:true,socketClosed:true,serverClosed:true,pending:pending.size,timers:timers.size,traceRows}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
