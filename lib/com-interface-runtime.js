'use strict';
const {createHash}=require('node:crypto');
const fs=require('node:fs');
const {ComGuestContinuation,serviceComIoWait}=require('./com-guest-continuation');
const {ComStandardMarshaler,HResult,HR}=require('./com-standard-marshaler');
const {ComOwnedProxyHost}=require('./com-owned-proxy');
const {ComOwnedTransport}=require('./com-owned-transport');
const {ComLocalServerRuntime}=require('./com-owned-localserver');
const {NativeAutomation}=require('./com-automation-native');
const {NativeVariant}=require('./com-variant-native');
const ARGUMENTS=[0,6,3,1,3,1,1,3,1,1,3,3,2,3,1,5,1,5,5,5,4,1,2,2,1,2,3,3];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
class ComInterfaceRuntime {
 constructor({getExports,getMemory,getVfs,desktop,serviceYield,modulePin,sourcePin,information,isRetired=()=>false,scheduledActivation=false}) {
  Object.assign(this,{getExports,getMemory,getVfs,desktop,serviceYield,modulePin,sourcePin,information,isRetired,scheduledActivation});
  this.pending=new Map();this.runtime=null;
 }
 stamp() {
  if(this.isRetired()&&!this.runtime?.c.cleanupContext.getStore())throw new Error('COM owner retiring');
  return this.ownerStamp();
 }
 ownerStamp() {
  const e=this.getExports();
  return [e.get_current_thread_id(),e.com_owner_epoch().toString(),e.com_owner_root().toString()].join(':');
 }
 enqueue(operation,frame,thread) {
  // A native VARIANT fast path must consume a parked callback result before
  // inspecting its now-replaced destination. Queries never create work.
  const query=operation>=0x100; if(query)operation-=0x100;
  if(!Number.isInteger(operation)||operation<1||operation>=ARGUMENTS.length)throw new Error('COM invalid operation');
  const stamp=this.stamp(),key=thread+':'+(frame>>>0),record=this.pending.get(key);
  if((this.getExports().get_current_thread_id()>>>0)!==(thread>>>0))throw new Error('COM wrong caller thread');
  if(record){if(record.abandoned||record.stamp!==stamp||record.operation!==operation)throw new Error('COM stale frame');return query?1:record.complete?0:1;}
  if(query)return 0;
  this.pending.set(key,{operation,frame:frame>>>0,thread:thread>>>0,stamp,complete:false});return 1;
 }
 result(frame,thread) {
  const key=thread+':'+(frame>>>0),record=this.pending.get(key);
  if(!record?.complete||record.abandoned||record.stamp!==this.stamp())throw new Error('COM missing result');
  this.pending.delete(key);return record.result;
 }
 initialize() {
  if(this.runtime)return this.runtime;
  const e=this.getExports(),memory=this.getMemory(),identity=this.stamp();
  if(!/^[0-9a-f]{64}$/.test(this.modulePin)||!/^[0-9a-f]{64}$/.test(this.sourcePin))throw new Error('COM owner source/module pins required');
  const c=new ComGuestContinuation({exports:e,memory,identity,currentIdentity:()=>this.ownerStamp(),isRetired:this.isRetired,
   currentExports:this.getExports,currentMemory:this.getMemory,
   serviceYield:async wait=>{
    if(wait.reason===23){await this.service();return true;}
    if(wait.reason===12)return serviceComIoWait(wait,e,this.getVfs?.());
    return this.serviceYield(wait);
   }});
  const transport=new ComOwnedTransport(this.desktop,{thread:e.get_current_thread_id(),
   generation:e.com_owner_root().toString(),source:this.sourcePin,module:this.modulePin});
  const table=require('../src/api_table.json'),api={};
  for(const name of ['CoGetPSClsid','CoGetClassObject','CreateProcessA','GetExitCodeProcess','CloseHandle',
    'ComAutomationOperation','RegOpenKeyExA','RegQueryValueExA','RegCloseKey','CLSIDFromString','LoadRegTypeLib','GetUserDefaultLCID']) {
   const id=table.find(row=>row.name===name)?.id;if(!id)throw new Error('COM API not installed: '+name);
   const v=e.com_bridge_vtable(id,1)>>>0;if(!v)throw new HResult(HR.OOM);api[name]=c.word(v);e.guest_free(v);
  }
  const m=new ComStandardMarshaler({continuation:c,transport,api});
  const proxy=new ComOwnedProxyHost(m,{unknown:table.find(row=>row.name==='ComOwnedUnknown_QueryInterface')?.id,
   channel:table.find(row=>row.name==='ComOwnedChannel_QueryInterface')?.id});
  const localServer=new ComLocalServerRuntime({marshaler:m,proxy,api,information:this.information});
  const automation=new NativeAutomation(m,proxy,api);
  return this.runtime={c,m,proxy,transport,localServer,automation};
 }
 async service() {
  const e=this.getExports(),frame=e.get_esp()>>>0,thread=e.get_current_thread_id()>>>0;
  const record=this.pending.get(thread+':'+frame);
  if(!record||record.complete||record.abandoned||record.stamp!==this.stamp()||e.get_yield_reason()!==23){
   if(record&&!record.complete)record.abandoned=true;
   for(const pending of this.pending.values())
    if(pending.activation&&!pending.complete)pending.abandoned=true;
   throw new Error('COM operation no longer owns suspended guest');
  }
  if(record.servicing)throw new Error('COM concurrent service of same frame');
  record.servicing=true;
  try {
  const {c,m,proxy,localServer,automation}=this.initialize();c.check();
  const args=Array.from({length:ARGUMENTS[record.operation]},(_,i)=>c.word(frame+4+i*4));
  let result;
  try {
   if(record.operation===1)result=await m.marshal(...args);
   else if(record.operation===2)result=await proxy.unmarshal(...args);
   else if(record.operation===3)result=await m.releaseData(...args);
   else if(record.operation===15)result=await localServer.register(...args);
   else if(record.operation===16)result=await localServer.revoke(...args);
   else if(record.operation===19)result=await automation.factory(args);
   else if(record.operation===20)result=await automation.operation(args);
   else if(record.operation>=21)result=await new NativeVariant(m).operation(record.operation,args);
   else if(record.operation===17||record.operation===18){
    if(this.scheduledActivation&&(record.activation||!c.frames.length)){
     if(c.frames.length)throw new Error('COM activation checkpoint has child frame');
     const boundary=()=>[
      ...['eax','ecx','edx','ebx','esp','ebp','esi','edi'].map(name=>e['get_'+name]()>>>0),
      e.get_eip()>>>0,e.get_fs_base()>>>0,e.get_handler_set_eip()>>>0,
      e.get_yield_flag()>>>0,e.com_callback_get_thunk()>>>0,
      e.get_fs_base()?c.word(e.get_fs_base()>>>0):0,
      ...Array.from({length:6},(_,i)=>c.word(frame+i*4)),
      args[0]?m.guid(args[0]):'',args[3]?m.guid(args[3]):'',
     ].join(':');
     if(!record.activation){
      record.activationToken=e.com_owner_token();c.check(record.activationToken);
      record.activationBoundary=boundary();
      record.activation=localServer.activationSteps(record.operation===17?'create':'class',args);
      record.validateActivation=()=>{
       c.check(record.activationToken);
       if(c.frames.length)throw new Error('COM activation checkpoint has child frame');
       if(record.stamp!==this.stamp()||e.get_yield_reason()!==23||(e.get_esp()>>>0)!==frame||
          record.activationBoundary!==boundary())throw new Error('COM activation frame changed');
      };
     }
     record.validateActivation();
     let step;
     try {step=await record.activation.next();}
     finally {record.validateActivation();}
     if(!step.done)return false;
     result=step.value;
    }else result=await localServer.activate(record.operation===17?'create':'class',args);
   }
   else result=await proxy.operation(record.operation,args);
  }catch(error){if(error instanceof HResult)result=error.value;else throw error;}
  c.check();
  if(record.stamp!==this.stamp()||(e.get_esp()>>>0)!==frame||e.get_yield_reason()!==23)
   throw new Error('COM suspended frame replaced');
  record.result=result>>>0;record.complete=true;e.set_yield_state(0,0);e.set_handler_set_eip(0);
  return true;
  }catch(error){
   record.abandoned=true;
   // A failed nested API has no consumer: its enclosing native callback is
   // unwinding. Root operations remain fenced against replay by the scheduler.
   if(this.runtime?.c.frames.length)this.pending.delete(thread+':'+frame);
   throw error;
  }
  finally{record.servicing=false;}
 }
 async drain() {
  if(!this.runtime)return;
  const parked=[...this.pending.values()].filter(record=>record.activation&&!record.complete);
  if(parked.some(record=>record.servicing))throw new Error('COM concurrent drain of active frame');
  const validate=()=>{for(const record of parked){
   if(record.abandoned)throw new Error('COM operation no longer owns suspended guest');
   record.validateActivation();
  }};
  try {
   validate();this.runtime.c.check();await this.runtime.localServer.drain();
   validate();await this.runtime.m.drain();validate();
  }catch(error){for(const record of parked)record.abandoned=true;throw error;}
 }
}
// Hash the actual loaded runtime sources. A caller separately supplies the
// byte hash of its actually instantiated module, rather than a filename claim.
function comRuntimeSourcePin() {
 const names=['com-interface-runtime.js','com-guest-continuation.js','com-standard-marshaler.js',
  'com-owned-proxy.js','com-owned-transport.js','com-objref.js','com-owned-channel.js',
  'com-owned-activation.js','com-owned-localserver.js','com-automation-native.js','com-automation-contracts.js','com-automation-types.js','com-variant-native.js'];
 return sha(Buffer.concat(names.map(name=>Buffer.concat([Buffer.from(name+'\0'),fs.readFileSync(require.resolve('./'+name))]))));
}
module.exports={ComInterfaceRuntime,comRuntimeSourcePin};
