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
  for(const worker of [false,true])for(const mode of ['static','late','wrong','broken','whiteout']){
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
    fs.writeFileSync(exe,client(worker,['late','wrong'].includes(mode),mode==='wrong'));
    const args=['test/run.js','--exe='+exe,'--exe-guest-path='+guest,'--cwd=c:\\program files\\vb5cce',
      '--overlay-dir='+overlay,'--overlay-flush-ms=0','--no-build','--threads','--winver=nt4','--real-ticks',
      '--quiet-api','--quiet-blocks','--stuck-after=0','--max-seconds=12','--max-batches=10000000','--dump=0x401480:16'];
    if(mode==='whiteout')args.push('--dll-seed=vba5.dll');
    fs.writeFileSync(path.join(dir,'deadline.json'),JSON.stringify({prearmed:true,at:Date.now(),timeoutMs:20000,args}));
    const r=cp.spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:20000,maxBuffer:4*1024*1024});
    const log=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join(dir,'native.log'),log);
    const refusal=['broken','whiteout'].includes(mode);
    const passed=refusal ? r.status===1 && !log.includes('Calling DllMain') &&
      log.includes(mode==='broken'?'overlay hydration failed before DLL discovery':'declared DLL not found') :
      r.status===0 && /^\[Exit\] code=0\b/m.test(log) && /0x00401480[^\n]*ee cc a7 51/.test(log);
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
