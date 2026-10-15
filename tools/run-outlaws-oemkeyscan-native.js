'use strict';
// Remote-only, invoked after coordinator grants the sole runtime lane.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const evidence = process.env.WA_OEM_EVIDENCE;
const expectedCommit = process.env.WA_OEM_COMMIT;
assert(evidence && path.isAbsolute(evidence));
assert.match(expectedCommit || '', /^[a-f0-9]{40}$/);
const donor = '/home/user/jedi-knight-checkout';
const held = '/home/user/wa-iw-native-validation';
assert(![donor, held].includes(root));
fs.mkdirSync(evidence, { recursive: false });
const git = (...args) => cp.execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
assert.equal(git('rev-parse', 'HEAD').toString().trim(), expectedCommit);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const hashFile = p => sha(fs.readFileSync(p));
const save = (name, value) => fs.writeFileSync(path.join(evidence, name + '.json'), JSON.stringify(value, null, 2));
const baseline = donor + '/build/wine-assembly.wasm';
const fixture = path.join(evidence, 'synthetic-loader.exe');
// Same PE layout as test/test-dll-lifecycle-real-pe.js, with one bootstrap
// import and an INT3 entry point which the integration test never executes.
function makeFixture() {
  const b = Buffer.alloc(0x2200), p = 0x80, o = p + 24, s = o + 0xe0;
  b.writeUInt16LE(0x5a4d, 0); b.writeUInt32LE(p, 0x3c);
  b.writeUInt32LE(0x4550, p); b.writeUInt16LE(0x14c, p + 4);
  b.writeUInt16LE(1, p + 6); b.writeUInt16LE(0xe0, p + 20); b.writeUInt16LE(0x010e, p + 22);
  b.writeUInt16LE(0x10b, o); b.writeUInt32LE(0x2000, o + 16); b.writeUInt32LE(0x400000, o + 28);
  b.writeUInt32LE(0x1000, o + 32); b.writeUInt32LE(0x200, o + 36);
  b.writeUInt32LE(0x3000, o + 56); b.writeUInt32LE(0x200, o + 60);
  b.writeUInt16LE(3, o + 68); b.writeUInt32LE(0x100000, o + 72);
  b.writeUInt32LE(0x1000, o + 76); b.writeUInt32LE(16, o + 92);
  b.write('.text', s); b.writeUInt32LE(0x2000, s + 8); b.writeUInt32LE(0x1000, s + 12);
  b.writeUInt32LE(0x2000, s + 16); b.writeUInt32LE(0x200, s + 20); b.writeUInt32LE(0xe0000060, s + 36);
  const raw = rva => rva - 0x1000 + 0x200;
  b.writeUInt32LE(0x1800, o + 104); b.writeUInt32LE(40, o + 108);
  b.writeUInt32LE(0x1900, raw(0x1800)); b.writeUInt32LE(0x1880, raw(0x180c));
  b.writeUInt32LE(0x1900, raw(0x1810)); b.write('kernel32.dll\0', raw(0x1880));
  b.writeUInt32LE(0x1a00, raw(0x1900)); b.write('GetModuleHandleA\0', raw(0x1a02));
  b[raw(0x2000)] = 0xcc;
  return b;
}
const fixtureBytes = makeFixture(), fixtureHash = sha(fixtureBytes);
const wasm = root + '/build/wine-assembly.wasm';
function preserved() {
  assert.equal(hashFile(baseline), '937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb');
  assert.equal(hashFile(held + '/build/wine-assembly.wasm'), 'a948a826f71c1935c4d00f7054decdaf4d1e8115314d8779727b7e30069f5b48');
  if (fs.existsSync(fixture)) assert.equal(hashFile(fixture), fixtureHash);
}
function sources(label) {
  const records = git('ls-tree', '-r', expectedCommit).toString().trim().split('\n').map(line => {
    const m = line.match(/^\d+ blob ([a-f0-9]+)\t(.+)$/);
    assert(m, line);
    const bytes = fs.readFileSync(path.join(root, m[2]));
    const blob = crypto.createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
    assert.equal(blob, m[1], 'physical committed source ' + m[2]);
    return { path: m[2], sha256: sha(bytes) };
  });
  preserved();
  save(label + '-sources', { at: new Date().toISOString(), commit: expectedCommit, node: process.version, records,
    moduleSha256: fs.existsSync(wasm) ? hashFile(wasm) : null, fixtureHash });
}
function inventory(label) {
  const all = cp.execFileSync('ps', ['-eo', 'pid,ppid,pgid,comm,args'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(path.join(evidence, label + '-processes.txt'), all);
  const active = all.split('\n').filter(line => {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);
    return m && +m[1] !== process.pid && /^(node|MainThread|chrome|chromium|firefox|wat2wasm)$/.test(m[4]);
  });
  assert.deepEqual(active, [], 'sole runtime lane must be idle');
}
function arm(label, seconds, command) {
  const fd = fs.openSync(path.join(evidence, label + '.log'), 'wx');
  const start = Date.now();
  let result;
  try { result = cp.spawnSync('timeout', ['--kill-after=5s', seconds + 's', ...command], {
    cwd: root, stdio: ['ignore', fd, fd], env: process.env,
  }); } finally { fs.closeSync(fd); }
  save(label + '-status', { status: result.status, signal: result.signal, error: result.error?.message, elapsedMs: Date.now() - start });
  inventory(label + '-after');
  preserved();
  assert.equal(result.status, 0, label + ': stop on any unexpected failure');
}
try {
  inventory('preflight'); sources('before');
  fs.writeFileSync(fixture, fixtureBytes, { flag: 'wx' });
  save('fixture', { kind: 'generated conformance PE, not original game', size: fixtureBytes.length,
    sha256: fixtureHash, sourceSha256: hashFile(__filename), entryPointExecuted: false });
  preserved();
  arm('normal-build', 600, ['bash', 'tools/build.sh']);
  sources('built');
  arm('focused', 90, [process.execPath, 'test/test-oem-key-scan.js']);
  const args = ['test/test-oem-key-scan-candidate.js', '--fixture=' + fixture, '--fixture-sha256=' + fixtureHash];
  arm('candidate', 90, [process.execPath, ...args, '--wasm=' + wasm]);
  arm('baseline-missing', 90, [process.execPath, ...args, '--wasm=' + baseline, '--expect-missing']);
  arm('candidate-restored', 90, [process.execPath, ...args, '--wasm=' + wasm]);
} finally {
  sources('postflight'); inventory('postflight');
}
