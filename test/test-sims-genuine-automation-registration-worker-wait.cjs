'use strict';

// New authored preparation is deliberately independent of the shared runtime.
// Importing this file never loads a game, registrar, helper or guest module.
const assert = require('node:assert/strict');

const nativePrefix = String.raw`
typedef unsigned int U;typedef int H;typedef void* P;
#define CALL __attribute__((stdcall))
#define API __declspec(dllimport) CALL
typedef struct {U a;unsigned short b,c;unsigned char d[8];} GUID;
void API ExitProcess(U);void API OutputDebugStringA(const char*);
P API CreateFileA(const char*,U,U,P,U,U,P);U API WriteFile(P,const char*,U,U*,P);
U API GetTickCount(void);void API Sleep(U);
P API LoadLibraryA(const char*);P API GetProcAddress(P,const char*);U API FreeLibrary(P);
H API CoInitialize(P);void API CoUninitialize(void);
H API CoGetClassObject(const GUID*,U,P,const GUID*,P*);
H API CoCreateInstance(const GUID*,P,U,const GUID*,P*);
H API RegOpenKeyA(P,const char*,P*);H API RegCreateKeyA(P,const char*,P*);
H API RegSetValueExA(P,const char*,U,U,const unsigned char*,U);
H API RegQueryValueExA(P,const char*,P,U*,unsigned char*,U*);H API RegCloseKey(P);
P API CreateThread(P,U,P,P,U,U*);U API WaitForSingleObject(P,U);U API GetExitCodeThread(P,U*);
U API CloseHandle(P);
U API CreateProcessA(const char*,char*,P,P,U,U,P,const char*,P,P);U API GetExitCodeProcess(P,U*);
typedef struct Unknown Unknown;
typedef struct {H(CALL*qi)(Unknown*,const GUID*,P*);U(CALL*add)(Unknown*);U(CALL*release)(Unknown*);} UV;
struct Unknown {const UV*v;};
static const GUID unknownIID={0,0,0,{0xc0,0,0,0,0,0,0,0x46}};
static const GUID factoryIID={1,0,0,{0xc0,0,0,0,0,0,0,0x46}};
static const GUID psIID={0xd5f569d0,0x593b,0x101a,{0xb5,0x69,8,0,0x2b,0x2d,0xbf,0x7a}};
static const GUID psClass={0x20424,0,0,{0xc0,0,0,0,0,0,0,0x46}};
static const GUID missingClass={0x8f21ff93,0xcabb,0x44f7,{0xa5,0x6e,0x11,0x2a,0x22,0x3f,0x41,0x67}};
#ifndef REPORT_PATH
#define REPORT_PATH "C:\\automation-public-report.txt"
#endif
static P reportFile;
void emit(const char*text){U n=0,written=0;while(text[n])n++;
 if(!reportFile){reportFile=CreateFileA(REPORT_PATH,0x40000000,1,0,2,0,0);
 if(!reportFile||reportFile==(P)0xffffffff)ExitProcess(130);}
 if(!WriteFile(reportFile,text,n,&written,0)||written!=n)ExitProcess(131);OutputDebugStringA(text);}
void report(const char*label,U value){char b[240];U n=0,i;static const char hex[]="0123456789abcdef";
 while(label[n]&&n<220){b[n]=label[n];n++;}b[n++]='=';
 for(i=0;i<8;i++)b[n++]=hex[(value>>(28-i*4))&15];b[n++]='\n';b[n]=0;emit(b);}
void reportField(const char*phase,const char*field,U value){char label[220];U n=0,i=0;
 while(phase[n]&&n<180){label[n]=phase[n];n++;}while(field[i]&&n<219)label[n++]=field[i++];label[n]=0;report(label,value);}
void check(U yes,U code){if(!yes){report("automation.assertion",code);ExitProcess(code);}}
U same(const char*a,const char*b){U i=0;while(a[i]&&a[i]==b[i])i++;return a[i]==b[i];}
void release(P p){if(p)((Unknown*)p)->v->release(p);}
`;

// Diagnostic only: writes no fixture registrations. The only registrar called
// is the export obtained from the mounted genuine system Automation module.
const registrarSource = nativePrefix + String.raw`
void classLookup(const char*label,const GUID*cls,const GUID*iid){P p=(P)0x1234;H hr;
 hr=CoGetClassObject(cls,1,0,iid,&p);report(label,hr);reportField(label,".nonnull",p!=0);
 if(hr>=0){check(p!=0,41);release(p);}else check(!p,42);}
void classRegistry(const char*phase){P key=0;U type=0,size=260;unsigned char value[260];H hr;
 hr=RegOpenKeyA((P)0x80000000,"CLSID\\{00020424-0000-0000-C000-000000000046}\\InprocServer32",&key);
 report(phase,hr);if(!hr){hr=RegQueryValueExA(key,0,0,&type,value,&size);
 reportField(phase,".query",hr);reportField(phase,".type",type);
 reportField(phase,".size",size);if(!hr&&size&&size<=260&&value[size-1]==0){
 emit(phase);emit(".value=");emit((char*)value);emit("\n");}
 check(!RegCloseKey(key),43);}}
U CALL exercise(P unused){typedef H(CALL*Register)(void);typedef H(CALL*GetClass)(const GUID*,const GUID*,P*);
 P module,p=0,q=0;Register reg;GetClass get;H hr;U began;
 check(CoInitialize(0)>=0,44);classRegistry("automation.before.open");
 classLookup("automation.before.CoGetClassObject",&psClass,&psIID);
 module=LoadLibraryA("C:\\Windows\\System\\OLEAUT32.DLL");check(module!=0,45);
 reg=(Register)GetProcAddress(module,"DllRegisterServer");get=(GetClass)GetProcAddress(module,"DllGetClassObject");
 check(reg&&get,46);report("automation.module.base",(U)module);
 report("automation.export.DllRegisterServer",(U)reg);report("automation.export.DllGetClassObject",(U)get);
 check((U)reg==(U)module+0x3d18c&&(U)get==(U)module+0x464b,57);
 began=GetTickCount();hr=reg();report("automation.DllRegisterServer",hr);
 report("automation.registrar.elapsed",GetTickCount()-began);classRegistry("automation.after.open");
 if(hr!=0){FreeLibrary(module);CoUninitialize();return 47;}
 hr=get(&psClass,&psIID,&p);report("automation.DllGetClassObject.IPSFactoryBuffer",hr);check(hr>=0&&p,48);
 hr=((Unknown*)p)->v->qi(p,&unknownIID,&q);report("automation.PS.QI.IUnknown",hr);check(hr>=0&&q,49);release(q);q=0;
 hr=((Unknown*)p)->v->qi(p,&factoryIID,&q);report("automation.PS.QI.IClassFactory",hr);
 if(hr>=0){check(q!=0,50);release(q);}else check(!q,51);release(p);
 classLookup("automation.after.CoGetClassObject",&psClass,&psIID);
 classLookup("automation.unregistered.CoGetClassObject",&missingClass,&factoryIID);
 check(FreeLibrary(module),52);CoUninitialize();emit("automation.registrar.completed\n");return 0;}
#ifndef FIXTURE_WORKER
void start(void){ExitProcess(exercise(0));}
#else
void start(void){U id=0,code=259;P thread=CreateThread(0,0,exercise,0,0,&id);check(thread&&id,53);
 check(!WaitForSingleObject(thread,0xffffffff),54);check(GetExitCodeThread(thread,&code)&&code!=259,55);
 check(CloseHandle(thread),56);report("automation.worker.exit",code);ExitProcess(code);}
#endif
`;

