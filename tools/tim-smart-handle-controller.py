"""Finite, personally reviewed TIM input policy. No puzzle interpretation.

This module only admits one gesture against one immutable complete capture.
It neither discovers coordinates nor imports a guest or changes game state.
Runtime qualification and a published route are required before original use.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import time
import uuid

# Host-only engine installed in run-dos's existing controller injection point.
# Its adapter is the released renderer/LiveRun input adapter, never guest memory.
# A separate movement handback precedes DOWN, so native hover handling executes.
ENGINE_JS = r'''
const fs=require('fs'), path=require('path'), crypto=require('crypto'), cp=require('child_process');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bind=s=>Object.fromEntries(['session','targetId','programId','frameId','digest'].map(k=>[k,s[k]]));
const imageHash=f=>sha(Buffer.concat([Buffer.from(JSON.stringify([f.width,f.height,f.text])),Buffer.from(f.rgba)]));
const immutable=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const GUARD_JS=String.raw`
const fs=require('fs'),net=require('net');
const [socketPath,expiry,dir,supervisor]=process.argv.slice(1);let active=null,timer=null,killTimer=null,seq=0,owner=null,birth=null,peer=null,closed=false;
const log=e=>fs.writeFileSync(dir+'/guard-'+String(++seq).padStart(4,'0')+'.json',JSON.stringify({...e,at:Date.now(),pid:process.pid})+'\n',{flag:'wx'});
const alive=()=>{try{return fs.readFileSync('/proc/'+owner+'/stat','utf8').split(') ')[1].split(' ')[19]===birth}catch{return false}};
const ownedNative=()=>{try{const v=JSON.parse(fs.readFileSync(dir+'/native-start.json','utf8'));return fs.readFileSync('/proc/'+v.pid+'/stat','utf8').split(') ')[1].split(' ')[19]===v.startToken?v.pid:null}catch{return null}};
const kill=()=>{const pid=ownedNative();log({kind:'KILL',ownerAlive:alive(),ownedNativePID:pid});if(pid)try{process.kill(-pid,'SIGKILL')}catch{}process.exit(0)};
const life=setTimeout(kill,Math.max(0,+expiry-Date.now()));
const send=m=>peer.write(JSON.stringify(m)+'\n');
const server=net.createServer(s=>{
 if(peer)return s.destroy();peer=s;let buffer='';
 s.on('data',b=>{buffer+=b.toString();let n;while((n=buffer.indexOf('\n'))>=0){const m=JSON.parse(buffer.slice(0,n));buffer=buffer.slice(n+1);message(m)}});
 s.on('close',()=>{if(!closed){log({kind:'NATIVE_DISCONNECT',ownerAlive:alive()});kill()}});
});
server.listen(socketPath,()=>{
 fs.writeFileSync(dir+'/deadline-armed.json',JSON.stringify({pid:process.pid,supervisor:+supervisor,deadline:+expiry,armedBeforeNativeLaunch:true})+'\n',{flag:'wx'});
});
let forced=false;
setInterval(()=>{if(owner&&!alive())return kill();if(!forced&&(osParentLost()||fs.existsSync(dir+'/cancel.json'))){forced=true;log({kind:'SUPERVISOR_LOST_OR_CANCEL'});if(peer)send({kind:'UP',nonce:active?.nonce});setTimeout(kill,200)}},25).unref();
function osParentLost(){return process.ppid!==+supervisor}
function message(m){
 if(m.kind==='HELLO'){
  if(owner)return kill();const expected=JSON.parse(fs.readFileSync(dir+'/native-start.json','utf8'));
  if(m.pid!==expected.pid||m.birth!==expected.startToken||m.deadline>+expiry||m.deadline>Date.now()+900000)return kill();
  owner=m.pid;birth=m.birth;log({kind:'READY',owner,expiry:+expiry});send({kind:'READY'});return;
 }
 if(!owner||!alive())return kill();
 if(m.kind==='ARM'){
  if(active||m.deadline>Date.now()+1750||m.deadline>+expiry||m.deadline<=Date.now())return kill();
  active=Object.freeze({...m});log({kind:'ARM',nonce:m.nonce,deadline:m.deadline});
  timer=setTimeout(()=>{log({kind:'INDEPENDENT_UP',nonce:m.nonce});send({kind:'UP',nonce:m.nonce});killTimer=setTimeout(kill,200)},Math.max(0,m.deadline-Date.now()));
  send({kind:'ARMED',nonce:m.nonce,deadline:m.deadline});
 }else if(m.kind==='RELEASED'){
  if(!active||m.nonce!==active.nonce)return kill();
  clearTimeout(timer);clearTimeout(killTimer);log({kind:'RELEASED',nonce:m.nonce});active=null;send({kind:'RELEASED',nonce:m.nonce});
 }else if(m.kind==='CLOSE'){
  if(active||Date.now()>=+expiry)return kill();closed=true;clearTimeout(life);log({kind:'CLOSE'});send({kind:'CLOSED'});peer.end();server.close();
 }
}
`;
async function createFiniteEngine({directory,session,deadline,review,observe,at=0,cadenceMs=180,independentUpMs=1750}){
 if(!Number.isInteger(independentUpMs)||independentUpMs<1||independentUpMs>1750)throw Error('independent UP bound');
 const dir=path.resolve(directory);const record=(n,v)=>immutable(path.join(dir,n+'.json'),v);
 const birth=fs.readFileSync('/proc/'+process.pid+'/stat','utf8').split(') ')[1].split(' ')[19];
 const net=require('net'),EventEmitter=require('events');const guard=new EventEmitter();guard.connected=true;guard.exitCode=null;guard.signalCode=null;
 const wire=net.createConnection(process.env.TIM_GUARD_SOCKET);let wireBuffer='';
 guard.send=m=>wire.write(JSON.stringify(m)+'\n');
 wire.on('connect',()=>guard.send({kind:'HELLO',pid:process.pid,birth,deadline}));
 wire.on('data',b=>{wireBuffer+=b.toString();let n;while((n=wireBuffer.indexOf('\n'))>=0){const m=JSON.parse(wireBuffer.slice(0,n));wireBuffer=wireBuffer.slice(n+1);guard.emit('message',m)}});
 wire.on('error',e=>guard.emit('exit',null,e.message));
 const guardClosed=new Promise(resolve=>wire.on('close',()=>{guard.connected=false;guard.exitCode=0;guard.emit('exit',0,null);record('guard-socket-close',{at:Date.now(),socketEOF:true,actualChildWait:'supervisor-owned'});resolve()}));
 let seq=0,phase='STARTING',target=null,programId=null,targetId=crypto.randomUUID(),held=false,releaseAttempted=false;
 let active=null,command=null,changedAt=0,next=0,unknown=null,upProgress=0,recoveryFrom=null;
 const pending=[];
 const wait=(kind,nonce)=>new Promise((resolve,reject)=>{const w={kind,nonce,resolve,reject};pending.push(w);w.timer=setTimeout(()=>{reject(Error('guard ACK timeout '+kind))},1000)});
 const ready=wait('READY');
 const fail=e=>{if(!unknown){unknown=String(e.message||e);if(!fs.existsSync(path.join(dir,'UNKNOWN.json')))record('UNKNOWN',{reason:unknown,at:Date.now(),irreversible:true})}phase='UNKNOWN';return e};
 const release=()=>{if(!held)return;if(releaseAttempted)throw Error('release already attempted');releaseAttempted=true;let e;try{target.releaseKeys()}catch(x){e=x}try{target.releaseMouse()}catch(x){e||=x}if(e)throw e;held=false;record('up-'+active.nonce,{at:Date.now(),progress:target.progress(),nativeInputPath:true})};
 guard.on('message',m=>{
  if(m.kind==='UP'){try{release()}catch(e){fail(e)}fail(Error('independent UP expired; no replay'))}
  for(const w of [...pending])if(w.kind===m.kind&&(w.nonce===undefined||w.nonce===m.nonce)){clearTimeout(w.timer);pending.splice(pending.indexOf(w),1);w.resolve(m)}
 });
 guard.on('exit',(c,s)=>{for(const w of pending.splice(0)){clearTimeout(w.timer);w.reject(Error('guard lost '+c+'/'+s))}});
 await ready;record('guard-start',{owner:process.pid,deadline,upMs:independentUpMs,prearmedBeforeInput:true,directWatchdogWait:'supervisor-owned'});phase='READY';
 const check=()=>{if(unknown||Date.now()>=deadline||guard.exitCode!==null||guard.signalCode!==null)throw fail(Error(unknown||'native deadline/guard lost'))};
 const snapshot=()=>{if(held)throw fail(Error('capture while held refused'));const f=target.capture();const id=target.programIdentity();if(programId!==id){programId=id;targetId=crypto.randomUUID()}return Object.freeze({...bind({session,targetId,programId}),frameId:crypto.randomUUID(),digest:imageHash(f),capturedAt:Date.now(),deadline,admission:Object.freeze({phase,held,delivery:'NONE',token:crypto.randomUUID(),recoveryFrom}),progress:target.progress(),width:f.width,height:f.height,text:f.text,rgba:Buffer.from(f.rgba)})};
 const matches=(s,c)=>['session','targetId','programId','frameId','digest'].every(k=>s[k]===c[k]);
 const arm=async()=>{active={nonce:command.nonce,deadline:Math.min(deadline,Date.now()+independentUpMs)};const ack=wait('ARMED',active.nonce);guard.send({kind:'ARM',...active});await ack;check();record('arm-'+active.nonce,{...active,at:Date.now()})};
 const disarm=async()=>{const ack=wait('RELEASED',active.nonce);guard.send({kind:'RELEASED',nonce:active.nonce});await ack;active=null};
 return Object.freeze({persistent:true,at,
  get ready(){return phase==='READY'&&Date.now()>=next},get awaitingExecution(){return ['PREMOVE','HELD','HOVER','RELEASED'].includes(phase)},get done(){return ['STOPPED','UNKNOWN'].includes(phase)},
  get result(){return {status:phase,held,failure:unknown,deadline,actions:seq}},check,
  async act(a){try{
   check();if(held)throw Error('capture while held refused');if(phase!=='READY')throw Error('review while input pending');command=null;recoveryFrom=null;if(target&&target!==a)throw Error('adapter changed');target=a;if(!a.ownsTarget())throw Error('target lost');phase='REVIEWING';
   let s=snapshot();command=await review(s,refusal=>{
    check();if(phase!=='REVIEWING'||held||active||command)throw Error('not positively all-unsent');
    if(refusal){
     if(refusal.status!=='REFUSED_UNSENT'||!matches(s,refusal)||refusal.token!==s.admission.token||refusal.delivery!=='NONE')throw Error('invalid unsent refusal');
     const decision=JSON.parse(fs.readFileSync(path.join(dir,'decision-'+s.frameId+'.json'),'utf8'));
     if(JSON.stringify(decision)!==JSON.stringify(refusal)||fs.existsSync(path.join(dir,'command-'+s.frameId+'.json')))throw Error('written or conflicting intent');
     record('unsent-confirmed-'+refusal.refusalId,{refusalId:refusal.refusalId,frameId:s.frameId,token:s.admission.token,zeroSend:true,at:Date.now()});
     recoveryFrom=refusal.refusalId;
    }
    s=snapshot();return s;
   });check();
   if(!matches(s,command)||!a.ownsTarget()||a.programIdentity()!==s.programId||a.progress()!==s.progress||imageHash(a.capture())!==s.digest)throw Error('binding/capture/ownership changed');
   if(!command.nonce||fs.existsSync(path.join(dir,'consumed-'+command.nonce+'.json')))throw Error('duplicate nonce');
   const q=command.action;const max=command.review?.mode==='game'?5000:30000;
   if(Date.now()-s.capturedAt>max)throw Error('review expired');
   if(q.holdMs!==undefined&&(!Number.isInteger(q.holdMs)||q.holdMs<1||q.holdMs>=1500))throw Error('hold bound');
   if(!['click','drag','hover','key','wait','stop'].includes(q.kind))throw Error('gesture kind');
   for(const xy of q.kind==='drag'?[[q.x,q.y],[q.toX,q.toY]]:['click','hover'].includes(q.kind)?[[q.x,q.y]]:[]){if(!xy.every(Number.isInteger)||xy[0]<0||xy[1]<0||xy[0]>=s.width||xy[1]>=s.height)throw Error('frame coordinates')}
   if(['click','drag'].includes(q.kind)&&![1,2].includes(q.button))throw Error('button');
   const cutoff=deadline-180000;
   if(command.review?.mode==='quit'){if(!command.review.visibleQuitControl)throw Error('Quit evidence');if(!fs.existsSync(path.join(dir,'quit-phase.json')))record('quit-phase',{at:Date.now(),irreversible:true})}
   else if(Date.now()+1750>=cutoff||fs.existsSync(path.join(dir,'quit-phase.json')))throw Error('irreversible Quit reserve');
   record('consumed-'+command.nonce,{...bind(s),nonce:command.nonce,at:Date.now(),action:q});seq++;
   if(q.kind==='stop'){phase='STOPPED';return null}
   if(q.kind==='wait'){phase='HOVER';changedAt=Date.now();return {action:q,delivered:false}}
   if(q.kind==='key'){
    if(!['Enter','Escape','Space'].includes(q.key))throw Error('key');await arm();held=true;releaseAttempted=false;record('down-'+active.nonce,{at:Date.now(),progress:a.progress()});a.keyDown(q.key==='Space'?' ':q.key,q.key);phase='HELD';changedAt=Date.now();
   }else{a.mouseInput(q.x,q.y,0);phase=q.kind==='hover'?'HOVER':'PREMOVE';changedAt=Date.now()}
   return {action:q,delivered:true};
  }catch(e){throw fail(e)}},
  async afterStep(a){try{
   check();if(a!==target||!a.ownsTarget()||a.programIdentity()!==programId)throw Error('native owner changed');
   const q=command.action;const now=Date.now();
   if(phase==='PREMOVE'&&now-changedAt>=40){await arm();held=true;releaseAttempted=false;record('down-'+active.nonce,{at:Date.now(),progress:a.progress()});a.mouseInput(q.x,q.y,q.button);phase='HELD';changedAt=Date.now()}
   else if(phase==='HELD'){
    if(q.kind==='drag'&&now-changedAt>=Math.min(40,q.holdMs/2)&&!command.moved){a.mouseInput(q.toX,q.toY,q.button);command.moved=true}
    if(now-changedAt>=q.holdMs){release();await disarm();upProgress=a.progress();phase='RELEASED';changedAt=Date.now()}
   }else if((phase==='HOVER'&&now-changedAt>=80)||(phase==='RELEASED'&&a.progress()>upProgress&&now-changedAt>=80)){
    const s=snapshot();await observe(s,{nonce:command.nonce,action:q});phase='READY';next=Date.now()+cadenceMs;
   }
   // Let the separately prearmed guard's IPC run; never capture while held.
   if(a.progress()%100===0)await new Promise(r=>setImmediate(r));
  }catch(e){throw fail(e)}},
  finish(){if(!['READY','STOPPED','UNKNOWN'].includes(phase))fail(Error('native ended before postrelease consequence'));else if(phase==='READY')phase='STOPPED'},
  cancel(reason){fail(Error(reason))},
  async close(){if(!['READY','STOPPED','UNKNOWN'].includes(phase))fail(Error('native ended before postrelease consequence'));else if(phase==='READY')phase='STOPPED';// UNKNOWN admits no new cleanup input. Only the already armed independent
   // UP may release a held gesture; RELEASED/CLOSE below are host bookkeeping.
   if(unknown&&held){const end=Date.now()+1800;while(held&&guard.connected&&Date.now()<end)await new Promise(r=>setTimeout(r,10))}
   try{if(!unknown)release();if(active&&!held)await disarm()}catch(e){fail(e)}
   if(guard.connected&&!held){guard.send({kind:'CLOSE'});await guardClosed}
  }
 });
}
'''

ORIGINAL_JS = r'''
(async()=>{
 const dir=path.resolve(process.env.TIM_ORIGINAL_DIR),startedAt=Date.now(),deadline=startedAt+900000;
 const save=(name,value)=>immutable(dir+'/'+name+'.json',value);
 const pins=JSON.parse(fs.readFileSync(dir+'/original-input-pins.json','utf8'));
 for(const [file,hash] of Object.entries(pins.files))if(sha(fs.readFileSync(file))!==hash)throw Error('input pin changed '+file);
 const lease={session:crypto.randomUUID(),startedAt:startedAt/1000,deadline:deadline/1000,nativeSeconds:900,watchdogSeconds:920,quitReserveSeconds:180,maximumHoldMs:1400,independentUpMs:1750};
 save('lease',lease);
 const {PNG}=require(process.cwd()+'/node_modules/pngjs');let engine,latest,lastMachine,vm;const overlay=new Map();
 const dos=require(process.cwd()+'/tools/toyvm/dos'),Base=dos.Machine;
 dos.Machine=class extends Base{constructor(...args){super(...args);lastMachine=this}};
 const vmModule=require(process.cwd()+'/tools/toyvm/vm'),make=vmModule.makeVm;
 vmModule.makeVm=async(...args)=>{vm=await make(...args);save('actual-module',{sha256:sha(vm.bytes),bytes:vm.bytes.length,watSha256:sha(vm.wat)});return vm};
 process.on('exit',()=>save('native-final',{at:Date.now(),elapsedMs:Date.now()-startedAt,control:engine?.result??null,nativeExited:lastMachine?.exited??null,nativeExitCode:lastMachine?.exitCode??null,overlay:[...overlay].map(([key,v])=>({key,len:v.len,sha256:sha(v.data.subarray(0,v.len))})),operatorGameWrites:false,pauseState:'not-observed'}));
 const publish=s=>{
  const p=new PNG({width:s.width,height:s.height});p.data.set(s.rgba);const bytes=PNG.sync.write(p),name='scene-'+s.frameId+'.png';
  fs.writeFileSync(dir+'/'+name,bytes,{flag:'wx'});
  latest={...bind(s),width:s.width,height:s.height,capturedAt:s.capturedAt/1000,progress:s.progress,admission:s.admission,png:name,pngSHA256:sha(bytes)};
  save('scene-'+s.frameId,latest);fs.writeFileSync(dir+'/latest.tmp',JSON.stringify(latest)+'\n');fs.renameSync(dir+'/latest.tmp',dir+'/latest.json');
  console.log('SCENE',s.frameId,name);
 };
 const controls=require(process.cwd()+'/tools/toyvm/controlled-input');
 controls.createPersistentController=async options=>{
  engine=await createFiniteEngine({directory:dir,session:lease.session,deadline,at:options.at,cadenceMs:220,
   review:async(s,refresh)=>{
    publish(s);
    for(;;){
     if(fs.existsSync(dir+'/UNKNOWN.json'))throw Error('terminal UNKNOWN; no replay/rebind');
     const command=dir+'/command-'+latest.frameId+'.json';
     const decisionPath=dir+'/decision-'+latest.frameId+'.json';
     if(fs.existsSync(decisionPath)){
      const decision=JSON.parse(fs.readFileSync(decisionPath,'utf8'));
      if(decision.status==='REFUSED_UNSENT'){s=refresh(decision);publish(s);continue}
      if(decision.status!=='INPUT'||Date.now()-decision.at>1000&&!fs.existsSync(command))throw Error('ambiguous command transport');
      if(fs.existsSync(command)){const input=JSON.parse(fs.readFileSync(command,'utf8'));if(input.nonce!==decision.nonce)throw Error('command decision mismatch');return input}
     }else if(fs.existsSync(command))throw Error('command without decision');
     const request=dir+'/refresh-'+latest.frameId+'.json';
     if(fs.existsSync(request)){s=refresh();publish(s)}
     if(Date.now()>=deadline)throw Error('native deadline');
     await new Promise(resolve=>setTimeout(resolve,10));
    }
   },observe:async(s,a)=>save('consequence-'+a.nonce,{...bind(s),at:Date.now(),progress:s.progress,rgbaSha256:sha(s.rgba),meaning:'actual post-UP native execution; visible meaning requires personally reviewed next full scene'})});
  process.on('SIGTERM',()=>{try{engine.cancel('external cancellation')}catch{}});
  return engine;
 };
 try{
  const {runDos}=require(process.cwd()+'/tools/toyvm/run-dos');
  const result=await runDos({exe:pins.exe,fileRoot:pins.fileRoot,currentDirectory:'sierra/tim',budget:24000000000,slice:10000,seconds:895,autoKey:false,keys:[],autoKeys:[],tempFiles:overlay,
   controlledInput:{mode:'persistent',dedicatedProcess:true,deadline,at:100000000,maxActions:100,maxReviews:1000,maxFrameAgeMs:30000}});
  engine.finish();save('native-return',{nativeExited:result.machine.exited,nativeExitCode:result.machine.exitCode,elapsedMs:Date.now()-startedAt,control:engine.result});
 }catch(e){save('native-error',{name:e.name,message:e.message,stack:e.stack});throw e}
})().catch(e=>{console.error(e);process.exitCode=1});
'''


def actual_wait(process, directory, label):
    """communicate drains both pipes and waits for this exact direct child."""
    stdout, stderr = process.communicate()
    value = dict(pid=process.pid, exit=process.returncode, actualWait=True,
                 stdoutEOF=True, stderrEOF=True, stdoutBytes=len(stdout or b''),
                 stderrBytes=len(stderr or b''), at=time.time())
    exclusive(Path(directory) / (label + '-wait.json'), value)
    return value, stdout, stderr


def supervise(command, directory, seconds=920):
    """Survives launching-tool HUP/TERM; a separate child bounds the native PG.

    Cancellation is an explicit cancel.json request. The native route handles
    TERM by releasing its ordinary inputs; the independent child escalates.
    These waits are direct OS-child waits, never inferred from PID absence.
    """
    import signal
    import subprocess
    import threading
    directory = Path(directory).resolve()
    directory.mkdir(exist_ok=True, parents=True)
    for sig in (signal.SIGHUP, signal.SIGTERM):
        signal.signal(sig, signal.SIG_IGN)
    started = time.time()
    deadline = started + seconds
    exclusive(directory / 'supervisor-start.json', dict(pid=os.getpid(), ppid=os.getppid(),
              startedAt=started, deadline=deadline, surviveToolHUPTERM=True))
    socket_path = '/tmp/tim-smart-' + uuid.uuid4().hex + '.sock'
    exclusive(directory / 'watchdog-socket.json', dict(path=socket_path, nativeDeadlineSeconds=seconds - 20))
    guard = subprocess.Popen(['node', '-e', ENGINE_JS + '\neval(GUARD_JS);',
                              socket_path, str(deadline * 1000), str(directory), str(os.getpid())],
                             stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             start_new_session=True,
                             preexec_fn=lambda: signal.signal(signal.SIGTERM, signal.SIG_DFL))
    armed = directory / 'deadline-armed.json'
    while not armed.exists():
        assert guard.poll() is None and time.time() < started + 3, 'independent watchdog did not arm'
        time.sleep(.01)
    env = {**os.environ, 'TIM_GUARD_SOCKET': socket_path}
    native = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, start_new_session=True,
                              preexec_fn=lambda: signal.signal(signal.SIGTERM, signal.SIG_DFL), env=env)
    start_token = Path('/proc/' + str(native.pid) + '/stat').read_text().split(') ')[1].split(' ')[19]
    exclusive(directory / 'native-start.json', dict(pid=native.pid, startToken=start_token, ppid=os.getpid(), at=time.time()))
    waited = {}

    def drain():
        waited['native'], stdout, stderr = actual_wait(native, directory, 'native')
        (directory / 'native.log').write_bytes(stdout)
        (directory / 'native.stderr').write_bytes(stderr)

    thread = threading.Thread(target=drain)
    thread.start()
    cancel_sent = False
    while thread.is_alive():
        if (directory / 'cancel.json').exists() and not cancel_sent:
            exclusive(directory / 'cancel-delivery.json', dict(pid=native.pid, at=time.time(), signal='SIGTERM'))
            os.killpg(native.pid, signal.SIGTERM)
            cancel_sent = True
        thread.join(.05)
    # A failed native launch may never have connected. Once the exact child is
    # waited, terminating its unused host guard cannot affect a live guest.
    try:
        guard.wait(timeout=1)
    except subprocess.TimeoutExpired:
        exclusive(directory / 'unused-guard-stop.json', dict(pid=guard.pid, nativeWaitComplete=True, at=time.time()))
        guard.terminate()
    guard_wait, stdout, stderr = actual_wait(guard, directory, 'deadline-watchdog')
    (directory / 'deadline-watchdog.log').write_bytes(stdout)
    (directory / 'deadline-watchdog.stderr').write_bytes(stderr)
    exclusive(directory / 'supervisor-complete.json', dict(pid=os.getpid(), nativeWait=waited['native'],
              watchdogWait=guard_wait, at=time.time(), directChildWaits=True, bothEOF=True))
    Path(socket_path).unlink(missing_ok=True)
    return native.returncode


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def exclusive(path, value):
    """An intent/capture/terminal record can never be replaced."""
    path = Path(path)
    temporary = path.with_name('.' + path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        with temporary.open('x') as stream:
            json.dump(value, stream, indent=2, allow_nan=False)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        # Publish complete bytes without the overwrite behavior of rename.
        os.link(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


class UnsentReviewRefusal(Exception):
    """A burned review, positively refused before its command could be written.

    This carries no gesture. Recovery needs native confirmation, a new capture
    and a new independently chosen review; it never resubmits an old intent.
    """
    def __init__(self, receipt):
        self.receipt = receipt
        super().__init__('REFUSED_UNSENT: fresh complete capture and independent review required')


class Policy:
    def __init__(self, directory, lease):
        from types import MappingProxyType
        self.root = Path(directory)
        self.lease = MappingProxyType(dict(lease))
        assert self.lease['nativeSeconds'] == 900
        assert self.lease['watchdogSeconds'] == 920
        assert self.lease['quitReserveSeconds'] == 180
        assert self.lease['maximumHoldMs'] < 1500
        assert self.lease['independentUpMs'] <= 1750
        assert self.lease['independentUpMs'] >= self.lease['maximumHoldMs']
        assert all(math.isfinite(self.lease[k]) for k in ('startedAt', 'deadline'))
        assert self.lease['deadline'] - self.lease['startedAt'] == 900

    def unknown(self, reason):
        p = self.root / 'UNKNOWN.json'
        if not p.exists():
            exclusive(p, dict(reason=str(reason), at=time.time(), irreversible=True))

    def admit(self, capture, review, action, now=None):
        live_clock = now is None
        now = time.time() if live_clock else now
        try:
            assert not (self.root / 'UNKNOWN.json').exists(), 'terminal UNKNOWN; no replay/rebind'
            assert now < self.lease['deadline'], 'native deadline reached'
            assert capture['session'] == self.lease['session'], 'foreign session'
            assert (self.root / capture['png']).resolve().parent == self.root.resolve(), 'capture outside run'
            assert all(capture[k] == review[k] for k in ('session', 'frameId', 'digest', 'programId', 'targetId'))
            assert digest(self.root / capture['png']) == capture['pngSHA256'], 'capture changed'
            assert review['completeScene'].strip(), 'personally view complete current scene'
            assert review['source'] == 'personally-viewed-current-full-scene'
            assert review['pauseState'] in ('not-observed', 'observed-native-pause')
            if review['pauseState'] == 'observed-native-pause':
                assert review['pauseEvidence'].strip(), 'native pause requires visible evidence'
            mode = review['mode']
            assert mode in ('game', 'menu', 'quit')
            assert capture['capturedAt'] <= review['reviewedAt'] <= now
            cutoff = self.lease['deadline'] - 180
            if now >= cutoff and not (self.root / 'quit-phase.json').exists():
                exclusive(self.root / 'quit-phase.json', dict(at=now, irreversible=True))
            if mode == 'quit':
                assert review['visibleQuitControl'].strip(), 'visible ordinary Quit control'
                if not (self.root / 'quit-phase.json').exists():
                    exclusive(self.root / 'quit-phase.json', dict(at=now, irreversible=True))
            else:
                assert not (self.root / 'quit-phase.json').exists(), 'irreversible Quit reserve'
                assert now + self.lease['independentUpMs'] / 1000 < cutoff
            assert review['visibleTarget'].strip()
            assert review['expectedVisibleConsequence'].strip()
            assert action['kind'] in ('click', 'drag', 'hover', 'key', 'wait', 'stop')
            if action['kind'] in ('click', 'drag', 'key'):
                assert type(action['holdMs']) is int and 1 <= action['holdMs'] <= self.lease['maximumHoldMs']
            if action['kind'] in ('click', 'drag', 'hover'):
                for x, y in ([(action['x'], action['y'])] + ([(action['toX'], action['toY'])] if action['kind'] == 'drag' else [])):
                    assert type(x) is int and type(y) is int
                    assert 0 <= x < capture['width'] and 0 <= y < capture['height']
                if action['kind'] != 'hover':
                    assert action['button'] in (1, 2), 'left/right only'
            if action['kind'] == 'key':
                assert action['key'] in ('Enter', 'Escape', 'Space'), 'ordinary visible menu keys only'
            # A frame has exactly one atomic decision, shared with native review.
            # A command decision burns recovery even if later writing fails.
            admission = capture.get('admission')
            assert isinstance(admission, dict), 'missing native zero-send attestation'
            assert admission.get('phase') == 'REVIEWING' and admission.get('held') is False
            assert admission.get('delivery') == 'NONE' and admission.get('token'), 'not proven zero-send'
            assert review['intentSource'] == 'independently-chosen-for-this-complete-scene'
            assert review['intentId'].strip(), 'new independent intent required'
            assert not (self.root / 'native-wait.json').exists(), 'native has closed'
            frame = capture['frameId']
            assert not (self.root / ('command-' + frame + '.json')).exists(), 'command already written'
            decision = self.root / ('decision-' + frame + '.json')
            assert not decision.exists(), 'frame already decided; new capture required'
            recovery = admission.get('recoveryFrom')
            if recovery:
                confirmed = json.loads((self.root / ('unsent-confirmed-' + recovery + '.json')).read_text())
                assert confirmed['refusalId'] == recovery and confirmed['zeroSend'] is True
                refused = json.loads((self.root / ('decision-' + confirmed['frameId'] + '.json')).read_text())
                assert refused['status'] == 'REFUSED_UNSENT' and refused['refusalId'] == recovery
                assert confirmed['token'] == refused['token']
                assert frame != refused['frameId'] and admission['token'] != refused['token']
                assert capture['capturedAt'] >= confirmed['at'] / 1000
                assert review['intentId'] != refused['refusedIntentId'], 'old intent cannot be reused'
            # Reserve dispatch time immediately before the atomic INPUT claim.
            # This cannot guarantee arbitrary delivery latency; once written,
            # native expiry is still permanent UNKNOWN, never UNSENT.
            nonce = str(uuid.uuid4())
            if live_clock:
                now = time.time()
            age = now - capture['capturedAt']
            assert age >= 0, 'future capture'
            maximum_age = 5 if mode == 'game' else 30
            minimum_dispatch = 1
            if maximum_age - age < minimum_dispatch:
                receipt = {k: capture[k] for k in ('session', 'frameId', 'digest', 'programId', 'targetId')}
                receipt.update(status='REFUSED_UNSENT', delivery='NONE', token=admission['token'],
                               refusalId=str(uuid.uuid4()), refusedIntentId=review['intentId'],
                               at=now * 1000, reviewAgeSeconds=age, maximumReviewAgeSeconds=maximum_age,
                               minimumDispatchSeconds=minimum_dispatch, remainingDispatchSeconds=maximum_age-age,
                               freshCaptureRequired=True,
                               newIndependentIntentRequired=True)
                exclusive(decision, receipt)
                raise UnsentReviewRefusal(receipt)
            command = dict(session=capture['session'], frameId=capture['frameId'], digest=capture['digest'],
                           programId=capture['programId'], targetId=capture['targetId'], nonce=nonce,
                           action=dict(action), review=dict(review), submittedAt=now)
            exclusive(decision, dict(status='INPUT', nonce=command['nonce'], at=now * 1000))
            exclusive(self.root / ('command-' + capture['frameId'] + '.json'), command)
            return command
        except UnsentReviewRefusal:
            raise
        except Exception as error:
            self.unknown(error)
            raise


def start_original(directory):
    """ONE original, only with this route's published native qualification."""
    import signal
    import subprocess
    import sys
    directory = Path(directory).resolve()
    proof = json.loads((directory / 'route-qualified.json').read_text())
    assert proof['routeSHA256'] == digest(__file__)
    assert proof['testSHA256'] == digest(Path(__file__).resolve().parents[1] / 'test/test-tim-smart-handle-controller.py')
    assert proof['fullLockedBuildExit'] == 0
    assert proof['nativeModes'] == ['hover', 'click', 'right', 'drag', 'cancel', 'watchdog', 'parentdeath', 'unsent', 'lateack', 'dropack', 'heldinput', 'writtenstale', 'quitreserve']
    assert proof['actualNativeCallbacks'] and proof['directWaitsBothEOF']
    assert proof['schemaTestSHA256'] == digest(Path(__file__).resolve().parents[1] / 'test/test-tim-gesture-schema.py')
    assert proof['schemaExactCLIAndNativeZeroDelivery'] is True
    assert proof['marginTestSHA256'] == digest(Path(__file__).resolve().parents[1] / 'test/test-tim-dispatch-margin.py')
    assert proof['marginNativeZeroDeliveryAndWrittenUnknown'] is True
    assert subprocess.check_output(['git', 'branch', '--show-current'], text=True).strip() == 'main'
    subprocess.run(['git', 'merge-base', '--is-ancestor', proof['publishedCommit'], 'origin/main'], check=True)
    for path in ('tools/tim-smart-handle-controller.py', 'test/test-tim-smart-handle-controller.py', 'test/test-tim-gesture-schema.py', 'test/test-tim-dispatch-margin.py'):
        assert not subprocess.check_output(['git', 'status', '--porcelain', '--', path]), 'route must be published and clean'
    exclusive(directory / 'ONE-original-intent.json', dict(at=time.time(), routeSHA256=digest(__file__),
              publishedCommit=proof['publishedCommit'], nativeSeconds=900, watchdogSeconds=920, quitReserveSeconds=180))
    for sig in (signal.SIGHUP, signal.SIGTERM):
        signal.signal(sig, signal.SIG_IGN)
    child = subprocess.Popen([sys.executable, '-B', str(Path(__file__).resolve()), '--supervise-original', str(directory)],
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True,
                             preexec_fn=lambda: signal.signal(signal.SIGTERM, signal.SIG_DFL))
    wait, stdout, stderr = actual_wait(child, directory, 'supervisor-child')
    (directory / 'supervisor.log').write_bytes(stdout)
    (directory / 'supervisor.stderr').write_bytes(stderr)
    return wait['exit']


