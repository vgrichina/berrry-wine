#!/usr/bin/env node
'use strict';
// MCI sequencer/waveaudio end-of-play notification, on the guest clock.
//
//   MCI_PLAY (MCI_NOTIFY, dwCallback=hwnd) ── track runs on the MCI clock ──▶
//   per-batch pumpWaveOutCompletions sees it past the end ──▶
//   post_window_message(hwnd, MM_MCINOTIFY, MCI_NOTIFY_SUCCESSFUL, deviceId)
//
// Age of Empires chains its soundtrack on this message (open.mid, then
// music1.mid, then music2.mid ...). Before the fix only cdaudio posted it, and
// with no AudioContext the sequencer stopped on the spot, so the music ended
// after one track. No AudioContext here: the CLI's situation.
const assert = require('assert');
const { createAudioHost } = require('../lib/host-audio');

const memory = new ArrayBuffer(0x10000);
const u8 = new Uint8Array(memory), dv = new DataView(memory);
const writeStr = (p, s) => { for (let i = 0; i < s.length; i++) u8[p + i] = s.charCodeAt(i); u8[p + s.length] = 0; return p; };
const readStr = (p, max = 260) => { let s = ''; for (let i = 0; i < max && u8[p + i]; i++) s += String.fromCharCode(u8[p + i]); return s; };

// Format 0, 96 ticks/quarter, 120 bpm: one note of 96 ticks = 0.5 s.
const midi = Uint8Array.from([
  0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 0x60,
  0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 0x0d,
  0x00, 0x90, 0x3c, 0x64, 0x60, 0x80, 0x3c, 0x00, 0x00, 0xff, 0x2f, 0x00,
]);

let guestMs = 1000;
const posted = [];
const ctx = { getMemory: () => memory, sharedAudio: { audioClockMs: () => guestMs }, sharedMixer: {} };
let imports;
const audio = createAudioHost(ctx, {
  readStr, readStrW: readStr,
  readVfsFile: p => (/\.mid$/i.test(p) ? midi : null),
  readVfsFileAsync: () => Promise.resolve(null),
  profileNow: () => 0, profileEvent: () => {},
  getHost: () => imports,
});
imports = { ...audio.imports, post_window_message: (...a) => { posted.push(a); return 1; } };
const pump = () => audio.pumpWaveOutCompletions();

writeStr(0x100, 'sequencer');
const open = () => imports.mci_open(0x100, writeStr(0x120, 'music1.mid'), 0x2000);
const play = 0x200;
const HWND = 0x10042, MM_MCINOTIFY = 0x3B9;

// 1. Notify play runs to its end on the guest clock and posts SUCCESSFUL once.
const id = open();
const dev = ctx._mci.devices.get(id);
assert(dev && dev.smf, 'sequencer opened with the MIDI file');
dv.setUint32(play, HWND, true);
assert.strictEqual(imports.mci_command(id, 0x0806, 0x1 /* MCI_NOTIFY */, play), 0);
assert.strictEqual(dev.state, 'playing', 'without an AudioContext the track still plays on the MCI clock');
guestMs += 300; pump();
assert.strictEqual(posted.length, 0, 'no notify mid-track');
assert.strictEqual(dev.state, 'playing');
guestMs += 400; pump();
assert.deepStrictEqual(posted, [[HWND, MM_MCINOTIFY, 1, id]], 'MM_MCINOTIFY(MCI_NOTIFY_SUCCESSFUL, id) at the end');
assert.strictEqual(dev.state, 'stopped');
guestMs += 1000; pump();
assert.strictEqual(posted.length, 1, 'posted exactly once');

// 2. Guest time, not wall time: no pump, no notify, however long the host waits.
posted.length = 0;
assert.strictEqual(imports.mci_command(id, 0x0806, 0x1, play), 0);
guestMs += 5000;
assert.strictEqual(posted.length, 0, 'nothing posts until the per-batch pump runs');
pump();
assert.strictEqual(posted.length, 1);

// 3. A play without MCI_NOTIFY posts nothing.
posted.length = 0;
assert.strictEqual(imports.mci_command(id, 0x0806, 0, play), 0);
guestMs += 1000; pump();
assert.strictEqual(posted.length, 0, 'no MCI_NOTIFY flag, no message');

