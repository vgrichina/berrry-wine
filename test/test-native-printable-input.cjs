'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto'), net = require('node:net');
const { once } = require('node:events');
const { startControlSession } = require('./control-session');
const { fixture } = require('../tools/native-printable-fixture.cjs');
const pause = ms => new Promise(r => setTimeout(r, ms));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');

function units() {
  const { createGuardedInput } = require('../lib/cli-guarded-input');
  const checks = [];
  for (const mode of ['normal', 'wrongactor', 'wrongthread', 'wrongmemory', 'sibling', 'lookalike', 'owner', 'focus', 'modal',
    'reuse', 'retired', 'cancel-before', 'cancel-between', 'late-char', 'char-first', 'missing-char']) {
    let clock = 1000, context = 1, healthy = true, effects = 0, ups = 0;
    const queue = [], buffer = {}, actorExports = { get_window_thread: () => 1 }, refs = { queue, buffer, actorExports, tid: 1, hwnd: 1 };
    const g = createGuardedInput({ nativeDelivery: true, nativeProofRequired: true, now: () => clock, monotonic: () => clock,
      snapshot: () => ({ healthy, refs }), captureDelivery: () => context, validateDelivery: c => c === context,
      cleanup: () => { ups++; } });
    const owner = g.bind(), ticket = g.prepare({ ...owner, nonce: mode, reviewed: true, deadline: 1500 },
      { action: 'keydown', code: 67, charCode: 67 });
    const down = { hwnd: 1, msg: 0x100, wParam: 67, lParam: 0x2e0001 }, char = { ...down, msg: 0x102 };
    if (mode === 'cancel-before') g.release(owner.owner);
    g.consume(ticket, () => { effects++; queue.push(down); if (mode !== 'missing-char') queue.push(char); });
    if (['cancel-before', 'missing-char'].includes(mode)) {
      assert(!ticket.consumed); assert.equal(effects, mode === 'cancel-before' ? 0 : 1);
    } else {
      const dt = g.dequeued(down), ct = g.dequeued(char); assert(dt && ct && dt !== ct);
      const proof = event => ({ ...event, buffer, actorExports, threadId: 1, apiKind: 2, remove: 0 });
      if (mode === 'char-first') {
        assert(!g.nativeConsumed(ct, proof(char))); assert.equal(ticket.state, 'UNKNOWN');
        assert(!g.nativeConsumed(dt, proof(down))); g.close(); checks.push(mode); continue;
      }
      assert.equal(g.nativeConsumed(dt, proof(down)), true); assert(!ticket.consumed, 'DOWN alone is never text');
      assert(g.nativeConsumed(dt, { ...proof(down), apiKind: 1, remove: 1 }), 'PM_NOREMOVE then Get stays valid');
      let p = proof(char);
      if (mode === 'wrongactor') p.actorExports = {};
      if (mode === 'wrongthread') p.threadId = 2;
      if (mode === 'wrongmemory') p.buffer = {};
      if (mode === 'sibling') p.hwnd = 2;
      if (mode === 'lookalike') p.wParam++;
      if (mode === 'owner') g.bind();
      if (['focus', 'modal', 'reuse'].includes(mode)) context++;
      if (mode === 'retired') healthy = false;
      if (mode === 'cancel-between') g.release(owner.owner);
      if (mode === 'late-char') clock = 1500;
      assert.equal(g.nativeConsumed(ct, p), mode === 'normal');
      assert.equal(ticket.consumed, mode === 'normal');
      if (mode === 'normal') {
        assert.deepEqual(g.receipt(ticket).nativeMessages.map(e => e.msg), [0x100, 0x102]);
        const at = ticket.consumedAt; assert(g.nativeConsumed(ct, { ...p, remove: 1 })); assert.equal(ticket.consumedAt, at);
      } else { g.release(owner.owner); assert(!g.nativeConsumed(ct, proof(char))); }
    }
    g.consume(ticket, () => effects++); assert(effects <= 1); g.close(); assert(ups <= 1); checks.push(mode);
  }
  const { validatePrintable } = require('../lib/cli-native-printable');
  const focus = { hwnd: '0x1', generation: '1', processId: 1, threadId: 1, live: true, visible: true,
    controlClass: 0, isChild: false, style: 0 };
  const scene = { windows: [focus], focusWindow: focus, focus: '0x1', mainHwnd: '0x1', focusTopLevel: '0x1',
    physicalUp: true, modalHwnd: '0x0', capture: '0x0' };
  const renderer = { handleKeyDown() {}, handleKeyPress() {} }, event = { action: 'keydown', code: 67, charCode: 67 };
  assert.doesNotThrow(() => validatePrintable(event, scene, renderer));
  for (const charCode of [0, 8, 13, 31, 127, 0xd800, 0x1f600, NaN]) assert.throws(() => validatePrintable({ ...event, charCode }, scene, renderer));
  for (const code of [0, 9, 13, 17, 27, 37, 112, 255]) assert.throws(() => validatePrintable({ ...event, code }, scene, renderer));
  for (const change of [{ physicalUp: false }, { modalHwnd: '0x2' }, { capture: '0x1' }, { focus: '0x2' },
    { windows: [{ ...focus, generation: '2' }] }, { windows: [{ ...focus, controlClass: 2 }] },
    { windows: [{ ...focus, threadId: 2 }] }, { windows: [{ ...focus, visible: false }] }])
    assert.throws(() => validatePrintable(event, { ...scene, ...change }, renderer));
  return checks;
}

