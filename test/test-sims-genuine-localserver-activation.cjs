'use strict';
// LIGHT tests read retained evidence only. Native candidates are exported as
// source strings; importing this module never builds, launches or seeds COM.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { test } = require('node:test');
const prior = path.resolve(__dirname, '../scratch/runs/20261115-sims-ikernel-registration-cofree-cleanup');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

const commonSource = String.raw`
typedef unsigned long U; typedef long H; typedef void *P;
#define API __declspec(dllimport) __stdcall
#define CALL __stdcall
typedef struct { U a; unsigned short b,c; unsigned char d[8]; } GUID;
static const GUID cls={0x72a962d1,0x7729,0x4ae9,{0x89,0x25,0x19,0x5e,0x46,0x36,0xa2,0x61}};
static const GUID unknown={0,0,0,{0xc0,0,0,0,0,0,0,0x46}};
static const GUID factoryIID={1,0,0,{0xc0,0,0,0,0,0,0,0x46}};
static const GUID unsupported={0x72a962d2,0x7729,0x4ae9,{0x89,0x25,0x19,0x5e,0x46,0x36,0xa2,0x61}};
int equal(const GUID*a,const GUID*b){int i;const unsigned char*x=(const unsigned char*)a,*y=(const unsigned char*)b;for(i=0;i<16;i++)if(x[i]!=y[i])return 0;return 1;}
void API ExitProcess(U); U API GetCurrentProcessId(void); void API Sleep(U);
H API CoInitialize(P); H API CoInitializeEx(P,U); void API CoUninitialize(void);
H API CoRegisterClassObject(const GUID*,P,U,U,U*); H API CoRevokeClassObject(U);
H API CoGetClassObject(const GUID*,U,P,const GUID*,P*);
H API CoCreateInstance(const GUID*,P,U,const GUID*,P*);
U API RegCreateKeyA(P,const char*,P*); U API RegSetValueA(P,const char*,U,const char*,U);
U API RegCloseKey(P); U API GetModuleFileNameA(P,char*,U);
typedef struct Unknown Unknown;
typedef struct {H(CALL*qi)(Unknown*,const GUID*,P*);U(CALL*add)(Unknown*);U(CALL*release)(Unknown*);} UV;
struct Unknown {const UV*v;U refs;};
typedef struct Factory Factory;
typedef struct {H(CALL*qi)(Factory*,const GUID*,P*);U(CALL*add)(Factory*);U(CALL*release)(Factory*);H(CALL*create)(Factory*,P,const GUID*,P*);H(CALL*lock)(Factory*,U);} FV;
struct Factory {const FV*v;U refs;};
`;

// A separate guest process owns all server-side addresses. A named event is
// only a lifecycle signal; it never stands in for a class factory or method.
const serverSource = commonSource + String.raw`
#ifndef FIXTURE_FLAGS
#define FIXTURE_FLAGS 1
#endif
#ifndef FIXTURE_DELAY
#define FIXTURE_DELAY 300
#endif
#ifndef FIXTURE_FAIL
#define FIXTURE_FAIL 0
#endif
#ifndef FIXTURE_NO_REGISTER
#define FIXTURE_NO_REGISTER 0
#endif
P API CreateEventA(P,U,U,const char*); U API SetEvent(P); U API WaitForSingleObject(P,U); U API CloseHandle(P);
static Unknown object; static Factory factory; static U instances,locks,created;
static P createdEvent,retiredEvent;
H CALL oq(Unknown*self,const GUID*iid,P*out){if(!out)return (H)0x80004003;*out=0;if(!equal(iid,&unknown))return (H)0x80004002;*out=self;self->refs++;return 0;}
U CALL oa(Unknown*self){return ++self->refs;}
U CALL or(Unknown*self){U n=--self->refs;if(!n){instances--;if(created)SetEvent(retiredEvent);}return n;}
H CALL fq(Factory*self,const GUID*iid,P*out){if(!out)return (H)0x80004003;*out=0;if(!equal(iid,&unknown)&&!equal(iid,&factoryIID))return (H)0x80004002;*out=self;self->refs++;return 0;}
U CALL fa(Factory*self){return ++self->refs;}
U CALL fr(Factory*self){return --self->refs;}
H CALL fc(Factory*self,P outer,const GUID*iid,P*out){
  H hr;if(!out)return (H)0x80004003;*out=0;
  if(outer)return (H)0x80040110;
  if(object.refs)return (H)0x800700aa;
  object.refs=1;instances++;hr=oq(&object,iid,out);or(&object);
  if(!hr){created++;SetEvent(createdEvent);}return hr;
}
H CALL fl(Factory*self,U value){if(value)locks++;else if(locks)locks--;return 0;}
static const UV ov={oq,oa,or}; static const FV fv={fq,fa,fr,fc,fl};
void start(void){
  U cookie=0,i;H hr;object.v=&ov;factory.v=&fv;factory.refs=1;
  if(CoInitializeEx(0,0)<0)ExitProcess(20); /* Multithreaded apartment. */
  createdEvent=CreateEventA(0,1,0,"Local\\wa-localserver-created");
  retiredEvent=CreateEventA(0,1,0,"Local\\wa-localserver-retired");
  if(!createdEvent||!retiredEvent)ExitProcess(21);
  if(FIXTURE_FAIL)ExitProcess(26);
  Sleep(FIXTURE_DELAY); /* Real delayed publication. */
  if(FIXTURE_NO_REGISTER){Sleep(65000);ExitProcess(27);}
  hr=CoRegisterClassObject(&cls,&factory,4,FIXTURE_FLAGS,&cookie);
  if(hr||!cookie||factory.refs!=2)ExitProcess(22);
  /* A future production route must schedule actual MTA server calls while
     this thread waits; an idle host shadow must not borrow its guest stack. */
  if(WaitForSingleObject(retiredEvent,15000))ExitProcess(23);
  /* Object release can race the client's final factory release. Keep the
     real server alive until both remote references and locks are gone. */
  for(i=0;factory.refs!=2||locks;i++){if(i>=15000)ExitProcess(28);Sleep(1);}
  if(!created||instances||object.refs)ExitProcess(24);
  if(CoRevokeClassObject(cookie)||factory.refs!=1)ExitProcess(25);
  CloseHandle(createdEvent);CloseHandle(retiredEvent);CoUninitialize();ExitProcess(0);
}
`;

