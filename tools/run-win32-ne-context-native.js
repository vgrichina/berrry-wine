'use strict';
// Explicit sole-lane grant required. Normal build and synthetic allocator tests
// only; no original game, NE DLL initialization or browser execution.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), commit = process.env.WA_NE_CONTEXT_COMMIT;
const out = process.env.WA_NE_CONTEXT_EVIDENCE;
assert.match(commit || '', /^[a-f0-9]{40}$/);
assert(out && path.isAbsolute(out) && !out.startsWith(root + '/'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hash = file => sha(fs.readFileSync(file));
const git = (...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
assert.equal(git('rev-parse', 'HEAD'), commit);
assert.equal(git('diff', '--name-only', 'f9f47f3294edb7f41326ae21a83f003f981056ee', commit, '--', 'src', 'lib'), '', 'reviewed context production bytes');
const preserved = [
  ['/home/user/wa-ne-arena-native/build/wine-assembly.wasm', 'ca90c018226b1b002d257dde09e1913fd35c2e22cac43a2128ae88744f80cccd'],
  ['/home/user/jedi-knight-checkout/build/wine-assembly.wasm', '937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb'],
  ['/home/user/wa-iw-native-validation/build/wine-assembly.wasm', 'a948a826f71c1935c4d00f7054decdaf4d1e8115314d8779727b7e30069f5b48'],
  ['/home/user/wa-outlaws-kernel32-native-attempt4/build/wine-assembly.wasm', '0dbf18930da633aa71c860ecaca2615a0f6562c9ff0a62aba6f063a12b2bf8ab'],
  ['/home/user/wa-iw-combined-native/build/wine-assembly.wasm', '04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17'],
  ['/home/user/lords2-getparent-d56/build/wine-assembly.wasm', 'e26a751567f63a0bb6abbea8a69111842d41e8705158ccf425394d4ac591745d'],
];
for (const [file] of preserved) assert.notEqual(root, path.dirname(path.dirname(file)));
fs.mkdirSync(out, { recursive: false });
const save = (name, data) => fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(data, null, 2));
const wasm = path.join(root, 'build/wine-assembly.wasm'), statuses = [];
let moduleSha256 = null, passed = false;
const deps = '/home/user/jedi-knight-checkout/node_modules', dependencies = [], seen = new Set();
assert.equal(fs.realpathSync(path.join(root, 'node_modules')), deps);
function dependencyTree(file) {
  const real = fs.realpathSync(file);
  assert(real === deps || real.startsWith(deps + '/') || real.startsWith('/home/user/cmr3-fresh-checkout/node_modules/wabt/bin/'));
  if (seen.has(real)) return; seen.add(real);
  if (fs.statSync(real).isDirectory()) for (const name of fs.readdirSync(real)) dependencyTree(path.join(real, name));
  else dependencies.push({ path: real, sha256: hash(real) });
}
dependencyTree(deps); assert.equal(dependencies.length, 52); save('dependencies', dependencies);
function inspect(label) {
  assert.equal(git('rev-parse', 'HEAD'), commit);
  const ps = cp.execFileSync('ps', ['-eo', 'pid,ppid,pgid,comm'], { encoding: 'utf8' });
  const active = ps.trim().split('\n').filter(line => {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)$/);
    return m && +m[1] !== process.pid && /^(node|MainThread|chrome|chromium|firefox|wat2wasm)$/.test(m[4]);
  });
  assert.deepEqual(active, [], 'sole runtime lane');
  for (const [file, expected] of preserved) assert.equal(hash(file), expected, file);
  for (const item of dependencies) assert.equal(hash(item.path), item.sha256, item.path);
  if (moduleSha256) assert.equal(hash(wasm), moduleSha256);
  const rows = git('ls-tree', '-r', commit).split('\n').map(line => line.match(/^\d+ blob ([a-f0-9]+)\t(.+)$/))
    .filter(Boolean).filter(m => !m[2].includes('/') || /^(?:src|lib|tools|test|docs|fonts)\//.test(m[2]));
  assert(rows.length > 5000);
  const records = rows.map(([, blob, file]) => {
    const local = path.join(root, file); assert(fs.lstatSync(local).isFile(), file);
    const bytes = fs.readFileSync(local);
    assert.equal(crypto.createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex'), blob, file);
    return { path: file, sha256: sha(bytes) };
  });
  save(label, { at: new Date().toISOString(), commit, active, ps, preserved, records });
}
function run(label, seconds, args, env = {}) {
  inspect(label + '-before');
  const fd = fs.openSync(path.join(out, label + '.log'), 'wx'), started = Date.now(); let result;
  try { result = cp.spawnSync('timeout', ['--kill-after=5s', seconds + 's', ...args], {
    cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', fd, fd],
  }); } finally { fs.closeSync(fd); }
  const status = { label, status: result.status, signal: result.signal, error: result.error?.message, elapsedMs: Date.now() - started };
  statuses.push(status); save(label + '-status', status); inspect(label + '-after');
  assert.equal(result.status, 0, label);
}
try {
  const disk = fs.statfsSync(root); assert(disk.bavail * disk.bsize > 2 * 1024 ** 3, 'more than 2 GiB free required');
  inspect('preflight');
  run('normal-build', 600, ['bash', 'tools/build.sh']);
  moduleSha256 = hash(wasm); save('module', { sha256: moduleSha256, regionMapSha256: hash(path.join(root, 'lib/region-map.generated.js')) });
  run('tiny-context', 30, [process.execPath, 'test/test-win32-ne-context.js']);
  run('native-context', 90, [process.execPath, 'test/test-win32-ne-context-candidate.js'], { WA_TEST_WASM: wasm });
  run('tiny-arena', 30, [process.execPath, 'test/test-win32-ne-arena.js']);
  run('real-allocator', 90, [process.execPath, 'test/test-win32-ne-arena-candidate.js'], { WA_TEST_WASM: wasm });
  run('pure-ne-bounds', 30, [process.execPath, 'test/test-win16-arena-bounds.js']);
  run('pure-ne-loader', 60, [process.execPath, 'test/test-ne-additive-far.js', wasm]);
  passed = true;
} finally {
  inspect('postflight');
  save('summary', { passed, commit, moduleSha256, statuses, originalGameRun: false, browserRun: false, neDllInitialization: false });
}
