#!/usr/bin/env node
'use strict';
// Both shipped modules, actual owning guest CPU + production shared WebGL
// Worker, ordinary generated PE, public x86 COM calls and public LockRect.
// --baseline records the success-noop reproduction and requires its precise
// first product failure on each module. It never treats that failure as success.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const {fixture}=require('./fixtures/d3d9-multiply-fixture');
const baseline=process.argv.includes('--baseline'),out=process.env.D3D9_MULTIPLY_EVIDENCE;
const defaultTarget=process.argv.includes('--default-target');
const backend=process.argv.includes('--software')?'software':'webgl';
const colorUpload=process.argv.includes('--color-upload');
const surfaceUpload=process.argv.includes('--surface-upload');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const f=fixture({defaultTarget,colorUpload,surfaceUpload}),evidence={startedAt:new Date().toISOString(),baseline,defaultTarget,backend,colorUpload,surfaceUpload,fixture:{bytes:f.bytes.length,sha256:sha(f.bytes),codeBytes:f.codeBytes},oracle:f.oracle,pixels:f.pixels,rows:[]};
 if(out)fs.mkdirSync(out,{recursive:true});
 process.argv.push('--isolate');const server=require('../tools/dev-server').createServer({quiet:true});
 if(out)server.prependListener('request',(req,res)=>{
  if(!/\.(?:js|wasm)(?:\?|$)/.test(req.url))return;
  const hash=crypto.createHash('sha256');let bytes=0;
  const track=(chunk,encoding)=>{if(chunk==null)return;const b=typeof chunk==='string'?Buffer.from(chunk,typeof encoding==='string'?encoding:undefined):Buffer.from(chunk);hash.update(b);bytes+=b.length;};
  const write=res.write,end=res.end;
  res.write=function(chunk,encoding){track(chunk,encoding);return write.apply(this,arguments);};
  res.end=function(chunk,encoding){track(chunk,encoding);return end.apply(this,arguments);};
  res.once('finish',()=>fs.appendFileSync(path.join(out,'http-served.jsonl'),JSON.stringify({at:new Date().toISOString(),url:req.url,status:res.statusCode,bytes,sha256:hash.digest('hex')})+'\n'));
 });
 let browser,page;
 const save=()=>{if(out)fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(evidence,null,2)+'\n');};
 try{
  await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});evidence.port=server.address().port;
  browser=await require('puppeteer').launch({headless:true,executablePath:process.env.CHROME||'/opt/google/chrome/chrome',
   args:['--no-sandbox','--no-first-run','--no-default-browser-check','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
  evidence.browser=await browser.version();evidence.node=process.version;
  const proc=browser.process();evidence.process={pid:process.pid,childPid:proc.pid,endpoint:browser.wsEndpoint(),profile:proc.spawnargs.find(v=>v.startsWith('--user-data-dir='))?.slice(16)};
  proc.once('exit',(code,signal)=>{evidence.process.exit={code,signal};});save();
  page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.evaluateOnNewDocument(()=>{localStorage.setItem('wine-assembly.threads','1');window.WINE_THREADS=true;});
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?debug&d3d-renderer=webgl',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof WineAssembly==='function'&&typeof D3D9Host==='object');
  for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm'])for(const enabled of [false,true]){
   const moduleBytes=fs.readFileSync(path.join(root,'build',name));
   const row=await page.evaluate(async ({name,bytes,statusWasm,pixelWasm,pixelCount,frameWasm,allocationWasm,pteBase,enabled,baseline,defaultTarget,backend,colorUpload,surfaceUpload})=>{
    const check=(v,m)=>{if(!v)throw Error(m);},sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const moduleBytes=await(await fetch('/build/'+name)).arrayBuffer(),module=await WebAssembly.compile(moduleBytes);
    const digest=await crypto.subtle.digest('SHA-256',moduleBytes),hash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
    const Base=D3D9Host.Bridge,getModule=WineAssembly.getWasmModule;
    D3D9Host.Bridge=class extends Base{
     constructor(options){super({...options,worldProvenance:enabled});this.publishedDraws=0;this.publishedUploads=0;this.publishedSurfaceUploads=0;this.publishedColorDefinitions=0;}
     submitSnapshot(command){
      this.publishedColorDefinitions+=(command.colorDefinitions||[]).length;
      if(command.opcode===D3DCommandStream.OPCODES.DRAW)this.publishedDraws++;
      if(command.opcode===D3DCommandStream.OPCODES.RESOURCE_UPDATE)this.publishedUploads++;
      if(command.opcode===D3DCommandStream.OPCODES.RESOURCE_UPDATE&&!command.payload.rect)this.publishedSurfaceUploads++;
      return super.submitSnapshot(command);
     }
    };
    WineAssembly.getWasmModule=()=>Promise.resolve(module);
    const wine=new WineAssembly(),canvas=document.createElement('canvas');canvas.width=canvas.height=64;document.body.append(canvas);
    const logs=[];wine.renderer=new Win98Renderer(canvas);wine.logToUI=m=>logs.push(String(m));wine.d3d9Programmable=true;wine.d3d9Backend=backend;
    globalThis.multiplyCurrentWine=wine;
    try{
     await wine.init(canvas);await wine.loadExe('d3d9-multiply-control.exe',{bytes:Uint8Array.from(bytes)});
     check(wine.guestWorker,'actual owning CPU Worker');check(wine._wasmModule===module,'loaded shipped module identity');
     wine.run(100000);const end=Date.now()+45000;let status=0;
     while(Date.now()<end){status=new DataView(wine.memory.buffer).getUint32(statusWasm,true);if(status)break;await sleep(10);}
     const view=new DataView(wine.memory.buffer),bridge=wine.hostCtx.d3d9Bridge;
     const rows=[...(bridge.worldTraceHistory?.values()||[])].flat();
     const sparseBase=view.getUint32(allocationWasm+24,true),missingBase=view.getUint32(allocationWasm+36,true);
     const backing=ga=>view.getUint32(pteBase+((ga>>>12)*4),true)&0xfffff000;
     const sparse={base:sparseBase,first:backing(sparseBase)>>>0,second:backing(sparseBase+4096)>>>0,
      missingBase,missingFirst:backing(missingBase)>>>0,missingSecond:backing(missingBase+4096)>>>0};
     const result={status,sparse,actual:view.getUint32(statusWasm+4,true),expected:view.getUint32(statusWasm+8,true),
      actualPixels:Array.from({length:pixelCount},(_,i)=>view.getUint32(pixelWasm+i*4,true)),
      frames:baseline?[]:Array.from({length:3},(_,c)=>Array.from({length:1024},(_,i)=>view.getUint32(frameWasm+c*4096+i*4,true))),
      module:{sha256:hash,bytes:moduleBytes.byteLength},enabled,guestSlot:wine.guestWorker.link.slot,
      guestEndpoint:wine.guestWorker.link.endpointIdentity,rendererPorts:[...(wine._renderWorkerManager?.ports?.values()||[])].map(p=>({id:p.id,options:p.options})),
      publishedDraws:bridge.publishedDraws,publishedUploads:bridge.publishedUploads,publishedSurfaceUploads:bridge.publishedSurfaceUploads,
      publishedColorDefinitions:bridge.publishedColorDefinitions,
      traceErrors:bridge.worldTraceErrors||0,tracePackets:bridge.worldTracePackets?.size||0,history:rows,logs,
      queueStates:[...bridge.devices].map(([id,e])=>({id,queue:e.queue?.snapshot(),lastError:String(e.queue?.error||'')}))};
     check(status,'bounded generated PE completion '+JSON.stringify(result));
     if(!baseline){
      check(status===1,'public COM/geometry assertion failed '+JSON.stringify(result));
      check(result.rendererPorts.some(p=>p.id>0&&p.options?.backend===backend),'actual production owning render Worker endpoint '+JSON.stringify(result.rendererPorts));
      check(result.publishedDraws>0,
        'guest draws publish after default or named target admission');
      if(!defaultTarget)check(result.publishedColorDefinitions>0,'named storage is created through guest publication');
      if(colorUpload)check(result.publishedUploads>0,'actual guest color uploads publish');
      if(surfaceUpload)check(result.publishedSurfaceUploads===3,
        'three writable unlocks publish; readonly unlocks publish nothing');
      check(sparse.base&&sparse.first&&sparse.second&&sparse.second!==sparse.first+4096,'committed guest-adjacent pages have independently verified nonadjacent backing');
      check(sparse.missingBase&&sparse.missingFirst&&!sparse.missingSecond,'missing second page is a separate negative');
      check(result.queueStates.every(r=>!r.queue?.error&&!r.lastError),'owning renderer has no error');
      check(!result.traceErrors&&!result.tracePackets,'passive scalar provenance complete');
      if(enabled)check(rows.some(r=>r.operation===10),'MultiplyTransform provenance is present');
      else check(!rows.length,'disabled diagnostics remain absent');
     }
     return result;
    }finally{const worker=wine.guestWorker;wine.stop();await worker?.stop();await wine._renderWorkerManager?.stop();canvas.remove();D3D9Host.Bridge=Base;WineAssembly.getWasmModule=getModule;}
   },{name,bytes:[...f.bytes],statusWasm:f.statusWasm,pixelWasm:f.pixelWasm,pixelCount:f.pixels.length,frameWasm:f.frameWasm,allocationWasm:f.allocationWasm,pteBase:require('../lib/region-map.generated').BASE.GUEST_PAGE_TABLE,enabled,baseline,defaultTarget,backend,colorUpload,surfaceUpload});
   assert.equal(row.module.sha256,sha(moduleBytes),'actual owning module matches local shipped bytes');
   const check=f.checks.find(c=>c.id===row.status);row.failedCheck=check||null;
   if(baseline){assert.equal(check?.label,'product selector256 word0');assert.equal(row.actual,0x3f800000);assert.equal(row.expected,0x40c00000);}
   if(!baseline)assert.deepEqual(row.actualPixels,f.pixels.map(p=>p.expected),'copied actual public LockRect pixels match independent scalar geometry oracle');
   if(out&&!baseline){
    const {PNG}=require('pngjs');row.captures=[];
    for(const [ci,words] of row.frames.entries()){
     const png=new PNG({width:32,height:32});words.forEach((v,i)=>{png.data[i*4]=v>>>16&255;png.data[i*4+1]=v>>>8&255;png.data[i*4+2]=v&255;png.data[i*4+3]=v>>>24;});
     const filename=name+'-trace'+Number(enabled)+'-'+f.oracle.cases[ci].name+'.png';fs.writeFileSync(path.join(out,filename),PNG.sync.write(png));row.captures.push(filename);
    }
   }
   evidence.rows.push({name,...row});save();console.log(JSON.stringify({name,enabled,status:row.status,failedCheck:row.failedCheck,module:row.module}));
  }
  assert(!errors.length,errors.join('\n'));evidence.outcome=baseline?'REPRODUCED_SUCCESS_NOOP':'PASS';
 }catch(e){evidence.outcome='FAIL';evidence.error=e.stack;throw e;}
 finally{
  if(browser){const pids=[],visit=pid=>{if(!pid||pids.includes(pid))return;pids.push(pid);try{fs.readFileSync('/proc/'+pid+'/task/'+pid+'/children','utf8').trim().split(/\s+/).filter(Boolean).map(Number).forEach(visit);}catch{}};visit(browser.process().pid);evidence.observedPids=pids;}
  await browser?.close();await new Promise(r=>{server.closeAllConnections();server.close(r);});evidence.endedAt=new Date().toISOString();save();
 }
 console.log(baseline?'REPRODUCED both shipped modules: successful MultiplyTransform leaves noncommuting matrix unchanged':'PASS both modules: actual public x86 COM products/stateblocks/invalid input and owning Worker geometry controls');
})().catch(e=>{console.error(e);process.exitCode=1;});
