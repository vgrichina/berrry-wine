'use strict';
// Source-only transfer inventory. Does not create a sandbox, copy files, build,
// execute a guest, or authorize a remote destination/runtime allocation.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hash = file => sha(fs.readFileSync(file));
const git = (...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
const originalRoot = '/home/user/wine-assembly/scratch/runs/20261018-madbomber-source/original/madbomber-0.2.5';
const originalRun = '/home/user/wine-assembly/scratch/runs/20261019-madbomber-dbcs-retry';
const oldPrepared = path.join(root, 'scratch/runs/20261019-madbomber-lockfile-prepared-v2/manifest.json');
function prepare(out) {
  assert(path.isAbsolute(out)); assert(!fs.existsSync(out));
  const old = JSON.parse(fs.readFileSync(oldPrepared));
  require('./run-lockfile-native').verifyPins(old.pins);
  const files = [], destinations = new Set();
  function add(source, destination, expected) {
    assert(!path.isAbsolute(destination) && !destination.split('/').includes('..'));
    assert(!destinations.has(destination), destination); destinations.add(destination);
    assert(fs.lstatSync(source).isFile(), source);
    const bytes = fs.statSync(source).size, sha256 = hash(source);
    if (expected) assert.equal(sha256, expected, source);
    files.push({ source, destination, bytes, sha256 });
  }
  for (const relative of git('ls-files', '-z').split('\0').filter(Boolean)) {
    if (/^(src|lib|tools|test|fonts)\//.test(relative) || ['host.js', 'package.json', 'package-lock.json'].includes(relative)) {
      if (fs.existsSync(path.join(root, relative))) add(path.join(root, relative), relative);
    }
  }
  for (const [name, expected] of [
    ['wine-assembly.wasm', '97c67d7abbff795cab66c547fd637b6e7f2081a5513dc9cd860738b6bea33985'],
    ['wine-assembly.compat.wasm', 'b3a9e9513d56932ee7217154789774d92c289f50adc78ef1dbdfa15c8a164fb1'],
  ]) add(path.join(root, 'build', name), 'build/' + name, expected);
  const originalManifest = JSON.parse(fs.readFileSync(path.join(originalRun, 'launch-manifest.json')));
  assert.equal(originalManifest.files.length, 140);
  for (const item of originalManifest.files) {
    const source = path.join(originalRoot, item.path); assert.equal(fs.statSync(source).size, item.bytes);
    add(source, 'scratch/portable/original/' + item.path, item.sha256);
  }
  const dependencyRoot = '/tmp/wa-recovery-20261014/node_modules/pngjs';
  function dependency(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const source = path.join(dir, item.name);
      if (item.isDirectory()) dependency(source);
      else add(source, 'node_modules/pngjs/' + path.relative(dependencyRoot, source));
    }
  }
  dependency(dependencyRoot);
  add('/tmp/wa-recovery-20261014/test/binaries/dlls/msvcrt.dll', 'scratch/portable/dependencies/msvcrt.dll',
    '887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1');
  for (const name of ['launch.json', 'launch-manifest.json']) add(path.join(originalRun, name), 'scratch/portable/evidence/original-' + name);
  add(oldPrepared, 'scratch/portable/evidence/local-prepared-manifest.json');
  const archive = '/home/user/wine-assembly/scratch/runs/20261018-madbomber-source/madbomber-0.2.5-1.zip';
  add(archive, 'scratch/portable/evidence/madbomber-0.2.5-1.zip', originalManifest.archiveSha256);
  const relocation = arg => arg.replaceAll(originalRoot, '${PACKET_ROOT}/scratch/portable/original')
    .replaceAll(root, '${PACKET_ROOT}')
    .replaceAll('/tmp/wa-recovery-20261014/test/binaries/dlls/msvcrt.dll', '${PACKET_ROOT}/scratch/portable/dependencies/msvcrt.dll');
  const argv = require('./run-madbomber-lockfile-consumer').argv('${OUTPUT}').map(relocation);
  assert(argv.every(arg => !arg.includes('/home/user/') && !arg.includes('/tmp/wa-')));
  const plan = { preparedAt: new Date().toISOString(), sourceCommit: git('rev-parse', 'HEAD'),
    builtCommit: 'b130b94452212a0854fe764440128f42fe9395d5', destination: { sandbox: 'bx_rqnkhrnr', root: '/tmp/wa-lockfile-rebased-oct19' },
    status: 'source staging authorized; runtime requires separate grant',
    files, totalBytes: files.reduce((n, f) => n + f.bytes, 0), command: { cwd: '${PACKET_ROOT}', argv },
    limits: { admitExclusiveBytes: 2852126720, stopAtOrBelowBytes: 2214592512,
      guestSeconds: 10, quitSeconds: 15, hardSeconds: 25, logBytes: 2097152, evidenceBytes: 33554432 },
    invariants: ['Verify every source and destination SHA-256 before launch; no guest-byte changes.',
      'Use retained modules; --no-build. Exact candidate runtime remains at built source, excluding later main slash fix.',
      'Only replace host paths using the inventory map; preserve all guest paths, 140 mounts and original DLL seed order.',
      'Use only assigned isolated directory after Dungeon releases the single runtime lane; never touch its staging directory.',
      'Parameterize controller paths and seal resulting remote manifest/controller for coordinator review before execution.',
      'Capture numeric admission once; preserve floor/log/output/normal-quit/hard-kill/global-lease guards.',
      'Copy all run evidence and postflight pin verification back to durable original host before temporary box expiry.'],
    originalRecords: 140, registered: false };
  fs.mkdirSync(out); fs.writeFileSync(path.join(out, 'transfer-plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ out, sha256: hash(path.join(out, 'transfer-plan.json')), files: files.length, bytes: plan.totalBytes }));
}
module.exports = { prepare };
if (require.main === module) prepare(path.resolve(process.argv[2]));
