'use strict';
// LIGHT retained-evidence checks only: no emulator, PE, shared helper or build.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { test } = require('node:test');
const prior = path.resolve(__dirname, '../scratch/runs/20261115-sims-inherited-readonly-media-child-context');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// A run-specific preload for the next permitted bootstrap fixture. It only
// observes exported host operations; no guest memory, return substitution,
// forced completion, timers or keepalive handles. Existing source/map hooks
// must precede it. In particular beforeExit can expose an abandoned await.
const observerSource = String.raw`'use strict';
const Module = require('node:module');
const {threadId} = require('node:worker_threads');
const original = Module._load, wrapped = new WeakSet(), pending = new Map();
let sequence = 0;
const emit = record => process.stderr.write('[bootstrap-boundary] ' + JSON.stringify({
  pid:process.pid, threadId, monotonicNs:process.hrtime.bigint().toString(), ...record}) + '\n');
if (typeof process.send === 'function') {
  const send = process.send;
  process.send = function(message,...args) {
    if (message?.t === 'process-input-ready' || message?.t === 'child-exit')
      emit({event:'ipc-send-attempt',type:message.t,code:message.code});
    return Reflect.apply(send,this,[message,...args]);
  };
}
const wrap = (target, name, label) => {
  if (!target || typeof target[name] !== 'function' || wrapped.has(target[name])) return;
  const fn = target[name];
  const observed = function(...args) {
    const id = ++sequence;
    pending.set(id, label); emit({event:'begin',id,operation:label});
    const end = event => { pending.delete(id); emit({event,id,operation:label}); };
    let result;
    try { result = Reflect.apply(fn,this,args); }
    catch (error) { end('throw'); throw error; }
    if (result && typeof result.then === 'function')
      return result.then(value=>{end('resolved');return value;},error=>{end('rejected');throw error;});
    end('returned'); return result;
  };
  wrapped.add(observed); target[name] = observed;
};
Module._load = function(request,parent,isMain) {
  const value = Reflect.apply(original,this,arguments);
  let file; try { file = Module._resolveFilename(request,parent); } catch (_) { return value; }
  if (typeof file !== 'string') return value;
  if (file.endsWith('/lib/guest-thread-host.js'))
    wrap(value.GuestThreadHost?.prototype,'loadDlls','guest-thread-host.js:loadDlls');
  const list = file.endsWith('/lib/readonly-media-context.js') ? ['restore']
    : file.endsWith('/lib/media-cli.js') ? ['analyzeMediaPaths']
    : file.endsWith('/lib/dll-loader.js') ? ['loadDllsAsync','callDllMainAsync']
    : file.endsWith('/lib/vfs-export.js') ? ['saveCompletedChildState','mergeCompletedChildState'] : [];
  for (const name of list) wrap(value,name,file.split('/').at(-1)+':'+name);
  return value;
};
process.on('beforeExit',code=>emit({event:'beforeExit',code,pending:[...pending.values()]}));
process.once('exit',code=>emit({event:'exit',code,pending:[...pending.values()]}));
emit({event:'observer-ready'});
`;

