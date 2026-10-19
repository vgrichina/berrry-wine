'use strict';
// Exact production module smoke: no compiler, transforms or test-only exports.
const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { createHostImports } = require('../lib/host-imports');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');
const option = name => process.argv.find(a => a.startsWith('--' + name + '='))?.slice(name.length + 3);
(async () => {
  const file = option('wasm'), expected = option('sha256');
  assert(file); assert.match(expected || '', /^[a-f0-9]{64}$/);
  const bytes = fs.readFileSync(file);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected);
  const module = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null, resourceJson: {} };
  const imports = createHostImports(ctx);
  imports.host.memory = memory;
  // The file/loader path uses real host implementations. Any unrelated missing
  // dependency must fail loudly if reached, never simulate successful work.
  for (const item of WebAssembly.Module.imports(module)) {
    assert.equal(item.module, 'host');
    if (item.kind === 'function' && !imports.host[item.name]) {
      imports.host[item.name] = () => { throw Error('Unexpected host dependency: ' + item.name); };
    }
  }
  const e = (await WebAssembly.instantiate(module, imports)).exports;
  ctx.exports = e;
  const pe = makeFixture();
  new Uint8Array(memory.buffer).set(pe, e.get_staging()); assert(e.load_pe(pe.length));
  const wa = p => e.guest_to_wasm(p) >>> 0, dv = new DataView(memory.buffer);
  const stack = e.guest_alloc(65536) + 65520;
  const put = text => {
    const p = e.guest_alloc(text.length + 1); assert(p);
    new Uint8Array(memory.buffer).set(Buffer.from(text + '\0'), wa(p)); return p;
  };
  const call = (address, args) => {
    e.set_esp(stack); e.call_func(address, ...Array.from({ length: 4 }, (_, i) => args[i] || 0));
    const before = e.get_esp() >>> 0;
    for (let i = 4; i < args.length; i++) dv.setUint32(wa(before + 4 * (i + 1)), args[i] >>> 0, true);
    for (let n = 0; n < 20000 && e.get_eip(); n++) {
      e.run(100); assert.equal(e.get_yield_reason(), 0, 'nonblocking file API');
    }
    assert.equal(e.get_eip(), 0); assert.equal(e.get_esp() >>> 0, before + 4 * (args.length + 1));
    return e.get_eax() >>> 0;
  };
  const api = (name, args) => call(dv.getUint32(wa(iat(name)), true), args);
  const kernel = api('GetModuleHandleA', [put('kernel32.dll')]); assert(kernel && kernel !== 0x400000);
  const winmm = api('LoadLibraryA', [put('winmm.dll')]); assert(winmm);
  const resolve = (module, name) => { const p=api('GetProcAddress',[module,put(name)]);assert(p,name);return p; };
  const ansi=resolve(winmm,'waveOutGetErrorTextA'), wide=resolve(winmm,'waveOutGetErrorTextW');
  assert.notEqual(ansi,wide);
  const buffer=e.guest_alloc(1024), w=wa(buffer);
  const b=new Uint8Array(memory.buffer);
  const text=(p,isWide)=>{let s='';for(let i=0;i<256;i++){const c=isWide?dv.getUint16(wa(p)+i*2,true):b[wa(p)+i];if(!c)return s;s+=String.fromCharCode(c);}throw Error('unterminated');};
  const valid=[...Array(22).keys(),32,33,34,35];
  for(const code of valid){
    b.fill(0xa5,w,w+1024);api('SetLastError',[12345]);
    assert.equal(call(ansi,[code,buffer,256]),0);assert.equal(api('GetLastError',[]),12345);
    const expected=text(buffer,false);assert(expected.length>0&&expected.length<256);
    for(const [address,isWide] of [[ansi,false],[wide,true]])for(const cap of [1,2,7,256,0xffffffff]){
      b.fill(0xa5,w,w+1024);assert.equal(call(address,[code,buffer+8,cap]),0);
      const n=Math.min(expected.length,cap-1),stride=isWide?2:1;
      assert.equal(text(buffer+8,isWide),expected.slice(0,n));assert.equal(b[w+7],0xa5);
      assert.equal(b[w+8+(n+1)*stride],0xa5);
    }
  }
  for(const address of [ansi,wide]){
    for(const code of [22,31,36,64,0xffffffff]){
      b.fill(0xa5,w,w+1024);assert.equal(call(address,[code,buffer,256]),9);
      assert(b.subarray(w,w+1024).every(v=>v===0xa5));
      assert.equal(call(address,[code,buffer,0]),0);
    }
    assert.equal(call(address,[0,0,1]),11);assert.equal(call(address,[0,0,0]),11);
  }
  const alloc=resolve(kernel,'VirtualAlloc'),free=resolve(kernel,'VirtualFree');
  const reservation=call(alloc,[0,8192,0x2000,4]);assert(reservation);
  assert.equal(call(alloc,[reservation,4096,0x1000,4]),reservation);
  const gap=call(alloc,[0,4096,0x3000,4]);assert(gap);
  assert.equal(call(alloc,[reservation+4096,4096,0x1000,4]),reservation+4096);
  assert.notEqual(wa(reservation+4096),wa(reservation)+4096);
  // The complete ANSI/Wide message crosses noncontiguous backing pages.
  for(const [address,stride] of [[ansi,1],[wide,2]]){
    const split=reservation+4092;
    for(let i=0;i<200;i++)e.guest_write8(split+i,0xa5);
    assert.equal(call(address,[32,split,0xffffffff]),0);
    const expected='The audio format is not supported.';
    for(let i=0;i<=expected.length;i++){
      assert.equal(e.guest_read8(split+i*stride),i===expected.length?0:expected.charCodeAt(i));
      if(stride===2)assert.equal(e.guest_read8(split+i*stride+1),0);
    }
    assert.equal(e.guest_read8(split+(expected.length+1)*stride),0xa5);
  }
  assert.equal(call(free,[reservation,0,0x8000]),1);assert.equal(call(free,[gap,0,0x8000]),1);
  console.log('WinMM error-text exact production public A/W/stdcall/LastError/noncontiguous output PASS '+expected);
})().catch(error=>{console.error(error);process.exitCode=1;});
