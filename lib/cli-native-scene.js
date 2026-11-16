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
function matches(current, expected) {
  if (!expected || current.quit || current.eip === '0x0' || !current.physicalUp || current.capture !== '0x0') return false;
  const c=context(current), main=c.main, modal=c.modal, focus=c.focusWindow;
  const live=w=>!!(w?.live && w.generation && w.generation!=='0' && w.processId && w.threadId);
  if (!live(main) || !main.visible || main.isChild || !live(focus) ||
      focus.processId!==main.processId || focus.threadId!==main.threadId ||
      !c.nativeProcess?.pid || !c.nativeProcess.executable || !c.screen?.w || !c.screen.h) return false;
  if (c.modalHwnd !== '0x0') {
    if (!live(modal) || !modal.visible || modal.isChild || modal.processId!==main.processId ||
        modal.threadId!==main.threadId || c.focusTopLevel!==modal.hwnd) return false;
    if (modal.owner!==main.hwnd) {
      const box=c.nativeMessageBox;
      if (modal.owner!=='0x0' || !box || box.controlClass!==16 || box.hwnd!==modal.hwnd ||
          box.generation!==modal.generation || box.processId!==main.processId || box.threadId!==main.threadId) return false;
    }
  } else if (c.focusTopLevel!==main.hwnd) return false;
  return JSON.stringify(c)===JSON.stringify(context(expected));
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
    if(!matches(before,before) || !supported(before))throw Error('native capture context unavailable or unsupported semantic control class');
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
module.exports={context,matches,reviewedContext,createReviewedContexts,REVIEWED_CONTEXT};
