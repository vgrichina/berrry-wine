'use strict';
// Authored ordinary native parent Play -> CreateProcess -> ExitProcess(0),
// child-owned dialogs/input/Quit. No original media or personal-review claim.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),net=require('node:net'),assert=require('node:assert/strict');
const {identity,hash}=require('../lib/cli-child-observation');
const raw=r=>r-0x1000+0x200,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function releaseBeforeExit(b,slot=0x1950,name=0x1c60){
  // Authored guest behavior: a modal may finish on DOWN, but this program
  // remains alive until the actual physical button/Enter release. Sleep's
  // batch-based completion never establishes that release happened.
  assert.equal(b.readUInt32LE(raw(slot)),0,'unused contiguous USER32 IAT slot');
  b.writeUInt32LE(name,raw(slot));b.write('GetAsyncKeyState\0',raw(name+2));
  const at=b.indexOf(Buffer.from([0xff,0x15,...u32(0x401900)]),raw(0x2000));
  assert(at>=raw(0x2000)&&at<raw(0x2300));
  const gate=Buffer.from([1,13].flatMap(key=>[0x6a,key,0xff,0x15,...u32(0x400000+slot),
    0xa9,0,0x80,0,0,0x75,0xf1]));
  b.copy(b,at+gate.length,at,raw(0x2300)-gate.length);gate.copy(b,at);return b;
}
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
  }
  push(parentFailure?23:0);call(0x401900);e(0xcc);
  b.fill(0,raw(0x2000),raw(0x2300));b.set(code,raw(0x2000));
  if(!parent)releaseBeforeExit(b,0x1964);
  visibleDialog(b,parent);
  return b;
}
// This guest owns its initial presentation. The old identity-only DLGPROCs
// swallowed every message, including WM_PAINT, without drawing anything.
// Use ordinary synchronous USER painting from WM_INITDIALOG; the controller
// neither dispatches guest callbacks nor pumps or paints the guest.
function visibleDialog(b,parent){
  if(!parent){
    for(const [old,title]of [['Native DialogBox outer','Child action scene'],['Native DialogBox nested','Child native Quit']]){
      const text=Buffer.from(old,'utf16le'),at=b.indexOf(text);assert(at>=0);
      b.write(title.padEnd(old.length),at,'utf16le');
    }
  }
  // Keep the USER32 IAT contiguous even in the parent without an UP gate.
  if(!b.readUInt32LE(raw(0x1964))){b.writeUInt32LE(0x1c60,raw(0x1964));b.write('GetAsyncKeyState\0',raw(0x1c62));}
  const names=['ShowWindow','UpdateWindow','GetDlgItem','BeginPaint','EndPaint','FillRect','DrawTextA'];
  let name=0x1cb0;
  for(const [i,n]of names.entries()){
    b.writeUInt32LE(name,raw(0x1968+i*4));b.write(n+'\0',raw(name+2));name+=n.length+3;
  }
  b.writeUInt32LE(0,raw(0x1984));
  b.write((parent?'Launcher initialized':'Child initialized - action / Quit')+'\0',raw(0x2d00));
  for(const at of [0x2300,0x2400]){
    // Both resource dialogs enter the same ordinary DLGPROC.
    b.fill(0,raw(at),raw(at+0x100));b.set([0xe9,...u32(0x2a00-at-5)],raw(at));
  }
  const code=[],labels={},fix=[];const e=(...v)=>code.push(...v),push=n=>e(0x68,...u32(n));
  const call=i=>e(0xff,0x15,...u32(0x401968+i*4)),label=n=>labels[n]=code.length;
  const j=(op,n)=>{e(...op,0,0,0,0);fix.push([code.length-4,n]);};
  // Preserve nonvolatile registers and hold the callback HWND in EBX.
  e(0x53,0x56,0x8b,0x5c,0x24,12);
  for(const [msg,target]of [[0x110,'init'],[0xf,'paint'],[0x111,'command']]){
    e(0x81,0x7c,0x24,16,...u32(msg));j([0x0f,0x84],target);
  }
  e(0x31,0xc0);j([0xe9],'return');
  label('init');push(5);e(0x53);call(0);e(0x53);call(1);
  for(const id of [100,1]){push(id);e(0x53);call(2);e(0x50);call(1);}
  j([0xe9],'handled');
  label('paint');push(0x402e00);e(0x53);call(3);e(0x89,0xc6);
  // A bounded banner leaves native STATIC/BUTTON control areas untouched.
  for(const [offset,value]of [[0,8],[4,72],[8,320],[12,94]])b.writeInt32LE(value,raw(0x2e80+offset));
  push(6);push(0x402e80);e(0x56);call(5);
  push(0x20);push(0x402e80);push(-1);push(0x402d00);e(0x56);call(6);
  push(0x402e00);e(0x53);call(4);j([0xe9],'handled');
  label('command');push(1);e(0x53,0xff,0x15,...u32(0x401954));
  label('handled');e(0xb8,1,0,0,0);
  label('return');e(0x5e,0x5b,0xc2,16,0);
  for(const [at,n]of fix){const v=Buffer.alloc(4);v.writeInt32LE(labels[n]-at-4);for(let i=0;i<4;i++)code[at+i]=v[i];}
  assert(code.length<0x300);b.set(code,raw(0x2a00));
}
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
function waitPublication(out){
 fs.mkdirSync(out,{recursive:true});
 const oldRevision='d97dc35ad63c75abe188b14745439325c5197020';
 const old=cp.execFileSync('git',['show',oldRevision+':test/run.js'],{encoding:'utf8'});
 const current=fs.readFileSync('test/run.js','utf8'),results=[];
 const waited=cp.spawnSync(process.execPath,['-e','process.exit(0)']);assert.equal(waited.status,0);
 for(const [label,source]of [['old',old],['fixed',current]]){
  const directory=path.join(out,label);fs.mkdirSync(directory);
  const target=path.join(directory,`native-child-${process.pid}-${waited.pid}-wait.json`);
  const samples=[],errors=[],childWait={pid:waited.pid,actualWait:false,stdoutEOF:false,stderrEOF:false,closed:false};
  let failWrite=false;
  const instrumented=Object.create(fs);
  instrumented.writeFileSync=(file,data,options)=>{
   const bytes=Buffer.from(data),half=Math.floor(bytes.length/2);
   if(typeof file==='number')fs.writeSync(file,bytes.subarray(0,half));
   else fs.writeFileSync(file,bytes.subarray(0,half),options);
   // Sample from a real independent process while the production writer is
   // halfway through its write. No timing guess or controller retry is needed.
   const reader=cp.spawnSync('python3',['-B','-c',`import pathlib,json,sys,hashlib
p=pathlib.Path(sys.argv[1]);r={'exists':p.exists(),'valid':True}
if r['exists']:
 b=p.read_bytes();r['sha256']=hashlib.sha256(b).hexdigest()
 try:r['value']=json.loads(b)
 except (ValueError,UnicodeDecodeError):r['valid']=False
print(json.dumps(r))`,target],{encoding:'utf8'});
   assert.equal(reader.status,0,reader.stderr);
   samples.push({...JSON.parse(reader.stdout),pid:reader.pid,actualWait:true,stdoutEOF:true,stderrEOF:true});
   if(failWrite)throw Error('authored partial write failure');
   if(typeof file==='number')fs.writeSync(file,bytes.subarray(half));
   else fs.appendFileSync(file,bytes.subarray(half));
  };
  const begin=source.indexOf('      const saveChildWait = () => {');
  const end=source.indexOf("      child.once('exit'",begin);assert(begin>=0&&end>begin);
  const callback=source.slice(begin,end);
  const publish=new Function('fs','path','waitDirectory','childWait','child','console',callback+';return saveChildWait;')(
   instrumented,path,directory,childWait,{pid:waited.pid},{error:e=>errors.push(e)});
  for(const state of [{},{actualWait:true,exit:0,signal:null},{stdoutEOF:true,stderrEOF:true,closed:true}]){
   Object.assign(childWait,state);publish();assert.deepEqual(JSON.parse(fs.readFileSync(target)),childWait);
  }
  const before=fs.readFileSync(target);failWrite=true;publish();
  if(label==='fixed'){
   assert.deepEqual(fs.readFileSync(target),before,'failed replacement preserves the last complete receipt');
   assert(!fs.readdirSync(directory).some(n=>n.endsWith('.pending')));
   assert(samples.every(r=>r.valid),'no partial version is ever published');
  }else assert(samples.some(r=>!r.valid),'old production callback must reproduce the partial JSON race');
  assert.equal(errors.length,1);
  results.push({label,callbackSHA256:hash(Buffer.from(callback)),samples,unsafeReads:samples.filter(r=>!r.valid).length,
   failedReplacementPreservesCompleteVersion:label==='fixed'});
 }
 fs.writeFileSync(path.join(out,'wait-publication-proof.json'),JSON.stringify({passed:true,oldRevision,
  realOSChildWait:{pid:waited.pid,exit:waited.status,actualWait:true,stdoutEOF:true,stderrEOF:true},
  actualProductionCallbacks:true,independentReaderAtPartialWrite:true,results},null,2)+'\n',{flag:'wx'});
 console.log('PASS exact old production callback publishes partial JSON; atomic replacement keeps complete old/new versions and preserves old receipt on failed write; independent OS readers/waits');
}
async function run(out,mode='positive'){
 if(mode==='wait-publication')return waitPublication(out);
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
module.exports={fixture,run,releaseBeforeExit};
if(require.main===module)run(path.resolve(process.argv[2]),process.argv[3]||'positive').catch(e=>{console.error(e);process.exitCode=1;});
