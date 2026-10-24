    // Handle the virtual LAN net_wait yield (yield_reason=8). The guest is
    // parked inside a blocking socket call with EIP still on the thunk, so
    // clearing the yield re-enters the same handler with the same
    // arguments. Yielding to the event loop first is what lets inbound
    // frames actually arrive: on a ProcessWire they come in over IPC, and
    // nothing is delivered while this synchronous loop holds the thread.
    if (instance.exports.get_yield_reason() === 8) {
      // This cap is here to notice a wire that has stalled, and it counts
      // waits because a blocking socket call makes one per attempt. A 16-bit
      // task parked on a continuation slot is a different shape: it is bounded
      // by its own wall-clock timeout and can legitimately spend hundreds of
      // thousands of turns inside it, so counting those trips the cap on a
      // wait that is working exactly as designed. A TPM_RETURNCMD popup menu
      // parks the same way for as long as it stays open.
      if (!(instance.exports.win16_pump_parked && instance.exports.win16_pump_parked()) &&
          !(instance.exports.menu_track_parked && instance.exports.menu_track_parked())) {
        if (netWaits++ === 0) netWaitSince = Date.now();
      }
      // On the wall clock a guest's own timed wait (a synchronous DirectPlay
      // EnumSessions holds for up to 5 s) does end, and a fast box makes
      // 20000 attempts well inside it; so there the cap also needs 30 s with
      // no progress. On the batch clock no guest deadline passes while it
      // waits, and the count alone is what ends a stalled wire.
      if (netWaits > VLAN_MAX_WAITS && (!REAL_TICKS || Date.now() - netWaitSince > 30000)) {
        console.log(`[net] no progress after ${VLAN_MAX_WAITS} blocking waits; stopping`);
        stopped = true;
        break;
      }
      if (TRACE_YIELD) {
        console.log(`[yield] T0 reason=8 (net_wait) eip=${hex(instance.exports.get_eip())} ` +
          `esp=${hex(instance.exports.get_esp())}`);
      }
      instance.exports.clear_yield();
      await new Promise(resolve => setImmediate(resolve));
      if (instance.exports.vlan_pump) instance.exports.vlan_pump();
    } else {
      netWaits = 0;