// Public API controls use a distinct random class namespace; none is a system
// or game CLSID, interface or registration. Use a fresh store for every run.
const registrySource = nativePrefix + String.raw`
H API RegSetValueA(P,const char*,U,const char*,U);
H API RegOpenKeyExA(P,const char*,U,U,P*);
H API RegOpenKeyW(P,const unsigned short*,P*);H API RegOpenKeyExW(P,const unsigned short*,U,U,P*);
#ifndef REGISTRY_CASE
#define REGISTRY_CASE -1
#endif
static const char leaf[]="Software\\Classes\\WARegistrarControl20261115";
void valueIs(P root,const char*sub,const char*name,const char*expected,U code){
 P key=0;U type=0,n=80;unsigned char data[80];check(!RegOpenKeyA(root,sub,&key),code);
 check(!RegQueryValueExA(key,name,0,&type,data,&n)&&type==1&&n&&n<=80&&data[n-1]==0&&same((char*)data,expected),code+1);
 check(!RegCloseKey(key),code+2);}
void start(void){P key=0,root=0;H hr;
 report("registry.case",REGISTRY_CASE);
#if REGISTRY_CASE == -1 || REGISTRY_CASE == 0
 hr=RegOpenKeyA((P)0x80000000,"WARegistrarDefinitelyAbsent20261115",&key);report("registry.missing",hr);check(hr==2,61);
#endif
#if REGISTRY_CASE == -1 || REGISTRY_CASE == 1
 hr=RegOpenKeyA((P)0x80000000,"",&root);report("registry.empty.root",hr);check(!hr&&root==(P)0x80000000,62);
#endif
#if REGISTRY_CASE == -1 || REGISTRY_CASE == 2 || REGISTRY_CASE == 3
 check(!RegCreateKeyA((P)0x80000002,leaf,&key),63);
 check(!RegSetValueExA(key,"Machine",0,1,(const unsigned char*)"machine",8),64);check(!RegCloseKey(key),65);
#endif
#if REGISTRY_CASE == -1 || REGISTRY_CASE == 2
 valueIs((P)0x80000000,"WARegistrarControl20261115","machine","machine",66);
#endif
#if REGISTRY_CASE == -1 || REGISTRY_CASE == 3
 check(!RegCreateKeyA((P)0x80000001,leaf,&key),69);
 check(!RegSetValueExA(key,"User",0,1,(const unsigned char*)"user",5),70);
 check(!RegSetValueExA(key,"Machine",0,1,(const unsigned char*)"user-priority",14),88);check(!RegCloseKey(key),71);
 valueIs((P)0x80000000,"WARegistrarControl20261115","User","user",72);
 valueIs((P)0x80000000,"WARegistrarControl20261115","machine","user-priority",89);
 check(!RegOpenKeyA((P)0x80000000,"WARegistrarControl20261115",&key),75);
 check(!RegSetValueExA(key,"Routed",0,1,(const unsigned char*)"user-write",11),76);check(!RegCloseKey(key),77);
 valueIs((P)0x80000001,leaf,"Routed","user-write",78);
#endif
#if REGISTRY_CASE == -1 || REGISTRY_CASE == 4
 check(!RegCreateKeyA((P)0x80000000,"WARegistrarNewMachine20261115",&key),81);
 check(!RegSetValueExA(key,0,0,1,(const unsigned char*)"new-machine",12),82);check(!RegCloseKey(key),83);
 valueIs((P)0x80000002,"Software\\Classes\\WARegistrarNewMachine20261115",0,"new-machine",84);
#endif
#if REGISTRY_CASE == -1 || REGISTRY_CASE == 5
 {U type=0,n=80;unsigned char data[80];
 hr=RegSetValueExA((P)0x80000001,"WARegistrarRootValue20261115",0,1,(const unsigned char*)"root-value",11);
 report("registry.predefined.write",hr);check(!hr,101);
 check(!RegQueryValueExA((P)0x80000001,"WARegistrarRootValue20261115",0,&type,data,&n)
  &&type==1&&n==11&&data[10]==0&&same((char*)data,"root-value"),102);}
#endif
#if REGISTRY_CASE == -1 || REGISTRY_CASE == 0
 hr=RegOpenKeyA((P)0x80000000,"WARegistrarStillAbsent20261115",&key);report("registry.still.missing",hr);check(hr==2,87);
#endif
#if REGISTRY_CASE == -1 || REGISTRY_CASE == 6
 check(!RegCreateKeyA((P)0x80000000,"WARegistrarHandle20261115",&key),110);
 check(!RegSetValueA(key,"",1,"first",6),111);
 check(!RegSetValueA(key,0,1,"second",7),112);
 check(!RegSetValueExA(key,"StillOwned",0,1,(const unsigned char*)"third",6),113);
 check(!RegCloseKey(key),114);
 check(RegSetValueA(key,0,1,"closed",7)==6,115);
 report("registry.empty.set.handle-retained",0);
#endif
#if REGISTRY_CASE == -1 || REGISTRY_CASE == 7
 {P legacy=0,extended=0;static const unsigned short emptyW[]={0};
 check(!RegCreateKeyA((P)0x80000000,"WARegistrarOpenLifetime20261115",&key),120);
 check(!RegOpenKeyA(key,"",&legacy)&&legacy==key,121);
 check(!RegOpenKeyExA(key,"",0,0x20019,&extended)&&extended&&extended!=key,122);
 check(!RegCloseKey(extended),123);
 check(!RegOpenKeyW(key,emptyW,&legacy)&&legacy==key,127);
 check(!RegOpenKeyExW(key,emptyW,0,0x20019,&extended)&&extended&&extended!=key,128);
 check(!RegCloseKey(extended),129);
 check(!RegSetValueA(key,0,1,"retained",9),124);
 check(!RegCloseKey(key),125);
 check(RegCloseKey(legacy)==6,126);
 report("registry.legacy-extended-lifetime",0);}
#endif
 emit("registry.public-controls.completed\n");ExitProcess(0);}
`;

