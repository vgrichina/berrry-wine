'use strict';

const { randomUUID } = require('crypto');
const { performance } = require('perf_hooks');

// Opt-in CLI protocol. References stay in this process; only opaque identity
// and receipts cross the wire. The boundary is explicit: the CLI requires a
// native input return, legacy embedders can observe the host handler only.
// Neither boundary claims guest wndproc execution or a rendered consequence.
// Nonce tombstones live until process exit.
function createGuardedInput({ snapshot, cleanup, validateIntent = () => true,
  nativeDelivery = false, nativeProofRequired = false, captureDelivery = () => null, validateDelivery = () => true,
  captureNativeControl = () => null, confirmNativeControl = () => null,
  now = Date.now, monotonic = () => performance.now(),
  diagnostic = process.env.WINE_PUBLIC_INPUT_TRACE ? require('./cli-public-input-trace').fromEnvironment() : null }) {
  const receipts = new Map();
  const compounds = new Set();
  const nativeTokens = new Map(), edgeTokens = new WeakMap();
  let nextNativeToken = 0;
  let binding = null, epoch = 0;
  const publicReceipt = t => ({ owner: t.owner, epoch: t.epoch, nonce: t.nonce,
    deadline: t.deadline, state: t.state, queued: t.state === 'QUEUED',
    consumed: t.consumed, consumedAt: t.consumedAt || null,
    receiptBoundary: t.receiptBoundary || (nativeDelivery ? 'native-input-return' : 'host-handler'),
    handlerApplied: !!t.appliedAt, appliedAt: t.appliedAt || null,
    nativeMessage: t.nativeMessage || null,
    ...(t.event.charCode === undefined ? {} : {nativeMessages: t.nativeMessages || []}),
    reason: t.reason || null, noReplay: true });
  const same = b => {
    const s = snapshot();
    return s.healthy && Object.keys(b.refs).length === Object.keys(s.refs).length &&
      Object.keys(b.refs).every(k => Object.is(b.refs[k], s.refs[k]));
  };
  const pending = t => t.state === 'QUEUED' || t.state === 'DELIVERY_PENDING';
  const retainedDialog = t => {
    const c=t.dialogClaim;
    if (!c) return false;
    const {e,f}=c;
    // Only the issued native invocation can own scene changes while its
    // callback runs. The native export checks root/depth/epoch custody.
    return f.every((n,i)=>[0,19,20,21,22,31].includes(i) || e.native_dialog_input_fence_word(i)===n) &&
      [1n,2n].includes(e.native_dialog_input_fence_word(0)) &&
      e.get_current_thread_id()===Number(f[3]) && e.get_process_id()===Number(f[4]) &&
      e.wnd_lookup_live(Number(f[5])) && e.wnd_lookup_generation(Number(f[5]))===f[6] &&
      e.get_window_thread(Number(f[5]))===Number(f[3]) &&
      (e.wnd_get_owner(Number(f[5]))>>>0)===Number(f[7]) &&
      e.wnd_lookup_generation(Number(f[7]))===f[8];
  };
  const primary = (t,e) => ({keydown:t.event.charCode === undefined ? [0x100,0x104] : [0x100,0x102],keyup:[0x101,0x105],
    mousedown:[0x201],mouseup:[0x202],mousemove:[0x200]})[t.event.action]?.includes(e.msg);
  const settle = t => {
    diagnostic?.mark('settle', t);
    if (t.resolve) { t.resolve(publicReceipt(t)); t.resolve = null; }
    return publicReceipt(t);
  };
  const purge = t => {
    // Remove only this intent's queued effects; independent UP is untagged.
    const q = t.binding.refs.queue;
    diagnostic?.mark('purge-before', t, { tagged: Array.from(t.events).slice(0, 8).map(diagnostic.edge) });
    for (let i = q.length - 1; i >= 0; i--) if (t.events.has(q[i])) q.splice(i, 1);
    t.events.clear();
    diagnostic?.mark('purge-after', t);
  };
  const cancel = (t, reason, unknown = false) => {
    clearTimeout(t.timer);
    purge(t);
    if (t.state !== 'UNKNOWN') t.state = unknown ? 'UNKNOWN' : 'CANCELLED';
    t.reason = reason;
    // Release is deliberately independent of freshness/owner/expiry. Use the
    // original bound renderer, not a replacement that failed the predicate.
    if (t.needsRelease) {
      t.needsRelease = false;
      try { cleanup(t.binding.refs, t.event); }
      catch (error) { t.state = 'UNKNOWN'; t.reason += '; cleanup: ' + error.message; }
    }
    diagnostic?.mark('cancel', t, { reason: t.reason });
    if (t.resolve) { t.resolve(publicReceipt(t)); t.resolve = null; }
    return publicReceipt(t);
  };
  const valid = t => {
    if (t.state === 'UNKNOWN' || t.state === 'CANCELLED') return false;
    try {
      if (binding !== t.binding || !same(t.binding)) {
        cancel(t, 'owner/epoch/queue/device/window changed'); return false;
      }
      // Focus and modal generations belong to one intent, not the permanent
      // renderer binding. Recheck immediately before effects; after consumption
      // legitimate native focus/capture changes must not obstruct physical UP.
      const prefix = t.prefix || [];
      if (t.state === 'QUEUED' && (prefix.some(p => p.state !== 'CONSUMED' || !p.consumed ||
          !p.needsRelease || p.binding !== t.binding || now() >= p.deadline || monotonic() >= p.until) ||
          !validateIntent(t.intent, t.event, prefix.map(p => p.event.code)))) {
        cancel(t, 'reviewed native scene changed'); return false;
      }
      // The physical handler can legitimately change focus/capture/button
      // state itself. Pin the resulting public context until native delivery,
      // rather than comparing it to the pre-press physical-UP review.
      if (t.state === 'DELIVERY_PENDING' && !(t.dialogClaim ? retainedDialog(t) : validateDelivery(t.deliveryContext))) {
        diagnostic?.mark('delivery-context-changed', t, {expected:t.deliveryContext, actual:captureDelivery()});
        cancel(t, 'native delivery context changed'); return false;
      }
    } catch (error) {
      cancel(t, 'owner inspection error: ' + error.message, true); return false;
    }
    if (now() >= t.deadline || monotonic() >= t.until) {
      cancel(t, 'immutable deadline expired'); return false;
    }
    return true;
  };
  function release(owner, reason = 'independent release') {
    let found = false;
    for (const t of receipts.values()) if (t.owner === owner) {
      found = true;
      if (pending(t) || t.needsRelease || t.events.size) cancel(t, reason);
      diagnostic?.mark('release', t, { reason });
    }
    if (!found && binding?.owner !== owner) throw new Error('unknown guarded owner');
    return { released: true, owner, noReplay: true };
  }
  return {
    bind() {
      if (binding) release(binding.owner, 'owner epoch replaced');
      const s = snapshot();
      if (!s.healthy || !s.refs.queue) throw new Error('guarded input owner is unavailable');
      binding = { owner: randomUUID(), epoch: ++epoch, identity: randomUUID(), refs: Object.freeze({ ...s.refs }) };
      diagnostic?.attach(binding.refs);
      return { owner: binding.owner, epoch, identity: binding.identity, actor: 'CLI Node main thread' };
    },
    prepare(envelope, event, prefix = []) {
      const g = envelope || {};
      if (typeof g.nonce !== 'string' || !g.nonce || g.nonce.length > 256) throw new Error('guarded input requires nonce');
      if (receipts.has(g.nonce) || compounds.has(g.nonce)) throw new Error('guarded nonce already used; inspect status, never replay');
      if (!binding || g.owner !== binding.owner || g.epoch !== binding.epoch || g.identity !== binding.identity)
        throw new Error('guarded owner/epoch/identity mismatch');
      if (g.reviewed !== true) throw new Error('guarded input requires reviewed intent');
      if (!Number.isSafeInteger(g.deadline) || g.deadline - now() > 2147483647)
        throw new Error('guarded input requires finite absolute deadline within timer range');
      const t = { owner: g.owner, epoch: g.epoch, nonce: g.nonce, deadline: g.deadline,
        until: monotonic() + Math.max(0, g.deadline - now()), binding,
        intent: g.intent == null ? null : JSON.parse(JSON.stringify(g.intent)),
        event: Object.freeze({ ...event }), state: 'QUEUED', consumed: false,
        events: new Set(), needsRelease: false, prefix };
      receipts.set(t.nonce, t);
      diagnostic?.mark('prepare', t, { action: t.event.action });
      if (valid(t)) {
        t.timer = setTimeout(() => cancel(t, 'immutable deadline expired'), Math.max(0, t.deadline - now()));
        t.timer.unref();
      }
      return t;
    },
    compound(envelope, events, enqueue) {
      // One declared finite intention, sequenced by actual native receipts.
      // Prefix authority is retained in-process, never supplied over the wire.
      if (!envelope || typeof envelope.nonce !== 'string' || !envelope.nonce || envelope.nonce.length > 200 ||
          receipts.has(envelope.nonce) || compounds.has(envelope.nonce)) throw Error('compound nonce unavailable; never replay');
      if (!Array.isArray(events) || events.length < 2 || events.length > 4 ||
          events.some(e => e.action !== 'keydown' || e.charCode !== undefined || !Number.isInteger(e.code) ||
            e.code < 1 || e.code > 255 || (e.code >= 16 && e.code <= 18) || e.code >= 160) ||
          new Set(events.map(e => e.code)).size !== events.length) throw Error('compound requires distinct nonmodifier key DOWN edges');
      compounds.add(envelope.nonce);
      const prefix = []; let active, cancelled = false;
      const run = (async () => {
        const edges = [];
        for (let i = 0; i < events.length; i++) {
          if (cancelled) break;
          active = this.prepare({...envelope, nonce: envelope.nonce + '/' + i}, events[i], prefix.slice());
          const waiting = this.wait(active);
          if (active.state === 'QUEUED') enqueue(events[i], active);
          const receipt = await waiting; edges.push(receipt);
          if (receipt.state !== 'CONSUMED') break;
          prefix.push(active);
        }
        const complete = !cancelled && edges.length === events.length && edges.every(e => e.state === 'CONSUMED');
        return {owner:envelope.owner, nonce:envelope.nonce, deadline:envelope.deadline,
          state:complete ? 'CONSUMED' : cancelled ? 'UNKNOWN' : edges.at(-1)?.state || 'CANCELLED',
          consumed:complete, consumedAt:complete ? edges.at(-1).consumedAt : null, edges, noReplay:true};
      })();
      run.cancel = reason => { cancelled = true; return active && cancel(active, reason || 'compound transport UNKNOWN', true); };
      return run;
    },
    receipt: publicReceipt,
    wait(t) {
      diagnostic?.mark('wait', t);
      const p = new Promise(resolve => {
        if (!pending(t)) resolve(publicReceipt(t)); else t.resolve = resolve;
      });
      p.cancel = reason => cancel(t, reason || 'transport UNKNOWN', true);
      return p;
    },
    consume(t, effect) {
      if (t.state !== 'QUEUED' || !valid(t)) return publicReceipt(t);
      // Claim before invoking anything capable of a physical/native effect.
      t.state = 'CONSUMING';
      const q = t.binding.refs.queue, previous = new Set(q);
      t.needsRelease = /^(keydown|mousedown)$/.test(t.event.action);
      diagnostic?.mark('handler-enter', t);
      try {
        const nativeFence = nativeDelivery ? captureNativeControl(t.event,t.intent) : null;
        effect(t.event);
        t.appliedAt = now();
        diagnostic?.mark('handler-return', t);
        const nativeControl = nativeFence && confirmNativeControl(nativeFence,t.event,t.intent);
        if (nativeControl && (now()>=t.deadline || monotonic()>=t.until))
          return cancel(t,'native control returned after immutable deadline',true);
        t.state = nativeDelivery && !nativeControl ? 'DELIVERY_PENDING' : 'CONSUMED';
        if (nativeControl) {
          t.consumed=true;t.consumedAt=t.appliedAt;
          t.receiptBoundary=nativeControl.receiptBoundary || 'native-button-dispatch-return';t.nativeMessage=nativeControl;
        }
        else if (nativeDelivery) t.deliveryContext = captureDelivery();
        else { t.consumed = true; t.consumedAt = t.appliedAt; }
      } catch (error) {
        // A throwing handler may already have effected input: UNKNOWN stays
        // terminal even if a later cleanup succeeds.
        for (const e of q) if (!previous.has(e) && ![0x101, 0x105, 0x202, 0x205, 0x208].includes(e.msg)) t.events.add(e);
        return cancel(t, 'effect error: ' + error.message, true);
      }
      for (const e of q) if (!previous.has(e) && ![0x101, 0x105, 0x202, 0x205, 0x208].includes(e.msg)) t.events.add(e);
      if (nativeDelivery && t.state === 'DELIVERY_PENDING') {
        // Keep the exact identity of the edge produced by this handler. A
        // movement/hit-test, an unrelated poll, or disappearance/coalescing
        // cannot forge acknowledgement of DOWN.
        t.deliveryEvents = new Set(q.filter(e => !previous.has(e) && primary(t,e)));
        if (t.event.charCode !== undefined) {
          const edges = [...t.deliveryEvents];
          if (edges.length !== 2 || edges[0].msg !== 0x100 || edges[0].wParam !== t.event.code ||
              edges[1].msg !== 0x102 || edges[1].wParam !== t.event.charCode ||
              edges[0].lParam !== edges[1].lParam)
            return cancel(t, 'handler did not produce exact physical DOWN and character pair', true);
          t.nativeMessages = [];
        }
        diagnostic?.mark('delivery-pending', t, { edges: Array.from(t.deliveryEvents).slice(0, 8).map(diagnostic.edge) });
        if (!t.deliveryEvents.size) return cancel(t, 'handler produced no native input edge', true);
      } else settle(t);
      return publicReceipt(t);
    },
    delivered(event, proof) {
      if (!nativeDelivery || !event) return;
      if(nativeProofRequired&&!proof)return false;
      for (const t of receipts.values()) {
        if (t.state !== 'DELIVERY_PENDING' || !t.deliveryEvents.has(event)) continue;
        diagnostic?.mark('native-input-return-candidate', t, { event: diagnostic.edge(event) });
        if (!valid(t)) return false;
        if (t.event.charCode !== undefined && event !== t.deliveryEvents.values().next().value)
          return !!cancel(t, 'native character returned before physical DOWN', true).consumed;
        t.events.delete(event);
        t.deliveryEvents.delete(event);
        t.nativeMessage = Object.fromEntries(['hwnd','msg','wParam','lParam'].map(k=>[k,event[k]>>>0]));
        if(proof)t.nativeMessage={...t.nativeMessage,hwnd:proof.hwnd>>>0,threadId:proof.threadId>>>0,
          token:proof.token,nonce:t.nonce,consumption:'owner-user-return',apiKind:proof.apiKind,remove:!!proof.remove};
        if (t.event.charCode !== undefined) {
          t.nativeMessages.push(t.nativeMessage);
          if (t.deliveryEvents.size) return true;
        }
        t.consumed = true; t.consumedAt = now(); t.state = 'CONSUMED';
        settle(t);
        return true;
      }
    },
    dequeued(event) {
      for (const t of receipts.values()) {
        if (t.state !== 'DELIVERY_PENDING' || !t.deliveryEvents.has(event)) continue;
        if (!valid(t)) return false;
        if (edgeTokens.has(event)) return edgeTokens.get(event);
        if (nextNativeToken >= 0x3fffffff) { cancel(t,'native token space exhausted',true); return false; }
        const token=++nextNativeToken;
        edgeTokens.set(event,token);nativeTokens.set(token,{t,event});
        diagnostic?.mark('native-dequeue-candidate',t,{token,event:diagnostic.edge(event)});
        return token;
      }
      return 0;
    },
    token(event) { return event && edgeTokens.get(event) || 0; },
    nativeValid(token, buffer) {
      const entry=nativeTokens.get(token);
      if (!entry || entry.t.binding.refs.buffer!==buffer) return false;
      // Confirmation deadlines govern unconfirmed intents. A confirmed
      // PM_NOREMOVE MSG remains an ordinary native cached message after UP.
      // It can never create a second confirmation or survive owner retirement.
      if (entry.t.consumed && entry.t.nativeMessage?.consumption==='owner-user-return') {
        try { return entry.t.state!=='UNKNOWN' && binding===entry.t.binding && same(entry.t.binding); }
        catch { return false; }
      }
      return entry.t.state==='DELIVERY_PENDING' && valid(entry.t);
    },
    nativeConsumed(token, proof) {
      const entry=nativeTokens.get(token);
      if (!entry || !this.nativeValid(token,proof.buffer)) return false;
      const {t,event}=entry,refs=t.binding.refs;
      if (t.dialogClaim) return false; // this callback has its own return boundary
      if (t.event.charCode !== undefined && (!refs.hwnd || (refs.hwnd>>>0)!==(proof.hwnd>>>0))) return false;
      if (proof.actorExports!==refs.actorExports || ![1,2,3].includes(proof.apiKind) || ![0,1].includes(proof.remove) ||
          (proof.apiKind!==2 && proof.remove!==1) ||
          (proof.threadId>>>0)!==(refs.tid>>>0) ||
          refs.actorExports?.get_window_thread?.(proof.hwnd)!==(proof.threadId>>>0) ||
          ['msg','wParam','lParam'].some(k=>(event[k]>>>0)!==(proof[k]>>>0)) ||
          (event.hwnd && (event.hwnd>>>0)!==(proof.hwnd>>>0))) return false;
      if(t.consumed || entry.confirmed)return true; // cached PM_NOREMOVE then ordinary remove
      const accepted=!!this.delivered(event,{...proof,token});
      if(accepted)entry.confirmed=true;
      return accepted;
    },
    nativeDialogInput(token, proof) {
      const entry=nativeTokens.get(token);
      if (!entry) return false;
      const {t,event}=entry, refs=t.binding.refs, e=proof.actorExports, f=proof.fence;
      if (t.state!=='DELIVERY_PENDING' || t.event.charCode!==undefined || proof.buffer!==refs.buffer || e!==refs.actorExports ||
          proof.remove!==1 || proof.threadId!==(refs.tid>>>0) ||
          !Array.isArray(f) || f.length!==32 || f.some(n=>typeof n!=='bigint') ||
          f.some((n,i)=>e.native_dialog_input_fence_word(i)!==n) || f[27]!==0x44494e50n ||
          f[1]!==BigInt(token) || f[2]!==BigInt(proof.ptr) || f[3]!==BigInt(proof.threadId) ||
          !f[4] || !f[5] || !f[6] || !f[10] || !f[11] || !f[12] || !f[13] || !f[14] || !f[23] || !f[24] || !f[25] || !f[29] || !f[30] ||
          e.get_current_thread_id()!==proof.threadId || e.get_process_id()!==Number(f[4]) ||
          ['hwnd','msg','wParam','lParam'].some((k,i)=>f[15+i]!==BigInt(proof[k]>>>0)) ||
          ['msg','wParam','lParam'].some(k=>(event[k]>>>0)!==(proof[k]>>>0)) ||
          (event.hwnd && (event.hwnd>>>0)!==proof.hwnd) || f[9]!==f[15]) return false;
      if (proof.apiKind===6) {
        if (f[0]!==1n || t.dialogClaim || !this.nativeValid(token,proof.buffer) ||
            e.dialogbox_hwnd()!==Number(f[5]) ||
            e.wnd_lookup_generation(proof.hwnd)!==f[10] || !e.wnd_lookup_live(proof.hwnd) ||
            e.get_window_thread(proof.hwnd)!==proof.threadId ||
            (e.wnd_get_proc_export(proof.hwnd)>>>0)!==Number(f[30])) return false;
        t.dialogClaim={e,f:Object.freeze(f.slice()),event,ptr:proof.ptr};
        if (!retainedDialog(t)) {t.dialogClaim=null;return false;}
        diagnostic?.mark('dialog-input-entry',t,{fence:f.map(String)});
        return true;
      }
      const claim=t.dialogClaim;
      if (proof.apiKind!==7 || f[0]!==2n || !claim || claim.event!==event || claim.ptr!==proof.ptr ||
          claim.f.some((n,i)=>![0,19,20,21,22,31].includes(i)&&n!==f[i])) return false;
      if (!valid(t)) return false;
      // The enclosing dialog must survive until its callback unwinds. The
      // input target may have been destroyed by that callback, never reused.
      const targetGeneration=e.wnd_lookup_generation(proof.hwnd);
      if (((targetGeneration || e.wnd_lookup_live(proof.hwnd)) && targetGeneration!==f[10]) ||
          e.dialogbox_hwnd()!==Number(f[5]) || f[21]!==f[5] || f[22]!==f[6] || f[31]!==f[29] ||
          e.wnd_lookup_generation(Number(f[19]))!==f[20] ||
          (f[19] && (!f[20] || e.get_window_thread(Number(f[19]))!==proof.threadId ||
            e.wnd_top_level(Number(f[19]))!==Number(f[5]))))
        return !!cancel(t,'native dialog return lifetime changed',true).consumed;
      t.events.delete(event);t.deliveryEvents.clear();t.dialogClaim=null;
      t.consumed=true;t.consumedAt=now();t.state='CONSUMED';
      t.receiptBoundary='native-dialog-input-invocation-return';
      t.nativeMessage={hwnd:proof.hwnd,msg:proof.msg,wParam:proof.wParam,lParam:proof.lParam,
        generation:String(f[10]),processId:Number(f[4]),threadId:proof.threadId,token,nonce:t.nonce,
        consumption:'owner-dialog-input-return',invocation:String(f[12]),root:String(f[13]),depth:Number(f[14]),
        invocationEpoch:String(f[23]),dialogHwnd:Number(f[5]),dialogGeneration:String(f[6]),
        callback:Number(f[25]),entryStack:Number(f[24]),focusAfter:Number(f[19]),focusGenerationAfter:String(f[20]),apiKind:7,remove:true};
      diagnostic?.mark('dialog-input-return',t,{fence:f.map(String)});
      settle(t);return true;
    },
    nativeModal(token, proof) {
      const entry=nativeTokens.get(token);
      if (!entry) return false;
      const {t,event}=entry, refs=t.binding.refs, f=proof.fence, e=proof.actorExports;
      if (!Array.isArray(f) || f.length!==24 || f.some(n=>typeof n!=='bigint') ||
          proof.buffer!==refs.buffer || e!==refs.actorExports || proof.remove!==1 ||
          proof.threadId!==(refs.tid>>>0) || f.some((n,i)=>e.native_modal_key_fence_word?.(i)!==n) || f[1]!==BigInt(token) || f[2]!==BigInt(proof.ptr) ||
          f[3]!==BigInt(proof.threadId) || !f[4] || !f[6] || !f[10] || !f[11] || !f[12] || !f[13] || !f[14] || !f[23] ||
          ['hwnd','msg','wParam','lParam'].some((k,i)=>f[15+i]!==BigInt(proof[k]>>>0)) ||
          ['msg','wParam','lParam'].some(k=>(event[k]>>>0)!==(proof[k]>>>0)) ||
          (event.hwnd && (event.hwnd>>>0)!==proof.hwnd) || f[9]!==f[15] ||
          e.get_current_thread_id()!==proof.threadId || e.get_process_id()!==Number(f[4])) return false;
      if (proof.apiKind===4) {
        if (f[0]!==1n || t.nativeModalClaim || !this.nativeValid(token,proof.buffer) ||
            e.modal_dialog_hwnd()!==Number(f[5]) ||
            e.wnd_lookup_generation(Number(f[5]))!==f[6] || e.wnd_lookup_generation(Number(f[9]))!==f[10] ||
            e.wnd_lookup_generation(Number(f[7]))!==f[8] || e.get_window_thread(Number(f[5]))!==proof.threadId ||
            e.get_window_thread(proof.hwnd)!==proof.threadId) return false;
        t.nativeModalClaim=Object.freeze({f:Object.freeze(f.slice()),event,ptr:proof.ptr});
        return true;
      }
      const claim=t.nativeModalClaim;
      if (proof.apiKind!==5 || f[0]!==2n || !claim || t.state!=='DELIVERY_PENDING' ||
          claim.event!==event || claim.ptr!==proof.ptr || claim.f.slice(1,19).some((n,i)=>n!==f[i+1]) || claim.f[23]!==f[23]) return false;
      // Exact native return owns these consequences. Ordinary API returns keep
      // their delivery-context predicate; this proof cannot authorize those.
      if (binding!==t.binding || !same(t.binding) || now()>=t.deadline || monotonic()>=t.until ||
          e.wnd_lookup_generation(Number(f[7]))!==f[8] ||
          e.wnd_lookup_generation(Number(f[19]))!==f[20] ||
          e.modal_dialog_hwnd()!==Number(f[21]) || e.wnd_lookup_generation(Number(f[21]))!==f[22])
        return !!cancel(t,'native modal return lifetime changed',true).consumed;
      const traversal=proof.msg===0x100&&proof.wParam===9;
      const completion=proof.msg===0x100&&[13,27].includes(proof.wParam);
      if (traversal ? (f[21]!==f[5] || f[22]!==f[6] || !f[20] || e.get_window_thread(Number(f[19]))!==proof.threadId) :
          completion ? (f[21]!==0n && (f[21]!==f[5] || f[22]!==f[6])) :
          (f[21]!==f[5] || f[22]!==f[6] || f[19]!==f[9] || f[20]!==f[10])) return false;
      t.nativeModalClaim=null;
      t.events.delete(event);t.deliveryEvents.clear();
      t.consumed=true;t.consumedAt=now();t.state='CONSUMED';
      t.receiptBoundary='native-modal-invocation-return';
      t.nativeMessage={hwnd:proof.hwnd,msg:proof.msg,wParam:proof.wParam,lParam:proof.lParam,
        threadId:proof.threadId,token,nonce:t.nonce,consumption:'owner-modal-return',
        invocation:String(f[12]),root:String(f[13]),depth:Number(f[14]),apiKind:5,remove:true};
      settle(t);return true;
    },
    sweep() {
      for (const t of receipts.values()) if (pending(t) || t.needsRelease || t.events.size) valid(t);
    },
    status(nonce) {
      const t = receipts.get(nonce);
      if (!t) throw new Error('unknown guarded nonce');
      if (pending(t) || t.needsRelease || t.events.size) valid(t);
      return publicReceipt(t);
    },
    release,
    abandon(reason) {
      // A retained native fault allows host teardown only, never renderer
      // callbacks. The fault latch clears physical/device maps separately.
      for (const t of receipts.values()) {
        t.needsRelease = false;
        if (pending(t) || t.events.size) cancel(t, reason, true);
        clearTimeout(t.timer);
      }
    },
    close() {
      if (binding) release(binding.owner, 'CLI shutdown');
      diagnostic?.flush();
    },
  };
}

module.exports = { createGuardedInput };
