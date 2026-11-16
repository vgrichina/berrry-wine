// D3DIM's GPU stream v2 consumer (docs/gpu-stream-v2-migration.md, D2a).
// src/09abg-d3dim-gps.wat lowers every DirectDraw/Direct3D 2-7 draw, clear,
// fence and present to generic v2 records; the API-neutral
// lib/gpu-stream-host.js bridge drains them (render Worker with a doorbell,
// or local in cooperative mode). This file only names the endpoint:
// 'd3dim-gps', because 'd3dim' is the legacy software render-Worker arm.
(function(root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const api = factory(node ? require('./gpu-stream-host') : root.GpuStreamHost);
  if (node) module.exports = api;
  if (root) root.D3DIMHost = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(GpuStreamHost) {
  'use strict';
  class Bridge extends GpuStreamHost.Bridge {
    constructor(options = {}) { super({ ...options, api: 'd3dim-gps' }); }
  }
  return { Bridge, rendererName: GpuStreamHost.rendererName };
});
