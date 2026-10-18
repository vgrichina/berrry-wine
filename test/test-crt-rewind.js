#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {bootRenderHarness}=require('./render-helper');
const RPC=require('../lib/guest-rpc');
const {sigs}=require('../lib/host-import-sigs.generated.json');
const STACK=0x700000, SENTINEL=0x13579bdf;
const wrap=(name,n,stdcall=false)=>`
 (func (export "t_${name}") ${Array.from({length:n},(_,i)=>`(param $p${i} i32)`).join(' ')} (result i32)
  (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
  (call $handle_${name} ${Array.from({length:5},(_,i)=>i<n?`(local.get $p${i})`:'(i32.const 0)').join(' ')} (i32.const 0))
  (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.const ${STACK+4+(stdcall?n*4:0)})) (then (unreachable)))
  (i32.load (global.get $reg_base)))`;
const extraWat=`
 (func (export "t_init")
  (global.set $image_base (i32.const 0x400000))
  (global.set $thunk_guest_base (i32.add (i32.const 0x400000)
    (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE)))))
 (func (export "t_iob") (result i32) (call $crt_iob_ensure))
 (func (export "t_rewind") (param $f i32)
  (i32.store offset=0 (global.get $reg_base) (i32.const ${SENTINEL}))
  (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
  (call $gs32 (i32.const ${STACK+4}) (local.get $f))
  (call $gs32 (i32.const ${STACK+8}) (i32.const ${SENTINEL}))
  (call $handle_rewind (local.get $f) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (if (i32.ne (i32.load (global.get $reg_base)) (i32.const ${SENTINEL})) (then (unreachable)))
  (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.const ${STACK+4})) (then (unreachable)))
  (if (i32.ne (call $gl32 (i32.const ${STACK+4})) (local.get $f)) (then (unreachable)))
  (if (i32.ne (call $gl32 (i32.const ${STACK+8})) (i32.const ${SENTINEL})) (then (unreachable))))
 ${wrap('fopen',2)} ${wrap('fclose',1)} ${wrap('fread',4)} ${wrap('fwrite',4)}
 ${wrap('fseek',3)} ${wrap('ftell',1)} ${wrap('feof',1)} ${wrap('ferror',1)}
 ${wrap('_open',2)} ${wrap('_fdopen',2)} ${wrap('_close',1)} ${wrap('_dup',1)}
 ${wrap('_lseek',3)} ${wrap('_errno',0)} ${wrap('LoadLibraryA',1,true)} ${wrap('GetProcAddress',2,true)}
`;
(async()=>{
 const h=await bootRenderHarness({extraWat,fonts:'none',extraHostOverrides:{crash_unimplemented:()=>{}}});
 const e=h.exports,v=h.hostCtx.vfs;
 const broker=RPC.createMainBroker(h.memory,h.host,sigs,{});
 const remote=RPC.createWorkerImports(h.memory,sigs,msg=>broker.serveRpc(msg.slot),{slot:3});
 const sibling=new WebAssembly.Instance(h.module,{host:{...h.host,fs_seek_result:remote.imports.host.fs_seek_result},gdi:h.gdi}).exports;
 e.t_init(); sibling.t_init();
 const PATH=0x401000,MODE=0x401100,BUF=0x402000,DLL=0x418000,NAME=0x418100,COPY=0x419000;
 const put=(p,s)=>Buffer.from(s+'\0').forEach((b,i)=>e.guest_write8(p+i,b));
 const u32=p=>e.guest_read32(p)>>>0;
 const snapshot=f=>Array.from({length:32},(_,i)=>e.guest_read8(f+i));
 put(PATH,'c:\\rewind.dat'); put(MODE,'wb+');
 const f=e.t_fopen(PATH,MODE); assert(f>0); const fd=u32(f+16);
 put(BUF,'abc'); assert.equal(e.t_fwrite(BUF,1,3,f),3);
 assert(u32(f+12)&2,'update stream acquired write direction');
 const bytes=()=>Buffer.from(v.files.get('c:\\rewind.dat').data).toString();
 assert.equal(bytes(),'abc','unbuffered write already flushed');
 const errno=e.t__errno(); e.guest_write32(errno,123);
 const calls=remote.stats.sync; sibling.t_rewind(f);
 assert(remote.stats.sync>calls,'actual rewind seek crosses synchronous broker');
 assert.equal(e.t_ftell(f),0); assert.equal(u32(f+12),0x84,'update direction cleared');
 assert.equal(u32(f+4),0); assert.equal(u32(f),f+20); assert.equal(u32(f+8),f+20);
 assert.equal(e.guest_read32(errno),123,'successful rewind leaves errno alone');
 assert.equal(bytes(),'abc'); assert.equal(e.t_fread(BUF,1,3,f),3); assert.equal(e.guest_read8(BUF),97);
 assert.equal(e.t_fread(BUF,1,1,f),0); assert(e.t_feof(f));
 e.t_rewind(f); assert.equal(e.t_feof(f),0); assert.equal(e.t_ftell(f),0);
 assert.equal(e.t_fclose(f),0);

 // Produce EOF and stream error through real I/O, rather than pre-setting bits.
 put(MODE,'rb'); const r=e.t_fopen(PATH,MODE); const rfd=u32(r+16);
 assert.equal(e.t_fread(BUF,1,9,r),3); assert(e.t_feof(r));
 assert.equal(e.t_fwrite(BUF,1,1,r),0); assert(e.t_ferror(r));
 assert.equal(e.t_fseek(r,0,0),0); assert(e.t_ferror(r),'fseek intentionally retains error');
 assert.equal(e.t_fread(BUF,1,9,r),3); assert(e.t_feof(r));
 const dup=e.t__dup(rfd); e.t_rewind(r);
 assert.equal(e.t_feof(r),0); assert.equal(e.t_ferror(r),0); assert.equal(e.t__lseek(dup,0,1),0);
 assert.equal(e.t_fread(BUF,1,1,r),1); assert.equal(e.guest_read8(BUF),97);
 assert.equal(e.t__close(dup),0);

 // A real closed fd still has its FILE record: seek fails but rewind clears
 // both indicators and reports EBADF through the existing errno cell.
 assert.equal(e.t_fread(BUF,1,9,r),2); assert(e.t_feof(r));
 assert.equal(e.t__close(rfd),0); assert.equal(e.t_fread(BUF,1,1,r),0); assert(e.t_ferror(r));
 e.t_rewind(r); assert.equal(e.t_feof(r),0); assert.equal(e.t_ferror(r),0);
 assert.equal(e.guest_read32(errno),9); assert.equal(e.t_fclose(r),-1);

 put(MODE,'rb'); const reject=e.t_fopen(PATH,MODE); e.t_fread(BUF,1,1,reject);
 const rejectFd=u32(reject+16), before=snapshot(reject);
 for(const [offset,value] of [[4,1],[4,-1],[12,u32(reject+12)|8],[0,reject+21],[8,BUF],[16,rejectFd+1],[24,4096]]) {
  const old=u32(reject+offset); e.guest_write32(reject+offset,value);
  const altered=snapshot(reject),pos=v.getOpenFile(rejectFd).pos;
  assert.throws(()=>e.t_rewind(reject),WebAssembly.RuntimeError);
  assert.deepEqual(snapshot(reject),altered); assert.equal(v.getOpenFile(rejectFd).pos,pos);
  e.guest_write32(reject+offset,old);
 }
 assert.deepEqual(snapshot(reject),before);
 before.forEach((b,i)=>e.guest_write8(COPY+i,b));
 assert.throws(()=>e.t_rewind(COPY),WebAssembly.RuntimeError); assert.deepEqual(snapshot(COPY),before);
 assert.throws(()=>e.t_rewind(0),WebAssembly.RuntimeError);
 const input=e.t_iob(),inputBefore=snapshot(input);
 assert.throws(()=>e.t_rewind(input),WebAssembly.RuntimeError); assert.deepEqual(snapshot(input),inputBefore);
 assert.equal(e.t_fclose(reject),0); assert.throws(()=>e.t_rewind(reject),WebAssembly.RuntimeError);

 // Preserve append ownership/mode: rewinding affects reads, not future append writes.
 const a=e.t__open(PATH,0x800a); put(MODE,'a+b'); const af=e.t__fdopen(a,MODE); assert(af>0);
 e.t_rewind(af); assert.equal(e.t__lseek(a,0,1),0); put(BUF,'!');
 assert.equal(e.t_fwrite(BUF,1,1,af),1); assert.equal(bytes(),'abc!'); e.t_fclose(af);

 let providerReads=0;
 v.setProviderFile('c:\\lazy-rewind.dat',{provider:{size:7,
  readRangeSync(){providerReads++;throw Error('rewind fetched provider');},
  readRange(){providerReads++;throw Error('rewind fetched provider');}}});
 put(PATH,'c:\\lazy-rewind.dat'); put(MODE,'rb');
 const lazy=e.t__open(PATH,0x8000),lf=e.t__fdopen(lazy,MODE); assert(lf>0);
 assert.equal(e.t__lseek(lazy,3,0),3); e.t_rewind(lf);
 assert.equal(e.t__lseek(lazy,0,1),0); assert.equal(providerReads,0); e.t_fclose(lf);

 put(PATH,'c:\\rewind.dat'); put(MODE,'rb'); const dynamic=e.t_fopen(PATH,MODE);
 e.t_fread(BUF,1,9,dynamic); assert(e.t_feof(dynamic));
 put(DLL,'CRTDLL.DLL'); put(NAME,'rewind'); const module=e.t_LoadLibraryA(DLL); assert(module!==0);
 const proc=e.t_GetProcAddress(module,NAME); assert(proc!==0);
 e.call_func(proc,dynamic,0,0,0); for(let i=0;i<20&&e.get_eip();i++)e.run(1000);
 assert.equal(e.get_eip(),0); assert.equal(e.t_ftell(dynamic),0); assert.equal(e.t_feof(dynamic),0);
 assert.equal(e.t_fread(BUF,1,1,dynamic),1); assert.equal(e.guest_read8(BUF),97); e.t_fclose(dynamic);
 console.log('CRT rewind real I/O, flags, failures, cdecl and dynamic thunk: PASS');
})().catch(error=>{console.error(error);process.exit(1);});
