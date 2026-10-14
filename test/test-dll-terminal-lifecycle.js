'use strict';
// Terminal transitions through real PE API calls: entryless final release,
// dependency-group release with a nested asynchronous detach lookup, and
// ExitThread from a resource-enumeration callback that owns a deferred pin.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {X86,pe,u32,BASE,DATA}=require('./test-dll-lifecycle-real-pe');
const ROOT=path.join(__dirname,'..'),OUT=process.env.WA_DLL_TERMINAL_ARTIFACTS||path.join(ROOT,'scratch/dll-terminal-lifecycle');
const ret=[0xb8,1,0,0,0,0xc2,12,0],raw=r=>r-0x1000+0x200;
function image(kind){
 const a=new X86();a.emit(0x53,0x8b,0x5c,0x24,8,0x8b,0x44,0x24,12,0xff,0x04,0x85,u32(DATA+(kind==='provider'?0x20:0)));
 if(kind==='root'){
  a.emit(0x85,0xc0).branch([0x0f,0x85],'done');
  a.emit(0x8d,0x83,u32(0x1500),0x50).api('LoadLibraryA',true).emit(0x50).api('FreeLibrary',true);
  a.emit(0xff,0x93,u32(0x1c40),0x3d,u32(7)).branch([0x0f,0x84],'done').store(0x70,1);
 }
 a.label('done').emit(0x5b,...ret);
 const b=pe([[0x1000,a.finish()],[0x1250,[0xb8,7,0,0,0,0xc3]],[0x1500,'pause.dll\0']],true),o=0x80+24;
 if(kind==='root'){
  b.writeUInt32LE(0x1c00,raw(0x1814));b.writeUInt32LE(0x1c80,raw(0x1820));b.writeUInt32LE(0x1c40,raw(0x1824));b.writeUInt32LE(60,o+108);
  b.writeUInt32LE(0x1cc0,raw(0x1c00));b.writeUInt32LE(0x1cc0,raw(0x1c40));b.write('provider.dll\0',raw(0x1c80));b.write('Ping\0',raw(0x1cc2));
 }
 if(kind==='provider'){
  b.writeUInt32LE(0x1e00,o+96);b.writeUInt32LE(0xb0,o+100);
  for(const [off,v]of[[12,0x1e60],[16,1],[20,1],[24,1],[28,0x1e40],[32,0x1e44],[36,0x1e48]])b.writeUInt32LE(v,raw(0x1e00+off));
  b.writeUInt32LE(0x1250,raw(0x1e40));b.writeUInt32LE(0x1e80,raw(0x1e44));b.write('provider.dll\0',raw(0x1e60));b.write('Ping\0',raw(0x1e80));
 }
 if(kind==='resource'){
  b.writeUInt32LE(0x1e00,o+112);b.writeUInt32LE(64,o+116);b.writeUInt16LE(2,raw(0x1e0e));
  b.writeUInt32LE(10,raw(0x1e10));b.writeUInt32LE(0x80000020,raw(0x1e14));b.writeUInt32LE(11,raw(0x1e18));b.writeUInt32LE(0x80000020,raw(0x1e1c));
 }
 return b;
}
function program(kind){
 const a=new X86();a.push(BASE+0x1500).api('LoadLibraryA').emit(0x85,0xc0).branch([0x0f,0x84],'missing').eaxTo(0x40);
 const start=(rva,offset)=>a.push(0).push(0).push(0).push(BASE+rva).push(0).push(0).api('CreateThread').eaxTo(offset);
 start(0x2a00,0x48);start(0x2800,0x44);
 for(const [handle,code,out]of[[0x44,73,0x50],[0x48,99,0x54]]){
  a.push(5000).emit(0xff,0x35,u32(DATA+handle)).api('WaitForSingleObject').checkEax(0);
  a.push(DATA+out).emit(0xff,0x35,u32(DATA+handle)).api('GetExitCodeThread').checkEax(1).checkMem(out,code);
 }
 a.checkMem(0x60,0).push(BASE+0x1500).api('GetModuleHandleA').checkEax(0);
 a.push(28).push(DATA+0x200).emit(0xff,0x35,u32(DATA+0x40)).api('VirtualQuery').checkEax(28).checkMem(0x210,0x10000);
 if(kind!=='empty')a.checkMem(0,1).checkMem(4,1);
 if(kind==='root')a.checkMem(0x20,1).checkMem(0x24,1).checkMem(0x70,0).push(BASE+0x1520).api('GetModuleHandleA').checkEax(0);
 if(kind==='resource')a.checkMem(0x64,1);
 a.store(0x80,0x7e4d1a11).push(0).api('ExitProcess').emit(0xcc);
 a.label('missing').push(201).api('ExitProcess').emit(0xcc);
 const worker=new X86();
 if(kind==='resource')worker.push(0).push(BASE+0x2b00).emit(0xff,0x35,u32(DATA+0x40)).api('EnumResourceTypesA');
 else worker.push(73).emit(0xff,0x35,u32(DATA+0x40)).api('FreeLibraryAndExitThread');
 worker.store(0x60,1).push(202).api('ExitThread').emit(0xcc);
 const callback=new X86().emit(0xff,0x05,u32(DATA+0x64)).emit(0xff,0x35,u32(DATA+0x40)).api('FreeLibrary').push(73).api('ExitThread').store(0x60,2).emit(0xcc);
 return pe([[0x2000,a.finish()],[0x2800,worker.finish()],[0x2a00,new X86().push(99).api('ExitThread').emit(0xcc).finish()],[0x2b00,callback.finish()],[0x1500,kind+'.dll\0'],[0x1520,'provider.dll\0']]);
}
function prepare(){
 fs.mkdirSync(OUT,{recursive:true});const empty=pe([],true);empty.writeUInt32LE(0,0x80+24+16);
 const files={'empty.dll':empty,'pause.dll':empty,'root.dll':image('root'),'provider.dll':image('provider'),'resource.dll':image('resource')};
 for(const kind of['empty','root','resource'])files[kind+'.exe']=program(kind);
 const hashes={};for(const[name,b]of Object.entries(files)){fs.writeFileSync(path.join(OUT,name),b);hashes[name]=crypto.createHash('sha256').update(b).digest('hex');}
 fs.writeFileSync(path.join(OUT,'fixtures.json'),JSON.stringify(hashes,null,2));
}
prepare();
if(!process.argv.includes('--prepare')){
 const results=[];
 for(const mode of['no-threads','threads'])for(const kind of['empty','root','resource']){
  const r=cp.spawnSync(process.execPath,['test/run.js',`--exe=${path.join(OUT,kind+'.exe')}`,'--no-build',`--wasm=${process.env.WA_TEST_WASM||path.join(ROOT,'build/wine-assembly.wasm')}`,`--${mode}`,'--quiet-api','--quiet-blocks','--max-seconds=15','--dump=0x401480:4'],{cwd:ROOT,encoding:'utf8',timeout:25000,detached:true,maxBuffer:4e6});
  let absent=false;try{process.kill(-r.pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')throw e;absent=true;}
  const text=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join(OUT,mode+'-'+kind+'.log'),text);
  results.push({mode,kind,pid:r.pid,status:r.status,signal:r.signal,groupAbsent:absent,passed:r.status===0&&/\[Exit\] code=0\b/.test(text)&&/401480[^\n]*11 1a 4d 7e/i.test(text)});
  fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));
 }
 assert(results.every(r=>r.passed),'Terminal lifecycle guest assertion failed; see logs');console.log('PASS entryless/dependency FreeLibraryAndExitThread and terminal enumeration pin cleanup, cooperative and Worker');
}else console.log('Prepared terminal lifecycle real PE fixtures');
