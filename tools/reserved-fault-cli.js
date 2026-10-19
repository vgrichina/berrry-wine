'use strict';
const fs = require('node:fs'), path = require('node:path');
const { snapshotReservedFault, createReservedFaultObserver } = require('./reserved-fault-observer');

// This adapter owns termination, not a runner catch block that might inspect
// guest memory or resume execution after an exception unwinds active SEH.
function installReservedFaultCli({ exports, memory, layout, ctx, directory, terminate = code => process.exit(code), io = fs }) {
  function save(name, data, flag = 'w') {
    const text = JSON.stringify(data) + '\n';
    if (Buffer.byteLength(text) > 3 * 1024 ** 2) throw Error('Reserved fault artifact exceeds 3 MiB');
    if (name === 'observer-pending.json') {
      const tmp = path.join(directory, 'observer-pending.tmp');
      io.writeFileSync(tmp, text, { flag: 'wx' });
      io.renameSync(tmp, path.join(directory, name));
    } else io.writeFileSync(path.join(directory, name), text, { flag });
  }
  function stop(error) {
    let code = error?.code === 'RESERVED_FAULT_CAPTURED' ? 0 : 1;
    try { save('observer-terminal.json', { code, scope: 'main-instance-only', captured: code === 0, error: String(error?.stack || error) }, 'wx'); }
    catch (_) { code = 1; }
    terminate(code);
    throw Error('Terminal observer shutdown returned; guest must never resume');
  }
  try {
    if (typeof exports.set_reserved_fault_observer !== 'function' || typeof exports.get_reserved_fault_observer !== 'function') throw Error('Observer requires a coherent rebuilt module');
    if (!path.isAbsolute(directory) || !io.statSync(directory).isDirectory()) throw Error('Observer requires an existing absolute evidence directory');
    // Refuse stale/reused evidence before arming; pending is replaced only
    // after the synchronous snapshot succeeds, preserving the previous one.
    save('observer-start.json', { scope: 'main-instance-only', atomic: false }, 'wx');
    for (const name of ['observer-pending.json', 'observer-pending.tmp', 'observer-capture.json', 'observer-terminal.json']) if (io.existsSync(path.join(directory, name))) throw Error('Existing observer evidence: ' + name);
    const observe = createReservedFaultObserver({
      snapshot: event => snapshotReservedFault(exports, memory, layout, event),
      checkpoint: data => save('observer-pending.json', data),
      save: data => save('observer-capture.json', data, 'wx'),
    });
    ctx.reservedFaultObserver = event => { try { observe(event); } catch (error) { stop(error); } };
    exports.set_reserved_fault_observer(1);
  } catch (error) { stop(error); }
}
module.exports = { installReservedFaultCli };
