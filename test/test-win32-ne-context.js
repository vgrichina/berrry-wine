'use strict';
// Compile actual invocation/selector/arena/Win16-call32 helpers, never the full
// emulator. Process backing and code-cache invalidation are controlled inputs.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { compileClosure } = require('../tools/watx-closure');
const dir = path.join(__dirname, '../src');
const all = fs.readdirSync(dir).filter(n => n.endsWith('.wat')).map(n => fs.readFileSync(path.join(dir,n),'utf8')).join('\n');
function form(name) {
  const start = all.search(new RegExp('\\(func \\$'+name+'(?=\\s)')); assert(start >= 0, name);
  let depth=0, quoted=false, comment=false;
  for(let i=start;i<all.length;i++) {
    const c=all[i]; if(comment){if(c==='\n')comment=false;continue;}
    if(quoted){if(c==='\\')i++;else if(c==='"')quoted=false;continue;}
    if(c===';'&&all[i+1]===';'){comment=true;continue;} if(c==='"'){quoted=true;continue;}
    if(c==='(')depth++; if(c===')'&&!--depth)return all.slice(start,i+1);
  } throw Error(name);
}
const api = fs.readFileSync(path.join(dir,'09e-win16-api.wat'),'utf8');
const block = api.slice(api.indexOf(';; BEGIN WIN32 NE INVOCATION CONTEXT'),api.indexOf(';; END WIN32 NE INVOCATION CONTEXT'));
const helpers = ['win16_arena_base','win16_task_shared','win16_next_seg_get','win16_next_seg_set',
  'win16_arena_take','win16_arena_give','win16_arena_free_head','win16_alloc_segment','win16_arena_slot_base',
  'win16_gseg_field','win16_gseg_store','win16_gseg_count','win16_seg_set','win16_seg_base','win16_seg_limit',
  'win16_sel_to_index','win16_index_to_sel','win16_seg_is_big','win16_set_sreg','esp_arch',
  'win16_call32_begin','win16_call32_arg','win16_call32_end','win16_call32_waited',
  'lock_owner_id','lock_acquire','lock_release','zero_memory','win16_process_arena_release',
  'sync_depth_enter','sync_depth_leave','thread_spill_can_recycle','win16_push16','th_retf16'];
let code=block+'\n'+helpers.map(form).join('\n');
code=code.replaceAll('(region.addr $WIN16_PROCESS_ARENA 0)','(i32.const 4096)')
 .replaceAll('(region.addr $WIN16_PROCESS_ARENA 4)','(i32.const 4100)');
const fixture={WIN16_SEG_TABLE:0x20000,WIN16_SEG_TABLE_SIZE:0x20000,WIN16_THUNK_TABLE:0x50000,
 reg_base:0x60000,fpu_base:0x61000,mmx_base:0x62000,xmm_base:0x63000,GUEST_STACK:0x80000,GUEST_STACK_SIZE:65536,
 DLL_LOAD_LOCK:0x1100,current_thread_id:1};
