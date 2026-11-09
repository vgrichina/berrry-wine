'use strict';
// Execute the actual generated caller, readiness loop and shutdown with real
// inert children. External browser/guest services never run.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm');
const assert=require('node:assert/strict'),{EventEmitter,once}=require('node:events');
const {performance}=require('node:perf_hooks'),{createHash}=require('node:crypto');
const boundary=require('./redline-startup-boundary.cjs'),trace=require('./redline-native-trace.cjs');
const root=path.resolve(__dirname,'..'),base=path.resolve(process.env.REDLINE_BOUNDARY_TEST_RUN||'scratch/runs/20261109-redline-startup-boundary-diagnostic-1355/controls');
async function runner(mode,old,dir){
  const out=dir+'/original',file=out+'/chrome-profile/DevToolsActivePort',events=[],counts={stat:0,read:0};
  let child,server,exit;
  let terminalAt,statAtTerminal,readAtTerminal;
  const source=old?trace.integrate():boundary.integrate();
  const pins={files:[],httpPins:[]};
  for(const p of new Set([...trace.providers,'tools/redline-startup-boundary.cjs','host.js','tools/redline-browser-run.cjs','tools/redline-startup.cjs','tools/redline-fixture-shutdown.cjs','tools/redline-chrome-startup.cjs','tools/redline-key-delivery.cjs','lib/redline-startup-admission.js'])){
    const b=fs.readFileSync(root+'/'+p);pins.files.push({path:p,size:b.length,sha256:createHash('sha256').update(b).digest('hex')});}
  fs.writeFileSync(dir+'/runtime-pins.json',JSON.stringify(pins));
  const proc=new EventEmitter();proc.env={REDLINE_RUN:dir,BROWSER_DEADLINE:String(Date.now()+22000)};proc.pid=process.pid;
  const measuredFS={...fs,statSync(p,...args){if(p===file)counts.stat++;return fs.statSync(p,...args);},readFileSync(p,...args){if(p===file)counts.read++;return fs.readFileSync(p,...args);}};
  // Load the exact old/new readiness source with only filesystem accounting.
  const m={exports:{}};vm.runInNewContext(old?fs.readFileSync(__dirname+'/redline-chrome-startup.cjs','utf8'):boundary.readinessSource(),
    {require:n=>n==='node:fs'?measuredFS:require(n),module:m,setTimeout,clearTimeout});
  const helper={...boundary,...m.exports};
  const spawn=(executable,argv,options)=>{
    assert.equal(executable,'/usr/bin/google-chrome');assert(argv.includes('--trace-startup-duration=10'));
    events.push({kind:'spawn-call',at:performance.now()});
    const delay=mode==='ready'?180:mode==='invalid'?160:-1;
    const terminalControlled=['never','late','writefailure'].includes(mode);
    const program=`const fs=require('node:fs');fs.mkdirSync(${JSON.stringify(path.dirname(file))},{recursive:true});process.stderr.write('inert startup\\n');
      ${mode==='inherited'?`require('node:child_process').spawn(process.execPath,['-e',"setTimeout(()=>{},1400)"],{stdio:['ignore',1,2]});`:''}
      ${delay>=0?`setTimeout(()=>fs.writeFileSync(${JSON.stringify(file)},${JSON.stringify(mode==='invalid'?'bad\n/foreign':'12345\n/devtools/browser/inert')}),${delay});`:''}
      ${terminalControlled?"process.stdin.resume();process.stdin.once('data',()=>process.exit(0));":`setTimeout(()=>process.exit(${mode==='exit'||mode==='inherited'?7:0}),${['exit','inherited'].includes(mode)?180:650});`}`;
    child=cp.spawn(process.execPath,['-e',program],terminalControlled?{...options,stdio:['pipe','pipe','pipe']}:options);
    child.once('exit',(code,signal)=>{exit={code,signal,at:performance.now()};});return child;
  };
  const publish=(p,value)=>{fs.writeFileSync(p,JSON.stringify(value));if(p.endsWith('first-browser-failure.json')){
    terminalAt=performance.now();statAtTerminal=counts.stat;readAtTerminal=counts.read;events.push({kind:'terminal',at:terminalAt});
    // Publish only after actual terminal, independent of scheduling jitter.
    if(mode==='late')fs.writeFileSync(file,'12345\n/devtools/browser/inert');
    if(['never','late','writefailure'].includes(mode))child.stdin.end('terminal');
  }};
  class Socket{constructor(){events.push({kind:'WebSocket',at:performance.now()});throw Error('inert admitted endpoint; stop before CDP');}}
  const req=n=>{
    if(n==='node:child_process')return {spawn};
    if(n.endsWith('/bound-input.cjs'))return {};
    if(n.endsWith('/transport.cjs'))return {publish,closed(){}};
    if(n.endsWith('/test/static-server.js'))return {startStaticServer:async()=>server=await require('../test/static-server.js').startStaticServer({root})};
    if(n==='./redline-startup-boundary.cjs')return mode==='writefailure'?{...helper,writeDiagnostic(){throw Error('diagnostic sink refused');}}:helper;
    if(n==='./redline-chrome-startup.cjs')return m.exports;
    if(n==='./redline-fixture-shutdown.cjs'&&mode==='inherited'){
      const helper=require(n);return {...helper,createLifecycle:opts=>helper.createLifecycle({...opts,exitWaitMs:250})};
    }
    if(n.startsWith('./'))return require(path.join(__dirname,n));return require(n);
  };
  const context=vm.createContext({require:req,__dirname,process:proc,console,Buffer,WebSocket:Socket,setTimeout,clearTimeout,fetch});
  const started=performance.now();await vm.runInContext(source,context);const settled=performance.now();
  assert(exit,'actual child exit joined');assert(!server.listening,'server joined');
  const read=n=>JSON.parse(fs.readFileSync(out+'/'+n));
  const startup=read('chrome-startup.json'),shutdown=read('shutdown.json');
  assert.equal(shutdown.firstFailure,read('first-browser-failure.json').error.split('\n')[0],'original terminal reason preserved');
  assert.equal(counts.stat,statAtTerminal+1,'only existing cleanup publicationSnapshot stat after terminal');
  assert.equal(counts.read,readAtTerminal+(mode==='late'||mode==='ready'||mode==='invalid'?1:0),'only existing cleanup snapshot read after terminal');
  assert.equal(events.some(e=>e.kind==='WebSocket'),mode==='ready');
  await assert.rejects(vm.runInContext("send('Input.dispatchKeyEvent')",context),/terminal/);
  await assert.rejects(vm.runInContext("capture('late')",context),/terminal/);
  if(['never','late','writefailure'].includes(mode)){assert.equal(startup.polls,100);assert.equal(statAtTerminal,101);assert.equal(readAtTerminal,0);assert(terminalAt-started>=10000&&terminalAt-started<12000);}
  if(mode==='late')assert(shutdown.postTerminalPublication.text.includes('/inert'));
  if(mode==='exit'||mode==='inherited'){assert.equal(startup.outcome,'child-exit');assert(terminalAt-started<1500);}
  if(mode==='inherited'){assert.equal(shutdown.streamEOF,false);assert(shutdown.streamsTruncated);assert(settled-started<1200,'diagnostic does not join inherited writer');}
  if(mode==='invalid')assert.match(read('first-browser-failure.json').error,/invalid DevTools/);
  let diagnostic=null,status=null;
  if(old)assert(!fs.existsSync(out+'/startup-boundary.json'),'old missing boundary FAIL');
  else {
    status=vm.runInContext('startupBoundary.status()',context);
    if(mode==='writefailure'){assert.match(status.writeError,/sink refused/);assert(!fs.existsSync(out+'/startup-boundary.json'));}
    else {diagnostic=read('startup-boundary.json');assert.equal(diagnostic.rows.filter(r=>r.kind==='stat').length,statAtTerminal);assert.equal(diagnostic.rows.filter(r=>r.kind==='read').length,readAtTerminal);
      assert.equal(diagnostic.rows.filter(r=>r.kind==='existing-poll-result').length,startup.polls);
      assert.equal(diagnostic.outcome,startup.outcome);assert(diagnostic.firstTerminal.at<=terminalAt);
      assert.equal(diagnostic.rows[0].kind,'spawn-return');
      for(let i=1;i<diagnostic.rows.length;i++)assert(diagnostic.rows[i].at>=diagnostic.rows[i-1].at);
      for(const r of diagnostic.rows.filter(r=>r.start!==undefined))assert(r.start<=r.at);
      assert.equal(diagnostic.browserEOF,'UNKNOWN');assert.equal(diagnostic.dropped,0);
      if(mode==='exit'||mode==='inherited')assert(diagnostic.rows.some(r=>r.kind==='existing-poll-result'&&r.result?.exit?.code===7)||diagnostic.rows.some(r=>r.kind==='existing-child-check'&&r.exit?.code===7));
      if(mode==='invalid')assert(diagnostic.rows.some(r=>r.kind==='read'&&r.result.text==='bad\n/foreign'));
    }
  }
  fs.writeFileSync(dir+'/result.json',JSON.stringify({mode,old,started,terminalAt,settled,counts,statAtTerminal,readAtTerminal,events,exit,startup,shutdown,diagnostic,writeError:status?.writeError},null,2));
}
async function suite(){
  fs.mkdirSync(base,{recursive:true});
  // Removing only observation calls restores the exact actual loop, including
  // every guard, wait, poll-limit comparison, read, parse and acceptance site.
  let normalized=boundary.readinessSource();
  for(const [a,b] of [
    ['diagnostic, wait = ms =>','wait = ms =>'],
    ['diagnostic.start();const started=Date.now();','const started=Date.now();'],
    ["diagnostic.check(evidence);\n      if (evidence.exit || evidence.waitError)",'if (evidence.exit || evidence.waitError)'],
    ["diagnostic.attempt('stat',()=>fs.statSync(file)).size",'fs.statSync(file).size'],
    ["diagnostic.attempt('read',()=>fs.readFileSync(file,'utf8'))","fs.readFileSync(file,'utf8')"],
    ["const record = outcome => (diagnostic.outcome(outcome),save('chrome-startup.json',","const record = outcome => save('chrome-startup.json',"],
    ['lastRead,...evidence}));','lastRead,...evidence});'],
    ['diagnostic.race(result);\n      if(result?.exit||result?.waitError)','if(result?.exit||result?.waitError)']
  ]){assert.equal(normalized.split(a).length,2);normalized=normalized.replace(a,b);}
  assert.equal(normalized,fs.readFileSync(__dirname+'/redline-chrome-startup.cjs','utf8'));
  const original=trace.integrate(),composed=boundary.integrate();
  const action=s=>s.slice(s.indexOf('async function execute('),s.indexOf('(async()=>{\n serverAcquisition'));
  assert.equal(action(original),action(composed),'actual input/capture body unchanged');
  // Actual filesystem sinks: no inherited stream, existing FIFO, symlink,
  // or absent directory can turn diagnostic failure into a startup exception.
  const sinks=fs.mkdtempSync(base+'/sinks-');
  cp.execFileSync('mkfifo',[sinks+'/fifo']);fs.symlinkSync(sinks+'/missing',sinks+'/symlink');
  for(const file of [sinks+'/fifo',sinks+'/symlink',sinks+'/absent/file']){
    const d=boundary.create({write:value=>boundary.writeDiagnostic(file,value)});d.terminal('primary failure');const began=performance.now();d.flush();
    assert(d.status().writeError);assert(performance.now()-began<500);assert.equal(d.status().firstTerminal.reason,'primary failure');
  }
  const bounded=boundary.create({write:value=>boundary.writeDiagnostic(sinks+'/bounded.json',value)});
  for(let i=0;i<2000;i++)bounded.check({exit:null,waitError:null});bounded.terminal('first');bounded.terminal('second');bounded.flush();
  assert(bounded.status().dropped>0);assert.equal(bounded.status().firstTerminal.reason,'first');assert(fs.statSync(sinks+'/bounded.json').size<128*1024);
  // Independent observable deadline covers each detached runner and descendants.
  const results=[];
  for(const mode of ['ready','never','late','exit','invalid','writefailure','inherited'])for(const old of [true,false]){
    const dir=fs.mkdtempSync(base+'/'+(old?'old-':'new-')+mode+'-');
    const watchdog=cp.spawn(process.execPath,['-e',`let pid;console.log('ARMED');const t=setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGKILL')}catch{};process.exit(9)},24000);process.stdin.on('data',b=>{if(b.toString().trim()==='done'){clearTimeout(t);process.exit(0)}else pid=Number(b)});`],{stdio:['pipe','pipe','pipe']});
    assert(String((await once(watchdog.stdout,'data'))[0]).includes('ARMED'));
    const watchdogExit=once(watchdog,'exit'),watchdogEOF=once(watchdog,'close');
    const args=[__filename,'--runner',mode,old?'old':'new',dir];
    const subreaper="import ctypes,subprocess,sys,os,json\nassert ctypes.CDLL(None).prctl(36,1,0,0,0)==0\np=subprocess.Popen(sys.argv[1:]);code=p.wait();waits=[]\nwhile True:\n try:\n  pid,status=os.waitpid(-1,0);waits.append(dict(pid=pid,status=status))\n except ChildProcessError:break\nprint(json.dumps(dict(adoptedActualWaits=waits)),flush=True)\nassert waits and all(w['status']==0 for w in waits)\nsys.exit(code)";
    const child=cp.spawn(mode==='inherited'?'python3':process.execPath,mode==='inherited'?['-c',subreaper,process.execPath,...args]:args,{detached:true,stdio:['ignore','pipe','pipe']});
    const actualWait=once(child,'exit'),eof=once(child,'close');watchdog.stdin.write(child.pid+'\n');
    const streams=['stdout','stderr'].map(n=>require('node:stream/promises').pipeline(child[n],fs.createWriteStream(dir+'/runner-'+n+'.log')));
    const [code,signal]=await actualWait;await eof;await Promise.all(streams);watchdog.stdin.write('done\n');const [watchdogCode]=await watchdogExit;await watchdogEOF;
    const receipt={mode,old,dir,code,signal,watchdogCode,actualWait:true,separateStreamEOF:true};fs.writeFileSync(dir+'/joins.json',JSON.stringify(receipt));assert.equal(code,0,dir);assert.equal(watchdogCode,0);results.push(receipt);console.log('PASS '+(old?'old missing FAIL ':'new retained PASS ')+mode);
  }
  for(const mode of ['never','late','writefailure']){
    const pair=results.filter(r=>r.mode===mode).map(r=>JSON.parse(fs.readFileSync(r.dir+'/result.json')));
    assert.deepEqual(pair.map(r=>[r.startup.polls,r.statAtTerminal,r.readAtTerminal]),[[100,101,0],[100,101,0]],'exact old/new existing IO counts');
    assert(pair.every(r=>r.events.every(e=>e.kind!=='WebSocket')),'no late CDP admission');
  }
  fs.writeFileSync(base+'/results.json',JSON.stringify({passed:true,results,nativeCause:'UNKNOWN',browser:false}));
}
if(process.argv[2]==='--runner')runner(process.argv[3],process.argv[4]==='old',process.argv[5]).catch(e=>{console.error(e);process.exitCode=1;});
else suite().catch(e=>{console.error(e);process.exitCode=1;});
