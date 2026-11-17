'use strict';
// Authored x86 reproduces MSO97RT's resource-name construction. The installed
// resource DLL is mapped AS_DATAFILE only: no original entry point is invoked.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {X86,pe,BASE,DATA,u32}=require('./test-dll-lifecycle-real-pe');
const {readPE}=require('../lib/pe');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]);
const baseline=process.argv.includes('--baseline');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const dir='C:\\Program Files\\Common Files\\Microsoft Shared\\VBA\\';
const names=['GetLocaleInfoA','GetLocaleInfoW','LoadLibraryExA','FindResourceA','SizeofResource','LoadResource','LockResource','GetLastError'];
function client(worker,resource){
  const a=new X86(),call=i=>a.emit(0xff,0x15,u32(DATA+0x40+i*4));
  const nz=()=>a.emit(0x85,0xc0).branch([0x0f,0x84],'bad');
  a.push(BASE+0x1700).api('LoadLibraryA').eaxTo(0x3c);nz();
  names.forEach((n,i)=>{a.push(BASE+0x2800+i*40).eaxFrom(0x3c).emit(0x50).api('GetProcAddress').eaxTo(0x40+i*4);nz();});
  // Exact MSO97RT call at original VA 306c2493: four bytes, NOUSEROVERRIDE,
  // SABBREVLANGNAME. Copy result-1 characters between MRT7 and .DLL.
  a.push(4).push(DATA+0x10).push(0x80000003).push(0x409);call(0).checkEax(baseline?2:4);
  a.emit(0x8d,0x48,0xff,0xbe,u32(DATA+0x10),0xbf,u32(BASE+0x1500+dir.length+4),0xf3,0xa4,
    0xc7,0x07,0x2e,0x44,0x4c,0x4c,0xc6,0x47,0x04,0x00);
  // A known absent resource name remains absent even after the repair.
  a.push(2).push(0).push(BASE+0x1600);call(2).checkEax(0);
  a.push(2).push(0).push(BASE+0x1500);call(2).eaxTo(0x20);
  if(baseline)a.checkEax(0);
  else{
    nz();
    a.push(resource.type).push(resource.id).emit(0x50);call(3).eaxTo(0x24);nz();
    a.emit(0x50).eaxFrom(0x20).emit(0x50);call(4).checkEax(resource.size);
    a.eaxFrom(0x24).emit(0x50).eaxFrom(0x20).emit(0x50);call(5);nz();
    a.emit(0x50);call(6);nz();
    a.emit(0x8b,0x00).checkEax(resource.firstDword);
    a.eaxFrom(0x20).emit(0x50).api('FreeLibrary').checkEax(1);
    // Wide sibling has the same name and count; insufficient buffer cannot
    // write the three-letter abbreviation into a 3-character destination.
    a.store(0x10,0xcccccccc).push(3).push(DATA+0x10).push(0x80000003).push(0x409);call(0).checkEax(0);
    a.checkMem(0x10,0xcccccccc);call(7).checkEax(122);
    a.push(4).push(DATA+0x10).push(0x80000003).push(0x400);call(1).checkEax(4);
    a.checkMem(0x10,0x004e0045).checkMem(0x14,0x00000055);
    a.push(0).push(0).push(3).push(0x800);call(0).checkEax(4);
    a.push(4).push(DATA+0x10).push(0x20000003).push(0x409);call(0).checkEax(0);call(7).checkEax(1004);
  }
  a.store(0xf0,0x97e051cc).push(0).api(worker?'ExitThread':'ExitProcess');
  a.label('bad').push(220).api('ExitProcess');
  const body=a.finish();assert(body.length<0x800);
  const entry=worker?new X86().push(0).push(0).push(0).push(BASE+0x2000).push(0).push(0).api('CreateThread')
    .eaxTo(0xe0).push(5000).emit(0x50).api('WaitForSingleObject').checkEax(0)
    .push(DATA+0xe4).emit(0xff,0x35,u32(DATA+0xe0)).api('GetExitCodeThread').checkEax(1)
    .checkMem(0xe4,0).checkMem(0xf0,0x97e051cc).push(0).api('ExitProcess').finish():body;
  const image=pe([[worker?0x2e00:0x2000,entry],...(worker?[[0x2000,body]]:[]),
    [0x1500,dir+'MRT7'],[0x1600,dir+'MRT70.DLL\0'],[0x1700,'KERNEL32.DLL\0'],
    ...names.map((n,i)=>[0x2800+i*40,n+'\0'])]);
  if(worker)image.writeUInt32LE(0x2e00,0x80+24+16);
  return image;
}
fs.mkdirSync(out,{recursive:true});
const m=JSON.parse(fs.readFileSync(path.join(root,'scratch/runs/20261117-vb5-native-common-dialog-focus-state-repair/authentic-recovery-manifest.json')));
const mso=m.blobs.find(x=>x.guest.endsWith('\\mso97rt.dll'));
const msoBytes=fs.readFileSync(path.join(root,mso.path));assert.equal(hash(msoBytes),mso.sha256);
const msoPE=readPE(msoBytes),at=msoPE.va2off(0x306c2493);
assert.equal(msoBytes.subarray(at,at+14).toString('hex'),'6a048d4508506803000080ff7508',
  'original requests four characters of SABBREVLANGNAME|NOUSEROVERRIDE');
