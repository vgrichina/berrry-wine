'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),readline=require('readline');
const root=path.join(__dirname,'source'),puppeteer=require(process.env.WARCRAFT3_PUPPETEER||'/home/user/q2-tools-20261008/node_modules/puppeteer');
const http=require('http');
const {createAssetHandler,drainStreams}=require('./assets');
const {closeResources}=require('./cleanup');
const {validate,pressRelease,clickHoldMs}=require('./controls');
const {assertBackend}=require('./backend');
const expectedBackend=process.argv.includes('--software')?'software':'webgl';
const budgetMs=expectedBackend==='software'?900000:600000;
const {createLifecycle}=require('./lifecycle');
const {createRendererIdentity}=require('./renderer-identity');

const pause=ms=>new Promise(r=>setTimeout(r,ms));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function main(){
 if(!process.argv.includes('--slot-granted')||!process.argv.includes('--automation-granted'))throw Error('explicit slot and TTY required');
 const pins=JSON.parse(fs.readFileSync(path.join(__dirname,'browser-pins.json')));for(const f of pins.files)if(sha(path.join(root,f.path))!==f.sha256)throw Error('pin mismatch '+f.path);
 const s=fs.statfsSync(__dirname);if(s.bavail*s.bsize<2900000000)throw Error('browser headroom below 2.9GB');
 const out=path.join(__dirname,'attempt1');fs.mkdirSync(out);
 let rendererIdentity,identitySessions=[],browser,server,profile,timer,diskTimer,rl,closing=false,lastShot=null,lastPointerLocked=true,lastBackend=false,shotCount=0,captureBytes=0;const errors=[],requests=[],logs=[],pending=new Set();const started=Date.now(),deadline=started+budgetMs;
 const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n');
 function disk(){const st=fs.statfsSync(out);if(st.bavail*st.bsize<2147483648)throw Error('runtime disk floor');}
 const lifecycle=createLifecycle(async({owned,reason,startupError})=>{browser=owned||browser;if(startupError)errors.push(startupError);closing=true;rendererIdentity?.dispose();for(const session of identitySessions)await session.detach().catch(e=>errors.push(String(e)));clearTimeout(timer);clearInterval(diskTimer);if(rl)rl.close();process.stdin.pause();
 const child=browser?.process(), terminal=child&&child.exitCode===null&&child.signalCode===null?new Promise(r=>child.once('exit',(code,signal)=>r({code,signal}))):Promise.resolve({code:child?.exitCode,signal:child?.signalCode});
 const receipt=await closeResources({browser,server},{timeoutMs:10000});let timeout;receipt.chromeTerminal=await Promise.race([terminal,new Promise(r=>timeout=setTimeout(()=>r(null),5000))]);clearTimeout(timeout);
 receipt.streamDrain=await drainStreams(pending,1000);receipt.reason=reason;receipt.chromePid=child?.pid;receipt.captureBytes=captureBytes;receipt.shotCount=shotCount;
 if(child&&!receipt.chromeTerminal)receipt.errors.push('Chrome terminal not observed');if(receipt.streamDrain.pending)receipt.errors.push('streams not drained');
 for(const stream of child?.stdio||[])if(stream&&!stream.destroyed)stream.destroy();
 receipt.errors.push(...errors);receipt.complete=receipt.complete&&!!receipt.chromeTerminal&&!receipt.streamDrain.pending;
 if(rendererIdentity)save('renderer-identity-summary.json',rendererIdentity.snapshot());
 if(profile&&receipt.chromeTerminal)fs.rmSync(profile,{recursive:true,force:true});
 for(const[n,v]of [['console.json',logs],['requests.json',requests],['errors.json',errors],['cleanup.json',receipt]])try{save(n,v)}catch(e){console.error(String(e));process.exitCode=1}
 if(!receipt.complete)process.exitCode=1;console.log(JSON.stringify(receipt));return receipt;});
 const close=reason=>{closing=true;return lifecycle.finish(reason)};
 timer=setTimeout(()=>close('immutable browser deadline'),budgetMs);
 diskTimer=setInterval(()=>{try{disk()}catch(e){errors.push(String(e));close('disk floor')}},1000);
 try{
 const plan=JSON.parse(fs.readFileSync(path.join(__dirname,'serve-plan.json')));
 const requestFile=url=>{const rel=decodeURIComponent(new URL(url,'http://local').pathname).slice(1)||'index.html';if(!Object.hasOwn(plan.paths,rel)&&!(plan.optionalAbsent||[]).includes(rel))throw Error('unlisted path '+rel);return{rel,p:path.resolve(__dirname,plan.paths[rel]||'absent')}};
 const rangeFor=(v,n)=>{if(!v)return{start:0,end:n-1,status:200};const m=/^bytes=(\d+)-(\d*)$/.exec(v);if(!m)throw Error('range');const start=+m[1],end=m[2]?+m[2]:n-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end>=n)throw Error('range bounds');return{start,end,status:206}};
 server=http.createServer(createAssetHandler({plan,root,fixtureRoot:root,responses:requests,errors,pending,requestFile,rangeFor}));await new Promise(r=>server.listen(0,'127.0.0.1',r));lifecycle.check();profile=fs.mkdtempSync(path.join(os.tmpdir(),'warcraft3_demo-webgl-'));
 browser=await lifecycle.acquire(()=>puppeteer.launch({headless:false,executablePath:'/usr/bin/google-chrome',userDataDir:profile,ignoreDefaultArgs:['--mute-audio'],args:['--no-sandbox','--enable-unsafe-swiftshader'],protocolTimeout:15000,timeout:30000}));
 lifecycle.check();
 const page=await browser.newPage();lifecycle.check();await page.setViewport({width:1024,height:768});
 page.on('console',m=>{if(logs.length<3000)logs.push({time:Date.now(),type:m.type(),text:m.text().slice(0,2000)})});page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(requests.length<3000)requests.push({url:r.url(),status:r.status()})});
 save('identity.json',{started:new Date(started).toISOString(),deadline:new Date(deadline).toISOString(),expectedBackend,budgetMs,pid:process.pid,chromePid:browser.process().pid,browserVersion:await browser.version(),pins,scope:'Warcraft III ordinary Prologue route; reference build; control unproven until reviewed before/after landmarks; no guest edits'});
 console.log(JSON.stringify({pid:process.pid,chromePid:browser.process().pid,deadline:new Date(deadline).toISOString()}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?app=warcraft3_demo&debug&gl-renderer='+expectedBackend,{waitUntil:'load',timeout:45000});lifecycle.check();if(!new URL(page.url()).searchParams.has('app'))throw Error('declared app route required');

 if(process.argv.includes('--renderer-identity')){
  const browserSession=await browser.target().createCDPSession(),pageSession=await page.createCDPSession();identitySessions=[pageSession,browserSession];
  rendererIdentity=createRendererIdentity({browserSession,pageSession,chromePid:browser.process().pid,deadline,
   retainTrace:bytes=>{const fd=fs.openSync(path.join(out,'renderer-identity-trace.json'),'wx');try{fs.writeSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}},
   retain:row=>{const fd=fs.openSync(path.join(out,'renderer-identity.jsonl'),'a');try{fs.writeSync(fd,JSON.stringify(row)+'\n');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}});
  await rendererIdentity.qualify();lifecycle.watch(()=>rendererIdentity.check());
 }

 await page.evaluate(()=>{globalThis.__wc3Input=[];for(const type of ['keydown','keyup','mousedown','mouseup','mousemove'])document.addEventListener(type,e=>{const q=globalThis.__wc3Input;if(q.length===64)q.shift();q.push({type:e.type,trusted:e.isTrusted,key:e.key,button:e.button,x:e.clientX,y:e.clientY,time:performance.now()})},true)});
 lifecycle.check();rl=new(require('events').EventEmitter)();let commandIndex=0;const commandTimer=setInterval(()=>{const f=path.join(__dirname,'commands',commandIndex+'.json');if(fs.existsSync(f)){const line=fs.readFileSync(f,'utf8');commandIndex++;rl.emit('line',line)}},200);rl.close=()=>clearInterval(commandTimer);let queue=Promise.resolve();let seq=0;
 rl.on('line',line=>{queue=queue.then(async()=>{if(closing)return;if(line.length>4096||seq>=64)throw Error('command count/byte cap');const c=JSON.parse(line);const event={seq:++seq,time:Date.now(),command:c};fs.appendFileSync(path.join(out,'commands.jsonl'),JSON.stringify(event)+'\n');
 if(c.action==='quit')return close('ordinary quit');
 lifecycle.check();
 if(c.action==='shot'){if(!/^[a-z0-9-]+$/.test(c.name))throw Error('shot name');disk();if(shotCount>=30||fs.existsSync(path.join(out,c.name+'.png')))throw Error('shot count/fresh name');const image=await page.screenshot();if(image.length>10*1024**2||captureBytes+image.length>60*1024**2)throw Error('screenshot byte cap');fs.writeFileSync(path.join(out,c.name+'.png'),image,{flag:'wx'});shotCount++;captureBytes+=image.length;lastShot=c.name;const state=await page.evaluate(()=>{const a=(typeof runningApps!=='undefined'?runningApps:[]).find(a=>a.name==='warcraft3_demo'),w=a?.wine,l=document.getElementById('wine-launch-window');return{scope:'read-only page host/renderer mirrors, not owning Worker CPU state',inputEvents:globalThis.__wc3Input||[],pointerLocked:!!document.pointerLockElement,queryBackend:new URLSearchParams(location.search).get('gl-renderer'),renderEndpoints:[...(w?._renderWorkerManager?.ports?.values()||[])].slice(0,24).map(p=>({id:p.id,api:p.options.api,backend:p.options.backend,closed:p.closed})),found:!!a,running:!!w?.running,worker:!!w?.guestWorker,wasmBytes:w?.memory?.buffer?.byteLength||null,canvas:w?.renderer?.canvas?{width:w.renderer.canvas.width,height:w.renderer.canvas.height}:null,windows:Object.values(w?.renderer?.windows||{}).slice(0,24).map(v=>({hwnd:v.hwnd,title:v.title,visible:v.visible,x:v.x,y:v.y,w:v.w,h:v.h,minimized:v.minimized,gpuLayer:v._gpuFrameLayer?{kind:v._gpuFrameLayer.kind,writeSeq:v._gpuFrameLayer.writeSeq,width:v._gpuFrameLayer.canvas?.width,height:v._gpuFrameLayer.canvas?.height,rect:v._gpuFrameLayer.canvas?(()=>{const r=v._gpuFrameLayer.canvas.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})():null}:null})),launcher:l?{hidden:l.hidden,className:l.className,text:l.textContent.slice(0,1600)}:null,log:document.getElementById('log')?.textContent?.slice(-5000)||null}});lastPointerLocked=state.pointerLocked;state.renderWorkerEndpoints=[];state.renderWorkerError=null;try{const workers=page.workers().filter(w=>w.url().includes("d3d-render-worker.js"));const worker=workers[0];if(workers.length!==1)throw Error('exactly one owning render Worker required');if(!worker)throw Error("owning render Worker not observed");state.renderWorkerUrl=worker.url();state.renderWorkerEndpoints=await worker.evaluate(()=>typeof endpoints!=="undefined"?[...endpoints.values()].slice(0,24).map(e=>({api:e.options?.api,backend:e.options?.backend})):[])}catch(e){state.renderWorkerError=String(e)}let backendProof=null,backendError=null;try{backendProof=assertBackend(state,expectedBackend);lastBackend=true}catch(e){backendError=String(e);lastBackend=false}save(c.name+'.json',{backendProof,backendError,time:Date.now(),sha256:crypto.createHash('sha256').update(image).digest('hex'),state})}
 else if(c.action==='click'){if(!lastBackend)throw Error('reviewed live selected OpenGL backend proof required');if(lastPointerLocked)throw Error('Pointer Lock active: absolute input refused');validate(c,{lastShot,deadline});await page.mouse.move(c.x,c.y);await pressRelease(()=>page.mouse.down({button:c.button||'left'}),()=>pause(clickHoldMs(c)),()=>page.mouse.up({button:c.button||'left'}));lastShot=null}
 else if(c.action==='move'){if(!lastBackend)throw Error('live selected OpenGL backend proof required');if(lastPointerLocked)throw Error('Pointer Lock active: absolute input refused');validate(c,{lastShot,deadline});await page.mouse.move(c.x,c.y,{steps:8});lastShot=null}
 else if(c.action==='key'){if(!lastBackend)throw Error('reviewed live selected backend proof required');validate(c,{lastShot,deadline});await pressRelease(()=>page.keyboard.down(c.key),async()=>{await pause(c.ms);if(c.heldShot){if(!/^[a-z0-9-]+$/.test(c.heldShot)||fs.existsSync(path.join(out,c.heldShot+'.png')))throw Error('fresh held shot required');const b=await page.screenshot();if(b.length>10*1024**2||captureBytes+b.length>60*1024**2||shotCount>=30)throw Error('held shot cap');fs.writeFileSync(path.join(out,c.heldShot+'.png'),b,{flag:'wx'});captureBytes+=b.length;shotCount++;save(c.heldShot+'.json',{key:c.key,held:true,minimumHoldMs:c.ms,at:Date.now(),sha256:crypto.createHash('sha256').update(b).digest('hex'),scope:'ordinary key still held when screenshot captured; compare actual terrain landmarks to reviewed before and released after'})}},()=>page.keyboard.up(c.key));lastShot=null}
 else throw Error('unknown command');console.log(JSON.stringify({done:seq,time:Date.now()}));}).catch(e=>{errors.push(String(e));console.error(String(e))})});
 }catch(e){errors.push(e.stack||String(e));await close('harness error');process.exitCode=1}
}
main().catch(e=>{console.error(e);process.exitCode=1});
