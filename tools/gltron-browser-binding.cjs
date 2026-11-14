'use strict';
// Native-CDP capture/admission chain. No guest memory, clocks or callbacks are written.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const wait = ms => new Promise(r => setTimeout(r, ms));
const FIELDS = ['processId', 'processObject', 'endpoint', 'endpointObject', 'workerObject',
  'workerTarget', 'workerInstance', 'moduleObject', 'moduleSha256', 'epoch',
  'renderEndpoint', 'renderEndpointObject', 'renderWorkerObject',
  'rendererTarget', 'rendererEpoch', 'rendererModuleSha256', 'pageRendererObject', 'canvasObject',
  'windowHwnd','windowObject','windowInstance','outputCanvasObject'];
const MAX_AGE_MS = 30000;
function same(a, b) {
  for (const field of FIELDS) {
    assert(a?.[field] !== undefined && a[field] !== null && a[field] !== '', 'missing identity ' + field);
    assert.equal(b?.[field], a[field], 'identity changed: ' + field);
  }
}
// Object tokens are scoped to this actual document. Replacing an owner with an
// equal-looking object, or reloading the page, cannot reuse a reviewed token.
const PAGE_READ = `(() => {
  const k = '__mcmPassiveIdentityV1';
  if (!globalThis[k]) Object.defineProperty(globalThis, k, {value:{
    epoch:crypto.randomUUID(), ids:new WeakMap(), next:0}});
  const state=globalThis[k], token=o=>{
    if (!o || !['object','function'].includes(typeof o)) return null;
    if (!state.ids.has(o)) state.ids.set(o, state.epoch+':'+(++state.next));
    return state.ids.get(o);
  };
  const visibility=c=>{
    const refuse=(reason,e)=>({visible:false,reason,element:e?{tag:e.tagName,id:e.id,box:e.getBoundingClientRect().toJSON()}:null});
    if(!c||!c.isConnected||document.visibilityState!=='visible')return refuse('output disconnected or document not visible');
    const b=c.getBoundingClientRect();
    if(!(b.width>0&&b.height>0&&b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight))return refuse('output outside viewport',c);
    for(let e=c;e;e=e.parentElement){
      const s=getComputedStyle(e),r=e.getBoundingClientRect();
      if(s.display==='none'||s.visibility!=='visible'||Number(s.opacity)!==1)return refuse('output ancestor hidden or translucent',e);
      if(e!==c&&((/(hidden|clip|scroll|auto)/.test(s.overflowX)&&(b.left<r.left||b.right>r.right))||(/(hidden|clip|scroll|auto)/.test(s.overflowY)&&(b.top<r.top||b.bottom>r.bottom))))return refuse('output ancestor clips canvas',e);
    }
    // Canvas readback cannot depict HTML siblings, including overlays with
    // pointer-events:none. Conservatively refuse every visible intersecting
    // painted light-DOM box, even if it might paint behind the opaque canvas.
    // A real fullscreen element is in the browser top layer: ordinary DOM
    // outside it cannot paint above it. Modal/popover top layers still can;
    // refuse those globally, including their potentially full-page backdrops.
    const fullscreen=document.fullscreenElement,fullscreenOutput=fullscreen?.contains(c);
    if(fullscreenOutput){const top=document.querySelector('dialog:modal, :popover-open');if(top)return refuse('modal/popover top layer over fullscreen',top);}
    for(const e of document.querySelectorAll('*')){
      if(e===c||e.contains(c))continue;
      if(fullscreenOutput&&!fullscreen.contains(e))continue;
      const r=e.getBoundingClientRect();
      if(!(r.width>0&&r.height>0&&r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top))continue;
      let paints=true;
      for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility!=='visible'||Number(s.opacity)===0){paints=false;break;}}
      if(paints){
        const s=getComputedStyle(e),transparent=v=>!v||v==='transparent'||v.replaceAll(' ','')==='rgba(0,0,0,0)';
        const ownText=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
        const replaced=/^(CANVAS|IMG|SVG|VIDEO|IFRAME|INPUT|TEXTAREA|SELECT|BUTTON|OBJECT|EMBED)$/.test(e.tagName)||e.namespaceURI==='http://www.w3.org/2000/svg';
        const decoration=!transparent(s.backgroundColor)||s.backgroundImage!=='none'||s.boxShadow!=='none'||s.backdropFilter!=='none'||
          ['Top','Right','Bottom','Left'].some(k=>parseFloat(s['border'+k+'Width'])>0&&!transparent(s['border'+k+'Color']))||
          (s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0&&!transparent(s.outlineColor));
        const pseudo=['::before','::after'].some(p=>{const x=getComputedStyle(e,p);return x.content!=='none'&&x.content!=='normal';});
        if(ownText||replaced||decoration||pseudo)return refuse('intersecting painted DOM box',e);
      }
    }
    return {visible:true,reason:null,element:null};
  };
  return {isolated:crossOriginIsolated, apps:(typeof runningApps==='undefined'?[]:runningApps).map(a=>{
    const w=a.wine, g=w?.guestWorker, l=g?.link;
    const ports=[...(w?._renderWorkerManager?.ports?.values()||[])].filter(p=>!p.closed);
    const owned=ports.filter(p=>p.options?.api==='gl');
    if(owned.length>1)throw Error('ambiguous actual GL endpoints');
    const p=owned.length===1?owned[0]:null;
    const windows=Object.values(w?.renderer?.windows||{}).filter(v=>v.visible&&!v.isChild&&v.w>0&&v.h>0&&v.processId===w.processId&&v.wasm===w.instance);
    const win=windows.length===1?windows[0]:null;
    const output=w?.renderer&&(!w.renderer.presentationFilter||w.renderer._directPresentation?w.renderer.canvas:w.renderer.presentationCanvas||w.renderer.canvas);
    const outputVisibility=visibility(output);
    return {name:a.name,running:!!w?.running,stopped:!!w?._stopped,guestWorker:!!g,
      windowHwnd:win?.hwnd,windowObject:token(win),windowInstance:token(win?.wasm),
      outputVisible:outputVisibility.visible,outputVisibility,
      outputCanvasObject:token(w?.renderer&&(!w.renderer.presentationFilter||w.renderer._directPresentation?w.renderer.canvas:w.renderer.presentationCanvas||w.renderer.canvas)),publication:w?.renderer?._immutablePublicationSequence||0,
      pageRendererObject:token(w?.renderer),canvasObject:token(document.getElementById('screen')),processId:w?.processId,processObject:token(w),endpoint:l?.endpointIdentity,endpointObject:token(l),
      renderEndpoint:p?.id??'none',renderEndpointObject:p?token(p):'none',
      renderWorkerObject:token(w?._renderWorkerManager?.worker)??'none',
      guestEndpoint:l?.endpointIdentity,slot:l?.slot,workerObject:token(l?.worker),
      moduleObject:token(l?.module),epoch:state.epoch,
      slice:w?._workerLastSlice??null,d3dStats:g?.d3dStats??null,
      physical:[1,17,32,37,38,39,40].map(key=>({key,state:w?.renderer?.peekKeyDownState(key)??null}))};
  })};
})()`;

