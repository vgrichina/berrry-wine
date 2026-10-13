#!/usr/bin/env node
// lib/phone-diag.js's command channel must survive the phone's screen going off.
//
// WHY THIS EXISTS: the channel used to reschedule itself only *after* its own
// fetch settled. iOS freezing the page tears down the in-flight connection in a
// way that leaves the promise unsettled rather than rejected, so the retry was
// never scheduled and the eval channel was dead for the life of the page.
// Measured on the device 2026-09-14: after a 2m24s screen-off, POST
// /ios-report resumed (setInterval, owes nothing to the request) while GET
// /ios-cmd never came back once.
//
// So the property under test is specifically RECOVERY WITHOUT COOPERATION FROM
// THE STUCK REQUEST. The fetch stub below deliberately ignores its abort
// signal and never settles -- the pathological case, and the one the abort
// alone does not cover. A fix that only added a timeout would pass a friendlier
// stub and still fail on the phone.
//
// Runs on wall-clock timers against the file's real 5s constant, so it takes
// ~12s. No emulator, no browser.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// PHONE_DIAG_SRC points the harness at another copy of the file. Used to prove
// this test fails against the pre-fix version:
//   git show <rev>:lib/phone-diag.js > /tmp/old.js
//   PHONE_DIAG_SRC=/tmp/old.js node test/test-phone-diag-cmd-recovery.js
const SRC = process.env.PHONE_DIAG_SRC || path.join(__dirname, '..', 'lib', 'phone-diag.js');
const WATCHDOG_MS = 5000;      // CMD_TIMEOUT_MS in the file under test
const DEADLINE_MS = WATCHDOG_MS * 2 + 2500;

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failures++;
};

// --- the smallest DOM the file will load against ---------------------------

function makeSandbox(fetchImpl) {
  const noop = () => {};
  // Window listeners are recorded, not swallowed: the wake kick is the path
  // the phone actually takes out of a screen-off, so the test has to be able
  // to fire it rather than wait out the watchdog.
  const listeners = new Map();
  const record = (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(fn);
  };
  const element = () => ({
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 }),
    addEventListener: noop,
    style: {},
    classList: { contains: () => false },
    children: [],
    querySelector: () => null,
    querySelectorAll: () => [],
    getAttribute: () => null,
    textContent: '',
  });
  const document = {
    hidden: false,
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    elementFromPoint: () => null,
    createElement: () => element(),
    documentElement: element(),
    body: Object.assign(element(), { className: '' }),
    fullscreenElement: null,
    visibilityState: 'visible',
  };
  const sandbox = {
    console,
    location: { search: '?diag=1', origin: 'https://lab.invalid', href: 'https://lab.invalid/?diag=1' },
    document,
    navigator: { userAgent: 'test', hardwareConcurrency: 4, sendBeacon: undefined },
    screen: { width: 375, height: 667, availWidth: 375, availHeight: 667 },
    performance: { now: () => Date.now() },
    URLSearchParams,
    WebAssembly: { Memory: function Memory() {} },
    FinalizationRegistry,
    AbortController,
    fetch: fetchImpl,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    JSON,
    Math,
    Promise,
    Error,
    String,
    Object,
    Array,
    addEventListener: record,
    removeEventListener: noop,
    visualViewport: { width: 375, height: 628, scale: 1, offsetTop: 0, pageTop: 0, addEventListener: noop },
    innerWidth: 375,
    innerHeight: 628,
    scrollX: 0,
    scrollY: 0,
    localStorage: { getItem: () => null, setItem: noop },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.__fire = (type) => {
    for (const fn of listeners.get(type) || []) fn({ type });
    return (listeners.get(type) || []).length;
  };
  return sandbox;
}

function load(fetchImpl) {
  const sandbox = makeSandbox(fetchImpl);
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SRC, 'utf8'), context, { filename: SRC });
  return sandbox;
}

// --- test 1: a never-settling /ios-cmd must not end the channel -------------

function testStuckFetchRecovers() {
  const cmdAttempts = [];
  let stuck = true;
  const delivered = [];

  const fetchImpl = (url, opts) => {
    const isCmd = String(url).includes('/ios-cmd');
    if (!isCmd) {
      // The reporter's POSTs always succeed; they are not what is under test.
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
    }
    cmdAttempts.push(Date.now());
    if (stuck) {
      // The phone-suspend case: connection is gone, the promise never settles,
      // and the abort signal is deliberately ignored.
      return new Promise(() => {});
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([{ id: 'c1', code: '1+1' }]),
    });
  };

  const sandbox = load(fetchImpl);

  return new Promise((resolve) => {
    setTimeout(() => {
      const recovered = cmdAttempts.length >= 2;
      check(recovered,
        `stuck fetch: channel retried (${cmdAttempts.length} attempt(s) in ${DEADLINE_MS}ms, need >= 2)`);
      if (recovered) {
        const gap = cmdAttempts[1] - cmdAttempts[0];
        check(gap <= WATCHDOG_MS * 2 + 1500,
          `stuck fetch: retry arrived in ${gap}ms (watchdog budget ${WATCHDOG_MS * 2}ms)`);
      }
      // The phone's actual recovery signal: the screen comes back on and the
      // page gets pageshow/visibilitychange. That must restart the channel
      // promptly rather than making the user wait out a watchdog period.
      stuck = false;
      const before = cmdAttempts.length;
      const wired = sandbox.__fire('pageshow');
      check(wired > 0, `wake: a pageshow listener is registered (${wired})`);
      setTimeout(() => {
        check(cmdAttempts.length > before,
          `wake: pageshow resumed polling within 1.5s (${cmdAttempts.length - before} more attempt(s))`);
        void delivered;
        resolve();
      }, 1500);
    }, DEADLINE_MS);
  });
}

// --- test 2: the normal path still evaluates and answers --------------------

function testNormalEval() {
  const posted = [];
  let served = false;

  const fetchImpl = (url, opts) => {
    if (String(url).includes('/ios-cmd')) {
      if (served) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      served = true;
      return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'c9', code: '6*7' }]) });
    }
    try {
      const body = opts && opts.body ? JSON.parse(opts.body) : null;
      if (body) posted.push(body);
    } catch (_) { /* not json; ignore */ }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
  };

  load(fetchImpl);

  return new Promise((resolve) => {
    setTimeout(() => {
      const flat = [];
      for (const body of posted) {
        if (Array.isArray(body)) flat.push(...body);
        else flat.push(body);
      }
      const reply = flat.find(item => item && item.kind === 'eval' && item.id === 'c9');
      check(!!reply, 'normal path: eval reply was posted back');
      if (reply) {
        check(reply.ok === true && String(reply.value) === '42',
          `normal path: reply carries the value (ok=${reply.ok} value=${reply.value})`);
      }
      resolve();
    }, 3000);
  });
}

(async () => {
  console.log('phone-diag command-channel recovery');
  await testStuckFetchRecovers();
  await testNormalEval();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
