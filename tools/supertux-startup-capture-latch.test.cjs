'use strict';
// Execute the entire composed driver in a Node child. Only the external
// Chrome/CDP/server boundary and wall-clock sleeps are fixtures; the startup
// IIFE, capture, execute, close, numbered transport and readiness are real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const vm = require('node:vm');
const Module = require('node:module');
const z = require('node:zlib');
const crypto = require('node:crypto');
const {EventEmitter} = require('node:events');
const root = path.resolve(__dirname, '..');
const evidence = process.env.STARTUP_LATCH_RUN;
assert(evidence && path.isAbsolute(evidence), 'explicit evidence directory');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const wait = ms => new Promise(r => setTimeout(r, ms));
const transport = require('../scratch/runs/20261108-supertux-short-step-progression-2236/transport.cjs');
const production = require('./supertux-native-driver-composition.cjs');

function compose(before) {
  let composer = production;
  if (before) {
    const filename = require.resolve('./supertux-native-driver-composition.cjs');
    const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
    m._compile(cp.execFileSync('git', ['show', '3ac81a06e37175bb222720be0211c4c017d6cc5d:tools/supertux-native-driver-composition.cjs'], {encoding: 'utf8'}), filename);
    composer = m.exports;
  }
  const manifest = JSON.parse(z.gunzipSync(fs.readFileSync(root + '/scratch/runs/20261109-supertux-client-capture-onward-0320/composition-pins.json.gz')));
  // Refresh PATHHASH references in memory; never copy providers/media.
  manifest.files = manifest.files.map(p => {const b = fs.readFileSync(root + '/' + p.path);return {...p, size: b.length, sha256: sha(b)};});
  return composer.compose({root, manifest});
}

