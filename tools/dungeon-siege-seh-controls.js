'use strict';
// Sole-runtime grant required. Four sequential controls; stop at first failure.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const root = '/tmp/wa-recovery-20261014';
const source = '5441ffb94bc41859c9358f8d03db5a4319874d08';
const id = process.argv[2];
const msvc = process.argv[3] === '--msvc';
assert(process.argv.length === (msvc ? 4 : 3) && /^20261019-dungeon-siege-seh-[a-z0-9-]+$/.test(id || ''));
const out = path.join('/home/user/wine-assembly/scratch/runs', id);
assert(!fs.existsSync(out), 'Never reuse evidence');
const git = args => cp.execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const tests = msvc ? [path.join(__dirname, 'dungeon-siege-msvc-seh-fixture.js')]
  : ['test/test-fault-reserved-sync.js', 'test/test-fault-reserved-page-cross.js'];
assert.equal(git(['diff', '--name-only', source, '--', 'src', 'lib', 'host.js', 'test', 'tools/watx-closure.js']), '', 'Coherent reviewed test closure required');
const pre = JSON.parse(cp.execFileSync(process.execPath, [path.join(__dirname, 'dungeon-siege-retry-preflight.js'), root], { encoding: 'utf8' }));
assert(pre.ready);
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const tracked = git(['ls-files']).split('\n').filter(p => /^(src|lib|tools|test)\//.test(p) || p === 'host.js')
  .map(p => path.join(root, p)).filter(p => fs.existsSync(p) && fs.statSync(p).isFile());
const pins = [...new Set([...tracked, ...(msvc ? tests : []), path.join(root, 'build/wine-assembly.wasm'), path.join(root, 'build/wine-assembly.compat.wasm')])].map(p => ({ path: p, sha256: hash(p) }));
fs.mkdirSync(out);
const temporary = path.join(out, 'tmp');
fs.mkdirSync(temporary);
// compileHarnessWasm caches Buffers only in a process-local Map. Neither
// control writes screenshots; still account for render-helper's output path
// and route any dependency temporary files into this run's guarded directory.
const renderOutput = path.join(root, 'test/output');
function sizes(dir, found = new Map()) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name), stat = fs.lstatSync(p);
    if (stat.isDirectory()) sizes(p, found); else found.set(p, stat.size);
  }
  return found;
}
const priorRender = sizes(renderOutput);
const outputBytes = () => [...sizes(out).values()].reduce((n, size) => n + size, 0)
  + [...sizes(renderOutput)].reduce((n, [p, size]) => n + Math.max(0, size - (priorRender.get(p) || 0)), 0);
const save = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
save('preflight.json', pre); save('pins.json', pins);
fs.copyFileSync(__filename, path.join(out, 'controller.js'));
const free = () => { const s = fs.statfsSync(root); return s.bavail * s.bsize; };
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !(/^(WA_|WINE_)/.test(k) || ['NODE_OPTIONS', 'NODE_PATH'].includes(k))));
env.TMPDIR = temporary; env.TMP = temporary; env.TEMP = temporary;
let active = null;
function kill() { if (active) try { process.kill(-active.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; } }
process.on('exit', kill);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { kill(); process.exit(1); });
const absent = pid => { try { process.kill(-pid, 0); return false; } catch (e) { if (e.code === 'ESRCH') return true; throw e; } };
async function run(test, compat) {
  const name = path.basename(test, '.js') + (compat ? '-compat' : '-tail');
  const admissionFree = free();
  assert(admissionFree > pre.admissionBytes, 'Fresh per-job admission failed');
  assert(outputBytes() <= 32 * 1024 ** 2, 'Aggregate output cap before next job');
  const fd = fs.openSync(path.join(out, name + '.log'), 'wx'), start = Date.now();
  let bytes = 0, minFree = admissionFree, reason = null;
  const args = [test, ...(msvc ? ['--root=' + root] : []), ...(compat ? ['--compat'] : [])];
  const child = active = cp.spawn(process.execPath, args, { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  save(name + '-launch.json', { pid: child.pid, args, source, at: new Date().toISOString() });
  const stop = why => { reason ||= why; kill(); };
  const receive = b => { const room = Math.max(0, 4 * 1024 ** 2 - bytes); if (room) fs.writeSync(fd, b.subarray(0, room)); bytes += b.length; if (bytes > 4 * 1024 ** 2) stop('log-cap'); };
  child.stdout.on('data', receive); child.stderr.on('data', receive);
  const timer = setInterval(() => {
    minFree = Math.min(minFree, free());
    if (minFree <= pre.hardFloorBytes) stop('disk-floor');
    if (outputBytes() > 32 * 1024 ** 2) stop('aggregate-output-cap');
    if (Date.now() - start >= 180000) stop('outer-deadline');
  }, 250);
  child.on('error', e => { reason ||= 'spawn: ' + e.message; });
  const { code, signal } = await new Promise(resolve => child.on('close', (code, signal) => resolve({ code, signal })));
  clearInterval(timer); fs.closeSync(fd);
  if (outputBytes() > 32 * 1024 ** 2) stop('aggregate-output-cap');
  if (child.pid && !absent(child.pid)) { stop('surviving-descendants'); }
  for (let i = 0; child.pid && !absent(child.pid) && i < 20; i++) await new Promise(resolve => setTimeout(resolve, 100));
  const groupAbsent = !child.pid || absent(child.pid); active = null;
  const changed = pins.filter(p => !fs.existsSync(p.path) || hash(p.path) !== p.sha256).map(p => p.path);
  const result = { name, code, signal, reason, bytes, totalOutputBytes: outputBytes(), minFree, elapsedMs: Date.now() - start, groupAbsent, changed };
  save(name + '.json', result); console.log(JSON.stringify(result));
  assert(code === 0 && !reason && groupAbsent && !changed.length, 'Terminal control failure; no subsequent job');
}
(async () => {
  for (const test of tests) for (const compat of [false, true]) await run(test, compat);
  save('complete.json', { at: new Date().toISOString(), passed: tests.length * 2, source, msvc });
})().catch(e => { save('failure.json', { at: new Date().toISOString(), error: e.stack }); console.error(e.message); process.exitCode = 1; });