// Explicit registry creation is appropriate only for this authored class.
// The actual IKernel qualification must use IKernel's real registration.
const clientSource = commonSource + String.raw`
P API CreateEventA(P,U,U,const char*);U API WaitForSingleObject(P,U);U API CloseHandle(P);
__attribute__((naked)) H CALL checkedGet(const GUID*clsid,U context,P reserved,const GUID*iid,P*out){
 __asm__ volatile("pushl %ebx\n pushl %esi\n pushl %edi\n pushl %ebp\n"
  "movl $0x13572468,%ebx\n movl $0x24681357,%esi\n movl $0x76543210,%edi\n movl %esp,%ebp\n"
  "pushl 36(%ebp)\n pushl 32(%ebp)\n pushl 28(%ebp)\n pushl 24(%ebp)\n pushl 20(%ebp)\n"
  "calll *\"__imp__CoGetClassObject@20\"\n"
  "cmpl %esp,%ebp\n jne 1f\n cmpl $0x13572468,%ebx\n jne 1f\n"
  "cmpl $0x24681357,%esi\n jne 1f\n cmpl $0x76543210,%edi\n jne 1f\n"
  "jmp 2f\n 1: movl $0x8004fffe,%eax\n 2: popl %ebp\n popl %edi\n popl %esi\n popl %ebx\n retl $20");
}
void start(void){
  P key=0,out=(P)0x1234,other=(P)0x1234;Factory*f;Unknown*o;H hr;
  static const char command[]="\"C:\\localserver-fixture.exe\"";
  P retired=CreateEventA(0,1,0,"Local\\wa-localserver-retired");
  if(!retired||CoInitialize(0)<0)ExitProcess(30);
  if(RegCreateKeyA((P)0x80000000,"CLSID\\{72A962D1-7729-4AE9-8925-195E4636A261}\\LocalServer32",&key))ExitProcess(31);
  if(RegSetValueA(key,0,1,command,sizeof(command)))ExitProcess(32);RegCloseKey(key);
  hr=checkedGet(&cls,4,0,&factoryIID,&out);
  if(hr||!out)ExitProcess(33);f=(Factory*)out;
  if(f->v->qi(f,&unsupported,&other)!=(H)0x80004002||other)ExitProcess(34);
  out=(P)0x1234;
  if(f->v->create(f,0,&unsupported,&out)!=(H)0x80004002||out)ExitProcess(35);
  if(f->v->create(f,0,&unknown,&out)||!out)ExitProcess(36);o=(Unknown*)out;
  other=(P)0x1234;
  if(o->v->qi(o,&unsupported,&other)!=(H)0x80004002||other)ExitProcess(37);
  if(o->v->qi(o,&unknown,&other)||!other)ExitProcess(38);
  ((Unknown*)other)->v->release((Unknown*)other);o->v->release(o);f->v->release(f);
  if(WaitForSingleObject(retired,5000))ExitProcess(39);
  CloseHandle(retired);CoUninitialize();ExitProcess(0);
}
`;