// 4. MCI_STOP reports the pending notify as ABORTED, once, and never SUCCESSFUL.
//    Age of Empires counts outstanding notifies (one per MCI_PLAY|MCI_NOTIFY)
//    and starts the next track only at zero: it stops open.mid at the menu, so
//    a dropped notify there left music1's SUCCESSFUL one short and the
//    soundtrack ended after one song.
assert.strictEqual(imports.mci_command(id, 0x0806, 0x1, play), 0);
assert.strictEqual(imports.mci_command(id, 0x0808, 0x2 /* MCI_WAIT */, 0), 0);
assert.deepStrictEqual(posted, [[HWND, MM_MCINOTIFY, 4, id]], 'MCI_NOTIFY_ABORTED on stop');
guestMs += 1000; pump();
assert.strictEqual(posted.length, 1, 'no SUCCESSFUL after a stop');
assert.strictEqual(imports.mci_command(id, 0x0808, 0, 0), 0);
assert.strictEqual(posted.length, 1, 'a second stop has nothing to abort');

// 5. A new notify play supersedes the pending one; the new one still completes.
posted.length = 0;
assert.strictEqual(imports.mci_command(id, 0x0806, 0x1, play), 0);
assert.strictEqual(imports.mci_command(id, 0x0806, 0x1, play), 0);
assert.deepStrictEqual(posted, [[HWND, MM_MCINOTIFY, 2, id]], 'MCI_NOTIFY_SUPERSEDED');
guestMs += 1000; pump();
assert.deepStrictEqual(posted[1], [HWND, MM_MCINOTIFY, 1, id], 'replacement play reports SUCCESSFUL');

// 6. MCI_CLOSE aborts a pending notify.
posted.length = 0;
assert.strictEqual(imports.mci_command(id, 0x0806, 0x1, play), 0);
assert.strictEqual(imports.mci_command(id, 0x0804, 0, 0), 0);
assert.deepStrictEqual(posted, [[HWND, MM_MCINOTIFY, 4, id]], 'MCI_NOTIFY_ABORTED on close');

console.log('PASS MCI sequencer MM_MCINOTIFY on the guest clock (successful once, pump-driven, no-flag, stop/close aborted, superseded)');

