'use strict';
// Actual current generated send/consumer, public WHATWG WebSocket and controlled
// local peer. No Chrome/guest/GPU: Node delivery evidence only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),http=require('node:http'),crypto=require('node:crypto');
const cp=require('node:child_process'),Module=require('node:module'),zlib=require('node:zlib');
const {once}=require('node:events');
const root=path.resolve(__dirname,'..'),current=require('./q3-current-module.cjs');
const route=require('./q3-current-foreign-closure-v1.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){const end=Date.now()+3000;while(!fn()){assert(Date.now()<end,'local delivery deadline');await pause(5);}}
// This preload executes the entire sealed generated caller/consumer. Only
// Chrome, HTTP and guest services are replaced with a controlled Node peer.
function fullPeer(){
 const dir=process.env.Q3_CAPTURE_CHILD,load=Module._load,spawn=cp.spawn,compile=Module.prototype._compile;
 const consumer=root+'/'+require('./q3-native-driver-composition.cjs').consumerPath;let browser;
 Module.prototype._compile=function(source,name){
  if(name===consumer){assert(source.includes('q3Capture?.receive(msg,v,pending.get(v.id))'));
   fs.writeFileSync(dir+'/installed.json',JSON.stringify({sha256:crypto.createHash('sha256').update(source).digest('hex'),bytes:Buffer.byteLength(source),sourceCopied:false}));}
  return compile.call(this,source,name);
 };
 cp.spawn=(command,args)=>{
  assert.equal(command,'/usr/bin/google-chrome');const profile=args.find(v=>v.startsWith('--user-data-dir=')).slice(16);
  browser=spawn(process.execPath,['-e',`const fs=require('node:fs'),p=process.argv[1];
   const cap=setTimeout(()=>process.exit(9),60000);fs.mkdirSync(p,{recursive:true});
   fs.writeFileSync(p+'/DevToolsActivePort','1\\n/devtools/browser/offline\\n');
   const stop=()=>{clearTimeout(cap);process.stdout.write('stopped\\n');process.stderr.write('EOF\\n');process.stdin.destroy();};process.stdin.once('data',stop);process.once('SIGTERM',stop);`,profile],{stdio:['pipe','pipe','pipe']});
  browser.stdout.resume();browser.stderr.resume();
  browser.once('close',(code,signal)=>fs.writeFileSync(dir+'/browser-wait.json',JSON.stringify({code,signal,stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded})));
  fs.writeFileSync(dir+'/stand-in-pid',String(browser.pid));return browser;
 };
 Module._load=function(name,parent,main){
  if(name===root+'/test/static-server.js')return {startStaticServer:async()=>({address:()=>({port:1}),prependListener(){},closeAllConnections(){},close:fn=>fn()})};
  if(parent?.filename===consumer&&name===root+'/tools/q3-startup.cjs')return {launch:async()=>({offline:true})};
  if(parent?.filename===consumer&&name==='./bound-input.cjs')return {createChain:()=>({})};
  if(parent?.filename===consumer&&name==='./readiness.cjs')return {ready:async()=>({offline:true})};
  if(parent?.filename===consumer&&name==='./local-controls.cjs')return {run:async({send,pageSession})=>{
   assert.equal((await send('Page.captureScreenshot',{format:'png'},pageSession)).data,'delayed');
   assert.equal((await send('Page.captureScreenshot',{format:'png'},pageSession)).data.length,2*1024*1024);
   // No consumer source transform, synthetic timeout or retry. The real
   // generated promise rejects at its existing20s timer, then kernel cleanup
   // contains the child without a post-terminal protocol close.
   await send('Page.captureScreenshot',{format:'png'},pageSession);assert.fail('absent reply resolved');
  }};
  return load.call(this,name,parent,main);
 };
 globalThis.fetch=async url=>{
  const u=new URL(url);assert.equal(u.origin,'http://127.0.0.1:1');const file=path.resolve(root,'.'+u.pathname);assert(file.startsWith(root+'/'));
  return {status:200,arrayBuffer:async()=>fs.readFileSync(file)};
 };
 let shots=0;const protocol=[];
 globalThis.WebSocket=class extends EventTarget{
  constructor(){super();this.readyState=1;queueMicrotask(()=>this.onopen());}
  reply(q,result={}){const event=new MessageEvent('message',{data:JSON.stringify({id:q.id,...(q.sessionId?{sessionId:q.sessionId}:{}),result})});this.dispatchEvent(event);this.onmessage?.(event);}
  send(raw){const q=JSON.parse(raw);protocol.push({id:q.id,method:q.method,sessionId:q.sessionId??null,params:q.method==='Page.captureScreenshot'?q.params:null});
   if(q.method==='Page.captureScreenshot'){
    assert.equal(this.q3Transport.active,false,'actual navigation stop preceded capture');
    if(++shots===1)return setTimeout(()=>this.reply(q,{data:'delayed'}),80);
    if(shots===2)return queueMicrotask(()=>this.reply(q,{data:'A'.repeat(2*1024*1024)}));return;
   }
   let result={};if(q.method==='Target.getTargets')result={targetInfos:[{type:'page',targetId:'exact-target'}]};
   if(q.method==='Target.attachToTarget')result={sessionId:'exact-page-session'};
   queueMicrotask(()=>{this.reply(q,result);if(q.method==='Browser.close')browser.stdin.end('close\n');});
  }
  close(){this.readyState=3;}
 };
 process.once('exit',code=>fs.writeFileSync(dir+'/peer.json',JSON.stringify({code,protocol,shots,noChrome:true})));
}
async function fullGenerated(out){
 const dir=out+'/full-generated';fs.mkdirSync(dir);
 const prepared=dir+'/prepared',seal=current.prepare(prepared,{foreignClosureVersion:route.version});
 route.staged(prepared,route.version,seal.manifestSHA256);
 const child=cp.spawn(process.execPath,['--require',__filename,prepared+'/q3-runtime-caller.cjs'],{
  cwd:root,env:{...process.env,Q3_CAPTURE_CHILD:dir,LOCAL_PRODUCTION_FIXTURE:'1',BROWSER_DEADLINE:String(Date.now()+90000),
   Q3_EXECUTION_BOUNDARY_OUT:dir+'/boundary.jsonl.gz'},stdio:['ignore','pipe','pipe']});
 const logs=require('./native-command-log.cjs').createLogs(dir);logs.attach('stdout',child.stdout);logs.attach('stderr',child.stderr);
 const guard=setTimeout(()=>{child.kill('SIGKILL');try{process.kill(Number(fs.readFileSync(dir+'/stand-in-pid')),'SIGKILL');}catch{}},65000);
 let code,signal;try{[code,signal]=await once(child,'close');await logs.drainStreams();logs.close();}finally{clearTimeout(guard);}
 assert.equal(code,1);assert.equal(signal,null);assert(child.stdout.readableEnded&&child.stderr.readableEnded);
 const read=p=>JSON.parse(fs.readFileSync(p)),peer=read(dir+'/peer.json'),wait=read(dir+'/browser-wait.json');
 assert.equal(peer.shots,3);assert(!peer.protocol.some(q=>q.method.startsWith('Input.')));
 assert(!peer.protocol.some(q=>q.method==='Browser.close'),'terminal failure forbids automatic quit');
 const runtime=prepared+'/runtime';assert.match(read(runtime+'/first-browser-failure.json').error,/CDP UNKNOWN Page.captureScreenshot; no replay/);
 assert(!fs.existsSync(runtime+'/ready.json'));assert.equal(wait.code,0);assert.equal(wait.signal,null);assert(wait.stdoutEOF&&wait.stderrEOF);
 assert(!fs.existsSync(runtime+'/chrome-profile'));
 const records=zlib.gunzipSync(fs.readFileSync(dir+'/boundary-transport.jsonl.gz')).toString().trim().split('\n').map(JSON.parse);
 const stop=records.findIndex(r=>r.phase==='observation-stop'&&r.reason==='navigation settled');assert(stop>=0);
 assert(records.slice(stop+1).every(r=>r.observation==='capture'),'startup recording never resumes');
 for(const [index,q] of peer.protocol.filter(q=>q.method==='Page.captureScreenshot').entries()){
  const r=records.filter(v=>v.observation==='capture'&&v.requestId===q.id);
  assert(r.every(v=>v.sessionId==='exact-page-session'&&v.targetId==='exact-target'&&v.requestTargetId==='page'));
  assert(r.some(v=>v.phase==='send-return'));
  assert.equal(r.filter(v=>v.phase==='consumer-delivery').length,index===2?0:1);
  assert.equal(r.at(-1).completion,index===2?'UNKNOWN':'consumer delivered');
 }
 fs.writeFileSync(dir+'/result.json',JSON.stringify({passed:true,wholeSealedCaller:!process.env.Q3_CAPTURE_PREPARED_SMOKE,manifestSHA256:seal.manifestSHA256,
  actualWait:code,stdoutEOF:true,stderrEOF:true,standInWait:wait,lifecycle:'NOT_CREATED',completionWithoutReply:'UNKNOWN'},null,2));
}

function controls(){
 const rows=[],timers=new Map();let next=0;
 class Socket extends EventTarget {
  listeners=new Set();
  addEventListener(type,fn,...args){this.listeners.add(fn);return super.addEventListener(type,fn,...args);}
  removeEventListener(type,fn,...args){this.listeners.delete(fn);return super.removeEventListener(type,fn,...args);}
 }
 const socket=new Socket();
 const d=current.createCaptureDiagnostics({socket,write:r=>rows.push(r),now:()=>String(next),
  schedule(fn,ms){assert.equal(ms,20000);timers.set(++next,fn);return next;},cancel:id=>timers.delete(id)});
 const meta=id=>({requestId:id,method:'Page.captureScreenshot',sessionId:'page-exact',targetId:'owner-exact'});
 // One independent cap per capture. A stale callback cannot revive a record.
 d.request(meta(1));const stale=[...timers.values()][0];stale();stale();assert.equal(d.active,0);assert.equal(timers.size,0);
 assert.equal(rows.at(-1).completion,'UNKNOWN');
 for(let i=2;i<36;i++)d.request(meta(i));assert.equal(d.active,32);assert.equal(timers.size,32);
 for(let i=0;i<200;i++)socket.dispatchEvent(new MessageEvent('message',{data:'{}'}));
 assert.equal(d.active,0);assert.equal(timers.size,0);assert.equal(socket.listeners.size,0);
 for(let i=36;i<10000;i++)d.request(meta(i));
 d.dispose();assert.equal(timers.size,0);assert.equal(d.active,0);
 assert(rows.length<=4128,'4096 ordinary records plus at most32 simultaneous stop records');
 const counts=new Map();for(const r of rows)counts.set(r.requestId,(counts.get(r.requestId)||0)+1);
 assert([...counts.values()].every(n=>n<=129),'128 records plus stop per capture');
 const capacityTimers=new Map(),capacityRows=[];
 const churn=current.createCaptureDiagnostics({socket,write:r=>capacityRows.push(r),
  schedule(fn){capacityTimers.set(++next,fn);return next;},cancel:id=>capacityTimers.delete(id)});
 for(let i=0;i<10000;i++)churn.request(meta(i));
 assert.equal(churn.active,0);assert.equal(capacityTimers.size,0);assert(capacityRows.length<=4128);churn.dispose();
 const broken=current.createCaptureDiagnostics({socket,write(){throw Error('sink');},now(){throw Error('clock');},
  schedule(){throw Error('timer');},cancel(){throw Error('cancel');}});
 broken.request(meta(10001));broken.receive({}, {id:10001},null);broken.send('send-return','bad');broken.deadline(meta(10001));broken.dispose();
 assert.equal(broken.active,0);assert.equal(socket.listeners.size,0);
 const sentinel=Error('actual send first error');
 class Base extends EventTarget {send(){throw sentinel;} close(){return 7;}}
 const Transport=current.installTransportDiagnostics({WebSocket:Base,write(){throw Error('sink');}});
 const transport=new Transport();transport.q3Transport.stop('navigation settled');transport.q3Capture.request(meta(9));
 assert.throws(()=>transport.send(JSON.stringify({id:9,method:'Page.captureScreenshot',sessionId:'page-exact'})),e=>e===sentinel);
 assert.equal(transport.close(),7);assert.equal(transport.q3Capture.active,0);
 // A controlled peer may deliver reentrantly before send returns. Preserve
 // the distinct return observation even when consumer settlement is earlier.
 let sync,resolveSync;const syncRows=[];
 class SyncBase extends EventTarget{
  send(raw){const q=JSON.parse(raw),event=new MessageEvent('message',{data:JSON.stringify({id:q.id,sessionId:q.sessionId,result:{}})});
   this.dispatchEvent(event);sync.q3Capture.receive(event,JSON.parse(event.data),{});resolveSync();return 31;}
  close(){}
 }
 const Sync=current.installTransportDiagnostics({WebSocket:SyncBase,write:r=>syncRows.push(r)});
 sync=new Sync();sync.q3Transport.stop('navigation settled');sync.q3Capture.request(meta(77));
 resolveSync=()=>sync.q3Capture.settlement(meta(77),'resolve');
 assert.equal(sync.send(JSON.stringify({id:77,method:'Page.captureScreenshot',sessionId:'page-exact'})),31);
 assert.deepEqual(syncRows.filter(r=>r.observation==='capture').map(r=>r.phase),
  ['request','pre-send','public-message','consumer-delivery','settlement','send-return','observation-stop']);
 assert.equal(sync.q3Capture.active,0);sync.close();
 return {boundedRows:rows.length,maxPerCapture:Math.max(...counts.values()),diagnosticFailuresContained:true};
}
function sourceChecks(source){
 // Exact old generated source after erasing only the new observation calls.
 const filename=root+'/tools/q3-current-module.cjs',old=new Module(filename,module);old.filename=filename;old.paths=module.paths;
 old._compile(cp.execFileSync('git',['show','d77be3a6199a1e4df2c42296e6833fcf83c5ef65:tools/q3-current-module.cjs'],{encoding:'utf8',cwd:root}),filename);
 const compose=current.composeStartupDiagnostics;let prior;
 try{current.composeStartupDiagnostics=old.exports.composeStartupDiagnostics;prior=route.composition(route.version).compose().source;}
 finally{current.composeStartupDiagnostics=compose;}
 let erased=source;
 for(const seam of ['ws?.q3Capture?.settlement(meta,outcome);\n ', 'ws?.q3Capture?.request(meta,params);',
  'ws?.q3Capture?.receive(msg,v,pending.get(v.id));','ws?.q3Capture?.deadline(meta);']){
  assert.equal(erased.split(seam).length,2,seam);erased=erased.replace(seam,'');
 }
 assert.equal(erased,current.composeTerminalCleanup(prior),'all generated semantics except explicit Q3 terminal cleanup byte identical');
 assert(source.includes("ws?.q3Transport?.stop('navigation settled')"));
 // Native lifecycle installs the unchanged wire hook after startup/capture
 // composition. Exercise that real hook too: a synthetic consumer alone
 // misses its required contiguous parse/screenshot seam.
 const wire=require('./q3-input-wire-observation.cjs').integrate(source);
 assert(wire.includes('const v=JSON.parse(msg.data);inputWire.receive(v,pending.get(v.id));screenshotCompletion.receive(v,pending.get(v.id));ws?.q3Capture?.receive(msg,v,pending.get(v.id));'));
 new vm.Script(wire);
}
async function main(){
 const out=path.resolve(process.argv[2]||'');assert(process.argv[2]&&out.startsWith(root+'/scratch/runs/'));
 assert(!fs.existsSync(out),'fresh owned output');fs.mkdirSync(out,{recursive:true});
 const controlled=controls(),source=route.composition(route.version).compose().source;sourceChecks(source);
 const rows=[],diagnosticRows=[],pending=new Map(),timers=new Set(),captureTimers=new Set(),received=[];
 const server=http.createServer();let peer,buffered=Buffer.alloc(0),rawText;
 function response(value){
  const data=Buffer.from(JSON.stringify(value));rawText=data.toString();
  const head=Buffer.alloc(data.length<126?2:data.length<65536?4:10);head[0]=0x81;
  if(data.length<126)head[1]=data.length;else if(data.length<65536){head[1]=126;head.writeUInt16BE(data.length,2);}
  else{head[1]=127;head.writeBigUInt64BE(BigInt(data.length),2);}
  peer.write(Buffer.concat([head,data]));
 }
 server.on('upgrade',(req,socket)=>{
  peer=socket;const accept=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  socket.on('data',chunk=>{
   buffered=Buffer.concat([buffered,chunk]);
   while(buffered.length>=2){
    const opcode=buffered[0]&15;let size=buffered[1]&127,offset=2;
    if(size===126){if(buffered.length<4)return;size=buffered.readUInt16BE(2);offset=4;}
    assert(size<65536);if(buffered.length<offset+4+size)return;
    assert(buffered[1]&128);const mask=buffered.subarray(offset,offset+4);offset+=4;
    const bytes=Buffer.from(buffered.subarray(offset,offset+size));for(let i=0;i<size;i++)bytes[i]^=mask[i%4];
    buffered=buffered.subarray(offset+size);
    if(opcode===8){socket.end(Buffer.from([0x88,0]));continue;}
    received.push(JSON.parse(bytes));
   }
  });
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const Socket=current.installTransportDiagnostics({WebSocket,write:r=>rows.push(r),schedule(fn,ms){
  assert.equal(ms,20000,'capture-only observation timer after navigation');const t=setTimeout(()=>{captureTimers.delete(t);fn();},ms);captureTimers.add(t);return t;
 },cancel(t){captureTimers.delete(t);clearTimeout(t);}});
 const ws=new Socket('ws://127.0.0.1:'+server.address().port);await once(ws,'open');
 // Real startup stop; capture observations must work independently thereafter.
 ws.q3Transport.stop('navigation settled');const startupRows=rows.length;
 const retained=path.dirname(root+'/'+require('./q3-native-driver-composition.cjs').consumerPath);
 const trace={span:async(name,fn)=>fn(),expression:require(retained+'/trace.cjs').expression,snapshot(){}};
 let notifications=0;
 const scope=vm.createContext({trace,pending,workers:new Map(),pageSession:'page-exact',id:0,ws,root,require,fs,
  callerCancellation:out+'/cancelled.json',terminalFailure:null,commandWorkEnd:null,
  observeTerminal(error){scope.terminalFailure=error instanceof Error?error:Error(String(error));},
  process:{env:{}},event:async()=>{notifications++;},log(file,row){diagnosticRows.push({file,...row});},
  setTimeout(fn,ms){assert.equal(ms,20000,'unchanged generated CDP timer');const t=setTimeout(()=>{timers.delete(t);fn();},ms);timers.add(t);return t;},
  clearTimeout(t){timers.delete(t);clearTimeout(t);}});
 const start=source.indexOf('const startupDiagnostics='),end=source.indexOf('\nasync function evaluate');
 const terminal=source.slice(source.indexOf('function checkTerminal()'),source.indexOf('const callerMonitor='));
 const initializer=source.match(/const screenshotCompletion=[^\n]+/)[0];
 const receiver=source.slice(source.indexOf('ws.onmessage=')+13,source.indexOf("\n save('browser-version.json'"));
 vm.runInContext(terminal+initializer+'\n'+source.slice(start,end)+'\nglobalThis.send=send;globalThis.receive='+receiver,scope);
 ws.onmessage=scope.receive;vm.runInContext('startupRecording=false;',scope);
 response({method:'Target.attachedToTarget',params:{sessionId:'page-exact',targetInfo:{targetId:'exact-target',type:'page'}}});
 await until(()=>notifications===1);
 async function request(){const at=received.length,promise=scope.send('Page.captureScreenshot',{format:'png'},'page-exact');await until(()=>received.length>at);return {wire:received[at],promise};}
 try{
  const delayed=await request();await pause(80);assert.equal(ws.q3Capture.active,1);
  assert(!rows.some(r=>r.observation==='capture'&&r.phase==='public-message'));
  response({id:delayed.wire.id,sessionId:'page-exact',result:{data:'cG5n'}});assert.equal((await delayed.promise).data,'cG5n');
  // Public receipt can precede consumer service independently of send return.
  const held=await request();let heldEvent;ws.onmessage=event=>{heldEvent=event;};
  response({id:held.wire.id,sessionId:'page-exact',result:{data:'consumer-held'}});
  await until(()=>heldEvent);await pause(80);
  const rawHeld=rows.findLast(r=>r.phase==='public-message');
  assert(!rows.some(r=>r.requestId===held.wire.id&&r.phase==='consumer-delivery'));
  scope.receive(heldEvent);ws.onmessage=scope.receive;await held.promise;
  const deliveredHeld=rows.findLast(r=>r.phase==='consumer-delivery');
  assert.equal(deliveredHeld.message,rawHeld.message);
  assert(Number(BigInt(deliveredHeld.monotonicNs)-BigInt(rawHeld.monotonicNs))/1e6>=75);
  const big=await request();const payload='A'.repeat(2*1024*1024);
  response({id:big.wire.id,sessionId:'page-exact',result:{data:payload}});assert.equal((await big.promise).data,payload);
  const raw=rows.findLast(r=>r.phase==='public-message'),consumer=rows.findLast(r=>r.phase==='consumer-delivery');
  assert(raw.parseSkipped);assert.equal(raw.wireRequestId,null);assert.equal(raw.bytes,Buffer.byteLength(rawText));
  assert.equal(raw.sha256,crypto.createHash('sha256').update(rawText).digest('hex'));
  assert.equal(consumer.message,raw.message);assert.equal(consumer.publicMonotonicNs,raw.monotonicNs);
  assert(!JSON.stringify(rows).includes(payload));
  const wrong=await request();response({id:wrong.wire.id,sessionId:'foreign-session',result:{data:'same numeric routing'}});await wrong.promise;
  assert.equal(rows.findLast(r=>r.phase==='consumer-delivery').routeSessionMatches,false,'original numeric routing remains visible, unchanged');
  const absent=await request(),begin=Date.now();await assert.rejects(absent.promise,/CDP UNKNOWN Page.captureScreenshot; no replay/);
  assert(Date.now()-begin>=19500,'real production deadline, never accelerated');
  const missing=rows.filter(r=>r.observation==='capture'&&r.requestId===absent.wire.id);
  assert(!missing.some(r=>r.phase==='public-message'||r.phase==='consumer-delivery'));
  assert.equal(missing.at(-1).completion,'UNKNOWN');assert.equal(ws.q3Capture.active,0);
  response({id:absent.wire.id,sessionId:'page-exact',result:{data:'late'}});await pause(25);
  const late=diagnosticRows.findLast(r=>r.event==='screenshot.response'&&r.requestId===absent.wire.id);
  assert.equal(late.status,'CDP deadline; UNKNOWN');assert.equal(late.routePending,false);assert.equal(late.late,true);
  assert.equal(pending.size,0);assert.equal(ws.q3Capture.active,0);assert.equal(timers.size,0);assert.equal(captureTimers.size,0);
  assert.equal(rows.filter(r=>r.observation!=='capture').length,startupRows,'startup observer stays stopped');
  for(const shot of [delayed,held,big,wrong]){
   const stages=rows.filter(r=>r.observation==='capture'&&r.requestId===shot.wire.id);
   assert.deepEqual(stages.map(r=>r.phase),['request','pre-send','send-return','public-message','consumer-delivery','settlement','observation-stop']);
   assert(stages.every(r=>r.sessionId==='page-exact'&&r.targetId==='exact-target'&&r.requestTargetId==='page'));
   assert.equal(stages.at(-1).completion,'consumer delivered');
   assert(stages.every((r,i)=>!i||BigInt(r.monotonicNs)>=BigInt(stages[i-1].monotonicNs)));
  }
  assert.deepEqual(received.map(r=>r.method),Array(5).fill('Page.captureScreenshot'),'no retries/probes/input/protocol changes');
  assert(received.every((r,i)=>r.id===i+1&&r.sessionId==='page-exact'&&JSON.stringify(r.params)==='{"format":"png"}'));
  const first=Error('first error identity');scope.terminalFailure=first;
  await assert.rejects(scope.send('Page.captureScreenshot',{},'page-exact'),e=>e===first);
  assert.equal(received.length,5,'terminal input/capture guard preserved');
 }finally{
  for(const t of timers)clearTimeout(t);
  const closed=once(ws,'close');ws.close();await closed;peer.destroy();await new Promise(r=>server.close(r));
 }
 assert.equal(ws.q3Capture.active,0);assert.equal(captureTimers.size,0);
 fs.writeFileSync(out+'/observations.jsonl.gz',zlib.gzipSync(rows.map(r=>JSON.stringify(r)).join('\n')+'\n'));
 if(!process.env.Q3_CAPTURE_PREPARED_TEST)await fullGenerated(out);
 fs.writeFileSync(out+'/result.json',JSON.stringify({passed:true,controlled,generatedNonObservationByteIdentical:true,
  scenarios:['delayed','public receipt before held consumer','large2MiB','wrong-session unchanged routing','absent real20s cap','late discarded','first-error identity'],
  noRuntime:true,lifecycle:'NOT_CREATED',protocol:received,completionWithoutReply:'UNKNOWN'},null,2));
 console.log('PASS current generated consumer: separate send/public/consumer; large event identity; real20s UNKNOWN; bounds/cleanup/failure containment; exact non-observation source');
}
if(process.env.Q3_CAPTURE_CHILD)fullPeer();
else main().catch(e=>{console.error(e);process.exitCode=1;});
