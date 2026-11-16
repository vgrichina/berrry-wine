'use strict';
// GPU stream v2 for software GL in Threads mode.
//
// In a Threads run the guest instance executing GL is a Worker. WAT owns its
// WGL contexts (src/09a8cw-gl-wgl.wat): the instance's only GL flush is the
// 0x10008 mode query, which the Worker import (lib/guest-rpc.js) sends to the
// page as one glBatch; the page's gpu_gl_batch (lib/host-imports.js) answers
// with the host's glGps decision, and the instance's gl-gps producer
// (src/09a8gt-gl-gps.wat) turns on or stays off by itself.
//
//   guest GL -> real opengl32 thunk -> WAT encoder -> 0x10008 -> guest-rpc
//   Worker import -> main broker serveGlBatch -> host-imports gpu_gl_batch
//   -> tagged mode -> $glg_on -> GPS ring -> lib/gpu-stream-software.js
//
// Checks: exactly one glBatch crosses (the query) and every later GL call is
// answered in WAT; with gps the frame is drawn by the executor (DRAW_UPs and a
// PRESENT per swap, no readback), without it nothing reaches the ring; each
// arm's picture equals the same scene drawn in one (cooperative) instance.
const assert = require('assert');
const path = require('path');
const root = path.resolve(__dirname, '..');
const req = p => require(path.join(root, p));
const GS = req('lib/gpu-stream');
const { Executor } = req('lib/gpu-stream-software');
const { bootRenderHarness } = req('test/render-helper');
const Stream = req('lib/gl-command-stream');
const RPC = req('lib/guest-rpc');
const table = req('src/api_table.json');
const { comparePictures, bootGlGps } = req('test/helpers/gl-gps-context');

const WAT = String.raw`
 (func (export "probe_init")
   (global.set $thunk_guest_base (i32.add (global.get $image_base)
     (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
   (call $update_thunk_end))
 (func (export "probe_regs") (result i32) (global.get $reg_base))
 (func (export "probe_module") (param $name i32) (result i32)
   (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0)
     (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "probe_lookup") (param $module i32) (param $name i32) (result i32)
   (call $handle_GetProcAddress (local.get $module) (local.get $name)
     (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
   (i32.load (global.get $reg_base)))
 (func (export "probe_dc") (param $hwnd i32) (result i32)
   (call $handle_GetDC (i32.const 0) (i32.const 0) (i32.const 0)
     (i32.const 0) (i32.const 0) (i32.const 0))
   (drop (call $gdi_dc_set_field (i32.load (global.get $reg_base)) (i32.const 92) (local.get $hwnd) (i32.const 0)))
   (i32.load (global.get $reg_base)))
 (func (export "probe_invoke") (param $thunk i32) (result i32)
   (call $win32_dispatch (i32.div_u
     (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8)))
   (i32.load (global.get $reg_base)))
 (func (export "probe_window") (param $hwnd i32) (param $w i32) (param $h i32)
   (call $wnd_table_set (local.get $hwnd) (i32.const 0))
   (call $client_rect_set (local.get $hwnd) (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)))`;