def refresh_scene(directory):
    """Request one full renderer capture; no input and no frame interpretation."""
    root = Path(directory)
    assert not (root / 'UNKNOWN.json').exists(), 'terminal UNKNOWN; no replay/rebind'
    assert not (root / 'native-wait.json').exists(), 'native has closed'
    old = json.loads((root / 'latest.json').read_text())
    exclusive(root / ('refresh-' + old['frameId'] + '.json'), dict(at=time.time(), noInput=True))
    until = time.monotonic() + 2
    while time.monotonic() < until:
        current = json.loads((root / 'latest.json').read_text())
        if current['frameId'] != old['frameId']:
            return root / current['png']
        assert not (root / 'UNKNOWN.json').exists(), 'terminal UNKNOWN'
        time.sleep(.01)
    if not (root / 'UNKNOWN.json').exists():
        exclusive(root / 'UNKNOWN.json', dict(reason='capture transport acknowledgment lost', at=time.time(), irreversible=True))
    raise RuntimeError('capture request not acknowledged; terminal UNKNOWN; no replay/rebind')


def validate_gesture(action, width=None, height=None):
    """Pure exact-schema constructor, before any live review or intent.

    No aliases, defaults, coordinate discovery, submission, retry or recovery.
    Policy and native admission retain all binding and UNKNOWN decisions.
    """
    schemas = {
        'click': {'kind', 'x', 'y', 'button', 'holdMs'},
        'drag': {'kind', 'x', 'y', 'toX', 'toY', 'button', 'holdMs'},
        'hover': {'kind', 'x', 'y'},
        'key': {'kind', 'key', 'holdMs'},
        'wait': {'kind'}, 'stop': {'kind'},
    }
    if type(action) is not dict or type(action.get('kind')) is not str:
        raise ValueError('gesture must be one object with an explicit kind')
    kind = action['kind']
    if kind not in schemas or set(action) != schemas[kind]:
        raise ValueError('exact gesture fields required; no aliases or extra fields')
    for name in ('x', 'y', 'toX', 'toY'):
        if name in action and (type(action[name]) is not int or action[name] < 0):
            raise ValueError('gesture coordinates must be nonnegative integers')
    if 'button' in action and (type(action['button']) is not int or action['button'] not in (1, 2)):
        raise ValueError('explicit integer left/right button required')
    if 'holdMs' in action and (type(action['holdMs']) is not int or not 80 <= action['holdMs'] <= 1400):
        raise ValueError('explicit finite integer holdMs must be 80..1400')
    if kind == 'key' and action['key'] not in ('Enter', 'Escape', 'Space'):
        raise ValueError('ordinary visible menu key required')
    if width is not None or height is not None:
        if type(width) is not int or type(height) is not int or width <= 0 or height <= 0:
            raise ValueError('complete frame dimensions required')
        for name, bound in (('x', width), ('toX', width), ('y', height), ('toY', height)):
            if name in action and action[name] >= bound:
                raise ValueError('gesture outside complete frame')
    return dict(action)


