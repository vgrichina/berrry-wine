'use strict';

// Read-only decoder for a *verified GetDeviceData completion*, after its
// stdcall ESP adjustment. The caller must first verify the executing module,
// breakpoint body/location, Worker owner/epoch and freshness. This helper does
// not install breakpoints, authorize input, or replace those identity checks.
// Unlike GetDeviceState, cbObjectData is a record stride, and *pdwInOut is an
// event count. MW3 requests legacy 16-byte DIDEVICEOBJECTDATA records.
function readCompletion(ex, memory, expected) {
  const check = (ok, why) => { if (!ok) throw new Error(why); };
  check(expected && expected.api === 'IDirectInputDevice_GetDeviceData', 'completion API');
  const d = new DataView(memory.buffer);
  const u = a => {
    check(Number.isInteger(a) && a > 0 && a <= 0xfffffffc, 'guest read address');
    const wa = ex.guest_to_wasm(a) >>> 0;
    check(wa > 0xf0 && wa + 4 <= d.byteLength, 'guest read translation');
    return d.getUint32(wa, true);
  };
  const esp = ex.get_esp() >>> 0;
  const result = {
    api: expected.api, esp, eax: ex.get_eax() >>> 0,
    returnAddress: u(esp - 24), thisPtr: u(esp - 20),
    stride: u(esp - 16), buffer: u(esp - 12), countPtr: u(esp - 8),
    flags: u(esp - 4),
  };
  for (const name of ['returnAddress', 'thisPtr', 'buffer', 'countPtr']) {
    check(Number.isInteger(expected[name]) && result[name] === expected[name], name);
  }
  check(result.eax === 0, 'successful lossless completion required');
  check(result.stride === 16, 'MW3 legacy record stride');
  check(result.flags === 0 || result.flags === 1, 'GetDeviceData flags');
  const slot = u(result.thisPtr + 4);
  check(Number.isInteger(expected.objectsBase) && Number.isInteger(expected.objectsSize) &&
    slot < expected.objectsSize / 32, 'device slot');
  const entry = expected.objectsBase + slot * 32;
  check(entry >= 0 && entry + 32 <= d.byteLength, 'device entry');
  check(d.getUint32(entry, true) === 7, 'DirectInput device object');
  check(d.getUint32(entry + 8, true) === 1, 'keyboard device');
  check(d.getUint32(entry + 20, true) === 256, 'standard keyboard format');
  check((d.getUint32(entry + 28, true) & 0x400) !== 0, 'acquired keyboard');
  result.count = u(result.countPtr);
  check(Number.isInteger(expected.requested) && expected.requested >= 0 &&
    expected.requested <= 128 && result.count <= expected.requested, 'bounded returned count');
  check(result.buffer !== 0, 'data buffer required for consumption evidence');
  result.records = Array.from({ length: result.count }, (_, i) => {
    const at = result.buffer + i * result.stride;
    const record = { offset: u(at), data: u(at + 4), timestamp: u(at + 8), sequence: u(at + 12) };
    check(record.offset < 256, 'keyboard format offset');
    return record;
  });
  return result;
}

// A peek can report both edges repeatedly without the application consuming
// either. Count queries, failures, overflow and a physical-up snapshot likewise
// cannot establish a consumed pulse. Only ordered successful non-peek returns
// from the already identity-bound decoder qualify here.
function requireConsumedPulse(completions, offset = 6) {
  let press;
  let owner;
  for (const completion of completions) {
    if (completion.api !== 'IDirectInputDevice_GetDeviceData' ||
        completion.eax !== 0 || completion.flags !== 0) continue;
    for (const record of completion.records) {
      if (record.offset !== offset) continue;
      const key = [completion.thisPtr, completion.buffer, completion.countPtr,
        completion.returnAddress].join(':');
      if (record.data & 0x80) { press = record; owner = key; }
      else if (press && owner === key && ((record.sequence - press.sequence) >>> 0) > 0 &&
          ((record.sequence - press.sequence) >>> 0) < 0x80000000) return { press, release: record };
    }
  }
  throw new Error('consumed press and later release required');
}

module.exports = { readCompletion, requireConsumedPulse };
