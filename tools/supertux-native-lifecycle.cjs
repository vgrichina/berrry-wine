'use strict';

const path = require('node:path');
const {waitForDevTools} = require('./native-devtools-ready.cjs');
const {closeBrowser} = require('./native-browser-close.cjs');

// The retained SuperTux browser used 100 polls, which expired while traced
// Chrome was still publishing its endpoint. Use the accepted native consumer,
// bounded by the original runtime deadline; this never launches/retries Chrome.
async function ready({browser, profile, deadline, record = () => {}}) {
  const began = Date.now();
  if (!Number.isFinite(deadline) || deadline <= began) throw Error('expired SuperTux runtime; no replay');
  const startupDeadline = Math.min(deadline, began + 120000);
  record({kind: 'supertux-startup-budget', began, deadline, startupDeadline});
  return waitForDevTools({file: path.join(profile, 'DevToolsActivePort'), browser,
    deadline: startupDeadline, record});
}

// A CDP reply or exit event alone cannot authorize profile removal or quit ACK.
// The accepted consumer observes terminal status AND closed stdio, including
// after escalation. The caller retains its independent box deadline watchdog.
async function close({browser, requestClose, record = () => {}}) {
  return closeBrowser({browser, requestClose, record});
}

module.exports = {ready, close};
