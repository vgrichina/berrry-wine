'use strict';
// Small generated Wasm only: production observer/transfer handlers, fixture decoder,
// pinned _errno bytes, controlled native _getptd callee. Never a canonical/game run.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {createHash} = require('node:crypto');
const {func, parse} = require('./maelstrom-select-hook-model.cjs');
const current = require('../tools/maelstrom-native-errno-latch.cjs');
const {createAdapter} = require('../tools/maelstrom-original-errno-adapter.cjs');
const {compile} = require(process.env.MNE_WATX || '/home/user/wine-assembly/tools/watx.js');
const raw = require('./fixtures/maelstrom-uop-completion-oct26.json');
let hook = current;
if (process.argv.includes('--baseline')) {
  const Module = require('node:module'), name = path.resolve(__dirname, '../tools/baseline-fixture.cjs');
  const m = new Module(name, module); m.filename = name; m.paths = module.paths;
  m._compile(fs.readFileSync(path.join(process.env.MNE_OPS,'baseline-latch.cjs'),'utf8'), name); hook = m.exports;
}
const sha = b => createHash('sha256').update(b).digest('hex');
const sources = Object.fromEntries(Object.keys({...current.PINS,...current.UOP_PINS}).map(p => [p, fs.readFileSync(path.join(process.env.MNE_SOURCE_ROOT,p),'utf8')]));
const binaries = {net:fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT,'SDL_net.dll')),
 exe:fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT,'Maelstrom.exe')),crt:fs.readFileSync(process.env.MNE_CRT)};
const base=0x522000, entry=base+0xc430, tail=base+0xc435, retPC=base+0xc438;
const options={enabled:true,binaries,crtLoadedBase:base,uopNativeBoundaries:true};
const out={...sources,...hook.transform(sources,options)}, anchor=hook.verifyBinaries(binaries);
const serialize = n => Array.isArray(n) ? '('+n.map(serialize).join(' ')+')' : n;
const extracted = (p,n,ex) => { const ast=func(out[p],n); if(ex)ast.splice(2,0,['export',JSON.stringify(ex)]);return serialize(ast); };
let text=out['src/09d-winsock.wat'].split(';; Opt-in exact select diagnostic storage.')[1];
assert(text && text.includes(';; Opt-in native errno successor latch.'));
text=text.replace('(region.end $DIRECT_WINDOW)','(i32.const 0x8000000)');
// All fixture globals are exported solely for deterministic scalar/state controls.
const globals={reg_base:1000,current_thread_id:1,current_thunk_eip:1232,yield_reason:0,eip:0,code16:0,
 block_exec_enabled:0,uop_enabled:1,image_base:0x400000,GUEST_BASE:0x12000,steps:9,thunk_guest_base:0,
 word:7,branches:0,flushes:0,gateRefreshes:0,uop_io_kind:0,uop_io_budget:0,saved_cf:0,uop_bexit:0,uop_div_exits:0,uop_icg_pass1:0,uop_icg_pass0:0,df:0,uop_xwork:0,fpu_tag:0,uop_io_ga:0,uop_io_w:0,flag_op:0,flag_a:0,flag_b:0,flag_res:0,flag_sign_shift:31};
const declarations=Object.entries(globals).map(([n,v])=>`(global $${n} (mut i32) (i32.const ${v}))`).join('\n');
const support=`(memory 64 64) (export "memory" (memory 0))
(defmacro (read-thread-word) (global.get $word))
(defmacro (thunk-contains x) (i32.const 0))
(defmacro (dispatch-next) (return))
(func $wa (param $a i32) (result i32) (i32.add (i32.sub (local.get $a) (global.get $image_base)) (global.get $GUEST_BASE)))
(func $gl32 (param $a i32) (result i32) (i32.load (call $wa (local.get $a))))
(func $gs32 (param $a i32) (param $v i32) (i32.store (call $wa (local.get $a)) (local.get $v)))
(func $th_ret_guard16 (if (global.get $code16) (then (unreachable))))
(func $win32_dispatch (param $n i32) (unreachable))
(func $cs_push (param $a i32)) (func $cs_pop)
(func $uop_flush (global.set $flushes (i32.add (global.get $flushes) (i32.const 1))))
(func $bx_hot_gate_refresh (global.set $gateRefreshes (i32.add (global.get $gateRefreshes) (i32.const 1))))
(func $branch_end (global.set $branches (i32.add (global.get $branches) (i32.const 1))))`;
let handlers=['th_call_rel','th_add_r_i32','th_mov_r_i32','th_mov_r_r','th_ret'].map(n=>extracted('src/05-alu.wat',n,n)).join('\n')+
 '\n'+extracted('src/06b-core-handlers.wat','th_call_r','th_call_r')+'\n'+extracted('src/03-registers.wat','set_flags_add')+'\n'+extracted('src/07d-uop-engine.wat','uop_fast','uop_fast');
