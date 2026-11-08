'use strict';
// Node-only synchronous owning-CPU observation. This deliberately issues no
// continuity/source-at-later-use certificate: shared writers and interior
// instructions remain uncovered even with the NodeWorker invalidation facade.
const fs = require('node:fs');
const crypto = require('node:crypto');
const {readPE} = require('../lib/pe');
const path = require('node:path');
const EXE = 'test/binaries/candidates/quake-2-demo-installer/installed-extracted/Install/Data/quake2.exe';
const EXE_SHA = '2fa987c9390663e230c5b6479285e7c55511e35f80091bfed96f43062c1c810b';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const WINDOWS = [[0x4117b0,0x2e2],[0x410e50,0x11a],[0x411aa0,0x51],
  [0x42b0b9,0x6f],[0x42f0b0,0x45],[0x41a2a0,0x53]];
function attach({getExports, getMemory}) {
  const file = fs.readFileSync(path.resolve(__dirname,'..',EXE));
  if (hash(file) !== EXE_SHA) throw Error('Quake II installed EXE PATHHASH');
  const pe = readPE(file);
  const pins = WINDOWS.map(([pc,size]) => ({pc,size,sha256:hash(file.subarray(pe.va2off(pc),pe.va2off(pc)+size))}));
  let owner, buffer, invalid, calls=0, elapsedNs=0n;
  const records=[];
  const events=[];
  let eventCount=0;
  const execution={entries:0,returns:0,failures:0};
  let trace=null, load=null, terminal=null;
  let completionReason='no owning loader entry';
  // These are the starts of complete, call-free native epilogue blocks in
  // the pinned image, not the interior RETs or the post-free CALL block.
  const epilogues=new Map([[0x411a26,'FRESH'],[0x41185b,'CACHE_NO_READ'],[0x411a83,'CACHE_NO_READ']]);
  function read(e,b,a,n) {
    if (!Number.isInteger(n)||n<0||n>4194304||a+n>0x100000000) throw Error('bounded source/range');
    const w=e.guest_to_wasm(a>>>0)>>>0;
    if(w===0xf0||w+n>b.byteLength) throw Error('unmapped memory');
    for(let off=0;off<n;off=Math.min(n,Math.floor((a+off)/4096)*4096+4096-a)) {
      if((e.guest_to_wasm((a+off)>>>0)>>>0)!==w+off) throw Error('noncontiguous/unmapped memory');
    }
    if(n&&(e.guest_to_wasm((a+n-1)>>>0)>>>0)!==w+n-1) throw Error('unmapped range end');
    return Buffer.from(new Uint8Array(b,w,n));
  }
  function finishReturn(e,pc,sp,boundary) {
    if(!terminal || !load) return;
    const arm=terminal; terminal=null;
    if(pc!==load.returnTarget || sp!==load.sp+4) {
      load=null; completionReason='native return target/stack boundary missing';return;
    }
    validate();
    if((e.get_eax()>>>0)!==0x6d7da0) throw Error('native return value mismatch');
    if(records.length===32) throw Error('bounded observation exhausted');
    records.push({kind:'NATIVE_LOAD_RETURN',pc,sp,entrySp:load.sp,
      returnTarget:load.returnTarget,epilogue:arm.pc,path:arm.path,boundary,
      acquisitionRecord:load.acquisitionRecord,exactIdentity:'UNKNOWN'});
    load=null;completionReason='owning native return observed; writers/allocation lifetime remain UNKNOWN';
  }
  const increment=value=>Math.min(Number.MAX_SAFE_INTEGER,value+1);
  function event(kind, detail, force=false) {
    if(load || terminal) {load=null;terminal=null;completionReason=`interrupted: ${kind}: ${detail}`;}
    eventCount=increment(eventCount);
    if(events.length===32) events.shift();
    events.push({sequence:eventCount,kind,detail:String(detail).slice(0,96)});
    // Setup before the first point cannot stale an acquisition. Once a point
    // exists, invalidation is sticky: trace rearming cannot resurrect it.
    if ((records.length || force) && !invalid) invalid=`${kind}: ${detail}`;
  }
  function validate() {
    const e=getExports(), b=getMemory();
    if (!e || !b) throw Error('missing owning instance/memory');
    if (owner && (owner!==e || buffer!==b)) throw Error('owning instance/memory replaced');
    if ((e.get_image_base()>>>0)!==0x400000) throw Error('different module base');
    for(const p of pins) {
      const w=e.guest_to_wasm(p.pc)>>>0;
      if(w===0xf0 || w+p.size>b.byteLength ||
        (e.guest_to_wasm(p.pc+p.size-1)>>>0)!==w+p.size-1 ||
        hash(new Uint8Array(b,w,p.size))!==p.sha256) throw Error('native body replaced/missing');
    }
    return {e,b};
  }
  function block(pc, sp) {
    const started=process.hrtime.bigint();
    try {
      if (invalid) return;
      const e=getExports(), b=getMemory();
      if (!e || !b) throw Error('missing owning instance/memory');
      if (owner && (owner!==e || buffer!==b)) throw Error('owning instance/memory replaced');
      owner=e;buffer=b;
      if ((e.get_image_base()>>>0)!==0x400000) throw Error('different module base');
      if ((e.get_eip()>>>0)!==(pc>>>0) || (e.get_esp()>>>0)!==(sp>>>0)) throw Error('not owning CPU block entry');
      if (++calls>10000000) throw Error('bounded callback count exhausted');
      // A traced epilogue has no call or branch before its RET. The next
      // block must be the entry's actual stack target, at the restored ESP.
      if(terminal) finishReturn(e,pc>>>0,sp>>>0,'owning target block');
      if (load && epilogues.has(pc>>>0)) {
        const path=epilogues.get(pc>>>0);
        if((sp>>>0)!==load.sp-0xb0 ||
          (path==='FRESH' ? load.acquisitionRecord===null : !load.cache || load.acquisitionRecord!==null)) {
          load=null;completionReason='missing acquisition/cache/epilogue stack boundary';
        } else {validate();terminal={pc:pc>>>0,path};}
      }
      if (load && (pc>>>0)===0x411831 && (sp>>>0)===load.sp-0xb0) load.cache=true;
      if (![0x4117b0,0x4118d9,0x411a0e,0x42f0b0,0x42f0da].includes(pc>>>0)) return;
      if (records.length===32) throw Error('bounded observation exhausted');
      const readPoint=(a,n)=>read(e,b,a,n);
      const u32=a=>readPoint(a,4).readUInt32LE();
      for(const p of pins) if(hash(readPoint(p.pc,p.size))!==p.sha256) throw Error('native body replaced/missing');
      const record={pc:pc>>>0,sp:sp>>>0,kind:'LOAD_ENTRY',exactIdentity:'UNKNOWN'};
      if ((pc>>>0)===0x4117b0) {
        const returnTarget=u32(sp>>>0);
        Object.assign(record,{returnTarget});
        if(load) throw Error('nested/repeated loader entry before return');
        terminal=null;
        // Completion requires the production facade's actual trace setup;
        // caller-authored coverage booleans have no authority here.
        if(trace && trace.flag && returnTarget>=trace.lo && (!trace.hi || returnTarget<=trace.hi) &&
          returnTarget && (returnTarget<0x4117b0 || returnTarget>=0x411a92)) {
          load={sp:sp>>>0,returnTarget,cache:false,acquisitionRecord:null};
          completionReason='loader entered; native return pending';
        } else {load=null;completionReason='return target outside known owning trace boundary';}
      } else if ((pc>>>0)===0x4118d9) {
        const length=e.get_esi()>>>0, pointer=u32((sp>>>0)+12);
        const bytes=readPoint(pointer,length);
        if(length<160) throw Error('invalid BSP source length');
        Object.assign(record,{kind:'ACQUIRED_SOURCE',pointer,length,sha256:hash(bytes)});
        if(load && (sp>>>0)===load.sp-0xb0 && load.acquisitionRecord===null) load.acquisitionRecord=records.length;
        else if(load) {load=null;terminal=null;completionReason='acquisition stack/entry mismatch';}
      } else if ((pc>>>0)===0x411a0e) {
        Object.assign(record,{kind:'POST_FREE_BLOCK'});
      } else if ((pc>>>0)===0x42f0da) {
        const pointer=e.get_esi()>>>0;
        Object.assign(record,{kind:'HEADNODE_READ_BLOCK',pointer,candidateHeadnode:u32(pointer+36)});
      } else if ((pc>>>0)===0x42f0b0) {
        const edict=u32((sp>>>0)+4),solid=u32(edict+0xf8),index=u32(edict+0x28);
        if(index>=256) throw Error('table index bound');
        const pointer=solid===3?u32(0x47b554+4*index):0;
        Object.assign(record,{kind:'HEADNODE_USE_ENTRY',edict,solid,index,pointer,
          candidateHeadnode:pointer?u32(pointer+36):null});
      }
      records.push(record);
    } catch(error) { invalid=error.message;load=null;terminal=null;completionReason=error.message; }
    finally { elapsedNs+=process.hrtime.bigint()-started; }
  }
  // A separate plain facade avoids Proxy invariants on frozen WASM exports.
  // Cover every production user of the instance, including loader helpers and
  // readExports (which historically accepts arbitrary function names).
  function wrapExports(exports) {
    const reads=new Set(['get_image_base','get_eip','get_esp','get_esi','guest_to_wasm',
      'get_eax','get_ebx','get_ecx','get_edx','get_edi','get_ebp','get_yield_reason']);
    return Object.freeze(Object.fromEntries(Object.entries(exports).map(([name,value])=>
      [name,typeof value!=='function' || reads.has(name) ? value : (...args)=>{
        if(name==='run') {
          execution.entries=increment(execution.entries);
          try {
            const result=value(...args);execution.returns=increment(execution.returns);
            // A budget return by itself means nothing. Only a traced,
            // call-free native epilogue can arm this post-run boundary check.
            if(terminal && !invalid) {
              try {const {e}=validate();finishReturn(e,e.get_eip()>>>0,e.get_esp()>>>0,'owning run boundary');}
              catch(error) {invalid=error.message;load=null;terminal=null;completionReason=error.message;}
            }
            return result;
          }
          catch(error) {
            execution.failures=increment(execution.failures);
            event('execution','run threw',true);
            throw error;
          }
        }
        event('export',name);
        if(name==='set_trace_esp') trace={flag:args[0]|0,lo:args[1]>>>0,hi:args[2]>>>0};
        return value(...args);
      }])));
  }
  function wrapImports(imports) {
    for(const [name,fn] of Object.entries(imports)) {
      if(typeof fn!=='function' || name==='log_block') continue;
      imports[name]=(...args)=>{event('import',name);return fn(...args);};
    }
  }
  return Object.freeze({block,event,wrapExports,wrapImports,snapshot:()=>{
    // Pulls detect replacement even if tracing was disabled or no further
    // callback occurred. This is a point check, never a concurrent-writer lock.
    if(owner && !invalid) try {validate();} catch(error) {invalid=error.message;load=null;terminal=null;completionReason=error.message;}
    return {exactIdentity:'UNKNOWN',
    reason:invalid||'no reset/reload/instruction coverage barrier; records are point observations only',
    validPointObservations:!invalid && records.length>0,calls,elapsedNs:elapsedNs.toString(),
    coverage:{completedLoad:'UNKNOWN',instructions:'UNKNOWN',allWriters:'UNKNOWN',exclusiveOwner:'UNKNOWN'},
    nativeCompletion:{reason:completionReason,pending:!!load,returns:records.filter(r=>r.kind==='NATIVE_LOAD_RETURN').length},
    execution:{...execution},eventCount,events:events.map(e=>({...e})),
    pins:pins.map(p=>({...p})),exe:{path:EXE,sha256:EXE_SHA},records:records.map(r=>({...r}))};
  }});
}
module.exports={attach,hash,EXE,EXE_SHA};
