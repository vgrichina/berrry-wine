'use strict';
// Authored loader client; original installer is never executed by this test.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const cp=require('node:child_process'),crypto=require('node:crypto');
const { X86, pe, API, BASE, DATA, u32 } = require('./test-dll-lifecycle-real-pe');
API.push('GetLastError','CreateProcessA','GetExitCodeProcess');
const out = path.resolve(process.argv[2]);
fs.mkdirSync(out, { recursive: true });
const required = ['SetupDefaultQueueCallbackA','SetupInstallFromInfSectionA','SetupOpenInfFileA',
  'SetupCloseInfFile','SetupInitDefaultQueueCallbackEx','SetupTermDefaultQueueCallback',
  'SetupSetDirectoryIdA','SetupGetLineTextA','SetupGetLineByIndexA','SetupFindFirstLineA',
  'SetupFindNextLine','SetupOpenFileQueue','SetupCloseFileQueue','SetupQueueCopyA','SetupCommitFileQueueA'];
function program({ worker = false, missing = false } = {}) {
  let cursor=0x2c00;const parts=[];
  const str=s=>{const p=cursor;parts.push([p,s+'\0']);cursor+=Buffer.byteLength(s)+1;return BASE+p;};
  const name=str('SETUPAPI.DLL'), absent=str('DefinitelyAbsentExport'), inf=str('c:\\probe.inf');
  const section=str('Proof'), key=str('value');
  const a = new X86();
  const nonzero=()=>a.emit(0x85,0xc0).branch([0x0f,0x84],'bad');
  const native=(n,...args)=>{
    for(const arg of args.reverse())typeof arg==='string' ? a.emit(0xff,0x35,u32(DATA+Number(arg))) : a.push(arg);
    a.emit(0xff,0x15,u32(DATA+0x20+required.indexOf(n)*4));
  };
  a.push(name).api('LoadLibraryA').eaxTo(0);
  if(missing){a.checkEax(0).api('GetLastError').checkEax(126);}
  else {
    nonzero();a.emit(0x3d,u32(BASE)).branch([0x0f,0x84],'bad');
    for(const [i,n] of required.entries()){
      a.push(str(n)).emit(0xff,0x35,u32(DATA)).api('GetProcAddress');nonzero();
      a.emit(0x8b,0x1d,u32(DATA),0x39,0xd8).branch([0x0f,0x82],'bad')
        .emit(0x8d,0x8b,u32(0x58000),0x39,0xc8).branch([0x0f,0x83],'bad').eaxTo(0x20+i*4);
    }
    a.push(absent).emit(0xff,0x35,u32(DATA)).api('GetProcAddress').checkEax(0);
    a.api('GetLastError').checkEax(127);
    a.push(128).push(DATA+0x100).emit(0xff,0x35,u32(DATA)).api('GetModuleFileNameA');nonzero();
    native('SetupOpenInfFileA',inf,0,2,DATA+0xf0);a.eaxTo(8);
    a.emit(0x3d,u32(0xffffffff)).branch([0x0f,0x84],'bad');nonzero();
    native('SetupFindFirstLineA','8',section,key,DATA+0xa0);a.checkEax(1);
    native('SetupGetLineTextA',DATA+0xa0,0,0,0,DATA+0x180,64,DATA+0xf4);a.checkEax(1);
    a.eaxFrom(0x180).checkEax(0x6974616e); // actual native parser wrote "nati"
    native('SetupCloseInfFile','8');
    native('SetupOpenFileQueue');nonzero();a.eaxTo(0xc);
    native('SetupCloseFileQueue','12');a.checkEax(1);
    a.emit(0xff,0x35,u32(DATA)).api('FreeLibrary').checkEax(1);
    a.push(name).api('GetModuleHandleA').checkEax(0);
    a.push(str('CFGMGR32.DLL')).api('GetModuleHandleA').checkEax(0);
    // A retired handle must not resolve names to generic thunks.
    a.push(str(required[0])).emit(0xff,0x35,u32(DATA)).api('GetProcAddress').checkEax(0);
  }
  a.store(0x80,0x51a7ccee).push(0).api(worker?'ExitThread':'ExitProcess');
  a.label('bad').push(200).api(worker?'ExitThread':'ExitProcess');
  const code=a.finish();assert(code.length<0xc00);
  let entry=code;
  if(worker){
    entry=new X86().push(0).push(0).push(0).push(BASE+0x2200).push(0).push(0).api('CreateThread').eaxTo(0xe0)
      .push(5000).emit(0x50).api('WaitForSingleObject').checkEax(0)
      .push(DATA+0xe4).emit(0xff,0x35,u32(DATA+0xe0)).api('GetExitCodeThread').checkEax(1)
      .checkMem(0xe4,0).checkMem(0x80,0x51a7ccee).push(0).api('ExitProcess').finish();
    assert(code.length<0xa00);parts.push([0x2200,code]);
  }
  parts.push([0x2000,entry]);assert(cursor<0x3000);
  return pe(parts);
}
for(const worker of [false,true]) for(const missing of [false,true])
  fs.writeFileSync(path.join(out,`${worker?'worker':'main'}-${missing?'missing':'native'}.exe`),program({worker,missing}));
