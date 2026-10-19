'use strict';
// One guarded job, no retry. Requires an explicit external runtime grant.
const fs = require('node:fs'), cp = require('node:child_process'), path = require('node:path'), crypto = require('node:crypto');
const [name, command, ...args] = process.argv.slice(2);
if (!name || !command || !/^[a-z0-9-]+$/.test(name)) throw Error('name command args required');
if (process.env.ARMY_CMOS_RUNTIME_GRANTED !== '1') throw Error('runtime grant required');
const root = path.resolve(__dirname, '..'), dir = path.join(root, 'scratch/runs/20261019-army-cmos-remote-validation');
const git = a => cp.execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
git(['diff', '--exit-code', 'd711950d45f37cda193316b1be2264c05721cb8b', '--', 'src', 'lib', 'host.js']);
git(['diff', '--exit-code']);
fs.mkdirSync(dir, { recursive: true });
const admission = 2 ** 31 + 768 * 1024 ** 2, stop = 2 ** 31 + 64 * 1024 ** 2;
const free = () => { const s = fs.statfsSync(dir); return s.bavail * s.bsize; };
const bytes = p => !fs.existsSync(p) ? 0 : fs.readdirSync(p, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? bytes(path.join(p, e.name)) : fs.statSync(path.join(p, e.name)).size), 0);
let minFree = free(), reason = null;
if (minFree <= admission) throw Error('insufficient admission: ' + minFree);
const sourceHead = git(['rev-parse', 'HEAD']), start = Date.now(), deadline = /^build(?:-|$)/.test(name) ? 180000 : 60000;
const fd = fs.openSync(path.join(dir, name + '.log'), 'wx');
const child = cp.spawn(command, args, { cwd: root, detached: true, stdio: ['ignore', fd, fd] });
const kill = () => { if (child.pid) try { process.kill(-child.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; } };
const absent = () => { if (!child.pid) return true; try { process.kill(-child.pid, 0); return false; } catch (e) { if (e.code === 'ESRCH') return true; throw e; } };
process.on('exit', kill);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { reason = s; kill(); });
const timer = setInterval(() => {
  minFree = Math.min(minFree, free());
  if (minFree <= stop) reason ||= 'disk';
  if (Date.now() - start > deadline) reason ||= 'deadline';
  if (fs.fstatSync(fd).size > 4 * 1024 ** 2) reason ||= 'log';
  if (bytes(path.join(root, 'build')) + bytes(dir) > 128 * 1024 ** 2) reason ||= 'output';
  if (reason) kill();
}, 100);
child.on('error', e => { reason = 'spawn: ' + e.message; });
child.on('close', async (code, signal) => {
  clearInterval(timer);
  if (!absent()) { reason ||= 'descendants-after-exit'; kill(); }
  for (let i = 0; i < 20 && !absent(); i++) await new Promise(r => setTimeout(r, 100));
  fs.closeSync(fd);
  const hashes = {};
  for (const n of ['wine-assembly.wasm', 'wine-assembly.compat.wasm']) {
    const p = path.join(root, 'build', n);
    if (fs.existsSync(p)) hashes[n] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  }
  const result = { name, command, args, sourceHead, pid: child.pid, code, signal, guard: reason,
    elapsedMs: Date.now() - start, deadline, minFree, admission, stop, groupAbsent: absent(), hashes,
    sourceUnchanged: git(['status', '--porcelain', '--untracked-files=no']) === '', logBytes: fs.statSync(path.join(dir, name + '.log')).size };
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
  process.exitCode = code === 0 && !reason && result.groupAbsent && result.sourceUnchanged ? 0 : 1;
});
