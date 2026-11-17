// Consumer for lib/d3d-command-stream.js and the process render owner for
// GPU stream v2 endpoints. It instantiates the same module over shared memory
// with inert host imports. The command stream carries software-OpenGL records
// only (RECORD_GL, RECORD_GL_TEX); D3DIM is the WAT GPU stream producer
// (src/09abg-d3dim-gps.wat), so its old draw (kind 0) and flip (kind 1)
// records are retired and a batch holding one throws.
'use strict';

const IS_WEB = typeof importScripts === 'function';
let parentPort = null;
if (!IS_WEB) parentPort = require('worker_threads').parentPort;
const send = IS_WEB ? ((msg, transfer) => self.postMessage(msg, transfer || []))
  : ((msg, transfer) => parentPort.postMessage(msg, transfer || []));
const listen = IS_WEB
  ? (fn => { self.onmessage = event => fn(event.data || {}); })
  : (fn => parentPort.on('message', msg => fn(msg || {})));

let instance = null;
let memory = null;
let control = null;
let buffers = null;
let verticesGuest = 0;
let initializedImage = 0;
let targetBytes = null;
let initializing = false;
let sharedMode = false;
let sourceVersion;
let stopping = false;
let retirementError = null;
const endpoints = new Map();
let endpointGeneration = 0;
let producerObservationGeneration = 0;
let renderWriterObservation = null;
let sharedMessagesInFlight = 0;
let messageChain = Promise.resolve();
let queuedMessages = 0;
let queuedBytes = 0;
let maxQueuedCommands = 1024;
let maxQueuedBytes = 32 * 1024 * 1024;
const CTRL = {
  READY: 0, COMPLETED: 1, ERROR: 2,
  BATCHES: 4, COMMANDS: 5, REPLAY_US: 6,
  GL_TRIANGLES: 8, GL_CLIPPED: 9, GL_CULLED: 10, RESULT: 11,
};
const HEADER_BYTES = 32;
const RECORD_GL = 2;   // software-OpenGL snapshot + packed draw
const RECORD_GL_TEX = 3; // converted glTexSubImage2D texels for one surface
const VERTEX_CAPACITY = 0x400000;

// Pure functions a rasterizer calls mid-draw (GL fog and specular use pow);
// an inert 0 there would draw the wrong picture rather than fail.
const MATH_IMPORTS = {
  math_sin: Math.sin, math_cos: Math.cos, math_tan: Math.tan,
  math_atan2: Math.atan2, math_log2: Math.log2, math_pow: Math.pow,
  math_pow2: x => Math.pow(2, x),
};

function inertImports(sigs) {
  const host = { memory };
  for (const [name, sig] of Object.entries(sigs || {})) {
    host[name] = MATH_IMPORTS[name]
      || (sig.results && sig.results.length ? (() => 0) : (() => {}));
  }
  return { host };
}

function ensureWorkspace(imageBase) {
  imageBase >>>= 0;
  if (initializedImage === imageBase && verticesGuest) return;
  if (initializedImage && initializedImage !== imageBase) throw new Error('D3D render Worker image base changed');
  const ex = instance.exports;
  // Renderer-only initialization establishes address translation and a private
  // heap arena without assigning a guest thread's page/cache partitions.
  if (!initializedImage) ex.d3dim_worker_init(imageBase);
  // One workspace for a record's payload: a GL snapshot + draw, or texels.
  verticesGuest = ex.guest_alloc(VERTEX_CAPACITY) >>> 0;
  if (!verticesGuest) throw new Error('D3D render Worker workspace allocation failed');
  initializedImage = imageBase;
}

// Opt-in source side of the consumed-version publication protocol. Completion
// remains distinct from the canonical read and actual display publication.
function invalidateProducerWriter(observation) {
  if (renderWriterObservation?.entry.producerObservation === observation)
    renderWriterObservation.epoch.invalidate();
}

function releaseProducerVersions(observation) {
  if (!observation?.journal) return;
  try { observation.journal.release(instance.exports); }
  catch (_) { invalidateProducerWriter(observation); }
}

