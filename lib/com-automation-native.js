'use strict';

// Universal Automation proxies for the emulator's authenticated owned byte
// channel. Metadata is obtained through the real WAT ITypeInfo ABI. Neither
// this adapter nor the channel transfers process-local guest pointers.
const {HResult,HR,IID_UNKNOWN}=require('./com-standard-marshaler');
const FACTORY='d069f5d53b591a10b56908002b2dbf7a';
const PROXY='346af5d53b591a10b56908002b2dbf7a';
const STUB='fc6af5d53b591a10b56908002b2dbf7a';
const REPRESENTATION=0x57410101, LIMIT=524288;
const ok=hr=>{if(hr>>>31)throw new HResult(hr);};
const guidText=hex=>'{'+[hex.slice(0,8).match(/../g).reverse().join(''),hex.slice(8,12).match(/../g).reverse().join(''),hex.slice(12,16).match(/../g).reverse().join(''),hex.slice(16,20),hex.slice(20)].join('-')+'}';
const hexBytes=hex=>Uint8Array.from(hex.match(/../g)||[],x=>parseInt(x,16));

class NativeAutomation {
 constructor(m,proxy,api){this.m=m;this.c=m.c;this.proxy=proxy;this.api=api;this.objects=new Map();}
 word(p){return this.c.word(p);}
 half(p){return this.c.view(p,2).getUint16(0,true);}
 string(text,wide=false){const bytes=Buffer.from(text+'\0',wide?'utf16le':'latin1'),p=this.m.allocate(bytes.length);this.m.write(p,bytes);return p;}
 async reg(path,name=''){
  const key=this.string(path),value=this.string(name),out=this.m.allocate(1040);let handle=0;
  try{
   const opened=await this.c.invoke(this.api.RegOpenKeyExA,[0x80000000,key,0,0x20019,out]);
   if(opened)throw new HResult(0x8002801d);handle=this.word(out);
   this.c.putWord(out+8,1024);
   const hr=await this.c.invoke(this.api.RegQueryValueExA,[handle,value,0,out+4,out+16,out+8]);
   if(hr||this.word(out+4)!==1||this.word(out+8)<1||this.word(out+8)>1024)throw new HResult(0x80040150);
   const bytes=this.m.read(out+16,this.word(out+8));if(bytes[bytes.length-1])throw new HResult(0x80040150);
   return Buffer.from(bytes.subarray(0,-1)).toString('latin1');
  }finally{if(handle)await this.c.invoke(this.api.RegCloseKey,[handle]);this.m.free(key);this.m.free(value);this.m.free(out);}
 }
 async info(iid){
  const key='Interface\\'+guidText(iid)+'\\TypeLib';let id,version;
  try{id=await this.reg(key);version=await this.reg(key,'Version');}catch(e){if(e instanceof HResult)throw new HResult(0x8002801d);throw e;}
  if(!/^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i.test(id)||!/^([0-9a-f]{1,4})\.([0-9a-f]{1,4})$/i.test(version))throw new HResult(0x80040150);
  const buffer=this.m.allocate(40),text=this.string(id,true);let lib=0,ti=0;
  try{
   ok(await this.c.invoke(this.api.CLSIDFromString,[text,buffer]));
   const [major,minor]=version.split('.').map(x=>parseInt(x,16));
   const locale=await this.c.invoke(this.api.GetUserDefaultLCID,[]);
   ok(await this.c.invoke(this.api.LoadRegTypeLib,[buffer,major,minor,locale,buffer+16]));lib=this.word(buffer+16);
   this.m.write(buffer,hexBytes(iid));ok(await this.c.call(lib,6,[buffer,buffer+20]));ti=this.word(buffer+20);
   const meta=await this.describe(ti);for(const [slot,method]of meta.methods)if(slot>=3)this.validate(method);return {ti,meta};
  }catch(e){if(ti)await this.m.release(ti);throw e;}
  finally{if(lib)await this.m.release(lib);this.m.free(buffer);this.m.free(text);}
 }
 async attr(ti,fn){const out=this.m.allocate(4);let a=0;try{ok(await this.c.call(ti,3,[out]));a=this.word(out);return await fn(a);}finally{if(a)await this.c.call(ti,19,[a]);this.m.free(out);}}
 async reference(ti,href,fn){const out=this.m.allocate(4);let ref=0;try{ok(await this.c.call(ti,14,[href,out]));ref=this.word(out);return await fn(ref);}finally{if(ref)await this.m.release(ref);this.m.free(out);}}
 async descriptor(ti,p,depth=0){
  if(depth>16)throw new HResult(0x80028018);
  const vt=this.half(p+4);
  if(vt===26){const child=await this.descriptor(ti,this.word(p),depth+1);return child.kind==='interface-value'?{...child,kind:'interface'}:{kind:'pointer',child};}
  if(vt===29)return this.reference(ti,this.word(p),ref=>this.attr(ref,async a=>{
   const kind=this.word(a+40);
   if(kind===0)return {kind:'scalar',vt:3,size:4};
   if(kind===3||kind===4)return {kind:'interface-value',iid:this.m.guid(a)};
   if(kind===6)return this.descriptor(ref,a+60,depth+1);
   // Structured values need a field-aware codec; raw copies could contain
   // pointers, padding, or another ABI. Refuse before invoking server code.
   return {kind:'unsupported',vt,tkind:kind};
  }));
  if(vt===8)return {kind:'bstr'};
  if(vt===9||vt===13)return {kind:'interface',iid:vt===13?IID_UNKNOWN:'0004020000000000c000000000000046'};
  const sizes={2:2,3:4,4:4,5:8,6:8,7:8,10:4,11:2,16:1,17:1,18:2,19:4,20:8,21:8,22:4,23:4,24:0,25:4};
  return vt in sizes?{kind:'scalar',vt,size:sizes[vt]}:{kind:'unsupported',vt};
 }
 async describe(ti,depth=0){
  if(depth>16)throw new HResult(0x80028018);
  return this.attr(ti,async a=>{
   const kind=this.word(a+40);if(kind!==3&&kind!==4)throw new HResult(HR.NOINTERFACE);
   const count=this.half(a+44),bases=this.half(a+48),vft=this.half(a+50),methods=new Map();
   if(count>4096||bases>1||vft%4)throw new HResult(HR.NOTIMPL);
   const scratch=this.m.allocate(4);
   try{
    if(bases){ok(await this.c.call(ti,8,[0,scratch]));const parent=await this.reference(ti,this.word(scratch),x=>this.describe(x,depth+1));for(const [s,m]of parent.methods)methods.set(s,m);}
    for(let i=0;i<count;i++){
     ok(await this.c.call(ti,5,[i,scratch]));const f=this.word(scratch);
     try{
      const slot=this.half(f+28)/4,n=this.half(f+24),params=[];
      if(!Number.isInteger(slot)||slot>4096||n>15||this.word(f+20)!==4)throw new HResult(HR.NOTIMPL);
      for(let j=0;j<n;j++){const p=this.word(f+8)+j*16;params.push({type:await this.descriptor(ti,p),flags:this.half(p+12)});}
      methods.set(slot,{slot,params,result:await this.descriptor(ti,f+32)});
     }finally{await this.c.call(ti,20,[f]);}
    }
    const slots=Math.max(3,vft/4);
    for(let slot=3;slot<slots;slot++)if(!methods.has(slot))throw new HResult(HR.NOTIMPL);
    for(const slot of methods.keys())if(slot>=slots)throw new HResult(0x80028018);
    return {iid:this.m.guid(a),slots,methods};
   }finally{this.m.free(scratch);}
  });
 }
 wrapper(slot,count,kind){
  // Original stdcall frame remains on its owning x86 stack. A four-argument
  // internal import borrows it until completion; RET consumes the actual ABI.
  const bytes=Buffer.from([0x8b,0xc4,0x8d,0x50,0x04,0x68,0,0,0,0,0x52,0x68,0,0,0,0,0xff,0x70,0x04,0xb8,0,0,0,0,0xff,0xd0,0xc2,0,0]);
  bytes.writeUInt32LE(kind,6);bytes.writeUInt32LE(slot,12);bytes.writeUInt32LE(this.api.ComAutomationOperation,20);bytes.writeUInt16LE(count*4,27);
  const p=this.m.allocate(bytes.length);this.m.write(p,bytes);return p;
 }
 object(kind,counts,extra={}){
  const address=this.m.allocate(4),table=this.m.allocate(counts.length*4),code=[];
  try{for(let i=0;i<counts.length;i++){const p=this.wrapper(i,counts[i],kind);code.push(p);this.c.putWord(table+i*4,p);}this.c.putWord(address,table);
   const row={kind,address,table,code,refs:1,...extra};this.objects.set(address,row);return row;
  }catch(e){for(const p of code)this.m.free(p);this.m.free(table);this.m.free(address);throw e;}
 }
 destroy(row){this.objects.delete(row.address);for(const p of row.code)this.m.free(p);this.m.free(row.table);this.m.free(row.address);}
 async factory([clsid,context,reserved,iid,out]){
  if(out)this.c.putWord(out,0);if(!clsid||!iid||!out)return HR.POINTER;
  if(reserved||!(context&1))return HR.INVALID;
  const asked=this.m.guid(iid);if(asked!==FACTORY&&asked!==IID_UNKNOWN)return HR.NOINTERFACE;
  const row=this.object(1,[3,1,1,5,4]);this.c.putWord(out,row.address);return 0;
 }
 async query(row,iid,out){
  if(out)this.c.putWord(out,0);if(!iid||!out)return HR.POINTER;
  const asked=this.m.guid(iid),own=row.kind===1?FACTORY:row.kind===2?PROXY:STUB;
  if(asked!==own&&asked!==IID_UNKNOWN)return HR.NOINTERFACE;
  row.refs++;this.c.putWord(out,row.address);return 0;
 }
 async release(row){
  if(row.refs<1)throw new Error('Automation reference underflow');
  if(--row.refs)return row.refs;
  if(row.kind===2){await this.disconnect(row);if(row.typed)this.destroy(row.typed);}
  if(row.kind===3&&row.server)await this.m.release(row.server);
  if(row.ti)await this.m.release(row.ti);this.destroy(row);return 0;
 }
 async disconnect(row){const channel=row.channel;row.channel=0;if(channel)await this.m.release(channel);}
 async createProxy(outer,iid,proxyOut,ifaceOut){
  if(proxyOut)this.c.putWord(proxyOut,0);if(ifaceOut)this.c.putWord(ifaceOut,0);
  if(!outer||!iid||!proxyOut||!ifaceOut)return HR.POINTER;
  let ti=0,row,typed,retained=false;
  try{
   const loaded=await this.info(this.m.guid(iid));ti=loaded.ti;
   row=this.object(2,[3,1,1,2,1],{ti,meta:loaded.meta,outer,channel:0});ti=0;
   const counts=Array.from({length:loaded.meta.slots},(_,i)=>i===0?3:i<3?1:1+(loaded.meta.methods.get(i)?.params.length||0));
   typed=this.object(4,counts,{proxy:row});row.typed=typed;
   await this.c.call(outer,1);retained=true;
   this.c.putWord(proxyOut,row.address);this.c.putWord(ifaceOut,typed.address);return 0;
  }catch(e){if(row)await this.release(row);else if(ti)await this.m.release(ti);if(retained)await this.m.release(outer);throw e;}
 }
 async createStub(iid,server,out){
  if(out)this.c.putWord(out,0);if(!iid||!out)return HR.POINTER;
  let ti=0,row;
  try{const loaded=await this.info(this.m.guid(iid));ti=loaded.ti;
   row=this.object(3,[3,1,1,2,1,3,2,1,2,2],{ti,meta:loaded.meta,server:0});ti=0;
   if(server)ok(await this.connectStub(row,server));this.c.putWord(out,row.address);return 0;
  }catch(e){if(row)await this.release(row);else if(ti)await this.m.release(ti);throw e;}
 }
 async connectStub(row,server){
  if(!server)return HR.POINTER;const q=await this.m.qi(server,row.meta.iid);ok(q.hr);if(!q.pointer)return HR.NOINTERFACE;
  if(row.server)await this.m.release(row.server);row.server=q.pointer;return 0;
 }
 validate(method){
  const supported=t=>t.kind==='pointer'?supported(t.child):!['unsupported','interface-value'].includes(t.kind);
  if(!method||method.params.some(p=>!supported(p.type))||!supported(method.result)||method.result.size>4)throw new HResult(HR.NOTIMPL);
  // Pointer arguments require direction information. Optional/default-valued
  // and LCID arguments need separate Automation coercion semantics.
  if(method.params.some(p=>(p.flags&0x34)||(p.type.kind==='scalar'&&p.type.size>4)||
    (p.type.kind==='pointer'&&(p.type.child.kind==='pointer'||!(p.flags&3))))||
    method.result.kind!=='scalar'||[4,5,6,7].includes(method.result.vt))throw new HResult(HR.NOTIMPL);
 }
 packet(value){const b=Buffer.from(JSON.stringify(value));if(b.length>LIMIT)throw new HResult(HR.INVALID);return b;}
 unpack(bytes){if(bytes.length>LIMIT)throw new HResult(HR.INVALID);try{const p=JSON.parse(Buffer.from(bytes).toString('utf8'));if(!Array.isArray(p)||p[0]!=='WA_AUTOMATION_1')throw 0;return p;}catch(e){throw new HResult(HR.INVALID);}}
 async encode(type,value,indirect=false,references=[]){
  if(type.kind==='pointer'){if(!value)return null;return this.encode(type.child,value,true,references);}
  if(type.kind==='scalar')return indirect?Buffer.from(this.m.read(value,type.size)).toString('hex'):value>>>0;
  const pointer=indirect?this.word(value):value;
  if(type.kind==='bstr'){
   if(!pointer)return null;const length=this.word(pointer-4);if(length>LIMIT||length%2)throw new HResult(HR.INVALID);
   return Buffer.from(this.m.read(pointer,length)).toString('hex');
  }
  if(type.kind==='interface'){
   if(!pointer)return null;const iid=this.m.allocate(16);this.m.write(iid,hexBytes(type.iid));
   try{const result=await this.m.marshalReference(iid,pointer);ok(result.hresult);references.push(result.reference);return result.reference;}finally{this.m.free(iid);}
  }
  throw new HResult(HR.NOTIMPL);
 }
 async decode(type,value,owned,indirect=false){
  const alloc=n=>{const p=this.m.allocate(Math.max(n,1));owned.push({p});return p;};
  if(type.kind==='pointer'){if(value===null)return 0;const p=alloc(Math.max(type.child.size||4,4));await this.store(type.child,p,value,owned);return p;}
  if(type.kind==='scalar'){
   if(indirect){if(typeof value!=='string'||value.length!==type.size*2||!/^[0-9a-f]*$/.test(value))throw new HResult(HR.INVALID);return Buffer.from(value,'hex');}
   if(!Number.isInteger(value)||value<0||value>0xffffffff)throw new HResult(HR.INVALID);return value;
  }
  if(type.kind==='bstr'){
   if(value===null)return 0;if(typeof value!=='string'||value.length>LIMIT*2||value.length%4||!/^[0-9a-f]*$/.test(value))throw new HResult(HR.INVALID);
   const p=alloc(value.length/2+6);owned[owned.length-1].transferable=true;
   this.c.putWord(p,value.length/2);this.m.write(p+4,Buffer.from(value,'hex'));return p+4;
  }
  if(type.kind==='interface'){
   if(value===null)return 0;const out=alloc(20);this.m.write(out,hexBytes(type.iid));
   ok(await this.proxy.unmarshalReference(value,out,out+16));const p=this.word(out+16);owned.push({interface:p,transferable:true});return p;
  }
  throw new HResult(HR.NOTIMPL);
 }
 async store(type,p,value,owned){
  if(type.kind==='scalar'){const bytes=await this.decode(type,value,owned,true);this.m.write(p,bytes);}
  else this.c.putWord(p,await this.decode(type,value,owned));
 }
 async cleanup(owned){const freed=new Set();for(const item of owned.reverse()){if(item.interface)await this.m.release(item.interface);if(item.p&&!freed.has(item.p)){freed.add(item.p);this.m.free(item.p);}}}
 async releasePackets(references){for(const ref of references){try{await this.m.transport.releaseData(ref);}catch(e){if(!(e instanceof HResult)||e.value!==HR.DISCONNECTED)throw e;}}await this.m.drain();}
 async invoke(row,slot,values){
  if(!row.channel)return HR.DISCONNECTED;
  const method=row.meta.methods.get(slot);this.validate(method);
  const inputs=[],references=[],message=this.m.allocate(64),owned=[];let buffered=false;
  try{
  for(let i=0;i<method.params.length;i++){const p=method.params[i];if(p.type.kind==='pointer'&&!values[i])return HR.POINTER;inputs.push(p.flags&2&&!(p.flags&1)?null:await this.encode(p.type,values[i],false,references));}
  const request=this.packet(['WA_AUTOMATION_1',row.meta.iid,slot,inputs]);
   this.c.putWord(message+4,REPRESENTATION);this.c.putWord(message+12,request.length);this.c.putWord(message+16,slot);
   this.m.write(message+44,hexBytes(row.meta.iid));ok(await this.c.call(row.channel,3,[message,message+44]));buffered=true;
   this.m.write(this.word(message+8),request);ok(await this.c.call(row.channel,4,[message,message+60]));
   if(this.word(message+60))throw new HResult(HR.INVALID);
   const reply=this.unpack(this.m.read(this.word(message+8),this.word(message+12)));
   if(reply.length!==5||reply[1]!==row.meta.iid||reply[2]!==slot||!Array.isArray(reply[4])||reply[4].length!==method.params.length||!Number.isInteger(reply[3]))throw new HResult(HR.INVALID);
   // Validate and decode the complete reply before publishing caller outputs.
   const outputs=[];
   for(let i=0;i<method.params.length;i++){const p=method.params[i];if(p.flags&2){if(p.type.kind!=='pointer')throw new HResult(HR.NOTIMPL);const temp=this.m.allocate(Math.max(p.type.child.size||4,4));owned.push({p:temp});await this.store(p.type.child,temp,reply[4][i],owned);outputs.push([values[i],temp,p.type.child.size||4]);}}
   for(const [target,temp,size]of outputs)this.m.write(target,this.m.read(temp,size));
   // Returned BSTR/interface allocations transfer to the caller.
   for(const item of owned)if(item.transferable)item.transferred=true;
   return reply[3]>>>0;
  }finally{if(buffered)await this.c.call(row.channel,5,[message]);this.m.free(message);await this.cleanup(owned.filter(x=>!x.transferred));await this.releasePackets(references);}
 }
 async invokeStub(row,message,channel){
  if(!row.server)return HR.DISCONNECTED;
  if(!message||!channel||this.word(message+4)!==REPRESENTATION)return HR.INVALID;
  const slot=this.word(message+16),method=row.meta.methods.get(slot);this.validate(method);
  const request=this.unpack(this.m.read(this.word(message+8),this.word(message+12)));
  if(request.length!==4||request[1]!==row.meta.iid||request[2]!==slot||!Array.isArray(request[3])||request[3].length!==method.params.length)return HR.INVALID;
  const owned=[],values=[],outputs=[],references=[];let published=false;
  try{
   for(let i=0;i<method.params.length;i++){
    const p=method.params[i];
    if((p.flags&2)&&!(p.flags&1)){if(p.type.kind!=='pointer')throw new HResult(HR.NOTIMPL);const address=this.m.allocate(Math.max(p.type.child.size||4,4));owned.push({p:address});values.push(address);}
    else values.push(await this.decode(p.type,request[3][i],owned));
   }
   const hr=await this.c.call(row.server,slot,values);
   for(let i=0;i<method.params.length;i++){
    const p=method.params[i];
    if((p.flags&2)&&p.type.kind==='pointer'){
     const child=p.type.child;if(child.kind==='interface'){const pointer=this.word(values[i]);if(pointer)owned.push({interface:pointer});}
     if(child.kind==='bstr'){const pointer=this.word(values[i]);if(pointer)owned.push({p:pointer-4});}
    }
    outputs.push(p.flags&2?await this.encode(p.type,values[i],false,references):null);
   }
   const reply=this.packet(['WA_AUTOMATION_1',row.meta.iid,slot,hr,outputs]);
   const iid=this.m.allocate(16);this.m.write(iid,hexBytes(row.meta.iid));
   try{this.c.putWord(message+12,reply.length);ok(await this.c.call(channel,3,[message,iid]));this.m.write(this.word(message+8),reply);published=true;return 0;}finally{this.m.free(iid);}
  }finally{await this.cleanup(owned);if(!published)await this.releasePackets(references);}
 }
 async operation([address,slot,frame,kind]){
  const row=this.objects.get(address);if(!row||row.kind!==kind)throw new Error('Automation stale guest object');
  const n=kind===1?[3,1,1,5,4][slot]:kind===2?[3,1,1,2,1][slot]:kind===3?[3,1,1,2,1,3,2,1,2,2][slot]:slot===0?3:slot<3?1:1+(row.proxy.meta.methods.get(slot)?.params.length||0);
  if(!n||this.word(frame)!==address)throw new HResult(HR.INVALID);
  const args=Array.from({length:n-1},(_,i)=>this.word(frame+4+i*4));
  if(kind===4){if(slot<3)return this.c.call(row.proxy.outer,slot,args);return this.invoke(row.proxy,slot,args);}
  if(slot===0)return this.query(row,args[0],args[1]);if(slot===1)return ++row.refs;if(slot===2)return this.release(row);
  if(kind===1){if(slot===3)return this.createProxy(...args);if(slot===4)return this.createStub(...args);}
  if(kind===2){if(slot===3){if(!args[0])return HR.POINTER;await this.c.call(args[0],1);await this.disconnect(row);row.channel=args[0];return 0;}if(slot===4){await this.disconnect(row);return 0;}}
  if(kind===3){
   if(slot===3)return this.connectStub(row,args[0]);if(slot===4){if(row.server)await this.m.release(row.server);row.server=0;return 0;}
   if(slot===5)return this.invokeStub(row,...args);
   if(slot===6)return this.m.guid(args[0])===row.meta.iid?row.address:0;
   if(slot===7)return row.refs;
  }
  throw new HResult(HR.NOTIMPL);
 }
}
module.exports={NativeAutomation,REPRESENTATION};
