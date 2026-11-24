#!/usr/bin/env node
'use strict';
// berrry cannot serve a spaced path, so tools/deploy-berrry.js publishes
// "CnC-Red Alert Demo-SW/INSTALL/REDALERT.MIX" as
// "CnC-Red_Alert_Demo-SW/INSTALL/REDALERT.MIX". A lazily mounted game-data
// file must retry that name on 404 (red_alert_95_demo on berrry.wine showed
// "couldn't load game data (redalert.mix)" without it), and only on 404.
const assert = require('assert');
const { HttpRangeProvider } = require('../lib/byte-provider');
const body = Uint8Array.from({ length: 64 }, (_, i) => i);
const response = (status, bytes) => ({ status, arrayBuffer: async () => bytes.buffer });
(async () => {
  const spaced = 'https://h/test/binaries/a/CnC-Red%20Alert%20Demo-SW/INSTALL/REDALERT.MIX?v=1';
  const folded = 'https://h/test/binaries/a/CnC-Red_Alert_Demo-SW/INSTALL/REDALERT.MIX?v=1';
  let calls = [];
  const deployed = async url => { calls.push(url); return url === folded ? response(200, body) : response(404, new Uint8Array(0)); };
  const p = new HttpRangeProvider(spaced, body.length, { fetch: deployed });
  assert.deepStrictEqual([...await p.readRange(3, 2)], [3, 4]);
  assert.deepStrictEqual(calls, [spaced, folded], '404 on the spaced name retries the space-free name once');

  calls = [];
  const opened = await HttpRangeProvider.open(spaced, { fetch: deployed });
  assert.strictEqual(opened.size, body.length);
  assert.deepStrictEqual(calls, [spaced, folded], 'open() takes the same retry');

  calls = [];
  const dev = async url => { calls.push(url); return response(200, body); };
  await new HttpRangeProvider(spaced, body.length, { fetch: dev }).readRange(0, 1);
  assert.deepStrictEqual(calls, [spaced], 'a server that serves the spaced name is asked once');

  calls = [];
  const plain = 'https://h/x/MAIN.MIX';
  const missing = async url => { calls.push(url); return response(404, new Uint8Array(0)); };
  await assert.rejects(new HttpRangeProvider(plain, 1, { fetch: missing }).readRange(0, 1), /404/);
  assert.deepStrictEqual(calls, [plain], 'a space-free name is never retried');

  calls = [];
  const gone = async url => { calls.push(url); return response(500, new Uint8Array(0)); };
  await assert.rejects(new HttpRangeProvider(spaced, 1, { fetch: gone }).readRange(0, 1), /500/);
  assert.deepStrictEqual(calls, [spaced], 'only a 404 retries');
  console.log('PASS  lazy game data retries the deployer space-free name on 404 only');
})().catch(error => { console.error(error); process.exit(1); });