// CoCreateInstance must perform the same real factory call and release its
// temporary factory reference. This checks the other ordinary activation API.
const createClientSource = clientSource
  .replace('checkedGet(const GUID*clsid,U context,P reserved', 'checkedCreate(const GUID*clsid,P outer,U context')
  .replace('__imp__CoGetClassObject@20', '__imp__CoCreateInstance@20')
  .replace(/  hr=checkedGet[\s\S]*?  other=\(P\)0x1234;/, String.raw`
  hr=checkedCreate(&cls,0,4,&unknown,&out);
  if(hr||!out)ExitProcess(33);o=(Unknown*)out;
  other=(P)0x1234;`)
  .replace('o->v->release(o);f->v->release(f);', 'o->v->release(o);');

// Use the same authored LocalServer32 value but mount either the authored
// early-exit server, the unregistered server, or no executable. A failed
// activation must clear the output and return its documented failure.
const failureClientSource = clientSource.slice(0, clientSource.indexOf('void start(void){')) + String.raw`
#ifndef EXPECTED_HRESULT
#define EXPECTED_HRESULT 0x800401fe
#endif
void start(void){
 P key=0,out=(P)0x1234;H hr;
 static const char command[]="\"C:\\localserver-fixture.exe\"";
 if(CoInitialize(0)<0)ExitProcess(70);
 if(RegCreateKeyA((P)0x80000000,"CLSID\\{72A962D1-7729-4AE9-8925-195E4636A261}\\LocalServer32",&key))ExitProcess(71);
 if(RegSetValueA(key,0,1,command,sizeof(command)))ExitProcess(72);RegCloseKey(key);
 hr=checkedGet(&cls,4,0,&factoryIID,&out);
 if(hr!=(H)EXPECTED_HRESULT||out)ExitProcess(73);
 CoUninitialize();ExitProcess(0);
}
`;

// Standard IDispatch gives a nontrivial public marshalling test without
// pretending that an authored private IID qualifies IKernel. The echoed BSTR
// contains an embedded NUL: forwarding a guest address or copying a C string
// cannot satisfy this contract across the two independent memories.
const dispatchABI = String.raw`
static const GUID dispatchIID={0x20400,0,0,{0xc0,0,0,0,0,0,0,0x46}};
typedef unsigned short W;
typedef struct {W vt,r1,r2,r3;union{long number;W*text;P pointer;double real;}value;} VARIANT;
typedef struct {VARIANT*args;long*named;U count,namedCount;} PARAMS;
typedef struct {
 H(CALL*qi)(Unknown*,const GUID*,P*);U(CALL*add)(Unknown*);U(CALL*release)(Unknown*);
 H(CALL*count)(Unknown*,U*);H(CALL*info)(Unknown*,U,U,P*);
 H(CALL*names)(Unknown*,const GUID*,W**,U,U,long*);
 H(CALL*invoke)(Unknown*,long,const GUID*,U,W,PARAMS*,VARIANT*,P,U*);
} DV;
__declspec(dllimport) W* CALL SysAllocStringLen(const W*,U); void API SysFreeString(W*);U API SysStringLen(W*);
`;
const dispatchMethods = String.raw`
H CALL dc(Unknown*self,U*out){if(!out)return (H)0x80004003;*out=0;return 0;}
H CALL di(Unknown*self,U index,U locale,P*out){if(out)*out=0;return (H)0x8002000b;}
int word(const W*s,const char*name){while(*s&&*name&&*s==(unsigned char)*name){s++;name++;}return !*s&&!*name;}
H CALL dn(Unknown*self,const GUID*iid,W**names,U n,U locale,long*ids){
 U i;if(!equal(iid,&(GUID){0}))return (H)0x80020001;
 for(i=0;i<n;i++){if(word(names[i],"ServerPid"))ids[i]=1;else if(word(names[i],"Echo"))ids[i]=2;else{ids[i]=-1;return (H)0x80020006;}}return 0;
}
H CALL dv(Unknown*self,long id,const GUID*iid,U locale,W flags,PARAMS*p,VARIANT*out,P exception,U*bad){
 U i;unsigned char*b;
 if(!equal(iid,&(GUID){0}))return (H)0x80020001;
 if(!out||!p)return (H)0x80004003;b=(unsigned char*)out;for(i=0;i<sizeof(VARIANT);i++)b[i]=0;
 if(id==1&&flags==2){if(p->count)return (H)0x8002000e;out->vt=3;out->value.number=GetCurrentProcessId();return 0;}
 if(id==2&&flags==1){if(p->count!=1)return (H)0x8002000e;if(p->args[0].vt!=8){if(bad)*bad=0;return (H)0x80020005;}
  out->vt=8;out->value.text=SysAllocStringLen(p->args[0].value.text,SysStringLen(p->args[0].value.text));
  return out->value.text?0:(H)0x8007000e;}
 return (H)0x80020003;
}
static const DV dispatchV={oq,oa,or,dc,di,dn,dv};
`;
const dispatchServerSource = serverSource
  .replace('static Unknown object;', dispatchABI + '\nstatic Unknown object;')
  .replace('if(!equal(iid,&unknown))', 'if(!equal(iid,&unknown)&&!equal(iid,&dispatchIID))')
  .replace('static const UV ov=', dispatchMethods + '\nstatic const UV ov=')
  .replace('object.v=&ov;', 'object.v=(const UV*)&dispatchV;');
