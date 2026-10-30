'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {createHash}=require('node:crypto');
const {formatChunks}=require('./telegram-replies');
function receiptPath(dir,consumer,id){
 if(!/^[A-Za-z0-9_-]{1,80}$/.test(consumer||'')||!Number.isSafeInteger(id)||id<1)throw Error('Invalid reply consumer or inbox id');
 return path.join(dir,'deliveries',consumer,id+'.json');
}
async function atomic(file,value){
 const h=await fs.open(file+'.tmp','w',0o600);
 try{await h.writeFile(JSON.stringify(value,null,2)+'\n');await h.sync();}finally{await h.close();}
 await fs.rename(file+'.tmp',file);
}
// A timeout after send may have reached Telegram. Preserve that uncertainty rather
// than blindly duplicating the reply. Confirmed chunks survive a process restart.
async function deliverReply({dir,consumer,inboxId,text,send}){
 text=text.trim();if(!text)throw Error('Reply text is empty');
 const file=receiptPath(dir,consumer,inboxId),lock=file+'.lock';
 await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
 await fs.mkdir(lock,{mode:0o700});
 try{
  const digest=createHash('sha256').update(text).digest('hex');
  let record;try{record=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(record){
   if(record.textSHA256!==digest)throw Error('This inbox reply already has different saved text');
   if(record.status==='delivered')return record;
   if(['sending','uncertain'].includes(record.status))throw Error('Prior send has uncertain delivery; inspect Telegram before reconciling the receipt');
  }else record={consumer,inboxId,textSHA256:digest,status:'pending',chunks:formatChunks(text),messageIds:[]};
  while(record.messageIds.length<record.chunks.length){
   record.status='sending';await atomic(file,record);
   let result;
   try{
    const chunk=record.chunks[record.messageIds.length];result=await send(chunk.text,{entities:chunk.entities});
    if(!Number.isSafeInteger(result?.message_id))throw Error('Telegram acknowledgement missing message_id');
   }catch(e){record.status=e.definitelyRejected?'pending':'uncertain';record.error=e.message;await atomic(file,record);throw e;}
   record.messageIds.push(result.message_id);delete record.error;
   record.status=record.messageIds.length===record.chunks.length?'delivered':'pending';
   record.updatedAt=new Date().toISOString();await atomic(file,record);
  }
  return record;
 }finally{await fs.rmdir(lock);}
}
module.exports={receiptPath,deliverReply};
