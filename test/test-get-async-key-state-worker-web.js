'use strict';
// Ordinary x86 imports executed by the production guest Worker. DOM input is
// delivered through browser-input, with UP armed independently of DOWN.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.env.WA_ASYNC_ARTIFACTS||ROOT+'/scratch/async-key-worker');
fs.mkdirSync(OUT,{recursive:true});
const {pe}=require('./test-dll-lifecycle-real-pe');
const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
const code=[];
for(let i=0;i<2;i++)code.push(0x6a,13,0xff,0x15,...u32(0x401900),0xa3,...u32(0x401400+i*4));
code.push(0xc7,0x05,...u32(0x401408),1,0,0,0,0xeb,0xfe);
const image=pe([[0x2000,code],[0x1f00,[0,0,...Buffer.from('GetAsyncKeyState\0')]]]);
image.writeUInt32LE(0x1f00,0x1900-0x1000+0x200);
image.write('user32.dll\0\0\0',0x1880-0x1000+0x200);
const dll=pe([[0x1000,[0xb8,1,0,0,0,0xc2,12,0]]],true);
const save=(n,v)=>fs.writeFileSync(OUT+'/'+n,JSON.stringify(v,null,2)+'\n');
function processIdentity(pid){
 const stat=fs.readFileSync('/proc/'+pid+'/stat','utf8');
 const fields=stat.slice(stat.lastIndexOf(')')+2).split(' ');
 return {pid,state:fields[0],ppid:Number(fields[1]),pgid:Number(fields[2]),sid:Number(fields[3]),startTicks:fields[19]};
}
process.argv.push('--isolate');
const server=require('../tools/dev-server').createServer({quiet:true});
let browser;
(async()=>{
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await require('puppeteer').launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const driver=processIdentity(process.pid),chrome=processIdentity(browser.process().pid);
  save('process.json',{pid:process.pid,browserPid:chrome.pid,port:server.address().port,driver,chrome});
  assert.equal(chrome.pgid,chrome.pid,'browser owns its cleanup process group');
  assert.notEqual(chrome.pgid,driver.pgid,'browser cleanup cannot target driver group');
  const results=[];
  for(const mode of ['released-undrained','held','released-drained']){
   const page=await browser.newPage();
   page.on('console',m=>fs.appendFileSync(OUT+'/console.jsonl',JSON.stringify({mode,text:m.text()})+'\n'));
   await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?debug&threads&no-log');
   await page.waitForFunction(()=>typeof GuestThreadHost==='function');
   await page.evaluate(async({image,dll})=>{
    window.WINE_THREADS=true;window.__events=[];
    for(const type of ['keydown','keyup'])window.addEventListener(type,e=>__events.push({type,code:e.code,trusted:e.isTrusted}),true);
    const canvas=document.getElementById('screen'),w=window.__fixture=new WineAssembly();
    w.renderer=new Win98Renderer(canvas);await w.init(canvas);
    await w.loadExe('async.exe',{bytes:Uint8Array.from(image)});
    if(!w.guestWorker)throw Error('production Worker missing');
    await w.guestWorker.loadDlls([{name:'normal.dll',bytes:Uint8Array.from(dll)}],Uint8Array.from(image));
    w.running=true;
    browserInput.wireCanvasInput(canvas,w.renderer,{runningApps:[{wine:w}],debugMode:true});
    canvas.tabIndex=0;canvas.focus();
   },{image:[...image],dll:[...dll]});
   let release;
   if(mode!=='held')release=setTimeout(()=>page.keyboard.up('Enter'),80);
   try{await page.keyboard.down('Enter');if(mode!=='held')await new Promise(r=>setTimeout(r,150));
    const result=await page.evaluate(async mode=>{
     const w=__fixture,r=w.renderer;
     if(mode==='released-drained')while(r.takeInput());
     const before={physical:!!r._physicalKeys?.[13],async:!!r._asyncKeys?.[13],pressed:!!r._asyncPressedKeys?.[13],queued:r.inputQueue.length};
     const slice=await w.guestWorker.slice(100);
     const e=w.instance.exports,values=[0,4,8].map(n=>e.guest_read32(0x401400+n)>>>0);
     return {mode,before,values,slice,events:__events,endpoint:w.guestWorker.link.endpointIdentity,workerUrl:w.guestWorker.workerUrl};
    },mode);results.push(result);
   }finally{clearTimeout(release);await page.keyboard.up('Enter');await page.evaluate(async()=>{const h=__fixture.guestWorker;__fixture.stop();await h.stop();});await page.close();}
  }
  save('results.json',results);
  for(const row of results){assert(row.endpoint);assert.equal(row.values[2],1);assert(row.events.some(e=>e.type==='keydown'&&e.trusted));
   if(row.mode==='held'){assert(row.before.physical);assert.deepEqual(row.values.slice(0,2),[0x8001,0x8000]);}
   else{assert(!row.before.physical);assert(row.events.some(e=>e.type==='keyup'&&e.trusted));assert.deepEqual(row.values.slice(0,2),[1,0]);}
  }
  assert(results[0].before.async,'actual late predicate UNKNOWN reproduced with undrained message snapshot');
  console.log('PASS production guest Worker ordinary GetAsyncKeyState: held high bit, released latch once, drained/undrained input and trusted independent UP');
 }finally{await browser?.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});save('cleanup.json',{closed:true});}
})().catch(e=>{save('failure.json',{error:e.stack});console.error(e);process.exitCode=1;});
