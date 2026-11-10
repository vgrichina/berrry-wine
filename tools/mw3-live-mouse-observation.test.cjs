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
const {waitForReadStream} = require('./mw3-live-mouse-observation.cjs');
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
test('scoped import rows retain all dispatch matching under the observed menu log volume', () => {
  const exercise = f => {
    f.o.start({apiLogBefore: 0});
    // The failed menu trace had 32,103 entry/exit pairs and 25 mouse reads.
    // These hooks still execute even when excluded from diagnostic rows.
    for (let n = 0; n < 32103; n++) {
      f.table.log(0, 0); f.table.log_api_exit();
      if (n < 25) { f.entry(); f.table.get_mouse_buttons_live(1); f.exit(); }
      if (n < 1300) f.table.wait_single(0);
    }
    return f.o.stop();
  };
  const baseline = exercise(fixture({capacity: 65536}));
  assert.deepEqual(baseline.errors, ['import capacity']); assert.equal(baseline.drops, 1);
  const scoped = exercise(fixture({capacity: 65536, importNames: ['get_mouse_buttons_live']}));
  assert.deepEqual(scoped.errors, []); assert.equal(scoped.drops, 0);
  assert.equal(scoped.pending, 0); assert.equal(scoped.reads.length, 25);
  assert.equal(scoped.imports.length, 25); assert.equal(scoped.excludedImports, 65581);
  assert.deepEqual(scoped.importNames, ['get_mouse_buttons_live']);
  assert(scoped.reads.every(r => r.eax === 0 && r.completionEsp === r.esp + 16 && r.state[12] === 128));
});
test('scoping cannot hide decoder faults, selected capacity loss or original exceptions', () => {
  const f = fixture({capacity: 1, importNames: ['get_mouse_buttons_live']});
  f.o.start({apiLogBefore: 0}); f.table.log_api_exit();
  assert.deepEqual(f.o.snapshot().errors, ['Error: dispatch exit without entry']);
  assert.equal(f.log(), 0);
  const g = fixture({capacity: 1, importNames: ['wait_single']});
  g.o.start({apiLogBefore: 0});
  assert.throws(() => g.table.get_mouse_buttons_live(99), e => e === g.fault);
  assert(g.o.snapshot().errors.includes('original import threw: get_mouse_buttons_live'));
  const h = fixture({capacity: 1, importNames: ['get_mouse_buttons_live']});
  h.o.start({apiLogBefore: 0}); h.table.get_mouse_buttons_live(1); h.table.get_mouse_buttons_live(2);
  assert.equal(h.o.snapshot().drops, 1); assert.deepEqual(h.o.snapshot().errors, ['import capacity']);
  for (const importNames of [[], ['missing'], ['log', 'log']])
    assert.throws(() => fixture({importNames}), /explicit existing import names/);
});

test('absent reads expose bounded categories without inventing a binding failure or admitting input', async () => {
  const f = fixture({importNames: ['get_mouse_buttons_live']});
  f.o.start({apiLogBefore: 0});
  for (let i = 0; i < 1106947; i++) f.table.wait_single(0);
  let s = f.o.snapshot();
  assert.equal(s.excludedImports, 1106947);
  assert.deepEqual(s.diagnostic.excludedByImport, [{name: 'wait_single', count: 1106947}]);
  assert.equal(s.diagnostic.entries, 0);
  assert.deepEqual(s.diagnostic.bindingMismatchReasons, []);
  for (let id = 0; id < 100; id++) {
    f.table.log_i32(0xc0de0000 | id); f.table.log(0, 5); f.table.log_api_exit();
  }
  s = f.o.snapshot();
  assert.equal(s.diagnostic.apiCategories.length, 32);
  assert.equal(s.diagnostic.otherCategories, 68);
  assert.equal(s.diagnostic.otherApi, 100);
  assert.equal(s.diagnostic.entries, s.diagnostic.exits);
  assert.deepEqual(s.imports, []); assert.deepEqual(s.reads, []);
  let clock = 0;
  await assert.rejects(waitForReadStream({read: () => f.o.snapshot(), deadline: 200,
    now: () => clock, wait: async ms => { clock += ms; },
    validate: () => assert.fail('diagnostics must never admit input')}), /deadline/);
  f.o.stop();
  const frozen = f.o.snapshot().diagnostic;
  f.table.wait_single(); assert.deepEqual(f.o.snapshot().diagnostic, frozen);
  f.o.start({apiLogBefore: 0});
  assert.equal(f.o.snapshot().diagnostic.entries, 0);
  assert.deepEqual(f.o.snapshot().diagnostic.excludedByImport, []);
  f.o.stop();
});