const dispatchClientSource = clientSource
  .replace('void start(void){', dispatchABI + '\nvoid start(void){')
  .replace('if(f->v->create(f,0,&unknown,&out)', 'if(f->v->create(f,0,&dispatchIID,&out)')
  .replace('  other=(P)0x1234;', String.raw`
  {
    static const W text[]={65,0,66,0x3bb};
    static W name[]={83,101,114,118,101,114,80,105,100,0};
    GUID nil={0};W*names[1]={name};long id=-1;U bad=0;DV*v=(DV*)o->v;
    VARIANT value={0},arg={0};PARAMS params={0};
    if(sizeof(VARIANT)!=16)ExitProcess(40);
    if(v->names(o,&nil,names,1,0,&id)||id!=1)ExitProcess(41);
    if(v->invoke(o,id,&nil,0,2,&params,&value,0,&bad)||value.vt!=3||!value.value.number||(U)value.value.number==GetCurrentProcessId())ExitProcess(42);
    arg.vt=8;arg.value.text=SysAllocStringLen(text,4);if(!arg.value.text)ExitProcess(43);
    params.args=&arg;params.count=1;
    if(v->invoke(o,2,&nil,0,1,&params,&value,0,&bad)||value.vt!=8||!value.value.text||SysStringLen(value.value.text)!=4)ExitProcess(44);
    {U i;for(i=0;i<4;i++)if(value.value.text[i]!=text[i])ExitProcess(45);}
    SysFreeString(arg.value.text);SysFreeString(value.value.text);
  }
  other=(P)0x1234;`);

