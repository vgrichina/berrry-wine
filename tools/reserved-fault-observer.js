'use strict';

// Synchronous observation only. Never call g2w, guest allocators, or handlers.
// PTE presence (0x800) matches guest_page_translate; an absent page is a hole.
function snapshotReservedFault(exports, memory, layout, event) {
  const bytes = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const regs = {};
  for (const n of ['eip', 'eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi', 'fs_base', 'image_base']) regs[n] = exports['get_' + n]() >>> 0;
  const table = new Uint32Array(memory.buffer, layout.BASE.GUEST_PAGE_TABLE, layout.SIZE.GUEST_PAGE_TABLE >>> 2);
  const shared = Object.prototype.toString.call(memory.buffer) === '[object SharedArrayBuffer]';
  const pages = new Map(), holes = [], issues = [];
  function translate(a) {
    const pte = (shared ? Atomics.load(table, a >>> 12) : table[a >>> 12]) >>> 0;
    const direct = (a - regs.image_base + layout.GUEST_BASE) >>> 0;
    const dib = (a - 0x50000000) >>> 0;
    const wa = direct < 0x08000000 ? direct : dib < 0x03f00000 ? layout.BASE.DIB_BACKING_BASE + dib : pte & 0x800 ? ((pte & 0xfffff000) | (a & 4095)) >>> 0 : null;
    pages.set(a >>> 12, { guestPage: (a & 0xfffff000) >>> 0, pte });
    return wa;
  }
  function read(a, n) {
    if (!Number.isSafeInteger(a) || a < 0 || a + n > 0x100000000 || n > 64) { issues.push({ invalidRange: a, n }); return null; }
    const fragments = [], missing = []; let fragment = null, hole = null;
    for (let i = 0; i < n; i++) {
      const wa = translate(a + i);
      // The direct window includes wasm offsets below GUEST_BASE, including
      // zero. Its production fast path has no GUEST_BASE lower bound.
      if (wa === null || wa < 0 || wa >= bytes.length) {
        fragment = null;
        if (!hole) { hole = { address: a + i, offset: i, missingBytes: 0 }; missing.push(hole); holes.push(hole); }
        hole.missingBytes++;
      } else {
        hole = null;
        if (!fragment) { fragment = { address: a + i, offset: i, bytes: [] }; fragments.push(fragment); }
        fragment.bytes.push(bytes[wa]);
      }
    }
    const complete = missing.length === 0;
    return { bytes: complete ? fragments.flatMap(f => f.bytes) : null, complete, fragments, missing };
  }
  const word = a => { const r = read(a, 4); return r?.complete ? new DataView(Uint8Array.from(r.bytes).buffer).getUint32(0, true) : null; };
  const contexts = {};
  for (const [name, a] of Object.entries({ fault: event.address, stack: regs.esp, esi: regs.esi, edi: regs.edi })) contexts[name] = { address: a, data: read(a, 64) };
  const frames = [], seen = new Set(); let frame = word(regs.fs_base);
  for (let i = 0; frame !== null && frame !== 0 && frame !== 0xffffffff && i < 16; i++) {
    if (seen.has(frame)) { issues.push({ fsCycle: frame }); break; } seen.add(frame);
    const next = word(frame), handler = word(frame + 4), scope = word(frame + 8), level = word(frame + 12);
    const row = { frame, next, handler, scope, level, candidateMsvcScopes: [] }; frames.push(row);
    let index = level; const levels = new Set();
    for (let k = 0; scope !== null && index !== null && index !== 0xffffffff && k < 4; k++) {
      if (index > 255 || levels.has(index)) { issues.push({ invalidScope: index, frame }); break; } levels.add(index);
      const a = scope + 12 * index, enclosing = word(a), filter = word(a + 4), body = word(a + 8);
      row.candidateMsvcScopes.push({ index, enclosing, filter, body }); index = enclosing;
    }
    if (i === 15 && next !== 0 && next !== 0xffffffff) issues.push({ framesTruncated: true });
    frame = next;
  }
  const state = layout.BASE.VIRTUAL_MAP_STATE, reserve = layout.BASE.VIRTUAL_RESERVE_TABLE;
  if (state + 20 > bytes.length || reserve + layout.SIZE.VIRTUAL_RESERVE_TABLE > bytes.length) throw Error('Invalid reservation layout');
  const count = dv.getUint32(state + 16, true), reservations = [];
  if (count > layout.SIZE.VIRTUAL_RESERVE_TABLE / 8) issues.push({ invalidReservationCount: count });
  else for (let i = 0; i < count; i++) {
    const raw = dv.getUint32(reserve + i * 8, true), base = (raw & 0xfffff000) >>> 0, size = dv.getUint32(reserve + i * 8 + 4, true);
    if ([...pages.values()].some(p => p.guestPage >= base && p.guestPage - base < size)) {
      if (reservations.length === 128) { issues.push({ reservationsTruncated: true }); break; }
      reservations.push({ index: i, rawBaseProtection: raw, base, size });
    }
  }
  if (dv.getUint32(state + 16, true) !== count) issues.push({ concurrentReservationChange: true });
  return { readOnly: true, atomic: false,
    consistency: 'PTEs are reloaded per byte; page summaries contain the last observed PTE. Reservation count checks cannot detect replacement at the same count. Registers, bytes and metadata need not describe one instant.',
    regs, contexts, frames, reservationCount: count, reservations, pages: [...pages.values()], holes, issues };
}

