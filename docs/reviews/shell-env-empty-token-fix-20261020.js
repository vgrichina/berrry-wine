'use strict';
// Run from a repository with the exact reviewed objects available:
// node docs/reviews/shell-env-empty-token-fix-20261020.js OUTPUT_DIR
// No checkout, full build, browser, guest, or child launch. All compilation is in memory.
const fs = require('fs'), cp = require('child_process'), vm = require('vm');
const assert = require('assert/strict'), crypto = require('crypto'), path = require('path');
const revision = 'e295f11287fde0ce2efa0d0da9491933481fc81f';
const out = process.argv[2];
const git = (...args) => cp.execFileSync('git', args, {encoding:'utf8',maxBuffer:16*1024**2});
const source = p => p === 'src/10-helpers.wat' ? fs.readFileSync(p,'utf8') : git('show', `${revision}:${p}`);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const results = {revision, at:new Date().toISOString(), checks:[], controls:[], observations:[], capacity:[]};
function gate() {
  const s = fs.statfsSync(out || '.'), available = s.bavail*s.bsize, required = 2277507072;
  const reading = {available,required,at:new Date().toISOString()};
  results.capacity.push(reading);
  if (available < required) {
    if(out)fs.writeFileSync(path.join(out,'blocked.json'),JSON.stringify(reading,null,2));
    throw Error(`STOP no retry/cleanup: ${JSON.stringify(reading)}`);
  }
}
gate();
// Replay the correction helper with only 10-helpers.wat read from this checkout, output
// disabled (its original fixed heap is unsuitable for our larger boundary cases).
// Expose its compiler and actual function extractor, not its test allocator.
const helperPath = 'docs/reviews/shell-ex-contract-corrections-oct20.js';
let replay = source(helperPath);
results.originalHelperHash = sha(replay);
replay = replay.replace("const source=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):git(base,p);",
  `const source=p=>p==='src/10-helpers.wat'?fs.readFileSync(p,'utf8'):git('${revision}',p);`);
assert(replay.includes(`const source=p=>p==='src/10-helpers.wat'?fs.readFileSync(p,'utf8'):git('${revision}',p);`));
const ctx = {require, process:{argv:['node','replay'],cwd:()=>process.cwd()}, console:{log(){}},
  Buffer, WebAssembly, TextEncoder, TextDecoder, setTimeout, clearTimeout, setImmediate};
