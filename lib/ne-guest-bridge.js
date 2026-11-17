'use strict';
const neGuestSources = typeof require === 'function' ? require('./ne-sources') : globalThis.NeSources;
const neGuestLifecycle = typeof require === 'function' ? require('./ne-lifecycle') : globalThis.NeLifecycle;
const neGuestErrors = typeof require === 'function' ? require('./ne-load-error') : globalThis.NeLoadErrorApi;
const neGuestInvoke = typeof require === 'function' ? require('./ne-invoke') : globalThis.NeInvoke;

function readNeGuestString(e, memoryBuffer, address, limit) {
  if (!address || address > 0xffffffff - limit) throw new RangeError('Invalid NE guest string pointer');
  const memory = new Uint8Array(memoryBuffer);
  let result = '';
  // Translate every byte: an ANSI name can cross noncontiguous sparse pages.
  for (let i = 0; i <= limit; i++) {
    const at = e.guest_to_wasm(address + i) >>> 0;
    if (at === 0xf0 || at >= memory.length) throw new RangeError('Unmapped NE guest string');
    const ch = memory[at];
    if (!ch) return result;
    result += String.fromCharCode(ch);
  }
  throw new RangeError('Unterminated NE guest string');
}

// Native FT connection: only checked publication and native settlement can
// complete the original six-argument PE-facing call. QT remains guarded.
function serviceNativeFtConnect(opts,lifecycle,request) {
  const e=opts.exports;
  if(!e.win16_guest_request_valid(request))throw new Error('Stale native FT connection request');
  const sp=e.get_esp()>>>0,reason=e.guest_read32(sp+24)>>>0;
  if(reason===0) {
    const handle=e.win16_guest_ft_detach(request)>>>0;
    if(!handle)throw new Error('Native FT detach ownership or busy lifetime rejected');
    lifecycle.releaseGuest(handle);return true;
  }
  if(!e.win16_guest_ls32_validate(request))throw new Error('Native LS32 ABI/header/image validation rejected');
  const module16=readNeGuestString(e,opts.memoryBuffer,e.guest_read32(sp+12)>>>0,255);
  const name16=readNeGuestString(e,opts.memoryBuffer,e.guest_read32(sp+8)>>>0,255);
  let handle=0,pair=0,settled=false;
  try {
    handle=lifecycle.retainGuest(neGuestSources.canonicalNeName(module16));
    if(!handle) {
      const prepared=neGuestSources.prepareNeSources(module16,opts.findDllSync,lifecycle.liveModule);
      handle=neGuestLifecycle.createNeLifecycle(e,{buffer:opts.memoryBuffer},prepared.sources,opts.neInvokeOptions).loadGuest(prepared.name);
    }
    pair=lifecycle.pairGuest(handle,name16);
    lifecycle.publishFtPair(pair,handle);
    if(!e.win16_guest_ft_connect_settle(request,pair))throw new Error('Native FT connection settlement rejected '+e.win16_ft_reject_reason());
    settled=true;return true;
  } finally {
    if(!settled) {
      try {if(pair)lifecycle.rollbackFtPair(pair);}
      finally {if(handle)lifecycle.releaseGuest(handle);}
    }
  }
}

function retireNativeFtConnections(opts,base=0,boundary=0n) {
  const e=opts.exports;if(!e.win16_ft_unwind)return 0;
  const token=e.win16_guest_request_token();
  let cancel=base===0;
  if(base&&e.win16_guest_request_valid(token)) {
    const op=e.win16_guest_request_field(token,0);
    cancel=(op===4&&e.win16_guest_request_field(token,2)===1&&e.win16_ft_checkpoint()!==boundary)||
      (op===5&&(e.guest_read32((e.get_esp()>>>0)+20)>>>0)===(base>>>0));
  }
  if(!e.win16_ft_unwind(boundary))throw new Error('Native FT owner unwind rejected');
  if(cancel)e.win16_guest_request_cancel();
  const life=neGuestLifecycle.createNeLifecycle(e,{buffer:opts.memoryBuffer},[],opts.neInvokeOptions);
  let n=0;
  for(;n<128;n++) {
    const handle=e.win16_ft_retire_next(base)|0;
    if(!handle)return n;
    if(handle<0)throw new Error('Native FT connection remains busy');
    life.releaseGuest(handle);
  }
  throw new Error('Native FT retirement bound exhausted');
}

