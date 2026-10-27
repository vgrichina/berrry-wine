'use strict';
// Rejecting control: reintroduce admission while the selection is incomplete.
// Run with --require before the unchanged OS Worker acquisition reproducer.
const fs = require('fs');
const Module = require('module');
const crypto = require('crypto');
const target = require.resolve('../../lib/renderer-input');
const original = Module._extensions['.js'];
Module._extensions['.js'] = function(mod, filename) {
  if (filename !== target) return original(mod, filename);
  const source = fs.readFileSync(filename, 'utf8');
  const guard = '        if (!buffer.active) continue;';
  if (source.split(guard).length !== 2) throw Error('atomic admission guard mutation mismatch');
  const mutant = source.replace(guard, '        // MUTATION: staged filters admit edges prematurely.');
  console.log(JSON.stringify({rejectingMutation: 'remove inactive filter admission guard',
    sourceSHA256: crypto.createHash('sha256').update(source).digest('hex'),
    mutantSHA256: crypto.createHash('sha256').update(mutant).digest('hex')}));
  return mod._compile(mutant, filename);
};
