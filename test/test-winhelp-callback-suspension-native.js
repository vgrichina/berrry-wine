'use strict';
// Real generated PE + DLL, public RegisterRoutine / HELP_COMMAND, actual host I/O.
// Explicit invocation only: no build or VM is started by requiring this fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {buildPe, X86, checkRestored} = require('./test-edit-winhelp-callback-native');
const {VirtualFS} = require('../lib/filesystem');
const {ChunkCache} = require('../lib/byte-provider');
const {createHostImports} = require('../lib/host-imports');
const {loadDlls} = require('../lib/dll-loader');
const ROOT = path.resolve(__dirname, '..');
const B = 0x400000, D = B + 0x5000, SNAP = D + 0x100;
const ENTRY = D + 0x40, COMPLETE = D + 0x44, COUNT = D + 0x48, BUF = D + 0x60;
const d32 = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24];
const PAYLOAD = Uint8Array.of(19, 37, 71, 113);
function images(handle, dllBase,{terminate=false,sleepFirst=false,nested=false,wide=false}={}) {
  const helpApi=wide?'WinHelpW':'WinHelpA';
  const string=s=>Buffer.from(s+'\0',wide?'utf16le':'utf8');
  const exe = buildPe({imageBase:B, entryRva:0x2000, codeRva:0x2000,
    imports:[['user32.dll',[helpApi]],['kernel32.dll',['Sleep']]],
    extra:[[0x1800,string('c:\\ew-native.hlp')],
      [0x1840,string('RegisterRoutine("c:\\ew-native.dll","Probe","SU")')],
      [0x18c0,string(`Probe("parked",${handle})`)]],
    code(iat) {
      const a = new X86();
      const help = (macro,file=0) => a.push(macro).push(0x102).push(file).push(0).api(iat,helpApi);
      help(B+0x1840,B+0x1800).store(0,D);
      if(sleepFirst) {
        a.push(5000).api(iat,'Sleep').label('sleep-spin').branch(0xe9,'sleep-spin');
        return a.finish();
      }
      a.push(0x51ac0ffe).seed(0x11000000).snapshot(SNAP);
      help(B+0x18c0).snapshot(SNAP+32);
      a.emit(0x58).store(0,D+4).set(D+8,0xc001c0de);
      a.label('spin').branch(0xe9,'spin');
      return a.finish();
    }}).img;
  const dllPe = buildPe({dll:'ew-native.dll',imageBase:dllBase,
    entryRva:0x1000,codeRva:0x2000,exportName:'Probe',exportRva:0x2000,
    imports:[['kernel32.dll',['ReadFile','ExitThread']],['user32.dll',[helpApi]]],
    extra:[[0x1000,[0xb8,...d32(1),0xc2,12,0]]],
    code(iat) {
      const a = new X86();
      a.emit(0xff,5,d32(ENTRY));
      if(nested) {
        a.emit(0x83,0x3d,d32(ENTRY),1).branch([0x0f,0x85],'after-nested');
        a.push(B+0x18c0).push(0x102).push(0).push(0)
          .emit(0xff,0x15,d32(dllBase+iat[helpApi]));
        a.branch(0xe9,'read-done');
        a.label('after-nested');
      }
      // The file handle is the second real macro argument. The first is an
      // allocated string that must remain alive until this callback returns.
      a.emit(0x8b,0x44,0x24,8);
      a.push(0).push(COUNT).push(PAYLOAD.length).push(BUF).emit(0x50);
      a.emit(0xff,0x15,d32(dllBase+iat.ReadFile)).store(0,D+0x4c);
      a.label('read-done');
      if(terminate) {
        a.push(77).emit(0xff,0x15,d32(dllBase+iat.ExitThread),0xcc);
        return a.finish();
      }
      a.emit(0x8b,0x44,0x24,4,0x0f,0xb6,0x00).store(0,D+0x50);
      a.emit(0xff,5,d32(COMPLETE)).seed(0x44000000).emit(0xc2,8,0);
      return a.finish();
    }});
  return {exe,dll:dllPe.img,readIat:dllBase+dllPe.iat.ReadFile};
}
async function fixture(file,{eager=false,terminate=false,sleepFirst=false,nested=false,wide=false}={}) {
  const memory = new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const vfs = new VirtualFS(), trace = [];
  let resolveProvider, requested = 0;
  const gate = new Promise(resolve => {resolveProvider=resolve;});
  const provider = {size:PAYLOAD.length,readRange(off,len) {
    requested++; return gate.then(() => PAYLOAD.slice(off,off+len));
  }};
  if(eager) vfs.files.set('c:\\park.dat',{data:PAYLOAD.slice(),attrs:32,name:'park.dat'});
  else vfs.setProviderFile('c:\\park.dat',{provider:new ChunkCache(provider,
    {chunkSize:32,maxChunks:2,readAhead:0,prefetch:0})});
  const h=vfs.createFile('c:\\park.dat',0x80000000,3);
  const help=fs.readFileSync(path.join(ROOT,'test/binaries/help/freecell.hlp'));
  vfs.files.set('c:\\ew-native.hlp',{data:new Uint8Array(help),attrs:32,name:'ew-native.hlp'});
  const ctx={exports:null,vfs,getMemory:()=>memory.buffer,
    readFile:name=>name.toLowerCase()==='c:\\ew-native.hlp'?help:null};
  const host=createHostImports(ctx).host;
  const exits=[];
  Object.assign(host,{memory,exit(code){exits.push(code);},exit_thread(code){exits.push(code);},
    log(){},log_i32(){},wait_multiple(){return 0;}});
  let e;
  const snap=label=>{
    let token;
    try { token=String(e.null_diag_token()); }
    catch(error) { assert(error instanceof WebAssembly.RuntimeError);token='retired'; }
    const row={label,eip:e.get_eip()>>>0,esp:e.get_esp()>>>0,eax:e.get_eax()>>>0,
      yield:e.get_yield_reason(),pending:!!vfs.getIoState(1).pendingRead,
      entry:get(ENTRY),complete:get(COMPLETE),caller:get(D+8),
      token,root:String(e.null_diag_root()),depth:e.get_sync_msg_depth()};
    trace.push(row);return row;
  };
  host.log_api_exit=()=>{if(e.get_yield_reason()===12)snap('actual-io-park');};
  const result=await WebAssembly.instantiate(fs.readFileSync(path.join(ROOT,file)),{host});
  e=ctx.exports=result.instance.exports;
  const mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
  const get=a=>dv.getUint32(e.guest_to_wasm(a),true);
  // load_pe resets the next DLL address, so generate its code only afterwards.
  const initial=images(h,0x10000000,{terminate,sleepFirst,nested,wide});
  mem.set(initial.exe,e.get_staging());e.load_pe(initial.exe.length);
  const native=images(h,e.get_next_dll_addr()>>>0,{terminate,sleepFirst,nested,wide});
  loadDlls(e,memory.buffer,native.exe,[{name:'ew-native.dll',path:'c:\\ew-native.dll',bytes:native.dll}],()=>{});
  e.set_api_log(1);
  snap('fixture-ready');
  return {e,vfs,h,trace,snap,get,mem,memory,module:result.module,exits,
    resolveProvider,requested:()=>requested,native};
}
async function parkPeer(f) {
  let requested=0;
  f.vfs.setProviderFile('c:\\foreign.dat',{provider:new ChunkCache({size:4,
    readRange(){requested++;return new Promise(()=>{});}},
    {chunkSize:32,maxChunks:2,readAhead:0,prefetch:0})});
  const h=f.vfs.createFile('c:\\foreign.dat',0x80000000,3);
  const ctx={exports:null,vfs:f.vfs,getMemory:()=>f.memory.buffer};
  const host=createHostImports(ctx).host;
  Object.assign(host,{memory:f.memory,exit(){},log(){},log_i32(){}});
  const peer=ctx.exports=new WebAssembly.Instance(f.module,{host}).exports;
  peer.init_thread(1,B,f.e.get_code_start(),f.e.get_code_end(),
    f.e.get_thunk_base(),f.e.get_thunk_end(),f.e.get_num_thunks(),0);
  const a=new X86().push(0).push(D+0x380).push(4).push(D+0x390).push(h)
    .emit(0xff,0x15,d32(f.native.readIat),0xeb,0xfe);
  f.mem.set(a.finish(),f.e.guest_to_wasm(B+0x4000));
  peer.set_eip(B+0x4000);peer.set_esp(0x0747ff20);
  for(let i=0;i<32&&peer.get_yield_reason()!==12;i++)peer.run(1000);
  assert.equal(peer.get_yield_reason(),12,'real unrelated thread ReadFile parks');
  const pending=f.vfs.getIoState(2).pendingRead;assert(pending);
  return {peer,pending,requested:()=>requested};
}
async function run(file,eager,{baseline=false,foreign=false,nested=false,wide=false}={}) {
  const f=await fixture(file,{eager,nested,wide});
  const other=foreign?await parkPeer(f):null;
  try {
    for(let i=0;i<64&&!f.get(D+8)&&!f.e.get_yield_reason();i++) f.e.run(1000);
    f.snap('first-boundary');
    if(!eager) {
      assert(f.trace.some(r=>r.label==='actual-io-park'&&r.yield===12&&r.pending),
        'observed native reason12 and real pendingRead before host resolution');
      const pending=f.vfs.getIoState(1).pendingRead;
      assert(pending,'exact owning read remains pending');
      assert.equal(f.get(COMPLETE),0,'unfinished callback');
      if(baseline) {
        assert.equal(f.get(D+8),0xc001c0de,'baseline caller incorrectly completed');
        assert.equal(f.get(ENTRY),1);
        assert.equal(f.e.get_yield_reason(),0,'baseline erased callback yield');
        const fill=f.vfs.fillPendingRead(pending);
        await Promise.resolve();assert(f.requested()>0);
        f.snap('baseline-before-resolution');f.resolveProvider();await fill;
        for(let i=0;i<4;i++)f.e.run(1000);
        assert.equal(f.get(COMPLETE),0,'baseline loses callback even after exact provider resolves');
        f.snap('baseline-lost-after-resolution');
        return f;
      }
      assert.equal(f.get(D+8),0,'caller must not report success before callback completion');
      assert.equal(f.e.get_yield_reason(),12,'park survives public HELP_COMMAND');
      const parked=f.trace.find(r=>r.label==='actual-io-park');
      assert.equal(f.e.get_esp()>>>0,parked.esp,'public epilogue must not pop the parked callback stack');
      assert.equal(f.e.get_eip()>>>0,parked.eip,'owning ReadFile instruction remains parked');
      f.e.com_callback_check(BigInt(parked.token));
      assert.equal(String(f.e.null_diag_token()),parked.token,'park retains exact callback identity');
      const fill=f.vfs.fillPendingRead(pending);
      await Promise.resolve();assert(f.requested()>0,'actual unresolved provider requested');
      f.snap('before-provider-resolution');f.resolveProvider();await fill;
      f.snap('after-provider-resolution');f.e.clear_yield();
      for(let i=0;i<64&&!f.get(D+8);i++)f.e.run(1000);
    }
    const expected=nested?2:1;
    assert.equal(f.get(ENTRY),expected,'exactly one native entry per callback');
    assert.equal(f.get(COMPLETE),expected,'exactly one native completion per callback');
    assert.equal(f.get(COUNT),PAYLOAD.length);assert.equal(f.get(D+0x4c),1);
    assert.deepEqual(f.mem.slice(f.e.guest_to_wasm(BUF),f.e.guest_to_wasm(BUF)+PAYLOAD.length),PAYLOAD);
    assert.equal(f.get(D+0x50),'p'.charCodeAt(0),'owned string survives suspension');
    assert.equal(f.get(D+4),0x51ac0ffe,'interrupted stack canary');
    assert.equal(f.get(D+8),0xc001c0de,'caller completes after callback');
    checkRestored(f.get,SNAP,0x11000000,1);
    f.e.run(1000);assert.equal(f.get(COMPLETE),expected,'no duplicate completion');
    const end=f.snap('completed-once');
    assert.equal(end.token,f.trace[0].token,'original invocation restored');
    assert.equal(end.root,f.trace[0].root,'original root retained');
    assert.equal(end.depth,f.trace[0].depth,'callback invocation retired once');
    if(!eager) {
      const old=BigInt(f.trace.find(r=>r.label==='actual-io-park').token);
      const sibling=f.e.com_callback_enter();
      assert.notEqual(sibling,old,'next sibling has fresh identity');
      assert.throws(()=>f.e.com_callback_check(old),WebAssembly.RuntimeError,'retired callback cannot own sibling');
      f.e.com_callback_leave(sibling);
    }
    if(other) {
      assert.equal(f.vfs.getIoState(2).pendingRead,other.pending,'unrelated pending read retained');
      assert.equal(other.peer.get_yield_reason(),12,'peer remains parked');
      assert.equal(other.requested(),0,'callback never resolves unrelated provider');
    }
    return f;
  } finally {
    f.snap('final');
    if(process.env.HELP_SUSPENSION_EVIDENCE) {
      const dir=process.env.HELP_SUSPENSION_EVIDENCE;fs.mkdirSync(dir,{recursive:true});
      const name=path.basename(file)+(wide?'.wide':'')+(eager?'.eager':foreign?'.foreign':nested?'.nested':'.lazy');
      fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(f.trace,null,2)+'\n');
      fs.writeFileSync(path.join(dir,name+'.exe'),f.native.exe);
      fs.writeFileSync(path.join(dir,name+'.dll'),f.native.dll);
    }
  }
}
async function termination(file) {
  const f=await fixture(file,{terminate:true});
  for(let i=0;i<64&&f.e.get_yield_reason()!==12;i++)f.e.run(1000);
  assert.equal(f.e.get_yield_reason(),12);
  const pending=f.vfs.getIoState(1).pendingRead;assert(pending);
  f.snap('termination-park');
  const fill=f.vfs.fillPendingRead(pending);f.resolveProvider();await fill;
  f.e.clear_yield();
  for(let i=0;i<64&&f.e.get_yield_reason()!==2;i++)f.e.run(1000);
  assert.equal(f.e.get_yield_reason(),2,'actual ExitThread remains terminal');
  assert.equal(f.e.get_eip(),0);assert.deepEqual(f.exits,[77]);
  assert.equal(f.get(COMPLETE),0,'terminated callback never completes');
  assert.equal(f.get(D+8),0,'termination never revives caller');
  f.snap('terminated');
  saveTrace(file,'termination',f);
  return f;
}
async function terminateWhileParked(file) {
  const {ThreadManager}=require('../lib/thread-manager');
  const f=await fixture(file);
  const tm=new ThreadManager(null,f.memory,{exports:f.e},()=>({host:{}}),
    {waitNow:()=>100,sleepNow:()=>100,getVfs:()=>f.vfs});
  for(let i=0;i<64&&f.e.get_yield_reason()!==12;i++)f.e.run(1000);
  assert.equal(f.e.get_yield_reason(),12);
  const pending=f.vfs.getIoState(1).pendingRead;assert(pending);
  tm._mainSleepUntil=5100;tm.noteMainSleep();
  f.snap('host-termination-before-resolution');
  f.e.exit_thread_after_dll_unload(88);f.e.run(1000);tm.noteMainSleep();
  assert.equal(f.e.get_help_macro_suspended_token(),0n);
  assert.equal(tm._mainHelpCallbackState,null,'termination discards interrupted host wait');
  assert.equal(tm._mainSleepUntil,0,'termination cannot revive interrupted deadline');
  const fill=f.vfs.fillPendingRead(pending);f.resolveProvider();await fill;
  f.e.run(1000);
  assert.deepEqual(f.exits,[88]);assert.equal(f.e.get_yield_reason(),2);
  assert.equal(f.get(ENTRY),1);assert.equal(f.get(COMPLETE),0);assert.equal(f.get(D+8),0);
  f.snap('host-terminated-after-provider-resolution');saveTrace(file,'parked-termination',f);
}
async function interruptedSleep(file) {
  const {ThreadManager}=require('../lib/thread-manager');
  const f=await fixture(file,{sleepFirst:true});
  let now=100;
  const tm=new ThreadManager(null,f.memory,{exports:f.e},()=>({host:{}}),
    {waitNow:()=>now,sleepNow:()=>now,getVfs:()=>f.vfs});
  f.e.run(1000);tm.noteMainSleep();
  const deadline=tm._mainSleepUntil;
  assert.equal(deadline,5100,'deadline established by real guest Sleep');
  const names=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
  const before=names.map(n=>f.e['get_'+n]());
  const eip=f.e.get_eip();
  // Supplementary native interruption seam; the primary cases above always
  // enter through the generated EXE's public WinHelpA HELP_COMMAND call.
  const macro=`Probe("parked",${f.h})`;
  f.e.test_help_macro_execute(0,f.e.guest_to_wasm(B+0x18c0),macro.length);
  assert.equal(f.e.get_yield_reason(),12);
  const pending=f.vfs.getIoState(1).pendingRead;assert(pending);
  const waitState={waitStartedAt:83,waitPolls:7};
  tm._mainWaitState=waitState;tm._mainWaitStartedAt=83;tm._mainWaitPolls=7;
  tm.noteMainSleep();
  assert.equal(tm.isMainSleeping(),false,'interrupted Sleep does not block callback I/O');
  assert.notEqual(tm._mainWaitState,waitState,'callback gets separate host wait bookkeeping');
  f.snap('sleep-interrupted-park');
  const fill=f.vfs.fillPendingRead(pending);
  now=2500;f.resolveProvider();await fill;f.e.clear_yield();
  for(let i=0;i<64&&!f.get(COMPLETE);i++)f.e.run(1000);
  assert.equal(f.get(COMPLETE),1);
  assert.deepEqual(names.map(n=>f.e['get_'+n]()),before,'interrupted native registers/stack');
  assert.equal(f.e.get_eip(),eip,'exact interrupted instruction');
  tm.noteMainSleep();
  assert.equal(tm._mainSleepUntil,deadline,'absolute wait deadline retained');
  assert.equal(tm.mainSleepRemaining(),2600,'callback time counts toward interrupted wait');
  assert.equal(tm._mainWaitState,waitState,'interrupted host wait object restored exactly');
  assert.equal(tm._mainWaitStartedAt,83);assert.equal(tm._mainWaitPolls,7);
  f.snap('sleep-restored');
  saveTrace(file,'sleep',f,{deadline,remaining:tm.mainSleepRemaining()});
  return f;
}
function saveTrace(file,mode,f,extra={}) {
  if(!process.env.HELP_SUSPENSION_EVIDENCE)return;
  const dir=process.env.HELP_SUSPENSION_EVIDENCE;fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,path.basename(file)+'.'+mode+'.json'),
    JSON.stringify({trace:f.trace,...extra},null,2)+'\n');
  fs.writeFileSync(path.join(dir,path.basename(file)+'.'+mode+'.exe'),f.native.exe);
  fs.writeFileSync(path.join(dir,path.basename(file)+'.'+mode+'.dll'),f.native.dll);
}
async function rejectStale(file,mode) {
  const f=await fixture(file);
  for(let i=0;i<64&&f.e.get_yield_reason()!==12;i++)f.e.run(1000);
  assert.equal(f.e.get_yield_reason(),12);assert(f.vfs.getIoState(1).pendingRead);
  const old=f.e.get_help_macro_suspended_token();assert(old);
  if(mode==='sibling') {
    f.e.com_callback_leave(old);f.e.com_callback_enter();
  } else if(mode==='child') f.e.com_callback_enter();
  else {
    const host=createHostImports({vfs:f.vfs,getMemory:()=>f.memory.buffer}).host;
    Object.assign(host,{memory:f.memory,log(){},log_i32(){},exit(){}});
    const replacement=new WebAssembly.Instance(f.module,{host}).exports;
    if(mode==='thread-retirement') replacement.init_thread(0,B,f.e.get_code_start(),f.e.get_code_end(),
      f.e.get_thunk_base(),f.e.get_thunk_end(),f.e.get_num_thunks(),0);
    else {
      f.mem.set(f.native.exe,replacement.get_staging());replacement.load_pe(f.native.exe.length);
    }
  }
  const names=['eax','ecx','edx','ebx','esp','ebp','esi','edi','eip'];
  const before=names.map(n=>f.e['get_'+n]());
  f.snap('before-rejected-resume');
  assert.throws(()=>f.e.run(1000),WebAssembly.RuntimeError,mode+' rejects parked resume');
  assert.deepEqual(names.map(n=>f.e['get_'+n]()),before,'rejection precedes CPU restoration/execution');
  assert.equal(f.get(D+8),0,'stale callback never resumes public caller');
  f.snap('after-rejected-resume');
  saveTrace(file,mode,f,{rejected:true,old:String(old)});
}
async function replaceInPlace(file,{terminated=false}={}) {
  const f=await fixture(file);
  for(let i=0;i<64&&f.e.get_yield_reason()!==12;i++)f.e.run(1000);
  assert.equal(f.e.get_yield_reason(),12);assert(f.vfs.getIoState(1).pendingRead);
  const old=f.e.get_help_macro_suspended_token();assert(old);
  const {ThreadManager}=require('../lib/thread-manager');
  const tm=new ThreadManager(null,f.memory,{exports:f.e},()=>({host:{}}),
    {waitNow:()=>100,sleepNow:()=>100,getVfs:()=>f.vfs});
  tm._mainSleepUntil=5100;tm.noteMainSleep();
  assert.equal(tm._mainSleepUntil,0,'callback owns host scheduling while parked');
  if(terminated) {f.e.exit_thread_after_dll_unload(89);f.e.run(1000);tm.noteMainSleep();}
  const next=buildPe({imageBase:B,entryRva:0x2000,codeRva:0x2000,
    imports:[],code(){return new X86().set(D+8,0x51a7e001).emit(0xeb,0xfe).finish();}}).img;
  f.mem.set(next,f.e.get_staging());const entry=f.e.load_pe(next.length);
  // This fixture reuses the instance and writes code from the host. Invalidate
  // that old decoded range explicitly, just as a host code replacement must.
  f.e.invalidate_code_range(B+0x1000,0x6000);
  assert.equal(f.e.get_help_macro_suspended_token(),0n,'explicit process replacement retires help head');
  assert.throws(()=>f.e.com_callback_check(old),WebAssembly.RuntimeError);
  tm.noteMainSleep();assert.equal(tm._mainSleepUntil,0,'replacement does not inherit interrupted host deadline');
  // Explicit host retirement cancels the old file operation before scheduling
  // the newly loaded process; it never resolves the retired callback's read.
  f.vfs.closeHandle(f.h);f.e.clear_yield();
  f.e.init_thread(0,B,f.e.get_code_start(),f.e.get_code_end(),
    f.e.get_thunk_base(),f.e.get_thunk_end(),f.e.get_num_thunks(),0);
  assert.equal(f.e.get_sync_msg_depth(),0,'explicit thread replacement clears retired sync pins');
  f.e.set_eip(entry);f.e.set_esp(0x074fff20);
  f.snap('new-process-before-start');saveTrace(file,'same-instance-before-start',f,{entry});
  // A terminal slice may still carry its ordinary one-shot yield flag.
  for(let i=0;i<4&&!f.get(D+8);i++)f.e.run(1000);
  f.snap('new-process-after-start');saveTrace(file,'same-instance-after-start',f,{entry});
  assert.equal(f.get(D+8),0x51a7e001,'new process runs without reviving old callback');
  f.snap('replacement-process-ran');saveTrace(file,terminated?'terminated-instance-replacement':'same-instance-replacement',f,{old:String(old)});
}
module.exports={fixture,run,images,termination,interruptedSleep};
if(require.main===module) (async()=>{
  const files=process.argv.length>2?process.argv.slice(2):
    ['build/wine-assembly.wasm','build/wine-assembly.compat.wasm'];
  for(const file of files) for(const eager of [true,false]) {
    const baseline=process.env.HELP_SUSPENSION_BASELINE==='1';
    await run(file,eager,{baseline});console.log('PASS',file,eager?'eager':baseline?'reproduced baseline loss':'lazy');
  }
  if(process.env.HELP_SUSPENSION_BASELINE!=='1') for(const file of files) {
    await run(file,true,{wide:true});console.log('PASS',file,'wide eager');
    await run(file,false,{wide:true});console.log('PASS',file,'wide lazy');
    await run(file,false,{wide:true,nested:true});console.log('PASS',file,'wide nested lazy');
    await run(file,false,{foreign:true});console.log('PASS',file,'unrelated pending read');
    await run(file,false,{nested:true});console.log('PASS',file,'nested public callback suspension');
    await termination(file);console.log('PASS',file,'termination');
    await terminateWhileParked(file);console.log('PASS',file,'termination before provider resolution');
    await interruptedSleep(file);console.log('PASS',file,'interrupted Sleep');
    for(const mode of ['sibling','child','thread-retirement','process-replacement']) {
      await rejectStale(file,mode);console.log('PASS',file,mode);
    }
    await replaceInPlace(file);console.log('PASS',file,'same-instance process replacement');
    await replaceInPlace(file,{terminated:true});console.log('PASS',file,'terminated instance replacement');
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