// Public guest A/W commands must report the reusable guest device ID, even
// after host IDs diverge. Use the full module, real host window posting,
// PeekMessage and DispatchMessage into an x86 WndProc; no message collector.
async function guestNotifications() {
  const fs = require('fs');
  const path = require('path');
  const { bootRenderHarness } = require('./render-helper');
  const apis = require('../src/api_table.json');
  const extraWat = String.raw`
    (func (export "mn_thunk") (param $id i32) (result i32)
      (local $p i32)
      (global.set $thunk_guest_base (call $w2g (global.get $THUNK_BASE)))
      (local.set $p (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))))
      (i32.store (local.get $p) (i32.const 0)) (i32.store offset=4 (local.get $p) (local.get $id))
      (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
      (call $update_thunk_end) (call $w2g (local.get $p)))
    (func (export "mn_window") (param $proc i32) (result i32)
      (local $h i32) (local.set $h (global.get $next_hwnd))
      (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
      (call $wnd_table_set (local.get $h) (local.get $proc)) (local.get $h))
  `;
  let now = 1000;
  const h = await bootRenderHarness({ fonts: 'none', extraWat,
    beforeInstantiate(ctx) {
      ctx.audioClockMs = () => now;
      ctx.readFile = p => /music1\.mid$/i.test(p) ? midi : null;
    },
  });
  const e = h.exports;
  // Initialize the actual guest/thunk arena; no PE application code is run.
  const pe = fs.readFileSync(path.join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(h.memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length)); e.init_dx_com_thunks();
  const put = (p, v) => e.guest_write32(p, v);
  const get = p => e.guest_read32(p) >>> 0;
  const bytes32 = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255];
  const bytes = (p, code) => code.forEach((v, i) => e.guest_write8(p + i, v));
  const thunks = new Map();
  function call(name, ...args) {
    if (!thunks.has(name)) thunks.set(name, e.mn_thunk(apis.find(a => a.name === name).id) >>> 0);
    // Fresh code per call avoids mutating already-decoded guest instructions.
    const stub = e.guest_alloc(128) >>> 0, code = [];
    for (const a of args.slice().reverse()) code.push(0x68, ...bytes32(a));
    code.push(0xb8, ...bytes32(thunks.get(name)), 0xff, 0xd0, 0xc2, 16, 0);
    bytes(stub, code);
    const esp = e.get_esp() >>> 0;
    e.call_func(stub, 0, 0, 0, 0);
    for (let i = 0; i < 10 && e.get_eip(); i++) e.run(1000);
    assert.strictEqual(e.get_eip(), 0, `${name} returned within the instruction bound`);
    assert.strictEqual(e.get_esp() >>> 0, esp, `${name} restored the guest stack`);
    return e.get_eax() >>> 0;
  }
  const obs = e.guest_alloc(32) >>> 0, proc = e.guest_alloc(128) >>> 0;
  const code = [0xff, 0x05, ...bytes32(obs)]; // inc dword [callback count]
  for (let i = 0; i < 4; i++) // copy actual WndProc arguments
    code.push(0x8b, 0x44, 0x24, 4 + i * 4, 0xa3, ...bytes32(obs + 4 + i * 4));
  code.push(0x31, 0xc0, 0xc2, 16, 0); bytes(proc, code);
  const hwnd = e.mn_window(proc) >>> 0;
  h.renderer.createWindow(hwnd, 0x10cf0000, 0, 0, 100, 100, 'MCI notify', 0, h.instance, h.memory);
  const msg = e.guest_alloc(32) >>> 0;
  function receive(status, id, label) {
    const count = get(obs);
    assert.strictEqual(call('PeekMessageA', msg, hwnd, MM_MCINOTIFY, MM_MCINOTIFY, 1), 1, label);
    assert.deepStrictEqual([0, 4, 8, 12].map(o => get(msg + o)), [hwnd, MM_MCINOTIFY, status, id], `${label}: MSG`);
    call('DispatchMessageA', msg);
    assert.strictEqual(get(obs), count + 1, `${label}: WndProc called once`);
    assert.deepStrictEqual([4, 8, 12, 16].map(o => get(obs + o)), [hwnd, MM_MCINOTIFY, status, id], `${label}: x86 WndProc`);
  }
  function empty(label) {
    assert.strictEqual(call('PeekMessageA', msg, hwnd, MM_MCINOTIFY, MM_MCINOTIFY, 1), 0, label);
  }
  const advance = () => { now += 1000; h.hostCtx.pumpAudioCompletions(); };
  const rows = [];
  for (const wide of [false, true]) {
    const api = wide ? 'mciSendCommandW' : 'mciSendCommandA';
    const type = e.guest_alloc(64) >>> 0, file = e.guest_alloc(64) >>> 0;
    function text(p, s) {
      for (let i = 0; i <= s.length; i++) {
        e.guest_write8(p + i * (wide ? 2 : 1), s.charCodeAt(i) || 0);
        if (wide) e.guest_write8(p + i * 2 + 1, 0);
      }
    }
    text(type, 'sequencer'); text(file, 'music1.mid');
    const params = e.guest_alloc(32) >>> 0, playParams = e.guest_alloc(16) >>> 0;
    put(playParams, hwnd); put(params + 8, type); put(params + 12, file);
    const cmd = (id, op, flags = 0, p = 0) => assert.strictEqual(call(api, id, op, flags, p), 0, `${api} ${op.toString(16)}`);
    const open = () => {
      put(params + 4, 0xcccccccc); cmd(0, 0x803, 0x2200, params);
      const id = get(params + 4); assert(id > 0 && id < 16);
      return id;
    };
    const play = (id, flags = 1) => cmd(id, 0x806, flags, playParams);
    const first = open(); play(first); advance(); receive(1, first, `${api} initial success`);
    empty('initial success once'); cmd(first, 0x804);
    const id = open(); assert.strictEqual(id, first, 'guest slot reused after close');
    const hostId = Math.max(...h.hostCtx._mci.devices.keys());
    assert.notStrictEqual(hostId, id, 'host ID diverges from reopened guest slot');
    play(id); advance(); receive(1, id, `${api} reopened success`); advance(); empty('success once');
    play(id); cmd(id, 0x808); receive(4, id, `${api} stop aborted`); advance(); empty('no late success after stop');
    play(id); play(id); receive(2, id, `${api} superseded`); advance(); receive(1, id, `${api} replacement success`); empty('replacement once');
    play(id, 0); advance(); empty('no notify flag, no success');
    play(id, 0); cmd(id, 0x808); empty('no notify flag, no abort');
    play(id); cmd(id, 0x804); receive(4, id, `${api} close aborted`); advance(); empty('no late success after close');
    const reopened = open(); assert.strictEqual(reopened, id);
    play(reopened, 0); cmd(reopened, 0x804); advance(); empty('no notify close');
    // Keep a higher slot live while the lower slot is closed and reused.
    const low = open(), high = open(); assert.notStrictEqual(low, high);
    cmd(low, 0x804);
    const reused = open(); assert.strictEqual(reused, low);
    play(high); play(reused); advance();
    receive(1, high, `${api} concurrent higher slot`);
    receive(1, reused, `${api} concurrent reused lower slot`);
    empty('concurrent completions once'); cmd(high, 0x804); cmd(reused, 0x804);
    rows.push({ api, guestId: id, hostId, statuses: [1, 4, 2, 1, 4] });
  }
  console.log('PASS public guest MCI notification identity through MSG and x86 WndProc', JSON.stringify(rows));
}
guestNotifications().catch(error => { console.error(error); process.exitCode = 1; });