fs.writeFileSync(path.join(out,'probe.inf'),'[Version]\r\nSignature="$Windows NT$"\r\n[Proof]\r\nvalue=native-parser-output\r\n');
const child = new X86().store(0x240,68)
  .push(DATA+0x200).push(DATA+0x240).push(0).push(0).push(0).push(0).push(0).push(0)
  .push(BASE+0x1500).push(0).api('CreateProcessA').checkEax(1)
  .push(8000).emit(0xff,0x35,u32(DATA+0x200)).api('WaitForSingleObject').checkEax(0)
  .push(DATA+0x280).emit(0xff,0x35,u32(DATA+0x200)).api('GetExitCodeProcess').checkEax(1).checkMem(0x280,0)
  .store(0x80,0x51a7ccee).push(0).api('ExitProcess').finish();
fs.writeFileSync(path.join(out,'child.exe'),pe([[0x2000,child],[0x1500,'c:\\worker-native.exe\0']]));
module.exports={required,program};
console.log('Prepared authored genuine SetupAPI native/Worker exports, INF parser, queue and retirement probes');
if(process.argv.includes('--run')) {
  const root=path.resolve(__dirname,'..'),cfg=process.env.VB5_CFGMGR32;
  const setup=path.join(root,'test/binaries/candidates/vb5cce-original/setupapi.dll');
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  assert.equal(hash(fs.readFileSync(setup)),'51f2682279e28386aa9c0eb8ba4f8ac3000c9ff75cf7e2456e8cdd9f0c544159');
  assert.equal(hash(fs.readFileSync(cfg)),'572387372791a7bc8d336fbbb6af6a9651a627124599f862ac2bd235145b7b80');
  const results=[];
  const cases=[];
  for(const worker of [false,true])for(const missing of [true,false])cases.push({id:`${worker?'worker':'main'}-${missing?'missing':'native'}`,worker,missing});
  cases.push({id:'child',worker:true,missing:false});
  for(const {id,worker,missing} of cases) {
    const args=['test/run.js','--exe='+path.join(out,id+'.exe'),'--no-build','--winver=nt4','--real-ticks',
      '--threads','--quiet-api','--quiet-blocks','--stuck-after=0','--max-seconds=12','--max-batches=10000000',
      '--dump=0x401400:512','--trace-api=LoadLibraryA,GetProcAddress,GetLastError',
      '--vfs-mount='+setup+'=c:\\setupapi.dll','--vfs-mount='+path.join(out,'probe.inf')+'=c:\\probe.inf'];
    if(!missing)args.push('--vfs-mount='+cfg+'=c:\\cfgmgr32.dll');
    if(id==='child')args.push('--spawn-processes','--vfs-mount='+path.join(out,'worker-native.exe')+'=c:\\worker-native.exe',
      '--pipe-child-args=--winver=nt4 --threads --real-ticks --dump=0x401400:512');
    // The test supervisor is independent of guest execution, with its deadline
    // armed and recorded before spawning the native client.
    fs.writeFileSync(path.join(out,id+'-deadline.json'),JSON.stringify({at:Date.now(),timeoutMs:20000,prearmed:true}));
    const r=cp.spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:20000,maxBuffer:4*1024*1024});
    const log=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join(out,id+'.log'),log);
    const passed=r.status===0 && /^\[Exit\] code=0\b/m.test(log) && /^  0x00401480[^\n]*ee cc a7 51/m.test(log) && !/^STUCK/m.test(log);
    results.push({id,pid:r.pid,exit:r.status,signal:r.signal,actualWait:true,stdoutEOF:true,stderrEOF:true,passed});
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
    assert(passed,id+' native guest assertions failed');
    if(worker)assert(log.includes('[guest-worker 1] instantiated'),'actual CPU Worker required');
    if(!missing)assert(log.includes('native-parser-ou'),'genuine parser must produce the expected bytes');
  }
  console.log('PASS exact genuine SetupAPI + CFGMGR32: main/actual Worker/actual child, missing-dependency refusal, 15 required exports, native INF output, file queue, retirement, missing/stale exports, actual joined guest/native exits');
}
