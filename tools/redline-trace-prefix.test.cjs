'use strict';
// Offline: actual inert executables through shipped launch/retrieve, no Chrome.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),Module=require('node:module');
const {once}=require('node:events'),{performance}=require('node:perf_hooks');
const trace=require('./redline-native-trace.cjs');
const base=path.resolve(process.env.REDLINE_PREFIX_TEST_RUN||'scratch/runs/20261109-redline-startup-trace-prefix-repair-1455/controls');
const sha=b=>require('node:crypto').createHash('sha256').update(b).digest('hex');
function candidate(source){
  const before="  const file=path.join(out,'native-startup-trace.json');\n  try{\n    assert(receipt.actualBrowserExit&&receipt.streamEOF";
  const after=`  const file=path.join(out,'native-startup-trace.json');
  // Retain a bounded byte observation even when cleanup/JSON validation fails.
  // This snapshot is neither EOF nor a complete/valid trace, including when
  // inherited writers can still append. Never parse or repair partial events.
  let prefix;
  let fd;
  try{
    fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NONBLOCK|fs.constants.O_NOFOLLOW);
    const stat=fs.fstatSync(fd);assert(stat.isFile(),'regular trace required');
    const buffer=Buffer.alloc(Math.min(stat.size,64*1024));let length=0;
    while(length<buffer.length){const n=fs.readSync(fd,buffer,length,buffer.length-length,null);if(!n)break;length+=n;}
    const bytes=buffer.subarray(0,length);
    prefix={bytes:bytes.length,sha256:hash(bytes),dataBase64:bytes.toString('base64'),
      observedFileSize:stat.size,byteCap:64*1024,capped:stat.size>buffer.length,
      snapshotOnly:true,traceCompleteness:'UNKNOWN',streamEOF:receipt.streamEOF===true,
      actualBrowserExit:receipt.actualBrowserExit??null};
  }catch(error){prefix={snapshotOnly:true,error:String(error),traceCompleteness:'UNKNOWN'};}
  finally{if(fd!==undefined)fs.closeSync(fd);}
  try{
    assert(receipt.actualBrowserExit&&receipt.streamEOF`;
  assert.equal(source.split(before).length,2);source=source.replace(before,after);
  source=source.replace('return {file,bytes:bytes.length,sha256:hash(bytes),flushedJSON:true','return {file,prefix,bytes:bytes.length,sha256:hash(bytes),flushedJSON:true');
  source=source.replace('return {file,flushedJSON:false','return {file,prefix,flushedJSON:false');
  return source;
}
function load(source){const m=new Module(path.join(__dirname,'redline-native-trace.cjs'),module);m.filename=path.join(__dirname,'redline-native-trace.cjs');m.paths=module.paths;m._compile(source,m.filename);return m.exports;}
function historicalAudit(){
  const root=path.resolve(__dirname,'..'),run=path.join(root,'scratch/runs/20261109-redline-current-module-startup-fixture-1395');
  const unzip=require('node:zlib').gunzipSync;
  const inventory=JSON.parse(unzip(fs.readFileSync(path.join(run,'fixture-remote-inventory.json.gz'))));
  for(const row of inventory.files){const b=fs.readFileSync(path.join(run,'retrieved',row.path));assert.equal(b.length,row.size);assert.equal(sha(b),row.sha256);}
  const out=path.join(run,'retrieved/native-fixture'),read=n=>JSON.parse(fs.readFileSync(path.join(out,n)));
  const startup=read('chrome-startup.json'),failure=read('first-browser-failure.json'),retrieval=read('native-trace-retrieval.json');
  const diagnostic=JSON.parse(unzip(fs.readFileSync(path.join(out,'startup-boundary.json.gz'))));
  assert.equal(failure.at,'2026-11-09T13:00:25.011Z');assert.equal(startup.elapsedMs,10349);assert.equal(startup.polls,100);
  assert.equal(diagnostic.rows.filter(r=>r.kind==='stat').length,101);assert.equal(diagnostic.rows.filter(r=>r.kind==='read').length,0);
  assert.match(retrieval.error,/joined no-input cleanup required/);
  assert(!inventory.files.some(r=>r.path.endsWith('native-startup-trace.json')));
  const journal=unzip(fs.readFileSync(path.join(run,'retrieved/fixture-custody/custody.ndjson.gz')));
  assert.equal(sha(journal),'7a2b3e74e7022a96ebf614d54f6a53838d64f8a27a05857c48bcc7de72f6070c');
  const rows=journal.toString().trim().split('\n').map(JSON.parse);assert.equal(rows.length,790);
  assert.equal(rows[521].sequence,522);assert.equal(rows[521].siStatus,773);assert.equal(rows[522].kind,'pre-exit-stop');
  const commit='f977ebf7c28977d7d95eb404f43db2209d163dde';
  const published=cp.execFileSync('git',['show',commit+':tools/native_kernel_custody.py']);
  fs.writeFileSync(path.join(base,'historical-audit.json'),JSON.stringify({verified:inventory.files,firstFailure:failure,firstTerminal:diagnostic.firstTerminal,startup,historicalRetrieval:retrieval,
    journal:{bytes:journal.length,sha256:sha(journal),rows:rows.length,sequence522to534:rows.slice(521,534)},publishedLineageDiagnostics:{commit,bytes:published.length,sha256:sha(published)},
    historicalPrefixExistence:'UNKNOWN; absent from retained inventory; old retrieval never inspected file',cause:'UNKNOWN'},null,2));
}
async function run(collector,label,mode,predecessor){
  const out=path.join(base,label,mode);fs.mkdirSync(out,{recursive:true});
  // Independent deadline is armed and observable before launching any fixture.
  const watchdog=cp.spawn(process.execPath,['-e',`let pid;console.log('ARMED');process.stdin.on('data',b=>{for(const s of b.toString().trim().split('\\n')){if(s==='DONE')process.exit(0);pid=Number(s);}});setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGKILL')}catch{};console.log('DEADLINE');process.exit(9)},15000);`],{stdio:['pipe','pipe','pipe']});
  const watchdogExit=once(watchdog,'exit'),watchdogClose=once(watchdog,'close');let watchdogOutput='';watchdog.stdout.on('data',b=>watchdogOutput+=b);watchdog.stderr.resume();
  const armed=await once(watchdog.stdout,'data');assert.match(armed[0].toString(),/ARMED/);
  const executable=path.join(out,'producer.cjs');
  fs.writeFileSync(executable,`#!${process.execPath}\nconst fs=require('node:fs');const file=process.argv.find(a=>a.startsWith('--trace-startup-file=')).split('=').slice(1).join('=');
    fs.writeFileSync(file,${JSON.stringify(mode==='keyboard'?JSON.stringify({traceEvents:['keydown','keyup'].map((type,i)=>({name:'EventDispatch',ph:'X',pid:1,tid:2,ts:100+i*10,dur:1,args:{data:{type}}}))}):mode==='complete'?'\x7b"traceEvents":[]\x7d':'\x7b"traceEvents":[\n{"name":"inert-prefix"},\n{"partial":')});
    ${mode==='inherited'?`require('node:child_process').spawn(process.execPath,['-e',"setTimeout(()=>{},6000)"],{stdio:['ignore',1,2]});`:''}
    process.stdout.write('READY\\n');${['kill','cancel','timeout'].includes(mode)?'process.stdin.resume();':'process.exit(7);'}\n`,{mode:0o700});
  let child,closed;const saves={};let eof=false,exit;
  try{
    child=collector.launch({spawn:cp.spawn,executable,argv:[],options:{detached:true,stdio:['pipe','pipe','pipe']},out,save:(n,v)=>saves[n]=v});
    watchdog.stdin.write(String(child.pid)+'\n');
    const exited=once(child,'exit').then(([code,signal])=>exit={code,signal,at:performance.now()});
    closed=once(child,'close').then(()=>{eof=true;});
    child.stderr.resume();await once(child.stdout,'data');child.stdout.resume();
    let firstTerminal={at:performance.now(),reason:mode},diagnostic;
    if(mode==='timeout'){
      const boundary=require('./redline-startup-boundary.cjs');let flushed;
      diagnostic=boundary.create({write:v=>flushed=v});
      try{await boundary.portPublication({file:path.join(out,'DevToolsActivePort'),exit:exited,evidence:{exit:null,waitError:null},deadline:Date.now()+14000,guard(){},save:(n,v)=>saves[n]=v,diagnostic});assert.fail('must fail readiness');}
      catch(e){assert.match(String(e),/unpublished after 100x100ms poll/);diagnostic.terminal(e);diagnostic.flush();}
      firstTerminal=flushed.firstTerminal;
      assert.equal(flushed.rows.filter(r=>r.kind==='stat').length,101);assert.equal(flushed.rows.filter(r=>r.kind==='read').length,0);
      assert.equal(saves['chrome-startup.json'].polls,100);assert(saves['chrome-startup.json'].elapsedMs>=10000);
      fs.writeFileSync(path.join(out,'startup-boundary.json'),JSON.stringify(flushed));child.kill('SIGTERM');
    }
    const exactTerminal=JSON.stringify(firstTerminal);
    if(mode==='kill')child.kill('SIGKILL');if(mode==='cancel')child.kill('SIGTERM');
    await exited;if(mode!=='inherited')await closed;
    const before=fs.readFileSync(path.join(out,'native-startup-trace.json'));
    const receipt={actualBrowserExit:exit,streamEOF:eof,terminal:firstTerminal};
    const result=collector.retrieve(out,receipt);
    const {prefix,...validation}=result;
    assert.deepEqual(validation,predecessor.retrieve(out,receipt),'every existing validation field unchanged');
    assert.equal(JSON.stringify(firstTerminal),exactTerminal,'collector preserves exact first terminal');
    if(label==='old')assert.equal(result.prefix,undefined,'old prefix evidence lost');
    else{
      assert.equal(result.prefix.sha256,sha(before));assert.equal(result.prefix.dataBase64,before.toString('base64'));
      assert.equal(result.prefix.traceCompleteness,'UNKNOWN');assert.equal(result.prefix.streamEOF,eof);
      assert.equal(result.prefix.snapshotOnly,true);
    }
    assert.equal(result.flushedJSON,['complete','keyboard'].includes(mode));assert.equal(result.validKeyboardBoundary,mode==='keyboard');
    if(mode==='inherited')assert.equal(eof,false,'actual wait separate from inherited stream EOF');
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({label,mode,firstTerminal,receipt,result,saves,watchdogArmed:true},null,2));
    return {label,mode,flushedJSON:result.flushedJSON,retained:!!result.prefix?.sha256,streamEOF:eof};
  }finally{
    if(child)try{process.kill(-child.pid,'SIGKILL');}catch{}
    if(closed)await closed;
    watchdog.stdin.end('DONE\n');const [code,signal]=await watchdogExit;assert.equal(code,0);await watchdogClose;
    fs.writeFileSync(path.join(out,'cleanup.json'),JSON.stringify({watchdogPID:watchdog.pid,watchdogOutput,actualWatchdogWait:{code,signal},watchdogStreamEOF:true,actualChildWait:exit,childStreamEOFAfterCleanup:eof}));
  }
}
async function main(){
  fs.mkdirSync(base,{recursive:true});const source=fs.readFileSync(path.join(__dirname,'redline-native-trace.cjs'),'utf8');
  historicalAudit();
  const old=load(cp.execFileSync('git',['show','8fd1a54210d7e3c4e1c47e4559f9c1498afdf02f:tools/redline-native-trace.cjs'],{encoding:'utf8'}));
  const fresh=source.includes('let prefix;')?trace:load(candidate(source));
  assert.equal(fresh.integrate(),old.integrate(),'entire generated caller including first-terminal/readiness/shutdown unchanged');
  const rows=[];for(const [label,c] of [['old',old],['new',fresh]])for(const mode of ['kill','cancel','inherited','partial-line','complete','keyboard','timeout'])rows.push(await run(c,label,mode,old));
  const out=path.join(base,'negatives');fs.mkdirSync(out);const file=path.join(out,'native-startup-trace.json');const receipt={actualBrowserExit:{code:0},streamEOF:true};
  assert(!fresh.retrieve(out,receipt).prefix.sha256,'missing file cannot be recovered');
  fs.symlinkSync('../new/complete/native-startup-trace.json',file);assert(!fresh.retrieve(out,receipt).prefix.sha256,'no symlink');fs.unlinkSync(file);
  cp.execFileSync('mkfifo',[file]);assert(!fresh.retrieve(out,receipt).prefix.sha256,'FIFO does not block');fs.unlinkSync(file);
  fs.writeFileSync(file,Buffer.alloc(65537,120));let result=fresh.retrieve(out,receipt);assert.equal(result.prefix.bytes,65536);assert(result.prefix.capped);assert(!result.flushedJSON);
  fs.writeFileSync(file,'{"traceEvents":[]}');result=fresh.retrieve(out,{streamEOF:true});assert(result.prefix.sha256);assert(!result.flushedJSON,'prefix cannot waive actual wait');
  result=fresh.retrieve(out,{actualBrowserExit:{code:0},streamEOF:false});assert(result.prefix.sha256);assert(!result.flushedJSON,'even complete JSON cannot waive EOF');
  const snapshot=JSON.stringify(result.prefix);fs.appendFileSync(file,'later-writer');assert.equal(JSON.stringify(result.prefix),snapshot,'returned bytes survive later writes');
  result=fresh.retrieve(out,receipt,{maxBytes:1});assert(!result.flushedJSON,'prefix cannot waive full trace bound');
  fs.writeFileSync(path.join(base,'results.json'),JSON.stringify({passed:true,rows,cause:'UNKNOWN',nativeAttempt:false,boxCreated:false},null,2));
  console.log('PASS actual inert shipped launch/retrieve: old prefix lost / new bounded bytes retained; kill cancel inherited writer partial line; wait separate EOF, terminal unchanged, missing symlink FIFO cap and wait negatives');
}
module.exports={candidate};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
