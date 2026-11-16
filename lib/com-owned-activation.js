'use strict';
// Authenticated activation metadata and opaque tickets; no guest pointers leave their owner.
const {randomBytes}=require('node:crypto');
const token=()=>randomBytes(16).toString('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const guid=value=>{if(typeof value!=='string'||!/^[0-9a-f]{32}$/.test(value)||/^0+$/.test(value))fail('EINVAL');return value;};
const SERVER_FAILURE=0x80080005,CLASS_NOT_REGISTERED=0x80040154;
class OwnedComActivation {
 constructor(authority,{now=()=>performance.now(),timeout=60000}={}) {
  this.a=authority;this.now=now;this.timeout=timeout;
  this.classes=new Map();this.jobs=new Map();this.launches=new Map();this.serial=0;
 }
 owner(session,descriptor){return this.a.owner(session,descriptor);}
 live(row){try{return this.owner(row.session,row.owner)===row.owner;}catch{return false;}}
 publish(session,descriptor,clsid,context,flags,cookie) {
  const owner=this.owner(session,descriptor);guid(clsid);
  if(!Number.isInteger(context)||!context||(context&~5)||
     !Number.isInteger(flags)||flags<0||flags>2||((context&1)&&flags===0)||
     !Number.isInteger(cookie)||cookie<1||cookie>0xffffffff)fail('EINVAL');
  if(this.classes.size>=4096)fail('ENOSPC');
  const id=token();
  this.classes.set(id,{id,session,owner,clsid,context,flags,cookie,public:true,calls:0,serial:++this.serial});
  this.launches.delete(clsid);
  return id;
 }
 classFor(clsid,context,caller) {
  let found;
  for(const row of this.classes.values()) {
   if(!row.public||row.clsid!==clsid||!this.live(row))continue;
   // Cross-process publication is LOCAL_SERVER only. An in-process class is
   // visible only on the registering authenticated connection.
   const visible=(row.context&4?4:0)|(row.session===caller?(row.context|(row.flags===1?1:0)):0);
   if((visible&context)&&(!found||row.serial>found.serial))found=row;
  }
  return found;
 }
 available(session,descriptor,clsid,context){this.owner(session,descriptor);return !!this.classFor(guid(clsid),context,session);}
 local(session,descriptor,clsid,context) {
  const owner=this.owner(session,descriptor),registration=this.classFor(guid(clsid),context,session);
  if(!registration||registration.session!==session||registration.owner!==owner)return null;
  if(this.jobs.size>=4096)fail('ENOSPC');
  const row={id:token(),session,owner,registration,state:'executing-local'};
  registration.calls++;if(registration.flags===0)registration.public=false;this.jobs.set(row.id,row);
  return {ticket:row.id,registration:registration.id,cookie:registration.cookie};
 }
 finishLocal(session,descriptor,id) {
  const row=this.ownedJob(session,descriptor,id);
  if(row.state!=='executing-local')fail('ESTALE');
  this.owner(row.registration.session,row.registration.owner);
  row.registration.calls--;this.jobs.delete(id);return true;
 }
 revoke(session,descriptor,id) {
  const owner=this.owner(session,descriptor),row=this.classes.get(id);
  if(!row||row.session!==session||row.owner!==owner)fail('ESTALE');
  row.public=false;return row.calls;
 }
 finishRevoke(session,descriptor,id) {
  const owner=this.owner(session,descriptor),row=this.classes.get(id);
  if(!row||row.session!==session||row.owner!==owner||row.public||row.calls)fail('ESTALE');
  this.classes.delete(id);return true;
 }
 begin(session,descriptor,{clsid,iid,context,kind,command}) {
  const owner=this.owner(session,descriptor);guid(clsid);guid(iid);
  if(!Number.isInteger(context)||!context||(context&~5)||!['create','class'].includes(kind)||
     (command!==null&&(typeof command!=='string'||!command||command.length>32760||command.includes('\0'))))fail('EINVAL');
  if(this.jobs.size>=4096)fail('ENOSPC');
  const row={id:token(),session,owner,clsid,iid,context,kind,command,deadline:this.now()+this.timeout,state:'waiting'};
  const prior=this.launches.get(clsid);
  if(prior&&this.live(prior)&&this.now()<prior.deadline&&prior.command!==command)fail('ESTALE');
  this.jobs.set(row.id,row);this.route(row);
  const launch=this.claimLaunch(row);
  if(row.state==='waiting'&&command===null&&!this.launches.has(clsid)){
   row.state='completed';row.hresult=CLASS_NOT_REGISTERED;
  }
  return {ticket:row.id,launch};
 }
 claimLaunch(row) {
  if(row.state!=='waiting')return null;
  // Admission and existing-claim expiry share one clock observation. A poll
  // may cross its deadline between its outer guard and this launch claim.
  const now=this.now();
  if(now>=row.deadline){row.state='completed';row.hresult=SERVER_FAILURE;return null;}
  let existing=this.launches.get(row.clsid);
  if(existing&&(!this.live(existing)||now>=existing.deadline)){
   this.launches.delete(row.clsid);existing=null;
  }
  if(existing&&existing.command!==row.command)fail('ESTALE');
  if(existing||row.command===null)return null;
  const id=token();
  this.launches.set(row.clsid,{id,command:row.command,session:row.session,owner:row.owner,deadline:row.deadline});
  return id;
 }
 route(row) {
  if(row.state!=='waiting')return;
  if(this.now()>=row.deadline){row.state='completed';row.hresult=SERVER_FAILURE;return;}
  const registration=this.classFor(row.clsid,row.context,row.session);
  if(!registration)return;
  registration.calls++;row.registration=registration;row.state='queued';
  if(registration.flags===0)registration.public=false;
 }
 ownedJob(session,descriptor,id){
  const owner=this.owner(session,descriptor),row=this.jobs.get(id);
  if(!row||row.reported||row.session!==session||row.owner!==owner)fail('ESTALE');return row;
 }
 launchFailed(session,descriptor,clsid,id,hresult=SERVER_FAILURE) {
  const owner=this.owner(session,descriptor),launch=this.launches.get(guid(clsid));
  if(!launch||launch.id!==id||launch.session!==session||launch.owner!==owner)fail('ESTALE');
  if(!Number.isInteger(hresult)||hresult<0x80000000||hresult>0xffffffff)fail('EINVAL');
  this.launches.delete(clsid);
  for(const row of this.jobs.values())if(row.clsid===clsid&&row.state==='waiting'){
   row.state='completed';row.hresult=hresult;
  }
  return true;
 }
 poll(session,descriptor,id) {
  const row=this.ownedJob(session,descriptor,id);this.route(row);
  if(row.registration&&!this.live(row.registration)){
   this.cancelRow(row);row.reported=true;return {hresult:SERVER_FAILURE,reference:null};
  }
  if(this.now()>=row.deadline){
   this.cancelRow(row);row.reported=true;return {hresult:SERVER_FAILURE,reference:null};
  }
  if(row.state==='waiting'){
   const launch=this.claimLaunch(row);
   if(launch)return {pending:true,launch,command:row.command};
  }
  if(row.state!=='completed')return null;
  if(row.hresult>>>31)this.jobs.delete(row.id);
  else {row.reported=true;row.state='delivered';}
  return {hresult:row.hresult,reference:row.reference||null};
 }
 finish(session,descriptor,id) {
  const owner=this.owner(session,descriptor),row=this.jobs.get(id);
  if(!row||row.session!==session||row.owner!==owner||row.state!=='delivered')fail('ESTALE');
  this.discard(row.reference);this.jobs.delete(id);return true;
 }
 take(session,descriptor) {
  const owner=this.owner(session,descriptor);
  for(const row of this.jobs.values()){
   this.route(row);
   if(row.state!=='queued'||row.registration.session!==session||row.registration.owner!==owner)continue;
   if(!this.live(row)){this.cancelRow(row);continue;}
   if(this.now()>=row.deadline){
    row.registration.calls--;row.state='completed';row.hresult=SERVER_FAILURE;continue;
   }
   row.state='executing';
   return {ticket:row.id,registration:row.registration.id,cookie:row.registration.cookie,
    clsid:row.clsid,iid:row.iid,kind:row.kind};
  }
  return null;
 }
 complete(session,descriptor,id,hresult,reference) {
  const owner=this.owner(session,descriptor),row=this.jobs.get(id);
  if(!row||!['executing','cancelled-executing'].includes(row.state)||
     row.registration.session!==session||row.registration.owner!==owner)fail('ESTALE');
  if(!Number.isInteger(hresult)||hresult<0||hresult>0xffffffff||
     ((hresult>>>31)?reference!=null:!reference))fail('EINVAL');
  if(reference){
   const exported=this.a.lookup(reference);
   if(exported.session!==session||exported.owner!==owner||exported.iid!==row.iid||exported.mode!==0||!exported.packet)fail('ESTALE');
  }
  row.registration.calls--;
  if(row.state==='cancelled-executing'||!this.live(row)){
   this.jobs.delete(id);return false;
  }
  if(this.now()>=row.deadline){
   row.state='completed';row.hresult=SERVER_FAILURE;row.reference=null;return false;
  }
  row.state='completed';row.hresult=hresult;row.reference=reference||null;return true;
 }
 discard(reference) {
  if(!reference)return;
  try{const entry=this.a.lookup(reference);entry.packet=false;this.a.maybeRetire(entry);}catch(error){
   if(!['EDISCONNECTED','ECLOSED','ESTALE'].includes(error.code))throw error;
  }
 }
 cancelRow(row) {
  if(row.state==='executing'||row.state==='cancelled-executing')row.state='cancelled-executing';
  else {
   if(row.state==='queued')row.registration.calls--;
   if(row.state==='completed'||row.state==='delivered')this.discard(row.reference);
   row.reference=null;row.state='cancelled';this.jobs.delete(row.id);
  }
 }
 cancel(session,descriptor,id){const row=this.ownedJob(session,descriptor,id);this.cancelRow(row);return true;}
 retireOwner(session,owner) {
  for(const row of [...this.jobs.values()]) {
   if(row.registration?.session===session&&row.registration.owner===owner){
    if(['queued','executing','executing-local','cancelled-executing'].includes(row.state))row.registration.calls--;
    if(row.state!=='delivered'){row.state='completed';row.hresult=SERVER_FAILURE;}
    row.reference=null;
    if(!this.live(row))this.jobs.delete(row.id);
   }else if(row.session===session&&row.owner===owner)this.cancelRow(row);
  }
  for(const [id,row] of this.classes)if(row.session===session&&row.owner===owner)this.classes.delete(id);
  for(const [clsid,row] of this.launches)if(row.session===session&&row.owner===owner){
   this.launches.delete(clsid);
   for(const job of this.jobs.values())if(job.clsid===clsid&&job.state==='waiting'){
    job.state='completed';job.hresult=SERVER_FAILURE;
   }
  }
 }
}
module.exports={OwnedComActivation};
