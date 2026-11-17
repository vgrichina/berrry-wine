'use strict';
// Independently authored packed x86 caller and executable NE targets. The
// original DSETUPE packet has eight DWORDs and a WORD below 64 scratch bytes.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {ftImages}=require('./test-native-ft-relay');
const u16=n=>[n&255,n>>>8&255],u32=n=>[...u16(n),...u16(n>>>16)];
const ARGS=[0x90001a3f,0,0,0x17b908,0x1fd4ec,0x1fd5f0,0x1751f4,0x200000];
function qtImages({index=1,cleanup=34,failure=null,mapped=false,...options}={}) {
  const f=ftImages({index,...options}),q=f.data+36;
  const packet=Buffer.alloc(34);ARGS.forEach((n,i)=>packet.writeUInt32LE(n,i*4));packet.writeUInt16LE(10,32);
  const c=[];
  if(mapped) {
    for(const [old,name,rva] of [['FT_Exit56','MapLS',0x1bc0],['FT_Exit52','UnMapLS',0x1be0]]) {
      f.bytes.writeUInt32LE(rva,f.raw(0x1900+f.imports.indexOf(old)*4));f.bytes.write(name+'\0',f.raw(rva+2));
    }
    c.push(0x68,...u32(f.log+200),0xff,0x15,...u32(f.iat('FT_Exit56')),0xa3,...u32(f.log+204));
    f.bytes.writeUInt32LE(0x24681357,f.raw(0x2a00+200));
    f.bytes.set([0xff,0x35,...u32(f.log+204),0xff,0x15,...u32(f.iat('FT_Exit52')),0xc3],f.raw(0x2d00));
  }
  c.push(0xb9,...u32(0x10000|index),0x55,0x89,0xe5,0x51,0x83,0xec,60,0x66,0x68,10,0);
  for(let i=7;i>=0;i--)c.push(...(mapped&&i===0?[0xff,0x35,...u32(f.log+204)]:[0x68,...u32(ARGS[i])]));
  // Genuine call form CALL [absolute pointer], independent of the relay.
  f.bytes.writeUInt32LE(q,f.raw(0x29c0));
  c.push(0xff,0x15,...u32(f.base+0x29c0));
  const body=f.invoke+c.length;
  c.push(0xc1,0xe0,16,0x0f,0xac,0xd0,16,0xc9,0xc2,36,0);
  f.bytes.fill(0xcc,f.raw(0x2600),f.raw(0x2700));f.bytes.set(c,f.raw(0x2600));
  for(let n=0;n<2;n++) {
    const b=[];const emit=(...v)=>b.push(...v);
    // Assert entry registers, segments, each WORD of the original packet.
    // UD2 is intentional: INT3 has no exception semantics in this runtime.
    for(const modrm of [0xc0,0xd8,0xe0,0xe8])emit(0x8c,modrm,0x85,0xc0,0x74,2,0x0f,0x0b);
    emit(0x8c,0xd0,0x39,0xd0,0x74,2,0x0f,0x0b);
    emit(0x36,0x89,0x76,0xc8,0x36,0x89,0x7e,0xca,0x36,0x89,0x56,0xcc);
    emit(0x36,0x66,0xc7,0x46,0xc4,...u32(0xfacebeef));
    emit(0x55,0x89,0xe5);
    for(let i=mapped?2:0;i<17;i++)emit(0x36,0x81,0x7e,6+i*2,...u16(packet.readUInt16LE(i*2)),0x74,2,0x0f,0x0b);
    if(mapped)emit(0x36,0xc4,0x5e,6,0x26,0x66,0x81,0x3f,...u32(0x24681357),0x74,2,0x0f,0x0b,
      0x26,0x66,0xc7,7,...u32(0x7bcd4321));
    if(failure==='trap')emit(0x0f,0x0b);
    else if(failure==='loop')emit(0xeb,0xfe);
    else {
      if(failure==='bad-return')emit(0x36,0xc7,0x46,4,0,0);
      for(const [op,v] of [[0xb8,0x89abcdef+n],[0xba,0x12345678+n],[0xb9,0x76543210+n],
        [0xbb,0x11112222],[0xbe,0x33334444],[0xbf,0x55556666]])emit(0x66,op,...u32(v));
      emit(0x5d,0xca,...u16(cleanup));
    }
    // Independent code slots cannot overlap at the maximum packet length.
    assert(b.length<0x200);f.ne.set(b,0x200+(n?0x400:0x180));
  }
  // The existing executable extent is 0x600, table target1 is changed by a
  // normal NE relocation; no host-supplied target or result is installed.
  f.ne.writeUInt16LE(0x400,0xd18);
  f.ne.writeUInt16LE(1,0x800); // retain KERNEL.651, QT needs no DGROUP relocations
  return {...f,qt:q,body,packet,cleanup,failure};
}
async function main() {
  assert(process.env.WA_TEST_WASM,'explicit immutable module required');
  const bytes=fs.readFileSync(process.env.WA_TEST_WASM),module=await WebAssembly.compile(bytes);
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const {createHostImports}=require('../lib/host-imports');
  const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});imports.host.memory=memory;
  const e=(await WebAssembly.instantiate(module,imports)).exports;
  const {serviceNeGuestYieldSync,retireNativeFtConnections}=require('../lib/ne-guest-bridge');
  const ctx={exports:e,memoryBuffer:memory.buffer};
  const read=p=>e.guest_read32(p)>>>0;
  const records=[];
  const service=f=>serviceNeGuestYieldSync({...ctx,findDllSync:()=>f.ne,neInvokeOptions:{maxBlocks:4096,sliceBlocks:32}});
  function load(f) {
    new Uint8Array(memory.buffer).set(f.bytes,e.get_staging());assert.equal(e.load_pe(f.bytes.length),f.entry);
    e.invalidate_code_range(f.base,0x3000);e.set_eip(f.entry);e.set_esp(0x7408000);e.guest_write32(0x7408000,0);
    for(let i=0;i<100&&e.get_eip();i++){e.run(256);if(e.get_yield_reason()===18)assert(service(f));else assert.equal(e.get_yield_reason(),0);}
    assert.equal(e.get_eip(),0);assert.equal(read(f.result),1);
    assert.deepEqual(Array.from({length:8},(_,i)=>e.guest_read8(f.qt+i)),[0x33,0xc9,0x8a,0x4d,0xfc,0x8b,0x14,0x8d]);
    assert.deepEqual([e.guest_read8(f.qt+19),e.guest_read8(f.qt+20)],[0x0f,0x0b]);
  }
  function untilQt(f,shift=0) {
    e.set_eip(f.invoke);e.set_esp(0x74fd494+shift);e.guest_write32(0x74fd494+shift,0);
    for(let i=0;i<100;i++){e.run(1);if(e.get_yield_reason()===18){assert.equal(e.win16_guest_request_field(e.win16_guest_request_token(),0),4);return;}}
    throw Error('no QT request');
  }
  function retire(f) {
    retireNativeFtConnections(ctx);assert.equal(e.win16_ft_checkpoint(),0n);assert.equal(e.get_sync_msg_depth(),0);
    assert.equal(read(f.data+8),0);
    for(let i=0;i<64;i++)assert.equal(e.guest_read8(f.qt+i),0xcc,'both original slots restored');
  }
  assert.equal(require('../src/api_table.json')[4573].name,'QT_Thunk');
  for(const index of [0,1])for(const shift of [0,2])for(const cleanup of [0,2,34]) {
    const f=qtImages({index,cleanup});load(f);untilQt(f,shift);
    const s=e.get_esp()>>>0,b=e.get_ebp()>>>0,ret=read(s);
    const saved=[e.get_ebx(),e.get_esi(),e.get_edi()],segments=Array.from({length:6},(_,i)=>e.win16_sreg(i));
    assert.equal(s,0x74fd42a+shift);assert.equal(read(s+4),ARGS[0]);
    assert(service(f));assert.equal(e.get_eip()>>>0,f.body);assert.equal(e.get_esp()>>>0,s+4+cleanup);assert.equal(e.get_ebp()>>>0,b);
    assert.equal(e.get_eax()>>>0,0x89abcdef+index);assert.equal(e.get_edx()>>>0,0x12345678+index);assert.equal(e.get_ecx()>>>0,0x76543210+index);
    assert.deepEqual([e.get_ebx(),e.get_esi(),e.get_edi()],saved);assert.deepEqual(Array.from({length:6},(_,i)=>e.win16_sreg(i)),segments);
    assert.equal(read(b-60),0xfacebeef,'NE writes actual PE scratch through SS alias');assert.equal(read(s),ret);
    assert.equal((read(b-56)&65535),segments[4]);assert.equal((read(b-54)&65535),segments[2]);
    assert((read(b-52)&65535),'DX exposes actual new SS');
    for(let i=0;i<50&&e.get_eip();i++)e.run(256);
    assert.equal(e.get_eip(),0);assert.equal(e.get_esp()>>>0,0x74fd494+shift+40);
    assert.equal(e.get_eax()>>>0,((0x5678+index)<<16|((0xcdef+index)&65535))>>>0);
    records.push({kind:'packed-qt',index,shift,cleanup,esp:s,ret,copyback:true});retire(f);
  }
  // The local guard prevents entry into adjacent FT even at a DWORD stack.
  {const f=qtImages();load(f);e.set_eip(f.qt+19);e.set_esp(0x7408000);assert.throws(()=>e.run(1));assert.equal(e.win16_ft_checkpoint(),0n);retire(f);}
  for(const shift of [0,2]) {
    const f=qtImages();load(f);untilQt(f,shift);const s=e.get_esp(),b=e.get_ebp();
    // Use the actual parked QT packet and continuation, never an FT frame.
    e.win16_guest_request_cancel();e.clear_yield();e.set_eip(f.data+68);
    assert.throws(()=>{for(let i=0;i<10;i++)e.run(32);},"invalid QT-as-FT shift="+shift+" eip="+(e.get_eip()>>>0).toString(16));assert.equal(e.win16_ft_checkpoint(),0n);
    assert.equal(e.get_esp(),s);assert.equal(e.get_ebp(),b);retire(f);
    records.push({kind:'invalid-qt-as-ft',shift,rejected:true});
  }
  for(const mutation of ['header','table','qt-code','ft-code','index','source-call','source-pointer','wrong-actor']) {
    const f=qtImages();load(f);untilQt(f);const s=e.get_esp(),ret=read(s),b=e.get_ebp(),tid=e.get_current_thread_id();
    const at={header:f.data+4,table:read(f.data+8)+4,'qt-code':f.qt,'ft-code':f.data+68,index:b-4,
      'source-call':f.body-6,'source-pointer':f.base+0x29c0}[mutation];
    let old;if(at){old=read(at);e.guest_write32(at,0);}
    if(mutation==='wrong-actor')e.set_current_thread_id(tid+19);
    assert.throws(()=>service(f));
    if(mutation==='wrong-actor')e.set_current_thread_id(tid);
    if(at)e.guest_write32(at,old);
    assert.equal(e.get_esp(),s);assert.equal(read(s),ret);assert.equal(e.win16_ft_checkpoint(),0n);
    records.push({kind:'mutation',mutation,rejected:true});retire(f);
  }
  {
    const f=qtImages({mapped:true});load(f);untilQt(f);const far=read(f.log+204);assert(far>>>16);
    assert(service(f));assert.equal(read(f.log+200),0x7bcd4321,'NE writes caller MapLS alias');
    e.set_eip(f.base+0x2d00);e.set_esp(0x7408000);e.guest_write32(0x7408000,0);
    for(let i=0;i<50&&e.get_eip();i++)e.run(256);
    assert.equal(e.get_eip(),0);retire(f);records.push({kind:'mapls-copyback-unmap',passed:true});
  }
  {
    const f=qtImages();load(f);untilQt(f);const s=e.get_esp(),ret=read(s);
    let aborted=false,sawBusy=false;
    const {observeNeQtRun}=require('./helpers/ne-qt-run-observer');
    const facade=observeNeQtRun(e,()=>{sawBusy=e.win16_ft_retire_next(f.base)===-1;aborted=true;});
    assert.throws(()=>serviceNeGuestYieldSync({...ctx,exports:facade,neInvokeOptions:{maxBlocks:4096,sliceBlocks:1,
      signal:{get aborted(){return aborted;}}}}),/cancelled/);
    assert(sawBusy,'actual active QT pin prevents retirement');assert.equal(e.get_esp(),s);assert.equal(read(s),ret);
    assert.equal(e.win16_ft_checkpoint(),0n);retire(f);records.push({kind:'cancel-busy-retirement',restored:true});
  }
  for(const mutation of ['header','source','table']) {
    const f=qtImages();load(f);untilQt(f);const s=e.get_esp(),ret=read(s);
    const at=mutation==='header'?f.data+4:mutation==='source'?f.body-6:read(f.data+8)+4,old=read(at);
    let changed=false;const {observeNeQtRun}=require('./helpers/ne-qt-run-observer');
    const facade=observeNeQtRun(e,()=>{if(!changed){e.guest_write32(at,0);changed=true;}});
    assert.throws(()=>serviceNeGuestYieldSync({...ctx,exports:facade,neInvokeOptions:{maxBlocks:4096,sliceBlocks:1}}));
    e.guest_write32(at,old);assert(changed);assert.equal(e.get_esp(),s);assert.equal(read(s),ret);
    assert.equal(e.win16_ft_checkpoint(),0n);retire(f);records.push({kind:'mutation-during-call',mutation,restored:true});
  }
  {
    const f=qtImages();load(f);const outer=e.win16_bridge_frame_begin();assert(outer);assert(e.win16_bridge_scope_begin(outer));
    untilQt(f);assert(service(f));assert.equal(e.win16_ft_checkpoint(),outer,'nested QT releases only its own context');
    assert(e.win16_bridge_frame_end(outer));assert.equal(e.win16_ft_checkpoint(),0n);retire(f);
    records.push({kind:'nested-owned-scope',restored:true});
  }
  for(const failure of ['trap','loop','bad-return','odd-cleanup','excess-cleanup']) {
    const f=qtImages({failure,cleanup:failure==='odd-cleanup'?1:failure==='excess-cleanup'?128:34});load(f);untilQt(f);
    const s=e.get_esp()>>>0,b=e.get_ebp()>>>0,ret=read(s),regs=[e.get_eax(),e.get_ecx(),e.get_edx(),e.get_ebx(),e.get_esi(),e.get_edi()];
    assert.throws(()=>service(f));assert.equal(e.get_esp()>>>0,s);assert.equal(e.get_ebp()>>>0,b);assert.equal(read(s),ret);
    assert.deepEqual([e.get_eax(),e.get_ecx(),e.get_edx(),e.get_ebx(),e.get_esi(),e.get_edi()],regs);
    assert.equal(e.win16_ft_checkpoint(),0n);records.push({kind:'fault',failure,restored:true});retire(f);
  }
  if(!process.argv.includes('--no-worker')) {
    const {GuestThreadHost}=require('../lib/guest-thread-host'),path=require('node:path');
    for(const failure of [null,'trap'])for(const shift of [0,2]) {
      const f=qtImages({failure,mapped:failure===null,name:'WORKERQT'});
      const host=new GuestThreadHost({memory,module,hostImports:imports.host,
        sigs:require('../lib/host-import-sigs.generated.json').sigs,workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),
        clockIntervalMs:0,findDll:async()=>f.ne,log:()=>{}});
      const remote=(name,...args)=>host.callExport(name,...args);
      const run=async(entry,stack)=>{
        await remote('set_eip',entry);await remote('set_esp',stack);await remote('guest_write32',stack,0);
        for(let i=0;i<100;i++){const r=await host.link.slice(256);if(r.trapped)return r;if(!await remote('get_eip'))return r;}
        throw Error('Worker QT budget exhausted');
      };
      let link;
      try {
        await host.start();link=host.link;await host.loadPe(f.bytes,'authored-packed-qt.exe');
        assert(!(await run(f.entry,0x7408000)).trapped);assert.equal(await remote('guest_read32',f.result),1);
        const r=await run(f.invoke,0x74fd494+shift);
        if(failure)assert(r.trapped);
        else {
          assert(!r.trapped,JSON.stringify(r));assert.equal(await remote('get_eip'),0);
          assert.equal(await remote('get_esp'),0x74fd494+shift+40);
          assert.equal((await remote('get_eax'))>>>0,0x5679cdf0);
          assert.equal((await remote('guest_read32',f.log+200))>>>0,0x7bcd4321);
          assert(!(await run(f.base+0x2d00,0x7408000)).trapped);
          assert(!(await run(f.detachEntry,0x7408000)).trapped);
        }
      } finally {await host.stop();}
      assert.equal(read(f.data+8),0);assert.equal(e.guest_read8(f.qt),0xcc);
      assert(link._loaderRetirementReceipt?.retired,'actual Worker retirement and join');
      records.push({kind:'actual-cpu-worker',failure,shift,joined:true});
    }
  }
  const result={moduleSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),records};
  if(process.env.NEVERHOOD_QT_RESULT)fs.writeFileSync(process.env.NEVERHOOD_QT_RESULT,JSON.stringify(result,null,2)+'\n');
  console.log('PASS LS32 native QT publication, packed callers, NE target/alias/return and fail-closed faults');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={qtImages,main};
