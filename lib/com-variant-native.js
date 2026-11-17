'use strict';
const {HResult}=require('./com-standard-marshaler');

// Only interface lifetime calls leave WAT. Values remain native VARIANT bytes
// in this exact owner's memory; no Automation wire/value codec is involved.
class NativeVariant {
 constructor(m){this.m=m;this.c=m.c;this.e=this.c.exports;}
 tag(p){return this.c.view(p,2).getUint16(0,true);}
 native(name,...args){
  this.c.check();const eax=this.e.get_eax(),esp=this.e.get_esp();
  try{this.e[name](...args);return this.e.get_eax()>>>0;}
  finally{this.e.set_eax(eax);this.e.set_esp(esp);}
 }
 arrayRefs(sa){
  if(!sa)return [];
  if(!(this.c.view(sa+2,2).getUint16(0,true)&0x800))return [];
  let count=1;const dims=this.tag(sa),data=this.c.word(sa+12),refs=[];
  for(let i=0;i<dims;i++)count*=this.c.word(sa+16+i*8);
  for(let i=0;i<count;i++)refs.push(...this.refs(data+i*16));
  return refs;
 }
 refs(p){
  const vt=this.tag(p);if(vt&0x4000)return [];
  if(vt&0x2000)return this.arrayRefs(this.c.word(p+8));
  const object=vt===9||vt===13?this.c.word(p+8):0;return object?[object]:[];
 }
 // Validate callback slots before changing any references. Callback execution
 // still uses the real guest vtable and the existing owner-thread continuation.
 methods(refs,slot){for(const object of refs){const table=this.c.word(object);if(!table||!this.c.word(table+slot*4))throw new Error('COM null method');}}
 async releaseRefs(refs){this.methods(refs,2);for(const object of refs)await this.m.release(object);}
 async clear(p){
  this.c.check();const hr=this.e.variant_clear_native(p,0)>>>0;if(hr!==0xffffffff)return hr;
  await this.releaseRefs(this.refs(p));this.c.check();
  return this.e.variant_clear_native(p,1)>>>0;
 }
 async operation(op,args){
  if(op>=24)return this.arrayOperation(op,args);
  if(op===21)return this.clear(args[0]);
  const [dst,src]=args;this.c.check();
  const direct=this.e.variant_copy_native(dst,src,op===23?1:0,0)>>>0;
  if(direct!==0xffffffff)return direct;
  const hr=this.e.variant_clear_check(dst)>>>0;if(hr)return hr;
  return this.copy(dst,src,op===23);
 }
 async copy(dst,src,ind=false,output=false){
  // GetElement's output is uninitialized storage, not an incoming owner.
  if(!output&&!ind&&dst===src)return this.e.variant_copy_native(dst,src,0,1)>>>0;
  if(!output){const hr=this.e.variant_clear_check(dst)>>>0;if(hr)return hr;}
  const tmp=this.m.allocate(16);const retained=[];let transferred=false,cloned=false;
  try{
   const copy=this.e.variant_copy_native(tmp,src,ind?1:0,1)>>>0;
   if(copy)return copy;
   cloned=true;const refs=this.refs(tmp);this.methods(refs,1);this.methods(refs,2);
   for(const object of refs){await this.c.call(object,1);retained.push(object);}
   this.c.check();if(!output){const clear=await this.clear(dst);if(clear)return clear;}
   this.m.write(dst,this.m.read(tmp,16));transferred=true;return 0;
  }finally{
   // Exceptions stay exceptions: a failed native callback cannot become S_OK.
   // Retiring owners use the continuation's existing validated cleanup scope.
   await this.c.cleanup(async()=>{
    if(!transferred){
     await this.releaseRefs(retained.reverse());
     const cleanup=cloned?this.e.variant_clear_native(tmp,1)>>>0:0;
     if(cleanup)throw new HResult(cleanup);
    }
    this.m.free(tmp);
   });
  }
 }
 async arrayOperation(op,[sa,indices,out]){
  this.c.check();
  if(op===25){if(!indices)return 0x80070057;this.c.putWord(indices,0);}
  const hr=this.e.safearray_validate(sa,0,op===24?1:0)>>>0;if(hr)return hr;
  if(op===24){await this.releaseRefs(this.arrayRefs(sa));return this.e.safearray_destroy_native(sa)>>>0;}
  if(op===25){
   if(!indices)return 0x80070057;
   // Keep ppsaOut's documented NULL-on-failure while staging an owner.
   this.c.putWord(indices,0);const tmp=this.m.allocate(4),retained=[];let cloned=0,transferred=false;
   try{
    const result=this.native('safearray_copy_native',sa,tmp,0,0,0,0);if(result)return result;
    cloned=this.c.word(tmp);const refs=this.arrayRefs(cloned);this.methods(refs,1);this.methods(refs,2);
    for(const object of refs){await this.c.call(object,1);retained.push(object);}
    this.c.putWord(indices,cloned);transferred=true;return 0;
   }finally{await this.c.cleanup(async()=>{if(!transferred){await this.releaseRefs(retained.reverse());if(cloned){const cleanup=this.e.safearray_destroy_native(cloned)>>>0;if(cleanup)throw new HResult(cleanup);}}this.m.free(tmp);});}
  }
  if(!sa||!indices||!out)return 0x80070057;
  const locks=this.c.word(sa+8);if(locks===0xffffffff)return 0x8000ffff;
  const tmp=this.m.allocate(4);this.c.putWord(sa+8,locks+1);
  try{
   const indexed=this.native('safearray_index_native',sa,indices,tmp,0,0,0);if(indexed)return indexed;
   const element=this.c.word(tmp);
   return op===26?await this.copy(out,element,false,true):await this.copy(element,out);
  }finally{await this.c.cleanup(async()=>{this.c.putWord(sa+8,locks);this.m.free(tmp);});}
 }
}
module.exports={NativeVariant};
