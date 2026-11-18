'use strict';

const {createGate} = require('./revolt-display-admission.cjs');
const {requireFreshReview} = require('./ltris-display-readiness.cjs');

// Local refusal is safe only before the underlying socket's send is invoked.
// Once invoked, every failure closes the scope, including synchronous throws.
function reviewedConnection(url, scope, {review, record = () => {},
  timeoutMs = 3000, WebSocketClass = WebSocket, now = Date.now} = {}) {
  const gate = createGate(v => { void scope.close(v.reason).catch(() => {}); record({state:'UNKNOWN', ...v}); });
  const ws = new WebSocketClass(url), pending = new Map();
  let sequence = 0, stopped = false, resolveReady, rejectReady;
  const ready = new Promise((r,j) => { resolveReady=r; rejectReady=j; });
  const fail = error => {
    clearTimeout(openTimer); rejectReady(error);
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); }
    pending.clear(); ws.close();
  };
  const unsubscribe = gate.subscribe(fail);
  const openTimer = setTimeout(() => gate.seal('connection timeout'), timeoutMs);
  const api = {ws, ready, event:()=>{}, get closed() { return stopped || gate.closed; },
    stop() { stopped=true; unsubscribe(); fail(Error('host teardown')); },
    seal: reason => gate.seal(reason),
    async send(method, params = {}, sessionId) {
      try {
        return await scope.issue(() => {
          gate.check(); if(stopped) throw Error('transport stopped');
          const id=++sequence, body=JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})});
          const down=method==='Input.dispatchKeyEvent'&&params.type==='keyDown'||
            method==='Input.dispatchMouseEvent'&&params.type==='mousePressed';
          return new Promise((resolve,reject) => {
            const timer=setTimeout(()=>gate.seal(method+' timeout'),timeoutMs);
            pending.set(id,{resolve,reject,timer,sessionId});
            // No await, hashing, identity collection or disk logging between
            // this final review admission and the actual socket call.
            let admittedAt;
            if(down) {
              try { const {command,frame}=review(); admittedAt=now(); requireFreshReview(command,frame,admittedAt); }
              catch(cause) { clearTimeout(timer);pending.delete(id);
                const e=Error('NOT_SENT '+cause.message);e.localNotSent=true;
                record({state:'NOT_SENT',method,at:now(),reason:cause.message});reject(e);return; }
            }
            try { ws.send(body); if(down)record({state:'SENT',method,at:admittedAt,review:review()}); }
            catch(e) { gate.seal(method+' send: '+e); }
          });
        });
      } catch(e) { if(!e.localNotSent) gate.seal(e.message); throw e; }
    },
  };
  ws.onopen=()=>{clearTimeout(openTimer);resolveReady();};
  ws.onerror=()=>{if(!stopped)gate.seal('transport error');};
  ws.onclose=()=>{if(!stopped)gate.seal('transport closed');};
  ws.onmessage=msg=>{
    if(gate.closed||stopped)return;
    try {
      const v=JSON.parse(msg.data); if(!v.id){api.event(v);return;}
      const p=pending.get(v.id);if(!p)return;
      if(v.sessionId!==p.sessionId)throw Error('reply session changed');
      if(v.error||v.result?.exceptionDetails)throw Error(JSON.stringify(v.error||v.result.exceptionDetails));
      clearTimeout(p.timer);pending.delete(v.id);p.resolve(v.result);
    }catch(e){gate.seal(e);}
  };
  return api;
}
module.exports={reviewedConnection};
