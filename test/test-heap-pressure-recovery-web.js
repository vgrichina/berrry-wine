#!/usr/bin/env node
'use strict';
// Ordinary x86 public calls in the production owning Worker. The baseline
// switch pins fail-before + explicit compact without requiring source setters.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=process.cwd(),OUT=path.resolve(process.env.WA_PRESSURE_ARTIFACTS||'scratch/heap-pressure-worker');
const {pe}=require(ROOT+'/test/test-dll-lifecycle-real-pe');
const u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,n>>>24];
const API=['GetProcessHeap','HeapAlloc','HeapFree','HeapCompact'];
function fixture(freeCount){
 const b=[],labels={},fix=[];
 const emit=(...v)=>b.push(...v.flat()),push=n=>emit(0x68,u32(n));
 const api=n=>emit(0xff,0x15,u32(0x401900+API.indexOf(n)*4));
 const store=n=>emit(0xa3,u32(n));
 const jump=(op,name)=>{emit(op);fix.push([b.length,name]);emit(0,0,0,0);};
 const alloc=n=>{push(n);push(0);emit(0xff,0x35,u32(0x401628));api('HeapAlloc');};
 const freeAt=n=>{emit(0xff,0x35,u32(n));push(0);emit(0xff,0x35,u32(0x401628));api('HeapFree');};
 emit(0xbd,u32(0x77665544),0xbf,u32(0x1234abcd));
 api('GetProcessHeap');store(0x401628);
 for(let i=0;i<=freeCount;i++){alloc(16384);store(0x401680+i*4);}
 emit(0x8b,0x35,u32(0x401680+freeCount*4),0xc7,0x06,u32(0x5a1234a5),0x31,0xdb);
 labels.fill=b.length;alloc(16384);emit(0x85,0xc0);jump([0x0f,0x84],'full');
 emit(0x43,0x81,0xfb,u32(40000));jump([0x0f,0x82],'fill');
 labels.full=b.length;store(0x401604);emit(0x89,0xd8);store(0x401600);
 for(let i=0;i<freeCount;i++){
  freeAt(0x401680+i*4);store(0x401608);emit(0x83,0xf8,1);jump([0x0f,0x85],'bad');
 }
 alloc(45056);store(0x40160c);
 // Restore the freed span after the automatic check, so explicit compact
 // has the same free input in both the baseline and recovered cases.
 emit(0x85,0xc0);jump([0x0f,0x84],'compact');freeAt(0x40160c);
 labels.compact=b.length;push(0);emit(0xff,0x35,u32(0x401628));api('HeapCompact');store(0x401650);
 alloc(45056);store(0x401654);
 emit(0x8b,0x35,u32(0x401680+freeCount*4),0x8b,0x06);store(0x401658);
 emit(0x89,0xe8);store(0x401610);emit(0x89,0xf8);store(0x401614);
 emit(0x3d,u32(0x1234abcd));jump([0x0f,0x85],'bad');
 emit(0xb8,u32(0xcafebabe));store(0x401618);jump(0xe9,'loop');
 labels.bad=b.length;emit(0xb8,u32(0xbad));store(0x401618);
 labels.loop=b.length;emit(0xeb,0xfe);
 for(const [i,label]of fix)b.splice(i,4,...u32(labels[label]-i-4));
 const image=pe([[0x2000,b]]),raw=r=>r-0x1000+0x200;
 image.fill(0,raw(0x1900),raw(0x1d00));let cursor=0x1a00;
 for(let i=0;i<API.length;i++){
  image.writeUInt32LE(cursor,raw(0x1900+4*i));image.write(API[i]+'\0',raw(cursor+2));cursor+=API[i].length+3;
 }
 return [...image];
}
fs.mkdirSync(OUT,{recursive:true});
const save=(n,v)=>fs.writeFileSync(path.join(OUT,n),JSON.stringify(v,null,2)+'\n');
process.argv.push('--isolate');
const server=require(ROOT+'/tools/dev-server').createServer({quiet:true});
const puppeteer=require('node:module').createRequire(ROOT+'/tools/web-input-probe.js')('puppeteer');
(async()=>{
 let browser;
 try{
  await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
  browser=await puppeteer.launch({executablePath:process.env.CHROME||'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const proc=browser.process();save('process.json',{pid:process.pid,chromePid:proc.pid,port:server.address().port,endpoint:browser.wsEndpoint(),profile:proc.spawnargs.find(x=>x.startsWith('--user-data-dir='))?.slice(16)});
  proc.once('exit',(code,signal)=>save('chrome-exit.json',{code,signal}));
  const page=await browser.newPage(),errors=[];page.setDefaultTimeout(240000);
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>fs.appendFileSync(path.join(OUT,'console.jsonl'),JSON.stringify({at:new Date().toISOString(),type:m.type(),text:m.text()})+'\n'));
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof WineAssembly==='function'&&typeof GuestThreadHost==='function');
  const rows=await page.evaluate(async({images,dll,prefix})=>{
   window.WINE_THREADS=true;const rows=[];
   for(const mode of ['standard','compat'])for(const freeCount of [3,4]){
    const image=images[freeCount];
    const url=prefix?prefix.replace('{mode}',mode):'/build/wine-assembly'+(mode==='compat'?'.compat':'')+'.wasm';
    const bytes=await(await fetch(url)).arrayBuffer(),module=await WebAssembly.compile(bytes);
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const identity={url,bytes:bytes.byteLength,sha256:[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('')};
    const previous=WineAssembly.getWasmModule;WineAssembly.getWasmModule=()=>Promise.resolve(module);
    const wine=new WineAssembly(),canvas=document.createElement('canvas'),logs=[];
    canvas.width=640;canvas.height=480;wine.renderer=new Win98Renderer(canvas);wine.logToUI=s=>logs.push(s);
    try{
     await wine.init(canvas);await wine.loadExe('pressure.exe',{bytes:Uint8Array.from(image)});
     const host=wine.guestWorker;if(!host)throw Error('owning Worker absent '+logs.join('\n'));
     const orig=host.link.log;host.link.log=s=>{logs.push(s);orig(s);};
     await host.loadDlls([{name:'normal.dll',bytes:Uint8Array.from(dll)}],Uint8Array.from(image));
     const slices=[];for(let i=0;i<100;i++){
      slices.push(await host.slice(20000));
      if((wine.instance.exports.guest_read32(0x401618)>>>0)===0xcafebabe)break;
     }
     rows.push({mode,freeCount,module:identity,values:Array.from({length:37},(_,i)=>wine.instance.exports.guest_read32(0x401600+i*4)>>>0),memoryBytes:wine.memory.buffer.byteLength,endpointIdentity:host.link.endpointIdentity,workerUrl:host.workerUrl,normalDllInitialization:logs.some(s=>s.includes('DllMain returned, EAX=0x1')),logs,slices});
    }finally{const host=wine.guestWorker;wine.stop();await host?.stop();WineAssembly.getWasmModule=previous;}
   }return rows;
  },{images:{3:fixture(3),4:fixture(4)},dll:[...pe([[0x1000,[0xb8,1,0,0,0,0xc2,12,0]]],true)],prefix:process.env.WA_PRESSURE_MODULE||null});
  save('results.json',{at:new Date().toISOString(),rows,errors});assert.deepEqual(errors,[]);
  for(const r of rows){
   const v=r.values;assert(r.endpointIdentity);assert.equal(r.workerUrl,'lib/guest-worker.js?v=dev');assert(r.normalDllInitialization);
   assert.equal(r.memoryBytes,512*1024*1024);assert(v[0]>10000&&v[0]<40000);assert.equal(v[1],0);assert.equal(v[2],1);
   assert.equal(v[4],0x77665544);assert.equal(v[5],0x1234abcd);assert.equal(v[6],0xcafebabe);
   for(let i=32;i<32+r.freeCount;i++)assert.equal(v[i+1]-v[i],16416,'includes Toolhelp metadata');
   if(process.env.WA_PRESSURE_EXPECT_BASELINE==='1')assert.equal(v[3],0,'baseline refusal before explicit compact');
   else if(r.freeCount===3)assert.equal(v[3],0,'live provisional Toolhelp record separates the three-block run');
   else assert(v[3]>=v[32]&&v[3]<v[32+r.freeCount],'automatic recovery reuses owned freed span');
   assert(v[20]>=45056);assert(v[21]>=v[32]&&v[21]<v[32+r.freeCount]);assert.equal(v[22],0x5a1234a5);
  }
  console.log('PASS public owning-Worker pressure '+(process.env.WA_PRESSURE_EXPECT_BASELINE==='1'?'baseline fail/explicit compact success':'automatic recovery/explicit compact success')+'; both modules, fixed512MiB, live guard and ABI sentinels');
 }finally{
  const pids=[],visit=pid=>{if(!pid||pids.includes(pid))return;pids.push(pid);try{for(const c of fs.readFileSync('/proc/'+pid+'/task/'+pid+'/children','utf8').trim().split(/\s+/).filter(Boolean))visit(Number(c));}catch{}};
  visit(browser?.process()?.pid);save('descendants.json',{pids});await browser?.close();
  await new Promise(r=>{server.close(r);server.closeAllConnections();});
 }
})().catch(e=>{save('failure.json',{at:new Date().toISOString(),error:e.stack});console.error(e);process.exitCode=1;});
