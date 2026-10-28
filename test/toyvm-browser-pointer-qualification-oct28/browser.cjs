const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{spawn}=require('child_process');
const B=__dirname, receipts=[], children=[];
let browser,session,current,serial=0,captures=fs.readdirSync(B).filter(x=>x.endsWith('.png')).length;
const resume=process.argv.includes('--resume-demo')||process.argv.includes('--resume-after-capture')||process.argv.includes('--resume-after-blur');
if(resume)receipts.push(...JSON.parse(fs.readFileSync(path.join(B,'checkpoints.json'))));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function launch(exe,args,name){
 const out=fs.openSync(path.join(B,name+'.stdout'),'w'),err=fs.openSync(path.join(B,name+'.stderr'),'w');
 const p=spawn(exe,args,{cwd:B,stdio:['ignore',out,err]});children.push(p);fs.closeSync(out);fs.closeSync(err);return p;
}
class CDP{
 constructor(url){this.ws=new WebSocket(url);this.next=1;this.pending=new Map();this.events=[];this.ready=new Promise((r,j)=>{this.ws.onopen=r;this.ws.onerror=j});this.ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){const p=this.pending.get(d.id);this.pending.delete(d.id);if(d.error)p.reject(Error(JSON.stringify(d.error)));else p.resolve(d.result);}else if(this.events.length<1000)this.events.push(d);};}
 async send(method,params={},sessionId){await this.ready;const id=this.next++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
}
const send=(m,p={})=>browser.send(m,p,session);
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression,timeout=35000){const start=Date.now();let value;do{value=await ev(expression);if(value)return value;await sleep(40);}while(Date.now()-start<timeout);throw Error('Harness readiness timeout: '+expression+'; last='+JSON.stringify(value));}
async function move(x,y,buttons=0){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y,buttons});}
async function down(x,y,button='left',buttons=1){await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button,buttons,clickCount:1});}
async function up(x,y,button='left',buttons=0){await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button,buttons,clickCount:1});await sleep(30);}
async function clickSelector(selector){const r=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await move(r.x,r.y);await down(r.x,r.y);await up(r.x,r.y);}
async function snapshot(name){assert(captures<8);const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const bytes=Buffer.from(r.data,'base64');assert(bytes.length<=1048576);fs.writeFileSync(path.join(B,name+'.png'),bytes);captures++;}
async function checkpoint(name,details){receipts.push({name,at:new Date().toISOString(),details});fs.writeFileSync(path.join(B,'checkpoints.json'),JSON.stringify(receipts,null,2));}
async function state(){return ev('state()');}
async function save(name){await ev('new Promise(r=>requestAnimationFrame(()=>r()))');const d=await ev('({events:evidence.events,calls:evidence.calls,runs:evidence.runs.length,state:state(),intPress:int33(5),intRelease:int33(6)})');fs.writeFileSync(path.join(B,name+'-events.json'),JSON.stringify(d,null,2));return d;}
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
 // Earliest production boundary: original dashboard loader and start, including VM initialization.
 let r,x,y,s;
 if(!resume){
 await page('http://127.0.0.1:8765/dashboard?title=pointer-probe');
 await until('document.querySelector("#start")&&!document.querySelector("#start").hidden');await clickSelector('#start');
 await until('window.evidence&&evidence.runs.at(-1)?.machine&&document.querySelector("#stage").hidden===false');
 await until('evidence.runs.at(-1).machine.mouse.width===640&&evidence.runs.at(-1).canvas.width===320');
 r=await rect();x=r.x+r.width/2;y=r.y+r.height/2;
 await move(x,y);await down(x,y);let s=await state();assert.equal(s.int33.bx,1);assert.equal(s.int33.cx,320);assert.equal(s.int33.dx,100);
 await up(x,y);assert.equal((await state()).int33.bx,0);
 await snapshot('dashboard-mode13');const first=await save('dashboard');
 assert(first.calls.some(c=>c.name==='bindPointer'&&c.stack.includes('/toyvm/live.js')));assert(first.events.some(e=>e.type==='pointerdown'&&e.trusted));
 await checkpoint('dashboard-production-first-press',{state:s,calls:first.calls});await clickSelector('#stop');
 await browser.send('Target.closeTarget',{targetId:current});
 }
 // Original generated demo launcher: exact site.js and bundle bytes.
 await page('http://127.0.0.1:8765/demo?jit=0');await clickSelector('button.open');await clickSelector('#lb-play');
 await until('window.liveRun&&liveRun.machine&&liveRun.canvas.width===320');
 r=await rect();x=r.x+r.width/2;y=r.y+r.height/2;
 if(!process.argv.includes('--resume-after-capture')&&!process.argv.includes('--resume-after-blur')){
 await move(x,y);await down(x,y);s=await state();assert.deepEqual([s.int33.bx,s.int33.cx,s.int33.dx],[1,320,100]);
 await move(r.x+r.width-1,r.y+r.height-1,1);s=await state();assert.deepEqual([s.int33.cx,s.int33.dx],[638,199]);
 let edge=await ev('int33(5)');assert.equal(edge.bx,1);assert.deepEqual([edge.cx,edge.dx],[320,100]);assert.equal((await ev('int33(5)')).bx,0);
 // Real pointer capture delivers release after leaving canvas.
 await move(r.x+r.width+40,r.y+r.height+20,1);await up(r.x+r.width+40,r.y+r.height+20);assert.equal((await state()).int33.bx,0);assert.equal((await ev('int33(6)')).bx,1);
 await checkpoint('demo-capture-release-mode13',{state:await state(),press:edge});await snapshot('demo-release');
 }
 // Primary/right chord, consumed counts, unowned outside release negative control.
 if(!process.argv.includes('--resume-after-blur')){
 await move(x,y);await down(x,y);await down(x,y,'right',3);assert.equal((await state()).int33.bx,3);await up(x,y,'left',2);assert.equal((await state()).int33.bx,2);await up(x,y,'right',0);assert.equal((await state()).int33.bx,0);
 const before=await ev('JSON.stringify(evidence.runs.at(-1).machine.mouse)');await up(990,840);assert.equal(await ev('JSON.stringify(evidence.runs.at(-1).machine.mouse)'),before);
 // Canvas blur through actual focus(), preserving held-key behavior on the same production binder.
 await down(x,y);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40,nativeVirtualKeyCode:40});
 assert.equal(await ev('evidence.runs.at(-1).machine.heldKeys.size'),1);
 await ev('document.querySelector("#lb-close").focus()');assert.equal((await state()).int33.bx,0);assert.equal(await ev('evidence.runs.at(-1).machine.heldKeys.size'),0);await up(x,y);
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40,nativeVirtualKeyCode:40});
 await checkpoint('canvas-blur-held-key',{state:await state()});
 }
 // Browser-originated capture cancellation: releasePointerCapture generates trusted lostpointercapture.
 await move(x,y);await down(x,y);await move(x+2,y+2,1);
 const captured=await ev('(()=>{const e=evidence.events.filter(e=>e.type==="pointerdown").at(-1);return liveRun.canvas.hasPointerCapture(e.pointerId)})()');
 if(captured){await ev('(()=>{const c=liveRun.canvas;const e=evidence.events.filter(e=>e.type==="pointerdown").at(-1);c.releasePointerCapture(e.pointerId)})()');await move(x+3,y+3,1);await until('evidence.events.some(e=>e.type==="lostpointercapture")',1000);assert.equal((await state()).int33.bx,0);await up(x+3,y+3);await checkpoint('lost-capture-cancellation',{state:await state(),outcome:'passed'});}
 else{await checkpoint('lost-capture-cancellation',{outcome:'unqualified',reason:'actual browser capture precondition false; no lostpointercapture was generated',calls:await ev('evidence.calls'),state:await state()});await up(x+2,y+2);assert.equal((await state()).int33.bx,0);}
 // Actual window/tab focus loss; this does not dispatch a synthetic DOM blur.
 await down(x,y);const old=current,oldSession=session;const t=await browser.send('Target.createTarget',{url:'about:blank'});await browser.send('Target.activateTarget',{targetId:t.targetId});await sleep(100);
 const focused=await ev('document.hasFocus()');const lost=await state();assert.equal(focused,false);assert.equal(lost.int33.bx,0);await browser.send('Target.closeTarget',{targetId:t.targetId});await browser.send('Target.activateTarget',{targetId:old});session=oldSession;await up(x,y);
 await checkpoint('window-focus-loss',{state:lost,documentHasFocus:focused});
 // Teardown releases and removes all production listeners; negative input cannot deliver.
 await down(x,y);await ev('evidence.unbind.forEach(f=>f())');assert.equal((await state()).int33.bx,0);const stopped=await ev('JSON.stringify(liveRun.machine.mouse)');await move(x+20,y+20,1);await up(x+20,y+20);assert.equal(await ev('JSON.stringify(liveRun.machine.mouse)'),stopped);
 await checkpoint('teardown-negative-control',{state:await state()});await snapshot('demo-teardown');
 const final=await save('demo');assert(final.calls.some(c=>c.name==='bindPointer'&&c.stack.includes('/site.js')));assert(final.events.some(e=>e.type==='blur'&&e.trusted));
 // Run replacement exercised using the original demo's stop/restart route on a fresh page,
 // because teardown intentionally removed that page's bindings.
 await ev('liveRun.stop()');await browser.send('Target.closeTarget',{targetId:current});
 await page('http://127.0.0.1:8765/demo?jit=0');await clickSelector('button.open');await clickSelector('#lb-play');await until('window.liveRun&&liveRun.machine&&liveRun.canvas.width===320');r=await rect();x=r.x+r.width/2;y=r.y+r.height/2;
 await down(x,y);await ev('document.querySelector("#lb-close").click()');await until('!document.querySelector("#lb").open');assert.equal(await ev('int33(3,{},0).bx'),0);await clickSelector('button.open');await clickSelector('#lb-play');await until('evidence.runs.length===2&&liveRun.machine&&liveRun.canvas.width===320');await move(x+15,y+10,1);assert.equal((await state()).int33.bx,0);await up(x+15,y+10);assert.equal((await state()).int33.bx,0);await down(x,y);assert.equal((await state()).int33.bx,1);await up(x,y);
 await checkpoint('production-run-replacement',{oldButtons:await ev('int33(3,{},0).bx'),state:await state()});await save('replacement');await snapshot('replacement');await ev('liveRun.stop()');
 fs.writeFileSync(path.join(B,'result.json'),JSON.stringify({outcome:receipts.some(r=>r.details.outcome==='unqualified')?'partial':'passed',groups:receipts,captures,scope:'observed Chrome desktop mouse delivery only; no Constructor/gameplay claim; mouse pointercancel not yet observed'},null,2));
}
main().catch(async e=>{
 fs.writeFileSync(path.join(B,'failure.json'),JSON.stringify({error:e.stack,groups:receipts,at:new Date().toISOString()},null,2));
 try{await save('failure');await snapshot('failure');}catch{}
 console.error(e.stack);process.exitCode=1;
}).finally(async()=>{if(browser){try{await browser.send('Browser.close')}catch{}browser.ws.close();}for(const p of children)p.kill('SIGTERM');});
