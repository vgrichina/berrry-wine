'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { Worker, workerData, isMainThread, parentPort } = require('worker_threads');
const { publishCapture } = require('./capture-publication');
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
if (!isMainThread) {
  const { base, mode, buffer } = workerData, gate = new Int32Array(buffer);
  const bytes = Buffer.alloc(343722, 123);
  const write = file => {
    const fd = fs.openSync(file, 'wx');
    fs.writeSync(fd, bytes.subarray(0, 258048));
    Atomics.store(gate, 0, 1); Atomics.notify(gate, 0);
    Atomics.wait(gate, 1, 0);
    for (let i = 258048; i < bytes.length; i += 4096) {
      fs.writeSync(fd, bytes.subarray(i, i + 4096)); pause(3);
    }
    fs.closeSync(fd);
  };
  if (mode === 'old') { fs.writeFileSync(base + '.json', '{}'); write(base + '.png'); }
  else publishCapture(base, { stage: 6 }, write);
  parentPort.postMessage('done');
} else (async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-publication-'));
  try {
    for (const mode of ['old', 'new']) {
      const base = path.join(dir, mode), buffer = new SharedArrayBuffer(8), gate = new Int32Array(buffer);
      const worker = new Worker(__filename, { workerData: { base, mode, buffer } });
      const exit = new Promise((resolve, reject) => { worker.on('error', reject); worker.on('exit', c => c ? reject(Error('worker ' + c)) : resolve()); });
      while (!Atomics.load(gate, 0)) await new Promise(r => setTimeout(r, 1));
      let oldSize;
      if (mode === 'old') { assert(fs.existsSync(base + '.json')); oldSize = fs.statSync(base + '.png').size; assert.equal(oldSize, 258048); }
      else { assert(!fs.existsSync(base + '.json')); assert(!fs.existsSync(base + '.png')); }
      Atomics.store(gate, 1, 1); Atomics.notify(gate, 1);
      let polls = 0;
      while (!fs.existsSync(base + '.json') || mode === 'old') {
        if (mode === 'old') break;
        assert(!fs.existsSync(base + '.json')); polls++;
        await new Promise(r => setTimeout(r, 1));
      }
      const bytes = fs.readFileSync(base + '.png');
      if (mode === 'new') {
        // Read while the producer is independent, before waiting for its exit.
        const marker = JSON.parse(fs.readFileSync(base + '.json'));
        assert.equal(bytes.length, 343722);
        assert.deepEqual(marker.capture, { path: 'new.png', size: bytes.length, sha256: digest(bytes) });
        assert(polls > 1);
      }
      await exit;
      if (mode === 'old') {
        const completed = fs.readFileSync(base + '.png');
        assert.equal(completed.length, 343722);
        assert.notEqual(oldSize, completed.length);
      }
    }
    const base = path.join(dir, 'failure');
    assert.throws(() => publishCapture(base, {}, p => { fs.writeFileSync(p, 'partial'); throw Error('writer failure'); }));
    assert(!fs.existsSync(base + '.json')); assert(!fs.existsSync(base + '.png'));
    assert(!fs.readdirSync(dir).some(p => p.endsWith('.tmp')));
    console.log('PASS concurrent slow writer: old inconsistent size; atomic PNG/JSON readiness and same-byte pins; writer failure cleanup');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
