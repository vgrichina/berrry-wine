'use strict';
// Authored ordinary Win32 game: paints Quit in WM_PAINT, handles its own
// client mouse messages, and exits on UP. No native BUTTON or host command.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),net=require('node:net'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const raw=r=>r-0x1000+0x200,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(){
 const b=require('./test-sims-child-mount-native.cjs').untitledModal();
 const names=['RegisterClassA','DefWindowProcA','CreateWindowExA','GetMessageA','TranslateMessage','DispatchMessageA','ShowWindow','UpdateWindow','BeginPaint','EndPaint','DrawTextA','FillRect'];
 b.fill(0,raw(0x1940),raw(0x1980));let p=0x1b00;
 for(const [i,n]of names.entries()){b.writeUInt32LE(p,raw(0x1940+i*4));b.write(n+'\0',raw(p+2));p+=n.length+3;}
 b.fill(0,raw(0x2000),raw(0x3000));
 b.write('DrawnQuitFixture\0',raw(0x2500));b.write('Authored game drawn Quit\0',raw(0x2540));b.write('Quit\0',raw(0x2580));
 b.writeUInt32LE(0x402300,raw(0x2604));b.writeUInt32LE(0x400000,raw(0x2610));b.writeUInt32LE(6,raw(0x261c));b.writeUInt32LE(0x402500,raw(0x2624));
 for(const [i,v]of [20,20,150,80].entries())b.writeInt32LE(v,raw(0x2800+i*4));
 function asm(at,body){const a=[],labels={},fix=[];const e=(...v)=>a.push(...v),push=n=>e(0x68,...u32(n)),call=i=>e(0xff,0x15,...u32(0x401940+i*4));
  const label=n=>labels[n]=a.length,j=(op,n)=>{e(...op,0,0,0,0);fix.push([a.length-4,n]);};body({e,push,call,label,j});
  for(const [i,n]of fix){assert(n in labels);const v=Buffer.alloc(4);v.writeInt32LE(labels[n]-i-4);for(let k=0;k<4;k++)a[i+k]=v[k];}assert(a.length<0x300);b.set(a,raw(at));}
 asm(0x2000,({e,push,call,label,j})=>{
  push(0x402600);call(0);for(const n of [0,0x400000,0,0,480,640,0,0,0x90000000,0x402540,0x402500,0])push(n);call(2);e(0x89,0xc6);
  push(5);e(0x56);call(6);e(0x56);call(7);
  label('loop');for(const n of [0,0,0,0x402700])push(n);call(3);e(0x85,0xc0);j([0x0f,0x84],'exit');push(0x402700);call(4);push(0x402700);call(5);j([0xe9],'loop');
  label('exit');push(71);e(0xff,0x15,...u32(0x401900));
 });
 asm(0x2300,({e,push,call,label,j})=>{
  e(0x53,0x56,0x8b,0x5c,0x24,12);
  for(const [msg,n]of [[15,'paint'],[0x201,'down'],[0x202,'up']]){e(0x81,0x7c,0x24,16,...u32(msg));j([0x0f,0x84],n);}
  e(0xff,0x74,0x24,24,0xff,0x74,0x24,24,0xff,0x74,0x24,24,0x53);call(1);j([0xe9],'return');
  label('paint');push(0x402900);e(0x53);call(8);e(0x89,0xc6);push(5);push(0x402800);e(0x56);call(11);
  push(0x25);push(0x402800);push(-1);push(0x402580);e(0x56);call(10);push(0x402900);e(0x53);call(9);j([0xe9],'handled');
  label('down');e(0xc7,5,...u32(0x402a00),1,0,0,0);j([0xe9],'handled');
  label('up');e(0x83,0x3d,...u32(0x402a00),1);j([0x0f,0x85],'handled');
  // This is the guest's ordinary mouse handler, after actual UP delivery.
  push(0);e(0xff,0x15,...u32(0x401900));
  label('handled');e(0x31,0xc0);label('return');e(0x5e,0x5b,0xc2,16,0);
 });return b;
}
module.exports={fixture};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function run(out,mode='positive'){
 const {startControlSession}=require('./control-session');fs.mkdirSync(out,{recursive:true});
 const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
 const read=n=>JSON.parse(fs.readFileSync(path.join(out,n)));
 const exe=path.join(out,'drawn.exe');fs.writeFileSync(exe,fixture(),{flag:'wx'});
 const sourceNames=['tools/neverhood-original-current-control.py','tools/neverhood-original-current-runtime.py'];
 save('runtime-inputs.json',{sources:sourceNames.map(n=>({path:n,sha256:hash(fs.readFileSync(n))}))});
 const reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const start=Date.now()/1000;save('launch.json',{deadline:start+240,gameplayCutoff:start+60,reserveSeconds:180,rootPort:port});
 const wd=cp.spawn(process.execPath,['-e',`let pid;let t=setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGTERM')}catch{};process.exitCode=2},60000);console.log('ARMED');process.stdin.on('data',b=>pid=Number(b));process.stdin.on('end',()=>clearTimeout(t));`]);
 let wo='',we='';wd.stdout.on('data',b=>wo+=b);wd.stderr.on('data',b=>we+=b);const wc=new Promise(r=>wd.on('close',(exit,signal)=>r({exit,signal})));
 while(!wo.includes('ARMED'))await pause(5);save('watchdog-armed.json',{pid:wd.pid,prearmed:true,observable:wo,deadlineMs:60000});
 const token=crypto.randomUUID(),bootId=fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();
 const s=startControlSession(['test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks','--screen=640x480','--control-stdin','--control='+port,'--native-exit-receipt='+path.join(out,'native-exit.json'),'--native-invocation-token='+token,'--max-seconds=50','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],{cwd:process.cwd(),spawnOptions:{detached:true}});
 wd.stdin.write(String(s.child.pid));const stat=fs.readFileSync('/proc/'+s.child.pid+'/stat','utf8');const identity={pid:s.child.pid,startToken:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],invocationToken:token,bootId};save('native-pid.json',identity);
 s.child.once('close',(exit,signal)=>save('native-wait.json',{...identity,exit,signal,actualWait:true,
  stdoutEOF:mode==='exit-unsettled'?false:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded,
  ...(mode==='exit-unsettled'?{fault:'deliberately withhold stdout settlement',actualObservedStdoutEOF:s.child.stdout.readableEnded}:{}),atWaitMono:Number(process.hrtime.bigint())/1e9}));
 let i=0;
 async function ctl(args,success=true){const result=await new Promise(resolve=>{const p=cp.spawn('python3',['-B','tools/neverhood-original-current-control.py',...args],{env:{...process.env,NEVERHOOD_CURRENT_RUN:out,NEVERHOOD_CURRENT_PORT:String(port)}});let a='',b='';p.stdout.on('data',v=>a+=v);p.stderr.on('data',v=>b+=v);p.on('close',(exit,signal)=>resolve({pid:p.pid,exit,signal,stdout:a,stderr:b,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded}));});save('controller-'+(++i)+'-wait.json',{...result,args});if(success)assert.equal(result.exit,0,result.stderr);else assert.notEqual(result.exit,0);return result;}
 try{
  // Use the production passive listener ownership precondition before ctl.
  const code=`import importlib.util,pathlib; s=importlib.util.spec_from_file_location('rt','tools/neverhood-original-current-runtime.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.wait_owned_listener(pathlib.Path(${JSON.stringify(out)}),${port},30)`;
  await new Promise((resolve,reject)=>{const p=cp.spawn('python3',['-B','-c',code]);let a='',b='';p.stdout.on('data',v=>a+=v);p.stderr.on('data',v=>b+=v);p.on('close',(exit,signal)=>{save('listener-helper-wait.json',{pid:p.pid,exit,signal,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded,stdout:a,stderr:b});exit===0?resolve():reject(Error(b));});});
  await ctl(['capture','quit-scene']);const scene=read('quit-scene.json');assert.equal(scene.snapshot.windows.length,1);assert(!scene.snapshot.windows[0].isChild);
  const target=scene.snapshot.mainHwnd;
  await ctl(['review-drawn-quit','quit-scene','Authored whole image protocol fixture: game draws Quit in client region; no original review claim',target,'20','20','130','60']);
  await ctl(['bind','quit-scene']);
  if(mode==='owner-fault')await s.send({action:'eval',code:'renderer.handleMouseDown=renderer.handleMouseDown.bind(renderer);true'});
  if(mode==='stale-region'){
   const r=read('quit-scene-review.json');r.drawnRegion.binding.window.generation='stale';fs.writeFileSync(path.join(out,'quit-scene-review.json'),JSON.stringify(r));
  }
  if(mode==='cancel')await s.send({action:'eval',code:'instance.exports.set_focus(0);true'});
  await ctl(['intent','quit','quit-scene','80','50','quit'],mode==='positive');
  if(mode==='positive'){
   const obs=read('quit-observation.json');assert(obs.nativeWait.actualWait&&obs.nativeWait.stdoutEOF&&obs.nativeWait.stderrEOF);assert.equal(obs.nativeWait.exit,0);assert(read('quit-up.json').physicalUpACK);assert(read('quit-release-arm.json').armed);
   assert(read('quit-down.json').receipt.nativeMessage.consumption==='owner-user-return');
  }else{
   assert(fs.existsSync(path.join(out,'PERMANENT-UNKNOWN.json')));const ledger=fs.readFileSync(path.join(out,'requests.jsonl'));
   await ctl(['capture','forbidden'],false);await ctl(['intent','forbidden','quit-scene','80','50','quit'],false);assert.deepEqual(fs.readFileSync(path.join(out,'requests.jsonl')),ledger);
   if(mode==='late-reply'){
    await pause(800);const r=read('true-late-reply.json');assert(r.replyAt-r.at>=650);
    const up=read('quit-up.json');
    // The native guard may release on its confirmation timeout before the
    // independent fallback. An exited owner is never promoted to an UP ACK.
    assert(up.physicalUpACK||(up.outcome==='OWNER_EXITED'&&up.ownerWait.actualWait&&up.ownerWait.stdoutEOF&&up.ownerWait.stderrEOF));
    assert(read('quit-release-arm.json').armed);assert(!fs.existsSync(path.join(out,'quit-completion.json')));
   }
   if(mode==='stale-region')assert(!fs.existsSync(path.join(out,'quit-intent.json')));
   if(mode==='exit-unsettled'){assert.equal(read('native-exit.json').exitCode,0);assert(read('native-wait.json').actualObservedStdoutEOF);assert(!fs.existsSync(path.join(out,'quit-completion.json')));}
  }
  save('proof.json',{passed:true,mode,authoredGuestDrawsOwnQuit:true,ordinaryNativeUSER:true,nativeQuit:mode==='positive',terminalUNKNOWN:mode!=='positive',noLaterHTTP:mode!=='positive'});
 }finally{
  if(s.child.exitCode===null&&s.child.signalCode===null)try{process.kill(-s.child.pid,'SIGTERM')}catch(e){if(e.code!=='ESRCH')throw e;}
  await s.exited;fs.writeFileSync(path.join(out,'native.log'),s.output());wd.stdin.end();const w=await wc;save('watchdog-wait.json',{pid:wd.pid,...w,actualWait:true,stdoutEOF:wd.stdout.readableEnded,stderrEOF:wd.stderr.readableEnded,stdout:wo,stderr:we});assert.equal(w.exit,0);
 }
}
module.exports.run=run;
function regionUnit(file){
 const {createReviewedContexts}=require('../lib/cli-native-scene');
 const snapshot=JSON.parse(fs.readFileSync(file)).snapshot;
 let clock=Date.now();const contexts=createReviewedContexts({now:()=>clock,monotonic:()=>clock});
 const cap=contexts.capture(()=>structuredClone(snapshot),()=>Buffer.from('unit retained bytes, not a screenshot'),()=>{});
 const w=snapshot.windows.find(w=>w.hwnd===snapshot.mainHwnd);
 const review={contract:cap.contract,captureId:cap.captureId,pngSHA256:cap.pngSHA256,reviewed:true,reviewedAt:clock,scope:'menu',targetHwnd:w.hwnd,
  drawnRegion:{rect:[20,20,130,60],binding:{captureId:cap.captureId,pngSHA256:cap.pngSHA256,nativeProcess:snapshot.nativeProcess,window:Object.fromEntries(['hwnd','generation','processId','threadId'].map(k=>[k,w[k]]))}}};
 const event={action:'mousedown',x:80,y:50};
 contexts.verify(snapshot,review);
 for(const mutate of [r=>r.drawnRegion.binding.window.generation='wrong',r=>r.drawnRegion.binding.window.processId++,r=>r.drawnRegion.binding.window.threadId++,r=>r.drawnRegion.binding.nativeProcess.pid++,r=>r.drawnRegion.binding.captureId='old',r=>r.drawnRegion.binding.pngSHA256='old',r=>r.drawnRegion.rect[0]++,r=>r.drawnRegion.rect[2]=-1]){
  const bad=structuredClone(review);mutate(bad);assert.throws(()=>contexts.verify(snapshot,bad,event,'unit'));
 }
 for(const e of [{action:'mousedown',x:151,y:50},{action:'keydown',keyCode:13}])assert.throws(()=>contexts.verify(snapshot,review,e,'unit'));
 contexts.verify(snapshot,review,event,'unit');assert.throws(()=>contexts.verify(snapshot,review,event,'other'));
 const stale=structuredClone(snapshot);stale.windows[0].generation='stale';assert.throws(()=>contexts.verify(stale,review,event,'unit'));
 clock+=30000;assert.throws(()=>contexts.verify(snapshot,review,event,'unit'),/stale/);
 console.log('PASS native region actor/window/generation/frame/hash/rectangle/nonce/age and immutable attestation');
}
if(require.main===module){
 if(process.argv[2]==='--region-unit')regionUnit(process.argv[3]);
 else run(path.resolve(process.argv[2]),process.argv[3]).then(()=>console.log('PASS authored game-drawn Quit '+(process.argv[3]||'positive'))).catch(e=>{console.error(e);process.exitCode=1;});
}
