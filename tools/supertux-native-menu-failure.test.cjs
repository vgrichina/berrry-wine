'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const z=require('node:zlib'),crypto=require('node:crypto'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),run=process.env.MENU_FAILURE_RUN;
assert(run&&path.isAbsolute(run),'explicit evidence directory; no browser fixture');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const originalRead=fs.readFileSync;
const read=p=>originalRead(p),json=p=>JSON.parse(z.gunzipSync(read(p)));
const pins=JSON.parse(read(run+'/runtime-pins.json'));
const manifest=json(run+'/composition-pins.json.gz');
const compositionPath='tools/supertux-native-driver-composition.cjs';
const current=read(root+'/'+compositionPath);
manifest.files=manifest.files.map(p=>p.path===compositionPath?{...p,size:current.length,sha256:sha(current)}:p);
// The production canonical resolver uses accepted published blobs in place.
fs.readFileSync=function(p,options){
 const pin=pins.files.find(x=>path.resolve(root,x.path)===path.resolve(String(p)));
 if(pin?.source.kind==='published-git-blob'&&pin.path!==compositionPath){
  const b=cp.execFileSync('git',['show',pin.source.commit+':'+pin.path],{maxBuffer:32*1024*1024});
  return typeof options==='string'?b.toString(options):b;
 }
 return originalRead(p,options);
};
const composition=require('./supertux-native-driver-composition.cjs');
const composed=composition.compose({root,manifest});
const productionCall="await require(root+'/tools/supertux-native-driver-composition.cjs').consumeTerminal(t,out,n,execute)";
assert(composed.source.includes(productionCall),'production numbered loop must notify terminal senders');
fs.readFileSync=originalRead;
const start=composed.source.indexOf('async function execute(c,markDispatch){'),end=composed.source.indexOf('\n(async()=>',start);
assert(start>0&&end>start);
const input=require('../scratch/runs/20261108-supertux-short-step-progression-2236/input.cjs');
const transport=require('../scratch/runs/20261108-supertux-short-step-progression-2236/transport.cjs');
const image=Buffer.from('offline menu fixture; never a native gameplay frame');
const review={label:'menu',sha256:sha(image),identity:{offline:true},review:'Offline stale menu reproduction'};
let effects=0,stale=true;
const cause=Object.assign(Error('stale scene refused'),{code:'STALE_SCENE_BEFORE_DISPATCH'});
const context={session:{check:()=>{}},root,assert,Date,Number,JSON,Promise,Buffer,deadline:Date.now()+30000,latest:review,out:'/offline',sha,
 fs:{readFileSync:p=>p.endsWith('.png')?image:JSON.stringify(review)},
 require:require('node:module').createRequire(composed.filename),
 chain:{admit:async(r,fn)=>{if(stale)throw cause;return fn({offline:true});}},
 save:()=>{},send:async()=>{effects++;},pageSession:'offline',pulse:input.pulse,wait:async()=>{},capture:async()=>{effects++;}};
