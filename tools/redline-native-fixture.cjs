'use strict';
// Task-authored ordinary PE only. The actual Redline startup helper runs intact.
const fs=require('fs'),cp=require('child_process'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),zlib=require('zlib');
const {pipeline}=require('stream/promises');
const {createLifecycle,observeChild}=require('./redline-fixture-shutdown.cjs');
const root=process.cwd(),R=path.resolve(process.env.REDLINE_RUN),save=(n,v)=>fs.writeFileSync(R+'/'+n,JSON.stringify(v,null,2),{flag:'wx'}),wait=ms=>new Promise(r=>setTimeout(r,ms));
const {pe}=require(root+'/test/test-dll-lifecycle-real-pe');
const U=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];let code=[];
const emit=(...v)=>code.push(...v.flat()),push=n=>emit(0x68,U(n)),store=n=>emit(0xa3,U(n));
const com=(obj,slot,args)=>{for(const a of args.slice().reverse())push(a);emit(0xff,0x35,U(obj),0xa1,U(obj),0x8b,0x00,0xff,0x90,U(slot*4));};
for(const x of [0,0x401400,0x700,0x400000])push(x);emit(0xff,0x15,U(0x401900));store(0x401408);
com(0x401400,3,[0x401100,0x401404,0]);store(0x40140c);
com(0x401404,11,[0x401200]);store(0x401410);com(0x401404,7,[]);store(0x401414);
com(0x401400,3,[0x401110,0x401430,0]);store(0x401434);
com(0x401430,11,[0x401300]);store(0x401438);com(0x401430,7,[]);store(0x40143c);
const loop=code.length;
com(0x401404,9,[16,0x401500]);store(0x401418);
emit(0xa1,U(0x401500),0x01,0x05,U(0x401520),0xa1,U(0x401504),0x01,0x05,U(0x401524));
com(0x401430,9,[256,0x401600]);store(0x401440);
// Keep the last two native scan-code results and count high reads in guest code.
for(const [scan,dest] of [[0x33,0x401450],[0x34,0x401454]]){
 emit(0x0f,0xb6,0x05,U(0x401600+scan),0xa3,U(dest),0x25,U(0x80),0x01,0x05,U(dest+8));
}
emit(0xff,0x05,U(0x40141c),0xe9,U(loop-(code.length+11)));
const image=pe([[0x2000,code]]),raw=n=>n-0x1000+0x200;
image.fill(0,raw(0x1900),raw(0x1e00));image.writeUInt32LE(0x1a00,raw(0x1900));image.write('DirectInputCreateA\0',raw(0x1a02));
for(const [base,guid] of [[0x1100,0x6f1d2b60],[0x1110,0x6f1d2b61]])[guid,0x11cfd5a0,0x4544c7bf,0x00005453].forEach((v,i)=>image.writeUInt32LE(v,raw(base+i*4)));
[24,16,2,16,7,0x401240].forEach((v,i)=>image.writeUInt32LE(v,raw(0x1200+i*4)));
for(let i=0;i<7;i++)[0,i<3?i*4:i+9,i<3?0xffff03:0xffff0c,0].forEach((v,j)=>image.writeUInt32LE(v,raw(0x1240+i*16+j*4)));
[24,16,2,256,2,0x401340].forEach((v,i)=>image.writeUInt32LE(v,raw(0x1300+i*4)));
for(const [i,scan] of [0x33,0x34].entries())[0,scan,(scan<<8)|0x0c,0].forEach((v,j)=>image.writeUInt32LE(v,raw(0x1340+i*16+j*4)));
const dll=pe([[0x1000,[0xb8,1,0,0,0,0xc2,12,0]]],true);
save('fixture-images.json',{imageSha256:crypto.createHash('sha256').update(image).digest('hex'),bytes:image.length,dllSha256:crypto.createHash('sha256').update(dll).digest('hex'),dllBytes:dll.length});
let browser,server,ws,session;let seq=0;const pending=new Map(),workers=new Map(),tasks=[],streams=[];const cancellation=new AbortController();
const cancel=()=>cancellation.abort(Error('fixture cancelled by SIGTERM'));
process.once('SIGTERM',cancel);
const lifecycle=createLifecycle({
 resources:()=>({browser,server,exit:browserExit,streams,tasks}),signal:cancellation.signal,
 closeBrowser:onError=>{if(ws?.readyState===1){const id=++seq;ws.onmessage=e=>{const v=JSON.parse(e.data);if(v.id===id){ws.onmessage=null;if(v.error)onError(Error(JSON.stringify(v.error)));}};ws.send(JSON.stringify({id,method:'Browser.close',params:{}}));}},
 stopProtocol:()=>{for(const p of pending.values()){clearTimeout(p.t);p.reject(Error('fixture closed'));}pending.clear();if(ws)ws.onmessage=null;},
 finalize:({firstFailure,...receipt})=>{ws?.close();if(firstFailure)save('fixture-first-terminal.json',{error:firstFailure.stack??String(firstFailure),noFurtherInputCaptureRetry:true});if(browser && !receipt.actualBrowserExit)throw Error('fixture child not joined; profile retained');fs.rmSync(R+'/fixture-profile',{recursive:true,force:true});save('fixture-cleanup.json',receipt);}
});
let browserExit;
const send=(method,params={},sessionId=session)=>new Promise((resolve,reject)=>{lifecycle.guard();const id=++seq,t=setTimeout(()=>{pending.delete(id);reject(Error('CDP UNKNOWN '+method));},20000);pending.set(id,{resolve,reject,t});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
const evaluate=async(expression,s=session)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},s);assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
async function event(v){
 lifecycle.guard();
 if(v.method==='Target.attachedToTarget'&&v.params.targetInfo.type==='worker'){
  const {sessionId,targetInfo}=v.params;workers.set(sessionId,{sessionId,targetId:targetInfo.targetId,url:targetInfo.url,scripts:[],closed:false});
  await send('Runtime.enable',{},sessionId);await send('Debugger.enable',{},sessionId);
  await evaluate(fs.readFileSync(root+'/scratch/runs/20261108-redline-car-door-native/input-observer.js','utf8'),sessionId);
  await send('Runtime.runIfWaitingForDebugger',{},sessionId);
 }
 if(v.method==='Debugger.scriptParsed'&&workers.has(v.sessionId)&&(v.params.scriptLanguage==='WebAssembly'||v.params.url.startsWith('wasm://')))workers.get(v.sessionId).scripts.push({scriptId:v.params.scriptId});
 if(v.method==='Target.detachedFromTarget'&&workers.has(v.params.sessionId))workers.get(v.params.sessionId).closed=true;
}
async function main(){
 return lifecycle.run(async()=>{
 server=await require(root+'/test/static-server.js').startStaticServer({root,crossOriginIsolated:true,rewritePath:p=>p.startsWith('/binaries/')?'/test'+p:p});
 lifecycle.guard();
 browser=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+R+'/fixture-profile','about:blank'],{stdio:['ignore','pipe','pipe']});
 browserExit=lifecycle.track(observeChild(browser));
 browserExit.then(receipt=>save('fixture-browser-exit.json',receipt)).catch(()=>{});
 for(const [s,n] of [[browser.stdout,'stdout'],[browser.stderr,'stderr']])streams.push(lifecycle.track(pipeline(s,zlib.createGzip(),fs.createWriteStream(R+'/fixture-chrome-'+n+'.gz',{flags:'wx'}))));
 const active=R+'/fixture-profile/DevToolsActivePort';for(let i=0;i<150&&!fs.existsSync(active);i++){assert(browser.exitCode===null);await wait(100);}const [port,suffix]=fs.readFileSync(active,'utf8').trim().split('\n');
 ws=new WebSocket('ws://127.0.0.1:'+port+suffix);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});ws.onmessage=e=>{const v=JSON.parse(e.data);if(v.id){const p=pending.get(v.id);if(p){clearTimeout(p.t);pending.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}}else{const p=lifecycle.track(event(v));tasks.push(p);}};
 save('fixture-process.json',{pid:process.pid,chromePid:browser.pid,httpPort:server.address().port,debugPort:Number(port)});
 await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},null);
 const targets=(await send('Target.getTargets',{},null)).targetInfos.filter(t=>t.type==='page');assert.equal(targets.length,1);
 session=(await send('Target.attachToTarget',{targetId:targets[0].targetId,flatten:true},null)).sessionId;
 await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});await send('Runtime.runIfWaitingForDebugger');await send('Page.enable');await send('Runtime.enable');
 await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/index.html?candidates&no-log&threads'});
 for(let i=0;i<150;i++){if(await evaluate("typeof shell!=='undefined'&&typeof WineAssembly!=='undefined'"))break;await wait(100);}
 await evaluate(`(()=>{globalThis.fixtureEntry={exe:false,dll:false,cpu:false};shell.launchApp=async name=>{if(name!=='redline_demo')throw Error('fixture selection');const c=document.getElementById('screen'),w=globalThis.fixture=new WineAssembly();w.renderer=new Win98Renderer(c);await w.init(c);fixtureEntry.exe=true;await w.loadExe('native-fixture.exe',{bytes:Uint8Array.from(${JSON.stringify([...image])})});fixtureEntry.dll=true;await w.guestWorker.loadDlls([{name:'normal.dll',bytes:Uint8Array.from(${JSON.stringify([...dll])})}],Uint8Array.from(${JSON.stringify([...image])}));w.running=true;browserInput.wireCanvasInput(c,w.renderer,{runningApps:[{wine:w,relativeMouse:true}],debugMode:true});c.tabIndex=0;c.focus();c.addEventListener('mousedown',()=>c.requestPointerLock(),{once:true});};return true;})()`);
 const checkedEvaluate=async(e,s)=>{const value=await evaluate(e,s);if(e==='WINE_REDLINE_STARTUP.status()'&&value.phase==='parked')assert.deepEqual(await evaluate('fixtureEntry'),{exe:false,dll:false,cpu:false});return value;};
 await require(root+'/tools/redline-startup.cjs').launch({evaluate:checkedEvaluate,send,workers,pageSession:session,source:fs.readFileSync(root+'/lib/redline-startup-admission.js','utf8'),selected:{sha256:'a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295',bytes:2185596},deadline:Date.now()+18000,save:(n,v)=>save('fixture-'+n,v)});
 for(let i=0;i<120;i++){const s=await evaluate('__redlineLaunch');if(s.settled){assert(!s.error,s.error);break;}await wait(50);}
 await Promise.all(tasks);
 const owner=await evaluate('({endpoint:fixture.guestWorker.link.endpointIdentity,slot:fixture.guestWorker.link.slot})');
 const poll=()=>evaluate(`(async()=>{fixtureEntry.cpu=true;const w=fixture,s=await w.guestWorker.slice(50),e=w.instance.exports;return {at:Date.now(),endpoint:w.guestWorker.link.endpointIdentity,slot:w.guestWorker.link.slot,results:[0x401408,0x40140c,0x401410,0x401414,0x401434,0x401438,0x40143c,0x401440].map(a=>e.guest_read32(a)>>>0),keys:[e.guest_read32(0x401450),e.guest_read32(0x401454)],counts:[e.guest_read32(0x401458),e.guest_read32(0x40145c)],sums:[e.guest_read32(0x401520)|0,e.guest_read32(0x401524)|0],slice:s};})()`);
 const baseline=await poll();save('fixture-baseline.json',baseline);assert(baseline.results.every(x=>x===0),'ordinary native fixture COM setup');
 const controls=[];
 for(const key of [',','.']){
  const before=await poll();const receipt=await require(root+'/scratch/runs/20261108-redline-car-door-native/bound-input.cjs').hold({send,session,keys:[key],holdMs:600,sample:poll});const after=await poll();
  controls.push({key,before,receipt,after});save('fixture-key-'+(key===','?'comma':'period')+'.json',controls.at(-1));
  const i=key===','?0:1;assert(receipt.samples.some(s=>s.keys[i]===128&&s.whollyDuringHold),'actual owning keyboard high read');assert.equal(after.keys[i],0);assert(after.counts[i]>before.counts[i]);assert.equal(after.endpoint,owner.endpoint);
 }
 save('native-qualification.json',{passed:true,startup:true,commaPeriod:true,owner,controls:controls.map(x=>x.key),nativeLifetime:'REVOKED',allwriters:'UNKNOWN',edictABA:'UNKNOWN'});
 });
}

main().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>process.removeListener('SIGTERM',cancel));
