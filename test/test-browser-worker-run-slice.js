#!/usr/bin/env node
'use strict';

// Jazz needs a small cooperative slice because its decoder otherwise occupies
// the browser thread for too long. Once its main guest actually lives in a
// Worker, applying that same slice just creates thousands of message round
// trips and starves the emulated CPU. Keep the distinction tied to the backend
// that successfully started, not merely to the user's Threads preference.

const assert = require('assert');
const { createBrowserShell, installRendererRunSlices } = require('../lib/browser-shell.js');
const { APPS, resolveRunSlice } = require('../lib/apps.js');

let selected = 'auto';
global.document = {
  getElementById(id) {
    return id === 'slice-size-select' ? { value: selected } : null;
  },
};
global.window = {};
global.WineAssembly = { supportsWasmTailCalls: () => true };

const shell = createBrowserShell({
  apps: APPS,
  resolveRunSlice,
  screenCanvasSize: () => ({ width: 800, height: 600 }),
});

assert.deepStrictEqual(APPS.jazz2_demo.runSlice,
  { cooperative: 1000, worker: 100000 },
  'the app registry owns Jazz scheduling rather than the browser shell');
assert.strictEqual(resolveRunSlice('notepad', false, false), 100000,
  'unconfigured tail-call apps retain the generic cooperative budget');
assert.strictEqual(resolveRunSlice('notepad', true, false), 100000,
  'compatibility dispatch gets the same ceiling; the 8ms deadline bounds the step');

assert.strictEqual(shell.selectedRunSlice('jazz2_demo'), 1000,
  'the default and cooperative Jazz path stays at 1k');
assert.strictEqual(shell.selectedRunSlice('jazz2_demo', false), 1000,
  'an explicit cooperative backend stays at 1k');
assert.strictEqual(shell.selectedRunSlice('jazz2_demo', true), 100000,
  'a confirmed Jazz guest Worker uses 100k');
assert.strictEqual(shell.selectedRunSlice('halflife_uplink', false), 10000,
  'cooperative Uplink gives OpenGL enough work per slice for gameplay');
assert.strictEqual(shell.selectedRunSlice('halflife_uplink', true), 10000,
  'the Worker override is app-scoped');
assert.strictEqual(shell.selectedRunSlice('cue:speed-demons', false), 500000,
  'Speed Demons Auto uses the measured installer/gameplay budget');
assert.strictEqual(shell.selectedRunSlice(
  'iso:sidmeieralphacentauriclassic-windows95', false), 500000,
  'the exact SMAC disc feeds synchronous Quick Start terrain generation');
assert.strictEqual(shell.selectedRunSlice('spider', false), 25000,
  'the shared card-game profile remains app-owned');
assert.strictEqual(shell.selectedRunSlice('spider', false),
  shell.selectedRunSlice('freecell', false),
  'card games share one registry scheduling policy');

selected = '10000';
assert.strictEqual(shell.selectedRunSlice('jazz2_demo', true), 10000,
  'an explicit slice dropdown selection remains authoritative');

global.WineAssembly.supportsWasmTailCalls = () => false;
selected = 'auto';
assert.strictEqual(shell.selectedRunSlice('jazz2_demo', true), 100000,
  'the Worker auto policy does not depend on the dispatch implementation');
assert.strictEqual(shell.selectedRunSlice('jazz2_demo', false), 1000,
  'the compatibility cooperative path remains bounded');
assert.strictEqual(shell.selectedRunSlice('notepad', false), 100000,
  'an unconfigured app is not starved under compatibility dispatch');
selected = '20000';
assert.strictEqual(shell.selectedRunSlice('spider', false), 20000,
  'a manual slice is authoritative under compatibility dispatch too');
selected = 'auto';

const fs = require('fs');
const path = require('path');
const { hasPageScript } = require('./browser-runtime-scripts');
const hostSource = fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8');
const shellSource = fs.readFileSync(path.join(__dirname, '..', 'lib/browser-shell.js'), 'utf8');
assert(hostSource.includes('const activeStepsPerSlice = Math.max(1, (self.stepsPerSlice | 0) || stepsPerSlice);'),
  'the cooperative host must honor browser-shell slices below 1k');
