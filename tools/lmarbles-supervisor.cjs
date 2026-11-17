'use strict';
// Detached owner of native+watchdog waits. No pipe to the invoking tool.
// Node port of the former lmarbles-supervisor.py; same CLI and records:
//   node tools/lmarbles-supervisor.cjs hold-module|watchdog|run|outerwait|durablewait|detach OUT [...]
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict');
const c = require('./native-supervisor-common.cjs');
const { watchdog, drain } = require('./forsaken-supervisor.cjs');
const BASE = __dirname, SELF = __filename;
const LINUX = process.platform === 'linux';
const save = (out, name, value) => c.save(out, name, value);
// The child inherits the descriptor at the same number (pass_fds); on macOS
// fdPath names the sealed body's private read-only file instead.
const selfFd = fd => LINUX ? '/proc/self/fd/' + fd : c.fdPath(fd);

function seal(label, body) { return c.seal(label, body); }

function indexedSource(rows) {
  // Verify once before sealing; each Node Worker also verifies every file it
  // reads. Keep the complete inventory, but do not decode unused bodies in
  // every desktop/guest Worker before its synchronous startup handshake.
  const index = [], bodies = [], seen = new Set(); let offset = 0;
  for (const row of rows) {
    const name = row.path;
    assert(/^[A-Za-z0-9+/]*={0,2}$/.test(row.body) && row.body.length % 4 === 0, 'invalid base64 ' + name);
    const body = Buffer.from(row.body, 'base64');
    assert(!seen.has(name) && !path.posix.isAbsolute(name) && !name.split('/').includes('..'));
    assert.equal(c.sha256(body), row.sha256, name);
    seen.add(name); index.push({ path: name, sha256: row.sha256, offset, size: body.length });
    bodies.push(body); offset += body.length;
  }
  const header = Buffer.from(JSON.stringify({ version: 1, files: index }));
  const size = Buffer.alloc(4); size.writeUInt32LE(header.length);
  return [Buffer.concat([size, header, ...bodies]), c.sha256(header)];
}

function sourceEnv(source, module, holder, indexSha) {
  const env = { ...process.env }; assert(!env.NODE_OPTIONS);
  Object.assign(env, { NODE_OPTIONS: '--require=' + path.join(BASE, 'lmarbles-native-source-view.cjs'),
    LMARBLES_SOURCE_FD: selfFd(source), LMARBLES_MODULE_FD: selfFd(module),
    LMARBLES_MODULE_SHA256: holder.sha256, LMARBLES_SOURCE_INDEX_SHA256: indexSha });
  return env;
}

