'use strict';
// Explicit prebuilt full-module allocator proof. No compilation or guest API
// dispatch substitutes; NE initialization/QT remain intentionally unactivated.
const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { createHostImports } = require('../lib/host-imports');
const R = require('../lib/region-map.generated');
const { invokeNeEntry } = require('../lib/ne-invoke');
const SIZE = 944 * 65536, BASE = 0x400000;
function fixture() {
  const b = Buffer.alloc(0x400), p = 0x80, o = p + 24, s = o + 0xe0;
  b.write('MZ'); b.writeUInt32LE(p, 0x3c); b.writeUInt32LE(0x4550, p);
  b.writeUInt16LE(0x14c, p + 4); b.writeUInt16LE(1, p + 6); b.writeUInt16LE(0xe0, p + 20);
  b.writeUInt16LE(0x10e, p + 22); b.writeUInt16LE(0x10b, o); b.writeUInt32LE(0x1000, o + 16);
  b.writeUInt32LE(BASE, o + 28); b.writeUInt32LE(0x1000, o + 32); b.writeUInt32LE(0x200, o + 36);
  b.writeUInt32LE(0x2000, o + 56); b.writeUInt32LE(0x200, o + 60); b.writeUInt16LE(3, o + 68);
  b.writeUInt32LE(0x100000, o + 72); b.writeUInt32LE(0x1000, o + 76); b.writeUInt32LE(16, o + 92);
  b.write('.text', s); b.writeUInt32LE(0x1000, s + 8); b.writeUInt32LE(0x1000, s + 12);
  b.writeUInt32LE(0x200, s + 16); b.writeUInt32LE(0x200, s + 20); b.writeUInt32LE(0xe0000060, s + 36);
  b[0x200] = 0xc3; return b;
}
async function boot(module, memory, init) {
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  imports.host.memory = memory;
  for (const item of WebAssembly.Module.imports(module)) {
    assert.equal(item.module, 'host');
    if (item.kind === 'function' && !imports.host[item.name])
      imports.host[item.name] = () => { throw Error('Unexpected host import ' + item.name); };
  }
  const e = (await WebAssembly.instantiate(module, imports)).exports;
  if (init) e.init_thread(...init);
  return e;
}
function neFixture(code) {
  const b=Buffer.alloc(0x400),n=0x80,w=(o,v)=>b.writeUInt16LE(v,o);
  b.write('MZ');b.writeUInt32LE(n,0x3c);b.write('NE',n);
  w(n+4,0x60);w(n+6,6);w(n+0xc,0x8000);w(n+0xe,2);w(n+0x10,16);
  w(n+0x14,0);w(n+0x16,1);w(n+0x1c,2);w(n+0x22,0x40);w(n+0x32,4);
  w(n+0x40,0x20);w(n+0x42,0x100);w(n+0x44,0);w(n+0x46,0x100);
  w(n+0x48,0x30);w(n+0x4a,0x100);w(n+0x4c,1);w(n+0x4e,0x100);
  b.set([1,1,0,0,0,0],n+0x60);b.set(code,0x200);return b;
}
async function main() {
  assert(process.env.WA_TEST_WASM,'explicit prebuilt module required');
  const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM));
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const bytes=new Uint8Array(memory.buffer),view=new DataView(memory.buffer),e=await boot(module,memory),pe=fixture();
  bytes.set(pe,e.get_staging());assert.equal(e.load_pe(pe.length),BASE+0x1000);
  const bootstrap=e.win16_bridge_frame_begin();assert(bootstrap);assert.equal(e.win16_bridge_frame_end(bootstrap),1);
  const arena=view.getUint32(R.BASE.WIN16_PROCESS_ARENA,true),wa=e.guest_to_wasm(arena)>>>0,shared=wa+943*65536+0xf000;
  const load=(id,code)=>{
    const b=neFixture(code);bytes.set(b,e.win16_dll_staging(id));assert.equal(e.load_ne_dll_sized(id,b.length),1);
    const record=wa+943*65536+0x8000+id*16,index=view.getUint32(record+4,true);
    return {target:(((index+1)<<3|7)<<16)>>>0,ds:(index+2)<<3|7,instance:id,heap:16};
  };
  const good=load(13,[0xb8,0xcd,0xab,0xba,0x01,0xef,0xcb]);
  const zero=load(14,[0x31,0xc0,0x31,0xd2,0xcb]);
  const trap=load(15,[0xca,2,0]); // invalid RETF cleanup violates owned continuation
  const spin=load(16,[0xeb,0xfe]);
  // One real nested far CALL to a second function in the same code selector.
  const nestedBytes=[0x9a,0x10,0,good.target>>>16&255,good.target>>>24&255,0xcb];
  const nested=load(17,nestedBytes);
  const nestedBase=e.win16_seg_base(nested.target>>>19),nestedWa=e.guest_to_wasm(nestedBase)>>>0;
  bytes[nestedWa+3]=nested.target>>>16&255;bytes[nestedWa+4]=nested.target>>>24&255;
  bytes.set([0xb8,0x34,0x12,0xba,0x78,0x56,0xcb],nestedWa+0x10);
  const snapshot=()=>({registers:Buffer.from(bytes.slice(R.BASE.REGFILE,R.BASE.REGFILE+32)),
    eip:e.get_eip(),fs:e.get_fs_base(),ss:e.get_sreg_ss(),ds:e.get_sreg_ds(),cs:e.get_sreg_cs(),depth:e.get_sync_msg_depth()});
  e.set_eip(BASE+0x1000);e.set_esp(0x7408000);const caller=snapshot();
  const clean=()=>{assert.deepEqual(snapshot(),caller);for(const off of [36,40,44])assert.equal(view.getUint32(shared+off,true),0,'frame/depth/lease released');};
  assert.equal(await invokeNeEntry(e,good),0xef01abcd);clean();
  assert.equal(await invokeNeEntry(e,zero),0,'real failed-init result is preserved');clean();
  assert.equal(await invokeNeEntry(e,nested),0x56781234);clean();
  await assert.rejects(invokeNeEntry(e,trap),WebAssembly.RuntimeError);clean();
  await assert.rejects(invokeNeEntry(e,spin,{maxBlocks:16,sliceBlocks:4}),/budget exhausted/);clean();
  const abort=new AbortController(),callbackExports={...e,run(blocks){e.run(blocks);abort.abort(Error('native synchronous cancellation'));}};
  await assert.rejects(invokeNeEntry(callbackExports,spin,{signal:abort.signal,maxBlocks:1000,sliceBlocks:4}),/native synchronous cancellation/);clean();
  await assert.rejects(invokeNeEntry(e,good,{signal:abort.signal}),/native synchronous cancellation/);clean();
  assert.equal(await invokeNeEntry(e,good),0xef01abcd,'usable after all failed calls');clean();
  assert.equal(e.is_win16(),0);assert.equal(e.get_image_base(),BASE);assert.equal(e.win16_process_arena_release(),1);
  console.log(JSON.stringify({passed:true,guestExecution:true,registerCalledEntry:true,moduleLifecycle:false,qtThunk:false}));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
