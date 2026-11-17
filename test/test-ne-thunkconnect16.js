'use strict';
// Compiled FAR PASCAL registration, lifetime and execution controls.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {neLifecycleImage}=require('./helpers/ne-lifecycle-image');

// Ordinary NE relocations, including the imported KERNEL.651 far CALL.
// No original media, patched header, or host-supplied success value.
function thunkImage({name='THUNK',checksum=0x13572468,magic='LS01',badTable=false,
  reject=false,trap=false,badInstance=false,badCs=false,module16=name+'.dll',
  module32='peer.dll',name32='Pair_ThunkData32',value=0x1234abcd,badReason=false,codeTable=false}={}) {
  const b=Buffer.alloc(0x1200),n=0x80;
  neLifecycleImage({importEntry:{module:'KERNEL',symbol:651}}).copy(b);
  const w=(p,v)=>b.writeUInt16LE(v,p),word=v=>[v&255,v>>>8&255];
  w(n+0x3e,0x400);w(n+4,0x100);w(n+6,21);w(n+0x26,0x120);
  w(n+0x42,0x600);w(n+0x46,0x600);w(n+0x48,0x90);
  w(n+0x4a,0x400);w(n+0x4c,0x101);w(n+0x4e,0x400);
  b.fill(0,n+0x60,n+0xb0);
  b.set([4,1,1,0,0,1,16,0,1,32,0,1,64,0,1,2,1,0,0,0,0],n+0x100);
  let p=n+0x120;
  for(const [s,o] of [['WEP',3],['VALUE',2],['DLLENTRYPOINT',4],['THUNKDATA16',5]]) {
    b[p++]=s.length;b.write(s,p);p+=s.length;w(p,o);p+=2;
  }
  w(n+0x28,0x160);w(n+0x2a,0x170);w(n+0x160,0);
  b[n+0x170]=6;b.write('KERNEL',n+0x171);
  b.fill(0,0x200,0x800);
  b.set([0xb8,1,0,0xcb],0x200);
  // The target has a distinctive long return, proving ordinary x86 execution.
  b.set([0xff,6,0xac,0,0xb8,...word(value),0xba,...word(value>>>16),0xcb],0x210);
  b.set([0xb8,1,0,0xca,2,0],0x220);
  b.write(magic,0x900);b.writeUInt32LE(checksum,0x904);
  w(0x908,0xffff);w(0x920,0xffff);
  b.write(module16+'\0',0x940);b.write(module32+'\0',0x960);
  b.write(name32+'\0',0x980);
  // Remember hInstance, then pass all seven args left to right. CS is an
  // actual owned code selector. Verify SP and DX:AX after the 24-byte return.
  const c=[0x55,0x89,0xe5,0x89,0x26,0xa0,0,0x8b,0x46,0x10,0xa3,0xa2,0];
  const push=v=>c.push(0x68,...word(v));
  c.push(0x1e);push(0x40);c.push(0x1e);push(0x60);
  if(badInstance)push(0);else c.push(0xff,0x76,0x10);
  if(badReason)c.push(0x66,0x68,1,0,1,0);else c.push(0x66,0xff,0x76,0x12);
  c.push(0x1e);push(0);c.push(0x1e);push(0x80);c.push(badCs?0x1e:0x0e,0xba,0xef,0xbe,0x9a);
  const api=0x40+c.length;c.push(0xff,0xff,0,0);
  c.push(0x3b,0x26,0xa0,0,0x74,2,0x0f,0x0b);
  c.push(0x83,0xfa,0,0x74,2,0x0f,0x0b); // full UINT result clears DX
  c.push(0xa3,0xa4,0,0x89,0x16,0xa6,0);
  // A repeated attach can fail AFTER acquiring the native link.
  c.push(0x83,0x7e,0x12,0,0x74,9,0x83,0x3e,0xa8,0,0,0x74,2,0x33,0xc0);
  if(trap)c.push(0x0f,0x0b);
  if(reject)c.push(0x33,0xc0);
  c.push(0x5d,0xca,16,0);b.set(c,0x240);
  // Header->table and table->VALUE are internal FAR_ADDR relocations.
  w(0x800,codeTable?2:1);b.set([3,1,...word(api),1,0,0x8b,2],0x802);
  if(codeTable){w(0x500,0xffff);b.set([3,0,0,3,1,0,16,0],0x80a);}
  w(0xd00,codeTable?1:2);b.set([3,0,8,0,codeTable?1:2,0,...word(codeTable?0x300:badTable?0x3ff:0x20)],0xd02);
  if(!codeTable)b.set([3,0,0x20,0,1,0,16,0],0xd0a);
  return b;
}

