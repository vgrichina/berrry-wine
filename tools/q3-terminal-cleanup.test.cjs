'use strict';
// Actual sealed generated caller, numbered transport, held screenshot peer,
// real Node child and Q3 ptrace supervisor. No Chrome or source-only caller.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const Module=require('node:module'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const crypto=require('node:crypto'),{once}=require('node:events');
const root=path.resolve(__dirname,'..'),current=require('./q3-current-module.cjs');
const route=require('./q3-current-foreign-closure-v1.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function peer(){
 const dir=process.env.Q3_TERMINAL_PEER,mode=process.env.Q3_TERMINAL_MODE;
 const consumer=root+'/'+require('./q3-native-driver-composition.cjs').consumerPath;
 const load=Module._load,spawn=cp.spawn,compile=Module.prototype._compile;
 if(mode==='baseline'){
  const filename=root+'/tools/q3-current-module.cjs',old=new Module(filename,module);old.filename=filename;old.paths=module.paths;
  old._compile(cp.execFileSync('git',['show','c367007f7:tools/q3-current-module.cjs'],{cwd:root,encoding:'utf8'}),filename);
  current.composeStartupDiagnostics=old.exports.composeStartupDiagnostics;
 }
 let browser,socket,out,shots=0;const protocol=[],blocked=[],late=[];
 Module.prototype._compile=function(source,name){
  if(name===consumer){
   fs.writeFileSync(dir+'/installed.json',JSON.stringify({sha256:hash(source),bytes:Buffer.byteLength(source),sourceCopied:false}));
   // The stand-in fixture has no native lifecycle manifest. Select the native
   // cleanup policy only at actual consumer entry, after sealed caller checks.
   // This offline context injection is never a native launch recipe.
   if(mode==='cancel-native')process.env.Q3_NATIVE_PHASE='original';
  }
  return compile.call(this,source,name);
 };
 cp.spawn=(command,args)=>{
  assert.equal(command,'/usr/bin/google-chrome');const profile=args.find(v=>v.startsWith('--user-data-dir=')).slice(16);
  browser=spawn(process.execPath,['-e',String.raw`
   const fs=require('node:fs'),profile=process.argv[1];fs.mkdirSync(profile,{recursive:true});
   fs.writeFileSync(profile+'/DevToolsActivePort','1\n/devtools/browser/peer\n');
   const cap=setTimeout(()=>process.exit(9),65000);
   function stop(){clearTimeout(cap);process.stdout.write('child stdout EOF\n');process.stderr.write('child stderr EOF\n');process.stdin.destroy();}
   process.stdin.once('data',stop);process.once('SIGTERM',stop);
  `,profile],{stdio:['pipe','pipe','pipe']});
  browser.stdout.resume();browser.stderr.resume();
  browser.once('close',(code,signal)=>fs.writeFileSync(dir+'/browser-wait.json',JSON.stringify({code,signal,stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded})));
  return browser;
 };
 Module._load=function(name,parent,main){
  if(name===root+'/test/static-server.js')return {startStaticServer:async()=>({address:()=>({port:1}),prependListener(){},closeAllConnections(){},close:fn=>fn()})};
  if(parent?.filename===consumer&&name===root+'/tools/q3-startup.cjs')return {launch:async()=>({peer:true})};
  if(parent?.filename===consumer&&name==='./readiness.cjs')return {ready:async()=>({peer:true})};
  if(parent?.filename===consumer&&name==='./bound-input.cjs')return {createChain:({send,pageSession})=>({capture:async()=>{
   const value=await send('Page.captureScreenshot',{format:'png'},pageSession);
   return {png:Buffer.from(value.data),capture:{label:'success'},before:{},after:{}};
  }})};
  if(parent?.filename===consumer&&name==='./local-controls.cjs')return {run:async options=>{
   out=options.out;
   if(mode==='success'){await options.send('Page.captureScreenshot',{format:'png'},options.pageSession);return;}
   if(mode==='cancel'||mode==='cancel-native'){
    fs.writeFileSync(dir+'/caller-cancelled.json','{}');
    await options.wait(10000);assert.fail('planned cancellation failed to interrupt wait');
   }
   if(mode!=='baseline'){
    const monitor=setInterval(()=>{
     if(!fs.existsSync(out+'/first-transport-failure.json'))return;
     clearInterval(monitor);
     for(const method of ['Input.dispatchKeyEvent','Page.captureScreenshot','Browser.close'])
      options.send(method,{},options.pageSession).then(()=>blocked.push({method,rejected:false}),()=>blocked.push({method,rejected:true}));
     options.capture('forbidden').then(()=>blocked.push({method:'capture',rejected:false}),()=>blocked.push({method:'capture',rejected:true}));
    },10);monitor.unref();
   }
   // Production consume and execute with its real20s work/CDP caps. The
   // screenshot is deliberately reached after phase-local state service.
   if(mode==='command'||mode==='baseline'){
    const transport=load(root+'/scratch/runs/20261108-q3-gl-readiness-gameplay/transport.cjs',parent,false);
    const now=Date.now(),runEnd=JSON.parse(fs.readFileSync(out+'/execution-window.json')).browserStop;
    const command={id:'held',action:'capture',label:'held',waitMs:100,timing:{workEnd:now+20000,ackEnd:now+22000,runEnd:Date.parse(runEnd)}};
    fs.writeFileSync(out+'/commands/0.json',JSON.stringify(command));
    await transport.consume(out,0,options.execute);return;
   }
   await options.send('Page.captureScreenshot',{format:'png'},options.pageSession);
  }};
  return load.call(this,name,parent,main);
 };
 globalThis.fetch=async url=>({status:200,arrayBuffer:async()=>fs.readFileSync(path.resolve(root,'.'+new URL(url).pathname))});
 globalThis.WebSocket=class extends EventTarget{
  constructor(){super();socket=this;this.readyState=1;queueMicrotask(()=>this.onopen());}
  reply(q,result={},error){const event=new MessageEvent('message',{data:JSON.stringify({id:q.id,...(q.sessionId?{sessionId:q.sessionId}:{}),...(error?{error}:{result})})});this.dispatchEvent(event);this.onmessage?.(event);}
  send(raw){
   const q=JSON.parse(raw),terminal=out&&fs.existsSync(out+'/first-transport-failure.json');
   protocol.push({id:q.id,method:q.method,at:Date.now(),terminal:!!terminal});
   if(q.method==='Page.captureScreenshot'){
    ++shots;
    if(mode==='success')return setTimeout(()=>this.reply(q,{data:'returned-image-bytes'}),50);
    if(mode==='refusal')return queueMicrotask(()=>this.reply(q,{}, {message:'actual peer refused screenshot'}));
    // A late raw reply cannot revive execution or authorize a new command.
    setTimeout(()=>{late.push({id:q.id,terminal:fs.existsSync(out+'/first-transport-failure.json')});this.reply(q,{data:'late-image'});},22000);
    return;
   }
   let result={};
   if(q.method==='Target.getTargets')result={targetInfos:[{type:'page',targetId:'peer-target'}]};
   if(q.method==='Target.attachToTarget')result={sessionId:'peer-page'};
   if(q.method==='Runtime.evaluate')result={result:{value:{apps:[],workers:[]}}};
   queueMicrotask(()=>{this.reply(q,result);if(q.method==='Browser.close')browser.stdin.end('ordinary close\n');});
  }
  close(){this.readyState=3;}
 };
 process.once('exit',code=>fs.writeFileSync(dir+'/peer.json',JSON.stringify({code,protocol,shots,late,blocked,noChrome:true})));
}
async function run(base,mode){
 const dir=base+'/'+mode;fs.mkdirSync(dir);
 const seal=current.prepare(dir+'/prepared',{foreignClosureVersion:route.version});
 route.staged(dir+'/prepared',route.version,seal.manifestSHA256);
 const script=String.raw`
import runpy,sys,time,json
from pathlib import Path
root=Path(sys.argv[1]);out=Path(sys.argv[2]);sys.path.insert(0,str(root/'tools'))
adapter=runpy.run_path(str(root/'tools/q3-startup-custody.py'))
try:
 adapter['supervise'](out/'custody',[sys.argv[3],'--require',str(root/'tools/q3-terminal-cleanup.test.cjs'),str(out/'prepared/q3-runtime-caller.cjs')],deadline=time.time()+65,cleanup_deadline=time.time()+75,journal_compression='gzip')
except AssertionError as e:
 assert e.args==(1,),e
`;
 const child=cp.spawn('python3',['-B','-c',script,root,dir,process.execPath],{cwd:root,
  env:{...process.env,Q3_TERMINAL_PEER:dir,Q3_TERMINAL_MODE:mode,LOCAL_PRODUCTION_FIXTURE:'1',
   BROWSER_DEADLINE:String(Date.now()+90000),Q3_EXECUTION_BOUNDARY_OUT:dir+'/boundary.jsonl.gz'},stdio:['ignore','pipe','pipe']});
 const logs=require('./native-command-log.cjs').createLogs(dir);logs.attach('stdout',child.stdout);logs.attach('stderr',child.stderr);
 const [code,signal]=await once(child,'close');await logs.drainStreams();logs.close();
 assert.equal(code,0,dir);assert.equal(signal,null);assert(child.stdout.readableEnded&&child.stderr.readableEnded);
 const read=p=>JSON.parse(fs.readFileSync(dir+'/'+p)),p=read('peer.json'),wait=read('browser-wait.json'),drain=read('custody/kernel-drain.json');
 assert(drain.complete);assert.equal(drain.owned.length,drain.reaped.length);assert.equal(drain.unreaped.length,0);
 assert(wait.stdoutEOF&&wait.stderrEOF);assert.equal(wait.code,0);assert.equal(wait.signal,null);
 const closes=p.protocol.filter(q=>q.method==='Browser.close'),after=p.protocol.filter(q=>q.terminal);
 if(['success','cancel','baseline'].includes(mode))assert.equal(closes.length,1);
 else{assert.equal(closes.length,0);assert.equal(after.length,0,'no protocol at all after first terminal');
  if(mode!=='cancel-native'){assert.equal(p.blocked.length,4);assert(p.blocked.every(r=>r.rejected),'direct later protocol/capture attempts reject');}}
 if(mode==='cancel-native'){
  const trace=zlib.gunzipSync(fs.readFileSync(dir+'/prepared/runtime/await-trace.jsonl.gz')).toString().trim().split('\n').map(JSON.parse);
  assert(!trace.some(r=>r.event==='entry'&&r.name==='cdp.request'&&r.method==='Browser.close'),'native cancellation refuses close before request allocation/trace');
 }
 if(mode==='success')assert.equal(p.code,0);else assert.equal(p.code,1);
 if(['command','deadline'].includes(mode)){
  assert(p.late.some(r=>r.terminal),'late raw response actually delivered after terminal');
  assert(!fs.existsSync(dir+'/prepared/runtime/held.png'));assert(!fs.existsSync(dir+'/prepared/runtime/reply-0.json'));
 }
 const receipt=read('prepared/runtime/terminal-browser.json');assert(receipt.drained);
 if(['success','cancel','baseline'].includes(mode))assert(receipt.normal);
 else{assert.equal(receipt.closeRequest,'UNKNOWN');assert.deepEqual(receipt.signals.map(v=>v.signal),['SIGTERM']);}
 const result={mode,passed:true,manifestSHA256:seal.manifestSHA256,installed:read('installed.json'),protocol:p.protocol,
  late:p.late,receipt,owned:drain.owned.length,reaped:drain.reaped.length,actualWait:code,stdoutEOF:true,stderrEOF:true};
 fs.writeFileSync(dir+'/result.json',JSON.stringify(result,null,2));return result;
}
async function main(){
 const out=path.resolve(process.argv[2]||'');assert(process.argv[2]&&out.startsWith(root+'/scratch/runs/')&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const results=await Promise.allSettled(['baseline','command','deadline','refusal','cancel','cancel-native','success'].map(mode=>run(out,mode)));
 for(const r of results)if(r.status==='rejected')throw r.reason;
 fs.writeFileSync(out+'/result.json',JSON.stringify(results.map(r=>r.value),null,2));
 console.log('PASS baseline violation reproduced; actual generated held screenshot work/CDP deadlines and refusal admit zero later protocol; late reply stays terminal; planned cancellation and ordinary close PASS; actual kernel reaps and separate EOF');
}
if(process.env.Q3_TERMINAL_PEER)peer();else if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
