'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
// Authored native startup work followed by public Device2 indexed geometry.
const source=String.raw`
typedef unsigned U; typedef void* P;
#define S __attribute__((stdcall))
#define I __declspec(dllimport)
I void S ExitProcess(U); I void S Sleep(U); I void S OutputDebugStringA(char*); I U S GetTickCount(void);
I P S CreateThread(P,U,P,P,U,P);
I P S CreateWindowExA(U,char*,char*,U,int,int,int,int,P,P,P,P);
I P S SetFocus(P); I int S SetForegroundWindow(P); I int S SetWindowTextA(P,char*); I short S GetAsyncKeyState(int);
I U S GetPixel(P,int,int);
I int S DirectDrawCreateEx(P,P,P,P);
#define C0(o,s) ((int(S*)(P))(*(P**)o)[s])(o)
#define C1(o,s,a) ((int(S*)(P,U))(*(P**)o)[s])(o,(U)a)
#define C2(o,s,a,b) ((int(S*)(P,U,U))(*(P**)o)[s])(o,(U)a,(U)b)
#define C3(o,s,a,b,c) ((int(S*)(P,U,U,U))(*(P**)o)[s])(o,(U)a,(U)b,(U)c)
#define C4(o,s,a,b,c,d) ((int(S*)(P,U,U,U,U))(*(P**)o)[s])(o,(U)a,(U)b,(U)c,(U)d)
#define C5(o,s,a,b,c,d,e) ((int(S*)(P,U,U,U,U,U))(*(P**)o)[s])(o,(U)a,(U)b,(U)c,(U)d,(U)e)
static void check(int h,U n){if(h){OutputDebugStringA("LATENCY fixture HRESULT failure");ExitProcess(n);}}
static U bits(float f){union{float f;U u;}x;x.f=f;return x.u;}
static U iidDD[4]={0x15e65ec0,0x11d23b9c,0x60002fb9,0x5bea9797};
static U iidD3D[4]={0x6aae1ec1,0x11d0662a,0xaa009d88,0x6ab7bb00};
static U hal[4]={0x84e63de0,0x11cf46aa,0xaa001681,0xb78a4700};
static U S auxiliary(P ignored){OutputDebugStringA("LATENCY auxiliary native thread READY");for(;;)Sleep(10);return 0;}
I P S GetDC(P);I int S ReleaseDC(P,P);I int S TextOutA(P,int,int,char*,int);
static void descriptor(P target){U d[31]={124};check(C1(target,22,d),44);char line[280];U at=0;for(U i=0;i<31;i++){for(int j=7;j>=0;j--){U digit=(d[i]>>(j*4))&15;line[at++]=digit<10?'0'+digit:'a'+digit-10;}line[at++]=' ';}line[at]=0;OutputDebugStringA("DEVICE2 public GetSurfaceDesc");OutputDebugStringA(line);if(d[21]!=16)ExitProcess(45);}
void start(void){
 P hwnd=CreateWindowExA(0,"STATIC","AUTHORED software capture latency fixture",0x10000000,0,0,640,480,0,0,0,0);
 if(!hwnd)ExitProcess(10);SetForegroundWindow(hwnd);SetFocus(hwnd);
 P dd=0,d3d=0,primary=0,target=0,device=0,vp=0;U tid=0;
 check(DirectDrawCreateEx(0,&dd,iidDD,0),11);check(C2(dd,20,hwnd,17),12);
 check(C2(dd,0,iidD3D,&d3d),13);
 check(C5(dd,21,640,480,16,0,0),40);U desc[31]={124,0x21};desc[5]=1;desc[26]=0x218;check(C3(dd,6,desc,&primary,0),14);
 U caps[4]={4};check(C2(primary,12,caps,&target),15);P depth=0;U zd[31]={124,0x47};zd[2]=480;zd[3]=640;zd[6]=16;zd[26]=0x24000;check(C3(dd,6,zd,&depth,0),41);check(C1(target,3,depth),42);check(C3(d3d,8,hal,target,&device),16);
 check(C2(d3d,6,&vp,0),17);check(C1(device,6,vp),18);
 U viewport[11]={44,0,0,640,480};viewport[5]=bits(-1);viewport[6]=bits(.75f);viewport[7]=bits(2);viewport[8]=bits(1.5f);viewport[10]=bits(1);
 check(C1(vp,17,viewport),19);check(C1(device,13,vp),20);descriptor(target);P dc=GetDC(hwnd);TextOutA(dc,20,20,"INITIAL GDI",11);ReleaseDC(hwnd,dc);
 U rs[6]={7,14,22,26,27,137},rv[6]={1,1,1,0,0,0};
 for(U i=0;i<6;i++)check(C2(device,23,rs[i],rv[i]),21);

 U v[32]={0};unsigned short indices[6]={0,1,2,2,1,3};
 for(U i=0;i<4;i++){v[i*8]=bits((i&1)?0:-1);v[i*8+1]=bits((i&2)?0:.75f);v[i*8+2]=bits(.5f);v[i*8+4]=0x000000ff;}
 U rect[4]={0,0,640,480};U started=GetTickCount(),checked=0;
 OutputDebugStringA("LATENCY fixture READY expected RGB 51 68 204");
  check(C3(vp,12,1,rect,3),43);check(C0(device,10),25);check(C0(device,11),27);Sleep(1000);SetWindowTextA(hwnd,"AUTHORED startup work begins");volatile U sink=1;for(U i=0;i<200000000;i++){sink=(sink*1664525+1013904223)^(sink>>7);}SetWindowTextA(hwnd,"AUTHORED startup work completed");
for(;;){
  
  check(C3(vp,12,1,rect,3),43);check(C0(device,10),25);
  for(U i=0;i<1;i++)check(((int(S*)(P,U,U,P,U,P,U,U))(*(P**)device)[30])(device,4,2,v,4,indices,6,1),26);
  check(C0(device,11),27);check(C2(primary,11,target,1),28);
  if(!checked){SetWindowTextA(hwnd,"AUTHORED Device2 indexed RGB565 D16");checked=1;}
  Sleep(10);
 }
}
`;
function prepare(out,authoredSource=source){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'fixture.c'),authoredSource);
const imports={kernel32:['ExitProcess@4','Sleep@4','OutputDebugStringA@4','GetTickCount@0'],user32:['CreateWindowExA@48','SetFocus@4','SetForegroundWindow@4','SetWindowTextA@8','GetDC@4','ReleaseDC@8','MessageBoxA@16','ShowWindow@8'],gdi32:['GetPixel@12','TextOutA@20'],ddraw:['DirectDrawCreateEx@16']};
for(const [dll,names]of Object.entries(imports)){fs.writeFileSync(path.join(out,dll+'.def'),'LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',path.join(out,dll+'.def'),'-l',path.join(out,dll+'.lib')]);}
cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',path.join(out,'fixture.c'),'-o',path.join(out,'fixture.obj')]);cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','console','--disable-dynamicbase','--no-insert-timestamp','-o',path.join(out,'fixture.exe'),path.join(out,'fixture.obj'),...Object.keys(imports).map(n=>path.join(out,n+'.lib'))]);return path.join(out,'fixture.exe');}
async function controls(){await progressControls();const {inventory}=require('../tools/rm-startup-run.cjs');const events=[],handlers={};let disabled=false;const session={on:(n,f)=>handlers[n]=f,off:n=>delete handlers[n],send:async(n)=>{events.push(n);if(n==='Debugger.enable')handlers['Debugger.scriptParsed']({scriptLanguage:'WebAssembly',scriptId:'1'});if(n==='Debugger.getScriptSource')return {bytecode:Buffer.from('native-module').toString('base64')};if(n==='Debugger.disable')disabled=true;}};const rows=await inventory(session,'authored');assert.equal(rows.length,1);assert(disabled);assert.deepEqual(events,['Debugger.enable','Debugger.getScriptSource','Debugger.disable']);session.send=async n=>{if(n==='Debugger.enable')handlers['Debugger.scriptParsed']({scriptLanguage:'WebAssembly',scriptId:'1'});if(n==='Debugger.getScriptSource')throw Error('authored inventory failure');if(n==='Debugger.disable')disabled=true;};disabled=false;await assert.rejects(inventory(session,'authored'),/authored inventory failure/);assert(disabled);const {finiteCapture}=require('../tools/rm-startup-run.cjs');let resolveShot,reads=0;const scope={phase:'bound',baseline:{viewport:{width:1,height:1,dpr:1}},page:{evaluate:async()=>{reads++;return {viewport:{width:1,height:1,dpr:1}};},screenshot:()=>new Promise(r=>{resolveShot=r;})}};await assert.rejects(finiteCapture(scope),/whole-frame capture timeout/);assert.equal(scope.phase,'closed');resolveShot(Buffer.from('late'));await new Promise(r=>setTimeout(r,10));assert.equal(reads,1,'late screenshot must not cause a post-UNKNOWN state query');console.log('deferred inventory success/error cleanup and finite late-capture closure PASS');}
async function nativeControls(out,commit,modulePath){
  const {supervise}=require('../tools/native-supervise.cjs'),{PNG}=require('pngjs');
  const fixture=prepare(path.join(out,'input')),rows=[];
  for(const [name,backend,early]of [['early','software',true],['deferred','software',false],['webgl','webgl',false]]){
    const dir=path.join(out,name),now=Date.now()/1000;
    const receipt=await supervise(dir+'-supervisor',[process.execPath,path.resolve(__dirname,'../tools/rm-startup-run.cjs'),dir,commit,modulePath,backend,fixture,early?'early':'deferred'],{deadline:now+100,cleanup_deadline:now+115});
    assert.equal(receipt.leaked,false);assert.equal(receipt.terminated,null);
    const terminal=JSON.parse(fs.readFileSync(path.join(dir,'terminal.json')));
    if(early){assert.equal(terminal.state,'UNKNOWN_CLOSED');assert.match(terminal.error,/stabilization timeout/);assert(!fs.existsSync(path.join(dir,'whole-0.png')));assert.equal(receipt.exit,1);}
    else {assert.equal(terminal.state,'OBSERVED');assert.equal(receipt.exit,0);assert(terminal.bindMs<15000);
      const image=PNG.sync.read(fs.readFileSync(path.join(dir,'whole-0.png')));assert.equal(image.width,1280);assert.equal(image.height,960);
      const pixel=(x,y)=>Array.from(image.data.subarray((y*image.width+x)*4,(y*image.width+x)*4+4));assert.deepEqual(pixel(100,100),[0,0,255,255]);assert.deepEqual(pixel(1000,700),[255,255,255,255]);
      const traces=JSON.parse(fs.readFileSync(path.join(dir,'executors-0.json'))).filter(r=>r.trace);assert(traces.some(r=>r.trace.executor===(backend==='webgl'?'GpuStreamWebGL':'GpuStreamSoftware')&&r.trace.counts.PRESENT>0&&r.trace.counts.DRAW_UP>0));}
    rows.push({name,terminal,exit:receipt.exit});
  }
  fs.writeFileSync(path.join(out,'native-controls.json'),JSON.stringify(rows,null,2));return rows;
}

