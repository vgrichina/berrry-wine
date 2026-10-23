#!/usr/bin/env node
'use strict';
// No source compiler, default runner startup, renderer, Worker or module fallback.
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto'), vm=require('node:vm'), assert=require('node:assert/strict');
const H=__dirname, mode=process.argv[2];
assert(['normal','capture','wrong-command'].includes(mode));
const contract=JSON.parse(fs.readFileSync(path.join(H,'accepted-contract.json')));
const ids=JSON.parse(fs.readFileSync(path.join(H,'api-ids.json')));
const source='/home/user/wine-assembly-shadow-man-fresh-selection-repair-oct23';
const runner=path.join(source,'test/run.js');
const modulePath=contract.module.path;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const output=path.join(H,mode+'.capture.jsonl');
const obs=fs.openSync(path.join(H,mode+'.observations.jsonl'),'wx',0o600);
const realFsync=fs.fsyncSync;
let seq=0, instance;
function record(x){fs.writeSync(obs,JSON.stringify({sequence:seq++,pid:process.pid,mode,...x})+'\n');realFsync(obs);}
process.on('uncaughtException',e=>{record({failure:String(e),stack:e.stack});process.exitCode=1;});
for(const pin of contract.source) assert.equal(hash(fs.readFileSync(pin.path)),pin.sha256);
const runnerText=fs.readFileSync(runner,'utf8');
// Exact whole shipping dlg-cmd branch; only its enclosing loop is fixture code.
const start=runnerText.indexOf("      } else if (ev.action === 'dlg-cmd') {");
const end=runnerText.indexOf("      } else if (ev.action === 'dlg-post-cmd') {",start);
assert(start>=0&&end>start);
const branch=runnerText.slice(start,end).replace(/^      } else if/,'      if')+'\n      }';
fs.writeFileSync(path.join(H,mode+'.runner-branch.txt'),branch);
record({phase:'fixture-identity',fixture:__filename,fixtureSha256:hash(fs.readFileSync(__filename)),runner,runnerSha256:hash(Buffer.from(runnerText)),branchSha256:hash(Buffer.from(branch)),module:contract.module,sourceCandidate:'b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a',instanceOrdinal:1,synthetic:true});
// Module compilation is routed through the unchanged accepted constructor guard.
// The actual preload still binds these exact bytes and this exact module/instance.
require(contract.guard.path);
WebAssembly.compile=async bytes=>new WebAssembly.Module(bytes);
WebAssembly.compileStreaming=WebAssembly.instantiateStreaming=async()=>{throw Error('streaming forbidden');};
if(mode!=='normal') {
  Object.assign(process.env,{SHADOW_NULL_PID:String(process.pid),SHADOW_NULL_RUNNER_SHA:hash(Buffer.from(runnerText)),SHADOW_NULL_SELECTION:JSON.stringify({mode:'selected-action',actionSequence:1,cmdId:3}),SHADOW_NULL_WATCHDOG_MS:'150000',SHADOW_NULL_BLOCK_POLICY:'required',SHADOW_NULL_OUTPUT:output,SHADOW_NULL_MODE:'revised-first-zero',SHADOW_NULL_REVISED_SHA:contract.module.sha256});
  process.argv=[process.execPath,runner,'--wasm='+modulePath];
  fs.fsyncSync=function(fd){realFsync(fd);if(fd!==obs)record({phase:'capture-fsync-complete',fd});};
  require(path.join(source,'tools/shadow-man-null-preload.cjs'));
}
// Every invocation has one fixed arena; all unused imports throw on invocation.
const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
assert.equal(memory.buffer.byteLength,536870912);
const view=new DataView(memory.buffer), bytes=new Uint8Array(memory.buffer);
const region=n=>{const r=contract.layout.regions.find(r=>r.name===n);assert(r,'missing accepted placement '+n);return r;};
const gb=region('GUEST_BASE').base, tb=region('THUNK_BASE').base, img=0x400000;
const wa=g=>g-img+gb;
const wr=(g,x)=>view.setUint32(wa(g),x>>>0,true);
const imports={};
const notification=new Set(['log','log_i32','log_api_exit','log_block','log_eip','dialog_loaded','register_dialog_frame','destroy_window','sync_window_client','set_window_text','set_window_class','invalidate']);
const scalar={get_ticks:()=>Math.floor(performance.now()),real_time_ms:()=>Date.now()|0,get_window_client_size:()=>100|(80<<16),show_window:()=>1,
  // Headless lifetime acknowledgements only; no Beep request is admitted.
  beep_process_begin:(lo,hi)=>{assert((lo|hi)!==0);return 1;},
  beep_thread_begin:(tid,lo,hi,elo,ehi)=>{assert.equal(tid,1);assert((lo|hi)!==0);assert((elo|ehi)!==0);return 1;},
  // Shipping i32.and evaluates this probe even without a pending DLL load.
  // Fail closed for a real load; otherwise report that no load was serviced.
  service_load_library:()=>{assert.notEqual(instance.exports.get_yield_reason(),5,'fixture has no DLL loader');return 0;}};
