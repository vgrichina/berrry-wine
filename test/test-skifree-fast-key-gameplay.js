#!/usr/bin/env node
// The phone overlay's "Fast" pill for SkiFree, pinned to what ski32.exe
// actually honours.
//
// The pill used to be `{ vk: 0x46 }` — a WM_KEYDOWN of the 'F' virtual key —
// and it did nothing at all. ski32.exe's wndproc (0x405800) splits keyboard
// input two ways:
//
//   WM_KEYDOWN (0x100) -> 0x406170, a jump table at 0x4063a8 indexed through
//     0x4063bc for virtual keys 0x0d..0x72. Only four entries are not the
//     default: RETURN (0x0d), ESCAPE (0x1b), F2 (0x71) and F3 (0x72). Virtual
//     key 0x46 lands on the default arm and is discarded.
//   WM_CHAR (0x102) -> 0x406780, a jump table at 0x40684c indexed through
//     0x40686c for characters 0x58..0x79. Lowercase 'f' (0x66) reaches
//     0x4067a0, which toggles the speed flag at 0x40c670 between 0 and 1.
//     Uppercase 'F' (0x46) is below the range and is discarded too.
//
// So the speed key is a *character*, and specifically a lowercase one. This
// test holds three things together, because any one of them alone would let
// the bug back in:
//
//   1. the binary still decodes that way (read out of the exe, not asserted
//      from memory),
//   2. the ski32 entry in lib/apps.js still declares a `char` the overlay can
//      send, and tapping the real pill through lib/touch-controls.js emits it,
//   3. the running guest's flag at 0x40c670 changes on that character and does
//      NOT change on the bare virtual key — speed is a rate, so a screenshot
//      cannot show it and only the flag is honest evidence.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RUN = path.join(__dirname, 'run.js');
const EXE = path.join(__dirname, 'binaries', 'entertainment-pack', 'ski32.exe');

if (!fs.existsSync(EXE)) {
  console.log('SKIP  ski32.exe not found');
  process.exit(0);
}

// Addresses named above. FAST_FLAG is the one the guest half watches.
const CHAR_TABLE_FIRST = 0x58;   // lea eax,[ecx-0x58]
const CHAR_TABLE_LAST = 0x79;    // cmp eax,0x21 / ja default
const CHAR_INDEX_TABLE = 0x40686c;
const CHAR_JUMP_TABLE = 0x40684c;
const CHAR_DEFAULT_ARM = 0x40684a; // a bare `ret`
const FAST_CHAR = 0x66;          // 'f'
const FAST_VK = 0x46;            // 'F' as a virtual key — the old, dead binding
const FAST_FLAG = 0x40c670;

// --- 1. the binary --------------------------------------------------------

const { readPE } = require('../lib/pe');
const pe = readPE(EXE);

function charArm(code) {
  if (code < CHAR_TABLE_FIRST || code > CHAR_TABLE_LAST) return null; // out of range
  const idxOff = pe.va2off(CHAR_INDEX_TABLE + (code - CHAR_TABLE_FIRST));
  const slot = pe.buf.readUInt8(idxOff);
  const armOff = pe.va2off(CHAR_JUMP_TABLE + slot * 4);
  return pe.buf.readUInt32LE(armOff);
}

const fastArm = charArm(FAST_CHAR);
assert.ok(fastArm && fastArm !== CHAR_DEFAULT_ARM,
  `ski32 WM_CHAR 'f' (0x66) must reach a real arm, got ${fastArm && fastArm.toString(16)}`);
assert.strictEqual(charArm(FAST_VK), null,
  "uppercase 'F' (0x46) is outside ski32's 0x58..0x79 WM_CHAR table — the pill " +
  'cannot send it as a character either');

// The arm really is the toggle of FAST_FLAG: `mov eax,[flag] / xor edx,edx /
// test eax,eax / setz dl / mov [flag],edx / ret`.
const armOff = pe.va2off(fastArm);
const armBytes = pe.buf.subarray(armOff, armOff + 19);
assert.strictEqual(armBytes.readUInt8(0), 0xa1, "'f' arm starts with mov eax,[imm32]");
assert.strictEqual(armBytes.readUInt32LE(1), FAST_FLAG,
  `'f' arm reads the speed flag at 0x${FAST_FLAG.toString(16)}`);