// Authored parent fixture, never the Nova Setup executable. The engine and
// real D media are mounted from their existing pinned paths by the recipe.
// No registry import, class seeding or substitution of the engine is involved.
const registrationProbeSource = String.raw`
typedef unsigned long U; typedef void *P;
#define API __declspec(dllimport) __stdcall
void API ExitProcess(U); U API SetCurrentDirectoryA(const char*);
U API GetCurrentDirectoryA(U,char*); U API CreateProcessA(const char*,char*,P,P,U,U,P,P,P,P);
U API WaitForSingleObject(P,U); U API GetExitCodeProcess(P,U*); U API CloseHandle(P);
U API RegOpenKeyA(P,const char*,P*); U API RegQueryValueA(P,const char*,char*,long*); U API RegCloseKey(P);
int fold(int c){return c>=65&&c<=90?c+32:c;}
int same(const char*a,const char*b){while(*a&&fold(*a)==fold(*b)){a++;b++;}return fold(*a)==fold(*b);}
void start(void) {
  static U startup[17]={68}, process[4];
  U code=259; P key=0; long size=128;
  char cwd[128], target[128];
  static char command[]="\"C:\\Program Files\\Common Files\\InstallShield\\Engine\\6\\Intel 32\\IKernel.exe\" -RegServer";
  if(!SetCurrentDirectoryA("D:\\Setup"))ExitProcess(40);
  if(!GetCurrentDirectoryA(128,cwd)||!same(cwd,"d:\\setup"))ExitProcess(41);
  if(!CreateProcessA(0,command,0,0,0,0,0,0,startup,process))ExitProcess(42);
  if(WaitForSingleObject((P)process[0],10000)!=0)ExitProcess(43);
  if(!GetExitCodeProcess((P)process[0],&code)||code)ExitProcess(44);
  CloseHandle((P)process[0]);CloseHandle((P)process[1]);
  if(RegOpenKeyA((P)0x80000000,"CLSID\\{91814EC0-B5F0-11D2-80B9-00104B1F6CEA}\\LocalServer32",&key))ExitProcess(47);
  if(RegQueryValueA(key,0,target,&size)||!same(target,"C:\\Program Files\\Common Files\\InstallShield\\Engine\\6\\Intel 32\\IKernel.exe"))ExitProcess(48);
  RegCloseKey(key);size=128;
  if(RegOpenKeyA((P)0x80000000,"CLSID\\{8C3C1B17-E59D-11D2-B40B-00A024B9DDDD}\\TreatAs",&key))ExitProcess(45);
  if(RegQueryValueA(key,0,target,&size)||size<38||!same(target,"{22D84EC7-E201-4432-B3ED-A9DCA3604594}"))ExitProcess(46);
  RegCloseKey(key);ExitProcess(0);
}
`;