async function progressControls(){
 const vm=require('node:vm'),{readStartupObservation,startupPage}=require('../tools/rm-startup-run.cjs');
 const win={hwnd:7,processId:1,visible:true,title:'initial UI'},display={windows:[{window:{deref:()=>win}}]};
 const bridge={presenter:{presents:0},stats:{records:5}};
 const context={runningApps:[{name:'authored',wine:{running:true,renderer:{windows:{7:win},_currentDisplayRecord:display},hostCtx:{d3dimBridge:bridge}}}],Date};
 const read=async()=> (await vm.runInNewContext('('+readStartupObservation.toString()+')()',context)).apps[0];
 assert.equal((await read()).completedPRESENT,0);assert.equal((await read()).composed,true);assert.equal((await read()).ready,false);
 bridge.presenter.presents=4;display.windows=[];assert.equal((await read()).completedPRESENT,4);assert.equal((await read()).composed,false);assert.equal((await read()).ready,false);
 display.windows=[{window:{deref:()=>win}}];assert.equal((await read()).ready,true);
 delete bridge.presenter;assert.equal((await read()).completedPRESENT,null);assert.equal((await read()).execution.eip,null);
 let nativeReads=0;
 context.runningApps[0].wine.guestWorker={readExports:async names=>{nativeReads++;
   assert.deepEqual(Array.from(names),['get_eip','get_yield_reason','get_steps']);
   return {get_eip:123,get_yield_reason:15,get_steps:99};}};
 const owned=await read();assert.equal(owned.execution.eip,123);assert.equal(owned.execution.remainingSliceSteps,99);
 assert.equal(owned.windows[0].modalHwnd,null);assert.equal(nativeReads,1);
 let active=true,calls=0;const page=startupPage({evaluate:async()=>{calls++;return {apps:[{ready:false}]};}},[],()=>active);
 const {readInspectionReadiness}=require('../tools/inspection-window.cjs');assert.equal(await page.evaluate(readInspectionReadiness),false);active=false;
 await assert.rejects(page.evaluate(readInspectionReadiness),/closed startup observer/);assert.equal(calls,1);
 let finish,callbacks=0;const rows=[];
 const {InspectionScope}=require('../tools/inspection-window.cjs');
 const scope=new InspectionScope(startupPage({evaluate:()=>new Promise(r=>{finish=r;})},rows,()=>scope.phase!=='closed',async()=>{callbacks++;}));
 await assert.rejects(scope.bind({timeoutMs:40,stableMs:20,pollMs:10}),/stabilization timeout/);
 finish({apps:[{ready:true}]});await new Promise(r=>setTimeout(r,10));
 assert.equal(rows.length,0);assert.equal(callbacks,0);assert.equal(scope.phase,'closed');
 console.log('Separate PRESENT/composition/unknown and closed endpoint controls PASS');
}
async function progressNativeControls(out,commit,modulePath,selected){
 const {run}=require('../tools/rm-startup-run.cjs'),{PNG}=require('pngjs');fs.mkdirSync(out,{recursive:true});
 const noWork=source.replace('for(U i=0;i<200000000;i++)','for(U i=0;i<1;i++)');
 const zero=noWork.replace('for(;;){\n  ', 'Sleep(25000);for(;;){\n  ');
 const modal=zero.replace('Sleep(25000);for(;;)', 'MessageBoxA(hwnd,"AUTHORED initial native modal","STARTUP MODAL",0);Sleep(25000);for(;;)').replace('void start(void){','I int S MessageBoxA(P,char*,char*,U);void start(void){');
 const hidden=noWork.replace('check(C2(primary,11,target,1),28);','check(C2(primary,11,target,1),28);ShowWindow(hwnd,0);Sleep(25000);').replace('void start(void){','I int S ShowWindow(P,int);void start(void){');
 const rows=[];
 for(const [name,input,observed]of [['ordinary',noWork,false],['observed',noWork,true],['zero-present',zero,true],['modal',modal,true],['missing-composition',hidden,true]]){
  if(selected&&!selected.includes(name))continue;
  const fixture=prepare(path.join(out,name+'-input'),input),dir=path.join(out,name);
  const terminal=await run({out:dir,commit,modulePath,backend:'software',fixture,delays:[0],startupObservations:observed});
  const progress=JSON.parse(fs.readFileSync(path.join(dir,'startup-progress.json'))).rows.flatMap(r=>r.apps);
  if(name==='ordinary'||name==='observed'){
   assert.equal(terminal.state,'OBSERVED');const png=PNG.sync.read(fs.readFileSync(path.join(dir,'whole-0.png')));
   assert.deepEqual(Array.from(png.data.subarray((100*png.width+100)*4,(100*png.width+100)*4+4)),[0,0,255,255]);
   assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'inputs.json'))),[]);
   const traces=JSON.parse(fs.readFileSync(path.join(dir,'executors-0.json')));
   assert(traces.some(r=>r.trace.counts.PRESENT>0&&r.trace.counts.DRAW_UP>0));
   assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'errors.json'))),[]);
   if(observed)assert(progress.some(a=>a.completedPRESENT>0&&a.composed===true&&a.ready));
  }else{
   assert.equal(terminal.state,'UNKNOWN_CLOSED');assert(terminal.failedAt-terminal.bindStartedAt>=15000);assert(terminal.failedAt-terminal.bindStartedAt<17000);
   if(name==='missing-composition')assert(progress.some(a=>a.completedPRESENT>0&&a.windows.some(w=>w.composed===false)));
   else assert(progress.some(a=>a.completedPRESENT===0&&a.composed===true));
   if(name==='modal')assert(progress.some(a=>a.windows.some(w=>w.visible&&w.isDialog&&w.title==='STARTUP MODAL'&&w.nativeOwnerHwnd)));
  }
  rows.push({name,terminal,polls:progress.length});fs.writeFileSync(path.join(out,'native-progress-controls.json'),JSON.stringify(rows,null,2));
 }
 return rows;
}

module.exports={prepare,controls,nativeControls,progressNativeControls};
if(require.main===module){const [mode,...args]=process.argv.slice(2);if(mode==='progress-native')progressNativeControls(path.resolve(args[0]),args[1],path.resolve(args[2]),args[3]?.split(',')).catch(e=>{console.error(e);process.exitCode=1;});else if(mode==='prepare')console.log(prepare(path.resolve(args[0])));else (mode==='native'?nativeControls(path.resolve(args[0]),args[1],path.resolve(args[2])):controls()).catch(e=>{console.error(e);process.exitCode=1;});}
