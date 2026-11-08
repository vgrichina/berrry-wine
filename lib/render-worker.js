// One physical renderer Worker per process, with independently owned API ports.
// Ports also implement the Worker subset used by the existing command streams.
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.RenderWorker=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Checked ownership of existing shared packet slots. This does not grant
  // producer write credit or establish GPU completion: callers release only
  // after the consumer has stopped reading, and separately gate the next writer.
  // Register the canonical memory.buffer for every owner. JavaScript cannot
  // identify backing-store aliases introduced by structured-cloning an SAB.
  class SharedPacketPool {
    #owners = new Map();
    #leases = new Map();
    register(owner, buffer, offsets, capacity) {
      if (owner === null || owner === undefined) throw new Error('packet owner required');
      if (typeof SharedArrayBuffer === 'undefined' || !(buffer instanceof SharedArrayBuffer))
        throw new Error('packet storage must be shared');
      if (!Number.isSafeInteger(capacity) || capacity <= 0 || !Array.isArray(offsets) || !offsets.length)
        throw new Error('invalid packet slot layout');
      const starts = Array.from(offsets);
      for (const start of starts) {
        if (!Number.isSafeInteger(start) || start < 0 || start > buffer.byteLength - capacity)
          throw new Error('packet slot outside shared storage');
      }
      starts.sort((a, b) => a - b);
      for (let i = 1; i < starts.length; i++)
        if (starts[i] < starts[i - 1] + capacity) throw new Error('overlapping packet slots');
      const prior = this.#owners.get(owner);
      if (prior) {
        if (prior.buffer === buffer && prior.capacity === capacity &&
            prior.starts.length === starts.length && prior.starts.every((x, i) => x === starts[i])) return this;
        throw new Error('packet owner must retire before registration changes');
      }
      for (const entry of this.#owners.values()) {
        if (entry.buffer !== buffer) continue;
        for (const start of starts) for (const other of entry.starts)
          if (start < other + entry.capacity && other < start + capacity)
            throw new Error('packet slots overlap another owner');
      }
      this.#owners.set(owner, { buffer, capacity, starts, busy: new Set() });
      return this;
    }
    claim(owner, offset, bytes) {
      const entry = this.#owners.get(owner);
      if (!entry) throw new Error('unregistered packet owner');
      if (!Number.isSafeInteger(offset) || !entry.starts.includes(offset) ||
          !Number.isSafeInteger(bytes) || bytes < 0 || bytes > entry.capacity)
        throw new Error('invalid packet claim');
      if (entry.busy.has(offset)) throw new Error('packet slot busy');
      const lease = Object.freeze({ buffer: entry.buffer, byteOffset: offset, bytes });
      entry.busy.add(offset);
      this.#leases.set(lease, { entry, offset });
      return lease;
    }
    release(lease) {
      const active = this.#leases.get(lease);
      if (!active) throw new Error('stale or invalid packet lease');
      this.#leases.delete(lease);
      active.entry.busy.delete(active.offset);
    }
    unregister(owner) {
      const entry = this.#owners.get(owner);
      if (!entry) throw new Error('unregistered packet owner');
      if (entry.busy.size) throw new Error('packet owner still has active leases');
      this.#owners.delete(owner);
    }
  }
  function deferred(){
    let resolve,reject;
    const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
    promise.catch(()=>{});return {promise,resolve,reject};
  }
  // Producer-side admission shared by all packet encodings. A ticket reserves
  // capacity before snapshots are made. complete means payload readers have
  // retired, never GPU completion. Failed publications retain their tickets.
  // Atomic producers use reserve/complete; page brokers use admit/execute.
  class SubmissionQueue {
    constructor(capacity, maxWaiters=1024){
      if(!Number.isSafeInteger(capacity)||capacity<1||!Number.isSafeInteger(maxWaiters)||maxWaiters<1)
        throw new Error('invalid submission queue capacity');
      this.capacity=capacity;this.maxWaiters=maxWaiters;this.used=0;
      this.tickets=new Set();this.waiters=[];this.error=null;this.closing=false;
      this.tail=Promise.resolve();this.admission=Promise.resolve();this.orderedPending=0;this.drainers=[];
    }
    reserve(credits=1){
      if(this.error)throw this.error;
      if(!Number.isSafeInteger(credits)||credits<1||credits>this.capacity)
        throw new Error('invalid submission credits');
      if(credits>this.capacity-this.used)throw new Error('submission queue full');
      const ticket=Object.freeze({credits});this.tickets.add(ticket);this.used+=credits;
      return ticket;
    }
    complete(ticket){
      if(!this.tickets.delete(ticket))throw new Error('stale submission ticket');
      this.used-=ticket.credits;this._pump();this._drained();
    }
    fail(error){
      this.error ||= error;
      for(const waiter of this.waiters.splice(0))waiter.result.reject(this.error);
      this._drained();
    }
    execute(action){
      const result=this.tail.then(()=>{if(this.error)throw this.error;return action();});
      this.tail=result.then(()=>{},error=>{this.fail(error);});
      return result;
    }
    ordered(action){
      if(this.orderedPending>=this.maxWaiters)return Promise.reject(new Error('submission waiter limit'));
      this.orderedPending++;
      const result=this.admission.then(()=>{if(this.error)throw this.error;return action();});
      this.admission=result.then(()=>{this.orderedPending--;},()=>{this.orderedPending--;});return result;
    }
    admit(prepare,credits=1){
      if(this.closing)return Promise.reject(new Error('submission queue closed'));
      if(this.error)return Promise.reject(this.error);
      if(!Number.isSafeInteger(credits)||credits<1||credits>this.capacity)
        return Promise.reject(new Error('invalid submission credits'));
      if(!this.waiters.length&&credits<=this.capacity-this.used)return this._start(prepare,credits);
      if(this.waiters.length>=this.maxWaiters)return Promise.reject(new Error('submission waiter limit'));
      const result=deferred();this.waiters.push({prepare,credits,result});this._pump();
      return result.promise;
    }
    _pump(){
      if(this.pumping||this.error)return;
      this.pumping=true;
      try{
        while(this.waiters.length&&this.waiters[0].credits<=this.capacity-this.used){
          const entry=this.waiters.shift();
          try{entry.result.resolve(this._start(entry.prepare,entry.credits));}
          catch(error){entry.result.reject(error);}
        }
      }finally{this.pumping=false;}
    }
    _start(prepare,credits){
      const ticket=this.reserve(credits);
      let prepared;
      try{prepared=prepare();}
      catch(error){this.complete(ticket);throw error;}
      // prepare must return synchronously and throw only before publication.
      // done includes readback/copy-back; rejection quarantines the ticket.
      Promise.resolve(prepared.done).then(()=>this.complete(ticket),error=>this.fail(error));
      return prepared.value;
    }
    _drained(){
      if(!this.error&&(this.used||this.waiters.length))return;
      for(const waiter of this.drainers.splice(0))
        this.error?waiter.reject(this.error):waiter.resolve();
    }
    close(){
      this.closing=true;
      const result=deferred();this.drainers.push(result);this._drained();
      return result.promise.then(async()=>{await this.tail;if(this.error)throw this.error;});
    }
  }
  function byteSize(value,seen=new Set()){
    if(!value||typeof value!=='object'||seen.has(value))return typeof value==='string'?value.length*2:8;
    seen.add(value);
    if(ArrayBuffer.isView(value))return value.byteLength;
    if(value instanceof ArrayBuffer||typeof SharedArrayBuffer!=='undefined'&&value instanceof SharedArrayBuffer)
      return value.byteLength;
    // Shared process memory and compiled modules are initialization handles,
    // not per-command owned packets.
    if(value instanceof WebAssembly.Memory||value instanceof WebAssembly.Module)return 0;
    return Object.values(value).reduce((n,v)=>n+byteSize(v,seen),0);
  }
  // Observation storage is bounded, process-lifetime shared control state,
  // not a copied command payload. Charge its two handles while retaining the
  // ordinary byte accounting for every other field (including shared packets).
  // Invalid layouts receive no exemption and still face normal admission.
  function observationQueueMessage(message) {
    const o = message?.options;
    if (message?.t !== 'legacy-producer-observation' || message.action !== 'arm' ||
        typeof o?.ownerGeneration !== 'string' || !o.ownerGeneration.length || o.ownerGeneration.length > 128 ||
        !Number.isInteger(o.maxRecords) || o.maxRecords < 1 || o.maxRecords > 4096 ||
        !(o.writerEpochBuffer instanceof SharedArrayBuffer) || o.writerEpochBuffer.byteLength !== 16 ||
        !(o.surfaceVersionBuffer instanceof SharedArrayBuffer) ||
        o.surfaceVersionBuffer.byteLength !== o.maxRecords * 65536) return message;
    return { ...message, options: { ...o, writerEpochBuffer: 0, surfaceVersionBuffer: 0 } };
  }
  function releaseImages(value,seen=new Set()){
    if(!value||typeof value!=='object'||seen.has(value))return;
    seen.add(value);
    if(typeof ImageBitmap!=='undefined'&&value instanceof ImageBitmap)value.close();
    else if(!ArrayBuffer.isView(value))for(const item of Object.values(value))releaseImages(item,seen);
  }
  // Exclusion evidence only. This cannot identify a producer or prove that
  // every writer is registered. A canonical-version protocol must separately
  // establish coverage, surface ownership and the source token.
  class WriterEpoch {
    constructor(buffer = new SharedArrayBuffer(16)) {
      if (!(buffer instanceof SharedArrayBuffer) || buffer.byteLength !== 16)
        throw new TypeError('writer epoch requires a 16-byte shared buffer');
      this.buffer = buffer; this.words = new Int32Array(buffer);
      this.live = new Set(); this.serial = 0;
      this.stamps = new WeakSet();
      this.kind = 'd3dim-writer-epoch-v1';
    }
    invalidate() { Atomics.store(this.words, 2, 1); }
    invalidateVersions() {
      // JS host writes are not all page-watch clients. This is a conservative
      // process mutation clock, separate from the in-flight writer count.
      if (Atomics.add(this.words, 3, 1) === -1) this.invalidate();
    }
    _advance() {
      if (Atomics.add(this.words, 1, 1) === -1) this.invalidate();
    }
    begin() {
      const ticket = ++this.serial;
      if (!Number.isSafeInteger(ticket)) this.invalidate();
      this.live.add(ticket);
      // Exclude readers BEFORE any transition, including an async dispatch.
      if (Atomics.add(this.words, 0, 1) < 0) this.invalidate();
      this._advance();
      return ticket;
    }
    end(ticket) {
      if (!this.live.delete(ticket)) { this.invalidate(); return; }
      this._advance();
      if (Atomics.sub(this.words, 0, 1) <= 0) this.invalidate();
    }
    snapshot() {
      const epoch = Atomics.load(this.words, 1) >>> 0;
      if (Atomics.load(this.words, 0) || Atomics.load(this.words, 2) ||
          (Atomics.load(this.words, 1) >>> 0) !== epoch) return null;
      const stamp = Object.freeze({ epoch });
      this.stamps.add(stamp);
      return stamp;
    }
    unchanged(stamp) {
      const now = this.snapshot();
      return !!stamp && this.stamps.has(stamp) && !!now && now.epoch === stamp.epoch;
    }
  }

  // One fresh shared cell per command, never recycled. The parent retains the
  // ticket through the reply; only the executing Worker may temporarily park
  // its contribution at a synchronous native transport wait. No message from
  // the parent can restore exclusion on behalf of resumed guest execution.
  class CommandWriterHandoff {
    constructor(descriptor, owner, generation) {
      this.epoch = new WriterEpoch(descriptor.epochBuffer);
      this.buffer = descriptor.buffer;
      if (!(this.buffer instanceof SharedArrayBuffer) || this.buffer.byteLength !== 32)
        throw new TypeError('command writer cell required');
      this.state = new Int32Array(this.buffer, 0, 2);
      this.identity = new BigUint64Array(this.buffer, 8, 3);
      this.owner = BigInt(owner); this.generation = BigInt(generation);
      this.ticket = BigInt(descriptor.ticket);
      this._check();
    }
    static create(epoch, ticket, owner, generation) {
      if (!epoch.live.has(ticket) || ![ticket, owner, generation].every(v => Number.isSafeInteger(v) && v > 0)) {
        epoch.invalidate(); throw new Error('invalid command writer identity');
      }
      const buffer = new SharedArrayBuffer(32);
      const identity = new BigUint64Array(buffer, 8, 3);
      identity.set([BigInt(owner), BigInt(generation), BigInt(ticket)]);
      Atomics.store(new Int32Array(buffer), 0, 1);
      return new CommandWriterHandoff({ buffer, epochBuffer: epoch.buffer, ticket }, owner, generation);
    }
    descriptor() { return { buffer: this.buffer, epochBuffer: this.epoch.buffer, ticket: Number(this.ticket) }; }
    _check() {
      if (Atomics.load(this.identity, 0) !== this.owner ||
          Atomics.load(this.identity, 1) !== this.generation ||
          Atomics.load(this.identity, 2) !== this.ticket) {
        this.epoch.invalidate(); throw new Error('stale command writer identity');
      }
    }
    park() {
      this._check();
      if (Atomics.compareExchange(this.state, 0, 1, 2) !== 1) {
        this.epoch.invalidate(); throw new Error('command writer is not active');
      }
      this.epoch._advance();
      if (Atomics.sub(this.epoch.words, 0, 1) <= 0) this.epoch.invalidate();
    }
    resume() {
      // Restore the count even if identity/timeout/retirement poisoned the
      // command while parked. Failure must never expose resumed guest memory.
      if (Atomics.compareExchange(this.state, 0, 2, 1) !== 2) {
        this.epoch.invalidate(); throw new Error('command writer is not parked');
      }
      if (Atomics.add(this.epoch.words, 0, 1) < 0) this.epoch.invalidate();
      this.epoch._advance();
      this._check();
    }
    close() {
      this._check();
      if (Atomics.compareExchange(this.state, 0, 1, 3) !== 1) {
        this.epoch.invalidate(); throw new Error('command reply while writer parked or closed');
      }
    }
  }

  // Install at instance creation, before a driver or callback can cache an
  // export. The epoch is late-bound so unarmed execution keeps its result,
  // exception and synchronous/async return shape. This facade owns no memory.
  function observeInstance(instance, getEpoch) {
    const exports = {};
    for (const [name, value] of Object.entries(instance.exports)) {
      exports[name] = typeof value === 'function' ? function (...args) {
        const epoch = getEpoch();
        // Interpreter execution and guest loads/stores use the native watch
        // substrate. Other standalone exports may write internal storage
        // without those notices, so conservatively retire prior versions.
        const watched = name === 'run' || /^(get_|guest_read|guest_write|page_watch_root$)/.test(name);
        return (watched ? observeCall : observeHostWrite)(epoch, value, undefined, args);
      } : value;
    }
    return { exports, nativeInstance: instance };
  }

  function observeCall(epoch, fn, receiver, args) {
    if (!epoch) return fn.apply(receiver, args);
    const ticket = epoch.begin();
    try {
      const result = fn.apply(receiver, args);
      if (result && typeof result.then === 'function') return result.then(
        value => { epoch.end(ticket); return value; },
        error => { epoch.invalidate(); epoch.end(ticket); throw error; });
      epoch.end(ticket);
      return result;
    } catch (error) {
      epoch.invalidate(); epoch.end(ticket); throw error;
    }
  }

  function observeHostWrite(epoch, fn, receiver, args) {
    if (!epoch) return fn.apply(receiver, args);
    // Invalidation belongs INSIDE exclusion. Publishing a new host version
    // before begin() would let a concurrent source seal that new value while
    // the corresponding unnotified JS mutation was still about to happen.
    return observeCall(epoch, function() {
      epoch.invalidateVersions();
      return fn.apply(receiver, args);
    }, undefined, []);
  }

  // Immutable source versions cross the Worker transport in shared storage.
  // Callback delivery is deliberately not the authority for a canonical read.
  // Each slot has a commit word followed by bounded UTF-8 JSON; no slot is reused.
  class SurfaceVersionJournal {
    constructor(buffer) {
      if (!(buffer instanceof SharedArrayBuffer) || buffer.byteLength % 65536)
        throw new TypeError('surface version journal requires whole 64KiB slots');
      this.buffer = buffer; this.words = new Int32Array(buffer);
      this.bytes = new Uint8Array(buffer); this.count = buffer.byteLength / 65536;
      this.encoder = new TextEncoder(); this.decoder = new TextDecoder('utf-8', { fatal: true });
      this.leases = [];
    }
    _offset(index) {
      if (!Number.isInteger(index) || index < 0 || index >= this.count)
        throw new RangeError('surface version journal index out of range');
      return index * 65536;
    }
    begin(index, front) {
      this._offset(index);
      // Retire the prior canonical association BEFORE the fence or swap.
      for (let i = 0; i < index; i++) {
        const record = this.read(i);
        if (record?.front === front) Atomics.store(this.words, i * 16384 + 1, 1);
      }
    }
    finish(index, record) {
      const offset = this._offset(index);
      const encoded = this.encoder.encode(JSON.stringify(record));
      if (encoded.length > 65520) throw new Error('surface version proof exceeds journal slot');
      // Reserve before touching payload: a committed slot is never rewritten,
      // even by an accidental second producer. -1 is an incomplete commit.
      if (Atomics.compareExchange(this.words, offset / 4, 0, -1) !== 0)
        throw new Error('surface version journal slot already reserved');
      this.bytes.set(encoded, offset + 16);
      Atomics.store(this.words, offset / 4, encoded.length);
    }
    read(index) {
      const offset = this._offset(index);
      // Acquire the commit before copying. TextDecoder rejects shared views in
      // browsers; slice creates an ordinary, reader-owned immutable snapshot.
      const length = Atomics.load(this.words, offset / 4);
      if (length === 0 || length === -1) return null;
      if (length < 0 || length > 65520) throw new Error('invalid surface version journal commit');
      const copy = this.bytes.slice(offset + 16, offset + 16 + length);
      if (Atomics.load(this.words, offset / 4) !== length)
        throw new Error('surface version journal commit changed during read');
      const record = JSON.parse(this.decoder.decode(copy));
      if (!record || typeof record !== 'object' || Array.isArray(record))
        throw new Error('invalid surface version journal record');
      return record;
    }
    records() {
      const result = [];
      for (let i = 0; i < this.count; i++) {
        const record = this.read(i);
        if (record) result.push({ ...record, superseded: !!Atomics.load(this.words, i * 16384 + 1) });
      }
      return result;
    }
    capture(memory, exports, ranges) {
      const root = exports.page_watch_root();
      const words = new Int32Array(memory.buffer), versions = new BigUint64Array(memory.buffer);
      const proof = [], indices = new Set();
      for (const [address, length] of ranges) {
        if (!address || !length || address + length > memory.buffer.byteLength ||
            !exports.page_watch_acquire(address, length)) throw new Error('surface page lease unavailable');
        this.leases.push([address, length]);
        for (let page = address >>> 12; page <= (address + length - 1) >>> 12; page++) {
          const table = Atomics.load(words, (root >>> 2) + (page >>> 10));
          if (!table) throw new Error('missing surface page table');
          const index = (table + (page & 1023) * 16 + 8) >>> 3;
          indices.add(index);
        }
      }
      for (const index of indices) proof.push([index, Atomics.load(versions, index).toString()]);
      if (Atomics.load(words, (root + 2048) >>> 2)) throw new Error('poisoned page watch');
      return { root, proof };
    }
    unchanged(memory, record) {
      if (!record?.pages) return false;
      const words = new Int32Array(memory.buffer), versions = new BigUint64Array(memory.buffer);
      return !Atomics.load(words, (record.pages.root + 2048) >>> 2) &&
        record.pages.proof.every(([index, generation]) => Atomics.load(versions, index).toString() === generation);
    }
    release(exports) {
      for (const [address, length] of this.leases) exports.page_watch_release(address, length);
      this.leases.length = 0;
    }
  }

  class SurfacePublicationJoin {
    constructor({ epoch, journal, memory, ownerScope, renderer, workerSlot, endpointId, owner, observationGeneration }) {
      this.epoch = epoch; this.journal = journal; this.memory = memory;
      this.ownerScope = ownerScope; this.renderer = renderer; this.live = true;
      this.workerSlot = workerSlot; this.endpointId = endpointId;
      this.owner = owner; this.observationGeneration = observationGeneration;
      this.rows = []; this.ledger = []; this.used = new Set(); this.receipts = new Map();
      this.seen = new Set(); this.cached = new Set(); this.cacheSerial = 0; this.transfers = new Map();
      this.dxLayerProofs = new WeakMap();
      (renderer._d3dimPublicationJoins ||= new Set()).add(this);
    }
    key(record) {
      const o = record.owner;
      return `${o.scope}/${o.endpointId}/${o.generation}/${record.observationGeneration}/${record.batch}/${record.ordinal}`;
    }
    valid() { return this.live && !!this.epoch.snapshot(); }
    beginRead() { return this.live ? this.epoch.snapshot() : null; }
    find(presentation) {
      const request = presentation.owedPresentRequest, s = presentation.surface;
      if (!request || !Number.isInteger(this.workerSlot) || request.workerSlot !== this.workerSlot || !this.valid()) return null;
      const records = this.journal.records();
      for (let i = records.length - 1; i >= 0; i--) {
        const r = records[i], l = r.layout;
        if (r.owner.scope !== this.ownerScope || r.owner.endpointId !== this.endpointId || r.versionRejected || !l || r.superseded ||
            (this.owner && r.owner.generation !== this.owner.generation) ||
            (this.observationGeneration !== undefined && r.observationGeneration !== this.observationGeneration) ||
            r.request?.descriptor !== request.descriptor || r.request?.serial !== request.serial ||
            r.front !== request.front || request.slot !== presentation.id - 0x200000 ||
            l.width !== presentation.width || l.height !== presentation.height || l.bpp !== s.bpp ||
            l.pitch !== s.stride || l.dib !== s.storageOffset ||
            l.topDown !== s.topDown ||
            (l.bpp === 16 && l.masks.some((mask, channel) => mask !== s.maskInfo?.[channel]?.mask)) ||
            (l.bpp <= 8 && (!l.palette || presentation.paletteCount < (1 << l.bpp))) ||
            l.palette !== (s.bpp <= 8 ? presentation.paletteWa : 0)) continue;
        if (r.hostVersion === (Atomics.load(this.epoch.words, 3) >>> 0) && this.journal.unchanged(this.memory, r)) return r;
      }
      return null;
    }
    cache(presentation, stamp, record, dirty, previous) {
      if (!record || !this.live || !this.epoch.unchanged(stamp) ||
          !this.journal.unchanged(this.memory, record)) return;
      const full = dirty.x === 0 && dirty.y === 0 && dirty.w === presentation.width && dirty.h === presentation.height;
      if (!full && (previous?.join !== this || previous.record.sourceVersion !== record.sourceVersion ||
          previous.cacheSerial <= (this.blockedSceneCacheSerial || 0))) return;
      presentation.canvas._waD3dimVersion = Object.freeze({ join: this, record,
        cacheSerial: ++this.cacheSerial, rect: { ...dirty } });
      this.cached.add(this.key(record));
    }
    startComposition() { this.transfers.clear(); }
    cacheDxLayer(presentation, stamp, record, window, layer) {
      // Only the actual, complete DirectX decoder may bind this proof. Never
      // borrow a GDI cache token for a layer that can cover that GDI canvas.
      if (window?.wasmMemory !== this.memory || window._dxFrameLayer !== layer ||
          layer?.canvas !== presentation.canvas) return;
      this.cache(presentation, stamp, record,
        { x: 0, y: 0, w: presentation.width, h: presentation.height });
      const version = presentation.canvas._waD3dimVersion;
      if (version?.join === this && version.record === record)
        this.dxLayerProofs.set(layer, { window, canvas: presentation.canvas, version });
    }
    transfer(source, destination, geometry, operation) {
      if (!this.live || !geometry || geometry.length !== 8 || geometry.some(v => !Number.isFinite(v)) ||
          geometry[2] <= 0 || geometry[3] <= 0 || geometry[6] <= 0 || geometry[7] <= 0) return;
      if (geometry[4] >= destination.width || geometry[5] >= destination.height ||
          geometry[4] + geometry[6] <= 0 || geometry[5] + geometry[7] <= 0) return;
      const direct = source?._waD3dimVersion;
      const versions = direct?.join === this ? [{ version: direct, path: [] }] : this.transfers.get(source) || [];
      if (!versions.length) return;
      const list = this.transfers.get(destination) || [];
      for (const item of versions) list.push({ version: item.version, path: [...item.path,
        { source: [source.width, source.height], destination: [destination.width, destination.height],
          geometry: [...geometry], operation: operation || 'canvas-blit' }] });
      this.transfers.set(destination, list);
    }
    publication(display, sequence) {
      // An in-flight writer prevents this publication from qualifying, but
      // does not itself prove that a pending source version was overwritten.
      // Keep it pending for a later full canonical read. Concrete page/host
      // invalidation, supersession and retirement still account for discards.
      if (!this.valid()) { this.account(); return; }
      const windows = Object.values(this.renderer.windows).filter(w => w.visible && !w.isChild);
      const layer = windows.length === 1 && windows[0]._dxFrameLayer;
      const layerProof = layer && this.dxLayerProofs.get(layer);
      const coveredLayer = layerProof && layerProof.window === windows[0] &&
        windows[0].wasmMemory === this.memory &&
        layerProof.canvas === layer.canvas && layer.kind !== 'gpu' &&
        layer.canvas.width === layerProof.version.record.layout.width &&
        layer.canvas.height === layerProof.version.record.layout.height &&
        layer.canvas._waD3dimVersion === layerProof.version;
      if (windows.length !== 1 || windows[0].region || (layer && !coveredLayer) ||
          windows[0]._exclusiveGdiChildCanvas || Object.values(this.renderer.windows).some(w => w.visible && w.isChild) ||
          this.renderer._resizeOutline || this.renderer._animatedRect ||
          this.renderer._caretBlinkActiveStates?.size || this.renderer._openMenuGeometry()) {
        // Unsupported composition blocks this publication, not the lifetime
        // of an immutable source. A later supported scene still needs a
        // fresh canonical read; overwrite and retirement account for loss.
        this.blockedSceneCacheSerial = this.cacheSerial;
        this.account(); return;
      }
      const stamp = this.epoch.snapshot();
      const versions = this.transfers.get(display.output) || [];
      const clock = { domain: 'page.performance', timeOrigin: performance.timeOrigin, atMs: performance.now() };
      if (!this.epoch.unchanged(stamp)) { this.account('unstable-display-publication'); return; }
      for (const item of versions) {
        const version = item.version;
        // With an opaque DirectX layer, the GDI backing underneath is not the
        // displayed source. Require this layer's own decode and transfer path.
        if (layer && version !== layerProof.version) continue;
        if (version.cacheSerial <= (this.blockedSceneCacheSerial || 0)) continue;
        const record = version.record, key = this.key(record);
        if (record.hostVersion !== (Atomics.load(this.epoch.words, 3) >>> 0) ||
            !this.journal.unchanged(this.memory, record)) continue;
        if (this.used.has(key) || this.seen.has(key)) continue;
        this.used.add(key);
        this.rows.push({ ...record, consumedSurfaceVersion: record.sourceVersion, qualified: true,
          canvasCacheSerial: version.cacheSerial, publication: sequence,
          canonicalRead: { rect: version.rect, layout: record.layout },
          transfers: item.path,
          scene: windows.map(window => ({ hwnd: window.hwnd, processId: window.processId ?? null })),
          pagePublication: clock, callbackReceipt: this.receipts.get(key) || null });
      }
      this.account();
    }
    receipt(message) {
      if (!this.live || message.record?.owner.scope !== this.ownerScope) return;
      const key = this.key(message.record);
      if (!this.receipts.has(key)) this.receipts.set(key, message.callbackReceipt);
      for (const row of this.rows) if (this.key(row) === key) row.callbackReceipt ||= this.receipts.get(key);
    }
    account(reason) {
      for (const record of this.journal.records()) {
        const key = this.key(record);
        if (this.seen.has(key) || this.used.has(key)) continue;
        const discarded = reason || record.versionRejected || (record.superseded ? 'coalesced-before-publication' :
          record.pages && (!this.journal.unchanged(this.memory, record) ||
            record.hostVersion !== (Atomics.load(this.epoch.words, 3) >>> 0)) ? 'source-version-overwritten' : null);
        if (discarded) {
          this.seen.add(key); this.ledger.push({ record, disposition: discarded });
        }
      }
    }
    retire(reason = 'owner-retired') {
      this.live = false; this.epoch.invalidate(); this.account(reason);
      this.renderer._d3dimPublicationJoins.delete(this);
    }
  }

  // Observation is passive. A corrupt proof or diagnostic failure poisons its
  // authority; it must never interrupt an ordinary decode/blit/publication.
  for (const name of ['beginRead', 'find', 'cache', 'cacheDxLayer', 'startComposition', 'transfer',
    'publication', 'receipt', 'account', 'retire']) {
    const method = SurfacePublicationJoin.prototype[name];
    SurfacePublicationJoin.prototype[name] = function(...args) {
      try { return method.apply(this, args); }
      catch (error) {
        this.epoch.invalidate();
        this.failure ||= String(error.message || error);
        return null;
      }
    };
  }

  class Endpoint {
    constructor(manager,id,options){
      this.manager=manager;this.id=id;this.options=options;this.closed=false;
      this.listeners=new Map();this.requests=new Map();this.sequence=0;
      this._ready=deferred();this.ready=this._ready.promise;
    }
    addEventListener(type,fn){
      if(!this.listeners.has(type))this.listeners.set(type,new Set());
      this.listeners.get(type).add(fn);
    }
    removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
    on(type,fn){const wrapper=event=>fn(type==='message'?event.data:event);
      this.addEventListener(type,wrapper);return this;}
    _emit(type,data){
      const event=type==='message'?{data}:data;
      if(typeof this['on'+type]==='function')this['on'+type](event);
      for(const fn of this.listeners.get(type)||[])fn(event);
    }
    _receive(message){
      if(message.t==='legacy-producer-completed'){
        // Receipt is a separate clock sample; never replace the owning swap
        // timestamp with callback delivery time (which may cross windows).
        message={...message,callbackReceipt:{domain:'page.performance',
          timeOrigin:performance.timeOrigin,atMs:performance.now()}};
      }
      if(message.t==='ready')this._ready.resolve(this);
      if(message.t==='legacy-producer-observation' && this.requests.has(message.requestId)) {
        const pending=this.requests.get(message.requestId); this.requests.delete(message.requestId);
        if(message.error)pending.reject(new Error(message.error));else pending.resolve(message.receipt);
        return;
      }
      if(message.t==='render-response'){
        const pending=this.requests.get(message.requestId);
        if(pending){this.requests.delete(message.requestId);
          if(message.error)pending.reject(new Error(message.error));else pending.resolve(message.value);}
        return;
      }
      if(message.t==='error')this._fail(new Error(message.error||'render endpoint failed'));
      this._emit('message',message);
    }
    _fail(error){
      this._ready.reject(error);
      for(const pending of this.requests.values())pending.reject(error);
      this.requests.clear();
      this._emit('error',error);
    }
    postMessage(message){
      if(this.closed)throw new Error('render endpoint is closed');
      this.manager._post(this.id,message);
    }
    request(message){
      if(this.closed)return Promise.reject(new Error('render endpoint is closed'));
      const requestId=++this.sequence,pending=deferred();this.requests.set(requestId,pending);
      try{this.postMessage({t:'render-request',requestId,message});}
      catch(error){this.requests.delete(requestId);pending.reject(error);}
      return pending.promise;
    }
    producerObservation(action, options) {
      if(this.closed)return Promise.reject(new Error('render endpoint is closed'));
      const requestId=++this.sequence,result=deferred();
      const timer=setTimeout(()=>{
        this.requests.delete(requestId);
        if(options?.writerEpochBuffer)new WriterEpoch(options.writerEpochBuffer).invalidate();
        result.reject(new Error('render observation completion timed out'));
      },20000);
      const pending={resolve:value=>{clearTimeout(timer);result.resolve(value);},
        reject:error=>{clearTimeout(timer);result.reject(error);}};
      this.requests.set(requestId,pending);
      try { this.postMessage({t:'legacy-producer-observation',requestId,action,options}); }
      catch(error) { this.requests.delete(requestId);pending.reject(error); }
      return result.promise;
    }
    terminate(){
      if(this._termination)return this._termination;
      this.closed=true;
      this._fail(new Error('render endpoint closed'));
      this._termination=this.manager._close(this.id);
      return this._termination;
    }
  }
  class Manager {
    constructor(options){
      this.options=options;this.ports=new Map();this.pending=new Map();this.closing=new Map();
      this.nextId=0;this.sequence=0;this.queuedBytes=0;this.stopped=false;
      this.maxQueuedBytes=options.maxQueuedBytes??32*1024*1024;
      this.maxQueuedCommands=options.maxQueuedCommands??1024;
      this.maxEndpoints=options.maxEndpoints??64;
      if(!Number.isSafeInteger(this.maxQueuedBytes)||this.maxQueuedBytes<1||
          !Number.isSafeInteger(this.maxQueuedCommands)||this.maxQueuedCommands<1||
          !Number.isSafeInteger(this.maxEndpoints)||this.maxEndpoints<1)
        throw new Error('invalid render worker queue limits');
      this._ready=deferred();this.ready=this._ready.promise;
      this.worker=options.workerFactory?options.workerFactory():new Worker(options.workerUrl||
        'lib/d3d-render-worker.js?v='+encodeURIComponent(options.sourceVersion||'dev'));
      const receive=event=>this._receive(event&&event.data!==undefined?event.data:event);
      const fail=error=>this._fail(error instanceof Error?error:new Error(error?.message||'render worker failed'));
      try {
      if(typeof this.worker.on==='function'){
        this.worker.on('message',receive);this.worker.on('error',fail);
        this.worker.on('exit',()=>{if(!this._retired)this._fail(new Error('render worker exited before heap retirement'));});
      }else{this.worker.addEventListener('message',receive);this.worker.addEventListener('error',fail);}
      this.worker.postMessage({t:'render-init',module:options.module,memory:options.memory,sigs:options.sigs,
        imageBase:options.imageBase,sourceVersion:options.sourceVersion,
        maxQueuedBytes:this.maxQueuedBytes,maxQueuedCommands:this.maxQueuedCommands});
      } catch(error) {
        this.stopped=true;this._failure=error;this._ready.reject(error);
        // Construction failed before the caller acquired the worker owner.
        try { Promise.resolve(this.worker.terminate()).catch(()=>{}); } catch(_) {}
        throw error;
      }
    }
    createEndpoint(options){
      if(this.stopped)throw new Error('render worker is stopped');
      if(this.ports.size>=this.maxEndpoints)throw new Error('render worker endpoint limit');
      const id=++this.nextId,port=new Endpoint(this,id,options);this.ports.set(id,port);
      try{this.worker.postMessage({t:'render-open',endpointId:id,options});}
      catch(error){this.ports.delete(id);port._fail(error);throw error;}
      return port;
    }
    _post(endpointId,message){
      if(this.stopped)throw new Error('render worker is stopped');
      const bytes=byteSize(observationQueueMessage(message));
      if(this.pending.size>=this.maxQueuedCommands||bytes>this.maxQueuedBytes-this.queuedBytes)
        throw new Error('render worker queue capacity exceeded');
      const transportId=++this.sequence;
      this.pending.set(transportId,bytes);this.queuedBytes+=bytes;
      try{this.worker.postMessage({t:'render-message',endpointId,transportId,message});}
      catch(error){this.pending.delete(transportId);this.queuedBytes-=bytes;throw error;}
    }
    _close(endpointId){
      if(this._retired)return Promise.resolve();
      // Lease retirement must wait for physical termination on a failed
      // process, too. The manager's stop promise still reports lost ownership.
      if(this.stopped)return (this._stop||this.stop()).then(()=>{},()=>{});
      const pending=deferred();this.closing.set(endpointId,pending);
      try{this.worker.postMessage({t:'render-close',endpointId});}catch(error){pending.reject(error);}
      return pending.promise;
    }
    _receive(message){
      if(message.t==='render-ready'){this._ready.resolve(this);return;}
      if(message.t==='render-done'){
        const bytes=this.pending.get(message.transportId);
        if(bytes!==undefined){this.pending.delete(message.transportId);this.queuedBytes-=bytes;}return;
      }
      if(message.t==='render-closed'){
        this.ports.delete(message.endpointId);
        const pending=this.closing.get(message.endpointId);
        if(message.error)pending?.reject(new Error(message.error));else pending?.resolve();
        this.closing.delete(message.endpointId);return;
      }
      if(message.t==='render-stopped'){
        this._retired=true;this._shutdown?.resolve(message);return;
      }
      if(message.t==='render-event'){
        const port=this.ports.get(message.endpointId);
        if(port&&!port.closed)port._receive(message.message);else releaseImages(message.message);
        return;
      }
      if(message.t==='error')this._fail(new Error(message.error||'render worker failure'));
    }
    _fail(error){
      this._failure=error;this.stopped=true;this._ready.reject(error);this._shutdown?.reject(error);
      for(const port of this.ports.values())port._fail(error);
      for(const pending of this.closing.values())pending.reject(error);
      this.pending.clear();this.queuedBytes=0;
      this.options.onError?.(error);
    }
    stop(){
      if(this._stop)return this._stop;
      this.stopped=true;this._shutdown=deferred();
      this._stop=(async()=>{
        let timer;
        try{
          if(this._failure)throw this._failure;
          this.worker.postMessage({t:'render-stop'});
          const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('render worker shutdown timed out; heap not reclaimed')),
            this.options.shutdownTimeoutMs??10000);});
          const result=await Promise.race([this._shutdown.promise,timeout]);
          if(result.heapHead){
            if(typeof this.options.reclaimHeap!=='function')throw new Error('render heap reclamation callback missing');
            const adopted=await this.options.reclaimHeap(result.heapHead);
            if(!Number.isInteger(adopted)||adopted<0)throw new Error('render heap handoff rejected');
            result.heapAdopted=adopted;
          }
          return result;
        }finally{
          clearTimeout(timer);
          for(const port of this.ports.values()){port.closed=true;port._fail(new Error('render worker stopped'));}
          this.ports.clear();this.pending.clear();this.queuedBytes=0;
          await this.worker.terminate();
        }
      })();
      this._stop.catch(()=>{});return this._stop;
    }
  }
  return {Manager, observationQueueMessage, SharedPacketPool, SubmissionQueue, WriterEpoch, CommandWriterHandoff, observeInstance, observeCall, observeHostWrite,
    SurfaceVersionJournal, SurfacePublicationJoin};
});
