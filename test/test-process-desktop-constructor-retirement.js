'use strict';

// Real Node Workers and the production constructor/timeout. A controlled
// bootstrap stays alive without acknowledging authority readiness or hello.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const threads = require('node:worker_threads');
const filename = path.resolve(__dirname, '../lib/process-desktop.js');
const productionRequire = createRequire(filename);
const tick = () => new Promise(resolve => setImmediate(resolve));

async function failedBootstrap(stalledRole) {
  const workers = [];
  let directory;
  class ObservedWorker extends threads.Worker {
    constructor(file, options) {
      const stalled = options.workerData.role === stalledRole;
      super(stalled ? "require('node:worker_threads').parentPort.on('message', () => {});" : file,
        stalled ? { eval: true } : options);
      const record = { worker: this, role: options.workerData.role, exited: false };
      record.exit = new Promise(resolve => this.once('exit', code => {
        record.exited = true;
        resolve(code);
      }));
      this.on('error', error => { record.error = error; });
      workers.push(record);
      directory = path.dirname(options.workerData.endpoint.path);
    }
  }
  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module: mod, exports: mod.exports, __filename: filename, __dirname: path.dirname(filename),
    require(name) {
      return name === 'node:worker_threads' ? { ...threads, Worker: ObservedWorker }
        : productionRequire(name);
    },
    process, Buffer, SharedArrayBuffer, Int32Array, Uint8Array, DataView, Atomics,
    performance, setTimeout, clearTimeout, setImmediate, console,
  }, { filename });
  try {
    assert.throws(() => new mod.exports.ProcessDesktop({ endpoint: null, observeDirectory: null }),
      error => error.code === 'ETIMEDOUT', 'the unchanged production timeout rejects startup');
    // close() starts asynchronously even though construction throws. Wait only
    // for actual Worker exits; do not issue another desktop request or retry.
    let timer;
    try {
      await Promise.race([
        Promise.all(workers.map(record => record.exit)),
        new Promise(resolve => { timer = setTimeout(resolve, 1500); }),
      ]);
    } finally { clearTimeout(timer); }
    await tick();
    const liveRoles = workers.filter(record => !record.exited).map(record => record.role);
    const directoryExists = fs.existsSync(directory);
    console.log(JSON.stringify({ stalledRole, liveRoles, directoryExists,
      createdWorkers: workers.length, scope: 'actual Node constructor failure cleanup' }));
    assert.deepEqual(liveRoles, [], 'failed construction must retire every created Worker');
    assert.equal(directoryExists, false, 'failed construction must remove its owned socket directory');
  } finally {
    // The RED baseline is cleaned up by the test, not mistaken for production
    // cleanup. Preserve actual exit events even when an assertion fails.
    await Promise.all(workers.map(record => record.worker.terminate()));
    await Promise.all(workers.map(record => record.exit));
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  }
}

(async () => {
  await failedBootstrap('desktop-authority');
  await failedBootstrap('desktop-client');
  const { ProcessDesktop, prepareClient } = require('../lib/process-desktop');
  const desktop = new ProcessDesktop({ endpoint: null, observeDirectory: null });
  const directory = desktop.directory;
  try {
    assert.equal(typeof desktop.processId, 'number');
    assert.deepEqual(desktop.call({ op: 'snapshot' }).rows, []);
    const options = { endpoint: desktop.endpoint, observeDirectory: null };
    const preparation = prepareClient(options);
    const child = new ProcessDesktop({ ...options, preparation });
    try {
      assert.notEqual(child.processId, desktop.processId);
      assert.deepEqual(child.call({ op: 'snapshot' }).rows, []);
      assert.throws(() => new ProcessDesktop({ ...options, preparation }), e => e.code === 'EINVAL');
      await preparation.cancel(); // Ownership was transferred; cannot kill it.
      assert.deepEqual(child.call({ op: 'snapshot' }).rows, []);
    } finally { await child.close(); }
    const cancelled = prepareClient(options);
    await cancelled.cancel(); await cancelled.cancel();
    assert.throws(() => new ProcessDesktop({ ...options, preparation: cancelled }), e => e.code === 'EINVAL');
    const wrong = prepareClient(options);
    assert.throws(() => new ProcessDesktop({ ...options, endpoint: { ...desktop.endpoint, token: 'wrong' }, preparation: wrong }), e => e.code === 'EINVAL');
    await wrong.cancel();
    const unauthorized = prepareClient({ ...options, endpoint: { ...desktop.endpoint, token: 'wrong' } });
    assert.throws(() => new ProcessDesktop({ ...options, endpoint: { ...desktop.endpoint, token: 'wrong' }, preparation: unauthorized }),
      e => e.code === 'EAUTH');
  } finally { await desktop.close(); }
  assert.equal(fs.existsSync(directory), false);
  console.log('PASS failed authority/client construction retires Workers and healthy transport still works');
})().catch(error => { console.error(error); process.exitCode = 1; });
