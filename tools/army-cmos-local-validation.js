'use strict';
// Sole-lane local normal build + existing original-fixture x86 regression.
// Preparation is read-only except its small receipt. Runtime needs the grant
// flag, exact root HEAD, original pins and fresh admission after receipt writes.
const fs = require('node:fs'), cp = require('node:child_process'), path = require('node:path'), crypto = require('node:crypto');
const [rootArg, expectedHead, dirArg, mode] = process.argv.slice(2);
if (!rootArg || !/^[a-f0-9]{40}$/.test(expectedHead || '') || !dirArg ||
    !['--prepare-only', '--root-runtime-granted'].includes(mode)) throw Error('root exactHead newEvidenceDir --prepare-only|--root-runtime-granted');
const root = path.resolve(rootArg), dir = path.resolve(dirArg);
const admission = 2847932416, stop = 2214592512, outputCap = 28 * 1024 ** 2;
const measuredRemoteBuildBytes = 24362790;
const original = '/home/user/wine-assembly/test/binaries/notepad.exe';
const originalHash = 'e7b01ab85a35ba6f577067d13efa522dc3d605de7712340e4acaf7065f866340';
const expectedModules = {
  'wine-assembly.wasm': '7fd02a77ec01e5e18065d112b1da434886a0dba3fcadd7ff043d1e2ddca41f33',
  'wine-assembly.compat.wasm': 'a72bbc3829f2ed562ecfb0692bdc2861778b0a0e479806af885e19619a2e0640',
};
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const git = args => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const free = () => { const s = fs.statfsSync(root); return s.bavail * s.bsize; };
const size = p => !fs.existsSync(p) ? 0 : fs.statSync(p).isDirectory()
  ? fs.readdirSync(p).reduce((n, e) => n + (e === 'prior-build' ? 0 : size(path.join(p, e))), 0)
  : fs.statSync(p).size;
