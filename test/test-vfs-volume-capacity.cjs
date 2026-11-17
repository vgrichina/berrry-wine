'use strict';
// A host allocation refusal is a guest filesystem error, never an emulator
// trap. This does not manufacture a volume quota or infer it from host disk.
const assert=require('node:assert/strict');
const {VirtualFS}=require('../lib/filesystem');
const {bootRenderHarness}=require('./render-helper');
async function run(){
 const v=new VirtualFS(),h=v.createFile('c:\\allocation.bin',0xc0000000,2);
 assert.deepEqual(v.writeFile(h,Uint8Array.from([11,22,33]),3),{ok:true,bytesWritten:3});
 assert.equal(v.setFilePointerResult(h,Number.MAX_SAFE_INTEGER,0).error,0);
 assert.equal(v.setEndOfFileResult(h),8);
 assert.equal(v.handles.get(h).pos,Number.MAX_SAFE_INTEGER);
 assert.equal(v.getFileSize(h),3);
 assert.deepEqual(v.writeFile(h,Uint8Array.of(99),1),{ok:false,bytesWritten:0,error:87});
 // Safe arithmetic with an unallocatable backing length also returns a normal
 // failure. No huge allocation succeeds or physical disk output is requested.
 v.setFilePointerResult(h,Number.MAX_SAFE_INTEGER-1,0);
 assert.deepEqual(v.writeFile(h,Uint8Array.of(99),1),{ok:false,bytesWritten:0,error:8});
 v.setFilePointer(h,0,0);const bytes=new Uint8Array(3);
 assert.deepEqual(v.readFile(h,bytes,3),{ok:true,bytesRead:3});assert.deepEqual([...bytes],[11,22,33]);
 v.setFilePointer(h,1,0);assert.equal(v.setEndOfFileResult(h),0);assert.equal(v.getFileSize(h),1);
 v.setFilePointer(h,4,0);assert.equal(v.setEndOfFileResult(h),0);v.setFilePointer(h,0,0);
 const expanded=new Uint8Array(4);v.readFile(h,expanded,4);assert.deepEqual([...expanded],[11,0,0,0]);
 assert.equal(v.setEndOfFileResult(0xdead),6);
 const {exports:e,hostCtx}=await bootRenderHarness({fonts:'none',extraWat:`
 (func (export "resize") (param $h i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
 (call $handle_SetEndOfFile (local.get $h) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
 (func (export "error") (result i32) (global.get $last_error))
 `});
 const f=hostCtx.vfs,fh=f.createFile('c:\\public-refusal.bin',0xc0000000,2);
 f.writeFile(fh,Uint8Array.of(0x74),1);f.setFilePointerResult(fh,Number.MAX_SAFE_INTEGER,0);
 assert.equal(e.resize(fh),0);assert.equal(e.error(),8);assert.equal(e.get_esp(),0x300008);assert.equal(f.getFileSize(fh),1);
 f.setFilePointer(fh,0,0);const read=new Uint8Array(1);f.readFile(fh,read,1);assert.equal(read[0],0x74);
 console.log('PASS real resident write/read/truncate/zero extension, unallocatable write/resize refusal, Win32 BOOL/GetLastError/stack and retained bytes; no volume-capacity claim');
}
run().catch(e=>{console.error(e);process.exitCode=1});
