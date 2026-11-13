#!/usr/bin/env node
'use strict';
// The same generated PE controls as Node, on production classic Chrome Workers.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const puppeteer=require('puppeteer');
const {startStaticServer,closeServer}=require('./static-server');
const {pe}=require('./test-dll-lifecycle-real-pe');
const {transportControl,transportResources}=require('./test-dll-startup-rollback');
const root=path.resolve(__dirname,'..');
const out=process.env.WA_STARTUP_WEB_EVIDENCE||path.join(root,'scratch/runs/dll-startup-resources-web');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=await startStaticServer({root,crossOriginIsolated:true});let browser;
 try{
  browser=await puppeteer.launch({headless:false,
   executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
   args:['--no-first-run','--no-default-browser-check']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?debug`,{waitUntil:'load'});
  if(!await page.evaluate(()=>typeof GuestThreadHost==='function'))
   await page.addScriptTag({url:'/lib/guest-thread-host.js'});
  const rows=[];
  for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
   const result=await page.evaluate(async({name,exe,dll,controlSource,resourceSource})=>{
    const check=(ok,label)=>{if(!ok)throw new Error(label);};
    check(crossOriginIsolated,'shared memory isolation');
    const module=await WebAssembly.compile(await(await fetch('/build/'+name)).arrayBuffer());
    const sigs=(await(await fetch('/lib/host-import-sigs.generated.json')).json()).sigs;
    const env={check,pe(parts,isDll=false){
     const bytes=new Uint8Array(isDll?dll:exe);
     for(const[rva,data]of parts)bytes.set(data,rva-0x1000+0x200);
     return bytes;
    },async create(){
     const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),logs=[];
     const ctx={getMemory:()=>memory.buffer,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}},onExit(){}};
     const imports=createHostImports(ctx);imports.host.memory=memory;
     const host=new GuestThreadHost({memory,module,sigs,hostImports:imports.host,
      workerUrl:'/lib/guest-worker.js',clockIntervalMs:0,log:line=>logs.push(line)});
     return {host,logs};
    }};
    const controls=Function('return ('+controlSource+')')();
    const resources=Function('return ('+resourceSource+')')();
    return [...await controls(env),...await resources(env)];
   },{name,exe:[...pe([])],dll:[...pe([],true)],
    controlSource:transportControl.toString(),resourceSource:transportResources.toString()});
   rows.push({name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'build',name))).digest('hex'),result});
  }
  if(errors.length)throw new Error('page errors: '+errors.join('; '));
  fs.writeFileSync(path.join(out,'test-result.json'),JSON.stringify({status:'pass',browser:await browser.version(),headless:false,
   rows,limits:'Protocol and lifecycle checks; not game visual correctness or FPS.'},null,2)+'\n');
  console.log('PASS headed Chrome normal/compat DLL startup, host resource barrier, failure and retirement');
 }finally{await browser?.close();await closeServer(server);}
})().catch(error=>{console.error(error);process.exitCode=1;});
