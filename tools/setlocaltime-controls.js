'use strict';
// Run ONLY under an explicit sole-runtime grant. Does not run original games.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), assert = require('node:assert/strict');
const { verifyPlan, sha } = require('./setlocaltime-plan');
const planFile = process.argv[2], id = process.argv[3];
assert(process.argv.length === 4 && /^20261019-setlocaltime-controls-[a-z0-9-]+$/.test(id || ''));
assert.equal(process.env.WA_SETLOCALTIME_GRANT, id, 'Explicit coordinator grant token must equal the unique run ID');
const plan = JSON.parse(fs.readFileSync(planFile)), root = plan.root, L = plan.limits;
assert.equal(fs.realpathSync(root), '/tmp/wa-setlocaltime-oct19', 'Qualification is restricted to the isolated candidate worktree; never replace held recovery modules');
verifyPlan(plan);
// Running a different controller than the pinned source is also a mismatch.
assert.equal(sha(fs.readFileSync(__filename)), sha(fs.readFileSync(path.join(root, 'tools/setlocaltime-controls.js'))));
const out = path.join('/home/user/wine-assembly/scratch/runs', id);
assert(!fs.existsSync(out), 'Unique evidence directory required');
const free = () => { const s = fs.statfsSync(root); return s.bavail * s.bsize; };
const initialAdmissionFree = free();
assert(initialAdmissionFree > L.admissionBytes, `Fresh admission refused: free=${initialAdmissionFree} must exceed ${L.admissionBytes} bytes (512 MiB transient, 128 MiB build growth, 32 MiB evidence)`);
let active = null;
const absent = pid => { try { process.kill(-pid, 0); return false; } catch (e) { if (e.code === 'ESRCH') return true; throw e; } };
const kill = () => { if (active?.pid) try { process.kill(-active.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; } };
const leasePath = '/tmp/wine-assembly-local-runtime.lock';
const leaseText = JSON.stringify({ controllerPid: process.pid, id, source: plan.source, root, kind: 'dungeon-observer-controls' });
const leaseFd = fs.openSync(leasePath, 'wx'); // Never replace or reclaim another owner's lease.
fs.writeSync(leaseFd, leaseText); fs.closeSync(leaseFd);
function release() {
  if (active?.pid && !absent(active.pid)) return; // Keep lease if cleanup is unproven.
  if (fs.existsSync(leasePath) && fs.readFileSync(leasePath, 'utf8') === leaseText) fs.unlinkSync(leasePath);
}
process.on('exit', () => { kill(); release(); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { kill(); release(); process.exit(1); });
function sizes(dir, result = new Map()) {
  if (fs.existsSync(dir)) for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name), s = fs.lstatSync(p);
    if (s.isDirectory()) sizes(p, result); else result.set(p, s.blocks * 512);
  }
  return result;
}
const buildDir = path.join(root, 'build'), renderDir = path.join(root, 'test/output');
const oldBuild = sizes(buildDir), oldRender = sizes(renderDir);
const existingModules = ['wine-assembly.wasm', 'wine-assembly.compat.wasm'].map(n => path.join(buildDir, n)).filter(p => fs.existsSync(p));
assert(existingModules.reduce((n, p) => n + fs.statSync(p).size, 0) <= 8 * 1024 ** 2, 'Prior-module backup exceeds planned 8 MiB');
const total = values => [...values].reduce((a, b) => a + b, 0);
const growth = (dir, before) => total([...sizes(dir)].map(([p, n]) => Math.max(0, n - (before.get(p) || 0))));
fs.mkdirSync(out); fs.mkdirSync(path.join(out, 'tmp'));
const save = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
save('plan.json', plan);
const priorModules = [];
for (const name of ['wine-assembly.wasm', 'wine-assembly.compat.wasm']) {
  const from = path.join(buildDir, name), to = path.join(out, 'prior-' + name);
  if (fs.existsSync(from)) { fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL); priorModules.push({ path: to, sha256: sha(fs.readFileSync(to)) }); }
}
save('prior-modules.json', priorModules);
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(WA_|WINE_)/.test(k) && !['NODE_OPTIONS', 'NODE_PATH'].includes(k)));
env.TMPDIR = env.TMP = env.TEMP = path.join(out, 'tmp');
const jobs = [{ name: 'normal-build', command: 'bash', args: ['tools/build.sh'] },
  { name: 'setlocaltime-tail', command: process.execPath, args: ['test/test-set-local-time-native.js'], module: 'wine-assembly.wasm' },
  { name: 'setlocaltime-compat', command: process.execPath, args: ['test/test-set-local-time-native.js'], module: 'wine-assembly.compat.wasm' },
  { name: 'setlocaltime-worker', command: process.execPath, args: ['test/test-set-local-time-worker.js'] }];
