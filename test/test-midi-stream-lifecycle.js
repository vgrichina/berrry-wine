#!/usr/bin/env node
'use strict';
// Extract and execute production handlers/imports, API hash lookup, generated
// dispatch page, and callback save/restore. This is NOT a full VM/x86 test.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const Module = require('module');
const cp = require('child_process');
const root = path.resolve(process.env.MIDI_TEST_ROOT || path.join(__dirname, '..'));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const files = ['src/09a3-handlers-audio.wat', 'src/01-header.wat', 'src/13-exports.wat',
  'src/03-registers.wat', 'src/10-helpers.wat', 'src/api_table.json',
  'src/01b-api-hashes.generated.wat', 'src/09b2-dispatch-table.generated.wat',
  'lib/host-audio.js', 'host.js', 'src/09a-handlers.wat', 'src/04-cache.wat'];
const sources = Object.fromEntries(files.map(p => [p, read(p)]));
const table = JSON.parse(sources['src/api_table.json']);
const stop = table.find(r => r.name === 'midiStreamStop');
assert(stop, 'public midiStreamStop must be registered');
assert.equal(stop.nargs, 1);
assert.equal(stop.convention, 'stdcall');
assert.equal(stop.id, table.indexOf(stop));
const mutations = {
  'orphan-first': ['_midiOut.devices.set(handle, dev);', '_midiOut.devices.clear(); _midiOut.devices.set(handle, dev);'],
  'stale-queue': ['s.queue = [];', 's.queue = pending;'],
  'missing-done': ['_midiNotify(dev, 0x3c9, submission.ga);', '/* dropped notification */'],
  'wrong-handle': ['_midiCallbacks.push({ registration: r, handle: dev.handle, message, header',
    '_midiCallbacks.push({ registration: r, handle: dev.handle + 1, message, header'],
  'wrong-instance': ['r.callback, r.instance, item.message', 'r.callback, 0, item.message'],
  'wrong-message': ['_midiNotify(dev, 0x3c9, submission.ga);', '_midiNotify(dev, 0x3bd, submission.ga);'],
  'shared-synth': ['let tiny = dev.tinySynth;', 'let tiny = _ensureTinySynth(ac);'],
  'reset-no-sustain': ['dev.tinySynth.send([0xB0 | ch, 64, 0], 0);', '/* missing sustain reset */'],
  'foreign-header': ['if (owner && owner !== dev) return 11;', '/* missing ownership check */'],
  'stop-no-notes': ['_midiStopNotes(dev);\n        _midiDrain(dev);', '_midiDrain(dev);'],
  'paused-clock': ['s.due = (s.due + now - s.pausedAt) >>> 0;', 's.due = s.due;'],
  'pending-ownership': ['if (_midiPending.has(wa)) return 65;', '/* no pending owner */'],
  'window-backpressure': ['if (!r.owner.post_message_q(r.callback, item.message, item.handle, item.header)) break;',
    'r.owner.post_message_q(r.callback, item.message, item.handle, item.header);'],
  'browser-owner': ["if(!owner.tid && this.instance?.exports!==ex) return {status:'retired'};",
    '/* no VM identity check */', 'host.js'],
  'fraction-lost': ['+ s.remainder;', '+ 0n;'],
  'fraction-tempo': ['if (ev.type === 1) s.tempo = ev.value;',
    'if (ev.type === 1) { s.tempo = ev.value; s.remainder = 0n; }'],
  'fraction-pause': ['s.running = false; s.pausedAt = now;',
    's.running = false; s.pausedAt = now; s.remainder = 0n;'],
  'fraction-drain': ['s.remainder = 0n;', '/* retained discarded fraction */'],
  'division-running-empty': ['(s.running || s.pausedAt !== null)', 's.queue.length'],
  'division-stopped-queued': ['(s.running || s.pausedAt !== null)',
    '(s.running || s.pausedAt !== null || s.queue.length)'],
  'division-paused': ['(s.running || s.pausedAt !== null)', 's.running'],
};
const mutation = process.env.MIDI_MUTATION;
let hostSource = sources['lib/host-audio.js'];
if (process.env.MIDI_BASELINE_HOST) hostSource = cp.execFileSync('git',
  ['show', process.env.MIDI_BASELINE_HOST + ':lib/host-audio.js'], { cwd: root, encoding: 'utf8' });
