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
    // Capabilities belong to this endpoint's compiled module, not to a local
    // shadow or a failed RPC. Missing metadata is an error, not "unsupported".
    const functions = worker.module instanceof WebAssembly.Module
      ? new Set(WebAssembly.Module.exports(worker.module).filter(e => e.kind === 'function').map(e => e.name)) : null;
    const supports = name => {
      if (!functions) throw new Error('Worker module required for capability query');
      return functions.has(name);
    };
    return Object.freeze({
      kind: 'worker',
      supports,
      optionalCall: (name, ...args) => supports(name) ? worker.callExport(name, ...args) : undefined,
      call: (name, ...args) => worker.callExport(name, ...args),
      read: names => worker.readExports(names),
      run: (steps, sync) => worker.slice(steps, sync),
      resumeMessageWait(hostInput) {
        if (typeof worker.resumeMainMessageWait !== 'function') throw new Error('missing Worker message resume');
        return worker.resumeMainMessageWait(!!hostInput);
      },
      loadDlls(exeBytes, configs, log, options) {
        if (typeof worker.loadDlls !== 'function') throw new Error('missing Worker DLL loader');
        // The Worker host marshals metadata and retains resource callbacks on
        // the host. Guest entry and rollback stay beside its owning instance.
        return worker.loadDlls(configs, exeBytes, options);
      },
    });
  }
  if (typeof localExports.run !== 'function') throw new Error('missing local guest run export');
  return Object.freeze({
    kind: 'local',
    supports: name => typeof localExports[name] === 'function',
    optionalCall: (name, ...args) => typeof localExports[name] === 'function' ? localExports[name](...args) : undefined,
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
    resumeMessageWait(hostInput) {
      if (localExports.get_yield_reason() !== 7) return {resumed:false};
      if (!localExports.has_pending_message?.() && !hostInput) return {resumed:false};
      // Return targets can live in a DLL, outside the EXE's code bounds.
      const ret = localExports.guest_read32(localExports.get_esp()) >>> 0;
      const resumed = !!localExports.resume_message_wait?.();
      if (resumed) localExports.set_eip(ret);
      return {resumed};
    },
    loadDlls: (exeBytes, configs, log, options) => require('./dll-loader').loadDllsAsync(
      localExports, localExports.memory.buffer, exeBytes, configs, log, options),
  });
}

module.exports = { createGuestMainOwner };
