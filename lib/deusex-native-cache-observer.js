'use strict';

// Optional read-only owning-Worker source. These are native CALL intervals,
// never allocation serials or certified instruction retirements.
(() => {
const CORE_SHA256 = '2de35e0b4cf498e3587c76c0d0d332e5c29e1915986a79fa1521d8124a4c6167';
// Body RVAs, not export jump-table RVAs. Signatures avoid relocated operands.
const CONTRACTS = Object.freeze([
  {name:'Create', rva:0x254e0, args:6, signature:'558bec6aff', out:2},
  {name:'Get', rva:0x16a70, args:4, signature:'8b5424048b410856', out:2},
  {name:'Unlock', rva:0x168a0, args:0, signature:'814110000000ffc3', item:true},
  {name:'FlushItem', rva:0x24c70, args:2, signature:'558bec6aff', itemArg:0},
  {name:'Flush', rva:0x25290, args:4, signature:'558bec6aff'},
  {name:'CreateNewFreeSpace', rva:0x25170, args:5, signature:'558bec6aff'},
  {name:'MergeWithNext', rva:0x24c50, args:1, signature:'8b44240456', itemArg:0},
  {name:'Init', rva:0x24a00, args:4, signature:'558bec6aff'},
  {name:'Exit', rva:0x24ba0, args:1, signature:'558bec6aff'},
  {name:'Tick', rva:0x25900, args:0, signature:'558bec51'},
  {name:'Unhash', rva:0x16b60, args:2, signature:'8b542404568bc2'}
].map(Object.freeze));
const attached = new WeakSet();
function attach(owner, {workerSlot, coreSha256, now=()=>performance.now(), limits={}}={}) {
  if (attached.has(owner)) throw Error('already attached');
  if (workerSlot !== 0 || coreSha256 !== CORE_SHA256) throw Error('unsupported owning Worker/Core identity');
  const bound = {boundaries:100000, records:128, milliseconds:1000, pending:16, ...limits};
  for (const [key, max] of Object.entries({boundaries:1000000,records:256,milliseconds:10000,pending:32}))
    if (!Number.isInteger(bound[key]) || bound[key]<1 || bound[key]>max) throw Error('invalid '+key);
  const ex=owner.ex, start=now(), stack=[];
  let identity=null, last=null, detached=false;
  const result={version:1,status:'running',sequence:0,coreSha256:CORE_SHA256,records:[],
    coverage:{boundaries:0,entries:0,returns:0,duplicateBoundaries:0,moduleChanges:0},
    gaps:{history:'History before attachment is unavailable, including pre-readiness initialization',
      granularity:'Delivered boundaries only; interior and inlined operations can be missed',
      eviction:'Create unhashes/recycles items inline; FlushItem calls are not a complete eviction stream',
      release:'Unlock is a lock-count decrement, not item destruction or heap free',
      clientInlining:'SoftDrv inlines cache-hit acquisition and lock release; Core body entries do not cover them',
      pairing:'Entry and saved-PC/ESP return pairing does not certify a CALL or RET instruction; unwinds and tail calls may remain pending',
      lifetime:'No complete lifetime or absence-of-reuse proof, including other threads and unobserved calls'},
    pendingAtStop:0,start,stop:null};
  function stop(reason='explicit-stop') {
    if(result.status==='running') {
      result.status=reason;result.pendingAtStop=stack.length;
      result.stop={sequence:result.sequence,time:now()};
    }
    return result;
  }
  function read(address,n) {
    if(!Number.isInteger(address)||address<=0||address+n>0x100000000||n<1||n>128) throw Error('invalid native read');
    const b=new Uint8Array(ex.memory.buffer),out=[];
    for(let i=0;i<n;i++) {
      const w=ex.guest_to_wasm(address+i)>>>0;
      if(w===0xf0||w>=b.length) throw Error('unmapped native read');
      out.push(b[w]);
    }
    return out;
  }
  const u32=a=>{const b=read(a,4);return (b[0]+b[1]*256+b[2]*65536+b[3]*16777216)>>>0;};
  const item=a=>a?{address:a,id:read(a,8),data:u32(a+8),timeAndFlags:u32(a+12),cost:u32(a+16),next:u32(a+20),previous:u32(a+24),hashNext:u32(a+28)}:null;
  function emit(row) {
    if(result.records.length>=bound.records) {stop('record-limit');return false;}
    result.records.push({...row,sequence:result.sequence,module:identity,workerSlot:0,thread:1,evidence:'native-call-boundary-interval',allocationLifetime:'unknown'});
    return true;
  }
  function boundary() {
    if(result.status!=='running') return;
    if(now()-start>=bound.milliseconds) return stop('time-limit');
    if(result.sequence>=bound.boundaries) return stop('boundary-limit');
    result.sequence++;result.coverage.boundaries++;
    try {
      if(owner.ex!==ex||ex.get_current_thread_id()>>>0!==1) throw Error('foreign owning instance/thread');
      const m=owner.identityModule('core.dll',0x10100000);
      if(m.size!==0x1b8000) throw Error('unsupported Core image size');
      const key=JSON.stringify(m);
      if(identity&&key!==JSON.stringify(identity)) {result.coverage.moduleChanges++;return stop('module-changed');}
      identity=m;
      const pc=ex.get_eip()>>>0, esp=ex.get_esp()>>>0;
      // A repeated explicit observation at the same CPU boundary is not a call.
      // A tight loop with identical PC/ESP is also conservatively suppressed.
      const stamp=key+':'+pc+':'+esp;
      if(stamp===last) {result.coverage.duplicateBoundaries++;return;}
      last=stamp;
      const pending=stack.at(-1);
      if(pending&&pc===pending.caller) {
        if(esp!==pending.esp+4+pending.contract.args*4) throw Error('native return stack mismatch');
        const eax=ex.get_eax()>>>0;
        const selected=pending.contract.name==='Get'&&eax===0?0:
          pending.contract.out===undefined?pending.itemAddress:u32(pending.args[pending.contract.out]);
        const after=selected?item(selected):null;
        if(!emit({type:'native-return',name:pending.contract.name,entrySequence:pending.sequence,caller:pc,esp,eax,thisPointer:pending.thisPointer,args:pending.args,item:after})) return;
        stack.pop();result.coverage.returns++;
      }
      const contract=CONTRACTS.find(c=>pc===m.base+c.rva);
      if(!contract) return;
      const hex=read(pc,contract.signature.length/2).map(b=>b.toString(16).padStart(2,'0')).join('');
      if(hex!==contract.signature) throw Error('native signature changed: '+contract.name);
      if(stack.length>=bound.pending) return stop('pending-limit');
      const args=Array.from({length:contract.args},(_,i)=>u32(esp+4+i*4));
      const thisPointer=ex.get_ecx()>>>0, caller=u32(esp);
      if(!caller||caller>=m.base+contract.rva&&caller<m.base+contract.rva+contract.signature.length/2) throw Error('invalid native caller');
      const itemAddress=contract.item?thisPointer:contract.itemArg===undefined?0:args[contract.itemArg];
      const entry={contract,sequence:result.sequence,esp,caller,thisPointer,args,itemAddress};
      if(emit({type:'native-entry',name:contract.name,caller,esp,thisPointer,args,item:itemAddress?item(itemAddress):null})) {
        stack.push(entry);result.coverage.entries++;
      }
    } catch(error) {result.error=String(error);stop('unsupported-or-unobservable');}
  }
  const previous=owner.observe;
  function wrapped() {
    // Preserve return values/throws; diagnostic failures never escape into run.
    const value=previous.apply(this,arguments);
    if(this===owner) boundary();
    return value;
  }
  owner.observe=wrapped;attached.add(owner);
  return {result,boundary,stop(reason) {
    stop(reason);
    if(!detached) {
      if(owner.observe===wrapped) owner.observe=previous;
      attached.delete(owner);detached=true;
    }
    return result;
  }};
}
const api={CORE_SHA256,CONTRACTS,attach};
if(typeof module!=='undefined'&&module.exports) module.exports=api;
else self.DeusExNativeCacheObserver=api;
})();
