'use strict';

// A PE DllMain that thunk-connects to its 16-bit companion (ThunkConnect32,
// the way Win98 COMCTL32 reaches COMMCTRL) and then calls KERNEL32 ordinal 35
// (LoadLibrary16), serviced the way the web page services it: the host's
// resolver can only answer asynchronously (it fetches), so its synchronous
// lookup returns a Promise. Real WASM, real PE DLL row, real imported CALLs.
//
// Regression for the 2026-11-17 release blocker: every comctl32 app failed on
// the web with "Asynchronous NE source lookup requires an owned settlement
// protocol" while the CLI's synchronous resolver answered in place.
//
//   node test/test-ne-dllmain-async-companion.js   (WA_TEST_WASM overrides
//   build/wine-assembly.wasm)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pairingImages} = require('./test-native-ls32-connection');

const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24];

// DllMain(hinst, reason, reserved): call the ThunkConnect32 caller, then the
// LoadLibrary16 caller, return TRUE with a complete stdcall frame.
function companionDll(base, name) {
  const f = pairingImages({base, name, module32: name.toLowerCase() + '-pair.dll'});
  const at = base + 0x2600, code = [];
  const call = target => code.push(0xe8, ...u32((target - (at + code.length + 5)) >>> 0));
  call(f.entry); call(f.preloadEntry);
  code.push(0xb8, ...u32(1), 0xc2, 0x0c, 0x00);
  f.bytes.set(code, f.raw(0x2600));
  f.bytes.writeUInt32LE(0x2600, 0x80 + 24 + 16);
  return {...f, dllMain: at};
}