const execute=vm.runInNewContext('('+composed.source.slice(start,end)+')',context);
const command={id:'map-down',action:'key',label:'map-down',waitMs:100,keys:['ArrowDown'],holdMs:100,reviewRef:'menu'};
(async()=>{
 const fixture=run+'/menu-failure-fixture-'+process.pid;fs.mkdirSync(fixture);fs.mkdirSync(fixture+'/commands');
 fs.writeFileSync(fixture+'/commands/0.json.gz',z.gzipSync(JSON.stringify(command)),{flag:'wx'});
 await assert.rejects(composition.consumeTerminal(transport,fixture,0,execute),e=>e.cause===cause&&!e.code&&/native menu action UNKNOWN/.test(e.message));
 assert.equal(effects,0);assert(fs.existsSync(fixture+'/first-failure.json'));
 const failedAck=JSON.parse(fs.readFileSync(fixture+'/reply-0.json'));
 assert.equal(failedAck.ok,false);assert.equal(failedAck.id,command.id);assert.equal(failedAck.noReplay,true);
 assert.equal(failedAck.refreshRequired,undefined,'terminal failure cannot authorize refresh');
 fs.writeFileSync(fixture+'/commands/1.json.gz',z.gzipSync(JSON.stringify({...command,id:'later'})),{flag:'wx'});
 await assert.rejects(composition.consumeTerminal(transport,fixture,1,execute),/UNKNOWN\/partial closure/);
 assert.equal(effects,0,'no later input after failed owned menu command');
 stale=false;let marked=0;await execute({...command,id:'normal'},()=>marked++);
 assert.equal(marked,1);assert.equal(effects,3,'normal ArrowDown pair plus fresh capture unchanged');
 assert.equal(input.physical.size,0);
 const generic=Error('identity changed');await assert.rejects(composition.runBoundAction({admit:async()=>{throw generic;}},review,()=>{}),e=>e.cause===generic&&!e.code);

 // The real retained sender formerly waited its entire 30-second deadline.
 // Run it in a Node child, and consume through the exact production call.
 const prompt=fixture+'/prompt';fs.mkdirSync(prompt);fs.mkdirSync(prompt+'/commands');
 const transportPath=require.resolve('../scratch/runs/20261108-supertux-short-step-progression-2236/transport.cjs');
 const script=`const t=require(${JSON.stringify(transportPath)});t.request(${JSON.stringify(prompt)},'pending',${JSON.stringify({...command,id:'pending'})},30000).then(()=>{process.exitCode=2;},async error=>{console.log(String(error));try{await t.request(${JSON.stringify(prompt)},'later',${JSON.stringify({...command,id:'later'})},30000);process.exitCode=3;}catch(e){console.log(String(e));process.exitCode=1;}});`;
 const child=cp.spawn(process.execPath,['-e',script],{stdio:['ignore','pipe','pipe']});
 const stat=fs.readFileSync('/proc/'+child.pid+'/stat','utf8');
 const identity={pid:child.pid,start:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19]};
 let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const terminal=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
 const limit=setTimeout(()=>child.kill('SIGKILL'),5000);
 let senderTerminal;
 try{
  const until=Date.now()+3000;
  while(!fs.existsSync(prompt+'/commands/0.json.gz')&&Date.now()<until)await new Promise(r=>setTimeout(r,5));
  assert(fs.existsSync(prompt+'/commands/0.json.gz'));
  stale=true;
  const call=vm.runInNewContext('(async()=>'+productionCall+')',{
   root,require,t:transport,out:prompt,n:0,execute});
  const failedAt=Date.now();
  await assert.rejects(call(),e=>e.cause===cause);
  senderTerminal=await terminal;
  senderTerminal.elapsedMs=Date.now()-failedAt;
  assert.equal(senderTerminal.code,1);assert.equal(senderTerminal.signal,null);
  assert(senderTerminal.elapsedMs<1000,'failure must reach sender promptly');
  assert.match(stdout,/command failed/);assert.match(stdout,/UNKNOWN\/partial closure/);
  assert.equal(stderr,'');assert(!fs.existsSync(prompt+'/commands/1.json.gz'));
  assert(!fs.existsSync(prompt+'/writer.lock'));assert.equal(effects,3);
 }finally{clearTimeout(limit);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await terminal;}
 fs.writeFileSync(run+'/menu-failure-sender-wait.json.gz',z.gzipSync(JSON.stringify({...identity,...senderTerminal,stdout,stderr,actualClose:true,stdoutEOF:true,stderrEOF:true})),{flag:'wx'});

 // Notification failures preserve the original cause and never invent success.
 const noRecord=fixture+'/no-record';fs.mkdirSync(noRecord);
 await assert.rejects(composition.consumeTerminal({consume:async()=>{throw generic;},publish:()=>assert.fail('no terminal record')},noRecord,0,execute),e=>e===generic);
 const existing=fs.readFileSync(fixture+'/reply-0.json');
 await assert.rejects(composition.consumeTerminal({consume:async()=>assert.fail('terminal consumer must stay closed'),publish:()=>assert.fail('existing reply must remain')},fixture,0,execute),/UNKNOWN\/partial closure/);
 assert.deepEqual(fs.readFileSync(fixture+'/reply-0.json'),existing);
 const success=fixture+'/success';fs.mkdirSync(success);fs.mkdirSync(success+'/commands');
 const successReply=transport.request(success,'normal',{...command,id:'normal'},30000);
 stale=false;await composition.consumeTerminal(transport,success,0,execute);
 assert.deepEqual(await successReply,{ok:true,id:'normal'});
 assert.equal(effects,6);assert(!fs.existsSync(success+'/first-failure.json'));
 assert(!fs.existsSync(success+'/writer.lock'));
 const report={passed:true,actualComposedExecute:true,actualNumberedConsumer:true,actualProductionLoopCall:true,staleMenuEffects:0,firstFailureSticky:true,noSuccessOrRefreshAck:true,promptFailureReply:true,senderTerminal,laterInputEffects:0,normalKeyPairAndCapture:true,physicalPending:0,noBrowserOrOriginal:true,composedSha256:composed.sha256};
 fs.writeFileSync(run+'/menu-failure-focused.json.gz',z.gzipSync(JSON.stringify(report)),{flag:'wx'});console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
