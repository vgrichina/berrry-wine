'use strict';
// Detached owner of native+watchdog waits. No pipe to the invoking tool.
// Node port of the former disciples2-current-supervisor.py; same CLI and records:
//   node tools/disciples2-current-supervisor.cjs hold-module|watchdog|holderwait|detach-holder|run|outerwait|durablewait|detach OUT [...]
//
// Sealing: Node has no memfd_create/F_ADD_SEALS. Bodies are held as read-only
// files with no writer (tools/native-supervisor-common.cjs seal/holdBody);
// "sealed: 15" keeps its record meaning of an immutable holder body.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), os = require('node:os');
const assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const c = require('./native-supervisor-common.cjs');
const { watchdog, drain } = require('./forsaken-supervisor.cjs');
const SELF = __filename;
const LINUX = process.platform === 'linux';

const OWNED = new Set(['tools/disciples2-current-supervisor.cjs', 'tools/disciples2-current-native-source-view.cjs',
  'tools/disciples2-public-consumer-observer.cjs',
  'tools/disciples2-public-pump-fixture.cjs', 'test/test-disciples2-native-callback-readiness.cjs',
  'tools/disciples2-current-preflight.cjs', 'tools/disciples2-current-controller.cjs', 'tools/native-supervisor-common.cjs',
  'tools/forsaken-supervisor.cjs',
  'test/test-disciples2-current-quest.cjs',
  'lib/renderer-input.js',
  'lib/cli-native-pointer-coordinates.js', 'lib/cli-native-scene.js', 'lib/cli-native-user-windows.js',
  'test/run.js', 'test/test-cli-native-pointer-coordinates.cjs',
  'test/test-disciples2-native-paint-binding.cjs', 'test/test-vb5-native-dialog-identity.cjs']);
const PRELOAD = 'tools/disciples2-current-native-source-view.cjs';
const digest = c.sha256;
const save = (out, name, value) => c.save(out, name, value);
const seal = (label, body) => c.seal(label, body);
const fdPath = fd => c.fdPath(fd);

function indexedSources(bodies) {
  const names = Object.keys(bodies).sort();
  const rows = []; let offset = 0;
  for (const name of names) { const body = bodies[name]; rows.push({ path: name, sha256: digest(body), size: body.length, offset }); offset += body.length; }
  const index = Buffer.from(JSON.stringify({ version: 1, files: rows }));
  const header = Buffer.alloc(4); header.writeUInt32LE(index.length);
  return [Buffer.concat([header, index, ...names.map(n => bodies[n])]), index, rows];
}
function validateSources(pool, manifest) {
  const size = pool.readUInt32LE(0), index = pool.subarray(4, 4 + size);
  assert(digest(index) === manifest.sourceIndexSHA256, 'source index differs');
  const parsed = JSON.parse(index); assert(parsed.version === 1 && isDeepStrictEqual(parsed.files, manifest.sources), 'source inventory differs');
  let end = 0; const seen = new Set();
  for (const row of parsed.files) {
    const name = row.path;
    assert(!seen.has(name) && !path.posix.isAbsolute(name) && !name.split('/').includes('..'), 'source path inventory');
    seen.add(name); assert(row.offset === end && Number.isInteger(row.size) && row.size >= 0, 'source inventory range');
    const body = pool.subarray(4 + size + end, 4 + size + end + row.size);
    assert(body.length === row.size && digest(body) === row.sha256, 'source inventory hash');
    end += row.size;
  }
  assert(end + 4 + size === pool.length, 'source inventory closure');
  return parsed.files;
}
const git = (root, ...args) => cp.execFileSync('git', args, { cwd: root, maxBuffer: 2 ** 31 - 1 });
function selected(name) {
  return (['src/', 'lib/', 'tools/', 'fonts/'].some(p => name.startsWith(p)) ||
    (name.startsWith('test/') && name.split('/').length === 2) || name.startsWith('test/helpers/') ||
    ['host.js', 'test/candidate-corpus/manifest.json'].includes(name)) &&
    ['.js', '.cjs', '.json', '.wat', '.watx', '.py'].some(s => name.endsWith(s));
}