// No ticket, pixel read, publication, repaint, hold release or guest command.
// Reuse the production receipt validator with an ephemeral request; its only
// write is selectedOwner on this local object. No renderer state is changed.
function readinessExpression(identity,selectOutput=false,allowPendingDamage=false) { return `(() => {
  const p=(${PAGE_READ}),a=p.apps[0],want=${JSON.stringify(identity)};
  if(!p.isolated||p.apps.length!==1||!a.running||a.stopped||!a.outputVisible)throw Error('startup owner/output not live and fully visible');
  for(const k of ${JSON.stringify(FIELDS.filter(k=>!['workerTarget','workerInstance','moduleSha256','rendererTarget','rendererEpoch','rendererModuleSha256',...(selectOutput?['outputCanvasObject']:[])].includes(k)))})if(a[k]!==want[k])throw Error('startup identity changed '+k);
  const w=runningApps[0].wine,r=w.renderer;
  const pending=[];
  if(w._dxDirty||w._dxLockDeferred||w._presentFrameDue)pending.push('host surface publication');
  if(r._workerPublicationHeld()||r._workerGdiPaintDepth>0||r._repainting)pending.push('held/in-flight paint');
  if(!${allowPendingDamage}&&(r._repaintScheduled||r._repaintPending||r._workerRepaintDeferred))pending.push('ordinary damage');
  if(!r._currentDisplayRecord)pending.push('no ordinary complete display');
  if(pending.length)return {ready:false,pending,at:Date.now(),publication:a.publication};
  const record=r._validateCurrentDisplayCapture({owner:{hwnd:a.windowHwnd,window:r.windows[a.windowHwnd],processId:w.processId,instance:w.instance}});
  return {ready:true,at:Date.now(),publication:a.publication,displayedAt:record.displayedAt,outputCanvasObject:a.outputCanvasObject};
})()`; }
function precondition(reason) {
  const error=Error('capture precondition refused: '+reason+'; no retry');
  error.code='CAPTURE_PRECONDITION_REFUSED';error.inputState='NOT_SENT';return error;
}
async function awaitStartupReady({evaluate,identity,deadline,now=Date.now,onObservation=()=>{},selectOutput=false}) {
  assert(Number.isFinite(deadline)&&deadline>now(),'bounded PREBIND startup deadline');
  for(;;){
    const state=await evaluate(readinessExpression(identity,selectOutput));onObservation(state);
    if(now()>=deadline)throw precondition('bounded PREBIND startup readiness expired');
    if(state.ready)return state;
    // Poll pacing is not readiness evidence. Only the ordinary receipt and
    // current owner/output/paint checks above can admit the first ticket.
    await wait(Math.min(25,deadline-now()));
  }
}