async function native(out, { worker = false, reference = false } = {}) {
  fs.mkdirSync(out, { recursive: true });
  const save = (n, v) => fs.writeFileSync(path.join(out, n), JSON.stringify(v, null, 2) + '\n', { flag: 'wx' });
  const bytes = fixture(), exe = path.join(out, 'printable.exe'); fs.writeFileSync(exe, bytes);
  save('source.json', { gitSHA: cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    fixtureSHA256: hash(bytes), moduleSHA256: hash(fs.readFileSync(process.env.C3_CONSUMER_WASM || 'build/wine-assembly.wasm')),
    worker, reference, originalStarted: false });
  const wd = cp.spawn(process.execPath, ['-e', `let pid;const t=setTimeout(()=>{console.log('FIRED');if(pid)try{process.kill(-pid,'SIGTERM')}catch{};process.exitCode=2},25000);console.log('ARMED');process.stdin.on('data',b=>pid=+b);process.stdin.on('end',()=>clearTimeout(t));`]);
  let wo = '', we = ''; wd.stdout.on('data', b => wo += b); wd.stderr.on('data', b => we += b); const ww = once(wd, 'close');
  while (!wo.includes('ARMED')) await pause(2);
  save('watchdog-arm.json', { pid: wd.pid, prearmed: true, seconds: 25 });
  const server = net.createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port; await new Promise(r => server.close(r));
  const s = startControlSession(['test/run.js', '--exe=' + exe, '--no-build', worker ? '--threads' : '--no-threads',
    '--wasm=' + (process.env.C3_CONSUMER_WASM || 'build/wine-assembly.wasm'), '--real-ticks', '--screen=800x600',
    '--control-stdin', '--control=' + port, '--max-seconds=20', '--max-batches=10000000', '--stuck-after=0',
    '--quiet-api', '--quiet-blocks', '--trace-thread', '--no-close', '--public-consumer-trace=' + path.join(out, 'public-consumers.jsonl')],
    { spawnOptions: { detached: true } });
  wd.stdin.write(String(s.child.pid)); let release, rw;
  try {
    let snap; const due = Date.now() + 10000;
    do { snap = await s.send({ action: 'snapshot' }); if (snap.focusWindow?.live && snap.windows.length >= 2) break;
      assert(Date.now() < due); await pause(10); } while (true);
    if (!reference) await s.send({ action: 'eval', code: `(()=>{const g=ctx.guardedInput,original=g.nativeConsumed.bind(g);globalThis.printableProofNegatives=0;g.nativeConsumed=(token,p)=>{if(p.msg===0x102){for(const bad of [{...p,buffer:new ArrayBuffer(16)},{...p,actorExports:{}},{...p,threadId:99},{...p,hwnd:p.hwnd+1},{...p,msg:0x100},{...p,wParam:p.wParam+1},{...p,lParam:p.lParam+1},{...p,apiKind:0},{...p,apiKind:1,remove:0}]){if(original(token,bad)!==false)throw Error('mismatched actual character proof accepted');globalThis.printableProofNegatives++}}return original(token,p)};return true})()` });
    const owner = await s.send({ action: 'guarded-bind' });
    if (!reference) {
      for (const cmd of ['keytext:67:13', 'keytext:67:128', 'keytext:27:67', 'keytext:67:NaN', 'keypress:67'])
        await assert.rejects(s.send({ action: 'guarded-input', cmd,
          guard: { ...owner, nonce: crypto.randomUUID(), reviewed: true, deadline: Date.now() + 500 } }), /unsupported|keytext needs/);
      const refused = await s.send({ action: 'snapshot' });
      assert(refused.physicalUp); assert.equal(refused.windows.find(w => w.hwnd === refused.mainHwnd).title, snap.windows.find(w => w.hwnd === snap.mainHwnd).title);
      save('unsupported-before-effects.json', { pass: true, cases: 5, physicalUp: true });
    }
    // No observation or decision during this physical hold. Both edges and
    // printable character are fixed before the independent releaser is armed.
    const nonce = crypto.randomUUID();
    release = cp.spawn(process.execPath, ['-e', `const http=require('node:http');console.log('ARMED');setTimeout(()=>{const sent=Date.now(),r=http.request('http://127.0.0.1:${port}/ctl',{method:'POST'},res=>{let b='';res.on('data',v=>b+=v);res.on('end',()=>console.log(JSON.stringify({sent,at:Date.now(),reply:JSON.parse(b)})))});r.on('error',e=>{console.error(e);process.exitCode=1});r.setTimeout(250,()=>r.destroy(Error('UP timeout')));r.end(JSON.stringify({action:'guarded-release',owner:${JSON.stringify(owner.owner)}}))},1400);`]);
    let ro = '', re = ''; release.stdout.on('data', b => ro += b); release.stderr.on('data', b => re += b); rw = once(release, 'close');
    while (!ro.includes('ARMED')) await pause(2);
    save('release-arm.json', { pid: release.pid, beforeDown: true });
    const start = Date.now();
    const down = await s.send({ action: 'guarded-input', cmd: reference ? 'keydown:67' : 'keytext:67:67', guard: { ...owner, nonce, reviewed: true, deadline: start + 500 } });
    const downAt = Date.now();
    const character = reference ? await s.send({ cmd: 'keypress:67' }) : down.nativeMessages?.[1];
    const characterAt = Date.now();
    await rw; assert.equal(release.exitCode, 0, re); const up = JSON.parse(ro.trim().split('\n').at(-1));
    save('release-wait.json', { exit: release.exitCode, signal: release.signalCode, actualWait: true,
      stdoutEOF: release.stdout.readableEnded, stderrEOF: release.stderr.readableEnded, stdout: ro, stderr: re });
    assert(up.reply.ok && up.reply.value.released); assert(up.at < start + 1750);
    let caption;
    do { snap = await s.send({ action: 'snapshot' }); caption = snap.windows.find(w => w.hwnd === snap.mainHwnd).title;
      if (caption === 'DCU') break; assert(Date.now() < start + 2800, 'native order: ' + caption); await pause(10); } while (true);
    assert(down.consumed); assert.equal(reference ? down.nativeMessage.msg : down.nativeMessages?.[0]?.msg, 0x100); assert(downAt < start + 500);
    if (!reference) {
      assert.equal(down.nativeMessages.length, 2); assert.equal(character.msg, 0x102);
      assert.equal(character.wParam, 67); assert.equal(character.lParam, down.nativeMessages[0].lParam);
      assert.equal(character.consumption, 'owner-user-return');
      assert.equal(character.threadId, snap.focusWindow.threadId);
      assert.notEqual(character.token, down.nativeMessages[0].token); assert(characterAt < start + 500);
    }
    assert(Date.now() < start + 3000); if (worker) assert(s.output().includes('spawned WORKER thread'));
    const actualProofNegatives = reference ? 0 : await s.send({ action: 'eval', code: 'globalThis.printableProofNegatives' });
    if (!reference) assert(actualProofNegatives >= 9);
    save('assertions.json', { pass: true, referenceOnly: reference, characterReceiptQualified: !reference, caption,
      actualNativeCallbackOrder: ['WM_KEYDOWN', 'WM_CHAR', 'WM_KEYUP'], noTranslatedDuplicate: true,
      down, character, start, downAt, characterAt, up, worker, actualProofNegatives });
  } finally {
    if (s.child.exitCode === null && s.child.signalCode === null) process.kill(-s.child.pid, 'SIGTERM'); await s.exited;
    if (release && release.exitCode === null && release.signalCode === null) { release.kill(); await rw; }
    save('native-wait.json', { exit: s.child.exitCode, signal: s.child.signalCode, actualWait: true,
      stdoutEOF: s.child.stdout.readableEnded, stderrEOF: s.child.stderr.readableEnded, nativeQuit: false });
    fs.writeFileSync(path.join(out, 'native.log'), s.output()); wd.stdin.end(); const [exit, signal] = await ww;
    save('watchdog-wait.json', { exit, signal, actualWait: true, stdoutEOF: wd.stdout.readableEnded,
      stderrEOF: wd.stderr.readableEnded, stdout: wo, stderr: we }); assert.equal(exit, 0);
  }
}
async function ownerNative(out) {
  const { bootRenderHarness } = require('./render-helper');
  const { createGuardedInput } = require('../lib/cli-guarded-input');
  const module = new WebAssembly.Module(fs.readFileSync(process.env.DELPHI5_MODULE_FD || process.env.C3_CONSUMER_WASM || 'build/wine-assembly.wasm'));
  const rows = [];
  for (const worker of [false, true]) {
    const queue = []; let guard, current = null, token = 0, focus = 0;
    const input = {
      check_input: () => { current = queue.shift(); token = current ? guard.dequeued(current) : 0;
        return current ? current.msg | (current.wParam << 16) : 0; },
      check_input_token: () => token, check_input_hwnd: () => current?.hwnd || focus,
      check_input_lparam: () => current?.lParam || 0,
    };
    const h = await bootRenderHarness({ prebuiltModule: module, fonts: 'none', extraHostOverrides: input });
    const e = h.exports, memory = h.memory, pe = fixture();
    new Uint8Array(memory.buffer).set(pe, e.get_staging()); assert(e.load_pe(pe.length));
    let host, ctx = h.hostCtx, call = async (n, ...a) => e[n](...a), slice = async () => e.run(128);
    if (worker) {
      ctx = { getMemory: () => memory.buffer, resourceJson: {}, g2w: p => p - e.get_image_base() + e.get_guest_base() };
      const imports = require('../lib/host-imports').createHostImports(ctx).host;
      Object.assign(imports, input); imports.memory = memory;
      host = new (require('../lib/guest-thread-host').GuestThreadHost)({ memory, module, hostImports: imports,
        sigs: require('../lib/host-import-sigs.generated.json').sigs, workerUrl: path.resolve(__dirname, '../lib/guest-worker.js'), clockIntervalMs: 0 });
      await host.start(); await host.loadPe(pe, 'actual-printable-owner.exe');
      call = (n, ...a) => host.callExport(n, ...a);
      slice = async () => { const r = await host.link.slice(128); assert(!r.trapped, JSON.stringify(r)); };
    }
    ctx.g2w = p => p - e.get_image_base() + e.get_guest_base(); ctx.nativeInputActor = () => e;
    const refs = { queue, buffer: memory.buffer, actorExports: e, tid: 1, hwnd: 0 };
    guard = createGuardedInput({ nativeDelivery: true, nativeProofRequired: true,
      snapshot: () => ({ healthy: true, refs }), cleanup: () => {}, captureDelivery: () => focus, validateDelivery: f => f === focus });
    ctx.guardedInput = guard;
    let negatives = 0; const original = guard.nativeConsumed.bind(guard);
    guard.nativeConsumed = (t, p) => {
      if (p.msg === 0x102) for (const bad of [{ ...p, actorExports: {} }, { ...p, buffer: new ArrayBuffer(16) },
        { ...p, threadId: 99 }, { ...p, lParam: p.lParam + 1 }]) { assert.equal(original(t, bad), false); negatives++; }
      return original(t, p);
    };
    const until = async pred => { for (let n = 0; n < 400; n++) { if (await pred()) return;
      if ([1, 6, 7, 15].includes(await call('get_yield_reason'))) await call('clear_yield'); await slice(); }
      throw Error('actual native printable owner did not progress'); };
    try {
      await call('set_process_id', 1000); await call('set_current_thread_id', 1);
      await call('set_eip', 0x402000); await call('set_esp', 0x7408000); await call('guest_write32', 0x7408000, 0);
      await until(async () => !!await call('get_focus_hwnd')); focus = await call('get_focus_hwnd');
      refs.hwnd = focus;
      const owner = guard.bind(), ticket = guard.prepare({ ...owner, nonce: 'actual-owner', reviewed: true, deadline: Date.now() + 500 },
        { action: 'keydown', code: 67, charCode: 67 });
      guard.consume(ticket, () => queue.push({ hwnd: focus, msg: 0x100, wParam: 67, lParam: 0x2e0001 },
        { hwnd: focus, msg: 0x102, wParam: 67, lParam: 0x2e0001 }));
      if (host) host.broker.publish({ inputPending: 1 });
      await until(async () => ticket.consumed);
      const receipt = guard.receipt(ticket); assert.deepEqual(receipt.nativeMessages.map(p => p.msg), [0x100, 0x102]);
      assert(receipt.nativeMessages.every(p => p.threadId === 1 && p.consumption === 'owner-user-return'));
      assert(negatives >= 4); rows.push({ worker, actualOwnerExecution: true, receipt, negatives });
    } finally { guard.close(); if (host) await host.stop(); }
  }
  fs.writeFileSync(path.join(out, 'actual-owner-proof.json'), JSON.stringify({ pass: true, rows }, null, 2));
}
async function main() {
  const out = path.resolve(process.argv[2]);
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'units.json'), JSON.stringify(units()));
  for (const worker of [false, true]) await native(path.join(out, worker ? 'CPUWorker' : 'cooperative'), { worker, reference: process.argv.includes('--reference') });
  if (!process.argv.includes('--reference')) await ownerNative(out);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { native, units, ownerNative };
