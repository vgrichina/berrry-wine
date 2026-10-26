'use strict';
// Offline wiring tests. Execute the generated runner's complete post-validation
// setup through its new boundary, with real applyMain/adapter/native guard.
// Loaded-memory validation, VFS and guest instructions are host fixture seams.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {transform, INPUT_SHA256} = require('../tools/maelstrom-initialized-runner-arm.cjs');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const [capturePath, fixtureRoot] = process.argv.slice(2);
assert(capturePath && fixtureRoot, 'usage: TEST CAPTURE_RUN_JS PINNED_MODE_TRANSITION_REPO');
const captured = fs.readFileSync(capturePath), source = captured.toString('utf8');
const {output, receipt} = transform(captured), generated = output.toString('utf8');
const fixturePath = path.join(fixtureRoot, 'test/test-maelstrom-mode-transition.cjs');
const fixtureText = fs.readFileSync(fixturePath, 'utf8');
assert.equal(sha(fixtureText), '57758fa0a9b6d769fce63d873a2ebf7aca3fb62f18f1c7298d5e309054384491');
const prefix = fixtureText.slice(0, fixtureText.indexOf("test('authentic early-start ordering"));
assert(prefix.length > 5000 && prefix.length < 16000);
// Reuse the accepted fixture construction, not its 29 already-passing cases.
// Its pinned source checks execute unchanged; this builds only its 4-page module.
const fixtureContext = {require: createRequire(fixturePath), __dirname: path.dirname(fixturePath),
  module: {exports: {}}, Buffer, WebAssembly, console, process};
vm.runInNewContext(prefix + '\nmodule.exports={fresh,finish,createAdapter,createRunnerExperiments,moduleSHA256:sha(moduleBytes),watSHA256:sha(wat),pins};',
  fixtureContext, {filename: fixturePath, timeout: 30000});
const fixture = fixtureContext.module.exports;
const results = [];
async function test(name, fn) {
  if (process.env.MAELSTROM_TEST_FILTER && !new RegExp(process.env.MAELSTROM_TEST_FILTER).test(name)) return;
  await fn(); results.push({name, pass: true});
}
const ARM = '  // Arm after mapping/validation/setup, before DLL or main guest execution.\n' +
  '  try {\n    nativeAdapter.start();\n' +
  "  } catch (error) { nativeRaw('first-loader-or-start-rejection', error); throw error; }\n";
