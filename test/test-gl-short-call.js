#!/usr/bin/env node
'use strict';
// GL short call (src/09a8c-gl-encoder.wat $gl_short_call): a decoded CALL
// into a pure-state GL thunk completes inside the call handler and continues
// at the return address through $branch_end. The same guest program runs with
// the shortcut on and off; everything the guest or the clock can observe must
// agree: the drawn picture, EAX/ESP after every call form, the API count, and
// the number of one-block run() slices the program takes.
//
// Call forms: call [abs] (H40), call [ebx+disp8] (H140), call eax (H119).
// Also a non-whitelisted GL call (glGetError) on each form, which must decline
// to $win32_dispatch, and a slot rewritten to a guest stub, which is no thunk.
const assert = require('assert');
const { bootGlGps } = require('./helpers/gl-gps-context');

const le32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
const push = v => [0x68, ...le32(v)];
const callAbs = slot => [0xFF, 0x15, ...le32(slot)];
const movEbx = v => [0xBB, ...le32(v)];
const callEbx = disp => [0xFF, 0x53, disp & 255];
const movEax = v => [0xB8, ...le32(v)];
const callEax = [0xFF, 0xD0];
// mov [abs], eax -- keeps glGetError's result where the test can read it.
const storeEax = addr => [0xA3, ...le32(addr)];

async function arm(on) {
  const g = await bootGlGps({ gps: 0 });
  const { e, f, wa, resolve } = g;
  assert.strictEqual(typeof e.set_gl_short_call, 'function', 'module exports set_gl_short_call');
  e.set_gl_short_call(on);
  // run.js --quiet-api: an API-logging run is the general path by design.
  e.set_api_log(0);
  const dv = () => new DataView(e.memory.buffer);
  const names = ['glBegin', 'glEnd', 'glColor4f', 'glVertex3f', 'glVertex3fv', 'glGetError', 'glMatrixMode', 'glLoadIdentity'];
  const data = e.guest_alloc(512) >>> 0;
  const slot = n => data + names.indexOf(n) * 4;
  names.forEach((n, i) => dv().setUint32(wa(data + i * 4), resolve(n) >>> 0, true));
  const stub = data + 200; new Uint8Array(e.memory.buffer).set([0xC2, 16, 0], wa(stub));
  const stubSlot = data + 64; dv().setUint32(wa(stubSlot), stub, true);
  const out = data + 128;
  const vtx = data + 160; [0.5, -0.5, 0].forEach((x, i) => dv().setFloat32(wa(vtx + i * 4), x, true));
  const color = (r, gg, b) => [...push(f(1)), ...push(f(b)), ...push(f(gg)), ...push(f(r))];
  const v3 = (x, y) => [...push(f(0)), ...push(f(y)), ...push(f(x))];
  const code = [
    ...movEbx(data),
    ...push(0x1701), ...callAbs(slot('glMatrixMode')), ...callEbx(names.indexOf('glLoadIdentity') * 4),
    ...color(0.25, 0.5, 0.75), ...callAbs(slot('glColor4f')),          // outside Begin: general tier
    ...push(7), ...callEbx(names.indexOf('glBegin') * 4),
    ...v3(-0.75, -0.75), ...callAbs(slot('glVertex3f')),                // inside Begin: imm lane
    ...color(1, 0, 0), ...callEbx(names.indexOf('glColor4f') * 4),
    ...v3(0.75, -0.75), ...movEax(resolve('glVertex3f') >>> 0), ...callEax,
    ...push(vtx), ...callAbs(slot('glVertex3fv')),
    ...v3(-0.75, 0.75), ...callAbs(slot('glVertex3f')),
    ...movEax(resolve('glEnd') >>> 0), ...callEax,
    ...callAbs(slot('glGetError')), ...storeEax(out),                   // declines (query)
    ...movEax(resolve('glGetError') >>> 0), ...callEax, ...storeEax(out + 4),
    ...color(0, 1, 0), ...callAbs(stubSlot),                            // guest stub, not a thunk
    0xC3,
  ];
  const at = e.guest_alloc(code.length + 16) >>> 0;
  new Uint8Array(e.memory.buffer).set(code, wa(at));
  const stack = e.guest_alloc(0x4000) >>> 0, top = stack + 0x3F00;
  // The same program at several run() grants: the slice count is the guest
  // clock, so it must not depend on how the call returned.
  const runs = [];
  for (const grant of [1, 2, 3, 5, 1000]) {
    e.set_esp(top); dv().setUint32(wa(top), 0, true); e.set_eip(at);
    const calls0 = e.get_api_calls(), short0 = e.get_gl_short_calls();
    let slices = 0;
    while (e.get_eip() !== 0 && slices < 10000) { e.run(grant); slices++; }
    assert.strictEqual(e.get_eip(), 0, 'program returned');
    assert.strictEqual(e.get_esp() >>> 0, top + 4, 'stdcall frames popped exactly');
    runs.push({ grant, slices, apiCalls: e.get_api_calls() - calls0,
      shortCalls: Number(e.get_gl_short_calls() - short0),
      errs: [dv().getUint32(wa(out), true), dv().getUint32(wa(out + 4), true)] });
  }
  g.swap();
  return { runs, pic: g.front() };
}

(async () => {
  const off = await arm(0), on = await arm(1);
  for (let i = 0; i < on.runs.length; i++) {
    const a = off.runs[i], b = on.runs[i];
    assert.strictEqual(a.shortCalls, 0, 'off arm takes no short call');
    // MatrixMode, LoadIdentity, Color4f, Begin, 3 vertices + Color4f +
    // Vertex3fv inside Begin, End: everything but the two glGetError calls.
    assert.strictEqual(b.shortCalls, 10, `grant ${b.grant}: every whitelisted call form was shortened`);
    assert.strictEqual(b.apiCalls, a.apiCalls, 'same API count');
    assert.deepStrictEqual(b.errs, a.errs, 'same glGetError results');
    assert.strictEqual(b.slices, a.slices, `grant ${b.grant}: same guest clock (run slices)`);
  }
  console.log('slices per grant: ' + on.runs.map(r => `${r.grant}:${r.slices}`).join(' '));
  assert.strictEqual(on.pic.w, off.pic.w);
  let lit = 0;
  for (let i = 0; i < on.pic.px.length; i++) {
    assert.strictEqual(on.pic.px[i], off.pic.px[i], `pixel ${i}`);
    if (on.pic.px[i]) lit++;
  }
  assert(lit > 0, 'the triangle fan drew something');
  console.log(`PASS test-gl-short-call: ${on.runs[0].shortCalls} short calls/run, ${on.runs[0].apiCalls} api calls/run, ${lit} lit px`);
})().catch(err => { console.error(err.stack || String(err)); process.exit(1); });
