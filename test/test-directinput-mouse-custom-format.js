'use strict';

// Full production x86 -> published COM vtables -> dispatcher -> real input host.
// The RPC variant uses the production synchronous broker in process.
const assert = require('node:assert/strict');
const fs = require('node:fs'), crypto = require('node:crypto');
const { bootRenderHarness } = require('./render-helper');
const RPC = require('../lib/guest-rpc');
const signatures = require('../lib/host-import-sigs.generated.json').sigs;
const regions = require('../lib/region-map.generated');
const apis = require('../src/api_table.json');
const zlib = require('node:zlib');

// Frozen before baseline: reordered relative XYZ, all three buttons and an
// optional absent fourth button. No expected bytes come from implementation.
const objects = [[1, 0x50c], [20, 0x203], [12, 3], [28, 0x30c],
  [3, 0x40c], [4, 0x103], [30, 0x8000060c]];
const initial = '008000800700000000000000f5ffffff0000000010ffffff0000000080000000';
const held = '0080008000000000000000000000000000000000000000000000000080000000';
const events = [[12, -11], [4, 7], [20, -120], [20, -120], [28, 128], [3, 128], [1, 128]];
const failures = [];
let checks = 0;
function equal(actual, expected, name) {
  checks++;
  try { assert.deepEqual(actual, expected, name); }
  catch (error) { failures.push({ name, actual, expected }); }
}