const engine=out['src/07d-uop-engine.wat'];
handlers += '\n'+serialize(parse(engine.slice(engine.indexOf('(func (export "set_uop")')))[0]);
text += '\n'+['mne_complete','mne_call','mne_return','mne_wa','msc_end'].map(n=>`(func (export "fixture_${n}") ${
 n==='mne_call'?'(param $a i32) (param $b i32) (param $c i32) (call $mne_call (local.get $a) (local.get $b) (local.get $c))':
 n==='mne_return'?'(param $a i32) (call $mne_return (local.get $a))':
 n==='mne_wa'?'(param $a i32) (param $b i32) (result i32) (call $mne_wa (local.get $a) (local.get $b))':
 n==='msc_end'?'(param $a i32) (param $b i32) (call $msc_end (local.get $a) (local.get $b))':'(call $mne_complete)'})`).join('\n');
let wasmSource=[declarations,support,text,handlers].join('\n');
wasmSource += [...wasmSource.matchAll(/\(global (\$[\w]+) \(mut i32\)/g)].map(([,n])=>`\n(export "g${n}" (global ${n}))`).join('');
const result=compile(wasmSource,new Map(),{mode:'production'});assert(result.wasmBinary.length<65536);
const wasm=Buffer.from(result.wasmBinary), mod=new WebAssembly.Module(wasm);
fs.writeFileSync(path.join(process.env.MNE_OPS,process.argv.includes('--baseline')?'baseline-fixture.wasm':'uop-fixture.wasm'),wasm);
let groups=0;
function test(name,f){f();groups++;console.log('PASS UOP fixture: '+name);}
function fixture(start=true){
 const instance=new WebAssembly.Instance(mod,{}), e=instance.exports, dv=new DataView(e.memory.buffer);
 const get=n=>e['g$'+n].value>>>0,set=(n,v)=>e['g$'+n].value=v|0;
 const wa=a=>(a-0x400000+0x12000)>>>0,put=(a,v)=>dv.setUint32(wa(a),v>>>0,true),word=a=>dv.getUint32(wa(a),true);
 const reg=(n,v)=>v===undefined?dv.getUint32(get('reg_base')+n*4,true):dv.setUint32(get('reg_base')+n*4,v>>>0,true);
 const pre=0x400800,post=pre+24,errnoPtr=0x401008,caller=0x40e12a;
 reg(4,pre);reg(7,entry);
 if(start)e.mne_start();
 const scalar=()=>Object.fromEntries(current.FIELDS.map(k=>[k,e['mne_'+k]()>>>0]));
 function complete(){
  Object.entries({...raw.select,phase:1,active:1,completions:0,regs:get('reg_base'),thunk:get('current_thunk_eip'),pre,post:0}).forEach(([n,v])=>set('msc_'+n,v));
  reg(4,post);reg(0,0);set('eip',anchor.selectRet);e.fixture_msc_end(raw.select.token,3);
 }
 function native(error=4){
  const crt=hook.pe(binaries.crt), b=binaries.crt.subarray(crt.offset(0x7800c430,9),crt.offset(0x7800c430,9)+9);
  new Uint8Array(e.memory.buffer,wa(entry),b.length).set(b);
  // Only _getptd is a controlled fixture: native MOV EAX,ptd; RET.
  const getptd=(entry+5+b.readInt32LE(1))>>>0;
  const body=Buffer.alloc(6);body[0]=0xb8;body.writeUInt32LE(errnoPtr-8,1);body[5]=0xc3;
  new Uint8Array(e.memory.buffer,wa(getptd),6).set(body);
  const net=hook.pe(binaries.net),netAt=net.offset(0x10001362,8);
  new Uint8Array(e.memory.buffer,wa(anchor.selectRet),8).set(binaries.net.subarray(netAt,netAt+8));
  put(errnoPtr,error);put(post+0x124,caller);put(post+0x128,0x401100);put(post+0x12c,1000);
  const trace=[];
  for(let steps=0;steps<12;steps++){
   const pc=get('eip'), op=dv.getUint8(wa(pc));trace.push(pc);
   if(pc===anchor.successor){assert.equal(op,0x83);return trace;}// stop BEFORE CMP
   if(op===0x8b){assert.equal(dv.getUint8(wa(pc)+1),0xe8);
    // Actual production UOP MOV followed by EXIT at the diagnostic CALL.
    const program=[2,get('reg_base')+20,get('reg_base'),0,pc+2];
    program.forEach((v,i)=>dv.setUint32(4096+i*4,v,true));
    assert.equal(e.uop_fast(4096,17),4096+12);assert.equal(get('uop_io_budget'),17);
   }
   else if(op===0xff){assert.equal(dv.getUint8(wa(pc)+1),0xd7);set('word',7);e.th_call_r(pc+2);}
   else if(op===0xe8){set('word',(pc+5+dv.getInt32(wa(pc)+1,true))>>>0);e.th_call_rel(pc+5);}
   else if(op===0xb8){set('word',dv.getUint32(wa(pc)+1,true));e.th_mov_r_i32(0);set('eip',pc+5);}
   else if(op===0x83){assert.equal(dv.getUint8(wa(pc)+1),0xc0);set('word',dv.getInt8(wa(pc)+2));e.th_add_r_i32(0);set('eip',pc+3);}
   else if(op===0xc3)e.th_ret(0);
   else assert.fail('fixture unsupported opcode '+op.toString(16));
  }assert.fail('bounded instruction cap');
 }
 return {instance,e,get,set,reg,pre,post,errnoPtr,caller,wa,put,word,complete,native,scalar};
}
test('unchanged observed completion scalars fail baseline reason3 and pass repair',()=>{
 const f=fixture(false);Object.entries(raw.mode).forEach(([n,v])=>f.set(n,v));
 // Isolate completion from scheduler/start ordering: exact pre-callback native status.
 f.set('mne_status',raw.priorNativeStatus);if(f.e['g$mne_uopMode'])f.set('mne_uopMode',1);
 Object.entries(raw.select).forEach(([n,v])=>f.set('msc_'+n,v));
 f.set('reg_base',raw.select.regs);f.set('current_thread_id',raw.select.thread);
 f.e.fixture_mne_complete();console.log(JSON.stringify({batch:raw.batch,status:f.e.mne_status(),reason:f.e.mne_rejectReason(),modes:f.e.mne_rejectModes()}));
 if(f.e.mne_status()===5){assert.equal(f.e.mne_rejectReason(),raw.firstRejection.reason);assert.equal(f.e.mne_rejectModes(),raw.firstRejection.modeBits);assert.equal(f.e.mne_rejectObservedRet(),raw.firstRejection.observedReturn);}
 assert.equal(f.e.mne_status(),2,'observed UOP completion must be accepted');assert.equal(f.e.mne_event(),1);
 assert.equal(f.e.mne_errno(),0,'still uncaptured, not observed errno zero');
});
if(process.argv.includes('--baseline'))assert.fail('baseline unexpectedly passed');
test('pinned native _errno CALL/ADD/RET executes, stores actual pointer, stops before CMP',()=>{
 for(const errno of [0,4,10004,0xffffffff]){
  const on=fixture(),off=fixture(false);on.complete();off.complete();const traces=[];
  for(const f of [on,off]){traces.push(f.native(errno));assert.equal(f.reg(0),f.errnoPtr);assert.equal(f.reg(4),f.post);assert.equal(f.get('uop_enabled'),1);}
  assert.deepEqual(traces[0],traces[1]);assert.equal(on.e.mne_status(),4);assert.equal(on.e.mne_event(),3);
  assert.equal(on.e.mne_errno()>>>0,errno);assert.equal(on.e.mne_caller(),on.caller);
  assert.equal(on.e.mne_sourceBlock(),retPC);assert.equal(on.e.mne_pc(),anchor.successor);
  assert.equal(on.e.mne_esp(),on.post);assert.equal(on.e.mne_ebp(),0);assert.equal(on.e.mne_nativeEntry(),entry);
  assert.deepEqual(Buffer.from(on.e.memory.buffer),Buffer.from(off.e.memory.buffer));
  for(const n of Object.keys(globals))assert.equal(on.get(n),off.get(n),n);
 }
});
test('owner/token/stale/native-target/register/source/frame and mode switches reject',()=>{
 for(const key of ['current_thread_id','reg_base']){
  const f=fixture();f.complete();const v=f.get(key);f.set(key,v+4);f.e.fixture_mne_call(anchor.successor,entry,7);assert.equal(f.e.mne_status(),2);
  f.set(key,v);f.e.fixture_mne_call(anchor.successor,entry,7);assert.equal(f.e.mne_status(),3);
  f.set(key,v+4);f.e.fixture_mne_return(retPC);assert.equal(f.e.mne_status(),3);
 }
 for(const mutation of [f=>f.set('msc_token',8),f=>f.set('msc_active',1),f=>f.set('msc_regs',2000),f=>f.set('msc_fault',1),
  f=>f.set('uop_enabled',0),f=>f.set('block_exec_enabled',1),f=>f.set('code16',1),f=>f.reg(4,f.post+4),f=>f.reg(5,9)]){
  const f=fixture();f.complete();f.set('eip',anchor.selectRet+2);mutation(f);f.e.fixture_mne_call(anchor.successor,entry,7);assert.equal(f.e.mne_status(),5);
 }
 for(const args of [[anchor.successor+1,entry,7],[anchor.successor,entry+1,7],[anchor.successor,entry,6]]){
  const f=fixture();f.complete();f.e.fixture_mne_call(...args);assert.equal(f.e.mne_status(),5);
 }
 for(const source of [retPC+1,tail+1]){const f=fixture();f.complete();f.e.fixture_mne_call(anchor.successor,entry,7);f.set('eip',anchor.successor);f.e.fixture_mne_return(source);assert.equal(f.e.mne_status(),5);}
 for(const mode of [0,2]){const f=fixture();f.complete();f.e.fixture_mne_call(anchor.successor,entry,7);f.set('uop_enabled',mode);f.e.fixture_mne_return(retPC);assert.equal(f.e.mne_status(),5);}
 for(const mode of [0,2]){const f=fixture();f.set('uop_enabled',mode);f.complete();assert.equal(f.e.mne_status(),5);}
 for(const when of ['pending','complete','call']){const f=fixture();if(when!=='pending')f.complete();if(when==='call')f.e.fixture_mne_call(anchor.successor,entry,7);f.e.set_uop(0);f.e.set_uop(1);assert.equal(f.e.mne_status(),5);assert.equal(f.get('uop_enabled'),1);assert.equal(f.get('flushes'),1);assert.equal(f.get('gateRefreshes'),2);}
 const same=fixture();same.e.set_uop(2);assert.equal(same.e.mne_status(),1);assert.equal(same.get('uop_enabled'),1);
});
test('nested relative CALL/RET permitted below frame, nested register CALL and early closure reject',()=>{
 const f=fixture();f.complete();f.e.fixture_mne_call(anchor.successor,entry,7);f.reg(4,f.post-4);f.e.fixture_mne_return(retPC);assert.equal(f.e.mne_status(),3);
 f.e.fixture_mne_call(anchor.successor,entry,7);assert.equal(f.e.mne_status(),5);
 const early=fixture();early.complete();early.set('eip',anchor.successor);early.e.fixture_mne_return(retPC);assert.equal(early.e.mne_status(),5);
 const stale=fixture();stale.complete();stale.e.fixture_mne_call(anchor.successor,entry,7);stale.set('msc_token',8);stale.e.fixture_mne_return(retPC);assert.equal(stale.e.mne_status(),5);
});
test('actual select end rejects foreign/wrong-token/reentrant completions',()=>{
 for(const mutate of [f=>f.set('msc_token',8),f=>f.set('current_thread_id',2),f=>f.set('reg_base',2000),f=>f.set('msc_active',0)]){
  const f=fixture();Object.entries({token:7,thread:1,regs:1000,active:1,thunk:1232,pre:f.pre}).forEach(([n,v])=>f.set('msc_'+n,v));
  f.reg(4,f.post);mutate(f);f.e.fixture_msc_end(7,3);assert.equal(f.e.msc_fault(),1);assert.notEqual(f.e.mne_status(),4);
 }
 const f=fixture();f.complete();const before=f.scalar();f.e.fixture_mne_complete();assert.deepEqual(f.scalar(),before);
 assert.equal(f.e.msc_completions(),1);f.e.fixture_msc_end(raw.select.token,3);assert.equal(f.e.msc_fault(),1);assert.equal(f.e.msc_completions(),1);f.e.fixture_mne_call(anchor.successor,entry,7);assert.equal(f.e.mne_status(),5);
});
test('unsupported mode and inactive getter paths remain inert',()=>{
 for(const key of ['code16','block_exec_enabled','uop_enabled']){const f=fixture(false);f.set(key,key==='uop_enabled'?2:1);f.e.mne_start();assert.equal(f.e.mne_status(),5);}
 const poison=new Proxy({}, {get(){throw Error('unused');},ownKeys(){throw Error('unused');}});
 assert.equal(current.transform(poison,{enabled:false,get uopNativeBoundaries(){throw Error('unused');}}),poison);
 const f=fixture(false),before=f.scalar();f.e.fixture_mne_complete();f.e.fixture_mne_call(0,0,0);f.e.fixture_mne_return(0);assert.deepEqual(f.scalar(),before);
});
test('completion guard order, immutable terminal record and non-UOP route persist',()=>{
 for(const [key,value] of [['ret',0],['phase',2],['completions',2],['fault',1],['active',1],['capped',1]]){
  const f=fixture();f.complete();f.set('mne_status',1);f.set('mne_event',0);f.set('msc_'+key,value);f.e.fixture_mne_complete();assert.equal(f.e.mne_status(),5);assert.equal(f.e.mne_rejectReason(),3);assert.equal(f.e.mne_rejectModes(),4);
 }
 const f=fixture();f.complete();f.native();const record=f.scalar();f.e.set_uop(0);f.e.set_uop(1);f.e.mne_start();f.e.fixture_mne_complete();f.e.fixture_mne_call(0,0,0);f.e.fixture_mne_return(0);assert.deepEqual(f.scalar(),record);
 const off=fixture(false);off.e.set_uop(0);off.e.mne_start();assert.equal(off.e.mne_status(),1);off.complete();off.e.fixture_mne_call(anchor.successor,entry,7);off.reg(4,off.post);off.set('eip',anchor.successor);off.e.fixture_mne_return(retPC);assert.equal(off.e.mne_status(),5,'UOP-specific RET source forbidden in non-UOP mode');
 const changed=fixture(false);changed.e.set_uop(0);changed.e.mne_start();changed.e.set_uop(1);assert.equal(changed.e.mne_status(),5);
});
test('real terminal Wasm snapshot seals before throwing/reentrant host callbacks',()=>{
 const f=fixture(false),rows=[];let adapter,terminal=0;
 adapter=createAdapter(f.instance,{readLive(){if(f.e.mne_status()===4){terminal++;assert.equal(adapter.observe(4),null);}return {};},persist(row){rows.push(row);if(row.kind==='captured'){assert.equal(adapter.observe(5),null);throw sentinel;}}});
 const sentinel={identity:'callback'};adapter.start();f.complete();f.native(4);
 assert.throws(()=>adapter.observe(3),e=>e===sentinel);assert.equal(terminal,1);assert.equal(rows.filter(r=>r.kind==='captured').length,1);
 f.put(f.errnoPtr,0);assert.equal(adapter.observe(6),null);assert.equal(rows.at(-1).historicalNativeLatch.errno,4);
});
// Compile/execute just the actual decoder prefix and uc_unsup. The rest of the
// compiler is a later gate; the control path records a fallthrough sentinel.
test('generated compiler boundary executes exact unsup records before any guest decode',()=>{
 const ast=func(out['src/07e-uop-compiler.wat'],'uc_decode');
 const prefix=ast.slice(2,ast.findIndex(n=>Array.isArray(n)&&n[0]==='local.set'&&n[1]==='$O0'));
 const body=serialize(['func','$boundary',['export','"boundary"'],...prefix]);
 const tiny=compile('(memory 1 1) (export "memory" (memory 0))\n'+extracted('src/07e-uop-compiler.wat','uc_unsup')+'\n'+body,new Map(),{mode:'production'});
 const e=new WebAssembly.Instance(new WebAssembly.Module(tiny.wasmBinary),{}).exports,dv=new DataView(e.memory.buffer);
 for(const addr of [anchor.successor-2,retPC,anchor.selectRet,entry,retPC+1]){
  e.boundary(addr,100);assert.equal(dv.getUint32(100,true),addr);
  if(addr===anchor.successor-2||addr===retPC){assert.equal(dv.getUint32(108,true),0);assert.equal(dv.getUint32(152,true),1);assert.equal(dv.getUint32(104,true),addr+1);}
  else {assert.equal(dv.getUint32(152,true),0);assert.equal(dv.getUint32(104,true),0);}
 }
 assert.equal(current.transform(sources,{...options,uopNativeBoundaries:false})['src/07e-uop-compiler.wat'],undefined);
 assert.throws(()=>current.transform({...sources,'src/07e-uop-compiler.wat':sources['src/07e-uop-compiler.wat']+'\n'},options),/source pin/);
 const allowed=new Set(['src/07d-uop-engine.wat','src/09b-dispatch.wat','src/09d-winsock.wat','src/05-alu.wat','src/06b-core-handlers.wat','src/07e-uop-compiler.wat']);
 for(const p of Object.keys(sources))if(!allowed.has(p))assert.equal(out[p],sources[p]);
});
console.log(JSON.stringify({pass:true,groups,wasmSHA256:sha(wasm),wasmBytes:wasm.length,fixtureMemory:64*65536,
 qualification:'small compiled Wasm fixture; pinned _errno instructions + fixture _getptd; UOP-enabled threaded boundaries; full compiler/canonical/original UNPROVEN'}));
