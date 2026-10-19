'use strict';
// Text-only debugger commands: read object, read buffer, arm watch, continue.
// No guessed heap address, eval, or guest-memory mutation.
const assert=require('assert/strict');
const PROMPT='[s]tep/[c]ont/[d]ump ADDR:LEN/[w]atch ADDR/[r]egs/[q]uit > ';
class PathWatchHandoff {
 constructor(){this.phase='boundary';this.pending='';this.receipts=[];this.pointer=null;this.object=null;}
 feed(chunk){
  this.pending+=chunk;assert(this.pending.length<=128*1024,'debugger handoff transcript bound');
  const commands=[];
  while(this.pending.includes(PROMPT)){
   const cut=this.pending.indexOf(PROMPT),text=this.pending.slice(0,cut);this.pending=this.pending.slice(cut+PROMPT.length);
   const command=this.prompt(text);this.receipts.push({phase:this.phase,observed:text,command});commands.push(command);
  }
  return commands;
 }
 dump(text,address,length){
  const marker=`Hexdump 0x${address.toString(16).padStart(8,'0')} (${length} bytes):`;
  const tail=text.slice(text.lastIndexOf(marker));assert(text.includes(marker),'matching dump header required');
  const bytes=[];
  for(const line of tail.split('\n').slice(1)){
   const m=line.match(/^\s+0x([0-9a-f]{8})\s{2}((?:[0-9a-f]{2} ){1,16})/i);if(!m)break;
   assert.equal(parseInt(m[1],16),address+bytes.length,'contiguous dump');bytes.push(...m[2].trim().split(' ').map(x=>parseInt(x,16)));if(bytes.length>=length)break;
  }
  assert.equal(bytes.length,length,'complete dump required');return Buffer.from(bytes);
 }
 prompt(text){
  if(this.phase==='boundary'){
   const rows=[...text.matchAll(/EIP=0x([0-9a-f]+)[^\n]*?EBX=0x([0-9a-f]+)/gi)];assert(rows.length,'boundary registers required');
   const r=rows[rows.length-1];assert.equal(parseInt(r[1],16),0x43c7ee,'original clean boundary required');
   this.object=parseInt(r[2],16);assert(this.object>=0x400000&&this.object<=0x7fffffff,'valid current CString object');
   this.phase='pointer';return `d 0x${this.object.toString(16)}:4\n`;
  }
  if(this.phase==='pointer'){
   this.pointer=this.dump(text,this.object,4).readUInt32LE();assert(this.pointer>=0x400000&&this.pointer<=0x7fffffff,'valid current CString buffer');
   this.phase='bytes';return `d 0x${this.pointer.toString(16)}:64\n`;
  }
  if(this.phase==='bytes'){
   const bytes=this.dump(text,this.pointer,64),nul=bytes.indexOf(0);assert(nul>0,'terminated path proof required');
   this.path=bytes.subarray(0,nul).toString('ascii');assert.equal(bytes[0],0x43,'clean C byte required');
   assert(this.path.toLowerCase().replace(/\\/g,'/').startsWith('c:/program files/the 3do company/army men demo/'),'installed original path required');
   this.phase='armed';return `w 0x${this.pointer.toString(16)}\n`;
  }
  if(this.phase==='armed'){
   const ack=text.match(/Watchpoint set: 0x([0-9a-f]+) \(current: 0x([0-9a-f]+)\)/i);assert(ack,'watch acknowledgement required');
   assert.equal(parseInt(ack[1],16),this.pointer);assert.equal(parseInt(ack[2],16),0x43);
   this.phase='done';return 'c\n';
  }
  throw new Error('unexpected debugger prompt after handoff');
 }
}
module.exports={PathWatchHandoff,PROMPT};
