'use strict';

// Preparation is explicit. Loading this file neither launches a guest nor
// registers a class. The separate-process fixture must qualify independently
// of the main/Worker IStream contract checks.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

// Independent byte decoder for test assertions. Never resolves an object or
// imports a process-local address from the marshaled bytes.
function inspectStandard(bytes) {
  const b = Buffer.from(bytes);
  if (b.length < 68) throw new Error('truncated OBJREF_STANDARD');
  if (b.readUInt32LE(0) !== 0x574f454d || b.readUInt32LE(4) !== 1)
    throw new Error('expected OBJREF_STANDARD');
  if (b.subarray(8, 24).every(x => !x)) throw new Error('GUID_NULL object IID');
  const entries = b.readUInt16LE(64), security = b.readUInt16LE(66);
  if (entries > 4096 || security > entries || b.length !== 68 + entries * 2)
    throw new Error('invalid DUALSTRINGARRAY extent');
  if (entries && (!security || b.readUInt16LE(68 + (security - 1) * 2) ||
      b.readUInt16LE(68 + (entries - 1) * 2)))
    throw new Error('unterminated DUALSTRINGARRAY');
  return { iid: b.subarray(8, 24).toString('hex'), flags: b.readUInt32LE(24),
    publicRefs: b.readUInt32LE(28), oxid: b.readBigUInt64LE(32).toString(16),
    oid: b.readBigUInt64LE(40).toString(16), ipid: b.subarray(48, 64).toString('hex'),
    entries, security, bytes: b.length };
}

const actualAutomationRegistration = String.raw`
P API LoadLibraryA(const char*);P API GetProcAddress(P,const char*);U API FreeLibrary(P);
H API CoRegisterPSClsid(const GUID*,const GUID*);
H API CoGetPSClsid(const GUID*,GUID*);
static P automationModule;static U automationCookie;
void registerActualAutomation(void){
 typedef H(CALL*GetClass)(const GUID*,const GUID*,P*);GetClass get;P ps=0;H hr;GUID resolved;
 static const GUID psClass={0x20420,0,0,{0xc0,0,0,0,0,0,0,0x46}};
 static const GUID psIID={0xd5f569d0,0x593b,0x101a,{0xb5,0x69,8,0,0x2b,0x2d,0xbf,0x7a}};
 automationModule=LoadLibraryA("oleaut32.dll");if(!automationModule)ExitProcess(180);
 get=(GetClass)GetProcAddress(automationModule,"DllGetClassObject");if(!get)ExitProcess(181);
 hr=get(&psClass,&psIID,&ps);if(hr||!ps)ExitProcess(182);
 hr=CoRegisterClassObject(&psClass,ps,1,1,&automationCookie);
 ((Unknown*)ps)->v->release(ps);if(hr||!automationCookie)ExitProcess(183);
 if(CoRegisterPSClsid(&dispatchIID,&psClass)||CoGetPSClsid(&dispatchIID,&resolved)||!equal(&resolved,&psClass))ExitProcess(184);
}
void finishActualAutomation(void){
 if(automationCookie){if(CoRevokeClassObject(automationCookie))ExitProcess(185);automationCookie=0;}
 FreeLibrary(automationModule);
}
`;

