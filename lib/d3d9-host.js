// WAT owns guest state/resources. This bridge snapshots them into the shared
// neutral command stream. Browser devices use endpoints of one process render
// worker; guest-visible readbacks and lifetime boundaries retain their fences.
(function (root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const api = factory(node ? require('./d3d9-backend') : root.D3D9Backend,
    node ? require('./d3d9-texture') : root.D3D9Texture,
    node ? require('./d3d-shader-ir') : root.D3DShaderIR,
    node ? require('./d3d-command-stream') : root.D3DCommandStream,
    () => node ? require('./d3d9-software-backend') : root.D3D9SoftwareBackend);
  if (node) module.exports = api; else root.D3D9Host = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Backend, Texture, ShaderIR, Stream, getSoftwareBackend) {
  'use strict';
  function copyColorRows(dest,pitch,result,width,height,format){
    const row=width*(format===23?2:4);
    if(!(result.pixels instanceof Uint8Array)||result.width!==width||result.height!==height||
      result.pitch<row||result.pixels.length!==result.pitch*height||dest.length!==pitch*height||pitch<row||
      (format===23&&result.format!==23))throw new Error('invalid color readback extent');
    for(let y=0;y<height;y++)dest.set(result.pixels.subarray(y*result.pitch,y*result.pitch+row),y*pitch);
  }

  // ---- Converted-texture snapshot cache -----------------------------------
  //
  // Every DRAW carries the bound textures as decoded RGBA, and without a cache
  // every DRAW rebuilds them from guest bytes: a fresh Uint8Array(w*h*4) and a
  // per-texel conversion loop for each mip level, each time. Measured on Black
  // & White 2's tutorial land, live, over 56.1s of wall clock: 679 draws cost
  // 16.49s inside the bridge, of which the queue's own publication (copyPayload
  // included) was 0.78s. The other 15.7s -- 28% of ALL wall clock -- was this
  // decode, re-running over land textures that had not changed since the level
  // loaded.
  //
  // WHEN A SNAPSHOT IS STILL THE SAME PICTURE. Guest code can only reach these
  // texels through LockRect, and $d3d9_texture_lock bumps the mip's dirty
  // sequence at +28 (AddDirtyRect bumps it too, but a MANAGED texture may be
  // written without ever calling that, so the lock is the load-bearing one). A
  // matching sequence, together with the same storage pointer, byte length,
  // format and dimensions, therefore means the guest has not been handed a
  // writable pointer since the snapshot was taken.
  //
  // WHY THERE IS ALSO A FINGERPRINT. The key is a mip record's address, and
  // after a texture is released that address can be handed to a new one whose
  // sequence has restarted -- the one case the sequence cannot see. So a hit
  // also re-checks a sparse sample of the source bytes. That is ~2KB of
  // comparison against megabytes of conversion, and it makes a stale hit
  // require a reused allocation byte-identical everywhere sampled.
  //
  // A reused address needs a new texture, and every texture a device creates
  // bumps that device's generation word at program state +25596. So a hit
  // re-samples only the first time it is seen under a new (device entry,
  // generation) -- the entry object, not the state address, so a new device
  // whose state reuses a released one's block cannot inherit its counts.
  // After that the counters alone prove it, and the per-draw check stops
  // walking 2KB of every bound level.
  const FINGERPRINT_CHUNKS = 64, FINGERPRINT_CHUNK = 32;
  // D3DTSS_BUMPENVMAT00..11, BUMPENVLSCALE, BUMPENVLOFFSET, as dword indices.
  const BUMP_STATE_IDS = [7, 8, 9, 10, 22, 23];
  function fingerprint(src) {
    const step = Math.max(FINGERPRINT_CHUNK, Math.floor(src.length / FINGERPRINT_CHUNKS));
    const chunks = [];
    for (let at = 0; at < src.length; at += step)
      chunks.push(src.subarray(at, Math.min(at + FINGERPRINT_CHUNK, src.length)));
    const flat = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0; for (const c of chunks) { flat.set(c, o); o += c.length; }
    return flat;
  }
  // Runs on every bound texture level of every draw, so it walks the same
  // sample positions as fingerprint() in place instead of building a fresh
  // fingerprint to compare: that allocation was ~4% of B&W2's main thread on
  // WebGL.
  function sameFingerprint(previous, src) {
    const step = Math.max(FINGERPRINT_CHUNK, Math.floor(src.length / FINGERPRINT_CHUNKS));
    // Texture memory is dword-aligned in practice, so compare dwords: a
    // quarter of the iterations of the byte loop, which was still the top line
    // of B&W2's WebGL bridge. Every sampled chunk then starts and ends on a
    // dword because step, the chunk size and the length all do.
    if (((src.byteOffset | src.length | step | previous.byteOffset | previous.length) & 3) === 0) {
      const a = new Uint32Array(src.buffer, src.byteOffset, src.length >> 2);
      const b = new Uint32Array(previous.buffer, previous.byteOffset, previous.length >> 2);
      const words = src.length >> 2, stepWords = step >> 2, chunkWords = FINGERPRINT_CHUNK >> 2;
      let w = 0;
      for (let at = 0; at < words; at += stepWords) {
        const end = Math.min(at + chunkWords, words);
        if (w + end - at > b.length) return false;
        for (let i = at; i < end; i++) if (a[i] !== b[w++]) return false;
      }
      return w === b.length;
    }
    let o = 0;
    for (let at = 0; at < src.length; at += step) {
      const end = Math.min(at + FINGERPRINT_CHUNK, src.length);
      if (o + end - at > previous.length) return false;
      for (let i = at; i < end; i++) if (src[i] !== previous[o++]) return false;
    }
    return o === previous.length;
  }

  // Per-draw scratch: the vertex and index snapshots and the shader constant
  // banks a draw hands to the backend. Allocating these fresh for every draw
  // was ~40% of the bridge's own JS time in Black & White 2 on WebGL (the
  // vertex Uint8Array alone was the hottest line of Bridge.call). A draw takes
  // the whole set and gives it back only when its command completed before
  // _issue returned; a draw still pending keeps its arrays and the next one
  // builds a fresh set. Byte buffers grow to the largest draw seen, up to
  // SCRATCH_KEEP_BYTES; a bigger draw gets arrays of its own.
  const SCRATCH_KEEP_BYTES = 16 << 20;
  function drawScratch() {
    return { vertexBytes: new ArrayBuffer(0), indexBytes: new ArrayBuffer(0),
      vertexConstants: new Float32Array(1024), pixelConstants: new Float32Array(32),
      vertexIntegerConstants: new Int32Array(64), vertexBooleanConstants: new Uint32Array(16),
      pixelIntegerConstants: new Int32Array(64), pixelBooleanConstants: new Uint32Array(16) };
  }
  // n bytes of the scratch buffer at `key`, grown when too small.
  function scratchBytes(scratch, key, n) {
    if (n > SCRATCH_KEEP_BYTES) return new Uint8Array(n);
    if (scratch[key].byteLength < n)
      scratch[key] = new ArrayBuffer(Math.min(SCRATCH_KEEP_BYTES, Math.max(n, scratch[key].byteLength * 2, 4096)));
    return new Uint8Array(scratch[key], 0, n);
  }

  class Bridge {
    constructor(options) {
      this.options = options; this.devices = new Map(); this.lastError = null;
      this.backend = options.backend || 'webgl';
      if (!['software', 'webgl'].includes(this.backend)) throw new Error('invalid D3D9 backend selection');
      this.asyncSoftware = this.backend === 'software' && !!options.createSoftwareWorker;
      this.requests = new Map(); this.nextRequest = -2; this.closed = false;
      this.deviceGenerations = new Map();
      this.presentWaits = new Set();
      // Converted mip levels, keyed by the guest mip record's wasm address and
      // held in least-recently-used order. The budget is a cap on decoded RGBA
      // the bridge keeps alive between draws, not a queue budget: these arrays
      // are never handed out, only copied from.
      //
      // 192MB because the scene that motivated this was censused live rather
      // than guessed at. Black & White 2's tutorial land, over 62s of play:
      // 1226 draws bound 10128 mip levels, but only 598 DISTINCT ones, whose
      // decoded RGBA totals 81.4MB with the largest single level at 4MB. So
      // 94.1% of bindings, and 97.8% of all texel-conversion work (1.01
      // billion texels re-converted against 22.4 million genuinely new), was
      // the same picture decoded again. A budget over twice that working set
      // keeps the whole scene resident with no eviction churn; the LRU order
      // is what makes a smaller one degrade gracefully rather than thrash.
      this._textureSnapshots = new Map();
      this._textureSnapshotBytes = 0;
      this._textureSerial = 0;
      // How many bytes of converted texture levels one device may keep
      // resident. A level is uploaded once under a key and then referenced by
      // the key alone; over this budget the least recently drawn keys are
      // released on the next draw. The software worker's whole allocation
      // budget is 64 MB, so half of it is the most that can sit in textures.
      this.maxResidentTextureBytes = options.maxResidentTextureBytes === undefined
        ? 32 * 1024 * 1024 : options.maxResidentTextureBytes;
      if (!Number.isSafeInteger(this.maxResidentTextureBytes) || this.maxResidentTextureBytes < 0)
        throw new Error('invalid D3D9 resident texture budget');
      this.maxTextureSnapshotBytes = options.maxTextureSnapshotBytes === undefined
        ? 192 * 1024 * 1024 : options.maxTextureSnapshotBytes;
      if (!Number.isSafeInteger(this.maxTextureSnapshotBytes) || this.maxTextureSnapshotBytes < 0)
        throw new Error('invalid D3D9 texture snapshot budget');
      this.maxRequests = options.maxPendingRequests === undefined ? 256 : options.maxPendingRequests;
      if (!Number.isSafeInteger(this.maxRequests) || this.maxRequests < 1) throw new Error('invalid D3D9 pending request limit');
      // How many fire-and-forget commands may be in flight before the guest is
      // parked for backpressure. 0 restores the old command-by-command fence,
      // which is what every synchronous (non-worker) device does anyway.
      this.maxDeferred = options.maxDeferredCommands === undefined ? 32 : options.maxDeferredCommands;
      if (!Number.isSafeInteger(this.maxDeferred) || this.maxDeferred < 0) throw new Error('invalid D3D9 deferred command limit');
    }
    get sharedWorker() {
      return typeof this.options.createRenderWorker==='function' &&
        (!this.options.shouldUseRenderWorker || this.options.shouldUseRenderWorker());
    }
    _createCanvas(width, height) {
      const canvas = this.options.createCanvas
        ? this.options.createCanvas(width, height)
        : (typeof document !== 'undefined' ? document.createElement('canvas') : null);
      if (!canvas) return null;
      if ((canvas.width | 0) !== width) canvas.width = width;
      if ((canvas.height | 0) !== height) canvas.height = height;
      return canvas;
    }
    // Record one converted mip level, evicting the least recently used ones
    // until the kept RGBA fits the budget. A single level larger than the whole
    // budget is simply not kept -- caching it would evict everything else and
    // then be evicted itself on the next draw.
    _rememberTexture(key, entry) {
      const bytes = entry.pixels.byteLength;
      const previous = this._textureSnapshots.get(key);
      if (previous) { this._textureSnapshots.delete(key); this._textureSnapshotBytes -= previous.pixels.byteLength; }
      if (bytes > this.maxTextureSnapshotBytes) return null;
      entry.bytes = bytes;
      // The serial is the level's identity on the executor side: new content
      // at the same guest address is a new snapshot and a new key, so a
      // resident copy can never be mistaken for it.
      entry.id = ++this._textureSerial;
      this._textureSnapshots.set(key, entry);
      this._textureSnapshotBytes += bytes;
      for (const [oldest, held] of this._textureSnapshots) {
        if (this._textureSnapshotBytes <= this.maxTextureSnapshotBytes) break;
        if (oldest === key) continue;
        this._textureSnapshots.delete(oldest);
        this._textureSnapshotBytes -= held.pixels.byteLength;
      }
      return entry;
    }
    // One converted mip level = one key. A key the device already holds
    // travels without its pixels; a new one carries them once and joins the
    // device's resident set when the draw is issued. Before this every draw
    // carried the full RGBA of every bound level, and each copy along the way
    // (command-stream copy, structured clone to the worker, copy into wasm
    // memory, re-upload to WebGL) was paid per draw: Black & White 2's land
    // draws moved their 8 MB texture three times per draw for nothing.
    _residentLevel(entry, snap, plan, reserve) {
      const key = 't' + snap.id, level = { width: snap.width, height: snap.height, key };
      plan.uses.add(key);
      if (entry.resident.has(key)) {
        // Touch for recency: the Map's insertion order is the eviction order.
        entry.resident.delete(key); entry.resident.set(key, snap.bytes);
        if (reserve) reserve(64);
        return level;
      }
      if (!plan.added.some(added => added.key === key)) { plan.added.push({ key, bytes: snap.bytes }); plan.addedBytes += snap.bytes; }
      if (reserve) reserve(snap.bytes);
      level.pixels = snap.pixels;
      return level;
    }
    // Keys this draw does not use are released, oldest first, until the
    // device is back under budget. The release list rides on the draw itself
    // and the executor frees them before it binds anything, so the two sides
    // never disagree about what is resident: the host decides, the draw tells.
    _planResidency(entry, plan) {
      // Keys forgotten after a failure are released first (harmless if the
      // executor never held them) and re-sent with pixels by this draw.
      if (entry.residentStale) for (const key of entry.residentStale) plan.releases.push(key);
      let bytes = entry.residentBytes + plan.addedBytes;
      for (const [key, held] of entry.resident) {
        if (bytes <= this.maxResidentTextureBytes) break;
        if (plan.uses.has(key)) continue;
        plan.releases.push(key); bytes -= held;
      }
    }
    // Committed only once the draw has been accepted for submission: a draw
    // the builder rejects leaves the executor exactly as it was.
    _commitResidency(entry, plan) {
      entry.residentStale = null;
      for (const key of plan.releases) if (entry.resident.has(key)) { entry.residentBytes -= entry.resident.get(key); entry.resident.delete(key); }
      for (const { key, bytes } of plan.added) { entry.resident.set(key, bytes); entry.residentBytes += bytes; }
    }
    // After any failure the two sides may disagree about what was uploaded
    // (a draw that carried pixels never ran, or ran into an earlier check).
    // Forget everything: the next draw releases these keys and re-sends what
    // it uses, so a lost upload costs one re-send instead of poisoning a key.
    _forgetResidency(entry) {
      if (!entry || !entry.resident || !entry.resident.size) return;
      const stale = entry.residentStale || (entry.residentStale = []);
      for (const key of entry.resident.keys()) stale.push(key);
      entry.resident.clear(); entry.residentBytes = 0;
    }

    _releaseCanvas(canvas) {
      if (canvas && typeof canvas.releaseWebGLContext === 'function') canvas.releaseWebGLContext();
    }
    _worker(entry) {
      if (entry?.sharedWorker) {
        if (!entry.workerReady) entry.workerReady = Promise.resolve().then(() =>
          this.options.createRenderWorker({api:'neutral',backend:entry.kind,
            deviceId:entry.queue.deviceId,generation:entry.queue.generation}))
          .then(async consumer => {entry.workerConsumer=consumer;await consumer.ready;return consumer;});
        return entry.workerReady;
      }
      if (!this.workerReady) this.workerReady = Promise.resolve().then(() => this.options.createSoftwareWorker())
        .then(async consumer => { this.workerConsumer = consumer; await consumer.ready; return consumer; });
      return this.workerReady;
    }
    _error(error) {
      this.lastError = error;
      if (this.options.onError) this.options.onError(error);
      return -1;
    }
    // Readiness is separate from consuming the result. In particular Present's
    // canonical copy occurs on the resumed guest call, never in an RPC callback.
    wait(token) { return this.requests.get(token | 0)?.ready || Promise.resolve(); }
    _presentBoundary(entry) {
      // The emulated display advances on browser composition frames, or on a
      // virtual60Hz display in the headless host. This is not a GPU fence.
      return new Promise((resolve,reject)=>{
        const raf=typeof requestAnimationFrame==='function';
        const record={cancel:null};
        let id;
        const done=timestamp=>{
          // A faster host monitor must not turn the advertised60Hz guest mode
          // into multiple presents in one emulated refresh period.
          const now=raf?timestamp:Date.now(),tick=Math.floor(now*60/1000);
          if(raf&&entry.presentTick===tick&&!this.closed){id=requestAnimationFrame(done);return;}
          entry.presentTick=tick;this.presentWaits.delete(record);
          this.closed?reject(new Error('D3D9 bridge closed')):resolve();
        };
        id=raf?requestAnimationFrame(done):setTimeout(done,Math.ceil(1000/60));
        record.cancel=()=>{raf?cancelAnimationFrame(id):clearTimeout(id);this.presentWaits.delete(record);reject(new Error('D3D9 presentation cancelled'));};
        this.presentWaits.add(record);
      });
    }
    _consume(entry,command,execute) {
      const present=command.opcode===Stream.OPCODES.PRESENT&&command.payload.interval!==0x80000000;
      if(present){
        const interval=command.payload.interval;
        if(interval!==0&&interval!==1)throw new Error('unsupported D3D9 presentation interval');
      }
      if(!entry.async&&!present)return execute(command);
      // The asynchronous queue is ORDERED: a command is posted to the worker
      // as soon as it is submitted, not once the previous one has come back.
      // The worker executes in arrival order, so the main-thread hop is paid
      // once per frame instead of once per draw. Posting still has to follow
      // submission order, and a Present waits for its display boundary before
      // it may go out, so every post is chained behind the one before it: the
      // draws of the next frame leave after that Present, never ahead of it.
      const gate=present?this._presentBoundary(entry):null;
      const prior=entry.async?entry.postChain||Promise.resolve():Promise.resolve();
      const result=prior.then(()=>gate).then(()=>execute(command));
      if(entry.async)entry.postChain=result.then(()=>{},()=>{});
      const value=result.then(r=>r.value);value.catch(()=>{});
      return {consumed:result.then(r=>r.consumed),completion:result.then(r=>r.complete?undefined:r.completion),value};
    }
    _result(entry, value, finalize = () => 1, allowLost = false) {
      if (!value || typeof value.then !== 'function') return finalize(value);
      if (this.nextRequest < -0x80000000) throw new Error('D3D9 request token space exhausted');
      const token = this.nextRequest--;
      let consumed;
      const record = { entry, generation: entry.queue.generation, done: false, finalize, allowLost,
        consumed: new Promise(resolve => { consumed = resolve; }), consume: () => consumed() };
      record.ready = Promise.resolve(value).then(result => {
        if(this.closed||entry.dead||entry.queue.generation!==record.generation){
          result?.bitmap?.close();record.error=new Error('stale D3D9 render completion');
        }else record.value = result;
      }, error => { record.error = error; })
        .then(() => { record.done = true; });
      this.requests.set(token, record);
      return token;
    }
    _poll(token) {
      const record = this.requests.get(token | 0);
      if (!record) return -1;
      if (!record.done) return token | 0;
      this.requests.delete(token | 0);
      try {
        if (record.error) throw record.error;
        if (this.closed || record.entry.dead || (record.entry.lost && !record.allowLost) || record.entry.queue.generation !== record.generation)
          throw new Error('stale D3D9 render completion');
        return record.finalize(record.value);
      } catch (error) { record.value?.bitmap?.close();return this._error(error); }
      finally { record.consume(); }
    }
    _retireFailedWorker(entry) {
      if (entry.sharedWorker) {
        entry.lost = true;
        if (!entry.workerRetirement) entry.workerRetirement = (async()=>{
          try{await this._worker(entry);}catch(_){/* initialization may have failed */}
          if(entry.workerConsumer)await entry.workerConsumer.cancel(0,new Error('D3D9 device endpoint retired'));
        })();
        return entry.workerRetirement;
      }
      if (!this.workerRetirement) {
        // A poisoned stream cannot be reset behind the worker's live device.
        // Retire the shared worker instead, explicitly losing every device.
        this.workerDead = true;
        for (const entry of this.devices.values()) entry.lost = true;
        this.workerRetirement = this._worker().then(consumer => consumer.cancel(0,
          new Error('D3D9 worker retired after device failure')));
      }
      return this.workerRetirement;
    }
    async close() {
      this.closed = true;
      for(const wait of this.presentWaits)wait.cancel();
      // Cancellation must not publish a queued Present into a retired guest.
      for (const record of this.requests.values()) {record.value?.bitmap?.close();record.consume();}
      try {
        await Promise.all([...this.devices.values()].map(async entry => {
          if (!entry.sharedWorker || !entry.workerReady) return;
          try { await entry.workerReady; } catch (_) { /* failed initialization */ }
          if (entry.workerConsumer) await entry.workerConsumer.cancel(0,new Error('D3D9 bridge closed'));
        }));
        if (this.workerReady) {
          try { await this._worker(); } catch (_) { /* transport owns init failure */ }
          if (this.workerConsumer) await this.workerConsumer.cancel(0, new Error('D3D9 bridge closed'));
        }
      } finally {
        for (const entry of this.devices.values()) {
          entry.dead = true;entry.queryResults?.clear();
          this._releasePresentation(entry);
        }
        this.requests.clear();
      }
    }
    _capacity() { return this.options.commandCapacityBytes === undefined ? 64 * 1024 * 1024 : this.options.commandCapacityBytes; }
    _releasePresentation(entry) {
      if(entry.win?._gpuFrameLayer===entry.layer)entry.win._gpuFrameLayer=null;
      if(entry.win?._dxFrameLayer===entry.layer)entry.win._dxFrameLayer=null;
      entry.bitmap?.close();entry.bitmap=null;
    }
    _publishGPU(entry,completed) {
      if(this.closed||entry.dead||entry.lost||entry.releasing){completed.bitmap?.close();return 1;}
      const {win,layer}=entry;
      if(completed.bitmap){entry.bitmap?.close();entry.bitmap=completed.bitmap;}
      layer.canvas=completed.bitmap||completed.canvas;layer.writeSeq++;
      win._gpuFrameLayer=layer;win._dxFrameLayer=layer;
      if(win.isChild)win._canonicalOwnSurface=true;
      if(this.options.onPresent)this.options.onPresent(layer);
      this.options.renderer()?.scheduleRepaint?.();
      return 1;
    }
    _finish(device) {
      if (device.gpu.gl.isContextLost()) throw new Error('D3D9 GPU context lost');
      device.gpu.finish();
      if (device.gpu.gl.isContextLost()) throw new Error('D3D9 GPU context lost');
    }
    _execute(entry, command) {
      if (entry.kind === 'software') return entry.device.execute(command);
      const op = Stream.OPCODES, p = command.payload;
      let value = 1;
      if (command.opcode === op.RESOURCE_RELEASE) {
        if(p.kind==='color-set') {
          for(const id of p.ids)entry.device.releaseColor(id);
          this._finish(entry.device);
          return {value:1,complete:true};
        }
        if(p.kind==='color') {
          entry.device.releaseColor(p.id);
          this._finish(entry.device);
          return {value:1,complete:true};
        }
        if(p.kind==='depth') {
          entry.device.releaseDepth(p.id);
          this._finish(entry.device);
          return {value:1,complete:true};
        }
        if(p.kind!=='device')throw new Error('unsupported WebGL resource release kind');
        // Context loss has already retired GPU work; otherwise destruction must
        // wait for all prior commands before reclaiming backend resources.
        if (!entry.device.gpu.gl.isContextLost()) this._finish(entry.device);
        entry.device.destroy();
        return { value, complete: true };
      }
      try {
        if (command.opcode === op.RESOURCE_UPDATE && p.kind==='reset') entry.device.reset(p);
        else if (command.opcode === op.RESOURCE_CREATE && p.kind==='color') entry.device.createColor(p.resource,p.pixels,p.pitch);
        else if (command.opcode === op.RESOURCE_UPDATE && p.kind==='color') entry.device.updateColor(p.resource,p.pixels,p.pitch,p.rect);
        else if (command.opcode === op.READBACK) value=entry.device.readColor(p.resource||null);
        else if (command.opcode === op.CLEAR) entry.device.clear(p.color, p.flags,p.depth,p.rects,p.depthAttachment,p.stencil,p.colorAttachment);
        else if (command.opcode === op.DRAW) entry.device.draw(p);
        else if (command.opcode === op.PRESENT) {
          // No readback here. Every guest-side reader of the back buffer --
          // LockRect, GetDC, GetRenderTargetData, StretchRect -- fetches it
          // through a READBACK of its own, and the WAT present path returns
          // before touching the DIB when the host answers 1, so the copy this
          // used to make on every frame fed nothing. Measured on Black &
          // White 2's profile dialog: readColor was 7.2% of the main thread,
          // gl.readPixels alone 4.3%, at 17 frames a second.
          value = { canvas: entry.device.present() };
        } else if (command.opcode !== op.FENCE) throw new Error('unsupported D3D9 render command');
      } catch (error) {
        // Synchronous validation failures still return INVALIDCALL to this API,
        // not a deferred device fault. Any partial backend work is retired first.
        value = { error };
      }
      // Drain the GPU only where something observes it: a fence (EVENT
      // queries), a readback, a reset, or a command that failed part way.
      // Draws, clears and uploads are ordered by GL itself and nothing reads
      // their completion. Finishing after every one of them was 12-38% of
      // Morrowind's gameplay CPU, a full pipeline stall per draw. Present
      // flushes so the frame is submitted without waiting for it.
      if (value?.error || command.opcode === op.FENCE || command.opcode === op.READBACK
          || command.opcode === op.RESOURCE_UPDATE && p.kind === 'reset') this._finish(entry.device);
      else {
        if (command.opcode === op.PRESENT) entry.device.gpu.gl.flush();
        if (entry.device.gpu.gl.isContextLost()) throw new Error('D3D9 GPU context lost');
      }
      return { value, complete: true };
    }
    _submit(entry, opcode, payload) {
      // A command deferred earlier may have failed since. Report it here, at
      // the next call on this device, rather than losing it: the queue's own
      // poisoned-stream message replaces it from now on and that message names
      // nothing, while this one names the command that could not be served.
      if (entry.deferredError) { const error = entry.deferredError; entry.deferredError = null; this._forgetResidency(entry); throw error; }
      // WebGL executes every command but a paced Present before submit
      // returns, and each payload is built fresh for its one command (texture
      // levels shared with the residency cache are read-only), so the queue's
      // defensive deep copy only duplicates it. The asynchronous software path
      // keeps the copy: its commands wait on a promise chain before posting.
      const receipt = entry.queue.submit(opcode, payload, entry.async ? undefined : { owned: true });
      if (entry.async || receipt.status !== 'completed') return entry.queue.fence(receipt.sequence, receipt.generation).then(async () => {
        const value = await receipt.value;
        if (value && value.error) throw new Error(String(value.error));
        return value;
      });
      if (receipt.value && receipt.value.error) throw receipt.value.error;
      return receipt.value;
    }
    // A draw or a clear is fire-and-forget. `_result`'s default finalize
    // returns 1 whatever the worker eventually answers, so parking the guest
    // on one buys nothing but the error -- and the error is kept, above.
    //
    // This is the shape D3D9 itself has: the runtime validates parameters
    // synchronously and returns D3DERR_INVALIDCALL from the call, then records
    // the command and lets the driver consume it asynchronously; a fault only
    // the hardware can see surfaces at the next synchronization point, as
    // device-lost from Present, never as a per-draw result. Commands whose
    // value the guest really does read -- readback, present, query, release,
    // reset -- still fence.
    //
    // Measured on Black & White 2's cinematic flyover before this: 536 draws
    // in 90 seconds, ~150 ms of wall clock each against ~15 ms of main-thread
    // CPU and ~1.2 ms of worker CPU. Nine tenths of the wall clock was the
    // thread hand-off, with both threads idle inside it.
    //
    // BYTES, not commands, are the binding constraint, and the command count is
    // the weaker half of the backpressure. The queue budgets each payload
    // against what is still FREE (lib/d3d-command-stream.js charges against
    // `capacityBytes - bytes`, and `bytes` only drops when a command retires),
    // so under the old command-by-command fence every draw met an empty queue
    // and could use the whole 64 MB. Deferred commands hold their copied
    // payloads all at once instead. Measured on B&W2's land: its draws carry
    // 2048x1024 texture payloads of about 8 MB, so eight in flight exhaust the
    // capacity and the ninth is refused -- which is fatal, not merely slow,
    // because the queue's error is sticky. That is what this watermark is for:
    // stop deferring once a quarter of the capacity is in flight, so a payload
    // that fit before still finds at least three quarters of it free.
    _deferrable(entry, opcode) {
      return !!(entry.async && this.maxDeferred
        && (opcode === Stream.OPCODES.DRAW || opcode === Stream.OPCODES.CLEAR)
        && !entry.dead && !entry.lost && !entry.releasing
        && !entry.queue.error && !entry.deferredError
        && entry.queue.bytes * 4 <= entry.queue.capacityBytes
        && (entry.deferred ? entry.deferred.size : 0) < this.maxDeferred);
    }
    // Submit, and park the guest only when the result is worth waiting for.
    _issue(entry, opcode, payload, finalize) {
      if (!this._deferrable(entry, opcode))
        return this._result(entry, this._submit(entry, opcode, payload), finalize);
      let value;
      try { value = this._submit(entry, opcode, payload); }
      catch (error) {
        // A payload can still be too large for what the in-flight ones left,
        // because the watermark is checked before the size is known. FULL is
        // backpressure, not a failure, and must never reach the guest as one:
        // park it until the deferred commands have drained, which restores the
        // empty queue the fencing path always submitted into, and submit then.
        // A payload too big for an EMPTY queue still fails, exactly as before.
        const draining = entry.deferred;
        if (!error || error.code !== 'FULL' || !draining || !draining.size) throw error;
        return this._result(entry, Promise.all([...draining])
          .then(() => this._submit(entry, opcode, payload)), finalize);
      }
      const pending = entry.deferred || (entry.deferred = new Set());
      // The in-flight set is the backpressure: a guest that outruns the worker
      // by maxDeferred commands parks on the next one. Unbounded queueing is
      // not free -- each command holds its copied payload and the worker's
      // native scratch until it retires.
      const record = Promise.resolve(value).then(() => {}, error => {
        if (!entry.deferredError) entry.deferredError = error;
      }).then(() => { pending.delete(record); });
      pending.add(record);
      return finalize ? finalize(1) : 1;
    }
    // Present is pipelined one frame deep on the asynchronous software path.
    // The frame just submitted stays in flight; the guest parks on the frame
    // BEFORE it, whose pixels land at the address that Present named, and the
    // WAT side presents that one (result 0). The first Present after device
    // creation or a reset still blocks on itself, so an app's first frame is
    // on screen before it goes off to load; the Present after that one has
    // nothing older to wait for and returns at once, re-presenting the frame
    // already published. Every later Present shows the previous frame.
    //
    // What this buys: the worker rasterizes frame N while the guest builds
    // frame N+1, instead of both threads taking turns being idle. Measured on
    // Black & White 2's menus before this: the render worker sat idle about
    // half of every frame, waiting for the guest to come back from Present.
    //
    // What it costs: a frame drawn once and then not presented again -- a
    // loading screen painted right before a long load -- reaches the screen
    // only at the next Present. Reset and release drop the frame in flight.
    _pipelinePresent(entry, completed, dest) {
      const previous = entry.pendingPresent;
      const record = { completed, dest };
      entry.pendingPresent = record;
      completed.then(() => {}, error => {
        if (entry.pendingPresent === record) entry.pendingPresent = null;
        if (!entry.deferredError) entry.deferredError = error;
      });
      if (!previous) return 0;
      return this._result(entry, previous.completed, done => { previous.dest.set(done.pixels); return 0; });
    }
    // A Present issued from inside a synchronous SendMessage cannot park: WAT
    // runs that window procedure in a recursive $run, which has no way back
    // to the JS event loop the software frame completes on, so it spins its
    // 64 rounds and abandons the procedure mid-call. Pawn 3 presents its first
    // frame from the WM_SIZE that SetWindowPos sends, and died of exactly that.
    // Such a frame goes into the pipeline without a wait: the call returns 0
    // (re-present what is already published), and the next top-level Present
    // waits on it and publishes its pixels, as it would for any pipelined frame.
    _insideSyncSend() {
      const depth = this.options.getExports?.()?.get_sync_msg_depth;
      return typeof depth === 'function' && (depth() | 0) > 0;
    }
    _detachPresent(entry, completed, dest) {
      const record = { completed, dest };
      entry.pendingPresent = record;
      entry.presented = true;
      completed.then(() => {}, error => {
        if (entry.pendingPresent === record) entry.pendingPresent = null;
        if (!entry.deferredError) entry.deferredError = error;
      });
      return 0;
    }
    _dropPendingPresent(entry) {
      entry.pendingPresent = null;
      entry.presented = false;
    }
    _queryIssue(entry,id,begin){
      if(entry.kind!=='software'||entry.dead||entry.lost||entry.releasing)throw new Error('query device unavailable');
      if(!Number.isInteger(id)||id<1||id>0xffffffff)throw new Error('invalid query identity');
      const queries=entry.queryResults||(entry.queryResults=new Map());
      if(!queries.has(id)&&queries.size>=4096)throw new Error('query capacity exhausted');
      if(!begin&&!queries.has(id))throw new Error('query has no begin');
      const result=this._submit(entry,begin?Stream.OPCODES.QUERY_BEGIN:Stream.OPCODES.QUERY_END,{queryId:id});
      const record={building:begin,done:false,generation:entry.queue.generation};queries.set(id,record);
      const complete=value=>{if(queries.get(id)===record){record.value=value;record.done=true;}};
      const fail=error=>{if(queries.get(id)===record){record.error=error;record.done=true;}};
      if(result&&typeof result.then==='function')result.then(complete,fail);else complete(result);
      return 1;
    }
    call(opcode, address, aux) {
      // Private format query on the existing capability opcode; the host
      // import and Worker broker already forward it without an ABI change.
      if(opcode===0x30017&&aux===23){
        const e=this.options.getExports?.();
        return !this.closed&&this.backend==='software'&&!!this.options.enableProgrammable&&!!getSoftwareBackend()&&
          ['d3d_software_bind_color_format','d3d_software_create','d3d_shader_vm_compile','d3d_software_clear_masked']
            .every(name=>typeof e?.[name]==='function')?1:0;
      }
      if (opcode === 0x30007) return this._poll(aux);
      if (this.closed) return -1;
      // PrimitiveMiscCaps implemented by this executor, independent of whether
      // another draw currently occupies the render request queue.
      if(opcode===0x30017) {
        const e=this.options.getExports?.();
        return this.backend==='software' && this.options.enableProgrammable &&
          e?.d3d_software_create && e?.d3d_shader_vm_compile ? 0x800 : 0;
      }
      if(opcode===0x3000a)return this.backend==='software'&&this.options.enableProgrammable&&
        typeof this.options.getExports?.()?.d3d_software_samples==='function'?1:0;
      // Query operations have their own bounded result table and never allocate
      // a parked-render token. In particular polling/release must remain usable
      // when unrelated render callers occupy every token slot.
      if (this.requests.size >= this.maxRequests &&
          opcode !== 0x30005 && !(opcode>=0x3000b&&opcode<=0x3000e))
        return this._error(new Error('D3D9 pending request capacity exhausted'));
      if(opcode===0x30006) {
        try {
          // All CPU submissions precede this synchronous broker operation.
          // No GPU entry means this device has only completed CPU work.
          const entry=this.devices.get(aux>>>0);
          if(entry) return this._result(entry, this._submit(entry, Stream.OPCODES.FENCE, { kind: 'event' }));
          return 1;
        } catch(error) {this.lastError=String(error);return 0;}
      }
      if(opcode===0x30005) {
        if(!this.options.enableProgrammable)return 0;
        if(this.backend==='software') {
          const e=this.options.getExports?.();
          return getSoftwareBackend() && e?.d3d_software_create && e?.d3d_shader_vm_compile ? 1 : 0;
        }
        if(this.sharedWorker)return 1;
        if(this.probed===undefined) {
          const canvas=this._createCanvas(4,4);
          if(!canvas)return 0;
          try {this.probed=Backend.probe(canvas);}
          finally {this._releaseCanvas(canvas);}
        }
        return this.probed?1:0;
      }
      const memory = this.options.getMemory(), view = new DataView(memory);
      const u32 = offset => view.getUint32(offset, true);
      const g2w = pointer => this.options.guestToWasm(pointer);
      if(opcode===0x3000d||opcode===0x3000e){
        try{
          const entry=this.devices.get(u32(address+8)),id=aux>>>0;
          if(opcode===0x3000e){
            if(!entry)return 1;
            entry.queryResults?.delete(id);
            const result=this._submit(entry,Stream.OPCODES.RESOURCE_RELEASE,{kind:'query',queryId:id});
            if(result&&typeof result.then==='function')result.catch(error=>{entry.lost=true;this._error(error);});
            return 1;
          }
          const record=entry?.queryResults?.get(id);
          if(!record||record.building||entry.dead||entry.lost||record.generation!==entry.queue.generation)
            throw new Error('query result unavailable');
          if(!record.done)return 0;
          if(record.error)throw record.error;
          if(!Number.isInteger(record.value?.samplesLow))throw new Error('invalid query sample result');
          view.setUint32(address+32,record.value.samplesLow,true);return 1;
        }catch(error){return this._error(error);}
      }
      if(opcode===0x30009){
        try{
          const entry=this.devices.get(aux>>>0);if(!entry)return 1;
          const p=u32(address+12),depth=p?g2w(p):0;
          const depthAttachment=depth?{id:u32(depth+36),width:u32(depth+20),height:u32(depth+24),format:u32(depth+28)}:null;
          const nextWindow=entry.kind==='webgl'?this.options.renderer?.()?.windows?.[u32(address+48)]:null;
          if(entry.kind==='webgl'&&!nextWindow)throw new Error('invalid Reset device window');
          this._dropPendingPresent(entry);
          return this._result(entry,this._submit(entry,Stream.OPCODES.RESOURCE_UPDATE,
            {kind:'reset',width:u32(address+32),height:u32(address+36),format:u32(address+40),depthAttachment}),
            ()=>{
              entry.queryResults?.clear();
              entry.colors?.clear();
              // Both executors drop every resident level on reset.
              entry.resident.clear(); entry.residentBytes=0;
              if(nextWindow&&entry.win!==nextWindow){
                if(entry.win?._gpuFrameLayer===entry.layer)entry.win._gpuFrameLayer=null;
                if(entry.win?._dxFrameLayer===entry.layer)entry.win._dxFrameLayer=null;
                entry.win=nextWindow;
              }
              return 1;
            });
        }catch(error){return this._error(error);}
      }
      if(opcode===0x30013){
        try{
          const entry=this.devices.get(aux>>>0);if(!entry)return 1;
          const kind=u32(address+12),levels=u32(address+32),base=g2w(u32(address+56));
          if(![3,5].includes(kind)||!levels||levels>12||u32(address+8)!==(aux>>>0)||base<256)
            throw new Error('invalid color texture retirement');
          const count=levels*(kind===5?6:1),ids=[];
          if(base+count*80>memory.byteLength)throw new Error('invalid color texture storage extent');
          for(let i=0;i<count;i++){
            const id=u32(base+i*80+36);
            if(entry.colors?.has(id))ids.push(id);
          }
          if(!ids.length)return 1;
          const submitted=this._submit(entry,Stream.OPCODES.RESOURCE_RELEASE,{kind:'color-set',ids});
          for(const id of ids)entry.colors.delete(id);
          if(submitted&&typeof submitted.then==='function')submitted.catch(error=>{this.lastError=error;});
          return 1;
        }catch(error){return this._error(error);}
      }
      if(opcode===0x30008||opcode===0x3000f){
        try{
          const entry=this.devices.get(aux>>>0);if(!entry)return 1;
          const color=opcode===0x3000f,id=u32(address+36);
          if(color&&!entry.colors?.has(id))return 1;
          const submitted=this._submit(entry,Stream.OPCODES.RESOURCE_RELEASE,{kind:color?'color':'depth',id});
          if(color)entry.colors.delete(id);
          if(submitted&&typeof submitted.then==='function')submitted.catch(error=>{this.lastError=error;});
          return 1;
        }catch(error){return this._error(error);}
      }
      if(opcode===0x30010||opcode===0x30011){
        try{
          const entry=this.devices.get(aux>>>0),id=u32(address+36);
          if(!entry||!entry.colors?.has(id))return 1;
          if(u32(address+12)!==0xd3d90006||u32(address+8)!==(aux>>>0))throw new Error('invalid color surface');
          const resource={id,width:u32(address+20),height:u32(address+24),format:u32(address+28)};
          const pitch=u32(address+48),size=u32(address+52),wa=g2w(u32(address+40));
          if(pitch<resource.width*(resource.format===23?2:4)||size!==pitch*resource.height||wa<256||wa+size>memory.byteLength)
            throw new Error('invalid canonical color range');
          if(opcode===0x30011)return this._result(entry,this._submit(entry,Stream.OPCODES.RESOURCE_UPDATE,
            {kind:'color',resource,pitch,pixels:new Uint8Array(memory,wa,size).slice()}));
          return this._result(entry,this._submit(entry,Stream.OPCODES.READBACK,{resource}),result=>{
            copyColorRows(new Uint8Array(memory,wa,size),pitch,result,resource.width,resource.height,resource.format);return 1;
          });
        }catch(error){return this._error(error);}
      }
      if(opcode===0x30016){
        try{
          const id=u32(address),width=u32(address+12),height=u32(address+16),bits=u32(address+8);
          const format=u32(g2w(u32(address+4))+25600)||22,pitch=format===23?(width*2+3)&~3:width*4,size=pitch*height;
          if(!width||!height||width>4096||height>4096||bits<256||bits+size>memory.byteLength)throw new Error('invalid DC backbuffer range');
          const entry=this.devices.get(id);if(!entry)return 1;
          if(entry.releasing)throw new Error('DC acquire on releasing device');
          return this._result(entry,this._submit(entry,Stream.OPCODES.READBACK,{}),result=>{
            copyColorRows(new Uint8Array(memory,bits,size),pitch,result,width,height,format);return 1;
          });
        }catch(error){return this._error(error);}
      }
      if(opcode===0x30012){
        try{
          const id=u32(address),width=u32(address+12),height=u32(address+16),p=aux>>>0;
          const format=u32(g2w(u32(address+4))+25600)||22;
          if(u32(p+12)!==0xd3d90006||u32(p+8)!==id||u32(p+20)!==width||u32(p+24)!==height||u32(p+28)!==format)
            throw new Error('invalid backbuffer readback destination');
          const pitch=u32(p+48),size=u32(p+52),wa=g2w(u32(p+40));
          if(pitch<width*(format===23?2:4)||size!==pitch*height||wa<256||wa+size>memory.byteLength)throw new Error('invalid readback destination extent');
          const target=new Uint8Array(memory,wa,size),entry=this.devices.get(id);
          if(!entry){
            const sourcePitch=format===23?(width*2+3)&~3:width*4;
            copyColorRows(target,pitch,{pixels:new Uint8Array(memory,u32(address+8),sourcePitch*height),width,height,pitch:sourcePitch,format},width,height,format);return 1;
          }
          return this._result(entry,this._submit(entry,Stream.OPCODES.READBACK,{}),result=>{
            copyColorRows(target,pitch,result,width,height,format);return 1;
          });
        }catch(error){return this._error(error);}
      }
      if (opcode === 0x30004) {
        try {
        const entry = this.devices.get(aux >>> 0);
        if (entry) {
          if (entry.releasing) throw new Error('D3D9 device release already pending');
          this._dropPendingPresent(entry);
          if (!entry.async && entry.queue.error && !entry.queue.inflight) entry.queue.reset();
          // A prior Present may have finished rendering but still be waiting
          // for its guest to consume/copy. Keep native teardown parked until
          // those continuations have run, so their target cannot be freed.
          const prior = [...this.requests.values()].filter(r => r.entry === entry).map(r => r.consumed);
          let released;
          if (entry.async && (entry.queue.error || entry.lost)) released = this._retireFailedWorker(entry);
          else {
            released = this._submit(entry, Stream.OPCODES.RESOURCE_RELEASE, { kind: 'device' });
            if (entry.async) released = released.catch(() => this._retireFailedWorker(entry));
          }
          entry.releasing = true;
          if (entry.async || prior.length) released = Promise.all([released, ...prior]);
          if(entry.sharedWorker)released=Promise.resolve(released).then(async()=>{
            if(entry.workerConsumer)await entry.workerConsumer.cancel(0,new Error('D3D9 device released'));
          });
          return this._result(entry, released, () => {
          if (entry.win && entry.win._gpuFrameLayer === entry.layer) entry.win._gpuFrameLayer = null;
          if (entry.win && entry.win._dxFrameLayer === entry.layer) entry.win._dxFrameLayer = null;
          this._releaseCanvas(entry.canvas);
          this._releasePresentation(entry);
          this.devices.delete(aux >>> 0);
          entry.dead = true;
          return 1;
          }, true);
        }
        return 1;
        } catch (error) { return this._error(error); }
      }
      let drawEntry = null;
      try {
        const id = u32(address), program = g2w(u32(address+4)), hwnd = u32(address+20);
        const targetFormat=u32(program+25600)||22;
        let width = u32(address+12), height = u32(address+16);
        let entry = this.devices.get(id);
        drawEntry = entry;
        if (entry?.releasing) throw new Error('D3D9 device is being released');
        if (!this.sharedWorker && this.asyncSoftware && this.workerDead) throw new Error('D3D9 software worker was lost');
        if (!entry && opcode !== 0x30001 && opcode !== 0x30003 && opcode !== 0x3000b && opcode !== 0x3000c && opcode !== 0x30014 && opcode !== 0x30015) return 0;
        if (!entry) {
          const renderer = this.options.renderer?.();
          const win = renderer && renderer.windows?.[hwnd];
          if (this.sharedWorker) {
            if(this.backend==='webgl'&&!win)throw new Error('D3D9 requires a GPU window');
            if(!width||!height||width>4096||height>4096)throw new Error('invalid render target size');
            if(this.backend==='webgl'&&renderer.getWindowCanvas)renderer.getWindowCanvas(hwnd);
            entry={kind:this.backend,async:true,sharedWorker:true,win:this.backend==='webgl'?win:null,
              layer:this.backend==='webgl'?{canvas:null,writeSeq:0,kind:'gpu'}:null};
          } else if (this.asyncSoftware) {
            entry = {kind:'software', async:true, win:null, layer:null};
          } else if (this.backend === 'software') {
            const Software = getSoftwareBackend();
            if (!Software) throw new Error('D3D9 software backend is unavailable');
            const device = new Software.Device({getExports:this.options.getExports,
              getMemory:this.options.getMemory, width, height,format:targetFormat});
            entry = {device, kind:'software', win:null, layer:null};
          } else {
          if (!win) throw new Error('D3D9 requires a GPU window');
          if (!width || !height || width > 4096 || height > 4096) throw new Error('invalid GPU target size');
          // The compositor requires the window's normal backing surface even
          // for a GPU-only client that never opens a GDI DC. Reuse its owner;
          // do not substitute the GPU context canvas for a window surface.
          if (renderer.getWindowCanvas) renderer.getWindowCanvas(hwnd);
          const canvas = this._createCanvas(width, height);
          if (!canvas) throw new Error('D3D9 requires a GPU window');
          const device = new Backend.Device(canvas);
          const layer = { canvas: device.gpu.getPresentationSurface(), backend: device.gpu, writeSeq: 0, kind: 'gpu' };
          entry = { device, layer, win, canvas, kind:'webgl' };
          }
          const generation = (this.deviceGenerations.get(id) || 0) + 1;
          this.deviceGenerations.set(id, generation);
          const execute=entry.async ? command => {
              const result = this._worker(entry).then(consumer => consumer.execute(command));
              const value = result.then(r=>r.value); value.catch(() => {});
              return { consumed:result.then(r=>r.consumed), completion:result.then(r=>r.completion), value };
            } : command => this._execute(entry, command);
          entry.queue = new Stream.CommandQueue({ deviceId: id, generation, capacityBytes: this._capacity(),
            consumer:{ordered:!!entry.async,execute:command=>this._consume(entry,command,execute)} });
          entry.resident = new Map(); entry.residentBytes = 0;
          this.devices.set(id, entry); drawEntry = entry;
          if (entry.async) this._submit(entry, Stream.OPCODES.RESOURCE_CREATE,
            {kind:'device',backend:this.backend,width,height,format:targetFormat,quadBudget:this.options.softwareQuadBudget}).catch(() => {});
          const color = opcode===0x30003?0:u32(program+1688);
          const initialized = this._submit(entry, Stream.OPCODES.CLEAR, {
            color: [((color>>>16)&255)/255,((color>>>8)&255)/255,(color&255)/255,(color>>>24)/255], flags: 3 });
          if (entry.async) initialized.catch(() => {});
        }
        if(opcode===0x3000b||opcode===0x3000c)return this._queryIssue(entry,aux>>>0,opcode===0x3000b);
        const { device, win, layer } = entry;
        const ensureColor=p=>{
          if(p<256||p+80>memory.byteLength||u32(p+12)!==0xd3d90006||u32(p+8)!==id||u32(p+56))
            throw new Error('invalid or locked D3D9 color storage');
          const resource={id:u32(p+36),width:u32(p+20),height:u32(p+24),format:u32(p+28)};
          if(!entry.colors)entry.colors=new Set();
          if(!entry.colors.has(resource.id)){
            const pitch=u32(p+48),size=u32(p+52),bits=g2w(u32(p+40));
            if(!resource.id||!resource.width||!resource.height||pitch<resource.width*(resource.format===23?2:4)||size!==pitch*resource.height||bits<256||bits+size>memory.byteLength)
              throw new Error('invalid canonical color storage extent');
            const created=this._submit(entry,Stream.OPCODES.RESOURCE_CREATE,{kind:'color',resource,
              pitch,pixels:new Uint8Array(memory,bits,size).slice()});
            if(created&&typeof created.then==='function')created.catch(error=>{this.lastError=String(error);});
            entry.colors.add(resource.id);
          }
          return resource;
        };
        if(opcode===0x30015){
          const pointer=u32(address+24),resource=pointer?ensureColor(g2w(pointer)):null,bits=u32(address+28),sourcePitch=u32(address+32);
          const target=resource??{width,height,format:targetFormat};
          const pixelBytes=target.format===23?2:4;
          const rect={x:u32(address+36),y:u32(address+44),width:u32(address+48),height:u32(address+52)};
          if(!rect.width||!rect.height||rect.x>target.width||rect.y>target.height||
            rect.width>target.width-rect.x||rect.height>target.height-rect.y||u32(address+56)!==target.format||
            sourcePitch<rect.width*pixelBytes||bits<256||bits+(rect.height-1)*sourcePitch+rect.width*pixelBytes>memory.byteLength)
            throw new Error('invalid UpdateSurface upload');
          const pitch=rect.width*pixelBytes,pixels=new Uint8Array(pitch*rect.height);
          for(let y=0;y<rect.height;y++)pixels.set(new Uint8Array(memory,bits+y*sourcePitch,pitch),y*pitch);
          return this._result(entry,this._submit(entry,Stream.OPCODES.RESOURCE_UPDATE,{kind:'color',resource,rect,pitch,pixels}));
        }
        if(opcode===0x30014){
          const pointer=u32(address+24),color=u32(address+28);
          const colorAttachment=pointer?ensureColor(g2w(pointer)):undefined;
          const rect=[u32(address+32),u32(address+36),u32(address+44),u32(address+48)];
          const w=colorAttachment?.width??width,h=colorAttachment?.height??height;
          if(rect[0]>=rect[2]||rect[1]>=rect[3]||rect[2]>w||rect[3]>h)throw new Error('invalid ColorFill rectangle');
          return this._issue(entry,Stream.OPCODES.CLEAR,{
            color:[((color>>>16)&255)/255,((color>>>8)&255)/255,(color&255)/255,(color>>>24)/255],
            flags:1,rects:[rect],depthAttachment:null,colorAttachment});
        }
        let colorAttachment;
        const colorPointer=u32(program+22020);
        if(colorPointer&&opcode!==0x30002){
          const p=g2w(colorPointer);
          colorAttachment=ensureColor(p);
          width=colorAttachment.width;height=colorAttachment.height;
        }
        const depthPointer=u32(program+21752);
        const depthAttachment=depthPointer?(()=>{
          const p=g2w(depthPointer);
          if(u32(p+12)!==0xd3d90005||u32(p+8)!==id)throw new Error('invalid D3D9 depth attachment identity');
          return {id:u32(p+36),width:u32(p+20),height:u32(p+24),format:u32(p+28)};
        })():null;
        const outputState=g2w(u32(address+40));
        const scissor=u32(outputState+256+174*4)?{
          enabled:true,
          left:u32(program+22016)?view.getInt32(program+22000,true):0,
          top:u32(program+22016)?view.getInt32(program+22004,true):0,
          right:u32(program+22016)?view.getInt32(program+22008,true):width,
          bottom:u32(program+22016)?view.getInt32(program+22012,true):height,
        }:undefined;
        if(opcode!==0x30002&&scissor&&(scissor.left<0||scissor.top<0||scissor.right<scissor.left||
          scissor.bottom<scissor.top||scissor.right>width||scissor.bottom>height))
          throw new Error('invalid D3D9 scissor rectangle');
        if (opcode === 0x30002) {
          // The software rasterizer publishes canonical guest-visible
          // back-buffer bytes at the explicit present boundary, never a
          // half-built frame; the WAT side then presents that DIB. The GL
          // backend presents its canvas and leaves the DIB alone: a guest
          // that wants those bytes asks through a readback.
          const pitch=targetFormat===23?(width*2+3)&~3:width*4;
          const raw=new Uint8Array(memory,u32(address+8),pitch*height);
          // Preserve padding, and keep the ordered/pipelined Present owner.
          const dest=targetFormat!==23?raw:{set(pixels){
            if(pixels.length!==width*height*4)throw new Error('invalid 565 presentation extent');
            for(let y=0;y<height;y++)for(let x=0;x<width;x++){
              const at=(y*width+x)*4,out=y*pitch+x*2;
              const word=(pixels[at+2]>>>3)<<11|(pixels[at+1]>>>2)<<5|(pixels[at]>>>3);
              raw[out]=word;raw[out+1]=word>>>8;
            }
          }};
          const completed = this._submit(entry, Stream.OPCODES.PRESENT, { width, height, interval:u32(program+21784) });
          // Only the Worker's frame completes later; the in-thread software
          // device (a page without cross-origin isolation) has finished it.
          if (entry.async && entry.kind==='software' && this._insideSyncSend()) return this._detachPresent(entry, completed, dest);
          if (entry.async && entry.kind==='software' && entry.presented) return this._pipelinePresent(entry, completed, dest);
          if(entry.async&&entry.kind==='webgl'&&this._insideSyncSend()){
            const generation=entry.queue.generation;
            completed.then(result=>{
              if(entry.queue.generation!==generation){result.bitmap?.close();return;}
              this._publishGPU(entry,result);
            }).catch(error=>{entry.deferredError=error;});
            return 1;
          }
          return this._result(entry, completed, completed => {
          if (completed.pixels) dest.set(completed.pixels);
          // Return to the existing WAT dx_present path after synchronizing the
          // native target. It already owns CPU presentation and CLI captures.
          if (entry.kind === 'software') { entry.presented = true; return 0; }
          // A device window may be a CHILD -- Pawn 3 points its windowed
          // device at a screen-sized STATIC child of its 360x399 main window.
          // repaint() composites a child's own canvas and frame layer only
          // when the child is marked as owning a surface (attachWindowSurface
          // sets that for canonical GDI surfaces), so a layer parked here was
          // never drawn by anyone and the client area stayed empty grey.
          return this._publishGPU(entry,completed);
          });
        }
        if (opcode === 0x30003) {
          const color = u32(address+48), z = view.getFloat32(address+52,true);
          const count=u32(address+56),ptr=u32(address+60),flags=u32(address+44);
          if(flags>7)throw new Error('invalid D3D9 clear flags');
          if((flags&4)&&depthAttachment?.format!==75)throw new Error('D3D9 stencil clear requires D24S8 attachment');
          if((flags&2)&&(!Number.isFinite(z)||z<0||z>1))throw new Error('invalid D3D9 clear depth');
          if((flags&2)&&!depthAttachment)throw new Error('D3D9 depth clear without attached surface');
          if(!!count!==!!ptr||count>65536)throw new Error('invalid D3D9 clear rectangle count/pointer');
          const vx=u32(program+21736)?u32(program+21728):0,vy=u32(program+21736)?u32(program+21732):0;
          const vw=u32(program+21736)||width,vh=u32(program+21736)?u32(program+21740):height;
          if(!vw||!vh||vx+vw>width||vy+vh>height)throw new Error('invalid D3D9 clear viewport');
          const clip=scissor?[Math.max(vx,scissor.left),Math.max(vy,scissor.top),
            Math.min(vx+vw,scissor.right),Math.min(vy+vh,scissor.bottom)]:[vx,vy,vx+vw,vy+vh];
          const rects=[];
          if(count){
            const p=g2w(ptr),size=count*16;
            if(ptr+size>0x100000000||p<256||p+size>memory.byteLength||g2w(ptr+size-1)!==p+size-1)
              throw new Error('invalid D3D9 clear rectangle range');
            for(let i=0;i<count;i++){
              const at=p+i*16,l=view.getInt32(at,true),t=view.getInt32(at+4,true),r=view.getInt32(at+8,true),b=view.getInt32(at+12,true);
              if(r<l||b<t)throw new Error('invalid D3D9 clear rectangle ordering');
              const clipped=[Math.max(l,clip[0]),Math.max(t,clip[1]),Math.min(r,clip[2]),Math.min(b,clip[3])];
              if(clipped[2]>clipped[0]&&clipped[3]>clipped[1])rects.push(clipped);
            }
          }else if(clip[2]>clip[0]&&clip[3]>clip[1])rects.push(clip);
          return this._issue(entry, Stream.OPCODES.CLEAR, {
            color: [((color>>>16)&255)/255,((color>>>8)&255)/255,(color&255)/255,(color>>>24)/255], flags,depth:z,stencil:u32(address+24),rects,depthAttachment,colorAttachment });
        }
        const declaration=u32(program+8), fvf = u32(program+12);
        const position=fvf&0x400e,texCount=(fvf>>>8)&15;
        if (!declaration && (![2,4,0x4002].includes(position) || texCount>6 || (fvf&0xb001)))
          throw new Error(`D3D9 FVF ${fvf.toString(16)} is not implemented`);
        const primitive = u32(address+24), primitiveCount = u32(address+28), stride = u32(address+36),
          table = u32(address+60);
        const count = Backend.primitiveVertices(primitive, primitiveCount);
        if ((!table && !stride) || stride>255) throw new Error('invalid D3D9 draw byte range');
        // Preflight the large allocations before copying/decoding guest bytes.
        // CommandQueue independently bounds the complete serialized descriptor,
        // including its object overhead, before publishing anything to WebGL.
        let snapshotBytes = 4096;
        const reserve = bytes => {
          if (!Number.isSafeInteger(bytes) || bytes < 0 || snapshotBytes + bytes > this._capacity())
            throw new Error('D3D9 draw snapshot exceeds command byte budget');
          snapshotBytes += bytes;
        };
        reserve(640); // four typed constant banks
        reserve(2560); // appended VS c96..c255, charged before snapshot allocation
        const scratch = this._drawScratch || drawScratch();
        this._drawScratch = null;
        const shader = offset => {
          if (!u32(program+offset)) return null;
          const ptr = g2w(u32(program+offset)), length = u32(ptr+16);
          if (!length || length%4 || length>262144) throw new Error('invalid shader resource');
          reserve(length * 32); // worst-case native 128-byte IR record per token
          const ex = this.options.getExports?.();
          if (ex?.d3d_shader_ir_compile) {
            if (!ShaderIR) throw new Error('D3D shader IR reader is unavailable');
            if (!this.shaderCompiler) this.shaderCompiler = new ShaderIR.Compiler({
              getExports:this.options.getExports,getMemory:this.options.getMemory });
            // Creation owns a validated serialized IR tail in the same native
            // allocation as GetFunction tokens. Draw never reparses tokens.
            return this.shaderCompiler.retained(ptr+24+length,length/4);
          }
          throw new Error('native shader IR validator unavailable');
        };
        const state = g2w(u32(address+40));
        const rs = id => u32(state+256+id*4);
        // The same render state read as the float its bits are (D3DRS_FOGSTART..).
        const rsf = id => view.getFloat32(state+256+id*4, true);
        let userClipPlanes;
        if(rs(152)){
          reserve(96);
          const planes=new Float32Array(24);
          new Uint8Array(planes.buffer).set(new Uint8Array(memory,program+25244,96));
          userClipPlanes={space:u32(program)?'clip':'world',mask:rs(152),planes};
        }
        // Which streams a draw reads is a property of its declaration, so the
        // elements are decoded before any vertex byte is copied.
        const elements=[];
        if(declaration) {
          const ptr=g2w(declaration),bytes=u32(ptr+16),seen=new Set();
          if(bytes<16 || bytes>136 || bytes%8)throw new Error('invalid vertex declaration length');
          for(let i=0;i<bytes/8-1;++i) {
            const p=ptr+24+i*8,stream=view.getUint16(p,true),offset=view.getUint16(p+2,true),
              type=view.getUint8(p+4),usage=view.getUint8(p+6),usageIndex=view.getUint8(p+7),
              key=`${usage}:${usageIndex}`;
            // type>16 is D3DDECLTYPE_UNUSED or garbage; 0..16 are the real
            // types, all of which lib/d3d9-software-backend.js's DECL_TYPES
            // decodes. 16 streams is what a D3D9 device exposes.
            if(stream>15 || type>16 || view.getUint8(p+5)!==0 || seen.has(key))
              throw new Error('unsupported/duplicate vertex declaration element');
            seen.add(key);
            elements.push({register:i,usage,usageIndex,type,offset,stream});
          }
        }
        // The per-stream bindings $d3d9_draw_buffer published at the end of the
        // descriptor: 16 records of {buffer, offset, stride, pointer}, where a
        // zero pointer means that stream cannot serve this draw. A user-pointer
        // draw (DrawPrimitiveUP) publishes no table and is stream 0 by
        // construction, which is why stream 0 always reads address+32/36.
        const indexPointer=u32(address+44), vertexPointer=u32(address+32);
        const binding=index=>{
          // Buffered draws publish all sixteen bindings, including stream 0.
          // Only Draw*UP has no table, and that API is stream-0-only by
          // construction. Do not otherwise make stream 0 special: a legal
          // declaration may source every attribute from another stream.
          if(!table) {
            if(index)throw new Error(`D3D9 stream ${index} has no binding in this draw`);
            return {pointer:vertexPointer,stride};
          }
          const at=g2w(table+index*16);
          return {pointer:u32(at+12),stride:u32(at+8)};
        };
        const used=elements.length?[...new Set(elements.map(e=>e.stream))].sort((a,b)=>a-b):[0];
        for(const stream of used) {
          const {pointer,stride:width}=binding(stream);
          if(!pointer || !width || width>255)
            throw new Error(`D3D9 stream ${stream} is not usable by this draw`);
        }
        // Guest bytes are translated once per 4KB guest page, not per element:
        // a translation is a call, and a view per vertex was an allocation per
        // vertex. Sparse guest pages need not be adjacent in wasm memory, so a
        // run that straddles two of them is copied from both.
        const bytes=new Uint8Array(memory);
        let pageGuest=-1,pageWasm=0;
        const copyGuest=(dst,p,length,at,message)=>{
          if(p+length>0x100000000)throw new Error(message);
          while(length>0){
            const base=p-p%4096,n=Math.min(length,base+4096-p);
            if(base!==pageGuest){
              pageWasm=g2w(base);
              if(pageWasm===0xf0){pageGuest=-1;throw new Error(message);}
              pageGuest=base;
            }
            const w=pageWasm+p-base;
            if(n>64)dst.set(bytes.subarray(w,w+n),at);
            else for(let k=0;k<n;++k)dst[at+k]=bytes[w+k];
            p+=n;at+=n;length-=n;
          }
        };
        let indices, vertexCount=count, firstVertex=0, gather=null;
        if(indexPointer) {
          const format=u32(address+48), min=u32(address+52), num=u32(address+56), end=min+num;
          if(![101,102].includes(format) || !num || end>0x100000000)
            throw new Error('invalid indexed vertex range');
          const indexBytes=format===101?2:4, start=g2w(indexPointer);
          if(start===0xf0 || start+count*indexBytes>memory.byteLength)
            throw new Error('invalid index memory range');
          // One copy of the index bytes, then a typed read of them: a DataView
          // read per index and a Uint16Array.from callback per index were the
          // hottest lines of a B&W2 draw on WebGL. Wasm memory is little-endian
          // and so is every platform a typed array runs on here.
          reserve(count * indexBytes);
          const raw=scratchBytes(scratch,'indexBytes',count*indexBytes);
          copyGuest(raw,indexPointer,count*indexBytes,0,'invalid index memory range');
          // INDEX32 needs no WebGL extension: expand the referenced vertices
          // without truncating indices. INDEX16 retains the indexed GPU path.
          if(format===102) {
            gather=new Uint32Array(raw.buffer,raw.byteOffset,count);
            for(let i=0;i<count;++i){const value=gather[i];
              if(value<min || value>=end)throw new Error('index outside declared vertex range');}
          } else {
            const values=new Uint16Array(raw.buffer,raw.byteOffset,count);
            for(let i=0;i<count;++i){const value=values[i];
              if(value<min || value>=end)throw new Error('index outside declared vertex range');
              values[i]=value-min;}
            vertexCount=num; firstVertex=min; indices=values;
          }
        }
        // One interleaved vertex buffer, however many streams it came from.
        // Interleaving here rather than teaching each backend about streams is
        // deliberate: a backend that reads one array at one stride cannot get
        // multi-stream subtly wrong, and every path above already copied.
        const slots=new Map();
        let packedStride=0;
        for(const stream of used){slots.set(stream,packedStride);packedStride+=binding(stream).stride;}
        const byteCount=vertexCount*packedStride;
        if(packedStride>255 || !Number.isSafeInteger(byteCount) || byteCount>0x10000000)
          throw new Error('invalid D3D9 draw byte range');
        reserve(byteCount);
        const vertices=scratchBytes(scratch,'vertexBytes',byteCount);
        const vertexError='vertex address overflow/unmapped';
        if(!gather&&used.length===1)copyGuest(vertices,binding(used[0]).pointer+firstVertex*packedStride,byteCount,0,vertexError);
        else for(const stream of used) {
          const {pointer,stride:width}=binding(stream),at=slots.get(stream);
          for(let i=0;i<vertexCount;++i)
            copyGuest(vertices,pointer+(gather?gather[i]:firstVertex+i)*width,width,i*packedStride+at,vertexError);
        }
        const attributes=[],convertedColors=new Set();
        const convertColor=offset=>{
          if(offset+4>packedStride)throw new Error('color outside vertex stride');
          if(convertedColors.has(offset))return;
          convertedColors.add(offset);
          for(let i=0;i<vertexCount;++i){const p=i*packedStride+offset,b=vertices[p];vertices[p]=vertices[p+2];vertices[p+2]=b;}
        };
        if(elements.length) {
          for(const element of elements) {
            // An element's offset is within ITS stream; the interleaved buffer
            // puts that stream's bytes at slots.get(stream). The element's own
            // size is checked against the packed stride by the backend.
            if(element.offset>=binding(element.stream).stride)
              throw new Error('vertex element outside its stream stride');
            const offset=slots.get(element.stream)+element.offset;
            attributes.push({register:element.register,usage:element.usage,
              usageIndex:element.usageIndex,type:element.type,offset});
            if(element.type===4)convertColor(offset);
          }
        } else {
        attributes.push({register:0,usage:position===4?9:0,usageIndex:0,type:position===2?2:3,offset:0});
        let offset=position===2?12:16;
        if(fvf&16){attributes.push({register:3,usage:3,usageIndex:0,type:2,offset});offset+=12;}
        if(fvf&32){attributes.push({register:4,usage:4,usageIndex:0,type:0,offset});offset+=4;}
        for(const [bit,register,index] of [[64,5,0],[128,6,1]]) if(fvf&bit) {
          attributes.push({register,usage:10,usageIndex:index,type:4,offset});
          convertColor(offset);
          offset+=4;
        }
        for(let i=0;i<texCount;++i){const size=[2,3,4,1][(fvf>>>(16+i*2))&3];
          attributes.push({register:7+i,usage:5,usageIndex:i,type:size-1,offset});offset+=size*4;}
        if(offset>packedStride)throw new Error('FVF exceeds vertex stride');
        }
        const textures=[],plan={uses:new Set(),added:[],addedBytes:0,releases:[]};
        // Bumped by every texture this device creates: a mip record address
        // can only name a new texture after it moves (see sameFingerprint).
        const textureGeneration=u32(program+25596);
        for(let stage=0;stage<6;++stage){
          // Stages4/5 are appended; 1716 and2064 belong to other objects.
          const ptr=u32(program+(stage<4?1700+stage*4:21792+(stage-4)*4));if(!ptr)continue;
          const t=g2w(ptr),kind=u32(t+12),levelCount=u32(t+32),format=u32(t+36),lod=u32(t+48),faces=[];
          if(![3,5].includes(kind) || levelCount>12 || lod>=levelCount || ![20,21,22,23,24,25,26,50,51,62,81,Texture.DXT1,Texture.DXT3,Texture.DXT5].includes(format))throw new Error(`invalid texture resource stage=${stage} ptr=0x${ptr.toString(16)} kind=${kind} levels=${levelCount} lod=${lod} format=${format}`);
          for(let face=0;face<(kind===5?6:1);++face){
          const levels=[];
          for(let level=lod;level<levelCount;++level){const m=t+64+(face*levelCount+level)*32,w=u32(m),h=u32(m+4);
            if(u32(m+20))throw new Error('cannot draw from locked texture');
            if(u32(t+56)){
              const p=g2w(u32(t+56))+(face*levelCount+level)*80;
              const resource=ensureColor(p);
              if(resource.width!==w||resource.height!==h||resource.format!==format||u32(p+72)!==ptr||u32(p+76)!==face*levelCount+level)
                throw new Error('invalid texture color alias');
              if(resource.id===colorAttachment?.id)throw new Error('D3D9 render-target texture feedback is unsupported');
              reserve(128);
              levels.push({width:w,height:h,resource});
              continue;
            }
            const bits=u32(m+16),byteLength=u32(m+12),seq=u32(m+28);
            const src=new Uint8Array(memory,g2w(bits),byteLength);
            const snapshots=this._textureSnapshots;
            const cached=snapshots.get(m);
            if(cached&&cached.seq===seq&&cached.bits===bits&&cached.byteLength===byteLength
              &&cached.format===format&&cached.width===w&&cached.height===h
              &&(cached.device===entry&&cached.generation===textureGeneration
                ||sameFingerprint(cached.mark,src))){
              cached.device=entry;cached.generation=textureGeneration;
              // Touch for recency: the Map's insertion order is the eviction
              // order, so a level in use every frame must not age out behind
              // one bound once during level load.
              snapshots.delete(m);snapshots.set(m,cached);
              levels.push(this._residentLevel(entry,cached,plan,reserve));
              continue;
            }
            reserve(w * h * 4);
            let pixels;
            if(format===Texture.DXT1||format===Texture.DXT3||format===Texture.DXT5)pixels=Texture.decode(src,w,h,format);
            else if(format===20){
              // R8G8B8: three bytes per texel, stored blue first like every
              // other D3D9 xRGB layout, with no alpha channel to read.
              if(src.length!==w*h*3)throw new Error('invalid texture byte length');
              pixels=new Uint8Array(w*h*4);
              for(let i=0,o=0;i<src.length;i+=3,o+=4){
                pixels[o]=src[i+2];pixels[o+1]=src[i+1];pixels[o+2]=src[i];pixels[o+3]=255;
              }
            }
            else if(format===23){
              // R5G6B5: each channel is replicated into its high bits so that
              // an all-ones field reaches 255 rather than 248.
              if(src.length!==w*h*2)throw new Error('invalid texture byte length');
              pixels=new Uint8Array(w*h*4);
              for(let i=0,o=0;i<src.length;i+=2,o+=4){
                const v=src[i]|(src[i+1]<<8),r=(v>>>11)&31,g=(v>>>5)&63,b=v&31;
                pixels[o]=(r<<3)|(r>>>2);pixels[o+1]=(g<<2)|(g>>>4);pixels[o+2]=(b<<3)|(b>>>2);
                pixels[o+3]=255;
              }
            }
            else if(format===24||format===25){
              // X1R5G5B5 / A1R5G5B5: five bits a channel, replicated into the
              // high bits; the top bit is alpha for A1 and ignored (opaque)
              // for X1. LithTech (Die Hard: Nakatomi Plaza) keys its 16-bit
              // textures with A1R5G5B5.
              if(src.length!==w*h*2)throw new Error('invalid texture byte length');
              pixels=new Uint8Array(w*h*4);
              for(let i=0,o=0;i<src.length;i+=2,o+=4){
                const v=src[i]|(src[i+1]<<8),r=(v>>>10)&31,g=(v>>>5)&31,b=v&31;
                pixels[o]=(r<<3)|(r>>>2);pixels[o+1]=(g<<3)|(g>>>2);pixels[o+2]=(b<<3)|(b>>>2);
                pixels[o+3]=format===25?((v>>>15)?255:0):255;
              }
            }
            else if(format===26){
              // A4R4G4B4: each nibble times 17 spans 0..255 exactly. The create
              // gate ($d3d9_texture_format_supported) admits it, so it has to
              // be sampled here too -- B&W2 and Morrowind's main menu both bind one.
              if(src.length!==w*h*2)throw new Error('invalid texture byte length');
              pixels=new Uint8Array(w*h*4);
              for(let i=0,o=0;i<src.length;i+=2,o+=4){
                const v=src[i]|(src[i+1]<<8);
                pixels[o]=((v>>>8)&15)*17;pixels[o+1]=((v>>>4)&15)*17;pixels[o+2]=(v&15)*17;
                pixels[o+3]=(v>>>12)*17;
              }
            }
            else if(format===50||format===81){
              // L8 and L16 carry luminance only. A sampler reads it on all
              // three colour channels with alpha opaque; L16 keeps its high
              // byte, which is what an 8-bit-per-channel sampler can show.
              const texel=format===50?1:2;
              if(src.length!==w*h*texel)throw new Error('invalid texture byte length');
              pixels=new Uint8Array(w*h*4);
              for(let i=0,o=0;i<src.length;i+=texel,o+=4){
                pixels[o]=pixels[o+1]=pixels[o+2]=src[i+texel-1];pixels[o+3]=255;
              }
            }
            else if(format===51){
              // A8L8: two bytes per texel, luminance low, alpha high. A sampler
              // reads luminance on all three colour channels.
              if(src.length!==w*h*2)throw new Error('invalid texture byte length');
              pixels=new Uint8Array(w*h*4);
              for(let i=0,o=0;i<src.length;i+=2,o+=4){
                pixels[o]=pixels[o+1]=pixels[o+2]=src[i];pixels[o+3]=src[i+1];
              }
            }else{
              if(src.length!==w*h*4)throw new Error('invalid texture byte length');
              pixels=new Uint8Array(src.length);
              if(format===62)pixels.set(src); // retain signed U/V and unsigned L bytes
              else for(let i=0;i<src.length;i+=4){pixels[i]=src[i+2];pixels[i+1]=src[i+1];pixels[i+2]=src[i];pixels[i+3]=format===22?255:src[i+3];}
            }
            const kept=this._rememberTexture(m,{seq,bits,byteLength,format,width:w,height:h,
              pixels,mark:fingerprint(src),device:entry,generation:textureGeneration});
            levels.push(kept?this._residentLevel(entry,kept,plan,null):{width:w,height:h,pixels});
          }
          faces.push({...levels[0],levels});
          }
          const s=program+(stage<4?1808+stage*64:21800+(stage-4)*64);
          const lodBias=new DataView(memory).getFloat32(s+32,true);
          if(!Number.isFinite(lodBias))throw new Error(`nonfinite sampler LOD bias for stage ${stage}`);
          textures[stage]={...faces[0],originalWidth:u32(t+24),originalHeight:u32(t+28),baseLOD:lod,
            ...(format===62?{format}:{}),...(kind===5?{faces}:{}),sampler:{addressU:u32(s+4),addressV:u32(s+8),
            borderColor:u32(s+16),mag:u32(s+20),min:u32(s+24),mip:u32(s+28),lodBias,maxMipLevel:u32(s+36)}};
        }
        this._planResidency(entry,plan);
        // Real TSS defaults/state, copied now; asynchronous consumers must not
        // retain a view into mutable guest device state. Values are float bits.
        // A plain loop into a preallocated array: Float32Array.from with a map
        // callback was ~1% of B&W2's main thread on WebGL, once per draw.
        const bumpStates=new Array(6);
        for(let stage=0;stage<6;stage++){
          const base=program+20664+stage*132,values=new Float32Array(6);
          for(let k=0;k<6;k++){
            const value=view.getFloat32(base+BUMP_STATE_IDS[k]*4,true);
            if(!Number.isFinite(value))throw new Error(`nonfinite bump metadata for stage ${stage}`);
            values[k]=value;
          }
          bumpStates[stage]=values;
        }
        let lightingState;
        if(!u32(program)&&rs(137)){
          const floats=(p,n)=>new Float32Array(memory,p,n).slice();
          const m=program+21928,lights=[],seen=new Set();
          let node=u32(program+21996);
          while(node){
            if(seen.has(node))throw new Error('cyclic native light list');
            seen.add(node);
            const p=g2w(node);
            if(p===0xf0||p+120>memory.byteLength)throw new Error('invalid native light extent');
            if(u32(p+12)){
              reserve(104);
              const l=p+16;
              lights.push({index:u32(p+4),type:u32(l),diffuse:floats(l+4,4),specular:floats(l+20,4),
                ambient:floats(l+36,4),position:floats(l+52,3),direction:floats(l+64,3),
                range:view.getFloat32(l+76,true),falloff:view.getFloat32(l+80,true),
                attenuation0:view.getFloat32(l+84,true),attenuation1:view.getFloat32(l+88,true),
                attenuation2:view.getFloat32(l+92,true),theta:view.getFloat32(l+96,true),phi:view.getFloat32(l+100,true)});
            }
            node=u32(p);
          }
          reserve(68);
          lightingState={material:{diffuse:floats(m,4),ambient:floats(m+16,4),specular:floats(m+32,4),
            emissive:floats(m+48,4),power:view.getFloat32(m+64,true)},lights,
            ambientColor:rs(139),colorVertex:rs(141),diffuseMaterialSource:rs(145),
            specularMaterialSource:rs(146),ambientMaterialSource:rs(147),emissiveMaterialSource:rs(148)};
        }
        const fixedFunction = !u32(program) || !u32(program+4) ? {
          ...lightingState,
          lighting:rs(137),fog:rs(28),specular:rs(29),alphaTest:rs(15),alphaFunc:rs(25),
          alphaRef:rs(24),textureFactor:rs(60),normalizeNormals:rs(143),localViewer:rs(142),
          fogColor:rs(34),fogTableMode:rs(35),fogVertexMode:rs(140),rangeFog:rs(48),
          fogStart:rsf(36),
          fogEnd:rsf(37),
          fogDensity:rsf(38),
          view:new Float32Array(memory,program+2068,16).slice(),
          projection:new Float32Array(memory,program+2068+64,16).slice(),
          world:new Float32Array(memory,program+2068+10*64,16).slice(),
          stages:[0,1,2,3,4,5].map(stage=>{
            const t=program+20664+stage*132;
            return {colorOp:u32(t+4),colorArg1:u32(t+8),colorArg2:u32(t+12),
              alphaOp:u32(t+16),alphaArg1:u32(t+20),alphaArg2:u32(t+24),
              colorArg0:u32(t+104),alphaArg0:u32(t+108),
              transform:new Float32Array(memory,program+2068+(stage+2)*64,16).slice(),
              texCoordIndex:u32(t+44),transformFlags:u32(t+96),resultArg:u32(t+112),constant:u32(t+128)};
          })
        } : undefined;
        const fogState={enabled:rs(28),color:rs(34),tableMode:rs(35),depthMode:0,
          start:rsf(36),
          end:rsf(37),
          density:rsf(38)};
        // Copy bits rather than individual JS Numbers (preserve NaN payloads too).
        // Every bank below is overwritten whole, so a reused scratch set
        // carries nothing over from the previous draw.
        const vertexConstants = scratch.vertexConstants;
        const vertexConstantBytes = new Uint8Array(vertexConstants.buffer);
        vertexConstantBytes.set(new Uint8Array(memory,program+16,1536));
        vertexConstantBytes.set(new Uint8Array(memory,program+22684,2560),1536);
        scratch.pixelConstants.set(new Float32Array(memory,program+1552,32));
        scratch.vertexIntegerConstants.set(new Int32Array(memory,program+22044,64));
        scratch.vertexBooleanConstants.set(new Uint32Array(memory,program+22300,16));
        scratch.pixelIntegerConstants.set(new Int32Array(memory,program+22364,64));
        scratch.pixelBooleanConstants.set(new Uint32Array(memory,program+22620,16));
        const issued = this._issue(entry, Stream.OPCODES.DRAW, { primitive, primitiveCount, stride:packedStride, fixedFunction,fogState,
          ...(plan.releases.length?{textureReleases:plan.releases}:{}),
          viewport: u32(program+21736) ? {
            x:u32(program+21728),y:u32(program+21732),width:u32(program+21736),height:u32(program+21740),
            minZ:new Float32Array(memory,program+21744,1)[0],maxZ:new Float32Array(memory,program+21748,1)[0]
          } : undefined,
          vertices, indices, attributes, textures, bumpStates,depthAttachment,scissor,colorAttachment,userClipPlanes,
          vertexShader: shader(0), pixelShader: shader(4),
          vertexConstants,
          pixelConstants: scratch.pixelConstants,
          vertexIntegerConstants: scratch.vertexIntegerConstants,
          vertexBooleanConstants: scratch.vertexBooleanConstants,
          pixelIntegerConstants: scratch.pixelIntegerConstants,
          pixelBooleanConstants: scratch.pixelBooleanConstants,
          state: { zenable: !!rs(7), zwrite: !!rs(14), zfunc: rs(23), blend: !!rs(27),
            srcblend: rs(19), dstblend: rs(20), blendop:rs(171),separateAlpha:!!rs(206),
            srcblendalpha:rs(207),dstblendalpha:rs(208),blendopalpha:rs(209),blendFactor:rs(193),
            colorWriteMask:rs(168),cull: rs(22),alphaTest:!!rs(15),alphaFunc:rs(25),alphaRef:rs(24),
            fillMode:rs(8),lastPixel:!!rs(16),antialiasedLine:!!rs(176),
            pointSize:view.getFloat32(state+256+154*4,true),pointSizeMin:view.getFloat32(state+256+155*4,true),
            pointSizeMax:view.getFloat32(state+256+166*4,true),pointSprite:!!rs(156),pointScale:!!rs(157),
            pointScaleA:view.getFloat32(state+256+158*4,true),pointScaleB:view.getFloat32(state+256+159*4,true),pointScaleC:view.getFloat32(state+256+160*4,true),
            stencilEnable:!!rs(52),stencilFail:rs(53),stencilZFail:rs(54),stencilPass:rs(55),stencilFunc:rs(56),
            stencilRef:rs(57),stencilMask:rs(58),stencilWriteMask:rs(59),twoSidedStencil:!!rs(185),
            ccwStencilFail:rs(186),ccwStencilZFail:rs(187),ccwStencilPass:rs(188),ccwStencilFunc:rs(189) } });
        this._commitResidency(entry,plan);
        // A pending token (-2 and below) means the queue may still hold this
        // payload; anything else means the backend is done with it.
        if (issued >= -1) this._drawScratch = scratch;
        return issued;
      } catch (error) {
        this._forgetResidency(drawEntry);
        this.lastError = error;
        if (this.options.onError) this.options.onError(error);
        return -1;
      }
    }
  }
  return { Bridge };
});
