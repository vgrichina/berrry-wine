'use strict';
// Authored x86 guest calls real DialogBoxParamA and real DLGPROCs. No original
// media, host-created modal, synthetic parent or personal-review claim.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const cp=require('node:child_process'),net=require('node:net');
const {startControlSession}=require('./control-session');
const raw=r=>r-0x1000+0x200,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
function publishJSON(file,value){
 const pending=file+'.'+process.pid+'.pending',fd=fs.openSync(pending,'wx');
 try{fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 fs.linkSync(pending,file);fs.unlinkSync(pending);
}
function fixture({modeless=false,fake=false,indirect=false,nestedBox=false}={}){
 const b=require('./test-sims-child-mount-native.cjs').untitledModal();
 // Additional ordinary imports; no runtime export/handler shortcut.
 const names=['RegisterClassA','DefWindowProcA','CreateWindowExA','MessageBoxA',indirect?'DialogBoxIndirectParamA':'DialogBoxParamA','EndDialog','CreateDialogParamA','SetWindowTextA'];
 let p=0x1b00;for(const [i,n]of names.entries()){b.writeUInt32LE(p,raw(0x1940+i*4));b.write(n+'\0',raw(p+2));p+=n.length+3;}
 b.writeUInt32LE(0x1af0,raw(0x1904));b.write('Sleep\0',raw(0x1af2));
 // A genuine PE RT_DIALOG tree: type 5, ids 1/2, language 1033.
 b.writeUInt32LE(0x1200,0x80+24+112);b.writeUInt32LE(0xc0,0x80+24+116);
 b.fill(0,raw(0x1200),raw(0x17ff));
 for(const [r,n]of [[0x120e,1],[0x122e,2],[0x125e,1],[0x127e,1]])b.writeUInt16LE(n,raw(r));
 for(const [r,n]of [[0x1210,5],[0x1214,0x80000020],[0x1230,1],[0x1234,0x80000050],[0x1238,2],[0x123c,0x80000070],[0x1260,1033],[0x1264,0xa0],[0x1280,1033],[0x1284,0xb0]])b.writeUInt32LE(n>>>0,raw(r));
 function template(r,title){let a=raw(r);const start=a;
  const w=n=>{b.writeUInt16LE(n&65535,a);a+=2;},d=n=>{b.writeUInt32LE(n>>>0,a);a+=4;},s=t=>{for(const c of t)w(c.charCodeAt(0));w(0);},align=()=>{a=(a+3)&~3;};
  d(modeless?0x90c80000:0x80c80000);d(0);w(2);w(30);w(30);w(220);w(100);w(0);w(0);s(title);
  align();d(0x50000000);d(0);w(10);w(10);w(195);w(30);w(100);w(0xffff);w(0x82);s('Public native dialog identity fixture');w(0);
  align();d(0x50010001);d(0);w(80);w(65);w(60);w(15);w(1);w(0xffff);w(0x80);s('OK');w(0);
  return a-start;
 }
 for(const [r,t,e]of [[0x1500,'Native DialogBox outer',0x12a0],[0x1700,'Native DialogBox nested',0x12b0]]){const n=template(r,t);b.writeUInt32LE(r,raw(e));b.writeUInt32LE(n,raw(e+4));}
 // Assemble with labels for callback branches.
 function asm(r,body){const code=[],labels={},fix=[];const e=(...v)=>code.push(...v),push=n=>e(0x68,...u32(n)),call=i=>e(0xff,0x15,...u32(0x401940+i*4));
  const label=n=>labels[n]=code.length,j=(op,n)=>{e(...op,0,0,0,0);fix.push([code.length-4,n]);};
  body({e,push,call,label,j});for(const [at,n]of fix){assert(n in labels);const v=Buffer.alloc(4);v.writeInt32LE(labels[n]-at-4);for(let i=0;i<4;i++)code[at+i]=v[i];}b.set(code,raw(r));return code.length;
 }
 asm(0x2000,({e,push,call})=>{
  if(fake){e(0xa1,...u32(0x401944),0xa3,...u32(0x402604));push(0x402600);call(0);for(const n of [0,0x400000,0,0,180,300,60,60,0x90000000,0x402540,0x402500,0])push(n);call(2);e(0xeb,0xfe);}
  else{
   for(const n of [0,0x402300,0,indirect?0x401500:1,0x400000])push(n);call(modeless?6:4);
   if(modeless){push(0x402540);e(0x50);call(7);e(0xeb,0xfe);}
   else{ // Real main creation after pre-main outer/nested/outer completion.
    e(0xa1,...u32(0x401944),0xa3,...u32(0x402604));push(0x402600);call(0);
    for(const n of [0,0x400000,0,0,360,640,100,80,0x90000000,0x402570,0x402500,0])push(n);call(2);e(0x89,0xc6);
    for(const owned of [true,false]){push(0);push(0x402400);if(owned)e(0x56);else push(0);push(indirect?0x401700:2);push(0x400000);call(4);}
    push(1000);e(0xff,0x15,...u32(0x401904));
   }
  }
  push(0);e(0xff,0x15,...u32(0x401900),0xcc);
 });
 // First OK opens a nested native dialog, returns to the same outer pump,
 // second OK ends it. Use a guest-owned flag only for authored guest behavior.
 asm(0x2300,({e,push,call,j,label})=>{
  e(0x81,0x7c,0x24,8,...u32(0x111));j([0x0f,0x85],'default');
  e(0x83,0x3d,...u32(0x4026a0),0);j([0x0f,0x85],'end');
  e(0xc7,0x05,...u32(0x4026a0),...u32(1));
  if(nestedBox){push(0x24);push(0x402540);push(0x402580);e(0xff,0x74,0x24,16);call(3);}
  else{push(0);push(0x402400);e(0xff,0x74,0x24,12);push(indirect?0x401700:2);push(0x400000);call(4);}
  j([0xe9],'default');
  label('end');push(1);e(0xff,0x74,0x24,8);call(5);
  label('default');e(0xb8,1,0,0,0,0xc2,16,0);
 });
 asm(0x2400,({e,push,call,j,label})=>{e(0x81,0x7c,0x24,8,...u32(0x111));j([0x0f,0x85],'done');push(1);e(0xff,0x74,0x24,8);call(5);label('done');e(0xb8,1,0,0,0,0xc2,16,0);});
 return b;
}
module.exports={fixture};
function units(){
 const native=require('../lib/cli-native-user-windows'),{createGuardedInput}=require('../lib/cli-guarded-input');
 const target={hwnd:'0x10003',generation:'3',processId:1000,threadId:1,parent:'0x10001',live:true,visible:true,controlClass:1,style:0x50010001,screenX:10,screenY:10,w:60,h:24};
 let row=[0n,3n,65539n,1000n,1n,65537n,513n,1n];
 const e={get_current_thread_id:()=>1,get_process_id:()=>1000,native_button_receipt:i=>row[i],wnd_lookup_live:()=>1,wnd_lookup_generation:()=>3n,wnd_get_proc_export:()=>-65535};
 const event={action:'mousedown',x:20,y:20},intent={review:{targetHwnd:target.hwnd}},instance={exports:e},snapshot={windows:[target]};
 snapshot.pointerMapping={canvas:{w:800,h:600},transform:null,viewport:null,clip:null};
 const fence=()=>native.captureNativeButton(event,intent,snapshot,instance);
 let captured=fence();assert(captured);assert.equal(native.confirmNativeButton(captured,event),null,'unchanged historical witness cannot acknowledge a new input');
 row[0]=1n;assert(native.confirmNativeButton(captured,event));
 for(const [i,value]of [[0,2n],[1,4n],[2,65540n],[3,1001n],[4,2n],[5,65538n],[6,512n],[7,0n]]){
  const prior=row[i];row[i]=value;assert.equal(native.confirmNativeButton(captured,event),null,'foreign/stale/unrelated native receipt');row[i]=prior;
 }
 const duplicate={threads:new Map([[2,{state:'active',instance:{exports:e}}]])};assert.equal(native.captureNativeButton(event,intent,snapshot,instance,duplicate),null,'ambiguous native actor');
 assert.equal(native.captureNativeButton(event,intent,{windows:[{...target,style:target.style|0x08000000}]},instance),null);
 assert.equal(native.captureNativeButton({...event,x:1000},intent,snapshot,instance),null);
 let time=1000,ups=0;const refs={queue:[]};
 const guard=createGuardedInput({snapshot:()=>({healthy:true,refs}),cleanup:()=>ups++,nativeDelivery:true,
  captureNativeControl:()=>fence(),confirmNativeControl:native.confirmNativeButton,now:()=>time,monotonic:()=>time});
 const owner=guard.bind(),prepare=nonce=>guard.prepare({...owner,nonce,reviewed:true,deadline:time+500,intent},event);
 let ticket=prepare('real-native-return');let r=guard.consume(ticket,()=>row[0]++);assert(r.consumed);assert.equal(r.receiptBoundary,'native-button-dispatch-return');guard.release(owner.owner);
 ticket=prepare('handler-only');r=guard.consume(ticket,()=>{});assert.equal(r.state,'UNKNOWN');assert(!r.consumed);assert.equal(guard.consume(ticket,()=>row[0]++).state,'UNKNOWN');
 ticket=prepare('late-native-return');r=guard.consume(ticket,()=>{row[0]++;time+=501;});assert.equal(r.state,'UNKNOWN');assert(!r.consumed);
 assert(ups>=3);guard.close();
 console.log('PASS typed native BUTTON historical/foreign/generation/actor/disabled/deadline/UNKNOWN controls; no host-handler fallback');
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function run(out,{fixtureFactory=fixture,onCapture=null,modes:requestedModes=null}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>publishJSON(path.join(out,n),v);
 const modes=requestedModes||process.env.VB5_DIALOG_MODES?.split(',')||['positive','positive-indirect','focus','caption','child-caption','disabled','foreign-thread','foreign-process','retired','generation','callback','stale','fake-window','modeless'];
 for(const mode of modes){
  const dir=path.join(out,mode);fs.mkdirSync(dir);fs.copyFileSync(path.join(out,'../runtime-inputs.json'),path.join(dir,'runtime-inputs.json'));
  const exe=path.join(dir,'fixture.exe');fs.writeFileSync(exe,fixtureFactory({fake:mode==='fake-window',modeless:mode==='modeless',indirect:mode==='positive-indirect',nestedBox:mode.includes('box')||mode.startsWith('nested-')}));
  const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
  const started=Date.now()/1000;fs.writeFileSync(path.join(dir,'launch.json'),JSON.stringify({deadline:started+240,gameplayCutoff:started+60,reserveSeconds:180,rootPort:port}));
  const w=cp.spawn(process.execPath,['-e',"let pid;const t=setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGKILL')}catch{};process.exit(2)},65000);console.log('ARMED');process.stdin.on('data',b=>pid=Number(b));process.stdin.on('end',()=>clearTimeout(t));"],{stdio:['pipe','pipe','pipe']});
  let ws='',we='';w.stdout.on('data',b=>ws+=b);w.stderr.on('data',b=>we+=b);const ww=new Promise(r=>w.on('close',(exit,signal)=>r({exit,signal})));
  while(!ws.includes('ARMED'))await pause(5);save(mode+'-watchdog-arm.json',{pid:w.pid,prearmed:true,deadlineMs:65000,at:Date.now()});
  const invocationToken=require('node:crypto').randomUUID();
  const s=startControlSession(['test/run.js','--native-exit-receipt='+path.join(dir,'native-exit.json'),'--native-invocation-token='+invocationToken,'--exe='+exe,'--no-build','--winver=nt4','--threads','--real-ticks','--screen=800x600','--control-stdin','--control='+port,'--max-seconds=60','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],{spawnOptions:{detached:true}});
  s.child.once('close',(exit,signal)=>publishJSON(path.join(dir,'native-wait.json'),{...nativeIdentity,exit,signal,actualWait:true,disposition:'normal',atWait:Date.now()/1000,atWaitMono:Number(process.hrtime.bigint())/1e9,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded}));
  w.stdin.write(String(s.child.pid));const stat=fs.readFileSync('/proc/'+s.child.pid+'/stat','utf8');
  const nativeIdentity={pid:s.child.pid,startToken:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],invocationToken,bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()};
  fs.writeFileSync(path.join(dir,'native-pid.json'),JSON.stringify(nativeIdentity));
  let unknown=false,requests=0,controllers=0;const send=async q=>{assert(!unknown,'permanent UNKNOWN');requests++;return s.send(q);};
  const controller=async(args,expected=0)=>{const p=await new Promise(r=>{const c=cp.spawn('python3',['-B','tools/vb5cce-reviewed-control.py',...args],{env:{...process.env,DELPHI5_RUN:dir,DELPHI5_PORT:String(port)},timeout:7000});let stdout='',stderr='';c.stdout.on('data',b=>stdout+=b);c.stderr.on('data',b=>stderr+=b);c.on('close',(status,signal)=>r({status,signal,stdout,stderr,pid:c.pid,actualWait:true,stdoutEOF:c.stdout.readableEnded,stderrEOF:c.stderr.readableEnded}));});save(mode+'-controller-'+(++controllers)+'.json',{args,...p});if(expected===0)assert.equal(p.status,0,p.stdout+p.stderr);else assert.notEqual(p.status,0);};
  try{
   let scene;const due=Date.now()+15000;do{scene=await send({action:'snapshot'});if(scene.windows.some(w=>w.visible))break;assert(Date.now()<due);await pause(20);}while(true);
   if(['fake-window','modeless'].includes(mode)){
    assert.equal(scene.nativeDialogBox,null);assert.equal(scene.nativeMessageBox,null);
    // Reclassifying a real ordinary/modeless native window as modal cannot
    // produce an invocation record. Keep HWND, focus, class and owner intact.
    const root=scene.windows.find(w=>w.visible&&!w.isChild);assert(root);
    const counterfeit={...scene,mainHwnd:'0x0',modalHwnd:root.hwnd};
    assert(require('../lib/cli-native-scene').captureFailures(counterfeit).context.length);
    save(mode+'-refusal.json',{nativeSnapshot:scene,ordinaryWindowImpersonationRefused:true});unknown=true;
   }else if(mode.startsWith('positive')){
    let binding,outer;
    for(let i=0;i<5;i++){
     const name='scene'+i;await controller(['capture',name]);const rr=JSON.parse(fs.readFileSync(path.join(dir,name+'.json'))),ss=rr.snapshot;
     const d=ss.nativeDialogBox,modal=ss.windows.find(w=>w.hwnd===ss.modalHwnd),button=ss.windows.find(w=>w.parent===ss.modalHwnd&&w.controlClass===1&&w.controlId===(d?.nestedMessageBox?6:1));
     const nested=d?.nestedMessageBox;
     const actualButton=button||ss.windows.find(w=>w.hwnd===ss.modalHwnd&&w.controlClass===16);
     assert(d&&modal&&actualButton);
     if(nested){assert.equal(i,1);assert.equal(d.hwnd,outer.hwnd);assert.equal(nested.hwnd,modal.hwnd);assert.equal(nested.generation,modal.generation);assert.equal(nested.ownerGeneration,outer.generation);assert.equal(nested.owner,outer.hwnd);assert(ss.nativeMessageBox);}
     else{assert.equal(d.hwnd,modal.hwnd);assert.equal(d.generation,modal.generation);assert.equal(d.owner,modal.owner);assert.equal(ss.nativeMessageBox,null);}
     if(i===0){assert.equal(ss.mainHwnd,'0x0');outer=d;}if(i===1&&!nested){assert.equal(d.owner,outer.hwnd);assert.notEqual(d.generation,outer.generation);}if(i===2)assert.deepEqual(d,outer,'outer invocation restored after real nested return');
     if(i>=3){assert.notEqual(ss.mainHwnd,'0x0');assert.equal(d.owner,i===3?ss.mainHwnd:'0x0');}
     if(onCapture)await onCapture({ss,send,save,name:mode+'-'+name});
     await controller(['review',name,'Automated authored native DialogBox complete image protocol test',nested?'Yes':'OK',i===4?'quit':'install',actualButton.hwnd]);if(!i)await controller(['bind',name]);
     const x=actualButton.screenX+actualButton.w/2,y=actualButton.screenY+actualButton.h/2;
     await controller(['intent','press'+i,name,String(x|0),String(y|0),i===4?'quit':'install']);
    }
    const due=Date.now()+4000;while(s.child.exitCode===null){assert(Date.now()<due);await pause(20);}assert.equal(s.child.exitCode,0);
    save(mode+'-proof.json',{preMain:true,nestedAndRestored:true,realMainTransition:true,mainOwned:true,mainOwnerless:true,realButtons:5,nativeExit:0});
   }else{
    const isNested=mode.startsWith('nested-'),faultMode=isNested?mode.slice(7):mode;
    if(isNested){
     await controller(['capture','outer']);const outer=JSON.parse(fs.readFileSync(path.join(dir,'outer.json'))).snapshot;
     const b=outer.windows.find(w=>w.parent===outer.modalHwnd&&w.controlClass===1);
     await controller(['review','outer','Authored outer DialogBox opens nested MessageBox','OK','install',b.hwnd]);await controller(['bind','outer']);
     await controller(['intent','open-nested','outer',String(b.screenX+b.w/2|0),String(b.screenY+b.h/2|0),'install']);
    }
    await send({action:'frozen',mode:'on'});await controller(['capture','scene']);const rr=JSON.parse(fs.readFileSync(path.join(dir,'scene.json')));scene=rr.snapshot;
    const button=scene.windows.find(w=>w.parent===scene.modalHwnd&&w.controlClass===1)||scene.windows.find(w=>w.hwnd===scene.modalHwnd),h=parseInt(scene.modalHwnd,16),bh=parseInt(button.hwnd,16);
    await controller(['review','scene','Automated authored native DialogBox fault context','OK','install',button.hwnd]);
    if(mode==='stale'){await pause(Math.max(0,rr.at*1000+30050-Date.now()));await controller(['bind','scene'],1);}
    else{
     if(!isNested)await controller(['bind','scene']);const owner=JSON.parse(fs.readFileSync(path.join(dir,'input-owner.json'))),review=JSON.parse(fs.readFileSync(path.join(dir,'scene-review.json')));
     const nonce='dialog-'+mode;await send({action:'guarded-input',cmd:`mousedown:${button.screenX+2}:${button.screenY+2}`,guard:{...owner,nonce,reviewed:true,deadline:Date.now()+500,intent:{review:{contract:rr.image.contract,captureId:rr.captureId,pngSHA256:rr.pngSHA256,reviewed:true,reviewedAt:review.at*1000,scope:'menu',targetHwnd:button.hwnd}}}});
     const faults={focus:`e.set_focus(${h})`,caption:`new Uint8Array(memory.buffer)[e.native_user_text_ptr(${h})]=88`,'child-caption':`new Uint8Array(memory.buffer)[e.native_user_text_ptr(${bh})]=88`,disabled:`e.wnd_set_style_export(${bh},e.wnd_get_style_export(${bh})|0x08000000)`,'foreign-thread':'e.set_current_thread_id(99)','foreign-process':'e.set_process_id(99)',retired:`e.wnd_lookup_retire(${h})`,generation:`e.destroy_dialog_frame(${h});e.wnd_table_set(${h},0xffff0001)`,callback:`e.wnd_set_long(${h},4,0x402400)`};
     const parent=parseInt(scene.nativeDialogBox.hwnd,16);
     if(isNested){
      const base=require('../lib/region-map.generated').BASE.OWNER_TABLE;
      Object.assign(faults,{'wrong-owner':`let slot=0;while(slot<256&&e.wnd_slot_hwnd(slot)!==${h})slot++;if(slot===256)throw Error('missing native slot');new DataView(memory.buffer).setUint32(${base}+slot*4,0,true)`,retired:`e.wnd_lookup_retire(${parent})`,'parent-generation':`e.destroy_dialog_frame(${parent});e.wnd_table_set(${parent},0xffff0001)`});
     }
     let code=faults[faultMode];assert(code,mode);if(faultMode==='callback'){
      const base=require('../lib/region-map.generated').BASE.DIALOG_STATE_TABLE;
      code=`let slot=0;while(slot<256&&e.wnd_slot_hwnd(slot)!==${isNested?parent:h})slot++;if(slot===256)throw Error('missing native slot');new DataView(memory.buffer).setUint32(${base}+slot*16,0x402400,true)`;
     }
     await send({action:'eval',code:`(()=>{const e=instance.exports;${code};return true})()`});await send({action:'step',n:1});
     const receipt=await send({action:'guarded-status',nonce});assert.equal(receipt.state,'CANCELLED');assert(!receipt.consumed);save(mode+'-receipt.json',receipt);
     const after=await send({action:'snapshot'});save(mode+'-after.json',after);
     if(isNested&&!['focus','disabled','caption','child-caption'].includes(faultMode))assert(!after.nativeDialogBox?.nestedMessageBox,'native nested seal must independently refuse changed identity/lifetime');
     else if(['foreign-thread','foreign-process','retired','generation','callback'].includes(mode))assert.equal(after.nativeDialogBox,null,'native invocation must independently refuse changed identity/lifetime');
     fs.writeFileSync(path.join(dir,'PERMANENT-UNKNOWN.json'),JSON.stringify({at:Date.now(),mode,noLaterRequests:true}));
    }
    unknown=true;const n=requests,ledger=fs.readFileSync(path.join(dir,'requests.jsonl'),'utf8');for(const args of [['capture','later'],['bind','scene'],['intent','replay','scene','1','1','install']])await controller(args,1);
    assert.equal(requests,n);assert.equal(fs.readFileSync(path.join(dir,'requests.jsonl'),'utf8'),ledger);save(mode+'-terminal.json',{permanentUNKNOWN:true,laterHTTP:0});
   }
  }finally{
   if(s.child.exitCode===null)try{process.kill(-s.child.pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}await s.exited;fs.writeFileSync(path.join(dir,'native.log'),s.output());
   save(mode+'-native-wait.json',{pid:s.child.pid,exit:s.child.exitCode,signal:s.child.signalCode,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded});w.stdin.end();const wr=await ww;save(mode+'-watchdog-wait.json',{pid:w.pid,...wr,actualWait:true,stdoutEOF:w.stdout.readableEnded,stderrEOF:w.stderr.readableEnded,stdout:ws,stderr:we});assert.equal(wr.exit,0);
  }
 }
 save('qualification.json',{passed:true,modes,originalStarted:false});console.log('PASS native DialogBox invocation identity, real BUTTON transitions and permanent refusal faults');
}
if(require.main===module){if(process.argv[2]==='--unit')units();else run(path.resolve(process.argv[2])).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports.run=run;
