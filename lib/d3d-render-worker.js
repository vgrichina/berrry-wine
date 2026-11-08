// Consumer for lib/d3d-command-stream.js. It instantiates the same module over
// shared memory with inert host imports: D3DIM rasterization is WAT-native and
// presentation remains fenced on the ordinary browser-owner path.
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
let stateGuest = 0;
let verticesGuest = 0;
let descriptorGuest = 0;
let initializedImage = 0;
let targetBytes = null;
let neutralReceiver = null;
let neutralStopping = false;
let initializing = false;
let neutralPending = null;
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
const neutralDevices = new Map();
const CTRL = {
  READY: 0, COMPLETED: 1, ERROR: 2,
  BATCHES: 4, COMMANDS: 5, REPLAY_US: 6,
  GL_TRIANGLES: 8, GL_CLIPPED: 9, GL_CULLED: 10, RESULT: 11,
};
const HEADER_BYTES = 32;
const RECORD_FLIP = 1; // header-only swap record; see d3d-command-stream.js
const RECORD_GL = 2;   // software-OpenGL snapshot + packed draw
const RECORD_GL_TEX = 3; // converted glTexSubImage2D texels for one surface
const STATE_BYTES = 4096;
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
  if (initializedImage === imageBase && stateGuest && verticesGuest && descriptorGuest) return;
  if (initializedImage && initializedImage !== imageBase) throw new Error('D3D render Worker image base changed');
  const ex = instance.exports;
  // Renderer-only initialization establishes address translation and a private
  // heap arena without assigning a guest thread's page/cache partitions.
  if (!initializedImage) ex.d3dim_worker_init(imageBase);
  stateGuest = ex.guest_alloc(STATE_BYTES) >>> 0;
  verticesGuest = ex.guest_alloc(VERTEX_CAPACITY) >>> 0;
  descriptorGuest = ex.guest_alloc(24) >>> 0;
  if (!stateGuest || !verticesGuest || !descriptorGuest) throw new Error('D3D render Worker workspace allocation failed');
  initializedImage = imageBase;
}

function initializeNeutral(msg) {
  if (!Number.isInteger(msg.imageBase) || msg.imageBase <= 0 || msg.imageBase > 0xffffffff)
    throw new Error('invalid neutral render image base');
  if (typeof instance.exports.d3d_render_retire_heap !== 'function')
    throw new Error('native render heap handoff export missing');
  // Same renderer-only initializer as legacy replay, without allocating its
  // unrelated 4 MiB immediate-mode staging buffer or touching x86 thread state.
  if (initializedImage && initializedImage !== msg.imageBase) throw new Error('render image base changed');
  if (!initializedImage) instance.exports.d3dim_worker_init(msg.imageBase);
  initializedImage = msg.imageBase;
  let Stream, Software;
  if (IS_WEB) {
    const suffix = msg.sourceVersion === undefined ? '' : `?v=${encodeURIComponent(msg.sourceVersion)}`;
    importScripts(`d3d-command-stream.js${suffix}`, `d3d-shader-ir.js${suffix}`, `d3d-geometry-batches.js${suffix}`, `render-clear.js${suffix}`, `d3d9-software-backend.js${suffix}`);
    Stream = self.D3DCommandStream; Software = self.D3D9SoftwareBackend;
  } else {
    Stream = require('./d3d-command-stream'); Software = require('./d3d9-software-backend');
  }
  neutralReceiver = Stream.createCommandReceiver({ execute(command) {
    if (neutralStopping) throw new Error('render worker is stopping');
    const p = command.payload, id = command.deviceId;
    if (command.opcode === Stream.OPCODES.RESOURCE_CREATE && p?.kind==='device') {
      if (!p || p.kind !== 'device' || neutralDevices.has(id)) throw new Error('invalid software device creation');
      const device = new Software.Device({getExports:()=>instance.exports,getMemory:()=>memory.buffer,
        width:p.width,height:p.height,format:p.format,quadBudget:p.quadBudget,maxBytes:p.maxBytes,
        sliceMs:p.sliceMs===undefined?4:p.sliceMs,
        schedule:Software.yieldTask});
      neutralDevices.set(id,{device,generation:command.generation});
      return {value:{width:device.width,height:device.height,pitch:device.pitch},complete:true};
    }
    const entry = neutralDevices.get(id);
    if (!entry || entry.generation !== command.generation) throw new Error('missing/stale software device');
    const result = entry.device.execute(command);
    if (command.opcode === Stream.OPCODES.RESOURCE_RELEASE && command.payload.kind==='device') neutralDevices.delete(id);
    return result;
  } }, message => {
    send(message);
    if (message.phase === 'completed' || message.phase === 'failed') {
      neutralPending?.(); neutralPending = null;
    }
  });
}

