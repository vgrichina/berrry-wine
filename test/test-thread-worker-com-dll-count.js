#!/usr/bin/env node
'use strict';
// A real Worker that services its own COM/LoadLibrary yield loads the DLL into
// its own instance. The DLL table is shared memory, but the row count and the
// thunk cursor are per-instance, and the host's CoCreateInstance bridge looks
// servers up through the MAIN instance. Unless ThreadManager raises main's
// count after the load, the retried CoCreateInstance asks for the same DLL
// again forever: Morrowind's DirectShow thread mapped l3codecx.ax 26 times
// until a copy landed on live memory and the thread jumped into main's stack.

const assert = require('assert');
const { ThreadManager } = require('../lib/thread-manager');

function fakeMain(dllCount, numThunks) {
  const s = { dllCount, numThunks, thunkEnd: 0x1000 };
  return {
    s,
    exports: {
      get_dll_count: () => s.dllCount,
      set_dll_count: v => { s.dllCount = v; },
      get_num_thunks: () => s.numThunks,
      sync_thunk_state: (end, n) => { s.thunkEnd = end; s.numThunks = n; },
    },
  };
}

function fakeLink(values) {
  return { callExport: async name => values[name] };
}

function manager(main, localLink) {
  const tm = Object.create(ThreadManager.prototype);
  tm.mainInstance = main;
  tm.workerBackend = { _localLink: localLink || null };
  return tm;
}

(async () => {
  // A worker that loaded a COM server: main learns the new row and thunks.
  {
    const main = fakeMain(6, 100);
    const tm = manager(main);
    await tm._publishLinkLoaderState(fakeLink({ get_dll_count: 7, get_thunk_end: 0x2000, get_num_thunks: 140 }));
    assert.strictEqual(main.s.dllCount, 7, 'main sees the worker-loaded DLL');
    assert.strictEqual(main.s.numThunks, 140, 'main sees the worker-allocated thunks');
    assert.strictEqual(main.s.thunkEnd, 0x2000);
  }
  // Never lowered: a worker behind main must not erase rows main added.
  {
    const main = fakeMain(9, 200);
    const tm = manager(main);
    await tm._publishLinkLoaderState(fakeLink({ get_dll_count: 7, get_thunk_end: 0x1500, get_num_thunks: 150 }));
    assert.strictEqual(main.s.dllCount, 9, 'dll count never goes down');
    assert.strictEqual(main.s.numThunks, 200, 'thunk count never goes down');
  }
  // The CLI's in-process slot 0 is main itself; nothing to publish.
  {
    const main = fakeMain(6, 100);
    const local = fakeLink({ get_dll_count: 99, get_thunk_end: 0x9000, get_num_thunks: 999 });
    const tm = manager(main, local);
    await tm._publishLinkLoaderState(local);
    assert.strictEqual(main.s.dllCount, 6, 'local link is skipped');
  }
  // Both yield-3/5 paths call it after the host resolver.
  const src = require('fs').readFileSync(require.resolve('../lib/thread-manager'), 'utf8');
  const calls = src.match(/_resolveThreadSendExternalYield\((?:thread\.)?link, r\)[^\n]*\n\s*await this\._publishLinkLoaderState\(/g) || [];
  assert.strictEqual(calls.length, 2, 'both worker DLL-load resolver sites publish the loader state');

  // Real codec files can share the export-directory name DEFFILE.dll.
  // Exercise the shipped Worker message boundary: its loader must retain
  // each server's filename so COM can find the loaded module on retry.
  {
    const vm = require('vm'), fs = require('fs');
    const paths = [], replies = [];
    const sandbox = {
      URL, importScripts() {},
      location: { href: 'https://example.invalid/lib/guest-worker.js?v=test' },
      postMessage: reply => replies.push(reply),
      DllLoader: {
        loadDll(ex, memory, bytes, modulePath) {
          paths.push(modulePath);
          return { loadAddr: 0x100000 + paths.length * 0x10000, dllMain: 0 };
        },
      },
      fixtureInstance: { exports: { clear_yield() {} } },
    };
    sandbox.self = sandbox;
    const context = vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(require.resolve('../lib/guest-worker'), 'utf8'), context);
    vm.runInContext('instance = fixtureInstance; memory = {buffer: new ArrayBuffer(64)};', context);
    for (const [seq, fileName] of ['WMADMOD.DLL', 'WMVDMOD.DLL'].entries()) {
      await sandbox.onmessage({ data: { t: 'comLoadDll', seq, fileName, bytes: new Uint8Array([1]) } });
    }
    assert.deepStrictEqual(paths, ['WMADMOD.DLL', 'WMVDMOD.DLL'],
      'COM Worker must preserve distinct server filenames for loaded-module lookup');
    assert.deepStrictEqual(replies.map(r => r.t), ['comDllLoaded', 'comDllLoaded']);
    assert(replies.every(r => r.loadAddr && !r.error), 'both worker loads complete');
  }

  console.log('PASS  worker COM/LoadLibrary loads publish dll_count and thunks to main');
})().catch(err => { console.error(err); process.exit(1); });
