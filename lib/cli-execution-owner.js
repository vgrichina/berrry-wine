'use strict';

// Await rendering only after the owning guest export has returned. There is
// no suspended JS callback frame, Promise-valued i32 import, or guest register
// mutation by the render owner. Main awaits published work after each soft yield; cooperative threads park
// individually while HTTP and independent input release get event turns.
class CliExecutionOwner {
  constructor(module, memory) {
    this.module = module;
    this.memory = memory;
    this.owners = new Set();
    this.rings = new Map();
    this.closed = false;
    this.pending = new Map();
    this.error = null;
  }
  create(callbacks) {
    if (this.closed) throw new Error('CLI execution owner retired');
    const key = callbacks.ring >>> 0;
    const existing = this.rings.get(key);
    if (existing && !existing.owner.closed) {
      existing.callbacks.add(callbacks);
      return existing.owner;
    }
    const listeners = new Set([callbacks]);
    const { NodeRenderOwner } = require('./gpu-stream-node-owner');
    const owner = new NodeRenderOwner({ module: this.module, memory: this.memory.buffer,
      // Cooperative instances share the producer. Its one consumer fans frames
      // to window-owner admission; it never races a second drain of the ring.
      onFrame: frame => { for (const listener of listeners) listener.onFrame(frame); },
      onStats: stats => { for (const listener of listeners) listener.onStats?.(stats); },
    });
    this.rings.set(key, { owner, callbacks: listeners });
    this.owners.add(owner);
    owner.exit.finally(() => {
      this.owners.delete(owner);
      if (this.rings.get(key)?.owner === owner) this.rings.delete(key);
    });
    return owner;
  }
  async flush() {
    for (const owner of this.owners) if (!owner.closed) await owner.flush();
  }
  parkThread(tid, owner) {
    const record = { owner, target: owner.next };
    this.pending.set(tid, record);
    owner.flush().catch(error => { this.error ||= error; }).finally(() => {
      if (this.pending.get(tid) === record) this.pending.delete(tid);
    });
  }
  isParked(tid) {
    const record = this.pending.get(tid);
    if (!record) return false;
    record.owner.collect();
    // Synchronous callback pumps cannot depend on a Promise microtask to
    // observe completion. The render owner publishes this after every record,
    // slot and frame message of the command has retired.
    if (Atomics.load(record.owner.control, 1) >= record.target) {
      this.pending.delete(tid);
      return false;
    }
    return true;
  }
  check() {
    if (this.error) throw this.error;
    for (const owner of this.owners) owner.collect();
    for (const tid of this.pending.keys()) this.isParked(tid);
  }
  async turn() {
    // Main may poll input while its previously published frame renders. Ring
    // backpressure and SYNC still enforce the producer's visibility contract.
    await new Promise(resolve => setImmediate(resolve));
    this.check();
  }
  async close() {
    this.closed = true;
    await Promise.all(Array.from(this.owners, owner => owner.close()));
  }
}
module.exports = { CliExecutionOwner };
