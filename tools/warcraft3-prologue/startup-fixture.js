'use strict';
// The actual original composition through Browser.getVersion and actual close.
// Only the game boundary and launch delay/endpoint fault are fixture-specific.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),Module=require('node:module'),assert=require('node:assert/strict');
const {compose}=require('./native-composition');
function fixtureSource({root,mode,nodeOnly=false,productionSource}){
 let source=productionSource??compose({root,repair:mode!=='before-late'});
 if(mode==='before-terminal'){
  const legacy=compose({root,repair:false}),a=legacy.indexOf('async function close(reason){'),b=legacy.indexOf('\nasync function executeImpl(',a);
  const start=source.indexOf('let closePromise;'),end=source.indexOf('\nasync function executeImpl(',start);
  assert(a>0&&b>a&&start>0&&end>start);
  // Isolate the old cleanup defect after the repaired readiness has acquired
  // this same actual Chrome. The old function is byte-for-byte retained.
  source=source.slice(0,start)+legacy.slice(a,b)+source.slice(end);
 }
 const begin=source.indexOf(" save('browser-version.json',await send('Browser.getVersion'));");
 assert(begin>0,'actual protocol version boundary');
 source=source.slice(0,begin)+` save('browser-version.json',await send('Browser.getVersion'));
 save('fixture-startup.json',{ready:true,gameLaunches:0,rendererLinkage:'UNKNOWN',fixtureOnly:true});
 await close('startup terminal fixture complete');
 })().catch(async e=>{save('first-browser-failure.json',{at:new Date().toISOString(),error:e.stack,noReplay:true});process.exitCode=1;await close('first terminal failure')});`;
 if(mode.startsWith('race-')){
  // Exercise the actual composed timer/close/send continuations. The Node
  // protocol peer below supplies replies over separate real child pipes.
  source=source.replace(" ws=new WebSocket(", " globalThis.fixtureLifecycle={close,check,send,capture,execute};\n ws=new WebSocket(");
 }
 if(mode==='noendpoint'||mode==='late-deadline')source=source.replace("custody.ready(out+'/chrome-profile/DevToolsActivePort')","custody.ready(out+'/chrome-profile/DevToolsActivePort',{startupMs:600})");
 if(mode==='force')source=source.replace("return send('Browser.close')","return new Promise(()=>{})");
 if(mode==='before-terminal')source=source.replace("send('Browser.close')","new Promise(()=>{})");
 if(nodeOnly){
  const load=Module._load;
  Module._load=function(name,parent,main){
   if(name===root+'/test/static-server.js')return{startStaticServer:async()=>({prependListener(){},address:()=>({port:1}),closeAllConnections(){},close:r=>r()})};
   return load.call(this,name,parent,main);
  };
 }
 return source;
}
function run(directory,mode,{nodeOnly=false,prepared=false}={}){
 const root=path.resolve(__dirname,'../..'),spawn=cp.spawn;
 let browser;
 cp.spawn=function(command,args,options){
  assert.equal(command,'/usr/bin/google-chrome');
  const profile=args.find(s=>s.startsWith('--user-data-dir=')).slice(16);
  if(nodeOnly){
   browser=spawn(process.execPath,[__filename,'node-browser',profile,mode],{...options,stdio:['pipe','pipe','pipe']});
  }else{
   let delay=mode.includes('late')?11:mode==='cancel'?3:0;
   if(mode==='noendpoint')args=args.filter(s=>!s.startsWith('--remote-debugging-port='));
   if(mode==='early')args=['--version'];
   browser=spawn('python3',['-c','import os,sys,time;time.sleep(float(sys.argv[1]));os.execv(sys.argv[2],sys.argv[2:])',String(delay),command,...args],options);
  }
  const kill=browser.kill.bind(browser);browser.kill=signal=>{const sent=kill(signal);fs.appendFileSync(directory+'/fixture-signals.jsonl',JSON.stringify({at:Date.now(),pid:browser.pid,signal,sent})+'\n');return sent};
  fs.writeFileSync(directory+'/fixture-chrome-pid',String(browser.pid));return browser;
 };
 if(nodeOnly){
  const race=mode.startsWith('race-'),rows=[];
  const record=(kind,extra={})=>{const row={kind,at:Date.now(),...extra};rows.push(row);fs.appendFileSync(directory+'/node-protocol.jsonl',JSON.stringify(row)+'\n')};
  const stop=()=>{
   record('close-trigger');
   if(mode.includes('cancel'))process.emit('SIGTERM');
   else globalThis.fixtureLifecycle.close(mode==='race-ordinary-version'?'ordinary completion':'immutable runtime cap').catch(e=>record('close-error',{error:String(e)}));
   if(mode==='race-sticky-version')setTimeout(()=>process.emit('SIGTERM'),25);
   // Ordinary commands, input and capture must fail while closing; release
   // and independent close remain available. These calls never touch a game.
   for(const [label,action] of [
    ['command',()=>globalThis.fixtureLifecycle.send('Runtime.evaluate')],
    ['input',()=>globalThis.fixtureLifecycle.send('Input.dispatchKeyEvent',{type:'keyDown'})],
    ['spoof-release',()=>globalThis.fixtureLifecycle.send('Input.insertText',{type:'keyUp',text:'x'})],
    ['capture',()=>globalThis.fixtureLifecycle.capture('late')],
    ['quit',()=>globalThis.fixtureLifecycle.execute({id:'late-quit',action:'quit'})],
    ['release',()=>globalThis.fixtureLifecycle.send('Input.dispatchKeyEvent',{type:'keyUp'})],
    ['mouse-release',()=>globalThis.fixtureLifecycle.send('Input.dispatchMouseEvent',{type:'mouseReleased'})]
   ])Promise.resolve().then(action).then(()=>record('probe',{label,accepted:true}),e=>record('probe',{label,accepted:false,error:String(e)}));
  };
  globalThis.WebSocket=class{
   constructor(){
    this.readyState=1;
    let buffer='';browser.stdout.on('data',b=>{buffer+=b;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);const v=JSON.parse(line);record('response',{id:v.id,method:v.method});
     const deliver=()=>{record('delivery',{id:v.id,method:v.method});this.onmessage?.({data:JSON.stringify(v)})};
     if(mode==='race-completed-version'&&v.method==='Browser.getVersion')browser.once('close',()=>setTimeout(deliver,25));else deliver();
    }});
    setTimeout(()=>{record('connection-open');this.onopen?.()},mode.includes('connection')?150:0);
    if(race&&mode.includes('connection'))setTimeout(stop,25);
   }
   send(text){const v=JSON.parse(text);record('request',{id:v.id,method:v.method,params:v.params});browser.stdin.write(text+'\n');if(race&&v.method==='Browser.getVersion')setTimeout(stop,25)}
   close(){this.readyState=3;this.onclose?.()}
  };
 }
 if(prepared){
  assert.notEqual(mode,'before-late','baseline explicitly retains old startup');
  const compile=Module.prototype._compile;
  Module.prototype._compile=function(source,file){
   if(file===directory+'/browser-run.cjs'){
    Module.prototype._compile=compile;
    assert.equal(source,compose({root}),'actual prepared production composition');
    source=fixtureSource({root,mode,nodeOnly,productionSource:source});
   }
   return compile.call(this,source,file);
  };
  require(directory+'/compose.cjs');return;
 }
 const source=fixtureSource({root,mode,nodeOnly});
 const m=new Module(directory+'/browser-run.cjs',module);m.filename=directory+'/browser-run.cjs';m.paths=module.paths;m._compile(source,m.filename);
}
module.exports={fixtureSource,run};
if(require.main===module){
 if(process.argv[2]==='node-browser'){
  const [profile,mode]=process.argv.slice(3);
  if(mode==='early')process.exit(7);
  if(mode!=='noendpoint')setTimeout(()=>{fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(profile+'/DevToolsActivePort','43123\n/devtools/browser/node-control\n')},mode.includes('late')?11000:mode==='cancel'?3000:10);
  const reply=v=>process.stdout.write(JSON.stringify({id:v.id,method:v.method,result:v.method==='Browser.getVersion'?{product:'Node control; no browser'}:{}})+'\n');
  const lines=require('node:readline').createInterface({input:process.stdin});
  lines.on('line',line=>{const v=JSON.parse(line);
   if(v.method==='Browser.getVersion'&&mode.startsWith('race-'))setTimeout(()=>reply(v),100);
   else {reply(v);if(v.method==='Browser.close')setTimeout(()=>process.exit(0),mode.startsWith('race-')?200:10)}
  });setTimeout(()=>process.exit(8),25000);
 }else run(path.resolve(process.argv[2]),process.argv[3],{nodeOnly:process.argv.includes('--node-only'),prepared:process.argv.includes('--prepared')});
}
