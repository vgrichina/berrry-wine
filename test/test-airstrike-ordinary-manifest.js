'use strict';

// No guest, Wasm or browser process: execute the byte-exact ordinary loader
// blocks, including host.loadFiles, against genuine retained private media.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { createRequire } = require('module');
const { APPS } = require('../lib/apps');
const { prepare } = require('../tools/verify-airstrike-pre6a');
const appFiles = require('../lib/app-files');
const root = path.resolve(__dirname, '..');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const inputs = process.argv.slice(2);
assert.equal(inputs.length, 3, 'ORIGINAL ZLIB CRT required; no synthetic/skip acceptance');
const parent = path.resolve(root, '../ordinary-manifest-test-temp');
assert(!fs.existsSync(parent));
fs.mkdirSync(parent);
const fixture = path.join(parent, 'fixture');
const cliSource = fs.readFileSync(path.join(root, 'test/run.js'), 'utf8');
const browserSource = fs.readFileSync(path.join(root, 'lib/browser-shell.js'), 'utf8');
const hostSource = fs.readFileSync(path.join(root, 'host.js'), 'utf8');
function slice(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, start);
  return source.slice(a, b);
}
const cliResolver = slice(cliSource, 'const getAssetFiles = entry => {', '\nconst WASM_PATH =');
const cliSelector = slice(cliSource, 'const canonicalPath = p => {', 'const getAssetFiles = entry => {');
const cliPreflight = slice(cliSource, '  // Fail closed before compilation', '  let wasmBytes;');
assert(cliSource.indexOf(cliPreflight) < cliSource.indexOf('  const exeBytes = verifiedAssetFiles ?'));
const browserResolver = slice(browserSource, '      let dynamicExeBytes = null;', '      await wine.init(canvas);');
assert(browserSource.indexOf(browserResolver) < browserSource.indexOf('      await wine.init(canvas);'));
const browserMount = slice(browserSource, '          const verifiedObjectUrls = [];', '          throwIfCancelled(ctx);');
const browserDll = slice(browserSource, '        const exeUrlDir = String(app.exe', '        // How many DLLs the graph');
const hostLoader = slice(hostSource, '  async loadFiles(urls, options = {}) {', '\n  async loadDlls(');
const browserBase = 'https://local.invalid/repo/';
const manifestName = '.wine-assembly-browser.json';
let mapping, good, entry;
const receipts = [];
const approved = new Set();
function checkRead(file, reads) {
  const absolute = path.resolve(file);
  assert(approved.has(absolute), 'unexpected/outside-fixture read: ' + file);
  reads.push(absolute);
}
function cli() {
  const reads = [], mounted = new Map();
  const context = vm.createContext({ path, APP_ENTRY: null, EXE_PATH: entry.exe,
    APPS: { airstrike_pre6a: entry }, APP_ID: 'airstrike_pre6a',
    appAsset: p => path.isAbsolute(p) ? p : path.join(root, p),
    fs: { realpathSync: fs.realpathSync,
      readFileSync(file, ...args) { checkRead(file, reads); return fs.readFileSync(file, ...args); } },
    require: createRequire(path.join(root, 'test/run.js')),
  });
  try {
    vm.runInContext(cliSelector + '\n' + cliResolver + '\n' + cliPreflight +
      '\nthis.files = verifiedAssetFiles; this.readAssetBytes = readAssetBytes;', context);
  } catch (error) {
    assert.equal(mounted.size, 0, 'rejected CLI preflight cannot mount files');
    throw error;
  }
  // Actual early ordinary CLI VFS mount loop. No emulator or DLL graph runs.
  const loop = slice(cliSource, '  if (ctx.vfs && ASSET_ENTRY) {', '  // A LoadLibraryA from inside a DllMain');
  context.ctx = { vfs: { files: mounted, ensureParentDirs() {},
    setLazyFile(name, item) { mounted.set(name.toLowerCase(), item); } } };
  context.fs.statSync = fs.statSync;
  vm.runInContext(loop, context);
  return { files: context.files, reads, mounted, readAssetBytes: context.readAssetBytes };
}
async function browser({ mount = false, generic = false, beforeMount = () => {} } = {}) {
  const reads = [], mounted = new Map(), revoked = [], objectUrls = [];
  const app = generic ? { localFileManifest: entry.localFileManifest, files: [
    { url: 'override', vfsPath: 'c:\\SDL.dll' }], cdAudio: {} } : { ...entry, files: [] };
  const status = {}, log = { textContent: '' };
  const fetchBytes = async url => {
    if (String(url).startsWith('blob:')) return new Uint8Array(await (await fetch(url)).arrayBuffer());
    const pathname = String(url).startsWith('https://local.invalid/') ? new URL(url).pathname : null;
    const file = pathname ? (pathname.startsWith('/repo/')
      ? path.join(root, pathname.slice('/repo/'.length)) : pathname)
      : (path.isAbsolute(url) ? url : path.join(root, url));
    checkRead(file, reads);
    return new Uint8Array(fs.readFileSync(file));
  };
  const WineAssembly = { fetchAssetBytes: fetchBytes, _throwIfAssetAborted() {},
    _transferSeq: 0, bundleName() { return null; }, _prefetchBundled: async () => new Map() };
  const context = vm.createContext({ app, Blob, Uint8Array, console,
  location: { href: browserBase + 'index.html', search: '?no-bundle' },
  document: { getElementById() { return status; } }, sel: 'airstrike_pre6a',
  ctx: {}, throwIfCancelled() {}, WineAssembly,
  window: { appFiles, crypto: crypto.webcrypto },
  fetch: async url => ({ ok: true, json: async () => JSON.parse(new TextDecoder().decode(await fetchBytes(url))) }),
  log, progressStride: 1, failLaunch(error) { throw error; },
  });
  // URL must be a constructor as well as provide the Blob lifecycle methods.
  context.URL = class extends URL {
    static createObjectURL(blob) { const url = URL.createObjectURL(blob); objectUrls.push(url); return url; }
    static revokeObjectURL(url) { URL.revokeObjectURL(url); revoked.push(url); }
  };
  vm.runInContext('this.host = ({' + hostLoader + '});', context);
  const host = context.host;
  host._helpCtx = { vfs: { files: mounted, ensureParentDirs() {} } };
  context.wine = host;
  const originalFiles = app.files;
  try {
    await vm.runInContext('(async () => {' + browserResolver + '\nthis.exeBytes = dynamicExeBytes; })()', context);
  } catch (error) {
    assert.equal(mounted.size, 0, 'rejected browser preflight cannot mount files');
    assert.equal(app.files, originalFiles, 'rejected manifest cannot mutate app destinations');
    assert.equal(app._localFilesResolved, undefined);
    assert.equal(app._localRegistry, undefined);
    throw error;
  }
  if (mount) {
    beforeMount();
    context.files = app.files;
    await vm.runInContext('(async () => {' + browserMount + '})()', context);
    assert.equal(objectUrls.length, generic ? 0 : 88);
    assert.deepEqual(revoked, objectUrls, 'all private byte snapshots revoked after ordinary host loading');
  }
  if (!generic) {
    context.availableDlls = {};
    context.appFileByName = new Map(app.files.map(p => [path.basename(p.url).toLowerCase(), p.url]));
    context.mountedExeDir = null;
    vm.runInContext(browserDll + '\nthis.fetchDll = fetchDll;', context);
    const before = reads.length;
    for (const dll of app.dlls) {
      const loaded = await context.fetchDll(dll);
      assert.equal(hash(loaded.bytes), hash(app._verifiedLocalBytes.get(new URL(dll, browserBase).href)));
      assert.equal(loaded.path.toLowerCase(), 'c:\\' + path.basename(dll).toLowerCase());
    }
    assert.equal(reads.length, before, 'actual ordinary DLL resolver must consume validated snapshots');
  }
  return { files: app.files, exeBytes: context.exeBytes, reads, mounted, app };
}

