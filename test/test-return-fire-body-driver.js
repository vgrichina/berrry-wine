'use strict';
// Actual sealed composed entry + synthetic CDP transport + real FS/HTTP bodies.
// The fixture's fetches are NOT browser evidence or original game execution.
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const vm = require('vm'), cp = require('child_process'), {createRequire} = require('module');
const {EventEmitter} = require('events');
const {compose, sha} = require('../tools/return-fire-body-driver.cjs');
const {Session} = require('./test-browser-response-body-collector.js');
const ROOT = path.resolve(__dirname, '..');
const PRIOR = path.join(ROOT, 'scratch/runs/20261105-return-fire-system-data-audio');
const USED = path.join(PRIOR, 'used-composed-driver.cjs');
const EXPECTED = '90f4d8f6d182b28aefe07744148452d5deb8590aaf12801a0313e137ca13b008';
const RUN_PARENT = path.join(ROOT, 'scratch/runs/20261105-return-fire-browser-body-receipts');
fs.mkdirSync(RUN_PARENT, {recursive: true});
const RUN = process.env.RF_BODY_TEST_RUN || fs.mkdtempSync(path.join(RUN_PARENT, 'test-'));
assert(RUN.startsWith(path.join(ROOT, 'scratch/runs/20261105-return-fire-browser-body-receipts/')));
fs.mkdirSync(RUN, {recursive: true});
const read = file => JSON.parse(fs.readFileSync(file));
const priorSource = fs.readFileSync(USED, 'utf8');
assert.equal(sha(priorSource), EXPECTED);
assert.equal(sha(fs.readFileSync(path.join(PRIOR, 'runtime/first-failure.json'))),
  '36714e00ab3f73679e6b1932f665cea6a71c4166353d3d76d94b676b523f9e48');
assert.throws(() => compose({source: priorSource + '\n', expectedSHA256: EXPECTED, run: RUN}), /hash changed/);
const events = read(path.join(ROOT, 'scratch/runs/20261105-return-fire-playback-observation/fixture.json'))
  .cases.find(c => c.mode === 'running').snapshot.events;