const streamChecks = String.raw`
H API CoMarshalInterface(P,const GUID*,P,U,P,U);
H API CoUnmarshalInterface(P,const GUID*,P*);H API CoReleaseMarshalData(P);
void API OutputDebugStringA(const char*);
P API CreateThread(P,U,P,P,U,U*);U API GetExitCodeThread(P,U*);
typedef struct Stream Stream;
typedef struct {H(CALL*qi)(Stream*,const GUID*,P*);U(CALL*add)(Stream*);U(CALL*release)(Stream*);
 H(CALL*read)(Stream*,P,U,U*);H(CALL*write)(Stream*,P,U,U*);} SV;
struct Stream {const SV*v;U refs,adds,releases,position,length,limit,reads,writes,delay;H status;unsigned char bytes[4096];};
static const GUID streamIID={12,0,0,{0xc0,0,0,0,0,0,0,0x46}};
static const SV sv;static volatile U completed;
void check(int yes,U code){if(!yes)ExitProcess(code);}
H CALL sq(Stream*s,const GUID*iid,P*out){if(!out)return (H)0x80004003;*out=0;
 if(!equal(iid,&unknown)&&!equal(iid,&streamIID))return (H)0x80004002;
 *out=s;s->refs++;s->adds++;return 0;}
U CALL sa(Stream*s){s->adds++;return ++s->refs;}U CALL sr(Stream*s){s->releases++;return --s->refs;}
H CALL sx(Stream*s,P data,U n,U*count,U writing){U i,take=n;unsigned char*b=data;
 if(writing)s->writes++;else s->reads++;if(count)*count=0;
 if(n&&!data)return (H)0x80030009;if(s->delay)Sleep(20);
 if(take>s->limit)take=s->limit;
 if(s->position>4096)return (H)0x80030057;
 if(take>4096-s->position)take=4096-s->position;
 if(!writing&&s->position>s->length)return (H)0x8003001e;
 if(!writing&&take>s->length-s->position)take=s->length-s->position;
 for(i=0;i<take;i++){if(writing)s->bytes[s->position+i]=b[i];else b[i]=s->bytes[s->position+i];}
 s->position+=take;if(writing&&s->length<s->position)s->length=s->position;if(count)*count=take;
 if(s->status)return s->status;return take<n?1:0;
}
H CALL sd(Stream*s,P b,U n,U*c){return sx(s,b,n,c,0);}H CALL sw(Stream*s,P b,U n,U*c){return sx(s,b,n,c,1);}
static const SV sv={sq,sa,sr,sd,sw};
void initStream(Stream*s){U i;unsigned char*b=(unsigned char*)s;for(i=0;i<sizeof(*s);i++)b[i]=0;
 s->v=&sv;s->refs=1;s->limit=4096;}
U u32(const unsigned char*b){return (U)b[0]|((U)b[1]<<8)|((U)b[2]<<16)|((U)b[3]<<24);}
void set32(unsigned char*b,U v){U i;for(i=0;i<4;i++)b[i]=(unsigned char)(v>>(i*8));}
void checkWire(Stream*s){U i,any=0,entries,security;
 check(s->length>=68&&s->length<=4096,140);
 check(u32(s->bytes)==0x574f454d&&u32(s->bytes+4)==1,141);
 for(i=0;i<16;i++)check(s->bytes[8+i]==((const unsigned char*)&dispatchIID)[i],142);
 for(i=32;i<64;i++)any|=s->bytes[i];check(any!=0,143);
 entries=s->bytes[64]|((U)s->bytes[65]<<8);security=s->bytes[66]|((U)s->bytes[67]<<8);
 check(entries<=2014&&security<=entries&&s->length==68+2*entries,144);
}
// Verify the six-argument public ABI independently of compiler assumptions.
__attribute__((naked)) H CALL checkedMarshal(P stream,const GUID*iid,P object,U context,P data,U flags){
 __asm__ volatile("pushl %ebx\n pushl %esi\n pushl %edi\n pushl %ebp\n"
  "movl $0x13572468,%ebx\n movl $0x24681357,%esi\n movl $0x76543210,%edi\n movl %esp,%ebp\n"
  "pushl 40(%ebp)\n pushl 36(%ebp)\n pushl 32(%ebp)\n pushl 28(%ebp)\n pushl 24(%ebp)\n pushl 20(%ebp)\n"
  "calll *\"__imp__CoMarshalInterface@24\"\n"
  "cmpl %esp,%ebp\n jne 1f\n cmpl $0x13572468,%ebx\n jne 1f\n"
  "cmpl $0x24681357,%esi\n jne 1f\n cmpl $0x76543210,%edi\n jne 1f\n"
  "jmp 2f\n 1: movl $0x8004fffd,%eax\n 2: movl %ebp,%esp\n popl %ebp\n popl %edi\n popl %esi\n popl %ebx\n retl $24");
}
void initObject(void){object.v=(const UV*)&dispatchV;object.refs=1;instances=1;created=0;}
void invokePID(P p){GUID nil={0};PARAMS args={0};VARIANT value={0};U bad=0;DV*v=*(DV**)p;
 check(v->invoke(p,1,&nil,0,2,&args,&value,0,&bad)==0&&value.vt==3&&
   (U)value.value.number==GetCurrentProcessId(),145);}
U CALL exercise(P unused){Stream s;P result=0;H hr;U i,refs,before;GUID nil={0};
 check(CoInitialize(0)>=0,146);registerActualAutomation();initObject();initStream(&s);s.delay=1;
 hr=checkedMarshal(&s,&dispatchIID,&object,0,0,0);check(hr==0,147);checkWire(&s);
 check(object.refs>1,148);or(&object);check(object.refs>0,149);
 s.position=0;check(CoUnmarshalInterface(&s,&dispatchIID,&result)==0&&result!=0,150);
 invokePID(result);((Unknown*)result)->v->release(result);check(object.refs==0,151);
 check(s.refs==1&&s.adds==s.releases,152);
 // A normal packet owns exactly one transfer and cannot be replayed.
 s.position=0;result=(P)0x1234;hr=CoUnmarshalInterface(&s,&dispatchIID,&result);
 check(hr<0&&!result,153);
 // An abandoned normal packet releases its real object ownership.
 initObject();initStream(&s);check(checkedMarshal(&s,&dispatchIID,&object,0,0,0)==0,154);
 or(&object);check(object.refs>0,155);s.position=0;check(CoReleaseMarshalData(&s)==0,156);check(!object.refs,157);
 // Table-strong data remains usable until explicitly released, with every
 // returned interface owning a distinct reference on the actual object.
 initObject();initStream(&s);check(checkedMarshal(&s,&dispatchIID,&object,0,0,1)==0,158);checkWire(&s);
 or(&object);for(i=0;i<2;i++){s.position=0;result=0;
  check(CoUnmarshalInterface(&s,i?&dispatchIID:&nil,&result)==0&&result,159);invokePID(result);
  ((Unknown*)result)->v->release(result);check(object.refs>0,160);}
 s.position=0;check(CoReleaseMarshalData(&s)==0&&!object.refs,161);
 // Short and failing streams must not leave exported strong references.
 for(i=0;i<4;i++){initObject();initStream(&s);s.limit=i?i:4096;s.status=i?0:(H)0x80030070;
  hr=checkedMarshal(&s,&dispatchIID,&object,0,0,0);check(hr==(H)(i?0x8003001d:0x80030070),162);
  check(object.refs==1,163);or(&object);}
 // Validate all truncated prefixes before looking up any remote identity.
 initObject();initStream(&s);check(checkedMarshal(&s,&dispatchIID,&object,0,0,0)==0,164);
 before=s.length;for(i=0;i<before;i++){s.length=i;s.position=0;result=(P)0x1234;
  hr=CoUnmarshalInterface(&s,&dispatchIID,&result);check(hr==(H)0x8003001e&&!result,165);}
 s.length=before;s.position=0;s.status=(H)0x80030070;result=(P)0x1234;
 check(CoUnmarshalInterface(&s,&dispatchIID,&result)==(H)0x80030070&&!result,177);
 s.status=0;s.position=0;s.bytes[0]^=1;result=(P)0x1234;
 check(CoUnmarshalInterface(&s,&dispatchIID,&result)==(H)0x8001011d&&!result,178);s.bytes[0]^=1;
 s.position=0;result=(P)0x1234;check(CoUnmarshalInterface(&s,&unsupported,&result)==(H)0x80004001&&!result,179);
 s.position=0;check(CoReleaseMarshalData(&s)==0,166);check(object.refs==1,167);or(&object);
 // Invalid context/flags/reserved data and unsupported IID leave no ownership.
 initObject();initStream(&s);refs=object.refs;
 check(checkedMarshal(&s,&dispatchIID,&object,0,(P)1,0)<0,168);
 check(checkedMarshal(&s,&dispatchIID,&object,0,0,0x80000000)<0,169);
 check(checkedMarshal(&s,&unsupported,&object,0,0,0)<0,170);
 check(checkedMarshal(&s,&dispatchIID,&object,1,0,0)==(H)0x80004001,175);
 check(checkedMarshal(&s,&dispatchIID,&object,3,0,0)==(H)0x80004001,180);
 check(checkedMarshal(&s,&dispatchIID,&object,0,0,2)<0,176);
 check(object.refs==refs,171);or(&object);
 finishActualAutomation();CoUninitialize();completed=1;OutputDebugStringA("standard-interface.stream-lifetime=PASS\n");return 0;
}
void start(void){
#ifdef RUN_WORKER
 U id=0,code=259;P t=CreateThread(0,0,exercise,0,0,&id);check(t&&id,172);
 check(WaitForSingleObject(t,20000)==0,173);check(GetExitCodeThread(t,&code)&&!code&&completed,174);
 CloseHandle(t);OutputDebugStringA("standard-interface.stream-lifetime=PASS\n");
#else
 exercise(0);
#endif
 ExitProcess(0);
}
`;

