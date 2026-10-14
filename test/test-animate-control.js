#!/usr/bin/env node
'use strict';

// SysAnimate32 (src/09c3-wndprocs6-animate.wat) end to end over a tiny RLE8
// AVI built here: open through the AVI reader's memory source (the path an
// "AVI" resource takes), size-to-clip, WM_TIMER playback with its ACN_START /
// ACN_STOP, seeking backwards through retained RLE8 deltas, the threaded
// (no ACS_TIMER) player driven by the host clock with a posted ACN_STOP,
// ACS_TRANSPARENT keying, and close.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const RegionMap = require('../lib/region-map.generated.js');

const extraWat = String.raw`
  (func (export "t_create_animate") (param $style i32) (result i32)
    (local $top i32)
    (local.set $top (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $host_register_dialog_frame
      (local.get $top) (i32.const 0) (i32.const 0)
      (i32.const 80) (i32.const 60) (i32.const 0))
    (call $wnd_table_set (local.get $top) (global.get $WNDPROC_CTRL_NATIVE))
    (drop (call $wnd_set_style (local.get $top) (i32.const 0x90000000)))
    (call $ctrl_create_child (local.get $top) (i32.const 34) (i32.const 100)
      (i32.const 4) (i32.const 4) (i32.const 0) (i32.const 0)
      (i32.or (i32.const 0x50000000) (local.get $style)) (i32.const 0)))

  ;; ACM_OPEN of AVI bytes already in guest memory, through the same memory
  ;; source $anim_open_source uses for an "AVI" resource.
  (func (export "t_open_memory") (param $hwnd i32) (param $ga i32) (param $len i32) (result i32)
    (local $state i32)
    (drop (call $wnd_send_message (local.get $hwnd) (i32.const 0x0464) (i32.const 0) (i32.const 0)))
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (call $anim_open (local.get $hwnd) (cast ptr<AnimateState> (call $g2w (local.get $state)))
      (call $avi_open_memory (local.get $ga) (local.get $len))))

  (func (export "t_acn_start") (result i32) (global.get $anim_dbg_acn_start))
  (func (export "t_acn_stop") (result i32) (global.get $anim_dbg_acn_stop))
  (func (export "t_last_open") (result i32) (global.get $anim_dbg_last_open))
  (func (export "t_live_count") (result i32) (global.get $anim_live_count))
  (func (export "t_service") (call $anim_service))
  ;; GetPixel on the control's DC: what the WAT rasterizer holds.
  (func (export "t_get_pixel") (param $hwnd i32) (param $x i32) (param $y i32) (result i32)
    (local $desc i32) (local $hdc i32)
    (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
    (local.set $desc (global.get $GDI_BLIT_DST_DESC))
    (if (result i32) (call $gdi_surface_descriptor (local.get $hdc) (local.get $desc))
      (then (call $gdi_raster_get_pixel (local.get $desc)
        (call $gdi_line_map_x (local.get $desc) (local.get $x))
        (call $gdi_line_map_y (local.get $desc) (local.get $y))))
      (else (i32.const -1))))
`;

// ---- a 8x4 RLE8 clip, three frames at 10 fps ----
// Palette: 0 blue (the transparent key), 1 red, 2 green.
// Frame 0 (key): all red, top-left pixel blue.
// Frame 1 (delta): top-left 2x2 green.
// Frame 2 (delta): bottom-right pixel blue.
const W = 8, H = 4;
const FRAMES = [
  // bottom-up rows; each ends with EOL, the frame with EOB
  [8, 1, 0, 0, 8, 1, 0, 0, 8, 1, 0, 0, 1, 0, 7, 1, 0, 1],
  [0, 0, 0, 0, 2, 2, 0, 0, 2, 2, 0, 1],
  [7, 1, 1, 0, 0, 1],
];

function fourcc(s) { return Buffer.from(s, 'latin1'); }
function u32(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; }
function u16(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; }
function chunk(id, body) {
  const pad = body.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0);
  return Buffer.concat([fourcc(id), u32(body.length), body, pad]);
}
function list(type, parts) {
  const body = Buffer.concat([fourcc(type), ...parts]);
  return Buffer.concat([fourcc('LIST'), u32(body.length), body]);
}

