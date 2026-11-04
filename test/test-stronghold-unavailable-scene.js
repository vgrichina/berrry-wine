'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { PNG } = require('pngjs');
const d = require('../tools/stronghold-unavailable-scene.cjs');
const root = path.resolve(__dirname, '..');
const result = d.audit(root);
assert.equal(result.runtimeReplay, false);
assert.equal(result.scenes.historicalShell.differingBytes, 0);
const rows = n => d.read(root, d.RECOVERED + n).toString().trim().split('\n').map(l => JSON.parse(l));
const fixture = () => [rows('transport-events.jsonl'), rows('transport-acks.jsonl'), rows('mailbox-requests.jsonl'),
  JSON.parse(d.read(root, d.RECOVERED + 'route-native-boundary-7.json')).state.main, rows('first-failures.jsonl')];
let negatives = 0;
for (const change of [
  f => f[0].at(-2).state.main.inputQueue.reverse(),
  f => f[0].at(-2).state.main.inputQueue[1].mouseX--,
  f => f[0].at(-2).state.main.inputQueue[0].hwnd++,
  f => f[0].at(-1).state.main.inputQueue[0].lParam++,
  f => f[0].at(-3).args[0] -= 5,
  f => f[0].at(-3).state.main.geometry.viewport.dstY += 10,
  f => f[0].push(f[0].at(-1)),
  f => f[1][100].result.guests[0].ran--,
  f => f[1][100].result.steps += 64,
  f => f[2].push({ i: 12, action: 'route-press-preset' }),
  f => f[3].inputQueue.push({ msg: 513 }),
  f => f[3].activeInput = {},
  f => f[3].mouseButtonsMask = 1,
  f => f[4] = [],
]) {
  const f = fixture(); change(f); assert.throws(() => d.verifyTransport(...f)); negatives++;
}
const png = PNG.sync.read(d.read(root, d.RECOVERED + 'route-native-boundary-7.png'));
// Whole game comparison covers text, map area, controls, background and edges.
for (const [x, y] of [[10, 194], [869, 861], [160, 415], [90, 735], [700, 300]]) {
  const changed = { ...png, data: Buffer.from(png.data) };
  changed.data[(y * png.width + x) * 4] ^= 1;
  assert.notEqual(d.sha(d.gamePixels(PNG.sync.write(changed))), d.SHELL); negatives++;
}
const toolbar = { ...png, data: Buffer.from(png.data) };
toolbar.data[(50 * png.width + 50) * 4] ^= 1;
assert.equal(d.sha(d.gamePixels(PNG.sync.write(toolbar))), d.SHELL, 'browser toolbar is excluded');
const transparent = { ...png, data: Buffer.from(png.data) };
transparent.data[(300 * png.width + 300) * 4 + 3] = 0;
assert.throws(() => d.gamePixels(PNG.sync.write(transparent))); negatives++;
assert.throws(() => d.gamePixels(PNG.sync.write(new PNG({ width: 800, height: 600 })))); negatives++;
const exe = Buffer.from(d.read(root, d.EXE)); exe[0x30e54] ^= 1;
assert.throws(() => d.auditNative(exe)); negatives++;
console.log(`PASS exact recovered inputs/174 ACKs/native branches/full game-shell equality; ${negatives} negative controls; no runtime replay`);
