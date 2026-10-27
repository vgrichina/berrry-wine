'use strict';

// Metadata only: never writes guest state or calls back into the interpreter.
// 128 fixed scalar slots = 6144 backing bytes, no growing maps/retained MSGs.
// Ownership is transferred by explicit canonical entry/bind/resume wires.
function createMessageCompletionOwner({ enabled, observe, gap = () => {} }) {
  const slots = new Int32Array(128 * 12);
  const width = 12;
  let serial = 0, lost = false;
  function loss() {
    if (lost) return;
    lost = true;
    try { gap(); } catch (_) {}
  }
  function find(token) {
    if (!token) return -1;
    for (let p = 0; p < slots.length; p += width)
      if (slots[p] && slots[p + 1] === token) return p;
    return -1;
  }
  const imports = {
    message_begin(api, thread, esp, msg, hwnd, min, max, flags) {
      try {
        if (!enabled() || lost || api < 1 || api > 4) return 0;
        const args = [api, thread, esp, msg, hwnd, min, max, flags].map(n => n | 0);
        // Only a frame explicitly parked by this invocation may be retried.
        for (let p = 0; p < slots.length; p += width) {
          if (slots[p] !== 2 || slots[p + 3] !== (thread | 0) || slots[p + 4] !== (esp | 0)) continue;
          if (!args.every((v, i) => slots[p + 2 + i] === v)) { loss(); return 0; }
          slots[p] = 1;
          return slots[p + 1];
        }
        if (serial === 0x7fffffff) { loss(); return 0; }
        for (let p = 0; p < slots.length; p += width) {
          if (slots[p]) continue;
          slots[p] = 1; slots[p + 1] = ++serial;
          slots.set(args, p + 2);
          slots[p + 10] = slots[p + 11] = 0;
          return serial;
        }
        loss(); return 0;
      } catch (_) { loss(); return 0; }
    },
    message_park(token) {
      const p = find(token);
      if (p >= 0 && slots[p] === 1) slots[p] = 2;
    },
    message_bind(token, kind, context) {
      const p = find(token);
      if (p < 0 || slots[p] !== 1 || (kind !== 1 && kind !== 2)) return;
      for (let q = 0; q < slots.length; q += width) {
        if (slots[q] === 3 && slots[q + 10] === kind && slots[q + 11] === (context | 0)) {
          slots[p] = slots[q] = 4; loss(); return;
        }
      }
      slots[p] = 3; slots[p + 10] = kind; slots[p + 11] = context;
    },
    message_resume(kind, context) {
      for (let p = 0; p < slots.length; p += width) {
        if (slots[p] !== 3 || slots[p + 10] !== kind || slots[p + 11] !== (context | 0)) continue;
        slots[p] = 1;
        return slots[p + 1];
      }
      return 0;
    },
    message_complete(token, result) {
      const p = find(token);
      if (p < 0 || slots[p] !== 1) return; // parked/bound/duplicate/unrelated is never completion
      const detail = { invocation: slots[p + 1], api: slots[p + 2], thread: slots[p + 3] >>> 0,
        entryESP: slots[p + 4] >>> 0, msgPointer: slots[p + 5] >>> 0,
        filterHwnd: slots[p + 6] >>> 0, filterMin: slots[p + 7] >>> 0,
        filterMax: slots[p + 8] >>> 0, removeFlags: slots[p + 9] >>> 0, result: result | 0 };
      slots[p] = 0;
      try { if (enabled() && !lost) observe(detail); } catch (_) { loss(); }
    },
  };
  return { imports, status: () => ({ capacity: 128, backingBytes: slots.byteLength, lost }) };
}

module.exports = { createMessageCompletionOwner };
