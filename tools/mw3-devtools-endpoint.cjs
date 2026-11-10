'use strict';

const path = require('node:path');
const {waitForBrowserEndpoint} = require('./native-browser-endpoint.cjs');

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

async function waitForEndpoint(file, browser, { deadline, timeoutMs = 10000, pollMs = 25, record = () => {} } = {}) {
  if (path.basename(file) !== 'DevToolsActivePort') throw Error('expected DevToolsActivePort');
  let publicationChanges = 0;
  const endpoint = await waitForBrowserEndpoint({profile: path.dirname(file), browser,
    deadline, startupTimeoutMs: timeoutMs, pollMs,
    validateEndpoint: value => {
      try { parseActivePort(`${value.debugPort}\n${value.browserPath}`); return true; }
      catch { return false; }
    },
    record: row => { publicationChanges++; record(row); }});
  return {...endpoint, url: `ws://127.0.0.1:${endpoint.debugPort}${endpoint.browserPath}`, publicationChanges};
}

module.exports = { parseActivePort, waitForEndpoint };
