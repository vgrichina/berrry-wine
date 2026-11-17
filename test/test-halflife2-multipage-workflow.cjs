'use strict';
// Real authored DLGPROC replaces its Next BUTTON on every ordinary WM_COMMAND.
// The full released CLI controller must inspect each new captured HWND.
const fs=require('node:fs'),assert=require('node:assert/strict');
function fixture({transitionDelayMs=0,childPages=false}={}){
 const b=require('./test-halflife2-native-wizard.cjs').dialogFixture(),raw=r=>r-0x1000+0x200;
 const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 for(const [slot,r,name]of [[0x1964,0x1e00,'DestroyWindow'],[0x1968,0x1e30,'CreateWindowExA'],[0x196c,0x1e60,'SetFocus'],
  [0x1970,0x1e90,'GetAsyncKeyState'],[0x1974,0x1ec0,'SetTimer'],[0x1978,0x1ee0,'KillTimer'],[0x197c,0x1f00,'GetMessageA'],
  [0x1980,0x1f30,'TranslateMessage'],[0x1984,0x1f60,'DispatchMessageA']]){
  b.writeUInt32LE(r,raw(slot));b.write(name+'\0',raw(r+2));
 }
 b.writeUInt32LE(0,raw(0x1988));
 if(childPages)b.writeUInt32LE(0x50000400,raw(0x1500));
 b.write('Wizard: Welcome\0',raw(0x27a0));
 b.write('Wizard: Internet Required\0',raw(0x2580));
 b.write('Authored page two: current Next has a new HWND.\0',raw(0x25c0));
 b.write('Wizard: SubscriberAgreement\0',raw(0x2700));
 b.write('BUTTON\0',raw(0x2740));b.write('Next >\0',raw(0x2760));
 b.write('Authored wizard owner\0',raw(0x2780));
 // Modal pages return after physical UP. The child-page variant instead
 // ends a real modeless child and keeps its main live with null focus until
 // the ordinary main timer creates the next page. Both replace the main.
 // No host mutation of HWNDs, generations or globals participates.
 function assemble(r,limit,body){
  const a=[],labels={},fix=[],e=(...v)=>a.push(...v),push=n=>e(0x68,...u32(n));
  const call=slot=>e(0xff,0x15,...u32(0x400000+slot));
  const label=n=>labels[n]=a.length,j=(n,op)=>{e(...op);fix.push([a.length,n]);e(0,0,0,0);};
  body({e,push,call,label,j});assert(a.length<limit);
  const out=Buffer.from(a);for(const[o,n]of fix)out.writeInt32LE(labels[n]-o-4,o);
  b.fill(0,raw(r),raw(r+limit));out.copy(b,raw(r));
 }
 assemble(0x2000,0x300,({e,push,call,label,j})=>{
  e(0xa1,...u32(0x401944),0xa3,...u32(0x402604));push(0x402600);call(0x1940);
  label('page');
  if(childPages)e(0xc7,0x05,...u32(0x4026b0),...u32(0),0xc7,0x05,...u32(0x4026b8),...u32(0));
  for(const n of [0,0x400000,0,0,360,640,40,40,0x10cf0000,childPages?0x4027a0:0x402780,0x402500,0])push(n);
  call(0x1948);e(0xa3,...u32(0x4026a8));
  if(childPages){
   e(0x83,0x3d,...u32(0x4026a0),0);j('owner-title-done',[0x0f,0x84]);
   e(0x83,0x3d,...u32(0x4026a0),1);j('owner-third',[0x0f,0x85]);
   push(0x402580);j('owner-title',[0xe9]);label('owner-third');push(0x402700);
   label('owner-title');e(0xff,0x35,...u32(0x4026a8));call(0x195c);label('owner-title-done');
   push(0);push(10);push(9);e(0xff,0x35,...u32(0x4026a8));call(0x1974);
   e(0xa1,...u32(0x4026a8));
  }
  push(0);push(0x402300);e(0x50);push(1);push(0x400000);call(childPages?0x1958:0x1950);
  if(childPages){
   label('messages');for(const n of [0,0,0,0x402800])push(n);call(0x197c);
   push(0x402800);call(0x1980);push(0x402800);call(0x1984);
   e(0x83,0x3d,...u32(0x4026b8),0);j('messages',[0x0f,0x84]);
   call(0x1908);e(0x83,0x3d,...u32(0x4026b0),0);j('gap',[0x0f,0x85]);
   e(0xa3,...u32(0x4026b0));j('messages',[0xe9]);
   label('gap');e(0x2b,0x05,...u32(0x4026b0),0x3d,...u32(transitionDelayMs));j('messages',[0x0f,0x82]);
   push(9);e(0xff,0x35,...u32(0x4026a8));call(0x1978);
   e(0x31,0xc0,0x83,0x3d,...u32(0x4026a4),1,0x0f,0x94,0xc0);
  }
  e(0x89,0xc6);e(0xff,0x35,...u32(0x4026a8));call(0x1964);
  e(0x85,0xf6);j('exit',[0x0f,0x84]);
  e(0xff,0x05,...u32(0x4026a0));j('page',[0xe9]);
  label('exit');push(0);call(0x1900);
 });
 assemble(0x2300,0x200,({e,push,call,label,j})=>{
  e(0x55,0x89,0xe5);
  e(0x81,0x7d,12,...u32(0x110));j('init',[0x0f,0x84]);
  e(0x81,0x7d,12,...u32(0x10));j('cancel',[0x0f,0x84]);
  e(0x81,0x7d,12,...u32(0x113));j('timer',[0x0f,0x84]);
  e(0x81,0x7d,12,...u32(0x111));j('done',[0x0f,0x85]);
  e(0x83,0x7d,16,2);j('cancel',[0x0f,0x84]);
  e(0x83,0x7d,16,1);j('done',[0x0f,0x85]);
  e(0xc7,0x05,...u32(0x4026a4),...u32(1));j('arm',[0xe9]);
  label('cancel');e(0xc7,0x05,...u32(0x4026a4),...u32(2));
  label('arm');e(0xc7,0x05,...u32(0x4026ac),...u32(0));push(0);push(10);push(1);e(0xff,0x75,8);call(0x1974);j('done',[0xe9]);
  label('init');e(0xc7,0x05,...u32(0x4026a4),...u32(0));
  e(0x83,0x3d,...u32(0x4026a0),0);j('done',[0x0f,0x84]);
  e(0x83,0x3d,...u32(0x4026a0),1);j('third',[0x0f,0x85]);
  push(0x402580);j('title',[0xe9]);label('third');push(0x402700);
  label('title');e(0xff,0x75,8);call(0x195c);j('done',[0xe9]);
  label('timer');e(0x83,0x3d,...u32(0x4026a4),0);j('done',[0x0f,0x84]);
  for(const key of [1,13]){push(key);call(0x1970);e(0xa9,...u32(0x8000));j('done',[0x0f,0x85]);}
  // Leave the ordinary HTTP UP reply time to drain before the guest exits.
  // The guest observes physical release first, then waits on its own clock.
  call(0x1908);e(0x83,0x3d,...u32(0x4026ac),0);j('released',[0x0f,0x85]);
  e(0xa3,...u32(0x4026ac));j('done',[0xe9]);
  label('released');e(0x2b,0x05,...u32(0x4026ac),0x3d,...u32(100));j('done',[0x0f,0x82]);
  push(1);e(0xff,0x75,8);call(0x1978);
  e(0x31,0xc0,0x83,0x3d,...u32(0x4026a4),1,0x0f,0x94,0xc0,0x50);
  e(0xff,0x75,8);call(0x1954);
  if(childPages)e(0xc7,0x05,...u32(0x4026b8),...u32(1));
  label('done');e(0xb8,1,0,0,0,0xc9,0xc2,16,0);
 });return b;
}

