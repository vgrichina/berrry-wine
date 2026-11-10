'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {attach} = require('./mw3-live-mouse-observation.cjs');
test('opt-in import wrapper preserves receiver, arguments, return and thrown identity', () => {
  const fault = Error('original');
  const table = {value: 17, get_mouse_buttons_live(v) { assert.equal(this, table); if (v) throw fault; return this.value; }};
  const original = table.get_mouse_buttons_live;
  const o = attach(table);
  assert.equal(table.get_mouse_buttons_live(0), 17);
  assert.throws(() => table.get_mouse_buttons_live(1), e => e === fault);
  const v = o.stop(); assert.equal(table.get_mouse_buttons_live, original);
  assert.deepEqual(v.records.map(r => r.value), [17, null]);
  assert(v.records.every(r => r.begin <= r.end)); assert.equal(v.drops, 0);
});
test('capacity and expiry restore the original; replacement ownership is preserved', async () => {
  const table = {get_mouse_buttons_live: () => 3}, original = table.get_mouse_buttons_live;
  let o = attach(table, {capacity: 1}); table.get_mouse_buttons_live(); table.get_mouse_buttons_live();
  assert.equal(o.snapshot().drops, 1); assert.equal(table.get_mouse_buttons_live, original);
  o = attach(table, {durationMs: 1}); await new Promise(r => setTimeout(r, 5)); table.get_mouse_buttons_live();
  assert.equal(o.stop().records.length, 0); assert.equal(table.get_mouse_buttons_live, original);
  o = attach(table); const newer = () => 7; table.get_mouse_buttons_live = newer;
  assert(o.stop().restoreConflict); assert.equal(table.get_mouse_buttons_live, newer);
});
const {attachDispatch} = require('./mw3-live-mouse-observation.cjs');
const decoder = require('./mw3-relative-motion.cjs');
function fixture(options = {}) {
  const memory = {buffer: new ArrayBuffer(8192)}, d = new DataView(memory.buffer);
  const put = (p, n) => d.setUint32(p, n >>> 0, true);
  [999, 2048, 16, 3072].forEach((v, i) => put(1024 + i * 4, v));
  put(2052, 0); put(4096, 7); put(4104, 2); put(4116, 16); put(4124, 0x400);
  let esp = 1024, log = 0;
  const ex = {get_esp: () => esp, get_eax: () => 0, guest_to_wasm: a => a, set_api_log: n => log = n};
  const fault = Error('original fault');
  const table = {log() {}, log_i32() {}, log_api_exit() {}, get_mouse_buttons_live(a) {
    assert.equal(this, table); if (a === 99) throw fault; return a;
  }, wait_single: n => n};
  const o = attachDispatch(table, {getExports: () => ex, memory, ...decoder,
    layout: {objectsBase: 4096, objectsSize: 32, stateBase: 5000}, ...options});
  return {o, ex, memory, put, table, fault, log: () => log,
    entry() {esp = 1024; table.log_i32(0xc0de0000 | 1093); table.log(0, 5);},
    exit() {put(3084, 0x80); esp = 1040; table.log_api_exit();}};
}
test('dispatch observations separate import returns from successful full handler reads', () => {
  const f = fixture(); f.o.start({apiLogBefore: 0});
  f.entry(); assert.equal(f.table.get_mouse_buttons_live(1), 1);
  assert.equal(f.o.snapshot().reads.length, 0); f.exit(); f.table.wait_single(123);
  const s = f.o.stop(); assert.equal(f.log(), 0); assert.equal(s.pending, 0);
  assert.equal(s.reads.length, 1); assert.equal(s.reads[0].state[12], 128);
  assert.equal(s.reads[0].eax, 0); assert(s.imports.some(r => r.name === 'wait_single'));
  assert.equal(s.drops, 0); assert.deepEqual(s.errors, []);
});
test('captured imports remain observable then inert across table restoration and expiry', async () => {
  const f = fixture(); const captured = f.table.get_mouse_buttons_live;
  f.o.start({apiLogBefore: 1, durationMs: 1}); await new Promise(r => setTimeout(r, 5));
  assert.equal(captured.call(f.table, 3), 3); assert(!f.o.snapshot().active); assert.equal(f.log(), 1);
  f.o.start({apiLogBefore: 0}); assert.equal(captured.call(f.table, 5), 5);
  f.o.restore(); assert.equal(captured.call(f.table, 7), 7); assert.equal(f.o.snapshot().imports.length, 1);
});
test('dispatch loss and original exceptions are terminal and preserve thrown identity', () => {
  const f = fixture({capacity: 1}); f.o.start({apiLogBefore: 0});
  f.table.get_mouse_buttons_live(1); f.table.get_mouse_buttons_live(2);
  assert.equal(f.o.snapshot().drops, 1); assert(!f.o.snapshot().active);
  const g = fixture(); g.o.start({apiLogBefore: 0});
  assert.throws(() => g.table.get_mouse_buttons_live(99), e => e === g.fault);
  assert.equal(g.o.snapshot().imports[0].threw, true); assert.equal(g.log(), 0);
  assert.throws(() => g.o.start({durationMs: 999999, apiLogBefore: 0}));
});
test('instrumented Worker response inherits isolation policy before custom handler ends it', async () => {
  const {startStaticServer, closeServer} = require('../test/static-server.js');
  const server = await startStaticServer({root: __dirname, crossOriginIsolated: true,
    handleRequest(req, res) {
      if (req.url !== '/worker.js') return false;
      res.writeHead(200, {'Content-Type': 'text/javascript'});
      res.end('postMessage(crossOriginIsolated)'); return true;
    }});
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/worker.js');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal(response.headers.get('cross-origin-embedder-policy'), 'require-corp');
    assert.equal(await response.text(), 'postMessage(crossOriginIsolated)');
  } finally { await closeServer(server); }
});
