'use strict';

const neSourceImage = typeof require === 'function' ? require('./ne-image') : globalThis.NeImage;
const neSourceErrors = typeof require === 'function' ? require('./ne-load-error') : globalThis.NeLoadErrorApi;

function canonicalNeName(path) {
  if (typeof path !== 'string' || !path.length || path.length > 260 || /[\x00-\x1f]/.test(path))
    throw new TypeError('Invalid NE library path');
  const name = path.replace(/^.*[\\/]/, '').replace(/^[A-Za-z]:/, '').replace(/\.dll$/i, '').toUpperCase();
  if (!/^[A-Z0-9_$-]{1,15}$/.test(name)) throw new TypeError('Invalid NE module name');
  return name;
}

// Resolve and copy the entire closure before taking a guest execution lease.
// findSource uses the process VFS/search policy; the identity used by the NE
// transaction remains the canonical basename, including across guest threads.
// This function never awaits and never holds a guest frame. A promise from the
// resolver is a diagnostic unsupported operation, not a missing-file result.
function prepareNeSources(path, findSource, liveModule = () => false) {
  if (typeof findSource !== 'function') throw new TypeError('NE source resolver required');
  const root = canonicalNeName(path), images = new Map(), active = new Set();
  const visit = (name, fullPath) => {
    if (active.has(name)) throw new Error('Unsupported recursive NE dependency ' + name);
    if (images.has(name) || liveModule(name)) return;
    if (images.size >= 24) throw new Error('NE dependency closure exceeds module capacity');
    const source = findSource(name.toLowerCase() + '.dll', fullPath);
    if (source && typeof source.then === 'function')
      throw new Error('Asynchronous NE source lookup requires an owned settlement protocol');
    if (source == null) throw new neSourceErrors.NeLoadError(2, 'Missing NE image ' + name);
    const image = neSourceImage.inspectNeDll(source);
    images.set(name, image);
    active.add(name);
    const directory = fullPath.replace(/[^\\/]*$/, '') || (/^[A-Za-z]:/.test(fullPath) ? fullPath.slice(0,2) : '');
    for (const dependency of image.dependencies) {
      const dep = canonicalNeName(dependency);
      if (!neSourceImage.neBuiltinDependency(dep)) visit(dep, directory + dep.toLowerCase() + '.dll');
    }
    active.delete(name);
    for (const imported of image.imports) {
      const dep = canonicalNeName(imported.module);
      if (neSourceImage.neBuiltinDependency(dep)) {
        if (typeof imported.symbol === 'string') throw new Error('Named builtin NE imports require importer-owned name resolution: '+dep+'.'+imported.symbol);
        continue;
      }
      if (liveModule(dep, imported.symbol)) continue;
      const target = images.get(dep);
      if (!target) throw new neSourceErrors.NeLoadError(null, 'Missing NE import ' + dep + '.' + imported.symbol);
      const ordinal = typeof imported.symbol === 'string'
        ? target.names.get(imported.symbol.toUpperCase()) : imported.symbol;
      if (!target.entries.has(ordinal))
        throw new neSourceErrors.NeLoadError(null, 'Missing NE import ' + dep + '.' + imported.symbol);
    }
  };
  visit(root, /\.dll$/i.test(path) ? path : path + '.dll');
  return { name: root, sources: new Map([...images].map(([name, image]) => [name, image.bytes])) };
}

const neSourcesApi = { canonicalNeName, prepareNeSources };
if (typeof module !== 'undefined' && module.exports) module.exports = neSourcesApi;
else globalThis.NeSources = neSourcesApi;
