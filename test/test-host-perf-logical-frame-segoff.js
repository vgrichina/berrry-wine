#!/usr/bin/env node
'use strict';

// host.js side of a Win16 perf.logicalFrame named as { seg, off }: the browser
// keeps the NE segment/offset through normalization and resolves it through
// the loader's segment table (win16_seg_base) before arming the marker. A
// plain number stays a linear address. test-win16-jezzball-logical-frame-
// gameplay.js covers the CLI and the decoder; this pins the browser host.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const context = { console, setTimeout, URLSearchParams, Uint8Array };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'host.js'), 'utf8')
  + '\n;globalThis.WineAssembly = WineAssembly;', context);
const P = context.WineAssembly.prototype;

const fakeHost = (win16, bases) => ({
  instance: { exports: {
    is_win16: () => (win16 ? 1 : 0),
    win16_seg_base: seg => bases[seg] || 0,
  } },
});

// Normalization keeps { seg, off } (offset masked to 16 bits) and numbers.
const segOff = P._normalizePerfLogicalFrame.call({}, { logicalFrame: {
  label: 'GAME', address: { seg: 1, off: 0x3046 }, verifier: { seg: 1, off: 0x130a2 } } });
assert.deepStrictEqual(JSON.parse(JSON.stringify(segOff)),
  { label: 'GAME', address: { seg: 1, off: 0x3046 }, verifier: { seg: 1, off: 0x30a2 } });
const linear = P._normalizePerfLogicalFrame.call({}, { logicalFrame: { address: 0x401000, verifier: 0x4047ce } });
assert.strictEqual(linear.address, 0x401000);
assert.strictEqual(linear.verifier, 0x4047ce);
assert.strictEqual(P._normalizePerfLogicalFrame.call({}, { logicalFrame: { address: { seg: 0, off: 1 } } }), null,
  'segment 0 is not a segment');
assert.strictEqual(P._normalizePerfLogicalFrame.call({}, { logicalFrame: { address: 0 } }), null);

// Resolution: through win16_seg_base on a Win16 task, 0 when it cannot place it.
const win16 = fakeHost(true, { 1: 0x100000 });
assert.strictEqual(P._resolvePerfAddress.call(win16, { seg: 1, off: 0x3046 }), 0x103046);
assert.strictEqual(P._resolvePerfAddress.call(win16, { seg: 2, off: 0x10 }), 0, 'unloaded segment');
assert.strictEqual(P._resolvePerfAddress.call(fakeHost(false, { 1: 0x100000 }), { seg: 1, off: 0x10 }), 0,
  'a Win32 app cannot resolve a segment');
assert.strictEqual(P._resolvePerfAddress.call(win16, 0x401000), 0x401000, 'a number is already linear');
assert.strictEqual(P._resolvePerfAddress.call(win16, 0), 0);

console.log('PASS  host.js resolves a Win16 { seg, off } game step through the segment table');
