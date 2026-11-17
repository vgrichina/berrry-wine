'use strict';

// Authored native candidates. Merely importing this file does not compile or
// launch a guest, alter registration, or qualify an activation route.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const prior = require('./test-sims-genuine-localserver-activation.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// Extend the public IDispatch fixture with a returned interface. Echo alone
// cannot distinguish a buffer-only transport from an interface marshaler.
// The returned reference survives releasing the original proxy and factory.
const deepServerSource = prior.dispatchServerSource.replace(
  ' if(id==2&&flags==1)',
  ' if(id==3&&flags==2){if(p->count)return (H)0x8002000e;out->vt=9;out->value.pointer=self;oa(self);return 0;}\n if(id==2&&flags==1)')
  .replace('H hr;if(!out)', 'H hr;Sleep(20);if(!out)')
  .replace(' U i;unsigned char*b;', ' U i;unsigned char*b;Sleep(20);')
  .replace('void start(void){', String.raw`
P API GetCommandLineA(void);
int embeddingCommand(void){
 const char*cmd=GetCommandLineA();const char*last=cmd;U i=0;
 static const char expected[]="-Embedding";
 if(!cmd)return 0;
 while(*cmd){if(*cmd==' ')last=cmd+1;cmd++;}
 while(expected[i]&&last[i]==expected[i])i++;
 return !expected[i]&&!last[i];
}
void start(void){`)
  .replace('  if(CoInitializeEx(0,0)<0)', '  if(!embeddingCommand())ExitProcess(29);\n  if(CoInitializeEx(0,0)<0)');

const checkedInvokeSource = String.raw`
__attribute__((naked)) H CALL checkedInvoke(Unknown*self,long id,const GUID*iid,U locale,W flags,PARAMS*params,VARIANT*out,P exception,U*bad){
 __asm__ volatile("pushl %ebx\n pushl %esi\n pushl %edi\n pushl %ebp\n"
  "movl $0x13572468,%ebx\n movl $0x24681357,%esi\n movl $0x76543210,%edi\n movl %esp,%ebp\n"
  "pushl 52(%ebp)\n pushl 48(%ebp)\n pushl 44(%ebp)\n pushl 40(%ebp)\n pushl 36(%ebp)\n"
  "pushl 32(%ebp)\n pushl 28(%ebp)\n pushl 24(%ebp)\n pushl 20(%ebp)\n"
  "movl 20(%ebp),%eax\n movl (%eax),%eax\n calll *24(%eax)\n"
  "cmpl %esp,%ebp\n jne 1f\n cmpl $0x13572468,%ebx\n jne 1f\n"
  "cmpl $0x24681357,%esi\n jne 1f\n cmpl $0x76543210,%edi\n jne 1f\n"
  "jmp 2f\n 1: movl $0x8004fffd,%eax\n 2: movl %ebp,%esp\n popl %ebp\n popl %edi\n popl %esi\n popl %ebx\n retl $36");
}
`;

const deepClientSource = prior.dispatchClientSource.replace(
  '    SysFreeString(arg.value.text);SysFreeString(value.value.text);', String.raw`
    SysFreeString(arg.value.text);SysFreeString(value.value.text);
    params.args=0;params.count=0;value.vt=0;value.value.pointer=0;
    if(v->invoke(o,3,&nil,0,2,&params,&value,0,&bad)||value.vt!=9||!value.value.pointer)ExitProcess(46);
    {
      Unknown*returned=(Unknown*)value.value.pointer;
      DV*rv=(DV*)returned->v;
      o->v->release(o);f->v->release(f);f=0;
      value.vt=0;value.value.pointer=0;
      if(rv->invoke(returned,1,&nil,0,2,&params,&value,0,&bad)||value.vt!=3||!value.value.number||(U)value.value.number==GetCurrentProcessId())ExitProcess(47);
      o=returned;
    }`).replaceAll('o->v->release(o);f->v->release(f);',
    'o->v->release(o);if(f)f->v->release(f);')
  .replace('void start(void){', checkedInvokeSource + '\nvoid start(void){')
  .replaceAll('v->invoke(o,', 'checkedInvoke(o,')
  .replaceAll('rv->invoke(returned,', 'checkedInvoke(returned,');

