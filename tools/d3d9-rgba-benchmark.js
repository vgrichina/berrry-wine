#!/usr/bin/env node
'use strict';

// RENDER-PERF-GATE: the exported producer, queue and endpoint, with only the
// final device replaced by a recording sink. No browser, GPU or Wasm is used.
const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
const {Bridge: NativeBridge} = require('../lib/d3d9-host');
const operationObserver = require('./d3d9-operation-observer').create(require.resolve('../lib/d3d9-host'));
const {Bridge} = operationObserver.exports;
const Worker = require('../lib/d3d9-render-worker');
const {OPCODES: OP} = require('../lib/d3d-command-stream');
const U8 = Uint8Array;

function fixture(side, options = {}, observe = true) {
  const bytes = side * side * 4;
  let memory = new ArrayBuffer(524288);
  const program = 1024, desc = 64, records = [40000, 40200, 40400];
  const bits = [65536, 131072, 196608];
  const set = (p, n) => new DataView(memory).setUint32(p, n, true);
  [7, program, 32000, 2, 2, 1, 4, 1, 30000, 16].forEach((n, i) => set(desc + i * 4, n));
  set(program + 12, 0x42);
  new DataView(memory).setFloat32(program + 1696, 1, true);
  for (let i = 0; i < records.length; i++) {
    for (const [offset, value] of [[12,3],[24,side],[28,side],[32,1],[36,21],
      [64,side],[68,side],[72,side*4],[76,bytes],[80,bits[i]],[92,1]]) set(records[i] + offset, value);
    const src = new U8(memory, bits[i], bytes);
    for (let p = 0; p < bytes; p++) src[p] = (p * 13 + i * 7) & 255;
  }
  const bind = i => set(program + 1700, records[i]);
  bind(0);
  const held = new Map(), wire = [], seen = [];
  class RecordingDevice {
    execute(command) {
      if (command.opcode === OP.DRAW) {
        const p = command.payload, level = p.textures[0].levels[0];
        for (const key of p.textureReleases || []) held.delete(key);
        if (level.pixels) held.set(level.key, level.pixels.slice());
        assert(held.has(level.key), 'a reference must have a live device definition');
        seen.push({key:level.key, pixels:held.get(level.key).slice(), releases:p.textureReleases || []});
      }
      return {value:1, complete:true};
    }
    destroy() { held.clear(); }
  }
  const endpoint = Worker.create({instance:{exports:{}}, memory:{buffer:memory},
    backend:'software', options:{SoftwareDevice:RecordingDevice}});
  const consumer = {ready:Promise.resolve(), execute(command) {
    if (command.opcode === OP.DRAW) wire.push(command.payload.textures[0].levels[0]);
    return endpoint.execute(command);
  }, cancel() { endpoint.destroy(); }};
  const bridge = new (observe ? Bridge : NativeBridge)({backend:'software', createSoftwareWorker:()=>consumer,
    getMemory:()=>memory, guestToWasm:p=>p, maxTextureSnapshotBytes:4*bytes,
    maxResidentTextureBytes:2*bytes, ...options});
  return {side, bytes, bridge, records, bits, program, wire, seen, held, set, bind,
    source(i = 0) { return new U8(memory, bits[i], bytes); },
    replaceBuffer() { memory = memory.slice(0); },
    draw() { return bridge.call(0x30001, desc, 0); },
    async drain() { for (const entry of bridge.devices.values()) await entry.queue.fence(); },
    async close() { await bridge.close(); },
    expected(i = 0) {
      const src = this.source(i), rgba = new U8(bytes);
      for (let p = 0; p < bytes; p += 4) rgba.set([src[p+2],src[p+1],src[p],src[p+3]], p);
      return rgba;
    },
  };
}