function standardStreamSource() {
  const prior = require('./test-sims-localserver-channel-implementation.cjs');
  return prior.deepServerSource.slice(0, prior.deepServerSource.indexOf('void start(void){')) + actualAutomationRegistration + streamChecks;
}

// Strengthen the existing genuine-OLEAUT loopback: invoke the returned
// interface after disconnecting/releasing the original proxy and stub.
function interfaceLoopbackSource() {
  const prior = require('./test-sims-ole32-stream-marshaling.cjs');
  return prior.actualLoopbackSource()
    .replace('void start(void){', actualAutomationRegistration + '\nvoid start(void){')
    .replace('get=(GetClass)GetProcAddress(module,"DllGetClassObject");',
      'registerActualAutomation();get=(GetClass)GetProcAddress(module,"DllGetClassObject");')
    .replace('((Unknown*)value.value.pointer)->v->release(value.value.pointer);',
      'P returned=value.value.pointer;')
    .replace('((Unknown*)ps)->v->release(ps);or(&object);FreeLibrary(module);CoUninitialize();', String.raw`
 ((Unknown*)ps)->v->release(ps);or(&object);
 if(CoRevokeClassObject(automationCookie))ExitProcess(185);automationCookie=0;
 value.vt=0;value.value.pointer=0;
 hr=(*(DV**)returned)->invoke(returned,1,&nil,0,2,&params,&value,0,&bad);
 report("returned.afterOriginalRelease.Invoke",hr);
 if(hr||value.vt!=3||(U)value.value.number!=GetCurrentProcessId())ExitProcess(134);
 ((Unknown*)returned)->v->release(returned);finishActualAutomation();FreeLibrary(module);CoUninitialize();`)
    .replace('sends!=4', 'sends!=4');
}


