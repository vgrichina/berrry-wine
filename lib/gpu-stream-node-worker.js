'use strict';

// The render instance never enters guest code or shares its allocator with the
// guest. Only the published ring/arena and completion slots cross this boundary.
const { workerData: d, parentPort } = require('node:worker_threads');
const GS = require('./gpu-stream');
const { Executor } = require('./gpu-stream-software');
const control = new Int32Array(d.control);
let executor, failed;
function reply(message) { d.port.postMessage(message); }
try {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = {};
  for (const entry of WebAssembly.Module.imports(d.module)) {
    const ns = imports[entry.module] ||= {};
    if (entry.kind === 'memory') ns[entry.name] = memory;
    else if (entry.kind === 'function') ns[entry.name] = () => {
      throw new Error('Unexpected render-owner import ' + entry.module + '.' + entry.name);
    };
    else throw new Error('Unsupported render-owner import ' + entry.kind);
  }
  const instance = new WebAssembly.Instance(d.module, imports);
  executor = new Executor({ getExports: () => instance.exports,
    getMemory: () => memory.buffer, onPresent: frame => reply({ frame }) });
  reply({ ready: true });
} catch (error) { failed = error; reply({ error: error.stack }); }
Atomics.store(control, 0, failed ? -1 : 1);
Atomics.notify(control, 0);

d.port.on('message', ({ ring, mode, id }) => {
  try {
    if (failed) throw failed;
    const result = GS.drain([new GS.Ring(() => d.memory, ring)], executor);
    reply({ id, records: result.records, stats: executor.stats() });
    if (mode === 2) executor.close();
  } catch (error) { failed = error; reply({ id, error: error.stack }); }
  // Messages precede completion: a synchronous waiter can collect every frame
  // and the exact exception before returning through its i32 import.
  Atomics.store(control, 1, id);
  Atomics.notify(control, 1);
  if (mode === 2 || failed) { d.port.close(); parentPort.close(); }
});
