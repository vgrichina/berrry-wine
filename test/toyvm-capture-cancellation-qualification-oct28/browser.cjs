const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{spawn}=require('child_process');
const B=__dirname, receipts=[], children=[];
let browser,session,current,serial=0,captures=fs.readdirSync(B).filter(x=>x.endsWith('.png')).length;
const resume=false;
if(resume)receipts.push(...JSON.parse(fs.readFileSync(path.join(B,'checkpoints.json'))));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function launch(exe,args,name){
 const out=fs.openSync(path.join(B,name+'.stdout'),'w'),err=fs.openSync(path.join(B,name+'.stderr'),'w');
 const p=spawn(exe,args,{cwd:B,stdio:['ignore',out,err]});children.push(p);fs.closeSync(out);fs.closeSync(err);return p;
}
class CDP{
 constructor(url){this.ws=new WebSocket(url);this.next=1;this.pending=new Map();this.events=[];this.ready=new Promise((r,j)=>{this.ws.onopen=r;this.ws.onerror=j});this.ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){const p=this.pending.get(d.id);this.pending.delete(d.id);if(d.error)p.reject(Error(JSON.stringify(d.error)));else p.resolve(d.result);}else if(this.events.length<1000)this.events.push(d);};}
 async send(method,params={},sessionId){await this.ready;fs.appendFileSync(path.join(B,"cdp-commands.jsonl"),JSON.stringify({method,params,sessionId})+"\n");const id=this.next++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
}
const send=(m,p={})=>browser.send(m,p,session);
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression,timeout=5000){const start=Date.now();let value;do{value=await ev(expression);if(value)return value;await sleep(40);}while(Date.now()-start<timeout);throw Error('Harness readiness timeout: '+expression+'; last='+JSON.stringify(value));}
async function move(x,y,buttons=0){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y,buttons});}
async function down(x,y,button='left',buttons=1){await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button,buttons,clickCount:1});}
async function up(x,y,button='left',buttons=0){await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button,buttons,clickCount:1});await sleep(30);}
async function clickSelector(selector){const r=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await move(r.x,r.y);await down(r.x,r.y);await up(r.x,r.y);}
async function snapshot(name){assert(captures<8);const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const bytes=Buffer.from(r.data,'base64');assert(bytes.length<=1048576);fs.writeFileSync(path.join(B,name+'.png'),bytes);captures++;}
async function checkpoint(name,details){receipts.push({name,at:new Date().toISOString(),details});fs.writeFileSync(path.join(B,'checkpoints.json'),JSON.stringify(receipts,null,2));}
async function state(){return ev('state()');}
async function save(name){await ev('new Promise(r=>requestAnimationFrame(()=>r()))');const d=await ev('({trace:window.trace,events:evidence.events,calls:evidence.calls,runs:evidence.runs.length,state:state(),intPress:int33(5),intRelease:int33(6)})');fs.writeFileSync(path.join(B,name+'-events.json'),JSON.stringify(d,null,2));return d;}
async function page(url){const t=await browser.send('Target.createTarget',{url});const a=await browser.send('Target.attachToTarget',{targetId:t.targetId,flatten:true});session=a.sessionId;current=t.targetId;await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1000,height:850,deviceScaleFactor:1,mobile:false});await browser.send('Target.activateTarget',{targetId:current});await until('document.readyState==="complete"');}
async function rect(){return ev('(()=>{let r=evidence.runs.at(-1).canvas.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()');}
async function main(){
 launch(process.execPath,['--max-old-space-size=320',path.join(B,'server.cjs')],'server');
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8765/requests')).ok)break;}catch{}await sleep(20);}
 const profile=path.join(B,'chrome-profile');
 launch('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--remote-allow-origins=http://localhost','--renderer-process-limit=2','--js-flags=--max-old-space-size=320','--user-data-dir='+profile,'about:blank'],'chrome');
 let lines;for(let i=0;i<150;i++){try{lines=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').trim().split('\n');break;}catch{}await sleep(20);}assert(lines,'Chrome endpoint unavailable');
 browser=new CDP('ws://127.0.0.1:'+lines[0]+lines[1]);await browser.ready;
 fs.writeFileSync(path.join(B,'browser-build.json'),JSON.stringify(await browser.send('Browser.getVersion'),null,2));

 // Only missing cancellation route, fresh original dashboard launch.
 await page('http://127.0.0.1:8765/dashboard?title=pointer-probe');
 await until('document.querySelector("#start")&&!document.querySelector("#start").hidden');await clickSelector('#start');
 await until('window.evidence&&evidence.runs.at(-1)?.machine&&document.querySelector("#stage").hidden===false');
 const r=await rect(),x=r.x+r.width/2,y=r.y+r.height/2;
 const boundaries=[];
 async function mark(label){const d=await ev(`({label:${JSON.stringify(label)},capture:probe(),state:state(),press:int33(5),release:int33(6)})`);boundaries.push(d);fs.writeFileSync(path.join(B,'boundaries.json'),JSON.stringify(boundaries,null,2));return d;}
 await ev('int33(5);int33(6)');await move(x,y);await down(x,y);
 const held=await mark('production-after-real-down');assert.equal(held.state.int33.bx,1);
 assert.equal(held.capture.sameBinderCanvas,true);assert.equal(held.capture.pointerType,'mouse');assert.equal(held.capture.buttons,1);
 const id=held.capture.id;
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+2,y:y+2,button:'left',buttons:1});
 const moved=await mark('production-after-held-move-explicit-left');
 let outcome='unqualified';
 if(moved.capture.hasCapture && await ev('evidence.events.some(e=>e.type==="gotpointercapture"&&e.trusted&&e.pointerId==='+id+')')){
   await ev('evidence.runs.at(-1).canvas.releasePointerCapture('+id+')');await mark('production-native-release-pending');
   await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+3,y:y+3,button:'left',buttons:1});
   const cancelled=await mark('production-after-browser-lost');
   assert(await ev('evidence.events.some(e=>e.type==="lostpointercapture"&&e.trusted&&e.pointerId==='+id+')'));
   assert.equal(cancelled.state.int33.bx,0);assert.equal(cancelled.release.bx,1);
   assert.equal((await ev('int33(6)')).bx,0);
   await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+4,y:y+4,button:'left',buttons:1});
   const stale=await mark('production-stale-held-move');assert.equal(stale.state.int33.bx,0);assert.equal(stale.press.bx,0);assert.equal(stale.release.bx,0);
   await up(x+4,y+4);const released=await mark('production-stale-up');assert.equal(released.state.int33.bx,0);assert.equal(released.release.bx,0);assert.equal(released.press.bx,0);
   outcome='trusted-lostpointercapture-passed';
 }else{await up(x+2,y+2);await mark('production-unqualified-no-capture');}
 await save('production');
 // Minimal native DOM control. Separate target only after sealing production.
 await page('about:blank');await ev(`document.body.innerHTML='<canvas id="control" width="320" height="200" tabindex="0"></canvas>';window.controlTrace=[];window.active=null;for(const type of ['pointerdown','pointermove','pointerup','gotpointercapture','lostpointercapture','pointercancel'])control.addEventListener(type,e=>{active={id:e.pointerId,buttons:e.buttons};controlTrace.push({type,trusted:e.isTrusted,id:e.pointerId,buttons:e.buttons,capture:control.hasPointerCapture(e.pointerId)});if(type==='pointerdown')control.setPointerCapture(e.pointerId)});`);
 const controls=[];
 for(const explicit of [false,true]){
   await move(100,100);await down(100,100);const before=await ev('({active,capture:control.hasPointerCapture(active.id),focus:document.hasFocus()})');
   await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:102,y:102,buttons:1,...(explicit?{button:'left'}:{})});
   const after=await ev('({active,capture:control.hasPointerCapture(active.id),focus:document.hasFocus()})');
   if(after.capture){await ev('control.releasePointerCapture(active.id)');await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:103,y:103,button:'left',buttons:1});}
   controls.push({explicitButton:explicit,before,after,trace:await ev('controlTrace')});await up(103,103);await ev('controlTrace=[]');
 }
 fs.writeFileSync(path.join(B,'control.json'),JSON.stringify(controls,null,2));
 fs.writeFileSync(path.join(B,'result.json'),JSON.stringify({outcome,boundaries,controls,mousePointercancelObserved:controls.some(c=>c.trace.some(e=>e.type==='pointercancel')),captures:0,productionPayloadUnchanged:true},null,2));
}
main().catch(async e=>{fs.writeFileSync(path.join(B,'failure.json'),JSON.stringify({error:e.stack}));try{await save('failure')}catch{}console.error(e.stack);process.exitCode=1;}).finally(async()=>{if(browser){try{await browser.send('Browser.close')}catch{}browser.ws.close();}for(const p of children)p.kill('SIGTERM');});
