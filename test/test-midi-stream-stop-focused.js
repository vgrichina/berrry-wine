#!/usr/bin/env node
'use strict';
// Small executable fixture: compile verbatim production functions/globals.
// Interpreter execution and OS notification endpoints are observed boundaries,
// not a JavaScript reimplementation of stream state or queue behavior.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { compile } = require('../tools/watx');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/09a3-handlers-audio.wat'), 'utf8');
function form(kind, name) {
  const clean = source.replace(/;;[^\n]*/g, '');
  const start = clean.indexOf(`(${kind} $${name} `);
  assert(start >= 0, `missing production ${name}`);
  let depth = 0;
  for (let i = start; i < clean.length; i++) {
    if (clean[i] === '(') depth++;
    if (clean[i] === ')' && --depth === 0) return clean.slice(start, i + 1);
  }
  throw Error('unbalanced production form');
}
const names = ['handle_midiStreamOpen', 'handle_midiStreamOut',
  'handle_midiStreamStop', 'midi_stream_notify_done', 'midi_stream_service',
  'handle_midiStreamPause', 'handle_midiStreamRestart'];
const globals = [...source.matchAll(/\(global \$(midi_stream_\w+) /g)].map(m => m[1]);
const exportsWat = names.map(n => `(export "${n}" (func $${n}))`).join('\n') +
  globals.map(n => `(export "${n}" (global $${n}))`).join('\n');
const imports = `
  (import "host" "open" (func $host_midi_out_open (param i32 i32 i32 i32) (result i32)))
  (import "host" "short" (func $host_midi_out_short_msg (param i32 i32) (result i32)))
  (import "host" "reset" (func $host_midi_out_reset (param i32) (result i32)))
  (import "host" "ticks" (func $host_get_ticks (result i32)))
  (import "host" "event" (func $host_set_event (param i32) (result i32)))
  (import "host" "post" (func $post_queue_push (param i32 i32 i32 i32) (result i32)))
  (import "host" "thread" (func $handle_PostThreadMessageA (param i32 i32 i32 i32 i32 i32)))
  (import "host" "run" (func $run (param i32)))
  (import "host" "enter" (func $sync_depth_enter))
  (import "host" "leave" (func $sync_depth_leave))
`;
const glue = `
  (memory 4)
  (export "memory" (memory 0))
  (global $reg_base i32 (i32.const 1024))
  (global $sync_msg_ret_thunk i32 (i32.const 0x1234))
  (global $eip (mut i32) (i32.const 77)) (export "eip" (global $eip))
  (global $steps (mut i32) (i32.const 88)) (export "steps" (global $steps))
  (global $handler_set_eip (mut i32) (i32.const 1)) (export "handler" (global $handler_set_eip))
  (global $yield_reason (mut i32) (i32.const 2)) (export "reason" (global $yield_reason))
  (global $yield_flag (mut i32) (i32.const 3)) (export "flag" (global $yield_flag))
  (func $g2w (param $a i32) (result i32) (i32.add (local.get $a) (i32.const 65536)))
  (func $w2g (param $a i32) (result i32) (i32.sub (local.get $a) (i32.const 65536)))
  (func $gl32 (param $a i32) (result i32) (i32.load (call $g2w (local.get $a))))
  (func $gs32 (param $a i32) (param $v i32) (i32.store (call $g2w (local.get $a)) (local.get $v)))
  (func $heap_alloc (param $n i32) (result i32) (i32.const 0x2000))
  (func $zero_memory (param $a i32) (param $n i32) (memory.fill (local.get $a) (i32.const 0) (local.get $n)))
`;
async function suite(removeStop = false) {
  let e, dv, now = 100, depth = 0, runs = 0, reenter = false, hang = false;
  const messages = [], notifications = [], resets = [];
  const ga = a => a + 65536;
  const read = a => dv.getUint32(a, true);
  const write = (a, v) => dv.setUint32(a, v, true);
  const header = (a, delta = 480) => {
    write(ga(a), a + 64); write(ga(a + 4), 12); write(ga(a + 8), 12);
    write(ga(a + 16), 2 | 8 | 0x400); // PREPARED + ISSTRM + private flag
    write(ga(a + 64), delta); write(ga(a + 72), 0x00643c90);
  };
  const reg = 1024;
  function call(name, args, pop) {
    const saved = [11, 22, 33, 44, 0xE000, 55, 66, 77];
    saved.forEach((v, i) => write(reg + i * 4, v));
    e[name](...args, ...Array(6 - args.length).fill(0));
    assert.equal(read(reg + 16), 0xE000 + pop, `${name} stdcall ESP`);
    [1, 2, 3, 5, 6, 7].forEach(i => assert.equal(read(reg + i * 4), saved[i], 'preserved register'));
    return read(reg);
  }
  const host = {
    open: (...args) => { assert.deepEqual(args, [0, 0xCA11, 0xC0DE, e ? read(ga(0xE018)) : 0]); return 0xC0001; },
    short: (h, msg) => { messages.push([h, msg]); return 0; },
    reset: h => { resets.push(h); return 0; }, ticks: () => now,
    post: (...args) => { notifications.push(['window', ...args]); return 1; },
    event: h => { notifications.push(['event', h]); return 1; },
    thread: (...args) => { notifications.push(['thread', ...args]); write(reg, 1); write(reg + 16, read(reg + 16) + 20); },
    enter: () => depth++, leave: () => depth--,
    run: budget => {
      assert.equal(budget, 1000000); assert.equal(depth, 1); runs++;
      if (hang) return;
      const sp = read(reg + 16), frame = Array.from({length: 6}, (_, i) => read(ga(sp + i * 4)));
      assert.equal(e.eip.value, 0xCA11);
      assert.deepEqual(frame.slice(0, 4), [0x1234, 0xC0001, 0x3C9, 0xC0DE]);
      assert.equal(frame[5], 0);
      assert.equal(read(ga(frame[4] + 16)), 2 | 8 | 0x400 | 1, 'returned header flags');
      notifications.push(['function', frame[4]]);
      if (reenter) {
        reenter = false;
        // Nested stop sees no original buffers. New queue ownership survives.
        const before = notifications.length;
        write(reg + 16, sp - 8);
        e.handle_midiStreamStop(0xC0001, 0, 0, 0, 0, 0);
        assert.equal(read(reg), 0); assert.equal(read(reg + 16), sp);
        assert.equal(notifications.length, before, 'no double notification on nested stop');
        header(0x6000, 0);
        write(reg + 16, sp - 16);
        e.handle_midiStreamOut(0xC0001, 0x6000, 64, 0, 0, 0);
        assert.equal(read(reg), 0); assert.equal(read(reg + 16), sp);
      }
      // This fixture observes the interpreter boundary, simulating a RET 20.
      // Executing real x86 callback code requires the full interpreter lane.
      write(reg, 0xBAD); write(reg + 4, 0xBAD); write(reg + 16, sp + 24);
      e.eip.value = hang ? 0xCA11 : 0;
      e.steps.value = 99; e.handler.value = 0; e.reason.value = 9; e.flag.value = 9;
    },
  };
  let funcs = names.map(n => form('func', n));
  if (removeStop) funcs = funcs.map((s, i) => names[i] !== 'handle_midiStreamStop' ? s :
    `(func $handle_midiStreamStop ${Array.from({length: 6}, (_, j) => `(param $a${j} i32)`).join(' ')}
       (i32.store (global.get $reg_base)
         (select (i32.const 5) (i32.const 0)
           (i32.or (i32.eqz (local.get $a0)) (i32.ne (local.get $a0) (global.get $midi_stream_handle)))))
       (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))`);
  const wat = `${imports} ${glue} ${globals.map(n => form('global', n)).join('\n')} ${funcs.join('\n')} ${exportsWat}`;
  const compiled = compile(wat, new Map(), {mode: 'production'});
  assert(compiled.success, compiled.error);
  assert(WebAssembly.validate(compiled.wasmBinary));
  e = (await WebAssembly.instantiate(compiled.wasmBinary, {host})).instance.exports;
  dv = new DataView(e.memory.buffer);
  assert.equal(call('handle_midiStreamStop', [0], 8), 5, 'zero unopened handle rejected');
  function open(kind) {
    write(ga(0xE018), kind << 16); write(ga(0x1100), 0);
    assert.equal(call('handle_midiStreamOpen', [0x1000, 0x1100, 1, 0xCA11, 0xC0DE], 28), 0);
    assert.equal(read(ga(0x1000)), 0xC0001);
    assert.equal(e.midi_stream_callback_type.value, kind);
  }
  open(3);
  // Ring wrap and partially consumed/delayed first header.
  e.midi_stream_queue_head.value = 30; e.midi_stream_queue_tail.value = 30;
  for (const a of [0x3000, 0x4000, 0x5000]) {
    header(a); assert.equal(call('handle_midiStreamOut', [0xC0001, a, 64], 16), 0);
  }
  assert.equal(call('handle_midiStreamRestart', [0xC0001], 8), 0);
  e.midi_stream_service(now);
  assert.equal(e.midi_stream_event_pending.value, 1);
  const beforeBad = [e.midi_stream_queue_head.value, e.midi_stream_running.value, read(ga(0x3010))];
  assert.equal(call('handle_midiStreamStop', [0xC9999], 8), 5);
  assert.deepEqual([e.midi_stream_queue_head.value, e.midi_stream_running.value, read(ga(0x3010))], beforeBad);
  assert.equal(messages.length, 0);
  // Pause state must be discarded by stop rather than shifting the next song.
  assert.equal(call('handle_midiStreamPause', [0xC0001], 8), 0);
  reenter = true;
  assert.equal(call('handle_midiStreamStop', [0xC0001], 8), 0);
  assert.deepEqual(notifications, [0x3000, 0x4000, 0x5000].map(a => ['function', a]), 'FIFO completion callbacks');
  assert.equal(depth, 0);
  assert.equal(e.eip.value, 77); assert.equal(e.steps.value, 88);
  assert.equal(e.handler.value, 1); assert.equal(e.reason.value, 2); assert.equal(e.flag.value, 3);
  assert.equal(e.midi_stream_running.value, 0);
  for (const n of ['due_ms', 'event_pending', 'paused_at']) assert.equal(e[`midi_stream_${n}`].value, 0);
  assert.equal(e.midi_stream_tempo.value, 500000); assert.equal(e.midi_stream_division.value, 480);
  assert.equal(resets.length, 1, 'only Pause invokes the destructive reset');
  assert.deepEqual(messages.slice(0, 32), Array.from({length: 16}, (_, ch) =>
    [[0xC0001, 0x40B0 | ch], [0xC0001, 0x7BB0 | ch]]).flat());
  // Requeued buffer remains paused until restart, then plays without old delay.
  e.midi_stream_service(5000); assert.equal(messages.length, 64);
  now = 6000;
  assert.equal(call('handle_midiStreamRestart', [0xC0001], 8), 0);
  e.midi_stream_service(now);
  assert.deepEqual(messages.at(-1), [0xC0001, 0x643c90]);
  assert.equal(read(ga(0x6010)), 2 | 8 | 0x400 | 1);
  const oldCount = notifications.length;
  assert.equal(call('handle_midiStreamStop', [0xC0001], 8), 0);
  assert.equal(call('handle_midiStreamStop', [0xC0001], 8), 0);
  assert.equal(notifications.length, oldCount, 'empty/repeated stop sends no duplicate callbacks');
  for (const kind of [0, 1, 2, 5]) {
    open(kind); header(0x3000);
    assert.equal(call('handle_midiStreamOut', [0xC0001, 0x3000, 64], 16), 0);
    const before = notifications.length;
    assert.equal(call('handle_midiStreamStop', [0xC0001], 8), 0);
    assert.equal(notifications.length, before + (kind ? 1 : 0));
    if (kind === 1) assert.deepEqual(notifications.at(-1), ['window', 0xCA11, 0x3C9, 0xC0001, 0x3000]);
    if (kind === 2) assert.deepEqual(notifications.at(-1), ['thread', 0xCA11, 0x3C9, 0xC0001, 0x3000, 0, 0]);
    if (kind === 5) assert.deepEqual(notifications.at(-1), ['event', 0xCA11]);
    assert.equal(read(ga(0x3010)), 2 | 8 | 0x400 | 1);
  }
  open(3); header(0x3000);
  assert.equal(call('handle_midiStreamOut', [0xC0001, 0x3000, 64], 16), 0);
  hang = true;
  const beforeRuns = runs;
  assert.equal(call('handle_midiStreamStop', [0xC0001], 8), 1, 'nonreturning callback reports failure');
  assert.equal(runs - beforeRuns, 64, 'bounded callback execution');
}
(async () => {
  const table = JSON.parse(fs.readFileSync(path.join(root, 'src/api_table.json')));
  const row = table.find(r => r.name === 'midiStreamStop');
  assert(row); assert.equal(row.nargs, 1); assert.equal(row.convention, 'stdcall');
  const dispatch = fs.readFileSync(path.join(root, 'src/09b2-dispatch-table.generated.wat'), 'utf8');
  assert(dispatch.includes('$handle_midiStreamStop'));
  await suite();
  await assert.rejects(suite(true), /FIFO completion callbacks/);
  console.log('PASS production WAT stop/queue/callback/restart/stdcall; executable behavior-removal control rejected');
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
