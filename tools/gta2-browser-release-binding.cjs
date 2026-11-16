'use strict';
// Finite manual input binding. No gameplay selection or guest-private reads.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const HELPER='scratch/runs/20261108-redline-car-door-native/bound-input.cjs';
function nativeContext(ex) {
  // Runs on the owning CPU instance; only public USER/process exports.
  for (const name of ['get_main_hwnd','get_focus_hwnd','get_capture_hwnd','modal_dialog_hwnd',
    'dialogbox_hwnd','get_process_id','get_current_thread_id','get_window_thread',
    'wnd_lookup_live','wnd_lookup_generation','wnd_get_style_export','wnd_get_owner','wnd_get_parent',
    'wnd_top_level','wnd_screen_w','wnd_screen_h','get_eip','get_quit_flag','get_yield_reason','ctrl_get_class']) {
    if (typeof ex[name] !== 'function') throw Error('missing native guard export ' + name);
  }
  const processId = ex.get_process_id() >>> 0, threadId = ex.get_current_thread_id() >>> 0;
  function window(hwnd) {
    hwnd >>>= 0;
    const style = ex.wnd_get_style_export(hwnd) >>> 0;
    return {hwnd, generation:String(ex.wnd_lookup_generation(hwnd)),
      live:!!ex.wnd_lookup_live(hwnd), threadId:ex.get_window_thread(hwnd) >>> 0,
      owner:ex.wnd_get_owner(hwnd) >>> 0, parent:ex.wnd_get_parent(hwnd) >>> 0,
      visible:!!(style & 0x10000000), child:!!(style & 0x40000000),
      width:ex.wnd_screen_w(hwnd) >>> 0, height:ex.wnd_screen_h(hwnd) >>> 0};
  }
  const main = window(ex.get_main_hwnd()), focus = window(ex.get_focus_hwnd());
  const modalHwnd = (ex.modal_dialog_hwnd() || ex.dialogbox_hwnd()) >>> 0;
  const modal = modalHwnd ? window(modalHwnd) : null;
  const capture = ex.get_capture_hwnd() >>> 0, focusTopLevel = ex.wnd_top_level(focus.hwnd) >>> 0;
  const live = w => w.hwnd && w.live && w.generation !== '0' && w.threadId === threadId;
  const modalValid = !modal || (live(modal) && modal.visible && !modal.child &&
    (modal.owner === main.hwnd || !modal.owner && ex.ctrl_get_class(modal.hwnd) === 16));
  const healthy = !!(processId && threadId && ex.get_eip() && !ex.get_quit_flag() && ex.get_yield_reason() !== 2 &&
    live(main) && main.visible && !main.child && live(focus) && !capture && modalValid &&
    focusTopLevel === (modal ? modal.hwnd : main.hwnd));
  return {healthy, context:{processId, threadId, main, focus, focusTopLevel, capture, modal}};
}
function workerBridge(readNative) {
  // Free names below are the actual existing
  // guest-worker command channel, not values asserted by a controller.
  // Installation and independent child attestation verify current executed source.
  if (Object.hasOwn(globalThis, '__gta2NativeReleaseV1')) throw Error('native bridge already installed');
  const ownerInstance = instance, ownerEndpoint = endpointIdentity, ownerSlot = workerSlot;
  const epoch = crypto.randomUUID(), used = new Set();let bound = null, armed = null, closed = null;
  const clone = value => JSON.parse(JSON.stringify(value));
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const check = (condition, message) => {if (!condition) throw Error(message);};
  const snapshot = () => {
    check(!closed, 'permanent native UNKNOWN');
    check(self.onmessage===onMessage && instance === ownerInstance && endpointIdentity === ownerEndpoint && workerSlot === ownerSlot &&
      !scopedRetiring && !threadSendFrames.length && !threadSendWaits.fenced() && !threadSendWaits.rootSend &&
      !(typeof dynamicLoadTransaction !== 'undefined' && (dynamicLoadTransaction || dynamicLoadDraining)) &&
      !writerActive() && !commandWriterHandoff, 'native owner unavailable or nested');
    const value = readNative(instance.exports);
    check(value.healthy, 'unhealthy native USER context');
    return {...value, endpointIdentity:ownerEndpoint, slot:ownerSlot, epoch};
  };
  const validate = () => {
    const actual = snapshot();
    check(bound && same(actual, bound.native), 'current native scene changed');
    return actual;
  };
  const transact = msg => {
    check(!closed, 'permanent native UNKNOWN');
    check(msg.endpointIdentity === ownerEndpoint && msg.epoch === epoch, 'native endpoint/epoch changed');
    if (msg.action === 'read') return snapshot();
    if (msg.action === 'bind') {
      check(!armed, 'binding after arm');
      const actual = snapshot();
      check(same(actual, msg.review.native), 'reviewed native scene changed before binding');
      check(msg.review.reviewed === true && msg.review.observation.trim(), 'explicit scene review required');
      check(/^[a-f0-9]{64}$/.test(msg.review.pngSHA256), 'reviewed complete scene hash');
      check([5000,30000].includes(msg.review.maxAgeMs) && Date.now() >= msg.review.capturedAt &&
        Date.now()-msg.review.capturedAt < msg.review.maxAgeMs, 'fresh scene required');
      bound = clone({...msg.review, token:crypto.randomUUID()});return clone(bound);
    }
    if (msg.action === 'arm') {
      check(bound && !armed && msg.bindingToken === bound.token, 'one current binding before arm');
      check(/^[a-z0-9-]{8,100}$/.test(msg.nonce) && !used.has(msg.nonce), 'fresh native intent nonce');
      used.add(msg.nonce);
      check(msg.intent.trim() && msg.childToken && Array.isArray(msg.keys) && msg.keys.length >= 1 && msg.keys.length <= 2 &&
        new Set(msg.keys).size === msg.keys.length && msg.keys.every(k=>Number.isInteger(k)&&k>0&&k<256), 'finite native intent');
      check(Number.isSafeInteger(msg.startedAt) && Date.now() >= msg.startedAt && Date.now()-msg.startedAt <= 500,
        'native prearm exceeded 500ms');
      check(Date.now()-bound.capturedAt < bound.maxAgeMs, 'stale reviewed scene');
      const actual = validate();
      armed = clone({...msg, at:Date.now(), fallback:Date.now()+1500, consumed:[]});
      return {armed:true, nonce:msg.nonce, childToken:msg.childToken, native:actual,
        bindingToken:bound.token, at:armed.at, fallback:armed.fallback};
    }
    check(armed && msg.nonce === armed.nonce && msg.childToken === armed.childToken, 'native intent/child changed');
    if (msg.action === 'cancel') {closed = 'cancelled native intent';return {state:'CANCELLED',nonce:msg.nonce};}
    if (msg.action === 'confirm') {
      check(!armed.leaseToken && !armed.consumed.length && msg.leaseToken,'one fresh native lease confirmation');
      check(Date.now()-armed.startedAt<=500,'native confirmation exceeded 500ms');
      const actual=validate();armed.leaseToken=msg.leaseToken;
      return {state:'CONFIRMED',nonce:msg.nonce,childToken:msg.childToken,leaseToken:msg.leaseToken,native:actual};
    }
    if (msg.action === 'consume') {
      check(armed.leaseToken && msg.leaseToken===armed.leaseToken,'current independently confirmed native lease required');
      check(Date.now() < armed.fallback-250 && Date.now()-bound.capturedAt < bound.maxAgeMs, 'native lease expired');
      check(armed.keys.includes(msg.key) && !armed.consumed.includes(msg.key), 'unarmed or duplicate native edge');
      const actual = validate();
      check(msg.commit instanceof SharedArrayBuffer && msg.commit.byteLength === 8, 'bounded physical commit channel');
      check(Number.isSafeInteger(msg.deadline) && msg.deadline > Date.now() && msg.deadline-Date.now() <= 3000,
        'finite immutable native commit deadline');
      const words = new Int32Array(msg.commit);check(Atomics.load(words,0) === 0, 'commit channel reused');
      armed.consumed.push(msg.key);
      // The owner remains synchronously parked until the page has either
      // consumed or refused this exact physical edge. No guest run/clock edit.
      self.postMessage({t:'gta2NativeCommitV1', request:msg.request, nonce:msg.nonce,
        childToken:msg.childToken, key:msg.key, actual, commit:msg.commit});
      const remaining = Math.max(0,Math.min(3000,msg.deadline-Date.now(),armed.fallback-Date.now()));
      Atomics.wait(words,0,0,remaining);
      check(Atomics.load(words,0) === 1 && Atomics.load(words,1) === msg.key, 'physical edge refused or unresolved');
      return {state:'CONSUMED',nonce:msg.nonce,key:msg.key,at:Date.now(),native:actual};
    }
    if (msg.action === 'finish') {
      check(armed.consumed.length === armed.keys.length, 'finish without complete consumption');
      const receipt = {state:'RELEASED',nonce:msg.nonce,noReplay:true};armed=null;bound=null;return receipt;
    }
    throw Error('unsupported native binding operation');
  };
  const previous = self.onmessage;
  const onMessage = event => {
    const msg = event?.data;
    if (msg?.t !== 'gta2NativeRequestV1') return previous.call(self,event);
    commandQueue = commandQueue.then(() => {
      try {self.postMessage({t:'gta2NativeReplyV1',request:msg.request,result:transact(msg)});}
      catch (error) {
        closed = String(error);
        self.postMessage({t:'gta2NativeReplyV1',request:msg.request,error:closed,permanentClose:true,laterRequestsAllowed:0});
      }
    });
  };
  self.onmessage=onMessage;
  Object.defineProperty(globalThis,'__gta2NativeReleaseV1',{value:Object.freeze({epoch,endpointIdentity:ownerEndpoint,slot:ownerSlot})});
  return snapshot();
}
function pageBridge(options, readNative) {
  // Independent child attestation recovers and compares
  // these function bodies, owning source scripts and module bytes independently.
  if (Object.hasOwn(globalThis,'__gta2NativeReleasePageV1')) throw Error('page binding already installed');
  const check = (ok,message) => {if (!ok) throw Error(message);};
  const clone = value => JSON.parse(JSON.stringify(value));
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const appsNow = () => typeof runningApps === 'undefined' ? [] : runningApps;
  check(appsNow().length === 1 && appsNow()[0].name === options.app, 'one current registered owner');
  const wine = appsNow()[0].wine, renderer = wine.renderer, link = wine.guestWorker?.link;
  const worker = link?.worker, memory = wine.memory, buffer = memory.buffer, instance = wine.instance;
  const module = wine._wasmModule, canvas = renderer.canvas, queue = renderer.inputQueue;
  const originalDown = renderer.handleKeyDown, originalUp = renderer.handleKeyUp, originalPress = renderer.handleKeyPress;
  const epoch = crypto.randomUUID(), ids = new WeakMap();let next = 0;
  const token = object => {if (!object) return null;if (!ids.has(object)) ids.set(object,epoch+':'+(++next));return ids.get(object);};
  const pending = new Map(), receipts = new Map();let sequence = 0, closed = null, binding = null, active = null;
  const nativeOwner = clone(options.nativeOwner), events = [];
  const mainNonces = new Set();let mainBound = null, mainArm = null;
  function mainNative() {
    page();
    const value = readNative(instance.exports);check(value.healthy,'unhealthy main-thread native context');
    return {...value,endpointIdentity:'main',slot:0,epoch:nativeOwner.epoch};
  }
  function mainTransact(action, body) {
    open();
    if (action === 'read') return mainNative();
    if (action === 'bind') {
      check(!mainArm,'binding after arm');const actual = mainNative();
      check(same(actual,body.review.native),'reviewed main native scene changed');
      check(body.review.reviewed && body.review.observation.trim() && /^[a-f0-9]{64}$/.test(body.review.pngSHA256),
        'explicit complete native review required');
      check([5000,30000].includes(body.review.maxAgeMs) && Date.now() >= body.review.capturedAt &&
        Date.now()-body.review.capturedAt < body.review.maxAgeMs,'fresh main native scene');
      mainBound = clone({...body.review,token:crypto.randomUUID()});return clone(mainBound);
    }
    if (action === 'arm') {
      check(mainBound && !mainArm && body.bindingToken === mainBound.token,'one current main binding');
      check(/^[a-z0-9-]{8,100}$/.test(body.nonce) && !mainNonces.has(body.nonce),'fresh main intent nonce');
      mainNonces.add(body.nonce);
      check(body.intent.trim() && body.childToken && Array.isArray(body.keys) && body.keys.length >= 1 && body.keys.length <= 2 &&
        new Set(body.keys).size === body.keys.length && body.keys.every(k=>Number.isInteger(k)&&k>0&&k<256),'finite main intent');
      check(Number.isSafeInteger(body.startedAt) && Date.now() >= body.startedAt && Date.now()-body.startedAt <= 500,'main prearm exceeded 500ms');
      const actual = mainNative();check(same(actual,mainBound.native),'main native arm scene changed');
      check(Date.now()-mainBound.capturedAt < mainBound.maxAgeMs,'stale main review');
      mainArm = {...clone(body),at:Date.now(),fallback:Date.now()+1500,consumed:[]};
      return {armed:true,nonce:body.nonce,childToken:body.childToken,native:actual,bindingToken:mainBound.token,
        at:mainArm.at,fallback:mainArm.fallback};
    }
    check(mainArm && body.nonce === mainArm.nonce && body.childToken === mainArm.childToken,'main intent/child changed');
    if (action === 'cancel') {seal('main intent cancelled');return {state:'CANCELLED',nonce:body.nonce};}
    if (action === 'confirm') {
      check(!mainArm.leaseToken && !mainArm.consumed.length && body.leaseToken,'one fresh main lease confirmation');
      check(Date.now()-mainArm.startedAt<=500,'main confirmation exceeded 500ms');
      const actual=mainNative();check(same(actual,mainBound.native),'main native context changed before confirmation');
      mainArm.leaseToken=body.leaseToken;
      return {state:'CONFIRMED',nonce:body.nonce,childToken:body.childToken,leaseToken:body.leaseToken,native:actual};
    }
    if (action === 'finish') {
      check(mainArm.consumed.length === mainArm.keys.length,'main finish before consumption');
      mainArm=null;mainBound=null;return {state:'RELEASED',nonce:body.nonce,noReplay:true};
    }
    check(action === 'consume' && mainArm.keys.includes(body.key) && !mainArm.consumed.includes(body.key),'unique main native edge');
    check(mainArm.leaseToken && body.leaseToken===mainArm.leaseToken,'current independently confirmed main lease required');
    check(Date.now() < mainArm.fallback-250 && Date.now()-mainBound.capturedAt < mainBound.maxAgeMs,'main lease expired');
    const actual = mainNative();check(same(actual,mainBound.native),'main native context changed');
    mainArm.consumed.push(body.key);
    validateConsumption({...body,actual});
    // Same JS turn on the actual main CPU; there is no asynchronous gap from
    // native predicate to the original physical handler.
    active.physical.add(body.key);originalDown.call(renderer,body.key,active.pendingInfo.get(body.key));
    events.push({type:'DOWN',key:body.key,nonce:body.nonce,at:Date.now()});
    return {state:'CONSUMED',nonce:body.nonce,key:body.key,at:Date.now(),native:actual};
  }
  function seal(error) {
    if (closed) return;
    closed = String(error);
    for (const entry of pending.values()) {clearTimeout(entry.timer);entry.reject(Error('permanent UNKNOWN '+closed));}
    pending.clear();
  }
  function open() {check(!closed,'permanent page UNKNOWN; zero later requests');}
  function page() {
    open();
    check(appsNow().length === 1 && appsNow()[0].name === options.app && appsNow()[0].wine === wine &&
      wine.running && !wine._stopped && wine.renderer === renderer && wine.memory === memory && memory.buffer === buffer &&
      wine.instance === instance && wine._wasmModule === module && renderer.canvas === canvas && renderer.inputQueue === queue &&
      renderer.handleKeyDown === down && renderer.handleKeyUp === up && renderer.handleKeyPress === press,
      'current process/renderer/source ownership changed');
    if (worker) check(wine.guestWorker?.link === link && link.worker === worker && !link._stopped && !link._stopping &&
      !link._transportFailure && link.endpointIdentity === nativeOwner.endpointIdentity, 'actual CPU endpoint retired');
    else check(!wine.guestWorker,'CPU backend changed');
    const ports = [...(wine._renderWorkerManager?.ports?.values() || [])].filter(p=>!p.closed);
    const renderId = wine.guestWorker?.d3dStats?.renderEndpointId;
    const owners = ports.filter(p=>p.id === renderId);
    check(owners.length <= 1,'ambiguous owning backend');
    const port = owners[0] || (!renderId && ports.length === 1 ? ports[0] : null);
    check(!renderId || port,'actual owning renderer unavailable');
    const backend = port?.options?.backend || 'none';
    check(backend === 'none' || backend === options.backend,'actual backend changed');
    return {identity:{epoch, processId:wine.processId, processObject:token(wine), renderer:token(renderer),
      memory:token(memory), buffer:token(buffer), module:token(module), canvas:token(canvas), queue:token(queue),
      instance:token(instance), worker:token(worker), endpoint:link?.endpointIdentity ?? 'main',
      renderManager:token(wine._renderWorkerManager), renderWorker:token(wine._renderWorkerManager?.worker),
      renderPort:token(port), renderEndpoint:port?.id ?? 'none', backend},
      physicalUp:!renderer._mouseButtonsMask && !Object.values(renderer._physicalKeys || {}).some(Boolean)};
  }
  const request = (action, body = {}) => {
    open();
    const request = ++sequence;
    if (!worker) {
      try {return Promise.resolve(mainTransact(action,body));}
      catch (error) {seal(error);return Promise.reject(error);}
    }
    return new Promise((resolve,reject) => {
      const timer = setTimeout(() => seal('native '+action+' exceeded 3000ms'),3000);
      pending.set(request,{resolve,reject,timer,action,body});
      try {worker.postMessage({t:'gta2NativeRequestV1',request,action,...body,
        endpointIdentity:nativeOwner.endpointIdentity,epoch:nativeOwner.epoch});}
      catch (error) {seal(error);}
    });
  };
  function validateWindow(record, refs) {
    if (!record) return;
    const win=renderer.windows[record.hwnd],expected=refs.get(record.hwnd),ex=instance.exports;
    const diagnostics={hwnd:record.hwnd,child:record.child,expectedRenderer:!!expected,currentRenderer:!!win,
      sameRenderer:win===expected,visible:win?.visible??null,processId:win?.processId??null,
      expectedProcessId:wine.processId,generation:String(ex.wnd_lookup_generation(record.hwnd)),
      threadId:ex.get_window_thread(record.hwnd),live:!!ex.wnd_lookup_live(record.hwnd)};
    check(diagnostics.live && diagnostics.generation===record.generation && diagnostics.threadId===record.threadId,
      'native shared window generation/thread changed '+JSON.stringify(diagnostics));
    if(expected){
      check(win===expected && win.visible && win.wasm===instance && win.processId===wine.processId,
        'original renderer window/process changed '+JSON.stringify(diagnostics));
    }else{
      // Standard native child controls are painted by their top-level dialog;
      // they need not have a separate renderer Window object. Their actual
      // native HWND/generation/thread/focus/parent remain checked on both CPUs.
      check(!win && record.child && record.hwnd===binding.review.native.context.focus.hwnd &&
        record.parent && ex.wnd_get_parent(record.hwnd)===record.parent &&
        ex.wnd_top_level(record.hwnd)===binding.review.native.context.focusTopLevel &&
        refs.get(binding.review.native.context.focusTopLevel),
        'native focused control owner changed '+JSON.stringify(diagnostics));
    }
  }
  function validateConsumption(message) {
    check(active && binding && message.nonce === active.nonce && message.childToken === active.childToken &&
      active.keys.includes(message.key) && !active.upSeen.has(message.key), 'wrong or cancelled physical intent');
    check(Date.now() < active.fallback-250 && Date.now()-binding.review.capturedAt < binding.review.maxAgeMs,'physical lease expired');
    check(same(page().identity,binding.review.pageIdentity),'page/module/backend changed at physical consumption');
    check(same(message.actual,binding.review.native),'native scene changed at physical consumption');
    const context = message.actual.context;check(context.processId===wine.processId,'native process changed at physical consumption');
    for (const record of [context.main,context.focus,context.modal]) validateWindow(record,binding.windows);
    check(!renderer._mouseButtonsMask && Object.entries(renderer._physicalKeys || {}).every(([key,held]) =>
      !held || active.physical.has(Number(key))), 'unowned physical input at consumption');
  }
  if (worker) worker.addEventListener('message', event => {
    const message = event.data;
    if (message?.t === 'gta2NativeCommitV1') {
      const words = new Int32Array(message.commit);
      try {
        const entry = pending.get(message.request);
        check(entry?.action === 'consume' && entry.body.key === message.key,'unrequested native commit');
        validateConsumption(message);
        const info = active.pendingInfo.get(message.key);check(info,'missing physical key edge');
        active.physical.add(message.key);
        originalDown.call(renderer,message.key,info);
        events.push({type:'DOWN',key:message.key,nonce:message.nonce,at:Date.now()});
        Atomics.store(words,1,message.key);Atomics.store(words,0,1);
      } catch (error) {Atomics.store(words,0,-1);seal(error);}
      finally {Atomics.notify(words,0);}
    } else if (message?.t === 'gta2NativeReplyV1') {
      if (closed) return;
      const entry = pending.get(message.request);if (!entry) {seal('unexpected native response');return;}
      clearTimeout(entry.timer);pending.delete(message.request);
      if (message.error) {entry.reject(Error(message.error));seal(message.error);}
      else entry.resolve(message.result);
    }
  });
  function down(key, info) {
    if (closed) return;
    try {
      check(active && active.leaseToken && active.keys.includes(key) && !active.pendingInfo.has(key),'DOWN without unique independently confirmed native arm');
      active.pendingInfo.set(key,info || {});
      const commit = new SharedArrayBuffer(8);
      const work=request('consume',{nonce:active.nonce,childToken:active.childToken,leaseToken:active.leaseToken,key,commit,deadline:Date.now()+3000})
        .then(receipt => {receipts.set(receipt.nonce+':'+key,receipt);return receipt;});
      active.promises.set(key,work);work.catch(seal);
    } catch (error) {seal(error);}
  }
  function up(key, info) {
    // Freshness/UNKNOWN and legitimate native focus changes never block UP on
    // the original exact renderer. This path cannot dispatch a new DOWN.
    originalUp.call(renderer,key,info);
    if (active) {active.upSeen.add(key);active.physical.delete(key);}
    events.push({type:'UP',key,nonce:active?.nonce ?? null,at:Date.now()});
  }
  function press(...args) {
    // CDP finite keyDown/keyUp gestures do not supply text. An independent
    // character event is outside this guarded protocol and cannot add effects.
    return undefined;
  }
  renderer.handleKeyDown = down;renderer.handleKeyUp = up;renderer.handleKeyPress = press;
  const api = Object.freeze({epoch,app:options.app,
    async sourceProof({compactHost=false}={}) {
      page();
      const host=WineAssembly.toString();
      const hostSHA256=compactHost?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
        new TextEncoder().encode(host))),byte=>byte.toString(16).padStart(2,'0')).join(''):undefined;
      page();
      return {bridge:pageBridge.toString(),nativeContext:readNative.toString(),
        ...(compactHost?{hostSHA256}:{host}),
        down:originalDown.toString(),up:originalUp.toString(),press:originalPress.toString()};
    },
    async read() {
      try {const before = page();check(before.physicalUp,'physical UP required before native review');
        const native = await request('read');check(native.context.processId===wine.processId,'native process identity differs from page owner');check(same(before,page()),'owner changed during native observation');
        return {native,pageIdentity:before.identity,physicalUp:true};
      } catch (error) {seal(error);throw error;}
    },
    async attest(expected) {
      try {
        open();check(binding && !active,'unarmed current binding required');
        check(expected.bindingToken === binding.token && same(expected.review,binding.review),'child reviewed binding changed');
        const actual = await api.read();
        check(same(actual.native,expected.review.native) && same(actual.pageIdentity,expected.review.pageIdentity),'independent child native/page scene changed');
        return {...actual,bindingToken:binding.token,reviewedPNG:binding.review.pngSHA256};
      } catch (error) {seal(error);throw error;}
    },
    async bind(review) {
      try {
        open();check(!active,'binding after arm');check(same(page().identity,review.pageIdentity),'reviewed page identity changed');
        const windows = new Map();for (const record of [review.native.context.main,review.native.context.focus,review.native.context.modal])
          if (record) windows.set(record.hwnd,renderer.windows[record.hwnd]);
        const native = await request('bind',{review});
        check(same(page().identity,review.pageIdentity),'owner changed during native binding');
        binding = {review:clone(review),windows,token:native.token};
        for(const record of [review.native.context.main,review.native.context.focus,review.native.context.modal])validateWindow(record,windows);
        return {bindingToken:native.token,review:clone(review)};
      } catch (error) {seal(error);throw error;}
    },
    async arm(intent) {
      try {
        open();check(binding && !active && page().physicalUp,'current unarmed native binding and physical UP required');
        check(intent.bindingToken === binding.token,'native binding changed');
        const result = await request('arm',intent);
        check(same(page().identity,binding.review.pageIdentity),'owner changed during native arm');
        check(same(result.native,binding.review.native),'independent native arm scene changed');
        active = {...clone(result),startedAt:intent.startedAt,keys:[...intent.keys],pendingInfo:new Map(),physical:new Set(),upSeen:new Set(),promises:new Map()};
        return clone({...result,pageIdentity:binding.review.pageIdentity});
      } catch (error) {seal(error);throw error;}
    },
    async confirm({nonce,childToken,leaseToken}) {
      try {
        open();check(active && active.nonce===nonce && active.childToken===childToken && !active.leaseToken &&
          !active.pendingInfo.size && page().physicalUp,'fresh unconsumed physical UP lease required');
        check(typeof leaseToken==='string' && leaseToken.length>=16 && Date.now()-active.startedAt<=500,'bounded fresh lease token');
        const result=await request('confirm',{nonce,childToken,leaseToken});
        check(same(page().identity,binding.review.pageIdentity) && same(result.native,binding.review.native),
          'current source/page/native lease changed before confirmation');
        for(const record of [binding.review.native.context.main,binding.review.native.context.focus,binding.review.native.context.modal])
          validateWindow(record,binding.windows);
        check(page().physicalUp && Date.now()-active.startedAt<=500,'physical UP confirmation exceeded 500ms');
        active.leaseToken=leaseToken;return clone({...result,pageIdentity:binding.review.pageIdentity});
      } catch(error) {seal(error);throw error;}
    },
    async consumed({nonce,key}) {
      open();check(active?.nonce === nonce && active.promises.has(key),'no pending armed key');
      return await active.promises.get(key);
    },
    status(nonce) {
      open();check(active?.nonce === nonce,'wrong status nonce');
      return {nonce,receipts:active.keys.map(key=>receipts.get(nonce+':'+key) || null),events:clone(events),
        physicalUp:active.keys.every(key=>active.upSeen.has(key)&&!renderer.peekKeyDownState(key))};
    },
    async cancel({nonce,childToken}) {
      try {return await request('cancel',{nonce,childToken});}
      finally {seal('independent child cancelled intent');}
    },
    async finish({nonce,childToken}) {
      open();check(active?.nonce === nonce && active.childToken === childToken,'wrong release nonce/child');
      check(active.keys.every(key=>active.upSeen.has(key) && !renderer.peekKeyDownState(key)),'original physical UP unproved');
      check(active.keys.every(key=>receipts.get(nonce+':'+key)?.state === 'CONSUMED'),'input consumption unresolved');
      // UP cleanup still refers to the original exact renderer when a native
      // ExitProcess has retired its Worker. It does not send another DOWN.
      const exited=wine._processObject?.exited === true;
      const result = exited ? {state:'RELEASED',nonce,nativeOwnerExited:true,noReplay:true} : await request('finish',{nonce,childToken});
      const proof={...result,events:clone(events.filter(e=>e.nonce===nonce)),
        receipts:active.keys.map(key=>clone(receipts.get(nonce+':'+key))),physicalUp:active.keys.every(key=>!renderer.peekKeyDownState(key))};
      active=null;binding=null;return proof;
    },
    seal:reason=>seal(reason),
  });
  Object.defineProperty(globalThis,'__gta2NativeReleasePageV1',{value:api});
  return page();
}
const WORKER_URL='gta2-native-release-worker-v1.js',PAGE_URL='gta2-native-release-page-v1.js';
function workerSource(){return '('+workerBridge.toString()+')('+nativeContext.toString()+')\n//# sourceURL='+WORKER_URL;}
function pageSource(options){return '('+pageBridge.toString()+')('+JSON.stringify(options)+','+nativeContext.toString()+')\n//# sourceURL='+PAGE_URL;}
function checkPID(pid,startToken){
  assert(Number.isSafeInteger(pid)&&pid>1,'actual OS PID required');
  const s=fs.readFileSync('/proc/'+pid+'/stat','utf8');
  assert.equal(s.slice(s.lastIndexOf(')')+2).split(' ')[19],startToken,'process start identity changed');
}
function verifyPins(pins){
  assert(Array.isArray(pins.files)&&pins.files.length,'current source pins required');
  for(const p of pins.files){
    assert(typeof p.path==='string'&&!path.isAbsolute(p.path)&&!p.path.split('/').includes('..'));
    assert.equal(sha(fs.readFileSync(path.join(ROOT,p.path))),p.sha256,'current source changed '+p.path);
  }
  for(const required of ['tools/gta2-browser-release-binding.cjs','tools/gta2-paired-controller.cjs',HELPER,'build/wine-assembly.wasm'])
    assert(pins.files.some(p=>p.path===required),'required current helper/source/module pin '+required);
}
// Every invocation checks every pin. Mutable files are freshly read and hashed;
// immutable Git bytes may use their verified view digest only after fresh and
// executed preload provenance is checked. Native/module observations never use
// this source-only path. WebCrypto keeps mutable hashing off this event loop.
async function verifyPinsAsync(pins){
  assert(Array.isArray(pins.files)&&pins.files.length,'current source pins required');
  const seen=new Set();
  for(const p of pins.files){
    assert(typeof p.path==='string'&&!path.isAbsolute(p.path)&&!p.path.split('/').includes('..'));
    assert(/^[a-f0-9]{64}$/.test(p.sha256)&&!seen.has(p.path),'unique current source pin');seen.add(p.path);
  }
  for(const required of ['tools/gta2-browser-release-binding.cjs','tools/gta2-paired-controller.cjs',HELPER,'build/wine-assembly.wasm'])
    assert(seen.has(required),'required current helper/source/module pin '+required);
  const view=globalThis.__gta2ImmutableVerifiedViewV1;
  if(view){
    assert(Object.isFrozen(view)&&view.version===1,'immutable verified source view contract');
    assert.equal(view.head,process.env.GTA2_PIN_VIEW_HEAD);assert.equal(view.head,process.env.GTA2_VIEW_HEAD);
    const preload=pins.files.find(p=>path.resolve(ROOT,p.path)===view.sourcePath);
    assert(preload,'current verified source-view preload pin required');
    assert.equal(view.executedSHA256,preload.sha256,'exact executed immutable view preload');
    const bytes=await fs.promises.readFile(view.sourcePath);
    assert.equal(Buffer.from(await crypto.webcrypto.subtle.digest('SHA-256',bytes)).toString('hex'),preload.sha256,'current immutable view preload changed');
  }
  const completed=await Promise.allSettled(pins.files.map(async p=>{
    const immutableDigest=view?.immutableDigest(p.path)??null;
    if(immutableDigest!==null){assert.equal(immutableDigest,p.sha256,'current immutable source changed '+p.path);return;}
    const bytes=await fs.promises.readFile(path.join(ROOT,p.path));
    const digest=Buffer.from(await crypto.webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
    assert.equal(digest,p.sha256,'current source changed '+p.path);
  }));
  for(const result of completed)if(result.status==='rejected')throw result.reason;
}
async function evaluate(c,session,expression){
  const r=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},session);
  assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;
}
async function install({c,pageSession,workers,app,backend}){
  const page=await evaluate(c,pageSession,`({worker:!!runningApps[0]?.wine?.guestWorker,endpoint:runningApps[0]?.wine?.guestWorker?.link?.endpointIdentity})`);
  let nativeOwner;
  if(page.worker){
    const matches=[];
    for(const w of workers.values())if(!w.closed&&w.url.includes('guest-worker')){
      const actual=await evaluate(c,w.sessionId,`typeof endpointIdentity==='undefined'?null:({endpointIdentity,slot:workerSlot})`);
      if(actual?.endpointIdentity===page.endpoint&&actual.slot===0)matches.push(w);
    }
    assert.equal(matches.length,1,'one actual owning CPU Worker');
    const actual=await evaluate(c,matches[0].sessionId,workerSource());
    nativeOwner={epoch:actual.epoch,endpointIdentity:actual.endpointIdentity,slot:actual.slot};
  }else {
    // Pay the engine's first debugger transition before personal scene review.
    // Each release child still opens its own session and recovers fresh bodies
    // and module wire bytes; no source/hash or scene is retained here.
    await c.send('Debugger.enable',{},pageSession);
    nativeOwner={epoch:crypto.randomUUID(),endpointIdentity:'main',slot:0};
  }
  const options={app,backend,nativeOwner};
  await evaluate(c,pageSession,pageSource(options));
  return options;
}
// This runs in the release child on its own CDP transport. The expected source
// bodies are generated from this child's current helper, not copied from ACKs.
async function attestExecuted({c,pageSession,cfg,trace=()=>{},preparedTargets=null}){
  trace('current-pins-and-processes-begin');
  // The fresh final verifyPins below proves current disk bodies before arm.
  // Re-reading and hashing this same mutable set during connection setup adds
  // no predicate: executed bodies must match cfg, and every current file must
  // still match cfg immediately before arm. No body/hash cache is retained.
  assert(Array.isArray(cfg.pins.files)&&cfg.pins.files.length);
  for(const p of cfg.pins.files)assert(typeof p.path==='string'&&!path.isAbsolute(p.path)&&!p.path.split('/').includes('..'));
  checkPID(cfg.pid,cfg.startToken);checkPID(cfg.parentPID,cfg.parentStartToken);
  const scripts=new Map(),workers=new Map(),sessions=[pageSession];
  const pinMap=new Map(cfg.pins.files.map(p=>['/'+p.path,p.sha256])),rows=[],sourceTasks=[];
  let pageBody=false,workerBody=!cfg.owner?.workerTarget,invalid=null,sealed=false;
  const previous=c.event;
  const current=()=>assert(!invalid,invalid);
  function source(session,script){
    let pathname=null;try{pathname=new URL(script.url).pathname;}catch{}
    const isPage=script.url===PAGE_URL,isWorker=script.url===WORKER_URL;
    if(!isPage&&!isWorker&&!script.url.startsWith('wasm:')&&!pinMap.has(pathname)){
      if(/^https?:/.test(script.url))invalid='unrecorded executed HTTP source '+script.url;
      return;
    }
    const list=scripts.get(session)||new Map();scripts.set(session,list);
    // A script ID is scoped to this new debugger session and execution context.
    // Repeated identical inventory events may share one in-flight recovery only.
    // Live edits or changed descriptors invalidate the entire fresh attestation.
    const key=script.executionContextId+':'+script.scriptId;
    const descriptor=JSON.stringify(script);
    if(script.isLiveEdit){invalid='executed source live edited';return;}
    if(list.has(key)){
      if(list.get(key)!==descriptor)invalid='executed script/context identity changed';
      return;
    }
    if(sealed){invalid='new executed source after attestation';return;}
    list.set(key,descriptor);
    const task=(async()=>{
      const began=Date.now();
      // CDP's JavaScript script hash is SHA256 of the immutable engine source
      // (qualified against raw getScriptSource on the installed browser). A
      // fresh session/context/script inventory proves the same body without
      // transferring every HTTP file again. Never use the WASM metadata hash:
      // that engine reports an empty hash; recover its wire bytecode below.
      const digestOnly=!isPage&&!isWorker&&!script.url.startsWith('wasm:');
      if(digestOnly){
        assert(/^[a-f0-9]{64}$/.test(script.hash),'engine JavaScript source digest');
        assert(Number.isSafeInteger(script.executionContextId)&&script.executionContextId>0);
        let expected=pinMap.get(pathname);
        if(pathname.endsWith('.html')){
          const text=fs.readFileSync(path.join(ROOT,pathname.slice(1)),'utf8'),lines=text.split('\n');
          assert(Number.isSafeInteger(script.startLine)&&Number.isSafeInteger(script.endLine));
          let inline=lines.slice(script.startLine,script.endLine+1);
          if(inline.length===1)inline=[inline[0].slice(script.startColumn,script.endColumn)];
          else {inline[0]=inline[0].slice(script.startColumn);inline[inline.length-1]=inline.at(-1).slice(0,script.endColumn);}
          expected=sha(Buffer.from(inline.join('\n')));
        }
        assert.equal(script.hash,expected,'actual executed source changed '+pathname);
        const row={url:script.url,scriptId:script.scriptId,executionContextId:script.executionContextId,
          sha256:script.hash,size:script.length,bytecodeAvailable:false,proof:'fresh-engine-immutable-source-digest'};
        rows.push(row);if(workers.has(session))workers.get(session).scripts.push(row);
        trace('actual-source-engine-digest',{...row,session,began,ms:Date.now()-began});return;
      }
      const value=await c.send('Debugger.getScriptSource',{scriptId:script.scriptId},session);
      current();
      const bytes=value.bytecode?Buffer.from(value.bytecode,'base64'):Buffer.from(value.scriptSource||'');
      const hash=Buffer.from(await crypto.webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
      current();
      const row={url:script.url,scriptId:script.scriptId,
        executionContextId:script.executionContextId,sha256:hash,size:bytes.length,bytecodeAvailable:!!value.bytecode};
      rows.push(row);trace(value.bytecode?'actual-module-bytes':'actual-source-body',{...row,session,began,ms:Date.now()-began});
      if(workers.has(session))workers.get(session).scripts.push(row);
      if(isPage){assert.equal(session,pageSession);assert.equal(hash,sha(Buffer.from(pageSource(cfg.bridgeOptions))),'actual page binding body changed');pageBody=true;}
      else if(isWorker){assert.equal(hash,sha(Buffer.from(workerSource())),'actual owning native bridge body changed');workerBody=true;}
      else assert(value.bytecode&&cfg.pins.modules.includes(hash),'current actual module wire bytes required');
    })();
    // Recover immediately as the inventory arrives, overlapping protocol work;
    // every task is still joined and checked before native arm can be accepted.
    sourceTasks.push(task);task.catch(()=>{});
  }
  c.event=v=>{
    previous(v);
    if(v.method==='Debugger.scriptParsed'&&sessions.includes(v.sessionId))source(v.sessionId,v.params);
    if(v.method==='Runtime.executionContextDestroyed'&&sessions.includes(v.sessionId))invalid='executed context destroyed';
    if(v.method==='Runtime.executionContextsCleared'&&sessions.includes(v.sessionId))invalid='executed contexts cleared';
    if(v.method==='Target.detachedFromTarget')for(const w of workers.values())if(w.sessionId===v.params.sessionId){w.closed=true;invalid='owning target detached';}
  };
  // Attachment may be prepared before this intent; source inventories, module
  // bytes and native observations may not. Revalidate every prepared target
  // against a fresh current inventory, then enable fresh debugger inventories.
  const targets=(await c.send('Target.getTargets')).targetInfos;
  const pageTarget=targets.find(t=>t.targetId===cfg.targetId);
  assert(pageTarget?.type==='page','actual current page target');
  if(preparedTargets){
    assert.equal(preparedTargets.page.targetId,cfg.targetId);
    assert.equal(preparedTargets.page.sessionId,pageSession);
    assert.equal(preparedTargets.page.url,pageTarget.url,'prepared page replaced');
  }
  if(cfg.owner?.workerTarget){
    const ids=[cfg.owner.workerTarget,...(cfg.owner.rendererTarget!=='none'?[cfg.owner.rendererTarget]:[])];
    await Promise.all(ids.map(async id=>{
      const target=targets.find(t=>t.targetId===id);assert(target?.type==='worker','actual bound Worker target');
      const prepared=preparedTargets?.workers.find(w=>w.targetId===id);
      if(preparedTargets)assert(prepared&&prepared.url===target.url,'prepared Worker replaced');
      const sessionId=prepared?.sessionId??(await c.send('Target.attachToTarget',{targetId:id,flatten:true})).sessionId;
      workers.set(sessionId,{targetId:id,sessionId,url:target.url,scripts:[],closed:false});sessions.push(sessionId);
    }));
  }
  trace('attached-actual-targets');
  // These are fresh observations on this child's current sessions, independent
  // of recovering immutable script/module bodies. Keep their before/after
  // owner ordering while overlapping the large wire-byte transfers.
  // Start inventory before independent native/function observations so large
  // current module wire recovery can use the protocol while they complete.
  const inventory=Promise.all(sessions.flatMap(session=>[c.send('Debugger.enable',{},session),c.send('Runtime.enable',{},session)]));
  inventory.catch(()=>{});
  const helper=cfg.owner?.workerTarget?require(path.join(ROOT,HELPER)):null;
  const ownerTask=helper?(async()=>{
    const page=await evaluate(c,pageSession,helper.PAGE_READ);
    const actuals=new Map(await Promise.all([...workers].map(async([sid,w])=>[sid,
      await evaluate(c,sid,w.url.includes('guest-worker')?helper.WORKER_READ:helper.RENDER_READ)])));
    const after=await evaluate(c,pageSession,helper.PAGE_READ);return {page,actuals,after};
  })():null;
  ownerTask?.catch(()=>{});
  const nativeTask=evaluate(c,pageSession,`__gta2NativeReleasePageV1.attest(${JSON.stringify({bindingToken:cfg.bindingToken,review:cfg.review})})`);
  nativeTask.catch(()=>{});
  // This fresh function-body proof and the engine's fresh source recoveries are
  // independent observations and can run together on this child's transport.
  const proofTask=evaluate(c,pageSession,'__gta2NativeReleasePageV1.sourceProof({compactHost:true})');
  proofTask.catch(()=>{});
  await inventory;current();trace('debugger-source-inventory');
  trace('current-process-identities-and-expected-pins');
  const proof=await proofTask;
  assert.equal(proof.bridge,pageBridge.toString(),'actual page bridge function body');
  assert.equal(proof.nativeContext,nativeContext.toString(),'actual page native guard function body');
  // The installed engine's current function body is freshly hashed in-page,
  // avoiding a second 400KB transfer while recovering the actual module wire
  // bytes. The expected class is selected conservatively from current source;
  // an ambiguous layout refuses rather than accepting a shortened body.
  const [hostText,physicalText]=await Promise.all(['host.js','lib/renderer-input.js'].map(file=>fs.promises.readFile(path.join(ROOT,file),'utf8')));
  const hostStart=hostText.indexOf('\nclass WineAssembly {')+1;
  assert(hostStart>0&&hostText.indexOf('\nclass WineAssembly {',hostStart)===-1,'one current host class');
  const hostEnd=hostText.indexOf('\n}',hostStart)+2;assert(hostEnd>hostStart);
  const hostBody=hostText.slice(hostStart,hostEnd);
  assert.equal(proof.hostSHA256,sha(Buffer.from(hostBody)),'current actual WineAssembly class body');
  for(const key of ['down','up','press'])assert(physicalText.includes(proof[key]),'current actual original physical '+key+' body');
  const pageProof={bridgeSHA256:sha(Buffer.from(proof.bridge)),nativeContextSHA256:sha(Buffer.from(proof.nativeContext)),
    hostClassSHA256:proof.hostSHA256,physicalBodies:Object.fromEntries(['down','up','press'].map(key=>[key,sha(Buffer.from(proof[key]))]))};
  trace('actual-page-and-original-handler-bodies');
  let recoveredCount=0;
  for(;recoveredCount!==sourceTasks.length;){
    recoveredCount=sourceTasks.length;
    const recovered=await Promise.allSettled(sourceTasks);
    for(const result of recovered)if(result.status==='rejected')throw result.reason;
    current();
  }
  sealed=true;
  trace('actual-source-bodies-and-modules');
  assert(pageBody&&workerBody,'actual injected binding source bodies required');
  for(const file of (cfg.owner?.workerTarget?['lib/guest-worker.js']:[]))
    assert(rows.some(r=>{try{return new URL(r.url).pathname==='/'+file;}catch{return false;}}),'required actual executed source '+file);
  let live=null;
  if(cfg.owner?.workerTarget){
    // Same current identity predicates as the imported passive chain, using
    // the module bytes recovered above on this child's own debugger sessions.
    // Fetching those same large byte arrays twice would waste the 500ms arm.
    const observed=await ownerTask,page=observed.page;
    assert(page.isolated&&page.apps.length===1);const app=page.apps[0];
    assert(app.name===cfg.bridgeOptions.app&&app.running&&!app.stopped&&app.guestWorker);
    const matches=[];
    for(const w of workers.values())if(w.url.includes('guest-worker')&&!w.closed){
      const actual=observed.actuals.get(w.sessionId);
      if(actual?.endpointIdentity===app.guestEndpoint&&actual.slot===app.slot)matches.push({w,actual});
    }
    assert.equal(matches.length,1,'independent unique actual CPU');const {w,actual}=matches[0];
    const modules=w.scripts.filter(r=>r.bytecodeAvailable);assert.equal(modules.length,1,'one current actual CPU module');
    const rendererIdentity={rendererTarget:'none',rendererEpoch:'none',rendererModuleSha256:'none'};
    if(app.renderEndpoint!=='none'){
      const owners=[];
      for(const r of workers.values())if(r.url.includes('d3d-render-worker')&&!r.closed){
        const endpoints=observed.actuals.get(r.sessionId);
        for(const endpoint of endpoints)if(endpoint.id===app.renderEndpoint)owners.push({r,endpoint});
      }
      assert.equal(owners.length,1);const {r,endpoint}=owners[0];assert(!endpoint.failed&&!endpoint.control?.error);
      const hashes=new Set(r.scripts.filter(row=>row.bytecodeAvailable).map(row=>row.sha256));assert.equal(hashes.size,1);
      Object.assign(rendererIdentity,{rendererTarget:r.targetId,rendererEpoch:endpoint.epoch,rendererModuleSha256:[...hashes][0]});
    }
    const identity={...app,workerTarget:w.targetId,workerInstance:actual.instance,moduleSha256:modules[0].sha256,...rendererIdentity};
    helper.same(cfg.owner,identity);
    const after=observed.after;assert(after.apps.length===1&&after.apps[0].running&&!after.apps[0].stopped);
    helper.same(identity,{...after.apps[0],workerTarget:w.targetId,workerInstance:actual.instance,moduleSha256:modules[0].sha256,...rendererIdentity});
    assert(!w.closed);live={identity};trace('actual-native-owner-and-renderer-identity');
    if(live.identity.renderEndpoint!=='none'){
      const renderer=[...workers.values()].find(w=>w.targetId===live.identity.rendererTarget);assert(renderer);
      const endpoints=await evaluate(c,renderer.sessionId,`Array.from(endpoints,([id,e])=>({id,options:e.options,failed:!!e.failed}))`);
      const endpoint=endpoints.find(e=>e.id===live.identity.renderEndpoint);assert(endpoint&&!endpoint.failed);
      assert.equal(endpoint.options.backend,cfg.bridgeOptions.backend,'independent owning backend');
    }
  }else assert(rows.some(r=>r.bytecodeAvailable&&cfg.pins.modules.includes(r.sha256)),'actual main module required');
  trace('current-owning-backend');
  const native=await nativeTask;
  assert.equal(native.bindingToken,cfg.bindingToken);assert.deepEqual(native.native,cfg.review.native);
  assert.deepEqual(native.pageIdentity,cfg.review.pageIdentity);assert.equal(native.reviewedPNG,cfg.review.pngSHA256);
  trace('current-final-file-bodies-begin');
  await verifyPinsAsync(cfg.pins);checkPID(cfg.pid,cfg.startToken);checkPID(cfg.parentPID,cfg.parentStartToken);
  assert.equal(sourceTasks.length,recoveredCount,'new executed script after source recovery');
  current();trace('fresh-native-scene-and-final-pins');
  return {native,live:live?.identity??null,sources:rows,pageProof,assertCurrent:current};
}
module.exports={nativeContext,workerBridge,pageBridge,workerSource,pageSource,install,attestExecuted,evaluate,verifyPins,verifyPinsAsync,checkPID};