// The initial OBJREF is transported as actual guest-produced hex on the
// authored server's bounded debug messages and the client's command line. Calls and
// returned interfaces still traverse the authenticated owned byte channel in
// distinct native processes/memories. This is not LocalServer activation.
function remoteSources() {
  const prefix = standardStreamSource().split('U CALL exercise(P unused)')[0];
  const server = prefix + String.raw`
U API GetTickCount(void);
void start(void){
 Stream stream;U i,j,k,began;char line[128];static const char hex[]="0123456789abcdef";
 static const char marker[]="standard-remote.objref.0=";
 if(!embeddingCommand())ExitProcess(183);if(CoInitialize(0)<0)ExitProcess(184);
 registerActualAutomation();initObject();initStream(&stream);created=1;
 retiredEvent=CreateEventA(0,1,0,"Local\\wa-standard-remote-retired");if(!retiredEvent)ExitProcess(185);
 check(CoMarshalInterface(&stream,&dispatchIID,&object,0,0,0)==0,186);checkWire(&stream);
 or(&object);check(object.refs>0,187);
 for(k=0;k<2;k++){
  for(i=0;marker[i];i++)line[i]=marker[i];line[i-2]=(char)('0'+k);
  for(j=k*34;j<(k+1)*34;j++){line[i++]=hex[stream.bytes[j]>>4];line[i++]=hex[stream.bytes[j]&15];}
  line[i++]='\n';line[i]=0;OutputDebugStringA(line);
 }
 began=GetTickCount();while(object.refs&&(U)(GetTickCount()-began)<30000)Sleep(5);
 if(object.refs)ExitProcess(188);CloseHandle(retiredEvent);
 OutputDebugStringA("standard-remote.server-final-refs=0\n");
 finishActualAutomation();CoUninitialize();ExitProcess(0);
}
`;
  const client = prefix + String.raw`
U nibble(char c){if(c>='0'&&c<='9')return c-'0';if(c>='a'&&c<='f')return c-'a'+10;ExitProcess(189);return 0;}
void start(void){
 Stream stream;const char*cmd=GetCommandLineA(),*last=cmd;U i,n=0,bad=0;H hr;
 P remote=0,returned=0,u1=0,u2=0;DV*v;GUID nil={0};PARAMS params={0};VARIANT arg={0},value={0};
 static const W text[]={65,0,66,0x3bb};
 if(CoInitialize(0)<0)ExitProcess(190);registerActualAutomation();initStream(&stream);
 while(*cmd){if(*cmd==' ')last=cmd+1;cmd++;}while(last[n])n++;
 check(n>=136&&n<=8192&&!(n&1),191);
 for(i=0;i<n/2;i++)stream.bytes[i]=(unsigned char)((nibble(last[2*i])<<4)|nibble(last[2*i+1]));
 stream.length=n/2;hr=CoUnmarshalInterface(&stream,&dispatchIID,&remote);check(!hr&&remote,192);
 v=*(DV**)remote;hr=v->invoke(remote,1,&nil,0,2,&params,&value,0,&bad);
 check(!hr&&value.vt==3&&value.value.number&&(U)value.value.number!=GetCurrentProcessId(),193);
 OutputDebugStringA("standard-remote.distinct-server-pid=PASS\n");
 arg.vt=8;arg.value.text=SysAllocStringLen(text,4);check(arg.value.text!=0,194);params.args=&arg;params.count=1;value.vt=0;
 hr=v->invoke(remote,2,&nil,0,1,&params,&value,0,&bad);check(!hr&&value.vt==8&&value.value.text&&SysStringLen(value.value.text)==4,195);
 for(i=0;i<4;i++)check(value.value.text[i]==text[i],196);SysFreeString(arg.value.text);SysFreeString(value.value.text);
 OutputDebugStringA("standard-remote.deep-BSTR=PASS\n");
 params.args=0;params.count=0;value.vt=0;value.value.pointer=0;
 hr=v->invoke(remote,3,&nil,0,2,&params,&value,0,&bad);check(!hr&&value.vt==9&&value.value.pointer,197);returned=value.value.pointer;
 check(!((Unknown*)remote)->v->qi(remote,&unknown,&u1)&&!((Unknown*)returned)->v->qi(returned,&unknown,&u2)&&u1&&u1==u2,198);
 ((Unknown*)u1)->v->release(u1);((Unknown*)u2)->v->release(u2);((Unknown*)remote)->v->release(remote);
 value.vt=0;value.value.pointer=0;hr=(*(DV**)returned)->invoke(returned,1,&nil,0,2,&params,&value,0,&bad);
 check(!hr&&value.vt==3&&value.value.number&&(U)value.value.number!=GetCurrentProcessId(),199);
 OutputDebugStringA("standard-remote.returned-after-original-release=PASS\n");
 ((Unknown*)returned)->v->release(returned);finishActualAutomation();CoUninitialize();
 OutputDebugStringA("standard-remote.client=PASS\n");ExitProcess(0);
}
`;
  const workerClient = client.replace('void start(void){', 'U CALL remoteClient(P unused){')
    .replace('Stream stream;const char*cmd=GetCommandLineA()', 'Stream stream;const char*cmd=(const char*)unused')
    .replace('OutputDebugStringA("standard-remote.client=PASS\\n");ExitProcess(0);',
      'OutputDebugStringA("standard-remote.client=PASS\\n");completed=1;return 0;') + String.raw`
void start(void){U id=0,code=259;P thread=CreateThread(0,0,remoteClient,GetCommandLineA(),0,&id);
 check(thread&&id,200);check(WaitForSingleObject(thread,20000)==0,201);
 check(GetExitCodeThread(thread,&code)&&!code&&completed,202);CloseHandle(thread);
 OutputDebugStringA("standard-remote.worker-checked-all=PASS\n");ExitProcess(0);}
`;
  return { server, client, workerClient };
}

