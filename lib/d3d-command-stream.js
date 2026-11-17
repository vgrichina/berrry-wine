// Ordered Direct3D immediate-mode draw transport for the experimental render
// Worker. The producer is the guest-main Worker; the consumer owns a second
// Wasm instance over the same shared WebAssembly.Memory.
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.D3DCommandStream = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const DRAW_OPCODE = 0x20000;
  const FENCE_OPCODE = 0x20001;
  // Asked before WAT expands an indexed draw into the non-indexed vertices
  // this transport carries, so the expansion is skipped when nothing is attached.
  const READY_OPCODE = 0x20002;
  // A Flip queued behind the frame's draws: a header-only record (kind 1 at
  // +28) naming the front and back DX_OBJECTS entries whose DIBs to swap.
  const FLIP_OPCODE = 0x20003;
  const RECORD_FLIP = 1;
  // A software-OpenGL draw (src/09a8g-gl-raster.wat): the descriptor names a
  // state snapshot and a packed draw record, both as wasm addresses. The
  // record (kind 2 at +28) carries the snapshot's and the draw's byte counts
  // at +4 and +8, then both payloads back to back.
  const GL_DRAW_OPCODE = 0x20005;
  const RECORD_GL = 2;
  // A glTexSubImage2D issued while draws are in flight, already converted to
  // ARGB: kind 3, the surface entry and x, y, w, h at +4..+20, the texel byte
  // count at +24, then the texels. The Worker copies them into the texture
  // after the draws queued ahead of it, which still sample the old ones.
  const GL_TEX_OPCODE = 0x20006;
  const RECORD_GL_TEX = 3;
  // D3DIM's GPU opcodes (0x20004 clear, 0x20007 lazy publish, 0x2000A
  // present) are the WAT producer's now (src/09abg-d3dim-gps.wat, GPU stream
  // v2); this software transport never sees them.
  const STATE_BYTES = 4096;
  const HEADER_BYTES = 32;
  const DEFAULT_BYTES = 2 * 1024 * 1024;
  const DEFAULT_BUFFERS = 3;
  const CTRL = {
    READY: 0, COMPLETED: 1, ERROR: 2, SUBMITTED: 3,
    BATCHES: 4, COMMANDS: 5, REPLAY_US: 6,
    GL_TRIANGLES: 8, GL_CLIPPED: 9, GL_CULLED: 10, RESULT: 11,
  };
  const align4 = value => (value + 3) & ~3;
  const nowMs = () => (typeof performance !== 'undefined' && performance.now)
    ? performance.now() : Date.now();
  const versionedWorkerUrl = (source, version) => {
    const separator = source.includes('?') ? '&' : '?';
    return source + separator + 'v=' + encodeURIComponent(version || 'dev');
  };

  class Encoder {
    constructor(options) {
      options = options || {};
      this.memory = options.memory;
      this.getCommandWriterHandoff = options.getCommandWriterHandoff;
      this.module = options.module;
      this.sigs = options.sigs || {};
      this.explicitFence = !!options.explicitFence;
      this.strictReady = !!options.strictReady;
      this.readyTimeoutMs = options.readyTimeoutMs || 30000;
      this.guestToWasm = options.guestToWasm;
      this.getImageBase = options.getImageBase;
      this.capacity = Math.max(STATE_BYTES + HEADER_BYTES + 32,
        options.capacity || DEFAULT_BYTES);
      this.controlBuffer = new SharedArrayBuffer(64);
      this.control = new Int32Array(this.controlBuffer);
      this.buffers = Array.from({ length: options.bufferCount || DEFAULT_BUFFERS }, () => {
        const buffer = new SharedArrayBuffer(this.capacity);
        return {
          buffer, view: new DataView(buffer), bytes: new Uint8Array(buffer),
          used: 0, commands: 0, seq: 0,
        };
      });
      // Resolve at construction: the page loads RenderWorker after this module,
      // while guest Workers import it before creating an encoder.
      const packetApi = typeof module !== 'undefined' && module.exports
        ? require('./render-worker') : root && root.RenderWorker;
      if (!packetApi || !packetApi.SharedPacketPool) throw new Error('SharedPacketPool unavailable');
      this._packetPool = new packetApi.SharedPacketPool();
      this._submissions = new packetApi.SubmissionQueue(this.buffers.length);
      for (const item of this.buffers) {
        this._packetPool.register(item, item.buffer, [0], this.capacity);
        item.lease = null;
      }
      this._memoryBuffer = null;
      this._memoryView = null;
      this._memoryBytes = null;
      this.current = 0;
      this.lastSubmitted = 0;
      this.stats = {
        queued: 0, submissions: 0, fences: 0, waits: 0, fallbacks: 0,
        bytes: 0, waitMs: 0, maxBatchBytes: 0,
        submitIdle: 0, submitThreshold: 0, submitCapacity: 0, submitFlip: 0,
        submitFence: 0, submitPublication: 0, submitCall: 0, submitOther: 0,
        singleCommandBatches: 0,
      };
      this.worker = options.workerFactory
        ? options.workerFactory()
        : new Worker(options.workerUrl || versionedWorkerUrl(
          'd3d-render-worker.js', options.sourceVersion || (root && root.WINE_SOURCE_VERSION)));
      this.worker.onerror = () => {
        Atomics.store(this.control, CTRL.ERROR, 1);
        Atomics.notify(this.control, CTRL.READY);
        Atomics.notify(this.control, CTRL.COMPLETED);
      };
      this.worker.onmessage = event => {
        const message = event && event.data ? event.data : event;
        if (message && message.t === 'error') {
          Atomics.store(this.control, CTRL.ERROR, 1);
          Atomics.notify(this.control, CTRL.READY);
          Atomics.notify(this.control, CTRL.COMPLETED);
        }
      };
      this.worker.postMessage({
        t: 'init', module: this.module, memory: this.memory, sigs: this.sigs,
        control: this.controlBuffer, buffers: this.buffers.map(item => item.buffer),
      });
    }

    ready() {
      if (this.strictReady) {
        const deadline = nowMs() + this.readyTimeoutMs;
        while (Atomics.load(this.control, CTRL.READY) !== 1) {
          this._checkError();
          const remaining = deadline - nowMs();
          if (remaining <= 0) throw new Error('Shared render worker readiness timed out');
          Atomics.wait(this.control, CTRL.READY, 0, Math.min(remaining, 100));
        }
        this._checkError();
      }
      return Atomics.load(this.control, CTRL.READY) === 1
        && Atomics.load(this.control, CTRL.ERROR) === 0;
    }

    _checkError() {
      if (this.strictReady && Atomics.load(this.control, CTRL.ERROR))
        throw new Error('Shared render worker failed');
    }

    _refreshMemoryViews() {
      const buffer = this.memory.buffer;
      if (buffer !== this._memoryBuffer) {
        this._memoryBuffer = buffer;
        this._memoryView = new DataView(buffer);
        this._memoryBytes = new Uint8Array(buffer);
      }
      return buffer;
    }

    _waitFor(seq) {
      seq >>>= 0;
      const started = nowMs();
      let waited = false;
      // This stack is quiescent: only transport control is accessed until the
      // finally restores the command's writer, before returning to native code.
      // Do not park generic RPC waits or a ticket belonging to another command.
      const handoff = this.getCommandWriterHandoff?.();
      let parked = false;
      try {
      while ((Atomics.load(this.control, CTRL.COMPLETED) >>> 0) < seq) {
        this._checkError();
        if (Atomics.load(this.control, CTRL.ERROR)) return false;
        if (handoff && !parked) { handoff.park(); parked = true; }
        const seen = Atomics.load(this.control, CTRL.COMPLETED);
        this.stats.waits++;
        waited = true;
        Atomics.wait(this.control, CTRL.COMPLETED, seen, 1000);
      }
      if (waited) this.stats.waitMs += nowMs() - started;
      this._checkError();
      return !Atomics.load(this.control, CTRL.ERROR);
      } finally {
        if (parked) handoff.resume();
      }
    }

    _acquire() {
      const item = this.buffers[this.current];
      if (item.seq && (Atomics.load(this.control, CTRL.COMPLETED) >>> 0) < item.seq) {
        if (!this._waitFor(item.seq)) return null;
      }
      // COMPLETED here acknowledges replay consumption, not GPU completion.
      // Failure without that acknowledgement must retain the reader's lease.
      if (item.lease) {
        this._packetPool.release(item.lease);
        this._submissions.complete(item.ticket);
        item.ticket = null;
        item.lease = null;
      }
      item.seq = 0;
      item.used = 0;
      item.commands = 0;
      return item;
    }

    _drawSubmitReason(item) {
      if (item.used >= this.capacity * 3 / 4) return 'Threshold';
      if ((Atomics.load(this.control, CTRL.COMPLETED) >>> 0) >= this.lastSubmitted) return 'Idle';
      return null;
    }

    _submit(reason = 'Other') {
      const item = this.buffers[this.current];
      // A rotated-to slot keeps its old bytes until _acquire resets it. Its
      // non-zero sequence means those bytes were already published; an idle
      // fence must wait for lastSubmitted, never replay this stale batch.
      if (item.seq) return this.lastSubmitted;
      if (!item.used) return this.lastSubmitted;
      item.ticket = this._submissions.reserve();
      try { item.lease = this._packetPool.claim(item, 0, item.used); }
      catch (error) { this._submissions.complete(item.ticket); item.ticket = null; throw error; }
      const seq = (Atomics.add(this.control, CTRL.SUBMITTED, 1) + 1) >>> 0;
      item.seq = seq;
      this.lastSubmitted = seq;
      this.stats.submissions++;
      const key = 'submit' + reason;
      this.stats[key] = (this.stats[key] || 0) + 1;
      if (item.commands === 1) this.stats.singleCommandBatches = (this.stats.singleCommandBatches || 0) + 1;
      if (item.used > this.stats.maxBatchBytes) this.stats.maxBatchBytes = item.used;
      try { this.worker.postMessage({
        t: 'batch', index: this.current, bytes: item.used,
        commands: item.commands, seq,
        imageBase: this.getImageBase() >>> 0,
      }); } catch (error) { this._submissions.fail(error); throw error; }
      this.current = (this.current + 1) % this.buffers.length;
      return seq;
    }

    enqueue(descriptorWa) {
      if (!this.ready()) { this.stats.fallbacks++; return 0; }
      const memory = this._refreshMemoryViews();
      descriptorWa >>>= 0;
      if (descriptorWa + 24 > memory.byteLength) { this.stats.fallbacks++; return 0; }
      const descriptor = this._memoryView;
      const thisGuest = descriptor.getUint32(descriptorWa, true);
      const primitive = descriptor.getUint32(descriptorWa + 4, true);
      const vertexType = descriptor.getUint32(descriptorWa + 8, true);
      const verticesGuest = descriptor.getUint32(descriptorWa + 12, true);
      const count = descriptor.getUint32(descriptorWa + 16, true);
      const stateGuest = descriptor.getUint32(descriptorWa + 20, true);
      const vertexBytes = Number(count) * (vertexType >= 5 ? 40 : 32);
      const recordBytes = align4(HEADER_BYTES + STATE_BYTES + vertexBytes);
      if (!thisGuest || !verticesGuest || !stateGuest || !count || vertexType < 1
          || vertexType > 6 || !Number.isSafeInteger(vertexBytes)
          || vertexBytes > 0x400000 || recordBytes > this.capacity) {
        this.stats.fallbacks++;
        return 0;
      }

      let item = this.buffers[this.current];
      if (item.used + recordBytes > this.capacity) {
        this._submit('Capacity');
        item = this._acquire();
        if (!item) { this.stats.fallbacks++; return 0; }
      } else if (item.seq) {
        item = this._acquire();
        if (!item) { this.stats.fallbacks++; return 0; }
      }

      const stateWa = this.guestToWasm(stateGuest) >>> 0;
      const verticesWa = this.guestToWasm(verticesGuest) >>> 0;
      if (stateWa + STATE_BYTES > memory.byteLength || verticesWa + vertexBytes > memory.byteLength) {
        this.stats.fallbacks++;
        return 0;
      }
      // Internal supplied-projection TLs retain raw UV. Capture TEXTURE0 now;
      // the live heap block may change before the queued draw is replayed.
      const textureMatrixWa = vertexType >= 4
        ? this.guestToWasm(descriptor.getUint32(stateWa + 4024, true)) >>> 0 : 0;
      if (vertexType >= 4 && (!textureMatrixWa || textureMatrixWa + 516 > memory.byteLength)) {
        this.stats.fallbacks++;
        return 0;
      }
      const start = item.used;
      const view = item.view;
      view.setUint32(start, recordBytes, true);
      view.setUint32(start + 4, thisGuest, true);
      view.setUint32(start + 8, primitive, true);
      view.setUint32(start + 12, vertexType, true);
      view.setUint32(start + 16, count, true);
      view.setUint32(start + 20, STATE_BYTES, true);
      view.setUint32(start + 24, vertexBytes, true);
      view.setUint32(start + 28, 0, true);
      const bytes = item.bytes;
      bytes.set(this._memoryBytes.subarray(stateWa, stateWa + STATE_BYTES), start + HEADER_BYTES);
      if (vertexType >= 4) {
        const captured = start + HEADER_BYTES + 3136; // unused WVP scratch in TL replay
        bytes.set(this._memoryBytes.subarray(textureMatrixWa, textureMatrixWa + 64), captured);
        // Match d3dim_supplied_matrix: normalize COUNT2/3/4's divisor to z.
        // Capture the selected column now, before the live flags/matrix change.
        const column = ((descriptor.getUint32(textureMatrixWa + 512, true) & 255) - 1) * 4;
        if (vertexType !== 6 && (column === 4 || column === 12))
          for (let row = 0; row < 64; row += 16)
            view.setUint32(captured + row + 8, descriptor.getUint32(textureMatrixWa + row + column, true), true);
      }
      bytes.set(this._memoryBytes.subarray(verticesWa, verticesWa + vertexBytes),
        start + HEADER_BYTES + STATE_BYTES);
      item.used += recordBytes;
      item.commands++;
      this.stats.queued++;
      this.stats.bytes += STATE_BYTES + vertexBytes;
      // Start the consumer before the frame fence rather than accumulating a
      // whole frame and serializing simulation after rasterization. A fill
      // threshold alone never fires on a game drawing ~150 small primitives a
      // frame (Motocross Madness), leaving the whole frame to replay while the
      // fence waits; so also hand over whatever is queued the moment the
      // consumer has caught up. Draws arriving while it works accumulate into
      // the next batch, which bounds messages by the consumer's own pace.
      const reason = this._drawSubmitReason(item);
      if (reason) this._submit(reason);
      return 1;
    }

    // Queue the flip-chain swap after every draw already queued, and hand the
    // batch over now: the frame is complete, so there is nothing to wait for.
    enqueueFlip(descriptorWa, descriptorBytes = 0) {
      if (!this.ready()) return 0;
      const memory = this._refreshMemoryViews();
      descriptorWa >>>= 0;
      if (descriptorWa + 8 > memory.byteLength) return 0;
      const front = this._memoryView.getUint32(descriptorWa, true);
      const back = this._memoryView.getUint32(descriptorWa + 4, true);
      if (!front || !back) return 0;
      let item = this.buffers[this.current];
      if (item.used + HEADER_BYTES > this.capacity) {
        this._submit('Capacity');
        item = this._acquire();
        if (!item) return 0;
      } else if (item.seq) {
        item = this._acquire();
        if (!item) return 0;
      }
      const start = item.used;
      const view = item.view;
      view.setUint32(start, HEADER_BYTES, true);
      view.setUint32(start + 4, front, true);
      view.setUint32(start + 8, back, true);
      for (let o = 12; o < 28; o += 4) view.setUint32(start + o, 0, true);
      // Snapshot the internal owed-present request now, before the reusable
      // WAT descriptor can name another Flip. Old eight-byte callers remain
      // valid render commands but have no request witness.
      if (descriptorBytes === 16 && descriptorWa + 16 <= memory.byteLength &&
          this._memoryView.getUint32(descriptorWa + 12, true) === 0x44585031) {
        view.setUint32(start + 12, descriptorWa, true);
        view.setUint32(start + 16, this._memoryView.getUint32(descriptorWa + 8, true), true);
        view.setUint32(start + 20, 0x44585031, true);
      }
      view.setUint32(start + 28, RECORD_FLIP, true);
      item.used += HEADER_BYTES;
      item.commands++;
      this.stats.flips = (this.stats.flips || 0) + 1;
      this._submit('Flip');
      return 1;
    }

    enqueueGl(descriptorWa) {
      if (!this.ready()) { this.stats.fallbacks++; return 0; }
      const memory = this._refreshMemoryViews();
      descriptorWa >>>= 0;
      if (descriptorWa + 16 > memory.byteLength) { this.stats.fallbacks++; return 0; }
      const d = this._memoryView;
      const snapWa = d.getUint32(descriptorWa, true);
      const snapBytes = d.getUint32(descriptorWa + 4, true);
      const drawWa = d.getUint32(descriptorWa + 8, true);
      const drawBytes = d.getUint32(descriptorWa + 12, true);
      const recordBytes = align4(HEADER_BYTES + snapBytes + drawBytes);
      if (!snapWa || !drawWa || (snapBytes & 3) || (drawBytes & 3)
          || snapWa + snapBytes > memory.byteLength
          || drawWa + drawBytes > memory.byteLength || recordBytes > this.capacity) {
        this.stats.fallbacks++;
        return 0;
      }
      let item = this.buffers[this.current];
      if (item.used + recordBytes > this.capacity) {
        this._submit('Capacity');
        item = this._acquire();
        if (!item) { this.stats.fallbacks++; return 0; }
      } else if (item.seq) {
        item = this._acquire();
        if (!item) { this.stats.fallbacks++; return 0; }
      }
      const start = item.used;
      const view = item.view;
      view.setUint32(start, recordBytes, true);
      view.setUint32(start + 4, snapBytes, true);
      view.setUint32(start + 8, drawBytes, true);
      for (let o = 12; o < 28; o += 4) view.setUint32(start + o, 0, true);
      view.setUint32(start + 28, RECORD_GL, true);
      item.bytes.set(this._memoryBytes.subarray(snapWa, snapWa + snapBytes), start + HEADER_BYTES);
      item.bytes.set(this._memoryBytes.subarray(drawWa, drawWa + drawBytes),
        start + HEADER_BYTES + snapBytes);
      item.used += recordBytes;
      item.commands++;
      this.stats.queued++;
      this.stats.glQueued = (this.stats.glQueued || 0) + 1;
      this.stats.bytes += snapBytes + drawBytes;
      // Same hand-over rule as enqueue: keep the consumer busy, never idle
      // behind a batch that is only waiting to fill.
      const reason = this._drawSubmitReason(item);
      if (reason) this._submit(reason);
      return 1;
    }

    enqueueGlTex(descriptorWa) {
      if (!this.ready()) { this.stats.fallbacks++; return 0; }
      const memory = this._refreshMemoryViews();
      descriptorWa >>>= 0;
      if (descriptorWa + 28 > memory.byteLength) { this.stats.fallbacks++; return 0; }
      const d = this._memoryView;
      const stageWa = d.getUint32(descriptorWa, true);
      const texBytes = d.getUint32(descriptorWa + 4, true);
      const recordBytes = align4(HEADER_BYTES + texBytes);
      if (!stageWa || (texBytes & 3) || stageWa + texBytes > memory.byteLength
          || recordBytes > this.capacity) {
        this.stats.fallbacks++;
        return 0;
      }
      let item = this.buffers[this.current];
      if (item.used + recordBytes > this.capacity) {
        this._submit('Capacity');
        item = this._acquire();
        if (!item) { this.stats.fallbacks++; return 0; }
      } else if (item.seq) {
        item = this._acquire();
        if (!item) { this.stats.fallbacks++; return 0; }
      }
      const start = item.used;
      const view = item.view;
      view.setUint32(start, recordBytes, true);
      for (let o = 4; o < 24; o += 4)
        view.setUint32(start + o, d.getUint32(descriptorWa + 4 + o, true), true);
      view.setUint32(start + 24, texBytes, true);
      view.setUint32(start + 28, RECORD_GL_TEX, true);
      item.bytes.set(this._memoryBytes.subarray(stageWa, stageWa + texBytes), start + HEADER_BYTES);
      item.used += recordBytes;
      item.commands++;
      this.stats.glTexQueued = (this.stats.glTexQueued || 0) + 1;
      this.stats.bytes += texBytes;
      return 1;
    }

    publish() { return this._submit('Publication'); }

    fence(address = 0, length = 0) {
      if (!this.ready()) return 0;
      this.stats.fences++;
      const target = this._submit('Fence');
      if (this.explicitFence) {
        const seq = (Atomics.add(this.control, CTRL.SUBMITTED, 1) + 1) >>> 0;
        this.lastSubmitted = seq;
        this.worker.postMessage({t:'legacy-fence',seq,address:address>>>0,length:length>>>0});
        return this._waitFor(seq) ? Atomics.load(this.control, CTRL.RESULT) : 0;
      }
      return target ? (this._waitFor(target) ? 1 : 0) : 1;
    }

    call(opcode, descriptorWa, length = 0) {
      opcode |= 0;
      if (opcode === DRAW_OPCODE) return this.enqueue(descriptorWa);
      if (opcode === FENCE_OPCODE) return this.fence(descriptorWa, length);
      if (opcode === READY_OPCODE) return this.ready() ? 1 : 0;
      if (opcode === FLIP_OPCODE) return this.enqueueFlip(descriptorWa, length);
      if (opcode === GL_DRAW_OPCODE) return this.enqueueGl(descriptorWa);
      if (opcode === GL_TEX_OPCODE) return this.enqueueGlTex(descriptorWa);
      return -1;
    }

    snapshot() {
      return Object.assign({}, this.stats, {
        // GPU backend stats also contain `fences`; preserve the producer's
        // explicit request count when the guest merges both snapshots.
        transportFences: this.stats.fences,
        replayBatches: Atomics.load(this.control, CTRL.BATCHES) >>> 0,
        replayCommands: Atomics.load(this.control, CTRL.COMMANDS) >>> 0,
        replayMs: (Atomics.load(this.control, CTRL.REPLAY_US) >>> 0) / 1000,
        glTriangles: Atomics.load(this.control, CTRL.GL_TRIANGLES) >>> 0,
        glClipped: Atomics.load(this.control, CTRL.GL_CLIPPED) >>> 0,
        glCulled: Atomics.load(this.control, CTRL.GL_CULLED) >>> 0,
        ready: Atomics.load(this.control, CTRL.READY) === 1
          && Atomics.load(this.control, CTRL.ERROR) === 0,
      });
    }

    stop() {
      try { this.fence(); } catch (_) {}
      if (this.worker) this.worker.terminate();
      this.worker = null;
    }
  }

  return { DRAW_OPCODE, FENCE_OPCODE, GL_DRAW_OPCODE, STATE_BYTES, HEADER_BYTES, CTRL, Encoder };
});
