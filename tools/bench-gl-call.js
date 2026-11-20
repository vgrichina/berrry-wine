#!/usr/bin/env node
'use strict';
// tools/bench-gl-call.js -- per-call cost of a guest `call [slot]` into a WAT
// OpenGL entry point, against a guest-only control and the WAT handler alone.
//
// A real GL context (test/helpers/gl-gps-context.js: real opengl32 resolver,
// thunks and WGL) runs a tiny hand-encoded x86 loop through $run. Each shape is
// re-emitted at a fresh guest address per rep; when the module has the GL
// short-call switch (set_gl_short_call, 09a8c $gl_short_call) both arms
// alternate inside one process (drift is common-mode). The per-call API log is
// off, as under run.js --quiet-api (--api-log keeps it on).
//
// Layers it separates, all in ns per GL call:
//   base      push args + add esp (no call): the loop's own cost
//   stub      call [slot] to a guest `ret N`: a guest call/return
//   gl        call [slot] to the GL thunk: today's (or the short) path
//   wat-imm   $gl_imm_dispatch called from a WAT loop (no x86 at all)
//   wat-body  the committed handler body alone ($gl_state_intercept + lock)
// The x86 shapes subtract `base`; the WAT probes are absolute.
//
// Caveat (tools/bench-loops.js): a periodic loop predicts every indirect
// branch, so dispatch costs here are a floor, not the real-app number.
//
// usage: node tools/bench-gl-call.js [--n=200000] [--reps=7] [--json=FILE]
const fs = require('fs');
const path = require('path');
const { bootGlGps } = require('../test/helpers/gl-gps-context');

