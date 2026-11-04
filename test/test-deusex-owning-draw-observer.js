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
  b.writeUInt32LE(dll ? 0x190000 : 0x2000, o + 56); b.writeUInt32LE(0x200, o + 60);
  b.writeUInt16LE(3, o + 68); b.writeUInt32LE(0x100000, o + 72);
  b.writeUInt32LE(16, o + 92);
  b.write('.text', s); b.writeUInt32LE(dll ? 0x18f000 : 0x1000, s + 8);
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
    const cases = { success: 'render-route-return-candidate-unverified-lifetime',
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
    for (const [kind, expected] of Object.entries(cases)) {
      await setup(kind); await start({ maxBlocks: kind === 'loop' ? 12 : 100, maxMs: 2000,
        snapshots: [{ point: 'savedCaller', viewport, engine }], module: { loadAddr: 123, generation: 999 } });
      assert.equal(await status(), null, 'caller-supplied metadata cannot complete the observation');
      // Cross multiple actual Worker slice boundaries, retaining one invocation.
      for (let i = 0; i < 20 && !await status(); i++) await run(1);
      const result = await status(); assert(result, kind);
      assert.equal(result.status, expected, kind + ' worker=' + inWorker);
      assert.equal(result.engineRender, null); assert.equal(result.viewportPlayer, null);
      assert.equal(result.module.loadAddr, load);
      if (kind === 'success') {
        assert.deepEqual(result.events.map(e => e.point), ['entry', 'lockCall', 'lock', 'unlockCall', 'unlock', 'tailCall', 'tail', 'epilogue', 'savedCaller']);
        assert.equal(result.events[0].viewport, viewport);
        assert.equal(result.events[0].ecx, engine);
        assert.equal(result.events.at(-1).esp, esp + 20);
      }
    }
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

    // Module retirement/reuse, despite unchanged bytes and same load address.
    await setup('success'); await start(); await run(1);
    Atomics.add(new Int32Array(memory.buffer), (life + 4) >>> 2, 1);
    await run(1); assert.equal((await status()).status, 'module-changed');

    // The capture mechanism cannot be completed by a foreign exports instance.
    if (!inWorker) {
      await setup('success'); await start(); await run(1);
      const other = (await WebAssembly.instantiate(module, { host: imports.host })).exports;
      assert.equal(observer.run(other, 100), 0);
      assert.equal(observer.result.status, 'foreign-instance');
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
      await setup('success'); await start(); await run(1);
      await host.link._ask({ t: 'retireScopedLoaders', endpointIdentity: host.link.endpointIdentity });
      assert.equal((await status()).status, 'teardown-incomplete');
    }
    console.log('PASS actual WASM ' + (inWorker ? 'owning Worker' : 'local exports') + ' routes, relocation, incomplete, module reuse');
  } finally { if (host) await host.stop(); }
}

(async () => {
  const module = await WebAssembly.compile(fs.readFileSync(process.env.WINE_ASSEMBLY_WASM || 'build/wine-assembly.wasm'));
  await exercise(module, false); await exercise(module, true);
})().catch(error => { console.error(error); process.exitCode = 1; });