function replay(msg) {
  ensureWorkspace(msg.imageBase);
  const source = buffers[msg.index | 0];
  if (!source || (msg.bytes >>> 0) > source.buffer.byteLength) throw new RangeError('invalid D3D batch buffer');
  targetBytes = new Uint8Array(memory.buffer);
  const limit = Math.min(msg.bytes >>> 0, source.buffer.byteLength >>> 0);
  const view = source.view;
  const bytes = source.bytes;
  const ex = instance.exports;
  const verticesWa = ex.guest_to_wasm(verticesGuest) >>> 0;
  let offset = 0;
  let commands = 0;
  while (offset < limit) {
    if (offset + HEADER_BYTES > limit) throw new RangeError('truncated D3D command header');
    const recordBytes = view.getUint32(offset, true);
    const kind = view.getUint32(offset + 28, true);
    if (kind === RECORD_GL) {
      const snapBytes = view.getUint32(offset + 4, true);
      const drawBytes = view.getUint32(offset + 8, true);
      if (offset + recordBytes > limit || snapBytes + drawBytes > VERTEX_CAPACITY
          || HEADER_BYTES + snapBytes + drawBytes > recordBytes) {
        throw new RangeError('invalid GL command record');
      }
      // Both payloads into the vertex workspace: the snapshot, then the draw.
      targetBytes.set(bytes.subarray(offset + HEADER_BYTES,
        offset + HEADER_BYTES + snapBytes + drawBytes), verticesWa);
      if (!ex.gl_sw_worker_draw(verticesWa, verticesWa + snapBytes))
        throw new Error('GL render Worker workspace allocation failed');
    } else if (kind === RECORD_GL_TEX) {
      const texBytes = view.getUint32(offset + 24, true);
      if (offset + recordBytes > limit || texBytes > VERTEX_CAPACITY
          || HEADER_BYTES + texBytes > recordBytes) {
        throw new RangeError('invalid GL texture record');
      }
      targetBytes.set(bytes.subarray(offset + HEADER_BYTES,
        offset + HEADER_BYTES + texBytes), verticesWa);
      ex.gl_sw_worker_tex_copy(verticesWa, view.getUint32(offset + 4, true),
        view.getUint32(offset + 8, true), view.getUint32(offset + 12, true),
        view.getUint32(offset + 16, true), view.getUint32(offset + 20, true));
    } else {
      // Kinds 0 (D3DIM draw) and 1 (D3DIM flip) are retired; D3DIM never
      // leaves its WAT GPU stream producer.
      throw new RangeError('retired or unknown render command record kind ' + kind);
    }
    offset += recordBytes;
    commands++;
  }
  if (offset !== limit || commands !== (msg.commands | 0)) {
    throw new RangeError('D3D command batch count mismatch');
  }
}

function transferables(value, result = [], seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return result;
  seen.add(value);
  if (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap) result.push(value);
  else if (value instanceof ArrayBuffer) result.push(value);
  else if (ArrayBuffer.isView(value)) transferables(value.buffer, result, seen);
  else for (const item of Object.values(value)) transferables(item, result, seen);
  return result;
}

function endpointSend(id, message) {
  send({ t: 'render-event', endpointId: id, message }, transferables(message));
}

const loadedLibraries = new Set();
function libraries(files) {
  if (IS_WEB) {
    const suffix = sourceVersion === undefined ? '' : `?v=${encodeURIComponent(sourceVersion)}`;
    for (const file of files) {
      const url = file + '.js' + suffix;
      if (loadedLibraries.has(url)) continue;
      // Import separately to retain successful predecessors if a later
      // dependency fails. A failed import must remain eligible for retry.
      importScripts(url);
      loadedLibraries.add(url);
    }
  }
}

// Render APIs whose frontends write a GPU stream v2 ring.
const GPU_STREAM_APIS = new Set(['glide', 'd3dim-gps', 'd3d9-gps', 'gl-gps']);

// Run fn on the Worker's one message chain, as a message would run: an
// endpoint's own background work (a doorbell drain) never interleaves with
// another endpoint's command, and per-draw native transients are reset after.
function scheduleExclusive(fn) {
  messageChain = messageChain.then(async () => {
    try { await fn(); }
    finally { instance?.exports.d3d_render_reset_transients?.(); }
  }).catch(error => send({ t: 'error', error: String(error && error.stack || error) }));
  return messageChain;
}