for(const i of contract.imports) {
  imports[i.module]??={};
  if(i.kind===2){assert.equal(i.name,'memory');imports[i.module][i.name]=memory;continue;}
  assert.equal(i.kind,0);
  imports[i.module][i.name]=(...args)=>{
    if(i.name==='get_window_rect'){
      const [hwnd,ptr]=args;assert(hwnd!==0);assert(ptr>=0&&ptr+16<=bytes.length);
      [0,0,100,80].forEach((v,k)=>view.setInt32(ptr+k*4,v,true));
      record({host:i.name,args,rect:[0,0,100,80],headless:true});return;
    }
    if(notification.has(i.name)){record({host:i.name,args});return;}
    if(scalar[i.name]){const value=scalar[i.name](...args);record({host:i.name,args,value});return value;}
    throw Error('UNIMPLEMENTED_HOST_CONTRACT '+i.module+'.'+i.name+' '+JSON.stringify(i.signature)+' args='+JSON.stringify(args));
  };
}
// Small hand-encoded guest callback, not wasm/source compilation. It invokes the
// real DialogBoxIndirectParamA, EndDialog, CACA0004 and CACA0005 paths.
const callback=0x4015d4, dlgproc=0x402000, tmpl=0x403000, marker=0x404000;
const thunkGuest=tb-gb+img;
const metadata=[{marker:0xcaca0005,id:0},{marker:0xcaca0004,id:0},
  {marker:0x80000001,id:ids.DialogBoxIndirectParamA},{marker:0x80000002,id:ids.EndDialog}];