const arg = (k, d) => { const a = process.argv.find(s => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const N = +arg('n', 200000), REPS = +arg('reps', 7), JSON_OUT = arg('json', '');

const PROBES = String.raw`
 (func (export "probe_imm_loop") (param $n i32) (param $thunk i32) (param $esp i32) (result i32)
   (local $i i32) (local $hit i32) (local $idx i32)
   (local.set $idx (i32.div_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8)))
   (loop $l
     (i32.store offset=16 (global.get $reg_base) (local.get $esp))
     (local.set $hit (i32.add (local.get $hit) (call $gl_imm_dispatch (local.get $idx))))
     (local.set $i (i32.add (local.get $i) (i32.const 1)))
     (br_if $l (i32.lt_u (local.get $i) (local.get $n))))
   (local.get $hit))
 (func (export "probe_body_loop") (param $n i32) (param $op i32) (param $esp i32)
   (local $i i32)
   (loop $l
     (call $gl_object_enter)
     (call $gl_section_note (local.get $op))
     (drop (call $gl_wat_init))
     (drop (call $gl_state_intercept (local.get $op) (call $g2w (local.get $esp))))
     (call $gl_object_leave)
     (local.set $i (i32.add (local.get $i) (i32.const 1)))
     (br_if $l (i32.lt_u (local.get $i) (local.get $n)))))`;

const le32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
const push = v => [0x68, ...le32(v)];
const callAbs = slot => [0xFF, 0x15, ...le32(slot)];
// dec ecx; jnz rel32 back to the top of `body`.
const loop = body => { const b = [...body, 0x49]; return [...b, 0x0F, 0x85, ...le32(-(b.length + 6))]; };

async function main() {
  const g = await bootGlGps({ gps: 1, extraWat: PROBES });
  const { e, f, wa, resolve, call } = g;
  // As run.js --quiet-api: no per-call host log (the default is on).
  if (!process.argv.includes('--api-log')) e.set_api_log(0);
  const mem = () => new Uint8Array(e.memory.buffer);
  const dv = () => new DataView(e.memory.buffer);
  const names = ['glBegin', 'glEnd', 'glTexCoord2f', 'glVertex3fv', 'glColor4f'];
  const th = Object.fromEntries(names.map(n => [n, resolve(n) >>> 0]));
  // Slots (the qgl* pointer table), a vertex, two guest stubs.
  const data = e.guest_alloc(256) >>> 0;
  const slot = i => data + i * 4;
  names.forEach((n, i) => dv().setUint32(wa(slot(i)), th[n], true));
  const vtx = data + 64; [0.25, 0.5, 0].forEach((x, i) => dv().setFloat32(wa(vtx + i * 4), x, true));
  const stub8 = data + 96, stub16 = data + 100, stub4 = data + 104, stub0 = data + 108;
  mem().set([0xC2, 8, 0], wa(stub8)); mem().set([0xC2, 16, 0], wa(stub16));
  mem().set([0xC2, 4, 0], wa(stub4)); mem().set([0xC3], wa(stub0));
  const SLOT_STUB8 = 5, SLOT_STUB16 = 6, SLOT_STUB4 = 7, SLOT_STUB0 = 8;
  dv().setUint32(wa(slot(SLOT_STUB8)), stub8, true); dv().setUint32(wa(slot(SLOT_STUB16)), stub16, true);
  dv().setUint32(wa(slot(SLOT_STUB4)), stub4, true); dv().setUint32(wa(slot(SLOT_STUB0)), stub0, true);
  const S = n => slot(names.indexOf(n));
  const stack = e.guest_alloc(0x10000) >>> 0, stackTop = stack + 0xFF00;
  const STRIDE = 0x400, codeArena = e.guest_alloc(STRIDE * 4096) >>> 0;
  let codeNext = 0;

  const tc = [...push(f(0.75)), ...push(f(0.5))];
  const v3 = push(vtx);
  // Each shape: per-iteration GL calls and a body; pre/post run once.
  const poly = (tcs, vs, beg, end) => [...push(9), ...callAbs(beg),
    ...[0, 1, 2, 3].flatMap(() => [...tc, ...callAbs(tcs), ...v3, ...callAbs(vs)]), ...callAbs(end)];
  const shapes = {
    'base:tc2f': { calls: 1, body: [...tc, 0x83, 0xC4, 8] },
    'stub:tc2f': { calls: 1, body: [...tc, ...callAbs(slot(SLOT_STUB8))] },
    'gl:tc2f-in-begin': { calls: 1, pre: [...push(9), ...callAbs(S('glBegin'))], body: [...tc, ...callAbs(S('glTexCoord2f'))],
      post: callAbs(S('glEnd')) },
    'base:color4f': { calls: 1, body: [...push(f(1)), ...push(f(1)), ...push(f(0.5)), ...push(f(0.25)), 0x83, 0xC4, 16] },
    'stub:color4f': { calls: 1, body: [...push(f(1)), ...push(f(1)), ...push(f(0.5)), ...push(f(0.25)), ...callAbs(slot(SLOT_STUB16))] },
    'gl:color4f-outside': { calls: 1, body: [...push(f(1)), ...push(f(1)), ...push(f(0.5)), ...push(f(0.25)), ...callAbs(S('glColor4f'))] },
    // Quake 2's polygon: Begin(GL_POLYGON), 4 x (TexCoord2f, Vertex3fv), End.
    'base:q2poly': { calls: 10, body: [...push(9), 0x83, 0xC4, 4,
      ...[0, 1, 2, 3].flatMap(() => [...tc, 0x83, 0xC4, 8, ...v3, 0x83, 0xC4, 4])] },
    'stub:q2poly': { calls: 10, body: poly(slot(SLOT_STUB8), slot(SLOT_STUB4), slot(SLOT_STUB4), slot(SLOT_STUB0)) },
    'gl:q2poly': { calls: 10, body: poly(S('glTexCoord2f'), S('glVertex3fv'), S('glBegin'), S('glEnd')) },
  };
  const toggle = typeof e.set_gl_short_call === 'function';
  const arms = toggle ? [0, 1] : [null];

  function runShape(sh, arm) {
    if (arm !== null) e.set_gl_short_call(arm);
    const code = codeArena + (codeNext++ % 4096) * STRIDE;
    const bytes = [0xB9, ...le32(N), ...(sh.pre || []), ...loop(sh.body), ...(sh.post || []), 0xC3];
    if (bytes.length > STRIDE) throw new Error('shape too long');
    mem().set(bytes, wa(code));
    e.set_esp(stackTop); dv().setUint32(wa(stackTop), 0, true); e.set_eip(code);
    const calls0 = e.get_api_calls();
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 100000 && e.get_eip() !== 0; i++) e.run(0x7FFFFFFF);
    const ns = Number(process.hrtime.bigint() - t0);
    if (e.get_eip() !== 0) throw new Error('shape did not return, eip=0x' + (e.get_eip() >>> 0).toString(16));
    if ((e.get_esp() >>> 0) !== stackTop + 4) throw new Error('stack drift ' + ((e.get_esp() >>> 0) - stackTop));
    return { ns, apiCalls: e.get_api_calls() - calls0 };
  }
  const res = {};
  // Warm-up: decode paths, GL init, JIT tiers.
  for (const [k, sh] of Object.entries(shapes)) for (const arm of arms) runShape(sh, arm);
  for (let r = 0; r < REPS; r++) {
    for (const [k, sh] of Object.entries(shapes)) for (const arm of arms) {
      const key = arm === null ? k : `${k}@short=${arm}`;
      const out = runShape(sh, arm);
      (res[key] ||= { calls: sh.calls, ns: [], apiCalls: out.apiCalls }).ns.push(out.ns);
    }
    // WAT-only probes: TexCoord2f inside Begin.
    call('glBegin', [9]);
    const esp = stackTop - 64;
    [f(0.75), f(0.5)].forEach((x, i) => dv().setUint32(wa(esp + 4 + i * 4), x, true));
    let t0 = process.hrtime.bigint();
    const hit = e.probe_imm_loop(N, th.glTexCoord2f, esp);
    let ns = Number(process.hrtime.bigint() - t0);
    if (hit !== N) throw new Error('gl_imm_dispatch declined: ' + hit);
    (res['wat-imm:tc2f'] ||= { calls: 1, ns: [] }).ns.push(ns);
    t0 = process.hrtime.bigint();
    e.probe_body_loop(N, 28, esp);
    ns = Number(process.hrtime.bigint() - t0);
    (res['wat-body:tc2f'] ||= { calls: 1, ns: [] }).ns.push(ns);
    call('glEnd');
  }
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
  const out = {};
  for (const [k, r] of Object.entries(res)) {
    out[k] = { nsPerCall: med(r.ns) / N / r.calls, minNsPerCall: Math.min(...r.ns) / N / r.calls, apiCallsPerRep: r.apiCalls };
  }
  const os = require('os');
  console.log(`loadavg ${os.loadavg().map(x => x.toFixed(2)).join(' ')}  n=${N} reps=${REPS} node ${process.version} toggle=${toggle}`);
  for (const [k, r] of Object.entries(out))
    console.log(`${k.padEnd(34)} med ${r.nsPerCall.toFixed(1).padStart(7)} ns/call  min ${r.minNsPerCall.toFixed(1).padStart(7)}` +
      (r.apiCallsPerRep !== undefined ? `  api ${r.apiCallsPerRep}` : ''));
  // Net of the loop's own pushes.
  for (const arm of toggle ? ['@short=0', '@short=1'] : ['']) for (const s of ['tc2f', 'color4f', 'q2poly']) {
    const b = out[`base:${s}${arm}`], st = out[`stub:${s}${arm}`];
    const glk = Object.keys(out).find(k => k.startsWith(`gl:${s}`) && k.endsWith(arm));
    if (!b || !glk) continue;
    console.log(`net ${s}${arm}: gl ${(out[glk].nsPerCall - b.nsPerCall).toFixed(1)} ns/call, guest stub ${(st.nsPerCall - b.nsPerCall).toFixed(1)} ns/call`);
  }
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ n: N, reps: REPS, load: os.loadavg(), node: process.version, results: out }, null, 2));
}
main().catch(err => { console.error(err.stack || String(err)); process.exit(1); });