function adapterFactory(api) {
  const definitions = {
    // GPU stream v2 rings (docs/gpu-stream-v2.md). Every v2 frontend opens
    // this one API-neutral endpoint; the api name only labels its frames.
    'gpu-stream': ['GpuStreamRenderWorker', ['gpu-backend', 'gpu-stream.generated', 'gpu-stream', 'gpu-stream-doorbell',
      'd3d-shader-ir', 'd3d9-shader', 'render-clear', 'd3d-geometry-batches', 'd3d9-software-backend',
      'gpu-stream-webgl', 'gpu-stream-software', 'gpu-stream-render-worker']],
    // Software only: D3DIM on the GPU is GPU stream v2 ('d3dim-gps' above).
    d3dim: ['D3DIMRenderWorker', ['d3dim-render-worker']],
  };
  const definition = definitions[GPU_STREAM_APIS.has(api) ? 'gpu-stream' : api];
  if (!definition) throw new Error('unknown render API ' + api);
  if (IS_WEB) { libraries(definition[1]); return self[definition[0]]; }
  return require('./' + definition[1].at(-1));
}

async function completedValue(result) {
  if (result && result.completion && typeof result.completion.then === 'function') {
    await result.completion; return await result.value;
  }
  if (result && result.complete === true) return result.value;
  return result;
}

async function closeEndpoint(id) {
  const entry = endpoints.get(id);
  if (!entry) return;
  if (entry.producerObservation) {
    releaseProducerVersions(entry.producerObservation);
    entry.producerObservation.active = false;
    entry.producerObservation.reason ||= 'endpoint-closed';
  }
  if (renderWriterObservation?.entry === entry) {
    renderWriterObservation.epoch.invalidate();
    renderWriterObservation = null;
  }
  endpoints.delete(id);
  try { await entry.adapter?.destroy(); }
  catch (error) { retirementError ||= error; throw error; }
}

async function sharedMessage(msg) {
  // Covers all endpoints sharing this native instance, including foreign
  // draws/readback and workspace writes. Begin before any visible transition;
  // never install a stamp only after a swap has already become visible.
  sharedMessagesInFlight++;
  const epoch = renderWriterObservation?.epoch;
  const ticket = epoch?.begin();
  if (epoch && (msg.t !== 'render-message' || msg.endpointId !== renderWriterObservation.entry.producerObservation.owner.endpointId ||
      !['batch', 'legacy-fence', 'legacy-producer-observation'].includes(msg.message?.t))) epoch.invalidateVersions();
  try { return await sharedMessageInner(msg); }
  catch (error) { epoch?.invalidate(); throw error; }
  finally { epoch?.end(ticket); sharedMessagesInFlight--; }
}