function verify(dir,{focusTransition=false}={}){
 const path=require('node:path'),read=n=>JSON.parse(fs.readFileSync(path.join(dir,n+'.json')));
 const targets=[],mains=[];
 assert(read('startup-ready').ready&&read('startup-ready').passive);
 for(const [scene,intent,title]of [['welcome','welcome-next','Wizard: Welcome'],['internet-required','internet-next','Wizard: Internet Required']]){
  const capture=read(scene),review=read(scene+'-review'),down=read(intent+'-down'),up=read(intent+'-up'),start=read(intent+'-intent');
  assert(capture.snapshot.windows.some(w=>w.title===title));
  mains.push(capture.snapshot.windows.find(w=>w.hwnd===capture.snapshot.mainHwnd));
  const button=capture.snapshot.windows.find(w=>w.hwnd===review.targetHwnd);
  assert(button&&button.title==='Next >'&&button.controlClass===1);
  assert(capture.at<=review.at&&review.at<=start.at&&start.at-capture.at<30);
  assert.equal(down.receipt.receiptBoundary,'native-button-dispatch-return');
  assert(down.receipt.consumed&&down.at<start.confirmationDeadline);
  assert(up.physicalUpACK&&up.at<start.physicalUpDeadline);
  assert(read(intent+'-release-wait').actualWait&&read(intent+'-release-wait').stdoutEOF&&read(intent+'-release-wait').stderrEOF);
  assert(read(intent+'-completion').elapsedMs<3000);targets.push(button.hwnd);
 }
 const last=read('subscriber-agreement');assert(last.snapshot.windows.some(w=>w.title==='Wizard: SubscriberAgreement'));
 mains.push(last.snapshot.windows.find(w=>w.hwnd===last.snapshot.mainHwnd));
 for(let i=1;i<mains.length;i++){assert.notEqual(mains[i].hwnd,mains[i-1].hwnd);assert.notEqual(mains[i].generation,mains[i-1].generation);}
 const later=[read('internet-required'),last];
 for(let i=0;i<later.length;i++)assert(!later[i].snapshot.windows.some(w=>w.hwnd===mains[i].hwnd),'old main must actually be destroyed');
 assert.equal(new Set(mains.map(w=>w.processId+':'+w.threadId)).size,1);
 targets.push(last.snapshot.windows.find(w=>w.title==='Next >').hwnd);
 assert.equal(new Set(targets).size,3,'every page must create a different Next HWND');
 assert(!fs.existsSync(path.join(dir,'PERMANENT-UNKNOWN.json')));
 const requests=fs.readFileSync(path.join(dir,'requests.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 assert.equal(requests.filter(r=>r.action==='guarded-bind').length,1,'one permanent binding across pages');
 assert.equal(requests.filter(r=>r.action==='guarded-input').length,3);
 const cancel=read('cancel-down'),up=read('cancel-up'),intent=read('cancel-intent');
 assert(cancel.receipt.consumed&&cancel.receipt.receiptBoundary==='native-button-dispatch-return');
 assert(cancel.at<intent.confirmationDeadline&&up.physicalUpACK&&up.at<intent.physicalUpDeadline);
 const release=read('cancel-release-wait');assert(release.actualWait&&release.stdoutEOF&&release.stderrEOF);
 assert(read('cancel-completion').elapsedMs<3000);
 const observation=read('cancel-observation');assert(observation.outcome==='process-exited'&&observation.noPostExitRequest);
 const wait=read('native-wait');assert(wait.actualWait&&wait.stdoutEOF&&wait.stderrEOF&&!wait.hostCleanup&&wait.exit===0&&wait.disposition==='normal');
 assert(read('native-exit').exitCode===0);
 if(focusTransition){
  for(const [scene,previous]of [['internet-required','welcome'],['subscriber-agreement','internet-required']]){
   const readiness=read(scene+'-readiness'),capture=read(scene),before=read(previous);
   const pending=readiness.polls.filter(p=>!p.ready);
   assert(pending.length>0,'must actually observe the native transition');
   assert(pending.every(p=>p.focus==='0x0'&&p.focusTopLevel==='0x0'&&p.modalHwnd==='0x0'&&
    p.mainHwnd===before.snapshot.mainHwnd&&p.ordinaryOwner.actorContext));
   assert(readiness.polls.at(-1).ready);
   assert(capture.observationStartedAt===readiness.startedAt&&capture.observationDeadline===readiness.deadline);
   assert(readiness.deadline===readiness.startedAt+3&&capture.completedAt<readiness.deadline);
   assert(capture.image.startedAt/1000>=readiness.polls.at(-1).at);
  }
 }
 console.log(JSON.stringify({passed:true,actualCompleteCLIWorkflow:true,focusTransitionQualified:focusTransition,changingNextHWNDs:targets,changingMainWindows:mains.map(w=>({hwnd:w.hwnd,generation:w.generation})),oneBinding:true,nativeACK500:true,independentUP1750:true,capture3000:true,reviewAge30:true,nativeQuit:true,hostCleanup:false,noOriginal:true}));
}
async function unit(){
 const native=require('../lib/cli-native-scene'),{createGuardedInput}=require('../lib/cli-guarded-input');
 const main={hwnd:'0x10001',generation:'1',processId:1000,threadId:1,owner:'0x0',parent:'0x0',
  live:true,visible:true,isChild:false,title:'Main',style:0x10cf0000,controlClass:0,nativeTextAvailable:true,textBytes:'4d61696e',nativeClientRect:{screenX:0,screenY:0,w:800,h:600}};
 const button={...main,hwnd:'0x10002',generation:'2',parent:main.hwnd,isChild:true,title:'Next >',
  style:0x50010000,controlClass:1,screenX:10,screenY:10,w:60,h:24,textBytes:'4e657874203e'};
 let scene={mainHwnd:main.hwnd,modalHwnd:'0x0',windows:[main,button],focus:button.hwnd,focusTopLevel:main.hwnd,
  focusWindow:{...button},capture:'0x0',physicalUp:true,nativeProcess:{pid:123,executable:'wizard.exe'},
  nativeMessageBox:null,nativeDialogBox:null,screen:{w:800,h:600},quit:false,eip:'0x402000',
  pointerMapping:{canvas:{w:800,h:600},transform:null,viewport:null,clip:null}};
 const instance={exports:{get_current_thread_id:()=>1,get_process_id:()=>1000,get_quit_flag:()=>0,get_eip:()=>0x402000}};
 const lease=native.context(structuredClone(scene)),queue=[],refs={instance,exports:instance.exports,memory:{},buffer:{},
  renderer:{},actor:null,actorInstance:instance,actorExports:instance.exports,tid:1,mainHwnd:1,hwnd:1,window:{},
  queue,canvas:{},device:{snapshot:()=>({ready:true})},module:{},adapter:{},mouseDown:()=>{},mouseUp:()=>{}};
 const registry=native.createReviewedContexts();
 const capture=()=>registry.capture(()=>structuredClone(scene),()=>Buffer.from('whole authored image'),()=>{});
 const review=c=>({contract:c.contract,captureId:c.captureId,pngSHA256:c.pngSHA256,reviewed:true,
  reviewedAt:Date.now(),scope:'menu',targetHwnd:scene.focus});
 const snap=()=>native.reviewedOwnerSnapshot({healthy:true,refs:{...refs,mainHwnd:scene.mainHwnd,hwnd:scene.mainHwnd,window:scene.windows[0]}},scene,lease,instance);
 let effects=0;
 const guard=createGuardedInput({snapshot:snap,cleanup:()=>{},validateIntent:(i,e)=>{try{registry.verify(scene,i.review,e,i.nonce);return true;}catch{return false;}}});
 const binding=guard.bind();let sequence=0;
 const consume=r=>{const nonce='unit-'+(++sequence),t=guard.prepare({...binding,nonce,reviewed:true,deadline:Date.now()+500,
  intent:{review:r,nonce}},{action:'mousedown',x:20,y:20});return guard.consume(t,()=>effects++);};
 const old=review(capture());assert(consume(old).consumed);guard.release(binding.owner);
 const before=structuredClone(scene);
 // The guest main and child are replaced. The old retained whole image refuses.
 scene.windows[0]={...main,hwnd:'0x10003',generation:'3'};
 scene.windows[1]={...button,hwnd:'0x10004',generation:'4',parent:'0x10003'};
 scene.mainHwnd=scene.focusTopLevel='0x10003';scene.focus='0x10004';scene.focusWindow={...scene.windows[1]};
 assert.throws(()=>registry.verify(scene,old));assert(!consume(old).consumed);
 const fresh=review(capture());assert(consume(fresh).consumed);guard.release(binding.owner);
 for(const mutate of [v=>v.mainHwnd=before.mainHwnd,v=>v.windows[0].generation='99',
  v=>{v.windows[1].generation='99';v.focusWindow.generation='99';},
  v=>v.windows[1].parent=before.mainHwnd,v=>v.nativeProcess.pid++,v=>v.focusWindow.processId++,v=>v.focusWindow.threadId++]){
  const saved=structuredClone(scene);mutate(scene);assert(!consume(fresh).consumed);scene=saved;
 }
 for(const name of ['instance','exports','memory','buffer','renderer','queue','canvas','device','module','adapter','mouseDown','mouseUp']){
  const saved=refs[name];refs[name]=name==='queue'?[]:{};
  assert(!consume(fresh).consumed,name+' replacement must refuse');refs[name]=saved;
 }
 assert.equal(effects,2);guard.close();
 {
  const m=require('../tools/halflife2-restored-native.js');
  const b=require('node:child_process').execFileSync('git',['show',m.COMPONENT+':test/run.js'],{maxBuffer:1<<30}),r=m.reviewed_owner_runner(b);
  const a=b.indexOf(m.OWNER_START),z=b.indexOf(m.OWNER_END,a);
  assert(a>=0&&z>=0&&r.equals(Buffer.concat([b.subarray(0,a),m.OWNER_BLOCK,b.subarray(z)])));
  const current=fs.readFileSync('test/run.js');assert(current.subarray(current.indexOf(m.OWNER_START),current.indexOf(m.OWNER_END)).equals(m.OWNER_BLOCK));
  const replaceOnce=(body,from,to)=>{const i=body.indexOf(from);return i<0?body:Buffer.concat([body.subarray(0,i),Buffer.from(to),body.subarray(i+from.length)]);};
  for(const bad of [r,replaceOnce(b,m.OWNER_START,'changed'),Buffer.from(b.toString('latin1').split('sameReviewedOwner(main,nativeSceneLease.main)').join('other'),'latin1')])
   assert.throws(()=>m.reviewed_owner_runner(bad),/^AssertionError/,'changed/duplicate transformation accepted');
  console.log('PASS sealed runner adoption changes only exact owned owner block');
 }
 const ready={ready:false,snapshot:{...scene,focus:'0x0',focusTopLevel:'0x0',focusWindow:{hwnd:'0x0',generation:'0',live:false,processId:1000,threadId:0}},
  failures:['focus.live','focus.generation','focus.threadIdentity','focus.liveIdentity','focus.thread','focus.mainTopLevel','owner.ordinaryUSER'],
  ordinaryOwner:{actorContext:true,processId:1000,threadId:1}};
 assert(native.focusTransitionPending(ready,scene));
 assert(native.captureFailures(ready.snapshot).context.length,'null focus never authorizes capture');
 for(const change of [r=>r.snapshot.nativeProcess.pid++,r=>r.snapshot.windows[0].threadId++,
  r=>r.snapshot.windows[0].processId++,r=>r.snapshot.windows[0].generation='0',
  r=>r.snapshot.focusWindow.processId++,r=>r.ordinaryOwner.actorContext=false,
  r=>r.failures.push('runtime.running'),r=>r.failures.push('input.capture'),
  r=>r.failures.push('main.liveIdentity'),r=>r.failures.push('context.unchanged')]){
  const v=structuredClone(ready);change(v);
  // Production readiness supplies identity failures for an invalid generation.
  if(v.snapshot.windows[0].generation==='0')v.failures.push('main.liveIdentity');
  assert(!native.focusTransitionPending(v,scene));
 }
 await (async()=>{
  const os=require('node:os'),path=require('node:path'),h=require('../tools/halflife2-reviewed-next.js');
  const base={focusWindow:{processId:1000,threadId:1},nativeProcess:{pid:123,executable:'authored.exe'},screen:{w:640,h:480}};
  const anchor={hwnd:'0x1',live:true,visible:true,isChild:false,processId:1000,threadId:1};
  const snapshot={...base,mainHwnd:'0x1',modalHwnd:'0x0',windows:[anchor],focus:'0x0',focusTopLevel:'0x0'};
  for(const mode of ['transient','permanent','foreign-process','owner-violation','capture-refused','capture-late']){
   const r=fs.mkdtempSync(path.join(os.tmpdir(),'hl2-capture-'));
   try{
    fs.writeFileSync(path.join(r,'input-owner.json'),'{}');const clock=[100];const calls=[],records={},timeouts=[];
    const call=(command,timeout)=>{
     calls.push(command.action);timeouts.push(timeout);clock[0]+=.1;
     if(command.action==='native-startup-readiness'){
      const ready=['capture-refused','capture-late'].includes(mode)||(mode==='transient'&&calls.length>2);
      const snap=structuredClone(snapshot);
      if(mode==='foreign-process')snap.nativeProcess.pid++;
      return {contract:'native-startup-readiness-v1',ready,snapshot:snap,
       failures:ready?[]:['focus.live'],nullFocusTransition:mode!=='owner-violation',ordinaryOwner:{actorContext:true,processId:1000,threadId:1}};
     }
     assert.equal(command.action,'native-reviewed-capture');
     if(mode==='capture-refused'){const e=new Error('strict capture refused');e.name='AssertionError';throw e;}
     if(mode==='capture-late')clock[0]+=3;
     fs.writeFileSync(command.path,'authored-unit-encoder');
     return {contract:'native-reviewed-context-v1',startedAt:clock[0]*1000,completedAt:clock[0]*1000,snapshot,captureId:'unit'};
    };
    const m={R:r,PORT:1,identity:()=>({pid:123}),reserve:()=>null,call,
     time:{time:()=>clock[0],sleep:t=>{clock[0]+=t;}},
     save:(n,v)=>{records[n]=v;},read:n=>n==='bind-intent.json'?{scene:'bound'}:{snapshot:base}};
    let refused=false;
    try{await h.capture(m,'scene');}
    catch(e){if(e.name!=='AssertionError')throw e;refused=true;}
    assert.equal(refused,mode!=='transient',mode);
    assert.equal(calls.filter(c=>c==='native-reviewed-capture').length,['transient','capture-refused','capture-late'].includes(mode)?1:0);
    if(mode==='permanent')assert(103<=clock[0]&&clock[0]<103.11);
    if(['foreign-process','owner-violation'].includes(mode))assert.equal(calls.length,1);
    if(mode==='transient')assert.equal(records['scene.json'].observationDeadline,103);
   }finally{fs.rmSync(r,{recursive:true,force:true});}
  }
  console.log('PASS bounded passive transient/never-ready/foreign-owner/strict-refusal/late-encoder; at most one strict capture, original deadline unchanged');
 })();
 console.log('PASS main replacement requires fresh whole image/current native metadata; stale main/generation/recycled handle/process/thread/module/device/queue/runtime refusals; one binding');
}
module.exports={fixture,verify,unit};
if(require.main===module){if(process.argv[2]==='--unit')unit().catch(e=>{console.error(e);process.exitCode=1;});else if(['--verify','--verify-focus'].includes(process.argv[2]))verify(process.argv[3],{focusTransition:process.argv[2]==='--verify-focus'});else fs.writeFileSync(process.argv[2],fixture({transitionDelayMs:process.argv.includes('--focus-transition')?1200:0,childPages:process.argv.includes('--focus-transition')}),{flag:'wx'});}
