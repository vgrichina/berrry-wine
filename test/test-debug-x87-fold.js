#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const host = fs.readFileSync(path.join(root, 'host.js'), 'utf8');
const exportsWat = fs.readFileSync(path.join(root, 'src', '13-exports.wat'), 'utf8');

const toggle = html.match(/<input id="x87-fold-toggle"[^>]*>/);
assert(toggle, 'debug toolbar exposes the x87 fold toggle');
assert(/(?:^|\s)checked(?:\s|>)/.test(toggle[0]), 'x87 fold is default on');
assert(toggle[0].includes('onchange="setX87Fusion(this.checked)"'),
  'the toolbar updates the launch-time x87 setting');
assert(html.includes("has('no-x87-fold')"), 'the no-x87-fold URL opt-out is available to browser probes');

for (const setter of ['set_x87_pipeline4_fusion', 'set_x87_affine_fusion']) {
  assert(exportsWat.includes(`(export "${setter}")`), `${setter} is exported by the guest`);
  assert(host.includes(`this.instance.exports.${setter}(x87Fusion)`),
    `${setter} configures the browser-thread instance before decode`);
  assert(host.includes(`await this.guestWorker.callExport('${setter}', x87Fusion)`),
    `${setter} configures the live slot-0 Worker instance`);
  assert(host.includes(`recordInheritedWasmGlobal('${setter}', x87Fusion)`),
    `${setter} is inherited by future guest-thread instances`);
}

// The bisect gate. set_x87_fuse_debug has been exported by the guest since the
// fold landed and was reachable from no host at all, so a fold divergence that
// only appears in the browser could only be answered "fold on" or "fold off" --
// never "which family". These assertions are about REACHABILITY, which is the
// part that was missing; the mask's semantics are covered by the differential
// oracle in test-x87-pipeline4-fusion.js.
// Exported next to the gate it drives, in the matcher, not in 13-exports.wat.
const loopMatchWat = fs.readFileSync(
  path.join(root, 'src', '07b-loop-match.wat'), 'utf8');
assert(loopMatchWat.includes('(export "set_x87_fuse_debug")'),
  'set_x87_fuse_debug is exported by the guest');
assert(html.includes("get('x87-fuse-debug')"),
  'the ?x87-fuse-debug URL opt-in is available to browser probes');
assert(/x87FuseDebug/.test(html) && /x87Fusion = true/.test(html),
  'a mask implies the fold is armed, since a mask with the fold off is inert');
assert(host.includes('this.instance.exports.set_x87_fuse_debug('),
  'the mask configures the browser-thread instance before decode');
assert(host.includes("callExport('set_x87_fuse_debug'"),
  'the mask configures the live slot-0 Worker instance');
assert(host.includes("recordInheritedWasmGlobal('set_x87_fuse_debug'"),
  'the mask is inherited by future guest-thread instances');

// Same three-way reach on the CLI. applyMain() alone is the bug this catches:
// a guest thread decodes in its own instance, so a mask set only on the main
// one leaves every thread folding under the default -1 and the bisect reports
// on the one instance that is not doing the work.
const experiments = fs.readFileSync(
  path.join(__dirname, 'runner-experiments.js'), 'utf8');
const [inheritHalf, applyHalf] = experiments.split('function applyMain');
assert(applyHalf, 'runner-experiments still has an applyMain');
assert(inheritHalf.includes("inheritWasm('set_x87_fuse_debug'"),
  'the CLI mask is recorded for future guest threads, not just the main instance');
// Main-instance setters go through one visitor, visitMain(available, set),
// shared by applyMain (set = instance.exports[name]) and the Worker-owned
// applyMainOwned route, so the mask has to be in the visitor and both
// routes have to call it.
assert(/set\('set_x87_fuse_debug',/.test(inheritHalf.slice(inheritHalf.indexOf('function visitMain'))),
  'the CLI mask is one of the main-instance setters in visitMain');
assert(/visitMain\([^)]*instance\.exports\[name\]/.test(applyHalf.replace(/\s+/g, ' ')),
  'the CLI mask is applied to the main instance');
assert(/visitMain\(name => owner\.supports\(name\)/.test(
  experiments.slice(experiments.indexOf('function applyMainOwned'))),
  'the CLI mask is applied on the Worker-owned main route too');

const workerImports = fs.readFileSync(
  path.join(root, 'lib', 'worker-imports.js'), 'utf8');
assert(workerImports.includes("setter: 'set_x87_fuse_debug'"),
  'the Worker backends replay the mask like every other decode-time setter');

console.log('PASS  debug x87 fold is explicit, default-on, process-wide, and bisectable');
