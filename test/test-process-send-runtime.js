'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {GuestThreadHost}=require('../lib/guest-thread-host');
const {ProcessSendBroker}=require('../lib/process-send-broker');
const {createHostImports}=require('../lib/host-imports');
const {compileSrcWasm}=require('./compile-src');
const R=require('../lib/region-map.generated');
const deadline=setTimeout(()=>{console.error('Process-send runtime stalled');process.exit(1);},45000);
const backends=[];
(async()=>{
  const context={console,URLSearchParams,setTimeout,clearTimeout,window:{},ProcessSendBroker};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../host.js'),'utf8')+'\n;globalThis.WineAssembly=WineAssembly;',context);
  const module=await WebAssembly.compile(compileSrcWasm((name,src)=>name==='13-exports.wat'
    ?src+'\n(func (export "probe_last_error") (result i32) (global.get $last_error))':src));
  const renderer={windows:{}};
  const sigs=require('../lib/host-import-sigs.generated.json').sigs;
  const api=require('../src/api_table.json').find(a=>a.name==='SendMessageA').id;
  async function make(pid){
    const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
    const imports=createHostImports({getMemory:()=>memory.buffer,renderer,processId:pid,
      resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}},onExit:()=>{}});
    imports.host.memory=memory;
    for(const name of ['create_thread','exit_thread','create_event','set_event',
      'reset_event','wait_multiple'])imports.host[name]=()=>0;
    imports.host.wait_single=()=>0xffff;
    const backend=new GuestThreadHost({memory,module,sigs,hostImports:imports.host,
      workerUrl:path.join(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0});
    backends.push(backend);await backend.start();
    const call=(n,...args)=>backend.callExport(n,...args);
    new DataView(memory.buffer).setUint32(R.BASE.THUNK_BASE+4,api,true);
    new DataView(memory.buffer).setUint32(R.BASE.THUNK_BASE+8,0xcaca0005,true);
    await call('init_thread',0,0x400000,0x400000,0x600000,0x7500000,0x7500010,2);
    await call('set_esp',0x510000);await call('set_eip',0x401234);
    const wine=new context.WineAssembly();wine.renderer=renderer;wine.processId=pid;
    wine._installProcessSendBroker(backend);
    return {backend,memory,call,wine};
  }
  const a=await make(1000),b=await make(1001),hwnd=0x20001,cell=0x500100;
  assert.notEqual(a.memory,b.memory);
  renderer.windows[hwnd]={hwnd,processId:1001};
  const receiver=Buffer.from([0x8b,0x44,0x24,0x10,0xa3,0,0,0,0,0xb8,1,0,0,0,0xc2,0x10,0]);
  receiver.writeUInt32LE(cell,5);
  new Uint8Array(b.memory.buffer).set(receiver,R.BASE.GUEST_BASE+0x100000);
  await b.call('test_wnd_table_set',hwnd,0x500000);await b.call('set_yield_state',7,1);
  async function start(message, codeBase=0x401000){
    // push lParam; push wParam; push message; push hwnd; call SendMessageA;
    // mov ebx,eax; jmp $ -- execute the real stdcall/continuation path.
    const code=Buffer.alloc(29);code[0]=0x68;code.writeUInt32LE(0xe60001,1);
    code[5]=0x6a;code[6]=0;code[7]=0x68;code.writeUInt32LE(message,8);
    code[12]=0x68;code.writeUInt32LE(hwnd,13);code[17]=0xe8;
    code.writeInt32LE(0x7500000-(codeBase+22),18);code.set([0x89,0xc3,0xeb,0xfe],22);
    new Uint8Array(a.memory.buffer).set(code,R.BASE.GUEST_BASE+codeBase-0x400000);
    await a.call('set_esp',0x510000);await a.call('set_eip',codeBase);await a.call('clear_yield');
    return a.backend.slice(100);
  }
  const r=await start(0x400);
  assert.equal(r.yield,10);assert.equal(r.sendTargetTid,-1001);
  assert.equal(r.sendLparam,0xe60001);
  await a.backend.resolveThreadSend(a.backend.link,{targetTid:r.sendTargetTid,
    hwnd:r.sendHwnd,msg:r.sendMsg,wparam:r.sendWparam,lparam:r.sendLparam});
  assert.equal(await b.call('guest_read32',cell),0xe60001);
  assert.equal(await a.call('get_esp'),0x510000);
  assert.equal(await a.call('get_eip'),0x401016);
  assert.equal(await a.call('get_eax'),1);
  assert.equal(await b.call('get_eip'),0x401234);
  assert.equal(await b.call('get_yield_reason'),7);
  // The receiver synchronously sends back to the already parked sender.
  // Both callbacks must run on their own Workers and unwind in stack order.
  renderer.windows[0x10001]={hwnd:0x10001,processId:1000};
  new Uint8Array(a.memory.buffer).set([0xb8,77,0,0,0,0xc2,0x10,0],R.BASE.GUEST_BASE+0x100000);
  await a.call('test_wnd_table_set',0x10001,0x500000);
  const nested=Buffer.alloc(31);
  [0,0,0x401,0x10001].forEach((value,i)=>{nested[i*5]=0x68;nested.writeUInt32LE(value,i*5+1);});
  nested[20]=0xe8;nested.writeInt32LE(0x7500000-(0x500200+25),21);
  nested.set([0x83,0xc0,1,0xc2,0x10,0],25);
  new Uint8Array(b.memory.buffer).set(nested,R.BASE.GUEST_BASE+0x100200);
  await b.call('test_wnd_table_set',hwnd,0x500200);
  const nestedSend=await start(0x400,0x401300);
  assert.equal(nestedSend.yield,10);
  await a.backend.resolveThreadSend(a.backend.link,{targetTid:nestedSend.sendTargetTid,
    hwnd:nestedSend.sendHwnd,msg:nestedSend.sendMsg,wparam:nestedSend.sendWparam,lparam:nestedSend.sendLparam});
  assert.equal(await a.call('get_eax'),78,'actual A -> B -> A synchronous replies unwind');
  assert.equal(await a.call('get_esp'),0x510000);
  assert.equal(await b.call('get_eip'),0x401234);
  assert.equal(await b.call('get_yield_reason'),7);
  const system=await start(0x000c,0x401100); // WM_SETTEXT needs marshalling.
  assert.notEqual(system.yield,10);
  assert.equal(await a.call('probe_last_error'),50);
  assert.equal(await b.call('guest_read32',cell),0xe60001);
  // Losing receiver support fails explicitly rather than executing a shadow.
  const unknown=await a.call('get_yield_reason');assert.equal(unknown,0);
  // An actual invalid guest instruction must reject, never become LRESULT=0.
  new Uint8Array(b.memory.buffer).set([0x0f,0x0b],R.BASE.GUEST_BASE+0x100300);
  await b.call('test_wnd_table_set',hwnd,0x500300);
  const fault=await start(0x400,0x401400);
  assert.equal(fault.yield,10);
  await assert.rejects(a.backend.resolveThreadSend(a.backend.link,{
    targetTid:fault.sendTargetTid,hwnd:fault.sendHwnd,msg:fault.sendMsg,
    wparam:fault.sendWparam,lparam:fault.sendLparam}));
  assert.equal(await b.call('get_eip'),0x500300,'guest fault stays visible to receiver scheduler');
  assert.equal((await b.backend.link.abortThreadSendDispatch(false)).aborted,false,'failed callback frame was already unwound');
  assert.equal(await a.call('get_yield_reason'),10,'failure must not complete sender');
  const request={targetTid:-1001,hwnd,msg:0x400,wparam:0,lparam:0};
  const resolver=a.backend.processSendResolver;
  a.backend.processSendResolver=()=>Promise.reject(new Error('broken transport'));
  await assert.rejects(a.backend._resolveProcessSend(a.backend.link,request),/broken transport/);
  a.backend.processSendResolver=resolver;
  delete renderer.windows[hwnd];
  assert.equal(await a.backend._resolveProcessSend(a.backend.link,request),0);
  assert.equal(await a.call('probe_last_error'),1400);
  renderer.windows[hwnd]={hwnd,processId:1001};
  renderer._processSendBroker.retire(b.wine._processSendEndpoint);
  const unsupported=await start(0x400,0x401200);
  assert.notEqual(unsupported.yield,10);
  assert.equal(await a.call('probe_last_error'),50);
  console.log('PASS real cross-process WAT SendMessageA -> browser host broker -> receiver Worker -> stdcall reply; unsupported route error50');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  await Promise.all(backends.map(b=>b.stop()));clearTimeout(deadline);
});
