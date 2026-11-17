'use strict';

const progress=require('./cli-native-progress');
const common=require('./cli-native-common-controls');
const supportedControl=w=>progress.supported(w)||(w.nativeTextAvailable!==false&&common.qualified(w));

// Public native USER identities only. A permanent renderer owner can outlive
// individual dialogs; each intent must still match its own reviewed scene.
function context(s) {
  const window = h => s.windows?.find(w => w.hwnd === h) || null;
  return { mainHwnd:s.mainHwnd, main:window(s.mainHwnd), modalHwnd:s.modalHwnd,
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
  check(current.capture==='0x0','input.capture');
  const c=context(current), main=c.main, modal=c.modal, focus=c.focusWindow;
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
    check(live(main),'main.liveIdentity');check(!!main?.visible,'main.visible');check(!!main&&!main.isChild,'main.topLevel');
  }
  check(live(focus),'focus.liveIdentity');check(!!anchor&&focus?.processId===anchor.processId,'focus.process');
  check(!!anchor&&focus?.threadId===anchor.threadId,'focus.thread');
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
  } else check(!!main&&c.focusTopLevel===main.hwnd,'focus.mainTopLevel');
  check(!!expected&&JSON.stringify(c)===JSON.stringify(context(expected)),'context.unchanged');
  return failures;
}
function matches(current,expected){return contextFailures(current,expected).length===0;}
// An actual reviewed pre-main MessageBox has no main/presentation HWND to pin.
// Bind its registered guest actor and real renderer/device references instead.
// Each input still passes verify(), including every actual USER HWND generation.
function reviewedProcessOwner(base,lease,instance,threadManager){
  if(lease.mainHwnd!=='0x0'||lease.main!==null)throw Error('reviewed process owner requires absent main');
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
    nativeProcessId:pid,nativeOwnerKind:'reviewed-pre-main-process'});
  const device=refs.device,state=typeof device?.snapshot==='function'?device.snapshot():null;
  return {refs,healthy:!!(pid&&tid&&owner&&owner.get_process_id()===pid&&we.get_process_id()===pid&&
    !we.get_quit_flag()&&we.get_eip()&&!owner.get_quit_flag()&&owner.get_eip()&&
    (!device||state?.ready))};
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
      const knownReasons=['missingTextExports','passwordEdit','negativeTextLength',
        'textLengthBound','nullTextPointer','textSpanOutsideMemory'];
      controlDetails.push({hwnd:handle(w.hwnd),
        controlClass:Number.isInteger(w.controlClass)&&w.controlClass>=0&&w.controlClass<=0xffffffff?w.controlClass:null,reasons,
        textReason:knownReasons.includes(w.nativeTextUnavailableReason)?w.nativeTextUnavailableReason:null});
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
    const attestation=JSON.stringify([review.reviewedAt,review.scope,review.targetHwnd]);
    if(r.attestation && r.attestation!==attestation)throw Error('original personal review attestation changed');
    if(!supported(current) || !matches(current,r.snapshot) || !equal(inputContext(current),inputContext(r.snapshot)))throw Error('reviewed native control context changed');
    const target=current.windows.find(w=>w.hwnd===review.targetHwnd);
    if(target?.controlClass===17)throw Error('read-only observational ProgressBar cannot be an input target');
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
module.exports={context,matches,contextFailures,captureFailures,reviewedProcessOwner,reviewedContext,createReviewedContexts,REVIEWED_CONTEXT,createNativeExitRecorder};
