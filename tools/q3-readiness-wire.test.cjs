'use strict';
// Actual sealed generated caller with controlled EventTarget socket/child/guest
// services. No Chrome/guest/GPU: these controls do not prove native execution.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),crypto=require('node:crypto');
const cp=require('node:child_process'),Module=require('node:module'),zlib=require('node:zlib');
const {once}=require('node:events');
const root=path.resolve(__dirname,'..'),current=require('./q3-current-module.cjs');
const route=require('./q3-current-foreign-closure-v1.cjs');
// This preload executes the entire sealed generated caller/consumer. Only
// Chrome, HTTP and guest services are replaced with a controlled Node peer.
function fullPeer(){
 const dir=process.env.Q3_READINESS_CHILD,load=Module._load,spawn=cp.spawn,compile=Module.prototype._compile;
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
  if(parent?.filename===consumer&&name==='./readiness.cjs')return {ready:async(evaluate,app,options)=>{
   const ready=load.call(this,name,parent,main);
   await ready.ready(evaluate,app,options);
   await ready.ready(evaluate,app,options);
  }};
  if(parent?.filename===consumer&&name==='./local-controls.cjs')return {run:async()=>assert.fail('missing readiness must prevent service/input')};
  return load.call(this,name,parent,main);
 };
 globalThis.fetch=async url=>{
  const u=new URL(url);assert.equal(u.origin,'http://127.0.0.1:1');const file=path.resolve(root,'.'+u.pathname);assert(file.startsWith(root+'/'));
  return {status:200,arrayBuffer:async()=>fs.readFileSync(file)};
 };
 let shots=0,readyRequests=0;const protocol=[];
 globalThis.WebSocket=class extends EventTarget{
  constructor(){super();this.readyState=1;queueMicrotask(()=>this.onopen());}
  reply(q,result={}){const event=new MessageEvent('message',{data:JSON.stringify({id:q.id,...(q.sessionId?{sessionId:q.sessionId}:{}),result})});this.dispatchEvent(event);this.onmessage?.(event);}
  send(raw){const q=JSON.parse(raw);protocol.push({id:q.id,method:q.method,sessionId:q.sessionId??null,params:q.method==='Page.captureScreenshot'?q.params:null});
   if(q.method==='Page.addScriptToEvaluateOnNewDocument'){
    assert(q.params.source.includes('Q3_READINESS_PASSIVE'),'passive publisher prearmed before navigation');
    new vm.Script(q.params.source);
   }
   if(q.method==='Runtime.evaluate'&&q.params.expression.includes('runningApps')){
    ++readyRequests;
    assert.equal(this.q3Transport.active,false,'navigation diagnostic exhausted');
    if(readyRequests<=2)return setTimeout(()=>this.reply(q,{result:{value:readyRequests===2}}),80);
    if(readyRequests===3&&process.env.Q3_READINESS_MODE==='error')return queueMicrotask(()=>{
     const event=new MessageEvent('message',{data:JSON.stringify({id:q.id,sessionId:q.sessionId,error:{code:-32000,message:'controlled readiness error'}})});
     this.dispatchEvent(event);this.onmessage(event);
    });
    return; // third readiness reply absent: real unchanged20s timer
   }
   if(q.method==='Page.captureScreenshot')assert.fail('premature capture');
   let result={};if(q.method==='Target.getTargets')result={targetInfos:[{type:'page',targetId:'exact-target'}]};
   if(q.method==='Target.attachToTarget')result={sessionId:'exact-page-session'};
   queueMicrotask(()=>{this.reply(q,result);if(q.method==='Browser.close')browser.stdin.end('close\n');});
  }
  close(){this.readyState=3;}
 };
 process.once('exit',code=>fs.writeFileSync(dir+'/peer.json',JSON.stringify({code,protocol,shots,readyRequests,noChrome:true})));
}
async function fullGenerated(out,mode){
 const dir=out+'/full-generated-'+mode;fs.mkdirSync(dir);
 const prepared=dir+'/prepared',seal=current.prepare(prepared,{foreignClosureVersion:route.version});
 route.staged(prepared,route.version,seal.manifestSHA256);
 const child=cp.spawn(process.execPath,['--require',__filename,prepared+'/q3-runtime-caller.cjs'],{
  cwd:root,env:{...process.env,Q3_READINESS_CHILD:dir,Q3_READINESS_MODE:mode,LOCAL_PRODUCTION_FIXTURE:'1',BROWSER_DEADLINE:String(Date.now()+90000),
   Q3_READINESS_WIRE:'1',Q3_EXECUTION_BOUNDARY_OUT:dir+'/boundary.jsonl.gz'},stdio:['ignore','pipe','pipe']});
 const logs=require('./native-command-log.cjs').createLogs(dir);logs.attach('stdout',child.stdout);logs.attach('stderr',child.stderr);
 const guard=setTimeout(()=>{child.kill('SIGKILL');try{process.kill(Number(fs.readFileSync(dir+'/stand-in-pid')),'SIGKILL');}catch{}},65000);
 let code,signal;try{[code,signal]=await once(child,'close');await logs.drainStreams();logs.close();}finally{clearTimeout(guard);}
 assert.equal(code,1);assert.equal(signal,null);assert(child.stdout.readableEnded&&child.stderr.readableEnded);
 const read=p=>JSON.parse(fs.readFileSync(p)),peer=read(dir+'/peer.json'),wait=read(dir+'/browser-wait.json');
 assert.equal(peer.shots,0);assert.equal(peer.readyRequests,3);assert(!peer.protocol.some(q=>q.method.startsWith('Input.')));
 assert(!peer.protocol.some(q=>q.method==='Browser.close'),'terminal failure forbids automatic quit');
 const runtime=prepared+'/runtime';assert.match(read(runtime+'/first-browser-failure.json').error,mode==='error'?/controlled readiness error/:/CDP UNKNOWN Runtime.evaluate; no replay/);
 assert(!fs.existsSync(runtime+'/ready.json'));assert.equal(wait.code,0);assert.equal(wait.signal,null);assert(wait.stdoutEOF&&wait.stderrEOF);
 assert(!fs.existsSync(runtime+'/chrome-profile'));
 const records=zlib.gunzipSync(fs.readFileSync(dir+'/boundary-transport.jsonl.gz')).toString().trim().split('\n').map(JSON.parse);
 const stop=records.findIndex(r=>r.phase==='observation-stop'&&r.reason==='navigation settled');assert(stop>=0);
 const lane=records.filter(r=>r.observation==='readiness');
 assert(lane.length>0);
 const requests=lane.filter(r=>r.phase==='request');assert.equal(requests.length,3);
 for(const [index,q] of requests.entries()){
  const rows=lane.filter(r=>r.requestId===q.requestId);
  assert(rows.some(r=>r.phase==='pre-send'));assert(rows.some(r=>r.phase==='send-return'));
  assert.equal(rows.filter(r=>r.phase==='public-message').length,index===2&&mode==='missing'?0:1);
  assert.equal(rows.filter(r=>r.phase==='consumer-delivery').length,index===2&&mode==='missing'?0:1);
  assert.equal(rows.find(r=>r.phase==='settlement').outcome,index<2?'resolve':'reject');
 }
 if(mode==='error')assert.equal(lane.find(r=>r.phase==='consumer-delivery'&&r.errorCode!==null).errorCode,-32000);
 assert(records.slice(stop+1).some(r=>r.observation==='readiness'));
 fs.writeFileSync(dir+'/readiness-observations.json',JSON.stringify(lane,null,2));
 fs.writeFileSync(dir+'/result.json',JSON.stringify({passed:true,wholeSealedCaller:!process.env.Q3_CAPTURE_PREPARED_SMOKE,manifestSHA256:seal.manifestSHA256,
  actualWait:code,stdoutEOF:true,stderrEOF:true,standInWait:wait,lifecycle:'NOT_CREATED',completionWithoutReply:'UNKNOWN'},null,2));
}

