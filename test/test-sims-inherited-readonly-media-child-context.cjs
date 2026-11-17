'use strict';
// Generated media only. The --host route does not instantiate WASM or run a PE.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mediaCli = require('../lib/media-cli');
const { VirtualFS } = require('../lib/filesystem');
const { saveVfsToHost, saveCompletedChildState } = require('../lib/vfs-export');

function tinyIso(files = [['SETUP.EXE',Buffer.from('MZ')],['MAXIS.INI',Buffer.from('[fixture]\r\nvalue=CONTROL\r\n')]]) {
  let next=19;
  const rows=files.map(([name,data])=>{const row={name,data,lba:next};next+=Math.ceil(data.length/2048);return row;});
  const empty=next++, b = Buffer.alloc(next * 2048);
  const both16 = (p,v) => { b.writeUInt16LE(v,p); b.writeUInt16BE(v,p+2); };
  const both32 = (p,v) => { b.writeUInt32LE(v,p); b.writeUInt32BE(v,p+4); };
  function rec(p,lba,size,flags,name) {
    const n = Buffer.from(name, 'ascii'), len = 33+n.length+((33+n.length)&1);
    b[p]=len; both32(p+2,lba); both32(p+10,size); b[p+25]=flags;
    both16(p+28,1); b[p+32]=n.length; n.copy(b,p+33); return len;
  }
  let p=16*2048; b[p]=1; b.write('CD001',p+1); b[p+6]=1;
  b.write('D_CONTEXT_CONTROL'.padEnd(32),p+40); both32(p+80,next); both16(p+128,2048);
  rec(p+156,18,2048,2,'\0'); b.write('1996123112000000',p+813);
  p=17*2048; b[p]=255; b.write('CD001',p+1); b[p+6]=1;
  p=18*2048; p+=rec(p,18,2048,2,'\0'); p+=rec(p,18,2048,2,'\x01');
  for(const row of rows){p+=rec(p,row.lba,row.data.length,0,row.name+';1');row.data.copy(b,row.lba*2048);}
  rec(p,empty,2048,2,'EMPTY');
  p=empty*2048; p+=rec(p,empty,2048,2,'\0'); rec(p,18,2048,2,'\x01');
  return b;
}
function rawMode1(iso) {
  const raw=Buffer.alloc(iso.length/2048*2352);
  for(let sector=0;sector<iso.length/2048;sector++){
    raw.fill(0xff,sector*2352+1,sector*2352+11);raw[sector*2352+15]=1;
    iso.copy(raw,sector*2352+16,sector*2048,(sector+1)*2048);
  }
  return raw;
}
const cueText='FILE "control.bin" BINARY\r\n  TRACK 01 MODE1/2352\r\n    INDEX 01 00:00:00\r\n';

