'use strict';

// The toy VM has independent JS and WAT decoders. A deterministic byte-level
// differential catches a wrong opcode/ModRM/immediate claim before either
// backend's execution tests can disguise it behind the same final state.
//
// This ran inside tools/build.sh until 2026-11-21; it is a toy-VM check that
// reads no src/ and gates nothing the shipped wasm contains, so it lives in the
// unit tier now (same arguments, same seed).

const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'toyvm', 'decode-diff.js'), '--random=20000', '--seed=12345'], {
  cwd: ROOT,
  stdio: 'inherit',
  timeout: 60000,
});
console.log('test-toyvm-decode-diff-random: OK');