// Native public-export probe: each bit reports an actually absent procedure.
// This diagnoses the standard-marshaler boundary, never remote activation.
const marshalExportsSource = prior.commonSource + String.raw`
P API LoadLibraryA(const char*);P API GetProcAddress(P,const char*);U API FreeLibrary(P);
void start(void){
 P module=LoadLibraryA("ole32.dll");U missing=0;
 if(!module)ExitProcess(80);
 if(!GetProcAddress(module,"CoMarshalInterface"))missing|=1;
 if(!GetProcAddress(module,"CoUnmarshalInterface"))missing|=2;
 if(!GetProcAddress(module,"CoMarshalHresult"))missing|=4;
 if(!GetProcAddress(module,"CoUnmarshalHresult"))missing|=8;
 FreeLibrary(module);ExitProcess(missing);
}
`;

// Resolve the genuine library's public user-defined return types. This is
// metadata for the future unchanged client, never a substitute implementation
// of an IKernel method.
const mediaShapeSource = prior.typeInfoSource.replace('void start(void){', String.raw`
typedef H(CALL*RefInfo)(P,U,P*);
void referenceShape(P info,const TD*type){
 U depth=0,i;P referent=0;P*rv;TA*a=0;H hr;
 while(type&&type->vt==26&&depth++<8)type=type->value.pointer;
 if(!type||type->vt!=29)return;
 hr=((RefInfo)(*(P**)info)[14])(info,type->value.href,&referent);
 report("reference.GetRefTypeInfo",hr);if(hr||!referent)ExitProcess(103);
 rv=*(P**)referent;hr=((Attr)rv[3])(referent,&a);
 if(hr||!a)ExitProcess(104);
 report("reference.kind",a->kind);report("reference.vtable",a->vtable);
 report("reference.IID.Data1",a->guid.a);report("reference.IID.Data2",a->guid.b);
 report("reference.IID.Data3",a->guid.c);
 for(i=0;i<8;i++)report("reference.IID.Data4",a->guid.d[i]);
 ((FreeAttr)rv[19])(referent,a);((Release)rv[2])(referent);
}
void start(void){`).replace('describe(&f->params[j].type,0);',
  'describe(&f->params[j].type,0);referenceShape(info,&f->params[j].type);');

