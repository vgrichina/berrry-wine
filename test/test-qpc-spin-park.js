#!/usr/bin/env node

'use strict';

// QueryPerformanceCounter frame limiters are clock spins.
//
// Diablo II's menu runs d2win.dll 0x1000b670, a 25 fps limiter:
//
//   loop: PeekMessageA(&msg, 0, 0, 0, PM_NOREMOVE)   -> dispatch if non-empty
//         QueryPerformanceCounter(&now)
//         QueryPerformanceFrequency(&freq)
//         if ((now - last) * 25 > freq) { last = now; render(); }
//
// It made 33.1M PeekMessageA and 33.1M QPC calls over ~2,760 menu batches
// (docs/re-notes/diablo2-demo.md) and neither spin detector saw it: QPC was
// not a clock read at all, QPC/QPF counted as Win32 work between reads, and
// the PeekMessage detector needs two peeks with NO call in between.
//
// QPC now goes through $clock_spin_step keyed on the millisecond its count is
// built from, and QPC/QPF are clock reads for the activity sequence. This file
// pins that shape parking, the park's re-entry contract, and every reset that
// keeps a healthy QPC user out -- a moving clock, a real call in between,
// a delivered message, guest work above the threshold, and K=0.
//
// Deterministic: the guest clock is ctx.guestNowMs, nothing reads wall time.

const path = require('path');
const fs = require('fs');

const IMAGE_BASE = 0x400000;
const WASM = path.join(__dirname, '..', 'build', 'wine-assembly.wasm');

