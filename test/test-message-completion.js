'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { createMessageBoundaryTrace } = require('./message-boundary-trace');
const { createMessageCompletionOwner } = require('./message-completion-owner');
const { extract, parse, machine } = require('./wat-completion-function-fixture');
const root = path.resolve(__dirname, '..'), sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const runner = read('test/run.js');
const sourceFiles = ['src/09a5-handlers-window.wat', 'src/09a5b-handlers-window-late.wat', 'src/09a-handlers4-late.wat'];
const sources = sourceFiles.map(read);
const names = ['handle_GetMessageA', 'handle_GetMessageW', 'handle_PeekMessageA', 'handle_PeekMessageW',
  'handle_GetMessage_observed', 'handle_PeekMessage_observed', 'keyboard_hook_begin',
  'getmessage_hook_begin', 'getmessage_hook_continue', 'keyboard_hook_finish'];
const excerpts = Object.fromEntries(names.map(n => {
  const source = sources.find(s => s.includes('(func $' + n + ' ') || s.includes('(func $' + n + '\n'));
  return [n, extract(source, n)];
}));
function slice(s, a, b) { const start = s.indexOf(a), end = s.indexOf(b, start); assert(start >= 0 && end > start); return s.slice(start, end); }
const installation = slice(runner, '  // BEGIN message-boundary installation:', '  // END message-boundary installation');
const qualification = slice(runner, '  ctx.exports = instance.exports;', '  // Quiet runs silence');
const originalFunctions = JSON.parse(read('test/fixtures/enigma-message-original-functions.json')).functions;
const parsedCurrent = Object.fromEntries(Object.entries(excerpts).map(([n, text]) => ['$' + n, parse(text)]));
const parsedOriginal = Object.fromEntries(Object.entries(originalFunctions).map(([n, text]) => ['$' + n, parse(text)]));
function harness({ on = true, moduleWire = true, install = installation, qualify = qualification, mutate = null,
  legacy = false, pumpError = new Error('real pump error sentinel') } = {}) {
  const memory = new Uint8Array(65536), dv = new DataView(memory.buffer), logs = [], order = [], calls = [];
  const g = { $reg_base: 64, $DISPDIB_STATE: 32, $message_completion_on: 0, $message_completion_active: 0,
    $yield_flag: 0, $code16: 0, $current_thread_id: 1, $hook_active_node: 7,
    $font_enum_ret_thunk: 0xcaca0011 | 0, $steps: 100, $eip: 777, $msg_extra_info: 5 };
  const exports = { get_image_base: () => 0 };
  if (moduleWire) exports.set_message_completion = n => { g.$message_completion_on = n; order.push('enable'); };
  const h = { log_api_exit() { order.push('unrelated-exit'); return 123; },
    message_begin: () => 0, message_park() {}, message_bind() {}, message_resume: () => 0, message_complete() {} }, ctx = {};
  const f = new Function('require', 'createMessageBoundaryTrace', 'TRACE_MESSAGE_BOUNDARY', 'logs', 'memory', 'instance', 'translateGuest', 'h', 'ctx',
    'const tickState={batch:17};\n' + install + '\n' + qualify + '\nreturn {trace:messageBoundaryTrace,owner:messageCompletionOwner};');
  const out = f(require, createMessageBoundaryTrace, on, logs, memory, { exports }, n => n, h, ctx);
  out.trace.arm(true);
  // This fixture initializer proves only the extracted installation order, not
  // a canonical guest initializer or module execution.
  order.push('fixture-initializer');
  let nextHook = 0, mode = 'immediate', result = 1;
  const load = n => dv.getInt32(n, true), store = (n, v) => dv.setInt32(n, v, true);
  const stubs = {
    $gl32: load, $gs32: store, $dispdib_present() {}, $omitted_wire: () => 0,
    $getmessage_hook_take: () => { const n = nextHook; nextHook = 0; return n; },
    $hook_node_proc: () => 9000, $hook_dispatch_enter: () => 8000,
    $hook_dispatch_leave: () => order.push('keyboard-leave'), $getmessage_hook_leave: () => order.push('getmessage-leave'),
  };
  for (const [name, fn] of Object.entries(h)) if (name.startsWith('message_')) {
    stubs['$host_' + name] = (...args) => {
      calls.push([name, ...args]);
      if (name === 'message_complete') order.push('complete-wire');
      return fn(...args);
    };
  }
  const original = legacy ? originalFunctions : excerpts;
  const funcs = mutate ? Object.fromEntries(Object.entries(original).map(([n, text]) => ['$' + n, parse(mutate(text, n))])) : legacy ? parsedOriginal : parsedCurrent;
  const m = machine(funcs, g, memory, stubs);
  function pump(bytes, msg) {
    if (mode === 'error') throw pumpError;
    if (mode === 'park') { g.$yield_flag = 1; return; }
    if (mode === 'nested-inline') {
      const saved = [load(64), load(80), g.$eip, nextHook];
      mode = 'immediate'; nextHook = 0;
      m.call('$handle_PeekMessageW', frame(3000, 2048));
      store(64, saved[0]); store(80, saved[1]); g.$eip = saved[2]; nextHook = saved[3];
    }
    const sp = load(80), ret = load(sp);
    store(80, sp + bytes); store(64, result); g.$eip = ret;
    if (mode === 'keyboard') m.call('$keyboard_hook_begin', [ret, 0, 65, 0x001e0001, msg]);
  }
  stubs.$handle_GetMessageA_pump = msg => pump(20, msg);
  stubs.$handle_PeekMessageA_pump = msg => pump(24, msg);
  function frame(sp = 4096, msg = 1024) { store(80, sp); store(sp, 777); g.$yield_flag = 0; g.$eip = 777; return [msg, 0x10001, 0x100, 0x202, 1, 0]; }
  function records() { return logs.map(s => JSON.parse(s.slice('[message-boundary] '.length))).filter(r => r.kind === 'message-completion'); }
  function invoke(name, options = {}) {
    mode = options.mode || 'immediate'; result = options.result === undefined ? 1 : options.result;
    nextHook = options.hook ? 99 : 0;
    return m.call('$handle_' + name, frame(options.sp, options.msg));
  }
  function returnedHook() { store(80, load(80) + 16); }
  function mutateMSG(n = 0x201, at = 1024) { [0x10001, n, 1, 0xa90141, 123, -12, 45].forEach((v, i) => store(at + i * 4, v)); }
  mutateMSG();
  return { ...out, h, g, memory, logs, calls, order, m, load, store, records, invoke, returnedHook, mutateMSG,
    setHook: n => { nextHook = n; } };
}
function production() {
  const h = harness();
  assert.deepEqual(h.order.slice(0, 2), ['enable', 'fixture-initializer']);
  h.invoke('PeekMessageA');
  assert.equal(h.records().length, 1);
  assert.equal(h.records()[0].api, 'PeekMessageA');
  assert.equal(h.records()[0].msg.message, 0x201);
  assert.equal(h.records()[0].correlation, 'invocation-owned');
  assert.equal(h.trace.status().canonicalRuntimeQualified, false);
  for (const omitted of ['  Object.assign(h, messageCompletionOwner.imports);', '    instance.exports.set_message_completion(1);', '    messageBoundaryTrace.qualifyCompletion();']) {
    assert(runner.includes(omitted));
    const k = harness({ install: installation.replace(omitted, ''), qualify: qualification.replace(omitted, '') });
    k.invoke('PeekMessageA'); assert.equal(k.records().length, 0, 'omitted production wire must lose actual completion');
  }
  const old = harness({ moduleWire: false }); old.invoke('PeekMessageA');
  assert.equal(old.records().length, 0); assert.equal(old.trace.status().successfulReturnMSG, false);
  // All imported functions have canonical signatures plus disabled shared-host
  // defaults; this is source compatibility, not a compiled import table check.
  const header = read('src/01-header.wat'), host = read('lib/host-imports.js');
  for (const n of ['message_begin', 'message_park', 'message_bind', 'message_resume', 'message_complete']) {
    assert(header.includes('"' + n + '"')); assert(host.includes('    ' + n + ': () =>'));
  }
  for (const s of Object.values(excerpts)) parse(s);
  assert(read('src/13-exports.wat').includes('(export "set_message_completion")'));
}
function continuations() {
  for (const name of ['GetMessageA', 'GetMessageW', 'PeekMessageA', 'PeekMessageW']) {
    const h = harness(); h.invoke(name, { hook: true });
    assert.equal(h.records().length, 0, 'hook redirect is not completion');
    h.h.log_api_exit(); assert.equal(h.records().length, 0, 'unrelated/stale API exit');
    h.mutateMSG(0x222); h.returnedHook(); h.m.call('$getmessage_hook_continue');
    assert.equal(h.records().length, 1); const r = h.records()[0];
    assert.equal(r.api, name); assert.equal(r.msg.message, 0x222); assert.equal(r.result, 1);
    assert.equal(r.removeFlags, name.startsWith('Get') ? null : 1); assert.equal(r.pmRemove, true);
    assert.equal(h.load(80), 4096 + (name.startsWith('Peek') ? 24 : 20)); assert.equal(h.g.$eip, 777);
    assert(h.order.indexOf('getmessage-leave') < h.order.indexOf('complete-wire'));
    const token = r.invocation; h.h.message_complete(token, 2); assert.equal(h.records().length, 1, 'duplicate token consumed');
    const k = harness(); k.invoke(name, { mode: 'keyboard' });
    assert.equal(k.records().length, 0); k.mutateMSG(0x223); k.returnedHook();
    k.setHook(99); k.m.call('$keyboard_hook_finish'); assert.equal(k.records().length, 0, 'keyboard transfers to WH_GETMESSAGE');
    k.mutateMSG(0x224); k.returnedHook(); k.m.call('$getmessage_hook_continue');
    assert.equal(k.records().length, 1); assert.equal(k.records()[0].msg.message, 0x224); assert.equal(k.records()[0].api, name);
    const j = harness(); j.invoke(name, { mode: 'keyboard' }); j.returnedHook(); j.m.call('$keyboard_hook_finish');
    assert.equal(j.records().length, 1, 'keyboard with no later hook completes');
  }
  const p = harness(); p.invoke('GetMessageW', { mode: 'park' });
  const token = p.calls.find(c => c[0] === 'message_park')[1];
  p.h.message_complete(token, 1); p.h.log_api_exit(); assert.equal(p.records().length, 0);
  p.invoke('PeekMessageA', { sp: 3000, msg: 2048 }); assert.equal(p.records().length, 1);
  assert.notEqual(p.records()[0].invocation, token);
  p.invoke('GetMessageW'); assert.equal(p.records().length, 2); assert.equal(p.records()[1].invocation, token);
  const n = harness(); n.invoke('GetMessageA', { hook: true });
  const outerSP = n.load(80), outerToken = n.calls.find(c => c[0] === 'message_bind')[1];
  assert.equal(n.h.message_resume(1, outerSP + 16), 0, 'wrong continuation kind');
  assert.equal(n.h.message_resume(2, outerSP + 20), 0, 'unrelated context');
  n.invoke('PeekMessageW', { sp: 3000, msg: 2048, hook: true });
  const innerSP = n.load(80); n.mutateMSG(0x333, 2048); n.returnedHook(); n.m.call('$getmessage_hook_continue');
  assert.equal(n.records().length, 1); assert.equal(n.records()[0].api, 'PeekMessageW');
  n.store(80, outerSP); n.mutateMSG(0x444); n.returnedHook(); n.m.call('$getmessage_hook_continue');
  assert.equal(n.records().length, 2); assert.equal(n.records()[1].invocation, outerToken); assert.equal(n.records()[1].msg.message, 0x444);
  assert(innerSP < 4096);
  const nested = harness(); nested.invoke('GetMessageW', { mode: 'nested-inline', hook: true });
  assert.equal(nested.records().length, 1); assert.equal(nested.records()[0].api, 'PeekMessageW');
  nested.returnedHook(); nested.m.call('$getmessage_hook_continue');
  assert.equal(nested.records().length, 2); assert.equal(nested.records()[1].api, 'GetMessageW');
  assert.notEqual(nested.records()[0].invocation, nested.records()[1].invocation);
  for (const [name, value, success] of [['GetMessageA', -1, false], ['GetMessageW', 0, true], ['PeekMessageA', 0, false]]) {
    const f = harness(); f.invoke(name, { result: value }); assert.equal(f.records()[0].successfulReturn, success);
    if (!success) assert.equal(f.records()[0].msg, null);
  }
}
function challenges() {
  // Challenge the exact production wires; each unchanged reproducer below
  // demands the event and fails if its relevant transfer/completion is omitted.
  const challenges = [
    ['immediate-complete', 'handle_PeekMessage_observed', '$host_message_complete', h => h.invoke('PeekMessageA')],
    ['getmessage-bind', 'getmessage_hook_begin', '$host_message_bind', h => { h.invoke('PeekMessageA', { hook: true }); h.returnedHook(); h.m.call('$getmessage_hook_continue'); }],
    ['getmessage-resume', 'getmessage_hook_continue', '$host_message_resume', h => { h.invoke('PeekMessageA', { hook: true }); h.returnedHook(); h.m.call('$getmessage_hook_continue'); }],
    ['getmessage-complete', 'getmessage_hook_continue', '$host_message_complete', h => { h.invoke('PeekMessageA', { hook: true }); h.returnedHook(); h.m.call('$getmessage_hook_continue'); }],
    ['keyboard-bind', 'keyboard_hook_begin', '$host_message_bind', h => { h.invoke('PeekMessageA', { mode: 'keyboard' }); h.returnedHook(); h.m.call('$keyboard_hook_finish'); }],
    ['keyboard-resume', 'keyboard_hook_finish', '$host_message_resume', h => { h.invoke('PeekMessageA', { mode: 'keyboard' }); h.returnedHook(); h.m.call('$keyboard_hook_finish'); }],
    ['keyboard-complete', 'keyboard_hook_finish', '$host_message_complete', h => { h.invoke('PeekMessageA', { mode: 'keyboard' }); h.returnedHook(); h.m.call('$keyboard_hook_finish'); }],
  ];
  for (const [label, target, wire, repro] of challenges) {
    const good = harness(); repro(good); assert.equal(good.records().length, 1, label);
    const bad = harness({ mutate: (text, name) => name === target ? text.replace(wire, '$omitted_wire') : text });
    // The omitted observation is a no-op. The unchanged event oracle rejects.
    assert.throws(() => { repro(bad); assert.equal(bad.records().length, 1, label); }, assert.AssertionError);
  }
  for (const omitPark of [false, true]) {
    const p = harness({ mutate: (text, name) => omitPark && name === 'handle_GetMessage_observed' ? text.replace('$host_message_park', '$omitted_wire') : text });
    p.invoke('GetMessageA', { mode: 'park' });
    const token = p.calls.find(c => c[0] === 'message_begin');
    assert(token); p.invoke('GetMessageA');
    assert.equal(p.records().length, 1);
    // First invocation is token1. Omitting the real canonical park wire loses
    // ownership continuity even though the retry still has a plausible result.
    assert.equal(p.records()[0].invocation === 1, !omitPark);
  }
  const owner = createMessageCompletionOwner({ enabled: () => true, observe() {} });
  const i = owner.imports, t = i.message_begin(1, 1, 100, 200, 0, 0, 0, 0);
  i.message_park(t); assert.equal(i.message_begin(1, 1, 100, 200, 0, 0, 0, 0), t);
  const omitted = createMessageCompletionOwner({ enabled: () => true, observe() {} });
  const u = omitted.imports.message_begin(1, 1, 100, 200, 0, 0, 0, 0);
  assert.notEqual(omitted.imports.message_begin(1, 1, 100, 200, 0, 0, 0, 0), u, 'omitting park loses retry identity');
}
function noninterference() {
  for (const mode of ['immediate', 'park', 'keyboard']) {
    for (const hook of [false, true]) {
      const yes = harness(), no = harness({ on: false });
      yes.invoke('PeekMessageA', { mode, hook }); no.invoke('PeekMessageA', { mode, hook });
      assert.deepEqual(yes.memory, no.memory, 'diagnostics cannot write guest memory/stack');
      const strip = g => Object.fromEntries(Object.entries(g).filter(([k]) => !k.startsWith('$message_completion')));
      assert.deepEqual(strip(yes.g), strip(no.g));
      assert.equal(no.calls.length, 0, 'off makes no diagnostic imports');
      if (mode === 'keyboard') { yes.returnedHook(); no.returnedHook(); yes.m.call('$keyboard_hook_finish'); no.m.call('$keyboard_hook_finish'); }
      if (hook && mode !== 'park') { yes.returnedHook(); no.returnedHook(); yes.m.call('$getmessage_hook_continue'); no.m.call('$getmessage_hook_continue'); }
      assert.deepEqual(yes.memory, no.memory);
      assert.deepEqual(strip(yes.g), strip(no.g));
    }
  }
  const error = harness(); assert.throws(() => error.invoke('GetMessageA', { mode: 'error' }), /real pump error sentinel/);
  assert.equal(error.records().length, 0);
  let gaps = 0;
  const badSink = createMessageCompletionOwner({ enabled: () => true, observe() { throw Error('sink'); }, gap() { gaps++; throw Error('gap sink'); } });
  const t = badSink.imports.message_begin(1, 1, 100, 200, 0, 0, 0, 0);
  assert.doesNotThrow(() => badSink.imports.message_complete(t, 1)); assert.equal(gaps, 1);
}
function limits() {
  const h = harness(); for (let i = 0; i < 400; i++) h.invoke('PeekMessageA');
  assert(h.trace.status().saturated); assert(h.trace.status().records <= 128); assert(h.trace.status().bytes <= 65536);
  assert(h.logs.some(s => s.includes('"kind":"saturated"')));
  let gaps = 0;
  const owner = createMessageCompletionOwner({ enabled: () => true, observe() {}, gap() { gaps++; } });
  for (let i = 0; i < 129; i++) { const t = owner.imports.message_begin(1, 1, 100 + i * 4, 200, 0, 0, 0, 0); owner.imports.message_park(t); }
  assert.equal(gaps, 1); assert.equal(owner.status().backingBytes, 6144); assert(owner.status().lost);
}
function baselineSemantics() {
  const baseline = JSON.parse(read('test/fixtures/enigma-message-original-functions.json'));
  for (const [name, text] of Object.entries(baseline.functions)) assert.equal(sha(text), baseline.hashes[name]);
  for (const name of ['GetMessageA', 'GetMessageW', 'PeekMessageA', 'PeekMessageW']) {
    for (const mode of ['immediate', 'park', 'keyboard', 'nested-inline']) {
      for (const hook of [false, true]) {
        for (const result of [-1, 0, 1]) {
          const a = harness({ on: false }), b = harness({ on: false, legacy: true });
          for (const h of [a, b]) h.invoke(name, { mode, hook, result });
          const equal = () => {
            assert.deepEqual(a.memory, b.memory, [name, mode, hook, result].join('/'));
            assert.deepEqual(a.g, b.g); assert.deepEqual(a.order, b.order);
          };
          equal();
          if (mode === 'keyboard') { for (const h of [a, b]) { h.returnedHook(); h.m.call('$keyboard_hook_finish'); } equal(); }
          if (hook && mode !== 'park' && (result >= 0 || mode === 'keyboard')) {
            // Peek FALSE does not enter WH_GETMESSAGE; neither does Get error.
            if (mode !== 'keyboard' && name.startsWith('Peek') && result === 0) continue;
            for (const h of [a, b]) { h.returnedHook(); h.m.call('$getmessage_hook_continue'); } equal();
          }
        }
      }
    }
  }
  const error = new Error('exact guest callback sentinel');
  for (const options of [{}, { on: false }, { on: false, legacy: true }]) {
    const h = harness({ ...options, pumpError: error });
    assert.throws(() => h.invoke('GetMessageA', { mode: 'error' }), e => e === error);
    assert.equal(h.records().length, 0);
  }
}
const group = process.argv[2] || 'production';
({ production, continuations, challenges, noninterference, limits, 'baseline-semantics': baselineSemantics })[group]();
const result = { group, pass: true, canonicalRuntimeQualified: false, compiled: false,
  runnerSHA256: sha(runner), fixtureSHA256: sha(fs.readFileSync(__filename)),
  exactFunctions: Object.fromEntries(Object.entries(excerpts).map(([k, v]) => [k, { bytes: Buffer.byteLength(v), sha256: sha(v) }])),
  productionInstallation: { bytes: Buffer.byteLength(installation), sha256: sha(installation) },
  qualification: { bytes: Buffer.byteLength(qualification), sha256: sha(qualification) },
  sourceFiles: Object.fromEntries([...sourceFiles, 'src/01-header.wat', 'src/13-exports.wat', 'lib/host-imports.js', 'test/message-completion-owner.js', 'test/message-boundary-trace.js'].map(p => [p, sha(read(p))])) };
if (process.argv[3]) fs.writeFileSync(path.join(process.argv[3], group + '-result.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ group, pass: true, canonicalRuntimeQualified: false, compiled: false }));
