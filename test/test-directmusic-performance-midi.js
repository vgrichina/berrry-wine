#!/usr/bin/env node
'use strict';

// DirectMusic 8 (09a7m-directmusic.wat) through its COM vtables, the way the
// Game Maker 8 runner drives it: CoCreateInstance Performance8 + Loader8,
// InitAudio, CreateStandardAudioPath, Loader GetObject(DMUS_OBJ_MEMORY) of a
// Standard MIDI File, SetParam(GUID_StandardMIDIFile), Download,
// SetRepeats, PlaySegmentEx, IsPlaying, StopEx, master volume/tempo,
// audiopath volume, ReleaseObjectByUnknown, CloseDown. The host MIDI imports
// and the guest clock are replaced, so each channel message that reaches the
// host is recorded with the guest time it was sent at.

const assert = require('assert');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');
const apiTable = require('../src/api_table.json');
const api = name => {
  const row = apiTable.find(r => r.name === name);
  assert(row, `api ${name}`);
  return row;
};

const extraWat = String.raw`
  ;; Call API $api with its stdcall arguments already on the guest stack at
  ;; $esp (+4 = this); the first five also travel as handler parameters.
  (func (export "test_dm_call") (param $api i32) (param $esp i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (call $dispatch_api_table (local.get $api)
      (call $gl32 (i32.add (local.get $esp) (i32.const 4)))
      (call $gl32 (i32.add (local.get $esp) (i32.const 8)))
      (call $gl32 (i32.add (local.get $esp) (i32.const 12)))
      (call $gl32 (i32.add (local.get $esp) (i32.const 16)))
      (call $gl32 (i32.add (local.get $esp) (i32.const 20)))
      (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "test_dm_cocreate")
      (param $clsid i32) (param $iid i32) (param $out i32) (param $esp i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (call $handle_CoCreateInstance
      (local.get $clsid) (i32.const 0) (i32.const 1)
      (local.get $iid) (local.get $out) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dm_service") (call $dmusic_service))
  (func (export "test_dm_refcount") (param $obj i32) (result i32)
    (load.field DxObject refcount (call $dx_from_this (local.get $obj))))
  (func (export "test_dm_live") (result i32)
    (local $i i32) (local $count i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DX_MAX)))
      (if (i32.load (i32.add (global.get $DX_OBJECTS)
            (i32.mul (local.get $i) (i32.const 32))))
        (then (local.set $count (i32.add (local.get $count) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $count))
`;

// ---- a Standard MIDI File, format 1, 96 ticks per quarter note ----------
const vlq = n => {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
};
const chunk = (tag, bytes) => [...Buffer.from(tag), (bytes.length >>> 24) & 255,
  (bytes.length >>> 16) & 255, (bytes.length >>> 8) & 255, bytes.length & 255, ...bytes];
const track = events => chunk('MTrk', events.flatMap(([delta, ...b]) => [...vlq(delta), ...b]));
// Track 0: 120 bpm, at tick 96 switch to 240 bpm, end at 192.
const tempoTrack = track([
  [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20],
  [96, 0xff, 0x51, 3, 0x03, 0xd0, 0x90],
  [96, 0xff, 0x2f, 0],
]);
// Track 1, channel 0: program 19, C4 0..96, E4 (running status) 144..192.
const noteTrack = track([
  [0, 0xc0, 19],
  [0, 0x90, 60, 100],
  [96, 0x80, 60, 0],
  [48, 0x90, 64, 90],
  [48, 64, 0],
  [0, 0xff, 0x2f, 0],
]);
const smf = Buffer.from([...chunk('MThd', [0, 1, 0, 2, 0, 96]), ...tempoTrack, ...noteTrack]);
// The same file inside a RIFF RMID container.
const rmidBody = [...Buffer.from('RMID'), ...Buffer.from('data'),
  smf.length & 255, (smf.length >> 8) & 255, (smf.length >> 16) & 255, smf.length >>> 24, ...smf];
