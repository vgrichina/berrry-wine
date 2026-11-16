'use strict';
// Scheduled live class registration, ordinary process launch, and actual guest factory invocation.
const {HResult,HR}=require('./com-standard-marshaler');
const FACTORY_IID='0100000000000000c000000000000046';
const SERVER_FAILURE=0x80080005,CLASS_NOT_REGISTERED=0x80040154;
const hexb=value=>Uint8Array.from(value.match(/../g),v=>parseInt(v,16));
class ComLocalServerRuntime {
 constructor({marshaler,proxy,api,information}) {
  this.m=marshaler;this.c=marshaler.c;this.t=marshaler.transport;
  Object.assign(this,{proxy,api,information});this.registrations=new Map();this.serial=0;
 }
 async register(clsid,object,context,flags,out) {
  if(out)this.c.putWord(out,0);
  if(!clsid||!object||!out||!context||(context&~5)||flags>2||((context&1)&&flags===0))return HR.INVALID;
  await this.c.call(object,1);
  const cookie=(0x40000000+ ++this.serial)>>>0;
  if(cookie>=0x80000000){await this.m.release(object);return HR.OOM;}
  let id;
  try{id=this.t.call('classPublish',{clsid:this.m.guid(clsid),context,flags,cookie});}
  catch(error){await this.m.release(object);throw error;}
  this.registrations.set(cookie,{cookie,id,object,revoked:false});this.c.putWord(out,cookie);return 0;
 }
 async releaseRevoked(row) {
  if(row.revoked&&!this.t.call('classRevoke',{registration:row.id})){
   await this.m.release(row.object);this.t.call('classFinishRevoke',{registration:row.id});
   this.registrations.delete(row.cookie);
  }
 }
 async revoke(cookie) {
  const row=this.registrations.get(cookie);if(!row||row.revoked)return CLASS_NOT_REGISTERED;
  row.revoked=true;this.t.call('classRevoke',{registration:row.id});await this.releaseRevoked(row);return 0;
 }
 server(clsid,context) {
  if(typeof this.information!=='function')throw new HResult(HR.NOTIMPL);
  const scratch=this.m.allocate(32768);
  let result;
  try {
   const count=this.information(this.c.exports.guest_to_wasm(clsid)>>>0,context,
    this.c.exports.guest_to_wasm(scratch)>>>0,32768)>>>0;
   if(count>>>31)throw new HResult(count);
   if(!count)return null;
   if(count>32768)throw new HResult(HR.INVALID);
   const data=this.m.read(scratch,count);
   if(data[count-1]!==0)throw new HResult(HR.INVALID);
   result=count===1?null:Buffer.from(data.subarray(0,-1)).toString('latin1');
  }finally{this.m.free(scratch);}
  return result;
 }
 async launch(command) {
  const bytes=Buffer.from(command+'\0','latin1');
  const scratch=this.m.allocate(84+bytes.length);this.c.putWord(scratch,68);this.m.write(scratch+84,bytes);
  let handle=0,thread=0,retained=false;
  try {
   const result=await this.c.invoke(this.api.CreateProcessA,[0,scratch+84,0,0,0,0,0,0,scratch,scratch+68]);
   if(!result)throw new HResult(SERVER_FAILURE);
   handle=this.c.word(scratch+68);thread=this.c.word(scratch+72);
   if(!handle||!thread)throw new HResult(SERVER_FAILURE);
   await this.c.invoke(this.api.CloseHandle,[thread]);thread=0;return handle;
  }catch(error){
   // Ordinary launch failure releases acquired handles. A trapped guest child
   // remains owned by its continuation and requires explicit retirement.
   if(!(error instanceof HResult)){retained=true;throw error;}
   if(handle)await this.c.invoke(this.api.CloseHandle,[handle]);
   if(thread)await this.c.invoke(this.api.CloseHandle,[thread]);
   throw error;
  }finally{if(!retained)this.m.free(scratch);}
 }
 async exited(handle) {
  const scratch=this.m.allocate(4);
  try {
   if(!await this.c.invoke(this.api.GetExitCodeProcess,[handle,scratch]))throw new HResult(SERVER_FAILURE);
   return this.c.word(scratch)!==259;
  }finally{this.m.free(scratch);}
 }
 async activate(kind,args) {
  const task=this.activationSteps(kind,args);
  for(;;){const step=await task.next();if(step.done)return step.value;}
 }
 async *activationSteps(kind,args) {
  const [clsid,second,third,iid,out]=args;
  if(out)this.c.putWord(out,0);if(!clsid||!iid||!out)return HR.POINTER;
  const context=kind==='create'?third:second,outer=kind==='create'?second:0;
  if(kind==='class'&&third)return HR.INVALID;
  if(outer)return 0x80040110;
  const local=this.t.call('activationLocal',{clsid:this.m.guid(clsid),context});
  if(local){
   const row=this.registrations.get(local.cookie);
   if(!row||row.id!==local.registration)throw new Error('COM local registration replaced');
   let factory=0,hr;
   try {
    if(kind==='class'){
     hr=await this.c.call(row.object,0,[iid,out]);
    }else{
     const qi=await this.m.qi(row.object,FACTORY_IID);hr=qi.hr;factory=qi.pointer;
     if(!(hr>>>31))hr=factory?await this.c.call(factory,3,[0,iid,out]):HR.NOINTERFACE;
    }
   }catch(error){if(!(error instanceof HResult))throw error;hr=error.value;}
   if(factory)await this.m.release(factory);
   if(!(hr>>>31)&&!this.c.word(out))hr=HR.NOINTERFACE;
   if(hr>>>31){const accidental=this.c.word(out);if(accidental)await this.m.release(accidental);this.c.putWord(out,0);}
   this.t.call('activationFinishLocal',{ticket:local.ticket});if(row.revoked)await this.releaseRevoked(row);return hr;
  }
  const command=this.server(clsid,context),classId=this.m.guid(clsid);
  const begin=this.t.call('activationBegin',{activation:{clsid:classId,iid:this.m.guid(iid),context,kind,command}});
  let consumed=false,delivered=false,retained=false;
  const launched=[];
  const failLaunch=(launch,hresult)=>{
   try{this.t.call('activationLaunchFailed',{clsid:classId,launch,hresult});}
   catch(error){if(!(error instanceof HResult)||error.value!==HR.DISCONNECTED)throw error;}
  };
  const startLaunch=async(launch,exactCommand)=>{
   try{launched.push({launch,handle:await this.launch(exactCommand),failed:false});}
   catch(error){if(!(error instanceof HResult))throw error;failLaunch(launch,error.value);}
  };
  try {
   if(begin.launch)await startLaunch(begin.launch,command);
   for(;;){
    this.c.check();const result=this.t.call('activationPoll',{ticket:begin.ticket});
    if(result?.pending){await startLaunch(result.launch,result.command);continue;}
    if(result){
     consumed=true;if(result.hresult>>>31)return result.hresult;
     delivered=true;
     const unpacked=await this.proxy.unmarshalReference(result.reference,iid,out);
     return unpacked>>>31?unpacked:result.hresult;
    }
    for(const owned of launched)if(!owned.failed&&await this.exited(owned.handle)){
     // A SINGLEUSE publication can be claimed by another caller; a waiting
     // duplicate receives a fresh launch claim without reusing the old one.
     failLaunch(owned.launch,SERVER_FAILURE);owned.failed=true;
    }
    await this.drain();await this.m.drain();
    await new Promise(resolve=>setTimeout(resolve,2));this.c.check();
    // All temporary guest callbacks have returned. Only the owning scheduler
    // may advance this same task; the ticket, handles and frame remain live.
    yield;
   }
  }catch(error){
   if(!(error instanceof HResult))retained=true;
   throw error;
  }finally{
   if(!retained){
    if(delivered)this.t.call('activationFinish',{ticket:begin.ticket});
    if(!consumed)this.t.call('activationCancel',{ticket:begin.ticket});
    for(const owned of launched)await this.c.invoke(this.api.CloseHandle,[owned.handle]);
   }
  }
 }
 async drain() {
  for(let count=0;count<256;count++) {
   const request=this.t.call('activationTake');if(!request)break;
   const row=this.registrations.get(request.cookie);
   if(!row||row.id!==request.registration)throw new Error('COM activation registration replaced');
   const scratch=this.m.allocate(36);this.m.write(scratch,hexb(request.iid));
   let factory=0,object=0,reference=null,hr=0;
   try {
    if(request.kind==='class'){
     const asked=await this.m.qi(row.object,request.iid);hr=asked.hr;object=asked.pointer;
    }else{
     const qi=await this.m.qi(row.object,FACTORY_IID);hr=qi.hr;factory=qi.pointer;
     if(!(hr>>>31)&&!factory)hr=HR.NOINTERFACE;
     if(!(hr>>>31)){
      hr=await this.c.call(factory,3,[0,scratch,scratch+16]);object=this.c.word(scratch+16);
     }
    }
    if(!(hr>>>31)&&!object)hr=HR.NOINTERFACE;
    if(!(hr>>>31)){
     const packet=await this.m.marshalReference(scratch,object);
     if(packet.hresult>>>31)hr=packet.hresult;reference=packet.reference;
    }
   }catch(error){if(!(error instanceof HResult))throw error;hr=error.value;}
   if(object)await this.m.release(object);if(factory)await this.m.release(factory);this.m.free(scratch);
   const accepted=this.t.call('activationComplete',{ticket:request.ticket,hresult:hr,reference});
   if(!accepted&&reference){await this.t.releaseData(reference);await this.m.drain();}
   if(row.revoked)await this.releaseRevoked(row);
  }
  // Cancellation or deadline expiry can remove queued work without returning
  // an invocation ticket. Such work must still release deferred revoke refs.
  for(const row of [...this.registrations.values()])if(row.revoked)await this.releaseRevoked(row);
 }
}
module.exports={ComLocalServerRuntime};