async function hostChecks(context, {adoption = false} = {}) {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sims-dcontext-'));
  const opened=[];
  try {
    const source=path.join(tmp,'control.bin'); fs.writeFileSync(source,rawMode1(tinyIso()));
    const cue=path.join(tmp,'control.cue');fs.writeFileSync(cue,cueText);
    const parent=new VirtualFS();
    const media=await mediaCli.analyzeMediaPaths([cue],{exePath:'D:\\SETUP.EXE'});
    opened.push(media); await media.plan.mount(parent);
    assert(parent.setCurrentDirectory('D:\\EMPTY'));
    const borrowed=parent.files.get('d:\\maxis.ini');
    assert(borrowed._provider); assert.equal(Buffer.from(borrowed.data).toString(),'[fixture]\r\nvalue=CONTROL\r\n');
    assert(parent.readOnlyDrives.has('d')); assert(parent.dirs.has('d:\\empty'));
    const exported=saveVfsToHost(parent,path.join(tmp,'mutable'));
    assert.equal(exported.length,0,'borrowed bytes must stay outside mutable snapshot');
    const baseline=new VirtualFS();
    assert.equal(baseline.setCurrentDirectory(parent.getCurrentDirectory()),false,
      'actual file-only producer omits the real inherited readonly directory');

    context.remember(parent,media);
    if(adoption)adoptionChecks(context,parent);
    const snapshot=JSON.parse(JSON.stringify(context.capture(parent)));
    assert(snapshot.length); assert(!JSON.stringify(snapshot).includes('CONTROL\\r'));
    const child=new VirtualFS(), childMedia=await context.restore(child,snapshot);opened.push(...childMedia);
    assert(child.setCurrentDirectory(parent.getCurrentDirectory()));
    assert.equal(child.getCurrentDirectory(),parent.getCurrentDirectory());
    assert.deepEqual(context.tree(child,['d']),context.tree(parent,['d']));
    for(const k of ['creationTime','lastAccessTime','lastWriteTime'])assert.deepEqual(child.files.get('d:\\maxis.ini')[k],borrowed[k]);
    assert(child.cdAudioDrives.get('d').track(1));
    assert.deepEqual(child.cdAudioDrives.get('d').tracks[0].indexes,parent.cdAudioDrives.get('d').tracks[0].indexes);
    assert.equal(Buffer.from(child.files.get('d:\\maxis.ini').data).toString(),Buffer.from(borrowed.data).toString());
    assert(child.files.get('d:\\maxis.ini')._provider);
    assert.equal(child.createFile('D:\\new.bin',0x40000000,2),0,'readonly create fails');
    assert.equal(child.deleteFile('D:\\maxis.ini'),false,'readonly delete fails');
    assert.equal(saveVfsToHost(child,path.join(tmp,'child-mutable')).length,0);
    child.files.set('c:\\merged.bin',{data:Buffer.from('REAL'),attrs:0x20});
    saveCompletedChildState(child,{exportStore:()=>({})},path.join(tmp,'out'),path.join(tmp,'registry'),path.join(tmp,'complete'),'token');
    assert.equal(fs.readFileSync(path.join(tmp,'out','merged.bin'),'utf8'),'REAL');
    assert(fs.existsSync(path.join(tmp,'complete')));
    childMedia[0].parts.find(p=>p.hostPath.endsWith('.bin')).source.close();
    assert.throws(()=>context.capture(child),/ownership revoked|replaced/,'a cached profile cannot resurrect a revoked real source');
    assert(context.capture(parent).length,'the child owns a separate reopened source handle');

    const entry=parent.files.get('d:\\maxis.ini');
    parent.files.set('d:\\maxis.ini',{...entry});
    assert.throws(()=>context.capture(parent),/replaced/,'same-shaped replacement cannot borrow the old owner');
    parent.files.set('d:\\maxis.ini',entry);
    parent.setDriveReadOnly('d',false);
    assert.throws(()=>context.capture(parent),/writable/);
    parent.setDriveReadOnly('d',true);
    parent.dirs.delete('d:\\empty'); assert.throws(()=>context.capture(parent),/directory|metadata/);
    parent.dirs.add('d:\\empty');
    for (const bad of ['d:\\..\\escape','d:\\x:y','d:\\a/b','d:\\bad\0name','D:\\UPPER','\\\\server\\share']) {
      const altered=structuredClone(snapshot); altered[0].layout.dirs.push(bad);
      const target=new VirtualFS();
      await assert.rejects(context.restore(target,altered),/path/);
      assert(!target.readOnlyDrives.has('d')); assert(!target.dirs.has('d:\\'));
    }
    const wrong=structuredClone(snapshot); wrong[0].layout.metadata.volumeLabels[0][1]='OTHER';
    const target=new VirtualFS(); await assert.rejects(context.restore(target,wrong),/identity/);
    assert(!target.readOnlyDrives.has('d'));
    const conflict=new VirtualFS(); conflict.dirs.add('d:\\foreign');
    await assert.rejects(context.restore(conflict,snapshot),/conflicts/);
    assert(!conflict.readOnlyDrives.has('d'));
    const unowned=new VirtualFS(); unowned.setDriveReadOnly('e');
    assert.throws(()=>context.capture(unowned),/no source ownership/);
    // The trusted source channel grants no exception to the completion guard.
    child.files.set('d:\\resident.bin',{data:Buffer.from('reject'),attrs:1});
    assert.throws(()=>saveCompletedChildState(child,{exportStore:()=>({})},path.join(tmp,'bad-out'),path.join(tmp,'bad-reg'),path.join(tmp,'bad-complete'),'token'),/unsafe child export path/);
    assert(!fs.existsSync(path.join(tmp,'bad-complete')));
    const old=source+'.old'; fs.renameSync(source,old); fs.writeFileSync(source,tinyIso());
    assert.throws(()=>context.capture(parent),/source replaced|changed/);
    await assert.rejects(context.restore(new VirtualFS(),snapshot),/pin mismatch/);
    return {status:'PASS',fixtureOnly:true,originalExecuted:false,fileOnlyBaselineMissingDcwd:true,
      actualSourceKind:'CUE MODE1/2352',adoptionChecked:adoption,sourceRevocationRejected:true,
      actualReadonlyTreeRestored:true,emptyDirectoryPreserved:true,profileStillBorrowed:true,
      mediaIdentityPreserved:true,mutableExportExcludesMedia:true,replacementAndWritableRejected:true,
      invalidPathsRejectedBeforeMutation:true,completionGuardUnchanged:true};
  } finally { for(const media of opened) mediaCli.closeMedia(media); fs.rmSync(tmp,{recursive:true,force:true}); }
}
function adoptionChecks(context, parent) {
  const adopted=new VirtualFS();adopted.adoptFrom(parent);
  assert.equal(context.capture(adopted).length,context.capture(parent).length,
    'ordinary VFS adoption must transfer actual readonly media ownership');
  assert.equal(adopted.files.get('d:\\maxis.ini'),parent.files.get('d:\\maxis.ini'));
  assert.equal(adopted.cdAudioDrives.get('d'),parent.cdAudioDrives.get('d'));
  adopted.setDriveReadOnly('d',false);
  assert.throws(()=>context.capture(adopted),/writable/);
  adopted.setDriveReadOnly('d',true);
  assert(context.capture(parent).length,'adopted policy changes do not mutate parent metadata');
}
const nativeSource=String.raw`
typedef unsigned long U;typedef void *P;
#define API __declspec(dllimport) __stdcall
void API ExitProcess(U);U API GetPrivateProfileStringA(const char*,const char*,const char*,char*,U,const char*);
U API CreateProcessA(const char*,char*,P,P,U,U,P,P,P,P);U API WaitForSingleObject(P,U);
U API GetExitCodeProcess(P,U*);U API CloseHandle(P);U API GetCurrentDirectoryA(U,char*);
U API SetCurrentDirectoryA(const char*);U API GetVolumeInformationA(const char*,char*,U,U*,U*,U*,char*,U);
U API GetDriveTypeA(const char*);U API DeleteFileA(const char*);U API GetLastError(void);
P API CreateFileA(const char*,U,U,P,U,U,P);U API ReadFile(P,P,U,U*,P);U API WriteFile(P,const void*,U,U*,P);
U API RegCreateKeyA(P,const char*,P*);U API RegSetValueExA(P,const char*,U,U,const void*,U);
U API RegOpenKeyA(P,const char*,P*);U API RegQueryValueExA(P,const char*,U*,U*,P,U*);U API RegCloseKey(P);
#if CHILD
U API DContextGuard(void);
#endif
int same(const char*a,const char*b){while(*a&&*a==*b){a++;b++;}return *a==*b;}
void start(void){U n=0,value=0x5317,size=4,type=0,code=99,serial=0,max=0,flags=0;P file,key=0;
 char text[64],cwd[128],label[64],format[32];
#if CHILD
 if(DContextGuard()!=0xD531)ExitProcess(47);
#endif
#if !CHILD
 if(!SetCurrentDirectoryA("D:\\EMPTY"))ExitProcess(40);
#endif
 if(!GetCurrentDirectoryA(128,cwd)||!same(cwd,"d:\\empty"))ExitProcess(41);
 if(GetPrivateProfileStringA("fixture","value","",text,64,"D:\\maxis.ini")!=7||!same(text,"CONTROL"))ExitProcess(42);
 if(GetDriveTypeA("D:\\")!=5)ExitProcess(43);
 if(!GetVolumeInformationA("D:\\",label,64,&serial,&max,&flags,format,32)||!same(label,"D_CONTEXT_CONTROL")||serial!=MEDIA_SERIAL)ExitProcess(44);
 file=CreateFileA("D:\\forbidden.bin",0x40000000,1,0,2,0,0);if(file!=(P)-1)ExitProcess(45);
 if(DeleteFileA("D:\\maxis.ini"))ExitProcess(46);
#if CHILD
 file=CreateFileA("C:\\boundary-native.bin",0x40000000,1,0,2,0,0);if(file==(P)-1)ExitProcess(11);
 if(!WriteFile(file,"REAL",4,&n,0)||n!=4)ExitProcess(12);CloseHandle(file);
 if(RegCreateKeyA((P)0x80000001,"Software\\SimsDContextControl",&key))ExitProcess(13);
 if(RegSetValueExA(key,"stage",0,4,&value,4))ExitProcess(14);RegCloseKey(key);ExitProcess(0);
#else
 char out[4],command[]="C:\\child.exe";U startup[17]={68},process[4]={0};
 static char payload[65536];U copied=0;
 file=CreateFileA("D:\\CHILD.EXE",0x80000000,1,0,3,0,0);if(file==(P)-1)ExitProcess(22);
 if(!ReadFile(file,payload,65536,&copied,0)||!copied)ExitProcess(29);CloseHandle(file);
 file=CreateFileA("C:\\child.exe",0x40000000,1,0,2,0,0);if(file==(P)-1)ExitProcess(30);
 if(!WriteFile(file,payload,copied,&n,0)||n!=copied)ExitProcess(31);CloseHandle(file);
 file=CreateFileA("D:\\GUARD.DLL",0x80000000,1,0,3,0,0);if(file==(P)-1)ExitProcess(32);
 if(!ReadFile(file,payload,65536,&copied,0)||!copied)ExitProcess(33);CloseHandle(file);
 file=CreateFileA("C:\\guard.dll",0x40000000,1,0,2,0,0);if(file==(P)-1)ExitProcess(34);
 if(!WriteFile(file,payload,copied,&n,0)||n!=copied)ExitProcess(35);CloseHandle(file);
 if(!CreateProcessA(0,command,0,0,0,0,0,0,startup,process))ExitProcess(23);
 WaitForSingleObject((P)process[0],0xffffffff);GetExitCodeProcess((P)process[0],&code);if(code)ExitProcess(24);
 CloseHandle((P)process[0]);CloseHandle((P)process[1]);
 file=CreateFileA("C:\\boundary-native.bin",0x80000000,1,0,3,0,0);if(file==(P)-1)ExitProcess(25);
 if(!ReadFile(file,out,4,&n,0)||n!=4||out[0]!='R'||out[3]!='L')ExitProcess(26);CloseHandle(file);
 if(RegOpenKeyA((P)0x80000001,"Software\\SimsDContextControl",&key))ExitProcess(27);
 value=0;if(RegQueryValueExA(key,"stage",0,&type,&value,&size)||value!=0x5317||type!=4)ExitProcess(28);
 RegCloseKey(key);ExitProcess(0);
#endif
}`;
const guardSource=String.raw`
typedef unsigned long U;typedef void *P;
#define API __declspec(dllimport) __stdcall
U API GetCurrentDirectoryA(U,char*);U API GetPrivateProfileStringA(const char*,const char*,const char*,char*,U,const char*);
static U ready;
U __stdcall DContextGuard(void){return ready;}
U __stdcall DllMain(P module,U reason,P reserved){char cwd[128],text[32];
 if(reason==1){U length=GetCurrentDirectoryA(128,cwd);
 // The same explicit seed initializes in the parent before its disc mount.
 // Only the inherited-D child can publish readiness; its entry checks it.
 if(cwd[0]!='d')return 1;
 if(length!=8||cwd[1]!=':'||cwd[2]!='\\'||cwd[3]!='e'||cwd[7]!='y')return 0;
 if(GetPrivateProfileStringA("fixture","value","",text,32,"D:\\maxis.ini")!=7||text[0]!='C'||text[6]!='L')return 0;
 ready=0xD531;}return 1;}
`;
function prepareNative(directory){
  const cp=require('node:child_process'),crypto=require('node:crypto'),iso=require('../lib/iso9660');
  const out=path.resolve(directory);fs.mkdirSync(out,{recursive:true});
  const put=(name,bytes)=>fs.writeFileSync(path.join(out,name),bytes,{flag:'wx'});
  const serial=iso.parseIso(tinyIso()).volumeSerial;
  put('control.c',nativeSource);
  put('guard.c',guardSource);
  const names={kernel32:['ExitProcess@4','GetPrivateProfileStringA@24','CreateProcessA@40','WaitForSingleObject@8','GetExitCodeProcess@8','CloseHandle@4','CreateFileA@28','ReadFile@20','WriteFile@20','GetCurrentDirectoryA@8','SetCurrentDirectoryA@4','GetVolumeInformationA@32','GetDriveTypeA@4','DeleteFileA@4','GetLastError@0'],advapi32:['RegCreateKeyA@12','RegSetValueExA@24','RegOpenKeyA@12','RegQueryValueExA@24','RegCloseKey@4']};
  for(const [dll,imports]of Object.entries(names)){
    put(dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+imports.join('\n')+'\n');
    cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',path.join(out,dll+'.def'),'-l',path.join(out,dll+'.lib')]);
  }
  put('guard.def','LIBRARY guard.dll\nEXPORTS\nDContextGuard@0\n');
  cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',path.join(out,'guard.def'),'-l',path.join(out,'guard.lib')]);
  cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',path.join(out,'guard.c'),'-o',path.join(out,'guard.obj')]);
  cp.execFileSync('ld',['-mi386pe','--dll','--entry','_DllMain@12','--kill-at','--disable-dynamicbase','--no-insert-timestamp','-o',path.join(out,'guard.dll'),path.join(out,'guard.obj'),path.join(out,'guard.def'),path.join(out,'kernel32.lib')]);
  for(const [name,child]of [['setup',0],['child',1]]){
    cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-DCHILD='+child,'-DMEDIA_SERIAL='+serial+'UL','-c',path.join(out,'control.c'),'-o',path.join(out,name+'.obj')]);
    cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','console','--disable-dynamicbase','--no-insert-timestamp','-o',path.join(out,name+'.exe'),...[(name+'.obj'),'kernel32.lib','advapi32.lib',...(child?['guard.lib']:[])].map(x=>path.join(out,x))]);
  }
  const bytes=tinyIso([['SETUP.EXE',fs.readFileSync(path.join(out,'setup.exe'))],['CHILD.EXE',fs.readFileSync(path.join(out,'child.exe'))],['GUARD.DLL',fs.readFileSync(path.join(out,'guard.dll'))],['MAXIS.INI',Buffer.from('[fixture]\r\nvalue=CONTROL\r\n')]]);
  put('control.iso',bytes);
  put('control.bin',rawMode1(bytes));put('control.cue',cueText);
  return {fixtureOnly:true,originalExecuted:false,isoSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),serial,bytes:bytes.length,rawMode1Bytes:rawMode1(bytes).length,inheritedCwd:'d:\\empty',explicitChildCwd:null};
}
function assertNativeLog(file) {
  const text=fs.readFileSync(file,'utf8');
  assert.match(text,/CreateProcess .*cwd d:\\empty/);
  assert.match(text,/\[child [^\]]+\] Calling DllMain/);
  assert.match(text,/\[child [^\]]+\] \[vfs\] working directory: d:\\empty/);
  assert.match(text,/child state merged: 1 file\(s\) written, 0 deleted, 78 registry\/INI key\(s\)/);
  assert.equal((text.match(/\[Exit\] code=0/g)||[]).length,2);
  assert.doesNotMatch(text,/could not be exported|context refused|merging .* failed|working directory is not present|\[max-seconds\]/);
  return {status:'PASS',nativeInheritedDcwd:true,earlyDllMain:true,parentAndChildExit:0,
    realCfileAndRegistryVerifiedByParent:true,originalExecuted:false};
}
module.exports={hostChecks,tinyIso,prepareNative,adoptionChecks,assertNativeLog};
if(require.main===module) {
  if(process.argv[2]==='--prepare-native'){console.log(JSON.stringify(prepareNative(process.argv[3])));process.exit(0);}
  if(process.argv[2]==='--assert-native-log'){console.log(JSON.stringify(assertNativeLog(process.argv[3])));process.exit(0);}
  const arg=process.argv.find(v=>v.startsWith('--candidate='));
  const context=require(arg ? path.resolve(arg.slice(12)) : '../lib/readonly-media-context');
  hostChecks(context,{adoption:!arg||process.argv.includes('--adoption')}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
}
