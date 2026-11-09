'use strict';
// Controller only: the tracked production caller owns every browser/CDP operation.
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const assert=require('node:assert/strict'),zlib=require('node:zlib');
const {pipeline}=require('node:stream/promises');
const {once}=require('node:events');
const {observeChild}=require('./redline-fixture-shutdown.cjs');
const run=path.resolve(process.env.REDLINE_RUN),out=run+'/native-fixture';
const deadline=Number(process.env.BROWSER_DEADLINE);
assert(Number.isFinite(deadline)&&deadline>Date.now()&&deadline-Date.now()<30*60000,'immutable browser deadline required');
const transport=require(run+'/transport.cjs'),wait=ms=>new Promise(r=>setTimeout(r,ms));
const save=(n,v)=>fs.writeFileSync(run+'/'+n,JSON.stringify(v,null,2),{flag:'wx'});
async function main(){
 // Prearm an independent process before launching the caller. It receives the
 // new process group once created, kills it on deadline/controller EOF, and is
 // explicitly disarmed only after the actual child wait and separate pipe EOF.
 const watchdog=cp.spawn(process.execPath,['-e',String.raw`
  let group,timer;const kill=()=>{if(group)try{process.kill(-group,'SIGKILL')}catch{};process.exit(1)};
  timer=setTimeout(kill,Math.max(1,Number(process.argv[1])-Date.now()));
  process.stdin.setEncoding('utf8');let input='';process.stdin.on('data',s=>{input+=s;let n;while((n=input.indexOf('\n'))>=0){const line=input.slice(0,n);input=input.slice(n+1);if(line==='done'){clearTimeout(timer);process.exit(0)}if(line==='stop')kill();group=Number(line);}});
  process.stdin.on('end',kill);
  process.stdout.write('armed\n');
 `,String(deadline+30000)],{stdio:['pipe','pipe','pipe']});
 const watchdogExit=observeChild(watchdog);
 watchdog.stdin.on('error',()=>{}); // Its actual wait below is authoritative.
 let streamFailure;
 const joins=(child,label)=>[child.stdout,child.stderr].map((s,i)=>{const joined=pipeline(s,zlib.createGzip(),fs.createWriteStream(run+'/'+label+'-'+['stdout','stderr'][i]+'.gz',{flags:'wx'}));joined.catch(e=>{streamFailure??=e;});return joined;});
 const watchdogEOF=joins(watchdog,'fixture-watchdog');
 await Promise.race([once(watchdog.stdout,'data'),watchdogExit.then(()=>{throw Error('watchdog exited before arming');})]);
 const child=cp.spawn(process.execPath,[path.join(__dirname,'redline-browser-run.cjs')],{detached:true,env:{...process.env,REDLINE_NATIVE_FIXTURE:'1'},stdio:['ignore','pipe','pipe']});
 watchdog.stdin.write(child.pid+'\n');
 const exit=observeChild(child),eof=joins(child,'fixture-caller');
 let exited=false;exit.finally(()=>{exited=true;}).catch(()=>{});
 const check=()=>{if(streamFailure)throw streamFailure;assert(!exited,'production caller exited before ACK');assert(Date.now()<deadline,'fixture controller deadline');for(const name of ['first-browser-failure.json','first-failure.json'])assert(!fs.existsSync(out+'/'+name),'production terminal failure: '+name);};
 let failure,receipt;
 try{
  while(!fs.existsSync(out+'/ready.json')){check();await wait(25);}
  for(const [key,label] of [[',','comma'],['.','period']]){
   check();const capture=JSON.parse(fs.readFileSync(out+'/latest.json'));
   // Automated fixture assertions review synthetic pixels only; no original
   // gameplay review or input admission is manufactured here.
   transport.publish(out+'/'+capture.label+'-review.json',{...capture,review:'Synthetic fixture control; verify authenticated owner and ordinary input release.'});
   const ack=await transport.request(out,label,{action:'key',key,holdMs:600,waitMs:0,label,reviewRef:capture.label});
   assert(ack.ok&&ack.id===label,'exact input/capture ACK');
  }
  const ack=await transport.request(out,'quit',{action:'quit'});assert(ack.ok&&ack.id==='quit','ordinary quit ACK');
 }catch(e){failure=e;if(!['first-browser-failure.json','first-failure.json'].some(n=>fs.existsSync(out+'/'+n)))child.kill('SIGTERM');}
 finally{
  receipt=await exit;const pipes=await Promise.allSettled(eof);
  let joinedShutdown;try{joinedShutdown=JSON.parse(fs.readFileSync(out+'/shutdown.json'));}catch{}
  const disarm=!!(joinedShutdown?.actualBrowserExit&&joinedShutdown.streamEOF);
  watchdog.stdin.end(disarm?'done\n':'stop\n');const watched=await watchdogExit,watchPipes=await Promise.allSettled(watchdogEOF);
  save('fixture-process-joins.json',{caller:receipt,callerStdoutEOF:pipes[0].status==='fulfilled',callerStderrEOF:pipes[1].status==='fulfilled',watchdog:watched,watchdogStdoutEOF:watchPipes[0].status==='fulfilled',watchdogStderrEOF:watchPipes[1].status==='fulfilled'});
  assert.equal(watched.code,0,'independent watchdog must be explicitly disarmed and joined');
  if(streamFailure)throw streamFailure;
 }
 if(failure)throw failure;
 assert.equal(receipt.code,0);assert(fs.existsSync(out+'/cleanup.json'));
 const shutdown=JSON.parse(fs.readFileSync(out+'/shutdown.json'));assert.equal(shutdown.actualBrowserExit.code,0);assert(shutdown.streamEOF&&!shutdown.terminal);
 save('native-qualification.json',{passed:true,productionCaller:true,startup:true,commaPeriod:true,ordinaryQuitACK:true,nativeLifetime:'REVOKED',allwriters:'UNKNOWN',edictABA:'UNKNOWN'});
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
