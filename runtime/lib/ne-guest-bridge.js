'use strict';
const neGuestSources = typeof require === 'function' ? require('./ne-sources') : globalThis.NeSources;
const neGuestLifecycle = typeof require === 'function' ? require('./ne-lifecycle') : globalThis.NeLifecycle;
const neGuestErrors = typeof require === 'function' ? require('./ne-load-error') : globalThis.NeLoadErrorApi;
const neGuestInvoke = typeof require === 'function' ? require('./ne-invoke') : globalThis.NeInvoke;

function readNeGuestString(e, memoryBuffer, address, limit) {
  if (!address || address > 0xffffffff - limit) throw new RangeError('Invalid NE guest string pointer');
  const memory = new Uint8Array(memoryBuffer);
  let result = '';
  // Translate every byte: an ANSI name can cross noncontiguous sparse pages.
  for (let i = 0; i <= limit; i++) {
    const at = e.guest_to_wasm(address + i) >>> 0;
    if (at === 0xf0 || at >= memory.length) throw new RangeError('Unmapped NE guest string');
    const ch = memory[at];
    if (!ch) return result;
    result += String.fromCharCode(ch);
  }
  throw new RangeError('Unterminated NE guest string');
}

// This service executes entirely in the live caller's synchronous turn. The
// process-owned native module table is the persistent identity/refcount owner;
// a coordinator is only a scoped view of it, never an alternate JS module map.
// Lock order: caller's PE callback gate, then short NE scopes, then DLL mutex.
// No await or scheduler borrowing occurs while any NE execution lease is held.
function serviceNeGuestYieldSync(opts) {
  const e = opts?.exports;
  if (!e || e.get_yield_reason() !== 18) return false;
  if (opts.neBackend === 'worker') throw new Error('Worker NE guest lifecycle is not implemented');
  const token = e.win16_guest_request_token();
  if (!e.win16_guest_request_valid(token)) throw new Error('Stale NE guest request');
  const operation = e.win16_guest_request_field(token, 0);
  const arg0 = e.win16_guest_request_field(token, 1) >>> 0;
  const arg1 = e.win16_guest_request_field(token, 2) >>> 0;
  if (operation === 4) {
    neGuestInvoke.invokeNeQtSync(e,token,arg0,opts.neInvokeOptions);
    return true;
  }
  const memory = {buffer: opts.memoryBuffer};
  const lifecycle = neGuestLifecycle.createNeLifecycle(e, memory, [], opts.neInvokeOptions);
  let value = 0;
  try {
    if (operation === 1) {
      if (!arg0) value = 0; // LoadModule16(NULL, ...) returns zero.
      else {
        const path = readNeGuestString(e, opts.memoryBuffer, arg0, 260);
        const name = neGuestSources.canonicalNeName(path);
        value = lifecycle.retainGuest(name);
        if (!value) {
          const prepared = neGuestSources.prepareNeSources(path, opts.findDllSync, lifecycle.liveModule);
          value = neGuestLifecycle.createNeLifecycle(e, memory, prepared.sources, opts.neInvokeOptions).loadGuest(prepared.name);
        }
      }
    } else if (operation === 2) {
      lifecycle.releaseGuest(arg0);
    } else if (operation === 3) {
      const symbol = arg1 >>> 16 ? readNeGuestString(e, opts.memoryBuffer, arg1, 255) : arg1;
      value = typeof symbol === 'string' && (!symbol.length || /[^\x20-\x7e]/.test(symbol))
        ? 0 : lifecycle.lookupGuest(arg0, symbol);
    } else throw new Error('Unknown NE guest lifecycle operation ' + operation);
  } catch (error) {
    if (operation === 1 && error instanceof neGuestErrors.NeLoadError && error.guestCode !== null) value = error.guestCode;
    else {
      // Failed WEP ownership remains with this exact exports facade. Recovery
      // is diagnostic and explicit; never retry it just to complete FreeLibrary.
      if (error.pendingTerminations?.length) error.neRecovery = Object.freeze({
        modules: error.pendingTerminations,
        retry: id => {
          // A failing enclosing DllMain may already have restored its caller's
          // EIP/ESP. Recovery still belongs to this request and live facade;
          // cancellation/process reset or replacement invalidates its token.
          if (e.win16_guest_request_token() !== token) throw new Error('Stale NE termination recovery');
          if (!error.pendingTerminations.includes(id)) throw new Error('Unowned NE termination retry');
          lifecycle.retryTermination(id);
        },
      });
      throw error;
    }
  }
  if (!e.win16_guest_request_valid(token) || !e.win16_guest_request_settle(token, value))
    throw new Error('NE guest settlement rejected');
  return true;
}

const neGuestBridgeApi = {readNeGuestString, serviceNeGuestYieldSync};
if (typeof module !== 'undefined' && module.exports) module.exports = neGuestBridgeApi;
else globalThis.NeGuestBridge = neGuestBridgeApi;