// Reproduce the public call sequence in unchanged Setup's 0x405f89 and
// 0x406067 routines. The registrar and COM server are the genuine unchanged
// IKernel PE. This client never writes a registry value or launches Setup.
const kernelClientSource = prior.typeInfoSource.slice(0, prior.typeInfoSource.indexOf('void start(void){'))
  .replace('localserver-typeinfo.txt', 'localserver-channel-client.txt') + String.raw`
U API SetCurrentDirectoryA(const char*);U API CreateProcessA(const char*,char*,P,P,U,U,P,P,P,P);
U API WaitForSingleObject(P,U);U API GetExitCodeProcess(P,U*);U API CloseHandle(P);
typedef H(CALL*Query)(P,const GUID*,P*);
typedef H(CALL*Service)(P,const GUID*,const GUID*,P*);
void start(void){
 static const GUID kernel={0x91814ec0,0xb5f0,0x11d2,{0x80,0xb9,0,0x10,0x4b,0x1f,0x6c,0xea}};
 static const GUID mediaIID={0x91814ebf,0xb5f0,0x11d2,{0x80,0xb9,0,0x10,0x4b,0x1f,0x6c,0xea}};
 static const GUID providerIID={0xf4817e4b,0x04b6,0x11d3,{0x88,0x62,0,0xc0,0x4f,0x72,0xf3,3}};
 static const GUID infoIID={0xe1b9357f,0x24b9,0x11d3,{0x88,0xb2,0,0xc0,0x4f,0x72,0xf3,3}};
 static const GUID nil={0};
 static char registrar[]="\"C:\\Program Files\\Common Files\\InstallShield\\Engine\\6\\Intel 32\\IKernel.exe\" -RegServer";
 static U startup[17]={68},process[4];
 P media=0,provider=0,info=0;H hr;U code=259;
 if(!SetCurrentDirectoryA("D:\\Setup"))ExitProcess(105);
 if(CoInitialize(0)<0)ExitProcess(106);
 if(!CreateProcessA(0,registrar,0,0,0,0,0,0,startup,process))ExitProcess(107);
 if(WaitForSingleObject((P)process[0],10000))ExitProcess(108);
 if(!GetExitCodeProcess((P)process[0],&code)||code)ExitProcess(109);
 CloseHandle((P)process[0]);CloseHandle((P)process[1]);
 hr=CoCreateInstance(&kernel,0,4,&mediaIID,&media);
 report("client.CoCreateInstance.ISetupMedia",hr);report("client.mediaPresent",media!=0);
 if(hr<0||!media)ExitProcess(110);
 hr=((Query)(*(P**)media)[0])(media,&providerIID,&provider);
 report("client.QueryInterface.provider",hr);report("client.providerPresent",provider!=0);
 if(hr<0||!provider)ExitProcess(111);
 hr=((Service)(*(P**)provider)[3])(provider,&nil,&infoIID,&info);
 report("client.provider.QueryService.ISetupInfo",hr);report("client.infoPresent",info!=0);
 if(hr<0||!info)ExitProcess(112);
 ((Release)(*(P**)info)[2])(info);((Release)(*(P**)provider)[2])(provider);
 ((Release)(*(P**)media)[2])(media);CoUninitialize();ExitProcess(0);
}
`;