const rmid = Buffer.from([...Buffer.from('RIFF'), rmidBody.length & 255, (rmidBody.length >> 8) & 255,
  (rmidBody.length >> 16) & 255, rmidBody.length >>> 24, ...rmidBody]);

async function main() {
  const wasm = compileSrcWasm((file, source) =>
    file === '13-exports.wat' ? `${source}\n${extraWat}\n` : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  imports.host.memory = memory;
  let now = 1000;
  const events = [];
  const opens = [];
  let closes = 0;
  Object.assign(imports.host, {
    create_thread: () => 0, exit_thread: () => 0, terminate_thread: () => 0,
    create_event: () => 0, set_event: () => 0, reset_event: () => 0,
    wait_single: () => 0, wait_multiple: () => 0,
    com_create_instance: () => 0x80040154,
    get_ticks: () => now,
    midi_out_open: (dev, cb, inst, flags) => { opens.push([dev >>> 0, cb, inst, flags]); return 0x5151; },
    midi_out_short_msg: (handle, msg) => { events.push({ t: now, handle, msg: msg >>> 0 }); return 0; },
    midi_out_close: () => { closes++; return 0; },
    midi_out_reset: () => 0,
  });
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const e = instance.exports;
  e.init_dx_com_thunks();
  const dv = new DataView(memory.buffer);
  const wa = gp => gp - e.get_image_base() + e.get_guest_base();
  const alloc = n => e.guest_alloc(n) >>> 0;
  const u32 = gp => dv.getUint32(wa(gp), true);
  let pass = 0;
  let fail = 0;
  const check = (name, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : `  (${detail})`}`);
    ok ? pass++ : fail++;
  };
  const guid = words => {
    const p = alloc(16);
    words.forEach((w, i) => dv.setUint32(wa(p) + i * 4, w >>> 0, true));
    return p;
  };
  const bytes = buf => {
    const p = alloc(buf.length);
    new Uint8Array(memory.buffer, wa(p), buf.length).set(buf);
    return p;
  };
  const stack = alloc(256);
  const esp = stack + 64;
  // Vtable dispatch: slot $slot of $obj's vtable names the api id, as the
  // guest thunk would. Returns [hr, popped bytes].
  const vcall = (obj, slot, ...args) => {
    const thunk = u32(u32(obj) + slot * 4);
    assert.strictEqual(u32(thunk), 0xcaca0010, `slot ${slot} is a COM thunk`);
    const id = u32(thunk + 4);
    [obj, ...args].forEach((a, i) => dv.setUint32(wa(esp) + 4 + i * 4, a >>> 0, true));
    const hr = e.test_dm_call(id, esp) >>> 0;
    return { hr, pop: (e.get_esp() >>> 0) - esp, id };
  };
  const nameOf = id => apiTable[id].name;
  const out = alloc(4);
  const out2 = alloc(4);

  const D2AC = d0 => [d0, 0x11d1b39b, 0x60000487, 0xbdb19308];
  const clsidPerf = guid(D2AC(0xd2ac2881));
  const clsidSegment = guid(D2AC(0xd2ac2882));
  const clsidLoader = guid(D2AC(0xd2ac2892));
  const guidMasterTempo = guid(D2AC(0xd2ac28b0));
  const guidMasterVolume = guid(D2AC(0xd2ac28b1));
  const iidPerf8 = guid([0x679c4137, 0x4147c62e, 0x569db4b2, 0x4c25cb9a]);
  const iidPerf = guid([0x07d43d03, 0x11d26523, 0x60001d87, 0xbdb19308]);
  const iidLoader8 = guid([0x19e7c08c, 0x4e6a0a44, 0x5a5916a1, 0x8cded57c]);
  const iidSegment8 = guid([0xc6784488, 0x418f41a3, 0x50b315aa, 0xd442ba93]);
  const iidAudioPath = guid([0xc87631f5, 0x498623be, 0x83053688, 0xf948cc2f]);
  const iidSegState8 = guid([0xa50e4730, 0x48a70ae4, 0x04bc3998, 0x7277e0bf]);
  const iunknown = guid([0, 0, 0xc0, 0x46000000]);
  const guidStandardMIDIFile = guid([0x06621075, 0x11d1e92e, 0xc000c5a8, 0x6e72a34f]);

  // Vtable slots in the order of dmusici.h.
  const P = { QI: 0, AddRef: 1, Release: 2, Init: 3, IsPlaying: 14, GetGlobalParam: 33,
    SetGlobalParam: 34, CloseDown: 38, InitAudio: 44, PlaySegmentEx: 45, StopEx: 46,
    CreateStandardAudioPath: 49, SetDefaultAudioPath: 50, GetDefaultAudioPath: 51 };
  const L = { QI: 0, Release: 2, GetObject: 3, CollectGarbage: 12, ReleaseObjectByUnknown: 13 };
  const S = { QI: 0, Release: 2, GetLength: 3, GetRepeats: 5, SetRepeats: 6, SetParam: 19,
    Download: 29, Unload: 30 };
  const A = { QI: 0, Release: 2, Activate: 4, SetVolume: 5 };

  const live0 = e.test_dm_live();

  // ---- activation ------------------------------------------------------
  dv.setUint32(wa(out), 0xdeadbeef, true);
  check('CoCreateInstance(Performance) for the DirectX 6 IID stays class-not-registered',
    e.test_dm_cocreate(clsidPerf, iidPerf, out, esp) !== 0 && e.test_dm_live() === live0);
  check('CoCreateInstance(Performance, IID_IDirectMusicPerformance8) succeeds',
    e.test_dm_cocreate(clsidPerf, iidPerf8, out, esp) === 0 && u32(out) !== 0);
  const perf = u32(out);
  check('the performance holds exactly the caller reference', e.test_dm_refcount(perf) === 1);
  check('CoCreateInstance(Loader, IID_IDirectMusicLoader8) succeeds',
    e.test_dm_cocreate(clsidLoader, iidLoader8, out, esp) === 0 && u32(out) !== 0);
  const loader = u32(out);
  check('the loader holds exactly the caller reference', e.test_dm_refcount(loader) === 1);
  {
    const r = vcall(perf, P.QI, iidPerf, out2);
    check('Performance8 answers QI for IDirectMusicPerformance and AddRefs',
      r.hr === 0 && u32(out2) === perf && e.test_dm_refcount(perf) === 2 && r.pop === 16);
    vcall(perf, P.Release);
  }
  for (const [slot, name] of [[0, 'QueryInterface'], [3, 'Init'], [14, 'IsPlaying'],
      [44, 'InitAudio'], [45, 'PlaySegmentEx'], [49, 'CreateStandardAudioPath'], [53, 'SetParamEx']]) {
    const id = u32(u32(u32(perf) + slot * 4) + 4);
    check(`Performance8 vtable slot ${slot} is ${name}`, nameOf(id) === `IDirectMusicPerformance8_${name}`);
  }
  {
    const id = u32(u32(u32(loader) + 14 * 4) + 4);
    check('Loader8 vtable slot 14 is LoadObjectFromFile', nameOf(id) === 'IDirectMusicLoader8_LoadObjectFromFile');
  }

  // ---- InitAudio --------------------------------------------------------
  const ppDM = alloc(4);
  dv.setUint32(wa(ppDM), 0, true);
  {
    const r = vcall(perf, P.InitAudio, ppDM, 0, 0x10010, 8, 64, 0x3f, 0);
    check('InitAudio(DYNAMIC_STEREO, 64, ALL) succeeds and pops 36 bytes', r.hr === 0 && r.pop === 36,
      `hr=${r.hr.toString(16)} pop=${r.pop}`);
    check('InitAudio opens the host MIDI mapper with no callback',
      opens.length === 1 && opens[0][0] === 0xffffffff && opens[0][1] === 0);
    check('InitAudio hands back an IDirectMusic through ppDirectMusic', u32(ppDM) !== 0);
    check('a second InitAudio is DMUS_E_ALREADY_INITED',
      vcall(perf, P.InitAudio, 0, 0, 0, 8, 64, 0x3f, 0).hr === 0x88781151 && opens.length === 1);
    vcall(u32(ppDM), 2); // release the IDirectMusic
  }
  {
    const r = vcall(perf, P.GetDefaultAudioPath, out);
    check('InitAudio created the default audiopath', r.hr === 0 && u32(out) !== 0 && r.pop === 12);
    vcall(u32(out), A.Release);
  }
  {
    const r = vcall(perf, P.CreateStandardAudioPath, 8, 64, 1, out);
    check('CreateStandardAudioPath(DYNAMIC_STEREO, active) succeeds, pops 24',
      r.hr === 0 && u32(out) !== 0 && r.pop === 24);
    check('CreateStandardAudioPath rejects an unknown path type',
      vcall(perf, P.CreateStandardAudioPath, 99, 64, 1, out2).hr === 0x80070057 && u32(out2) === 0);
  }
  const path = u32(out);
  {
    const r = vcall(path, A.QI, iidAudioPath, out2);
    check('AudioPath8 answers its own IID', r.hr === 0 && u32(out2) === path);
    vcall(path, A.Release);
  }

  // ---- loading ----------------------------------------------------------
  const desc = alloc(0x350);
  const loadDesc = (buf, cls = clsidSegment) => {
    new Uint8Array(memory.buffer, wa(desc), 0x350).fill(0);
    dv.setUint32(wa(desc), 0x350, true);
    dv.setUint32(wa(desc) + 4, 0x402, true); // DMUS_OBJ_CLASS | DMUS_OBJ_MEMORY
    for (let i = 0; i < 16; i++) dv.setUint8(wa(desc) + 0x18 + i, dv.getUint8(wa(cls) + i));
    dv.setUint32(wa(desc) + 0x340, buf.length, true);
    dv.setUint32(wa(desc) + 0x348, bytes(buf), true);
    dv.setUint32(wa(out), 0xdeadbeef, true);
    return vcall(loader, L.GetObject, desc, iidSegment8, out);
  };
  {
    const r = loadDesc(smf);
    check('Loader GetObject(CLASS|MEMORY, CLSID_DirectMusicSegment) loads the SMF, pops 20',
      r.hr === 0 && u32(out) !== 0 && r.pop === 20, `hr=${r.hr.toString(16)}`);
  }
  const seg = u32(out);
  check('the segment has the caller reference plus the loader cache reference', e.test_dm_refcount(seg) === 2);
  check('GetObject rejects a non-MIDI stream as DMUS_E_UNSUPPORTED_STREAM',
    loadDesc(Buffer.from('this is not a midi file at all')).hr === 0x88781150 && u32(out) === 0);
  check('GetObject rejects a truncated track as DMUS_E_INVALIDFILE',
    loadDesc(smf.subarray(0, smf.length - 3)).hr === 0x88781200 && u32(out) === 0);
  {
    const r = loadDesc(rmid);
    check('GetObject loads the same file wrapped in RIFF RMID', r.hr === 0 && u32(out) !== 0);
    const rm = u32(out);
    check('the RMID segment has the same length (192 ticks = 1536 music time)',
      vcall(rm, S.GetLength, out2).hr === 0 && u32(out2) === 1536);
    check('ReleaseObjectByUnknown drops the cache reference of the RMID segment',
      vcall(loader, L.ReleaseObjectByUnknown, rm).hr === 0 && e.test_dm_refcount(rm) === 1);
    check('the RMID segment frees on its last release', vcall(rm, S.Release).hr === 0);
  }

  check('Segment8 answers QI for IUnknown',
    vcall(seg, S.QI, iunknown, out2).hr === 0 && u32(out2) === seg && e.test_dm_refcount(seg) === 3);
  vcall(seg, S.Release);
  {
    const r = vcall(seg, S.SetParam, guidStandardMIDIFile, 0xffffffff, 0, 0, 0);
    check('Segment SetParam(GUID_StandardMIDIFile) succeeds, pops 28', r.hr === 0 && r.pop === 28);
  }
  check('Segment Download(performance) succeeds', vcall(seg, S.Download, perf).hr === 0);
  check('GetLength is 192 ticks at 96 ppq = 1536 DMUS_PPQ music time',
    vcall(seg, S.GetLength, out2).hr === 0 && u32(out2) === 1536);
  check('SetRepeats(1) then GetRepeats reads it back',
    vcall(seg, S.SetRepeats, 1).hr === 0 && vcall(seg, S.GetRepeats, out2).hr === 0 && u32(out2) === 1);

  // ---- playback ---------------------------------------------------------
  const msgs = from => events.slice(from).map(ev => ev.msg);
  const hex = list => list.map(m => m.toString(16)).join(' ');
  const pState = alloc(4);
  let mark = events.length;
  now = 1000;
  {
    const r = vcall(perf, P.PlaySegmentEx, seg, 0, 0, 0x4000, 0, 0, pState, 0, path);
    check('PlaySegmentEx(DMUS_SEGF_DEFAULT) succeeds and pops 44 bytes', r.hr === 0 && r.pop === 44,
      `hr=${r.hr.toString(16)} pop=${r.pop}`);
  }
  check('PlaySegmentEx returns a segment state object', u32(pState) !== 0);
  const state = u32(pState);
  check('the segment state answers QI for IDirectMusicSegmentState8',
    vcall(state, 0, iidSegState8, out2).hr === 0 && u32(out2) === state);
  vcall(state, 2);
  check('the tick-0 events reach the host at once: channel volume 100, program 19, C4 on',
    JSON.stringify(msgs(mark)) === JSON.stringify([0x6407b0, 0x13c0, 0x643c90]) &&
    events.slice(mark).every(ev => ev.t === 1000 && ev.handle === 0x5151), hex(msgs(mark)));
  check('IsPlaying(segment) is S_OK while it plays', vcall(perf, P.IsPlaying, seg, 0).hr === 0);
  check('IsPlaying(NULL, state) is S_OK while it plays', vcall(perf, P.IsPlaying, 0, state).hr === 0);

  mark = events.length;
  now = 1499; e.test_dm_service();
  check('nothing is due before tick 96 (500 ms at 120 bpm)', events.length === mark);
  now = 1500; e.test_dm_service();
  check('C4 note-off arrives at 500 ms', JSON.stringify(msgs(mark)) === JSON.stringify([0x3c80]), hex(msgs(mark)));
  mark = events.length;
  now = 1624; e.test_dm_service();
  check('the tempo change to 240 bpm makes tick 144 fall at 625 ms, not 750', events.length === mark);
  now = 1625; e.test_dm_service();
  check('E4 note-on arrives at 625 ms', JSON.stringify(msgs(mark)) === JSON.stringify([0x5a4090]), hex(msgs(mark)));
  mark = events.length;
  now = 1750; e.test_dm_service();
  check('at the end (750 ms) the running-status note-off sounds and the one repeat restarts the file',
    JSON.stringify(msgs(mark)) === JSON.stringify([0x4090, 0x13c0, 0x643c90]), hex(msgs(mark)));
  check('IsPlaying stays S_OK through the repeat', vcall(perf, P.IsPlaying, seg, 0).hr === 0);
  mark = events.length;
  now = 2249; e.test_dm_service();
  const beforeRepeatOff = events.length - mark;
  now = 2250; e.test_dm_service();
  check('the repeat restarts at 120 bpm (note-off at 1750 + 500 ms)',
    beforeRepeatOff === 0 && JSON.stringify(msgs(mark)) === JSON.stringify([0x3c80]), hex(msgs(mark)));
  mark = events.length;
  now = 2600; e.test_dm_service();
  check('after the last repeat the segment ends: E4 on/off, then sustain off and all notes off on channel 0',
    JSON.stringify(msgs(mark)) === JSON.stringify([0x5a4090, 0x4090, 0x40b0, 0x7bb0]), hex(msgs(mark)));
  check('IsPlaying(segment) is S_FALSE once it has ended', vcall(perf, P.IsPlaying, seg, 0).hr === 1);
  check('IsPlaying of the finished state is S_FALSE', vcall(perf, P.IsPlaying, 0, state).hr === 1);
  check('the performance dropped its segment reference at the end', e.test_dm_refcount(seg) === 2);
  check('the finished state releases to zero', vcall(state, 2).hr === 0);

  // ---- looping, volume, tempo, stop ------------------------------------
  check('SetRepeats(DMUS_SEG_REPEAT_INFINITE)', vcall(seg, S.SetRepeats, 0xffffffff).hr === 0);
  now = 10000;
  mark = events.length;
  vcall(perf, P.PlaySegmentEx, seg, 0, 0, 0x4000, 0, 0, 0, 0, path);
  for (now = 10250; now <= 12250; now += 250) e.test_dm_service();
  const loops = events.slice(mark).filter(ev => ev.msg === 0x643c90).map(ev => ev.t);
  check('an infinite segment loops every 750 ms', JSON.stringify(loops) === JSON.stringify([10000, 10750, 11500, 12250]),
    JSON.stringify(loops));
  dv.setInt32(wa(out2), -2000, true);
  mark = events.length;
  {
    const r = vcall(perf, P.SetGlobalParam, guidMasterVolume, out2, 4);
    check('SetGlobalParam(GUID_PerfMasterVolume, -2000) succeeds and pops 20', r.hr === 0 && r.pop === 20);
  }
  check('-20 dB master volume re-sends channel volume 100 as 10',
    JSON.stringify(msgs(mark)) === JSON.stringify([0x0a07b0]), hex(msgs(mark)));
  dv.setInt32(wa(out2), 0, true);
  check('GetGlobalParam(GUID_PerfMasterVolume) reads -2000 back',
    vcall(perf, P.GetGlobalParam, guidMasterVolume, out2, 4).hr === 0 && dv.getInt32(wa(out2), true) === -2000);
  mark = events.length;
  check('AudioPath SetVolume(-1000) succeeds, pops 16', (() => {
    const r = vcall(path, A.SetVolume, -1000 >>> 0, 0);
    return r.hr === 0 && r.pop === 16;
  })());
  check('master + path = -30 dB re-sends channel volume as 3',
    JSON.stringify(msgs(mark)) === JSON.stringify([0x0307b0]), hex(msgs(mark)));
  check('AudioPath SetVolume refuses a positive volume', vcall(path, A.SetVolume, 100, 0).hr === 0x80070057);
  dv.setInt32(wa(out2), 0, true);
  vcall(perf, P.SetGlobalParam, guidMasterVolume, out2, 4);
  vcall(path, A.SetVolume, 0, 0);
  // Master tempo 2.0: the loop that started at 12250 has its note-off
  // 250 ms after 12250 instead of 500.
  now = 12250;
  dv.setFloat32(wa(out2), 2.0, true);
  check('SetGlobalParam(GUID_PerfMasterTempo, 2.0) succeeds',
    vcall(perf, P.SetGlobalParam, guidMasterTempo, out2, 4).hr === 0);
  mark = events.length;
  now = 12499; e.test_dm_service();
  const early = msgs(mark).length;
  now = 12500; e.test_dm_service();
  check('at master tempo 2.0 the note-off comes 250 ms into the loop',
    early === 0 && JSON.stringify(msgs(mark)) === JSON.stringify([0x3c80]), hex(msgs(mark)));
  mark = events.length;
  {
    const r = vcall(perf, P.StopEx, seg, 0, 0, 0);
    check('StopEx(segment) succeeds and pops 24', r.hr === 0 && r.pop === 24);
  }
  check('StopEx silences channel 0', JSON.stringify(msgs(mark)) === JSON.stringify([0x40b0, 0x7bb0]), hex(msgs(mark)));
  check('IsPlaying is S_FALSE after StopEx', vcall(perf, P.IsPlaying, seg, 0).hr === 1);
  mark = events.length;
  now = 20000; e.test_dm_service();
  check('nothing plays after StopEx', events.length === mark);

  // A secondary segment plays alongside a primary; a new primary replaces
  // the old primary only.
  vcall(seg, S.SetRepeats, 0);
  now = 30000;
  vcall(perf, P.PlaySegmentEx, seg, 0, 0, 0x4000, 0, 0, 0, 0, path);
  vcall(perf, P.PlaySegmentEx, seg, 0, 0, 0x80, 0, 0, pState, 0, path);
  const secondary = u32(pState);
  check('primary and secondary instances of one segment both hold references', e.test_dm_refcount(seg) === 4);
  vcall(perf, P.PlaySegmentEx, seg, 0, 0, 0x4000, 0, 0, 0, 0, path);
  check('a new primary replaces the old primary, not the secondary', e.test_dm_refcount(seg) === 4);
  check('StopEx(state) stops just that instance',
    vcall(perf, P.StopEx, secondary, 0, 0, 0).hr === 0 && e.test_dm_refcount(seg) === 3 &&
    vcall(perf, P.IsPlaying, 0, secondary).hr === 1 && vcall(perf, P.IsPlaying, seg, 0).hr === 0);
  vcall(secondary, 2);

  // ---- teardown ---------------------------------------------------------
  check('Segment Unload(performance) succeeds', vcall(seg, S.Unload, perf).hr === 0);
  check('ReleaseObjectByUnknown(segment) drops the cache reference, pops 12', (() => {
    const r = vcall(loader, L.ReleaseObjectByUnknown, seg);
    return r.hr === 0 && r.pop === 12 && e.test_dm_refcount(seg) === 2;
  })());
  check('a second ReleaseObjectByUnknown is DMUS_E_LOADER_OBJECTNOTFOUND',
    vcall(loader, L.ReleaseObjectByUnknown, seg).hr === 0x88781185);
  check('CollectGarbage pops 8', vcall(loader, L.CollectGarbage).pop === 8);
  const closesBefore = closes;
  mark = events.length;
  check('CloseDown succeeds', vcall(perf, P.CloseDown).hr === 0);
  check('CloseDown stops the playing primary and closes the MIDI device',
    closes === closesBefore + 1 && JSON.stringify(msgs(mark)) === JSON.stringify([0x40b0, 0x7bb0]) &&
    e.test_dm_refcount(seg) === 1, hex(msgs(mark)));
  check('PlaySegmentEx after CloseDown is DMUS_E_NOT_INIT',
    vcall(perf, P.PlaySegmentEx, seg, 0, 0, 0, 0, 0, 0, 0, path).hr === 0x88781162);
  check('the caller releases the segment to zero', vcall(seg, S.Release).hr === 0);
  check('the caller releases the audiopath to zero', vcall(path, A.Release).hr === 0);
  check('the loader releases to zero', vcall(loader, L.Release).hr === 0);
  check('the performance releases to zero', vcall(perf, P.Release).hr === 0);
  check('every DirectMusic object was freed', e.test_dm_live() === live0, `${e.test_dm_live()} vs ${live0}`);

  // ---- fail-fast edges --------------------------------------------------
  e.test_dm_cocreate(clsidPerf, iidPerf8, out, esp);
  const perf2 = u32(out);
  assert.throws(() => vcall(perf2, P.Init, 0, 0, 0), WebAssembly.RuntimeError, 'Init traps');
  check('an unimplemented Performance8 method (Init) traps', true);
  // WAVE segments: test-directmusic-wave-segments.js.

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
