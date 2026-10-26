'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { createMessageBoundaryTrace } = require('./message-boundary-trace');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const runner = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
const excerpts = [];
function cut(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a); assert.equal(source.indexOf(start, a + 1), -1);
  const text = source.slice(a, b); excerpts.push({ start, bytes: Buffer.byteLength(text), sha256: sha(text) }); return text;
}
const installation = cut(runner, '  // BEGIN message-boundary installation:', '  // END message-boundary installation');
const logger = cut(runner, '  h.log = (ptr, len) => {', '  h.log_i32 = val => {');
const poll = cut(runner, '  h.check_input = () => {', '  // Default hwnd routing:');
const control = cut(runner, '  const handleControlCommand = (cmdIn) => {', '  const control = (CONTROL || CONTROL_STDIN)');
function harness({ enabled = true, source = runner, getContextError = false, originalExit, createTrace = createMessageBoundaryTrace } = {}) {
  const memory = { buffer: new ArrayBuffer(4096) }, dv = new DataView(memory.buffer);
  let state = { esp: 128, eax: 1, eip: 900, tid: 1, yieldFlag: 0, yieldReason: 0 }, getters = 0;
  const exports = {};
  for (const [name, key] of Object.entries({ get_esp: 'esp', get_eax: 'eax', get_eip: 'eip', get_current_thread_id: 'tid', get_yield_flag: 'yieldFlag', get_yield_reason: 'yieldReason' })) {
    exports[name] = () => { getters++; if (getContextError) throw new Error('read'); return state[key]; };
  }
  exports.get_image_base = () => 0;
  const translateGuest = n => n;
  const logs = [], h = { log_api_exit: originalExit || function () { return 'preserved'; } };
  const renderer = { checkInput: () => ({ msg: 0x201, wParam: 1, lParam: 0xa90141, hwnd: 0x10001, mouseX: 344, mouseY: 212, mouseButtons: 1 }) };
  const inputConsumptionTrace = { dequeue() {} };
  const factory = new Function('createMessageBoundaryTrace', 'h', 'memory', 'instance', 'translateGuest', 'logs', 'TRACE_MESSAGE_BOUNDARY', 'renderer', 'inputConsumptionTrace', `
    const tickState={batch:120833};
    const apiNameCache=new Map();let pendingComApiId=-1,apiCount=0;const apiCounts=null;
    const TRACE_CRITICAL=false,TRACE_INPUT_DISPATCH=false,TRACE_API_MEM=[],breakApis=[],ESP_DELTA=false,TRACE_API=false,QUIET_API=true;
    let inputEvent=null,inputQueue=null,installingFiles=false,lastInputEvent=null;const crossThreadMsgs=[];
    ${cut(source, '  // BEGIN message-boundary installation:', '  // END message-boundary installation')}
    ${cut(source, '  h.log = (ptr, len) => {', '  h.log_i32 = val => {')}
    ${cut(source, '  h.check_input = () => {', '  // Default hwnd routing:')}
    ${cut(source, '  const handleControlCommand = (cmdIn) => {', '  const control = (CONTROL || CONTROL_STDIN)')}
    return {h,trace:messageBoundaryTrace,control:handleControlCommand,count:()=>apiCount};
  `);
  const out = factory(createTrace, h, memory, { exports }, translateGuest, logs, enabled, renderer, inputConsumptionTrace);
  const names = new Map();
  function api(name) { if (!names.has(name)) names.set(name, 3000 + names.size * 64); const pointer = names.get(name), data = Buffer.from(name); new Uint8Array(memory.buffer, pointer, data.length).set(data); return h.log(pointer, data.length); }
  function stack(pointer = 512) { [777, pointer, 0x10001, 0x84, 0x202, 1].forEach((v, i) => dv.setUint32(128 + i * 4, v, true)); }
  function message(n = 0x201) { [0x10001, n, 1, 0xa90141, 123, -12, 45].forEach((v, i) => dv.setUint32(512 + i * 4, v, true)); }
  stack(); message();
  return { ...out, api, stack, message, logs, dv, memory, state, getters: () => getters,
    records: () => logs.filter(x => x.startsWith('[message-boundary] ')).map(x => JSON.parse(x.slice('[message-boundary] '.length))) };
}
function production(source = runner) {
  assert(source.includes("const { createMessageBoundaryTrace } = require('./message-boundary-trace');"));
  assert(source.indexOf('// BEGIN message-boundary installation:') < source.indexOf('const instance = await WebAssembly.instantiate'));
  const loggingGate = cut(source, '  apiLogOff = QUIET_API &&', '  h.log = (ptr, len) => {');
  const gate = new Function('TRACE_MESSAGE_BOUNDARY', `let apiLogOff;
    const QUIET_API=true,TRACE_API=false,TRACE_API_PAUSED=false,TRACE_API_COUNTS=false,TRACE_CRITICAL=false,
      TRACE_INPUT_DISPATCH=false,ESP_DELTA=false,ESP_AUDIT=false,breakApis=[],TRACE_API_MEM=[];
    ${loggingGate}
return apiLogOff;`);
  assert.equal(gate(true), false, 'opt-in flag must retain canonical API callbacks even under quiet mode');
  assert.equal(gate(false), true);
  const h = harness({ source });
  assert.equal(h.trace.status().armed, false);
  h.api('PeekMessageA'); h.h.log_api_exit(); assert.equal(h.records().length, 1, 'boot/initializers do not spend paused trace budget');
  assert.equal(h.control({ action: 'message-boundary', on: true }).armed, true, 'actual control wiring arms observer');
  const n = h.records().length;
  assert.equal(h.h.check_input() >>> 0, 0x10201);
  const dequeue = h.records().at(-1); assert.equal(h.records().length, n + 1);
  assert.deepEqual([dequeue.kind, dequeue.hwnd, dequeue.x, dequeue.y, dequeue.mouseButtons], ['host-dequeue', 0x10001, 321, 169, 1]);
  for (const name of ['PeekMessageA', 'PeekMessageW', 'GetMessageA', 'GetMessageW']) {
    h.api(name); const entry = h.records().at(-1);
    assert.equal(entry.api, name, 'actual h.log must invoke real helper');
    assert.equal(entry.msg, null, 'entry does not read stale MSG'); assert.equal(entry.successfulReturn, null);
    assert.equal(entry.filterHwnd, 0x10001); assert.equal(entry.filterMin, 0x84); assert.equal(entry.filterMax, 0x202); assert.equal(entry.pmRemove, true);
    if (name.startsWith('Peek')) assert.equal(entry.removeFlags, 1);
  }
  h.stack(); h.dv.setUint32(148, 0, true); h.api('PeekMessageW'); assert.equal(h.records().at(-1).pmRemove, false);
  h.stack();
  for (const name of ['DispatchMessageA', 'DispatchMessageW']) {
    h.api(name); const entry = h.records().at(-1); assert.equal(entry.api, name); assert.equal(entry.msg.message, 0x201);
    assert.equal(entry.msg.pointX, -12); assert.equal(entry.msg.pointY, 45);
  }
  h.message(0x202); assert.equal(h.records().find(x => x.msg && x.msg.message === 0x201).msg.message, 0x201, 'entry snapshot is immutable after MSG mutation');
  // These are unqualified callbacks, not mocked successful guest returns.
  for (const [eax, yieldFlag, esp, tid] of [[1, 0, 152, 1], [0, 0, 152, 1], [-1, 0, 148, 1], [1, 1, 128, 1], [1, 1, 128, 2], [1, 0, 152, 2]]) {
    Object.assign(h.state, { eax, yieldFlag, esp, tid });
    assert.equal(h.h.log_api_exit(), 'preserved'); const exit = h.records().at(-1);
    assert.equal(exit.kind, 'post-handler-unqualified'); assert.equal(exit.invocation, 'unknown'); assert.equal(exit.successfulReturn, null); assert.equal(exit.msg, null);
    assert(!Object.hasOwn(exit, 'api'), 'no stale API attribution');
  }
  h.api('UnrelatedAPI'); h.h.log_api_exit();
  assert(h.records().every(x => x.successfulReturn !== true)); assert.equal(h.trace.status().successfulReturnMSG, false);
  assert.equal(h.control({ action: 'message-boundary', on: false }).armed, false);
  const before = h.records().length; h.api('PeekMessageA'); h.h.check_input(); h.h.log_api_exit(); assert.equal(h.records().length, before);
  return h;
}
function mutateHelper(before, after) {
  const Module = require('module'), filename = path.join(__dirname, 'message-boundary-trace.js');
  const source = fs.readFileSync(filename, 'utf8'); assert(source.includes(before));
  const variant = new Module(filename); variant.filename = filename;
  variant._compile(source.replace(before, after), filename); return variant.exports.createMessageBoundaryTrace;
}
function byteChallenge(createTrace) {
  const logs = [], t = createTrace({ enabled: true, logs, snapshot: () => ({ batch: 9007199254740991 }) });
  t.arm(true);
  for (let i = 0; i < 600; i++) t.dequeue({ msg: 0x201, hwnd: 0xffffffff, wParam: 0xffffffff, lParam: 0xffffffff, mouseX: -1.7976931348623157e308, mouseY: -1.7976931348623157e308, mouseButtons: -1.7976931348623157e308 }, 'button-queue');
  assert(t.status().bytes <= 65536, 'byte guard must survive loss of record guard');
  assert(t.status().saturated); assert.equal(JSON.parse(logs.at(-1).slice('[message-boundary] '.length)).kind, 'saturated');
}
function limits() {
  const h = harness(); h.control({ action: 'message-boundary', on: true });
  for (let i = 0; i < 600; i++) h.h.check_input();
  const records = h.records(), status = h.trace.status();
  assert.equal(records.length, 128); assert.equal(records.at(-1).kind, 'saturated'); assert.equal(records.at(-1).absenceIsNotEvidence, true);
  assert.equal(records.filter(x => x.kind === 'saturated').length, 1); assert(status.saturated); assert(status.bytes <= 65536);
  assert.equal(status.bytes, Buffer.byteLength(h.logs.filter(x => x.startsWith('[message-boundary] ')).join('\n') + '\n'));
  const n = h.getters(); h.api('DispatchMessageW'); assert.equal(h.getters(), n, 'saturated observer does not read guest state');
  // Isolate the actual byte guard by omitting only the record threshold in
  // a mutation of the real helper; then omit both and require rejection.
  byteChallenge(mutateHelper('if (count >= maxRecords - 1 || bytes + size > maxBytes - tailBytes)', 'if (false || bytes + size > maxBytes - tailBytes)'));
  assert.throws(() => byteChallenge(mutateHelper('if (count >= maxRecords - 1 || bytes + size > maxBytes - tailBytes)', 'if (false)')), /byte guard/);
  // Public API only serializes fixed scalar fields, never unbounded source strings.
  const logs = [], t = createMessageBoundaryTrace({ enabled: true, logs, snapshot: () => ({ batch: 0 }) });
  t.arm(true); t.dequeue({ msg: 0x84, lParam: -1 }, 'x'.repeat(1000000)); assert(Buffer.byteLength(logs.join('\n')) < 4096);
}
function noninterference() {
  const sentinel = {}, self = {}, args = [3, 'x']; let calls = 0;
  const h = harness({ originalExit: function (...actual) { calls++; assert.equal(this, self); assert.deepEqual(actual, args); return sentinel; } });
  h.control({ action: 'message-boundary', on: true }); assert.equal(h.h.log_api_exit.apply(self, args), sentinel); assert.equal(calls, 1);
  const error = new Error('original exception'), throwing = harness({ originalExit() { throw error; } });
  throwing.control({ action: 'message-boundary', on: true }); const count = throwing.records().length;
  assert.throws(() => throwing.h.log_api_exit(), e => e === error); assert.equal(throwing.records().length, count);
  const broken = harness({ getContextError: true }); broken.control({ action: 'message-boundary', on: true });
  assert.doesNotThrow(() => broken.api('PeekMessageA')); assert.equal(broken.h.log_api_exit(), 'preserved'); assert.equal(broken.count(), 1);
  assert(broken.records().some(x => x.observationError));
  const off = harness({ enabled: false }); assert.throws(() => off.control({ action: 'message-boundary', on: true }), /needs/);
  const before = Buffer.from(off.memory.buffer); off.api('PeekMessageA'); off.h.check_input(); off.h.log_api_exit();
  assert.equal(off.getters(), 0); assert.deepEqual(off.records(), []); assert.equal(off.trace.status().records, 0);
  // Ignore the API-name buffer write, which belongs to this fixture, not the observer.
  assert.deepEqual(Buffer.from(off.memory.buffer).subarray(0, 3000), before.subarray(0, 3000));
  const failSink = createMessageBoundaryTrace({ enabled: true, logs: { push() { throw error; } }, snapshot() { throw error; } });
  assert.doesNotThrow(() => failSink.arm(true)); assert.equal(failSink.wrapPostHandler(() => sentinel)(), sentinel);
  const ordering = [], t = createMessageBoundaryTrace({ enabled: true, logs: [], snapshot: () => ({ batch: 0 }), getContext() { ordering.push('observe'); throw error; } });
  t.arm(true); const wrapped = t.wrapPostHandler(() => { ordering.push('original'); return sentinel; });
  assert.equal(wrapped(), sentinel); assert.deepEqual(ordering, ['original', 'observe']);
}
const group = process.argv[2] || 'production';
if (group === 'production') {
  // Earliest relevant checkpoint: complete actual production h.log and host poll,
  // plus actual installation/control functions. No guest/initializer is executed.
  production();
  for (const omitted of ['    messageBoundaryTrace.api(t);\n', '    messageBoundaryTrace.dequeue(evt, source);\n', '  h.log_api_exit = messageBoundaryTrace.wrapPostHandler(h.log_api_exit);\n', '!TRACE_MESSAGE_BOUNDARY && ', "      if (typeof cmd.on === 'boolean') messageBoundaryTrace.arm(cmd.on);\n"]) {
    assert(runner.includes(omitted)); assert.throws(() => production(runner.replace(omitted, '')), undefined, 'omitting actual wiring must reject');
  }
} else if (group === 'limits') limits();
else if (group === 'noninterference') noninterference();
else throw new Error('unknown group');
const result = { group, pass: true, runnerSHA256: sha(runner), helperSHA256: sha(fs.readFileSync(path.join(__dirname, 'message-boundary-trace.js'))), fixtureSHA256: sha(fs.readFileSync(__filename)), excerpts: [...new Map(excerpts.map(x => [x.start + ':' + x.sha256, x])).values()], successfulReturnMSG: false, guestExecution: false };
if (process.argv[3]) { const dest = path.join(process.argv[3], group + '-result.json'); fs.writeFileSync(dest + '.new', JSON.stringify(result, null, 2) + '\n'); fs.renameSync(dest + '.new', dest); }
console.log(JSON.stringify({ group, pass: true, successfulReturnMSG: false }));
