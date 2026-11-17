// Fault injection ONLY for test-controller-production.py's Solitaire runtime.
// The actual run.js producer, guarded input, renderer and HTTP server execute.
// No fixture code is loaded in the original LBreakout process.
'use strict';
const transport = require('../../lib/control-server');
const original = transport.startControlServer;
transport.startControlServer = options => original({ ...options, onCommand(command) {
  const pending = options.onCommand(command);
  if (command.action !== 'guarded-input') return pending;
  let injected;
  if (command.cmd === 'keydown:32')
    injected = Promise.resolve(pending).then(() => new Promise(() => {}));
  else if (command.cmd === 'keydown:78')
    injected = Promise.resolve(pending).then(value => new Promise(resolve => setTimeout(() => resolve(value), 180)));
  else return pending;
  if (pending?.cancel) injected.cancel = pending.cancel.bind(pending);
  return injected;
} });
