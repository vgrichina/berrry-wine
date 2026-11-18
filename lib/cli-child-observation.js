'use strict';

// A one-shot observation capability for an ordinary VFS CreateProcess. The
// launcher records the fork; the child records its own loaded inputs/listener.
// Neither record grants input or substitutes for the child's native USER review.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const check=(yes,why)=>{if(!yes)throw Error('child observation: '+why);};
function identity(pid=process.pid){
  // macOS has no /proc: the same identity is the process start time (ps)
  // plus the boot time (sysctl kern.boottime), a dead process is refused.
  if(process.platform==='darwin'){
    const {execFileSync}=require('node:child_process');
    let row;
    try{row=execFileSync('ps',['-o','stat=,lstart=','-p',String(pid)],{encoding:'utf8'}).trim();}
    catch{check(false,'dead process');}
    check(row&&!/^Z/.test(row),'dead process');
    return {pid,startToken:row.replace(/^\S+\s+/,''),
      bootId:execFileSync('sysctl',['-n','kern.boottime'],{encoding:'utf8'}).trim()};
  }
  const stat=fs.readFileSync(`/proc/${pid}/stat`,'utf8');
  const fields=stat.slice(stat.lastIndexOf(')')+2).split(' ');
  check(!['Z','X'].includes(fields[0]),'dead process');
  return {pid,startToken:fields[19],bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()};
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function publish(directory,name,value){
  const target=path.join(directory,name+'.json'),pending=target+'.'+process.pid+'.pending';
  const fd=fs.openSync(pending,'wx',0o600);
  try{fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  try{fs.linkSync(pending,target);}finally{fs.unlinkSync(pending);}
}
class ChildObservation {
  constructor({moduleBytes,runner,executable,executableBytes,guestExe,port,envelope=null}){
    this.self=identity();this.port=port;this.executable=guestExe;
    this.inputs={moduleSHA256:hash(moduleBytes),runnerSHA256:hash(fs.readFileSync(runner)),
      bridgeSHA256:hash(fs.readFileSync(__filename)),executableSHA256:hash(executableBytes || fs.readFileSync(executable)),
      sourceSHA256:process.env.DISCIPLES2_SOURCE_SHA256||null,
      sourceIndexSHA256:process.env.DISCIPLES2_SOURCE_INDEX_SHA256||null,
      manifestSHA256:globalThis.__disciples2Manifest||null};
    if(envelope){
      this.incoming=JSON.parse(envelope);
      const e=this.incoming;
      check(e.contract==='native-child-observation-v1'&&/^[a-f0-9]{64}$/.test(e.token),'envelope');
      check(same(identity(process.ppid),e.parent),'parent identity');
      check(this.executable===e.guestExe&&this.inputs.executableSHA256===e.executableSHA256,'executable mismatch');
      for(const k of Object.keys(e.inputs))check(this.inputs[k]===e.inputs[k],'source/module mismatch '+k);
      check(this.port===e.port&&Date.now()<e.deadline,'late/wrong listener');
    }
  }
  bind(binding){this.binding=binding;}
  arm(command,verified,snapshot){
    check(!this.armRecord&&!this.incoming,'one-shot arm');
    const {owner,epoch,identity:bindingIdentity}=command;
    check(this.binding&&owner===this.binding.owner&&epoch===this.binding.epoch&&bindingIdentity===this.binding.identity,'wrong owner');
    check(verified&&snapshot.physicalUp&&snapshot.capture==='0x0','reviewed physical context');
    const now=Date.now();
    check(typeof command.nonce==='string'&&command.nonce.length>0&&command.nonce.length<=256,'nonce');
    check(Number.isSafeInteger(command.deadline)&&command.deadline>now&&command.deadline<=now+3000,'deadline');
    check(Number.isSafeInteger(command.releaseDeadline)&&command.releaseDeadline>now&&command.releaseDeadline<=command.deadline&&command.releaseDeadline<=now+1750,'release deadline');
    check(typeof command.guestExe==='string'&&/^[a-z]:\\/i.test(command.guestExe)&&/^[a-f0-9]{64}$/.test(command.executableSHA256),'expected executable');
    check(Number.isInteger(command.port)&&command.port>0&&command.port<65536&&command.port!==this.port,'child port');
    check(path.isAbsolute(command.directory)&&!fs.existsSync(command.directory),'fresh observation directory');
    fs.mkdirSync(command.directory,{mode:0o700});
    const {executableSHA256,...inputs}=this.inputs;
    this.armRecord={contract:'native-child-observation-v1',token:crypto.randomBytes(32).toString('hex'),
      parent:this.self,parentActor:snapshot.focusWindow,inputs,guestExe:command.guestExe.toLowerCase(),
      executableSHA256:command.executableSHA256,port:command.port,directory:command.directory,
      nonce:command.nonce,owner,epoch,identity:bindingIdentity,armedAt:now,
      deadline:command.deadline,releaseDeadline:command.releaseDeadline};
    publish(command.directory,'armed',this.armRecord);
    return this.armRecord;
  }
  begin(guard){
    if(!this.armRecord)return;
    const a=this.armRecord;
    check(!this.begun&&Date.now()<a.deadline,'late/repeated transition');
    for(const k of ['nonce','owner','epoch','identity'])check(guard?.[k]===a[k],'wrong transition '+k);
    this.begun=true;
  }
  prepare(guestExe,executable,actor,executableBytes){
    if(!this.armRecord)return null;
    const a=this.armRecord;
    const valid=!this.failed&&this.begun&&!this.spawned&&Date.now()<a.deadline&&guestExe===a.guestExe&&
      hash(executableBytes || fs.readFileSync(executable))===a.executableSHA256&&actor.processId===a.parentActor.processId&&actor.threadId===a.parentActor.threadId;
    if(!valid){this.fail('unrelated/mismatched/late CreateProcess');return null;}
    this.spawned=true;return a;
  }
  forked(child,envelope,guestPid){
    if(!envelope)return;
    this.child=identity(child.pid);
    publish(envelope.directory,'spawned',{contract:envelope.contract,token:envelope.token,parent:this.self,
      child:this.child,guestPid,guestExe:envelope.guestExe,at:Date.now(),inputs:envelope.inputs});
    child.once('exit',(exit,signal)=>publish(envelope.directory,'child-dead',{child:this.child,exit,signal,at:Date.now()}));
    child.once('close',(exit,signal)=>publish(envelope.directory,'child-wait',{child:this.child,exit,signal,
      actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,at:Date.now()}));
  }
  ready(){
    if(this.incoming)publish(this.incoming.directory,'ready',{contract:this.incoming.contract,token:this.incoming.token,
      parent:this.incoming.parent,child:this.self,inputs:this.inputs,guestExe:this.executable,port:this.port,at:Date.now()});
  }
  attest(command,readiness){
    const e=this.incoming;
    check(e&&command.token===e.token&&command.nonce===e.nonce,'unauthenticated child');
    check(Date.now()<e.deadline,'late child observation');
    check(same(identity(),this.self),'reused PID');
    check(readiness.snapshot.nativeProcess.pid===this.self.pid&&readiness.snapshot.nativeProcess.executable===this.executable,'wrong process');
    return {contract:e.contract,token:e.token,nonce:e.nonce,child:this.self,inputs:this.inputs,readiness};
  }
  exit(code){
    if(this.armRecord)publish(this.armRecord.directory,'parent-exit',{parent:this.self,token:this.armRecord.token,exitCode:code>>>0,at:Date.now()});
    if(this.incoming)publish(this.incoming.directory,'child-exit',{child:this.self,token:this.incoming.token,exitCode:code>>>0,
      at:Date.now(),atExitMono:Number(process.hrtime.bigint())/1e9});
  }
  fail(reason){
    const e=this.armRecord||this.incoming;
    if(e)try{publish(e.directory,'failure',{token:e.token,process:this.self,reason,at:Date.now()});}
    catch(error){if(error.code!=='EEXIST')throw error;} // Parent and child can fail concurrently; the first failure remains terminal.
    this.failed=true;
  }
  async drainRelease(){
    // The guest has already exited. Only its prearmed independent physical UP
    // remains admissible; this does not run guest code or extend any deadline.
    if(this.armRecord&&this.begun&&!this.failed)
      await new Promise(resolve=>setTimeout(resolve,Math.max(0,this.armRecord.releaseDeadline-Date.now())));
  }
}
module.exports={ChildObservation,identity,hash,publish};
