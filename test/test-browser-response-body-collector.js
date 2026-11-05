'use strict';
// Synthetic CDP transport lifecycle tests. HTTP bodies are real; no browser or
// guest execution is claimed. Never treat this transport as runtime evidence.
const assert = require('assert/strict');
const {EventEmitter} = require('events');
const fs = require('fs');
const path = require('path');
const {createHash} = require('crypto');
const {createCollector} = require('../tools/browser-response-body-collector.cjs');
const {startStaticServer, closeServer} = require('./static-server.js');
const DISCONNECT = Symbol('CDPSession.Disconnected');
const digest = b => createHash('sha256').update(b).digest('hex');
const tick = () => new Promise(resolve => setImmediate(resolve));
class Session extends EventEmitter {
  constructor(id) { super(); this.id = id; this.calls = []; this.bodies = new Map(); }
  async send(method, params) {
    this.calls.push({method, params});
    if (method === 'Fetch.getResponseBody') {
      const body = this.bodies.get(params.requestId);
      if (body instanceof Error) throw body;
      if (typeof body === 'function') return body();
      assert(body, 'body only available in this paused session');
      return {body: body.toString('base64'), base64Encoded: true};
    }
    if (method === 'Fetch.continueResponse') {
      assert(this.bodies.has(params.requestId), 'continue original request');
      this.bodies.delete(params.requestId);
    }
    return {};
  }
  pause(id, body, options = {}) {
    this.bodies.set(id, body);
    this.emit('Fetch.requestPaused', {requestId: id, networkId: 'network-' + id,
      request: {url: this.origin + '/index.html', method: 'GET', ...options.request},
      responseStatusCode: 200, ...options});
  }
}
async function main() {
  const server = await startStaticServer({root: path.resolve(__dirname, '..'), port: 0});
  const origin = 'http://127.0.0.1:' + server.address().port;
  const http = await fetch(origin + '/index.html');
  const body = Buffer.from(await http.arrayBuffer());
  assert.equal(http.status, 200);
  assert.deepEqual(body, fs.readFileSync(path.join(__dirname, '../index.html')));
  let passed = 0;
  async function run(name, execute, options = {}) {
    const rows = [], faults = [], received = [];
    const collector = createCollector({origin, disconnectedEvent: DISCONNECT,
      timeoutMs: 30, ...options, record: row => rows.push(row), onFault: row => faults.push(row),
      onResponse: async response => received.push({identity: response.bodyIdentity,
        body: response.status() === 200 ? await response.buffer() : null})});
    const s = new Session(name); s.origin = origin;
    try { await collector.attach(s, {sessionId: name, targetId: 'target-' + name});
      await execute({collector, s, rows, faults, received}); passed++;
    } finally { collector.close(); await collector.settle(); }
  }
  try {
    await run('capture-before-continue', async ({collector, s, received, rows}) => {
      s.pause('a', body); await collector.drain();
      assert.deepEqual(received[0].body, body);
      assert.equal(rows.find(r => r.state === 'captured').sha256, digest(body));
      assert(s.calls.findIndex(c => c.method === 'Fetch.getResponseBody') <
        s.calls.findIndex(c => c.method === 'Fetch.continueResponse'));
      assert(collector.snapshot().complete);
    });
    await run('same-url-out-of-order', async ({collector, s, received}) => {
      let release; s.pause('a', () => new Promise(resolve => {release = resolve;}));
      s.pause('b', Buffer.from('different bytes')); await tick();
      assert(!s.calls.some(c => c.method === 'Fetch.continueResponse' && c.params.requestId === 'a'));
      release({body: body.toString('base64'), base64Encoded: true}); await collector.drain();
      assert.deepEqual(received.map(r => r.identity.requestId), ['b', 'a']);
      assert.deepEqual(received[1].body, body);
    });
    await run('same-id-different-session', async ({collector, s, received}) => {
      const other = new Session('other'); other.origin = origin;
      await collector.attach(other, {sessionId: 'other', targetId: 'target-other'});
      s.pause('same', body); other.pause('same', Buffer.from('worker bytes'));
      await collector.drain(); assert.equal(received.length, 2);
      assert.equal(new Set(received.map(r => r.identity.sessionId)).size, 2);
      assert.notDeepEqual(received[0].body, received[1].body);
    });
    for (const [name, value] of [
      ['body-rejected', new Error('No data found for resource with given identifier')],
      ['body-timeout', () => new Promise(() => {})],
      ['malformed-body', () => ({body: 'not_base64', base64Encoded: true})],
      ['invalid-body-type', () => ({body: 123, base64Encoded: false})],
    ]) await run(name, async ({collector, s, faults, received}) => {
      s.pause('a', value); await assert.rejects(collector.drain());
      assert.equal(faults.length, 1); assert.equal(received.length, 0);
      assert(!collector.snapshot().complete);
      assert(!s.calls.some(c => c.method === 'Fetch.continueResponse'));
    });
    await run('detach-during-body', async ({collector, s, faults}) => {
      let release; s.pause('a', () => new Promise(resolve => {release = resolve;}));
      s.emit(DISCONNECT); await assert.rejects(collector.drain());
      assert.equal(faults.length, 1);
      release({body: body.toString('base64'), base64Encoded: true}); await tick();
      assert(!collector.snapshot().complete);
      assert(!s.calls.some(c => c.method === 'Fetch.continueResponse'));
    });
    await run('cancel-during-body', async ({collector, s, faults, received}) => {
      let release; s.pause('a', () => new Promise(resolve => {release = resolve;}));
      collector.close('owner close'); await collector.settle();
      release({body: body.toString('base64'), base64Encoded: true}); await tick();
      assert.equal(faults.length, 0); assert.equal(received.length, 0);
      assert.equal(collector.snapshot().responses[0].state, 'cancelled');
      assert(!collector.snapshot().complete);
      assert.equal(s.listenerCount('Fetch.requestPaused'), 0);
    });
    for (const [name, options] of [
      ['post', {request: {url: origin + '/index.html', method: 'POST'}}],
      ['redirect', {responseStatusCode: 302}],
      ['redirected-request', {redirectedRequestId: 'prior'}],
      ['response-error', {responseErrorReason: 'Failed'}],
      ['request-stage', {responseStatusCode: undefined}],
      ['wrong-origin', {request: {url: 'http://other.invalid/index.html', method: 'GET'}}],
    ]) await run(name, async ({collector, s, received, faults}) => {
      s.pause('a', body, options); await assert.rejects(collector.drain());
      assert.equal(faults.length, 1); assert.equal(received.length, 0);
      assert(!s.calls.some(c => c.method === 'Fetch.getResponseBody'));
    });
    await run('optional-404-has-no-body', async ({collector, s, received}) => {
      s.pause('a', body, {responseStatusCode: 404}); await collector.drain();
      assert.equal(received[0].body, null);
      assert(!s.calls.some(c => c.method === 'Fetch.getResponseBody'));
    });
    await run('continuation-error', async ({collector, s, faults}) => {
      const send = s.send.bind(s); s.send = (method, params) => method === 'Fetch.continueResponse'
        ? Promise.reject(Error('continuation rejected')) : send(method, params);
      s.pause('a', body); await assert.rejects(collector.drain());
      assert.equal(faults.length, 1); assert(!collector.snapshot().complete);
    });
    await run('detach-after-capture', async ({collector, s, faults}) => {
      s.pause('a', body); await collector.drain(); s.emit(DISCONNECT);
      assert.equal(faults.length, 0); assert(collector.snapshot().complete);
      assert(collector.snapshot().sessions[0].detached);
    });
    await run('duplicate-fetch-id', async ({collector, s, faults}) => {
      s.pause('a', body); await collector.drain(); s.pause('a', body);
      await assert.rejects(collector.drain()); assert.equal(faults.length, 1);
    });
    await run('network-failure-metadata', async ({collector, s, rows}) => {
      s.emit('Network.loadingFailed', {requestId: 'n', errorText: 'aborted', canceled: true});
      assert(rows.some(r => r.source === 'Network.loadingFailed' && r.networkId === 'n' && r.canceled));
      collector.close(); assert.equal(s.listenerCount('Network.loadingFailed'), 0);
    });
    await run('HTTP200-without-body-receipt', async ({collector, s, faults}) => {
      s.emit('Network.responseReceived', {requestId: 'missing', response: {url: origin + '/index.html', status: 200}});
      await assert.rejects(collector.drain());
      assert.equal(faults[0].state, 'missing-browser-body-receipt');
      assert.equal(collector.snapshot().missing[0].networkId, 'missing');
      assert(!collector.snapshot().complete);
    });
    await run('oversized-body', async ({collector, s, received}) => {
      s.pause('a', body); await assert.rejects(collector.drain()); assert.equal(received.length, 0);
    }, {maxBodyBytes: 1});
    await run('continuation-timeout', async ({collector, s}) => {
      const send = s.send.bind(s); s.send = (method, params) => method === 'Fetch.continueResponse'
        ? new Promise(() => {}) : send(method, params);
      s.pause('a', body); await assert.rejects(collector.drain()); assert(!collector.snapshot().complete);
    });
    await run('unicode-text-body', async ({collector, s, received}) => {
      s.pause('a', () => ({body: 'text with Ω', base64Encoded: false}));
      await collector.drain(); assert.deepEqual(received[0].body, Buffer.from('text with Ω'));
    });
    await run('HTTP200-matched-to-own-session', async ({collector, s}) => {
      s.emit('Network.responseReceived', {requestId: 'network-a', response: {url: origin + '/index.html', status: 200}});
      s.pause('a', body); await collector.drain(); assert(collector.snapshot().complete);
    });
    await run('HTTP200-cannot-borrow-other-session', async ({collector, s}) => {
      const other = new Session('other'); other.origin = origin;
      await collector.attach(other, {sessionId: 'other', targetId: 'target-other'});
      s.emit('Network.responseReceived', {requestId: 'network-a', response: {url: origin + '/index.html', status: 200}});
      other.pause('a', body); await assert.rejects(collector.drain());
      assert(!collector.snapshot().complete);
    });
    await run('transfer-failure-before-response', async ({collector, s, faults}) => {
      s.emit('Network.requestWillBeSent', {requestId: 'n', request: {url: origin + '/index.html', method: 'GET'}});
      s.emit('Network.loadingFailed', {requestId: 'n', errorText: 'aborted', canceled: true});
      await assert.rejects(collector.drain());
      assert.equal(faults[0].state, 'network-loading-failed'); assert(!collector.snapshot().complete);
    });
    console.log('PASS ' + passed + ' synthetic CDP lifecycle cases; real local FS/HTTP bytes; ZERO Chrome');
  } finally { server.closeIdleConnections?.(); await closeServer(server); }
}
module.exports = {Session, DISCONNECT};
if (require.main === module) {
  let complete = false;
  process.once('beforeExit', () => {if (!complete) {console.error('FAIL collector suite incomplete'); process.exitCode = 1;}});
  main().then(() => {complete = true;}, error => {complete = true; console.error(error); process.exitCode = 1;});
}
