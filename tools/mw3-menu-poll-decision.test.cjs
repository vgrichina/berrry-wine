'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {attachDispatch} = require('./mw3-live-mouse-observation.cjs');
const {sample} = require('./mw3-menu-poll-decision.cjs');
const decoder = require('./mw3-relative-motion.cjs');
const {BASE, SIZE} = require('../lib/region-map.generated');

test('authentic compiled MW3 mouse gates independently suppress real reads while keyboard keeps polling', t => {
  const pe = require('../lib/pe').readPE(path.join(__dirname,
    '../test/binaries/shareware/mw3/ex/Program_Files/mech3demo.exe'));
  assert.equal(crypto.createHash('sha256').update(pe.buf).digest('hex'),
    'df457ee6973f6f9d557c57aa3fc14258303486ec8b8742fd37b4369c1f37dbdc');
  const memory = new WebAssembly.Memory({initial: 8192, maximum: 8192, shared: true});
  const ctx = {getMemory: () => memory.buffer, resourceJson: {}, onExit() {}};
  const {Win98Renderer} = require('../lib/renderer');
  ctx.renderer = Object.create(Win98Renderer.prototype);
  ctx.renderer._keysDown = new Set();
  const imports = require('../lib/host-imports').createHostImports(ctx);
  imports.host.memory = memory;
  // Serialized as in the actual pre-instantiation Worker instrumentation.
  const install = require('node:vm').runInNewContext('(' + attachDispatch + ')',
    {performance, Date, Float64Array, Uint8Array, DataView});
  const decision = require('node:vm').runInNewContext('(' + sample + ')', {DataView, Uint8Array});
  let ex;
  const o = install(imports.host, {getExports: () => ex, memory, ...decoder,
    layout: {objectsBase: BASE.DX_OBJECTS, objectsSize: SIZE.DX_OBJECTS, stateBase: BASE.DX_SURF_STATE},
    importNames: ['get_mouse_buttons_live'], decision});
  const wasm = fs.readFileSync(process.env.MW3_DECISION_WASM || path.join(__dirname,
    '../build/wine-assembly.wasm'));
  t.diagnostic('compiled module SHA256 ' + crypto.createHash('sha256').update(wasm).digest('hex'));
  ex = new WebAssembly.Instance(new WebAssembly.Module(wasm), imports).exports; ctx.exports = ex;
  ex.init_thread(0, 0x400000, 0x400000, 0x600000, 0x7500000, 0x7500040, 8);
  const d = new DataView(memory.buffer), g = a => ex.guest_to_wasm(a) >>> 0;
  const put = (a, v) => d.setUint32(g(a), v >>> 0, true);
  const bytes = (a, b) => new Uint8Array(memory.buffer, g(a), b.length).set(b);
  // Byte-identical game functions only. No original process is launched or
  // patched. Synthetic objects/thunks and caller below are fixture setup.
  for (const [a, end] of [[0x4fa160,0x4fa1b1], [0x4fa420,0x4fa740],
    [0x4f7610,0x4f7980], [0x5776a0,0x5776a6]])
    bytes(a, pe.buf.subarray(pe.va2off(a), pe.va2off(end)));
  const thunk = (i, api) => {
    d.setUint32(BASE.THUNK_BASE + i * 8, 0x80000000, true);
    d.setUint32(BASE.THUNK_BASE + i * 8 + 4, api, true);
    return 0x7500000 + i * 8;
  };
  put(0x520024, thunk(0,1093)); put(0x520064, thunk(1,2864));
  put(0x520128, thunk(2,1094)); put(0x58661c, thunk(3,759));
  put(0x520200,0x520000); put(0x520204,0);
  put(0x520300,0x520100); put(0x520304,1);
  for (const [slot, type, size] of [[0,2,16],[1,1,256]])
    [7,0,type,128,0,size,0,0x400].forEach((v,i) => d.setUint32(BASE.DX_OBJECTS + slot*32 + i*4,v,true));
  put(0x600ac8,0x520200); put(0x600f84,1);
  put(0x5fc90c,0x520300); put(0x5fc910,0x530000);
  put(0x5fc900,1); put(0x5fc904,1);
  bytes(0x5fc8fc,[1,0,1]);
  put(0x600f88,640); put(0x600f8c,480);
  put(0x600f90,320); put(0x600f94,240);
  for (const a of [0x5b6d70,0x5b6d74]) d.setFloat32(g(a),1.3,true);
  put(0x5b6d78,5);
  // xor ecx,ecx; call real game dispatcher; jmp self (bounded run budget).
  bytes(0x401000,[0x31,0xc9,0xe8,0x59,0x91,0x0f,0,0xeb,0xfe]);
  const run = (flags, users) => {
    bytes(0x5fc8fe,[flags]); d.setUint16(g(0x5fc904),users,true);
    ex.set_esp(0x510000); ex.set_eip(0x401000); ex.clear_yield();
    o.start({apiLogBefore:0}); ex.run(3000); const s = o.stop();
    assert.equal(ex.get_eip()>>>0,0x401007,'authentic functions returned to fixture loop');
    assert.deepEqual(Array.from(s.errors),[]); assert.equal(s.drops,0); assert.equal(s.pending,0);
    assert.equal(s.diagnostic.bindingMismatchReasons.length,0);
    assert.equal(s.decisionEnabled,true);
    const keyboard = s.decisions.find(r=>r.sample.method==='GetDeviceData');
    assert(keyboard); assert.equal(keyboard.sample.caller,0x4f76c8);
    assert.equal(keyboard.sample.deviceType,1); assert.equal(keyboard.sample.mouseFlags,flags);
    assert.equal(keyboard.sample.mouseUsers,users);
    assert.equal(keyboard.sample.mouseGateOpen,flags===1&&users>0);
    t.diagnostic(JSON.stringify({flags,users,reads:s.reads.map(r=>({caller:r.returnAddress,eax:r.eax,dx:r.dx,dy:r.dy})),
      decisions:s.decisions}));
    return s;
  };
  const open = run(1,1);
  assert.equal(open.reads.length,1); assert.equal(open.reads[0].eax,0);
  assert.equal(open.reads[0].returnAddress,0x4fa56c); assert.equal(open.reads[0].buffer,0x600f68);
  assert(open.decisions.some(r=>r.sample.method==='Poll'&&r.sample.caller===0x4fa55f));
  for (const [flags, users] of [[3,1],[0,1],[1,0]]) {
    const physical = new Int32Array(memory.buffer, BASE.DI_MOUSE_INPUT_STATE, 2);
    Atomics.store(physical,0,-8); Atomics.store(physical,1,-3);
    const closed = run(flags,users); assert.equal(closed.reads.length,0);
    assert(!closed.decisions.some(r=>r.sample.deviceType===2));
    assert.equal(Atomics.load(physical,0),-8,'closed game gate leaves actual shared input pending');
    const x = d.getUint32(g(0x600f90),true), y = d.getUint32(g(0x600f94),true);
    const resumed = run(1,1);
    assert.equal(resumed.reads[0].dx,-8); assert.equal(resumed.reads[0].dy,-3);
    assert.equal(Atomics.load(physical,0),0);
    assert.equal(d.getUint32(g(0x600f90),true),x-10,'authentic game cursor consumes scaled delta');
    assert.equal(d.getUint32(g(0x600f94),true),y-3);
  }
  assert.equal(run(1,1).reads.length,1,'reopening only the game gate restores real reads');
  // A read-only snapshot/code mismatch is terminal, never permission to input.
  bytes(0x4fa160,[0x90]);
  ex.set_esp(0x510000); put(0x510000,0x4f76c8); put(0x510004,0x520300);
  o.start({apiLogBefore:0}); imports.host.log_i32(0xc0de0000|1094); imports.host.log(0,5);
  assert.match(o.snapshot().errors[0],/gate code mismatch/); assert.equal(o.snapshot().active,false);
  o.restore();
});
