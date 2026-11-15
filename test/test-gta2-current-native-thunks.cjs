'use strict';

// Retained evidence checks do not launch a guest, initialize a DLL or qualify
// the browser path. Live controls must be requested separately after handoff.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const prior = path.join(root, 'scratch/runs/20261115-neverhood-current-native-thunks-original-install');
const pe = '28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4';
const ne = '39bbfafa8b759ebfcf6a00ee878fa494581a9144891bbd788bded61441de13f9';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const retainedOnly = { skip: !fs.existsSync(path.join(prior, 'runtime-release.json'))
  ? 'retained task evidence is not installed; no live qualification claimed' : false };

function verifySealedClosure(directory, expectedReleaseHash) {
  const releasePath = path.join(directory, 'runtime-release.json');
  const releaseBytes = fs.readFileSync(releasePath);
  assert.equal(hash(releaseBytes), expectedReleaseHash, 'explicit release pin');
  const release = JSON.parse(releaseBytes);
  assert.equal(release.sourceBuildRuntimeReleased, true);
  function sealed(ref) {
    const file = path.resolve(directory, ref.path);
    assert.ok(file.startsWith(path.resolve(directory) + path.sep), 'contained reference');
    const bytes = fs.readFileSync(file);
    assert.equal(hash(bytes), ref.sha256, ref.path);
    return JSON.parse(bytes);
  }
  const closure = sealed(release.directClosure);
  assert.equal(closure.receipts.length, closure.actualWaitReceiptCount);
  for (const ref of closure.receipts) {
    const receipt = sealed(ref);
    for (const key of ['actualWait', 'stdoutEOF', 'stderrEOF']) {
      assert.equal(receipt[key], true, `${ref.path}: ${key}`);
    }
    assert.equal(receipt.exit, ref.exit, `${ref.path}: exit`);
  }
  for (const ref of closure.additionalLifecycleRefs) sealed(ref);
  // Historical absence is evidence about that check only. A future heavy
  // handoff must check live PIDs/groups and both locks again at admission.
  return { release, closure };
}

test('sealed predecessor evidence preserves genuine lifetime versus FT execution limit', retainedOnly, () => {
  const { release, closure } = verifySealedClosure(prior,
    'ed0f1bf8bd1396bd002eb234edc5e04f621f83c4dbf88fc6fa95ff8f84c750f0');
  assert.equal(closure.actualWaitReceiptCount, 239);
  assert.equal(closure.pids.length, 275);
  for (const file of ['genuine-shared-published-result.json', 'genuine-head-result.json']) {
    const actual = read(path.join(prior, file));
    assert.deepEqual(actual.pins.pe.slice(1), [577808, pe]);
    assert.deepEqual(actual.pins.ne.slice(1), [155136, ne]);
    assert.equal(actual.mountedPath.toLowerCase(), 'c:\\windows\\system\\commctrl.dll');
    assert.equal(actual.attach.completed, true);
    assert.equal(actual.attach.returnValue, 1);
    assert.equal(actual.mapped.initializationFinished, true);
    assert.equal(actual.detach, true);
    assert.deepEqual(actual.after, actual.before, 'caller restoration');
    assert.equal(actual.genuineFTExecution, false);
    assert.equal(actual.installerExecuted, false);
    assert.equal(actual.gameplay, false);
  }
  assert.equal(release.exactNextBoundary, 'Missing NE image SETUPX during DSETUPE ThunkConnect32');
  assert.equal(release.nativeQuit, false);
  assert.equal(release.originalPermanentInputUnknown, true);
  assert.equal(release.noMoreOriginalsOrControls, true);
});

test('prior GTA2 first causal failure keeps WebGL and gameplay unproved', retainedOnly, () => {
  const previous = read(path.join(root, 'scratch/runs/20261114-gta2-current-paired-consequence/result.json'));
  assert.equal(previous.candidateId, 'gta2-demo');
  assert.equal(previous.outcome, 'failed');
  assert.match(previous.summary, /Missing NE image COMMCTRL/);
  assert.match(previous.summary, /WebGL withheld/);
  assert.deepEqual(previous.gameplayScreenshots, []);
});

test('both retained inventories agree on all 71 exact GTA2 inputs', retainedOnly, () => {
  const accepted = read(path.join(root, 'scratch/runs/20261107-gta2-current-driving/fixture-identity.json'));
  const latest = read(path.join(root, 'scratch/runs/20261114-gta2-current-paired-consequence/light-pins.json'));
  const normalize = rows => rows.map(({ path: file, size, sha256 }) => ({ path: file, size, sha256 }))
    .sort((a, b) => a.path.localeCompare(b.path));
  assert.equal(accepted.matches.length, 71);
  assert.equal(latest.fixture.length, 71);
  assert.deepEqual(normalize(latest.fixture), normalize(accepted.matches));
  const exe = latest.fixture.find(row => row.path.endsWith('/gta2.exe'));
  assert.equal(exe.size, 2893824);
  assert.equal(exe.sha256, '97ad743b6ec9ea1be95282053c3127084acd764a7f37a3e57e2268af52d02ae3');
  // Current bytes and registry membership still need checking after admission.
});

function verifyBrowserQualification(directory) {
  const outcome = read(path.join(directory, 'outcome.json'));
  assert.equal(outcome.state, 'complete');
  assert.equal(outcome.worker, true);
  assert.equal(outcome.originalLaunched, false);
  assert.equal(outcome.exeEntryExecuted, false);
  assert.equal(outcome.modules['comctl32.dll'].generation, 1);
  const base = outcome.modules['comctl32.dll'].loadAddr;
  assert(outcome.lifecycle.some(row => row.words[0] === 2 && row.words[9] === base),
    'actual initialized DLL generation must be LIVE');
  const http = fs.readFileSync(path.join(directory, 'http.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  for (const [name, pin] of [['comctl32', pe], ['commctrl', ne]]) {
    const requests = http.filter(row => new URL(row.url, 'http://fixture').pathname === `/binaries/dlls/${name}.dll`);
    assert(requests.some(row => row.status === 200 && row.sha256 === pin), 'exact installed-name HTTP ' + name);
  }
  const actual = read(path.join(directory, 'executed-sources.json'));
  const worker = actual.workers.find(([, info]) => info.url.includes('/lib/guest-worker.js'));
  assert(worker, 'actual guest Worker target');
  const scripts = actual.scripts.filter(row => row.session === worker[0]);
  const moduleHash = hash(fs.readFileSync(path.join(root, 'build/wine-assembly.wasm')));
  assert(scripts.some(row => row.bytecode && row.sha256 === moduleHash), 'retrieved executing production module');
  for (const name of ['host.js', 'lib/guest-worker.js', 'lib/dll-loader.js', 'lib/ne-guest-bridge.js', 'lib/process-boot.js']) {
    const expected = hash(fs.readFileSync(path.join(root, name)));
    assert(actual.scripts.some(row => row.url.startsWith('http:') &&
      new URL(row.url).pathname === '/' + name && row.sha256 === expected), 'retrieved current source ' + name);
  }
  return { moduleHash, base, pe, ne };
}

test('explicit current browser qualification consumes genuine installed companion through Worker lookup', {
  skip: !process.env.GTA2_BROWSER_QUALIFICATION ? 'explicit current control directory required' : false,
}, () => verifyBrowserQualification(process.env.GTA2_BROWSER_QUALIFICATION));

module.exports = { verifySealedClosure, verifyBrowserQualification };
