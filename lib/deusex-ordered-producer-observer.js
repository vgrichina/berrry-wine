'use strict';
// Promoted from the dcf6eab5 run-owned observer; records only delivered boundaries.
(() => {
// Run-owned, read-only boundary sampler. No execution, breakpoint, guest write or timer API.
const REG=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
const clone=x=>JSON.parse(JSON.stringify(x));
function store(code,r,mmx){
 let i=0,width=4,source,op=code[i++];
 if(op===0x66){width=2;op=code[i++];}
 if(op===0xa3&&width===4)return {address:(code[1]+code[2]*256+code[3]*65536+code[4]*16777216)>>>0,width:4,length:5,input:r.eax,kind:'eax'};
 if(op===0x0f){if(code[i++]!==0x7f)return null;width=8;source='mmx';}else if(op!==0x89)return null;
 const m=code[i++],mod=m>>6,reg=(m>>3)&7,rm=m&7;if(mod===3)return null;
 let address=0,disp=0;
 const d32=()=>{const n=(code[i]+code[i+1]*256+code[i+2]*65536+code[i+3]*16777216)|0;i+=4;return n;};
 if(rm===4){const sib=code[i++],base=sib&7,index=(sib>>3)&7;address=(index===4?0:r[REG[index]]*2**(sib>>6));if(mod===0&&base===5)disp=d32();else address+=r[REG[base]];}
 else if(mod===0&&rm===5)disp=d32();else address=r[REG[rm]];
 if(mod===1)disp=(code[i++]<<24)>>24;else if(mod===2)disp=d32();
 return {address:(address+disp)>>>0,width,length:i,input:source?mmx[reg]:r[REG[reg]],kind:source?`mm${reg}`:REG[reg]};
}
class OrderedObserver{
 constructor(adapter,options={}){
  this.a=adapter;this.limit={boundaries:100000,records:128,milliseconds:1000,...options};
  for(const [k,max]of Object.entries({boundaries:1000000,records:256,milliseconds:10000}))if(!Number.isInteger(this.limit[k])||this.limit[k]<1||this.limit[k]>max)throw Error('invalid '+k);
  this.ex=adapter.exports;this.started=adapter.now();this.pending=null;this.key=null;this.descriptor=null;this.palette=null;this.generation=0;
  this.result={version:1,status:'running',sequence:0,start:{time:this.started},stop:null,records:[],drops:{records:0,pending:0},coverage:{boundaries:0,decodedStores:0,overlappingStores:0,unrecognizedInstructions:0,identityChanges:0},limitations:['Only delivered boundaries; interior block writers can be missed','No allocation/free lifetime proof; palette generation counts observed pointer transitions','Static candidate PC alone never proves writer','An interval delta does not prove last writer or causality']};
 }
 stop(reason='explicit-stop'){if(this.result.status==='running'){if(this.pending)this.result.drops.pending++;this.pending=null;this.result.status=reason;this.result.stop={sequence:this.result.sequence,time:this.a.now()};}return this.result;}
 read(p,n){if(!Number.isInteger(p)||p<=0||p+n>0x100000000||n<1||n>4096)throw Error('invalid read');const b=this.a.read(p,n);if(b.length!==n)throw Error('short read');return Array.from(b);}
 u32(p){const b=this.read(p,4);return (b[0]+b[1]*256+b[2]*65536+b[3]*16777216)>>>0;}
 emit(row){if(this.result.records.length<this.limit.records)this.result.records.push(row);else this.result.drops.records++;}
 boundary({retiredInstructions=null}={}){
  const d=this.result;if(d.status!=='running')return;
  if(this.a.now()-this.started>=this.limit.milliseconds)return this.stop('time-limit');
  if(d.sequence>=this.limit.boundaries)return this.stop('boundary-limit');
  d.sequence++;d.coverage.boundaries++;
  try{
   if(this.a.exports!==this.ex||this.a.workerSlot!==0||this.a.thread()!==1)throw Error('foreign owning Worker/instance/thread');
   const module=this.a.module();if(!module||!module.sha256||!Number.isInteger(module.base)||module.size<=0||module.base+module.size>0x100000000)throw Error('invalid fresh module identity');
   const frame=this.a.frame();if(!frame||!frame.drawId||!['engine','viewport','esp','savedCaller'].every(k=>Number.isInteger(frame[k])&&frame[k]>0))throw Error('missing Draw identity');
   const identity={module:clone(module),frame:clone(frame),workerSlot:0,mmxSlot:0,thread:1};const key=JSON.stringify(identity);
   if(this.key!==key){if(this.pending)d.drops.pending++;this.pending=null;this.descriptor=null;this.palette=null;this.generation=0;d.coverage.identityChanges++;this.key=key;}
   const regs=clone(this.a.regs()),mmx=this.a.mmx0().slice();if(mmx.length!==8||mmx.some(x=>typeof x!=='string'||! /^[0-9a-f]{16}$/i.test(x)))throw Error('invalid owning slot0 MMX');
   const eip=this.a.pc(),rva=eip-module.base;
   if(this.pending){const p=this.pending;this.pending=null;p.after={sequence:d.sequence,eip,regs,mmx,bytes:this.read(p.writer.address,p.writer.width)};p.evidence=retiredInstructions===1&&eip===p.eip+p.writer.length?'single-instruction-adapter-witness':'boundary-interval-only';this.emit(p);}
   const palette=this.u32(module.base+0x7d308);if(palette!==this.palette){this.generation++;this.palette=palette;this.emit({type:'palette-selection',sequence:d.sequence,identity,palette,generation:this.generation,lifetime:'unknown'});}
   if(rva===0x3647f||rva===0x36483){this.descriptor=regs.ecx;this.emit({type:'descriptor-input',sequence:d.sequence,identity,descriptor:this.descriptor,bytes:this.read(this.descriptor,48),regs,mmx});}
   if(rva===0x36509){const from=b=>b.reduceRight((a,x)=>(a<<8n)|BigInt(x),0n),u32=0xffffffffn,u64=0xffffffffffffffffn;
    const coord=BigInt('0x'+mmx[7]),add=from(this.read(module.base+0x7d3a8,8)),sum=((((coord>>32n)+(add>>32n))&u32)<<32n)|(((coord&u32)+(add&u32))&u32),hi=((sum<<12n)&u64)>>32n,dup=(hi<<32n)|hi,shift=from(this.read(module.base+0x7d3e8,8)),mask=from(this.read(module.base+0x7d3e0,8)),index=Number((shift>=64n?0n:dup>>shift)&mask&u32),textureAddress=(regs.ebx+index)>>>0,texel=this.read(textureAddress,1)[0],entry=(regs.edx+texel*8)>>>0;
    this.emit({type:'consumer',texture:{base:regs.ebx,index,address:textureAddress,texel},selectedPaletteEntry:{address:entry,bytes:this.read(entry,8)},sequence:d.sequence,identity,regs,mmx,light:{address:regs.ebp,bytes:this.read(regs.ebp,24)},palette,registerPalette:regs.edx,paletteGeneration:this.generation,descriptor:this.descriptor,shift:this.read(module.base+0x7d3e8,8),mask:this.read(module.base+0x7d3e0,8)});}
   const code=this.read(eip,15),writer=store(code,regs,mmx);if(!writer){d.coverage.unrecognizedInstructions++;return;}
   d.coverage.decodedStores++;
   const watches=[['light',module.base+0x752f0,32],['palette-pointer',module.base+0x7d308,4],['shift-mask',module.base+0x7d3e0,16]];
   if(this.palette)watches.push(['palette',this.palette,2048]);if(this.descriptor)watches.push(['descriptor',this.descriptor,48]);
   const overlaps=watches.filter(([,p,n])=>writer.address<p+n&&p<writer.address+writer.width);if(!overlaps.length)return;
   d.coverage.overlappingStores++;
   this.pending={type:'overlapping-store',sequence:d.sequence,identity,eip,rva,code:code.slice(0,writer.length),writer,overlaps,descriptor:this.descriptor,palette:this.palette,paletteGeneration:this.generation,before:{regs,mmx,bytes:this.read(writer.address,writer.width)}};
  }catch(e){this.emit({type:'error',sequence:d.sequence,error:String(e)});this.stop('observer-error');}
 }
}

// Attach only inside the owning Worker, after the owning Draw collector exists.
// mmxBase must come from this run's RegionMap and verified main-slot layout.
// moduleSha256 pins original SoftDrv media, not the relocated in-memory image.
const attached=new WeakSet();
function attach(owner,{workerSlot,moduleSha256,mmxBase,drawId,now=()=>performance.now(),limits={}}){
 if(attached.has(owner))throw Error('already attached');
 if(workerSlot!==0||!drawId||! /^[0-9a-f]{64}$/i.test(moduleSha256)||!Number.isInteger(mmxBase)||mmxBase<0||mmxBase+64>owner.ex.memory.buffer.byteLength)throw Error('invalid run identity');
 const ex=owner.ex, frames=new WeakMap();let frameSequence=0;
 const a={get exports(){return owner.ex;},workerSlot,now,thread:()=>ex.get_current_thread_id()>>>0,
  module:()=>{const m=owner.identityModule('softdrv.dll',0x10d00000);return {...m,sha256:moduleSha256};},
  frame:()=>{const f=owner.frame;if(!f)return null;
   if(!frames.has(f))frames.set(f,`${drawId}:${++frameSequence}`);
   return {drawId:frames.get(f),engine:f.engine,viewport:f.viewport,esp:f.esp,savedCaller:f.savedCaller};},
  pc:()=>ex.get_eip()>>>0,regs:()=>Object.fromEntries(REG.map(n=>[n,ex['get_'+n]()>>>0])),
  mmx0:()=>Array.from(new BigUint64Array(ex.memory.buffer,mmxBase,8),x=>x.toString(16).padStart(16,'0')),
  read:(ga,n)=>{const out=[];for(let i=0;i<n;i++){const wa=ex.guest_to_wasm((ga+i)>>>0)>>>0;if(wa===0xf0||wa>=ex.memory.buffer.byteLength)throw Error('unmapped guest read');out.push(new Uint8Array(ex.memory.buffer)[wa]);}return out;}};
 const observer=new OrderedObserver(a,limits),previous=owner.observe;
 function wrapped(){const answer=previous.apply(this,arguments);if(this===owner&&owner.frame)observer.boundary();return answer;}
 owner.observe=wrapped;attached.add(owner);let detached=false;
 return {observer,stop(reason){observer.stop(reason);if(!detached){if(owner.observe===wrapped)owner.observe=previous;attached.delete(owner);detached=true;}return observer.result;}};
}
const api={OrderedObserver,store,attach};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else self.DeusExOrderedProducerObserver=api;
})();
