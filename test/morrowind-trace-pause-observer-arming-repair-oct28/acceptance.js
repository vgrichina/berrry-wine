'use strict';
// Execute unmodified production statements/hooks in a bounded synthetic host.
// This does not instantiate a module or execute the game/initializers.
const fs = require('fs'), path = require('path'), vm = require('vm');
const assert = require('assert/strict'), crypto = require('crypto');
const { createRequire } = require('module');
const root = path.resolve(__dirname, '../..');
const runner = fs.readFileSync(path.join(root, 'test/run.js'), 'utf8');
const { workerApiShouldLog, makeWorkerApiLogger } = require('../../lib/worker-imports');
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const pins = JSON.parse(fs.readFileSync(path.join(__dirname, 'source-pins.json')));
assert.equal(hash(runner), pins.runnerSHA256);
assert.equal(hash(fs.readFileSync(process.argv[2])), pins.exeSHA256);
const slice = (a, b, source = runner) => {
  const x = source.indexOf(a), y = source.indexOf(b, x);
  assert(x >= 0 && y > x, a); return source.slice(x, y);
};
const parser = slice('const getArg = (name, def) => {', '// Was `--name=...`');
const traceFlags = slice('const TRACE_API_RAW =', 'const TRACE_MOUSE_STATE =');
const traceState = slice('  let traceApiOn =', '\n  // The WAT counter');
const dedupState = slice('  let dedupLast =', '\n  let inputEvent =');
const arbitration = slice('  const apiLogRequired =', '\n  h.log = ');
const control = slice("    if (cmd.action === 'trace-api') {", "    if (cmd.action === 'eval')");
const reset = 'if (apiLogOff && instance.exports.set_api_log) instance.exports.set_api_log(0);';
const resets = [...runner.matchAll(new RegExp(reset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))];
assert.equal(resets.length, 2);
assert(resets[0].index < runner.indexOf('// MORROWIND_NAME_ATTACH_BEGIN'));
assert(resets[1].index > runner.indexOf('// MORROWIND_NAME_ATTACH_END'));
const inheritedReset = slice("  if (apiLogOff) inheritWasm('set_api_log', 0);", '\n', runner);
const probePath = path.join(root, 'tools/probes/morrowind-name-observer-contracts.js');
const probe = fs.readFileSync(probePath, 'utf8');
assert.equal(hash(probe), '09a9a3254dc35a050f8d5e28f7d00d90295cb53e6e311477d03e0407ef0358e6');
const prefix = probe.slice(0, probe.indexOf('// First behavioral group:'));
const scaffold = prefix.replace("  for (const marker of ['IMPORT', 'ATTACH']) {",
  "  configure(context);\n  for (const marker of ['IMPORT', 'ATTACH']) {\n    if (marker === 'ATTACH') beforeAttach(context);")
  .replace('observer: context.morrowindNameObserver }', 'context, observer: context.morrowindNameObserver }');
assert.notEqual(scaffold, prefix);
let configure;
const sandbox = { require: createRequire(probePath), __dirname: path.dirname(probePath),
  process: { argv: ['node', probePath, process.argv[2]] }, Buffer, console, configure: c => configure(c),
  beforeAttach: c => { evaluate(reset, c); evaluate(inheritedReset, c); } };
