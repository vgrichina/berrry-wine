'use strict';
const assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const driver=require('../tools/stronghold-attached-original-preset-driver.cjs'),attachment=require('../tools/stronghold-preset-driver-attachment.cjs');
const event={waitingForDebugger:true,sessionId:'session-1',targetInfo:{targetId:'target-1',type:'worker',url:'http://127.0.0.1:1234/lib/guest-worker.js?v=dev'}};
async function bindingControl({factory=driver.createAttachment,url='lib/guest-worker.js?v=dev',href='http://127.0.0.1:1234/index.html?debug&candidates&frozen',duplicate=false,wrongHash=false,wrongSlot=false,wrongSession=false,wrongOrder=false}={}){
 const wasm='a'.repeat(64),calls=[],logs=[];
 const report={targetId:'target-1',sessionId:wrongSession?'foreign':'session-1',workerURL:event.targetInfo.url,entries:1,installedBeforeInstantiation:true,entryError:null,
  events:[{kind:'received-module',type:'init',slot:0},{kind:'instantiated',incoming:{type:'init',slot:0}}]};
 const session={send:async(method,args)=>{calls.push(args.expression);return {result:{value:JSON.stringify(report)}};}};
 const entry={session,sessionId:'session-1',info:{url:event.targetInfo.url},expectedWorkerURL:event.targetInfo.url,preloadVerified:true};
 const sent={kind:'sent-module',workerURL:url,sha256:wrongHash?'b'.repeat(64):wasm,slot:wrongSlot?1:0,type:'init'},compiled={kind:'compiled',sha256:wasm};
 const events=wrongOrder?[sent,compiled]:[compiled,sent];if(duplicate)events.push({...sent});
 const state={main:{href,observation:{events}}},before=JSON.stringify(state);
 const h=factory({sessions:new Map([['target-1',entry]]),pageState:async()=>state,wasmSha256:wasm,save:()=>{},log:(name,row)=>logs.push({name,...row})});
 try{await h.begin({action:'route-press-preset'},0);assert(h.active);assert(calls.some(c=>c.includes('"start"')));return logs;}
 finally{assert.equal(JSON.stringify(state),before,'raw page evidence must remain unchanged');}
}
class Session extends EventEmitter{
 constructor(mode='valid'){super();this.mode=mode;this.calls=[];this.realm={};}
 async send(method,args){
  this.calls.push({method,args});
  if(method==='Debugger.setInstrumentationBreakpoint')return {breakpointId:'bp-1'};
  if(method==='Runtime.runIfWaitingForDebugger'){
   if(this.mode==='disconnect'){this.emit('Disconnected');return {};}
   if(this.mode==='idle')return {};
   this.emit('Debugger.scriptParsed',{scriptId:'actual-script',url:this.mode==='wrong-url'?'http://foreign/worker.js':event.targetInfo.url,executionContextId:this.mode==='missing-context'?undefined:17});
   this.emit('Debugger.paused',{reason:this.mode==='wrong-reason'?'other':'instrumentation',callFrames:[{location:{scriptId:'actual-script'}}]});
  }
  if(method==='Runtime.evaluate'){
   assert.equal(args.contextId,17);assert.equal(this.realm.started,undefined);
   if(this.mode==='target-closed')throw Error('Target closed');
   if(this.mode==='exception')return {exceptionDetails:{text:'preload failure'}};
   vm.runInNewContext(args.expression,this.realm);return {result:{value:true}};
  }
  if(method==='Debugger.resume'){assert.equal(this.realm.preloaded,true);this.realm.started=true;}
  return {};
 }
}
(async()=>{
 // Reproduce the literal comparison failure from Chrome before testing the
 // successor. These are binding fixtures, never browser/game qualification.
 await assert.rejects(bindingControl({factory:attachment.createAttachment}),/binding missing/);
 const bindings=await bindingControl();assert.equal(bindings[0].rawWorkerURL,'lib/guest-worker.js?v=dev');assert.equal(bindings[0].workerURL,event.targetInfo.url);
 for(const url of [event.targetInfo.url,'/lib/guest-worker.js?v=dev','./lib/guest-worker.js?v=dev'])await bindingControl({url});
 for(const control of [
  {url:'http://foreign/lib/guest-worker.js?v=dev'}, {url:'lib/guest-worker.js?v=other'}, {url:'lib/other.js?v=dev'},
  {url:''}, {url:null}, {href:null}, {href:'file:///index.html'}, {duplicate:true}, {wrongHash:true}, {wrongSlot:true}, {wrongSession:true}, {wrongOrder:true}
 ])await assert.rejects(bindingControl(control));
 const rows=[];
 const s=new Session();await driver.installBeforeFirstScript(s,{event,expression:'globalThis.preloaded=true',deadline:Date.now()+1000,log:(name,row)=>rows.push({name,...row})});
 assert.deepEqual(s.calls.map(x=>x.method),['Runtime.enable','Debugger.enable','Debugger.setInstrumentationBreakpoint','Runtime.runIfWaitingForDebugger','Runtime.evaluate','Debugger.removeBreakpoint','Debugger.resume']);
 assert.equal(s.realm.started,true);assert.equal(rows[1].contextId,17);assert.equal(rows[1].sessionId,event.sessionId);
 assert.equal(s.listenerCount('Debugger.paused'),0);
 const negatives=[];
 for(const mode of ['disconnect','wrong-url','missing-context','wrong-reason','target-closed','exception','idle']){
  const s=new Session(mode);await assert.rejects(driver.installBeforeFirstScript(s,{event,expression:'globalThis.preloaded=true',deadline:Date.now()+(mode==='idle'?10:1000)}));
  assert(!s.calls.some(x=>x.method==='Debugger.resume'));assert.equal(s.listenerCount('Debugger.paused'),0);assert.equal(s.realm.started,undefined);negatives.push(mode);
 }
 await assert.rejects(driver.installBeforeFirstScript(new Session(),{event:{...event,waitingForDebugger:false},expression:'',deadline:Date.now()+1000}),/paused/);
 await assert.rejects(driver.installBeforeFirstScript(new Session(),{event,expression:'',deadline:0}),/deadline/);
 const root=path.resolve(__dirname,'..'),run=path.join(root,'scratch/runs/20261104-stronghold-first-script-native/offline-successor-check');fs.mkdirSync(run,{recursive:true});
 const pins=path.join(run,'pins.json');fs.writeFileSync(pins,JSON.stringify({commit:'fixture-only',files:[{path:'build/wine-assembly.wasm',sha256:attachment.hash(fs.readFileSync(path.join(root,'build/wine-assembly.wasm')))}]}));
 const original=attachment.prepare({run,pins}),composed=driver.prepare({run,pins});
 assert.equal(composed.route,original.route);assert.deepEqual(composed.evidence.bounds,original.evidence.bounds);
 assert(composed.source.includes("close('first concrete Worker preload failure')"));
 assert(!composed.source.includes("const result=await session.send('Runtime.evaluate',{expression});"));
 assert(composed.source.includes('installBeforeFirstScript(session,{event,expression,deadline,log})'));
 new vm.Script(composed.source,{filename:composed.driver});
 // Compile the actual source and its retained helper closure without main.
 const cut=composed.source.lastIndexOf('main().catch(');attachment.compileClosure(composed.source.slice(0,cut),composed.driver,composed.route,composed.evidence.retainedClosure);
 const result={passed:true,transportOrder:s.calls.map(x=>x.method),negativeControls:negatives,urlBinding:{originalLiteralFailureReproduced:true,relativeAndAbsolutePass:true,negativeControls:12,rawEvidenceUnchanged:true},actualComposition:true,retainedHelpers:composed.evidence.retainedClosure.length,unchangedRouteAndBounds:true,actualChrome:false,causeOfOriginalTargetClosure:'unknown; successor requires fresh separately allocated browser qualification'};
 if(process.env.STRONGHOLD_ATTACHED_DRIVER_RESULT)fs.writeFileSync(process.env.STRONGHOLD_ATTACHED_DRIVER_RESULT,JSON.stringify(result,null,2));
 console.log('PASS offline exact-context first-script transport, fail-closed controls and actual retained driver composition; no Chrome/game');
})().catch(error=>{console.error(error);process.exitCode=1;});
