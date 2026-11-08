'use strict';
// Native driver adapter: current CDP contexts, durable complete transport, and
// the explicit Software contract. Input and independent releases stay in driver.
const assert = require('node:assert/strict');
const strict = require('./strict-software-gate.cjs');

function create({send:transport, workers, retain, record, save, inspect, now=Date.now}) {
  assert(typeof retain === 'function', 'complete response retention required');
  const scripts = new Map(), contexts = new Map();
  let pageSession, installed=false, unknown=null, gate, sequence=0;
  const fail = reason => { unknown ??= Error('UNKNOWN '+reason+'; no replay'); };
  function event(v) {
    const session=v.sessionId, p=v.params||{};
    const worker=workers.get(session);
    if(v.method==='Target.detachedFromTarget') {
      const w=workers.get(p.sessionId);if(w)w.closed=true;
      if(p.sessionId===pageSession) { scripts.clear(); if(installed)fail('page detached'); }
    }
    if(v.method==='Runtime.executionContextCreated') {
      if(!contexts.has(session))contexts.set(session,new Map());
      const map=contexts.get(session), prior=map.get(p.context.id);
      if(prior && prior!==p.context.uniqueId && installed)fail('context id reused');
      map.set(p.context.id,p.context.uniqueId);
    }
    const cleared=v.method==='Runtime.executionContextsCleared';
    const destroyed=v.method==='Runtime.executionContextDestroyed';
    if(cleared||destroyed) {
      const map=contexts.get(session);
      if(cleared)map?.clear();else map?.delete(p.executionContextId);
      if(session===pageSession) {
        for(const [id,s] of scripts)if(cleared||s.executionContextId===p.executionContextId)scripts.delete(id);
        if(installed)fail('page execution context retired');
      }
      if(worker) {
        worker.scripts=worker.scripts.filter(s=>!cleared&&s.executionContextId!==p.executionContextId);
        // A late byte response can still mutate its old row, but that row is
        // no longer reachable from the current Worker script registry.
        if(installed)fail('Worker execution context retired');
      }
    }
    if(v.method==='Debugger.scriptParsed'&&session===pageSession) {
      if(!contexts.get(session)?.has(p.executionContextId)) {
        if(installed)fail('script without live context');return;
      }
      scripts.set(p.scriptId,{scriptId:p.scriptId,url:p.url,
        scriptLanguage:p.scriptLanguage,executionContextId:p.executionContextId});
    }
  }
  async function send(method,params,session) {
    if(method!=='Debugger.getScriptSource')return transport(method,params,session);
    const request={sequence:++sequence,method,params:structuredClone(params),session,requestAt:now()};
    let response;
    try { response=await transport(method,params,session); }
    catch(error) {
      await retain({...request,responseAt:now(),refused:true,error:String(error)});
      throw error;
    }
    // Retain before returning even malformed or mismatched responses. No cache.
    await retain({...request,responseAt:now(),refused:false,response:structuredClone(response)});
    return response;
  }
  return {send,event,scripts,
    contextLive(session,id) { return contexts.get(session)?.has(id) === true; },
    setPageSession(session) { assert(!pageSession,'one page session');pageSession=session; },
    async install(options) {
      assert(!installed&&!unknown,'one Software installation; no replay');
      installed=true;
      try {
        assert(pageSession,'actual page session required');
        await strict.install({send,pageSession,ownerExpression:options.ownerExpression});
        gate=strict.createSoftwareGate({...options,send,pageSession,workers,scripts,record,save,inspect,now});
      } catch(error) { fail(error.message);throw error; }
    },
    async probe(options) {
      assert(installed&&gate,'Software gate not installed');if(unknown)throw unknown;
      try {
        const result=await gate.probe(options);
        if(unknown)throw unknown;
        return {...result,living:result.qualified,hudCandidate:result.phase==='afterResume'};
      } catch(error) { fail(error.message);throw error; }
    },
    get closed() { return !!unknown||!!gate?.closed; },
  };
}
module.exports={create};
