'use strict';
// Read-only: records actual admission and actual scheduler entries. No gate
// writes, guest runs, clock calls, callbacks, or promise replacement.
const path = require('node:path');
const loader = require(path.join(process.cwd(), 'lib/dll-loader'));
const acquire = loader.acquireDllCallbackGate;
loader.acquireDllCallbackGate = function(e, ...args) {
  if (e.get_dll_callback_lock) {
    const gate = Array.from(new Int32Array(e.memory.buffer, e.get_dll_callback_lock(), 2));
    const caller = e.get_dll_callback_owner();
    if (gate[0] && gate[0] !== caller) console.log('[cli-gate] ' + JSON.stringify({caller, gate, eip:e.get_eip(), yield:e.get_yield_reason()}));
  }
  return acquire.call(this, e, ...args);
};
