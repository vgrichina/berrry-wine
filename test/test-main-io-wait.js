#!/usr/bin/env node
'use strict';

// A main-thread ReadFile parked on a lazy chunk (yield 12) must block only the
// main guest thread. The browser's poll() starts the fill in the background, answers "parked"
// while it is in flight so the host keeps running everyone else, and clears the
// yield exactly once when it lands. Before this the hosts awaited the fill
// inside the step: Heroes III's sound thread stopped refilling DirectSound for
// the length of every fetch and the ring looped audibly.
// The CLI instead awaits the fill to preserve its batch-based guest clock.

const assert = require('assert');
const { createMainIoWait, serviceMainIoWait } = require('../lib/main-io-wait');
const {VirtualFS} = require('../lib/filesystem');

function fakeGuest() {
  return {
    yieldReason: 12, cleared: 0,
    get_yield_reason() { return this.yieldReason; },
    clear_yield() { this.cleared++; this.yieldReason = 0; },
  };
}
function fakeVfs(pending) {
  return { getPendingRead: tid => (tid === 1 ? pending : null) };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  // 1. The fill is held open: main stays parked, everything else keeps going.
  {
    const ex = fakeGuest();
    const pending = { path: 'c:\\data\\h3sprite.lod' };
    let release, fills = 0, done = 0;
    const io = createMainIoWait({
      fill: (vfs, p) => { fills++; assert.strictEqual(p, pending); return new Promise(r => { release = r; }); },
      onDone: () => done++,
    });
    let otherThreadSlices = 0;
    for (let turn = 0; turn < 50; turn++) {
      if (io.poll(ex, fakeVfs(pending))) otherThreadSlices++;   // the host's "main parked" branch
      await tick();
    }
    assert.strictEqual(fills, 1, 'one park starts exactly one fill');
    assert.strictEqual(otherThreadSlices, 50, 'every turn of the park runs the other threads');
    assert.strictEqual(ex.cleared, 0, 'the yield stays set while the chunk is missing');
    assert(io.inFlight, 'the fill is reported in flight (host gives the event loop a turn)');

    release(true);
    await tick();
    assert.strictEqual(done, 1, 'onDone fires once (the page wakes its step)');
    assert.strictEqual(io.poll(ex, fakeVfs(pending)), false, 'main runs again once the chunk is resident');
    assert.strictEqual(ex.cleared, 1, 'the yield is cleared exactly once, re-entering the same ReadFile');
    assert(!io.inFlight);
  }

  // 2. A second park after the first completes starts a fresh fill.
  {
    const ex = fakeGuest();
    let fills = 0;
    const io = createMainIoWait({ fill: () => { fills++; return Promise.resolve(); } });
    assert.strictEqual(io.poll(ex, fakeVfs({ path: 'a' })), true);
    await tick();
    assert.strictEqual(io.poll(ex, fakeVfs({ path: 'a' })), false);
    ex.yieldReason = 12;
    assert.strictEqual(io.poll(ex, fakeVfs({ path: 'b' })), true, 'a new park parks again');
    await tick();
    assert.strictEqual(io.poll(ex, fakeVfs({ path: 'b' })), false);
    assert.strictEqual(fills, 2);
  }

  // 3. Not parked: poll is inert. A failed fill is reported and still releases
  //    the guest (the VFS latches the failure; the retried call completes it as
  //    ERROR_READ_FAULT rather than parking forever).
  {
    const ex = fakeGuest(); ex.yieldReason = 0;
    let fills = 0;
    const io = createMainIoWait({ fill: () => { fills++; return Promise.resolve(); } });
    assert.strictEqual(io.poll(ex, fakeVfs(null)), false);
    assert.strictEqual(fills, 0, 'no park, no fill');

    const ex2 = fakeGuest();
    const errors = [];
    const io2 = createMainIoWait({
      fill: () => Promise.reject(new Error('HTTP 503')),
      onError: (error, path) => errors.push([error.message, path]),
    });
    assert.strictEqual(io2.poll(ex2, fakeVfs({ path: 'c:\\x.dat' })), true);
    await tick(); await tick();
    assert.deepStrictEqual(errors, [['HTTP 503', 'c:\\x.dat']]);
    assert.strictEqual(io2.poll(ex2, fakeVfs({ path: 'c:\\x.dat' })), false, 'a failed fill releases the park');
    assert.strictEqual(ex2.cleared, 1);
  }

  // CLI policy awaits a real provider fill without clearing the parked owner
  // early. VFS failures become guest read errors; transport retirement cannot
  // accidentally resume a replacement or host-shadow instance.
  for (const mode of ['success', 'fault', 'retired']) {
    const vfs = new VirtualFS(), ex = fakeGuest();
    let release, entered, retired = false;
    const ready = new Promise(resolve => { entered = resolve; });
    const provider = {size:4, readRange() {
      entered(); return new Promise((resolve,reject) => { release = () => mode === 'fault'
        ? reject(new Error('network failed')) : resolve(new Uint8Array([1,2,3,4])); });
    }};
    const name = 'c:\\owner-read.bin';
    vfs.setProviderFile(name, {provider});
    const handle = vfs.createFile(name, 0x80000000, 3), bytes = new Uint8Array(4);
    vfs.pendingRead = vfs.readFile(handle, bytes, 4).pending;
    assert(vfs.pendingRead); // Publish the park as fs_read_file_result does.
    const owner = {read:async()=>({get_yield_reason:ex.yieldReason}), call:async name=>{
      assert.strictEqual(name,'clear_yield');
      if(retired) throw new Error('owner retired');
      ex.clear_yield();
    }};
    let settled = false;
    const outcome = serviceMainIoWait(owner,vfs).then(value=>({value}),error=>({error}));
    outcome.then(()=>{settled=true;});
    const timer = setTimeout(()=>{throw new Error('provider did not start');},5000);
    await ready; clearTimeout(timer);
    assert.strictEqual(ex.cleared,0);
    assert.strictEqual(settled,false);
    retired = mode === 'retired'; release();
    const result = await outcome;
    if(retired) {
      assert.match(result.error.message,/owner retired/);
      assert.strictEqual(ex.cleared,0);
    } else {
      assert.strictEqual(result.value,true);
      assert.strictEqual(ex.cleared,1);
      const read = vfs.readFile(handle,bytes,4);
      if(mode === 'fault') {assert.strictEqual(read.error,30); assert(read.faulted);}
      else {assert(read.ok); assert.deepStrictEqual([...bytes],[1,2,3,4]);}
    }
  }
  const broken = fakeGuest();
  await assert.rejects(serviceMainIoWait({read:async()=>({get_yield_reason:12}),
    call:async()=>broken.clear_yield()}, {getPendingRead:()=>({}),
    fillPendingRead:async()=>{throw new Error('unexpected fill error');}}),/unexpected fill error/);
  assert.strictEqual(broken.cleared,0);
  console.log('PASS main I/O waits: browser polling and CLI owner-directed fill/fault/retirement');
})().catch(error => { console.error(error); process.exit(1); });
