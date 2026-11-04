'use strict';
// These are actual-driver/protocol tests of a STOPPING preflight. They do not
// qualify a runnable observer composition or repeat the accepted native suite.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const cp = require('node:child_process');
const integration = require('../tools/mdk2-construction-driver-integration.cjs');
const EVIDENCE = path.join(integration.RUNS, '20261104-mdk2-construction-driver-integration');
fs.mkdirSync(EVIDENCE, {recursive: true});

function actualDriver() {
  const run = fs.mkdtempSync(path.join(EVIDENCE, 'protocol-'));
  const {file, source} = integration.compose(run);
  const end = source.indexOf('main().catch(');
  assert(end > 0); assert.equal(source.split('main().catch(').length, 2);
  const m = new Module(file, module); m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  // Export the actual functions before the sole bootstrap invocation. No
  // implementation substitution, new observer, or guest runtime is involved.
  m._compile(source.slice(0, end) + `module.exports={RUN,OUT,preload,command,main,inspectionGuard,
    pageForTest(p){page=p},haltForTest(){halted=true}};`, file);
  const api = m.exports;
  fs.mkdirSync(api.OUT); fs.mkdirSync(path.join(api.OUT, 'commands'));
  fs.writeFileSync(path.join(api.OUT, 'identity.json'), JSON.stringify({testOnly: 'offline protocol fixture'}));
  return {api, source, run};
}
function write(out, file, value) {fs.writeFileSync(path.join(out, file), JSON.stringify(value));}
function review(api) {
  const png = Buffer.from('OFFLINE PROTOCOL FIXTURE: no game pixels');
  const shot = {sha256: integration.sha(png), state: {main: {frozen: {steps: 3344}}}};
  fs.writeFileSync(path.join(api.OUT, 'construction.png'), png);
  write(api.OUT, 'commands/0.json', {action: 'shot', name: 'construction'});
  write(api.OUT, 'reply-0.json', {i: 0, ok: true});
  api.inspectionGuard.capture('construction', shot, 0);
  const {approve} = require(path.join(integration.RUNS, '20261104-mdk2-fresh-pending-scene/inspection-guard.cjs'));
  approve(api.OUT, {capture: 'construction', sha256: shot.sha256, steps: 3344,
    personallyInspected: true, inspector: 'offline protocol fixture only'});
}

test('exact retained closure and historical runtime pins resolve offline', () => {
  const rows = integration.verifyClosure(); assert.equal(rows.length, 15);
  const runtime = integration.pinnedRuntime(); assert.equal(runtime.pins.files.length, 432);
  assert.equal(runtime.pins.moduleFiles[0].sha256, 'cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee');
});

test('causal closure negatives reject missing dependency and same-length altered actual driver before composition', () => {
  const read = name => fs.readFileSync(path.join(integration.RUNS, name));
  assert.throws(() => integration.verifyClosure(name => {
    if (name === integration.DRIVER) throw Error('fixture: missing actual driver');
    return read(name);
  }), /missing actual driver/);
  assert.throws(() => integration.verifyClosure(name => {
    const bytes = read(name);
    if (name === integration.DRIVER) bytes[0] ^= 1;
    return bytes;
  }), /retained closure mismatch/);
});

test('positive actual composition compiles main/state/command/preload without invoking bootstrap', () => {
  const {api, source, run} = actualDriver();
  assert.equal(api.RUN, run); assert.equal(api.OUT, path.join(run, 'browser'));
  assert.equal(typeof api.main, 'function'); assert.equal(typeof api.command, 'function');
  assert.equal(integration.sha(api.preload), '12cedfe958c4fe2acc11dfdaf4a7e06843d4826b1cc0bd0bcf92639a161e7f7a');
  const original = require(path.join(integration.RUNS, integration.MAIN)).sourceForRun(run);
  assert.equal(source, original); // Includes the original first-failure/cleanup code.
  assert(!fs.existsSync(path.join(api.OUT, 'bootstrap-failure.json')));
});

test('actual driver admits exactly the reviewed 16-slice command and forwards its result', async () => {
  const {api} = actualDriver(), calls = [];
  review(api);
  const result = {ran: 16, timedOut: false, marker: 'offline frozen response'};
  api.pageForTest({evaluate: async (fn, n) => {calls.push({fn: fn.toString(), n}); return result;}});
  await api.command({action: 'step', n: 16}, 1);
  assert.equal(calls.length, 1); assert.equal(calls[0].n, 16);
  assert(calls[0].fn.includes('WineFrozen.step(n)'));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(api.OUT, 'step-1.json'))), result);
});