function frozenInputs(out, recipe) {
  const root = path.resolve(recipe.cwd);
  const holderFile = recipe.moduleHolder || process.env.LMARBLES_MODULE_HOLDER;
  let holder = c.readJSON(holderFile);
  assert(c.token(holder.pid) === holder.startToken && holder.sealed === 15);
  if (holder.sourceFdPath) {
    assert.equal(holder.sourceSeals, 15);
    const sourceBody = fs.readFileSync(holder.sourceFdPath), moduleBody = fs.readFileSync(holder.fdPath);
    assert.equal(c.sha256(sourceBody), holder.sourceSHA256);
    assert.equal(c.sha256(moduleBody), holder.sha256);
    const rows = JSON.parse(sourceBody).files;
    const [packed, indexSha] = indexedSource(rows);
    const source = seal('lmarbles-own-git-source', packed), module = seal('lmarbles-own-git-module', moduleBody);
    save(out, 'runtime-inputs.json', { gitSHA: holder.gitSHA, moduleSHA256: holder.sha256, moduleSeals: 15, sourceSeals: 15,
      sources: rows.map(({ body, ...row }) => row), sourceArchive: 'Pinned Git plus owned patch; only transient memfds', ownDescriptors: true,
      sourceFormat: 'indexed-v1', sourceIndexSHA256: indexSha, sourceSHA256: c.sha256(packed) });
    fs.writeFileSync(path.join(out, 'runtime-source.patch'), fs.readFileSync(holder.ownedPatch));
    return [sourceEnv(source, module, holder, indexSha), [source, module]];
  }
  const names = cp.execFileSync('git', ['ls-files'], { cwd: root, maxBuffer: 1 << 30 }).toString().split('\n').filter(Boolean);
  const selected = names.filter(p => (p.startsWith('lib/') && /\.(js|json)$/.test(p)) ||
    ['host.js', 'test/run.js', 'src/api_table.json', 'src/win16-ordinals.generated.json', 'fonts/substitutions.json'].includes(p));
  selected.push('tools/lmarbles-native-source-view.cjs', 'test/test-lmarbles-native-first-selection.cjs');
  for (const arg of recipe.args) {
    if (!['.js', '.cjs'].includes(path.extname(arg))) continue;
    const full = path.isAbsolute(arg) ? arg : path.join(root, arg);
    const rel = path.relative(root, full);
    if (fs.statSync(full, { throwIfNoEntry: false })?.isFile() && !rel.startsWith('..') && !path.isAbsolute(rel)) selected.push(rel);
  }
  selected.push('test/candidate-corpus/manifest.json', 'test/binaries/candidates/lmarbles-108/.wine-assembly-browser.json');
  // Literal dependencies of the actual runtime closure, including CLI helpers.
  for (let i = 0; i < selected.length; i++) {
    const p = selected[i], body = fs.readFileSync(path.join(root, p), 'latin1');
    for (const m of body.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
      const candidate = path.join(path.dirname(p), m[1]);
      for (const suffix of ['', '.js', '.cjs', '.json', '/index.js']) {
        const found = path.normalize(candidate + suffix);
        if (fs.statSync(path.join(root, found), { throwIfNoEntry: false })?.isFile() && !selected.includes(found)) { selected.push(found); break; }
      }
    }
  }
  const codec = path.join(root, 'node_modules/pngjs');
  for (const rel of fs.readdirSync(codec, { recursive: true })) {
    const full = path.join(codec, rel);
    if (fs.statSync(full).isFile() && ['.js', '.json'].includes(path.extname(full))) selected.push(path.relative(root, full));
  }
  const unique = [...new Set(selected)].sort();
  const rows = unique.map(p => { const body = fs.readFileSync(path.join(root, p)); return { path: p, sha256: c.sha256(body), body: body.toString('base64') }; });
  holder = c.readJSON(holderFile);
  assert(c.token(holder.pid) === holder.startToken && holder.sealed === 15);
  const body = fs.readFileSync(holder.fdPath);
  assert.equal(c.sha256(body), holder.sha256);
  const module = seal('lmarbles-module', body);
  const [packed, indexSha] = indexedSource(rows);
  const source = seal('lmarbles-sources', packed);
  const head = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
  const tracked = new Set(names), patches = [];
  for (const p of unique) {
    if (p.startsWith('node_modules/')) continue;
    const isTracked = tracked.has(p);
    const diff = cp.spawnSync('git', isTracked ? ['diff', '--binary', head, '--', p] : ['diff', '--no-index', '--binary', '--', '/dev/null', p], { cwd: root, maxBuffer: 1 << 30 });
    assert((isTracked ? [0] : [1]).includes(diff.status) && !diff.stderr.length);
    patches.push(diff.stdout);
  }
  fs.writeFileSync(path.join(out, 'runtime-source.patch'), Buffer.concat(patches));
  save(out, 'runtime-inputs.json', { gitSHA: head, moduleSHA256: holder.sha256, moduleSeals: 15, sourceSeals: 15,
    sources: rows.map(({ body, ...row }) => row), sourceArchive: 'Git plus binary patch; no persisted source/module bundle',
    sourceFormat: 'indexed-v1', sourceIndexSHA256: indexSha, sourceSHA256: c.sha256(packed) });
  return [sourceEnv(source, module, holder, indexSha), [source, module]];
}