// Worker callExport intentionally only returns JS numbers. These test-only
// adapters preserve the small test token exactly across that numeric channel;
// production uses the original i64 token and ownership validation throughout.
const extraWat=String.raw`
  (func (export "ls_test_frame_begin") (result f64)
    (f64.convert_i64_u (call $win16_bridge_frame_begin)))
  (func (export "ls_test_invoke_result") (param $token i64) (result f64)
    (f64.convert_i64_s (call $win16_bridge_invoke_result (local.get $token))))
`;

async function compiledControls() {
  const wasm=process.env.WA_TEST_WASM ? fs.readFileSync(process.env.WA_TEST_WASM)
    : require('./compile-src').compileSrcWasm((file,source)=>file==='13-exports.wat'?source+extraWat:source);
  const {createHostImports}=require('../lib/host-imports');
  const {createNeLifecycle}=require('../lib/ne-lifecycle');
  const {neGuestCaller}=require('./helpers/ne-guest-caller');
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});
  imports.host.memory=memory;
  const e=(await WebAssembly.instantiate(wasm,imports)).instance.exports;
  const pe=neGuestCaller();new Uint8Array(memory.buffer).set(pe.bytes,e.get_staging());e.load_pe(pe.bytes.length);
  e.set_eip(pe.entry);e.set_esp(0x7408000);
  const state=()=>[e.get_eip(),e.get_esp(),e.get_sreg_cs(),e.get_sreg_ds(),e.get_sreg_ss(),e.get_sync_msg_depth()];
  const before=state();
  const life=createNeLifecycle(e,memory,[['THUNK',thunkImage()],['OTHER',thunkImage({name:'OTHER',checksum:0x24681357,value:0x56781234})]]);
  const a=life.load('THUNK'),b=life.load('OTHER');
  const read=(id,offset)=>{
    const t=e.win16_bridge_frame_begin();assert(t);assert(e.win16_bridge_scope_begin(t));
    const ds=e.win16_bridge_module_data(id);assert(ds);
    const value=new DataView(memory.buffer).getUint16(e.guest_to_wasm(e.win16_seg_base(ds>>>3)+offset)>>>0,true);assert(e.win16_bridge_frame_end(t));return value;
  };
  const pair={checksum:0x13572468,module32:'peer.dll',name32:'Pair_ThunkData32',index:0};
  const otherPair={...pair,checksum:0x24681357};
  assert.deepEqual(state(),before);
  assert.equal(life.call(a,'VALUE'),0x1234abcd);
  assert.equal(life.call(b,'VALUE'),0x56781234);
  assert.equal(life.callLs(a,'THUNKDATA16',pair),0x1234abcd);
  assert.equal(life.callLs(b,'THUNKDATA16',otherPair),0x56781234);
  assert.equal(createNeLifecycle(e,memory,[]).callLs(a,'THUNKDATA16',pair),0x1234abcd,
    'native registration survives replacing the JS coordinator');
  assert.equal(life.callLs(a,'THUNKDATA16',{...pair,module32:'PEER.DLL'}),0x1234abcd);
  const frame=e.win16_bridge_frame_begin();assert(frame);assert(e.win16_bridge_scope_begin(frame));
  const far=(e.win16_bridge_module_data(a)<<16)>>>0;
  // The native lookup packet lives only in this exact frame's bounded scratch.
  const put=(offset,text)=>{
    const bytes=new Uint8Array(memory.buffer,Number(frame&0xffffffffn)+offset,256);
    bytes.fill(0);bytes[0]=text.length;bytes.set(Buffer.from(text),1);
  };
  put(2048,pair.module32);put(2304,pair.name32);
  assert(e.win16_bridge_ls_target(frame,a,far,pair.checksum,0));
  assert.equal(e.win16_bridge_ls_target(frame,b,far,pair.checksum,0),0,'foreign module header');
  const tid=e.get_current_thread_id();e.set_current_thread_id(tid+19);
  assert.equal(e.win16_bridge_ls_target(frame,a,far,pair.checksum,0),0,'foreign thread');
  e.set_current_thread_id(tid);assert(e.win16_bridge_frame_end(frame));
  assert.equal(e.win16_bridge_ls_target(frame,a,far,pair.checksum,0),0,'retired frame');
  const countA=read(a,0xac),countB=read(b,0xac);
  for(const invalid of [{checksum:0},{module32:'foreign.dll'},
    {name32:'Foreign_ThunkData32'},{name32:'pair_ThunkData32'},{index:1},{index:-1},{index:0x10000}]) {
    assert.throws(()=>life.callLs(a,'THUNKDATA16',{...pair,...invalid}),/LS|index/);
  }
  assert.equal(read(a,0xac),countA,'rejected links execute no guest instruction');
  assert.equal(read(b,0xac),countB,'independent target is untouched');
  assert.equal(read(a,12),0,'native registration preserves the first-time field');
  // The guest uses this mutable word only to reject an attach after its real
  // KERNEL call has returned. A failed repeated attach must roll back just
  // that native registration, preserving the first consumer's executable link.
  assert.equal(life.load('THUNK'),a);
  life.release(a);assert.equal(life.callLs(a,'THUNKDATA16',pair),0x1234abcd);
  const edit=(id,offset,value)=>{
    const t=e.win16_bridge_frame_begin();assert(t);assert(e.win16_bridge_scope_begin(t));
    const ds=e.win16_bridge_module_data(id);assert(ds);
    e.guest_write16(e.win16_seg_base(ds>>>3)+offset,value);assert(e.win16_bridge_frame_end(t));
  };
  const farWord=(id,far,write)=>{
    const t=e.win16_bridge_frame_begin();assert(t);assert(e.win16_bridge_scope_begin(t));
    const base=e.win16_seg_base(far>>>19)+(far&65535);
    const at=e.guest_to_wasm(base)>>>0,view=new DataView(memory.buffer);
    const old=view.getUint32(at,true);if(write!==undefined)view.setUint32(at,write,true);
    assert(e.win16_bridge_frame_end(t));return old;
  };
  const dataFar=id=>{
    const t=e.win16_bridge_frame_begin();assert(t);assert(e.win16_bridge_scope_begin(t));
    const ds=e.win16_bridge_module_data(id);assert(e.win16_bridge_frame_end(t));return (ds<<16)>>>0;
  };
  const af=dataFar(a),bf=dataFar(b),tableA=farWord(a,af+8),tableB=farWord(b,bf+8);
  const targetA=farWord(a,tableA),targetB=farWord(b,tableB);
  farWord(a,tableA,targetB);assert.throws(()=>life.callLs(a,'THUNKDATA16',pair),/LS/);
  farWord(a,tableA,af);assert.throws(()=>life.callLs(a,'THUNKDATA16',pair),/LS/);
  farWord(a,tableA,targetA);
  farWord(a,af+8,tableB);assert.throws(()=>life.callLs(a,'THUNKDATA16',pair),/LS/);
  farWord(a,af+8,tableA);assert.equal(life.callLs(a,'THUNKDATA16',pair),0x1234abcd);
  edit(a,0xa8,1);assert.throws(()=>life.load('THUNK'),/AX zero/);
  assert.equal(life.callLs(a,'THUNKDATA16',pair),0x1234abcd);
  edit(a,0xa8,0);
  edit(a,4,0);assert.throws(()=>life.callLs(a,'THUNKDATA16',pair),/LS/);
  edit(a,4,0x2468);assert.equal(life.callLs(a,'THUNKDATA16',pair),0x1234abcd);
  life.release(a);assert.equal(life.callLs(b,'THUNKDATA16',otherPair),0x56781234);
  life.release(b);assert.deepEqual(state(),before);
  assert.throws(()=>life.callLs(a,'THUNKDATA16',pair),/LS|unavailable/);
  for(const [name,options] of [['MAGIC',{magic:'SL01'}],['EXTENT',{badTable:true}],
    ['REJECT',{reject:true}],['TRAP',{trap:true}],['INSTANCE',{badInstance:true}],
    ['CODE',{badCs:true}],['MODNAME',{module16:'foreign.dll'}],
    ['PEERNAME',{module32:''}],['EXPORTNAME',{name32:''}],['REASON',{badReason:true}]]) {
    const broken=createNeLifecycle(e,memory,[[name,thunkImage({name,...options})]]);
    assert.throws(()=>broken.load(name));assert.equal(broken.liveModule(name),false);
    assert.deepEqual(state(),before);
    const repaired=createNeLifecycle(e,memory,[[name,thunkImage({name})]]);
    const id=repaired.load(name);assert.equal(repaired.callLs(id,'THUNKDATA16',pair),0x1234abcd);
    repaired.release(id);
  }
  for(const [name,options] of [['CODETABLE',{codeTable:true}],['ZEROSUM',{checksum:0}],['HIGHSUM',{checksum:0xfedcba98}]]) {
    const good=createNeLifecycle(e,memory,[[name,thunkImage({name,...options})]]),id=good.load(name);
    assert.equal(good.callLs(id,'THUNKDATA16',{...pair,checksum:options.checksum??pair.checksum}),0x1234abcd);
    good.release(id);assert.deepEqual(state(),before);
  }
  let inAttach=false,reentered=false,reentrant;
  const reentryOwner={...e,
    win16_bridge_ls_notify_begin(...args){inAttach=true;return e.win16_bridge_ls_notify_begin(...args);},
    run(blocks){if(inAttach&&!reentered){reentered=true;assert.throws(()=>reentrant.load('REENTER'),/busy|unavailable|scope|frame/);}return e.run(blocks);}};
  reentrant=createNeLifecycle(reentryOwner,memory,[['REENTER',thunkImage({name:'REENTER'})]]);
  const rid=reentrant.load('REENTER');assert(reentered);
  assert.equal(reentrant.callLs(rid,'THUNKDATA16',pair),0x1234abcd);reentrant.release(rid);
  assert.deepEqual(state(),before);
  let notifying=false;
  const cancel=new AbortController();
  const cancelled={...e,
    win16_bridge_ls_notify_begin(...args){notifying=true;return e.win16_bridge_ls_notify_begin(...args);},
    run(blocks){const result=e.run(blocks);if(notifying&&!cancel.signal.aborted)cancel.abort(new Error('cancel native LS attach'));return result;}};
  const cancelledLife=createNeLifecycle(cancelled,memory,[['CANCEL',thunkImage({name:'CANCEL'})]],{signal:cancel.signal});
  assert.throws(()=>cancelledLife.load('CANCEL'),/cancel/);
  assert.equal(life.liveModule('CANCEL'),false);assert.deepEqual(state(),before);
  const replacement=createNeLifecycle(e,memory,[['CANCEL',thunkImage({name:'CANCEL'})]]);
  const replacementId=replacement.load('CANCEL');assert.equal(replacement.callLs(replacementId,'THUNKDATA16',pair),0x1234abcd);
  replacement.release(replacementId);

  const {ThreadManager}=require('../lib/thread-manager');
  const {GuestThreadHost}=require('../lib/guest-thread-host');
  const path=require('node:path');
  const module=await WebAssembly.compile(wasm);
  const secondary=(await WebAssembly.instantiate(module,imports)).exports;
  secondary.init_thread(1,e.get_image_base(),e.get_code_start(),e.get_code_end(),e.get_thunk_base(),e.get_thunk_end(),e.get_num_thunks(),0);
  const manager=new ThreadManager(module,memory,{exports:e},()=>imports,{});
  const thread={instance:{exports:secondary},state:'active',tid:1};
  manager.threads=new Map([[123,thread]]);manager._runningThreadHandle=0;
  const facade=manager.cooperativeCallbackExports(thread);
  const cooperative=createNeLifecycle(facade,memory,[['COOP',thunkImage({name:'COOP'})]]);
  const cid=cooperative.load('COOP');assert.equal(cooperative.callLs(cid,'THUNKDATA16',pair),0x1234abcd);
  cooperative.release(cid);assert.deepEqual(state(),before);
  thread.state='exited';assert.throws(()=>cooperative.load('COOP'),/retired/);
  for(const mode of ['normal','other','cancel']) {
    const name=mode==='other'?'OTHER':'THUNK';
    const fixture=neGuestCaller(0x400000,{path:name+'.DLL',calls:[[35,[0x402840]]]});
    let started,release;const pending=new Promise(r=>started=r),gate=new Promise(r=>release=r);
    const host=new GuestThreadHost({memory,module,hostImports:imports.host,
      sigs:require('../lib/host-import-sigs.generated.json').sigs,
      workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0,
      findDll:async()=>{if(mode==='cancel'){started();await gate;}return thunkImage(mode==='other'?{name:'OTHER',checksum:otherPair.checksum,value:0x56781234}:{});},log:()=>{}});
    try {
      await host.start();await host.loadPe(fixture.bytes,'ls-caller.exe');
      await host.callExport('set_esp',0x7408000);await host.callExport('guest_write32',0x7408000,0);
      await host.callExport('set_eip',fixture.entry);
      const running=host.link.slice(1000),failure=running.then(()=>null,error=>error);
      if(mode==='cancel'){await pending;await host.stop();release();assert(await failure);}
      else {
        assert.equal(await failure,null);
        for(let i=0;i<30;i++) {
          if(!await host.callExport('get_eip'))break;
          const result=await host.link.slice(1000);assert(!result.trapped);assert(i<29);
        }
        assert.equal(await host.callExport('get_esp'),0x7408004);
        const remote=(name,...args)=>host.callExport(name,...args);
        const snapshot=async()=>Promise.all(['get_eip','get_esp','get_sreg_cs','get_sreg_ds','get_sreg_ss','get_sync_msg_depth'].map(n=>remote(n)));
        const saved=await snapshot(),outer=BigInt(await remote('ls_test_frame_begin'));assert(outer);
        assert(await remote('win16_bridge_scope_begin',outer));
        const handle=new DataView(memory.buffer).getUint32(await remote('guest_to_wasm',fixture.result),true);
        const id=await remote('win16_bridge_module_resolve',handle);assert(id);
        const ds=await remote('win16_bridge_module_data',id);assert(ds);
        for(const [offset,text] of [[2048,pair.module32],[2304,pair.name32]]) {
          const out=new Uint8Array(memory.buffer,Number(outer&0xffffffffn)+offset,256);
          out.fill(0);out[0]=text.length;out.set(Buffer.from(text),1);
        }
        const target=await remote('win16_bridge_ls_target',outer,id,(ds<<16)>>>0,mode==='other'?otherPair.checksum:pair.checksum,0);assert(target);
        const invocation=BigInt(await remote('ls_test_frame_begin'));assert(invocation);
        assert(await remote('win16_bridge_invoke_module',invocation,id));
        assert(await remote('win16_bridge_invoke_begin',invocation,target,ds,ds,0));
        await remote('run',256);
        assert.equal(await remote('ls_test_invoke_result',invocation),mode==='other'?0x56781234:0x1234abcd);
        assert(await remote('win16_bridge_frame_end',invocation));
        assert(await remote('win16_bridge_frame_end',outer));assert.deepEqual(await snapshot(),saved);
        // Ordinary compiled FreeLibrary16 through the PE's real EAT slot,
        // allowing the Worker's actual detach and final native cleanup.
        const at=await remote('guest_to_wasm',0x402500),code=Buffer.alloc(12);
        code[0]=0x68;code.writeUInt32LE(handle,1);code.set([0xff,0x15],5);code.writeUInt32LE(fixture.slots+4,7);code[11]=0xc3;
        new Uint8Array(memory.buffer,at,code.length).set(code);
        await remote('set_esp',0x7408000);await remote('guest_write32',0x7408000,0);await remote('set_eip',0x402500);
        for(let i=0;i<30;i++) {
          const freed=await host.link.slice(1000);assert(!freed.trapped);
          if(!await remote('get_eip'))break;assert(i<29);
        }
        assert.equal(await remote('get_eip'),0);assert.equal(await remote('get_esp'),0x7408004);
        const retired=BigInt(await remote('ls_test_frame_begin'));assert(await remote('win16_bridge_scope_begin',retired));
        assert.equal(await remote('win16_bridge_module_resolve',handle),0);
        assert(await remote('win16_bridge_frame_end',retired));

      }
    } finally {release?.();await host.stop();}
  }
  console.log('PASS compiled KERNEL.651 FAR PASCAL registration and independent module returns');
}
if(require.main===module)(async()=>{
  const {inspectNeDll}=require('../lib/ne-image');
  const image=inspectNeDll(thunkImage());
  assert.equal(image.dllEntryOrdinal,4);assert.equal(image.entries.get(5).segment,2);
  await compiledControls();
})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={thunkImage,extraWat};
