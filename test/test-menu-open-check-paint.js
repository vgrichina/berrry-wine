#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

// Public resource setup and x86 stdcall dispatch on the canonical module.
// Keep the real renderer, host invalidation, WAT painter and RasterCanvas.
// No private menu writes, extra exports or source transformations.
function fixture() {
  const b = makeFixture(), raw = rva => rva - 0x1000 + 0x200;
  const w = (rva, n) => b.writeUInt32LE(n >>> 0, raw(rva));
  // RT_MENU -> two resource IDs -> language -> data entries.
  b.writeUInt32LE(0x2200, 0x80 + 24 + 112);
  b.writeUInt32LE(0x400, 0x80 + 24 + 116);
  b.writeUInt16LE(1, raw(0x220e)); w(0x2210, 4); w(0x2214, 0x80000020);
  b.writeUInt16LE(2, raw(0x222e));
  for (let i = 0; i < 2; i++) {
    w(0x2230 + i * 8, 301 + i); w(0x2234 + i * 8, 0x80000040 + i * 24);
    const lang = 0x2240 + i * 24;
    b.writeUInt16LE(1, raw(lang + 14)); w(lang + 16, 1033); w(lang + 20, 0x80 + i * 16);
    let p = 0x2400 + i * 0x100;
    const start = p;
    const u16 = n => { b.writeUInt16LE(n, raw(p)); p += 2; };
    const str = s => { for (const c of s) u16(c.charCodeAt(0)); u16(0); };
    u16(0); u16(0); u16(0x90); str('File');
    u16(0); u16(600); str('Target');
    u16(0x10); str('Branch');
    u16(0x80); u16(601); str('Leaf');
    u16(0x80); u16(602); str('Last');
    w(0x2280 + i * 16, start); w(0x2284 + i * 16, p - start);
  }
  return b;
}

