'use strict';
// OFFLINE only. Decode the existing first health rejection, never read a guest.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const assert=require('node:assert/strict');
const core=require('../lib/quake2-owning-load-core');
const {readPE}=require('../lib/pe');
const FRAME=0xa9ce98,RING=0xa9cf8c,SIZE=240;
const hash=core.hash;
// Names describe the pinned binary's data flow; they are not debug symbols.
// In particular num_entities is a semantic name inferred from count-controlled
// iteration over 84-byte entity states, not an imported C struct definition.
const BOUNDARIES=[
 [0x409200,0x39,'client reset: zero 0x92d6 dwords at 0xa9c7c0, including current and published frames'],
 [0x403330,0x4d,'ParseFrame: clear 60 dwords, read frame/delta, derive time=frame*100'],
 [0x4033c8,0x83,'ParseFrame: valid set BEFORE playerstate/entities; delta slot and entity-history age checks'],
 [0x4034b8,0x71,'ParseFrame: playerstate call, packet entities call, then 60-dword ring copy'],
 [0x402bd0,0x23,'packet entities: +0xec receives entity-ring cursor; +0xe8 reset to zero'],
 [0x402a50,0x62,'delta entity: advance global cursor, increment frame+0xe8 BEFORE entity delta decode'],
 [0x402caa,0x12,'unchanged old entity: call delta entity with zero bits'],
 [0x402d90,0x11,'changed old entity: call delta entity'],
 [0x402e03,0x23,'baseline entity: call delta entity'],
 [0x402e52,0x0e,'remaining old entity: call delta entity with zero bits'],
 [0x403290,0x24,'playerstate: 32 optional signed-short stats; stats[1] is frame+0xaa'],
 [0x4032c0,0x6b,'entity events: count and entity-ring cursor reads'],
 [0x403610,0x97,'packet rendering: count-controlled entity-ring iteration'],
 [0x403e00,0x31,'view rendering: select previous valid ring frame or current fallback'],
 [0x4041a1,0x26,'render composition passes current frame to packet rendering, then view rendering'],
 [0x40b760,0x41,'prediction collision list: current entity count/cursor reads'],
 [0x40b9c1,0x1a,'prediction trace: current entity count/cursor reads'],
 [0x425981,0x3a,'sound entity list: current entity count/cursor reads'],
 [0x40d4a5,7,'HUD: signed short health read at 0xa9cf42'],
];
function binaryEvidence(exe=path.resolve(__dirname,'..',core.EXE)){
 const bytes=fs.readFileSync(exe);assert.equal(hash(bytes),core.EXE_SHA,'pinned actual QuakeII executable');
 const pe=readPE(exe);
 const windows=BOUNDARIES.map(([va,size,role])=>{
  const at=pe.va2off(va);assert(at>=0&&at+size<=bytes.length);
  return {va,size,role,sha256:hash(bytes.subarray(at,at+size))};
 });
 return {path:exe,size:bytes.length,sha256:hash(bytes),windows,
  symbolProvenance:'semantic names inferred from pinned executable instructions; matching original C source unavailable locally',
  writerCoverage:'identified parser/reset/publication paths; arbitrary aliases, all runtime writers and edict ABA UNKNOWN'};
}
function byteArray(value,size,label){
 assert(Array.isArray(value)&&value.length===size&&value.every(n=>Number.isInteger(n)&&n>=0&&n<=255),label);
 return Buffer.from(value);
}
function decodeFrame(value){
 const b=byteArray(value,SIZE,'complete 240-byte frame required');
 return {valid:b.readUInt32LE(0),frameNumber:b.readInt32LE(4),serverTimeMs:b.readUInt32LE(8),
  deltaFrame:b.readInt32LE(12),signedHP:b.readInt16LE(0xaa),
  numEntities:b.readInt32LE(0xe8),parseEntities:b.readInt32LE(0xec),sha256:hash(b)};
}
function fieldAt(offset){
 if(offset<16)return ['valid','serverframe','servertime','deltaframe'][offset>>>2];
 if(offset<0x30)return 'areabits';
 if(offset<0xe8)return offset===0xaa||offset===0xab?'playerstate.stats[1] (signed health)':'playerstate';
 return offset<0xec?'num_entities':'parse_entities';
}
function differences(first,second){
 assert.equal(first.length,second.length,'same byte range required');
 const out=[];
 for(let i=0;i<first.length;i++)if(first[i]!==second[i])out.push({offset:i,first:first[i],second:second[i],field:fieldAt(i%SIZE)});
 return out;
}
function decodeRejection(row){
 const a=row.attackInput;assert(a&&a.rejectedFrame,'retained rejectedFrame required; no reconstruction/read retry');
 const r=a.rejectedFrame,p=r.predicates;assert(p&&typeof p==='object');
 const motion={};
 for(const key of ['motionFirst','motionSecond']){
  const s=r[key];assert(s,'both already-read motion snapshots required');
  motion[key]={state:s.state,slot:s.slot,current:decodeFrame(s.current),published:decodeFrame(s.published)};
 }
 const first=r.motionFirst,second=r.motionSecond;
 const damageFirst=byteArray(r.damageFirst,16*SIZE,'complete first damage ring required');
 const damageSecond=byteArray(r.damageSecond,16*SIZE,'complete second damage ring required');
 const currentDifferences=differences(first.current,second.current);
 const publishedDifferences=differences(first.published,second.published);
 const damageDifferences=differences(damageFirst,damageSecond);
 const inferred= currentDifferences.length>0&&currentDifferences.every(d=>d.offset>=0xe8&&d.offset<0xec)&&
  motion.motionFirst.current.frameNumber===motion.motionSecond.current.frameNumber&&
  motion.motionSecond.current.numEntities>motion.motionFirst.current.numEntities&&
  motion.motionFirst.published.frameNumber===motion.motionSecond.published.frameNumber&&
  motion.motionSecond.published.frameNumber===motion.motionSecond.current.frameNumber-16&&
  publishedDifferences.length===0&&damageDifferences.length===0;
 return {at:row.at,phase:row.phase,readerStatus:a.status,playerMotionStatus:a.playerMotion?.status,
  damageFeedbackStatus:a.damageFeedback?.status,executedPredicates:p,
  executedMotionEqual:p.motionEqual??'NOT_EXECUTED',
  executedPublicationCheck:p.motionPublishedMatches??'NOT_EXECUTED',
  addresses:{current:FRAME,numEntities:FRAME+0xe8,parseEntities:FRAME+0xec,ring:RING},motion,
  currentDifferences,publishedDifferences,damageDifferences,
  currentVsPublished:{first:differences(first.current,first.published),second:differences(second.current,second.published)},
  damageHashes:{first:hash(damageFirst),second:hash(damageSecond)},
  interpretation:inferred?'consistent with packet-entity parsing before ring publication (static-order inference only)':'no specific parser phase inferred',
  nativeCause:'UNKNOWN; no writer EIP or reader/writer execution overlap was retained',
  repair:'NONE; do not omit changing bytes, accept an older ring slot, retry, or waive first health loss/death/UNKNOWN',
  nextMissingBoundary:{writer:{increment:0x402a9f,entityDecodeCall:0x402aad,packetReturn:0x402ea7,
   publishCopy:0x403527,afterPublish:0x403529,reset:0x409221,frameClear:0x403342},
   reader:'same existing motionFirst/current,published -> damageFirst -> attack/bindings/physical -> motionSecond/current,published -> damageSecond',
   required:'owning CPU instruction/order witness with frame number, destination and parse generation at entity-count increment and publication, correlated with the existing reader copy boundaries; no additional samples or post-terminal reads',
   absent:'retained snapshots contain no CPU EIP, generation or instruction/copy correlation; static code and authored controls cannot identify the executed native writer'}};
}
function firstTerminal(rows){
 let armed=false,last=null;
 for(let index=0;index<rows.length;index++){
  const row=rows[index],a=row.attackInput,d=a?.damageFeedback;
  if(!armed&&d?.status==='SNAPSHOT'&&d.current.health>0)armed=true;
  if(!armed)continue;
  let reason;
  if(a.status!=='SNAPSHOT'||a.playerMotion?.status!=='SNAPSHOT'||d?.status!=='SNAPSHOT')reason='passive health/motion UNKNOWN';
  else if(d.current.health<=0||(last!==null&&d.current.health<last)||d.observedHealthDecreases?.length)reason='first passive HP loss/death';
  if(d?.status==='SNAPSHOT')last=d.current.health;
  if(reason)return {index,reason,row};
 }
 throw Error('no armed terminal row retained');
}
function fromReceipt(receiptPath){
 const packed=fs.readFileSync(receiptPath),receipt=JSON.parse(receiptPath.endsWith('.gz')?zlib.gunzipSync(packed):packed);
 assert.equal(receipt.passed,true,'retrieval receipt must pass');
 const name='original/passive-health-history.jsonl.gz';
 const matches=receipt.files.filter(f=>f.remote===name);assert.equal(matches.length,1,'one retained original health history');
 const entry=matches[0],base=path.dirname(path.resolve(receiptPath)),file=path.resolve(base,entry.stored);
 assert(file.startsWith(base+path.sep),'artifact must remain inside receipt directory');
 const stored=fs.readFileSync(file);assert.equal(stored.length,entry.size,'stored size');assert.equal(hash(stored),entry.sha256,'stored SHA256');
 const raw=zlib.gunzipSync(stored); // also verifies gzip CRC/trailer
 assert(entry.original,'uncompressed identity required');
 assert.equal(raw.length,entry.original.size,'original size');assert.equal(hash(raw),entry.original.sha256,'original SHA256');
 const rows=raw.toString('utf8').trim().split('\n').map(l=>JSON.parse(l)),terminal=firstTerminal(rows);
 return {receipt:{path:path.resolve(receiptPath),sha256:hash(packed)},history:{path:file,size:stored.length,sha256:hash(stored),original:entry.original},
  rows:rows.length,terminalIndex:terminal.index,terminalReason:terminal.reason,firstReject:decodeRejection(terminal.row),binary:binaryEvidence()};
}
if(require.main===module){
 const [receipt,output]=process.argv.slice(2);assert(receipt&&output,'usage: node tools/quake2-frame-field.cjs RETRIEVAL_RECEIPT OUTPUT_JSON (fresh path)');
 const report=fromReceipt(receipt);fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({output,terminalIndex:report.terminalIndex,currentDifferences:report.firstReject.currentDifferences,nativeCause:report.firstReject.nativeCause}));
}
module.exports={decodeFrame,decodeRejection,firstTerminal,fromReceipt,binaryEvidence,BOUNDARIES};
