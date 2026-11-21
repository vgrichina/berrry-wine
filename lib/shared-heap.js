'use strict';
(function () {

// The system heap belongs to the emulated system authority, not a process or
// a transport connection. Only the authority calls this class. Guest addresses
// address this byte store; no process-private mirror is created.
const BASE = 0x80000000;
const CAPACITY = 0x01000000;
const HANDLE_TAG = 0xd5000000;
class SharedHeap {
  constructor() {
    const crypto = typeof require === 'function' ? require('node:crypto').webcrypto : globalThis.crypto;
    const generation = new Uint32Array(1);
    do { crypto.getRandomValues(generation); } while (!(generation[0] & 0xffffff));
    this.handle = (HANDLE_TAG | (generation[0] & 0xffffff)) >>> 0;
    this.bytes = new Uint8Array(CAPACITY);
    this.view = new DataView(this.bytes.buffer);
    this.top = 0;
    this.live = new Map();
    this.free = [];
    this.sections = new Map();
    this.nextSection = 0xd6000000;
  }
  allocate(size, flags) {
    if (size > CAPACITY) return { value: 0, error: 8 };
    const extent = Math.max(8, Math.ceil(size / 8) * 8);
    let offset;
    const index = this.free.findIndex(block => block.size >= extent);
    if (index >= 0) {
      const block = this.free[index];
      offset = block.offset;
      block.offset += extent; block.size -= extent;
      if (!block.size) this.free.splice(index, 1);
    } else {
      if (extent > CAPACITY - this.top) return { value: 0, error: 8 };
      offset = this.top; this.top += extent;
    }
    const ptr = BASE + offset;
    this.live.set(ptr, { offset, extent, size });
    if (flags & 8) this.bytes.fill(0, offset, offset + extent);
    return { value: ptr, error: 0 };
  }
  release(ptr) {
    const block = this.live.get(ptr);
    if (!block) return { value: 0, error: 87 };
    for (const address of this.sections.keys()) {
      if (address >= ptr && address < ptr + block.extent) this.sections.delete(address);
    }
    this.live.delete(ptr);
    this.free.push({ offset: block.offset, size: block.extent });
    this.free.sort((a, b) => a.offset - b.offset);
    for (let i = this.free.length - 1; i > 0; i--) {
      const before = this.free[i - 1], after = this.free[i];
      if (before.offset + before.size === after.offset) {
        before.size += after.size; this.free.splice(i, 1);
      }
    }
    const tail = this.free[this.free.length - 1];
    if (tail && tail.offset + tail.size === this.top) {
      this.top = tail.offset; this.free.pop();
    }
    return { value: 1, error: 0 };
  }
  access(ptr, width) {
    if (![1, 2, 4].includes(width)) throw Object.assign(new Error('shared heap width'), { code: 'EINVAL' });
    for (const [base, block] of this.live) {
      if (ptr >= base && ptr - base <= block.extent - width) return ptr - BASE;
    }
    throw Object.assign(new Error('invalid shared heap memory access'), { code: 'ESHAREDHEAP_ACCESS' });
  }
  // One serialized transaction owns the counters, queue and byte publication.
  // Numeric guest TIDs can collide in different processes. The authenticated
  // transport supplies process/session identity; neither a TID nor a semaphore
  // tag alone authorizes recursion or a parked retry.
  sectionWords(address, section) {
    const offset = address - BASE;
    this.view.setInt32(offset + 4, section.recursion + section.waiters.size - 1, true);
    this.view.setUint32(offset + 8, section.recursion, true);
    this.view.setUint32(offset + 12, section.owner?.tid || 0, true);
    this.view.setUint32(offset + 16, section.global ? section.token : 0, true);
  }
  sectionWake(section) {
    if (section.owner || !section.waiters.size) return;
    const [key, waiter] = section.waiters.entries().next().value;
    section.waiters.delete(key);
    section.owner = { ...waiter, key, granted: true };
    section.recursion = 1;
  }
  retireSections(process, tid, session) {
    let released = 0;
    const matches = owner => owner && owner.process === process &&
      (session === undefined ? owner.tid === tid : owner.session === session);
    for (const [address, section] of this.sections) {
      for (const [key, waiter] of section.waiters) if (matches(waiter)) section.waiters.delete(key);
      if (matches(section.owner)) { section.owner = null; section.recursion = 0; released++; }
      this.sectionWake(section);
      this.sectionWords(address, section);
    }
    return released;
  }
  sectionCall(op, address, tid, generation, process, session) {
    if (op === 27) return { value: this.retireSections(process, tid), error: 0 };
    const offset = this.access(address, 4);
    // All six words must belong to the same live allocation, even if packed.
    if (![...this.live].some(([base, block]) => address >= base && address - base <= block.extent - 24)) {
      throw Object.assign(new Error('invalid shared section extent'), { code: 'ESHAREDHEAP_ACCESS' });
    }
    const key = process + ':' + tid;
    let section = this.sections.get(address);
    if (op === 20) {
      if (section && (section.owner || section.waiters.size)) return { value: 0, error: 170 };
      if (this.nextSection >= 0xd7000000) return { value: 0, error: 8 };
      section = { token: ++this.nextSection, process, global: false, owner: null, recursion: 0, waiters: new Map() };
      this.sections.set(address, section);
      this.view.setUint32(offset, 0, true);
      this.view.setUint32(offset + 20, generation, true); // spin count on init
      this.sectionWords(address, section);
      return { value: 1, error: 0 };
    }
    if (!section || (!section.global && section.process !== process) ||
        (generation && generation !== section.token)) return { value: 0, error: 6 };
    if (op === 21) {
      section.global = true; this.sectionWords(address, section);
      return { value: 1, error: 0 };
    }
    if (op === 25) {
      this.sections.delete(address);
      this.bytes.fill(0, offset, offset + 24); this.view.setInt32(offset + 4, -1, true);
      return { value: 1, error: 0 };
    }
    if (op === 26) return { value: section.owner?.key !== key && !!section.owner ? 1 : 0, error: 0 };
    if (op === 22 || op === 23) {
      if (section.owner?.key === key) {
        if (section.owner.granted && op === 23) return { value: 0, error: 0 };
        if (section.owner.granted && op === 22) section.owner.granted = false;
        else section.recursion++;
      } else if (!section.owner) {
        section.owner = { key, process, tid, session, granted: false }; section.recursion = 1;
      } else {
        if (op === 23) return { value: 0, error: 0 };
        if (!section.waiters.has(key)) {
          if (section.waiters.size >= 4096) return { value: 0, error: 8 };
          section.waiters.set(key, { process, tid, session });
        }
        this.sectionWords(address, section);
        return { value: section.token, error: 0 };
      }
    } else if (op === 24) {
      if (section.owner?.key !== key || section.owner.granted) return { value: 0, error: 288 };
      if (--section.recursion === 0) { section.owner = null; this.sectionWake(section); }
    } else throw Object.assign(new Error('unsupported shared section operation'), { code: 'ENOTSUP' });
    this.sectionWords(address, section);
    return { value: 1, error: 0 };
  }
  call(op, a, b, c, d, identity) {
    if (op >= 20 && op <= 27) {
      if (!identity?.process || !identity?.session) throw Object.assign(new Error('missing shared section identity'), { code: 'EINVAL' });
      return this.sectionCall(op, a, b, c, identity.process, identity.session);
    }
    if (op === 1) return { value: this.handle, error: 0 };
    if (op === 13) {
      const offset = this.access(a, d);
      const old = this.view['getUint' + d * 8](offset, true);
      const mask = d === 4 ? 0xffffffff : (1 << (d * 8)) - 1;
      if (old === ((b & mask) >>> 0)) this.view['setUint' + d * 8](offset, c, true);
      return { value: old, error: 0 };
    }
    if (op === 10 || op === 11) {
      const offset = this.access(a, b);
      const method = (op === 10 ? 'getUint' : 'setUint') + b * 8;
      if (op === 10) return { value: this.view[method](offset, true), error: 0 };
      this.view[method](offset, c, true);
      return { value: 1, error: 0 };
    }
    if (a !== this.handle) return { value: op === 6 ? 0xffffffff : 0, error: 6 };
    if ([3, 4, 5, 6].includes(op)) {
      const allowed = op === 3 ? 9 : op === 5 ? 25 : 1;
      if (b & ~allowed) return { value: op === 6 ? 0xffffffff : 0, error: b & 4 ? 50 : 87 };
    }
    if (op === 2) return { value: 1, error: 0 }; // System lifetime; HeapDestroy cannot retire it.
    if (op === 3) return this.allocate(c, b);
    if (op === 4) return this.release(c);
    if (op === 5) {
      const block = this.live.get(c);
      if (!block) return { value: 0, error: 87 };
      if (d <= block.extent) {
        if ((b & 8) && d > block.size) this.bytes.fill(0, block.offset + block.size, block.offset + d);
        block.size = d;
        return { value: c, error: 0 };
      }
      if (b & 16) return { value: 0, error: 8 };
      const next = this.allocate(d, b);
      if (!next.value) return next;
      this.bytes.copyWithin(next.value - BASE, block.offset, block.offset + block.size);
      this.release(c);
      return next;
    }
    if (op === 6) return { value: this.live.get(c)?.size ?? 0xffffffff, error: this.live.has(c) ? 0 : 87 };
    if (op === 7) return { value: !(b & ~1) && (!c || this.live.has(c)) ? 1 : 0, error: 0 };
    throw Object.assign(new Error('unsupported shared heap operation'), { code: 'ENOTSUP' });
  }
}
// Browser host imports run on the desktop's page thread, including calls from
// real guest Workers. Separate emulated process memories therefore serialize
// through this one authority, just as Node peers use the namespace server.
let systemHeap;
const browserProcesses = new WeakMap();
let nextBrowserProcess = 0;
const api = { SharedHeap, BASE, CAPACITY, HANDLE_TAG,
  systemOperation(op, a, b, c, d, memory) {
    if (!systemHeap) systemHeap = new SharedHeap();
    let identity;
    if (op >= 20 && op <= 27) {
      if (!memory || typeof memory !== 'object') throw new Error('missing browser process memory identity');
      if (!browserProcesses.has(memory)) browserProcesses.set(memory, String(++nextBrowserProcess));
      const process = browserProcesses.get(memory) + ':' + (d >>> 0);
      identity = { process, session: process };
    }
    return systemHeap.call(op >>> 0, a >>> 0, b >>> 0, c >>> 0, d >>> 0, identity);
  } };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.SharedHeapAuthority = api;
})();