function prepare(directory) {
  const cp = require('node:child_process');
  const out = path.resolve(directory);fs.mkdirSync(out, { recursive: true });
  const put = (n, b) => fs.writeFileSync(path.join(out, n), b, { flag: 'wx' });
  let sequence = 0;
  const run = (command, args) => {
    const r = cp.spawnSync(command, args, { encoding: 'utf8', timeout: 30000 });
    const label = 'tool-' + ++sequence;
    put(label + '.stdout.log', r.stdout || '');put(label + '.stderr.log', r.stderr || '');
    put(label + '-wait.json', JSON.stringify({ command, pid: r.pid, exit: r.status,
      signal: r.signal, actualWait: r.status !== null, stdoutEOF: !r.error,
      stderrEOF: !r.error, error: r.error ? String(r.error) : null }) + '\n');
    if (r.error || r.status) throw new Error(command + ': ' + (r.stderr || r.error));
  };
  const libraries = {
    kernel32: ['ExitProcess@4','Sleep@4','OutputDebugStringA@4','GetCurrentProcessId@0',
      'GetTickCount@0','GetCommandLineA@0','CreateThread@24','GetExitCodeThread@8','WaitForSingleObject@8','CloseHandle@4',
      'CreateEventA@16','SetEvent@4','LoadLibraryA@4','GetProcAddress@8','FreeLibrary@4',
      'CreateFileA@28','WriteFile@20','GetStdHandle@4','GetModuleFileNameA@12'],
    ole32: ['CoInitialize@4','CoInitializeEx@8','CoUninitialize@0','CoMarshalInterface@24',
      'CreateStreamOnHGlobal@12','CoUnmarshalInterface@12','CoReleaseMarshalData@4','CoMarshalHresult@8','CoUnmarshalHresult@8',
      'CoGetPSClsid@8','CoRegisterPSClsid@8','CoGetClassObject@20','CoCreateInstance@20','CoRegisterClassObject@20','CoRevokeClassObject@4',
      'CoTaskMemAlloc@4','CoTaskMemFree@4'],
    oleaut32: ['SysAllocStringLen@8','SysFreeString@4','SysStringLen@4','LoadTypeLib@8','RegisterTypeLib@12'],
    advapi32: ['RegCreateKeyA@12','RegSetValueA@20','RegCloseKey@4'],
  };
  for (const [dll, names] of Object.entries(libraries)) {
    put(dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');
    run('llvm-dlltool',['-m','i386','-k','-d',path.join(out,dll+'.def'),'-l',path.join(out,dll+'.lib')]);
  }
  const prior = require('./test-sims-localserver-channel-implementation.cjs');
  const remote = remoteSources();
  const hresult = require('./test-sims-ole32-stream-marshaling.cjs').streamSource;
  const candidates = [
    ['hresult-main', hresult, []],
    ['hresult-worker', hresult, ['-DRUN_WORKER=1']],
    ['standard-main', standardStreamSource(), []],
    ['standard-worker', standardStreamSource(), ['-DRUN_WORKER=1']],
    ['oleaut-interface-loopback', interfaceLoopbackSource(), []],
    ['standard-remote-server', remote.server, []],
    ['standard-remote-client', remote.client, []],
    ['standard-remote-client-worker', remote.workerClient, []],
    ['standard-deep-server', prior.deepServerSource, []],
    ['standard-deep-client', prior.deepClientSource, []],
  ];
  const inputs = [];
  for (const [name, source, flags] of candidates) {
    put(name+'.c', source);
    run('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-mno-stack-arg-probe','-fno-builtin',
      '-O1',...flags,'-c',path.join(out,name+'.c'),'-o',path.join(out,name+'.obj')]);
    run('ld',['-mi386pe','--entry','_start','--subsystem','console','--disable-dynamicbase',
      '--no-insert-timestamp','-o',path.join(out,name+'.exe'),path.join(out,name+'.obj'),
      ...Object.keys(libraries).map(dll=>path.join(out,dll+'.lib'))]);
    inputs.push({ name, sha256:sha(fs.readFileSync(path.join(out,name+'.exe'))), sourceSHA256:sha(Buffer.from(source)) });
  }
  put('prepared.json',JSON.stringify({inputs,nativeExecution:false},null,2)+'\n');return inputs;
}

