'use strict';
const assert = require('node:assert/strict');
const {assess, consumerURLs, applicationFault} = require('../tools/aow2-intercepted-response-terminal.cjs');
const origin = 'http://127.0.0.1:1234', name = 'media/Ml42ND50.bpl', hash = 'c'.repeat(64);
const pins = new Map([[name, {bytes: 468992, sha256: hash}], ['media/manifest.json', {}],
  ['host.js', {}], ['image.png', {}]]);
assert.deepEqual(consumerURLs(origin, pins), [origin + '/' + name]);
function receipt() {
  const body = {source: 'CDP.Fetch.response-stage', state: 'continued', sessionId: 's', targetId: 't',
    requestId: 'f', networkId: 'n', url: origin + '/' + name, status: 200, method: 'GET',
    bytes: 468992, sha256: hash};
  body.consumerCompletion = {sessionId: 's', targetId: 't', networkId: 'n', requestId: 'f',
    token: 'invocation', contextId: 1, contextUniqueId: 'context', frameId: 'frame',
    documentURL: origin + '/index.html', timeOrigin: 100, kind: 'reader-eof', bytes: body.bytes, sha256: hash};
  return {body, network: [{sequence: 4, event: 'Network.loadingFailed', row: {
    type: 'Fetch', errorText: 'net::ERR_ABORTED', canceled: true}}],
    commands: [{sequence: 3, method: 'Fetch.continueResponse', phase: 'resolved'}],
    request: [{sequence: 1}], checks: {finished: false, neverFailed: false,
      collected: true, uniqueRequest: true, uniqueResponse: true, server: true, captured: true}};
}
const good = assess(receipt(), pins);
assert(good.pass && good.consumerAuthenticated && good.networkTerminal === 'failed');
const mutations = [
  r => delete r.body.consumerCompletion,
  r => r.body.consumerCompletion.bytes--,
  r => r.body.consumerCompletion.sha256 = '0'.repeat(64),
  ...['sessionId', 'targetId', 'requestId', 'networkId'].map(key => r => r.body.consumerCompletion[key] = 'foreign'),
  r => r.body.consumerCompletion.contextUniqueId = '',
  r => r.body.consumerCompletion.kind = 'partial',
  r => r.body.consumerCompletion.documentURL = 'http://foreign.test/',
  r => r.commands[0].sequence = 5,
  r => r.network.push({...r.network[0]}),
  r => r.network.push({event: 'Network.loadingFinished'}),
  r => r.network = [],
  r => r.network[0].row.canceled = false,
  r => r.network[0].row.errorText = 'net::ERR_CONTENT_LENGTH_MISMATCH',
  r => r.network[0].row.blockedReason = 'other',
  r => r.network[0].row.corsErrorStatus = {},
  r => r.checks.uniqueRequest = false,
  r => r.checks.server = false,
  r => r.body.redirectedRequestId = 'earlier',
];
for (const mutate of mutations) {const r = receipt(); mutate(r); assert(!assess(r, pins).pass);}
assert(!assess(receipt(), new Map([[name, {bytes: 468992, sha256: '0'.repeat(64)}]])).pass);
assert(applicationFault({reply: {trapped: true, eip: 123}}));
assert(applicationFault({reply: {eip: 0, threadReturned: false}}));
assert(!applicationFault({reply: {eip: 0, threadReturned: true}}));
assert(!applicationFault({reply: {eip: 123, trapped: false}}));
console.log('PASS AoWII authenticated terminal contract: positive plus ' + (mutations.length + 1) + ' refusals');

// Supplement the real-browser post-failure receipts with the opposite event
// order and owner-loss races, using the production collector's synthetic CDP.
async function races() {
  const {Session, DISCONNECT} = require('./test-browser-response-body-collector.js');
  const {createCollector} = require('../tools/browser-response-body-collector.cjs');
  const bytes = Buffer.from('race-order-control'), digest = require('crypto').createHash('sha256').update(bytes).digest('hex');
  for (const mode of ['before-failure', 'after-failure', 'owner-lost', 'wrong-hash']) {
    const s = new Session('s'); s.origin = origin;
    const faults = [], c = createCollector({origin, consumerCompletion: true, timeoutMs: 100,
      disconnectedEvent: DISCONNECT, onFault: r => faults.push(r), onResponse: async r => {
        assert.equal(require('crypto').createHash('sha256').update(await r.buffer()).digest('hex'), digest);
      }});
    await c.attach(s, {type: 'page', sessionId: 's', targetId: 't'});
    s.emit('Network.requestWillBeSent', {requestId: 'network-a', type: 'Fetch',
      request: {url: origin + '/index.html', method: 'GET'}});
    const id = {sessionId: 's', targetId: 't', networkId: 'network-a', token: 'invocation',
      contextId: 1, contextUniqueId: 'unique', frameId: 'frame', documentURL: origin + '/index.html', timeOrigin: 100};
    c.bindConsumer(id); s.pause('a', bytes, {resourceType: 'XHR'});
    await new Promise(resolve => setImmediate(resolve));
    s.emit('Network.responseReceived', {requestId: 'network-a', type: 'Fetch',
      response: {url: origin + '/index.html', status: 200}});
    const fail = () => s.emit('Network.loadingFailed', {requestId: 'network-a', type: 'Fetch',
      errorText: 'net::ERR_ABORTED', canceled: true});
    if (mode === 'after-failure') fail();
    c.completeConsumer({...id, completion: true, kind: 'reader-eof', bytes: bytes.length,
      sha256: mode === 'wrong-hash' ? '0'.repeat(64) : digest});
    await new Promise(resolve => setImmediate(resolve));
    if (mode === 'owner-lost') c.invalidateConsumers('s', 1);
    if (mode !== 'after-failure') fail();
    if (['owner-lost', 'wrong-hash'].includes(mode)) {
      await assert.rejects(c.drain()); assert(faults.length); assert(!c.snapshot().complete);
    } else {await c.drain(); assert(c.snapshot().complete); assert.equal(faults.length, 0);}
    c.close(); await c.settle();
  }
  console.log('PASS four production-collector completion/failure/owner races (synthetic CDP)');
}
races().catch(error => {console.error(error); process.exitCode = 1;});
