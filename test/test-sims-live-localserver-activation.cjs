'use strict';

// Authored inputs only. Merely loading this file never launches a guest,
// imports the runtime, registers a class, or consumes the ordinary original.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

const activationABI=String.raw`
__attribute__((naked)) H CALL checkedCreate(const GUID*clsid,P outer,U context,const GUID*iid,P*out){
 __asm__ volatile("pushl %ebx\n pushl %esi\n pushl %edi\n pushl %ebp\n"
  "movl $0x13572468,%ebx\n movl $0x24681357,%esi\n movl $0x76543210,%edi\n movl %esp,%ebp\n"
  "pushl 36(%ebp)\n pushl 32(%ebp)\n pushl 28(%ebp)\n pushl 24(%ebp)\n pushl 20(%ebp)\n"
  "calll *\"__imp__CoCreateInstance@20\"\n"
  "cmpl %esp,%ebp\n jne 1f\n cmpl $0x13572468,%ebx\n jne 1f\n"
  "cmpl $0x24681357,%esi\n jne 1f\n cmpl $0x76543210,%edi\n jne 1f\n"
  "jmp 2f\n 1: movl $0x8004fffe,%eax\n 2: movl %ebp,%esp\n popl %ebp\n popl %edi\n popl %esi\n popl %ebx\n retl $20");
}
`;

function sources() {
  const previous = require('./test-sims-standard-interface-marshaling.cjs');
  const remote = previous.remoteSources();
  const prefix = previous.standardStreamSource().split('U CALL exercise(P unused)')[0];
  const server = prefix + String.raw`
U API GetTickCount(void);
int commandSuffix(void){
 const char*cmd=GetCommandLineA();U n=0,i=0;
 static const char suffix[]="--fixture-token=launch-20261115 -Embedding";
 while(cmd[n])n++;while(suffix[i])i++;if(n<i)return 0;
 for(n-=i,i=0;suffix[i];i++)if(cmd[n+i]!=suffix[i])return 0;return 1;
}
void start(void){
 U cookie=0,began;H hr;factory.v=&fv;factory.refs=1;object.v=(const UV*)&dispatchV;
 check(commandSuffix(),203);OutputDebugStringA("live-activation.command-suffix=PASS\n");
 check(CoInitializeEx(0,0)>=0,204);registerActualAutomation();
 createdEvent=CreateEventA(0,1,0,"Local\\wa-live-activation-created");
 retiredEvent=CreateEventA(0,1,0,"Local\\wa-live-activation-retired");
 check(createdEvent&&retiredEvent,205);
#ifdef FAIL_EARLY
 ExitProcess(26);
#endif
#ifdef NEVER_REGISTER
 began=GetTickCount();while((U)(GetTickCount()-began)<65000)Sleep(5);ExitProcess(27);
#endif
 began=GetTickCount();while((U)(GetTickCount()-began)<300)Sleep(5);
 hr=CoRegisterClassObject(&cls,&factory,4,FIXTURE_FLAGS,&cookie);
 check(!hr&&cookie&&factory.refs==2,206);
 OutputDebugStringA("live-activation.delayed-live-registration=PASS\n");
 began=GetTickCount();
 while((!created||object.refs)&&(U)(GetTickCount()-began)<30000)Sleep(5);
 check(created&&!object.refs&&!instances&&factory.refs==2&&!locks,207);
 check(!CoRevokeClassObject(cookie)&&factory.refs==1,208);
 check(!fr(&factory),209);CloseHandle(createdEvent);CloseHandle(retiredEvent);
 finishActualAutomation();CoUninitialize();
 OutputDebugStringA("live-activation.server-final-refs=0\n");ExitProcess(0);
}
`;
  const serverWorker=server.replace('int commandSuffix(void){','static const char*launchCommand;\nint commandSuffix(void){')
   .replace('const char*cmd=GetCommandLineA();U n=0,i=0;','const char*cmd=launchCommand;U n=0,i=0;')
   .replace('void start(void){','U CALL registeredServer(P unused){')
   .replace('ExitProcess(26);','return 26;').replace('Sleep(5);ExitProcess(27);','Sleep(5);return 27;')
   .replace('OutputDebugStringA("live-activation.server-final-refs=0\\n");ExitProcess(0);',
    'OutputDebugStringA("live-activation.server-final-refs=0\\n");completed=1;return 0;')+String.raw`
void start(void){U id=0,code=259;launchCommand=GetCommandLineA();P thread=CreateThread(0,0,registeredServer,0,0,&id);
 check(thread&&id,229);check(!WaitForSingleObject(thread,0xffffffff),230);
 if(GetExitCodeThread(thread,&code)&&code)ExitProcess(code);
 check(GetExitCodeThread(thread,&code)&&!code&&completed,231);CloseHandle(thread);
 OutputDebugStringA("live-activation.server-worker-checked-all=PASS\n");ExitProcess(0);}
`;
  const client = remote.client
    .replace('void start(void){', activationABI+String.raw`
void registerFixtureCommand(void){
 P key=0;
 static const char command[]="\"C:\\Program Files\\Live Activation\\server.exe\" --fixture-token=launch-20261115";
 check(!RegCreateKeyA((P)0x80000000,"CLSID\\{72A962D1-7729-4AE9-8925-195E4636A261}\\LocalServer32",&key),210);
 check(!RegSetValueA(key,0,1,command,sizeof(command)),211);RegCloseKey(key);
}
void start(void){`)
    .replace(/ while\(\*cmd\)\{if\(\*cmd==' '\)last=cmd\+1;cmd\+\+;\}while\(last\[n\]\)n\+\+;[\s\S]*?hr=CoUnmarshalInterface\(&stream,&dispatchIID,&remote\);check\(!hr&&remote,192\);/,
      ' registerFixtureCommand();remote=(P)0x1234;hr=checkedCreate(&cls,0,4,&unsupported,&remote);check(hr==(H)0x80004002&&!remote,217);\n OutputDebugStringA("live-activation.actual-factory-failure=PASS\\n");\n hr=checkedCreate(&cls,0,4,&dispatchIID,&remote);check(!hr&&remote,192);\n OutputDebugStringA("live-activation.CoCreateInstance-ABI=PASS\\n");')
    .replaceAll('standard-remote.', 'live-activation.');
  if (client.includes('hr=CoUnmarshalInterface(&stream,&dispatchIID,&remote)'))
    throw new Error('command-line OBJREF bootstrap survived fixture transformation');
  const workerClient = client.replace('void start(void){', 'U CALL remoteClient(P unused){')
    .replace('OutputDebugStringA("live-activation.client=PASS\\n");ExitProcess(0);',
      'OutputDebugStringA("live-activation.client=PASS\\n");completed=1;return 0;') + String.raw`
void start(void){U id=0,code=259;P thread=CreateThread(0,0,remoteClient,0,0,&id);
 check(thread&&id,212);check(WaitForSingleObject(thread,0xffffffff)==0,213);
 check(GetExitCodeThread(thread,&code)&&!code&&completed,214);CloseHandle(thread);
 OutputDebugStringA("live-activation.worker-checked-all=PASS\n");ExitProcess(0);}
`;
  const failureClient = client.slice(0, client.indexOf('void start(void){')) + String.raw`
#ifndef EXPECTED_HRESULT
#define EXPECTED_HRESULT 0x80080005
#endif
void start(void){P remote=(P)0x1234;H hr;
 check(CoInitialize(0)>=0,215);registerActualAutomation();registerFixtureCommand();
 hr=checkedCreate(&cls,0,4,&dispatchIID,&remote);
 check(hr==(H)EXPECTED_HRESULT&&!remote,216);finishActualAutomation();CoUninitialize();
 OutputDebugStringA("live-activation.expected-failure=PASS\n");ExitProcess(0);}
`;
  const failureWorkerClient=failureClient.replace('void start(void){','U CALL failedClient(P unused){')
    .replace('OutputDebugStringA("live-activation.expected-failure=PASS\\n");ExitProcess(0);',
      'OutputDebugStringA("live-activation.expected-failure=PASS\\n");completed=1;return 0;')+String.raw`
void start(void){U id=0,code=259;P thread=CreateThread(0,0,failedClient,0,0,&id);
 check(thread&&id,218);check(WaitForSingleObject(thread,0xffffffff)==0,219);
 check(GetExitCodeThread(thread,&code)&&!code&&completed,220);CloseHandle(thread);
 OutputDebugStringA("live-activation.worker-checked-failure=PASS\n");ExitProcess(0);}
`;
  const singleClient=client.replace(/remote=\(P\)0x1234;hr=checkedCreate\(&cls,0,4,&unsupported,&remote\);check\(hr==\(H\)0x80004002&&!remote,217\);\n OutputDebugStringA\("live-activation.actual-factory-failure=PASS\\n"\);\n /,'');
  if(singleClient===client)throw new Error('SINGLEUSE client retained consuming failure call');
  const singleWorkerClient=workerClient.replace(/remote=\(P\)0x1234;hr=checkedCreate\(&cls,0,4,&unsupported,&remote\);check\(hr==\(H\)0x80004002&&!remote,217\);\n OutputDebugStringA\("live-activation.actual-factory-failure=PASS\\n"\);\n /,'');
  if(singleWorkerClient===workerClient)throw new Error('SINGLEUSE Worker retained consuming failure call');
  const parallelClient=prefix+String.raw`
U API CreateProcessA(const char*,char*,P,P,U,U,P,const char*,P,P);
U API GetExitCodeProcess(P,U*);
void start(void){
 static unsigned char si[2][68];static U pi[2][4];U i,code=259;
 static char command[2][64]={"\"C:\\live-single-client.exe\"","\"C:\\live-single-client.exe\""};
 for(i=0;i<2;i++){*(U*)si[i]=68;check(CreateProcessA(0,command[i],0,0,0,0,0,0,si[i],pi[i]),221);check(CloseHandle((P)pi[i][1]),222);}
 for(i=0;i<2;i++){check(!WaitForSingleObject((P)pi[i][0],30000),223);check(GetExitCodeProcess((P)pi[i][0],&code)&&!code,224);check(CloseHandle((P)pi[i][0]),225);}
 OutputDebugStringA("live-activation.concurrent-clients=PASS\n");ExitProcess(0);
}
`;
  const kernelClient=require('./test-sims-localserver-channel-implementation.cjs').kernelClientSource;
  const kernelWorkerClient=kernelClient.replace('void start(void){',
   'static volatile U kernelCompleted;\nU CALL genuineClient(P unused){')
   .replace('CoUninitialize();ExitProcess(0);','CoUninitialize();kernelCompleted=1;return 0;')+String.raw`
P API CreateThread(P,U,P,P,U,U*);U API GetExitCodeThread(P,U*);void API OutputDebugStringA(const char*);
void start(void){U id=0,code=259;P thread=CreateThread(0,0,genuineClient,0,0,&id);
 if(!thread||!id)ExitProcess(226);if(WaitForSingleObject(thread,0xffffffff))ExitProcess(227);
 if(!GetExitCodeThread(thread,&code)||code||!kernelCompleted)ExitProcess(228);CloseHandle(thread);
 OutputDebugStringA("live-activation.genuine-worker-checked-all=PASS\n");ExitProcess(0);}
`;
  return {server,serverWorker, client, workerClient, failureClient, failureWorkerClient,singleClient,singleWorkerClient,parallelClient,kernelClient,kernelWorkerClient};
}

