'use strict';
const {HResult,HR,IID_UNKNOWN}=require('./com-standard-marshaler');
const IID_CHANNEL='606bf5d53b591a10b56908002b2dbf7a';
const nil='00000000000000000000000000000000';
class ComOwnedProxyHost {
 constructor(marshaler,ids) {
  this.m=marshaler;this.c=marshaler.c;this.t=marshaler.transport;this.ids=ids;
  this.objects=new Map();this.identities=new Map();this.tables={};
  marshaler.invokeStub=(owned,request)=>this.invokeStub(owned,request);
 }
 table(kind) {
  if(!this.tables[kind]) {
   this.tables[kind]=this.c.exports.com_bridge_vtable(this.ids[kind],kind==='unknown'?3:8)>>>0;
   if(!this.tables[kind])throw new HResult(HR.OOM);
  }
  return this.tables[kind];
 }
 object(kind,fields) {
  const address=this.m.allocate(12),vtable=this.table(kind);
  this.c.putWord(address,vtable);this.c.putWord(address+4,kind==='unknown'?0x434f4d55:0x434f4d43);
  const row={address,vtable,kind,refs:1,...fields};this.objects.set(address,row);return row;
 }
 get(address) {
  this.c.check();const row=this.objects.get(address);
  if(!row||this.c.word(address)!==row.vtable||row.refs<1)throw new Error('COM stale native object');
  return row;
 }
 async unmarshal(stream,iidAddress,out) {
  if(out)this.c.putWord(out,0);if(!stream||!iidAddress||!out)return HR.POINTER;
  try{return await this.unmarshalReference(await this.m.readReference(stream),iidAddress,out);}
  catch(error){if(error instanceof HResult)return error.value;throw error;}
 }
 async unmarshalReference(reference,iidAddress,out,importedLease=null) {
  if(out)this.c.putWord(out,0);if(!reference||!iidAddress||!out)return HR.POINTER;
  let lease=importedLease,root,proxy=0,channel,factory=0,address=0,installed=false;
  try {
   const asked=this.m.guid(iidAddress);
   // Unsupported remote QI must never be misreported as E_NOINTERFACE.
   if(asked!==nil&&asked!==reference.iid&&asked!==IID_UNKNOWN)throw new HResult(HR.NOTIMPL);
   if(reference.iid!==IID_UNKNOWN)factory=await this.m.factory(reference.iid);
   if(lease)await this.t.probe(reference,lease);else lease=await this.t.consume(reference);
   const identity=reference.oxid+':'+reference.oid;
   root=this.identities.get(identity);
   if(!root){root=this.object('unknown',{identity,interfaces:new Map(),leases:[],retiring:false});this.identities.set(identity,root);}
   else root.refs++;
   if(reference.iid===IID_UNKNOWN) {
    root.leases.push(lease);this.c.putWord(out,root.address);return 0;
   }
   let iface=root.interfaces.get(reference.iid);
   if(iface){
    await this.c.call(iface.address,1);root.leases.push(lease);
    await this.m.release(factory);factory=0;await this.releaseRoot(root);
    this.c.putWord(out,asked===IID_UNKNOWN?root.address:iface.address);return 0;
   }
   channel=this.object('channel',{reference,lease,buffers:new Map(),server:false});
   const scratch=this.m.allocate(24);this.m.write(scratch,Uint8Array.from(reference.iid.match(/../g),x=>parseInt(x,16)));
   let hr=await this.c.call(factory,3,[root.address,scratch,scratch+16,scratch+20]);
   proxy=this.c.word(scratch+16);address=this.c.word(scratch+20);this.m.free(scratch);
   if(hr>>>31)throw new HResult(hr);if(!proxy||!address)throw new HResult(HR.NOINTERFACE);
   hr=await this.c.call(proxy,3,[channel.address]);if(hr>>>31)throw new HResult(hr);
   root.interfaces.set(reference.iid,{address,proxy,channel});root.leases.push(lease);installed=true;
   await this.releaseChannel(channel);channel=null;
   await this.m.release(factory);factory=0;
   // CreateProxy's returned interface owns the delegating reference. Drop the
   // constructor's controlling-IUnknown reference, preserving that real ref.
   await this.releaseRoot(root);
   this.c.putWord(out,asked===IID_UNKNOWN?root.address:address);return 0;
  }catch(error){
   if(!(error instanceof HResult))throw error;
   if(factory)await this.m.release(factory);
   // Keep cleanup on the same guest continuation. A trap is never converted
   // into a success HRESULT and never restores an abandoned parent frame.
   if(installed)throw new Error('COM failure after proxy publication');
   // The construction reference keeps the root alive while the real returned
   // interface releases its delegating reference. Nothing is published yet.
   if(address)await this.m.release(address);
   if(proxy){await this.c.call(proxy,4);await this.m.release(proxy);}
   if(channel&&this.objects.has(channel.address))await this.releaseChannel(channel);
   if(lease)await this.t.releaseProxy(lease);
   if(root)await this.releaseRoot(root);
   return error.value;
  }
 }
 async queryInterface(root,iidAddress,out) {
  const iid=this.m.guid(iidAddress),lease=root.leases[0];
  if(!lease)return HR.DISCONNECTED;
  const token=this.c.exports.com_owner_token();
  const check=()=>{this.c.check(token);if(this.m.guid(iidAddress)!==iid)throw new Error('COM QI input changed');};
  root.refs++;let ticket=null,polled=false,retained=false;
  try {
   check();
   ticket=await this.t.queryInterface(lease.reference,lease,iid);
   const deadline=performance.now()+30000;let response;
   while(!(response=await this.t.poll(ticket))) {
    check();if(performance.now()>deadline)throw new HResult(HR.DISCONNECTED);
    await this.m.drain();check();await new Promise(resolve=>setTimeout(resolve,2));check();
   }
   check();polled=true;
   if(response.hresult>>>31)return response.hresult;
   const hr=await this.unmarshalReference(response.reference,iidAddress,out,response.lease);
   return hr>>>31?hr:response.hresult;
  }catch(error){
   if(!(error instanceof HResult)){retained=true;throw error;}
   try{check();}catch(fault){retained=true;throw fault;}
   return error.value;
  }finally{
   // A trap keeps its live continuation. Ordinary failures release this call's
   // pin and cancel queued/in-flight work without replaying any guest frame.
   if(!retained) {
    check();
    if(ticket&&!polled)try{await this.t.cancelQuery(ticket);}catch(error){
     if(!(error instanceof HResult)||error.value!==HR.DISCONNECTED)throw error;
    }
    check();
    await this.releaseRoot(root);
   }
  }
 }
 async releaseRoot(root) {
  if(root.retiring||root.refs<1)throw new Error('COM invalid proxy refcount');
  const count=--root.refs;if(count)return count;
  root.retiring=true;
  for(const iface of root.interfaces.values()) {
   await this.c.call(iface.proxy,4);await this.m.release(iface.proxy);
  }
  for(const lease of root.leases)await this.t.releaseProxy(lease);
  this.identities.delete(root.identity);this.objects.delete(root.address);this.m.free(root.address);
  await this.m.drain();return 0;
 }
 async releaseChannel(row) {
  if(row.refs<1)throw new Error('COM invalid channel refcount');
  const count=--row.refs;if(count)return count;
  if(row.buffers.size)throw new Error('COM channel released with active buffers');
  this.objects.delete(row.address);this.m.free(row.address);return 0;
 }
 message(address) {
  this.c.view(address,44);return {representation:this.c.word(address+4),buffer:this.c.word(address+8),
   size:this.c.word(address+12),method:this.c.word(address+16),flags:this.c.word(address+40)};
 }
 buffer(row,message) {
  const size=this.c.word(message+12);if(size>1048576)throw new HResult(HR.INVALID);
  if(row.server&&row.message!==message)throw new HResult(HR.INVALID);
  const address=this.m.allocate(Math.max(1,size));row.buffers.set(address,{message,size});
  this.c.putWord(message+8,address);return 0;
 }
 freeBuffer(row,message) {
  const pointer=this.c.word(message+8),allocation=row.buffers.get(pointer);
  if(!allocation||allocation.message!==message)throw new HResult(HR.INVALID);
  row.buffers.delete(pointer);this.m.free(pointer);this.c.putWord(message+8,0);return 0;
 }
 async send(row,message,status) {
  if(row.server||!status)throw new HResult(HR.INVALID);
  const request=this.message(message),allocation=row.buffers.get(request.buffer);
  if(!allocation||allocation.message!==message||request.size>allocation.size)throw new HResult(HR.INVALID);
  this.c.putWord(status,0);
  const ticket=await this.t.submit(row.reference,row.lease,{method:request.method,representation:request.representation,
   flags:request.flags,bytes:this.m.read(request.buffer,request.size)});
  const deadline=performance.now()+30000;let response;
  while(!(response=await this.t.poll(ticket))) {
   this.c.check();if(performance.now()>deadline)throw new HResult(HR.DISCONNECTED);
   await this.m.drain();await new Promise(resolve=>setTimeout(resolve,2));this.c.check();
  }
  this.freeBuffer(row,message);this.c.putWord(message+12,response.bytes.length);this.buffer(row,message);
  this.m.write(this.c.word(message+8),response.bytes);this.c.putWord(status,response.status);return response.hresult;
 }
 async invokeStub(owned,request) {
  const message=this.m.allocate(44),channel=this.object('channel',{
   server:true,message,buffers:new Map(),reference:owned.reference});
  this.c.putWord(message+4,request.representation);this.c.putWord(message+12,request.bytes.length);
  this.c.putWord(message+16,request.method);this.c.putWord(message+40,request.flags);
  this.buffer(channel,message);this.m.write(this.c.word(message+8),request.bytes);
  const hr=await this.c.call(owned.stub,5,[message,channel.address]);
  const reply=this.message(message),allocation=channel.buffers.get(reply.buffer);
  if(!allocation||allocation.message!==message||reply.size>allocation.size)throw new Error('COM invalid actual stub reply');
  const bytes=this.m.read(reply.buffer,reply.size);
  // The real stub may allocate a new reply through GetBuffer. Retire both the
  // original request and replacement only after it has returned completely.
  for(const pointer of channel.buffers.keys())this.m.free(pointer);channel.buffers.clear();
  await this.releaseChannel(channel);this.m.free(message);
  await this.t.complete(request.ticket,{hresult:hr,status:0,bytes});
 }
 async operation(op,args) {
  const row=this.get(args[0]);
  if(op>=4&&op<=6) {
   if(row.kind!=='unknown'||row.retiring)throw new Error('COM invalid controlling unknown');
   if(op===5)return ++row.refs;
   if(op===6)return this.releaseRoot(row);
   const [,iidAddress,out]=args;if(out)this.c.putWord(out,0);if(!iidAddress||!out)return HR.POINTER;
   const iid=this.m.guid(iidAddress),iface=row.interfaces.get(iid);
   if(iid!==IID_UNKNOWN&&!iface)return this.queryInterface(row,iidAddress,out);
   this.c.putWord(out,iid===IID_UNKNOWN?row.address:iface.address);row.refs++;return 0;
  }
  if(row.kind!=='channel')throw new Error('COM invalid channel');
  if(op===7) {
   const [,iidAddress,out]=args;if(out)this.c.putWord(out,0);if(!iidAddress||!out)return HR.POINTER;
   const iid=this.m.guid(iidAddress);if(iid!==IID_UNKNOWN&&iid!==IID_CHANNEL)return HR.NOINTERFACE;
   row.refs++;this.c.putWord(out,row.address);return 0;
  }
  if(op===8)return ++row.refs;
  if(op===9)return this.releaseChannel(row);
  if(op===10){if(!args[1]||!args[2])return HR.POINTER;
   if(this.m.guid(args[2])!==row.reference.iid)return HR.INVALID;return this.buffer(row,args[1]);}
  if(op===11)return this.send(row,args[1],args[2]);
  if(op===12)return this.freeBuffer(row,args[1]);
  if(op===13){if(!args[1]||!args[2])return HR.POINTER;this.c.putWord(args[1],0);this.c.putWord(args[2],0);return 0;}
  if(op===14){if(!row.server)await this.t.probe(row.reference,row.lease);return 0;}
  return HR.NOTIMPL;
 }
}
module.exports={ComOwnedProxyHost};
