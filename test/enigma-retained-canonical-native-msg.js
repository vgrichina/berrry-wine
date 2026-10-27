'use strict';
// Executes unmodified retained modules. No WAT extraction, module mutation, or
// direct host completion invocation is used by the behavioral oracle.
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), crypto = require('crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const [source, modulePath, support, output, group = 'core'] = process.argv.slice(2);
const pins = JSON.parse(fs.readFileSync(path.join(support, 'pins.json')));
for (const n of ['message-completion-owner.js', 'message-boundary-trace.js'])
  assert.equal(sha(fs.readFileSync(path.join(support, n))), pins['test/' + n]);
const { createMessageBoundaryTrace } = require(path.join(support, 'message-boundary-trace.js'));
const sigs = JSON.parse(fs.readFileSync(path.join(source, 'lib/host-import-sigs.generated.json'))).sigs;
assert.equal(sha(fs.readFileSync(path.join(source, 'lib/host-import-sigs.generated.json'))), 'b3db9da9a01e5d2378ddafdc62260c224b14858e6d75cdb64d909c6c38948ab8');
const wires = JSON.parse(fs.readFileSync(path.join(support, 'runner-wires.json')));
const bytes = fs.readFileSync(modulePath), hash = sha(bytes);
assert(['af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b', 'ed7635d508f7e842afd3c6b8489ba133ac3ddea2fa305439fca60284ea5613a8'].includes(hash));
const mod = new WebAssembly.Module(bytes);
const imports = WebAssembly.Module.imports(mod);
for (const n of ['message_begin','message_park','message_bind','message_resume','message_complete']) {
  assert(imports.some(x => x.module === 'host' && x.name === n)); assert(sigs[n]);
}
const names = ['GetMessageA','GetMessageW','PeekMessageA','PeekMessageW','SetWindowsHookExA','UnhookWindowsHookEx'];
const BASE = 0x400000, MSG = BASE + 0x5000;
function pe() {
  const b = Buffer.alloc(0x4200), w = (p,v) => b.writeUInt32LE(v >>> 0,p);
  b.writeUInt16LE(0x5a4d); w(0x3c,0x80); w(0x80,0x4550); b.writeUInt16LE(0x14c,0x84); b.writeUInt16LE(1,0x86); b.writeUInt16LE(224,0x94); b.writeUInt16LE(0x102,0x96);
  b.writeUInt16LE(0x10b,0x98); w(0xa8,0x1000); w(0xb4,BASE); w(0xb8,0x1000); w(0xbc,0x200); w(0xd0,0x10000); w(0xd4,0x200); w(0xe0,0x100000); w(0xf4,16); w(0x100,0x2000); w(0x104,40);
  b.write('.text',0x178); w(0x180,0x8000); w(0x184,0x1000); w(0x188,0x4000); w(0x18c,0x200); w(0x19c,0xe0000060);
  const off = r => r - 0x1000 + 0x200;
  w(off(0x2000),0x2100); w(off(0x200c),0x2200); w(off(0x2010),0x2140); b.write('USER32.dll\0',off(0x2200));
  names.forEach((n,i) => { w(off(0x2100+i*4),0x2300+i*64); w(off(0x2140+i*4),0x2300+i*64); b.write(n+'\0',off(0x2302+i*64)); });
  b[0x200] = 0xc3;
  return b;
}
const result = {candidate:'425755ee5ee9be0734c7aca187521100f5487674',module:modulePath,sha256:hash,backend:path.basename(modulePath),scope:'synthetic native canonical decoded execution',productionRunnerQualified:false,originalGame:false,cases:[],incidents:[],remaining:[]};
function checkpoint() { fs.writeFileSync(output, JSON.stringify(result,null,2)+'\n'); }
function context(on, omit = false, hardware = false) {
  const memory = new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  let instance; const calls = [], generic = {}, logs = [], ctx = {};
  const h = {};
  for (const x of imports) if (x.kind === 'function') {
    const s = sigs[x.name]; assert(s, x.name);
    h[x.name] = (...args) => { generic[x.name] = (generic[x.name] || 0)+1; return s.results[0] === 'i64' ? 0n : 0; };
  }
  // Deterministic unrelated host services: no input, clock 123, no networking,
  // no drawing. The real WAT message pump and continuations are never stubbed.
  let hardwarePending=hardware;
  h.get_ticks = () => 123; h.check_input = () => { if(!hardwarePending)return 0;hardwarePending=false;return (65<<16)|0x100; };
  h.check_input_lparam=()=>0x1e0001;
  const translateGuest = addr => instance.exports.guest_to_wasm(addr);
  const install = new Function('require','createMessageBoundaryTrace','TRACE_MESSAGE_BOUNDARY','logs','memory','translateGuest','h','ctx','getInstance',
    'const tickState={batch:0}; const instanceProxy={get exports(){return getInstance().exports}};\n' +
    wires.install.replaceAll('instance.exports','instanceProxy.exports') + '\nreturn {trace:messageBoundaryTrace,owner:messageCompletionOwner};');
  const localRequire = n => require(path.join(support,path.basename(n)));
  const {trace,owner} = install(localRequire,createMessageBoundaryTrace,on,logs,memory,translateGuest,h,ctx,()=>instance);
  for (const n of Object.keys(owner.imports)) { const f=h[n]; h[n]=(...a)=>{calls.push([n,...a]); return omit && n === 'message_complete' ? undefined : f(...a);}; }
  instance = new WebAssembly.Instance(mod,{host:{...h,memory}});
  new Function('ctx','instance','TRACE_MESSAGE_BOUNDARY','messageBoundaryTrace',wires.qualify)(ctx,instance,on,trace);
  trace.arm(true);
  const e=instance.exports, dv=new DataView(memory.buffer), u=new Uint8Array(memory.buffer);
  const image=pe(); u.set(image,e.get_staging()); assert.equal(e.load_pe(image.length),BASE+0x1000);
  e.init_dx_com_thunks(); e.seal_thunks(); e.set_api_log(0);
  const rw=(g,v)=>dv.setUint32(e.guest_to_wasm(g),v>>>0,true), rd=g=>dv.getUint32(e.guest_to_wasm(g),true);
  const stack=e.get_esp()>>>0; assert.notEqual(e.guest_to_wasm(stack),0xf0); assert.equal(e.get_image_base(),BASE);
  let cursor=BASE+0x1000;
  function code(a) { const p=cursor; cursor+=0x100; u.set(a,e.guest_to_wasm(p)); return p; }
  function invoke(name,args,edge='CALL',budget=100) {
    const i=names.indexOf(name); assert(i>=0); const t=rd(BASE+0x2140+i*4); assert(t>=e.get_thunk_base() && t<e.get_thunk_end());
    const a=[], imm=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
    for (const v of [...args].reverse()) a.push(0x68,...imm(v));
    const start=cursor;
    if(edge==='JMP') a.push(0x68,...imm(start+a.length+12));
    a.push(0xb8,...imm(t),0xff,edge==='CALL'?0xd0:0xe0,0xc3);
    // JMP return address points to final RET (five-byte push + seven-byte transfer).
    const p=code(a); rw(stack,0); e.set_esp(stack); e.set_eax(0x76543210); e.set_eip(p); e.set_yield_state(0,0); e.run(budget);
    return {start:p,thunk:t,stack,after:state()};
  }
  function state(){return {eax:e.get_eax()|0,esp:e.get_esp()>>>0,eip:e.get_eip()>>>0,yieldReason:e.get_yield_reason()>>>0,msg:Array.from({length:7},(_,i)=>rd(MSG+i*4)),queue:e.get_post_queue_count()};}
  function queue(message=0x401){e.set_post_queue_count(0);const q=e.get_post_queue_base();[0,message,0x123,0x456].forEach((v,i)=>dv.setUint32(q+i*4,v,true));e.set_post_queue_count(1);}
  return {e,h,trace,calls,logs,invoke,state,queue,rd,rw,code,stack,records:()=>logs.map(s=>JSON.parse(s.slice(19))).filter(r=>r.kind==='message-completion')};
}
function args(name,flags=1){return name.startsWith('Get')?[MSG,0,0,0]:[MSG,0,0,0,flags];}
function runCase(name,edge,kind,on,omit=false){
  const c=context(on,omit); if(kind==='queued')c.queue(); if(kind==='park')c.e.set_incoming_send_pending(1);
  const first=c.invoke(name,args(name),edge); let bound=null;
  if(kind==='park'){
    assert.equal(c.records().length,0);assert.equal(c.e.get_yield_reason(),17);bound=c.state();
    c.h.log_api_exit(); assert.equal(c.records().length,0);
    c.e.set_incoming_send_pending(0);c.queue();c.e.set_yield_state(0,0);c.e.run(100);
  }
  const state=c.state(),records=c.records();
  assert.equal(state.eip,0);assert.equal(state.esp,(c.stack+4)>>>0);
  const expected=kind==='empty' && name.startsWith('Peek')?0:1; assert.equal(state.eax,expected);
  if(kind!=='empty') assert.deepEqual(state.msg.slice(0,4),[0,0x401,0x123,0x456]);
  if(on&&!omit){assert.equal(records.length,1);assert.equal(records[0].api,name);assert.equal(records[0].result,expected);assert.equal(records[0].correlation,'invocation-owned');if(expected)assert.equal(records[0].msg.message,0x401);if(kind==='park'){assert(c.calls.some(x=>x[0]==='message_park'));const begins=c.calls.filter(x=>x[0]==='message_begin');assert.equal(begins.length,2);assert.equal(records[0].invocation,1);}}
  else assert.equal(records.length,0);
  if(!on)assert.equal(c.calls.length,0);
  return {name,edge,kind,on,omit,first,bound,state,records,calls:c.calls};
}
try {
 if(group === 'core') {
  for(const name of names.slice(0,4))for(const edge of ['CALL','JMP'])for(const kind of ['queued','park',...(name.startsWith('Peek')?['empty']:[])]){
    const off=runCase(name,edge,kind,false); global.gc(); const on=runCase(name,edge,kind,true);global.gc();
    assert.deepEqual(on.state,off.state,'OFF/ON architectural noninterference');if(on.bound)assert.deepEqual(on.bound,off.bound);
    result.cases.push({name,edge,kind,pass:true,off,on});checkpoint();
  }
  const bad=runCase('PeekMessageA','CALL','queued',true,true);global.gc();
  assert.throws(()=>assert.equal(bad.records.length,1),assert.AssertionError); result.omissionControl={pass:true,rejectedMissingCompletion:true,actual:bad};checkpoint();
 } else if (group === 'hooks') {
  function hookCase(name,edge,nested,on) {
    const c=context(on), imm=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255], a=[];
    if(nested){
      // Actual nested decoded PeekMessageW has no available message. It returns
      // FALSE and completes independently while the outer hook token is bound.
      for(const v of [1,0,0,0,MSG+64])a.push(0x68,...imm(v));
      a.push(0xb8,...imm(c.rd(BASE+0x2140+3*4)),0xff,0xd0);
    }
    // WH_GETMESSAGE callback edits its real MSG and returns through the
    // module-created CACA continuation thunk, not through a host fixture.
    a.push(0x8b,0x44,0x24,0x0c,0xc7,0x40,0x04,...imm(0x402),0x31,0xc0,0xc2,0x0c,0);
    const hook=c.code(a);c.invoke('SetWindowsHookExA',[3,hook,0,c.e.get_current_thread_id()]);assert.notEqual(c.e.get_eax(),0);
    c.queue();const first=c.invoke(name,args(name),edge,1);
    assert.equal(c.e.get_eip()>>>0,hook); assert.equal(c.records().length,0,'hook entry is never return');
    const suspended=c.state();c.h.log_api_exit();assert.equal(c.records().length,0,'unrelated exit cannot finish bound token');
    c.e.run(100);const state=c.state(),records=c.records();assert.equal(state.eip,0);assert.equal(state.esp,c.stack+4);assert.equal(state.eax,1);assert.equal(state.msg[1],0x402);
    if(on){assert.equal(records.length,nested?2:1);const outer=records.at(-1);assert.equal(outer.api,name);assert.equal(outer.msg.message,0x402);assert.equal(outer.invocation,1);assert(c.calls.some(x=>x[0]==='message_bind'&&x[2]===2));assert(c.calls.some(x=>x[0]==='message_resume'&&x[1]===2));if(nested){assert.equal(records[0].api,'PeekMessageW');assert.equal(records[0].result,0);assert.notEqual(records[0].invocation,outer.invocation);}}
    else {assert.equal(records.length,0);assert.equal(c.calls.length,0);}
    return {name,edge,nested,on,first,suspended,state,records,calls:c.calls};
  }
  for(const name of names.slice(0,4))for(const edge of ['CALL','JMP'])for(const nested of [false,true]){
    const off=hookCase(name,edge,nested,false);global.gc();const on=hookCase(name,edge,nested,true);global.gc();assert.deepEqual(on.state,off.state);assert.deepEqual(on.suspended,off.suspended);result.cases.push({name,edge,nested,pass:true,off,on});checkpoint();
  }
 } else if (group === 'extra') {
  function keyboard(name,edge,chain,on){
    const c=context(on,false,true), imm=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
    const hook=c.code([0x31,0xc0,0xc2,0x0c,0]); c.invoke('SetWindowsHookExA',[2,hook,0,c.e.get_current_thread_id()]);assert.notEqual(c.e.get_eax(),0);
    if(chain){const get=c.code([0x8b,0x44,0x24,0x0c,0xc7,0x40,0x04,...imm(0x402),0x31,0xc0,0xc2,0x0c,0]);c.invoke('SetWindowsHookExA',[3,get,0,c.e.get_current_thread_id()]);assert.notEqual(c.e.get_eax(),0);}
    const first=c.invoke(name,args(name),edge,1);assert.equal(c.e.get_eip()>>>0,hook);assert.equal(c.records().length,0);c.e.run(100);
    const state=c.state(), records=c.records();assert.equal(state.eip,0);assert.equal(state.esp,c.stack+4);assert.equal(state.eax,1);assert.equal(state.msg[1],chain?0x402:0x100);
    if(on){assert.equal(records.length,1);assert.equal(records[0].api,name);assert.equal(records[0].msg.message,state.msg[1]);for(const kind of chain?[1,2]:[1]){assert(c.calls.some(x=>x[0]==='message_bind'&&x[2]===kind));assert(c.calls.some(x=>x[0]==='message_resume'&&x[1]===kind));}}
    else {assert.equal(records.length,0);assert.equal(c.calls.length,0);}
    return {first,state,records,calls:c.calls};
  }
  for(const name of names.slice(0,4))for(const edge of ['CALL','JMP'])for(const chain of [false,true]){
    const off=keyboard(name,edge,chain,false);global.gc();const on=keyboard(name,edge,chain,true);global.gc();assert.deepEqual(on.state,off.state);result.cases.push({name,edge,kind:'keyboard',chain,off,on,pass:true});checkpoint();
  }
  for(const name of names.slice(0,4)) {
    function scalar(on){const c=context(on),peek=name.startsWith('Peek');c.queue(peek?0x401:0x12);c.invoke(name,args(name,0));const state=c.state(),records=c.records();assert.equal(state.eax,peek?1:0);assert.equal(state.queue,peek?1:0);assert.equal(state.eip,0);if(on){assert.equal(records.length,1);assert.equal(records[0].result,state.eax);assert.equal(records[0].msg.message,peek?0x401:0x12);if(peek)assert.equal(records[0].pmRemove,false);}else assert.equal(c.calls.length,0);return {state,records,calls:c.calls};}
    const off=scalar(false);global.gc();const on=scalar(true);global.gc();assert.deepEqual(on.state,off.state);result.cases.push({name,kind:name.startsWith('Peek')?'no-remove':'WM_QUIT',off,on,pass:true});checkpoint();
  }
 } else if(group==='unrelated') {
  function unrelated(name,on){
    const c=context(on),imm=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
    const hook=c.code([0x31,0xc0,0xc2,0x0c,0]);c.invoke('SetWindowsHookExA',[3,hook,0,c.e.get_current_thread_id()]);assert.notEqual(c.e.get_eax(),0);
    c.queue();c.invoke(name,args(name),'CALL',1);assert.equal(c.e.get_eip()>>>0,hook);const suspended=c.state();assert.equal(c.records().length,0);
    const other=c.code([0x31,0xc0,0xc2,0x0c,0]);
    const entry=c.code([0x6a,0,0x6a,0,0x6a,0,0xb8,...imm(other),0xff,0xd0,0xc3]);
    // Controlled host scheduling of a DIFFERENT guest callback on a disjoint
    // stack. This is synthetic scheduling, not production runner scheduling.
    const sp=c.stack-0x400;c.rw(sp,0);c.e.set_esp(sp);c.e.set_eip(entry);c.e.run(100);const unrelatedState=c.state();assert.equal(unrelatedState.eip,0);assert.equal(c.records().length,0);
    c.e.set_esp(suspended.esp);c.e.set_eip(suspended.eip);c.e.set_eax(suspended.eax);c.e.run(100);const state=c.state(),records=c.records();assert.equal(state.eip,0);assert.equal(state.esp,c.stack+4);assert.equal(state.eax,1);
    if(on){assert.equal(records.length,1);assert.equal(records[0].api,name);assert.equal(records[0].invocation,1);}else assert.equal(c.calls.length,0);
    return {suspended,unrelatedState,state,records,calls:c.calls};
  }
  for(const name of names.slice(0,4)){const off=unrelated(name,false);global.gc();const on=unrelated(name,true);global.gc();assert.deepEqual(on.state,off.state);assert.deepEqual(on.unrelatedState,off.unrelatedState);result.cases.push({name,kind:'unrelated-decoded-callback-return',off,on,pass:true});checkpoint();}
 } else throw Error('unknown group '+group);
} catch(e) { result.incidents.push({message:e.message,stack:e.stack}); result.blocked=true; checkpoint(); process.exitCode=1; }
console.log(JSON.stringify({backend:result.backend,cases:result.cases.length,blocked:!!result.blocked,output}));
