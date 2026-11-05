'use strict';

// Browser response bytes only. No filesystem, HTTP client, retry, fulfillment,
// or Network.getResponseBody fallback belongs in this collector.
const {createHash} = require('crypto');
const assert = require('assert/strict');

function createCollector({origin, onResponse, onFault, disconnectedEvent, record = () => {},
  timeoutMs = 2000, maxBodyBytes = 64 * 1024 * 1024} = {}) {
  assert.equal(new URL(origin).origin, origin);
  assert.equal(typeof onResponse, 'function');
  assert.equal(typeof onFault, 'function');
  // Puppeteer uses a Symbol, not the string "Disconnected".
  assert(['symbol', 'string'].includes(typeof disconnectedEvent), 'actual CDPSession disconnect event required');
  assert(Number.isSafeInteger(timeoutMs) && timeoutMs > 0);
  assert(Number.isSafeInteger(maxBodyBytes) && maxBodyBytes > 0);
  const sessions = new Map(), jobs = new Set(), rows = [];
  let closed = false, firstFault = null;

  const freeze = value => {
    if (value && typeof value === 'object') {Object.values(value).forEach(freeze); Object.freeze(value);}
    return value;
  };

  function fault(row, error) {
    if (firstFault || closed) return;
    firstFault = freeze(JSON.parse(JSON.stringify({boundary: 'browser-body-collector',
      ...row, error: String(error)})));
    onFault(firstFault);
  }
  function log(row, state, extra = {}) {
    Object.assign(row, extra, {state});
    record({...row, at: Date.now()});
  }
  function deadline(promise, row, phase, state) {
    let timer, cancel;
    const end = new Promise((resolve, reject) => {
      cancel = reason => reject(Error(reason));
      timer = setTimeout(() => reject(Error(phase + ' timeout')), timeoutMs);
    });
    state.cancels.add(cancel);
    return Promise.race([promise, end]).finally(() => {
      clearTimeout(timer); state.cancels.delete(cancel);
    });
  }
  function decode(body) {
    assert(body && typeof body.body === 'string' && typeof body.base64Encoded === 'boolean',
      'malformed Fetch body');
    // Reject malformed/noncanonical base64 rather than silently dropping bytes.
    assert(body.body.length <= Math.ceil(maxBodyBytes / 3) * 4 + 4 || !body.base64Encoded,
      'encoded browser body exceeds limit');
    if (!body.base64Encoded) assert(body.body.length <= maxBodyBytes, 'browser text body exceeds limit');
    const bytes = Buffer.from(body.body, body.base64Encoded ? 'base64' : 'utf8');
    if (body.base64Encoded) assert.equal(bytes.toString('base64'), body.body, 'malformed base64 body');
    assert(bytes.length <= maxBodyBytes, 'browser body exceeds limit');
    return bytes;
  }
  async function paused(state, event) {
    const row = {source: 'CDP.Fetch.response-stage', sessionId: state.identity.sessionId,
      targetId: state.identity.targetId, requestId: event.requestId,
      networkId: event.networkId || null, redirectedRequestId: event.redirectedRequestId || null,
      url: event.request?.url, method: event.request?.method,
      status: event.responseStatusCode, resourceType: event.resourceType, state: 'paused'};
    rows.push(row);
    state.active.add(row);
    try {
      assert(!closed && !state.detached, 'response after collector/target close');
      assert.equal(typeof row.requestId, 'string');
      assert(!state.ids.has(row.requestId), 'duplicate Fetch request identity');
      state.ids.add(row.requestId);
      assert.equal(new URL(row.url).origin, origin, 'unexpected response origin');
      assert.equal(row.method, 'GET', 'unexpected response method');
      assert(!event.responseErrorReason, 'browser response error: ' + event.responseErrorReason);
      assert(Number.isInteger(row.status), 'not paused at response stage');
      assert(!row.redirectedRequestId && !(row.status >= 300 && row.status < 400),
        'redirected response forbidden');
      log(row, 'paused');
      // Capture while paused. Do not continue or disable Fetch while this
      // command is pending (CDP defines that ordering as undefined).
      let bytes;
      if (row.status === 200) {
        bytes = decode(await deadline(state.session.send('Fetch.getResponseBody',
          {requestId: row.requestId}), row, 'body', state));
        assert(!closed && !state.detached, 'target lost during body retrieval');
        log(row, 'captured', {bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex')});
      }
      // Policy accepts/rejects the actual captured bytes; metadata alone is
      // never presented as a verified 200 body. An optional 404 has no body.
      const identity = Object.freeze({...row});
      const accepted = onResponse({url: () => row.url, status: () => row.status,
        fromCache: () => null, bodyIdentity: identity,
        request: () => ({method: () => row.method, redirectChain: () => []}),
        buffer: async () => {assert(bytes, 'no captured HTTP 200 body'); return Buffer.from(bytes);}});
      // A synchronous, identity-bound policy acknowledgment is deliberately
      // separate from a verified body or a pending fallback promise.
      if (row.status === 404 && accepted?.optionalAbsence === identity &&
          typeof accepted.policy === 'string' && accepted.policy.length)
        row.absencePolicy = accepted.policy;
      // HTTP 200 policy returns its settlement promise. A font bundle 404
      // must continue immediately so the browser can initiate the fallback.
      if (row.status === 200) await deadline(Promise.resolve(accepted), row, 'policy', state);
      else await Promise.resolve();
      assert(!closed && !state.detached && !firstFault, 'collector closed before continuation');
      await deadline(state.session.send('Fetch.continueResponse', {requestId: row.requestId}),
        row, 'continuation', state);
      assert(!closed && !state.detached, 'target lost during continuation');
      log(row, 'continued');
    } catch (error) {
      log(row, closed ? 'cancelled' : 'failed', {error: String(error)});
      fault({...row}, error);
    } finally { state.active.delete(row); }
  }
  async function attach(session, identity) {
    assert(!closed, 'collector closed');
    assert(identity && typeof identity.sessionId === 'string' && identity.sessionId.length);
    assert(typeof identity.targetId === 'string' && identity.targetId.length);
    assert(!sessions.has(identity.sessionId), 'duplicate collector session');
    const state = {session, identity: {...identity}, cancels: new Set(), ids: new Set(),
      active: new Set(), ready: false, detached: false, network: [],
      requests: new Map(), responses: new Map(), terminals: new Set(), observed200: new Map()};
    sessions.set(identity.sessionId, state);
    const handler = event => {
      const job = paused(state, event);
      jobs.add(job); job.finally(() => jobs.delete(job));
    };
    const detached = () => {
      if (state.detached) return;
      state.detached = true;
      record({source: 'CDP.Fetch.response-stage', ...state.identity, state: 'detached', at: Date.now()});
      for (const cancel of state.cancels) cancel('target detached');
      // Captured and continued bodies remain valid after a natural target
      // exit. Only unfinished capture/continuation or attachment is lost.
      if (!state.ready || state.active.size) fault({...state.identity, state: 'detached'},
        'target detached with unfinished collection');
    };
    state.handler = handler; state.onDetached = detached;
    session.on('Fetch.requestPaused', handler);
    session.on(disconnectedEvent, detached);
    for (const name of ['Network.requestWillBeSent', 'Network.responseReceived',
      'Network.loadingFinished', 'Network.loadingFailed']) {
      const listener = event => {
        try {
        if (name === 'Network.requestWillBeSent') {
          const previous = state.requests.get(event.requestId);
          if (new URL(event.request.url).origin === origin || previous)
            state.requests.set(event.requestId, {url: event.request.url,
              method: event.request.method, type: event.type,
              redirected: !!event.redirectResponse || !!previous?.redirected,
              count: (previous?.count || 0) + 1});
        }
        if (name === 'Network.responseReceived' && new URL(event.response.url).origin === origin)
          state.responses.set(event.requestId, {url: event.response.url,
            status: event.response.status, type: event.type,
            count: (state.responses.get(event.requestId)?.count || 0) + 1});
        if (name === 'Network.responseReceived' && event.response?.status === 200 &&
          new URL(event.response.url).origin === origin) state.observed200.set(event.requestId, event.response.url);
        record({source: name, ...identity, at: Date.now(),
        networkId: event.requestId, timestamp: event.timestamp,
        url: event.request?.url || event.response?.url,
        method: event.request?.method, status: event.response?.status,
        resourceType: event.type, redirected: !!event.redirectResponse,
        errorText: event.errorText, canceled: event.canceled,
        blockedReason: event.blockedReason, corsErrorStatus: event.corsErrorStatus,
        encodedDataLength: event.encodedDataLength,
        fromDiskCache: event.response?.fromDiskCache,
        fromServiceWorker: event.response?.fromServiceWorker});
        const alreadyTerminal = state.terminals.has(event.requestId);
        if (name === 'Network.loadingFinished' || name === 'Network.loadingFailed')
          state.terminals.add(event.requestId);
        if (name === 'Network.loadingFailed') {
          const request = state.requests.get(event.requestId), response = state.responses.get(event.requestId);
          const matches = rows.filter(r => r.sessionId === identity.sessionId && r.networkId === event.requestId);
          const row = matches.length === 1 ? matches[0] : null;
          // Chromium rejects a classic-script HTTP 404 with ERR_ABORTED even
          // without interception. Settle only the explicitly accepted absence
          // whose complete owning chain confirms that status rejection. Never
          // infer acceptance from an optional URL or the error string alone.
          if (!closed && !firstFault && !state.detached && !alreadyTerminal && row?.absencePolicy &&
              row.state === 'continued' && row.method === 'GET' && row.status === 404 &&
              row.resourceType === 'Script' && !row.redirectedRequestId &&
              request?.count === 1 && !request.redirected && request.method === 'GET' &&
              request.type === 'Script' && request.url === row.url &&
              response?.count === 1 && response.status === 404 && response.type === 'Script' && response.url === row.url &&
              event.type === 'Script' && event.errorText === 'net::ERR_ABORTED' &&
              event.canceled === true && !event.blockedReason && !event.corsErrorStatus) {
            record({...identity, source: name, state: 'optional-absence-script-rejection',
              requestId: row.requestId, networkId: event.requestId, url: row.url,
              policy: row.absencePolicy, errorText: event.errorText, canceled: true, at: Date.now()});
            return;
          }
          const url = request?.url || matches[0]?.url;
          if (url) fault({...identity, state: 'network-loading-failed', networkId: event.requestId,
            url, canceled: event.canceled}, event.errorText || 'browser transfer failed');
        }
        } catch (error) {fault({...identity, state: 'malformed-network-event', source: name}, error);}
      };
      state.network.push([name, listener]); session.on(name, listener);
    }
    try {
      await deadline(session.send('Network.enable'), {}, 'network-enable', state);
      await deadline(session.send('Fetch.enable', {patterns: [
        {urlPattern: origin + '/*', requestStage: 'Response'}]}), {}, 'enable', state);
      assert(!closed && !state.detached, 'target closed during collector attachment');
      state.ready = true;
      record({source: 'CDP.Fetch.response-stage', ...identity, state: 'enabled', at: Date.now()});
    } catch (error) { fault({...identity, state: 'enable-failed'}, error); throw error; }
  }
  async function settle() {
    while (jobs.size) await Promise.all([...jobs]);
  }
  async function drain() {
    await settle();
    const missing = uncovered();
    if (missing.length) fault({state: 'missing-browser-body-receipt', missing},
      'observed HTTP 200 lacks owning-session Fetch body receipt');
    if (firstFault) throw Error(firstFault.error);
    assert(!closed, 'collector closed');
  }
  function close(reason = 'collector-close') {
    if (closed) return;
    closed = true;
    for (const state of sessions.values()) {
      for (const cancel of state.cancels) cancel(reason);
      state.session.off('Fetch.requestPaused', state.handler);
      state.session.off(disconnectedEvent, state.onDetached);
      for (const [name, listener] of state.network) state.session.off(name, listener);
    }
    // Browser/session owner closes normally. Never Fetch.disable while a
    // getResponseBody command could still be outstanding in Chrome.
  }
  function snapshot() {
    const missing = uncovered();
    return {closed, firstFault, missing, complete: sessions.size > 0 &&
      [...sessions.values()].every(s => s.ready) && !firstFault && !missing.length && rows.every(r => r.state === 'continued'),
      responses: rows.map(r => ({...r})), sessions: [...sessions.values()].map(s => ({...s.identity, detached: s.detached}))};
  }
  function uncovered() {
    return [...sessions.values()].flatMap(s => [...s.observed200].filter(([networkId]) =>
      !rows.some(r => r.sessionId === s.identity.sessionId && r.networkId === networkId &&
        r.status === 200 && r.state === 'continued')).map(([networkId, url]) =>
      ({...s.identity, networkId, url})));
  }
  return {attach, drain, settle, close, snapshot};
}
module.exports = {createCollector};
