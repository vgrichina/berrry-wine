'use strict';
// Authored modal dialog: real native progress storage behind a guest subclass.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
void API ExitProcess(U);P API GetModuleHandleA(const char*);
long API DialogBoxIndirectParamA(P,const void*,P,P,long);int API EndDialog(P,int);
P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
int API ShowWindow(P,int);P API SetFocus(P);int API UpdateWindow(P);
long API SetWindowLongA(P,int,long);long API CallWindowProcA(P,P,U,U,long);long API SendMessageA(P,U,U,long);
struct T{U style,ex;unsigned short count;short x,y,cx,cy;unsigned short menu,cls,title;} __attribute__((packed,aligned(4)));
static struct T root={0x80c80000,0,0,10,10,300,180,0,0,0};
static P old,frame;static U paints;
long __stdcall barproc(P h,U m,U w,long l){
 if(m==15)SetWindowLongA(frame,-21,++paints);
 return CallWindowProcA(old,h,m,w,l);
}
long __stdcall proc(P h,U m,U w,long l){P i=GetModuleHandleA(0),b,next;
 if(m==0x110){frame=h;
  CreateWindowExA(0,"STATIC","Authored installation progress",0x50000000,15,25,340,25,h,(P)101,i,0);
  b=CreateWindowExA(0,"msctls_progress32","",0x50000001,15,90,340,22,h,(P)102,i,0);
  old=(P)SetWindowLongA(b,-4,(long)barproc);
  SendMessageA(b,0x406,7,913);SendMessageA(b,0x402,318,0);
  next=CreateWindowExA(0,"BUTTON","Close",0x50010001,240,160,90,28,h,(P)1,i,0);
  ShowWindow(h,1);UpdateWindow(b);SetFocus(next);return 0;}
 if((m==0x111&&(w&65535)==1)||m==0x10){EndDialog(h,0);return 1;}
 return 0;
}
void start(void){DialogBoxIndirectParamA(GetModuleHandleA(0),&root,0,proc,0);ExitProcess(0);}
`;
function prepare(out){
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/progress.c',source);
 for(const [dll,names] of Object.entries({kernel32:['ExitProcess@4','GetModuleHandleA@4'],user32:['DialogBoxIndirectParamA@20','EndDialog@8','SetWindowLongA@12','CallWindowProcA@20','CreateWindowExA@48','ShowWindow@8','SetFocus@4','UpdateWindow@4','SendMessageA@16']})){
  fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');
  cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);
 }
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/progress.c','-o',out+'/progress.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/progress.exe',out+'/progress.obj',out+'/kernel32.lib',out+'/user32.lib']);
 return out+'/progress.exe';
}
module.exports={prepare};
if(require.main===module)console.log(prepare(path.resolve(process.argv[2])));
