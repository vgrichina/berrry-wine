'use strict';
// Light-phase authored controls. No runtime/helper/module imports or native input.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

// Candidate only until the ordered runtime lane is released. Every invocation
// obtains new bytes; no digest/source cache, stat shortcut or prior-intent data.
async function freshPins(root,files,read=fs.promises.readFile.bind(fs.promises)) {
  assert(Array.isArray(files)&&files.length);
  const seen=new Set();
  for(const row of files){
    assert(typeof row.path==='string'&&!path.isAbsolute(row.path)&&!row.path.split('/').includes('..'));
    assert(/^[a-f0-9]{64}$/.test(row.sha256)&&!seen.has(row.path));seen.add(row.path);
  }
  const results=await Promise.allSettled(files.map(async row=>{
    const bytes=await read(path.join(root,row.path));
    const digest=Buffer.from(await crypto.webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
    assert.equal(digest,row.sha256,'current source changed '+row.path);
    return {path:row.path,sha256:digest,size:bytes.length};
  }));
  // Join every read/hash, including after one refusal. Nothing can arm from
  // partial results, and a failed read does not leave detached work behind.
  for(const result of results)if(result.status==='rejected')throw result.reason;
  return results.map(result=>result.value);
}

function history(root) {
  const run=path.join(root,'scratch/runs/20261115-gta2-current-scene-prearm-repair');
  const file=path.join(run,'final-main/control/native-quit-prearm-phases.jsonl');
  if(!fs.existsSync(file))return {status:'UNKNOWN',scope:'Missing historical timing evidence never gates new work'};
  const rows=fs.readFileSync(file,'utf8').trim().split('\n').map(JSON.parse);
  const phase=name=>rows.find(row=>row.phase===name);
  return {moduleVerifiedMs:phase('actual-module-bytes')?.sinceStarted??'UNKNOWN',
    sourceCompleteMs:phase('actual-source-bodies-and-modules')?.sinceStarted??'UNKNOWN',
    finalPinsBeginMs:phase('current-final-file-bodies-begin')?.sinceStarted??'UNKNOWN',
    finalPinsEndMs:phase('fresh-native-scene-and-final-pins')?.sinceStarted??'UNKNOWN',
    armObserved:rows.some(row=>row.phase==='arm-ack-ready'),
    scope:'Preserved published-revision measurement; no current native reproduction claim'};
}

function startToken(pid){
  const stat=fs.readFileSync('/proc/'+pid+'/stat','utf8');
  return stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
}
async function deadlineKillControl(out){
  const children=[];
  function launch(mode,receipt){
    const child=cp.spawn(process.execPath,[__filename,mode,receipt],{stdio:['pipe','pipe','pipe']});
    const row={pid:child.pid,mode,stdout:'',stderr:''};children.push({child,row});
    child.stdout.on('data',b=>row.stdout+=b);child.stderr.on('data',b=>row.stderr+=b);
    child.stdin.on('error',()=>{});
    row.joined=new Promise(resolve=>child.once('close',(exit,signal)=>resolve({exit,signal})));
    fs.writeFileSync(path.join(out,mode.slice(2)+'-pid.json'),JSON.stringify({pid:child.pid,startToken:startToken(child.pid)}));
    return {child,row};
  }
  const victim=launch('--blocked-victim',path.join(out,'victim-resumed.json'));
  const guard=launch('--kill-deadline',path.join(out,'independent-expiry.json'));
  let result;
  try {
    const readyUntil=Date.now()+2000;
    while(!children.every(({row})=>row.stdout.includes('READY\n'))){assert(Date.now()<readyUntil);await delay(5);}
    const startedAt=Date.now(),cfg={startedAt,pid:victim.child.pid,startToken:startToken(victim.child.pid)};
    guard.child.stdin.end(JSON.stringify(cfg)+'\n');
    while(!guard.row.stdout.includes('CONFIGURED\n')){assert(Date.now()<readyUntil);await delay(5);}
    victim.child.stdin.end('BLOCK\n');
    const [waitedVictim,waitedGuard]=await Promise.all([victim.row.joined,guard.row.joined]);
    assert.equal(waitedVictim.signal,'SIGKILL');assert.equal(waitedGuard.exit,0,guard.row.stderr);
    assert(!fs.existsSync(path.join(out,'victim-resumed.json')),'blocked child cannot resume or accept late completion');
    result=JSON.parse(fs.readFileSync(path.join(out,'independent-expiry.json')));
    assert.equal(result.state,'EXPIRED');assert.equal(result.pid,victim.child.pid);
    assert(result.firedAt>=startedAt+500&&result.firedAt<startedAt+1000);
  } finally {
    for(const {child,row} of children){
      child.stdin.end();const waited=await row.joined;
      fs.writeFileSync(path.join(out,row.mode.slice(2)+'-wait.json'),JSON.stringify({...waited,pid:row.pid,
        actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout:row.stdout,stderr:row.stderr}));
      assert(child.stdout.readableEnded&&child.stderr.readableEnded);
    }
  }
  return result;
}

function authoredPE(){
  const bytes=require('./test-gta2-current-scene-prearm.cjs').authoredPE();
  const raw=rva=>rva-0x1000+0x400,base=0x400000;
  const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
  const code=[],emit=(...b)=>code.push(...b),push=n=>emit(0x68,...u32(n));
  const apis={ReleaseDC:0x1320,FillRect:0x1324,SetWindowTextA:0x132c,
    CreateSolidBrush:0x1400,DeleteObject:0x1404,GetPixel:0x1408};
  const call=name=>emit(0xff,0x15,...u32(base+apis[name]));
  const title='Native input binding fixture DOWN=0 UP=0 QUIT=0 PIXEL=????????';
  // The public key-UP handler fills its whole client. Repaint the witness on
  // that same real HDC, obtain a new public GetPixel result and publish it in
  // the native title before releasing the DC. No renderer/pixel substitution.
  emit(0x55,0x89,0xe5,0x53,0x56,0x57,0x8b,0x75,12);
  push(0x35a7e1);call('CreateSolidBrush');emit(0x89,0xc7);
  emit(0x57);push(base+0x3640);emit(0x56);call('FillRect');
  push(356);push(32);emit(0x56);call('GetPixel');emit(0x89,0xc3);
  const resultAt=base+0x3340+title.indexOf('????????');
  for(let i=0;i<8;i++)emit(0x89,0xd8,0xc1,0xe8,28-i*4,0x83,0xe0,15,
    0x3c,10,0x72,2,0x04,7,0x04,48,0xa2,...u32(resultAt+i));
  emit(0x56,0xff,0x75,8);call('ReleaseDC');emit(0x57);call('DeleteObject');
  push(base+0x3340);emit(0xff,0x75,8);call('SetWindowTextA');
  emit(0x5f,0x5e,0x5b,0x5d,0xc2,8,0);
  assert(code.length<0x200);Buffer.from(code).copy(bytes,raw(0x2c00));
  const old=Buffer.from([0xff,0x15,...u32(base+apis.ReleaseDC)]);let changed=0;
  for(let at=raw(0x2600);at<raw(0x2800);at++)if(bytes.subarray(at,at+6).equals(old)){
    bytes[at]=0xe8;bytes.writeInt32LE(raw(0x2c00)-at-5,at+1);bytes[at+5]=0x90;changed++;
  }
  assert.equal(changed,1,'one actual original key-paint ReleaseDC call');return bytes;
}

async function browserFixture(out,mode,options={}){
  // Lazy: shared helpers are loaded only after both ordered releases, never by
  // --authored. Keep the actual current scene witness and genuine DLL lifecycle.
  const current=require('./test-gta2-current-scene-prearm.cjs');
  const harness=require('./test-gta2-fresh-attestation-prearm.cjs');
  return harness.browserFixture(out,mode,{...options,fixtureFactory:authoredPE,
    extraPins:['test/test-gta2-current-scene-prearm.cjs','test/test-gta2-final-pin-prearm-scheduling.cjs'],
    captureWitness:async({label,png,evaluate,record})=>{
      // Every reviewed preinput capture must independently match the native
      // public GetPixel witness, backing/logical pixels and visible display.
      // The harness's post-ExitProcess terminal capture is a separate path.
      const witness=await current.readPublishedPixels(evaluate);
      record(label+'-pixel-witness.json',witness);
      record(label+'-pixels.json',{witness,proof:current.verifyPublishedPixels(png,witness)});
    }});
}

// Proposed watchdog service protocol, authored here without importing runtime
// code. Qualification must be acknowledged by this process before DOWN. Once
// qualified, it must leave the separate finite UP process alive.
function deadlineService(){
  const fs=require('node:fs'),assert=require('node:assert/strict'),readline=require('node:readline');
  const output=process.argv[3];let state='READY',config,timer,finished=false;
  const token=pid=>{const s=fs.readFileSync('/proc/'+pid+'/stat','utf8');return s.slice(s.lastIndexOf(')')+2).split(' ')[19];};
  const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
  const lines=readline.createInterface({input:process.stdin});
  const finish=async(value,terminate=false)=>{
    if(finished)return;finished=true;clearTimeout(timer);
    if(terminate&&config){
      try{
        if(token(config.pid)===config.startToken){
          process.kill(config.pid,'SIGKILL');value.signaledAt=Date.now();
          // Observe quiescence before publishing a terminal receipt. This is
          // not wait evidence: the actual parent must still join both EOFs.
          const until=Date.now()+1000;
          for(;;){
            try{
              const stat=fs.readFileSync('/proc/'+config.pid+'/stat','utf8');
              const fields=stat.slice(stat.lastIndexOf(')')+2).split(' ');
              if(fields[19]!==config.startToken||fields[0]==='Z')break;
            }catch(error){if(error.code==='ENOENT')break;throw error;}
            assert(Date.now()<until,'signaled release child did not quiesce');
            await new Promise(resolve=>setTimeout(resolve,1));
          }
          value.quiescentAt=Date.now();
        }
      }
      catch(error){if(error.code!=='ENOENT'&&error.code!=='ESRCH')throw error;}
    }
    fs.writeFileSync(output,JSON.stringify(value)+'\n',{flag:'wx'});
    send(value);lines.close();process.stdin.destroy();
  };
  lines.on('line',async text=>{
    if(finished)return;
    try{
      const message=JSON.parse(text);
      if(message.action==='start'){
        assert.equal(state,'READY');assert(Number.isSafeInteger(message.startedAt)&&Date.now()>=message.startedAt&&Date.now()-message.startedAt<500);
        assert(Number.isSafeInteger(message.pid)&&message.pid>1);assert.equal(token(message.pid),message.startToken);
        assert(/^[a-z0-9-]{8,100}$/.test(message.nonce));config=message;state='WATCHING';
        timer=setTimeout(async()=>{
          if(state!=='WATCHING')return;state='EXPIRED';
          const value={state,pid:config.pid,startToken:config.startToken,nonce:config.nonce,startedAt:config.startedAt,firedAt:Date.now(),laterRequestsAllowed:0};
          await finish(value,true);
        },Math.max(0,message.startedAt+500-Date.now()));
        send({state:'WATCHING',nonce:message.nonce});return;
      }
      assert.equal(message.action,'complete');assert.equal(state,'WATCHING');
      assert.equal(message.nonce,config.nonce);assert.equal(token(config.pid),config.startToken);
      assert(Date.now()-config.startedAt<=500,'actual independent completion after 500ms');
      state='QUALIFIED';await finish({state,nonce:config.nonce,startedAt:config.startedAt,completedAt:Date.now(),pid:config.pid});
    }catch(error){state='REFUSED';await finish({state,error:String(error),at:Date.now(),laterRequestsAllowed:0},true);process.exitCode=1;}
  });
  lines.on('close',async()=>{
    if(finished)return;state='REFUSED';process.exitCode=1;
    await finish({state,error:'parent EOF before independent qualification',at:Date.now(),laterRequestsAllowed:0},true);
  });send({state:'READY'});
}

async function deadlineRefusals(out){
  const cases=['parent-eof','wrong-nonce','duplicate-start','late-complete','wrong-pid-token'];
  for(const name of cases){
    const receipt=path.join(out,name+'-service.json'),resumed=path.join(out,name+'-resumed.json');
    const victim=cp.spawn(process.execPath,[__filename,'--blocked-victim',resumed],{stdio:['pipe','pipe','pipe']});
    const guard=cp.spawn(process.execPath,[__filename,'--deadline-service',receipt],{stdio:['pipe','pipe','pipe']});
    const rows=[{child:victim,name:name+'-victim'},{child:guard,name:name+'-guard'}];
    for(const row of rows){row.stdout='';row.stderr='';row.child.stdin.on('error',()=>{});
      row.child.stdout.on('data',b=>row.stdout+=b);row.child.stderr.on('data',b=>row.stderr+=b);
      row.joined=new Promise(resolve=>row.child.once('close',(exit,signal)=>resolve({pid:row.child.pid,exit,signal})));}
    const until=Date.now()+2500;
    try{
      while(!rows[0].stdout.includes('READY\n')||!rows[1].stdout.includes('"READY"')){assert(Date.now()<until);await delay(5);}
      const cfg={action:'start',pid:victim.pid,startToken:startToken(victim.pid),startedAt:Date.now(),nonce:'authored-'+name};
      if(name==='wrong-pid-token')cfg.startToken+='-wrong';
      guard.stdin.write(JSON.stringify(cfg)+'\n');
      if(name!=='wrong-pid-token'){
        while(!rows[1].stdout.includes('"WATCHING"')){assert(Date.now()<until);await delay(5);}
        victim.stdin.write('BLOCK\n');
        if(name==='parent-eof')guard.stdin.end();
        else if(name==='wrong-nonce')guard.stdin.write(JSON.stringify({action:'complete',nonce:'wrong-nonce'})+'\n');
        else if(name==='duplicate-start')guard.stdin.write(JSON.stringify(cfg)+'\n');
        else {
          // Qualification cannot arrive after an independently recorded expiry.
          await delay(550);guard.stdin.write(JSON.stringify({action:'complete',nonce:cfg.nonce})+'\n');
        }
      }
      const g=await rows[1].joined,actual=JSON.parse(fs.readFileSync(receipt));
      assert.equal(actual.laterRequestsAllowed,0);assert(!rows[1].stdout.includes('"QUALIFIED"'));
      if(name==='late-complete'){assert.equal(actual.state,'EXPIRED');assert(actual.firedAt>=cfg.startedAt+500);assert.equal(g.exit,0);}
      else {assert.equal(actual.state,'REFUSED');assert.equal(g.exit,1);}
      if(name==='wrong-pid-token'){
        assert.equal(startToken(victim.pid),cfg.startToken.replace(/-wrong$/,''),'invalid PID identity must never signal the child');victim.stdin.end();
        assert.equal((await rows[0].joined).exit,0);
      }else {
        assert.equal((await rows[0].joined).signal,'SIGKILL');
        assert(actual.signaledAt<=actual.quiescentAt,'terminal receipt follows actual owned-child quiescence');
      }
      assert(!fs.existsSync(resumed),'refused intent never resumes');
    }finally{
      for(const row of rows){row.child.stdin.end();const waited=await row.joined;
        fs.writeFileSync(path.join(out,row.name+'-wait.json'),JSON.stringify({...waited,actualWait:true,
          stdoutEOF:row.child.stdout.readableEnded,stderrEOF:row.child.stderr.readableEnded,stdout:row.stdout,stderr:row.stderr}));
        assert(row.child.stdout.readableEnded&&row.child.stderr.readableEnded);
      }
    }
  }
  return cases.length;
}

async function qualificationControl(out){
  const receipt=path.join(out,'service-positive.json'),victimReceipt=path.join(out,'positive-victim-resumed.json');
  const victim=cp.spawn(process.execPath,[__filename,'--blocked-victim',victimReceipt],{stdio:['pipe','pipe','pipe']});
  const guard=cp.spawn(process.execPath,[__filename,'--deadline-service',receipt],{stdio:['pipe','pipe','pipe']});
  const rows=[{child:victim,name:'positive-victim'},{child:guard,name:'positive-guard'}];
  for(const row of rows){row.stdout='';row.stderr='';row.child.stdout.on('data',b=>row.stdout+=b);row.child.stderr.on('data',b=>row.stderr+=b);
    row.child.stdin.on('error',()=>{});row.joined=new Promise(resolve=>row.child.once('close',(exit,signal)=>resolve({pid:row.child.pid,exit,signal})));}
  const until=Date.now()+2000;
  try{
    while(!rows[0].stdout.includes('READY\n')||!rows[1].stdout.includes('"READY"')){assert(Date.now()<until);await delay(5);}
    const startedAt=Date.now(),nonce='authored-positive-deadline',victimStart=startToken(victim.pid);
    guard.stdin.write(JSON.stringify({action:'start',pid:victim.pid,startToken:victimStart,startedAt,nonce})+'\n');
    while(!rows[1].stdout.includes('"WATCHING"')){assert(Date.now()<until);await delay(5);}
    guard.stdin.write(JSON.stringify({action:'complete',nonce})+'\n');
    while(!rows[1].stdout.includes('"QUALIFIED"')){assert(Date.now()<until);await delay(5);}
    const actual=JSON.parse(fs.readFileSync(receipt));assert(actual.completedAt-startedAt<=500);
    const waited=await rows[1].joined;assert.equal(waited.exit,0,rows[1].stderr);
    // Remain alive beyond the original deadline: a successful prearm watchdog
    // must never kill the later finite physical UP path.
    await delay(Math.max(0,startedAt+550-Date.now()));assert.equal(actual.pid,victim.pid);assert.equal(startToken(victim.pid),victimStart);
    victim.stdin.end();const v=await rows[0].joined;assert.equal(v.exit,0);assert(!fs.existsSync(victimReceipt));
  }finally{
    for(const row of rows){row.child.stdin.end();const waited=await row.joined;
      fs.writeFileSync(path.join(out,row.name+'-wait.json'),JSON.stringify({...waited,actualWait:true,
        stdoutEOF:row.child.stdout.readableEnded,stderrEOF:row.child.stderr.readableEnded,stdout:row.stdout,stderr:row.stderr}));
      assert(row.child.stdout.readableEnded&&row.child.stderr.readableEnded);
    }
  }
}

async function authored(out) {
  fs.mkdirSync(out,{recursive:false});
  const root=path.resolve(__dirname,'..');
  const files=[{path:'one',sha256:sha(Buffer.from('literal first source'))},
    {path:'two',sha256:sha(Buffer.from('literal second source'))}];
  fs.writeFileSync(path.join(out,'one'),'literal first source');
  fs.writeFileSync(path.join(out,'two'),'literal second source');
  let count=0;
  await freshPins(out,files);count++;
  // Both independent reads must be issued before either can complete.
  let resolveReads;const released=new Promise(resolve=>resolveReads=resolve),issued=[];
  const parallel=freshPins(out,files,async file=>{
    issued.push(path.basename(file));await released;return fs.promises.readFile(file);
  });
  await delay(0);assert.deepEqual(issued,['one','two']);resolveReads();await parallel;count++;
  // A later hash/read is always fresh, even with the same pin object and intent.
  fs.writeFileSync(path.join(out,'two'),'mutated second source');
  await assert.rejects(freshPins(out,files),/current source changed two/);count++;
  fs.writeFileSync(path.join(out,'two'),'literal second source');
  await freshPins(out,files);count++;
  // A replacement inode also needs actual bytes, rather than stat identity.
  fs.writeFileSync(path.join(out,'replacement'),'replacement second!!');
  fs.renameSync(path.join(out,'replacement'),path.join(out,'two'));
  await assert.rejects(freshPins(out,files),/current source changed two/);count++;
  fs.writeFileSync(path.join(out,'two'),'literal second source');
  let finalCompleted=false;
  await assert.rejects(freshPins(out,files,async file=>{
    if(file.endsWith('/one'))throw Error('authored unavailable source');
    await delay(25);finalCompleted=true;return fs.promises.readFile(file);
  }),/authored unavailable source/);
  assert(finalCompleted,'failure joins all remaining reads');count++;
  for(const bad of [[...files,files[0]],[{...files[0],path:'../outside'}],[],
    [{...files[0],sha256:'not a hash'}],[{...files[0],path:'/absolute'}]]){
    await assert.rejects(freshPins(out,bad));count++;
  }
  // Actual separate-process deadline observation while this Node event loop is
  // synchronously blocked. This control has no CDP socket and no input path.
  const receipt=path.join(out,'deadline.json');
  const child=cp.spawn(process.execPath,[__filename,'--authored-deadline',receipt],{stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  fs.writeFileSync(path.join(out,'deadline-pid.json'),JSON.stringify({pid:child.pid}));
  const joined=new Promise(resolve=>child.once('close',(exit,signal)=>resolve({pid:child.pid,exit,signal})));
  try {
    const readyUntil=Date.now()+2000;
    while(!stdout.includes('READY\n')){assert(Date.now()<readyUntil,'watchdog ready');await delay(5);}
    const startedAt=Date.now();child.stdin.end(JSON.stringify({startedAt})+'\n');
    while(!stdout.includes('CONFIGURED\n')){assert(Date.now()<readyUntil,'watchdog configured before block');await delay(5);}
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1100);
    const actual=JSON.parse(fs.readFileSync(receipt,'utf8'));
    assert.equal(actual.state,'EXPIRED');assert.equal(actual.startedAt,startedAt);
    assert(actual.firedAt>=startedAt+500&&actual.firedAt<startedAt+1000,
      'independent deadline must precede blocked caller resumption');
    assert(Date.now()-startedAt>=1100);count++;
  } finally {
    child.stdin.end();const waited=await joined;
    fs.writeFileSync(path.join(out,'deadline-wait.json'),JSON.stringify({...waited,actualWait:true,
      stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr}));
    assert.equal(waited.exit,0,stderr);assert(child.stdout.readableEnded&&child.stderr.readableEnded);
  }
  await deadlineKillControl(out);count++;
  await qualificationControl(out);count++;
  count+=await deadlineRefusals(out);
  const result={status:'PASS',controls:count,history:history(root),nativeQualification:false,
    scope:'New authored fresh-byte IO and independent blocked-event-loop deadline controls only'};
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n');return result;
}

if(require.main===module){
  if(process.argv[2]==='--deadline-service')deadlineService();
  else if(process.argv[2]==='--blocked-victim'){
    process.stdout.write('READY\n');process.stdin.resume();
    process.stdin.once('data',()=>{
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1500);
      fs.writeFileSync(process.argv[3],JSON.stringify({state:'LATE_RESUMPTION'}),{flag:'wx'});
    });
  } else if(process.argv[2]==='--kill-deadline'){
    process.stdout.write('READY\n');let text='';process.stdin.on('data',b=>text+=b);
    process.stdin.once('end',()=>{
      const cfg=JSON.parse(text);assert.equal(startToken(cfg.pid),cfg.startToken);
      setTimeout(()=>{
        assert.equal(startToken(cfg.pid),cfg.startToken,'never signal a replaced PID');
        fs.writeFileSync(process.argv[3],JSON.stringify({...cfg,state:'EXPIRED',firedAt:Date.now()}),{flag:'wx'});
        process.kill(cfg.pid,'SIGKILL');
      },Math.max(0,cfg.startedAt+500-Date.now()));
      process.stdout.write('CONFIGURED\n');
    });
  } else if(process.argv[2]==='--authored-deadline'){
    process.stdout.write('READY\n');let text='';
    process.stdin.on('data',b=>text+=b);
    process.stdin.once('end',()=>{
      const {startedAt}=JSON.parse(text);assert(Number.isSafeInteger(startedAt));
      setTimeout(()=>fs.writeFileSync(process.argv[3],JSON.stringify({state:'EXPIRED',startedAt,
        firedAt:Date.now(),pid:process.pid,scope:'authored watchdog only'}),{flag:'wx'}),Math.max(0,startedAt+500-Date.now()));
      process.stdout.write('CONFIGURED\n');
    });
  } else if(process.argv[2]==='--browser')browserFixture(path.resolve(process.argv[3]),process.argv[4],{
    dlls:true,prepareDebugger:true,tamperSource:process.argv.includes('--tamper-source')})
      .catch(e=>{console.error(e);process.exitCode=1;});
  else if(process.argv[2]==='--authored')authored(path.resolve(process.argv[3])).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
  else throw Error('Explicit mode required');
}
module.exports={freshPins,history,authored,authoredPE,browserFixture};