assert.strictEqual(armBytes.readUInt8(12), 0x89, "'f' arm writes the flag back");
assert.strictEqual(armBytes.readUInt32LE(14), FAST_FLAG,
  "'f' arm stores to the same flag — it is a toggle, not a hold");

// F2 is a virtual key here, which is why the "New game" pill is right as-is.
const KEY_TABLE_FIRST = 0x0d;
const KEY_INDEX_TABLE = 0x4063bc;
const KEY_JUMP_TABLE = 0x4063a8;
function keyArm(vk) {
  if (vk < KEY_TABLE_FIRST || vk > 0x72) return null;
  const slot = pe.buf.readUInt8(pe.va2off(KEY_INDEX_TABLE + (vk - KEY_TABLE_FIRST)));
  return { slot, target: pe.buf.readUInt32LE(pe.va2off(KEY_JUMP_TABLE + slot * 4)) };
}
const DEFAULT_KEY_SLOT = keyArm(0x41).slot; // 'A' — certainly not handled
assert.notStrictEqual(keyArm(0x71).slot, DEFAULT_KEY_SLOT,
  'F2 (0x71) is a handled virtual key');
assert.strictEqual(keyArm(FAST_VK).slot, DEFAULT_KEY_SLOT,
  'virtual key 0x46 falls on the default arm — a WM_KEYDOWN of F is discarded');

console.log('ok  binary: WM_CHAR 0x66 toggles 0x40c670; vk 0x46 is discarded');

// --- 2. the registry entry, tapped through the real overlay ---------------

// A fake DOM small enough to press a button in, same shape as
// test/test-touch-controls.js.
function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    parentNode: null,
    style: {},
    className: '',
    _classes: new Set(),
    _handlers: new Map(),
    classList: {
      add: (n) => el._classes.add(n),
      remove: (n) => el._classes.delete(n),
      contains: (n) => el._classes.has(n),
    },
    attributes: {},
    setAttribute(name, value) { el.attributes[name] = String(value); },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(el.attributes, name)
        ? el.attributes[name] : null;
    },
    innerHTML: '',
    appendChild(child) { child.parentNode = el; el.children.push(child); return child; },
    removeChild(child) {
      const i = el.children.indexOf(child);
      if (i >= 0) el.children.splice(i, 1);
      child.parentNode = null;
      return child;
    },
    addEventListener(type, fn) {
      if (!el._handlers.has(type)) el._handlers.set(type, []);
      el._handlers.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = el._handlers.get(type) || [];
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
    getBoundingClientRect: () => el._rect || { left: 0, top: 0, width: 0, height: 0 },
    dispatch(type, event) {
      for (const fn of (el._handlers.get(type) || []).slice()) fn(event);
    },
    get firstChild() { return el.children[0] || null; },
  };
  return el;
}

const body = makeEl('body');
const wrap = makeEl('div');
global.document = {
  head: makeEl('head'),
  body,
  createElement: (tag) => makeEl(tag),
  getElementById: (id) => (id === 'screen-wrap' ? wrap : null),
  addEventListener: (...a) => body.addEventListener(...a),
  removeEventListener: (...a) => body.removeEventListener(...a),
};
global.window = { addEventListener() {}, removeEventListener() {}, innerHeight: 844 };
global.location = { search: '' };

const touchEvent = (changed) => ({
  changedTouches: changed, touches: changed,
  preventDefault() {}, stopPropagation() {},
});
const touch = (identifier) => ({ identifier, clientX: 0, clientY: 0 });

const TouchControls = require('../lib/touch-controls');
const APPS = require('../lib/apps');
const registry = APPS.APPS || APPS.apps || APPS;
const ski = registry.ski32 || (registry.APPS && registry.APPS.ski32);
assert.ok(ski && ski.touchControls, 'lib/apps.js still declares ski32 touchControls');

const events = [];
const renderer = {
  handleKeyDown: (vk) => events.push(['down', vk]),
  handleKeyUp: (vk) => events.push(['up', vk]),
  handleKeyPress: (code) => events.push(['char', code]),
};

