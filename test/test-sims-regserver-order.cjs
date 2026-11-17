'use strict';
// Authored x86 programs: real CreateProcess, finite wait, registry reads and
// in-process COM activation. --prepare writes small fixtures, never game media.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const source = String.raw`
typedef unsigned int U;typedef int H;typedef void *P;
#define CALL __attribute__((stdcall))
#define API __declspec(dllimport) CALL
void *memcpy(void*d,const void*s,U n){U i;for(i=0;i<n;i++)((char*)d)[i]=((const char*)s)[i];return d;}
void API ExitProcess(U);void API OutputDebugStringA(const char*);
P API GetStdHandle(U);U API WriteFile(P,const char*,U,U*,P);
P API CreateFileA(const char*,U,U,P,U,U,P);
U API TerminateProcess(P,U);
U API CreateProcessA(const char*,char*,P,P,U,U,P,const char*,P,P);
U API WaitForSingleObject(P,U);U API GetExitCodeProcess(P,U*);U API CloseHandle(P);
H API RegCreateKeyExA(P,const char*,U,char*,U,U,P,P*,U*);
H API RegOpenKeyExA(P,const char*,U,U,P*);
H API RegSetValueExA(P,const char*,U,U,const char*,U);
H API RegQueryValueExA(P,const char*,P,U*,char*,U*);H API RegCloseKey(P);
H API CoInitialize(P);H API CoCreateInstance(P,P,U,P,P*);
P API CreateDialogIndirectParamA(P,P,P,P,U);H API EndDialog(P,H);
U API DestroyWindow(P);
static U cls[4]={0x52b8a1ca,0x43173219,0x3180b7af,0x93561211};
static U unk[4]={0,0,0xc0,0x46000000};
#if REAL_REGISTRAR
static const char key[]="CLSID\\{91814EC0-B5F0-11D2-80B9-00104B1F6CEA}\\LocalServer32";
#else
static const char key[]="CLSID\\{52B8A1CA-3219-4317-AFB7-803111125693}\\InprocServer32";
#endif
static P output;
static void report(const char *s,U v){char b[160];U n=0,i,w=0;while(s[n]){b[n]=s[n];n++;}b[n++]='=';for(i=0;i<8;i++)b[n++]="0123456789abcdef"[(v>>(28-i*4))&15];b[n++]='\n';b[n]=0;OutputDebugStringA(b);
 if(!output)output=CreateFileA(CHILD?"C:\\registrar-report.txt":"C:\\parent-report.txt",0x40000000,3,0,2,0,0);
 WriteFile(output,b,n,&w,0);}
