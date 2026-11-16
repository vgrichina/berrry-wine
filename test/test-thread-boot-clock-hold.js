#!/usr/bin/env node
'use strict';

// With Threads on, booting a guest thread's Worker costs hundreds of ms of
// wall time. Need for Speed II SE resumes a multimedia-timer tick thread and
// gives it 10000/rate ms of GetTickCount to tick; in the browser the boot ate
// that budget, the game tore the timer down (the tick thread returned to
// EIP 0) and its main loop spun forever on a tick counter nothing advanced.
// The guest clock now stands still while a runnable thread is still booting
// and resumes from where it stopped, with no jump.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ThreadManager } = require('../lib/thread-manager');

// ThreadManager: only a runnable pending thread on the Worker backend counts.
const tm = Object.create(ThreadManager.prototype);
tm.workerBackend = {};
tm._pendingThreads = [];
assert.strictEqual(tm.hasBootingRunnableThread(), false);
tm._pendingThreads.push({ handle: 0xe1002, suspendCount: 1 });
assert.strictEqual(tm.hasBootingRunnableThread(), false, 'CREATE_SUSPENDED is not runnable');
tm._pendingThreads[0].suspendCount = 0;
assert.strictEqual(tm.hasBootingRunnableThread(), true, 'resumed while booting');
tm.workerBackend = null;
assert.strictEqual(tm.hasBootingRunnableThread(), false, 'cooperative backend never holds');

// host.js: the guest tick clock.
const source = fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8');
const context = {
  console, URLSearchParams,
  performance: { now: () => 0 },
  requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
  setTimeout() { return 1; }, clearTimeout() {},
};
vm.runInNewContext(source + '\n;globalThis.WineAssembly = WineAssembly;', context);
const wine = Object.create(context.WineAssembly.prototype);
let now = 1000;
let booting = false;
wine._audioSchedulerNow = () => now;
wine._frozen = false;
wine.guestTickPollStride = 1;
wine.threadManager = { hasBootingRunnableThread: () => booting };
const shared = {};
const tick = () => wine._guestTickMs(shared);

wine._beginGuestTickBatch(shared);
now += 100;
assert.strictEqual(tick(), 100);
booting = true;                 // ResumeThread on a thread still booting
now += 30;                      // the hold starts at the next clock read
assert.strictEqual(tick(), 130);
now += 30;
assert.strictEqual(tick(), 130, 'clock holds once the thread is runnable');
now += 400;                     // the Worker boot
wine._beginGuestTickBatch(shared);
assert.strictEqual(tick(), 130, 'a step boundary does not release it');
// Arm g (the default) reads the continuous clock instead of the stepped one.
assert.strictEqual(wine._guestContinuousMs(shared), 130, 'the continuous clock holds too');
booting = false;                // spawn settled
assert.strictEqual(tick(), 130);
now += 5;
assert.strictEqual(tick(), 135, 'resumes without counting the boot');
now += 20;
wine._beginGuestTickBatch(shared);
assert.strictEqual(tick(), 155);

console.log('test-thread-boot-clock-hold: PASS');
