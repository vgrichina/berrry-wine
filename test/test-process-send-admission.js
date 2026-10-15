'use strict';
// Actual host broker installation, GuestThreadHost and guest-worker.js, using
// a tiny stateful Wasm ABI. No x86 interpreter or game qualification implied.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { compileWat } = require('../lib/compile-wat');
const { GuestThreadHost, WorkerLink } = require('../lib/guest-thread-host');
const { ProcessSendBroker } = require('../lib/process-send-broker');
const turn = () => new Promise(resolve => setImmediate(resolve));
const gate = () => { let release, reject; const promise = new Promise((r, j) => { release = r; reject = j; }); return { promise, release, reject }; };
const deadline = setTimeout(() => { console.error('Admission test stalled'); process.exit(1); }, 15000);

async function fixture() {
  const fields = ['eip', 'esp', 'ebp', 'eax', 'ebx', 'ecx', 'edx', 'esi', 'edi',
    'handler_set_eip', 'steps', 'yield_reason', 'yield_flag', 'd3d_render_token', 'depth'];
  const source = fields.map((n, i) => `
    (global $${n} (mut i32) (i32.const ${n === 'depth' ? 0 : n === 'yield_reason' ? 7 : 100 + i}))
    (func (export "get_${n}") (result i32) (global.get $${n}))
    (func (export "set_${n}") (param $v i32) (global.set $${n} (local.get $v)))`).join('\n') + `
    (memory 1)
    (global $target (mut i32) (i32.const 0))
    (global $error (mut i32) (i32.const 0))
    (func (export "set_last_error") (param $v i32) (global.set $error (local.get $v)))
    (func (export "set_yield_state") (param $y i32) (param $f i32)
      (global.set $yield_reason (local.get $y)) (global.set $yield_flag (local.get $f)))
    (func (export "get_window_thread") (param $h i32) (result i32)
      (if (result i32) (i32.eq (local.get $h) (i32.const 202)) (then (i32.const 2)) (else (i32.const 1))))
    (func (export "thread_send_begin") (param $h i32) (param $m i32) (param $w i32) (param $l i32) (result i32)
      (global.set $depth (i32.add (global.get $depth) (i32.const 1)))
      (global.set $esp (i32.sub (global.get $esp) (i32.const 20)))
      (global.set $target (local.get $w))
      (global.set $eax (local.get $l))
      (global.set $yield_reason (local.get $m))
      (global.set $eip (local.get $h)) (i32.const 1))
    (func (export "thread_send_end") (result i32)
      (global.set $depth (i32.sub (global.get $depth) (i32.const 1))) (global.get $eax))
    (func (export "complete_thread_send") (param $r i32)
      (global.set $eax (i32.add (local.get $r) (i32.const 1)))
      (global.set $yield_reason (i32.const 0)))
    (func (export "run") (param $steps i32)
      (if (i32.eq (global.get $yield_reason) (i32.const 99)) (then unreachable))
      (if (i32.eqz (global.get $yield_reason)) (then (global.set $eip (i32.const 0)))))
    (func (export "get_send_target_tid") (result i32)
      (if (result i32) (i32.eq (global.get $target) (i32.const -202))
        (then (i32.const 2)) (else (i32.sub (i32.const 0) (global.get $target)))))
    (func (export "get_send_hwnd") (result i32)
      (if (result i32) (i32.eq (global.get $target) (i32.const -202))
        (then (i32.const 202)) (else (global.get $target))))
    (func (export "get_send_msg") (result i32)
      (if (result i32) (i32.eq (global.get $target) (i32.const -202)) (then (i32.const 10)) (else (i32.const 0))))
    (func (export "get_send_wparam") (result i32)
      (if (result i32) (i32.eq (global.get $target) (i32.const -202)) (then (i32.const 100)) (else (i32.const 0))))
    (func (export "get_send_lparam") (result i32) (i32.const 41))`;
  return WebAssembly.compile(await compileWat(async () => source,
    { files: ['admission.wat'], cacheKey: 'process-send-admission' }));
}

