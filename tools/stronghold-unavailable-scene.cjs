'use strict';
// Offline evidence audit only: no controller, input injection, or scene grant.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { PNG } = require('pngjs');
const { Win98Renderer } = require('../lib/renderer');
const RECOVERED = 'scratch/runs/20261104-stronghold-resolved-binding-native/recovered/browser/';
const EXE = 'test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe';
const SHELL = 'aab7b794070432d2ec1fbbe454218594c71d85129fb9d623af36f81599a5e8f9';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const PINS = {
  'transport-events.jsonl': '1fb025774230b55dfef85b2269c8bbd538815d5809a5a74131e00d4c4c10282a',
  'transport-acks.jsonl': '69a674e7e4d3e6bed8e932ce9c1a85c23c53888e7b8a890260402e103ce8d1d6',
  'mailbox-requests.jsonl': '8d2c5473704aec58c56410f55c1f153ac00b409fa75dcd5659dfe937bfb0d007',
  'first-failures.jsonl': '836508c45fcb82dd31254a5b670da87acccec1331284f08ebb02086162c0847a',
  'route-native-boundary-7.json': '890c95adb2a54ded88624a0180e48d6c178785aa8ff329cc4b24155a23629cf8',
  'route-native-boundary-7.png': '533a17d42b53e9ea7c2ec7b17734cc9a2219cc4868cc0dbf0d1d31bc14aec4ab',
};
function read(root, name) {
  const p = path.join(root, name);
  return fs.existsSync(p) ? fs.readFileSync(p) : zlib.gunzipSync(fs.readFileSync(p + '.gz'));
}
function gamePixels(bytes) {
  const p = PNG.sync.read(bytes);
  assert.equal(p.width, 1200); assert.equal(p.height, 900);
  const out = Buffer.alloc(860 * 668 * 4);
  for (let y = 0; y < 668; y++) {
    p.data.copy(out, y * 860 * 4, ((y + 194) * p.width + 10) * 4, ((y + 194) * p.width + 870) * 4);
  }
  for (let i = 3; i < out.length; i += 4) assert.equal(out[i], 255, 'opaque game pixels required');
  return out;
}
function mapClient(g, client) {
  // Production browser-input's first floor, then real renderer inverse mapping.
  const x = Math.floor((client[0] - g.rect.left) * g.width / g.rect.width);
  const y = Math.floor((client[1] - g.rect.top) * g.height / g.rect.height);
  const renderer = Object.create(Win98Renderer.prototype);
  renderer.canvas = { width: g.width, height: g.height };
  renderer._exclusivePresentationViewport = g.viewport;
  return renderer.mapCanvasPoint(x, y);
}
function verifyTransport(events, acks, commands, terminal, failure) {
  assert.equal(acks.length, 174);
  acks.forEach((a, i) => {
    assert.equal(a.requested, 64); assert.equal(a.result.requested, 64);
    assert.equal(a.result.ran, 64); assert.equal(a.result.steps, (i + 1) * 64);
    assert.equal(a.result.guests.length, 1);
    assert.equal(a.result.guests[0].requested, 64); assert.equal(a.result.guests[0].ran, 64);
  });
  assert.deepEqual(commands.map(c => c.i), Array.from({ length: 12 }, (_, i) => i));
  assert.deepEqual(commands.slice(5).map(c => c.action), ['title-enter', 'menu-crusader', 'install-route',
    'route-review-choose', 'route-review-hover', 'route-gesture', 'route-arrival']);
  const live = events.filter(e => e.state.main.tick.steps > 0);
  assert.equal(live.length, 6, 'exactly two game mouse gestures');
  const summary = [];
  for (let i = 0; i < live.length; i++) {
    const e = live[i], m = e.state.main, gesture = i < 3 ? 0 : 1, phase = i % 3;
    const [x, y, start] = gesture ? [543, 292, 10560] : [304, 144, 10368];
    const mask = phase === 1 ? 1 : 0, messages = [[512], [132, 513], [514]][phase];
    assert.equal(e.action, ['move', 'down', 'up'][phase]);
    assert.equal(m.tick.steps, start + phase * 64);
    assert.deepEqual(m.inputQueue.map(q => q.msg), messages);
    assert.equal(m.mouseButtonsMask, mask);
    for (const q of m.inputQueue) {
      assert.equal(q.hwnd, 65537); assert.equal(q.mouseX, x); assert.equal(q.mouseY, y);
      assert.equal(q.mouseButtons, mask); assert.equal(q.wParam, q.msg === 132 ? 0 : mask);
      assert.equal(q.lParam >>> 0, ((y << 16) | x) >>> 0);
    }
    if (phase === 0) {
      assert.deepEqual(mapClient(m.geometry, e.args), { x, y });
      summary.push({ client: e.args, native: [x, y], step: start });
    }
  }
  assert.equal(terminal.tick.steps, 11136);
  assert.deepEqual(terminal.inputQueue, []); assert.equal(terminal.activeInput, null);
  assert.equal(terminal.lastInput, null); assert.equal(terminal.mouseButtonsMask, 0);
  assert.equal(failure.length, 1); assert.equal(failure[0].i, 11);
  assert.equal(failure[0].error, 'Error: first unexpected natural scene: demo-selection-unavailable');
  return summary;
}
function auditNative(b) {
  assert.equal(sha(b), '9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f');
  // This PE's relevant sections have raw offset == RVA. Check that assumption.
  const pe = b.readUInt32LE(0x3c), opt = pe + 24;
  assert.equal(b.readUInt32LE(opt + 28), 0x400000);
  const sections = opt + b.readUInt16LE(pe + 20);
  const offset = va => {
    const rva = va - 0x400000;
    for (let i = 0; i < b.readUInt16LE(pe + 6); i++) {
      const s = sections + i * 40, start = b.readUInt32LE(s + 12), size = b.readUInt32LE(s + 16);
      if (rva >= start && rva < start + size) return b.readUInt32LE(s + 20) + rva - start;
    }
    throw Error('unmapped original VA');
  };
  const bytes = (va, hex) => assert.equal(b.subarray(offset(va), offset(va) + hex.length / 2).toString('hex'), hex);
  const u32 = va => b.readUInt32LE(offset(va));
  assert.equal(u32(0x5bd0ac), 0x430e10);
  assert.deepEqual([u32(0x5bd13c), u32(0x5bd140), u32(0x5bd150), u32(0x5bd158)], [416, 201, 2, 527]);
  bytes(0x430e2a, '83f801751733dbb95837d100536a39');
  bytes(0x430e46, '83f8020f85c60000005633db57536a14');
  bytes(0x430e71, 'e8dad10300e88582ffff');
  return { callback: '0x430e10', trail: { button: 1, request: 57 }, custom: { button: 2, request: 20 },
    sceneRequestCall: '0x430e71', subsequentInitializationCall: '0x429100', executedInRecoveredAttempt: 'unknown' };
}
function audit(root = path.resolve(__dirname, '..')) {
  const references = [];
  const load = name => {
    const b = read(root, name);
    references.push({ path: name, bytes: b.length, sha256: sha(b) }); return b;
  };
  for (const [name, pin] of Object.entries(PINS)) assert.equal(sha(load(RECOVERED + name)), pin, name);
  const json = name => JSON.parse(read(root, RECOVERED + name));
  const rows = name => read(root, RECOVERED + name).toString().trim().split('\n').map(l => JSON.parse(l));
  const terminal = json('route-native-boundary-7.json');
  const gestures = verifyTransport(rows('transport-events.jsonl'), rows('transport-acks.jsonl'),
    rows('mailbox-requests.jsonl'), terminal.state.main, rows('first-failures.jsonl'));
  const actual = gamePixels(read(root, RECOVERED + 'route-native-boundary-7.png'));
  assert.equal(sha(actual), SHELL);
  const scenes = {};
  for (const [name, file] of Object.entries({
    historicalShell: '20261104-stronghold-browser-village/review/custom-skirmish.png',
    trail: '20261104-stronghold-explicit-idle-input/review/skirmish-selection.png',
    zephyrHover: '20261104-stronghold-browser-village/review/zephyr-veryeasy.png',
    zephyrReady: '20261104-stronghold-browser-village/review/zephyr-ready.png',
  })) {
    const pixels = gamePixels(load('scratch/runs/' + file));
    scenes[name] = { gameRGBAsha256: sha(pixels), differingBytes: pixels.reduce((n, v, i) => n + (v !== actual[i]), 0) };
  }
  assert.equal(scenes.historicalShell.differingBytes, 0);
  for (const name of ['trail', 'zephyrHover', 'zephyrReady']) assert(scenes[name].differingBytes > 0);
  const native = auditNative(load(EXE));
  const oldInput = JSON.parse(load('scratch/runs/20261104-stronghold-browser-village/recovered/browser/input-202.json'));
  const oldQueue = (oldInput.state || oldInput).main.inputQueue;
  assert(oldQueue.some(q => q.msg === 513 && q.mouseX === 543 && q.mouseY === 292), 'historical native Custom Game down');
  const composition = JSON.parse(load('scratch/runs/20261104-stronghold-resolved-binding-native/recovered/attached-original-composition.json'));
  const routeSources = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.path === 'string' && !path.isAbsolute(value.path) &&
        /\/(route-driver|navigation|integer-route-point)\.cjs$/.test(value.path)) {
      assert.equal(sha(load(value.path)), value.sha256, 'original retained route helper');
      routeSources.push(value);
    }
    for (const v of Object.values(value)) visit(v);
  }
  visit(composition);
  assert(routeSources.length >= 7, 'retained route closure required');
  return { offlineOnly: true, runtimeReplay: false, firstFailurePreserved: true,
    gestures, completeACKs: 174, terminalSteps: 11136, gameRect: [10, 194, 860, 668], scenes, native,
    conclusion: 'Exact historical Custom Game shell; no demonstrated input geometry or route defect.',
    missing: 'Same-attempt callback/initialization and subsequent input-free presentation history.',
    routeSources, references };
}
if (require.main === module) {
  const result = audit();
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, conclusion: result.conclusion, completeACKs: result.completeACKs }));
}
module.exports = { audit, auditNative, verifyTransport, gamePixels, mapClient, read, sha, RECOVERED, EXE, SHELL };