try {
  TouchControls.install({ document: global.document, renderer });
  TouchControls.setLayout(ski.touchControls);

  const flat = [];
  (function walk(node) { for (const c of node.children) { flat.push(c); walk(c); } })(TouchControls.el);
  const buttons = flat.filter(el => el.className === 'tc-btn');
  const byLabel = (label) => {
    const el = buttons.find(b => b.textContent === label);
    assert.ok(el, `the ski32 overlay renders a "${label}" button`);
    return el;
  };

  const fastBtn = byLabel('Fast');
  events.length = 0;
  fastBtn.dispatch('touchstart', touchEvent([touch(1)]));
  fastBtn.dispatch('touchend', touchEvent([touch(1)]));
  assert.deepStrictEqual(events, [['down', FAST_VK], ['char', FAST_CHAR]],
    'the release waits out the minimum key hold');
  TouchControls.releaseAll();   // delivers the deferred release now
  assert.deepStrictEqual(events, [['down', FAST_VK], ['char', FAST_CHAR], ['up', FAST_VK]],
    'tapping Fast sends the WM_CHAR the game reads, not only the virtual key ' +
    'it discards — and sends it exactly once per tap');

  const newGameBtn = byLabel('New game');
  events.length = 0;
  newGameBtn.dispatch('touchstart', touchEvent([touch(2)]));
  newGameBtn.dispatch('touchend', touchEvent([touch(2)]));
  assert.ok(events.some(e => e[0] === 'down' && e[1] === 0x71),
    'New game still presses F2');
  assert.ok(!events.some(e => e[0] === 'char'),
    'New game sends no character — F2 is a virtual key in this binary');

  console.log('ok  overlay: the registry\'s Fast pill emits char 0x66 once per tap');
} finally {
  // The overlay owns a layout polling timer, listeners, and deferred keyups.
  TouchControls.destroy();
}

// --- 3. the running guest -------------------------------------------------

// One run carries both stimuli: the dead virtual key first, then two taps of
// the character. A watchpoint on the flag is the measurement; a capture cannot
// show a speed.
const INPUT = [
  '300:keydown:0x46', '320:keyup:0x46',   // the old binding — must change nothing
  '500:keypress:0x66',                    // the new one — must toggle
  '700:keypress:0x66',                    // and toggle back
].join(',');

const args = [
  RUN, '--app=ski32', '--no-close', '--quiet-api', '--quiet-blocks',
  `--watch=0x${FAST_FLAG.toString(16)}`, '--watch-log',
  `--input=${INPUT}`,
  '--max-batches=900', '--max-seconds=120',
];
console.log('$ node test/run.js ' + args.slice(1).join(' '));
const out = execFileSync('node', args, {
  encoding: 'utf-8', cwd: ROOT, timeout: 240000,
  stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
});

const hits = out.split('\n')
  .map(line => /^\*\*\* WATCHPOINT hit at batch (\d+)/.exec(line.trim()))
  .filter(Boolean)
  .map(m => Number(m[1]));

assert.ok(out.includes('[input] keydown vk=70'), 'the run delivered the vk 0x46 keydown');
assert.ok(out.includes('[input] keypress code=102 at batch 500'),
  "the run delivered the 'f' character at batch 500");

// The flag must be untouched across the whole vk window: the keydown lands at
// 300 and nothing else is injected before 500.
const duringVk = hits.filter(b => b >= 300 && b < 500);
assert.deepStrictEqual(duringVk, [],
  `WM_KEYDOWN of vk 0x46 must not move the speed flag (hits: ${duringVk.join(',')})`);

// Each character must move it, within a batch of its injection.
const nearFirst = hits.filter(b => b >= 500 && b <= 502);
const nearSecond = hits.filter(b => b >= 700 && b <= 702);
assert.strictEqual(nearFirst.length, 1,
  `the first 'f' must toggle 0x40c670 exactly once (hits: ${hits.join(',')})`);
assert.strictEqual(nearSecond.length, 1,
  `the second 'f' must toggle it back exactly once (hits: ${hits.join(',')})`);

console.log(`ok  guest: 0x40c670 toggled at batches ${hits.join(', ')}; ` +
  'unchanged for the whole vk-only window');
console.log('PASS  test-skifree-fast-key-gameplay');
