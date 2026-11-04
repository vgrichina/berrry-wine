'use strict';

// Optional owning-Worker facade. Never adopt a mapping discovered by name or
// supplied descriptor: only load_dll's own staged input and published row bind.
(() => {
const node=typeof module!=='undefined'&&module.exports;
const startup=node?require('./deusex-startup-cache-observer'):self.DeusExStartupCacheObserver;
const inline=node?require('./deusex-inline-eviction-observer'):self.DeusExInlineEvictionObserver;
const soft=node?require('./deusex-softdrv-cache-observer'):self.DeusExSoftDrvCacheObserver;
const MEDIA=Object.freeze([
  {kind:'Core',hash:startup.CORE_SHA256,size:790528,imageSize:0x1b8000,preferred:0x10100000,Source:inline.InlineEvictionObserver},
  {kind:'SoftDrv',hash:soft.SOFTDRV_SHA256,size:389120,imageSize:0xb9000,preferred:0x10d00000,Source:soft.SoftDrvCacheObserver}
]);

// Synchronous because load_dll publishes under the production loader lock.
// No await, staging copy, guest execution or lock release occurs during hashing.
function sha256(bytes) {
  if(node)return require('node:crypto').createHash('sha256').update(bytes).digest('hex');
  const k=[],h=[];
  for(let n=2;k.length<64;n++) {
    let prime=true;for(let d=2;d*d<=n;d++)if(n%d===0){prime=false;break;}
    if(prime){if(h.length<8)h.push((Math.sqrt(n)%1*4294967296)|0);k.push((Math.cbrt(n)%1*4294967296)|0);}
  }
  const length=bytes.length,buf=new Uint8Array(Math.ceil((length+9)/64)*64);
  buf.set(bytes);buf[length]=128;
  const view=new DataView(buf.buffer);view.setUint32(buf.length-8,Math.floor(length/536870912));view.setUint32(buf.length-4,length*8>>>0);
  const r=(x,n)=>(x>>>n)|(x<<(32-n)),w=new Int32Array(64);
  for(let off=0;off<buf.length;off+=64) {
    for(let i=0;i<64;i++)w[i]=i<16?view.getInt32(off+i*4):
      (w[i-16]+(r(w[i-15],7)^r(w[i-15],18)^(w[i-15]>>>3))+w[i-7]+(r(w[i-2],17)^r(w[i-2],19)^(w[i-2]>>>10)))|0;
    let [a,b,c,d,e,f,g,j]=h;
    for(let i=0;i<64;i++) {
      const t=(j+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+k[i]+w[i])|0;
      const u=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))|0;
      j=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+u)|0;
    }
    [a,b,c,d,e,f,g,j].forEach((v,i)=>{h[i]=(h[i]+v)|0;});
  }
  return h.map(v=>(v>>>0).toString(16).padStart(8,'0')).join('');
}

