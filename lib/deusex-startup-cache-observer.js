'use strict';

// Worker-local, optional diagnostic. No Engine, Draw, guest calls, breakpoints,
// instruction watching, or guest writes. run is an ordinary run(1) adapter.
(() => {
const CORE_SHA256='2de35e0b4cf498e3587c76c0d0d332e5c29e1915986a79fa1521d8124a4c6167';
const METHODS=Object.freeze([
  ['Init',0x24a00,4],['Create',0x254e0,6],['FlushItem',0x24c70,2],
  ['CreateNewFreeSpace',0x25170,5],['MergeWithNext',0x24c50,1]
].map(([name,rva,args])=>Object.freeze({name,rva,args})));
const CUTS=Object.freeze({
  decision:0x24c96, beforeClear:0x24ca3, afterClearPrevious:0x24cb2,
  afterClearNext:0x24cdc, locked:0x24d1e
});
class StartupCacheObserver {
  constructor(ex,{workerSlot,coreSha256,maxBoundaries=100000,maxRecords=256,maxMs=1000,now=()=>performance.now()}={}) {
    if(workerSlot!==0||coreSha256!==CORE_SHA256) throw Error('unsupported Worker/Core pin');
    for(const [n,v,max] of [['maxBoundaries',maxBoundaries,1000000],['maxRecords',maxRecords,1024],['maxMs',maxMs,10000]])
      if(!Number.isSafeInteger(v)||v<1||v>max) throw Error('invalid '+n);
    this.ex=ex;this.now=now;this.start=now();this.bounds={maxBoundaries,maxRecords,maxMs};
    this.result=null;this.stack=[];this.identity=null;this.last=null;
    this.report={version:1,status:'running',coreSha256,sequence:0,records:[],
      gaps:{history:'Before attachment unknown; Init entry does not prove absence of earlier cache objects',
        threads:'Only Worker slot 0/thread 1; foreign thread stops observation; concurrent writers and other Workers are unobserved, snapshots are not atomic',
        inline:'Core Create inline eviction and SoftDrv inline lock/release unsupported',
        lifetime:'No full cache lifetimes; only certified FlushItem clear block and bounded method intervals',
        pairing:'Saved PC/ESP pairing; unwind, tail-call and undelivered entry history unknown'},
      coverage:{initEntries:0,initReturns:0,clears:0,locked:0,duplicates:0}};
  }
  read(a,n=4) {
    if(!Number.isSafeInteger(a)||a<=0||a+n>0x100000000||n<1||n>64) throw Error('invalid read');
    const b=new Uint8Array(this.ex.memory.buffer),out=[];
    for(let i=0;i<n;i++) {const w=this.ex.guest_to_wasm(a+i)>>>0;if(w===0xf0||w>=b.length)throw Error('unmapped read');out.push(b[w]);}
    return out;
  }
  u32(a) {const b=this.read(a);return (b[0]+256*b[1]+65536*b[2]+16777216*b[3])>>>0;}
  signature(a,hex) {if(this.read(a,hex.length/2).map(v=>v.toString(16).padStart(2,'0')).join('')!==hex)throw Error('original bytes changed');}
  module() {
    const e=this.ex,v=new DataView(e.memory.buffer),w=new Int32Array(e.memory.buffer);
    const table=e.get_dll_table()>>>0,life=e.get_dll_lifecycle_table()>>>0,stride=e.get_dll_lifecycle_stride()>>>0,count=e.get_dll_count()>>>0;
    if(count>256||stride<8)throw Error('invalid loader table');
    let found=null;
    for(let i=0;i<count;i++) {
      const row=table+i*32,s=life+i*stride,state=Atomics.load(w,s>>>2);
      if(state!==1&&state!==2)continue; // INITIALIZING is intentionally observable.
      const generation=Atomics.load(w,(s+4)>>>2)>>>0,base=Atomics.load(w,row>>>2)>>>0,size=v.getUint32(row+4,true),er=v.getUint32(row+8,true);
      if(!base||!er||er+40>size)continue;
      const nr=this.u32(base+er+12);if(!nr||nr+9>size)continue;
      if(String.fromCharCode(...this.read(base+nr,9)).toLowerCase()!=='core.dll\0')continue;
      const pe=this.u32(base+60);
      if(size!==0x1b8000||pe>4096||this.u32(base+pe)!==0x4550||this.u32(base+pe+52)!==0x10100000)throw Error('foreign Core module');
      if(Atomics.load(w,s>>>2)!==state||(Atomics.load(w,(s+4)>>>2)>>>0)!==generation||(Atomics.load(w,row>>>2)>>>0)!==base)throw Error('loader changed during read');
      if(found)throw Error('ambiguous Core module');found={index:i,base,size,generation};
    }
    return found;
  }
  item(a) {
    const next=this.u32(a+20),data=this.u32(a+8),end=next?this.u32(next+8):null;
    return {metadata:a,id64:this.read(a,8).reverse().map(b=>b.toString(16).padStart(2,'0')).join(''),
      data,range:end!==null&&end>=data?{start:data,end}:null,timeAndFlags:this.u32(a+12),cost:this.u32(a+16),
      next,previous:this.u32(a+24),hashNext:this.u32(a+28)};
  }
  cache(a) {
    const items=[],seen=new Set();let p=this.u32(a+24);
    while(p) {if(seen.has(p)||items.length>=32)throw Error('physical chain exceeds supported bound');seen.add(p);items.push(this.item(p));p=items.at(-1).next;}
    return {object:a,initialized:this.u32(a),metadataPool:this.u32(a+20),freeMetadata:this.u32(a+32),items};
  }
  emit(row) {
    if(this.report.records.length>=this.bounds.maxRecords){this.finish('record-limit');return false;}
    this.report.records.push({...row,pc:this.ex.get_eip()>>>0,esp:this.ex.get_esp()>>>0,
      sequence:this.report.sequence,module:this.identity,workerSlot:0,thread:1,lifetime:'unknown'});return true;
  }
  finish(reason='explicit-stop') {
    if(!this.result){this.report.status=reason;this.report.pending=this.stack.map(f=>({name:f.name,entry:f.sequence,clearPending:!!f.before}));this.result=this.report;}
    return this.result;
  }
  observe() {
    if(this.result)return;
    try {
      if(this.now()-this.start>=this.bounds.maxMs)return this.finish('time-limit');
      if(this.report.sequence>=this.bounds.maxBoundaries)return this.finish('boundary-limit');
      this.report.sequence++;
      const e=this.ex;if(e.get_current_thread_id()>>>0!==1)throw Error('foreign thread');
      const m=this.module();
      if(!m){if(this.identity)throw Error('Core unloaded');return;}
      if(this.identity&&JSON.stringify(m)!==JSON.stringify(this.identity))throw Error('Core reloaded');
      this.identity=m;
      const pc=e.get_eip()>>>0,esp=e.get_esp()>>>0,stamp=pc+':'+esp;
      if(stamp===this.last){this.report.coverage.duplicates++;return;}this.last=stamp;
      let f=this.stack.at(-1);
      if(f&&pc===f.caller) {
        if(esp!==f.esp+4+f.args.length*4)throw Error('return stack mismatch');
        if(f.before)throw Error('clear post-boundary missing');
        this.emit({type:'method-return',name:f.name,entry:f.sequence,object:f.object,eax:e.get_eax()>>>0,cache:this.cache(f.object)});
        if(f.name==='Init')this.report.coverage.initReturns++;
        this.stack.pop();f=this.stack.at(-1);
      }
      const method=METHODS.find(c=>pc===m.base+c.rva);
      if(method) {
        if(this.stack.length>=16)throw Error('nesting bound');
        this.signature(pc,method.name==='MergeWithNext'?'8b44240456':'558bec6aff');
        const args=Array.from({length:method.args},(_,i)=>this.u32(esp+4+i*4)),object=e.get_ecx()>>>0;
        const frame={...method,args,object,esp,caller:this.u32(esp),sequence:this.report.sequence};
        if(this.emit({type:'method-entry',name:method.name,object,args,caller:frame.caller,esp,
          initializedBefore:method.name==='Init'?this.u32(object):null,
          item:method.name==='FlushItem'?this.item(args[0]):null}))this.stack.push(frame);
        if(method.name==='Init')this.report.coverage.initEntries++;
      }
      f=this.stack.at(-1);
      if(!f||f.name!=='FlushItem')return;
      const rva=pc-m.base;
      if(!Object.values(CUTS).includes(rva))return;
      // Original JGE must lead either to locked or to the contiguous clear block.
      this.signature(m.base+CUTS.decision,'8b4610897dfc3d000000017d7b8b4618893e3bc7897e04897e10742a');
      if((e.get_ebp()>>>0)!==f.esp-4||this.u32((e.get_ebp()>>>0)+8)!==f.args[0])throw Error('foreign FlushItem frame');
      if(rva===CUTS.beforeClear) {
        if((e.get_esi()>>>0)!==f.args[0]||(e.get_edi()>>>0)!==0)throw Error('clear register contract');
        f.before=this.item(f.args[0]);f.beforeSequence=this.report.sequence;
        this.emit({type:'before-id-clear',object:f.object,item:f.before,entry:f.sequence});
      } else if(rva===CUTS.afterClearPrevious||rva===CUTS.afterClearNext) {
        if(f.cleared&&rva===CUTS.afterClearNext)return;
        if(!f.before)throw Error('clear pre-boundary missing');
        const after=this.item(f.args[0]);
        if(after.id64!=='0000000000000000'||after.cost!==0)throw Error('clear postcondition');
        this.emit({type:'id-cleared-before-coalesce',object:f.object,before:f.before,item:after,
          beforeSequence:f.beforeSequence,entry:f.sequence,evidence:'original-mandatory-CFG-clear-block'});
        f.before=null;f.cleared=true;this.report.coverage.clears++;
      } else if(rva===CUTS.locked) {
        this.emit({type:'locked-no-clear',object:f.object,item:this.item(f.args[0]),entry:f.sequence});this.report.coverage.locked++;
      }
    }catch(error){this.report.error=String(error);this.finish('unsupported-or-unobservable');}
  }
  run(ex,steps) {
    if(ex!==this.ex){this.finish('foreign-instance');throw Error('foreign instance');}
    let total=0;
    for(let i=0;i<Math.max(0,steps|0);i++) {
      if(ex.get_yield_reason())break;
      this.observe();
      try{ex.run(1);}catch(error){this.finish('guest-trap');throw error;}
      total+=ex.get_last_run_blocks()>>>0;this.observe();
      if(ex.get_yield_reason()||!ex.get_eip()||(ex.get_last_run_halt()>>>0)!==1)break;
    }
    return total;
  }
}
const api={CORE_SHA256,METHODS,CUTS,StartupCacheObserver};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else self.DeusExStartupCacheObserver=api;
})();