assert.equal(msoBytes.subarray(msoPE.va2off(0x306c2500),msoPE.va2off(0x306c2500)+5).toString('ascii'),'MRT7\0');
assert.equal(msoBytes.subarray(msoPE.va2off(0x306c2508),msoPE.va2off(0x306c2508)+5).toString('ascii'),'.DLL\0');
const original=m.blobs.find(x=>x.guest.endsWith('\\mrt7enu.dll'));
assert(original);const bytes=fs.readFileSync(path.join(root,original.path));assert.equal(hash(bytes),original.sha256);
const p=readPE(bytes),r=p.sections.find(x=>x.name==='.rsrc').rawOff;
const entries=off=>Array.from({length:bytes.readUInt16LE(off+12)+bytes.readUInt16LE(off+14)},(_,i)=>({id:bytes.readUInt32LE(off+16+i*8),value:bytes.readUInt32LE(off+20+i*8)}));
const type=entries(r).find(x=>x.id===217),name=entries(r+(type.value&0x7fffffff)).find(x=>x.id<0x80000000);
const lang=entries(r+(name.value&0x7fffffff))[0],leaf=r+lang.value;
const data=p.va2off(p.imageBase+bytes.readUInt32LE(leaf));
const resource={type:type.id,id:name.id,size:bytes.readUInt32LE(leaf+4),firstDword:bytes.readUInt32LE(data)};
fs.writeFileSync(path.join(out,'resource-input.json'),JSON.stringify({original,mso,resource,
  originalNameBuilderVA:'0x306c2490',originalCodeExecuted:false,baseline},null,2));
const rows=[];
for(const worker of [false,true]){
  const id=worker?'worker':'main',exe=path.join(out,id+'.exe');fs.writeFileSync(exe,client(worker,resource));
  const args=['test/run.js','--exe='+exe,'--no-build','--threads','--quiet-api','--quiet-blocks','--winver=nt4',
    '--vfs-mount='+path.join(root,original.path)+'='+dir+'Mrt7ENU.dll','--max-seconds=10','--max-batches=1000000',
    '--trace-api=GetLocaleInfoA,GetLocaleInfoW,LoadLibraryExA,FindResourceA,SizeofResource,LoadResource,LockResource',
    '--dump=0x401400:256'];
  fs.writeFileSync(path.join(out,id+'-deadline.json'),JSON.stringify({prearmed:true,timeoutMs:20000,args}));
  const result=cp.spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024});
  const log=(result.stdout||'')+(result.stderr||'');fs.writeFileSync(path.join(out,id+'.log'),log);
  const passed=result.status===0&&/^\[Exit\] code=0\b/m.test(log)&&/0x004014f0[^\n]*cc 51 e0 97/.test(log);
  rows.push({id,pid:result.pid,exit:result.status,signal:result.signal,actualWait:true,stdoutEOF:true,stderrEOF:true,passed});
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({rows,baseline,resource},null,2));
  assert(passed,id+' authored guest checks failed');
  assert(!log.includes('Calling DllMain'),'datafile must not execute original DLL entry point');
  if(worker)assert(log.includes('[guest-worker 1] instantiated'));
}
assert.equal(hash(fs.readFileSync(path.join(root,original.path))),original.sha256);
console.log('PASS MSO97RT resource name '+(baseline?'MRT70 absent baseline':'MRT7ENU genuine datafile')+' main+CPUWorker; no original code invocation');
