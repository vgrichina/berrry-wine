'use strict';
// Production JS loader/callback harness with an explicit native-ABI simulator.
// No x86 interpreter, full VM, guest binary or gameplay qualification.
const assert = require('node:assert/strict');
const loader = require(process.env.WA_DLL_LOADER || '../lib/dll-loader');
const boot = require('../lib/process-boot');

function fixture() {
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 2, shared: true });
  const dv = new DataView(memory.buffer), words = new Int32Array(memory.buffer);
  const table = 128, life = 512, flags = 1024, paths = 1152, gate = 1280, staging = 2048;
  const get = (i, f) => dv.getUint32(life + i * 64 + f, true);
  const put = (i, f, v) => dv.setUint32(life + i * 64 + f, v, true);
  let count = 0, last = -1, path = 0, heap = 4096, lockDepth = 0, owner = 1;
  let pendingName = 0, y = 0, yf = 0, halt = 2;
  const registers = { eip: 70000, esp: 120000, eax: 81, ecx: 82, edx: 83,
    ebx: 84, ebp: 85, esi: 86, edi: 87, handler_set_eip: 88, steps: 89 };
  const names = new Map(), rows = [], completed = [], calls = [], requests = [];
  const plans = new Map([['a.dll', ['b.dll', 'b.dll', 'a.dll']],
    ['b.dll', ['c.dll']], ['c.dll', ['c.dll']]]);
  const cstr = ptr => { let s = ''; for (let i = ptr; dv.getUint8(i); i++) s += String.fromCharCode(dv.getUint8(i)); return s; };
  function string(s) {
    const ptr = heap; heap += s.length + 1;
    new Uint8Array(memory.buffer, ptr, s.length + 1).set(Buffer.from(s + '\0')); return ptr;
  }
  function unlock() { assert.ok(lockDepth > 0); lockDepth--; }
  const ex = {
    memory, get_image_base: () => 4096, guest_to_wasm: a => a,
    get_code_start: () => 16000, get_code_end: () => 100000,
    get_fs_base: () => 1500,
    get_dll_callback_lock: () => gate, get_dll_callback_owner: () => owner,
    get_current_thread_id: () => owner,
    get_dll_lifecycle_table: () => life, get_dll_lifecycle_stride: () => 64,
    get_dll_count: () => count, get_dll_table: () => table,
    get_dll_flags_table: () => flags, get_dll_path_table: () => paths,
    get_dll_index: addr => rows.findIndex(r => r.base === addr),
    get_loadlib_name: () => pendingName,
    get_yield_reason: () => y, get_yield_flag: () => yf,
    clear_yield() { y = 0; yf = 0; }, set_yield_state(a, b) { y = a; yf = b; },
    get_last_run_halt: () => halt,
    get_staging: () => staging, get_staging_size: () => 512,
    get_next_dll_addr: () => 16000 + count * 4096,
    get_last_loaded_dll_index: () => last,
    guest_alloc(n) { const ptr = heap; heap += n; return ptr; }, guest_free() {},
    set_next_dll_path(p) { path = p; },
    dll_load_lock_begin() { lockDepth++; },
    dll_load_lock_end: unlock, dll_load_lock_release_once: unlock,
    find_loaded_dll_path(p) { return names.has(cstr(p).toLowerCase()) ? names.get(cstr(p).toLowerCase()) : -1; },
    load_dll(size, base) {
      assert.equal(lockDepth, 1);
      const name = cstr(path).toLowerCase(), i = count++;
      last = i; names.set(name, i); rows.push({ name, base, stage: 0, awaiting: null, seen: 0 });
      dv.setUint32(table + i * 32, base, true); dv.setUint32(table + i * 32 + 4, 4096, true);
      dv.setUint32(paths + i * 4, path, true); dv.setUint32(flags + i * 4, owner << 16, true);
      put(i, 0, 1); put(i, 4, 17 + i); put(i, 8, 1); put(i, 12, 1); put(i, 24, base + 8);
      unlock(); return base + 8;
    },
    complete_dll_initialize(i, generation, status) {
      assert.equal(generation, 17 + i, 'completion owns original generation');
      completed.push([i, generation, status]); put(i, 0, status === 1 ? 2 : 4);
      put(i, 48, status === 1 ? 1 : 0); dv.setUint32(flags + i * 4, (owner << 16) | (status === 1 ? 4 : 0), true);
    },
    run() {
      assert.equal(lockDepth, 0, 'metadata lock cannot span guest code');
      assert.ok(words[gate / 4 + 1] > 0);
      const r = rows.find(r => registers.eip >= r.base && registers.eip < r.base + 4096);
      assert.ok(r, 'resume must target the original initializer');
      if (!r.seen++) calls.push(r.name);
      if (r.awaiting) {
        assert.equal(registers.eax, rows[names.get(r.awaiting)].base, 'LoadLibrary returns exact nested HMODULE');
        assert.equal(registers.ebx, r.cookie, 'child callback preserves parent registers');
        assert.equal(dv.getUint32(1500, true), r.cookie, 'child callback preserves parent SEH');
        r.awaiting = null;
      }
      const next = plans.get(r.name)[r.stage++];
      if (next) {
        r.awaiting = next; r.cookie = 0xabc000 + r.stage;
        registers.ebx = r.cookie; dv.setUint32(1500, r.cookie, true);
        pendingName = string(next); requests.push(next);
        registers.esp -= 4; dv.setUint32(registers.esp, r.base + 32, true);
        registers.eip = 0; y = 5; yf = 1; halt = 3;
      } else {
        registers.eax = 1; registers.eip = 0; registers.esp += 16; halt = 2;
      }
    },
  };
  for (const name of Object.keys(registers)) {
    ex['get_' + name] = () => registers[name]; ex['set_' + name] = value => { registers[name] = value; };
  }
  dv.setUint32(1500, 0x12345678, true);
  return { ex, memory, registers, rows, calls, completed, requests, words, gate,
    string, get, put, setOwner: n => { owner = n; },
    stats: () => ({ lockDepth, y, yf }), setPending(n) { pendingName = string(n); y = 5; yf = 1; } };
}

