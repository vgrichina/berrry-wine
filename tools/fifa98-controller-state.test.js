'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/fifa98-controller-state.js', 'utf8');
const memory = { buffer: new ArrayBuffer(0x200000) }, bytes = new Uint8Array(memory.buffer);
bytes.set([0xb3,1,0x30,0xf6,0xb8,0xe8,0xd1,0x58,0], 0x34141);
const identity = () => ({ sha256: '04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17' });
const host = { memory, instance: { exports: { get_image_base: () => 0x400000 } },
  _guestToWasmAddress: a => a - 0x400000 };
const context = { wine: host, __fifaModuleIdentity: identity };
const before = Buffer.from(bytes), result = vm.runInNewContext(source, context);
assert(result.available); assert.equal(result.blocks.reduce((s, b) => s + b.bytes.length, 0), 980);
assert.deepEqual(Buffer.from(bytes), before);
context.__fifaModuleIdentity = () => null;
assert.equal(vm.runInNewContext(source, context).available, false);
context.__fifaModuleIdentity = identity; bytes[0x34141] = 0;
assert.equal(vm.runInNewContext(source, context).available, false);
bytes[0x34141] = 0xb3; host._guestToWasmAddress = () => 0xf0;
assert.throws(() => vm.runInNewContext(source, context), /unmapped/);
console.log('PASS bounded snapshot, unchanged memory, module/signature/mapping rejection');
