'use strict';
// Real native processes, Workers, AF_UNIX broker and unchanged 3000 ms IPC
// deadline. Only the diagnostic sink is delayed, never the IPC implementation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'lib/process-desktop.js');
const baseline = '95990aee3';

if (process.env.DESKTOP_STALL_PRELOAD === '1') {
  if (process.env.DESKTOP_STALL_BASELINE === '1') {
    const Module = require('node:module'), load = Module._extensions['.js'];
    Module._extensions['.js'] = (mod, file) => {
      if (file !== source) return load(mod, file);
      const body = spawnSync('git', ['show', baseline + ':lib/process-desktop.js'],
        { cwd: root, encoding: 'utf8', timeout: 5000 });
      if (body.status !== 0) throw Error(body.stderr);
      mod._compile(body.stdout, file);
    };
  }
  const syncWrite = fs.writeSync, asyncWrite = fs.write;
  let delayed = false;
  const selected = bytes => {
    if (delayed || !Buffer.isBuffer(bytes)) return false;
    let row;
    try { row = JSON.parse(bytes.toString().split('\n')[0]); } catch { return false; }
    if (row.role !== 'desktop-authority' || row.phase !== 'authority-receipt' || row.op !== 'poll') return false;
    delayed = true;
    // This receipt is independent of the slow trace sink.
    syncWrite.call(fs, 2, JSON.stringify({ fault: 'slow-diagnostic-sink', delayMs: 3600,
      pid: process.pid, threadId: row.threadId, seq: row.seq, at: Date.now() }) + '\n');
    return true;
  };
  fs.writeSync = function(fd, bytes, ...rest) {
    if (selected(bytes)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3600);
    return syncWrite.call(fs, fd, bytes, ...rest);
  };
  fs.write = function(fd, bytes, ...rest) {
    if (selected(bytes)) {
      if (process.env.DESKTOP_STALL_MODE === 'error')
        return setImmediate(() => rest.at(-1)(Object.assign(new Error('diagnostic sink EIO'), { code: 'EIO' })));
      if (process.env.DESKTOP_STALL_MODE === 'partial') {
        rest[1] = 128; // A real short write, completed by production's loop.
        return asyncWrite.call(fs, fd, bytes, ...rest);
      }
      return setTimeout(() => asyncWrite.call(fs, fd, bytes, ...rest), 3600);
    }
    return asyncWrite.call(fs, fd, bytes, ...rest);
  };
}
async function native() {
  const { ProcessDesktop, readProcessDesktopObservations } = require(source);
    const d = new ProcessDesktop({ endpoint: null, observeDirectory: process.env.DESKTOP_STALL_DIR });
    const directory = d.directory, start = performance.now();
    let error = null, calls = 0;
    try {
      for (; calls < 500; calls++) assert.deepEqual(d.call({ op: 'poll', limit: 256 }), []);
    } catch (e) {
      error = e.code;
      assert.equal(error, 'ETIMEDOUT');
      assert.equal(d.closed, true);
      assert.throws(() => d.call({ op: 'poll' }), { code: 'ECLOSED' });
    }
    const elapsedMs = performance.now() - start;
    // Wait for actual worker exit, then drain the main observer. Host cleanup
    // is not a guest Quit, and no request is retried after an unknown result.
    await d.close();
    const records = readProcessDesktopObservations(process.env.DESKTOP_STALL_DIR);
    assert(!fs.existsSync(directory));
    assert(records.some(r => r.phase === 'worker-exit' && r.workerRole === 'desktop-authority'));
    assert(records.some(r => r.phase === 'worker-exit' && r.workerRole === 'desktop-client'));
    if (!error) {
      assert(records.some(r => r.phase === 'identity' && r.role === 'desktop-authority'));
      assert(records.some(r => r.phase === 'main-return' && r.seq === d.observationSequence));
    }
    console.log(JSON.stringify({ error, calls, elapsedMs, directoryRemoved: !fs.existsSync(directory),
      hostCleanup: true, nativeQuit: false, actualWorkerExitEvents: 2, records: records.length }));
}
module.exports.native = () => native().catch(e => { console.error(e); process.exitCode = 1; });
if (process.env.DESKTOP_STALL_PRELOAD !== '1') {
  const directory = process.env.DESKTOP_STALL_TEST_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-stall-'));
  fs.mkdirSync(directory, { recursive: true });
  for (const mode of ['baseline', 'repaired', 'error', 'partial']) {
    const old = mode === 'baseline';
    const area = path.join(directory, mode); fs.mkdirSync(area);
    const child = spawnSync(process.execPath, ['--require', __filename, '-e', `require(${JSON.stringify(__filename)}).native()`], {
      cwd: root, encoding: 'utf8', timeout: 20000,
      env: { ...process.env, DESKTOP_STALL_PRELOAD: '1', DESKTOP_STALL_BASELINE: old ? '1' : '0',
        DESKTOP_STALL_MODE: mode, DESKTOP_STALL_DIR: area },
    });
    // The preload is inherited by real broker/client Workers. Native entry
    // runs separately because --require must not run the test recursively.
    fs.writeFileSync(path.join(directory, mode + '.stdout.log'), child.stdout || '');
    fs.writeFileSync(path.join(directory, mode + '.stderr.log'), child.stderr || '');
    assert.equal(child.status, 0, child.stderr);
    const receipt = JSON.parse(child.stdout.trim().split('\n').at(-1));
    assert.equal(receipt.error, old ? 'ETIMEDOUT' : null);
    assert.equal(receipt.calls, old ? 0 : 500);
    assert.match(child.stderr, /slow-diagnostic-sink/);
    console.log(JSON.stringify({ mode, baseline: old, ...receipt, actualNativeWait: true, stdoutEOF: true, stderrEOF: true }));
  }
  if (!process.env.DESKTOP_STALL_TEST_DIR) fs.rmSync(directory, { recursive: true, force: true });
}
