'use strict';

// Native snapshot/restore primitives, plus a persistent cooperative DOS runner.
// Native snapshots alone do not capture the host machine. Both layers require
// makeVm(..., { exportAll: true }) and the exact emitted WAT/bytes.
const { createHash } = require('node:crypto');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function abi(vm) {
  const globals = [...vm.wat.replace(/;;[^\n]*/g, '').matchAll(/\(global \$([\w.]+) (\(mut )?(i32|i64|f32|f64)/g)]
    .map(m => ({ name: 'g$' + m[1], mutable: !!m[2], type: m[3] }));
  const exported = Object.keys(vm.exports).filter(k => k.startsWith('g$')).sort();
  if (!globals.length || globals.length !== exported.length ||
      globals.some(g => !exported.includes(g.name) || !(vm.exports[g.name] instanceof WebAssembly.Global))) {
    throw Error('checkpoint requires the complete native exportAll global ABI');
  }
  const names = new Map();
  for (const [k, v] of Object.entries(vm.exports)) {
    if (k.startsWith('f$') && typeof v === 'function' && !names.has(v)) names.set(v, k);
  }
  const table = vm.exports.h;
  if (!(table instanceof WebAssembly.Table)) throw Error('checkpoint requires native handler table export');
  return { globals, names, table };
}

function snapshot(vm) {
  const { globals, names, table } = abi(vm);
  const handlers = Array.from({ length: table.length }, (_, i) => {
    const fn = table.get(i);
    if (fn === null) return null;
    const name = names.get(fn);
    if (!name) throw Error('checkpoint contains an unnamed handler at ' + i);
    return name;
  });
  return {
    schema: 'toyvm-native-checkpoint-v1',
    moduleSha256: sha256(vm.bytes), watSha256: sha256(vm.wat),
    memory: vm.mem.slice(),
    globals: globals.map(g => ({ ...g, value: vm.exports[g.name].value })),
    handlers,
  };
}

function prepareRestore(vm, state) {
  const { globals, table } = abi(vm);
  // Validate the entire record before writing anything. In particular do not
  // load selectors or call get_flags: those materialize state being restored.
  if (state?.schema !== 'toyvm-native-checkpoint-v1' ||
      state.moduleSha256 !== sha256(vm.bytes) || state.watSha256 !== sha256(vm.wat)) {
    throw Error('checkpoint module identity mismatch');
  }
  if (!(state.memory instanceof Uint8Array) || state.memory.length !== vm.mem.length) {
    throw Error('checkpoint memory size mismatch');
  }
  if (!Array.isArray(state.globals) || globals.length !== state.globals.length) {
    throw Error('checkpoint global ABI mismatch');
  }
  const values = globals.map((g, i) => {
    const saved = state.globals[i];
    if (!saved || saved.name !== g.name || saved.mutable !== g.mutable || saved.type !== g.type ||
        typeof saved.value !== (g.type === 'i64' ? 'bigint' : 'number') ||
        ((g.type === 'i32') && !Object.is(saved.value, saved.value | 0)) ||
        ((g.type === 'i64') && (saved.value !== BigInt.asIntN(64, saved.value))) ||
        ((g.type === 'f32') && !Object.is(saved.value, Math.fround(saved.value))) ||
        (!g.mutable && !Object.is(vm.exports[g.name].value, saved.value))) {
      throw Error('checkpoint global ABI/value mismatch at ' + g.name);
    }
    return saved.value;
  });
  if (!Array.isArray(state.handlers) || state.handlers.length !== table.length ||
      Object.keys(state.handlers).length !== table.length) {
    throw Error('checkpoint handler table mismatch');
  }
  const handlers = Array.from({ length: table.length }, (_, i) => {
    const name = state.handlers[i];
    if (name === null) return null;
    if (typeof name !== 'string' || !name.startsWith('f$') ||
        typeof vm.exports[name] !== 'function') {
      throw Error('checkpoint handler table mismatch at ' + i);
    }
    return vm.exports[name];
  });
  // Stage detached copies so later reads of the supplied record cannot fail
  // after the first write. Checkpoints are trusted data records, not objects
  // with executable getters/proxies, and callers must stop the VM first.
  const memory = state.memory.slice();
  return () => {
    vm.mem.set(memory);
    globals.forEach((g, i) => { if (g.mutable) vm.exports[g.name].value = values[i]; });
    handlers.forEach((fn, i) => table.set(i, fn));
    return vm;
  };
}
function restore(vm, state) { return prepareRestore(vm, state)(); }

// Only the factory below makes supported host checkpoint runners.
const fs = require('node:fs');
const path = require('node:path');
const v8 = require('node:v8');
const { isDeepStrictEqual } = require('node:util');
const RUNNERS = new WeakMap();
const NO_LOG = () => {};
const HOST_SCHEMA = 'toyvm-dos-machine-v1';

// Hash the actual executable host sources, not a caller-supplied revision label.
function sourceIdentity() {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.js')).sort();
  const result = files.map(f => [f, sha256(fs.readFileSync(path.join(__dirname, f)))]);
  const font = path.join(__dirname, '../../fonts/Terminal.fon');
  result.push(['fonts/Terminal.fon', fs.existsSync(font) ? sha256(fs.readFileSync(font)) : null]);
  result.push(['tools/fnt-read.js', sha256(fs.readFileSync(path.join(__dirname, '../fnt-read.js')))]);
  return result;
}
const loadedSource = sourceIdentity();
const sourceKey = () => sha256(v8.serialize(sourceIdentity()));
const loadedSourceKey = sha256(v8.serialize(loadedSource));

function prototypeTable(m, s) {
  return [Object.prototype, null, Object.getPrototypeOf(m), Object.getPrototypeOf(s),
    Object.getPrototypeOf(s.cache), Object.getPrototypeOf(m.audio),
    Object.getPrototypeOf(m.audio.dma), Object.getPrototypeOf(m.audio.opl),
    Object.getPrototypeOf(m.audio.opl.ops[0]), Object.getPrototypeOf(m.audio.opl.ch[0]),
    Object.getPrototypeOf(m.gus), Object.getPrototypeOf(m.gus.voices[0])];
}
const VIEW_TYPES = { Uint8Array, Uint8ClampedArray, Int8Array, Uint16Array,
  Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array, DataView };

// Encode the connected data graph, including aliases (file records, program
// indices, OPL operators), cycles and views into VM memory. No function bodies
// or lexical environments are serialized. The console's methods use `this`;
// their exact factory-created identities are reconstructed by named binding.
function packGraph(roots, meta) {
  const nodes = [], seen = new Map();
  const bindings = new Map(meta.bindings.map((v, i) => [v, i]));
  function ref(x) {
    if (x === null || ['undefined', 'string', 'number', 'boolean', 'bigint'].includes(typeof x)) return { value: x };
    if (bindings.has(x)) return { binding: bindings.get(x) };
    if (typeof x !== 'object') throw Error('unsupported checkpoint value: ' + typeof x);
    if (seen.has(x)) return { node: seen.get(x) };
    const id = nodes.length; seen.set(x, id); nodes.push(null);
    let n;
    if (ArrayBuffer.isView(x)) {
      // Indexed elements are encoded through the backing buffer. Additional
      // properties could hide callback state and must never be silently lost.
      if (Object.getOwnPropertySymbols(x).length || Object.getOwnPropertyNames(x).length !==
          (x instanceof DataView ? 0 : x.length)) throw Error('unsupported view properties');
      const type = Buffer.isBuffer(x) ? 'Uint8Array' : x.constructor.name;
      if (!Object.hasOwn(VIEW_TYPES, type)) throw Error('unsupported checkpoint view');
      n = { type: 'view', ctor: type, buffer: ref(x.buffer), offset: x.byteOffset,
        length: x instanceof DataView ? x.byteLength : x.length };
    } else if (x instanceof ArrayBuffer) {
      if (Reflect.ownKeys(x).length) throw Error('unsupported buffer properties');
      n = { type: 'buffer', bytes: new Uint8Array(x).slice() };
    } else if (x instanceof Map) {
      if (Reflect.ownKeys(x).length) throw Error('unsupported map properties');
      n = { type: 'map', items: [...x].map(([k, v]) => [ref(k), ref(v)]) };
    } else if (x instanceof Set) {
      if (Reflect.ownKeys(x).length) throw Error('unsupported set properties');
      n = { type: 'set', items: [...x].map(ref) };
    } else {
      const proto = meta.prototypes.indexOf(Object.getPrototypeOf(x));
      if (!Array.isArray(x) && proto < 0) throw Error('unsupported checkpoint object prototype');
      if (Object.getOwnPropertySymbols(x).length) throw Error('unsupported checkpoint symbol');
      const entries = [];
      for (const k of Object.getOwnPropertyNames(x)) {
        if (Array.isArray(x) && k === 'length') continue;
        const d = Object.getOwnPropertyDescriptor(x, k);
        if (!d.enumerable || !d.writable || !d.configurable || !Object.hasOwn(d, 'value')) {
          throw Error('unsupported checkpoint property: ' + k);
        }
        entries.push([k, ref(d.value)]);
      }
      n = { type: Array.isArray(x) ? 'array' : 'object', proto, entries,
        length: Array.isArray(x) ? x.length : undefined };
    }
    nodes[id] = n;
    return { node: id };
  }
  return { roots: roots.map(x => ref(Object.assign(Object.create(Object.getPrototypeOf(x)), x))), nodes };
}

function unpackGraph(graph, meta) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.roots) || graph.roots.length !== 4) {
    throw Error('invalid checkpoint graph');
  }
  const made = new Map(), building = new Set();
  function ref(r) {
    if (!r || typeof r !== 'object' || Object.keys(r).length !== 1) throw Error('invalid checkpoint reference');
    if (Object.hasOwn(r, 'value')) {
      if (r.value !== null && !['undefined', 'string', 'number', 'boolean', 'bigint'].includes(typeof r.value)) throw Error('invalid checkpoint scalar');
      return r.value;
    }
    if (Object.hasOwn(r, 'binding')) {
      if (!Number.isInteger(r.binding) || r.binding < 0 || r.binding >= meta.bindings.length) throw Error('invalid checkpoint binding');
      return meta.bindings[r.binding];
    }
    const id = r.node;
    if (!Number.isInteger(id) || id < 0 || id >= graph.nodes.length) throw Error('invalid checkpoint node');
    if (made.has(id)) return made.get(id);
    if (building.has(id)) throw Error('cyclic checkpoint buffer');
    building.add(id);
    const n = graph.nodes[id]; let x;
    if (!n || typeof n !== 'object') throw Error('invalid checkpoint node record');
    switch (n.type) {
      case 'buffer':
        if (!(n.bytes instanceof Uint8Array)) throw Error('invalid checkpoint buffer');
        x = n.bytes.slice().buffer; break;
      case 'view': {
        if (!Object.hasOwn(VIEW_TYPES, n.ctor) || !Number.isInteger(n.offset) || n.offset < 0 ||
            !Number.isInteger(n.length) || n.length < 0) throw Error('invalid checkpoint view');
        x = new VIEW_TYPES[n.ctor](ref(n.buffer), n.offset, n.length); break;
      }
      case 'map': x = new Map(); break;
      case 'set': x = new Set(); break;
      case 'array':
        if (!Number.isInteger(n.length) || n.length < 0 || n.length > 0xffffffff) throw Error('invalid checkpoint array');
        x = new Array(n.length); break;
      case 'object':
        if (!Number.isInteger(n.proto) || n.proto < 0 || n.proto >= meta.prototypes.length) throw Error('invalid checkpoint prototype');
        x = Object.create(meta.prototypes[n.proto]); break;
      default: throw Error('unsupported checkpoint node type');
    }
    made.set(id, x);
    if (n.type === 'map') {
      if (!Array.isArray(n.items)) throw Error('invalid checkpoint map');
      for (const e of n.items) {
        if (!Array.isArray(e) || e.length !== 2) throw Error('invalid checkpoint map entry');
        x.set(ref(e[0]), ref(e[1]));
      }
    } else if (n.type === 'set') {
      if (!Array.isArray(n.items)) throw Error('invalid checkpoint set');
      n.items.forEach(e => x.add(ref(e)));
    } else if (n.type === 'object' || n.type === 'array') {
      if (!Array.isArray(n.entries)) throw Error('invalid checkpoint object');
      const keys = new Set();
      for (const e of n.entries) {
        if (!Array.isArray(e) || e.length !== 2 || typeof e[0] !== 'string' || keys.has(e[0]) ||
            (n.type === 'array' && e[0] === 'length')) throw Error('invalid checkpoint property');
        keys.add(e[0]); Object.defineProperty(x, e[0], { value: ref(e[1]), writable: true, enumerable: true, configurable: true });
      }
    }
    building.delete(id); return x;
  }
  const roots = graph.roots.map(ref);
  // Validate even disconnected, late malformed records before any writes.
  graph.nodes.forEach((_, id) => ref({ node: id }));
  return roots;
}

