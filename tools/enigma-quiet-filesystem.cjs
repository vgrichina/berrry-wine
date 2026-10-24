'use strict';
// Historical Enigma adapter: replaces the old preload, including its API cap.
// No console interception. Explicit --trace-fs remains owned by filesystem.js.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const assert = require('node:assert/strict');
const pins = Object.freeze({
  'test/run.js': '4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809',
  'lib/filesystem.js': '4c255570c74512262849420c74fe73704fcfe006dc09fb963272c66c9ea0b27e',
});
const sha256 = source => crypto.createHash('sha256').update(source).digest('hex');
function check(source, name) {
  assert.equal(sha256(source), pins[name], `Enigma source identity: ${name}`);
}
function replace(source, anchor, value, count) {
  assert.equal(source.split(anchor).length - 1, count, `Enigma anchor: ${anchor}`);
  return source.split(anchor).join(value);
}
function transform(source) {
  check(source, 'test/run.js');
  source = replace(source, '_debugReadFile: TRACE_API,', '_debugReadFile: false,', 2);
  source = replace(source, '  const pushApi = line => {',
    '  let diagnosticRecords=0;\n  const pushApi = line => {\n    if(diagnosticRecords++ >= 16) return;', 1);
  return replace(source, 'if (TRACE_API && (!TRACE_API_FILTER || TRACE_API_FILTER.has(t))) {',
    'if (diagnosticRecords < 16 && TRACE_API && (!TRACE_API_FILTER || TRACE_API_FILTER.has(t))) {', 1);
}
function install(root) {
  assert(root && path.isAbsolute(root), 'ENIGMA_RUNNER_ROOT must be an absolute canonical runner directory');
  root = fs.realpathSync(root);
  for (const name of Object.keys(pins)) check(fs.readFileSync(path.join(root, name)), name);
  const original = Module.prototype._compile;
  const runner = path.join(root, 'test/run.js');
  const filesystem = path.join(root, 'lib/filesystem.js');
  Module.prototype._compile = function(source, file) {
    if (file === runner) source = transform(source);
    if (file === filesystem) check(source, 'lib/filesystem.js');
    return original.call(this, source, file);
  };
}
module.exports = { pins, check, transform, install };
if (process.env.ENIGMA_RUNNER_ROOT || module.parent?.id === 'internal/preload') {
  install(process.env.ENIGMA_RUNNER_ROOT);
}
