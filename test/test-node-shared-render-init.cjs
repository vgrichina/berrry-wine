#!/usr/bin/env node
'use strict';
// Two real Node Workers: the production guest and production native renderer.
// Software-GL texture packets exercise the shared publication route without a
// browser or GPU. Neither renderer nor transport target methods are replaced.
const assert = require('node:assert/strict');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { bootRenderHarness } = require('./render-helper');
const { GuestThreadHost } = require('../lib/guest-thread-host');
const { Manager, PublicationQueue } = require('../lib/render-worker');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;

const extraWat = String.raw`
  (func (export "node_render_texture") (param $d i32) (param $stage i32)
      (param $entry i32) (param $dest i32) (param $color i32) (result i32)
    (store.field DxObject width (local.get $entry) (i32.const 1))
    (store.field DxObject height (local.get $entry) (i32.const 1))
    (store.field DxObject pitch (local.get $entry) (i32.const 4))
    (store.field DxObject misc1 (local.get $entry) (local.get $dest))
    (i32.store (local.get $stage) (local.get $color))
    (i32.store (local.get $d) (local.get $stage))
    (i32.store offset=4 (local.get $d) (i32.const 4))
    (i32.store offset=8 (local.get $d) (local.get $entry))
    (i32.store offset=12 (local.get $d) (i32.const 0))
    (i32.store offset=16 (local.get $d) (i32.const 0))
    (i32.store offset=20 (local.get $d) (i32.const 1))
    (i32.store offset=24 (local.get $d) (i32.const 1))
    (call $host_gpu_gl_call (i32.const 0x20006) (local.get $d) (i32.const 0)))
  (func (export "node_render_fence") (result i32)
    (call $host_gpu_gl_call (i32.const 0x20001) (i32.const 0) (i32.const 0)))
`;

async function exercise() {
  const deadline = setTimeout(() => { console.error('Node shared renderer test deadline'); process.exit(1); }, 45000);
  try {
    const h = await bootRenderHarness({ extraWat, fonts: 'none' });
    h.exports.init_thread(1, 0x400000, 0, 0, 0, 0, 0);
    h.exports.heap_init(0x800000);
    const logs = [];
    let manager, renderWorker, guestWorker, link;
    const host = new GuestThreadHost({ module: h.module, memory: h.memory,
      hostImports: h.host, sigs, sharedRenderWorker: true, clockIntervalMs: 2,
      workerUrl: path.resolve(__dirname, '../lib/guest-worker.js'),
      log: text => logs.push(text),
      createRenderEndpoint: options => {
        manager ||= new Manager({ module: h.module, memory: h.memory, sigs,
          imageBase: 0x400000, reclaimHeap: head => h.exports.d3d_render_adopt_free_list(head),
          workerFactory: () => renderWorker = new Worker(path.resolve(__dirname, '../lib/d3d-render-worker.js')) });
        return manager.createEndpoint(options);
      } });
    const q = new PublicationQueue(host.renderPublication);
    try {
      await host.start();
      link = host.link; guestWorker = link.worker;
      assert(guestWorker instanceof Worker, 'production guest runs in a real Worker');
      await host.callExport('init_thread', 1, 0x400000, 0, 0, 0, 0, 0);
      const guest = await host.callExport('guest_alloc', 1024);
      assert(guest, 'real guest allocation');
      const base = await host.callExport('guest_to_wasm', guest);
      const [descriptor, stage, entry, dest] = [base, base + 64, base + 128, base + 512];
      const memory = new DataView(h.memory.buffer);
      memory.setUint32(dest - 4, 0x13572468, true);
      memory.setUint32(dest, 0, true);
      memory.setUint32(dest + 4, 0x24681357, true);
      // One native texture copy, then two conflicting copies in a single
      // publication. The final literal pixel proves FIFO replay, not just ack.
      for (const colors of [[0xff123456], [0xffabcdef, 0xff765432]]) {
        for (const color of colors)
          assert.equal(await host.callExport('node_render_texture', descriptor, stage, entry, dest, color), 1);
        assert.equal(await host.callExport('node_render_fence'), 1);
        assert.equal(memory.getUint32(dest, true), colors.at(-1));
      }
      assert(renderWorker instanceof Worker, 'actual production renderer Worker');
      assert.equal(memory.getUint32(dest - 4, true), 0x13572468);
      assert.equal(memory.getUint32(dest + 4, true), 0x24681357);
      assert.equal(q.snapshot().packets, 2, 'two real publication descriptors');
      assert.equal(Atomics.load(q.control, 1), Atomics.load(q.control, 2), 'accepted publication storage credited');
      const endpoint = link._renderLegacyEndpoint;
      assert.equal(endpoint.options.api, 'legacy');
      assert.equal(endpoint.closed, false);
      assert.deepEqual(logs.filter(s => /unexpected|worker error|render publication/.test(s)), []);
      // A failed real queue must reject the next fence. No more execution is
      // requested from this actor after that failure, only lifecycle cleanup.
      const before = q.snapshot();
      q.fail();
      await assert.rejects(host.callExport('node_render_fence'), /publication queue closed or failed/);
      assert.deepEqual(q.snapshot(), before, 'failed queue posts no new packet');
      assert.equal(logs.filter(s => s === '[guest-worker 0] callExport: render publication queue closed or failed').length, 1,
        'the negative transport fault is reported');
    } finally {
      await host.stop();
      if (manager) await manager.stop();
      assert.equal(host.link, null);
      assert(!host._clock || host._clock._destroyed);
      assert.equal(host._startingLinks.size, 0);
      assert.equal(host._retirementLinks?.size || 0, 0);
      if (link) assert(link._retirementComplete);
      if (guestWorker) assert.equal(guestWorker.threadId, -1);
      if (renderWorker) assert.equal(renderWorker.threadId, -1);
    }
    console.log('PASS real production guest/renderer init, 2 publications/3 native copies, FIFO pixels, failed queue, joined exits');

    // Malformed init also uses a fresh production Worker and retains the
    // constructor failure instead of acknowledging a graphics-disabled start.
    const bad = new GuestThreadHost({ module: h.module, memory: h.memory,
      hostImports: h.host, sigs, sharedRenderWorker: true, clockIntervalMs: 2,
      workerUrl: path.resolve(__dirname, '../lib/guest-worker.js'), log: () => {} });
    bad.renderPublication = new SharedArrayBuffer(64 + 65);
    try {
      await assert.rejects(bad.start(), /publication capacity must be a power of two/);
      assert.equal(bad.link, null);
      assert(!bad._clock || bad._clock._destroyed);
      assert.equal(bad._retirementLinks?.size || 0, 0);
    } finally { await bad.stop(); }
    console.log('PASS fresh production Worker malformed-publication init rejects and cleans up');
  } finally { clearTimeout(deadline); }
}
if (require.main === module) exercise().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { exercise };
