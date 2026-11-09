'use strict';
// Reuse the deployed atomic JSON publisher and numbered ACK client.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const trace=require('./trace.cjs');
const base=require('./ack-client.cjs');
exports.publish=base.writeJson;
function priorAdmission(out,number,command){
 assert(!fs.existsSync(path.join(out,'first-failure.json'))&&!fs.existsSync(path.join(out,'transport-closed.json')),'UNKNOWN/partial closure is sticky');
 for(let n=0;n<number;n++){
  const file=path.join(out,'reply-'+n+'.json');assert(fs.existsSync(file),'prior command UNKNOWN; no replay');
  const ack=JSON.parse(fs.readFileSync(file));
  const previous=JSON.parse(fs.readFileSync(path.join(out,'commands',n+'.json')));
  assert.equal(ack.id,previous.id,'exact ACK ID');assert(ack.ok,'prior command failed');
  if(ack.status){
   assert(ack.status==='refused-before-dispatch'&&ack.effects===0&&ack.refreshRequired===true,'ambiguous refusal; closed');
   const next=n+1===number?command:JSON.parse(fs.readFileSync(path.join(out,'commands',(n+1)+'.json')));
   assert(next.action==='capture','zero-effect stale refusal permits ONLY fresh capture');
  }
 }
}
// A passive wait belongs to the command's budget. Keep capture/input work,
// ACK delivery and cleanup separately bounded by the original browser cap.
const WORK_MS=20000, ACK_MS=2000, CLEANUP_MS=30000;
function budget(out,command,minimum=1,now=Date.now()){
 assert(Number.isInteger(minimum)&&minimum>=1&&minimum<=55000,'bounded ACK required');
 const window=JSON.parse(fs.readFileSync(path.join(out,'execution-window.json')));
 const runEnd=Date.parse(window.browserStop);
 assert(Number.isFinite(runEnd),'immutable run deadline required');
 const wait=command.action==='quit'?0:command.waitMs;
 assert(Number.isInteger(wait)&&wait>=0&&wait<=30000,'bounded passive wait required');
 const workEnd=now+wait+WORK_MS;
 const ackMs=Math.max(minimum,wait+WORK_MS+ACK_MS);
 assert(ackMs<=55000&&now+ackMs<=runEnd-CLEANUP_MS,'command cannot fit immutable run/cleanup deadlines; not queued');
 return {workEnd,ackEnd:now+ackMs,runEnd,cleanupReserveMs:CLEANUP_MS,waitMs:wait,workMs:WORK_MS};
}
exports.budget=budget;
exports.request=async function(out,id,command,timeout=20000){
 if(command.action==='combo')require('./ordinary-keys.cjs').validateCombo(command.keys,command.holdMs);
 if(command.action==='key')require('./ordinary-keys.cjs').validate(command.key,command.holdMs??100);
 if(['click','doubleclick','drag'].includes(command.action))require('./native-mouse.cjs').validate(command);

 assert(/^[a-zA-Z0-9_-]+$/.test(id),'safe command ID');
 const lock=path.join(out,'writer.lock');fs.mkdirSync(lock);
 try{
  assert(!fs.existsSync(path.join(out,'cleanup.json')),'child exited');
  const timing=budget(out,command,timeout);
  fs.writeFileSync(path.join(out,'id-'+id),JSON.stringify(command),{flag:'wx'});
  const nums=fs.readdirSync(path.join(out,'commands')).filter(n=>/^\d+\.json$/.test(n)).map(n=>Number(n.slice(0,-5)));
  priorAdmission(out,nums.length?Math.max(...nums)+1:0,command);
  try{const ack=await base.commandAck(out,{...command,id,timing},Math.max(1,timing.ackEnd-Date.now()));assert.equal(ack.id,id,'exact ACK ID');return ack;}
  catch(e){base.writeJson(path.join(out,'transport-closed.json'),{at:new Date().toISOString(),id,error:String(e),sticky:true});throw e;}
 }finally{fs.rmdirSync(lock);}
};
exports.consume=async function(out,number,execute){
 const file=path.join(out,'commands',number+'.json');
 if(!fs.existsSync(file))return false;
 // Parse and validate before invoking any input. A malformed final file closes admission.
 try{
  const c=JSON.parse(fs.readFileSync(file,'utf8'));
  assert(typeof c.id==='string'&&/^[a-zA-Z0-9_-]+$/.test(c.id),'command ID');
  assert(!fs.existsSync(path.join(out,'consumed-'+c.id)),'duplicate ID');
  priorAdmission(out,number,c);
  fs.writeFileSync(path.join(out,'consumed-'+c.id),'claimed before execution',{flag:'wx'});
  const window=JSON.parse(fs.readFileSync(path.join(out,'execution-window.json')));
  assert(c.timing&&c.timing.runEnd===Date.parse(window.browserStop),'exact immutable run deadline');
  const {workEnd,ackEnd,runEnd}=c.timing;
  assert(Number.isFinite(workEnd)&&Number.isFinite(ackEnd)&&workEnd> Date.now()&&
    ackEnd>=workEnd+ACK_MS&&ackEnd<=runEnd-CLEANUP_MS&&ackEnd-Date.now()<=55000,'bounded command deadline');
  let dispatched=false,timer;
  try { await Promise.race([
   execute(c,()=>{assert(Date.now()<workEnd,'command work deadline');dispatched=true;}),
   new Promise((_,reject)=>{timer=setTimeout(()=>{trace.snapshot('command work deadline',{number,id:c.id,timing:c.timing});reject(Error('command work deadline; never resend'));},Math.max(0,workEnd-Date.now()));})
  ]); }
  catch(e){
   if(e.code==='STALE_SCENE_BEFORE_DISPATCH'&&!dispatched){
    base.writeJson(path.join(out,'reply-'+number+'.json'),{ok:true,id:c.id,status:'refused-before-dispatch',effects:0,refreshRequired:true,error:String(e)});return true;
   }
   throw e;
  }finally{clearTimeout(timer);}
  base.writeJson(path.join(out,'reply-'+number+'.json'),{ok:true,id:c.id});return true;
 }catch(e){base.writeJson(path.join(out,'first-failure.json'),{at:new Date().toISOString(),number,error:String(e),noReplay:true});throw e;}
};
exports.closed=(out,code)=>base.writeJson(path.join(out,'cleanup.json'),{at:new Date().toISOString(),code,pending:'UNKNOWN; never replay'});
