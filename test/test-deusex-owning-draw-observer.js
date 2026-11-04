'use strict';

// Actual interpreter + shipped guest Worker, synthetic x86 control routes.
// These fixtures execute instructions; they never supply observer snapshots.
// They are not original-game execution, object-lifetime or presentation proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHostImports } = require('../lib/host-imports');
const { GuestThreadHost } = require('../lib/guest-thread-host');
const { OwningDrawObserver, PC, BASE } = require('../lib/deusex-draw-observer');
const crypto = require('node:crypto');
const system = 'test/binaries/candidates/deus-ex-demo/installed/system/';
const engineBytes = fs.readFileSync(system + 'engine.dll');
const exeBytes = fs.readFileSync(system + 'deusex.exe');
assert.equal(crypto.createHash('sha256').update(engineBytes).digest('hex'),
  '3606d3177b4473d1a56405c3e0b372e44dfde475705460be8d68846f6d16a8d0');
assert.equal(crypto.createHash('sha256').update(exeBytes).digest('hex'),
  '2ed115d9dc93582273830d9ae38f92ab4379842459e24eaec11390f312d5af5f');
function original(bytes, va, length) {
  const pe = bytes.readUInt32LE(0x3c), opt = pe + 24;
  const rva = va - bytes.readUInt32LE(opt + 28);
  const sections = opt + bytes.readUInt16LE(pe + 20);
  for (let i = 0; i < bytes.readUInt16LE(pe + 6); i++) {
    const at = sections + i * 40, start = bytes.readUInt32LE(at + 12);
    const raw = bytes.readUInt32LE(at + 16);
    if (rva >= start && rva + length <= start + raw)
      return [...bytes.subarray(bytes.readUInt32LE(at + 20) + rva - start,
        bytes.readUInt32LE(at + 20) + rva - start + length)];
  }
  throw Error('original VA has no file bytes');
}
for (const [va, bytes] of [[PC.entry, [0x55,0x8b,0xec,0x6a,0xff]],
  [PC.lock-3,[0xff,0x50,0x60]], [PC.unlock-3,[0xff,0x50,0x68]],
  [PC.tail-3,[0xff,0x52,0x6c]], [PC.epilogue+16,[0xc2,0x10,0]]])
  assert.deepEqual(original(engineBytes, va, bytes.length), bytes);
assert.deepEqual(original(exeBytes, 0x10914877, 3), [0xff,0x50,0x54]);
const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24];

function image(dll) {
  const b = Buffer.alloc(0x400), p = 0x80, o = p + 24, s = o + 0xe0;
  b.writeUInt16LE(0x5a4d); b.writeUInt32LE(p, 0x3c);
  b.writeUInt32LE(0x4550, p); b.writeUInt16LE(0x14c, p + 4);
  b.writeUInt16LE(1, p + 6); b.writeUInt16LE(0xe0, p + 20);
  b.writeUInt16LE(dll ? 0x210e : 0x10e, p + 22);
  b.writeUInt16LE(0x10b, o); b.writeUInt32LE(0x1000, o + 16);
  b.writeUInt32LE(dll ? BASE : 0x400000, o + 28);
  b.writeUInt32LE(0x1000, o + 32); b.writeUInt32LE(0x200, o + 36);
  b.writeUInt32LE(dll ? 0x190000 : 0x60000, o + 56); b.writeUInt32LE(0x200, o + 60);
  b.writeUInt16LE(3, o + 68); b.writeUInt32LE(0x100000, o + 72);
  b.writeUInt32LE(16, o + 92);
  b.write('.text', s); b.writeUInt32LE(dll ? 0x18f000 : 0x5f000, s + 8);
  b.writeUInt32LE(0x1000, s + 12); b.writeUInt32LE(0x200, s + 16);
  b.writeUInt32LE(0x200, s + 20); b.writeUInt32LE(0xe0000060, s + 36);
  b[0x200] = 0xc3;
  if (dll) {
    b.writeUInt32LE(0x1000, o + 96); b.writeUInt32LE(40, o + 100);
    b.fill(0, 0x200, 0x228);
    b.writeUInt32LE(0x1080, 0x20c); b.write('Engine.dll\0', 0x280);
  }
  return b;
}

