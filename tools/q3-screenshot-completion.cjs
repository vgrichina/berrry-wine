'use strict';
// Observe capture traffic and one nonblocking batch of existing owner reads.
// No retry, extra frame, input or guest-clock mutation.
const crypto = require('node:crypto');
const {performance} = require('node:perf_hooks');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const lifecycle = new Set(['Page.frameNavigated','Page.frameDetached','Page.frameStartedLoading',
  'Page.frameStoppedLoading','Page.lifecycleEvent','Runtime.executionContextCreated',
  'Runtime.executionContextDestroyed','Runtime.executionContextsCleared',
  'Target.attachedToTarget','Target.detachedFromTarget','Target.targetDestroyed',
  'Target.targetCrashed','Inspector.targetCrashed']);
function create({trace, write, probe, now = () => performance.now(), capacity = 32}) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 64) throw Error('capacity 1..64');
  const shots = new Map(), owners = new Map(), events = [];
  const recipes = new Map(), reads = new Map(), probes = new Map();
  const ownerKinds = new Set(['page.owner','renderer.owner','renderer.producer','guest.instance']);
  let dropped = 0, observerErrors = 0, lifecycleGeneration = 0;
  const safe = fn => { try { return fn(); } catch { observerErrors++; } };
  const emit = row => safe(() => write({version:1, nodeMs:now(), ...row}));
  const trim = map => { if (map.size >= capacity) { map.delete(map.keys().next().value); dropped++; } };
  function snapshot(reason) {
    if(reason==='command work deadline') for(const r of shots.values())
      if(r.status==='pending') r.commandUnknown=true;
    const value = {reason, dropped, observerErrors, events:[...events],
      records:[...shots.values()].map(r => {
        const at=now();
        return {...r, elapsedMs:(r.settledNodeMs??at)-r.sentNodeMs, ageMs:at-r.sentNodeMs};
      }),
      limits:'Send is transport submission, not compositor entry. No readback/compositor completion is inferred from page or render-owner replies. Missing lifecycle events do not prove continuity. Node intervals only.'};
    emit({event:'snapshot', ...value}); return value;
  }
  const original = trace.snapshot;
  trace.snapshot = function(reason, ...args) { safe(() => snapshot(reason)); return Reflect.apply(original, this, [reason, ...args]); };
  return {
    request(meta, params) { safe(() => {
      if (meta.method === 'Runtime.evaluate' && ownerKinds.has(meta.expression?.kind)) {
        trim(reads); reads.set(meta.requestId, {meta, expression:params.expression, lifecycleGeneration});
        if(meta.captureProbe) {
          const shot=shots.get(meta.captureProbe.shotId);
          if(shot) {
            // At most four per retained screenshot; no arbitrary source/payload logging.
            const row={requestId:meta.requestId, sessionId:meta.sessionId, kind:meta.expression.kind,
              targetId:meta.targetId, lifecycleGeneration, sentNodeMs:now(), status:'pending'};
            shot.probes.push(row); probes.set(meta.requestId,{shot,row});
            emit({event:'owner.probe.request',screenshotId:shot.requestId,...row});
          }
        }
      }
      if (meta.method !== 'Page.captureScreenshot') return;
      if(shots.size>=capacity) {
        const old=shots.values().next().value;
        for(const p of old.probes)probes.delete(p.requestId);
      }
      trim(shots);
      const r = {requestId:meta.requestId, sessionId:meta.sessionId, sentNodeMs:now(),
        params:structuredClone(params), status:'pending', probes:[], ownerRepliesBefore:[...owners.values()]};
      shots.set(meta.requestId, r); emit({event:'screenshot.request', ...r});
    }); },
    submitted(meta) { safe(() => {
      const p=probes.get(meta.requestId);
      if(p){p.row.sendReturnedNodeMs=now();emit({event:'owner.probe.sendReturned',screenshotId:p.shot.requestId,...p.row});return;}
      const r=shots.get(meta.requestId);if(!r)return;
      r.sendReturnedNodeMs=now();emit({event:'screenshot.sendReturned',requestId:r.requestId,sessionId:r.sessionId});
      if(!probe)return;
      // Capture only already successfully read owners. Run after actual send
      // returns, independently of the unresolved screenshot promise. Never
      // serialize guest behind renderer, extend a cap, or schedule a retry.
      const batch=[...recipes.values()];
      queueMicrotask(()=>safe(()=>{
        if(r.status!=='pending'||r.commandUnknown)return;
        for(const recipe of batch) {
          if(recipes.get(recipe.kind)!==recipe)continue; // lifecycle invalidated
          try {
            Promise.resolve(probe({shotId:r.requestId,kind:recipe.kind,sessionId:recipe.sessionId,
              params:{expression:recipe.expression,returnByValue:true,awaitPromise:false}}))
              .catch(error=>emit({event:'owner.probe.rejected',screenshotId:r.requestId,
                kind:recipe.kind,sessionId:recipe.sessionId,error:String(error).slice(0,256)}));
          } catch(error) {emit({event:'owner.probe.rejected',screenshotId:r.requestId,
            kind:recipe.kind,sessionId:recipe.sessionId,error:String(error).slice(0,256)});}
        }
      }));
    }); },
    sendFailed(meta, error) { safe(() => {
      const p=probes.get(meta.requestId);
      if(p){p.row.status='send threw; UNKNOWN';p.row.error=String(error).slice(0,256);
        emit({event:'owner.probe.sendFailed',screenshotId:p.shot.requestId,...p.row});return;}
      const r=shots.get(meta.requestId);if(!r)return;
      r.status='send threw; UNKNOWN';r.sendError=String(error).slice(0,256);
      r.settledNodeMs??=now();
      emit({event:'screenshot.sendFailed',...r});
    }); },
    receive(v, pending) { safe(() => {
      if (lifecycle.has(v.method)) {
        // Fixed scalar fields only; never retain source, screenshots or arbitrary event payloads.
        const p=v.params ?? {}, f=p.frame ?? {}, c=p.context ?? {};
        const row={method:v.method, nodeMs:now(), sessionId:v.sessionId??null,
          affectedSessionId:p.sessionId??null, targetId:p.targetId??p.targetInfo?.targetId??null,
          frameId:p.frameId??f.id??c.auxData?.frameId??null, loaderId:p.loaderId??f.loaderId??null,
          contextId:p.executionContextId??c.id??null, name:p.name??null};
        if(events.length===capacity){events.shift();dropped++;} events.push(row);
        // A replacement/detach invalidates recipes; absence of events still
        // cannot certify continuity. New successful owner reads can rebind.
        if(!['Page.frameStoppedLoading','Page.lifecycleEvent','Target.attachedToTarget'].includes(v.method)) {
          lifecycleGeneration++;
          for(const [kind,recipe] of recipes)
            if(recipe.sessionId===row.sessionId||recipe.sessionId===row.affectedSessionId||
              (row.targetId&&recipe.targetId===row.targetId))recipes.delete(kind);
        }
        if([...shots.values()].some(r=>r.status==='pending')) emit({event:'lifecycle', ...row});
      }
      if (!v.id) return;
      const r=shots.get(v.id), meta=pending?.meta;
      const read=reads.get(v.id);reads.delete(v.id);
      const p=probes.get(v.id);
      if(p) {
        Object.assign(p.row,{responseNodeMs:now(),responseSessionId:v.sessionId??null,
          responseLifecycleGeneration:lifecycleGeneration,
          routePending:!!pending,routeSessionMatches:p.row.sessionId===(v.sessionId??null),
          responseState:v.error?'CDP error':v.result?.exceptionDetails?'JS exception':'returned'});
        if(p.row.status==='pending')p.row.status=p.row.responseState;
        const value=v.result?.result?.value,json=JSON.stringify(value??null);
        p.row.value=Buffer.byteLength(json)<=8192?JSON.parse(json):null;
        emit({event:'owner.probe.response',screenshotId:p.shot.requestId,...p.row});
      }
      if(r) {
        const encoded=v.result?.data;
        Object.assign(r,{responseNodeMs:now(), responseSessionId:v.sessionId??null,
          routePending:!!pending, routeSessionMatches:r.sessionId===(v.sessionId??null),
          status:r.status==='CDP deadline; UNKNOWN'?r.status:v.error?'CDP error':'response received',
          responseState:v.error?'CDP error':'response received', late:!pending||r.commandUnknown===true,
          errorCode:v.error?.code??null, base64Length:typeof encoded==='string'?encoded.length:null,
          dataSha256:typeof encoded==='string'?sha(encoded):null});
        r.settledNodeMs??=r.responseNodeMs;
        emit({event:'screenshot.response', ...r, elapsedMs:now()-r.sentNodeMs});
      }
      if(meta?.method==='Runtime.evaluate' && ownerKinds.has(meta.expression?.kind)) {
        const value=v.result?.result?.value, json=JSON.stringify(value??null);
        const owner={requestId:v.id, sessionId:v.sessionId??null, kind:meta.expression.kind,
          nodeMs:now(), routeSessionMatches:meta.sessionId===(v.sessionId??null),
          result:v.error?'CDP error':v.result?.exceptionDetails?'JS exception':'returned',
          valueSha256:sha(json), valueBytes:Buffer.byteLength(json),
          // Bounded actual PAGE/RENDER owner values retain identities and shared control counters.
          value:Buffer.byteLength(json)<=8192?JSON.parse(json):null};
        const key=JSON.stringify([owner.sessionId,owner.kind]);
        if(!owners.has(key))trim(owners); owners.set(key,owner);
        if(read&&read.lifecycleGeneration===lifecycleGeneration&&!meta.captureProbe&&owner.routeSessionMatches&&owner.result==='returned')
          recipes.set(owner.kind,{kind:owner.kind,sessionId:meta.sessionId,targetId:meta.targetId,expression:read.expression});
        if([...shots.values()].some(r=>r.status==='pending')) emit({event:'owner.reply.duringScreenshot', ...owner});
      }
    }); },
    deadline(meta) { safe(() => {
      reads.delete(meta.requestId);
      const p=probes.get(meta.requestId);
      if(p){if(p.row.status==='pending')p.row.status='CDP deadline; UNKNOWN';p.row.deadlineNodeMs=now();
        emit({event:'owner.probe.deadline',screenshotId:p.shot.requestId,...p.row});return;}
      const r=shots.get(meta.requestId);if(!r)return;
      r.deadlineNodeMs=now();r.status=r.status==='pending'?'CDP deadline; UNKNOWN':r.status;
      r.settledNodeMs??=r.deadlineNodeMs;
      emit({event:'screenshot.deadline', ...r, elapsedMs:now()-r.sentNodeMs});
    }); },
    transport(event) { safe(() => {
      const pendingProbes=[...probes.values()].filter(p=>p.row.status==='pending');
      if(event==='close')for(const p of pendingProbes){p.row.status='transport closed; UNKNOWN';p.row.transportClosedNodeMs=now();}
      emit({event:'transport.'+event,
        pendingScreenshotIds:[...shots.values()].filter(r=>r.status==='pending').map(r=>r.requestId),
        pendingOwnerProbeIds:pendingProbes.map(p=>p.row.requestId)});
    }); },
    snapshot
  };
}
module.exports = {create};
