'use strict';
// Real Worker + real queue: USER transport must not depend on a pending GPU
// admission. The broker still receives prior UI updates and owning metadata.
const assert = require('node:assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const RPC = require('../lib/guest-rpc');
const { PublicationQueue } = require('../lib/render-worker');
const sigs = {
  set_mouse_position: { params: ['i32', 'i32'], results: [] },
  input_validate: { params: ['i32'], results: ['i32'] },
  check_input: { params: [], results: ['i32'] },
  input_consumed: { params: ['i32', 'i32', 'i32'], results: ['i32'] },
  gpu_gl_call: { params: ['i32', 'i32', 'i32'], results: ['i32'] },
};
if (!isMainThread) {
  const { memory, publication, mode } = workerData;
  const e = { get_main_hwnd: () => 65, get_focus_hwnd: () => 65,
    wnd_lookup_generation: () => 3n, get_window_thread: () => 7,
    get_current_thread_id: () => 7, get_process_id: () => 8,
    modal_dialog_hwnd: () => 0, get_capture_hwnd: () => 65,
    guest_to_wasm: p => p + 16 };
  const w = RPC.createWorkerImports(memory, sigs, m => parentPort.postMessage(m),
    { slot: 2, renderPublication: publication, getExports: () => e });
  try {
    if (mode === 'failure') {
      for (const [name, args] of [['check_input', []], ['input_validate', [9]],
        ['input_consumed', [9, 1, 32]]]) {
        assert.throws(() => w.imports.host[name](...args), /publication queue closed or failed/);
      }
    } else {
      w.imports.host.set_mouse_position(12, 34);
      assert.equal(w.imports.host.check_input(), 0x201);
      assert.equal(w.imports.host.input_validate(9), 1);
      assert.equal(w.imports.host.input_consumed(9, 1, 32), 1);
      parentPort.postMessage({ t: 'inputDone' });
      assert.equal(w.imports.host.gpu_gl_call(0x10002, 65, 0), 123);
    }
    parentPort.postMessage({ t: 'done' });
  } catch (e) { parentPort.postMessage({ t: 'error', error: e.stack }); }
} else {
  async function run(mode) {
    const memory = { buffer: new SharedArrayBuffer(8192 * 65536) };
    const q = new PublicationQueue(new SharedArrayBuffer(64 + 256));
    const order = [], context = [7, 8, 65, 65, 0, 65, 3, 0, 3, 0];
    let release, entered, inputDone = false, graphics = false;
    const gate = new Promise(r => { release = r; });
    const admitted = new Promise(r => { entered = r; });
    q.publish(1, 2, new Uint8Array([7]), () => {});
    const drain = q.drain(async group => {
      assert.equal(group.owner, 2); entered(); await gate;
    });
    await admitted;
    if (mode === 'failure') q.fail();
    const main = RPC.createMainBroker(memory, {
      set_mouse_position: (x, y) => order.push(['warp', x, y]),
      input_validate: (...a) => {
        order.push(['validate', ...a]);
        if (a[0] === 0) return 0x424e49;
        assert.deepEqual(a, [9, ...context]); return 1;
      },
      check_input: (...a) => {
        assert.deepEqual(a, context);
        assert.deepEqual(order[0], ['warp', 12, 34]);
        order.push(['input']); return 0x201;
      },
      input_consumed: (...a) => {
        assert.deepEqual(a, [9, 1, 32, ...context, 48]);
        order.push(['consumed']); return 1;
      },
      gpu_gl_call: () => { graphics = true; return 123; },
    }, sigs);
    const w = new Worker(__filename, { workerData: { memory, publication: q.buffer, mode } });
    let regression;
    const timeout = setTimeout(() => {
      regression = new Error('USER RPC blocked behind held GPU publication');
      release();
    }, 1500);
    try {
      await new Promise((resolve, reject) => {
        w.on('error', reject);
        w.on('message', m => {
          try {
            if (m.t === 'calls') main.serveCalls(m);
            else if (m.t === 'rpc') { assert.equal(m.slot, 2); main.serveRpc(m.slot); }
            else if (m.t === 'inputDone') {
              inputDone = true; clearTimeout(timeout);
              if (regression) throw regression;
              assert.notEqual(Atomics.load(q.control, 1), Atomics.load(q.control, 2));
              setTimeout(() => {
                try { assert.equal(graphics, false, 'graphics RPC must still fence'); }
                catch (e) { regression = e; }
                release();
              }, 30);
            } else if (m.t === 'error') reject(new Error(m.error));
            else if (m.t === 'done') resolve();
          } catch (e) { reject(e); }
        });
      });
      if (regression) throw regression;
      if (mode === 'failure') assert.deepEqual(order, [], 'failed transport posts no input RPC');
      else { assert(inputDone); assert(graphics); }
      console.log('PASS actual Worker held publication: ' + mode);
    } finally {
      clearTimeout(timeout); release();
      try {
        if (mode === 'failure') await assert.rejects(drain, /closed or failed/);
        else await drain;
      } finally { q.fail(); await w.terminate(); }
    }
  }
  (async () => { await run('pending'); await run('failure'); })().catch(e => {
    console.error(e); process.exitCode = 1;
  });
}