// Same exact real deadline fixture must be run before and after the scheduler
// change. It deliberately does not import the prior fast-Sleep harness.
const deadlineSource = nativePrefix + String.raw`
__attribute__((naked)) H CALL checkedCreate(const GUID*clsid,P outer,U context,const GUID*iid,P*out){
 __asm__ volatile("pushl %ebx\n pushl %esi\n pushl %edi\n pushl %ebp\n"
  "movl $0x13572468,%ebx\n movl $0x24681357,%esi\n movl $0x76543210,%edi\n movl %esp,%ebp\n"
  "pushl 36(%ebp)\n pushl 32(%ebp)\n pushl 28(%ebp)\n pushl 24(%ebp)\n pushl 20(%ebp)\n"
  "calll *\"__imp__CoCreateInstance@20\"\n"
  "cmpl %esp,%ebp\n jne 1f\n cmpl $0x13572468,%ebx\n jne 1f\n"
  "cmpl $0x24681357,%esi\n jne 1f\n cmpl $0x76543210,%edi\n jne 1f\n"
  "jmp 2f\n 1: movl $0x8004fffe,%eax\n 2: movl %ebp,%esp\n popl %ebp\n popl %edi\n popl %esi\n popl %ebx\n retl $20");
}
U CALL exercise(P unused){P key=0,out=(P)0x1234;H hr;U began,elapsed;
 static const char command[]="\"C:\\Program Files\\Automation Wait Control\\unregistered.exe\"";
 check(CoInitialize(0)>=0,91);
 check(!RegCreateKeyA((P)0x80000000,"CLSID\\{8F21FF93-CABB-44F7-A56E-112A223F4167}\\LocalServer32",&key),92);
 check(!RegSetValueExA(key,0,0,1,(const unsigned char*)command,sizeof(command)),93);check(!RegCloseKey(key),94);
 emit("automation.deadline.enter\n");began=GetTickCount();
 hr=checkedCreate(&missingClass,0,4,&unknownIID,&out);elapsed=GetTickCount()-began;
 report("automation.deadline.hresult",hr);report("automation.deadline.elapsed",elapsed);
 report("automation.deadline.output",out!=0);check(hr==(H)0x80080005&&!out,95);
 check(elapsed>=60000&&elapsed<=70000,96);CoUninitialize();
 emit("automation.deadline.completed\n");return 0;}
#ifndef FIXTURE_WORKER
void start(void){ExitProcess(exercise(0));}
#else
void start(void){U id=0,code=259;P thread=CreateThread(0,0,exercise,0,0,&id);check(thread&&id,97);
 check(!WaitForSingleObject(thread,0xffffffff),98);check(GetExitCodeThread(thread,&code)&&code!=259,99);
 check(CloseHandle(thread),100);report("automation.deadline.worker.exit",code);ExitProcess(code);}
#endif
`;

const unregisteredServerSource = String.raw`#define REPORT_PATH "C:\\automation-server-report.txt"
` + nativePrefix + String.raw`
void start(void){U began=GetTickCount();emit("automation.unregistered.server.enter\n");
 while((U)(GetTickCount()-began)<65000)Sleep(5);
 report("automation.unregistered.server.elapsed",GetTickCount()-began);
 emit("automation.unregistered.server.normal-exit\n");ExitProcess(27);}
`;

// System preparation through the genuine DLL export, followed by an ordinary
// unchanged client PE. This parent contains no class/interface registry seed
// and does not register or substitute a PS class object. The child must retain
// the exact IKernel/Setup public call sequence and qualify independently.
const systemBootstrapSource = nativePrefix + String.raw`
void start(void){typedef H(CALL*Register)(void);P module;Register reg;H hr;
 static U startup[17]={68},process[4];static char command[]="C:\\automation-genuine-client.exe";U code=259;
 check(CoInitialize(0)>=0,120);
 module=LoadLibraryA("C:\\Windows\\System\\OLEAUT32.DLL");check(module!=0,121);
 reg=(Register)GetProcAddress(module,"DllRegisterServer");check(reg!=0,122);
 report("automation.system.module.base",(U)module);report("automation.system.registrar.export",(U)reg);
 check((U)reg==(U)module+0x3d18c,132);
 hr=reg();report("automation.system.DllRegisterServer",hr);check(hr==0,123);
 check(FreeLibrary(module),124);CoUninitialize();emit("automation.system.registration-returned\n");
 check(CreateProcessA(0,command,0,0,0,0,0,0,startup,process),125);
 check(CloseHandle((P)process[1]),126);check(!WaitForSingleObject((P)process[0],0xffffffff),127);
 check(GetExitCodeProcess((P)process[0],&code)&&code!=259,128);check(CloseHandle((P)process[0]),129);
 report("automation.unchanged-client.exit",code);ExitProcess(code);}
`;

// This oracle consumes explicit public report values. Synthetic controls test
// refusal behavior only; they can never authorize an original or be recorded
// as native results. Full genuine qualification also requires channel traces,
// independent native closure, unchanged client success and current input guards.
function inspectRegistrarLog(log) {
 const records = new Map();
 for (const line of String(log).split(/\r?\n/)) {
  const match = /^(automation\.[\w.]+)=([0-9a-f]{8})$/.exec(line);
  if (!match) continue;
  if (records.has(match[1])) throw new Error('ambiguous registrar report: '+match[1]);
  records.set(match[1],parseInt(match[2],16));
 }
 const required = ['automation.DllRegisterServer','automation.after.open',
  'automation.DllGetClassObject.IPSFactoryBuffer','automation.PS.QI.IUnknown',
  'automation.after.CoGetClassObject','automation.unregistered.CoGetClassObject'];
 for (const key of required) if (!records.has(key)) throw new Error('missing registrar report: '+key);
 for (const key of required.slice(0,-1)) if (records.get(key)!==0)
  throw new Error('registrar failure: '+key+'='+records.get(key).toString(16));
 const exports=['automation.module.base','automation.export.DllRegisterServer','automation.export.DllGetClassObject'];
 for(const key of exports)if(!records.has(key))throw new Error('missing genuine export report: '+key);
 const base=records.get(exports[0]);
 if(base<0x10000||base>0xffffffff-0x92000||records.get(exports[1])!==base+0x3d18c||records.get(exports[2])!==base+0x464b)
  throw new Error('genuine export RVA mismatch');
 if (records.get(required.at(-1))!==0x80040154) throw new Error('missing-class error was not preserved');
 if (!String(log).split(/\r?\n/).includes('automation.registrar.completed')) throw new Error('registrar did not complete');
 return {registrarObserved:true,genuineActivationQualified:false,originalAuthorized:false};
}