async function sharedMessageInner(msg) {
  if (msg.t === 'render-init') {
    if (instance || initializing) throw new Error('render worker already initialized');
    if (!Number.isInteger(msg.imageBase) || msg.imageBase <= 0 || msg.imageBase > 0xffffffff)
      throw new Error('invalid shared render image base');
    initializing = true; sharedMode = true;
    memory = msg.memory; sourceVersion = msg.sourceVersion;
    maxQueuedBytes = msg.maxQueuedBytes || maxQueuedBytes;
    maxQueuedCommands = msg.maxQueuedCommands || maxQueuedCommands;
    const result = await WebAssembly.instantiate(msg.module, inertImports(msg.sigs));
    instance = result.exports ? result : result.instance;
    if (typeof instance.exports.d3d_render_retire_heap !== 'function')
      throw new Error('native render heap handoff export missing');
    if (typeof instance.exports.d3d_render_reset_transients !== 'function')
      throw new Error('native render transient reset export missing');
    instance.exports.d3dim_worker_init(msg.imageBase);
    initializedImage = msg.imageBase;
    targetBytes = new Uint8Array(memory.buffer);
    send({ t: 'render-ready' }); return;
  }
  if (!sharedMode || !instance || stopping) throw new Error('shared render worker not available');
  if (msg.t === 'render-open') {
    if (!Number.isSafeInteger(msg.endpointId) || msg.endpointId <= 0 || endpoints.has(msg.endpointId))
      throw new Error('invalid render endpoint ID');
    const options = msg.options || {}, entry = { options, generation: ++endpointGeneration };
    // A 'legacy' endpoint is a software-GL command stream replayed natively
    // (see replay); it has no adapter and only the software backend.
    if (options.api === 'legacy') {
      if ((options.backend || 'software') !== 'software')
        throw new Error('legacy render endpoint is software-GL only; backend ' + options.backend);
    } else {
      entry.adapter = adapterFactory(options.api).create({ instance, memory, endpointId:msg.endpointId,
        backend: options.backend || 'software', options,
        sendFrame: (frame, transfer) => endpointSend(msg.endpointId, { t: 'frame', frame }, transfer),
        send: message => endpointSend(msg.endpointId, message),
        schedule: scheduleExclusive });
    }
    endpoints.set(msg.endpointId, entry);
    endpointSend(msg.endpointId, { t: 'ready' }); return;
  }
  if (msg.t === 'render-close') {
    await closeEndpoint(msg.endpointId);
    send({ t: 'render-closed', endpointId: msg.endpointId }); return;
  }
  if (msg.t === 'render-stop') {
    stopping = true;
    let error;
    for (const id of [...endpoints.keys()]) {
      try { await closeEndpoint(id); } catch (failure) { error ||= failure; }
    }
    // Do not claim a heap is reclaimable when a device failed to release it.
    if (error || retirementError) throw error || retirementError;
    const heapHead = instance.exports.d3d_render_retire_heap() >>> 0;
    send({ t: 'render-stopped', heapHead }); return;
  }
  if (msg.t !== 'render-message') throw new Error('unknown shared render message');
  const entry = endpoints.get(msg.endpointId), message = msg.message;
  if (!entry) throw new Error('missing render endpoint');
  if (message.t === 'legacy-producer-observation') {
    // Separate from command execution: bad telemetry requests cannot poison
    // the renderer's completion control block or change a fence result.
    try {
      if (entry.options.api !== 'legacy') throw new Error('queued legacy endpoint required');
      if (message.action === 'arm') {
        if (entry.producerObservation?.active) throw new Error('producer observation already armed');
        const { ownerGeneration, maxRecords = 256, writerEpochBuffer, surfaceVersionBuffer, retainedSurfaceBuffer } = message.options || {};
        if (typeof ownerGeneration !== 'string' || !ownerGeneration.length || ownerGeneration.length > 128 ||
            !Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 4096)
          throw new Error('owner generation and bounded record limit required');
        if (writerEpochBuffer !== undefined) {
          if (renderWriterObservation) throw new Error('render writer epoch already installed');
          if (sharedMessagesInFlight !== 1) throw new Error('render writer epoch requires an idle dispatch boundary');
          let api;
          if (IS_WEB) { libraries(['render-worker']); api = self.RenderWorker; }
          else api = require('./render-worker');
          renderWriterObservation = { entry, epoch: new api.WriterEpoch(writerEpochBuffer) };
        }
        entry.producerObservation = { active: true, reason: null, records: [], duplicates: 0,
          maxRecords, generation: ++producerObservationGeneration,
          owner: { scope: ownerGeneration, endpointId: msg.endpointId, generation: entry.generation },
          clockDomain: `render-worker.performance:${ownerGeneration}:${entry.generation}` };
        if (surfaceVersionBuffer !== undefined) {
          if (IS_WEB) libraries(['region-map.generated']);
          if (!renderWriterObservation || renderWriterObservation.entry !== entry)
            throw new Error('surface versions require shared writer coverage');
          const api = IS_WEB ? self.RenderWorker : require('./render-worker');
          entry.producerObservation.journal = new api.SurfaceVersionJournal(surfaceVersionBuffer, retainedSurfaceBuffer);
          if (entry.producerObservation.journal.count !== maxRecords) throw new Error('surface version record limit mismatch');
        }
      } else if (message.action === 'stop') {
        if (entry.producerObservation) {
          releaseProducerVersions(entry.producerObservation);
          entry.producerObservation.active = false;
          entry.producerObservation.reason ||= 'requested';
        }
        if (renderWriterObservation?.entry === entry) {
          renderWriterObservation.epoch.invalidate(); renderWriterObservation = null;
        }
      } else if (message.action !== 'read') throw new Error('unknown producer observation action');
      endpointSend(msg.endpointId, { t: message.t, requestId: message.requestId,
        receipt: { ...entry.producerObservation, journal: undefined, qualified: false,
          blocker: 'source completion alone does not attest display publication' } });
    } catch (error) {
      if (message.action === 'arm' && renderWriterObservation?.entry === entry) {
        renderWriterObservation.epoch.invalidate();
        if (entry.producerObservation) entry.producerObservation.active = false;
      }
      endpointSend(msg.endpointId, { t: message.t, requestId: message.requestId, error: String(error) });
    }
    return;
  }
  if (message.t === 'init') {
    // The legacy Encoder still publishes its init descriptor to its virtual
    // port; it must never reinitialize the shared native heap.
    if (message.imageBase && message.imageBase !== initializedImage) throw new Error('render image base changed');
    if (entry.options.api === 'legacy') {
      entry.control = new Int32Array(message.control);
      entry.buffers = message.buffers.map(buffer => ({ buffer, view: new DataView(buffer), bytes: new Uint8Array(buffer) }));
      Atomics.store(entry.control, CTRL.READY, 1); Atomics.notify(entry.control, CTRL.READY);
    }
    endpointSend(msg.endpointId, { t: 'ready' }); return;
  }
  if (message.t === 'legacy-close') {
    await closeEndpoint(msg.endpointId);
    endpointSend(msg.endpointId, { t: 'shutdown-complete', heapHead: 0 });
    return;
  }
  if (message.t === 'batch') {
    if (!entry.control || !entry.buffers) throw new Error('legacy endpoint not initialized');
    control = entry.control; buffers = entry.buffers;
    replayBatch(message);
    return;
  }
  if (message.t === 'legacy-fence') {
    if (!entry.control || entry.options.api !== 'legacy') throw new Error('legacy endpoint not initialized');
    // Batches replay natively and complete in order, so every record queued
    // before this barrier is already done; software GL owns no GPU surface
    // to materialize for the guest.
    Atomics.store(entry.control, CTRL.RESULT, 1);
    Atomics.store(entry.control, CTRL.COMPLETED, message.seq | 0);
    Atomics.notify(entry.control, CTRL.COMPLETED);
    // Natural barriers only: never flush just to observe.
    endpointSend(msg.endpointId, { t: 'stats', stats: {
      renderEndpointId: msg.endpointId, renderApi: entry.options.api,
      requestedBackend: entry.options.backend || 'software',
      completedFenceSequence: message.seq,
    } });
    return;
  }
  if (message.t === 'render-request') {
    try {
      if (entry.failed) throw entry.failed;
      const value = await completedValue(await entry.adapter.execute(message.message));
      endpointSend(msg.endpointId, { t: 'render-response', requestId: message.requestId, value });
    } catch (error) {
      entry.failed = error;
      endpointSend(msg.endpointId, { t: 'render-response', requestId: message.requestId,
        error: String(error && error.stack || error) });
    }
    return;
  }
  throw new Error('unknown endpoint message');
}