// Scope all hooks to the synchronous producer call, restore even on errors.
// every invokes the ORIGINAL predicate for every counted source byte; proxies
// observe indexed reads of immutable snapshots. The AST observer counts real
// indexed source loads (including decode) and lexical constructor operations.
// Cache decisions, decoder arithmetic and queue copies retain their original
// expressions. Copy byte counts are logical bytes, not hardware traffic.
function measure(f, extra = () => {}) {
  const counts = {sourceReads:0, snapshotReads:0, scans:0, sliceBytes:0,
    sourceCopyBytes:0, setBytes:0, constructorCopyBytes:0, allocationBytes:0,
    allocations:0, cacheHits:0, decodes:0, indexedSourceReads:0,
    backingAllocationBytes:0, backingAllocations:0};
  const globalU8 = Object.getOwnPropertyDescriptor(globalThis, 'Uint8Array');
  const entryU8 = globalThis.Uint8Array;
  const hookDescriptors = Object.fromEntries(['every','slice','set'].map(key =>
    [key,Object.getOwnPropertyDescriptor(U8.prototype,key)]));
  const every = U8.prototype.every, slice = U8.prototype.slice, set = U8.prototype.set;
  const resident = f.bridge._residentLevel, remember = f.bridge._rememberTexture;
  const ownResident = Object.getOwnPropertyDescriptor(f.bridge, '_residentLevel');
  const ownRemember = Object.getOwnPropertyDescriptor(f.bridge, '_rememberTexture');
  const restorations = [];
  for (const cached of f.bridge._textureSnapshots.values()) {
    const original = cached.source;
    cached.source = new Proxy(original, {get(target, key) {
      if (typeof key === 'string' && /^(0|[1-9][0-9]*)$/.test(key)) counts.snapshotReads++;
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }});
    restorations.push(() => { cached.source = original; });
  }
  const seenAllocations = new WeakSet();
  const allocated = (n, object) => {
    if (object && seenAllocations.has(object)) return;
    if (object) seenAllocations.add(object);
    counts.allocationBytes += n; counts.allocations++;
  };
  const sourceBuffer = f.source().buffer;
  const isSource = object => ArrayBuffer.isView(object) && object.buffer === sourceBuffer &&
    f.bits.includes(object.byteOffset) && object.byteLength === f.bytes;
  const leaveObserver = operationObserver.enter({counts,isSource,allocation(result,args) {
    if (result instanceof ArrayBuffer) {
      counts.backingAllocationBytes += result.byteLength;
      counts.backingAllocations++;
    }
    else if (result instanceof U8 && !(args[0] instanceof ArrayBuffer)) {
      // Global constructor hooks may have already observed this allocation.
      if (!seenAllocations.has(result)) {
        allocated(result.byteLength,result);
        if (typeof args[0] !== 'number') {
          counts.constructorCopyBytes += result.byteLength;
          if (isSource(args[0])) counts.sourceCopyBytes += result.byteLength;
        }
      }
    }
  }});
  try {
    const observedU8 = new Proxy(entryU8, {construct(target, args) {
      const result = Reflect.construct(target, args);
      if (typeof args[0] === 'number' || ArrayBuffer.isView(args[0]) || Array.isArray(args[0])) {
        allocated(result.byteLength,result);
        if (typeof args[0] !== 'number') counts.constructorCopyBytes += result.byteLength;
        if (isSource(args[0])) counts.sourceCopyBytes += result.byteLength;
      }
      return result;
    }});
    Object.defineProperty(globalThis,'Uint8Array',{value:observedU8,writable:true,
      configurable:globalU8.configurable,enumerable:globalU8.enumerable});
    const hook = (object,key,value) => Object.defineProperty(object,key,
      {value,writable:true,configurable:true,enumerable:Object.getOwnPropertyDescriptor(object,key)?.enumerable || false});
    hook(U8.prototype,'every',function(callback, thisArg) {
      counts.scans++;
      return every.call(this, (byte, index, array) => {
        counts.sourceReads++;
        return callback.call(thisArg, byte, index, array);
      });
    });
    hook(U8.prototype,'slice',function(...args) {
      const result = slice.apply(this, args);
      allocated(result.byteLength,result);
      counts.sliceBytes += result.byteLength;
      if (this.buffer === f.source().buffer && f.bits.includes(this.byteOffset)) counts.sourceCopyBytes += result.byteLength;
      return result;
    });
    hook(U8.prototype,'set',function(source, ...args) {
      counts.setBytes += source.length;
      return set.call(this, source, ...args);
    });
    hook(f.bridge,'_rememberTexture',function(...args) {
      counts.decodes++;
      return remember.apply(this, args);
    });
    hook(f.bridge,'_residentLevel',function(entry, snap, ...args) {
      // A null reserve marks the newly decoded branch in the actual caller.
      if (args[1] !== null) counts.cacheHits++;
      return resident.call(this, entry, snap, ...args);
    });
    extra();
    assert.equal(f.draw(), 1, String(f.bridge.lastError));
  } finally {
    leaveObserver();
    Object.defineProperty(globalThis, 'Uint8Array', globalU8);
    for (const key of ['every','slice','set']) {
      if (hookDescriptors[key]) Object.defineProperty(U8.prototype,key,hookDescriptors[key]);
      else delete U8.prototype[key];
    }
    if (ownResident) Object.defineProperty(f.bridge, '_residentLevel', ownResident);
    else delete f.bridge._residentLevel;
    if (ownRemember) Object.defineProperty(f.bridge, '_rememberTexture', ownRemember);
    else delete f.bridge._rememberTexture;
    for (const restore of restorations) restore();
  }
  return counts;
}

