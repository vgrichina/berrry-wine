'use strict';

// Public native USER identities only. A permanent renderer owner can outlive
// individual dialogs; each intent must still match its own reviewed scene.
function context(s) {
  const window = h => s.windows?.find(w => w.hwnd === h) || null;
  return { mainHwnd:s.mainHwnd, main:window(s.mainHwnd), modalHwnd:s.modalHwnd,
    modal:window(s.modalHwnd), focus:s.focus, focusTopLevel:s.focusTopLevel,
    focusWindow:s.focusWindow, capture:s.capture, physicalUp:s.physicalUp,
    nativeProcess:s.nativeProcess, nativeMessageBox:s.nativeMessageBox, screen:s.screen };
}
// Bounded field names only: no titles, text bytes, executable paths or app state.
function contextFailures(current, expected) {
  const failures=[];
  const check=(ok,name)=>{if(!ok)failures.push(name);};
  check(!!expected,'expected.present');check(!current.quit,'runtime.running');
  check(current.eip!=='0x0','runtime.eip');check(!!current.physicalUp,'input.physicalUp');
  check(current.capture==='0x0','input.capture');
  const c=context(current), main=c.main, modal=c.modal, focus=c.focusWindow;
  const live=w=>!!(w?.live && w.generation && w.generation!=='0' && w.processId && w.threadId);
  // Refine an existing identity failure without changing its admission rule.
  const identityDetail=(w,role)=>{
    if(live(w))return;
    check(!!w,role+'.windowPresent');check(!!w?.live,role+'.live');
    check(!!w?.generation&&w.generation!=='0',role+'.generation');
    check(!!w?.processId,role+'.processIdentity');check(!!w?.threadId,role+'.threadIdentity');
  };
  identityDetail(main,'main');identityDetail(focus,'focus');
  if(!live(main))check(c.mainHwnd!=='0x0','main.nonNullHwnd');
  check(live(main),'main.liveIdentity');check(!!main?.visible,'main.visible');check(!!main&&!main.isChild,'main.topLevel');
  check(live(focus),'focus.liveIdentity');check(!!main&&focus?.processId===main.processId,'focus.process');
  check(!!main&&focus?.threadId===main.threadId,'focus.thread');
  check(!!c.nativeProcess?.pid&&!!c.nativeProcess.executable,'process.identity');
  check(!!c.screen?.w&&!!c.screen.h,'screen.dimensions');
  if (c.modalHwnd !== '0x0') {
    identityDetail(modal,'modal');
    check(live(modal),'modal.liveIdentity');check(!!modal?.visible,'modal.visible');check(!!modal&&!modal.isChild,'modal.topLevel');
    check(!!main&&modal?.processId===main.processId,'modal.process');check(!!main&&modal?.threadId===main.threadId,'modal.thread');
    check(!!modal&&c.focusTopLevel===modal.hwnd,'focus.modalTopLevel');
    if (!main || modal?.owner!==main.hwnd) {
      const box=c.nativeMessageBox;
      check(!!modal&&modal.owner==='0x0','modal.ownerless');check(!!box&&box.controlClass===16,'messageBox.nativeClass');
      check(!!box&&!!modal&&box.hwnd===modal.hwnd,'messageBox.hwnd');
      check(!!box&&!!modal&&box.generation===modal.generation,'messageBox.generation');
      check(!!box&&!!main&&box.processId===main.processId,'messageBox.process');
      check(!!box&&!!main&&box.threadId===main.threadId,'messageBox.thread');
    }
  } else check(!!main&&c.focusTopLevel===main.hwnd,'focus.mainTopLevel');
  check(!!expected&&JSON.stringify(c)===JSON.stringify(context(expected)),'context.unchanged');
  return failures;
}
function matches(current,expected){return contextFailures(current,expected).length===0;}
function captureFailures(s){
  const context=contextFailures(s,s), controls=[];
  for(const w of s.windows||[]){
    if(![0,1,2,3,16].includes(w.controlClass))controls.push('control.unsupportedClass');
    if(w.nativeTextAvailable===false)controls.push('control.textUnavailable');
  }
  return {context,controls:[...new Set(controls)]};
}
const REVIEWED_CONTEXT = 'native-reviewed-context-v1';
// Public USER/control metadata, never inferred semantics from composited pixels.
// All controls are included: a changed sibling can change the meaning of a key.
function reviewedContext(s) {
  return {...context(s), windows:[...(s.windows || [])].sort((a,b)=>a.hwnd.localeCompare(b.hwnd))};
}
function createReviewedContexts({now=Date.now, monotonic=()=>performance.now()}={}) {
  const records=new Map();
  const {randomUUID,createHash}=require('node:crypto');
  const digest=b=>createHash('sha256').update(b).digest('hex');
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const supported=s=>s.windows.every(w=>[0,1,2,3,16].includes(w.controlClass) && w.nativeTextAvailable!==false);
  function capture(snapshot, encode, write) {
    if(records.size>=128)throw Error('reviewed capture registry full');
    const startedAt=now(), startedMono=monotonic(), before=snapshot();
    const failure=captureFailures(before);
    if(failure.context.length||failure.controls.length)throw Error('native capture refused '+JSON.stringify(failure));
    const image=Buffer.from(encode()), after=snapshot(), completedAt=now();
    if(monotonic()-startedMono>3000 || completedAt-startedAt>3000 ||
       !equal(reviewedContext(before),reviewedContext(after)))throw Error('native capture context changed or observation expired');
    const captureId=randomUUID(), pngSHA256=digest(image);
    // Retain the complete encoder bytes and ORIGINAL times. Never recapture to
    // replace the reviewed image, never call a fresh repaint a personal review.
    records.set(captureId,{image, snapshot:structuredClone(before),startedAt,completedAt,startedMono,pngSHA256,nonce:null});
    write(image);
    return {contract:REVIEWED_CONTEXT,captureId,pngSHA256,startedAt,completedAt,snapshot:before};
  }
  function verify(current, review, event=null, nonce=null) {
    if(review?.contract!==REVIEWED_CONTEXT || review.reviewed!==true)throw Error('explicit personal reviewed-context attestation required');
    const r=records.get(review.captureId), limit={game:5000,menu:30000}[review.scope];
    if(!r || !limit || review.pngSHA256!==r.pngSHA256 || digest(r.image)!==r.pngSHA256)throw Error('unretained or changed reviewed image');
    if(!Number.isFinite(review.reviewedAt) || review.reviewedAt<r.completedAt || review.reviewedAt>now() ||
       now()-r.startedAt>=limit || monotonic()-r.startedMono>=limit || now()-review.reviewedAt>=limit)throw Error('reviewed image stale');
    const attestation=JSON.stringify([review.reviewedAt,review.scope,review.targetHwnd]);
    if(r.attestation && r.attestation!==attestation)throw Error('original personal review attestation changed');
    if(!supported(current) || !matches(current,r.snapshot) || !equal(reviewedContext(current),reviewedContext(r.snapshot)))throw Error('reviewed native control context changed');
    const target=current.windows.find(w=>w.hwnd===review.targetHwnd);
    const top=current.modalHwnd!=='0x0'?current.modalHwnd:current.mainHwnd;
    if(!target?.live || !target.visible || (target.style & (1<<27)) || target.processId!==current.focusWindow.processId ||
       target.threadId!==current.focusWindow.threadId)throw Error('reviewed target unavailable');
    let ancestor=target; const seen=new Set();
    while(ancestor && ancestor.hwnd!==top && !seen.has(ancestor.hwnd)) {
      seen.add(ancestor.hwnd);ancestor=current.windows.find(w=>w.hwnd===ancestor.parent);
    }
    if(ancestor?.hwnd!==top)throw Error('target outside current main/modal');
    if(event) {
      if(!nonce || (r.nonce!==null && r.nonce!==nonce))throw Error('review already reserved for another finite intent');
      if(event.action.startsWith('key') && target.hwnd!==current.focus)throw Error('key target is not current focus');
      if(event.action.startsWith('mouse')) {
        const x=target.screenX,y=target.screenY;
        if(!Number.isFinite(x) || !Number.isFinite(y))throw Error('native target geometry unavailable');
        if(event.x<x || event.y<y || event.x>=x+target.w || event.y>=y+target.h)throw Error('pointer outside reviewed target');
      }
      r.nonce=nonce;
    }
    r.attestation=attestation;
    return {contract:REVIEWED_CONTEXT,context:context(current)};
  }
  return {capture,verify};
}
module.exports={context,matches,contextFailures,captureFailures,reviewedContext,createReviewedContexts,REVIEWED_CONTEXT};
