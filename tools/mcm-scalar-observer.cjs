'use strict';

// Run-local MCM diagnostics. Never traverse a host object or call its toJSON.
// Keep this factory self-contained so the browser driver can inject it verbatim.
function createScalarObserver(write, limit = 96) {
  const ids = new WeakMap();
  let serial = 0, count = 0, disabled = false;
  function scalar(value) {
    if (value === null || value === undefined) return null;
    switch (typeof value) {
      case 'boolean': return value;
      case 'number': return Number.isFinite(value) ? value : null;
      case 'string': return value.slice(0, 160);
      case 'bigint': return BigInt.prototype.toString.call(value).slice(0, 80);
      case 'object': case 'function':
        if (!ids.has(value)) ids.set(value, ++serial);
        return 'identity:' + ids.get(value);
      default: return null;
    }
  }
  function observe(select) {
    if (disabled || count >= limit) return;
    try {
      // Only explicitly selected own data fields enter serialization. Even
      // the projection cannot smuggle in a live object, cycle, SAB or getter.
      const selected = select(), row = Object.create(null);
      const keys = Object.keys(selected);
      if (keys.length > 64) throw new Error('scalar field limit');
      for (const key of keys) {
        const field = Object.getOwnPropertyDescriptor(selected, key);
        if (!field || !Object.hasOwn(field, 'value')) throw new Error('diagnostic getter');
        row[key.slice(0, 80)] = scalar(field.value);
      }
      ++count;
      const written = write(JSON.stringify(row));
      if (written instanceof Promise)
        Promise.prototype.then.call(written, undefined, () => { disabled = true; });
    } catch { disabled = true; }
  }
  function wrap(original, select) {
    return function (...args) {
      observe(() => select('before', args, undefined, false));
      let result;
      try { result = Reflect.apply(original, this, args); }
      catch (thrown) {
        observe(() => select('throw', args, thrown, true));
        throw thrown;
      }
      observe(() => select('after', args, result, false));
      return result;
    };
  }
  // Call after a callback's real installation; do not reserve an empty slot
  // which the runtime will subsequently overwrite.
  function install(target, name, select) {
    try {
      if (typeof target[name] !== 'function') return false;
      target[name] = wrap(target[name], select);
      return true;
    } catch { disabled = true; return false; }
  }
  return { scalar, observe, wrap, install, disabled: () => disabled, count: () => count };
}

module.exports = { createScalarObserver };
