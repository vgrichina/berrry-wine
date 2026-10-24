'use strict';
// Offline transformed historical-runner fragment integration; no WASM/native/browser.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vm = require('vm');
const { transform, validateAnchors, anchors } = require('../tools/maelstrom-breakpoint-boundary-audit.cjs');
const { classifyTest } = require('../tools/test-tiers.js');
const evidence = path.join(__dirname, '../docs/re-notes/maelstrom-breakpoint-boundary-audit-20261024');
const source = zlib.gunzipSync(fs.readFileSync(path.join(evidence, 'historical-runner.js.gz'))).toString();
const exportsSource = zlib.gunzipSync(fs.readFileSync(path.join(evidence, 'historical-13-exports.wat.gz'))).toString();
const enabled = transform(source, { enabled: true, exportsSource });
assert.equal(transform(source), source, 'disabled transformation is byte identical');
new vm.Script(enabled); // Entire transformed runner parses; only exact fragments below execute.
assert.equal(classifyTest(path.basename(__filename)), 'unit');
assert.throws(() => transform(source + '\n'), /source hash mismatch/);
assert.throws(() => transform(source, { enabled: true, exportsSource: exportsSource + '\n' }), /semantics source hash mismatch/);
assert.throws(() => transform(source, { enabled: true }), /semantics source hash mismatch/);
for (const [name, anchor] of Object.entries(anchors)) {
  assert.throws(() => validateAnchors(source.replace(anchor, '')), /anchor missing\/ambiguous/, name + ' missing');
  assert.throws(() => validateAnchors(source + anchor), /anchor missing\/ambiguous/, name + ' duplicate');
}

function span(text, start, end) {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, 'exact runner fragment boundaries');
  return text.slice(a, b);
}
function fragments(text, audit = true) {
  return {
    init: audit ? span(text, '  const maelstromBoundaryAudit = ', anchors.init) : '',
    arm: span(text, audit ? '    maelstromBoundaryAudit.beforeArm(' : anchors.arm, '    // --trace-esp: arm range once'),
    run: span(text, '      if (!mainExecutionSuspended())', '    } catch (e) {'),
    render: span(text, '    if (LIVE_PRESENT) presentDxIfDirty(DX_PRESENT_MIN_MS);', '    if (videoRecorder &&'),
    scheduler: span(text, '    await threadManager.resolveMainThreadSend();', '\n// Watchpoint check'),
    finish: audit ? '  maelstromBoundaryAudit.finish();' : '',
  };
}

async function execute(text, options = {}) {
  const f = fragments(text, options.disabled !== true), rows = [], events = [], reads = [];
  let eip = 0x75040f8, bp = 0, halt = 8, count = 0;
  const e = {
    set_bp(addr) { events.push(['set_bp', addr]); bp = options.wrongArm ? 42 : addr; },
    get_bp_addr() { return bp; }, get_eip() { return eip; }, get_last_run_halt() { return halt; },
    get_eax() { return 0x100; }, get_esp() { return 0x200; },
    test_arena_get(k) { assert.equal(k, 11); return 1; }, get_count(k) { assert.equal(k, 1); return count; },
    guest_read8(a) { events.push(['snapshot', a]); reads.push(a); return a & 255; },
    run(size) {
      events.push(['run', size]);
      if (options.badSize && bp) context.BATCH_SIZE = 1;
      eip = options.hit === false ? 0x75040f8 : 0x7a3366;
      halt = options.halt === undefined ? 5 : options.halt;
      count = 972;
      if (options.wrongAfter) bp = 9;
      return { valueOf() { throw new Error('run return must remain discarded without coercion'); } };
    },
  };
  if (options.missing) delete e[options.missing];
  const hostMutation = who => { events.push([who]); eip = 0xbad; halt = 1; count = 99; };
  const context = {
    Buffer, instance: { exports: e }, BATCH_SIZE: 1000,
    traceAtAddr: 0x7a3366, traceAtAddrs: [0x7a3366], TRACE_AT_START_BATCH: 36163, TRACE_AT_LIMIT: 1,
    breakAddrs: options.breaks || [], countAddrs: options.noCounter ? [] : [0x40287d, 0x7a3362],
    getArg: () => 'eax:4,esp+0x124:12',
    process: { stderr: { write(line) { const row = JSON.parse(line.slice('[MAELSTROM-BOUNDARY] '.length)); rows.push(row); events.push([row.kind]); } } },
    mainExecutionSuspended: () => options.suspended === true,
    renderParkStats: { skippedBatches: 0 }, LIVE_PRESENT: true, DX_PRESENT_MIN_MS: 10,
    presentDxIfDirty: () => hostMutation('present'),
    renderer: { flushRepaint: () => hostMutation('render') }, REPAINT_EVERY: 1,
    threadManager: {
      threads: new Map([[1, { instance: { exports: { set_bp(addr) { events.push(['thread_set_bp', addr]); } } } }]]),
      resolveMainThreadSend: async () => hostMutation('scheduler'), checkMainYield: () => false,
    },
  };
  const batches = options.batches || [36162, 36163, 36164];
  if (options.suspended) e.get_yield_reason = () => 16;
  const program = `(async () => { ${f.init}\nfor (const batch of ${JSON.stringify(batches)}) {\n${f.arm}\n${f.run}\n${f.render}\n${f.scheduler}\n}\n${f.finish}\n})()`;
  await vm.runInNewContext(program, context, { timeout: 1000 });
  return { rows, events, reads, context };
}

