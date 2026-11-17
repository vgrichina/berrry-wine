'use strict';
// Generated native USER transitions only; no original application or game reads.
//
// Node port of test/test-cli-native-scene-context.py together with the parts of
// its import chain it used (test-sims-error-ok-native.py -> test-sims-null-owner-modal.py
// -> test-sims-untitled-owned-modal.py): the NativeUntitled/NativeNullOwner native
// fixture setUp, the NativeSceneContext tearDown, test_transition,
// test_focus_changed_before_consumption, and --baseline.
//
//   node test/test-cli-native-scene-context-native.cjs OUT FIXTURE [--baseline]
//
// Per-test records land in OUT/<testname>/. A unittest-compatible report goes
// to stderr (verbosity 2; a passing run ends "\nOK\n"); exit 0 iff all pass.
// WINE_PREARM_REQUIRE_TIMING=1 is the Node stand-in for PYTHONPROFILEIMPORTTIME.
const k = require('../tools/native-supervisor-common.cjs');
k.installRequireTiming();
const fs = require('node:fs'), path = require('node:path'), net = require('node:net');
const cp = require('node:child_process'), assert = require('node:assert/strict');
const a = require('../tools/sims-install-controller.cjs');
const c = a.c;

const ROOT = path.resolve(__dirname, '..');
const NATIVE = { out: null, fixture: null, baseline: false };
const CONTROLS = `(()=>{const e=instance.exports,h=e.modal_dialog_hwnd(),out=[];for(let s=0;(s=e.wnd_next_child_slot(h,s))!==-1;s++){const c=e.wnd_slot_hwnd(s);out.push({id:e.ctrl_get_id(c),x:e.wnd_window_screen_x(c),y:e.wnd_window_screen_y(c),w:e.wnd_screen_w(c),h:e.wnd_screen_h(c)})}return out})()`;

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});
const isAssertion = e => e instanceof assert.AssertionError;
async function raises(fn, test = () => true) {
  try { await fn(); } catch (e) { if (!test(e)) throw e; return e; }
  throw new assert.AssertionError({ message: 'expected exception not raised' });
}
const find = (list, pred) => { const v = list.find(pred); if (v === undefined) throw Error('StopIteration'); return v; };

class NativeSceneContext {
  constructor(name) { this.name = name; }