// Future native lifecycle qualification uses authored code on both sides.
// The DLL reports real PROCESS_DETACH into a parent-owned result block. A
// surviving ordinary reference must keep its public Ping export callable.
const lifetimeDllSource = String.raw`
typedef unsigned long U; typedef void *P;
void __declspec(dllimport) __stdcall CoFreeAllLibraries(void);
static volatile U *observer;
__declspec(dllexport) U __stdcall Ping(void){return 0x614532;}
__declspec(dllexport) void __stdcall Observe(volatile U *value){observer=value;}
int __stdcall DllMain(P module,U reason,P reserved){
  if(reason==0&&observer){
    observer[0]++;
    if(observer[1]){CoFreeAllLibraries();observer[2]++;}
  }
  return 1;
}
`;
const lifetimeProbeSource = String.raw`
typedef unsigned long U; typedef void *P;
#define API __declspec(dllimport) __stdcall
void API ExitProcess(U); P API LoadLibraryA(const char*); U API FreeLibrary(P);
P API GetModuleHandleA(const char*); P API GetProcAddress(P,const char*);
void API SetLastError(U); U API GetLastError(void);
P API CoLoadLibrary(const unsigned short*,U); void API CoFreeAllLibraries(void);
void API CoFreeLibrary(P);
__attribute__((naked)) U __stdcall checkedFreeAll(void){
  __asm__ volatile("pushl %ebx\n pushl %esi\n pushl %edi\n pushl %ebp\n"
    "movl $0x13572468,%ebx\n movl $0x24681357,%esi\n movl $0x76543210,%edi\n movl %esp,%ebp\n"
    "calll *\"__imp__CoFreeAllLibraries@0\"\n"
    "cmpl %esp,%ebp\n jne 1f\n cmpl $0x13572468,%ebx\n jne 1f\n"
    "cmpl $0x24681357,%esi\n jne 1f\n cmpl $0x76543210,%edi\n jne 1f\n"
    "movl $1,%eax\n jmp 2f\n 1: xorl %eax,%eax\n 2: popl %ebp\n popl %edi\n popl %esi\n popl %ebx\n retl");
}
typedef U (__stdcall *Ping)(void);
typedef void (__stdcall *Observe)(volatile U*);
static volatile U counts[3];
static const unsigned short dll[]={ 'C',':','\\','c','o','l','i','f','e','.','d','l','l',0};
static const unsigned short missing[]={ 'C',':','\\','a','b','s','e','n','t','.','d','l','l',0};
static const unsigned short builtin[]={ 'k','e','r','n','e','l','3','2','.','d','l','l',0};
void start(void){
  P first=CoLoadLibrary(dll,1),second=CoLoadLibrary(dll,1),manual=CoLoadLibrary(dll,0);
  P ordinary=LoadLibraryA("C:\\colife.dll");
  Ping ping; Observe observe;
  if(!first||second!=first||manual!=first||ordinary!=first)ExitProcess(60);
  ping=(Ping)GetProcAddress(first,"Ping");observe=(Observe)GetProcAddress(first,"Observe");
  if(!ping||!observe||ping()!=0x614532)ExitProcess(61);
  observe(counts);
  SetLastError(0x4567);
  if(!checkedFreeAll())ExitProcess(73);
  if(GetLastError()!=0x4567)ExitProcess(71);
  if(counts[0]||GetModuleHandleA("colife.dll")!=ordinary||ping()!=0x614532)ExitProcess(62);
  if(!checkedFreeAll())ExitProcess(74);
  if(counts[0]||ping()!=0x614532)ExitProcess(63);
  CoFreeLibrary(manual);
  if(counts[0]||GetModuleHandleA("colife.dll")!=ordinary||ping()!=0x614532)ExitProcess(64);
  if(!FreeLibrary(ordinary)||counts[0]!=1||GetModuleHandleA("colife.dll"))ExitProcess(65);
  first=CoLoadLibrary(dll,1);
  if(!first)ExitProcess(66);
  observe=(Observe)GetProcAddress(first,"Observe");
  if(!observe)ExitProcess(67);
  counts[1]=1;observe(counts);
  if(!checkedFreeAll())ExitProcess(75);
  if(counts[0]!=2||counts[2]!=1||GetModuleHandleA("colife.dll"))ExitProcess(68);
  if(CoLoadLibrary(missing,1))ExitProcess(69);
  SetLastError(0x5678);
  if(!checkedFreeAll())ExitProcess(76);
  if(GetLastError()!=0x5678)ExitProcess(72);
  if(counts[0]!=2||counts[2]!=1)ExitProcess(70);
  first=CoLoadLibrary(builtin,1);second=CoLoadLibrary(builtin,1);manual=CoLoadLibrary(builtin,0);
  if(!first||first!=second||first!=manual)ExitProcess(78);
  if(!checkedFreeAll()||!FreeLibrary(manual)||FreeLibrary(first))ExitProcess(79);
  if(!GetModuleHandleA("kernel32.dll"))ExitProcess(80);
  ExitProcess(0);
}
`;
const lifetimeWorkerSource = lifetimeProbeSource.replace('void start(void){','U __stdcall worker(P unused){')
  .replace('  ExitProcess(0);','  return 0;') + String.raw`
P API CreateThread(P,U,P,P,U,U*); U API GetExitCodeThread(P,U*);
U API WaitForSingleObject(P,U); U API CloseHandle(P);
void start(void){U code=259;P thread=CreateThread(0,0,worker,0,0,0);
  if(!thread||WaitForSingleObject(thread,10000)||!GetExitCodeThread(thread,&code)||code)ExitProcess(77);
  CloseHandle(thread);ExitProcess(0);}
`;
const waitChildSource = String.raw`
typedef unsigned long U;
void __declspec(dllimport) __stdcall Sleep(U);
void __declspec(dllimport) __stdcall ExitProcess(U);
void start(void){Sleep(600);ExitProcess(23);}
`;
const waitParentSource = String.raw`
typedef unsigned long U;typedef void*P;
#define API __declspec(dllimport) __stdcall
void API ExitProcess(U);U API CreateProcessA(const char*,char*,P,P,U,U,P,P,P,P);
U API WaitForSingleObject(P,U);U API WaitForMultipleObjects(U,P*,U,U);
U API GetExitCodeProcess(P,U*);U API CloseHandle(P);
void start(void){static U startup[17]={68},p[4];static char command[]="C:\\wait-child.exe";U code=259;
  if(!CreateProcessA(0,command,0,0,0,0,0,0,startup,p))ExitProcess(90);
  if(WaitForSingleObject((P)p[0],0)!=0x102)ExitProcess(91);
  if(WaitForMultipleObjects(1,(P*)p,1,150)!=0x102)ExitProcess(92);
  if(WaitForSingleObject((P)p[0],5000)||!GetExitCodeProcess((P)p[0],&code)||code!=23)ExitProcess(93);
  CloseHandle((P)p[0]);CloseHandle((P)p[1]);ExitProcess(0);}
`;
const errorCleanupProbeSource = String.raw`
typedef unsigned long U; typedef void *P;
#define API __declspec(dllimport) __stdcall
void API ExitProcess(U); P API CoLoadLibrary(const unsigned short*,U);
void API CoFreeAllLibraries(void); P API GetProcAddress(P,const char*);
int API MessageBoxA(P,const char*,const char*,U);
P API GetModuleHandleA(const char*); U API RegisterClassA(P);
U API DefWindowProcA(P,U,U,long);
P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
typedef void (__stdcall *Observe)(volatile U*);
static volatile U counts[3];
static const unsigned short dll[]={ 'C',':','\\','c','o','l','i','f','e','.','d','l','l',0};
void start(void){
  static U windowClass[10];P mainWindow;
  windowClass[1]=(U)DefWindowProcA;windowClass[5]=(U)GetModuleHandleA(0);windowClass[9]=(U)"CleanupQualification";
  if(!RegisterClassA(windowClass))ExitProcess(83);
  mainWindow=CreateWindowExA(0,"CleanupQualification","",0x10cf0000,0,0,800,600,0,0,(P)windowClass[5],0);
  if(!mainWindow)ExitProcess(84);
  P module=CoLoadLibrary(dll,1);Observe observe;
  if(!module)ExitProcess(80);
  observe=(Observe)GetProcAddress(module,"Observe");
  if(!observe)ExitProcess(81);
  observe(counts);
  MessageBoxA(0,"Authored registration error fixture. Close to qualify genuine library cleanup.",
    "Sims cleanup qualification",0x10);
  CoFreeAllLibraries();
  ExitProcess(counts[0]==1?0:82);
}
`;

