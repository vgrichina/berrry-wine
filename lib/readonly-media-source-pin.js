'use strict';
// Small worker entry: full byte validation can overlap native CPU setup
// without loading the VFS, media parsers or native host a second time.
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
function statIdentity(s) {
  if (!s.isFile()) throw new Error('readonly media source is not a regular file');
  return [s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].map(String);
}
function sourceIdentity(file) {return statIdentity(fs.statSync(file,{bigint:true}));}
function assertSourceOwner(source,identity) {
  if (!source || !Number.isInteger(source.fd) || source.fd<0 || JSON.stringify(statIdentity(fs.fstatSync(source.fd,{bigint:true})))!==JSON.stringify(identity))
    throw new Error('readonly media source ownership revoked or replaced');
}
function sourcePin(file,owner) {
  const before=sourceIdentity(file),h=crypto.createHash('sha256');
  if(owner)assertSourceOwner(owner,before);
  const fd=fs.openSync(file,'r'),bytes=Buffer.alloc(1024*1024);
  try {for (;;) {const n=fs.readSync(fd,bytes,0,bytes.length,null);if(!n)break;h.update(bytes.subarray(0,n));}}
  finally {fs.closeSync(fd);}
  if(JSON.stringify(before)!==JSON.stringify(sourceIdentity(file)))throw new Error('readonly media source changed while pinning');
  return {path:path.resolve(file),identity:before,sha256:h.digest('hex')};
}
// Opaque, one-use preparation bound to the exact transfer. No caller-supplied
// digest or completed result can substitute for a worker's fresh full read.
const preparations=new WeakMap();
function prepareRestore(records) {
  if (!Array.isArray(records)) throw new Error('invalid readonly media context');
  if (!records.some(record=>record?.recipe?.kind==='iso9660')) return null;
  const {Worker}=require('node:worker_threads'),encoded=JSON.stringify(records);
  const worker=new Worker(__filename,{workerData:{readonlyMediaPreparation:encoded}});
  let pins,error;
  const ready=new Promise((resolve,reject)=>{
    worker.on('message',value=>{pins=value;});
    worker.once('error',e=>{error=e;});
    worker.once('exit',code=>{
      if (error || code!==0 || !Array.isArray(pins)) reject(error || new Error('readonly media preparation failed'));
      else resolve(pins);
    });
  });
  ready.catch(()=>{});
  const held={encoded,ready,cancelled:false};
  let cancellation;
  const ticket={cancel:()=>{
    // Revocation must survive successful worker exit too. terminate() alone
    // leaves a completed preparation consumable after cancellation.
    held.cancelled=true;
    preparations.delete(ticket);
    return cancellation ||= worker.terminate();
  }};
  preparations.set(ticket,held);
  return ticket;
}
async function consumePreparation(records,ticket) {
  const held=preparations.get(ticket);
  if (!held || held.encoded!==JSON.stringify(records)) throw new Error('readonly media preparation context mismatch');
  preparations.delete(ticket);
  const pins=await held.ready;
  if (held.cancelled) throw new Error('readonly media preparation cancelled');
  return pins;
}
module.exports={sourceIdentity,assertSourceOwner,sourcePin,prepareRestore,consumePreparation};
const {isMainThread,workerData,parentPort}=require('node:worker_threads');
if (!isMainThread && typeof workerData?.readonlyMediaPreparation==='string') {
  const records=JSON.parse(workerData.readonlyMediaPreparation);
  if (!Array.isArray(records)) throw new Error('invalid readonly media context');
  parentPort.postMessage(records.map(record=>{
    if (record?.recipe?.kind!=='iso9660') return null;
    if (record.recipe.paths?.length!==1 || record.sources?.length!==1 || record.recipe.paths[0]!==record.sources[0].path)
      throw new Error('readonly media source list mismatch');
    const pin=sourcePin(record.recipe.paths[0]);
    if (JSON.stringify(pin)!==JSON.stringify(record.sources[0])) throw new Error('readonly media source pin mismatch');
    return [pin];
  }));
}