function inspectDeadline({log,worker,wallMs,exit,actualWait,stdoutEOF,stderrEOF}) {
 if(!actualWait||!stdoutEOF||!stderrEOF)throw new Error('missing actual wait/both EOF');
 if(exit!==0)throw new Error('deadline process did not exit normally');
 if(!Number.isFinite(wallMs)||wallMs<60000||wallMs>95000)throw new Error('not a full real walltime deadline');
 const read=label=>{
  const values=String(log).split(/\r?\n/).filter(line=>line.startsWith(label+'='));
  if(values.length!==1||!new RegExp('^'+label.replaceAll('.','\\.')+'=[0-9a-f]{8}$').test(values[0]))
   throw new Error('missing or ambiguous deadline report: '+label);
  return parseInt(values[0].slice(label.length+1),16);
 };
 if(read('automation.deadline.hresult')!==0x80080005||read('automation.deadline.output')!==0)
  throw new Error('normal COM failure was not returned');
 const elapsed=read('automation.deadline.elapsed');
 if(elapsed<60000||elapsed>70000)throw new Error('guest did not wait full real deadline');
 if(worker&&read('automation.deadline.worker.exit')!==0)throw new Error('Worker did not return normally');
 if(!String(log).split(/\r?\n/).includes('automation.deadline.completed'))throw new Error('abandoned activation frame');
 return {worker:!!worker,elapsed,wallMs,deadlineObserved:true,genuineActivationQualified:false,originalAuthorized:false};
}

function prepare(directory) {
 const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
 const out=path.resolve(directory);fs.mkdirSync(out,{recursive:true});let serial=0;
 const put=(name,bytes)=>fs.writeFileSync(path.join(out,name),bytes,{flag:'wx'});
 const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 const run=(command,args)=>{
  const result=cp.spawnSync(command,args,{encoding:'utf8',timeout:30000}),name='tool-'+ ++serial;
  put(name+'.stdout.log',result.stdout||'');put(name+'.stderr.log',result.stderr||'');
  put(name+'-wait.json',JSON.stringify({argv:[command,...args],pid:result.pid,exit:result.status,
   signal:result.signal,actualWait:result.status!==null,stdoutEOF:!result.error,stderrEOF:!result.error,
   error:result.error?String(result.error):null})+'\n');
  if(result.error||result.status!==0)throw new Error('native preparation failed: '+command+': '+(result.stderr||result.error));
 };
 const libraries={
  kernel32:['ExitProcess@4','OutputDebugStringA@4','GetTickCount@0','Sleep@4','LoadLibraryA@4',
   'GetProcAddress@8','FreeLibrary@4','CreateThread@24','WaitForSingleObject@8','GetExitCodeThread@8','CloseHandle@4',
   'CreateProcessA@40','GetExitCodeProcess@8','CreateFileA@28','WriteFile@20'],
  ole32:['CoInitialize@4','CoUninitialize@0','CoGetClassObject@20','CoCreateInstance@20'],
  advapi32:['RegOpenKeyA@12','RegCreateKeyA@12','RegSetValueExA@24','RegSetValueA@20','RegOpenKeyExA@20','RegOpenKeyW@12','RegOpenKeyExW@20','RegQueryValueExA@24','RegCloseKey@4'],
 };
 for(const [dll,names] of Object.entries(libraries)) {
  put(dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');
  run('llvm-dlltool',['-m','i386','-k','-d',path.join(out,dll+'.def'),'-l',path.join(out,dll+'.lib')]);
 }
 const inputs=[];
 for(const [name,source,flags] of [
  ['automation-registrar-client',registrarSource,[]],['automation-registrar-client-worker',registrarSource,['-DFIXTURE_WORKER=1']],
  ['automation-registry-client',registrySource,[]],['automation-deadline-client',deadlineSource,[]],
  ...['missing','empty-root','machine-alias','user-view','new-machine','predefined-root','retained-handle','open-lifetime'].map((label,index)=>
   ['automation-registry-'+label,registrySource,['-DREGISTRY_CASE='+index]]),
  ['automation-deadline-client-worker',deadlineSource,['-DFIXTURE_WORKER=1']],['automation-unregistered-server',unregisteredServerSource,[]],
  ['automation-system-bootstrap-client',systemBootstrapSource,[]],
 ]) {
  put(name+'.c',source);
  run('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-mno-stack-arg-probe','-fno-builtin',
   '-O1',...flags,'-c',path.join(out,name+'.c'),'-o',path.join(out,name+'.obj')]);
  run('ld',['-mi386pe','--entry','_start','--subsystem','console','--disable-dynamicbase','--no-insert-timestamp',
   '-o',path.join(out,name+'.exe'),path.join(out,name+'.obj'),...Object.keys(libraries).map(dll=>path.join(out,dll+'.lib'))]);
  inputs.push({name,path:path.join(out,name+'.exe'),sha256:sha(fs.readFileSync(path.join(out,name+'.exe'))),
   sourceSHA256:sha(Buffer.from(source)),flags});
 }
 put('prepared.json',JSON.stringify({inputs,nativeExecution:false},null,2)+'\n');return inputs;
}

