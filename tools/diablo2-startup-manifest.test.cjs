'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const reader = require('./diablo2-startup-manifest.cjs');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

test('raw identity, bounded verified gzip, and refusal without fallback', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-reader-'));
  try {
    const b = Buffer.from('{"unchanged":true}');
    const p = {path: 'manifest.json', size: b.length, sha256: sha(b)};
    fs.writeFileSync(root + '/manifest.json', b);
    fs.writeFileSync(root + '/manifest.json.gz', zlib.gzipSync(b));
    assert.deepEqual(reader.read(root, p), b);
    fs.unlinkSync(root + '/manifest.json');
    assert.deepEqual(reader.read(root, p), b);
    assert.throws(() => reader.read(root, {...p, size: p.size - 1}), /raw size/);
    assert.throws(() => reader.read(root, {...p, sha256: '0'.repeat(64)}), /raw SHA/);
    assert.throws(() => reader.read(root, {...p, gzipSha256: '0'.repeat(64)}), /gzip SHA/);
    fs.writeFileSync(root + '/manifest.json', 'corrupt');
    assert.throws(() => reader.read(root, p), /raw size/);
    fs.unlinkSync(root + '/manifest.json');
    fs.writeFileSync(root + '/manifest.json.gz', zlib.gzipSync(b).subarray(0, 12));
    assert.throws(() => reader.read(root, p));
    fs.writeFileSync(root + '/manifest.json.gz', zlib.gzipSync(Buffer.alloc(4096)));
    assert.throws(() => reader.read(root, p));
    assert.throws(() => reader.read(root, {...p, path: '../manifest.json'}), /unsafe/);
  } finally { fs.rmSync(root, {recursive: true}); }
});

test('schema refuses invalid declared closures even with independently matching raw pins', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-schema-'));
  try {
    const check = value => {
      const b = Buffer.from(JSON.stringify(value));
      fs.writeFileSync(root + '/pins.json', b);
      assert.throws(() => reader.load(root, {path: 'pins.json', size: b.length, sha256: sha(b)}));
    };
    const p = {app: 'diablo2_demo', commit: 'a'.repeat(40), files: [], uploadFiles: [], httpPins: []};
    check(p);
    check({...p, app: 'other'});
    check({...p, commit: 'unknown'});
    const file = {path: 'a', size: 1, sha256: 'a'.repeat(64)};
    check({...p, files: [file], uploadFiles: []});
    check({...p, files: [file, file], uploadFiles: [file, file]});
    check({...p, files: [{...file, path: '../escape'}]});
    check({...p, files: [file], uploadFiles: [file], httpPins: [{url: '/missing'}]});
  } finally { fs.rmSync(root, {recursive: true}); }
});

