'use strict';
// Run from the isolated repository root: node docs/reviews/shell-ex-contract-corrections-oct20.js EVIDENCE_DIR
// Git objects supply absent sparse files. No guest, browser or child process is launched.
const fs=require('fs'),cp=require('child_process'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const base='a54049d11955307d06309e146e85c1aca3196657',candidate='940e0a5faa6b7bc563e4284d27aaf22217e9eebb';
const out=process.argv[2],root=process.cwd();
const diskReadings=[];
function diskGate(){
 if(!out)return;
 const s=fs.statfsSync(out),available=s.bavail*s.bsize,required=2210398208+33554432+25165824+8388608;
 diskReadings.push({at:new Date().toISOString(),available,required});
 // Conservatively reserve the entire 8 MiB, even after some is allocated.
 assert(available>=required,JSON.stringify({available,required,stop:'no retry or cleanup'}));
}
diskGate();
const git=(rev,p)=>cp.execFileSync('git',['show',rev+':'+p],{encoding:'utf8',maxBuffer:16*1024**2});
const source=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):git(base,p);
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const results={base,candidate,inputs:{},controls:[],cases:[],diskReadings};
function input(p){const s=source(p);results.inputs[p]={baseline:sha(git(base,p)),tested:sha(s)};return s;}
function expr(s,p){assert(p>=0);let depth=0;for(let i=p;i<s.length;i++){if(s[i]==='(')depth++;if(s[i]===')'&&--depth===0)return s.slice(p,i+1);}throw Error('unbalanced');}
function func(s,name){s=s.replace(/;;[^\n]*/g,'');return expr(s,s.search(new RegExp('\\(func \\$'+name+'\\s')));}
const compiler={console:{log(){},warn(){},error(){}},TextEncoder,TextDecoder,Float32Array,Float64Array,Uint8Array,ArrayBuffer,Map,Set,RegExp,Array,Object,String,Number,Math,Promise,Date,setTimeout,clearTimeout,setImmediate,parseInt,parseFloat,isNaN};
vm.createContext(compiler);
for(const f of ['compiler-parser.js','compiler-stages.js','compiler-codegen.js','compiler.js']){
 const p='tools/watx-src/'+f,s=source(p);results.inputs[p]={tested:sha(s)};
 vm.runInContext(s,compiler,{filename:p});
}
const shellPath='src/09a7d-handlers-shell-file.wat',shell=input(shellPath),helpers=input('src/10-helpers.wat'),pipes=input('src/09d7-pipes.wat');
const retained=['shellexec_expand','shellexec_error','shellexec_narrow_w','shell_execute_ex','handle_ShellExecuteExA','handle_ShellExecuteExW'];
const adapters=`
 (import "h" "spawn" (func $host_process_spawn (param i32 i32 i32 i32 i32 i32 i32) (result i32)))
 (import "h" "shell" (func $host_shell_execute (param i32 i32 i32 i32 i32 i32) (result i32)))
 (import "h" "alloc" (func $heap_alloc (param i32) (result i32)))
 (import "h" "free" (func $heap_free (param i32)))
 (memory 2) (export "memory" (memory 0))
 (global $reg_base i32 (i32.const 128))
 (global $last_error (mut i32) (i32.const 0))
 (global $env_block (mut i32) (i32.const 8192))
 (global $env_cap i32 (i32.const 4096))
 (global $launch_env_len i32 (i32.const 0))
 (func (export "env") (param $p i32) (global.set $env_block (local.get $p)))
 (func $g2w (param $p i32) (result i32) (local.get $p))
 (func $gl8 (param $p i32) (result i32) (i32.load8_u (local.get $p)))
 (func $gl16 (param $p i32) (result i32) (i32.load16_u (local.get $p)))
 (func $gl32 (param $p i32) (result i32) (i32.load (local.get $p)))
 (func $gs8 (param $p i32) (param $v i32) (i32.store8 (local.get $p) (local.get $v)))
 (func $gs32 (param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v)))
 (func $guest_memmove (param $d i32) (param $s i32) (param $n i32) (memory.copy (local.get $d) (local.get $s) (local.get $n)))
 (func $ptr_range_access_bad (param $p i32) (param $n i32) (param i32) (result i32)
   (i32.or (i32.eqz (local.get $p)) (i32.gt_u (local.get $p) (i32.sub (i32.const 131072) (local.get $n)))))
 (func (export "error") (result i32) (global.get $last_error))
 (export "A" (func $handle_ShellExecuteExA))
 (export "W" (func $handle_ShellExecuteExW))`;
