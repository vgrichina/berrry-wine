'use strict';
// Sealed Git source and native module view for renderer startup qualification.
// Node port of the former tools/gta2-renderer-startup-runtime.py (same CLI:
//   node tools/gta2-renderer-startup-launcher.cjs OUT HEAD KIND [ARGS...]).
//
// Git and the recorded binary patches remain the source archive. No source tree
// or module is copied to a run directory. Foreign shared-tree WIP is not adopted.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const c = require('./native-supervisor-common.cjs');

const root = path.resolve(__dirname, '..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const git = (...args) => cp.execFileSync('git', args, { cwd: root, maxBuffer: 1 << 30 });
const LINUX = process.platform === 'linux';

async function main() {
  const out = path.resolve(process.argv[2]);
  const [head, kind, ...args] = process.argv.slice(3);
  assert(/^[a-f0-9]{40}$/.test(head) && ['runtime', 'build', 'checks', 'shared', 'hold'].includes(kind));
  assert(fs.statSync(out).isDirectory() && (args.length || kind === 'hold'));
  assert(fs.statSync(path.join(out, 'watchdog-armed.json'), { throwIfNoEntry: false })?.isFile(), 'independent supervisor watchdog required');
  const writeJSON = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value) + '\n');
  const childFds = [];

  function moduleBody() {
    const holderPath = process.env.GTA2_MODULE_HOLDER;
    let source = path.join(root, 'build/wine-assembly.wasm'), holder = null;
    if (holderPath) {
      holder = c.readJSON(holderPath);
      assert.equal(c.token(holder.pid), holder.startToken);
      assert.equal(holder.sealed, 15);
      // Publishing this lane's tooling does not rebuild guest code. Prove
      // that the retained module's actual Git build inputs remain equal.
      const changed = git('diff', '--name-only', holder.head, head).toString().split('\n').filter(Boolean);
      const laneTools = new Set(['tools/gta2-browser-release-binding.cjs', 'tools/gta2-paired-controller.cjs',
        'tools/gta2-renderer-startup-runtime.py', 'tools/gta2-renderer-startup-runtime.cjs',
        'tools/gta2-renderer-startup-launcher.cjs', 'tools/native-supervisor-common.cjs']);
      assert(!changed.some(p => /^(src|lib|tools)\//.test(p) && !laneTools.has(p)), 'module build inputs changed since holder');
      assert(!fs.existsSync(holder.stopFile), 'module holder already stopping');
      source = holder.fdPath;
    }
    const fd = fs.openSync(source, 'r');
    let before, body, after;
    try { before = fs.fstatSync(fd, { bigint: true }); body = fs.readFileSync(fd); after = fs.fstatSync(fd, { bigint: true }); }
    finally { fs.closeSync(fd); }
    assert(before.ino === after.ino && before.size === after.size && before.mtimeNs === after.mtimeNs);
    assert(body.subarray(0, 4).equals(Buffer.from('\0asm', 'latin1')) && BigInt(body.length) === before.size);
    const digest = sha(body);
    if (holderPath) assert.equal(digest, holder.sha256);
    return { body, digest, holderPath, holder };
  }
  function sealModule() {
    const m = moduleBody();
    const handle = c.seal('gta2-native-module', m.body);
    writeJSON('frozen-module.json', { head, sha256: m.digest, size: m.body.length, storage: 'sealed transient memfd; no dump',
      fromHolder: m.holderPath || null, moduleSourceHead: m.holderPath ? m.holder.head : head, sealed: 15 });
    return { handle, digest: m.digest };
  }

  if (kind === 'hold') {
    const m = moduleBody();
    const held = c.holdBody('gta2-native-module', m.body);
    writeJSON('frozen-module.json', { head, sha256: m.digest, size: m.body.length, storage: 'sealed transient memfd; no dump',
      fromHolder: m.holderPath || null, moduleSourceHead: m.holderPath ? m.holder.head : head, sealed: 15 });
    writeJSON('holder.json', { head, sha256: m.digest, pid: process.pid, sealed: 15, startToken: c.token(process.pid),
      fdPath: held.path, stopFile: path.join(out, 'stop.json') });
    while (!fs.existsSync(path.join(out, 'stop.json'))) await c.sleep(50);
    held.close();
    writeJSON('holder-closed.json', { at: c.now(), closed: true });
    return 0;
  }

  const owned = ['test/gta2-paired-controller.test.cjs', 'test/test-gta2-renderer-startup-publication.cjs',
    'test/test-gta2-worker-complete-confirmation.cjs',
    'tools/gta2-renderer-startup-launcher.cjs', 'tools/gta2-renderer-startup-runtime.cjs', 'tools/native-supervisor-common.cjs',
    'docs/re-notes/gta2-renderer-startup-publication-repair-20261116.md',
    'tools/gta2-browser-release-binding.cjs', 'tools/gta2-paired-controller.cjs',
    'tools/gta2-verified-source-view.cjs',
    'tools/gta2-user-readiness-source-view.py', 'test/test-gta2-native-user-readiness.cjs',
    'test/test-gta2-fresh-attestation-prearm.cjs',
    'docs/re-notes/gta2-native-user-readiness-repair-20261116.md',
    'build/wine-assembly.wasm', 'build/wine-assembly.compat.wasm', 'build/combined.wat'];
  // One deduplicated Git patch per source state, never a source-tree snapshot.
  const patches = [], sourcePins = {};
  for (const name of owned) {
    if (name.startsWith('build/') || !fs.statSync(path.join(root, name), { throwIfNoEntry: false })?.isFile()) continue;
    sourcePins[name] = sha(fs.readFileSync(path.join(root, name)));
    const tracked = cp.spawnSync('git', ['ls-files', '--error-unmatch', '--', name], { cwd: root, stdio: 'ignore' }).status === 0;
    const diff = cp.spawnSync('git', tracked ? ['diff', '--binary', head, '--', name] : ['diff', '--no-index', '--binary', '--', '/dev/null', name],
      { cwd: root, maxBuffer: 1 << 30 });
    assert((tracked ? [0] : [1]).includes(diff.status) && !diff.stderr.length);
    patches.push(diff.stdout);
  }
  const patch = Buffer.concat(patches), patchSha = sha(patch);
  const patchPath = path.join(path.dirname(out), 'source-state-' + patchSha + '.patch');
  if (fs.existsSync(patchPath)) assert(fs.readFileSync(patchPath).equals(patch));
  else fs.writeFileSync(patchPath, patch);
  writeJSON('source-state.json', { head, patchPath: path.relative(out, patchPath), patchSHA256: patchSha,
    sourcePins, foreignWIPAdopted: false, sourceArchive: 'Git plus owned binary patch' });

  async function runChild(env, record) {
    const p = cp.spawn(args[0], args.slice(1), { cwd: root, env, stdio: c.stdioWithFds(childFds) });
    const waited = c.communicate(p);
    await new Promise((resolve, reject) => { p.once('spawn', resolve); p.once('error', reject); });
    writeJSON('source-view-start.json', { ...record(p.pid) });
    const r = await waited;
    fs.writeFileSync(path.join(out, 'source-view-child.stdout.log'), r.stdout);
    fs.writeFileSync(path.join(out, 'source-view-child.stderr.log'), r.stderr);
    writeJSON('source-view-child-wait.json', { pid: p.pid, exit: r.returncode, actualWait: true, stdoutEOF: true, stderrEOF: true, at: c.now() });
    return r.returncode;
  }

  if (kind === 'shared') {
    assert(!process.env.NODE_OPTIONS && !process.env.GTA2_VIEW_HEAD, 'shared checks must use live checkout');
    const changed = git('diff', '--name-only').toString().split('\n').filter(Boolean);
    const relevant = changed.filter(p => (/^(src|lib|tools|test)\//.test(p) || p === 'host.js'))
      .filter(p => !p.startsWith('test/binaries/') && /\.(?:js|cjs|json|py|wat|watx)$/.test(p));
    const foreign = relevant.length ? git('diff', '--binary', head, '--', ...relevant) : Buffer.alloc(0);
    const foreignSha = sha(foreign), foreignPath = path.join(path.dirname(out), 'shared-source-' + foreignSha + '.patch');
    if (fs.existsSync(foreignPath)) assert(fs.readFileSync(foreignPath).equals(foreign));
    else fs.writeFileSync(foreignPath, foreign);
    const started = c.now();
    return runChild(process.env, childPID => ({ head, kind, args, pid: process.pid, childPID, started,
      sourceStorage: 'live shared checkout; foreign WIP unadopted',
      relevantPatchPath: path.relative(out, foreignPath), relevantPatchSHA256: foreignSha,
      relevantCurrentPins: Object.fromEntries(relevant.map(n => [n, sha(fs.readFileSync(path.join(root, n)))])) }));
  }

  const lines = git('ls-tree', '-r', '--format=%(objectname) %(path)', head).toString().split('\n').filter(Boolean);
  const tree = lines.map(line => [line.slice(41), line.slice(0, 40)]);
  const tracked = tree.map(([p]) => p).filter(p => /\.(?:js|cjs|json|html|wat|watx)$/.test(p) && !/^(scratch|test\/binaries)\//.test(p));
  const trackedSet = new Set(tracked);
  const runtimeRe = /^(?:host\.js|index\.html|src\/api_table\.json|fonts\/substitutions\.json|lib\/(?:[^/]+\/)*[^/]+\.(?:js|json)|test\/static-server\.js|test\/gta2-paired-controller\.test\.cjs|test\/test-gta2-(?:current-scene-prearm|fresh-attestation-prearm|browser-release-scene-binding|directx-version-causal-repair|worker-complete-confirmation|final-pin-prearm-scheduling)\.cjs)$/;
  const selected = p => kind !== 'runtime' ? trackedSet.has(p) : runtimeRe.test(p);
  const ownedSet = new Set(owned);
  const files = tree.filter(([p]) => !ownedSet.has(p) && selected(p));
  const batch = cp.spawnSync('git', ['cat-file', '--batch'], { cwd: root, input: files.map(([, oid]) => oid).join('\n') + '\n', maxBuffer: 2 ** 31 });
  assert.equal(batch.status, 0); const raw = batch.stdout;
  let cursor = 0; const items = [], bodies = [];
  for (const [name, oid] of files) {
    const end = raw.indexOf(0x0a, cursor);
    const [got, typ, sizeText] = raw.subarray(cursor, end).toString().split(' ');
    const size = Number(sizeText); cursor = end + 1;
    assert(got === oid && typ === 'blob');
    const body = raw.subarray(cursor, cursor + size); cursor += size;
    assert(body.length === size && raw[cursor] === 0x0a); cursor += 1;
    assert.equal(crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + size + '\0'), body])).digest('hex'), oid);
    items.push({ path: name, oid, size }); bodies.push(body);
  }
  assert.equal(cursor, raw.length);
  let moduleFd, moduleSha;
  if (kind === 'runtime') ({ handle: moduleFd, digest: moduleSha } = sealModule());
  const manifest = Buffer.from(JSON.stringify({ head, owned, trackedSource: tracked, files: items }));
  const header = Buffer.alloc(4); header.writeUInt32BE(manifest.length);
  const pool = Buffer.concat([header, manifest, ...bodies]);
  const fd = c.seal('gta2-renderer-startup-sealed-inputs', pool);
  const seals = 15; // F_SEAL_WRITE|F_SEAL_GROW|F_SEAL_SHRINK|F_SEAL_SEAL
  // Linux readers open /proc/<this pid>/fd/N (no inheritance, as MFD_CLOEXEC);
  // macOS readers need the descriptor at the same number in the child.
  if (!LINUX) childFds.push(fd);
  const env = { ...process.env, GTA2_VIEW_HEAD: head, GTA2_PIN_VIEW_HEAD: head, GTA2_PIN_VIEW_FD: c.fdPath(fd), GTA2_PIN_VIEW_OUT: out };
  const preload = path.join(root, kind === 'runtime' ? 'tools/gta2-renderer-startup-runtime.cjs' : 'tools/gta2-verified-source-view.cjs');
  const preloadSha = sha(fs.readFileSync(preload));
  const bootstrap = `import {createRequire} from 'node:module';
const require=createRequire(${JSON.stringify(preload)}),Module=require('node:module'),path=require('node:path');
const filename=${JSON.stringify(preload)},bytes=require('node:fs').readFileSync(filename);
const hash=require('node:crypto').createHash('sha256').update(bytes).digest('hex');
if(hash!==${JSON.stringify(preloadSha)})throw Error('exact executed source-view preload changed');
Object.defineProperty(globalThis,'__gta2VerifiedViewExecutedSHA256',{value:require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync(path.join(path.dirname(filename),'gta2-verified-source-view.cjs'))).digest('hex')});
const exact=new Module(filename);exact.filename=filename;exact.paths=Module._nodeModulePaths(path.dirname(filename));
exact._compile(bytes.toString('utf8'),filename);exact.loaded=true;require.cache[filename]=exact;
`;
  if (kind === 'runtime') {
    env.GTA2_FROZEN_MODULE_SHA256 = moduleSha;
    env.GTA2_FROZEN_MODULE_FD = c.fdPath(moduleFd);
    if (!LINUX) childFds.push(moduleFd);
  }
  env.NODE_OPTIONS = '--import=data:text/javascript;base64,' + Buffer.from(bootstrap).toString('base64');
  const started = c.now();
  const code = await runChild(env, childPID => ({ head, kind, args, started, pid: process.pid, childPID,
    gitBlobCount: files.length, poolSHA256: sha(pool),
    manifestSHA256: sha(pool.subarray(0, 4 + manifest.length)), bytes: pool.length, seals,
    executedPreloadExpectedSHA256: preloadSha, bootstrapSHA256: sha(Buffer.from(bootstrap)),
    sourceStorage: 'sealed transient memfd only', ownedBytesRetained: false, perImportGit: false }));
  fs.closeSync(fd);
  if (kind === 'runtime') fs.closeSync(moduleFd);
  return code;
}
main().then(code => { process.exitCode = code & 255; }, e => { console.error(e); process.exitCode = 1; });
