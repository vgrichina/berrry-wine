  checkMainYield() {
    if (this.workerBackend?._localSendFrames?.length) return true;
    const e = this.mainInstance.exports;
    if (this._renderSendTargets.has(e)) return true;
    const now = this._waitNow();
    this.noteMainSleep();
    if (this._mainSleepUntil) {
      if (now < this._mainSleepUntil) return true;
      this._mainSleepUntil = 0;
    }
    const yr = e.get_yield_reason();
    if (yr === 10) {
      return !this.resolveCooperativeThreadSend(e);
    }
    if (yr === 17) {
      // The main thread's message call stopped for a send another thread
      // parked on it; deliver it here, then that call runs again.
      this.serviceIncomingSends(e);
      return (e.get_yield_reason() | 0) !== 0;
    }
    if (yr === 9) {
      // Blocked on a critical section another guest thread holds. Clear it so the
      // call is re-entered next batch, by which time the caller has given the
      // other threads a turn. Never spin in WAT for this: the holder may be
      // parked in Atomics.wait for a host import only this thread can serve.
      //
      // A safety net as things stand — the guest's main thread does not park
      // (see $handle_EnterCriticalSection) — and cheap enough to keep so that a
      // change to that rule degrades instead of hanging.
      e.clear_yield();
      return false;
    }
    if (yr === 7) {
      if (!this._hasPendingMessage(e)) {
        this._mainWaitPolls = (this._mainWaitPolls || 0) + 1;
        return true;
      }
      this._mainWaitPolls = 0;
      this._mainWaitStartedAt = 0;
      // Read the resume address straight off the guest stack. NOT
      // _readWaitReturnAddress(): that helper treats "retAddr is outside
      // [get_code_start, get_code_end)" as evidence of a garbage stack and
      // re-derives the address by scanning dbg_prev_eip for a call opcode.
      // Those bounds cover the EXE image only, so a message wait that returns
      // into a loaded DLL -- which is the normal case for an MFC app, whose
      // pump lives in mfc42.dll -- looks garbage and gets rewritten to the
      // wrong instruction. The message-wait path always has a real return
      // address at [esp], so it needs no recovery heuristic.
      const retAddr = e.guest_read32 ? e.guest_read32(e.get_esp()) : 0;
      if (e.resume_message_wait && (e.resume_message_wait() | 0)) {
        e.set_eip(retAddr);
      } else {
        return true;
      }
      return false;
    }
    if (yr === 9) {
      // As with a worker, retry the same import thunk. Returning false lets
      // the caller execute one main slice; if still contended it immediately
      // yields again and workers get the rest of the scheduler turn.
      e.clear_yield();
      this._mainWaitPolls = (this._mainWaitPolls || 0) + 1;
      return false;
    }
    if (yr !== 1) return false; // not waiting
    if (e.apc_wake_wait && (e.apc_wake_wait() | 0)) {
      // Alertable wait with a user APC queued to main: run it (see runSlice).
      this._mainWaitPolls = 0;
      this._mainWaitStartedAt = 0;
      return false;
    }

    const waitHandle = e.get_wait_handle();
    const waitHandlesPtr = e.get_wait_handles_ptr ? e.get_wait_handles_ptr() : 0;
    const waitAll = e.get_wait_all ? !!e.get_wait_all() : false;
