#!/usr/bin/env node
'use strict';

// DirectMusic 8 WAVE segments (09a7m-directmusic.wat), the way the Game
// Maker 7 runner (Metrojd, docs/re-notes/game-maker-benchmark-attempts.md)
// plays every normal sound: per sound a CreateStandardAudioPath, Loader
// GetObject(DMUS_OBJ_MEMORY) of a RIFF WAVE, SetParam/Download, SetRepeats,
// PlaySegmentEx(SECONDARY), IsPlaying, StopEx, AudioPath SetVolume, and the
// pan path GetObjectInPath(DMUS_PATH_BUFFER) -> IDirectSoundBuffer8 SetPan.
// The host voice imports (the mixer slots IDirectSoundBuffer plays through)
// and the guest clock are replaced, so every voice call is recorded.

const assert = require('assert');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');
const apiTable = require('../src/api_table.json');

const extraWat = String.raw`
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

// ---- RIFF WAVE files ----------------------------------------------------
const le32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24];
const le16 = n => [n & 255, (n >>> 8) & 255];
const chunk = (tag, bytes) => [...Buffer.from(tag), ...le32(bytes.length), ...bytes,
  ...(bytes.length & 1 ? [0] : [])];
const fmt = ({ tag = 1, ch, rate, bits }) => chunk('fmt ', [...le16(tag), ...le16(ch), ...le32(rate),
  ...le32(rate * ch * bits / 8), ...le16(ch * bits / 8), ...le16(bits)]);
const riff = parts => {
  const body = [...Buffer.from('WAVE'), ...parts.flat()];
  return Buffer.from([...Buffer.from('RIFF'), ...le32(body.length), ...body]);
};
// 22050 Hz mono 16-bit, 11025 frames = 500 ms, with a LIST chunk before data
// and one odd trailing byte the loader must trim to whole frames.
const pcm16 = Buffer.alloc(22051);
for (let i = 0; i < 11025; i++) pcm16.writeInt16LE(Math.round(8000 * Math.sin(i / 7)), i * 2);
pcm16[22050] = 0x5a;
const wave16 = riff([fmt({ ch: 1, rate: 22050, bits: 16 }), chunk('LIST', [...Buffer.from('INFOabcd')]),
  chunk('data', [...pcm16])]);
// 11025 Hz stereo 8-bit, 1103 frames = 100.04 ms -> 101 ms.
const wave8 = riff([fmt({ ch: 2, rate: 11025, bits: 8 }), chunk('data', Array(2206).fill(0x80))]);
// WAVE_FORMAT_EXTENSIBLE whose subformat is PCM.
const extensible = riff([chunk('fmt ', [...le16(0xfffe), ...le16(1), ...le32(8000), ...le32(16000),
  ...le16(2), ...le16(16), ...le16(22), ...le16(16), ...le32(4),
  ...le32(1), ...le32(0x00100000), ...le32(0xaa000080), ...le32(0x719b3800)]),
chunk('data', Array(1600).fill(0))]);
const adpcm = riff([fmt({ tag: 2, ch: 1, rate: 22050, bits: 4 }), chunk('data', Array(64).fill(0))]);
const noData = riff([fmt({ ch: 1, rate: 22050, bits: 16 })]);
const zeroRate = riff([fmt({ ch: 1, rate: 0, bits: 16 }), chunk('data', [0, 0])]);
const bits24 = riff([fmt({ ch: 1, rate: 8000, bits: 24 }), chunk('data', [0, 0, 0])]);

async function main() {
  const wasm = compileSrcWasm((file, source) =>
    file === '13-exports.wat' ? `${source}\n${extraWat}\n` : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  imports.host.memory = memory;
  let now = 1000;
  let nextVoice = 0x700;
  const calls = [];
  const rec = (name, ...args) => calls.push([name, ...args.map(a => a | 0)]);
  Object.assign(imports.host, {
    create_thread: () => 0, exit_thread: () => 0, terminate_thread: () => 0,
    create_event: () => 0, set_event: () => 0, reset_event: () => 0,
    wait_single: () => 0, wait_multiple: () => 0,
    com_create_instance: () => 0x80040154,
    get_ticks: () => now,
    midi_out_open: () => 0x5151, midi_out_short_msg: () => 0, midi_out_close: () => 0, midi_out_reset: () => 0,
    voice_open: (rate, ch, bits) => { rec('open', rate, ch, bits); return ++nextVoice; },
    voice_play_ring: (id, ptr, len, start, loop) => {
      rec('play', id, len, start, loop);
      calls[calls.length - 1].pcm = Buffer.from(new Uint8Array(memory.buffer, ptr >>> 0, len >>> 0));
      return 0;
    },
    voice_stop: id => { rec('stop', id); return 0; },
    voice_close: id => { rec('close', id); return 0; },
    voice_set_volume_linear: (id, v) => { rec('vol', id, v); },
    voice_set_pan: (id, pan) => { rec('pan', id, pan); },
    voice_write_stream: () => { throw new Error('a WAVE segment must not stream'); },
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
  const vcall = (obj, slot, ...args) => {
    const thunk = u32(u32(obj) + slot * 4);
    assert.strictEqual(u32(thunk), 0xcaca0010, `slot ${slot} is a COM thunk`);
    const id = u32(thunk + 4);
    [obj, ...args].forEach((a, i) => dv.setUint32(wa(esp) + 4 + i * 4, a >>> 0, true));
    const hr = e.test_dm_call(id, esp) >>> 0;
    return { hr, pop: (e.get_esp() >>> 0) - esp, id };
  };
  const out = alloc(4);
  const out2 = alloc(4);
  const since = mark => calls.slice(mark).map(c => c.slice(0, 6));
  const js = v => JSON.stringify(v);

  const D2AC = d0 => [d0, 0x11d1b39b, 0x60000487, 0xbdb19308];
  const clsidPerf = guid(D2AC(0xd2ac2881));
  const clsidSegment = guid(D2AC(0xd2ac2882));
  const clsidLoader = guid(D2AC(0xd2ac2892));
  const guidMasterVolume = guid(D2AC(0xd2ac28b1));
  const iidPerf8 = guid([0x679c4137, 0x4147c62e, 0x569db4b2, 0x4c25cb9a]);
  const iidLoader8 = guid([0x19e7c08c, 0x4e6a0a44, 0x5a5916a1, 0x8cded57c]);
  const iidSegment8 = guid([0xc6784488, 0x418f41a3, 0x50b315aa, 0xd442ba93]);
  const iidDSB8 = guid([0x6825a449, 0x4d827524, 0xe3500f92, 0x1eabb36a]);
  const iidDSB = guid([0x279afa85, 0x11ce4981, 0x200021a5, 0x60e50baf]);
  const iidDS3DB = guid([0x279afa86, 0x11ce4981, 0x200021a5, 0x60e50baf]);
  const guidAllObjects = guid([0xaa114de5, 0x4169c262, 0xd623c8a1, 0xb573cc98]);
  // GUID_StandardMIDIFile: GM sets it on every sound; a WAVE ignores it.
  const guidStandardMIDIFile = guid([0x06621075, 0x11d1e92e, 0xc000c5a8, 0x6e72a34f]);

  const P = { Release: 2, IsPlaying: 14, SetGlobalParam: 34, CloseDown: 38, InitAudio: 44,
    PlaySegmentEx: 45, StopEx: 46, CreateStandardAudioPath: 49 };
  const L = { Release: 2, GetObject: 3, ReleaseObjectByUnknown: 13 };
  const S = { Release: 2, GetLength: 3, SetRepeats: 6, SetParam: 19, Download: 29, Unload: 30 };
  const A = { Release: 2, GetObjectInPath: 3, SetVolume: 5 };
  const B = { QI: 0, AddRef: 1, Release: 2, GetVolume: 6, GetPan: 7, SetVolume: 15, SetPan: 16 };

  const live0 = e.test_dm_live();
  e.test_dm_cocreate(clsidPerf, iidPerf8, out, esp);
  const perf = u32(out);
  e.test_dm_cocreate(clsidLoader, iidLoader8, out, esp);
  const loader = u32(out);
  check('InitAudio succeeds', vcall(perf, P.InitAudio, 0, 0, 0x10010, 8, 64, 0x3f, 0).hr === 0);
  vcall(perf, P.CreateStandardAudioPath, 8, 64, 1, out);
  const path = u32(out);

  // ---- loading ----------------------------------------------------------
  const desc = alloc(0x350);
  const loadDesc = buf => {
    new Uint8Array(memory.buffer, wa(desc), 0x350).fill(0);
    dv.setUint32(wa(desc), 0x350, true);
    dv.setUint32(wa(desc) + 4, 0x402, true); // DMUS_OBJ_CLASS | DMUS_OBJ_MEMORY
    for (let i = 0; i < 16; i++) dv.setUint8(wa(desc) + 0x18 + i, dv.getUint8(wa(clsidSegment) + i));
    dv.setUint32(wa(desc) + 0x340, buf.length, true);
    dv.setUint32(wa(desc) + 0x348, bytes(buf), true);
    dv.setUint32(wa(out), 0xdeadbeef, true);
    return vcall(loader, L.GetObject, desc, iidSegment8, out);
  };
  check('GetObject(CLASS|MEMORY) loads a RIFF WAVE as a segment, pops 20', (() => {
    const r = loadDesc(wave16);
    return r.hr === 0 && u32(out) !== 0 && r.pop === 20;
  })());
  const seg = u32(out);
  check('a 500 ms WAVE is 768 music-time units long (DMUS_PPQ at 120 bpm)',
    vcall(seg, S.GetLength, out2).hr === 0 && u32(out2) === 768, u32(out2));
  check('SetParam(GUID_StandardMIDIFile) and Download succeed on a WAVE segment',
    vcall(seg, S.SetParam, guidStandardMIDIFile, 0xffffffff, 0, 0, 0).hr === 0 &&
    vcall(seg, S.Download, perf).hr === 0);
  check('a 1103-frame 11025 Hz WAVE rounds up to 101 ms (155 music time)', (() => {
    const r = loadDesc(wave8);
    const s = u32(out);
    const ok = r.hr === 0 && vcall(s, S.GetLength, out2).hr === 0 && u32(out2) === Math.floor(101 * 768 / 500);
    vcall(loader, L.ReleaseObjectByUnknown, s);
    vcall(s, S.Release);
    return ok;
  })(), u32(out2));
  check('WAVE_FORMAT_EXTENSIBLE with a PCM subformat loads (100 ms)', (() => {
    const r = loadDesc(extensible);
    const s = u32(out);
    const ok = r.hr === 0 && vcall(s, S.GetLength, out2).hr === 0 && u32(out2) === 153;
    vcall(loader, L.ReleaseObjectByUnknown, s);
    vcall(s, S.Release);
    return ok;
  })(), u32(out2));
  check('a WAVE with no data chunk is DMUS_E_INVALIDFILE',
    loadDesc(noData).hr === 0x88781200 && u32(out) === 0);
  check('a WAVE with a zero sample rate is DMUS_E_INVALIDFILE',
    loadDesc(zeroRate).hr === 0x88781200 && u32(out) === 0);

  // ---- playback ---------------------------------------------------------
  const pState = alloc(4);
  let mark = calls.length;
  now = 1000;
  check('PlaySegmentEx(SECONDARY) on the path succeeds, pops 44', (() => {
    const r = vcall(perf, P.PlaySegmentEx, seg, 0, 0, 0x80, 0, 0, pState, 0, path);
    return r.hr === 0 && r.pop === 44 && u32(pState) !== 0;
  })());
  const voice1 = nextVoice;
  const played = calls.slice(mark);
  check('the instance opens one 22050 Hz mono 16-bit host voice at full volume, centre pan, then plays once',
    js(since(mark)) === js([['open', 22050, 1, 16], ['vol', voice1, 65535], ['pan', voice1, 0],
      ['play', voice1, 22050, 0, 0]]), js(since(mark)));
  check('the voice gets exactly the PCM samples, trailing odd byte trimmed',
    played[3] && played[3].pcm.equals(pcm16.subarray(0, 22050)));
  check('IsPlaying(segment) is S_OK while it plays', vcall(perf, P.IsPlaying, seg, 0).hr === 0);
  const state1 = u32(pState);
  now = 1499; e.test_dm_service();
  check('IsPlaying(NULL, state) is still S_OK at 499 ms', vcall(perf, P.IsPlaying, 0, state1).hr === 0);
  mark = calls.length;
  now = 1500; e.test_dm_service();
  check('at 500 ms the one-shot ends: its voice is stopped and closed',
    js(since(mark)) === js([['stop', voice1], ['close', voice1]]), js(since(mark)));
  check('IsPlaying(segment) is S_FALSE once it has ended', vcall(perf, P.IsPlaying, seg, 0).hr === 1);
  check('the finished state releases to zero', vcall(state1, 2).hr === 0);

  // SetRepeats(2): one voice that loops, ending after three lengths.
  vcall(seg, S.SetRepeats, 2);
  now = 5000;
  mark = calls.length;
  vcall(perf, P.PlaySegmentEx, seg, 0, 0, 0x80, 0, 0, 0, 0, path);
  const voice2 = nextVoice;
  check('a repeating WAVE plays its voice looped',
    js(since(mark).filter(c => c[0] === 'play')) === js([['play', voice2, 22050, 0, 1]]), js(since(mark)));
  now = 6499;
  check('with 2 repeats it is still playing at 1499 ms', vcall(perf, P.IsPlaying, seg, 0).hr === 0);
  mark = calls.length;
  now = 6500; e.test_dm_service();
  check('and stops at 3 x 500 ms', js(since(mark)) === js([['stop', voice2], ['close', voice2]]),
    js(since(mark)));

  // Infinite repeats, then volume, pan and StopEx.
  vcall(seg, S.SetRepeats, 0xffffffff);
  now = 10000;
  mark = calls.length;
  vcall(perf, P.PlaySegmentEx, seg, 0, 0, 0x80, 0, 0, 0, 0, path);
  const voice3 = nextVoice;
  check('DMUS_SEG_REPEAT_INFINITE loops the voice',
    js(since(mark).filter(c => c[0] === 'play')) === js([['play', voice3, 22050, 0, 1]]));
  now = 1e6; e.test_dm_service();
  check('an infinite WAVE is still playing much later', vcall(perf, P.IsPlaying, seg, 0).hr === 0);
  mark = calls.length;
  dv.setInt32(wa(out2), -2000, true);
  vcall(perf, P.SetGlobalParam, guidMasterVolume, out2, 4);
  check('-20 dB master volume sets the voice to 10% linear',
    js(since(mark)) === js([['vol', voice3, 6553], ['pan', voice3, 0]]), js(since(mark)));
  mark = calls.length;
  vcall(path, A.SetVolume, -1000 >>> 0, 0);
  const g30 = Math.trunc(Math.fround(Math.pow(10, -3000 / 2000)) * 65535);
  check('master + audiopath -30 dB sets the voice gain to 10^-1.5',
    since(mark).length === 2 && since(mark)[0][0] === 'vol' && Math.abs(since(mark)[0][2] - g30) <= 1,
    js(since(mark)));

  // GM's sound_pan: GetObjectInPath(DMUS_PCHANNEL_ALL, DMUS_PATH_BUFFER, 0,
  // GUID_All_Objects, 0, IID_IDirectSoundBuffer8) then SetPan and Release.
  dv.setUint32(wa(out), 0xdeadbeef, true);
  const pathRefs = e.test_dm_refcount(path);
  const gop =(iid, stage = 0x6000) => vcall(path, A.GetObjectInPath, 0xfffffffb, stage, 0, guidAllObjects, 0, iid, out);
  const r = gop(iidDSB8);
  check('GetObjectInPath(DMUS_PATH_BUFFER, IID_IDirectSoundBuffer8) succeeds and pops 36',
    r.hr === 0 && r.pop === 36 && u32(out) !== 0, `hr=${r.hr.toString(16)} pop=${r.pop}`);
  const buf = u32(out);
  check('the buffer holds a reference on its audiopath', e.test_dm_refcount(path) === pathRefs + 1);
  check('the buffer answers QI for IDirectSoundBuffer and AddRefs',
    vcall(buf, B.QI, iidDSB, out2).hr === 0 && u32(out2) === buf && e.test_dm_refcount(buf) === 2);
  vcall(buf, B.Release);
  check('the buffer refuses QI for IDirectSound3DBuffer', vcall(buf, B.QI, iidDS3DB, out2).hr === 0x80004002);
  mark = calls.length;
  check('SetPan(-5000) succeeds and pops 12', (() => {
    const s = vcall(buf, B.SetPan, -5000 >>> 0);
    return s.hr === 0 && s.pop === 12;
  })());
  check('SetPan reaches the playing voice on that path',
    since(mark).some(c => c[0] === 'pan' && c[1] === voice3 && c[2] === -5000), js(since(mark)));
  check('GetPan reads -5000 back', vcall(buf, B.GetPan, out2).hr === 0 && dv.getInt32(wa(out2), true) === -5000);
  check('SetPan refuses a value beyond DSBPAN_RIGHT', vcall(buf, B.SetPan, 10001).hr === 0x80070057);
  mark = calls.length;
  vcall(buf, B.SetVolume, -1000 >>> 0);
  const g40 = Math.trunc(Math.fround(Math.pow(10, -4000 / 2000)) * 65535);
  check('buffer SetVolume(-1000) adds to master + path: -40 dB',
    since(mark).some(c => c[0] === 'vol' && c[1] === voice3 && Math.abs(c[2] - g40) <= 1), js(since(mark)));
  check('GetVolume reads -1000 back', vcall(buf, B.GetVolume, out2).hr === 0 && dv.getInt32(wa(out2), true) === -1000);
  vcall(buf, B.SetVolume, 0);
  check('releasing the buffer frees it and drops its path reference',
    vcall(buf, B.Release).hr === 0 && e.test_dm_refcount(path) === pathRefs);
  dv.setInt32(wa(out2), 0, true);
  vcall(perf, P.SetGlobalParam, guidMasterVolume, out2, 4);
  vcall(path, A.SetVolume, 0, 0);

  mark = calls.length;
  vcall(seg, S.SetRepeats, 0);
  vcall(perf, P.PlaySegmentEx, seg, 0, 0, 0x80, 0, 0, 0, 0, path);
  const voice4 = nextVoice;
  check('a new voice on the path starts at the path pan',
    since(mark).some(c => c[0] === 'pan' && c[1] === voice4 && c[2] === -5000), js(since(mark)));
  check('two secondary instances of one segment play at once', vcall(perf, P.IsPlaying, seg, 0).hr === 0 &&
    e.test_dm_refcount(seg) === 4);
  mark = calls.length;
  check('StopEx(segment) succeeds and pops 24', vcall(perf, P.StopEx, seg, 0, 0, 0).pop === 24);
  check('StopEx stops and closes both voices', js(since(mark).sort()) ===
    js([['close', voice3], ['close', voice4], ['stop', voice3], ['stop', voice4]].sort()), js(since(mark)));
  check('IsPlaying is S_FALSE after StopEx', vcall(perf, P.IsPlaying, seg, 0).hr === 1);

  // ---- teardown ---------------------------------------------------------
  vcall(perf, P.PlaySegmentEx, seg, 0, 0, 0x80, 0, 0, 0, 0, path);
  const voice5 = nextVoice;
  mark = calls.length;
  check('CloseDown stops a playing WAVE voice', vcall(perf, P.CloseDown).hr === 0 &&
    js(since(mark)) === js([['stop', voice5], ['close', voice5]]), js(since(mark)));
  vcall(seg, S.Unload, perf);
  vcall(loader, L.ReleaseObjectByUnknown, seg);
  check('the segment releases to zero', vcall(seg, S.Release).hr === 0);
  check('the audiopath releases to zero', vcall(path, A.Release).hr === 0);
  vcall(loader, L.Release);
  vcall(perf, P.Release);
  check('every DirectMusic object was freed', e.test_dm_live() === live0, `${e.test_dm_live()} vs ${live0}`);

  // ---- fail-fast edges --------------------------------------------------
  e.test_dm_cocreate(clsidPerf, iidPerf8, out, esp);
  const perf2 = u32(out);
  vcall(perf2, P.InitAudio, 0, 0, 0, 8, 64, 0x3f, 0);
  vcall(perf2, P.CreateStandardAudioPath, 8, 64, 1, out);
  const path2 = u32(out);
  assert.throws(() => vcall(path2, A.GetObjectInPath, 0xfffffffb, 0x6000, 0, guidAllObjects, 0, iidDS3DB, out),
    WebAssembly.RuntimeError);
  check('GetObjectInPath for IDirectSound3DBuffer traps (not implemented)', true);
  assert.throws(() => vcall(path2, A.GetObjectInPath, 0xfffffffb, 0x3000, 0, guidAllObjects, 0, iidDSB8, out),
    WebAssembly.RuntimeError);
  check('GetObjectInPath of another stage traps', true);
  e.test_dm_cocreate(clsidLoader, iidLoader8, out, esp);
  const loader2 = u32(out);
  const trapLoad = buf => {
    new Uint8Array(memory.buffer, wa(desc), 0x350).fill(0);
    dv.setUint32(wa(desc) + 4, 0x402, true);
    for (let i = 0; i < 16; i++) dv.setUint8(wa(desc) + 0x18 + i, dv.getUint8(wa(clsidSegment) + i));
    dv.setUint32(wa(desc) + 0x340, buf.length, true);
    dv.setUint32(wa(desc) + 0x348, bytes(buf), true);
    vcall(loader2, L.GetObject, desc, iidSegment8, out);
  };
  assert.throws(() => trapLoad(adpcm), WebAssembly.RuntimeError);
  check('a compressed (ADPCM) WAVE segment traps instead of loading silently', true);
  assert.throws(() => trapLoad(bits24), WebAssembly.RuntimeError);
  check('a 24-bit WAVE segment traps', true);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
