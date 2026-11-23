#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

// Public WINMM resolver/thunk regression, with mocked capture imports only.
// WAVEFORMATEX widths/layout and WAVE_FORMAT_QUERY:
// https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/ns-mmeapi-waveformatex
// https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-waveinopen
// Keep the existing permissive device/format/error policy, not new validation.
const extraWat = String.raw`
 (func (export "wi_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "wi_regs") (result i32) (global.get $reg_base))
 (func (export "wi_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096) (local.get 1) (i32.const 4)))
 (func (export "wi_posts") (result i32) (call $shared_post_queue_total_count))
 (func (export "wi_post") (param i32 i32) (result i32)
  (call $shared_post_queue_peek_field_tid (global.get $current_thread_id) (local.get 0) (local.get 1)))
 (func (export "wi_seed_post")
  (drop (call $post_queue_push (i32.const 0) (i32.const 0x4321) (i32.const 0x12345678) (i32.const 0x76543210))))
 (func (export "wi_clear_posts") (call $shared_post_queue_reset_tid (global.get $current_thread_id)))
 (func (export "wi_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "wi_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "wi_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
`;
// Literal byte strings and independent literal host argument oracles. Opaque
// widths make swapped/zeroed/sign-extended reads and every byte cut visible.
const formats = [
 { bytes: '01000100112b0000112b0000010008000000', args: [11025, 1, 8] },
 { bytes: '010002002256000088580100040010000000', args: [22050, 2, 16] },
 { bytes: 'eeee3492efcdab891234567856346587ffff', args: [-1985229329, 0x9234, 0x8765] },
 { bytes: '7777cdab78563412efbeaddeffff3412ffff', args: [0x12345678, 0xabcd, 0x1234] },
];
const fields = { rate: [4, 4], channel: [2, 2], bits: [14, 2] };
async function run({ expectParent = false } = {}) {
 const stats = { calls: 0, queries: 0, comparisons: 0, mappingFailures: 0,
  controlFailures: 0, fieldFailures: { rate: 0, channel: 0, bits: 0 }, examples: [] };
 let e, read, output, opened = [], handle = 0x89abcdef, observed = [];
 const h = await bootRenderHarness({ extraWat, fonts: 'none', width: 8, height: 8,
  beforeInstantiate(_ctx, host) {
   for (const key of Object.keys(host).filter(k => k.startsWith('wave_in_')))
    host[key] = () => { throw Error('unexpected capture lifecycle ' + key); };
   host.wave_in_open = (...args) => {
    opened.push(args);
    observed.push({ posts: e.wi_posts(), output: read(output, 4).toString('hex') });
    return handle | 0;
   };
  } });
 e = h.exports;
 e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.wi_init(); e.set_api_log(0);
 const mem = new Uint8Array(h.memory.buffer), dv = new DataView(h.memory.buffer), regs = e.wi_regs() >>> 0;
 const wa = p => e.guest_to_wasm(p) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 // Bytewise physical access does not use the gl32/gl16 being tested.
 const put = (p, b) => { for (let i = 0; i < b.length; i++) mem[wa(p + i)] = b[i]; };
 read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => mem[wa(p + i)]));
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length); put(p, b); return p; };
 const stack = alloc(256) + 64, entries = new Map();
 for (const [dll, names] of [['WINMM.DLL', ['waveInOpen']], ['KERNEL32.DLL', ['VirtualAlloc', 'VirtualFree']]]) {
  dv.setUint32(regs + 16, stack, true); const mod = e.wi_module(str(dll)) >>> 0; assert.ok(mod);
  for (const name of names) {
   dv.setUint32(regs + 16, stack, true);
   const stub = e.wi_resolve(mod, str(name)) >>> 0, row = apiTable.find(r => r.name === name);
   assert.ok(stub); assert.equal(row.convention, 'stdcall');
   const thunk = dll === 'KERNEL32.DLL' ? (stub + 5 + (e.guest_read32(stub + 1) | 0)) >>> 0 : stub;
   if (dll === 'KERNEL32.DLL') assert.equal(e.guest_read8(stub), 0xe9);
   assert.equal(e.guest_read32(thunk + 4), row.id); entries.set(name, { thunk, nargs: row.nargs });
  }
 }
 function call(name, args) {
  const row = entries.get(name); assert.equal(args.length, row.nargs);
  e.guest_write32(stack, 0x12345678); args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
  const frame = read(stack - 16, 64);
  const seed = [0x81234567, 0x12345678, 0x23456789, 0x3456789a, stack, 0x456789ab, 0x56789abc, 0x6789abcd];
  seed.forEach((v, i) => dv.setUint32(regs + i * 4, v, true));
  e.wi_call(row.thunk); stats.calls++;
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' stdcall ESP');
  assert.equal(e.get_eip() >>> 0, 0x456789ab, name + ' EIP');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(dv.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(read(stack - 16, 64), frame, name + ' full stack frame and guards');
  return e.get_eax() >>> 0;
 }
 const commit = (p, n) => assert.equal(call('VirtualAlloc', [p, n, 0x3000, 4]), p);
 const fragmented = 0x30000000, adjacent = 0x31000000, alias = 0x32000000;
 const decoys = [0x28000000, 0x29000000], replacement = 0x33000000;
 for (const p of [fragmented, decoys[0], fragmented + 4096, decoys[1], replacement]) commit(p, 4096);
 commit(adjacent, 8192);
 assert.equal(wa(decoys[0]), wa(fragmented) + 4096);
 assert.equal(wa(decoys[1]), wa(fragmented + 4096) + 4096);
 assert.notEqual(wa(fragmented + 4096), wa(fragmented) + 4096);
 assert.equal(wa(adjacent + 4096), wa(adjacent) + 4096);
 const direct = alloc(8192); output = alloc(96) + 32;
 const spans = [[wa(direct), 8192], [wa(fragmented), 4096], [wa(fragmented + 4096), 4096],
  ...decoys.map(p => [wa(p), 4096]), [wa(adjacent), 8192], [wa(replacement), 4096]];
 const views = spans.map(([p, n]) => Buffer.from(h.memory.buffer, p, n)), saved = views.map(b => Buffer.alloc(b.length));
 function compare(a, b, label, mapping = false) {
  stats.comparisons++;
  if (Buffer.isBuffer(a) ? a.equals(b) : JSON.stringify(a) === JSON.stringify(b)) return;
  stats[mapping ? 'mappingFailures' : 'controlFailures']++;
  if (stats.examples.length < 16) stats.examples.push({ label,
   actual: Buffer.isBuffer(a) ? a.toString('hex').slice(0, 96) : a,
   expected: Buffer.isBuffer(b) ? b.toString('hex').slice(0, 96) : b });
 }
 function query(f, p, label, mapping = false, poison = 'rate', flags = 0, device = 0xffffffff, nullOutput = false) {
  const before = stats.mappingFailures;
  spans.forEach(([a, n], i) => mem.fill(0x91 + i, a, a + n));
  const fmt = Buffer.from(f.bytes, 'hex'); assert.equal(fmt.length, 18);
  // Poison just one field in both independent physical successor pages.
  // Other fields agree so each parent field failure is independently visible.
  const decoy = Buffer.from(fmt), [offset, width] = fields[poison]; decoy.fill(0x7e, offset, offset + width);
  for (const d of decoys) for (let i = 0; i < fmt.length; i++) mem[wa(d) + ((p + i) & 4095)] = decoy[i];
  put(p, fmt); views.forEach((b, i) => b.copy(saved[i]));
  mem.fill(0xa5, wa(output) - 16, wa(output) + 32);
  const expectedOut = read(output - 16, 48), type = (flags >>> 16) & 7, isQuery = !!(flags & 1);
  const cb = type === 1 ? 0 : 0x80401230, instance = 0x87654321;
  e.wi_clear_posts(); e.wi_seed_post(); opened = []; observed = [];
  compare(call('waveInOpen', [nullOutput ? 0 : output, device, p, cb, instance, flags]), 0, label + ' return');
  stats.queries++;
  compare(opened, isQuery ? [] : [[...f.args, cb | 0, instance | 0, type]], label + ' literal host args/count', mapping);
  compare(observed, isQuery ? [] : [{ posts: 1, output: 'a5a5a5a5' }], label + ' host before output/queue');
  if (!isQuery && !nullOutput) expectedOut.writeUInt32LE(handle >>> 0, 16);
  compare(read(output - 16, 48), expectedOut, label + ' output/guards');
  const posts = Array.from({ length: e.wi_posts() }, (_, n) => [0, 1, 2, 3].map(i => e.wi_post(n, i) >>> 0));
  const expectedPosts = [[0, 0x4321, 0x12345678, 0x76543210]];
  if (!isQuery && type === 1) expectedPosts.push([0, 0x3be, handle >>> 0, 0]);
  compare(posts, expectedPosts, label + ' callback FIFO/type');
  for (let i = 0; i < views.length; i++) compare(views[i], saved[i], label + ' full physical backing ' + i);
  compare(read(p, 18), fmt, label + ' format unchanged');
  stats.fieldFailures[poison] += stats.mappingFailures - before;
  assert.equal(e.guest_span_cursor_bytes(), 0); assert.equal(e.guest_span_overflow_count(), 0);
 }
 assert.equal(e.wi_alias(alias, wa(fragmented)), 1);
 assert.equal(e.wi_alias(alias + 4096, wa(fragmented)), 1);
 assert.equal(wa(alias), wa(alias + 4096));
 for (const poison of Object.keys(fields)) for (const base of [direct, adjacent, fragmented, alias])
  for (let phase = 0; phase < 4096; phase++) for (const f of formats)
   query(f, base + phase, 'phase ' + [poison, base, phase, f.bytes], base === fragmented || base === alias, poison);
 // Every internal cut and edge, all eight callback types, high flag bits,
 // query/no-host and NULL output, arbitrary device IDs and raw field widths.
 for (const [poison, [offset, width]] of Object.entries(fields)) for (let cut = 0; cut <= width; cut++)
  for (const base of [direct, adjacent, fragmented, alias]) for (const f of formats) for (let type = 0; type < 8; type++)
   for (const flags of [type << 16, (type << 16) | 0x80000001])
    query(f, base + 4096 - offset - cut, 'cut ' + [poison, cut, base, flags], base === fragmented || base === alias, poison, flags, cut & 1 ? 0x12345678 : 0, !!(cut & 1));
 for (let phase = 0; phase < 4096; phase++)
  query(formats[phase & 3], fragmented + phase, 'query phase ' + phase, true, 'bits', 0x30001);
 // Actual remapping, retaining and guarding all former physical pages.
 for (const target of [replacement, fragmented + 4096, fragmented]) {
  assert.equal(e.wi_alias(alias, wa(target)), 1); assert.equal(e.wi_alias(alias + 4096, wa(replacement)), 1);
  assert.equal(wa(alias), wa(target)); assert.equal(wa(alias + 4096), wa(replacement));
  for (let phase = 0; phase < 4096; phase++)
   query(formats[phase & 3], alias + phase, 'remap ' + [target, phase], true);
 }
 // Existing error policy forwards zero/negative/opaque host handles and still
 // returns success. No capture lifecycle is requested in this test.
 for (const value of [0, 1, 0xffffffff, 0x81234567]) {
  handle = value;
  for (const device of [0, 1, 0xffffffff, 0x12345678]) for (const flags of [0, 1, 0x10000, 0x10001, 0x30000])
   query(formats[2], fragmented + 4091, 'host handle/device control', true, 'rate', flags, device);
 }
 assert.equal(call('VirtualFree', [replacement, 0, 0x8000]), 1); commit(replacement, 4096);
 assert.equal(wa(replacement), spans[6][0]); query(formats[3], replacement + 64, 'public recommit');
 const physical = wa(replacement), reused = 0x34000000;
 assert.equal(call('VirtualFree', [replacement, 0, 0x8000]), 1); commit(reused, 4096); assert.equal(wa(reused), physical);
 assert.equal(e.wi_alias(alias, wa(reused)), 1); assert.equal(e.wi_alias(alias + 4096, wa(fragmented)), 1);
 for (const [poison, [offset, width]] of Object.entries(fields)) for (let cut = 0; cut <= width; cut++) for (const f of formats)
  query(f, alias + 4096 - offset - cut, 'physical reuse ' + [poison, cut], true, poison);
 assert.equal(call('VirtualFree', [reused, 0, 0x8000]), 1);
 console.log(JSON.stringify(stats)); assert.equal(stats.controlFailures, 0, 'ABI/guards/policy/contiguous controls');
 if (expectParent) for (const field of Object.keys(fields)) assert.ok(stats.fieldFailures[field] > 0, field + ' must independently fail on fresh parent');
 else assert.equal(stats.mappingFailures, 0, 'mapped format input');
 return stats;
}
if (require.main === module) run({ expectParent: process.argv.includes('--expect-parent') }).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { run, extraWat };
