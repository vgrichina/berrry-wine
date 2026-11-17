'use strict';
// Authored clients, genuine installed modules, production CLI and CPU Worker.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const cp=require('node:child_process'),crypto=require('node:crypto');
const {X86,pe,API,BASE,DATA,u32}=require('./test-dll-lifecycle-real-pe');
const {findInstalledDll}=require('../lib/installed-dll-closure');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const guest='c:\\program files\\vb5cce\\probe.exe';
const raw=r=>r-0x1000+0x200;
const comctlNames=['InitCommonControls','ImageList_Destroy','ImageList_LoadImageA',
  'ImageList_SetOverlayImage','ImageList_AddMasked','ImageList_GetImageInfo',
  'ImageList_Draw','ImageList_DrawEx','PropertySheetA','DestroyPropertySheetPage','CreatePropertySheetPageA'];
function comctlClient(worker){
  const names=[...comctlNames,'ImageList_Create'];
  const a=new X86();
  const nonzero=()=>a.emit(0x85,0xc0).branch([0x0f,0x84],'bad');
  const call=i=>a.emit(0xff,0x15,u32(DATA+0x80+i*4));
  a.push(BASE+0x1500).api('LoadLibraryA').eaxTo(0x40);nonzero();
  names.forEach((n,i)=>{a.push(BASE+0x2600+i*64).eaxFrom(0x40).emit(0x50).api('GetProcAddress').eaxTo(0x80+i*4);nonzero();});
  // The installed genuine VBA5 body still executes on each route.
  a.push(BASE+0x1580).api('LoadLibraryA').emit(0x50).push(8).emit(0x58,0x59,0x50,0x51).api('GetProcAddress').eaxTo(0x44);
  nonzero();a.push(DATA+12).push(DATA+8).push(DATA+4).push(DATA).emit(0xff,0x15,u32(DATA+0x44));
  a.checkMem(0,5).checkMem(8,0x1bcb);
  for(const at of [0x1520,0x1540]){
    a.push(BASE+at).api('LoadLibraryA').emit(0x3b,0x05,u32(DATA+0x40)).branch([0x0f,0x85],'bad');
  }
  a.push(BASE+0x15a0).api('LoadLibraryA').checkEax(0);
  a.push(BASE+0x15d0).eaxFrom(0x40).emit(0x50).api('GetProcAddress').checkEax(0);
  a.push(65535).eaxFrom(0x40).emit(0x50).api('GetProcAddress').checkEax(0);
  a.push(BASE+0x1600).api('LoadLibraryA').emit(0x50).push(BASE+0x1620).emit(0x58,0x59,0x50,0x51).api('GetProcAddress').eaxTo(0x48);
  nonzero();a.push(0).push(32).push(1).push(2).push(4).emit(0xff,0x15,u32(DATA+0x48)).eaxTo(0x4c);nonzero();
  a.push(2).push(0).push(1).push(2).push(2);call(11).eaxTo(0x50);nonzero();
  a.push(0xff00ff).eaxFrom(0x4c).emit(0x50).eaxFrom(0x50).emit(0x50);call(4).checkEax(0);
  a.push(15).push(1).eaxFrom(0x50).emit(0x50);call(3).checkEax(1);
  for(const [index,slot] of [[2,15],[0,0],[0,16]]){a.push(slot).push(index).eaxFrom(0x50).emit(0x50);call(3).checkEax(0);}
  a.push(BASE+0x1680).push(1).eaxFrom(0x50).emit(0x50);call(5).checkEax(1);
  a.emit(0xa1,u32(BASE+0x1680));nonzero();a.emit(0xa1,u32(BASE+0x1684));nonzero();
  a.push(BASE+0x1680).push(2).eaxFrom(0x50).emit(0x50);call(5).checkEax(0);
  a.push(0).push(0).push(0);call(5).checkEax(0);
  a.eaxFrom(0x50).emit(0x50);call(1).checkEax(1);
  a.push(1).push(0).eaxFrom(0x50).emit(0x50);call(3).checkEax(0);
  a.store(0xf0,0xc03251cc).push(0).api(worker?'ExitThread':'ExitProcess');
  a.label('bad').push(201).api('ExitProcess');
  const body=a.finish();assert(body.length<0x600);
  const entry=worker?new X86().push(0).push(0).push(0).push(BASE+0x2000).push(0).push(0).api('CreateThread')
    .eaxTo(0xe0).push(5000).emit(0x50).api('WaitForSingleObject').checkEax(0)
    .push(DATA+0xe4).emit(0xff,0x35,u32(DATA+0xe0)).api('GetExitCodeThread').checkEax(1)
    .checkMem(0xe4,0).checkMem(0xf0,0xc03251cc).push(0).api('ExitProcess').finish():body;
  const image=pe([[worker?0x2e00:0x2000,entry],...(worker?[[0x2000,body]]:[]),
    [0x1500,'COMCTL32.DLL\0'],[0x1520,'comctl32\0'],[0x1540,'C:\\Windows\\System\\COMCTL32.DLL\0'],
    [0x1580,'VBA5.DLL\0'],[0x15a0,'c:\\absent\\comctl32.dll\0'],[0x15d0,'MissingComctlExport\0'],
    [0x1600,'GDI32.DLL\0'],[0x1620,'CreateBitmap\0'],...names.map((n,i)=>[0x2600+i*64,n+'\0'])]);
  if(worker)image.writeUInt32LE(0x2e00,0x80+24+16);
  return image;
}
function client(worker,late,wrong=false){
  const a=new X86();
  if(late){
    a.push(BASE+0x1500).api('LoadLibraryA');
    if(wrong)a.checkEax(0);
    else a.eaxTo(0x40).push(8).emit(0x50).api('GetProcAddress').eaxTo(0x44);
  }
  if(!wrong){
    // EbGetVersion writes all four outputs using original x86 instructions.
    a.push(DATA+12).push(DATA+8).push(DATA+4).push(DATA);
    a.emit(0xff,0x15,u32(late?DATA+0x44:BASE+0x1e40));
    a.checkMem(0,5).checkMem(4,0).checkMem(8,0x1bcb).checkMem(12,16);
    a.push(BASE+0x1520).api('GetModuleHandleA').emit(0x85,0xc0).branch([0x0f,0x84],'bad');
    a.push(8).push(BASE+0x1540).api('GetModuleHandleA').emit(0x50).api('GetProcAddress');
    a.emit(0x3b,0x05,u32(late?DATA+0x44:BASE+0x1e40)).branch([0x0f,0x85],'bad');
    if(!late){
      a.emit(0x3b,0x05,u32(BASE+0x1e44)).branch([0x0f,0x85],'bad');
      a.push(DATA+12).push(DATA+8).push(DATA+4).push(DATA).emit(0xff,0x15,u32(BASE+0x1e44));
      a.checkMem(0,5).checkMem(8,0x1bcb);
    }
    // Mapping an app-local DLL must not manufacture root/system file aliases.
    a.push(BASE+0x1560).api('LoadLibraryA').checkEax(0);
  }
  a.store(0x80,0x51a7ccee).push(0).api(worker?'ExitThread':'ExitProcess');
  a.label('bad').push(201).api(worker?'ExitThread':'ExitProcess');
  const body=a.finish();
  let entry=body;
  if(worker)entry=new X86().push(0).push(0).push(0).push(BASE+0x2400).push(0).push(0).api('CreateThread')
    .eaxTo(0xe0).push(5000).emit(0x50).api('WaitForSingleObject').checkEax(0)
    .push(DATA+0xe4).emit(0xff,0x35,u32(DATA+0xe0)).api('GetExitCodeThread').checkEax(1)
    .checkMem(0xe4,0).checkMem(0x80,0x51a7ccee).push(0).api('ExitProcess').finish();
  const image=pe([[0x2000,entry],...(worker?[[0x2400,body]]:[]),
    [0x1500,(wrong?'c:\\absent\\VBA5.DLL':'VBA5.DLL')+'\0'],
    [0x1520,'OLEAUT32.DLL\0'],[0x1540,'VBA5.DLL\0'],[0x1560,'c:\\vba5.dll\0']]);
  if(!late){
    image.copy(image,raw(0x1d00),raw(0x1800),raw(0x1800)+20);
    image.writeUInt32LE(0x1d00,0x80+24+104);image.writeUInt32LE(60,0x80+24+108);
    image.writeUInt32LE(0x1e00,raw(0x1d14));image.writeUInt32LE(0x1540,raw(0x1d20));
    image.writeUInt32LE(0x1e40,raw(0x1d24));image.writeUInt32LE(0x80000008,raw(0x1e40));
    image.writeUInt32LE(0x80000008,raw(0x1e00));
    image.writeUInt32LE(0x1ec0,raw(0x1e04));image.writeUInt32LE(0x1ec0,raw(0x1e44));
    image.write('EbGetVersion\0',raw(0x1ec2));
  }
  return image;
}
async function run(){
  fs.mkdirSync(out,{recursive:true});
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'scratch/runs/20261117-vb5-native-common-dialog-focus-state-repair/authentic-recovery-manifest.json')));
  const selected=manifest.blobs.filter(x=>['c:\\program files\\vb5cce\\vba5.dll','c:\\windows\\system\\oleaut32.dll'].includes(x.guest));
  assert.equal(selected.length,2);
  for(const x of selected)assert.equal(hash(fs.readFileSync(path.join(root,x.path))),x.sha256);
  // Read-only discovery of the actual installed EXE, without invoking it.
  const installed={files:new Map(selected.map(x=>[x.guest,{data:fs.readFileSync(path.join(root,x.path))}])),
    getCurrentDirectory:()=>path.win32.dirname(guest),_resolvePath:s=>s.toLowerCase()};
  const original=manifest.blobs.find(x=>x.guest==='c:\\program files\\vb5cce\\vb5cce.exe');
  const exe=fs.readFileSync(path.join(root,original.path));assert.equal(hash(exe),original.sha256);
  const originalPE=require('../lib/pe').readPE(exe);
  const requested=Array.from({length:11},(_,i)=>{
    const pointer=exe.readUInt32LE(originalPE.va2off(0x578338+i*8));
    const at=originalPE.va2off(pointer);
    return exe.subarray(at,exe.indexOf(0,at)).toString('ascii');
  });
  assert.deepEqual(requested,comctlNames,'probe uses the genuine installed startup export table');
  fs.writeFileSync(path.join(out,'genuine-comctl-request-table.json'),JSON.stringify({exe:original,
    loaderVA:'0x498254',callerVA:'0x497fb8',tableVA:'0x578338',requested,
    loadFailureAndMissingExportUseSameGuestMessage:true,originalInvoked:false},null,2));
  const missing=[];
  const configs=await require('../lib/process-boot').resolveDllGraph({exeBytes:exe,
    detectRequiredDlls:require('../lib/dll-loader').detectRequiredDlls,
    loadSpec:spec=>findInstalledDll(installed,spec,guest),onMissing:name=>missing.push(name.toLowerCase())});
  assert.deepEqual(configs.map(x=>x.path),selected.map(x=>x.guest));
  assert(missing.every(x=>x==='ole32.dll'));
  fs.writeFileSync(path.join(out,'installed-static-discovery.json'),JSON.stringify({
    exe:original,modules:configs.map(x=>({name:x.name,path:x.path,sha256:hash(x.bytes)})),missing,
    originalInvoked:false,ole32WarningSeparate:true},null,2));
  // No basename census: wrong-directory and synthetic aliases never qualify.
  const vfs={files:new Map(),getCurrentDirectory:()=> 'c:\\elsewhere',_resolvePath:s=>s.toLowerCase()};
  vfs.files.set('c:\\unrelated\\vba5.dll',{data:Buffer.from('wrong')});
  assert.equal(findInstalledDll(vfs,'vba5.dll',guest),null);
  vfs.files.set('c:\\windows\\system\\vba5.dll',{staticModule:true,data:Buffer.from('stub')});
  assert.equal(findInstalledDll(vfs,'vba5.dll',guest),null);
  const rows=[];
  if(process.env.VB5_COMCTL_PROBE){
    const p=path.join(out,'comctl-probe.exe'),a=new X86();
    const names=['InitCommonControls','ImageList_Destroy','ImageList_LoadImageA',
      'ImageList_SetOverlayImage','ImageList_AddMasked','ImageList_GetImageInfo',
      'ImageList_Draw','ImageList_DrawEx','PropertySheetA','DestroyPropertySheetPage','CreatePropertySheetPageA'];
    a.push(BASE+0x1500).api('LoadLibraryA').eaxTo(0x40);
    names.forEach((n,i)=>a.push(BASE+0x2600+i*64).eaxFrom(0x40).emit(0x50).api('GetProcAddress').eaxTo(0x80+i*4));
    a.push(0).api('ExitProcess');
    fs.writeFileSync(p,pe([[0x2000,a.finish()],[0x1500,'COMCTL32.DLL\0'],...names.map((n,i)=>[0x2600+i*64,n+'\0'])]));
    const r=cp.spawnSync(process.execPath,['test/run.js','--exe='+p,'--no-build','--quiet-api','--quiet-blocks',
      '--max-seconds=10','--trace-api=LoadLibraryA,GetProcAddress','--dump=0x401440:112'],
      {cwd:root,encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
    fs.writeFileSync(path.join(out,'comctl-probe.log'),r.stdout+r.stderr);
    assert.equal(r.status,0);return;
  }
  for(const worker of [false,true])for(const mode of ['static','late','wrong','broken','whiteout','comctl']){
    const id=(worker?'worker-':'main-')+mode,dir=path.join(out,id),overlay=path.join(dir,'overlay');
    fs.mkdirSync(path.join(overlay,'blobs'),{recursive:true});
    const records=selected.map((x,i)=>{
      const blob=`00000000-0000-4000-8000-00000000000${i}.bin`;
      fs.symlinkSync(path.join(root,x.path),path.join(overlay,'blobs',blob));
      return {path:x.guest,kind:'file',blob,size:x.bytes,attrs:32};
    });
    if(mode==='broken')fs.unlinkSync(path.join(overlay,'blobs',records[0].blob));
    if(mode==='whiteout'){
      records[0]={path:records[0].path,kind:'whiteout'};
    }
    fs.writeFileSync(path.join(overlay,'index.json'),JSON.stringify({version:1,records}));
    // Same opaque host executable placement and guest identity as installed launch.
    const exe=path.join(overlay,'blobs','00000000-0000-4000-8000-000000000002.bin');
    fs.writeFileSync(exe,mode==='comctl'?comctlClient(worker):client(worker,['late','wrong'].includes(mode),mode==='wrong'));
    const args=['test/run.js','--exe='+exe,'--exe-guest-path='+guest,'--cwd=c:\\program files\\vb5cce',
      '--overlay-dir='+overlay,'--overlay-flush-ms=0','--no-build','--threads','--winver=nt4','--real-ticks',
      '--quiet-api','--quiet-blocks','--stuck-after=0','--max-seconds=12','--max-batches=10000000',
      '--dump='+ (mode==='comctl'?'0x4014f0:16':'0x401480:16')];
    if(mode==='comctl')args.push('--trace-api=LoadLibraryA,GetProcAddress,ImageList_SetOverlayImage,ImageList_GetImageInfo');
    if(mode==='whiteout')args.push('--dll-seed=vba5.dll');
    fs.writeFileSync(path.join(dir,'deadline.json'),JSON.stringify({prearmed:true,at:Date.now(),timeoutMs:20000,args}));
    const r=cp.spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:20000,maxBuffer:4*1024*1024});
    const log=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join(dir,'native.log'),log);
    const refusal=['broken','whiteout'].includes(mode);
    const passed=refusal ? r.status===1 && !log.includes('Calling DllMain') &&
      log.includes(mode==='broken'?'overlay hydration failed before DLL discovery':'declared DLL not found') :
      r.status===0 && /^\[Exit\] code=0\b/m.test(log) &&
      (mode==='comctl'?/0x004014f0[^\n]*cc 51 32 c0/:/0x00401480[^\n]*ee cc a7 51/).test(log);
    rows.push({id,pid:r.pid,exit:r.status,signal:r.signal,actualWait:true,stdoutEOF:true,stderrEOF:true,passed});
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({rows,modules:selected},null,2));
    assert(passed,id+' guest checks failed');
    if(worker&&!refusal)assert(log.includes('[guest-worker 1] instantiated'));
    if(mode==='static'){
      assert(log.indexOf('[overlay]')<log.indexOf('DLL: '),'hydration before DLL initialization');
      const module=/DLL: oleaut32.dll at 0x[0-9a-f]+, DllMain=(0x[0-9a-f]+)/.exec(log);
      assert(module);assert(log.indexOf('Calling DllMain at '+module[1])<log.lastIndexOf('Calling DllMain at '),'dependency first');
    }
  }
  console.log('PASS genuine installed VBA5 ordinal8/static/late/dependency/wrong-path main+CPUWorker');
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={client};