const real = require('puppeteer');
const disconnect = real.CDPSessionEvent.Disconnected;
let publicAttempts = 0, nativeAttempts = 0;
const publicSpawn = cp.spawn, nativeSpawn = cp.ChildProcess.prototype.spawn;
const publicGuard = () => {publicAttempts++; throw Error('PUBLIC_SPAWN_FORBIDDEN');};
cp.spawn = publicGuard;
cp.ChildProcess.prototype.spawn = () => {nativeAttempts++; throw Error('NATIVE_SPAWN_FORBIDDEN');};
const cases = [];
let suiteDone = false;
process.once('beforeExit', () => {if (!suiteDone) {console.error('FAIL composed suite incomplete'); process.exitCode = 1;}});
async function run(name, mode) {
  const successful = mode === 'positive' || mode === 'optional-script404';
  const runDir = path.join(RUN, name); fs.mkdirSync(runDir);
  let source = compose({source: priorSource, expectedSHA256: EXPECTED, run: runDir});
  // Shorten only the fixture timeout, never the qualified helper/default.
  source = source.replace("onResponse:r=>responseHandler(r),", "timeoutMs:100,onResponse:r=>responseHandler(r),");
  const pinMutation = {
    'pin-missing': "pin.files=pin.files.filter(f=>!f.path.startsWith('test/binaries/tlbs/'));",
    'pin-wronghash': "pin.files.find(f=>f.path.startsWith('test/binaries/tlbs/')).sha256='0'.repeat(64);",
    'pin-wrongsize': "pin.files.find(f=>f.path.startsWith('test/binaries/tlbs/')).bytes++;",
  }[mode];
  if (pinMutation) source = source.replace('const pin=pins(),byPath=',
    'const pin=pins();' + pinMutation + 'const byPath=');
  const patch = cp.spawnSync('diff', ['-u', '--label', 'a/used-composed-driver.cjs',
    '--label', 'b/used-composed-driver.cjs', USED, '-'], {input: source, encoding: 'utf8'});
  assert.equal(patch.status, 1, patch.stderr);
  fs.writeFileSync(path.join(runDir, 'driver-amendment.patch'), patch.stdout);
  const base = path.join(ROOT, 'scratch/runs/20261105-return-fire-playback-observation/driver.cjs');
  const m = {exports: {}};
  vm.runInThisContext('(function(require,module,exports,__dirname){' + source + '\n})',
    {filename: base})(createRequire(base), m, m.exports, runDir);
  let next = 0, closes = 0, controls = 0, awaiting = [];
  const session = new Session('page');
  const child = new Session('worker');
  const grandchild = new Session('nested-worker');
  const send = session.send.bind(session), childSend = child.send.bind(child);
  session.id = () => 'page-session';
  session.connection = () => ({session: id => {assert.equal(id, 'worker-session'); return mode === 'missing-child-session' ? null : child;}});
  session.send = async (method, params) => {
    if (method === 'Target.getTargetInfo') return {targetInfo: {targetId: 'page-target'}};
    if (method === 'Target.setAutoAttach') session.emit('Target.attachedToTarget', {
      sessionId: 'worker-session', targetInfo: {type: 'worker', targetId: 'worker-target',
        url: 'http://127.0.0.1/lib/guest-worker.js?v=fixture'}, waitingForDebugger: true});
    return send(method, params);
  };
  child.connection = () => ({session: id => {assert.equal(id, 'nested-session'); return grandchild;}});
  child.send = async (method, params) => {
    if (method === 'Target.setAutoAttach') child.emit('Target.attachedToTarget', {
      sessionId: 'nested-session', targetInfo: {type: 'worker', targetId: 'nested-target',
        url: 'http://127.0.0.1/lib/nested-worker.js'}, waitingForDebugger: true});
    return method === 'Runtime.evaluate'
      ? {result: {value: {events: [], errors: []}}} : childSend(method, params);
  };
  async function emitResponse(response, overrides = {}) {
    const id = String(++next), target = overrides.nested ? grandchild : overrides.worker ? child : session;
    const status = overrides.status ?? response.status();
    let bytes = status === 200 ? await response.buffer() : Buffer.alloc(0);
    if (overrides.wrong) bytes = Buffer.from('wrong browser body');
    if (overrides.short) bytes = bytes.subarray(1);
    if (overrides.reject) bytes = Error('No data found for resource with given identifier');
    if (overrides.never) bytes = () => new Promise(() => {});
    target.origin = new URL(response.url()).origin;
    const script = overrides.optionalScript;
    const networkId = 'network-' + id;
    const failed = {requestId: networkId, type: 'Script', errorText: 'net::ERR_ABORTED', canceled: true};
    if (script === 'optional-script-not-canceled') failed.canceled = false;
    if (script === 'optional-script-reset') failed.errorText = 'net::ERR_CONNECTION_RESET';
    if (script) target.emit('Network.requestWillBeSent', {requestId: networkId, type: 'Script',
      request: {url: response.url(), method: 'GET'},
      ...(script === 'optional-script-network-redirect' ? {redirectResponse: {status: 302}} : {})});
    target.pause(id, bytes, {request: {url: response.url(), method: overrides.method || 'GET'},
      ...(script ? {resourceType: 'Script'} : {}),
      responseStatusCode: status, ...(overrides.redirect ? {redirectedRequestId: 'earlier'} : {})});
    if (script) {
      if (script === 'optional-script-before-continue') target.emit('Network.loadingFailed', failed);
      for (let attempt = 0; attempt < 20 && !target.calls.some(c =>
        c.method === 'Fetch.continueResponse' && c.params.requestId === id); attempt++)
        await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      if (script === 'optional-script-fetch-error') {
        target.pause(id, bytes, {request: {url: response.url(), method: 'GET'}, resourceType: 'Script',
          responseStatusCode: undefined, responseErrorReason: 'Failed'});
        await new Promise(resolve => setImmediate(resolve));
      }
      if (script !== 'optional-script-missing-response') target.emit('Network.responseReceived', {
        requestId: networkId, type: 'Script', response: {url: response.url(), status}});
      if (script === 'optional-script-detach') target.emit(disconnect);
      if (script === 'optional-script-other-session') {
        const other = target === child ? session : child;
        other.emit('Network.requestWillBeSent', {requestId: networkId, type: 'Script', request: {url: response.url(), method: 'GET'}});
        other.emit('Network.loadingFailed', failed);
      } else target.emit('Network.loadingFailed', failed);
    }
    if (overrides.detach) target.emit(disconnect);
    if (overrides.cancel) throw Error('synthetic navigation cancellation');
  }
  const page = new EventEmitter();
  page.emit = (name, response) => {
    assert.equal(name, 'response');
    if (mode.startsWith('font-') && response.url().endsWith('/fonts/Terminal.fon')) {
      if (mode === 'font-omitted') return true;
      awaiting.push(emitResponse(response, {wrong: mode === 'font-corrupt',
        reject: mode === 'font-rejected', never: mode === 'font-unresolved'}));
    } else awaiting.push(emitResponse(response));
    return true;
  };
  async function httpResponse(origin, relative, overrides = {}) {
    const r = await fetch(new URL('/' + relative, origin));
    const bytes = Buffer.from(await r.arrayBuffer());
    if (overrides.omit) return;
    await emitResponse({url: () => r.url, status: () => r.status,
      buffer: async () => bytes}, overrides);
  }
  Object.assign(page, {setCacheEnabled: async value => assert.equal(value, false),
    createCDPSession: async () => session, evaluateOnNewDocument: async js => {new vm.Script(js);},
    evaluate: async arg => typeof arg === 'string'
      ? {ready: true, worker: true, indexed: 8, isolated: true, viewport: {width: 1024, height: 768}}
      : {events, errors: []}, screenshot: async () => {},
    mouse: {move: async () => {controls++;}, down: async () => {}, up: async () => {}},
    keyboard: {down: async () => {}, up: async () => {}},
    goto: async url => {
      session.origin = child.origin = new URL(url).origin;
      // Real paused Workers cannot issue their fixture requests until resume.
      await new Promise(resolve => setImmediate(resolve));
      assert(session.calls.some(c => c.method === 'Fetch.enable'));
      assert(child.calls.some(c => c.method === 'Fetch.enable'));
      assert(grandchild.calls.some(c => c.method === 'Fetch.enable'));
      for (const target of [child, grandchild]) {
        const enable = target.calls.findIndex(c => c.method === 'Fetch.enable');
        const resume = target.calls.findIndex(c => c.method === 'Runtime.runIfWaitingForDebugger');
        assert(enable >= 0 && resume > enable, 'attach collector before Worker resume');
      }
      const system = read(path.join(PRIOR, 'system-data-ledger.json')).files;
      if (successful || mode.startsWith('optional-script-') || mode === 'missing-system-receipt' || mode.startsWith('font-')) {
        for (const file of system) await httpResponse(url, file.path, {
          omit: mode === 'missing-system-receipt'});
        await httpResponse(url, 'favicon.ico');
        await require(path.join(PRIOR, 'host-fallback.cjs')).exercise({root: ROOT,
          origin: new URL(url).origin, page, pinFiles: m.exports.pins().files});
        await Promise.all(awaiting);
        if (mode.startsWith('optional-script')) {
          await httpResponse(url, mode === 'optional-script-required200' ? system[0].path : 'build-info.js',
            {optionalScript: mode});
          if (successful) {
            await httpResponse(url, 'build-info.js', {optionalScript: mode, worker: true});
            await httpResponse(url, 'build-info.js', {optionalScript: mode, nested: true});
          }
        }
        if (successful) {
          // Synthetic missing declaration; the real declared TLB is untouched.
          const relative = path.relative(ROOT, path.join(runDir, 'intentionally-absent.tlb'));
          const missingURL = new URL('/' + relative, url);
          assert.equal((await fetch(missingURL)).status, 404);
          const missingLedger = {files: [{path: relative, exists: false,
            missingRequests: [relative, relative + '.part000']}]};
          const {absent} = require(path.join(PRIOR, 'system-data.cjs'));
          assert(absent(missingLedger, relative, missingURL, 404, 'GET', ROOT));
          for (const [status, method, query] of [[200, 'GET', ''], [500, 'GET', ''],
            [404, 'POST', ''], [404, 'GET', '?x']]) assert.equal(absent(missingLedger,
              relative, new URL(missingURL + query), status, method, ROOT), false);
          assert.equal(absent(missingLedger, relative + '.unknown', missingURL, 404, 'GET', ROOT), false);
          const art = 'test/binaries/candidates/return-fire-demo/RFIRE/ART/1PSCREEN.~CR';
          await Promise.all([httpResponse(url, art), httpResponse(url, art, {worker: true}),
            httpResponse(url, art, {nested: true})]);
          await httpResponse(url, 'index.html');
        }
      } else {
        const file = mode === 'bundle-wrong-query' ? '__bundle?f=fonts/System.fon'
          : mode === 'unknown-404' ? 'intentionally-unknown-body-receipt.file'
          : system[0].path + (mode === 'system-query' ? '?unexpected=1' : '');
        await httpResponse(url, file, {
          wrong: mode === 'wrong-hash', short: mode === 'wrong-size',
          reject: mode === 'body-rejected', never: ['body-timeout', 'cancel', 'detach'].includes(mode),
          detach: mode === 'detach', cancel: mode === 'cancel',
          method: mode === 'post' ? 'POST' : 'GET', redirect: mode === 'redirect',
          ...(mode === 'existing-404' ? {status: 404} : {})});
      }
    }});
  const result = await m.exports.main({mock: true, launch: async options => {
    assert.equal(options.defaultViewport, null);
    assert(!options.args.some(a => /mute-audio|autoplay-policy|disable-audio/.test(a)));
    return {newPage: async () => page, close: async () => {
      closes++;
      if (!successful) assert(fs.existsSync(path.join(runDir, 'mock-runtime/first-failure.json')));
    }};
  }, review: async () => {assert(successful); return {x: 368, y: 456};}, delay: async () => {}});
  const out = path.join(runDir, 'mock-runtime'), final = read(path.join(out, 'driver-final.json'));
  const receipts = read(path.join(out, 'receipts-final.json'));
  const collector = read(path.join(out, 'body-collector-final.json'));
  assert.equal(closes, pinMutation ? 0 : 1); assert.equal(final.closed, true); assert.equal(final.serverListening, false);
  assert.equal(read(path.join(out, 'final-pins.json')).verified, mode !== 'pin-wronghash');
  assert.deepEqual(final.firstFailure, result.firstFailure);
  assert.deepEqual(read(path.join(out, 'terminal-result.json')).firstFailure, result.firstFailure);
  if (successful) {
    assert.equal(result.firstFailure, null); assert(receipts.complete); assert(collector.complete);
    assert.equal(controls, 1);
    assert.equal(receipts.receipts.filter(r => r.receipt === 'optional-fallback').length, 1);
    assert.equal(receipts.receipts.filter(r => r.path.endsWith('ART/1PSCREEN.~CR') && r.verified).length, 3);
    const ids = receipts.receipts.filter(r => r.path.endsWith('ART/1PSCREEN.~CR')).map(r => r.bodyIdentity.sessionId);
    assert.equal(new Set(ids).size, 3);
    if (mode === 'optional-script404') {
      const optional = receipts.receipts.filter(r => r.path === 'build-info.js');
      assert.equal(optional.length, 3);
      assert(optional.every(r => r.receipt === 'optional-absence' && r.verified === false));
      assert.equal(new Set(optional.map(r => r.bodyIdentity.sessionId)).size, 3);
      const events = fs.readFileSync(path.join(out, 'body-collector.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.equal(events.filter(r => r.state === 'optional-absence-script-rejection').length, 3);
    }
  } else {
    assert(result.firstFailure); assert.equal(controls, 0);
    const first = read(path.join(out, 'first-failure.json'));
    assert.deepEqual(first.firstFailure, result.firstFailure);
    const boundaries = {
      'wrong-hash': 'actual-http-body-mismatch', 'wrong-size': 'actual-http-body-mismatch',
      'pin-missing': 'system-data-pin-baseline-mismatch', 'pin-wronghash': 'system-data-pin-baseline-mismatch',
      'pin-wrongsize': 'system-data-pin-baseline-mismatch', 'system-query': 'unclassified-system-data-request',
      'existing-404': 'actual-http-status', 'unknown-404': 'actual-http-status',
      'body-rejected': 'browser-body-collector', 'body-timeout': 'browser-body-collector',
      cancel: 'driver-error', detach: 'browser-body-collector', post: 'browser-body-collector',
      redirect: 'browser-body-collector', 'missing-system-receipt': 'system-data-coverage-incomplete',
      'font-corrupt': 'actual-http-body-mismatch', 'font-omitted': 'font-fallback-incomplete',
      'font-rejected': 'browser-body-collector', 'font-unresolved': 'browser-body-collector',
      'bundle-wrong-query': 'unclassified-bundle-request', 'missing-child-session': 'browser-body-session-missing',
    };
    for (const m of ['required200', 'not-canceled', 'reset', 'missing-response', 'before-continue',
      'fetch-error', 'other-session', 'detach', 'network-redirect']) boundaries['optional-script-' + m] = 'browser-body-collector';
    assert.equal(result.firstFailure.boundary, boundaries[mode], mode);
    assert(!receipts.complete || mode === 'missing-system-receipt');
  }
  cases.push({name, mode, amendedSHA256: sha(source), firstFailure: result.firstFailure, receiptsComplete: receipts.complete,
    collectorComplete: collector.complete, syntheticTransport: true, realFSHTTP: true});
}
(async () => {
  try {
    await assert.rejects(real.launch({executablePath: '/usr/bin/google-chrome', headless: false,
      userDataDir: path.join(RUN, 'guard-public-profile'), args: ['--no-sandbox']}), /PUBLIC_SPAWN_FORBIDDEN/);
    cp.spawn = publicSpawn;
    await assert.rejects(real.launch({executablePath: '/usr/bin/google-chrome', headless: false,
      userDataDir: path.join(RUN, 'guard-native-profile'), args: ['--no-sandbox']}), /NATIVE_SPAWN_FORBIDDEN/);
    cp.spawn = publicGuard;
    for (const mode of ['positive', 'wrong-hash', 'wrong-size', 'pin-missing', 'pin-wronghash',
      'pin-wrongsize', 'system-query', 'existing-404', 'body-rejected',
      'body-timeout', 'cancel', 'detach', 'post', 'redirect', 'missing-system-receipt',
      'font-corrupt', 'font-omitted', 'font-rejected', 'font-unresolved',
      'bundle-wrong-query', 'unknown-404', 'missing-child-session', 'optional-script404',
      'optional-script-required200', 'optional-script-not-canceled', 'optional-script-reset',
      'optional-script-missing-response', 'optional-script-before-continue', 'optional-script-fetch-error',
      'optional-script-other-session', 'optional-script-detach', 'optional-script-network-redirect']) await run(mode, mode);
    assert.equal(sha(fs.readFileSync(USED)), EXPECTED);
    assert.equal(publicAttempts, 1); assert.equal(nativeAttempts, 1);
    fs.writeFileSync(path.join(RUN, 'summary.json'), JSON.stringify({passed: true, cases,
      input: {path: USED, sha256: EXPECTED}, publicAttempts, nativeAttempts,
      ChromeLaunched: 0, originalGuestExecuted: false}, null, 2));
    console.log('PASS actual composed entry ' + cases.length + ' synthetic CDP cases; real FS/HTTP, public/native no-spawn guards; ZERO Chrome. Evidence ' + RUN);
    suiteDone = true;
  } finally {cp.spawn = publicSpawn; cp.ChildProcess.prototype.spawn = nativeSpawn;}
})().catch(error => {suiteDone = true; console.error(error); process.exitCode = 1;});
