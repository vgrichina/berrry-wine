'use strict';
// Actual setup sender -> numbered transport -> composed execute -> real bound
// identity/freshness chain and pulse. Only CDP pixels/identity replies are fake.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const cp = require('node:child_process'), Module = require('node:module');
const z = require('node:zlib'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), run = process.env.MENU_DIAGNOSTICS_RUN;
assert(run && path.isAbsolute(run), 'explicit offline evidence directory');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const wait = ms => new Promise(r => setTimeout(r, ms));
const filename = require.resolve('./supertux-native-driver-composition.cjs');
let production = require(filename);
if (process.env.MENU_DIAGNOSTICS_BASE) {
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m._compile(cp.execFileSync('git', ['show', process.env.MENU_DIAGNOSTICS_BASE + ':tools/supertux-native-driver-composition.cjs'], {encoding: 'utf8'}), filename);
  production = m.exports;
}
const transport = require('../scratch/runs/20261108-supertux-short-step-progression-2236/transport.cjs');
const binding = require('../scratch/runs/20261108-supertux-short-step-progression-2236/bound-input.cjs');
const input = require('../scratch/runs/20261108-supertux-short-step-progression-2236/input.cjs');
const manifest = JSON.parse(z.gunzipSync(fs.readFileSync(root + '/scratch/runs/20261109-supertux-validated-enter-gameplay-0400/composition-pins.json.gz')));
manifest.files = manifest.files.map(p => {const b = fs.readFileSync(root + '/' + p.path);return {...p, size: b.length, sha256: sha(b)};});
const composed = production.compose({root, manifest});
const begin = composed.source.indexOf('async function execute(c,markDispatch){');
const end = composed.source.indexOf('\n(async()=>', begin);
assert(begin > 0 && end > begin);
const realRequire = Module.createRequire(composed.filename);
const children = [];
// Observable finite cap is armed before any Node fixture child; no browser.
const watchdog = setTimeout(() => {for (const c of children) c.kill('SIGKILL');}, 20000);
console.log(JSON.stringify({watchdogArmed: true, deadline: Date.now() + 20000, noBrowser: true}));

