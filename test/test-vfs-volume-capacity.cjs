'use strict';
// A host allocation refusal is a guest filesystem error, never an emulator
// trap. This does not manufacture a volume quota or infer it from host disk.
const assert=require('node:assert/strict');
const {VirtualFS}=require('../lib/filesystem');
const {bootRenderHarness}=require('./render-helper');
const diskWat = ['A','W'].flatMap(encoding => [false,true].map(ex => {
 const name=`GetDiskFreeSpace${ex?'Ex':''}${encoding}`;
 return `(func (export "${name}") (param $p i32) (param $a i32) (param $b i32)
 (param $c i32) (param $d i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
 (global.set $last_error (i32.const 0x5678))
 (call $handle_${name} (local.get $p) (local.get $a) (local.get $b)
 (local.get $c) (local.get $d) (i32.const 0))
 (i32.load (global.get $reg_base)))`;
})).join('\n');
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
 const {exports:e,hostCtx}=await bootRenderHarness({fonts:'none',extraWat:diskWat+`
 (func (export "map_disk") (param $p i32) (result i32)
 (call $virtual_map_commit (local.get $p) (i32.const 4096)))
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
 // Exercise the compiled public A/W handlers, including outputs crossing
 // non-contiguous guest pages. No game media or external run data is needed.
 const p=0x30000000, out=p+4093;
 assert.equal(e.map_disk(p)>>>0,p);assert.equal(e.map_disk(0x28000000)>>>0,0x28000000);
 assert.equal(e.map_disk(p+4096)>>>0,p+4096);
 assert.notEqual(e.guest_to_wasm(p+4095)+1,e.guest_to_wasm(p+4096));
 f.dirs.add('c:\\nested');f.dirs.add('c:\\nested\\caf\u00e9');
 f.files.set('c:\\nested\\file.bin',{data:Uint8Array.of(1),attrs:0x20});
 f.driveTypes=new Map([['r',5]]);f.volumeSizes=new Map([['r',123]]);
 f.setDriveReadOnly('r',true);f.dirs.add('r:\\');f.dirs.add('r:\\disc');
 f.driveTypes.set('s',3);f.setDriveReadOnly('s',true);
 // File-backed mounts also register their roots without driveTypes metadata.
 f.ensureParentDirs('m:\\assets\\test.bin');
 const results=[],failures=[];
 for(const encoding of ['A','W']) for(const ex of [false,true]) {
  const name=`GetDiskFreeSpace${ex?'Ex':''}${encoding}`;
  const cases=[
   ['missing-drive','z:\\',0,3],['missing-drive-dir','z:\\missing',0,3],['empty-cd','d:\\',0,21],
   ['empty','',0,3],['malformed',':\\',0,3],
   ['root','C:\\',1],['null',null,1],['current-root','\\',1],
   ['nested','c:\\nested',ex?1:0,3],
   ['unicode','c:\\nested\\caf\u00e9',ex?1:0,3],
   ['missing-nested','c:\\nested\\missing',0,3],
   ['file','c:\\nested\\file.bin',0,3],
   ['drive-relative','c:',ex?1:0,3],
   ['relative','.',ex?1:0,3],['mounted-file-root','m:\\',1],
   ['readonly-mounted-root','s:\\',1],
   ['cd','r:\\',1],['cd-dir','r:\\disc',ex?1:0,3],
   ['cd-missing','r:\\missing',0,3],
   ['unc','\\\\missing\\share\\',0,3],['bad-drive','1:\\',0,3],
  ];
  for(const [label,s,want,error] of cases) for(const mask of [0,1,2,4,7,...(ex?[]:[8,15])]) {
   if(s!==null) for(let i=0;i<=s.length;i++) {
    const c=i<s.length?s.charCodeAt(i):0;
    e.guest_write8(p+i*(encoding==='W'?2:1),c);
    if(encoding==='W') e.guest_write8(p+i*2+1,c>>8);
   }
   for(let i=-1;i<34;i++) e.guest_write8(out+i,0xcc);
   const stride=ex?8:4,ptrs=Array.from({length:4},(_,i)=>mask&(1<<i)?out+i*stride:0);
   const got=e[name](s===null?0:p,...ptrs),last=e.error();
   const actual=Array.from({length:35},(_,i)=>e.guest_read8(out-1+i));
   const expected=new Array(35).fill(0xcc),cd=label.startsWith('cd');
   const values=ex?(cd?[0n,251904n,0n]:[1073737728n,2147479552n,1073737728n]):
    (cd?[1n,2048n,0n,123n]:[8n,512n,262143n,524287n]);
   if(want) values.forEach((value,i)=>{if(ptrs[i]) for(let j=0;j<stride;j++)
    expected[1+i*stride+j]=Number(value>>BigInt(j*8)&255n);});
   const row={name,label,mask,got,last};results.push(row);
   try {
    assert.equal(got,want);assert.equal(last,want?0x5678:error);
    assert.deepEqual(actual,expected);assert.equal(e.get_esp(),0x300000+(ex?20:24));
   } catch(err) {failures.push({...row,message:err.message});}
  }
 }
 // NULL selects the current disk root even when CWD is a nested directory;
 // relative Ex paths and geometry must use that same mounted drive.
 f.cwd='R:\\disc';
 for(const encoding of ['A','W']) for(const ex of [false,true]) {
  const name=`GetDiskFreeSpace${ex?'Ex':''}${encoding}`;
  for(const s of [null,'\\',...(ex?['.','r:']:[])]) {
   if(s!==null) Buffer.from(s+'\0',encoding==='W'?'utf16le':'latin1')
    .forEach((b,i)=>e.guest_write8(p+i,b));
   assert.equal(e[name](s===null?0:p,out,0,0,0),1);
   assert.equal(e.guest_read32(out)>>>0,ex?0:1);
  }
  f.cwd='Z:\\missing';
  e.guest_write32(out,0xcccccccc);
  assert.equal(e[name](0,out,0,0,0),0);assert.equal(e.error(),3);
  assert.equal(e.guest_read32(out)>>>0,0xcccccccc);
  f.cwd='R:\\disc';
 }
 console.log(JSON.stringify({diskCases:results,failures}));
 assert.deepEqual(failures,[],'disk path validation must precede all caller output writes');
 console.log('PASS real resident write/read/truncate/zero extension, unallocatable write/resize refusal, Win32 BOOL/GetLastError/stack and retained bytes; no volume-capacity claim');
}
run().catch(e=>{console.error(e);process.exitCode=1});
