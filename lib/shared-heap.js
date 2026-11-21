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
  call(op, a, b, c, d) {
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
const api = { SharedHeap, BASE, CAPACITY, HANDLE_TAG,
  systemOperation(op, a, b, c, d) {
    if (!systemHeap) systemHeap = new SharedHeap();
    return systemHeap.call(op >>> 0, a >>> 0, b >>> 0, c >>> 0, d >>> 0);
  } };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.SharedHeapAuthority = api;
})();
