#!/usr/bin/env node
'use strict';
// Personal complete-scene reviews and single finite ordinary UI intents.
//
// One permanent binding. UNKNOWN closes all later requests. An independently
// prearmed release may finish its original cleanup. No replay, rebind or solver.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const cp=require('node:child_process'),util=require('node:util');
const np=require('./native-proc.cjs');
const ROOT=path.resolve(__dirname,'..');
const M=module.exports;

// Mutable module state; callers override M.R / M.PORT exactly as m.R / m.PORT.
M.R=process.env.DELPHI5_RUN||path.join(ROOT,'scratch/runs/20261116-vb5cce-reviewed-context-install-ide');
M.PORT=Number.parseInt(process.env.DELPHI5_PORT||'45761',10);

// Python's assert statement: AssertionError carrying the message.
function check(cond,message){if(!cond){const e=new Error(message===undefined?'':typeof message==='string'?message:JSON.stringify(message));e.name='AssertionError';e.code='ERR_ASSERTION';throw e;}}
// Python OSError family (URLError/HTTPError/socket.timeout/ConnectionRefused).
class TransportError extends Error{constructor(message,code){super(message);this.name='TransportError';this.code=code||'EIO';this.oserror=true;}}
class TimeoutExpired extends Error{constructor(what,timeout){super(`Command '${what}' timed out after ${timeout} seconds`);this.name='TimeoutExpired';this.timeout=timeout;}}
const is_os_error=e=>!!e&&(e.oserror===true||(typeof e.code==='string'&&/^E[A-Z0-9]+$/.test(e.code)));
const is_assertion=e=>!!e&&e.code==='ERR_ASSERTION';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const now=np.now,sleep=np.sleep;
const r=n=>path.join(String(M.R),n);
const str=e=>e&&typeof e==='object'&&'message' in e?String(e.message):String(e);

