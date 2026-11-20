'use strict';
// Hexen operator overlay. Does not change the shared cancellation implementation.
const common = require('./browser-startup-lifecycle.cjs');

function trace(record) {
  let sequence = 0;
  return (kind, details = {}) => {
    // Only finite metadata, never response bodies, scripts or console payloads.
    const row = {at: Date.now(), sequence: ++sequence, kind, ...details};
    const json = JSON.stringify(row);
    if (sequence > 4096 || json.length > 32768) throw Error('UNKNOWN startup trace metadata limit');
    record(row); // synchronous persistence before any asynchronous boundary
  };
}

function connect(lifecycle, url, record = row => lifecycle.note('startup-trace', row)) {
  lifecycle.checkpoint('CDP:connect');
  const note = trace(record), ws = new WebSocket(url), pending = new Map();
  let serial = 0, terminal = null, requestedClose = false;
  const fail = error => {
    if (terminal) return;
    terminal = error;
    lifecycle.reason ||= String(error);
    // The trace limit itself can be the failure. Never let reporting it throw
    // past rejection of the in-flight request and the owner's cleanup path.
    try { note('terminal', {error: String(error), pendingIds: [...pending.keys()]}); } catch {}
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); }
    pending.clear();
    ws.close();
  };
  let openTimer;
  const ready = new Promise((resolve, reject) => {
    openTimer = setTimeout(() => { const e = Error('UNKNOWN CDP connect fixed15000ms'); fail(e); reject(e); }, 15000);
    let settled = false;
    const settle = fn => value => { if (settled) return; settled = true; clearTimeout(openTimer); fn(value); };
    ws.addEventListener('open', settle(() => {
      try { note('socket-open'); resolve(); } catch (e) { fail(e); reject(e); }
    }), {once: true});
    ws.addEventListener('error', settle(() => { const e = Error('UNKNOWN CDP connect error'); fail(e); reject(e); }), {once: true});
    ws.addEventListener('close', settle(() => reject(Error('UNKNOWN CDP connect closed'))), {once: true});
  });
  lifecycle.track(ready);
  const closed = new Promise(resolve => ws.addEventListener('close', resolve, {once: true}));
  const api = {ws, ready, event: () => {}, get closed() { return !!terminal; },
    async close() { requestedClose = true; ws.close(); await closed; },
    send(method, params = {}, sessionId) {
      return lifecycle.track(lifecycle.run('CDP:' + method, () => {
        if (terminal) throw terminal;
        const id = ++serial, sentAt = Date.now(), deadline = sentAt + 15000;
        const request = {id, method, params, ...(sessionId ? {sessionId} : {})};
        // Retain exact navigation params; large script bodies are represented by
        // length only. The actual wire ID and session are always retained.
        const metadata = method === 'Page.navigate' ? params : Object.fromEntries(
          Object.entries(params).filter(([k, v]) => k !== 'source' && k !== 'expression' && ['string','boolean','number'].includes(typeof v)));
        try { note('request', {id, method, params: metadata, sessionId: sessionId ?? null, sentAt, deadline}); }
        catch (e) { fail(e); throw e; }
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            try { note('deadline', {id, method, deadline}); }
            catch (e) { fail(e); return; }
            fail(Error('UNKNOWN ' + method + ' fixed15000ms; no replay'));
          }, 15000);
          pending.set(id, {resolve, reject, timer, sessionId, method});
          try {
            lifecycle.checkpoint('CDP:wire-dispatch');
            ws.send(JSON.stringify(request));
            note('sent', {id, method});
          } catch (e) { fail(e); }
        });
      }));
    },
  };
  ws.addEventListener('close', e => {
    clearTimeout(openTimer);
    try { note('socket-close', {code: e.code, wasClean: e.wasClean, requestedClose}); }
    catch (error) { fail(error); return; }
    if (!requestedClose && !lifecycle.closed) fail(Error('UNKNOWN CDP closed ' + e.code + '; no replay'));
  });
  ws.addEventListener('error', e => {
    try { note('socket-error', {type: e.type, error: String(e.error ?? 'unavailable'), requestedClose}); }
    catch (error) { fail(error); return; }
    if (!requestedClose) fail(Error('UNKNOWN CDP error; no replay'));
  });
  ws.addEventListener('message', message => {
    if (terminal) return;
    try {
    let v;
    try { v = JSON.parse(message.data); } catch (e) { fail(e); return; }
    if (!v.id) {
      const p = v.params || {};
      if (/^(Network\.(requestWillBeSent|responseReceived|loadingFinished|loadingFailed)|Target\.(targetCrashed|targetDestroyed|detachedFromTarget|targetInfoChanged)|Inspector\.(detached|targetCrashed)|Page\.frameStoppedLoading)$/.test(v.method)) {
        note('event', {method: v.method, sessionId: v.sessionId ?? null,
          requestId: p.requestId, targetId: p.targetId, frameId: p.frameId,
          url: p.request?.url ?? p.response?.url, status: p.response?.status,
          errorText: p.errorText, canceled: p.canceled, reason: p.reason,
          encodedDataLength: p.encodedDataLength, blockedReason: p.blockedReason,
          corsErrorStatus: p.corsErrorStatus, type: p.type,
          connectionId: p.response?.connectionId, remoteIPAddress: p.response?.remoteIPAddress,
          remotePort: p.response?.remotePort, protocol: p.response?.protocol,
          targetType: p.targetInfo?.type, targetURL: p.targetInfo?.url});
      }
      // Dispatch remains gated: terminal cancellation cannot start Worker work.
      try { lifecycle.checkpoint('CDP:event'); api.event(v); } catch (e) { fail(e); }
      return;
    }
    const p = pending.get(v.id); if (!p) return;
    note('reply', {id: v.id, method: p.method, sessionId: v.sessionId ?? null,
      error: v.error, ...(p.method === 'Page.navigate' ? {result: v.result} : {})});
    if (v.sessionId !== p.sessionId) { fail(Error('UNKNOWN CDP session changed')); return; }
    clearTimeout(p.timer); pending.delete(v.id);
    if (v.error) { const e = Object.assign(Error(JSON.stringify(v.error)), {cdpError: v.error}); p.reject(e); fail(e); }
    else p.resolve(v.result);
    } catch (e) { fail(e); }
  });
  return api;
}