static void check(U yes,U code){if(!yes)ExitProcess(code);}
static U query(void){P k=0;char b[128];U n=128,t=0;H h=RegOpenKeyExA((P)0x80000000,key,0,0x20019,&k);if(!h){h=RegQueryValueExA(k,"",0,&t,b,&n);RegCloseKey(k);}return h;}
static H activate(void){P o=0;H hr=CoCreateInstance(cls,0,1,unk,&o);if(!hr&&o){P *v=*(P**)o;((U(CALL*)(P))v[2])(o);}return hr;}
static void parent(void){U si[17]={68},pi[4]={0},code=259,w;char cmd[]="C:\\order\\registrar.exe -RegServer";
 CoInitialize(0);check(query()==2,16);
#if !REAL_REGISTRAR
 check((U)activate()==0x80040154,17);
#endif
 check(CreateProcessA(0,cmd,0,0,0,0,0,0,si,pi),10);report("parent.process",pi[0]);
#if POLL_FIRST
 w=WaitForSingleObject((P)pi[0],0);report("parent.poll",w);check(w==258,18);
 check(GetExitCodeProcess((P)pi[0],&code),11);report("parent.pending-code",code);check(code==259,19);
#endif
 w=WaitForSingleObject((P)pi[0],10000);report("parent.wait",w);
 check(GetExitCodeProcess((P)pi[0],&code),11);report("parent.child-code",code);
#if TIMEOUT_EXPECTED
 check(w==258,12);check(code==259,13);check(query()==2,14);
 check(TerminateProcess((P)pi[0],37),22);check(WaitForSingleObject((P)pi[0],0xffffffff)==0,23);
 check(GetExitCodeProcess((P)pi[0],&code),24);report("parent.terminated-code",code);check(code==37,25);check(query()==2,26);
#else
 report("after.query",query());
#if !REAL_REGISTRAR
 report("after.activation",activate());
#endif
 check(w==0,12);check(code==CHILD_CODE,13);check(query()==(CHILD_CODE?2:0),14);
#if !REAL_REGISTRAR
 check((U)activate()==(CHILD_CODE?0x80040154:0),15);
#endif
#endif
 CloseHandle((P)pi[1]);CloseHandle((P)pi[0]);
}
static H CALL dialog(P hwnd,U msg,U wp,U lp){if(msg==0x110){if(DIALOG==1)parent();return 1;}return 0;}
void start(void){
#if CHILD
 P k=0;U disp=0;report("child.begin",CHILD_CODE);
#if HOLD
 // Actual runnable guest work stays pending until the parent's real ten
 // second process wait expires and TerminateProcess ends this child.
 volatile U work=1;for(;;)work=work*1664525U+1013904223U;
#endif
 if(!CHILD_CODE){check(!RegCreateKeyExA((P)0x80000000,key,0,0,0,0x2001f,0,&k,&disp),20);check(!RegSetValueExA(k,"",0,1,"C:\\order\\factory.dll",21),21);RegCloseKey(k);report("child.query",query());}
 report("child.exit",CHILD_CODE);ExitProcess(CHILD_CODE);
#else
#if DIALOG
 unsigned short template[]={0,0x90c0,0,0,0,0,0,100,80,0,0,0};
 P hwnd=CreateDialogIndirectParamA(0,template,0,dialog,0);check(hwnd!=0,30);
 if(DIALOG==2)parent();
 check(DestroyWindow(hwnd),31);
#else
 parent();
#endif
 report("parent.done",0);ExitProcess(0);
#endif
}`;
const dll = String.raw`
typedef unsigned int U;typedef void *P;
#define CALL __attribute__((stdcall))
static U CALL qi(P self,P iid,P*out){*out=self;return 0;}
static U CALL ref(P self){return 2;}
static U CALL release(P self){return 1;}
static P ov[]={qi,ref,release};static P object=ov;
static U CALL create(P self,P outer,P iid,P*out){if(outer)return 0x80040110;*out=&object;return 0;}
static U CALL lock(P self,U yes){return 0;}
static P fv[]={qi,ref,release,create,lock};static P factory=fv;
__declspec(dllexport) U CALL DllGetClassObject(P cls,P iid,P*out){*out=&factory;return 0;}
U CALL entry(P a,U b,P c){return 1;}
`;
function prepare(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'client.c'),source);fs.writeFileSync(path.join(out,'factory.c'),dll);
 let sequence=0;
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{encoding:'utf8'});fs.writeFileSync(path.join(out,`tool-${++sequence}-wait.json`),JSON.stringify({command,args,pid:r.pid,exit:r.status,signal:r.signal,actualWait:r.status!==null,stdoutEOF:!r.error,stderrEOF:!r.error,stdout:r.stdout,stderr:r.stderr,error:r.error?.message},null,2));assert.equal(r.status,0,r.stderr||r.error?.message);};
 const libs={kernel32:['ExitProcess@4','OutputDebugStringA@4','CreateFileA@28','GetStdHandle@4','WriteFile@20','CreateProcessA@40','WaitForSingleObject@8','GetExitCodeProcess@8','CloseHandle@4','TerminateProcess@8'],advapi32:['RegCreateKeyExA@36','RegOpenKeyExA@20','RegSetValueExA@24','RegQueryValueExA@24','RegCloseKey@4'],ole32:['CoInitialize@4','CoCreateInstance@20'],user32:['CreateDialogIndirectParamA@20','EndDialog@8','DestroyWindow@4']};
 for(const [name,names]of Object.entries(libs)){fs.writeFileSync(path.join(out,name+'.def'),'LIBRARY '+name+'.dll\nEXPORTS\n'+names.join('\n')+'\n');run('llvm-dlltool',['-m','i386','-k','-d',path.join(out,name+'.def'),'-l',path.join(out,name+'.lib')]);}
 function compile(name,file,defs=[],shared=false){run('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1',...defs,'-c',path.join(out,file),'-o',path.join(out,name+'.obj')]);run('ld',['-mi386pe','--entry',shared?'_entry@12':'_start','--subsystem','console','--disable-dynamicbase','--no-insert-timestamp',...(shared?['--shared','--kill-at']:[]),'-o',path.join(out,name+(shared?'.dll':'.exe')),path.join(out,name+'.obj'),...Object.keys(libs).map(n=>path.join(out,n+'.lib'))]);}
 compile('factory','factory.c',[],true);
 for(const [name,child,code,dialog,poll=0]of [['registrar',1,0,0],['failure',1,37,0],['parent',0,0,0],['parent-failure',0,37,0],['parent-dialog',0,0,1],['parent-visible',0,0,2],['parent-poll',0,0,0,1]])compile(name,'client.c',[`-DCHILD=${child}`,`-DCHILD_CODE=${code}`,`-DDIALOG=${dialog}`,`-DPOLL_FIRST=${poll}`]);
 compile('parent-real','client.c',['-DCHILD=0','-DCHILD_CODE=0','-DDIALOG=0','-DREAL_REGISTRAR=1','-DPOLL_FIRST=1']);
 compile('pending','client.c',['-DCHILD=1','-DCHILD_CODE=0','-DDIALOG=0','-DHOLD=1']);
 compile('parent-timeout','client.c',['-DCHILD=0','-DCHILD_CODE=0','-DDIALOG=0','-DTIMEOUT_EXPECTED=1','-DPOLL_FIRST=1']);
}
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function startupHost(out) {
 fs.mkdirSync(out,{recursive:true});
 const fixture=require('./test-sims-inherited-readonly-media-child-context.cjs');
 const mediaCli=require('../lib/media-cli'),context=require('../lib/readonly-media-context');
 const {VirtualFS}=require('../lib/filesystem');
 const iso=fixture.tinyIso(),raw=Buffer.alloc(iso.length/2048*2352);
 for(let i=0;i<iso.length/2048;i++){raw.fill(255,i*2352+1,i*2352+11);raw[i*2352+15]=1;iso.copy(raw,i*2352+16,i*2048,(i+1)*2048);}
 const bin=path.join(out,'control.bin'),cue=path.join(out,'control.cue');
 fs.writeFileSync(bin,raw);fs.writeFileSync(cue,'FILE "control.bin" BINARY\r\n TRACK 01 MODE1/2352\r\n INDEX 01 00:00:00\r\n');
 const opened=[],parent=new VirtualFS();
 try {
  const media=await mediaCli.analyzeMediaPaths([cue]);opened.push(media);await media.plan.mount(parent);context.remember(parent,media);
  const records=context.capture(parent),size=records[0].sources.reduce((n,s)=>n+fs.statSync(s.path).size,0);
  const read=fs.readSync;let scanned=0;
  fs.readSync=function(fd,buffer,offset,length,position){const n=Reflect.apply(read,this,arguments);if(length===1024*1024&&position===null)scanned+=n;return n;};
  const child=new VirtualFS();
  try {opened.push(...await context.restore(child,records));assert.equal(scanned,size,'one fresh full scan of every source, without duplicate remount hashing');}
  finally {fs.readSync=read;}
  assert.deepEqual(context.tree(child,['d']),context.tree(parent,['d']));
  assert.equal(Buffer.from(child.files.get('d:\\maxis.ini').data).toString(),'[fixture]\r\nvalue=CONTROL\r\n');
  assert.equal(child.createFile('D:\\new',0x40000000,2),0);
  const prepared=new VirtualFS(),ticket=context.prepareRestore(records);assert(ticket,'CUE/BIN preparation is supported');
  opened.push(...await context.restore(prepared,records,ticket));
  assert.deepEqual(context.tree(prepared,['d']),context.tree(parent,['d']));
  assert.deepEqual(context.capture(prepared),records);
  await assert.rejects(context.restore(new VirtualFS(),records,ticket),/preparation context mismatch/);
  for(const prepare of [false,true]) {
   const bad=structuredClone(records);bad[0].sources[0].sha256='0'.repeat(64);const empty=new VirtualFS();
   await assert.rejects(context.restore(empty,bad,prepare?context.prepareRestore(bad):null),/pin mismatch/);assert.equal(empty.files.size,0);
  }
  const changed=structuredClone(records),pending=context.prepareRestore(changed);changed[0].layout.dirs.push('d:\\new');
  await assert.rejects(context.restore(new VirtualFS(),changed,pending),/preparation context mismatch/);await pending.cancel();
  for(const complete of [false,true]) {
   const threads=require('node:worker_threads'),Worker=threads.Worker;let exited;
   const exit=new Promise(resolve=>exited=resolve);threads.Worker=class extends Worker{constructor(...a){super(...a);this.once('exit',exited);}};
   let revoked;try{revoked=context.prepareRestore(records);}finally{threads.Worker=Worker;}
   if(complete)assert.equal(await exit,0);await revoked.cancel();
   await assert.rejects(context.restore(new VirtualFS(),records,revoked),/preparation context mismatch/);
  }
  const badLayout=structuredClone(records);badLayout[0].layout.metadata.volumeLabels[0][1]='WRONG';
  await assert.rejects(context.restore(new VirtualFS(),badLayout,context.prepareRestore(badLayout)),/identity mismatch/);
  const collision=new VirtualFS();collision.dirs.add('d:\\foreign');
  await assert.rejects(context.restore(collision,records,context.prepareRestore(records)),/conflicts/);
  // CUE analysis awaits real parsing after the digest was consumed. Revoking
  // that preparation during analysis must still prevent namespace adoption.
  const analyze=mediaCli.analyzeMediaPaths;
  for(const mode of ['cancel','mutate','close']) {
   const transfer=structuredClone(records),ticket=context.prepareRestore(transfer),empty=new VirtualFS();
   mediaCli.analyzeMediaPaths=async(...args)=>{
    const media=await analyze(...args);
    if(mode==='cancel')await ticket.cancel();
    if(mode==='mutate')transfer[0].recipe.exePath='D:\\OTHER.EXE';
    if(mode==='close')media.parts[0].source.close();
    return media;
   };
   try {await assert.rejects(context.restore(empty,transfer,ticket),/preparation cancelled|context mismatch|ownership revoked/);assert.equal(empty.files.size,0);assert.equal(empty.readOnlyDrives.size,0);}
   finally {mediaCli.analyzeMediaPaths=analyze;}
  }
  const threads=require('node:worker_threads'),Worker=threads.Worker;let exited;
  const exit=new Promise(resolve=>exited=resolve);threads.Worker=class extends Worker{constructor(...a){super(...a);this.once('exit',exited);}};
  let stale;try{stale=context.prepareRestore(records);}finally{threads.Worker=Worker;}
  assert.equal(await exit,0);fs.renameSync(bin,bin+'.old');fs.writeFileSync(bin,raw);
  const empty=new VirtualFS();await assert.rejects(context.restore(empty,records,stale),/prepared source changed/);assert.equal(empty.files.size,0);
  prepared.readonlyMediaContexts[0].sourceOwners[0].close();assert.throws(()=>context.capture(prepared),/ownership revoked/);
  fs.writeFileSync(path.join(out,'verified.json'),JSON.stringify({freshSourceBytes:size,unpreparedScannedBytes:scanned,preparedCue:true,fullTreeAndMetadata:true,corruptDigestRefused:true,replacedSourceAfterWorkerExitRefused:true,completedAndActiveCancelRefused:true,collisionRefused:true,liveProviderRevocationRefused:true},null,2));
 } finally {for(const m of opened)mediaCli.closeMedia(m);}
 console.log('PASS CUE/BIN startup: single full digest, opaque preparation, readonly visibility and integrity/cancel/adoption negatives');
}
function verifyNative(out, failure=false, poll=false){
 const read=name=>JSON.parse(fs.readFileSync(path.join(out,name),'utf8'));
 for(const name of ['native-wait.json','watchdog-wait.json','outer-child-wait.json']){
  const w=read(name);assert.equal(w.exit,0,name);for(const k of ['actualWait','stdoutEOF','stderrEOF'])assert.equal(w[k],true,name+': '+k);
 }
 const child=fs.readdirSync(out).filter(n=>/^native-child-.*-wait.json$/.test(n));assert.equal(child.length,1);
 const w=read(child[0]);for(const k of ['actualWait','stdoutEOF','stderrEOF','closed'])assert.equal(w[k],true);
 assert.equal(w.exit,0);assert.equal(w.guardedMerge.merged,true);
 const report=fs.readFileSync(path.join(out,'saves/parent-report.txt'),'utf8');
 if(poll)for(const line of ['parent.poll=00000102','parent.pending-code=00000103'])assert(report.includes(line),line+' missing: '+report);
 for(const line of ['parent.wait=00000000','parent.child-code='+(failure?'00000025':'00000000'),'after.query='+(failure?'00000002':'00000000'),'after.activation='+(failure?'80040154':'00000000'),'parent.done=00000000'])assert(report.includes(line),line+' missing: '+report);
 const registrar=fs.readFileSync(path.join(out,'saves/registrar-report.txt'),'utf8');
 assert(registrar.includes('child.exit='+(failure?'00000025':'00000000')));
 if(!failure)assert(registrar.includes('child.query=00000000'));
 return {report,registrar,childWait:child[0],keys:w.guardedMerge.keys};
}
function verifyPopulated(out,mode) {
 assert(['real','failure','timeout'].includes(mode));
 const read=name=>JSON.parse(fs.readFileSync(path.join(out,name),'utf8'));
 for(const name of ['native-wait.json','watchdog-wait.json','outer-child-wait.json','direct-wait.json']) {
  const w=read(name);assert.equal(w.exit,0,name);for(const key of ['actualWait','stdoutEOF','stderrEOF'])assert.equal(w[key],true,name+': '+key);
 }
 const names=fs.readdirSync(out).filter(n=>/^native-child-.*-wait.json$/.test(n));assert.equal(names.length,1);
 const child=read(names[0]);for(const key of ['actualWait','stdoutEOF','stderrEOF','closed'])assert.equal(child[key],true,key);
 const report=fs.readFileSync(path.join(out,'saves/parent-report.txt'),'utf8');
 for(const line of ['parent.done=00000000','parent.wait='+(mode==='timeout'?'00000102':'00000000'),
   'parent.child-code='+(mode==='timeout'?'00000103':mode==='failure'?'00000025':'00000000')])assert(report.includes(line),line+': '+report);
 if(mode==='timeout') {
  assert(report.includes('parent.terminated-code=00000025'));
  assert.equal(child.guardedMerge.keys,78,'terminated child must not register the class');
 } else {
  assert.equal(child.exit,0);assert.equal(child.guardedMerge.merged,true);
  assert(report.includes('after.query='+(mode==='failure'?'00000002':'00000000')));
  if(mode==='real')assert.equal(child.guardedMerge.keys,293);
 }
 const parent=read('native-pid.json').pid;
 const events=fs.readFileSync(path.join(out,`ordering-${parent}.jsonl`),'utf8').trim().split('\n').map(JSON.parse);
 const entry=events.find(e=>e.event==='waitSingle'&&e.args[1]===10000);assert(entry);
 const complete=events.find(e=>e.event==='_completeWait'&&e.at>=entry.at);assert(complete);
 assert.equal(complete.args[0],mode==='timeout'?258:0);
 if(mode==='timeout') {
  assert(complete.at-entry.at>=10000,'native process timeout must not complete early');
  const merge=events.find(e=>e.event==='merge.end');assert(merge&&merge.at>complete.at,'state publication follows termination after the timeout');
 }
 else {const merge=events.find(e=>e.event==='merge.end');assert(merge?.merged);assert(merge.at<=complete.at);}
 const result={mode,report,actualProcessWaitMs:complete.at-entry.at,childWait:names[0],guardedMerge:child.guardedMerge};
 fs.writeFileSync(path.join(out,'verified.json'),JSON.stringify(result,null,2));console.log('PASS populated '+mode+' process wait/publication semantics');return result;
}
function native(directory,wasm){
 const root=path.resolve(__dirname,'..'),out=path.resolve(directory);fs.mkdirSync(out,{recursive:true});
 const fixtures=path.join(out,'fixtures');prepare(fixtures);
 const pins={module:{path:path.resolve(wasm),sha256:sha(wasm)},testSHA256:sha(__filename),fixtures:fs.readdirSync(fixtures).filter(n=>/\.(exe|dll|c)$/.test(n)).map(n=>({name:n,sha256:sha(path.join(fixtures,n))}))};
 fs.writeFileSync(path.join(out,'before-exec.json'),JSON.stringify(pins,null,2));
 const results=[];
 for(const [name,exe,failure,poll=false]of [['normal','parent',false],['dialog','parent-dialog',false],['visible','parent-visible',false],['failure','parent-failure',true],['poll','parent-poll',false,true]]){
  const dir=path.join(out,name);fs.mkdirSync(dir);
  const args=[process.execPath,path.join(root,'test/run.js'),'--exe='+path.join(fixtures,exe+'.exe'),'--no-build','--wasm='+path.resolve(wasm),'--exe-guest-path=C:\\order\\parent.exe','--vfs-mount='+path.join(fixtures,failure?'failure.exe':'registrar.exe')+'=C:\\order\\registrar.exe','--vfs-mount='+path.join(fixtures,'factory.dll')+'=C:\\order\\factory.dll','--dll-seed='+path.join(fixtures,'factory.dll'),'--spawn-processes','--real-ticks','--max-seconds=30','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--save-vfs='+path.join(dir,'saves')];
  fs.writeFileSync(path.join(dir,'recipe.json'),JSON.stringify({args,cwd:root,seconds:40,watchdogGrace:5,env:{WINE_COM_PROTOCOL_DIR:dir}},null,2));
  const p=cp.spawnSync('python3',['-B',path.join(root,'tools/forsaken-supervisor.py'),'outerwait',dir],{encoding:'utf8',timeout:55000});
  fs.writeFileSync(path.join(dir,'direct-wait.json'),JSON.stringify({pid:p.pid,exit:p.status,signal:p.signal,actualWait:p.status!==null,stdoutEOF:!p.error,stderrEOF:!p.error,stdout:p.stdout,stderr:p.stderr,error:p.error?.message},null,2));assert.equal(p.status,0,p.stderr||p.error?.message);
  results.push({name,...verifyNative(dir,failure,poll)});assert.equal(sha(wasm),pins.module.sha256);
 }
 fs.writeFileSync(path.join(out,'verified.json'),JSON.stringify({pins,results},null,2));console.log('PASS native parent/RegServer ordering: normal, dialog, visible, failure, poll');
}
if(require.main===module){
 if(process.argv[2]==='--prepare')prepare(path.resolve(process.argv[3]));
 else if(process.argv[2]==='--startup-host')startupHost(path.resolve(process.argv[3])).catch(e=>{console.error(e);process.exitCode=1;});
 else if(process.argv[2]==='--verify-populated')verifyPopulated(path.resolve(process.argv[3]),process.argv[4]);
 else if(process.argv[2]==='--native')native(process.argv[3],process.argv[4]);
 else throw Error('use --prepare DIRECTORY or --native DIRECTORY WASM');
}
module.exports={prepare,verifyNative,verifyPopulated,startupHost,native,source,dll};
