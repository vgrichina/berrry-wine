#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_find_class") (param $class i32) (param $wc i32)
    (drop (call $class_table_register_data
      (call $class_name_key (local.get $class)) (call $g2w (local.get $wc)))))
  (func (export "test_find_setup")
      (param $hwnd i32) (param $parent i32)
      (param $class i32) (param $title i32) (result i32)
    (local $atom i32)
    (local.set $atom
      (call $class_table_register (call $class_name_key (local.get $class))))
    (call $wnd_table_set (local.get $hwnd) (i32.const 0x00401000))
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
    (call $wnd_set_class_slot_from_name (local.get $hwnd) (local.get $class))
    (call $title_table_set
      (local.get $hwnd) (call $g2w (local.get $title))
      (call $lstr_len (local.get $title) (i32.const 0)))
    (local.get $atom))
  (func (export "test_find_window_a")
      (param $class i32) (param $title i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_FindWindowA
      (local.get $class) (local.get $title) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_find_window_w")
      (param $class i32) (param $title i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_FindWindowW
      (local.get $class) (local.get $title) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_find_window_ex_a")
      (param $parent i32) (param $after i32)
      (param $class i32) (param $title i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_FindWindowExA
      (local.get $parent) (local.get $after)
      (local.get $class) (local.get $title)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const { exports: e, hostCtx, module: harnessModule } = await bootRenderHarness({ extraWat, fonts: 'none' });
  // Keep the renderer attached: native/dialog children also exist only in
  // WAT tables. The source-slice lifecycle suite separately covers no renderer.

  const strA = value => {
    const bytes = Buffer.from(value + '\0', 'latin1');
    const guest = e.guest_alloc(bytes.length) >>> 0;
    bytes.forEach((byte, index) => e.guest_write8(guest + index, byte));
    return guest;
  };
  const strW = value => {
    const guest = e.guest_alloc((value.length + 1) * 2) >>> 0;
    for (let index = 0; index < value.length; index++) {
      const ch = value.charCodeAt(index);
      e.guest_write8(guest + index * 2, ch & 0xff);
      e.guest_write8(guest + index * 2 + 1, ch >>> 8);
    }
    e.guest_write8(guest + value.length * 2, 0);
    e.guest_write8(guest + value.length * 2 + 1, 0);
    return guest;
  };

  const mainClass = strA('FableMain');
  const otherClass = strA('OtherClass');
  const paneClass = strA('Pane');
  const deepClass = strA('DeepPane');
  const top1 = 0x10001;
  const top2 = 0x10002;
  const top3 = 0x10003;
  const child1 = 0x10011;
  const child2 = 0x10012;
  const grandchild = 0x10013;
  const foreignChild = 0x10021;

  const mainAtom = e.test_find_setup(
    top1, 0, mainClass, strA('Archive Manager')) >>> 0;
  e.test_find_setup(top2, 0, otherClass, strA('Second Window'));
  e.test_find_setup(top3, 0, mainClass, strA('Archive Manager'));
  e.test_find_setup(child1, top1, paneClass, strA('Files'));
  e.test_find_setup(child2, top1, paneClass, strA('Details'));
  e.test_find_setup(grandchild, child1, deepClass, strA('Nested'));
  e.test_find_setup(foreignChild, top2, paneClass, strA('Foreign'));

  assert.strictEqual(
    e.test_find_window_a(strA('fablemain'), strA('ARCHIVE MANAGER')) >>> 0,
    top3, 'FindWindowA compares class/title case-insensitively in Z order');
  assert.strictEqual(e.get_esp() >>> 0, 0x0030000c,
    'FindWindowA pops two stdcall arguments');
  assert.strictEqual(e.test_find_window_a(0, strA('second window')) >>> 0, top2,
    'a NULL class matches by title alone');
  assert.strictEqual(e.test_find_window_a(mainAtom, 0) >>> 0, top3,
    'a registered class atom selects the same top-level class');
  assert.strictEqual(e.test_find_window_a(0, 0) >>> 0, top3,
    'two NULL filters return the highest top-level window');
  assert.strictEqual(e.test_find_window_a(strA('Missing'), 0), 0,
    'an unknown class returns NULL');

  assert.strictEqual(e.test_find_window_w(
    strW('FABLEMAIN'), strW('archive manager')) >>> 0, top3,
  'FindWindowW reads UTF-16 filters instead of treating them as ANSI');
  assert.strictEqual(e.test_find_window_w(mainAtom, strW('ARCHIVE MANAGER')) >>> 0,
    top3, 'FindWindowW also accepts a class atom');

  assert.strictEqual(e.test_find_window_ex_a(
    top1, 0, strA('pane'), 0) >>> 0, child2,
  'FindWindowExA starts at the highest direct child');
  assert.strictEqual(e.test_find_window_ex_a(
    top1, child2, paneClass, 0) >>> 0, child1,
  'hwndChildAfter resumes at the next lower matching sibling');
  assert.strictEqual(e.test_find_window_ex_a(
    top1, child1, paneClass, 0), 0,
  'the child scan stops after the final sibling');
  assert.strictEqual(e.test_find_window_ex_a(
    top1, foreignChild, 0, 0), 0,
  'an hwndChildAfter from another parent is rejected');
  assert.strictEqual(e.test_find_window_ex_a(
    top1, 0, deepClass, 0), 0,
  'FindWindowEx searches direct children rather than all descendants');
  assert.strictEqual(e.test_find_window_ex_a(
    child1, 0, deepClass, strA('nested')) >>> 0, grandchild,
  'a nested parent can search its own direct children');
  assert.strictEqual(e.test_find_window_ex_a(
    0, top3, mainClass, 0) >>> 0, top1,
  'a NULL parent searches and resumes through top-level windows');
  assert.strictEqual(e.test_find_window_ex_a(
    0, 0x7777, 0, 0), 0,
  'a stale hwndChildAfter does not restart the top-level scan');
  assert.strictEqual(e.get_esp() >>> 0, 0x00300014,
    'FindWindowExA pops four stdcall arguments');

  e.wnd_z_set_after(top1, 0); // HWND_TOP
  assert.strictEqual(e.test_find_window_a(mainClass, 0) >>> 0, top1,
    'FindWindowA observes a live top-level Z-order change');
  assert.strictEqual(e.test_find_window_ex_a(
    0, top1, mainClass, 0) >>> 0, top3,
  'FindWindowExA resumes below the reordered top-level window');

  console.log('PASS FindWindowA/W and FindWindowExA search live USER window trees');

  // Use the actual browser host and shell, retaining old contexts explicitly:
  // WeakRef collection must never be the process-exit protocol.
  const fs = require('fs');
  const vm = require('vm');
  const { createHostImports } = require('../lib/host-imports');
  const sandbox = { console, URLSearchParams, setTimeout, clearTimeout,
    setInterval, clearInterval, window: {}, createHostImports };
  vm.runInNewContext(fs.readFileSync(require.resolve('../host.js'), 'utf8') +
    '\nglobalThis.WineAssembly = WineAssembly;', sandbox);
  const shell = require('../lib/browser-shell').createBrowserShell({ apps: {} });
  global.document = { getElementById: () => null };
  global.window = { addEventListener() {}, removeEventListener() {} };
  const renderer = hostCtx.renderer;
  renderer.windows = {};
  const retained = [];
  async function actualHost(pid) {
    const wine = new sandbox.WineAssembly();
    wine.renderer = renderer;
    wine.processId = pid;
    wine._multiApp = true;
    wine.logToUI = () => {};
    wine.memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
    const imports = wine.getImports();
    imports.host.memory = wine.memory;
    wine._hostImports = imports.host;
    wine.instance = await WebAssembly.instantiate(harnessModule, imports);
    renderer.wasm = wine.instance;
    renderer.wasmMemory = wine.memory;
    const context = wine.hostCtx;
    const ex = wine.instance.exports;
    const str = value => {
      const b = Buffer.from(value + '\0', 'latin1');
      const p = ex.guest_alloc(b.length) >>> 0;
      b.forEach((v, i) => ex.guest_write8(p + i, v));
      return p;
    };
    const find = (cls, title = null, parent = 0, after = 0) =>
      ex.test_find_window_ex_a(parent, after, cls === null ? 0 : str(cls),
        title === null ? 0 : str(title)) >>> 0;
    const make = (hwnd, cls, title, parent = 0, published = false) => {
      const c = str(cls), t = str(title);
      const wc = ex.guest_alloc(40);
      ex.guest_write32(wc + 36, c);
      ex.test_find_setup(hwnd, parent, c, t);
      ex.test_find_class(c, wc);
      if (published === 'native') {
        imports.host.register_dialog_frame(hwnd, 0, ex.guest_to_wasm(t), 100, 100, 0);
        imports.host.set_window_class(hwnd, ex.guest_to_wasm(c));
      } else if (published) {
        imports.host.create_window(hwnd, parent ? 0x50000000 : 0x90000000,
          10, 10, 100, 100, ex.guest_to_wasm(t), 0);
        imports.host.set_window_class(hwnd, ex.guest_to_wasm(c));
      }
    };
    retained.push({ wine, context, imports, ex });
    return { wine, context, imports, ex, make, find };
  }
  const old = await actualHost(4000);
  const detached = old.wine.getImports({ detached: true, instance: old.wine.instance });
  old.make(0x40001, 'RetiredApp', 'old native');
  old.make(0x40002, 'RetiredSurface', 'old surface', 0, true);
  const staleSurface = renderer.windows[0x40002];
  old.make(0x40003, 'RetiredNativeFrame', 'old native frame', 0, 'native');
  const staleNativeFrame = renderer.windows[0x40003];
  const foreign = await actualHost(5000);
  foreign.make(0x50001, 'LiveForeign', 'foreign native');
  foreign.make(0x50002, 'LiveDialog', 'foreign child', 0x50001);
  foreign.make(0x50003, 'LiveSurface', 'foreign surface', 0, true);
  foreign.make(0x50005, 'LiveNativeFrame', 'foreign native frame', 0, 'native');
  assert.strictEqual(old.find('LiveForeign'), 0x50001);
  assert.strictEqual(old.find('LiveDialog', null, 0x50001), 0x50002);
  const getForeignMemory = foreign.context.getMemory;
  foreign.context.getMemory = () => { throw new Error('active owner failure'); };
  assert.throws(() => old.find('LiveForeign'), /active owner failure/,
    'active-owner errors must propagate, not become an empty lookup');
  foreign.context.getMemory = getForeignMemory;
  foreign.make(0x50004, 'Destroyed', 'removed surface', 0, true);
  foreign.imports.host.destroy_window(0x50004);
  assert.strictEqual(old.find('Destroyed'), 0,
    'DestroyWindow retirement prevents a still-allocated WND from resurfacing');
  shell.runningApps.push({ wine: old.wine, name: 'old' });
  shell.stopAllApps();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.strictEqual(old.wine.memory, null, 'real stop releases old host memory');
  const relaunched = await actualHost(6000);
  assert.strictEqual(relaunched.find('RetiredApp'), 0,
    'relaunch must not query the strongly retained stopped context');
  assert.strictEqual(relaunched.find('LiveForeign'), 0x50001,
    'another active process with no surface remains visible');
  assert.strictEqual(relaunched.find('LiveDialog', null, 0x50001), 0x50002);
  assert.strictEqual(relaunched.find('LiveSurface'), 0x50003);
  assert.strictEqual(relaunched.find('LiveNativeFrame', 'foreign native frame'), 0x50005);
  renderer.windows[0x40002] = staleSurface;
  renderer.windows[0x40003] = staleNativeFrame;
  assert.strictEqual(relaunched.find('RetiredSurface'), 0,
    'retained stopped publications cannot resurrect their HWND');
  assert.strictEqual(relaunched.find('RetiredNativeFrame'), 0,
    'native register_dialog_frame publications also end at process exit');
  relaunched.make(0x40002, 'NewLifetime', 'new native');
  assert.strictEqual(relaunched.find('NewLifetime', 'new native'), 0x40002,
    'a stopped publication cannot hide a new owner using the same HWND');
  assert.strictEqual(relaunched.find('RetiredSurface'), 0);
  assert.strictEqual(detached.host.find_window(0, 0, 0, 0, 0), 0,
    'a retained detached thread context belongs to the exited process');
  let retireWorker;
  foreign.wine.guestWorker = { stop: () => new Promise(resolve => { retireWorker = resolve; }) };
  foreign.wine.stop();
  assert(foreign.wine.memory, 'worker retirement defers memory release');
  assert.strictEqual(relaunched.find('LiveForeign'), 0,
    'process exit ends native lookup before asynchronous memory release');
  assert.strictEqual(relaunched.find('LiveSurface'), 0,
    'process exit ends publication lookup before asynchronous memory release');
  assert.strictEqual(relaunched.find('LiveNativeFrame'), 0);
  retireWorker();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.strictEqual(foreign.wine.memory, null);
  relaunched.wine.stop();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.strictEqual(retained.length, 3, 'old hosts and contexts remain strongly referenced');
  delete global.document;
  delete global.window;
  console.log('PASS actualHost StopAll/stop/relaunch with retained contexts and live foreign owners');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
