'use strict';
// Explicit preload for the retained Q3 browser-run.cjs. No browser is launched here.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const kind = expression => expression.includes('__mcmPassiveIdentityV1') ? 'page.owner'
  : expression.includes('__mcmPassiveRenderV1') ? 'renderer.owner'
  : expression.includes('__mcmPassiveInstanceV1') ? 'guest.instance' : null;

function install({WebSocket, trace, write, capacity = 64}) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 128) throw Error('capacity 1..128');
  const nonce = crypto.randomUUID(), rows = new Map();
  let dropped = 0, snapshots = 0, observerErrors = 0;
  const safe = fn => { try { return fn(); } catch { observerErrors++; } };
  function timingLimit(row) {
    if (row.markerOrderInvalid) return 'duplicate or reordered execution markers';
    if (!row.entry || !row.exit) return 'entry or exit unavailable';
    const a = row.entry, b = row.exit;
    if (!Number.isInteger(a.executionContextId) || a.executionContextId <= 0 ||
        a.executionContextId !== b.executionContextId) return 'same execution context unavailable';
    if (!Number.isFinite(a.monotonicMs) || !Number.isFinite(b.monotonicMs) ||
        a.monotonicMs < 0 || b.monotonicMs < a.monotonicMs) return 'finite ordered marker clock unavailable';
    return null;
  }
  function snapshot(reason) {
    // Independent Node-side copy; never sends CDP or joins a pending evaluation.
    const value = {version:1, reason, dropped, observerErrors, queueResidenceMs:null,
      limits:'Marker delivery can lag execution. Missing entry is unavailable, not proof of queued execution. No clock subtraction across processes; no GL readiness inference.',
      records:[...rows.values()].map(row => ({...row,
        execution:row.entry ? row.exit ? 'exited' : 'entered; exit unavailable' : 'entry unavailable',
        timingUnavailableReason:timingLimit(row),
        synchronousJsMs:timingLimit(row) === null ? row.exit.monotonicMs - row.entry.monotonicMs : null}))};
    if (snapshots++ < 8) safe(() => write(value));
    return value;
  }
  class ObservedSocket extends WebSocket {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', event => safe(() => {
        const v = JSON.parse(event.data);
        const row = rows.get(JSON.stringify([v.sessionId ?? null, v.id]));
        if (row) {
          row.response = v.error ? 'CDP error' : v.result?.exceptionDetails ? 'JS exception' : 'returned';
          // Preserve genuine returned owner tokens. Never substitute these for a live proof.
          const value = v.result?.result?.value;
          if (value !== undefined) row.ownerResultSha256 = hash(JSON.stringify(value));
        }
        if (v.method !== 'Runtime.consoleAPICalled') return;
        const args = v.params?.args;
        if (args?.[0]?.value !== nonce || typeof args?.[1]?.value !== 'string') return;
        event.stopImmediatePropagation(); // Keep diagnostic traffic out of the consumer's ordinary console log.
        const marker = JSON.parse(args[1].value);
        const target = rows.get(JSON.stringify([v.sessionId ?? null, marker.id]));
        if (!target || !['entry','exit','error'].includes(marker.phase)) return;
        const record = {monotonicMs:marker.ms, executionContextId:v.params.executionContextId,
          consoleTimestamp:v.params.timestamp, receivedAt:Date.now()};
        if (marker.phase === 'entry') {
          if (target.entry || target.exit) target.markerOrderInvalid = true;
          if (!target.entry) target.entry = record;
        } else {
          if (!target.entry || target.exit) target.markerOrderInvalid = true;
          if (!target.exit) { target.exit = record; target.jsResult = marker.phase; target.ownerTokens = marker.ownerTokens; }
        }
      }));
    }
    send(data, ...args) {
      let outgoing = data;
      safe(() => {
        const v = JSON.parse(data), expression = v.params?.expression;
        const type = typeof expression === 'string' && kind(expression);
        if (v.method !== 'Runtime.evaluate' || !type) return;
        const key = JSON.stringify([v.sessionId ?? null, v.id]);
        if (rows.size >= capacity) { rows.delete(rows.keys().next().value); dropped++; }
        rows.set(key, {requestId:v.id, sessionId:v.sessionId ?? null, kind:type,
          expressionSha256:hash(expression), sentAt:Date.now()});
        // The first marker executes inside the actual evaluated JS expression.
        // console CDP events carry its execution context, independently of the response.
        v.params.expression = `(()=>{const emit=(phase,ownerTokens)=>{try{console.debug(${JSON.stringify(nonce)},JSON.stringify({id:${JSON.stringify(v.id)},phase,ms:performance.now(),ownerTokens:JSON.stringify(ownerTokens??null).length<=4096?ownerTokens:'unavailable: token size limit'}));}catch{}};emit('entry');try{const value=(${expression});let tokens;try{const pick=o=>Object.fromEntries(['processId','processObject','endpoint','endpointObject','workerObject','moduleObject','epoch','renderEndpoint','renderEndpointObject','renderWorkerObject','pageRendererObject','canvasObject','endpointIdentity','slot','instance','id','contexts'].filter(k=>o?.[k]!==undefined).map(k=>[k,o[k]]));tokens=Array.isArray(value)?value.slice(0,8).map(pick):value?.apps?value.apps.slice(0,8).map(pick):pick(value);}catch{}emit('exit',tokens);return value;}catch(error){emit('error');throw error;}})()`;
        outgoing = JSON.stringify(v);
      });
      return super.send(outgoing, ...args);
    }
  }
  const original = trace.snapshot;
  trace.snapshot = function(reason, ...args) {
    snapshot(reason);
    return Reflect.apply(original, this, [reason, ...args]);
  };
  return {WebSocket:ObservedSocket, snapshot};
}

module.exports = {install, kind};
if (process.env.Q3_EXECUTION_BOUNDARY_OUT) {
  const consumer = path.resolve(process.argv[1] || '');
  const expected = path.resolve(__dirname, '../scratch/runs/20261108-q3-gl-readiness-gameplay/browser-run.cjs');
  if (consumer !== expected) throw Error('Q3 diagnostic requires the genuine retained browser consumer');
  const output = path.resolve(process.env.Q3_EXECUTION_BOUNDARY_OUT);
  if (!output.endsWith('.jsonl.gz')) throw Error('diagnostic output must end .jsonl.gz');
  const fd = fs.openSync(output, 'wx', 0o600);
  const diagnostic = install({WebSocket:globalThis.WebSocket,
    trace:require(path.join(path.dirname(consumer), 'trace.cjs')),
    write:value => fs.writeSync(fd, zlib.gzipSync(JSON.stringify(value)+'\n'))});
  globalThis.WebSocket = diagnostic.WebSocket;
  process.once('exit', () => { diagnostic.snapshot('process exit'); fs.closeSync(fd); });
}