function authoredTests() {
 const {test}=require('node:test');
 const labels=['automation.DllRegisterServer','automation.after.open',
  'automation.DllGetClassObject.IPSFactoryBuffer','automation.PS.QI.IUnknown',
  'automation.after.CoGetClassObject','automation.unregistered.CoGetClassObject'];
 const lines=labels.map((label,i)=>label+'='+(i===labels.length-1?'80040154':'00000000'));
 const exportLines=['automation.module.base=65340000','automation.export.DllRegisterServer=6537d18c',
  'automation.export.DllGetClassObject=6534464b'];
 const valid=lines.concat(exportLines,'automation.registrar.completed').join('\n');
 test('synthetic oracle control never grants genuine activation or original',()=>{
  assert.deepEqual(inspectRegistrarLog(valid),{registrarObserved:true,genuineActivationQualified:false,originalAuthorized:false});
 });
 for(const label of labels) {
  test('missing report refuses: '+label,()=>assert.throws(()=>inspectRegistrarLog(valid.split('\n').filter(l=>!l.startsWith(label+'=')).join('\n')),/missing registrar/));
  test('duplicate report refuses: '+label,()=>assert.throws(()=>inspectRegistrarLog(valid+'\n'+label+'=00000000'),/ambiguous registrar/));
 }
 for(const label of labels.slice(0,-1)) test('failure remains visible: '+label,()=>{
  assert.throws(()=>inspectRegistrarLog(valid.replace(label+'=00000000',label+'=80004005')),/registrar failure/);
 });
 for(const label of labels.slice(0,-1)) test('non-S_OK result refuses: '+label,()=>{
  assert.throws(()=>inspectRegistrarLog(valid.replace(label+'=00000000',label+'=00000001')),/registrar failure/);
 });
 for(const line of exportLines)test('missing genuine export report refuses: '+line.split('=')[0],()=>{
  assert.throws(()=>inspectRegistrarLog(valid.split('\n').filter(value=>value!==line).join('\n')),/missing genuine export/);
 });
 for(const [before,after] of [['6537d18c','caca0010'],['6534464b','caca0010'],['65340000','fffffff0']])
  test('substitute or invalid export address refuses: '+before,()=>{
   assert.throws(()=>inspectRegistrarLog(valid.replace(before,after)),/genuine export RVA mismatch/);
  });
 test('fabricated absent-class success refuses',()=>assert.throws(()=>inspectRegistrarLog(valid.replace('80040154','00000000')),/missing-class/));
 test('unreturned registrar refuses',()=>assert.throws(()=>inspectRegistrarLog(lines.concat(exportLines).join('\n')),/did not complete/));
 const deadline={log:'automation.deadline.hresult=80080005\nautomation.deadline.output=00000000\nautomation.deadline.elapsed=0000ea60\nautomation.deadline.worker.exit=00000000\nautomation.deadline.completed\n',
  worker:true,wallMs:65000,exit:0,actualWait:true,stdoutEOF:true,stderrEOF:true};
 test('synthetic full Worker deadline oracle control grants no genuine qualification',()=>{
  assert.equal(inspectDeadline(deadline).deadlineObserved,true);assert.equal(inspectDeadline(deadline).originalAuthorized,false);
 });
 for(const field of ['actualWait','stdoutEOF','stderrEOF'])test('deadline refuses missing closure '+field,()=>{
  assert.throws(()=>inspectDeadline({...deadline,[field]:false}),/actual wait/);
 });
 for(const exit of [undefined,null,1])test('deadline refuses non-normal process exit '+exit,()=>{
  assert.throws(()=>inspectDeadline({...deadline,exit}),/exit normally/);
 });
 for(const wallMs of [0,59999,95001,NaN])test('deadline refuses independent wall duration '+wallMs,()=>{
  assert.throws(()=>inspectDeadline({...deadline,wallMs}),/walltime/);
 });
 for(const [before,after] of [['0000ea60','00000001'],['80080005','8004fffe'],
  ['automation.deadline.worker.exit=00000000','automation.deadline.worker.exit=00000001'],
  ['automation.deadline.completed','activation abandoned']])test('deadline refuses '+after,()=>{
  assert.throws(()=>inspectDeadline({...deadline,log:deadline.log.replace(before,after)}));
 });
}