vm.createContext(ctx);
vm.runInContext(replay + '\nglobalThis.api={compiler,func,adapters,retained,shell,helpers,pipes,results};',ctx);
const a = ctx.api;
results.replay = JSON.parse(JSON.stringify(a.results));
const check = (name, fn) => {fn();results.checks.push(name);};
const reject = (name, fn) => {
  let message;
  try {fn();} catch(e) {message=e.message;}
  assert(message, `negative control ${name} did not reject`);
  results.controls.push({name,message});
};
function compile(shell=a.shell, helpers=a.helpers) {
  const wat = a.adapters.replace('(memory 2)','(memory 16)') + '\n' +
    a.retained.map(n=>a.func(shell,n)).join('\n') + '\n' +
    ['guest_strlen','guest_wcslen','wide_to_ansi','tolower','env_find','env_name_len','env_expand_var','env_expand_a','env_ensure']
      .map(n=>a.func(helpers,n).replaceAll('(region.addr $ENV_DEFAULTS 0x000)','(i32.const 12000)')
        .replaceAll('(region.addr $LAUNCH_ENV_OVERRIDES 0x000)','(i32.const 16000)')).join('\n') + '\n' +
    a.func(source('src/09a-handlers2-runtime.wat'),'gl_char') + '\n' +
    a.func(a.pipes,'pipe_child_process_handle');
  const r = a.compiler.compile(wat,new Map(),{mode:'production'});
  assert(r.success,r.error);
  return {module:new WebAssembly.Module(r.wasmBinary), hash:sha(r.wasmBinary)};
}
const compiled = compile();
results.compiledHash = compiled.hash;
// New allocator: exact-size red zones, bounded heap, allocation-index fault
// injection, double-free checks, poisoning on release, persistent env ownership.
function invoke(o={}, code=compiled) {
  let mem, bytes, next=32768, attempts=0;
  const live=new Map(), calls=[], requested=[];
  const read=p=>p ? Buffer.from(bytes.subarray(p,bytes.indexOf(0,p))).toString('latin1') : null;
  function guards(p,n) {
    assert(bytes.subarray(p-16,p).every(x=>x===0xa7),'allocation prefix red zone');
    assert(bytes.subarray(p+n,p+n+16).every(x=>x===0xa7),'allocation suffix red zone');
  }
  const e = new WebAssembly.Instance(code.module,{h:{
    alloc(n) {
      requested.push(n);attempts++;
      if(o.changeEnvironment && attempts===(o.wide?7:3)) {
        bytes.fill(0,8192,12288);bytes.set(Buffer.from(o.changeEnvironment+'\0'),8192);
      }
      if(attempts===o.failAt || n > (o.maxAlloc??900000) || next+n+32>bytes.length)return 0;
      const p=next+16; next=p+n+16;
      bytes.fill(0xa7,p-16,p+n+16);bytes.fill(0xcc,p,p+n);
      live.set(p,n);return p;
    },
    free(p) {
      assert(live.has(p),'free must own a live allocation');
      const n=live.get(p);guards(p,n);bytes.fill(0xdd,p,p+n);live.delete(p);
    },
    shell(hw,v,f,p,d,show) {calls.push({verb:read(v),file:read(f),params:read(p),dir:read(d),show});return o.status??33;},
    spawn(c,d,ip,spec,count,force,show) {calls.push({cmd:read(c),dir:read(d),force,show});return o.pid??123;}
  }}).exports;
  mem=e.memory;bytes=new Uint8Array(mem.buffer);const dv=new DataView(mem.buffer);
  const environment=o.environment??'ROOT=C:\\Guest Path\0EMPTY=\0';
  assert(Buffer.byteLength(environment)<4096);
  bytes.set(Buffer.from(environment+'\0'),o.lazy?12000:8192);
  e.env(o.lazy?0:8192);
  let inputAt=1024;
  function str(t) {
    if(t===null)return 0;
    const b=Buffer.from(t+'\0',o.wide?'utf16le':'latin1'),p=inputAt;
    inputAt+=b.length+8;assert(inputAt<8192,'test input overlaps environment');
    bytes.set(b,p);return p;
  }
  const fields=[60,o.mask??0x240,42,str(o.verb??'open'),str(o.file??'%ROOT%\\child.exe'),
    str(o.params??'/flag "%ROOT%"'),str(o.dir===undefined?'%ROOT%':o.dir),o.show??3,0x11111111,0,0,0,0,0,0x22222222];
  fields.forEach((v,i)=>dv.setUint32(512+i*4,v,true));
  dv.setUint32(508,0xabcd1234,true);dv.setUint32(572,0x5678abcd,true);dv.setUint32(144,4096,true);
  const original=Buffer.from(bytes.subarray(1024,inputAt));
  e[o.wide?'W':'A'](512,0,0,0,0,0);
  assert.deepEqual(Buffer.from(bytes.subarray(1024,inputAt)),original);
  for(let i=0;i<15;i++)if(i!==8&&i!==14)assert.equal(dv.getUint32(512+i*4,true),fields[i]>>>0);
  assert.equal(dv.getUint32(508,true),0xabcd1234);assert.equal(dv.getUint32(572,true),0x5678abcd);
  assert.equal(dv.getUint32(144,true),4104);
  for(const [p,n]of live)guards(p,n);
  const ok=dv.getUint32(128,true);
  assert.equal(live.size,o.lazy&&attempts>1?1:0,'temporary allocation leak (lazy environment is persistent)');
  // Host-side strings must survive the allocator's poisoning at return.
  const captured=JSON.parse(JSON.stringify(calls));bytes.fill(0xef,32768,next);
  assert.deepEqual(calls,captured);
  return {ok,error:e.error(),hInst:dv.getUint32(544,true),hProcess:dv.getUint32(568,true),calls,attempts,requested};
}
for(const wide of [false,true])for(const tracked of [false,true]) {
  const mask=0x200|(tracked?0x40:0);
  for(const length of [0,1,259,260,1023,2047,4080]) {
    check(`guarded expansion A/W=${wide} tracked=${tracked} valueBytes=${length}`,()=>{
      const value='x'.repeat(length),file='%LONG%'.repeat(8)+'\\a.exe';
      const r=invoke({wide,mask,environment:`LONG=${value}\0`,file,dir:'%LONG%'});
      assert.equal(r.ok,1);assert.equal(r.error,0);
      const expanded=value.repeat(8)+'\\a.exe';
      assert.equal(tracked?r.calls[0].cmd:r.calls[0].file,tracked?`"${expanded}" /flag "%ROOT%"`:expanded);
      assert.equal(r.calls[0].dir,value);assert.equal(r.calls[0].show,3);
    });
  }
  check(`allocator denial of large expansion ${wide}/${tracked}`,()=>{
    const r=invoke({wide,mask,environment:'LONG='+'x'.repeat(4080)+'\0',file:'%LONG%'.repeat(8),maxAlloc:16000});
    assert.equal(r.ok,0);assert.equal(r.error,8);assert.equal(r.calls.length,0);
  });
  for(const [file,dir,expected,expectedDir] of [
    ['a%%b%MISSING%c%','%ROOT%%ROOT%','a%%b%MISSING%c%','C:\\Guest PathC:\\Guest Path'],
    ['%EMPTY%',null,'',null], ['%ROOT%\\%EMPTY%a.exe','','C:\\Guest Path\\a.exe',''],
    ['%=C:%\\child.exe','%=C:%','D:\\Drive\\child.exe','D:\\Drive'],
  ]) check(`token edges ${wide}/${tracked}/${file}`,()=>{
    const r=invoke({wide,mask,file,dir,environment:'ROOT=C:\\Guest Path\0EMPTY=\0'+(file.includes('=C:')?'=C:=D:\\Drive\0':'')});
    assert.equal(r.ok,1);
    assert.equal(tracked?r.calls[0].cmd:r.calls[0].file,tracked?`"${expected}" /flag "%ROOT%"`:expected);
    assert.equal(r.calls[0].dir,expectedDir);
  });
  const normal=invoke({wide,mask});
  for(let failAt=1;failAt<=normal.attempts;failAt++) check(`red-zone allocation failure ${wide}/${tracked}/${failAt}`,()=>{
    const r=invoke({wide,mask,failAt});assert.equal(r.ok,0);assert.equal(r.error,8);assert.equal(r.calls.length,0);
  });
  check(`successful lazy environment ${wide}/${tracked}`,()=>assert.equal(invoke({wide,mask,lazy:true}).ok,1));
  check(`host failure after expansion ${wide}/${tracked}`,()=>{
    const r=invoke({wide,mask,pid:0,status:31});
    assert.equal(r.ok,0);assert.equal(r.error,tracked?2:1155);assert.equal(r.hProcess,0);
  });
  for(const replacement of ['ROOT=x\0','ROOT='+'z'.repeat(200)+'\0'])check(`size drift ${wide}/${tracked}/${replacement.length}`,()=>{
    const r=invoke({wide,mask,changeEnvironment:replacement});
    assert.equal(r.ok,0);assert.equal(r.error,8);assert.equal(r.calls.length,0);
  });
}
// Retain the review diagnostic as an idempotence check. The actual production
// env_find fix must pass without it; the exact parent must still reject.
const guardedHelpers=a.helpers.replace(
  '(call $env_find (i32.add (local.get $scratch) (i32.const 4)) (i32.const 0)))',
  '(if (i32.eq (local.get $j) (i32.add (local.get $i) (i32.const 1))) (then (return (i32.const 0))))\n'+
  '(call $env_find (i32.add (local.get $scratch) (i32.const 4)) (i32.const 0)))');
