'use strict';

const fs = require('node:fs/promises');

// Chrome can publish DevToolsActivePort after ten seconds under ptrace. Wait
// for a complete endpoint within the caller's immutable startup budget.
async function waitForDevTools({file, browser, deadline, pollMs = 100, record = () => {}}) {
  if (!Number.isFinite(deadline) || deadline <= Date.now() || !Number.isFinite(pollMs) || pollMs <= 0) {
    throw Error('invalid DevTools startup deadline');
  }
  const began = Date.now();
  let last = 'not published';
  while (Date.now() < deadline) {
    if (browser.exitCode !== null || browser.signalCode !== null) {
      throw Error('Chrome terminated before DevTools readiness; no replay');
    }
    try {
      const text = await fs.readFile(file, 'utf8');
      const lines = text.trim().split('\n');
      const port = Number(lines[0]);
      if (lines.length === 2 && /^\d+$/.test(lines[0]) && Number.isInteger(port) && port > 0 && port < 65536 &&
          /^\/devtools\/browser\/[A-Za-z0-9-]+$/.test(lines[1])) {
        if (Date.now() >= deadline) break;
        const value = {debugPort: port, browserPath: lines[1], elapsedMs: Date.now() - began};
        record({kind: 'devtools-ready', ...value});
        return value;
      }
      last = 'incomplete or invalid endpoint';
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      last = 'not published';
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(pollMs, Math.max(1, deadline - Date.now()))));
  }
  const error = Error('DevTools startup deadline; ' + last + '; no replay');
  record({kind: 'devtools-startup-timeout', elapsedMs: Date.now() - began, deadline, last, noReplay: true});
  throw error;
}

module.exports = {waitForDevTools};
