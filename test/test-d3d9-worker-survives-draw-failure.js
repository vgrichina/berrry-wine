#!/usr/bin/env node
// One failed draw must not kill the render worker.
//
// The receiver marks a device's stream failed when a command throws, and that
// is right: the commands behind it are ordered against state the failure left
// undefined, so drain() answers each of them 'failed' rather than running it.
// What was wrong was the report channel for commands arriving AFTER that, which
// receive() answered by throwing. That throw escapes receive(), and
// lib/d3d-render-worker.js's top-level message handler treats any throw as
// fatal: it calls shutdownNeutral() and lets the thread exit. From then on
// every command on EVERY device that worker serves raises 'render worker
// stopped', because there is no worker left to serve them.
//
// The failure is asynchronous, so a producer cannot avoid this by being
// careful -- it submits the next frame before it has been told the last draw
// failed. Measured on Black & White 2's land pass: the clipper refused one draw
// at command 8917, the worker was gone by 8918, and the run's remaining 587
// commands had nothing to run on. The rendered frame never changed again.
//
// The generation rollover below tests receiver bookkeeping with a synthetic
// executor. Healthy host Reset submits RESOURCE_UPDATE without changing the
// generation. Real-worker failure retirement and supported recreation through
// the host are covered by test-d3d9-worker-reset-recovery.js.
'use strict';
const assert = require('assert');
const Stream = require('../lib/d3d-command-stream');

const DEVICE = 7;
// RESOURCE_CREATE carries a payload the receiver's own device bookkeeping
// reads; DRAW is the opcode whose failure this is about.
const DRAW = Stream.OPCODES.DRAW;

// A receiver plus the messages it posted, and an executor whose failures the
// test schedules by sequence number.
const harness = ({ failAt = new Set(), complete = () => ({ value: null, complete: true }) } = {}) => {
  const posted = [];
  const executed = [];
  const receive = Stream.createCommandReceiver({
    execute(command) {
      executed.push(command.sequence);
      // One-shot: a scheduled failure fires once, so a command replayed after a
      // device reset succeeds rather than being refused all over again.
      if (failAt.delete(command.sequence)) throw new Error(`draw ${command.sequence} refused`);
      return complete(command);
    },
  }, message => posted.push(message));
  let sequence = 0;
  const send = (generation = 1, opcode = DRAW) => receive({ t: 'd3d-command',
    command: { version: Stream.VERSION, deviceId: DEVICE, generation,
      sequence: ++sequence, opcode, payload: null, resources: [], byteLength: 64 } });
  return { receive, posted, executed, send, reset: () => { sequence = 0; } };
};

const phases = (posted, sequence) =>
  posted.filter(m => m.sequence === sequence).map(m => m.phase);

{
  // The control: with nothing failing, every command runs and completes.
  const h = harness();
  for (let i = 0; i < 4; i++) assert.strictEqual(h.send(), true);
  assert.deepStrictEqual(h.executed, [1, 2, 3, 4], 'a healthy stream executes every command');
  assert.deepStrictEqual(phases(h.posted, 3), ['consumed', 'completed']);
}

{
  // The case B&W2 hits. Command 2 fails; 3 and 4 arrive afterwards, as a
  // producer that has not yet heard about the failure will keep submitting.
  const h = harness({ failAt: new Set([2]) });
  h.send();
  h.send();
  assert.deepStrictEqual(phases(h.posted, 2), ['consumed', 'failed'],
    'the failing command is reported failed');

  // This is the assertion the whole fix exists for: receive() must answer,
  // not throw. A throw here is what reaches the worker's fatal handler.
  assert.doesNotThrow(() => h.send(), 'a command after a failure must not throw out of receive()');
  assert.doesNotThrow(() => h.send(), 'and must still not throw on the one after that');
  assert.strictEqual(h.send(), true, 'receive() keeps acknowledging commands it handled');

  // Each is answered for what it is, and the producer's ordering contract is
  // kept: it rejects a completion phase it never saw consumed.
  for (const sequence of [3, 4, 5]) {
    assert.deepStrictEqual(phases(h.posted, sequence), ['consumed', 'failed'],
      `command ${sequence} is answered per command`);
  }

  // The commands behind a failure are not run against the state it left.
  assert.deepStrictEqual(h.executed, [1, 2], 'no command after the failure is executed');
}

{
  // The escalation is specifically about the worker's other work. A second
  // device sharing the worker must be unaffected by the first one's failure --
  // under the old behaviour the shutdown took every device down together.
  const posted = [];
  const executed = [];
  const receive = Stream.createCommandReceiver({
    execute(command) {
      executed.push(`${command.deviceId}:${command.sequence}`);
      if (command.deviceId === 1 && command.sequence === 1) throw new Error('refused');
      return { value: null, complete: true };
    },
  }, message => posted.push(message));
  const send = (deviceId, sequence) => receive({ t: 'd3d-command',
    command: { version: Stream.VERSION, deviceId, generation: 1, sequence,
      opcode: DRAW, payload: null, resources: [], byteLength: 64 } });

  send(1, 1);                                    // device 1 fails
  assert.doesNotThrow(() => send(1, 2));         // and keeps being answered
  assert.doesNotThrow(() => send(2, 1));         // device 2 is untouched
  assert.doesNotThrow(() => send(2, 2));
  assert.deepStrictEqual(executed, ['1:1', '2:1', '2:2'],
    "one device's failure does not stop another device's rendering");
  assert.deepStrictEqual(posted.filter(m => m.deviceId === 2).map(m => m.phase),
    ['consumed', 'completed', 'consumed', 'completed']);
}

{
  // Receiver bookkeeping only: a higher generation replaces its failed stream.
  // This does not create/reset a native device in a live worker device map.
  const h = harness({ failAt: new Set([1]) });
  h.send();
  assert.deepStrictEqual(phases(h.posted, 1), ['consumed', 'failed']);
  h.reset();
  assert.doesNotThrow(() => h.send(2), 'a new generation rebuilds the stream');
  assert.deepStrictEqual(h.executed, [1, 1], 'and executes again after the reset');
  assert.deepStrictEqual(h.posted.filter(m => m.generation === 2).map(m => m.phase),
    ['consumed', 'completed'], 'the reset device renders normally');
}

{
  // The relaxation is scoped. A genuinely malformed or out-of-order descriptor
  // is still a producer protocol violation and must still throw -- otherwise
  // this change reads as "stop validating the stream".
  const h = harness();
  h.send();
  assert.throws(() => h.receive({ t: 'd3d-command',
    command: { version: Stream.VERSION, deviceId: DEVICE, generation: 1, sequence: 9,
      opcode: DRAW, payload: null, resources: [], byteLength: 64 } }),
    /stale or unordered/, 'an out-of-order sequence is still refused');
  assert.throws(() => h.receive({ t: 'd3d-command',
    command: { version: Stream.VERSION + 1, deviceId: DEVICE, generation: 1, sequence: 2,
      opcode: DRAW, payload: null, resources: [], byteLength: 64 } }),
    /invalid render worker descriptor/, 'a wrong protocol version is still refused');

  // And the same on a stream that has already failed: being failed must not
  // become a licence to accept anything.
  const g = harness({ failAt: new Set([1]) });
  g.send();
  assert.throws(() => g.receive({ t: 'd3d-command',
    command: { version: Stream.VERSION, deviceId: DEVICE, generation: 1, sequence: 77,
      opcode: DRAW, payload: null, resources: [], byteLength: 64 } }),
    /stale or unordered/, 'a failed stream still checks ordering');
}

console.log('PASS test-d3d9-worker-survives-draw-failure');
