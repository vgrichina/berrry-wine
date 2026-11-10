'use strict';

// Called between guest slices, while the scheduler owns the stopped main.
// Read deadlines from that same owner; shared memory is not a register mirror.
async function serviceMainTimingWait(owner, {batchClock, tickState, vblank, spin, trace}) {
  const state = await owner.read(['get_yield_reason', 'get_vblank_deadline_ms', 'get_spin_deadline_ms']);
  const reason = state.get_yield_reason;
  if (reason !== 13 && reason !== 14 && reason !== 15) return false;
  const deadline = (reason === 13 ? state.get_vblank_deadline_ms :
    reason === 14 ? state.get_spin_deadline_ms : 0) >>> 0;
  // Charge against the batch base, not the latest per-call clock value.
  // Vblank must pass its boundary. Spin uses the next normal batch tick,
  // except when that clock has explicitly been frozen with a zero step.
  const charge = reason === 13 || (reason === 14 && batchClock.getTickMsPerBatch() <= 0);
  const owed = charge ? Math.max(0, ((deadline + 1) - batchClock.batchTicks()) | 0) : 0;
  tickState.pausedMs += owed;
  if (reason === 13) { vblank.waits++; vblank.guestMsAdded += owed; }
  else {
    if (reason === 14) spin.clockWaits++; else spin.peekWaits++;
    spin.guestMsAdded += owed;
  }
  if (trace) trace(`[yield] T0 reason=${reason} (${reason === 13 ? 'vblank_wait' :
    reason === 14 ? 'clock_spin' : 'peek_spin'}) due=${deadline} now=${tickState.lastTick} charged=${owed}ms`);
  await owner.call('clear_yield');
  return true;
}

module.exports = {serviceMainTimingWait};
