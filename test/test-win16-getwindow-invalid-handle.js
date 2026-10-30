#!/usr/bin/env node
'use strict';
const assert=require('assert/strict');
const {bootRenderHarness}=require('./render-helper');
const extraWat=String.raw`
  (func (export "gw_init")
    (global.set $is_win16 (i32.const 1))
    (call $win16_handle_reset)
    (call $win16_seg_set (i32.const 1) (i32.const 0x100000) (i32.const 65536) (i32.const 0) (i32.const 1))
    (call $win16_seg_set (i32.const 2) (i32.const 0x110000) (i32.const 65536) (i32.const 1) (i32.const 2))
    (global.set $code16 (i32.const 1))
    (call $win16_set_sreg (i32.const 1) (call $win16_index_to_sel (i32.const 1)))
    (call $win16_set_sreg (i32.const 2) (call $win16_index_to_sel (i32.const 2))))
  (func (export "gw_make") (param $hwnd i32) (param $style i32) (param $parent i32) (param $owner i32) (result i32)
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_CTRL_NATIVE))
    (drop (call $wnd_set_style (local.get $hwnd) (local.get $style)))
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
    (call $wnd_set_owner (local.get $hwnd) (local.get $owner))
    (call $win16_h16 (local.get $hwnd)))
  (func (export "gw_narrow") (param $h i32) (result i32) (call $win16_h16 (local.get $h)))
  (func (export "gw_widen") (param $h i32) (result i32) (call $win16_h32 (local.get $h)))
  (func (export "gw_forget") (param $h i32) (call $win16_h16_forget (local.get $h)))
  (func (export "gw_query") (param $h i32) (param $cmd i32) (param $ordinal i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (i32.const 0x77))
    (call $gs16 (i32.const 0x110802) (call $win16_index_to_sel (i32.const 1)))
    (call $gs16 (i32.const 0x110804) (local.get $cmd))
    (call $gs16 (i32.const 0x110806) (local.get $h))
    (i32.store offset=12 (global.get $reg_base) (i32.const 0x12345678))
    (i32.store offset=20 (global.get $reg_base) (i32.const 0x800))
    (drop (call $win16_user (local.get $ordinal)))
    (i32.load (global.get $reg_base)))
`;
(async()=>{
  const {exports:e}=await bootRenderHarness({extraWat,fonts:'none'});
  e.gw_init();
  const owner=0x18001, c1=0x18002, c2=0x18003, other=0x18004, c3=0x18005, popup=0x18006;
  const owner16=e.gw_make(owner,0,0,0);
  const c1h=e.gw_make(c1,0x40000000,owner,0);
  const c2h=e.gw_make(c2,0x40000000,owner,0);
  e.gw_make(other,0x40000000,0x180ff,0);
  const c3h=e.gw_make(c3,0x40000000,owner,0);
  const popup16=e.gw_make(popup,0x80000000,0,owner);
  const query=(h,cmd,ordinal,expected)=>{
    assert.equal(e.gw_query(h,cmd,ordinal),expected);
    assert.equal(e.get_esp(),0x110808,'far return plus two Pascal words consumed');
    assert.equal(e.get_eip(),0x100077,'original CS:IP restored');
    assert.equal(e.get_ebx(),0x12345678);assert.equal(e.get_ebp(),0x800);
  };
  for(const ordinal of [230,262]){
    query(c1h,2,ordinal,c2h);query(c2h,2,ordinal,c3h);query(c3h,2,ordinal,0);
    query(c3h,3,ordinal,c2h);query(c2h,3,ordinal,c1h);query(c1h,3,ordinal,0);
    for(const h of [0,0x1446,0xfffe,0xffff,0x20]){
      query(h,2,ordinal,0);query(h,3,ordinal,0);
    }
  }
  query(owner16,5,262,c1h);query(popup16,4,262,owner16);
  query(c2h,0,262,c1h);query(c2h,1,262,c3h);
  for(const cmd of [0,1,4,5,6,0xffff]){
    query(owner16,cmd,230,0);query(0x1446,cmd,230,0);
  }
  const nonwindow=e.gw_narrow(0x410042);
  const stale=e.gw_narrow(0x180fe);e.gw_forget(0x180fe);
  for(const ordinal of [230,262])for(const h of [nonwindow,stale])query(h,2,ordinal,0);
  assert.throws(()=>e.gw_widen(0x1446),WebAssembly.RuntimeError,'general conversion stays strict');
  query(c1h,2,230,c2h);
  console.log('PASS actual USER230/262 invalid HWND rejection, sibling traversal, relationships and Pascal far ABI');
})().catch(e=>{console.error(e);process.exitCode=1;});
