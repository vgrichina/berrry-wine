'use strict';

// Serializable, read-only diagnostic for the render Worker's public endpoint
// surface. Legacy D3DIM keeps its GPU and target map inside a closure; absence
// of a public target map is unavailable evidence, never an empty target set.
function snapshotRenderEndpoints(endpoints) {
  return {
    at: Date.now(), mono: performance.now(),
    endpoints: Array.from(endpoints, ([id, e]) => {
      const adapter = e.adapter;
      const available = adapter != null && adapter.targets != null;
      if (available && typeof adapter.targets.values !== 'function')
        throw Error('render diagnostic target collection unsupported');
      return {
        id, options: e.options, evidence: e.evidence,
        adapterPresent: !!adapter, stats: adapter?.stats ?? null,
        targetsAvailable: available,
        targetsUnavailableReason: available ? null : 'adapter exposes no target collection',
        targets: available ? Array.from(adapter.targets.values(), t => ({
          width:t.width, height:t.height, bpp:t.bpp, format:t.format,
          nativeStorage:!!t.nativeStorage,
        })) : null,
        control: Array.from(e.control ?? []),
      };
    }),
  };
}

module.exports = {snapshotRenderEndpoints};
