'use strict';
// Shared synchronous owning-CPU observer. No Buffer, fs, or async callbacks.
(() => {
const node=typeof module!=='undefined' && !!module.exports;
const EXE = 'test/binaries/candidates/quake-2-demo-installer/installed-extracted/Install/Data/quake2.exe';
const EXE_SHA = '2fa987c9390663e230c5b6479285e7c55511e35f80091bfed96f43062c1c810b';
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


const hash = sha256;

class Bytes extends Uint8Array {
  static from(bytes) { return new Bytes(bytes); }
  static alloc(size) { return new Bytes(size); }
  view() { return new DataView(this.buffer,this.byteOffset,this.byteLength); }
  readUInt32LE(at=0) { return this.view().getUint32(at,true); }
  readInt32LE(at=0) { return this.view().getInt32(at,true); }
  readFloatLE(at=0) { return this.view().getFloat32(at,true); }
  writeInt32LE(value,at) { this.view().setInt32(at,value,true); }
  writeFloatLE(value,at) { this.view().setFloat32(at,value,true); }
  equals(other) { return this.length===other.length && this.every((v,i)=>v===other[i]); }
}
// Authenticated PE input only. BSS is never original executable source.
function originalWindow(file,pc,size) {
  const v=new DataView(file.buffer,file.byteOffset,file.byteLength);
  const pe=v.getUint32(0x3c,true),base=v.getUint32(pe+52,true);
  if(v.getUint16(0,true)!==0x5a4d || v.getUint32(pe,true)!==0x4550 || base!==0x400000)
    throw Error('Quake II PE identity');
  const count=v.getUint16(pe+6,true),table=pe+24+v.getUint16(pe+20,true);
  for(let i=0;i<count;i++) {
    const s=table+i*40,va=base+v.getUint32(s+12,true),raw=v.getUint32(s+16,true);
    const offset=v.getUint32(s+20,true)+pc-va;
    if(pc>=va && pc+size<=va+raw && offset+size<=file.length)return file.subarray(offset,offset+size);
  }
  throw Error('Quake II original raw window missing');
}

const WINDOWS = [[0x4117b0,0x2e2],[0x410e50,0x11a],[0x411aa0,0x51],
  [0x42b0b9,0x6f],[0x42f0b0,0x45],[0x41a2a0,0x53],[0x411b10,6]];
// Original FS_FreeFile, Z_Free, Z_TagMalloc and CRT free/malloc wrappers.
// Checked only at their actual owning entry; old fixture substitutes have no
// authority to establish native release or allocation.
const LIFETIME_WINDOWS = [[0x416ef0,14],[0x414890,0x55],[0x414950,0x8b],
  [0x432c10,0x68],[0x432c80,0x65]];
function attach({getExports, getMemory, nativeWrites=false, canonicalBytes}) {
  const file=Bytes.from(canonicalBytes || []);
  if (hash(file) !== EXE_SHA) throw Error('Quake II installed EXE PATHHASH');
  const instanceIdentity=nativeWrites?globalThis.crypto.randomUUID():null;
  let nativeOwner=null, nativeBuffer=null, nativeArmed=false, nativeInvalid=null;
  const nativeFields=['on','pc','generation','invalid','limit',
    ...['a','b'].flatMap(r=>['lo','hi','epoch','overflow','pc','address','width','host'].map(k=>r+'_'+k))];
  function storeReceipt() {
    if(!nativeWrites)return null;
    const e=getExports(),b=getMemory();
    if(!nativeArmed)return {status:'NOT_ARMED',instanceIdentity,allWriters:'UNKNOWN'};
    if(e!==nativeOwner || b!==nativeBuffer)nativeInvalid='owning instance/memory replaced';
    const raw=Object.fromEntries(nativeFields.map((k,i)=>[k,nativeOwner.native_store_get(i)>>>0]));
    if(raw.invalid || !raw.on || raw.pc)nativeInvalid ||= 'native store observation invalidated/disarmed or execution unsettled';
    const range=r=>Object.fromEntries(['lo','hi','epoch','overflow','pc','address','width','host'].map(k=>[k,raw[r+'_'+k]]));
    return {status:nativeInvalid?'INVALID':'OBSERVING',reason:nativeInvalid,instanceIdentity,
      generation:raw.generation,models:range('a'),table:range('b'),
      coverage:'completed gs8/16/32/64/128 helpers on this instance; instruction PC during run, PC=0 outside run; split stores may emit fragments',
      history:'epoch and last completion per range; intermediate PCs not retained',
      allWriters:'UNKNOWN',rawSharedMemory:'UNKNOWN',hostImports:'UNKNOWN',otherWorkers:'UNKNOWN',
      bulkNativeStores:'UNKNOWN',lockedNativeStores:'UNKNOWN',partialFaultStores:'UNKNOWN',edictABA:'UNKNOWN'};
  }
  function armStores() {
    if(!nativeWrites || nativeArmed)return;
    nativeOwner=getExports();nativeBuffer=getMemory();
    nativeOwner.native_store_arm(0x6d7da0,0x6d7da0+1024*40,0x47b554,0x47b554+256*4,0);
    nativeArmed=true;
  }
  const pin=([pc,size])=>({pc,size,sha256:hash(originalWindow(file,pc,size))});
  const pins=WINDOWS.map(pin),lifetimePins=LIFETIME_WINDOWS.map(pin);
  const sources=[],lifetimeEvents=[];
  let lifetimeEventCount=0;
  function revokeSources(reason,pc=null,pointer=null) {
    const affected=[];
    for(const source of sources) if(source.state==='ACQUIRED_POINT' &&
      (pointer===null || pointer===source.pointer || pointer===source.pointer-16)) {
      source.state='REVOKED';source.reason=reason;source.revokedAt=pc;
      affected.push(source.acquisitionRecord);
    }
    if(affected.length) {
      lifetimeEventCount=Math.min(Number.MAX_SAFE_INTEGER,lifetimeEventCount+1);
      if(lifetimeEvents.length===32)lifetimeEvents.shift();
      lifetimeEvents.push({sequence:lifetimeEventCount,reason,pc,pointer,affected});
    }
  }
  let owner, buffer, invalid, calls=0, elapsedNs=0n;
  const records=[];
  const events=[];
  let eventCount=0;
  const execution={entries:0,returns:0,failures:0};
  let trace=null, load=null, terminal=null;
  let completionReason='no owning loader entry';
  // Generations count observed boundaries, not allocation identities. In
  // particular, a missed reload with identical output cannot be disproved by
  // these point samples and must never receive a continuity certificate.
  let generation=0, conversion=null, converted=null, startup=null, use=null;
  const laterUses=[];
  const continuityFaults=[];
  function fault(reason) {
    if(!continuityFaults.includes(reason) && continuityFaults.length<32) continuityFaults.push(reason);
  }
  function continuity(e,b,pc,sp) {
    const u32=a=>read(e,b,a,4).readUInt32LE();
    if(pc===0x410e50) {
      const source=sources.at(-1),descriptor=u32(sp+4);
      if(!source || source.state!=='ACQUIRED_POINT' || !load ||
        u32(sp)!==0x4119b7 || sp!==load.sp-0xb8) {fault('conversion entry/acquisition boundary missing');return;}
      const offset=u32(descriptor),size=u32(descriptor+4);
      if(!size || size%48 || size/48>1024 || offset+size>source.length ||
        u32(0x8e3ea8)!==source.pointer) {fault('conversion source descriptor mismatch');return;}
      if(hash(read(e,b,source.pointer,source.length))!==records[source.acquisitionRecord].sha256) {
        revokeSources('source bytes changed before conversion',pc,source.pointer);
        fault('acquired source replaced before conversion');return;
      }
      conversion={generation,sp,acquisitionRecord:source.acquisitionRecord,
        source:read(e,b,source.pointer+offset,size),count:size/48};
    }
    if(pc===0x4119b7) {
      if(!conversion || conversion.generation!==generation || sp!==conversion.sp+4) {
        fault('conversion return boundary missing');return;
      }
      const c=conversion;conversion=null;
      const expected=Bytes.alloc(c.count*40);
      for(let i=0;i<c.count;i++) {
        for(let j=0;j<9;j++)expected.writeFloatLE(Math.fround(c.source.readFloatLE(i*48+j*4)+(j<3?-1:j<6?1:0)),i*40+j*4);
        expected.writeInt32LE(c.source.readInt32LE(i*48+36),i*40+36);
      }
      if(u32(0xa23f8c)!==c.count || !read(e,b,0x6d7da0,expected.length).equals(expected)) {
        fault('native converted model bytes mismatch');return;
      }
      converted={generation,acquisitionRecord:c.acquisitionRecord,count:c.count,
        sha256:hash(expected),sourceSHA256:records[c.acquisitionRecord].sha256,
        sourceLumpSHA256:hash(c.source),entryPC:0x410e50,entrySP:c.sp,returnPC:pc,returnSP:sp};
      if(nativeWrites)converted.nativeStores=storeReceipt();
    }
    if(pc===0x42b0e4) startup={generation,sp,entryPC:pc,stores:0,complete:false,lastStore:null};
    if(pc===0x42b124) {
      if(!startup || startup.generation!==generation || startup.sp!==sp || !converted ||
        converted.generation!==generation) {fault('startup/conversion generation boundary missing');return;}
      const ordinal=e.get_esi()>>>0,slot=(e.get_ebx()>>>0)-4;
      if(ordinal!==startup.stores+2 || slot!==0x47b55c+startup.stores*4 ||
        u32(slot)!==0x6d7da0+(ordinal-1)*40) {fault('native collision-table store mismatch');return;}
      startup.stores++;
      startup.lastStore={pc,sp,slot,pointer:u32(slot),ordinal:ordinal-1};
    }
    if(pc===0x42b128) {
      if(!startup || !converted || startup.generation!==generation || startup.sp!==sp ||
        startup.stores!==converted.count-1) fault('startup completion boundary missing');
      else {startup.complete=true;startup.completionPC=pc;startup.completionSP=sp;
        if(nativeWrites)startup.nativeStores=storeReceipt();}
    }
    if(pc===0x42f0b0) {
      const edict=u32(sp+4),index=u32(edict+0x28);
      use={generation,sp,edict,index,solid:u32(edict+0xf8),
        pointer:index<256?u32(0x47b554+index*4):0};
    }
    if(pc!==0x42f0da) return;
    const reasons=[...continuityFaults];
    if(invalid) reasons.push(`observation interrupted: ${invalid}`);
    if(!converted || converted.generation!==generation) reasons.push('conversion generation missing/replaced');
    if(!startup?.complete || startup.generation!==generation) reasons.push('startup generation/completion missing');
    if(!use || use.generation!==generation || use.sp!==sp+4 || use.solid!==3 ||
      use.pointer!==(e.get_esi()>>>0) || u32(use.edict+0x28)!==use.index ||
      u32(0x47b554+use.index*4)!==use.pointer) reasons.push('owning headnode entry/table boundary mismatch');
    if(use && converted && (use.index<1 || use.index>converted.count ||
      use.pointer!==0x6d7da0+(use.index-1)*40)) reasons.push('collision-table owner replaced');
    if(converted && (u32(0xa23f8c)!==converted.count ||
      hash(read(e,b,0x6d7da0,converted.count*40))!==converted.sha256)) reasons.push('converted model storage replaced');
    const source=converted && sources.find(s=>s.acquisitionRecord===converted.acquisitionRecord);
    const nativeStores=storeReceipt();
    if(nativeStores && converted?.nativeStores && startup?.nativeStores) {
      const baselines=[['models',converted.nativeStores],['table',startup.nativeStores]];
      for(const [range,baseline] of baselines) {
        if(nativeStores.status!=='OBSERVING' || nativeStores.generation!==baseline.generation ||
          nativeStores[range]?.overflow || baseline[range]?.overflow)
          reasons.push(`${range} native store observation interrupted/overflow`);
        else if(nativeStores[range].epoch!==baseline[range].epoch)
          reasons.push(`${range} native stores since ${range==='models'?'conversion':'startup'}`);
      }
    }
    if(!source || source.state==='REVOKED') reasons.push('source lifetime REVOKED or unobserved');
    // This is the control's essential conservative rejection. Even an intact
    // chain cannot establish absent writers, missed reloads, or edict ABA.
    reasons.push('uncovered writers/missed native boundaries/edict ABA UNKNOWN');
    if(laterUses.length===32)laterUses.shift();
    laterUses.push({pc,sp,generation,entry:use?{...use}:null,
      pointer:e.get_esi()>>>0,candidateHeadnode:u32((e.get_esi()>>>0)+36),
      status:'REJECTED',certified:false,reasons,...(nativeWrites?{nativeStores}: {})});
    use=null;
  }
  // These are the starts of complete, call-free native epilogue blocks in
  // the pinned image, not the interior RETs or the post-free CALL block.
  const epilogues=new Map([[0x411a26,'FRESH'],[0x41185b,'CACHE_NO_READ'],[0x411a83,'CACHE_NO_READ']]);
  const nativePoints=new Set([0x4117b0,0x4118d9,0x411a0e,0x411831,
    0x410e50,0x4119b7,0x42b0e4,0x42b124,0x42b128,0x42f0b0,0x42f0da,
    ...epilogues.keys(),...LIFETIME_WINDOWS.map(([entry])=>entry)]);
  function read(e,b,a,n) {
    if (!Number.isInteger(n)||n<0||n>4194304||a+n>0x100000000) throw Error('bounded source/range');
    const w=e.guest_to_wasm(a>>>0)>>>0;
    if(w===0xf0||w+n>b.byteLength) throw Error('unmapped memory');
    for(let off=0;off<n;off=Math.min(n,Math.floor((a+off)/4096)*4096+4096-a)) {
      if((e.guest_to_wasm((a+off)>>>0)>>>0)!==w+off) throw Error('noncontiguous/unmapped memory');
    }
    if(n&&(e.guest_to_wasm((a+n-1)>>>0)>>>0)!==w+n-1) throw Error('unmapped range end');
    return Bytes.from(new Uint8Array(b,w,n));
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
    if(nativeArmed && kind!=='import') {
      nativeInvalid ||= `${kind}: ${String(detail).slice(0,96)}`;
      nativeOwner.native_store_invalidate();
    }
    if(kind!=='import')generation=increment(generation);
    if(converted || conversion || startup || use) fault(`${kind}: ${String(detail).slice(0,96)}`);
    revokeSources(`${kind}: ${String(detail).slice(0,96)}`);
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
    // Instruction mode supplies the store PC in WASM. Keep JS acquisition and
    // lifetime work at actual relevant boundaries, rather than charging every
    // instruction in the BSP checksum/copy loops to the point-record budget.
    if(nativeWrites && !nativePoints.has(pc>>>0) &&
      !(terminal && (pc<terminal.pc || pc>=terminal.end)))return;
    const started=BigInt(Math.round(performance.now()*1000000));
    try {
      // Sticky invalidation forbids completion/certification, but retain
      // independently checked later point evidence explaining the rejection.
      if (invalid) {
        if(![0x4117b0,0x410e50,0x4119b7,0x42b0e4,0x42b124,0x42b128,0x42f0b0,0x42f0da].includes(pc>>>0))return;
        const {e,b}=validate();
        if((e.get_eip()>>>0)!==(pc>>>0) || (e.get_esp()>>>0)!==(sp>>>0)) throw Error('not owning CPU block entry');
        if((pc>>>0)===0x4117b0)generation=increment(generation);
        if([0x410e50,0x4119b7,0x42b0e4,0x42b124,0x42b128,0x42f0b0,0x42f0da].includes(pc>>>0))
          continuity(e,b,pc>>>0,sp>>>0);
        return;
      }
      const e=getExports(), b=getMemory();
      if (!e || !b) throw Error('missing owning instance/memory');
      if (owner && (owner!==e || buffer!==b)) throw Error('owning instance/memory replaced');
      owner=e;buffer=b;
      if ((e.get_image_base()>>>0)!==0x400000) throw Error('different module base');
      if ((e.get_eip()>>>0)!==(pc>>>0) || (e.get_esp()>>>0)!==(sp>>>0)) throw Error('not owning CPU block entry');
      if (++calls>10000000) throw Error('bounded callback count exhausted');
      if((pc>>>0)===0x4117b0) generation=increment(generation);
      if([0x410e50,0x4119b7,0x42b0e4,0x42b124,0x42b128,0x42f0b0,0x42f0da].includes(pc>>>0)) {
        validate();continuity(e,b,pc>>>0,sp>>>0);
      }
      const lifetimePin=lifetimePins.find(p=>p.pc===(pc>>>0));
      if(lifetimePin && sources.some(s=>s.state==='ACQUIRED_POINT')) {
        const original=hash(read(e,b,lifetimePin.pc,lifetimePin.size))===lifetimePin.sha256;
        // Allocation entry revokes conservatively before any allocator store.
        // Free entry is attempted release, not a certificate of successful free.
        const allocation=pc===0x414950 || pc===0x432c80;
        const pointer=original&&!allocation?read(e,b,(sp>>>0)+4,4).readUInt32LE():null;
        revokeSources(!original?'unverified native lifetime boundary':
          allocation?'native allocation entered':'native release entered',pc>>>0,pointer);
      }
      // A traced epilogue has no call or branch before its RET. The next
      // block must be the entry's actual stack target, at the restored ESP.
      if(terminal && !(nativeWrites && pc>=terminal.pc && pc<terminal.end))
        finishReturn(e,pc>>>0,sp>>>0,'owning target block');
      if (load && epilogues.has(pc>>>0)) {
        const path=epilogues.get(pc>>>0);
        if((sp>>>0)!==load.sp-0xb0 ||
          (path==='FRESH' ? load.acquisitionRecord===null : !load.cache || load.acquisitionRecord!==null)) {
          load=null;completionReason='missing acquisition/cache/epilogue stack boundary';
        } else {validate();terminal={pc:pc>>>0,path,
          end:pc===0x411a26?0x411a5c:pc===0x41185b?0x41186b:0x411a93};}
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
        sources.push({acquisitionRecord:records.length,pointer,length,state:'ACQUIRED_POINT',
          reason:'historical acquisition only; allocation/writer coverage UNKNOWN',revokedAt:null});
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
    } catch(error) { revokeSources(error.message);invalid=error.message;load=null;terminal=null;completionReason=error.message; }
    finally { elapsedNs+=BigInt(Math.round(performance.now()*1000000))-started; }
  }
  // A separate plain facade avoids Proxy invariants on frozen WASM exports.
  // Cover every production user of the instance, including loader helpers and
  // readExports (which historically accepts arbitrary function names).
  function wrapExports(exports) {
    const reads=new Set(['get_image_base','get_eip','get_esp','get_esi','guest_to_wasm',
      'get_eax','get_ebx','get_ecx','get_edx','get_edi','get_ebp','get_yield_reason',
      'native_store_get','native_store_invalidate','get_flag_op','get_flag_a','get_flag_b','get_flag_res']);
    return Object.freeze(Object.fromEntries(Object.entries(exports).map(([name,value])=>
      [name,typeof value!=='function' || reads.has(name) ? value : (...args)=>{
        if(name==='run') {
          armStores();
          execution.entries=increment(execution.entries);
          try {
            const result=value(...args);execution.returns=increment(execution.returns);
            // A budget return by itself means nothing. Only a traced,
            // call-free native epilogue can arm this post-run boundary check.
            if(terminal && !invalid && (!nativeWrites ||
                (exports.get_eip()>>>0)<terminal.pc || (exports.get_eip()>>>0)>=terminal.end)) {
              try {const {e}=validate();finishReturn(e,e.get_eip()>>>0,e.get_esp()>>>0,'owning run boundary');}
              catch(error) {revokeSources(error.message);invalid=error.message;load=null;terminal=null;completionReason=error.message;}
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
    if(owner && !invalid) try {validate();} catch(error) {revokeSources(error.message);invalid=error.message;load=null;terminal=null;completionReason=error.message;}
    return {exactIdentity:'UNKNOWN',...(nativeWrites?{nativeStores:storeReceipt()}:{}),
    reason:invalid||'no reset/reload/instruction coverage barrier; records are point observations only',
    validPointObservations:!invalid && records.length>0,calls,elapsedNs:elapsedNs.toString(),
    coverage:{completedLoad:'UNKNOWN',instructions:'UNKNOWN',allWriters:'UNKNOWN',exclusiveOwner:'UNKNOWN'},
    nativeCompletion:{reason:completionReason,pending:!!load,returns:records.filter(r=>r.kind==='NATIVE_LOAD_RETURN').length},
    ownerContinuity:{status:converted||sources.length?'REJECTED':'UNKNOWN',certified:false,generation,
      reason:invalid||'point chain cannot exclude missed boundaries, other writers or edict ABA',
      conversion:converted?{...converted,...(converted.nativeStores?{nativeStores:structuredClone(converted.nativeStores)}:{})}:null,
      startup:startup?{...startup,lastStore:startup.lastStore?{...startup.lastStore}:null,
        ...(startup.nativeStores?{nativeStores:structuredClone(startup.nativeStores)}:{})}:null,
      faults:[...continuityFaults],laterUses:laterUses.map(u=>({...u,entry:u.entry?{...u.entry}:null,reasons:[...u.reasons],
        ...(u.nativeStores?{nativeStores:structuredClone(u.nativeStores)}:{})})),
      allWriters:'UNKNOWN',edictABA:'UNKNOWN'},
    sourceLifetime:{currentIdentity:'UNKNOWN',laterBytesCertified:false,
      sources:sources.map(s=>({...s})),eventCount:lifetimeEventCount,
      events:lifetimeEvents.map(e=>({...e,affected:[...e.affected]})),
      pins:lifetimePins.map(p=>({...p}))},
    execution:{...execution},eventCount,events:events.map(e=>({...e})),
    pins:pins.map(p=>({...p})),exe:{path:EXE,sha256:EXE_SHA},records:records.map(r=>({...r}))};
  }});
}

const api={attach,hash,EXE,EXE_SHA};
if(node)module.exports=api;else globalThis.Quake2OwningLoadCore=api;
})();