function safeRunner(runner) {
  const meta = RUNNERS.get(runner);
  if (!meta || meta.active || meta.failed || !meta.state.steps) throw Error('checkpoint requires a successful paused DosSession handback');
  for (const root of [meta.machine, meta.session, meta.cache, meta.state]) {
    if (!Object.isExtensible(root) || Object.values(Object.getOwnPropertyDescriptors(root))
      .some(d => !d.enumerable || !d.writable || !d.configurable || !Object.hasOwn(d, 'value'))) {
      throw Error('unsupported destination root');
    }
  }
  const { machine: m, session: s, vm } = runner;
  if (sourceKey() !== loadedSourceKey || vm.exports !== meta.exports || vm.wat !== meta.wat ||
      sha256(vm.bytes) !== meta.module || m !== meta.machine || s !== meta.session || s.cache !== meta.cache ||
      s.vm !== vm || s.machine !== m || m.mem !== vm.mem || m.vmExports !== vm.exports ||
      s.cache.vm !== vm || m.con.mem !== vm.mem || m.audio.m !== m || m.gus.machine !== m ||
      s.cache.wasmDecoder !== (meta.recipe.sessionOptions.wasmDecode === false ? null : vm) ||
      m.log !== NO_LOG || m.fileRoot !== null || m.ioTrace !== null || m.audio.sink !== null ||
      s.cells !== null || Object.values(s.hooks).some(x => x !== undefined) ||
      s.cache.treeFold !== null || s.cache.traceDeadFlags !== null || s.cache.regionAt !== null ||
      s.cache.regionSucc !== null || s.cache.regionBytes !== null || s.cache.uopHeads.size) {
    throw Error('unsupported runner state or changed source/module/callback identity');
  }
  for (const [object, entries] of meta.fixed) {
    if (!v8.serialize(Object.getOwnPropertyNames(object).sort()).equals(v8.serialize(entries.map(([k]) => k).sort())) ||
        entries.some(([k, v, get, set]) => { const d = Object.getOwnPropertyDescriptor(object, k); return !d || d.value !== v || d.get !== get || d.set !== set; })) throw Error('changed callback/prototype ABI');
  }
  for (const [object, saved] of meta.config) {
    if (!isDeepStrictEqual(Object.fromEntries(Object.keys(saved).map(k => [k, object[k]])), saved)) {
      throw Error('changed runner options');
    }
  }
  for (const [k, f] of meta.consoleMethods) if (m.con[k] !== f) throw Error('changed console callback identity');
  return meta;
}