// Public current-display ticket: existing complete output, or ordinary pending
// damage publication. Request time measures observation age, never render age.
// Original publication/display timestamps remain separately attached to bytes.
async function captureScene({evaluate, identity, now=Date.now, precheckDeadline=null}) {
  const nonce=crypto.randomUUID(),key='__gltronCaptureTicketV1',at=now(),stages={};
  let result,armed=false;
  try {
    const arm=await evaluate(`(() => {
      const p=(${PAGE_READ}),a=p.apps[0],want=${JSON.stringify(identity)};
      if(!p.isolated||p.apps.length!==1||!a.running||a.stopped||!a.outputVisible)throw Error('capture owner/output not live and fully visible');
      for(const k of ['processId','processObject','pageRendererObject','canvasObject','windowHwnd','windowObject','windowInstance','outputCanvasObject'])if(a[k]!==want[k])throw Error('capture identity changed '+k);
      if(globalThis.${key})throw Error('capture already armed');
      const w=runningApps[0].wine,r=w.renderer;
      if(r._immutableCaptureRequest)throw Error('capture already pending; no retry');
      const readiness=(${readinessExpression(identity,false,true)});
      if(${JSON.stringify(precheckDeadline)}!==null&&Date.now()>=${JSON.stringify(precheckDeadline)})throw Error('bounded PREBIND startup readiness expired before ticket');
      if(!readiness.ready)return {state:'NOT_READY',nonce:${JSON.stringify(nonce)},requestCalled:false,ticketCreated:false,inputDispatched:false,...readiness};
      const t=w.requestCurrentDisplayCapture({hwnd:a.windowHwnd});
      const h={nonce:${JSON.stringify(nonce)},ticket:t,publication:a.publication,renderer:r};
      globalThis.${key}=h;
      return {state:'ARMED',nonce:${JSON.stringify(nonce)},requestCalled:true,ticketCreated:true,at:Date.now(),publication:a.publication};
    })()`);
    if(arm.state==='NOT_READY'){
      assert.equal(arm.nonce,nonce,'precheck nonce changed');
      assert(arm.requestCalled===false&&arm.ticketCreated===false&&arm.inputDispatched===false,'passive precheck effects');
      assert(arm.ready===false&&Array.isArray(arm.pending)&&arm.pending.length,'known passive readiness refusal required');
      return arm;
    }
    assert(arm.state==='ARMED'&&arm.nonce===nonce&&arm.requestCalled===true&&arm.ticketCreated===true,'ambiguous capture arm; no retry');
    armed=true;stages.armMs=now()-at;stages.arm=arm;
    while(now()-at<3000) {
      result=await evaluate(`(() => {
        const h=globalThis.${key};if(!h||h.nonce!==${JSON.stringify(nonce)})throw Error('capture ticket replaced');
        const t=h.ticket;if(t.status==='failed')return {refused:t.error};
        if(t.status==='cancelled')throw Error('capture cancelled; no replay');
        const readiness=(${readinessExpression(identity,false,true)});
        if(!readiness.ready)throw Error('post-ticket readiness changed: '+readiness.pending.join(', ')+'; no retry');
        if(t.status!=='complete')return null;
        const readStart=performance.now(),r=t.read(),m=r.metadata;
        const p=(${PAGE_READ}),a=p.apps[0],want=${JSON.stringify(identity)};
        if(p.apps.length!==1||!a.running||a.stopped||!a.outputVisible)throw Error('capture owner/output hidden or clipped');
        for(const k of ['processId','processObject','pageRendererObject','canvasObject','windowHwnd','windowObject','windowInstance','outputCanvasObject'])if(a[k]!==want[k])throw Error('capture identity changed '+k);
        if(m.observation!=='current-display'||m.publication<h.publication)throw Error('capture display/publication binding changed');
        if(!Number.isFinite(m.displayedAt)||m.displayedAt>m.readbackCompletedAt||m.requestedAt>m.readbackStartedAt)throw Error('capture display timing invalid');
        const c=document.createElement('canvas');c.width=m.output.width;c.height=m.output.height;
        const start=performance.now();c.getContext('2d').putImageData(new ImageData(r.outputRGBA,c.width,c.height),0,0);
        const data=c.toDataURL('image/png');
        return {metadata:m,data,publishedAt:m.publicationAt,encodedAt:Date.now(),readAndCopyMs:start-readStart,encodeMs:performance.now()-start};
      })()`);
      if(result?.refused){const reason=result.refused;result=null;const e=Error('capture ticket failed: '+reason+'; no retry');e.code='CAPTURE_TICKET_FAILED';e.requestCalled=true;e.ticketCreated=true;throw e;}
      if(result)break;
      await wait(10);
    }
    assert(result,'current complete-scene capture deadline; no retry');
    assert(now()-at<3000,'late complete-scene capture refused');
    const m=result.metadata;
    assert.equal(m.completion,'canvas2d-readback');
    assert.equal(m.observation,'current-display');
    assert(['already-displayed','ordinary-publication-after-request'].includes(m.content));
    assert.equal(m.captureOwner.hwnd,identity.windowHwnd);
    assert.equal(m.captureOwner.processId,identity.processId);
    assert(m.composition.windows.some(w=>w.hwnd===identity.windowHwnd&&w.processId===identity.processId));
    assert(/^data:image\/png;base64,/.test(result.data));
    stages.readAndEncodeMs=now()-at;stages.encodeMs=result.encodeMs;stages.readAndCopyMs=result.readAndCopyMs;stages.publishedAt=result.publishedAt;
    return {png:Buffer.from(result.data.split(',')[1],'base64'),metadata:m,at:new Date(at).toISOString(),stages,nonce};
  } finally {
    // A terminal transport refuses this cleanup too. In that case the whole
    // document is destroyed by host teardown, never reused or rebound.
    if(armed)await evaluate(`(() => {const h=globalThis.${key};if(!h||h.nonce!==${JSON.stringify(nonce)})throw Error('capture cancellation identity changed');const status=h.ticket.status;h.ticket.cancel();delete globalThis.${key};return {status};})()`);
    if(result)assert(now()-at<3000,'late complete-scene capture cleanup refused');
  }
}
const WORKER_READ = `(() => {
  if (typeof endpointIdentity==='undefined'||typeof workerSlot==='undefined'||typeof instance==='undefined'||!instance) return null;
  if (!globalThis.__mcmPassiveInstanceV1) Object.defineProperty(globalThis,'__mcmPassiveInstanceV1',
    {value:{ids:new WeakMap(),epoch:crypto.randomUUID(),next:0}});
  const s=globalThis.__mcmPassiveInstanceV1;
  if(!s.ids.has(instance))s.ids.set(instance,s.epoch+':'+(++s.next));
  return {endpointIdentity,slot:workerSlot,instance:s.ids.get(instance)};
})()`;
const RENDER_READ = `(() => {
  if(typeof endpoints==='undefined')return [];
  if(!globalThis.__mcmPassiveRenderV1)Object.defineProperty(globalThis,'__mcmPassiveRenderV1',
    {value:{ids:new WeakMap(),epoch:crypto.randomUUID(),next:0}});
  const s=globalThis.__mcmPassiveRenderV1;
  return Array.from(endpoints,([id,e])=>{
    if(!s.ids.has(e))s.ids.set(e,s.epoch+':'+(++s.next));
    if(typeof instance==='undefined'||!instance)throw Error('renderer instance unavailable');
    if(!s.ids.has(instance))s.ids.set(instance,s.epoch+':'+(++s.next));
    return {id,epoch:s.ids.get(e)+'/'+s.ids.get(instance),failed:!!e.failed,
      control:e.control?{completed:Atomics.load(e.control,1),error:Atomics.load(e.control,2),commands:Atomics.load(e.control,5)}:null};
  });
})()`;

