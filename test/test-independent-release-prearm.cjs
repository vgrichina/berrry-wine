'use strict';
// Retained evidence audit is read-only. Native qualification is a separate,
// explicitly gated invocation; this file never runs an original application.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const PREVIOUS = path.join(ROOT, 'scratch/runs/20261115-gta2-directx-version-causal-repair');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function directClosure(base, closure) {
  let references = 0;
  for (const ref of [...closure.receipts, ...(closure.additionalLifecycleRefs || [])]) {
    const file = path.resolve(base, ref.path);
    assert(file.startsWith(base + path.sep), 'local closure reference');
    const bytes = fs.readFileSync(file);
    assert.equal(sha(bytes), ref.sha256, ref.path);
    if (closure.receipts.includes(ref)) {
      const receipt = JSON.parse(bytes);
      for (const key of ['actualWait', 'stdoutEOF', 'stderrEOF']) assert.equal(receipt[key], true, ref.path + ' ' + key);
    }
    references++;
  }
  assert.equal(closure.receipts.length, closure.actualWaitReceiptCount ?? closure.actualWaitBothEOF);
  for (const entry of closure.pids) {
    const recordedPid = typeof entry === 'number' ? entry : entry.pid;
    assert(Number.isSafeInteger(recordedPid) && recordedPid > 1);
    for (const pid of [recordedPid, -recordedPid]) {
      assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH', 'recorded PID/group still present ' + pid);
    }
  }
  return {references, actualWaitBothEOF: closure.receipts.length,
    pidsAndGroupsAbsent: closure.pids.length, ancillaryUnknown: closure.ancillaryUnknown};
}

function retained() {
  const releasePath = path.join(PREVIOUS, 'runtime-release.json');
  assert.equal(sha(fs.readFileSync(releasePath)), '67f6e10d396adf4b01343444524d2a3496c56a6622aeb095936ec4226d5ed54f');
  const release = read(releasePath);
  for (const ref of [release.result, release.directClosure, ...release.evidence]) {
    assert.equal(sha(fs.readFileSync(path.join(PREVIOUS, ref.path))), ref.sha256, ref.path);
  }
  const closure = directClosure(PREVIOUS, read(path.join(PREVIOUS, release.directClosure.path)));
  const base = path.join(PREVIOUS, 'native-context-artifacts/test_transition');
  const intent = read(path.join(base, 'press0-intent.json'));
  const wait = read(path.join(base, 'press0-release-wait.json'));
  const up = read(path.join(base, 'press0-up.json'));
  assert.equal(fs.existsSync(path.join(base, 'press0-receipt.json')), false, 'no DOWN receipt');
  assert.equal(fs.existsSync(path.join(base, 'press0-completed.json')), false, 'not a qualified pulse');
  assert(wait.actualWait && wait.stdoutEOF && wait.stderrEOF);
  assert.equal(wait.exit, 0);
  const arm = JSON.parse(wait.stdout.trim());
  assert.equal(arm.pid, wait.pid);
  assert.deepEqual(arm.target, intent.target);
  assert.equal(arm.fallbackAt, intent.fallbackAt);
  assert.equal(up.reason, 'parent EOF');
  assert.equal(up.state, 'ACK');
  assert.equal(arm.at, undefined, 'old line does not timestamp publication');
  return {
    predecessorMain: release.main,
    releaseSHA256: sha(fs.readFileSync(releasePath)),
    directClosure: closure,
    noDownReceipt: true,
    qualifiedPulse: false,
    endpointPermanentlyClosed: true,
    intentToReleaseFiredMs: (up.firedAt - intent.createdAt) * 1000,
    intentToUpAckMs: (up.at - intent.createdAt) * 1000,
    exactChildStartupMs: null,
    cause: 'UNMEASURED: retained arm has no publication timestamp',
    originalLaunched: false,
  };
}