function prepare(directory) {
  const cp = require('node:child_process');
  const out = path.resolve(directory);fs.mkdirSync(out, {recursive: true});
  const put = (name, bytes) => fs.writeFileSync(path.join(out,name), bytes, {flag:'wx'});
  let serial=0;
  const run = (command,args) => {
    const r=cp.spawnSync(command,args,{encoding:'utf8',timeout:30000});const label='tool-'+ ++serial;
    put(label+'.stdout.log',r.stdout||'');put(label+'.stderr.log',r.stderr||'');
    put(label+'-wait.json',JSON.stringify({command,pid:r.pid,exit:r.status,signal:r.signal,
      actualWait:r.status!==null,stdoutEOF:!r.error,stderrEOF:!r.error,error:r.error?String(r.error):null})+'\n');
    if(r.error||r.status)throw new Error(command+': '+(r.stderr||r.error));
  };
  const libraries={
    kernel32:['ExitProcess@4','Sleep@4','OutputDebugStringA@4','GetCurrentProcessId@0',
      'GetTickCount@0','GetCommandLineA@0','CreateFileA@28','WriteFile@20','GetStdHandle@4','SetCurrentDirectoryA@4','CreateThread@24','GetExitCodeThread@8','WaitForSingleObject@8',
      'CloseHandle@4','CreateProcessA@40','GetExitCodeProcess@8','CreateEventA@16','SetEvent@4','LoadLibraryA@4','GetProcAddress@8','FreeLibrary@4'],
    ole32:['CoInitialize@4','CoInitializeEx@8','CoUninitialize@0','CoMarshalInterface@24',
      'CoUnmarshalInterface@12','CoReleaseMarshalData@4','CoGetPSClsid@8','CoRegisterPSClsid@8',
      'CoGetClassObject@20','CoTaskMemAlloc@4','CoTaskMemFree@4','CoCreateInstance@20','CoRegisterClassObject@20','CoRevokeClassObject@4'],
    oleaut32:['SysAllocStringLen@8','SysFreeString@4','SysStringLen@4','LoadTypeLib@8','RegisterTypeLib@12'],
    advapi32:['RegCreateKeyA@12','RegSetValueA@20','RegCloseKey@4'],
  };
  for(const [dll,names] of Object.entries(libraries)){
    put(dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');
    run('llvm-dlltool',['-m','i386','-k','-d',path.join(out,dll+'.def'),'-l',path.join(out,dll+'.lib')]);
  }
  const s=sources(),inputs=[];
  for(const [name,source,flags] of [
    ['live-server',s.server,[]],['live-server-worker',s.serverWorker,[]],
    ['live-server-worker-early',s.serverWorker,['-DFAIL_EARLY=1']],
    ['live-server-worker-unregistered',s.serverWorker,['-DNEVER_REGISTER=1']],
    ['live-client',s.client,[]],['live-client-worker',s.workerClient,[]],
    ['live-server-early',s.server,['-DFAIL_EARLY=1']],
    ['live-server-unregistered',s.server,['-DNEVER_REGISTER=1']],
    ['live-server-single',s.server,['-DFIXTURE_FLAGS=0']],
    ['live-single-client',s.singleClient,[]],['live-single-client-worker',s.singleWorkerClient,[]],
    ['live-parallel-client',s.parallelClient,[]],
    ['live-kernel-client',s.kernelClient,[]],['live-kernel-client-worker',s.kernelWorkerClient,[]],
    ['live-client-failure',s.failureClient,[]],
    ['live-client-failure-worker',s.failureWorkerClient,[]],
  ]){
    put(name+'.c',source);
    run('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector',
      '-mno-stack-arg-probe','-fno-builtin','-O1',...flags,'-c',path.join(out,name+'.c'),'-o',path.join(out,name+'.obj')]);
    run('ld',['-mi386pe','--entry','_start','--subsystem','console','--disable-dynamicbase','--no-insert-timestamp',
      '-o',path.join(out,name+'.exe'),path.join(out,name+'.obj'),...Object.keys(libraries).map(dll=>path.join(out,dll+'.lib'))]);
    inputs.push({name,sha256:sha(fs.readFileSync(path.join(out,name+'.exe'))),sourceSHA256:sha(Buffer.from(source))});
  }
  put('prepared.json',JSON.stringify({inputs,nativeExecution:false},null,2)+'\n');return inputs;
}

