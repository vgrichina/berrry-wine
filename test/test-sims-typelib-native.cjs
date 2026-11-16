'use strict';
// --prepare only compiles small clients; never executes the genuine engine.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const PIN='985eb55ecb750da812876b8569d5f1999a30a24bcc54f9bab4d3fc44dfedb931';
const engine=path.resolve(__dirname,'binaries/sims-complete-collection/static/Disc1/setup/expanded/ikernel.exe');
function resource(){
  const b=fs.readFileSync(engine);assert.equal(sha(b),PIN);
  const pe=b.readUInt32LE(0x3c),opt=pe+24,sections=opt+b.readUInt16LE(pe+20);
  const rva=b.readUInt32LE(opt+112);
  const raw=a=>{for(let i=0;i<b.readUInt16LE(pe+6);i++){
    const s=sections+i*40,va=b.readUInt32LE(s+12),len=b.readUInt32LE(s+16);
    if(a>=va&&a-va<len)return b.readUInt32LE(s+20)+a-va;
  }throw Error('resource RVA outside raw sections');};
  const root=raw(rva);
  const entries=off=>{const at=root+off,n=b.readUInt16LE(at+12)+b.readUInt16LE(at+14);return Array.from({length:n},(_,i)=>{
    const key=b.readUInt32LE(at+16+i*8),value=b.readUInt32LE(at+20+i*8);
    const k=key>>>31?b.subarray(root+(key&0x7fffffff)+2,root+(key&0x7fffffff)+2+2*b.readUInt16LE(root+(key&0x7fffffff))).toString('utf16le'):key;
    return {key:k,offset:value&0x7fffffff,directory:!!(value>>>31)};});};
  const type=entries(0).find(x=>x.key==='TYPELIB');assert(type&&type.directory);
  const id=entries(type.offset).find(x=>x.key===1);assert(id&&id.directory);
  const language=entries(id.offset).find(x=>x.key===0x409);assert(language&&!language.directory);
  const leaf=root+language.offset,addr=b.readUInt32LE(leaf),size=b.readUInt32LE(leaf+4);
  assert.equal(addr,0x9d1f8);assert.equal(size,0xd8ae);
  const data=b.subarray(raw(addr),raw(addr)+size);assert.equal(data.toString('ascii',0,4),'SLTG');
  const imported=String.raw`*\G{00020430-0000-0000-C000-000000000046}#1.0#0#C:\WINNT\System32\StdOle32.tlb#`;
  assert(data.includes(Buffer.from(imported,'ascii')));
  return {data,metadata:{enginePath:engine,engineSHA256:PIN,type:'TYPELIB',format:'SLTG',id:1,language:0x409,rva:addr,bytes:size,sha256:sha(data),imported}};
}
const source=String.raw`
typedef unsigned long U; typedef long H; typedef void *P;
#define API __declspec(dllimport) __stdcall
H API LoadTypeLib(const unsigned short*,P*);
H API RegisterTypeLib(P,const unsigned short*,const unsigned short*);
H API LoadRegTypeLib(P,unsigned short,unsigned short,U,P*);
U API GetModuleFileNameW(P,unsigned short*,U);
void API ExitProcess(U);
P API GetStdHandle(U);
U API WriteFile(P,const char*,U,U*,P);
static void report(const char *stage,U value){char line[160];U n=0,i,written;
 while(stage[n]){line[n]=stage[n];n++;}line[n++]='=';line[n++]='0';line[n++]='x';
 for(i=0;i<8;i++)line[n++]="0123456789abcdef"[(value>>((7-i)*4))&15];
 line[n++]='\n';WriteFile(GetStdHandle((U)-11),line,n,&written,0);
}
typedef struct { H (__stdcall *qi)(P,P,P*); U (__stdcall *add)(P); U (__stdcall *release)(P);
 U (__stdcall *count)(P); H (__stdcall *info)(P,U,P*); H (__stdcall *kind)(P,U,U*);
 H (__stdcall *guid)(P,P,P*); H (__stdcall *attr)(P,P*);
} V;
void start(void){unsigned short file[1024];P a=0,b=0,attr=0;
 if(!GetModuleFileNameW(0,file,1024))ExitProcess(11);
 const unsigned short *requested=file;
#if FILECASE == 1
 requested=L"c:\\typelib.dat";
#elif FILECASE == 2
 U len=0;while(file[len])len++;file[len++]=92;file[len++]=49;file[len]=0;
#elif FILECASE == 3
 requested=L"c:\\missing-typelib-file.dat";
#elif FILECASE == 6
 requested=L"c:\\windows\\system\\stdole32.tlb";
#endif
 H hr;
#if FILECASE == 7
 // A discriminating control registers the genuine Windows data with the
 // genuine API. It never substitutes a fabricated library or result.
 hr=LoadTypeLib(L"c:\\windows\\system\\stdole32.tlb",&b);
 report("LoadTypeLib.standard.before",(U)hr);if(hr<0||!b)ExitProcess((U)hr);
 hr=RegisterTypeLib(b,L"c:\\windows\\system\\stdole32.tlb",0);
 report("RegisterTypeLib.standard.before",(U)hr);(*(V**)b)->release(b);b=0;
 if(hr<0)ExitProcess((U)hr);
#endif
#if FILECASE == 4 || FILECASE == 5
 unsigned char standard[16]={0x30,0x04,0x02,0,0,0,0,0,0xc0,0,0,0,0,0,0,0x46};
 hr=LoadRegTypeLib(standard,FILECASE==4?1:2,0,0,&a);
 report("LoadRegTypeLib.standard",(U)hr);
#else
 hr=LoadTypeLib(requested,&a);
 report("LoadTypeLib",(U)hr);
#endif
#if FILECASE == 3
 if(hr!=(H)0x80029c4a||a)ExitProcess(16);ExitProcess(0);
#endif
 if(hr<0)ExitProcess((U)hr);if(!a)ExitProcess(12);
 V *v=*(V**)a;U count=v->count(a);report("GetTypeInfoCount",count);if(!count)ExitProcess(13);
 hr=v->attr(a,&attr);report("GetLibAttr",(U)hr);if(hr<0||!attr)ExitProcess(14);
 // ITypeLib::ReleaseTLibAttr is slot 12, not IUnknown::Release.
 unsigned char identity[32];U i;for(i=0;i<32;i++)identity[i]=((unsigned char*)attr)[i];
 report("LibAttr.version",((U)*(unsigned short*)(identity+24)<<16)|*(unsigned short*)(identity+26));
 ((void (__stdcall *)(P,P))(*(P**)a)[12])(a,attr);
#if FILECASE == 4 || FILECASE == 5
 report("Release.standard",v->release(a));ExitProcess(0);
#endif
 hr=LoadTypeLib(requested,&b);report("LoadTypeLib.repeat",(U)hr);if(hr<0||!b)ExitProcess(15);
 report("Release.repeat",(*(V**)b)->release(b));
 hr=RegisterTypeLib(a,requested,0);report("RegisterTypeLib",(U)hr);if(hr<0){v->release(a);ExitProcess((U)hr);}
 b=0;hr=LoadRegTypeLib(identity,*(unsigned short*)(identity+24),*(unsigned short*)(identity+26),*(U*)(identity+16),&b);
 report("LoadRegTypeLib",(U)hr);
 if(hr<0||!b){v->release(a);ExitProcess(hr<0?(U)hr:17);}
 report("Release.registered",(*(V**)b)->release(b));report("Release.first",v->release(a));ExitProcess(0);
}`;
function prepare(directory){
  const out=path.resolve(directory);fs.mkdirSync(out,{recursive:true});const put=(name,bytes)=>fs.writeFileSync(path.join(out,name),bytes,{flag:'wx'});
  const r=resource();put('typelib.dat',r.data);put('client.c',source);
  put('client.rc','1 TYPELIB "'+path.join(out,'typelib.dat').replace(/\\/g,'\\\\')+'"\n');
  cp.execFileSync('llvm-rc',['/fo',path.join(out,'client.res'),path.join(out,'client.rc')]);
  cp.execFileSync('llvm-cvtres',['/machine:x86','/out:'+path.join(out,'resource.obj'),path.join(out,'client.res')]);
  for(const [dll,names]of Object.entries({kernel32:['GetModuleFileNameW@12','ExitProcess@4','GetStdHandle@4','WriteFile@20'],oleaut32:['LoadTypeLib@8','RegisterTypeLib@12','LoadRegTypeLib@20']})){
    put(dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');
    cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',path.join(out,dll+'.def'),'-l',path.join(out,dll+'.lib')]);
  }
  for(const [name,mode]of [['client',0],['standalone',1],['resource-index',2],['missing',3],['stdole1',4],['stdole2',5],['stdole32',6],['registered-standard',7]]){
    cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-DFILECASE='+mode,'-c',path.join(out,'client.c'),'-o',path.join(out,name+'.obj')]);
    cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','console','--disable-dynamicbase','--no-insert-timestamp','-o',path.join(out,name+'.exe'),...[name+'.obj','resource.obj','kernel32.lib','oleaut32.lib'].map(x=>path.join(out,x))]);
  }
  // Exact native error control, preserving NULL owner. IDOK is required for
  // guest exit zero; consumption alone cannot satisfy this fixture.
  const ok=require('./test-sims-null-owner-modal-native.cjs').image(false),raw=r=>r-0x1000+0x200;
  const flags=ok.indexOf(Buffer.from([0x68,1,0,0,0,0x68,0x40,0x25,0x40,0]));assert(flags>=0);
  ok.writeUInt32LE(0x10,flags+1);
  const compare=ok.indexOf(Buffer.from([0x83,0xf8,2,0x0f,0x95,0xc0]),flags);assert(compare>=0);ok[compare+2]=1;
  ok.fill(0,raw(0x2580),raw(0x2600));ok.write('Exact NULL-owner MB_ICONHAND|MB_OK. OK returns IDOK.\0',raw(0x2580));
  put('error-ok.exe',ok);
  const metadata={fixtureOnly:true,genuineEngineExecuted:false,resource:r.metadata,clientSHA256:sha(fs.readFileSync(path.join(out,'client.exe'))),errorOKSHA256:sha(ok),nativeExecution:false};
  put('prepared.json',JSON.stringify(metadata,null,2)+'\n');return metadata;
}
// Recovery recipe for an ignored Microsoft system DATA file. Cabinet members
// are checked before writing; neither this nor prepare executes guest code.
function recoverStandard(destination){
  const iso=path.resolve('scratch/media/win98se-oem-x05-29232.iso');
  assert.equal(sha(fs.readFileSync(iso)),'2adfb46df8a9c7bbd2f67bff07461cc2f9d9ec8e01f0e112cb044c9e3e62f607');
  const cabinet=cp.execFileSync('7z',['x','-so',iso,'win98/WIN98_52.CAB'],{maxBuffer:4e6});
  assert.equal(sha(cabinet),'030a67fa5aaf389a1e6eb145f6fe98039acab81d6569249de16fdea74594a306');
  const temp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'sims-standard-data-'));
  try{
    const cab=path.join(temp,'WIN98_52.CAB');fs.writeFileSync(cab,cabinet);
    const result=cp.spawnSync('cabextract',['-s','-p','-F','stdole32.tlb',cab],{maxBuffer:1e6});
    assert.equal(result.status,0,result.stderr.toString());assert.equal(result.stdout.length,7168);
    const hash=sha(result.stdout);assert.equal(hash,'308e70310b4707f63095db73e67ba080cb67657abdcba7efe66f0f7f5ce017ed');
    fs.writeFileSync(destination,result.stdout,{flag:'wx'});
    return {destination:path.resolve(destination),sha256:hash,bytes:result.stdout.length,source:iso,member:'win98/WIN98_52.CAB:stdole32.tlb',dataOnly:true};
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
function qualifyDefaults(){
  const boot=require('../lib/process-boot'),storage=require('../lib/storage');
  const spec=boot.SYSTEM_DATA_FILES.find(file=>file.vfsPath==='c:\\windows\\system\\stdole32.tlb');
  assert(spec&&spec.localOnly);const bytes=fs.readFileSync(path.resolve(spec.url));
  assert.equal(sha(bytes),'308e70310b4707f63095db73e67ba080cb67657abdcba7efe66f0f7f5ce017ed');
  const vfs=new (require('../lib/filesystem').VirtualFS)();boot.mountSystemDataFiles(vfs,[{...spec,bytes}]);
  assert.deepEqual(Buffer.from(vfs.files.get(spec.vfsPath).data),bytes);
  storage.clearStore();const values=storage.exportStore();
  for(const [version,filename]of [['1.0','stdole32.tlb'],['2.0','stdole2.tlb']]){
    const key='reg:hkcr\\typelib\\{00020430-0000-0000-c000-000000000046}\\'+version+'\\0\\win32';
    const actual=Object.keys(values).find(name=>name.toLowerCase()===key);assert(actual);
    assert.equal(JSON.parse(values[actual]).values[''].data.toLowerCase(),'c:\\windows\\system\\'+filename);
  }
  return {status:'PASS',stockMajorVersions:['1.0','2.0'],dataOnly:true,genuineSHA256:sha(bytes)};
}
module.exports={resource,prepare,recoverStandard,qualifyDefaults};
if(require.main===module){
  const action=process.argv[2];assert(['--prepare','--recover-standard','--defaults'].includes(action));
  console.log(JSON.stringify(action==='--defaults'?qualifyDefaults():action==='--prepare'?prepare(process.argv[3]):recoverStandard(process.argv[3])));
}
