'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const progress=require('../lib/cli-native-progress');
const raw=r=>r-0x1000+0x200,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];

// Real PE resources, DialogBox and nested callbacks from the identity fixture.
// Add actual msctls_progress32 template children and real guest timer updates.
function fixture(options={}){
 const b=require('./test-vb5-native-dialog-identity.cjs').fixture(options);
 // The extra child makes the nested template larger than the gap before
 // the import directory at 0x1800. Keep those PE tables intact: corrupting
 // kernel32's descriptor leaves Sleep's name RVA executable as guest code.
 const nestedTemplate=0x2c00,nestedBytes=b.readUInt32LE(raw(0x12b4));
 b.copy(b,raw(nestedTemplate),raw(0x1700),raw(0x1700)+nestedBytes);
 b.writeUInt32LE(nestedTemplate,raw(0x12b0));
 if(options.indirect){
  // The base fixture's two nested indirect calls use a template address.
  for(let i=raw(0x2000);i<raw(0x2500)-4;i++)
   if(b[i]===0x68&&b.readUInt32LE(i+1)===0x401700)b.writeUInt32LE(0x400000+nestedTemplate,i+1);
 }
 const importDirectory=Buffer.from(b.subarray(raw(0x1800),raw(0x1850)));
 for(const [r,entry]of [[0x1500,0x12a0],[nestedTemplate,0x12b0]]){
  b.writeUInt16LE(3,raw(r+8));
  let a=raw(r+b.readUInt32LE(raw(entry+4)));a=(a+3)&~3;
  const w=n=>{b.writeUInt16LE(n&65535,a);a+=2;},d=n=>{b.writeUInt32LE(n>>>0,a);a+=4;},s=t=>{for(const c of t)w(c.charCodeAt(0));w(0);};
  d(options.password?0x50000020:0x50000000);d(0);w(10);w(45);w(195);w(12);w(2106);
  s(options.password?'EDIT':options.unsupported?'msctls_trackbar32':'msctls_progress32');s('Generic1');w(0);
  assert(a<=raw(r+0x200));b.writeUInt32LE(a-raw(r),raw(entry+4));
 }
 assert(b.subarray(raw(0x1800),raw(0x1850)).equals(importDirectory),'resource templates must not overwrite PE imports');
 let p=0x1c00;
 for(const [i,name]of ['SetTimer','GetDlgItem','SendMessageA'].entries()){
  b.writeUInt32LE(p,raw(0x1960+i*4));b.write(name+'\0',raw(p+2));p+=name.length+3;
 }
 // Each callback first runs the shared timer handler, then its original body.
 for(const [r,body]of [[0x2300,0x2a00],[0x2400,0x2b00]]){
  b.copy(b,raw(body),raw(r),raw(r+0x100));
  const code=[0x68,...u32(0x400000+body),0xe9,...u32(0x2800-r-10)];b.set(code,raw(r));
 }
 const c=[],labels={},fix=[];const e=(...v)=>c.push(...v),push=n=>e(0x68,...u32(n)),call=i=>e(0xff,0x15,...u32(0x401940+i*4));
 const label=n=>labels[n]=c.length,j=(op,n)=>{e(...op,0,0,0,0);fix.push([c.length-4,n]);};
 // Stack: original callback address, return, HWND, message, wParam, lParam.
 e(0x81,0x7c,0x24,12,...u32(0x110));j([0x0f,0x85],'timer');
 push(0);push(40);push(77);e(0xff,0x74,0x24,20);call(8);j([0xe9],'chain');
 label('timer');e(0x81,0x7c,0x24,12,...u32(0x113));j([0x0f,0x85],'chain');
 push(2106);e(0xff,0x74,0x24,12);call(9);
 // Retain the control HWND across two ordinary synchronous sends. A guest
 // counter per dialog alternates the public maximum between 100 and 164.
 // A shared counter aliases when an outer and nested timer fire together.
 e(0x53,0x89,0xc3,0x8b,0x54,0x24,12,0x83,0xe2,63,0xff,0x04,0x95,...u32(0x4026b0),0x8b,0x04,0x95,...u32(0x4026b0),0x83,0xe0,1,0xc1,0xe0,6,0x83,0xc0,100);
 e(0x50);push(0);push(0x406);e(0x53);call(10);
 push(0);push(0);push(0x405);e(0x53);call(10);e(0x5b);
 label('chain');e(0xc3); // RET enters the preserved original DLGPROC.
 for(const [at,n]of fix){const v=Buffer.alloc(4);v.writeInt32LE(labels[n]-at-4);for(let i=0;i<4;i++)c[at+i]=v[i];}
 assert(c.length<0x200);b.set(c,raw(0x2800));return b;
}

