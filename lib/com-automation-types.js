'use strict';

// Values on the owned Automation channel are typed trees, never guest-memory
// images. In particular, the eight-byte VARIANT union is not a pointer-sized
// integer: BSTRs, interfaces and BYREF values require their own ownership.
const {HResult,HR,IID_UNKNOWN}=require('./com-standard-marshaler');
const IID_DISPATCH='0004020000000000c000000000000046';
const LIMIT=524288, MAX_ITEMS=16384, MAX_DEPTH=16;
const sizes=new Map([[0,0],[1,0],[2,2],[3,4],[4,4],[5,8],[6,8],
 [7,8],[10,4],[11,2],[14,16],[16,1],[17,1],[18,2],[19,4],
 [20,8],[21,8],[22,4],[23,4]]);
const invalid=()=>{throw new HResult(HR.INVALID);};
function hex(value,bytes=null){
 if(typeof value!=='string'||value.length>LIMIT*2||value.length%2||
  !/^[0-9a-f]*$/.test(value)||(bytes!==null&&value.length!==bytes*2))invalid();
 return Buffer.from(value,'hex');
}
function count(value,size=1){
 if(!Number.isInteger(value)||value<0||value>MAX_ITEMS||value*size>LIMIT)invalid();
 return value;
}

// A scope owns local decoded storage. Mutable resources are tracked by their
// current slot, so a native callee may replace a BYREF BSTR/interface without
// making cleanup release the old value a second time.
class AutomationScope {
 constructor(codec){this.codec=codec;this.m=codec.m;this.actions=[];this.done=false;}
 alloc(n){if(!Number.isInteger(n)||n<0||n>LIMIT)invalid();const p=this.m.allocate(Math.max(n,1));this.actions.push(()=>this.m.free(p));return p;}
 defer(fn,transferable=false){fn.transferable=transferable;this.actions.push(fn);}
 transfer(){this.actions=this.actions.filter(fn=>!fn.transferable);}
 async close(){if(this.done)return;this.done=true;let error;for(const action of this.actions.reverse())try{await action();}catch(e){error ||= e;}if(error)throw error;}
}