function buildAvi() {
  const avih = Buffer.concat([
    u32(100000), u32(0), u32(0), u32(0x10), u32(FRAMES.length), u32(0), u32(1),
    u32(256), u32(W), u32(H), u32(0), u32(0), u32(0), u32(0)]);
  const strh = Buffer.concat([
    fourcc('vids'), fourcc('RLE '), u32(0), u16(0), u16(0), u32(0),
    u32(1), u32(10), u32(0), u32(FRAMES.length), u32(256), u32(0xFFFFFFFF), u32(0),
    u16(0), u16(0), u16(W), u16(H)]);
  const palette = Buffer.alloc(256 * 4);
  palette.set([255, 0, 0, 0], 0);   // BGRX blue
  palette.set([0, 0, 255, 0], 4);   // red
  palette.set([0, 255, 0, 0], 8);   // green
  const strf = Buffer.concat([
    u32(40), u32(W), u32(H), u16(1), u16(8), u32(1 /* BI_RLE8 */), u32(0),
    u32(0), u32(0), u32(256), u32(0), palette]);
  const hdrl = list('hdrl', [chunk('avih', avih),
    list('strl', [chunk('strh', strh), chunk('strf', strf)])]);
  const frameChunks = FRAMES.map(f => chunk('00dc', Buffer.from(f)));
  const movi = list('movi', frameChunks);
  // idx1 offsets are relative to the 'movi' fourcc.
  let off = 4;
  const idx = frameChunks.map((c, i) => {
    const e = Buffer.concat([fourcc('00dc'), u32(i === 0 ? 0x10 : 0), u32(off), u32(FRAMES[i].length)]);
    off += c.length;
    return e;
  });
  const body = Buffer.concat([fourcc('AVI '), hdrl, movi, chunk('idx1', Buffer.concat(idx))]);
  return Buffer.concat([fourcc('RIFF'), u32(body.length), body]);
}

const RED = [255, 0, 0], GREEN = [0, 255, 0], BLUE = [0, 0, 255], FACE = [192, 192, 192];