async function serviceLs32PairingAsync(opts,token) {
  const e=opts.exports, sources=new Map();
  const check=()=>{opts.checkNeOwner();if(!e.win16_guest_ls32_validate(token))throw new Error('Stale or invalid native LS32 request');};
  check();
  const path=readNeGuestString(e,opts.memoryBuffer,e.guest_read32((e.get_esp()>>>0)+12)>>>0,255);
  const life=neGuestLifecycle.createNeLifecycle(e,{buffer:opts.memoryBuffer},[],opts.neInvokeOptions);
  const missing={};let pending;
  const resolve=(file,full)=>{if(!sources.has(full)){pending={file,full};throw missing;}return sources.get(full);};
  for(;;) {
    check();
    try {neGuestSources.prepareNeSources(path,resolve,life.liveModule);break;}
    catch(error){if(error!==missing)throw error;}
    const bytes=await opts.findDll(pending.file,pending.full);check();
    sources.set(pending.full,bytes==null?null:Uint8Array.from(bytes));
  }
  return serviceNeGuestYieldSync({...opts,findDllSync:resolve});
}

// Both identities are required: frame generation and monotonically unique
// request serial. Source lookup never replaces/retries a running initializer.
function nestedRequest(opts) {
  const e=opts.exports,frame=e.win16_nested_request_frame(),serial=e.win16_nested_request_serial();
  const check=()=>{
    opts.checkNeOwner?.();
    if(opts.neInvokeOptions?.signal?.aborted)throw opts.neInvokeOptions.signal.reason??new Error('Nested NE load cancelled');
    if(!e.win16_nested_request_valid(frame,serial))throw new Error('Stale nested NE loader request');
  };
  check();
  return {frame,serial,check,op:e.win16_nested_request_field(frame,serial,0),arg:e.win16_nested_request_field(frame,serial,1)>>>0};
}
function nestedOptions(opts) {
  return {...opts.neInvokeOptions,nestedLoader:()=>serviceNestedNeSync(opts)};
}
function validateNestedSources(sources) {
  for(const [name,bytes] of sources){
    // inspectNeDll already validated these table ranges. Require the actual
    // ordinal-zero resident identity for this new runtime loading direction.
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),ne=v.getUint32(0x3c,true);
    const p=ne+v.getUint16(ne+0x26,true),n=bytes[p];
    const identity=String.fromCharCode(...bytes.subarray(p+1,p+1+n)).toUpperCase();
    if(!n||p+n+3>bytes.length||v.getUint16(p+n+1,true)!==0||identity!==name)
      throw new Error('Nested NE source identity mismatch for '+name);
  }
}
function serviceNestedNeSync(opts,request=nestedRequest(opts)) {
  const e=opts.exports,r=request,options=nestedOptions(opts);
  r.check();
  const life=neGuestLifecycle.createNeLifecycle(e,{buffer:opts.memoryBuffer},[],options);
  let value=0,acquired=false,settled=false;
  try {
    if(r.op===1){
      const path=readNeGuestString(e,opts.memoryBuffer,r.arg,260),name=neGuestSources.canonicalNeName(path);
      value=life.retainGuest(name);
      if(!value){
        const prepared=neGuestSources.prepareNeSources(path,opts.findDllSync,life.liveModule);
        validateNestedSources(prepared.sources);
        value=neGuestLifecycle.createNeLifecycle(e,{buffer:opts.memoryBuffer},prepared.sources,options).loadGuest(prepared.name);
      }
      acquired=true;
    }else if(r.op===2)life.releaseGuest(r.arg);
    else throw new Error('Unknown nested NE operation');
    r.check();
    if(!e.win16_nested_request_settle(r.frame,r.serial,value))throw new Error('Nested NE settlement rejected');
    settled=true;
  }catch(error){
    if(r.op!==1||!(error instanceof neGuestErrors.NeLoadError)||error.guestCode!==2)throw error;
    r.check();
    if(!e.win16_nested_request_settle(r.frame,r.serial,2))throw new Error('Nested missing-image settlement rejected');
    settled=true;
  }finally{
    if(acquired&&!settled)neGuestLifecycle.createNeLifecycle(e,{buffer:opts.memoryBuffer},[],{...options,signal:undefined}).releaseGuest(value);
  }
}
async function serviceNestedNe(opts) {
  const r=nestedRequest(opts),e=opts.exports,sources=new Map();
  const life=neGuestLifecycle.createNeLifecycle(e,{buffer:opts.memoryBuffer},[],nestedOptions(opts));
  if(r.op===1){
    const path=readNeGuestString(e,opts.memoryBuffer,r.arg,260),missing={};let pending;
    const resolve=(file,full)=>{if(!sources.has(full)){pending={file,full};throw missing;}return sources.get(full);};
    for(;;){
      r.check();
      try{neGuestSources.prepareNeSources(path,resolve,life.liveModule);break;}
      catch(error){if(error instanceof neGuestErrors.NeLoadError&&error.guestCode===2)break;if(error!==missing)throw error;}
      const bytes=await opts.findDll(pending.file,pending.full);
      r.check();sources.set(pending.full,bytes==null?null:Uint8Array.from(bytes));
    }
  }
  r.check();
  return serviceNestedNeSync({...opts,findDllSync:(_file,full)=>{
    if(!sources.has(full))throw new Error('Nested initializer requires unavailable synchronous NE source '+full);
    return sources.get(full);
  }},r);
}

