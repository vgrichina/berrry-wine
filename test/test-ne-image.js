'use strict';
const assert=require('node:assert/strict');
const {inspectNeDll}=require('../lib/ne-image');
const {neLifecycleImage}=require('./helpers/ne-lifecycle-image');
const valid=neLifecycleImage({dependencies:['KERNEL','HELPER']});
const result=inspectNeDll(valid);assert.deepEqual(result.dependencies,['KERNEL','HELPER']);
assert.equal(result.names.get('WEP'),3);assert.equal(result.names.get('VALUE'),2);assert.equal(result.entries.size,3);
valid[0]=0;assert.equal(result.bytes[0],0x4d,'private immutable input copy');
for(const edit of [b=>b.writeUInt32LE(0xffffffff,0x3c),b=>b.writeUInt16LE(0xffff,0x80+0x22),
 b=>b.writeUInt16LE(0xffff,0x80+4),b=>b.writeUInt16LE(40,0x80+0x32),
 b=>b.writeUInt16LE(3,0x80+14),b=>b.writeUInt16LE(2,0x80+0x16),
 b=>b.writeUInt16LE(0x8000,0x80+12),
 b=>b.writeUInt16LE(0x8002,0x80+12),b=>b.writeUInt16LE(8,0x80+0x44),
 b=>b.writeUInt16LE(1,0x80+0x46),b=>b[0x80+0x61]=9]) {
 const bad=neLifecycleImage();edit(bad);assert.throws(()=>inspectNeDll(bad));
}
const modernLegacy=neLifecycleImage();modernLegacy.writeUInt16LE(0x400,0x80+0x3e);
assert.equal(inspectNeDll(modernLegacy).dllEntryOrdinal,0,'version alone does not require notification');
// One ordinal import with a two-site chain; cyclic/truncated chains rejected.
const reloc=neLifecycleImage({dependencies:['KERNEL']});reloc.writeUInt16LE(0x100,0xc4);
reloc.writeUInt16LE(1,0x300);reloc.set([5,1,8,0,1,0,4,0],0x302);
reloc.writeUInt16LE(10,0x208);reloc.writeUInt16LE(0xffff,0x20a);
assert.deepEqual(inspectNeDll(reloc).imports,[{module:'KERNEL',symbol:4}]);
const overlap=Buffer.from(reloc);overlap.writeUInt16LE(2,0x300);overlap.copy(overlap,0x30a,0x302,0x30a);assert.throws(()=>inspectNeDll(overlap),/Overlapping/);
reloc.writeUInt16LE(8,0x20a);assert.throws(()=>inspectNeDll(reloc),/chain/);
reloc.writeUInt16LE(0xffff,0x20a);reloc.writeUInt16LE(255,0x304);assert.throws(()=>inspectNeDll(reloc),/chain/);
console.log('PASS NE image bounds, entries, dependencies, input copy and relocation chain rejection');