def parse_gesture(raw):
    """Reject duplicate/nonfinite JSON rather than silently choosing a field."""
    def pairs(items):
        value = {}
        for key, item in items:
            if key in value:
                raise ValueError('duplicate gesture field')
            value[key] = item
        return value

    def nonfinite(_):
        raise ValueError('nonfinite gesture JSON')

    return validate_gesture(json.loads(raw, object_pairs_hook=pairs, parse_constant=nonfinite))


def operate(directory, mode, scene, target, consequence, action, keep=None):
    """One explicitly chosen current-scene gesture, never a future action list."""
    action = validate_gesture(action)
    root = Path(directory)
    if keep:
        assert keep.replace('-', '').isalnum(), 'simple unique selected-image label'
        assert not (root / ('kept-' + keep + '.json')).exists()
    capture = json.loads((root / 'latest.json').read_text())
    action = validate_gesture(action, capture['width'], capture['height'])
    review = {k: capture[k] for k in ('session', 'frameId', 'digest', 'programId', 'targetId')}
    review.update(mode=mode, source='personally-viewed-current-full-scene', completeScene=scene,
                  visibleTarget=target, expectedVisibleConsequence=consequence,
                  pauseState='not-observed', reviewedAt=time.time(), intentId=str(uuid.uuid4()),
                  intentSource='independently-chosen-for-this-complete-scene')
    if mode == 'quit':
        review['visibleQuitControl'] = target
    policy = Policy(root, json.loads((root / 'lease.json').read_text()))
    try:
        command = policy.admit(capture, review, action)
    except UnsentReviewRefusal as refused:
        # No command exists. Require native zero-send confirmation before
        # returning recovery status; transport uncertainty still closes UNKNOWN.
        confirmation = root / ('unsent-confirmed-' + refused.receipt['refusalId'] + '.json')
        until = time.monotonic() + 2
        while not confirmation.exists():
            if (root / 'UNKNOWN.json').exists() or (root / 'native-wait.json').exists() or time.monotonic() >= until:
                policy.unknown('unsent refusal confirmation lost; no replay/rebind')
                raise RuntimeError('unsent refusal confirmation lost')
            time.sleep(.01)
        return refused.receipt
    if keep:
        exclusive(root / ('kept-' + keep + '.json'), dict(label=keep, capture=capture,
                  description=scene, personallyViewed=True))
    # Do not yield to the human/model during a finite held gesture. Normal
    # completion requires actual post-UP execution; terminal closure requires
    # the supervisor's actual native wait, rather than a guessed absent PID.
    post = root / ('consequence-' + command['nonce'] + '.json')
    while not post.exists() and not (root / 'native-wait.json').exists():
        time.sleep(.01)
    return dict(nonce=command['nonce'], frameId=capture['frameId'], action=command['action'],
                postUPExecution=post.exists(), nativeWait=(root / 'native-wait.json').exists(),
                meaning='input closeout only; personally reviewed visible consequence and native puzzle completion remain separate')