// Non-texture payload cost includes 5632 sliced bytes and 4096 set bytes
// (constant banks and small vertex data). Fixed ceilings retain 512 bytes of
// headroom; texture misses get at most three N-byte allocations and two copies:
// decoded RGBA, private source snapshot, and owned command RGBA copy.
function budget(counts, bytes, reads, hit) {
  assert.equal(counts.sourceReads, reads, 'source scan complexity');
  assert.equal(counts.snapshotReads, reads, 'immutable snapshot read complexity');
  assert.equal(counts.indexedSourceReads, hit ? 0 : bytes, 'indexed source read budget including decode');
  // Cold submission grows the renderer's vertex scratch to 4096 bytes.
  // Keep this newly observed backing store separate from the existing U8
  // allocation ceiling; cached draws must allocate no ArrayBuffer backing.
  assert(counts.backingAllocationBytes <= (hit ? 0 : 4096), 'ArrayBuffer backing allocation budget');
  assert(counts.backingAllocations <= (hit ? 0 : 3), 'ArrayBuffer backing allocation count');
  assert.equal(counts.scans, reads ? 1 : 0, 'one scan per candidate');
  assert.equal(counts.cacheHits, hit ? 1 : 0, 'cache reuse');
  assert.equal(counts.decodes, hit ? 0 : 1, 'decode/insertion count');
  assert.equal(counts.sourceCopyBytes, hit ? 0 : bytes, 'private source copy');
  assert(counts.allocationBytes <= (hit ? 0 : 3*bytes) + 6144, 'U8 allocation budget');
  assert(counts.allocations <= 26, 'bounded U8 allocation count');
  assert(counts.sliceBytes + counts.setBytes + counts.constructorCopyBytes <=
    (hit ? 0 : 2*bytes) + 10240, 'logical copy budget');
}

const scenarios = [
  {name:'same-source', reads:n=>n, hit:true, change() {}},
  {name:'same-byte-alias', reads:n=>n, hit:true, change(f) {
    const alias = f.source().subarray(); alias.set(f.source());
  }},
  {name:'equal-new-buffer', reads:n=>n, hit:true, change(f) { f.replaceBuffer(); }},
  {name:'sparse-interior', reads:()=>41, hit:false, change(f) { f.source()[40] ^= 1; }},
  {name:'sparse-last-byte', reads:n=>n, hit:false, change(f) { f.source()[f.bytes-1] ^= 1; }},
  {name:'full-change', reads:()=>1, hit:false, change(f) {
    const src = f.source(); for (let i = 0; i < src.length; i++) src[i] ^= 255;
  }},
  {name:'equal-relocated-pointer', reads:()=>0, hit:false, change(f) {
    f.source(1).set(f.source()); f.set(f.records[0]+80, f.bits[1]);
  }, expected:f=>f.expected(1)},
  {name:'epoch-rollover', reads:()=>0, hit:false,
    setup(f) { f.set(f.program+25596, 0xffffffff); },
    change(f) { f.set(f.program+25596, 0); }},
];