function nativeRecipe(output, fixture, diagnostic = 'none') {
  // The caller must first personally verify both CURRENT predecessor releases,
  // process absence, direct waits, and free locks. No automatic lane admission.
  assert.equal(process.env.PREARM_NATIVE_LANE_VERIFIED, '1', 'current predecessor release gate');
  assert(path.isAbsolute(output) && !fs.existsSync(output), 'new absolute output only');
  assert(path.isAbsolute(fixture) && fs.statSync(fixture).isFile());
  fs.mkdirSync(output, {recursive: true});
  assert(['none', 'imports', 'syscalls'].includes(diagnostic));
  let args = ['node', path.join(ROOT, 'test/test-cli-native-scene-context-native.cjs'),
    path.join(output, 'native-context'), fixture];
  // Require profiling (WINE_PREARM_REQUIRE_TIMING=1, the Node stand-in for
  // PYTHONPROFILEIMPORTTIME, consumed by the runner and by the controller)
  // propagates through the environment to the actual independent release child. Its
  // stderr is retained in that child's sealed release-wait, not synthesized.
  // Launch later through tools/forsaken-supervisor.cjs outerwait. That existing
  // path arms an independent observable watchdog before starting this suite.
  // -s 0 retains syscall times/counts only, not read/write buffer contents.
  // Trace overhead is diagnostic and never replaces an untraced qualification.
  if (diagnostic === 'syscalls') args = ['strace', '-ff', '-ttt', '-T', '-s', '0',
    '-e', 'trace=execve,pselect6,write,writev', '-o', path.join(output, 'startup.syscalls'), ...args];
  fs.writeFileSync(path.join(output, 'recipe.json'), JSON.stringify({
    args, cwd: ROOT, seconds: 180, heavy: true,
    env: diagnostic === 'imports' ? {WINE_PREARM_REQUIRE_TIMING: '1'} : {},
    fixtureSHA256: sha(fs.readFileSync(fixture)), diagnostic, originalLaunched: false,
  }, null, 2) + '\n', {flag: 'wx'});
}

function authoredStartup(output) {
  // A small, newly authored Node built-in require control only. It does NOT
  // require or execute any repository helper or qualify native prearm readiness.
  // Actual production-parent/child timings remain necessary after lane release.
  // The program is fed on stdin (`node -`), so totalMs covers Node startup too.
  assert(path.isAbsolute(output) && !fs.existsSync(output));
  const code = `const t=performance.now(),rows=[];
for (const name of ['node:path','node:fs','node:http','node:child_process','node:crypto','node:url','node:os']) {
 const s=performance.now();require(name);rows.push({module:name,milliseconds:performance.now()-s});
}
process.stdout.write(JSON.stringify({pid:process.pid,importsMs:performance.now()-t,rows})+'\\n');
`;
  const start = performance.now();
  const result = cp.spawnSync(process.execPath, ['-'], {
    cwd: ROOT, encoding: 'utf8', timeout: 3000, maxBuffer: 65536, input: code,
  });
  const record = {at: new Date().toISOString(), meaning: 'Authored Node startup + built-in require control; not actual helper/native qualification',
    totalMs: performance.now() - start, code, exit: result.status, signal: result.signal,
    actualWait: !result.error, stdoutEOF: !result.error, stderrEOF: !result.error,
    stdout: result.stdout, stderr: result.stderr, error: result.error?.message,
    repositoryHelperExecuted: false, nativeExecuted: false, originalLaunched: false};
  fs.writeFileSync(output, JSON.stringify(record, null, 2) + '\n', {flag: 'wx'});
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  return {...record, code: undefined, stdout: JSON.parse(result.stdout)};
}