function shutdownNeutral() {
  if (neutralStopping) return;
  neutralStopping = true;
  let devicesReleased = 0, allocatedBytes = 0;
  for (const {device} of neutralDevices.values()) {
    device.destroy(); devicesReleased++; allocatedBytes += device.bytes;
  }
  neutralDevices.clear();
  const heapHead = instance.exports.d3d_render_retire_heap() >>> 0;
  send({t:'shutdown-complete',devicesReleased,allocatedBytes,heapHead});
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

// Bounded opt-in diagnostics: one set of atomic states per journal record.
// The epoch is read twice so an entry/exit racing the sample cannot look sole.
function sourceWriterState(epoch) {
  const state = { epoch: Atomics.load(epoch.words, 1),
    active: Atomics.load(epoch.words, 0), poison: Atomics.load(epoch.words, 2),
    hostVersion: Atomics.load(epoch.words, 3) >>> 0 };
  state.epochAfter = Atomics.load(epoch.words, 1);
  return state;
}

function completedProducer(observation, msg, ordinal, front, back, request) {
  if (!observation?.active) return;
  const previous = observation.last;
  if (previous && (msg.seq < previous.batch ||
      (msg.seq === previous.batch && ordinal <= previous.ordinal))) {
    if (msg.seq === previous.batch && ordinal === previous.ordinal &&
        front === previous.front && back === previous.back &&
        JSON.stringify(request) === JSON.stringify(previous.request)) {
      observation.duplicates++;
      return;
    }
    observation.active = false;
    observation.reason = 'stale-or-conflicting-completion';
    invalidateProducerWriter(observation);
    return;
  }
  if (!Number.isSafeInteger(msg.seq) || msg.seq <= 0) {
    observation.active = false;
    observation.reason = 'invalid-batch';
    invalidateProducerWriter(observation);
    return;
  }
  const record = {
    owner: observation.owner, observationGeneration: observation.generation,
    batch: msg.seq, ordinal, front, back, request,
    completed: { domain: observation.clockDomain, timeOrigin: performance.timeOrigin,
      atMs: performance.now() },
    // Entry addresses identify the swap, never a consumed memory version.
    consumedSurfaceVersion: null, qualified: false,
  };
  observation.last = record;
  if (observation.journal) {
    // Only the renderer may be executing while it seals this source proof.
    // An overlapping guest/standalone writer makes completion unqualified.
    // Its later page notification cannot retroactively repair this interval.
    try {
      const epoch = renderWriterObservation.epoch;
      record.sourceWriter = { ...observation.sourceWriter };
      const checkWriter = stage => {
        const state = sourceWriterState(epoch), stamp = observation.sourceStamp;
        record.sourceWriter[stage] = state;
        const causes = [];
        if (state.poison) causes.push('poisoned');
        if (state.active !== 1) causes.push('not-sole');
        if (!stamp) causes.push('missing-stamp');
        if (state.epoch !== state.epochAfter || (stamp && state.epoch !== stamp.epoch)) causes.push('epoch-changed');
        if (stamp && state.hostVersion !== stamp.hostVersion) causes.push('host-version-changed');
        if (causes.length) {
          record.sourceWriter.rejection = { stage, causes };
          throw new Error('source-writer-' + causes[0]);
        }
      };
      checkWriter('sealEntry');
      const dv = new DataView(memory.buffer), ex = instance.exports;
      const width = dv.getUint16(front + 12, true), height = dv.getUint16(front + 14, true);
      const bpp = dv.getUint16(front + 16, true), pitch = dv.getUint16(front + 18, true);
      const dib = dv.getUint32(front + 20, true);
      if (!request || !width || !height || !pitch || dv.getUint32(front, true) !== 2)
        throw new Error('missing-source-surface-or-request');
      const palette = bpp <= 8 ? ex.get_dx_display_palette_wa() >>> 0 : 0;
      const regions = IS_WEB ? self.RegionMap : require('./region-map.generated');
      const formatAddress = regions.BASE.DX_SURF_FMT + ((front - regions.BASE.DX_OBJECTS) >>> 5) * 4;
      const format = dv.getUint32(formatAddress, true);
      const masks = bpp !== 16 ? null : format === 2 || format === 3 ? [0x7c00, 0x3e0, 0x1f] :
        format === 4 ? [0xf00, 0xf0, 0xf] : [0xf800, 0x7e0, 0x1f];
      const ranges = [[front, 32], [dib, pitch * height]];
      if (palette) {
        ranges.push([palette, (1 << bpp) * 4], [regions.BASE.DX_PROCESS_STATE, 32],
          [regions.BASE.GDI_DISPLAY_STATE, 8]);
      }
      // Metadata carries a lifetime notification, independent of equal slot
      // addresses, equal descriptors, DIB reuse or pixel equality.
      const pages = observation.journal.capture(memory, ex, ranges);
      const layout = { width, height, bpp, pitch, dib, palette, masks, topDown: true };
      const retained = observation.journal.retain(observation.records.length, memory, layout);
      checkWriter('sealExit');
      if (!observation.journal.unchanged(memory, { pages })) throw new Error('source-pages-changed-during-seal');
      observation.journal.commitRetained(retained);
      const version = { ...record, sourceVersion: observation.records.length + 1,
        layout, pages, retained,
        hostVersion: observation.sourceStamp.hostVersion };
      observation.journal.finish(observation.records.length, version);
      record.sourceVersion = version.sourceVersion;
    } catch (error) {
      record.versionRejected = String(error.message || error);
      try {
        observation.journal.finish(observation.records.length, { ...record,
          sourceVersion: observation.records.length + 1, versionRejected: record.versionRejected });
      } catch (_) { invalidateProducerWriter(observation); }
    }
  }
  observation.records.push(record);
  try { endpointSend(observation.owner.endpointId, { t: 'legacy-producer-completed', record }); }
  catch (_) {
    observation.active = false; observation.reason = 'observer-delivery-failed';
    invalidateProducerWriter(observation);
  }
  if (observation.records.length >= observation.maxRecords) {
    observation.active = false;
    observation.reason ||= 'record-limit';
    invalidateProducerWriter(observation);
  }
}

async function replay(msg, adapter, evidence, trace, producerObservation) {
  ensureWorkspace(msg.imageBase);
  const source = buffers[msg.index | 0];
  if (!source || (msg.bytes >>> 0) > source.buffer.byteLength) throw new RangeError('invalid D3D batch buffer');
  targetBytes = new Uint8Array(memory.buffer);
  const limit = Math.min(msg.bytes >>> 0, source.buffer.byteLength >>> 0);
  const view = source.view;
  const bytes = source.bytes;
  const ex = instance.exports;
  const stateWa = ex.guest_to_wasm(stateGuest) >>> 0;
  const verticesWa = ex.guest_to_wasm(verticesGuest) >>> 0;
  let offset = 0;
  let commands = 0;
  while (offset < limit) {
    // Copy the original owning record before dispatch or workspace reuse.
    // Diagnostic failures only stop tracing; renderer validation is unchanged.
    trace?.record(bytes.subarray(0, limit), offset, msg.seq, commands);
    if (offset + HEADER_BYTES > limit) throw new RangeError('truncated D3D command header');
    if(adapter?.diagnosticActive)adapter.setDiagnosticContext?.({sequence:msg.seq,ordinal:commands,recordKind:view.getUint32(offset+28,true)});
    const recordBytes = view.getUint32(offset, true);
    if (view.getUint32(offset + 28, true) === RECORD_FLIP) {
      if (recordBytes !== HEADER_BYTES) throw new RangeError('invalid D3D flip record');
      if (producerObservation?.active && producerObservation.journal) {
        try { producerObservation.journal.begin(producerObservation.records.length, view.getUint32(offset + 4, true)); }
        catch (_) { invalidateProducerWriter(producerObservation); }
        producerObservation.sourceWriter = { beforeFence: sourceWriterState(renderWriterObservation.epoch) };
      }
      // The scheduler retains the batch/snapshots and WAT scratch across
      // this await. Peers keep the conservative synchronous ownership path.
      if (endpoints.size === 1 && adapter?.fenceFlip) await adapter.fenceFlip();
      else adapter?.fence();
      if (producerObservation?.active && producerObservation.journal) {
        // The new source lifetime starts at the swap, AFTER readback completes.
        // Keep the dispatch writer active throughout the fence, but do not
        // carry a stale pre-fence epoch into this new immutable version.
        // There is no await between this stamp, the swap and source sealing.
        const state = sourceWriterState(renderWriterObservation.epoch);
        producerObservation.sourceWriter.beforeSwap = state;
        producerObservation.sourceStamp = state.active === 1 && !state.poison && state.epoch === state.epochAfter
          ? { epoch: state.epoch, hostVersion: state.hostVersion } : null;
      }
      ex.d3dim_worker_flip(view.getUint32(offset + 4, true), view.getUint32(offset + 8, true));
      completedProducer(producerObservation, msg, commands,
        view.getUint32(offset + 4, true), view.getUint32(offset + 8, true),
        producerObservation?.active && view.getUint32(offset + 20, true) === 0x44585031 && view.getUint32(offset + 16, true)
          ? { descriptor: view.getUint32(offset + 12, true), serial: view.getUint32(offset + 16, true) }
          : null);
      adapter?.diagnosticRoute?.('worker-flip',{front:view.getUint32(offset+4,true),back:view.getUint32(offset+8,true),completed:true});
      offset += recordBytes;
      commands++;
      continue;
    }
    if (view.getUint32(offset + 28, true) === RECORD_GL) {
      const snapBytes = view.getUint32(offset + 4, true);
      const drawBytes = view.getUint32(offset + 8, true);
      if (offset + recordBytes > limit || snapBytes + drawBytes > VERTEX_CAPACITY
          || HEADER_BYTES + snapBytes + drawBytes > recordBytes) {
        throw new RangeError('invalid GL command record');
      }
      adapter?.fence();
      // Both payloads into the vertex workspace: the snapshot, then the draw.
      targetBytes.set(bytes.subarray(offset + HEADER_BYTES,
        offset + HEADER_BYTES + snapBytes + drawBytes), verticesWa);
      if (!ex.gl_sw_worker_draw(verticesWa, verticesWa + snapBytes))
        throw new Error('GL render Worker workspace allocation failed');
      adapter?.diagnosticRoute?.('excluded-software-GL-draw',{completed:true,targetUnknown:true});
      offset += recordBytes;
      commands++;
      continue;
    }
    if (view.getUint32(offset + 28, true) === RECORD_GL_TEX) {
      const texBytes = view.getUint32(offset + 24, true);
      if (offset + recordBytes > limit || texBytes > VERTEX_CAPACITY
          || HEADER_BYTES + texBytes > recordBytes) {
        throw new RangeError('invalid GL texture record');
      }
      adapter?.fence();
      targetBytes.set(bytes.subarray(offset + HEADER_BYTES,
        offset + HEADER_BYTES + texBytes), verticesWa);
      ex.gl_sw_worker_tex_copy(verticesWa, view.getUint32(offset + 4, true),
        view.getUint32(offset + 8, true), view.getUint32(offset + 12, true),
        view.getUint32(offset + 16, true), view.getUint32(offset + 20, true));
      adapter?.diagnosticRoute?.('excluded-software-GL-upload',{completed:true,targetUnknown:true});
      offset += recordBytes;
      commands++;
      continue;
    }
    const stateBytes = view.getUint32(offset + 20, true);
    const vertexBytes = view.getUint32(offset + 24, true);
    if (recordBytes < HEADER_BYTES + STATE_BYTES || offset + recordBytes > limit
        || stateBytes !== STATE_BYTES || vertexBytes > VERTEX_CAPACITY
        || HEADER_BYTES + stateBytes + vertexBytes > recordBytes) {
      throw new RangeError('invalid D3D command record');
    }
    targetBytes.set(bytes.subarray(offset + HEADER_BYTES,
      offset + HEADER_BYTES + stateBytes), stateWa);
    targetBytes.set(bytes.subarray(offset + HEADER_BYTES + stateBytes,
      offset + HEADER_BYTES + stateBytes + vertexBytes), verticesWa);
    const args = [view.getUint32(offset + 4, true), view.getUint32(offset + 8, true),
      view.getUint32(offset + 12, true), verticesGuest,
      view.getUint32(offset + 16, true), stateGuest];
    if (adapter) {
      const descriptorWa = ex.guest_to_wasm(descriptorGuest) >>> 0;
      const descriptor = new DataView(memory.buffer);
      args.forEach((value, index) => descriptor.setUint32(descriptorWa + index * 4, value, true));
      const drawMessage = { opcode: 0x20000, wa: descriptorWa, stateGuest };
      if (adapter.diagnosticActive) drawMessage.diagnosticContext = { sequence: msg.seq, ordinal: commands };
      adapter.execute(drawMessage);
    } else {
      ex.d3dim_worker_draw(...args);
      if (evidence) evidence.d3dimSoftwareDrawCallsCompleted++;
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

function adapterFactory(api) {
  const definitions = {
    glide: ['GlideRenderWorker', ['gpu-backend', 'glide-backend', 'd3d-shader-ir', 'render-clear',
      'd3d-command-stream', 'd3d-geometry-batches', 'd3d9-software-backend', 'glide-software', 'glide-render-worker']],
    neutral: ['D3D9RenderWorker', ['gpu-backend', 'd3d-shader-ir', 'd3d9-shader', 'd3d9-fixed', 'render-clear',
      'd3d9-backend', 'd3d-command-stream', 'd3d-geometry-batches', 'd3d9-software-backend', 'd3d9-render-worker']],
    gl: ['GLRenderWorker', ['region-map.generated', 'gpu-backend', 'gl-command-stream', 'mem-utils', 'gl-compat', 'gl-render-worker']],
    d3dim: ['D3DIMRenderWorker', ['gpu-backend', 'd3d-shader-ir', 'd3d9-shader', 'd3d9-fixed', 'render-clear', 'd3d9-backend',
      'd3dim-gpu', 'd3dim-render-worker']],
  };
  const definition = definitions[api];
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
  entry.trace?.stop('endpoint-closed');
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
    const options = msg.options || {}, entry = { options, generation: ++endpointGeneration,
      evidence: { d3dimSoftwareDrawCallsCompleted: 0 } };
    if (options.api !== 'legacy' || options.backend === 'webgl') {
      entry.adapter = adapterFactory(options.api === 'legacy' ? 'd3dim' : options.api).create({ instance, memory, endpointId:msg.endpointId,
        backend: options.backend || 'software', options,
        sendFrame: frame => endpointSend(msg.endpointId, { t: 'frame', frame }) });
      if (options.api === 'neutral') {
        const Stream = IS_WEB ? self.D3DCommandStream : require('./d3d-command-stream');
        entry.receiver = Stream.createCommandReceiver(entry.adapter, message => {
          endpointSend(msg.endpointId, message);
          if (message.phase === 'completed' || message.phase === 'failed') {
            entry.complete?.(); entry.complete = null;
          }
        });
      }
    }
    if(options.groundDiagnostic){
      if(options.api!=='legacy'||!entry.adapter)throw Error('producer diagnostic requires legacy WebGL endpoint');
      let factory;
      if(IS_WEB){libraries(['d3dim-draw-trace']);factory=self.D3DIMDrawTrace;}
      else factory=require('./d3dim-draw-trace');
      entry.adapter.diagnostic('arm',{...options.groundDiagnostic,endpointId:msg.endpointId},factory);
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
      endpoints.get(id).trace?.stop('worker-stopped');
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
  if (message.t === 'legacy-ground-diagnostic') {
    try {
      if (entry.options.api !== 'legacy' || !entry.adapter) throw new Error('legacy WebGL endpoint required');
      let factory;
      if (IS_WEB) { libraries(['d3dim-draw-trace']); factory = self.D3DIMDrawTrace; }
      else factory = require('./d3dim-draw-trace');
      const receipt = entry.adapter.diagnostic(message.action, { ...message.options, endpointId: msg.endpointId }, factory);
      endpointSend(msg.endpointId, { t: message.t, requestId: message.requestId, receipt });
    } catch (error) {
      endpointSend(msg.endpointId, { t: message.t, requestId: message.requestId, error: String(error) });
    }
    return;
  }
  if (message.t === 'legacy-draw-trace') {
    // A diagnostic request must not poison the renderer control block.
    try {
      if (entry.options.api !== 'legacy') throw new Error('legacy endpoint required');
      if (message.action === 'arm') {
        if (entry.trace?.active) throw new Error('trace already armed');
        let factory;
        if (IS_WEB) { libraries(['d3dim-draw-trace']); factory = self.D3DIMDrawTrace; }
        else factory = require('./d3dim-draw-trace');
        entry.trace = factory.create({ ...message.options, endpointId: msg.endpointId });
      } else if (message.action === 'stop') entry.trace?.stop('requested');
      else if (message.action !== 'read') throw new Error('unknown trace action');
      endpointSend(msg.endpointId, { t: 'legacy-draw-trace', requestId: message.requestId,
        receipt: entry.trace?.receipt() || null });
    } catch (error) {
      endpointSend(msg.endpointId, { t: 'legacy-draw-trace', requestId: message.requestId,
        error: String(error) });
    }
    return;
  }
  if (message.t === 'init') {
    // Legacy Encoder/WorkerConsumer still publish their init descriptor to
    // their virtual port; it must never reinitialize the shared native heap.
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
  if (message.t === 'd3d-shutdown') {
    await closeEndpoint(msg.endpointId);
    // Shared heap lifetime belongs to the process manager, not this device.
    endpointSend(msg.endpointId, { t: 'shutdown-complete', heapHead: 0, devicesReleased: 1, allocatedBytes: 0 });
    return;
  }
  if (message.t === 'd3d-command') {
    if (!entry.receiver) throw new Error('endpoint does not accept neutral commands');
    await new Promise((resolve, reject) => {
      entry.complete = resolve;
      try { entry.receiver(message); } catch (error) { entry.complete = null; reject(error); }
    });
    return;
  }
  if (message.t === 'batch') {
    if (!entry.control || !entry.buffers) throw new Error('legacy endpoint not initialized');
    control = entry.control; buffers = entry.buffers;
    try { await replayBatch(message, entry.adapter, entry.evidence, entry.trace, entry.producerObservation); }
    catch (error) { entry.trace?.stop('renderer-error'); throw error; }
    return;
  }
  if (message.t === 'legacy-fence' || message.t === 'legacy-call') {
    // Clear invalidates live DIB proofs under sharedMessage's exclusion.
    // It emits no record. A separately retained complete source may survive;
    // otherwise only a later fresh flip can qualify.
    // Other synchronous routes still retire observation.
    if (message.t === 'legacy-call' && message.opcode !== 0x20004 && entry.producerObservation?.active) {
      entry.producerObservation.active = false;
      entry.producerObservation.reason = 'unsupported-synchronous-legacy-call';
      invalidateProducerWriter(entry.producerObservation);
    }
    if (message.t === 'legacy-call') entry.trace?.stop('unsupported-legacy-call');
    if (!entry.control || entry.options.api !== 'legacy') throw new Error('legacy endpoint not initialized');
    // Batch completion frees snapshot storage; only this explicit barrier
    // materializes GPU contents for a guest CPU consumer.
    let result;
    if (message.t === 'legacy-fence') {
      // Each guest producer has its own endpoint, but surface memory is
      // process-wide. A foreign producer must reach the GPU that owns it.
      // Lazy Lock publishes/completes its producer batch before exposing the
      // range, so all required draws are already ahead of this request.
      let pending = false;
      for (const candidate of endpoints.values()) {
        if (!candidate.adapter || !['legacy', 'd3dim'].includes(candidate.options.api)) continue;
        const operation={opcode:0x20001,wa:message.address>>>0,length:message.length>>>0};
        if(candidate.adapter.diagnosticActive)operation.diagnosticContext={sequence:message.seq,ordinal:null,route:'legacy-fence',issuerEndpointId:msg.endpointId};
        const reply = await candidate.adapter.execute(operation);
        if (((reply?.value ?? reply) | 0) === 0) throw new Error('shared surface fence failed');
        pending ||= ((reply?.value ?? reply) | 0) === 2;
        if (candidate === entry) result = reply;
      }
      result = result && typeof result === 'object'
        ? { ...result, value: pending ? 2 : 1 } : pending ? 2 : 1;
    } else {
      const operation={opcode:message.opcode,wa:message.wa,length:message.length>>>0};
      if(entry.adapter?.diagnosticActive)operation.diagnosticContext={sequence:message.seq,ordinal:null,route:'legacy-call'};
      result=await entry.adapter?.execute(operation);
    }
    if (message.t === 'legacy-call' && !entry.adapter) throw new Error('legacy call requires GPU endpoint');
    Atomics.store(entry.control, CTRL.RESULT, (result?.value ?? result) | 0);
    Atomics.store(entry.control, CTRL.COMPLETED, message.seq | 0);
    Atomics.notify(entry.control, CTRL.COMPLETED);
    if (message.t === 'legacy-fence' || result?.stats) {
      // Natural barriers only: never flush just to observe. Counts attest
      // completed native calls, not visible pixels or successful gameplay.
      endpointSend(msg.endpointId, { t: 'stats', stats: {
        ...result?.stats, glRenderer: result?.glRenderer ?? null, glVersion: result?.glVersion ?? null,
        renderEndpointId: msg.endpointId, renderApi: entry.options.api,
        requestedBackend: entry.options.backend || 'software',
        completedFenceSequence: message.seq,
        d3dimSoftwareDrawCallsCompleted: entry.evidence.d3dimSoftwareDrawCallsCompleted,
        d3dimFallbackSoftwareDrawCallsCompleted: entry.adapter?.d3dimSoftwareDrawCallsCompleted ?? 0,
      } });
    }
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

async function replayBatch(msg, adapter, evidence, trace, producerObservation) {
  const started = performance.now();
  await replay(msg, adapter, evidence, trace, producerObservation);
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
      if (!instance.exports.d3dim_worker_init || !instance.exports.d3dim_worker_draw) {
        throw new Error('D3D render Worker exports missing');
      }
      if (msg.mode === 'neutral') initializeNeutral(msg);
      if (control) {
        Atomics.store(control, CTRL.READY, 1);
        Atomics.notify(control, CTRL.READY);
      }
      send({ t: 'ready' });
      return;
    }
    if (msg.t === 'd3d-command') {
      if (!neutralReceiver) throw new Error('neutral render worker not initialized');
      await new Promise((resolve, reject) => {
        neutralPending = resolve;
        try { neutralReceiver(msg); } catch (error) { neutralPending = null; reject(error); }
      });
      return;
    }
    if (msg.t === 'd3d-shutdown') { shutdownNeutral(); return; }
    if (msg.t === 'batch') {
      await replayBatch(msg);
    } else if (msg.t === 'legacy-fence') {
      Atomics.store(control, CTRL.RESULT, 1);
      Atomics.store(control, CTRL.COMPLETED, msg.seq | 0);
      Atomics.notify(control, CTRL.COMPLETED);
    }
  } catch (error) {
    // A protocol/validation failure can still retire the native owner cleanly.
    // A genuinely killed or trapped worker without this acknowledgement is
    // reported as orphaned by its producer, not silently claimed reclaimed.
    if (neutralReceiver && !neutralStopping) {
      try { shutdownNeutral(); } catch (_) {}
    }
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
