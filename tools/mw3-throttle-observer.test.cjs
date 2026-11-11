'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const {attach, correlate} = require('./mw3-throttle-observer.cjs');
const {readCompletion} = require('./mw3-keyboard-completion.js');
const {Win98Renderer} = require('../lib/renderer');
const {createWindowHost} = require('../lib/host-window');
const {BASE, SIZE} = require('../lib/region-map.generated');

(async () => {
  const bytes = fs.readFileSync(process.env.MW3_OBSERVER_WASM || 'build/wine-assembly.wasm');
  const module = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({initial:8192, maximum:32768, shared:true});
  const renderer = Object.create(Win98Renderer.prototype);
  Object.assign(renderer, {inputQueue:[], windows:{}, _stepWakeHooks:new Set(),
    wasm:{exports:{}, _runsInGuestWorker:true}});
  renderer.wasm._guestWorker = true;
  renderer._guestWorkerWasms = new WeakSet([renderer.wasm]);
  const table = {};
  for (const imp of WebAssembly.Module.imports(module)) {
    if (imp.kind === 'memory') table[imp.name] = memory;
    else table[imp.name] = () => {throw Error('unexpected import ' + imp.name);};
  }
  const host = createWindowHost({renderer, getMemory:() => memory.buffer}, {}).imports;
  table.di_keyboard_buffer = host.di_keyboard_buffer;
  table.get_ticks = () => Date.now() >>> 0;
  // Thread initialization starts the host audio epoch; this fixture has no
  // audio device. All unrelated imports remain trap-only.
  table.beep_process_begin = () => {};
  table.beep_thread_begin = () => {};
  table.log = table.log_i32 = table.log_api_exit = () => {};
  let ex;
  const originalLog = table.log;
  const observer = attach(table, {getExports:() => ex, memory, readCompletion,
    objectsBase:BASE.DX_OBJECTS, objectsSize:SIZE.DX_OBJECTS, caller:0x401000});
  ex = (await WebAssembly.instantiate(module, {host:table})).exports;
  ex.init_thread(0, 0x400000, 0x400000, 0x600000, 0x7500000, 0x7500010, 2);
  const d = new DataView(memory.buffer), g = a => ex.guest_to_wasm(a) >>> 0;
  const put = (p, v) => d.setUint32(p, v >>> 0, true);
  const thunk = (index, id) => {put(BASE.THUNK_BASE + index * 8, 0x80000000); put(BASE.THUNK_BASE + index * 8 + 4, id);};
  thunk(0, 1094); // actual production COM GetDeviceData dispatch
  const api = JSON.parse(fs.readFileSync('src/api_table.json'));
  const apiName = row => typeof row === 'string' ? row : row.name;
  assert.equal(apiName(api[1094]), 'IDirectInputDevice_GetDeviceData');
  const acquire = api.findIndex(row => apiName(row) === 'IDirectInputDevice_Acquire');
  assert(acquire >= 0); thunk(1, acquire);
  [7,0,1,128,0x700,256,0,0x100].forEach((v,i) => put(BASE.DX_OBJECTS + i*4, v));
  put(g(0x520004), 0);
  new Uint8Array(memory.buffer, g(0x401000), 2).set([0xeb,0xfe]);
  function call(index, args) {
    ex.set_esp(0x510000); ex.set_eip(0x7500000 + index * 8); ex.clear_yield();
    [0x401000, ...args].forEach((v,i) => put(g(0x510000 + i*4), v));
    ex.run(1);
    assert.equal(ex.get_eax() >>> 0, 0);
  }
  call(1, [0x520000]);
  const poll = (flags = 0) => {
    put(g(0x540000), 128);
    call(0, [0x520000,16,0x530000,0x540000,flags]);
  };
  const edge = (vk, code, down) => renderer[down ? 'handleKeyDown' : 'handleKeyUp'](vk, {code});
  observer.start({durationMs:10000, apiLogBefore:0});
  poll();
  const results = [];
  for (const [vk, code] of [[38,'ArrowUp'],[48,'Digit0']]) {
    const downAt = Date.now(); edge(vk, code, true);
    const downSequence = renderer._diKeyboardSequence;
    poll(); // real compiled handler while physically held
    await new Promise(resolve => setTimeout(resolve, 5));
    edge(vk, code, false); const upAt = Date.now(), upSequence = renderer._diKeyboardSequence; poll();
    assert.equal(renderer.peekKeyDownState(vk), 0);
    const result = correlate(observer.snapshot(), {code,downAt,upAt,downSequence,upSequence});
    assert.equal(result.consumedDuringHold, true); results.push(result);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  // A released physical snapshot cannot erase already queued buffered edges.
  const downAt = Date.now(); edge(48, 'Digit0', true);
  const downSequence = renderer._diKeyboardSequence;
  await new Promise(resolve => setTimeout(resolve, 5));
  edge(48, 'Digit0', false); const upAt = Date.now(), upSequence = renderer._diKeyboardSequence;
  const interval = {code:'Digit0',downAt,upAt,downSequence,upSequence};
  poll(1); poll(1); // repeated peeks do not qualify as consumption
  assert.throws(() => correlate(observer.snapshot(), interval), /missing/);
  poll();
  const late = correlate(observer.snapshot(), interval);
  assert.equal(late.consumedDuringHold, false); results.push(late);
  const snapshot = observer.stop();
  assert.deepEqual(snapshot.errors, []); assert.equal(snapshot.drops, 0);
  assert.equal(snapshot.pending, 0); assert.deepEqual(snapshot.conflicts, []);
  for (const bad of [
    {...snapshot, drops:1}, {...snapshot, errors:['lost return']},
    {...snapshot, pending:1}, {...snapshot, conflicts:['exports']},
  ]) assert.throws(() => correlate(bad, interval), /incomplete/);
  assert.throws(() => correlate(snapshot, {...interval,downSequence:undefined}), /sequences/);
  assert.throws(() => correlate(snapshot, {...interval,downSequence:downSequence+10,upSequence:upSequence+10}), /missing/);
  // Split press/release owner must never form a cross-device pair.
  const last = structuredClone(snapshot.records.at(-1));
  last.decoded.records = last.decoded.records.slice(1);
  const first = structuredClone(snapshot.records.at(-1));
  first.decoded.records = first.decoded.records.slice(0,1);
  last.decoded.thisPtr++;
  assert.throws(() => correlate({...snapshot,records:[first,last]}, interval), /missing/);
  const before = snapshot.records.length;
  poll(); assert.equal(observer.snapshot().records.length, before, 'captured wrappers inert after stop');
  assert.throws(() => observer.start({apiLogBefore:0}), /single/);
  assert.deepEqual(observer.restore().conflicts, []); assert.equal(table.log, originalLog);
  console.log(JSON.stringify({passed:true, route:'full built WASM x86 COM dispatch -> production host/renderer -> matched compiled return',
    moduleSHA256:crypto.createHash('sha256').update(bytes).digest('hex'), results, snapshot,
    limitation:'synthetic guest object/code; no MW3 execution, DOM event, chassis speed or game callback claim'}));
})().catch(error => {console.error(error.stack);process.exitCode=1;});