// Real guest calls exercise the class table independently of launch/IPC. No
// registry entry is needed for a currently registered EXE class object.
const registrationSource = serverSource.slice(0, serverSource.indexOf('void start(void){')) +
 clientSource.slice(clientSource.indexOf('__attribute__((naked))'), clientSource.indexOf('void start(void){')) + String.raw`
void start(void){
 U a=0,b=0,c=0;P out=(P)0x1234;Factory*f;H hr;
 factory.v=&fv;factory.refs=1;object.v=&ov;
 if(CoInitializeEx(0,0)<0)ExitProcess(50);
 if(CoRegisterClassObject(&cls,&factory,4,1,&a)||!a)ExitProcess(51);
 if(CoRegisterClassObject(&cls,&factory,4,1,&b)||!b||a==b||factory.refs!=3)ExitProcess(52);
 if(CoGetClassObject(&cls,4,0,&factoryIID,&out)||!out)ExitProcess(53);
 f=(Factory*)out;if(f!=&factory)ExitProcess(54);f->v->release(f);
 if(CoRevokeClassObject(b)||factory.refs!=2)ExitProcess(55);
 out=0;if(CoGetClassObject(&cls,4,0,&factoryIID,&out)||!out)ExitProcess(56);
 f=(Factory*)out;f->v->release(f);
 /* MULTIPLEUSE LOCAL_SERVER is also visible to in-process callers. */
 out=0;if(CoGetClassObject(&cls,1,0,&factoryIID,&out)||!out)ExitProcess(57);
 f=(Factory*)out;f->v->release(f);
 out=(P)0x1234;hr=CoGetClassObject(&cls,4,0,&unsupported,&out);
 if(hr!=(H)0x80004002||out)ExitProcess(58);
 if(CoRevokeClassObject(a)||factory.refs!=1)ExitProcess(59);
 if(CoRegisterClassObject(&cls,&factory,4,2,&c)||!c)ExitProcess(60);
 out=(P)0x1234;hr=CoGetClassObject(&cls,1,0,&factoryIID,&out);
 if(hr!=(H)0x80040154||out)ExitProcess(61);
 if(CoRevokeClassObject(c)||factory.refs!=1)ExitProcess(62);
 if(CoRegisterClassObject(&cls,&factory,4,0,&c)||!c)ExitProcess(63);
 out=0;if(CoGetClassObject(&cls,4,0,&factoryIID,&out)||!out)ExitProcess(64);
 f=(Factory*)out;f->v->release(f);
 out=(P)0x1234;hr=CoGetClassObject(&cls,4,0,&factoryIID,&out);
 if(hr!=(H)0x80040154||out)ExitProcess(65);
 if(CoRevokeClassObject(c)||factory.refs!=1)ExitProcess(66);
 c=0;if(CoRegisterClassObject(&cls,&factory,1,0,&c)!=(H)0x80070057||c||factory.refs!=1)ExitProcess(67);
 c=123;if(CoRegisterClassObject(0,&factory,4,1,&c)!=(H)0x80070057||c||factory.refs!=1)ExitProcess(68);
 if(CoRegisterClassObject(&cls,&factory,4,1,0)!=(H)0x80070057||factory.refs!=1)ExitProcess(69);
 c=123;if(CoRegisterClassObject(&cls,0,4,1,&c)!=(H)0x80070057||c||factory.refs!=1)ExitProcess(74);
 c=123;if(CoRegisterClassObject(&cls,&factory,4,3,&c)!=(H)0x80070057||c||factory.refs!=1)ExitProcess(75);
 CoUninitialize();ExitProcess(0);
}
`.replaceAll('CoGetClassObject(&cls', 'checkedGet(&cls');

// Exercise the registration prerequisite through the existing owner-side
// CoCreateInstance continuation. CoGetClassObject's separate borrowed-pointer
// defect remains an explicit negative until its real QI continuation exists.
const registrationCreateSource = registrationSource
 .replace('P out=(P)0x1234;Factory*f;', 'P out=(P)0x1234;Unknown*f;')
 .replaceAll('checkedGet(&cls,4,0,&factoryIID,&out)', 'CoCreateInstance(&cls,0,4,&unknown,&out)')
 .replaceAll('checkedGet(&cls,1,0,&factoryIID,&out)', 'CoCreateInstance(&cls,0,1,&unknown,&out)')
 .replaceAll('checkedGet(&cls,4,0,&unsupported,&out)', 'CoCreateInstance(&cls,0,4,&unsupported,&out)')
 .replaceAll('f=(Factory*)out', 'f=(Unknown*)out')
 .replace('if(f!=&factory)ExitProcess(54);', 'if(f!=&object)ExitProcess(54);');

// Public metadata only. This must run against the actual OLEAUT32 and genuine
// IKernel TYPELIB resource after release; loading type information is not
// class activation and is never counted as an ISetupMedia object success.
const typeInfoSource = commonSource + String.raw`
typedef unsigned short W;
H API LoadTypeLib(const W*,P*); H API RegisterTypeLib(P,const W*,const W*); P API LoadLibraryA(const char*); P API GetProcAddress(P,const char*); U API FreeLibrary(P); P API CreateFileA(const char*,U,U,P,U,U,P); P API GetStdHandle(U); U API WriteFile(P,const char*,U,U*,P);
typedef struct TD {union{struct TD*pointer;U href;}value;W vt;} TD;
typedef struct {TD type;P extended;W flags;} ED;
typedef struct {long member;P codes;ED*params;U kind,invoke,convention;short count,optional,vtable,codesCount;ED result;W flags;} FD;
typedef struct {GUID guid;U locale,reserved;long constructor,destructor;W*schema;U size,kind;W functions,vars,impls,vtable,alignment,flags,major,minor;TD alias;P reserved2;W reserved3;} TA;
void report(const char*label,U value){static P output;char b[160];U n=0,i,written;while(label[n]){b[n]=label[n];n++;}b[n++]='=';for(i=0;i<8;i++)b[n++]="0123456789abcdef"[(value>>((7-i)*4))&15];b[n++]='\n';if(!output)output=CreateFileA("C:\\localserver-typeinfo.txt",0x40000000,0,0,2,0,0);if(output==(P)-1)ExitProcess(88);WriteFile(output,b,n,&written,0);}
typedef H(CALL*Lookup)(P,const GUID*,P*);typedef H(CALL*Attr)(P,TA**);
typedef H(CALL*Func)(P,U,FD**);typedef void(CALL*FreeAttr)(P,TA*);typedef void(CALL*FreeFunc)(P,FD*);
typedef U(CALL*Release)(P);
void describe(const TD*t,U depth){report("type.vt",t->vt);if(depth<8&&(t->vt==26||t->vt==27)&&t->value.pointer)describe(t->value.pointer,depth+1);else if(t->vt==29)report("type.href",t->value.href);}
void start(void){
 static const W filename[]={'C',':','\\','P','r','o','g','r','a','m',' ','F','i','l','e','s','\\','C','o','m','m','o','n',' ','F','i','l','e','s','\\','I','n','s','t','a','l','l','S','h','i','e','l','d','\\','E','n','g','i','n','e','\\','6','\\','I','n','t','e','l',' ','3','2','\\','I','K','e','r','n','e','l','.','e','x','e',0};
 static const GUID iid={0x91814ebf,0xb5f0,0x11d2,{0x80,0xb9,0,0x10,0x4b,0x1f,0x6c,0xea}};
 P lib=0,info=0;P*lv;P*iv;TA*a=0;FD*f=0;U i,j,n;H hr;
 if(CoInitialize(0)<0)ExitProcess(80);
 hr=LoadTypeLib(filename,&lib);report("LoadTypeLib",hr);if(hr||!lib)ExitProcess(81);lv=*(P**)lib;
 hr=((Lookup)lv[6])(lib,&iid,&info);report("GetTypeInfoOfGuid",hr);if(hr||!info)ExitProcess(82);iv=*(P**)info;
 hr=((Attr)iv[3])(info,&a);report("GetTypeAttr",hr);if(hr||!a)ExitProcess(83);
 report("TYPEATTR.size",sizeof(TA));report("FUNCDESC.size",sizeof(FD));report("ELEMDESC.size",sizeof(ED));
 report("kind",a->kind);report("functions",a->functions);report("vtable",a->vtable);report("flags",a->flags);n=a->functions;
 ((FreeAttr)iv[19])(info,a);if(n>128)ExitProcess(84);
 for(i=0;i<n;i++){
  report("function.index",i);hr=((Func)iv[5])(info,i,&f);if(hr||!f)ExitProcess(85);
  report("function.member",f->member);report("function.kind",f->kind);report("function.invoke",f->invoke);report("function.convention",f->convention);report("function.vtable",(U)(unsigned short)f->vtable);report("function.parameters",f->count);describe(&f->result.type,0);
  if(f->count<0||f->count>64)ExitProcess(86);
  for(j=0;j<(U)f->count;j++){report("parameter.index",j);report("parameter.flags",f->params[j].flags);describe(&f->params[j].type,0);}
  ((FreeFunc)iv[20])(info,f);
 }
 ((Release)iv[2])(info);((Release)lv[2])(lib);CoUninitialize();ExitProcess(0);
}
`;

// Ask the genuine OLEAUT32 proxy/stub factory to produce its registered
// ISetupMedia proxy. Public RegisterTypeLib uses the loaded genuine library;
// no class factory, interface pointer or successful result is seeded here.
const proxyFactorySource = typeInfoSource.replace(
 ' ((Release)iv[2])(info);', String.raw`
 {
  static const GUID automation={0x20424,0,0,{0xc0,0,0,0,0,0,0,0x46}};
  static const GUID psIID={0xd5f569d0,0x593b,0x101a,{0xb5,0x69,8,0,0x2b,0x2d,0xbf,0x7a}};
  typedef H(CALL*GetClass)(const GUID*,const GUID*,P*);
  typedef H(CALL*CreateProxy)(P,P,const GUID*,P*,P*);
  P module,ps=0,proxy=0,object=0;P*pv;GetClass get;
  hr=RegisterTypeLib(lib,filename,0);report("RegisterTypeLib",hr);if(hr)ExitProcess(89);
  module=LoadLibraryA("oleaut32.dll");if(!module)ExitProcess(90);
  get=(GetClass)GetProcAddress(module,"DllGetClassObject");if(!get)ExitProcess(91);
  hr=get(&automation,&psIID,&ps);report("PS.DllGetClassObject",hr);if(hr||!ps)ExitProcess(92);pv=*(P**)ps;
  hr=((CreateProxy)pv[3])(ps,0,&iid,&proxy,&object);report("PS.CreateProxy",hr);
  report("PS.proxyPresent",proxy!=0);report("PS.objectPresent",object!=0);
  if(hr||!proxy||!object)ExitProcess(93);
  ((Release)(*(P**)object)[2])(object);((Release)(*(P**)proxy)[2])(proxy);
  ((Release)pv[2])(ps);FreeLibrary(module);
 }
 ((Release)iv[2])(info);`);

