#!/usr/bin/env node
'use strict';
// Offline WAT-form evaluator + REAL capture adapter. This does not compile or
// instantiate Wasm, emulate x86, or prove canonical/native execution.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const {createCapture,createSelectedSend,CaptureStop}=require(path.join(ROOT,'tools/shadow-man-null-capture.cjs'));
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
function parse(source) {
  const ts=source.replace(/;;[^\n]*/g,'').match(/"(?:\\.|[^"\\])*"|\(|\)|[^\s()]+/g)||[];
  let i=0;
  function form(){const t=ts[i++];if(t!== '('){assert.notEqual(t,')');return t;}const x=[];while(ts[i]!==')'){assert.ok(i<ts.length,'balanced source');x.push(form());}i++;return x;}
  const forms=[];while(i<ts.length)forms.push(form());return forms;
}
const sources=['src/13-exports.wat','src/05-alu.wat','src/09b-dispatch.wat'];
const trees=sources.map(p=>parse(read(p))),funcs=new Map();
for(const tree of trees)for(const f of tree)if(f[0]==='func')funcs.set(f[1],f);
function find(x,p){if(!Array.isArray(x))return null;if(p(x))return x;for(const a of x){const r=find(a,p);if(r)return r;}return null;}
const dispatch=funcs.get('$win32_dispatch_inner');
const caca=find(dispatch,x=>x[0]==='if'&&JSON.stringify(x[1])===JSON.stringify(['i32.eq',['local.get','$name_rva'],['i32.const','0xCACA0005']]));
assert.ok(caca,'actual dispatcher branch');
class Returned{constructor(value){this.value=value;}}
function machine(mutate=false){
  const g=new Map(),mem=new Map();let observer=()=>{};
  // Small maps, no native guest arena. Only primitives used by the selected
  // source forms are supported; unexpected instructions fail the test.
  for(const f of trees[0])if(f[0]==='global'&&String(f[1]).startsWith('$null_'))g.set(f[1],f.at(-1)[0]==='i64.const'?BigInt(f.at(-1)[1]):Number(f.at(-1)[1]));
  Object.entries({eip:0x7500218,reg_base:0x100,ip:0x1234,code16:0,sync_msg_depth:1,invocation_root:2n,token:13n,dlg_pump_hwnd:0x1001c,dlg_ret_addr:0x4015d4,dlg_ended:1,SHARED_DLG_PUMP_HWND:0x200,SHARED_DLG_ENDED:0x204,sync_msg_ret_thunk:0x7500218,dlg_loop_thunk:0x7500208,current_thunk_eip:0x7500218,sr_fast:0,sr_delta:0}).forEach(([k,v])=>g.set('$'+k,v));
  mem.set(0x110,0x74fff50);mem.set(0x200,0x1001c);mem.set(0x204,1);mem.set(0x74fff50,0);
  const stub={
    $invocation_current:()=>g.get('$token'),$gl32:a=>{assert.ok(mem.has(a),'modeled guest read');return mem.get(a);},
    $cs_pop:()=>{},$branch_end:()=>{},$host_log_eip:x=>observer(x),
    '$read-thread-word':()=>12,$stack_run_pop:()=>0,
    $host_log_i32:()=>{throw Error('unexpected native log');}
  };
  function ev(x,locals){
    if(!Array.isArray(x))return x;
    const [op,...a]=x,V=y=>ev(y,locals),args=()=>a.map(V);
    if(op==='i32.const')return Number(a[0])>>>0;
    if(op==='i64.const')return BigInt(a[0]);
    if(op==='global.get'){assert.ok(g.has(a[0]),'known global '+a[0]);return g.get(a[0]);}
    if(op==='global.set'){g.set(a[0],V(a[1]));return;}
    if(op==='local.get'){assert.ok(locals.has(a[0]),'known local '+a[0]);return locals.get(a[0]);}
    if(op==='local.set'){locals.set(a[0],V(a[1]));return;}
    if(op==='i32.load'){const off=typeof a[0]==='string'?Number(a.shift().split('=')[1]):0;return mem.get((V(a[0])+off)>>>0)||0;}
    if(op==='i32.store'){const off=typeof a[0]==='string'?Number(a.shift().split('=')[1]):0;mem.set((V(a[0])+off)>>>0,V(a[1]));return;}
    if(op==='if'){
      const nodes=a.filter(x=>Array.isArray(x)&&x[0]!=='result'),condition=V(nodes[0]);
      const branch=nodes.find(x=>x[0]===(condition?'then':'else'));let v;
      if(branch)for(const stmt of branch.slice(1))v=V(stmt);return v;
    }
    if(op==='return')throw new Returned(a.length?V(a[0]):undefined);
    if(op==='unreachable')throw Error('unreachable');
    if(op==='call'||op==='return_call'){
      const value=call(a[0],a.slice(1).map(V));if(op==='return_call')throw new Returned(value);return value;
    }
    if(op==='read-thread-word')return stub['$read-thread-word']();
    const vs=args(),[l,r]=vs;
    if(op==='i32.add')return (l+r)>>>0;
    if(op==='i32.sub')return (l-r)>>>0;
    if(op==='i32.and')return (l&r)>>>0;
    if(op==='i32.eqz')return Number(l===0);
    if(op==='i32.eq'||op==='i64.eq')return Number(l===r);
    if(op==='i32.ne'||op==='i64.ne')return Number(l!==r);
    if(op==='i32.gt_u')return Number((l>>>0)>(r>>>0));
    throw Error('unsupported source form '+op);
  }
  function call(name,args=[]){
    if(stub[name])return stub[name](...args);
    let f=funcs.get(name);assert.ok(f,'known function '+name);
    if(mutate&&name==='$th_ret')f=parse(read('src/05-alu.wat').replace('(call $null_transfer_record (i32.const 2)','(call $null_transfer_record (i32.const 3)')).find(x=>x[0]==='func'&&x[1]===name);
    const locals=new Map();let n=0;
    for(const x of f.slice(2))if(x[0]==='param')locals.set(x[1],args[n++]);else if(x[0]==='local')locals.set(x[1],0);
    try{let v;for(const x of f.slice(2))if(!['param','local','result','export'].includes(x[0]))v=ev(x,locals);return v;}catch(e){if(e instanceof Returned)return e.value;throw e;}
  }
  const fieldName=trees[0].find(f=>f[0]==='func'&&Array.isArray(f[1])&&f[1][0]==='export'&&f[1][1]==='"null_diag_field"')[1];
  const setName=trees[0].find(f=>f[0]==='func'&&Array.isArray(f[1])&&f[1][0]==='export'&&f[1][1]==='"set_null_diag"')[1];
  const exports={null_diag_field:i=>call(fieldName,[i]),set_null_diag:on=>call(setName,[on]),null_diag_token:()=>g.get('$token'),null_diag_root:()=>g.get('$invocation_root'),guest_read8:()=>0,set_trace_eip_range:()=>{},set_bp:()=>{}};
  for(const n of ['eax','ecx','edx','ebx','esp','ebp','esi','edi','eip'])exports['get_'+n]=()=>n==='eip'?g.get('$eip'):n==='esp'?mem.get(0x110):0;
  return {g,mem,exports,call,ev,observe:fn=>{observer=fn;},caca:()=>ev(caca,new Map([['$name_rva',0xcaca0005]]))};
}
function arm(m,opts={}){
  const records=[],stops=[];
  const capture=createCapture({untilZero:true,zeroTransferProvenance:true,metadata:{pid:123,instance:'single-bound-instance'},retain:r=>records.push(r),stop:r=>stops.push(r),...opts});
  m.observe(x=>capture.log(x));capture.arm(m.exports,{actionSequence:3,batch:24720,cmdId:3,hwnd:0x1001c});
  return {capture,records,stops};
}
function zero(m){m.call('$null_transfer_check');assert.throws(()=>m.call('$null_diag_event',[5,0,0]),CaptureStop);}
function native(m){m.g.set('$null_transfer_thunk_entry',1);try{m.caca();}catch(e){if(!(e instanceof Returned))throw e;}}
const samples={};
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
function retCase(site,kind,imm=0,mutate=false,fast=false){
  const m=machine(mutate),a=arm(m);m.g.set('$eip',0x4015d4);
  const pre=m.mem.get(0x110);if(fast){m.g.set('$sr_fast',1);m.g.set('$sr_delta',0x1000);m.mem.set(pre+0x1000,0);}
  m.call(site,[imm]);zero(m);
  const r=a.records.at(-1).record,t=r.zeroTransfer;
  assert.equal(t.kind,'guest-ret-zero');assert.equal(t.site,kind);
  assert.equal(t.retAddress,pre);assert.equal(t.retWord,0);assert.equal(t.preEip,0x4015d4);
  assert.equal(t.postEsp,pre+4+imm);assert.equal(t.token,'13');assert.equal(t.root,'2');
  assert.equal(r.kind,'first-zero');assert.equal(r.continuation,'forbidden');assert.equal(a.stops.length,1);
  assert.ok(Object.isFrozen(t));assert.equal(JSON.parse(JSON.stringify(a.records.at(-1))).record.zeroTransfer.site,kind);
  const envelope=a.records.at(-1),serialized=JSON.stringify(envelope);
  assert.equal(envelope.sha256,require('node:crypto').createHash('sha256').update(JSON.stringify(r)).digest('hex'));
  m.g.set('$null_transfer_kind',0);m.g.set('$eip',0x999999);m.mem.set(pre,0xdeadbeef);
  assert.equal(JSON.stringify(envelope),serialized,'retained record must not alias live native state');
  return r;
}
test('actual th_ret emission + immutable sealed serialization',()=>{samples.ret=retCase('$th_ret','th_ret');});
test('RET imm16 emission preserves ESP adjustment',()=>retCase('$th_ret_imm','th_ret_imm',12));
test('fused POP/RET emission, slow and fast read forms',()=>{retCase('$th_pop_run_ret','th_pop_run_ret',12);retCase('$th_pop_run_ret','th_pop_run_ret',12,false,true);});
test('actual CACA0005 branch emission preserves pending outer modal',()=>{
  const m=machine(),a=arm(m);m.call('$null_diag_event',[1,0x7500218,0x74fff50]);native(m);zero(m);const r=a.records.at(-1).record,t=r.zeroTransfer;
  assert.equal(t.kind,'native-caca0005');assert.equal(t.thunkMarker,0xcaca0005);assert.equal(t.thunkAddress,t.syncReturnThunk);
  assert.equal(t.preEsp,t.postEsp);assert.equal(t.pumpHwnd,0x1001c);assert.equal(t.returnAddress,0x4015d4);assert.equal(t.ended,1);
  assert.equal(t.sharedEnded,1);assert.equal(t.eventCountBeforeZero,1);assert.equal(r.boundary.eventCount,2);assert.equal(r.sequence,1);samples.caca=a.records;
});
test('inactive native record leaves emulated EIP/ESP and observer unchanged',()=>{
  const m=machine();let logs=0;m.observe(()=>logs++);m.call('$th_ret',[0]);assert.equal(m.g.get('$eip'),0);assert.equal(m.mem.get(0x110),0x74fff54);assert.equal(m.exports.null_diag_field(10),0);assert.equal(logs,0);
});
test('instrumented and inactive handler forms preserve modeled EIP/ESP',()=>{
  for(const site of ['$th_ret','$th_ret_imm','$th_pop_run_ret','caca'])for(const target of [0,0x401000]){
    const states=[];for(const mode of [0,2]){const m=machine();m.exports.set_null_diag(mode);m.mem.set(0x74fff50,target);if(site==='caca')native(m);else m.call(site,[12]);states.push([m.g.get('$eip'),m.mem.get(0x110)]);}assert.deepEqual(states[0],states[1]);
  }
});
test('actual CACA marker with unexpected thunk binding remains explicit evidence',()=>{
  const m=machine(),a=arm(m);m.g.set('$sync_msg_ret_thunk',0x7500998);native(m);zero(m);
  const t=a.records.at(-1).record.zeroTransfer;assert.equal(t.kind,'native-caca0005');assert.equal(t.syncReturnThunkMatches,false);
});
test('nested or inline dispatcher with wrong pre-EIP reports unknown',()=>{
  const m=machine(),a=arm(m);m.g.set('$eip',0x401000);native(m);zero(m);assert.equal(a.records.at(-1).record.zeroTransfer.kind,'unknown');
});
test('default adapter keeps legacy diagnostic mode and shape',()=>{
  const m=machine(),a=arm(m,{zeroTransferProvenance:false});native(m);zero(m);
  assert.equal(m.g.get('$null_transfer_on'),0);assert.equal('zeroTransfer' in a.records.at(-1).record,false);
});
test('no record and inline thunk assignment serialize unknown',()=>{
  for(const inline of [false,true]){const m=machine(),a=arm(m);if(inline){try{m.caca();}catch(e){if(!(e instanceof Returned))throw e;}}else m.g.set('$eip',0);zero(m);assert.equal(a.records.at(-1).record.zeroTransfer.kind,'unknown');if(!inline)samples.unknown=a.records;}
});
test('nonzero RET cannot donate provenance',()=>{
  const m=machine(),a=arm(m);m.mem.set(0x74fff50,0x401000);m.call('$th_ret',[0]);m.g.set('$eip',0);zero(m);assert.equal(a.records.at(-1).record.zeroTransfer.kind,'unknown');
});
test('native token/root/depth/count/ESP changes invalidate stale record',()=>{
  for(const key of ['$token','$invocation_root','$sync_msg_depth','$null_diag_count','esp']){
    const m=machine(),a=arm(m);native(m);if(key==='esp')m.mem.set(0x110,m.mem.get(0x110)+4);else m.g.set(key,m.g.get(key)+(typeof m.g.get(key)==='bigint'?1n:1));zero(m);assert.equal(a.records.at(-1).record.zeroTransfer.kind,'unknown',key);
  }
});
test('real run entry and nonzero loop clear previous attribution',()=>{
  const run=funcs.get('$run');
  const entry=run.findIndex(x=>x[0]==='global.set'&&x[1]==='$null_transfer_kind');
  assert.ok(entry>=0);assert.equal(run[entry][2][1],'0');
  const loop=find(run,x=>x[0]==='loop'&&x[1]==='$main');
  assert.equal(loop[2][0],'if');assert.equal(loop[3][1],'$null_transfer_kind');
  for(const clear of [run[entry],loop[3]]){const m=machine(),a=arm(m);native(m);m.ev(clear,new Map());zero(m);assert.equal(a.records.at(-1).record.zeroTransfer.kind,'unknown');}
});
test('deferred unload source invalidates preceding handler assignment',()=>{
  const wrapper=funcs.get('$win32_dispatch'),drain=find(wrapper,x=>x[0]==='if'&&JSON.stringify(x[1]).includes('$dll_drain_pending'));
  const clear=drain[2][1];assert.equal(clear[0],'global.set');assert.equal(clear[1],'$null_transfer_kind');
  const m=machine(),a=arm(m);native(m);m.ev(clear,new Map());zero(m);assert.equal(a.records.at(-1).record.zeroTransfer.kind,'unknown');
});
test('preload opt-in rejects invalid values and historical mode offline',()=>{
  const vm=require('node:vm'),source=read('tools/shadow-man-null-preload.cjs');
  const code=source.slice(source.indexOf('const zeroTransferFlag='),source.indexOf("if(process.env.SHADOW_NULL_UNTIL_ZERO"));
  for(const value of ['0','true','2'])assert.throws(()=>vm.runInNewContext(code,{process:{env:{SHADOW_NULL_ZERO_TRANSFER:value}},untilZero:true}),/invalid SHADOW_NULL_ZERO_TRANSFER/);
  assert.throws(()=>vm.runInNewContext(code,{process:{env:{SHADOW_NULL_ZERO_TRANSFER:'1'}},untilZero:false}),/requires revised-first-zero/);
  for(const value of [undefined,'1'])vm.runInNewContext(code,{process:{env:{SHADOW_NULL_ZERO_TRANSFER:value}},untilZero:true});
});
test('new instance and rearm cannot inherit a writer',()=>{
  const prior=machine();arm(prior);native(prior);
  const m=machine(),a=arm(m);m.g.set('$eip',0);zero(m);assert.equal(a.records.at(-1).record.zeroTransfer.kind,'unknown');
  const n=machine();arm(n);native(n);n.exports.set_null_diag(2);assert.equal(n.exports.null_diag_field(10),0);
});
test('actual selected-send rejects wrong action, instance, PID and late action',()=>{
  const m=machine(),instance={exports:m.exports},runner='/exact/test/run.js',selection={mode:'selected-action',actionSequence:3,cmdId:3};
  const base={instance,pid:123,runner,action:'dlg-cmd',actionSequence:3,batch:24720,cmdId:3,hwnd:0x1001c,resolution:'modal'};
  for(const bad of [{instance:{}},{pid:124},{action:'post-cmd'},{actionSequence:4},{cmdId:1}]){
    let armed=0,sent=0;const hook=createSelectedSend({instance,runner,pid:123,selection,capture:{arm(){armed++;},run(fn){return fn();}}});
    assert.throws(()=>hook({...base,...bad},()=>sent++));assert.equal(armed,0);assert.equal(sent,0);
  }
});
test('pre-arm receipt retained before mode2 and exact selected send',()=>{
  const m=machine(),instance={exports:m.exports},records=[],runner='/exact/test/run.js';let sent=false;
  const capture=createCapture({untilZero:true,zeroTransferProvenance:true,metadata:{pid:123},retain:r=>{if(r.receipt)assert.equal(m.g.get('$null_transfer_on'),0);records.push(r);},stop:()=>{}});
  m.observe(x=>capture.log(x));const hook=createSelectedSend({instance,capture,selection:{mode:'selected-action',actionSequence:3,cmdId:3},runner,pid:123});
  const context={instance,pid:123,runner,action:'dlg-cmd',actionSequence:3,batch:24720,cmdId:3,hwnd:0x1001c,resolution:'modal'};
  assert.throws(()=>hook(context,()=>{sent=true;assert.equal(m.g.get('$null_transfer_on'),1);native(m);zero(m);}),CaptureStop);
  assert.ok(sent);assert.equal(records[0].receipt.selection.actionSequence,3);assert.equal(records[1].record.zeroTransfer.kind,'native-caca0005');assert.throws(()=>hook(context,()=>{}),/duplicate/);
});
test('first-zero remains retained and rejecting before required block',()=>{
  const m=machine(),a=arm(m,{requireBlock:true});native(m);zero(m);assert.equal(a.records.at(-1).record.kind,'first-zero');assert.match(a.stops[0],/first-zero before required block/);
});
test('unsupported schema and corrupt writer are fail closed',()=>{
  const m=machine();m.exports.null_diag_field=()=>0xffffffff;assert.throws(()=>arm(m),/unsupported/);
  const n=machine(),a=arm(n);native(n);n.g.set('$null_transfer_marker',0xcaca0004);zero(n);assert.match(a.stops[0],/invalid CACA0005 provenance/);assert.equal(a.records.length,1);
});
test('serialization independently rejects stale count and ESP exports',()=>{
  for(const [field,value] of [[20,7],[14,0x74fff54]]){const m=machine(),a=arm(m);native(m);const original=m.exports.null_diag_field;m.exports.null_diag_field=i=>i===field?value:original(i);zero(m);assert.match(a.stops[0],/stale zero-transfer record/);assert.equal(a.records.length,1);}
});
test('no-record serialization does not read stale payload fields',()=>{
  const m=machine(),a=arm(m);const original=m.exports.null_diag_field;m.exports.null_diag_field=i=>{assert.ok(i<=10,'unknown must not expose stale payload');return original(i);};m.g.set('$eip',0);zero(m);assert.equal(a.records.at(-1).record.zeroTransfer.kind,'unknown');
});
test('returning observer still traps at the original zero event',()=>{
  const m=machine();m.exports.set_null_diag(2);native(m);m.observe(()=>{});assert.throws(()=>m.call('$null_diag_event',[5,0,0]),/unreachable/);
});
test('rejecting source mutation changes emitted RET site and is detected',()=>{
  assert.throws(()=>retCase('$th_ret','th_ret',0,true),/th_ret_imm/);
});
fs.writeFileSync(path.join(__dirname,'offline-evaluated-records.json'),JSON.stringify({scope:'offline WAT-form evaluation + actual JS adapter; NO native/Wasm execution',samples},null,2)+'\n');
console.log(JSON.stringify({scope:'offline WAT-form evaluation + actual JS adapter; NO native/Wasm execution',passed}));
