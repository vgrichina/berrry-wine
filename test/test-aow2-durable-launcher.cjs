'use strict';
// Real process death and browser execution, with no original game or run deps.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const c=require('../tools/native-supervisor-common.cjs'),l=require('../tools/aow2-durable-launcher.cjs');
async function until(f,seconds=30){const end=Date.now()+seconds*1000;while(!f()){assert(Date.now()<end,'finite test deadline');await c.sleep(20);}}
async function driver(run){
 const b=await require('puppeteer').connect({browserWSEndpoint:process.env.AOW_BROWSER_ENDPOINT});
 process.on('SIGTERM',()=>{c.save(run,'driver-terminated.json',{at:c.now()});b.disconnect();process.exitCode=124;});
 c.save(run,'driver-ready.json',{pid:process.pid});
 while(!fs.existsSync(path.join(run,'continue'))&&!fs.existsSync(path.join(run,'driver-terminated.json')))await c.sleep(10);
 if(fs.existsSync(path.join(run,'driver-terminated.json')))return;
 const page=await b.newPage();
 const receipt=await page.evaluate(async()=>{
  // Authored native WASM addition actually executes inside the owned renderer.
  const bytes=new Uint8Array([0,97,115,109,1,0,0,0,1,7,1,96,2,127,127,1,127,3,2,1,0,7,7,1,3,97,100,100,0,0,10,9,1,7,0,32,0,32,1,106,11]);
  const {instance}=await WebAssembly.instantiate(bytes);const result=instance.exports.add(19,23);
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;document.body.appendChild(canvas);const ctx=canvas.getContext('2d');ctx.fillStyle=result===42?'#ff0000':'#000000';ctx.fillRect(0,0,32,32);
  return {result,pixel:[...ctx.getImageData(4,4,1,1).data],nativeExecuted:true};
 });assert.equal(receipt.result,42);assert.deepEqual(receipt.pixel,[255,0,0,255]);c.save(run,'authored-browser-result.json',receipt);
 await b.close();
}
async function submit(run,old){
 if(!old)l.launch({run,driver:__filename,args:['--driver',run],duration:25,cleanup:40});
 else{const at=c.now();c.save(run,'config.json',{driver:__filename,args:['--driver',run],at,deadline:at+25,cleanupDeadline:at+40});c.save(run,'owner-process.json',l.identity(process.pid));await l.main('owner',run);return;}
 await new Promise(()=>setInterval(()=>{},1000));
}
async function control(run,signal,old=false){
 fs.mkdirSync(run);const p=cp.spawn(process.execPath,[__filename,'--submit',run,...(old?['old']:[])],{detached:true,stdio:['ignore','pipe','pipe']}),wait=c.communicate(p);
 try{await until(()=>fs.existsSync(path.join(run,'driver-ready.json')));
  p.kill(signal);const w=await wait;c.save(run,'submitter-wait.json',{requestedSignal:signal,exit:w.returncode,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded});
  if(old){await until(()=>fs.existsSync(path.join(run,'owner-complete.json')));assert(fs.existsSync(path.join(run,'driver-terminated.json')));assert(!fs.existsSync(path.join(run,'authored-browser-result.json')));assert.equal(c.readJSON(path.join(run,'native/receipt.json')).terminated,'supervisor SIGTERM');}
  else{assert.equal(w.returncode,signal==='SIGTERM'?-15:-9);const owner=c.readJSON(path.join(run,'owner-process.json'));assert.equal(c.token(owner.pid),owner.startToken);assert.equal(owner.pgid,owner.pid);fs.writeFileSync(path.join(run,'continue'),'');await until(()=>fs.existsSync(path.join(run,'owner-complete.json')));assert(c.readJSON(path.join(run,'authored-browser-result.json')).nativeExecuted);assert.equal(c.readJSON(path.join(run,'native/receipt.json')).exit,0);}
  const receipt=c.readJSON(path.join(run,'native/receipt.json'));assert.equal(receipt.leaked,false);assert.equal(receipt.pollError,null);
  for(const n of ['driver','chrome','watchdog']){const r=c.readJSON(path.join(run,n+'-wait.json'));assert(r.actualWait&&r.stdoutEOF&&r.stderrEOF);}
  assert(c.readJSON(path.join(run,'profile-cleanup.json')).removed);
  c.save(run,'assertions.json',{pass:true,old,signal,originalSender:'UNKNOWN',nativeAndBrowserControl:true});
 }finally{if(p.exitCode===null&&p.signalCode===null){p.kill('SIGKILL');await wait;}}
}
async function main(){const [mode,run,arg]=process.argv.slice(2);if(mode==='--driver')return driver(run);if(mode==='--submit')return submit(run,arg==='old');
 const out=path.resolve(run||fs.mkdtempSync(path.join(os.tmpdir(),'aow2-durable-')));fs.mkdirSync(out,{recursive:true});
 assert.throws(()=>l.launch({run:path.join(out,'invalid'),driver:__filename,duration:901,cleanup:920}));
 await control(path.join(out,'old-term'),'SIGTERM',true);for(const sig of ['SIGTERM','SIGKILL'])await control(path.join(out,'new-'+sig),sig);
 console.log(JSON.stringify({pass:true,out}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
