'use strict';

// Pure byte-loader calls only: no Machine, CPU, WASM or guest execution.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadExe } = require('../tools/toyvm/dos');

function image(body = Buffer.from([0x34, 0x12, 0x90, 0xcb]), spots = []) {
  const header = Math.ceil((28 + spots.length * 4) / 16) * 16;
  const b = Buffer.alloc(header + body.length);
  b.write('MZ');
  b.writeUInt16LE(b.length % 512, 2);
  b.writeUInt16LE(Math.ceil(b.length / 512), 4);
  b.writeUInt16LE(spots.length, 6);
  b.writeUInt16LE(header / 16, 8);
  b.writeUInt16LE(0xffff, 12);
  b.writeUInt16LE(28, 24);
  spots.forEach((spot, i) => {
    b.writeUInt16LE(spot & 15, 28 + i * 4);
    b.writeUInt16LE(spot >>> 4, 30 + i * 4);
  });
  b.set(body, header);
  return b;
}

function rejectsWithoutWrites(bytes, options = {}, size = 65536) {
  const mem = new Uint8Array(size).fill(0xa5);
  const before = mem.slice();
  assert.throws(() => loadExe(mem, bytes, { loadSeg: 0x200, pspSeg: 0x100, ...options }));
  assert.deepEqual(mem, before, 'invalid input must not publish image, relocations or PSP');
}

test('truncated MZ declarations reject before any guest memory changes', () => {
  const b = image(); b.writeUInt16LE(128, 2);
  rejectsWithoutWrites(b);
  rejectsWithoutWrites(Buffer.from('MZ'));
  rejectsWithoutWrites(image().subarray(0, 33));
});

test('invalid size/header and relocation table bounds reject atomically', () => {
  for (const mutate of [
    b => b.writeUInt16LE(0, 4),
    b => b.writeUInt16LE(512, 2),
    b => b.writeUInt16LE(1, 8),
    b => b.writeUInt16LE(16, 8),
    b => { b.writeUInt16LE(1, 6); b.writeUInt16LE(31, 24); },
  ]) { const b = image(); mutate(b); rejectsWithoutWrites(b); }
});

test('relocations outside image cannot overwrite unrelated memory', () => {
  rejectsWithoutWrites(image(undefined, [4]));
  rejectsWithoutWrites(image(undefined, [0, 3]));
});

test('image and PSP destinations must fit before either is written', () => {
  rejectsWithoutWrites(image(), { loadSeg: 0xffff });
  rejectsWithoutWrites(image(), { pspSeg: 0xffff });
  for (const bad of [-1, 0x10000, 0.5, NaN]) {
    rejectsWithoutWrites(image(), { loadSeg: bad });
    rejectsWithoutWrites(image(), { pspSeg: bad });
  }
});

test('valid MZ/ZM images relocate sequentially and preserve surrounding bytes', () => {
  for (const signature of ['MZ', 'ZM']) {
    const b = image(undefined, [0, 0]); b.write(signature);
    const mem = new Uint8Array(65536).fill(0xa5);
    const result = loadExe(mem, b, { loadSeg: 0x200, pspSeg: 0x100 });
    assert.equal(result.imageBytes, 4);
    assert.deepEqual(Array.from(mem.slice(0x2000, 0x2004)), [0x34, 0x16, 0x90, 0xcb]);
    assert.equal(mem[0x1fff], 0xa5); assert.equal(mem[0x2004], 0xa5);
    assert.deepEqual(Array.from(mem.slice(0x1000, 0x1002)), [0xcd, 0x20]);
  }
});

test('whole-page MZ, appended overlay and COM dispatch retain their bytes', () => {
  const b = image(Buffer.alloc(480, 0x91));
  assert.equal(b.readUInt16LE(2), 0);
  const mem = new Uint8Array(65536);
  assert.equal(loadExe(mem, Buffer.concat([b, Buffer.from('overlay')]), { loadSeg: 0x200, pspSeg: 0x100 }).imageBytes, 480);
  assert.equal(mem[0x2000], 0x91);
  const com = loadExe(mem, Buffer.from([0xc3]), { pspSeg: 0x100 });
  assert.equal(com.ip, 0x100); assert.equal(mem[0x1100], 0xc3);
});
