'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto');
const {compile}=require('../tools/watx.js');
const {installPageObserver,workerBootstrap,moduleBytes,track,inventory}=require('../tools/nfs3-worker-inventory.cjs');
const compiled=compile('(import "host" "memory" (memory 1 1 shared)) (func (export "run") (result i32) (i32.const 127))',new Map(),{runtimeBuiltins:false,standardWat:true,tailCalls:false});
assert(compiled.success,compiled.error);const bytes=Buffer.from(compiled.wasmBinary),hash=crypto.createHash('sha256').update(bytes).digest('hex');
async function main(){
  // A real native Worker returns and closes; its slot and endpoint can be reused
  // without making the returned incarnation a current owner.
  const {Worker}=require('node:worker_threads');
  const w=new Worker(`const {parentPort}=require('worker_threads');parentPort.on('message',async b=>{const m=await WebAssembly.compile(b),i=await WebAssembly.instantiate(m,{host:{memory:new WebAssembly.Memory({initial:1,maximum:1,shared:true})}});parentPort.postMessage(i.exports.run());parentPort.close();});`,{eval:true});
  const exited=new Promise(r=>w.once('exit',r)),reply=new Promise(r=>w.once('message',r));w.postMessage(bytes);assert.equal(await reply,127);assert.equal(await exited,0);
  const server=http.createServer((q,s)=>{s.setHeader('Cross-Origin-Opener-Policy','same-origin');s.setHeader('Cross-Origin-Embedder-Policy','require-corp');s.end('<html><body>Native Worker lifecycle control</body></html>');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,tracker;
  try{
    browser=await require('puppeteer').launch({executablePath:'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
    tracker=track(browser);const page=(await browser.pages())[0];await page.evaluateOnNewDocument(installPageObserver);
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.evaluate(async({bytes,prefix})=>{
      const module=await WebAssembly.compile(new Uint8Array(bytes)),memory=new WebAssembly.Memory({initial:1,maximum:1,shared:true});
      const url=URL.createObjectURL(new Blob([prefix+`onmessage=async e=>{if(e.data.t==='close')return close();const i=await WebAssembly.instantiate(e.data.module,{host:{memory:e.data.memory}});postMessage({value:i.exports.run()});};`],{type:'text/javascript'}));
      globalThis.control={module,memory,url,all:[]};
      globalThis.spawn=async(slot,endpoint)=>{const worker=new Worker(url),link={worker,module,memory,slot,endpointIdentity:endpoint};control.all.push(link);
        const ready=new Promise(r=>worker.onmessage=e=>{if(e.data.value!==127)throw Error('native return');r();});worker.postMessage({t:'init',module,memory,slot,endpointIdentity:endpoint});await ready;return link;};
      const main=await spawn(0,1),aux=await spawn(2,2);globalThis.wine={memory,_wasmModule:module,guestWorker:{link:main,threadLinks:new Map([[2,aux]])},processId:1};
    },{bytes:[...bytes],prefix:workerBootstrap()});
    const snapshot=()=>page.evaluate(()=>__nfsWorkerInventory.snapshot(wine));
    const initial=await inventory({snapshot,tracker,sha256:hash});assert.equal(initial.modules.length,2);
    // Old implementation queries this now-closed session and fails.
    const oldRow=tracker.rows.find(r=>r.actor===initial.snapshot.owners.find(o=>o.slot===2).id);
    await page.evaluate(()=>{const old=wine.guestWorker.threadLinks.get(2);old.worker.terminate();old._retirementComplete=true;wine.guestWorker.threadLinks.delete(2);});
    await new Promise(r=>setTimeout(r,100));
    await assert.rejects(()=>moduleBytes(oldRow.session,oldRow.target.url()));
    const transient=await inventory({snapshot,tracker,sha256:hash});assert.equal(transient.modules.length,1);
    await page.evaluate(async()=>{const replacement=await spawn(2,2);wine.guestWorker.threadLinks.set(2,replacement);});
    const current=await inventory({snapshot,tracker,sha256:hash});assert.equal(current.modules.length,2);assert.equal(current.retired.length,1);assert.equal(current.retired[0].byteIdentity,null);
    assert.notEqual(current.snapshot.owners.find(o=>o.slot===2).id,initial.snapshot.owners.find(o=>o.slot===2).id);
    await page.evaluate(()=>wine.guestWorker.link.endpointIdentity++);
    await assert.rejects(snapshot,/endpoint\/slot generation/);
    await page.evaluate(()=>wine.guestWorker.link.endpointIdentity--);
    await page.evaluate(()=>{control.priorModule=wine._wasmModule;wine._wasmModule=null;});
    await assert.rejects(snapshot,/owner\/module\/memory generation/);
    await page.evaluate(()=>wine._wasmModule=control.priorModule);
    await assert.rejects(()=>inventory({snapshot,tracker,sha256:'0'.repeat(64)}),/hash mismatch/);
    const bad=structuredClone(current.snapshot);bad.records.find(r=>r.id===bad.owners[0].id).terminatedAt=1;
    await assert.rejects(()=>inventory({snapshot:async()=>bad,tracker,sha256:hash}),/retired required owner/);
    let calls=0;await assert.rejects(()=>inventory({snapshot:async()=>{const s=structuredClone(current.snapshot);if(calls++)s.windowIds=['replacement'];return s;},tracker,sha256:hash}),/generation\/window changed/);
    await page.evaluate(()=>wine.guestWorker.threadLinks.get(2).worker.postMessage({t:'close'}));await new Promise(r=>setTimeout(r,100));
    await assert.rejects(()=>inventory({snapshot,tracker,sha256:hash}),/unexpected target disconnect|live owner disconnected/);
    // Preserve the first request error, with no cleanup request after UNKNOWN.
    const sent=[];const first=Error('first byte read');const fake={on(){},off(){},async send(method){sent.push(method);throw first;}};
    await assert.rejects(()=>moduleBytes(fake,'native'),e=>e===first);assert.deepEqual(sent,['Debugger.enable']);
    console.log(JSON.stringify({pass:true,nativeReturn:127,nativeWorkerExit:0,oldClosedSessionFails:true,dynamicActiveOwners:2,retiredByteIdentity:null,slotAndEndpointReuse:true,liveOwnerReplacement:true,unexpectedDisconnectClosed:true,hashMismatchClosed:true,requiredRetiredClosed:true,windowChangeClosed:true,firstErrorPreserved:true,moduleSHA256:hash}));
  }finally{tracker?.close();if(browser){const child=browser.process(),wait=new Promise(r=>child.once('close',(code,signal)=>r({pid:child.pid,code,signal,stdoutEOF:child.stdout?.readableEnded??null,stderrEOF:child.stderr?.readableEnded??null})));await browser.close();const receipt=await wait;assert.equal(receipt.code,0);console.log(JSON.stringify({browserWait:receipt}));}await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