// Import the real adapter only after its source/build/runtime turn is released.
// These deterministic driver controls cover ownership, not native COM success.
function runtimeTests() {
 const {test}=require('node:test');
 const {ComInterfaceRuntime}=require('../lib/com-interface-runtime');
 const {HResult}=require('../lib/com-standard-marshaler');
 function fixture({scheduled=true,pause=false,failure=false}={}) {
  const words=new Map(),registers={eax:7,ecx:8,edx:9,ebx:10,esp:512,ebp:11,esi:12,edi:13};
  let thread=2,generation=1n,token=55n,epoch=1n,retired=false,reason=23,eip=4096,handler=1,yieldFlag=1,thunk=4096,fs=256,begins=0,advances=0,wholeCalls=0,drains=0;
  words.set(256,0x741234);
  const args=[1000,0,4,1100,1200];[0x401000,...args].forEach((v,i)=>words.set(512+i*4,v));
  let releaseStep;const stepGate=pause?new Promise(resolve=>{releaseStep=resolve;}):null;
  const e={get_current_thread_id:()=>thread,com_owner_epoch:()=>epoch,com_owner_root:()=>generation,com_owner_token:()=>token,
   get_yield_reason:()=>reason,get_eip:()=>eip,get_fs_base:()=>fs,
   get_handler_set_eip:()=>handler,get_yield_flag:()=>yieldFlag,com_callback_get_thunk:()=>thunk,
   set_yield_state:(value)=>{reason=value;},set_handler_set_eip:value=>{handler=value;}};
  for(const name of Object.keys(registers))e['get_'+name]=()=>registers[name];
  const runtime=new ComInterfaceRuntime({getExports:()=>e,getMemory:()=>memory,desktop:null,
   serviceYield:async()=>false,isRetired:()=>retired,scheduledActivation:scheduled,
   modulePin:'11'.repeat(32),sourcePin:'22'.repeat(32)});
  const memory=new ArrayBuffer(4096),c={frames:[],word:address=>words.get(address)||0,
   check:expected=>{if(retired)throw new Error('owner retired');
    if(expected!==undefined&&expected!==token)throw new Error('owner token replaced');}};
  runtime.runtime={c,m:{guid:address=>'guid-'+address+':'+[0,4,8,12].map(n=>words.get(address+n)||0).join(':'),drain:async()=>{drains++;}},proxy:{},localServer:{
   drain:async()=>{drains++;},
   async *activationSteps(){begins++;advances++;if(stepGate)await stepGate;if(failure)throw new HResult(0x80080005);yield;advances++;return 0x80080005;},
   async activate(){wholeCalls++;return 0x80080005;},
  }};
  runtime.enqueue(17,512,2);
  return {runtime,e,c,args,registers,words,stats:()=>({begins,advances,wholeCalls,reason,handler}),
   retire:()=>{retired=true;},replaceGeneration:()=>{generation++;},replaceEpoch:()=>{epoch++;},
   replaceThread:()=>{thread++;},restoreThread:()=>{thread=2;},replaceToken:()=>{token++;},replaceEip:()=>{eip++;},replaceHandler:()=>{handler++;},
   replaceYieldFlag:()=>{yieldFlag++;},replaceThunk:()=>{thunk++;},replaceFs:()=>{fs+=4;},releaseStep:()=>releaseStep(),drains:()=>drains};
 }
 test('scheduled root keeps one task, frame and ticket across owning advances',async()=>{
  const f=fixture(),before={...f.registers};assert.equal(await f.runtime.service(),false);
  assert.deepEqual(f.stats(),{begins:1,advances:1,wholeCalls:0,reason:23,handler:1});
  assert.deepEqual(f.registers,before);assert.equal(f.runtime.pending.size,1);
  assert.equal(await f.runtime.service(),true);assert.equal(f.runtime.result(512,2),0x80080005);
  assert.deepEqual(f.stats(),{begins:1,advances:2,wholeCalls:0,reason:0,handler:0});
  assert.deepEqual(f.registers,before);assert.equal(f.runtime.pending.size,0);
 });
 test('main service retains whole-operation path',async()=>{
  const f=fixture({scheduled:false});assert.equal(await f.runtime.service(),true);
  assert.equal(f.runtime.result(512,2),0x80080005);
  assert.deepEqual(f.stats(),{begins:0,advances:0,wholeCalls:1,reason:0,handler:0});
 });
 test('same-frame concurrent service refuses without advancing or replacing task',async()=>{
  const f=fixture(),pending=f.runtime.service();await assert.rejects(f.runtime.service(),/concurrent service/);
  assert.equal(await pending,false);assert.equal(f.stats().begins,1);assert.equal(f.stats().advances,1);
 });
 for(const [name,mutate] of [
  ['return address',f=>f.words.set(512,0x9999)],['activation argument',f=>f.words.set(516,1024)],
  ['callee-saved register',f=>{f.registers.edi++;}],['caller-saved register',f=>{f.registers.eax++;}],
  ['instruction pointer',f=>f.replaceEip()],['CLSID contents',f=>f.words.set(1000,77)],
  ['IID contents',f=>f.words.set(1100,88)],
 ])test('parked '+name+' replacement refuses before next advance',async()=>{
  const f=fixture();assert.equal(await f.runtime.service(),false);mutate(f);
  await assert.rejects(f.runtime.service(),/activation frame changed/);
  assert.deepEqual(f.stats(),{begins:1,advances:1,wholeCalls:0,reason:23,handler:1});
 });
 for(const [name,mutate] of [['handler flag',f=>f.replaceHandler()],['yield flag',f=>f.replaceYieldFlag()],
  ['current thunk',f=>f.replaceThunk()],['FS base',f=>f.replaceFs()],['SEH head',f=>f.words.set(256,0x9999)]])
  test('parked '+name+' replacement refuses without restoration',async()=>{
   const f=fixture();assert.equal(await f.runtime.service(),false);mutate(f);const before=f.stats();
   await assert.rejects(f.runtime.service(),/activation frame changed/);assert.deepEqual(f.stats(),before);
  });
 for(const [name,mutate] of [['retirement',f=>f.retire()],['generation',f=>f.replaceGeneration()],
  ['process epoch',f=>f.replaceEpoch()],['exact invocation token',f=>f.replaceToken()]])
  test(name+' refuses before advancing or restoring abandoned frame',async()=>{
   const f=fixture();assert.equal(await f.runtime.service(),false);mutate(f);
   await assert.rejects(f.runtime.service());assert.equal(f.stats().advances,1);
   assert.equal(f.stats().wholeCalls,0);assert.equal(f.stats().reason,23);assert.equal(f.stats().handler,1);
  });
 for(const [name,mutate,restore] of [['thread',f=>f.replaceThread(),f=>f.restoreThread()],
  ['ESP',f=>{f.registers.esp+=4;},f=>{f.registers.esp=512;}]])
  test('wrong '+name+' cannot return and replay the abandoned task',async()=>{
   const f=fixture();assert.equal(await f.runtime.service(),false);mutate(f);
   await assert.rejects(f.runtime.service(),/no longer owns/);restore(f);
   await assert.rejects(f.runtime.service(),/no longer owns/);assert.equal(f.stats().advances,1);
  });
 test('a child appearing at a parked root cannot restart whole activation',async()=>{
  const f=fixture();assert.equal(await f.runtime.service(),false);f.c.frames.push({token:999n});
  await assert.rejects(f.runtime.service(),/child frame/);assert.equal(f.stats().wholeCalls,0);
  assert.equal(f.stats().begins,1);assert.equal(f.stats().advances,1);
 });
 test('valid parked drain preserves the task and allows one later owning advance',async()=>{
  const f=fixture();assert.equal(await f.runtime.service(),false);await f.runtime.drain();
  assert.equal(f.drains(),2);assert.equal(f.stats().advances,1);assert.equal(f.stats().begins,1);
  assert.equal(await f.runtime.service(),true);assert.equal(f.runtime.result(512,2),0x80080005);
 });
 for(const [name,mutate] of [['frame replacement',f=>{f.registers.edi++;}],['token replacement',f=>f.replaceToken()]])
  test(name+' refuses before a parked drain can execute guest callbacks',async()=>{
   const f=fixture();assert.equal(await f.runtime.service(),false);mutate(f);
   await assert.rejects(f.runtime.drain());assert.equal(f.drains(),0);assert.equal(f.stats().advances,1);
  });
 test('concurrent drain cannot execute callbacks while a task is advancing',async()=>{
  const f=fixture({pause:true}),pending=f.runtime.service();await Promise.resolve();
  await assert.rejects(f.runtime.drain(),/concurrent/);assert.equal(f.drains(),0);
  f.releaseStep();assert.equal(await pending,false);assert.equal(f.stats().advances,1);
 });
 for(const [name,mutate] of [['retirement',f=>f.retire()],['token replacement',f=>f.replaceToken()]])
  test(name+' during an awaited advance cannot complete or restore the frame',async()=>{
   const f=fixture({pause:true}),before={...f.registers},pending=f.runtime.service();
   await Promise.resolve();assert.equal(f.stats().advances,1);mutate(f);f.releaseStep();
   await assert.rejects(pending);assert.deepEqual(f.registers,before);
   assert.equal(f.stats().reason,23);assert.equal(f.stats().handler,1);
   assert.equal(f.stats().advances,1);assert.equal(f.stats().wholeCalls,0);
   assert.equal(f.runtime.pending.get('2:512').complete,false);
  });
 test('valid COM HRESULT exception completes the owning original frame',async()=>{
  const f=fixture({failure:true});assert.equal(await f.runtime.service(),true);
  assert.equal(f.runtime.result(512,2),0x80080005);assert.equal(f.stats().reason,0);
 });
 test('a COM HRESULT exception cannot bypass validation after an awaited advance',async()=>{
  const f=fixture({pause:true,failure:true}),pending=f.runtime.service();await Promise.resolve();
  f.registers.edi++;const before={...f.registers};f.releaseStep();await assert.rejects(pending,/activation frame changed/);
  assert.deepEqual(f.registers,before);assert.equal(f.runtime.pending.get('2:512').complete,false);
  assert.equal(f.stats().reason,23);assert.equal(f.stats().handler,1);
 });
 test('putting a changed frame back cannot replay the abandoned task',async()=>{
  const f=fixture();assert.equal(await f.runtime.service(),false);const saved=f.registers.edi;f.registers.edi++;
  await assert.rejects(f.runtime.service(),/activation frame changed/);f.registers.edi=saved;
  await assert.rejects(f.runtime.service(),/no longer owns/);assert.equal(f.stats().advances,1);
  assert.throws(()=>f.runtime.enqueue(17,512,2),/stale frame/);
 });
}

