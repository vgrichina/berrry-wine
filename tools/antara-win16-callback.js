'use strict';
// Private diagnostic overlay only. Decode the existing --trace-win16 stream;
// never confuse its API-handler exit with a guest callback's RETF.
const MARKERS = Object.freeze({0xca16a9eb: ['route', 6], 0xca16a9f0: ['call', 15], 0xca16a9ef: ['handler-exit', 6]});
const INPUT = new Set([0x200, 0x201, 0x202, 0x203, 0x111, 0x20, 0x21, 0x84]);
const USER = new Set([18, 19, 22, 23, 28, 29, 50, 53, 76, 87, 107, 108, 111, 114, 122, 124, 125, 218, 219]);
// Candidate return offsets only; OFFLINE original-code/selector checks are
// required before calling these Install boundaries. No generic API polling.
const INSTALL_USER = new Map([[46, [0xdafc, 0xdb2f]], [59, [0xdb0f]], [42, [0xdb23]], [124, [0xdb42]]]);

function createObserver({getExports, getMemory, slot, now = Date.now, cpuNow = () => performance.now(), baselineTrace, maxRows = 128, maxBytes = 32768, durationMs = 8000, maxWords = 65536, maxCpuMs = 100}) {
  if (baselineTrace !== 0) throw Error('pinned trace-disabled baseline required');
  if (!Number.isInteger(maxRows) || maxRows < 4 || maxRows > 256 || !Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > 32768 || !Number.isInteger(durationMs) || durationMs < 1 || durationMs > 8000) throw Error('observer bounds');
  if (!Number.isInteger(maxWords) || maxWords < 32 || maxWords > 65536 || !(maxCpuMs > 0 && maxCpuMs <= 100)) throw Error('raw bounds');
  let active = false, ever = false, deadline = 0, pending = null, lastCall = null, phase = 'down', context = false;
  let errors = 0, reason = null, unknown = 0, traceWords = 0;
  let flagRestoreError = null;
  const partial = [];
  let token = null, released = false, hoverMode = false, pressed = false;
  const raw = {down: 0, up: 0}, cpu = {down: 0, up: 0};
  const rows = [], bytes = {down: 0, up: 0}, counts = {down: 0, up: 0}, omitted = {down: 0, up: 0}, half = Math.floor(maxBytes / 2);
  const phaseShare = () => hoverMode && phase !== 'up' ? 0.5 : 1;
  const byteQuota = () => phase === 'trap' ? 2048 : Math.floor(half * phaseShare()) - (phase === 'up' ? Math.min(2048, half / 2) : 0);
  const rowQuota = () => Math.floor(maxRows / 2 * phaseShare());
  const rawQuota = () => Math.floor(maxWords * phaseShare());
  const cpuQuota = () => maxCpuMs * phaseShare();
  function stop(why) { const restore = active; active = false; if(pending)partial.push({phase,reason:why,...pending});pending = null; if(restore||reason===null)reason = why; if(restore)try{getExports().set_win16_trace(0);}catch(e){errors++;flagRestoreError=String(e);} }
  function live() { if (active && now() >= deadline) stop('deadline'); return active; }
  function guard() {if(!live())throw Error('observer deadline');}
  function checked(fn) {guard();const value=fn();guard();return value;}
  function snapshot(record) {
    const e = checked(getExports), result = {};
    for (const n of ['get_current_thread_id', 'get_eip', 'get_esp', 'get_ebp', 'get_eax', 'get_edx', 'get_sreg_cs', 'get_sreg_ss', 'get_sreg_ds', 'win16_last_module', 'win16_last_ordinal']) result[n] = checked(()=>e[n]()) >>> 0;
    const buffer=checked(getMemory);
    function span(guest, length) {
      if (bytes[phase] + length > byteQuota()) return {omitted: 'phase byte cap'};
      const wa = checked(()=>e.guest_to_wasm(guest)) >>> 0;
      if (wa < 256 || wa + length > checked(()=>buffer.byteLength)) throw Error('unmapped span');
      const copied = [];
      const view = checked(()=>new Uint8Array(buffer, wa, length));
      for (let i = 0; i < length; i++) copied.push(checked(()=>view[i]));
      bytes[phase] += length;
      return {guest, wasm: wa, bytes: copied};
    }
    const ss = result.get_sreg_ss >>> 3, cs = result.get_sreg_cs >>> 3;
    result.ssBase = checked(()=>e.win16_seg_base(ss)) >>> 0; result.ssLimit = checked(()=>e.win16_seg_limit(ss)) >>> 0;
    result.csBase = checked(()=>e.win16_seg_base(cs)) >>> 0; result.csLimit = checked(()=>e.win16_seg_limit(cs)) >>> 0;
    const sp = result.get_esp - result.ssBase, bp = result.get_ebp & 0xffff;
    if (sp >= 0 && sp + 96 <= result.ssLimit) result.stack = span(result.get_esp, 96);
    if (bp >= 32 && bp + 96 <= result.ssLimit) result.frame = span(result.ssBase + bp - 32, 128);
    if (record.kind === 'call' && record.words[0] === 0x2004c) {
      const offset = record.words[4] & 0xffff, selector = record.words[5] & 0xffff;
      const limit = checked(()=>e.win16_seg_limit(selector >>> 3)) >>> 0;
      if (selector && offset + 8 <= limit) result.ptInRect = {x: (record.words[2] << 16) >> 16, y: (record.words[3] << 16) >> 16, selector, offset, rect: span((checked(()=>e.win16_seg_base(selector >>> 3)) >>> 0) + offset, 8)};
    }
    // ret_lin is a guest linear address from win16_dispatch, not EIP, which
    // can still name the start of the block that pushed the API arguments.
    const ret = record.kind === 'call' ? record.words[1] : result.get_eip;
    if (ret >= result.csBase + 48 && ret + 48 <= result.csBase + result.csLimit) result.caller = span(ret - 48, 96);
    // Existing Pascal frame chain at the original CallWindowProc boundary.
    // Retain candidates for OFFLINE original-relocation authentication. Do
    // not presume a selector names original segment 4 or that BP+6 is an
    // application object until the saved caller code authenticates.
    if (record.kind === 'call' && (phase === 'trap' || (record.words[0] === 0x2007a && [0x200,0x201,0x202].includes(record.words[5])) || record.words[0] === 0x2007d || (phase === 'down' && INSTALL_USER.get(record.words[0] & 0xffff)?.includes(record.words[1] & 0xffff)))) {
      result.savedFrames = [];
      const seen = new Set(); let cursor = bp;
      for (let i = 0; i < 3 && !seen.has(cursor); i++) {
        if (cursor < 32 || cursor + 10 > result.ssLimit) break;
        seen.add(cursor);
        const frame = span(result.ssBase + cursor, 10);
        if (!frame.bytes) break;
        const u = at => frame.bytes[at] | (frame.bytes[at+1] << 8);
        const saved = {bp: cursor, frame, previousBp: u(0), returnOffset: u(2), returnSelector: u(4), objectOffsetCandidate: u(6), objectSelectorCandidate: u(8)};
        result.savedFrames.push(saved);
        if (saved.returnSelector && (saved.returnSelector & 7) === 7) {
          saved.codeBase = checked(()=>e.win16_seg_base(saved.returnSelector >>> 3)) >>> 0;
          saved.codeLimit = checked(()=>e.win16_seg_limit(saved.returnSelector >>> 3)) >>> 0;
          if (saved.returnOffset >= 208 && saved.returnOffset + 48 <= saved.codeLimit) saved.code = span(saved.codeBase + saved.returnOffset - 208, 256);
        }
        // Only the same owning data/stack selector, a bounded offset, and a
        // non-null candidate. No historic 008f/655a address is baked in.
        if (saved.objectSelectorCandidate === result.get_sreg_ss && saved.objectOffsetCandidate && saved.objectOffsetCandidate + 0x1e8 <= result.ssLimit) {
          saved.objectHeaderCandidate = span(result.ssBase + saved.objectOffsetCandidate, 4);
          saved.objectGatesCandidate = span(result.ssBase + saved.objectOffsetCandidate + 0x1c4, 36);
        }
        if (saved.previousBp <= cursor) break;
        cursor = saved.previousBp;
      }
    }
    return result;
  }
  function add(record, heavy = false) {
    if (!live()) return;
    if (counts[phase] >= rowQuota()) { omitted[phase]++; return; }
    const row = {...record, slot, phase, at: now()};
    if (heavy && bytes[phase] < byteQuota()) { try { row.owner = snapshot(record); } catch (e) { errors++; row.error = String(e); } }
    rows.push(row); counts[phase]++;
  }
  function activate(id, nextPhase = 'down') {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw Error('activation token');
    if (!['hover','down','up'].includes(nextPhase)) throw Error('activation phase');
    const beginning = !ever && nextPhase !== 'up';
    if (!beginning && nextPhase === 'hover') throw Error('activation already used');
    if (!beginning && nextPhase === 'down' && (!hoverMode || pressed || token !== id || phase !== 'hover' || now() >= deadline || errors || flagRestoreError)) throw Error('DOWN activation rejected');
    if (nextPhase === 'up' && (!ever || !pressed || token !== id || released || now() >= deadline || errors || flagRestoreError)) throw Error('release activation rejected');
    if (beginning) {
      token=id;ever=true;deadline=now()+durationMs;hoverMode=nextPhase==='hover';
      if(hoverMode)for(const budget of [raw,cpu,bytes,counts,omitted])budget.hover=0;
    }
    if(nextPhase==='down')pressed=true;
    if(nextPhase==='up')released=true;
    if(pending)partial.push({phase,reason:'phase transition',...pending});
    phase=nextPhase; pending=null; context=false; lastCall=null; reason=null; active=true;
    try {guard();const e=checked(getExports);e.set_win16_trace(1);guard();} catch(e) {errors++;stop('activation error');throw e;}
    return {token, phase, slot, active:live(), deadline};
  }
  function input(packed) {
    const msg = packed & 0xffff;
    if (live() && (msg === 0x200 || msg === 0x201 || msg === 0x202)) {
      if (msg === 0x202) phase = 'up';
      add({kind: 'input-poll', packed: packed >>> 0});
    }
  }
  function word(value) {
    if (!live()) return;
    if(raw[phase]>=rawQuota()||cpu[phase]>=cpuQuota()){stop('raw budget');return;}
    const started=cpuNow();
    try {decode(value);} finally {cpu[phase]+=Math.max(0,cpuNow()-started);if(active&&(raw[phase]>=rawQuota()||cpu[phase]>=cpuQuota()))stop('raw budget');}
  }
  function decode(value) {
    raw[phase]++;
    traceWords++; const v = value >>> 0;
    if (!pending) {
      const type = MARKERS[v];
      if (type) pending = {kind: type[0], want: type[1], words: []}; else unknown++;
      return;
    }
    pending.words.push(v);
    if (pending.words.length !== pending.want) return;
    const record = pending; pending = null; delete record.want;
    if (record.kind === 'route') {
      context = INPUT.has(record.words[1]);
      if (record.words[1] === 0x202) phase = 'up';
      if (context) add(record, true);
    } else if (record.kind === 'call') {
      const module = record.words[0] >>> 16, ordinal = record.words[0] & 0xffff;
      // Filter BEFORE any owner getter or memory read. Idle/paint never spends
      // the release budget. Capture KERNEL calls only within an input route.
      const messageApi = module === 2 && [107, 111, 122].includes(ordinal);
      const installCandidate = phase === 'down' && INSTALL_USER.get(ordinal)?.includes(record.words[1] & 0xffff);
      const selectedUser = INSTALL_USER.has(ordinal) ? installCandidate : USER.has(ordinal);
      lastCall = context && (!messageApi || INPUT.has(record.words[5])) && (module === 1 || (module === 2 && selectedUser)) ? record.words[0] : null;
      if (lastCall !== null) add(record, true);
    } else if (lastCall !== null) { add({...record, apiKey: lastCall}); lastCall = null; }
  }
  let trapReceipt = null;
  function trap(message) {
    if (trapReceipt) return;
    trapReceipt = {message:String(message),slot,phase,at:now(),owner:null};
    try {
      if (!ever || now() >= deadline) { trapReceipt.omitted = 'outside activation deadline'; return; }
      // Independent bounded reserve survives a raw-word/row cap. Read only;
      // the original eight-second deadline still guards every getter/byte.
      if(pending)partial.push({phase,reason:'trap',...pending});pending=null;
      phase='trap';bytes.trap=0;active=true;
      const e=checked(getExports), ip=checked(()=>e.get_eip())>>>0;
      trapReceipt.owner=snapshot({kind:'call',words:[0x2002e,ip]});
      trapReceipt.owner.prevEip=checked(()=>e.get_dbg_prev_eip())>>>0;
      trapReceipt.owner.prev2Eip=checked(()=>e.get_dbg_prev2_eip())>>>0;
    } catch(e) { errors++;trapReceipt.error=String(e); }
    finally {stop('owning trap');}
  }
  return {activate,input, word, stop, trap, isActive:live,clock:cpuNow, charge(ms){if(live()){cpu[phase]+=Math.max(0,ms);if(cpu[phase]>=cpuQuota())stop('raw CPU budget');}},fail() {errors++; stop('observer error');}, importValue(name, value) { if (live()) add({kind: name, value: value >>> 0}); }, status: () => ({active: live(), ever, token, reason, deadline, hoverMode, trap:trapReceipt, raw:{...raw},cpuMs:{...cpu},bytes: {...bytes}, omitted: {...omitted}, errors, flagRestoreError, unknown, traceWords, incomplete: pending,partial:partial.slice(), rows: rows.slice(), limitation: 'route precedes callback; call frames can establish guest consumption only after original-code authentication; handler-exit is not callback return'})};
}

