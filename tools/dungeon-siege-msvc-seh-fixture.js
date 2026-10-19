'use strict';
// Native conformance preparation; run only in the granted bounded lane.
// Uses authentic MSVCRT _except_handler3, synthetic frames/filter code in a
// new allocation, production Win32 thunks and actual notepad fixture file bytes.
// Never loads, patches or executes Dungeon Siege. --observe adds unvalidated
// diagnostic-hook controls; the original two dispatch-mode controls passed.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = process.argv.find(a => a.startsWith('--root='))?.slice(7) || '/tmp/wa-recovery-20261014';
const { bootRenderHarness } = require(path.join(root, 'test/render-helper'));
const { loadDlls, _test: { findDllExport } } = require(path.join(root, 'lib/dll-loader'));
const extraWat = String.raw`
  (func (export "t_reserve") (result i32)
    (local $sp i32) (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_VirtualAlloc (i32.const 0) (i32.const 4096) (i32.const 0x2000) (i32.const 1) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp)) (i32.load (global.get $reg_base)))
  (func (export "t_translate") (param $ga i32) (result i32) (call $g2w (local.get $ga)))
  (func (export "t_sentinel") (result i32) (global.get $NULL_SENTINEL))
  (func (export "t_gated") (param $ga i32) (param $api i32) (result i32)
    (local $wa i32)
    (if (local.get $api)
      (then (global.set $api_handler_depth (i32.const 1)))
      (else (global.set $fault_raising (i32.const 1))))
    (local.set $wa (call $g2w (local.get $ga)))
    (global.set $api_handler_depth (i32.const 0))
    (global.set $fault_raising (i32.const 0))
    (local.get $wa))
  (func (export "t_thunk") (param $id i32) (result i32)
    (local $p i32) (local.set $p (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))))
    (i32.store (local.get $p) (i32.const 0)) (i32.store offset=4 (local.get $p) (local.get $id))
    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
    (i32.add (global.get $thunk_guest_base) (i32.sub (local.get $p) (global.get $THUNK_BASE))))
`;
const le = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255];
(async () => {
  const exeBytes = fs.readFileSync(path.join(root, 'test/binaries/notepad.exe'));
  const dllBytes = fs.readFileSync(path.join(root, 'test/binaries/dlls/msvcrt.dll'));
  assert.equal(crypto.createHash('sha256').update(dllBytes).digest('hex'), '887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1');
  const { exports: e, memory, hostCtx } = await bootRenderHarness({ extraWat, fonts: 'none', tailCalls: !process.argv.includes('--compat') });
  const observe = process.argv.includes('--observe'), events = [];
  if (observe) {
    assert.equal(typeof e.set_reserved_fault_observer, 'function', 'Requires rebuilt observer candidate');
    const { snapshotReservedFault } = require('./reserved-fault-observer');
    const layout = require(path.join(root, 'lib/region-map.generated'));
    hostCtx.reservedFaultObserver = event => events.push({ ...event, state: snapshotReservedFault(e, memory, layout, event) });
  }
  new Uint8Array(memory.buffer).set(exeBytes, e.get_staging()); assert(e.load_pe(exeBytes.length));
  const [dll] = loadDlls(e, memory.buffer, exeBytes, [{ name: 'msvcrt.dll', bytes: dllBytes }], null);
  assert(dll);
  const handler = findDllExport(e, memory.buffer, dll.loadAddr >>> 0, '_except_handler3') >>> 0;
  assert(handler, 'Authentic _except_handler3 export is mandatory, no fake handler fallback');
  const arena = e.guest_alloc(0x2000) >>> 0, frame = arena + 0x100, scope = arena + 0x200;
  const search = arena + 0x400, fill = arena + 0x500, body = arena + 0x700;
  const count = arena + 0x800, seen = count + 4, got = count + 8, success = count + 12, name = arena + 0x900;
  const w = a => e.guest_to_wasm(a) >>> 0, bytes = new Uint8Array(memory.buffer);
  // Guest writes retire previously decoded code when a filter is rewritten.
  // Raw Uint8Array.set bypasses that production invalidation path.
  const put = (a, data) => { for (let i = 0; i < data.length; i++) e.guest_write8(a + i, data[i]); };
  const word = (a, value) => e.guest_write32(a, value);
  const table = JSON.parse(fs.readFileSync(path.join(root, 'src/api_table.json'), 'utf8'));
  const api = n => { const id = table.findIndex(x => x.name === n); assert(id >= 0, n); return e.t_thunk(id) >>> 0; };
  const thunks = Object.fromEntries(['VirtualAlloc', 'CreateFileA', 'ReadFile', 'CloseHandle'].map(n => [n, api(n)]));
  e.seal_thunks();
  // VFS contains the actual immutable PE bytes; the filter reads them through
  // CreateFileA/ReadFile, not a host fill callback or patched memory accessor.
  const filePath = 'c:\\seh-file.bin';
  hostCtx.vfs.files.set(filePath, { data: new Uint8Array(exeBytes), attrs: 0x20 });
  put(name, Buffer.from('C:\\seh-file.bin\0', 'latin1'));
  put(search, [0xff, 0x05, ...le(count), 0x31, 0xc0, 0xc3]); // EXCEPTION_CONTINUE_SEARCH
  put(body, [0xcc, 0xc3]); // Must never enter an __except body for -1/0 filters.
  const originalChain = e.guest_read32(e.get_fs_base()) >>> 0;
  const stack = e.get_esp() >>> 0;
  const arm = level => {
    word(frame, 0xffffffff); word(frame + 4, handler); word(frame + 8, scope); word(frame + 12, level);
    word(scope, 0xffffffff); word(scope + 4, fill); word(scope + 8, body);
    word(scope + 12, 0); word(scope + 16, search); word(scope + 20, body);
    word(e.get_fs_base(), frame);
    for (const a of [count, seen, got, success]) word(a, 0);
    e.set_esp(stack - 0x1000); e.set_eip(0x00401000); e.set_eax(0x11223344); e.set_ebx(0x55667788);
  };
  // EBP is set by authentic _except_handler3 to frame+16, and [EBP-20]
  // contains EXCEPTION_POINTERS. Capture its fault address before real I/O.
  function filter(R, nestedAddress = null) {
    const code = [0x53, 0x8b, 0x45, 0xec, 0x8b, 0x00, 0x8b, 0x40, 0x18, 0xa3, ...le(seen)];
    const push = v => code.push(0x68, ...le(v));
    const call = n => code.push(0xb8, ...le(thunks[n]), 0xff, 0xd0);
    // A real guest load inside the active MSVC filter, not a host-injected
    // gating flag. It must produce a nested mode5 miss with raising=1.
    if (nestedAddress !== null) code.push(0xa1, ...le(nestedAddress));
    for (const a of [4, 0x1000, 4096, R]) push(a); call('VirtualAlloc');
    for (const a of [0, 0x80, 3, 0, 1, 0x80000000, name]) push(a); call('CreateFileA'); code.push(0x8b, 0xd8);
    for (const a of [0, got, 64, R]) push(a); code.push(0x53); call('ReadFile'); code.push(0xa3, ...le(success));
    code.push(0x53); call('CloseHandle'); code.push(0x83, 0xc8, 0xff, 0x5b, 0xc3); put(fill, code);
  }
  const R = e.t_reserve() >>> 0; assert(R); filter(R); arm(1);
  e.set_fault_unmapped(0);
  assert.equal(e.t_translate(R) >>> 0, e.t_sentinel() >>> 0); assert.equal(e.guest_read32(count), 0);
  e.set_fault_unmapped(5);
  if (observe) {
    // Setter does not select a fault mode; mode0 above still did no SEH work.
    assert.equal(events.length, 0);
    e.set_reserved_fault_observer(1);
  }
  const before = [e.get_eip(), e.get_esp(), e.get_eax(), e.get_ebx()];
  const translated = e.t_translate(R) >>> 0;
  assert.notEqual(translated, e.t_sentinel() >>> 0);
  assert.deepEqual([e.get_eip(), e.get_esp(), e.get_eax(), e.get_ebx()], before);
  assert.equal(e.guest_read32(count), 1, 'Inner search scope ran before outer commit scope');
  assert.equal(e.guest_read32(seen) >>> 0, R); assert.equal(e.guest_read32(success), 1); assert.equal(e.guest_read32(got), 64);
  assert.deepEqual(Buffer.from(bytes.subarray(translated, translated + 64)), exeBytes.subarray(0, 64));
  assert.equal(e.guest_read32(e.get_fs_base()) >>> 0, frame, 'ContinueExecution preserves chain');
  if (observe) {
    assert.deepEqual(events.map(x => x.phase), [1, 2]);
    assert.equal(events[0].id, events[1].id);
    assert.equal(events[0].state.contexts.fault.data.complete, false);
    assert.deepEqual(Buffer.from(events[1].state.contexts.fault.data.bytes), exeBytes.subarray(0, 64));
  }
  // Exhausted search: explicitly document mode5's unsupported/unhandled
  // sentinel fallback, without pretending it has full Windows AV semantics.
  const U = e.t_reserve() >>> 0; assert(U); arm(0); word(scope + 4, search);
  assert.equal(e.t_translate(U) >>> 0, e.t_sentinel() >>> 0);
  assert.equal(e.guest_read32(count), 1); assert.equal(e.guest_read32(got), 0);
  if (observe) {
    assert.deepEqual(events.slice(-2).map(x => x.phase), [1, 3]);
    for (const [api, outcome] of [[1, 5], [0, 6]]) {
      assert.equal(e.t_gated(U, api) >>> 0, e.t_sentinel() >>> 0);
      assert.deepEqual(events.slice(-2).map(x => x.phase), [1, outcome]);
      assert.equal(events.at(-2)[api ? 'apiDepth' : 'raising'], 1);
      assert.equal(e.guest_read32(count), 1, 'Skipped paths never invoke the filter');
    }
    const A = e.t_reserve() >>> 0; assert(A); arm(0);
    put(fill, [0x83, 0xc8, 0xff, 0xc3]); // ContinueExecution without committing.
    assert.equal(e.t_translate(A) >>> 0, e.t_sentinel() >>> 0);
    assert.deepEqual(events.slice(-2).map(x => x.phase), [1, 4]);
    assert.equal(events.at(-1).state.contexts.fault.data.complete, false);
    const O = e.t_reserve() >>> 0, N = e.t_reserve() >>> 0; assert(O && N);
    arm(1); filter(O, N); const start = events.length;
    const outerTranslated = e.t_translate(O) >>> 0;
    assert.notEqual(outerTranslated, e.t_sentinel() >>> 0);
    const nested = events.slice(start);
    assert.deepEqual(nested.map(x => x.phase), [1, 1, 6, 2]);
    assert.deepEqual(nested.map(x => x.address), [O, N, N, O]);
    assert.equal(nested[0].id, nested[3].id);
    assert.equal(nested[1].id, nested[2].id);
    assert(nested[1].id > nested[0].id);
    assert.equal(nested[1].raising, 1); assert.equal(nested[1].syncActive, 1);
    assert.equal(nested[0].raising, 0);
    assert.equal(nested[1].state.contexts.fault.data.complete, false);
    assert.deepEqual(Buffer.from(bytes.subarray(outerTranslated, outerTranslated + 64)), exeBytes.subarray(0, 64));
    arm(0); word(scope + 4, search);
    e.set_reserved_fault_observer(0); const n = events.length;
    assert.equal(e.t_translate(U) >>> 0, e.t_sentinel() >>> 0);
    assert.equal(events.length, n, 'Disabled hook preserves census and handler behavior');
    console.log('PASS observer pre/post real MSVC commit bytes, search failure, accepted/unmapped, genuine nested guest load, API/raise skips and disabled path.');
  }
  word(e.get_fs_base(), originalChain);
  console.log('PASS authentic MSVC scope search/commit with real file bytes; exhausted-search sentinel limitation explicitly observed.');
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