// Execute only after the shared source/build/runtime lane is released.
function authorityContractTests(){
 const {test}=require('node:test'),assert=require('node:assert/strict');
 const {OwnedComAuthority}=require('../lib/com-owned-channel');
 const {dispatchCom}=require('../lib/com-owned-transport');
 let serial=0;
 function fixture(){
  const authority=new OwnedComAuthority(),owner=authority.connect('server-'+ ++serial),caller=authority.connect('client-'+ ++serial);
  const descriptor={thread:1,generation:'1',source:'11'.repeat(32),module:'22'.repeat(32)};
  const od=authority.registerOwner(owner,descriptor),cd=authority.registerOwner(caller,descriptor);
  let now=0;const a=authority.activation;a.now=()=>now;a.timeout=100;
  const clsid='12'.repeat(16),iid='34'.repeat(16),command='"C:\\Program Files\\server.exe" --nonce=x -Embedding';
  const spec={clsid,iid,context:4,kind:'create',command};
  const pub=(flags=1)=>dispatchCom(authority,owner,{owner:od,command:'classPublish',clsid,context:4,flags,cookie:7});
  const begin=()=>dispatchCom(authority,caller,{owner:cd,command:'activationBegin',activation:spec});
  const poll=ticket=>dispatchCom(authority,caller,{owner:cd,command:'activationPoll',ticket});
  const take=()=>dispatchCom(authority,owner,{owner:od,command:'activationTake'});
  const reference=(mode=0)=>{const ref=authority.prepareExport(owner,od,iid,mode,'ab'.repeat(16));authority.commitExport(owner,od,ref);return ref;};
  return {authority,a,owner,caller,od,cd,clsid,iid,spec,pub,begin,poll,take,reference,advance:n=>now+=n};
 }
 test('live publication routes authenticated opaque work, normal OBJREF consumes once',()=>{
  const f=fixture(),job=f.begin();assert.ok(job.launch);assert.equal(f.poll(job.ticket),null);f.pub();assert.equal(f.poll(job.ticket),null);
  const work=f.take();assert.equal(work.ticket,job.ticket);assert.deepEqual(Object.keys(work).sort(),['clsid','cookie','iid','kind','registration','ticket']);
  const ref=f.reference();f.a.complete(f.owner,f.od,job.ticket,0,ref);const result=f.poll(job.ticket);assert.equal(result.reference,ref);
  const lease=f.authority.consume(f.caller,f.cd,ref);f.a.finish(f.caller,f.cd,job.ticket);
  assert.throws(()=>f.authority.consume(f.caller,f.cd,ref),{code:'EDISCONNECTED'});
  assert.throws(()=>f.poll(job.ticket),{code:'ESTALE'});
  f.authority.releaseProxy(f.caller,f.cd,ref,lease.token);assert.equal(f.authority.take(f.owner,f.od).kind,'retire');
 });
 test('duplicate callers share launch, SINGLEUSE duplicate obtains fresh bounded claim',()=>{
  const f=fixture(),one=f.begin(),two=f.begin();assert.ok(one.launch);assert.equal(two.launch,null);f.pub(0);
  assert.equal(f.poll(one.ticket),null);const next=f.poll(two.ticket);assert.equal(next.pending,true);assert.notEqual(next.launch,one.launch);
  assert.equal(f.poll(two.ticket),null);f.pub(0);assert.equal(f.poll(two.ticket),null);assert.equal(f.take().ticket,one.ticket);assert.equal(f.take().ticket,two.ticket);
 });
 test('MULTIPLEUSE accepts duplicates while revoke holds until their completion',()=>{
  const f=fixture(),id=f.pub(),one=f.begin(),two=f.begin();assert.equal(one.launch,null);assert.equal(two.launch,null);
  f.take();f.take();assert.equal(f.a.revoke(f.owner,f.od,id),2);assert.throws(()=>f.a.finishRevoke(f.owner,f.od,id),{code:'ESTALE'});
  for(const job of [one,two]){f.a.complete(f.owner,f.od,job.ticket,0x80004002,null);assert.equal(f.poll(job.ticket).hresult,0x80004002);}
  assert.equal(f.a.finishRevoke(f.owner,f.od,id),true);
 });
 test('wrong authenticated exporter cannot take or complete another continuation work',()=>{
  const f=fixture();f.pub();const job=f.begin();assert.equal(f.a.take(f.caller,f.cd),null);f.take();
  assert.throws(()=>f.a.complete(f.caller,f.cd,job.ticket,0,f.reference()),{code:'ESTALE'});
  assert.throws(()=>f.a.poll(f.owner,f.od,job.ticket),{code:'ESTALE'});
 });
 test('caller retirement during execution discards late result without releasing inflight early',()=>{
  const f=fixture(),id=f.pub(),job=f.begin();f.take();f.authority.retireOwner(f.caller,f.cd);
  assert.equal(f.a.classes.get(id).calls,1);const ref=f.reference();assert.equal(f.a.complete(f.owner,f.od,job.ticket,0,ref),false);
  f.authority.releaseData(f.owner,f.od,ref);assert.equal(f.a.classes.get(id).calls,0);assert.equal(f.authority.take(f.owner,f.od).kind,'retire');
 });
 test('failed unmarshal retires escrowed reference through actual owned-channel authority',()=>{
  const f=fixture();f.pub();const job=f.begin();f.take();const ref=f.reference();f.a.complete(f.owner,f.od,job.ticket,0,ref);f.poll(job.ticket);
  f.a.finish(f.caller,f.cd,job.ticket);assert.equal(f.authority.take(f.owner,f.od).kind,'retire');
 });
 test('uncommitted or tablestrong references cannot satisfy activation',()=>{
  for(const mode of [0,1]){const f=fixture();f.pub();const job=f.begin();f.take();
   const ref=mode?f.reference(1):f.authority.prepareExport(f.owner,f.od,f.iid,0,'ab'.repeat(16));
   assert.throws(()=>f.a.complete(f.owner,f.od,job.ticket,0,ref));}
 });
 test('real owner retirement and generation replacement never rebind old work',()=>{
  const f=fixture();f.pub();const job=f.begin();f.take();f.authority.retireOwner(f.owner,f.od);
  f.authority.registerOwner(f.owner,{...f.od,generation:'2'});
  assert.throws(()=>f.a.take(f.owner,f.od),{code:'ESTALE'});assert.equal(f.poll(job.ticket).hresult,0x80080005);
 });
 test('inflight deadline retains tombstone until actual exporter completes',()=>{
  const f=fixture(),id=f.pub(),job=f.begin();f.take();f.advance(101);assert.equal(f.poll(job.ticket).hresult,0x80080005);
  assert.equal(f.a.classes.get(id).calls,1);assert.equal(f.a.complete(f.owner,f.od,job.ticket,0x80004002,null),false);
  assert.equal(f.a.classes.get(id).calls,0);assert.equal(f.a.jobs.size,0);
 });
 test('exporter-first timeout observations preserve server failure for later caller poll',()=>{
  for(const executing of [false,true]){
   const f=fixture(),id=f.pub(),job=f.begin();if(executing)f.take();f.advance(101);
   if(executing)assert.equal(f.a.complete(f.owner,f.od,job.ticket,0x80004002,null),false);
   else assert.equal(f.take(),null);
   assert.equal(f.a.classes.get(id).calls,0);assert.equal(f.poll(job.ticket).hresult,0x80080005);
  }
 });
}
function metadataContractTests(){
 const {test}=require('node:test'),assert=require('node:assert/strict');
 const {createStorageImports,setRegValue,clearStore}=require('../lib/storage');
 function fixture(){
  clearStore();const memory=new ArrayBuffer(65536),clsid='{72a962d1-7729-4ae9-8925-195e4636a261}';
  new Uint8Array(memory,100,16).set(Buffer.from('d162a9722977e94a8925195e4636a261','hex'));
  let live=false;const ctx={getMemory:()=>memory,processDesktop:{call:()=>live}};
  const information=createStorageImports(ctx).com_localserver_information;
  return {memory,clsid,information,setLive:x=>live=x,
   value:(suffix,name,type,data)=>setRegValue('HKCR\\CLSID\\'+clsid+suffix,name,type,data)};
 }
 test('real storage metadata preserves quoted command and appended Embedding',()=>{
  const f=fixture(),command='"C:\\Program Files\\Fixture\\server.exe" --token=x';f.value('\\LocalServer32','',1,command);
  assert.equal(f.information(100,4,0,0),1);const n=f.information(100,4,1000,32768);
  assert.equal(Buffer.from(f.memory,1000,n).toString('latin1'),command+' -Embedding\0');
 });
 test('real storage names are case insensitive and unsupported launch identity stays explicit',()=>{
  const f=fixture();f.value('','appid',1,'fixture-app');setRegValue('HKCR\\AppID\\fixture-app','localservice',1,'FixtureService');
  assert.equal(f.information(100,4,0,0)>>>0,0x80004001);f.setLive(true);assert.equal(f.information(100,4,1000,1),1);
  const g=fixture();g.value('\\LocalServer32','',1,'server.exe');g.value('\\LocalServer32','serverexecutable',1,'server.exe');
  assert.equal(g.information(100,4,0,0)>>>0,0x80004001);
 });
 test('real live publication accepts unusable registry command without silently truncating it',()=>{
  const f=fixture();f.value('\\LocalServer32','',2,'%SystemRoot%\\server.exe');
  assert.equal(f.information(100,4,0,0)>>>0,0x80040150);f.setLive(true);assert.equal(f.information(100,4,1000,1),1);
  f.value('\\LocalServer32','',1,'server.exe');assert.equal(f.information(100,4,1000,1)>>>0,0x8007007a);
 });
}
if(require.main===module&&process.argv.includes('--authority-tests'))authorityContractTests();
if(require.main===module&&process.argv.includes('--metadata-tests'))metadataContractTests();
module.exports={sources,prepare,authorityContractTests,metadataContractTests};