// A real frame through the Worker import and the page's host, arm on vs off.
async function run(glGps) {
  const size = 16;
  let memory, worker = null, executor = null, ring = null, ringAddr = 0, pageBatch = null;
  const messages = [], answers = [];
  const h = await bootRenderHarness({ fonts: 'none', width: size, height: size, extraWat: WAT,
    beforeInstantiate(ctx, host) { ctx.glGps = glGps; pageBatch = host.gpu_gl_batch; },
    extraHostOverrides: {
      gpu_gl_call(op, at, bytes) {
        if (op === Stream.WAT_STREAM_FLUSH_OPCODE) return worker.imports.host.gpu_gl_call(op, at, bytes);
        if (op >= 0x20000 && op <= 0x20006) return 0;
        throw Error('unexpected host opcode ' + op);
      },
      gpu_stream_kick(addr, mode) {
        addr >>>= 0;
        if (!executor) executor = new Executor({ getExports: () => h.exports, getMemory: () => memory.buffer });
        if (!ring || ringAddr !== addr) { ring = new GS.Ring(() => memory.buffer, addr); ringAddr = addr; }
        GS.drain([ring], executor);
        if ((mode | 0) === GS.CONST.KICK_CLOSE) { executor.close(); executor = null; ring = null; ringAddr = 0; }
        return 1;
      },
    } });
  memory = h.memory;
  const e = h.exports, dv = () => new DataView(memory.buffer), wa = p => e.guest_to_wasm(p) >>> 0;
  e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000);
  const broker = RPC.createMainBroker(memory, { gpu_gl_batch: (batch, owner) => {
    const v = pageBatch(batch, owner); answers.push(v >>> 0); return v; } }, {});
  worker = RPC.createWorkerImports(memory, { gpu_gl_call: { params: ['i32', 'i32', 'i32'], results: ['i32'] } },
    message => { messages.push(message); broker.serveGlBatch(message); }, {});
  e.probe_window(42, size, size);
  e.probe_init();
  const regs = e.probe_regs(), stack = e.guest_alloc(256) >>> 0, stackWa = wa(stack);
  const str = s => { const p = e.guest_alloc(s.length + 1) >>> 0; new Uint8Array(memory.buffer, wa(p), s.length + 1).set(Buffer.from(s + '\0')); return p; };
  const gl32 = e.probe_module(str('opengl32.dll')) >>> 0; assert(gl32);
  const user32 = e.probe_module(str('user32.dll')) >>> 0; assert(user32);
  const cache = new Map();
  const call = (name, args = []) => {
    if (!cache.has(name)) {
      dv().setUint32(regs + 16, stack, true);
      cache.set(name, e.probe_lookup(/^(gl|wgl)/.test(name) ? gl32 : user32, str(name)) >>> 0);
    }
    const p = cache.get(name); assert(p, 'resolver: ' + name);
    assert.strictEqual(dv().getUint32(wa(p) + 4, true), table.find(a => a.name === name).id);
    dv().setUint32(regs + 16, stack, true); dv().setUint32(stackWa, 0x12345678, true);
    args.forEach((x, i) => dv().setUint32(stackWa + 4 + i * 4, x >>> 0, true));
    return e.probe_invoke(p) >>> 0;
  };
  const f = x => { const b = new DataView(new ArrayBuffer(4)); b.setFloat32(0, x, true); return b.getUint32(0, true); };
  const dc = e.probe_dc(42) >>> 0; assert(dc);
  const context = call('wglCreateContext', [dc]); assert(context);
  assert.strictEqual(call('wglMakeCurrent', [dc, context]), 1);
  assert.strictEqual(e.gl_sw_enabled(), 1, 'WAT enabled software GL on the guest instance');
  assert.strictEqual(e.gl_gps_active(), glGps ? 1 : 0, 'the page host decided the arm');
  call('glViewport', [0, 0, size, size]);
  for (let frame = 0; frame < 2; frame++) {
    call('glClearColor', [0.1, 0.2, 0.3, 1].map(f)); call('glClear', [0x4000]);
    call('glColor4f', [1, 0.5, 0, 1].map(f));
    call('glBegin', [4]);
    call('glVertex3f', [f(-0.8), f(-0.8), f(0)]);
    call('glVertex3f', [f(0.8), f(-0.6), f(0)]);
    call('glVertex3f', [f(0), f(0.8), f(0)]);
    call('glEnd');
    call('wglSwapBuffers', [dc]);
  }
  const stat = i => e.gl_gps_stat(i) >>> 0;
  const stats = { draws: stat(0), presents: stat(4), readbacks: stat(5), gpuFrames: stat(10), declines: stat(14) };
  if (glGps) e.gl_gps_sync_front();
  const entry = e.gl_sw_front() >>> 0; assert(entry);
  const d = dv(), dib = d.getUint32(entry + 20, true), pitch = d.getUint16(entry + 18, true);
  const px = new Uint32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) px[y * size + x] = d.getUint32(dib + y * pitch + x * 4, true) & 0xffffff;
  return { stats, messages, answers, pic: { w: size, h: size, px } };
}

(async () => {
  const off = await run(false);
  assert.strictEqual(off.stats.draws, 0, 'arm off: nothing on the ring');
  assert.strictEqual(off.messages.length, 1, 'one glBatch: the mode query');
  assert.deepStrictEqual(off.answers, [0x57470003], 'tagged mode: owned, gps decided off');
  const on = await run(true);
  assert(on.stats.draws > 0, 'arm on: draws on the ring ' + JSON.stringify(on.stats));
  assert.strictEqual(on.stats.presents, 2, 'one PRESENT per swap');
  assert.strictEqual(on.stats.declines, 0);
  assert.strictEqual(on.stats.readbacks, 0, 'no readback while drawing');
  assert.strictEqual(on.messages.length, 1, 'one glBatch: the mode query');
  assert.deepStrictEqual(on.answers, [0x57470007], 'tagged mode: owned, gps on');
  // The same scene in one instance (the cooperative shape): each Threads arm
  // must draw exactly what its cooperative arm draws. (The two arms differ
  // from each other on a few edge pixels of this triangle in either shape:
  // the executor's and 09a8g's edge rules, not the transport.)
  const coop = async gps => {
    const t = await bootGlGps({ gps, size: 16 });
    for (let frame = 0; frame < 2; frame++) {
      t.clear([0.1, 0.2, 0.3, 1]);
      t.prim(4, [{ x: -0.8, y: -0.8 }, { x: 0.8, y: -0.6 }, { x: 0, y: 0.8 }], [1, 0.5, 0, 1]);
      t.swap();
    }
    return t.front();
  };
  const cmpOff = comparePictures(off.pic, await coop(0), 0);
  assert(cmpOff.ok, 'arm off = cooperative software ' + JSON.stringify(cmpOff));
  const cmpOn = comparePictures(on.pic, await coop(1), 0);
  assert(cmpOn.ok, 'arm on = cooperative gps ' + JSON.stringify(cmpOn));
  console.log('PASS test-gl-gps-threads', JSON.stringify({ on: on.stats }));
})().catch(error => { console.error('FAIL test-gl-gps-threads:', error.stack || error); process.exit(1); });
