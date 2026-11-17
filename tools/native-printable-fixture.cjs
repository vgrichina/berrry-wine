'use strict';
// Authored x86 USER fixture. All observations are ordinary public captions.
const assert = require('node:assert/strict');
function fixture(pump = 'title') {
  const b = require('../test/test-caesar3-current-native.cjs').titleConsumerFixture(pump);
  const raw = r => r - 0x1000 + 0x400;
  const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24];
  const a = [], labels = new Map(), fix = [];
  const emit = (...v) => a.push(...v), push = n => emit(0x68, ...u32(n));
  const label = n => labels.set(n, a.length);
  const jump = (n, c) => { emit(...(c ? [0x0f, c] : [0xe9])); fix.push([a.length, n]); emit(0, 0, 0, 0); };
  emit(0x55, 0x89, 0xe5);
  // One marker per actual native callback, including unexpected duplicates.
  for (const [i, msg, marker] of [[0, 0x100, 68], [1, 0x102, 67], [2, 0x101, 85]]) {
    emit(0x81, 0x7d, 12, ...u32(msg)); jump('next' + i, 0x85);
    emit(0xb0, marker); jump('append'); label('next' + i);
  }
  for (const n of [20, 16, 12, 8]) emit(0xff, 0x75, n);
  emit(0xff, 0x15, ...u32(0x401318), 0xc9, 0xc2, 16, 0);
  label('append');
  emit(0x8b, 0x0d, ...u32(0x4037f0), 0x83, 0xf9, 63); jump('zero', 0x83);
  emit(0x88, 0x81, ...u32(0x403800), 0x41, 0x89, 0x0d, ...u32(0x4037f0));
  // Publish after UP. A caption change during DOWN would correctly invalidate
  // the still-unconfirmed character's pinned public scene.
  emit(0x81, 0x7d, 12, ...u32(0x101)); jump('zero', 0x85);
  push(0x403800); emit(0xff, 0x75, 8, 0xff, 0x15, ...u32(0x40131c));
  label('zero'); emit(0x31, 0xc0, 0xc9, 0xc2, 16, 0);
  const code = Buffer.from(a);
  for (const [o, n] of fix) { assert(labels.has(n)); code.writeInt32LE(labels.get(n) - o - 4, o); }
  assert(code.length < 0x400);
  b.fill(0, raw(0x2400), raw(0x2800)); code.copy(b, raw(0x2400));
  b.fill(0, raw(0x37f0), raw(0x3840));
  return b;
}
module.exports = { fixture };