assert.notEqual(guardedHelpers,a.helpers);
const guarded=compile(a.shell,guardedHelpers);
const original=compile(a.shell,git('show', `${revision}:src/10-helpers.wat`));
results.originalCompiledHash=original.hash;
results.fixedSourceHash=sha(a.helpers);
results.diagnosticGuardHash=guarded.hash;
for(const wide of [false,true])for(const tracked of [false,true])for(const directory of [false,true]) {
  const options={wide,mask:0x200|(tracked?0x40:0),file:directory?'child.exe':'C:\\100%%\\child.exe',
    environment:'=C:=D:\\Drive\0',dir:directory?'C:\\100%%':null};
  const r=invoke(options),actual=directory?r.calls[0].dir:tracked?r.calls[0].cmd:r.calls[0].file;
  const expected=directory?'C:\\100%%':tracked?'"C:\\100%%\\child.exe" /flag "%ROOT%"':'C:\\100%%\\child.exe';
  check(`empty token must remain literal ${wide}/${tracked}/${directory}`,()=>assert.equal(actual,expected));
  const old=invoke(options,original),oldActual=directory?old.calls[0].dir:tracked?old.calls[0].cmd:old.calls[0].file;
  assert(oldActual.includes('D:\\Drive'));
  results.observations.push({kind:'D1 repaired; exact parent rejects same oracle',wide,tracked,directory,actual,expected,oldActual});
  reject(`parent empty token must remain literal ${wide}/${tracked}/${directory}`,()=>assert.equal(oldActual,expected));
  check(`diagnostic empty-token guard ${wide}/${tracked}/${directory}`,()=>{
    const fixed=invoke(options,guarded);
    assert.equal(directory?fixed.calls[0].dir:tracked?fixed.calls[0].cmd:fixed.calls[0].file,expected);
  });
}
// Demonstrate real unsupported requests rather than interpreting a transport
// success as implementation of a Windows mode.
for(const mask of [0x20,0x100,0x8000,0x200000,0x02000000]) {
  const r=invoke({mask:mask|0x40});
  assert.equal(r.ok,1);assert.equal(r.calls.length,1);
  results.observations.push({kind:'unsupported flag accepted',mask:'0x'+mask.toString(16),result:r.ok});
}
for(const show of [0,1,2,3,6,10])check(`show transport only ${show}`,()=>{
  const r=invoke({show});assert.equal(r.calls[0].show,show);assert.equal(r.ok,1);
});
for(const status of [26,27,28,29,30,31,32])check(`shell versus Win32 status ${status}`,()=>{
  const r=invoke({mask:0,status});assert.equal(r.hInst,status);assert.equal(r.ok,0);
  assert.equal(r.error,({26:32,27:1155,28:1156,29:1156,30:1156,31:1155,32:1157})[status]);
});
reject('missing expansion terminator caught by exact allocation red zone',()=>{
  const broken=a.helpers.replace('(local.set $required (i32.add (local.get $out_len) (i32.const 1)))',
    '(local.set $required (local.get $out_len))');
  assert.notEqual(broken,a.helpers);invoke({},compile(a.shell,broken));
});
reject('omitted expanded A buffer release caught',()=>{
  const broken=a.shell.replace('(if (local.get $expanded_file) (then (call $heap_free (local.get $expanded_file))))','');
  assert.notEqual(broken,a.shell);invoke({},compile(broken));
});
reject('disabled expansion caught by independent content oracle',()=>{
  // Boundary oracle ensures the original correction is necessary.
  const broken=a.shell.replace('(i32.const 0x200)','(i32.const 0)');
  const r=invoke({},compile(broken));assert.equal(r.calls[0].cmd,'"C:\\Guest Path\\child.exe" /flag "%ROOT%"');
});
// Actual host shell/spawn + actual pending queue/VFS functions. Deferred launch
// runs after every backing input buffer has been poisoned. No browser boot.
const host=source('host.js'),browser=source('lib/browser-shell.js');
const parser=host.slice(host.indexOf('function parseShellLaunchCommand('),host.indexOf('// Cooperative-scheduler'));
const parsers=new Function(parser+';return {parseShellLaunchCommand,resolveShellLaunchPath};')();
function delayed(tracked,show,registered=false) {
  const bytes=Buffer.alloc(4096),strings=['"C:\\App\\child.exe" /x','C:\\App','open','C:\\App\\child.exe','/x'];
  strings.forEach((s,i)=>bytes.write(s+'\0',256*(i+1)));
  const readString=p=>bytes.subarray(p,bytes.indexOf(0,p)).toString();
  const self={readString,memory:new WebAssembly.Memory({initial:1}),threadManager:{},logToUI(){},
    _helpCtx:{vfs:{files:new Map(registered?[]:[['c:\\app\\child.exe',{}]]),_normPath:p=>p.toLowerCase(),_resolvePath:p=>p.toLowerCase()}}};
  const calls=[],entries=[],tasks=[],apps={},runningApps=[self],pendingAppLaunches=[];
  const context={apps,pendingAppLaunches,pendingDispatchScheduled:false,restartAfterCancel:null,appendDebugLog(){},
    queueMicrotask:f=>tasks.push(f),setTimeout:f=>tasks.push(f),lastExitedVfs:null,lastExitedRunSliceAppKey:null,
    snapshotVfs:v=>v,installedAppEntry:(...a)=>{entries.push(a);return {};},launchInFlight:true,
    api:{launchApp:(...a)=>calls.push(a)},SINGLE_APP:()=>true,runningApps,appKeyForExe:()=> 'registered-child'};
  const q=browser.slice(browser.indexOf('    function dispatchPendingLaunch('),browser.indexOf('    // The launch context',browser.indexOf('    function dispatchPendingLaunch(')));
  const l=browser.slice(browser.indexOf('    function launchExe('),browser.indexOf('    // A program that lives only',browser.indexOf('    function launchExe(')));
  const shell=new Function(...Object.keys(context),q+l+
    'return {launchExe,launchVfsExe,release:()=>{launchInFlight=false;runningApps.length=0;dispatchPendingLaunch();}};')(...Object.values(context));
  const h={},window={wineShell:shell},WineAssembly={};
  const start=host.indexOf('    h.process_spawn ='),end=host.indexOf('    // The guest asked',start);
  new Function('h','self','window','WineAssembly','parseShellLaunchCommand','resolveShellLaunchPath','console',host.slice(start,end))(
    h,self,window,WineAssembly,parsers.parseShellLaunchCommand,parsers.resolveShellLaunchPath,{log(){}});
  const result=tracked?h.process_spawn(256,512,0,0,0,1,show):h.shell_execute(0,768,1024,1280,512,show);
  assert(result>0);assert.equal(calls.length,0);
  assert.equal(pendingAppLaunches.length,tracked?0:1);
  bytes.fill(0xdd);shell.release();
  let guard=0;while(tasks.length){assert(++guard<20);tasks.shift()();}
  assert.equal(calls.length,1);assert.equal(calls[0][1].showCmd,show);assert.equal(calls[0][1].hidden,show===0);
  if(!registered){assert.equal(entries[0][0],'c:\\app\\child.exe');assert.equal(entries[0][2],'C:\\App');assert.equal(entries[0][3],'/x');}
}
for(const show of [0,3,6])for(const tracked of [false,true])check(`deferred host-to-queue lifetime ${tracked}/${show}`,()=>delayed(tracked,show));
for(const show of [0,3,6])check(`deferred registered fallback ${show}`,()=>delayed(false,show,true));
// Shared consumers use the same actual helper bodies. Do not substitute a JS
// environment implementation: the fixtures below only supply memory and heap.
function sharedModule(helpers=a.helpers) {
  const names=['guest_strlen','guest_wcslen','tolower','env_find','env_name_len',
    'env_get','env_set','env_size','env_ensure','env_expand_var','env_expand_a'];
  const wat=a.adapters.replace(/\(export "[AW]" \(func \$handle_ShellExecuteEx[AW]\)\)/g,'')+
    '\n(func $gs16 (param $p i32) (param $v i32) (i32.store16 (local.get $p) (local.get $v)))\n'+
    names.map(n=>a.func(helpers,n).replaceAll('(region.addr $ENV_DEFAULTS 0x000)','(i32.const 12000)')
      .replaceAll('(region.addr $LAUNCH_ENV_OVERRIDES 0x000)','(i32.const 16000)')).join('\n')+
    ['gl_char','lstr_len'].map(n=>a.func(source('src/09a-handlers2-runtime.wat'),n)).join('\n')+
    a.func(source('src/09a0-handlers-base.wat'),'store_char')+
    a.func(source('src/09a6-handlers-crt.wat'),'handle_getenv')+
    ['env_find','env_get','env_set','env_expand_a','handle_getenv'].map(n=>`(export "${n}" (func $${n}))`).join('\n');
  const r=a.compiler.compile(wat,new Map(),{mode:'production'});assert(r.success,r.error);
  return {module:new WebAssembly.Module(r.wasmBinary),hash:sha(r.wasmBinary)};
}
const shared=sharedModule();
results.sharedCompiledHash=shared.hash;
function sharedFixture(code=shared) {
  let bytes,next=32768;const live=new Map();
  const e=new WebAssembly.Instance(code.module,{h:{
    shell(){throw Error('unexpected shell call');},spawn(){throw Error('unexpected spawn');},
    alloc(n){const p=next+16;next=p+n+16;assert(next<131072);bytes.fill(0xa7,p-16,next);live.set(p,n);return p;},
    free(p){assert(live.has(p));const n=live.get(p);assert(bytes.subarray(p-16,p).every(x=>x===0xa7));
      assert(bytes.subarray(p+n,p+n+16).every(x=>x===0xa7));bytes.fill(0xdd,p,p+n);live.delete(p);}
  }}).exports;
  bytes=new Uint8Array(e.memory.buffer);const dv=new DataView(e.memory.buffer);
  bytes.set(Buffer.from('=C:=D:\\Drive\0ROOT=C:\\Named\0EMPTY=\0\0'),8192);
  const put=(p,s,wide=0)=>bytes.set(Buffer.from(s+'\0',wide?'utf16le':'latin1'),p);
  const read=(p,wide=0)=>{let end=p;while(wide?dv.getUint16(end,true):bytes[end])end+=wide?2:1;
    return Buffer.from(bytes.subarray(p,end)).toString(wide?'utf16le':'latin1');};
  return {e,bytes,dv,put,read,live};
}
for(const wide of [0,1]) {
  for(const [name,value] of [['=C:','D:\\Drive'],['=c:','D:\\Drive'],['rOoT','C:\\Named'],['EMPTY','']]) {
    check(`shared lookup/get A/W=${wide} name=${name}`,()=>{
      const {e,bytes,put,read}=sharedFixture();put(1024,name,wide);
      assert(e.env_find(1024,wide)>0);
      assert.equal(e.env_get(1024,0,0,wide),value.length+1);
      bytes.fill(0xa7,2040,2160);
      assert.equal(e.env_get(1024,2048,value.length,wide),value.length+1);
      assert(bytes.subarray(2040,2160).every(x=>x===0xa7),'short get must not overwrite');
      assert.equal(e.env_get(1024,2048,value.length+1,wide),value.length);
      assert.equal(read(2048,wide),value);
      assert(bytes.subarray(2040,2048).every(x=>x===0xa7));
      assert(bytes.subarray(2048+(value.length+1)*(wide?2:1),2160).every(x=>x===0xa7));
    });
  }
  for(const name of ['', 'MISSING'])check(`shared absent lookup/get A/W=${wide} name=${name}`,()=>{
    const {e,bytes,put}=sharedFixture();put(1024,name,wide);bytes.fill(0xa7,2048,2112);
    assert.equal(e.env_find(1024,wide),0);assert.equal(e.env_get(1024,2048,32,wide),0);
    assert(bytes.subarray(2048,2112).every(x=>x===0xa7));
  });
  check(`shared named replace/empty/delete A/W=${wide}`,()=>{
    const {e,put,read}=sharedFixture();put(1024,'=c:',wide);put(1536,'E:\\New',wide);
    assert.equal(e.env_set(1024,1536,wide),1);
    assert.equal(e.env_get(1024,2048,32,wide),6);assert.equal(read(2048,wide),'E:\\New');
    put(1536,'',wide);assert.equal(e.env_set(1024,1536,wide),1);
    assert(e.env_find(1024,wide)>0);assert.equal(e.env_get(1024,2048,32,wide),0);assert.equal(read(2048,wide),'');
    assert.equal(e.env_set(1024,0,wide),1);assert.equal(e.env_find(1024,wide),0);
    put(1024,'ROOT',wide);assert.equal(e.env_get(1024,2048,32,wide),8);assert.equal(read(2048,wide),'C:\\Named');
  });
  check(`empty deletion cannot remove hidden drive A/W=${wide}`,()=>{
    const {e,bytes,put}=sharedFixture();put(1024,'',wide);const saved=Buffer.from(bytes.subarray(8192,8256));
    assert.equal(e.env_set(1024,0,wide),1);assert.deepEqual(Buffer.from(bytes.subarray(8192,8256)),saved);
  });
}
for(const name of ['', '=c:', 'ROOT','EMPTY','MISSING'])check(`CRT getenv ${name}`,()=>{
  const {e,dv,put,read}=sharedFixture();put(1024,name);dv.setUint32(144,4096,true);
  e.handle_getenv(1024,0,0,0,0,0);
  const pointer=dv.getUint32(128,true);assert.equal(dv.getUint32(144,true),4100);
  if(name===''||name==='MISSING')assert.equal(pointer,0);
  else {assert(pointer>0);assert.equal(read(pointer),({'=c:':'D:\\Drive',ROOT:'C:\\Named',EMPTY:''})[name]);}
});
for(const [input,expected] of [
  ['%%','%%'],['%%%%','%%%%'],['%%/%ROOT%/%EMPTY%/%MISSING%/%','%%/C:\\Named//%MISSING%/%'],
  ['%=C:%/%%/%=c:%','D:\\Drive/%%/D:\\Drive']
])check(`direct expansion sizing/short/alias ${input}`,()=>{
  const {e,bytes,put,read,live}=sharedFixture();put(1024,input);
  assert.equal(e.env_expand_a(1024,0,0),expected.length+1);
  bytes.fill(0xa7,2048,2176);
  assert.equal(e.env_expand_a(1024,2048,expected.length),expected.length+1);
  assert(bytes.subarray(2048,2176).every(x=>x===0xa7));
  assert.equal(e.env_expand_a(1024,1024,expected.length+1),expected.length+1);
  assert.equal(read(1024),expected);assert.equal(live.size,0);
});
reject('shared lookup parent still aliases empty name to hidden entry',()=>{
  const {e,put}=sharedFixture(sharedModule(git('show',`${revision}:src/10-helpers.wat`)));
  put(1024,'');assert.equal(e.env_find(1024,0),0);
});
reject('overbroad hidden-name rejection breaks explicit named lookup',()=>{
  const broken=a.helpers.replace(
    '(i32.eqz (call $gl_char (local.get $name_g) (local.get $wide)))',
    '(i32.le_u (call $gl_char (local.get $name_g) (local.get $wide)) (i32.const 0x3D))');
  assert.notEqual(broken,a.helpers);
  const {e,put}=sharedFixture(sharedModule(broken));put(1024,'=C:');
  assert(e.env_find(1024,0)>0);
});
results.limits=['No native Windows differential, full dispatch/build, Worker scheduling, browser boot, CLI fork or actual child behavior.',
  'Memory translation and allocator are adapters; red zones cover realistic tested lengths, not arbitrary invalid pointers or integer overflow.',
  'The replay has 13 controls; the review retains three mutation controls and eight unchanged D1 oracles, now passing repaired source and rejecting the exact parent.',
  'Size drift is injected at the allocator boundary, not claimed as a real concurrent environment-write execution.'];
gate();
if(out)fs.writeFileSync(path.join(out,'tests.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({checks:results.checks.length,controls:results.controls.length,replay:results.replay.handlerCases,observations:results.observations}));
