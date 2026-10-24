'use strict';
const assert = require('node:assert/strict');
// Historical GetProcAddress allocates a fresh eight-byte dispatch record.
// Its first word is a backing offset relative to GUEST_BASE, pointing to a
// two-byte hint followed by the name; its second word is the API table ID.
function describeSystemThunk(e, buffer, address, name, id) {
  const start = e.get_thunk_base() >>> 0, end = e.get_thunk_end() >>> 0;
  assert(address >= start && address + 8 <= end && (address - start) % 8 === 0,
    'system thunk range/alignment');
  const dv = new DataView(buffer), bytes = new Uint8Array(buffer);
  const offset = e.guest_to_wasm(address) >>> 0;
  const apiId = dv.getUint32(offset + 4, true);
  assert.equal(apiId, id, 'system thunk API identity');
  const nameOffset = (e.get_guest_base() >>> 0) + dv.getUint32(offset, true) + 2;
  assert(nameOffset + name.length < bytes.length, 'system thunk name bounds');
  assert.equal(Buffer.from(bytes.slice(nameOffset, nameOffset + name.length + 1)).toString(),
    name + '\0', 'system thunk imported name');
  return { address, apiId, name };
}
module.exports = { describeSystemThunk };
