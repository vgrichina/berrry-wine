#!/usr/bin/env node
// A button release is never handed to the guest in the same message pump as
// its press (lib/renderer-input.js takeInput).
//
// A tap, or a click whose two messages queued while the guest was busy, puts
// WM_LBUTTONDOWN and WM_LBUTTONUP back to back. A game that polls button
// STATE once a frame (SDL_GetMouseState -- Dungeons of Dredmor's GUI, whose
// buttons "did nothing" on a quick click) drains both in one PeekMessage loop
// and never sees the button down. The release therefore waits for one empty
// poll (the end of that pump) and a 30ms floor. This checks both conditions,
// that later events keep their order behind it, that a wake is scheduled so a
// parked GetMessage re-polls, that a slow click is untouched, and the A/B
// override.

const { installInputHandlers } = require('../lib/renderer-input');

class FakeRenderer {}
installInputHandlers(FakeRenderer);

const checks = [];
function check(name, ok, detail) {
  checks.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `: ${detail}` : ''}`);
}

const realNow = performance.now.bind(performance);
let fakeNow = 1000;
performance.now = () => fakeNow;
const timers = [];
const realSetTimeout = global.setTimeout;
global.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
global.window = {};

function renderer() {
  const r = new FakeRenderer();
  r.inputQueue = [];
  r.wakes = 0;
  r._stepWakeHooks = new Set([() => { r.wakes++; }]);
  return r;
}
const down = () => ({ msg: 0x0201, wParam: 1, lParam: 0, hwnd: 0x10001 });
const up = () => ({ msg: 0x0202, wParam: 0, lParam: 0, hwnd: 0x10001 });
const move = () => ({ msg: 0x0200, wParam: 0, lParam: 0, hwnd: 0x10001 });
const drainTimer = () => { const t = timers.shift(); if (t) t.fn(); return t; };

{
  // A tap: press and release queued together, then a move.
  const r = renderer();
  r.inputQueue.push(down(), up(), move());
  const a = r.takeInput(null);
  check('the press is delivered at once', a && a.msg === 0x0201);
  check('the release is withheld: the pump that took the press ends', r.takeInput(null) === null);
  check('nothing behind the release jumps ahead of it', r.inputQueue.length === 2 && r.inputQueue[0].msg === 0x0202);
  const t = drainTimer();
  check('a wake is scheduled so a parked GetMessage polls again', !!t && t.ms > 0 && t.ms <= 30, t ? `${t.ms}ms` : 'none');
  check('the wake reaches the host step hooks', r.wakes === 1);
  check('still withheld before the 30ms floor', r.takeInput(null) === null);
  drainTimer();
  fakeNow += 30;
  const b = r.takeInput(null);
  check('after an empty poll and the floor the release is delivered', b && b.msg === 0x0202);
  const c = r.takeInput(null);
  check('then the move', c && c.msg === 0x0200);
}

{
  // Time alone is not enough: a release that arrives long after the press
  // but in the same pump (no empty poll between) still waits one poll.
  const r = renderer();
  r.inputQueue.push(down());
  r.takeInput(null);
  fakeNow += 500;
  r.inputQueue.push(up());
  check('a late release with no poll in between waits one poll', r.takeInput(null) === null);
  drainTimer();
  const b = r.takeInput(null);
  check('and is delivered on the next one', b && b.msg === 0x0202);
}

{
  // A slow click: the guest polled empty while the button was held.
  const r = renderer();
  r.inputQueue.push(down());
  r.takeInput(null);
  fakeNow += 120;
  check('an empty queue poll while held', r.takeInput(null) === null);
  r.inputQueue.push(up());
  const b = r.takeInput(null);
  check('a slow click (an empty poll while held) is not delayed at all', b && b.msg === 0x0202);
  check('and schedules nothing', timers.length === 0);
}

{
  // Independent buttons, an unmatched release, and the A/B override.
  const r = renderer();
  r.inputQueue.push(up());
  const a = r.takeInput(null);
  check('an unmatched release passes straight through', a && a.msg === 0x0202);
  r.inputQueue.push({ msg: 0x0204, wParam: 2, lParam: 0, hwnd: 0x10001 }, up());
  const b = r.takeInput(null);
  const c = r.takeInput(null);
  check('a left release is not held by a right press', b && b.msg === 0x0204 && c && c.msg === 0x0202);
  timers.length = 0;
  window.__waMinButtonHoldMs = -1;
  const r2 = renderer();
  r2.inputQueue.push(down(), up());
  r2.takeInput(null);
  const d = r2.takeInput(null);
  check('__waMinButtonHoldMs < 0 turns the hold off (A/B)', d && d.msg === 0x0202);
  delete window.__waMinButtonHoldMs;
}

{
  // A headless host runs the guest on its own clock (test/run.js: 200ms of
  // guest time per batch, in microseconds of wall time while the guest is
  // parked). With _inputNowMs set the hold is measured there: a frozen wall
  // clock must not keep a click's release -- and every drag event queued
  // behind it -- from ever being delivered (Bricks' block drag).
  const r = renderer();
  let guestMs = 5000;
  r._inputNowMs = () => guestMs;
  r.inputQueue.push(down(), up(), move());
  r.takeInput(null);
  check('host clock: release withheld in the press pump', r.takeInput(null) === null);
  r.takeInput(null);  // the pump's empty-ish poll leaves it polled
  guestMs += 200;     // one headless batch of guest time; the wall clock does not move
  const rel = r.takeInput(null);
  check('host clock: release delivered once guest time passes the floor, wall clock frozen',
    rel && rel.msg === 0x0202);
  const mv = r.takeInput(null);
  check('host clock: the queued move follows it', mv && mv.msg === 0x0200);
}

{
  // test/run.js also sets _buttonHoldFloorMs = 0: its clock moves a whole
  // batch at a time, so a 30ms floor pushed every release into the next
  // batch, behind the next scripted press (Paint's tool clicks and drags).
  // The empty-poll rule must still hold within the frozen batch.
  const r = renderer();
  const guestMs = 7000;
  r._inputNowMs = () => guestMs;
  r._buttonHoldFloorMs = 0;
  r.inputQueue.push(down(), up(), down());
  r.takeInput(null);
  check('floor 0: release still withheld in the press pump', r.takeInput(null) === null);
  const rel = r.takeInput(null);
  check('floor 0: delivered on the next poll with the batch clock frozen', rel && rel.msg === 0x0202);
  const next = r.takeInput(null);
  check('floor 0: the next press keeps its place behind the release', next && next.msg === 0x0201);
}

{
  // test/run.js sets _buttonHoldFloorMs = -1: its --input script is the
  // press timing, so the release is handed over at once, as before 37ff2f8df.
  const r = renderer();
  r._buttonHoldFloorMs = -1;
  r.inputQueue.push(down(), up());
  r.takeInput(null);
  const rel = r.takeInput(null);
  check('negative host floor: the hold is off for that host', rel && rel.msg === 0x0202);
}

performance.now = realNow;
global.setTimeout = realSetTimeout;
delete global.window;
const failed = checks.filter(ok => !ok).length;
console.log(`\n${checks.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