class AutomationValues {
 constructor(native){this.native=native;this.m=native.m;this.c=native.c;}
 word(p){this.c.check();return this.c.word(p);}
 half(p){this.c.check();return this.c.view(p,2).getUint16(0,true);}
 putHalf(p,v){this.c.check();this.c.view(p,2).setUint16(0,v,true);}
 scope(){return new AutomationScope(this);}
 async interface(pointer,iid,references){if(references===null)return null;return this.native.encode({kind:'interface',iid},pointer,false,references);}
 async readInterface(value,iid,scope){
  const owned=[];let pointer;
  try{pointer=await this.native.decode({kind:'interface',iid},value,owned,false,!!scope.requireAttachments);}
  finally{await this.native.cleanup(owned.filter(x=>!x.interface));}
  scope.defer(()=>this.m.release(pointer),true);return pointer;
 }
 async clearInterfaceSlot(p){const value=this.word(p);if(value)await this.m.release(value);}
 async freeBstr(pointer){if(pointer)this.m.free(pointer-4);}
 bstr(pointer){
  if(!pointer)return null;const n=this.word(pointer-4);
  if(n>LIMIT||n%2)invalid();return Buffer.from(this.m.read(pointer,n)).toString('hex');
 }
 readBstr(value){
  if(value===null)return 0;const bytes=hex(value);if(bytes.length%2)invalid();
  const p=this.m.allocate(bytes.length+6);this.c.putWord(p,bytes.length);
  this.m.write(p+4,bytes);return p+4;
 }
 wstring(pointer){
  if(!pointer)return null;
  let n=0;while(n<LIMIT&&this.half(pointer+n))n+=2;
  if(n===LIMIT)invalid();return Buffer.from(this.m.read(pointer,n)).toString('hex');
 }
 readWstring(value,scope){
  if(value===null)return 0;const b=hex(value);if(b.length%2)invalid();
  const p=scope.alloc(b.length+2);this.m.write(p,b);return p;
 }
 guid(pointer){return pointer?Buffer.from(this.m.read(pointer,16)).toString('hex'):null;}
 readGuid(value,scope){if(value===null)return 0;const b=hex(value,16),p=scope.alloc(16);this.m.write(p,b);return p;}
 // BYREF aliases retain identity within a call. Only an ordinal crosses the
 // channel; the original pointer remains in the caller's private map.
 async variant(p,references,refs=new Map(),depth=0){
  if(depth>MAX_DEPTH)invalid();const vt=this.half(p);
  if(vt===14){
   const scale=this.c.view(p+2,2).getUint8(0),sign=this.c.view(p+2,2).getUint8(1);
   if(scale>28||(sign!==0&&sign!==128))invalid();
   return {vt,value:Buffer.from(this.m.read(p+2,14)).toString('hex')};
  }
  if(this.half(p+2)||this.word(p+4))invalid();
  if(vt&0x4000){
   const base=vt&~0x4000,at=this.word(p+8);if(!at||(!sizes.has(base)&&![8,9,12,13].includes(base)))invalid();
   const prior=refs.get(at);
   if(prior){if(prior.vt!==base)invalid();return {vt,ref:prior.id};}
   const row={id:refs.size,vt:base,p:at};refs.set(at,row);
   const value=base===12?await this.variant(at,references,refs,depth+1):await this.value(base,at,references);
   return {vt,ref:row.id,value};
  }
  return {vt,value:await this.value(vt,p+8,references)};
 }
 async value(vt,p,references){
  if(vt===8)return this.bstr(this.word(p));
  if(vt===9||vt===13)return this.interface(this.word(p),vt===9?IID_DISPATCH:IID_UNKNOWN,references);
  if(!sizes.has(vt)||vt===14)throw new HResult(HR.NOTIMPL);
  return Buffer.from(this.m.read(p,sizes.get(vt))).toString('hex');
 }
 async storeValue(vt,p,value,scope){
  if(vt===8){this.c.putWord(p,this.readBstr(value));scope.defer(()=>this.freeBstr(this.word(p)),true);return;}
  if(vt===9||vt===13){
   // decode()'s transient scratch is freed now; the interface slot owns the
   // returned reference, including a replacement installed by the server.
   const owned=[];let pointer=0;
   try{pointer=await this.native.decode({kind:'interface',iid:vt===9?IID_DISPATCH:IID_UNKNOWN},value,owned,false,!!scope.requireAttachments);}
   finally{await this.native.cleanup(owned.filter(x=>!x.interface));}
   this.c.putWord(p,pointer);scope.defer(()=>this.clearInterfaceSlot(p),true);return;
  }
  if(!sizes.has(vt)||vt===14)throw new HResult(HR.NOTIMPL);
  this.m.write(p,hex(value,sizes.get(vt)));
 }
 async readVariant(value,p,scope,refs=new Map(),depth=0){
  if(depth>MAX_DEPTH||!value||!Number.isInteger(value.vt)||value.vt<0||value.vt>0xffff)invalid();
  const vt=value.vt;this.putHalf(p,vt);
  if(vt===14){const b=hex(value.value,14);if(b[0]>28||(b[1]!==0&&b[1]!==128))invalid();this.m.write(p+2,b);return;}
  if(vt&0x4000){
   const base=vt&~0x4000;if(!sizes.has(base)&&![8,9,12,13].includes(base))invalid();
   const id=count(value.ref),prior=refs.get(id);
   if(prior){if(prior.vt!==base||Object.hasOwn(value,'value'))invalid();this.c.putWord(p+8,prior.p);return;}
   if(id!==refs.size||!Object.hasOwn(value,'value'))invalid();
   const target=scope.alloc(base===12?16:Math.max(sizes.get(base)||4,4));
   refs.set(id,{vt:base,p:target});this.c.putWord(p+8,target);
   if(base===12)await this.readVariant(value.value,target,scope,refs,depth+1);
   else await this.storeValue(base,target,value.value,scope);
  }else await this.storeValue(vt,p+8,value.value,scope);
 }
 async dispParams(p,references){
  if(!p)return null;
  const n=count(this.word(p+8),16),named=count(this.word(p+12),4);
  if(named>n)invalid();const args=this.word(p),ids=this.word(p+4);
  if((n&&!args)||(named&&!ids))invalid();
  const refs=new Map(),values=[];
  for(let i=0;i<n;i++)values.push(await this.variant(args+i*16,references,refs));
  return {values,named:Array.from({length:named},(_,i)=>this.word(ids+i*4)),refs};
 }
 async readDispParams(value,scope){
  if(value===null)return {p:0,refs:new Map()};
  if(!value||!Array.isArray(value.values)||!Array.isArray(value.named))invalid();
  const n=count(value.values.length,16),named=count(value.named.length,4);if(named>n)invalid();
  const p=scope.alloc(16),args=scope.alloc(n*16),ids=scope.alloc(named*4),refs=new Map();
  this.c.putWord(p,args);this.c.putWord(p+4,ids);this.c.putWord(p+8,n);this.c.putWord(p+12,named);
  for(let i=0;i<named;i++){const id=value.named[i];if(!Number.isInteger(id)||id<0||id>0xffffffff)invalid();this.c.putWord(ids+i*4,id);}
  for(let i=0;i<n;i++)await this.readVariant(value.values[i],args+i*16,scope,refs);
  return {p,refs};
 }
 async excepInfo(p,references){
  if(!p)return null;
  // A deferred fill-in is executable code in this owner. Complete it here,
  // before serializing the three counted strings; never transfer its address.
  const deferred=this.word(p+24);
  if(deferred){const hr=await this.c.invoke(deferred,[p]);if(hr>>>31)throw new HResult(hr);this.c.putWord(p+24,0);}
  if(this.half(p+2)||this.word(p+20))invalid();
  return {code:this.half(p),source:this.bstr(this.word(p+4)),description:this.bstr(this.word(p+8)),
   help:this.bstr(this.word(p+12)),context:this.word(p+16),scode:this.word(p+28)};
 }
 async readExcepInfo(value,p,scope){
  if(!value||!Number.isInteger(value.code)||value.code<0||value.code>65535||
   ![value.context,value.scode].every(x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff))invalid();
  this.putHalf(p,value.code);this.c.putWord(p+16,value.context);this.c.putWord(p+28,value.scode);
  for(const [off,name]of [[4,'source'],[8,'description'],[12,'help']])await this.storeValue(8,p+off,value[name],scope);
 }
 // Public x86 OAUT descriptors. Only fields defined by the ABI cross the
 // channel. Unions are selected by their discriminator, not copied wholesale.
 async descriptor(kind,p,references,depth=0){
  if(depth>MAX_DEPTH)invalid();if(!p)return null;
  const bytes=(at,n)=>Buffer.from(this.m.read(at,n)).toString('hex');
  const nested=(k,at)=>this.descriptor(k,at,references,depth+1);
  const array=async(k,at,n,stride)=>{count(n,stride);if(n&&!at)invalid();const a=[];for(let i=0;i<n;i++)a.push(await nested(k,at+i*stride));return a;};
  if(kind==='typedesc'){
   const vt=this.half(p+4);let value=null;
   if(vt===26||vt===27)value=await nested('typedesc',this.word(p));
   else if(vt===28){const at=this.word(p),n=this.half(at+8);if(n<1||n>16)invalid();
    value={element:await nested('typedesc',at),bounds:bytes(at+12,n*8)};}
   else if(vt===29)value=this.word(p);
   else if(!sizes.has(vt)&&![8,9,12,13,24,25,30,31,36,37,38].includes(vt))invalid();
   return {vt,value};
  }
  if(kind==='elemdesc'){
   const flags=this.half(p+12),at=this.word(p+8);
   if(flags&~0x7f)invalid();
   return {type:await nested('typedesc',p),flags,
    default:flags&0x20?(at?await this.variant(at+8,references):invalid()):null};
  }
  if(kind==='typeattr'){
   if(this.word(p+20)||this.word(p+68))invalid();
   return {head:bytes(p,32),schema:this.wstring(this.word(p+32)),
    body:bytes(p+36,24),alias:await nested('typedesc',p+60),idlFlags:this.half(p+72)};
  }
  if(kind==='funcdesc'){
   const n=this.half(p+24),scodes=this.half(p+30);count(n,16);count(scodes,4);
   return {member:this.word(p),body:bytes(p+12,20),result:await nested('elemdesc',p+32),flags:this.half(p+48),
    params:await array('elemdesc',this.word(p+8),n,16),scodes:scodes?bytes(this.word(p+4),scodes*4):''};
  }
  if(kind==='vardesc'){
   const k=this.word(p+32);if(k>3)invalid();
   return {member:this.word(p),schema:this.wstring(this.word(p+4)),kind:k,
    value:k===2?await this.variant(this.word(p+8),references):this.word(p+8),
    element:await nested('elemdesc',p+12),flags:this.half(p+28)};
  }
  if(kind==='libattr')return bytes(p,32);
  invalid();
 }
 async readDescriptor(kind,value,scope,depth=0){
  if(depth>MAX_DEPTH)invalid();if(value===null)return 0;
  if(kind!=='libattr'&&(!value||typeof value!=='object'||Array.isArray(value)))invalid();
  const n={typedesc:8,elemdesc:16,typeattr:76,funcdesc:52,vardesc:36,libattr:32}[kind];if(!n)invalid();
  const p=scope.alloc(n),nested=(k,v)=>this.readDescriptor(k,v,scope,depth+1);
  const u=(v,max=0xffffffff)=>{if(!Number.isInteger(v)||v<0||v>max)invalid();return v;};
  const copyNested=async(k,v,at,len)=>{const q=await nested(k,v);if(!q)invalid();this.m.write(at,this.m.read(q,len));};
  if(kind==='typedesc'){
   const vt=u(value.vt,0xffff);this.putHalf(p+4,vt);
   if(vt===26||vt===27){const q=await nested('typedesc',value.value);if(!q)invalid();this.c.putWord(p,q);}
   else if(vt===28){
    if(!value.value||typeof value.value!=='object')invalid();const b=hex(value.value.bounds);if(!b.length||b.length%8||b.length>128)invalid();
    const a=scope.alloc(12+b.length);await copyNested('typedesc',value.value.element,a,8);
    this.putHalf(a+8,b.length/8);this.m.write(a+12,b);this.c.putWord(p,a);
   }else if(vt===29)this.c.putWord(p,u(value.value));
   else if(value.value!==null||(!sizes.has(vt)&&![8,9,12,13,24,25,30,31,36,37,38].includes(vt)))invalid();
  }else if(kind==='elemdesc'){
   await copyNested('typedesc',value.type,p,8);const f=u(value.flags,0x7f);this.putHalf(p+12,f);
   if(f&0x20){const q=scope.alloc(24);this.c.putWord(q,24);await this.readVariant(value.default,q+8,scope);this.c.putWord(p+8,q);}
   else if(value.default!==null)invalid();
  }else if(kind==='typeattr'){
   this.m.write(p,hex(value.head,32));if(this.word(p+20))invalid();
   this.c.putWord(p+32,this.readWstring(value.schema,scope));
   this.m.write(p+36,hex(value.body,24));await copyNested('typedesc',value.alias,p+60,8);
   this.putHalf(p+72,u(value.idlFlags,0xffff));
  }else if(kind==='funcdesc'){
   this.c.putWord(p,u(value.member));this.m.write(p+12,hex(value.body,20));
   await copyNested('elemdesc',value.result,p+32,16);this.putHalf(p+48,u(value.flags,0xffff));
   const n=this.half(p+24),s=this.half(p+30);count(n,16);count(s,4);
   if(!Array.isArray(value.params)||value.params.length!==n)invalid();
   const params=scope.alloc(n*16);this.c.putWord(p+8,params);
   for(let i=0;i<n;i++)await copyNested('elemdesc',value.params[i],params+i*16,16);
   const b=hex(value.scodes,s*4),codes=scope.alloc(b.length);this.m.write(codes,b);this.c.putWord(p+4,codes);
  }else if(kind==='vardesc'){
   this.c.putWord(p,u(value.member));this.c.putWord(p+4,this.readWstring(value.schema,scope));
   const k=u(value.kind,3);this.c.putWord(p+32,k);this.putHalf(p+28,u(value.flags,0xffff));
   await copyNested('elemdesc',value.element,p+12,16);
   if(k===2){const q=scope.alloc(16);await this.readVariant(value.value,q,scope);this.c.putWord(p+8,q);}
   else this.c.putWord(p+8,u(value.value));
  }else this.m.write(p,hex(value,32));
  return p;
 }
}
module.exports={AutomationValues,AutomationScope,IID_DISPATCH,LIMIT,MAX_ITEMS,MAX_DEPTH,hex,count};