if (mutation) {
  const [from, to, target] = mutations[mutation];
  const text = target ? sources[target] : hostSource;
  assert.equal(text.split(from).length, 2, 'unique mutation site');
  if (target) sources[target] = text.replace(from, to);
  else hostSource = text.replace(from, to);
}
const hostModule = new Module(path.join(root, 'lib/host-audio.js'), module);
hostModule.filename = path.join(root, 'lib/host-audio.js');
hostModule.paths = Module._nodeModulePaths(path.join(root, 'lib'));
hostModule._compile(hostSource, hostModule.filename);
const { createAudioHost } = hostModule.exports;
if (process.env.MIDI_BASELINE_HOST) {
  // A real pre-change import path; no new imports, invented handles or stub
  // exports. This control reaches the baseline shared-synth ownership defect.
  const synths = [];
  class Synth {
    constructor() { this.notes = new Set(); synths.push(this); }
    send([status, note, velocity]) {
      const key = (status & 15) + ':' + note;
      if ((status & 240) === 144 && velocity) this.notes.add(key);
      if ((status & 240) === 128) this.notes.delete(key);
    }
    allSoundOff(ch) { for (const k of this.notes) if (k.startsWith(ch + ':')) this.notes.delete(k); }
  }
  const memory = new ArrayBuffer(65536), ctx = { getMemory: () => memory, WebAudioTinySynth: Synth };
  const host = createAudioHost(ctx, { getHost: () => ({}), profileNow: () => 0, profileEvent: () => {} }).imports;
  const ac = { currentTime: 0, state: 'running' };
  ctx._voices._ensureCtx = () => ac;
  const a = host.midi_out_open(0, 0, 0, 0), b = host.midi_out_open(0, 0, 0, 0);
  host.midi_out_short_msg(a, 0x643c90); host.midi_out_short_msg(b, 0x644091);
  assert(synths.some(s => s.notes.has('1:64')), 'positive sibling note control');
  host.midi_out_reset(a);
  assert(synths.some(s => s.notes.has('1:64')), 'reset must preserve sibling note (baseline negative)');
  process.exit(0);
}
const { compileClosure } = require(path.join(root, 'tools/watx-closure'));
function form(source, marker) {
  source = source.replace(/;;[^\n]*/g, '');
  const start = source.indexOf(marker);
  assert(start >= 0, marker);
  let depth = 0;
  for (let end = start; end < source.length; end++) {
    if (source[end] === '(') depth++;
    if (source[end] === ')' && --depth === 0) return source.slice(start, end + 1);
  }
  throw Error('unbalanced ' + marker);
}
const fn = (file, name) => {
  const match = new RegExp(`\\(func \\$${name}(?=[\\s)])`).exec(sources[file]);
  assert(match, `${file}: exact function ${name}`);
  return form(sources[file].slice(match.index), '(func');
};
const audioFile = 'src/09a3-handlers-audio.wat';
const names = ['midiStreamOpen', 'midiStreamOut', 'midiStreamPause',
  'midiStreamRestart', 'midiStreamStop', 'midiStreamClose', 'midiStreamProperty',
  'midiOutPrepareHeader', 'midiOutUnprepareHeader', 'midiOutReset',
  'midiOutOpen', 'midiOutClose', 'midiOutShortMsg', 'midiOutLongMsg'];
const bodies = names.map(n => fn(audioFile, 'handle_' + n));
bodies.push(fn(audioFile, 'midi_stream_service'));
for (const n of ['fire_midi_out_callback_bound', 'fire_wave_out_callback_bound',
  'fire_audio_callback_bound', 'wave_callback_restore_wait']) bodies.push(fn('src/13-exports.wat', n));
for (const n of ['save_caller_regs', 'restore_caller_regs', 'get_cf', 'set_flags_inc', 'set_flags_dec'])
  bodies.push(fn('src/03-registers.wat', n));
for (const n of ['hash_api_name', 'lookup_api_id']) bodies.push(fn('src/10-helpers.wat', n));
// Keep the actual callback admission/return and invocation identity closure.
// Only its private storage is relocated into this two-page fixture.
for (const n of ['mm_callback_begin', 'mm_callback_frame_at', 'mm_callback_frame',
  'mm_callback_check', 'mm_callback_finish']) bodies.push(fn('src/09a-handlers.wat', n));
for (const n of ['invocation_new_id', 'invocation_install', 'invocation_process_begin',
  'invocation_validate', 'invocation_current', 'invocation_enter', 'invocation_leave'])
  bodies.push(fn('src/04-cache.wat', n).replace(
    /\(region.addr \$CALLBACK_OWNERSHIP (\d+)\)/g,
    (_, offset) => `(i32.const ${16384 + Number(offset)})`));
