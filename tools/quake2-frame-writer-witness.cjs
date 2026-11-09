'use strict';
// Opt-in OFFLINE adapter. Caller brackets EXISTING synchronous copies; this
// helper never copies/decodes guest memory and never changes reader results.
// Call boundary(COPIES[i], 'before'/'after') immediately around each of
// the six existing copies, on the same synchronous owner controller. These
// caller signals are not authenticated by this API. Cross-worker message
// delivery timestamps cannot order the shared-memory copies. Generation is
// the native observer arm generation, never a packet/frame identity.
// No production reader/consumer hook is installed by importing this module.
const fs=require('node:fs');
const {readPE}=require('../lib/pe');
const {EXE,EXE_SHA,hash}=require('./quake2-owning-load-witness.cjs');
const FRAME=0xa9ce98,RING=0xa9cf8c,SIZE=240;
const COPIES=Object.freeze(['motionFirst.current','motionFirst.published','damageFirst',
 'motionSecond.current','motionSecond.published','damageSecond']);
const fields=['on','pc','generation','invalid','limit',
 ...['a','b'].flatMap(r=>['lo','hi','epoch','overflow','pc','address','width','host'].map(k=>r+'_'+k))];
const limits={allWriters:'UNKNOWN',aliases:'UNKNOWN',peerCPU:'UNKNOWN',rawHostWrites:'UNKNOWN',
 hostImports:'UNKNOWN',bulkAndLockedStores:'UNKNOWN',partialFaults:'UNKNOWN',frameABA:'UNKNOWN',
 parseGeneration:'UNKNOWN',boundaryProvenance:'CALLER_SUPPLIED',crossWorkerOrdering:'UNKNOWN',entityDecodeAndPacketReturn:'NOT_OBSERVED',
 codeReplacement:'UNKNOWN',nativeCause1265:'UNKNOWN',nativeQualification:false};
function binary(){
 const file=fs.readFileSync(EXE);if(hash(file)!==EXE_SHA)throw Error('QuakeII EXE SHA');
 const pe=readPE(EXE);
 const instruction=(pc,size)=>{const at=pe.va2off(pc);if(at<0||at+size>file.length)throw Error('raw instruction range');return file.subarray(at,at+size);};
 const pins=[[0x402a9e,'4689b0e8000000'],[0x402a9f,'89b0e8000000'],[0x402bed,'8998e8000000'],[0x403527,'f3a5'],[0x403342,'f3ab'],[0x409221,'f3ab']];
 for(const [pc,hex] of pins)if(instruction(pc,hex.length/2).toString('hex')!==hex)throw Error('QuakeII instruction bytes');
 return {instruction,receipt:{path:EXE,size:file.length,sha256:EXE_SHA,pins:pins.map(([pc,bytes])=>({pc,bytes}))}};
}
function attach({enabled=false,getExports,getMemory,maxBoundaries=64,limit=0}={}){
 if(!enabled)return Object.freeze({boundary(){},close(){},snapshot:()=>({status:'OFF',nativeQualification:false})});
 if(!Number.isInteger(maxBoundaries)||maxBoundaries<12||maxBoundaries>1024)throw Error('bounded witness capacity');
 const exe=binary().receipt,owner=getExports(),buffer=getMemory();
 let invalid=null,generation,previous=null,step=0;
 const points=[],intervals=[];
 if(owner.native_store_get(0))throw Error('native store observer already owned');
 owner.native_store_arm(FRAME,FRAME+SIZE,RING,RING+16*SIZE,limit);
 generation=owner.native_store_get(2)>>>0;
 function boundary(copy,edge){
  // Debug/evidence failures are data, never exceptions into the reader.
  try{
   if(points.length>=maxBoundaries){invalid ||= 'boundary capacity exhausted';return;}
   if(getExports()!==owner||getMemory()!==buffer)invalid ||= 'owner/memory replaced';
   if(copy!==COPIES[Math.floor(step/2)%6]||edge!==(step%2?'after':'before'))invalid ||= 'missing/out-of-order copy boundary';
   step++;
   const raw=Object.fromEntries(fields.map((k,i)=>[k,owner.native_store_get(i)>>>0]));
   if(raw.generation!==generation||raw.invalid||raw.a_overflow||raw.b_overflow||!raw.on||raw.pc||raw.a_lo!==FRAME||raw.a_hi!==FRAME+SIZE||raw.b_lo!==RING||raw.b_hi!==RING+16*SIZE)
    invalid ||= 'reset/rearm/disarm/overflow/range change or execution unsettled';
   const point={sequence:points.length,copy,edge,raw};
   if(previous){
    const ranges={};
    for(const r of ['a','b']){
     const delta=raw[r+'_epoch']-previous.raw[r+'_epoch'];
     const interrupted=!!invalid||!!raw[r+'_overflow']||!!previous.raw[r+'_overflow']||delta<0;
     const last=delta>0?Object.fromEntries(['pc','address','width','host'].map(k=>[k,raw[r+'_'+k]])):null;
     ranges[r==='a'?'current':'publishedRing']={status:interrupted?'INVALID':delta?'COMPLETED_STORES':'NO_RETAINED_STORE',
      delta:interrupted?null:delta,last,history:delta>1?'last completion only; intermediate PCs unavailable':delta===1?'one retained completion':'no writer evidence',
      nativePC:!!last&&!raw[r+'_host']&&last.pc!==0};
    }
    intervals.push({from:previous.sequence,to:point.sequence,ranges});
   }
   points.push(point);previous=point;
  }catch(e){invalid ||= String(e.message);}
 }
 function close(){
  invalid ||= 'observer closed';
  // Never disarm a later owner of the instance's singleton observer.
  if(getExports()===owner&&getMemory()===buffer&&(owner.native_store_get(2)>>>0)===generation)
   owner.native_store_arm(0,0,0,0,0);
 }
 return Object.freeze({boundary,close,snapshot:()=>structuredClone({status:invalid?'INVALID':'BOUNDED',reason:invalid,
  generation,exe,completeReaderBoundarySets:Math.floor(step/12),pendingBoundarySteps:step%12,
  statusScope:'historical retained boundaries only; no current continuity asserted by snapshot',coverage:'owning instance completed gs helpers; receipts at caller-supplied synchronous existing copy boundaries',
  ordering:'host call sequence only; no atomic reader/writer barrier; last PC is not complete instruction history',
  limits,points,intervals})});
}
module.exports={attach,binary,FRAME,RING,SIZE,COPIES};