module.exports = { inspectStandard, streamChecks, standardStreamSource, interfaceLoopbackSource, remoteSources, prepare };

if (require.main === module) {
  const { test } = require('node:test');
  const assert = require('node:assert/strict');
  const golden = Buffer.from('4d454f57010000000004020000000000c000000000000046'+
    '0000000001000000010203040506070811121314151617182122232425262728292a2b2c2d2e2f3000000000','hex');
  test('independent standard OBJREF oracle decodes exact 68-byte vector',()=>{
    assert.equal(golden.length,68);
    assert.deepEqual(inspectStandard(golden),{
      iid:'0004020000000000c000000000000046',flags:0,publicRefs:1,
      oxid:'807060504030201',oid:'1817161514131211',ipid:'2122232425262728292a2b2c2d2e2f30',
      entries:0,security:0,bytes:68,
    });
  });
  test('independent oracle refuses every truncated prefix and malformed extent',()=>{
    for(let i=0;i<golden.length;i++)assert.throws(()=>inspectStandard(golden.subarray(0,i)));
    for(const [at,value] of [[0,0],[4,2],[64,0xffff],[66,1]]) {
      const bad=Buffer.from(golden);bad.writeUInt16LE(value,at);assert.throws(()=>inspectStandard(bad));
    }
    const nil=Buffer.from(golden);nil.fill(0,8,24);assert.throws(()=>inspectStandard(nil));
  });
}

