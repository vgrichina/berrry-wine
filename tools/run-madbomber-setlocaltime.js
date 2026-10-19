'use strict';
// Relocated original consumer: same lifecycle/guards as committed local controller.
// Generated source is separately pinned; only argv/pin preparation uses the transfer inventory.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const guard = require('./run-lockfile-native');
const root = path.resolve(__dirname, '..');
const moduleHash = 'b2fdf52732a3046c1b26468a335a6a9b32ea16fcda5d4f111977306be9729541';
const builtCommit = '504d6f77365cfa6d22f6f16e983020c7d8dc3fbe';
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const git = (...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
const free = () => { const s = fs.statfsSync(root); return s.bavail * s.bsize; };
function admit(readFree = free) {
  const sample = { at: new Date().toISOString(), cwd: process.cwd(), root,
    freeBytes: readFree(), exclusiveThreshold: guard.ADMIT };
  assert(sample.freeBytes > sample.exclusiveThreshold, 'fresh admission refused: ' + JSON.stringify(sample));
  return sample;
}
const save = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const option = name => process.argv.find(a => a.startsWith('--' + name + '='))?.slice(name.length + 3);
const transfer = JSON.parse(fs.readFileSync(path.join(root, 'scratch/portable/setlocaltime-transfer.json')));
function argv(out) {
  return transfer.command.argv.map(arg => arg.replaceAll('${PACKET_ROOT}', root).replaceAll('${OUTPUT}', out));
}
async function main() {
  const file = option('manifest'); assert(file && path.isAbsolute(file));
  assert(process.argv.includes('--execute')); assert.equal(process.env.WA_LOCKFILE_RUNTIME_GRANTED, '1');
  assert.equal(sha(file), process.env.WA_LOCKFILE_MANIFEST_SHA256);
  const m = JSON.parse(fs.readFileSync(file));
  assert.equal(m.root, root); assert.equal(m.commit, git('rev-parse', 'HEAD'));
  assert.equal(m.transferSha256, sha(path.join(root, 'scratch/portable/setlocaltime-transfer.json')));
  assert.deepEqual(m.argv, argv('OUTPUT'));
  assert.deepEqual([m.guestSeconds, m.quitSeconds, m.hardSeconds], [10, 15, 25]);
  assert.equal(sha(path.join(root, 'build/wine-assembly.wasm')), moduleHash);
  const qualification = JSON.parse(fs.readFileSync(m.qualification));
  require('./setlocaltime-plan').verifyQualification(qualification, root);
  assert.equal(qualification.plan.source, builtCommit);
  assert.equal(qualification.modules[0].sha256, moduleHash);
  const boot = require('./runner-boot-assets').auditBoot(root, builtCommit);
  assert.deepEqual(boot, m.bootAssets, 'Exact qualified CLI boot closure required');
  guard.verifyPins(m.pins); const admission = admit();
  const out = option('out'); assert(out && path.isAbsolute(out) && !fs.existsSync(out));
  assert(guard.aggregateBytes(m, out) < guard.TOTAL);
  const lease = '/tmp/wine-assembly-local-runtime.lock'; fs.mkdirSync(lease);
  let child, fd, timers = [], reason = null, logBytes = 0, minFree = free(), tail = '';
  const startedAt = new Date().toISOString();
  const kill = () => { if (child?.pid) try { process.kill(-child.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; } };
  const send = message => { if (child?.stdin.writable) child.stdin.write(JSON.stringify(message) + '\n'); };
  const stop = (why, hard = false) => { reason ||= why; send({ action: 'quit' }); if (hard) kill(); };
  const signal = () => stop('controller signal', true);
  process.on('SIGINT', signal); process.on('SIGTERM', signal); process.once('exit', kill);
  try {
    save(path.join(lease, 'owner.json'), { pid: process.pid, root, manifest: file });
    fs.mkdirSync(out); fs.copyFileSync(file, path.join(out, 'manifest.json'));
    save(path.join(out, 'launch.json'), { cwd: root, args: argv(out), inputs: [], startedAt, admission });
    fd = fs.openSync(path.join(out, 'output.log'), 'wx');
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(WA_|WINE_|NODE_OPTIONS$|NODE_PATH$)/.test(k)));
    env.NODE_PATH = m.nodePath;
    child = cp.spawn(process.execPath, argv(out), { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.on('error', () => {});
    save(path.join(out, 'child.json'), { pid: child.pid, controllerPid: process.pid });
    const receive = bytes => {
      const part = bytes.subarray(0, Math.max(0, guard.LOG - logBytes)); if (part.length) fs.writeSync(fd, part);
      logBytes += bytes.length; tail = (tail + bytes.toString()).slice(-32768);
      if (logBytes >= guard.LOG) stop('log cap', true);
      else if (/unimplemented|RuntimeError|\[CRASH\]|DLL initializer did not return|Unable to link to KERNEL32/i.test(tail)) stop('crash text');
    };
    child.stdout.on('data', receive); child.stderr.on('data', receive);
    timers.push(setInterval(() => {
      try { minFree = Math.min(minFree, free());
        if (minFree <= guard.FLOOR) stop('disk floor', true);
        if (guard.aggregateBytes(m, out) > guard.TOTAL) stop('aggregate output cap', true);
      } catch (e) { stop('monitor failure: ' + e.message, true); }
    }, 200));
    for (const seconds of [5, 9]) timers.push(setTimeout(() => {
      if (!reason) { send({ action: 'snapshot' }); send({ action: 'png', path: path.join(out, 'sample-' + seconds + 's.png') }); }
    }, seconds * 1000));
    timers.push(setTimeout(() => stop('host time limit'), 15000));
    timers.push(setTimeout(() => stop('hard time limit', true), 25000));
    const terminal = await new Promise(resolve => {
      child.once('error', error => resolve({ error: error.message }));
      child.once('close', (code, signal) => resolve({ code, signal }));
    });
    if (child.pid && !guard.groupAbsent(child.pid)) {
      kill(); for (let n = 0; n < 20 && !guard.groupAbsent(child.pid); n++) await new Promise(r => setTimeout(r, 50));
    }
    const absent = !child.pid || guard.groupAbsent(child.pid);
    save(path.join(out, 'terminal.json'), { ...terminal, reason, minFree, logBytes: Math.min(logBytes, guard.LOG), groupAbsent: absent });
    guard.verifyPins(m.pins);
    save(path.join(out, 'postflight.json'), { pins: m.pins.length, changed: [], groupAbsent: absent });
    // Unregistered title: investigation evidence only, not a dashboard claim.
    save(path.join(out, 'result.json'), { registered: false, startedAt, finishedAt: new Date().toISOString(),
      outcome: terminal.code === 0 && !reason && absent ? 'unknown' : 'failed', verification: 'unreviewed',
      summary: 'Original startup observation requires log/image review; no gameplay claim.',
      route: 'cooperative CLI original startup', build: { commit: builtCommit, wasmSha256: moduleHash }, terminal });
    assert(terminal.code === 0 && !reason && absent, 'original run did not complete cleanly');
  } finally {
    kill(); for (const timer of timers) clearTimeout(timer); if (fd !== undefined) fs.closeSync(fd);
    process.off('SIGINT', signal); process.off('SIGTERM', signal); process.off('exit', kill);
    fs.unlinkSync(path.join(lease, 'owner.json')); fs.rmdirSync(lease);
  }
}
module.exports = { argv, admit };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
