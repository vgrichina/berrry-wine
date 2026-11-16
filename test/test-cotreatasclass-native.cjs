'use strict';
// Compile small ordinary Win32 clients. --prepare never launches the emulator.
// The clients call DLL imports and inspect actual native registry state; no
// test-only HRESULT hooks or preinstalled application registrations are used.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');

const header = String.raw`
typedef unsigned long U; typedef long H; typedef void *P;
typedef struct { U a; unsigned short b,c; unsigned char d[8]; } G;
#define API __declspec(dllimport) __stdcall
H API CoTreatAsClass(const G*,const G*);
H API CoGetTreatAsClass(const G*,G*);
H API CoCreateInstance(const G*,P,U,const G*,P*);
H API CoGetClassObject(const G*,U,P,const G*,P*);
H API RegCreateKeyA(U,const char*,U*);
H API RegSetValueExA(U,const char*,U,U,const unsigned char*,U);
H API RegOpenKeyA(U,const char*,U*);
H API RegQueryValueExA(U,const char*,U*,U*,unsigned char*,U*);
H API RegCloseKey(U);
H API RegDeleteKeyA(U,const char*);
void API ExitProcess(U);
U API GetCommandLineA(void);
H API CreateProcessA(const char*,char*,P,P,int,U,P,const char*,P,P);
U API WaitForSingleObject(U,U);
H API GetExitCodeProcess(U,U*);
static const G a={0x12345678,0x9abc,0xdef0,{0x12,0x34,0x56,0x78,0x9a,0xbc,0xde,0xf0}};
static const G b={0x87654321,0xcba9,0x0fed,{0xf0,0xde,0xbc,0x9a,0x78,0x56,0x34,0x12}};
static const G c={0x03254769,0x8bad,0xcafe,{1,2,3,4,5,6,7,8}}, zero={0};
static const char key[]="CLSID\\{12345678-9abc-def0-1234-56789abcdef0}";
static const char treat[]="CLSID\\{12345678-9abc-def0-1234-56789abcdef0}\\TreatAs";
static const char automatic[]="CLSID\\{12345678-9abc-def0-1234-56789abcdef0}\\AutoTreatAs";
static const char bs[]="{87654321-cba9-0fed-f0de-bc9a78563412}";
static const char cs[]="{03254769-8bad-cafe-0102-030405060708}";
static void check(int yes,U line){if(!yes)ExitProcess(line);}
#define C(x) check((x),__LINE__)
static int equal(const void *x,const void *y,U n){const unsigned char *a=x,*b=y;while(n--)if(*a++!=*b++)return 0;return 1;}
static void reg(const char *p,const char *s,U n){U h; C(!RegCreateKeyA(0x80000000,p,&h));C(!RegSetValueExA(h,"",0,1,(const unsigned char*)s,n));C(!RegCloseKey(h));}
static void query(const char *s){U h,n=100,t=0;unsigned char out[100];C(!RegOpenKeyA(0x80000000,treat,&h));C(!RegQueryValueExA(h,"",0,&t,out,&n));C(t==1&&n==39&&equal(s,out,39));C(!RegCloseKey(h));}
static void absent(void){U h;C(RegOpenKeyA(0x80000000,treat,&h)==2);}
static void getter(const G *expected,H hr){G out;C(CoGetTreatAsClass(&a,&out)==hr);C(equal(&out,expected,16));}
`;