function createReservedFaultObserver({ snapshot, save, checkpoint = () => {} }) {
  const pending = new Map(), successful = []; let stopped = false, lastId = 0;
  function observe(event) {
    if (stopped) throw Error('Reserved fault observer already stopped');
    if (!Number.isInteger(event.id) || event.id < 1 || event.id > 256 || !Number.isInteger(event.phase) || event.phase < 1 || event.phase > 6) throw Error('Invalid reserved fault event');
    if (event.phase === 1) {
      if (event.id <= lastId || pending.size >= 64) throw Error('Reserved fault pairing limit or reused ID');
      lastId = event.id;
      pending.set(event.id, { event, state: snapshot(event) });
      // Preserve the pre-context even if a handler never returns to its post.
      checkpoint({ status: 'handling-pending', pending: [...pending.values()], recentSuccessful: successful });
      return;
    }
    const pre = pending.get(event.id);
    if (!pre || [...pending.keys()].at(-1) !== event.id || pre.event.address !== event.address || pre.event.eip !== event.eip) throw Error('Unpaired or non-LIFO reserved fault outcome');
    pending.delete(event.id);
    if (event.phase === 2) {
      successful.push({ id: event.id, address: event.address, eip: event.eip });
      if (successful.length > 16) successful.shift();
      checkpoint({ status: 'handling-completed', completed: event, pending: [...pending.values()], recentSuccessful: successful });
      if (event.id !== 256) return;
    }
    stopped = true;
    const result = { version: 1, status: event.phase === 2 ? 'event-budget-exhausted' : 'first-nonmapped-outcome', pre,
      post: { event, state: snapshot(event) }, pendingAncestors: [...pending.values()], recentSuccessful: successful };
    save(result);
    const error = Error('Reserved fault diagnostic captured; execution must not resume');
    error.code = 'RESERVED_FAULT_CAPTURED'; throw error;
  }
  return event => {
    try { return observe(event); }
    catch (error) {
      // Even a snapshot/checkpoint/protocol error may unwind through active
      // SEH without restoring its globals. Every error is terminal, not only
      // RESERVED_FAULT_CAPTURED. The owning controller must kill the instance.
      stopped = true;
      throw error;
    }
  };
}
module.exports = { snapshotReservedFault, createReservedFaultObserver };
