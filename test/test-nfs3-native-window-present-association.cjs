'use strict';
// Actual submitting-process loss, native supervisor waits and Chrome WASM.
// All inputs are authored here; no retained-run dependency or original game.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const cp=require('node:child_process'),assert=require('node:assert/strict');
const c=require('../tools/native-supervisor-common.cjs');
const launcher=require('../tools/nfs3-association-scope.cjs');
const root=path.resolve(__dirname,'..');
async function until(f,ms=30000){const end=Date.now()+ms;while(!f()){
  assert(Date.now()<end,'finite control deadline');await c.sleep(20);
}}
async function driver(run){
  let cancelled=false;process.on('SIGTERM',()=>{cancelled=true;});
  const browser=await require('puppeteer').launch({executablePath:'/opt/google/chrome/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const child=browser.process(),wait=new Promise(resolve=>child.once('close',(exit,signal)=>
    resolve({pid:child.pid,exit,signal,actualWait:true,
      stdoutEOF:child.stdout?.readableEnded??null,stderrEOF:child.stderr?.readableEnded??null})));
  try{
    c.save(run,'driver-ready.json',{pid:process.pid,browser:child.pid});
    while(!cancelled&&!c.exists(path.join(run,'continue')))await c.sleep(10);
    if(cancelled){c.save(run,'driver-terminated.json',{at:c.now()});process.exitCode=124;return;}
    const page=(await browser.pages())[0];
    const result=await page.evaluate(async()=>{
      const bytes=new Uint8Array([0,97,115,109,1,0,0,0,1,7,1,96,2,127,127,1,127,3,2,1,0,
        7,7,1,3,97,100,100,0,0,10,9,1,7,0,32,0,32,1,106,11]);
      const {instance}=await WebAssembly.instantiate(bytes);
      return instance.exports.add(19,23);
    });assert.equal(result,42);c.save(run,'native-browser-result.json',{result});
  }finally{await browser.close();c.save(run,'browser-wait.json',await wait);}
}
async function submit(run){
  launcher.launch({run,driver:__filename,args:['--driver',run],duration:30,cleanup:45});
  await new Promise(()=>setInterval(()=>{},1000));
}
async function control(run,signal,old){
  fs.mkdirSync(run);let args;
  if(old){const at=c.now();c.save(run,'config.json',{driver:__filename,
    args:['--driver',run],env:{},deadline:at+30,cleanupDeadline:at+45,
    reserveSeconds:180,gameplayCutoff:at-150});
    args=[path.join(root,'tools/nfs3-association-scope.cjs'),'owner',run];
  }else args=[__filename,'--submit',run];
  const p=cp.spawn(process.execPath,args,{detached:true,stdio:['ignore','pipe','pipe']});
  const wait=c.communicate(p);
  try{
    await until(()=>c.exists(path.join(run,'driver-ready.json')));
    p.kill(signal);const w=await wait;
    c.save(run,'submitter-wait.json',{requestedSignal:signal,actualWait:true,
      returncode:w.returncode,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded});
    if(!old){assert.equal(w.returncode,signal==='SIGTERM'?-15:-9);
      fs.writeFileSync(path.join(run,'continue'),'');}
    await until(()=>c.exists(path.join(run,'owner-complete.json')));
    if(old){assert(c.exists(path.join(run,'driver-terminated.json')));
      assert(!c.exists(path.join(run,'native-browser-result.json')));
      assert.equal(c.readJSON(path.join(run,'native/receipt.json')).terminated,'supervisor SIGTERM');
    }else assert.equal(c.readJSON(path.join(run,'native-browser-result.json')).result,42);
    for(const n of ['native','watchdog','browser']){
      const r=c.readJSON(path.join(run,n+'-wait.json'));
      assert(r.actualWait&&r.stdoutEOF&&r.stderrEOF,n+' actual wait and both EOF');
    }
    assert.equal(c.readJSON(path.join(run,'native/receipt.json')).leaked,false);
    assert.equal(c.readJSON(path.join(run,'native/receipt.json')).pollError,null);
    c.save(run,'assertions.json',{pass:true,old,signal,originalSignalSender:'UNKNOWN'});
  }finally{if(p.exitCode===null&&p.signalCode===null){p.kill('SIGKILL');await wait;}}
}
async function main(){const [mode,run]=process.argv.slice(2);
  if(mode==='--driver')return driver(run);if(mode==='--submit')return submit(run);
  const out=path.resolve(run||fs.mkdtempSync(path.join(os.tmpdir(),'nfs3-scope-')));
  fs.mkdirSync(out,{recursive:true});
  await control(path.join(out,'old-term'),'SIGTERM',true);
  for(const signal of ['SIGTERM','SIGKILL'])await control(path.join(out,'new-'+signal),signal,false);
  console.log(JSON.stringify({pass:true,out}));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