// Unit checks complement the separately supervised authored native fixtures.
if (require.main === module) {
  const {test}=require('node:test');
  const assert=require('node:assert/strict');
  const {OwnedComAuthority,MAX_BYTES}=require('../lib/com-owned-channel');
const iid='0004020000000000c000000000000046';
const descriptor = (generation='1',thread=1)=>({thread,generation,source:'a'.repeat(64),module:'b'.repeat(64)});
const throwsCode = (fn,code)=>assert.throws(fn,e=>e.code===code);
function fixture(mode=0) {
  const a = new OwnedComAuthority(), server=a.connect('server'),client=a.connect('client');
  const so=a.registerOwner(server,descriptor()),co=a.registerOwner(client,descriptor());
  const ref=a.prepareExport(server,so,iid,mode,'c'.repeat(32));
  a.commitExport(server,so,ref);return {a,server,client,so,co,ref};
}
test('normal transfer has single consumption and real exporter retirement acknowledgement',()=>{
  const {a,server,client,so,co,ref}=fixture();
  assert.equal(ref.publicRefs,1);
  const proxy=a.consume(client,co,ref);
  throwsCode(()=>a.consume(client,co,ref),'EDISCONNECTED');
  assert.equal(a.take(server,so),null);
  a.releaseProxy(client,co,ref,proxy.token);
  const retire=a.take(server,so);assert.equal(retire.kind,'retire');
  assert.equal(a.exports.size,1); // Actual owner Release has not acknowledged.
  a.complete(server,so,retire.ticket);assert.equal(a.exports.size,0);
  throwsCode(()=>a.complete(server,so,retire.ticket),'ESTALE');
});
test('table-strong packet and each client lease independently retain exporter',()=>{
  const {a,server,client,so,co,ref}=fixture(1);
  assert.equal(ref.publicRefs,0);const p=a.consume(client,co,ref),q=a.consume(client,co,ref);
  a.releaseData(server,so,ref);throwsCode(()=>a.consume(client,co,ref),'EDISCONNECTED');
  a.releaseProxy(client,co,ref,p.token);assert.equal(a.take(server,so),null);
  a.releaseProxy(client,co,ref,q.token);assert.equal(a.take(server,so).kind,'retire');
});
test('cross-memory byte request and reply never transmit guest addresses or alias buffers',()=>{
  const {a,server,client,so,co,ref}=fixture();const p=a.consume(client,co,ref);
  const clientMemory=new Uint8Array(128),serverMemory=new Uint8Array(256);
  clientMemory.set([0x41,0,0,0,0x42,0,0xbb,3],64);
  const ticket=a.submit(client,co,ref,p.token,{method:6,representation:0x10,flags:0,bytes:clientMemory.subarray(64,72)});
  clientMemory.fill(0);const request=a.take(server,so);
  assert.deepEqual(Object.keys(request).sort(),['bytes','flags','kind','method','reference','representation','ticket']);
  serverMemory.set(request.bytes,128);request.bytes.fill(0);
  assert.deepEqual([...serverMemory.subarray(128,136)],[65,0,0,0,66,0,187,3]);
  a.complete(server,so,ticket,{hresult:0,status:0,bytes:serverMemory.subarray(128,136)});serverMemory.fill(0);
  const reply=a.poll(client,co,ticket);assert.deepEqual([...reply.bytes],[65,0,0,0,66,0,187,3]);
  throwsCode(()=>a.poll(client,co,ticket),'ESTALE');
});
test('final proxy release while actual invocation runs waits for its completion',()=>{
  const {a,server,client,so,co,ref}=fixture();const p=a.consume(client,co,ref);
  const ticket=a.submit(client,co,ref,p.token,{method:6,representation:16,flags:0,bytes:new Uint8Array()});
  a.take(server,so);a.releaseProxy(client,co,ref,p.token);assert.equal(a.take(server,so),null);
  a.complete(server,so,ticket,{hresult:0,status:0,bytes:new Uint8Array()});
  assert.equal(a.take(server,so).kind,'retire');assert.equal(a.poll(client,co,ticket).hresult,0);
});
test('owner/source/module/generation replacements refuse old requests and identities',()=>{
  const {a,server,client,so,co,ref}=fixture();const p=a.consume(client,co,ref);
  const ticket=a.submit(client,co,ref,p.token,{method:6,representation:16,flags:0,bytes:new Uint8Array()});
  const request=a.take(server,so);assert.equal(request.ticket,ticket);
  for(const change of [{module:'d'.repeat(64)},{source:'e'.repeat(64)},{generation:'2'},{thread:2}])
    throwsCode(()=>a.complete(server,{...so,...change},ticket,{hresult:0,status:0,bytes:new Uint8Array()}),'ESTALE');
  a.retireOwner(server,so);throwsCode(()=>a.registerOwner(server,so),'ESTALE');
  const next=a.registerOwner(server,descriptor('2'));
  throwsCode(()=>a.complete(server,next,ticket,{hresult:0,status:0,bytes:new Uint8Array()}),'ESTALE');
  throwsCode(()=>a.poll(client,co,ticket),'EDISCONNECTED');
  throwsCode(()=>a.consume(client,co,ref),'EDISCONNECTED');
});
test('retired caller cannot receive late success or replay its request on a replacement',()=>{
  const {a,server,client,so,co,ref}=fixture();const p=a.consume(client,co,ref);
  const ticket=a.submit(client,co,ref,p.token,{method:6,representation:16,flags:0,bytes:new Uint8Array()});
  a.take(server,so);a.retireOwner(client,co);const next=a.registerOwner(client,descriptor('2'));
  a.complete(server,so,ticket,{hresult:0,status:0,bytes:new Uint8Array()});
  throwsCode(()=>a.poll(client,next,ticket),'ESTALE');assert.equal(a.take(server,so).kind,'retire');
});
test('preparation is not publication; abandoned/unsupported/oversized data is refused',()=>{
  const {a,server,client,so,co}=fixture();
  const ref=a.prepareExport(server,so,iid,0,'f'.repeat(32));
  throwsCode(()=>a.consume(client,co,ref),'EDISCONNECTED');a.abandonExport(server,so,ref);
  throwsCode(()=>a.commitExport(server,so,ref),'EDISCONNECTED');
  throwsCode(()=>a.prepareExport(server,so,iid,2,'f'.repeat(32)),'ENOTSUP');
  const valid=a.prepareExport(server,so,iid,0,'f'.repeat(32));a.commitExport(server,so,valid);
  const p=a.consume(client,co,valid);
  throwsCode(()=>a.submit(client,co,valid,p.token,{method:6,representation:16,flags:0,bytes:new Uint8Array(MAX_BYTES+1)}),'EINVAL');
  throwsCode(()=>a.submit(client,co,valid,p.token,{method:2,representation:16,flags:0,bytes:new Uint8Array()}),'EINVAL');
  throwsCode(()=>a.releaseProxy(server,so,valid,p.token),'ESTALE');
});

test('caller retirement after completion does not double-decrement active calls',()=>{
 const {a,server,client,so,co,ref}=fixture();const p=a.consume(client,co,ref);
 const ticket=a.submit(client,co,ref,p.token,{method:6,representation:16,flags:0,bytes:new Uint8Array()});
 a.take(server,so);a.complete(server,so,ticket,{hresult:0,status:0,bytes:new Uint8Array()});
 a.retireOwner(client,co);const retire=a.take(server,so);assert.equal(retire.kind,'retire');
 a.complete(server,so,retire.ticket);assert.equal(a.exports.size,0);assert.equal(a.requests.size,0);
});

}

