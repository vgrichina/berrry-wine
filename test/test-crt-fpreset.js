#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { compileSrcWasm } = require('./compile-src');
const api = require('../src/api_table.json').find(row => row.name === '_fpreset');
assert(api && api.nargs === 0 && api.convention === 'cdecl');

// Exercise the generated dispatcher and real FNINIT/FNSAVE opcode handlers.
// Dirty all environment fields, including internal exact-integer validity;
// physical register payloads must survive the logical reset.
const extra = `
 (func (export "dirty") (param $cw i32) (param $sw i32) (param $top i32)
   (global.set $fpu_cw (local.get $cw))
   (global.set $fpu_sw (local.get $sw))
   (global.set $fpu_top (local.get $top))
   (global.set $fpu_tag (i32.const 255))
   (global.set $fpu_raw_tag (i32.const 255))
   (i32.store offset=0 (global.get $reg_base) (i32.const 0x12345678))
   (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000)))
 (func (export "reset")
   (call $dispatch_api_table (i32.const ${api.id})
     (i32.const 0) (i32.const 0) (i32.const 0)
     (i32.const 0) (i32.const 0) (i32.const 0)))
 (func (export "fninit")
   (call $fpu_exec_reg (i32.const 3) (i32.const 4) (i32.const 3)))
 (func (export "save") (param $addr i32)
   (call $fpu_exec_mem (i32.const 5) (i32.const 6) (local.get $addr)))
 (func (export "env") (param $addr i32) (call $fpu_store_env (local.get $addr)))
 (func (export "cw") (result i32) (global.get $fpu_cw))
 (func (export "raw_tags") (result i32) (global.get $fpu_raw_tag))
 (func (export "bank") (result i32) (global.get $fpu_base))
 (func (export "round") (param $v f64) (result f64) (call $fpu_round (local.get $v)))
`;
const binary = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + extra : source);
const module_ = new WebAssembly.Module(binary);
const memory = new WebAssembly.Memory({initial:8192, maximum:8192, shared:true});
const imports = {host:{memory}};
for (const i of WebAssembly.Module.imports(module_)) {
  if (i.kind === 'function') (imports[i.module] ||= {})[i.name] = () => 0;
}
imports.host.math_pow2 = value => 2 ** value;
imports.host.math_log2 = Math.log2;
const a = new WebAssembly.Instance(module_, imports).exports;
const b = new WebAssembly.Instance(module_, imports).exports;
a.init_thread(0, 0x400000, 0, 0, 0, 0, 0);
b.init_thread(1, 0x400000, 0, 0, 0, 0, 0);
const bytes = new Uint8Array(memory.buffer);
const bank = e => Buffer.from(bytes.slice(e.bank(), e.bank()+128));
const view = new DataView(memory.buffer);
for (let i=0; i<128; i++) {
  bytes[a.bank()+i] = (i*19+7)&255;
  bytes[b.bank()+i] = (i*13+3)&255;
}
// Exact finite values make FNSAVE's extended-real payload independently
// checkable, rather than merely checking that its source bank was untouched.
for (let i=0; i<8; i++) view.setFloat64(a.bank()+i*8, i % 2 ? -1.5 : 1.5, true);
const bankA = bank(a), bankB = bank(b);
const state = e => [e.cw(),e.get_fpu_sw(),e.get_fpu_top(),e.get_fpu_tags(),e.raw_tags()];
b.dirty(0x147f, 0xb5ff, 6);
const beforeB = state(b);
for (const [cw,sw,top] of [[0x1c00,0xffff,7],[0,0x80ff,3],[0x137f,0x4700,1]]) {
  a.dirty(cw,sw,top);
  a.reset();
  assert.deepEqual(state(a),[0x027f,0,0,0,0], 'CRT reset clears exceptions, conditions, TOP, stack and raw validity');
  assert.equal(a.get_esp(),0x00300004,'cdecl consumes only return address');
  assert.equal(a.get_eax(),0x12345678,'void reset does not invent an EAX result');
  assert.deepEqual(bank(a),bankA,'logical reset preserves physical data and exact payloads');
  assert.deepEqual(state(b),beforeB,'sibling thread environment survives reset');
  assert.deepEqual(bank(b),bankB,'sibling physical bank survives reset');
  assert.equal(a.round(1.5),2,'nearest rounding restored');
  assert.equal(a.round(2.5),2,'nearest ties use even');
  a.env(0x404000);
  const env = Buffer.from(Array.from({length:28},(_,i)=>a.guest_read8(0x404000+i)));
  assert.equal(env.readUInt32LE(0),0x027f);
  assert.equal(env.readUInt32LE(4),0);
  assert.equal(env.readUInt32LE(8),0xffff,'architectural tags report all eight registers empty');
  assert(env.subarray(12).every(x=>x===0),'untracked pointer/opcode fields remain zero');
}
for (const action of ['fninit','save']) {
  a.dirty(0x1c00,0xffff,7);
  a[action](0x404100);
  assert.deepEqual(state(a),[0x037f,0,0,0,0],action+' retains hardware 64-bit default rather than CRT53');
  assert.deepEqual(bank(a),bankA,action+' preserves physical payloads');
  assert.deepEqual(state(b),beforeB,action+' remains thread scoped');
  if (action === 'save') {
    const saved = Buffer.from(Array.from({length:108},(_,i)=>a.guest_read8(0x404100+i)));
    assert.equal(saved.readUInt32LE(0),0x1c00,'FNSAVE captures old control before resetting');
    assert.equal(saved.readUInt32LE(4),0xffff,'FNSAVE captures old status and TOP');
    for (let i=0; i<8; i++) {
      assert.equal(saved.readBigUInt64LE(28+i*10),0xc000000000000000n,'saved 1.5 significand');
      assert.equal(saved.readUInt16LE(36+i*10),i%2 ? 0xbfff : 0x3fff,'saved physical sign/exponent');
    }
  }
}
console.log('PASS CRT _fpreset reset/ABI/rounding/tags/payload/thread isolation and FNINIT/FNSAVE distinction');
