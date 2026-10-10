#!/usr/bin/env node
'use strict';

// lib/control-server.js times out a command that gets no batch turn. A frozen
// `step` that keeps completing batches is getting turns, however long it runs:
// UT2004 on the software D3D path takes ~1.5 s a frame, so a step of a few
// hundred batches takes minutes. Timing that out at 30 s told ctl.js the step
// had failed while it kept running; the route's next mousemove/click then
// landed mid-step and its short sync steps were refused ("another step command
// is still running"), which read as clicks arriving late and the DirectInput
// cursor ~40 px off. A command whose promise has progress() now only times out
// once that counter stops moving.

const assert = require('assert');
const http = require('http');
const { startControlServer } = require('../lib/control-server');

const TIMEOUT_MS = 150;

function post(port, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port, path: '/ctl', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
    res => {
      let text = '';
      res.on('data', c => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
    });
    req.on('error', reject);
    req.end(data);
  });
}

// A step-like promise: `done` advances every `everyMs` until `total`, then it
// resolves. everyMs = Infinity never advances (a stuck step).
function stepLike(total, everyMs) {
  let done = 0;
  let timer = null;
  const p = new Promise(resolve => {
    if (!Number.isFinite(everyMs)) return;
    timer = setInterval(() => {
      done++;
      if (done >= total) { clearInterval(timer); resolve({ ran: done }); }
    }, everyMs);
  });
  p.progress = () => done;
  return p;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const server = startControlServer({
    port: 0,
    commandTimeoutMs: TIMEOUT_MS,
    onCommand: cmd => {
      // 12 x 50 ms = 600 ms, four timeout windows, progressing throughout.
      if (cmd.action === 'slow-step') return stepLike(12, 50);
      if (cmd.action === 'stuck-step') return stepLike(12, Infinity);
      // No progress(): the old contract, a flat timeout.
      if (cmd.action === 'plain') return sleep(600).then(() => 'late');
      return 'pong';
    },
  });
  await new Promise(resolve => (server.server.listening ? resolve() : server.server.once('listening', resolve)));
  const port = server.server.address().port;
  try {
    const slow = await post(port, { action: 'slow-step' });
    assert.strictEqual(slow.status, 200, 'a step that keeps making progress is not timed out');
    assert.strictEqual(slow.body.ok, true);
    assert.deepStrictEqual(slow.body.value, { ran: 12 });

    const stuck = await post(port, { action: 'stuck-step' });
    assert.strictEqual(stuck.status, 504, 'a step whose progress stops still times out');
    assert.strictEqual(stuck.body.timedOut, true);

    const plain = await post(port, { action: 'plain' });
    assert.strictEqual(plain.status, 504, 'a command without progress() keeps the flat timeout');

    const ping = await post(port, { action: 'ping' });
    assert.strictEqual(ping.body.value, 'pong');
  } finally {
    server.close();
  }
  console.log('PASS  control-server waits on a progressing step and still times out a stuck one');
  process.exit(0);
})().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
