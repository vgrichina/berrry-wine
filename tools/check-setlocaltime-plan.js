'use strict';
const assert = require('node:assert/strict');
const { selected, limits } = require('./setlocaltime-plan');
for (const p of ['test/run-all.sh', 'fonts/Terminal.fon', 'host.js', 'tools/build.sh',
  'src/main.watx', 'test/test-set-local-time-native.js', 'lib/host-imports.js',
  'docs/dos-corpus/live/toyvm-bundle.js', 'docs/dos-corpus/live/toyvm-jit-bundle.js']) assert(selected({ path: p }), p);
for (const p of ['test/binaries/notepad.exe', 'test/binaries/dlls/msvcrt.dll',
  'packages/freeware/volley.exe', 'scratch/runs/old/log', 'build/wine-assembly.wasm']) assert(!selected({ path: p }), p);
assert.equal(limits.admissionBytes, 2986344448);
assert.equal(limits.hardFloorBytes, 2214592512);
assert.equal(limits.jobMs, 180000);
assert.equal(limits.logBytes, 4 * 1024 ** 2);
assert.equal(limits.evidenceBytes, 32 * 1024 ** 2);
assert.equal(limits.buildGrowthBytes, 128 * 1024 ** 2);
console.log('SetLocalTime build closure positive/negative and unchanged budget controls PASS');
