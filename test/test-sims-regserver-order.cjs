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
static const char key[]="CLSID\\{52B8A1CA-3219-4317-AFB7-803111125693}\\InprocServer32";
static P output;
static void report(const char *s,U v){char b[160];U n=0,i,w=0;while(s[n]){b[n]=s[n];n++;}b[n++]='=';for(i=0;i<8;i++)b[n++]="0123456789abcdef"[(v>>(28-i*4))&15];b[n++]='\n';b[n]=0;OutputDebugStringA(b);
 if(!output)output=CreateFileA(CHILD?"C:\\registrar-report.txt":"C:\\parent-report.txt",0x40000000,3,0,2,0,0);
 WriteFile(output,b,n,&w,0);}
static void check(U yes,U code){if(!yes)ExitProcess(code);}
static U query(void){P k=0;char b[128];U n=128,t=0;H h=RegOpenKeyExA((P)0x80000000,key,0,0x20019,&k);if(!h){h=RegQueryValueExA(k,"",0,&t,b,&n);RegCloseKey(k);}return h;}
static H activate(void){P o=0;H hr=CoCreateInstance(cls,0,1,unk,&o);if(!hr&&o){P *v=*(P**)o;((U(CALL*)(P))v[2])(o);}return hr;}
static void parent(void){U si[17]={68},pi[4]={0},code=259,w;char cmd[]="C:\\order\\registrar.exe -RegServer";
 CoInitialize(0);check(query()==2,16);check((U)activate()==0x80040154,17);
 check(CreateProcessA(0,cmd,0,0,0,0,0,0,si,pi),10);report("parent.process",pi[0]);
 w=WaitForSingleObject((P)pi[0],10000);report("parent.wait",w);
 check(GetExitCodeProcess((P)pi[0],&code),11);report("parent.child-code",code);
 report("after.query",query());report("after.activation",activate());
 CloseHandle((P)pi[1]);CloseHandle((P)pi[0]);
 check(w==0,12);check(code==CHILD_CODE,13);check(query()==(CHILD_CODE?2:0),14);
 check((U)activate()==(CHILD_CODE?0x80040154:0),15);
}
static H CALL dialog(P hwnd,U msg,U wp,U lp){if(msg==0x110){if(DIALOG==1)parent();return 1;}return 0;}
void start(void){
#if CHILD
 P k=0;U disp=0;report("child.begin",CHILD_CODE);
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
 const libs={kernel32:['ExitProcess@4','OutputDebugStringA@4','CreateFileA@28','GetStdHandle@4','WriteFile@20','CreateProcessA@40','WaitForSingleObject@8','GetExitCodeProcess@8','CloseHandle@4'],advapi32:['RegCreateKeyExA@36','RegOpenKeyExA@20','RegSetValueExA@24','RegQueryValueExA@24','RegCloseKey@4'],ole32:['CoInitialize@4','CoCreateInstance@20'],user32:['CreateDialogIndirectParamA@20','EndDialog@8','DestroyWindow@4']};
 for(const [name,names]of Object.entries(libs)){fs.writeFileSync(path.join(out,name+'.def'),'LIBRARY '+name+'.dll\nEXPORTS\n'+names.join('\n')+'\n');run('llvm-dlltool',['-m','i386','-k','-d',path.join(out,name+'.def'),'-l',path.join(out,name+'.lib')]);}
 function compile(name,file,defs=[],shared=false){run('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1',...defs,'-c',path.join(out,file),'-o',path.join(out,name+'.obj')]);run('ld',['-mi386pe','--entry',shared?'_entry@12':'_start','--subsystem','console','--disable-dynamicbase','--no-insert-timestamp',...(shared?['--shared','--kill-at']:[]),'-o',path.join(out,name+(shared?'.dll':'.exe')),path.join(out,name+'.obj'),...Object.keys(libs).map(n=>path.join(out,n+'.lib'))]);}
 compile('factory','factory.c',[],true);
 for(const [name,child,code,dialog]of [['registrar',1,0,0],['failure',1,37,0],['parent',0,0,0],['parent-failure',0,37,0],['parent-dialog',0,0,1],['parent-visible',0,0,2]])compile(name,'client.c',[`-DCHILD=${child}`,`-DCHILD_CODE=${code}`,`-DDIALOG=${dialog}`]);
}
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function verifyNative(out, failure=false){
 const read=name=>JSON.parse(fs.readFileSync(path.join(out,name),'utf8'));
 for(const name of ['native-wait.json','watchdog-wait.json','outer-child-wait.json']){
  const w=read(name);assert.equal(w.exit,0,name);for(const k of ['actualWait','stdoutEOF','stderrEOF'])assert.equal(w[k],true,name+': '+k);
 }
 const child=fs.readdirSync(out).filter(n=>/^native-child-.*-wait.json$/.test(n));assert.equal(child.length,1);
 const w=read(child[0]);for(const k of ['actualWait','stdoutEOF','stderrEOF','closed'])assert.equal(w[k],true);
 assert.equal(w.exit,0);assert.equal(w.guardedMerge.merged,true);
 const report=fs.readFileSync(path.join(out,'saves/parent-report.txt'),'utf8');
 for(const line of ['parent.wait=00000000','parent.child-code='+(failure?'00000025':'00000000'),'after.query='+(failure?'00000002':'00000000'),'after.activation='+(failure?'80040154':'00000000'),'parent.done=00000000'])assert(report.includes(line),line+' missing: '+report);
 const registrar=fs.readFileSync(path.join(out,'saves/registrar-report.txt'),'utf8');
 assert(registrar.includes('child.exit='+(failure?'00000025':'00000000')));
 if(!failure)assert(registrar.includes('child.query=00000000'));
 return {report,registrar,childWait:child[0],keys:w.guardedMerge.keys};
}
function native(directory,wasm){
 const root=path.resolve(__dirname,'..'),out=path.resolve(directory);fs.mkdirSync(out,{recursive:true});
 const fixtures=path.join(out,'fixtures');prepare(fixtures);
 const pins={module:{path:path.resolve(wasm),sha256:sha(wasm)},testSHA256:sha(__filename),fixtures:fs.readdirSync(fixtures).filter(n=>/\.(exe|dll|c)$/.test(n)).map(n=>({name:n,sha256:sha(path.join(fixtures,n))}))};
 fs.writeFileSync(path.join(out,'before-exec.json'),JSON.stringify(pins,null,2));
 const results=[];
 for(const [name,exe,failure]of [['normal','parent',false],['dialog','parent-dialog',false],['visible','parent-visible',false],['failure','parent-failure',true]]){
  const dir=path.join(out,name);fs.mkdirSync(dir);
  const args=[process.execPath,path.join(root,'test/run.js'),'--exe='+path.join(fixtures,exe+'.exe'),'--no-build','--wasm='+path.resolve(wasm),'--exe-guest-path=C:\\order\\parent.exe','--vfs-mount='+path.join(fixtures,failure?'failure.exe':'registrar.exe')+'=C:\\order\\registrar.exe','--vfs-mount='+path.join(fixtures,'factory.dll')+'=C:\\order\\factory.dll','--dll-seed='+path.join(fixtures,'factory.dll'),'--spawn-processes','--real-ticks','--max-seconds=30','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--save-vfs='+path.join(dir,'saves')];
  fs.writeFileSync(path.join(dir,'recipe.json'),JSON.stringify({args,cwd:root,seconds:40,watchdogGrace:5,env:{WINE_COM_PROTOCOL_DIR:dir}},null,2));
  const p=cp.spawnSync('python3',['-B',path.join(root,'tools/forsaken-supervisor.py'),'outerwait',dir],{encoding:'utf8',timeout:55000});
  fs.writeFileSync(path.join(dir,'direct-wait.json'),JSON.stringify({pid:p.pid,exit:p.status,signal:p.signal,actualWait:p.status!==null,stdoutEOF:!p.error,stderrEOF:!p.error,stdout:p.stdout,stderr:p.stderr,error:p.error?.message},null,2));assert.equal(p.status,0,p.stderr||p.error?.message);
  results.push({name,...verifyNative(dir,failure)});assert.equal(sha(wasm),pins.module.sha256);
 }
 fs.writeFileSync(path.join(out,'verified.json'),JSON.stringify({pins,results},null,2));console.log('PASS native parent/RegServer ordering: normal, dialog, visible, failure');
}
if(require.main===module){
 if(process.argv[2]==='--prepare')prepare(path.resolve(process.argv[3]));
 else if(process.argv[2]==='--native')native(process.argv[3],process.argv[4]);
 else throw Error('use --prepare DIRECTORY or --native DIRECTORY WASM');
}
module.exports={prepare,verifyNative,native,source,dll};
