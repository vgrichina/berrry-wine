'use strict';
// Ordinary installer-style wizard. The application subclasses LISTBOX,
// chains every message (including painting) through its saved native proc,
// and records WM_PAINT / LB_ADDSTRING entries in its own guest globals.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
void API ExitProcess(U);P API GetModuleHandleA(const char*);int API SetWindowTextA(P,const char*);
P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
int API ShowWindow(P,int);P API SetFocus(P);int API DestroyWindow(P);
int API GetMessageA(void*,P,U,U);int API TranslateMessage(void*);long API DispatchMessageA(void*);
void API PostQuitMessage(int);long API SendMessageA(P,U,U,long);
long API SetWindowLongA(P,int,long);long API CallWindowProcA(P,P,U,U,long);long API DefWindowProcA(P,U,U,long);
unsigned short API RegisterClassA(const void*);
static P label,oldList;static U painted,added;
long __stdcall listproc(P h,U m,U w,long l){long r;
 if(m==0xF)painted++;if(m==0x180)added++;
 r=CallWindowProcA(oldList,h,m,w,l);
 return r;}
long __stdcall proc(P h,U m,U w,long l){
 if(m==0x111&&(w&65535)==1){SetWindowTextA(label,"Authored next page reached");return 0;}
 if((m==0x111&&(w&65535)==2)||m==0x10){DestroyWindow(h);return 0;}
 if(m==2){PostQuitMessage(0);return 0;}
 return DefWindowProcA(h,m,w,l);
}
struct WC {U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
void start(void){P i=GetModuleHandleA(0),h,list,next;U message[7];struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"AuthoredWizard"};wc.instance=i;RegisterClassA(&wc);
 h=CreateWindowExA(0,"AuthoredWizard","Authored installer wizard",0x10cf0000,15,16,531,441,0,0,i,0);
 label=CreateWindowExA(0,"STATIC","Authored wizard page",0x50000000,15,30,300,25,h,(P)102,i,0);
 list=CreateWindowExA(0,"LISTBOX","",0x50810003,15,150,220,80,h,(P)1017,i,0);
 oldList=(P)SetWindowLongA(list,-4,(long)listproc);
 SendMessageA(list,0x180,0,(long)"English (International)");SendMessageA(list,0x186,0,0);
 next=CreateWindowExA(0,"BUTTON","Next",0x50010001,250,330,90,28,h,(P)1,i,0);
 CreateWindowExA(0,"BUTTON","Cancel",0x50010000,350,330,90,28,h,(P)2,i,0);
 ShowWindow(h,1);SetFocus(next);
 while(GetMessageA(message,0,0,0)>0){TranslateMessage(message);DispatchMessageA(message);}ExitProcess(0);
}
`;
function prepare(out){
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/wizard.c',source);
 for(const [dll,names] of Object.entries({kernel32:['ExitProcess@4','GetModuleHandleA@4'],user32:['RegisterClassA@4','DefWindowProcA@16','SetWindowLongA@12','CallWindowProcA@20','SetWindowTextA@8','CreateWindowExA@48','ShowWindow@8','SetFocus@4','DestroyWindow@4','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','PostQuitMessage@4','SendMessageA@16']})){
  fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');
  cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);
 }
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/wizard.c','-o',out+'/wizard.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/wizard.exe',out+'/wizard.obj',out+'/kernel32.lib',out+'/user32.lib']);
 return out+'/wizard.exe';
}
module.exports={prepare,source};
if(require.main===module)console.log(prepare(path.resolve(process.argv[2])));
