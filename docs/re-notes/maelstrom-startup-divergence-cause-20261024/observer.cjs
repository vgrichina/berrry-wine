const assert=require('assert');
function createObserver(emit) {
 let start=null,done=false,bytes=0;
 function sample(batch,e,memory,g2w,tick) {
  const counts=Array.from({length:6},(_,i)=>e.get_count(i)>>>0);
  if(!counts[4]||done)return;
  const eip=e.get_eip()>>>0;
  if(start===null) {if(eip!==0x75040f8)return;start=batch;}
  if(batch!==start && batch!==start+10 && batch!==start+20 && batch!==41999)return;
  const esp=e.get_esp()>>>0,dv=new DataView(memory.buffer);
  const read=(a,n)=> {assert(n<=260);return Array.from(new Uint8Array(memory.buffer,g2w(a),n));};
  const frame=Array.from({length:6},(_,i)=>dv.getUint32(g2w(esp+i*4),true));
  const row={batch,offset:batch-start,eip,esp,counts,tick:{...tick},yield:e.get_yield_reason()|0};
  if(eip===0x75040f8) {
   assert.equal(frame[0],0x7a3362,'authentic select return');
   row.frame=frame;row.timeval=frame[5]?read(frame[5],8):null;
   row.fdsets=frame.slice(2,5).map(a=>a?read(a,Math.min(260,4+dv.getUint32(g2w(a),true)*4)):null);
  }
  const line=JSON.stringify(row);bytes+=Buffer.byteLength(line)+1;assert(bytes<=8192,'diagnostic output guard');emit(line);
  if(batch===41999)done=true;
 }
 return sample;
}
module.exports={createObserver};