// Exercise the real automation proxy's wire ABI before attempting native
// transport integration. This deliberately stays in one process and is never
// counted as LocalServer32 activation or genuine IKernel qualification.
const loopbackSource = deepServerSource.slice(0, deepServerSource.indexOf('void start(void){')) +
  '\nP API CreateFileA(const char*,U,U,P,U,U,P);void API OutputDebugStringA(const char*);U API WriteFile(P,const char*,U,U*,P);\n' +
  prior.typeInfoSource.slice(prior.typeInfoSource.indexOf('void report('),
    prior.typeInfoSource.indexOf('typedef H(CALL*Lookup)'))
    .replace('localserver-typeinfo.txt', 'localserver-loopback.txt')
    .replace('WriteFile(output,b,n,&written,0);',
      'WriteFile(output,b,n,&written,0);b[n]=0;OutputDebugStringA(b);') + String.raw`
P API LoadLibraryA(const char*);P API GetProcAddress(P,const char*);U API FreeLibrary(P);
P API CoTaskMemAlloc(U);void API CoTaskMemFree(P);
typedef struct {P reserved;U representation;P buffer;U size,method;P reserved2[5];U flags;} MESSAGE;
typedef struct Channel Channel;
typedef struct {
 H(CALL*qi)(Channel*,const GUID*,P*);U(CALL*add)(Channel*);U(CALL*release)(Channel*);
 H(CALL*get)(Channel*,MESSAGE*,const GUID*);H(CALL*send)(Channel*,MESSAGE*,U*);
 H(CALL*free)(Channel*,MESSAGE*);H(CALL*context)(Channel*,U*,P*);H(CALL*connected)(Channel*);
} CV;
struct Channel {const CV*v;U refs;};
static const GUID channelIID={0xd5f56b60,0x593b,0x101a,{0xb5,0x69,8,0,0x2b,0x2d,0xbf,0x7a}};
static P stub;static U sends,gets,frees;
H CALL cq(Channel*self,const GUID*iid,P*out){if(!out)return (H)0x80004003;*out=0;if(!equal(iid,&unknown)&&!equal(iid,&channelIID))return (H)0x80004002;*out=self;self->refs++;return 0;}
U CALL ca(Channel*self){return ++self->refs;}U CALL cr(Channel*self){return --self->refs;}
H CALL cg(Channel*self,MESSAGE*m,const GUID*iid){if(!m||m->size>1048576)return (H)0x80070057;m->buffer=CoTaskMemAlloc(m->size?m->size:1);gets++;return m->buffer?0:(H)0x8007000e;}
H CALL cs(Channel*self,MESSAGE*m,U*status){
 typedef H(CALL*Invoke)(P,MESSAGE*,P);P request;H hr;
 if(!m||!status||!stub)return (H)0x80070057;
 request=m->buffer;report("channel.request.method",m->method);report("channel.request.size",m->size);
 sends++;hr=((Invoke)(*(P**)stub)[5])(stub,m,self);
 report("stub.Invoke",hr);report("channel.reply.size",m->size);
 if(m->buffer!=request)CoTaskMemFree(request);*status=0;return hr;
}
H CALL cf(Channel*self,MESSAGE*m){if(!m)return (H)0x80070057;CoTaskMemFree(m->buffer);m->buffer=0;frees++;return 0;}
H CALL cx(Channel*self,U*out,P*data){if(!out||!data)return (H)0x80004003;*out=0;*data=0;return 0;}
H CALL ci(Channel*self){return 0;}
static const CV channelV={cq,ca,cr,cg,cs,cf,cx,ci};static Channel channel={&channelV,1};
void start(void){
 static const GUID psClass={0x20420,0,0,{0xc0,0,0,0,0,0,0,0x46}};
 static const GUID psIID={0xd5f569d0,0x593b,0x101a,{0xb5,0x69,8,0,0x2b,0x2d,0xbf,0x7a}};
 typedef H(CALL*GetClass)(const GUID*,const GUID*,P*);
 typedef H(CALL*Proxy)(P,P,const GUID*,P*,P*);typedef H(CALL*Stub)(P,const GUID*,P,P*);
 typedef H(CALL*Connect)(P,P);typedef void(CALL*Disconnect)(P);
 P module,ps=0,proxy=0,remote=0;P*pv;GetClass get;H hr;DV*v;GUID nil={0};
 VARIANT arg={0},value={0};PARAMS params={0};U bad=0,i;
 static const W text[]={65,0,66,0x3bb};
 if(sizeof(MESSAGE)!=44||sizeof(VARIANT)!=16)ExitProcess(120);
 if(CoInitialize(0)<0)ExitProcess(121);
 object.v=(const UV*)&dispatchV;object.refs=1;instances=1;
 module=LoadLibraryA("oleaut32.dll");if(!module)ExitProcess(122);
 get=(GetClass)GetProcAddress(module,"DllGetClassObject");if(!get)ExitProcess(123);
 hr=get(&psClass,&psIID,&ps);report("PS.DllGetClassObject",hr);if(hr||!ps)ExitProcess(124);pv=*(P**)ps;
 hr=((Stub)pv[4])(ps,&dispatchIID,&object,&stub);report("PS.CreateStub",hr);if(hr||!stub)ExitProcess(125);
 hr=((Proxy)pv[3])(ps,0,&dispatchIID,&proxy,&remote);report("PS.CreateProxy",hr);if(hr||!proxy||!remote)ExitProcess(126);
 hr=((Connect)(*(P**)proxy)[3])(proxy,&channel);report("proxy.Connect",hr);if(hr)ExitProcess(127);
 v=*(DV**)remote;
 report("proxy.aboutToInvoke",1);hr=v->invoke(remote,1,&nil,0,2,&params,&value,0,&bad);report("proxy.Invoke.pid",hr);
 if(hr||value.vt!=3||(U)value.value.number!=GetCurrentProcessId())ExitProcess(128);
 arg.vt=8;arg.value.text=SysAllocStringLen(text,4);if(!arg.value.text)ExitProcess(129);
 params.args=&arg;params.count=1;value.vt=0;
 hr=v->invoke(remote,2,&nil,0,1,&params,&value,0,&bad);report("proxy.Invoke.BSTR",hr);
 if(hr||value.vt!=8||!value.value.text||SysStringLen(value.value.text)!=4)ExitProcess(130);
 for(i=0;i<4;i++)if(value.value.text[i]!=text[i])ExitProcess(131);
 SysFreeString(arg.value.text);SysFreeString(value.value.text);report("BSTR.roundtrip",1);
 params.args=0;params.count=0;value.vt=0;value.value.pointer=0;
 hr=v->invoke(remote,3,&nil,0,2,&params,&value,0,&bad);report("proxy.Invoke.interface",hr);
 if(hr||value.vt!=9||!value.value.pointer)ExitProcess(132);
 ((Unknown*)value.value.pointer)->v->release(value.value.pointer);
 ((Unknown*)remote)->v->release(remote);
 ((Disconnect)(*(P**)proxy)[4])(proxy);((Unknown*)proxy)->v->release(proxy);
 ((Disconnect)(*(P**)stub)[4])(stub);((Unknown*)stub)->v->release(stub);
 ((Unknown*)ps)->v->release(ps);or(&object);FreeLibrary(module);CoUninitialize();
 report("channel.sends",sends);report("channel.gets",gets);report("channel.frees",frees);
 report("server.finalRefs",object.refs);report("channel.finalRefs",channel.refs);
 if(object.refs||channel.refs!=1||sends!=3)ExitProcess(133);ExitProcess(0);
}
`;