function captureMachine(runner) {
  const meta = safeRunner(runner);
  const body = v8.serialize({ identity: meta.identity, recipe: meta.recipe,
    native: snapshot(runner.vm), host: packGraph([runner.machine, runner.session, runner.session.cache, meta.state], meta) });
  return v8.serialize({ schema: HOST_SCHEMA, sha256: sha256(body), body });
}
function readMachineArchive(bytes) {
  const envelope = v8.deserialize(bytes);
  if (envelope?.schema !== HOST_SCHEMA || !(envelope.body instanceof Uint8Array) ||
      sha256(envelope.body) !== envelope.sha256) throw Error('corrupt DOS-machine checkpoint');
  return v8.deserialize(envelope.body);
}
function restoreMachine(runner, bytes) {
  const meta = safeRunner(runner), record = readMachineArchive(bytes);
  if (!isDeepStrictEqual(record.identity, meta.identity) ||
      !isDeepStrictEqual(record.recipe, meta.recipe)) throw Error('DOS-machine checkpoint identity mismatch');
  const roots = unpackGraph(record.host, meta);
  const targets = [runner.machine, runner.session, runner.session.cache, meta.state];
  const isa = require('./isa'), cache = roots[2], machine = roots[0];
  // Root nodes are staged objects; references to the living roots are named
  // bindings. This lets commit preserve the Machine captured by wasm imports.
  roots.forEach((x, i) => {
    if (!x || Object.getPrototypeOf(x) !== Object.getPrototypeOf(targets[i])) throw Error('checkpoint root type mismatch');
  });
  if (roots[0].mem !== runner.vm.mem || roots[0].vmExports !== runner.vm.exports ||
      roots[1].vm !== runner.vm || roots[1].machine !== runner.machine || roots[1].cache !== runner.session.cache ||
      roots[2].vm !== runner.vm || roots[0].fileRoot !== null || roots[0].audio.sink !== null ||
      roots[1].cells !== null || Object.values(roots[1].hooks).some(x => x !== undefined) ||
      roots[2].treeFold !== null || roots[2].regionAt !== null || roots[2].regionSucc !== null ||
      roots[2].regionBytes !== null || roots[2].traceDeadFlags !== null || roots[2].uopHeads.size ||
      roots[0].ioTrace !== null || roots[0].log !== NO_LOG ||
      machine.con.mem !== runner.vm.mem || machine.audio.m !== runner.machine || machine.gus.machine !== runner.machine ||
      cache.wasmDecoder !== (meta.recipe.sessionOptions.wasmDecode === false ? null : runner.vm) ||
      !(cache.jtab instanceof Int32Array) || cache.jtab.buffer !== runner.vm.mem.buffer ||
      cache.jtab.byteOffset !== isa.JTAB_BASE || cache.jtab.byteLength !== isa.JTAB_SIZE ||
      !(cache.codeBits instanceof Uint8Array) || cache.codeBits.buffer !== runner.vm.mem.buffer ||
      cache.codeBits.byteOffset !== isa.CODE_BITMAP || cache.codeBits.byteLength !== isa.CODE_BITMAP_SIZE ||
      meta.consoleMethods.some(([k, f]) => roots[0].con[k] !== f) ||
      !Number.isSafeInteger(roots[3].steps) || roots[3].steps <= 0 ||
      !Number.isSafeInteger(roots[3].inputIndex) || roots[3].inputIndex < 0 ||
      !Array.isArray(roots[3].inputs) || roots[3].inputIndex > roots[3].inputs.length ||
      !isDeepStrictEqual(roots[3].inputs, meta.recipe.inputs) || roots[3].budget !== meta.recipe.budget) {
    throw Error('unsupported saved runner state');
  }
  for (const [i, [, saved]] of meta.config.entries()) {
    const object = roots[[1, 2, 0][i]];
    if (!isDeepStrictEqual(Object.fromEntries(Object.keys(saved).map(k => [k, object[k]])), saved)) {
      throw Error('saved runner options mismatch');
    }
  }
  for (const target of targets) {
    if (!Object.isExtensible(target) || Object.values(Object.getOwnPropertyDescriptors(target))
        .some(d => !d.writable || !d.configurable || !Object.hasOwn(d, 'value'))) throw Error('unsupported destination root');
  }
  const applyNative = prepareRestore(runner.vm, record.native);
  applyNative();
  roots.forEach((x, i) => {
    for (const k of Object.keys(targets[i])) delete targets[i][k];
    Object.defineProperties(targets[i], Object.getOwnPropertyDescriptors(x));
  });
  return runner;
}

