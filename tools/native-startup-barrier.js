#!/usr/bin/env node
'use strict';
// Content-verified startup barrier for separately provisioned native runtimes.
//
// Publish only after provisioning returns successfully. Require immediately before
// creating a launch request, and again before its parent consumes that request.
// This is host orchestration; it never starts or changes a guest.
//
// JS port of tools/native-startup-barrier.py: same CLI (publish|require ROOT
// MANIFEST RECEIPT), same stdout JSON, same receipt bytes (Python json.dump with
// sort_keys and default separators), exit 1 on refusal, 2 on bad usage.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');

const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

// Path.resolve() (non-strict): resolve symlinks of the longest existing prefix.
function resolve(p) {
  const abs = path.resolve(p);
  let head = abs, tail = [];
  for (;;) {
    try { return path.join(fs.realpathSync(head), ...tail); }
    catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      const parent = path.dirname(head);
      if (parent === head) return abs;
      tail.unshift(path.basename(head)); head = parent;
    }
  }
}

// json.dumps formatting: ", "/": " separators, ASCII escapes, optional key sort.
function pyDumps(value, sortKeys = false) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return '[' + value.map(v => pyDumps(v, sortKeys)).join(', ') + ']';
  if (typeof value === 'object') {
    const keys = Object.keys(value); if (sortKeys) keys.sort();
    return '{' + keys.map(k => pyDumps(k) + ': ' + pyDumps(value[k], sortKeys)).join(', ') + '}';
  }
  if (typeof value === 'string')
    return JSON.stringify(value).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return JSON.stringify(value);
}

function fingerprint(root, manifest) {
  root = resolve(root);
  const raw = fs.readFileSync(manifest);
  const pins = JSON.parse(raw.toString('utf8'));
  const files = pins.files;
  if (files === undefined) throw new Error('KeyError: files');
  if (!files.length) throw new Error('empty startup manifest');
  const seen = new Set();
  for (const pin of files) {
    const relative = pin.path;
    const target = resolve(path.join(root, relative));
    if (path.isAbsolute(relative) || !(target === root || target.startsWith(root === path.sep ? root : root + path.sep)))
      throw new Error('provider outside runtime root');
    if (seen.has(target)) throw new Error('duplicate startup provider');
    seen.add(target);
    const data = fs.readFileSync(target);
    if (data.length !== pin.size || sha256(data) !== pin.sha256)
      throw new Error('startup provider mismatch: ' + pin.path);
  }
  return {version: 1, root, manifestSha256: sha256(raw),
          providers: files.length, bytes: files.reduce((n, pin) => n + pin.size, 0)};
}

function publish(root, manifest, receipt) {
  const proof = fingerprint(root, manifest);
  // Exclusive creation prevents replacing an earlier generation's evidence.
  // A partial write is harmless: require() fails closed on invalid JSON.
  // (/dev/null-style existing receipts are refused exactly as open("x") would.)
  fs.writeFileSync(receipt, pyDumps(proof, true), {flag: 'wx'});
  return proof;
}

// Python dict equality: same key set, equal values (JSON-shaped).
function same(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]));
}

function require_(root, manifest, receipt) {
  const recorded = JSON.parse(fs.readFileSync(receipt, 'utf8'));
  const actual = fingerprint(root, manifest);
  if (!same(recorded, actual)) throw new Error('startup barrier generation changed');
  return actual;
}

module.exports = {fingerprint, publish, require: require_, pyDumps};

if (require.main === module) {
  const usage = 'usage: native-startup-barrier.js [-h] {publish,require} root manifest receipt';
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) { console.log(usage); process.exit(0); }
  if (args.length !== 4 || !['publish', 'require'].includes(args[0])) {
    console.error(usage); process.exit(2);
  }
  try {
    const result = (args[0] === 'publish' ? publish : require_)(args[1], args[2], args[3]);
    process.stdout.write(pyDumps(result) + '\n');
  } catch (error) {
    console.error(error.code ? error.message : 'ValueError: ' + error.message);
    process.exit(1);
  }
}
