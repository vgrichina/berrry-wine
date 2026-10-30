#!/usr/bin/env node
'use strict';
// Small real-function check: rejection must return through the real Pascal
// epilogue without entering any 32-bit bridge. Full valid-window coverage is
// in test-win16-getwindow-invalid-handle.js.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {compile}=require('../tools/watx');
const source=fs.readFileSync(process.argv[2]||path.join(__dirname,'../src/09e-win16-api.wat'),'utf8');
function fn(name){
  const text=source.replace(/;;[^\n]*/g,'');
  const start=text.search(new RegExp('\\(func \\$'+name+'(?=\\s|\\))'));
  assert(start>=0,name);
  let depth=0;
  for(let i=start;i<text.length;i++){
    if(text[i]==='(')depth++;
    if(text[i]===')'&&!--depth)return text.slice(start,i+1);
  }
  throw Error('unclosed '+name);
}
const handlers=['GetWindow']
  .map(n=>`(func $handle_${n} (param i32 i32 i32 i32 i32 i32) (unreachable))`).join('\n');
const wat=`
 (memory 1)
 (global $reg_base i32 (i32.const 64))
 (global $WIN16_HANDLE_BASE i32 (i32.const 256))
 (global $win16_in_call32 (mut i32) (i32.const 0))
 (global $win16_last_module i32 (i32.const 2))
 (global $win16_last_ordinal i32 (i32.const 46))
 (global $seg_base_cs (mut i32) (i32.const 0))
 (global $eip (mut i32) (i32.const 0))
 (global $popped (mut i32) (i32.const 0))
 (func $host_log_i32 (param i32))
 (func $gl16 (param $p i32) (result i32) (i32.load16_u (local.get $p)))
 (func $win16_handle_next_get (result i32) (i32.const 12))
 (func $win16_handle_table (result i32) (i32.const 4096))
 (func $win16_h16 (param i32) (result i32) (unreachable))
 (func $win16_call32_begin (param i32) (unreachable))
 (func $win16_call32_end (unreachable))
 (func $win16_set_sreg (param $id i32) (param $sel i32)
   (if (i32.ne (local.get $id) (i32.const 1)) (then (unreachable)))
   (if (i32.ne (local.get $sel) (i32.const 15)) (then (unreachable)))
   (global.set $seg_base_cs (i32.const 0x100000)))
 (func $cs_pop (global.set $popped (i32.add (global.get $popped) (i32.const 1))))
 ${['win16_api_key','win16_arg16','win16_h32','win16_api_return','win16_GetWindow'].map(fn).join('\n')}
 ${handlers}
 (func (export "query") (param $h i32) (param $which i32) (result i32)
   (i32.store offset=16 (global.get $reg_base) (i32.const 2048))
   (i32.store16 (i32.const 2048) (i32.const 119))
   (i32.store16 (i32.const 2050) (i32.const 15))
   (i32.store16 (i32.const 2052) (local.get $which))
   (i32.store16 (i32.const 2054) (local.get $h))
   (call $win16_GetWindow)
   (i32.load (global.get $reg_base)))
 (func (export "strict") (param $h i32) (result i32) (call $win16_h32 (local.get $h)))
 (func (export "sp") (result i32) (i32.load offset=16 (global.get $reg_base)))
 (func (export "ip") (result i32) (global.get $eip))
 (func (export "popped") (result i32) (global.get $popped))`;
const result=compile(wat,new Map(),{mode:'production',standardWat:true,runtimeBuiltins:false,tailCalls:false,strictDeclarations:true});
assert(result.success,result.error||result.message);
const bytes=result.wasmBinary;
assert(bytes,'compiler binary');
const e=new WebAssembly.Instance(new WebAssembly.Module(bytes),{}).exports;
for(const h of [0x1446,0x10d,0xfffe]){
  assert.equal(e.query(h,2),0);assert.equal(e.sp(),2056);assert.equal(e.ip(),0x100077);
}
assert.equal(e.popped(),3);
assert.throws(()=>e.strict(0x1446),WebAssembly.RuntimeError);
assert.equal(e.query(0x1446,3),0,'previous-window rejection also returns NULL');
assert.equal(e.popped(),4,'strict failures do not return through Pascal epilogue');
console.log('PASS tiny actual GetWindow rejection/strict conversion/Pascal return functions');
