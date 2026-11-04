#!/usr/bin/env node
'use strict';
// Transport only: real Node workers and sockets, no WAT or game runtime.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { ProcessDesktop, readProcessDesktopObservations: read } = require('../lib/process-desktop');
const directory = process.env.DESKTOP_OBSERVATION_TEST_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-observation-'));
fs.mkdirSync(directory, { recursive: true });
const results = [];
function area(name) { const p = path.join(directory, name); fs.mkdirSync(p); return p; }
function failClosed(d, code) {
  const buffer = d.buffer;
  let first;
  assert.throws(() => d.call({ op: 'poll', limit: 7 }), error => { first = error; return error.code === code; });
  assert.equal(d.firstError, first);
  assert.equal(d.closed, true);
  assert.throws(() => d.call({ op: 'poll', limit: 7 }), { code: 'ECLOSED' });
  assert.equal(d.firstError, first, 'closed-client rejection preserves original error');
  assert.equal(d.buffer, buffer, 'no replacement or reuse after terminal failure');
  return first;
}
async function main() {
  delete process.env.WINE_PROCESS_DESKTOP_OBSERVE;
  const disabled = new ProcessDesktop({ endpoint: null });
  try {
    assert.equal(disabled.observer, null);
    assert.equal(disabled.observationClient, null);
    for (let i = 0; i < 100; i++) assert.deepEqual(disabled.call({ op: 'poll', limit: 256 }), []);
    assert.equal(disabled.observationSequence, 0);
    assert.deepEqual(fs.readdirSync(directory), []);
  } finally { await disabled.close(); }
  results.push('disabled: no trace I/O, identity or request sequence');

  const success = area('success');
  const root = new ProcessDesktop({ endpoint: null, observeDirectory: success });
  assert.equal(root.environment({}).WINE_PROCESS_DESKTOP_OBSERVE, success, 'diagnostics propagate to child OS processes');
  const child = new ProcessDesktop({ endpoint: root.endpoint, observeDirectory: success });
  try {
    const row = { hwnd: child.hwndBase, generation: '1', title: 'not logged', className: 'Static', parent: 0, z: 0 };
    child.call({ op: 'publish', rows: [row] });
    const published = root.call({ op: 'snapshot' }).rows[0];
    root.call({ op: 'post', hwnd: row.hwnd, generation: '1', session: published.session, msg: 0x8001 });
    assert.equal(child.call({ op: 'poll', limit: 7 }).length, 1);
    const seq = child.observationSequence;
    // Post-action markers may be a few instructions behind main's wakeup.
    await new Promise(resolve => setTimeout(resolve, 20));
    const records = read(success).filter(r => r.client === child.observationClient && r.seq === seq);
    for (const phase of ['main-submission', 'bridge-receipt', 'socket-write', 'authority-receipt',
      'handler-completion', 'reply-write', 'bridge-frame-receipt', 'shared-notification', 'main-return']) {
      assert(records.some(r => r.phase === phase), phase);
    }
    assert.equal(records.find(r => r.phase === 'authority-receipt').queueBefore, 1);
    assert.equal(records.find(r => r.phase === 'handler-completion').queueAfter, 0);
    assert.equal(records.find(r => r.phase === 'handler-completion').returned, 1);
    let originalError;
    assert.throws(() => root.call({ op: 'invalid' }), error => { originalError = error; return error.code === 'EINVAL'; });
    for (let i = 0; i < 150; i++) root.call({ op: 'poll', limit: 1 });
    assert.equal(root.firstError, originalError);
    assert(read(success).some(r => r.phase === 'error' && r.code === 'EINVAL'), 'first error survives ring wrap');
    for (let i = 0; i < 400; i++) assert.deepEqual(child.call({ op: 'poll', limit: 256 }), []);
    const all = read(success);
    assert(all.some(r => r.phase === 'shared-notification'));
    assert(all.filter(r => r.phase === 'identity').every(r => r.osTid > 0 && r.preloads.length > 0));
    for (const file of fs.readdirSync(success)) {
      assert.equal(fs.statSync(path.join(success, file)).size, 131 * 4096);
      const bytes = fs.readFileSync(path.join(success, file), 'utf8');
      assert(!bytes.includes(root.endpoint.token), 'credential absent');
      assert(!bytes.includes('not logged'), 'window payload absent');
    }
    assert(all.filter(r => r.role === 'desktop-client' && r.threadId === child.worker.threadId).length <= 131);
    assert(!all.some(r => r.client === child.observationClient && r.seq === seq), 'old phases overwritten');
    await root.authority.terminate();
    failClosed(child, 'ECONNECTION');
    assert(read(success).some(r => r.phase === 'request-error' && r.code === 'ECONNECTION'));
  } finally { await child.close(); await root.close(); }
  const traceFile = path.join(success, fs.readdirSync(success).find(n => n.endsWith('.trace')));
  const before = read(success).length;
  const fd = fs.openSync(traceFile, 'r+');
  const original = Buffer.alloc(1);
  fs.readSync(fd, original, 0, 1, 2);
  fs.writeSync(fd, Buffer.from('X'), 0, 1, 2); // syntactically valid JSON, invalid checksum
  assert.equal(read(success).length, before - 1, 'torn but parseable record rejected');
  fs.writeSync(fd, original, 0, 1, 2); fs.closeSync(fd);
  results.push('real transport success, poll counts, bounded wrap, credential exclusion, authority death');

  const dead = area('dead');
  process.env.WINE_PROCESS_DESKTOP_OBSERVE = dead;
  const deadClient = new ProcessDesktop({ endpoint: null });
  delete process.env.WINE_PROCESS_DESKTOP_OBSERVE;
  try {
    await deadClient.worker.terminate();
    failClosed(deadClient, 'ETIMEDOUT');
    const all = read(dead), timeout = all.find(r => r.phase === 'timeout');
    // Word 1 retains the previous successful response length; it is not a reply.
    assert.equal(timeout.responseWords[0], 0);
    assert(timeout.responseWords[1] > 0);
    assert(!all.some(r => r.seq === timeout.seq && r.phase === 'authority-receipt'));
    assert(all.some(r => r.phase === 'worker-exit' && r.workerRole === 'desktop-client'));
  } finally { await deadClient.close(); }
  results.push('dead bridge: timeout words, no authority receipt, closed/no retry/first error');

  const lost = area('lost-reply');
  const authority = new ProcessDesktop({ endpoint: null, observeDirectory: lost });
  const state = new Int32Array(new SharedArrayBuffer(12));
  // AF_UNIX paths have a short OS limit; evidence directories may be deep.
  const proxyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-proxy-'));
  const proxyPath = path.join(proxyDirectory, 'socket');
  const proxy = new Worker(`
    const net = require('node:net');
    const { workerData } = require('node:worker_threads');
    const state = new Int32Array(workerData.state);
    net.createServer(down => {
      const up = net.createConnection(workerData.upstream);
      let request = '', response = '', drop = false;
      down.on('data', b => {
        request += b;
        let at;
        while ((at = request.indexOf('\\n')) >= 0) {
          const line = request.slice(0, at); request = request.slice(at + 1);
          drop = JSON.parse(line).op === 'poll';
          if (drop) Atomics.add(state, 1, 1);
          up.write(line + '\\n');
        }
      });
      up.on('data', b => {
        response += b;
        let at;
        while ((at = response.indexOf('\\n')) >= 0) {
          const line = response.slice(0, at); response = response.slice(at + 1);
          if (drop) Atomics.add(state, 2, JSON.parse(line).value.length);
          else down.write(line + '\\n');
        }
      });
      down.on('close', () => up.destroy());
      down.on('error', () => {}); up.on('error', () => {});
    }).listen(workerData.path, () => { Atomics.store(state,0,1); Atomics.notify(state,0); });
  `, { eval: true, workerData: { path: proxyPath, upstream: authority.endpoint.path, state: state.buffer } });
  let client;
  try {
    assert.notEqual(Atomics.wait(state, 0, 0, 3000), 'timed-out');
    client = new ProcessDesktop({ endpoint: { ...authority.endpoint, path: proxyPath }, observeDirectory: lost });
    client.call({ op: 'publish', rows: [{ hwnd: client.hwndBase, generation: '1' }] });
    const row = authority.call({ op: 'snapshot' }).rows[0];
    assert.equal(authority.call({ op: 'post', hwnd: row.hwnd, generation: row.generation,
      session: row.session, msg: 0x8001 }), true);
    failClosed(client, 'ETIMEDOUT');
    const all = read(lost), timeout = all.find(r => r.phase === 'timeout');
    const phases = all.filter(r => r.client === client.observationClient && r.seq === timeout.seq);
    assert.equal(phases.find(r => r.phase === 'authority-receipt').queueBefore, 1);
    assert.equal(phases.find(r => r.phase === 'handler-completion').queueAfter, 0);
    assert(phases.some(r => r.phase === 'reply-write'));
    assert(!phases.some(r => r.phase === 'bridge-frame-receipt'));
    assert(!phases.some(r => r.phase === 'shared-notification'));
    assert.equal(state[1], 1, 'one destructive poll, no retry');
    assert.equal(state[2], 1, 'proxy discarded a reply containing the consumed message');
    assert.equal(client.firstError.code, 'ETIMEDOUT', 'execution observation does not acknowledge caller outcome');
  } finally {
    await client?.close(); await proxy.terminate(); await authority.close();
    fs.rmSync(proxyDirectory, { recursive: true, force: true });
  }
  results.push('real authority consumed poll + proxy lost reply distinguished from dead worker; outcome remains unknown');

  const lifecycle = area('lifecycle');
  const preload = path.join(lifecycle, 'preload.cjs');
  fs.writeFileSync(preload, 'module.exports = 42;\n');
  const worker = new Worker(`require(${JSON.stringify(require.resolve('../lib/process-desktop'))});
    throw new Error('first-worker-fault');`, { eval: true, execArgv: ['--require', preload],
    workerData: { role: 'desktop-client', endpoint: { path: '/does-not-exist', token: 'secret-test-token' }, observeDirectory: lifecycle } });
  let workerError;
  worker.on('error', e => { workerError = e; });
  await new Promise(resolve => worker.once('exit', resolve));
  assert.match(workerError.message, /first-worker-fault/);
  const records = read(lifecycle);
  assert.match(records.find(r => r.phase === 'error').stack, /first-worker-fault/);
  assert.equal(records.find(r => r.phase === 'exit').code, 1);
  assert(records.find(r => r.phase === 'identity').preloads.some(p => p.path === preload && p.sha256.length === 64));
  results.push('worker-written first uncaught error, exit code, Linux TID and inherited preload hash');
  console.log(JSON.stringify({ node: process.version, results, aliceCauseEstablished: false, directory }, null, 2));
}
const guard = setTimeout(() => { console.error('focused desktop test exceeded 30 seconds'); process.exit(1); }, 30000);
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  clearTimeout(guard);
  if (!process.env.DESKTOP_OBSERVATION_TEST_DIR) fs.rmSync(directory, { recursive: true, force: true });
});