vm.runInNewContext(scaffold + '\nglobalThis.fixture=fixture', sandbox, { timeout: 5000 });
const evaluate = (code, c) => vm.runInNewContext(code, c, { timeout: 1000 });
const cases = [];
function fixture(argv, consumers = {}, mutate = null, options = {}) {
  const sequence = [], inherited = [], workers = [];
  configure = c => {
    Object.assign(c, { args: argv, TRACE_API_COUNTS: false, ESP_AUDIT: false, apiLogOff: false,
      apiWatSeen: 0, tickState: { batch: 7 }, threadManager: { threads: new Map([
        [1, { instance: { exports: { set_api_log: n => workers.push(n) } } }],
        [2, { instance: null }], [3, { instance: { exports: {} } }]]) },
      inheritWasm: (...a) => inherited.push(a), flushDedup: () => {},
      readStr: () => '', hex: n => '0x' + (n >>> 0).toString(16),
      apiByName: new Map(), fmtApiCall: () => 'ExampleApi()', fmtApiRet: () => '',
      fmtApiOutParams: () => '', STRING_APIS: [], TRACE_DX: false, TRACE_STACK: false,
      TRACE_SEH: false, lastApiTraced: false, lastApiEntry: null, lastApiArgs: null,
      lastTreeItemTrace: null, pendingSyncBail: null, pendingCodeRetire: null,
      pendingCodeWrite: null, pendingCodeMiss: null, pendingFpu: null, pendingWin16: null,
      onFailure: () => {} });
    const flags = evaluate(parser + '\n' + traceFlags + '\n({hasFlag,TRACE_API,TRACE_API_PAUSED,TRACE_API_FILTER,TRACE_API_DEDUP,TRACE_API_COUNTS})', { args: argv });
    Object.assign(c, flags, { QUIET_API: flags.hasFlag('quiet-api') }, consumers);
    const orig = c.instance.exports.set_api_log;
    c.instance.exports.set_api_log = n => { sequence.push(n); orig(n); };
    c.instance.exports.get_api_calls = () => c.watCalls || 0;
    evaluate(traceState, c);
    evaluate(dedupState, c);
    evaluate(mutate === 'drop-observer' ? arbitration.replace("hasFlag('observe-morrowind-name')", 'false') : arbitration, c);
  };
  const f = sandbox.fixture(undefined, options), c = f.context;
  evaluate(runner.slice(resets[1].index, resets[1].index + reset.length), c);
  const pause = on => {
    c.cmd = { action: 'trace-api', on };
    return evaluate('(function(){' + (mutate === 'old-control' ? control
      .replace('!!apiLogRequired(on)', 'on') : control) + '})()', c);
  };
  return { ...f, c, sequence, workers, inherited, pause };
}
function check(label, body) { body(); cases.push(label); }
const exactArgv = ['--quiet-api', '--observe-morrowind-name', '--trace-api', '--trace-api-paused'];
// First candidate behavior: same argv, exact control boundary as the rejection.
check('earliest exact pause counterexample corrected', () => {
  const f = fixture(exactArgv); assert(f.observer); assert.deepEqual(f.sequence, [1]);
  assert.equal(f.pause(false).traceApi, false);
  assert.deepEqual(f.sequence, [1, 1]); assert.equal(f.e.apiLog, 1);
  assert.equal(f.c.apiLogOff, false); assert.deepEqual(f.workers, [1]);
  assert.deepEqual(f.inherited, [['set_api_log', 1]]);
});
for (const quiet of [false, true]) for (const observer of [false, true])
  for (const trace of [false, true]) for (const paused of [false, true]) {
    const argv = [...(quiet ? ['--quiet-api'] : []), ...(observer ? ['--observe-morrowind-name'] : []),
      ...(trace ? ['--trace-api'] : []), ...(paused ? ['--trace-api-paused'] : [])];
    check('startup ' + JSON.stringify(argv), () => {
      const f = fixture(argv); assert.equal(!!f.observer, observer);
      assert.equal(f.c.apiLogOff, quiet && !observer && (!trace || paused));
      if (!observer) { assert.equal(f.reads.length, 0); assert.equal(f.records.length, 0); }
      if (trace && paused) {
        for (const on of [false, true, true, false, false, true, false]) {
          assert.equal(f.pause(on).traceApi, on);
          assert.equal(f.c.apiLogOff, quiet && !observer && !on);
          assert.equal(f.sequence.at(-1), quiet && !observer && !on ? 0 : 1);
          assert.equal(f.workers.at(-1), f.sequence.at(-1));
          assert.equal(f.inherited.at(-1)[1], f.sequence.at(-1));
        }
      } else {
        const before = f.sequence.slice(); assert.throws(() => f.pause(false), /trace-api needs/);
        assert.deepEqual(f.sequence, before);
      }
    });
  }
