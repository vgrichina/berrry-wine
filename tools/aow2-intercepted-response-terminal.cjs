'use strict';
// AoWII opts into the existing actual-consumer contract. A failed Network
// terminal stays failed; authenticated consumption is a separate assertion.
const assert = require('node:assert/strict');
const binary = name => /\.(?:bpl|dll|exe|fon|ttf|otf|tlb|pfs|ahr|ilb|fx|asi|mp3|wav|ahm)$/i.test(name);
function consumerURLs(origin, pins) {
  return [...pins.keys()].filter(binary).map(name => new URL('/' + name, origin).href);
}
async function attach(options) {
  assert(options.pins instanceof Map);
  const observedUrls = consumerURLs(options.origin, options.pins);
  assert(observedUrls.length, 'no immutable binary consumers');
  const adapter = await require('./return-fire-body-driver.cjs').attachPinned({...options,
    consumerCompletion: {urls: [], observedUrls}});
  // This task closes the whole owned browser immediately on UNKNOWN. Do not
  // issue the reusable adapter's in-page restoration/evaluation commands after
  // that boundary. Browser disposal removes the listeners and injected script.
  adapter.close = async () => {adapter.collector.close(); await adapter.collector.settle();};
  return adapter;
}
function assess(receipt, pins) {
  const {body, network, commands, request, checks} = receipt;
  const failed = network.filter(r => r.event === 'Network.loadingFailed');
  const finished = network.filter(r => r.event === 'Network.loadingFinished');
  if (checks.finished && checks.neverFailed) return {pass: Object.values(checks).every(Boolean),
    networkTerminal: 'finished', consumerAuthenticated: !!body.consumerCompletion};
  const c = body.consumerCompletion, f = failed[0], q = request[0];
  const continuation = commands.filter(r => r.method === 'Fetch.continueResponse' && r.phase === 'resolved');
  const expected = pins.get(decodeURIComponent(new URL(body.url).pathname).slice(1));
  const retainedChecks = Object.entries(checks).filter(([key]) => !['finished', 'neverFailed'].includes(key));
  const valid = retainedChecks.every(([, value]) => value) &&
    failed.length === 1 && !finished.length && continuation.length === 1 &&
    continuation[0].sequence < f.sequence && q?.sequence < continuation[0].sequence &&
    f.row.errorText === 'net::ERR_ABORTED' && f.row.canceled === true &&
    f.row.type === 'Fetch' && !f.row.blockedReason && !f.row.corsErrorStatus &&
    body.source === 'CDP.Fetch.response-stage' && body.state === 'continued' &&
    body.status === 200 && body.method === 'GET' && !body.redirectedRequestId &&
    c && c.sessionId === body.sessionId && c.targetId === body.targetId &&
    c.networkId === body.networkId && c.requestId === body.requestId &&
    typeof c.token === 'string' && c.token.length > 0 && Number.isInteger(c.contextId) &&
    typeof c.contextUniqueId === 'string' && c.contextUniqueId.length > 0 &&
    typeof c.frameId === 'string' && c.frameId.length > 0 &&
    new URL(c.documentURL).origin === new URL(body.url).origin && Number.isFinite(c.timeOrigin) &&
    ['reader-eof', 'arrayBuffer'].includes(c.kind) && c.bytes === body.bytes && c.sha256 === body.sha256 &&
    expected?.bytes === body.bytes && expected.sha256 === body.sha256;
  return {pass: !!valid, networkTerminal: failed.length ? 'failed' : 'missing',
    consumerAuthenticated: !!valid, failedNetworkRetained: f?.row || null};
}
function applicationFault(row) {
  return row?.reply?.trapped === true ||
    (row?.reply?.eip === 0 && row.reply.threadReturned !== true);
}
module.exports = {binary, consumerURLs, attach, assess, applicationFault};