async function exercise(module, inWorker) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, resourceJson: {}, onExit() {} };
  const imports = createHostImports(ctx); imports.host.memory = memory;
  imports.host.log = () => {}; imports.host.log_i32 = () => {};
  let host, ex, observer;
  const captures = [];
  if (inWorker) {
    host = new GuestThreadHost({ memory, module,
      sigs: JSON.parse(fs.readFileSync('lib/host-import-sigs.generated.json')).sigs,
      hostImports: imports.host, workerUrl: path.resolve('lib/guest-worker.js'), clockIntervalMs: 0 });
    await host.start();
  } else {
    ex = (await WebAssembly.instantiate(module, { host: imports.host })).exports;
    ctx.exports = ex;
  }
  const call = async (name, ...args) => inWorker ? host.callExport(name, ...args) : ex[name](...args);
  const stage = async bytes => new Uint8Array(memory.buffer).set(bytes, await call('get_staging'));
  const start = async options => {
    if (inWorker) return host.link._ask({ t: 'drawObserver', action: 'start', options });
    observer = new OwningDrawObserver(ex, options);
  };
  const status = async () => inWorker
    ? (await host.link._ask({ t: 'drawObserver', action: 'status' })).result : observer.result;
  const run = async n => inWorker ? host.slice(n) : observer.run(ex, n);
  const write = async (addr, bytes) => {
    const at = await call('guest_to_wasm', addr) >>> 0;
    assert.notEqual(at, 0xf0);
    new Uint8Array(memory.buffer).set(bytes, at);
    await call('invalidate_code_range', addr, bytes.length);
  };
  let load, reloc;
  const pc = name => PC[name] + reloc;
  const jmp = (from, to) => [0xe9, ...u32(to - from - 5)];
  const branch = (from, to, prefix = []) => write(from, [...prefix, ...jmp(from + prefix.length, to)]);
  try {
    await stage(image(false)); assert(await call('load_pe', 0x400));
    await stage(image(true)); await call('load_dll', 0x400, inWorker ? BASE + 0x01000000 : 0x01000000);
    const table = await call('get_dll_table'), life = await call('get_dll_lifecycle_table');
    const v = new DataView(memory.buffer);
    load = v.getUint32(table, true); reloc = load - BASE;
    assert(inWorker ? reloc > 0 : reloc < 0, 'actual loader chooses opposite relocation signs');
    assert(await call('complete_dll_initialize', 0, v.getUint32(life + 4, true), 3));
    const stack = await call('guest_alloc', 4096) >>> 0, esp = stack + 4000;
    const viewport = await call('guest_alloc', 4096) >>> 0;
    const engine = await call('guest_alloc', 4096) >>> 0;
    const caller = 0x401100;
    const callee = 0x401200;
    await write(caller, [0xeb, 0xfe]);
    await write(callee, [0xc3]);
    async function setup(kind) {
      // A natural CALL supplies the four arguments and saved caller. Only the
      // fixture builder writes guest code; the diagnostic never does.
      await write(caller - 18, [0x6a, 0, 0x6a, 0, 0x6a, 0, 0x68, ...u32(viewport),
        0xb8, ...u32(pc('entry')), 0xff, 0xd0]);
      // Same four prologue bytes as original, then a synthetic branch route.
      await branch(pc('entry'), kind === 'bypass' ? pc('epilogue') : kind === 'jumpLanding' ? pc('lock') : pc('lock') - 2,
        [0x55, 0x8b, 0xec, 0x6a, 0xff, 0x8b, 0x75, 0x08,
          0xc6, 0x45, 0x0b, 0xaa, // original Draw also overwrites this argument byte
          ...(kind === 'foreignViewport' ? [0x31, 0xf6] : []),
          0xb8, ...u32(kind === 'failed' ? 0 : 1)]);
      for (const point of ['lock', 'unlock', 'tail']) await write(pc(point) - 2, [0xff, 0xd2]);
      await branch(pc('lock'), kind === 'typed' ? pc('catchTyped') : kind === 'catch' ? pc('catchAll')
        : kind === 'missing' ? pc('tail') : pc('unlock') - 2);
      await branch(pc('unlock'), pc('tail') - 2);
      await branch(pc('tail'), kind === 'unwind' ? caller + 16 : pc('epilogue'));
      await write(pc('epilogue'), [0x8b, 0xe5, 0x5d, 0xc2, kind === 'wrongCleanup' ? 12 : 16, 0]);
      if (kind === 'originalEpilogue') {
        // Execute the exact original SEH restoration/pop/RET16 instructions,
        // including the straight-line FS store, without introducing a branch.
        await write(pc('epilogue'), original(engineBytes, PC.epilogue, 19));
        await write(esp - 16, u32(0));
      }
      if (kind === 'originalCalls') {
        // Original virtual CALL + following instructions through each next
        // CALL boundary; synthetic objects/callees, unmodified original bytes.
        await write(pc('lock') - 3, original(engineBytes, PC.lock - 3, 11));
        // lock TEST/JZ is preserved; successful fall-through joins fixture.
        await branch(pc('lock') + 8, pc('unlock') - 3);
        await write(pc('unlock') - 3, original(engineBytes, PC.unlock - 3, 11));
        await branch(pc('tail'), pc('epilogue'));
        const vt = viewport + 512;
        await write(viewport, u32(vt));
        await write(vt + 0x60, u32(callee));
        await write(vt + 0x68, u32(callee));
        await write(vt + 0x6c, u32(callee));
        await write(engine + 0x48, u32(viewport));
        // Synthetic prologue supplies EDI to the original tail loads.
        await branch(pc('entry'), pc('lock') - 3,
          [0x55,0x8b,0xec,0x6a,0xff,0x8b,0x75,0x08,0xbf,...u32(engine),
            0xb8,...u32(vt),0xb9,...u32(viewport)]);
      }
      await write(pc('catchTyped'), [0xeb, 0xfe]); await write(pc('catchAll'), [0xeb, 0xfe]);
      await write(caller + 16, [0x8b, 0xe5, 0x5d, 0x83, 0xc4, 0x14, 0xeb, 0xfe]);
      if (kind === 'loop') {
        await branch(pc('lock'), pc('lock') + 0x20);
        await write(pc('lock') + 0x20, [0xeb, 0xfe]);
      }
      if (kind === 'trap') await write(pc('unlock'), [0x0f, 0x0b]);
      for (const [name, value] of Object.entries({ eip: caller - 18, esp: esp + 20, ebp: 0x12345678,
        ecx: engine, esi: 0, eax: 0, edx: callee })) await call('set_' + name, value);
      await call('clear_yield');
    }
    const cases = { originalEpilogue: 'render-route-return-candidate-unverified-lifetime',
      originalCalls: 'render-route-return-candidate-unverified-lifetime', success: 'render-route-return-candidate-unverified-lifetime',
      bypass: 'bypass-or-missing-checkpoint', failed: 'failed-lock', typed: 'caught-unwind',
      catch: 'caught-unwind', missing: 'bypass-or-missing-checkpoint',
      wrongCleanup: 'incomplete-return', unwind: 'unobserved-unwind-or-return', loop: 'expired-incomplete',
      jumpLanding: 'missing-call-return-observation', foreignViewport: 'foreign-draw-frame' };
    if (inWorker) {
      await setup('success');
      assert.equal((await host.link._ask({ t: 'drawObserver', action: 'status' })).active, false);
      await host.slice(40);
      assert.equal(await status(), null, 'ordinary execution does not enable a collector');
    }
    // Reproduce the demonstrated blind spot: CALL reaches Draw exactly when
    // the last permitted block retires. Entry must survive budget exhaustion.
    await setup('success'); await start({ maxBlocks: 1, maxMs: 2000 }); await run(1);
    let terminal = await status();
    assert.deepEqual(terminal.events.map(e => e.point), ['entry'], 'last-block Draw entry retained');
    assert.equal(terminal.terminal.reason, 'block-budget');
    assert.equal(terminal.terminal.boundary, 'after-run');
    assert.equal(terminal.terminal.eip, pc('entry'));
    assert.equal(terminal.terminal.pcModule.name.toLowerCase(), 'engine.dll');
    assert.equal(terminal.terminal.pcModule.rva, PC.entry - BASE);
    assert.equal(terminal.terminal.blocks, 1);
    assert.equal(terminal.terminal.remainingBlocks, 0);
    assert(terminal.terminal.remainingMs > 0);
    captures.push({ fixture: 'last-block-entry', result: terminal });
    const frozen = structuredClone(terminal);
    // Ordinary execution after completion cannot alter the terminal PC.
    if (inWorker) await host.slice(1); else ex.run(1);
    assert.deepEqual(await status(), frozen);

    for (const [kind, expected] of Object.entries(cases)) {
      await setup(kind); await start({ maxBlocks: kind === 'loop' ? 12 : 100, maxMs: 2000,
        snapshots: [{ point: 'savedCaller', viewport, engine }], module: { loadAddr: 123, generation: 999 } });
      assert.equal(await status(), null, 'caller-supplied metadata cannot complete the observation');
      // Cross multiple actual Worker slice boundaries, retaining one invocation.
      for (let i = 0; i < 20 && !await status(); i++) await run(1);
      const result = await status(); assert(result, kind);
      captures.push({ fixture: kind, result });
      assert.equal(result.status, expected, kind + ' worker=' + inWorker);
      assert.equal(result.terminal.currentThread, result.thread);
      assert(result.terminal.runCalls > 0);
      assert(result.terminal.blocks > 0);
      assert(result.terminal.boundaries > 0);
      assert(result.terminal.elapsedMs >= result.terminal.runMs);
      if (kind === 'loop') {
        assert.equal(result.terminal.reason, 'block-budget');
        assert.equal(result.terminal.blocks, 12);
      }
      assert.equal(result.engineRender, null); assert.equal(result.viewportPlayer, null);
      assert.equal(result.module.loadAddr, load);
      if (kind === 'success') {
        assert.deepEqual(result.events.map(e => e.point), ['entry', 'lockCall', 'lock', 'unlockCall', 'unlock', 'tailCall', 'tail', 'epilogue', 'savedCaller']);
        assert.equal(result.events[0].viewport, viewport);
        assert.equal(result.events[0].ecx, engine);
        assert.equal(result.events.at(-1).esp, esp + 20);
      }
    }
    // A complete return reached on the last block wins over budget expiry.
    await setup('success'); await start({ maxBlocks: 100 }); await run(100);
    const completeBlocks = (await status()).terminal.blocks;
    await setup('success'); await start({ maxBlocks: completeBlocks }); await run(100);
    terminal = await status();
    assert.equal(terminal.status, cases.success);
    assert.equal(terminal.terminal.remainingBlocks, 0);
    assert.equal(terminal.terminal.eip, caller);
    assert.equal(terminal.terminal.pcModule.kind, 'exe');

    // Relocated exact original loop-check + virtual Tick CALL; the fixture
    // joins these with branches rather than executing original game's body.
    // MainLoop opportunity counters distinguish productive loop coverage from
    // a collector that merely burns blocks elsewhere.
    await setup('success');
    const exeBase = await call('get_image_base') >>> 0;
    const pe = new DataView(memory.buffer).getUint32((await call('guest_to_wasm', exeBase)) + 0x3c, true);
    await write(exeBase + pe + 52, u32(0x10900000));
    const signature = original(exeBytes, 0x10914702, 6);
    signature.splice(2, 4, ...u32(exeBase + 0x57c04));
    await write(exeBase + 0x14702, signature);
    const check = original(exeBytes, 0x109147b9, 15);
    check.splice(2, 4, ...u32(exeBase + 0x57c04));
    await write(exeBase + 0x147b9, check);
    await branch(exeBase + 0x147c8, exeBase + 0x14877);
    await write(exeBase + 0x14877, original(exeBytes, 0x10914877, 3));
    await branch(exeBase + 0x1487a, exeBase + 0x147b9);
    await write(exeBase + 0x57c04, u32(engine + 16));
    await write(engine + 16, u32(1));
    await write(viewport + 0x54, u32(callee));
    await call('set_eip', exeBase + 0x147b9);
    await call('set_eax', viewport);
    await start({ maxBlocks: 20 }); await run(20);
    terminal = await status();
    assert.equal(terminal.terminal.reason, 'block-budget');
    assert(terminal.terminal.opportunity.originalMainLoopSignature);
    assert(terminal.terminal.opportunity.loopCheck >= 3);
    assert(terminal.terminal.opportunity.tickReturn >= 3);
    assert.deepEqual(terminal.events, [], 'Tick coverage cannot fabricate Draw entry');
    await write(exeBase + pe + 52, u32(0x400000));

    // Deadline expiry without guest execution is distinguishable from budget.
    await setup('success'); await start({ maxBlocks: 100, maxMs: 1 });
    await new Promise(resolve => setTimeout(resolve, 10));
    if (!inWorker) await run(1);
    terminal = await status();
    captures.push({ fixture: 'deadline-before-run', result: terminal });
    assert.equal(terminal.terminal.reason, 'time-limit');
    assert.equal(terminal.terminal.blocks, 0);
    assert.equal(terminal.terminal.remainingBlocks, 100);
    assert.equal(terminal.terminal.eip, caller - 18);
    assert.equal(terminal.terminal.boundary, inWorker ? 'worker-deadline-timer' : 'before-run');

    await setup('trap'); await start({ maxBlocks: 20 });
    try { await run(20); } catch (_) { /* local WASM trap is rethrown unchanged */ }
    assert.equal((await status())?.status, 'trap-or-unobservable', 'actual illegal-instruction trap');

    // Pending loader execution is neither consumed nor cleared by the probe.
    await setup('success'); await call('set_yield_state', 5, 0); await start();
    const beforeYield = await call('get_eip');
    // callExport conservatively cancels Worker observation; use readExports
    // below when measuring the active Worker context instead.
    if (inWorker) await start();
    await run(1);
    assert.equal(await call('get_eip'), beforeYield);
    assert.equal(await call('get_yield_reason'), 5);
    await call('clear_yield');

    // Existing debugger facilities remain installed and retain actual counts.
    await setup('success'); await call('set_count', 0, pc('entry'));
    await call('set_bp', caller + 32); await start(); await run(20);
    assert.equal((await status()).status, cases.success);
    assert.equal(await call('get_bp_addr'), caller + 32);
    assert.equal(await call('get_count', 0), 1);
    await call('clear_bp'); await call('clear_counts');
    // No entry: starting in a later checkpoint cannot fabricate an invocation.
    await setup('success'); await call('set_eip', caller);
    await start({ maxBlocks: 2 }); await run(2);
    assert.equal((await status()).observedReturnPair, false);

    if (inWorker && process.env.DEUSEX_COLLECTION_DRIVER) {
      const driver = require(path.resolve(process.env.DEUSEX_COLLECTION_DRIVER));
      const vm = require('node:vm');
      const actions = [], records = [];
      const link = { slot: 0, worker: host.link.worker, endpointIdentity: host.link.endpointIdentity,
        _ask(message) {
          assert.equal(message.t, 'drawObserver', 'driver sends no execution commands');
          actions.push(message.action);
          if (message.action === 'start') assert.deepEqual(JSON.parse(JSON.stringify(message.options)), driver.OPTIONS);
          return host.link._ask(message);
        } };
      assert(link.worker);
      const page = { evaluate(fn, arg) {
        return vm.runInNewContext('(' + fn.toString() + ')',
          { wine: { guestWorker: { link } } })(arg);
      } };
      await setup('originalCalls');
      // This stands in for the existing ordinary host scheduler. The actual
      // collection helper has no slice/run capability in its page context.
      let pending = Promise.resolve();
      const timer = setInterval(() => { pending = pending.then(() => host.slice(1)); }, 2);
      let reply;
      try { reply = await driver.collect(page, { record: (name, value) => records.push({ name, value }) }); }
      finally { clearInterval(timer); await pending; }
      assert.equal(reply.result.status, cases.success);
      assert.equal(actions[0], 'start'); assert.equal(actions.at(-1), 'stop');
      assert(actions.includes('status'));
      assert(records.some(r => r.name === 'assessment'));
      assert.equal(driver.assess(reply.result).engineRender, null);
      assert.throws(() => driver.assess({ events: [] }), /terminal-boundary/);
      const budgetAssessment = driver.assess(terminal);
      assert(budgetAssessment.firstMissing.includes('Draw'));
      console.log('PASS next original driver actual serialized page command + real WorkerLink + ordinary scheduler');
      // Execute the complete next browser driver offline: modeled DOM/boot and
      // readiness observations, real serialized commands + actual WASM Worker.
      // The injected browser factory never launches a browser or game.
      await setup('originalCalls'); actions.length = 0;
      const output = path.join(path.dirname(path.resolve(process.env.DEUSEX_COLLECTION_DRIVER)), 'driver-offline');
      fs.mkdirSync(output, { recursive: true });
      fs.writeFileSync(path.join(output, 'provision-manifest.json'), '{}');
      fs.writeFileSync(path.join(output, 'native-paths.json'), '[]');
      process.env.DEUSEX_OUTPUT = output;
      process.env.DEUSEX_CORRECTED_HELPERS = path.resolve('scratch/runs/20261104-deusex-corrected-launch-observer');
      process.env.DEUSEX_READINESS_HELPERS = path.resolve('scratch/runs/20261104-deusex-measured-readiness-draw');
      process.env.DEUSEX_PORT = '0';
      const selected = { value: '', querySelectorAll: () => [{ value: 'deus_ex_demo' }] };
      const globals = { wine: { guestWorker: { link }, running: true, _exeUrl:
        'test/binaries/candidates/deus-ex-demo/installed/system/deusex.exe',
        renderer: { windows: { 1: { hwnd: 1, visible: true, w: 648, h: 488,
          _dxFrameLayer: { writeSeq: 82 } } } } },
        apps: { deus_ex_demo: { exe: 'test/binaries/candidates/deus-ex-demo/installed/system/deusex.exe' } },
        URLSearchParams, location: { search: '?debug&candidates&no-log', hostname: '127.0.0.1', href: 'http://127.0.0.1/index.html?candidates' },
        crossOriginIsolated: true, WINE_THREADS: true,
        document: { getElementById: name => name === 'app-select' ? selected : { textContent: '' } } };
      const owner = { url: () => 'http://127.0.0.1/lib/guest-worker.js', async evaluate(fn) {
        const state = await host.link._ask({ t: 'readExports', names: ['get_current_thread_id', 'get_eip'] });
        if (fn.name === 'nativeReadiness') return { flag: 1, fixture: 'modeled original readiness, not original runtime' };
        assert.equal(fn.name, 'inspect');
        return { slot: 0, thread: state.values.get_current_thread_id, eip: state.values.get_eip,
          engine: { loadAddr: load, generation: new DataView(memory.buffer).getUint32(life + 4, true) } };
      } };
      const browserPage = { setDefaultTimeout() {}, async setViewport() {}, on() {}, async goto() {},
        async waitForFunction() {}, workers: () => [owner],
        async select(_selector, value) { selected.value = value; return [value]; }, async click() {},
        async screenshot() {}, evaluate(fn, arg) { return vm.runInNewContext('(' + fn.toString() + ')', globals)(arg); } };
      let closed = false;
      const fakeBrowser = { version: async () => 'offline browser fixture', process: () => ({ pid: process.pid }),
        newPage: async () => browserPage, close: async () => { closed = true; } };
      pending = Promise.resolve();
      const schedule = setInterval(() => {
        if (actions.includes('start')) pending = pending.then(() => host.slice(1));
      }, 2);
      try {
        await require(path.join(path.dirname(path.resolve(process.env.DEUSEX_COLLECTION_DRIVER)), 'next-driver.cjs')).main(async () => fakeBrowser);
      } finally { clearInterval(schedule); await pending; }
      assert(closed);
      assert(!fs.existsSync(path.join(output, 'first-failure.json')), 'full next driver completes without error');
      const fullResult = JSON.parse(fs.readFileSync(path.join(output, 'result.json')));
      assert.equal(fullResult.collector.result.status, cases.success);
      assert.equal(fullResult.collector.result.terminal.maxBlocks, driver.OPTIONS.maxBlocks);
      assert.equal(fullResult.collector.result.terminal.maxMs, driver.OPTIONS.maxMs);
      assert.equal(fullResult.gameplayClaim, false);
      assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'readiness-met.json'))).native.flag, 1);
      console.log('PASS full next-driver offline DOM/readiness fixtures + actual WASM owning Worker integration');

    }

    // Module retirement/reuse, despite unchanged bytes and same load address.
    await setup('success'); await start(); await run(1);
    Atomics.add(new Int32Array(memory.buffer), (life + 4) >>> 2, 1);
    await run(1); terminal = await status();
    assert.equal(terminal.status, 'module-changed');
    assert.equal(terminal.terminal.engineModule.generation, terminal.module.generation + 1);
    assert.equal(terminal.terminal.blocks, 1);

    // A retired module with no replacement is an observation error and keeps
    // the actual terminal PC, rather than silently treating it as no Draw.
    await setup('success'); await start(); await run(1);
    Atomics.store(new Int32Array(memory.buffer), life >>> 2, 3);
    await run(1); terminal = await status();
    assert.equal(terminal.status, 'module-changed-or-unobservable');
    assert.equal(terminal.terminal.engineModule, null);
    assert.equal(terminal.terminal.moduleError, 'no live original Engine mapping');
    assert.equal(terminal.terminal.blocks, 1);
    Atomics.store(new Int32Array(memory.buffer), life >>> 2, 2);

    // The capture mechanism cannot be completed by a foreign exports instance.
    if (!inWorker) {
      await setup('success'); await start(); await run(1);
      const other = (await WebAssembly.instantiate(module, { host: imports.host })).exports;
      assert.equal(observer.run(other, 100), 0);
      assert.equal(observer.result.status, 'foreign-instance');
      await setup('success'); await start(); await run(1);
      const originalThread = ex.get_current_thread_id();
      ex.set_current_thread_id(originalThread + 1);
      await run(1);
      assert.equal(observer.result.status, 'thread-changed');
      assert.equal(observer.result.terminal.blocks, 1);
      ex.set_current_thread_id(originalThread);
    } else {
      await setup('success'); await start(); await run(1);
      const before = await host.link._ask({ t: 'readExports', names: ['get_eip', 'get_esp', 'get_ebp'] });
      await host.link._ask({ t: 'drawObserver', action: 'stop' });
      const after = await host.link._ask({ t: 'readExports', names: ['get_eip', 'get_esp', 'get_ebp'] });
      assert.deepEqual(after.values, before.values, 'stop preserves pending guest registers');
      assert.equal((await status()).status, 'stopped-incomplete');
      await setup('success'); await start({ maxMs: 1 });
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal((await status()).status, 'expired-incomplete');
      await setup('success'); await start(); await run(1);
      await host.callExport('get_eip'); // conservative exported-command boundary
      assert.equal((await status()).status, 'intervening-command-incomplete');
    }
    // Load both complete original PE files through the actual loader. Supply
    // only a synthetic caller/dependency global; execute original Draw's real
    // prologue and zero-guard branch in its relocated image. This is isolated
    // machine-code coverage, never a natural original-game observation.
    Atomics.store(new Int32Array(memory.buffer), life >>> 2, 3); // retire old fixture before image-base change
    await stage(exeBytes); assert(await call('load_pe', exeBytes.length));
    await stage(engineBytes);
    const originalAddress = await call('get_next_dll_addr');
    await call('load_dll', engineBytes.length, originalAddress);
    assert((await call('get_last_loaded_dll_index')) >= 0, 'original Engine mapping succeeds');
    const originalTable = await call('get_dll_table'), originalLife = await call('get_dll_lifecycle_table');
    const originalStride = await call('get_dll_lifecycle_stride');
    const originalCount = await call('get_dll_count');
    const originalView = new DataView(memory.buffer);
    const originalIndex = await call('get_last_loaded_dll_index');
    assert(originalIndex < originalCount);
    const originalLoad = originalView.getUint32(originalTable + originalIndex * 32, true);
    const originalGeneration = originalView.getUint32(originalLife + originalIndex * originalStride + 4, true);
    assert(await call('complete_dll_initialize', originalIndex, originalGeneration, 3));
    const originalCaller = await call('guest_alloc', 4096) >>> 0;
    const originalStack = await call('guest_alloc', 4096) >>> 0;
    const dependency = await call('guest_alloc', 4096) >>> 0;
    await write(dependency, u32(0));
    await write(originalLoad + 0x10599d94 - BASE, u32(dependency));
    await write(originalCaller, [0x6a,0,0x6a,0,0x6a,0,0x68,...u32(dependency),
      0xb8,...u32(originalLoad + PC.entry - BASE),0xff,0xd0,0xeb,0xfe]);
    for (const [name, value] of Object.entries({ eip: originalCaller, esp: originalStack + 4000,
      ebp: 0x12345678, ecx: dependency })) await call('set_' + name, value);
    await call('clear_yield'); await start({ maxBlocks: 100, maxMs: 2000 }); await run(100);
    const originalResult = await status();
    captures.push({ fixture: 'full-original-PE-zero-guard-route', result: originalResult });
    assert.equal(originalResult.module.loadAddr, originalLoad);
    assert.equal(originalResult.status, 'bypass-or-missing-checkpoint');
    assert.equal(originalResult.events[0].point, 'entry');
    assert.equal(originalResult.terminal.eip, originalLoad + PC.epilogue - BASE);
    assert.equal(originalResult.observedReturnPair, false, 'actual early original branch is not a render route');
    console.log('PASS full original EXE+Engine PE loader/relocation and exact original Draw zero-guard route');

    if (inWorker) {
      // Teardown is terminal for this endpoint; check it after all PE fixtures.
      await start();
      await host.link._ask({ t: 'retireScopedLoaders', endpointIdentity: host.link.endpointIdentity });
      assert.equal((await status()).status, 'teardown-incomplete');
    }
    if (process.env.DEUSEX_OBSERVER_EVIDENCE) {
      fs.mkdirSync(process.env.DEUSEX_OBSERVER_EVIDENCE, { recursive: true });
      fs.writeFileSync(path.join(process.env.DEUSEX_OBSERVER_EVIDENCE, inWorker ? 'owning-worker.json' : 'local-wasm.json'),
        JSON.stringify({ syntheticInstructionFixtures: true, originalGameExecution: false, captures }, null, 2));
    }
    console.log('PASS actual WASM ' + (inWorker ? 'owning Worker' : 'local exports') + ' routes, relocation, incomplete, module reuse');
  } finally { if (host) await host.stop(); }
}

(async () => {
  const module = await WebAssembly.compile(fs.readFileSync(process.env.WINE_ASSEMBLY_WASM || 'build/wine-assembly.wasm'));
  await exercise(module, false); await exercise(module, true);
})().catch(error => { console.error(error); process.exitCode = 1; });