// Optional retained-evidence integration: runs the actual emitted parent browser
// against physical stage inputs. It never changes the original evidence tree.
test('actual prepare and emitted native consumer reject before effects', {
  skip: !process.env.D2_STARTUP_CANONICAL_CONTRACT
}, () => {
  const sourceRoot = path.resolve(__dirname, '..');
  const expected = JSON.parse(fs.readFileSync(process.env.D2_STARTUP_CANONICAL_CONTRACT));
  const original = reader.load(sourceRoot, expected);
  const raw = reader.read(sourceRoot, expected);
  const stage = fs.mkdtempSync('/dev/shm/d2-emitted-');
  const cases = [];
  try {
    const place = (name, b) => {
      const target = path.join(stage, name);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, b);
    };
    const parent = path.posix.dirname(expected.path);
    place(expected.path, raw);
    place(expected.path + '.gz', fs.readFileSync(path.join(sourceRoot, expected.path + '.gz')));
    for (const p of [original.restoreManifest, ...original.dependencies]) {
      place(p.path, reader.read(sourceRoot, p));
    }
    fs.symlinkSync(path.join(sourceRoot, parent, 'browser.cjs'), path.join(stage, parent, 'browser.cjs'));
    fs.mkdirSync(stage + '/tools');
    fs.symlinkSync(path.join(sourceRoot, 'tools/diablo2-startup-manifest.cjs'), stage + '/tools/diablo2-startup-manifest.cjs');
    const output = path.join(stage, 'scratch/runs/new');
    const closureRaw = reader.prepare(stage, output, expected);
    fs.unlinkSync(path.join(stage, expected.path));
    const closureGzip = reader.prepare(stage, output + '-gzip', expected);
    assert.deepEqual(closureRaw, closureGzip);
    assert.deepEqual(closureRaw, original);
    const emitted = fs.readFileSync(output + '/browser.cjs');
    assert.deepEqual(emitted, fs.readFileSync(output + '-gzip/browser.cjs'));
    const trap = `const fs=require('fs'),effects=[];
const fail=name=>(...args)=>{effects.push(name);throw Error('unexpected effect: '+name)};
for(const name of ['spawn','spawnSync','exec','execSync','fork','execFile','execFileSync'])require('child_process')[name]=fail(name);
for(const mod of ['http','https','net','tls'])for(const name of ['request','get','connect','createConnection','createServer'])if(require(mod)[name])require(mod)[name]=fail(mod+'.'+name);
for(const name of ['mkdirSync','writeFileSync','appendFileSync'])fs[name]=fail(name);
global.WebSocket=class{constructor(){fail('WebSocket')()}};global.fetch=fail('fetch');
process.on('exit',()=>console.error(JSON.stringify({effects})));
try{require(process.argv[1])}catch(e){console.error(String(e));process.exitCode=1}`;
    const consume = (label, success, check = true) => {
      if (!success && check) {
        const refusedOutput = output + '-refused-' + cases.length;
        assert.throws(() => reader.prepare(stage, refusedOutput, expected), label + ': prepare accepted');
        assert(!fs.existsSync(refusedOutput), label + ': prepare wrote before validation');
      }
      const args = ['-e', trap, output + '/browser.cjs'];
      if (check) args.push('--startup-data-check', stage, output);
      // Normal mode resolves its root from __dirname, exactly as on the box.
      const r = cp.spawnSync(process.execPath, args, {encoding: 'utf8', timeout: 10000});
      assert.equal(r.error, undefined);
      assert.equal(r.status, success ? 0 : 1, label + ': ' + r.stderr);
      assert(r.stderr.includes('{"effects":[]}'), label + ': effects observed');
      const result = success ? JSON.parse(r.stdout) : null;
      if (success) {
        const {pins, ...expectedClosure} = original;
        assert.deepEqual(result, expectedClosure);
      }
      cases.push({label, code: r.status, effects: [], error: success ? null : r.stderr.trim(),
        closureSha256: success ? sha(r.stdout) : null});
      if (!success && check) consume('normal native entry: ' + label, false, false);
      return r.stdout;
    };
    const gzipResult = consume('verified sibling gzip', true);
    place(expected.path, raw);
    assert.equal(consume('valid raw', true), gzipResult);
    place(expected.path, Buffer.from('broken raw'));
    consume('invalid raw refuses valid sibling fallback', false);
    const wrongRaw = Buffer.from(raw); wrongRaw[10] ^= 1;
    place(expected.path, wrongRaw);
    consume('same size wrong SHA raw', false);
    fs.unlinkSync(path.join(stage, expected.path));
    const gzip = fs.readFileSync(path.join(stage, expected.path + '.gz'));
    place(expected.path + '.gz', gzip.subarray(0, gzip.length - 8));
    consume('truncated gzip', false);
    const corrupt = Buffer.from(gzip); corrupt[Math.floor(corrupt.length / 2)] ^= 1;
    place(expected.path + '.gz', corrupt);
    consume('corrupt gzip', false);
    const wrong = Buffer.from(raw); wrong[10] ^= 1;
    place(expected.path + '.gz', zlib.gzipSync(wrong));
    consume('wrong SHA gzip', false);
    place(expected.path + '.gz', zlib.gzipSync(Buffer.from('{"files":[]}')));
    consume('wrong manifest', false);
    place(expected.path + '.gz', gzip);
    for (const dependency of original.dependencies) {
      const saved = fs.readFileSync(path.join(stage, dependency.path));
      fs.unlinkSync(path.join(stage, dependency.path));
      consume('missing ' + path.basename(dependency.path), false);
      place(dependency.path + '.gz', zlib.gzipSync(saved));
      consume('encoded save cannot substitute for raw HTTP mount ' + path.basename(dependency.path), false);
      fs.unlinkSync(path.join(stage, dependency.path + '.gz'));
      place(dependency.path, saved);
    }
    const restore = fs.readFileSync(path.join(stage, original.restoreManifest.path));
    place(original.restoreManifest.path, Buffer.from('[]'));
    consume('changed restore manifest', false);
    place(original.restoreManifest.path, restore);
    fs.unlinkSync(path.join(stage, expected.path + '.gz'));
    consume('missing raw and gzip', false);
    if (process.env.D2_STARTUP_REPORT) fs.writeFileSync(process.env.D2_STARTUP_REPORT,
      JSON.stringify({passed: true, actualEmittedConsumer: true, originalPinUnchanged: expected,
        identicalClosure: true, cases}, null, 2));
  } finally { fs.rmSync(stage, {recursive: true}); }
});
