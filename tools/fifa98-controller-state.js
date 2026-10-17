// Read-only expression for a separately reviewed browser observer. No input or writes.
(() => {
  const host = globalThis.wine;
  const identity = globalThis.__fifaModuleIdentity?.();
  if (identity?.sha256 !== '04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17')
    return { available: false, reason: 'module identity mismatch' };
  const ex = host?.instance?.exports, memory = host?.memory;
  if (!memory?.buffer || !ex?.get_image_base || ex.get_image_base() !== 0x400000 ||
      typeof host._guestToWasmAddress !== 'function')
    return { available: false, reason: 'expected guest mapping unavailable' };
  const buffer = memory.buffer;
  const read = (va, length) => {
    const out = [];
    for (let i = 0; i < length; i++) {
      const offset = host._guestToWasmAddress(va + i);
      if (!Number.isInteger(offset) || offset < 0x100 || offset >= buffer.byteLength)
        throw Error('unmapped controller observation');
      out.push(new Uint8Array(buffer)[offset]);
    }
    return out;
  };
  // Verify this original executable's initializer, not merely its image base.
  const signature = [0xb3, 1, 0x30, 0xf6, 0xb8, 0xe8, 0xd1, 0x58, 0];
  if (read(0x434141, signature.length).some((b, i) => b !== signature[i]))
    return { available: false, reason: 'original initializer signature mismatch' };
  // Guest VAs below come from this exact EXE, not emulator memory-map constants.
  const blocks = [
    { name: 'controller-init-count-and-lists', va: 0x58d1c0, bytes: read(0x58d1c0, 0x44) },
    { name: 'controller-records-and-pointer', va: 0x58d204, bytes: read(0x58d204, 0x4c) },
    { name: 'eight-mode-slot-lists', va: 0x58d250, bytes: read(0x58d250, 8 * 0x68) },
    { name: 'joystick-count', va: 0x5ccfa0, bytes: read(0x5ccfa0, 4) }
  ];
  if (memory.buffer !== buffer || ex.get_image_base() !== 0x400000)
    return { available: false, reason: 'mapping changed during observation' };
  return { available: true, module: identity, at: new Date().toISOString(), blocks,
    limitations: ['Unsynchronized read-only snapshot; no guest pause or writes.',
      'Record types and slot assignment need source interpretation; no device/gameplay proof.'] };
})();
