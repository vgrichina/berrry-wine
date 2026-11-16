'use strict';
// tl;dr: the process Glide bridge (lib/glide-host.js) on the local route.
// A JS producer (test/gpu-stream-fixture.js) stands in for the WAT and an
// injected executor records what the bridge drains: kick drains every
// published record in order, PRESENT reaches the window compositor layer,
// CLOSE retires the executor and detaches the layer, the bridge reopens
// with a fresh executor, executor errors propagate (and park the ring), the
// --gpu-stream-dump tee sees the same records, and the process board shares
// one bridge between guest threads.
const assert = require('assert');
const GS = require('../lib/gpu-stream');
const { makeProducer } = require('./gpu-stream-fixture');
const { Bridge } = require('../lib/glide-host');
const { processSharedCtx } = require('../lib/worker-imports');

const { KIND, FMT, CONST } = GS;
const HEADER = 64;
const p = makeProducer({ headerAddr: HEADER, ringBytes: 4096, arenaBytes: 4096, memBytes: 1 << 16 });
const win = {}, renderer = { windows: { 42: win },
  scheduleRepaint() { this.repaintScheduled = true; } };
const executors = [];
let failOn = null;
class FakeExecutor {
  constructor({ onPresent }) { this.onPresent = onPresent; this.ops = []; this.closed = 0; executors.push(this); }
  execute(rec) {
    if (rec.name === failOn) throw new Error('test executor refuses ' + rec.name);
    this.ops.push(rec.name);
    if (rec.name === 'PRESENT') this.onPresent({ hwnd: 0, surface: { frame: this.ops.length }, width: 8, height: 8 });
  }
  close() { this.closed++; }
}
const dumped = [];
const bridge = new Bridge({
  getMemory: () => p.buffer, renderer: () => renderer,
  getExports: () => ({ get_dx_present_hwnd: () => 42 }),
  createExecutor: options => new FakeExecutor(options),
  dumpSink: bytes => dumped.push(bytes.slice()),
});
const create = id => p.emit('CREATE', { id, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: 8, height: 8 });
const present = () => p.emit('PRESENT', { rt: 1, gamma: 0, x: 0, y: 0, w: 8, h: 8, surface: 0 });

create(1);
assert.strictEqual(bridge.kick(HEADER, CONST.KICK_ASYNC), 1);
assert.deepStrictEqual(executors[0].ops, ['CREATE'], 'kick drains the published record');
present();
p.emit('MARK', { frame: 1, tag: 0 });
assert.strictEqual(bridge.kick(HEADER, CONST.KICK_SYNC), 1);
assert.deepStrictEqual(executors[0].ops, ['CREATE', 'PRESENT', 'MARK'], 'records drain in order');
assert.strictEqual(win._gpuFrameLayer.writeSeq, 1, 'PRESENT reaches the window resolved from the null HWND');
assert.strictEqual(win._dxFrameLayer, win._gpuFrameLayer);
assert(renderer.repaintScheduled);
assert.strictEqual(processSharedCtx({ glideBridge: bridge }).glideBridge, bridge,
  'a guest thread must use the process board rather than create a second renderer');

renderer.repaintScheduled = false;
p.emit('RELEASE', { id: 1 });
assert.strictEqual(bridge.kick(HEADER, CONST.KICK_CLOSE), 1);
assert.deepStrictEqual(executors[0].ops, ['CREATE', 'PRESENT', 'MARK', 'RELEASE']);
assert.strictEqual(executors[0].closed, 1, 'CLOSE retires the executor after draining');
assert.strictEqual(win._gpuFrameLayer, null);
assert.strictEqual(win._dxFrameLayer, null);
assert(renderer.repaintScheduled, 'closing must repaint the detached window layer');
create(1);
assert.strictEqual(bridge.kick(HEADER, CONST.KICK_ASYNC), 1, 'a closed bridge reopens');
assert.strictEqual(executors.length, 2, 'with a fresh executor');
assert.deepStrictEqual(executors[1].ops, ['CREATE']);

failOn = 'CLEAR';
p.emit('CLEAR', { mask: 1 });
assert.throws(() => bridge.kick(HEADER, CONST.KICK_SYNC), /refuses CLEAR/, 'executor errors reach the kick');
const ringView = p.ring();
assert.notStrictEqual(ringView.errorSeq, 0, 'and are recorded in the ring for the producer');
failOn = null;
bridge.close();
bridge.close();
assert.strictEqual(executors[0].closed, 1, 'teardown is idempotent and never re-closes a retired executor');

const reader = new GS.DumpReader(Buffer.concat(dumped.map(b => Buffer.from(b))));
assert.deepStrictEqual([...reader.records()].map(r => r.name),
  ['CREATE', 'PRESENT', 'MARK', 'RELEASE', 'CREATE', 'CLEAR'],
  'the dump tee records every drained record across a close/reopen');
console.log('PASS Glide host: ring drain order, presentation, close/reopen, errors, dump tee, process sharing');