// Separate host UI observation. These browser pixels are never game admission.
const HOST_FIELDS=FIELDS.filter(k=>!['outputCanvasObject','workerTarget','workerInstance','moduleSha256','rendererTarget','rendererEpoch','rendererModuleSha256'].includes(k));
const HOST_READ=`(() => {
  const page=(${PAGE_READ}),s=globalThis.__mcmPassiveIdentityV1;
  const token=o=>{if(!o)return null;if(!s.ids.has(o))s.ids.set(o,s.epoch+':'+(++s.next));return s.ids.get(o);};
  const strip=document.getElementById('browser-fullscreen-consent'),buttons=strip?.querySelectorAll('button');
  const button=buttons?.length===1?buttons[0]:null,wrap=document.getElementById('screen-wrap');
  const r=button?.getBoundingClientRect(),box=r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;
  const x=r?r.x+r.width/2:null,y=r?r.y+r.height/2:null;
  const visible=e=>{if(!e?.isConnected||document.visibilityState!=='visible')return false;const b=e.getBoundingClientRect();for(let p=e;p;p=p.parentElement){const c=getComputedStyle(p),r=p.getBoundingClientRect();if(c.display==='none'||c.visibility!=='visible'||Number(c.opacity)!==1)return false;if(p!==e&&((/(hidden|clip|scroll|auto)/.test(c.overflowX)&&(b.left<r.left||b.right>r.right))||(/(hidden|clip|scroll|auto)/.test(c.overflowY)&&(b.top<r.top||b.bottom>r.bottom))))return false;}return true;};
  return {at:Date.now(),page,fullscreen:token(document.fullscreenElement),wrap:token(wrap),
    viewport:{width:innerWidth,height:innerHeight,scale:devicePixelRatio},
    strip:{object:token(strip),text:strip?.textContent.trim(),visible:visible(strip)},
    button:{object:token(button),label:button?.textContent.trim(),box,x,y,
      enabled:!!button&&!button.disabled,visible:visible(button),
      hit:!!button&&document.elementFromPoint(x,y)===button,
      contained:!!r&&r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}};
})()`;
function sameHostOwner(want,observed){
  assert(observed.page.isolated&&observed.page.apps.length===1,'one isolated host owner');
  const a=observed.page.apps[0];assert(a.name==='gltron'&&a.running&&!a.stopped&&a.guestWorker,'live host owner');
  for(const k of HOST_FIELDS){assert(want[k]!==undefined&&want[k]!==null,'missing host identity '+k);assert.equal(a[k],want[k],'host owner changed '+k);}
}
function consentButton(observed){
  assert(!observed.fullscreen,'already fullscreen; no consent click');
  assert(observed.wrap&&observed.strip.visible&&observed.strip.text.includes('App is using the full page'),'visible exact consent strip');
  const b=observed.button;
  assert(b.object&&b.label==='Use browser fullscreen'&&b.enabled&&b.visible&&b.hit&&b.contained,'visible complete enabled consent button');
}
function reviewHostBootstrap(scene,review,live,now=Date.now()){
  assert(review?.sha256===scene.sha256&&review.observation?.trim()&&review.hostOnly===true,'personal raw-browser host review required');
  assert(now-scene.at>=0&&now-scene.at<30000,'fresh host menu geometry review');
  sameHostOwner(scene.observation.page.apps[0],live);consentButton(scene.observation);consentButton(live);
  for(const k of ['object','label','x','y'])assert.equal(live.button[k],scene.observation.button[k],'consent button changed '+k);
  assert.deepEqual(live.button.box,scene.observation.button.box,'consent geometry changed');
  assert.equal(live.wrap,scene.observation.wrap);assert.equal(live.strip.object,scene.observation.strip.object);
  assert.deepEqual(live.viewport,scene.observation.viewport,'host viewport changed');
  return {x:live.button.x,y:live.button.y};
}