(async () => {
  try {
    prepare(...inputs.map(p => path.resolve(p)), fixture);
    const manifestPath = path.join(fixture, manifestName);
    good = fs.readFileSync(manifestPath);
    mapping = JSON.parse(good);
    entry = { ...APPS.airstrike_pre6a, localFileManifest: manifestPath,
      dlls: APPS.airstrike_pre6a.dlls.map(p => path.join(fixture, 'game', path.basename(p))),
      exe: path.join(fixture, 'game/airstrike-pre6a.exe') };
    for (const explicitApp of [null, entry]) {
      const selected = vm.runInNewContext(cliSelector + '\nASSET_ENTRY', {
        path, fs, EXE_PATH: entry.exe, APP_ENTRY: explicitApp, APP_ID: 'airstrike_pre6a',
        APPS: { airstrike_pre6a: entry }, appAsset: p => p,
      });
      assert.equal(selected, entry, 'both registered --app and matching --exe select the pinned entry');
    }
    assert.equal(vm.runInNewContext(cliSelector + '\nASSET_ENTRY', {
      path, fs, EXE_PATH: '/unregistered/airstrike-pre6a.exe', APP_ENTRY: null, APP_ID: null,
      APPS: { airstrike_pre6a: entry }, appAsset: p => p,
    }), null, 'external unregistered --exe keeps its existing explicit-input contract');
    const oracle = require('../docs/re-notes/airstrike-retained-codec-gameplay-20261024/complete-runtime-manifest.json')
      .filter(p => p.dest.startsWith('game/'));
    assert.equal(oracle.length, 89);
    assert.equal(oracle.reduce((n, p) => n + p.bytes, 0), 4072418);
    const pins = require('./candidate-corpus/airstrike-pre6a-files.json').files;
    assert.deepEqual(pins.map(p => [p.path, p.bytes, p.sha256]).sort(),
      oracle.map(p => [p.dest.slice(5), p.bytes, p.sha256]).sort(), 'independent accepted 261-file oracle subset');
    approved.add(manifestPath);
    approved.add(path.join(root, entry.localManifestIntegrity.inventory));
    for (const pin of oracle) {
      const file = path.join(fixture, pin.dest), bytes = fs.readFileSync(file);
      assert.equal(hash(bytes), pin.sha256);
      approved.add(file);
    }
    const cliGood = cli(), browserGood = await browser({ mount: true });
    for (const actual of [cliGood, browserGood]) {
      assert.equal(actual.files.length, 88);
      assert.equal(actual.mounted.size, 88);
      for (const row of mapping.files) {
        const mounted = actual.mounted.get(row.vfsPath.toLowerCase());
        assert(mounted, row.vfsPath);
        const data = mounted.load ? mounted.load() : mounted.data;
        assert.equal(hash(data), pins.find(p => 'game/' + p.path === row.url).sha256);
      }
    }
    assert.equal(hash(browserGood.exeBytes), pins.find(p => p.path.endsWith('.exe')).sha256);
    assert.equal(hash(cliGood.readAssetBytes(entry.exe)), hash(browserGood.exeBytes));
    receipts.push('genuine 89-file positive: actual CLI mount loop + browser resolver + actual host.loadFiles');
    const snapshotFile = path.join(fixture, 'game/SDL.dll');
    const snapshotBytes = fs.readFileSync(snapshotFile);
    try {
      const snapshot = await browser({ mount: true, beforeMount() {
        const changed = Buffer.from(snapshotBytes); changed[0] ^= 1;
        fs.writeFileSync(snapshotFile, changed);
      } });
      assert.equal(hash(snapshot.mounted.get('c:\\sdl.dll').data), hash(snapshotBytes),
        'ordinary browser host must consume validated bytes despite later source mutation');
    } finally { fs.writeFileSync(snapshotFile, snapshotBytes); }
    const cases = [
      ['outside-fixture URL', m => { m.files[0] = { ...m.files[0], url: '../outside-fixture.dll', vfsPath: 'c:\\outside.dll' }; }],
      ['arbitrary guest mapping', m => { m.files[0].vfsPath = 'c:\\unvalidated\\replacement.dll'; }],
      ['duplicate', m => { m.files[1] = { ...m.files[0] }; }],
      ['omission', m => { m.files.pop(); }],
      ['extra file', m => { m.files.push({ ...m.files[0] }); }],
      ['size', m => { m.files[0].size++; }],
      ['alias', m => { m.files[0].vfsPaths = ['c:\\other.dll']; }],
      ['INI transform', m => { m.files[0].iniSet = { x: { y: 'z' } }; }],
      ['optional', m => { m.files[0].optional = true; }],
      ['foreign URL', m => { m.files[0].url = 'https://outside.invalid/x'; }],
      ['percent traversal', m => { m.files[0].url = 'game/%2e%2e/x'; }],
      ['registry mutation', m => { m.registry = { x: 'y' }; }],
    ];
    for (const [label, mutate] of cases) {
      const changed = structuredClone(mapping); mutate(changed);
      fs.writeFileSync(manifestPath, JSON.stringify(changed));
      assert.throws(cli, /local media integrity/);
      await assert.rejects(browser(), /local media integrity/);
      receipts.push(label + ': CLI/browser rejected before VFS/init; reviewer acceptance condition false');
    }
    fs.writeFileSync(manifestPath, good);
    // Same-size mutations and omissions across every actual source identity,
    // including EXE, all DLLs, config, image and sound; restored after each case.
    for (const pin of oracle) {
      const file = path.join(fixture, pin.dest), bytes = fs.readFileSync(file);
      const changed = Buffer.from(bytes); changed[0] ^= 1;
      fs.writeFileSync(file, changed);
      assert.throws(cli, /identity mismatch/);
      await assert.rejects(browser(), /identity mismatch/);
      // Already validated consumers keep genuine snapshots after a mutation.
      assert.equal(hash(cliGood.readAssetBytes(file)), pin.sha256);
      if (!pin.dest.endsWith('.exe')) {
        const guest = 'c:\\' + pin.dest.slice(5).replace(/\//g, '\\').toLowerCase();
        assert.equal(hash(cliGood.mounted.get(guest).load()), pin.sha256);
      }
      fs.writeFileSync(file, bytes);
      const held = file + '.held';
      fs.renameSync(file, held);
      try {
        assert.throws(cli, /ENOENT/);
        await assert.rejects(browser(), /ENOENT/);
      } finally { fs.renameSync(held, file); }
    }
    receipts.push('all 89 mutated identities + all 89 missing inputs: both ordinary routes rejected');
    const trustedPolicy = entry.localManifestIntegrity;
    entry.localManifestIntegrity = { ...trustedPolicy, sha256: '0'.repeat(64) };
    assert.throws(cli, /identity mismatch/);
    await assert.rejects(browser(), /identity mismatch/);
    entry.localManifestIntegrity = trustedPolicy;
    receipts.push('inventory identity mismatch rejected; validated CLI/browser snapshots survive source changes');
    // Reordering has no meaning, and generic registry-over-manifest precedence
    // plus installer registry/trackSizes remain supported without opt-in pins.
    fs.writeFileSync(manifestPath, JSON.stringify({ ...mapping, files: [...mapping.files].reverse() }));
    assert.equal(cli().files.length, 88);
    assert.equal((await browser()).files.length, 88);
    const genericManifest = { schemaVersion: 1, files: mapping.files,
      registry: { accepted: true }, trackSizes: { 2: 123 } };
    fs.writeFileSync(manifestPath, JSON.stringify(genericManifest));
    const generic = await browser({ generic: true });
    assert.equal(generic.files[0].url, 'override');
    assert.equal(generic.files.length, 88);
    assert.equal(generic.app._localRegistry.accepted, true);
    assert.equal(generic.app.cdAudio.trackSizes[2], 123);
    const oldPolicy = entry.localManifestIntegrity;
    delete entry.localManifestIntegrity;
    const genericCli = cli();
    assert.equal(genericCli.files, null);
    entry.localManifestIntegrity = oldPolicy;
    receipts.push('row reordering accepted; generic local manifests retain overrides, registry and CD metadata');
    console.log(JSON.stringify({ verdict: 'PASS ordinary-loading integrity', receipts,
      reviewerConditions: { outsideFixtureOrdinaryLoaderAccepted: false,
        arbitraryGuestMappingOrdinaryLoaderAccepted: false, routes: ['CLI', 'browser loader block'] },
      sourceHashes: { cliSelector: hash(cliSelector), cli: hash(cliResolver),
        browser: hash(browserResolver), browserDll: hash(browserDll), hostLoader: hash(hostLoader) },
      limits: 'filesystem/JS extraction with real bytes; no guest or real browser execution' }, null, 2));
  } finally { fs.rmSync(parent, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
