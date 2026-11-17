'use strict';
const neLifecycleImageApi = typeof require === 'function' ? require('./ne-image') : globalThis.NeImage;
const neLifecycleInvokeApi = typeof require === 'function' ? require('./ne-invoke') : globalThis.NeInvoke;
const neLifecycleErrors = typeof require === 'function' ? require('./ne-load-error') : globalThis.NeLoadErrorApi;

// Recovery ids survive indirect dependency failures after their parent has
// already been unloaded or rolled back. Preserve each original cause as well.
class NeTerminationError extends Error {
  constructor(moduleId, cause) {
    super('NE termination retained for module '+moduleId, {cause});
    this.name='NeTerminationError';this.code='NE_TERMINATION_PENDING';
    this.moduleId=moduleId;this.pendingTerminations=Object.freeze([moduleId]);
  }
}
function lifecycleFailure(errors, message) {
  const error=new AggregateError(errors,message);
  error.pendingTerminations=Object.freeze([...new Set(errors.flatMap(e=>e.pendingTerminations||[]))]);
  return error;
}

// Internal synchronous coordinator. Every source byte must already be present;
// fetching and asynchronous guest waits are unsupported; QT is not exposed.
// A failed WEP retains the module, dependencies and termination lease. The owner
// may diagnose it and explicitly retry; ordinary release does not hide failure.
function createNeLifecycle(e, memory, sources, options = {}) {
  const canonical = name => {
    if (typeof name !== 'string') throw new TypeError('NE module name required');
    const value = name.replace(/\.dll$/i, '').toUpperCase();
    if (!/^[A-Z0-9_$-]{1,15}$/.test(value)) throw new Error('Invalid NE module name');
    return value;
  };
  const images = new Map();
  for (const [name, bytes] of sources) {
    const key = canonical(name); if (images.has(key)) throw new Error('Duplicate NE source ' + key);
    images.set(key, neLifecycleImageApi.inspectNeDll(bytes));
  }
  const packed = name => {const b = new Uint8Array(16),v=new DataView(b.buffer); b[0]=name.length; for(let i=0;i<name.length;i++)b[i+1]=name.charCodeAt(i); return [v.getBigUint64(0,true),v.getBigUint64(8,true)];};
  const checked = (ok, message) => {if (!ok) throw new Error(message);};
  const scope = action => {
    const token = e.win16_bridge_frame_begin(); checked(token, 'Cannot acquire NE lifecycle frame');
    let failure;
    try {checked(e.win16_bridge_scope_begin(token), 'NE lifecycle owner busy'); return action(token);}
    catch (error) {failure = error; throw error;}
    finally {
      try {checked(e.win16_bridge_frame_end(token), 'NE lifecycle frame teardown rejected');}
      catch (error) {if (failure) throw lifecycleFailure([failure,error], 'NE lifecycle and cleanup failed'); throw error;}
    }
  };
  const preflight = (name, chain = new Set()) => {
    if (chain.has(name)) throw new Error('Unsupported recursive NE dependency ' + name);
    if (liveModule(name)) return;
    const image = images.get(name);
    if (!image) throw new neLifecycleErrors.NeLoadError(2, 'Missing NE image ' + name);
    chain.add(name);
    for (const dependency of image.dependencies) {
      const dep = canonical(dependency);
      if (!neLifecycleImageApi.neBuiltinDependency(dep)) preflight(dep, chain);
    }
    for (const imported of image.imports) {
      const dep = canonical(imported.module);
      if (neLifecycleImageApi.neBuiltinDependency(dep)) {
        if (typeof imported.symbol === 'string') throw new Error('Named builtin NE imports require importer-owned name resolution: '+dep+'.'+imported.symbol);
        continue;
      }
      if (liveModule(dep, imported.symbol)) continue;
      const source = images.get(dep);
      if (!source) throw new neLifecycleErrors.NeLoadError(null, 'Missing NE import '+dep+'.'+imported.symbol);
      const ordinal = typeof imported.symbol === 'string' ? source.names.get(imported.symbol.toUpperCase()) : imported.symbol;
      if (!source.entries.has(ordinal))
        throw new neLifecycleErrors.NeLoadError(null, 'Missing NE import '+dep+'.'+imported.symbol);
    }
    chain.delete(name);
    checked(image.bytes.length <= e.win16_app_dll_staging_size(), 'NE image exceeds staging capacity');
    return image;
  };
  const dependencies = mask => {
    checked(mask >= 0, 'Cannot inspect owned NE dependencies');
    return Array.from({length:24},(_,i)=>i+13).filter(id=>mask & (1 << (id-13)));
  };
  // Microsoft Win95 Programmer's Guide: notify each semantic usage-count
  // increment/decrement. Internal inspection refs below are not guest loads.
  // Arguments nearest the far return: reserved2, reserved1 lo/hi, heap, DS,
  // instance, reason lo/hi. The guest must RETF 16; AX is a Win16 BOOL.
  const notify = (id, reason, repeated = false) => {
    const target=e.win16_bridge_module_notify(id,0);
    if (!target) {checked(!e.win16_bridge_module_notify(id,4), 'NE DllEntryPoint unavailable');return;}
    if (repeated) checked(e.win16_bridge_module_notify_begin(id), 'NE notification busy');
    let lsTransaction=false,lsCommit=false;
    try {
      checked(e.win16_bridge_ls_notify_begin(id,reason), 'NE LS notification busy');
      lsTransaction=true;
      const ds=e.win16_bridge_module_notify(id,1), heap=e.win16_bridge_module_notify(id,2), instance=e.win16_bridge_module_notify(id,3);
      const result=neLifecycleInvokeApi.invokeNeEntrySync(e,{target,ds,instance,heap,module:id},
        {...options,stackWords:[0,0,0,heap,ds,instance,reason,0]});
      if (reason && !(result & 0xffff)) throw new neLifecycleErrors.NeLoadError(null,'NE DllEntryPoint returned AX zero');
      // A synchronous host callback can cancel in the same slice that returns
      // success. Balance that completed attach before rejecting acquisition;
      // cleanup remains bounded and uses the same live owning execution scope.
      if (reason && options.signal?.aborted) {
        const cancellation=options.signal.reason ?? new Error('NE notification cancelled');
        try {
          neLifecycleInvokeApi.invokeNeEntrySync(e,{target,ds,instance,heap,module:id},
            {...options,signal:undefined,stackWords:[0,0,0,heap,ds,instance,0,0]});
        } catch (cleanup) {throw lifecycleFailure([cancellation,cleanup],'NE cancelled attach cleanup failed');}
        throw cancellation;
      }
      lsCommit=true;
    } finally {
      if (lsTransaction) checked(e.win16_bridge_ls_notify_end(id,lsCommit?1:0), 'NE LS notification teardown rejected');
      if (repeated) checked(e.win16_bridge_module_notify_end(id),'NE notification teardown rejected');
    }
  };
  const retained = id => {
    if (!id) return 0;
    try {notify(id,1,true);return id;}
    catch (error) {
      // This acquisition added exactly one ref to a previously ready image;
      // failure must leave its existing consumers and code intact.
      checked(e.win16_bridge_module_release_begin(id)===0,'NE failed retain rollback rejected');
      throw error;
    }
  };
  const releaseOwned = (id, retry = false, inspection = false) => {
    if (!retry && !inspection) notify(id,0,true);
    const result = retry ? (e.win16_bridge_module_release_retry(id) ? 1 : -1) : e.win16_bridge_module_release_begin(id);
    checked(result >= 0, 'NE release rejected for ' + id);
    if (!result) return;
    let deps;
    try {
      deps = dependencies(e.win16_bridge_module_dependencies(id));
      const target = e.win16_bridge_module_termination(id,0), ds = e.win16_bridge_module_termination(id,1);
      // WEP_FREE_DLL is one Pascal WORD, 0. WEP's return value is not a veto.
      // See Wine krnl386.exe16/ne_module.c MODULE_CallWEP and include/winbase.h.
      if (target) neLifecycleInvokeApi.invokeNeEntrySync(e,{target,ds,instance:ds||id,heap:0,module:id},{...options,stackWords:[0]});
      // Deliberately not finally: a trapped/cancelled WEP keeps ownership intact.
      checked(e.win16_bridge_module_release_finish(id), 'NE final unload rejected');
    } catch (error) {throw new NeTerminationError(id,error);}
    const failures=[];
    for (const dep of deps) {try {releaseOwned(dep);} catch(error) {failures.push(error);}}
    if (failures.length) throw lifecycleFailure(failures,'NE dependency termination failed');
  };
  const loadOwned = (name, token) => {
    const claimed = e.win16_bridge_module_claim(...packed(name)); checked(claimed, 'NE module busy or unavailable: ' + name);
    if (claimed < 0) return retained(-claimed);
    const id = claimed, image = images.get(name), acquired = [], acquiredByName = new Map();
    let initialized=false, attached=false;
    try {
      if (neLifecycleImageApi.neBuiltinDependency(name) === 'dynamic') {
        // The native record owns this name exactly like an image dependency.
        // No synthetic DLL, initializer, exports or guest alias is created.
        checked(e.win16_bridge_module_publish_emulated(id), 'NE emulated dependency publication rejected');
        return id;
      }
      for (const dependency of image.dependencies) {
        const depName = canonical(dependency);
        const fixed = neLifecycleImageApi.neFixedBuiltinId(depName);
        if (fixed) {
          checked(e.win16_bridge_fixed_link(id, fixed), 'NE fixed dependency acquisition rejected');
          continue;
        }
        const dep = loadOwned(depName,token); acquired.push(dep); acquiredByName.set(depName,dep);
        checked(e.win16_bridge_module_link(id,dep), 'NE dependency transfer rejected');
      }
      // A ready module can have been loaded by another coordinator with a
      // different source map. Validate the acquired image, not only our copy.
      for (const imported of image.imports) {
        const dep = canonical(imported.module); if (neLifecycleImageApi.neBuiltinDependency(dep)) continue;
        checked(lookupOwned(acquiredByName.get(dep),imported.symbol,token), 'Missing loaded NE import '+dep+'.'+imported.symbol);
      }
      checked(e.win16_bridge_module_stage_begin(id), 'NE staging lease rejected');
      const staging = e.win16_dll_staging(id) >>> 0;
      new Uint8Array(memory.buffer,staging,image.bytes.length).set(image.bytes);
      checked(e.load_ne_dll_sized(id,image.bytes.length), 'NE image staging failed');
      checked(e.win16_bridge_module_stage_end(id), 'NE staging completion rejected');
      const target=e.win16_bridge_module_init(id,0), ds=e.win16_bridge_module_init(id,1), heap=e.win16_bridge_module_init(id,2);
      const result = target ? neLifecycleInvokeApi.invokeNeEntrySync(e,{target,ds,instance:ds||id,heap:ds?heap:0,module:id},options) : 1;
      checked(!image.hasInitializer || target, 'NE initializer unavailable');
      // The initializer rejection is real, but the Win32-visible legacy error
      // value is not established. Preserve it as a diagnostic, not a guessed
      // zero/out-of-memory or invalid-image status.
      if (!(result & 0xffff)) throw new neLifecycleErrors.NeLoadError(null, 'NE initializer returned AX zero');
      initialized=true;
      notify(id,1);attached=true;
      checked(e.win16_bridge_module_publish(id,result), 'NE publication rejected');
      return id;
    } catch (error) {
      const failures=[error];
      if (initialized) {
        try {
          if (attached) notify(id,0);
          const target=e.win16_bridge_module_termination(id,0),ds=e.win16_bridge_module_termination(id,1);
          if (target) neLifecycleInvokeApi.invokeNeEntrySync(e,{target,ds,instance:ds||id,heap:0,module:id},{...options,signal:undefined,stackWords:[0]});
        } catch (cleanup) {failures.push(cleanup);}
      }
      // Snapshot before rollback destroys the ownership record. The acquired
      // list also includes a ref whose link may have been rejected.
      try {dependencies(e.win16_bridge_module_dependencies(id)); checked(e.win16_bridge_module_rollback(id),'NE rollback rejected');}
      catch(cleanup) {throw lifecycleFailure([...failures,cleanup], 'NE rollback failed; dependencies retained');}
      for (const dep of acquired.reverse()) {try {releaseOwned(dep);} catch(cleanup) {failures.push(cleanup);}}
      if (failures.length > 1) throw lifecycleFailure(failures,'NE initialization and dependency cleanup failed');
      throw error;
    }
  };
  const lookupOwned=(id,symbol,token)=>{
      let ordinal=symbol;
      if (typeof symbol === 'string') {
        if (!symbol.length || symbol.length>255 || /[^\x20-\x7e]/.test(symbol)) throw new Error('Invalid NE export name');
        const ptr=Number(token & 0xffffffffn)+1024;
        const name=new Uint8Array(memory.buffer,ptr,symbol.length+1);name[0]=symbol.length;
        for(let i=0;i<symbol.length;i++)name[i+1]=symbol.charCodeAt(i);
        ordinal=e.win16_bridge_module_ordinal(id,ptr);
      }
      if (!Number.isInteger(ordinal) || ordinal<1 || ordinal>65535) return 0;
      return e.win16_bridge_module_entry(id,ordinal)>>>0;
  };
  // Query the process-owned ready image, with a temporary reference held for
  // export inspection. No source bytes or persistent JS module cache required.
  const liveModule = (name, symbol) => scope(token => {
    const id = e.win16_bridge_module_retain_name(...packed(canonical(name)));
    if (!id) return false;
    try { return symbol === undefined ? true : !!lookupOwned(id, symbol, token); }
    finally { releaseOwned(id,false,true); }
  });
  return {
    liveModule,
    load(name) {name=canonical(name);preflight(name);return scope(token=>loadOwned(name,token));},
    loadGuest(name) {
      name=canonical(name);preflight(name);
      return scope(token=>{
        const id=loadOwned(name,token), handle=e.win16_bridge_module_alias(id);
        if (handle < 32) { releaseOwned(id); throw new Error('NE guest handle allocation failed'); }
        return handle;
      });
    },
    retainGuest(name) {return scope(()=>{
      const id=retained(e.win16_bridge_module_retain_name(...packed(canonical(name))));
      if (!id) return 0;
      const handle=e.win16_bridge_module_alias(id);
      if (handle < 32) { releaseOwned(id); throw new Error('NE guest handle allocation failed'); }
      return handle;
    });},
    lookupGuest(handle,symbol) {return scope(token=>{
      const id=e.win16_bridge_module_resolve(handle);
      return id ? lookupOwned(id,symbol,token) : 0;
    });},
    pairGuest(handle,symbol) {return scope(token=>{
      const id=e.win16_bridge_module_resolve(handle);
      checked(id,'Stale LS32 companion');
      const far=lookupOwned(id,symbol,token);
      const pair=e.win16_bridge_ls32_pair(token,id,far)>>>0;
      checked(pair,'Native LS32 connection pairing rejected');return pair;
    });},
    publishFtPair(pair,handle) {return scope(token=>{
      checked(e.win16_bridge_ft_publish(token,pair,handle),'Native FT publication rejected');
    });},
    rollbackFtPair(pair) {return scope(token=>{
      checked(e.win16_bridge_ft_rollback(token,pair),'Native FT rollback rejected');
    });},
    releasePair(pair) {return scope(token=>{
      checked(Number.isInteger(pair)&&pair>0&&pair<=0xffffffff,'Invalid LS32 connection');
      checked(e.win16_bridge_ls32_release(token,pair),'LS32 connection release rejected');
    });},
    callPaired(pair,index,stackWords=[]) {
      checked(Number.isInteger(pair)&&pair>0&&pair<=0xffffffff,'Invalid LS32 connection');
      checked(Number.isInteger(index)&&index>=0&&index<256,'Invalid LS32 target index');
      return neLifecycleInvokeApi.invokeNeEntrySync(e,{ls32:pair,index},{...options,stackWords});
    },
    releaseGuest(handle) {return scope(()=>{
      const id=e.win16_bridge_module_resolve(handle);
      if (id) releaseOwned(id);
    });},
    // lookup alone grants no execution lifetime; call resolves and pins the
    // module under one uninterrupted lifecycle scope.
    lookup(id, symbol) {return scope(token=>lookupOwned(id,symbol,token));},
    call(id, symbol, stackWords=[]) {return scope(token=>{
      const target=lookupOwned(id,symbol,token);checked(target,'NE export unavailable');
      const ds=e.win16_bridge_module_data(id);
      return neLifecycleInvokeApi.invokeNeEntrySync(e,{target,ds,instance:ds||id,heap:0,module:id},{...options,stackWords});
    });},
    // Internal LS16 target driver, not a published QT/FT or PE connection.
    // Native state validates the pairing and target in the same execution scope.
    callLs(id,symbol,pair,stackWords=[]) {return scope(token=>{
      if (!Number.isInteger(pair?.index) || pair.index<0 || pair.index>16383)
        throw new RangeError('Invalid LS target index');
      if (!Number.isInteger(pair.checksum) || pair.checksum<0 || pair.checksum>0xffffffff)
        throw new RangeError('Invalid LS checksum');
      for (const [offset,text] of [[2048,pair.module32],[2304,pair.name32]]) {
        if (typeof text!=='string' || !text.length || text.length>255 || /[^\x21-\x7e]/.test(text))
          throw new Error('Invalid LS pairing name');
        const out=new Uint8Array(memory.buffer,Number(token&0xffffffffn)+offset,256);
        out.fill(0);out[0]=text.length;
        for(let i=0;i<text.length;i++)out[i+1]=text.charCodeAt(i);
      }
      const far=lookupOwned(id,symbol,token);
      const target=e.win16_bridge_ls_target(token,id,far,pair.checksum,pair.index)>>>0;
      checked(target,'LS connection or target unavailable');
      const ds=e.win16_bridge_module_data(id);
      return neLifecycleInvokeApi.invokeNeEntrySync(e,{target,ds,instance:ds||id,heap:0,module:id},{...options,stackWords});
    });},
    release(id) {return scope(()=>releaseOwned(id));},
    retryTermination(id) {return scope(()=>releaseOwned(id,true));},
  };
}
const neLifecycleApi = {createNeLifecycle,NeTerminationError};
if (typeof module !== 'undefined' && module.exports) module.exports = neLifecycleApi;
else globalThis.NeLifecycle = neLifecycleApi;
