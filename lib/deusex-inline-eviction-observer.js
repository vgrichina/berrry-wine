'use strict';

// Optional Worker-local extension of the startup source. Reads only; ordinary
// run(1) boundaries, no guest calls, debug instruction watching or heap writes.
(() => {
const source=typeof module!=='undefined'&&module.exports?require('./deusex-startup-cache-observer'):self.DeusExStartupCacheObserver;
const {StartupCacheObserver,CORE_SHA256}=source;
const CUTS=Object.freeze({failed:0x25648,loop:0x256c0,retiring:0x256cb,remove:0x2570d,recycle:0x2572d,
  selected:0x25750,replaceRemove:0x25792,replace:0x257b2,publishedSplit:0x25812,publishedNoSplit:0x2587e});
// Relocation-free original instructions: branch targets delimit ordinary
// decoder blocks. Absence of any required delivery ends support explicitly.
const PINS=Object.freeze([
  [0x25642,'33f63bfe75788b4b188975e08975e8'],
  [0x256c0,'8b4dec3bcf0f84850000008b018b49048bd00bd17457894dd4'],
  [0x2570d,'8b411c8906eb198d711cebe0'],
  [0x2572d,'8b55ec8b42188945ec8b48148b51148950148942188b5320895114894b20e970ffffff'],
  [0x25750,'8b078b4f048bd00bd17457'],
  [0x25792,'8b411c8902eb198d511cebe0'],
  [0x257b2,'8b57088b45188bc88d7402ff668b53048b450849f7d16689570c8b551423f18b4d0c81c2000000018907894f048957108bc88bd0'],
  [0x257e6,'c1e90c81e200f0ff0333ca8bd0c1e90c81e2ff3f000033ca8b548b24'],
  [0x25802,'89571c8d4c8b2489398b4b2085c9746c']
].map(([rva,hex])=>Object.freeze({rva,hex})));
class InlineEvictionObserver extends StartupCacheObserver {
  constructor(ex,options) {
    super(ex,options);
    this.report.gaps.inline='Core Create certified hash removal/recycle/replacement blocks only; SoftDrv inline hit/release and other paths unproved';
    this.report.gaps.lifetime='No full lifetimes; inherited Init/FlushItem intervals plus bounded Core Create inline transitions';
    this.report.gaps.loader='Optional library only; all loader/scheduler execution seams and natural run integration unproved';
    Object.assign(this.report.coverage,{hashRemovals:0,recycles:0,publications:0});
  }
  finish(reason) {
    const report=super.finish(reason);
    if(!report.inlinePending)report.inlinePending=this.stack.filter(f=>f.inline).map(f=>({entry:f.sequence,phase:f.inline.phase,item:f.inline.before.metadata}));
    return report;
  }
  run(ex,steps) {return super.run(ex,steps);}
  observe() {
    if(this.result)return;
    try {
      const top=this.stack.at(-1),pc=this.ex.get_eip()>>>0;
      if(top?.name==='Create'&&pc===top.caller&&(!top.inlinePublished||top.inline))throw Error('Create inline history incomplete at return');
      const duplicates=this.report.coverage.duplicates;
      super.observe();
      if(this.result||this.report.coverage.duplicates!==duplicates)return;
      const f=this.stack.at(-1),m=this.identity;
      if(!m||f?.name!=='Create')return;
      const rva=pc-m.base;
      if(rva===f.rva)for(const pin of PINS)this.signature(m.base+pin.rva,pin.hex);
      if(!Object.values(CUTS).includes(rva))return;
      for(const pin of PINS)this.signature(m.base+pin.rva,pin.hex);
      const e=this.ex,ebp=e.get_ebp()>>>0;
      if(ebp!==f.esp-4||(e.get_ebx()>>>0)!==f.object)throw Error('foreign Create frame');
      const emit=(type,data)=>this.emit({type,name:'Create',entry:f.sequence,object:f.object,...data});
      if(rva===CUTS.failed) {
        if((e.get_edi()>>>0)!==0||f.inline)throw Error('failed selection contract');
        emit('inline-no-candidate',{cache:this.cache(f.object),evidence:'original-selection-rejected; diagnostic/unwind outcome unknown'});
      } else if(rva===CUTS.retiring||rva===CUTS.selected) {
        if(f.inline)throw Error('inline transition unfinished');
        const metadata=rva===CUTS.retiring?this.u32(ebp-20):e.get_edi()>>>0;
        const before=this.item(metadata);
        f.inline={phase:rva===CUTS.retiring?'retiring':'selected',before,beforeSequence:this.report.sequence};
        if(!emit('before-inline-retirement',{kind:f.inline.phase,item:before}))return;
      } else if(rva===CUTS.remove||rva===CUTS.replaceRemove) {
        const p=f.inline,kind=rva===CUTS.remove?'retiring':'selected';
        if(!p||p.phase!==kind)throw Error('hash removal prior history missing');
        const link=rva===CUTS.remove?e.get_esi()>>>0:e.get_edx()>>>0;
        if((e.get_ecx()>>>0)!==p.before.metadata||this.u32(link)!==p.before.metadata)throw Error('hash link contract');
        p.link=link;p.linkNext=p.before.hashNext;p.removeSequence=this.report.sequence;
        if(!emit('before-inline-unhash',{kind,item:p.before,link,next:p.linkNext}))return;
      } else if(rva===CUTS.recycle||rva===CUTS.replace) {
        const p=f.inline,kind=rva===CUTS.recycle?'retiring':'selected';
        if(!p||p.phase!==kind)throw Error('inline pre-boundary missing');
        if(p.before.id64!=='0000000000000000') {
          if(!p.removeSequence||this.u32(p.link)!==p.linkNext)throw Error('unhash postcondition or prior history missing');
          if(!emit('inline-id-unhashed',{kind,before:p.before,item:this.item(p.before.metadata),beforeSequence:p.removeSequence,link:p.link,next:p.linkNext}))return;
          this.report.coverage.hashRemovals++;
        }
        if(kind==='retiring') {
          p.previous=this.u32(p.before.metadata+24);p.next=this.u32(p.before.metadata+20);p.free=this.u32(f.object+32);p.phase='recycling';
          if(!p.previous||!p.next)throw Error('recycle neighbors missing');
          if(!emit('before-inline-recycle',{item:this.item(p.before.metadata),previous:p.previous,next:p.next,free:p.free}))return;
        } else {
          p.phase='publishing';
          if(!emit('before-inline-replacement',{before:p.before,item:this.item(p.before.metadata)}))return;
        }
      } else if(rva===CUTS.loop&&f.inline) {
        const p=f.inline;
        if(p.phase!=='recycling'||this.u32(f.object+32)!==p.before.metadata||
          this.u32(p.previous+20)!==p.next||this.u32(p.next+24)!==p.previous||this.u32(p.before.metadata+20)!==p.free)throw Error('recycle postcondition');
        if(!emit('inline-metadata-recycled',{before:p.before,item:{...this.item(p.before.metadata),range:null},rangeValidity:'recycled metadata is no longer a physical span',beforeSequence:p.beforeSequence,freeMetadata:this.u32(f.object+32),previous:p.previous,next:p.next}))return;
        this.report.coverage.recycles++;f.inline=null;
      } else if(rva===CUTS.publishedSplit||rva===CUTS.publishedNoSplit) {
        if(f.inlinePublished)return; // later no-split join after helper calls
        const p=f.inline;
        if(!p||p.phase!=='publishing')throw Error('publication prior history missing');
        const item=this.item(p.before.metadata),id=f.args[1].toString(16).padStart(8,'0')+f.args[0].toString(16).padStart(8,'0');
        const hash=((f.args[0]>>>24)^((f.args[0]&0x3fff000)>>>12)^(f.args[0]&0x3fff))>>>0;
        if(item.id64!==id||item.cost!==((f.args[3]+0x1000000)>>>0)||this.u32(f.object+36+hash*4)!==item.metadata)throw Error('publication postcondition');
        if(!emit('inline-id-published',{before:p.before,item,beforeSequence:p.beforeSequence,evidence:'original-mandatory-CFG-blocks'}))return;
        this.report.coverage.publications++;f.inline=null;f.inlinePublished=true;
      }
    } catch(error) {this.report.error=String(error);this.finish('unsupported-or-unobservable');}
  }
}
const api={InlineEvictionObserver,CORE_SHA256,CUTS,PINS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else self.DeusExInlineEvictionObserver=api;
})();