async function seed(f, scenario) {
  scenario?.setup?.(f);
  assert.equal(f.draw(), 1); await f.drain();
}

async function runCounts(side) {
  const rows = [];
  for (const scenario of [{name:'cold', reads:()=>0, hit:false, change() {}}, ...scenarios]) {
    const f = fixture(side, {maxResidentTextureBytes:side*side*4});
    try {
      if (scenario.name !== 'cold') await seed(f, scenario);
      const before = f.seen.at(-1), cached = f.bridge._textureSnapshots.get(f.records[0]+64);
      scenario.change(f);
      const expected = (scenario.expected || (f=>f.expected()))(f);
      const counts = measure(f);
      budget(counts, f.bytes, scenario.reads(f.bytes), scenario.hit);
      await f.drain();
      assert.deepEqual(f.seen.at(-1).pixels, expected, scenario.name + ' exact RGBA');
      if (before) {
        assert.equal(f.seen.at(-1).key === before.key, scenario.hit, 'key invalidation');
        assert.equal(f.bridge._textureSnapshots.get(f.records[0]+64) === cached, scenario.hit, 'snapshot reuse');
        if (!scenario.hit) assert(f.seen.at(-1).releases.includes(before.key), 'stale residency retired');
      }
      assert.equal(f.wire.at(-1).pixels === undefined, scenario.hit, 'definition versus reference');
      assert.equal(f.bridge._textureSnapshotBytes, 2*f.bytes);
      assert.equal(f.bridge.devices.get(7).residentBytes, f.bytes);
      // Mutate through another view after submission: both recorded versions
      // and producer source/RGBA snapshots must remain independently owned.
      const published = f.seen.at(-1).pixels.slice();
      f.source().fill(0);
      assert.deepEqual(f.seen.at(-1).pixels, published);
      assert.deepEqual(f.bridge._textureSnapshots.get(f.records[0]+64).pixels, expected);
      assert.notEqual(f.bridge._textureSnapshots.get(f.records[0]+64).source.buffer, f.source().buffer);
      rows.push({side, bytes:f.bytes, scenario:scenario.name, ...counts});
    } finally { await f.close(); }
  }
  // LRU: A,B,A,C evicts B; returning to B requires a fresh immutable definition.
  const f = fixture(side);
  try {
    const keys = new Map();
    for (const [index, hit] of [[0,false],[1,false],[0,true],[2,false],[1,false]]) {
      f.bind(index);
      const counts = measure(f);
      budget(counts, f.bytes, hit ? f.bytes : 0, hit);
      await f.drain();
      assert.deepEqual(f.seen.at(-1).pixels, f.expected(index));
      if (keys.has(index)) assert.equal(f.seen.at(-1).key === keys.get(index), hit);
      keys.set(index, f.seen.at(-1).key);
      assert(f.bridge._textureSnapshotBytes <= 4*f.bytes);
      assert(f.bridge._textureSnapshots.size <= 2);
      assert(f.bridge.devices.get(7).residentBytes <= 2*f.bytes);
      assert(f.held.size <= 2);
      rows.push({side, bytes:f.bytes, scenario:'churn-'+index, ...counts});
    }
  } finally { await f.close(); }
  return rows;
}