const contracts = header + String.raw`
void start(void){U h;
  C(CoTreatAsClass(&a,&b)==(H)0x80040154); absent();
  C(!RegCreateKeyA(0x80000000,key,&h)); C(!RegCloseKey(h));
  getter(&a,1);
  C(!CoTreatAsClass(&a,&b)); query(bs); getter(&b,0);
  C(!CoTreatAsClass(&a,&c)); query(cs); getter(&c,0);
  C(!CoTreatAsClass(&a,&zero)); absent(); getter(&a,1);
  C(!CoTreatAsClass(&a,&zero)); absent();
  C(!CoTreatAsClass(&a,&b)); C(!CoTreatAsClass(&a,&a)); absent();
  reg(automatic,cs,39); C(!CoTreatAsClass(&a,&a)); query(cs); getter(&c,0);
  C(!CoTreatAsClass(&a,&zero)); absent();
  reg(automatic,"invalid-guid",13);
  C(CoTreatAsClass(&a,&a)<0); absent();
  C(!RegDeleteKeyA(0x80000000,automatic));
  reg(treat,"invalid-guid",13);
  G invalidOut; C(CoGetTreatAsClass(&a,&invalidOut)==(H)0x800401f3);
  P invalidObject=(P)1; C(CoCreateInstance(&a,0,1,&zero,&invalidObject)==(H)0x800401f3); C(!invalidObject);
  C(!CoTreatAsClass(&a,&b)); query(bs);
  // The target need not be registered. Native activation must fail honestly.
  P out=(P)0x1234; C(CoCreateInstance(&a,0,1,&zero,&out)==(H)0x80040154);C(!out);
  out=(P)0x1234; C(CoGetClassObject(&a,1,0,&zero,&out)==(H)0x80040154);C(!out);
  C(CoTreatAsClass(0,&b)==(H)0x80070057);
  C(CoTreatAsClass(&a,0)==(H)0x80070057); query(bs);
  C(!CoTreatAsClass(&a,&zero)); absent(); ExitProcess(0);
}`;
const child = header + String.raw`
void start(void){query(bs);getter(&b,0);C(!CoTreatAsClass(&a,&c));query(cs);ExitProcess(0);}`;
const parent = header + String.raw`
void start(void){U si[17]={0},pi[4]={0},result=99;char command[]="c:\\child.exe";U h;
  absent();C(!RegCreateKeyA(0x80000000,key,&h));C(!RegCloseKey(h));
  C(!CoTreatAsClass(&a,&b));query(bs);si[0]=68;
  C(CreateProcessA(command,0,0,0,0,0,0,0,si,pi));
  C(WaitForSingleObject(pi[0],0xffffffff)==0);C(GetExitCodeProcess(pi[0],&result));C(!result);
  query(cs);getter(&c,0);ExitProcess(0);}`;
const isolated = header + String.raw`
void start(void){absent();getter(&a,1);C(CoTreatAsClass(&a,&b)==(H)0x80040154);ExitProcess(0);}`;
const activation = header + String.raw`
typedef struct { H (__stdcall *qi)(P,const G*,P*); U (__stdcall *add)(P); U (__stdcall *release)(P);
 H (__stdcall *create)(P,P,const G*,P*); H (__stdcall *lock)(P,int); } F;
static const G unknown={0,0,0,{0xc0,0,0,0,0,0,0,0x46}},factory={1,0,0,{0xc0,0,0,0,0,0,0,0x46}};
static const G link={0x21401,0,0,{0xc0,0,0,0,0,0,0,0x46}};
void start(void){U h;P p=0,o=0;F *v;
  C(!RegCreateKeyA(0x80000000,key,&h));C(!RegCloseKey(h));
  reg("CLSID\\{87654321-cba9-0fed-f0de-bc9a78563412}\\InprocServer32","C:\\emulation.dll",17);
  C(!CoTreatAsClass(&a,&b));
  C(!CoGetClassObject(&a,1,0,&factory,&p));C(p!=0);v=*(F**)p;
  C(!v->create(p,0,&unknown,&o));C(o!=0);(*(F**)o)->release(o);v->release(p);
  o=0;C(!CoCreateInstance(&a,0,1,&unknown,&o));C(o!=0);(*(F**)o)->release(o);
  // Actual native local-class activation also consumes TreatAs before its fast path.
  C(!CoTreatAsClass(&b,&link));o=0;C(!CoCreateInstance(&a,0,1,&unknown,&o));C(o!=0);(*(F**)o)->release(o);
  C(!CoTreatAsClass(&b,&a));o=(P)1;C(CoCreateInstance(&a,0,1,&unknown,&o)==(H)0x800401f3);C(!o);
  ExitProcess(0);}`;
const server = header + String.raw`
typedef struct { H (__stdcall *qi)(P,const G*,P*); U (__stdcall *add)(P); U (__stdcall *release)(P);
 H (__stdcall *create)(P,P,const G*,P*); H (__stdcall *lock)(P,int); } F;
static const G unknown={0,0,0,{0xc0,0,0,0,0,0,0,0x46}},factory={1,0,0,{0xc0,0,0,0,0,0,0,0x46}};
static F fv,ov;static F *f=&fv,*o=&ov;
static U __stdcall ref(P p){return 2;}
static U __stdcall unref(P p){return 1;}
static H __stdcall qi(P p,const G *id,P *out){*out=0;if(equal(id,&unknown,16)||(p==&f&&equal(id,&factory,16))){*out=p;return 0;}return (H)0x80004002;}
static int busy;
static H __stdcall create(P p,P outer,const G *id,P *out){
  *out=0;if(outer)return (H)0x80040110;
  if(!busy){P nested=0;busy=1;H hr=CoCreateInstance(&a,0,1,&unknown,&nested);busy=0;
    if(hr||!nested)return (H)0x80004005;(*(F**)nested)->release(nested);}
  return qi(&o,id,out);
}
static H __stdcall lock(P p,int flag){return 0;}
static F fv={qi,ref,unref,create,lock},ov={qi,ref,unref,0,0};
H __stdcall DllGetClassObject(const G *id,const G *iid,P *out){*out=0;if(!equal(id,&b,16))return (H)0x80040154;return qi(&f,iid,out);}
int __stdcall DllMain(P module,U reason,P reserved){return 1;}`;

function prepare(directory) {
  const out = path.resolve(directory); fs.mkdirSync(out, { recursive: true });
  const defs = {
    ole32: ['CoTreatAsClass@8','CoGetTreatAsClass@8','CoCreateInstance@20','CoGetClassObject@20'],
    advapi32: ['RegCreateKeyA@12','RegSetValueExA@24','RegOpenKeyA@12','RegQueryValueExA@24','RegCloseKey@4','RegDeleteKeyA@8'],
    kernel32: ['ExitProcess@4','GetCommandLineA@0','CreateProcessA@40','WaitForSingleObject@8','GetExitCodeProcess@8'],
  };
  for (const [dll, exports] of Object.entries(defs)) {
    const def = path.join(out,dll+'.def'), lib = path.join(out,dll+'.lib');
    fs.writeFileSync(def, `LIBRARY ${dll}.dll\nEXPORTS\n${exports.join('\n')}\n`, {flag:'wx'});
    cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',def,'-l',lib]);
  }
  for (const [name, source] of Object.entries({contracts,child,parent,isolated,activation,emulation:server})) {
    const c = path.join(out,name+'.c'), obj = path.join(out,name+'.obj'), exe = path.join(out,name+'.exe');
    fs.writeFileSync(c,source,{flag:'wx'});
    cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',c,'-o',obj]);
    if(name==='emulation'){
      const def=path.join(out,'emulation.def');fs.writeFileSync(def,'EXPORTS\nDllGetClassObject=DllGetClassObject@12\n',{flag:'wx'});
      cp.execFileSync('ld',['-mi386pe','--dll','--entry','_DllMain@12','--subsystem','windows','--disable-dynamicbase','--kill-at','-o',path.join(out,'emulation.dll'),obj,def,...Object.keys(defs).map(d=>path.join(out,d+'.lib'))]);
    } else {
      cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','console','--disable-dynamicbase','-o',exe,obj,...Object.keys(defs).map(d=>path.join(out,d+'.lib'))]);
      assert.equal(fs.readFileSync(exe).readUInt16LE(0),0x5a4d);
    }
  }
  const args = name => ['test/run.js','--exe='+path.join(out,name+'.exe'),'--no-build','--real-ticks','--max-seconds=20','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks',
    ...(name==='parent'?['--spawn-processes','--vfs-include=child.exe','--cwd=C:\\']:[]),
    ...(name==='activation'?['--vfs-include=*.dll','--cwd=C:\\']:[])];
  fs.writeFileSync(path.join(out,'recipes.json'), JSON.stringify({fixtureOnly:true, compiledC:true, nativeExecution:false,
    commands:['contracts','parent','isolated','activation'].map(name=>({name,command:[process.execPath,...args(name)],expectedExit:0}))},null,2)+'\n',{flag:'wx'});
  return out;
}
module.exports={prepare};
if(require.main===module){assert(process.argv.includes('--prepare'),'prepare only; run recipes after release');console.log(prepare(process.argv[2]));}
