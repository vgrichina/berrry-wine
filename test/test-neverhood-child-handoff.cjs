'use strict';
// Authored ordinary native parent Play -> CreateProcess -> ExitProcess(0),
// child-owned dialogs/input/Quit. No original media or personal-review claim.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),net=require('node:net'),assert=require('node:assert/strict');
const {identity,hash}=require('../lib/cli-child-observation');
const raw=r=>r-0x1000+0x200,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function fixture(parent,parentFailure=false){
  const b=require('./test-vb5-native-dialog-identity.cjs').fixture({simpleButton:true});
  b.writeUInt32LE(0x1c00,raw(0x1960));b.write('CreateProcessA\0',raw(0x1c02));
  b.write('c:\\child.exe\0',raw(0x2800));b.writeUInt32LE(68,raw(0x2900));
  const code=[],e=(...a)=>code.push(...a),push=n=>e(0x68,...u32(n)),call=p=>e(0xff,0x15,...u32(p));
  for(const n of [0,0x402300,0,1,0x400000])push(n);call(0x401950);
  if(parent){
    for(const n of [0x402980,0x402900,0,0,0,0,0,0,0x402800,0])push(n);call(0x401960);
    e(0x85,0xc0,0x75,12);push(23);call(0x401900);e(0xcc);
  }else{
    for(const n of [0,0x402400,0,2,0x400000])push(n);call(0x401950);
    push(1000);call(0x401904);
  }
  push(parentFailure?23:0);call(0x401900);e(0xcc);
  b.fill(0,raw(0x2000),raw(0x2300));b.set(code,raw(0x2000));return b;
}
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function run(out,mode='positive'){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
 const parent=path.join(out,'parent.exe'),child=path.join(out,'child.exe');fs.writeFileSync(parent,fixture(true,mode==='parent-failure'));fs.writeFileSync(child,fixture(false));
 const port=await freePort(),childPort=await freePort(),started=Date.now();
 save('launch.json',{rootPort:port,childPort,deadline:started/1000+60,reserveSeconds:10,gameplayCutoff:started/1000+50});
 const pins=['tools/neverhood-original-current-control.py','tools/neverhood-original-current-runtime.py'].map(p=>({path:p,sha256:hash(fs.readFileSync(p))}));
 save('runtime-inputs.json',{sources:pins});
 // Independent deadline process is armed and observable before native spawn.
 const watchdog=cp.spawn(process.execPath,['-e',`let pid;const t=setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGTERM')}catch{};process.exit(2)},65000);console.log('ARMED');process.stdin.on('data',b=>pid=Number(b));process.stdin.on('end',()=>clearTimeout(t));`],{stdio:['pipe','pipe','pipe']});
 let wdOut='',wdErr='';watchdog.stdout.on('data',b=>wdOut+=b);watchdog.stderr.on('data',b=>wdErr+=b);
 const wdClose=new Promise(r=>watchdog.once('close',r));while(!wdOut.includes('ARMED'))await pause(2);
 save('watchdog-armed.json',{pid:watchdog.pid,at:Date.now(),beforeNativeSpawn:true,independent:true});
 const args=['test/run.js','--exe='+parent,'--exe-guest-path=c:\\parent.exe','--vfs-mount='+child+'=c:\\child.exe',
  '--no-build','--no-close','--spawn-processes','--threads','--real-ticks','--png-canvas','--screen=800x600',
  '--control='+port,'--pipe-child-args=--control='+childPort+' --threads --real-ticks --png-canvas --no-close',
  '--max-seconds=60','--max-batches=1000000000','--stuck-after=0','--quiet-api','--quiet-blocks'];
 const p=cp.spawn(process.execPath,args,{detached:true,stdio:['ignore','pipe','pipe'],env:{...process.env,WINE_COM_PROTOCOL_DIR:path.join(out,'children')}});
 watchdog.stdin.write(String(p.pid));let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);
 const closed=new Promise(r=>p.once('close',(exit,signal)=>{save('native-wait.json',{...identityAtSpawn,exit,signal,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded,atWaitMono:performance.now()/1000});r();}));
 const identityAtSpawn=identity(p.pid);save('native-pid.json',identityAtSpawn);
 let ordinal=0;
 async function ctl(argv,targetPort=port,expected=0){
  const c=cp.spawn('python3',['-B','tools/neverhood-original-current-control.py',...argv],{env:{...process.env,NEVERHOOD_CURRENT_RUN:out,NEVERHOOD_CURRENT_PORT:String(targetPort)},stdio:['ignore','pipe','pipe']});
  let a='',b='';c.stdout.on('data',v=>a+=v);c.stderr.on('data',v=>b+=v);
  const status=await new Promise(r=>c.once('close',r));save('controller-'+(++ordinal)+'-wait.json',{args:argv,pid:c.pid,exit:status,actualWait:true,stdoutEOF:c.stdout.readableEnded,stderrEOF:c.stderr.readableEnded,stdout:a,stderr:b});
  assert.equal(status,expected,b);return a;
 }
 try{
  while(!stdout.includes('http://127.0.0.1:')){assert(Date.now()<started+15000,stderr);await pause(10);}
  await ctl(['capture','launcher']);
  const s=JSON.parse(fs.readFileSync(path.join(out,'launcher.json'))).snapshot;
  const button=s.windows.find(w=>w.isChild&&w.controlClass===1&&w.title==='OK');assert(button);
  await ctl(['play-handoff','launcher','Authored complete native launcher control','OK','install',button.hwnd,'play',String(button.x+5),String(button.y+5),'c:\\child.exe',hash(fs.readFileSync(child))],port,mode==='parent-failure'?1:0);
  if(mode==='parent-failure'){
   assert.equal(JSON.parse(fs.readFileSync(path.join(out,'play-child-lifecycle/parent-exit.json'))).exitCode,23);
   const before=fs.readFileSync(path.join(out,'requests.jsonl'),'utf8');
   assert(before.trim().split('\n').map(JSON.parse).every(r=>r.port===port),'no child transport after parent failure');
   await ctl(['capture','after-unknown'],port,1);assert.equal(fs.readFileSync(path.join(out,'requests.jsonl'),'utf8'),before);
   save('failure-proof.json',{passed:true,actualNativeParentExit:23,UNKNOWNZeroLaterTransport:true,noChildInputOrBinding:true});
   return;
  }
  const proof=JSON.parse(fs.readFileSync(path.join(out,'play-observation.json')));
  assert(proof.authenticatedChild&&proof.noPostInputParentSnapshot);assert.equal(proof.parentExit.exitCode,0);
  assert.notEqual(proof.child.child.pid,p.pid);assert(proof.attestation.readiness.ordinaryOwner.actorContext);
  const records=fs.readFileSync(path.join(out,'requests.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const down=records.findIndex(r=>r.action==='guarded-input');assert(down>=0);
  assert(records.slice(down+1).filter(r=>r.port===port).every(r=>r.action==='guarded-release'));
  require('./test-cli-child-observation.cjs').negative(out,path.join(out,'negative-refusals'));
  if(mode==='child-cancellation'){
   const target=JSON.parse(fs.readFileSync(path.join(out,'child-target.json')));
   process.kill(target.child.pid,'SIGTERM');await closed;
   const failure=JSON.parse(fs.readFileSync(path.join(out,'play-child-lifecycle/failure.json')));
   assert.match(failure.reason,/host cancellation/);
   const before=fs.readFileSync(path.join(out,'requests.jsonl'),'utf8');
   await ctl(['capture','after-cancel'],childPort,1);await ctl(['capture','after-unknown'],childPort,1);
   assert.equal(fs.readFileSync(path.join(out,'requests.jsonl'),'utf8'),before);
   save('failure-proof.json',{passed:true,actualChildHostCancellation:true,UNKNOWNZeroLaterTransport:true,hostCleanupDistinctFromQuit:true});
   return;
  }
  let scene='play-after';
  for(const [name,kind]of [['child-action','game'],['child-quit','quit']]){
   if(scene!=='play-after')await ctl(['capture',scene],childPort);
   const snap=JSON.parse(fs.readFileSync(path.join(out,scene+'.json'))).snapshot;
   const w=snap.windows.find(w=>w.isChild&&w.controlClass===1&&w.title==='OK');assert(w);
   await ctl(['review-intent',scene,'Authored full child native dialog','OK',kind,w.hwnd,name,String(w.x+5),String(w.y+5)],childPort);
   scene='child-second';
  }
  await closed;assert.equal(p.exitCode,0,stderr);assert(!p.signalCode);
  assert(!fs.existsSync(path.join(out,'PERMANENT-UNKNOWN.json')));
  save('handoff-proof.json',{passed:true,originalStarted:false,ordinaryCreateProcess:true,parentExit0:true,childOwnedSourceModuleProcessUSER:true,
    publicChildScene:true,independentNativeChildInputAndUP:true,nativeChildQuit:true,zeroPostPlayParentSnapshots:true,args,
    moduleSHA256:hash(fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||'build/wine-assembly.wasm')),
    runnerSHA256:hash(fs.readFileSync('test/run.js')),bridgeSHA256:hash(fs.readFileSync('lib/cli-child-observation.js'))});
 }finally{
  if(p.exitCode===null&&p.signalCode===null)try{process.kill(-p.pid,'SIGTERM');}catch{}
  await closed;fs.writeFileSync(path.join(out,'native.stdout.log'),stdout);fs.writeFileSync(path.join(out,'native.stderr.log'),stderr);
  watchdog.stdin.end();await wdClose;save('watchdog-wait.json',{pid:watchdog.pid,exit:watchdog.exitCode,signal:watchdog.signalCode,actualWait:true,stdoutEOF:watchdog.stdout.readableEnded,stderrEOF:watchdog.stderr.readableEnded,stdout:wdOut,stderr:wdErr});
 }
 console.log('PASS actual native Play/CreateProcess/parent Exit0/child survives; child module/source/USER scene, independent input+UP, native child Quit0, real waits+both EOF');
}
module.exports={fixture,run};
if(require.main===module)run(path.resolve(process.argv[2]),process.argv[3]||'positive').catch(e=>{console.error(e);process.exitCode=1;});
