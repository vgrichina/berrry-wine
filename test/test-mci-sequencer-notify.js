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
