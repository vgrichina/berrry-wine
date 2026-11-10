'use strict';

// Inject before the owning Worker's first instantiate. Uses read exports and
// the supported trace setter; never writes guest state or replaces an import's
// result. The factory gate leaves the arbitrarily long startup prelude untraced.
function installPawnObservation(scope, options = {}) {
  const instantiate = scope.WebAssembly.instantiate;
  const post = scope.postMessage;
  let installed = false, owner = null;
  const emit = row => {
    try { scope.console.log('PAWN_OBSERVATION ' + JSON.stringify(row)); } catch {}
  };
  if (post) scope.postMessage = function(message, ...rest) {
    if (owner && message && (message.t === 'error' ||
        message.t === 'sliceDone' && !message.threadSendPending &&
        (message.trapped || message.eip === 0 || message.yield === 2))) {
      owner.latch(message);
    }
    return Reflect.apply(post, this, [message, ...rest]);
  };
  scope.WebAssembly.instantiate = async function(module, imports, ...rest) {
    if (installed || !imports?.host?.memory)
      return Reflect.apply(instantiate, this, [module, imports, ...rest]);
    installed = true;
    let e, active = true, seen = 0, entered = false, previous = null;
    let verified = !!options.control, terminal = null;
    const records = [], started = scope.performance.now();
    const dv = new DataView(imports.host.memory.buffer);
    const u32 = p => dv.getUint32(e.guest_to_wasm(p >>> 0) >>> 0, true);
    const record = (kind, data = {}) => {
      const row = {kind, sequence: records.length + 1, at: scope.performance.now(), ...data};
      records.push(row); emit(row);
    };
    const stop = reason => {
      if (!active) return;
      active = false; e?.set_trace_eip_range(0, 0, 0);
      record('stop', {reason, seen});
    };
    function snapshot() {
      const read = name => typeof e[name] === 'function' ? e[name]() >>> 0 : null;
      const global = u32(0x4240c0), tlsIndex = u32(0x4240bc);
      const tlsSlots = read('get_tls_slots');
      const tls = tlsSlots && tlsIndex < 1088 ? u32(tlsSlots + tlsIndex * 4) : null;
      const esp = read('get_esp'), ebp = read('get_ebp'), esi = read('get_esi');
      return {eip: read('get_eip'), eax: read('get_eax'), ebx: read('get_ebx'),
        ecx: read('get_ecx'), edx: read('get_edx'), esi, edi: read('get_edi'), esp, ebp,
        prevEip: read('get_dbg_prev_eip'), prev2Eip: read('get_dbg_prev2_eip'),
        yield: read('get_yield_reason'), tid: read('get_current_thread_id'),
        global, tlsIndex, tlsSlots, tls, factoryRefusal: u32(0x42380c), surface: u32(0x423fc0),
        stack: Array.from({length: 5}, (_, i) => u32(esp + i * 4))};
    }
    function latch(message) {
      if (terminal) return terminal;
      try { terminal = {message, state: snapshot(), entered, seen}; }
      catch (error) { terminal = {message, error: String(error), entered, seen}; }
      record('owner-terminal', terminal);
      stop('owner-terminal');
      return terminal;
    }
    const important = new Set([0x414ffe,0x41500d,0x415012,0x415021,0x415025,
      0x41502a,0x415030,0x41508b,0x41c0b4,0x41c0c0,0x41c0c1,0x41c0c4,
      0x41c0ca,0x41c0d1,0x41c0d5,0x41c0e4,0x41c0f2,0x41c0f9,0x41c100,
      0x41d1cd,0x41d1db,0x41d1e1,0x41d1f0,0x41d0ba,0x41d157,0x414f1c]);
    function observe(pc) {
      if (!active || !e) return;
      try {
        if (++seen > 20000 || scope.performance.now() - started > 120000)
          return stop('boundary-or-time-cap');
        if (e.get_image_base() !== 0x400000) return stop('foreign-image');
        if (!verified) {
          for (const [p,h] of [[0x41501e,'ff513c'],[0x415021,'85c0'],
            [0x41c0c1,'ff5658'],[0x41c0c4,'8bf8'],[0x41d1db,'ff15541e4200']]) {
            const got = Array.from(new Uint8Array(dv.buffer,e.guest_to_wasm(p)>>>0,h.length/2),
              v=>v.toString(16).padStart(2,'0')).join('');
            if (got !== h) throw Error('loaded Pawn anchor '+p.toString(16));
          }
          verified = true; record('loaded-anchors-verified');
        }
        if (!entered) {
          entered = true;
          // Only the bounded factory/constructor/initializer interval is broad.
          e.set_trace_eip_range(1, 0x4104f6, 0x41d200);
          record('factory-gate-entered', {pc});
        }
        const s = snapshot(), lifetime = JSON.stringify([s.global,s.tlsIndex,s.tlsSlots,s.tls]);
        if (!important.has(pc) && previous === lifetime) return;
        if (records.length >= 250) return stop('record-cap');
        const object = s.global || (pc === 0x41c0b4 ? u32(s.esp+4) :
          pc >= 0x41c0c0 && pc <= 0x41c0f9 ? s.esi : 0);
        record('boundary', {pc,...s,lifetimeChanged:previous!==lifetime,
          outputHdc: (pc===0x415021||pc===0x41508b) && s.ebp ? u32(s.ebp-4) : null,
          object: object ? {pointer:object,callback:u32(object+0x58),cleanup:u32(object+0x68),
            hdc:u32(object+0xb0),method:u32(object+0x20)} : null});
        previous = lifetime;
        if (pc === 0x41c100) stop(s.global ? 'startup-lifetime-complete' : 'null-global-before-unconditional-call');
      } catch (error) { record('observer-error',{error:String(error)}); stop('observation-error'); }
    }
    const old = imports.host.log_eip;
    const replaced = {...imports,host:{...imports.host,log_eip:function(...args) {
      observe(args[0]>>>0);
      return Reflect.apply(old,this,args);
    }}};
    const result = await Reflect.apply(instantiate,this,[module,replaced,...rest]);
    e = (result.exports ? result : result.instance).exports;
    owner = {records,stop,latch,observe,get active(){return active;},get terminal(){return terminal;}};
    scope.__pawnObservation = owner;
    e.set_trace_eip_range(1,0x414ffe,0x41508c);
    record('armed',{control:!!options.control,boundaryLimit:20000,recordLimit:256,
      durationMs:120000,initialRange:[0x414ffe,0x41508c]});
    return result;
  };
}

// Empty app lists and detached owners are failures even if a stale page says
// nothing stopped. Keep this check usable by capture drivers before input.
function pawnReadiness(state) {
  if (state.workers.some(w=>w.terminal || w.observerError)) return {ready:false,reason:'owner-terminal-or-observer-error'};
  if (!state.isolated || state.apps.length !== 1 || state.apps[0].name !== 'pawn' ||
      !state.apps[0].running || state.apps[0].stopped) return {ready:false,reason:'live-pawn-required'};
  if (!state.workers.some(w=>w.url.includes('/guest-worker.js') && w.observerInstalled && !w.closed))
    return {ready:false,reason:'live-observed-owner-required'};
  return {ready:true};
}

module.exports = {installPawnObservation,pawnReadiness};
