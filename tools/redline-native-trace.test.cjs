'use strict';
// All browser/guest services are inert. Execute exact generated consumer seams
// and the existing process/watchdog controller; never launch local Chrome.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),Module=require('node:module');
const trace=require('./redline-native-trace.cjs'),root=path.resolve(__dirname,'..');
const base=path.resolve(process.env.REDLINE_TRACE_TEST_RUN||'scratch/runs/20261109-redline-native-trace-preparation-1265/tests');
function save(name,value){fs.writeFileSync(path.join(base,name),JSON.stringify(value,null,2),{flag:'wx'});}
function whole(){
  const file=path.join(__dirname,'redline-startup.test.cjs');let source=fs.readFileSync(file,'utf8');
  source=traceReplace(source,"const callerSource = fs.readFileSync(path.join(__dirname, 'redline-browser-run.cjs'), 'utf8');","const callerSource=require('./redline-native-trace.cjs').integrate();");
  source=traceReplace(source,"for(const p of ['host.js','tools/redline-browser-run.cjs'","for(const p of [...require('./redline-native-trace.cjs').providers,'host.js','tools/redline-browser-run.cjs'");
  source=traceReplace(source,"[__filename,'--fixture-runner']","["+JSON.stringify(__filename)+",'--whole-runner']");
  source=traceReplace(source,"wrapper=fs.readFileSync(path.join(__dirname,'redline-native-fixture.cjs'),'utf8')","wrapper=require('./redline-native-trace.cjs').fixtureSource()");
  source=traceReplace(source,"args[0]===path.join(__dirname,'redline-browser-run.cjs')?","args[0]===path.join(__dirname,'redline-native-trace.cjs')?");
  source=traceReplace(source,'for(let i=0;i<3;i++)','for(let i=0;i<2;i++)');
  source=traceReplace(source,"['comma','period','quit'][i]","['comma','quit'][i]");
  source=traceReplace(source,"events.filter(e=>e==='Page.captureScreenshot').length===3","events.filter(e=>e==='Page.captureScreenshot').length===2");
  source=traceReplace(source,"if(process.argv[2]==='--fixture-runner')","if(process.argv[2]==='--whole-runner')");
  const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(source,file);return m.exports;
}
function traceReplace(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b);}
async function socket(source,mode,options={}){
  const sent=[],writes=[],timers=new Map(),jobs=[];let timer=0,clock=0;
  const wire=trace.create({write:v=>{writes.push(v);if(options.sinkFail)throw Error('sink refused');},now:()=>++clock,schedule:f=>jobs.push(f),...options});
  const send=source.match(/^function send\(.*$/m)[0];
  const receive=source.split('\n').find(s=>s.includes('ws=new WebSocket(')).split('ws.onmessage=')[1];
  const c=vm.createContext({Error,JSON,Map,Promise,nativeTrace:trace,inputWire:wire,setTimeout:(fn,ms)=>{assert.equal(ms,20000);timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext('let closing=false,id=0,cdpMousePoint=null;const pending=new Map();let ws;async function event(){};function log(){};'+send,c);
  c.socket={send:raw=>sent.push(JSON.parse(raw))};vm.runInContext('ws=socket;ws.onmessage='+receive,c);
  const command=type=>vm.runInContext(`send('Input.dispatchKeyEvent',{type:'${type}',key:','},'page')`,c);
  const reply=(q,value={},sessionId='page')=>c.socket.onmessage({data:JSON.stringify({id:q.id,sessionId,...value})});
  const a=command('keyDown'),b=command('keyUp');let settledA=false;a.then(()=>settledA=true,()=>{});b.catch(()=>{});
  if(mode==='outoforder'){reply(sent[1],{result:{up:true}});await b;assert(!settledA);reply(sent[0],{result:{down:true}});await a;}
  else if(mode==='late'){
    const reject=assert.rejects(a,/CDP UNKNOWN/);timers.get(1)();await reject;wire.terminal('first');wire.terminal('second');reply(sent[0],{result:{late:true}});reply(sent[1],{result:{}});await b;assert.equal(wire.status().firstTerminal.reason,'first');
  }else if(mode==='sessionrefusal'){
    // Existing consumer settles by ID only, even for a wrong session. Preserve
    // that behavior; retain mismatch and protocol refusal rather than repair it.
    const reject=assert.rejects(a,/session refused/);reply(sent[0],{error:{message:'session refused'}},'foreign');await reject;reply(sent[1],{result:{}});await b;
  }else{if(mode==='unmatched')reply({id:999},{result:{unknown:true}},'foreign');reply(sent[0],{result:{}});reply(sent[1],{result:{}});await Promise.all([a,b]);}
  vm.runInContext('closing=true',c);await assert.rejects(command('keyDown'),/terminal/);assert.equal(sent.length,2,'terminal guard no new send');
  while(jobs.length)jobs.shift()();wire.flush();
  const rows=writes.flatMap(v=>v.raw),retained=rows.some(r=>r.direction==='send')&&rows.some(r=>r.direction==='receive');
  if(source===trace.generated())assert(!retained,'old missing boundary FAIL');
  else if(!options.rawCap){assert(retained,'new retention PASS');assert(rows.every(r=>Number.isFinite(r.nodeMonotonicMs)));if(mode==='unmatched')assert(rows.some(r=>r.requestId===999&&!r.pendingPresent));if(mode==='sessionrefusal')assert(rows.some(r=>r.sessionId==='foreign'&&r.sessionMatches===false));if(mode==='late')assert(rows.some(r=>r.direction==='receive'&&!r.pendingPresent));}
  return {mode,retained,sent,rows,status:wire.status()};
}
async function main(){
  fs.mkdirSync(base,{recursive:true});assert(!fs.existsSync(path.join(base,'results.json')),'fresh explicit test path');
  const original=trace.generated(),instrumented=trace.integrate();
  assert.equal(original.includes('native-input-wire.jsonl'),false);
  // Check the integration's only source mutations; input/capture/ACK and hold
  // sections remain byte-identical. No CDP tracing stop or page observer added.
  assert.equal(original.slice(original.indexOf('async function execute('),original.indexOf('(async()=>{\n serverAcquisition')),instrumented.slice(instrumented.indexOf('async function execute('),instrumented.indexOf('(async()=>{\n serverAcquisition')));
  const rows=[await socket(original,'normal')];
  for(const mode of ['normal','outoforder','late','unmatched','sessionrefusal'])rows.push(await socket(instrumented,mode));
  const cap=await socket(instrumented,'normal',{rawCap:1,eventCap:1});assert(cap.status.rawDropped>0&&cap.status.dropped>0);rows.push(cap);
  const sink=await socket(instrumented,'normal',{sinkFail:true});assert(sink.status.sinkFailure.includes('sink refused'));rows.push(sink);save('socket-controls.json',rows);
  // Inert spawn receives the actual composed launch argv and output path.
  const out=path.join(base,'retrieval');fs.mkdirSync(out);const published=new Map();let actual;
  trace.launch({spawn:(...args)=>{actual=args;return {pid:123};},executable:'/usr/bin/google-chrome',argv:['--headless=new','about:blank'],options:{stdio:['ignore','pipe','pipe']},out,save:(n,v)=>published.set(n,v)});
  assert.equal(actual[0],'/usr/bin/google-chrome');assert(actual[1].includes('--trace-startup-duration=10'));assert(actual[1].includes('--trace-startup-file='+out+'/native-startup-trace.json'));assert(actual[1].includes('--trace-startup-format=json'));
  assert(published.get('native-trace-spawn.json').spawnCallElapsedMs>=0);
  const file=path.join(out,'native-startup-trace.json');const receipt={actualBrowserExit:{code:0},streamEOF:true};
  assert(!trace.retrieve(out,receipt).validKeyboardBoundary);fs.writeFileSync(file,'{');assert(!trace.retrieve(out,receipt).flushedJSON);
  fs.writeFileSync(file,JSON.stringify({traceEvents:[{name:'EventDispatch',ph:'X',ts:100,dur:10,pid:1,tid:2,args:{data:{type:'keydown'}}},{name:'EventDispatch',ph:'X',ts:700,dur:5,pid:1,tid:2,args:{data:{type:'keyup'}}},{name:'clock_sync',ph:'c',ts:99,args:{sync_id:'inert'}}]}));
  const validTrace=fs.readFileSync(file);fs.writeFileSync(file,JSON.stringify({traceEvents:[]}));assert(!trace.retrieve(out,receipt).validKeyboardBoundary);fs.writeFileSync(file,JSON.stringify({traceEvents:[{name:'EventDispatch',ph:'X',args:{data:{type:'keydown'}}},{name:'EventDispatch',ph:'X',args:{data:{type:'keyup'}}}]}));assert(!trace.retrieve(out,receipt).validKeyboardBoundary);fs.writeFileSync(file,validTrace);
  assert(!trace.retrieve(out,{}).flushedJSON);assert(!trace.retrieve(out,receipt,{maxBytes:1}).flushedJSON);
  const retrieved=trace.retrieve(out,receipt);assert(retrieved.validKeyboardBoundary&&retrieved.clockSync.length===1);assert.equal(retrieved.sha256,require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex'));save('inert-launch-retrieval.json',{published:[...published],retrieved});
  process.env.REDLINE_PRODUCTION_TEST_RUN=path.join(base,'whole-fixture');
  await whole().productionFixtureSuite(['positive','close-no-ack','wrong-live-bytes','keydown-response-delay','keydown-service-delay','release-failure']);
  const full=JSON.parse(fs.readFileSync(path.join(base,'whole-fixture/results.json')));
  for(const row of full.rows){
    const p=path.join(row.dir,'native-fixture'),launch=JSON.parse(fs.readFileSync(path.join(p,'native-trace-launch.json')));
    assert.equal(launch.executable,'/usr/bin/google-chrome');assert.equal(launch.startupDurationSeconds,10);assert(launch.argv.includes('--trace-startup-file='+p+'/native-startup-trace.json'));
    assert(fs.existsSync(path.join(p,'native-trace-retrieval.json')),'no-input joined cleanup retrieval invoked');
    assert(!fs.existsSync(path.join(p,'input-period-delivery.json')),'one comma only');
    const batches=fs.readFileSync(path.join(p,'native-input-wire.jsonl'),'utf8').trim().split('\n').map(JSON.parse),raw=batches.flatMap(v=>v.raw);
    assert(raw.some(v=>v.direction==='send'&&v.method==='Input.dispatchKeyEvent'));assert(raw.some(v=>v.direction==='receive'&&v.pendingPresent));
  }
  save('results.json',{passed:true,oldMissingBoundaryFAIL:true,newRetentionPASS:true,wholeFixtureCases:full.rows.length,nativeAttempt:false,localChrome:false,boxCreated:false,cause:'UNKNOWN'});
  console.log('PASS exact1235 old missing boundary FAIL / new retention PASS; inert raw socket controls, sink/caps, actual launch argv and no-input retrieval; six single-comma whole-controller cases');
}
if(process.argv[2]==='--whole-runner')whole();else main().catch(e=>{console.error(e);process.exitCode=1;});
