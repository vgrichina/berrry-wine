#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  PRESENTATION_CRT_KEY,
  PRESENTATION_SCALE_KEY,
  RUNTIME_LOG_KEY,
  createPageSettings,
  normalize2dScalingMode,
  normalizeCrtEffects,
} = require('../lib/page-settings');
const { hasPageScript } = require('./browser-runtime-scripts');

const ROOT = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

assert.strictEqual(normalize2dScalingMode('scale2x'), 'scale-auto');
assert.strictEqual(normalize2dScalingMode('scale3x'), 'scale-auto');
assert.strictEqual(normalize2dScalingMode('sharp-hq'), 'sharp-hq');
assert.strictEqual(normalize2dScalingMode('bogus'), 'nearest');
// The old three-checkbox preference maps onto a preset: any on -> VGA.
assert.deepStrictEqual(normalizeCrtEffects({ scanlines: 1, mask: 0, glow: 'yes' }),
  { preset: 'vga', curvature: false, persistence: false });
assert.deepStrictEqual(normalizeCrtEffects({ scanlines: false, mask: false, glow: false }),
  { preset: 'off', curvature: false, persistence: false });
assert.deepStrictEqual(normalizeCrtEffects(null),
  { preset: 'off', curvature: false, persistence: false },
  'a user who never enabled CRT stays at Off');
assert.deepStrictEqual(normalizeCrtEffects({ preset: 'arcade', curvature: 1 }),
  { preset: 'arcade', curvature: true, persistence: false });
assert.deepStrictEqual(normalizeCrtEffects({ preset: 'bogus', scanlines: true }),
  { preset: 'off', curvature: false, persistence: false },
  'an explicit but unknown preset fails closed to Off');

const values = new Map([
  [RUNTIME_LOG_KEY, '1'],
  [PRESENTATION_SCALE_KEY, 'scale2x'],
  // Left behind by the removed dedither control; it must simply be ignored.
  ['wine-assembly:dedither', 'checkerboard'],
  [PRESENTATION_CRT_KEY, JSON.stringify({ scanlines: true, mask: false, glow: true })],
]);
const writes = [];
const storage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) {
    values.set(key, value);
    writes.push([key, value]);
  },
};
const elements = new Map([
  ['runtime-log-toggle', { checked: true }],
  ['presentation-scale-select', { value: 'nearest' }],
  ['crt-preset-select', { value: 'off' }],
  ['crt-curvature-toggle', { checked: false }],
  ['crt-persistence-toggle', { checked: false }],
]);
const document = { getElementById: id => elements.get(id) || null };
const pageWindow = { location: { search: '?debug&no-log' } };
const calls = [];
const renderer = {
  setPresentationScaleMode(value) { calls.push(['scale', value]); },
  setPresentationEffects(value) { calls.push(['crt', value]); },
};
const settings = createPageSettings({
  window: pageWindow,
  document,
  storage,
  getRenderer: () => renderer,
});

assert.strictEqual(pageWindow.WINE_RUNTIME_LOGGING, false,
  '?no-log should override the saved preference for this session');
assert.strictEqual(elements.get('runtime-log-toggle').checked, false);
assert.strictEqual(values.get(RUNTIME_LOG_KEY), '1',
  'the session-only no-log override must not rewrite the preference');
assert.strictEqual(pageWindow.WINE_2D_SCALE_MODE, 'scale-auto');
assert.strictEqual(elements.get('presentation-scale-select').value, 'scale-auto');
assert(!('WINE_DEDITHER_MODE' in pageWindow), 'a stale dedither preference is ignored');
assert.strictEqual(values.get('wine-assembly:dedither'), 'checkerboard',
  'the stale dedither preference is left untouched, not migrated');
assert.deepStrictEqual(pageWindow.WINE_CRT_EFFECTS,
  { preset: 'vga', curvature: false, persistence: false },
  'a saved legacy CRT preference should restore as the VGA preset');
assert.strictEqual(elements.get('crt-preset-select').value, 'vga');
assert.strictEqual(elements.get('crt-curvature-toggle').checked, false);
assert.strictEqual(elements.get('crt-persistence-toggle').checked, false);

assert.strictEqual(settings.setRuntimeLogging(true), true);
assert.strictEqual(pageWindow.WINE_RUNTIME_LOGGING, true);
assert.deepStrictEqual(writes.pop(), [RUNTIME_LOG_KEY, '1']);

assert.strictEqual(settings.apply2dScalingMode('unknown'), 'nearest');
assert.strictEqual(pageWindow.WINE_2D_SCALE_MODE, 'nearest');
assert.deepStrictEqual(calls.pop(), ['scale', 'nearest']);
assert.deepStrictEqual(writes.pop(), [PRESENTATION_SCALE_KEY, 'nearest']);

assert(!('applyDeditherMode' in settings));
assert(!writes.some(([key]) => key === 'wine-assembly:dedither'));

elements.get('crt-preset-select').value = 'arcade';
elements.get('crt-curvature-toggle').checked = true;
elements.get('crt-persistence-toggle').checked = false;
const arcade = { preset: 'arcade', curvature: true, persistence: false };
assert.deepStrictEqual(settings.applyCrtEffects(), arcade);
assert.deepStrictEqual(pageWindow.WINE_CRT_EFFECTS, arcade);
assert.deepStrictEqual(calls.pop(), ['crt', arcade]);
assert.deepStrictEqual(writes.pop(), [PRESENTATION_CRT_KEY, JSON.stringify(arcade)]);

// No saved preference at all: CRT is Off, and the select shows it.
{
  const fresh = new Map([['crt-preset-select', { value: 'vga' }]]);
  const freshWindow = { location: { search: '' } };
  createPageSettings({
    window: freshWindow,
    document: { getElementById: id => fresh.get(id) || null },
    storage: { getItem: () => null, setItem() {} },
    getRenderer: () => null,
  });
  assert.deepStrictEqual(freshWindow.WINE_CRT_EFFECTS,
    { preset: 'off', curvature: false, persistence: false });
  assert.strictEqual(fresh.get('crt-preset-select').value, 'off');
}

assert.doesNotThrow(() => createPageSettings({
  window: {},
  document: { getElementById: () => null },
  storage: {
    getItem() { throw new Error('storage denied'); },
    setItem() { throw new Error('storage denied'); },
  },
  getRenderer: () => null,
}));

assert(hasPageScript('lib/page-settings.js'),
  'the browser runtime graph should load the settings controller');
assert(indexSource.includes('window.setRuntimeLogging = pageSettingsController.setRuntimeLogging'));
assert(indexSource.includes('window.apply2dScalingMode = pageSettingsController.apply2dScalingMode'));
assert(!indexSource.includes('applyDeditherMode'));
assert(indexSource.includes('window.applyCrtEffects = pageSettingsController.applyCrtEffects'));
assert(!indexSource.includes("const PRESENTATION_SCALE_KEY = 'wine-assembly:2d-scale'"),
  'preference implementation should not regress into the page template');

console.log('PASS  page settings normalize, restore, persist, and apply through one controller');