function nativeFaultRecipe(output, fixture) {
  assert.equal(process.env.PREARM_NATIVE_LANE_VERIFIED, '1');
  assert(path.isAbsolute(output) && !fs.existsSync(output));
  assert(path.isAbsolute(fixture) && fs.statSync(fixture).isFile());
  fs.mkdirSync(output, {recursive: true});
  // All faults are explicit diagnostic interventions around the real helper.
  // They do not substitute a response, weaken native guards, or run a game.
  // The release child is intercepted at child_process.spawn (args script
  // basename sims-install-controller.cjs, args[-2] 'release'); its fault is
  // applied by preloading this same script (--require) with
  // WINE_PREARM_FAULT_CHILD set, so the child keeps the real controller's pid.
  const script = `'use strict';
if (process.env.WINE_PREARM_FAULT_CHILD) {
 // Preload role inside the release child: inject the fault, then (late-start) run the real controller.
 const kind = process.env.WINE_PREARM_FAULT_CHILD; delete process.env.WINE_PREARM_FAULT_CHILD;
 if (kind === 'start-failure') process.exit(73);
 if (kind === 'late-start') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 600);
} else {
const path = require('node:path'), fs = require('node:fs'), cp = require('node:child_process'), assert = require('node:assert/strict');
const [ROOT, OUT, FIXTURE] = process.argv.slice(2);
const f = require(path.join(ROOT, 'test/test-cli-native-scene-context-native.cjs'));
f.configure(OUT, FIXTURE, false);
const {c} = f;
const has = name => fs.existsSync(path.join(c.R, name));
class NativeStartupFault extends f.NativeSceneContext {
 async fault(kind) {
  const originalCall = c.call, realSpawn = cp.spawn, requests = [];
  c.call = async (command, timeout = 10) => {
   requests.push({command, at: Date.now() / 1000});
   const reply = await originalCall(command, timeout);
   if (kind === 'late-ack' && command.action === 'guarded-input') await new Promise(r => setTimeout(r, 500));
   return reply;
  };
  cp.spawn = function spawn(command, args, options) {
   if (Array.isArray(args) && args.length >= 3 && args[args.length - 2] === 'release' &&
       path.basename(args[args.length - 3]) === 'sims-install-controller.cjs' && kind !== 'late-ack')
    [args, options] = [['--require', __filename, ...args], {...options, env: {...(options?.env ?? process.env), WINE_PREARM_FAULT_CHILD: kind}}];
   return realSpawn.call(cp, command, args, options);
  };
  try {
   let failure;
   try { failure = await f.raises(() => f.NativeSceneContext.prototype.test_transition.call(this)); }
   finally { cp.spawn = realSpawn; }
   const intent = c.read('press0-intent.json'), wait = c.read('press0-release-wait.json');
   assert(wait.actualWait && wait.stdoutEOF && wait.stderrEOF);
   assert(has('terminal-input-failure.json'));
   assert(!has('press0-completed.json'));
   const downs = requests.filter(r => r.command.action === 'guarded-input');
   assert.equal(downs.length, kind === 'late-ack' ? 1 : 0);
   if (kind === 'late-start') {
    assert(String(failure.message).includes('independent UP not armed'));
    const arm = JSON.parse(wait.stdout); assert.equal(arm.pid, wait.pid);
    assert.equal(c.read('press0-up.json').reason, 'parent EOF');
    assert(!has('press0-armed.json'));
   } else if (kind === 'start-failure') {
    assert.equal(wait.exit, 73); assert(!has('press0-up.json'));
   } else {
    assert(String(failure.message).includes('late ACK'));
    const up = c.read('press0-up.json'); assert.equal(up.state, 'ACK');
    assert(up.at - intent.createdAt <= 1.750);
   }
   const count = requests.length;
   for (const work of [() => c.capture('after-failure'), () => c.bind(), () => c.lease()]) await f.raises(work);
   assert.equal(requests.length, count);
   c.save('startup-fault-checks.json', {kind, injectedFault: true, actualProductionCauseClaim: false,
    failure: String(failure.message), guardedDownRequests: downs.length, laterRequests: 0, endpointPermanentlyClosed: true,
    originalExecuted: false, requests});
  } finally { c.call = originalCall; }
 }
 test_late_start() { return this.fault('late-start'); }
 test_start_failure() { return this.fault('start-failure'); }
 test_late_ack() { return this.fault('late-ack'); }
}
const names = ['test_late_start', 'test_start_failure', 'test_late_ack'];
f.runSuite(names.map(n => new NativeStartupFault(n)))
 .catch(e => { console.error(e); return false; })
 .then(ok => process.stderr.write('', () => process.exit(ok ? 0 : 1)));
}
`;
  const scriptPath = path.join(output, 'authored-native-startup-faults.cjs');
  fs.writeFileSync(scriptPath, script, {flag: 'wx'});
  fs.writeFileSync(path.join(output, 'recipe.json'), JSON.stringify({
    args: ['node', scriptPath, ROOT, path.join(output, 'native-context'), fixture],
    cwd: ROOT, seconds: 180, heavy: true, fixtureSHA256: sha(fs.readFileSync(fixture)),
    injectedFaults: ['late-start', 'start-failure', 'late-ack'], originalLaunched: false,
  }, null, 2) + '\n', {flag: 'wx'});
}