function build(text,label,helperText=helpers){
 const names=retained.filter(n=>text.includes('(func $'+n+' '));
 const wat=adapters+'\n'+names.map(n=>func(text,n)).join('\n')+'\n'+
 ['guest_strlen','guest_wcslen','wide_to_ansi','tolower','env_find','env_name_len','env_expand_var','env_expand_a','env_ensure'].map(n=>func(helperText,n).replaceAll('(region.addr $ENV_DEFAULTS 0x000)','(i32.const 12000)').replaceAll('(region.addr $LAUNCH_ENV_OVERRIDES 0x000)','(i32.const 16000)')).join('\n')+'\n'+func(input('src/09a-handlers2-runtime.wat'),'gl_char')+'\n'+func(pipes,'pipe_child_process_handle');
 const r=compiler.compile(wat,new Map(),{mode:'production'});
 assert(r.success,label+': '+r.error);
 if(out){diskGate();fs.writeFileSync(path.join(out,label+'.wat'),wat);fs.writeFileSync(path.join(out,label+'.wasm'),r.wasmBinary);}
 let memory,calls=[],allocAt=32768,failAlloc=false,failAt=0,allocCount=0,pid=0x1234,status=33;
 const live=new Set(),read=p=>p?Buffer.from(new Uint8Array(memory.buffer,p)).toString('latin1').split('\0')[0]:null;
 const exports=new WebAssembly.Instance(new WebAssembly.Module(r.wasmBinary),{h:{
  alloc:n=>{if(failAlloc || ++allocCount===failAt)return 0;const p=allocAt;allocAt+=n+8;live.add(p);return p;},
  free:p=>{assert(live.delete(p),'free allocated buffer');},
  shell:(hwnd,v,f,p,d,show)=>{calls.push({route:'shell',hwnd,verb:read(v),file:read(f),params:read(p),dir:read(d),show});return status;},
  spawn:(cmd,d,ip,spec,count,force,show)=>{calls.push({route:'spawn',cmd:read(cmd),dir:read(d),ip,spec,count,force,show});return pid;}
 }}).exports;
 memory=exports.memory;
 return {exports,memory,calls,live,identity:{label,wat:sha(wat),wasm:sha(r.wasmBinary)},configure:o=>{
  allocAt=32768;failAlloc=o.failAlloc||false;failAt=o.failAt||0;allocCount=0;pid=o.pid===undefined?0x1234:o.pid;status=o.status===undefined?33:o.status;
 }};
}
function runHandlers(module){
 const {exports:e,memory,calls,live}=module,dv=new DataView(memory.buffer),bytes=new Uint8Array(memory.buffer);
 let cases=0;
 for(const wide of [false,true])for(const scenario of ['shell','shell-error','shell-zero','tracked','hidden','default','uppercase','badverb','shortverb','spawn-error','short','null','missing','namespace','alloc-failure']){
  bytes.fill(0);let at=1024;
  const str=t=>{const p=at,b=Buffer.from(t+'\0',wide?'utf16le':'latin1');bytes.set(b,p);at+=b.length+8;return p;};
  const fields=[60,0,123,str('open'),str('C:\\Games\\Ion Launcher.exe'),str('DX2.exe window "save game"'),str('C:\\Games'),5,0xdeadbeef,0,0,0,0,0,0xabcdef12,0x12345678];
  let info=512,expected=1,error=0;
  const tracked=['tracked','hidden','default','uppercase','badverb','shortverb','spawn-error','alloc-failure'].includes(scenario);
  if(tracked)fields[1]=0x440;
  if(scenario==='hidden')fields[7]=0;
  if(scenario==='default')fields[3]=0;
  if(scenario==='uppercase')fields[3]=str('OPEN');
  if(scenario==='badverb'||scenario==='shortverb'){fields[3]=str(scenario==='badverb'?'print':'x');expected=0;error=120;}
  if(scenario==='short'){fields[0]=4;expected=0;error=87;}
  if(scenario==='null'){info=0;expected=0;error=87;}
  if(scenario==='missing'){fields[4]=0;expected=0;error=2;}
  if(scenario==='namespace'){fields[1]=1;expected=0;error=120;}
  if(scenario==='spawn-error'||scenario==='shell-error'){expected=0;error=2;}
  if(scenario==='shell-zero'||scenario==='alloc-failure'){expected=0;error=8;}
  fields.forEach((n,i)=>dv.setUint32(512+4*i,n,true));
  dv.setUint32(144,4096,true);
  module.configure({pid:scenario==='spawn-error'?0:0x1234,status:scenario==='shell-error'?2:scenario==='shell-zero'?0:33,failAlloc:scenario==='alloc-failure'});
  calls.length=0;e[wide?'W':'A'](info,0,0,0,0,0);
  assert.equal(dv.getUint32(128,true),expected,`${wide}/${scenario} result`);
  assert.equal(e.error(),error,`${wide}/${scenario} error`);
  assert.equal(dv.getUint32(144,true),4104,'stdcall');
  assert.equal(dv.getUint32(540,true),fields[7],'nShow preserved');
  assert.equal(dv.getUint32(572,true),0x12345678,'canary');
  assert.equal(live.size,0,'all temporary allocations freed');
  const launches=['shell','shell-error','shell-zero','tracked','hidden','default','uppercase','spawn-error'].includes(scenario);
  assert.equal(calls.length,launches?1:0,`${wide}/${scenario} launch count`);
  if(launches){
   const c=calls[0];assert.equal(c.dir,'C:\\Games');assert.equal(c.show,fields[7]);
   if(tracked){
    assert.deepEqual(c,{route:'spawn',cmd:'"C:\\Games\\Ion Launcher.exe" DX2.exe window "save game"',dir:'C:\\Games',ip:0,spec:0,count:0,force:1,show:fields[7]});
    assert.equal(dv.getUint32(568,true),expected?0x00e41234:0,'real pid handle');
   }else{
    assert.equal(c.file,'C:\\Games\\Ion Launcher.exe');assert.equal(c.params,'DX2.exe window "save game"');assert.equal(c.verb,'open');assert.equal(c.hwnd,123);
    assert.equal(dv.getUint32(568,true),0);
   }
   assert.equal(dv.getUint32(544,true),expected?33:scenario==='shell-zero'?0:2);
  }
  cases++;
 }
 return cases;
}
const fixed=build(shell,'fixed');results.handlerCases=runHandlers(fixed);results.compiled=[fixed.identity];
for(const [label,text]of [
 ['baseline',git(base,shellPath)],
 ['force-removed',shell.replace('(i32.const 0) (i32.const 0) (i32.const 0) (i32.const 1)','(i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)')],
 ['wrong-offset',shell.replaceAll('(local.get $info) (i32.const 32)','(local.get $info) (i32.const 28)')]
]){
 assert.notEqual(text,shell);const m=build(text,label);let failure;
 try{runHandlers(m);}catch(e){failure=e.message;}
 assert(failure,label+' must fail');results.controls.push({label,failure});results.compiled.push(m.identity);
}
const host=input('host.js'),cli=input('test/run.js');
const parser=host.slice(host.indexOf('function parseShellLaunchCommand('),host.indexOf('// Cooperative-scheduler'));
const parsers=new Function(parser+';return {parseShellLaunchCommand,resolveShellLaunchPath};')();
function hostTransport(text){
 const start=text.indexOf('    h.process_spawn ='),end=text.indexOf('    h.shell_execute =',start);
 assert(start>0&&end>start);
 const h={},launches=[],events=[],strings={1:'"C:\\Games\\Ion Launcher.exe" DX2.exe window "save game"',2:'C:\\Games'};
 const vfs={files:new Map(),mergeChildFrom(){events.push('merge');return {written:1,deleted:0};}};
 const self={memory:new WebAssembly.Memory({initial:1}),readString:p=>strings[p],_helpCtx:{vfs},threadManager:{}},WineAssembly={};
 let accepted=true;
 const window={wineShell:{launchVfsExe(...args){launches.push(args);return accepted;}}};
 new Function('h','self','window','WineAssembly','parseShellLaunchCommand','resolveShellLaunchPath','console',text.slice(start,end))(
  h,self,window,WineAssembly,parsers.parseShellLaunchCommand,parsers.resolveShellLaunchPath,{log(){}});
 assert.equal(h.process_spawn(1,2,0,0,0,0,1),0,'ordinary opt-in unchanged');
 const pid=h.process_spawn(1,2,0,0,0,1,0);assert(pid>0,'forced launch');
 const [file,caller,dir,params,opts]=launches.at(-1);
 assert.equal(file,'C:\\Games\\Ion Launcher.exe');assert.equal(dir,'C:\\Games');assert.equal(params,'DX2.exe window "save game"');
 assert.equal(caller,self);assert.equal(opts.hidden,true);assert.equal(opts.showCmd,0);assert.equal(opts.bypassSingleApp,true);
 assert.equal(h.process_ctl(0,pid,0),259);
 opts.onExit({_helpCtx:{vfs:{}},_exitCode:7});
 assert.deepEqual(events,['merge']);assert.equal(h.process_ctl(0,pid,0),7);
 assert.equal(self.threadManager.processCtl(0,pid,0),7);
 accepted=false;assert.equal(h.process_spawn(1,2,0,0,0,1,1),0);assert.equal(self._children.size,1);
 accepted=true;const pid2=h.process_spawn(1,2,0,0,0,1,1);
 assert.equal(launches.at(-1)[4].hidden,false);
 assert.equal(h.process_ctl(1,pid2,9),1);assert.equal(h.process_ctl(0,pid2,0),9);
 assert.equal(h.process_ctl(0,123,0),-1);
 assert.equal(WineAssembly._threadSnapshotSystemIncomplete,true,'preserve current snapshot invalidation');
 return 12;
}
results.hostAssertions=hostTransport(host);
function cliTransport(text){
 const start=text.indexOf('  const spawnVfsChild ='),end=text.indexOf('    if (!EXE_PATH) return 0;',start);
 assert(start>0&&end>start);
 const handlers={},forks=[],events=[],h={},pipeChildren=[],pipeChildByPid=new Map();
 const guest='c:\\games\\ion launcher.exe';
 const vfs={files:new Map([[guest,{}]]),_resolvePath:p=>p.toLowerCase(),getCurrentDirectory:()=> 'c:\\games'};
 const fakeFs={mkdtempSync:()=>'/controlled',writeFileSync(){},existsSync:()=>true,rmSync(){events.push('cleanup');}};
 const storage={exportStore:()=>({})};
 const mockRequire=id=>{
  if(id==='os')return {tmpdir:()=>'/tmp'};
  if(id==='../lib/storage')return storage;
  if(id==='child_process')return {fork(file,args,opts){forks.push({file,args,opts});return {on:(ev,cb)=>handlers[ev]=cb,kill(){}};}};
  throw Error('unexpected require '+id);
 };
 const context={h,ctx:{vfs},SPAWN_PROCESSES_FLAG:false,APP_ENTRY:null,parseShellLaunchCommand:parsers.parseShellLaunchCommand,
  EXE_GUEST_PATH:guest,path,require:mockRequire,fs:fakeFs,saveVfsToHost:()=>[{guestPath:guest,outputPath:'/controlled/in/child.exe'}],
  ASSET_ENTRY:null,DLL_SEED:[],appAsset:p=>p,WASM_PATH:'controlled.wasm',MAX_SECONDS:30,PIPE_CHILD_ARGS:[],
  __filename:'controlled-run.js',nextChildPid:()=>42,relayChild(){},pipeChildren,pipeChildByPid,
  mergeChildState(){assert.equal(pipeChildByPid.get(42).exitCode,259);events.push('merge');},process:{on(){}},
  console:{log(){}},threadSnapshotSystemIncomplete:false,readStr:p=>p===1?'"C:\\Games\\Ion Launcher.exe" DX2.exe window "save game"':'C:\\Games'};
 new Function(...Object.keys(context),text.slice(start,end)+'return 0; };')(...Object.values(context));
 assert.equal(h.process_spawn(1,2,0,0,0,0,1),0);
 assert.equal(h.process_spawn(1,2,0,0,0,1,1),42,'CLI forced launch');
 assert.equal(forks.length,1);assert(forks[0].args.includes('--args=DX2.exe window "save game"'));
 assert(forks[0].args.includes('--cwd=C:\\Games'));assert(forks[0].args.includes('--spawn-processes'));
 assert.equal(pipeChildByPid.get(42).exitCode,259);
 handlers.message({t:'child-exit',code:7});handlers.exit(0);
 assert.deepEqual(events,['merge','cleanup']);assert.equal(pipeChildByPid.get(42).exitCode,7);
 return 9;
}
results.cliAssertions=cliTransport(cli);
// Exercise the actual VFS queue/launch function, with only UI boot/snapshot boundaries replaced.
const browser=input('lib/browser-shell.js');
const launchStart=browser.indexOf('    function launchVfsExe('),launchEnd=browser.indexOf('    // A program that lives only',launchStart);
assert(launchStart>0&&launchEnd>launchStart);
function browserTransport(){
 const calls=[],entries=[],timers=[],apps={},opts={hidden:true,bypassSingleApp:true,beforeRun(){},onExit(){}};
 const caller={_helpCtx:{vfs:{files:new Map([['c:\\games\\ion launcher.exe',{}]]),
  _normPath:p=>p.toLowerCase(),_resolvePath:p=>p.toLowerCase()}},_runSliceAppKey:'controlled'};
 const ctx={apps,appendDebugLog(){},queueMicrotask(){throw Error('unrelated directx route');},lastExitedVfs:null,lastExitedRunSliceAppKey:null,
  snapshotVfs:v=>v,installedAppEntry(...a){entries.push(a);return {args:a[3]};},
  launchInFlight:true,setTimeout:f=>timers.push(f),api:{launchApp:(...a)=>calls.push(a)},
  SINGLE_APP:()=>true,runningApps:[caller],queuePendingLaunch(){throw Error('tracked options must bypass pending queue');}};
 const launch=new Function(...Object.keys(ctx),browser.slice(launchStart,launchEnd)+'return {launchVfsExe,release:()=>{launchInFlight=false;}};')(...Object.values(ctx));
 assert.equal(launch.launchVfsExe('Ion Launcher.exe',caller,'C:\\Games','DX2.exe window "save game"',opts),true);
 assert.equal(calls.length,0);assert.equal(timers.length,1);
 launch.release();timers.shift()();
 assert.equal(calls.length,1);assert.equal(calls[0][1],opts);
 assert.equal(entries[0][0],'c:\\games\\ion launcher.exe');
 assert.equal(entries[0][2],'C:\\Games');assert.equal(entries[0][3],'DX2.exe window "save game"');
 assert.equal(entries[0][4],caller);assert.equal(entries[0][5],'controlled');
 assert.equal(launch.launchVfsExe('missing.exe',caller,'C:\\Games','',opts),false);
 return 11;
}
results.browserBoundaryAssertions=browserTransport();
// The complete production expansion/lookup functions are compiled above.
// Only guest addressing, allocator and host launch boundaries are adapters.
function invoke(m,wide,o={}){
 const e=m.exports,b=new Uint8Array(m.memory.buffer),d=new DataView(m.memory.buffer);
 b.fill(0);m.calls.length=0;e.env(o.lazy?0:8192);
 b.set(Buffer.from((o.environment??'TEMP=C:\\Guest Temp\0EMPTY=\0NEST=%TEMP%\0')+'\0','latin1'),8192);
 let at=1024;
 const str=t=>{if(t===null)return 0;const p=at,v=Buffer.from(t+'\0',wide?'utf16le':'latin1');b.set(v,p);at+=v.length+8;return p;};
 const fields=[o.size??60,o.mask??0x240,0x12345678,str(o.verb===undefined?'open':o.verb),
  str(o.file===undefined?'%temp%\\child.exe':o.file),str(o.params===undefined?'%TEMP% /x':o.params),
  str(o.dir===undefined?'%TEMP%\\work':o.dir),o.show??0,0xfeedbeef,0,0,0,0,0,0xdeadbeef];
 fields.forEach((v,i)=>d.setUint32(512+i*4,v,true));
 d.setUint32(508,0xabcdef01,true);d.setUint32(572,0xabcdef02,true);d.setUint32(144,4000,true);
 const before=Buffer.from(b.subarray(1024,at));
 m.configure(o);e[wide?'W':'A'](512,0,0,0,0,0);
 assert.equal(d.getUint32(144,true),4008);
 assert.equal(d.getUint32(508,true),0xabcdef01);assert.equal(d.getUint32(572,true),0xabcdef02);
 for(let i=0;i<fields.length;i++)if(i!==8&&i!==14)assert.equal(d.getUint32(512+i*4,true),fields[i]>>>0);
 assert.deepEqual(Buffer.from(b.subarray(1024,at)),before,'input strings remain immutable');
 assert.equal(m.live.size,0,'no leaked temporaries');
 return {ok:d.getUint32(128,true),error:e.error(),hInst:d.getUint32(544,true),hProcess:d.getUint32(568,true),
  calls:JSON.parse(JSON.stringify(m.calls))};
}
function envChecks(m){
 let count=0;
 for(const wide of [false,true])for(const tracked of [false,true]){
  for(const [file,dir,expectedFile,expectedDir,environment] of [
   ['%temp%\\child.exe','%TEMP%\\work','C:\\Guest Temp\\child.exe','C:\\Guest Temp\\work'],
   ['%UNKNOWN%\\a.exe','%TEMP','%UNKNOWN%\\a.exe','%TEMP'],
   ['%EMPTY%child.exe',null,'child.exe',null],
   ['%NEST%\\child.exe','', '%TEMP%\\child.exe',''],
   ['%TEMP%\\new.exe','%temp%','D:\\Changed\\new.exe','D:\\Changed','TEMP=D:\\Changed\0'],
  ]){
   const r=invoke(m,wide,{mask:0x200|(tracked?0x40:0),file,dir,environment,show:3});
   assert.equal(r.ok,1);assert.equal(r.calls.length,1);assert.equal(r.calls[0].show,3);
   assert.equal(r.calls[0].dir,expectedDir);
   if(tracked)assert.equal(r.calls[0].cmd,`"${expectedFile}" %TEMP% /x`);
   else {assert.equal(r.calls[0].file,expectedFile);assert.equal(r.calls[0].params,'%TEMP% /x');}
   assert.equal(r.hProcess,tracked?0xe41234:0);count++;
  }
  const plain=invoke(m,wide,{mask:tracked?0x40:0});
  assert.equal(plain.calls[0].dir,'%TEMP%\\work');
  assert.equal(tracked?plain.calls[0].cmd:plain.calls[0].file,tracked?'"%temp%\\child.exe" %TEMP% /x':'%temp%\\child.exe');count++;
 }
 return count;
}
function errorChecks(m){
 let count=0;
 // 27 and 28/30 are grouped into association/DDE failures by this adapter;
 // these broader categories are not a native-Windows differential oracle.
 const expected={0:8,2:2,3:3,5:5,8:8,11:11,26:32,27:1155,28:1156,29:1156,30:1156,31:1155,32:1157,33:0};
 for(const wide of [false,true])for(const [status,error]of Object.entries(expected)){
  const r=invoke(m,wide,{mask:0,status:+status});
  assert.equal(r.error,error);assert.equal(r.hInst,+status);assert.equal(r.ok,+status>32?1:0);assert.equal(r.hProcess,0);count++;
 }
 return count;
}
results.environmentCases=envChecks(fixed);
results.errorCases=errorChecks(fixed);
results.allocationCases=0;
for(const wide of [false,true]){
 const r=invoke(fixed,wide,{lazy:true,failAt:wide?5:1});
 assert.equal(r.ok,0);assert.equal(r.error,8);assert.equal(r.calls.length,0);
 results.allocationCases++;
}
// Four W conversions + ten expansion allocations + tracked command buffer.
for(const wide of [false,true])for(const tracked of [false,true]){
 const total=(wide?4:0)+10+(tracked?1:0);
 for(let failAt=1;failAt<=total;failAt++){
  const r=invoke(fixed,wide,{mask:0x200|(tracked?0x40:0),failAt});
  assert.equal(r.ok,0,`allocation ${wide}/${tracked}/${failAt}`);
  assert.equal(r.error,8);assert.equal(r.hInst,8);assert.equal(r.hProcess,0);assert.equal(r.calls.length,0);
  results.allocationCases++;
 }
}
results.unsupportedCases=0;
for(const wide of [false,true])for(const mask of [1,2,3,4,8,12,15,0x241]){
 const r=invoke(fixed,wide,{mask});
 assert.equal(r.ok,0);assert.equal(r.error,120);assert.equal(r.calls.length,0);results.unsupportedCases++;
}
for(const [label,text,check]of [
 ['environment-disabled',shell.replace('(i32.const 0x200)','(i32.const 0x0)'),envChecks],
 ['mapping-identity',shell.replace('(call $shellexec_error (local.get $status))','(local.get $status)'),errorChecks],
 ['reviewed-candidate',git('940e0a5faa6b7bc563e4284d27aaf22217e9eebb',shellPath),envChecks],
]){
 const m=build(text,label);let failure;try{check(m);}catch(e){failure=e.message;}
 assert(failure,label+' must reject');results.controls.push({label,failure});results.compiled.push(m.identity);
}
function untrackedHost(text){
 const start=text.indexOf('    h.shell_execute ='),end=text.indexOf('    // The guest asked',start);
 let count=0;
 for(const file of ['C:\\App\\child.exe','child.exe'])for(const show of [0,1,3,6])for(const registered of [false,true]){
  const launches=[],h={},strings={1:'open',2:file},self={readString:p=>strings[p],_helpCtx:{vfs:{}},logToUI(){}};
  const window={wineShell:{launchVfsExe:(...a)=>{if(registered)return false;launches.push(a);return true;},
   launchExe:(...a)=>{launches.push(a);return true;}}};
  new Function('h','self','window','WineAssembly','parseShellLaunchCommand','resolveShellLaunchPath','console',text.slice(start,end))(
   h,self,window,{},parsers.parseShellLaunchCommand,parsers.resolveShellLaunchPath,{log(){}});
  assert.equal(h.shell_execute(0,1,2,0,0,show),33);
  assert.deepEqual(launches[0][registered?1:4],{hidden:show===0,showCmd:show});count++;
 }
 return count;
}
results.untrackedHostCases=untrackedHost(host);
// Real queue and launch functions, with scheduling/UI replaced at boundaries.
function queueChecks(text){
 const a=text.indexOf('    function dispatchPendingLaunch('),z=text.indexOf('    // The launch context',a);
 assert(a>0&&z>a);
 const start=text.indexOf('    function launchExe('),end=text.indexOf('    // A program that lives only',start);
 let count=0;
 for(const vfsRoute of [false,true])for(const show of [0,3,6])for(const busy of [false,true]){
  const calls=[],pendingAppLaunches=[],tasks=[],apps={},options={hidden:show===0,showCmd:show};
  const caller={_helpCtx:{vfs:{files:new Map([['c:\\app\\child.exe',{}]]),_normPath:p=>p.toLowerCase(),_resolvePath:p=>p.toLowerCase()}}};
  const ctx={apps,pendingAppLaunches,pendingDispatchScheduled:false,restartAfterCancel:null,appendDebugLog(){},queueMicrotask:f=>tasks.push(f),
   lastExitedVfs:null,lastExitedRunSliceAppKey:null,snapshotVfs:v=>v,installedAppEntry:()=>({}),
   launchInFlight:busy,setTimeout:f=>tasks.push(f),api:{launchApp:(...args)=>calls.push(args)},
   SINGLE_APP:()=>true,runningApps:busy?[caller]:[],appKeyForExe:()=> 'registered-child'};
  const probe=new Function(...Object.keys(ctx),text.slice(a,z)+text.slice(start,end)+
   'return {launchExe,launchVfsExe,release:()=>{launchInFlight=false;runningApps.length=0;dispatchPendingLaunch();}};')(...Object.values(ctx));
  assert.equal(vfsRoute?probe.launchVfsExe('C:\\App\\child.exe',caller,'C:\\App','',options):probe.launchExe('child.exe',options),true);
  if(busy){
   assert.equal(calls.length,0);assert.equal(pendingAppLaunches.length,1);
   probe.release();while(tasks.length)tasks.shift()();
  }else assert.equal(pendingAppLaunches.length,0);
  assert.equal(calls.length,1);assert.equal(calls[0][1],options);count++;
 }
 return count;
}
results.queueCases=queueChecks(browser);
for(const [label,helperText]of [
 ['expand-scratch-guard-removed',helpers.replace('(if (i32.eqz (local.get $scratch)) (then (return (i32.const 0))))','')],
 ['expand-output-guard-removed',helpers.replace('(if (i32.eqz (local.get $tmp)) (then\n      (call $heap_free (local.get $scratch))\n      (return (i32.const 0))))','')],
]){
 assert.notEqual(helperText,helpers);
 const m=build(shell,label,helperText);let failure;
 try{
  const r=invoke(m,false,{failAt:label.includes('scratch')?1:2});
  assert.equal(r.ok,0);assert.equal(r.error,8);assert.equal(r.calls.length,0);
 }catch(e){failure=e.message;}
 assert(failure,label);results.controls.push({label,failure});results.compiled.push(m.identity);
}
for(const [label,fn,text]of [
 ['untracked-options-removed',untrackedHost,host.replaceAll('launchDir, params, launchOpts','launchDir, params')],
 ['queue-options-removed',queueChecks,browser.replace('api.launchApp(next.key, next.options)','api.launchApp(next.key)')],
 ['tracked-show-removed',hostTransport,host.replace('showCmd, beforeRun, onExit','beforeRun, onExit')],
]){
 let failure;try{fn(text);}catch(e){failure=e.message;}assert(failure,label);results.controls.push({label,failure});
}
for(const [label,fn,text]of [['host-force-removed',hostTransport,host.replace('!pipes && !forceSpawn &&','!pipes &&')],['cli-force-removed',cliTransport,cli.replace('forceSpawn || SPAWN_PROCESSES_FLAG','SPAWN_PROCESSES_FLAG')]]){
 let failure;try{fn(text);}catch(e){failure=e.message;}assert(failure,label);results.controls.push({label,failure});
}
const sigs=JSON.parse(input('lib/host-import-sigs.generated.json')).sigs.process_spawn;
assert.deepEqual(sigs,{params:Array(7).fill('i32'),results:['i32']});
assert(input('src/01-header.wat').includes('(func $host_process_spawn (param i32 i32 i32 i32 i32 i32 i32) (result i32))'));
assert(input('lib/host-imports.js').includes('process_spawn: (cmdWa, dirWa, childIp, specWa, count, forceSpawn, showCmd) => 0'));
// Same sources/arguments sent by ordinary CreateProcess; only two trailing ABI defaults added.
const spawnCall=expr(pipes,pipes.indexOf('(call $host_process_spawn'));
assert(spawnCall.endsWith('(i32.const 0) (i32.const 1))'));
results.limits=['memory/allocator adapters, no full dispatch or full build','host UI boundary mocked; no browser/guest launched','CLI fork/filesystem mocked; no child executed','Unicode conversion retains existing low-byte ANSI behavior','native/runtime qualification remains separate'];
console.log(JSON.stringify(results,null,2));
if(out){diskGate();fs.writeFileSync(path.join(out,'tests.json'),JSON.stringify(results,null,2)+'\n');}