// Contract tests exercise production state machines with isolated owners/callbacks.
function activationStateTests(){
'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {OwnedComActivation}=require('../lib/com-owned-activation');
const fail=code=>{throw Object.assign(new Error(code),{code});};
function fixture(){
 let now=0;const sessions=[];const exported=new Map();let discards=0;
 const authority={owner(session,owner){if(!session.live||session.owner!==owner)fail('ESTALE');return owner;},
  lookup(reference){const e=exported.get(reference);if(!e)fail('EDISCONNECTED');return e;},
  maybeRetire(){discards++;}};
 const a=new OwnedComActivation(authority,{now:()=>now,timeout:100});
 const session=()=>{const s={live:true,owner:{generation:'1',thread:1,source:'11'.repeat(32),module:'22'.repeat(32)}};sessions.push(s);return s;};
 const owner=session(),caller=session();const clsid='12'.repeat(16),iid='34'.repeat(16);
 const request={clsid,iid,context:4,kind:'create',command:'"C:\\server.exe" -Embedding'};
 const publish=(flags=1,context=4)=>a.publish(owner,owner.owner,clsid,context,flags,1);
 const begin=()=>a.begin(caller,caller.owner,request);
 const reference=()=>{const ref={iid,opaque:'identity'};exported.set(ref,{session:owner,owner:owner.owner,iid,mode:0,packet:true});return ref;};
 return {a,owner,caller,clsid,iid,request,publish,begin,reference,exported,
  advance:n=>now+=n,discards:()=>discards,sessions};
}
test('delayed publication queues a real owner ticket and transfers one reference once',()=>{
 const f=fixture(),r=f.begin();assert.ok(r.launch);assert.equal(f.a.poll(f.caller,f.caller.owner,r.ticket),null);
 f.publish();assert.equal(f.a.poll(f.caller,f.caller.owner,r.ticket),null);
 const ticket=f.a.take(f.owner,f.owner.owner);assert.equal(ticket.ticket,r.ticket);assert.equal(ticket.kind,'create');
 const ref=f.reference();assert.equal(f.a.complete(f.owner,f.owner.owner,r.ticket,0,ref),true);
 assert.deepEqual(f.a.poll(f.caller,f.caller.owner,r.ticket),{hresult:0,reference:ref});
 assert.throws(()=>f.a.poll(f.caller,f.caller.owner,r.ticket),{code:'ESTALE'});
 f.a.finish(f.caller,f.caller.owner,r.ticket);assert.equal(f.a.jobs.size,0);
});
test('duplicate callers share one pending launch claim',()=>{
 const f=fixture(),first=f.begin(),second=f.begin();assert.ok(first.launch);assert.equal(second.launch,null);
 f.publish();assert.equal(f.a.launches.size,0);f.a.poll(f.caller,f.caller.owner,first.ticket);f.a.poll(f.caller,f.caller.owner,second.ticket);
 assert.equal(f.a.classes.values().next().value.calls,2);
});
test('changed launch command refuses borrowing an existing launch claim',()=>{
 const f=fixture();f.begin();assert.throws(()=>f.a.begin(f.caller,f.caller.owner,{...f.request,command:'other.exe -Embedding'}),{code:'ESTALE'});
});
test('a live class activates without a registry command',()=>{
 const f=fixture();f.publish();const r=f.a.begin(f.caller,f.caller.owner,{...f.request,command:null});
 assert.equal(r.launch,null);assert.equal(f.a.take(f.owner,f.owner.owner).ticket,r.ticket);
});
test('a missing live class and absent registry command report class-not-registered',()=>{
 const f=fixture(),r=f.a.begin(f.caller,f.caller.owner,{...f.request,command:null});
 assert.deepEqual(f.a.poll(f.caller,f.caller.owner,r.ticket),{hresult:0x80040154,reference:null});
});
test('SINGLEUSE hides publication atomically, MULTIPLEUSE accepts both callers',()=>{
 for(const flags of [0,1,2]){
  const f=fixture();f.publish(flags);const one=f.begin(),two=f.begin();
  assert.equal(f.a.jobs.get(one.ticket).state,'queued');
  assert.equal(f.a.jobs.get(two.ticket).state,flags===0?'waiting':'queued');
  assert.equal(!!two.launch,flags===0);
 }
});
test('LOCAL_SERVER publication never exposes an in-process-only guest pointer',()=>{
 const f=fixture();f.publish(1,1);const r=f.begin();assert.ok(r.launch);assert.equal(f.a.take(f.owner,f.owner.owner),null);
});
test('REGCLS in-process visibility is limited to the registering connection',()=>{
 const f=fixture();f.publish(1,4);
 assert.equal(f.a.available(f.owner,f.owner.owner,f.clsid,1),true);
 assert.equal(f.a.available(f.caller,f.caller.owner,f.clsid,1),false);
});
test('revoke hides new callers and preserves accepted inflight ownership',()=>{
 const f=fixture(),id=f.publish(),one=f.begin();f.a.take(f.owner,f.owner.owner);
 assert.equal(f.a.revoke(f.owner,f.owner.owner,id),1);
 assert.throws(()=>f.a.finishRevoke(f.owner,f.owner.owner,id),{code:'ESTALE'});
 assert.ok(f.begin().launch);assert.equal(f.a.complete(f.owner,f.owner.owner,one.ticket,0,f.reference()),true);
 assert.equal(f.a.finishRevoke(f.owner,f.owner.owner,id),true);
});
test('native early exit fails every pending duplicate caller without a new launch',()=>{
 const f=fixture(),one=f.begin(),two=f.begin();
 f.a.launchFailed(f.caller,f.caller.owner,f.clsid,one.launch);
 for(const r of [one,two])assert.deepEqual(f.a.poll(f.caller,f.caller.owner,r.ticket),{hresult:0x80080005,reference:null});
});
test('launch failure cannot be reported by another authenticated owner',()=>{
 const f=fixture(),one=f.begin();assert.throws(()=>f.a.launchFailed(f.owner,f.owner.owner,f.clsid,one.launch),{code:'ESTALE'});
});
test('timeout cancels a queued request and retires its registration hold',()=>{
 const f=fixture();f.publish();const one=f.begin();f.advance(101);
 assert.equal(f.a.poll(f.caller,f.caller.owner,one.ticket).hresult,0x80080005);
 assert.equal(f.a.classes.values().next().value.calls,0);assert.equal(f.a.take(f.owner,f.owner.owner),null);
});
test('timeout during actual execution retains a tombstone until owner completion',()=>{
 const f=fixture();f.publish();const one=f.begin();f.a.take(f.owner,f.owner.owner);f.advance(101);
 assert.equal(f.a.poll(f.caller,f.caller.owner,one.ticket).hresult,0x80080005);
 assert.equal(f.a.classes.values().next().value.calls,1);
 assert.throws(()=>f.a.poll(f.caller,f.caller.owner,one.ticket),{code:'ESTALE'});
 assert.equal(f.a.complete(f.owner,f.owner.owner,one.ticket,0,f.reference()),false);
 assert.equal(f.a.classes.values().next().value.calls,0);assert.equal(f.a.jobs.size,0);
});
test('cancel after completion discards the unconsumed packet, never publishes it',()=>{
 const f=fixture();f.publish();const one=f.begin();f.a.take(f.owner,f.owner.owner);const ref=f.reference();
 f.a.complete(f.owner,f.owner.owner,one.ticket,0,ref);f.a.cancel(f.caller,f.caller.owner,one.ticket);
 assert.equal(f.discards(),1);assert.equal(f.exported.get(ref).packet,false);
 assert.throws(()=>f.a.poll(f.caller,f.caller.owner,one.ticket),{code:'ESTALE'});
});
test('caller cancellation during execution never publishes a late result',()=>{
 const f=fixture();f.publish();const one=f.begin();f.a.take(f.owner,f.owner.owner);
 f.a.cancel(f.caller,f.caller.owner,one.ticket);
 assert.equal(f.a.complete(f.owner,f.owner.owner,one.ticket,0,f.reference()),false);assert.equal(f.a.jobs.size,0);
});
test('failed guest factory HRESULT is preserved exactly and has no reference',()=>{
 const f=fixture();f.publish();const one=f.begin();f.a.take(f.owner,f.owner.owner);
 f.a.complete(f.owner,f.owner.owner,one.ticket,0x80004002,null);
 assert.deepEqual(f.a.poll(f.caller,f.caller.owner,one.ticket),{hresult:0x80004002,reference:null});
});
test('wrong-owner, wrong-IID, tablestrong and uncommitted references refuse completion',()=>{
 for(const mutation of [e=>e.session={},e=>e.owner={},e=>e.iid='ff'.repeat(16),e=>e.mode=1,e=>e.packet=false]){
  const f=fixture();f.publish();const one=f.begin();f.a.take(f.owner,f.owner.owner);const ref=f.reference();mutation(f.exported.get(ref));
  assert.throws(()=>f.a.complete(f.owner,f.owner.owner,one.ticket,0,ref),{code:'ESTALE'});
 }
});
test('process, thread, source and generation replacement cannot take old tickets',()=>{
 for(const field of ['process','thread','source','generation','module']){
  const f=fixture();f.publish();const one=f.begin();const old=f.owner.owner;
  f.owner.owner={...old,[field]:'replacement'};
  assert.throws(()=>f.a.take(f.owner,old),{code:'ESTALE'});
  assert.equal(f.a.poll(f.caller,f.caller.owner,one.ticket).hresult,0x80080005);
 }
});
test('caller owner retirement removes accepted queued work and its registration hold',()=>{
 const f=fixture();f.publish();f.begin();const old=f.caller.owner;f.a.retireOwner(f.caller,old);f.caller.live=false;
 assert.equal(f.a.jobs.size,0);assert.equal(f.a.classes.values().next().value.calls,0);
});
test('exporter retirement fails accepted work and cannot bind a replacement registration',()=>{
 const f=fixture();f.publish();const one=f.begin();f.a.retireOwner(f.owner,f.owner.owner);f.owner.live=false;
 assert.deepEqual(f.a.poll(f.caller,f.caller.owner,one.ticket),{hresult:0x80080005,reference:null});
});
test('failed unmarshal or caller retirement after delivery discards escrowed normal ownership',()=>{
 for(const retire of [false,true]){
  const f=fixture();f.publish();const one=f.begin();f.a.take(f.owner,f.owner.owner);const ref=f.reference();
  f.a.complete(f.owner,f.owner.owner,one.ticket,0,ref);f.a.poll(f.caller,f.caller.owner,one.ticket);
  if(retire)f.a.retireOwner(f.caller,f.caller.owner);else f.a.finish(f.caller,f.caller.owner,one.ticket);
  assert.equal(f.discards(),1);assert.equal(f.exported.get(ref).packet,false);assert.equal(f.a.jobs.size,0);
 }
});
test('exporter retirement after completed or delivered results never decrements inflight twice',()=>{
 for(const delivered of [false,true]){
  const f=fixture(),id=f.publish(),one=f.begin();f.a.take(f.owner,f.owner.owner);
  f.a.complete(f.owner,f.owner.owner,one.ticket,0,f.reference());
  if(delivered)f.a.poll(f.caller,f.caller.owner,one.ticket);
  const registration=f.a.classes.get(id);f.a.retireOwner(f.owner,f.owner.owner);f.owner.live=false;
  assert.equal(registration.calls,0);
  if(delivered)assert.equal(f.a.finish(f.caller,f.caller.owner,one.ticket),true);
  else assert.equal(f.a.poll(f.caller,f.caller.owner,one.ticket).hresult,0x80080005);
 }
});
test('same owner may claim local work, while a remote or replacement owner cannot borrow it',()=>{
 const f=fixture(),id=f.publish();assert.equal(f.a.local(f.caller,f.caller.owner,f.clsid,4),null);
 const claim=f.a.local(f.owner,f.owner.owner,f.clsid,4);assert.equal(claim.registration,id);
 assert.throws(()=>f.a.finishLocal(f.caller,f.caller.owner,claim.ticket),{code:'ESTALE'});
 assert.equal(f.a.finishLocal(f.owner,f.owner.owner,claim.ticket),true);
 assert.throws(()=>f.a.finishLocal(f.owner,f.owner.owner,claim.ticket),{code:'ESTALE'});
 assert.equal(f.a.classes.get(id).calls,0);
});

test('pending duplicate gets one new launch claim after SINGLEUSE publication is consumed',()=>{
 const f=fixture(),one=f.begin(),two=f.begin();assert.ok(one.launch);assert.equal(two.launch,null);
 f.publish(0);assert.equal(f.a.poll(f.caller,f.caller.owner,one.ticket),null);
 const next=f.a.poll(f.caller,f.caller.owner,two.ticket);
 assert.equal(next.pending,true);assert.ok(next.launch);assert.notEqual(next.launch,one.launch);
 assert.equal(next.command,f.request.command);assert.equal(f.a.poll(f.caller,f.caller.owner,two.ticket),null);
 f.publish(0);assert.equal(f.a.poll(f.caller,f.caller.owner,two.ticket),null);
 assert.equal(f.a.jobs.get(two.ticket).state,'queued');
});
test('exporter observing queued timeout preserves exact failure for caller poll',()=>{
 const f=fixture(),id=f.publish(),one=f.begin();f.advance(101);assert.equal(f.a.take(f.owner,f.owner.owner),null);
 assert.equal(f.a.classes.get(id).calls,0);assert.equal(f.a.poll(f.caller,f.caller.owner,one.ticket).hresult,0x80080005);
});
test('late owner completion before first caller poll preserves timeout instead of stale ticket',()=>{
 const f=fixture(),id=f.publish(),one=f.begin();f.a.take(f.owner,f.owner.owner);f.advance(101);
 assert.equal(f.a.complete(f.owner,f.owner.owner,one.ticket,0,f.reference()),false);
 assert.equal(f.a.classes.get(id).calls,0);assert.equal(f.a.poll(f.caller,f.caller.owner,one.ticket).hresult,0x80080005);
});

}
function schedulerTests(){
const assert=require('node:assert/strict');const {test}=require('node:test');
const {HResult,HR}=require('../lib/com-standard-marshaler');
const {ComLocalServerRuntime}=require('../lib/com-owned-localserver');
function fixture(){
 const memory=Buffer.alloc(65536),events=[],freed=[],released=[];let next=1024;
 const c={exports:{guest_to_wasm:x=>x},check(){},word:p=>memory.readUInt32LE(p),putWord:(p,x)=>memory.writeUInt32LE(x>>>0,p),
  async call(object,method,args=[]){events.push(['call',object,method,Array.from(args)]);return method===1?2:0;},
  async invoke(api,args){events.push(['invoke',api,Array.from(args)]);return 1;}};
 const t={call(name,args){events.push(['transport',name,args]);if(name==='classPublish')return 'registration';if(name==='classRevoke')return 0;return null;}};
 const m={c,transport:t,allocate(n){const p=next;next+=n;memory.fill(0,p,p+n);return p;},free:p=>freed.push(p),
  read:(p,n)=>Uint8Array.from(memory.subarray(p,p+n)),write:(p,b)=>memory.set(b,p),guid:()=> '11'.repeat(16),
  async release(p){released.push(p);},async qi(){return {hr:0,pointer:444};},async drain(){}};
 const r=new ComLocalServerRuntime({marshaler:m,proxy:{},api:{CreateProcessA:1,CloseHandle:2,GetExitCodeProcess:3},information:()=>1});
 return {r,m,c,t,memory,events,freed,released};
}
test('publication retains actual owner object; revoke releases once',async()=>{
 const f=fixture();assert.equal(await f.r.register(100,200,4,1,300),0);
 assert.equal(f.c.word(300),0x40000001);assert.equal(f.events[0][0],'call');assert.equal(f.events[0][2],1);
 assert.equal(await f.r.revoke(0x40000001),0);assert.deepEqual(f.released,[200]);assert.equal(await f.r.revoke(0x40000001),0x80040154);
});
test('failed authority publication drops owner AddRef',async()=>{
 const f=fixture();f.t.call=()=>{throw new HResult(HR.DISCONNECTED);};
 await assert.rejects(f.r.register(100,200,4,1,300),HResult);assert.deepEqual(f.released,[200]);assert.equal(f.c.word(300),0);
});
test('same-owner factory failure clears accidental pointer and releases factory',async()=>{
 const f=fixture();f.r.registrations.set(7,{cookie:7,id:'r',object:200});
 f.t.call=(name)=>name==='activationLocal'?{cookie:7,registration:'r',ticket:'j'}:null;
 f.c.call=async()=>{f.c.putWord(300,555);return HR.NOINTERFACE;};
 assert.equal(await f.r.activate('create',[100,0,4,120,300]),HR.NOINTERFACE);
 assert.equal(f.c.word(300),0);assert.deepEqual(f.released,[444,555]);
});
test('ordinary local allocation failure finishes accepted claim',async()=>{
 const f=fixture();f.r.registrations.set(7,{cookie:7,id:'r',object:200});const names=[];
 f.t.call=name=>{names.push(name);return name==='activationLocal'?{cookie:7,registration:'r',ticket:'j'}:null;};
 f.m.qi=async()=>{throw new HResult(HR.OOM);};
 assert.equal(await f.r.activate('create',[100,0,4,120,300]),HR.OOM);assert.ok(names.includes('activationFinishLocal'));
});
test('trapped local child retains accepted claim without guessed cleanup',async()=>{
 const f=fixture();f.r.registrations.set(7,{cookie:7,id:'r',object:200});const names=[];
 f.t.call=name=>{names.push(name);return name==='activationLocal'?{cookie:7,registration:'r',ticket:'j'}:null;};
 f.m.qi=async()=>{throw Error('trapped child');};
 await assert.rejects(f.r.activate('create',[100,0,4,120,300]),/trapped child/);
 assert.ok(!names.includes('activationFinishLocal'));assert.deepEqual(f.released,[]);
});
test('actual CreateProcess call receives original suffix and owns both handles',async()=>{
 const f=fixture();f.c.invoke=async(api,args)=>{
  if(api===1){assert.equal(args.length,10);assert.equal(args[0],0);assert.equal(f.c.word(args[8]),68);
   const end=f.memory.indexOf(0,args[1]);assert.equal(f.memory.toString('latin1',args[1],end),'"C:\\Program Files\\server.exe" --token=x -Embedding');
   f.c.putWord(args[9],88);f.c.putWord(args[9]+4,99);return 1;}
  f.events.push(['close',args[0]]);return 1;
 };
 assert.equal(await f.r.launch('"C:\\Program Files\\server.exe" --token=x -Embedding'),88);
 assert.deepEqual(f.events,[['close',99]]);assert.equal(f.freed.length,1);
});
test('malformed process information closes acquired process handle',async()=>{
 const f=fixture();f.c.invoke=async(api,args)=>{if(api===1){f.c.putWord(args[9],88);return 1;}f.events.push(['close',args[0]]);return 1;};
 await assert.rejects(f.r.launch('server -Embedding'),HResult);assert.deepEqual(f.events,[['close',88]]);assert.equal(f.freed.length,1);
});
test('trapped CreateProcess continuation retains its scratch allocation',async()=>{
 const f=fixture();f.c.invoke=async()=>{throw Error('ABI fault');};
 await assert.rejects(f.r.launch('server -Embedding'),/ABI fault/);assert.deepEqual(f.freed,[]);
});
test('delivered OBJREF is finalized after ordinary unmarshal failure',async()=>{
 const f=fixture(),names=[];
 f.t.call=name=>{names.push(name);if(name==='activationBegin')return {ticket:'j'};if(name==='activationPoll')return {hresult:0,reference:{opaque:true}};return null;};
 f.r.proxy.unmarshalReference=async()=>HR.NOINTERFACE;
 assert.equal(await f.r.activate('create',[100,0,4,120,300]),HR.NOINTERFACE);
 assert.ok(names.includes('activationFinish'));assert.ok(!names.includes('activationCancel'));
});
test('trapped unmarshal preserves delivered packet until explicit retirement',async()=>{
 const f=fixture(),names=[];
 f.t.call=name=>{names.push(name);if(name==='activationBegin')return {ticket:'j'};if(name==='activationPoll')return {hresult:0,reference:{opaque:true}};return null;};
 f.r.proxy.unmarshalReference=async()=>{throw Error('nested ABI fault');};
 await assert.rejects(f.r.activate('create',[100,0,4,120,300]),/nested ABI fault/);
 assert.ok(!names.includes('activationFinish'));assert.ok(!names.includes('activationCancel'));
});
test('SINGLEUSE duplicate starts fresh claim and closes every acquired launch handle',async()=>{
 const f=fixture(),commands=[],closed=[];let polls=0;
 f.r.server=()=> 'server.exe --token=x -Embedding';
 f.r.launch=async command=>{commands.push(command);return commands.length===1?88:99;};
 f.r.exited=async()=>false;f.c.invoke=async(api,args)=>{assert.equal(api,2);closed.push(args[0]);return 1;};
 f.t.call=name=>{if(name==='activationBegin')return {ticket:'j',launch:'initial'};
  if(name==='activationPoll')return ++polls===1?{pending:true,launch:'second',command:'server.exe --token=x -Embedding'}:{hresult:HR.NOINTERFACE};return null;};
 assert.equal(await f.r.activate('create',[100,0,4,120,300]),HR.NOINTERFACE);
 assert.deepEqual(commands,['server.exe --token=x -Embedding','server.exe --token=x -Embedding']);
 assert.deepEqual(closed,[88,99]);
});
test('class-object request QIs the registered object directly before marshaling',async()=>{
 const f=fixture(),asked=[],completed=[];let taken=false;
 const iid='ab'.repeat(16),reference={iid,opaque:'actual-model-reference'};
 f.r.registrations.set(7,{cookie:7,id:'r',object:200});
 f.t.call=(name,args)=>{if(name==='activationTake'){if(taken)return null;taken=true;return {cookie:7,registration:'r',ticket:'j',iid,kind:'class'};}
  if(name==='activationComplete'){completed.push(args);return true;}return null;};
 f.m.qi=async(object,wanted)=>{asked.push([object,wanted]);return {hr:0,pointer:555};};
 f.m.marshalReference=async(address,object)=>{assert.equal(f.m.read(address,16).length,16);assert.equal(object,555);return {hresult:0,reference};};
 await f.r.drain();assert.deepEqual(asked,[[200,iid]]);assert.deepEqual(f.released,[555]);
 assert.equal(completed[0].hresult,0);assert.equal(completed[0].reference,reference);
});
test('creation QIs real factory and calls its CreateInstance before marshaling',async()=>{
 const f=fixture(),calls=[];let taken=false;
 const iid='ab'.repeat(16),reference={iid,opaque:'actual-model-reference'};
 f.r.registrations.set(7,{cookie:7,id:'r',object:200});
 f.t.call=(name,args)=>{if(name==='activationTake'){if(taken)return null;taken=true;return {cookie:7,registration:'r',ticket:'j',iid,kind:'create'};}
  if(name==='activationComplete')return true;return null;};
 f.m.qi=async(object,wanted)=>{assert.equal(object,200);assert.equal(wanted,'0100000000000000c000000000000046');return {hr:0,pointer:444};};
 f.c.call=async(object,index,args)=>{calls.push([object,index]);assert.equal(args[0],0);f.c.putWord(args[2],555);return 0;};
 f.m.marshalReference=async(address,object)=>{assert.equal(object,555);assert.deepEqual(calls,[[444,3]]);return {hresult:0,reference};};
 await f.r.drain();assert.deepEqual(f.released,[555,444]);
});
test('deferred revoke releases after authority cancels queued work without invocation',async()=>{
 const f=fixture();f.r.registrations.set(7,{cookie:7,id:'r',object:200,revoked:true});
 f.t.call=name=>name==='classRevoke'?0:null;
 await f.r.drain();assert.deepEqual(f.released,[200]);assert.equal(f.r.registrations.size,0);
 await f.r.drain();assert.deepEqual(f.released,[200]);
});
test('successful nonzero factory HRESULT survives client unmarshaling',async()=>{
 const f=fixture();f.t.call=name=>{if(name==='activationBegin')return {ticket:'j'};
  if(name==='activationPoll')return {hresult:1,reference:{opaque:true}};return null;};
 f.r.proxy.unmarshalReference=async()=>0;
 assert.equal(await f.r.activate('create',[100,0,4,120,300]),1);
});
test('successful nonzero factory HRESULT survives server marshaling',async()=>{
 const f=fixture();let taken=false,completed;
 f.r.registrations.set(7,{cookie:7,id:'r',object:200});
 f.t.call=(name,args)=>{if(name==='activationTake'){if(taken)return null;taken=true;return {cookie:7,registration:'r',ticket:'j',iid:'ab'.repeat(16),kind:'create'};}
  if(name==='activationComplete'){completed=args;return true;}return null;};
 f.c.call=async(object,index,args)=>{f.c.putWord(args[2],555);return 1;};
 f.m.marshalReference=async()=>({hresult:0,reference:{opaque:true}});
 await f.r.drain();assert.equal(completed.hresult,1);
});

}
if(require.main===module&&process.argv.includes('--activation-state-tests'))activationStateTests();
if(require.main===module&&process.argv.includes('--scheduler-tests'))schedulerTests();
