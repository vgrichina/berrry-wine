'use strict';

const fs = require('node:fs');
const { setTimeout: wait } = require('node:timers/promises');

function parseActivePort(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines.length !== 2 || !/^[1-9][0-9]{0,4}$/.test(lines[0]) ||
      Number(lines[0]) > 65535 || !/^\/devtools\/browser\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lines[1])) {
    throw new Error('expected port 1..65535 and /devtools/browser/<uuid> on two complete lines');
  }
  const debugPort = Number(lines[0]), browserPath = lines[1];
  return { debugPort, browserPath, url: `ws://127.0.0.1:${debugPort}${browserPath}` };
}

async function waitForEndpoint(file, browser, { deadline, timeoutMs = 10000, pollMs = 25 } = {}) {
  const stop = Math.min(Date.now() + timeoutMs, deadline ?? Infinity);
  let reason = 'file missing', attempts = 0;
  while (Date.now() < stop) {
    if (browser.exitCode !== null || browser.signalCode != null) {
      throw new Error(`DevTools endpoint unavailable: Chrome exited (${browser.exitCode ?? browser.signalCode}); ${reason}`);
    }
    attempts++;
    try {
      // Chrome creates this file before both lines are necessarily visible.
      // Reread a fresh snapshot; never serialize a partial endpoint or try it.
      const endpoint = parseActivePort(fs.readFileSync(file, 'utf8'));
      return { ...endpoint, attempts };
    } catch (error) {
      if (error.code && error.code !== 'ENOENT') {
        throw new Error(`DevTools endpoint read failed (${file}): ${error.message}`, { cause: error });
      }
      reason = error.code === 'ENOENT' ? 'file missing' : error.message;
    }
    await wait(Math.min(pollMs, Math.max(0, stop - Date.now())));
  }
  throw new Error(`DevTools endpoint not ready (${file}): ${reason}; startup deadline reached after ${attempts} reads; no WebSocket attempted`);
}

module.exports = { parseActivePort, waitForEndpoint };
