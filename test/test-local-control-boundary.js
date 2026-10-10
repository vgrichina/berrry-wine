#!/usr/bin/env node
'use strict';

const assert = require('assert');
const http = require('http');
const { once } = require('events');
const { startControlServer } = require('../lib/control-server');

async function main() {
  const commands = [];
  const control = startControlServer({ port: 0, onCommand: cmd => {
    commands.push(cmd);
    return cmd.action;
  } });
  await once(control.server, 'listening');
  const port = control.server.address().port;
  const request = (method, path, headers = {}, body = '') => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path,
      headers: { 'Content-Type': 'text/plain', ...headers } }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
    });
    req.on('error', reject);
    req.end(body);
  });
  try {
    const body = JSON.stringify({ action: 'eval', code: 'browser request' });
    for (const headers of [
      { Origin: 'https://unrelated.example' },
      { Origin: 'null' },
      { Origin: `http://127.0.0.1:${port}` },
      { 'Sec-Fetch-Site': 'cross-site' },
      { 'Sec-Fetch-Site': 'same-site' },
      { 'Sec-Fetch-Site': 'same-origin' },
    ]) {
      const before = commands.length;
      assert.strictEqual((await request('POST', '/ctl', headers, body)).status, 403);
      assert.strictEqual((await request('GET', '/snapshot', headers)).status, 403);
      assert.strictEqual(commands.length, before, 'rejected browser requests must not invoke commands');
    }
    const batch = await request('POST', '/ctl', {}, '[{"action":"first"},{"action":"second"}]');
    assert.strictEqual(batch.status, 200);
    assert.deepStrictEqual(batch.body.map(result => result.value), ['first', 'second']);
    const snapshot = await request('GET', '/snapshot');
    assert.strictEqual(snapshot.status, 200);
    assert.strictEqual(snapshot.body.value, 'snapshot');
    assert.strictEqual((await request('POST', '/ctl', {}, '{')).status, 400);
    assert.strictEqual((await request('GET', '/missing')).status, 404);
    assert.deepStrictEqual(commands.map(cmd => cmd.action), ['first', 'second', 'snapshot']);
    console.log('PASS CLI control rejects browser-origin requests before command dispatch');
  } finally {
    control.close();
    control.server.closeAllConnections();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
