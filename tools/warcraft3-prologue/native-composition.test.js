'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),path=require('node:path');
const {compose}=require('./native-composition'),{createRendererIdentity}=require('./renderer-identity');
const root=path.resolve(__dirname,'../..');
function fixture(source=compose({root}),fault){
 // Execute the production session/send/check closure, including both guards.
 const a=source.indexOf('let browser,server,'),b=source.indexOf('let optionalDelay=false;');assert(a>0&&b>a);
 const api=vm.runInNewContext(source.slice(a,b)+`\n({session,send,check,pending,setGuard:v=>guard=v,setSocket:v=>ws=v,setClosing:()=>{closing=true;closeReason='test cancellation'},setCustody:v=>custody=v})`,{require,Symbol,Map,Error,Date,Promise,setTimeout,clearTimeout,trace:{span:(_n,fn)=>fn(),expression:v=>({expression:v}),snapshot(){}},fs:require('node:fs')});
 const frame={id:'FRAME',loaderId:'LOADER',url:'http://original/'},info={targetId:'TARGET',type:'page',url:frame.url,attached:true};
 const identity=pid=>({pid,startTicks:String(pid+100),bootId:'BOOT',namespaces:{pid:'pid:[1]'},exe:'/chrome',argv:pid===202?['--type=renderer']:[]});
 const browser=api.session(undefined),page=api.session('PAGE'),calls=[];let fired=false;
 api.setSocket({send(raw){const v=JSON.parse(raw);calls.push(v.method);queueMicrotask(()=>{
  if(fault&&v.method==='Tracing.start'&&!fired){fired=true;fault({api,page,frame});}
  let result={};
  if(v.method==='Target.getTargetInfo')result={targetInfo:info};
  if(v.method==='Target.getTargets')result={targetInfos:[info]};
  if(v.method==='Page.getFrameTree')result={frameTree:{frame}};
  if(v.method==='SystemInfo.getProcessInfo')result={processInfo:[{id:101,type:'browser'},{id:202,type:'renderer'}]};
  if(v.method==='Tracing.end')queueMicrotask(()=>page.emit('Tracing.tracingComplete',{stream:'TRACE',dataLossOccurred:false}));
  if(v.method==='IO.read')result={data:JSON.stringify({traceEvents:[{name:'TracingStartedInBrowser',args:{data:{frames:[{frame:frame.id,url:frame.url,processId:202}]}}}]}),eof:true};
  const p=api.pending.get(v.id);clearTimeout(p.timer);api.pending.delete(v.id);p.resolve(result);
 });}});
 const guard=createRendererIdentity({browserSession:browser,pageSession:page,chromePid:101,deadline:Date.now()+3000,collectionMs:500,readIdentity:identity,retain(){}});api.setGuard(guard);
 return {api,guard,page,calls};
}
async function main(){
 const old=process.env.WC_COMPOSITION_OLD;
 if(old){const f=fixture(require(old).compose({root}));try{await f.guard.qualify()}finally{f.guard.dispose()}return;}
 const f=fixture();try{
  const proof=await f.guard.qualify();assert.equal(proof.renderer.pid,202);f.api.check();await f.api.send('Runtime.evaluate',{expression:'ordinary guarded request'});
  assert(f.calls.includes('Target.getTargetInfo')&&f.calls.includes('IO.close'));
  await assert.rejects(()=>f.page.send('Input.dispatchKeyEvent',{type:'keyDown'}),/unsupported qualification/);
  await assert.rejects(()=>f.page.send('Page.captureScreenshot'),/unsupported qualification/);
  f.page.emit('Inspector.detached',{reason:'replaced'});const first=f.guard.snapshot().unknown;
  await assert.rejects(()=>f.api.send('Runtime.evaluate'),/UNKNOWN/);await assert.rejects(()=>f.page.send('Target.getTargetInfo'),/UNKNOWN/);assert.equal(f.guard.snapshot().unknown,first);
 }finally{f.guard.dispose()}
 for(const fault of [({page,frame})=>page.emit('Page.frameNavigated',{frame:{...frame,loaderId:'NEW'}}),({api})=>api.setClosing(),({api})=>api.setCustody({check(){throw Error('Chrome terminal UNKNOWN')}})]){
  const f=fixture(undefined,fault);try{await assert.rejects(()=>f.guard.qualify(),/UNKNOWN/);assert(!f.guard.snapshot().proof);const n=f.calls.length;await assert.rejects(()=>f.api.send('Page.captureScreenshot'),/UNKNOWN/);assert.equal(f.calls.length,n)}finally{f.guard.dispose()}
 }
 const u=fixture();try{await assert.rejects(()=>u.api.send('Runtime.evaluate'),/not qualified/);assert.equal(u.calls.length,0);await assert.rejects(()=>u.guard.qualify(),/not qualified/)}finally{u.guard.dispose()}
 console.log('Production qualification/session/CDP composition PASS; ordinary pre-proof, forbidden input/capture, invalidation, late reply, cancellation and terminal negatives PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1});