const absent = pid => { try { process.kill(-pid, 0); return false; } catch (e) { if (e.code === 'ESRCH') return true; throw e; } };
const signalGroup = (pid, signal) => { try { process.kill(-pid, signal); } catch (e) { if (e.code !== 'ESRCH') throw e; } };
function verifySource() {
  if (git(['rev-parse', 'HEAD']) !== expectedHead) throw Error('root HEAD mismatch');
  git(['diff', '--exit-code', 'ebc222252b358cbb7f2d25147e2deb97ab6b3949', '--', 'src', 'lib', 'host.js', 'test/test-x86-ops.js']);
  if (git(['status', '--porcelain', '--untracked-files=no'])) throw Error('tracked root edits');
  if (hash(original) !== originalHash) throw Error('original notepad pin mismatch');
}
async function main() {
  verifySource();
  const fixture = path.join(root, 'test/binaries/notepad.exe');
  if (fs.existsSync(fixture) && hash(fixture) !== originalHash) throw Error('existing fixture mismatch');
  fs.mkdirSync(dir, { recursive: true });
  if (fs.readdirSync(dir).some(n => n !== 'ready.json')) throw Error('evidence already used; no retry');
  const oldBuild = path.join(root, 'build');
  const prior = fs.readdirSync(oldBuild).map(name => ({ name, bytes: fs.statSync(path.join(oldBuild, name)).size, sha256: hash(path.join(oldBuild, name)) }));
  const ready = { root, expectedHead, at: new Date().toISOString(), sourceReference: 'ebc222252b358cbb7f2d25147e2deb97ab6b3949',
    original, originalHash, originalBytes: fs.statSync(original).size, fixtureAlreadyPresent: fs.existsSync(fixture),
    prior, existingBuildBytes: size(oldBuild), measuredRemoteBuildBytes, outputCap, admission, stop, expectedModules,
    estimate: 'normal remote build ~24.4MB; aggregate28MiB includes new build and all logs/receipts; prior build renamed, not copied',
    freeBeforeReceipt: free() };
  fs.writeFileSync(path.join(dir, 'ready.json'), JSON.stringify(ready, null, 2) + '\n');
  const admittedFree = free();
  if (mode === '--prepare-only') { console.log(JSON.stringify({ ...ready, freeAfterReceipt: admittedFree, wouldAdmit: admittedFree > admission, runtime: false })); return; }
  if (admittedFree <= admission) throw Error(`admission ${admittedFree} <= ${admission}`);
  if (measuredRemoteBuildBytes + 2 * 1024 ** 2 >= outputCap) throw Error('measured output estimate does not fit');
  // Rename is metadata-only and leaves the old bytes intact. Never link a
  // build target: overwriting a hardlink could corrupt the preserved module.
  fs.renameSync(oldBuild, path.join(dir, 'prior-build'));
  fs.mkdirSync(oldBuild);
  if (!fs.existsSync(fixture)) fs.linkSync(original, fixture);
  if (free() <= admission) throw Error('post-staging admission failed; prior build retained without launch');
  let active = null, minFree = free();
  const kill = () => { if (active) signalGroup(active, 'SIGKILL'); };
  process.on('exit', kill);
  for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { kill(); process.exitCode = 1; });
  async function job(name, command, args, env, deadline) {
    const fd = fs.openSync(path.join(dir, name + '.log'), 'wx'), start = Date.now();
    const child = cp.spawn(command, args, { cwd: root, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', fd, fd] });
    active = child.pid; let guard = null;
    const checkBounds = () => {
      minFree = Math.min(minFree, free());
      if (minFree <= stop) guard ||= 'disk';
      if (Date.now() - start > deadline) guard ||= 'deadline';
      if (fs.fstatSync(fd).size > 2 * 1024 ** 2) guard ||= 'log';
      if (size(oldBuild) + size(dir) > outputCap) guard ||= 'output';
      if (guard) kill();
    };
    const timer = setInterval(checkBounds, 100);
    const exit = await new Promise(resolve => {
      child.on('error', error => { guard = 'spawn: ' + error.message; });
      child.on('close', (code, signal) => resolve({ code, signal }));
    });
    clearInterval(timer);
    checkBounds();
    if (child.pid && !absent(child.pid)) { guard ||= 'descendants-after-exit'; kill(); }
    for (let i = 0; child.pid && !absent(child.pid) && i < 20; i++) await new Promise(r => setTimeout(r, 100));
    fs.closeSync(fd); active = null;
    const receipt = { name, command, args, ...exit, guard, pid: child.pid, groupAbsent: child.pid ? absent(child.pid) : true,
      elapsedMs: Date.now() - start, deadline, minFree, outputBytes: size(oldBuild) + size(dir), logBytes: fs.statSync(path.join(dir, name + '.log')).size };
    fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify(receipt));
    if (exit.code !== 0 || guard || !receipt.groupAbsent) throw Error('terminal failure: ' + name);
    verifySource();
  }
  await job('build', 'bash', ['tools/build.sh'], {}, 180000);
  for (const [name, pin] of Object.entries(expectedModules)) if (hash(path.join(oldBuild, name)) !== pin) throw Error('remote/local module mismatch: ' + name);
  for (const [name, module] of [['x86-primary', 'wine-assembly.wasm'], ['x86-compat', 'wine-assembly.compat.wasm']]) {
    await job(name, process.execPath, ['test/test-x86-ops.js'], { WINE_ASSEMBLY_WASM: path.join(oldBuild, module) }, 60000);
  }
  for (const p of prior) if (hash(path.join(dir, 'prior-build', p.name)) !== p.sha256) throw Error('prior build altered');
  verifySource();
  fs.writeFileSync(path.join(dir, 'complete.json'), JSON.stringify({ pass: true, root, expectedHead, expectedModules, originalHash, minFree, priorUnchanged: true }, null, 2) + '\n');
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