async function main(){
 const out=path.resolve(process.argv[2]);assert(out.startsWith(root+'/scratch/runs/')&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const rows=[];class Socket extends EventTarget{};const socket=new Socket();
 const inert=current.createReadinessDiagnostics({socket,write:r=>rows.push(r),enabled:false});
 inert.request({requestId:1,method:'Runtime.evaluate'},{expression:'runningApps.guestWorker'});inert.dispose();assert.equal(rows.length,0);
 const d=current.createReadinessDiagnostics({socket,write:r=>rows.push(r),enabled:true});
 for(let i=0;i<10000;i++)d.request({requestId:i,method:'Debugger.enable'},{});
 assert.equal(rows.length,0,'unrelated traffic cannot exhaust reserved lane');
 for(let i=0;i<10000;i++){
  const meta={requestId:i,method:'Runtime.evaluate',sessionId:'page'};
  d.request(meta,{expression:'runningApps.guestWorker'});d.settlement(meta,'resolve');
 }
 assert(rows.length<=2048);d.dispose();assert(rows.length<=2048);
 const source=route.composition(route.version).compose().source;
 const wire=require('./q3-input-wire-observation.cjs').integrate(require('./q3-native-input-cause-diagnostic.cjs').consumerSource(source));new vm.Script(wire);
 for(const mode of ['error','missing'])await fullGenerated(out,mode);
 fs.writeFileSync(out+'/result.json',JSON.stringify({passed:true,inert:true,bounded:rows.length,generatedCaller:true,real20sMissingReply:true,noChrome:true}));
 console.log('PASS reserved inert/bounded readiness lane, actual sealed generated caller delayed/error/missing replies and terminal no-later-protocol/input/capture/quit');
}
if(process.env.Q3_READINESS_CHILD)fullPeer();else main().catch(e=>{console.error(e);process.exitCode=1;});