// Authored supervisor client, never Setup.exe: launch the unchanged real
// registered server with its public -Embedding switch in inherited D:\Setup.
// Observe only Win32 process status. A bounded forced retirement is reported
// separately and never represented as server Quit or installer progress.
const embeddingSource = commonSource + String.raw`
U API SetCurrentDirectoryA(const char*);U API CreateProcessA(const char*,char*,P,P,U,U,P,P,P,P);
U API WaitForSingleObject(P,U);U API GetExitCodeProcess(P,U*);U API TerminateProcess(P,U);U API CloseHandle(P);
void start(void){
 static U startup[17]={68},process[4];U code=259,wait;
 static char command[]="\"C:\\Program Files\\Common Files\\InstallShield\\Engine\\6\\Intel 32\\IKernel.exe\" -Embedding";
 if(!SetCurrentDirectoryA("D:\\Setup"))ExitProcess(94);
 if(!CreateProcessA(0,command,0,0,0,0,0,0,startup,process))ExitProcess(95);
 wait=WaitForSingleObject((P)process[0],5000);
 if(wait==0x102){
  if(!GetExitCodeProcess((P)process[0],&code)||code!=259)ExitProcess(96);
  if(!TerminateProcess((P)process[0],99))ExitProcess(97);
  if(WaitForSingleObject((P)process[0],5000))ExitProcess(98);
 }else if(wait)ExitProcess(99);
 if(!GetExitCodeProcess((P)process[0],&code))ExitProcess(100);
 CloseHandle((P)process[0]);CloseHandle((P)process[1]);Sleep(200);
 ExitProcess(code==99?0:code?101:102);
}
`;

// Native qualification only: observe unmodified fork results and Node's
// real exit/close plus both pipe EOF events. No guest memory, return
// replacement, timers or keepalive handles are introduced.
const childWaitObserverSource = String.raw`'use strict';
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const fork=cp.fork;
cp.fork=function(...args){
 const child=Reflect.apply(fork,this,args),pid=child.pid;
 const row={pid,parent:process.pid,actualWait:false,stdoutEOF:false,stderrEOF:false};
 try{const stat=fs.readFileSync('/proc/'+pid+'/stat','utf8');row.startToken=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];}catch(e){row.startError=String(e);}
 const file=path.join(process.env.SIMS_EVIDENCE_DIR,'child-'+process.pid+'-'+pid+'-wait.json');
 const save=()=>fs.writeFileSync(file,JSON.stringify(row,null,2)+'\n');save();
 child.stdout?.once('end',()=>{row.stdoutEOF=true;save();});
 child.stderr?.once('end',()=>{row.stderrEOF=true;save();});
 child.once('exit',(code,signal)=>{row.actualWait=true;row.exit=code;row.signal=signal;save();});
 child.once('close',()=>{row.closed=true;save();});
 return child;
};
`;

