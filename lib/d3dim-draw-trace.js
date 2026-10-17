// Opt-in diagnostic only. Raw owning-worker inputs, not a replayable frame.
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.D3DIMDrawTrace = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  function create({ endpointId, maxBytes = 262144, maxCommands = 16, timeoutMs = 1000 } = {}) {
    for (const [name, value, limit] of [
      ['endpointId', endpointId, 0xffffffff], ['maxBytes', maxBytes, 4194304],
      ['maxCommands', maxCommands, 256], ['timeoutMs', timeoutMs, 5000],
    ]) if (!Number.isSafeInteger(value) || value < 1 || value > limit)
      throw new RangeError('invalid trace ' + name);
    const records = [];
    let bytes = 0, phase = 'recording', reason = null;
    const timer = setTimeout(() => stop('deadline'), timeoutMs);
    function stop(why = 'requested') {
      if (phase !== 'recording') return;
      phase = 'stopped'; reason = why; clearTimeout(timer);
    }
    function record(source, offset, sequence, ordinal) {
      if (phase !== 'recording') return;
      // Observation must never swallow a real renderer result or exception.
      try {
        const d = new DataView(source.buffer, source.byteOffset, source.byteLength);
        if (!Number.isSafeInteger(offset) || offset < 0 || offset + 32 > source.byteLength)
          return stop('malformed-record');
        const size = d.getUint32(offset, true), kind = d.getUint32(offset + 28, true);
        if (kind !== 0) return stop('unsupported-record-' + kind);
        const stateBytes = d.getUint32(offset + 20, true);
        const vertexBytes = d.getUint32(offset + 24, true);
        const count = d.getUint32(offset + 16, true);
        const type = d.getUint32(offset + 12, true);
        if (size !== 32 + stateBytes + vertexBytes || stateBytes !== 4096 ||
            size > source.byteLength - offset || vertexBytes !== count * 32 ||
            !count || type < 1 || type > 3)
          return stop('malformed-record');
        if (records.length >= maxCommands) return stop('command-limit');
        if (size > maxBytes - bytes) return stop('byte-limit');
        records.push({ sequence, ordinal,
          header: source.slice(offset, offset + 32),
          state: source.slice(offset + 32, offset + 32 + stateBytes),
          vertices: source.slice(offset + 32 + stateBytes, offset + size) });
        bytes += size;
        if (records.length === maxCommands) stop('command-limit');
      } catch (_) { stop('observation-error'); }
    }
    function receipt() {
      return { version: 1, kind: 'legacy-d3dim-owning-draw-trace', endpointId,
        replayable: false, complete: false, phase, reason, bytes,
        maxBytes, maxCommands, timeoutMs, commands: records.length,
        limitations: 'Raw state/vertices only; live resource pointers, initial color/depth, clears and guest writes are not preserved. Not a frame or correctness result.',
        records: records.map(r => ({ ...r, header: r.header.slice(),
          state: r.state.slice(), vertices: r.vertices.slice() })) };
    }
    return { record, stop, receipt, get active() { return phase === 'recording'; } };
  }
  return { create };
});
