'use strict';
// Independent review only. Exact sender body + exact modal completion prefix.
// Scripted dependencies are explicitly NOT the full interpreter or guest code.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const {compile}=require(process.env.SHADOW_NULL_TEST_COMPILER||'../tools/watx.js');
const {createCapture,createSelectedSend,CaptureStop,ADDRESS}=require('../tools/shadow-man-null-capture.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.SHADOW_NULL_TEST_OUTPUT||fs.mkdtempSync(path.join(require('node:os').tmpdir(),'shadow-null-repair-'));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ex=read('src/13-exports.wat'),sender=read('src/09c3a-dialog-runtime.wat'),dispatch=read('src/09b-dispatch.wat');
function form(s,start){let d=0,comment=false;for(let i=start;i<s.length;i++){if(s[i]==='\n')comment=false;if(s[i]===';'&&s[i+1]===';')comment=true;if(comment)continue;if(s[i]==='(')d++;if(s[i]===')'&&!--d)return s.slice(start,i+1);}throw Error('unbalanced');}
const hook=ex.slice(0,ex.indexOf('  ;; End opt-in NULL boundary diagnostic declarations.'));
const actualSender=form(sender,sender.indexOf('(func $wnd_send_message_inner'));
const continuation=form(dispatch,dispatch.indexOf('(if (i32.eq (local.get $name_rva) (i32.const 0xCACA0005))'));
const modalStart=dispatch.indexOf('(if (i32.eq (local.get $name_rva) (i32.const 0xCACA0004))');
const modalEndStart=dispatch.indexOf('(if (global.get $dlg_ended)\n          (then\n            ;; Teardown',modalStart);
const modalEnd=form(dispatch,modalEndStart);
const modal=dispatch.slice(modalStart,modalEndStart)+modalEnd+'))';
const zero=ex.slice(ex.indexOf('      (if (i32.eqz (global.get $eip))'),ex.indexOf('      ;; A block whose quantum'));
let wat='(import "host" "log_eip" (func $host_log_eip (param i32))) (memory 128 128) (export "memory" (memory 0))\n';
const globals=['eip','last_run_halt','dlg_pump_hwnd','dlg_ret_addr','dlg_ended','sync_msg_depth','code16','host_shadow','handler_set_eip','steps','yield_reason','yield_flag','sleep_yielded','wnd_send_completed','dlg_result','dlg_proc','dlg_callback_yield_pending','dlg_init_focus_hwnd','dlg_hwnd','dlg_show_pending','active_hwnd','main_hwnd','quit_flag','review_run_mode'];
wat+=globals.map(n=>`(global $${n} (mut i32) (i32.const 0))`).join('\n');
wat+='(global $reg_base i32 (i32.const 0)) (global $SHARED_DLG_PUMP_HWND i32 (i32.const 128)) (global $SHARED_DLG_ENDED i32 (i32.const 132)) (global $SHARED_DLG_RESULT i32 (i32.const 136)) (global $WNDPROC_DIALOG i32 (i32.const -2)) (global $WNDPROC_BUILTIN i32 (i32.const -3)) (global $sync_msg_ret_thunk i32 (i32.const 0x7500000)) (global $invocation_root i64 (i64.const 900)) (global $token (mut i64) (i64.const 100))\n';
wat+='(layout EditState (field text_buf_ptr i32) (field text_len i32))\n';
wat+='(func $invocation_current (result i64) (global.get $token)) (func $sync_depth_enter (global.set $sync_msg_depth (i32.add (global.get $sync_msg_depth) (i32.const 1))) (global.set $token (i64.add (global.get $token) (i64.const 1)))) (func $sync_depth_leave (global.set $sync_msg_depth (i32.sub (global.get $sync_msg_depth) (i32.const 1))) (global.set $token (i64.sub (global.get $token) (i64.const 1))))\n';
wat+=hook;
const stubs={wnd_table_get:[1,0x401000],ctrl_table_get_class:[1,0],tab_native_is:[1,0],tab_native_note_message:[4,null],tab_native_paint:[1,0],statusbar_native_is:[1,0],statusbar_wndproc:[4,0],ctrl_is_subclassed:[1,0],control_wndproc_dispatch:[4,0],menu_try_edit_command:[1,0],dialog_default_proc:[4,0],wat_wndproc_dispatch:[4,0],wnd_get_style:[1,0],wnd_get_state_ptr:[1,0],win16_is_far_proc:[1,0],post_queue_push:[4,0],host_service_load_library:[0,0],host_log_i32:[1,null],wnd_get_owner:[1,0],wnd_table_remove:[1,null],host_destroy_window:[1,null],focus_restore_after_modal:[1,null],activate_window_with_host:[1,0],dialog_apply_init_focus:[3,null],dlg_show_now:[1,null]};
for(const[n,[args,result]]of Object.entries(stubs))wat+=`(func $${n} ${'(param i32) '.repeat(args)}${result===null?'':`(result i32) (i32.const ${result})`})\n`;
// Teardown seam mutates private pump and return to prove event 3 is post-teardown.
wat+='(func $wnd_destroy_children (param i32) (global.set $dlg_pump_hwnd (i32.const 999)) (global.set $dlg_ret_addr (i32.const 888)))\n';
wat+='(func $g2w (param $a i32) (result i32) (local.get $a)) (func $gl32 (param $a i32) (result i32) (i32.load (local.get $a))) (func $gs32 (param $a i32) (param $v i32) (i32.store (local.get $a) (local.get $v)))\n';
wat+=`(func $sync_continuation (param $name_rva i32) ${continuation})\n`;
wat+=`(func $run (param i32)
 (if (global.get $review_run_mode) (then (return)))
 ;; Scripted successful stdcall seam, then REAL CACA0005 and REAL run zero check.
 (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
 (i32.store (i32.const 0) (i32.const 57005))
 (call $sync_continuation (i32.const 0xCACA0005))
 (block $halt ${zero}))\n`;
wat+=actualSender+'\n(export "send" (func $wnd_send_message_inner))\n';
wat+=`(func (export "modal") (param $name_rva i32) (local $arg0 i32) (local $arg1 i32) (local $arg4 i32) (local $ending_dlg i32) ${modal})\n`;
const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
wat+=regs.map((n,i)=>`(func (export "get_${n}") (result i32) (i32.load (i32.const ${i*4})))`).join('\n');
wat+='(func (export "get_eip") (result i32) (global.get $eip)) (func (export "guest_read8") (param $a i32) (result i32) (i32.load8_u (local.get $a))) (func (export "set_bp") (param i32)) (func (export "set_trace_eip_range") (param i32) (param i32) (param i32))\n';
wat+=globals.map(n=>`(func (export "set_${n}") (param $v i32) (global.set $${n} (local.get $v)))`).join('\n');
fs.writeFileSync(path.join(out,'actual-paths.wat'),wat);
const compiled=compile(wat,new Map(),{mode:'production'});assert(compiled.success,JSON.stringify(compiled.diagnostics));const bin=compiled.wasmBinary;
fs.writeFileSync(path.join(out,'actual-paths.wasm'),bin);
async function fixture(observer){const i=await WebAssembly.instantiate(bin,{host:{log_eip:observer}});const e=i.instance.exports,d=new DataView(e.memory.buffer);for(let i=0;i<8;i++)d.setUint32(i*4,0x100+i,true);d.setUint32(16,0x600000,true);e.set_eip(0x402000);return{e,d};}
(async()=>{
 const checks=[];
 let seen=[],f=await fixture(t=>{seen.push({tag:t,eip:f.e.get_eip(),esp:f.e.get_esp(),saved:[f.e.null_diag_field(0),f.e.null_diag_field(1)],token:f.e.null_diag_token().toString(),depth:f.e.null_diag_field(7)});});
 assert.equal(f.e.send(1,0x111,3,0),57005);assert.equal(f.e.get_eip(),0x402000);assert.equal(f.e.get_esp(),0x600000);assert.equal(f.e.get_eax(),0x100);assert.equal(seen.length,0);checks.push('real full sender body default-off restores caller');
 f.e.set_null_diag(1);assert.throws(()=>f.e.send(1,0x111,3,0),WebAssembly.RuntimeError);assert.deepEqual(seen.map(x=>x.tag),[-1,-5]);assert.equal(f.e.get_eip(),0);assert.equal(f.e.null_diag_field(7),1);assert.equal(seen[0].token,'101');assert.deepEqual(seen[0].saved,[0x402000,0x600000]);assert.equal(seen[1].saved[0],0);checks.push('legitimate REAL CACA0005 completion triggers first-zero before sender event2/restoration');
 // Incomplete-run seam exercises actual sender's 64-round abandonment and event2.
 let before=[];f=await fixture(tag=>before.push({tag,eip:f.e.get_eip(),esp:f.e.get_esp(),saved:[f.e.null_diag_field(0),f.e.null_diag_field(1)],token:f.e.null_diag_token().toString(),depth:f.e.null_diag_field(7)}));
 f.e.set_review_run_mode(1);f.e.set_null_diag(1);assert.equal(f.e.send(1,0x111,3,0),0x100);assert.deepEqual(before.map(x=>x.tag),[-1,-2]);assert.equal(before[1].eip,0x401000);assert.equal(before[1].esp,0x600000-20);assert.deepEqual(before[1].saved,[0x402000,0x600000]);assert.equal(before[1].depth,1);assert.equal(f.e.get_eip(),0x402000);assert.equal(f.e.get_esp(),0x600000);assert.equal(f.e.null_diag_field(7),0);
 checks.push('actual sender 64-round abandonment event2 before restore: saved caller pair/current child frame/depth verified');
 let modalEvents=[];f=await fixture(tag=>{modalEvents.push({tag,eip:f.e.get_eip(),esp:f.e.get_esp(),saved:[f.e.null_diag_field(0),f.e.null_diag_field(1)],pump:f.e.null_diag_field(2),ret:f.e.null_diag_field(3),ended:f.e.null_diag_field(4)});});
 f.e.set_null_diag(1);f.e.set_dlg_ended(1);f.e.set_dlg_pump_hwnd(77);f.e.set_dlg_ret_addr(0x4015d4);f.e.set_dlg_result(7);f.e.set_dlg_show_pending(-1);
 const frame=0x600004;f.d.setUint32(0x600000,0xdcbaabcd,true);[66,123,456,0,0].forEach((v,i)=>f.d.setUint32(frame+4+i*4,v,true));
 f.e.modal(0xcaca0004|0);assert.deepEqual(modalEvents.map(x=>x.tag),[-3,-4]);assert.equal(modalEvents[0].esp,frame);assert.deepEqual(modalEvents[0].saved,[0x4015d4,frame]);assert.equal(modalEvents[0].pump,999);assert.equal(modalEvents[0].ret,888);assert.equal(modalEvents[1].eip,0x4015d4);assert.equal(modalEvents[1].esp,frame+24);assert.equal(modalEvents[1].pump,66);assert.equal(modalEvents[1].ret,456);assert.equal(modalEvents[1].ended,1);assert.equal(f.e.null_diag_field(4),0);checks.push('actual modal sentinel+ended-completion prefix: event3 after teardown mutation, event4 after previous-frame restore/ESP+24 before ended reset');
 // Actual hook saturates before the target block/zero: 16 modal completions = 32 events.
 f=await fixture(()=>{});f.e.set_null_diag(1);for(let n=0;n<16;n++){f.e.set_dlg_ended(1);f.d.setUint32(16,0x600000,true);f.e.modal(0xcaca0004|0);}assert.equal(f.e.null_diag_field(8),32);f.e.set_dlg_ended(1);f.d.setUint32(16,0x600000,true);assert.throws(()=>f.e.modal(0xcaca0004|0),WebAssembly.RuntimeError);checks.push('32 real modal events starve later target; 33rd traps');
 // Deferred arm tested with the actual sender body and actual modal prefix.
 let cap;f=await fixture(t=>cap.log(t));const retained=[];
 cap=createCapture({untilZero:true,metadata:{nativeScripted:true},retain:r=>retained.push(r),stop:()=>{}});
 const target={exports:f.e},selector={actionSequence:3,batch:19,cmdId:3,hwnd:8194};
 const selected=createSelectedSend({instance:target,capture:cap,selection:selector,runner:'native-fixture'});
 const ctx=(sequence,cmdId)=>({instance:target,pid:process.pid,runner:'native-fixture',action:'dlg-cmd',...selector,actionSequence:sequence,cmdId,resolution:'resolved-dialog'});
 selected(ctx(1,1024),()=>f.e.send(8194,0x111,1024,0));selected(ctx(2,1),()=>f.e.send(8194,0x111,1,0));
 for(let n=0;n<40;n++){f.e.set_dlg_ended(1);f.d.setUint32(16,0x600000,true);f.e.modal(0xcaca0004|0);}
 assert.equal(retained.length,0);assert.equal(f.e.null_diag_field(8),0);
 f.d.setUint32(16,0x600000,true);f.e.set_eip(0x402000);
 assert.throws(()=>selected(ctx(3,3),()=>f.e.send(8194,0x111,3,0)),CaptureStop);
 assert.equal(retained[0].receipt.prior.boundary.eventCount,0);assert.equal(retained[1].record.boundary.eventCount,1);
 assert.deepEqual(retained.filter(r=>r.record).map(r=>r.record.kind),['sender-pre','first-zero']);
 assert.equal(retained.at(-1).record.classification,'ordinary-or-unknown; zero-writer unproven');
 checks.push('actual sender Config/OK and 40 modal completions default OFF; deferred selected-send resets counters and captures legitimate zero as ordinary-or-unknown');
 const result={exit:0,checks,native:{bytes:bin.length,sha256:crypto.createHash('sha256').update(bin).digest('hex'),arenaBytes:8388608},senderEvents:seen,abandonmentEvents:before,modalEvents};
 fs.writeFileSync(path.join(out,'actual-path-tests.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
