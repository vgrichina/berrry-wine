'use strict';
// ONE retained-module synthetic fixture. No game, source build or host simulation.
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict'), crypto = require('crypto');
const o = require('../tools/maelstrom-head-yield-observer.cjs');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const head = 0x7a3362, control = 0x7a3c62;
assert.notEqual(control, head); assert.notEqual(control + 4, head + 4);
const source = fs.readFileSync(process.argv[2], 'utf8');
const exportsSource = fs.readFileSync(process.argv[3], 'utf8');
const transformed = o.transform(source, { enabled: true, exportsSource });
const boundary = o.boundarySource();
assert.equal(transformed.split(boundary).length, 2);
const config = { watchAddr: 0, start: 36163, size: 1000, limit: 1,
  traceAddrs: [head], breaks: [], countAddrs: [head, head + 4] };
o.validateConfig(config);
// Independently verify counter addresses and source semantics before native attempt.
assert(exportsSource.includes('(func (export "get_yield_reason")'));
assert(exportsSource.includes('(func (export "get_yield_flag")'));
const bytes = fs.readFileSync(process.argv[4]);
assert.equal(bytes.length, 1879746);
assert.equal(hash(bytes), '8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686');
async function main() {
  const mod = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = {}, lifecycle = [], unexpected = [];
  for (const i of WebAssembly.Module.imports(mod)) {
    const ns = imports[i.module] ||= {};
    if (i.kind === 'memory') {
      assert.equal(i.module + '.' + i.name, 'host.memory'); ns[i.name] = memory;
    } else {
      assert.equal(i.kind, 'function');
      ns[i.name] = (...args) => {
        if (i.module === 'host' && ['beep_process_begin', 'beep_thread_begin'].includes(i.name)) {
          lifecycle.push({ name: i.name, args }); return 0;
        }
        unexpected.push(i.module + '.' + i.name); throw Error('unexpected behavioral host import');
      };
    }
  }
  const e = (await WebAssembly.instantiate(mod, imports)).exports;
  e.init_thread(0, 0x400000, head, control + 0x1000, 0x7500000, 0x7540000, 0, 1);
  const put = (pc, code) => new Uint8Array(memory.buffer, pc - 0x400000 + 0x12000, code.length).set(code);
  const rows = [], observed = [];
  // Compile the EXACT transformed initialization and existing run/skip boundary.
  const initStart = transformed.indexOf('  const maelstromHeadObserver = ');
  const initEnd = transformed.indexOf(o.anchors.init, initStart);
  assert(initStart > 0 && initEnd > initStart);
  const init = transformed.slice(initStart, initEnd);
  const setStart = transformed.indexOf(o.anchors.arm);
  const setEnd = transformed.indexOf('      // Cooperative threads', setStart);
  const actualArm = transformed.slice(setStart, setEnd) + '\n}';
  function lane(pc, enabled) {
    const callee = pc + 0x100, data = 0x430000, initialEBP = 0x7401000, esp = 0x7402000;
    put(pc, [0x8b, 0xe8, 0xff, 0xd7, 0x83, 0x38, 4, 0xeb, 0xf7]);
    put(callee, [0xc3]); put(data, [4, 0, 0, 0]);
    e.set_eip(pc); e.set_eax(data); e.set_edi(callee); e.set_ebp(initialEBP); e.set_esp(esp);
    // No clears: changing to disjoint addresses must yield independently fresh counts.
    e.set_count(0, pc); e.set_count(1, pc + 4);
    const starting = [e.get_count(0), e.get_count(1)];
    console.log(JSON.stringify({ fixtureIsolation: { enabled, pc, addresses: [pc, pc + 4], starting } }));
    assert.deepEqual(starting, [0, 0], 'reject contaminated fixture before any run');
    e.set_yield_state(1, 0);
    const context = vm.createContext({ instance: { exports: e }, batch: 36163, BATCH_SIZE: 1000,
      TRACE_AT_START_BATCH: 36163, TRACE_AT_LIMIT: 1, watchAddr: 0,
      traceAtAddrs: [head], breakAddrs: [], countAddrs: [head, head + 4], traceAtAddr: pc,
      mainExecutionSuspended: () => false, renderParkStats: { skippedBatches: 0 },
      Buffer, process: { stderr: { write: line => observed.push(JSON.parse(line.slice(line.indexOf('{')))) } } });
    if (enabled) { vm.runInContext(init, context); vm.runInContext(actualArm, context); }
    else e.set_bp(pc);
    const run = new vm.Script(enabled ? boundary : o.anchors.run);
    const startStores = e.get_cache_stores();
    const laneRows = [];
    for (let i = 0; i < 7; i++) {
      if (i === 5) e.set_yield_state(0, 0);
      // After the observer's six-pair bound, independently verify the exact
      // return boundary using real set_bp and original run wrapper, no extra run.
      if (i === 6) { e.set_eip(pc); e.set_bp(pc + 4); }
      context.batch = 36163 + i;
      run.runInContext(context);
      const row = { enabled, step: i, halt: e.get_last_run_halt(), eip: e.get_eip(),
        eax: e.get_eax(), edi: e.get_edi(), ebp: e.get_ebp(), esp: e.get_esp(),
        headEntries: e.get_count(0), interiorEntries: e.get_count(1),
        yieldReason: e.get_yield_reason(), yieldFlag: e.get_yield_flag(),
        storesDelta: e.get_cache_stores() - startStores };
      console.log(JSON.stringify({ nativeState: row })); rows.push(row);
      if (i < 5) {
        assert.equal(row.halt, i % 2 ? 4 : 5); assert.equal(row.eip, pc);
        assert.equal(row.ebp, initialEBP); assert.equal(row.esp, esp);
        assert.equal(row.storesDelta, 0, 'pending yield prevents decode');
        assert.equal(row.headEntries, Math.floor((i + 1) / 2));
      } else {
        assert.equal(row.halt, 5); assert.equal(row.ebp, data, 'original MOV executed');
        assert.equal(row.esp, esp, 'CALL plus real RET restores stack');
        assert.equal(row.eip, i === 6 ? pc + 4 : pc);
      }
      // set_bp preserves the head halt's skip flag. On step 6 the first
      // interior arrival consumes it and counts; the second arrival halts.
      assert.equal(row.interiorEntries, i < 5 ? 0 : i === 5 ? 1 : 2);
      laneRows.push({ ...row, enabled: undefined, eip: row.eip - pc, edi: row.edi - pc,
        storesDelta: undefined });
    }
    if (enabled) vm.runInContext('maelstromHeadObserver.finish()', context);
    else {
      // Consume ONLY the disjoint control's final skip, blocked before decode.
      // set_bp itself does not reset bp_skip_once in the pinned source.
      e.set_yield_state(1, 0); run.runInContext(context);
      assert.equal(e.get_last_run_halt(), 4);
      assert.equal(e.get_count(1), 3);
      console.log(JSON.stringify({ controlCleanup: 'pending-yield consumes final skip before fresh on lane',
        halt: e.get_last_run_halt(), headEntries: e.get_count(0), interiorEntries: e.get_count(1) }));
    }
    return laneRows;
  }
  const off = lane(control, false), on = lane(head, true);
  assert.deepEqual(on, off, 'observer off/on equivalent state transitions at disjoint fresh addresses');
  assert.deepEqual(unexpected, []);
  assert.equal(observed.filter(r => r.observation === 'pending-yield-before-instructions').length, 2);
  assert(observed.filter(r => r.state && r.state.ebp === 0x430000 && r.kind === 'after-existing-boundary')
    .every(r => r.movCallExecuted === 'UNKNOWN'), 'halt 5 after a loop is not proof of no execution');
  assert(observed.length <= 16);
  assert(Buffer.byteLength(observed.map(r => '[MAELSTROM-HEAD] ' + JSON.stringify(r) + '\n').join('')) <= 8192);
  console.log(JSON.stringify({ status: 'pass', qualification: 'retained-native synthetic fixture; no original-game causality',
    instantiations: 1, moduleSHA256: hash(bytes), moduleBytes: bytes.length,
    runnerSHA256: hash(source), exportsSHA256: hash(exportsSource), rows, observed, lifecycle,
    actualGameZeroCause: 'UNKNOWN', actualGameEDI: 'UNKNOWN', actualGameErrno: 'UNKNOWN' }));
}
main().catch(err => { console.error(err.stack); process.exitCode = 1; });