for (const failure of ['unreviewed', 'wrong-ack', 'failed-ack', 'changed-capture']) {
  test('actual driver rejects ' + failure + ' before a slice', async () => {
    const {api} = actualDriver(); let called = false;
    api.pageForTest({evaluate: async () => {called = true; throw Error('must not call');}});
    if (failure !== 'unreviewed') review(api);
    if (failure === 'wrong-ack') write(api.OUT, 'reply-0.json', {i: 9, ok: true});
    if (failure === 'failed-ack') write(api.OUT, 'reply-0.json', {i: 0, ok: false});
    if (failure === 'changed-capture') fs.appendFileSync(path.join(api.OUT, 'construction.png'), 'changed');
    await assert.rejects(api.command({action: 'step', n: 16}, 1));
    assert.equal(called, false);
  });
}

test('actual driver rejects incomplete response; terminal guard prevents later steps and input', async () => {
  const {api, source} = actualDriver(); review(api); let calls = 0;
  api.pageForTest({evaluate: async () => {calls++; return {ran: 15, timedOut: false};}});
  await assert.rejects(api.command({action: 'step', n: 16}, 1), /incomplete frozen step/);
  // main's unchanged catch performs this latch; assert its actual source too.
  assert(source.includes("catch(e){halted=true;save('reply-'+i+'.json',{i,ok:false"));
  api.haltForTest();
  await assert.rejects(api.command({action: 'step', n: 16}, 2), /first failure preserved/);
  await assert.rejects(api.command({action: 'keydown', key: 'Enter'}, 2), /first failure preserved/);
  assert.equal(calls, 1);
});

test('actual Worker injection occurs before resume; preload exception is terminal and never resumes', async () => {
  const {source, api} = actualDriver();
  const lo = source.indexOf("cdp.on('Target.attachedToTarget'");
  const hi = source.indexOf("await cdp.send('Target.setAutoAttach'", lo);
  assert(lo > 0 && hi > lo);
  for (const fault of [false, true]) {
    const sent = [], pending = [], logs = []; let handler;
    const session = {send: async (name, args) => {
      sent.push(name);
      if (name === 'Runtime.evaluate') {
        assert.equal(args.expression, api.preload);
        return fault ? {exceptionDetails: {text: 'offline preload failure'}} : {};
      }
    }};
    const context = {cdp: {on: (name, fn) => {handler = fn;}, connection: () => ({session: () => session})},
      pending, sessions: new Map(), preload: api.preload, sha: integration.sha, halted: false,
      log: (name, value) => logs.push({name, value})};
    vm.runInNewContext(source.slice(lo, hi), context);
    handler({sessionId: 'offline', targetInfo: {type: 'worker', targetId: 'owning-main'}, waitingForDebugger: true});
    await Promise.all(pending);
    assert.deepEqual(sent, fault ? ['Runtime.enable', 'Runtime.evaluate'] : ['Runtime.enable', 'Runtime.evaluate', 'Runtime.runIfWaitingForDebugger']);
    assert.equal(context.halted, fault);
    assert.equal(logs[0].name, fault ? 'first-failures.jsonl' : 'worker-preloads.jsonl');
  }
});

test('actual retained route has zero trace arming and no observer; STOP is not a runnable integration claim', () => {
  const report = integration.inspect();
  assert.equal(report.status, 'blocked-before-allocation');
  assert.equal(report.code, 'ORIGINAL_DRIVER_TRACE_DISABLED');
  assert.equal(report.actualDriver.existingTraceArmed, false);
  assert.equal(report.actualDriver.observerInstalled, false);
  assert.equal(report.actualDriver.mainWorkerModuleBinding, false);
  assert.throws(() => integration.assertRunnable(), /ORIGINAL_DRIVER_TRACE_DISABLED/);
});

test('actual CLI run entry fails before creating output or calling original main', () => {
  const future = path.join(EVIDENCE, 'must-never-allocate');
  assert(!fs.existsSync(future));
  const result = cp.spawnSync(process.execPath, [path.join(integration.ROOT, 'tools/mdk2-construction-driver-integration.cjs'), '--run', future],
    {cwd: integration.ROOT, encoding: 'utf8'});
  assert.equal(result.status, 2); assert(result.stderr.includes('ORIGINAL_DRIVER_TRACE_DISABLED'));
  assert(!fs.existsSync(future));
});
