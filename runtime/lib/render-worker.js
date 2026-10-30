// One physical renderer Worker per process, with independently owned API ports.
// Ports also implement the Worker subset used by the existing command streams.
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.RenderWorker=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Checked ownership of existing shared packet slots. This does not grant
  // producer write credit or establish GPU completion: callers release only
  // after the consumer has stopped reading, and separately gate the next writer.
  // Register the canonical memory.buffer for every owner. JavaScript cannot
  // identify backing-store aliases introduced by structured-cloning an SAB.
  class SharedPacketPool {
    #owners = new Map();
    #leases = new Map();
    register(owner, buffer, offsets, capacity) {
      if (owner === null || owner === undefined) throw new Error('packet owner required');
      if (typeof SharedArrayBuffer === 'undefined' || !(buffer instanceof SharedArrayBuffer))
        throw new Error('packet storage must be shared');
      if (!Number.isSafeInteger(capacity) || capacity <= 0 || !Array.isArray(offsets) || !offsets.length)
        throw new Error('invalid packet slot layout');
      const starts = Array.from(offsets);
      for (const start of starts) {
        if (!Number.isSafeInteger(start) || start < 0 || start > buffer.byteLength - capacity)
          throw new Error('packet slot outside shared storage');
      }
      starts.sort((a, b) => a - b);
      for (let i = 1; i < starts.length; i++)
        if (starts[i] < starts[i - 1] + capacity) throw new Error('overlapping packet slots');
      const prior = this.#owners.get(owner);
      if (prior) {
        if (prior.buffer === buffer && prior.capacity === capacity &&
            prior.starts.length === starts.length && prior.starts.every((x, i) => x === starts[i])) return this;
        throw new Error('packet owner must retire before registration changes');
      }
      for (const entry of this.#owners.values()) {
        if (entry.buffer !== buffer) continue;
        for (const start of starts) for (const other of entry.starts)
          if (start < other + entry.capacity && other < start + capacity)
            throw new Error('packet slots overlap another owner');
      }
      this.#owners.set(owner, { buffer, capacity, starts, busy: new Set() });
      return this;
    }
    claim(owner, offset, bytes) {
      const entry = this.#owners.get(owner);
      if (!entry) throw new Error('unregistered packet owner');
      if (!Number.isSafeInteger(offset) || !entry.starts.includes(offset) ||
          !Number.isSafeInteger(bytes) || bytes < 0 || bytes > entry.capacity)
        throw new Error('invalid packet claim');
      if (entry.busy.has(offset)) throw new Error('packet slot busy');
      const lease = Object.freeze({ buffer: entry.buffer, byteOffset: offset, bytes });
      entry.busy.add(offset);
      this.#leases.set(lease, { entry, offset });
      return lease;
    }
    release(lease) {
      const active = this.#leases.get(lease);
      if (!active) throw new Error('stale or invalid packet lease');
      this.#leases.delete(lease);
      active.entry.busy.delete(active.offset);
    }
    unregister(owner) {
      const entry = this.#owners.get(owner);
      if (!entry) throw new Error('unregistered packet owner');
      if (entry.busy.size) throw new Error('packet owner still has active leases');
      this.#owners.delete(owner);
    }
  }
  function deferred(){
    let resolve,reject;
    const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
    promise.catch(()=>{});return {promise,resolve,reject};
  }
  // Producer-side admission shared by all packet encodings. A ticket reserves
  // capacity before snapshots are made. complete means payload readers have
  // retired, never GPU completion. Failed publications retain their tickets.
  // Atomic producers use reserve/complete; page brokers use admit/execute.
  class SubmissionQueue {
    constructor(capacity, maxWaiters=1024){
      if(!Number.isSafeInteger(capacity)||capacity<1||!Number.isSafeInteger(maxWaiters)||maxWaiters<1)
        throw new Error('invalid submission queue capacity');
      this.capacity=capacity;this.maxWaiters=maxWaiters;this.used=0;
      this.tickets=new Set();this.waiters=[];this.error=null;this.closing=false;
      this.tail=Promise.resolve();this.admission=Promise.resolve();this.orderedPending=0;this.drainers=[];
    }
    reserve(credits=1){
      if(this.error)throw this.error;
      if(!Number.isSafeInteger(credits)||credits<1||credits>this.capacity)
        throw new Error('invalid submission credits');
      if(credits>this.capacity-this.used)throw new Error('submission queue full');
      const ticket=Object.freeze({credits});this.tickets.add(ticket);this.used+=credits;
      return ticket;
    }
    complete(ticket){
      if(!this.tickets.delete(ticket))throw new Error('stale submission ticket');
      this.used-=ticket.credits;this._pump();this._drained();
    }
    fail(error){
      this.error ||= error;
      for(const waiter of this.waiters.splice(0))waiter.result.reject(this.error);
      this._drained();
    }
    execute(action){
      const result=this.tail.then(()=>{if(this.error)throw this.error;return action();});
      this.tail=result.then(()=>{},error=>{this.fail(error);});
      return result;
    }
    ordered(action){
      if(this.orderedPending>=this.maxWaiters)return Promise.reject(new Error('submission waiter limit'));
      this.orderedPending++;
      const result=this.admission.then(()=>{if(this.error)throw this.error;return action();});
      this.admission=result.then(()=>{this.orderedPending--;},()=>{this.orderedPending--;});return result;
    }
    admit(prepare,credits=1){
      if(this.closing)return Promise.reject(new Error('submission queue closed'));
      if(this.error)return Promise.reject(this.error);
      if(!Number.isSafeInteger(credits)||credits<1||credits>this.capacity)
        return Promise.reject(new Error('invalid submission credits'));
      if(!this.waiters.length&&credits<=this.capacity-this.used)return this._start(prepare,credits);
      if(this.waiters.length>=this.maxWaiters)return Promise.reject(new Error('submission waiter limit'));
      const result=deferred();this.waiters.push({prepare,credits,result});this._pump();
      return result.promise;
    }
    _pump(){
      if(this.pumping||this.error)return;
      this.pumping=true;
      try{
        while(this.waiters.length&&this.waiters[0].credits<=this.capacity-this.used){
          const entry=this.waiters.shift();
          try{entry.result.resolve(this._start(entry.prepare,entry.credits));}
          catch(error){entry.result.reject(error);}
        }
      }finally{this.pumping=false;}
    }
    _start(prepare,credits){
      const ticket=this.reserve(credits);
      let prepared;
      try{prepared=prepare();}
      catch(error){this.complete(ticket);throw error;}
      // prepare must return synchronously and throw only before publication.
      // done includes readback/copy-back; rejection quarantines the ticket.
      Promise.resolve(prepared.done).then(()=>this.complete(ticket),error=>this.fail(error));
      return prepared.value;
    }
    _drained(){
      if(!this.error&&(this.used||this.waiters.length))return;
      for(const waiter of this.drainers.splice(0))
        this.error?waiter.reject(this.error):waiter.resolve();
    }
    close(){
      this.closing=true;
      const result=deferred();this.drainers.push(result);this._drained();
      return result.promise.then(async()=>{await this.tail;if(this.error)throw this.error;});
    }
  }
  function byteSize(value,seen=new Set()){
    if(!value||typeof value!=='object'||seen.has(value))return typeof value==='string'?value.length*2:8;
    seen.add(value);
    if(ArrayBuffer.isView(value))return value.byteLength;
    if(value instanceof ArrayBuffer||typeof SharedArrayBuffer!=='undefined'&&value instanceof SharedArrayBuffer)
      return value.byteLength;
    // Shared process memory and compiled modules are initialization handles,
    // not per-command owned packets.
    if(value instanceof WebAssembly.Memory||value instanceof WebAssembly.Module)return 0;
    return Object.values(value).reduce((n,v)=>n+byteSize(v,seen),0);
  }
  function releaseImages(value,seen=new Set()){
    if(!value||typeof value!=='object'||seen.has(value))return;
    seen.add(value);
    if(typeof ImageBitmap!=='undefined'&&value instanceof ImageBitmap)value.close();
    else if(!ArrayBuffer.isView(value))for(const item of Object.values(value))releaseImages(item,seen);
  }
  class Endpoint {
    constructor(manager,id,options){
      this.manager=manager;this.id=id;this.options=options;this.closed=false;
      this.listeners=new Map();this.requests=new Map();this.sequence=0;
      this._ready=deferred();this.ready=this._ready.promise;
    }
    addEventListener(type,fn){
      if(!this.listeners.has(type))this.listeners.set(type,new Set());
      this.listeners.get(type).add(fn);
    }
    removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
    on(type,fn){const wrapper=event=>fn(type==='message'?event.data:event);
      this.addEventListener(type,wrapper);return this;}
    _emit(type,data){
      const event=type==='message'?{data}:data;
      if(typeof this['on'+type]==='function')this['on'+type](event);
      for(const fn of this.listeners.get(type)||[])fn(event);
    }
    _receive(message){
      if(message.t==='ready')this._ready.resolve(this);
      if(message.t==='render-response'){
        const pending=this.requests.get(message.requestId);
        if(pending){this.requests.delete(message.requestId);
          if(message.error)pending.reject(new Error(message.error));else pending.resolve(message.value);}
        return;
      }
      if(message.t==='error')this._fail(new Error(message.error||'render endpoint failed'));
      this._emit('message',message);
    }
    _fail(error){
      this._ready.reject(error);
      for(const pending of this.requests.values())pending.reject(error);
      this.requests.clear();
      this._emit('error',error);
    }
    postMessage(message){
      if(this.closed)throw new Error('render endpoint is closed');
      this.manager._post(this.id,message);
    }
    request(message){
      if(this.closed)return Promise.reject(new Error('render endpoint is closed'));
      const requestId=++this.sequence,pending=deferred();this.requests.set(requestId,pending);
      try{this.postMessage({t:'render-request',requestId,message});}
      catch(error){this.requests.delete(requestId);pending.reject(error);}
      return pending.promise;
    }
    terminate(){
      if(this._termination)return this._termination;
      this.closed=true;
      this._fail(new Error('render endpoint closed'));
      this._termination=this.manager._close(this.id);
      return this._termination;
    }
  }
  class Manager {
    constructor(options){
      this.options=options;this.ports=new Map();this.pending=new Map();this.closing=new Map();
      this.nextId=0;this.sequence=0;this.queuedBytes=0;this.stopped=false;
      this.maxQueuedBytes=options.maxQueuedBytes??32*1024*1024;
      this.maxQueuedCommands=options.maxQueuedCommands??1024;
      this.maxEndpoints=options.maxEndpoints??64;
      if(!Number.isSafeInteger(this.maxQueuedBytes)||this.maxQueuedBytes<1||
          !Number.isSafeInteger(this.maxQueuedCommands)||this.maxQueuedCommands<1||
          !Number.isSafeInteger(this.maxEndpoints)||this.maxEndpoints<1)
        throw new Error('invalid render worker queue limits');
      this._ready=deferred();this.ready=this._ready.promise;
      this.worker=options.workerFactory?options.workerFactory():new Worker(options.workerUrl||
        'lib/d3d-render-worker.js?v='+encodeURIComponent(options.sourceVersion||'dev'));
      const receive=event=>this._receive(event&&event.data!==undefined?event.data:event);
      const fail=error=>this._fail(error instanceof Error?error:new Error(error?.message||'render worker failed'));
      try {
      if(typeof this.worker.on==='function'){
        this.worker.on('message',receive);this.worker.on('error',fail);
        this.worker.on('exit',()=>{if(!this._retired)this._fail(new Error('render worker exited before heap retirement'));});
      }else{this.worker.addEventListener('message',receive);this.worker.addEventListener('error',fail);}
      this.worker.postMessage({t:'render-init',module:options.module,memory:options.memory,sigs:options.sigs,
        imageBase:options.imageBase,sourceVersion:options.sourceVersion,
        maxQueuedBytes:this.maxQueuedBytes,maxQueuedCommands:this.maxQueuedCommands});
      } catch(error) {
        this.stopped=true;this._failure=error;this._ready.reject(error);
        // Construction failed before the caller acquired the worker owner.
        try { Promise.resolve(this.worker.terminate()).catch(()=>{}); } catch(_) {}
        throw error;
      }
    }
    createEndpoint(options){
      if(this.stopped)throw new Error('render worker is stopped');
      if(this.ports.size>=this.maxEndpoints)throw new Error('render worker endpoint limit');
      const id=++this.nextId,port=new Endpoint(this,id,options);this.ports.set(id,port);
      try{this.worker.postMessage({t:'render-open',endpointId:id,options});}
      catch(error){this.ports.delete(id);port._fail(error);throw error;}
      return port;
    }
    _post(endpointId,message){
      if(this.stopped)throw new Error('render worker is stopped');
      const bytes=byteSize(message);
      if(this.pending.size>=this.maxQueuedCommands||bytes>this.maxQueuedBytes-this.queuedBytes)
        throw new Error('render worker queue capacity exceeded');
      const transportId=++this.sequence;
      this.pending.set(transportId,bytes);this.queuedBytes+=bytes;
      try{this.worker.postMessage({t:'render-message',endpointId,transportId,message});}
      catch(error){this.pending.delete(transportId);this.queuedBytes-=bytes;throw error;}
    }
    _close(endpointId){
      if(this._retired)return Promise.resolve();
      // Lease retirement must wait for physical termination on a failed
      // process, too. The manager's stop promise still reports lost ownership.
      if(this.stopped)return (this._stop||this.stop()).then(()=>{},()=>{});
      const pending=deferred();this.closing.set(endpointId,pending);
      try{this.worker.postMessage({t:'render-close',endpointId});}catch(error){pending.reject(error);}
      return pending.promise;
    }
    _receive(message){
      if(message.t==='render-ready'){this._ready.resolve(this);return;}
      if(message.t==='render-done'){
        const bytes=this.pending.get(message.transportId);
        if(bytes!==undefined){this.pending.delete(message.transportId);this.queuedBytes-=bytes;}return;
      }
      if(message.t==='render-closed'){
        this.ports.delete(message.endpointId);
        const pending=this.closing.get(message.endpointId);
        if(message.error)pending?.reject(new Error(message.error));else pending?.resolve();
        this.closing.delete(message.endpointId);return;
      }
      if(message.t==='render-stopped'){
        this._retired=true;this._shutdown?.resolve(message);return;
      }
      if(message.t==='render-event'){
        const port=this.ports.get(message.endpointId);
        if(port&&!port.closed)port._receive(message.message);else releaseImages(message.message);
        return;
      }
      if(message.t==='error')this._fail(new Error(message.error||'render worker failure'));
    }
    _fail(error){
      this._failure=error;this.stopped=true;this._ready.reject(error);this._shutdown?.reject(error);
      for(const port of this.ports.values())port._fail(error);
      for(const pending of this.closing.values())pending.reject(error);
      this.pending.clear();this.queuedBytes=0;
      this.options.onError?.(error);
    }
    stop(){
      if(this._stop)return this._stop;
      this.stopped=true;this._shutdown=deferred();
      this._stop=(async()=>{
        let timer;
        try{
          if(this._failure)throw this._failure;
          this.worker.postMessage({t:'render-stop'});
          const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('render worker shutdown timed out; heap not reclaimed')),
            this.options.shutdownTimeoutMs??10000);});
          const result=await Promise.race([this._shutdown.promise,timeout]);
          if(result.heapHead){
            if(typeof this.options.reclaimHeap!=='function')throw new Error('render heap reclamation callback missing');
            const adopted=await this.options.reclaimHeap(result.heapHead);
            if(!Number.isInteger(adopted)||adopted<0)throw new Error('render heap handoff rejected');
            result.heapAdopted=adopted;
          }
          return result;
        }finally{
          clearTimeout(timer);
          for(const port of this.ports.values()){port.closed=true;port._fail(new Error('render worker stopped'));}
          this.ports.clear();this.pending.clear();this.queuedBytes=0;
          await this.worker.terminate();
        }
      })();
      this._stop.catch(()=>{});return this._stop;
    }
  }
  return {Manager, SharedPacketPool, SubmissionQueue};
});