function nestedSync() {
  const f = fixture(), original = { ...f.registers };
  const options = { exports: f.ex, memoryBuffer: f.memory.buffer,
    findDllSync: () => new Uint8Array(512) };
  f.setPending('a.dll');
  assert.equal(boot.serviceLoadLibraryYieldSync(options), true);
  assert.deepEqual(f.calls, ['a.dll', 'b.dll', 'c.dll']);
  assert.deepEqual(f.requests, ['b.dll', 'c.dll', 'c.dll', 'b.dll', 'a.dll']);
  assert.deepEqual(f.completed, [[2, 19, 1], [1, 18, 1], [0, 17, 1]]);
  assert.equal(f.rows.length, 3, 'self/repeated loads do not remap or duplicate attach');
  assert.equal(f.registers.eax, f.rows[0].base);
  for (const key of Object.keys(original).filter(k => k !== 'eax')) assert.equal(f.registers[key], original[key], key);
  assert.equal(new DataView(f.memory.buffer).getUint32(1500, true), 0x12345678);
  assert.deepEqual(f.stats(), { lockDepth: 0, y: 0, yf: 0 });
  assert.deepEqual([...f.words.slice(f.gate / 4, f.gate / 4 + 2)], [0, 0]);
  for (let i = 0; i < 3; i++) { assert.equal(f.get(i, 0), 2); assert.equal(f.get(i, 12), 0); }
}
function rejectedInitializer(mode) {
  const f = fixture(), original = { ...f.registers };
  const row = loader.loadDll(f.ex, f.memory.buffer, new Uint8Array(512), 'reject.dll');
  const failure = new Error('initializer fault');
  f.ex.run = () => {
    f.registers.ebx = 42;
    if (mode === 'throw') throw failure;
    if (mode === 'blocked') return; // Nonreturning frame must never publish success.
    f.registers.eip = 0; f.registers.esp += 16; f.registers.eax = 0;
  };
  const outcome = loader.callDllMain(f.ex, row.loadAddr, row.dllMain, null);
  assert.equal(outcome.completed, mode === 'false');
  assert.equal(outcome.fault, mode === 'throw' ? failure : null);
  assert.equal(f.get(0, 48), 0, 'rejected, faulting and unfinished attaches stay unpublished');
  assert.deepEqual(f.completed, [[0, 17, mode === 'false' ? 2 : 0]]);
  assert.deepEqual(f.registers, original, 'failure restores original caller');
  assert.deepEqual([...f.words.slice(f.gate / 4, f.gate / 4 + 2)], [0, 0]);
  assert.equal(f.stats().lockDepth, 0);
}

async function nestedAsync() {
  const f = fixture(), original = { ...f.registers };
  let lookups = 0;
  const competitor = { ...f.ex, get_dll_callback_owner: () => 2 };
  f.setPending('a.dll');
  await boot.handleLoadLibraryYield({ exports: f.ex, memoryBuffer: f.memory.buffer,
    findDll: async () => {
      lookups++;
      await Promise.resolve();
      assert.equal(loader.tryDllCallbackGate(competitor), null, 'another thread stays excluded across host awaits');
      return new Uint8Array(512);
    } });
  assert.equal(lookups, 6);
  assert.deepEqual(f.calls, ['a.dll', 'b.dll', 'c.dll']);
  assert.deepEqual(f.completed, [[2, 19, 1], [1, 18, 1], [0, 17, 1]]);
  for (const key of Object.keys(original).filter(k => k !== 'eax')) assert.equal(f.registers[key], original[key], key);
  assert.equal(f.registers.eax, f.rows[0].base);
  for (let i = 0; i < 3; i++) { assert.equal(f.get(i, 0), 2); assert.equal(f.get(i, 12), 0); }
  assert.equal(f.stats().lockDepth, 0);
  const gate = loader.tryDllCallbackGate(competitor);
  assert.ok(gate, 'next thread can enter after completion'); gate.release();
  assert.deepEqual([...f.words.slice(f.gate / 4, f.gate / 4 + 2)], [0, 0]);
}

(async () => {
  nestedSync();
  for (const mode of ['false', 'throw', 'blocked']) rejectedInitializer(mode);
  await nestedAsync();
  console.log('PASS sync/async nested depth 3, self/repeated import, context/generation completion, rejection/fault/nonreturn, cross-thread exclusion and lock release (native ABI simulation)');
})().catch(error => { console.error(error); process.exitCode = 1; });