assert(hostSource.includes('const configuredSteps = Math.max(1000, (self.stepsPerSlice | 0) || stepsPerSlice);'),
  'the guest-Worker backend should retain its 1k messaging floor');
assert(hasPageScript('lib/browser-shell.js'),
  'the page centrally versions the Uplink slice policy');
assert(shellSource.includes("if (Number(change.data) === 2) applyRendererSlice('opengl');"),
  'Uplink keeps the setup quantum until a real DirectDraw frame selects Software');
assert(!shellSource.includes("applyRendererSlice(Number(change.data) === 2 ? 'opengl' : 'software')"),
  'the registry write must not throttle Software before renderer restart completes');
assert(hasPageScript('host.js'),
  'the page centrally versions cooperative slice enforcement');

// Exercise the actual presentation/write callbacks: DirectDraw is shared by
// software and D3D, and selecting Software must not throttle its setup UI.
const enginePath = 'HKCU\\Software\\Valve\\HLDemo\\Settings';
const log = { textContent: '', scrollHeight: 0 };
function rendererWine(worker, initialEngine = 3) {
  const wine = { guestWorker: worker ? {} : null, stepsPerSlice: 1000 };
  installRendererRunSlices(wine, { ...APPS.halflife_uplink,
    startupRegistry: [{ keyPath: enginePath, valueName: 'EngineType', data: initialEngine }],
  }, log);
  return wine;
}
const threaded = rendererWine(true);
threaded.onGuestFrame({ kind: 'directdraw' });
assert.strictEqual(threaded.stepsPerSlice, 10000, 'D3D Worker presents retain throughput budget');
threaded.onOpenGLContextCountChange(0);
assert.strictEqual(threaded.stepsPerSlice, 10000, 'tearing down a GL context does not misclassify D3D');
threaded.onRegistryValueChanged({ path: enginePath, name: 'EngineType', data: 1 });
assert.strictEqual(threaded.stepsPerSlice, 10000, 'Software setup retains its larger budget');
threaded.onGuestFrame({ kind: 'directdraw' });
assert.strictEqual(threaded.stepsPerSlice, 1000, 'actual Software presentation applies its small budget');
threaded.onRegistryValueChanged({ path: 'HKCU\\Other', name: 'EngineType', data: 3 });
threaded.onGuestFrame({ kind: 'directdraw' });
assert.strictEqual(threaded.stepsPerSlice, 1000, 'unrelated registry writes do not switch renderers');
threaded.onRegistryValueChanged({ path: enginePath, name: 'EngineType', data: 3 });
assert.strictEqual(threaded.stepsPerSlice, 10000, 'selecting Direct3D restores Worker throughput');
const cooperative = rendererWine(false);
cooperative.onGuestFrame({ kind: 'directdraw' });
assert.strictEqual(cooperative.stepsPerSlice, 1000, 'cooperative D3D policy remains unchanged');
cooperative.onRegistryValueChanged({ path: enginePath, name: 'EngineType', data: 2 });
assert.strictEqual(cooperative.stepsPerSlice, 10000, 'OpenGL still raises the setup budget immediately');
selected = '20000';
threaded.stepsPerSlice = 20000;
threaded.onGuestFrame({ kind: 'directdraw' });
assert.strictEqual(threaded.stepsPerSlice, 20000, 'automatic renderer policy respects a manual override');
selected = 'auto';
window.StorageImports = { exportStore: () => ({
  ['reg:' + enginePath]: JSON.stringify({ values: { EngineType: { type: 4, data: 3 } } }),
}) };
const restored = rendererWine(true, 2);
restored.onGuestFrame({ kind: 'directdraw' });
assert.strictEqual(restored.stepsPerSlice, 10000, 'restored D3D selection overrides the startup GL default');
delete window.StorageImports;

console.log('PASS browser run-slice policy: Worker/cooperative budgets and Uplink renderer transitions');
