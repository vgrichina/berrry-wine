'use strict';
// Offline transport fixture: actual retained authority and ThreadManager, no guest.
const fs=require('fs'),assert=require('assert'),wt=require('worker_threads');
const ROOT='/home/user/shadow-man-tools-ready-oct22/runtime';
const originalEmit=wt.Worker.prototype.emit;
wt.Worker.prototype.emit=function(name,...args){
  if(name==='error')console.log(JSON.stringify({kind:'actual-worker-error',pid:process.pid,code:args[0].code,path:args[0].path,stack:args[0].stack}));
  return originalEmit.call(this,name,...args);
};
const {ThreadManager}=require(ROOT+'/lib/thread-manager');
const {NamedEventClient}=require(ROOT+'/lib/named-event-authority');
async function main(){
  let env;
  try { env=ThreadManager.namedEventEnvironment(); }
  catch(e){console.log(JSON.stringify({kind:'actual-named-environment-failure',code:e.code,stack:e.stack}));await new Promise(r=>setTimeout(r,150));return;}
  const endpoint=JSON.parse(env.WINE_NAMED_EVENT_ENDPOINT);
  assert(endpoint.path.startsWith(process.env.TMPDIR+'/'));
  for(const k of ['TMPDIR','TMP','TEMP'])assert.equal(env[k],process.env[k]);
  const client=new NamedEventClient(endpoint);
  const a=client.create('worker-preload-fixture',false,false);
  assert.equal(client.acquire(a.handle),false);
  assert.equal(client.set(a.handle),true);
  assert.equal(client.acquire(a.handle),true);
  assert.equal(client.acquire(a.handle),false);
  assert.equal(client.reset(a.handle),true);
  const b=client.open('worker-preload-fixture');assert.equal(a.generation,b.generation);
  client.close(b.handle);client.close(a.handle);client.shutdown();
  console.log(JSON.stringify({kind:'actual-authority-requests-pass',pid:process.pid,endpoint,execArgv:process.execArgv,requests:['hello','create','acquire-false','set','acquire-true','acquire-false','reset','open','close','shutdown']}));
  if(process.argv.includes('--fork-fixture')){
    const cp=require('child_process');
    const child=cp.fork(__dirname+'/png-child.cjs',['--exe='+__filename,'--wasm='+ROOT+'/build/wine-assembly.wasm','--spawned-child','--real-ticks'],{env,stdio:['ignore','inherit','inherit','ipc']});
    await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>{assert.equal(code,0);assert.equal(signal,null);resolve();});});
    const out=__dirname, rows=fs.readFileSync(out+'/child-'+child.pid+'.jsonl','utf8').trim().split('\n').map(JSON.parse);
    assert.equal(rows[0].kind,'preload-identity');assert(rows.some(x=>x.kind==='module-instance'));assert(rows.some(x=>x.kind==='node-exit'));
    assert(rows.every(x=>x.pid===child.pid));assert.notEqual(child.pid,process.pid);
    const summary=JSON.parse(fs.readFileSync(out+'/child-'+child.pid+'-summary.json'));
    const {PNG}=require('pngjs');const png=PNG.sync.read(fs.readFileSync(out+'/'+summary.screenshot.name));
    assert.equal(png.width,8);assert.equal(png.height,6);assert.equal(png.data[0],255);
    const stop=JSON.parse(fs.readFileSync(out+'/stop-request.json'));assert.equal(stop.pid,child.pid);assert.equal(stop.reason,'first-child-show-window');
    console.log(JSON.stringify({kind:'real-fork-child-preload-png-pass',parentPid:process.pid,childPid:child.pid,summary,stop,qualification:'Synthetic API boundary and renderer in real fork/preload; no guest execution'}));
  }
}
main().catch(e=>{console.error(e);process.exitCode=1});