function registryTests() {
 const {test}=require('node:test');
 const {createStorageImports,setRegValue,clearStore,exportStore,importStore}=require('../lib/storage');
 const CR=0x80000000,CU=0x80000001,LM=0x80000002,leaf='WARegistrarHostControl20261115';
 function fixture(){
  clearStore();const memory=new ArrayBuffer(65536),bytes=new Uint8Array(memory),view=new DataView(memory);let cursor=128;
  const alloc=n=>{const at=cursor;cursor=(cursor+n+3)&~3;assert.ok(cursor<memory.byteLength);return at;};
  const string=s=>{const at=alloc(Buffer.byteLength(s,'latin1')+1);bytes.set(Buffer.from(s+'\0','latin1'),at);return at;};
  const h=createStorageImports({getMemory:()=>memory,processDesktop:{call:()=>false}});
  const open=(root,path)=>h.reg_open_key(root,string(path),0)>>>0;
  const create=(root,path)=>{const out=alloc(4);assert.equal(h.reg_create_key(root,string(path),out,0,0),0);return view.getUint32(out,true);};
  const set=(key,name,value)=>h.reg_set_value(key,name===null?0:string(name),1,string(value),value.length+1,0);
  const query=(key,name)=>{const type=alloc(4),size=alloc(4),data=alloc(260);view.setUint32(size,260,true);
   const error=h.reg_query_value(key,name===null?0:string(name),type,data,size,0);
   return {error,value:error?null:Buffer.from(bytes.subarray(data,data+view.getUint32(size,true)-1)).toString('latin1')};};
  return {h,open,create,set,query,memory,bytes,view,alloc,string,value:setRegValue};
 }
 test('system Interface namespace exists while arbitrary missing keys still fail',()=>{
  const f=fixture();assert.notEqual(f.open(CR,'Interface'),0);assert.equal(f.open(CR,leaf+'Missing'),0);
 });
 test('backend extended empty opens preserve roots and allocate independent child handles',()=>{
  const f=fixture();assert.equal(f.open(CR,''),CR);const key=f.create(CU,leaf),child=f.open(key,'');assert.notEqual(child,0);assert.notEqual(child,key);
  assert.equal(f.h.reg_close_key(child),0);assert.equal(f.set(key,'StillOwned','yes'),0);
 });
 test('predefined roots support ordinary case-insensitive value writes',()=>{
  const f=fixture();assert.equal(f.set(CU,leaf,'value'),0);assert.deepEqual(f.query(CU,leaf.toLowerCase()),{error:0,value:'value'});
 });
 test('machine Classes values are visible through the HKCR alias',()=>{
  const f=fixture(),machine=f.create(LM,'Software\\Classes\\'+leaf);
  assert.equal(f.set(machine,'MiXeD','machine'),0);const alias=f.open(CR,leaf.toLowerCase());assert.notEqual(alias,0);
  assert.deepEqual(f.query(alias,'mixed'),{error:0,value:'machine'});
 });
 test('new HKCR keys are visible in the machine Classes store',()=>{
  const f=fixture(),key=f.create(CR,leaf);assert.equal(f.set(key,null,'created'),0);
  const machine=f.open(LM,'Software\\Classes\\'+leaf);assert.notEqual(machine,0);
  assert.deepEqual(f.query(machine,null),{error:0,value:'created'});
 });
 test('user precedence and HKCR value writes preserve the independent machine value',()=>{
  const f=fixture(),path='Software\\Classes\\'+leaf,machine=f.create(LM,path),user=f.create(CU,path);
  assert.equal(f.set(machine,'Choice','machine'),0);assert.equal(f.set(user,'Choice','user'),0);
  const alias=f.open(CR,leaf);assert.notEqual(alias,0);assert.deepEqual(f.query(alias,'Choice'),{error:0,value:'user'});
  assert.equal(f.set(alias,'Routed','user-write'),0);assert.deepEqual(f.query(user,'Routed'),{error:0,value:'user-write'});
  assert.deepEqual(f.query(machine,'Choice'),{error:0,value:'machine'});assert.equal(f.query(machine,'Routed').error,2);
 });
 test('Classes enumeration reports the same alias once regardless of spelling',()=>{
  const f=fixture();f.create(LM,'Software\\Classes\\'+leaf);f.create(CU,'Software\\Classes\\'+leaf.toLowerCase());
  const names=[],out=f.alloc(260);
  for(let i=0;i<1000;i++){
   const error=f.h.reg_enum_key(CR,i,out,260,0);if(error===259)break;assert.equal(error,0);
   const end=f.bytes.indexOf(0,out);names.push(Buffer.from(f.bytes.subarray(out,end)).toString('latin1'));
  }
  assert.equal(names.filter(name=>name.toLowerCase()===leaf.toLowerCase()).length,1);
 });
 test('deleting a machine alias removes the key from both public views',()=>{
  const f=fixture();f.create(LM,'Software\\Classes\\'+leaf);
  assert.notEqual(f.open(CR,leaf),0);
  assert.equal(f.h.reg_delete_key(LM,f.string('Software\\Classes\\'+leaf),0),0);
  assert.equal(f.open(CR,leaf),0);assert.equal(f.open(LM,'Software\\Classes\\'+leaf),0);
 });
 test('duplicate ordinary user key shadows a machine-only value without copying it',()=>{
  const f=fixture(),path='Software\\Classes\\'+leaf,machine=f.create(LM,path),user=f.create(CU,path);
  assert.equal(f.set(machine,'MachineOnly','machine'),0);assert.equal(f.set(user,'UserOnly','user'),0);
  const alias=f.open(CR,leaf);assert.equal(f.query(alias,'MachineOnly').error,2);
  assert.deepEqual(f.query(alias,'UserOnly'),{error:0,value:'user'});
  assert.deepEqual(f.query(machine,'MachineOnly'),{error:0,value:'machine'});
 });
 test('Classes namespace merges independent class children and shadows duplicate user classes',()=>{
  const f=fixture(),base='Software\\Classes\\CLSID\\'+leaf;
  const machine=f.create(LM,base+'\\InprocServer32'),user=f.create(CU,base+'\\LocalServer32');
  assert.equal(f.set(machine,null,'machine.dll'),0);assert.equal(f.set(user,null,'user.exe'),0);
  assert.equal(f.open(CR,'CLSID\\'+leaf+'\\InprocServer32'),0);
  assert.notEqual(f.open(CR,'CLSID\\'+leaf+'\\LocalServer32'),0);
  f.create(LM,'Software\\Classes\\CLSID\\'+leaf+'Independent');
  assert.notEqual(f.open(CR,'CLSID\\'+leaf+'Independent'),0);
 });
 test('creating an already inferred parent preserves its descendant and reports existing',()=>{
  const f=fixture();f.value('HKCR\\'+leaf+'\\Child','',1,'child');
  const out=f.alloc(4),disposition=f.alloc(4);
  assert.equal(f.h.reg_create_key(CR,f.string(leaf),out,0,disposition),0);
  assert.equal(f.view.getUint32(disposition,true),2);
  assert.deepEqual(f.query(f.open(CR,leaf+'\\Child'),null),{error:0,value:'child'});
 });
 test('legacy machine Classes snapshots import into the same public and COM registry view',()=>{
  const f=fixture();assert.equal(importStore({['reg:HKLM\\Software\\Classes\\'+leaf]:JSON.stringify({values:{'':{type:1,data:'imported'}}})}),1);
  assert.deepEqual(f.query(f.open(CR,leaf),null),{error:0,value:'imported'});
  const saved=exportStore();clearStore();importStore(saved);
  assert.deepEqual(f.query(f.open(LM,'Software\\Classes\\'+leaf),null),{error:0,value:'imported'});
 });
 test('query-info and enumeration count the same case-insensitive Classes children',()=>{
  const f=fixture(),path='Software\\Classes\\'+leaf;
  f.create(LM,path+'\\One');f.create(CU,path+'\\oNe');f.create(CU,path+'\\Two');
  const key=f.open(CR,leaf),count=f.alloc(4),max=f.alloc(4);
  assert.equal(f.h.reg_query_info(key,count,max,0,0,0,0),0);
  assert.equal(f.view.getUint32(count,true),2);assert.equal(f.view.getUint32(max,true),3);
 });
 test('COM LocalServer32 metadata reads the same machine Classes alias',()=>{
  const f=fixture(),clsid='{72a962d1-7729-4ae9-8925-195e4636a261}';
  f.bytes.set(Buffer.from('d162a9722977e94a8925195e4636a261','hex'),32);
  f.value('HKLM\\Software\\Classes\\CLSID\\'+clsid+'\\LocalServer32','',1,'server.exe');
  const out=f.alloc(1000),n=f.h.com_localserver_information(32,4,out,1000);
  assert.ok(n>1&&n<1000);assert.equal(Buffer.from(f.bytes.subarray(out,out+n)).toString('latin1'),'server.exe -Embedding\0');
 });
 test('CoGetPSClsid metadata reads a public machine Classes IID registration',()=>{
  const f=fixture(),id='{72a962d1-7729-4ae9-8925-195e4636a261}',wire=Buffer.from('d162a9722977e94a8925195e4636a261','hex');
  f.bytes.set(wire,32);f.value('HKLM\\Software\\Classes\\Interface\\'+id+'\\ProxyStubClsid32','',1,id);
  const out=f.alloc(16);assert.equal(f.h.com_proxy_stub(0,32,out),0);
  assert.deepEqual(Buffer.from(f.bytes.subarray(out,out+16)),wire);
 });
}

