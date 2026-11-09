'use strict';
// Whole production caller, real inert processes, real port files and gzip pipes.
// Only external Chrome/server/protocol services are replaced. No guest is run.
const fs=require('node:fs'),cp=require('node:child_process'),vm=require('node:vm');
const path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const {EventEmitter,once}=require('node:events');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const base=process.env.REDLINE_CHROME_TEST_RUN||root+'/scratch/runs/20261109-redline-startup-failure-repair-0940/controls';
fs.mkdirSync(base,{recursive:true});
const baseline='00d4a4bf9a5ac30020e8434629114f37f1b9fe13';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function runner(mode,old,dir){
  const events=[];let child,server,actualExit,stdoutEOF=false,stderrEOF=false;
  const out=dir+'/original',file=out+'/chrome-profile/DevToolsActivePort';
  const source=old?cp.execFileSync('git',['show',baseline+':tools/redline-browser-run.cjs'],{encoding:'utf8'}):fs.readFileSync(__dirname+'/redline-browser-run.cjs','utf8');
  const helper=old?(()=>{const m={exports:{}};vm.runInNewContext(cp.execFileSync('git',['show',baseline+':tools/redline-fixture-shutdown.cjs'],{encoding:'utf8'}),{module:m,setTimeout,clearTimeout});return m.exports;})():require('./redline-fixture-shutdown.cjs');
  const pins={files:[],httpPins:[]};
  for(const p of ['host.js','tools/redline-browser-run.cjs','tools/redline-startup.cjs','tools/redline-fixture-shutdown.cjs','tools/redline-chrome-startup.cjs','tools/redline-key-delivery.cjs','lib/redline-startup-admission.js']){const b=fs.readFileSync(root+'/'+p);pins.files.push({path:p,size:b.length,sha256:hash(b)});}
  fs.writeFileSync(dir+'/runtime-pins.json',JSON.stringify(pins));
  const proc=new EventEmitter();proc.env={REDLINE_RUN:dir,BROWSER_DEADLINE:String(Date.now()+(mode==='deadline'?300:25000))};proc.pid=process.pid;proc.exitCode=0;
  const spawn=()=>{
    const delay=mode==='deadline'?650:mode==='late'?10400:mode==='valid'?200:mode==='malformed'?100:-1;
    const program=`const fs=require('fs'),cp=require('child_process');fs.mkdirSync(${JSON.stringify(path.dirname(file))},{recursive:true});
      process.stderr.write('inert startup\\n');
      ${delay>=0?`setTimeout(()=>{fs.writeFileSync(${JSON.stringify(file)},${JSON.stringify(mode==='malformed'?'not-a-port\n/foreign':'12345\n/devtools/browser/inert')});process.stderr.write('DevTools listening inert\\n');},${delay});`:''}
      ${mode==='exit'?"setTimeout(()=>process.exit(7),80);":mode==='inherited'?`cp.spawn(process.execPath,['-e',"setTimeout(()=>{process.stdout.write('inherited writer done\\\\n');},1300)"],{stdio:['ignore',1,2]});setTimeout(()=>{fs.writeFileSync(${JSON.stringify(file)},'12345\\n/devtools/browser/inert');process.exit(7)},80);`:mode==='missing'?"setTimeout(()=>process.exit(0),10800);":`setTimeout(()=>process.exit(0),${mode==='late'?10800:mode==='deadline'?1100:700});`}`;
    child=cp.spawn(process.execPath,['-e',program],{stdio:['ignore','pipe','pipe']});
    child.once('exit',(code,signal)=>{actualExit={code,signal};events.push('actual-exit');});
    child.stdout.once('end',()=>{stdoutEOF=true;events.push('stdout-EOF');});
    child.stderr.once('end',()=>{stderrEOF=true;events.push('stderr-EOF');});return child;
  };
  const publish=(p,v)=>{fs.writeFileSync(p,JSON.stringify(v,null,2));if(p.endsWith('first-browser-failure.json'))events.push('terminal');};
  class Socket{constructor(){events.push('WebSocket');throw Error('inert endpoint admitted; stop before CDP');}}
  const req=n=>{
    if(n==='node:child_process')return {spawn};
    if(n.endsWith('/bound-input.cjs'))return {};
    if(n.endsWith('/transport.cjs'))return {publish,closed(){events.push('closed');}};
    if(n.endsWith('/test/static-server.js'))return {startStaticServer:async()=>{
      if(mode==='acquire'){
        setTimeout(()=>proc.emit('SIGTERM'),10);
        await new Promise(r=>setTimeout(r,100));
      }
      return server=await require('../test/static-server.js').startStaticServer({root});
    }};
    if(n==='./redline-fixture-shutdown.cjs')return {...helper,createLifecycle:opts=>helper.createLifecycle({...opts,...(mode==='inherited'?{exitWaitMs:250}:{})})};
    if(n.startsWith('./'))return require(path.join(__dirname,n));
    return require(n);
  };
  const context=vm.createContext({require:req,__dirname,process:proc,console,Buffer,WebSocket:Socket,setTimeout,clearTimeout,fetch});
  const began=Date.now();await vm.runInContext(source,context);
  const settledMs=Date.now()-began;
  assert(!server.listening,'real HTTP server joined');if(mode!=='acquire')assert(actualExit,'actual wait joined');
  const read=n=>fs.existsSync(out+'/'+n)?JSON.parse(fs.readFileSync(out+'/'+n)):null;
  const shutdown=read('shutdown.json'),first=read('first-browser-failure.json'),startup=read('chrome-startup.json');
  if(mode==='acquire'){
    assert(!child,'no child created after cancellation during acquisition');
    assert.match(first.error,/SIGTERM/);assert.equal(shutdown.firstFailure,'Error: SIGTERM');
    fs.writeFileSync(dir+'/result.json',JSON.stringify({mode,old,settledMs,events,serverJoined:true,noChild:true,shutdown,first},null,2));return;
  }
  if(!old){
    assert.equal(shutdown.firstFailure,'Error: '+first.error.split('\n')[0].replace(/^Error: /,''),'first failure preserved in shutdown');
    if(!['valid','inherited'].includes(mode))assert(!events.includes('WebSocket'),'no postterminal or invalid endpoint admission');
    if(mode==='exit') {assert.equal(startup.outcome,'child-exit');assert.equal(startup.exit.code,7);assert(settledMs<1000,'early exit avoids ten-second port poll');}
    if(mode==='late'||mode==='missing'){assert.equal(startup.polls,100);assert(settledMs>=10000&&settledMs<12500);assert.match(first.error,/unpublished after 100x100ms/);}
    if(mode==='deadline'){assert(settledMs<2000);assert.match(first.error,/immutable runtime/);}
    if(mode==='inherited'){assert(settledMs<1000);assert(shutdown.streamsTruncated);assert.equal(shutdown.streamEOF,false);assert(fs.existsSync(out+'/chrome-profile'),'retain profile without natural EOF');}
    else {assert(shutdown.streamEOF);assert(stdoutEOF&&stderrEOF);for(const n of ['stdout','stderr'])zlib.gunzipSync(fs.readFileSync(out+'/chrome-'+n+'.gz'));}
    if(mode==='valid')assert(events.includes('WebSocket'));
    if(mode==='malformed')assert.match(first.error,/invalid DevToolsActivePort/);
    if(mode==='late')assert.match(shutdown.postTerminalPublication.text,/devtools\/browser\/inert/,'late publication retained without admission');
    if(mode==='missing')assert.equal(shutdown.postTerminalPublication.error,'ENOENT');
    await assert.rejects(vm.runInContext("send('Input.dispatchKeyEvent')",context));
    await assert.rejects(vm.runInContext("capture('postterminal')",context));
  }else{
    if(mode==='deadline')assert(events.indexOf('WebSocket')>events.indexOf('terminal'),'oldFAIL enters socket path after runtime cap');
    if(mode==='exit')assert(settledMs>=10000,'oldFAIL ignores early child exit during poll');
    if(mode==='inherited'){assert(settledMs>=1200&&settledMs<4000,'oldFAIL waits past 250ms cleanup budget for inherited writer');assert.equal(shutdown.firstFailure,null,'oldFAIL loses primary failure');}
  }
  fs.writeFileSync(dir+'/result.json',JSON.stringify({mode,old,settledMs,events,actualExit,stdoutEOF,stderrEOF,startup,shutdown,first},null,2));
  // A truncated stream does not claim descendant completion: harness separately waits.
  if(mode==='inherited')await new Promise(r=>setTimeout(r,1500));
}
async function suite(){
  for(const [mode,old] of [['deadline',true],['deadline',false],['exit',true],['exit',false],['inherited',true],['inherited',false],['late',false],['missing',false],['valid',false],['malformed',false]]){
    const dir=fs.mkdtempSync(base+'/'+(old?'old-':'new-')+mode+'-');
    // Independent process watchdog is armed and observable before the runner.
    const watchdog=cp.spawn(process.execPath,['-e',`let pid;console.log('ARMED');const timer=setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGKILL')}catch{};process.exit(9)},23000);process.stdin.on('data',b=>{if(b.toString().trim()==='done'){clearTimeout(timer);process.exit(0)}else pid=Number(b)});`],{stdio:['pipe','pipe','pipe']});
    const armed=await once(watchdog.stdout,'data');assert(String(armed).includes('ARMED'));
    const watcherWait=once(watchdog,'exit'),watcherEOF=once(watchdog,'close');
    const child=cp.spawn(process.execPath,[__filename,'--runner',mode,old?'old':'new',dir],{detached:true,stdio:['ignore','pipe','pipe']});
    const wait=once(child,'exit'),eof=once(child,'close');watchdog.stdin.write(String(child.pid)+'\n');
    const streams=['stdout','stderr'].map(n=>require('node:stream/promises').pipeline(child[n],zlib.createGzip(),fs.createWriteStream(dir+'/runner-'+n+'.gz')));
    const [code,signal]=await wait;await eof;await Promise.all(streams);watchdog.stdin.write('done\n');const [watchdogCode]=await watcherWait;await watcherEOF;
    fs.writeFileSync(dir+'/joins.json',JSON.stringify({code,signal,watchdogCode,runnerEOF:true,watchdogEOF:true}));
    assert.equal(code,0,dir);assert.equal(watchdogCode,0,dir);console.log('PASS '+(old?'oldFAIL ':'newPASS ')+mode);
  }
}
if(process.argv[2]==='--runner')runner(process.argv[3],process.argv[4]==='old',process.argv[5]).catch(e=>{console.error(e);process.exitCode=1;});
else suite().catch(e=>{console.error(e);process.exitCode=1;});