for (const consumer of [{ TRACE_API_COUNTS: true }, { TRACE_CRITICAL: true },
  { TRACE_INPUT_DISPATCH: true }, { ESP_DELTA: true }, { ESP_AUDIT: true }, { breakApis: ['ExampleApi'] }]) {
  check('required consumer ' + JSON.stringify(consumer), () => {
    const f = fixture(['--quiet-api', '--trace-api', '--trace-api-paused'], consumer);
    assert.equal(f.c.apiLogOff, false);
    f.pause(false); f.pause(true); f.pause(false);
    assert.deepEqual(f.sequence, [1, 1, 1]); assert.deepEqual(f.workers, [1, 1, 1]);
  });
}
check('memory tracing alone retains startup arming; coupled trace pauses', () => {
  const mem = { TRACE_API_MEM: [{ name: 'ExampleApi', arg: 0, len: 0 }] };
  assert.equal(fixture(['--quiet-api'], mem).c.apiLogOff, false);
  const f = fixture(['--quiet-api', '--trace-api', '--trace-api-paused'], mem);
  assert.equal(f.c.apiLogOff, true); f.pause(true); assert.equal(f.c.apiLogOff, false);
  f.pause(false); assert.equal(f.c.apiLogOff, true);
});
check('WAT count folding follows physical logger transitions', () => {
  const f = fixture(['--quiet-api', '--trace-api', '--trace-api-paused']);
  f.c.watCalls = 10; f.pause(false); assert.equal(f.c.apiCount, 0);
  f.pause(true); assert.equal(f.c.apiCount, 10); f.pause(true); assert.equal(f.c.apiCount, 10);
  f.c.apiCount += 3; f.pause(false); f.c.watCalls = 15; f.pause(true);
  assert.equal(f.c.apiCount, 18);
  const g = fixture(exactArgv); g.c.watCalls = 10; g.pause(false); g.pause(true);
  assert.equal(g.c.apiCount, 0); assert.equal(g.c.apiWatSeen, 0);
});
function call(f) {
  const c = f.c; c.apiTable[0].name = 'ExampleApi';
  f.u32(f.r.esp, 0x406926);
  new Uint8Array(c.memory.buffer).set(Buffer.from('<ord>\0'));
  c.h.log_i32(0xc0de0000); c.h.log(0, 5); c.h.log_api_exit();
}
check('actual API hooks suppress trace entry/return/memory while observer remains active', () => {
  const f = fixture(exactArgv, { TRACE_API_MEM: [{ name: 'ExampleApi', arg: 0, len: 0 }] });
  f.c.logs.length = 0; call(f); assert.equal(f.c.logs.length, 0);
  f.pause(true); f.c.logs.length = 0; call(f);
  assert(f.c.logs.some(x => x.startsWith('[API #')));
  assert(f.c.logs.some(x => x.includes('raw EAX')));
  assert(f.c.logs.some(x => x.startsWith('[api-mem]')));
  f.pause(false); f.c.logs.length = 0; call(f); assert.equal(f.c.logs.length, 0);
  assert.equal(f.e.apiLog, 1); assert(f.observer);
});
check('pause between entry/exit suppresses pending trace return', () => {
  const f = fixture(exactArgv); f.pause(true);
  f.u32(f.r.esp, 0x406926);
  f.c.apiTable[0].name = 'ExampleApi'; new Uint8Array(f.c.memory.buffer).set(Buffer.from('<ord>\0'));
  f.c.h.log_i32(0xc0de0000); f.c.h.log(0, 5); f.pause(false);
  f.c.logs.length = 0; f.c.h.log_api_exit(); assert.equal(f.c.logs.length, 0);
});
check('observer actual API entry/exit and EIP callbacks survive pause', () => {
  const f = fixture(exactArgv); f.pause(false); f.c.logs.length = 0;
  f.builder(); f.poll();
  assert(f.records.some(x => x.kind === 'poll-entry'));
  assert(f.records.some(x => x.kind === 'poll-completion' && x.actualHook === 'log_api_exit'));
  assert(f.records.some(x => x.kind === 'poll-return-boundary'));
  assert(!f.records.some(x => x.kind === 'unavailable'));
  assert.equal(f.e.apiLog, 1);
});
check('worker production callbacks pause entries and pending returns, resume filtered trace', () => {
  const f = fixture(['--quiet-api', '--trace-api=ExampleApi', '--trace-api-paused']);
  Object.assign(f.c, { workerApiShouldLog });
  const shouldLog = evaluate(slice('      shouldLog: (name) => workerApiShouldLog(', '\n      formatValue:')
    .trim().replace(/^shouldLog: /, '').replace(/,$/, ''), f.c);
  const emit = evaluate('(' + slice('      emit: (line) => { if (traceApiOn)', '\n    });')
    .trim().replace(/^emit: /, '').replace(/,$/, '') + ')', f.c);
  const buffer = Buffer.from('ExampleApi\0');
  const logger = makeWorkerApiLogger({ getBuffer: () => buffer.buffer,
    threadId: 2, shouldLog, emit });
  const entry = () => logger.log(buffer.byteOffset, 11);
  f.c.logs.length = 0; entry(); logger.log_i32(9); assert.equal(f.c.logs.length, 0);
  f.pause(true); f.c.logs.length = 0; entry(); logger.log_i32(9);
  assert(f.c.logs.some(x => x.startsWith('[API T2]')));
  assert(f.c.logs.some(x => x.includes('=>')));
  entry(); f.pause(false); f.c.logs.length = 0; logger.log_i32(9); entry();
  assert.equal(f.c.logs.length, 0);
  f.pause(true); f.c.logs.length = 0; entry(); assert.equal(f.c.logs.length, 1);
});
check('nonquiet legacy API lines still flow while detailed trace paused', () => {
  const f = fixture(['--trace-api', '--trace-api-paused']); call(f);
  assert(f.c.logs.includes('[API] ExampleApi')); assert.equal(f.c.apiLogOff, false);
});
check('deduplicated trace flushes before pause response without leaking into paused calls', () => {
  const f = fixture([...exactArgv, '--trace-api-dedup']); f.pause(true); f.c.logs.length = 0;
  evaluate('pushApi("same"); pushApi("same");', f.c);
  f.pause(false);
  assert.equal(f.c.logs[1], '  (x2)'); assert(f.c.logs[2].startsWith('[trace-api] paused'));
  f.c.logs.length = 0; call(f); assert.equal(f.c.logs.length, 0);
});
check('histogram counts and independent diagnostic markers still work while trace paused', () => {
  const counts = new Map(); const f = fixture(exactArgv, { TRACE_API_COUNTS: true, apiCounts: counts });
  f.pause(false); f.c.logs.length = 0; call(f); assert.equal(counts.get('ExampleApi'), 1);
  f.c.h.log_i32(0xcade5000);
  for (const n of [1, 2, 3, 4, 5, 6]) f.c.h.log_i32(n);
  assert(f.c.logs.some(x => x.startsWith('[sync] ABANDONED')));
});
check('observer installation failures remain fatal', () => {
  assert.throws(() => fixture(exactArgv, {}, null, { corruptLoaded: true }), /loaded code/);
  assert.throws(() => fixture(exactArgv, {}, null, { trace: [1, 2] }), /conflicts/);
});
check('optional logger/counter/thread exports and throwing setters keep control failure semantics', () => {
  const f = fixture(['--quiet-api', '--trace-api', '--trace-api-paused']);
  delete f.e.set_api_log; delete f.e.get_api_calls; f.c.threadManager = null;
  assert.equal(f.pause(true).traceApi, true);
  const g = fixture(['--quiet-api', '--trace-api', '--trace-api-paused']);
  g.e.set_api_log = () => { throw Error('setter failed'); };
  const before = g.inherited.length; assert.throws(() => g.pause(true), /setter failed/);
  assert.equal(g.inherited.length, before);
});
const rejecting = [];
for (const mutation of ['old-control', 'drop-observer']) {
  const f = fixture(exactArgv, {}, mutation); f.pause(false);
  assert.equal(f.e.apiLog, 0); assert(f.observer);
  assert.throws(() => assert.equal(f.e.apiLog, 1), assert.AssertionError);
  rejecting.push({ mutation, sequence: f.sequence, inherited: f.inherited, rejected: true });
}
{
  const f = fixture(exactArgv); f.pause(false); f.c.logs.length = 0;
  const hooks = slice('  h.log = (ptr, len) => {', '  let prevBlockEsp');
  evaluate(hooks.replace('if (traceApiOn && (!TRACE_API_FILTER', 'if (TRACE_API && (!TRACE_API_FILTER'), f.c);
  call(f); assert(f.c.logs.some(x => x.startsWith('[API #')));
  assert.throws(() => assert.equal(f.c.logs.length, 0), assert.AssertionError);
  rejecting.push({ mutation: 'remove-trace-visibility-gate', rejected: true });
}
console.log(JSON.stringify({ status: 'PASS_SOURCE_BOUNDARY', runnerSHA256: hash(runner),
  exeSHA256: hash(fs.readFileSync(process.argv[2])), cases, rejecting,
  fragments: Object.fromEntries(Object.entries({ parser, traceFlags, traceState, dedupState, arbitration, control, prefix, scaffold })
    .map(([k, v]) => [k, hash(v)])),
  scope: 'Exact production CLI, startup arbitration, import/attach, both resets, inherited reset, control and API entry/exit hooks in synthetic fixture. No full runner, initializers, module, guest, browser or correlation groups.' }, null, 2));