  // NativeUntitled.setUp: generated PE calls CreateWindowEx/MessageBox, actual HTTP guard.
  async setUp() {
    this.out = path.join(NATIVE.out, this.name);
    fs.mkdirSync(path.dirname(this.out), { recursive: true }); fs.mkdirSync(this.out);
    c.R = this.out;
    c.URL = 'http://127.0.0.1:' + await freePort() + '/ctl';
    Object.assign(process.env, { SIMS_CONTROL_OUT: this.out, SIMS_CONTROL_URL: c.URL });
    const port = new URL(c.URL).port;
    const args = ['node', 'test/run.js', '--exe=' + NATIVE.fixture, '--no-build', '--real-ticks',
      '--screen=800x600', '--max-seconds=25', '--max-batches=100000000', '--stuck-after=0',
      '--control=' + port, '--quiet-api', '--quiet-blocks', '--no-close'];
    c.save('recipe.json', { args, cwd: ROOT, seconds: 240, watchdogGrace: 2 });
    this.p = cp.spawn(process.execPath, [path.join(ROOT, 'tools/forsaken-supervisor.cjs'), 'outerwait', this.out],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    this.waited = k.communicate(this.p); this.waited.catch(() => {});
    const end = performance.now() + 15000;
    for (;;) {
      try {
        const s = await c.call({ action: 'snapshot' }, 1);
        if (s.modalHwnd !== '0x0' && fs.existsSync(path.join(this.out, 'native-pid.json'))) break;
      } catch (e) { if (!(e.code || e.name === 'RuntimeError')) throw e; }
      assert(performance.now() < end, 'native fixture readiness');
      await k.sleep(20);
    }
    await c.capture('native-scene');
    this.s = c.read('native-scene.json').snapshot;
    this.main = find(this.s.windows, w => w.hwnd === this.s.mainHwnd);
    this.modal = find(this.s.windows, w => w.hwnd === this.s.modalHwnd);
    assert.equal(this.main.title, '');
    c.save('native-scene-review.json', { at: k.now(), submittedScene: true, rawCompleteScene: true,
      observation: 'Generated native untitled main and owned InstallShield modal fixture',
      pngSHA256: c.read('native-scene.json').pngSHA256, sceneType: 'installer',
      exactReleaseReviewed: true, completeBootstrapReviewed: true, nativeTitle: '', reviewedOwnedModal: this.modal });
    this.expected = { main: this.main, modal: this.modal, nativeProcess: this.s.nativeProcess,
      screen: this.s.screen, focus: this.s.focus, focusWindow: this.s.focusWindow,
      pngSHA256: c.read('native-scene.json').pngSHA256 };
    // NativeNullOwner.setUp: actual MessageBoxA(NULL), genuine owner zero.
    assert.equal(this.modal.owner, '0x0');
    assert.equal(this.modal.threadId, this.main.threadId);
    assert.equal(this.s.nativeMessageBox.hwnd, this.modal.hwnd);
    assert.equal(this.s.nativeMessageBox.controlClass, 16);
    const review = c.read('native-scene-review.json');
    review.reviewedNativeMessageBox = review.reviewedOwnedModal; delete review.reviewedOwnedModal;
    review.observation = 'Generated actual MessageBoxA(NULL) native modal, genuine owner zero';
    fs.writeFileSync(path.join(this.out, 'native-scene-review.json'), JSON.stringify(review));
    Object.assign(this.expected, { modalRoute: 'null-owner-message-box', nativeMessageBox: this.s.nativeMessageBox });
  }

  async tearDown() {
    if (!fs.existsSync(path.join(this.out, 'native-wait.json'))) c.save('cancel-request.json', { fixtureOnly: true, hostStop: true });
    const r = await Promise.race([this.waited, k.sleep(10000).then(() => { throw Error('TimeoutExpired: fixture launcher'); })]);
    c.save('fixture-launcher-wait.json', { pid: r.pid, exit: r.returncode, actualWait: true, stdoutEOF: true, stderrEOF: true,
      stdout: r.stdout.toString(), stderr: r.stderr.toString() });
    for (const name of ['native-wait.json', 'watchdog-wait.json', 'outer-child-wait.json'])
      assert(['actualWait', 'stdoutEOF', 'stderrEOF'].every(n => c.read(name)[n] === true), name);
  }

  async test_focus_changed_before_consumption() {
    const rr = c.read('native-scene.json');
    await c.bind({ route: 'native-scene-v1', snapshot: rr.snapshot, pngSHA256: rr.pngSHA256 });
    await c.call({ action: 'frozen', mode: 'on' });
    const owner = c.read('input-owner.json');
    const queued = await c.call({ action: 'guarded-input', cmd: 'mousedown:187:139', guard: { ...owner, nonce: 'focus-native-negative',
      reviewed: true, deadline: Math.trunc(k.now() * 1000) + 2000, intent: rr.snapshot } });
    assert(!queued.consumed);
    await c.call({ action: 'eval', code: 'instance.exports.set_focus(instance.exports.get_main_hwnd());true' });
    await c.call({ action: 'step', n: 1 });
    const receipt = await c.call({ action: 'guarded-status', nonce: 'focus-native-negative' });
    assert(!receipt.consumed); assert.equal(receipt.state, 'CANCELLED');
    assert.equal(receipt.reason, 'reviewed native scene changed');
    c.save('native-focus-refused.json', receipt); c.fail('fixture deliberately changed native focus; closed', 'negative');
  }

  async test_transition() {
    if (NATIVE.baseline) await a.bind('native-scene');
    else {
      const rr = c.read('native-scene.json');
      await c.bind({ route: 'native-scene-v1', snapshot: rr.snapshot, pngSHA256: rr.pngSHA256 });
    }
    const originalCall = c.call; const current = [null];
    if (!NATIVE.baseline) {
      c.call = (command, timeout = 10) => {
        if (command.action === 'guarded-input') command = { ...command, guard: { ...command.guard, intent: current[0] } };
        return originalCall(command, timeout);
      };
    }
    try {
      for (let index = 0; index < 2; index++) {
        const scene = 'choice' + index; await c.capture(scene); const rr = c.read(scene + '.json'); current[0] = rr.snapshot;
        const controls = await c.call({ action: 'eval', code: CONTROLS });
        const button = find(controls, x => x.id === 1);
        const point = [button.x + Math.floor(button.w / 2), button.y + Math.floor(button.h / 2)];
        const final = index === 1, mode = final ? 'quit' : 'install', route = final ? 'cancel-installer' : 'next';
        c.save(scene + '-review.json', { at: k.now(), pngSHA256: rr.pngSHA256, submittedScene: true, rawCompleteScene: true,
          observation: 'Automated generated native USER fixture only; no personal/original review claim', mode, sceneType: 'installer',
          ordinaryNativeUI: true, visibleLabel: 'OK', installRoute: 'next', serialRequired: false, mediaCheckBypassed: false,
          quitRoute: route, visibleQuitTarget: true, pixelGeometry: { source: 'current-full-scene', target: rr.target, chosenCenter: point } });
        if (NATIVE.baseline && index) {
          await raises(() => a.action('press1', 'mousedown:' + point.join(':'), scene, mode, 400, route), isAssertion);
          assert(!c.read('press1-receipt.json').consumed);
          c.save('baseline-transition-refused.json', { firstModal: this.modal,
            secondModal: find(rr.snapshot.windows, w => w.hwnd === rr.snapshot.modalHwnd), noRebind: true });
          return;
        }
        await a.action('press' + index, 'mousedown:' + point.join(':'), scene, mode, 400, route);
      }
      const end = performance.now() + 5000;
      while (!fs.existsSync(path.join(this.out, 'native-wait.json')) && performance.now() < end) await k.sleep(20);
      assert.equal(c.read('native-wait.json').exit, 0);
      assert(fs.readFileSync(path.join(this.out, 'native.stdout.log'), 'utf8').includes('[Exit] code=0'));
    } finally { c.call = originalCall; }
  }
}

// unittest.TextTestRunner(verbosity=2) shape: setUp error skips tearDown.
async function runSuite(cases) {
  const problems = []; let failures = 0, errors = 0; const start = performance.now();
  for (const t of cases) {
    process.stderr.write(`${t.name} (${t.constructor.name}) ... `);
    let outcome = 'ok';
    const note = (kind, e) => {
      if (outcome === 'ok') outcome = kind === 'FAIL' ? 'FAIL' : 'ERROR';
      if (kind === 'FAIL') failures++; else errors++;
      problems.push(`${kind}: ${t.name} (${t.constructor.name})\n${'-'.repeat(70)}\n${e?.stack ?? e}\n`);
    };
    try { await t.setUp(); } catch (e) { note('ERROR', e); process.stderr.write('ERROR\n'); continue; }
    try { await t[t.name](); } catch (e) { note(isAssertion(e) ? 'FAIL' : 'ERROR', e); }
    try { await t.tearDown(); } catch (e) { note(isAssertion(e) ? 'FAIL' : 'ERROR', e); }
    process.stderr.write(outcome + '\n');
  }
  for (const p of problems) process.stderr.write(`\n${'='.repeat(70)}\n${p}`);
  const seconds = ((performance.now() - start) / 1000).toFixed(3);
  const ok = !failures && !errors;
  const detail = [failures && `failures=${failures}`, errors && `errors=${errors}`].filter(Boolean).join(', ');
  process.stderr.write(`\n${'-'.repeat(70)}\nRan ${cases.length} test${cases.length === 1 ? '' : 's'} in ${seconds}s\n\n${ok ? 'OK' : `FAILED (${detail})`}\n`);
  return ok;
}

function configure(out, fixture, baseline = false) {
  Object.assign(NATIVE, { out: path.resolve(out), fixture: path.resolve(fixture), baseline });
}

module.exports = { NATIVE, NativeSceneContext, runSuite, configure, raises, isAssertion, a, c };

if (require.main === module) {
  const argv = process.argv.slice(2), baseline = argv.includes('--baseline');
  const [out, fixture] = argv.filter(v => v !== '--baseline');
  configure(out, fixture, baseline);
  const names = baseline ? ['test_transition'] : ['test_transition', 'test_focus_changed_before_consumption'];
  runSuite(names.map(n => new NativeSceneContext(n)))
    .catch(e => { console.error(e); return false; })
    .then(ok => process.stderr.write('', () => process.exit(ok ? 0 : 1)));
}