function replayBatch(msg) {
  const started = performance.now();
  replay(msg);
  Atomics.add(control, CTRL.BATCHES, 1);
  Atomics.add(control, CTRL.COMMANDS, msg.commands | 0);
  Atomics.add(control, CTRL.REPLAY_US, Math.max(0, Math.round((performance.now() - started) * 1000)));
  const ex = instance.exports;
  if (ex.gl_sw_triangles) {
    Atomics.store(control, CTRL.GL_TRIANGLES, ex.gl_sw_triangles() | 0);
    Atomics.store(control, CTRL.GL_CLIPPED, ex.gl_sw_clipped() | 0);
    Atomics.store(control, CTRL.GL_CULLED, ex.gl_sw_culled() | 0);
  }
  Atomics.store(control, CTRL.COMPLETED, msg.seq | 0); Atomics.notify(control, CTRL.COMPLETED);
}

async function processMessage(msg) {
  if (msg.t.startsWith('render-')) {
    try { await sharedMessage(msg); }
    catch (error) {
      const text = String(error && error.stack || error), entry = endpoints.get(msg.endpointId);
      if (entry?.control) {
        Atomics.store(entry.control, CTRL.ERROR, 1);
        Atomics.notify(entry.control, CTRL.READY); Atomics.notify(entry.control, CTRL.COMPLETED);
      }
      if (msg.endpointId) endpointSend(msg.endpointId, { t: 'error', error: text });
      else send({ t: 'error', error: text });
      if (msg.t === 'render-close') send({ t: 'render-closed', endpointId: msg.endpointId, error: text });
    } finally {
      if (msg.transportId) send({ t: 'render-done', transportId: msg.transportId });
    }
    return;
  }
  try {
    if (msg.t === 'init') {
      if (instance || initializing) throw new Error('render worker already initialized');
      initializing = true;
      memory = msg.memory;
      control = msg.control ? new Int32Array(msg.control) : null;
      buffers = (msg.buffers || []).map(buffer => ({
        buffer, view: new DataView(buffer), bytes: new Uint8Array(buffer),
      }));
      targetBytes = new Uint8Array(memory.buffer);
      const result = await WebAssembly.instantiate(msg.module, inertImports(msg.sigs));
      instance = result.exports ? result : (result.instance || result);
      if (!instance.exports.d3dim_worker_init || !instance.exports.gl_sw_worker_draw) {
        throw new Error('D3D render Worker exports missing');
      }
      if (control) {
        Atomics.store(control, CTRL.READY, 1);
        Atomics.notify(control, CTRL.READY);
      }
      send({ t: 'ready' });
      return;
    }
    if (msg.t === 'batch') {
      replayBatch(msg);
    } else if (msg.t === 'legacy-fence') {
      Atomics.store(control, CTRL.RESULT, 1);
      Atomics.store(control, CTRL.COMPLETED, msg.seq | 0);
      Atomics.notify(control, CTRL.COMPLETED);
    } else {
      throw new Error('unknown render worker message ' + msg.t);
    }
  } catch (error) {
    if (control) {
      Atomics.store(control, CTRL.ERROR, 1);
      Atomics.notify(control, CTRL.COMPLETED);
      Atomics.notify(control, CTRL.READY);
    }
    send({ t: 'error', error: String(error && error.stack || error) });
  }
}