function verifyNative(output, faults = false) {
  const get = relative => read(path.join(output, relative));
  for (const name of ['actual-outer-wait.json', 'outer-child-wait.json', 'watchdog-wait.json', 'native-wait.json']) {
    const receipt = get(name);
    for (const key of ['actualWait', 'stdoutEOF', 'stderrEOF']) assert.equal(receipt[key], true, name + ' ' + key);
    assert.equal(receipt.exit, 0, name);
  }
  assert.match(fs.readFileSync(path.join(output, 'native.stderr.log'), 'utf8'), /\nOK\n/);
  const cases = [];
  if (faults) {
    for (const name of ['test_late_start', 'test_start_failure', 'test_late_ack']) {
      const checks = get('native-context/' + name + '/startup-fault-checks.json');
      assert.equal(checks.injectedFault, true);
      assert.equal(checks.actualProductionCauseClaim, false);
      assert.equal(checks.laterRequests, 0);
      assert.equal(checks.endpointPermanentlyClosed, true);
      assert.equal(checks.originalExecuted, false);
      cases.push(checks.kind);
    }
  } else {
    const base = 'native-context/test_transition/';
    for (let i = 0; i < 2; i++) {
      const intent = get(base + 'press' + i + '-intent.json');
      const armed = get(base + 'press' + i + '-armed.json');
      const wait = get(base + 'press' + i + '-release-wait.json');
      const receipt = get(base + 'press' + i + '-receipt.json');
      const up = get(base + 'press' + i + '-up.json');
      assert.equal(armed.pid, wait.pid);
      assert.deepEqual(armed.target, intent.target);
      assert.equal(armed.fallbackAt, intent.fallbackAt);
      assert(wait.actualWait && wait.stdoutEOF && wait.stderrEOF);
      assert.equal(wait.exit, 0);
      for (const key of ['owner', 'epoch']) assert.equal(receipt[key], intent.owner[key]);
      assert.equal(receipt.nonce, intent.nonce);
      assert(receipt.consumed && receipt.state === 'CONSUMED');
      assert.equal(up.reason, 'consumed pulse');
      assert(['ACK', 'OWNER_EXITED'].includes(up.state));
      assert(up.firedAt <= intent.fallbackAt);
      assert(up.at - receipt.consumedAt / 1000 <= 1.750);
      assert(fs.existsSync(path.join(output, base + 'press' + i + '-completed.json')));
      cases.push({name: 'press' + i, nonce: intent.nonce, physicalUpMs: (up.at - receipt.consumedAt / 1000) * 1000,
        state: up.state, visibleSceneQualification: false});
    }
    const refused = get('native-context/test_focus_changed_before_consumption/native-focus-refused.json');
    assert.equal(refused.state, 'CANCELLED');
    assert.equal(refused.consumed, false);
    assert.equal(refused.reason, 'reviewed native scene changed');
    cases.push('native focus change refused');
  }
  return {cases, actualNative: true, injectedFaults: faults,
    productionRepairClaim: false, originalLaunched: false, browserWorkerQualification: false};
}

module.exports = {retained, nativeRecipe, nativeFaultRecipe, verifyNative, directClosure, authoredStartup};
if (require.main === module) {
  const [mode, output, fixture] = process.argv.slice(2);
  if (mode === '--retained') console.log(JSON.stringify(retained(), null, 2));
  else if (mode === '--authored-startup') console.log(JSON.stringify(authoredStartup(output), null, 2));
  else if (mode === '--prepare-native') nativeRecipe(output, fixture);
  else if (mode === '--prepare-profiled-native') nativeRecipe(output, fixture, 'imports');
  else if (mode === '--prepare-traced-native') nativeRecipe(output, fixture, 'syscalls');
  else if (mode === '--prepare-native-faults') nativeFaultRecipe(output, fixture);
  else if (mode === '--verify-native' || mode === '--verify-faults') console.log(JSON.stringify(verifyNative(output, mode === '--verify-faults'), null, 2));
  else throw Error('use --retained, --authored-startup, gated --prepare-native/--prepare-profiled-native/--prepare-traced-native/--prepare-native-faults OUT FIXTURE, or --verify-native/--verify-faults OUT');
}
