// Glide's GPU stream v2 consumer (docs/gpu-stream-v2.md). Glide carries no
// JS state at all: src/09a8h-glide.wat lowers every Glide call to v2 records,
// and the API-neutral lib/gpu-stream-host.js bridge drains them (render
// Worker with a doorbell, or local in cooperative mode) and presents frames
// into the window's GPU frame layer. This file only names the endpoint.
(function(root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const api = factory(node ? require('./gpu-stream-host') : root.GpuStreamHost);
  if (node) module.exports = api;
  if (root) root.GlideHost = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(GpuStreamHost) {
  'use strict';
  class Bridge extends GpuStreamHost.Bridge {
    constructor(options = {}) { super({ ...options, api: 'glide' }); }
  }
  return { Bridge, rendererName: GpuStreamHost.rendererName };
});