def main():
    import argparse
    import sys
    if len(sys.argv) == 3 and sys.argv[1] == '--original':
        raise SystemExit(start_original(sys.argv[2]))
    if len(sys.argv) == 3 and sys.argv[1] == '--supervise-original':
        directory = Path(sys.argv[2]).resolve()
        os.environ['TIM_ORIGINAL_DIR'] = str(directory)
        raise SystemExit(supervise(['node', '-e', ENGINE_JS + ORIGINAL_JS], directory, 920))
    if len(sys.argv) == 3 and sys.argv[1] == '--capture':
        print(refresh_scene(sys.argv[2]))
        return
    if len(sys.argv) in (8, 9) and sys.argv[1] == '--gesture':
        _, _, directory, mode, scene, target, consequence, action, *kept = sys.argv
        print(json.dumps(operate(directory, mode, scene, target, consequence, parse_gesture(action), kept[0] if kept else None)))
        return
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('directory', type=Path)
    p.add_argument('capture', type=Path)
    p.add_argument('review', type=Path)
    p.add_argument('action', type=Path)
    args = p.parse_args()
    read = lambda f: json.loads(Path(f).read_text())
    action = parse_gesture(Path(args.action).read_text())
    capture = read(args.capture)
    action = validate_gesture(action, capture['width'], capture['height'])
    policy = Policy(args.directory, read(args.directory / 'lease.json'))
    command = policy.admit(capture, read(args.review), action)
    print(json.dumps(command, allow_nan=False))


if __name__ == '__main__':
    main()