(async () => {
  const moduleBytes = fs.readFileSync(process.env.MENU_TEST_MODULE || 'build/wine-assembly.wasm');
  console.log('module sha256', crypto.createHash('sha256').update(moduleBytes).digest('hex'));
  const { exports: e, memory, renderer, canvas } = await bootRenderHarness({ fonts: 'none', width: 640, height: 480,
    prebuiltModule: new WebAssembly.Module(moduleBytes) });
  const pe = fixture();
  new Uint8Array(memory.buffer).set(pe, e.get_staging()); assert(e.load_pe(pe.length)); e.set_api_log(0);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const w = (p, n) => e.guest_write32(p, n), r = p => e.guest_read32(p) >>> 0;
  const read = (p, n) => Buffer.from(new Uint8Array(memory.buffer, e.guest_to_wasm(p) >>> 0, n));
  const str = s => { const p = alloc(s.length + 1); Buffer.from(s + '\0').forEach((v, i) => e.guest_write8(p + i, v)); return p; };
  const frame = alloc(512), stack = frame + 128;
  let calls = 0;
  function call(entry, args) {
    const regs = ['ebx', 'ebp', 'esi', 'edi'], values = [0x13579bdf, 0x2468ace0, 0x3579bdf1, 0x468ace02];
    regs.forEach((k, i) => e['set_' + k](values[i]));
    for (let i = 0; i < 512; i += 4) w(frame + i, 0x5ac1d00d);
    w(stack, 0); args.forEach((v, i) => w(stack + 4 + i * 4, v));
    const before = read(frame, 512);
    e.set_esp(stack); e.clear_yield(); e.set_eip(entry);
    for (let i = 0; i < 32 && e.get_eip(); i++) e.run(32);
    assert.equal(e.get_eip(), 0, 'guest return');
    assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, 'stdcall ESP');
    assert.deepEqual(regs.map(k => e['get_' + k]() >>> 0), values, 'nonzero preserved registers');
    assert.deepEqual(read(frame, 512), before, 'stack and neighboring guards');
    calls++; return e.get_eax() >>> 0;
  }
  const dll = call(r(iat('LoadLibraryA')), [str('user32.dll')]); assert(dll);
  const entries = {};
  function api(name, ...args) {
    if (!entries[name]) { entries[name] = call(r(iat('GetProcAddress')), [dll, str(name)]); assert(entries[name], name); }
    return call(entries[name], args);
  }

  assert.equal(canvas.constructor.name, 'RasterCanvas');
  const windows = [], menus = [], popups = [];
  for (let i = 0; i < 2; i++) {
    const hwnd = api('CreateWindowExA', 0, str('STATIC'), str('Menu owner'),
      0x10cf0000, 20 + i * 300, 30, 280, 250, 0, 0, 0x400000, 0);
    assert(hwnd); windows.push(hwnd);
    const menu = api('LoadMenuA', 0x400000, 301 + i); assert(menu);
    assert.equal(api('SetMenu', hwnd, menu), 1);
    const attached = api('GetMenu', hwnd); menus.push(attached);
    popups.push(api('GetSubMenu', attached, 0));
  }
  console.log(JSON.stringify({windows,menus,popups,counts:windows.map(h=>e.menu_child_count(h,0))}));
  const failures = [];
  const pixels = (x,y,w,h) => Buffer.from(canvas.getContext('2d').getImageData(x,y,w,h).data);
  const equal = (actual, expected, label) => {
    const pass = Buffer.isBuffer(expected) ? actual.equals(expected) : actual === expected;
    console.log(JSON.stringify({label, pass, actual: Buffer.isBuffer(actual) ? crypto.createHash('sha256').update(actual).digest('hex') : actual}));
    if (!pass) failures.push(label);
  };
  function flush() { renderer.flushRepaint(); }
  function open(i) {
    const bar = renderer._menuBarPos(renderer.windows[windows[i]]);
    renderer.handleMouseDown(bar.barX + 10, bar.barY + 8, 0);
    renderer.handleMouseUp(bar.barX + 10, bar.barY + 8, 0);
    flush(); assert.equal(e.menu_open_hwnd(), windows[i]); assert.equal(e.menu_open_top(), 0);
    return renderer._openMenuGeometry();
  }
  function close() { renderer.handleKeyDown(27); renderer.handleKeyUp(27); flush(); assert.equal(e.menu_open_top(), -1); }
  function glyph(rect, row) { return pixels(rect.x + 4, rect.y + 2 + row * 20 + 5, 12, 12); }
  function blackCount(buf) { let n=0; for(let i=0;i<buf.length;i+=4) if(buf[i]===0 && buf[i+1]===0 && buf[i+2]===0 && buf[i+3]===255)n++; return n; }
  let geom = open(1), rect = geom.rects[0];
  const unchecked = glyph(rect,0); assert.equal(blackCount(unchecked),0);
  const cache = renderer._dropdownOverlayPaintState;
  renderer.scheduleRepaint(); flush(); assert.equal(renderer._dropdownOverlayPaintState, cache, 'unchanged cache reused');
  assert.equal(api('CheckMenuItem', popups[1], 0, 0x408), 0);
  assert.equal(api('GetMenuState', popups[1], 0, 0x400),8);
  assert.equal(api('GetMenuState', popups[0], 0, 0x400),0);
  assert(renderer._repaintScheduled, 'actual CheckMenuItem host invalidation schedules composite');
  flush(); equal(blackCount(glyph(rect,0)) > 0, true, 'open dropdown check glyph');
  equal(e.menu_open_hwnd(), windows[1], 'same open owner');
  equal(e.menu_open_hover(), -1, 'same hover');
  const checkedCache = renderer._dropdownOverlayPaintState;
  const checkedPixels = glyph(rect,0);
  assert.equal(api('CheckMenuItem', popups[1], 0, 0x408), 8);
  flush();
  assert.equal(renderer._dropdownOverlayPaintState, checkedCache, 'same checked state reuses cache');
  equal(glyph(rect,0), checkedPixels, 'same state retains checked pixels');
  assert.equal(api('CheckMenuItem', popups[0], 0, 0x408),0); flush();
  assert.equal(renderer._dropdownOverlayPaintState, checkedCache, 'neighbor mutation reuses displayed cache');
  assert.equal(api('CheckMenuItem', popups[1], 600, 0),8); flush();
  equal(glyph(rect,0), unchecked, 'open dropdown uncheck restores glyph area');
  // Opening the cascade changes hover only through normal renderer input.
  renderer.handleMenuHover(rect.x + 35, rect.y + 32); renderer.handleMouseMove(rect.x + 35, rect.y + 32); flush();
  geom = renderer._openMenuGeometry(); assert.equal(geom.rects.length,2);
  const sub = geom.rects[1], leafUnchecked = glyph(sub,0);
  assert.equal(blackCount(leafUnchecked),0);
  const cascadeCache = renderer._dropdownOverlayPaintState;
  renderer.scheduleRepaint(); flush(); assert.equal(renderer._dropdownOverlayPaintState,cascadeCache);
  assert.equal(api('CheckMenuItem', menus[1], 601, 8),0);
  assert.equal(api('GetMenuState', menus[1], 601, 0),8);
  assert.equal(api('GetMenuState', menus[0], 601, 0),0);
  assert(renderer._repaintScheduled); flush();
  equal(blackCount(glyph(sub,0)) > 0,true,'open cascade check glyph');
  equal(e.menu_open_hover(),1,'cascade remains open on same row');
  assert.equal(api('CheckMenuItem', menus[1], 601, 0),8); flush();
  equal(glyph(sub,0),leafUnchecked,'open cascade uncheck restores glyph area');
  close(); assert.equal(renderer._dropdownOverlayPaintState,null,'closed composite retires cache');
  geom=open(0); equal(blackCount(glyph(geom.rects[0],0)) > 0,true,'neighbor retained independent checked glyph');
  close(); api('DestroyWindow',windows[0]);
  geom=open(1); equal(blackCount(glyph(geom.rects[0],0)),0,'surviving owner reopened unchecked');
  close(); api('DestroyWindow',windows[1]); flush();
  assert.equal(Object.keys(renderer.windows).length,0,'owners retired');
  console.log(JSON.stringify({calls,failures}));
  assert.deepEqual(failures,[],'public open-menu check pixel regression');
  console.log('PASS public open dropdown/cascade checked pixels, neighbor cache and lifetime controls');
})().catch(error => { console.error(error.stack || error); process.exitCode=1; });
