'use strict';
// Opt-in compatibility for one retained historical runner; never edits inputs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const assert = require('node:assert/strict');
const pins = Object.freeze({
  runner: '4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809',
  historical: '4c255570c74512262849420c74fe73704fcfe006dc09fb963272c66c9ea0b27e',
  accepted: '542ecac68e15882d9f5455e89c2c92198d3e3042b53b599b29706a6668fcb3b1',
});
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
function check(source, pin) {
  assert.equal(sha256(source), pins[pin], `Enigma FindFirst ${pin} identity`);
}
const start = '    const matchPat = pat === \'*.*\' ? \'*\' : pat;\n';
const end = '\n    const collect = (searchDir) => {';
function matcherSpan(source) {
  assert.equal(source.split(start).length, 2, 'Enigma FindFirst unique start anchor');
  assert.equal(source.split(end).length, 2, 'Enigma FindFirst unique end anchor');
  const from = source.indexOf(start) + start.length;
  const to = source.indexOf(end);
  assert(to > from, 'Enigma FindFirst anchor order');
  return { from, to, text: source.slice(from, to) };
}
function transform(source, accepted = fs.readFileSync(path.join(__dirname, '../lib/filesystem.js'), 'utf8')) {
  check(source, 'historical');
  check(accepted, 'accepted');
  const old = matcherSpan(source), current = matcherSpan(accepted);
  const result = source.slice(0, old.from) + current.text + source.slice(old.to);
  // Proves that every historical byte outside the accepted matcher is retained.
  check(result, 'accepted');
  return result;
}
function install(root) {
  assert(root && path.isAbsolute(root), 'ENIGMA_FINDFIRST_RUNNER_ROOT must be absolute');
  root = fs.realpathSync(root);
  const runner = path.join(root, 'test/run.js');
  const filesystem = path.join(root, 'lib/filesystem.js');
  check(fs.readFileSync(runner), 'runner');
  const historical = fs.readFileSync(filesystem, 'utf8');
  const adapted = transform(historical);
  // quietFS validates the incoming historical filesystem before forwarding it.
  // It must therefore wrap this hook, rather than receive our adapted source.
  assert(!Object.keys(require.cache).some(file => path.basename(file) === 'enigma-quiet-filesystem.cjs'),
    'Enigma FindFirst preload order: load enigma-findfirst-compat.cjs BEFORE enigma-quiet-filesystem.cjs');
  assert(!require.cache[runner] && !require.cache[filesystem], 'Enigma FindFirst must preload before runner/filesystem');
  const original = Module.prototype._compile;
  Module.prototype._compile = function(source, file) {
    if (file === filesystem) {
      check(source, 'historical');
      source = adapted;
    }
    return original.call(this, source, file);
  };
}
module.exports = { pins, sha256, check, matcherSpan, transform, install };
if (process.env.ENIGMA_FINDFIRST_RUNNER_ROOT || module.parent?.id === 'internal/preload') {
  install(process.env.ENIGMA_FINDFIRST_RUNNER_ROOT);
}
