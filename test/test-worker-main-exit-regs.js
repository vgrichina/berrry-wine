#!/usr/bin/env node
'use strict';

// With Threads on, the guest main runs in a Worker and the page keeps an idle
// instance. "--- Program exited (worker) ---" used to read its registers from
// that idle instance, so Hitman's NULL vtable call at EngineData+0x0ff6da17
// was reported as last block 0x00000000 with every register zero. The slice
// reply carries the Worker's own registers when it ends at EIP 0; the report
// must print those. The unsolicited writerRegistered message is also no
// longer logged as "unexpected" next to it.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8');
const context = {
  console, URLSearchParams,
  performance: { now: () => 0 },
  requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
  setTimeout() { return 1; }, clearTimeout() {},
};
vm.runInNewContext(source + '\n;globalThis.WineAssembly = WineAssembly;', context);

assert(/Program exited \(worker\) --- \$\{self\._exitSiteText\(r\)\}/.test(source),
  'the Worker-main exit report passes its slice reply');

const wine = Object.create(context.WineAssembly.prototype);
// The idle page instance: everything zero.
wine.instance = { exports: { get_dbg_prev_eip: () => 0, get_eax: () => 0 } };
wine.moduleBases = {
  'enginedata.dll': { loadAddr: 0x971000, origBase: 0x0ff60000 },
  enginedata: { loadAddr: 0x971000, origBase: 0x0ff60000 },
};
const text = wine._exitSiteText({ eip: 0, yield: 0, regs: {
  prevEip: 0x0097ea17, prev2Eip: 0x0097e9e0, eax: 0, ebx: 0x7eef96f8, ecx: 0x12,
  edx: 0, esi: 0, edi: 0x7ef41ca0, ebp: 0x074f7260, esp: 0x074f7228,
} });
assert(text.includes('last block 0x0097ea17 (enginedata.dll+0x0ff6da17)'), text);
assert(text.includes('before it 0x0097e9e0 (enginedata.dll+0x0ff6d9e0)'), text);
assert(text.includes('edi=0x7ef41ca0') && text.includes('esp=0x074f7228'), text);
assert.strictEqual(wine._exitSiteText({ eip: 0, yield: 0 }), '(the guest Worker reported no registers)');

const hostSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'guest-thread-host.js'), 'utf8');
const dflt = hostSrc.indexOf("unexpected message ${msg.t}");
const known = hostSrc.indexOf("case 'writerRegistered':");
assert(known > 0 && known < dflt, 'writerRegistered is handled before the unexpected-message default');

console.log('test-worker-main-exit-regs: PASS');