// A PE import census identifies the standard marshaler dependency in the
// exact OLEAUT32 bytes, rather than inferring it from successful CreateProxy.
function peImports(bytes) {
  const u16 = at => bytes.readUInt16LE(at);
  const u32 = at => bytes.readUInt32LE(at);
  if (u16(0) !== 0x5a4d) throw new Error('DOS signature');
  const pe = u32(60), optional = pe + 24;
  if (u32(pe) !== 0x4550 || u16(optional) !== 0x10b) throw new Error('PE32 required');
  const sections = [];
  for (let i = 0, at = optional + u16(pe + 20); i < u16(pe + 6); i++, at += 40)
    sections.push({ size: Math.max(u32(at + 8), u32(at + 16)), va: u32(at + 12), raw: u32(at + 20) });
  const offset = rva => {
    const section = sections.find(s => rva >= s.va && rva - s.va < s.size);
    if (!section) throw new Error('unmapped RVA ' + rva.toString(16));
    return section.raw + rva - section.va;
  };
  const string = rva => {
    const start = offset(rva), end = bytes.indexOf(0, start);
    if (end < 0) throw new Error('unterminated import');
    return bytes.toString('ascii', start, end);
  };
  const result = {};
  const directory = u32(optional + 104);
  if (!directory) return result;
  for (let at = offset(directory); u32(at) || u32(at + 12) || u32(at + 16); at += 20) {
    const dll = string(u32(at + 12)).toLowerCase(), names = [];
    for (let thunk = offset(u32(at) || u32(at + 16)); u32(thunk); thunk += 4) {
      const value = u32(thunk);
      names.push(value & 0x80000000 ? '#' + (value & 0xffff) : string(value + 2));
    }
    result[dll] = names;
  }
  return result;
}