(async () => {
  const wasm = process.argv[2] ? fs.readFileSync(process.argv[2]) : require('./compile-src').compileSrcWasm();
  const bytes = wasm[0] === 0x1f ? zlib.gunzipSync(wasm) : wasm;
  console.log('production module SHA256=' + crypto.createHash('sha256').update(bytes).digest('hex'));
  if (process.env.DI_MOUSE_MODULE_OUT) fs.writeFileSync(process.env.DI_MOUSE_MODULE_OUT, zlib.gzipSync(bytes));
  const module = await WebAssembly.compile(bytes);
  for (const rpc of [false, true]) {
    let rpcCalls = 0;
    const h = await bootRenderHarness({ prebuiltModule: module, fonts: 'none',
      beforeInstantiate(ctx, host) {
        host.get_ticks = () => 1000;
        ctx.renderer._guestNowMs = () => 1000;
        if (!rpc) return;
        const sigs = Object.fromEntries(['get_mouse_buttons_live', 'di_mouse_receipt', 'queue_mouse_input']
          .map(name => [name, signatures[name]]));
        const broker = RPC.createMainBroker(host.memory, { ...host }, sigs);
        const worker = RPC.createWorkerImports(host.memory, sigs, m => {
          rpcCalls++; broker.serveRpc(m.slot);
        }, { slot: 2 });
        Object.assign(host, worker.imports.host);
      } });
    const { exports: e, memory, renderer } = h;
    const pe = fs.readFileSync(require('node:path').join(__dirname, 'binaries/calc.exe'));
    new Uint8Array(memory.buffer).set(pe, e.get_staging());
    assert(e.load_pe(pe.length), 'fixture PE initializes process; application is never run');
    e.init_dx_com_thunks();
    const wr = (p, v) => e.guest_write32(p, v >>> 0), rd = p => e.guest_read32(p) >>> 0;
    const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
    const view = new DataView(memory.buffer), stack = alloc(8192) + 4096;
    let calls = 0;
    function invoke(args, obj, slot, target) {
      const code = [], word = v => code.push(v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24);
      for (const arg of args.slice().reverse()) { code.push(0x68); word(arg); }
      if (obj) {
        assert(rd(rd(obj) + slot * 4), 'published production method');
        code.push(0xb8); word(obj); code.push(0x8b, 0x00, 0xff, 0x90); word(slot * 4);
      } else { code.push(0xb8); word(target); code.push(0xff, 0xd0); }
      const result = alloc(8);
      code.push(0xa3); word(result); code.push(0x89, 0x25); word(result + 4); code.push(0xc3);
      const pc = alloc(code.length); code.forEach((v, i) => e.guest_write8(pc + i, v));
      e.set_esp(stack); e.call_func(pc, 0, 0, 0, 0);
      for (let i = 0; i < 100 && e.get_eip(); i++) e.run(10000);
      assert.equal(e.get_eip(), 0, 'finite x86 return');
      equal(rd(result + 4), stack - 20, 'stdcall cleanup');
      equal(e.get_esp() >>> 0, stack - 16, 'x86 caller RET');
      calls++; return rd(result);
    }
    const com = (obj, slot, ...args) => invoke([obj, ...args], obj, slot);
    const out = alloc(4), guid = alloc(16);
    const thunkWa = regions.BASE.THUNK_BASE, saved = view.getUint32(thunkWa + 4, true);
    const thunk = (thunkWa - e.get_guest_base() + e.get_image_base()) >>> 0;
    try {
      view.setUint32(thunkWa + 4, apis.find(a => a.name === 'DirectInputCreateA').id, true);
      equal(invoke([0x400000, 0x700, out, 0], 0, 0, thunk), 0, 'factory HRESULT');
    } finally { view.setUint32(thunkWa + 4, saved, true); }
    const root = rd(out); assert(root);
    [0x6f1d2b60, 0x11cfd5a0, 0x4544c7bf, 0x00005453].forEach((v, i) => wr(guid + i * 4, v));
    equal(com(root, 3, guid, out, 0), 0, 'CreateDevice mouse HRESULT');
    const mouse = rd(out); assert(mouse);
    const fmt = alloc(24), objs = alloc(256), prop = alloc(20), count = alloc(4);
    function format(list) {
      [24, 16, 2, 32, list.length, objs].forEach((v, i) => wr(fmt + i * 4, v));
      list.forEach(([offset, type], i) => [0, offset, type, 0].forEach((v, j) => wr(objs + i * 16 + j * 4, v)));
      return com(mouse, 11, fmt);
    }
    equal(format(objects), 0, 'reordered custom format with optional missing object');
    for (const [offset, type] of [[0xfffffffc, 3], [0xffffffff, 0x30c], [2, 3]]) {
      equal(format([[offset, type]]), 0x80070057, 'malformed offset ' + offset.toString(16));
      // Never acquire or poll an accepted malformed descriptor on the baseline.
      // Restore valid format so each guard is independently exercised.
      equal(format(objects), 0, 'restore valid after malformed guard');
    }
    // A rejected required absent object must also preserve the previous map.
    equal(format([[0, 0x60c]]), 0x80070057, 'required missing object');
    [20, 16, 0, 0, 32].forEach((v, i) => wr(prop + i * 4, v));
    equal(com(mouse, 6, 1, prop), 0, 'buffer size');
    equal(com(mouse, 7), 0, 'Acquire');
    equal(com(mouse, 11, fmt), 0x800700aa, 'acquired format guard');
    // Caller descriptors may change after SetDataFormat. The owned map survives.
    [24, 16, 2, 4, 0, 0].forEach((v, i) => wr(fmt + i * 4, v));
    const area = alloc(32 + 32), state = area + 16;
    const dataArea = alloc(16 + 20 * 16 + 16), data = dataArea + 16;
    const raw = (p, n) => new Uint8Array(memory.buffer, e.guest_to_wasm(p) >>> 0, n);
    function stateHex(expected, size = 32, hr = 0) {
      raw(area, 64).fill(0xa5);
      equal(com(mouse, 9, size, state), hr, 'GetDeviceState HRESULT');
      equal(Buffer.from(raw(state, 32)).toString('hex'), expected, 'literal custom state');
      equal([...raw(area, 16), ...raw(state + 32, 16)], Array(32).fill(165), 'state perimeter');
    }
    function poll(flags, expected, requested = 16, pointer = data) {
      raw(dataArea, 352).fill(0xa5); wr(count, requested);
      equal(com(mouse, 10, 20, pointer, count, flags), 0, 'GetDeviceData HRESULT');
      const n = rd(count); assert(n <= 16, 'finite output bound');
      const pairs = Array.from({ length: n }, (_, i) => [rd(data + i * 20), rd(data + i * 20 + 4) | 0]);
      if (pointer) {
        equal(pairs, expected, 'literal buffered offset and signed data');
        for (let i = 0; i < n; i++) equal(rd(data + i * 20 + 16), 0xa5a5a5a5, 'event stride padding');
      } else equal(n, expected, 'NULL discard count');
      const end = pointer ? n * 20 : 0;
      equal([...raw(dataArea, 16), ...raw(data + end, 320 - end + 16)],
        Array(16 + 320 - end + 16).fill(165), 'event perimeter and untouched suffix');
      return pointer ? Array.from({length:n},(_,i)=>Array.from(raw(data+i*20,16))) : n;
    }
    // Initialize buffered live-state reconciliation before the physical edges.
    poll(0, []);
    renderer.handleRelativeMouseMove(-11, 7, { guestCounts: true });
    renderer.handleWheel(0, 0, 1); renderer.handleWheel(0, 0, 1);
    renderer.handleMouseDown(0, 0, 0); renderer.handleMouseDown(0, 0, 2);
    assert.equal(renderer.queueMouseInput(32, 0, 0, 0, 0), 1, 'production middle-button input');
    stateHex(initial);
    stateHex(held);
    stateHex('a5'.repeat(32), 28, 0x80070057);
    const peek = poll(1, events); equal(poll(1, events), peek, 'repeat PEEK metadata');
    equal(poll(0, events), peek, 'PEEK/read full record consistency');
    poll(0, []);
    assert.equal(renderer.queueMouseInput(64, 0, 0, 0, 0), 1, 'production middle-button release');
    renderer.handleMouseUp(0, 0, 2); renderer.handleMouseUp(0, 0, 0);
    poll(0, [[1, 0], [3, 0], [28, 0]]);
    stateHex('00'.repeat(32));
    equal(com(mouse, 8), 0, 'Unacquire');
    equal(format([[12, 3], [30, 0x8000060c]]), 0, 'omitted Y Z and buttons');
    equal(com(mouse, 7), 0, 'reacquire subset');
    renderer.handleRelativeMouseMove(5, -9, { guestCounts: true }); renderer.handleWheel(0, 0, -1);
    assert.equal(renderer.queueMouseInput(32, 0, 0, 0, 0), 1);
    stateHex('0000000000000000000000000500000000000000000000000000000000000000');
    poll(1, [[12, 5]]); poll(0, [[12, 5]]); poll(0, []);
    assert.equal(renderer.queueMouseInput(64, 0, 0, 0, 0), 1); poll(0, []);
    equal(com(mouse, 8), 0, 'subset Unacquire');
    equal(com(mouse, 2), 0, 'device final Release'); equal(com(root, 2), 0, 'root final Release');
    if (rpc) assert(rpcCalls > 0, 'real broker exercised');
    console.log(JSON.stringify({ route: rpc ? 'production synchronous RPC in process' : 'direct production host', calls, rpcCalls, checks, failures }));
  }
  assert.equal(failures.length, 0, JSON.stringify(failures));
  console.log('PASS custom mouse format ' + checks + ' checks; no gameplay, hardware or Windows claim');
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