async function prepareHolder(out, recipe) {
  // Only Git bytes plus enumerated owned patches. Never sample foreign WIP.
  const root = path.resolve(recipe.cwd), revision = recipe.sourceRevision;
  const head = git(root, 'rev-parse', revision + '^{commit}').toString().trim();
  assert(head === revision && cp.spawnSync('git', ['merge-base', '--is-ancestor', head, 'main'], { cwd: root }).status === 0, 'recorded main revision required');
  const names = git(root, 'ls-tree', '-r', '--name-only', head).toString().split('\n').filter(Boolean).filter(selected).sort();
  const bodies = {};
  const batch = cp.spawnSync('git', ['cat-file', '--batch'], { cwd: root, input: names.map(n => head + ':' + n + '\n').join(''), maxBuffer: 2 ** 31 - 1 });
  assert.equal(batch.status, 0);
  let cursor = 0; const raw = batch.stdout;
  for (const name of names) {
    const end = raw.indexOf(0x0a, cursor), header = raw.subarray(cursor, end).toString().split(' ');
    assert(header[1] === 'blob', name); const size = Number(header[2]); cursor = end + 1;
    bodies[name] = raw.subarray(cursor, cursor + size); cursor += size;
    assert(raw[cursor] === 0x0a); cursor += 1;
  }
  const patches = [], nameSet = new Set(names);
  for (const name of recipe.ownedPatchPaths || []) {
    assert(OWNED.has(name), 'unowned source patch: ' + name);
    bodies[name] = fs.readFileSync(path.join(root, name));
    const diff = cp.spawnSync('git', nameSet.has(name) ? ['diff', '--binary', head, '--', name] : ['diff', '--no-index', '--binary', '--', '/dev/null', name],
      { cwd: root, maxBuffer: 1 << 30 });
    assert([0, 1].includes(diff.status) && !diff.stderr.length); patches.push(diff.stdout);
  }
  fs.writeFileSync(path.join(out, 'runtime-source.patch'), Buffer.concat(patches));
  const installed = ['test/binaries/candidates/disciples2-demo/.wine-assembly-browser.json',
    'scratch/runs/20261112-disciples2-postbattle-native-load-cause-0836/runtime-pins.json'];
  const pngjs = path.join(root, 'node_modules/pngjs');
  for (const rel of fs.readdirSync(pngjs, { recursive: true }).sort()) {
    const full = path.join(pngjs, rel);
    if (fs.statSync(full).isFile() && ['.js', '.json'].includes(path.extname(full))) installed.push(path.relative(root, full));
  }
  for (const name of installed) bodies[name] = fs.readFileSync(path.join(root, name));
  const [pool, index, rows] = indexedSources(bodies);
  const source = c.holdBody('disciples2-git-sources', pool);
  const preload = c.holdBody('disciples2-preload', bodies[PRELOAD]);
  // The compile child writes the module to an inherited descriptor.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'disciples2-compile-'));
  const rawFd = fs.openSync(path.join(scratch, 'module'), 'w+', 0o600); fs.unlinkSync(path.join(scratch, 'module')); fs.rmdirSync(scratch);
  const env = { ...process.env }; assert(!env.NODE_OPTIONS);
  Object.assign(env, { DISCIPLES2_ROOT: root, DISCIPLES2_SOURCE_FD: source.path,
    DISCIPLES2_SOURCE_SHA256: digest(pool), DISCIPLES2_SOURCE_INDEX_SHA256: digest(index), DISCIPLES2_PHASE: 'compile', COMPILE_FD: String(rawFd) });
  const code = "const c=require('./tools/watx-closure.js'),h=require('./tools/region-layout-hash.js');const r=c.compileClosure(c.watxSourceClosure(),{tailCalls:true});if(!r.success)throw Error(JSON.stringify(r));require('fs').writeFileSync(Number(process.env.COMPILE_FD),h.appendSection(Buffer.from(r.wasmBinary),h.layoutHash(r.regions.regions)));";
  const prepath = preload.path;
  const pre = cp.spawnSync(process.execPath, ['--preserve-symlinks', '--require', prepath, '-'], { cwd: root, env, input: code,
    stdio: c.stdioWithFds([rawFd], ['pipe', 'pipe', 'pipe']), timeout: 240000, maxBuffer: 1 << 30 });
  const preExit = c.returncode(pre.status, pre.signal);
  save(out, 'compile-wait.json', { exit: preExit, actualWait: true, stdoutEOF: true, stderrEOF: true, stdout: String(pre.stdout), stderr: String(pre.stderr), at: c.now() });
  assert(preExit === 0, 'Git-only compilation failed');
  const size = fs.fstatSync(rawFd).size, body = Buffer.alloc(Math.min(size, 10000000));
  fs.readSync(rawFd, body, 0, body.length, 0); fs.closeSync(rawFd);
  const module = c.holdBody('disciples2-qualified-module', body);
  const manifest = { version: 1, gitSHA: head, patchSHA256: digest(Buffer.concat(patches)), sourceSHA256: digest(pool),
    moduleSHA256: digest(body), preloadSHA256: digest(bodies[PRELOAD]), sourceIndexSHA256: digest(index),
    sources: rows, installedInputs: installed, foreignWIPAdopted: false };
  const encoded = Buffer.from(c.canonical(manifest)); const manifestHeld = c.holdBody('disciples2-manifest', encoded);
  save(out, 'manifest.json', manifest);
  const holder = { pid: process.pid, startToken: c.token(process.pid), sealed: 15, manifestSHA256: digest(encoded),
    sourcePath: source.path, fdPath: module.path, preloadPath: prepath, manifestPath: manifestHeld.path };
  save(out, 'holder.json', holder);
  while (!c.exists(path.join(out, 'stop.json'))) await c.sleep(50);
  for (const h of [source, preload, module, manifestHeld]) h.close();
  save(out, 'holder-closed.json', { closed: true, at: c.now() });
}
function holderBytes(holder, key) {
  const p = holder[key]; assert(c.holderPathAllowed(holder.pid, p), 'holder descriptor identity');
  try { return c.readDescriptor(p); } catch (e) { if (e.name === 'AssertionError') throw Error('holder descriptor is not sealed'); throw e; }
}
function frozenInputs(out, recipe) {
  assert(recipe.moduleHolder, 'moduleHolder activation is mandatory; shared runtime forbidden');
  assert(recipe.immutableManifest && typeof recipe.immutableManifest === 'object' && !Array.isArray(recipe.immutableManifest), 'exact immutableManifest required');
  const holder = c.readJSON(recipe.moduleHolder);
  assert(c.token(holder.pid) === holder.startToken, 'stale holder');
  assert(holder.sealed === 15);
  const encoded = holderBytes(holder, 'manifestPath'), manifest = JSON.parse(encoded);
  assert(digest(encoded) === holder.manifestSHA256 && holder.manifestSHA256 === recipe.immutableManifest.manifestSHA256, 'manifest identity differs');
  assert(['gitSHA', 'sourceSHA256', 'moduleSHA256', 'preloadSHA256'].every(k => isDeepStrictEqual(recipe.immutableManifest[k], manifest[k])), 'recipe manifest differs');
  assert(manifest.version === 1 && manifest.foreignWIPAdopted === false);
  const pool = holderBytes(holder, 'sourcePath'), module = holderBytes(holder, 'fdPath'), preload = holderBytes(holder, 'preloadPath');
  assert(digest(pool) === manifest.sourceSHA256 && digest(module) === manifest.moduleSHA256 && digest(preload) === manifest.preloadSHA256, 'holder bytes differ');
  const rows = validateSources(pool, manifest);
  const pre = rows.find(r => r.path === PRELOAD);
  assert(pre, 'StopIteration'); assert(pre.sha256 === digest(preload), 'preload not in source inventory');
  assert(c.token(holder.pid) === holder.startToken, 'holder changed during validation');
  const fds = [['sources', pool], ['module', module], ['preload', preload]].map(([label, b]) => seal(label, b));
  const env = { ...process.env }; assert(!env.NODE_OPTIONS, 'unexpected NODE_OPTIONS');
  const entry = rows.find(r => r.path === 'test/run.js').sha256;
  Object.assign(env, { DISCIPLES2_ROOT: path.resolve(recipe.cwd), DISCIPLES2_PHASE: 'runtime',
    DISCIPLES2_SOURCE_FD: fdPath(fds[0]), DISCIPLES2_MODULE_FD: fdPath(fds[1]),
    DISCIPLES2_SOURCE_SHA256: manifest.sourceSHA256, DISCIPLES2_SOURCE_INDEX_SHA256: manifest.sourceIndexSHA256, DISCIPLES2_MODULE_SHA256: manifest.moduleSHA256,
    DISCIPLES2_ENTRY_SHA256: entry, DISCIPLES2_MANIFEST_SHA256: holder.manifestSHA256, DISCIPLES2_PRELOAD: fdPath(fds[2]) });
  env.NODE_OPTIONS = '--preserve-symlinks --require=' + env.DISCIPLES2_PRELOAD;
  save(out, 'runtime-inputs.json', { ...manifest, manifestSHA256: holder.manifestSHA256, holder, sourceSeals: 15, moduleSeals: 15, preloadSeals: 15 });
  return [env, fds];
}
function inheritanceProbe(out, recipe, env) {
  assert(recipe.childInheritance === 'sealed-node-v1', 'explicit sealed child inheritance required');
  assert(recipe.args[0] === 'node', 'only qualified Node child loading supported');
  const check = `const fs=require('node:fs'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const identity={manifest:globalThis.__disciples2Manifest,module:hash(fs.readFileSync('build/wine-assembly.wasm')),entry:hash(fs.readFileSync('test/run.js'))};
if(identity.manifest!==process.env.DISCIPLES2_MANIFEST_SHA256||identity.module!==process.env.DISCIPLES2_MODULE_SHA256||identity.entry!==process.env.DISCIPLES2_ENTRY_SHA256)throw Error('actual source/module identity differs');
`;
  const worker = check + "require('node:worker_threads').parentPort.postMessage(identity);";
  const child = check + 'console.log(JSON.stringify(identity));';
  const code = check + "const {Worker}=require('node:worker_threads'),cp=require('node:child_process');const w=new Worker(" + JSON.stringify(worker) + ",{eval:true});w.on('message',v=>{if(JSON.stringify(v)!==JSON.stringify(identity))throw Error('Worker identity differs');const p=cp.spawnSync(process.execPath,['-e'," + JSON.stringify(child) + "],{env:process.env});if(p.status!==0||JSON.stringify(JSON.parse(p.stdout))!==JSON.stringify(identity))throw Error('child identity differs: '+p.stderr);console.log(JSON.stringify({main:identity,worker:v,child:JSON.parse(p.stdout),childExit:p.status}));});";
  const pre = cp.spawnSync(process.execPath, ['--require', env.DISCIPLES2_PRELOAD, '-'], { cwd: recipe.cwd, env, input: code, timeout: 30000, maxBuffer: 1 << 30 });
  const exit = c.returncode(pre.status, pre.signal);
  save(out, 'inheritance-wait.json', { exit, actualWait: true, stdoutEOF: true, stderrEOF: true, stdout: String(pre.stdout), stderr: String(pre.stderr), at: c.now() });
  assert(exit === 0, 'sealed child inheritance failed before native execution');
}