const boundary = '  for (let batch = 0; batch < MAX_BATCHES && !stopped; batch++) {\n';
const setup = text => text.slice(text.indexOf('  let nativeAdapter;\n'), text.indexOf(boundary));
function makeHarness({flags = [], fail = null, enabledSetup = false, text = generated} = {}) {
  const real = fixture.fresh(), events = [], rows = [];
  let armed = false, runs = 0, startCalls = 0;
  const failAt = name => { if (fail === name) throw new Error('fixture failure: ' + name); };
  const exported = {...real.exports,
    get_eax: () => 0, get_esp: () => 0, get_eip: () => 0,
    run: () => { assert(armed, 'guest execution before arm'); events.push('run'); runs++; }};
  exported.set_uop = mode => { events.push('set_uop:' + mode); failAt('set_uop'); real.exports.set_uop(mode); };
  const e = new Proxy(exported, {get(target, name) {
    if (name in target) return target[name];
    if (enabledSetup && typeof name === 'string' && name.startsWith('set_')) return (...args) => {
      events.push(name + ':' + args.join(',')); assert(!armed, 'setup setter after arm'); failAt(name);
    };
  }});
  const instance = {exports: e};
  const host = {};
  // Explicit fixture defaults for the frozen runner's option globals. Full input
  // hash rejection prevents silently extending this harness to a changed runner.
  for (const name of setup(text).match(/\b[A-Z][A-Z_0-9]+\b/g) || []) host[name] = false;
  Object.assign(host, {instance, memory: real.exports.memory, moduleBases: {},
    console: {log() {}}, Buffer, JSON, WATCH_VALUE: null, WATCH_START_BATCH: 0,
    HANDLER_HIST_THREADS: [], hasFlag: () => false, signalExitWake: null,
    startupDllStage: null,
    onFailure: () => { events.push('failure-hook'); failAt('failure-hook'); },
    performance: {now: () => { events.push('execution-clock'); failAt('execution-clock'); return 1; }},
    nativeFile: 'fixture-record', fs: {appendFileSync: (file, data) => {
      assert.equal(file, 'fixture-record.raw.jsonl');
      assert.equal(JSON.parse(data).stage, 'loaded-verified'); events.push('persist-verified');
    }},
    ctx: {vfs: fail === 'vfs-seed' ? {} : null}, apiLogOff: enabledSetup,
    getArg: (name, fallback = null) => fallback,
    nativeRaw: (stage, error) => events.push('raw:' + stage + (error ? ':error' : '')),
    deferredResolveAddrs: () => { events.push('resolve'); failAt('resolve'); },
    seedExeImage: () => { failAt('vfs-seed'); throw new Error('unexpected VFS fixture'); },
    exeBytes: Buffer.alloc(0), path, EXE_PATH: 'fixture.exe', EXE_GUEST_PATH: 'c:\\fixture.exe',
    require: name => { assert.equal(name, '../tools/disasm'); return {disasmAt() { throw new Error('unexpected disassembly'); }}; },
    nativeDiagnostic: {
      verifyLoaded: () => { events.push('verify'); failAt('verify'); return {fixture: true}; },
      createAdapter: (i, options) => {
        events.push('create'); failAt('create');
        const actual = fixture.createAdapter(i, {...options, persist: row => rows.push(row)});
        return {start: () => { startCalls++; events.push('start'); failAt('start'); const ret = actual.start(); armed = true; return ret; },
          observe: batch => { events.push('observe:' + batch); return actual.observe(batch); }};
      },
    },
    experiments: fixture.createRunnerExperiments({hasFlag: n => flags.includes(n),
      getArg: (n, fallback = null) => fallback, env: {}, log() {}, appPolicy: () => null})});
  if (enabledSetup) Object.assign(host, {TRACE_CALLSTACK: true, FAULT_NULL_MODE: 2,
    TRACE_WIN16_DDE: true, TRACE_WIN16: true, FLIP_VSYNC: true, PRESENT_CAP: 60,
    PRESENT_PACE_MODE: 1, NO_SPIN_PARK: true, SPIN_WORK_MAX: 12, SPIN_REGS_CHECK: 1,
    TRACE_FPU: true, TRACE_CODE_WRITES: true, TRACE_CODE_WRITES_ALL: true});
  const context = vm.createContext(host);
  return {real, e, events, rows, context, get runs() {return runs;}, get starts() {return startCalls;},
    initialize: () => vm.runInContext('(async()=>{\n' + setup(text) +
      '\nreturn {nativeAdapter, originalNativeObserve};})()', context, {timeout: 3000})};
}
async function main() {
  await test('deterministic staged replacements preserve all other bytes', () => {
    assert(output.equals(transform(captured).output));
    const {offset, beforeBytes, afterBytes, beforeSHA256, afterSHA256} = receipt.replacement;
    assert.equal(sha(captured.subarray(offset, offset + beforeBytes)), beforeSHA256);
    let restored = generated;
    for (const edit of [...receipt.additionalReplacements].reverse()) {
      assert.equal(sha(edit.before), edit.beforeSHA256); assert.equal(sha(edit.after), edit.afterSHA256);
      assert.equal(restored.indexOf(edit.after), restored.lastIndexOf(edit.after));
      restored = restored.replace(edit.after, edit.before);
    }
    assert.equal(sha(Buffer.from(restored).subarray(offset, offset + afterBytes)), afterSHA256);
    const back = restored.replace(ARM, '').replace(
      "  }catch(error){nativeRaw('first-loader-or-start-rejection',error);throw error;}",
      "    nativeAdapter.start();\n  }catch(error){nativeRaw('first-loader-or-start-rejection',error);throw error;}");
    assert.equal(back, source);
    assert.equal(receipt.armCount, 1);
    assert.equal(receipt.outputSHA256, sha(output));
  });
  for (const [name, mutate] of [
    ['empty', () => Buffer.alloc(0)], ['truncated', b => b.subarray(0, -1)],
    ['appended', b => Buffer.concat([b, Buffer.from('\n')])],
    ['loader', b => Buffer.from(b.toString().replace('nativeDiagnostic.verifyLoaded', 'nativeDiagnostic.ignoreLoaded'))],
    ['mode initialization', b => Buffer.from(b.toString().replace('experiments.applyMain', 'experiments.recordInherited'))],
    ['arming', b => Buffer.from(b.toString().replace('nativeAdapter.start();', 'nativeAdapter.start();nativeAdapter.start();'))],
    ['observation', b => Buffer.from(b.toString().replace('originalNativeObserve(batch);', '/* removed */'))],
    ['already corrected', () => output], ['non-buffer', () => source], ['null', () => null],
  ]) await test('reject ' + name + ' input', () => assert.throws(() => transform(mutate(captured)), /SHA-256 mismatch/));
  await test('generated runner parses with its authentic top-level context', () => {
    new vm.Script(generated, {filename: 'corrected-run.js'});
  });
  await test('sole arm follows all setup setters and precedes all three main run sites', () => {
    const arm = generated.indexOf('    nativeAdapter.start();');
    assert(arm > generated.indexOf('experiments.applyMain(instance'));
    assert(arm > generated.indexOf('instance.exports.set_code_write_trace(TRACE_CODE_WRITES_ALL'));
    assert(generated.indexOf('nativeDiagnostic.verifyLoaded') < arm);
    assert(generated.indexOf('nativeDiagnostic.createAdapter') < arm);
    const calls = [...generated.matchAll(/instance\.exports\.run\(BATCH_SIZE\)/g)];
    assert.equal(calls.length, 3); assert(calls.every(m => m.index > arm));
    assert.equal((generated.match(/originalNativeObserve\(batch\);/g) || []).length, 3);
    assert(generated.indexOf('for (let batch = 0;') > arm);
    assert(generated.indexOf('instance.exports.fire_mm_timer()') > arm);
  });
  for (const [name, flags, mode] of [['default', [], 1], ['explicit no-uop', ['no-uop'], 0]]) {
    await test(name + ': actual complete generated setup arms exactly once after real applyMain', async () => {
      const h = makeHarness({flags}); const api = await h.initialize();
      assert.equal(h.starts, 1); assert.equal(h.runs, 0); assert.equal(h.e.get_uop(), mode);
      assert.equal(h.e.mne_rejectReason(), 0);
      assert(h.events.indexOf('verify') < h.events.indexOf('create'));
      assert(h.events.indexOf('create') < h.events.indexOf('resolve'));
      assert(h.events.indexOf('resolve') < h.events.indexOf('start'));
      if (mode) assert(h.events.indexOf('set_uop:1') < h.events.indexOf('start'));
      fixture.finish(h.e); assert.equal(api.originalNativeObserve(0), undefined);
      assert.equal(h.rows.at(-1).kind, 'captured');
    });
  }
  await test('enabled later setup setters all finish before sole arming', async () => {
    const h = makeHarness({enabledSetup: true}); await h.initialize();
    assert.equal(h.starts, 1); assert.equal(h.runs, 0);
    const late = h.events.indexOf('set_code_write_trace:2');
    assert(late > h.events.indexOf('set_uop:1')); assert(late < h.events.indexOf('start'));
    assert(h.events.includes('set_present_pace_mode:1'));
  });
  for (const failure of ['verify','create','resolve','vfs-seed','set_uop','set_code_write_trace','failure-hook','execution-clock']) {
    await test('setup failure ' + failure + ' never arms or runs', async () => {
      const h = makeHarness({fail: failure, enabledSetup: true});
      await assert.rejects(h.initialize(), new RegExp('fixture failure: ' + failure));
      assert.equal(h.starts, 0); assert.equal(h.runs, 0);
    });
  }
  await test('start failure propagates with one diagnostic and no retry or run', async () => {
    const h = makeHarness({fail: 'start'});
    await assert.rejects(h.initialize(), /fixture failure: start/);
    assert.equal(h.starts, 1); assert.equal(h.runs, 0);
    assert.equal(h.events.filter(e => e === 'raw:first-loader-or-start-rejection:error').length, 1);
  });
  await test('unchanged original early arming fails under the same real default setup', async () => {
    const h = makeHarness({text: source}), api = await h.initialize();
    assert.equal(h.e.mne_rejectReason(), 15);
    assert.throws(() => api.originalNativeObserve(0), /status rejection/);
    assert.equal(h.runs, 0);
  });
  await test('active select mode change still rejects through generated observation wiring', async () => {
    const h = makeHarness(), api = await h.initialize();
    h.e.fixture_enter(); h.e.set_uop(0);
    assert.equal(h.e.mne_rejectReason(), 15);
    assert.throws(() => api.originalNativeObserve(0), /status rejection/);
    assert(h.events.includes('raw:first-latch-rejection:error'));
    assert.equal(h.starts, 1);
  });
  const runBlocks = [
    generated.match(/if \(!mainExecutionSuspended\(\)\) \{ instance\.exports\.run\(BATCH_SIZE\); originalNativeObserve\(batch\); \}/)[0],
    ...[...generated.matchAll(/let originalNativeReturned=false;\n\s+try \{ instance\.exports\.run\(BATCH_SIZE\); originalNativeReturned=true; \} catch \(e\) \{[^}]*\}\n\s+if\(originalNativeReturned\) originalNativeObserve\(batch\);/g)].map(m => m[0]),
  ];
  assert.equal(runBlocks.length, 3);
  for (let site = 0; site < runBlocks.length; site++) await test('real after-run site ' + (site + 1) + ' observes only after successful synthetic run', async () => {
    const h = makeHarness(), api = await h.initialize(); fixture.finish(h.e);
    Object.assign(h.context, {originalNativeObserve: api.originalNativeObserve, BATCH_SIZE: 1, batch: site,
      mainExecutionSuspended: () => false});
    vm.runInContext('for(let fixtureOnce=0;fixtureOnce<1;fixtureOnce++){\n' + runBlocks[site] + '\n}', h.context);
    assert.equal(h.runs, 1); assert.equal(h.starts, 1);
    assert(h.events.indexOf('start') < h.events.indexOf('run'));
    assert(h.events.indexOf('run') < h.events.indexOf('observe:' + site));
    assert.equal(h.rows.at(-1).kind, 'captured');
  });
  console.log(JSON.stringify({schema: 'maelstrom-initialized-runner-wiring-tests/v1', pass: true,
    count: results.length, results, captureSHA256: sha(captured), generatedSHA256: sha(output),
    toolSHA256: sha(fs.readFileSync(path.join(__dirname, '../tools/maelstrom-initialized-runner-arm.cjs'))),
    fixtureSHA256: sha(fixtureText), moduleSHA256: fixture.moduleSHA256, watSHA256: fixture.watSHA256,
    pins: fixture.pins, prior29CasesReplayed: false, prior29SourceCommit: '5a80f7c43ed4a44bec559f5f1e9f9eb9f7d5e8d6',
    peakRSS: process.resourceUsage().maxRSS * 1024, guestInstructionsExecuted: 0,
    qualification: 'offline complete main-setup wiring; separate preinitializer tests cover staged archived loader'}));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
