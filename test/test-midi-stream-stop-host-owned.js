#!/usr/bin/env node
'use strict';
// Direct production host-import boundary; no guest, WAT build or audible-output claim.
// Contract: https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreamstop
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const filename = path.resolve(__dirname, '../lib/host-audio.js');
const original = fs.readFileSync(filename, 'utf8');
const mutant = process.argv.includes('--mutant-no-drain');
let source = original;
if (mutant) {
  const site = '_midiStopNotes(dev);\n        _midiDrain(dev);';
  assert.equal(source.split(site).length, 2, 'unique production stop mutation');
  source = source.replace(site, '_midiStopNotes(dev); /* MUTANT: omit drain */');
}
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(source, filename);
const { createAudioHost } = loaded.exports;
function setup() {
  const memory = new ArrayBuffer(65536), dv = new DataView(memory);
  const notifications = [], synths = [];
  let now = 100;
  class Synth {
    constructor() { this.notes = new Map(); this.sent = []; synths.push(this); }
    send(msg) {
      this.sent.push([...msg]);
      const [status, pitch, velocity] = msg, key = (status & 15) + ':' + pitch;
      if ((status & 240) === 144 && velocity)
        this.notes.set(key, (this.notes.get(key) || 0) + 1);
      if ((status & 240) === 128 || ((status & 240) === 144 && !velocity)) {
        const n = this.notes.get(key) || 0;
        if (n > 1) this.notes.set(key, n - 1); else this.notes.delete(key);
      }
    }
    allSoundOff() { this.notes.clear(); }
    reset() { this.notes.clear(); }
  }
  const owner = { fire_midi_out_callback_bound: (handle, header, cb, instance, message) => { notifications.push([cb, instance, message, handle, header]); return 1; } };
  const ctx = { getMemory: () => memory, exports: owner,
    guestNowMs: () => now, audioClockMs: () => now, WebAudioTinySynth: Synth };
  const audio = createAudioHost(ctx, {
    getHost: () => ({}), profileNow: () => 0, profileEvent: () => {}
  });
  ctx._voices._ensureCtx = () => ({ currentTime: now / 1000, state: 'running' });
  const h = audio.imports;
  const open = (cb = 0x12345, instance = 0x98765) => h.midi_stream_open(0, cb, instance, 0x30000);
  const control = (handle, op, tick = now) => h.midi_stream_control(handle, op, tick);
  function queue(handle, wa, events) {
    const data = wa + 80, ga = wa + 0x100000; // deliberately distinct guest/WASM header addresses
    dv.setUint32(wa + 4, events.length * 12, true);
    dv.setUint32(wa + 8, events.length * 12, true);
    dv.setUint32(wa + 16, 0, true);
    events.forEach(([delta, value], i) => {
      dv.setUint32(data + i * 12, delta, true);
      dv.setUint32(data + i * 12 + 8, value, true);
    });
    assert.equal(h.midi_header(handle, wa, ga, data, 64, 0), 0);
    assert.equal(h.midi_header(handle, wa, ga, data, 64, 2), 0);
    return ga;
  }
  function pump() {
    let remaining = 100;
    while (ctx._midiOut.callbacks.length) {
      assert(remaining--, 'callback progress');
      audio.pumpWaveOutCompletions();
    }
  }
  return { h, control, open, queue, pump, synths, notifications,
    flags: wa => dv.getUint32(wa + 16, true),
    service: tick => { now = tick; h.midi_stream_service(tick); },
    done: () => notifications.filter(n => n[2] === 0x3c9) };
}
let cases = 0;
function test(name, fn) { fn(); cases++; console.log('PASS ' + name); }
test('stop drains partial and untouched buffers beside an undelivered completion; sibling deadline survives', () => {
  const s = setup(), a = s.open(), b = s.open(0x22222, 0x33333);
  const finished = s.queue(a, 512, [[0, 0x643c90]]);
  const partial = s.queue(a, 1024, [[0, 0x643d90], [480, 0x643e90]]);
  const untouched = s.queue(a, 1536, [[480, 0x643f90]]);
  const sibling = s.queue(b, 2048, [[480, 0x644090]]);
  assert.equal(s.control(a, 2), 0); assert.equal(s.control(b, 2), 0);
  s.service(100); // a sounded two notes; its next event and b's first event are due at 600
  assert.equal(s.flags(512), 3);
  assert.equal(s.flags(1024), 18);
  assert.equal(s.done().length, 0, 'completed notification still awaits delivery');
  assert.equal(s.synths[0].notes.size, 2, 'positive played-note control');
  assert.equal(s.control(a, 3), 0);
  for (const wa of [512, 1024, 1536])
    assert.equal(s.flags(wa), 3, 'stop must return each pending header with DONE and without INQUEUE');
  assert.equal(s.flags(2048), 18, 'sibling stays queued');
  assert.equal(s.synths[0].notes.size, 0, 'played notes stopped');
  s.pump();
  assert.deepEqual(s.done(), [finished, partial, untouched].map(ga =>
    [0x12345, 0x98765, 0x3c9, a, ga]));
  assert.equal(s.control(a, 3), 0);
  assert.equal(s.control(a, 1), 0);
  assert.equal(s.control(a, 2, 200), 0);
  s.service(599); s.pump();
  assert.equal(s.done().length, 3);
  assert.equal(s.synths.length, 1, 'sibling not due yet');
  s.service(600); s.pump();
  assert.deepEqual(s.done().at(-1), [0x22222, 0x33333, 0x3c9, b, sibling]);
  assert.equal(s.synths[1].notes.get('0:64'), 1);
  const replacement = s.queue(a, 2560, [[480, 0x644190]]);
  assert.equal(s.control(a, 3), 0); // queued after empty restart must also be drained
  assert.equal(s.control(a, 0), 0);
  s.service(5000); s.pump();
  assert.equal(s.done().length, 5);
  assert.deepEqual(s.done().at(-1), [0x12345, 0x98765, 0x3c9, a, replacement]);
  assert.equal(s.synths[1].notes.get('0:64'), 1, 'closing stopped stream preserves sibling');
  assert.equal(s.control(a, 3), 5);
});
test('paused stop clears old deadline and permits same-header requeue with a fresh timeline', () => {
  const s = setup(), a = s.open();
  const ga = s.queue(a, 512, [[480, 0x643c90]]);
  s.control(a, 2); s.service(100);
  assert.equal(s.control(a, 1, 200), 0);
  assert.equal(s.control(a, 3, 1000), 0);
  s.pump(); assert.equal(s.done().length, 1);
  s.queue(a, 512, [[480, 0x643d90]]);
  assert.equal(s.control(a, 2, 2000), 0);
  s.service(2499); s.pump();
  assert.equal(s.synths.length, 0, 'old pending deadline discarded');
  s.service(2500); s.pump();
  assert.deepEqual(s.done(), [ga, ga].map(header => [0x12345, 0x98765, 0x3c9, a, header]));
  assert.equal(s.control(a, 0), 0); s.pump();
  assert.equal(s.done().length, 2, 'close cannot repeat a completion');
});
test('invalid, ordinary and retired stream handles cannot drain a live stream', () => {
  const s = setup(), a = s.open();
  const ordinary = s.h.midi_out_open(0, 0, 0, 0);
  s.queue(a, 512, [[480, 0x643c90]]);
  for (const invalid of [0, 123, 0xffffffff, ordinary])
    for (const op of [0, 1, 2, 3]) assert.equal(s.control(invalid, op), 5);
  assert.equal(s.control(a, 99), 11);
  assert.equal(s.flags(512), 18);
  assert.equal(s.control(a, 3), 0);
  assert.equal(s.control(a, 0), 0);
  s.pump(); assert.equal(s.done().length, 1);
  assert.equal(s.control(a, 3), 5);
  const next = s.open(); assert.notEqual(next, a);
  assert.equal(s.control(next, 3), 0);
});
console.log(JSON.stringify({ cases, boundary: 'createAudioHost.imports', mutant,
  hostSHA256: crypto.createHash('sha256').update(original).digest('hex') }));
