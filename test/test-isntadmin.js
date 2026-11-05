#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {bootRenderHarness}=require('./render-helper');
const {makeFixture}=require('../tools/kernel32-native-fixture');
// Exercise the exact failing dynamic lookup and production API dispatcher.
// Exhaustion is an error witness against returning an unconditional TRUE.
const extraWat=String.raw`
  (func (export "test_resolve") (param $library i32) (param $name i32) (result i32)
    (local $esp i32) (local $module i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_LoadLibraryA (local.get $library) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (local.set $module (i32.load (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (call $handle_GetProcAddress (local.get $module) (local.get $name)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.load (global.get $reg_base)))
  (func (export "test_dispatch") (param $thunk i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $win32_dispatch (i32.div_u
      (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8)))
    (i32.load offset=16 (global.get $reg_base)))
  (func (export "test_open") (result i32)
    (call $token_allocate_handle (i32.const 8)))
  (func (export "test_close") (param $handle i32) (result i32)
    (call $token_close_handle (local.get $handle)))
  (func (export "test_capacity") (result i32) (global.get $TOKEN_OBJECT_COUNT))
  (func (export "test_error") (result i32) (global.get $last_error))
  (func (export "test_set_error") (param $value i32) (global.set $last_error (local.get $value)))
`;
(async()=>{
 const {exports:e,memory}=await bootRenderHarness({extraWat,fonts:'none',tailCalls:!process.argv.includes('--compat')});
 const fixture=makeFixture();
 new Uint8Array(memory.buffer).set(fixture,e.get_staging());
 assert(e.load_pe(fixture.length),'initialize genuine PE loader and thunk region');
 e.set_winver(0x0a280105);
 const base=e.guest_alloc(512)>>>0,stack=base+256;
 const toWasm=g=>(g-e.get_image_base()+e.get_guest_base())>>>0;
 const bytes=new Uint8Array(memory.buffer),view=new DataView(memory.buffer);
 const put=(g,s)=>bytes.set(Buffer.from(s+'\0','ascii'),toWasm(g));
 put(base,'advpack.dll');put(base+32,'IsNTAdmin');put(base+64,'DefinitelyNotAnAdvpackExport');
 assert.equal(e.test_resolve(base,base+64),0,'unknown exports remain absent');
 const thunk=e.test_resolve(base,base+32)>>>0;
 assert(thunk>=e.get_thunk_base()&&thunk<e.get_thunk_end(),'dynamic IsNTAdmin lookup resolves a dispatch thunk');
 const frame=()=>{view.setUint32(toWasm(stack),0x12345678,true);view.setUint32(toWasm(stack+4),0,true);view.setUint32(toWasm(stack+8),0,true);view.setUint32(toWasm(stack+12),0xfeedbeef,true);};
 const call=()=>{frame();assert.equal(e.test_dispatch(thunk,stack)>>>0,stack+12,'two-argument stdcall cleanup');assert.equal(view.getUint32(toWasm(stack+12),true),0xfeedbeef,'caller stack retained');return e.get_eax();};
 e.test_set_error(0x1234);
 assert.equal(call(),1,'existing enabled administrator process token is reported');
 assert.equal(e.test_error(),0x1234,'success preserves last error');
 // Repeated queries must release their transient handle, including the last
 // available slot; their answers must agree with the process-token API.
 for(let i=0;i<e.test_capacity()+3;i++)assert.equal(call(),1);
 const handles=[];
 for(let i=0;i<e.test_capacity();i++){const h=e.test_open()>>>0;assert.notEqual(h,0);handles.push(h);}
 assert.equal(e.test_open(),0,'negative control saturates actual token pool');
 assert.equal(call(),0,'token-query allocation failure cannot claim admin success');
 assert.equal(e.test_error(),8,'allocation failure reports ERROR_NOT_ENOUGH_MEMORY');
 assert.equal(e.test_close(handles.pop()),1);
 assert.equal(call(),1,'the one free token slot supports a complete query');
 const last=e.test_open()>>>0;assert.notEqual(last,0,'successful query released its handle');
 handles.push(last);for(const h of handles)assert.equal(e.test_close(h),1);
 console.log('PASS IsNTAdmin dynamic advpack lookup, production dispatch/stdcall, existing token identity, no leaks and real allocation-failure negative control');
})().catch(e=>{console.error(e);process.exitCode=1;});