function read(n){return JSON.parse(fs.readFileSync(r(n),'utf8'));}
function save(n,v){
  const target=r(n),pending=target+'.'+process.pid+'.pending';
  const fd=fs.openSync(pending,'wx');
  try{fs.writeSync(fd,JSON.stringify(v,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  // Publish a complete file without overwriting any earlier record.
  fs.linkSync(pending,target);fs.unlinkSync(pending);
}
function fail(name,e){
  if(!fs.existsSync(r('PERMANENT-UNKNOWN.json')))M.save('PERMANENT-UNKNOWN.json',{name,error:str(e),at:now(),noLaterRequests:true});
}
function sourcecheck(){
  const pins=M.read('runtime-inputs.json').sources;
  // Executed core is sealed; only mutable owned helpers need fresh IO.
  for(const n of ['tools/vb5cce-reviewed-control.js','test/test-vb5cce-original-current.cjs'])
    check(sha(fs.readFileSync(path.join(ROOT,n)))===pins[n],'owned source changed: '+n);
}
function reserve(quit=false){
  check(!fs.existsSync(r('PERMANENT-UNKNOWN.json')),'permanent UNKNOWN; no later requests');
  M.sourcecheck();
  const launch=M.read('launch.json');check(launch.gameplayCutoff===launch.deadline-launch.reserveSeconds);
  if(now()>=launch.gameplayCutoff||quit){
    if(!fs.existsSync(r('quit-phase.json')))M.save('quit-phase.json',{at:now(),irreversible:true});
  }
  check(now()+3<launch.deadline);
  return launch;
}
function identity(){
  let info=M.read('native-pid.json');
  if(M.PORT!==(M.read('launch.json').rootPort??45761)){
    const dir=r('children');
    let rows=(fs.existsSync(dir)?fs.readdirSync(dir):[]).filter(n=>n.endsWith('-wait.json')).map(n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8')));
    rows=rows.filter(row=>row.pid===Number.parseInt(process.env.DELPHI5_CHILD_PID,10));
    check(rows.length===1&&!rows[0].actualWait);info={pid:rows[0].pid,startToken:process.env.DELPHI5_CHILD_TOKEN};
  }
  check(np.token(info.pid)===info.startToken);
  // Exactly one 127.0.0.1:PORT LISTEN socket, owned through this PID's fds.
  check(np.listener(info.pid,M.PORT).owned);
  return info;
}
function same_live_invocation(info){
  // This is an observation, never a wait or a success oracle. Zombies have
  // already exited and cannot establish pre-DOWN liveness.
  check(Number.isInteger(info.pid)&&info.pid>0);
  check(info.invocationToken&&info.startToken&&info.bootId);
  check(np.bootId()===info.bootId);
  let token,state;
  try{token=np.token(info.pid);state=np.state(info.pid);}
  catch(e){if(e.code==='ESRCH')return false;throw e;}
  check(token===info.startToken,'stale/reused native identity');
  return !['Z','X','x'].includes(state);
}
const isInt=v=>typeof v==='number'&&Number.isInteger(v);
const isNum=v=>typeof v==='number';
function normal_exit(info,up_ack_mono,start){
  check(!fs.existsSync(r('PERMANENT-UNKNOWN.json')),'permanent UNKNOWN');
  check(now()<start+3,'aggregate observation UNKNOWN');
  if(!fs.existsSync(r('native-wait.json')))return null;
  const native=M.read('native-wait.json');
  check(['pid','startToken','invocationToken','bootId'].every(k=>native[k]===info[k]),'unrelated native wait');
  check(native.actualWait===true&&isInt(native.exit)&&native.exit===0);
  check(native.disposition==='normal'&&[undefined,null,0].includes(native.signal));
  check(isNum(native.atWaitMono)&&native.atWaitMono>=up_ack_mono);
  check(isNum(native.atWait)&&start<=native.atWait&&native.atWait<start+3);
  const guest=M.read('native-exit.json');
  check(!fs.existsSync(r('native-exit.json.cancelled')),'native invocation cancelled');
  check(guest.contract==='native-process-exit-v1');
  check(['pid','startToken','invocationToken','bootId'].every(k=>guest[k]===info[k]),'unrelated native exit');
  check(isInt(guest.exitCode)&&guest.exitCode===0,'native error exit');
  check(isNum(guest.atExitMono)&&up_ack_mono<=guest.atExitMono&&guest.atExitMono<=native.atWaitMono);
  return native;
}
// urllib.request.urlopen(POST, timeout): any transport failure is an OSError;
// the timeout here is absolute for the whole exchange and says 'timed out'.
function post(url,body,timeout){
  return new Promise((resolve,reject)=>{
    let done=false;const finish=(f,v)=>{if(!done){done=true;clearTimeout(timer);f(v);}};
    const req=http.request(url,{method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',e=>finish(reject,new TransportError(str(e),e.code)));
      res.on('end',()=>{
        if(res.statusCode>=400)return finish(reject,new TransportError(`HTTP Error ${res.statusCode}: ${res.statusMessage}`,'EHTTP'));
        try{finish(resolve,JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(e){finish(reject,e);}
      });
    });
    const timer=setTimeout(()=>{req.destroy();finish(reject,new TransportError('<urlopen error timed out>','ETIMEDOUT'));},Math.max(0,timeout*1000));
    req.on('error',e=>finish(reject,new TransportError(`<urlopen error ${str(e)}>`,e.code)));
    req.end(body);
  });
}
async function call(command,timeout=1,cleanup=false){
  check(!fs.existsSync(r('PERMANENT-UNKNOWN.json')),'permanent UNKNOWN; no later requests');
  M.identity();
  fs.appendFileSync(r('requests.jsonl'),JSON.stringify({at:now(),action:command.action??null,cleanup})+'\n');
  const reply=await post(`http://127.0.0.1:${M.PORT}/ctl`,JSON.stringify(command),timeout);
  check(reply.ok,reply);
  return reply.value;
}
async function capture(name){
  try{
    M.reserve();const target=M.identity(),at=now();
    const p=r(name+'.png');check(!fs.existsSync(p));
    const reply=await M.call({action:'native-reviewed-capture',path:p},3);
    check(now()-at<3);
    check(reply.contract==='native-reviewed-context-v1');
    M.save(name+'.json',{at:reply.startedAt/1000,completedAt:reply.completedAt/1000,
      target,port:M.PORT,snapshot:reply.snapshot,image:reply,captureId:reply.captureId,
      pngSHA256:sha(fs.readFileSync(p))});
    console.log(p);
  }catch(e){M.fail(name,e);throw e;}
}
const CONTEXT_KEYS=['mainHwnd','windows','modalHwnd','focus','focusTopLevel','focusWindow',
  'capture','physicalUp','nativeProcess','nativeMessageBox','nativeDialogBox','screen'];
function context(s){
  const result={};
  for(const k of CONTEXT_KEYS){if(!(k in s))throw new Error('KeyError: '+k);result[k]=s[k];}
  // Repainting observational progress alone cannot prove completion of a
  // finite BUTTON intent. Keep every identity/caption/style/hierarchy field.
  const isDict=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const integer=n=>isInt(n)&&n>=-2147483648&&n<=2147483647;
  const metadata=w=>{
    const p=w.progress;
    const values=isDict(p)?['min','max','pos','step'].map(k=>p[k]):[];
    if(w.controlClass===17&&w.live&&![undefined,null,'0',''].includes(w.generation)
        &&w.processId&&w.threadId&&isDict(p)
        &&p.contract==='native-progress-v1'&&p.available===true
        &&values.length===4&&values.every(integer)&&values[0]<=values[2]&&values[2]<=values[1]){
      const progress={};for(const [k,v] of Object.entries(p))if(!['min','max','pos','step'].includes(k))progress[k]=v;
      return {...w,progress};
    }
    return w;
  };
  result.windows=result.windows.map(metadata);
  return result;
}
// Python dict/list equality (order-insensitive keys, JSON values).
const same=(a,b)=>util.isDeepStrictEqual(a,b);
function review(scene,description,label,kind,target){
  const rr=M.read(scene+'.json');
  check(sha(fs.readFileSync(r(scene+'.png')))===rr.pngSHA256);
  M.save(scene+'-review.json',{at:now(),rawCompleteScene:true,observation:description,
    visibleLabel:label,kind,targetHwnd:target,pngSHA256:rr.pngSHA256});
}
function reviewed(scene){
  const rr=M.read(scene+'.json'),rv=M.read(scene+'-review.json');
  const freshness=rv.kind==='game'?15:30;
  check(0<=now()-rr.at&&now()-rr.at<freshness&&0<=now()-rv.at&&now()-rv.at<freshness);
  check(same(rr.target,M.identity())&&rr.port===M.PORT&&rv.rawCompleteScene&&rv.observation&&rv.visibleLabel);
  check(rv.pngSHA256===rr.pngSHA256&&rr.pngSHA256===sha(fs.readFileSync(r(scene+'.png'))));
  return [rr,rv];
}
function native_review(rr,rv){
  return {contract:'native-reviewed-context-v1',captureId:rr.captureId,pngSHA256:rr.pngSHA256,
    reviewed:true,reviewedAt:rv.at*1000,scope:rv.kind==='game'?'game':'menu',targetHwnd:rv.targetHwnd};
}
async function bind(scene){
  try{
    check(!M.read('launch.json').passiveDiagnostic,'passive diagnostic forbids binding');
    M.reserve();check(!fs.existsSync(r('input-owner.json')));
    const [rr,rv]=M.reviewed(scene);
    M.save('bind-intent.json',{scene,at:now(),permanent:true});
    const reply=await M.call({action:'guarded-bind',reviewedScene:M.native_review(rr,rv)});
    M.save('input-owner.json',reply);
  }catch(e){M.fail('bind',e);throw e;}
}
async function release(name,owner,due){
  process.stdout.write(JSON.stringify({armed:true,pid:process.pid,due})+'\n');
  while(now()<due){
    const p=r(name+'-up-at.json');
    if(fs.existsSync(p)){
      try{due=Math.min(due,M.read(name+'-up-at.json').at);}
      catch{} // Original finite fallback remains armed.
    }
    await sleep(Math.min(.003,Math.max(0,due-now()))*1000);
  }
  try{
    const sent=now(),reply=await M.call({action:'guarded-release',owner},.2,true);
    M.save(name+'-up.json',{at:now(),monotonic:np.monotonic(),sentAt:sent,reply,physicalUpACK:reply.released===true});
  }catch(e){M.save(name+'-up.json',{at:now(),error:str(e),physicalUpACK:false});throw e;}
}
// Independent release process (Python forked one; Node spawns this file in
// 'release' mode). Keep actual join and pipe EOF evidence, with the same
// absolute deadlines and the same first-line "armed" JSON handshake.
class ArmedRelease{
  constructor(name,owner,due){
    this.process=cp.spawn(process.execPath,[__filename,'release',name,owner,String(due)],
      {cwd:ROOT,env:{...process.env,DELPHI5_RUN:String(M.R),DELPHI5_PORT:String(M.PORT)},stdio:['ignore','pipe','pipe']});
    this.pid=this.process.pid;this.returncode=null;this.result=null;
    this.out=[];this.err=[];this.lineWaiters=[];
    this.process.stdout.on('data',b=>{this.out.push(b);for(const w of this.lineWaiters.splice(0))w();});
    this.process.stderr.on('data',b=>this.err.push(b));
    this.closed=new Promise(resolve=>this.process.on('close',(code,signal)=>{
      this.returncode=code??-(require('node:os').constants.signals[signal]||0);
      for(const w of this.lineWaiters.splice(0))w();resolve();
    }));
    this.consumed=0;
  }
  buffered(){return Buffer.concat(this.out).subarray(this.consumed);}
  // select.select([stdout],[],[],seconds): true once any byte is readable.
  async readable(seconds){
    if(this.buffered().length||this.returncode!==null)return true;
    let timer;
    const ready=await Promise.race([new Promise(res=>this.lineWaiters.push(()=>res(true))),
      new Promise(res=>{timer=setTimeout(()=>res(false),seconds*1000);})]);
    clearTimeout(timer);return ready;
  }
  // stdout.readline(): blocks until a newline or EOF.
  async readline(){
    for(;;){
      const b=this.buffered(),i=b.indexOf(10);
      if(i>=0){this.consumed+=i+1;return b.subarray(0,i+1).toString('utf8');}
      if(this.returncode!==null){this.consumed+=b.length;return b.toString('utf8');}
      await new Promise(res=>this.lineWaiters.push(res));
    }
  }
  async communicate(timeout=null){
    if(this.result!==null)return this.result;
    if(this.returncode===null||this.process.stdout.readableEnded===false){
      let timer;
      const ok=await Promise.race([this.closed.then(()=>true),
        timeout===null?new Promise(()=>{}):new Promise(res=>{timer=setTimeout(()=>res(false),Math.max(0,timeout)*1000);})]);
      clearTimeout(timer);
      if(!ok)throw new TimeoutExpired('independent physical release',timeout);
    }
    this.result=[this.buffered(),Buffer.concat(this.err)];
    return this.result;
  }
  kill(){try{this.process.kill('SIGKILL');}catch{}}
}
async function intent(name,scene,x,y,kind){
  let child=null;
  try{
    check(!M.read('launch.json').passiveDiagnostic,'passive diagnostic forbids input');
    const launch=M.reserve(kind==='quit'),[rr,rv]=M.reviewed(scene);
    check(['install','game','quit'].includes(kind)&&rv.kind===kind);
    if(kind!=='quit')check(!fs.existsSync(r('quit-phase.json'))&&now()+3<launch.gameplayCutoff);
    check(!fs.existsSync(r('PERMANENT-UNKNOWN.json')));
    const owner=M.read('input-owner.json'),nonce=crypto.randomUUID(),start=now();
    // Retain once, before DOWN. Never reread a replacement PID as authority.
    const invocation={...rr.target};check(same(invocation,M.identity()));
    check(M.same_live_invocation(invocation),'native not live before DOWN');
    // The retained personally reviewed full image is immutable. Native
    // verification checks every public semantic control, not repaint bytes.
    const command=x===-1?`keydown:${y}`:`mousedown:${x}:${y}`;
    M.save(name+'-intent.json',{scene,x,y,kind,owner,nonce,
      nativeIdentity:invocation,at:start,confirmationDeadline:start+.5,physicalUpDeadline:start+1.75,observationDeadline:start+3});
    child=new M.ArmedRelease(name,owner.owner,start+1.4);
    check(await child.readable(.15),'release was not prearmed');
    const arm=JSON.parse(await child.readline());M.save(name+'-release-arm.json',arm);check(arm.armed);
    M.reserve(kind==='quit');check(now()<start+.5);
    const fresh=Math.min(rr.at,rv.at)+(kind==='game'?15:30);
    const receipt=await M.call({action:'guarded-input',cmd:command,guard:{...owner,nonce,
      reviewed:true,intent:{review:M.native_review(rr,rv)},
      deadline:Math.trunc(Math.min(start+.5,fresh)*1000)}},Math.max(.001,start+.5-now()));
    M.save(name+'-down.json',{at:now(),receipt});
    check(now()<start+.5&&receipt.state==='CONSUMED'&&receipt.consumed,'confirmation UNKNOWN');
    check(Object.entries({owner:owner.owner,epoch:owner.epoch,nonce}).every(([k,v])=>receipt[k]===v));
    check(start*1000<=receipt.consumedAt&&receipt.consumedAt<Math.min((start+.5)*1000,fresh*1000),'late consumption');
    M.save(name+'-up-at.json',{at:receipt.consumedAt/1000+.1});
    const [out,err]=await child.communicate(Math.max(.001,start+1.75-now()));
    M.save(name+'-release-wait.json',{pid:child.pid,exit:child.returncode,actualWait:true,stdoutEOF:true,stderrEOF:true,stdout:out.toString('utf8'),stderr:err.toString('utf8')});
    const up=M.read(name+'-up.json');check(child.returncode===0&&up.physicalUpACK&&up.at<start+1.75);
    check(up.reply.owner===owner.owner,'unrelated physical UP');
    check(receipt.consumedAt/1000<=up.sentAt&&up.sentAt<=up.at);
    // The independent release process retains its ACK clock before joining.
    // A fast guest may already have exited by the time join returns. The
    // native exit callback below must be later than that actual ACK.
    const up_ack_mono=up.monotonic;
    check(isNum(up_ack_mono)&&up_ack_mono<=np.monotonic());
    // Acknowledgement proves input consumption only. Observe a later scene.
    // Observe the actual transition immediately. There is no minimum
    // completion delay: 3000ms bounds the entire intent and its evidence.
    for(;;){
      check(now()<start+3,'aggregate observation UNKNOWN');
      const native=M.normal_exit(invocation,up_ack_mono,start);
      if(native!==null){
        M.save(name+'-observation.json',{at:now(),outcome:'process-exited',nativeWait:native,
          nativeExit:M.read('native-exit.json'),noPostExitRequest:true});
        break;
      }
      if(kind==='quit'){await sleep(5);continue;} // Quit is proved by parent wait, never a request to a retiring endpoint.
      if(!M.same_live_invocation(invocation)){await sleep(5);continue;} // Parent still drains pipes/publishes its actual wait.
      let after;
      try{after=await M.call({action:'snapshot'},Math.max(.001,start+3-now()));}
      catch(e){
        if(!is_os_error(e))throw e;
        // Endpoint loss while still live is terminal. If the exact
        // invocation has exited, only its independent wait can decide;
        // no retry/rebind/replay or blanket connection-refused waiver.
        if(M.same_live_invocation(invocation))throw e;
        continue;
      }
      if(kind!=='quit'&&after.physicalUp&&!same(M.context(after),M.context(rr.snapshot))){
        M.save(name+'-observation.json',{at:now(),snapshot:after});break;
      }
      await sleep(5);
    }
    check(!fs.existsSync(r('PERMANENT-UNKNOWN.json'))&&now()<start+3);
    M.save(name+'-completion.json',{at:now(),elapsedMs:(now()-start)*1000,limitsMs:{confirmation:500,physicalUp:1750,aggregate:3000}});
    check(now()<start+3);
    process.stdout.write(JSON.stringify({completedAt:now(),elapsedMs:(now()-start)*1000,
      durableEvidencePublished:true,aggregateGuardPassed:true})+'\n');
    check(now()<start+3);
  }catch(e){
    try{
      if(child){
        let out,err;
        try{[out,err]=await child.communicate(2);}
        catch(t){if(!(t instanceof TimeoutExpired))throw t;child.kill();[out,err]=await child.communicate();}
        if(!fs.existsSync(r(name+'-release-wait.json')))M.save(name+'-release-wait.json',{pid:child.pid,exit:child.returncode,actualWait:true,stdoutEOF:true,stderrEOF:true,stdout:out.toString('utf8'),stderr:err.toString('utf8')});
      }
    }finally{
      // Drain the prearmed finite physical release BEFORE publishing the
      // terminal latch. Once UNKNOWN is visible even cleanup cannot request.
      M.fail(name,e);
    }
    throw e;
  }
}
// Python int(): decimal integer text only.
function int(s){const t=String(s).trim();if(!/^[+-]?\d+$/.test(t))throw new Error(`ValueError: invalid literal for int() with base 10: '${s}'`);return Number.parseInt(t,10);}
function float(s){const v=Number(String(s).trim());if(String(s).trim()===''||Number.isNaN(v))throw new Error(`ValueError: could not convert string to float: '${s}'`);return v;}

Object.assign(M,{ROOT,TransportError,TimeoutExpired,is_os_error,is_assertion,read,save,fail,sourcecheck,reserve,identity,
  same_live_invocation,normal_exit,call,capture,context,review,reviewed,native_review,bind,release,ArmedRelease,intent});

async function main(argv=process.argv.slice(2)){
  const mode=argv[0];
  if(mode==='capture')await M.capture(argv[1]);
  else if(mode==='review')M.review(...argv.slice(1,6));
  else if(mode==='bind')await M.bind(argv[1]);
  else if(mode==='intent')await M.intent(argv[1],argv[2],int(argv[3]),int(argv[4]),argv[5]);
  else if(mode==='release')await M.release(argv[1],argv[2],float(argv[3]));
}
M.main=main;
if(require.main===module)main().catch(e=>{process.stderr.write((e&&e.stack||String(e))+'\n');process.exitCode=1;});
