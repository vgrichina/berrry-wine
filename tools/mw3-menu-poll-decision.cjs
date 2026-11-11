'use strict';

// Read-only API-entry samples for mech3demo.exe SHA256
// df457ee6973f6f9d557c57aa3fc14258303486ec8b8742fd37b4369c1f37dbdc.
// Pass as attachDispatch({decision: sample}). Serialize this function for the
// pre-instantiation Worker prefix just like the existing request decoder.
// Verify the full media/module/Worker identities outside this decoder as usual.
function sample(category, ex, memory, layout) {
  const names = ['Acquire', 'Unacquire', 'GetDeviceState', 'GetDeviceData',
    'SetDataFormat', 'SetEventNotification', 'SetCooperativeLevel'];
  let method = null;
  if (/^com:109[1-7]$/.test(category)) method = names[Number(category.slice(4)) - 1091];
  if (category === 'com:2864' || category === 'name:IDirectInputDevice2_Poll') method = 'Poll';
  if (category.startsWith('name:IDirectInputDevice_')) method = category.slice(24);
  if (!names.includes(method) && method !== 'Poll') return null;
  const d = new DataView(memory.buffer);
  const p = (a, n = 4) => {
    const w = ex.guest_to_wasm(a) >>> 0;
    if (w <= 0xf0 || w + n > d.byteLength) throw Error('poll decision translation');
    return w;
  };
  const u = a => d.getUint32(p(a), true);
  // Check both mouse gates and the actual call instruction, not a guessed
  // address from another build. Changed game code must fail observation.
  const signature = [0xa0,0xfe,0xc8,0x5f,0,0x53,0x3c,1,0x8a,0xd9,0x75,0x0f,
    0x66,0x83,0x3d,4,0xc9,0x5f,0,0,0x76,5,0xe8,0x85,3,0,0];
  const code = new Uint8Array(memory.buffer, p(0x4fa160, signature.length), signature.length);
  if (signature.some((v, i) => code[i] !== v)) throw Error('MW3 mouse gate code mismatch');
  const esp = ex.get_esp() >>> 0, thisPtr = u(esp + 4), slot = u(thisPtr + 4);
  if (!Number.isInteger(layout.objectsBase) || !Number.isInteger(layout.objectsSize) ||
      slot >= layout.objectsSize / 32) throw Error('poll decision device slot');
  const entry = layout.objectsBase + slot * 32;
  if (entry < 0 || entry + 32 > d.byteLength) throw Error('poll decision device entry');
  const mouseFlags = d.getUint8(p(0x5fc8fe)), mouseUsers = d.getUint16(p(0x5fc904), true);
  return {method, caller: u(esp), thisPtr, deviceType: d.getUint32(entry + 8, true),
    deviceFlags: d.getUint32(entry + 28, true), mouseDevice: u(0x600ac8),
    mouseFlags, mouseUsers, mouseGateOpen: mouseFlags === 1 && mouseUsers > 0,
    keyboardFlags: d.getUint8(p(0x5fc8fc)), keyboardUsers: d.getUint16(p(0x5fc900), true),
    gameAcquired: u(0x600f84), cooperativeFlags: u(0x5b6d78)};
}

module.exports = {sample};
