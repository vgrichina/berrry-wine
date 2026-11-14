#!/usr/bin/env node
'use strict';
// Real public COM/CPU Worker/shared WebGL regression. No software executor.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fixture,oracle,validateFixture}=require('./fixtures/d3d9-reset-fixture');
const {installContextLossControl}=require('./fixtures/d3d9-context-loss-control');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const f=fixture({contextLoss:true}),layout=validateFixture(f,require('../src/api_table.json'));
const preflight={layout,fixtureSHA:sha(f.bytes),frames:f.frames.map(frame=>{
 const points=oracle(frame),wrong=new Map(oracle({...frame,reverse:!frame.reverse}).map(p=>[p.index,p.expected]));
 assert(points.some(p=>p.expected!==0xff214365));assert(points.some(p=>wrong.get(p.index)!==p.expected));
 return {name:frame.name,width:frame.w,height:frame.h,checked:points.length};
})};
assert.equal(f.selectors.length,0,'loss fixture does not repeat selector matrix');
assert(!f.calls.some(c=>/singular/.test(c.label)));
assert(!f.calls.some(c=>c.iface==='IDirect3DDevice9'&&c.slot===17),'no forced Present');
assert.throws(()=>validateFixture({...f,bytes:f.bytes.subarray(0x1200)},require('../src/api_table.json')),/PE MZ/);
assert.throws(()=>validateFixture({...f,calls:f.calls.map(c=>c.slot===18?{...c,slot:13}:c)},require('../src/api_table.json')),/known public COM slot/);
if(process.argv.includes('--preflight')){console.log(JSON.stringify(preflight,null,2));process.exit(0);}
(async()=>{
 const out=process.env.D3D9_LOSS_EVIDENCE;assert(out,'set D3D9_LOSS_EVIDENCE');fs.mkdirSync(out,{recursive:true});
 // The independent supervisor holds the heavy lock, scans actual children,
 // prearms disk/deadline monitoring and streams both outputs before this runs.
 assert(process.env.D3D9_LOSS_GUARD,'use the prepared independent supervisor');
 const guard=JSON.parse(fs.readFileSync(process.env.D3D9_LOSS_GUARD));process.kill(guard.pid,0);
 assert(guard.deadline>Date.now()/1000&&guard.floorBytes===1500000000,'live bounded disk guard');
 const stat=fs.statfsSync('/home');assert(stat.bavail*stat.bsize>guard.floorBytes,'/home disk floor before browser');
 const evidence={preflight,rows:[],screenshots:[],startedAt:new Date().toISOString()},save=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(evidence,null,2)+'\n');save();
 process.argv.push('--isolate');const server=require('../tools/dev-server').createServer({quiet:true});let browser,browserClosed;
 server.prependListener('request',(req,res)=>{
  if(!/\.(?:js|wasm)(?:\?|$)/.test(req.url))return;
  const hash=crypto.createHash('sha256');let bytes=0;
  const track=(chunk,encoding)=>{if(chunk==null)return;const b=typeof chunk==='string'?Buffer.from(chunk,typeof encoding==='string'?encoding:undefined):Buffer.from(chunk);hash.update(b);bytes+=b.length;};
  const write=res.write,end=res.end;
  res.write=function(chunk,encoding){track(chunk,encoding);return write.apply(this,arguments);};
  res.end=function(chunk,encoding){track(chunk,encoding);return end.apply(this,arguments);};
  res.once('finish',()=>fs.appendFileSync(path.join(out,'http-served.jsonl'),JSON.stringify({url:req.url,status:res.statusCode,bytes,sha256:hash.digest('hex')})+'\n'));
 });
 try{
  await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
  const args=['--no-sandbox','--no-first-run','--no-default-browser-check','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
  evidence.coverage='Controlled actual Chrome WebGL fixture; ANGLE/SwiftShader permitted. No physical-GPU, application or 27-app proof.';
  evidence.requestedBrowserFlags=args;save();
  browser=await require('puppeteer').launch({headless:true,executablePath:process.env.CHROME||'/opt/google/chrome/chrome',args,protocolTimeout:120000});
  browserClosed=new Promise(resolve=>browser.process().once('close',(code,signal)=>{evidence.browserClose={code,signal,bothEOF:true};resolve();}));
  evidence.browser=await browser.version();evidence.browserPID=browser.process().pid;evidence.actualBrowserArgs=browser.process().spawnargs;save();
  const page=await browser.newPage();await page.setViewport({width:960,height:1200});const errors=[];evidence.console=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>evidence.console.push({type:m.type(),text:m.text()}));
  await page.setRequestInterception(true);
  const workerSource=fs.readFileSync(path.resolve(__dirname,'../lib/d3d-render-worker.js'),'utf8');
  const observedSource="'use strict';\n("+installContextLossControl.toString()+')();\n'+workerSource;
  evidence.workerSource={productionSHA:sha(workerSource),observedSHA:sha(observedSource),instrumentation:'getContext return observer and public extension controls only'};save();
  page.on('request',request=>{if(new URL(request.url()).pathname==='/lib/d3d-render-worker.js')request.respond({status:200,contentType:'application/javascript',headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'},body:observedSource});else request.continue();});
  await page.evaluateOnNewDocument(()=>{localStorage.setItem('wine-assembly.threads','1');window.WINE_THREADS=true;});
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?debug&d3d-renderer=webgl',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof WineAssembly==='function'&&typeof D3D9Host==='object'&&typeof GuestThreadHost==='function'&&typeof RenderWorker==='object'&&crossOriginIsolated&&window.WINE_THREADS===true);
  // Two distinct races, each with a fresh public fixture; one shipped module
  // suffices for the lifecycle cause (no repeated unchanged module matrix).
  for(const restoredBeforeObserver of [false,true]){
   const row={restoredBeforeObserver,events:[],outcome:'FAIL'};evidence.rows.push(row);save();
   try{
    row.setup=await page.evaluate(async ({f})=>{
     const moduleBytes=await(await fetch('/build/wine-assembly.wasm')).arrayBuffer(),module=await WebAssembly.compile(moduleBytes);
     const hash=await crypto.subtle.digest('SHA-256',moduleBytes);
     const Base=D3D9Host.Bridge,getModule=WineAssembly.getWasmModule;
     D3D9Host.Bridge=class extends Base{constructor(options){super({...options,maxDeferredCommands:0});}};
     WineAssembly.getWasmModule=()=>Promise.resolve(module);
     const wine=new WineAssembly(),canvas=document.createElement('canvas');canvas.width=canvas.height=64;document.body.append(canvas);
     const logs=[];wine.renderer=new Win98Renderer(canvas);wine.logToUI=m=>logs.push(String(m));wine.d3d9Programmable=true;wine.d3d9Backend='webgl';
     window.__lossRun={wine,canvas,Base,getModule,f,logs};
     await wine.init(canvas);await wine.loadExe('d3d9-loss.exe',{bytes:Uint8Array.from(f.bytes)});
     if(!wine.guestWorker)throw Error('owning CPU Worker required before execution: '+logs.join('\n'));
     const s=window.__lossRun;s.view=new DataView(wine.memory.buffer);s.bridge=wine.hostCtx.d3d9Bridge;
     s.check=(v,m)=>{if(!v)throw Error(m);};
     s.wait=async target=>{const end=Date.now()+20000;while(Date.now()<end){const n=s.view.getUint32(f.statusWasm,true);if(n===target)return;if(n>=100||n===1)throw Error(JSON.stringify({status:n,check:f.checks.find(c=>c.id===n),actual:s.view.getUint32(f.statusWasm+4,true),expected:s.view.getUint32(f.statusWasm+8,true),logs:logs.slice(-8)}));await new Promise(r=>setTimeout(r,10));}throw Error('checkpoint timeout '+target);};
     s.resume=n=>s.view.setUint32(f.controlWasm,n,true);
     s.snap=e=>({id:e.queue.deviceId,endpoint:e.workerConsumer.worker.id,generation:e.queue.generation,queue:{...e.queue.snapshot(),error:String(e.queue.error||'')},dead:!!e.dead,lost:!!e.lost});
     wine.run(100000);await s.wait(2);
     s.first=s.bridge.devices.get(s.view.getUint32(f.deviceWasm,true));s.peer=s.bridge.devices.get(s.view.getUint32(f.deviceWasm+8,true));
     s.manager=wine._renderWorkerManager;s.physical=s.manager.worker;
     for(const e of [s.first,s.peer])s.check(e?.async&&e.sharedWorker&&e.kind==='webgl'&&e.workerConsumer.worker.manager===s.manager,'actual shared WebGL endpoint');
     s.check(wine.guestWorker,'actual CPU Worker');
     // The CPU checkpoint can precede delivery of the last accepted receipt.
     // Wait for those actual receipts; publish no extra rendering command.
     await Promise.race([s.first.queue.fence(),new Promise((_,reject)=>setTimeout(()=>reject(Error('accepted receipt deadline')),20000))]);
     s.check(!s.first.queue.error&&!s.first.queue.inflight,'accepted draw settled before loss');
     s.oldEndpoint=s.first.workerConsumer.worker.id;s.generation=s.first.queue.generation;s.before=s.first.queue.snapshot();
     const pointer=s.view.getUint32(f.lossReceiptWasm,true),pitch=s.view.getUint32(f.lossReceiptWasm+4,true);
     s.check(pointer&&pitch===32,'actual healthy DIB range');s.dibAddress=wine._guestToWasmAddress(pointer);s.dib=new Uint8Array(wine.memory.buffer,s.dibAddress,pitch*8);s.dib.fill(0xa7);
     return {first:s.snap(s.first),peer:s.snap(s.peer),dib:{pointer,address:s.dibAddress,pitch,length:s.dib.length},moduleSHA:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('')};
    },{f:{...f,bytes:[...f.bytes]}});
    assert.equal(row.setup.moduleSHA,sha(fs.readFileSync(path.resolve(__dirname,'../build/wine-assembly.wasm'))));save();
    const workers=page.workers().filter(w=>/\/lib\/d3d-render-worker\.js/.test(w.url()));assert.equal(workers.length,1,'one physical render Worker');const worker=workers[0];
    row.contexts=await worker.evaluate(()=>self.__d3d9Loss.inventory());save();assert.equal(row.contexts.length,2,'only the two production D3D9 contexts');
    row.loss=await worker.evaluate(restore=>self.__d3d9Loss.lose(0,restore),restoredBeforeObserver);
    assert(row.loss.atLoss.isContextLost&&row.loss.atLoss.lost===1);assert.deepEqual(row.loss.atLoss.event,{cancelable:true,defaultPrevented:true});assert.equal(row.loss.isContextLost,!restoredBeforeObserver);save();
    row.readback=await page.evaluate(async()=>{const s=__lossRun;s.resume(2);await s.wait(3);
     s.check(s.first.queue.error,'loss must fault stream');s.failure=s.first.queue.error;
     s.check(s.first.queue.completed===s.before.completed,'failed readback must not advance completed sequence');
     s.check(s.dib.every(v=>v===0xa7),'failed readback must preserve actual DIB');
     s.check(s.view.getUint32(s.f.lockWasm,true)===0x76543210&&s.view.getUint32(s.f.lockWasm+4,true)===0x12345678,'failed LockRect output canaries');
     s.afterFault=s.first.queue.submitted;return {...s.snap(s.first),completedBefore:s.before.completed,dibPreserved:true,dibBytes:s.dib.length,lockOutput:[s.view.getUint32(s.f.lockWasm,true),s.view.getUint32(s.f.lockWasm+4,true)]};
    });save();
    row.fence=await page.evaluate(async()=>{const s=__lossRun;let rejected;try{await s.bridge._submit(s.first,D3DCommandStream.OPCODES.FENCE,null);}catch(e){rejected=String(e);}s.check(rejected&&s.first.queue.error===s.failure,'fence preserves original fault');s.check(s.first.queue.submitted===s.afterFault,'faulted fence publishes nothing');return {rejected,first:s.snap(s.first)};});save();
    row.reset=await page.evaluate(async()=>{const s=__lossRun;s.resume(3);await s.wait(4);s.check(s.first.queue.error===s.failure&&s.first.queue.submitted===s.afterFault,'failed Reset preserves fault and sequence');s.check(s.first.queue.generation===s.generation&&s.first.workerConsumer.worker.id===s.oldEndpoint,'failed Reset preserves lifetime');s.check(s.dib.every(v=>v===0xa7),'Reset preserves DIB');return s.snap(s.first);});save();
    // Restore before Release even in the persistent-loss row: old-handle
    // deletion errors must be measured on the actual restored old context.
    row.restored=await worker.evaluate(()=>self.__d3d9Loss.restore(0));assert.equal(row.restored.error,0);save();
    row.release=await page.evaluate(async()=>{const s=__lossRun;s.resume(4);await s.wait(5);s.check(s.first.dead&&s.first.workerConsumer.stopped&&s.first.workerConsumer.worker.closed,'Release retires old endpoint');s.check(!s.manager.stopped&&s.manager.worker===s.physical&&!s.peer.lost&&!s.peer.queue.error,'Release preserves physical Worker and peer');return {first:s.snap(s.first),peer:s.snap(s.peer)};});
    row.oldContextError=await worker.evaluate(()=>self.__d3d9Loss.error(0));assert.equal(row.oldContextError,0,'old restored context after Release');save();
    row.fresh=await page.evaluate(async()=>{const s=__lossRun;s.resume(5);await s.wait(6);const e=s.bridge.devices.get(s.view.getUint32(s.f.deviceWasm,true));s.check(e&&e!==s.first&&e.workerConsumer.worker.id!==s.oldEndpoint,'deliberate fresh endpoint');s.check(!e.queue.error&&s.manager.worker===s.physical&&!s.peer.queue.error,'fresh/peer healthy');return {entry:s.snap(e),frames:s.f.frames.map(frame=>({...frame,words:Array.from({length:frame.w*frame.h},(_,i)=>s.view.getUint32(s.f.frameWasm+frame.offset+i*4,true))}))};});
    for(const frame of row.fresh.frames)for(const p of oracle(frame))assert.equal(frame.words[p.index],p.expected,frame.name+' pixel '+p.x+','+p.y);
    row.exactPixels=row.fresh.frames.map(frame=>({name:frame.name,checked:oracle(frame).length,mismatches:0}));
    assert.deepEqual(row.fresh.frames[1].words,row.fresh.frames[3].words,'peer exact pixels');
    assert.notDeepEqual(row.fresh.frames[0].words,row.fresh.frames[2].words,'changed size/color pixels');
    row.freshContextError=await worker.evaluate(()=>self.__d3d9Loss.error(2));assert.equal(row.freshContextError,0);save();
    // A labelled visualization of production LockRect bytes, without Present
    // or any substitute rendering/readback path in the guest's execution.
    await page.evaluate(frames=>{
     const panel=document.createElement('section');panel.id='loss-pixels';
     panel.style='position:fixed;inset:0;background:white;color:black;z-index:99999;padding:24px;font:16px sans-serif';
     const title=document.createElement('h2');title.textContent='Verified production LockRect readback (enlarged)';panel.append(title);
     for(const f of frames){const label=document.createElement('p');label.textContent=f.name+' '+f.w+' × '+f.h;panel.append(label);
      const c=document.createElement('canvas');c.width=f.w;c.height=f.h;c.style='position:static;transform:none;flex:none;width:192px;height:160px;image-rendering:pixelated';
      const ctx=c.getContext('2d'),pixels=ctx.createImageData(f.w,f.h);
      f.words.forEach((v,i)=>pixels.data.set([v>>>16&255,v>>>8&255,v&255,v>>>24],i*4));ctx.putImageData(pixels,0,0);panel.append(c);
     }document.body.append(panel);
    },row.fresh.frames);
    const screenshot='readback-'+(restoredBeforeObserver?'restored-first':'persistent-loss')+'.png';
    evidence.screenshots.push(screenshot);save();await page.screenshot({path:path.join(out,screenshot),fullPage:true});
    await page.evaluate(()=>document.querySelector('#loss-pixels').remove());
    await page.evaluate(async()=>{const s=__lossRun;s.resume(6);await s.wait(1);s.check(!s.bridge.devices.size&&!s.manager.ports.size,'public releases drained');});row.outcome='PASS';
   }catch(e){row.error=e.stack;row.failureObservation=await page.evaluate(()=>{const s=window.__lossRun;if(!s?.view)return null;return {status:s.view.getUint32(s.f.statusWasm,true),actual:s.view.getUint32(s.f.statusWasm+4,true),expected:s.view.getUint32(s.f.statusWasm+8,true),first:s.first?s.snap(s.first):null,peer:s.peer?s.snap(s.peer):null,dib:s.dib?Array.from(s.dib):null,logs:s.logs.slice(-12)};}).catch(error=>({observationError:String(error)}));}
   finally{
    row.cleanup=await page.evaluate(async()=>{const s=window.__lossRun;if(!s)return;const worker=s.wine.guestWorker;s.wine.stop();await worker?.stop();await new Promise(r=>setTimeout(r,0));await s.wine._guestRuntimeReleaseWait;await s.wine._renderWorkerRetirement;await s.manager?.stop();s.canvas.remove();D3D9Host.Bridge=s.Base;WineAssembly.getWasmModule=s.getModule;return {retired:!!s.manager?._retired,error:String(s.wine._renderWorkerRetirementError||'')};}).catch(e=>({error:String(e)}));save();
   }
  }
  assert(!errors.length,errors.join('\n'));for(const row of evidence.rows){assert.equal(row.cleanup?.error,'');assert.equal(row.cleanup?.retired,true,'physical render Worker retirement acknowledged');assert.equal(row.outcome,'PASS',row.error);}evidence.outcome='PASS';
 }catch(e){evidence.outcome='FAIL';evidence.error=e.stack;throw e;}
 finally{await browser?.close();await browserClosed;await new Promise(r=>{server.closeAllConnections();server.close(r);});evidence.endedAt=new Date().toISOString();save();}
})().catch(e=>{console.error(e);process.exitCode=1;});