function units(){
 const w={hwnd:'0x3',live:true,generation:'3',processId:1000,threadId:1,controlClass:17,
  style:0x50000000,parent:'0x1',owner:'0x0',title:'Generic1',nativeTextAvailable:true,
  progress:{contract:progress.CONTRACT,available:true,min:0,max:0,pos:0,step:0}};
 assert(progress.qualified(w),'zero width range is observationally valid');
 const next=structuredClone(w);Object.assign(next.progress,{min:-2147483648,max:2147483647,pos:2147483647,step:-2147483648});
 assert(progress.qualified(next));assert.deepEqual(progress.inputMetadata(w),progress.inputMetadata(next));
 for(const change of [p=>p.pos=2147483648,p=>p.pos=-1,p=>p.max=-1,p=>p.available=false,p=>delete p.step,p=>p.contract='unknown']){
  const v=structuredClone(w);change(v.progress);assert(!progress.qualified(v));
 }
 for(const field of ['generation','parent','owner','style','title','processId','threadId']){
  const v=structuredClone(w);v[field]='changed';assert.notDeepEqual(progress.inputMetadata(w),progress.inputMetadata(v),field);
 }
 const e={ctrl_get_class:()=>17,wnd_lookup_generation:()=>3n,wnd_lookup_live:()=>1,native_progress_get:(h,f)=>[1,0,0,0,0][f]};
 assert.deepEqual(progress.observe(e,3),w.progress);
 assert.deepEqual(progress.observe({...e,native_progress_get:()=>0},3),{contract:progress.CONTRACT,available:false});
 assert.deepEqual(progress.observe({...e,native_progress_get:undefined},3),{contract:progress.CONTRACT,available:false});
 assert.equal(progress.observe({...e,ctrl_get_class:()=>1},3),null);
 let reads=0;assert.throws(()=>progress.observe({...e,wnd_lookup_generation:()=>++reads},3),/retired/);
 assert(!progress.supported({...w,controlClass:18}));assert(!progress.supported({...w,controlClass:2,nativeTextAvailable:false}));
 const b=fixture();assert.equal(b.readUInt16LE(raw(0x1508)),3);assert.equal(b.readUInt16LE(raw(b.readUInt32LE(raw(0x12b0))+8)),3);
 assert.equal(b.readUInt32LE(raw(0x1800)),0x1900);assert.equal(b.readUInt32LE(raw(0x1810)),0x1900);
 {
  // The controller's own projection, in process: m.context is pure.
  const m=require('../tools/vb5cce-reviewed-control.js');
  const bar={controlClass:17,live:true,generation:'3',processId:1000,threadId:1,parent:'0x1',owner:'0x0',style:0x50000000,title:'Generic1',progress:{contract:'native-progress-v1',available:true,min:0,max:0,pos:0,step:0}};
  const scene={};for(const k of ['mainHwnd','windows','modalHwnd','focus','focusTopLevel','focusWindow','capture','physicalUp','nativeProcess','nativeMessageBox','nativeDialogBox','screen'])scene[k]=null;scene.windows=[bar];
  const before=m.context(scene);assert.deepStrictEqual(before.windows[0].progress,{contract:'native-progress-v1',available:true});
  Object.assign(bar.progress,{min:-2147483648,max:2147483647,pos:2147483647,step:-100});assert.deepStrictEqual(m.context(scene),before);
  for(const [key,value] of [['title','Changed'],['parent','0x9'],['generation','4'],['owner','0x9'],['processId',1001],['threadId',2],['style',0]]){
   const old=bar[key];bar[key]=value;assert.notDeepStrictEqual(m.context(scene),before,key);bar[key]=old;
  }
  bar.progress.extra=1;assert.notDeepStrictEqual(m.context(scene),before);delete bar.progress.extra;
  bar.progress.available=false;assert.notDeepStrictEqual(m.context(scene),before);
  console.log('PASS progress-only repaint cannot acknowledge finite intent completion');
 }
 console.log('PASS typed native ProgressBar zero/edge values, availability, identity and strict observational projection');
}
function reviewUnits(){
 const native=require('../lib/cli-native-scene');
 const root={hwnd:'0x1',generation:'1',live:true,visible:true,processId:1000,threadId:1,
  controlClass:0,nativeTextAvailable:true,parent:'0x0',owner:'0x0',isChild:false,style:0x90000000,
  nativeClientRect:{screenX:0,screenY:0,w:800,h:600}};
 const button={...root,hwnd:'0x2',generation:'2',parent:root.hwnd,isChild:true,controlClass:1,title:'OK',style:0x50000000,
  screenX:10,screenY:10,w:60,h:20};
 const bar={...button,hwnd:'0x3',generation:'3',controlClass:17,title:'Generic1',screenY:40,
  progress:{contract:progress.CONTRACT,available:true,min:0,max:100,pos:0,step:10}};
 let scene={mainHwnd:root.hwnd,windows:[root,button,bar],modalHwnd:'0x0',focus:button.hwnd,
  focusTopLevel:root.hwnd,focusWindow:button,capture:'0x0',physicalUp:true,nativeProcess:{pid:123,executable:'fixture'},
  nativeDialogBox:null,nativeMessageBox:null,screen:{w:800,h:600},eip:'0x402000',quit:false,
  pointerMapping:{canvas:{w:800,h:600},transform:null,viewport:null,clip:null}};
 const registry=native.createReviewedContexts();
 const cap=()=>registry.capture(()=>structuredClone(scene),()=>Buffer.from('complete fixture frame'),()=>{});
 const c=cap(),review={contract:c.contract,captureId:c.captureId,pngSHA256:c.pngSHA256,reviewed:true,
  reviewedAt:Date.now(),scope:'menu',targetHwnd:button.hwnd};
 assert.deepEqual(native.captureFailures(scene),{context:[],controls:[]});
 Object.assign(scene.windows[2].progress,{min:-10,max:1000,pos:500,step:0});registry.verify(scene,review,{action:'mousedown',x:20,y:15},'progress');
 assert.equal(c.snapshot.windows[2].progress.pos,0,'retained original observation stays truthful');
 const stable=structuredClone(scene);
 for(const change of [w=>w.parent='0x9',w=>w.owner='0x9',w=>w.title='Changed',w=>w.style^=1,
   w=>w.generation='99',w=>w.processId++,w=>w.threadId++,w=>w.screenX++,w=>w.live=false,
   w=>w.progress.available=false,w=>w.progress.extra='new public state',w=>w.controlClass=18,
   w=>{w.controlClass=2;w.nativeTextAvailable=false;}]){
  scene=structuredClone(stable);change(scene.windows[2]);assert.throws(()=>registry.verify(scene,review),/context changed/);
 }
 scene=structuredClone(stable);const readonly=cap();
 assert.throws(()=>registry.verify(scene,{...review,captureId:readonly.captureId,pngSHA256:readonly.pngSHA256,
  reviewedAt:Date.now(),targetHwnd:bar.hwnd},{action:'mousedown',x:20,y:45},'readonly'),/read.only|observational/);
 // A repaint during encoding is safe only when all input metadata survives.
 const observed=registry.capture(()=>structuredClone(scene),()=>{scene.windows[2].progress.pos++;return Buffer.from('other frame');},()=>{});
 assert.equal(observed.snapshot.windows[2].progress.pos+1,observed.observationAfter.windows[2].progress.pos);
 assert.throws(()=>registry.capture(()=>structuredClone(scene),()=>{scene.windows[1].title='Cancel';return Buffer.from('new caption');},()=>{}),/context changed/);
 console.log('PASS progress repaint preserves stable BUTTON intent; caption/geometry/actor/parent/generation/unsupported/password changes and progress targets refused');
}
async function stateTests(out){
 const extraWat=String.raw`
 (func (export "progress_test_make") (param $parent i32) (result i32)
   (call $ctrl_create_child (local.get $parent) (i32.const 17) (i32.const 2106)
     (i32.const 10) (i32.const 10) (i32.const 200) (i32.const 16) (i32.const 0x50000000) (i32.const 0)))
 (func (export "progress_test_send") (param $h i32) (param $m i32) (param $w i32) (param $l i32) (result i32)
   (call $wnd_send_message (local.get $h) (local.get $m) (local.get $w) (local.get $l)))
 (func (export "progress_test_uninitialized") (param $h i32)
   (call $wnd_table_set (local.get $h) (global.get $WNDPROC_CTRL_NATIVE))
   (call $ctrl_table_set (call $wnd_table_find (local.get $h)) (i32.const 17) (i32.const 2106)))
 `;
 const {exports:e,memory}=await require('./render-helper').bootRenderHarness({extraWat,fonts:'none'});
 const parent=0x10099;e.wnd_table_set(parent,0xffff0002);
 const h=e.progress_test_make(parent),read=()=>progress.observe(e,h),send=(m,w=0,l=0)=>e.progress_test_send(h,m,w,l);
 assert.deepEqual(read(),{contract:progress.CONTRACT,available:true,min:0,max:100,pos:0,step:10});
 const before=Buffer.from(new Uint8Array(memory.buffer));for(let i=0;i<20;i++)read();
 assert(before.equals(Buffer.from(new Uint8Array(memory.buffer))),'getters must change no byte of native memory');
 assert.equal(send(0x402,45),0);assert.equal(read().pos,45);
 assert.equal(send(0x403,-1000),45);assert.equal(read().pos,0);
 assert.equal(send(0x404,30),10);assert.equal(send(0x405),0);assert.equal(read().pos,30);
 send(0x402,95);assert.equal(send(0x405),95);assert.equal(read().pos,0,'actual native STEPIT wraps');
 send(0x406,-2147483648,2147483647);send(0x402,2147483647);
 assert.deepEqual(read(),{contract:progress.CONTRACT,available:true,min:-2147483648,max:2147483647,pos:2147483647,step:30});
 send(0x406,0,0);const zero=read();
 // Record the runtime's actual zero-range behavior, never substitute defaults.
 assert.equal(zero.min,0);assert.equal(zero.max,1);assert.equal(zero.pos,1);
 e.wnd_table_set(h,0x402300);assert.equal(e.native_progress_get(h,0),0,'guest subclass cannot claim virtual native getter provenance');
 assert.equal(read().contract,progress.STORAGE,'retained storage has its own provenance');
 e.wnd_table_set(h,0xffff0002);assert(read().available);
 const generation=String(e.wnd_lookup_generation(h));send(2);assert.equal(read().available,false,'destroyed state unavailable');
 e.wnd_lookup_retire(h);assert.equal(read().available,false);
 e.wnd_table_set(h,0xffff0002);assert.equal(read().available,false,'editing a retired slot cannot revive it');
 e.destroy_dialog_frame(h);e.wnd_table_set(h,0xffff0002);
 assert.notEqual(String(e.wnd_lookup_generation(h)),generation,'reused HWND is a new lifetime');
 assert.equal(e.native_progress_get(h,0),0,'reused uninitialized slot cannot expose old state');
 e.progress_test_uninitialized(0x10199);assert.equal(e.native_progress_get(0x10199,0),0);
 assert.equal(e.native_progress_get(parent,0),0);assert.equal(e.native_progress_get(0,0),0);
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'state-proof.json'),JSON.stringify({passed:true,zeroRangeActual:zero,readOnlyMemoryEquality:true,defaultsFromNativeState:true,destroyReuse:true,subclassRefusal:true,originalStarted:false},null,2));
 console.log('PASS native ProgressBar state, public updates, read-only bytes, edge ranges, subclass/destroy/reuse/uninitialized refusal');
}
async function nativeTests(out){
 const native=require('./test-vb5-native-dialog-identity.cjs');
 await native.run(out,{fixtureFactory:fixture,onCapture:async({ss,send,save,name})=>{
  const bar=ss.windows.find(w=>w.parent===ss.modalHwnd&&w.controlClass===17);assert(bar&&progress.qualified(bar));
  let after,changed;const due=Date.now()+2000;
  do{await new Promise(r=>setTimeout(r,25));after=await send({action:'snapshot'});
   changed=after.windows.find(w=>w.hwnd===bar.hwnd);assert(changed&&progress.qualified(changed));
   assert.deepEqual(progress.inputMetadata(changed),progress.inputMetadata(bar));
  }while((changed.progress.pos===bar.progress.pos||changed.progress.max===bar.progress.max)&&Date.now()<due);
  assert.notEqual(changed.progress.pos,bar.progress.pos,'real guest timer must advance the native progress bar');
  assert.notEqual(changed.progress.max,bar.progress.max,'real guest timer must change the native range');
  save(name+'-progress-updates.json',{before:bar,after:changed,actualGuestTimer:true,rangeAndPositionUpdated:true,stableInputMetadata:true});
 }});
}
async function refusalTests(out){
 const cp=require('node:child_process'),net=require('node:net'),{startControlSession}=require('./control-session');
 const pause=ms=>new Promise(r=>setTimeout(r,ms));fs.mkdirSync(out,{recursive:true});
 for(const mode of ['unsupported','password','progress-target']){
  const dir=path.join(out,mode);fs.mkdirSync(dir);
  const save=(n,v)=>fs.writeFileSync(path.join(dir,n),JSON.stringify(v,null,2));
  fs.copyFileSync(path.join(out,'../runtime-inputs.json'),path.join(dir,'runtime-inputs.json'));
  const exe=path.join(dir,'fixture.exe');fs.writeFileSync(exe,fixture({unsupported:mode==='unsupported',password:mode==='password'}));
  const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
  const started=Date.now()/1000;save('launch.json',{deadline:started+240,gameplayCutoff:started+60,reserveSeconds:180,rootPort:port});
  const w=cp.spawn(process.execPath,['-e',"let pid;const t=setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGKILL')}catch{};process.exit(2)},25000);console.log('ARMED');process.stdin.on('data',b=>pid=Number(b));process.stdin.on('end',()=>clearTimeout(t));"],{stdio:['pipe','pipe','pipe']});
  let ws='',we='';w.stdout.on('data',b=>ws+=b);w.stderr.on('data',b=>we+=b);const ww=new Promise(r=>w.on('close',(exit,signal)=>r({exit,signal})));
  while(!ws.includes('ARMED'))await pause(5);save('watchdog-arm.json',{pid:w.pid,prearmed:true,deadlineMs:25000,at:Date.now()});
  const s=startControlSession(['test/run.js','--exe='+exe,'--no-build','--winver=nt4','--threads','--real-ticks','--screen=800x600','--control-stdin','--control='+port,'--max-seconds=20','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],{spawnOptions:{detached:true}});
  w.stdin.write(String(s.child.pid));save('native-pid.json',{pid:s.child.pid,startToken:require('../tools/native-proc.cjs').token(s.child.pid)});
  let controllerCount=0;const controller=async(args,ok)=>{const r=await new Promise(resolve=>{
   const child=cp.spawn(process.execPath,['tools/vb5cce-reviewed-control.js',...args],{env:{...process.env,DELPHI5_RUN:dir,DELPHI5_PORT:String(port)},timeout:5000});let stdout='',stderr='';
   child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.on('close',(exit,signal)=>resolve({exit,signal,stdout,stderr,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded}));
  });save('controller-'+(++controllerCount)+'.json',{args,...r});assert.equal(r.exit===0,ok,r.stdout+r.stderr);};
  try{
   let scene;const due=Date.now()+15000;do{scene=await s.send({action:'snapshot'});if(scene.modalHwnd!=='0x0')break;assert(Date.now()<due);await pause(20);}while(true);
   save('actual-native-snapshot.json',scene);assert(scene.nativeDialogBox);
   await controller(['capture','scene'],mode==='progress-target');
   if(mode==='progress-target'){
    const rr=JSON.parse(fs.readFileSync(path.join(dir,'scene.json'))),bar=rr.snapshot.windows.find(w=>w.controlClass===17);
    assert(progress.qualified(bar));await controller(['review','scene','Authored native observational progress target refusal','Generic1','install',bar.hwnd],true);
    await controller(['bind','scene'],false);
   }
   assert(fs.existsSync(path.join(dir,'PERMANENT-UNKNOWN.json')));
   const ledger=fs.readFileSync(path.join(dir,'requests.jsonl'),'utf8');
   for(const args of [['capture','later'],['bind','scene'],['intent','replay','scene','1','1','install']])await controller(args,false);
   assert.equal(fs.readFileSync(path.join(dir,'requests.jsonl'),'utf8'),ledger);
   save('refusal.json',{mode,permanentUNKNOWN:true,laterHTTP:0,inputCount:0,originalStarted:false});
  }finally{
   if(s.child.exitCode===null)try{process.kill(-s.child.pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}await s.exited;
   fs.writeFileSync(path.join(dir,'native.log'),s.output());save('native-wait.json',{pid:s.child.pid,exit:s.child.exitCode,signal:s.child.signalCode,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded});
   w.stdin.end();const wr=await ww;save('watchdog-wait.json',{pid:w.pid,...wr,actualWait:true,stdoutEOF:w.stdout.readableEnded,stderrEOF:w.stderr.readableEnded,stdout:ws,stderr:we});assert.equal(wr.exit,0);
  }
 }
 console.log('PASS real native unsupported/password/read-only progress target refusal and zero requests after UNKNOWN');
}
async function observeTests(out){
 const cp=require('node:child_process'),{startControlSession}=require('./control-session');
 const pause=ms=>new Promise(r=>setTimeout(r,ms));fs.mkdirSync(out,{recursive:true});
 const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)),exe=path.join(out,'fixture.exe');fs.writeFileSync(exe,fixture());
 const w=cp.spawn(process.execPath,['-e',"let pid;const t=setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGKILL')}catch{};process.exit(2)},25000);console.log('ARMED');process.stdin.on('data',b=>pid=Number(b));process.stdin.on('end',()=>clearTimeout(t));"],{stdio:['pipe','pipe','pipe']});
 let ws='',we='';w.stdout.on('data',b=>ws+=b);w.stderr.on('data',b=>we+=b);const ww=new Promise(r=>w.on('close',(exit,signal)=>r({exit,signal})));
 while(!ws.includes('ARMED'))await pause(5);save('watchdog-arm.json',{pid:w.pid,prearmed:true,deadlineMs:25000,at:Date.now()});
 const s=startControlSession(['test/run.js','--exe='+exe,'--no-build','--winver=nt4','--threads','--real-ticks','--screen=800x600','--control-stdin','--max-seconds=20','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],{spawnOptions:{detached:true}});w.stdin.write(String(s.child.pid));
 try{
  let scene,bar;const due=Date.now()+15000;do{scene=await s.send({action:'snapshot'});bar=scene.windows.find(w=>w.controlClass===17);if(bar)break;assert(Date.now()<due);await pause(20);}while(true);
  assert(scene.nativeDialogBox);save('native-dialog-progress.json',scene);const h=parseInt(bar.hwnd,16);
  const read=()=>s.send({action:'eval',code:`(()=>{const e=instance.exports;return {available:e.native_progress_get(${h},0),values:[1,2,3,4].map(f=>e.native_progress_get(${h},f)),generation:String(e.wnd_lookup_generation(${h})),parent:e.wnd_get_parent(${h}),style:e.wnd_get_style_export(${h})>>>0}})()`});
  const first=await read();assert.equal(first.available,1);const states=[first];
  while(states.length<3 || states.every(v=>v.values[2]===first.values[2])){assert(Date.now()<due,'guest timer failed');await pause(45);states.push(await read());}
  for(const state of states){assert.equal(state.generation,bar.generation);assert.equal(state.parent,parseInt(bar.parent,16));assert.equal(state.style,bar.style);assert.equal(state.values[0],0);assert([100,164].includes(state.values[1]));assert.equal(state.values[3],10);}
  save('observation-proof.json',{passed:true,states,actualDialogBox:true,actualGuestTimer:true,inputCount:0,originalStarted:false});
 }finally{
  if(s.child.exitCode===null)try{process.kill(-s.child.pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}await s.exited;
  fs.writeFileSync(path.join(out,'native.log'),s.output());save('native-wait.json',{pid:s.child.pid,exit:s.child.exitCode,signal:s.child.signalCode,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded});
  w.stdin.end();const wr=await ww;save('watchdog-wait.json',{pid:w.pid,...wr,actualWait:true,stdoutEOF:w.stdout.readableEnded,stderrEOF:w.stderr.readableEnded,stdout:ws,stderr:we});assert.equal(wr.exit,0);
 }
 console.log('PASS actual native DialogBox/template ProgressBar and real guest timer updates through read-only getters');
}
module.exports={fixture,units,stateTests,reviewUnits,nativeTests,refusalTests,observeTests};
if(require.main===module){
 if(process.argv[2]==='--prepare')fs.writeFileSync(process.argv[3],fixture(),{flag:'wx'});
 else if(process.argv[2]==='--state')stateTests(path.resolve(process.argv[3])).catch(e=>{console.error(e);process.exitCode=1;});
 else if(process.argv[2]==='--review-unit'){units();reviewUnits();}
 else if(process.argv[2]==='--native')nativeTests(path.resolve(process.argv[3])).catch(e=>{console.error(e);process.exitCode=1;});
 else if(process.argv[2]==='--refusals')refusalTests(path.resolve(process.argv[3])).catch(e=>{console.error(e);process.exitCode=1;});
 else if(process.argv[2]==='--observe')observeTests(path.resolve(process.argv[3])).catch(e=>{console.error(e);process.exitCode=1;});
 else units();
}
