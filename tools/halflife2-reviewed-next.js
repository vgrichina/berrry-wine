#!/usr/bin/env node
'use strict';
// Bind a personally selected captured native BUTTON, never its parent frame.
//
// This preflight uses public captured USER metadata only. The existing native
// broker still proves the actual actor, generation and dispatch return fence.
// No label selection, OCR, solver, or original installer automation lives here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const Module=require('node:module'),{isDeepStrictEqual}=require('node:util');
const np=require('./native-proc.cjs');
const ROOT=path.resolve(__dirname,'..');
const LOCAL_REFUSAL=75;
const M=module.exports;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const same=(a,b)=>isDeepStrictEqual(a,b);
const hex=()=>crypto.randomUUID().replace(/-/g,'');
function ok(cond,message){if(!cond){const e=new Error(message||'assertion failed');e.name='AssertionError';e.code='ERR_ASSERTION';throw e;}}
// Python SystemExit(code): unwinds through the same exception handlers.
class SystemExit extends Error{constructor(code){super('SystemExit('+code+')');this.name='SystemExit';this.exitCode=code;}}
// time.time()/time.sleep() as seen by a controller module. Fixture models
// pass their own `time`; the pinned controller gets the real clocks.
const REAL_TIME={time:np.now,sleep:s=>np.sleep(s*1000)};
const R=m=>String(m.R);
const at=(m,n)=>path.join(R(m),n);
const glob=(m,re)=>fs.readdirSync(R(m)).filter(n=>re.test(n)).sort();
// fnmatch-style pattern -> RegExp (only '*' is used here).
const pattern=p=>new RegExp('^'+p.split('*').map(s=>s.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$');
function appendLine(file,text,sync=false){
  const fd=fs.openSync(file,'a');
  try{fs.writeSync(fd,text);if(sync)fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}

function transport_journal(m){
  // An unfinished or non-observational request can never justify recovery.
  const original=m.call;
  const record=v=>appendLine(at(m,'prebind-transport.jsonl'),JSON.stringify(v)+'\n',true);
  m.call=async(command,...args)=>{
    // bind-intent is durable before the first binding request and forever
    // excludes recovery. Keep this proof's IO off the native input clocks.
    if(fs.existsSync(at(m,'bind-intent.json')))return original(command,...args);
    const token=hex();
    record({token,phase:'started',action:command.action});
    const result=await original(command,...args);
    record({token,phase:'complete',action:command.action});
    return result;
  };
}

function unbound_proof(m){
  ok(!fs.existsSync(at(m,'PERMANENT-UNKNOWN.json')),'permanent UNKNOWN');
  const names=fs.readdirSync(R(m));
  for(const p of ['*intent.json','*owner.json','*-release-*','*-up*.json','*-down.json','*-completion.json'])
    ok(!names.some(n=>pattern(p).test(n)),'prior binding, armed release or side effect');
  const lines=f=>fs.readFileSync(at(m,f),'utf8').split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));
  const rows=lines('prebind-transport.jsonl'),requests=lines('requests.jsonl');
  ok(rows.length&&rows.length===2*requests.length,'incomplete transport proof');
  requests.forEach((request,i)=>{
    const [a,b]=rows.slice(i*2,i*2+2);
    ok(a.phase==='started'&&same(b,{...a,phase:'complete'}),'inflight/ambiguous transport');
    ok(a.action===request.action&&['native-startup-readiness','native-reviewed-capture'].includes(a.action),'unexpected pre-bind request');
    ok(request.cleanup===false,'cleanup request before binding');
  });
  const ready=m.read('startup-ready.json');
  ok(ready.ready&&ready.passive&&same(ready.target,m.identity())&&ready.port===m.PORT,'startup readiness does not match this native invocation');
  return {target:ready.target,port:m.PORT,requests:requests.length,
    journalSHA256:sha(fs.readFileSync(at(m,'prebind-transport.jsonl'))),
    requestsSHA256:sha(fs.readFileSync(at(m,'requests.jsonl')))};
}

function local_expiry(m,scene){
  // Only the local pre-bind freshness refusal; never intercept bind errors.
  // Validate every non-time condition first. Wrong owner, missing pixels,
  // incomplete review and ambiguous IO still take the terminal exception path.
  const time=m.time||REAL_TIME;
  const rr=m.read(scene+'.json'),r=m.read(scene+'-review.json');
  ok(['install','quit'].includes(r.kind),'review kind');
  ok(r.rawCompleteScene===true,'review is not a raw complete scene');
  ok(r.observation&&r.visibleLabel&&rr.captureId,'incomplete review or capture');
  ok(same(rr.target,m.identity()),'capture target is not the current native identity');
  ok(rr.port===m.PORT,'capture port differs');
  const png=sha(fs.readFileSync(at(m,scene+'.png')));
  ok(r.pngSHA256===rr.pngSHA256&&rr.pngSHA256===png,'reviewed PNG differs');
  ok(rr.image.contract==='native-reviewed-context-v1','capture contract');
  ok(rr.image.captureId===rr.captureId,'capture id differs');
  ok(rr.image.pngSHA256===rr.pngSHA256,'capture PNG differs');
  ok(rr.at===rr.image.startedAt/1000&&rr.completedAt===rr.image.completedAt/1000,'capture clock differs');
  ok(0<=rr.completedAt-rr.at&&rr.completedAt-rr.at<3&&rr.completedAt<=r.at,'capture/review order');
  ok(rr.observationStartedAt<=rr.at&&rr.at<rr.completedAt&&rr.completedAt<rr.observationDeadline,'capture observation window');
  ok(rr.observationDeadline===rr.observationStartedAt+3,'capture observation deadline');
  ok(same(rr.snapshot,rr.image.snapshot)&&rr.completedAt>=rr.at,'capture snapshot differs');
  const p=r.buttonPreflight;
  ok(same(preflight(rr.snapshot,r.targetHwnd,p.x,p.y,r.visibleLabel),p),'button preflight differs');
  const now=time.time(),capture_age=now-rr.at,review_age=now-r.at;
  ok(capture_age>=0&&review_age>=0,'clock went backwards');
  if(capture_age<30)return false;
  const proof=unbound_proof(m);
  m.save('local-prebind-refusal-'+hex()+'.json',{
    contract:'hl2-local-prebind-expiry-v1',scene,at:now,
    captureAgeSeconds:capture_age,reviewAgeSeconds:review_age,...proof,
    captureSHA256:sha(fs.readFileSync(at(m,scene+'.json'))),
    noBinding:true,noDispatch:true,newCompleteCaptureAndPersonalReviewRequired:true});
  return true;
}

function verified_local_refusal(run,scene,after){
  // Supervisor accepts only this invocation's exact zero-dispatch receipt.
  const m={R:String(run)};
  m.read=n=>JSON.parse(fs.readFileSync(at(m,n),'utf8'));
  let rows=glob(m,/^local-prebind-refusal-.*\.json$/).map(n=>m.read(n));
  rows=rows.filter(r=>r.scene===scene&&(r.at??0)>=after);
  if(rows.length!==1)return false;
  const r=rows[0];
  if(r.contract!=='hl2-local-prebind-expiry-v1'||(r.captureAgeSeconds??0)<30)return false;
  // Identity is proved again by the actual helper on the next capture, before HTTP.
  m.identity=()=>r.target;m.PORT=m.read('launch.json').rootPort;
  const proof=unbound_proof(m);
  return Object.entries(proof).every(([k,v])=>same(r[k],v))&&
    ['noBinding','noDispatch','newCompleteCaptureAndPersonalReviewRequired'].every(k=>r[k]===true)&&
    r.captureSHA256===sha(fs.readFileSync(at(m,scene+'.json')));
}

async function startup(m){
  const time=m.time||REAL_TIME;
  await m.reserve();const target=m.identity(),started=time.time();
  ok(!fs.existsSync(at(m,'startup-ready.json')),'startup preflight is single-use');
  ok(!fs.existsSync(at(m,'input-owner.json')),'startup cannot wait away a later context');
  const deadline=Math.min(started+15,m.read('launch.json').gameplayCutoff-3);
  let polls=0;
  while(true){
    const remaining=deadline-time.time();ok(remaining>0,'passive startup readiness UNKNOWN');
    const reply=await m.call({action:'native-startup-readiness'},Math.min(1,remaining));polls++;
    ok(reply.contract==='native-startup-readiness-v1','readiness contract');
    const s=reply.snapshot;
    appendLine(at(m,'startup-polls.jsonl'),JSON.stringify({at:time.time(),ready:reply.ready,failures:reply.failures,
      mainHwnd:s.mainHwnd,modalHwnd:s.modalHwnd,focus:s.focus,
      focusTopLevel:s.focusTopLevel,ordinaryOwner:reply.ordinaryOwner})+'\n');
    if(reply.ready){
      ok(same(m.identity(),target),'native identity changed during startup');
      m.save('startup-ready.json',{startedAt:started,completedAt:time.time(),deadline,
        polls,target,port:m.PORT,passive:true,...reply});
      return;
    }
    await time.sleep(Math.min(.02,Math.max(0,deadline-time.time())));
  }
}

async function capture(m,name){
  // Observe a null-focus transition inside the original capture clock.
  // No refused capture is retried. Readiness creates no PNG/lease/input and
  // never executes guest instructions on behalf of the controller.
  const time=m.time||REAL_TIME;
  await m.reserve();const target=m.identity(),started=time.time(),deadline=started+3;
  const refusals=glob(m,/^local-prebind-refusal-.*\.json$/);
  let refused=null;
  const owned=()=>fs.existsSync(at(m,'input-owner.json'));
  if(refusals.length&&!owned()){
    unbound_proof(m);
    const refusal=refusals.map(n=>m.read(n)).reduce((a,b)=>b.at>a.at?b:a);
    ok(name!==refusal.scene,'new complete capture required');
    ok(refusal.captureSHA256===sha(fs.readFileSync(at(m,refusal.scene+'.json'))),'refused capture changed');
    refused=m.read(refusal.scene+'.json');
    ok(refused.pngSHA256===sha(fs.readFileSync(at(m,refusal.scene+'.png'))),'refused PNG changed');
    ok(same(refused.target,target)&&refused.port===m.PORT,'refused capture owner differs');
  }
  const p=at(m,name+'.png');ok(!fs.existsSync(p),'capture name already used');
  let expected=null;
  if(owned())expected=m.read(m.read('bind-intent.json').scene+'.json').snapshot;
  const polls=[];
  const sameOwner=(a,b)=>['processId','threadId'].every(k=>a.focusWindow[k]===b.focusWindow[k]);
  while(true){
    const remaining=deadline-time.time();ok(remaining>0,'capture readiness UNKNOWN');
    const ready=await m.call({action:'native-startup-readiness'},remaining);
    ok(ready.contract==='native-startup-readiness-v1','readiness contract');
    const snapshot=ready.snapshot;
    if(refused){
      const old=refused.snapshot;
      ok(same(snapshot.nativeProcess,old.nativeProcess)&&same(snapshot.screen,old.screen),'changed native process or screen');
      ok(sameOwner(snapshot,old),'changed actual owner');
    }
    polls.push({at:time.time(),ready:ready.ready,failures:ready.failures,
      mainHwnd:snapshot.mainHwnd,modalHwnd:snapshot.modalHwnd,focus:snapshot.focus,
      focusTopLevel:snapshot.focusTopLevel,ordinaryOwner:ready.ordinaryOwner});
    appendLine(at(m,name+'-readiness-polls.jsonl'),JSON.stringify(polls.at(-1))+'\n');
    if(ready.ready)break;
    // Passive admission is diagnosed by the sealed scene module. Still
    // pin it to the actor/process/screen of the one permanent binding.
    ok(expected&&ready.nullFocusTransition,'non-transient owner/context refusal');
    const anchorHwnd=snapshot.modalHwnd!=='0x0'?snapshot.modalHwnd:snapshot.mainHwnd;
    const anchor=snapshot.windows.find(w=>w.hwnd===anchorHwnd);
    ok(anchor,'readiness anchor window missing');
    ok(anchor.processId===expected.focusWindow.processId,'anchor process differs');
    ok(anchor.threadId===expected.focusWindow.threadId,'anchor thread differs');
    ok(same(snapshot.nativeProcess,expected.nativeProcess)&&same(snapshot.screen,expected.screen),'changed native process or screen');
    await time.sleep(Math.min(.02,Math.max(0,deadline-time.time())));
  }
  m.save(name+'-readiness.json',{startedAt:started,deadline,polls,passive:true});
  const remaining=deadline-time.time();ok(remaining>0,'capture readiness UNKNOWN');
  const reply=await m.call({action:'native-reviewed-capture',path:p},remaining);
  ok(time.time()<deadline&&reply.contract==='native-reviewed-context-v1','late or wrong capture');
  ok(same(target,m.identity()),'native identity changed during capture');
  if(refused){
    ok(reply.captureId!==refused.captureId,'old capture cannot be reused');
    const old=refused.snapshot,fresh=reply.snapshot;
    ok(same(fresh.nativeProcess,old.nativeProcess)&&same(fresh.screen,old.screen),'changed native process or screen');
    ok(sameOwner(fresh,old),'changed actual owner');
  }
  m.save(name+'.json',{at:reply.startedAt/1000,completedAt:reply.completedAt/1000,
    target,port:m.PORT,snapshot:reply.snapshot,image:reply,captureId:reply.captureId,
    pngSHA256:sha(fs.readFileSync(p)),observationStartedAt:started,observationDeadline:deadline});
  console.log(p);
}

function preflight(snapshot,target,x,y,label){
  const rows=snapshot.windows,matches=rows.filter(w=>w.hwnd===target);
  ok(matches.length===1,'target must be one captured native control');
  const button=matches[0];
  ok(button.controlClass===1&&button.isChild,'target must be native BUTTON, not frame');
  ok(button.live&&button.visible&&!(button.style&0x08000000),'unavailable BUTTON');
  ok(!['0','',null,undefined].includes(button.generation)&&button.nativeTextAvailable,'BUTTON has no live generation or native text');
  ok(button.title===label,'reviewed visible caption differs');
  ok(button.processId===snapshot.focusWindow.processId,'wrong actual owner process');
  ok(button.threadId===snapshot.focusWindow.threadId,'wrong actual owner');
  const top=snapshot.modalHwnd!=='0x0'?snapshot.modalHwnd:snapshot.mainHwnd;
  ok(snapshot.focusTopLevel===top&&snapshot.physicalUp&&snapshot.capture==='0x0','focus/physical input state');
  const chain=[];let row=button;
  while(row.hwnd!==top){
    ok(!chain.includes(row.hwnd)&&row.live&&row.visible,'invalid captured ancestry');
    ok(row.processId===button.processId&&row.threadId===button.threadId,'ancestor owner differs');
    chain.push(row.hwnd);
    const parents=rows.filter(w=>w.hwnd===row.parent);ok(parents.length===1,'captured parent missing or ambiguous');
    row=parents[0];
  }
  ok(row.live&&row.visible&&!row.isChild,'top-level frame unavailable');
  const mapping=snapshot.pointerMapping;
  ok(['transform','viewport','clip'].every(k=>mapping[k]==null),'unsupported presentation mapping');
  ok(same(mapping.canvas,snapshot.screen),'canvas mapping differs');
  ok(Number.isInteger(x)&&Number.isInteger(y),'pointer must be integer');
  ok(0<=x&&x<snapshot.screen.w&&0<=y&&y<snapshot.screen.h,'pointer outside screen');
  ok(button.screenX<=x&&x<button.screenX+button.w,'pointer outside actual BUTTON');
  ok(button.screenY<=y&&y<button.screenY+button.h,'pointer outside actual BUTTON');
  return {targetHwnd:target,generation:button.generation,processId:button.processId,
    threadId:button.threadId,parent:button.parent,top,chain,
    x,y,nativeDispatchFenceRequired:true};
}

// Charge native confirmation through response arrival, before durable IO.
//
// The borrowed pinned controller source stays pinned. This single explicit
// adaptation leaves consumption, independent UP, aggregate and permanent
// UNKNOWN checks intact.
const RECEIPT_CLOCK_BEFORE=Buffer.from(
`    M.save(name+'-down.json',{at:now(),receipt});
    check(now()<start+.5&&receipt.state==='CONSUMED'&&receipt.consumed,'confirmation UNKNOWN');
`);
const RECEIPT_CLOCK_AFTER=Buffer.from(
`    const confirmation_at=now();
    M.save(name+'-down.json',{at:confirmation_at,receipt});
    check(confirmation_at<start+.5&&receipt.state==='CONSUMED'&&receipt.consumed,'confirmation UNKNOWN');
`);
function count(body,needle){let n=0,i=0;while((i=body.indexOf(needle,i))>=0){n++;i+=needle.length;}return n;}
function receipt_clock_body(body){
  body=Buffer.from(body);
  ok(count(body,RECEIPT_CLOCK_BEFORE)===1,'pinned receipt clock adaptation no longer matches');
  const i=body.indexOf(RECEIPT_CLOCK_BEFORE);
  return Buffer.concat([body.subarray(0,i),RECEIPT_CLOCK_AFTER,body.subarray(i+RECEIPT_CLOCK_BEFORE.length)]);
}

// Compile exact bytes as a fresh CommonJS module (Python's exec(compile(...))).
function compile_module(body,filename){
  const m=new Module(filename,module);
  m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));
  m._compile(String(body),filename);
  return m.exports;
}