async function fixture(name) {
  const out = run + '/' + name; fs.mkdirSync(out); fs.mkdirSync(out + '/commands');
  const bytes = Buffer.from('offline pixels; no gameplay'), moduleBytes = Buffer.from('offline module');
  const moduleSha = sha(moduleBytes), effects = [], replies = [];
  let offset = name === 'stale' ? -12109 : 0, failBrowser = false, advanceDuringRead = false;
  const app = {name: 'supertux_013', running: true, stopped: false, guestWorker: true,
    processId: 1, processObject: 'process', endpoint: 'endpoint', endpointObject: 'link',
    workerObject: 'worker', moduleObject: 'module', epoch: 'document',
    renderEndpoint: 'none', renderEndpointObject: 'none', renderWorkerObject: 'none',
    pageRendererObject: 'renderer', canvasObject: 'canvas', guestEndpoint: 'endpoint', slot: 1};
  const workers = new Map([['worker', {url: 'guest-worker', sessionId: 'worker', targetId: 'target',
    scripts: [{scriptId: 'script', bytecodeAvailable: true, sha256: moduleSha}]}]]);
  const cdp = production.createTransport({timeoutMs: 100, write(line) {
    const m = JSON.parse(line); let result = {};
    if (m.method === 'Input.dispatchKeyEvent') effects.push({at: Date.now(), ...m.params});
    if (m.method === 'Debugger.getScriptSource') result = {bytecode: moduleBytes.toString('base64')};
    if (m.method === 'Page.captureScreenshot') result = {data: bytes.toString('base64')};
    const delay = m.params.type === 'keyDown' ? (name === 'delayed-down' ? 1500 : name === 'delayed-positive' ? 80 : 1) : 1;
    setTimeout(() => {replies.push({method: m.method, type: m.params.type, at: Date.now()});
      cdp.receive({id: m.id, ...((failBrowser && m.method === 'Debugger.getScriptSource') || (name === 'rejected-down' && m.params.type === 'keyDown') ? {error: {code: -32000, message: 'fixture browser request failed'}} : {result})});}, delay);
  }});
  const chain = binding.createChain({send: cdp.send, workers, pageSession: 'page', app: 'supertux_013', expectedModules: [moduleSha],
    now: () => Date.now() + offset, evaluate: async expression => {
      if (advanceDuringRead) offset = 12100;
      if (expression === binding.PAGE_READ) return {isolated: true, apps: [{...app}]};
      if (expression === binding.WORKER_READ) return {endpointIdentity: 'endpoint', slot: 1, instance: 'instance'};
      throw Error('unexpected identity read');
    }});
  const context = {root, out, assert, Date, Number, JSON, Promise, Buffer, deadline: Date.now() + 10000,
    sha, fs, require: p => p === root + '/tools/supertux-native-driver-composition.cjs' ? production : realRequire(p),
    pageSession: 'page', pulse: input.pulse, session: production.createSession({out, deadline: Date.now() + 10000, publish: transport.publish}),
    chain, send: cdp.send, wait, save: (p, v) => transport.publish(out + '/' + p, v)};
  let captures = 0;
  context.capture = async label => {
    captures++; const shot = await chain.capture(label); context.latest = shot.capture;
    fs.writeFileSync(out + '/' + label + '.png', shot.png);
    transport.publish(out + '/' + label + '-capture.json', shot.capture);
    transport.publish(out + '/latest.json', shot.capture);
  };
  await context.capture('menu'); offset = 0;
  const sourceAt = context.latest.at;
  context.session.admit();
  if (name === 'stale-during-read') advanceDuringRead = true;
  if (name === 'browser') failBrowser = true;
  if (name === 'closed') cdp.disconnect();
  const execute = vm.runInNewContext('(' + composed.source.slice(begin, end) + ')', context);
  const command = {id: 'map-down', action: 'key', keys: ['ArrowDown'], holdMs: 30, waitMs: 0, label: 'map-down'};
  // The same helper shape as Super0400: exact latest read, reviewed bytes,
  // reviewRef and requestReady. Child stderr/close/EOF are actually observed.
  const script = `const fs=require('fs'),p=require(${JSON.stringify(filename)}),t=require(${JSON.stringify(require.resolve('../scratch/runs/20261108-supertux-short-step-progression-2236/transport.cjs'))});
    const out=${JSON.stringify(out)},c=${JSON.stringify(command)},cap=JSON.parse(fs.readFileSync(out+'/latest.json'));
    c.reviewRef=cap.label;fs.writeFileSync(out+'/'+cap.label+'-review.json',JSON.stringify({...cap,review:'offline exact image reviewed'}));
    p.requestReady(t,out,c.id,c,5000).then(ack=>console.log(JSON.stringify({ack})),async error=>{
      console.log(JSON.stringify({error:String(error),terminal:error.terminal}));
      try{await p.requestReady(t,out,'later',{action:'capture',label:'later',waitMs:0},100);process.exitCode=9;}
      catch(e){console.log('later refused '+e);process.exitCode=1;}
    });`;
  const child = cp.spawn(process.execPath, ['-e', script], {stdio: ['ignore', 'pipe', 'pipe']});children.push(child);
  let stdout = '', stderr = '';child.stdout.on('data', b => stdout += b);child.stderr.on('data', b => stderr += b);
  const closed = new Promise(resolve => child.once('close', (code, signal) => resolve({code, signal})));
  const until = Date.now() + 3000;
  while (!fs.existsSync(out + '/commands/0.json.gz') && Date.now() < until) await wait(5);
  assert(fs.existsSync(out + '/commands/0.json.gz'), 'actual sender must admit command');
  if (name === 'storage') fs.unlinkSync(out + '/menu-review.json');
  let error;
  try {await production.consumeTerminal(transport, out, 0, execute);} catch (e) {error = e;}
  const terminal = await closed;
  fs.writeFileSync(out + '/sender-terminal.json', JSON.stringify({pid: child.pid, ...terminal, stdout, stderr,
    stdoutEOF: child.stdout.readableEnded, stderrEOF: child.stderr.readableEnded}, null, 2));
  assert.equal(stderr, ''); assert.equal(terminal.signal, null);
  assert(child.stdout.readableEnded && child.stderr.readableEnded);
  await input.drain();
  assert.equal(input.physical.size, 0);
  const successful = name === 'fresh' || name === 'delayed-positive';
  if (!successful) assert.equal(context.latest.at, sourceAt, 'failure cannot retimestamp capture');
  assert.equal(terminal.code, successful ? 0 : 1);
  if (successful) {
    assert(!error);assert.equal(captures, 2);assert.deepEqual(effects.map(e => e.type), ['keyDown', 'keyUp']);
    const timing = JSON.parse(fs.readFileSync(out + '/command-map-down-timing.json'));
    assert.equal(timing.captureProducedAt, sourceAt);assert(timing.captureReadAt >= timing.commandAdmittedAt);
    assert(timing.inputAdmittedAt >= timing.captureReadAt);assert.equal(timing.freshnessBudgetMs, 12000);
    const helper = JSON.parse(fs.readFileSync(out + '/request-map-down-timing.json'));
    assert(helper.readyObservedAt >= helper.helperStartedAt);
    assert(helper.commandSubmittedAt >= helper.readyObservedAt);assert(helper.ackReadAt >= helper.commandSubmittedAt);
    if (name === 'delayed-positive') assert(replies.find(e => e.type === 'keyUp').at < replies.find(e => e.type === 'keyDown').at);
  } else {
    assert(error);const detail = JSON.parse(fs.readFileSync(out + '/terminal-failure.json'));
    const categories = {stale: 'stale', 'stale-during-read': 'stale', storage: 'storage', browser: 'browser', closed: 'browser', 'delayed-down': 'helperACKtimeout', 'rejected-down': 'browser'};
    assert.equal(detail.category, categories[name]);
    assert.equal(detail.id, command.id);assert(detail.exactReason);
    const diagnostic = detail.failure.diagnostic;assert(diagnostic.captureReadAt >= diagnostic.commandAdmittedAt);
    assert.equal(diagnostic.captureProducedAt, sourceAt);assert.equal(diagnostic.freshnessBudgetMs, 12000);assert.equal(diagnostic.aimMs, 8000);
    if (name.startsWith('stale')) {
      assert.equal(detail.failure.cause.code, 'STALE_SCENE_BEFORE_DISPATCH');
      assert.equal(detail.failure.code, undefined, 'no generic refreshable stale ACK');
      assert.equal(detail.stage, 'review-admission');assert.equal(diagnostic.inputAdmittedAt, null);
    }
    const ack = JSON.parse(fs.readFileSync(out + '/reply-0.json'));
    assert.equal(ack.ok, false);assert.equal(ack.refreshRequired, undefined);assert.deepEqual(ack.terminal, detail);
    assert.deepEqual(JSON.parse(fs.readFileSync(out + '/first-failure.json')).terminal, detail);
    assert.deepEqual(JSON.parse(stdout.split('\n')[0]).terminal, detail, 'actual setup sender retains exact cause');
    assert.deepEqual(JSON.parse(fs.readFileSync(out + '/transport-closed.json')).terminal, detail);
    // Re-entering the real numbered consumer must preserve the first record.
    fs.writeFileSync(out + '/commands/1.json.gz', z.gzipSync(JSON.stringify({id: 'forbidden', action: 'capture'})));
    await assert.rejects(production.consumeTerminal(transport, out, 1, execute), /UNKNOWN\/partial closure/);
    fs.unlinkSync(out + '/commands/1.json.gz');
    assert.deepEqual(JSON.parse(fs.readFileSync(out + '/first-failure.json')).terminal, detail);
    assert.deepEqual(JSON.parse(fs.readFileSync(out + '/terminal-failure.json')), detail);
    assert(!fs.existsSync(out + '/commands/1.json.gz'));assert.match(stdout, /later refused/);
    assert.equal(captures, 1, 'no later capture after terminal failure');
    if (name === 'delayed-down') {
      assert.deepEqual(effects.map(e => e.type), ['keyDown', 'keyUp']);
      const down = replies.find(e => e.type === 'keyDown'), up = replies.find(e => e.type === 'keyUp');
      assert(up.at < down.at, 'independent UP survives delayed DOWN');
    } else if (name === 'rejected-down') {
      assert.deepEqual(effects.map(e => e.type), ['keyDown', 'keyUp']);
      assert.match(detail.exactReason, /fixture browser request failed/);assert.equal(detail.stage, 'input');
      assert.equal(detail.failure.cause.inputFailures[0].failure.code, 'CDP_ERROR');
    } else assert.equal(effects.length, 0);
  }
  assert(!fs.existsSync(out + '/writer.lock'));
  return {name, terminal, stdout, stderr, stdoutEOF: true, stderrEOF: true, captures, effects, replies};
}
(async () => {
  const cases = [];
  // Begin with causal reproduction: old production must fail this assertion.
  for (const name of ['stale', 'fresh', 'delayed-positive', 'stale-during-read', 'storage', 'browser', 'closed', 'delayed-down', 'rejected-down']) cases.push(await fixture(name));
  const timedOut = run + '/helper-ack-timeout';fs.mkdirSync(timedOut);fs.mkdirSync(timedOut + '/commands');
  transport.publish(timedOut + '/ready.json', {ready: true, deadline: Date.now() + 1000});
  await assert.rejects(production.requestReady(transport, timedOut, 'pending', {action: 'capture', label: 'pending', waitMs: 0}, 30), e => {
    assert.equal(e.terminal.category, 'helperACKtimeout');assert.equal(e.terminal.stage, 'helper-command-ack');
    assert.equal(e.terminal.exactReason, 'UNKNOWN command ACK deadline');return true;
  });
  assert(!fs.existsSync(timedOut + '/writer.lock'));
  fs.writeFileSync(run + '/diagnostics-result.json', JSON.stringify({passed: true, composedSHA256: composed.sha256, cases}, null, 2));
  console.log(JSON.stringify({passed: true, cases: cases.map(c => c.name), composedSHA256: composed.sha256, noBrowser: true}));
})().catch(e => {console.error(e);process.exitCode = 1;}).finally(() => clearTimeout(watchdog));
