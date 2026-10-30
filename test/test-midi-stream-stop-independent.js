#!/usr/bin/env node
'use strict';
// Independent production imports oracle. Fixtures model MIDI messages and callback
// acceptance only; they do not render audio or execute guest/WAT callbacks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const file = path.resolve(__dirname, '../lib/host-audio.js');
const raw = fs.readFileSync(file, 'utf8');
const sha = crypto.createHash('sha256').update(raw).digest('hex');
assert.equal(sha, '00e02890ff3010cb514bbff3e946d9cbc8c00d8cba2d2966a16950e585574bdb');
const mode = process.argv.find(a => a.startsWith('--mutant='))?.split('=')[1];
let createAudioHost;
if (mode) {
  const stop = '_midiStopNotes(dev);\n        _midiDrain(dev);';
  const mutations = {
    drain: [stop, '_midiStopNotes(dev);'],
    notes: [stop, '_midiDrain(dev);'],
    ownership: [stop, 'for (const d of _midiOut.devices.values()) { _midiStopNotes(d); _midiDrain(d); }'],
    identity: ['_midiNotify(dev, 0x3c9, submission.ga);', '_midiNotify(dev, 0x3c9, submission.wa);'],
  };
  assert(mutations[mode], 'known mutant');
  const [before, after] = mutations[mode];
  assert.equal(raw.split(before).length, 2, 'unique mutation site');
  const m = new Module(file, module); m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(raw.replace(before, after), file);
  ({ createAudioHost } = m.exports);
} else ({ createAudioHost } = require(file));

function fixture() {
  const mem = new ArrayBuffer(32768), view = new DataView(mem);
  const accepted = [], attempts = [], synths = [], signals = [];
  let now = 10, receiver = () => 1, onSignal = () => 1;
  const owner = { fire_midi_out_callback_bound(...args) {
    attempts.push(args);
    const ok = receiver(args);
    if (ok) accepted.push(args);
    return ok;
  }};
  class MessageSynth {
    constructor() { this.sent = []; synths.push(this); }
    send(message) { this.sent.push(Array.from(message)); }
    reset() { this.sent.push(['reset']); }
    allSoundOff() { this.sent.push(['allSoundOff']); }
  }
  const ctx = { getMemory: () => mem, exports: owner, guestNowMs: () => now,
    audioClockMs: () => now, WebAudioTinySynth: MessageSynth };
  const audio = createAudioHost(ctx, {
    getHost: () => ({ set_event: id => { signals.push(id); return onSignal(id); } }),
    profileNow: () => 0, profileEvent: () => {},
  });
  ctx._voices._ensureCtx = () => ({ currentTime: now / 1000, state: 'running' });
  const api = audio.imports;
  const open = (cb, instance, flags = 0x30000) => {
    const h = api.midi_stream_open(0, cb, instance, flags);
    assert(h > 0); return h;
  };
  const ctl = (h, op, t = now) => {
    assert.equal(api.midi_stream_control(h, op, t), 0);
  };
  const header = (h, wa, events) => {
    const ga = 0x600000 + wa, data = wa + 64;
    view.setUint32(wa + 4, events.length * 12, true);
    view.setUint32(wa + 8, events.length * 12, true);
    // Do not overwrite flags: reuse must traverse the actual prepare/queue gates.
    events.forEach(([delta, value], i) => {
      view.setUint32(data + 12*i, delta, true);
      view.setUint32(data + 12*i + 8, value, true);
    });
    assert.equal(api.midi_header(h, wa, ga, data, 64, 0), 0);
    assert.equal(api.midi_header(h, wa, ga, data, 64, 2), 0);
    return ga;
  };
  const tick = t => { now = t; api.midi_stream_service(t); };
  const pump = () => audio.pumpWaveOutCompletions();
  const flush = () => {
    for (let n = 0; ctx._midiOut.callbacks.length; n++) {
      assert(n < 30, 'bounded callback progress'); pump();
    }
  };
  return { api, ctx, owner, synths, signals, attempts, accepted, open, ctl,
    header, tick, pump, flush, flags: wa => view.getUint32(wa + 16, true),
    receiver: fn => { receiver = fn; }, signal: fn => { onSignal = fn; },
    done: () => accepted.filter(a => a[4] === 0x3c9),
    note: (h, msg) => assert.equal(api.midi_out_short_msg(h, msg), 0) };
}
let cases = 0;
function test(label, fn) { fn(); cases++; console.log('PASS ' + label); }

test('counted channel note-offs retain controls and sibling state', () => {
  const s = fixture(), a = s.open(111, 222), b = s.open(333, 444);
  s.flush();
  // Three same-pitch notes: two on channel 2, one on channel 9.
  s.note(a, 0x643c92); s.note(a, 0x643c92); s.note(a, 0x643c99);
  s.note(a, 0x4007b2); // channel-volume controller, preserved by stop
  s.note(b, 0x643c92);
  const ga = s.header(a, 512, [[480, 0x643d92]]);
  const gb = s.header(b, 1024, [[480, 0x643e92]]);
  s.ctl(a, 2); s.ctl(b, 2); s.tick(10);
  const before = s.synths[0].sent.length, sibling = s.synths[1].sent.slice();
  s.ctl(a, 3);
  assert.equal(s.flags(512), 3, 'drain: pending buffer becomes DONE');
  assert.equal(s.flags(1024), 18, 'ownership: sibling remains queued');
  assert.deepEqual(s.synths[0].sent.slice(before),
    [[0x82,60,0], [0x82,60,0], [0x89,60,0]], 'notes: balanced per-channel note-offs');
  assert.deepEqual(s.synths[1].sent, sibling, 'ownership: sibling notes untouched');
  assert.equal(s.ctx._midiOut.devices.get(a).channelVolume[2], 64);
  s.flush();
  assert.deepEqual(s.done(), [[a,ga,111,222,0x3c9]], 'identity: guest header and registration');
  s.ctl(a,3); s.ctl(a,0); s.tick(510); s.flush();
  assert.deepEqual(s.done(), [[a,ga,111,222,0x3c9],[b,gb,333,444,0x3c9]]);
});