function inspectRetained(folder) {
  const result = JSON.parse(fs.readFileSync(path.join(folder, 'result.json')));
  const read = name => {
    const bytes = fs.readFileSync(path.join(folder, name));
    assert.equal(sha(bytes), result.artifactSHA256[name], `retained hash: ${name}`);
    return bytes.toString();
  };
  const stdout = read('native.stdout.log'), stderr = read('native.stderr.log');
  const closure = JSON.parse(read('original-permanent-closure-unknown.json'));
  const sources = JSON.parse(read('original-source-host-verification.json'));
  const childSource = sources.source.find(row => row.pid === 1485673);
  assert(childSource, 'actual original child source-exit receipt');
  const childBytes = fs.readFileSync(childSource.path);
  assert.equal(sha(childBytes), childSource.sha256);
  const childHostCode = JSON.parse(childBytes).code;
  const spawn = stdout.indexOf('[spawn] CreateProcess');
  const activation = stdout.indexOf('=> 0x80040154', spawn);
  const childEntry = stdout.indexOf('[child 4004 ikernel.exe] PE loaded. Entry:');
  assert(spawn >= 0 && activation > spawn && childEntry > activation);
  assert.match(stdout.slice(spawn, activation), /cwd d:\\setup/);
  const childLines = stdout.split('\n').filter(line => line.startsWith('[child 4004 ikernel.exe]'));
  assert(childLines.length > 0);
  assert(!stdout.includes('[spawn] child state merged:'), 'no completed merge in this original log');
  assert.match(stderr, /UNIMPLEMENTED API: CoFreeAllLibraries/);
  for (const name of ['native-wait.json', 'watchdog-wait.json', 'outer-child-wait.json']) {
    const wait = JSON.parse(read(name));
    assert(wait.actualWait === true && wait.stdoutEOF === true && wait.stderrEOF === true, name);
  }
  assert(closure.permanent && closure.state === 'UNKNOWN');
  assert.equal(closure.missing, 'actual-outer-wait.json');
  assert.equal(fs.existsSync(path.join(folder, closure.missing)), false);
  return {
    parentClassNotRegistered: true, childInheritedD: true,
    childLastObserved: childLines.at(-1),
    childRegistration: 'NOT_OBSERVED', childExit: 'NOT_OBSERVED',
    childExportMerge: 'NOT_OBSERVED', exactChildStop: 'UNKNOWN',
    parentCleanup: 'CoFreeAllLibraries failfast', nativeExit: closure.nativeExit,
    childNodeExitHookCode: childHostCode,
    outerActualWait: 'PERMANENT_UNKNOWN',
    // API tracing samples raw EAX at the handler boundary. A yielding wait's
    // raw EAX is not its final resumed WAIT_* result.
    finalWaitResult: 'NOT_ESTABLISHED_BY_RAW_EAX_TRACE',
  };
}