function install(host, options) {
  const observer = createObserver(options), originals = {}, wrappers = {}, names = ['check_input', 'log_i32', 'check_input_hwnd', 'check_input_lparam'];
  for (const name of names) {
    const original = host[name]; if (typeof original !== 'function') throw Error('missing import ' + name);
    originals[name] = original;
  }
  for (const name of names) {
    const original=originals[name];
    wrappers[name] = host[name] = function (...args) {
      // Preserve the original receiver, result, exception and call count.
      const timed=name==='log_i32'&&observer.isActive(),started=timed?observer.clock():0;
      let result;try{result = Reflect.apply(original, this, args);}catch(e){observer.fail();throw e;}
      if(timed)observer.charge(observer.clock()-started);
      try { if (name === 'check_input') observer.input(result); else if (name === 'log_i32') observer.word(args[0]); else observer.importValue(name, result); } catch (_) { try { observer.fail(); } catch (_) {} }
      return result;
    };
  }
  return {activate:observer.activate,status: observer.status,trap:observer.trap, stop() { observer.stop('explicit stop'); for (const [n, f] of Object.entries(originals)) if(host[n]===wrappers[n])host[n] = f; }};
}

function overlay(workerSource, helperSource) {
  const anchor = '      installWaveRegistrationImports(built.imports.host);';
  if (workerSource.split(anchor).length !== 2) throw Error('Worker anchor drift');
  // Both main and auxiliary Workers instantiate through this same boundary.
  // WorkerLink has no 'log' handler. A matching private link overlay below
  // retains the structured receipt and forwards it through the link logger.
  const injected = `${anchor}\n      if(workerSlot<2){\n      antaraProbe = self.AntaraWin16Callback.install(built.imports.host, {getExports:()=>instance.exports, getMemory:()=>memory.buffer, slot:workerSlot, baselineTrace:0});\n      rawSend({t:'antaraWin16Receipt',receipt:antaraProbe.status(),ready:true});\n      const antaraAbsoluteDeadline=Date.now()+120000;let antaraSentPhase=null;\n      const antaraTimer = setInterval(()=>{const row=antaraProbe.status();if(row.ever&&!row.active&&antaraSentPhase!==row.token+row.raw.up){antaraSentPhase=row.token+row.raw.up;rawSend({t:'antaraWin16Receipt',receipt:row});}if(Date.now()>=antaraAbsoluteDeadline||(row.ever&&Date.now()>=row.deadline)){clearInterval(antaraTimer);antaraProbe.stop();rawSend({t:'antaraWin16Receipt',receipt:antaraProbe.status()});}},100);\n      }`;
  const messageAnchor='const handleMessage = async (msg) => {';
  if(workerSource.split(messageAnchor).length!==2)throw Error('Worker message anchor drift');
  const handler=`let antaraProbe=null;\n${messageAnchor}\n  if(msg.t==='antaraActivate'){let ack;try{if(!antaraProbe)throw Error('unready or late Worker');ack=antaraProbe.activate(msg.token,msg.phase);}catch(e){ack={active:false,error:String(e)};}rawSend({t:'antaraActivationAck',seq:msg.seq,ack});return;}\n  if(msg.t==='antaraStop'){antaraProbe?.stop();rawSend({t:'antaraActivationAck',seq:msg.seq,ack:{active:false,stopped:true}});return;}`;
  const trapAnchor='          trapped = String(err && err.message || err);';
  if(workerSource.split(trapAnchor).length!==2)throw Error('Worker trap anchor drift');
  const trapHook=trapAnchor+`\n          if(antaraProbe){try{antaraProbe.trap(trapped);}catch(_){}finally{try{antaraProbe.stop();}finally{rawSend({t:'antaraWin16Receipt',receipt:antaraProbe.status(),final:true});}}}`;
  return helperSource + '\n' + workerSource.replace(anchor, injected).replace(messageAnchor,handler).replace(trapAnchor,trapHook);
}
function linkOverlay(source) {
  const anchor = '    _onMessage(msg) {\n      switch (msg.t) {';
  if (source.split(anchor).length !== 2) throw Error('WorkerLink anchor drift');
  return source.replace(anchor, `    _onMessage(msg) {\n      if(msg.t==='antaraActivationAck'){const p=this._pending.get(msg.seq);if(p){this._pending.delete(msg.seq);p.resolve(msg);}return;}\n      if(msg.t==='antaraWin16Receipt'){this.antaraWin16Ready=!!msg.ready||this.antaraWin16Ready;this.antaraWin16Receipt=msg.receipt;if(msg.final)this.log('ANTARA_FINAL '+JSON.stringify(msg.receipt));return;}\n      switch (msg.t) {`);
}
async function activateExisting(wine, token, phase) {
  function links(){return [wine?.guestWorker?.link,...Array.from(wine?.threadManager?.threads||[]).map(([,t])=>t.link)].filter(Boolean);}
  function ask(link,t){return new Promise((resolve,reject)=>{const seq=++link._seq;const timer=setTimeout(()=>{link._pending.delete(seq);reject(Error('activation acknowledgment timeout'));},1500);link._pending.set(seq,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});try{link.worker.postMessage({t,seq,token,phase});}catch(e){clearTimeout(timer);link._pending.delete(seq);reject(e);}});}
  const current=links();
  if(current.length!==2||new Set(current.map(l=>l.slot)).size!==2||current.some(l=>!l.antaraWin16Ready||![0,1].includes(l.slot)))throw Error('exact existing Workers not ready');
  const initial=!wine.__antaraActivation&&(phase==='hover'||phase==='down');
  if(initial)wine.__antaraActivation={token,links:current,phase};
  else if(wine.__antaraActivation?.token!==token||current.some((l,i)=>l!==wine.__antaraActivation.links[i])||!((phase==='down'&&wine.__antaraActivation.phase==='hover')||(phase==='up'&&wine.__antaraActivation.phase==='down')))throw Error('late/replaced Worker or activation token');
  const replies=await Promise.allSettled(current.map(l=>ask(l,'antaraActivate')));
  const ok=replies.every((r,i)=>r.status==='fulfilled'&&r.value.ack?.active&&r.value.ack.token===token&&r.value.ack.phase===phase&&r.value.ack.slot===current[i].slot&&r.value.ack.deadline>Date.now());
  if(!ok||links().some((l,i)=>l!==current[i])||links().length!==current.length){await Promise.allSettled(current.map(l=>ask(l,'antaraStop')));throw Error('crossworker activation failed; click refused');}
  wine.__antaraActivation.phase=phase;
  return replies.map(r=>r.value.ack);
}
const api = {createObserver, install, overlay, linkOverlay, activateExisting, MARKERS};
if (typeof module !== 'undefined') module.exports = api;
if (typeof self !== 'undefined') self.AntaraWin16Callback = api;