async function main() {
  const module = await fixture();
  const context = { console, URLSearchParams, setTimeout, clearTimeout, window: {}, ProcessSendBroker };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../host.js'), 'utf8') +
    '\n;globalThis.WineAssembly=WineAssembly;', context);
  const renderer = { windows: {} }, links = [], endpoints = [];
  async function make(pid, second = false) {
    const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
    const host = new GuestThreadHost({});
    async function thread(slot) {
      const link = new WorkerLink({ slot, memory, module, sigs: {},
        workerUrl: path.join(__dirname, '../lib/guest-worker.js') });
      links.push(link); await link.start(); return link;
    }
    host.link = await thread(0);
    if (second) { host.threadLinks.set(1, await thread(1)); host.slotTid.set(1, 1); }
    const wine = Object.create(context.WineAssembly.prototype);
    Object.assign(wine, { renderer, processId: pid });
    renderer.windows[pid] = { processId: pid };
    if (second) renderer.windows[202] = { processId: pid };
    wine._installProcessSendBroker(host);
    endpoints.push(wine._processSendEndpoint);
    return { host, link: host.link, endpoint: wine._processSendEndpoint, resolver: host.processSendResolver };
  }
  try {
    const a = await make(100), b = await make(200, true);
    const broker = renderer._processSendBroker;
    const source = broker.register(300, { dispatch: () => { throw new Error('unexpected callback'); } });
    endpoints.push(source);
    const send = (receiver, msg, wparam = 0, lparam = 0, hwnd = receiver.endpoint.pid) =>
      broker.send(source, receiver.endpoint, { hwnd, msg, wparam, lparam, windowToken: renderer.windows[hwnd] });
    const before = async link => Promise.all(['esp', 'eax', 'eip', 'yield_reason', 'depth'].map(n => link.callExport('get_' + n)));
    const aBefore = await before(a.link), bBefore = await before(b.link);
    // Hold both outgoing sends until both actual Workers have published yield
    // 10. Their root requests have independent chains.
    const ready = gate(), go = gate(); let entered = 0;
    for (const p of [a, b]) {
      const original = p.host.processSendResolver;
      p.host.processSendResolver = async (...args) => {
        if (++entered === 2) ready.release();
        await go.promise; return original(...args);
      };
    }
    const roots = [send(a, 10, 200), send(b, 10, 100)];
    await ready.promise; go.release();
    assert.deepEqual(await Promise.all(roots), [42, 42]);
    assert.deepEqual(await before(a.link), aBefore);
    assert.deepEqual(await before(b.link), bBefore);
    console.log('PASS independent A/B actual guest Worker sends and register restoration');
    a.host.processSendResolver = a.resolver;
    b.host.processSendResolver = b.resolver;
    assert.equal(await send(b, 10, -202), 43);
    assert.deepEqual(await before(b.link), bBefore);
    assert.equal(await b.host.linkForWin32Tid(2).callExport('get_depth'), 0);
    console.log('PASS local thread hop followed by foreign send retains exact ownership');

    const oldLink = b.host.linkForWin32Tid(2), dispatch = oldLink.dispatchThreadSend.bind(oldLink);
    const dispatchAt = gate(), dispatchReply = gate();
    oldLink.dispatchThreadSend = async args => {
      const reply = await dispatch(args); dispatchAt.release(); await dispatchReply.promise; return reply;
    };
    const oldActive = send(b, 0, 0, 12, 202); await dispatchAt.promise;
    const staleLink = send(b, 0, 0, 13, 202);
    const staleRejected = assert.rejects(staleLink, {code:'receiver-gone'});
    while (!b.endpoint.threads.get(oldLink).queue.length) await turn();
    b.host.threadLinks.set(1, b.link); // same TID, a different Worker link generation
    dispatchReply.release(); assert.equal(await oldActive, 12); await staleRejected;
    b.host.threadLinks.set(1, oldLink); oldLink.dispatchThreadSend = dispatch;
    console.log('PASS queued request cannot enter replacement link with the same TID');

    const held = gate(), at = gate();
    a.host.processSendResolver = async () => { at.release(); return held.promise; };
    const parked = send(a, 10, 200); await at.promise;
    // Separate thread progress is tested while B thread 1 is itself parked.
    const bHeld = gate(), bAt = gate();
    b.host.processSendResolver = async () => { bAt.release(); return bHeld.promise; };
    const bParked = send(b, 10, 100); await bAt.promise;
    assert.equal(b.host.hasIncomingProcessSends(b.host.linkForWin32Tid(2)), false);
    assert.equal(await send(b, 0, 0, 73, 202), 73);
    bHeld.release(2); assert.equal(await bParked, 3);

    // Early outer result must remain owned until an unrelated nested callback
    // has unwound. Its final value must not complete that nested callback.
    const nestedHeld = gate(), nestedAt = gate();
    a.host.processSendResolver = async () => { nestedAt.release(); return nestedHeld.promise; };
    const nested = send(a, 10, 200); await nestedAt.promise;
    let outerDone = false; parked.then(() => { outerDone = true; });
    held.release(70); await turn(); await turn();
    assert.equal(outerDone, false);
    assert.equal(await a.link.callExport('get_depth'), 2);
    nestedHeld.release(8);
    assert.equal(await nested, 9); assert.equal(await parked, 71);
    assert.deepEqual(await before(a.link), aBefore);
    console.log('PASS separate receiver TID and early outer reply waits for nested unwind');

    const rootHeld = gate(), rootAt = gate();
    a.host.processSendResolver = async () => { rootAt.release(); return rootHeld.promise; };
    await a.link.callExport('set_yield_reason', 10);
    const rootSend = a.host.resolveThreadSend(a.link,
      { targetTid:-200, hwnd:200, msg:0, wparam:0, lparam:0 });
    await rootAt.promise;
    const rootInnerHeld = gate(), rootInnerAt = gate();
    a.host.processSendResolver = async () => { rootInnerAt.release(); return rootInnerHeld.promise; };
    const rootInner = send(a, 10, 200); await rootInnerAt.promise;
    let rootDone = false; rootSend.then(() => { rootDone = true; });
    rootHeld.release(60); await turn(); await turn();
    assert.equal(rootDone, false);
    assert.equal(await a.link.callExport('get_depth'), 1);
    rootInnerHeld.release(6); assert.equal(await rootInner, 7);
    assert.equal(await rootSend, 60);
    assert.equal(await a.link.callExport('get_eax'), 61);
    assert.equal(await a.link.callExport('get_depth'), 0);
    await a.link.callExport('set_eax', aBefore[1]);
    await a.link.callExport('set_yield_reason', aBefore[3]);
    assert.deepEqual(await before(a.link), aBefore);
    console.log('PASS ordinary outgoing send completion stays below incoming callback');

    // An ambiguous resume acknowledgement retries the exact epoch. The tiny
    // ABI adds one on completion, so a second application changes the result.
    a.host.processSendResolver = async () => 0;
    const ask = a.link._ask.bind(a.link); let lost = false;
    a.link._ask = async (...args) => {
      const response = await ask(...args);
      if (args[0].t === 'resumeThreadSendDispatch' && !lost) {
        lost = true; throw new Error('lost resume acknowledgement');
      }
      return response;
    };
    assert.equal(await send(a, 10, 200), 1); assert(lost);
    a.link._ask = ask;
    assert.deepEqual(await before(a.link), aBefore);

    // Retiring only the original sender rejects its result immediately while
    // its receiving callback retains ownership underneath another sender.
    const retiring = broker.register(400, { dispatch: () => { throw new Error('unexpected'); } });
    endpoints.push(retiring);
    const retireWait = gate(), retireAt = gate();
    a.host.processSendResolver = async () => { retireAt.release(); return retireWait.promise; };
    const orphan = broker.send(retiring, a.endpoint,
      { hwnd:100, msg:10, wparam:200, lparam:0, windowToken:renderer.windows[100] });
    const rejected = assert.rejects(orphan, {code:'sender-gone'});
    await retireAt.promise;
    const innerWait = gate(), innerAt = gate();
    a.host.processSendResolver = async () => { innerAt.release(); return innerWait.promise; };
    const survivor = send(a, 10, 200); await innerAt.promise;
    broker.retire(retiring); await rejected;
    assert.equal(await a.link.callExport('get_depth'), 2);
    retireWait.release(17); await turn();
    assert.equal(await a.link.callExport('get_depth'), 2);
    innerWait.release(3); assert.equal(await survivor, 4);
    while (a.link.threadSendDepth) await turn();
    assert.deepEqual(await before(a.link), aBefore);

    const failWait = gate(), failAt = gate();
    a.host.processSendResolver = async () => { failAt.release(); return failWait.promise; };
    const failure = send(a, 10, 200);
    const failed = assert.rejects(failure, /outgoing transport failed/);
    await failAt.promise;
    const lastWait = gate(), lastAt = gate();
    a.host.processSendResolver = async () => { lastAt.release(); return lastWait.promise; };
    const last = send(a, 10, 200); await lastAt.promise;
    failWait.reject(new Error('outgoing transport failed')); await turn();
    assert.equal(await a.link.callExport('get_depth'), 2);
    lastWait.release(4); assert.equal(await last, 5); await failed;
    assert.equal(await a.link.callExport('get_depth'), 0);
    console.log('PASS lost resume acknowledgement, sender retirement and outer failure under nested frame');

    const receiverHeld = gate(), receiverAt = gate();
    b.host.processSendResolver = async () => { receiverAt.release(); return receiverHeld.promise; };
    const dyingOuter = send(b, 10, 100);
    const outerGone = assert.rejects(dyingOuter, {code:'receiver-gone'}); await receiverAt.promise;
    const dyingHeld = gate(), dyingAt = gate();
    b.host.processSendResolver = async () => { dyingAt.release(); return dyingHeld.promise; };
    const dyingInner = send(b, 10, 100);
    const innerGone = assert.rejects(dyingInner, {code:'receiver-gone'}); await dyingAt.promise;
    broker.retire(b.endpoint); await Promise.all([outerGone, innerGone]);
    receiverHeld.release(5); await turn();
    assert.equal(await b.link.callExport('get_depth'), 2);
    dyingHeld.release(6);
    while (b.link.threadSendDepth) await turn();
    assert.deepEqual(await before(b.link), bBefore);
    console.log('PASS receiver retirement rejects results while nested frames unwind in order');
  } finally {
    for (const endpoint of endpoints) renderer._processSendBroker.retire(endpoint);
    await Promise.all(links.map(link => link.stop()));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => clearTimeout(deadline));