function buildInputs(directory) {
  const cp=require('node:child_process'),out=path.resolve(directory);
  fs.mkdirSync(out,{recursive:true});
  const put=(name,bytes)=>fs.writeFileSync(path.join(out,name),bytes,{flag:'wx'});
  const run=(command,args)=>cp.execFileSync(command,args,{stdio:'pipe'});
  const imports={
    kernel32:['ExitProcess@4','SetCurrentDirectoryA@4','GetCurrentDirectoryA@8','CreateProcessA@40',
      'WaitForSingleObject@8','GetExitCodeProcess@8','CloseHandle@4','LoadLibraryA@4','FreeLibrary@4',
      'GetModuleHandleA@4','GetProcAddress@8','SetLastError@4','GetLastError@0',
      'CreateThread@24','GetExitCodeThread@8','Sleep@4','WaitForMultipleObjects@16'],
    advapi32:['RegOpenKeyA@12','RegQueryValueA@16','RegCloseKey@4'],
    ole32:['CoLoadLibrary@8','CoFreeAllLibraries@0','CoFreeLibrary@4'],
    user32:['MessageBoxA@16','RegisterClassA@4','DefWindowProcA@16','CreateWindowExA@48']};
  for(const [dll,names] of Object.entries(imports)) {
    put(dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');
    run('llvm-dlltool',['-m','i386','-k','-d',path.join(out,dll+'.def'),'-l',path.join(out,dll+'.lib')]);
  }
  const sources={'registration-probe':registrationProbeSource,'lifetime-probe':lifetimeProbeSource,
    'error-cleanup-probe':errorCleanupProbeSource,'lifetime-worker':lifetimeWorkerSource,
    'wait-child':waitChildSource,'wait-parent':waitParentSource,colife:lifetimeDllSource};
  put('colife.def','LIBRARY colife.dll\nEXPORTS\nPing@0\nObserve@4\n');
  for(const [name,source] of Object.entries(sources)) {
    put(name+'.c',source);
    run('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin',
      '-O1','-c',path.join(out,name+'.c'),'-o',path.join(out,name+'.obj')]);
    const dll=name==='colife',output=path.join(out,name+(dll?'.dll':'.exe'));
    run('ld',['-mi386pe',...(dll?['--dll','--entry','_DllMain@12','--kill-at']:['--entry','_start','--subsystem','console']),
      '--disable-dynamicbase','--no-insert-timestamp','-o',output,path.join(out,name+'.obj'),
      ...(dll?[path.join(out,'colife.def')]:[]),...Object.keys(imports).map(d=>path.join(out,d+'.lib'))]);
  }
  const files=Object.keys(sources).map(name=>name+(name==='colife'?'.dll':'.exe'));
  return files.map(name=>({path:path.join(out,name),sha256:sha(fs.readFileSync(path.join(out,name))),bytes:fs.statSync(path.join(out,name)).size}));
}

