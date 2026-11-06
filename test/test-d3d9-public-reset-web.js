#!/usr/bin/env node
'use strict';
// Public guest x86 COM -> owning CPU Worker -> production WebGL render Worker.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const {fixture,oracle,validateFixture}=require('./fixtures/d3d9-reset-fixture');
const out=process.env.D3D9_RESET_EVIDENCE,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const f=fixture({reuseIdentity:true}),apis=require('../src/api_table.json'),layout=validateFixture(f,apis);
 // Reject both specific predecessor fixture errors before starting Chromium.
 assert.throws(()=>validateFixture({...f,bytes:f.bytes.subarray(0x1200,0x1200+f.codeBytes)},apis),/PE MZ/);
 const wrongSlot={...f,calls:f.calls.map(c=>c.iface==='IDirect3DDevice9'&&c.slot===18?{...c,slot:13}:c)};
 assert.throws(()=>validateFixture(wrongSlot,apis),/known public COM slot/);
 const evidence={startedAt:new Date().toISOString(),fixture:{...layout,sha256:sha(f.bytes)},rows:[]};
 if(out)fs.mkdirSync(out,{recursive:true});
 const save=()=>{if(out)fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(evidence,null,2)+'\n');};
 // Assert that the independent oracle would reject omitted/redrawn-wrong geometry.
 evidence.rejectingControls=f.frames.map(frame=>{
  const points=oracle(frame),reverse=oracle({...frame,reverse:!frame.reverse});
  const flipped=new Map(reverse.map(p=>[p.index,p.expected]));
  const clearMismatch=points.filter(p=>p.expected!==0xff214365).length;
  const flippedMismatch=points.filter(p=>flipped.has(p.index)&&flipped.get(p.index)!==p.expected).length;
  assert(clearMismatch>0&&flippedMismatch>0);
  return {name:frame.name,checkedPixels:points.length,clearMismatch,flippedMismatch};
 });
 process.argv.push('--isolate');const server=require('../tools/dev-server').createServer({quiet:true});
 if(out)server.prependListener('request',(req,res)=>{
  if(!/\.(?:js|wasm)(?:\?|$)/.test(req.url))return;
  const hash=crypto.createHash('sha256');let bytes=0;
  const track=(chunk,encoding)=>{if(chunk==null)return;const b=typeof chunk==='string'?Buffer.from(chunk,typeof encoding==='string'?encoding:undefined):Buffer.from(chunk);hash.update(b);bytes+=b.length;};
  const write=res.write,end=res.end;
  res.write=function(chunk,encoding){track(chunk,encoding);return write.apply(this,arguments);};
  res.end=function(chunk,encoding){track(chunk,encoding);return end.apply(this,arguments);};
  res.once('finish',()=>fs.appendFileSync(path.join(out,'http-served.jsonl'),JSON.stringify({url:req.url,status:res.statusCode,bytes,sha256:hash.digest('hex')})+'\n'));
 });
 let browser,page;
 try{
  await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});evidence.port=server.address().port;
  browser=await require('puppeteer').launch({headless:true,executablePath:process.env.CHROME||'/opt/google/chrome/chrome',
   args:['--no-sandbox','--no-first-run','--no-default-browser-check','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:180000});
  evidence.browser=await browser.version();evidence.node=process.version;
  const infoSession=await browser.target().createCDPSession();try{evidence.systemInfo=await infoSession.send('SystemInfo.getInfo');}catch(e){evidence.systemInfoError=String(e);}finally{await infoSession.detach();}
  const proc=browser.process();evidence.process={pid:process.pid,childPid:proc.pid,endpoint:browser.wsEndpoint(),profile:proc.spawnargs.find(v=>v.startsWith('--user-data-dir='))?.slice(16)};
  proc.once('exit',(code,signal)=>{evidence.process.exit={code,signal};});save();
  page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.evaluateOnNewDocument(()=>{localStorage.setItem('wine-assembly.threads','1');window.WINE_THREADS=true;});
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?debug&d3d-renderer=webgl',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof WineAssembly==='function'&&typeof D3D9Host==='object');
  for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
   const moduleBytes=fs.readFileSync(path.join(root,'build',name));
   const row=await page.evaluate(async ({name,bytes,statusWasm,controlWasm,deviceWasm,frameWasm,frames,checks,selectors,selectorWasm,reuse})=>{
    const check=(v,m)=>{if(!v)throw Error(m);},sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const bytesModule=await(await fetch('/build/'+name)).arrayBuffer(),module=await WebAssembly.compile(bytesModule);
    const digest=await crypto.subtle.digest('SHA-256',bytesModule),hash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
    const Base=D3D9Host.Bridge,getModule=WineAssembly.getWasmModule;
    D3D9Host.Bridge=class extends Base{constructor(options){super({...options,maxDeferredCommands:0});}};
    WineAssembly.getWasmModule=()=>Promise.resolve(module);
    const wine=new WineAssembly(),canvas=document.createElement('canvas');canvas.width=canvas.height=64;document.body.append(canvas);
    const logs=[],result={module:{sha256:hash,bytes:bytesModule.byteLength},events:[],logs,frames:[],outcome:'FAIL'};
    wine.renderer=new Win98Renderer(canvas);wine.logToUI=m=>logs.push(String(m));wine.d3d9Programmable=true;wine.d3d9Backend='webgl';
    const snap=e=>({id:e.queue.deviceId,endpoint:e.workerConsumer?.worker.id,kind:e.kind,shared:e.sharedWorker,
     queue:{...e.queue.snapshot(),error:String(e.queue.error||'')},lost:!!e.lost,dead:!!e.dead,consumerStopped:!!e.workerConsumer?.stopped});
    let view,bridge,manager,physical,first,peer,failure,oldId,peerId,generation,submitted,oldEndpoint;
    const wait=async target=>{
     const end=Date.now()+45000;
     while(Date.now()<end){const status=view.getUint32(statusWasm,true);if(status===target)return;
      if(status===1||status>=100)throw Error('guest assertion '+JSON.stringify({status,check:checks.find(c=>c.id===status),actual:view.getUint32(statusWasm+4,true),expected:view.getUint32(statusWasm+8,true)}));
      await sleep(10);
     }
     throw Error('guest checkpoint timeout '+target+' status='+view.getUint32(statusWasm,true)+' logs='+logs.slice(-10).join('\n'));
    };
    const resume=n=>view.setUint32(controlWasm,n,true);
    try{
     await wine.init(canvas);await wine.loadExe('d3d9-reset-regression.exe',{bytes:Uint8Array.from(bytes)});
     view=new DataView(wine.memory.buffer);bridge=wine.hostCtx.d3d9Bridge;
     check(wine.guestWorker,'actual owning CPU Worker');check(wine._wasmModule===module,'loaded shipped module identity');
     result.guest={slot:wine.guestWorker.link.slot,endpoint:wine.guestWorker.link.endpointIdentity};
     wine.run(100000);await wait(2);
     oldId=view.getUint32(deviceWasm,true);peerId=view.getUint32(deviceWasm+8,true);
     first=bridge.devices.get(oldId);peer=bridge.devices.get(peerId);manager=wine._renderWorkerManager;physical=manager?.worker;
     check(first&&peer&&first!==peer,'two public devices');
     check(first.async&&peer.async&&first.sharedWorker&&peer.sharedWorker,'production shared endpoints');
     check(first.kind==='webgl'&&peer.kind==='webgl','actual WebGL executor');
     check(first.workerConsumer.worker.manager===manager&&peer.workerConsumer.worker.manager===manager,'one actual physical render Worker');
     check(first.workerConsumer.worker.id!==peer.workerConsumer.worker.id,'isolated device endpoints');
     generation=first.queue.generation;oldEndpoint=first.workerConsumer.worker.id;
     result.events.push({checkpoint:2,first:snap(first),peer:snap(peer)});resume(2);await wait(3);
     check(bridge.devices.get(oldId)===first&&first.queue.generation===generation,'healthy Reset preserves device and generation');
     check(first.workerConsumer.worker.id===oldEndpoint,'healthy Reset preserves endpoint');
     check(!first.queue.error&&!peer.queue.error,'healthy streams');
     result.events.push({checkpoint:3,first:snap(first),peer:snap(peer)});resume(3);await wait(4);
     failure=first.queue.error;submitted=first.queue.submitted;
     check(failure&&/singular normal transform/.test(String(failure)),'actual executor normal refusal');
     const diagnostic=failure.drawDiagnostic;
     check(diagnostic?.endpointId===oldEndpoint&&diagnostic.command.deviceId===oldId,'refusal from actual owning endpoint');
     check(diagnostic.world.bits.every(v=>v===0)&&diagnostic.flags.lighting,'ordinary guest singular lit transform');
     check(!manager.stopped&&manager.worker===physical&&!peer.lost&&!peer.queue.error,'peer/physical Worker survive refusal');
     result.events.push({checkpoint:4,first:snap(first),diagnostic});resume(4);await wait(5);
     check(first.queue.error===failure&&first.queue.submitted===submitted,'failed Reset preserves exact error without publishing');
     check(first.queue.generation===generation&&first.workerConsumer.worker.id===oldEndpoint,'failed Reset preserves lifetime');
     check(bridge.devices.get(oldId)===first&&!first.workerConsumer.stopped&&!first.workerConsumer.worker.closed,'failed Reset retains live endpoint until Release');
     result.events.push({checkpoint:5,first:snap(first)});resume(5);await wait(6);
     check(!bridge.devices.has(oldId)&&first.dead&&first.workerConsumer.stopped&&first.workerConsumer.worker.closed,'public Release retires failed endpoint');
     check(!first.queue.inflight&&!first.queue.bytes&&!first.workerConsumer.pending.size,'failed device transport drained');
     check(!manager.stopped&&manager.worker===physical&&!peer.lost&&!peer.queue.error,'Release preserves peer and physical Worker');
     result.events.push({checkpoint:6,first:snap(first),peer:snap(peer)});resume(6);await wait(7);
     const newId=view.getUint32(deviceWasm,true),recovered=bridge.devices.get(newId);
     check(recovered&&recovered!==first,'public recreation gets fresh host entry');
     check(recovered.workerConsumer.worker.id!==oldEndpoint,'public recreation gets new endpoint');
     check(!recovered.queue.error&&!manager.stopped&&manager.worker===physical,'recovery on surviving physical Worker');
     check(first.queue.error===failure&&first.queue.generation===generation,'retired producer retains its original error and generation');
     check(bridge.devices.get(peerId)===peer&&!peer.queue.error&&!peer.lost,'peer entry survives public allocation churn and same-identity recreation');
     check(newId===oldId,'bounded ordinary public allocation reuses retired device identity');
     check(recovered.queue.generation===generation+1,'reused public identity advances generation');
     const churn=Array.from({length:4},(_,i)=>view.getUint32(reuse.wasm+i*4,true));
     check(churn[0]===churn[1]&&churn[2]>0&&churn[2]<=reuse.limit&&churn[3]===oldId,'bounded public parent churn receipt');
     result.reuse={paddingParent:churn[0],lastReleasedParent:churn[1],iterations:churn[2],limit:reuse.limit,originalDevice:churn[3]};
     // Positive production FENCE before the explicitly malformed stale descriptor.
     await bridge._submit(recovered,D3DCommandStream.OPCODES.FENCE,null);
     const currentFence=recovered.queue.snapshot();
     check(!recovered.queue.error&&!recovered.queue.inflight&&recovered.queue.poll().status==='completed','valid current-generation fence completed before stale control');
     let retiredRejected=false;try{first.workerConsumer.execute({});}catch(e){retiredRejected=/stopped/.test(String(e));}
     check(retiredRejected,'old endpoint consumer rejects reuse');
     const staleGeneration=generation;
     const staleDeviceId=newId,staleSequence=recovered.queue.submitted+1;
     let producerRejected=null;
     if(newId===oldId){
      const before=recovered.queue.submitted;
      try{recovered.queue.submit(D3DCommandStream.OPCODES.FENCE,null,{generation});}catch(e){producerRejected=String(e);}
      check(/stale/.test(producerRejected||'')&&recovered.queue.submitted===before&&!recovered.queue.error,'producer rejects old generation without changing current queue');
     }
     const stale=recovered.workerConsumer.execute({version:D3DCommandStream.VERSION,deviceId:staleDeviceId,
      generation:staleGeneration,sequence:staleSequence,opcode:D3DCommandStream.OPCODES.FENCE,payload:null,resources:[],byteLength:64});
     stale.consumed.catch(()=>{});let rejected;
     try{await stale.completion;}catch(e){rejected=String(e);}
     check(rejected&&/stale or unordered render worker command/.test(rejected),'owning receiver rejects old generation descriptor '+rejected);
     check(staleDeviceId===newId&&staleGeneration!==recovered.queue.generation&&staleSequence===currentFence.submitted+1,'generation is the only stale identity/order field');
     result.events.push({checkpoint:7,recovered:snap(recovered),oldId,newId,oldGeneration:generation,
      staleControl:{deviceId:staleDeviceId,generation:staleGeneration,sequence:staleSequence,producerRejected,rejected,kind:'old-generation',currentGeneration:recovered.queue.generation,currentFence},validFenceCompleted:true,retiredRejected});
     resume(7);await wait(1);
     check(!bridge.devices.size,'guest releases both devices');
     check(!manager.stopped&&manager.worker===physical,'physical Worker survived every control');
     check(!manager.ports.size,'all device endpoints retired');
     check(!bridge.requests.size,'all public continuations consumed');
     result.events.push({checkpoint:1,ports:manager.ports.size,requests:bridge.requests.size});result.outcome='PASS';
    }catch(e){result.error=e.stack;}
    finally{
     if(view){result.status=view.getUint32(statusWasm,true);result.actual=view.getUint32(statusWasm+4,true);result.expected=view.getUint32(statusWasm+8,true);
      result.selectorResults=selectors.map(c=>({...c,hr:view.getUint32(selectorWasm+c.offset,true),output:view.getUint32(selectorWasm+c.offset+4,true),reset:view.getUint32(selectorWasm+c.offset+8,true),implicit:view.getUint32(selectorWasm+c.offset+12,true)}));
      result.frames=frames.map(frame=>({...frame,words:Array.from({length:frame.w*frame.h},(_,i)=>view.getUint32(frameWasm+frame.offset+i*4,true))}));}
     const worker=wine.guestWorker,renderManager=wine._renderWorkerManager;wine.stop();await worker?.stop();
     try{
      await sleep(0);await wine._guestRuntimeReleaseWait;
      await wine._renderWorkerRetirement;
      result.shutdown=await renderManager?.stop();
      if(wine._renderWorkerRetirementError)throw wine._renderWorkerRetirementError;
      if(renderManager){check(renderManager._retired&&!renderManager.pending.size&&!renderManager.queuedBytes&&!renderManager.ports.size,'supported physical Worker retirement and transport cleanup');result.retired=true;}
     }catch(e){result.cleanupError=String(e);result.outcome='FAIL';}
     canvas.remove();D3D9Host.Bridge=Base;WineAssembly.getWasmModule=getModule;
    }
    return result;
   },{name,bytes:[...f.bytes],statusWasm:f.statusWasm,controlWasm:f.controlWasm,deviceWasm:f.deviceWasm,frameWasm:f.frameWasm,frames:f.frames,checks:f.checks,selectors:f.selectors,selectorWasm:f.selectorWasm,reuse:f.reuse});
   row.name=name;evidence.rows.push(row);save();
   if(out){
    const {PNG}=require('pngjs');row.captures=[];
    for(const frame of row.frames){
     const png=new PNG({width:frame.w,height:frame.h});frame.words.forEach((v,i)=>{png.data[i*4]=v>>>16&255;png.data[i*4+1]=v>>>8&255;png.data[i*4+2]=v&255;png.data[i*4+3]=255;});
     const filename=name+'-'+frame.name+'.png';fs.writeFileSync(path.join(out,filename),PNG.sync.write(png));row.captures.push(filename);
    }
   }
   save();assert.equal(row.module.sha256,sha(moduleBytes),'actual owning module matches shipped bytes');
   assert.equal(row.outcome,'PASS',row.error||row.cleanupError);
   row.pixelChecks=[];
   for(const frame of row.frames){const points=oracle(frame);for(const p of points)assert.equal(frame.words[p.index],p.expected,frame.name+' independent pixel '+p.x+','+p.y);row.pixelChecks.push({name:frame.name,checked:points.length,sha256:sha(Buffer.from(Uint32Array.from(frame.words).buffer))});}
   const peerFrame=row.frames.find(f=>f.name==='peer-before');
   for(const label of ['peer-after-resize','peer-after-refusal','peer-after-recreation'])assert.deepEqual(row.frames.find(f=>f.name===label).words,peerFrame.words,'peer full-frame isolation '+label);
   // The changed size, colors, and triangle direction reject stale/no-redraw frames.
   const before=row.frames.find(f=>f.name==='before-reset'),after=row.frames.find(f=>f.name==='after-resize');
   assert.notDeepEqual(before.words,after.words);assert.notEqual(before.words[1*8+1],after.words[1*12+1]);
   save();console.log(JSON.stringify({name,outcome:row.outcome,pixelChecks:row.pixelChecks,module:row.module}));
  }
  if(out){
   const cards=evidence.rows.flatMap(row=>row.captures.map((filename,i)=>{
    const frame=row.frames[i],data=fs.readFileSync(path.join(out,filename)).toString('base64');
    return '<figure><img src="data:image/png;base64,'+data+'"><figcaption>'+row.name+'<br>'+frame.name+' ('+frame.w+'×'+frame.h+')</figcaption></figure>';
   })).join('');
   const gallery=await browser.newPage();await gallery.setViewport({width:1152,height:680,deviceScaleFactor:1});
   await gallery.setContent('<style>body{background:#eee;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(7,1fr)}figure{margin:6px}img{width:128px;height:160px;object-fit:contain;image-rendering:pixelated;background:white}figcaption{font-size:11px;overflow-wrap:anywhere}</style><h2>Generated public D3D9 COM LockRect readbacks</h2><p>Standard then compat. Independent colors/coverage checked away from edge ties. No gameplay.</p><main>'+cards+'</main>');
   await gallery.screenshot({path:path.join(out,'public-reset-readbacks.png'),fullPage:true});await gallery.close();evidence.contactSheet='public-reset-readbacks.png';
  }
  assert(!errors.length,errors.join('\n'));
  // Inspect both shipped modules before rejecting a reproduced baseline.
  // Failure output is retained as observation only: the contract does not
  // specify whether it is cleared or preserved. Never Release it on failure.
  evidence.selectorMismatches=evidence.rows.flatMap(row=>row.selectorResults.filter(c=>c.hr!==0x8876086c||c.reset!==0).map(c=>({name:row.name,...c})));
  save();
  for(const row of evidence.rows)for(const c of row.selectorResults){
   assert.equal(c.hr,0x8876086c,row.name+' invalid GetBackBuffer '+JSON.stringify(c));
   assert.equal(c.reset,0,row.name+' failed selector must not acquire a Reset-blocking resource '+JSON.stringify(c));
  }
  evidence.outcome='PASS';
 }catch(e){evidence.outcome='FAIL';evidence.error=e.stack;throw e;}
 finally{
  if(browser){const pids=[],visit=pid=>{if(!pid||pids.includes(pid))return;pids.push(pid);try{fs.readFileSync('/proc/'+pid+'/task/'+pid+'/children','utf8').trim().split(/\s+/).filter(Boolean).map(Number).forEach(visit);}catch{}};visit(browser.process().pid);evidence.observedPids=pids;}
  await browser?.close();await new Promise(r=>{server.closeAllConnections();server.close(r);});evidence.endedAt=new Date().toISOString();save();
 }
 console.log('PASS both modules: public x86 COM Reset, bounded same-identity recreation, new generation pixels, peer isolation and stale-generation rejection');
})().catch(e=>{console.error(e);process.exitCode=1;});