// Native, uninstrumented producer-submission timing, with fence and pixel
// assertions OUTSIDE the timed span. Same fixture/control before and after
// each changing case. Raw samples and control spread are informational only.
async function timings(side, repeats = 5, batch = 8) {
  const rows = [];
  const timingCases = [...scenarios, {name:'cache-churn', change(f) {
    f.selected = ((f.selected || 0) + 1) % 3; f.bind(f.selected);
  }, expected:f=>f.expected(f.selected || 0)}];
  for (const scenario of timingCases) {
    const f = fixture(side, {}, false);
    try {
      await seed(f, scenario);
      const sample = async change => {
        let ms = 0;
        for (let i = 0; i < batch; i++) {
          change(f);
          const start = performance.now();
          const result = f.draw();
          ms += performance.now() - start;
          assert.equal(result, 1); await f.drain();
          assert.deepEqual(f.seen.at(-1).pixels, (scenario.expected || (f=>f.expected()))(f));
        }
        // Retain only a bounded number of sink observations.
        f.seen.splice(0, f.seen.length-1); f.wire.splice(0, f.wire.length-1);
        return ms / batch;
      };
      // Alternate metadata/pointers so EVERY measured change stays a miss.
      let epoch = 0, relocated = false;
      const change = scenario.name === 'epoch-rollover' ? f=>f.set(f.program+25596, (++epoch & 1) ? 0 : 0xffffffff)
        : scenario.name === 'equal-relocated-pointer' ? f=>{
          f.set(f.records[0]+80, f.bits[(relocated = !relocated) ? 1 : 0]);
        } : scenario.change;
      if (scenario.name === 'equal-relocated-pointer') f.source(1).set(f.source());
      await sample(change); await sample(()=>{}); // warmup, not reported
      const before = [], changed = [], after = [];
      for (let r = 0; r < repeats; r++) {
        before.push(await sample(()=>{}));
        changed.push(await sample(change));
        after.push(await sample(()=>{}));
      }
      const controls = before.concat(after);
      rows.push({side, bytes:f.bytes, scenario:scenario.name, batch, repeats,
        unit:'ms/producer submission', controlBefore:before, changed, controlAfter:after,
        controlMin:Math.min(...controls), controlMax:Math.max(...controls),
        controlSpread:Math.max(...controls)-Math.min(...controls)});
    } finally { await f.close(); }
  }
  // Cold draws use a fresh producer per operation; the unchanged, separately
  // seeded control brackets them. Fixture construction and draining stay out
  // of the timed spans, exactly as for the warm scenarios above.
  const control = fixture(side, {}, false);
  try {
    await seed(control);
    const submit = async f => {
      const start = performance.now(), result = f.draw();
      const ms = performance.now() - start;
      assert.equal(result, 1); await f.drain();
      assert.deepEqual(f.seen.at(-1).pixels, f.expected());
      f.seen.splice(0, f.seen.length-1); f.wire.splice(0, f.wire.length-1);
      return ms;
    };
    const before = [], changed = [], after = [];
    for (let r = -1; r < repeats; r++) {
      let b = 0, c = 0, a = 0;
      for (let i = 0; i < batch; i++) {
        b += await submit(control);
        const cold = fixture(side, {}, false);
        try { c += await submit(cold); } finally { await cold.close(); }
        a += await submit(control);
      }
      if (r >= 0) { before.push(b/batch); changed.push(c/batch); after.push(a/batch); }
    }
    const controls = before.concat(after);
    rows.push({side, bytes:control.bytes, scenario:'cold', batch, repeats,
      unit:'ms/producer submission', controlBefore:before, changed, controlAfter:after,
      controlMin:Math.min(...controls), controlMax:Math.max(...controls),
      controlSpread:Math.max(...controls)-Math.min(...controls)});
  } finally { await control.close(); }
  return rows;
}

module.exports = {fixture, measure, budget, runCounts, timings};
if (require.main === module) (async () => {
  const report = {schema:1, gate:'RENDER-PERF-GATE', node:process.version,
    limits:'synthetic BGRA8 16/32/64 squares; no game/GPU/browser/VM or speedup claim',
    countScope:'synchronous producer: every source reads, proxied snapshot reads, AST-observed indexed source loads including decode and lexical U8/ArrayBuffer construction; logical slice/set/constructor copies; excludes other typed arrays and sink copies',
    timingScope:'uninstrumented producer submission only; warmup excluded; fence and exact pixel assertion outside timing; no timing threshold',
    counts:[], timings:[]};
  for (const side of [16,32,64]) {
    report.counts.push(...await runCounts(side));
    report.timings.push(...await timings(side));
  }
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });
