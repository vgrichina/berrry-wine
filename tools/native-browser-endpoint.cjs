'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

// Custody can delay Chrome's fork/exec startup. Read readiness rather than
// assuming that a fixed number of timer ticks means the endpoint exists.
async function waitForBrowserEndpoint({profile, browser, deadline,
  startupTimeoutMs = 120000, pollMs = 100, record = () => {}, validateEndpoint = () => true}) {
  const started = Date.now();
  if (!Number.isFinite(deadline) || deadline <= started ||
      !Number.isFinite(startupTimeoutMs) || startupTimeoutMs <= 0 ||
      !Number.isFinite(pollMs) || pollMs <= 0) {
    throw new Error('invalid or expired browser startup deadline');
  }
  const due = Math.min(deadline, started + startupTimeoutMs);
  const file = path.join(profile, 'DevToolsActivePort');
  let previous;
  const alive = () => {
    if (browser.exitCode !== null || browser.signalCode !== null) {
      throw new Error(`Chrome exited before DevTools readiness: code=${browser.exitCode} signal=${browser.signalCode}`);
    }
  };
  while (Date.now() < due) {
    alive();
    let bytes;
    try {
      bytes = await fs.readFile(file);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    // Preserve exact observed bytes before the caller removes its profile.
    // Only changed snapshots are emitted; a missing file differs from empty.
    const rawBase64 = bytes === undefined ? null : bytes.toString('base64');
    if (rawBase64 !== previous) {
      record({kind: 'devtools-publication', at: Date.now(), file,
        rawBase64, size: bytes?.length ?? null});
      previous = rawBase64;
    }
    alive();
    if (bytes !== undefined) {
      const lines = bytes.toString('utf8').trim().split('\n');
      if (Date.now() >= due) break;
      const port = Number(lines[0]);
      if (lines.length === 2 && /^\d+$/.test(lines[0]) &&
          Number.isInteger(port) && port > 0 && port <= 65535 &&
          /^\/devtools\/browser\/[^\s/]+$/.test(lines[1]) &&
          validateEndpoint({debugPort: port, browserPath: lines[1]})) {
        return {debugPort: port, browserPath: lines[1]};
      }
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(pollMs, Math.max(1, due - Date.now()))));
  }
  throw new Error(`Chrome DevTools readiness timed out after ${Date.now() - started}ms within immutable deadline`);
}

module.exports = {waitForBrowserEndpoint};