async function successOracle(text) {
  const r = await execute(text);
  assert.deepEqual(r.rows.map(x => x.kind), ['arm', 'first-return', 'target', 'summary']);
  const [arm, first, target, summary] = r.rows;
  assert.equal(arm.batch, 36163); assert.equal(arm.invocation.export, 'set_bp');
  assert.equal(arm.invocation.argument, 0x7a3366); assert.equal(arm.readback, 0x7a3366);
  assert.deepEqual(arm.debugGuard, { available: true, export: 'test_arena_get', argument: 11, value: 1 });
  assert.equal(first.eip, 0x7a3366); assert.equal(first.haltRaw, 5);
  assert.equal(target.haltDecoded, 'eip-breakpoint'); assert.equal(target.selectReturnCounter.value, 972);
  assert.equal(summary.targetRecords, 1); assert.equal(summary.mainRunsObserved, 2);
  assert.equal(summary.status, 'target-observed');
  assert.deepEqual(target.snapshot.eaxBytes, [0, 1, 2, 3]);
  assert.deepEqual(target.snapshot.stackBytes, Array.from({ length: 12 }, (_, i) => 0x24 + i));
  assert.deepEqual(r.reads, [0x100, 0x101, 0x102, 0x103, ...Array.from({ length: 12 }, (_, i) => 0x324 + i)]);
  assert(r.events.filter(x => x[0] === 'run').every(x => x[1] === 1000));
  const armIndex = r.events.findIndex(x => x[0] === 'arm'), hitIndex = r.events.findIndex(x => x[0] === 'target');
  assert.equal(r.events[armIndex - 1][0], 'set_bp');
  assert(r.events.slice(armIndex, hitIndex).some(x => x[0] === 'run'));
  assert.equal(r.events[hitIndex + 1][0], 'present', 'snapshot before actual host-render fragment');
  assert.equal(r.events[hitIndex + 2][0], 'render');
  assert.equal(r.events[hitIndex + 3][0], 'scheduler');
  return r;
}

