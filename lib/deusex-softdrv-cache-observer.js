'use strict';

// Optional passive ordinary-block adapter. Media-to-loader binding is external.
(() => {
const parent=typeof module!=='undefined'&&module.exports?require('./deusex-startup-cache-observer'):self.DeusExStartupCacheObserver;
const {StartupCacheObserver,CORE_SHA256}=parent;
const SOFTDRV_SHA256='25d14f3b6cca27053aa05b191424f4c0c0dffe0837406b44eb606cb9d8aeae18';
const CUTS=Object.freeze({fast:0x2650f,hit:0x2655f,miss:0x26592,joined:0x26594,missed:0x265a1,release:0x94bf});
const PINS=Object.freeze([
  {rva:0x26506,hex:'3bd075243b790c751f'},
  {rva:0x2654e,hex:'85c074408b303bf275358b70043bf7752e'},
  {rva:0x2650f,hex:'8b41108945ec8b41108b701081c6000000018970108b400883c00724f8eb66'},
  {rva:0x2655f,hex:'89510889790c8941108945ec668b71046689700c8b701081c6000000018970108b40088d4418ff4bf7d323c3eb07'},
  {rva:0x26592,hex:'33c085c0'},
  {rva:0x2659b,hex:'0f85f7020000'},
  {rva:0x94bf,hex:'8b45ec814010000000ff8b4df45f5e64890d000000005b8be55dc21800'}
]);
const OTHER_RELEASES=Object.freeze([0x38766,0x421db,0x45c4a,0x46139,0x46606,0x46b04,0x46fb9,0x474e6,0x47541]);
class SoftDrvCacheObserver extends StartupCacheObserver {
  constructor(ex,options={}) {
    if(options.softdrvSha256!==SOFTDRV_SHA256)throw Error('unsupported SoftDrv pin');
    super(ex,{...options,coreSha256:CORE_SHA256});
    this.pending=null;
    delete this.report.coreSha256;
    this.report.softdrvSha256=SOFTDRV_SHA256;
    this.report.gaps={history:'Before attachment unknown; selected metadata is not a certified lifetime',
      threads:'Worker 0/thread 1 only; concurrent writers unobserved; reads are not atomic',
      scope:'Only palette fast/hash-hit blocks, miss join and release 94bf; other release paths stop unsupported',
      lifetime:'Lock acquisition/release never denotes invalidation or retirement; Core and loader-driven execution require separate coverage',
      integration:'Optional queued execution adapter only; no natural driver or full loader integration'};
    this.report.coverage={acquisitions:0,releases:0,misses:0,duplicates:0};
  }
  module() {
    const e=this.ex,v=new DataView(e.memory.buffer),w=new Int32Array(e.memory.buffer);
    const table=e.get_dll_table()>>>0,life=e.get_dll_lifecycle_table()>>>0,stride=e.get_dll_lifecycle_stride()>>>0,count=e.get_dll_count()>>>0;
    if(count>256||stride<8)throw Error('invalid loader table');
    let found=null;
    for(let i=0;i<count;i++) {
      const row=table+i*32,s=life+i*stride,state=Atomics.load(w,s>>>2);
      if(state!==1&&state!==2)continue;
      const generation=Atomics.load(w,(s+4)>>>2)>>>0,base=Atomics.load(w,row>>>2)>>>0,size=v.getUint32(row+4,true),er=v.getUint32(row+8,true);
      if(!base||!er||er+40>size)continue;
      const nr=this.u32(base+er+12);if(!nr||nr+12>size)continue;
      if(String.fromCharCode(...this.read(base+nr,12)).toLowerCase()!=='softdrv.dll\0')continue;
      const pe=this.u32(base+60);
      if(size!==0xb9000||pe>4096||this.u32(base+pe)!==0x4550||this.u32(base+pe+52)!==0x10d00000)throw Error('foreign SoftDrv module');
      if(Atomics.load(w,s>>>2)!==state||(Atomics.load(w,(s+4)>>>2)>>>0)!==generation||(Atomics.load(w,row>>>2)>>>0)!==base)throw Error('loader changed during read');
      if(found)throw Error('ambiguous SoftDrv module');found={index:i,base,size,generation};
    }
    return found;
  }
  finish(reason) {
    const r=super.finish(reason);
    if(!Object.hasOwn(r,'inlinePending'))r.inlinePending=this.pending?{...this.pending}:null;
    return r;
  }
  run(ex,steps) {return super.run(ex,steps);}
  signatures(base) {
    for(const pin of PINS)this.signature(base+pin.rva,pin.hex);
    const target=base+0x7d308,le=[target&255,target>>>8&255,target>>>16&255,target>>>24&255];
    this.signature(base+0x26596,'a3'+le.map(b=>b.toString(16).padStart(2,'0')).join(''));
  }
  observe() {
    if(this.result)return;
    try {
      if(this.now()-this.start>=this.bounds.maxMs)return this.finish('time-limit');
      if(this.report.sequence>=this.bounds.maxBoundaries)return this.finish('boundary-limit');
      this.report.sequence++;
      const e=this.ex;if(e.get_current_thread_id()>>>0!==1)throw Error('foreign thread');
      const m=this.module();
      if(!m){if(this.identity)throw Error('SoftDrv unloaded');return;}
      if(this.identity&&JSON.stringify(m)!==JSON.stringify(this.identity))throw Error('SoftDrv reloaded');
      this.identity=m;
      const pc=e.get_eip()>>>0,esp=e.get_esp()>>>0,ebp=e.get_ebp()>>>0,rva=pc-m.base,stamp=pc+':'+esp;
      if(stamp===this.last){this.report.coverage.duplicates++;return;}this.last=stamp;
      const p=this.pending;
      if(p&&((p.kind==='release'&&pc===p.caller)||(p.kind==='miss'&&rva===CUTS.missed)||(['fast','hit'].includes(p.kind)&&rva===CUTS.joined))) {
        this.signatures(m.base);
        if(ebp!==(p.kind==='release'?p.savedEbp:p.ebp)||esp!==(p.kind==='release'?p.ebp+32:p.esp))throw Error('inline frame/stack mismatch');
        if(p.kind==='miss') {
          if((e.get_eax()>>>0)!==0)throw Error('miss postcondition');
          if(!this.emit({type:'inline-cache-miss',beforeSequence:p.sequence,selectedItem:null}))return;
          this.report.coverage.misses++;
        } else {
          const after=this.item(p.before.metadata),delta=p.kind==='release'?-0x1000000:0x1000000;
          const expected={...p.before,cost:(p.before.cost+delta)>>>0};
          if(p.kind==='hit')expected.timeAndFlags=((expected.timeAndFlags&0xffff0000)|p.time)>>>0;
          if(JSON.stringify(after)!==JSON.stringify(expected))throw Error('lock postcondition or identity changed');
          if(p.kind!=='release'&&(e.get_eax()>>>0)!==p.aligned)throw Error('aligned data postcondition');
          if(p.kind!=='release'&&(this.u32(p.ebp-20)!==after.metadata||this.u32(p.object+16)!==after.metadata||
            this.u32(p.object+8)!==p.idLow||this.u32(p.object+12)!==p.idHigh))throw Error('cache reference publication postcondition');
          if(!this.emit({type:p.kind==='release'?'inline-lock-released':'inline-lock-acquired',kind:p.kind,before:p.before,item:after,
            beforeSequence:p.sequence,object:p.object,returnedData:p.kind==='release'?null:p.aligned,
            itemReference:p.kind==='release'?null:p.ebp-20,evidence:'original-mandatory-block; lock change only, no retirement'}))return;
          this.report.coverage[p.kind==='release'?'releases':'acquisitions']++;
        }
        this.pending=null;return;
      }
      if(OTHER_RELEASES.includes(rva))throw Error('unqualified SoftDrv release block');
      if(rva===CUTS.joined||rva===CUTS.missed)throw Error('acquisition prior history missing');
      if(![CUTS.fast,CUTS.hit,CUTS.miss,CUTS.release].includes(rva)) {
        if(p&&(pc<m.base||pc>=m.base+m.size))throw Error('pending block left module without post-boundary');
        return;
      }
      if(p)throw Error('inline transition unfinished');
      this.signatures(m.base);
      const kind=rva===CUTS.fast?'fast':rva===CUTS.hit?'hit':rva===CUTS.miss?'miss':'release';
      const next={kind,ebp,esp,sequence:this.report.sequence};
      if(kind!=='miss') {
        const object=e.get_ecx()>>>0,metadata=kind==='fast'?this.u32(object+16):kind==='hit'?e.get_eax()>>>0:this.u32(ebp-20);
        next.before=this.item(metadata);next.object=kind==='release'?null:object;
        if(kind==='release') {
          if(next.before.cost<0x1000000)throw Error('release without positive lock');
          next.caller=this.u32(ebp+4);next.savedEbp=this.u32(ebp);
          if(next.caller>=m.base&&next.caller<m.base+m.size)throw Error('unsupported internal release return');
        } else {
          if(next.before.id64==='0000000000000000')throw Error('acquisition of free item');
          const id=(e.get_edi()>>>0).toString(16).padStart(8,'0')+(e.get_edx()>>>0).toString(16).padStart(8,'0');
          next.idLow=e.get_edx()>>>0;next.idHigh=e.get_edi()>>>0;
          if(next.before.id64!==id)throw Error('acquisition ID mismatch');
          if(kind==='fast'&&(this.u32(object+8)!==(e.get_edx()>>>0)||this.u32(object+12)!==(e.get_edi()>>>0)))throw Error('fast cache identity mismatch');
          const alignment=kind==='fast'?8:e.get_ebx()>>>0;
          if(!alignment||(alignment&(alignment-1))||alignment>0x10000)throw Error('unsupported alignment');
          next.aligned=((next.before.data+alignment-1)&~(alignment-1))>>>0;next.time=this.u32(object+4)&0xffff;
        }
      }
      if(this.emit({type:'before-inline-lock-block',kind,item:next.before||null,object:next.object??null}))this.pending=next;
    }catch(error){this.report.error=String(error);this.finish('unsupported-or-unobservable');}
  }
}
const api={SoftDrvCacheObserver,SOFTDRV_SHA256,CUTS,PINS,OTHER_RELEASES};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else self.DeusExSoftDrvCacheObserver=api;
})();
