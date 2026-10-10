'use strict';
// Intentionally ignore init messages so the parent can prove stop rejects the
// readiness wait and clears its 20-second timer.
require('worker_threads').parentPort.on('message', () => {});
