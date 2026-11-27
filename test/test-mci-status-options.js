#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createHostImports } = require('../lib/host-imports');
const { VirtualFS } = require('../lib/filesystem');

// Literal format-0 SMF, 96 PPQN, default 500000 us/quarter: one note
// from tick 0 to tick 96. The track has exactly 12 bytes, including EOT.
const midi = Uint8Array.from([
  0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 0x60,
  0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 12,
  0, 0x90, 0x3c, 0x64, 0x60, 0x80, 0x3c, 0, 0, 0xff, 0x2f, 0,
]);
const memory = new ArrayBuffer(65536);
const bytes = new Uint8Array(memory);
const vfs = new VirtualFS();
vfs.files.set(vfs._resolvePath('music one!take.mid'), { data: midi, attrs: 0x20 });
const ctx = { getMemory: () => memory, vfs };
const { host } = createHostImports(ctx);
const commandAt = 0x100, resultAt = 0x800, paramsAt = 0x900;
let passed = 0;
const failures = [];
function check(label, fn) {
  try { fn(); passed++; }
  catch (error) { failures.push(`${label}: ${error.message}`); }
}
function write(text) {
  bytes.set(Buffer.from(text + '\0', 'ascii'), commandAt);
  return commandAt;
}
function command(text) {
  write(text);
  const before = bytes.slice();
  const code = host.mci_string(commandAt, 0, 0);
  assert.deepStrictEqual(bytes, before, `${text}: no return buffer means no memory writes`);
  return code;
}
function status(device, option, expected, length = 16, pointer = resultAt) {
  const text = `status ${device}${option ? ' ' + option : ''}`;
  write(text);
  bytes.fill(0xa5, resultAt - 8, resultAt + 40);
  const before = bytes.slice(), wanted = before.slice();
  if (pointer && length > 0) {
    const value = Buffer.from(expected, 'ascii').subarray(0, length - 1);
    wanted.set(value, pointer);
    wanted[pointer + value.length] = 0;
  }
  const code = host.mci_string(commandAt, pointer, length);
  check(`${text} len=${length} ptr=${pointer}`, () => {
    assert.strictEqual(code, 0);
    // Compare the entire memory, including command, return tail and neighbors.
    assert.deepStrictEqual(bytes, wanted);
  });
  return { code, buffer: bytes.slice(resultAt - 8, resultAt + 40) };
}
function numericStatus(id, item, expected) {
  bytes.fill(0xb6, paramsAt - 8, paramsAt + 24);
  const dv = new DataView(memory);
  dv.setUint32(paramsAt + 8, item, true);
  const wanted = bytes.slice();
  new DataView(wanted.buffer).setUint32(paramsAt + 4, expected, true);
  assert.strictEqual(host.mci_command(id, 0x0814, 0x100, paramsAt), 0);
  assert.deepStrictEqual(bytes, wanted, 'numeric MCI_STATUS writes only dwReturn');
}

for (const alias of ['length', 'position', 'mode', 'song', 'length mode', 'track']) {
  const quoted = `"${alias}"`;
  assert.strictEqual(command(`open "sequencer!music one!take.mid" alias ${quoted}`), 0);
  const id = host.mci_get_device_id(write(alias.toUpperCase()));
  assert(id > 0, 'public case-insensitive lookup resolves actual opened device');
  try {
    const dev = ctx._mci.devices.get(id);
    assert.strictEqual(dev.type, 'sequencer');
    assert.strictEqual(dev.element, 'music one!take.mid', 'only first compound separator is stripped');
    assert.strictEqual(dev.smf.notes.length, 1, 'actual VFS bytes parsed successfully');
    numericStatus(id, 4, 525);
    numericStatus(id, 3, 1);
    const numericMode = status(id, 'mode', 'stopped');
    const numericTracks = status(id, 'tracks', '1');
    const aliasMode = status(quoted, 'MoDe', 'stopped');
    const aliasTracks = status(quoted, 'tracks', '1');
    check(`${alias}: alias and same-device numeric mode/tracks agree`, () => {
      assert.deepStrictEqual(aliasMode, numericMode);
      assert.deepStrictEqual(aliasTracks, numericTracks);
    });
    // Options keep their established priority, regardless of token order.
    status(quoted, 'tracks mode position length', '500');
    status(quoted, 'tracks mode position', '0');
    if (alias === 'song') {
      for (const [option, value] of [['length', '500'], ['position', '0'], ['mode', 'stopped'], ['tracks', '1'], ['', '']]) {
        status(quoted, option, value);
      }
      for (const length of [0, 1, 4, 8]) status(quoted, 'mode', 'stopped', length);
      status(quoted, 'mode', 'stopped', 16, 0);
    }
  } finally {
    assert.strictEqual(command(`close ${quoted}`), 0);
  }
  assert.strictEqual(host.mci_get_device_id(write(alias)), 0, 'close removes alias');
  assert.strictEqual(command(`status ${id} mode`), 0x106, 'closed numeric device is invalid');
}
assert.deepStrictEqual(vfs.files.get(vfs._resolvePath('music one!take.mid')).data, midi);
assert.strictEqual(ctx._mci.devices.size, 0, 'no devices retained');
assert.strictEqual(ctx._mci.aliases.size, 0, 'no aliases retained');
console.log(`test-mci-status-options: ${passed} passed, ${failures.length} failed`);
for (const failure of failures) console.error(failure);
process.exitCode = failures.length ? 1 : 0;
