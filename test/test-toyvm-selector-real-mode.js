'use strict';

// Exercise the production segment helpers through CS/data loads and actual
// LAR/LSL instructions. Selector 4 is LDT slot zero; only GDT slot zero is null.
const assert = require('node:assert/strict');
const { makeVm } = require('../tools/toyvm/vm');
const { setCpuLevel } = require('../tools/toyvm/decode');

async function main() {
  const vm = await makeVm('tailcall');
  const e = vm.exports;
  const view = new DataView(vm.memory.buffer);
  const base = 0x30000, table = 0x2000;
  setCpuLevel(386);
  e.set_cpu(386);
  e.mset_gdtb(0x1000);
  e.mset_gdtl(0x3f);
  e.mset_ldtb(table);
  // Present, readable D=1 code descriptor with base 30000 and limit ffffffff.
  view.setUint32(table, 0x0000ffff, true);
  view.setUint32(table + 4, 0x00cf9a03, true);
  e.mset_cr0(1);
  for (const selector of [4, 5, 6, 7]) {
    vm.set('cs', selector);
    assert.equal(e.get_csb(), base, 'LDT slot zero supplies the CS base');
    assert.equal(e.get_d32(), 1, 'LDT slot zero supplies the D bit');
    vm.set('ds', selector);
    assert.equal(e.get_dsb(), base, 'LDT slot zero supplies the data base');
    for (const [opcode, expected] of [[0x02, 0x00cf9a00], [0x03, 0xffffffff]]) {
      // LAR/LSL EAX, ECX in the selected 32-bit code segment.
      vm.mem.set([0x0f, opcode, 0xc1], base + 0x100);
      vm.set('gip', 0x100); vm.set('cx', selector); e.set_ax(0xdeadbeef);
      assert.equal(vm.stepOne(), true);
      assert.equal(vm.get('flags') & 0x40, 0x40, 'LDT slot zero is a valid descriptor');
      assert.equal(vm.raw('ax') >>> 0, expected);
    }
  }
  // GDT selectors 0..3 remain null, including their RPL bits.
  for (const selector of [0, 1, 2, 3]) {
    vm.set('ds', selector);
    assert.equal(e.get_dsb(), 0);
    vm.set('cs', 4);
    vm.mem.set([0x0f, 0x02, 0xc1], base + 0x100);
    vm.set('gip', 0x100); vm.set('cx', selector); e.set_ax(0xdeadbeef);
    assert.equal(vm.stepOne(), true);
    assert.equal(vm.get('flags') & 0x40, 0, 'GDT null selector fails LAR');
    assert.equal(vm.raw('ax') >>> 0, 0xdeadbeef, 'failed LAR preserves destination');
  }
  vm.set('cs', 4);
  e.mset_cr0(0);
  vm.set('cs', 0x4000);
  assert.equal(e.get_csb(), 0x40000, 'real CS load restores the paragraph base');
  assert.equal(e.get_d32(), 1, 'real CS load retains the cached D bit');
  vm.mem.set([0xb8, 0x78, 0x56, 0x34, 0x12], 0x40100);
  vm.set('gip', 0x100);
  assert.equal(vm.stepOne(), true);
  assert.equal(vm.raw('ax') >>> 0, 0x12345678, 'real-mode instruction retains 32-bit decoding');
  assert.equal(vm.get('gip'), 0x105);
  e.mset_cr0(1); e.mset_vm86(1);
  vm.set('cs', 4);
  assert.equal(e.get_csb(), 0x40, 'VM86 uses paragraph addressing');
  assert.equal(e.get_d32(), 0, 'VM86 forces 16-bit decoding');
  e.mset_vm86(0); e.mset_cr0(0);
  vm.set('cs', 0x4000);
  assert.equal(e.get_d32(), 0, 'ordinary real mode remains 16-bit');
  console.log('PASS LDT slot-zero CS/data/LAR/LSL, GDT null selectors, real-mode cached D and VM86');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