// This service executes entirely in the live caller's synchronous turn. The
// process-owned native module table is the persistent identity/refcount owner;
// a coordinator is only a scoped view of it, never an alternate JS module map.
// Lock order: caller's PE callback gate, then short NE scopes, then DLL mutex.
// No await or scheduler borrowing occurs while any NE execution lease is held.
function serviceNeGuestYieldSync(opts) {
  const e = opts?.exports;
  if (!e || e.get_yield_reason() !== 18) return false;
  const token = e.win16_guest_request_token();
  if (!e.win16_guest_request_valid(token)) throw new Error('Stale NE guest request');
  const operation = e.win16_guest_request_field(token, 0);
  const arg0 = e.win16_guest_request_field(token, 1) >>> 0;
  const arg1 = e.win16_guest_request_field(token, 2) >>> 0;
  if (operation === 4) {
    if(arg1===1)neGuestInvoke.invokeNeFtSync(e,token,opts.neInvokeOptions);
    else neGuestInvoke.invokeNeQtSync(e,token,arg0,nestedOptions(opts));
    return true;
  }
  const memory = {buffer: opts.memoryBuffer};
  const lifecycle = neGuestLifecycle.createNeLifecycle(e, memory, [], opts.neInvokeOptions);
  if(operation===5)return serviceNativeFtConnect(opts,lifecycle,token);
  let value = 0;
  try {
    if (operation === 1) {
      if (!arg0) value = 0; // LoadModule16(NULL, ...) returns zero.
      else {
        const path = readNeGuestString(e, opts.memoryBuffer, arg0, 260);
        const name = neGuestSources.canonicalNeName(path);
        value = lifecycle.retainGuest(name);
        if (!value) {
          const prepared = neGuestSources.prepareNeSources(path, opts.findDllSync, lifecycle.liveModule);
          value = neGuestLifecycle.createNeLifecycle(e, memory, prepared.sources, opts.neInvokeOptions).loadGuest(prepared.name);
        }
      }
    } else if (operation === 2) {
      lifecycle.releaseGuest(arg0);
    } else if (operation === 3) {
      const symbol = arg1 >>> 16 ? readNeGuestString(e, opts.memoryBuffer, arg1, 255) : arg1;
      value = typeof symbol === 'string' && (!symbol.length || /[^\x20-\x7e]/.test(symbol))
        ? 0 : lifecycle.lookupGuest(arg0, symbol);
    } else throw new Error('Unknown NE guest lifecycle operation ' + operation);
  } catch (error) {
    if (operation === 1 && error instanceof neGuestErrors.NeLoadError && error.guestCode !== null) value = error.guestCode;
    else {
      // Failed WEP ownership remains with this exact exports facade. Recovery
      // is diagnostic and explicit; never retry it just to complete FreeLibrary.
      if (error.pendingTerminations?.length) error.neRecovery = Object.freeze({
        modules: error.pendingTerminations,
        retry: id => {
          // A failing enclosing DllMain may already have restored its caller's
          // EIP/ESP. Recovery still belongs to this request and live facade;
          // cancellation/process reset or replacement invalidates its token.
          if (e.win16_guest_request_token() !== token) throw new Error('Stale NE termination recovery');
          if (!error.pendingTerminations.includes(id)) throw new Error('Unowned NE termination retry');
          lifecycle.retryTermination(id);
        },
      });
      throw error;
    }
  }
  if (!e.win16_guest_request_valid(token) || !e.win16_guest_request_settle(token, value))
    throw new Error('NE guest settlement rejected');
  return true;
}

