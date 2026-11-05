'use strict';

// Browser response bytes only. Fetch captures page responses while paused.
// Workers lacking Fetch use a capability-checked owning Network session;
// failed body reads never select another channel or re-fetch a resource.
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
  const finished = row => row.state === 'continued' || row.state === 'collected';
  function track(job) { jobs.add(job); job.finally(() => jobs.delete(job)); }
  async function deliver(state, row, bytes) {
    assert(!closed && !state.detached, 'target lost before body policy');
    const identity = freeze({...row});
    const accepted = onResponse({url: () => row.url, status: () => row.status,
      fromCache: () => null, bodyIdentity: identity,
      request: () => ({method: () => row.method, redirectChain: () => []}),
      buffer: async () => {assert(bytes, 'no captured HTTP 200 body'); return Buffer.from(bytes);}});
    if (row.status === 404 && accepted?.optionalAbsence === identity &&
        typeof accepted.policy === 'string' && accepted.policy.length)
      row.absencePolicy = accepted.policy;
    if (row.status === 200) await deadline(Promise.resolve(accepted), row, 'policy', state);
    else await Promise.resolve();
  }
  function startupRequest(state, event) {
    // Chromium reports Worker main-script response/finish in the Worker but
    // its request in the explicit parent. Bind by target/request ID, never URL
    // alone. Retrieve the body again in the Worker; no parent bytes are used.
    const id = state.identity, parent = sessions.get(id.parentSessionId);
    const request = parent?.requests.get(event.requestId);
    const receipts = rows.filter(r => r.sessionId === id.parentSessionId &&
      r.networkId === event.requestId && r.state === 'continued' && r.status === 200);
    assert(id.type === 'worker' && id.waitingForDebugger === true &&
      event.requestId === id.targetId && event.type === 'Script' &&
      event.response.url === id.url && parent?.transport === 'Fetch' &&
      request?.url === id.url && request.method === 'GET' && request.type === 'Script' &&
      request.count === 1 && !request.redirected && receipts.length === 1 &&
      receipts[0].url === id.url && receipts[0].method === 'GET' &&
      !receipts[0].redirectedRequestId,
    'Worker startup response lacks exact parent request/verified Fetch identity');
    const receipt = receipts[0];
    return {request, binding: {sessionId: id.parentSessionId, targetId: parent.identity.targetId,
      requestId: receipt.requestId, networkId: event.requestId, url: id.url,
      method: request.method, bytes: receipt.bytes, sha256: receipt.sha256}};
  }
  function networkRequest(state, networkId, request, startupBinding = null) {
    assert(!state.networkRows.has(networkId), 'duplicate Network request identity');
    const row = {source: 'CDP.Network.response-body', ...state.identity,
      requestId: networkId, networkId, redirectedRequestId: null,
      url: request.url, method: request.method, resourceType: request.type,
      startupBinding, state: 'requested'};
    rows.push(row); state.networkRows.set(networkId, row); state.active.add(row);
    let resolve, reject;
    const terminal = new Promise((yes, no) => {resolve = yes; reject = no;});
    state.waiters.set(networkId, {resolve, reject});
    track((async () => {
      try {
        assert(state.ready && !closed && !state.detached, 'Worker request before collector readiness');
        assert.equal(new URL(row.url).origin, origin, 'unexpected response origin');
        assert.equal(row.method, 'GET', 'unexpected response method');
        assert(request.count === 1 && !request.redirected, 'redirected response forbidden');
        log(row, 'requested');
        await deadline(terminal, row, 'transfer', state);
        const response = state.responses.get(networkId);
        assert(response?.count === 1 && response.url === row.url && response.type === row.resourceType,
          'Network response does not match exact request identity');
        assert(Number.isInteger(row.status), 'missing Network response status');
        assert(!(row.status >= 300 && row.status < 400), 'redirected response forbidden');
        let bytes;
        if (row.status === 200) {
          bytes = decode(await deadline(state.session.send('Network.getResponseBody',
            {requestId: networkId}), row, 'body', state));
          assert(!closed && !state.detached, 'target lost during body retrieval');
          const sha256 = createHash('sha256').update(bytes).digest('hex');
          if (startupBinding) {
            assert.equal(bytes.length, startupBinding.bytes, 'Worker startup body size differs from parent');
            assert.equal(sha256, startupBinding.sha256, 'Worker startup body differs from parent');
          }
          log(row, 'captured', {bytes: bytes.length, sha256});
          await deliver(state, row, bytes);
        } else await state.policies.get(networkId);
        assert(!closed && !state.detached && !firstFault, 'collector closed before collection settled');
        log(row, 'collected');
      } catch (error) {
        log(row, closed ? 'cancelled' : 'failed', {error: String(error)}); fault({...row}, error);
      } finally { state.policies.delete(networkId); state.active.delete(row); state.waiters.delete(networkId); }
    })());
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
      await deliver(state, row, bytes);
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
      requests: new Map(), responses: new Map(), terminals: new Set(), observed200: new Map(),
      networkRows: new Map(), waiters: new Map(), policies: new Map(), transport: null};
    sessions.set(identity.sessionId, state);
    const handler = event => {
      const job = paused(state, event);
      track(job);
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
          if (state.transport === 'Network' && state.requests.has(event.requestId) && !closed && !firstFault) {
            assert(!previous, 'redirected or duplicate Network request forbidden');
            networkRequest(state, event.requestId, state.requests.get(event.requestId));
          }
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
        if (state.transport === 'Network' && !closed && !firstFault && !state.detached) {
          if (name === 'Network.responseReceived' && new URL(event.response.url).origin === origin) {
            if (!state.networkRows.has(event.requestId)) {
              const startup = startupRequest(state, event);
              networkRequest(state, event.requestId, startup.request, startup.binding);
            }
            const row = state.networkRows.get(event.requestId), response = state.responses.get(event.requestId);
            assert(response.count === 1 && response.url === row.url && response.type === row.resourceType,
              'Network response identity mismatch');
            assert(Number.isInteger(response.status) && !(response.status >= 300 && response.status < 400),
              'redirected or invalid Network response status');
            log(row, 'response', {status: response.status});
            // Non-200 policy is metadata-only and must acknowledge absence
            // synchronously before a possible classic-script ERR_ABORTED.
            if (row.status !== 200) {
              const policy = deliver(state, row); state.policies.set(event.requestId, policy);
              policy.catch(error => state.waiters.get(event.requestId)?.reject(error));
            }
          }
          if (name === 'Network.loadingFinished' && state.networkRows.has(event.requestId)) {
            assert(!alreadyTerminal, 'duplicate Network terminal event');
            state.waiters.get(event.requestId)?.resolve();
          }
        }
        if (name === 'Network.loadingFailed') {
          const request = state.requests.get(event.requestId), response = state.responses.get(event.requestId);
          const matches = rows.filter(r => r.sessionId === identity.sessionId && r.networkId === event.requestId);
          const row = matches.length === 1 ? matches[0] : null;
          // Chromium rejects a classic-script HTTP 404 with ERR_ABORTED even
          // without interception. Settle only the explicitly accepted absence
          // whose complete owning chain confirms that status rejection. Never
          // infer acceptance from an optional URL or the error string alone.
          if (!closed && !firstFault && !state.detached && !alreadyTerminal && row?.absencePolicy &&
              (row.state === 'continued' || (state.transport === 'Network' && row.state === 'response')) &&
              row.method === 'GET' && row.status === 404 &&
              row.resourceType === 'Script' && !row.redirectedRequestId &&
              request?.count === 1 && !request.redirected && request.method === 'GET' &&
              request.type === 'Script' && request.url === row.url &&
              response?.count === 1 && response.status === 404 && response.type === 'Script' && response.url === row.url &&
              event.type === 'Script' && event.errorText === 'net::ERR_ABORTED' &&
              event.canceled === true && !event.blockedReason && !event.corsErrorStatus) {
            record({...identity, source: name, state: 'optional-absence-script-rejection',
              requestId: row.requestId, networkId: event.requestId, url: row.url,
              policy: row.absencePolicy, errorText: event.errorText, canceled: true, at: Date.now()});
            state.waiters.get(event.requestId)?.resolve();
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
      await deadline(session.send('Network.enable', {maxTotalBufferSize: maxBodyBytes,
        maxResourceBufferSize: maxBodyBytes}), {}, 'network-enable', state);
      try {
        await deadline(session.send('Fetch.enable', {patterns: [
          {urlPattern: origin + '/*', requestStage: 'Response'}]}), {}, 'enable', state);
        state.transport = 'Fetch';
      } catch (error) {
        // Puppeteer 25 preserves originalMessage but drops the numeric CDP
        // code. Require the exact protocol/method error, never substring-match
        // a timeout, denial, detach or failed body read into another channel.
        assert(identity.type === 'worker' && identity.waitingForDebugger === true &&
          error.name === 'ProtocolError' && error.originalMessage === "'Fetch.enable' wasn't found" &&
          (error.code === undefined || error.code === -32601), String(error));
        record({source: 'CDP.capability', ...identity, method: 'Fetch.enable',
          state: 'method-unavailable', error: String(error), at: Date.now()});
        try {
          await deadline(session.send('Network.getResponseBody',
            {requestId: '__wine_body_capability_probe__'}), {}, 'body-capability', state);
          throw Error('Network body capability probe unexpectedly returned a body');
        } catch (probe) {
          if (!(probe.name === 'ProtocolError' &&
              probe.originalMessage === 'No resource with given identifier found' &&
              (probe.code === undefined || probe.code === -32000))) {
            fault({...identity, state: 'unsupported-worker-body-transport',
              fetchError: String(error), networkError: String(probe)}, probe); throw probe;
          }
        }
        state.transport = 'Network';
      }
      assert(!closed && !state.detached, 'target closed during collector attachment');
      state.ready = true;
      record({source: 'CDP.body-transport', ...identity, transport: state.transport, state: 'enabled', at: Date.now()});
    } catch (error) { fault({...identity, state: 'enable-failed'}, error); throw error; }
  }
  async function settle() {
    while (jobs.size) await Promise.all([...jobs]);
  }
  async function drain() {
    await settle();
    const missing = uncovered();
    if (missing.length) fault({state: 'missing-browser-body-receipt', missing},
      'observed HTTP 200 lacks owning-session browser body receipt');
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
      [...sessions.values()].every(s => s.ready && !s.active.size) && !firstFault && !missing.length && rows.every(finished),
      responses: rows.map(r => ({...r})), sessions: [...sessions.values()].map(s => ({...s.identity, transport: s.transport, ready: s.ready, detached: s.detached}))};
  }
  function uncovered() {
    return [...sessions.values()].flatMap(s => [...s.observed200].filter(([networkId]) =>
      !rows.some(r => r.sessionId === s.identity.sessionId && r.networkId === networkId &&
        r.status === 200 && finished(r))).map(([networkId, url]) =>
      ({...s.identity, networkId, url})));
  }
  return {attach, drain, settle, close, snapshot};
}
module.exports = {createCollector};
