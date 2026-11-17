'use strict';
// An authored PE with a genuinely slow USER pump, not a host-side frozen queue.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
 const cp=require('node:child_process'),crypto=require('node:crypto'),net=require('node:net'),{once}=require('node:events');
const {startControlSession}=require('./control-session');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(delay=0){
 const b=require('./test-disciples2-native-paint-binding.cjs').fixture(false),raw=r=>r-0x1000+0x400;
 const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 function asm(rva,work){
  const a=[],labels=new Map(),fix=[];const emit=(...x)=>a.push(...x),push=n=>emit(0x68,...u32(n));
  const api={Sleep:0x401204,CreateThread:0x401208,SetWindowTextA:0x40131c,PostQuitMessage:0x401320,DefWindowProcA:0x401318};
  const call=n=>emit(0xff,0x15,...u32(api[n])),label=n=>labels.set(n,a.length);
  const jump=(n,c)=>{emit(...(c?[0x0f,c]:[0xe9]));fix.push([a.length,n]);emit(0,0,0,0);};
  work({emit,push,call,label,jump});const out=Buffer.from(a);for(const [o,n]of fix)out.writeInt32LE(labels.get(n)-o-4,o);
  assert(out.length<0x400);b.fill(0,raw(rva),raw(rva+0x400));out.copy(b,raw(rva));
 }
 // Replace the original GetMessage argument sequence with a trampoline. All
 // original branch destinations and import addresses remain valid.
 const pump=Buffer.from([0x68,...u32(0),0x68,...u32(0),0x68,...u32(0),0x68,...u32(0x403640),0xff,0x15,...u32(0x40130c)]);
 const at=b.indexOf(pump);assert(at>=raw(0x2000)&&at<raw(0x2400));const resume=0x400000+at-0x400+0x1000+pump.length;
 // Real GetTickCount loop: Sleep is a scheduler wait and can complete in
 // synthetic batch time even with --real-ticks. This authored loop measures
 // the existing real-ticks clock without changing its source or rate.
 b.writeUInt32LE(0x1c00,raw(0x120c));b.write('GetTickCount\0',raw(0x1c02));
 const wait=[0xff,0x15,...u32(0x40120c),0x89,0xc3,0xff,0x15,...u32(0x40120c),0x29,0xd8,0x3d,...u32(delay),0x72,0xf1];
 const stub=Buffer.from([...wait,...pump,0xe9,...u32(resume-(0x402c00+wait.length+pump.length+5))]);
 stub.copy(b,raw(0x2c00));b[at]=0xe9;b.writeInt32LE(0x402c00-(resume-pump.length+5),at+1);
 for(const [r,s]of [[0x3200,'DOWN handled'],[0x3240,'UP after DOWN'],[0x3280,'UP WITHOUT DOWN']])b.write(s+'\0',raw(r));
 asm(0x2400,({emit,push,call,label,jump})=>{
  emit(0x55,0x89,0xe5,0x81,0x7d,12,...u32(0x201));jump('up',0x85);
  emit(0xc7,0x05,...u32(0x403620),...u32(1));push(0x403200);jump('text');
  label('up');emit(0x81,0x7d,12,...u32(0x202));jump('key',0x85);
  emit(0x83,0x3d,...u32(0x403620),0);jump('bad',0x84);push(0x403240);jump('text');
  label('bad');push(0x403280);label('text');emit(0xff,0x75,8);call('SetWindowTextA');jump('zero');
  label('key');emit(0x81,0x7d,12,...u32(0x101));jump('default',0x85);emit(0x83,0x7d,16,27);jump('default',0x85);
  push(0);call('PostQuitMessage');jump('zero');
  label('default');for(const n of [20,16,12,8])emit(0xff,0x75,n);call('DefWindowProcA');emit(0xc9,0xc2,16,0);
  label('zero');emit(0x31,0xc0,0xc9,0xc2,16,0);
 });
 // A real native Worker remains alive without altering public UI captions.
 asm(0x2800,({push,call,label,jump})=>{label('wait');push(1000);call('Sleep');jump('wait');});
 return b;
}
function units(){
 const {createGuardedInput}=require('../lib/cli-guarded-input');
 class Renderer{}require('../lib/renderer-input').installInputHandlers(Renderer);
 const checks=[];
 for(const mode of ['normal','slow','release-before-handler','release-before-poll','deadline','focus','target','retirement','owner','unknown','inspection-unknown','no-edge','forged-edge']){
  const r=new Renderer();r.inputQueue=[];r.windows={};r._buttonHoldFloorMs=-1;
  r._coordinatePressHoverMs=30;let context='reviewed',healthy=true,clock=1000,physical=false,ups=0;
  r._inputNowMs=()=>clock;
  const refs={queue:r.inputQueue,renderer:r};
  const g=createGuardedInput({nativeDelivery:true,now:()=>clock,monotonic:()=>clock,
   snapshot:()=>({healthy,refs}),captureDelivery:()=>context,validateDelivery:c=>{if(context==='throw')throw Error('inspection');return c===context;},
   cleanup:()=>{physical=false;ups++;r.inputQueue.push({msg:0x202,hwnd:1,wParam:0,lParam:0});}});
  const o=g.bind(),t=g.prepare({...o,nonce:mode,deadline:clock+1000,reviewed:true},{action:'mousedown'});
  let effects=0;const down={msg:0x201,hwnd:1,wParam:1,lParam:1};
  const apply=()=>{effects++;physical=true;r.inputQueue.push({msg:0x200,hwnd:1,wParam:0,lParam:1,mouseX:1,mouseY:1});if(mode!=='no-edge')r.inputQueue.push(down);if(mode==='unknown')throw Error('after enqueue');};
  if(mode==='release-before-handler')g.release(o.owner);
  g.consume(t,apply);
  if(mode==='release-before-handler'){assert.equal(effects,0);assert(!t.consumed);}
  else if(['unknown','no-edge'].includes(mode)){assert.equal(t.state,'UNKNOWN');assert(!physical);assert(!t.consumed);}
  else{
   assert.equal(t.state,'DELIVERY_PENDING');assert(!t.consumed);
   // An unrelated lookalike cannot acknowledge this exact queued edge.
   g.delivered({...down});assert(!t.consumed);
   if(mode==='release-before-poll')g.release(o.owner);
   if(mode==='deadline')clock+=1000;
   if(['focus','target'].includes(mode))context=mode;
   if(mode==='retirement')healthy=false;
   if(mode==='inspection-unknown')context='throw';
   if(mode==='owner')g.bind();
   g.sweep();
   const got=[];
   for(let i=0;i<5;i++){
    g.sweep();const e=r.takeInput();if(!e)break;
    if(g.delivered(e)!==false)got.push(e.msg);
   }
   if(['normal','slow','forged-edge'].includes(mode)){
    if(mode==='slow'){assert(!t.consumed,'hover idle barrier must defer DOWN');clock+=30;}
    else clock+=30;
    for(let i=0;i<5;i++){g.sweep();const e=r.takeInput();if(!e)break;if(g.delivered(e)!==false)got.push(e.msg);}
    assert(t.consumed);assert.equal(t.nativeMessage.msg,0x201);g.release(o.owner);
    const e=r.takeInput();assert.equal(e.msg,0x202);assert.equal(g.delivered(e),undefined);
    got.push(e.msg);assert(got.indexOf(0x201)<got.indexOf(0x202));
   }else{assert(!got.includes(0x201));assert(!t.consumed);assert.equal(t.state,mode==='inspection-unknown'?'UNKNOWN':'CANCELLED');assert(!physical);assert.equal(ups,1);}
  }
  assert.throws(()=>g.prepare({...o,nonce:mode,deadline:clock+1000,reviewed:true},{}),/nonce/);
  g.consume(t,apply);assert(effects<=1,'cancelled or consumed intent never replays');g.close();checks.push(mode);
 }
 console.log('PASS production guard + real renderer queue: '+checks.join(', '));return checks;
}
async function transportUnits(){
 const {createGuardedInput}=require('../lib/cli-guarded-input'),{startControlServer}=require('../lib/control-server');
 const queue=[],refs={queue};let ticket,down;
 const g=createGuardedInput({nativeDelivery:true,snapshot:()=>({healthy:true,refs}),cleanup:()=>queue.push({msg:0x202})}),o=g.bind();
 const server=startControlServer({port:0,commandTimeoutMs:40,onCommand:()=>{
  ticket=g.prepare({...o,nonce:'after-handler-timeout',reviewed:true,deadline:Date.now()+1000},{action:'mousedown'});
  down={msg:0x201,hwnd:1,wParam:1};g.consume(ticket,()=>queue.push(down));return g.wait(ticket);
 }});
 await once(server.server,'listening');
 try{
  const response=await fetch('http://127.0.0.1:'+server.server.address().port+'/ctl',{method:'POST',body:'{}'}),body=await response.json();
  assert.equal(response.status,504);assert.equal(body.guarded.state,'UNKNOWN');assert(!body.guarded.consumed);
  assert.deepEqual(queue.map(e=>e.msg),[0x202]);g.delivered(down);assert.equal(g.status(ticket.nonce).state,'UNKNOWN');assert(!ticket.consumed);
 }finally{g.close();server.close();}
 const q=[],h=createGuardedInput({nativeDelivery:true,snapshot:()=>({healthy:true,refs:{queue:q}}),cleanup:()=>{}}),b=h.bind();
 const t=h.prepare({...b,nonce:'coalesced',reviewed:true,deadline:Date.now()+1000},{action:'mousemove'}),move={msg:0x200,hwnd:1};
 h.consume(t,()=>q.push(move));q[0]={...move};h.delivered(q.shift());assert(!t.consumed);h.release(b.owner);assert.equal(t.state,'CANCELLED');h.close();
 console.log('PASS actual transport timeout after host application: sticky UNKNOWN, purged DOWN, independent UP, no forged consumption; coalesced lookalike MOVE cannot acknowledge original');
}
async function native(out,{delay=0,baseline=false,early=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
 const image=path.join(out,'slow-pump.exe'),bytes=fixture(delay);fs.writeFileSync(image,bytes,{flag:'wx'});
 save('source.json',{repositoryHeadObserved:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sealedManifest:globalThis.__disciples2Manifest||null,moduleSHA256:hash(fs.readFileSync('build/wine-assembly.wasm')),fixtureSHA256:hash(bytes),node:process.version});
 fs.writeFileSync(path.join(out,'runtime.patch'),cp.execFileSync('git',['diff','--binary','--','lib/cli-guarded-input.js','test/run.js','test/test-cli-guarded-input.js','tools/disciples2-current-controller.py','test/test-disciples2-current-quest.cjs']),{flag:'wx'});
 const wd=cp.spawn(process.execPath,['-e',`let p;const t=setTimeout(()=>{console.log('FIRED');if(p)try{process.kill(-p,'SIGTERM')}catch{}},45000);console.log('ARMED');process.stdin.on('data',b=>p=+b);process.stdin.on('end',()=>clearTimeout(t));`]);
 let wo='',we='';wd.stdout.on('data',b=>wo+=b);wd.stderr.on('data',b=>we+=b);const ww=once(wd,'close');
 while(!wo.includes('ARMED'))await pause(5);save('watchdog-armed.json',{pid:wd.pid,at:Date.now(),deadlineMs:45000,beforeNative:true});
 const reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const s=startControlSession(['test/run.js','--exe='+image,'--no-build','--threads','--real-ticks','--screen=1024x712','--control-stdin','--control='+port,'--max-seconds=40','--max-batches=100000000','--stuck-after=0','--trace-thread','--trace-input-dispatch','--quiet-api','--quiet-blocks','--no-close'],{spawnOptions:{detached:true}});
 wd.stdin.write(String(s.child.pid));let release;
 try{
  let snap;for(let i=0;i<100;i++){snap=await s.send({action:'snapshot'});if(snap.focusWindow?.live&&snap.windows.length>=2)break;await pause(30);}
  assert(snap.focusWindow?.live);save('initial.json',snap);assert.equal(snap.focusWindow.threadId,1);
  const nonce=crypto.randomUUID();
  // Observations only: no guest steps, queue suppression, or private commands.
  await s.send({action:'eval',code:`globalThis.deliveryObserved=[];globalThis.deliveryDown=renderer.handleMouseDown;renderer.handleMouseDown=function(...a){const r=deliveryDown.apply(this,a);deliveryObserved.push({at:Date.now(),kind:'handler-return',queue:this.inputQueue.map(e=>({msg:e.msg,hwnd:e.hwnd}))});return r};true`});
  const bound=await s.send({action:'guarded-bind'});
  const fallback=Date.now()+1500;
  release=cp.spawn(process.execPath,['-e',`let due=${fallback};console.log('ARMED');process.stdin.on('data',b=>{due=Math.min(due,+b)});const poll=setInterval(async()=>{if(Date.now()<due)return;clearInterval(poll);try{const sent=Date.now(),r=await fetch('http://127.0.0.1:${port}/ctl',{method:'POST',signal:AbortSignal.timeout(250),body:JSON.stringify({action:'guarded-release',owner:${JSON.stringify(bound.owner)}})});console.log(JSON.stringify({sent,at:Date.now(),reply:await r.json()}));process.stdin.destroy()}catch(e){console.error(e);process.exit(1)}},2);`]);
  let ro='',re='';release.stdout.on('data',b=>ro+=b);release.stderr.on('data',b=>re+=b);const rw=once(release,'close');
  while(!ro.includes('ARMED'))await pause(2);save('release-armed.json',{pid:release.pid,at:Date.now(),fallback,beforeDown:true});
  const sent=Date.now();
  const pending=s.send({action:'guarded-input',cmd:'mousedown:500:220',guard:{...bound,nonce,reviewed:true,deadline:sent+3000}});
  const receipt=await pending;save('down.json',{sent,returnedAt:Date.now(),receipt});
  if(!early&&receipt.consumed)release.stdin.write(String(receipt.consumedAt+100));
  const [releaseExit,releaseSignal]=await rw;save('release-wait.json',{pid:release.pid,exit:releaseExit,signal:releaseSignal,actualWait:true,stdoutEOF:release.stdout.readableEnded,stderrEOF:release.stderr.readableEnded,stdout:ro,stderr:re});assert.equal(releaseExit,0);
  await pause(Math.max(800,delay*6));snap=await s.send({action:'snapshot'});save('final.json',snap);
  save('observed.json',await s.send({action:'eval',code:'deliveryObserved'}));
  save('receipt.json',await s.send({action:'guarded-status',nonce}));
  const title=snap.windows.find(w=>w.hwnd===snap.mainHwnd)?.title;
  save('assertions.json',{delay,actualWorkerHelper:true,inputConsumer:'main VM',baseline,fixtureSHA256:hash(bytes),title,receiptBoundary:receipt.receiptBoundary||'host-handler'});
  if(baseline){assert(receipt.consumed);assert.equal(title,'UP WITHOUT DOWN');}
  else if(early){assert(!receipt.consumed);assert.equal(receipt.state,'CANCELLED');assert.equal(title,'UP WITHOUT DOWN');}
  else{assert(receipt.consumed);assert.equal(receipt.receiptBoundary,'native-input-return');assert.equal(receipt.nativeMessage.msg,0x201);assert.equal(title,'UP after DOWN');assert(receipt.consumedAt-sent<=500);}
  assert(s.output().includes('spawned WORKER thread'),'actual native guest Worker helper must run');
  await s.send({cmd:'png:'+path.join(out,'post-release.png')});
  // Authored public Escape route, no private game command.
  await s.send({cmd:'keydown:27'});await pause(40);await s.send({cmd:'keyup:27'});
  s.child.stdin.end();assert.equal(await s.exited,0);
 }finally{
  if(s.child.exitCode===null&&s.child.signalCode===null)process.kill(-s.child.pid,'SIGTERM');
  await s.exited;save('native-wait.json',{pid:s.child.pid,exit:s.child.exitCode,signal:s.child.signalCode,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded});
  fs.writeFileSync(path.join(out,'native.log'),s.output(),{flag:'wx'});wd.stdin.end();const [exit,signal]=await ww;save('watchdog-wait.json',{pid:wd.pid,exit,signal,actualWait:true,stdoutEOF:wd.stdout.readableEnded,stderrEOF:wd.stderr.readableEnded,stdout:wo,stderr:we});assert.equal(exit,0);
 }
}
module.exports={fixture,native,units,transportUnits};
if(require.main===module){
 if(process.argv[2]==='--native')native(path.resolve(process.argv[3]),JSON.parse(process.argv[4]||'{}')).catch(e=>{console.error(e);process.exitCode=1;});
 else{units();assert(fixture(250).includes(Buffer.from('UP WITHOUT DOWN')));transportUnits().catch(e=>{console.error(e);process.exitCode=1;});}
}
