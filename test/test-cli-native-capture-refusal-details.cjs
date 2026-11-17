'use strict';
const assert=require('node:assert/strict');
const {withNativeUserChildren}=require('../lib/cli-native-user-windows');
const {captureFailures,createReviewedContexts}=require('../lib/cli-native-scene');

function scene(){
  const w={hwnd:'0x1',generation:'1',processId:1000,threadId:1,live:true,
    visible:true,isChild:false,owner:'0x0',controlClass:999,nativeTextAvailable:false,
    nativeTextUnavailableReason:'negativeTextLength',title:'SECRET',textBytes:'SECRET'};
  return {mainHwnd:w.hwnd,windows:[w],modalHwnd:'0x0',focus:w.hwnd,focusTopLevel:w.hwnd,
    focusWindow:w,capture:'0x0',physicalUp:true,nativeProcess:{pid:1,executable:'SECRET'},
    screen:{w:800,h:600},eip:'0x400000',quit:false};
}
const s=scene(),base=captureFailures(s),detail=captureFailures(s,true);
assert.deepEqual(base,{context:[],controls:['control.unsupportedClass','control.textUnavailable']});
assert.deepEqual(detail.controlDetails,[{hwnd:'0x1',controlClass:999,
  reasons:base.controls,textReason:'negativeTextLength'}]);
assert.deepEqual({context:detail.context,controls:detail.controls},base,'diagnostics do not change refusal');
let encodes=0,writes=0;
assert.throws(()=>createReviewedContexts().capture(()=>s,()=>{encodes++;},()=>{writes++;}),error=>{
  const refusal=JSON.parse(error.message.slice('native capture refused '.length));
  assert.deepEqual(refusal,detail);assert(!error.message.includes('SECRET'));return true;
});
assert.equal(encodes,0);assert.equal(writes,0,'refusal writes no replacement capture');
const changed=scene();changed.focusTopLevel='0x2';
assert(captureFailures(changed,true).context.includes('focus.mainTopLevel'));
assert.deepEqual(captureFailures(changed,true).contextDetails,
  {mainHwnd:'0x1',modalHwnd:'0x0',focus:'0x1',focusTopLevel:'0x2'});
const privateRow=scene();Object.assign(privateRow.windows[0],{
  hwnd:'SECRET',controlClass:'SECRET',nativeTextUnavailableReason:'SECRET'});
assert(!JSON.stringify(captureFailures(privateRow,true)).includes('SECRET'),'unrecognized metadata is not echoed');

// Exercise the real snapshot adapter without guest messages or text reads on
// refusal. The same observed export values retain their precise bounded reason.
function unavailable({cls=999,style=0,p=4,n=-1,missing=false}={}){
  const exports={ctrl_get_class:()=>cls,get_client_rect_wh:()=>0x10001,
    wnd_client_screen_x:()=>0,wnd_client_screen_y:()=>0,wnd_next_child_slot:()=>-1};
  if(!missing)Object.assign(exports,{native_user_text_ptr:()=>p,native_user_text_length:()=>n});
  const root={hwnd:'0x1',live:true,visible:true,isChild:false,generation:'1',style};
  return withNativeUserChildren([root],{windows:{1:{wasm:{exports}}}},
    {buffer:new ArrayBuffer(256)})[0];
}
for(const [options,reason] of [
  [{missing:true},'missingTextExports'],[{cls:2,style:32},'passwordEdit'],
  [{n:-1},'negativeTextLength'],[{n:65537},'textLengthBound'],
  [{p:0,n:1},'nullTextPointer'],[{p:250,n:8},'textSpanOutsideMemory']]){
  const row=unavailable(options);assert.equal(row.nativeTextAvailable,false);
  assert.equal(row.nativeTextUnavailableReason,reason);
}
console.log('PASS native capture refusal identity/reason diagnostics; unchanged refusal and private-text exclusion');

async function native(out){
  const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const {startControlSession}=require('./control-session');
  fs.mkdirSync(out,{recursive:true});
  const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
  const exe=path.join(out,'password-edit.exe');
  fs.writeFileSync(exe,require('./test-halflife2-native-wizard.cjs').dialogFixture({passwordEdit:true}));
  let wo='',we='';
  const wd=cp.spawn(process.execPath,['-e',"let pid;const timer=setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGKILL')}catch{};process.exit(2)},20000);console.log('ARMED');process.stdin.on('data',b=>pid=+b);process.stdin.on('end',()=>clearTimeout(timer))"]);
  wd.stdout.on('data',b=>wo+=b);wd.stderr.on('data',b=>we+=b);
  const ww=new Promise(r=>wd.on('close',(exit,signal)=>r({exit,signal})));
  while(!wo.includes('ARMED'))await pause(5);
  save('watchdog-arm.json',{pid:wd.pid,prearmed:true,milliseconds:20000});
  const s=startControlSession(['test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks','--png-canvas','--control-stdin','--max-seconds=15','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],{spawnOptions:{detached:true}});
  wd.stdin.write(String(s.child.pid));
  try{
    let snap;const due=Date.now()+10000;
    do{snap=await s.send({action:'snapshot'});if(snap.windows.some(w=>w.controlClass===2))break;assert(Date.now()<due);await pause(20);}while(true);
    const edit=snap.windows.find(w=>w.controlClass===2);
    assert.equal(edit.nativeTextAvailable,false);assert.equal(edit.nativeTextUnavailableReason,'passwordEdit');
    assert(snap.windows.filter(w=>w.controlClass===1).length===2,'all native siblings retained');
    const png=path.join(out,'refused.png');let refusal;
    try{await s.send({action:'native-reviewed-capture',path:png});}catch(e){
      assert(e.message.startsWith('native capture refused '),e.message);
      refusal=JSON.parse(e.message.slice('native capture refused '.length));
    }
    assert(refusal);assert.deepEqual(refusal.context,[]);
    assert.deepEqual(refusal.controlDetails,[{hwnd:edit.hwnd,controlClass:2,
      reasons:['control.unsupportedClass','control.textUnavailable'],textReason:'passwordEdit'}]);
    assert(!fs.existsSync(png));assert(!JSON.stringify(refusal).includes('Authored wizard welcome page'));
    save('proof.json',{passed:true,ordinaryDialogCreation:true,nativeEdit:true,refusal,
      allSiblingsRetained:true,noCaptureWritten:true,noAcceptanceWeakening:true,noOriginal:true,commandsAfterRefusal:0});
  }finally{
    if(s.child.exitCode===null)try{process.kill(-s.child.pid,'SIGTERM');}catch{}
    await s.exited;save('native-wait.json',{pid:s.child.pid,exit:s.child.exitCode,actualWait:true,
      stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded,hostCleanup:true,nativeQuit:false});
    fs.writeFileSync(path.join(out,'native.log'),s.output());wd.stdin.end();
    save('watchdog-wait.json',{...await ww,actualWait:true,stdoutEOF:wd.stdout.readableEnded,stderrEOF:wd.stderr.readableEnded,stdout:wo,stderr:we});
  }
}
module.exports={native};
if(require.main===module&&process.argv[2]==='--native')native(require('node:path').resolve(process.argv[3])).catch(e=>{console.error(e);process.exitCode=1;});