// A Worker has no synchronous VFS. Resolve the closure before entering an NE
// execution scope, while the existing PE callback gate and command queue keep
// this caller parked. Only preflight is repeated; no initializer or settlement
// is retried. The native process table still owns live modules and references.
async function serviceNeGuestYield(opts) {
  const e = opts?.exports;
  if (!e || e.get_yield_reason() !== 18) return false;
  const token = e.win16_guest_request_token();
  const check = () => {
    opts.checkNeOwner();
    if (!e.win16_guest_request_valid(token)) throw new Error('Stale NE guest request');
  };
  check();
  if(e.win16_guest_request_field(token,0)===4&&e.win16_guest_request_field(token,2)===0){
    await neGuestInvoke.invokeNeQt(e,token,e.win16_guest_request_field(token,1)>>>0,
      {...nestedOptions(opts),checkOwner:opts.checkNeOwner,nestedLoaderAsync:()=>serviceNestedNe(opts)});
    return true;
  }
  if(e.win16_guest_request_field(token,0)===5) {
    if((e.guest_read32((e.get_esp()>>>0)+24)>>>0)===0)return serviceNeGuestYieldSync(opts);
    return serviceLs32PairingAsync(opts,token);
  }
  const sources = new Map();
  if (e.win16_guest_request_field(token, 0) === 1) {
    const address = e.win16_guest_request_field(token, 1) >>> 0;
    if (address) {
      const path = readNeGuestString(e, opts.memoryBuffer, address, 260);
      const lifecycle = neGuestLifecycle.createNeLifecycle(e, {buffer:opts.memoryBuffer}, [], opts.neInvokeOptions);
      // The synchronous inspector copies/validates bytes and checks live native
      // exports. A private sentinel requests only the next absent source; all
      // its temporary live references/scopes have unwound before awaiting I/O.
      const missing = {};
      let pending;
      const resolve = (file, full) => {
        if (!sources.has(full)) { pending = {file, full}; throw missing; }
        return sources.get(full);
      };
      for (;;) {
        check();
        try { neGuestSources.prepareNeSources(path, resolve, lifecycle.liveModule); break; }
        catch (error) {
          // Let the common service translate documented legacy load errors;
          // diagnostic failures (imports, unsupported layouts) still throw.
          if (error instanceof neGuestErrors.NeLoadError && error.guestCode !== null) break;
          if (error !== missing) throw error;
        }
        const bytes = await opts.findDll(pending.file, pending.full);
        check();
        sources.set(pending.full, bytes == null ? null : Uint8Array.from(bytes));
      }
    }
  }
  check();
  return serviceNeGuestYieldSync({...opts, findDllSync: (_file, full) => {
    if (!sources.has(full)) throw new Error('NE source closure changed before execution');
    return sources.get(full);
  }});
}

const neGuestBridgeApi = {readNeGuestString, serviceNeGuestYieldSync, serviceNeGuestYield, serviceNativeFtConnect, retireNativeFtConnections};
if (typeof module !== 'undefined' && module.exports) module.exports = neGuestBridgeApi;
else globalThis.NeGuestBridge = neGuestBridgeApi;