test('dispatch selection and local binding failures have separate passive explanations', () => {
  const f = fixture({importNames: ['get_mouse_buttons_live']});
  f.o.start({apiLogBefore: 0});
  f.put(4104, 1); f.entry(); f.exit();
  let s = f.o.snapshot();
  assert.equal(s.diagnostic.nonMouseDevice, 1);
  assert.equal(s.diagnostic.mouseRequests, 0);
  assert.deepEqual(s.diagnostic.apiCategories, [{category: 'com:1093', count: 1}]);
  f.put(4104, 2); f.entry(); f.exit();
  s = f.o.snapshot();
  assert.equal(s.diagnostic.mouseRequests, 1); assert.equal(s.diagnostic.mouseCompletions, 1);
  const apiName = 'IDirectInputDevice_GetDeviceState';
  new Uint8Array(f.memory.buffer, 6000, apiName.length).set(Buffer.from(apiName));
  f.ex.get_esp = () => 1024;
  f.table.log(6000, apiName.length);
  f.ex.get_esp = () => 1040; f.table.log_api_exit();
  assert(f.o.snapshot().diagnostic.apiCategories.some(c => c.category === 'name:' + apiName && c.count === 1));
  s.diagnostic.apiCategories[0].count = 999;
  assert.equal(f.o.snapshot().diagnostic.apiCategories[0].count, 2);
  f.table.log = () => {};
  assert.deepEqual(f.o.snapshot().diagnostic.bindingMismatchReasons, ['import table wrapper replaced: log']);
  f.o.stop();
  let exportsObject;
  const g = fixture({getExports: () => exportsObject}); exportsObject = g.ex;
  g.o.start({apiLogBefore: 0}); exportsObject = {...g.ex};
  assert.deepEqual(g.o.snapshot().diagnostic.bindingMismatchReasons, ['exports object changed since start']);
  g.o.stop();
});

