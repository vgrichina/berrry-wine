#!/usr/bin/env node
'use strict';
const assert=require('assert/strict');
const {bootRenderHarness}=require('./render-helper');
const extraWat=String.raw`
  (func (export "gp_init")
    (global.set $is_win16 (i32.const 1))
    (call $win16_handle_reset)
    (call $win16_seg_set (i32.const 1) (i32.const 0x100000) (i32.const 65536) (i32.const 0) (i32.const 1))
    (call $win16_seg_set (i32.const 2) (i32.const 0x110000) (i32.const 65536) (i32.const 1) (i32.const 2))
    (global.set $code16 (i32.const 1))
    (call $win16_set_sreg (i32.const 1) (call $win16_index_to_sel (i32.const 1)))
    (call $win16_set_sreg (i32.const 2) (call $win16_index_to_sel (i32.const 2))))
  (func (export "gp_make") (param $hwnd i32) (param $style i32) (param $parent i32) (param $owner i32) (result i32)
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_CTRL_NATIVE))
    (drop (call $wnd_set_style (local.get $hwnd) (local.get $style)))
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
    (call $wnd_set_owner (local.get $hwnd) (local.get $owner))
    (call $win16_h16 (local.get $hwnd)))
  (func (export "gp_narrow") (param $h i32) (result i32) (call $win16_h16 (local.get $h)))
  (func (export "gp_widen") (param $h i32) (result i32) (call $win16_h32 (local.get $h)))
  (func (export "gp_forget") (param $h i32) (call $win16_h16_forget (local.get $h)))
  (func (export "gp_query") (param $h i32) (param $which i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (i32.const 0x77))
    (call $gs16 (i32.const 0x110802) (call $win16_index_to_sel (i32.const 1)))
    (call $gs16 (i32.const 0x110804) (local.get $h))
    (i32.store offset=12 (global.get $reg_base) (i32.const 0x12345678))
    (i32.store offset=20 (global.get $reg_base) (i32.const 0x800))
    (call $win16_hwnd_query (local.get $which))
    (i32.load (global.get $reg_base)))
`;
(async()=>{
  const {exports:e}=await bootRenderHarness({extraWat,fonts:'none'});
  e.gp_init();
  const owner=0x18001, child=0x18002,popup=0x18003,top=0x18004;
  const owner16=e.gp_make(owner,0,0,0);
  const child16=e.gp_make(child,0x40000000,owner,0);
  const popup16=e.gp_make(popup,0x80000000,0,owner);
  const top16=e.gp_make(top,0,0,owner);
  const query=(h,expected)=>{
    assert.equal(e.gp_query(h,2),expected);
    assert.equal(e.get_esp(),0x110806,'far return plus one Pascal word consumed');
    assert.equal(e.get_eip(),0x100077,'original CS:IP restored');
    assert.equal(e.get_ebx(),0x12345678);assert.equal(e.get_ebp(),0x800);
  };
  query(child16,owner16);query(popup16,owner16);query(top16,0);
  for(const h of [0,0x1446,0xfffe,0xffff,0x20])query(h,0);
  const nonwindow=e.gp_narrow(0x410042);query(nonwindow,0);
  const stale=e.gp_narrow(0x180ff);e.gp_forget(0x180ff);query(stale,0);
  assert.throws(()=>e.gp_widen(0x1446),WebAssembly.RuntimeError,'general conversion stays strict');
  assert.throws(()=>e.gp_query(0x1446,3),WebAssembly.RuntimeError,'other HWND queries stay strict');
  query(child16,owner16);
  console.log('PASS Win16 GetParent invalid HWND returns NULL with correct far ABI; general conversion remains strict');
})().catch(e=>{console.error(e);process.exitCode=1;});
