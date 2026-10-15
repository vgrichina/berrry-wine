'use strict';

// Retained original unpacked image, SHA256 42b8f545db0fce60f8f1b22035386c2a6b87653741bbb5ae4a9d24c2b6df76aa.
const codePins = [
  [0x803af6, 271, '522316ac31abca617d193c6dcbde282a5967d825eb4673045df52cd3dc938bb6'],
  [0x805392, 116, '3a8d187806de9b8eafbe9409db93dfc1508cab402d27b4df8c786f84204471b5'],
  [0x81daae, 2958, '14a0093a73e8d1de758c1f782cc72022936425572028bbaeb13c291c91341488'],
  [0x81e8cb, 1047, '458ff0d84a8e84f5e8f3061c29599ac0ca02cb72808e9e6a12e258570b03f3b6'],
];

// Serializable page function. No trace hook, guest call, guest write or key poll.
async function installProgressReader(pins) {
  const w = window.wineShell?.currentWine, e = w?.instance?.exports;
  if (!w?.running || w.guestWorker || !e?.guest_to_wasm) throw Error('Expected cooperative original guest');
  if (window.__kkriegerInputRead) throw Error('Progress reader already installed');
  const bytes = (address, size) => {
    const result = new Uint8Array(size), memory = new Uint8Array(w.memory.buffer);
    for (let i = 0; i < size; i++) {
      const p = e.guest_to_wasm((address + i) >>> 0) >>> 0;
      if (p === 0xf0 || p >= memory.length) throw Error('Unmapped original progress read');
      result[i] = memory[p];
    }
    return result;
  };
  for (const [address, size, expected] of pins) {
    const digest = await crypto.subtle.digest('SHA-256', bytes(address, size));
    const actual = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
    if (actual !== expected) throw Error('Original progress code mismatch at ' + address.toString(16));
  }
  const u32 = address => new DataView(bytes(address, 4).buffer).getUint32(0, true);
  const f32 = address => new DataView(bytes(address, 4).buffer).getFloat32(0, true);
  window.__kkriegerInputRead = () => {
    if (window.wineShell?.currentWine !== w || !w.running || w.guestWorker) throw Error('Guest changed/stopped');
    const object = u32(0x14a0998);
    if (!object || object > 0xffffffff - 0x15544) throw Error('Invalid live input object');
    return {pageMs: performance.now(), object, ticks: u32(object + 0x15540),
      phase: bytes(object + 0x14fe9, 1)[0],
      lastEvent: u32(object + 0x1553c), forward: f32(object + 0x15358),
      strafe: f32(object + 0x1535c), forwardSpeed: f32(object + 0x153b8),
      focus: e.get_focus_hwnd?.() ?? null, mainHwnd: e.get_main_hwnd?.() ?? null,
      pointerLock: !!document.pointerLockElement,
      physicalW: !!w.renderer?._physicalKeys?.[87],
      scope: 'Original input state and update-counter observations; no displacement/FPS claim'};
  };
  return window.__kkriegerInputRead();
}

// Require an observed accepted W state, THEN two separate forward counter
// transitions while that state remains present. Never accept Present as progress.
function advanceHold(state, sample, elapsedMs) {
  if (state.object !== undefined && sample.object !== state.object) throw Error('Input object changed');
  state.object = sample.object;
  const accepted = sample.phase === 0 && sample.physicalW && Number.isFinite(sample.forwardSpeed) &&
    sample.forwardSpeed > 0 && sample.forward === sample.forwardSpeed &&
    sample.focus !== null && sample.focus === sample.mainHwnd;
  if (!accepted) { state.lastTicks = undefined; state.changes = 0; return false; }
  if (state.lastTicks !== undefined) {
    const delta = (sample.ticks - state.lastTicks) >>> 0;
    if (delta > 0 && delta < 0x80000000) state.changes++;
    else if (delta >= 0x80000000) throw Error('Guest update counter reset');
  }
  state.lastTicks = sample.ticks;
  return state.changes >= 2 && elapsedMs >= 10000;
}

async function captureProgressHold({page, shot, event, write, assertDelivery, admit, delay}) {
  admit(160000);
  await assertDelivery();
  write('input-code-pins', codePins);
  write('input-reader-initial', await page.evaluate(installProgressReader, codePins));
  try {
    await shot('progress-idle-before');
    const idle = [];
    for (let i = 0; i < 10; i++) {
      idle.push(await page.evaluate(() => window.__kkriegerInputRead()));
      await delay(2000);
    }
    write('progress-idle', idle); await shot('progress-idle-after');
    await assertDelivery();
    const rows = [], state = {changes: 0};
    let completed = false;
    await shot('progress-forward-before');
    event('keydown', {key: 'w', capMs: 60000, stop: 'two update changes after accepted W; minimum10s'});
    const start = Date.now();
    try {
      await page.keyboard.down('w');
      while (Date.now() - start < 60000) {
        const sample = await page.evaluate(() => window.__kkriegerInputRead());
        rows.push(sample); write('progress-forward-samples', rows);
        completed = advanceHold(state, sample, Date.now() - start);
        if (completed) break;
        await delay(2000);
      }
      // Leave the timeout path immediately; a screenshot must not extend the hold.
      if (completed) await shot('progress-forward-held');
    } finally {
      await page.keyboard.up('w'); event('keyup', {key: 'w', elapsedMs: Date.now() - start});
    }
    const outcome = {acceptedProgress: completed,
      holdOutcome: completed ? 'accepted-state-and-update-counter-advanced' : 'hold-cap-without-accepted-progress',
      ...state, releaseObserved: false, gameplayVerified: false};
    write('progress-forward-observation', outcome);
    const released = [], releaseStart = Date.now();
    while (Date.now() - releaseStart < 60000) {
      const sample = await page.evaluate(() => window.__kkriegerInputRead());
      released.push(sample); write('progress-release-samples', released);
      if (sample.object !== state.object) throw Error('Input object changed during release');
      if (!sample.physicalW && sample.forward === 0) { outcome.releaseObserved = true; break; }
      await delay(2000);
    }
    await shot('progress-forward-after-release');
    outcome.releaseOutcome = outcome.releaseObserved ? 'host-and-guest-release-observed' : 'release-cap-without-observed-clear';
    write('progress-forward-observation', outcome);
    return outcome;
  } finally { await page.evaluate(() => { delete window.__kkriegerInputRead; }); }
}

module.exports = {codePins, installProgressReader, advanceHold, captureProgressHold};
