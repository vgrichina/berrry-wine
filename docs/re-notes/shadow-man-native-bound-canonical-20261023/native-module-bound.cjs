'use strict';
// Task-owned execution restriction. No source, buffer, options, or output edits.
const LIMIT = 8388608;
const getter = (prototype, name) => Object.getOwnPropertyDescriptor(prototype, name)?.get;
const abLength = getter(ArrayBuffer.prototype, 'byteLength');
const abResizable = getter(ArrayBuffer.prototype, 'resizable');
const sabLength = typeof SharedArrayBuffer === 'undefined' ? null : getter(SharedArrayBuffer.prototype, 'byteLength');
const sabGrowable = typeof SharedArrayBuffer === 'undefined' ? null : getter(SharedArrayBuffer.prototype, 'growable');
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const typedBuffer = getter(typed, 'buffer'), typedLength = getter(typed, 'byteLength');
const dataBuffer = getter(DataView.prototype, 'buffer'), dataLength = getter(DataView.prototype, 'byteLength');
const call = Reflect.apply, construct = Reflect.construct;
function probe(fn, value) {
  if (!fn) return null;
  try { return { value: call(fn, value, []) }; } catch { return null; }
}
function storage(buffer) {
  const ab = probe(abLength, buffer);
  if (ab) {
    if (abResizable && call(abResizable, buffer, [])) throw new TypeError('native-module-bound: resizable storage is not admitted');
    return ab.value;
  }
  const sab = probe(sabLength, buffer);
  if (sab) {
    if (sabGrowable && call(sabGrowable, buffer, [])) throw new TypeError('native-module-bound: growable storage is not admitted');
    return sab.value;
  }
  throw new TypeError('native-module-bound: unknown BufferSource storage');
}
function byteLength(source) {
  // Intrinsic brand checks ignore overridden properties and preserve view offsets.
  const view = probe(typedBuffer, source) || probe(dataBuffer, source);
  if (view) {
    storage(view.value);
    const length = probe(typedLength, source) || probe(dataLength, source);
    if (!length) throw new TypeError('native-module-bound: unknown BufferSource view');
    return length.value;
  }
  return storage(source);
}
function guardConstructor(NativeModule) {
  return new Proxy(NativeModule, {
    construct(target, args, newTarget) {
      const n = byteLength(args[0]);
      if (!Number.isSafeInteger(n) || n < 0 || n > LIMIT) {
        throw new RangeError(`native-module-bound: ${n} bytes exceeds ${LIMIT}`);
      }
      return construct(target, args, newTarget);
    },
  });
}
module.exports = { guardConstructor, LIMIT };
WebAssembly.Module = guardConstructor(WebAssembly.Module);