function prepare(directory) {
  const cp = require('node:child_process');
  const out = path.resolve(directory);
  // This creates only small run-specific authored inputs. Existing media,
  // libraries, preloads and the shared module remain referenced in place.
  fs.mkdirSync(out, { recursive: true });
  const put = (name, bytes) => fs.writeFileSync(path.join(out, name), bytes, { flag: 'wx' });
  let toolSequence = 0;
  const run = (command, args) => {
    const result = cp.spawnSync(command, args, { encoding: 'utf8' });
    const name = 'tool-' + (++toolSequence);
    put(name + '.stdout.log', result.stdout || '');
    put(name + '.stderr.log', result.stderr || '');
    put(name + '-wait.json', JSON.stringify({ command, pid: result.pid, exit: result.status,
      signal: result.signal, actualWait: result.status !== null,
      stdoutEOF: !result.error, stderrEOF: !result.error,
      error: result.error ? String(result.error) : null }, null, 2) + '\n');
    if (result.error || result.status !== 0) throw new Error(command + ' failed: ' + (result.stderr || result.error));
  };
  const libraries = {
    kernel32: ['ExitProcess@4', 'GetCurrentProcessId@0', 'GetCommandLineA@0', 'LoadLibraryA@4',
      'GetProcAddress@8', 'FreeLibrary@4', 'CreateFileA@28', 'WriteFile@20', 'GetStdHandle@4', 'OutputDebugStringA@4',
      'SetCurrentDirectoryA@4', 'CreateProcessA@40', 'GetExitCodeProcess@8',
      'Sleep@4', 'CreateEventA@16',
      'SetEvent@4', 'WaitForSingleObject@8', 'CloseHandle@4'],
    ole32: ['CoInitialize@4', 'CoInitializeEx@8', 'CoUninitialize@0',
      'CoRegisterClassObject@20', 'CoRevokeClassObject@4', 'CoGetClassObject@20', 'CoCreateInstance@20',
      'CoTaskMemAlloc@4', 'CoTaskMemFree@4'],
    advapi32: ['RegCreateKeyA@12', 'RegSetValueA@20', 'RegCloseKey@4'],
    oleaut32: ['SysAllocStringLen@8', 'SysFreeString@4', 'SysStringLen@4', 'LoadTypeLib@8', 'RegisterTypeLib@12'],
  };
  for (const [dll, names] of Object.entries(libraries)) {
    put(dll + '.def', 'LIBRARY ' + dll + '.dll\nEXPORTS\n' + names.join('\n') + '\n');
    run('llvm-dlltool', ['-m', 'i386', '-k', '-d', path.join(out, dll + '.def'), '-l', path.join(out, dll + '.lib')]);
  }
  const inputs = [];
  for (const [name, source] of [['localserver-deep-server', deepServerSource],
      ['localserver-deep-client', deepClientSource], ['localserver-marshal-exports', marshalExportsSource],
      ['ikernel-output-shape', mediaShapeSource], ['ikernel-channel-client', kernelClientSource],
      ['oleaut-channel-loopback', loopbackSource]]) {
    put(name + '.c', source);
    run('clang', ['--target=i686-pc-windows-msvc', '-ffreestanding', '-fno-stack-protector',
      '-fno-builtin', '-O1', '-c', path.join(out, name + '.c'), '-o', path.join(out, name + '.obj')]);
    run('ld', ['-mi386pe', '--entry', '_start', '--subsystem', 'console', '--disable-dynamicbase',
      '--no-insert-timestamp', '-o', path.join(out, name + '.exe'), path.join(out, name + '.obj'),
      ...Object.keys(libraries).map(dll => path.join(out, dll + '.lib'))]);
    const bytes = fs.readFileSync(path.join(out, name + '.exe'));
    inputs.push({ name, bytes: bytes.length, sha256: sha(bytes), sourceSHA256: sha(Buffer.from(source)) });
  }
  put('prepared.json', JSON.stringify({ authoredOnly: true, nativeExecution: false, inputs }, null, 2) + '\n');
  return inputs;
}

module.exports = { deepServerSource, deepClientSource, marshalExportsSource, mediaShapeSource, loopbackSource,
  kernelClientSource, peImports, prepare };

