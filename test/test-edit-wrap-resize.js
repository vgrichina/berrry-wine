#!/usr/bin/env node
// Direct WAT EDIT wrapping regression.
//
// A wrapped multiline edit's max scroll depends on current control geometry.
// After a resize that reduces the visual line count/max-scroll, WM_SIZE should
// clamp EditState.scroll_top immediately, before the next WM_PAINT.

'use strict';

const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');
const { mountBundledFonts } = require('./render-helper');
// $GUEST_BASE, from the map declared in src/00-regions.wat.
const RegionMap = require('../lib/region-map.generated.js');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');

const WM_SIZE = 0x0005;
const WM_MOUSEWHEEL = 0x020A;
const EM_GETFIRSTVISIBLELINE = 0x00CE;

const WS_CHILD = 0x40000000;
const WS_VISIBLE = 0x10000000;
const WS_HSCROLL = 0x00100000;
const WS_VSCROLL = 0x00200000;
const ES_MULTILINE = 0x0004;

const SB_HORZ = 0;
const SB_VERT = 1;
const SB_CTL = 2;
const SB_BOTH = 3;

async function main() {
  const baseline=process.argv.indexOf('--baseline-module');
  const wasmBytes = baseline>=0?fs.readFileSync(process.argv[baseline+1]):compileSrcWasm((name,source)=>name==='13-exports.wat'?source+`
    (func (export "test_edit_state") (param $h i32) (result i32)
      (call $wnd_get_state_ptr (local.get $h)))
  `:source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = {
    getMemory: () => memory.buffer,
    renderer: null,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} },
    onExit: () => {},
  };
  const base = createHostImports(ctx);
  // Wrapping is decided by $host_measure_text, and with no fonts in the VFS
  // every string measures 0 -- nothing is ever too wide, so the layout comes
  // back as one line no matter how narrow the control is. Must be after
  // createHostImports, which is what creates ctx.vfs.
  mountBundledFonts(ctx);
  base.host.memory = memory;
  base.host.create_thread = () => 0;
  base.host.exit_thread = () => 0;
  base.host.terminate_thread = () => 0;
  base.host.create_event = () => 0;
  base.host.set_event = () => 0;
  base.host.reset_event = () => 0;
  base.host.wait_single = () => 0;
  base.host.wait_multiple = () => 0;
  base.host.com_create_instance = () => 0x80004002;

  const { instance } = await WebAssembly.instantiate(wasmBytes, base);
  ctx.exports = instance.exports;
  const e = instance.exports;
  const u8 = new Uint8Array(memory.buffer);

  const wa = g => RegionMap.g2w(g, e.get_image_base());
  const writeStr = (s) => {
    const g = e.guest_alloc(s.length + 1);
    const p = wa(g);
    for (let i = 0; i < s.length; i++) u8[p + i] = s.charCodeAt(i);
    u8[p + s.length] = 0;
    return g;
  };

  const checks = [];
  function check(name, pass, info = '') {
    checks.push({ name, pass: !!pass, info });
    console.log((pass ? 'PASS  ' : 'FAIL  ') + name + (info ? `  (${info})` : ''));
  }

  const text = [
    'alpha bravo charlie delta echo foxtrot golf hotel india juliet',
    'kilo lima mike november oscar papa quebec romeo sierra tango',
    'uniform victor whiskey xray yankee zulu',
  ].join(' ');
  const style = WS_CHILD | WS_VISIBLE | WS_VSCROLL | ES_MULTILINE;
  const edit = e.test_create_edit(0, 0, 96, 40, style, writeStr(text));

  check('edit hwnd allocated', edit !== 0, `hwnd=0x${edit.toString(16)}`);
  check('initial text length matches', e.get_edit_text_len(edit) === text.length,
    `got ${e.get_edit_text_len(edit)} expected ${text.length}`);

  const narrowLines = e.test_edit_visual_line_count(edit);
  const narrowMax = e.test_edit_max_scroll(edit);
  check('narrow edit wraps into multiple visual lines', narrowLines >= 8,
    `lines=${narrowLines}`);
  check('narrow edit has scroll range', narrowMax > 0, `max=${narrowMax}`);

  const wheelDown = (-120 << 16);
  for (let i = 0; i < 12; i++) e.send_message(edit, WM_MOUSEWHEEL, wheelDown, 0);
  const scrolledTop = e.send_message(edit, EM_GETFIRSTVISIBLELINE, 0, 0);
  check('wheel scroll reaches narrow max', scrolledTop === narrowMax,
    `top=${scrolledTop} max=${narrowMax}`);

  e.ctrl_set_geom(edit, 0, 0, 280, 96);
  const staleBeforeSize = e.send_message(edit, EM_GETFIRSTVISIBLELINE, 0, 0);
  const wideLines = e.test_edit_visual_line_count(edit);
  const wideMax = e.test_edit_max_scroll(edit);
  check('wide resize reduces visual lines/max scroll', wideLines < narrowLines && wideMax < staleBeforeSize,
    `narrowLines=${narrowLines} wideLines=${wideLines} staleTop=${staleBeforeSize} wideMax=${wideMax}`);

  e.send_message(edit, WM_SIZE, 0, 280 | (96 << 16));
  const clampedTop = e.send_message(edit, EM_GETFIRSTVISIBLELINE, 0, 0);
  check('WM_SIZE clamps first visible line to resized max', clampedTop === wideMax,
    `top=${clampedTop} wideMax=${wideMax}`);

  const bars = e.test_create_edit(0, 0, 160, 80,
    WS_CHILD | WS_VISIBLE | WS_HSCROLL | WS_VSCROLL | ES_MULTILINE, 0);
  check('ShowScrollBar hides only the requested standard bar',
    e.test_show_scroll_bar(bars, SB_VERT, 0) === 1 &&
      (e.wnd_get_style_export(bars) & WS_VSCROLL) === 0 &&
      (e.wnd_get_style_export(bars) & WS_HSCROLL) !== 0);
  check('ShowScrollBar can hide and restore both standard bars',
    e.test_show_scroll_bar(bars, SB_BOTH, 0) === 1 &&
      (e.wnd_get_style_export(bars) & (WS_HSCROLL | WS_VSCROLL)) === 0 &&
      e.test_show_scroll_bar(bars, SB_BOTH, 1) === 1 &&
      (e.wnd_get_style_export(bars) & (WS_HSCROLL | WS_VSCROLL)) ===
        (WS_HSCROLL | WS_VSCROLL));
  check('ShowScrollBar SB_CTL updates window visibility',
    e.test_show_scroll_bar(bars, SB_CTL, 0) === 1 &&
      (e.wnd_get_style_export(bars) & WS_VISIBLE) === 0 &&
      e.test_show_scroll_bar(bars, SB_CTL, 1) === 1 &&
      (e.wnd_get_style_export(bars) & WS_VISIBLE) !== 0);
  check('ShowScrollBar rejects invalid handles and bar selectors',
    e.test_show_scroll_bar(0x7FFFFFFF, SB_VERT, 1) === 0 &&
      e.test_show_scroll_bar(bars, 99, 1) === 0);

  // A readonly native document must remain navigable past the scratch table.
  // Its final uniquely named line is reached by ordinary EM_SETSEL and
  // EM_SCROLLCARET, then observed through the same native viewport contract.
  const assert=require('node:assert/strict');
  const largeText=Array.from({length:3000},(_,i)=>`Row ${String(i).padStart(4,'0')} native document.\r\n`).join('')+'FINAL DOCUMENT LINE';
  const large=e.test_create_edit(0,0,300,96,style|0x800,writeStr(largeText));
  const total=e.test_edit_visual_line_count(large);
  assert.equal(total,3001,'wrapped document is not limited to the 384 scratch entries');
  e.send_message(large,0xb1,largeText.length,largeText.length);
  e.send_message(large,0xb7,0,0);
  assert(e.send_message(large,EM_GETFIRSTVISIBLELINE,0,0)>384,'native caret scroll reaches the tail');
  assert.equal(e.native_edit_viewport(large,0,0),1,'live native allocations validate');
  assert.equal(e.native_edit_viewport(large,5,0),total);
  const top=e.native_edit_viewport(large,3,0);
  const offset=e.native_edit_viewport(large,9,total-1-top);
  const length=e.native_edit_viewport(large,10,total-1-top);
  const pointer=e.native_user_text_ptr(large);
  assert.equal(Buffer.from(u8.subarray(pointer+offset,pointer+offset+length)).toString('latin1'),'FINAL DOCUMENT LINE');
  // The public adapter exposes the viewport explicitly and hashes ALL bytes,
  // including offscreen replacements. No prefix pretends to be a full title.
  const {withNativeUserChildren,qualifiedEditViewport}=require('../lib/cli-native-user-windows');
  const observe=()=>withNativeUserChildren([{hwnd:'0x'+large.toString(16),live:true,visible:true,
    isChild:false,style:(style|0x800)>>>0,generation:String(e.wnd_lookup_generation(large)),
    processId:e.get_process_id(),threadId:e.get_window_thread(large)}],
    {windows:{[large]:{wasm:instance}}},memory)[0];
  const observed=observe();assert(qualifiedEditViewport({...observed,controlClass:2}));
  assert.equal(observed.nativeTextComplete,false);assert.equal(observed.title,null);
  assert(observed.nativeEditViewport.lines.some(line=>line.text==='FINAL DOCUMENT LINE'));
  const oldHash=observed.nativeEditViewport.documentSHA256;
  e.send_message(large,0xb1,10,20);
  const selection=observe();assert.equal(selection.nativeEditViewport.cursor,20);
  assert.equal(selection.nativeEditViewport.selectionAnchor,10);
  e.send_message(large,0xc,0,writeStr('X'+largeText.slice(1)));
  assert.equal(observe().nativeTextAvailable,false,'stale canonical layout refuses');
  e.test_edit_visual_line_count(large);
  assert.notEqual(observe().nativeEditViewport.documentSHA256,oldHash,'offscreen replacement changes the context');
  const setTextHash=observe().nativeEditViewport.documentSHA256;
  e.send_message(large,0xb1,0,1);
  e.send_message(large,0xc2,0,writeStr('Z'));
  assert.equal(observe().nativeTextAvailable,false,'EM_REPLACESEL invalidates the old layout');
  e.test_edit_visual_line_count(large);
  const replaced=observe();
  assert.equal(replaced.nativeTextAvailable,true,JSON.stringify(replaced.nativeEditViewportDiagnostic));
  assert.notEqual(replaced.nativeEditViewport.documentSHA256,setTextHash,'programmatic readonly replacement changes the document');
  assert.equal(e.get_edit_cursor(large),1);
  const state=e.test_edit_state(large),original=[0,4,8].map(offset=>e.guest_read32(state+offset));
  for(const [field,value] of [[4,-1],[4,original[2]+1],[8,0x7fffffff],[0,0],
      [0,original[0]+8],[0,0x7ffffffc]]){
    e.guest_write32(state+field,value);
    assert(e.native_edit_viewport(large,0,0)<0,`malformed native field ${field}=${value} refuses`);
    [0,4,8].forEach((offset,i)=>e.guest_write32(state+offset,original[i]));
  }
  const freed=e.guest_alloc(original[1]+1);e.guest_free(freed);
  e.guest_write32(state,freed);
  assert(e.native_edit_viewport(large,0,0)<0,'a freed exact allocation is not a live document');
  e.guest_write32(state,original[0]);
  e.guest_write8(original[0]+original[1],65);
  assert.equal(e.native_edit_viewport(large,0,0),-6,'missing NUL refuses before layout');
  e.guest_write8(original[0]+original[1],0);
  const secret=e.test_create_edit(0,0,300,96,style|0x820,writeStr(largeText));
  assert.equal(e.native_edit_viewport(secret,0,0),-1,'password refuses before buffer access');
  check('native malformed lengths, capacities, interior/stale/unmapped pointers and password refuse',true);
  check('large native readonly Edit layout, tail navigation, viewport, selection and replacement',true);

  console.log(`${checks.filter(c => c.pass).length}/${checks.length} checks passed`);
  if (checks.some(c => !c.pass)) process.exit(1);
}

main().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
