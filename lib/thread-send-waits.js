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
  ]);
  class ThreadSendWaits {
    constructor(frames) { this.frames = frames; this.epoch = 0; this.resumes = new Map(); }
    top() { return this.frames[this.frames.length - 1]; }
    observe(yieldReason) {
      const frame = this.top();
      if (!frame || (yieldReason !== 1 && yieldReason !== 7)) return {};
      if (!frame.wait) {
        if (!Number.isSafeInteger(++this.epoch)) throw new Error('Callback wait epoch exhausted');
        frame.wait = { epoch: this.epoch, kind: yieldReason, phase: 'idle' };
      }
      return { frameToken: frame.frameToken, waitEpoch: frame.wait.epoch };
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
      return !frame || !frame.wait || frame.wait.phase === 'idle';
    }
    beforeResume(frameToken, waitEpoch) {
      const frame = this.top();
      if (!frame || frame.frameToken !== frameToken) return false;
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
    fenced() { return this.frames.some(f => f.wait); }
    checkExport(name) {
      if (this.fenced() && !READ_EXPORTS.has(name)) {
        throw new Error('Callback wait reservation fences export ' + name);
      }
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = ThreadSendWaits;
  else root.ThreadSendWaits = ThreadSendWaits;
})(typeof self !== 'undefined' ? self : this);
