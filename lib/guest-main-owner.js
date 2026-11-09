'use strict';

// The CLI is migrating its main guest from a local instance to the same
// owning Worker used by the browser. Never substitute the host shadow's
// exports for a missing Worker operation: its registers are not the guest's.
// Callers await every operation; local execution deliberately remains inline
// so synchronous host imports retain their existing observation/order.
function createGuestMainOwner({ localExports, worker } = {}) {
  if (!!localExports === !!worker) throw new Error('choose exactly one guest main owner');
  if (worker) {
    for (const method of ['callExport', 'readExports', 'slice'])
      if (typeof worker[method] !== 'function') throw new Error('missing Worker owner method: ' + method);
    return Object.freeze({
      kind: 'worker',
      call: (name, ...args) => worker.callExport(name, ...args),
      read: names => worker.readExports(names),
      run: (steps, sync) => worker.slice(steps, sync),
    });
  }
  if (typeof localExports.run !== 'function') throw new Error('missing local guest run export');
  return Object.freeze({
    kind: 'local',
    call(name, ...args) {
      if (typeof localExports[name] !== 'function') throw new Error('missing guest export: ' + name);
      return localExports[name](...args);
    },
    read(names) {
      const result = {};
      for (const name of names)
        result[name] = typeof localExports[name] === 'function' ? localExports[name]() >>> 0 : null;
      return result;
    },
    run: steps => localExports.run(steps),
  });
}

module.exports = { createGuestMainOwner };