metadata.forEach((t,i)=>{view.setUint32(tb+8*i,t.marker,true);view.setUint32(tb+8*i+4,t.id,true);});
function assemble(at,fn){const a=[];const b=(...x)=>a.push(...x);const u=n=>b(n&255,n>>>8&255,n>>>16&255,n>>>24&255);const push=n=>{b(0x68);u(n);};const call=t=>{b(0xe8);u(t-(at+a.length+4));};fn({b,u,push,call});bytes.set(a,wa(at));return Buffer.from(a).toString('hex');}
const code=assemble(callback,({b,u,push,call})=>{
  push(0);push(dlgproc);push(0);push(tmpl);push(0);call(thunkGuest+16);
  b(0xa3);u(marker); // observable modal result written by executed guest x86
  b(0xc2,0x10,0); // stdcall callback return to shipping CACA0005 thunk
});
const dlgcode=assemble(dlgproc,({b,u,push,call})=>{
  b(0x8b,0x44,0x24,0x04); // eax = HWND from actual WM_INITDIALOG guest frame
  push(0x77);b(0x50);call(thunkGuest+24); // EndDialog(hDlg, 0x77)
  b(0xb8);u(1);b(0xc2,0x10,0);
});
// DLGTEMPLATE: hidden, no controls/menu/class/title, 40x30 dialog units.
wr(tmpl,0);wr(tmpl+4,0);
for(const [offset,value] of [[8,0],[10,0],[12,0],[14,40],[16,30],[18,0],[20,0],[22,0]])view.setUint16(wa(tmpl)+offset,value,true);
async function main(){
  const binary=fs.readFileSync(modulePath);
  // Last operation before guarded native module entry is retained-byte hashing.
  assert.equal(binary.length,1879746);assert.equal(hash(binary),contract.module.sha256);
  record({phase:'immediately-before-native-module',bytes:binary.length,sha256:hash(binary),arenaBytes:memory.buffer.byteLength,arenaCount:1,workers:0,implicitSourceCompilation:false});
  const module=await WebAssembly.compile(binary);
  instance=await WebAssembly.instantiate(module,imports);
  const e=instance.exports;
  e.heap_init(0x410000);
  e.init_thread(0,img,0x401000,0x405000,thunkGuest,thunkGuest+metadata.length*8,metadata.length,0);
  e.sync_thunk_state(thunkGuest+metadata.length*8,metadata.length);
  const hwnd=0x550;
  e.wnd_table_set(hwnd,callback);
  e.set_eip(0x404100);e.set_esp(0x740f000);e.set_eax(0x13572468);
  const regs=region('REGFILE').base;
  for(const [off,value] of [[4,0x11111111],[8,0x22222222],[12,0x33333333],[20,0x55555555],[24,0x66666666],[28,0x77777777]])view.setUint32(regs+off,value,true);
  const names=['eax','ecx','edx','ebx','esp','ebp','esi','edi','eip'];
  const snapshot=()=>Object.fromEntries(names.map(n=>[n,e['get_'+n]()>>>0]));
  const before=snapshot();
  assert.equal(e.null_diag_field(8),0);
  record({phase:'initialized-before-action',registers:before,diagCount:e.null_diag_field(8),thunkGuest,metadata,callback,code,dlgproc,dlgcode,templateGuest:tmpl,markerGuest:marker,instanceOrdinal:1,arenaBytes:memory.buffer.byteLength});
  const renderer={windows:{[hwnd]:{hwnd,visible:true,isDialog:true,zOrder:1}}};
  const logs=[], ev={action:'dlg-cmd',cmdId:mode==='wrong-command'?4:3};
  const context={instance,renderer,logs,ev,batch:50,diagnosticActionSequence:1,globalThis,process,__filename:runner};
  record({phase:'selected-boundary-entry',action:ev,actionSequence:1,batch:50,hwnd,runner,pid:process.pid});
  try {vm.runInNewContext('for(let fixtureLoop=0;fixtureLoop<1;fixtureLoop++){'+branch+'\n}',context,{filename:runner,timeout:140000});}
  catch(err){
    if(mode==='wrong-command'&&String(err).includes('wrong or late selected action/HWND')){
      assert.equal(e.null_diag_field(8),0);assert.equal(view.getUint32(wa(marker),true),0);assert.deepEqual(snapshot(),before);
      record({phase:'intended-negative-rejected',error:String(err),diagCount:0,registersUnchanged:true,guestCallbackNotRun:true});return;
    }
    throw err;
  }
  assert.equal(mode,'normal','capture must terminate from native observer, never return');
  assert.equal(e.null_diag_field(8),0);
  assert.equal(view.getUint32(wa(marker),true),0x77);
  assert.deepEqual(snapshot(),before);
  assert.equal(e.null_diag_field(7),0);
  record({phase:'normal-complete',diagCount:0,modalResult:view.getUint32(wa(marker),true),registersRestored:true,registers:snapshot(),syncDepth:0,logs,arenaBytes:memory.buffer.byteLength});
}
main().catch(e=>{record({failure:String(e),stack:e.stack});process.exitCode=1;});