async function fixture(name) {
  const before = name === 'before';
  const run = evidence + '/' + name + '-' + Date.now(); fs.mkdirSync(run);
  fs.writeFileSync(run + '/runtime-pins.json', JSON.stringify({files: [], httpPins: []}));
  const out = run + '/original', integrated = compose(before), started = Date.now();
  let browser, terminal, effects = [], driverExit = 0;
  const cap = setTimeout(() => browser?.kill('SIGKILL'), 6000);
  const realRequire = Module.createRequire(integrated.filename);
  let sender;
  const fakeCP = {spawn() {
    fs.mkdirSync(out + '/chrome-profile');
    const script = `const fs=require('fs');${name === 'early-exit' ? 'process.exit(7);' : `${name === 'readiness-timeout' ? 'setTimeout(()=>process.exit(0),400);' : "setTimeout(()=>fs.writeFileSync(process.argv[1]+'/DevToolsActivePort','43123\\n/devtools/browser/offline-latch\\n'),15);"}process.stdin.resume();process.stdin.on('end',()=>process.exit(0));`}`;
    browser = cp.spawn(process.execPath, ['-e', script, out + '/chrome-profile'], {stdio: ['pipe', 'pipe', 'pipe']});
    terminal = new Promise(resolve => browser.once('close', (code, signal) => resolve({code, signal})));
    // The early helper uses the actual retained sender, as Super0320 did.
    if (['before', 'legacy-queued', 'success', 'input-failure', 'sender-timeout'].includes(name)) {
      const command = {action: 'capture', label: 'menu', waitMs: 0};
      sender = (before || name === 'legacy-queued' ? transport.request(out, 'setup', command, 30) :
        production.requestReady(transport, out, 'setup', command, name === 'sender-timeout' ? 30 : 2000))
        .then(() => ({ok: true, at: Date.now()}), error => ({ok: false, at: Date.now(), error: String(error)}));
    }
    if (['sticky', 'cleanup', 'first-failure'].includes(name)) setTimeout(() =>
      transport.publish(out + '/' + ({sticky: 'transport-closed.json', cleanup: 'cleanup.json', 'first-failure': 'first-failure.json'}[name]), {sticky: true}), 40);
    return browser;
  }};
  class Socket {
    constructor() {this.readyState = 1; setImmediate(() => this.onopen());}
    send(line) {
      const m = JSON.parse(line); effects.push({at: Date.now(), method: m.method, type: m.params?.type});
      let result = {};
      if (m.method === 'Target.getTargets') result = {targetInfos: [{type: 'page', targetId: 'offline'}]};
      if (m.method === 'Target.attachToTarget') result = {sessionId: 'offline'};
      if (m.method === 'Runtime.evaluate') {
        const expr = m.params.expression;
        let value = {};
        if (expr.startsWith('!!(')) value = Date.now() - started >= (name === 'cancel' ? 300 : 120);
        if (expr.includes('globalThis.__nativeEvidence??[]') && !expr.includes('const all=')) value = [];
        if (expr.includes('const all=')) {
          if (name === 'capture-race') transport.publish(out + '/transport-closed.json', {sticky: true});
          value = {offline: true};
        }
        result = {result: {value}};
      }
      if (m.method === 'Page.getLayoutMetrics') {
        if (name === 'layout-race') transport.publish(out + '/transport-closed.json', {sticky: true});
        result = {cssContentSize: {width: 10, height: 10}};
      }
      if (m.method === 'Page.captureScreenshot') result = {data: Buffer.from('offline fixture').toString('base64')};
      if (name === 'input-failure' && m.method === 'Input.dispatchKeyEvent' && m.params.type === 'keyDown')
        transport.publish(out + '/transport-closed.json', {sticky: true});
      if (m.method === 'Browser.close') browser.stdin.end();
      setImmediate(() => this.onmessage({data: JSON.stringify({id: m.id, result})}));
    }
    close() {this.readyState = 3; this.onclose?.();}
  }
  const server = new EventEmitter();
  server.address = () => ({port: 1}); server.closeAllConnections = () => {};
  server.close = done => done();
  const bound = {createChain: ({send}) => ({
    capture: async label => {await send('Page.captureScreenshot', {format: 'png'}, 'offline');effects.push({at: Date.now(), method: 'chain.capture', label});return {png: Buffer.from('offline fixture'), capture: {label, at: Date.now(), sha256: sha(Buffer.from('offline fixture'))}};},
    admit: async (review, effect) => effect({offline: true})
  })};
  function injectedRequire(p) {
    if (p === 'node:child_process') return fakeCP;
    if (p.endsWith('/test/static-server.js')) return {startStaticServer: async () => server};
    if (p === './bound-input.cjs') return bound;
    return realRequire(p);
  }
  const deadline = started + (['cancel', 'readiness-timeout'].includes(name) ? 200 : 4000);
  const context = {require: injectedRequire, __dirname: path.dirname(integrated.filename), Buffer, console: {log() {}, error() {}}, WebSocket: Socket,
    process: {env: {SUPERTUX_RUN_DIRECTORY: run, BROWSER_DEADLINE: String(deadline)}, get exitCode() {return driverExit;}, set exitCode(v) {driverExit = v;}},
    setTimeout: (fn, ms) => setTimeout(fn, ms === 3000 ? 40 : ms === 5000 ? 50 : ms === 100 ? 2 : ms), clearTimeout,
    setInterval, clearInterval, fetch};
  try {
    vm.runInNewContext(Module.wrap(integrated.source), context, {filename: integrated.filename})({}, injectedRequire, {}, integrated.filename, path.dirname(integrated.filename));
    const until = Date.now() + 4500; let acted = false;
    while (!fs.existsSync(out + '/cleanup.json') && Date.now() < until) {
      if (name === 'success' && fs.existsSync(out + '/commands/0.json.gz')) assert(fs.existsSync(out + '/ready.json'), 'ready precedes admission');
      if (['success', 'input-failure'].includes(name) && !acted && fs.existsSync(out + '/reply-0.json')) {
        acted = true;
        await sender;
        const cap = JSON.parse(fs.readFileSync(out + '/menu-capture.json'));
        fs.writeFileSync(out + '/menu-review.json', JSON.stringify({...cap, review: 'offline input fixture'}));
        const key = production.requestReady(transport, out, 'step', {action: 'key', label: 'after-key', reviewRef: 'menu', keys: ['ArrowRight'], holdMs: 20, waitMs: 0}, 1000);
        if (name === 'input-failure') await assert.rejects(key, /command failed/);
        else {await key;await production.requestReady(transport, out, 'quit', {action: 'quit'}, 1000);break;}
      }
      await wait(5);
    }
    assert(fs.existsSync(out + '/cleanup.json'), 'whole composed driver must close');
    const end = await terminal;
    if (name === 'cancel') await wait(350); // observe the late startup continuation after closure
    const reply = sender ? await sender : null;
    const captures = effects.filter(e => e.method === 'chain.capture');
    const commands = fs.readdirSync(out + '/commands');
    if (before) {assert.equal(reply.ok, false);assert(captures.some(c => c.label === 'startup' && c.at > reply.at), 'baseline reproduces capture AFTER sender failure');}
    else if (name === 'success') {
      assert.equal(reply.ok, true);assert.deepEqual(captures.map(c => c.label), ['startup', 'menu', 'after-key']);
      assert(fs.existsSync(out + '/ready.json'));assert.equal(driverExit, 0);
    } else if (name === 'input-failure') {
      assert.deepEqual(captures.map(c => c.label), ['startup', 'menu']);assert.equal(driverExit, 1);
    } else {assert.equal(captures.length, 0, name + ' must prevent automatic capture');assert(!fs.existsSync(out + '/ready.json'));}
    if (!before) assert.equal(effects.filter(e => e.method === 'Page.captureScreenshot').length, name === 'success' ? 3 : name === 'input-failure' ? 2 : 0);
    if (['success', 'input-failure'].includes(name)) assert.deepEqual(effects.filter(e => e.method === 'Input.dispatchKeyEvent').map(e => e.type), ['keyDown', 'keyUp'], 'independent release survives failure; no subsequent DOWN');
    if (name === 'sender-timeout') {assert.equal(commands.length, 0);assert.equal(reply.ok, false);}
    if (!before) {
      const count = effects.length;
      for (const action of ['capture', 'key', 'click', 'pause-step'])
        await assert.rejects(production.requestReady(transport, out, 'later', {action, label: 'later', waitMs: 0}, 50), /closure/);
      assert.equal(effects.length, count);assert.equal(fs.readdirSync(out + '/commands').length, commands.length);
    }
    const report = {name, passed: true, composedSHA256: integrated.sha256, sender: reply, captures, commands,
      terminal: end, stdoutEOF: browser.stdout.readableEnded, stderrEOF: browser.stderr.readableEnded, driverExit,
      effects, deadline, scheduler: '100ms polls=2ms; 3000ms settle=40ms; unused 5000ms drain race=50ms; production deadlines unchanged'};
    assert(report.stdoutEOF && report.stderrEOF);
    fs.writeFileSync(run + '/control.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify({name, passed: true, captures: captures.map(c => c.label), terminal: end}));
  } finally {clearTimeout(cap);if (browser && browser.exitCode === null && browser.signalCode === null) browser.kill('SIGKILL');if (terminal) await terminal;}
}

async function main() {
  if (process.argv[2]) return fixture(process.argv[2]);
  for (const name of ['before', 'success', 'input-failure', 'legacy-queued', 'sender-timeout', 'sticky', 'first-failure', 'cleanup', 'capture-race', 'layout-race', 'early-exit', 'readiness-timeout', 'cancel']) {
    // Observable independent parent cap is armed before each fixture process.
    let child; const cap = setTimeout(() => child?.kill('SIGKILL'), 8000);
    child = cp.spawn(process.execPath, [__filename, name], {stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '', stderr = '';child.stdout.on('data', b => stdout += b);child.stderr.on('data', b => stderr += b);
    const terminal = await new Promise(resolve => child.once('close', (code, signal) => resolve({code, signal})));
    clearTimeout(cap);
    fs.writeFileSync(evidence + '/' + name + '-child.json', JSON.stringify({pid: child.pid, ...terminal, stdout, stderr, stdoutEOF: child.stdout.readableEnded, stderrEOF: child.stderr.readableEnded}));
    assert.equal(terminal.code, 0, name + ': ' + stderr);assert.equal(terminal.signal, null);process.stdout.write(stdout);
  }
}
main().catch(error => {console.error(error);process.exitCode = 1;});
