'use strict';
// Self-contained, serializable observer: no guest calls, translation faults,
// allocation, file reads or writes. All traversal caps are local constants.
function captureResolverState(exports, memory, layout) {
  const target = 0x004178eb;
  if ((exports.get_eip() >>> 0) !== target) throw Error('Wrong resolver breakpoint');
  const bytes = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const regs = {};
  for (const n of ['eip', 'eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi', 'fs_base', 'image_base']) regs[n] = exports['get_' + n]() >>> 0;
  const touched = new Map(), holes = [], issues = [];
  const table = new Uint32Array(memory.buffer, layout.BASE.GUEST_PAGE_TABLE, layout.SIZE.GUEST_PAGE_TABLE >>> 2);
  const shared = Object.prototype.toString.call(memory.buffer) === '[object SharedArrayBuffer]';
  const pte = ga => shared ? Atomics.load(table, ga >>> 12) >>> 0 : table[ga >>> 12] >>> 0;
  function translate(ga) {
    const direct = (ga - regs.image_base + layout.GUEST_BASE) >>> 0;
    if (direct < 0x08000000) return direct;
    const dib = (ga - 0x50000000) >>> 0;
    if (dib < 0x03f00000) return layout.BASE.DIB_BACKING_BASE + dib;
    const entry = pte(ga);
    return entry & 0x800 ? ((entry & 0xfffff000) | (ga & 4095)) >>> 0 : null;
  }
  function read(ga, n) {
    if (!Number.isSafeInteger(ga) || ga < 0 || ga + n > 0x100000000 || n > 4096) { issues.push({ kind: 'invalid-range', ga, n }); return null; }
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = ga + i, wa = translate(a), page = (a & 0xfffff000) >>> 0;
      if (!touched.has(page)) touched.set(page, { guestPage: page >>> 0, pte: pte(a), wasmAtPage: translate(page >>> 0) });
      if (wa === null || wa < 0x12000 || wa >= bytes.length) { holes.push({ guest: a, requestedStart: ga, requestedBytes: n, missingBytes: n - i, pte: pte(a) }); return null; }
      out.push(bytes[wa]);
    }
    return out;
  }
  const word = a => { const b = read(a, 4); return b && ((b[0] | b[1] << 8 | b[2] << 16 | b[3] << 24) >>> 0); };
  function string(a) {
    if (a < 0x10000) return { pointer: a, ordinal: a };
    const data = [];
    for (let i = 0; i < 128; i++) { const b = read(a + i, 1); if (!b) return { pointer: a, bytes: data, status: 'unmapped' }; if (!b[0]) return { pointer: a, bytes: data, status: 'terminated' }; data.push(b[0]); }
    return { pointer: a, bytes: data, status: 'truncated-128' };
  }
  const object = { address: regs.esi, name: word(regs.esi), begin: word(regs.esi + 12), end: word(regs.esi + 16), module: word(regs.esi + 24) };
  if (object.name !== null) object.nameString = string(object.name);
  const records = [];
  if (regs.ebx >= regs.edi && (regs.ebx - regs.edi) % 12 === 0) {
    const count = (regs.ebx - regs.edi) / 12;
    for (let i = 0; i < Math.min(count, 64); i++) {
      const address = regs.edi + i * 12, data = read(address, 12);
      if (!data) { records.push({ address, status: 'unmapped' }); break; }
      const d = new DataView(Uint8Array.from(data).buffer), output = d.getUint32(0, true), symbol = d.getUint32(4, true);
      records.push({ address, bytes: data, output, outputValue: word(output), symbol: string(symbol), optional: data[8] });
    }
    if (count > 64) issues.push({ kind: 'records-truncated', count });
  } else issues.push({ kind: 'invalid-record-endpoints', begin: regs.edi, end: regs.ebx });
  const frames = [], seen = new Set(); let frame = word(regs.fs_base);
  for (let n = 0; frame !== null && frame !== 0 && frame !== 0xffffffff && n < 16; n++) {
    if (seen.has(frame)) { issues.push({ kind: 'fs-cycle', frame }); break; } seen.add(frame);
    const next = word(frame), handler = word(frame + 4), scope = word(frame + 8), level = word(frame + 12);
    const item = { frame, next, handler, scope, level, scopes: [] }; frames.push(item);
    // An arbitrary raw frame need not be MSVC. Label interpretation as a
    // candidate, validate indices and cap traversal; retain raw words either way.
    const levels = new Set(); let index = level;
    for (let k = 0; scope !== null && index !== null && index !== 0xffffffff && k < 4; k++) {
      if (index > 255 || levels.has(index)) { issues.push({ kind: 'scope-invalid-or-cycle', frame, index }); break; } levels.add(index);
      const a = scope + index * 12, enclosing = word(a), filter = word(a + 4), body = word(a + 8);
      item.scopes.push({ candidateMsvc: true, index, enclosing, filter, body }); index = enclosing;
    }
    if (n === 15 && next !== 0 && next !== 0xffffffff) issues.push({ kind: 'fs-truncated', next });
    frame = next;
  }
  const state = layout.BASE.VIRTUAL_MAP_STATE, reserve = layout.BASE.VIRTUAL_RESERVE_TABLE;
  if (state + 20 > bytes.length || reserve + layout.SIZE.VIRTUAL_RESERVE_TABLE > bytes.length) throw Error('Invalid reserve layout');
  const count = dv.getUint32(state + 16, true), capacity = layout.SIZE.VIRTUAL_RESERVE_TABLE / 8;
  const reservations = []; let matchingReservations = 0;
  if (count > capacity) issues.push({ kind: 'invalid-reservation-count', count, capacity });
  else for (let i = 0; i < count; i++) {
    const raw = dv.getUint32(reserve + i * 8, true), base = (raw & 0xfffff000) >>> 0, size = dv.getUint32(reserve + i * 8 + 4, true);
    const pages = [...touched.keys()].filter(p => p >= base && p - base < size);
    if (pages.length) {
      matchingReservations++;
      if (reservations.length < 128) reservations.push({ index: i, rawBaseProtection: raw, base, size, observedPageCount: pages.length, observedPages: pages.slice(0, 16) });
    }
  }
  if (matchingReservations > 128) issues.push({ kind: 'reservations-truncated', matchingReservations });
  if (dv.getUint32(state + 16, true) !== count) issues.push({ kind: 'reservation-count-changed-during-observation' });
  if ((exports.get_eip() >>> 0) !== target || (exports.get_esi() >>> 0) !== regs.esi || (exports.get_edi() >>> 0) !== regs.edi) throw Error('Guest moved during capture');
  return { readOnly: true, eip: target, regs, object, records, frames, reservationCount: count, reservations,
    pages: [...touched.values()], holes, issues, limits: { records: 64, stringBytes: 128, frames: 16, scopeLevels: 4, reservations: 128, reservationPages: 16 },
    limit: 'First resolver entry only; scope records are candidate interpretations. No fault has been attributed by this observer.' };
}
module.exports = { captureResolverState };