async function nativeRetry(wasm,inputDirectory) {
  const {createHostImports}=require('../lib/host-imports'),loader=require('../lib/dll-loader');
  const boot=require('../lib/process-boot');
  const module=await WebAssembly.compile(fs.readFileSync(wasm));
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  async function instance(){
    const ctx={getMemory:()=>memory.buffer,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}},onExit(){}};
    const imports=createHostImports(ctx);imports.host.memory=memory;
    imports.host.has_dll_file=wa=>{
      const bytes=new Uint8Array(memory.buffer);let name='';while(bytes[wa])name+=String.fromCharCode(bytes[wa++]);
      return /colife\.dll$/i.test(name)?1:0;
    };
    const {exports:e}=await WebAssembly.instantiate(module,imports);ctx.exports=e;return e;
  }
  const e=await instance(),exe=fs.readFileSync(path.join(inputDirectory,'lifetime-probe.exe'));
  new Uint8Array(memory.buffer,e.get_staging(),exe.length).set(exe);e.load_pe(exe.length);
  const other=await instance();other.init_thread(2,...['image_base','code_start','code_end','thunk_base','thunk_end','num_thunks'].map(n=>e['get_'+n]()));
  const gate=loader.tryDllCallbackGate(other);assert(gate);
  try {
    e.run(10000);assert.equal(e.get_yield_reason(),9,'real CoLoadLibrary parks behind another native instance');
    const frame=[e.get_eip(),e.get_esp()];
    assert.equal(e.guest_read32(frame[1]+8),1,'bAutoFree stays in its original argument slot');
    assert.equal(e.take_com_load_auto(),0,'rejected entry has no pending automatic load intent');
    e.clear_yield();e.run(10000);
    assert.equal(e.get_yield_reason(),9);assert.deepEqual([e.get_eip(),e.get_esp()],frame,'retry preserves the actual guest thunk and stack');
    gate.release();
    const returnAddress=e.guest_read32(frame[1])>>>0;
    e.clear_yield();e.run(10000);assert.equal(e.get_yield_reason(),5);
    assert.equal(e.get_esp(),frame[1]+12,'accepted entry consumes exactly the two-argument stdcall frame');
    await boot.handleLoadLibraryYield({exports:e,memoryBuffer:memory.buffer,findDll:async name=>
      /colife\.dll$/i.test(name)?fs.readFileSync(path.join(inputDirectory,'colife.dll')):null});
    const handle=e.get_eax()>>>0,index=e.get_dll_index(handle);
    assert(index>=0);assert.equal(e.get_eip()>>>0,returnAddress);
    assert.equal(new DataView(memory.buffer).getUint32(e.get_com_dll_auto_roots()+index*4,true),1);
    await loader.drainDllUnloadAsync({exports:e,memoryBuffer:memory.buffer},null,true);
    assert.equal(e.get_dll_index(handle),-1,'real accepted reference detaches and retires');
    return {nativeRetry:true,unchangedParkedFrame:true,exactAcceptedStackBytes:12,actualAutomaticRoot:1,retired:true};
  } finally {
    // The gate may already have been released before a later assertion failed.
    const words=new Int32Array(memory.buffer,other.get_dll_callback_lock(),2);
    if(Atomics.load(words,0)===(other.get_dll_callback_owner()|0))gate.release();
  }
}

const outputs = new Map([['--write-observer',observerSource],
  ['--write-probe-source',registrationProbeSource],
  ['--write-lifetime-dll',lifetimeDllSource],['--write-lifetime-probe',lifetimeProbeSource],
  ['--write-error-probe',errorCleanupProbeSource]]);
