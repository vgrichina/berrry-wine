'use strict';
// Authored PE only; no retained run dependencies or original game media.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),net=require('node:net');
const prep=require('../tools/blood2-immutable-preparation.cjs'),c=require('../tools/native-supervisor-common.cjs');
const root=path.resolve(__dirname,'..');
async function body(out){
 fs.mkdirSync(out,{recursive:true});
 const module=fs.readFileSync(root+'/build/wine-assembly.wasm'),rows=prep.collect();
 const old=prep.freeze(rows.filter(r=>!r.path.startsWith('node_modules/pngjs/')),module);
 try{assert.throws(()=>prep.renderingPreflight(old),e=>{assert.match(e.message,/unsealed runtime input: pngjs/);c.save(out,'old-failure.json',{error:e.message,originalLaunched:false});return true;});}finally{old.close();}
 const missing=prep.freeze(rows.filter(r=>r.path!=='node_modules/pngjs/lib/png.js'),module);
 try{assert.throws(()=>prep.renderingPreflight(missing),e=>{assert.match(e.message,/unsealed runtime input: pngjs/);c.save(out,'missing-dependency-failfast.json',{error:e.message,originalLaunched:false});return true;});}finally{missing.close();}
 const frozen=prep.freeze(rows,module);
 try{
  c.save(out,'rendering-preflight.json',prep.renderingPreflight(frozen));
  const exe=path.join(out,'authored.exe');fs.writeFileSync(exe,require('./test-cli-native-button-delivery.cjs').fixture(0));
  const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
  const a=require('../tools/blood2-reviewed-input.cjs');a.R=out;a.URL='http://127.0.0.1:'+port+'/ctl';
  const now=c.now();a.save('launch.json',{at:now,deadline:now+240,gameplayCutoff:now+60,reserveSeconds:180,nativeScene:true,inputPolicy:{confirmationMs:500,physicalUpMs:1750,observationMs:3000,gameFreshnessSeconds:5,menuFreshnessSeconds:30}});
  const p=cp.spawn(process.execPath,['test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks','--screen=1024x712','--max-seconds=25','--max-batches=10000000','--control='+port,'--quiet-api','--quiet-blocks','--no-close'],{cwd:root,env:frozen.env,stdio:c.stdioWithFds(frozen.fds)});
  const wait=c.communicate(p);a.save('native-pid.json',{pid:p.pid,startToken:c.token(p.pid),at:c.now()});
  try{
   const end=Date.now()+15000;for(;;){try{const s=await a.call({action:'snapshot'},.5);if(s.mainHwnd!=='0x0'&&s.focusWindow.live&&s.physicalUp)break;}catch{}assert(Date.now()<end,'native startup');await c.sleep(25);}
   await a.capture('whole-desktop');const image=require('pngjs').PNG.sync.read(fs.readFileSync(path.join(out,'whole-desktop.png')));assert.equal(image.width,1024);assert.equal(image.height,712);
   // Terminal scope must reject before touching transport, even with a live
   // owner. Cancellation remains worker-owned host cleanup.
   a.save('terminal-input-failure.json',{noReplay:true,reason:'authored terminal test'});
   const post=c.postJSON;let calls=0;c.postJSON=async()=>{calls++;throw Error('endpoint after terminal');};
   try{await assert.rejects(a.capture('closed'),/sticky UNKNOWN/);assert.equal(calls,0);}finally{c.postJSON=post;}
  }finally{
   p.kill('SIGTERM');const w=await wait;c.save(out,'native-wait.json',{pid:p.pid,exit:w.returncode,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded});fs.writeFileSync(path.join(out,'native.stdout.log'),w.stdout);fs.writeFileSync(path.join(out,'native.stderr.log'),w.stderr);assert.equal(w.returncode,0);assert(p.stdout.readableEnded&&p.stderr.readableEnded);
  }
  c.save(out,'assertions.json',{pass:true,oldFailNewPass:true,sameImmutableLoader:true,missingDependencyFailfast:true,nativeWorkerStartupCancel:true,wholeDesktopPNG:true,terminalNoEndpoint:true});
 }finally{frozen.close();}
}
async function main(){const out=path.resolve(process.argv[3]||fs.mkdtempSync(path.join(os.tmpdir(),'blood2-prep-')));if(process.argv[2]==='--body')return body(out);fs.mkdirSync(out,{recursive:true});const r=await require('../tools/native-supervise.cjs').supervise(path.join(out,'containment'),[process.execPath,__filename,'--body',path.join(out,'native')],{deadline:c.now()+55,cleanup_deadline:c.now()+65,grace:2});assert.equal(r.exit,0);assert.equal(r.leaked,false);console.log(JSON.stringify({pass:true,out}));}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
