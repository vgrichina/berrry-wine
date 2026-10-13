'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { GuestThreadHost } = require('../lib/guest-thread-host');

function worker() {
  const replies = [], events = [], regs = [11, 22, 33];
  let keep = 1, seq = 0;
  const sandbox = {
    URL, importScripts() {},
    location: { href: 'https://example.invalid/lib/guest-worker.js?v=test' },
    postMessage: reply => replies.push(reply),
    fixtureInstance: { exports: {
      take_loadlib_keep_regs: () => { const value = keep; keep = 0; return value; },
      get_eax: () => regs[0], get_ecx: () => regs[1], get_edx: () => regs[2],
      set_eax: v => { regs[0] = v; }, set_ecx: v => { regs[1] = v; },
      set_edx: v => { regs[2] = v; }, clear_yield: () => events.push('clear'),
      get_esp: () => 100, set_esp: v => events.push(['esp', v]),
    } },
    DllLoader: {
      loadDll(_ex, _memory, bytes, name) {
        events.push(['map', name]); regs[0] = 999;
        if (bytes[0] === 255) throw Error('bad image');
        return { loadAddr: 0x100000, dllMain: 0x101000 };
      },
      callDllMain: () => events.push('initialize'),
      resumeAfterLoadLibraryYield: () => events.push('resume'),
    },
  };
  sandbox.self = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(require.resolve('../lib/guest-worker'), 'utf8'), context);
  vm.runInContext('instance=fixtureInstance; memory={buffer:new ArrayBuffer(64)};', context);
  return { events, regs, async _ask(message) {
    const id = ++seq;
    await sandbox.onmessage({ data: { ...message, seq: id } });
    const reply = replies.find(r => r.seq === id);
    assert.ok(reply, 'worker acknowledges request');
    return reply;
  } };
}

(async () => {
  // Real worker message handler: mapping cannot initialize or resume the guest.
  const link = worker();
  const mapped = await link._ask({ t: 'loadLibrary', mapOnly: true,
    bytes: new Uint8Array([1]), fileName: 'one.dll' });
  assert.equal(mapped.t, 'libMapped');
  assert.deepEqual(link.events.map(e => Array.isArray(e) ? e[0] : e), ['map']);
  await link._ask({ t: 'loadLibrary', prepared: mapped.prepared });
  assert.deepEqual(link.regs, [11, 22, 33], 'pre-mapping volatile registers survive both phases');
  assert.equal(link.events.filter(e => e === 'initialize').length, 1);

  const host = Object.create(GuestThreadHost.prototype);
  let active = 0, maximum = 0, nested = false;
  const makeLink = () => {
    const actual = worker();
    return { async _ask(message) {
      if (message.mapOnly) {
        maximum = Math.max(maximum, ++active);
        await new Promise(resolve => setTimeout(resolve, 5));
        try { return await actual._ask(message); } finally { --active; }
      }
      if (message.fileName === 'parent.dll') {
        // Initialization may request another module. A whole-load queue would
        // deadlock here; the mapping queue must already be released.
        await host.comLoadDll(new Uint8Array([1]), 'nested.dll', null, makeLink());
        nested = true;
      }
      return actual._ask(message);
    } };
  };
  const guard = setTimeout(() => { throw Error('mapping held through initialization'); }, 2000);
  try {
    await Promise.all([
      host.loadLibrary(new Uint8Array([1]), 'parent.dll', makeLink()),
      host.comLoadDll(new Uint8Array([1]), 'other.dll', null, makeLink()),
    ]);
    assert.equal(maximum, 1, 'LoadLibrary and COM mapping share one queue');
    assert.ok(nested, 'nested mapping finishes while parent initialization is pending');
  } finally { clearTimeout(guard); }

  // An acknowledged map failure is terminal and releases the queue.
  const bad = await host.loadLibrary(new Uint8Array([255]), 'bad.dll', makeLink());
  assert.match(bad.error, /bad image/);
  const good = await host.comLoadDll(new Uint8Array([1]), 'good.dll', null, makeLink());
  assert.equal(good.loadAddr, 0x100000);

  // A missing acknowledgement is not proof the mapper has stopped.
  for (const reply of [null, { t: 'libLoaded', loadAddr: 123 }]) {
    const poisoned = Object.create(GuestThreadHost.prototype);
    let calls = 0;
    const broken = { async _ask() { ++calls; if (!reply) throw Error('worker timed out'); return reply; } };
    await assert.rejects(poisoned.loadLibrary(new Uint8Array([1]), 'a.dll', broken));
    await assert.rejects(poisoned.comLoadDll(new Uint8Array([1]), 'b.dll', null, broken));
    assert.equal(calls, 1, 'never grant a second mapper after unknown completion');
  }
  console.log('PASS worker mapping serialization, initialization release, register preservation and poisoned queues');
})().catch(error => { console.error(error); process.exitCode = 1; });