const outputFlag = [...outputs.keys()].find(flag=>process.argv.includes(flag));
if (process.argv.includes('--native-retry')) {
  const at=process.argv.indexOf('--native-retry');
  nativeRetry(process.argv[at+1],process.argv[at+2]).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
} else if (process.argv.includes('--build-inputs')) {
  console.log(JSON.stringify(buildInputs(process.argv[process.argv.indexOf('--build-inputs')+1]),null,2));
} else if (outputFlag) {
  const flag = outputFlag;
  const bytes = outputs.get(flag);
  const destination = process.argv[process.argv.indexOf(flag) + 1];
  assert(destination, 'provide a new run-specific observer output path');
  fs.writeFileSync(destination, bytes, {flag:'wx'});
  console.log(JSON.stringify({input:destination,sha256:sha(bytes),executed:false}));
} else if (process.argv.includes('--inspect-retained')) {
  console.log(JSON.stringify(inspectRetained(prior), null, 2));
} else {
  test('external process deadlines survive idle main and guest/service clock jumps', () => {
    const {ThreadManager}=require('../lib/thread-manager');
    const memory={buffer:new SharedArrayBuffer(65536)};
    const ex={get_sync_table:()=>0,get_heap_ptr:()=>0,set_heap_ptr:()=>{},
      get_yield_reason:()=>1,get_wait_handle:()=>0xe44004,get_wait_handles_ptr:()=>0,
      get_wait_timeout:()=>150,get_wait_stack_bytes:()=>12};
    const tm=new ThreadManager({},memory,{exports:ex},()=>({host:{}}));
    tm._log=()=>{};let now=100,signaled=false;
    tm.processCtl=(op,handle)=>{assert.equal(op,8);assert.equal(handle,0xe44004);return signaled?0:0x102;};
    tm._nativeProcessNow=()=>now;tm._waitNow=()=>1e12;
    assert.equal(tm.checkMainYield(),true,'an idle guest cannot predict native process completion');
    const request={waitHandle:0xe44004,waitTimeout:150,waitStackBytes:12};
    for(const strict of [false,true]) {
      tm._strictServiceTime=strict;const state={};now=100;
      assert.equal(tm.resolveWait({...request,serviceRunEndMs:1e12},state,{main:true}),null);
      now=249;assert.equal(tm.resolveWait(request,state,{main:true}),null);
      now=250;assert.equal(tm.resolveWait(request,state,{main:true}).result,0x102);
      signaled=true;assert.equal(tm.resolveWait(request,{},{}).result,0);signaled=false;
    }
    new DataView(memory.buffer).setUint32(128,0xe44004,true);
    assert(tm._nativeProcessWait(1,128,20));assert(!tm._nativeProcessWait(0xe44004,0,24));
    assert(!tm._nativeProcessWait(65,128,20));assert(!tm._nativeProcessWait(2,65532,20));
  });
  test('retained exact original establishes startup and cleanup boundaries without borrowing registration', () => {
    const evidence = inspectRetained(prior);
    assert.equal(evidence.nativeExit, 1);
    assert.equal(evidence.exactChildStop, 'UNKNOWN');
    assert.equal(evidence.childRegistration, 'NOT_OBSERVED');
    assert.equal(evidence.outerActualWait, 'PERMANENT_UNKNOWN');
  });
  test('public-boundary observer distinguishes unfinished await, resolution and rejection without forcing outcomes', async () => {
    const {EventEmitter} = require('node:events');
    const vm = require('node:vm'), events = [];
    const processFixture = new EventEmitter();
    processFixture.pid = 1;
    processFixture.hrtime = {bigint:()=>1n};
    processFixture.stderr = {write:line=>events.push(JSON.parse(line.slice('[bootstrap-boundary] '.length)))};
    const ipcMessage = {t:'child-exit',code:7}, ipcCallback = ()=>{};
    processFixture.send = function(message, callback) {
      assert.equal(this,processFixture);assert.equal(message,ipcMessage);
      assert.equal(callback,ipcCallback);return false;
    };
    let mode = 'pending';
    const rejected = Error('actual rejection'), thrown = Error('actual throw'), result = {};
    const publicModule = {restore() {
      assert.equal(this, publicModule);
      if (mode === 'throw') throw thrown;
      if (mode === 'reject') return Promise.reject(rejected);
      if (mode === 'resolve') return Promise.resolve(result);
      return new Promise(()=>{});
    }};
    const moduleFixture = {_load:()=>publicModule,_resolveFilename:()=>'/fixture/lib/readonly-media-context.js'};
    vm.runInNewContext(observerSource, {process:processFixture,require:name=>{
      if (name === 'node:module') return moduleFixture;
      if (name === 'node:worker_threads') return {threadId:0};
      throw Error('unexpected dependency');
    }});
    const observed = moduleFixture._load('public-operation');
    assert.equal(processFixture.send(ipcMessage,ipcCallback),false);
    assert.equal(events.at(-1).event,'ipc-send-attempt');
    assert.equal(events.at(-1).code,7);
    observed.restore();
    processFixture.emit('beforeExit', 0);
    assert.deepEqual(events.at(-1).pending, ['readonly-media-context.js:restore']);
    mode = 'resolve'; assert.equal(await observed.restore(), result);
    mode = 'reject'; await assert.rejects(observed.restore(), error=>error === rejected);
    mode = 'throw'; assert.throws(()=>observed.restore(), error=>error === thrown);
    processFixture.emit('exit', 0);
    assert.deepEqual(events.at(-1).pending, ['readonly-media-context.js:restore']);
    assert.equal(events.filter(row=>row.event === 'resolved').length, 1);
    assert.equal(events.filter(row=>row.event === 'rejected').length, 1);
    assert.equal(events.filter(row=>row.event === 'throw').length, 1);
  });
}