// Small reproducible authored inputs only; no real media or shared module is
// copied. This function is intentionally not called by the LIGHT tests.
function prepare(directory) {
  const cp = require('node:child_process');
  const out = path.resolve(directory);
  fs.mkdirSync(out, { recursive: true });
  const put = (name, bytes) => fs.writeFileSync(path.join(out, name), bytes, { flag: 'wx' });
  const libraries = {
    kernel32: ['ExitProcess@4', 'GetCurrentProcessId@0', 'Sleep@4', 'CreateEventA@16', 'GetStdHandle@4', 'WriteFile@20', 'CreateFileA@28', 'LoadLibraryA@4', 'GetProcAddress@8', 'FreeLibrary@4', 'SetCurrentDirectoryA@4', 'CreateProcessA@40', 'GetExitCodeProcess@8', 'TerminateProcess@8',
      'SetEvent@4', 'WaitForSingleObject@8', 'CloseHandle@4'],
    ole32: ['CoInitialize@4', 'CoInitializeEx@8', 'CoUninitialize@0',
      'CoRegisterClassObject@20', 'CoRevokeClassObject@4', 'CoGetClassObject@20', 'CoCreateInstance@20'],
    advapi32: ['RegCreateKeyA@12', 'RegSetValueA@20', 'RegCloseKey@4'],
    oleaut32: ['SysAllocStringLen@8', 'SysFreeString@4', 'SysStringLen@4', 'LoadTypeLib@8', 'RegisterTypeLib@12'],
  };
  for (const [dll, names] of Object.entries(libraries)) {
    put(dll + '.def', 'LIBRARY ' + dll + '.dll\nEXPORTS\n' + names.join('\n') + '\n');
    cp.execFileSync('llvm-dlltool', ['-m', 'i386', '-k', '-d', path.join(out, dll + '.def'), '-l', path.join(out, dll + '.lib')]);
  }
  const inputs = [
    ['localserver-fixture', serverSource, []],
    ['localserver-dispatch', dispatchServerSource, []],
    ['localserver-single', serverSource, ['-DFIXTURE_FLAGS=0']],
    ['localserver-multi-separate', serverSource, ['-DFIXTURE_FLAGS=2']],
    ['localserver-fails', serverSource, ['-DFIXTURE_FAIL=1']],
    ['localserver-no-register', serverSource, ['-DFIXTURE_NO_REGISTER=1']],
    ['localserver-client', clientSource, []],
    ['localserver-create-client', createClientSource, []],
    ['localserver-failure-client', failureClientSource, []],
    ['localserver-missing-client', failureClientSource, ['-DEXPECTED_HRESULT=0x800401f5']],
    ['localserver-dispatch-client', dispatchClientSource, []],
    ['localserver-registration', registrationSource, []],
    ['localserver-registration-create', registrationCreateSource, []],
    ['ikernel-typeinfo', typeInfoSource, []],
    ['ikernel-proxy-factory', proxyFactorySource, []],
    ['ikernel-embedding-client', embeddingSource, []],
  ];
  const result = [];
  for (const [name, source, definitions] of inputs) {
    put(name + '.c', source);
    cp.execFileSync('clang', ['--target=i686-pc-windows-msvc', '-ffreestanding', '-fno-stack-protector',
      '-fno-builtin', '-O1', ...definitions, '-c', path.join(out, name + '.c'), '-o', path.join(out, name + '.obj')]);
    cp.execFileSync('ld', ['-mi386pe', '--entry', '_start', '--subsystem', 'console', '--disable-dynamicbase',
      '--no-insert-timestamp', '-o', path.join(out, name + '.exe'), path.join(out, name + '.obj'),
      ...Object.keys(libraries).map(dll => path.join(out, dll + '.lib'))]);
    const bytes = fs.readFileSync(path.join(out, name + '.exe'));
    result.push({ name, sourceSHA256: sha(Buffer.from(source)), definitions, bytes: bytes.length, sha256: sha(bytes) });
  }
  put('prepared.json', JSON.stringify({ authoredOnly: true, nativeExecution: false, inputs: result }, null, 2) + '\n');
  return result;
}

if (require.main === module) {
  test('retained original reaches LOCAL_SERVER only after real child merge', () => {
    const log = fs.readFileSync(path.join(prior, 'native.stdout.log'), 'utf8');
    const merge = log.indexOf('[spawn] child state merged: 0 file(s) written, 0 deleted, 298 registry/INI key(s)');
    const activation = log.indexOf('[host] com_create_instance(0x1b5a0, 0, 0x40000004, 0x1b460, 0x74fff3c) => 0x80040154');
    assert(merge >= 0 && activation > merge);
    const result = JSON.parse(fs.readFileSync(path.join(prior, 'result.json')));
    assert.equal(result.original.originalChildRegistrationObserved, true);
    assert.equal(result.original.installed, false);
    assert.equal(result.original.secondOriginal, false);
    assert.equal(result.original.laterRequestsOrInput, 0);
  });
  test('retained release and its named evidence are hash sealed', () => {
    const bytes = fs.readFileSync(path.join(prior, 'runtime-release.json'));
    assert.equal(sha(bytes), 'aff6c8407701d44b67448ae51d9a3d310c4e14705ef118b0a236caddf0e22f4b');
    const release = JSON.parse(bytes);
    assert.equal(release.sourceBuildRuntimeReleased, true);
    for (const row of release.evidence) {
      assert.equal(sha(fs.readFileSync(path.join(prior, row.path))), row.sha256, row.path);
    }
  });
}
module.exports = { commonSource, serverSource, clientSource, createClientSource, failureClientSource, dispatchServerSource, dispatchClientSource, registrationSource, registrationCreateSource, typeInfoSource, proxyFactorySource, embeddingSource, childWaitObserverSource, prepare };
