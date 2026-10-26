'use strict';
// External observation only. Exact-main render-artifact uses a private module
// graph; observe its public result, leaving that sealed compiler graph intact.
const fs = require('fs'), crypto = require('crypto');
const artifact = require('./test/render-artifact.js');
const compile = artifact.compileHarness;
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
artifact.compileHarness = function(options) {
  const start = performance.now();
  const result = compile.apply(this, arguments);
  const b = Buffer.from(result.bytes);
  fs.writeFileSync('module.wasm', b);
  fs.writeFileSync('module-identity.json', JSON.stringify(result.identity, null, 2)+'\n');
  const receipt = {options: {tailCalls: options.tailCalls}, success: true,
    elapsedMs: performance.now()-start, memory: process.memoryUsage(),
    bytes: b.length, sha256: hash(b)};
  fs.writeFileSync('compile-result.json', JSON.stringify(receipt, null, 2)+'\n');
  return result;
};
const instantiate = WebAssembly.instantiate;
WebAssembly.instantiate = async function(bytes, imports) {
  const digest = hash(Buffer.from(bytes));
  const expected = JSON.parse(fs.readFileSync('compile-result.json'));
  if (digest !== expected.sha256) throw Error('capture: native input differs from compiler output');
  const result = await instantiate.apply(this, arguments);
  fs.writeFileSync('native-result.json', JSON.stringify({sha256: digest, instantiated: true,
    exportCount: Object.keys(result.instance.exports).length}, null, 2)+'\n');
  return result;
};