function deadlineStateTests() {
 const {test}=require('node:test');const {OwnedComActivation}=require('../lib/com-owned-activation');
 function fixture(){
  let now=0,advanceOnLive=false;
  const owner={},session={owner};
  const authority={owner(s,o){assert.equal(s,session);assert.equal(o,owner);if(advanceOnLive)now=100;return owner;}};
  const a=new OwnedComActivation(authority,{now:()=>now,timeout:100});
  const request={clsid:'12'.repeat(16),iid:'34'.repeat(16),context:4,kind:'create',command:'ordinary.exe -Embedding'};
  const first=a.begin(session,owner,request),row=a.jobs.get(first.ticket);
  return {a,session,owner,request,first,row,set:n=>now=n,advance:()=>advanceOnLive=true};
 }
 test('crossing the deadline after poll admission cannot launch another child',()=>{
  const f=fixture();let calls=0;f.a.now=()=>++calls<3?99:100;
  assert.deepEqual(f.a.poll(f.session,f.owner,f.first.ticket),{hresult:0x80080005,reference:null});
  assert.equal(f.a.launches.get(f.request.clsid).id,f.first.launch);assert.equal(f.a.jobs.size,0);
 });
 test('claim expiry and admission use one observation despite time advancing during owner validation',()=>{
  const f=fixture();f.set(99);f.advance();assert.equal(f.a.claimLaunch(f.row),null);
  assert.equal(f.a.launches.get(f.request.clsid).id,f.first.launch);
 });
 test('an expired prior claim may still be replaced for a distinct legal new activation',()=>{
  const f=fixture();f.set(100);const next=f.a.begin(f.session,f.owner,f.request);
  assert(next.launch);assert.notEqual(next.launch,f.first.launch);assert.equal(f.a.jobs.get(next.ticket).deadline,200);
 });
}

module.exports={nativePrefix,registrarSource,registrySource,deadlineSource,unregisteredServerSource,systemBootstrapSource,inspectRegistrarLog,inspectDeadline,prepare};
if(require.main===module) {
 if(process.argv[2]==='--authored')authoredTests();
 else if(process.argv[2]==='--runtime')runtimeTests();
 else if(process.argv[2]==='--registry-tests')registryTests();
 else if(process.argv[2]==='--deadline-state')deadlineStateTests();
 else if(process.argv[2]==='--prepare'&&process.argv[3])process.stdout.write(JSON.stringify(prepare(process.argv[3]))+'\n');
 else throw new Error('Use --authored for independent oracle controls; native preparation/execution requires the released runtime turn');
}
