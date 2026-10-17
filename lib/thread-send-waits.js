// Frame-owned wait reservations. This code runs inside the receiving Worker
// and the local endpoint, never as a host-side readiness approximation.
(function (root) {
  'use strict';
  // Audited register/global reads in src/13-exports.wat. Getter-shaped names
  // are NOT generally safe: get_sleep_yielded clears state, get_free_list
  // flushes bins, get_edit_text writes guest memory, and has_pending_message
  // pumps sockets. Message progress uses the owned endpoint operation below.
  const READ_EXPORTS = new Set([
    'get_eip', 'get_esp', 'get_eax', 'get_ecx', 'get_edx', 'get_ebx',
    'get_ebp', 'get_esi', 'get_edi', 'get_yield_reason', 'get_yield_flag',
    'get_handler_set_eip', 'get_steps',
    'get_depth', // tiny protocol fixture's pure global read; absent in the VM
    'get_window_thread', // HWND lookup, no guest execution or mutation
  ]);
  class ThreadSendWaits {
    constructor(frames) { this.frames = frames; this.epoch = 0; this.resumes = new Map(); }
    top() { return this.frames[this.frames.length - 1]; }
    beginRootSend(ex) {
      if (this.top()) return { pending: true };
      if ((ex.get_yield_reason() | 0) !== 10) return { ownershipMismatch: true };
      if (!this.rootSend) {
        if (!Number.isSafeInteger(++this.epoch)) throw new Error('Send wait epoch exhausted');
        this.rootSend = { frameToken: 0, waitEpoch: this.epoch, yield: 10 };
      }
      return { ...this.rootSend };
    }
    completeRootSend(token, result, ex) {
      const receipt = this.resumeReceipt(0, token?.waitEpoch);
      if (receipt) return receipt;
      if (!token || token.frameToken !== 0 || this.rootSend?.waitEpoch !== token.waitEpoch)
        return { ownershipMismatch: true };
      if (this.top()) return { pending: true };
      if ((ex.get_yield_reason() | 0) !== 10) return { ownershipMismatch: true };
      if (result?.lastError !== undefined) ex.set_last_error(result.lastError | 0);
      ex.complete_thread_send((result?.result ?? result) | 0);
      this.rootSend = null;
      const reply = { completed: true };
      this.saveResume(0, token.waitEpoch, reply);
      return reply;
    }
    observe(yieldReason) {
      const frame = this.top();
      if (!frame) return {};
      if (yieldReason === 10) {
        if (!frame.sendWait) {
          if (!Number.isSafeInteger(++this.epoch)) throw new Error('Send wait epoch exhausted');
          frame.sendWait = { epoch: this.epoch };
        }
        return { frameToken: frame.frameToken, waitEpoch: frame.sendWait.epoch };
      }
      if ([3, 5, 8, 9, 12, 13, 14, 15, 16].includes(yieldReason)) {
        if (!frame.scope) {
          if (!Number.isSafeInteger(++this.epoch)) throw new Error('Callback yield epoch exhausted');
          frame.scope = { epoch: this.epoch, kind: yieldReason, completed: false };
        }
        return { frameToken: frame.frameToken, waitEpoch: frame.scope.epoch };
      }
      if (yieldReason !== 1 && yieldReason !== 7) return {};
      if (!frame.wait) {
        if (!Number.isSafeInteger(++this.epoch)) throw new Error('Callback wait epoch exhausted');
        frame.wait = { epoch: this.epoch, kind: yieldReason, phase: 'idle' };
      }
      return { frameToken: frame.frameToken, waitEpoch: frame.wait.epoch };
    }
    scopedYield(token, ex, finish = false) {
      const frame = token && this.frames.find(f => f.frameToken === token.frameToken);
      if (!frame || !frame.scope || frame.scope.epoch !== token.waitEpoch
          || !Number.isSafeInteger(token.waitEpoch)) return { ownershipMismatch: true };
      if (frame !== this.top()) return { pending: true };
      const scope = frame.scope;
      if (scope.fault) throw new Error('Callback yield completion fault requires owner retirement: ' + scope.fault);
      if (scope.completed) return { ready: true, completed: true, duplicate: true };
      if ((ex.get_yield_reason() | 0) !== (scope.publication ? (scope.terminal ? 2 : 0) : scope.kind)) return { ownershipMismatch: true };
      if (finish) {
        if (scope.kind === 3 || scope.kind === 5) throw new Error('Loader yield requires owned loader service');
        // One synchronous endpoint operation, no transport gap between pump
        // and clear. Retain its acknowledgement until owned resume.
        try {
          if (scope.kind === 8 && typeof ex.vlan_pump === 'function') ex.vlan_pump();
          ex.clear_yield();
          scope.completed = true;
        } catch (error) {
          // A trapping pump may already have side effects. Never retry it.
          scope.fault = String(error.message || error);
          throw error;
        }
      }
      return { ready: true, completed: scope.completed };
    }
    loader(token, ex, memory, boot, request, advanceGuestTime) {
      const checked = this.scopedYield(token, ex);
      if (!checked.ready) return checked;
      const frame = this.top(), scope = frame.scope;
      if (scope.kind !== 3 && scope.kind !== 5) return { ownershipMismatch: true };
      if (scope.completed) return { ...scope.loaderRequest, ...scope.loaderResult, ready: true, completed: true, duplicate: true };
      if (scope.publication) {
        if (request?.publish) scope.completed = true;
        return { ...scope.loaderResult, ready: true, completed: scope.completed };
      }
      if (!request) {
        if (!scope.loaderRequest) {
          scope.transaction = boot.beginScopedLibraryYield({ exports: ex, memoryBuffer: memory, advanceGuestTime });
          if (!scope.transaction) return { pending: true };
          scope.loaderRequest = scope.transaction.request;
        }
        return { ready: true, ...scope.loaderRequest };
      }
      try {
        if (request.inspectNames) {
          const known = {};
          for (const name of request.inspectNames) {
            if (!ex.api_name_known || !ex.guest_alloc || !ex.guest_write8 || !ex.guest_free) {
              throw new Error('Callback loader dependency inspection exports unavailable');
            }
            const ptr = ex.guest_alloc(name.length + 1) >>> 0;
            if (!ptr) throw new Error('Callback loader dependency inspection allocation failed');
            let failure, value;
            try {
              for (let i = 0; i < name.length; i++) ex.guest_write8(ptr + i, name.charCodeAt(i) & 255);
              ex.guest_write8(ptr + name.length, 0);
              value = !!ex.api_name_known(ptr);
            } catch (error) { failure = error; }
            try { ex.guest_free(ptr); }
            catch (cleanup) {
              if (failure) throw new Error(failure.message + '; dependency inspection cleanup failed: ' + cleanup.message,
                { cause: new AggregateError([failure, cleanup]) });
              throw cleanup;
            }
            if (failure) throw failure;
            known[name] = value;
          }
          return { ready: true, known };
        }
        // The captured name is authoritative; a delayed host reply cannot pick
        // a different request or mutate a newer callback's pending load.
        if (!scope.loaderRequest) throw new Error('Loader request was not captured');
        const transaction = scope.transaction;
        if (!transaction) throw new Error('Loader operation ownership was lost');
        transaction.prepare(request);
        transaction.token = { frameToken: frame.frameToken, waitEpoch: scope.epoch };
        transaction.kind = scope.kind;
        (frame.loaders || (frame.loaders = [])).push(transaction);
        scope.loaderResult = { mapped: true };
        scope.completed = true;
        return { ...scope.loaderResult, ready: true, completed: true };
      } catch (error) {
        scope.fault = String(error.message || error);
        throw error;
      }
    }
    driveLoader(ex) {
      const frame = this.top();
      if (frame.loaderFault) throw new Error('Loader fault requires owner retirement: ' + frame.loaderFault);
      const transaction = frame.loaders?.[frame.loaders.length - 1];
      if (!transaction) return false;
      try {
        const completion = transaction.advance();
        if (completion.done) {
          frame.loaders.pop();
          if (!Number.isSafeInteger(++this.epoch)) throw new Error('Callback loader epoch exhausted');
          frame.scope = { epoch: this.epoch, kind: transaction.kind, publication: true, completed: false,
            terminal: (ex.get_yield_reason() >>> 0) === 2,
            loaderResult: { ...completion.result, mapped: completion.mapped, retired: completion.retired,
              publication: true, loadToken: transaction.token, loaderState: {
              dllCount: ex.get_dll_count() >>> 0, thunkEnd: ex.get_thunk_end() >>> 0,
              numThunks: ex.get_num_thunks() >>> 0,
            } } };
        }
      } catch (error) {
        frame.loaderFault = String(error.message || error);
        throw error;
      }
      return true;
    }
    retireLoaders() {
      // Reverse nesting order preserves native callback-gate depth. Keep the
      // frame graph on failure; a failed cleanup is not an acknowledged stop.
      const seen = new Set();
      for (const frame of [...this.frames].reverse()) {
        const transactions = [...(frame.loaders || []), frame.scope?.transaction].filter(Boolean);
        for (const transaction of transactions.reverse()) {
          if (seen.has(transaction)) continue;
          transaction.cancel(); seen.add(transaction);
        }
      }
      return { retired: true, frames: this.frames.map(frame => ({ frameToken: frame.frameToken,
        waitEpoch: frame.scope?.epoch || frame.wait?.epoch || null })) };
    }
    loaderPublication() {
      const frame = this.top();
      if (!frame?.scope?.publication) return null;
      return { blocked: true, yield: frame.scope.kind, loaderPublication: true,
        frameToken: frame.frameToken, waitEpoch: frame.scope.epoch };
    }
    find(token) {
      if (!token || !Number.isSafeInteger(token.waitEpoch)) return null;
      const frame = this.frames.find(f => f.frameToken === token.frameToken);
      return frame && frame.wait && frame.wait.epoch === token.waitEpoch ? frame : null;
    }
    reserve(token, kind = 1) {
      const frame = this.find(token);
      if (!frame) return { ownershipMismatch: true };
      const wait = frame.wait;
      if (wait.kind !== kind) return { ownershipMismatch: true };
      if (wait.phase !== 'idle') return { reserved: true, phase: wait.phase };
      if (frame !== this.top()) return { pending: true };
      wait.phase = 'reserved';
      return { reserved: true, phase: wait.phase };
    }
    cancel(token) {
      const frame = this.find(token);
      if (!frame) return { ownershipMismatch: true };
      const wait = frame.wait;
      if (wait.phase === 'pending' || wait.phase === 'delivered') return { cancelled: false, consumed: true };
      wait.phase = 'idle';
      return { cancelled: true };
    }
    complete(token, payload, apply, kind) {
      const frame = this.find(token);
      if (!frame) return { ownershipMismatch: true };
      const wait = frame.wait;
      if (wait.kind !== kind) return { ownershipMismatch: true };
      if (wait.phase === 'idle') return { ownershipMismatch: true };
      const encoded = JSON.stringify(payload);
      if (wait.payload && wait.payload !== encoded) throw new Error('Conflicting callback wait completion');
      wait.payload = encoded;
      if (wait.phase === 'delivered') return frame === this.top()
        ? { ...wait.result, delivered: true, duplicate: true } : { pending: true };
      wait.phase = 'pending';
      if (frame !== this.top()) return { pending: true };
      const result = apply(wait.kind);
      if (result && result.resumed === false) {
        wait.phase = 'idle'; wait.payload = null;
        return result;
      }
      wait.phase = 'delivered';
      wait.result = result;
      return { ...result, delivered: true };
    }
    // No abort may drop a reserved or consumed result. The resolver must
    // cancel an unconsumed reservation; a consumed wait must resume normally.
    canAbort(frameToken) {
      if ([...this.resumes.keys()].some(key => key.startsWith(frameToken + ':'))) return false;
      const frame = this.frames.find(f => f.frameToken === frameToken);
      if (frame && (frame.loaderFault || frame.loaders?.length || frame.scope?.publication || frame.scope?.transaction)) return false;
      if (frame && frame.scope && frame.scope.fault) return false;
      return !frame || !frame.wait || frame.wait.phase === 'idle';
    }
    admission(token, yieldReason) {
      const frame = this.top();
      if (!frame && this.rootSend) return token?.frameToken === 0 &&
        token.waitEpoch === this.rootSend.waitEpoch && yieldReason === 10;
      if (!token || frame?.frameToken !== token.frameToken || token.yield !== yieldReason) return false;
      if (yieldReason === 10) return frame.sendWait?.epoch === token.waitEpoch;
      if (yieldReason === 7) return frame.wait?.epoch === token.waitEpoch && frame.wait.phase !== 'delivered';
      if (yieldReason === 15) return frame.scope?.epoch === token.waitEpoch && !frame.scope.completed;
      return false;
    }
    beforeResume(frameToken, waitEpoch) {
      const frame = this.top();
      if (!frame || frame.frameToken !== frameToken) return false;
      if (frame.loaderFault) return false;
      if (frame.sendWait) {
        if (frame.sendWait.epoch !== waitEpoch) return false;
        frame.sendWait = null;
      }
      if (frame.scope) {
        if (frame.scope.epoch !== waitEpoch || !frame.scope.completed) return false;
        frame.scope = null;
      }
      if (frame.wait) {
        if (frame.wait.epoch !== waitEpoch) return false;
        if (frame.wait.phase !== 'delivered') return false;
        frame.wait = null;
      }
      return true;
    }
    resumeReceipt(frameToken, waitEpoch) { return this.resumes.get(frameToken + ':' + waitEpoch); }
    saveResume(frameToken, waitEpoch, result) {
      if (waitEpoch !== undefined) {
        // A later epoch proves the caller received the preceding continuation.
        for (const key of this.resumes.keys()) if (key.startsWith(frameToken + ':')) this.resumes.delete(key);
        this.resumes.set(frameToken + ':' + waitEpoch, result);
      }
    }
    acknowledgeResume(frameToken, waitEpoch) {
      this.resumes.delete(frameToken + ':' + waitEpoch);
      return { acknowledged: true };
    }
    fenced() { return !!this.rootSend || this.frames.some(f => f.wait || f.sendWait || f.scope || f.loaderFault || f.loaders?.length); }
    checkExport(name) {
      if (this.fenced() && !READ_EXPORTS.has(name)) {
        throw new Error('Callback wait reservation fences export ' + name);
      }
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = ThreadSendWaits;
  else root.ThreadSendWaits = ThreadSendWaits;
})(typeof self !== 'undefined' ? self : this);
