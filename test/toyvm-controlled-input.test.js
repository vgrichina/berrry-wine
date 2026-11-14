'use strict';

// PURE_CONTROL_ONLY_NO_NATIVE. No emulator, fixture, Machine, WASM or browser.
const assert = require('assert/strict');
const { spawn } = require('child_process');
const { createController } = require('../tools/toyvm/controlled-input');

const command = (s, action = { kind: 'key', key: 'Enter', code: 'Enter' }) =>
  ({ targetId: s.targetId, frameId: s.frameId, digest: s.digest, action });
function mock() {
  const calls = [];
  let pixel = 0, owner = true;
  return { calls, change: () => pixel++, replace: () => { owner = false; },
    capture: () => ({ width: 1, height: 1, text: false, rgba: Buffer.from([pixel, 0, 0, 255]) }),
    ownsTarget: () => owner,
    keyDown: (...a) => calls.push(['keyDown', ...a]),
    mouseInput: (...a) => calls.push(['mouseInput', ...a]),
    releaseKeys: () => calls.push(['releaseKeys']),
    releaseMouse: () => calls.push(['releaseMouse']),
  };
}
async function withControl(review, fn, extra = {}) {
  const options = { at: 0, deadline: Date.now() + 5000, review, dedicatedProcess: true, ...extra };
  const c = await createController(options);
  try { await fn(c, options); } finally { await c.close(); }
}

async function subprocess(mode) {
  const child = spawn(process.execPath, [__filename, mode], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', b => { stdout += b; });
  child.stderr.on('data', b => { stderr += b; });
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  const result = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timer);
  assert.match(stdout, /ARMED/);
  assert.match(stdout, /WATCHDOG_PID=\d+/);
  assert.equal(result.code, null, stderr);
  assert.equal(result.signal, 'SIGKILL');
  assert(!stdout.includes('REPLAYED'));
  // The actual independent watchdog exits after the owner kill, including on
  // blocked JS. Wait for its /proc entry to disappear, bounded to 1s.
  const pid = Number(/WATCHDOG_PID=(\d+)/.exec(stdout)[1]);
  console.log(JSON.stringify({ label: 'PURE_CONTROL_ONLY_NO_NATIVE', mode, ownerPid: child.pid,
    watchdogPid: pid, ...result, stdout: stdout.trim() }));
  const fs = require('fs');
  for (let i = 0; i < 50 && fs.existsSync(`/proc/${pid}`); i++) {
    // A reparented zombie is terminated, awaiting the container init reaper.
    try {
      if (fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].startsWith('Z ')) return;
    } catch (err) { if (err.code === 'ENOENT') return; throw err; }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert(!fs.existsSync(`/proc/${pid}`), 'watchdog must terminate');
}

async function main() {
  await assert.rejects(createController({ at: 0, deadline: Date.now() + 5000, review: command }), /invalid/);
  await assert.rejects(createController({ at: 0, deadline: Infinity, review: command, dedicatedProcess: true }), /deadline/);
  const m = mock();
  await withControl(command, async (c, options) => {
    const expiry = c.watchdog.deadline;
    options.deadline += 100000; options.review = () => { throw new Error('substituted'); };
    const receipt = await c.act(m);
    assert.equal(c.watchdog.deadline, expiry); assert.equal(receipt.delivered, true);
    assert.deepEqual(m.calls, [['keyDown', 'Enter', 'Enter']]);
    await assert.rejects(c.act(m), /consumed/);
    c.release(); c.release();
    assert.deepEqual(m.calls.slice(1), [['releaseKeys'], ['releaseMouse']]);
  });
  for (const kind of ['wrongTarget', 'wrongFrame', 'wrongDigest', 'changed', 'replaced', 'invalid', 'null', 'stale']) {
    const target = mock();
    await withControl(async s => {
      const cmd = command(s);
      if (kind === 'wrongTarget') cmd.targetId = 'other';
      if (kind === 'wrongFrame') cmd.frameId = 'other';
      if (kind === 'wrongDigest') cmd.digest = 'other';
      if (kind === 'changed') target.change();
      if (kind === 'replaced') target.replace();
      if (kind === 'invalid') cmd.action = { kind: 'writeMemory' };
      if (kind === 'null') return null;
      if (kind === 'stale') await new Promise(resolve => setTimeout(resolve, 15));
      return cmd;
    }, async c => {
      await assert.rejects(c.act(target), /stale|unsupported/);
      assert.deepEqual(target.calls, []);
      await assert.rejects(c.act(target), /consumed/);
    }, kind === 'stale' ? { maxFrameAgeMs: 1 } : {});
  }
  const mouse = mock();
  await withControl(s => command(s, { kind: 'mouse', x: 320, y: 100, buttons: 1 }), async c => {
    await c.act(mouse); await c.close();
    assert.deepEqual(mouse.calls, [['mouseInput', 320, 100, 1], ['releaseKeys'], ['releaseMouse']]);
    await assert.rejects(c.act(mouse), /expired/);
  });
  const throwing = mock();
  throwing.keyDown = () => { throwing.calls.push(['down-throws']); throw new Error('hardware failure'); };
  await withControl(command, async c => {
    await assert.rejects(c.act(throwing), /hardware failure/);
  });
  assert.deepEqual(throwing.calls, [['down-throws'], ['releaseKeys'], ['releaseMouse']]);
  for (const mode of ['--blocked-review', '--blocked-held', '--throw-release']) await subprocess(mode);
  console.log('PASS PURE_CONTROL_ONLY_NO_NATIVE: frame/target/review/one-shot/release/immutable-deadline and independent owned-process termination');
}

async function victim(mode) {
  const target = mock();
  const c = await createController({ at: 0, deadline: Date.now() + 700,
    dedicatedProcess: true, review: mode === '--blocked-review' ? () => new Promise(() => {}) : command });
  console.log(`ARMED WATCHDOG_PID=${c.watchdog.pid}`);
  if (mode === '--throw-release') {
    await c.act(target);
    target.releaseKeys = () => { throw new Error('release failure'); };
    await assert.rejects(c.close(), /release failure/);
  } else await c.act(target);
  // A normal in-process timeout cannot fire here. Only the independent child
  // can bound this owner. Nothing imports or starts a guest runtime.
  while (true) { /* harmless disposable process */ }
}

(process.argv[2] ? victim(process.argv[2]) : main()).catch(err => {
  console.error(err); process.exitCode = 1;
});
