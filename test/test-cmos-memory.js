'use strict';
// AT memory-size bytes must reach an ordinary 16-bit IN/OUT consumer.
const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { neLifecycleImage } = require('./helpers/ne-lifecycle-image');
const root = path.resolve(__dirname, '..');
const ctx = { createHostImports, console: { log() {}, error() {} } };
vm.runInNewContext(fs.readFileSync(path.join(root, 'host.js'), 'utf8') + '\n;globalThis.Host=WineAssembly;', ctx);
async function main() {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const wine = new ctx.Host(); wine.memory = memory; wine.logToUI = () => {};
  const imports = wine.getImports({ detached: true, threadId: 1 }); imports.host.memory = memory;
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(process.env.WINE_ASSEMBLY_WASM || path.join(root, 'build/wine-assembly.wasm')), imports);
  wine.instance = instance;
  const e = instance.exports, b = neLifecycleImage(), n = 0x80;
  b.writeUInt16LE(1, n + 12); // executable, automatic data segment 2
  b.writeUInt16LE(0xff00, n + 0x18); b.writeUInt16LE(2, n + 0x1a);
  const code = [0xfa,
    0xb0,0x15,0xe6,0x70,0xe4,0x71,0x88,0xc3,
    0xb0,0x16,0xe6,0x70,0xe4,0x71,0x88,0xc7,
    0xb0,0x18,0xe6,0x70,0xe4,0x71,0x88,0xc4,
    0xb0,0x17,0xe6,0x70,0xe4,0x71,0xfb,
    0x89,0x1e,0,0,0xa3,2,0, // preserve independently decoded base/extended KiB
    0x31,0xd2,0x01,0xd8,0x83,0xd2,0,
    0xa3,4,0,0x89,0x16,6,0,0xc7,0x06,8,0,0x0d,0x60,0xeb,0xfe];
  b.fill(0, 0x200, 0x300); b.set(code, 0x200);
  new Uint8Array(memory.buffer).set(b, e.get_staging()); assert(e.load_ne(b.length) > 0);
  const data = e.win16_seg_base_of(3), word = o => e.guest_read8(data+o) | e.guest_read8(data+o+1)<<8;
  for (let i=0;i<20 && word(8)!==0x600d;i++) e.run(10);
  assert.equal(word(8), 0x600d, 'ordinary guest reaches result store');
  assert.equal(word(0), 640, 'base memory excludes the adapter hole');
  assert.equal(word(2), 63*1024, 'extended memory begins above 1 MiB on the legacy 64 MiB machine');
  assert.equal(word(4), 640+63*1024, '16-bit consumer receives usable base plus extended KiB');
  assert.equal(word(6), 0, 'sum does not wrap');
  // Configuration RAM remains writable, shared with this process, and independent of RTC BCD mode.
  const io=imports.host.cmos_io, read=a=>{io(0x70,a,1);return io(0x71,0,0);};
  io(0x70,0x0b,1);io(0x71,6,1);
  assert.equal(read(0x15),0x80);assert.equal(read(0x16),2);
  io(0x70,0x15,1);io(0x71,0x34,1);assert.equal(read(0x95),0x34);
  const other=createHostImports({getMemory:()=>memory.buffer}).host;
  other.cmos_io(0x70,0x15,1);assert.equal(other.cmos_io(0x71,0,0),0x80,'new process gets independent firmware defaults');
  console.log('PASS AT CMOS memory initialization and ordinary Win16 IN/OUT sum, RAM writes, NMI mask, RTC mode, process isolation');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
