'use strict';

// CLI main executes locally even when guest threads use Worker RPC. Bind each
// registration to the execution context that opened it, never to a shadow VM.
function createCliWaveCallbackRouting({ getMainExports, getThreadManager, getBackend }) {
  let mainWaitSaved = null;
  function owner(exports, tid = 0, rpc = false) {
    if (rpc) {
      const backend = getBackend(), slot = backend?.audioRpcSlot;
      return Number.isInteger(slot) ? { kind: 'worker', backend, slot, link: null } : null;
    }
    return exports ? { kind: 'cooperative', exports, tid } : null;
  }
  async function offer(item) {
    const r = item.registration, o = r?.owner, tm = getThreadManager();
    if (!o || (r.retired && !o.link?._waveOffer)) return { status: 'retired' };
    if (o.kind === 'worker') {
      if (o.backend !== getBackend()) return { status: 'retired' };
      const link = o.backend.threadLinks.get(o.slot);
      if (!o.link) o.link = link || null;
      if (!o.link) return { status: 'busy' };
      if (o.link !== link || !link.worker) return { status: 'retired' };
      const stream = link.waveRegistrations.get(r.handle);
      if (!stream) return { status: 'busy' }; // registration message can follow RPC
      if (!o.stream) {
        if (stream.callback !== r.callback || stream.instance !== r.instance) return { status: 'retired' };
        o.stream = stream;
      }
      if (stream !== o.stream && !link._waveOffer) return { status: 'retired' };
      const thread = [...(tm?.threads.values() || [])].find(t => t.link === link);
      if (!thread) return { status: 'busy' };
      if (thread.state !== 'active') return { status: 'retired' };
      if (thread.suspendCount > 0 || thread.inFlight || thread.freeRunPending || thread.parkedWaitDone) return { status: 'busy' };
      const saved = { waitStartedAt: thread.waitStartedAt || 0, waitPolls: thread.waitPolls || 0,
        lastPollAt: thread.lastPollAt || 0 };
      const result = await link.offerWaveCallback(o.stream, item.waveHdrGA, 1000, r.retired);
      if (result.status === 'accepted') {
        if (!link.worker || thread.state !== 'active') return { status: 'retired' };
        thread.waveWaitSaved = saved;
        thread.parkedWait = thread.parkedWaitDone = null;
        thread.waitStartedAt = thread.waitPolls = thread.lastPollAt = 0;
      }
      return result;
    }
    const e = o.exports;
    const thread = o.tid ? [...(tm?.threads.values() || [])].find(t => t.tid === o.tid && t.instance?.exports === e) : null;
    if (o.tid && (!thread || thread.state !== 'active')) return { status: 'retired' };
    if (!o.tid && e !== getMainExports()) return { status: 'retired' };
    if (thread?.suspendCount > 0 || (!o.tid && tm?.isMainThreadSuspended?.())) return { status: 'busy' };
    if (!e.get_eip() || e.get_yield_reason() === 2) return { status: 'retired' };
    const saved = thread ? { waitStartedAt: thread.waitStartedAt || 0, waitPolls: thread.waitPolls || 0 }
      : { waitStartedAt: tm?._mainWaitStartedAt || 0, waitPolls: tm?._mainWaitPolls || 0 };
    if (!e.fire_wave_out_callback_bound(r.handle, item.waveHdrGA, r.callback, r.instance)) return { status: 'busy' };
    if (thread) { thread.waveWaitSaved = saved; thread.waitStartedAt = thread.waitPolls = 0; }
    else if (tm) { mainWaitSaved = saved; tm._mainWaitStartedAt = tm._mainWaitPolls = 0; }
    return { status: 'accepted' };
  }
  function restoreMainWait() {
    const tm = getThreadManager(), e = getMainExports();
    if (mainWaitSaved && !e.is_mm_timer_callback_active()) {
      if (tm) { tm._mainWaitStartedAt = mainWaitSaved.waitStartedAt; tm._mainWaitPolls = mainWaitSaved.waitPolls; }
      mainWaitSaved = null;
    }
  }
  return { owner, offer, restoreMainWait };
}
module.exports = { createCliWaveCallbackRouting };
