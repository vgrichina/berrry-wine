'use strict';
// AoWII receipt custody is detached from the submitting command. The native
// supervisor remains authoritative: detachment changes ancestry, not budgets.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const c=require('./native-supervisor-common.cjs'),np=require('./native-proc.cjs');
const root=path.resolve(__dirname,'..');
function identity(pid){const p=np.processes().find(p=>p.pid===pid);assert(p,'live owned process');return {pid,startToken:np.token(pid),pgid:p.pgid,at:c.now()};}
function launch({run,driver,args=[],duration=900,cleanup=920}){
 run=path.resolve(run);driver=path.resolve(driver);fs.mkdirSync(run,{recursive:true});
 assert(c.freeBytes()>1500000000);assert(fs.statSync(driver).isFile());
 assert(duration>0&&duration<=900&&cleanup>duration+5&&cleanup<=920);
 assert(args.every(a=>typeof a==='string'));
 const at=c.now();c.save(run,'config.json',{driver,args,at,deadline:at+duration,cleanupDeadline:at+cleanup,reserveSeconds:180,gameplayCutoff:at+duration-180});
 const out=fs.openSync(path.join(run,'owner.stdout.log'),'wx'),err=fs.openSync(path.join(run,'owner.stderr.log'),'wx');
 try{const p=cp.spawn(process.execPath,[__filename,'owner',run],{cwd:root,detached:true,stdio:['ignore',out,err]});p.unref();const row={...identity(p.pid),detached:true,submitter:identity(process.pid)};c.save(run,'owner-process.json',row);return row;}
 finally{fs.closeSync(out);fs.closeSync(err);}
}
function retain(p,run,name){
 c.save(run,name+'-process.json',identity(p.pid));
 const streams=['stdout','stderr'].map(n=>new Promise((resolve,reject)=>{const fd=fs.openSync(path.join(run,name+'.'+n+'.log'),'wx');let bytes=0;p[n].on('data',b=>{fs.writeSync(fd,b);bytes+=b.length;});p[n].once('error',reject);p[n].once('end',()=>{fs.fsyncSync(fd);fs.closeSync(fd);c.save(run,name+'-'+n+'-eof.json',{actualEOF:true,bytes});resolve();});}));
 return new Promise((resolve,reject)=>{p.once('error',reject);p.once('close',async(exit,signal)=>{try{await Promise.all(streams);const r={exit,signal,at:c.now(),actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded};c.save(run,name+'-wait.json',r);resolve(r);}catch(e){reject(e);}});});
}
async function watchdog(run,cfg){
 c.save(run,'watchdog-armed.json',{...identity(process.pid),independent:true,deadline:cfg.cleanupDeadline,diskFloor:1500000000});
 let minimum=Infinity,reason=null;const known=new Map();
 for(;;){minimum=Math.min(minimum,c.freeBytes());
  const rows=np.processes(),nativeFile=path.join(run,'native-process.json');
  if(c.exists(nativeFile)){const n=c.readJSON(nativeFile);if(rows.some(r=>r.pid===n.pid&&r.startToken===n.startToken))known.set(n.pid,n.startToken);}
  for(let pass=0;pass<8;pass++)for(const row of rows)if(known.has(row.ppid)&&known.get(row.ppid)===rows.find(p=>p.pid===row.ppid)?.startToken)known.set(row.pid,row.startToken);
  if(c.exists(path.join(run,'watchdog-cancel'))){c.save(run,'watchdog-result.json',{reason,minimum,cancelled:true});return;}
  if(!reason&&minimum<1500000000){reason='disk-floor';const o=c.readJSON(path.join(run,'owner-process.json'));if(np.token(o.pid)===o.startToken)process.kill(o.pid,'SIGTERM');}
  if(c.now()>=cfg.cleanupDeadline){reason||='independent-920s-deadline';const killed=[];
   // Native-supervise owns the exact descendant inventory and process group.
   // The independent backstop only signals identities recorded by this scope.
   for(const [pid,startToken]of known){try{if(np.token(pid)===startToken){process.kill(pid,'SIGKILL');killed.push({pid,startToken});}}catch(e){if(!['ENOENT','ESRCH'].includes(e.code))throw e;}}
   c.save(run,'watchdog-result.json',{reason,minimum,killed,cancelled:false});return;
  }
  await c.sleep(50);
 }
}
async function native(run,cfg){
 c.save(run,'native-process.json',identity(process.pid));
 const profile=fs.mkdtempSync('/dev/shm/aow-durable-');c.save(run,'profile.json',{profile});
 const chrome=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','pipe','pipe']});const cw=retain(chrome,run,'chrome');
 let driver,dw;const term=()=>{c.exists(path.join(run,'native-signal.json'))||c.save(run,'native-signal.json',{signal:'SIGTERM',at:c.now(),sender:'UNKNOWN'});driver?.kill('SIGTERM');chrome.kill('SIGTERM');};process.on('SIGTERM',term);
 try{let endpoint;for(let i=0;i<1000;i++){if(c.exists(profile+'/DevToolsActivePort')){const p=fs.readFileSync(profile+'/DevToolsActivePort','utf8').trim().split('\n');endpoint='ws://127.0.0.1:'+p[0]+p[1];break;}assert(chrome.exitCode===null,'Chrome exited');await c.sleep(10);}assert(endpoint,'Chrome endpoint deadline');
  c.save(run,'browser.json',{pid:chrome.pid,endpoint,profile});
  driver=cp.spawn(process.execPath,[cfg.driver,...cfg.args],{cwd:root,env:{...process.env,AOW_BROWSER_ENDPOINT:endpoint,AOW_CUSTODY_OUT:run,AOW_NATIVE_DEADLINE:String(cfg.deadline),AOW_GAMEPLAY_CUTOFF:String(cfg.gameplayCutoff)},stdio:['ignore','pipe','pipe']});dw=retain(driver,run,'driver');const r=await dw;chrome.kill('SIGTERM');await cw;process.exitCode=r.exit??1;
 }finally{chrome.kill('SIGTERM');await cw;if(driver&&driver.exitCode===null&&driver.signalCode===null){driver.kill('SIGTERM');await dw;}
  const hashes=fs.readdirSync(run).filter(n=>/-wait.json$|-eof.json$/.test(n)).map(n=>({path:n,sha256:c.sha256(fs.readFileSync(path.join(run,n)))}));c.save(run,'custody-hashes.json',hashes);fs.rmSync(profile,{recursive:true,force:true});c.save(run,'profile-cleanup.json',{profile,removed:!c.exists(profile),afterRetainedWaits:true});process.removeListener('SIGTERM',term);
 }
}
async function main(mode,run){
 const cfg=c.readJSON(path.join(run,'config.json'));
 if(mode==='watchdog')return watchdog(run,cfg);if(mode==='native')return native(run,cfg);assert.equal(mode,'owner');
 const w=cp.spawn(process.execPath,[__filename,'watchdog',run],{detached:true,stdio:['ignore','pipe','pipe']}),ww=retain(w,run,'watchdog');
 while(!c.exists(path.join(run,'watchdog-armed.json')))await c.sleep(10);
 const cancel=setInterval(()=>{if(c.exists(path.join(run,'cancel-request.json')))process.kill(process.pid,'SIGTERM');},100);
 try{const receipt=await require('./native-supervise.cjs').supervise(path.join(run,'native'),[process.execPath,__filename,'native',run],{deadline:cfg.deadline,cleanup_deadline:cfg.cleanupDeadline,env:process.env,cwd:root});
  clearInterval(cancel);fs.writeFileSync(path.join(run,'watchdog-cancel'),'');await ww;c.save(run,'owner-complete.json',{receipt,actualWatchdogWait:true,at:c.now()});process.exitCode=require('./native-supervise.cjs').exitStatus(receipt);
 }finally{clearInterval(cancel);}
}
module.exports={launch,retain,identity,main};
if(require.main===module)main(...process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
