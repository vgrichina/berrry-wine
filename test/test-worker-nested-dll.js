'use strict';
const assert = require('assert'), fs = require('fs'), vm = require('vm');
async function run(missing, failFetch = false) {
  const replies = [], mapped = [], initialized = [];
  let sandbox, context, parentFinished = false;
  const state = { eax: 5, ebx: 6, ecx: 7, edx: 8, esi: 9, edi: 10, ebp: 11, esp: 256, eip: 100, yield: 3 };
  const initial = { ...state };
  let outPointer = 123; 
  const buffer = new ArrayBuffer(4096), bytes = new Uint8Array(buffer);
  bytes.set(Buffer.from('child.dll\0'), 32);
  const ex = { get_loadlib_name: () => 32, clear_yield: () => state.yield = 0,
    guest_read32: address => address === initial.esp ? 900 : address === initial.esp + 20 ? 1024 : 0,
    guest_write32: (address, value) => { assert.equal(address, 1024); outPointer = value; } };
  for (const name of Object.keys(state)) { ex['get_' + name] = () => state[name]; ex['set_' + name] = v => state[name] = v; }
  sandbox = { URL, importScripts() {}, setTimeout, clearTimeout,
    location: { href: 'https://example.invalid/lib/guest-worker.js?v=test' },
    fixture: { exports: ex }, fixtureBuffer: buffer,
    postMessage(reply) {
      replies.push(reply);
      if (reply.t === 'initializerDllRequest') {
        assert.equal(parentFinished, false);
        assert.equal(reply.name, 'child.dll');
        assert.equal(replies.filter(r => r.t === 'comDllLoaded').length, 0);
        queueMicrotask(() => sandbox.onmessage({ data: {
          t: 'initializerDllBytes', ticket: reply.ticket, fileName: 'child.dll',
          bytes: missing ? null : new Uint8Array([2]), deps: [],
          error: failFetch ? 'network failed' : undefined,
        } }));
      }
    },
    DllLoader: {
      loadDll(owner, mem, content, name) {
        assert.strictEqual(owner, ex); assert.strictEqual(mem, buffer);
        mapped.push(name); return { loadAddr: mapped.length * 1000, dllMain: 1 };
      },
      loadedModuleNames: () => new Set(mapped.map(x => x.toLowerCase())),
      patchDllImports() {}, resumeAfterLoadLibraryYield() {},
      callDllMain() { throw Error('synchronous initializer used'); },
      async callDllMainAsync(owner, addr, entry, log, opts) {
        assert.strictEqual(owner, ex);
        if (addr === 1000) {
          state.yield = 5;
          await opts.onLoadLibraryYield(ex);
          assert.equal(state.eax, missing ? 0 : 2000, 'nested LoadLibrary result belongs to initializer');
          parentFinished = true;
        }
        initialized.push(addr);
        state.ebx = 999; state.eax = 1;
      },
    },
  };
  sandbox.self = sandbox; context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(require.resolve('../lib/guest-worker.js'), 'utf8'), context);
  vm.runInContext('instance=fixture;memory={buffer:fixtureBuffer};', context);
  await sandbox.onmessage({ data: { t: 'comLoadDll', seq: 1, fileName: 'parent.dll', bytes: new Uint8Array([1]) } });
  if (failFetch) {
    const answer = replies.find(r => r.t === 'comDllLoaded');
    assert(answer.error.includes('network failed')); assert.equal(answer.loadAddr, 0);
    assert.equal(state.eip, 900, 'failed COM returns to original caller');
    assert.equal(state.esp, initial.esp + 24); assert.equal(state.eax >>> 0, 0x80004005);
    assert.equal(state.ebx, initial.ebx); assert.equal(outPointer, 0);
    assert.equal(parentFinished, false); return;
  }
  assert.deepEqual(mapped, missing ? ['parent.dll'] : ['parent.dll','child.dll']);
  assert.deepEqual(initialized, missing ? [1000] : [2000,1000], 'nested initializer finishes first');
  assert.equal(state.ebx, initial.ebx); assert.equal(state.eax, initial.eax);
  assert.equal(state.esp, initial.esp); assert.equal(state.eip, initial.eip);
  const answer = replies.filter(r => r.t === 'comDllLoaded');
  assert.equal(answer.length, 1); assert.equal(answer[0].loadAddr, 1000); assert(!answer[0].error);
}
(async () => { await run(false); await run(true); await run(false, true); console.log('PASS Worker nested DLL bytes, ordering, missing optional DLL and owning registers'); })().catch(e => { console.error(e); process.exitCode = 1; });