function messageBytes(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return typeof value === 'string' ? value.length * 2 : 8;
  seen.add(value);
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (value instanceof ArrayBuffer || typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer)
    return value.byteLength;
  if (value instanceof WebAssembly.Memory || value instanceof WebAssembly.Module) return 0;
  return Object.values(value).reduce((n, v) => n + messageBytes(v, seen), 0);
}

listen(msg => {
  // Match page-side accounting for the bounded observation control handles.
  // The original message, buffers and dispatch validation are unchanged.
  let charged = msg;
  if (msg.t === 'render-message' && msg.message?.t === 'legacy-producer-observation') {
    let api;
    if (IS_WEB) { libraries(['render-worker']); api = self.RenderWorker; }
    else api = require('./render-worker');
    charged = { ...msg, message: api.observationQueueMessage(msg.message) };
  }
  const bytes = messageBytes(charged);
  const counted = !['render-init', 'render-open', 'render-close', 'render-stop'].includes(msg.t);
  if (counted && (queuedMessages >= maxQueuedCommands || bytes > maxQueuedBytes - queuedBytes)) {
    send({ t: 'error', error: 'render worker queue capacity exceeded' }); return;
  }
  if (counted) { queuedMessages++; queuedBytes += bytes; }
  // One scheduler for every API and backend. In particular a sliced native
  // draw retains its WAT scratch until its completion promise resolves.
  messageChain = messageChain.then(async () => {
    try { await processMessage(msg); }
    finally {
      // Native traps skip their WAT epilogues. Keep scratch live throughout
      // cooperative completion, then clear per-draw hooks before any peer.
      // Optional only for compatibility with the dedicated legacy protocol;
      // render-init requires this export for a shared process instance.
      instance?.exports.d3d_render_reset_transients?.();
    }
  })
    .catch(error => send({ t: 'error', error: String(error && error.stack || error) }))
    .finally(() => { if (counted) { queuedMessages--; queuedBytes -= bytes; } });
});
