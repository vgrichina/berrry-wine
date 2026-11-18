'use strict';
// Authored modeless wizard: popup -> native Static -> child dialog -> Static
// -> child dialog. Every HWND is created by ordinary guest USER calls.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
void API ExitProcess(U);void API Sleep(U);P API GetModuleHandleA(const char*);int API SetWindowTextA(P,const char*);
P API CreateDialogIndirectParamA(P,const void*,P,P,long);
long API DialogBoxIndirectParamA(P,const void*,P,P,long);int API EndDialog(P,int);
P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
int API ShowWindow(P,int);P API SetFocus(P);int API DestroyWindow(P);
int API GetMessageA(void*,P,U,U);int API TranslateMessage(void*);long API DispatchMessageA(void*);
void API PostQuitMessage(int);long API SendMessageA(P,U,U,long);
struct T {U style,ex;unsigned short count;short x,y,cx,cy;unsigned short menu,cls,title;} __attribute__((packed,aligned(4)));
static struct T root={0x80c80000,0,0,10,10,349,253,0,0,0};
static struct T page={0x40000000,0,0,0,0,310,180,0,0,0};
static struct T nested={0x40000000,0,0,0,0,180,70,0,0,0};
static P mainWindow,label;
long __stdcall pageproc(P h,U m,U w,long l){return 0;}
long __stdcall proc(P h,U m,U w,long l){if(m==0x111&&(w&65535)==1){SetWindowTextA(label,"Authored next page reached");return 1;}if(m==0x111&&(w&65535)==2){EndDialog(h,0);return 1;}if(m==0x10){EndDialog(h,0);return 1;}if(m==0x110){P i=GetModuleHandleA(0),frame,a,inner,b,cancel,next;mainWindow=h;
SendMessageA(mainWindow,0xC,0,(long)"Authored nested wizard");
frame=CreateWindowExA(0,"STATIC","",0x50000000,8,8,500,300,mainWindow,(P)100,i,0);
a=CreateDialogIndirectParamA(i,&page,frame,pageproc,0);
inner=CreateWindowExA(0,"STATIC","",0x50000000,8,8,290,110,a,(P)101,i,0);
b=CreateDialogIndirectParamA(i,&nested,inner,pageproc,0);
label=CreateWindowExA(0,"STATIC","Authored wizard page",0x50000000,8,8,250,25,b,(P)102,i,0);
next=CreateWindowExA(0,"BUTTON","Next",0x50010001,250,330,90,28,mainWindow,(P)1,i,0);
cancel=CreateWindowExA(0,"BUTTON","Cancel",0x50010000,350,330,90,28,mainWindow,(P)2,i,0);
ShowWindow(b,5);ShowWindow(a,5);ShowWindow(mainWindow,1);SetFocus(next);
return 0;}return 0;}
void start(void){DialogBoxIndirectParamA(GetModuleHandleA(0),&root,0,proc,0);Sleep(2500);ExitProcess(0);}
`;
function prepare(out){
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'wizard.c'),source);
 for(const [dll,names] of Object.entries({kernel32:['ExitProcess@4','Sleep@4','GetModuleHandleA@4'],user32:['SetWindowTextA@8','CreateDialogIndirectParamA@20','DialogBoxIndirectParamA@20','EndDialog@8','CreateWindowExA@48','ShowWindow@8','SetFocus@4','DestroyWindow@4','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','PostQuitMessage@4','SendMessageA@16']})){
  fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');
  cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);
 }
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/wizard.c','-o',out+'/wizard.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/wizard.exe',out+'/wizard.obj',out+'/kernel32.lib',out+'/user32.lib']);
 return out+'/wizard.exe';
}
module.exports={prepare,source};
if(require.main===module)console.log(prepare(path.resolve(process.argv[2])));