test('same header requeued before delivery survives backpressure and reentrant close', () => {
  const s = fixture(), a = s.open(501, 601); s.flush();
  const ga = s.header(a, 512, [[100, 0x643c90]]);
  s.ctl(a,3);
  s.header(a,512,[[0,0x643d90]]); // previous MOM_DONE is queued, not delivered
  let blocked = true, reentered = false;
  s.receiver(args => {
    if (args[4] !== 0x3c9) return 1;
    if (blocked) return 0;
    if (!reentered) {
      reentered = true;
      assert.equal(s.flags(512),18, 'old callback does not complete new invocation');
      s.ctl(a,3); // app stops its requeued submission during old callback
      s.ctl(a,0);
      s.pump(); // nested pump must not deliver the same callback recursively
    }
    return 1;
  });
  s.pump(); s.pump();
  assert.equal(s.done().length,0, 'rejected receiver is not accepted delivery');
  blocked = false; s.flush();
  assert.deepEqual(s.done(), [[a,ga,501,601,0x3c9],[a,ga,501,601,0x3c9]],
    'exactly one accepted notification per submission');
  assert.equal(s.accepted.filter(a => a[4] === 0x3c8).length,1);
  s.tick(9999); s.flush();
  assert.equal(s.done().length,2);
  assert.equal(s.api.midi_stream_control(a,3,10000),5);
});

test('throwing receiver and changed owner retain original identity across close/reopen', () => {
  const s = fixture(), a = s.open(701,801); s.flush();
  const ga = s.header(a,512,[[100,0x643c90]]); s.ctl(a,3); s.ctl(a,0);
  let foreignCalls = 0;
  s.ctx.exports = {fire_midi_out_callback_bound() { foreignCalls++; return 1; }};
  assert.throws(() => s.pump(), /MIDI callback owner changed/);
  assert.equal(foreignCalls,0);
  s.ctx.exports = s.owner;
  s.receiver(() => { throw new Error('fixture receiver refused'); });
  assert.throws(() => s.pump(), /fixture receiver refused/);
  assert.equal(s.done().length,0);
  const b = s.open(702,802); assert.notEqual(a,b);
  s.receiver(() => 1); s.flush();
  assert.deepEqual(s.done(),[[a,ga,701,801,0x3c9]],
    'identity: closed handle completion keeps original registration');
  const gb = s.header(b,1024,[[100,0x643d90]]); s.ctl(b,3); s.ctl(b,0); s.flush();
  assert.deepEqual(s.done().at(-1),[b,gb,702,802,0x3c9]);
});

test('synchronous event receiver requeues during detached two-buffer stop', () => {
  const s = fixture(), a = s.open(77,0,0x50000);
  s.header(a,512,[[480,0x643c90]]); s.header(a,1024,[[480,0x643d90]]);
  let requeued = false;
  s.signal(() => {
    if (!requeued) {
      requeued = true;
      assert.equal(s.flags(512),3);
      s.header(a,512,[[480,0x643e90]]);
      s.ctl(a,2,1000);
    }
    return 1;
  });
  s.ctl(a,3);
  assert.deepEqual(s.signals,[77,77], 'two detached original submissions complete');
  assert.equal(s.flags(512),18, 'new invocation survives old drain');
  assert.equal(s.flags(1024),3);
  s.tick(1499); assert.equal(s.synths.length,0);
  s.tick(1500); assert.equal(s.flags(512),3);
  assert.deepEqual(s.signals,[77,77,77]);
  s.ctl(a,3); s.ctl(a,0);
  assert.deepEqual(s.signals,[77,77,77], 'no event on close or redundant stop');
});

test('stop discards fractional/wrapped paused deadline before fresh restart', () => {
  const s = fixture(), a = s.open(901,1001); s.flush();
  const ga = s.header(a,512,[[1,0x643c90],[480,0x643d90]]);
  s.ctl(a,2,0xfffffffe); s.tick(0xfffffffe);
  s.ctl(a,1,0xffffffff); s.ctl(a,3,2);
  assert.equal(s.flags(512),3);
  s.header(a,512,[[480,0x643e90]]);
  s.ctl(a,2,100);
  s.tick(599); assert.equal(s.flags(512),18);
  s.tick(600); s.flush();
  assert.equal(s.flags(512),3);
  assert.deepEqual(s.done(),[[a,ga,901,1001,0x3c9],[a,ga,901,1001,0x3c9]]);
  assert.equal(s.synths.length,1);
  assert.deepEqual(s.synths[0].sent,[[0x90,62,100]], 'only fresh event plays');
  s.ctl(a,0); s.flush(); assert.equal(s.done().length,2);
});
console.log(JSON.stringify({cases,mode:mode || 'production',hostSHA256:sha,
  boundary:'untransformed full createAudioHost.imports; deterministic receiver/message synth'}));
