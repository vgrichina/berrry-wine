#!/usr/bin/env node
'use strict';
// Microsoft: notification handles cannot change while acquired; DIERR_ACQUIRED.
// https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee417927(v=vs.85)
// Same-handle calls and handle validation are deliberately unspecified here.
// Full production modules, x86 public COM calls, real host synchronization and
// renderer input. Serial devices: the host currently owns one event per type,
// globally per renderer, rather than one per COM device/process.
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { createHostImports } = require('../lib/host-imports');
const { Win98Renderer } = require('../lib/renderer');
const { createCanvas } = require('../lib/raster-canvas');
const apiTable = require('../src/api_table.json');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const EXPECT = Object.freeze({ ok: 0, acquired: 0x800700aa, signaled: 0, idle: 258 });

function run(file) {
  const bytes = fs.readFileSync(file), memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const renderer = new Win98Renderer(createCanvas(320, 200));
  const ctx = { getMemory: () => memory.buffer, renderer, onExit() {}, resourceJson: {} };
  const imports = createHostImports(ctx); imports.host.memory = memory;
  const calls = [], witness = imports.host.di_set_event_notification;
  imports.host.di_set_event_notification = (type, handle) => { calls.push([type, handle >>> 0]); return witness(type, handle); };
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), imports), e = instance.exports;
  ctx.exports = e; renderer.wasm = instance; renderer.wasmMemory = memory;
  // PE bootstrap only: its application entrypoint is never executed.
  const pe = fs.readFileSync(path.join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe, e.get_staging()); assert(e.load_pe(pe.length));
  e.init_dx_com_thunks();
  const read = p => e.guest_read32(p) >>> 0, write = (p, v) => e.guest_write32(p, v >>> 0);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const words = values => { const p = alloc(values.length * 4); values.forEach((v, i) => write(p + i * 4, v)); return p; };
  const stack = alloc(8192) + 4096, rows = [], failures = [];
  const check = (label, got, want) => { rows.push({ label, got, want }); if (got !== want) failures.push({ label, got, want }); };
  function invoke(target, args, object = 0, slot = 0) {
    const code = [], word = n => code.push(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24);
    for (const arg of args.slice().reverse()) { code.push(0x68); word(arg); }
    if (object) { code.push(0xb8); word(object); code.push(0x8b, 0x00, 0xff, 0x90); word(slot * 4); }
    else { code.push(0xb8); word(target); code.push(0xff, 0xd0); }
    const out = words([0xa5a5a5a5, 0, 0, 0xa5a5a5a5]);
    code.push(0xa3); word(out + 4); code.push(0x89, 0x25); word(out + 8); code.push(0xc3);
    const pc = alloc(code.length + 4); new Uint8Array(memory.buffer, e.guest_to_wasm(pc), code.length).set(code);
    e.set_esp(stack); e.call_func(pc, 0, 0, 0, 0);
    for (let n = 0; n < 100 && e.get_eip(); n++) e.run(10000);
    assert.equal(e.get_eip(), 0, 'bounded public call');
    assert.equal(read(out + 8), stack - 20, 'stdcall argument cleanup');
    assert.equal(e.get_esp(), stack - 16, 'caller RET cleanup');
    assert.equal(read(out), 0xa5a5a5a5); assert.equal(read(out + 12), 0xa5a5a5a5);
    return read(out + 4);
  }
  const method = (obj, slot, ...args) => invoke(0, [obj, ...args], obj, slot);
  // Use the production catalog thunk, preserving its original dispatch id.
  const thunkWa = require('../lib/region-map.generated').BASE.THUNK_BASE;
  const dv = new DataView(memory.buffer), thunk = (thunkWa - e.get_guest_base() + e.get_image_base()) >>> 0;
  const api = (name, ...args) => {
    const saved = dv.getUint32(thunkWa + 4, true);
    try { dv.setUint32(thunkWa + 4, apiTable.find(a => a.name === name).id, true); return invoke(thunk, args); }
    finally { dv.setUint32(thunkWa + 4, saved, true); }
  };
  const output = words([0]);
  assert.equal(api('DirectInputCreateA', 0x400000, 0x700, output, 0), EXPECT.ok);
  const root = read(output);
  for (const [name, data1, size, flags, objects] of [
    ['keyboard', 0x6f1d2b61, 256, 2, [[0, 0x11, 0x8000110c, 0]]],
    ['mouse', 0x6f1d2b60, 16, 1, [[0, 0, 0x3, 0]]],
  ]) {
    const guid = words([data1, 0x11cfd5a0, 0x4544c7bf, 0x00005453]);
    assert.equal(method(root, 3, guid, output, 0), EXPECT.ok);
    const obj = read(output), objectArray = words(objects.flat());
    const format = words([24, 16, flags, size, objects.length, objectArray]);
    const formatBefore = Array.from(new Uint8Array(memory.buffer, e.guest_to_wasm(format), 24));
    assert.equal(method(obj, 11, format), EXPECT.ok);
    assert.equal(method(obj, 13, 0, 10), EXPECT.ok, 'public background/nonexclusive cooperation');
    const a = api('CreateEventA', 0, 1, 0, 0), b = api('CreateEventA', 0, 1, 0, 0);
    assert(a && b && a !== b);
    let motion = 20;
    const observe = (label, wantA, wantB) => {
      // Registration currently signals immediately. Discard that known quirk
      // before proving the notification generated by subsequent public input.
      assert.equal(api('ResetEvent', a), 1); assert.equal(api('ResetEvent', b), 1);
      assert.equal(api('WaitForSingleObject', a, 0), EXPECT.idle);
      assert.equal(api('WaitForSingleObject', b, 0), EXPECT.idle);
      if (name === 'keyboard') { renderer.handleKeyDown(87); renderer.handleKeyUp(87); }
      else { motion += 5; renderer.handleMouseMove(motion, 30); }
      check(name + ' ' + label + ' A', api('WaitForSingleObject', a, 0), wantA);
      check(name + ' ' + label + ' B', api('WaitForSingleObject', b, 0), wantB);
    };
    assert.equal(method(obj, 12, a), EXPECT.ok);
    assert.equal(method(obj, 7), EXPECT.ok);
    for (const [label, handle] of [['replace acquired', b], ['remove acquired', 0]]) {
      const before = calls.length;
      check(name + ' ' + label, method(obj, 12, handle), EXPECT.acquired);
      check(name + ' ' + label + ' host calls', calls.length - before, 0);
      observe(label, EXPECT.signaled, EXPECT.idle);
      check(name + ' remains acquired', method(obj, 7), 1);
    }
    assert.equal(method(obj, 8), EXPECT.ok);
    assert.equal(method(obj, 12, b), EXPECT.ok);
    assert.equal(method(obj, 7), EXPECT.ok);
    observe('replace unacquired', EXPECT.idle, EXPECT.signaled);
    assert.equal(method(obj, 8), EXPECT.ok);
    assert.equal(method(obj, 12, 0), EXPECT.ok);
    assert.equal(method(obj, 7), EXPECT.ok);
    observe('remove unacquired', EXPECT.idle, EXPECT.idle);
    assert.equal(method(obj, 8), EXPECT.ok);
    assert.equal(method(obj, 2), 0);
    assert.equal(api('CloseHandle', a), 1); assert.equal(api('CloseHandle', b), 1);
    assert.deepEqual(Array.from(new Uint8Array(memory.buffer, e.guest_to_wasm(format), 24)), formatBefore);
  }
  assert.equal(method(root, 2), 0);
  return { moduleSHA256: sha(bytes), rows, failures, hostCalls: calls, windows: false, gameplay: false, hardware: false };
}
if (require.main === module) {
  const file = process.argv.find(a => a.startsWith('--wasm='))?.slice(7);
  for (const f of file ? [file] : ['build/wine-assembly.wasm', 'build/wine-assembly.compat.wasm']) {
    const result = run(f); console.log(JSON.stringify(result)); if (result.failures.length) process.exitCode = 1;
  }
}
module.exports = { run, EXPECT };
