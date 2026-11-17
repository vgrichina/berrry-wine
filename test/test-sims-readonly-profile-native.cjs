'use strict';
// Generated native programs on a generated tiny ISO. No original program runs.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const source=String.raw`
typedef unsigned long U;typedef void *P;
#define API __declspec(dllimport) __stdcall
void API ExitProcess(U);U API GetPrivateProfileStringA(const char*,const char*,const char*,char*,U,const char*);
U API CopyFileA(const char*,const char*,U);U API CreateProcessA(const char*,char*,P,P,U,U,P,P,P,P);
U API WaitForSingleObject(P,U);U API GetExitCodeProcess(P,U*);U API CloseHandle(P);
P API CreateFileA(const char*,U,U,P,U,U,P);U API ReadFile(P,P,U,U*,P);U API WriteFile(P,const void*,U,U*,P);
U API RegCreateKeyA(P,const char*,P*);U API RegSetValueExA(P,const char*,U,U,const void*,U);
U API RegOpenKeyA(P,const char*,P*);U API RegQueryValueExA(P,const char*,U*,U*,P,U*);U API RegCloseKey(P);
void start(void){U n=0,value=0x5317,size=4,type=0,code=99;P file,key=0;
#if CHILD
 file=CreateFileA("C:\\boundary-native.bin",0x40000000,1,0,2,0,0);if(file==(P)-1)ExitProcess(11);
 if(!WriteFile(file,"REAL",4,&n,0)||n!=4)ExitProcess(12);CloseHandle(file);
 if(RegCreateKeyA((P)0x80000001,"Software\\SimsBoundaryControl",&key))ExitProcess(13);
 if(RegSetValueExA(key,"stage",0,4,&value,4))ExitProcess(14);RegCloseKey(key);ExitProcess(0);
#else
 char text[32],out[4],command[]="C:\\child.exe";U startup[17]={68},process[4]={0};
 if(GetPrivateProfileStringA("fixture","value","",text,32,"D:\\maxis.ini")!=7||text[0]!='C'||text[6]!='L')ExitProcess(21);
 static char payload[32768];U copied=0;
 file=CreateFileA("D:\\CHILD.EXE",0x80000000,1,0,3,0,0);if(file==(P)-1)ExitProcess(22);
 if(!ReadFile(file,payload,32768,&copied,0)||!copied)ExitProcess(29);CloseHandle(file);
 file=CreateFileA("C:\\child.exe",0x40000000,1,0,2,0,0);if(file==(P)-1)ExitProcess(30);
 if(!WriteFile(file,payload,copied,&n,0)||n!=copied)ExitProcess(31);CloseHandle(file);
 if(!CreateProcessA(0,command,0,0,0,0,0,"C:\\",startup,process))ExitProcess(23);
 WaitForSingleObject((P)process[0],0xffffffff);GetExitCodeProcess((P)process[0],&code);if(code)ExitProcess(24);
 CloseHandle((P)process[0]);CloseHandle((P)process[1]);
 file=CreateFileA("C:\\boundary-native.bin",0x80000000,1,0,3,0,0);if(file==(P)-1)ExitProcess(25);
 if(!ReadFile(file,out,4,&n,0)||n!=4||out[0]!='R'||out[3]!='L')ExitProcess(26);CloseHandle(file);
 if(RegOpenKeyA((P)0x80000001,"Software\\SimsBoundaryControl",&key))ExitProcess(27);
 value=0;if(RegQueryValueExA(key,"stage",0,&type,&value,&size)||value!=0x5317||type!=4)ExitProcess(28);
 RegCloseKey(key);ExitProcess(0);
#endif
}`;
function iso(files){
 const sector=2048;let next=20;const rows=files.map(([name,data])=>{const row={name,data,lba:next};next+=Math.ceil(data.length/sector);return row;});const b=Buffer.alloc(next*sector);
 const n16=(p,v)=>{b.writeUInt16LE(v,p);b.writeUInt16BE(v,p+2);},n32=(p,v)=>{b.writeUInt32LE(v,p);b.writeUInt32BE(v,p+4);};
 function rec(p,lba,size,flags,name){const id=Buffer.from(name,'ascii'),len=33+id.length+((33+id.length)&1);b[p]=len;n32(p+2,lba);n32(p+10,size);b[p+25]=flags;n16(p+28,1);b[p+32]=id.length;id.copy(b,p+33);return len;}
 let p=16*sector;b[p]=1;b.write('CD001',p+1);b[p+6]=1;b.write('SIMS_BOUNDARY_CONTROL'.padEnd(32),p+40);n32(p+80,next);n16(p+128,sector);rec(p+156,18,sector,2,'\0');
 p=17*sector;b[p]=255;b.write('CD001',p+1);b[p+6]=1;p=18*sector;p+=rec(p,18,sector,2,'\0');p+=rec(p,18,sector,2,'\x01');
 for(const r of rows){p+=rec(p,r.lba,r.data.length,0,r.name+';1');r.data.copy(b,r.lba*sector);}return b;
}
function prepare(directory){const out=path.resolve(directory);fs.mkdirSync(out,{recursive:true});const put=(n,b)=>fs.writeFileSync(path.join(out,n),b,{flag:'wx'});put('control.c',source);
 const names={kernel32:['ExitProcess@4','GetPrivateProfileStringA@24','CopyFileA@12','CreateProcessA@40','WaitForSingleObject@8','GetExitCodeProcess@8','CloseHandle@4','CreateFileA@28','ReadFile@20','WriteFile@20'],advapi32:['RegCreateKeyA@12','RegSetValueExA@24','RegOpenKeyA@12','RegQueryValueExA@24','RegCloseKey@4']};
 for(const [dll,imports]of Object.entries(names)){put(dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+imports.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',path.join(out,dll+'.def'),'-l',path.join(out,dll+'.lib')]);}
 for(const [name,child]of [['setup',0],['child',1]]){cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-DCHILD='+child,'-c',path.join(out,'control.c'),'-o',path.join(out,name+'.obj')]);cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','console','--disable-dynamicbase','--no-insert-timestamp','-o',path.join(out,name+'.exe'),...[(name+'.obj'),'kernel32.lib','advapi32.lib'].map(x=>path.join(out,x))]);}
 const data=iso([['SETUP.EXE',fs.readFileSync(path.join(out,'setup.exe'))],['CHILD.EXE',fs.readFileSync(path.join(out,'child.exe'))],['MAXIS.INI',Buffer.from('[fixture]\r\nvalue=CONTROL\r\n')]]);put('control.iso',data);
 return {fixtureOnly:true,originalExecuted:false,isoSHA256:crypto.createHash('sha256').update(data).digest('hex'),bytes:data.length};}
module.exports={prepare};if(require.main===module)console.log(JSON.stringify(prepare(process.argv[2])));
