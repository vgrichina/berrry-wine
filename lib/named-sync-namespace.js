// Shared host-side kernel objects. Guest HANDLEs remain process-local; a
// ThreadManager holds references to these objects for its issued handles.
// Namespace and reference operations run on the host broker. Event/semaphore
// state lives in one shared buffer so real Workers can wait atomically without
// unwinding a guest callback. Process-local tables hold references, not copies.
(function (root) {
  'use strict';
  class NamedSyncNamespace {
    constructor(capacity = 4096) {
      this.objects = new Map();
      const BufferType = typeof SharedArrayBuffer === 'function' ? SharedArrayBuffer : ArrayBuffer;
      this.buffer = new BufferType(capacity * 16);
      this.shared = typeof SharedArrayBuffer === 'function' && this.buffer instanceof SharedArrayBuffer;
      this.view = new Int32Array(this.buffer);
      this.capacity = capacity;
      this.nextToken = 1;
    }

    acquire(client, name, type, options = {}, openOnly = false) {
      if (!client || !name || ![1, 2, 3].includes(type)) {
        return { error: 87 };
      }
      name = String(name);
      let object = this.objects.get(name);
      const alreadyExists = !!object;
      if (object && object.type !== type) return { error: 6 };
      if (!object && openOnly) return { error: 2 };
      if (!object) {
        if (type === 2 && (!Number.isInteger(options.maxCount)
            || !Number.isInteger(options.initialCount) || !(options.maxCount > 0) || options.initialCount < 0
            || options.initialCount > options.maxCount)) return { error: 87 };
        let slot = -1;
        for (let i = 0; i < this.capacity; i++) {
          if (Atomics.load(this.view, i * 4 + 1) === 0) { slot = i; break; }
        }
        if (slot < 0 || this.nextToken > 0xffffffff) return { error: 8 };
        object = {
          name, type, slot, token: this.nextToken++, references: new Map(),
          manualReset: type === 1 && !!options.manualReset,
          owner: type === 3 && options.initialOwner ? client : null,
          threadId: type === 3 && options.initialOwner ? options.threadId || 1 : 0,
          recursion: type === 3 && options.initialOwner ? 1 : 0,
          abandoned: false,
          maxCount: type === 2 ? options.maxCount : 0,
        };
        const state = slot * 4 + 2;
        Object.defineProperties(object, {
          signaled: { get: () => Atomics.load(this.view, state) !== 0,
            set: value => Atomics.store(this.view, state, value ? 1 : 0) },
          count: { get: () => Atomics.load(this.view, state),
            set: value => Atomics.store(this.view, state, value) },
        });
        Atomics.store(this.view, slot * 4, object.token);
        Atomics.store(this.view, state, type === 1 ? (options.initialState ? 1 : 0)
          : type === 2 ? options.initialCount : 0);
        Atomics.store(this.view, state + 1, type === 1 ? (options.manualReset ? 1 : 0)
          : type === 2 ? options.maxCount : 0);
        Atomics.store(this.view, slot * 4 + 1, type);
        this.objects.set(name, object);
      }
      object.references.set(client, (object.references.get(client) || 0) + 1);
      return { object, alreadyExists, error: 0 };
    }

    live(client, object) {
      return !!object && this.objects.get(object.name) === object
        && (object.references.get(client) || 0) > 0;
    }

    close(client, object) {
      if (!this.live(client, object)) return false;
      const count = object.references.get(client);
      if (count === 1) object.references.delete(client);
      else object.references.set(client, count - 1);
      if (!object.references.size) this.destroy(object);
      return true;
    }

    wake(object) {
      if (this.shared) Atomics.notify(this.view, object.slot * 4 + 2);
      for (const client of object.references.keys()) client._wakeWaitersSoon?.();
    }

    destroy(object) {
      this.objects.delete(object.name);
      Atomics.store(this.view, object.slot * 4 + 1, 0);
      Atomics.store(this.view, object.slot * 4, 0);
      if (this.shared) Atomics.notify(this.view, object.slot * 4 + 2);
    }

    setEvent(client, object, signaled) {
      if (!this.live(client, object) || object.type !== 1) return false;
      object.signaled = !!signaled;
      if (signaled) this.wake(object);
      return true;
    }

    ready(client, object, threadId = 1) {
      if (!this.live(client, object)) return false;
      return object.type === 1 ? object.signaled
        : object.type === 2 ? object.count > 0
        : !object.owner || (object.owner === client && object.threadId === threadId);
    }

    consume(client, object, threadId = 1) {
      if (!this.ready(client, object, threadId)) return 0x102;
      if (object.type === 1) {
        if (!object.manualReset && Atomics.compareExchange(this.view,
          object.slot * 4 + 2, 1, 0) !== 1) return 0x102;
        return 0;
      }
      if (object.type === 2) {
        while (true) {
          const count = object.count;
          if (count <= 0) return 0x102;
          if (Atomics.compareExchange(this.view, object.slot * 4 + 2,
            count, count - 1) === count) return 0;
        }
      }
      const abandoned = object.abandoned;
      object.owner = client;
      object.threadId = threadId;
      object.recursion++;
      object.abandoned = false;
      return abandoned ? 0x80 : 0;
    }

    // Workers can consume a token between the readiness and consume passes.
    // A failed wait-all restores only the tokens this attempt acquired.
    wait(client, objects, all, threadId = 1) {
      if (!objects.length || new Set(objects).size !== objects.length
          || objects.some(object => !this.live(client, object))) return 0xffffffff;
      if (!all) {
        for (let i = 0; i < objects.length; i++) {
          if (this.ready(client, objects[i], threadId)) {
            const result = this.consume(client, objects[i], threadId);
            if (result !== 0x102) return result + i;
          }
        }
        return 0x102;
      }
      if (!objects.every(object => this.ready(client, object, threadId))) return 0x102;
      let abandoned = -1;
      const consumed = [];
      for (let i = 0; i < objects.length; i++) {
        const result = this.consume(client, objects[i], threadId);
        if (result === 0x102) {
          for (const previous of consumed.reverse()) {
            if (previous.object.type === 1 && !previous.object.manualReset) previous.object.signaled = true;
            else if (previous.object.type === 2) Atomics.add(this.view, previous.object.slot * 4 + 2, 1);
            else if (previous.object.type === 3) {
              this.releaseMutex(client, previous.object, threadId);
              if (previous.result === 0x80) previous.object.abandoned = true;
            }
            this.wake(previous.object);
          }
          return 0x102;
        }
        consumed.push({ object: objects[i], result });
        if (result === 0x80 && abandoned < 0) abandoned = i;
      }
      return abandoned < 0 ? 0 : 0x80 + abandoned;
    }

    releaseMutex(client, object, threadId = 1) {
      if (!this.live(client, object) || object.type !== 3) return -1;
      if (object.owner !== client || object.threadId !== threadId) return 0;
      if (--object.recursion === 0) {
        object.owner = null;
        object.threadId = 0;
        this.wake(object);
      }
      return 1;
    }

    releaseSemaphore(client, object, count) {
      if (!this.live(client, object) || object.type !== 2) return { error: 6 };
      if (!Number.isInteger(count) || count <= 0) return { error: 87 };
      while (true) {
        const previous = object.count;
        if (previous + count > object.maxCount) return { error: 298 };
        if (Atomics.compareExchange(this.view, object.slot * 4 + 2,
          previous, previous + count) !== previous) continue;
        this.wake(object);
        return { error: 0, previous };
      }
    }

    abandon(client, threadId) {
      for (const object of this.objects.values()) {
        if (object.type !== 3 || object.owner !== client
            || (threadId !== undefined && object.threadId !== threadId)) continue;
        object.owner = null;
        object.threadId = 0;
        object.recursion = 0;
        object.abandoned = true;
        this.wake(object);
      }
    }

    detach(client) {
      this.abandon(client);
      for (const object of this.objects.values()) {
        object.references.delete(client);
        if (!object.references.size) this.destroy(object);
      }
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { NamedSyncNamespace };
  else root.NamedSyncNamespace = NamedSyncNamespace;
})(typeof globalThis !== 'undefined' ? globalThis : this);