async function main() {
  const wasmPath = process.env.WA_TEST_WASM || path.join(__dirname, '..', 'build', 'wine-assembly.wasm');
  const {createHostImports} = require('../lib/host-imports');
  const loader = require('../lib/dll-loader');
  const processBoot = require('../lib/process-boot');
  const {createNeLifecycle} = require('../lib/ne-lifecycle');
  const memory = new WebAssembly.Memory({initial: 8192, maximum: 8192, shared: true});
  const imports = createHostImports({getMemory: () => memory.buffer, renderer: null, resourceJson: {}});
  imports.host.memory = memory;
  const e = (await WebAssembly.instantiate(await WebAssembly.compile(fs.readFileSync(wasmPath)), imports)).exports;

  // Load the fixture EXE so the process has an image and KERNEL32 EAT.
  const exe = pairingImages();
  new Uint8Array(memory.buffer).set(exe.bytes, e.get_staging());
  assert.equal(e.load_pe(exe.bytes.length), exe.entry);
  e.set_esp(0x7408000);

  const mapDll = name => {
    e.clear_yield();
    const base = e.get_next_dll_addr() >>> 0, f = companionDll(base, name);
    new Uint8Array(memory.buffer).set(f.bytes, e.get_staging());
    e.set_next_dll_explicit_root(1);
    const entry = e.load_dll(f.bytes.length, base) >>> 0;
    assert.equal(entry, f.dllMain, 'PE entry point is the generated DllMain');
    const index = e.get_last_loaded_dll_index();
    const generation = new DataView(memory.buffer).getUint32(e.get_dll_lifecycle_table() + index * 64 + 4, true);
    loader.patchDllImports(e, memory.buffer, [{name: name.toLowerCase() + '-pair.dll', bytes: f.bytes}],
      [{loadAddr: base, dllMain: entry, index, generation}], () => {});
    return f;
  };
  const header = f => Array.from({length: 100}, (_, i) => e.guest_read8(f.data + i));

  // 1. The page's shape: async findDll that really awaits, findDllSync that
  //    can only return a Promise. The companion is absent (fetch -> null).
  {
    const f = mapDll('ABSENT'), before = header(f), lookups = [];
    const savedEsp = e.get_esp() >>> 0, savedEip = e.get_eip() >>> 0;
    const options = ex => ({
      exports: ex, memoryBuffer: memory.buffer, log: () => {},
      findDll: async (file, full) => { lookups.push([file, full]); await new Promise(r => setTimeout(r, 1)); return null; },
      findDllSync: () => Promise.resolve(null),
    });
    const outcome = await loader.callDllMainAsync(e, f.base, f.dllMain, () => {}, {
      reason: 1, requireCompletion: true, maxBlocks: 100000,
      onLoadLibraryYield: async ex => { await processBoot.handleLoadLibraryYield(options(ex)); return true; },
    });
    assert.equal(outcome.completed, true, 'DllMain completes across awaited NE lookups');
    assert.equal(outcome.fault, null);
    assert.equal(outcome.returnValue, 1);
    assert.equal(e.guest_read32(f.result) >>> 0, 1,
      'ThunkConnect32 with no installed 16-bit companion attaches unpaired (TRUE)');
    assert.equal(e.guest_read32(f.result + 4) >>> 0, 2,
      'LoadLibrary16 of an absent module returns HINSTANCE 2 (file not found)');
    assert.deepEqual(header(f), before, 'unpaired attach publishes nothing into the LS32 header or relays');
    assert.equal(e.guest_read32(f.data + 8) >>> 0, 0);
    assert.deepEqual(lookups.map(l => l[0]), ['absent.dll', 'absent.dll'],
      'one asynchronous lookup per NE request');
    assert.equal(e.get_esp() >>> 0, savedEsp); assert.equal(e.get_eip() >>> 0, savedEip);
    assert.equal(e.get_yield_reason(), 0);
    assert.equal(createNeLifecycle(e, memory, []).liveModule('ABSENT'), false);
    console.log('PASS async-resolver DllMain: ThunkConnect32 attaches unpaired, LoadLibrary16 returns 2, caller restored');
  }

  // 2. Only absence settles unpaired: a companion that is present but not a
  //    loadable NE image still fails the attach, through the same async path.
  {
    const f = mapDll('BROKEN'), before = header(f);
    let error;
    try {
      await loader.callDllMainAsync(e, f.base, f.dllMain, () => {}, {
        reason: 1, requireCompletion: true, maxBlocks: 100000,
        onLoadLibraryYield: async ex => {
          await processBoot.handleLoadLibraryYield({exports: ex, memoryBuffer: memory.buffer, log: () => {},
            findDll: async () => { await new Promise(r => setTimeout(r, 1)); return new Uint8Array(64); },
            findDllSync: () => Promise.resolve(null)});
          return true;
        },
      });
    } catch (failure) { error = failure; }
    assert(error, 'a malformed companion is not "missing"');
    assert.notEqual(error.cause && error.cause.guestCode, 2);
    assert.doesNotMatch(String(error.cause && error.cause.message), /owned settlement/);
    assert.equal(e.guest_read32(f.result) >>> 0, 0, 'ThunkConnect32 was never settled');
    assert.deepEqual(header(f), before);
    e.win16_guest_request_cancel(); e.clear_yield();
    console.log('PASS async-resolver DllMain: a malformed companion still fails the attach (' + error.cause.message + ')');
  }

  // 3. A truly synchronous caller still refuses a resolver that can only
  //    answer later: fail-fast, never a guessed "missing".
  {
    const f = mapDll('SYNCONLY');
    let error;
    try {
      loader.callDllMain(e, f.base, f.dllMain, () => {}, {
        reason: 1, requireCompletion: true, maxBlocks: 100000,
        onLoadLibraryYield: ex => processBoot.serviceLoadLibraryYieldSync({exports: ex,
          memoryBuffer: memory.buffer, findDllSync: () => Promise.resolve(null)}),
      });
    } catch (failure) { error = failure; }
    assert(error, 'synchronous DllMain cannot settle an asynchronous-only lookup');
    assert.match(String(error.cause && error.cause.message), /owned settlement protocol/);
    e.win16_guest_request_cancel(); e.clear_yield();
    console.log('PASS synchronous service keeps fail-fast for asynchronous-only NE lookups');
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