(async () => {
  const success = await successOracle(enabled);
  const plain = await execute(source, { disabled: true });
  assert.equal(plain.rows.length, 0); assert.equal(plain.reads.length, 0);
  assert.deepEqual(plain.events.filter(x => ['run', 'set_bp', 'thread_set_bp', 'present', 'render', 'scheduler'].includes(x[0])),
    (await execute(enabled)).events.filter(x => ['run', 'set_bp', 'thread_set_bp', 'present', 'render', 'scheduler'].includes(x[0])), 'same guest and host calls');
  for (const key of ['set_bp', 'get_bp_addr', 'get_eip', 'get_last_run_halt', 'get_eax', 'get_esp', 'guest_read8']) {
    await assert.rejects(execute(enabled, { missing: key }), new RegExp('missing required export ' + key));
  }
  for (const options of [{ wrongArm: true }, { wrongAfter: true }]) await assert.rejects(execute(enabled, options), /incorrect breakpoint readback/);
  await assert.rejects(execute(enabled, { breaks: [1] }), /configuration differs/);
  await assert.rejects(execute(enabled, { badSize: true }), /batch size changed/);
  const finite = await execute(enabled, { hit: false, batches: Array.from({ length: 10000 }, (_, i) => 36163 + i) });
  assert.equal(finite.rows.length, 3); assert.equal(finite.rows.at(-1).status, 'unresolved');
  assert.equal(finite.rows.at(-1).mainRunsObserved, 10000); assert.equal(finite.reads.length, 0);
  assert(Buffer.byteLength(JSON.stringify(finite.rows)) < 8192);
  for (const options of [{ halt: 8 }, { suspended: true }, { batches: [0, 1] }]) {
    const r = await execute(enabled, options);
    assert.equal(r.rows.at(-1).status, 'unresolved'); assert.equal(r.reads.length, 0);
  }
  const unavailable = await execute(enabled, { missing: 'test_arena_get', noCounter: true });
  assert.equal(unavailable.rows[0].debugGuard.available, false);
  assert.equal(unavailable.rows[1].selectReturnCounter.available, false);

  // Rejecting mutations of the actual transformed runner; not mock-only tests.
  const mutations = {
    omitArmReceipt: text => text.replace('      maelstromBoundaryAudit.afterArm(batch, instance.exports, BATCH_SIZE, traceAtAddr);', ''),
    omitAfterRun: text => text.replace('        maelstromBoundaryAudit.afterRun(batch, instance.exports, BATCH_SIZE);', ''),
    forceOneBlock: text => text.replace('        instance.exports.run(BATCH_SIZE);', '        instance.exports.run(1);'),
    wrongSnapshot: text => text.replace('eaxBytes: read(eax, 4)', 'eaxBytes: read(eax + 1, 4)'),
    lateSnapshot: text => text.replace('        maelstromBoundaryAudit.afterRun(batch, instance.exports, BATCH_SIZE);', '        presentDxIfDirty(DX_PRESENT_MIN_MS); maelstromBoundaryAudit.afterRun(batch, instance.exports, BATCH_SIZE);'),
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const changed = mutate(enabled); assert.notEqual(changed, enabled, name);
    await assert.rejects(successOracle(changed), undefined, name);
  }
  // A false breakpoint classification must fail the no-hit oracle.
  const falseHalt = enabled.replace('last.eip === target && raw === 5', 'last.eip === target');
  await assert.rejects(async () => assert.equal((await execute(falseHalt, { halt: 8 })).rows.at(-1).targetRecords, 0));
  const falseReadback = enabled.replaceAll('e.get_bp_addr() >>> 0', 'target');
  await assert.rejects(async () => assert.rejects(execute(falseReadback, { wrongArm: true }), /incorrect breakpoint readback/));
  // Exercise the executable adapter too; all temporary files are bounded and removed.
  const { execFileSync } = require('child_process');
  const temp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'maelstrom-boundary-cli-'));
  const adapter = path.join(__dirname, '../tools/maelstrom-breakpoint-boundary-audit.cjs');
  try {
    const input = path.join(temp, 'run.js'), exp = path.join(temp, 'exports.wat');
    fs.writeFileSync(input, source); fs.writeFileSync(exp, exportsSource);
    for (const mode of ['--enable', '--disabled']) {
      const out = path.join(temp, mode.slice(2) + '.js');
      const args = ['--max-old-space-size=256', adapter, mode, input, exp, out];
      const receipt = JSON.parse(execFileSync(process.execPath, args, { timeout: 5000, maxBuffer: 8192 }));
      assert.equal(receipt.executesGuest, false);
      assert.equal(fs.readFileSync(out, 'utf8'), mode === '--enable' ? enabled : source);
      assert.throws(() => execFileSync(process.execPath, args, { timeout: 5000, maxBuffer: 8192, stdio: 'pipe' }), /EEXIST/);
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  console.log(JSON.stringify({ pass: true, tier: 'unit', realPinnedRunnerTransformed: true,
    execution: 'exact transformed init/arm/main-run/render/scheduler/finish fragments with mock exports',
    rejectingMutations: Object.keys(mutations).length + 2, anchorsRejected: 10, requiredExportsRejected: 7,
    finiteNoHitBatches: 10000, maxRecords: 4, maxOutputBytes: 8192, guestInstantiated: false,
    controlledSuccessRecords: success.rows, finiteUnresolvedSummary: finite.rows.at(-1),
    runtimeReachability: 'UNPROVEN', historicalZeroCause: 'UNKNOWN' }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