async function run(out, recipe) {
  const stop = c.recordSignals([]);
  let lock = null;
  if (recipe.heavy) {
    lock = await c.flockExclusive('/tmp/wine-heavy-runtime.lock');
    save(out, 'heavy-lock.json', { pid: process.pid, at: c.now() });
  }
  // Mandatory for every supervised native route, including original recipes
  // that omit completionSession. Admission precedes preflight and watchdog.
  let fds = [], env, reserve;
  try {
    [env, fds] = frozenInputs(out, recipe);
    inheritanceProbe(out, recipe, env);
    reserve = recipe.reserveSeconds ?? 180;
    assert([180, 300].includes(reserve) && recipe.seconds > reserve);
    const original = recipe.args.includes('--app=disciples2_demo');
    if (original || recipe.completionSession) {
      assert(recipe.completionSession === true, 'original completionSession required');
      assert(recipe.seconds === 3600 && recipe.watchdogGrace === 20 && reserve === 300);
      assert(isDeepStrictEqual(recipe.inputPolicy, { confirmationMs: 500, physicalUpMs: 1750, observationMs: 3000, gameFreshnessSeconds: 5, menuFreshnessSeconds: 30 }));
      assert(recipe.args.includes('--max-seconds=3600'));
      assert(recipe.args.includes('--app=disciples2_demo') && recipe.args.includes('--threads') && recipe.args.includes('--real-ticks'));
    }
    if (recipe.preflight) {
      const pre = cp.spawnSync(recipe.preflight[0], recipe.preflight.slice(1), { cwd: recipe.cwd, env, maxBuffer: 1 << 30 });
      const exit = c.returncode(pre.status, pre.signal);
      save(out, 'preflight-wait.json', { exit, actualWait: true, stdoutEOF: true, stderrEOF: true, stdout: String(pre.stdout), stderr: String(pre.stderr), at: c.now() });
      assert(exit === 0, 'original media preflight failed');
    }
  } catch (error) {
    for (const fd of fds) fs.closeSync(fd);
    save(out, 'prelaunch-refusal.json', { error: String(error.message ?? error), originalLaunched: false, anyNativeOrWatchdogChild: false, at: c.now() });
    throw error;
  }
  const deadline = c.now() + recipe.seconds;
  const watchdogDeadline = deadline + (recipe.watchdogGrace || 0);
  const w = cp.spawn(process.execPath, [SELF, 'watchdog', out, String(watchdogDeadline)], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const wWait = c.communicate(w);
  let wExited = false; w.once('exit', () => { wExited = true; });
  while (!c.exists(path.join(out, 'watchdog-armed.json'))) { assert(!wExited, 'watchdog died before arm'); await c.sleep(10); }
  assert(!stop.length, 'supervisor cancelled before native launch');
  save(out, 'launch.json', { args: recipe.args, deadline, gameplayCutoff: deadline - reserve, reserveSeconds: reserve, completionSession: !!recipe.completionSession,
    immutableManifest: recipe.immutableManifest, at: c.now(), supervisor: process.pid, clock: recipe.clock ?? null, nativeScene: !!recipe.nativeScene,
    bindingContract: recipe.bindingContract ?? 'native-scene-v1', inputPolicy: recipe.inputPolicy ?? null });
  const p = cp.spawn(recipe.args[0], recipe.args.slice(1), { cwd: recipe.cwd, env, stdio: c.stdioWithFds(fds), detached: true });
  let exitInfo = null; p.once('exit', (code, signal) => { exitInfo = { code, signal }; });
  await new Promise((resolve, reject) => { p.once('spawn', resolve); p.once('error', reject); });
  // Keep supervisor descriptors live for Workers and forked Node processes.
  const info = { pid: p.pid, startToken: c.token(p.pid), at: c.now() }; save(out, 'native-pid.json', info);
  const eof = {}, errors = [];
  const drains = [drain(p.stdout, path.join(out, 'native.stdout.log'), 'stdout', eof, errors),
    drain(p.stderr, path.join(out, 'native.stderr.log'), 'stderr', eof, errors)];
  let sent = false;
  while (!exitInfo) {
    if ((stop.length || c.exists(path.join(out, 'cancel-request.json'))) && !sent) {
      c.killOwned(info, 'SIGTERM'); sent = true;
      save(out, 'cancellation.json', { at: c.now(), signals: stop, requestFile: c.exists(path.join(out, 'cancel-request.json')), nativeQuit: false });
    }
    await c.sleep(20);
  }
  await Promise.all(drains);
  const rc = c.returncode(exitInfo.code, exitInfo.signal);
  save(out, 'native-wait.json', { pid: p.pid, startToken: info.startToken, exit: rc, actualWait: true, stdoutEOF: eof.stdout || false, stderrEOF: eof.stderr || false, drainErrors: errors, at: c.now() });
  const wr = await wWait;
  save(out, 'watchdog-wait.json', { pid: w.pid, exit: wr.returncode, actualWait: true, stdoutEOF: true, stderrEOF: true, stdout: wr.stdout.toString(), stderr: wr.stderr.toString(), at: c.now() });
  for (const fd of fds) fs.closeSync(fd);
  if (lock) await lock.release();
  save(out, 'supervisor-complete.json', { pid: process.pid, nativeWait: rc, watchdogWait: wr.returncode, heavyReleased: !!lock, actualChildWaits: true, bothEOF: eof.stdout === true && eof.stderr === true, at: c.now() });
}

async function spawnWait(out, mode) {
  const p = cp.spawn(process.execPath, [SELF, mode, out], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const waited = c.communicate(p);
  await new Promise((resolve, reject) => { p.once('spawn', resolve); p.once('error', reject); });
  return [p, waited];
}
function detached(out, mode, logs) {
  const a = fs.openSync(path.join(out, logs[0]), 'wx'), b = fs.openSync(path.join(out, logs[1]), 'wx');
  const p = cp.spawn(process.execPath, [SELF, mode, out], { stdio: ['ignore', a, b], detached: true });
  fs.closeSync(a); fs.closeSync(b);
  return new Promise((resolve, reject) => { p.once('spawn', () => { p.unref(); resolve(p); }); p.once('error', reject); });
}

async function main() {
  const mode = process.argv[2], out = path.resolve(process.argv[3]);
  if (mode === 'hold-module') await prepareHolder(out, c.readJSON(path.join(out, 'prepare.json')));
  else if (mode === 'watchdog') await watchdog(out, Number(process.argv[4]));
  else if (mode === 'holderwait') {
    const seconds = c.readJSON(path.join(out, 'prepare.json')).holderMaxSeconds ?? 5400;
    save(out, 'holder-watchdog-armed.json', { pid: process.pid, at: c.now(), deadline: c.now() + seconds, beforeHolder: true });
    const [p, waited] = await spawnWait(out, 'hold-module');
    let timedout = false, r;
    try { r = await Promise.race([waited, c.sleep(seconds * 1000).then(() => { throw Object.assign(Error('TimeoutExpired'), { code: 'TIMEOUT' }); })]); }
    catch (e) {
      if (e.code !== 'TIMEOUT') throw e;
      timedout = true; p.kill('SIGTERM');
      r = await Promise.race([waited, c.sleep(10000).then(() => { throw Error('TimeoutExpired'); })]);
    }
    fs.writeFileSync(path.join(out, 'holder.stdout.log'), r.stdout); fs.writeFileSync(path.join(out, 'holder.stderr.log'), r.stderr);
    save(out, 'holder-wait.json', { pid: p.pid, exit: r.returncode, actualWait: true, stdoutEOF: true, stderrEOF: true, timedOut: timedout, at: c.now() });
  } else if (mode === 'detach-holder') {
    const p = await detached(out, 'holderwait', ['holder-owner.stdout.log', 'holder-owner.stderr.log']);
    save(out, 'holder-wait-owner.json', { pid: p.pid, startToken: c.token(p.pid), at: c.now(), stdio: 'devnull/files' });
    console.log(JSON.stringify({ detachedHolderWaitOwner: p.pid }));
  } else if (mode === 'run') await run(out, c.readJSON(path.join(out, 'recipe.json')));
  else if (mode === 'outerwait') {
    const [p, waited] = await spawnWait(out, 'run');
    save(out, 'detached-parent.json', { pid: p.pid, startToken: c.token(p.pid), outerPid: process.pid, at: c.now() });
    const r = await waited;
    fs.writeFileSync(path.join(out, 'supervisor.stdout.log'), r.stdout); fs.writeFileSync(path.join(out, 'supervisor.stderr.log'), r.stderr);
    save(out, 'outer-child-wait.json', { pid: p.pid, exit: r.returncode, actualWait: true, stdoutEOF: true, stderrEOF: true, at: c.now() });
  } else if (mode === 'durablewait') {
    // This actual wait owner has no invoking-tool pipes. TERM/HUP are
    // recorded while it finishes reaping the detached outerwait child.
    const received = c.recordSignals([]);
    const [p, waited] = await spawnWait(out, 'outerwait');
    save(out, 'outer-pid.json', { pid: p.pid, startToken: c.token(p.pid), waitOwner: process.pid, at: c.now() });
    const r = await waited;
    fs.writeFileSync(path.join(out, 'outer.stdout.log'), r.stdout); fs.writeFileSync(path.join(out, 'outer.stderr.log'), r.stderr);
    save(out, 'outer-wait.json', { pid: p.pid, exit: r.returncode, actualWait: true, stdoutEOF: true, stderrEOF: true, receivedSignals: received, at: c.now() });
  } else if (mode === 'detach') {
    const p = await detached(out, 'run', ['supervisor.stdout.log', 'supervisor.stderr.log']);
    save(out, 'detached-parent.json', { pid: p.pid, startToken: c.token(p.pid), launcherPid: process.pid, at: c.now(), stdio: 'devnull/files; no outer tool pipe' });
    console.log(JSON.stringify({ detachedSupervisor: p.pid }));
    if (process.argv.length > 4) await c.sleep(30000); // control-only: invoking launcher killed by test
  } else throw Error('unknown mode ' + mode);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { OWNED, PRELOAD, digest, indexedSources, validateSources, selected, prepareHolder, holderBytes, frozenInputs, inheritanceProbe, run, save, token: c.token, seal };
