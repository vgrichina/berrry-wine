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
// Ordinary modal wizard with a real guest BUTTON subclass. Next replaces its
// child page and moves focus during the callback; the callback returns through
// the native DialogBox continuation rather than a GetMessage return.
const transitionSource=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
void API ExitProcess(U);P API GetModuleHandleA(const char*);
long API DialogBoxIndirectParamA(P,const void*,P,P,long);int API EndDialog(P,int);
P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
int API ShowWindow(P,int);P API SetFocus(P);int API DestroyWindow(P);
long API SetWindowLongA(P,int,long);long API CallWindowProcA(P,P,U,U,long);long API SendMessageA(P,U,U,long);
struct T{U style,ex;unsigned short count;short x,y,cx,cy;unsigned short menu,cls,title;} __attribute__((packed,aligned(4)));
static struct T root={0x80c80000,0,0,10,10,349,253,0,0,0};
static P frame,label,list,next,oldButton;
long __stdcall button(P h,U m,U w,long l){long r=CallWindowProcA(oldButton,h,m,w,l);
 if(m==0x201)SendMessageA(frame,0x111,1,(long)h);return r;}
long __stdcall proc(P h,U m,U w,long l){P i=GetModuleHandleA(0);
 if(m==0x110){frame=h;
  label=CreateWindowExA(0,"STATIC","Welcome page",0x50000000,15,30,350,25,h,(P)102,i,0);
  list=CreateWindowExA(0,"LISTBOX","",0x50810003,15,150,220,80,h,(P)1017,i,0);
  SendMessageA(list,0x180,0,(long)"English (International)");SendMessageA(list,0x186,0,0);
  next=CreateWindowExA(0,"BUTTON","Next",0x50010001,250,330,90,28,h,(P)1,i,0);
  oldButton=(P)SetWindowLongA(next,-4,(long)button);
  CreateWindowExA(0,"BUTTON","Cancel",0x50010000,350,330,90,28,h,(P)2,i,0);
  ShowWindow(h,1);SetFocus(list);return 0;}
 if(m==0x111&&(w&65535)==1){P edit;
  DestroyWindow(list);DestroyWindow(label);
  label=CreateWindowExA(0,"STATIC","License page replaced welcome controls",0x50000000,15,30,430,25,h,(P)103,i,0);
  edit=CreateWindowExA(0,"EDIT","Authored license terms",0x50810004,15,90,400,150,h,(P)104,i,0);
  SetFocus(edit);return 1;}
 if((m==0x111&&(w&65535)==2)||m==0x10){EndDialog(h,0);return 1;}
 return 0;}
void start(void){DialogBoxIndirectParamA(GetModuleHandleA(0),&root,0,proc,0);ExitProcess(0);}
`;
// Same demonstrated shape as the component page: a guest-subclassed
// LBS_OWNERDRAWVARIABLE list with no HASSTRINGS, and a guest owner. The DWORDs
// include null and non-address values; only the owner may interpret them.
const componentSource=source.replace('static P label,oldList;static U painted,added;',String.raw`
int API TextOutA(P,int,int,const char*,int);
static P label,oldList;static U painted,added,drawn;
struct Measure {U type,id,item,width,height,data;};
struct Draw {U type,id,item,action,state;P hwnd,dc;int left,top,right,bottom;U data;};
`).replace('if(m==0x111&&(w&65535)==1)',String.raw`
 if(m==0x2c){((struct Measure*)l)->height=16;return 1;}
 if(m==0x2b){struct Draw* d=(struct Draw*)l;
  if(d->item<4&&d->data==(d->item==0?0:d->item==1?0xffffffff:d->item==2?0x12345678:7)){
   drawn|=1<<d->item;SetWindowLongA(h,-21,drawn);}
  const char* t=d->data==0?"Zero data":d->data==0xffffffff?"All bits":d->data==0x12345678?"Opaque value":"Fourth row";
  TextOutA(d->dc,d->left+2,d->top+1,t,d->data==0?9:d->data==0xffffffff?8:d->data==0x12345678?12:10);
  return 1;}
 if(m==0x111&&(w&65535)==1)`)
 .replace('0x50810003','0x52a00121')
 .replace('SendMessageA(list,0x180,0,(long)"English (International)");',
 'SendMessageA(list,0x180,0,0);SendMessageA(list,0x180,0,-1);SendMessageA(list,0x180,0,0x12345678);SendMessageA(list,0x180,0,7);');
function prepare(out,{transition=false,destroyTarget=false,components=false}={}){
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/wizard.c',components?componentSource:transition?transitionSource.replace('SetFocus(edit);',destroyTarget?'DestroyWindow(next);SetFocus(edit);':'SetFocus(edit);'):source);
 for(const [dll,names] of Object.entries({gdi32:['TextOutA@20'],kernel32:['ExitProcess@4','GetModuleHandleA@4'],user32:['DialogBoxIndirectParamA@20','EndDialog@8','RegisterClassA@4','DefWindowProcA@16','SetWindowLongA@12','CallWindowProcA@20','SetWindowTextA@8','CreateWindowExA@48','ShowWindow@8','SetFocus@4','DestroyWindow@4','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','PostQuitMessage@4','SendMessageA@16']})){
  fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');
  cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);
 }
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/wizard.c','-o',out+'/wizard.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/wizard.exe',out+'/wizard.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib']);
 return out+'/wizard.exe';
}
module.exports={prepare,source,transitionSource,componentSource};
if(require.main===module)console.log(prepare(path.resolve(process.argv[2])));
