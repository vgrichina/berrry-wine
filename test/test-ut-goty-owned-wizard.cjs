'use strict';
// Exercise the real CreateDialogIndirectParamA path before a modal parent has
// a convenience main, and with an existing native helper/main. No game media.
const assert=require('node:assert/strict');
const {bootRenderHarness}=require('./render-helper');
const extraWat=String.raw`
 (func (export "test_wizard_page") (param $child i32) (param $existing i32) (result i64)
  (local $p i32) (local $wa i32) (local $esp i32) (local $h i32) (local $parent i32)
  (local.set $parent (global.get $next_hwnd))
  (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
  (call $wnd_table_set (local.get $parent) (global.get $WNDPROC_CTRL_NATIVE))
  (drop (call $wnd_set_style (local.get $parent) (i32.const 0x80000000)))
  (global.set $main_hwnd (select (local.get $parent) (i32.const 0) (local.get $existing)))
  (local.set $p (call $heap_alloc (i32.const 32)))
  (local.set $wa (call $g2w (local.get $p)))
  (memory.fill (local.get $wa) (i32.const 0) (i32.const 32))
  (i32.store (local.get $wa) (select (i32.const 0x40000000) (i32.const 0x80000000) (local.get $child)))
  (i32.store16 offset=14 (local.get $wa) (i32.const 100))
  (i32.store16 offset=16 (local.get $wa) (i32.const 60))
  (local.set $esp (i32.load offset=16 (global.get $reg_base)))
  (call $handle_CreateDialogIndirectParamA (i32.const 0) (local.get $p)
    (local.get $parent) (i32.const 0) (i32.const 0) (i32.const 0))
  (local.set $h (i32.load (global.get $reg_base)))
  (i32.store offset=16 (global.get $reg_base) (local.get $esp))
  (call $heap_free (local.get $p))
  (i64.or (i64.extend_i32_u (global.get $main_hwnd))
    (i64.shl (i64.extend_i32_u (local.get $h)) (i64.const 32))))
`;
(async()=>{
 const h=await bootRenderHarness({extraWat}),e=h.exports;
 for(const existing of [0,1])for(const child of [0,1]){
  const pair=e.test_wizard_page(child,existing),main=Number(pair&0xffffffffn),created=Number(pair>>32n);
  assert(created&&e.wnd_lookup_live(created));
  assert.equal(!!(e.wnd_get_style_export(created)&0x40000000),!!child);
  if(child){assert.notEqual(main,created,'nested modeless page never becomes application main');
   assert.equal(main,existing?e.wnd_get_parent(created):0);
  }else{assert.equal(main,created,'real owned popup still replaces absent/native-helper main');
   assert.equal(e.wnd_get_parent(created),0);assert(e.wnd_get_owner(created));}
  assert.equal(e.get_window_thread(created),e.get_current_thread_id());
  assert(e.wnd_lookup_generation(created));
 }
 console.log('PASS real USER child-page exclusion and owned-popup/helper-main promotion, identities retained');
})().catch(e=>{console.error(e);process.exitCode=1});