const globalNames=[...new Set([...code.matchAll(/\(global\.(?:get|set) \$([^\s)]+)/g)].map(m=>m[1]))];
const declared=new Set([...code.matchAll(/\(global \$([^\s)]+)/g)].map(m=>m[1]));
const mutable=[];
const globals=globalNames.filter(n=>!declared.has(n)).map(n=>{
 const def=all.match(new RegExp('\\(global \\$'+n+'\\s+(?:\\(mut (i32|i64)\\)|(i32|i64))\\s+\\(([^\\n]+)'));assert(def,n);
 const type=def[1]||def[2],mut=!!def[1];if(mut)mutable.push(n);
 const constant=def[3].match(/^(?:i32|i64)\.const\s+(0x[0-9a-f]+|-?\d+)/i);
 const value=fixture[n]??(constant?Number(constant[1]):0);
 return `(global $${n} ${mut?'(mut '+type+')':type} (${type}.const ${value}))`;
}).join('\n');
const saved=[...block.matchAll(/\(i32.store offset=\d+ \(local.get \$frame\) \(global.get \$([^\s)]+)\)\)/g)].map(m=>m[1]).filter(n=>n!=='sync_msg_depth');
for(const n of 'resume_ip eip_redirected current_thunk_eip d_seg d_addr16 ea_temp eip ip steps code16 cs_big sreg_es sreg_cs sreg_ss sreg_ds sreg_fs16 sreg_gs seg_base_es seg_base_cs seg_base_ss seg_base_ds fs_base gs_base df flag_op flag_a flag_b flag_res saved_cf flag_sign_shift eflags_extra yield_flag yield_reason last_error win16_in_call32 win16_esp_save win16_eip_save fpu_top fpu_cw fpu_sw fpu_tag fpu_raw_tag'.split(' '))assert(saved.includes(n),n);
const probes=mutable.map(n=>`(func (export "set_${n}") (param $v i32) (global.set $${n} (local.get $v)))
(func (export "get_${n}") (result i32) (global.get $${n}))`).join('\n');
const exportedHelpers=helpers.filter(n=>!form(n).includes('(export ')).map(n=>`(export "${n}" (func $${n}))`).join('\n');
const source=`
(import "host" "memory" (memory 1024 1024 shared))
(import "host" "ensure" (func $win16_process_arena_ensure (result i32)))
(import "host" "release" (func $virtual_map_release (param i32) (result i32)))
(import "host" "g2w" (func $g2w (param i32) (result i32)))
(import "host" "write" (func $gs32 (param i32 i32)))
(func $host_log_i32 (param i32) (nop))
(func $dbg_recompute (nop))
(func $cs_pop (nop))
(func $gs16 (param $p i32) (param $v i32) (i32.store16 (call $g2w (local.get $p)) (local.get $v)))
(func $gl16 (param $p i32) (result i32) (i32.load16_u (call $g2w (local.get $p))))
(func $win16_dispatch (param $off i32) (param $ret i32)
  (if (i32.ne (local.get $off) (global.get $WIN16_BRIDGE_RETURN)) (then (unreachable)))
  (call $win16_bridge_invoke_return (local.get $ret)))
(func $page_watch_write (param i32 i32) (nop))
(func $process_code_cache_invalidate (param i32 i32) (nop))
${globals}\n${code}\n${probes}\n${exportedHelpers}`;
const compiled=compileClosure({source,vfs:new Map()},{tailCalls:true});assert(compiled.success,compiled.error);
const moduleUnderTest=new WebAssembly.Module(compiled.wasmBinary),memory=new WebAssembly.Memory({initial:1024,maximum:1024,shared:true});
const bytes=new Uint8Array(memory.buffer),view=new DataView(memory.buffer);
const BASE=0x30000000,BACKING=0x100000,shared=BACKING+943*65536+0xf000;
let initialized=false,ensureCalls=0,failEnsure=false,releaseBetween=false;
const translate=guest=>{if(guest>=BASE){assert(initialized,'access to released arena');return BACKING+guest-BASE;}return guest;};
function instance(id) {
 const e=new WebAssembly.Instance(moduleUnderTest,{host:{memory,
 ensure(){ensureCalls++;if(failEnsure)return 0;if(!initialized){bytes.fill(0,BACKING,BACKING+944*65536);view.setUint32(4096,BASE,true);initialized=true;}if(releaseBetween){releaseBetween=false;assert.equal(second.win16_process_arena_release(),1);}return BASE;},
 release(){initialized=false;return 1;},g2w:translate,
 write(guest,value){view.setUint32(translate(guest),value,true);},
 }}).exports;
 e.set_current_thread_id(id);const delta=(id-1)*0x100;
 for(const n of ['reg_base','fpu_base','mmx_base','xmm_base'])e['set_'+n](fixture[n]+delta);
 return e;
}
const first=instance(1),second=instance(2);
const cpu=(e)=>({globals:Object.fromEntries(saved.map(n=>[n,e['get_'+n]()])),files:Object.fromEntries(['reg','fpu','mmx','xmm'].map(n=>{const p=e['get_'+n+'_base']();return[n,Buffer.from(bytes.slice(p,p+(n==='reg'?32:128)))];}))});
function seed(e,value){
 for(let i=0;i<saved.length;i++)e['set_'+saved[i]]((value+i*0x10203)|0);
 e.set_code16(0);e.set_is_win16(0);
 for(const n of ['reg','fpu','mmx','xmm']){const p=e['get_'+n+'_base']();bytes.fill(value&255,p,p+(n==='reg'?32:128));}
 view.setUint32(e.get_reg_base()+16,0x7ff00,true);
}
seed(first,0x12345678);const original=cpu(first);
bytes.fill(0x5b,fixture.GUEST_STACK,fixture.GUEST_STACK+fixture.GUEST_STACK_SIZE);
const outer=first.win16_bridge_frame_begin();assert(outer);assert.deepEqual(cpu(first),original);
assert.equal(view.getUint32(shared+36,true),1);assert.equal(first.win16_process_arena_release(),0,'live frame pins process arena');
assert.equal(second.win16_bridge_frame_end(outer),0,'foreign instance cannot restore caller');
assert.equal(first.win16_bridge_stack_enter(outer),1);
assert.equal(first.get_code16(),1);assert.equal(first.get_is_win16(),0);
const privateSp=view.getUint32(first.get_reg_base()+16,true);
first.win16_call32_begin(6);const scratchSp=view.getUint32(first.get_reg_base()+16,true);
assert(scratchSp>privateSp&&scratchSp<privateSp+65536);first.win16_call32_arg(5,0xabcdef01);
assert.equal(view.getUint32(translate(scratchSp)+24,true),0xabcdef01);
assert(bytes.subarray(fixture.GUEST_STACK,fixture.GUEST_STACK+fixture.GUEST_STACK_SIZE).every(v=>v===0x5b),'PE stack canary');
const suspended=cpu(first),inner=first.win16_bridge_frame_begin();assert(inner&&inner!==outer);
assert.equal(first.win16_bridge_frame_end(outer),0,'out-of-order completion rejected');
assert.equal(first.win16_bridge_stack_enter(inner),1);assert.equal(first.get_win16_in_call32(),0,'nested NE begins outside suspended call32');first.win16_call32_begin(2);
assert.notEqual(view.getUint32(first.get_reg_base()+16,true),scratchSp);
seed(first,0x43218765);assert.equal(first.win16_bridge_frame_end(inner),1);assert.deepEqual(cpu(first),suspended);
first.win16_call32_end();assert.equal(view.getUint32(first.get_reg_base()+16,true),privateSp);
assert.equal(first.win16_bridge_frame_end(outer),1);assert.deepEqual(cpu(first),original);
assert.equal(view.getUint32(shared+36,true),0);
const recycled=first.win16_bridge_frame_begin();assert.equal(Number(recycled&0xffffffffn),Number(outer&0xffffffffn));assert.notEqual(recycled,outer);
assert.equal(first.win16_bridge_frame_end(outer),0,'old generation cannot end recycled frame');
assert.throws(()=>first.win16_call32_begin(16128),WebAssembly.RuntimeError,'scratch cannot overwrite its context');
assert.equal(first.win16_bridge_frame_end(recycled),1);assert.deepEqual(cpu(first),original);
const a=first.win16_bridge_frame_begin();first.win16_bridge_stack_enter(a);first.win16_bridge_frame_begin();
seed(second,0x11223344);const other=cpu(second),foreign=second.win16_bridge_frame_begin();assert(foreign);
assert.equal(first.win16_bridge_abort(),2);assert.deepEqual(cpu(first),original);assert.equal(view.getUint32(shared+36,true),1);
assert.equal(second.win16_bridge_frame_end(foreign),1);assert.deepEqual(cpu(second),other);assert.equal(view.getUint32(shared+36,true),0);
first.win16_call32_begin(1);assert.equal(view.getUint32(first.get_reg_base()+16,true),fixture.GUEST_STACK+fixture.GUEST_STACK_SIZE-8,'pure legacy scratch location unchanged');first.win16_call32_end();
const calls=ensureCalls;first.set_is_win16(1);assert.equal(first.win16_bridge_frame_begin(),0n);assert.equal(ensureCalls,calls,'pure NE cannot activate Win32 bridge');first.set_is_win16(0);
// Exhaust actual selector allocator without an available free run.
for(let i=1;i<943;i++)view.setUint32(fixture.WIN16_SEG_TABLE+i*16+8,0,true);
view.setUint32(shared,943,true);const beforeFailure=cpu(first);
assert.equal(first.win16_bridge_frame_begin(),0n);assert.deepEqual(cpu(first),beforeFailure);
assert.equal(view.getUint32(shared+36,true),0);assert.equal(view.getUint32(fixture.DLL_LOAD_LOCK,true),0);
assert.equal(first.win16_process_arena_release(),1);
const beforeRace=ensureCalls;releaseBetween=true;const raced=first.win16_bridge_frame_begin();
assert(raced);assert.equal(ensureCalls,beforeRace+2,'release between ensure and pin must retry');
assert.equal(view.getUint32(shared+36,true),1);assert.equal(first.win16_bridge_frame_end(raced),1);
assert.deepEqual(cpu(first),beforeFailure);assert.equal(first.win16_process_arena_release(),1);
failEnsure=true;assert.equal(first.win16_bridge_frame_begin(),0n);assert.deepEqual(cpu(first),beforeFailure);
failEnsure=false;
// Actual runner setup, sync-depth/spill protection and actual RETF handler.
seed(first,0x22334455);first.set_sync_msg_depth(0);first.set_spill_active(1);
first.set_spill_base(0x90000);first.set_spill_end(0xa0000);first.set_ip(0x91000);
const invokeCaller=cpu(first),prepared=first.win16_bridge_frame_begin();
const codeIndex=first.win16_arena_take(1),dataIndex=first.win16_arena_take(1);
const codeBase=first.win16_arena_slot_base(codeIndex),dataBase=first.win16_arena_slot_base(dataIndex);
first.win16_seg_set(codeIndex,codeBase,32,0,1);first.win16_seg_set(dataIndex,dataBase,65536,1,2);
const cs=(codeIndex<<3)|7,ds=(dataIndex<<3)|7,target=(cs<<16)|2;
for(const bad of [0,((codeIndex<<3)<<16)|2,(cs<<16)|32,(ds<<16)|2]){
 assert.equal(first.win16_bridge_invoke_begin(prepared,bad,ds,7,16),0);assert.deepEqual(cpu(first),invokeCaller);
}
assert.equal(first.win16_bridge_invoke_begin(prepared,target,cs,7,16),0,'code selector cannot be DS');
const blocked=second.win16_bridge_frame_begin();assert(blocked);
assert.equal(first.win16_bridge_invoke_begin(prepared,target,ds,7,16),1);
assert.equal(first.get_sync_msg_depth(),1);assert.equal(first.get_spill_pins(),1);assert.equal(first.thread_spill_can_recycle(),0);
assert.equal(first.get_eip(),codeBase+2);assert.equal(first.get_sreg_ds(),ds);
assert.equal(view.getUint32(first.get_reg_base()+28,true),7);assert.equal(view.getUint32(first.get_reg_base()+4,true),16);
assert.equal(first.win16_bridge_invoke_result(prepared),-1n);
assert.equal(second.win16_bridge_frame_begin(),0n,'foreign lease prevents allocation');assert.equal(second.win16_bridge_invoke_begin(blocked,target,ds,7,16),0,'foreign execution lease');assert.equal(second.win16_bridge_frame_end(blocked),1);
const nested=first.win16_bridge_frame_begin();assert.equal(first.win16_bridge_invoke_begin(nested,target,ds,8,0),1);
assert.equal(first.get_sync_msg_depth(),2);assert.equal(first.win16_bridge_frame_end(prepared),0);
assert.equal(first.win16_bridge_frame_end(nested),1,'cancel nested invocation');assert.equal(first.get_sync_msg_depth(),1);
view.setUint32(first.get_reg_base(),0x1234abcd,true);view.setUint32(first.get_reg_base()+8,0x5678ef01,true);
first.th_retf16(0);assert.equal(first.win16_bridge_invoke_result(prepared),0xef01abcdn);
assert.equal(first.get_eip(),0);assert.equal(first.win16_bridge_frame_end(prepared),1);assert.deepEqual(cpu(first),invokeCaller);
assert.equal(first.get_sync_msg_depth(),0);assert.equal(first.get_spill_pins(),0);assert.equal(view.getUint32(shared+40,true),0);assert.equal(view.getUint32(shared+44,true),0);
const malformed=first.win16_bridge_frame_begin();assert.equal(first.win16_bridge_invoke_begin(malformed,target,ds,7,0),1);
assert.throws(()=>first.th_retf16(2),WebAssembly.RuntimeError,'wrong return stack rejected');assert.equal(first.win16_bridge_frame_end(malformed),1);assert.deepEqual(cpu(first),invokeCaller);
first.win16_arena_give(codeIndex,1);first.win16_arena_give(dataIndex,1);assert.equal(first.win16_process_arena_release(),1);
console.log('PASS actual NE invocation runner: strict selectors, entry ABI, real RETF result, lease exclusion, nested cancellation, spill pins and caller restoration');
console.log('PASS actual NE invocation helpers: full CPU files/state, nested private stacks, stale/foreign completion, abort and lifetime pins');
