#!/usr/bin/env node
'use strict';
/* Personal complete-scene reviews and single finite ordinary UI intents.

One permanent binding. UNKNOWN closes all later requests. Only proved local
image expiry before dispatch permits explicit fresh capture and review. An
independently prearmed release may finish its original cleanup. No replay.

Node port of the former tools/neverhood-original-current-control.py: same CLI,
environment (NEVERHOOD_CURRENT_RUN/NEVERHOOD_CURRENT_PORT), evidence files,
seconds-based timestamps and exit codes (3 = typed REFUSED_BEFORE_DISPATCH).
Module state (R, PORT) and every function live on module.exports and are
called through it, so a caller may substitute them exactly as the Python unit
tests did with module attributes. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const cp=require('node:child_process'),assert=require('node:assert'),{isDeepStrictEqual}=require('node:util');
const proc=require('./native-proc.cjs');
const M=module.exports;
const now=proc.now,sleep=proc.sleep;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const eq=(a,b)=>isDeepStrictEqual(a,b);
const exists=p=>fs.existsSync(p);
const J=n=>path.join(M.R,n);

const TIMING=[];
M.TIMING=TIMING;
M.phase=function phase(stage,detail={}){
  if(process.env.NEVERHOOD_CONFIRMATION_PHASES!=='1')return;
  // Diagnostic samples never supply or replace a policy clock or receipt.
  const wall=now(),mono=Number(process.hrtime.bigint()),cpu=Math.round(process.cpuUsage().user*1000+process.cpuUsage().system*1000);
  const sched=proc.schedstat();
  TIMING.push({phase:stage,pid:process.pid,at:wall,monotonicNs:mono,cpuNs:cpu,
    schedulerRunNs:sched?sched[0]:null,schedulerWaitNs:sched?sched[1]:null,...detail});
};
M.report_phases=function report_phases(){
  const rows=TIMING.filter(r=>r.pid===process.pid);
  if(rows.length)process.stdout.write('NEVERHOOD_CONFIRMATION_PHASES '+JSON.stringify(rows)+'\n');
};
M.R=process.env.NEVERHOOD_CURRENT_RUN?path.resolve(process.env.NEVERHOOD_CURRENT_RUN):null;
M.PORT=process.env.NEVERHOOD_CURRENT_PORT!==undefined?parseInt(process.env.NEVERHOOD_CURRENT_PORT,10):null;
M.ROOT_PORT=()=>{const l=M.read('launch.json');return l.rootPort??45761;};
M.owner_file=()=>exists(J('child-target.json'))&&M.PORT===M.read('child-target.json').port?'child-input-owner.json':'input-owner.json';
M.startup_file=()=>M.owner_file()==='child-input-owner.json'?'child-startup-ready.json':'startup-ready.json';
M.read=n=>JSON.parse(fs.readFileSync(J(n),'utf8'));
M.save=function save(n,v){
  M.phase('save-begin',{file:n});
  const target=J(n),pending=target+'.'+process.pid+'.pending';
  const fd=fs.openSync(pending,'wx');
  try{
    fs.writeSync(fd,JSON.stringify(v,null,2)+'\n');
    M.phase('save-fsync-begin',{file:n});fs.fsyncSync(fd);M.phase('save-fsync-end',{file:n});
  }finally{fs.closeSync(fd);}
  // Publish a complete file without overwriting any earlier record.
  fs.linkSync(pending,target);fs.unlinkSync(pending);
  M.phase('save-end',{file:n});
};
M.fail=function fail(name,e){
  if(!exists(J('PERMANENT-UNKNOWN.json')))M.save('PERMANENT-UNKNOWN.json',{name,error:String(e&&e.message!==undefined?e.message:e),at:now(),noLaterRequests:true});
};
/* Only an expired local image, before any publication by this operation. */
class RefusedBeforeDispatch extends Error{constructor(m){super(m);this.name='RefusedBeforeDispatch';}}
M.RefusedBeforeDispatch=RefusedBeforeDispatch;
const glob=suffix=>{try{return fs.readdirSync(M.R).filter(n=>n.endsWith(suffix)&&!n.startsWith('.'));}catch(e){if(e.code==='ENOENT')return [];throw e;}};
M.latest_refusal=()=>glob('-refused.json').reduce((a,n)=>Math.max(a,M.read(n).at),0);
M.publication_state=function publication_state(){
  const names=new Set();for(const s of ['-intent.json','-release-arm.json','-child-arm.json'])for(const n of glob(s))names.add(n);
  for(const name of names){
    if(name==='bind-intent.json'||name==='child-bind-intent.json'){
      assert(exists(J(name==='bind-intent.json'?'input-owner.json':'child-input-owner.json')),'pending bind intent');
    }else{
      const suffix=['-release-arm.json','-child-arm.json','-intent.json'].find(s=>name.endsWith(s));
      assert(exists(J(name.slice(0,-suffix.length)+'-completion.json')),'pending intent/arm');
    }
  }
  const ledger=J('requests.jsonl');
  return [exists(ledger)?fs.readFileSync(ledger):Buffer.alloc(0),[...names].sort()];
};
M.local_operation=function local_operation(){
  assert(!exists(J('PERMANENT-UNKNOWN.json')),'permanent UNKNOWN; no later requests');
  return {nonce:crypto.randomUUID(),publication:M.publication_state()};
};
M.refuse_expired=function refuse_expired(scene,rr,operation){
  assert(operation!=null&&eq(M.publication_state(),operation.publication),'publication prevents local refusal');
  assert(!exists(J('PERMANENT-UNKNOWN.json')),'permanent UNKNOWN; no recovery');
  const record={outcome:'REFUSED_BEFORE_DISPATCH',reason:'LOCAL_IMAGE_EXPIRED',at:now(),
    scene,captureId:rr.captureId,pngSHA256:rr.pngSHA256,invalidatedNonce:operation.nonce,
    reviewInvalidated:true,zeroTransport:true,zeroActionIntentArmPublication:true,
    recovery:'explicit fresh native whole-image capture and new personal review only'};
  M.save(scene+'-refused.json',record);
  throw new RefusedBeforeDispatch(JSON.stringify(record));
};
M.sourcecheck=function sourcecheck(){
  const manifest=M.read('runtime-inputs.json');
  const root=path.resolve(__dirname,'..');
  const pins=Object.fromEntries(manifest.sources.map(row=>[row.path,row.sha256]));
  for(const n of ['tools/neverhood-original-current-control.js','tools/neverhood-original-current-runtime.js'])
    assert(sha(fs.readFileSync(path.join(root,n)))===pins[n],'owned source changed: '+n);
};
M.reserve=function reserve(quit=false){
  assert(!exists(J('PERMANENT-UNKNOWN.json')),'permanent UNKNOWN; no later requests');
  M.sourcecheck();
  const launch=M.read('launch.json');assert(launch.gameplayCutoff===launch.deadline-launch.reserveSeconds);
  if(now()>=launch.gameplayCutoff||quit){
    if(!exists(J('quit-phase.json')))M.save('quit-phase.json',{at:now(),irreversible:true});
  }
  assert(now()+3<launch.deadline);
  return launch;
};
M.identity=function identity(){
  let info=M.read('native-pid.json');
  if(M.PORT!==M.ROOT_PORT()){
    const target=M.read('child-target.json');
    assert(target.authenticatedBeforeDeadline&&target.port===M.PORT);
    const directory=path.dirname(target.arm);
    assert(!exists(path.join(directory,'failure.json')),'child lifecycle failed');
    assert(!exists(path.join(directory,'child-dead.json'))&&!exists(path.join(directory,'child-wait.json')),'child already dead');
    info=target.child;
  }
  return M.listener_identity(info,M.PORT);
};
M.listener_identity=function listener_identity(info,port){
  assert(proc.token(info.pid)===info.startToken);
  assert(!['Z','X'].includes(proc.state(info.pid)),'dead process');
  if(info.bootId)assert(proc.bootId()===info.bootId);
  // Read TCP before FDs: a newly listening socket can enter both between
  // reads. The qualified ownership check must not reverse that ordering.
  const l=proc.listener(info.pid,port);
  assert(l.listeners===1&&l.owned);
  return info;
};
// One POST with an absolute budget (seconds). A timeout error says 'timed out'.
M.post=function post(port,command,timeout){
  return new Promise((resolve,reject)=>{
    const body=Buffer.from(JSON.stringify(command));let done=false;
    const finish=(f,v)=>{if(!done){done=true;clearTimeout(timer);f(v);}};
    const req=http.request({host:'127.0.0.1',port,path:'/ctl',method:'POST',agent:false,
      headers:{'Content-Type':'application/json','Content-Length':body.length}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));
      res.on('error',e=>finish(reject,e));
      res.on('end',()=>{
        if(res.statusCode<200||res.statusCode>=300)return finish(reject,Error('HTTP Error '+res.statusCode+': '+res.statusMessage));
        try{finish(resolve,JSON.parse(Buffer.concat(chunks).toString()));}catch(e){finish(reject,e);}
      });
      res.on('aborted',()=>finish(reject,Error('remote end closed connection without response')));
    });
    const timer=setTimeout(()=>{req.destroy();finish(reject,Error('timed out'));},Math.max(0,timeout*1000));
    req.on('error',e=>finish(reject,e));
    req.end(body);
  });
};
M.call=async function call(command,{timeout=1,cleanup=false,target=null,port=null}={}){
  M.phase('call-begin',{action:command.action});
  assert(!exists(J('PERMANENT-UNKNOWN.json')),'permanent UNKNOWN; no later requests');
  // The budget is absolute from entry: identity checks (ps/lsof off Linux)
  // spend it rather than extend the caller's deadline.
  const entered=now();
  if(target==null){M.identity();port=M.PORT;}
  else M.listener_identity(target,port);
  M.phase('call-identity-checked',{action:command.action});
  fs.appendFileSync(J('requests.jsonl'),JSON.stringify({at:now(),action:command.action??null,port,cleanup})+'\n');
  M.phase('http-begin',{action:command.action});
  const r=await M.post(port,command,timeout-(now()-entered));
  M.phase('http-end',{action:command.action});
  assert(r.ok,JSON.stringify(r));
  return r.value;
};
/* Passive public USER/ordinary actor readiness, before any capture clock. */
M.startup=async function startup(){
  try{
    const launch=M.reserve(),target=M.identity();
    assert(!exists(J(M.owner_file())),'startup cannot rebind an input owner');
    if(exists(J(M.startup_file()))){
      assert(eq(M.read(M.startup_file()).target,target));
      return;
    }
    const started=now(),deadline=Math.min(started+30,launch.gameplayCutoff);
    let polls=0;
    for(;;){
      const remaining=deadline-now();assert(remaining>0,'startup readiness UNKNOWN');
      const reply=await M.call({action:'native-startup-readiness'},{timeout:Math.min(1,remaining)});polls++;
      assert(reply.contract==='native-startup-readiness-v1');
      fs.appendFileSync(J('startup-polls.jsonl'),JSON.stringify({at:now(),ready:reply.ready,failures:reply.failures})+'\n');
      if(reply.ready){
        assert(!reply.failures.length&&reply.ordinaryOwner.healthy&&reply.ordinaryOwner.actorContext);
        assert(now()<deadline);
        M.save(M.startup_file(),{startedAt:started,completedAt:now(),deadline,
          target,port:M.PORT,polls,native:reply,separateFromCapture:true});
        return;
      }
      await sleep(Math.min(.01,Math.max(0,deadline-now()))*1000);
    }
  }catch(e){M.fail('startup',e);throw e;}
};
M.capture=async function capture(name){
  try{
    M.reserve();
    if(!exists(J(M.owner_file())))await M.startup();
    const target=M.identity(),at=now();
    const p=J(name+'.png');assert(!exists(p));
    let reply;
    for(;;){
      const remaining=at+3-now();assert(remaining>0,'initial presentation UNKNOWN');
      reply=await M.call({action:'native-presentation-capture',path:p},{timeout:remaining});
      if(reply.contract!=='native-presentation-pending-v1')break;
      assert(reply.pending);
      await sleep(Math.min(.005,Math.max(0,at+3-now()))*1000);
    }
    assert(now()-at<3);
    assert(reply.contract==='native-reviewed-context-v1');
    M.save(name+'.json',{at:reply.startedAt/1000,completedAt:reply.completedAt/1000,
      target,port:M.PORT,snapshot:reply.snapshot,image:reply,captureId:reply.captureId,
      pngSHA256:sha(fs.readFileSync(p))});
    process.stdout.write(p+'\n');
  }catch(e){M.fail(name,e);throw e;}
};
M.context=s=>Object.fromEntries(['mainHwnd','windows','modalHwnd','focus','focusTopLevel','focusWindow',
  'capture','physicalUp','nativeProcess','nativeMessageBox','screen'].map(k=>{assert(k in s,k);return [k,s[k]];}));