function createChain({evaluate, send, workers, pageSession, app = 'heretic2_demo', expectedModules = null, now = Date.now}) {
  let latest = null, pinnedIdentity = null, busy = false, closed = false, startup = null;
  const consumed = new Set();
  async function readLive() {
    assert(!closed,'closed chain');
    const page = await evaluate(PAGE_READ);
    assert(page.isolated && page.apps.length === 1, 'one isolated registered app required');
    const a = page.apps[0];
    assert(a.name === app && a.running && !a.stopped && a.guestWorker && a.outputVisible, 'live fully visible registered app required');
    const matches = [];
    for (const w of workers.values()) {
      if (w.closed || !w.url.includes('guest-worker')) continue;
      const live = await evaluate(WORKER_READ, w.sessionId);
      if (live?.endpointIdentity === a.guestEndpoint && live.slot === a.slot) matches.push({w, live});
    }
    assert.equal(matches.length, 1, 'unique actual guest Worker target required');
    const {w, live} = matches[0];
    const scripts = [...new Map(w.scripts.filter(s => s.bytecodeAvailable && s.sha256 && !s.error).map(s=>[s.scriptId,s])).values()];
    assert.equal(scripts.length, 1, 'unique recovered live Worker module required');
    const source = await send('Debugger.getScriptSource', {scriptId:scripts[0].scriptId}, w.sessionId);
    assert(source.bytecode, 'live module bytecode required');
    const moduleSha256 = sha(Buffer.from(source.bytecode, 'base64'));
    assert.equal(moduleSha256, scripts[0].sha256, 'live module bytes changed');if(expectedModules)assert(expectedModules.includes(moduleSha256),'immutable staged module required');
    let rendererTarget='none',rendererEpoch='none',rendererModuleSha256='none';
    if(a.renderEndpoint!=='none') {
      const owners=[];
      for(const r of workers.values())if(!r.closed&&r.url.includes('d3d-render-worker')) {
        const endpoints=await evaluate(RENDER_READ,r.sessionId);
        for(const endpoint of endpoints)if(endpoint.id===a.renderEndpoint)owners.push({r,endpoint});
      }
      assert.equal(owners.length,1,'unique actual owning renderer required');
      const {r,endpoint}=owners[0];assert(!endpoint.failed&&!endpoint.control?.error,'live renderer required');
      rendererTarget=r.targetId;rendererEpoch=endpoint.epoch;
      const modules=[...new Map(r.scripts.filter(s=>s.sha256&&s.bytecodeAvailable&&!s.error).map(s=>[s.scriptId,s])).values()];
      assert.equal(new Set(modules.map(s=>s.sha256)).size,1,'unique actual renderer module required');
      const bytes=await send('Debugger.getScriptSource',{scriptId:modules[0].scriptId},r.sessionId);
      assert(bytes.bytecode,'actual renderer module bytes required');
      rendererModuleSha256=sha(Buffer.from(bytes.bytecode,'base64'));
      assert.equal(rendererModuleSha256,modules[0].sha256);
    }
    const rendererIdentity={rendererTarget,rendererEpoch,rendererModuleSha256};
    const identity = {...a, workerTarget:w.targetId, workerInstance:live.instance, moduleSha256,...rendererIdentity};
    same(identity, identity);
    if (pinnedIdentity) same(pinnedIdentity, identity);
    else pinnedIdentity = {...identity};
    // Module recovery awaits Chrome and can span ordinary producer work.
    // Recheck the actual instance as well as the page references afterward;
    // the final synchronous page arm separately checks paint/readiness.
    assert.deepEqual(await evaluate(WORKER_READ,w.sessionId),live,'Worker instance changed during module validation');
    if(rendererTarget!=='none'){
      const r=[...workers.values()].find(r=>r.targetId===rendererTarget&&!r.closed);
      assert(r,'renderer detached during module validation');
      const endpoints=await evaluate(RENDER_READ,r.sessionId);
      assert(endpoints.some(e=>e.id===a.renderEndpoint&&e.epoch===rendererEpoch&&!e.failed&&!e.control?.error),'renderer changed during module validation');
    }
    const after = await evaluate(PAGE_READ);
    assert(after.apps.length === 1 && after.apps[0].running && !after.apps[0].stopped &&
      after.apps[0].outputVisible, 'owner/output hidden or clipped during identity validation');
    same(identity, {...after.apps[0], workerTarget:w.targetId, workerInstance:live.instance, moduleSha256,...rendererIdentity});
    assert(!w.closed, 'Worker detached during identity read');
    return {identity, page:after, worker:{targetId:w.targetId, sessionId:w.sessionId, ...live}};
  }
  function fresh(capture, maxAgeMs=MAX_AGE_MS) {
    const age = now() - Date.parse(capture?.at);
    if (!(Number.isFinite(age) && age >= 0 && age < maxAgeMs)) {
      const e = Error('stale scene refused'); e.code = 'STALE_SCENE_BEFORE_DISPATCH'; throw e;
    }
    return age;
  }
  async function capture(label) {
    assert(!closed && !busy, 'closed or concurrent chain'); busy = true;
    try {
      let before,shot;
      for(;;){
        if(startup)assert(now()<startup.deadline,'bounded PREBIND startup readiness expired');
        before=await readLive();
        shot=await captureScene({evaluate,identity:before.identity,now,precheckDeadline:startup?.deadline??null});
        if(shot.state!=='NOT_READY')break;
        // Only this positive, nonce-bound, pre-request result can stay in
        // startup. Exceptions/UNKNOWN and every ticket outcome close below.
        if(!startup)throw precondition(shot.pending.join(', '));
        startup.onObservation(shot);
        assert(now()<startup.deadline,'bounded PREBIND startup readiness expired');
        await wait(Math.min(25,startup.deadline-now()));
      }
      startup=null;
      // Validation after a screenshot can be slow on a busy renderer. It must
      // not make the reviewed pixels appear younger than their capture.
      const after = await readLive(); same(before.identity, after.identity);
      assert(shot.metadata.publication<=after.identity.publication,'publication regressed');
      const png = shot.png;
      latest = {label, at:shot.at, completedAt:new Date(now()).toISOString(), sha256:sha(png), identity:after.identity,metadata:shot.metadata,stages:shot.stages,nonce:shot.nonce};
      return {capture:structuredClone(latest), png, before, after};
    } catch(e) {closed=true;throw e;} finally { busy = false; }
  }
  async function admit(review, dispatch) {
    assert(!closed && !busy, 'closed or concurrent chain'); busy = true;
    let effects = false;
    try {
      assert(latest && review?.label === latest.label && review.sha256 === latest.sha256 && review.review?.trim(), 'current reviewed capture required');
      assert(!consumed.has(latest.nonce), 'capture nonce already consumed; no replay');
      const maxAgeMs=review.maxAgeMs??MAX_AGE_MS;
      assert([5000,30000].includes(maxAgeMs),'unchanged precision/menu freshness required');
      same(latest.identity, review.identity); fresh(latest,maxAgeMs);
      const live = await readLive(); same(latest.identity, live.identity); const ageMs = fresh(latest,maxAgeMs);
      consumed.add(latest.nonce);
      effects = true;
      return await dispatch({ageMs, capture:structuredClone(latest), live});
    } catch (e) {
      // Identity/partial/UNKNOWN failures close this chain. Only a provably
      // pre-effect stale refusal permits a new capture through the transport.
      if (effects || e.code !== 'STALE_SCENE_BEFORE_DISPATCH') closed = true;
      throw e;
    } finally { busy = false; }
  }
  // Bounded passive reads only. These are execution observations, never a
  // logical frame/keyboard-poll or simulation-step assertion.
  async function progress(identity) {
    const page = await evaluate(PAGE_READ), a = page.apps[0];
    assert(page.apps.length === 1 && a?.running && !a.stopped);
    for (const f of ['processId','processObject','endpoint','endpointObject','workerObject','moduleObject','epoch','renderEndpoint','renderEndpointObject','renderWorkerObject'])
      assert.equal(a[f], identity[f], 'held identity changed: '+f);
    const w = [...workers.values()].find(w=>w.targetId===identity.workerTarget&&!w.closed);
    assert(w, 'held Worker retired');
    // Do not enqueue guest export commands: the existing page slice and
    // shared render controls are passive and remain observable while blocked.
    const render = [];
    for (const r of workers.values()) if (!r.closed && r.url.includes('d3d-render-worker')) {
      const endpoints=await evaluate(RENDER_READ,r.sessionId);
      if(r.targetId===identity.rendererTarget)assert(endpoints.some(e=>e.id===identity.renderEndpoint&&e.epoch===identity.rendererEpoch&&!e.failed&&!e.control?.error),'held renderer epoch changed');
      render.push({targetId:r.targetId,endpoints});
    }
    return {at:new Date(now()).toISOString(), slice:a.slice, d3dStats:a.d3dStats, physical:a.physical, render};
  }
  async function prepareStartup(deadline,onObservation) {
    assert(!closed&&!busy&&!latest,'PREBIND startup only');busy=true;
    try {
      assert(!startup,'startup deadline already fixed');
      assert(Number.isFinite(deadline)&&deadline>now(),'bounded PREBIND startup deadline');
      startup={deadline,onObservation:onObservation??(()=>{})};
      const live=await readLive();
      return await awaitStartupReady({evaluate,identity:live.identity,deadline,now,onObservation});
    }catch(e){closed=true;throw e;}finally{busy=false;}
  }
  return {capture, admit, readLive, progress, prepareStartup, get closed(){return closed;}};
}

module.exports={createChain,captureScene,same,sha,FIELDS,MAX_AGE_MS,PAGE_READ,WORKER_READ,RENDER_READ,readinessExpression,awaitStartupReady,HOST_READ,HOST_FIELDS,sameHostOwner,consentButton,reviewHostBootstrap};