test('serialized actual recorder composes with production WASM dispatch and host imports', async () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const {BASE, SIZE} = require('../lib/region-map.generated');
  const {createHostImports} = require('../lib/host-imports');
  const memory = new WebAssembly.Memory({initial: 8192, maximum: 8192, shared: true});
  const ctx = {getMemory: () => memory.buffer, resourceJson: {}, onExit() {}};
  const imports = createHostImports(ctx); imports.host.memory = memory;
  // Same function serialization used by the browser pre-instantiation prefix.
  const install = vm.runInNewContext('(' + attachDispatch.toString() + ')',
    {performance, Date, Float64Array, Uint8Array, DataView});
  let ex;
  const o = install(imports.host, {getExports: () => ex, memory, ...decoder,
    layout: {objectsBase: BASE.DX_OBJECTS, objectsSize: SIZE.DX_OBJECTS,
      stateBase: BASE.DX_SURF_STATE}, importNames: ['get_mouse_buttons_live']});
  const module = new WebAssembly.Module(fs.readFileSync(require('node:path').join(__dirname, '../build/wine-assembly.wasm')));
  ex = new WebAssembly.Instance(module, imports).exports; ctx.exports = ex;
  ex.init_thread(0, 0x400000, 0x400000, 0x600000, 0x7500000, 0x7500010, 2);
  const d = new DataView(memory.buffer), put = (p, v) => d.setUint32(p, v >>> 0, true);
  const g = a => ex.guest_to_wasm(a) >>> 0;
  put(BASE.THUNK_BASE, 0x80000000);
  [7, 0, 2, 0, 0x700, 16, 0, 0x400].forEach((v, i) => put(BASE.DX_OBJECTS + i * 4, v));
  put(g(0x520004), 0);
  new Uint8Array(memory.buffer, g(0x401000), 2).set([0xeb, 0xfe]);
  const run = api => {
    put(BASE.THUNK_BASE + 4, api); ex.set_esp(0x510000); ex.set_eip(0x7500000); ex.clear_yield();
    [0x401000, 0x520000, 16, 0x530000].forEach((v, i) => put(g(0x510000 + i * 4), v));
    ex.run(1);
  };
  ex.set_api_log(0); o.start({apiLogBefore: 0});
  for (let i = 0; i < 40000; i++) run(338);
  let s = o.snapshot();
  assert.equal(s.reads.length, 0); assert.equal(s.imports.length, 0);
  // run(1) may spend a batch on its periodic scheduler poll before dispatch.
  assert(s.diagnostic.entries >= 39000 && s.diagnostic.entries <= 40000);
  assert(s.diagnostic.apiCategories.some(c => c.category === 'com:338' && c.count === s.diagnostic.entries));
  assert.equal(s.excludedImports, s.diagnostic.excludedByImport.reduce((n, c) => n + c.count, 0));
  run(1093); s = o.stop();
  assert.equal(s.errors.length, 0); assert.equal(s.drops, 0); assert.equal(s.pending, 0);
  assert.equal(s.reads.length, 1); assert.equal(s.reads[0].eax, 0);
  assert.equal(s.diagnostic.mouseRequests, 1); assert.equal(s.diagnostic.mouseCompletions, 1);
  assert.equal(s.diagnostic.bindingMismatchReasons.length, 0);
  assert(s.imports.some(i => i.name === 'get_mouse_buttons_live'));
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

test('passive admission awaits a delayed complete read in the same armed recorder', async () => {
  const f = fixture(); f.o.start({apiLogBefore: 0});
  let clock = 0, validations = 0;
  const v = await waitForReadStream({read: () => f.o.snapshot(), deadline: 1000,
    now: () => clock, wait: async ms => {
      clock += ms;
      // Beyond the failed original's 350ms startup sample, with no rearming.
      if (clock === 400) { f.entry(); f.table.get_mouse_buttons_live(1); f.exit(); }
    }, validate: s => { validations++; assert.equal(s.pending, 0); assert.equal(s.reads[0].state[12], 128); }});
  assert.equal(clock, 400); assert.equal(validations, 1); assert.equal(v.reads.length, 1);
  f.o.stop();
});

test('passive admission stops on expiry, loss, invalid reads or transport failure without replay', async () => {
  const empty = {active: true, drops: 0, errors: [], reads: []};
  let clock = 0, reads = 0;
  const args = {read: () => { reads++; return empty; }, validate: () => assert.fail('empty stream'),
    now: () => clock, deadline: 250, wait: async ms => { clock += ms; }};
  await assert.rejects(() => waitForReadStream(args), /deadline/);
  assert.equal(clock, 250); assert.equal(reads, 3);
  for (const snapshot of [{...empty, drops: 1}, {...empty, errors: ['decoder']}, {...empty, active: false}]) {
    let calls = 0;
    await assert.rejects(() => waitForReadStream({...args, deadline: 1000,
      read: () => { calls++; return snapshot; }, wait: () => assert.fail('must stop')}));
    assert.equal(calls, 1);
  }
  const fault = Error('transport'); let calls = 0;
  await assert.rejects(() => waitForReadStream({...args, deadline: 1000,
    read: () => { calls++; throw fault; }}), e => e === fault);
  assert.equal(calls, 1);
  await assert.rejects(() => waitForReadStream({...args, deadline: 1000,
    read: () => ({...empty, reads: [{}]}), validate: () => { throw fault; }}), e => e === fault);
});
