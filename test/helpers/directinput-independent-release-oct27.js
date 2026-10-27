'use strict';
// Reuse the exact pinned production fragment runner, not its test cases.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),Module=require('module');
module.exports=function run(challenge) {
 const fixture=path.resolve(__dirname,'../test-directinput-buffered-keyboard.js');
 const source=fs.readFileSync(fixture,'utf8');
 const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
 if(sha(source)!=='ea5c710903a5ef181df4c516b36bd3a66d919ad5127c8e667b91927853a3b98a')throw Error('fixture pin');
 if(source.split('const events=[];').length!==2)throw Error('fixture boundary');
 let setup=source.slice(0,source.indexOf('const events=[];'));
 const additions=['$handle_IDirectInputDevice_SetDataFormat','$di_standard_data_format_size','$di_custom_data_format',
 '$handle_dx_com_release_basic','$dx_com_release_basic','$dx_free','$dx_aux_refs','$dx_aux_index','$dx_aux_ref_add','$dx_aux_refs_of_slot','$dx_interface_count','$vbdd_draw_state_reset','$dx_surf_meta_ptr','$dx_surf_owner_ptr','$dx_surf_creator_ptr','$di_format_map_drop','$di_format_map_install','$di_format_map_set','$di_object_type','$di_object_exists',
 '$di_object_guid_matches','$di_object_guid_data1','$heap_alloc','$heap_free','$di_custom_device_state'];
 setup=setup.replace('const picked=new Map(),stubs=new Map();',
 `for(const name of ${JSON.stringify(additions)})funcs.add(name);
 byName.set('$independent_bump','(global $independent_bump (mut i32) (i32.const 0x40000))');
 byName.set('$heap_alloc','(func $heap_alloc (param $size i32) (result i32) (local $old i32) (local.set $old (global.get $independent_bump)) (global.set $independent_bump (i32.add (local.get $old) (local.get $size))) (local.get $old))');
 byName.set('$heap_free','(func $heap_free (param i32))');
 const picked=new Map(),stubs=new Map();`);
 setup=setup.replace('const extra=`','const extra=`(func (export "setFormat") (param i32 i32) (call $handle_IDirectInputDevice_SetDataFormat (local.get 0) (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))');
 setup=setup.replace("stubSigs.$page_watch_write=", "stubSigs.$gdi_object_delete_full='(param i32) (result i32)';stubSigs.$page_watch_write=");
 setup=setup.replace('const extra=`','const extra=`(func (export "release") (param i32) (call $handle_dx_com_release_basic (local.get 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))');
 setup=setup.replace('get_ticks:()=>100,','get_ticks:()=>100,dx_trace:()=>{throw Error("unexpected surface-only trace");},');
 console.log(JSON.stringify({fixtureSHA256:sha(source),setupSHA256:sha(setup),challengeSHA256:sha(challenge),
  transformation:'exact pinned prefix; explicit production SetDataFormat/custom state closure; fixture bounded bump allocator/no-op free; unmodified renderer/host/RPC/WAT production forms',
  limitation:'fragment compile, synthetic object/memory, no full module or gameplay'}));
 const child=new Module(fixture,module);child.filename=fixture;child.paths=Module._nodeModulePaths(path.dirname(fixture));child._compile(setup+challenge,fixture);
};