class CacheLoaderBinding {
  constructor(ex,{workerSlot,endpointIdentity,limits={}}={}) {
    if(workerSlot!==0||!Number.isSafeInteger(endpointIdentity)||endpointIdentity<1)throw Error('unsupported cache observation owner');
    // Validate limits before any guest access, using the proven source itself.
    new inline.InlineEvictionObserver(ex,{workerSlot:0,coreSha256:startup.CORE_SHA256,...limits});
    this.ex=ex;this.limits=limits;this.active=[];this.lastBlocks=null;
    this.report={version:1,status:'running',workerSlot,endpointIdentity,thread:1,events:[],sources:[],runs:0,
      history:'unknown',gaps:['Pre-attachment/preexisting mappings unknown; no adoption by name',
        'Only JS run calls on this Worker instance/thread 1; internal WAT reentry, other Workers/threads and concurrent writers unknown',
        'Unqualified encodings, duplicate boundaries, callback ordering and full lifetimes unknown; Core/SoftDrv records are not joined']};
    const facade=Object.assign(Object.create(null),ex);
    facade.load_dll=(...args)=>this.load(args);
    facade.load_pe=(...args)=>{
      if(this.report.sources.length)this.stop('process-image-replaced');
      this.lastBlocks=null;return ex.load_pe(...args);
    };
    facade.run=n=>this.run(n);
    facade.get_last_run_blocks=()=>this.lastBlocks===null?ex.get_last_run_blocks():this.lastBlocks;
    this.exports=facade;
    if(ex.get_dll_count())this.event({type:'late-attachment',count:ex.get_dll_count()>>>0,history:'unknown'});
  }
  event(row) {
    if(this.report.events.length<256)this.report.events.push(row);
    else this.stop('binding-event-limit');
  }
  token(index) {
    const e=this.ex,w=new Int32Array(e.memory.buffer),v=new DataView(e.memory.buffer);
    const life=e.get_dll_lifecycle_table()>>>0,stride=e.get_dll_lifecycle_stride()>>>0,count=e.get_dll_count()>>>0;
    if(index<0||index>=count||count>256||stride<8)throw Error('invalid published loader row');
    const l=life+index*stride,t=(e.get_dll_table()>>>0)+index*32;
    const state=Atomics.load(w,l>>>2),generation=Atomics.load(w,(l+4)>>>2)>>>0;
    const base=Atomics.load(w,t>>>2)>>>0,size=v.getUint32(t+4,true);
    if(![1,2].includes(state)||!generation||!base||Atomics.load(w,l>>>2)!==state||
      (Atomics.load(w,(l+4)>>>2)>>>0)!==generation||(Atomics.load(w,t>>>2)>>>0)!==base)throw Error('unavailable loader generation');
    return {index,base,size,generation};
  }
  stop(reason) {
    if(this.report.status==='running')this.report.status=reason;
    for(const s of this.active)s.source.finish(reason);this.active=[];
  }
  load(args) {
    const e=this.ex,length=args[0]>>>0,staging=e.get_staging()>>>0;
    if(this.report.status!=='running')return e.load_dll(...args);
    let media=null,hash=null,error=null;
    try {
      if(length>e.get_staging_size()||staging+length>e.memory.buffer.byteLength)throw Error('invalid staged media extent');
      const bytes=new Uint8Array(e.memory.buffer,staging,length);
      if(MEDIA.some(m=>m.size===length)) {
        hash=sha256(bytes);media=MEDIA.find(m=>m.hash===hash)||null;
        if(media) {
          const v=new DataView(e.memory.buffer,staging,length),pe=v.getUint32(60,true);
          if(v.getUint16(0,true)!==0x5a4d||v.getUint32(pe,true)!==0x4550||
            v.getUint32(pe+52,true)!==media.preferred||v.getUint32(pe+80,true)!==media.imageSize)throw Error('invalid pinned PE');
        }
      }
    }catch(err){error=String(err);media=null;}
    // Mapping/loader errors propagate unchanged. This call maps; it does not
    // execute DllMain. Binding is complete before returning to the JS loader.
    const result=e.load_dll(...args);
    try {
      const token=this.token(e.get_last_loaded_dll_index()|0);
      if(!media){if(hash||error)this.event({type:'unverified-media',hash,error,token,history:'unknown'});return result;}
      if(e.get_current_thread_id()>>>0!==1)throw Error('foreign mapping thread');
      if(token.size!==media.imageSize)throw Error('mapped PE size mismatch');
      const previous=this.active.find(s=>s.token.index===token.index);
      if(previous&&JSON.stringify(previous.token)===JSON.stringify(token)) {
        this.event({type:'mapping-reused',kind:media.kind,hash,token});return result;
      }
      if(previous){previous.source.finish('generation-replaced');this.active=this.active.filter(s=>s!==previous);}
      const source=new media.Source(e,{...this.limits,workerSlot:0,coreSha256:startup.CORE_SHA256,softdrvSha256:soft.SOFTDRV_SHA256});
      if(JSON.stringify(source.module())!==JSON.stringify(token))throw Error('media mapping identity mismatch');
      source.identity=token;
      this.active.push({token,source});
      const row={kind:media.kind,hash,token,history:'unknown',report:source.report};
      this.report.sources.push(row);this.event({type:'bound-before-execution',kind:media.kind,hash,token});
    }catch(err){this.event({type:'binding-rejected',error:String(err),hash,history:'unknown'});}
    return result;
  }
  observe() {
    for(const s of this.active) {
      if(s.source.result)continue;
      try {
        if(this.ex.get_current_thread_id()>>>0!==1)throw Error('foreign thread');
        if(JSON.stringify(this.token(s.token.index))!==JSON.stringify(s.token))throw Error('stale loader generation');
        s.source.observe();
      }catch(err){s.source.report.bindingError=String(err);s.source.finish('binding-lost');}
    }
  }
  run(n) {
    const e=this.ex;this.report.runs++;
    this.observe();
    if(!this.active.some(s=>!s.source.result)||(n|0)<=0) {
      this.lastBlocks=null;return e.run(n);
    }
    const previousBlocks=this.exports.get_last_run_blocks();
    let total=0;this.lastBlocks=null;
    try {
      do {
        this.observe();e.run(1);total+=e.get_last_run_blocks()>>>0;this.observe();
        if(e.get_yield_reason()||!e.get_eip()||(e.get_last_run_halt()>>>0)!==1)break;
      }while(total<(n|0));
      this.lastBlocks=total;
    }catch(err){this.lastBlocks=previousBlocks;this.stop('guest-trap');throw err;}
  }
  snapshot() {this.observe();return this.report;}
}
const api={CacheLoaderBinding,sha256};
if(node)module.exports=api;else self.DeusExCacheLoaderBinding=api;
})();
