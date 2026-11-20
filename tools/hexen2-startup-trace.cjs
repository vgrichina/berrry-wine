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
// Serialized into a run-local host overlay only. Install at the host factory's
// final return, after native guard registration AND the host-write wrappers.
// Observation must never replace a guest return, exception, or actor scope.
function installUserReturnObserver(h, owner, record) {
  const user = [], calls = [];
  let actor = null, stopped = false, emitted = 0, sequence = 0;
  const attempt = fn => {
    if (stopped) return;
    try { fn(); } catch (error) {
      stopped = true;
      try { record({kind:'observer-stop', error:String(error).slice(0,256)}); } catch {}
    }
  };
  const emit = row => {
    if (++emitted > 128) throw Error('UNKNOWN Hexen observer finite128 limit');
    record({at:Date.now(), sequence:++sequence, ...row});
  };
  const remember = (list, row) => { list.push(row); if (list.length > 32) list.shift(); };
  const scope = h.browserInputScope;
  if (!scope || typeof scope.withActor !== 'function' || typeof h.input_consumed !== 'function')
    throw Error('Hexen observer requires final native guard callbacks');
  const originalActor = scope.withActor;
  scope.withActor = function(slot, name, fn) {
    const previous = actor; actor = {slot, name};
    try { return originalActor.call(this, slot, name, fn); }
    finally { actor = previous; }
  };
  const consumed = h.input_consumed;
  h.input_consumed = function(...args) {
    // Call exactly once with the original receiver, arguments and active scope.
    // An original exception bypasses observation and propagates unchanged.
    const result = consumed.apply(this, args);
    attempt(() => {
      const [token, threadId, ptr, apiKind, remove] = args;
      const p = args[15] >>> 0, buffer = owner.memory.buffer;
      if (args.length !== 16 || p > buffer.byteLength - 16) throw Error('UNKNOWN native MSG metadata');
      const view = new DataView(buffer);
      const row = {kind:'native-user-return', token, threadId, ptr, apiKind, remove,
        result, actor:actor && {...actor}, scene:args.slice(5,15),
        message:Array.from({length:4},(_,i)=>view.getUint32(p+4*i,true))};
      remember(calls, row); emit(row);
    });
    return result;
  };
  const log = h.log;
  h.log = function(ptr, len, ...stack) {
    attempt(() => {
      // TextDecoder rejects SharedArrayBuffer views in some engines. Copy only
      // the bounded API name; never retain or print bytecode or memory bodies.
      const bytes = new Uint8Array(owner.memory.buffer, ptr, Math.min(len,128));
      const name = new TextDecoder().decode(Uint8Array.from(bytes)).replace(/\0.*$/,'');
      if (/^(GetMessage[AW]|PeekMessage[AW]|DispatchMessage[AW]|PostQuitMessage|ExitProcess)$/.test(name)) {
        if (stack.length < 10) throw Error('UNKNOWN forwarded guest register snapshot');
        const row = {name, at:Date.now(), actor:actor && {...actor}, esp:stack[0]>>>0,
          return:stack[1]>>>0, args:stack.slice(2,7).map(n=>n>>>0)};
        remember(user,row);
        if (name === 'ExitProcess') {
          const e = owner.instance.exports;
          if (typeof e.guest_read32 !== 'function') throw Error('UNKNOWN guest stack reader');
          emit({kind:'guest-pre-exit', ...row,
            words:Array.from({length:64},(_,i)=>e.guest_read32(row.esp+4*i)>>>0),
            user:user.slice(), calls:calls.slice()});
        }
      }
    });
    return log.call(this, ptr, len, ...stack);
  };
  attempt(() => emit({kind:'observer-installed', afterFinalHostCallbacks:true}));
}

function userReturnOverlay(host) {
  const needle = '    return { host: h, gdi: base.gdi, __captureWin16FarFault: captureWin16FarFault };';
  const at = host.indexOf(needle);
  if (at < 0 || at !== host.lastIndexOf(needle) ||
      host.lastIndexOf('h.input_consumed=',at) < 0 ||
      host.lastIndexOf('for (const [name, fn] of Object.entries(h))',at) < 0)
    throw Error('UNKNOWN Hexen final host callback installation point');
  return host.replace(needle, `    (${installUserReturnObserver.toString()})(h, self, row => console.log('HEXEN_USER_WITNESS', JSON.stringify(row)));\n` + needle);
}

// The page's idle WASM instance cannot supply EAX. Read it only on the
// executing Worker's existing log_api_exit callback, without another RPC.
function installWorkerUserObserver(host, memory, getExports, slot, record) {
  const entries=[], returns=[];
  let stopped=false, emitted=0;
  const attempt=fn=>{if(stopped)return;try{fn();}catch(error){stopped=true;try{record({kind:'worker-observer-stop',error:String(error).slice(0,256)});}catch{}}};
  const emit=row=>{if(++emitted>128)throw Error('UNKNOWN Hexen worker observer finite128 limit');record({at:Date.now(),slot,...row});};
  const log=host.log,exit=host.log_api_exit;
  host.log=function(ptr,len,...args){
    attempt(()=>{
      const name=new TextDecoder().decode(Uint8Array.from(new Uint8Array(memory.buffer,ptr,Math.min(len,128)))).replace(/\0.*$/,'');
      if(entries.length>=32)throw Error('UNKNOWN nested API observer limit');
      const interested=/^(GetMessage[AW]|PeekMessage[AW]|DispatchMessage[AW]|PostQuitMessage|ExitProcess)$/.test(name);
      const e=getExports(),esp=interested?e.get_esp()>>>0:0;
      const row=interested?{name,esp,return:e.guest_read32(esp)>>>0,args:Array.from({length:5},(_,i)=>e.guest_read32(esp+4+4*i)>>>0)}:null;
      entries.push(row);
      if(name==='ExitProcess')emit({kind:'worker-pre-exit',entry:row,
        words:Array.from({length:64},(_,i)=>e.guest_read32(esp+4*i)>>>0),returns:returns.slice()});
    });
    return log.call(this,ptr,len,...args);
  };
  host.log_api_exit=function(...args){
    attempt(()=>{
      const entry=entries.pop();if(!entry)return;
      const e=getExports(),row={kind:'guest-user-api-return',entry,eax:e.get_eax()>>>0,eip:e.get_eip()>>>0,esp:e.get_esp()>>>0};
      returns.push(row);if(returns.length>32)returns.shift();
      // Retain idle returns in the ring, without a broad stream of polls.
      if(row.eax||/^Dispatch|^PostQuit/.test(entry.name))emit(row);
    });
    return exit.apply(this,args);
  };
}

function workerUserReturnOverlay(source) {
  const needle='    return {\n      imports: { host: Object.assign({ memory }, host) },';
  if(source.indexOf(needle)<0||source.indexOf(needle)!==source.lastIndexOf(needle))
    throw Error('UNKNOWN Hexen final Worker callback installation point');
  return source.replace(needle,`    (${installWorkerUserObserver.toString()})(host, memory, opts.getExports, slot, row => console.log('HEXEN_WORKER_WITNESS', JSON.stringify(row)));\n`+needle);
}

module.exports = {...common, connect, launchChrome, observeHTTP, probeLoopback,
  installUserReturnObserver, userReturnOverlay, installWorkerUserObserver, workerUserReturnOverlay};
