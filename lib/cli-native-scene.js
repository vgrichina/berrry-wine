'use strict';

const progress=require('./cli-native-progress');
const common=require('./cli-native-common-controls');
const supportedControl=w=>(w.nativeTextComplete!==false||require('./cli-native-user-windows').qualifiedEditViewport(w))&&
  (progress.supported(w)||(w.nativeTextAvailable!==false&&common.qualified(w)));

// Public native USER identities only. A permanent renderer owner can outlive
// individual dialogs; each intent must still match its own reviewed scene.
function context(s) {
  const window = h => s.windows?.find(w => w.hwnd === h) || null;
  return { mainHwnd:s.mainHwnd, main:window(s.mainHwnd), modalHwnd:s.modalHwnd,
    selected:window(s.modalHwnd!=='0x0'?s.modalHwnd:s.focusTopLevel),
    modal:window(s.modalHwnd), focus:s.focus, focusTopLevel:s.focusTopLevel,
    focusWindow:s.focusWindow, capture:s.capture, physicalUp:s.physicalUp,
    nativeProcess:s.nativeProcess, nativeMessageBox:s.nativeMessageBox,
    nativeDialogBox:s.nativeDialogBox, screen:s.screen };
}
// Bounded field names only: no titles, text bytes, executable paths or app state.
function contextFailures(current, expected) {
  const failures=[];
  const check=(ok,name)=>{if(!ok)failures.push(name);};
  check(!!expected,'expected.present');check(!current.quit,'runtime.running');
  check(current.eip!=='0x0','runtime.eip');check(!!current.physicalUp,'input.physicalUp');
  const c=context(current), main=c.main, modal=c.modal, focus=c.focusWindow;
  const selected=c.selected;
  // MessageBoxA(NULL, ...) may run before any main is created. Only the real
  // native MessageBox record below can qualify this absent-main case.
  const noMain=c.mainHwnd==='0x0'&&!main, anchor=noMain?modal:main;
  const live=w=>!!(w?.live && w.generation && w.generation!=='0' && w.processId && w.threadId);
  // Refine an existing identity failure without changing its admission rule.
  const identityDetail=(w,role)=>{
    if(live(w))return;
    check(!!w,role+'.windowPresent');check(!!w?.live,role+'.live');
    check(!!w?.generation&&w.generation!=='0',role+'.generation');
    check(!!w?.processId,role+'.processIdentity');check(!!w?.threadId,role+'.threadIdentity');
  };
  identityDetail(focus,'focus');
  if(noMain)check(c.modalHwnd!=='0x0','main.absentRequiresModal');
  else {
    identityDetail(main,'main');
    if(!live(main))check(c.mainHwnd!=='0x0','main.nonNullHwnd');
    check(live(main),'main.liveIdentity');check(!!main&&!main.isChild,'main.topLevel');
    // main_hwnd is the creator's first top-level, not necessarily its current
    // presentation/input window (a console may remain live but hidden).
    check(!!main?.visible || (c.modalHwnd==='0x0'&&selected?.hwnd!==main?.hwnd&&
      live(selected)&&selected.visible&&!selected.isChild),'main.visible');
  }
  check(live(focus),'focus.liveIdentity');check(!!anchor&&focus?.processId===anchor.processId,'focus.process');
  check(!!anchor&&focus?.threadId===anchor.threadId,'focus.thread');
  const focusRow=current.windows?.find(w=>w.hwnd===c.focus);
  check(!!focusRow&&['hwnd','generation','processId','threadId'].every(k=>focusRow[k]===focus?.[k]),'focus.windowIdentity');
  check(!!c.nativeProcess?.pid&&!!c.nativeProcess.executable,'process.identity');
  check(!!c.screen?.w&&!!c.screen.h,'screen.dimensions');
  if (c.modalHwnd !== '0x0') {
    identityDetail(modal,'modal');
    check(live(modal),'modal.liveIdentity');check(!!modal?.visible,'modal.visible');check(!!modal&&!modal.isChild,'modal.topLevel');
    check(!!anchor&&modal?.processId===anchor.processId,'modal.process');check(!!anchor&&modal?.threadId===anchor.threadId,'modal.thread');
    check(!!modal&&c.focusTopLevel===modal.hwnd,'focus.modalTopLevel');
    if (!main || modal?.owner!==main.hwnd || modal?.controlClass===0) {
      const box=c.nativeMessageBox;
      const dlg=c.nativeDialogBox;
      // Independent creation provenance, never a class-0/owner-0 whitelist.
      // A nested dialog may be owned by another live dialog of this actor.
      const owner=current.windows?.find(w=>w.hwnd===modal?.owner);
      const dialog=!!(dlg && modal && dlg.hwnd===modal.hwnd && dlg.generation===modal.generation &&
        dlg.processId===modal.processId && dlg.threadId===modal.threadId && dlg.owner===modal.owner &&
        dlg.callback && dlg.callback!=='0x0' && dlg.returnSite && dlg.returnSite!=='0x0' &&
        (modal.owner==='0x0' || (live(owner)&&!owner.isChild&&owner.processId===modal.processId&&owner.threadId===modal.threadId)));
      const nested=dlg?.nestedMessageBox;
      const ownedBox=!!(nested && box && modal && live(owner) && !owner.isChild &&
        dlg.hwnd===owner.hwnd && dlg.generation===owner.generation &&
        dlg.processId===owner.processId && dlg.threadId===owner.threadId &&
        dlg.callback && dlg.callback!=='0x0' && dlg.returnSite && dlg.returnSite!=='0x0' &&
        nested.hwnd===modal.hwnd && nested.generation===modal.generation &&
        nested.owner===owner.hwnd && nested.ownerGeneration===owner.generation &&
        nested.returnSite && nested.returnSite!=='0x0' &&
        nested.processId===modal.processId && nested.threadId===modal.threadId &&
        owner.processId===modal.processId && owner.threadId===modal.threadId &&
        box.hwnd===modal.hwnd && box.generation===modal.generation && box.controlClass===16 &&
        box.processId===modal.processId && box.threadId===modal.threadId);
      if(!dialog&&!ownedBox){
      check(!!modal&&modal.owner==='0x0','modal.ownerless');check(!!box&&box.controlClass===16,'messageBox.nativeClass');
      check(!!box&&!!modal&&box.hwnd===modal.hwnd,'messageBox.hwnd');
      check(!!box&&!!modal&&box.generation===modal.generation,'messageBox.generation');
      check(!!box&&!!anchor&&box.processId===anchor.processId,'messageBox.process');
      check(!!box&&!!anchor&&box.threadId===anchor.threadId,'messageBox.thread');
      }
    }
  } else {
    check(live(selected)&&selected.visible&&!selected.isChild,'focus.selectedTopLevel');
    check(!!main&&selected?.processId===main.processId&&selected?.threadId===main.threadId,'selected.actor');
    // An exclusive presentation mapping must describe this same live target.
    const source=current.pointerMapping?.sourceHwnd;
    check(source==null||('0x'+(source>>>0).toString(16))===selected?.hwnd,'selected.presentation');
  }
  // SetCapture routes mouse messages, not keyboard focus. Only the exact live
  // selected top-level may own capture here; modal/control capture keeps its
  // existing separate contract. Full window generations remain in the review.
  check(current.capture==='0x0'||(c.modalHwnd==='0x0'&&live(selected)&&selected.visible&&
    !selected.isChild&&current.capture===selected.hwnd&&
    selected.processId===anchor?.processId&&selected.threadId===anchor?.threadId),'input.capture');
  check(!!expected&&JSON.stringify(c)===JSON.stringify(context(expected)),'context.unchanged');
  return failures;
}
function matches(current,expected){return contextFailures(current,expected).length===0;}
// Passive startup only: no capture registry, input lease, pump or presentation.
// Stop at valid context even when a control is unsupported. Capture diagnoses
// control capabilities under its own original 3000ms clock afterward.
function startupReadiness(snapshot,base,instance,threadManager){
  const failures=contextFailures(snapshot,snapshot);
  const lease=context(snapshot);
  const owner=failures.length===0 && lease.mainHwnd==='0x0' && !lease.main
    ? reviewedProcessOwner(base,lease,instance,threadManager)
    : failures.length===0 && lease.selected?.hwnd!==lease.mainHwnd && lease.modalHwnd==='0x0'
      ? reviewedRuntimeOwner(base,lease,instance,threadManager,'selected-live-top-level') : base;
  const refs=owner.refs;
  const actor=refs.actorExports;
  const anchor=lease.selected || lease.main || lease.modal;
  const actorContext=!!(actor && anchor &&
    actor.get_process_id()===anchor.processId &&
    actor.get_current_thread_id()===anchor.threadId);
  if(!owner.healthy)failures.push('owner.ordinaryUSER');
  if(!actorContext)failures.push('owner.actorContext');
  const result={contract:'native-startup-readiness-v1',ready:failures.length===0,failures,
    snapshot,ordinaryOwner:{healthy:!!owner.healthy,actorContext,
      processId:actor?.get_process_id()||0,threadId:actor?.get_current_thread_id()||0,
      kind:refs.nativeOwnerKind||'ordinary-main'}};
  result.nullFocusTransition=focusTransitionPending(result,{...snapshot,focusWindow:anchor});
  return result;
}
// A null focus can be observed between ordinary guest destruction and the
// next focus assignment. This grants only passive observation, never capture
// or input. The retained process and actual actor must still be the same.
function focusTransitionPending(readiness, expected) {
  const s=readiness.snapshot, c=context(s), anchor=c.modal || c.main;
  const allowed=new Set(['focus.live','focus.generation','focus.threadIdentity',
    'focus.liveIdentity','focus.thread','focus.mainTopLevel','focus.modalTopLevel','owner.ordinaryUSER',
    'focus.windowIdentity','focus.selectedTopLevel','selected.actor']);
  return !readiness.ready && readiness.failures.length>0 &&
    readiness.failures.every(f=>allowed.has(f)) &&
    s.focus==='0x0' && s.focusTopLevel==='0x0' &&
    s.focusWindow?.hwnd==='0x0' && !s.focusWindow.live &&
    s.focusWindow.generation==='0' && s.focusWindow.threadId===0 &&
    !!anchor?.live && anchor.visible && !anchor.isChild &&
    anchor.processId===expected.focusWindow?.processId &&
    anchor.threadId===expected.focusWindow?.threadId &&
    s.focusWindow.processId===anchor.processId &&
    readiness.ordinaryOwner?.actorContext===true &&
    readiness.ordinaryOwner.processId===anchor.processId &&
    readiness.ordinaryOwner.threadId===anchor.threadId &&
    JSON.stringify(s.nativeProcess)===JSON.stringify(expected.nativeProcess) &&
    JSON.stringify(s.screen)===JSON.stringify(expected.screen);
}
// An actual reviewed pre-main MessageBox has no main/presentation HWND to pin.
// Bind its registered guest actor and real renderer/device references instead.
// Each input still passes verify(), including every actual USER HWND generation.
function reviewedProcessOwner(base,lease,instance,threadManager){
  if(lease.mainHwnd!=='0x0'||lease.main!==null)throw Error('reviewed process owner requires absent main');
  return reviewedRuntimeOwner(base,lease,instance,threadManager,'reviewed-pre-main-process');
}
// The runtime/process actor is permanent. Main/modal/control generations belong
// to an explicitly reviewed finite intent and are checked by verify at prepare
// and consumption. Removing presentation-window refs does not adopt a new
// actor, queue, renderer, module, device, memory or physical-release handler.
function reviewedRuntimeOwner(base,lease,instance,threadManager,kind='reviewed-process'){
  const tid=lease.focusWindow.threadId,pid=lease.focusWindow.processId,we=instance.exports;
  const candidates=[];
  if(we.get_current_thread_id()===tid)candidates.push({actor:null,actorInstance:instance});
  for(const actor of threadManager?.threads.values()||[])
    if(actor.state==='active'&&actor.instance!==instance&&actor.instance?.exports.get_current_thread_id()===tid)
      candidates.push({actor,actorInstance:actor.instance});
  const selected=candidates.length===1?candidates[0]:null,owner=selected?.actorInstance.exports;
  const refs={...base.refs};
  // Do not manufacture a main or use the modal as a presentation surrogate.
  delete refs.mainHwnd;delete refs.window;delete refs.hwnd;
  Object.assign(refs,{actor:selected?.actor,actorInstance:selected?.actorInstance,actorExports:owner,tid,
    nativeProcessId:pid,nativeOwnerKind:kind});
  const device=refs.device,state=typeof device?.snapshot==='function'?device.snapshot():null;
  // Pin the creator instance and renderer object for an ordinary alternative
  // top-level. No HWND adoption, focus assignment or capture release occurs.
  const target=lease.modalHwnd==='0x0'?lease.selected:null;
  let selectedHealthy=true;
  if(target&&target.hwnd!==lease.mainHwnd){
    const h=parseInt(target.hwnd,16),win=refs.renderer?.windows[h];
    const creator=win?.wasm?.exports;
    Object.assign(refs,{selectedWindow:win,selectedCreator:win?.wasm});
    selectedHealthy=!!(win?.visible&&creator&&creator.get_process_id()===pid&&
      creator.get_window_thread(h)===tid&&creator.wnd_lookup_live(h)&&
      String(creator.wnd_lookup_generation(h))===target.generation&&
      owner?.wnd_lookup_live(h)&&String(owner.wnd_lookup_generation(h))===target.generation);
  }
  return {refs,healthy:!!(pid&&tid&&owner&&owner.get_process_id()===pid&&we.get_process_id()===pid&&
    !we.get_quit_flag()&&we.get_eip()&&!owner.get_quit_flag()&&owner.get_eip()&&
    selectedHealthy&&(!device||state?.ready))};
}
// Called only for the explicit retained-image contract. The immutable first
// lease pins process/thread and screen; verify independently pins each window.
function reviewedOwnerSnapshot(base,current,lease,instance,threadManager){
  const result=reviewedRuntimeOwner(base,lease,instance,threadManager);
  result.healthy=result.healthy &&
    JSON.stringify(current.nativeProcess)===JSON.stringify(lease.nativeProcess) &&
    JSON.stringify(current.screen)===JSON.stringify(lease.screen);
  // The exact bound actor remains selected from the original lease. A native
  // NULL-owner modal return can temporarily leave no focus before main exists.
  // Focus is an intent predicate in verify(), not permanent actor identity;
  // nativeModal separately proves the exact before/after focus generations.
  // A generation here would accidentally promote the first reviewed window
  // into a permanent lease again. Per-intent generations stay in verify().
  result.refs.nativeSceneMainGeneration=null;
  return result;
}
function captureFailures(s,details=false){
  const context=contextFailures(s,s), controls=[], controlDetails=[];
  const handle=v=>typeof v==='string'&&/^0x[0-9a-f]{1,8}$/i.test(v)?v:null;
  for(const w of s.windows||[]){
    const reasons=[];
    if(w.controlClass===17){
      if(!progress.qualified(w))reasons.push('control.progressUnavailable');
    }else if(!supportedControl(w))reasons.push('control.unsupportedClass');
    if(w.nativeTextAvailable===false)reasons.push('control.textUnavailable');
    controls.push(...reasons);
    if(details&&reasons.length){
      // Refusal diagnostics name native identity and bounded reason codes only.
      // Never serialize the window row: titles/text may contain private data.
      const knownReasons=['missingTextExports','passwordEdit','invalidTextLength','negativeTextLength',
        'textLengthBound','nullTextPointer','textSpanOutsideMemory','nativeEditViewportUnavailable'];
      const d=w.nativeTextDiagnostic;
      const numericDiagnostic=['invalidTextLength','negativeTextLength','textLengthBound','nullTextPointer','textSpanOutsideMemory'].includes(w.nativeTextUnavailableReason)&&d&&
        (d.reportedLength===null||(Number.isInteger(d.reportedLength)&&d.reportedLength>=-0x80000000&&d.reportedLength<=0x7fffffff))&&
        Number.isInteger(d.pointer)&&d.pointer>=0&&d.pointer<=0xffffffff&&
        Number.isSafeInteger(d.memoryBytes)&&d.memoryBytes>=0&&typeof d.spanInBounds==='boolean'
        ?{textDiagnostic:{contract:'native-user-text-span-v1',lengthSource:'native_user_text_length',
          pointerSource:'native_user_text_ptr',reportedLength:d.reportedLength,pointer:d.pointer,
          memoryBytes:d.memoryBytes,spanInBounds:d.spanInBounds}}:{};
      controlDetails.push({hwnd:handle(w.hwnd),
        controlClass:Number.isInteger(w.controlClass)&&w.controlClass>=0&&w.controlClass<=0xffffffff?w.controlClass:null,reasons,
        textReason:knownReasons.includes(w.nativeTextUnavailableReason)?w.nativeTextUnavailableReason:null,...numericDiagnostic,
        ...(w.nativeTextUnavailableReason==='nativeEditViewportUnavailable'&&
          Number.isInteger(w.nativeEditViewportDiagnostic?.status)&&w.nativeEditViewportDiagnostic.status>=-8&&w.nativeEditViewportDiagnostic.status<=1
          ?{editViewportStatus:w.nativeEditViewportDiagnostic.status}:{})});
    }
  }
  return {context,controls:[...new Set(controls)],...(details?{controlDetails,
    contextDetails:context.length?{mainHwnd:handle(s.mainHwnd),modalHwnd:handle(s.modalHwnd),
      focus:handle(s.focus),focusTopLevel:handle(s.focusTopLevel)}:null}: {})};
}
const REVIEWED_CONTEXT = 'native-reviewed-context-v1';
// Public USER/control metadata, never inferred semantics from composited pixels.
// All controls are included: a changed sibling can change the meaning of a key.
function reviewedContext(s) {
  return {...context(s), pointerMapping:s.pointerMapping,
    windows:[...(s.windows || [])].sort((a,b)=>a.hwnd.localeCompare(b.hwnd))};
}
// Preserve the full observations above for review/evidence. Only these four
// qualified native values are observational when validating a stable intent.
function inputContext(s){
  return {...reviewedContext(s),windows:reviewedContext(s).windows.map(progress.inputMetadata)};
}
function createReviewedContexts({now=Date.now, monotonic=()=>performance.now()}={}) {
  const records=new Map();
  const {randomUUID,createHash}=require('node:crypto');
  const digest=b=>createHash('sha256').update(b).digest('hex');
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const supported=s=>s.windows.every(supportedControl);
  function capture(snapshot, encode, write) {
    if(records.size>=128)throw Error('reviewed capture registry full');
    const startedAt=now(), startedMono=monotonic(), before=snapshot();
    const failure=captureFailures(before,true);
    if(failure.context.length||failure.controls.length)throw Error('native capture refused '+JSON.stringify(failure));
    const image=Buffer.from(encode()), after=snapshot(), completedAt=now();
    if(monotonic()-startedMono>3000 || completedAt-startedAt>3000 || !supported(after) ||
       !equal(inputContext(before),inputContext(after)))throw Error('native capture context changed or observation expired');
    const captureId=randomUUID(), pngSHA256=digest(image);
    // Retain the complete encoder bytes and ORIGINAL times. Never recapture to
    // replace the reviewed image, never call a fresh repaint a personal review.
    records.set(captureId,{image, snapshot:structuredClone(before),observationAfter:structuredClone(after),startedAt,completedAt,startedMono,pngSHA256,nonce:null});
    write(image);
    return {contract:REVIEWED_CONTEXT,captureId,pngSHA256,startedAt,completedAt,snapshot:before,observationAfter:after};
  }
  function verify(current, review, event=null, nonce=null) {
    if(review?.contract!==REVIEWED_CONTEXT || review.reviewed!==true)throw Error('explicit personal reviewed-context attestation required');
    // Owner policy: allow measured personal image transport for gameplay.
    // Original capture clocks, context checks and finite nonce remain binding.
    const r=records.get(review.captureId), limit={game:15000,menu:30000}[review.scope];
    if(!r || !limit || review.pngSHA256!==r.pngSHA256 || digest(r.image)!==r.pngSHA256)throw Error('unretained or changed reviewed image');
    if(!Number.isFinite(review.reviewedAt) || review.reviewedAt<r.completedAt || review.reviewedAt>now() ||
       now()-r.startedAt>=limit || monotonic()-r.startedMono>=limit || now()-review.reviewedAt>=limit)throw Error('reviewed image stale');
    const attestation=JSON.stringify([review.reviewedAt,review.scope,review.targetHwnd,review.drawnRegion]);
    if(r.attestation && r.attestation!==attestation)throw Error('original personal review attestation changed');
    if(!supported(current) || !matches(current,r.snapshot) || !equal(inputContext(current),inputContext(r.snapshot)))throw Error('reviewed native control context changed');
    const target=current.windows.find(w=>w.hwnd===review.targetHwnd);
    if(target?.controlClass===17)throw Error('read-only observational ProgressBar cannot be an input target');
    const top=context(current).selected?.hwnd;
    if(!target?.live || !target.visible || (target.style & (1<<27)) || target.processId!==current.focusWindow.processId ||
       target.threadId!==current.focusWindow.threadId)throw Error('reviewed target unavailable');
    let ancestor=target; const seen=new Set();
    while(ancestor && ancestor.hwnd!==top && !seen.has(ancestor.hwnd)) {
      seen.add(ancestor.hwnd);ancestor=current.windows.find(w=>w.hwnd===ancestor.parent);
    }
    if(ancestor?.hwnd!==top)throw Error('target outside current main/modal');
    if(review.drawnRegion!==undefined){
      const {rect,binding}=review.drawnRegion||{};
      const window=target&&Object.fromEntries(['hwnd','generation','processId','threadId'].map(k=>[k,target[k]]));
      if(review.scope!=='menu'||target.isChild||target.hwnd!==top||current.modalHwnd!=='0x0'||
         !equal(binding,{captureId:review.captureId,pngSHA256:review.pngSHA256,nativeProcess:r.snapshot.nativeProcess,window})||
         !Array.isArray(rect)||rect.length!==4||!rect.every(Number.isSafeInteger))throw Error('wrong drawn region binding');
      const [x,y,w,h]=rect;
      if(w<=0||h<=0||x<target.x||y<target.y||x+w>target.x+target.w||y+h>target.y+target.h)throw Error('drawn region outside target');
      if(event&&(!event.action.startsWith('mouse')||event.x<x||event.y<y||event.x>=x+w||event.y>=y+h))throw Error('input outside reviewed drawn region');
    }
    if(event) {
      if(!nonce || (r.nonce!==null && r.nonce!==nonce))throw Error('review already reserved for another finite intent');
      if(event.action.startsWith('key') && target.hwnd!==current.focus)throw Error('key target is not current focus');
      if(event.action.startsWith('mouse')) {
        if(current.capture!=='0x0'&&target.hwnd!==current.capture)throw Error('mouse target is not capture owner');
        require('./cli-native-pointer-coordinates').containsPointer(r.snapshot,target,event);
      }
      r.nonce=nonce;
    }
    r.attestation=attestation;
    return {contract:REVIEWED_CONTEXT,context:context(current)};
  }
  return {capture,verify};
}
function createNativeExitRecorder(file,invocationToken){
  if(!file&&!invocationToken)return Object.assign(()=>{},{cancel:()=>{}});
  if(!file||!invocationToken||!/^[0-9a-f-]{36}$/.test(invocationToken))throw Error('native exit receipt requires invocation token and path');
  const fs=require('node:fs');
  const stat=fs.readFileSync('/proc/self/stat','utf8');
  const identity={pid:process.pid,startToken:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],invocationToken,
    bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()};
  function publish(target,value){
    const pending=target+'.'+process.pid+'.pending';
    const fd=fs.openSync(pending,'wx');
    try{fs.writeFileSync(fd,JSON.stringify({...identity,...value})+'\n');fs.fsyncSync(fd);}
    finally{fs.closeSync(fd);}
    fs.linkSync(pending,target);fs.unlinkSync(pending);
  }
  let cancelled=false;
  return Object.assign(code=>publish(file,{contract:'native-process-exit-v1',exitCode:code>>>0,
    atExit:Date.now()/1000,atExitMono:Number(process.hrtime.bigint())/1e9}),{
    cancel:reason=>{if(cancelled)return;cancelled=true;publish(file+'.cancelled',{reason,at:Date.now()/1000});}
  });
}
module.exports={focusTransitionPending,context,matches,contextFailures,captureFailures,startupReadiness,reviewedProcessOwner,reviewedRuntimeOwner,reviewedOwnerSnapshot,reviewedContext,createReviewedContexts,REVIEWED_CONTEXT,createNativeExitRecorder};