async function run(job) {
  if (job.module) {
    const file = path.join(buildDir, job.module);
    job = { ...job, args: [...job.args, '--wasm=' + file, '--sha256=' + sha(fs.readFileSync(file))] };
  }
  verifyPlan(plan);
  const jobAdmissionFree = free();
  assert(jobAdmissionFree > L.admissionBytes, `Fresh per-job admission refused: job=${job.name} free=${jobAdmissionFree} must exceed ${L.admissionBytes} bytes`);
  const start = Date.now(), fd = fs.openSync(path.join(out, job.name + '.log'), 'wx');
  let reason = null, bytes = 0, minFree = jobAdmissionFree;
  const stop = why => { reason ||= why; kill(); };
  function guard() {
    minFree = Math.min(minFree, free());
    if (minFree <= L.hardFloorBytes) stop('disk-floor');
    if (total(sizes(out).values()) + growth(renderDir, oldRender) > L.evidenceBytes) stop('evidence-cap');
    if (growth(buildDir, oldBuild) > L.buildGrowthBytes) stop('build-growth-cap');
    if (Date.now() - start >= L.jobMs) stop('outer-deadline');
  }
  guard(); assert(!reason, 'Output/disk guard before child launch');
  active = cp.spawn(job.command, job.args, { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const child = active;
  save(job.name + '-launch.json', { ...job, pid: child.pid, start, source: plan.source });
  const receive = b => { const room = Math.max(0, L.logBytes - bytes); if (room) fs.writeSync(fd, b.subarray(0, room)); bytes += b.length; if (bytes > L.logBytes) stop('log-cap'); };
  child.stdout.on('data', receive); child.stderr.on('data', receive);
  const timer = setInterval(guard, L.pollMs);
  child.on('error', e => { reason ||= 'spawn: ' + e.message; });
  const terminal = await new Promise(resolve => child.on('close', (code, signal) => resolve({ code, signal })));
  clearInterval(timer); fs.closeSync(fd); guard();
  if (child.pid && !absent(child.pid)) { stop('surviving-descendants'); for (let n = 0; n < 20 && !absent(child.pid); n++) await new Promise(resolve => setTimeout(resolve, 100)); }
  const groupAbsent = !child.pid || absent(child.pid); if (groupAbsent) active = null;
  let changed = null; try { verifyPlan(plan); } catch (e) { changed = e.message; }
  const result = { name: job.name, ...terminal, reason, bytes, minFree, elapsedMs: Date.now() - start, groupAbsent, changed };
  save(job.name + '.json', result); console.log(JSON.stringify(result));
  assert(terminal.code === 0 && !terminal.signal && !reason && groupAbsent && !changed, 'First failure terminal; no subsequent job');
  return result;
}
(async () => {
  const results = []; for (const job of jobs) results.push(await run(job));
  for (const f of priorModules) assert.equal(sha(fs.readFileSync(f.path)), f.sha256);
  const modules = ['wine-assembly.wasm', 'wine-assembly.compat.wasm'].map(name => ({ path: 'build/' + name, sha256: sha(fs.readFileSync(path.join(buildDir, name))) }));
  save('qualification.json', { version: 1, plan, results, modules, at: new Date().toISOString() });
})().catch(e => { kill(); save('failure.json', { error: e.stack }); console.error(e.message); process.exitCode = 1; }).finally(release);
