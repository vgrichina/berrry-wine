'use strict';
// Run the actual adapted confirmation block under delayed durable receipt IO.
// Ported from test-halflife2-receipt-clock.py. The Python test adapted the
// helper pinned at git 70e85792e (tools/vb5cce-reviewed-control.py); that
// revision has no JS helper, so this adapts the working-tree
// tools/vb5cce-reviewed-control.js, which reviewed-next's controller seals by
// digest.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const m=require(path.join(root,'tools/halflife2-reviewed-next.js'));
const body=fs.readFileSync(path.join(root,'tools/vb5cce-reviewed-control.js'));
const fixed=m.receipt_clock_body(body).toString();
const END="    check(Object.entries({owner:owner.owner";
const slice=(text,from)=>{const a=text.indexOf(from);assert(a>=0,'anchor '+from);const z=text.indexOf(END,a);assert(z>a);return text.slice(a,z);};
const block=slice(fixed,'    const confirmation_at=now();');
function check(cond,message){if(!cond){const e=new Error(message||'');e.name='AssertionError';throw e;}}
const exec=(code,env)=>new Function('now','M','name','start','receipt','check',code)(env.now,{save:env.save},env.name,env.start,env.receipt,check);
let saved;
for(const [arrival,saveDelay,state,consumed,ok] of [[100.499,.020,'CONSUMED',true,true],[100.500,.001,'CONSUMED',true,false],[100.501,0,'CONSUMED',true,false],[100.499,0,'UNKNOWN',false,false],[100.499,0,'CANCELLED',false,false]]){
  const clock=[arrival];saved=[];
  const save=(name,value)=>{saved.push([name,value]);clock[0]+=saveDelay;};
  let refused=false;
  try{exec(block,{now:()=>clock[0],save,name:'accept',start:100,receipt:{state,consumed}});}
  catch(e){if(e.name!=='AssertionError')throw e;refused=true;}
  assert.equal(refused,!ok,JSON.stringify([arrival,state]));
  assert.equal(saved[0][1].at,arrival);
}
// Reproduce the concrete old failure: reply on time, save pushes clock past 500.
const old=slice(body.toString(),"    M.save(name+'-down.json'");
{
  const clock=[100.499];
  let refused=false;
  try{exec(old,{now:()=>clock[0],save:()=>{clock[0]+=.020;},name:'accept',start:100,receipt:{state:'CONSUMED',consumed:true}});}
  catch(e){if(e.name!=='AssertionError')throw e;refused=true;}
  assert(refused,'old defect was not reproduced');
}
assert(fixed.includes('start*1000<=receipt.consumedAt'));
assert(fixed.includes('up.at<start+1.75')&&fixed.includes('now()<start+3'));
console.log('PASS actual old confirmation defect reproduced; fixed on-time arrival survives durable IO, late/cancelled/UNKNOWN refused; all native/UP/aggregate bounds retained');