M.presented=function presented(s,actor=null){
  // DialogBox publishes its HWND before WM_INITDIALOG/ShowWindow finishes.
  // A changed USER graph is not yet a presented scene. Only defer observation;
  // never relax native capture validation or extend the original 3000ms bound.
  const modal=s.modalHwnd;
  if(modal==='0x0')return true;
  const matches=s.windows.filter(w=>w.hwnd===modal);
  if(matches.length!==1)return false;
  const w=matches[0];
  return Boolean(w.live&&w.visible&&!w.isChild&&
    (actor==null||['processId','threadId'].every(k=>w[k]===actor[k])));
};
M.button=function button(rr,r){
  const s=rr.snapshot;
  const matches=s.windows.filter(w=>w.hwnd===r.targetHwnd);
  assert(matches.length===1,'unique actual target required');
  const w=matches[0];
  assert(w.live&&w.visible&&w.generation&&w.processId&&w.threadId);
  assert(s.physicalUp&&s.capture==='0x0','capture or held physical input');
  if(r.drawnRegion!=null){
    const region=r.drawnRegion;
    assert(r.kind==='quit'&&r.visibleLabel==='Quit','explicit game-drawn Quit review required');
    assert(!w.isChild&&w.hwnd===s.mainHwnd&&s.modalHwnd==='0x0');
    assert(!(w.style&0x08000000),'disabled game window');
    assert(eq(region.binding,M.region_binding(rr,w)),'wrong actor/window/frame/provenance for region');
    const [x,y,width,height]=region.rect;
    assert([x,y,width,height].every(Number.isInteger)&&width>0&&height>0);
    assert(w.x<=x&&w.y<=y&&x+width<=w.x+w.w&&y+height<=w.y+w.h,'region outside game window');
  }else if(r.kind!=='game'||w.isChild){
    assert(w.isChild&&w.controlClass===1,'actual BUTTON child required');
    assert(!(w.style&0x08000000),'disabled BUTTON');
    assert(w.nativeTextAvailable===true&&w.textBytes!=null);
    const label=t=>t.replaceAll('&','').trim();
    assert(label(w.title)===label(r.visibleLabel),'BUTTON label differs');
    assert(w.parent!=='0x0'&&w.buttonFlags!=null);
  }
  return w;
};
M.region_binding=(rr,w)=>({captureId:rr.captureId,pngSHA256:rr.pngSHA256,nativeProcess:rr.snapshot.nativeProcess,
  window:Object.fromEntries(['hwnd','generation','processId','threadId'].map(k=>[k,w[k]]))});