async function controller(argv=process.argv.slice(2)){
  const run=process.env.DELPHI5_RUN,pins=JSON.parse(fs.readFileSync(path.join(run,'runtime-inputs.json'),'utf8'));
  const helper_name='tools/vb5cce-reviewed-control.js';
  // The Python original compiled `git show <gitSHA>:<helper>`. The Node port
  // compiles the working-tree helper, pinned to the same recorded digest.
  const body=fs.readFileSync(path.join(ROOT,helper_name));
  ok(sha(body)===pins.sources[helper_name],'pinned controller source differs');
  const m=compile_module(M.receipt_clock_body(body),path.join(ROOT,helper_name));
  if(!m.time)m.time=REAL_TIME;
  m.sourcecheck=()=>{
    // The borrowed controller above was compiled from these exact pinned
    // bytes, not re-imported from its concurrently leased mutable checkout.
    ok(sha(body)===pins.sources[helper_name],'pinned controller source differs');
    ok(sha(fs.readFileSync(__filename))===pins.sources['tools/halflife2-reviewed-next.js'],'owned source changed: tools/halflife2-reviewed-next.js');
  };
  // An exclusive operation lock prevents a capture/refusal proof racing a bind.
  // Python held fcntl.flock(LOCK_EX|LOCK_NB) on this file; Node has no flock,
  // so the lock is an exclusive-create ('wx') file removed at process exit.
  const lock=path.join(String(m.R),'controller-operation.lock');
  fs.closeSync(fs.openSync(lock,'wx'));
  process.on('exit',()=>{try{fs.unlinkSync(lock);}catch{}});
  transport_journal(m);
  const reviewed=m.reviewed;
  const checked=scene=>{
    const [rr,r]=reviewed(scene);
    const p=r.buttonPreflight;
    ok(same(preflight(rr.snapshot,r.targetHwnd,p.x,p.y,r.visibleLabel),p),'button preflight differs');
    return [rr,r];
  };
  m.reviewed=checked;
  const mode=argv[0];
  // Unwind through intent's existing independent-release drain on TERM/INT.
  // Python raised SystemExit(128+signum) at the interrupted point; here the
  // next controller request raises it, and a finished operation still fails.
  let cancelled=null;
  const transport=m.call;
  m.call=(...args)=>{if(cancelled)throw new SystemExit(128+cancelled);return transport(...args);};
  for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{cancelled??=require('node:os').constants.signals[sig];});
  try{
    let rc;
    if(mode==='startup')await startup(m);
    else if(mode==='capture'){
      const ready=m.read('startup-ready.json');
      ok(ready.ready&&ready.passive&&same(ready.target,m.identity())&&ready.port===m.PORT,'startup readiness does not match this native invocation');
      await capture(m,argv[1]);
    }else if(mode==='review'){
      const [scene,description,label,kind,target,x,y]=argv.slice(1,8);
      ok(['install','quit'].includes(kind),'review kind');
      const rr=m.read(scene+'.json');ok(sha(fs.readFileSync(path.join(String(m.R),scene+'.png')))===rr.pngSHA256,'captured PNG differs');
      const p=preflight(rr.snapshot,target,int(x),int(y),label);
      m.save(scene+'-review.json',{at:m.time.time(),rawCompleteScene:true,observation:description,
        visibleLabel:label,kind,targetHwnd:target,pngSHA256:rr.pngSHA256,buttonPreflight:p});
    }else if(mode==='bind'){
      await m.reserve();
      if(local_expiry(m,argv[1]))rc=LOCAL_REFUSAL;
      else await m.bind(argv[1]);
    }else if(mode==='intent'){
      const [name,scene,x,y,kind]=argv.slice(1,6);const [,r]=checked(scene);
      ok(int(x)===r.buttonPreflight.x&&int(y)===r.buttonPreflight.y,'intent pointer differs from review');
      await m.intent(name,scene,int(x),int(y),kind);
    }else ok(false,'unsupported finite control operation');
    if(cancelled)throw new SystemExit(128+cancelled);
    return rc;
  }catch(e){m.fail('hl2-button-preflight',e);throw e;}
}
// Python int(): optional sign, digits, surrounding whitespace.
function int(s){ok(typeof s==='string'&&/^\s*[+-]?\d+\s*$/.test(s),'invalid literal for int(): '+s);return Number.parseInt(s,10);}

Object.assign(module.exports,{ROOT,LOCAL_REFUSAL,SystemExit,transport_journal,unbound_proof,local_expiry,
  verified_local_refusal,startup,capture,preflight,receipt_clock_body,compile_module,controller});
if(require.main===module){
  M.controller().then(rc=>{process.exitCode=rc??0;},e=>{
    if(e instanceof SystemExit||e?.name==='SystemExit')process.exitCode=e.exitCode;
    else{console.error(e);process.exitCode=1;}
  });
}