(async () => {
  let ticks = 1000;
  const h = await bootRenderHarness({ extraWat, width: 96, height: 64, fonts: 'none',
    extraHostOverrides: { get_ticks: () => ticks } });
  const e = h.exports;
  e.init_thread(0, 0, 0, 0, 0, 0, 0, 0x1000);

  const avi = buildAvi();
  const ga = e.guest_alloc(avi.length) >>> 0;
  new Uint8Array(h.memory.buffer, RegionMap.GUEST_BASE + ga, avi.length).set(avi);

  const open = (style) => {
    new Uint8Array(h.memory.buffer, RegionMap.GUEST_BASE + ga, avi.length).set(avi);
    const hwnd = e.t_create_animate(style) >>> 0;
    assert(hwnd, 'SysAnimate32 child created');
    assert.strictEqual(e.t_open_memory(hwnd, ga, avi.length), 1, 'ACM_OPEN of the RLE8 clip');
    assert.strictEqual(e.t_last_open(), 1);
    // The source may be a DLL resource retired as soon as ACM_OPEN returns.
    // All later frame reads must use the AVI record's owned storage.
    new Uint8Array(h.memory.buffer, RegionMap.GUEST_BASE + ga, avi.length).fill(0);
    return hwnd;
  };
  // What the control's DC holds (GetPixel), as [r, g, b].
  const pixel = (hwnd, x, y) => {
    const c = e.t_get_pixel(hwnd, x, y) >>> 0;
    return [c & 0xFF, (c >> 8) & 0xFF, (c >> 16) & 0xFF];
  };
  const paint = (hwnd) => e.send_message(hwnd, 0x000F, 0, 0);
  const play = (hwnd, repeat, from, to) => e.send_message(hwnd, 0x0465, repeat, (to << 16) | from);
  const playing = (hwnd) => e.send_message(hwnd, 0x0468, 0, 0);
  const timer = (hwnd) => e.send_message(hwnd, 0x0113, 1, 0);

  // ---- ACS_TIMER: the message-loop player ----
  const a = open(8);
  assert.strictEqual(e.ctrl_get_wh(a) >>> 0, W | (H << 16), 'without ACS_CENTER the control takes the clip size');
  paint(a);
  assert.deepStrictEqual(pixel(a, 0, 0), BLUE, 'frame 0 top-left');
  assert.deepStrictEqual(pixel(a, 3, 1), RED, 'frame 0 body');
  assert.strictEqual(play(a, 5, 6, 7), 0, 'ACM_PLAY past the last frame fails');
  assert.strictEqual(e.t_acn_start(), 0);

  assert.strictEqual(play(a, 1, 0, 0xFFFF), 1, 'ACM_PLAY once, 0..last');
  assert.strictEqual(e.t_acn_start(), 1, 'ACN_START sent');
  assert.strictEqual(playing(a), 1, 'ACM_ISPLAYING');
  assert.strictEqual(e.t_live_count(), 0, 'an ACS_TIMER play does not use the threaded player');
  timer(a); paint(a);
  assert.deepStrictEqual(pixel(a, 1, 1), GREEN, 'frame 1 delta applied');
  assert.deepStrictEqual(pixel(a, 7, 3), RED, 'frame 1 leaves the rest of frame 0');
  timer(a); paint(a);
  assert.deepStrictEqual(pixel(a, 7, 3), BLUE, 'frame 2 delta applied');
  assert.deepStrictEqual(pixel(a, 0, 0), GREEN, 'frame 2 keeps frame 1');
  assert.strictEqual(e.t_acn_stop(), 1, 'ACN_STOP after the one repeat');
  assert.strictEqual(playing(a), 0);

  // A one-frame play is a seek: no notification, and going back rewinds the
  // retained RLE8 plane to the keyframe.
  assert.strictEqual(play(a, 1, 0, 0), 1);
  paint(a);
  assert.deepStrictEqual(pixel(a, 0, 0), BLUE, 'seek back to frame 0');
  assert.deepStrictEqual(pixel(a, 7, 3), RED);
  assert.strictEqual(e.t_acn_start(), 1, 'a seek sends no ACN_START');
  assert.strictEqual(e.send_message(a, 0x0466, 0, 0), 1, 'ACM_STOP when idle');
  assert.strictEqual(e.t_acn_stop(), 1, 'stopping an idle control sends no ACN_STOP');

  // ---- threaded player (no ACS_TIMER): runs off the host clock ----
  const b = open(0);
  assert.strictEqual(play(b, -1, 0, 0xFFFF), 1);
  assert.strictEqual(e.t_acn_start(), 2);
  assert.strictEqual(e.t_live_count(), 1, 'the play is on the threaded player');
  assert.deepStrictEqual(pixel(b, 0, 0), BLUE, 'first frame painted without a WM_PAINT');
  e.t_service();
  assert.deepStrictEqual(pixel(b, 1, 1), RED, 'nothing due before the frame interval');
  ticks += 100;
  e.t_service();
  assert.deepStrictEqual(pixel(b, 1, 1), GREEN, 'frame 1 painted by the service');
  ticks += 200;   // frames 2 and 0 (repeat forever wraps)
  e.t_service();
  assert.deepStrictEqual(pixel(b, 0, 0), BLUE, 'looped back to frame 0');
  assert.deepStrictEqual(pixel(b, 7, 3), RED);
  assert.strictEqual(e.send_message(b, 0x0466, 0, 0), 1, 'ACM_STOP');
  assert.strictEqual(e.t_acn_stop(), 2, 'ACN_STOP on ACM_STOP');
  assert.strictEqual(e.t_live_count(), 0);

  // A threaded play that runs out posts its ACN_STOP rather than sending it.
  const c = open(0);
  const depth = e.post_queue_depth() | 0;
  assert.strictEqual(play(c, 1, 0, 0xFFFF), 1);
  ticks += 1000;
  e.t_service();
  assert.strictEqual(playing(c), 0, 'the single repeat finished');
  assert.strictEqual(e.t_acn_stop(), 3);
  assert.strictEqual(e.post_queue_depth() | 0, depth + 1, 'ACN_STOP was posted');
  assert.strictEqual(e.post_queue_peek(depth, 1) >>> 0, 0x0111, 'as WM_COMMAND');
  assert.strictEqual(e.post_queue_peek(depth, 2) >>> 0, (2 << 16) | 100, 'MAKEWPARAM(id, ACN_STOP)');
  assert.strictEqual(e.post_queue_peek(depth, 3) >>> 0, c, 'from the control');
  assert.deepStrictEqual(pixel(c, 7, 3), BLUE, 'the last frame stays up');

  // ---- ACS_TRANSPARENT: frame 0's first pixel is the key ----
  const t = open(2 | 8);
  paint(t);
  assert.deepStrictEqual(pixel(t, 0, 0), FACE, 'the keyed pixel shows the background');
  assert.deepStrictEqual(pixel(t, 1, 0), RED, 'other pixels are opaque');

  // ---- close ----
  assert.strictEqual(e.send_message(a, 0x0464, 0, 0), 1, 'ACM_OPEN(NULL) closes');
  paint(a);
  assert.deepStrictEqual(pixel(a, 0, 0), FACE, 'a closed control paints its background');
  assert.strictEqual(play(a, 1, 0, 0xFFFF), 0, 'nothing to play after close');

  console.log('PASS  SysAnimate32: RLE8 open/size, WM_TIMER and threaded playback, ACN_START/ACN_STOP, seek, transparency, close');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
