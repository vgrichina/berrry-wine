'use strict';
// Authored x86 CALLs through a normal PE import table. No proprietary input
// executes here and no host code supplies a segmented pointer or API result.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const {makeFixture} = require('../tools/kernel32-native-fixture');
const offsets = [8, 12, 16, 20, 24];
const names = ['MapLS', 'UnMapLS', 'MapSL', 'SMapLS', 'SUnMapLS',
  ...offsets.flatMap(n => ['SMapLS_IP_EBP_' + n, 'SUnMapLS_IP_EBP_' + n])];
const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24];
const base = 0x400000, stack = 0x7408000, log = base + 0x2c00;
const raw = rva => rva - 0x1000 + 0x200;
function image() {
  const b = makeFixture();
  b.fill(0, raw(0x1900), raw(0x1e00));
  let cursor = 0x1a00;
  names.forEach((name, i) => {
    b.writeUInt32LE(cursor, raw(0x1900 + 4 * i));
    b.write(name + '\0', raw(cursor + 2)); cursor += name.length + 3;
  });
  assert(cursor < 0x2000);
  return b;
}
function program(name, {eax = 0x1234abcd, arg = 0, slots = {}, nested = false, badFrame, wordPush = false, retBytes = 0} = {}) {
  const b = [0xbd, ...u32(0x13579bdf), 0x55, 0x89, 0xe5, 0x83, 0xec, 64,
    0xbb, ...u32(0x2468ace0), 0xbe, ...u32(0x11223344),
    0xbf, ...u32(0x55667788), 0xb9, ...u32(0xaabbccdd),
    0xba, ...u32(0x99aabbcc)];
  for (const n of offsets) b.push(0xc7, 0x45, n, ...u32(slots[n] ?? 0xcafe0000 + n));
  const call = api => b.push(0xff, 0x15, ...u32(base + 0x1900 + names.indexOf(api) * 4));
  b.push(0xb8, ...u32(eax));
  if (badFrame !== undefined) b.push(0xbd,...u32(badFrame));
  if (wordPush) b.push(0x66,0x68,0x79,0x35);
  if (['MapLS', 'UnMapLS', 'MapSL'].includes(name)) b.push(0x68, ...u32(arg));
  call(name);
  // A second live mapping before the first has been released witnesses the
  // reference-counted path using the real x86 stack convention.
  if (nested) {
    b.push(0xa3, ...u32(log + 40));
    // A real nested EBP frame maps and unmaps the same linear argument.
    b.push(0x68, ...u32(slots[12]), 0xe8, ...u32(0x402400 - (0x402000 + b.length + 10)));
    b.push(0xa1, ...u32(log + 40));
  }
  // Snapshot GPRs with native stores, before any cleanup in the test body.
  for (const [reg, off] of [[0,0],[1,4],[2,8],[3,12],[4,16],[5,20],[6,24],[7,28]])
    b.push(0x89, (reg << 3) | 5, ...u32(log + off));
  for (const n of offsets) b.push(0x8b, 0x45, n, 0xa3, ...u32(log + 64 + n));
  b.push(0xc9, 0x89, 0x2d, ...u32(log + 32), 0x89, 0x25, ...u32(log + 36),
    ...(retBytes ? [0xc2,retBytes,0] : [0xc3]));
  if (nested) {
    while (b.length < 0x400) b.push(0xcc);
    b.push(0x55,0x89,0xe5,0xff,0x15,...u32(base+0x1900+names.indexOf('SMapLS_IP_EBP_8')*4),
      0xa3,...u32(log+44),0xff,0x15,...u32(base+0x1900+names.indexOf('SUnMapLS_IP_EBP_8')*4),
      0xc9,0xc2,4,0);
  }
  return Buffer.from(b);
}
async function compiled() {
  assert(process.env.WA_TEST_WASM, 'explicit qualified module required');
  const {createHostImports} = require('../lib/host-imports');
  const memory = new WebAssembly.Memory({initial: 8192, maximum: 8192, shared: true});
  const imports = createHostImports({getMemory: () => memory.buffer, renderer: null, resourceJson: {}});
  imports.host.memory = memory;
  const bytes = fs.readFileSync(process.env.WA_TEST_WASM);
  const module = await WebAssembly.compile(bytes);
  const e = (await WebAssembly.instantiate(module, imports)).exports;
  const b = image(); new Uint8Array(memory.buffer).set(b, e.get_staging());
  assert.equal(e.load_pe(b.length), 0x402000);
  const witnesses = [];
  const invoke = (name, options = {}, owner = e) => {
    const code = program(name, options);
    for (let i = 0; i < code.length; i += 4) {
      const word = Buffer.alloc(4); code.copy(word, 0, i, i + 4);
      owner.guest_write32(0x402000 + i, word.readUInt32LE());
    }
    owner.invalidate_code_range(0x402000, 0x500);
    owner.set_eip(0x402000); owner.set_esp(stack); owner.guest_write32(stack, 0);
    for (let i = 0; i < 100 && owner.get_eip(); i++) {
      owner.run(64); assert.equal(owner.get_yield_reason(), 0);
    }
    assert.equal(owner.get_eip(), 0, 'bounded native caller returned');
    assert.equal(owner.get_esp(),stack+4+(options.retBytes||0),'actual caller RET cleanup');
    const at = off => owner.guest_read32(log + off) >>> 0;
    const r = {name, options, eax: at(0), ecx: at(4), edx: at(8), slots: {}};
    for (const n of offsets) r.slots[n] = at(64 + n);
    for (const [off, expected] of [[4,0xaabbccdd],[12,0x2468ace0],[16,stack-68-(options.wordPush?2:0)],
      [20,stack-4],[24,0x11223344],[28,0x55667788],[32,0x13579bdf],[36,stack]])
      assert.equal(at(off), expected, name + ' register/frame ' + off);
    witnesses.push(r); return r;
  };
  const ptrs = [0x401234, 0x412345, 0x7409abc];
  for (const n of offsets) {
    const r = invoke('SMapLS_IP_EBP_' + n, {slots: {[n]: ptrs[n % 3]}});
    assert(r.eax >>> 16, 'real selector'); assert.equal(r.edx, r.eax);
    assert.equal(r.slots[n], r.eax, 'slot becomes unmap state');
    for (const other of offsets.filter(x => x !== n)) assert.equal(r.slots[other], 0xcafe0000 + other);
    assert.equal(e.win16_seg_base(r.eax >>> 19) + (r.eax & 65535), ptrs[n % 3]);
    assert.equal(invoke('MapSL', {arg: r.eax}).eax, ptrs[n % 3]);
    const u = invoke('SUnMapLS_IP_EBP_' + n, {eax: 0x87654321, slots: {[n]: r.eax}});
    assert.equal(u.eax, 0x87654321, 'unmap preserves caller result'); assert.equal(u.slots[n], 0);
  }
  for (const value of [0, 1, 0x7fff, 0xffff]) {
    const r = invoke('SMapLS_IP_EBP_12', {slots: {12: value}});
    assert.equal(r.eax, value); assert.equal(r.edx, 0); assert.equal(r.slots[12], 0);
    assert.equal(invoke('MapLS', {arg: value}).eax, value);
    assert.equal(invoke('MapSL', {arg: value}).eax, value);
  }
  for (const retBytes of [8,36]) {
    const r=invoke('SMapLS_IP_EBP_12',{slots:{12:ptrs[0]},wordPush:true,retBytes});
    assert.equal(invoke('MapSL',{arg:r.eax}).eax,ptrs[0]);
    invoke('SUnMapLS_IP_EBP_12',{slots:{12:r.eax},wordPush:true,retBytes,eax:0xffff8001});
  }
  assert.equal(invoke('MapLS', {arg: 0xf1234567}).eax, 0, 'unmapped guest address refused');
  const first = invoke('MapLS', {arg: ptrs[0]}).eax;
  const second = invoke('MapLS', {arg: ptrs[0] + 3}).eax;
  assert.equal(first >>> 16, second >>> 16, 'same window shares selector');
  assert.equal(second - first, 3, 'offset preserved');
  assert.equal(e.win16_process_arena_release(), 0, 'live aliases pin arena retirement');
  invoke('UnMapLS', {arg: first});
  const other = invoke('MapLS', {arg: ptrs[1]}).eax;
  assert.notEqual(other >>> 16, second >>> 16, 'one unmap cannot recycle other live reference');
  assert.equal(invoke('MapSL', {arg: second}).eax, ptrs[0] + 3);
  invoke('UnMapLS', {arg: second}); invoke('UnMapLS', {arg: other});
  invoke('UnMapLS', {arg: other}); // zero reference cannot underflow activity pin
  invoke('UnMapLS', {arg: 0xffff1234});
  const nested = invoke('SMapLS_IP_EBP_12', {slots: {12: ptrs[0]}, nested: true});
  assert.equal(e.guest_read32(log+44), nested.eax, 'nested frame reused outer live alias');
  assert.equal(nested.slots[12], nested.eax, 'inner unmap preserved outer frame cookie');
  const alien = (await WebAssembly.instantiate(module, imports)).exports;
  alien.init_thread(7,e.get_image_base(),e.get_code_start(),e.get_code_end(),
    e.get_thunk_base(),e.get_thunk_end(),e.get_num_thunks(),0);
  const shared = invoke('MapLS', {arg: ptrs[0]}, alien).eax;
  assert.equal(shared, nested.eax, 'separate CPU instance shares alias metadata');
  invoke('UnMapLS', {arg: shared}, alien);
  assert.equal(e.win16_process_arena_release(), 0, 'other CPU unmap preserved outer reference');
  // Actual 16-bit LES / ES read and write through the returned selector.
  const {neLifecycleImage} = require('./helpers/ne-lifecycle-image');
  const {createNeLifecycle} = require('../lib/ne-lifecycle');
  const ne = neLifecycleImage();
  ne.writeUInt16LE(0x60,0x80+0x60+9);
  ne.set([0xb8,1,0,0xca,2,0],0x260);
  ne.set([0x55,0x89,0xe5,0x06,0x53,0xc4,0x5e,6,0x26,0x8b,7,
    0x26,0xc7,7,0xcd,0x7b,0x31,0xd2,0x5b,0x07,0x5d,0xca,4,0],0x210);
  const life=createNeLifecycle(e,memory,[['SMAP',ne]]), id=life.load('SMAP');
  e.guest_write16(ptrs[0],0x2468);
  assert.equal(life.call(id,'VALUE',[nested.eax & 65535,nested.eax>>>16]),0x2468);
  assert.equal(e.guest_read32(ptrs[0])&65535,0x7bcd,'NE far write changed original linear storage');
  life.release(id);
  invoke('SUnMapLS_IP_EBP_12', {slots:{12:nested.eax}});
  const r = invoke('SMapLS', {eax: ptrs[2]});
  assert.equal(r.eax, r.edx);
  assert.equal(invoke('SUnMapLS', {eax: r.eax}).eax, r.eax);
  assert.equal(e.win16_process_arena_release(), 1, 'all mapped references released');
  for (const name of ['SMapLS_IP_EBP_12','SUnMapLS_IP_EBP_12'])
    for (const badFrame of [0xf1234000, 0xfffffffc])
      assert.throws(() => invoke(name,{badFrame}), WebAssembly.RuntimeError,
        'invalid/overflowing EBP frame faults before alias state changes');
  const result = {passed: true, wasmSHA256: crypto.createHash('sha256').update(bytes).digest('hex'), witnesses};
  if (process.env.NEVERHOOD_SMAPLS_RESULT) fs.writeFileSync(process.env.NEVERHOOD_SMAPLS_RESULT, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  console.log('PASS native x86 EBP offsets, selector roundtrip, null/integer/invalid, shared references, unmap and caller GPR/ESP restoration');
}
function staticChecks() {
  const apis = require('../src/api_table.json'), exports = require('../src/kernel32-exports.json').exports;
  for (const name of names) {
    const a = apis.find(a => a.name === name); assert(a);
    assert.equal(a.nargs, ['MapLS','MapSL','UnMapLS'].includes(name) ? 1 : 0);
    assert(exports.some(e => e.name === name && e.api === name));
  }
  assert(image().includes(Buffer.from('SMapLS_IP_EBP_12\0')));
  console.log('PASS explicit LS export/zero-argument ABI and authored PE import fixture');
}
if (require.main === module) {
  staticChecks(); if (process.argv.includes('--compiled')) compiled().catch(e => { console.error(e); process.exitCode = 1; });
}
module.exports = {image, program, compiled, names};
