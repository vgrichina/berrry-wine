#!/usr/bin/env node
'use strict';
/* Real process lifecycle regressions; no game media or guest input.
Node port of the former test/test-neverhood-runtime-lifecycle.py (same modes:
components, listener, native, outer-child, outer, test). */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),net=require('node:net');
const assert=require('node:assert');
const ROOT=path.resolve(__dirname,'..');
const m=require('../tools/neverhood-original-current-runtime.js');
const proc=require('../tools/native-proc.cjs');
const sleep=proc.sleep;
const expectFail=async(f,match,why)=>{
  try{await f();}catch(e){if(!(e instanceof assert.AssertionError))throw e;if(match)assert(e.message.includes(match),e.message);return;}
  throw new assert.AssertionError({message:why});
};
async function until(p){
  const end=proc.monotonic()+10;
  while(!fs.existsSync(p)){assert(proc.monotonic()<end,p);await sleep(10);}
  return JSON.parse(fs.readFileSync(p,'utf8'));
}
// Temporarily replace process environment entries (unittest.mock.patch.dict).
async function withEnv(vars,f){
  const old=Object.fromEntries(Object.keys(vars).map(k=>[k,process.env[k]]));
  Object.assign(process.env,vars);
  try{return await f();}finally{for(const [k,v]of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
}
async function component_tests(out){
  fs.mkdirSync(out);
  const name='lib/cli-native-scene.js',revision='63d7b0d0e8d979772a4e527a4d3561b4bdeb3692';
  const expected=m.H.git(ROOT,'show',revision+':'+name);
  const original=fs.readFileSync;
  await withEnv({NEVERHOOD_PUBLISHED_COMPONENTS:JSON.stringify({[name]:revision})},async()=>{
    // A concurrent shared-tree edit of the selected component.
    fs.readFileSync=function(p,...rest){return path.resolve(String(p))===path.join(ROOT,name)?Buffer.from('concurrent shared-tree edit'):original.call(fs,p,...rest);};
    try{
      assert(!fs.readFileSync(path.join(ROOT,name)).equals(expected));
      const actual=m.component_bytes(name);assert(actual.equals(expected));
      assert(m.component_bytes('tools/neverhood-original-current-control.js').equals(original.call(fs,path.join(ROOT,'tools/neverhood-original-current-control.js'))));
      const [pool,index,rows]=m.H.indexed_sources({[name]:actual});
      const manifest={sourceIndexSHA256:m.H.digest(index),sources:rows};
      assert.deepStrictEqual(m.H.validate_sources(pool,manifest),rows);
      const fd=m.H.seal('published-component-test',pool);
      try{const b=Buffer.alloc(pool.length);fs.readSync(fd,b,0,pool.length,0);assert(b.equals(pool));}
      finally{fs.closeSync(fd);}
    }finally{fs.readFileSync=original;}
  });
  await withEnv({NEVERHOOD_PUBLISHED_COMPONENTS:JSON.stringify({'host.js':revision})},()=>
    expectFail(()=>m.component_bytes('host.js'),null,'unapproved component path selected'));
  await withEnv({NEVERHOOD_PUBLISHED_COMPONENTS:JSON.stringify({[name]:'0'.repeat(40)})},()=>
    expectFail(()=>m.component_bytes(name),null,'unpublished component selected'));
  m.save(out,'component-proof.json',{passed:true,publishedRevision:revision,path:name,
    sha256:m.H.digest(expected),sharedDriftExcluded:true,unselectedPathUnchanged:true,
    forbiddenPathRefused:true,unpublishedRevisionRefused:true,sealedInventoryVerified:true});
  console.log('PASS explicit published component under shared-tree drift; sealed inventory, path/ancestry refusals');
}
const listen=port=>new Promise((r,j)=>{const s=net.createServer();s.once('error',j);s.listen(port,'127.0.0.1',()=>r(s));});
const close=s=>new Promise(r=>s.close(r));
async function listener_tests(out){
  fs.mkdirSync(out);
  // Real listener creation between the old FD snapshot and TCP read faithfully
  // reproduces the failed local admission without any HTTP or native input.
  const race=path.join(out,'race');fs.mkdirSync(race);
  const info={pid:process.pid,startToken:proc.token(process.pid)};
  m.save(race,'native-pid.json',info);
  let sock=await listen(0);const port=sock.address().port;
  const before=proc.linux?proc.openFds():null;
  // Use a second socket: listen after the old snapshot, so its inode is new.
  await close(sock);sock=await listen(port);
  const now=proc.listener(process.pid,port);assert(now.listeners===1&&now.owned);
  if(proc.linux)assert(!before.has('socket:['+now.inode+']'));
  const receipt=await m.wait_owned_listener(race,port,1);
  assert(receipt.inode===now.inode&&receipt.tcpBeforeFDs);
  await close(sock);
  // PID alone never admits a socket; the unchanged process creates a real
  // delayed listener, after which matching ownership is required.
  const run=path.join(out,'delayed');fs.mkdirSync(run);
  const code=`setTimeout(()=>require('net').createServer().listen(${port},'127.0.0.1',()=>console.log('listening')),250);setTimeout(()=>{},60000);`;
  const p=cp.spawn(process.execPath,['-e',code],{stdio:['ignore','pipe','pipe']});
  const out_=[],err_=[];p.stdout.on('data',b=>out_.push(b));p.stderr.on('data',b=>err_.push(b));
  const closed=new Promise(r=>p.once('close',(c,s)=>r(c??-os.constants.signals[s])));
  await sleep(50);
  m.save(run,'native-pid.json',{pid:p.pid,startToken:proc.token(p.pid)});
  try{
    const result=await m.wait_owned_listener(run,port,2);
    assert(result.pidWithoutListenerSamples>0&&result.verifiedAt-result.startedAt>=.2);
    const foreign=path.join(out,'foreign');fs.mkdirSync(foreign);m.save(foreign,'native-pid.json',info);
    await expectFail(()=>m.wait_owned_listener(foreign,port,1),'not owned','foreign listener admitted');
    const stale=path.join(out,'stale');fs.mkdirSync(stale);m.save(stale,'native-pid.json',{pid:p.pid,startToken:'wrong'});
    await expectFail(()=>m.wait_owned_listener(stale,port,1),'identity changed','stale PID admitted');
  }finally{
    p.kill('SIGTERM');const exit=await closed;
    m.save(run,'native-wait.json',{exit,actualWait:true,stdoutEOF:true,stderrEOF:true,stdout:Buffer.concat(out_).toString(),stderr:Buffer.concat(err_).toString()});
  }
  const absent=path.join(out,'absent');fs.mkdirSync(absent);m.save(absent,'native-pid.json',info);
  await expectFail(()=>m.wait_owned_listener(absent,port,.05),'deadline','PID alone admitted');
  const closedRun=path.join(out,'unknown');fs.mkdirSync(closedRun);m.save(closedRun,'PERMANENT-UNKNOWN.json',{});
  const original=fs.readFileSync;
  fs.readFileSync=()=>{throw new assert.AssertionError({message:'read after UNKNOWN'});};
  try{await expectFail(()=>m.wait_owned_listener(closedRun,port,1),'permanent UNKNOWN','UNKNOWN read process state');}
  finally{fs.readFileSync=original;}
  const ledgers=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.isDirectory())walk(path.join(d,e.name));else if(e.name==='requests.jsonl')ledgers.push(e.name);}};
  walk(out);assert(!ledgers.length);
  m.save(out,'listener-proof.json',{passed:true,oldOrderRaceReproduced:proc.linux,tcpBeforeFDs:true,
    actualDelayedSocket:true,pidAloneRefused:true,foreignRefused:true,staleIdentityRefused:true,
    UNKNOWNNoReads:true,HTTPRequests:0});
  console.log('PASS real listener sampling race, delayed socket/PID-alone, foreign/stale/deadline/UNKNOWN; zero HTTP');
}
async function main(){
  const mode=process.argv[2],out=path.resolve(process.argv[3]);
  if(mode==='components')return component_tests(out);
  if(mode==='listener')return listener_tests(out);
  if(mode==='native'){
    m.RUN=out;
    const code="process.on('SIGTERM',()=>process.exit(0));console.log('ready');setTimeout(()=>{},60000);";
    m.admit=()=>[{...process.env},[],[process.execPath,'-e',code,'--','--control=1234','--pipe-child-args=--control=1235','--native-invocation-token=fixture']];
    await m.run(out,{});
    return;
  }
  if(mode==='outer-child'){
    m.save(out,'prepared.json',{authoredOnly:true});
    while(!fs.existsSync(path.join(out,'runtime-start.json')))await sleep(5);
    await sleep(300);console.log('authored outer route complete');
    return;
  }
  if(mode==='outer'){
    const rev=m.git('rev-parse','HEAD').toString().trim();
    const g=m.published('tools/gltron-current-supervise.js',rev);
    return new g.ParentProcessSupervisor(out,[process.execPath,__filename,'outer-child',out],{preparation:10,runtime:10,preparation_watchdog:12,runtime_watchdog:12}).run();
  }
  assert(mode==='test');fs.mkdirSync(out);
  for(const sig of ['SIGTERM','SIGINT']){
    const run=path.join(out,sig);fs.mkdirSync(run);
    const p=cp.spawn(process.execPath,[__filename,'native',run],{stdio:['ignore','pipe','pipe']});
    const err=[];p.stderr.on('data',b=>err.push(b));p.stdout.resume();
    const exited=new Promise(r=>p.once('close',c=>r(c)));
    await until(path.join(run,'native-pid.json'));await sleep(100);p.kill(sig);
    const code=await Promise.race([exited,sleep(8000).then(()=>'timeout')]);
    assert(code===0,Buffer.concat(err).toString());
    const wait=await until(path.join(run,'native-wait.json'));
    assert(wait.actualWait&&wait.stdoutEOF&&wait.stderrEOF&&wait.disposition==='host-cancellation');
    assert((await until(path.join(run,'watchdog-wait.json'))).actualWait&&(await until(path.join(run,'runtime-closed.json'))).descriptorsClosed);
  }
  for(const [name,seconds]of [['transient-launcher',10],['owner-deadline',.3],['outer-route',30]]){
    const run=path.join(out,name);fs.mkdirSync(run);
    const child=name==='outer-route'?[process.execPath,__filename,'outer',path.join(run,'outer')]:
      [process.execPath,'-e','setTimeout(()=>{},'+(name==='transient-launcher'?1000:60000)+')'];
    const command=[process.execPath,path.join(ROOT,'tools/neverhood-original-current-runtime.js'),'persistent-owner',run,String(process.pid),proc.token(process.pid),String(seconds),...child];
    // A transient launcher: starts the owner in its own session, waits only
    // for its armed record, then exits (the owner outlives it).
    const code="const cp=require('child_process'),fs=require('fs');const [f,...c]=process.argv.slice(1);const p=cp.spawn(c[0],c.slice(1),{stdio:'ignore',detached:true});p.unref();const end=Date.now()+5000;const t=setInterval(()=>{if(fs.existsSync(f)){clearInterval(t);return;}if(Date.now()>end){clearInterval(t);process.exitCode=1;}},5);";
    const r=cp.spawnSync(process.execPath,['-e',code,path.join(run,'persistent-owner-armed.json'),...command],{timeout:8000,encoding:'utf8'});
    assert(r.status===0,r.stderr);
    const wait=await until(path.join(run,'owner-wait.json'));
    assert(wait.actualWait&&wait.stdoutEOF&&wait.stderrEOF&&wait.workerAlive);
    await until(path.join(run,'owner-watchdog-wait.json'));
    assert((await until(path.join(run,'owner-watchdog-result.json'))).fired===(name==='owner-deadline'));
    assert(wait.exit===(name==='owner-deadline'?-os.constants.signals.SIGTERM:0),JSON.stringify(wait));
    if(name==='outer-route'){
      const w=await until(path.join(run,'outer/wait.json'));
      assert(w.supervisorExitCode===0&&w.actualWait&&w.stdoutEOF&&w.stderrEOF&&!w.remainingAfterRuntime);
      assert(w.watchdogs.every(r=>r.actualWait&&r.stdoutEOF&&r.stderrEOF&&r.returncode===0));
      assert((await until(path.join(run,'outer/parent-process-owner.json'))).parentProcessAliveAtJoin);
    }
  }
  console.log('PASS native TERM/INT finally wait/both EOF; transient launcher; independent owner deadline; actual outer/two watchdogs/empty scope');
}
if(require.main===module)main().then(v=>{if(Number.isInteger(v))process.exitCode=v&0xff;}).catch(e=>{console.error(e&&e.stack||e);process.exitCode=1;});
