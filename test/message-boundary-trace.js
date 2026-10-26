'use strict';

// CLI diagnostics only. log_api_exit is post-handler, NOT a successful API
// return: parked calls and deferred guest hooks reach it too. Never associate
// its register snapshot with a previous API name or a previous host dequeue.
function createMessageBoundaryTrace({ enabled, logs, snapshot, getContext }) {
  const maxRecords = 128, maxBytes = 64 * 1024, tailBytes = 1024;
  let count = 0, bytes = 0, saturated = false;
  let armed = false; // Arm at the frozen menu; boot must not spend the budget.
  function append(record) {
    const line = '[message-boundary] ' + JSON.stringify(record);
    const size = Buffer.byteLength(line + '\n');
    logs.push(line);
    count++;
    bytes += size;
  }
  function emit(kind, read) {
    if (!enabled || saturated || (!armed && kind !== 'capabilities')) return;
    try {
      let detail;
      try { detail = read(); }
      catch (_) { detail = { observationError: true }; }
      let batch = null;
      try { const b = snapshot().batch; if (Number.isSafeInteger(b)) batch = b; } catch (_) {}
      const record = { kind, sequence: count + 1, batch, correlation: 'unknown', ...detail };
      const size = Buffer.byteLength('[message-boundary] ' + JSON.stringify(record) + '\n');
      if (count >= maxRecords - 1 || bytes + size > maxBytes - tailBytes) {
        saturated = true;
        append({ kind: 'saturated', reason: count >= maxRecords - 1 ? 'records' : 'bytes',
          recordsBefore: count, bytesBefore: bytes, maxRecords, maxBytes,
          absenceIsNotEvidence: true });
      } else append(record);
    } catch (_) {
      // Diagnostic callbacks (including a failing sink) must not change guest
      // execution, the original callback's return, or its exception.
      saturated = true;
    }
  }
  const u32 = n => n >>> 0;
  const signed16 = n => (n << 16) >> 16;
  function context() {
    const { exports: e, memory, translate } = getContext();
    const dv = new DataView(memory.buffer);
    const read = address => dv.getUint32(translate(u32(address)), true);
    return { e, read };
  }
  function msg(read, pointer) {
    return { hwnd: read(pointer), message: read(pointer + 4), wParam: read(pointer + 8),
      lParam: read(pointer + 12), time: read(pointer + 16),
      pointX: read(pointer + 20) | 0, pointY: read(pointer + 24) | 0 };
  }
  emit('capabilities', () => ({ maxRecords, maxBytes, hostDequeue: true,
    dispatchEntry: true, successfulReturnMSG: false,
    reason: 'canonical invocation-owned completion hook unavailable',
    scope: 'main-instance API; shared host dequeue has unknown polling thread' }));
  return {
    dequeue(evt, source) {
      emit('host-dequeue', () => ({ source: ['pending', 'cross-thread', 'button-queue', 'renderer'].includes(source) ? source : 'unknown',
        hwnd: u32(evt.hwnd), message: u32(evt.msg), wParam: u32(evt.wParam), lParam: u32(evt.lParam),
        packed: u32((evt.wParam << 16) | (evt.msg & 0xffff)),
        coordinateSpace: evt.msg === 0x84 ? 'screen' : 'message-dependent',
        x: signed16(evt.lParam), y: signed16(evt.lParam >>> 16),
        mouseX: typeof evt.mouseX === 'number' ? evt.mouseX : null,
        mouseY: typeof evt.mouseY === 'number' ? evt.mouseY : null,
        mouseButtons: typeof evt.mouseButtons === 'number' ? evt.mouseButtons : null }));
    },
    api(name) {
      if (!enabled || !armed || saturated || !/^(PeekMessage|GetMessage|DispatchMessage)[AW]$/.test(name)) return;
      emit('api-entry', () => {
        const { e, read } = context(), esp = u32(e.get_esp()), pointer = read(esp + 4);
        const record = { api: name, thread: u32(e.get_current_thread_id()), esp,
          msgPointer: pointer, successfulReturn: null };
        if (name.startsWith('DispatchMessage')) record.msg = msg(read, pointer);
        else Object.assign(record, { filterHwnd: read(esp + 8), filterMin: read(esp + 12),
          filterMax: read(esp + 16), removeFlags: name.startsWith('PeekMessage') ? read(esp + 20) : null,
          pmRemove: name.startsWith('PeekMessage') ? !!(read(esp + 20) & 1) : true,
          msg: null }); // MSG at entry may be stale or unwritten; never read it.
        return record;
      });
    },
    wrapPostHandler(original) {
      if (!enabled) return original;
      return function (...args) {
        const result = Reflect.apply(original, this, args);
        emit('post-handler-unqualified', () => {
          const { e } = context();
          return { invocation: 'unknown', successfulReturn: null, msg: null,
            eaxRaw: u32(e.get_eax()), esp: u32(e.get_esp()), eip: u32(e.get_eip()),
            thread: u32(e.get_current_thread_id()), yieldFlag: u32(e.get_yield_flag()),
            yieldReason: u32(e.get_yield_reason()) };
        });
        return result;
      };
    },
    arm(on) { armed = !!enabled && on === true; },
    status: () => ({ records: count, bytes, saturated, armed, successfulReturnMSG: false }),
  };
}

module.exports = { createMessageBoundaryTrace };