function observeHTTP(server, record) {
  const note = trace(record);
  let serial = 0;
  // prependListener records arrival before the serving handler executes.
  const incoming = (req, res) => {
    const id = ++serial;
    note('http-arrival', {id, method: req.method, url: req.url,
      localAddress: req.socket.localAddress, localPort: req.socket.localPort,
      remoteAddress: req.socket.remoteAddress, remotePort: req.socket.remotePort});
    res.once('finish', () => note('http-finish', {id, status: res.statusCode}));
    res.once('close', () => note('http-close', {id, finished: res.writableFinished}));
    req.once('aborted', () => note('http-aborted', {id}));
    req.once('error', e => note('http-error', {id, error: String(e)}));
  };
  const listening = () => note('http-listening', {address: server.address()});
  const connection = socket => {
    note('tcp-connection', {localAddress: socket.localAddress, localPort: socket.localPort,
      remoteAddress: socket.remoteAddress, remotePort: socket.remotePort});
    socket.once('error', e => note('tcp-error', {code: e.code, error: String(e)}));
  };
  server.on('listening', listening);
  server.on('connection', connection);
  server.prependListener('request', incoming);
  return () => { server.removeListener('request', incoming); server.removeListener('listening', listening); server.removeListener('connection', connection); };
}

// Run this in an independent Node process before Chrome. It consumes the body
// solely to finish HTTP; evidence contains only its size and connection facts.
function probeLoopback(address, pathname = '/loopback-probe') {
  if (address?.address !== '127.0.0.1' || !Number.isInteger(address.port) || address.port <= 0)
    return Promise.reject(Error('exact IPv4 loopback listen address required'));
  return new Promise((resolve, reject) => {
    const req = require('node:http').get({host: address.address, port: address.port, path: pathname, agent: false}, res => {
      const socket = res.socket, facts = {status: res.statusCode, localAddress: socket.localAddress,
        localPort: socket.localPort, remoteAddress: socket.remoteAddress, remotePort: socket.remotePort};
      let bytes = 0;
      res.on('data', b => { bytes += b.length; });
      res.once('error', reject);
      res.once('end', () => { clearTimeout(timer); resolve({...facts, bytes, complete: res.complete}); });
    });
    const timer = setTimeout(() => req.destroy(Error('loopback GET fixed5000ms')), 5000);
    req.once('error', e => { clearTimeout(timer); reject(e); });
  });
}

async function launchChrome(lifecycle, options) {
  const adopt = options.adopt;
  // Match the installed launcher's disposable Linux runtime. In particular,
  // basic avoids the headful credential-store startup dependency: the matched
  // loopback case without it opened TCP but sent no HTTP within 15 seconds.
  const defaults = ['--bw-timezone=Etc/UTC', '--use-gl=angle', '--use-angle=swiftshader',
    '--password-store=basic', ...require('./browser-component-update-args.cjs')];
  const args = options.args || [];
  const missing = defaults.filter(arg => !args.some(v => v.split('=')[0] === arg.split('=')[0]));
  const deadline = Math.min(lifecycle.deadline, Date.now() + 15000);
  const launchLife = {deadline, run: lifecycle.run.bind(lifecycle), checkpoint(phase) {
    lifecycle.checkpoint(phase);
    if (Date.now() >= deadline) throw Error('UNKNOWN Chrome startup fixed15000ms; no replay');
  }};
  return common.launchChrome(launchLife, {...options, args: [...missing, ...args], adopt(owned) {
    // Installed immediately at spawn, before endpoint readiness awaits.
    owned.child.once('exit', (code, signal) => lifecycle.note('chrome-exit', {pid: owned.child.pid, code, signal}));
    owned.child.once('error', e => lifecycle.note('chrome-error', {error: String(e)}));
    adopt(owned);
  }});
}
module.exports = {...common, connect, launchChrome, observeHTTP, probeLoopback};