// A bounded, cooperative runner. Its only scheduling state is explicit data;
// host deadlines, screenshots, trace hooks and asynchronous tier installers
// belong to runDos and are deliberately not accepted by this API.
async function createMachineRunner(options) {
  const { Machine, loadExe } = require('./dos');
  const { DosSession } = require('./dos-loop');
  const { makeVm, buildModule } = require('./vm');
  const isa = require('./isa');
  const allowed = ['image', 'name', 'args', 'cpu', 'machineOptions', 'sessionOptions', 'inputs', 'budget', 'files', 'directories', 'currentDirectory', 'floppies'];
  if (!options || Object.keys(options).some(k => !allowed.includes(k)) || !(options.image instanceof Uint8Array)) throw Error('unsupported checkpoint runner options');
  // A detached, data-only recipe is both the fixture identity and fresh-process
  // recovery input. Reject arbitrary functions/host objects before instantiation.
  const plain = x => {
    if (x === null || ['undefined', 'string', 'number', 'boolean'].includes(typeof x)) return;
    if (x instanceof Uint8Array) return;
    if (typeof x !== 'object' || (!Array.isArray(x) && Object.getPrototypeOf(x) !== Object.prototype)) throw Error('unsupported checkpoint option value');
    for (const v of Object.values(x)) plain(v);
  };
  plain(options);
  const recipe = v8.deserialize(v8.serialize({ image: Uint8Array.from(options.image), name: options.name || 'PROGRAM.COM',
    args: options.args || '', cpu: options.cpu ?? 386, machineOptions: options.machineOptions || {}, sessionOptions: options.sessionOptions || {},
    inputs: options.inputs || [], files: options.files || [], directories: options.directories || [], floppies: options.floppies || [],
    currentDirectory: options.currentDirectory || '', budget: options.budget ?? 1000000 }));
  if (![386, 486].includes(recipe.cpu)) throw Error('unsupported checkpoint CPU model');
  const bools = ['noCache', 'smcFlush', 'wasmDecode', 'fuse', 'deadFlags', 'crossFlags', 'traceBlocks',
    'spinLoops', 'regSpec', 'volatileCode', 'pitClock', 'latticeClock', 'irqSchedule', 'intFast', 'edgeLookup', 'smcCensus'];
  const counts = ['slice', 'irqEvery', 'dispatchesPerTick', 'tickScale', 'stuckLimit', 'stuckWork'];
  for (const [k, value] of Object.entries(recipe.sessionOptions)) {
    if ((bools.includes(k) && typeof value !== 'boolean') || (counts.includes(k) &&
        (!Number.isFinite(value) || value < 0 || (['slice', 'irqEvery', 'dispatchesPerTick', 'tickScale'].includes(k) && value === 0)))) {
      throw Error('invalid checkpoint session option');
    }
  }
  const watch = recipe.sessionOptions.watch;
  if (watch !== undefined && (!Array.isArray(watch) || watch.some(e => !Array.isArray(e) || e.length !== 2 ||
      !e.every(Number.isSafeInteger) || e[0] < 0 || e[1] < e[0] || e[1] >= isa.GUEST_RAM_SIZE))) throw Error('invalid checkpoint watch');
  const machineAllowed = ['svga', 'keys', 'env', 'sound', 'gus', 'pspSeg', 'loadSeg', 'forceChained', 'dspVersion'];
  for (const [k, value] of Object.entries(recipe.machineOptions)) {
    if ((k === 'svga' && !['none', 'trident'].includes(value)) ||
        (k === 'sound' && !['full', 'quiet', 'none'].includes(value)) ||
        (['gus', 'forceChained'].includes(k) && typeof value !== 'boolean') ||
        (['pspSeg', 'loadSeg'].includes(k) && (!Number.isInteger(value) || value <= 0 || value > 0xffff)) ||
        (k === 'env' && (!Array.isArray(value) || value.some(x => typeof x !== 'string'))) ||
        (k === 'dspVersion' && (!Array.isArray(value) || value.length !== 2 || value.some(x => !Number.isInteger(x) || x < 0 || x > 255))) ||
        (k === 'keys' && (!Array.isArray(value) || value.some(x => !x ||
          Object.keys(x).some(n => !['ah', 'al'].includes(n)) ||
          ![x.ah, x.al].every(n => Number.isInteger(n) && n >= 0 && n <= 255))))) {
      throw Error('invalid checkpoint machine option');
    }
  }
  const sessionAllowed = ['slice', 'noCache', 'smcFlush', 'wasmDecode', 'fuse', 'deadFlags', 'crossFlags',
    'traceBlocks', 'spinLoops', 'regSpec', 'volatileCode', 'irqEvery', 'dispatchesPerTick', 'tickScale',
    'pitClock', 'stuckLimit', 'stuckWork', 'latticeClock', 'irqSchedule', 'intFast', 'edgeLookup', 'smcCensus', 'watch'];
  if (Object.keys(recipe.machineOptions).some(k => !machineAllowed.includes(k)) ||
      Object.keys(recipe.sessionOptions).some(k => !sessionAllowed.includes(k)) ||
      !Number.isSafeInteger(recipe.budget) || recipe.budget <= 0 || !Array.isArray(recipe.inputs) ||
      recipe.inputs.some((e, i) => !e || !Number.isSafeInteger(e.at) || e.at < 0 ||
        (i && e.at < recipe.inputs[i - 1].at) || !Number.isInteger(e.ah) || e.ah < 0 || e.ah > 255 ||
        !Number.isInteger(e.al) || e.al < 0 || e.al > 255 || Object.keys(e).some(k => !['at', 'ah', 'al'].includes(k)))) throw Error('unsupported checkpoint runner configuration');
  const validPath = s => typeof s === 'string' && /^[A-Za-z0-9_$~!#%&'()@^`{}-]+(?:\.[A-Za-z0-9_$~!#%&'()@^`{}-]+)?(?:\/[A-Za-z0-9_$~!#%&'()@^`{}-]+(?:\.[A-Za-z0-9_$~!#%&'()@^`{}-]+)?)*$/.test(s);
  if (!Array.isArray(recipe.files) || recipe.files.some(e => !Array.isArray(e) || e.length !== 2 ||
      typeof e[0] !== 'string' || !validPath(e[0]) ||
      !(e[1] instanceof Uint8Array)) || new Set(recipe.files.map(e => e[0].toLowerCase())).size !== recipe.files.length) {
    throw Error('checkpoint files must be unique DOS paths and captured bytes');
  }
  const dirs = new Set(['']);
  if (!Array.isArray(recipe.directories) || recipe.directories.some(d => !validPath(d))) throw Error('invalid checkpoint directories');
  for (const name of [...recipe.directories, ...recipe.files.map(([n]) => n)]) {
    const parts = name.toLowerCase().split('/');
    if (!recipe.directories.includes(name)) parts.pop();
    while (parts.length) { dirs.add(parts.join('/')); parts.pop(); }
  }
  if (recipe.files.some(([n]) => dirs.has(n.toLowerCase())) || typeof recipe.currentDirectory !== 'string' ||
      !dirs.has(recipe.currentDirectory.toLowerCase())) throw Error('checkpoint directory/file collision or missing cwd');
  if (sourceKey() !== loadedSourceKey) throw Error('checkpoint sources changed since load');
  require('./decode').setCpuLevel(recipe.cpu);
  // Building also initializes the compiler's handler tables for this exact
  // default native ABI; cached archive bytes alone would skip that work.
  const module = await buildModule('tailcall', { exportAll: true });
  const machine = new Machine(new Uint8Array(1 << 20), { ...recipe.machineOptions, log: NO_LOG });
  if (!Array.isArray(recipe.floppies) || recipe.floppies.some(e => !Array.isArray(e) || e.length !== 2 ||
      !['A', 'B'].includes(e[0]) || !(e[1] instanceof Uint8Array)) ||
      new Set(recipe.floppies.map(e => e[0])).size !== recipe.floppies.length) throw Error('invalid runner floppy mounts');
  for (const [drive, image] of recipe.floppies) machine.changeDisk(drive, image);
  const vm = await makeVm('tailcall', { ...module,
    portIn: (p, w) => machine.portIn(p, w), portOut: (p, v, w) => machine.portOut(p, v, w) });
  vm.exports.set_cpu(recipe.cpu); machine.setMemory(vm.mem, vm.exports);
  machine.virtualDirectories = dirs;
  machine.currentDirectory = recipe.currentDirectory.toLowerCase();
  machine.syncVga(); // Match runDos power-on setup before the first guest slice.
  for (const [name, bytes] of recipe.files) machine.tempFiles.set(machine.fileKey('\\' + name),
    { data: Uint8Array.from(bytes), len: bytes.length });
  const info = loadExe(vm.mem, Buffer.from(recipe.image), { loadSeg: machine.loadSeg, pspSeg: machine.pspSeg });
  if (info.allocTop !== undefined) machine.allocTop = info.allocTop;
  machine.imageTop = info.minTop;
  machine.installEnvironment(recipe.name, recipe.args); machine.installArena();
  vm.setAll({ cs: info.cs, ip: info.ip, ss: info.ss, sp: (info.sp - 2) & 0xffff,
    ds: info.ds, es: info.es, flags: vm.exports.mget_f_res() | (1 << isa.F.IF) });
  const sp = ((info.ss << 4) + ((info.sp - 2) & 0xffff)) & 0xfffff;
  vm.mem[sp] = 0; vm.mem[sp + 1] = 0;
  const session = new DosSession(vm, machine, recipe.sessionOptions);
  session.endAt = recipe.budget;
  const state = { steps: 0, inputIndex: 0, inputs: recipe.inputs, budget: recipe.budget };
  const runner = { vm, machine, session,
    changeDisk(drive, image) {
      if (meta.active || meta.failed) throw Error('runner is active or failed');
      return machine.changeDisk(drive, image);
    },
    step() {
      if (meta.active || meta.failed) throw Error('runner is active or failed');
      if (session.dispatched >= state.budget && !session.owesEnd(state.budget)) return 'done';
      meta.active = true;
      try {
        require('./decode').setCpuLevel(recipe.cpu);
        require('./compile').setPortSpin(true);
        while (state.inputIndex < state.inputs.length && state.inputs[state.inputIndex].at <= session.dispatched) {
          const e = state.inputs[state.inputIndex++]; machine.pushKey(e.ah, e.al);
        }
        const why = session.step(); state.steps++; return why;
      } catch (e) { meta.failed = true; throw e; }
      finally { meta.active = false; }
    },
    capture() { return captureMachine(runner); },
    restore(bytes) { return restoreMachine(runner, bytes); },
  };
  const consoleMethods = Object.entries(machine.con).filter(([, v]) => typeof v === 'function');
  const configs = [
    [session, ['slice', 'latticeClock', 'irqSchedule', 'intFast', 'edgeLookup', 'mouse', 'irqEvery',
      'dispatchesPerTick', 'tickScale', 'pitClock', 'stuckLimit', 'stuckWork']],
    [session.cache, ['noCache', 'smcFlush', 'watch', 'fuse', 'deadFlags', 'crossFlags', 'traceBlocks',
      'spinLoops', 'regSpec', 'volatileCode', 'regionCodeBits']],
    [machine, ['svga', 'sound', 'pspSeg', 'loadSeg', 'forceChained', 'dspVersion', 'extraEnv']],
  ];
  const meta = { machine, session, cache: session.cache, exports: vm.exports, wat: vm.wat, module: sha256(vm.bytes),
    recipe, state, active: false, failed: false, consoleMethods,
    prototypes: prototypeTable(machine, session),
    fixed: prototypeTable(machine, session).filter(p => p && p !== Object.prototype)
      .map(p => [p, Object.entries(Object.getOwnPropertyDescriptors(p)).map(([k, d]) => [k, d.value, d.get, d.set])]),
    config: configs.map(([object, keys]) => [object, v8.deserialize(v8.serialize(Object.fromEntries(keys.map(k => [k, object[k]]))))]),
    // Roots themselves are encoded as objects at the top and bound by identity
    // for every back-reference reached while walking their properties.
    bindings: [vm, vm.exports, vm.mem.buffer, vm.mem, machine, session, session.cache, state, NO_LOG,
      ...consoleMethods.map(([, f]) => f)],
    identity: { schema: HOST_SCHEMA, sources: loadedSource, module: sha256(vm.bytes), wat: sha256(vm.wat),
      recipe: sha256(JSON.stringify(recipe, (_, value) => value instanceof Uint8Array
        ? { bytes: Buffer.from(value).toString('base64') } : value)) },
  };
  RUNNERS.set(runner, meta);
  return runner;
}
async function resumeMachineRunner(bytes) {
  const record = readMachineArchive(bytes);
  // Reject foreign source identity before constructing any destination VM.
  if (!record.identity || !isDeepStrictEqual(record.identity.sources, loadedSource)) throw Error('DOS-machine checkpoint source identity mismatch');
  const runner = await createMachineRunner(record.recipe);
  // The fresh destination has no handback yet; permit restore only here, where
  // the factory owns a fully initialized, never-entered instance.
  RUNNERS.get(runner).state.steps = 1;
  return restoreMachine(runner, bytes);
}

module.exports = { snapshot, restore, createMachineRunner, resumeMachineRunner };
