'use strict';
// Local x86 ABI adapters to the authenticated owned channel. These are not NDR
// wire opnums: call_as/local methods below are deliberately distinguished.
// Contracts: oaidl.idl (ITypeInfo/ITypeLib/IDispatch), objidlbase.idl (PS factory).
const {HResult,HR}=require('./com-standard-marshaler');
const {AutomationValues,hex,count}=require('./com-automation-types');
const IID_INFO='0104020000000000c000000000000046';
const IID_LIB='0204020000000000c000000000000046';
const IID_DISPATCH='0004020000000000c000000000000046';
const scalar={k:'u32'},guid={k:'guid'},wstring={k:'wstring'};
const out=(k,extra={})=>({k:'out',value:k,...extra});
const iface=iid=>out('interface',{iid});
const descriptor=(name,release)=>out('descriptor',{name,release});
const names=n=>({k:'names',n});
const doc=[scalar,out('bstr',{optional:true}),out('bstr',{optional:true}),out('u32',{optional:true}),out('bstr',{optional:true})];
const method=(slot,args,extra={})=>({slot,params:args.map(()=>({})),contract:{args,...extra}});
function contracts(iid){
 let specs;
 if(iid===IID_DISPATCH)specs={
  3:[out('u32')],4:[scalar,scalar,iface(IID_INFO)],
  5:[guid,names(2),scalar,scalar,out('ids',{n:2})],
  6:[scalar,guid,scalar,scalar,{k:'params'},out('variant',{optional:true}),out('excep',{optional:true}),out('u32',{optional:true})],
 };
 if(iid===IID_INFO)specs={
  3:[descriptor('typeattr',19)],4:[out('unsupported')],
  5:[scalar,descriptor('funcdesc',20)],6:[scalar,descriptor('vardesc',21)],
  7:[scalar,out('bstrs',{n:2,actual:3}),scalar,out('u32')],
  8:[scalar,out('u32')],9:[scalar,out('u32')],10:[names(1),scalar,out('ids',{n:1})],
  11:[scalar,scalar,scalar,{k:'params'},out('variant'),out('excep'),out('u32')],
  12:doc,13:[scalar,scalar,out('bstr',{optional:true}),out('bstr',{optional:true}),out('u16',{optional:true})],
  14:[scalar,iface(IID_INFO)],15:[scalar,scalar,out('unsupported')],
  16:[scalar,guid,out('dynamicInterface',{iidArg:1})],17:[scalar,out('bstr')],
  18:[iface(IID_LIB),out('u32')],19:[scalar],20:[scalar],21:[scalar],
 };
 if(iid===IID_LIB)specs={
  3:[],4:[scalar,iface(IID_INFO)],5:[scalar,out('u32')],6:[guid,iface(IID_INFO)],
  7:[descriptor('libattr',12)],8:[out('unsupported')],9:doc,
  10:[{k:'inoutString'},scalar,out('u32')],
  11:[{k:'inoutString'},scalar,out('interfaces',{iid:IID_INFO,capacity:4}),out('ids',{capacity:4}),{k:'inout16'}],12:[scalar],
 };
 if(!specs)return null;
 const methods=new Map(Object.entries(specs).map(([slot,args])=>[+slot,method(+slot,args)]));
 // GetIDsOfNames uses the same bounded names/DISPID codec as IDispatch,
 // without IDispatch's reserved IID and LCID arguments. It has no local
 // instance pointer (unlike Invoke) and transfers no guest addresses.
 if(iid===IID_INFO){for(const s of [4,11,13,15,17])methods.get(s).contract.unsupported=true;
  for(const [s,name]of [[19,'typeattr'],[20,'funcdesc'],[21,'vardesc']])methods.get(s).contract.release=name;}
 if(iid===IID_LIB){methods.get(3).contract.rawResult=true;methods.get(8).contract.unsupported=true;methods.get(12).contract.release='libattr';}
 return {iid,slots:Math.max(...methods.keys())+1,methods};
}
const invalid=()=>{throw new HResult(HR.INVALID);};
const u32=v=>{if(!Number.isInteger(v)||v<0||v>0xffffffff)invalid();return v;};
class AutomationContracts {
 constructor(native){this.a=native;this.m=native.m;this.c=native.c;this.v=new AutomationValues(native);this.leases=new Map();}
 meta(iid){return contracts(iid);}
 custom(method){
  // A VARIANT passed by value occupies four x86 stack words, including when
  // its union contains an owned BSTR/interface or a local BYREF address.
  const args=method.params.map(({type:t,flags:f})=>{
   if(f&0x34)throw new HResult(HR.NOTIMPL);
   if(t.kind==='pointer'){
    if((f&3)!==2)throw new HResult(HR.NOTIMPL);t=t.child;
    if(t.kind==='interface')return iface(t.iid);
    if(t.kind==='bstr')return out('bstr');
    if(t.kind==='variant')return out('variant');
    if(t.kind==='scalar'&&[2,4].includes(t.size))return out(t.size===2?'u16':'u32');
   }else if(!(f&2)){
    if(t.kind==='variant')return {k:'variantValue'};
    if(t.kind==='bstr')return {k:'bstrValue'};
    if(t.kind==='interface')return {k:'interfaceValue',iid:t.iid};
    if(t.kind==='scalar'&&t.size<=4)return scalar;
   }
   throw new HResult(HR.NOTIMPL);
  });
  return {args};
 }
 capacity(spec,args){return count(spec.capacity!==undefined?this.v.half(args[spec.capacity]):args[spec.n],4);}
 size(spec,args){if(['ids','bstrs','interfaces'].includes(spec.value))return this.capacity(spec,args)*4;
  return {variant:16,excep:32,u16:2}[spec.value]||4;}
 async encodeInput(spec,p,args,refs){
  if(spec.k==='u32')return u32(p);
  if(spec.k==='variantValue')return this.v.variant(p,refs,refs.variantAliases ||= new Map());
  if(spec.k==='bstrValue')return this.v.bstr(p);
  if(spec.k==='interfaceValue')return this.v.interface(p,spec.iid,refs);
  if(spec.k==='guid'){if(!p)throw new HResult(HR.POINTER);return this.v.guid(p);}
  if(spec.k==='wstring'||spec.k==='inoutString'){if(!p)throw new HResult(HR.POINTER);return this.v.wstring(p);}
  if(spec.k==='inout16'){if(!p)throw new HResult(HR.POINTER);return this.v.half(p);}
  if(spec.k==='names'){const n=count(args[spec.n],4);if(n&&!p)throw new HResult(HR.POINTER);
   return Array.from({length:n},(_,i)=>{const q=this.c.word(p+i*4);if(!q)throw new HResult(HR.POINTER);return this.v.wstring(q);});}
  if(spec.k==='params'){const dp=await this.v.dispParams(p,refs);return dp&&{values:dp.values,named:dp.named};}
  if(spec.k==='out'){if(!p&&!spec.optional)throw new HResult(HR.POINTER);if(p)this.c.view(p,this.size(spec,args));return !!p;}
  invalid();
 }
 async decodeInput(spec,value,args,scope){
  if(spec.k==='u32')return u32(value);
  if(spec.k==='variantValue'){const p=scope.alloc(16);await this.v.readVariant(value,p,scope,scope.variantAliases ||= new Map());return p;}
  if(spec.k==='bstrValue'){const p=scope.alloc(4);await this.v.storeValue(8,p,value,scope);return this.c.word(p);}
  if(spec.k==='interfaceValue')return this.v.readInterface(value,spec.iid,scope);
  if(spec.k==='guid')return this.v.readGuid(value,scope)||invalid();
  if(spec.k==='wstring'||spec.k==='inoutString')return this.v.readWstring(value,scope)||invalid();
  if(spec.k==='inout16'){if(u32(value)>65535)invalid();const p=scope.alloc(2);this.v.putHalf(p,value);return p;}
  if(spec.k==='names'){
   if(!Array.isArray(value)||value.length!==count(args[spec.n],4))invalid();
   // A wire name is precisely the UTF-16 contents before the terminator.
   // Reject hidden suffixes rather than letting native lookup truncate an
   // authenticated request to a different name. Counted BSTRs still permit NUL.
   for(const name of value){const b=hex(name);if(b.length%2)invalid();
    for(let i=0;i<b.length;i+=2)if(b.readUInt16LE(i)===0)invalid();}
   const p=scope.alloc(value.length*4);for(let i=0;i<value.length;i++)this.c.putWord(p+i*4,this.v.readWstring(value[i],scope));return p;
  }
  if(spec.k==='params')return (await this.v.readDispParams(value,scope)).p;
  if(spec.k==='out'){if(typeof value!=='boolean'||(!value&&!spec.optional))invalid();return value?scope.alloc(this.size(spec,args)):0;}
  invalid();
 }
 async encodeOutput(spec,p,args,refs){
  if(spec.k==='inout16')return this.v.half(p);
  if(spec.k==='variantValue')return this.v.variant(p,refs,refs.variantAliases ||= new Map());
  if(spec.k==='inoutString')return this.v.wstring(p);
  if(spec.k==='params'){
   if(!p)return null;const dp=await this.v.dispParams(p,refs);return {values:dp.values,named:dp.named};
  }
  if(spec.k!=='out'||!p)return null;
  const k=spec.value;
  if(k==='u32')return this.c.word(p);if(k==='u16')return this.v.half(p);
  if(k==='bstr')return this.v.bstr(this.c.word(p));
  if(k==='variant')return this.v.variant(p,refs);
  if(k==='excep')return this.v.excepInfo(p,refs);
  if(k==='descriptor')return this.v.descriptor(spec.name,this.c.word(p),refs);
  if(k==='interface'||k==='dynamicInterface')return this.v.interface(this.c.word(p),spec.iid||this.v.guid(args[spec.iidArg]),refs);
  if(['ids','bstrs','interfaces'].includes(k)){
   let n=this.capacity(spec,args);if(spec.actual!==undefined){const actual=this.c.word(args[spec.actual]);if(actual>n)invalid();n=actual;}
   const a=[];for(let i=0;i<n;i++)a.push(k==='ids'?this.c.word(p+i*4):k==='bstrs'?this.v.bstr(this.c.word(p+i*4)):await this.v.interface(this.c.word(p+i*4),spec.iid,refs));return a;
  }
  throw new HResult(HR.NOTIMPL);
 }
 async cleanNative(spec,p,args){
  if(spec.k!=='out'||!p)return;
  const k=spec.value;
  if(k==='descriptor'){const q=this.c.word(p);if(q)await this.c.call(args.server,spec.release,[q]);return;}
  if(k==='bstr'){await this.v.freeBstr(this.c.word(p));return;}
  if(k==='interface'||k==='dynamicInterface'){await this.m.release(this.c.word(p));return;}
  if(k==='variant'){await this.clearVariant(p);return;}
  if(k==='excep'){for(const off of [4,8,12])await this.v.freeBstr(this.c.word(p+off));return;}
  if(k==='bstrs'||k==='interfaces'){
   // Zeroed capacity remains owned even on a failing/partially filled call.
   for(let i=0;i<this.capacity(spec,args);i++){const q=this.c.word(p+i*4);if(k==='bstrs')await this.v.freeBstr(q);else await this.m.release(q);}
  }
 }
 async clearVariant(p){const vt=this.v.half(p);if(vt&0x4000)return;
  if(vt===8)await this.v.freeBstr(this.c.word(p+8));
  if(vt===9||vt===13)await this.m.release(this.c.word(p+8));
 }
 async releaseDescriptor(row,name,p){const lease=this.leases.get(p);if(!lease||lease.row!==row||lease.name!==name)throw new HResult(HR.INVALID);
  this.leases.delete(p);await lease.scope.close();await this.m.release(row.outer);return 0;}
 async stageOutput(row,spec,value,target,args,scope,stages){
  if(spec.k==='variantValue')return; // staged together to preserve cross-argument aliases
  if(spec.k==='inout16'){if(u32(value)>65535)invalid();stages.push(()=>this.v.putHalf(target,value));return;}
  if(spec.k==='inoutString'){const b=hex(value);const original=this.v.wstring(target);if(b.length>original.length/2||b.length%2)invalid();
   this.c.view(target,b.length+2);stages.push(()=>{this.m.write(target,b);this.v.putHalf(target+b.length,0);});return;}
  if(spec.k==='params'){await this.stageByrefs(value,target,scope,stages);return;}
  if(spec.k!=='out'){if(value!==null)invalid();return;}
  if(!target){if(value!==null)invalid();return;}
  const p=scope.alloc(this.size(spec,args)),k=spec.value;
  if(k==='u32')this.c.putWord(p,u32(value));
  else if(k==='u16'){if(u32(value)>65535)invalid();this.v.putHalf(p,value);}
  else if(k==='bstr')await this.v.storeValue(8,p,value,scope);
  else if(k==='variant'){if(value?.vt&0x4000)throw new HResult(HR.NOTIMPL);await this.v.readVariant(value,p,scope);}
  else if(k==='excep')await this.v.readExcepInfo(value,p,scope);
  else if(k==='interface'||k==='dynamicInterface'){
   const pointer=await this.v.readInterface(value,spec.iid||this.v.guid(args[spec.iidArg]),scope);
   this.c.putWord(p,pointer);
  }else if(k==='descriptor'){
   if(value===null){this.c.putWord(p,0);stages.push(()=>this.c.putWord(target,0));return;}
   const graph=this.v.scope();graph.requireAttachments=true;let q;
   try{q=await this.v.readDescriptor(spec.name,value,graph);if(!q)invalid();await this.c.call(row.outer,1);}
   catch(e){await graph.close();throw e;}
   let committed=false;scope.defer(async()=>{if(!committed){await graph.close();await this.m.release(row.outer);}});
   this.c.putWord(p,q);stages.push(()=>{this.leases.set(q,{row,name:spec.name,scope:graph});committed=true;});
  }else if(['ids','bstrs','interfaces'].includes(k)){
   const max=this.capacity(spec,args);if(!Array.isArray(value)||value.length>max||(k==='ids'&&spec.capacity===undefined&&value.length!==max))invalid();
   for(let i=0;i<value.length;i++){
    if(k==='ids')this.c.putWord(p+i*4,u32(value[i]));
    else if(k==='bstrs')await this.v.storeValue(8,p+i*4,value[i],scope);
    else this.c.putWord(p+i*4,await this.v.readInterface(value[i],spec.iid,scope));
   }
  }else throw new HResult(HR.NOTIMPL);
  this.c.view(target,this.size(spec,args));stages.push(()=>this.m.write(target,this.m.read(p,this.size(spec,args))));
 }
 async stageByrefs(value,target,scope,stages){
  if(!target){if(value!==null)invalid();return;}
  const original=await this.v.dispParams(target,null); // validation only; don't export input interfaces again
  if(!value||!Array.isArray(value.values)||value.values.length!==original.values.length||JSON.stringify(value.named)!==JSON.stringify(original.named))invalid();
  // Reconstruct alias topology and compare against the original private map.
  // By-value resources in the reply are validation temporaries. Only BYREF
  // replacement owners may transfer into the caller's original storage.
  const validation=this.v.scope();validation.requireAttachments=scope.requireAttachments;
  const remote=new Map(),local=original.refs;
  try{for(let i=0;i<value.values.length;i++){
   const item=value.values[i];if(item?.vt!==original.values[i].vt)invalid();
   const owner=item.vt&0x4000?scope:validation;
   await this.v.readVariant(item,owner.alloc(16),owner,remote);
  }}finally{await validation.close();}
  if(remote.size!==local.size)invalid();
  for(const [id,r]of remote){const old=[...local.values()].find(x=>x.id===id);if(!old||old.vt!==r.vt)invalid();
   const size=r.vt===12?16:({2:2,11:2,16:1,17:1,18:2,4:4,5:8,6:8,7:8,20:8,21:8}[r.vt]||4);
   if(r.vt===12&&(this.v.half(r.p)&0x4000))throw new HResult(HR.NOTIMPL);
   this.c.view(old.p,size);
   // Publish synchronously after every output has passed validation. Release
   // the replaced owners afterwards: native Release may execute callbacks.
   if(r.vt===12){const prior=scope.alloc(16);this.m.write(prior,this.m.read(old.p,16));
    stages.push(()=>{scope.defer(()=>this.clearVariant(prior));this.m.write(old.p,this.m.read(r.p,size));});
   }else if(r.vt===8||r.vt===9||r.vt===13){const prior=this.c.word(old.p);
    stages.push(()=>{scope.defer(()=>r.vt===8?this.v.freeBstr(prior):this.m.release(prior));this.m.write(old.p,this.m.read(r.p,size));});
   }else stages.push(()=>this.m.write(old.p,this.m.read(r.p,size)));
  }
 }
 async invoke(row,slot,args){
  const contract=row.meta.methods.get(slot).contract;
  if(contract.release)return this.releaseDescriptor(row,contract.release,args[0]);
  if(contract.unsupported)throw new HResult(HR.NOTIMPL);
  if(row.meta.iid===IID_INFO&&slot===16&&args[0])return 0x80040110; // CLASS_E_NOAGGREGATION
  if(!row.channel)return HR.DISCONNECTED;
  const references=[],scope=this.v.scope(),stages=[];scope.requireAttachments=true;let reply;
  try{
   const inputs=[];for(let i=0;i<contract.args.length;i++)inputs.push(await this.encodeInput(contract.args[i],args[i],args,references));
   reply=await this.a.exchange(row,slot,inputs);
   if(reply.length!==5||reply[1]!==row.meta.iid||reply[2]!==slot||!Array.isArray(reply[4])||reply[4].length!==args.length)invalid();
   u32(reply[3]);
   for(let i=0;i<args.length;i++){
    const spec=contract.args[i];if(spec.k!=='out'||!args[i])continue;
    if(spec.value==='descriptor'&&reply[4][i]===null&&!(reply[3]>>>31))invalid();
    const at=spec.actual??spec.capacity;
    if(at!==undefined){const actual=u32(reply[4][at]);if(actual>this.capacity(spec,args)||!Array.isArray(reply[4][i])||reply[4][i].length!==actual)invalid();}
   }
   for(let i=0;i<args.length;i++)await this.stageOutput(row,contract.args[i],reply[4][i],args[i],args,scope,stages);
   const variants=contract.args.flatMap((spec,i)=>spec.k==='variantValue'?[i]:[]);
   if(variants.length){const dp=scope.alloc(16),values=scope.alloc(variants.length*16);
    this.c.putWord(dp,values);this.c.putWord(dp+8,variants.length);
    for(let n=0;n<variants.length;n++)this.m.write(values+n*16,this.m.read(args[variants[n]],16));
    await this.stageByrefs({values:variants.map(i=>reply[4][i]),named:[]},dp,scope,stages);
   }
   this.c.check();for(const publish of stages)publish();scope.transfer();return reply[3];
  }finally{await this.c.cleanup(async()=>{await scope.close();await this.a.releasePackets(references);await this.a.releaseReplyReferences(reply);});}
 }
 async stub(row,slot,inputs){
  const contract=row.meta.methods.get(slot)?.contract;if(!contract||contract.release||contract.unsupported)throw new HResult(HR.NOTIMPL);
  if(!Array.isArray(inputs)||inputs.length!==contract.args.length)invalid();
  const scope=this.v.scope(),refs=[],args=new Array(inputs.length);let invoked=false;
  try{
   // Immediate counts are decoded first; pointer storage never crosses owners.
   for(let i=0;i<inputs.length;i++)if(contract.args[i].k==='u32')args[i]=u32(inputs[i]);
   for(let i=0;i<inputs.length;i++)if(contract.args[i].k==='inout16')args[i]=await this.decodeInput(contract.args[i],inputs[i],args,scope);
   for(let i=0;i<inputs.length;i++)if(!['u32','inout16'].includes(contract.args[i].k))args[i]=await this.decodeInput(contract.args[i],inputs[i],args,scope);
   if(row.meta.iid===IID_INFO&&slot===16&&args[0])throw new HResult(0x80040110);
   args.server=row.server;invoked=true;
   const words=args.flatMap((p,i)=>contract.args[i].k==='variantValue'?Array.from({length:4},(_,n)=>this.c.word(p+n*4)):[p]);
   const hr=await this.c.call(row.server,slot,words);
   const outputs=[];for(let i=0;i<inputs.length;i++)outputs.push(await this.encodeOutput(contract.args[i],args[i],args,refs));
   return {packet:['WA_AUTOMATION_1',row.meta.iid,slot,hr,outputs],references:refs};
  }catch(e){await this.a.releasePackets(refs);throw e;}
  finally{await this.c.cleanup(async()=>{if(invoked)for(let i=0;i<args.length;i++)await this.cleanNative(contract.args[i],args[i],args);await scope.close();});}
 }
}
module.exports={AutomationContracts,contracts,IID_INFO,IID_LIB,IID_DISPATCH};
