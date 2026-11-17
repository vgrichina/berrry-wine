'use strict';
const {HResult}=require('./com-standard-marshaler');

// Only interface lifetime calls leave WAT. Values remain native VARIANT bytes
// in this exact owner's memory; no Automation wire/value codec is involved.
class NativeVariant {
 constructor(m){this.m=m;this.c=m.c;this.e=this.c.exports;}
 interfaceAt(p){const vt=this.c.view(p,2).getUint16(0,true);return vt===9||vt===13?this.c.word(p+8):0;}
 async clear(p){
  this.c.check();const hr=this.e.variant_clear_native(p,0)>>>0;if(hr!==0xffffffff)return hr;
  await this.m.release(this.interfaceAt(p));this.c.check();
  return this.e.variant_clear_native(p,1)>>>0;
 }
 async operation(op,args){
  if(op===21)return this.clear(args[0]);
  const [dst,src]=args;this.c.check();
  const direct=this.e.variant_copy_native(dst,src,op===23?1:0,0)>>>0;
  if(direct!==0xffffffff)return direct;
  const hr=this.e.variant_clear_check(dst)>>>0;if(hr)return hr;
  const tmp=this.m.allocate(16);let retained=false,transferred=false;
  try{
   const copy=this.e.variant_copy_native(tmp,src,op===23?1:0,1)>>>0;
   if(copy)return copy;
   const object=this.interfaceAt(tmp);
   if(object){await this.c.call(object,1);retained=true;}
   this.c.check();const clear=await this.clear(dst);if(clear)return clear;
   this.m.write(dst,this.m.read(tmp,16));transferred=true;return 0;
  }finally{
   // Exceptions stay exceptions: a failed native callback cannot become S_OK.
   // Retiring owners use the continuation's existing validated cleanup scope.
   await this.c.cleanup(async()=>{
    if(!transferred){
     if(retained)await this.m.release(this.interfaceAt(tmp));
     const cleanup=this.e.variant_clear_native(tmp,1)>>>0;
     if(cleanup)throw new HResult(cleanup);
    }
    this.m.free(tmp);
   });
  }
 }
}
module.exports={NativeVariant};