M.review=function review(scene,description,label,kind,target,region=null){
  assert(!exists(J('PERMANENT-UNKNOWN.json')),'permanent UNKNOWN; no later review');
  assert(!exists(J(scene+'-refused.json')),'capture and review invalidated');
  const rr=M.read(scene+'.json');
  assert(rr.at>M.latest_refusal(),'fresh native capture required before a new review');
  assert(sha(fs.readFileSync(J(scene+'.png')))===rr.pngSHA256);
  const record={at:now(),rawCompleteScene:true,observation:description,
    visibleLabel:label,kind,targetHwnd:target,pngSHA256:rr.pngSHA256};
  if(region!=null){
    const w=rr.snapshot.windows.find(w=>w.hwnd===target);assert(w);
    record.drawnRegion={rect:[...region],binding:M.region_binding(rr,w)};
  }
  M.button(rr,record);
  M.save(scene+'-review.json',record);
};
M.reviewed=function reviewed(scene,operation=null,kind=null,point=null){
  assert(!exists(J(scene+'-refused.json')),'capture and review invalidated');
  const rr=M.read(scene+'.json'),r=M.read(scene+'-review.json');
  const freshness=r.kind==='game'?15:30;
  assert(eq(rr.target,M.identity())&&rr.port===M.PORT&&r.rawCompleteScene&&r.observation&&r.visibleLabel);
  assert(r.pngSHA256===rr.pngSHA256&&rr.pngSHA256===sha(fs.readFileSync(J(scene+'.png'))));
  const w=M.button(rr,r);
  if(kind!=null)assert(r.kind===kind,'review kind differs');
  if(point!=null&&point[0]!==-1){
    const [x,y]=point;
    assert(w.x<=x&&x<w.x+w.w&&w.y<=y&&y<w.y+w.h,'point outside reviewed target');
    if(r.drawnRegion!=null){
      const [rx,ry,rw,rh]=r.drawnRegion.rect;
      assert(rx<=x&&x<rx+rw&&ry<=y&&y<ry+rh,'point outside reviewed drawn region');
    }
  }
  if(r.drawnRegion!=null)assert(point==null||point[0]!==-1,'drawn Quit requires mouse input');
  const latest=M.latest_refusal();
  if(latest)assert(rr.at>latest&&r.at>=rr.completedAt,'fresh capture and new review required');
  const age=now()-rr.at,review_age=now()-r.at;
  assert(age>=0&&review_age>=0,'invalid image/review clock');
  if(age>=freshness)M.refuse_expired(scene,rr,operation);
  assert(review_age<freshness,'review expired');
  return [rr,r];
};
M.native_review=function native_review(rr,r){
  const result={contract:'native-reviewed-context-v1',captureId:rr.captureId,pngSHA256:rr.pngSHA256,
    reviewed:true,reviewedAt:r.at*1000,scope:r.kind==='game'?'game':'menu',targetHwnd:r.targetHwnd};
  if(r.drawnRegion!=null)result.drawnRegion=r.drawnRegion;
  return result;
};
M.bind=async function bind(scene){
  try{
    const operation=M.local_operation();
    M.reserve();assert(!exists(J(M.owner_file())));
    const [rr,r]=M.reviewed(scene,operation);
    M.save(M.PORT===M.ROOT_PORT()?'bind-intent.json':'child-bind-intent.json',{scene,at:now(),permanent:true});
    const reply=await M.call({action:'guarded-bind',reviewedScene:M.native_review(rr,r)});
    M.save(M.owner_file(),reply);
  }catch(e){
    if(e instanceof RefusedBeforeDispatch)throw e;
    M.fail('bind',e);throw e;
  }
};
M.release=async function release(name,owner,due,deadline=null){
  assert(!exists(J('PERMANENT-UNKNOWN.json')),'permanent UNKNOWN; no later requests');
  const latest=M.latest_refusal();
  if(latest)assert(M.read(name+'-intent.json').at>latest,'fresh reviewed intent required before release');
  deadline=deadline==null?due+.35:deadline;
  process.stdout.write(JSON.stringify({armed:true,pid:process.pid,due})+'\n');
  while(now()<due){
    const p=J(name+'-up-at.json');
    if(exists(p)){
      try{due=Math.min(due,M.read(path.basename(p)).at);}catch{} // Original finite fallback remains armed.
    }
    await sleep(Math.min(.003,Math.max(0,due-now()))*1000);
  }
  try{
    const sent=now(),remaining=deadline-sent;assert(remaining>0,'physical UP deadline');
    const reply=await M.call({action:'guarded-release',owner},{timeout:remaining,cleanup:true});
    assert(now()<deadline,'physical UP deadline');
    M.save(name+'-up.json',{at:now(),sentAt:sent,monotonic:proc.monotonic(),reply,physicalUpACK:reply.released===true});
  }catch(e){
    // An observed OS owner exit explains a failed release, never proves
    // physical UP. Read only already-published waits; do not probe a dead
    // endpoint or turn its absence into an acknowledgement.
    let exited=null;
    try{
      if(M.PORT===M.ROOT_PORT()){
        const wait=M.read('native-wait.json'),target=M.read('native-pid.json');
        if(wait.pid===target.pid&&['actualWait','stdoutEOF','stderrEOF'].every(k=>wait[k]))exited=wait;
      }else{
        const target=M.read('child-target.json'),directory=path.dirname(target.arm);
        const wait=JSON.parse(fs.readFileSync(path.join(directory,'child-wait.json'),'utf8'));
        if(eq(wait.child,target.child)&&['actualWait','stdoutEOF','stderrEOF'].every(k=>wait[k]))exited=wait;
      }
    }catch{}
    M.save(name+'-up.json',{at:now(),error:String(e.message??e),physicalUpACK:false,
      outcome:exited?'OWNER_EXITED':'RELEASE_FAILED',ownerWait:exited});
    throw e;
  }
};
/* Independent process: the prearmed release owns its own clock and transport.
Python forked here; Node spawns this same file in 'armed-release' mode. Keep
actual exit and pipe EOF evidence, with the same absolute deadlines. */
class ArmedRelease{
  constructor(name,owner,due,deadline){
    this.process=cp.spawn(process.execPath,[__filename,'armed-release',name,owner,String(due),String(deadline)],
      {env:{...process.env,NEVERHOOD_CURRENT_RUN:M.R,NEVERHOOD_CURRENT_PORT:String(M.PORT)},stdio:['ignore','pipe','pipe']});
    this.pid=this.process.pid;this.returncode=null;this.result=null;
    this.out=[];this.err=[];this.lineWaiters=[];this.buffered=Buffer.alloc(0);this.firstLine=null;
    this.process.stdout.on('data',b=>{
      if(this.firstLine===null){
        this.buffered=Buffer.concat([this.buffered,b]);const i=this.buffered.indexOf(10);
        if(i<0)return;
        this.firstLine=this.buffered.subarray(0,i+1).toString();this.out.push(this.buffered.subarray(i+1));
        for(const w of this.lineWaiters)w();
      }else this.out.push(b);
    });
    this.process.stderr.on('data',b=>this.err.push(b));
    this.closed=new Promise(r=>this.process.once('close',(code,signal)=>{this.returncode=code??(signal?-require('node:os').constants.signals[signal]:null);r();}));
  }
  // The first stdout line is the arm record; refuse a release not armed in time.
  async armed(seconds){
    if(this.firstLine===null)await Promise.race([new Promise(r=>this.lineWaiters.push(r)),sleep(seconds*1000),this.closed]);
    assert(this.firstLine!==null,'release was not prearmed');
    return JSON.parse(this.firstLine);
  }
  async communicate(timeout=null){
    if(this.result)return this.result;
    if(timeout!=null){
      const finished=await Promise.race([this.closed.then(()=>true),sleep(timeout*1000).then(()=>false)]);
      if(!finished){const e=Error('independent physical release timed out after '+timeout+' seconds');e.name='TimeoutExpired';throw e;}
    }else await this.closed;
    if(this.firstLine===null&&this.buffered.length)this.out.unshift(this.buffered);
    this.result=[Buffer.concat(this.out),Buffer.concat(this.err)];
    return this.result;
  }
  kill(){try{this.process.kill('SIGKILL');}catch{}}
}
M.ArmedRelease=ArmedRelease;
M.child_records=function child_records(arm){
  assert(!exists(J('PERMANENT-UNKNOWN.json')),'permanent UNKNOWN; no later observation');
  const directory=arm.directory,f=n=>path.join(directory,n),load=n=>JSON.parse(fs.readFileSync(f(n),'utf8'));
  assert(eq(load('armed.json'),arm));
  assert(!exists(f('failure.json')),'child lifecycle failed');
  assert(!exists(f('child-dead.json'))&&!exists(f('child-wait.json')),'child already dead');
  const parent=exists(f('parent-exit.json'))?load('parent-exit.json'):null;
  if(parent)assert(parent.token===arm.token&&eq(parent.parent,arm.parent)&&parent.exitCode===0,'parent failure');
  if(!['spawned.json','ready.json'].every(n=>exists(f(n))))return null;
  const spawned=load('spawned.json'),ready=load('ready.json');
  for(const row of [spawned,ready]){
    assert(row.contract===arm.contract&&row.token===arm.token&&eq(row.parent,arm.parent));
    assert(row.guestExe===arm.guestExe&&arm.armedAt<=row.at&&row.at<arm.deadline,'late/wrong child');
  }
  assert(eq(spawned.inputs,arm.inputs));
  assert(eq(ready.child,spawned.child)&&ready.child.pid!==arm.parent.pid);
  assert(ready.port===arm.port);
  assert(eq(ready.inputs,{...arm.inputs,executableSHA256:arm.executableSHA256}),'child source/module mismatch');
  M.listener_identity(ready.child,ready.port);
  return [ready,parent];
};
M.observe_child=async function observe_child(name,arm,start){
  for(;;){
    assert(now()<start+3,'child observation UNKNOWN');
    const records=M.child_records(arm);
    if(!records){await sleep(3);continue;}
    const [ready,parent]=records;
    const reply=await M.call({action:'native-child-attest',token:arm.token,nonce:arm.nonce},
      {timeout:Math.max(.001,start+3-now()),target:ready.child,port:ready.port});
    assert(reply.contract===arm.contract&&reply.token===arm.token&&reply.nonce===arm.nonce);
    assert(eq(reply.child,ready.child)&&eq(reply.inputs,ready.inputs));
    const native=reply.readiness,s=native.snapshot;
    assert(eq(s.nativeProcess,{pid:ready.child.pid,executable:arm.guestExe}));
    if(!native.ready){await sleep(3);continue;}
    assert(!native.failures.length&&native.ordinaryOwner.healthy&&native.ordinaryOwner.actorContext,'wrong child actor');
    if(parent==null){await sleep(3);continue;}
    const image=J(name+'-after.png');
    const cap=await M.call({action:'native-presentation-capture',path:image},
      {timeout:Math.max(.001,start+3-now()),target:ready.child,port:ready.port});
    if(cap.contract==='native-presentation-pending-v1'){
      assert(cap.pending);await sleep(3);continue;
    }
    assert(cap.contract==='native-reviewed-context-v1'&&cap.snapshot.physicalUp);
    assert(eq(cap.snapshot.nativeProcess,s.nativeProcess));
    assert(now()<start+3);
    M.child_records(arm); // A child/parent failure during capture is terminal too.
    const digest=sha(fs.readFileSync(image));
    M.save('child-target.json',{contract:arm.contract,child:ready.child,port:ready.port,
      inputs:ready.inputs,authenticatedBeforeDeadline:true,at:now(),deadline:start+3,
      arm:path.join(arm.directory,'armed.json'),token:arm.token,parentExit:parent});
    M.save(name+'-after.json',{at:cap.startedAt/1000,completedAt:cap.completedAt/1000,
      target:ready.child,port:ready.port,snapshot:cap.snapshot,image:cap,captureId:cap.captureId,pngSHA256:digest});
    M.save(name+'-observation.json',{at:now(),authenticatedChild:true,child:ready,
      parentExit:parent,attestation:reply,image:cap,pngSHA256:digest,noPostInputParentSnapshot:true});
    return;
  }
};
M.intent=async function intent(name,scene,x,y,kind,handoff=null){
  let child=null;
  try{
    const operation=M.local_operation();
    const launch=M.reserve(kind==='quit');
    assert(['install','game','quit'].includes(kind));
    if(kind!=='quit')assert(!exists(J('quit-phase.json'))&&now()+3<launch.gameplayCutoff);
    assert(!exists(J('PERMANENT-UNKNOWN.json')));
    const owner=M.read(M.owner_file());
    const [rr,r]=M.reviewed(scene,operation,kind,[x,y]);
    const nonce=operation.nonce,start=now();
    // The retained personally reviewed full image is immutable. Native
    // verification checks every public semantic control, not repaint bytes.
    const w=M.button(rr,r);
    if(x!==-1)assert(w.x<=x&&x<w.x+w.w&&w.y<=y&&y<w.y+w.h,'point outside reviewed target');
    const command=x===-1?`keydown:${y}`:`mousedown:${x}:${y}`;
    M.save(name+'-intent.json',{scene,x,y,kind,owner,nonce,
      at:start,confirmationDeadline:start+.5,physicalUpDeadline:start+1.75,observationDeadline:start+3});
    child=new ArmedRelease(name,owner.owner,start+1.4,start+1.75);
    const arm=await child.armed(.15);M.save(name+'-release-arm.json',arm);assert(arm.armed);
    if(handoff){
      assert(M.PORT===M.ROOT_PORT()&&!exists(J('child-target.json')),'one ordinary launcher handoff only');
      const [guestExe,exeHash]=handoff;
      handoff=await M.call({action:'native-child-arm',owner:owner.owner,epoch:owner.epoch,identity:owner.identity,
        reviewedScene:M.native_review(rr,r),nonce,deadline:Math.trunc((start+3)*1000),
        releaseDeadline:Math.trunc((start+1.75)*1000),directory:J(name+'-child-lifecycle'),
        guestExe,executableSHA256:exeHash,port:launch.childPort},{timeout:Math.max(.001,start+.5-now())});
      M.save(name+'-child-arm.json',handoff);
    }
    M.reserve(kind==='quit');assert(now()<start+.5);
    const fresh=(kind==='game'?15:30);
    const receipt=await M.call({action:'guarded-input',cmd:command,guard:{...owner,nonce,
      reviewed:true,intent:{review:M.native_review(rr,r)},
      deadline:Math.trunc(Math.min(start+.5,Math.min(rr.at,r.at)+fresh)*1000)}},{timeout:Math.max(.001,start+.5-now())});
    M.phase('input-reply',{name,start});
    M.save(name+'-down.json',{at:now(),receipt});
    M.phase('confirmation-check',{name,start});
    assert(now()<start+.5&&receipt.state==='CONSUMED'&&receipt.consumed,'confirmation UNKNOWN');
    assert(Object.entries({owner:owner.owner,epoch:owner.epoch,nonce}).every(([k,v])=>receipt[k]===v));
    assert(start*1000<=receipt.consumedAt&&receipt.consumedAt<Math.min((start+.5)*1000,(Math.min(rr.at,r.at)+fresh)*1000),'late consumption');
    if(receipt.receiptBoundary==='native-button-dispatch-return'){
      const native=receipt.nativeMessage;
      assert(native.hwnd===parseInt(w.hwnd,16)&&String(native.generation)===String(w.generation));
      assert(native.processId===w.processId&&native.threadId===w.threadId);
    }
    if(r.drawnRegion!=null){
      assert(receipt.receiptBoundary==='native-input-return','native USER consumption required');
      const native=receipt.nativeMessage;
      assert(native.consumption==='owner-user-return'&&native.token>0&&native.nonce===nonce);
      assert(native.hwnd===parseInt(w.hwnd,16)&&native.threadId===w.threadId&&native.msg===0x201);
    }
    M.save(name+'-up-at.json',{at:receipt.consumedAt/1000+.1});
    const [out,err]=await child.communicate(Math.max(.001,start+1.75-now()));
    M.save(name+'-release-wait.json',{pid:child.pid,exit:child.returncode,actualWait:true,stdoutEOF:true,stderrEOF:true,stdout:out.toString(),stderr:err.toString()});
    const up=M.read(name+'-up.json');assert(child.returncode===0&&up.physicalUpACK&&up.at<start+1.75);
    assert(up.reply.owner===owner.owner&&receipt.consumedAt/1000<=up.sentAt&&up.sentAt<=up.at);
    if(handoff)await M.observe_child(name,handoff,start);
    // Acknowledgement proves input consumption only. Observe a later scene.
    // Observe the actual transition immediately. There is no minimum
    // completion delay: 3000ms bounds the entire intent and its evidence.
    while(!handoff){
      assert(now()<start+3,'aggregate observation UNKNOWN');
      if(M.PORT!==M.ROOT_PORT()&&kind==='quit'){
        const target=M.read('child-target.json'),directory=path.dirname(target.arm);
        assert(!exists(path.join(directory,'failure.json')),'child native failure');
        if(exists(path.join(directory,'child-wait.json'))){
          const wait=JSON.parse(fs.readFileSync(path.join(directory,'child-wait.json'),'utf8'));
          const guest=JSON.parse(fs.readFileSync(path.join(directory,'child-exit.json'),'utf8'));
          let rows=[];try{rows=fs.readdirSync(J('children')).filter(n=>n.endsWith('-wait.json')).map(n=>JSON.parse(fs.readFileSync(path.join(J('children'),n),'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}
          rows=rows.filter(r=>r.pid===target.child.pid);
          assert(eq(wait.child,target.child)&&wait.exit===0&&wait.signal==null);
          assert(['actualWait','stdoutEOF','stderrEOF'].every(k=>wait[k]));
          assert(eq(guest.child,target.child)&&guest.token===target.token&&guest.exitCode===0);
          assert(up.monotonic<=guest.atExitMono);
          if(rows.length===1&&['actualWait','stdoutEOF','stderrEOF','closed'].every(k=>rows[0][k])){
            assert(rows[0].exit===0&&rows[0].signal==null);
            M.save(name+'-observation.json',{at:now(),nativeChildWait:rows[0],nativeChildExit:guest,noPostExitRequest:true});break;
          }
        }
        await sleep(5);continue;
      }
      if(exists(J('native-wait.json'))){
        const native=M.read('native-wait.json');assert(kind==='quit'&&native.actualWait&&native.exit===0);
        assert(native.stdoutEOF&&native.stderrEOF&&native.signal==null,'native exit not settled');
        const info=M.read('native-pid.json');
        if(info.invocationToken){
          const guest=M.read('native-exit.json');
          assert(!exists(J('native-exit.json.cancelled')));
          assert(guest.contract==='native-process-exit-v1'&&guest.exitCode===0);
          assert(['pid','startToken','invocationToken','bootId'].every(k=>eq(guest[k],info[k])&&eq(info[k],native[k])));
          assert(up.monotonic<=guest.atExitMono&&guest.atExitMono<=native.atWaitMono);
        }
        M.save(name+'-observation.json',{at:now(),nativeWait:native,noPostExitRequest:true});
        break;
      }
      if(kind==='quit'){await sleep(5);continue;} // Quit is proved by parent wait, never a request to a retiring endpoint.
      if(!proc.exists(M.read('native-pid.json').pid)){await sleep(5);continue;} // Parent still drains pipes/publishes its actual wait.
      const after=await M.call({action:'snapshot'},{timeout:Math.max(.001,start+3-now())});
      if(after.physicalUp&&!M.presented(after,w)){
        if(!exists(J(name+'-pending-presentation.json')))
          M.save(name+'-pending-presentation.json',{at:now(),snapshot:after,originalObservationDeadline:start+3});
        await sleep(5);continue;
      }
      if(after.physicalUp&&(kind==='game'||!eq(M.context(after),M.context(rr.snapshot)))){
        const image=J(name+'-after.png');
        const cap=await M.call({action:'native-presentation-capture',path:image},{timeout:Math.max(.001,start+3-now())});
        if(cap.contract==='native-presentation-pending-v1'){
          assert(cap.pending);
          if(!exists(J(name+'-atomic-pending.json')))
            M.save(name+'-atomic-pending.json',{at:now(),reply:cap,originalObservationDeadline:start+3});
          await sleep(5);continue;
        }
        assert(cap.contract==='native-reviewed-context-v1'&&cap.snapshot.physicalUp);
        M.save(name+'-observation.json',{at:now(),snapshot:after,image:cap,pngSHA256:sha(fs.readFileSync(image))});break;
      }
      await sleep(5);
    }
    assert(now()<start+3);
    M.save(name+'-completion.json',{at:now(),elapsedMs:(now()-start)*1000,limitsMs:{confirmation:500,physicalUp:1750,aggregate:3000}});
    assert(now()<start+3);
    process.stdout.write(JSON.stringify({completedAt:now(),elapsedMs:(now()-start)*1000,
      durableEvidencePublished:true,aggregateGuardPassed:true})+'\n');
    assert(now()<start+3);
  }catch(e){
    if(e instanceof RefusedBeforeDispatch)throw e;
    try{
      if(child){
        let out,err;
        try{[out,err]=await child.communicate(2);}
        catch(t){if(t.name!=='TimeoutExpired')throw t;child.kill();[out,err]=await child.communicate();}
        if(!exists(J(name+'-release-wait.json')))M.save(name+'-release-wait.json',{pid:child.pid,exit:child.returncode,actualWait:true,stdoutEOF:true,stderrEOF:true,stdout:out.toString(),stderr:err.toString()});
      }
    }finally{
      // Drain the prearmed finite physical release BEFORE publishing the
      // terminal latch. Once UNKNOWN is visible even cleanup cannot request.
      M.fail(name,e);
    }
    throw e;
  }
};
M.main=async function main(argv=process.argv.slice(1)){
  const mode=argv[1],a=argv;
  if(mode==='startup')await M.startup();
  else if(mode==='capture')await M.capture(a[2]);
  else if(mode==='review')M.review(...a.slice(2,7));
  else if(mode==='review-drawn-quit'){
    const [scene,description,target,x,y,w,h]=a.slice(2,9);
    M.review(scene,description,'Quit','quit',target,[x,y,w,h].map(v=>parseInt(v,10)));
  }else if(mode==='drawn-quit'){
    const [scene,description,target,rx,ry,rw,rh,name,x,y]=a.slice(2,12);
    M.review(scene,description,'Quit','quit',target,[rx,ry,rw,rh].map(v=>parseInt(v,10)));
    if(!exists(J(M.owner_file())))await M.bind(scene);
    await M.intent(name,scene,parseInt(x,10),parseInt(y,10),'quit');
  }else if(mode==='bind')await M.bind(a[2]);
  else if(mode==='intent')await M.intent(a[2],a[3],parseInt(a[4],10),parseInt(a[5],10),a[6]);
  else if(mode==='review-intent'){
    const [scene,description,label,kind,target,name,x,y]=a.slice(2,10);
    M.review(scene,description,label,kind,target);
    if(!exists(J(M.owner_file())))await M.bind(scene);
    await M.intent(name,scene,parseInt(x,10),parseInt(y,10),kind);
  }else if(mode==='play-handoff'){
    const [scene,description,label,kind,target,name,x,y,guestExe,exeHash]=a.slice(2,12);
    M.review(scene,description,label,kind,target);
    if(!exists(J(M.owner_file())))await M.bind(scene);
    await M.intent(name,scene,parseInt(x,10),parseInt(y,10),kind,[guestExe,exeHash]);
  }else if(mode==='release')await M.release(a[2],a[3],parseFloat(a[4]));
  else if(mode==='armed-release'){
    // The prearmed independent release process (Python: forked ArmedRelease).
    try{await M.release(a[2],a[3],parseFloat(a[4]),parseFloat(a[5]));}
    catch(e){process.stderr.write((e&&e.stack||String(e))+'\n');process.exitCode=1;}
  }
};
if(require.main===module){
  M.main().catch(e=>{
    if(e instanceof RefusedBeforeDispatch){process.stdout.write(e.message+'\n');process.exitCode=3;}
    else{process.stderr.write((e&&e.stack||String(e))+'\n');process.exitCode=1;}
  }).finally(()=>M.report_phases());
}