async function run(out, recipe) {
  const stop = c.recordSignals([]);
  let lock = null;
  if (recipe.heavy) {
    lock = await c.flockExclusive('/tmp/wine-heavy-runtime.lock');
    save(out, 'heavy-lock.json', { pid: process.pid, at: c.now() });
  }
  if (recipe.preflight) {
    const pre = cp.spawnSync(recipe.preflight[0], recipe.preflight.slice(1), { cwd: recipe.cwd, maxBuffer: 1 << 30 });
    const exit = c.returncode(pre.status, pre.signal);
    save(out, 'preflight-wait.json', { exit, actualWait: true, stdoutEOF: true, stderrEOF: true, stdout: String(pre.stdout), stderr: String(pre.stderr), at: c.now() });
    if (exit) { save(out, 'preflight-blocker.json', { exit, originalLaunched: false, at: c.now() }); return; }
  }
  // Seal inputs before arming any child. A source refusal must not strand an
  // independent watchdog with neither a native PID nor an actual wait.
  const frozen = recipe.moduleHolder || (process.env.LMARBLES_MODULE_HOLDER && recipe.args[0] === 'node');
  const [env, fds] = frozen ? frozenInputs(out, recipe) : [undefined, []];
  const reserve = recipe.reserveSeconds ?? 180;
  assert([180, 300].includes(reserve));
  if (recipe.completionSession) {
    assert(recipe.seconds === 3600 && recipe.watchdogGrace === 20 && reserve === 300);
    assert.deepStrictEqual(recipe.inputPolicy, { confirmationMs: 500, physicalUpMs: 1750, observationMs: 3000, gameFreshnessSeconds: 5, menuFreshnessSeconds: 30 });
    assert(recipe.args.includes('--max-seconds=3600'));
  }
  const deadline = c.now() + recipe.seconds;
  const watchdogDeadline = deadline + (recipe.watchdogGrace || 0);
  const w = cp.spawn(process.execPath, [SELF, 'watchdog', out, String(watchdogDeadline)], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const wWait = c.communicate(w);
  let wExited = false; w.once('exit', () => { wExited = true; });
  while (!c.exists(path.join(out, 'watchdog-armed.json'))) { assert(!wExited, 'watchdog died before arm'); await c.sleep(10); }
  assert(!stop.length, 'supervisor cancelled before native launch');
  save(out, 'launch.json', { args: recipe.args, deadline, gameplayCutoff: deadline - reserve, reserveSeconds: reserve, at: c.now(), supervisor: process.pid,
    clock: recipe.clock ?? null, nativeScene: !!recipe.nativeScene, inputPolicy: recipe.inputPolicy ?? null });
  const p = cp.spawn(recipe.args[0], recipe.args.slice(1), { cwd: recipe.cwd, env: env || process.env, stdio: c.stdioWithFds(fds), detached: true });
  let exitInfo = null; p.once('exit', (code, signal) => { exitInfo = { code, signal }; });
  await new Promise((resolve, reject) => { p.once('spawn', resolve); p.once('error', reject); });
  for (const fd of fds) fs.closeSync(fd);
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
  if (lock) await lock.release();
  save(out, 'supervisor-complete.json', { pid: process.pid, nativeWait: rc, watchdogWait: wr.returncode, heavyReleased: !!lock, actualChildWaits: true, bothEOF: eof.stdout === true && eof.stderr === true, at: c.now() });
}

async function waitChild(out, mode, startRecord, logs, waitName, extra = {}) {
  const p = cp.spawn(process.execPath, [SELF, mode, out], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const waited = c.communicate(p);
  await new Promise((resolve, reject) => { p.once('spawn', resolve); p.once('error', reject); });
  save(out, startRecord[0], { pid: p.pid, startToken: c.token(p.pid), ...startRecord[1], at: c.now() });
  const r = await waited;
  fs.writeFileSync(path.join(out, logs[0]), r.stdout); fs.writeFileSync(path.join(out, logs[1]), r.stderr);
  save(out, waitName, { pid: p.pid, exit: r.returncode, actualWait: true, stdoutEOF: true, stderrEOF: true, ...extra, at: c.now() });
  return r;
}

async function main() {
  const mode = process.argv[2], out = path.resolve(process.argv[3]);
  if (mode === 'hold-module') {
    const body = fs.readFileSync(path.join(BASE, '..', 'build/wine-assembly.wasm'));
    const held = c.holdBody('lmarbles-qualified-module', body);
    save(out, 'holder.json', { pid: process.pid, startToken: c.token(process.pid), sealed: 15, sha256: c.sha256(body), fdPath: held.path, at: c.now() });
    while (!c.exists(path.join(out, 'stop.json'))) await c.sleep(50);
    held.close(); save(out, 'holder-closed.json', { closed: true, at: c.now() });
  } else if (mode === 'watchdog') await watchdog(out, Number(process.argv[4]));
  else if (mode === 'run') await run(out, c.readJSON(path.join(out, 'recipe.json')));
  else if (mode === 'outerwait') await waitChild(out, 'run', ['detached-parent.json', { outerPid: process.pid }], ['supervisor.stdout.log', 'supervisor.stderr.log'], 'outer-child-wait.json');
  else if (mode === 'durablewait') {
    // This actual wait owner has no invoking-tool pipes. TERM/HUP are
    // recorded while it finishes reaping the detached outerwait child.
    const received = c.recordSignals([]);
    await waitChild(out, 'outerwait', ['outer-pid.json', { waitOwner: process.pid }], ['outer.stdout.log', 'outer.stderr.log'], 'outer-wait.json', { receivedSignals: received });
  } else if (mode === 'detach') {
    const a = fs.openSync(path.join(out, 'supervisor.stdout.log'), 'wx'), b = fs.openSync(path.join(out, 'supervisor.stderr.log'), 'wx');
    const p = cp.spawn(process.execPath, [SELF, 'run', out], { stdio: ['ignore', a, b], detached: true });
    fs.closeSync(a); fs.closeSync(b);
    await new Promise((resolve, reject) => { p.once('spawn', resolve); p.once('error', reject); });
    p.unref();
    save(out, 'detached-parent.json', { pid: p.pid, startToken: c.token(p.pid), launcherPid: process.pid, at: c.now(), stdio: 'devnull/files; no outer tool pipe' });
    console.log(JSON.stringify({ detachedSupervisor: p.pid }));
    if (process.argv.length > 4) await c.sleep(30000); // control-only: invoking launcher killed by test
  } else throw Error('unknown mode ' + mode);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { seal, indexedSource, frozenInputs, run, token: c.token, save };