if (require.main === module) {
 const {test}=require('node:test'),assert=require('node:assert/strict');
 const {check}=require('../tools/callback-ownership-census');
 test('new producer reviews retain exact hashes, shapes, kinds and duplicate refusal',()=>{
  const row={file:'lib/authored-com.js',name:'host-file',sha256:'a'.repeat(64),kind:'host-entry',
   reason:'Actual owner continuation; explicit retirement; ownership pending',ownership:'pending'};
  const base={version:1,entries:[]},review={version:1,revisions:[],additions:[row]};
  assert.deepEqual(check([row],base,review),[]);
  for(const change of [{sha256:'b'.repeat(64)},{writes:1}])
   assert.ok(check([{...row,...change}],base,review).some(x=>x.includes('changed producer')));
  assert.ok(check([row],base,{...review,additions:[{...row,kind:'UNREVIEWED'}]}).some(x=>x.includes('unreviewed')));
  assert.ok(check([row],{version:1,entries:[row]},review).some(x=>x.includes('duplicate')));
  assert.ok(check([row],base,{...review,additions:{}}).some(x=>x.includes('invalid producer additions')));
 });
}

if (require.main === module) {
 const {test}=require('node:test'),assert=require('node:assert/strict');
 test('authenticated socket transport preserves a separate COM lease across distinct connections',async()=>{
  const {ProcessDesktop}=require('../lib/process-desktop');
  const {ComOwnedTransport}=require('../lib/com-owned-transport');
  const server=new ProcessDesktop();let client;
  try {
   client=new ProcessDesktop({endpoint:server.endpoint});
   const descriptor={thread:1,generation:'1',source:'a'.repeat(64),module:'b'.repeat(64)};
   const s=new ComOwnedTransport(server,descriptor),c=new ComOwnedTransport(client,descriptor);
   const ref=s.prepare('0004020000000000c000000000000046',0,'c'.repeat(32));s.commit(ref);
   const lease=c.consume(ref);c.probe(ref,lease);
   const ticket=c.submit(ref,lease,{method:6,representation:16,flags:0,bytes:Uint8Array.from([65,0,66,0,187,3])});
   const call=s.take();assert.equal(call.ticket,ticket);assert.deepEqual([...call.bytes],[65,0,66,0,187,3]);
   s.complete(ticket,{hresult:0,status:0,bytes:call.bytes});assert.deepEqual([...c.poll(ticket).bytes],[65,0,66,0,187,3]);
   c.releaseProxy(lease);const release=s.take();assert.equal(release.kind,'retire');s.complete(release.ticket);
  } finally {if(client)await client.close();await server.close();}
 });
 test('production codec matches an independent exact OBJREF golden vector',()=>{
  const {encodeStandard,decodeStandard}=require('../lib/com-objref');
  const ref={iid:'0004020000000000c000000000000046',oxid:'0807060504030201',oid:'1817161514131211',
   ipid:'28272625242322213837363534333231',publicRefs:1};
  const golden=Buffer.from('4d454f57010000000004020000000000c0000000000000460000000001000000080706050403020118171615141312112827262524232221383736353433323100000000','hex');
  assert.deepEqual(Buffer.from(encodeStandard(ref)),golden);assert.deepEqual(decodeStandard(golden).reference,ref);
  for(let i=0;i<68;i++)assert.throws(()=>decodeStandard(golden.subarray(0,i)));
 });
}
