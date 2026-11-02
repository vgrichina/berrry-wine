'use strict';

// Native VM state only. Host devices, DosSession, CodeCache and imported
// callbacks need their own checkpoint; this is not a DOS-machine save state.
// Requires makeVm(..., { exportAll: true }) and the exact emitted WAT/bytes.
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

function restore(vm, state) {
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
  vm.mem.set(memory);
  globals.forEach((g, i) => { if (g.mutable) vm.exports[g.name].value = values[i]; });
  handlers.forEach((fn, i) => table.set(i, fn));
  return vm;
}

module.exports = { snapshot, restore };