const PARKED = 1, FRAME_INTACT = 2, SET_EIP = 4, POPPED = 8, RETURNED = 16;

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? '  ' + detail : ''}`); }
};

async function boot() {
  const { createHostImports } = require('../lib/host-imports');
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const clock = { now: 5000 };
  const ctx = {
    getMemory: () => memory.buffer,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} },
    onExit: () => {},
    guestNowMs: () => clock.now,
  };
  const base = createHostImports(ctx);
  base.host.memory = memory;
  for (const stub of ['create_thread', 'exit_thread', 'terminate_thread', 'create_event',
    'set_event', 'reset_event', 'wait_single', 'wait_multiple']) base.host[stub] = () => 0;
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(WASM), base);
  ctx.exports = instance.exports;
  instance.exports.init_thread(1, IMAGE_BASE, 0, 0, 0, 0, 0);
  return { e: instance.exports, clock, memory };
}

async function main() {
  const { e, clock, memory } = await boot();
  const RegionMap = require('../lib/region-map.generated');
  const K = e.get_spin_park_k() >>> 0;
  const MSG = IMAGE_BASE + 0x2000;
  const COUNT = IMAGE_BASE + 0x3000;

  // One pass of D2's loop: empty peek, QPC, QPF. Returns the QPC bits.
  const pass1 = () => {
    e.test_peek_spin_once(MSG);
    const bits = e.test_qpc_spin_once(COUNT) >>> 0;
    if (!(bits & PARKED)) e.test_spin_qpf_call();
    return bits;
  };

  // ---- 1. the Diablo II shape parks at K ------------------------------
  e.test_spin_reset();
  let parkedAt = -1, completed = true, bits = 0;
  for (let i = 1; i <= K; i++) {
    bits = pass1();
    if (bits & PARKED) { parkedAt = i; break; }
    if ((bits & (POPPED | RETURNED)) !== (POPPED | RETURNED)) completed = false;
  }
  check('reads before the threshold complete: 1-arg frame popped, count on the clock ms',
    completed);
  check(`peek + QPC + QPF parks on the ${K}th QPC of one millisecond`, parkedAt === K,
    `parked at ${parkedAt}`);
  check('it is the clock detector that fired', (e.get_clock_spin_parks() >>> 0) === 1
    && (e.get_peek_spin_parks() >>> 0) === 0,
    `clock=${e.get_clock_spin_parks() >>> 0} peek=${e.get_peek_spin_parks() >>> 0}`);

  // ---- 2. the park's contract -----------------------------------------
  check('the QPC park leaves the stdcall frame untouched', (bits & FRAME_INTACT) !== 0);
  check('the QPC park raises $handler_set_eip', (bits & SET_EIP) !== 0);
  check('the QPC park does not pop its frame or write the count',
    (bits & (POPPED | RETURNED)) === 0);
  check('the QPC park names the next millisecond as its deadline',
    (e.get_spin_deadline_ms() >>> 0) === clock.now + 1
      && (e.get_tick_count() >>> 0) === clock.now,
    `deadline=${e.get_spin_deadline_ms() >>> 0} tick=${e.get_tick_count() >>> 0}`);
  // Woken on the same millisecond, the re-entered call completes: one park per ms.
  const again = pass1();
  check('a re-entry on the same millisecond completes instead of re-parking',
    (again & PARKED) === 0 && (again & (POPPED | RETURNED)) === (POPPED | RETURNED));
  clock.now += 1;
  pass1();
  const requalified = pass1();
  check('the qualified site re-arms on its second read of the next millisecond',
    (requalified & PARKED) !== 0);

  // ---- 3. a moving clock never parks ----------------------------------
  e.test_spin_reset();
  let movingParked = false;
  for (let i = 0; i < K * 5; i++) {
    clock.now += 1;
    if (pass1() & PARKED) movingParked = true;
  }
  check('a QPC loop whose millisecond moves every pass never parks', !movingParked);

  // ---- 4. a real call between two reads resets the run -----------------
  e.test_spin_reset();
  let workParked = false;
  for (let i = 0; i < K * 5; i++) {
    if (pass1() & PARKED) workParked = true;
    e.test_spin_other_call();
  }
  check('a non-clock Win32 call between QPC reads never parks', !workParked);

  // ---- 5. a pending message is work -----------------------------------
  // PM_NOREMOVE sees it and returns TRUE; that successful peek must break the
  // run so the loop goes on to dispatch it instead of sleeping.
  e.test_spin_reset();
  for (let i = 0; i < K - 1; i++) pass1();
  check('the test message was queued', e.test_shared_post(0, 0x1234, 0, 0) === 1);
  const peekBits = e.test_peek_spin_once(MSG) >>> 0;
  check('PeekMessage reports it', (peekBits & RETURNED) === 0);
  const afterMsg = e.test_qpc_spin_once(COUNT) >>> 0;
  check('a QPC read after a delivered message does not park',
    (afterMsg & PARKED) === 0 && (e.get_clock_spin_count() >>> 0) === 1,
    `count=${e.get_clock_spin_count() >>> 0}`);
  check('the queued message can be drained', e.test_shared_post_read(MSG, 1) === 1);

  // ---- 6. guest work between reads ------------------------------------
  // A game timing each object with QPC and no API call around it.
  const WORK_MAX = e.get_spin_work_max() >>> 0;
  e.test_spin_reset();
  let blocksParked = false;
  for (let i = 0; i < K * 5; i++) {
    if ((e.test_qpc_spin_once(COUNT) >>> 0) & PARKED) blocksParked = true;
    e.test_spin_retire_blocks(WORK_MAX + 1);
  }
  check('guest work above the threshold between QPC reads never parks', !blocksParked);

  // ---- 6b. registers holding the previous count ------------------------
  // d2win's limiter (0x1000b6e4) copies each QPC result into ESI:EDI before
  // the next read, and QPC moves every call, so ESI changes on every pass of
  // a REAL spin. The register check discounts the previous reading itself;
  // an object pointer in EDI (per-object timing) still breaks the run.
  const countAt = RegionMap.g2w(COUNT, IMAGE_BASE);
  const lastCount = () => { const v = new DataView(memory.buffer, countAt, 8);
    return [v.getUint32(0, true), v.getUint32(4, true)]; };
  e.test_spin_reset();
  let prevParkedAt = -1;
  for (let i = 1; i <= K; i++) {
    const bits = pass1();
    if (bits & PARKED) { prevParkedAt = i; break; }
    const [lo, hi] = lastCount(); e.set_esi(lo); e.set_edi(hi);
  }
  check(`a limiter holding the last count in ESI:EDI still parks at the ${K}th read`,
    prevParkedAt === K, `parked at ${prevParkedAt}`);
  e.test_spin_reset();
  let objParked = false;
  for (let i = 0; i < K * 5; i++) {
    e.set_edi(0x00a00000 + i * 0x1b0);
    if (pass1() & PARKED) objParked = true;
  }
  check('QPC with a different object in EDI each read never parks', !objParked);
  e.set_esi(0); e.set_edi(0);

  // ---- 7. the off switch ----------------------------------------------
  e.test_spin_reset();
  e.set_spin_park_k(0);
  let offParked = false;
  for (let i = 0; i < 200; i++) if (pass1() & PARKED) offParked = true;
  check('--no-spin-park (K=0) disables the QPC park', !offParked);
  e.set_spin_park_k(K);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
