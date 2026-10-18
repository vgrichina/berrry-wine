#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { compileSrcWasm } = require('./compile-src');
const RPC = require('../lib/guest-rpc');
const { sigs } = require('../lib/host-import-sigs.generated.json');
const STACK = 0x300000;
const wrap = (name, n, stdcall = false) => `
 (func (export "t_${name}") ${Array.from({length:n},(_,i)=>`(param $p${i} i32)`).join(' ')} (result i32)
  (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
  (call $handle_${name} ${Array.from({length:5},(_,i)=>i<n?`(local.get $p${i})`:'(i32.const 0)').join(' ')} (i32.const 0))
  (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.const ${STACK+4+(stdcall?n*4:0)})) (then (unreachable)))
  (i32.load (global.get $reg_base)))`;
const extraWat = `
 (func (export "t_init")
  (global.set $image_base (i32.const 0))
  (global.set $thunk_guest_base (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
 (func (export "t_count") (result i32)
  (local $n i32) (local $rec i32)
  (local.set $rec (i32.load offset=8 (global.get $CRT_STREAM_STATE)))
  (block $done (loop $each (br_if $done (i32.eqz (local.get $rec)))
    (local.set $n (i32.add (local.get $n) (i32.const 1)))
    (local.set $rec (call $gl32 (local.get $rec))) (br $each))) (local.get $n))
 (func (export "t_cleanup") (call $crt_stream_close_all))
 (func (export "t_lookup") (param $file i32) (result i32) (call $crt_stream_lookup (local.get $file)))
 ${wrap('_open',2)} ${wrap('_fdopen',2)} ${wrap('_read',3)} ${wrap('_write',3)}
 ${wrap('_lseek',3)} ${wrap('_close',1)} ${wrap('_dup',1)} ${wrap('_errno',0)}
 ${wrap('fread',4)} ${wrap('fwrite',4)} ${wrap('fclose',1)} ${wrap('fseek',3)}
 ${wrap('freopen',3)} ${wrap('LoadLibraryA',1,true)} ${wrap('GetProcAddress',2,true)}
`;
(async () => {
 let h, race = null;
 h = await bootRenderHarness({ extraWat, fonts:'none', extraHostOverrides: {
  crash_unimplemented: () => {},
  fs_crt_descriptor_adopt: (fd,rights,append,owner) => {
   const v = h.hostCtx.vfs;
   if (race === 'before') v.closeHandle(fd);
   const result = v.adoptCrtDescriptor(fd,rights,append,owner);
   if (race === 'after') v.closeHandle(fd);
   return result;
  },
 }});
 const e=h.exports, v=h.hostCtx.vfs;
 // Instantiate the sibling before initializing process memory, as real Worker
 // setup must not reapply active segments after application state is live.
 const broker=RPC.createMainBroker(h.memory,h.host,sigs,{});
 const remote=RPC.createWorkerImports(h.memory,sigs,msg=>broker.serveRpc(msg.slot),{slot:3});
 const siblingHost={...h.host};
 for(const name of ['fs_crt_open','fs_crt_descriptor_query','fs_crt_descriptor_adopt']) {
  siblingHost[name]=remote.imports.host[name];
 }
 const sibling=new WebAssembly.Instance(h.module,{host:siblingHost,gdi:h.gdi}).exports;
 e.t_init(); sibling.t_init();
 const PATH=0x1000, MODE=0x1100, BUF=0x2000, DLL=0x12000, NAME=0x12100;
 const put=(p,s)=>Buffer.from(s+'\0').forEach((b,i)=>e.guest_write8(p+i,b));
 const bytes=()=>Buffer.from(v.files.get('c:\\fdopen.dat').data).toString();
 put(PATH,'c:\\fdopen.dat'); put(MODE,'r+b');
 const raw=v.createFile('c:\\fdopen.dat',0xc0000000,2);
 v.writeFile(raw,Buffer.from('abcdef'),6); v.closeHandle(raw);
 const errno=e.t__errno();
 const fd=e.t__open(PATH,0x8002), dup=e.t__dup(fd);
 assert.equal(e.t__lseek(fd,2,0),2);
 const handles=v.handles.size;
 const f=e.t__fdopen(fd,MODE);
 assert(f>0); assert.equal(e.guest_read32(f+16),fd);
 assert.equal(v.handles.size,handles,'adoption creates no VFS handle');
 assert.equal(v.getOpenFile(fd).pos,2,'adoption does not seek');
 assert.equal(bytes(),'abcdef','adoption does not truncate');
 assert.equal(sibling.t_lookup(f),e.t_lookup(f),'same-process instance sees ownership');
 assert.equal(e.t__read(fd,BUF,1),1); assert.equal(e.guest_read8(BUF),99);
 assert.equal(e.t_fread(BUF,1,1,f),1); assert.equal(e.guest_read8(BUF),100);
 assert.equal(e.t_fseek(f,1,0),0);
 put(BUF,'XY'); assert.equal(e.t_fwrite(BUF,1,2,f),2);
 assert.equal(e.t__lseek(dup,0,0),0);
 assert.equal(e.t__read(dup,BUF,6),6); assert.equal(bytes(),'aXYdef');
 assert.equal(e.t__fdopen(fd,MODE),0,'one owner per descriptor');
 assert.equal(e.guest_read32(errno),22);
 // A duplicate created after adoption must not inherit FILE ownership.
 const afterDup=e.t__dup(fd), afterFile=e.t__fdopen(afterDup,MODE);
 assert(afterFile>0); assert.equal(e.t_fclose(afterFile),0);
 assert.equal(sibling.t_fclose(f),0,'other instance closes exactly adopted fd');
 assert.equal(e.t__read(fd,BUF,1),-1); assert.equal(e.t_fclose(f),-1);
 assert.equal(e.t__lseek(dup,0,0),0); assert.equal(e.t__read(dup,BUF,1),1);
 assert.equal(e.t__close(dup),0);
 assert.equal(e.t_count(),0);

 // w and w+ are access selection, never a request to truncate an existing fd.
 for (const mode of ['wb','w+b','wb+']) {
  const d=e.t__open(PATH,0x8002); e.t__lseek(d,3,0); put(MODE,mode);
  const s=e.t__fdopen(d,MODE); assert(s>0);
  assert.equal(bytes(),'aXYdef'); assert.equal(v.getOpenFile(d).pos,3);
  assert.equal(e.t_fclose(s),0);
 }
 for (const [flags,mode,error] of [[0x8000,'wb',13],[0x8001,'rb',13],[0x8000,'r+b',13],[0x8001,'w+b',13]]) {
  const d=e.t__open(PATH,flags); v.setFilePointer(d,2,0); put(MODE,mode);
  assert.equal(e.t__fdopen(d,MODE),0); assert.equal(e.guest_read32(errno),error);
  assert.equal(v.getOpenFile(d).pos,2); assert.equal(v.getOpenFile(d).crtStreamOwner,undefined);
  assert.equal(bytes(),'aXYdef'); assert.equal(e.t_count(),0); e.t__close(d);
 }
 const d=e.t__open(PATH,0x8002);
 for (const mode of ['', 'br','rbb','r++','rbt','rbx','rb+extra']) {
  put(MODE,mode); assert.equal(e.t__fdopen(d,MODE),0); assert.equal(e.guest_read32(errno),22);
  assert.equal(e.t_count(),0); assert.equal(v.getOpenFile(d).crtStreamOwner,undefined);
 }
 assert.equal(e.t__fdopen(d,0),0); assert.equal(e.guest_read32(errno),22);
 for (const mode of ['r','r+','rt','r+t','ab']) {
  put(MODE,mode); assert.throws(()=>e.t__fdopen(d,MODE),WebAssembly.RuntimeError);
  assert.equal(e.t_count(),0); assert.equal(v.getOpenFile(d).crtStreamOwner,undefined);
 }
 e.t__close(d); put(MODE,'rb');
 for (const invalid of [d,0,1,2,-1,0x70001234]) {
  assert.equal(e.t__fdopen(invalid,MODE),0); assert.equal(e.guest_read32(errno),9);
 }
 const foreign=v.createFile('c:\\fdopen.dat',0xc0000000,3);
 assert.equal(e.t__fdopen(foreign,MODE),0); assert(v.getOpenFile(foreign)); v.closeHandle(foreign);
 for (const flags of [0,0x4000]) {
  const text=e.t__open(PATH,flags);
  assert.throws(()=>e.t__fdopen(text,MODE),WebAssembly.RuntimeError);
  assert.equal(v.getOpenFile(text).crtStreamOwner,undefined); e.t__close(text);
 }
 for (const mode of ['ab','a+b','ab+']) {
  const a=e.t__open(PATH,0x800a); put(MODE,mode); e.t__lseek(a,1,0);
  const s=e.t__fdopen(a,MODE); assert(s>0); assert.equal(v.getOpenFile(a).pos,1);
  put(BUF,'!'); assert.equal(e.t_fwrite(BUF,1,1,s),1);
  e.t_fseek(s,0,0); assert.equal(e.t_fwrite(BUF,1,1,s),1);
  assert.equal(e.t_fclose(s),0);
 }
 assert.equal(bytes(),'aXYdef!!!!!!');
 // Deterministic close interleavings around the actual atomic host operation.
 for (race of ['before','after']) {
  const closed=e.t__open(PATH,0x8002); put(MODE,'rb');
  const s=e.t__fdopen(closed,MODE);
  if (race==='before') { assert.equal(s,0); assert.equal(e.guest_read32(errno),9); }
  else { assert(s>0); assert.equal(e.t_fread(BUF,1,1,s),0); assert.equal(e.t_fclose(s),-1); }
  assert.equal(e.t_count(),0);
 }
 race=null;
 const reopen=e.t__open(PATH,0x8002); put(MODE,'rb');
 const reopened=e.t__fdopen(reopen,MODE); put(MODE,'r');
 assert.equal(e.t_freopen(PATH,MODE,reopened),reopened);
 assert.equal(v.queryCrtDescriptor(reopen),0); assert.equal(e.t_fclose(reopened),0);
 const cleanup=e.t__open(PATH,0x8002); put(MODE,'rb'); assert(e.t__fdopen(cleanup,MODE)>0);
 e.t_cleanup(); assert.equal(v.queryCrtDescriptor(cleanup),0); assert.equal(e.t_count(),0);

 // A second actual WAT instance routes open/query/adopt through the real
 // synchronous broker. It publishes an ordinary FILE consumed by the main
 // instance, not a synthetic reservation or fabricated stream object.
 const syncBefore=remote.stats.sync;
 const brokerFd=sibling.t__open(PATH,0x8000); put(MODE,'rb');
 const brokerFile=sibling.t__fdopen(brokerFd,MODE); assert(brokerFile>0);
 assert.equal(v.getOpenFile(brokerFd).crtStreamOwner,brokerFile);
 assert(remote.stats.sync>=syncBefore+3,'open, query and adoption crossed the broker');
 assert.equal(e.t_fread(BUF,1,1,brokerFile),1); assert.equal(e.guest_read8(BUF),97);
 assert.equal(e.t_fclose(brokerFile),0); assert.equal(v.queryCrtDescriptor(brokerFd),0);

 put(DLL,'CRTDLL.DLL'); put(NAME,'_fdopen');
 const module=e.t_LoadLibraryA(DLL); assert(module!==0);
 const proc=e.t_GetProcAddress(module,NAME);
 assert(proc!==0,'real CRTDLL dynamic fallback resolves fdopen');
 const dynamicFd=e.t__open(PATH,0x8000); put(MODE,'rb');
 e.call_func(proc,dynamicFd,MODE,0,0);
 for(let i=0;i<20&&e.get_eip();i++) e.run(1000);
 assert.equal(e.get_eip(),0,'resolved fdopen thunk returns to caller');
 const dynamicFile=e.get_eax(); assert(dynamicFile>0);
 assert.equal(e.guest_read32(dynamicFile+16),dynamicFd);
 assert.equal(e.t_fclose(dynamicFile),0);

 // OOM fault injection changes ONLY fdopen's allocation size to an impossible
 // request; the real allocator refuses it. No fake FILE or fake return value.
 let replacements=0;
 const oomBytes=compileSrcWasm((name,source)=>{
  if(name==='13-exports.wat') return source+extraWat;
  if(name!=='09a6-handlers-crt.wat') return source;
  const start=source.indexOf('  (func $crt_fdopen ('), end=source.indexOf('  (func $handle__fdopen',start);
  const target=source.slice(start,end), needle='(call $heap_alloc (i32.const 48))';
  assert.equal(target.split(needle).length,2); replacements++;
  return source.slice(0,start)+target.replace(needle,'(call $heap_alloc (i32.const -1))')+source.slice(end);
 });
 assert(replacements>=1);
 const oomMemory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const {createHostImports}=require('../lib/host-imports');
 const ctx={getMemory:()=>oomMemory.buffer,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}},onExit:()=>{}};
 const imports=createHostImports(ctx); imports.host.memory=oomMemory;
 const o=(await WebAssembly.instantiate(oomBytes,imports)).instance.exports; ctx.exports=o; o.t_init();
 Buffer.from('c:\\oom.dat\0').forEach((b,i)=>o.guest_write8(PATH+i,b));
 Buffer.from('rb\0').forEach((b,i)=>o.guest_write8(MODE+i,b));
 const err=o.t__errno(), od=o.t__open(PATH,0x8102);
 assert.equal(o.t__fdopen(od,MODE),0); assert.equal(o.guest_read32(err),12);
 assert.equal(o.t_count(),0); assert(ctx.vfs.getOpenFile(od));
 assert.equal(ctx.vfs.getOpenFile(od).crtStreamOwner,undefined); assert.equal(o.t__close(od),0);
 console.log('CRT fdopen real I/O, lifecycle, failure and dynamic resolution: PASS');
})().catch(error=>{console.error(error);process.exit(1);});