const page = Math.floor(stop.id / 256);
const dispatch = fn('src/09b2-dispatch-table.generated.wat', 'dispatch_api_table_page_' + page);
bodies.push(dispatch);
// Unrelated dispatch branches are trap sentinels. The stop branch is the exact
// generated call to the real production handler, never a successful stub.
for (const n of new Set([...dispatch.matchAll(/\(call \$(handle_\S+)/g)].map(m => m[1]))) {
  if (n === 'handle_midiStreamStop') continue;
  const arity = n === 'handle_fallback' ? 2 : n === 'handle_gpu_api' ? 8 : 6;
  bodies.push(`(func $${n} (param ${Array(arity).fill('i32').join(' ')}) (unreachable))`);
}
const globals = new Set([...bodies.join('\n').matchAll(/\(global\.(?:get|set) \$(\w+)/g)].map(m => m[1]));
globals.delete('API_HASH_COUNT'); // supplied by the actual generated hash source
const initial = { reg_base: 64, API_HASH_TABLE: 65536, API_HASH_COUNT: table.length,
  mm_timer_ret_thunk: 0xcaca000a, current_thread_id: 1, MM_CALLBACK_CONTEXTS: 32768 };
const typedGlobals = new Map(['invocation_epoch', 'invocation_root', 'mm_callback_owner']
  .map(g => [g, form(sources[g === 'mm_callback_owner' ? 'src/09a-handlers.wat' : 'src/04-cache.wat'], `(global $${g} `)]));
const imports = [...sources['src/01-header.wat'].matchAll(/\(import "host" "(midi_\w+|get_ticks|beep_process_begin|beep_thread_begin)"/g)]
  .map(m => form(sources['src/01-header.wat'], m[0]));
const wasmSource = `
 (import "host" "memory" (memory 2 2 shared))
 ${imports.join('\n')}
 ${[...globals].map(g => `${typedGlobals.get(g) || `(global $${g} (mut i32) (i32.const ${initial[g] || 0}))`}
   (export "${g}" (global $${g}))`).join('\n')}
 (func $g2w (param $p i32) (result i32) (local.get $p))
 (func $gl32 (param $p i32) (result i32) (i32.load (local.get $p)))
 (func $gs32 (param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v)))
 ${sources['src/01b-api-hashes.generated.wat'].replace('(region.addr $API_HASH_TABLE 0)', '(i32.const 65536)')}
 ${bodies.join('\n')}
 ${names.map(n => `(export "${n}" (func $handle_${n}))`).join('\n')}
 (export "service" (func $midi_stream_service))
 (export "lookup" (func $lookup_api_id))
 (export "dispatch" (func $dispatch_api_table_page_${page}))
 (export "restore" (func $restore_caller_regs))
 (export "getCF" (func $get_cf))
 (export "incFlags" (func $set_flags_inc))
 (export "decFlags" (func $set_flags_dec))
 (export "restoreWait" (func $wave_callback_restore_wait))
 (export "beginProcess" (func $invocation_process_begin))
 (export "currentInvocation" (func $invocation_current))
 (export "finishCallback" (func $mm_callback_finish))
`;
const compiled = compileClosure({ source: wasmSource, vfs: new Map() }, { tailCalls: false });
assert(compiled.success, compiled.error);
const moduleUnderTest = new WebAssembly.Module(compiled.wasmBinary);
let cases = 0, callbacksExecuted = 0;
function setup() {
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 2, shared: true });
  const dv = new DataView(memory.buffer);
  const synths = [], notifications = [], events = [], windows = [];
  let now = 100;
  class Synth {
    constructor() { this.sent = []; this.notes = new Map(); this.sustain = new Set(); synths.push(this); }
    send(msg) {
      this.sent.push([...msg]);
      const [status, note, vel] = msg, ch = status & 15, key = ch + ':' + note, op = status & 240;
      if (op === 144 && vel) this.notes.set(key, (this.notes.get(key) || 0) + 1);
      if (op === 128 || (op === 144 && !vel)) {
        if (!this.sustain.has(ch)) {
          const n = this.notes.get(key) || 0;
          if (n <= 1) this.notes.delete(key); else this.notes.set(key, n - 1);
        }
      }
      if (op === 176 && note === 64) vel ? this.sustain.add(ch) : this.sustain.delete(ch);
    }
    allSoundOff(ch) { for (const key of this.notes.keys()) if (key.startsWith(ch + ':')) this.notes.delete(key); }
    reset() { this.notes.clear(); this.sustain.clear(); }
  }
  const ctx = { getMemory: () => memory.buffer, WebAudioTinySynth: Synth,
    guestNowMs: () => now, audioClockMs: () => now };
  const audio = createAudioHost(ctx, { getHost: () => ({ set_event: h => { events.push(h); return 1; } }),
    profileNow: () => 0, profileEvent: () => {} });
  const ac = { get currentTime() { return now / 1000; }, state: 'running' };
  ctx._voices._ensureCtx = () => ac;
  const e = new WebAssembly.Instance(moduleUnderTest, { host: { ...audio.imports,
    memory, get_ticks: () => now } }).exports;
  ctx.exports = { ...e, post_message_q: (...args) => windows.push(args) };
  e.beginProcess();
  assert.notEqual(e.currentInvocation(), 0n, 'production initializer establishes root');
  e.eip.value = 0x11111;
  dv.setUint32(80, 8192, true);
  function call(name, ...args) {
    dv.setUint32(80, 8192, true);
    e[name](...Array.from({ length: 6 }, (_, i) => args[i] || 0));
    const argc = table.find(r => r.name === name).nargs;
    assert.equal(dv.getUint32(80, true), 8192 + 4 * (argc + 1), name + ' stdcall');
    return dv.getUint32(64, true);
  }
  function open(type = 3, cb = 0x12345, instance = 0x98765) {
    dv.setUint32(8216, type << 16, true);
    dv.setUint32(512, 0, true);
    assert.equal(call('midiStreamOpen', 516, 512, 1, cb, instance), 0);
    return dv.getUint32(516, true);
  }
  function header(h, hdr = 1024, delta = 480, values = [0x643c90]) {
    const data = hdr + 80;
    dv.setUint32(hdr, data, true);
    dv.setUint32(hdr + 4, values.length * 12, true);
    dv.setUint32(hdr + 8, values.length * 12, true);
    dv.setUint32(hdr + 16, 0, true);
    values.forEach((value, i) => {
      dv.setUint32(data + i * 12, delta, true);
      dv.setUint32(data + i * 12 + 8, value, true);
    });
    assert.equal(call('midiOutPrepareHeader', h, hdr, 64), 0);
    return hdr;
  }
  function queue(h, hdr = 1024, delta = 480, values) {
    header(h, hdr, delta, values);
    assert.equal(call('midiStreamOut', h, hdr, 64), 0);
  }
  function pump(onCallback) {
    let guard = 100;
    while (ctx._midiOut.callbacks.length) {
      assert(guard--, 'callback queue progress');
      const before = dv.getUint32(80, true);
      const pc = e.eip.value, eax = dv.getUint32(64, true);
      // Alternate carry and INC/DEC across actual queued MIDI notifications.
      // Explicit flags (op 9) seed CF; INC/DEC must preserve it lazily.
      const carry = 1 - (notifications.length & 1);
      e.flag_op.value = 9; e.flag_a.value = carry;
      (notifications.length & 2 ? e.decFlags : e.incFlags)(5, 6);
      assert.equal(e.getCF(), carry, 'interrupted lazy carry setup');
      const saved = [pc, eax, dv.getUint32(68, true), dv.getUint32(72, true),
        e.flag_op.value, e.flag_res.value, e.flag_a.value, e.flag_b.value,
        e.flag_sign_shift.value, carry].map(v => v >>> 0);
      audio.pumpWaveOutCompletions();
      assert.equal(e.mm_timer_in_cb.value, 1);
      assert.equal(e.invocation_depth.value, 1, 'real callback admission entered a child');
      assert.equal(e.mm_callback_depth.value, 1);
      assert.notEqual(e.currentInvocation(), e.invocation_root.value);
      callbacksExecuted++;
      const sp = dv.getUint32(80, true);
      const frame = Array.from({ length: 10 }, (_, i) => dv.getUint32(sp + 24 + i * 4, true));
      const args = Array.from({ length: 6 }, (_, i) => dv.getUint32(sp + i * 4, true));
      assert.equal(args[0], 0xcaca000a);
      notifications.push({ cb: e.eip.value >>> 0, args: args.slice(1) });
      const q = ctx._midiOut.callbacks.length;
      audio.pumpWaveOutCompletions();
      assert.equal(ctx._midiOut.callbacks.length, q, 'nested async callback waits');
      if (onCallback) onCallback(notifications.at(-1));
      // Model guest flag clobber using the actual flag helpers, not a fake restore.
      e.flag_op.value = 9; e.flag_a.value = 1 - carry;
      e.incFlags(7, 8);
      assert.equal(e.getCF(), 1 - carry, 'callback changed lazy carry');
      // Simulate the guest's ret 20; use the production restore helpers.
      dv.setUint32(80, sp + 24, true);
      e.finishCallback();
      assert.equal(e.invocation_depth.value, 0, 'production callback return releases child');
      assert.equal(e.mm_callback_depth.value, 0);
      assert.equal(e.currentInvocation(), e.invocation_root.value);
      // Check behavior before layout so the pre-fix control fails on lost CF.
      assert.equal(e.getCF(), carry, 'MIDI callback must restore interrupted lazy carry');
      assert.equal(sp, before - 64, 'invocation-owned 40-byte saved frame + ret/5 args');
      assert.deepEqual(frame, saved, 'executed save frame retains old offsets and appends CF at +36');
      assert.equal(dv.getUint32(80, true), before);
      assert.equal(e.eip.value, pc);
      assert.equal(dv.getUint32(64, true), eax);
    }
  }
  return { ctx, audio, e, dv, synths, notifications, windows, events, call, open,
    queue, header, pump, setNow: v => { now = v; },
    flags: hdr => dv.getUint32(hdr + 16, true),
    done: () => notifications.filter(n => n.args[1] === 0x3c9) };
}
function test(name, fn) { fn(); cases++; console.log('PASS ' + name); }
function property(s, h, value, flags = 0x80000001) {
  s.dv.setUint32(700, 8, true); s.dv.setUint32(704, value, true);
  return s.call('midiStreamProperty', h, 700, flags);
}
function notes(s, index = 0) { return s.synths[index]?.notes.get('0:60') || 0; }
test('production callback ownership rejects invalid admission and return before mutation', () => {
  const s = setup();
  const root = s.e.invocation_root.value;
  for (const [global, invalid] of [['invocation_root', 0n], ['invocation_tid', 2]]) {
    const prior = s.e[global].value;
    s.e[global].value = invalid;
    const before = Buffer.from(s.dv.buffer);
    assert.throws(() => s.e.fire_midi_out_callback_bound(77, 1024, 0x12345, 9, 0x3c9),
      WebAssembly.RuntimeError, 'invalid owner must trap');
    assert.deepEqual(Buffer.from(s.dv.buffer), before, 'rejection precedes memory writes');
    assert.equal(s.e.invocation_depth.value, 0);
    assert.equal(s.e.mm_callback_depth.value, 0);
    assert.equal(s.e.mm_timer_in_cb.value, 0);
    s.e[global].value = prior;
  }
  assert.equal(s.e.fire_midi_out_callback_bound(77, 1024, 0x12345, 9, 0x3c9), 1);
  assert.notEqual(s.e.currentInvocation(), root);
  const sp = s.dv.getUint32(80, true);
  assert.throws(() => s.e.finishCallback(), WebAssembly.RuntimeError,
    'return must match retained ESP before releasing child');
  assert.equal(s.e.invocation_depth.value, 1);
  assert.equal(s.e.mm_callback_depth.value, 1);
  s.dv.setUint32(80, sp + 24, true);
  s.e.finishCallback();
  assert.equal(s.e.currentInvocation(), root);
  assert.equal(s.e.invocation_depth.value, 0);
  assert.equal(s.e.mm_callback_depth.value, 0);
  assert.equal(s.e.mm_timer_in_cb.value, 0);
  callbacksExecuted++;
});
test('fractional deltas accumulate to 50ms across 96 events', () => {
  const s = setup(), h = s.open(0);
  assert.equal(property(s, h, 960), 0);
  s.queue(h, 1024, 1, Array(96).fill(0x643c90));
  s.call('midiStreamRestart', h); s.e.service(100);
  assert.equal(notes(s), 1, 'only the first sub-ms deadline rounds to zero');
  s.e.service(149); assert.equal(notes(s), 95); assert.equal(s.flags(1024), 18);
  s.e.service(150); assert.equal(notes(s), 96); assert.equal(s.flags(1024), 3);
});
test('fraction survives headers, tempo events and sibling service', () => {
  const s = setup(), a = s.open(0), b = s.open(0);
  assert.equal(property(s, a, 960), 0); assert.equal(property(s, b, 960), 0);
  // 500000/960000 + 460000/960000 = exactly one millisecond.
  s.queue(a, 1024, 1, [0x01000000 | 460000]);
  s.queue(a, 1536, 1);
  s.queue(b, 2048, 1, [0x643c90, 0x643c90]);
  s.call('midiStreamRestart', a); s.call('midiStreamRestart', b);
  s.e.service(100);
  assert.equal(s.flags(1536), 18); assert.equal(notes(s), 1, 'sibling first note');
  s.e.service(101);
  assert.equal(s.flags(1536), 3); assert.equal(notes(s), 2);
  assert.equal(notes(s, 1), 1, 'tempo stream note');
});
test('fraction survives repeated pause/restart with a pending deadline and clock wrap', () => {
  const s = setup(), h = s.open(0);
  assert.equal(property(s, h, 1000), 0); // half-ms ticks
  s.setNow(0xfffffffe);
  s.queue(h, 1024, 1, Array(4).fill(0x643c90));
  s.call('midiStreamRestart', h); s.e.service(0xfffffffe);
  assert.equal(notes(s), 1); // second event is pending at ffffffff
  s.call('midiStreamPause', h); s.call('midiStreamPause', h);
  s.setNow(8); s.call('midiStreamRestart', h); s.call('midiStreamRestart', h);
  s.e.service(8); assert.equal(notes(s), 1);
  s.e.service(9); assert.equal(notes(s), 3);
  // Third event left a half-ms carry; fourth is already pending.
  s.e.service(10); assert.equal(notes(s), 4); assert.equal(s.flags(1024), 3);
  // Pause after an exhausted header, before another delta consumes its carry.
  s.queue(h, 2048, 1); s.e.service(10); assert.equal(notes(s), 5);
  s.setNow(10); s.call('midiStreamPause', h);
  s.setNow(20); s.call('midiStreamRestart', h);
  s.queue(h, 2560, 1); s.e.service(20); assert.equal(notes(s), 5);
  s.e.service(21); assert.equal(notes(s), 6);
});
for (const action of ['midiStreamStop', 'midiOutReset']) {
  test(`${action} discards fractional timeline before requeue/restart`, () => {
    const s = setup(), h = s.open(0);
    assert.equal(property(s, h, 1000), 0);
    s.queue(h, 1024, 1); s.call('midiStreamRestart', h); s.e.service(100);
    assert.equal(notes(s), 1);
    assert.equal(s.call(action, h), 0);
    s.setNow(200); s.queue(h, 1536, 1);
    s.call('midiStreamRestart', h); s.e.service(200);
    assert.equal(notes(s), 1, 'fresh half-ms rounds from new origin');
    assert.equal(s.flags(1536), 3);
  });
}
test('time division follows stopped state including running-empty and stopped-queued', () => {
  const s = setup(), h = s.open(0);
  s.call('midiStreamRestart', h);
  assert.equal(property(s, h, 960), 11, 'running empty is not stopped');
  assert.equal(property(s, h, 0, 0x40000001), 0);
  assert.equal(s.dv.getUint32(704, true), 480, 'failed SET leaves division intact');
  s.call('midiStreamPause', h);
  assert.equal(property(s, h, 960), 11, 'paused is not stopped');
  s.call('midiStreamStop', h);
  s.queue(h, 1024, 960);
  assert.equal(property(s, h, 960), 0, 'queued on a stopped device is permitted');
  s.call('midiStreamRestart', h); s.e.service(599); assert.equal(notes(s), 0);
  s.e.service(600); assert.equal(notes(s), 1);
  assert.equal(property(s, h, 240), 11, 'exhausted running stream is still running');
  s.call('midiOutReset', h); s.queue(h, 1536, 240);
  assert.equal(property(s, h, 240), 0, 'reset establishes stopped state');
});
test('public hash lookup and generated dispatch execute real Stop with stdcall', () => {
  const s = setup(), h = s.open(); s.queue(h);
  new Uint8Array(s.dv.buffer, 400, 15).set(Buffer.from('midiStreamStop\0'));
  assert.equal(s.e.lookup(400), stop.id);
  s.dv.setUint32(80, 8192, true);
  s.e.dispatch(stop.id % 256, h, 0, 0, 0, 0, 400);
  assert.equal(s.dv.getUint32(64, true), 0);
  assert.equal(s.dv.getUint32(80, true), 8200);
  assert.equal(s.flags(1024), 3);
  s.pump(); assert.equal(s.done().length, 1);
});
for (const state of ['queued', 'playing', 'paused']) {
  for (const action of ['midiStreamStop', 'midiOutReset', 'midiStreamClose']) {
    test(`${state} ${action} returns every header once without stale replay`, () => {
      const s = setup(), h = s.open();
      s.queue(h); s.queue(h, 1536);
      if (state !== 'queued') { s.call('midiStreamRestart', h); s.e.service(100); }
      if (state === 'paused') { s.setNow(200); s.call('midiStreamPause', h); }
      assert.equal(s.call(action, h), 0);
      assert.equal(s.flags(1024), 3); assert.equal(s.flags(1536), 3);
      s.pump();
      assert.deepEqual(s.done().map(n => n.args), [[h, 0x3c9, 0x98765, 1024, 0], [h, 0x3c9, 0x98765, 1536, 0]]);
      assert(s.done().every(n => n.cb === 0x12345));
      s.setNow(2000);
      assert.equal(s.call('midiStreamRestart', h), action === 'midiStreamClose' ? 5 : 0);
      s.e.service(2000); s.e.service(4000); s.pump();
      assert.equal(s.synths.length, 0, 'discarded events never sound');
      assert.equal(s.done().length, 2);
      assert.equal(s.call('midiStreamStop', h), action === 'midiStreamClose' ? 5 : 0);
    });
  }
}
test('two streams retain queue, callback, timing and overlapping note namespaces', () => {
  const s = setup(), a = s.open(), b = s.open(3, 0x22222, 0x33333);
  s.queue(a, 1024, 0, [0x643c90, 0x643c90]);
  s.queue(b, 1536, 0);
  s.call('midiStreamRestart', a); s.call('midiStreamRestart', b); s.e.service(100); s.pump();
  assert.equal(s.synths.length, 2);
  assert.equal(s.synths[0].notes.get('0:60'), 2);
  assert.equal(s.synths[1].notes.get('0:60'), 1);
  assert.equal(s.call('midiStreamStop', a), 0);
  assert.equal(s.synths[0].notes.size, 0);
  assert.equal(s.synths[1].notes.get('0:60'), 1, 'sibling same channel/pitch survives');
  assert.equal(s.done().find(n => n.args[0] === b).cb, 0x22222);
  assert.equal(s.done().find(n => n.args[0] === b).args[2], 0x33333);
  s.call('midiOutReset', a);
  assert.equal(s.synths[1].notes.get('0:60'), 1, 'reset isolation');
});
test('pause/restart are idempotent and preserve remaining delta', () => {
  const s = setup(), h = s.open(); s.queue(h);
  s.call('midiStreamRestart', h); s.e.service(100); // due 600
  s.setNow(200); s.call('midiStreamPause', h);
  s.setNow(300); s.call('midiStreamPause', h); // must not move pause origin
  s.setNow(1000); s.call('midiStreamRestart', h); // due 1400
  s.setNow(1200); s.call('midiStreamRestart', h); // must not move due
  s.e.service(1399); assert.equal(s.synths.length, 0);
  s.e.service(1400); assert.equal(s.synths.length, 1); s.pump();
  assert.equal(s.done().length, 1);
});
test('reset has stronger sustain contract than stop', () => {
  const s = setup(), h = s.open();
  s.call('midiOutShortMsg', h, 0x7f40b0); // sustain on
  s.call('midiOutShortMsg', h, 0x643c90);
  s.call('midiStreamStop', h);
  assert(s.synths[0].sustain.has(0));
  assert(s.synths[0].notes.has('0:60'));
  s.call('midiOutReset', h);
  assert.equal(s.synths[0].sustain.size, 0);
  assert.equal(s.synths[0].notes.size, 0);
});
test('null/closed/ordinary/foreign handles and header ownership', () => {
  const s = setup(), h = s.open(), sibling = s.open();
  for (const invalid of [0, 123, 0xffffffff]) {
    for (const name of ['midiStreamStop', 'midiStreamPause', 'midiStreamRestart', 'midiStreamClose', 'midiOutReset'])
      assert.equal(s.call(name, invalid), 5);
  }
  s.header(h);
  assert.equal(s.call('midiOutPrepareHeader', sibling, 1024, 64), 11);
  assert.equal(s.call('midiStreamOut', sibling, 1024, 64), 11);
  assert.equal(s.call('midiStreamOut', h, 1024, 64), 0);
  assert.equal(s.call('midiStreamOut', h, 1024, 64), 65);
  assert.equal(s.call('midiOutUnprepareHeader', h, 1024, 64), 65);
  s.dv.setUint32(1040, 2, true); // guest flags cannot revoke host ownership
  assert.equal(s.call('midiStreamOut', h, 1024, 64), 65);
  assert.equal(s.call('midiOutUnprepareHeader', h, 1024, 64), 65);
  s.call('midiStreamStop', h);
  assert.equal(s.call('midiOutUnprepareHeader', h, 1024, 64), 0);
  s.call('midiStreamClose', h);
  assert.equal(s.call('midiStreamStop', h), 5);
  const newer = s.open(); assert.notEqual(newer, h);
  assert.equal(s.call('midiOutPrepareHeader', newer, 1024, 64), 0);
  const ordinary = s.audio.imports.midi_out_open(0, 0, 0, 0);
  assert.equal(s.call('midiStreamStop', ordinary), 5);
  assert.equal(s.call('midiOutReset', ordinary), 0);
});
test('event/window/NULL notifications and unsupported routes fail explicitly', () => {
  for (const type of [0, 1, 5]) {
    const s = setup(), h = s.open(type, 77); s.queue(h);
    s.call('midiStreamStop', h); s.call('midiStreamClose', h);
    assert.equal(s.events.length, type === 5 ? 1 : 0);
    assert.deepEqual(s.windows, type === 1 ? [[77, 0x3c7, h, 0], [77, 0x3c9, h, 1024], [77, 0x3c8, h, 0]] : []);
  }
  const s = setup();
  s.dv.setUint32(8216, 0x50000, true);
  assert.equal(s.call('midiStreamOpen', 516, 512, 1, 0x80000001, 0), 11,
    'event callback must not enter the host ReleaseMutex ABI');
  assert.throws(() => s.open(2), /unsupported/);
  s.ctx.threadManager = { workerBackend: true };
  assert.throws(() => s.open(3), /worker delivery unsupported/);
  assert.equal(s.ctx._midiOut.devices.size, 0);
});
test('reentrant DONE requeues/restarts/closes without consuming new work or old registration', () => {
  const s = setup(), h = s.open(); s.queue(h); s.call('midiStreamStop', h);
  let reentered = false;
  s.pump(n => {
    if (n.args[1] !== 0x3c9 || reentered) return;
    reentered = true;
    assert.equal(s.call('midiStreamOut', h, 1024, 64), 0);
    s.call('midiStreamRestart', h);
  });
  assert.equal(s.flags(1024), 18);
  s.e.service(100); s.e.service(600); s.pump();
  assert.equal(s.done().length, 2);
  s.queue(h, 1536); s.call('midiStreamClose', h);
  const b = s.open(3, 0x44444, 0x55555); s.pump();
  assert.equal(s.done().at(-1).args[0], h);
  assert.equal(s.done().at(-1).cb, 0x12345);
  assert.notEqual(b, h);
});
test('wave ABI and saved wait/flags survive MIDI callback admission/return', () => {
  const s = setup();
  s.e.yield_reason.value = 1; s.e.yield_flag.value = 1;
  s.e.wait_handle.value = 444; s.e.flag_a.value = 0x234;
  const before = s.dv.getUint32(80, true);
  assert.equal(s.e.fire_wave_out_callback_bound(17, 1024, 0x5555, 99), 1);
  const sp = s.dv.getUint32(80, true);
  assert.equal(s.dv.getUint32(sp + 8, true), 0x3bd, 'wave still WOM_DONE');
  assert.equal(s.e.fire_midi_out_callback_bound(18, 1536, 0x6666, 88, 0x3c9), 0);
  s.e.flag_a.value = 0;
  s.dv.setUint32(80, sp + 24, true); s.e.finishCallback();
  assert.equal(s.dv.getUint32(80, true), before);
  assert.equal(s.e.wait_handle.value, 444); assert.equal(s.e.yield_reason.value, 1);
  assert.equal(s.e.flag_a.value, 0x234);
});
test('close/reopen recycles an idle synth without inherited notes/controllers', () => {
  const s = setup(), a = s.open(), b = s.open();
  s.call('midiOutShortMsg', a, 0x7f40b0); s.call('midiOutShortMsg', a, 0x643c90);
  s.call('midiOutShortMsg', b, 0x643c90);
  s.call('midiStreamClose', a);
  const c = s.open(); s.call('midiOutShortMsg', c, 0x644090);
  assert.equal(s.synths.length, 2, 'closed synth reused, live sibling never reused');
  assert.equal(s.synths[0].sustain.size, 0);
  assert.deepEqual([...s.synths[0].notes.keys()], ['0:64']);
  assert.deepEqual([...s.synths[1].notes.keys()], ['0:60']);
});
test('per-stream properties, malformed buffers and unsupported events never silently succeed', () => {
  const s = setup(), a = s.open(), b = s.open();
  s.dv.setUint32(700, 8, true); s.dv.setUint32(704, 240, true);
  assert.equal(s.call('midiStreamProperty', a, 700, 0x80000001), 0);
  s.dv.setUint32(704, 0, true);
  assert.equal(s.call('midiStreamProperty', b, 700, 0x40000001), 0);
  assert.equal(s.dv.getUint32(704, true), 480);
  assert.equal(s.call('midiStreamProperty', a, 700, 0x40000001), 0);
  assert.equal(s.dv.getUint32(704, true), 240);
  s.dv.setUint32(704, 0, true);
  assert.equal(s.call('midiStreamProperty', a, 700, 0x80000001), 11);
  s.header(a);
  assert.equal(s.call('midiStreamOut', a, 0, 64), 11);
  assert.equal(s.call('midiStreamOut', a, 1024, 1), 11);
  s.dv.setUint32(1032, 13, true);
  assert.equal(s.call('midiStreamOut', a, 1024, 64), 11);
  s.dv.setUint32(1032, 12, true);
  s.dv.setUint32(1112, 0x80000003, true);
  assert.throws(() => s.call('midiStreamOut', a, 1024, 64), /event unsupported/);
  assert.throws(() => s.call('midiOutLongMsg', a, 1024, 64), /SysEx transport unsupported/);
  assert.equal(s.flags(1024), 2, 'rejected data never becomes queued or done');
});
test('oscillator fallback keeps sustain/reset and sibling ownership', () => {
  const s = setup(); s.ctx.midiBackend = 'oscillator';
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {},
    cancelScheduledValues() {} });
  const ac = { currentTime: 0, state: 'running', destination: {},
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createOscillator: () => ({ frequency: param(), connect() {}, start() {}, stop() {} }) };
  s.ctx._voices._ensureCtx = () => ac;
  const a = s.open(), b = s.open();
  s.call('midiOutShortMsg', a, 0x7f40b0);
  s.call('midiOutShortMsg', a, 0x643c90); s.call('midiOutShortMsg', b, 0x643c90);
  const da = s.ctx._midiOut.devices.get(a), db = s.ctx._midiOut.devices.get(b);
  assert.equal(da.active.size, 1); assert.equal(db.active.size, 1);
  s.call('midiStreamStop', a);
  assert.equal(da.active.size, 1, 'stop preserves sustain');
  s.call('midiOutReset', a);
  assert.equal(da.active.size, 0); assert.equal(db.active.size, 1);
});
test('window callback backpressure preserves ordered open/done/close notifications', () => {
  const s = setup();
  const posted = [];
  let full = true;
  s.ctx.exports.post_message_q = (...args) => {
    if (full) return 0;
    posted.push(args); return 1;
  };
  const h = s.open(1, 77); s.queue(h); s.call('midiStreamStop', h); s.call('midiStreamClose', h);
  assert.equal(posted.length, 0);
  assert.equal(s.ctx._midiOut.windowCallbacks.length, 3);
  full = false; s.audio.pumpWaveOutCompletions(); s.audio.pumpWaveOutCompletions();
  assert.deepEqual(posted, [[77, 0x3c7, h, 0], [77, 0x3c9, h, 1024], [77, 0x3c8, h, 0]]);
  assert.equal(s.ctx._midiOut.windowCallbacks.length, 0);
});
// Execute the actual browser owner admission method without browser/runtime
// startup. The real WAT callback export writes the frame; JS bookkeeping is
// checked before and after owner/suspension/busy transitions.
(async () => {
  const source = sources['host.js'];
  const begin = source.indexOf('  async _offerWaveCallback(item) {');
  const end = source.indexOf('  _pumpMultimediaTimer()', begin);
  assert(begin >= 0 && end > begin);
  const OwnerGate = new Function(`return class {${source.slice(begin, end)}}`)();
  const s = setup(), gate = new OwnerGate();
  const ex = s.ctx.exports;
  ex.get_eip = () => s.e.eip.value;
  ex.get_yield_reason = () => s.e.yield_reason.value;
  ex.is_mm_timer_callback_active = () => s.e.mm_timer_in_cb.value;
  gate.running = true;
  gate.instance = { exports: ex };
  let suspended = true;
  gate.threadManager = { isMainThreadSuspended: () => suspended,
    _mainWaitStartedAt: 123, _mainWaitPolls: 7 };
  s.ctx.waveCallbackOwner = { kind: 'cooperative', exports: ex, tid: 0 };
  const offerStart = source.indexOf('offerMidiCallback:item=>');
  const offerEnd = source.indexOf('\n      wakeWaveCallback:', offerStart);
  const expression = source.slice(offerStart + 'offerMidiCallback:'.length, offerEnd).trim().replace(/,$/, '');
  s.ctx.offerMidiCallback = new Function('self', 'return ' + expression)(gate);
  const h = s.open(); s.queue(h); s.call('midiStreamStop', h);
  await s.audio.pumpWaveOutCallbacks();
  assert.equal(s.ctx._midiOut.callbacks.length, 2, 'suspended owner retains notifications');
  suspended = false;
  await s.audio.pumpWaveOutCallbacks();
  assert.equal(s.ctx._midiOut.callbacks.length, 1, 'one callback admitted, next busy');
  assert.deepEqual(gate._waveMainWaitSaved, { waitStartedAt: 123, waitPolls: 7 });
  assert.equal(gate.threadManager._mainWaitStartedAt, 0);
  assert.equal(gate.threadManager._mainWaitPolls, 0);
  let sp = s.dv.getUint32(80, true);
  assert.equal(s.dv.getUint32(sp + 8, true), 0x3c7);
  s.dv.setUint32(80, sp + 24, true); s.e.finishCallback();
  gate.hostCtx = {}; // Only test the actual boundary's completed-wait restore.
  await gate._pumpWaveCallbacksAtBoundary();
  assert.equal(gate.threadManager._mainWaitStartedAt, 123);
  assert.equal(gate.threadManager._mainWaitPolls, 7);
  // The lifecycle gate must never reroute the remaining old completion to a
  // different VM, even if its handle and callback integers happen to match.
  gate.instance = { exports: {} };
  await s.audio.pumpWaveOutCallbacks();
  assert.equal(s.ctx._midiOut.callbacks.length, 0, 'retired owner completion discarded at owner boundary');
  assert.equal(s.e.mm_timer_in_cb.value, 0);
  cases++;
  console.log('PASS actual browser cooperative owner/wait/busy/retirement gate');
assert(callbacksExecuted > 0, 'must execute real callback admission and return');
console.log(JSON.stringify({ cases, callbacksExecuted, moduleBytes: compiled.wasmBinary.length,
  moduleSHA256: sha(compiled.wasmBinary), sourceSHA256: Object.fromEntries(files.map(f => [f, sha(sources[f])])),
  qualification: 'isolated production WAT/import execution; no fullVM/x86/native/audio-output claim' }, null, 2));
if (process.argv.includes('--mutations')) {
  for (const name of Object.keys(mutations)) {
    const r = cp.spawnSync(process.execPath, [__filename], {
      env: { ...process.env, MIDI_MUTATION: name }, encoding: 'utf8' });
    assert.notEqual(r.status, 0, 'mutation escaped: ' + name);
    assert.match(r.stderr, /AssertionError/, 'mutation must reach behavioral assertion: ' + name + '\n' + r.stderr);
    assert.doesNotMatch(r.stderr, /unique mutation site|Compilation failed/,
      'mutation must execute the fixture: ' + name);
    console.log('KILLED ' + name);
  }
}
})().catch(error => { console.error(error); process.exitCode = 1; });
