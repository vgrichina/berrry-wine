#!/usr/bin/env node
'use strict';
// Win32 reserves have no accessible storage until a page is committed. A
// generated ordinary x86 EXE installs FS:[0], reserves a stream-sized region,
// and reads it. Its real SEH handler commits/fills the page. No execution or
// fault-mode setter is used. The same test runs in the production owning
// Worker after normal real-PE DLL initialization, with both module variants.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const OUT=path.resolve(process.env.WA_RESERVED_ARTIFACTS||path.join(ROOT,'scratch/default-reserved-worker'));
fs.mkdirSync(OUT,{recursive:true});
const {pe}=require('./test-dll-lifecycle-real-pe');
const u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,n>>>24];
function fixture(committed){
 const main=[0x68,...u32(0x402100),0x64,0xff,0x35,0,0,0,0,0x64,0x89,0x25,0,0,0,0,
  0x6a,4,0x68,...u32(committed?0x3000:0x2000),0x68,...u32(113820),0x6a,0,
  0xff,0x15,...u32(0x401900),0xa3,...u32(0x401400),0x8b,0xf0];
 if(committed)main.push(0xc7,0x06,...u32(0x12345678));
 main.push(0x8b,0x06,0xa3,...u32(0x401404),0xc7,0x05,...u32(0x401410),1,0,0,0);
 main.push(0xe9,...u32(0x402080-(0x402000+main.length+5)));
 const handler=[0xff,0x05,...u32(0x401408),0x8b,0x44,0x24,4,0x8b,0x40,0x18,0xa3,...u32(0x40140c),
  0x6a,4,0x68,...u32(0x1000),0x68,...u32(0x1000),0xff,0x35,...u32(0x401400),
  0xff,0x15,...u32(0x401900),0xc7,0x00,...u32(0x12345678),0x31,0xc0,0xc3];
 const image=pe([[0x2000,main],[0x2080,[0xeb,0xfe]],[0x2100,handler]]);
 // Replace the first import's name in this generated PE only. The original
 // name LoadLibraryA has exactly the space needed for VirtualAlloc + NUL.
 image.write('VirtualAlloc\0',0x1a02-0x1000+0x200);
 return [...image];
}
const dll=[...pe([[0x1000,[0xb8,1,0,0,0,0xc2,12,0]]],true)];
const save=(name,value)=>fs.writeFileSync(path.join(OUT,name),JSON.stringify(value,null,2)+'\n');
process.argv.push('--isolate');
const server=require('../tools/dev-server').createServer({quiet:true});
const puppeteer=require('node:module').createRequire(path.join(ROOT,'tools/web-input-probe.js'))('puppeteer');
(async()=>{
 let browser;
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await puppeteer.launch({executablePath:process.env.CHROME||'/opt/google/chrome/chrome',headless:true,defaultViewport:null,args:['--no-sandbox','--disable-dev-shm-usage']});
  const proc=browser.process();save('process.json',{pid:process.pid,chromePid:proc.pid,port:server.address().port,endpoint:browser.wsEndpoint(),profile:proc.spawnargs.find(x=>x.startsWith('--user-data-dir='))?.slice(16)});
  proc.once('exit',(code,signal)=>save('chrome-exit.json',{code,signal}));
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',m=>fs.appendFileSync(path.join(OUT,'console.jsonl'),JSON.stringify({type:m.type(),text:m.text()})+'\n'));
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof WineAssembly==='function'&&typeof GuestThreadHost==='function');
  const results=await page.evaluate(async ({fixtures,dll,modulePrefix})=>{
   const results=[];window.WINE_THREADS=true;
   for(const mode of ['standard','compat'])for(const committed of [true,false]){
    const url=modulePrefix?modulePrefix.replace('{mode}',mode):'/build/wine-assembly'+(mode==='compat'?'.compat':'')+'.wasm';
    const bytes=await(await fetch(url)).arrayBuffer(),module=await WebAssembly.compile(bytes);
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const identity={url,bytes:bytes.byteLength,sha256:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')};
    const get=WineAssembly.getWasmModule;WineAssembly.getWasmModule=()=>Promise.resolve(module);
    const wine=new WineAssembly(),canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
    wine.renderer=new Win98Renderer(canvas);const logs=[];wine.logToUI=s=>logs.push(s);
    try{
     await wine.init(canvas);await wine.loadExe('reserved.exe',{bytes:Uint8Array.from(fixtures[committed?'committed':'reserved'])});
     const host=wine.guestWorker;if(!host)throw Error('production owning Worker absent '+logs.join('\n'));
     const old=host.link.log;host.link.log=s=>{logs.push(s);old(s);};
     await host.loadDlls([{name:'normal.dll',bytes:Uint8Array.from(dll)}],Uint8Array.from(fixtures[committed?'committed':'reserved']));
     const slice=await host.slice(1000);
     const e=wine.instance.exports,values=[0,4,8,12,16].map(n=>e.guest_read32(0x401400+n)>>>0);
     results.push({mode,committed,module:identity,endpointIdentity:host.link.endpointIdentity,workerUrl:host.workerUrl,normalDllInitialization:logs.some(s=>s.includes('DllMain returned, EAX=0x1')),slice,reserved:values[0],value:values[1],handlerCalls:values[2],faultAddress:values[3],completed:values[4]});
    }finally{const host=wine.guestWorker;wine.stop();await host?.stop();WineAssembly.getWasmModule=get;}
   }return results;
  },{fixtures:{committed:fixture(true),reserved:fixture(false)},dll,modulePrefix:process.env.WA_RESERVED_MODULE||null});
  save('results.json',{results,errors});assert.deepEqual(errors,[]);
  for(const r of results){assert(r.normalDllInitialization);assert(r.endpointIdentity);assert.equal(r.workerUrl,'lib/guest-worker.js?v=dev');assert(r.reserved);assert.equal(r.completed,1);assert.equal(r.value,0x12345678,`${r.mode} ${r.committed?'committed':'reserved'} actual ordinary read`);assert.equal(r.handlerCalls,r.committed?0:1);if(!r.committed)assert.equal(r.faultAddress,r.reserved);}
  console.log('PASS default MEM_RESERVE real SEH commit/fill/resumed x86 read; ordinary production owning Workers, normal DLL initialization, both modules; committed controls');
 }finally{
  const pids=[],visit=pid=>{if(!pid||pids.includes(pid))return;pids.push(pid);try{for(const v of fs.readFileSync('/proc/'+pid+'/task/'+pid+'/children','utf8').trim().split(/\s+/).filter(Boolean))visit(Number(v));}catch{}};visit(browser?.process()?.pid);save('descendants.json',{pids});
  await browser?.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
 }
})().catch(error=>{save('failure.json',{error:error.stack});console.error(error);process.exitCode=1;});
