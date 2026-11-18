'use strict';
const assert=require('node:assert/strict');
const {bootRenderHarness}=require('./render-helper');
const {observe,qualified}=require('../lib/cli-native-common-controls');
const extraWat=String.raw`
 (func (export "list_style") (param $h i32) (param $style i32)
   (drop (call $wnd_set_style (local.get $h) (local.get $style))))
 (func (export "list_destroy") (param $h i32) (call $wnd_destroy_tree (local.get $h)))
 (func (export "list_empty_state") (param $h i32)
   (call $wnd_set_state_ptr (local.get $h) (i32.const 0)))
`;
(async()=>{
 const {exports:e,memory}=await bootRenderHarness({extraWat});
 e.set_process_id(1000);e.set_current_thread_id(1);
 const h=e.test_create_listbox(5,5,180,80),generation=String(e.wnd_lookup_generation(h));
 const get=()=>observe(e,h,memory,generation);
 assert.equal(get().state.paintOwner,'native');
 const p=e.guest_alloc(32),wa=require('../lib/region-map.generated').g2w(p,e.get_image_base());
 new Uint8Array(memory.buffer).set(Buffer.from('English (International)\0'),wa);
 assert.equal(e.send_message(h,0x180,0,p),0);
 e.send_message(h,0x186,0,0);
 // A real guest-subclass integration is exercised by the ordinary authored
 // wizard; this unit test proves the read-only export never invokes its proc.
 e.test_wnd_table_set(h,0x401234);
 const before=Buffer.from(new Uint8Array(memory.buffer));
 const s=get();assert.equal(s.available,true,'subclass retains native list storage');
 assert.equal(s.state.procedure,'0x401234');assert.equal(s.state.paintOwner,'guest-subclass');
 assert.equal(s.state.items[0].text,'English (International)');assert.equal(s.state.selection,0);
 assert.deepEqual(Buffer.from(new Uint8Array(memory.buffer)),before,'read-only storage observation');
 assert.equal(e.wnd_get_proc_export(h),0x401234,'observation preserves guest callback');
 const row={hwnd:'0x'+h.toString(16),generation,live:true,processId:1000,threadId:1,controlClass:4,commonControl:s};
 assert(qualified(row));
 assert(!qualified({...row,commonControl:{...s,state:{...s.state,procedure:'0xffff0002'}}}));
 assert.throws(()=>observe(e,h,memory,'wrong'));
 for(const procedure of [0,0xffff0001,0xffff0004]){
  e.test_wnd_table_set(h,procedure);assert.equal(get().available,false,'unrelated sentinels have no list contract');
 }
 e.test_wnd_table_set(h,0x401234);
 e.list_style(h,0x50000010);assert.equal(get().available,false,'owner-draw without strings stays unsupported');
 e.list_style(h,0x50000050);assert.equal(get().available,true,'owner-draw with native string storage is observable');
 e.test_wnd_table_set(h,0xffff0002);e.list_destroy(h);
 assert.equal(e.native_listbox_get(h,0),-1);assert.equal(e.native_listbox_selected(h,0),-1);
 e.test_wnd_table_set(h,0xffff0002);assert.equal(get(),null,'retired class cannot become an observed list');
 assert.notEqual(String(e.wnd_lookup_generation(h)),generation,'reused HWND changes generation');
 const fresh=e.test_create_listbox(5,5,180,80);e.list_empty_state(fresh);
 assert.equal(e.native_listbox_get(fresh,0),-1,'uninitialized state refused');
 const combo=e.test_create_combobox(0,0,100,100,3);e.test_wnd_table_set(combo,0x401234);
 assert.equal(e.native_combobox_get(combo,0),-1,'other class guards unchanged');
 assert.equal(e.native_listbox_get(combo,0),-1,'wrong class refused');
 console.log('PASS listbox native-storage observation, subclass ownership, owner-draw, lifetime and read-only negatives');
})().catch(e=>{console.error(e);process.exitCode=1});