if (require.main === module) {
  const { test } = require('node:test');
  const assert = require('node:assert/strict');
  const evidence = path.resolve(__dirname, '../scratch/runs/20261115-sims-localserver-channel-implementation');
  const read = (run, name) => fs.readFileSync(path.join(evidence, run, name), 'utf8');
  test('exact genuine OLEAUT32 requires standard interface and HRESULT marshaling', () => {
    const bytes = fs.readFileSync(path.join(__dirname, 'binaries/dlls/oleaut32.dll'));
    assert.equal(sha(bytes), 'baeb2f7c1b8be56738d34e1d1ddf8e0eebd3a633215dc1575e14656be38b939d');
    const imports = peImports(bytes)['ole32.dll'];
    for (const name of ['CoMarshalInterface', 'CoUnmarshalInterface', 'CoMarshalHresult', 'CoUnmarshalHresult'])
      assert(imports.includes(name), name);
  });
  test('each missing required preload refuses before loading the runner', () => {
    for (const run of ['missing-source-preload', 'missing-hostmap-preload']) {
      const receipt = JSON.parse(read(run, 'native-wait.json'));
      assert.equal(receipt.exit, 1);
      for (const key of ['actualWait', 'stdoutEOF', 'stderrEOF']) assert.equal(receipt[key], true);
      assert.match(read(run, 'native.stderr.log'), /exact two preloads required/);
      assert.doesNotMatch(read(run, 'native.stdout.log'), /PE loaded|\[API|\[Exit\]/);
    }
  });
  test('actual public export probe observes all four missing marshaling procedures', () => {
    const log = read('marshal-exports', 'native.stdout.log');
    for (const name of ['CoMarshalInterface', 'CoUnmarshalInterface', 'CoMarshalHresult', 'CoUnmarshalHresult'])
      assert.match(log, new RegExp('name="' + name + '"[^\\n]*\\n  => 0\\n'));
    assert.match(log, /\[Exit\] code=15\b/);
  });
  test('genuine proxy and stub reach the actual missing HRESULT marshaler during Invoke', () => {
    const log = read('oleaut-loopback-debug', 'native.stdout.log');
    const error = read('oleaut-loopback-debug', 'native.stderr.log');
    assert.match(log, /DLL: oleaut32\.dll.*DllMain=/);
    for (const label of ['PS.DllGetClassObject', 'PS.CreateStub', 'PS.CreateProxy', 'stub.Invoke', 'proxy.Connect'])
      assert(log.includes(label + '=00000000'), label);
    const start = log.indexOf('proxy.aboutToInvoke=00000001');
    assert(start >= 0);
    assert(log.indexOf('channel.request.method=00000006', start) > start);
    assert(log.indexOf('channel.request.size=0000002e', start) > start);
    assert.match(error, /UNIMPLEMENTED API: CoMarshalHresult/);
    assert.doesNotMatch(log, /proxy\.Invoke\.pid=|BSTR\.roundtrip=|proxy\.Invoke\.interface=/);
    assert.equal(JSON.parse(read('oleaut-loopback-debug', 'native-wait.json')).exit, 1);
    assert.equal(JSON.parse(read('oleaut-loopback-debug', 'watchdog-result.json')).fired, false);
  });
  test('genuine registrar completion still does not activate exact ISetupMedia', () => {
    const log = read('kernel-client', 'native.stdout.log');
    const merge = log.indexOf('child state merged: 5 file(s) written, 0 deleted, 298 registry/INI key(s)');
    const activation = log.indexOf('CoCreateInstance(');
    assert(merge >= 0 && activation > merge);
    assert.match(log.slice(activation), /=> 0x80040154/);
    assert.match(log, /\[Exit\] code=110\b/);
    assert.equal((log.match(/\[spawn\] CreateProcess /g) || []).length, 1);
    const output = read('kernel-client', 'native-saves/localserver-channel-client.txt');
    assert.match(output, /client\.CoCreateInstance\.ISetupMedia=80040154/);
    assert.match(output, /client\.mediaPresent=00000000/);
    const registry = JSON.parse(read('kernel-client', 'actual.registry.json'));
    const value = key => JSON.parse(registry[key]).values[''].data;
    const prefix = 'reg:HKCR\\Interface\\{91814ebf-b5f0-11d2-80b9-00104b1f6cea}\\';
    assert.equal(value(prefix + 'ProxyStubClsid32'), '{00020424-0000-0000-C000-000000000046}');
    assert.equal(value(prefix + 'TypeLib'), '{91814eb1-b5f0-11d2-80b9-00104b1f6cea}');
    assert.match(value('reg:HKCR\\CLSID\\{91814EC0-B5F0-11D2-80B9-00104B1F6CEA}\\LocalServer32'), /ikernel\.exe$/i);
  });
}
