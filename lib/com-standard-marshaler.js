'use strict';
const {randomBytes}=require('node:crypto');
const {encodeStandard,decodeStandard,standardExtent}=require('./com-objref');
const IID_UNKNOWN='0000000000000000c000000000000046';
const IID_MARSHAL='0300000000000000c000000000000046';
const IID_FACTORY='d069f5d53b591a10b56908002b2dbf7a';
const HR={INVALID:0x80070057,POINTER:0x80004003,NOINTERFACE:0x80004002,
 NOTIMPL:0x80004001,READ:0x8003001e,WRITE:0x8003001d,OOM:0x8007000e,
 DISCONNECTED:0x80010108,INVALIDOBJREF:0x8001011d};
class HResult extends Error {constructor(value){super('COM HRESULT '+value.toString(16));this.value=value>>>0;}}
const requireSuccess=hr=>{if(hr>>>31)throw new HResult(hr);};
const hexb=hex=>Uint8Array.from(hex.match(/../g),b=>parseInt(b,16));
const tohex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');

// Per-apartment owned native references. Only the authenticated authority
// exports opaque identities; guest addresses below never leave this owner.
class ComStandardMarshaler {
 constructor({continuation,transport,api}) {
  this.c=continuation;this.transport=transport;this.api=api;
  this.exports=new Map();this.objects=new Map();
 }
 allocate(size) {
  this.c.check();const address=this.c.exports.guest_alloc(size)>>>0;
  if(!address)throw new HResult(HR.OOM);
  new Uint8Array(this.c.view(address,size).buffer,this.c.view(address,size).byteOffset,size).fill(0);
  return address;
 }
 free(address){this.c.check();this.c.exports.guest_free(address);}
 read(address,size){const v=this.c.view(address,size);return Uint8Array.from(new Uint8Array(v.buffer,v.byteOffset,size));}
 write(address,bytes){const v=this.c.view(address,bytes.length);new Uint8Array(v.buffer,v.byteOffset,bytes.length).set(bytes);}
 guid(address){return tohex(this.read(address,16));}
 async qi(object,iid) {
  const scratch=this.allocate(20);this.write(scratch,hexb(iid));
  const hr=await this.c.call(object,0,[scratch,scratch+16]);
  const pointer=this.c.word(scratch+16);this.free(scratch);
  return {hr,pointer};
 }
 async release(object){if(object)await this.c.call(object,2);}
 async factory(iid) {
  const scratch=this.allocate(56);this.write(scratch,hexb(iid));
  let hr=await this.c.invoke(this.api.CoGetPSClsid,[scratch,scratch+16]);
  if(hr>>>31){this.free(scratch);throw new HResult(hr);}
  this.write(scratch+32,hexb(IID_FACTORY));
  hr=await this.c.invoke(this.api.CoGetClassObject,[scratch+16,1,0,scratch+32,scratch+48]);
  const result=this.c.word(scratch+48);this.free(scratch);requireSuccess(hr);
  if(!result)throw new HResult(HR.NOINTERFACE);return result;
 }
 async transfer(stream,writing,bytesOrCount) {
  const count=writing?bytesOrCount.length:bytesOrCount;
  if(!stream||!Number.isInteger(count)||count<0||count>1048576)throw new HResult(HR.INVALID);
  const scratch=this.allocate(count+4);
  if(writing)this.write(scratch,bytesOrCount);
  const hr=await this.c.call(stream,writing?4:3,[scratch,count,scratch+count]);
  const actual=this.c.word(scratch+count),result=writing?null:this.read(scratch,count);
  this.free(scratch);requireSuccess(hr);
  if(actual!==count)throw new HResult(writing?HR.WRITE:HR.READ);
  return result;
 }
 async readReference(stream) {
  const head=await this.transfer(stream,false,68);let extent;
  try{extent=standardExtent(head);}catch(e){throw new HResult(HR.INVALIDOBJREF);}
  let all=head;
  if(extent>68){all=new Uint8Array(extent);all.set(head);all.set(await this.transfer(stream,false,extent-68),68);}
  let decoded;
  try{decoded=decodeStandard(all);}catch(e){throw new HResult(e.code==='E_NOTIMPL'?HR.NOTIMPL:HR.INVALIDOBJREF);}
  // Binding-bearing packets require an external resolver/security contract.
  if(decoded.bindings.length)throw new HResult(HR.NOTIMPL);
  return decoded.reference;
 }
 async marshal(stream,iidAddress,object,context,reserved,mode) {
  if(!stream||!iidAddress||!object)return HR.POINTER;
  if(reserved||mode>2)return HR.INVALID;
  if(mode===2)return HR.NOTIMPL;
  if(context!==0)return HR.NOTIMPL;
  return this.marshalWith(iidAddress,object,mode,reference=>this.transfer(stream,true,encodeStandard(reference)));
 }
 async marshalReference(iidAddress,object) {
  let reference=null;
  const hresult=await this.marshalWith(iidAddress,object,0,packet=>{reference=packet;});
  return {hresult,reference:hresult>>>31?null:reference};
 }
 async marshalWith(iidAddress,object,mode,publish) {
  const iid=this.guid(iidAddress);
  if(/^0+$/.test(iid))return HR.INVALID;
  let canonical=0,stub=0,factory=0,reference=null,committed=false,objectKey;
  try {
   let q=await this.qi(object,IID_MARSHAL);
   if(!(q.hr>>>31)) {
    if(!q.pointer)throw new HResult(HR.NOINTERFACE);
    // A genuine custom marshaler must not silently receive standard bytes.
    // It needs GetUnmarshalClass/custom payload handling, not pointer copying.
    await this.release(q.pointer);throw new HResult(HR.NOTIMPL);
   }
   if(q.hr!==HR.NOINTERFACE)throw new HResult(q.hr);
   q=await this.qi(object,IID_UNKNOWN);requireSuccess(q.hr);canonical=q.pointer;
   if(!canonical)throw new HResult(HR.NOINTERFACE);
   q=await this.qi(object,iid);requireSuccess(q.hr);
   if(!q.pointer)throw new HResult(HR.NOINTERFACE);await this.release(q.pointer);
   factory=await this.factory(iid);
   const scratch=this.allocate(20);this.write(scratch,hexb(iid));
   const hr=await this.c.call(factory,4,[scratch,canonical,scratch+16]);
   stub=this.c.word(scratch+16);this.free(scratch);requireSuccess(hr);
   if(!stub)throw new HResult(HR.NOINTERFACE);
   await this.release(factory);factory=0;
   objectKey=this.objects.get(canonical);
   if(!objectKey){objectKey={identity:randomBytes(16).toString('hex'),exports:0};this.objects.set(canonical,objectKey);}
   reference=await this.transport.prepare(iid,mode,objectKey.identity);
   this.exports.set(reference.ipid,{reference,canonical,stub,objectKey});objectKey.exports++;
   await publish(reference);
   await this.transport.commit(reference);committed=true;return 0;
  } catch(error) {
   if(!(error instanceof HResult))throw error;
   if(reference&&!committed){await this.transport.abandon(reference);this.exports.delete(reference.ipid);objectKey.exports--;}
   if(stub){await this.c.call(stub,4);await this.release(stub);}
   if(factory)await this.release(factory);
   if(canonical)await this.release(canonical);
   if(objectKey&&!objectKey.exports)this.objects.delete(canonical);
   return error.value;
  }
 }
 async releaseData(stream) {
  if(!stream)return HR.POINTER;
  try{await this.transport.releaseData(await this.readReference(stream));await this.drain();return 0;}
  catch(error){if(error instanceof HResult)return error.value;throw error;}
 }
 async drain() {
  for(let count=0;count<256;count++) {
   const request=await this.transport.take();if(!request)return;
   const owned=this.exports.get(request.reference.ipid);
   if(!owned||JSON.stringify(owned.reference)!==JSON.stringify(request.reference))throw new Error('COM stale exporter ticket');
   if(request.kind==='retire') {
    await this.c.call(owned.stub,4);await this.release(owned.stub);await this.release(owned.canonical);
    this.exports.delete(request.reference.ipid);
    if(!--owned.objectKey.exports)this.objects.delete(owned.canonical);
    await this.transport.complete(request.ticket);continue;
   }
   // Invocation must be delivered by an actual IRpcChannelBuffer implementation
   // with owner-allocated RPCOLEMESSAGE and real stub vtable slot 5. Refuse a
   // missing adapter before running any substitute object method.
   if(!this.invokeStub)throw new Error('COM owned IRpcStubBuffer channel adapter required');
   await this.invokeStub(owned,request);
  }
 }
}
module.exports={ComStandardMarshaler,HResult,HR,IID_UNKNOWN};
