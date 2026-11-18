'use strict';
// Self-contained authored Enter -> expensive native work + GDI rendering.
// No original media, historical runs, private input, or altered guard budgets.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),net=require('node:net'),assert=require('node:assert/strict');
const c=require('../tools/native-supervisor-common.cjs'),prep=require('../tools/blood2-immutable-preparation.cjs');
const root=path.resolve(__dirname,'..');
function fixture(){
 const b=require('./test-cli-native-button-delivery.cjs').fixture(0),raw=r=>r-0x1000+0x400;
 const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24],a=[],fix=[],labels=new Map();
 const emit=(...v)=>a.push(...v),push=n=>emit(0x68,...u32(n)),call=n=>emit(0xff,0x15,...u32(n)),label=n=>labels.set(n,a.length);
 const jump=(n,condition)=>{emit(...(condition?[0x0f,condition]:[0xe9]));fix.push([a.length,n]);emit(0,0,0,0);};
 // Existing unused kernel32 thunk -> real GetTickCount, same public API clock.
 b.writeUInt32LE(0x1c00,raw(0x120c));b.write('GetTickCount\0',raw(0x1c02));
 b.write('Enter native loading finished\0',raw(0x3300));
 emit(0x55,0x89,0xe5,0x81,0x7d,12,...u32(0x100));jump('up',0x85);
 emit(0x83,0x7d,16,13);jump('default',0x85);
 // Guest loading computation lasts at least 900 real milliseconds.
 call(0x40120c);emit(0x89,0xc3);label('load');call(0x40120c);emit(0x29,0xd8,0x3d,...u32(900));jump('load',0x82);
 emit(0xff,0x75,8);call(0x401328);emit(0x89,0xc6,0x31,0xff);label('paint');
 // Real GDI calls and composition damage, not a host sleep/mock renderer.
 push(0x19324b);emit(0x89,0xf8,0xc1,0xe8,6,0x50,0x89,0xf8,0x83,0xe0,63,0x50,0x56);call(0x401400);
 emit(0x47,0x81,0xff,...u32(4096));jump('paint',0x82);
 push(0x403300);emit(0xff,0x75,8);call(0x40131c);jump('zero');
 label('up');emit(0x81,0x7d,12,...u32(0x101));jump('default',0x85);emit(0x83,0x7d,16,27);jump('default',0x85);push(0);call(0x401320);jump('zero');
 label('default');for(const n of [20,16,12,8])emit(0xff,0x75,n);call(0x401318);emit(0xc9,0xc2,16,0);
 label('zero');emit(0x31,0xc0,0xc9,0xc2,16,0);
 const code=Buffer.from(a);for(const [o,n]of fix)code.writeInt32LE(labels.get(n)-o-4,o);assert(code.length<0x400);b.fill(0,raw(0x2400),raw(0x2800));code.copy(b,raw(0x2400));return b;
}
async function until(predicate,seconds=20){const end=Date.now()+seconds*1000;for(;;){if(await predicate())return;assert(Date.now()<end,'finite authored wait');await c.sleep(25);}}
async function submit(run){
 const module=fs.readFileSync(path.join(root,'build/wine-assembly.wasm'));
 const rows=prep.collect(['tools/blood2-durable-launcher.cjs']);const frozen=prep.freeze(rows,module);
 try{
  c.save(run,'rendering-preflight.json',prep.renderingPreflight(frozen));
  c.save(run,'runtime-inputs.json',{git:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),moduleSHA256:c.sha256(module),sourceSHA256:frozen.sourceSHA256,indexSHA256:frozen.indexSHA256,sources:rows.map(({body,...r})=>r)});
  fs.writeFileSync(path.join(run,'runtime-source.patch'),cp.execFileSync('git',['diff','--binary','--','lib','tools','src','host.js','test/run.js','fonts','test/candidate-corpus/manifest.json'],{maxBuffer:16e6}));
  const tracked=new Set(cp.execFileSync('git',['ls-files','lib','tools'],{encoding:'utf8'}).trim().split('\n'));
  const patches=[];for(const row of rows)if(!tracked.has(row.path)&&/^(lib|tools)\//.test(row.path)){
   const d=cp.spawnSync('git',['diff','--no-index','--binary','--','/dev/null',row.path]);assert.equal(d.status,1);patches.push(d.stdout);
  }
  fs.writeFileSync(path.join(run,'new-inputs.patch'),Buffer.concat(patches));
  const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
  c.save(run,'endpoint.json',{url:'http://127.0.0.1:'+port+'/ctl'});
  const at=c.now(),deadline=at+230;
  c.save(run,'launch.json',{at,deadline,gameplayCutoff:deadline-180,reserveSeconds:180,nativeScene:true,inputPolicy:{confirmationMs:500,physicalUpMs:1750,observationMs:3000,gameFreshnessSeconds:5,menuFreshnessSeconds:30}});
  const command=[process.execPath,'test/run.js','--exe='+path.join(run,'authored.exe'),'--no-build','--threads','--real-ticks','--screen=1024x712','--max-seconds=35','--max-batches=100000000','--stuck-after=0','--control='+port,'--quiet-api','--quiet-blocks','--no-close'];
  require('../tools/blood2-durable-launcher.cjs').launch({run,command,fds:frozen.fds,deadline:at+40,cleanupDeadline:at+48,env:{...frozen.env,LMARBLES_SOURCE_OBSERVE:run,WINE_PUBLIC_INPUT_TRACE:path.join(run,'input-trace.jsonl'),WINE_CONTROL_PHASE_TRACE:path.join(run,'control-phases.json')}});
  c.save(run,'submitter-ready.json',{pid:process.pid,at:c.now()});
  await new Promise(()=>setInterval(()=>{},1000));
 }finally{frozen.close();}
}
async function control(run,signal){
 fs.mkdirSync(run,{recursive:true});fs.writeFileSync(path.join(run,'authored.exe'),fixture(),{flag:'wx'});
 const submitter=cp.spawn(process.execPath,[__filename,'--submit',run],{cwd:root,stdio:['ignore','pipe','pipe'],detached:true});
 const sw=c.communicate(submitter);let waited=false;
 try{
  await until(()=>fs.existsSync(path.join(run,'submitter-ready.json')));
  await until(()=>fs.existsSync(path.join(run,'native-pid.json')));
  submitter.kill(signal);const wait=await sw;waited=true;
  c.save(run,'submitter-wait.json',{signal,exit:wait.returncode,actualWait:true,stdoutEOF:submitter.stdout.readableEnded,stderrEOF:submitter.stderr.readableEnded,stdout:wait.stdout.toString(),stderr:wait.stderr.toString()});
  assert.equal(wait.returncode,signal==='SIGTERM'?-15:-9);
  const a=require('../tools/blood2-reviewed-input.cjs');a.R=run;a.URL=c.readJSON(path.join(run,'endpoint.json')).url;
  await until(async()=>{try{const s=await a.call({action:'snapshot'},.5);return s.focusWindow?.live&&s.mainHwnd!=='0x0'&&s.physicalUp;}catch{return false;}});
  await a.capture('before');const rr=a.read('before.json');a.save('before-review.json',{at:c.now(),pngSHA256:rr.pngSHA256,scene:'menu',observation:'Automated authored fixture only'});await a.bind('before');
  await a.pulse('enter',['keydown:13'],100,'before','Authored native loading and GDI rendering');
  const down=a.read('enter-down.json')[0],up=a.read('enter-up.json');
  assert(down.consumed&&down.nativeMessage.wParam===13);assert.equal(down.nativeMessage.consumption,'owner-user-return');assert(down.consumedAt/1000-a.read('enter-dispatch.json').at<.5);assert.equal(up.state,'ACK');assert(up.at-down.consumedAt/1000<1.75);
  await until(async()=>{const s=await a.call({action:'snapshot'},.5);return s.windows.some(w=>w.title==='Enter native loading finished');},5);
  await a.capture('loaded');
  // Explicit terminal controller test forbids even transport entry.
  a.save('terminal-input-failure.json',{noReplay:true,reason:'authored closed scope'});const post=c.postJSON;let calls=0;c.postJSON=async()=>{calls++;throw Error('endpoint after close');};
  try{await assert.rejects(a.capture('forbidden'),/sticky UNKNOWN/);assert.equal(calls,0);}finally{c.postJSON=post;}
  a.save('assertions.json',{pass:true,signal,detachedOwnerSurvived:true,sameImmutablePreparation:true,realEnterNativeConsumed:true,actualExpensiveGuestLoadAndGDI:true,unchangedGuards:true,terminalNoEndpoint:true,originalCauseEstablished:false});
 }finally{
  if(!waited){submitter.kill('SIGKILL');await sw;}
  if(!fs.existsSync(path.join(run,'native-wait.json')))c.save(run,'cancel-request.json',{at:c.now(),workerOwned:true});
  await until(()=>fs.existsSync(path.join(run,'owner-complete.json')),55);
  for(const name of ['native','watchdog']){const w=c.readJSON(path.join(run,name+'-wait.json'));assert(w.actualWait&&w.stdoutEOF&&w.stderrEOF);assert.deepEqual(w.drainErrors,[]);assert.equal(w.exit,0);}
  const receipt=c.readJSON(path.join(run,'containment/receipt.json'));assert.equal(receipt.leaked,false);assert.equal(receipt.exit,0);
  assert(c.readJSON(path.join(run,'owner-complete.json')).retainedActualWaits);
 }
 const down=c.readJSON(path.join(run,'enter-receipt.json')),dispatch=c.readJSON(path.join(run,'enter-dispatch.json'));
 const phases=c.readJSON(path.join(run,'control-phases.json')).rows;
 const request=phases.find(r=>r.nonce===down.nonce);assert(request);
 const response=phases.find(r=>r.id===request.id&&r.phase==='response-end');assert(response);
 const trace=fs.readFileSync(path.join(run,'input-trace.jsonl'),'utf8').trim().split('\n').map(JSON.parse).filter(r=>r.kind==='public-input-pump'&&r.nonce===down.nonce).at(-1);
 const native=trace.rows.find(r=>r.phase==='native-input-return-candidate'),settle=trace.rows.find(r=>r.phase==='settle');assert(native&&settle);
 assert(down.appliedAt<=down.consumedAt&&native.at<=settle.at+.5);
 assert(response.at-dispatch.at*1000<500);
 const loaded=c.readJSON(path.join(run,'loaded.json'));assert(loaded.at*1000-down.consumedAt>=850,'real native loading follows consumption');
 c.save(run,'causal-analysis.json',{originalCauseEstablished:false,authoredFailureReproduced:false,
  dispatchAt:dispatch.at*1000,requestAt:request.at,hostAppliedAt:down.appliedAt,nativeConsumedAt:down.consumedAt,responseEndAt:response.at,
  confirmationMs:response.at-dispatch.at*1000,loadingCompletedCaptureAt:loaded.at*1000,
  conclusion:'Native Enter consumption and HTTP confirmation precede the completed native loading/rendered scene; expensive loading alone did not reproduce the original failure.'});
}
async function main(){const run=path.resolve(process.argv[3]||fs.mkdtempSync(path.join(os.tmpdir(),'blood2-loading-')));if(process.argv[2]==='--submit')return submit(run);fs.mkdirSync(run,{recursive:true});for(const signal of ['SIGTERM','SIGKILL'])await control(path.join(run,signal),signal);console.log(JSON.stringify({pass:true,run}));}
module.exports={fixture};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
