'use strict';
// Replay the pinned harness's exact deferral logic, without a guest/module.
const fs=require('fs'),assert=require('assert');
const source=fs.readFileSync('/tmp/maelstrom-head-yield-observer-oct24/ops/run.js','utf8');
const start=source.indexOf('  const sortScheduledInput ='),end=source.indexOf('\n\n  // Resource parsing',start);
assert(start>=0&&end>start);const canonical=source.slice(start,end);
const timeline=JSON.parse(fs.readFileSync('/tmp/thps2-installed-demo-gameplay-api-oct26/ops/input-timeline.json'));
function replay(gap){
 const scheduledInput=[];for(let i=0;i<timeline.length;i++){scheduledInput.push({batch:i*(gap?2:1),wait:true,index:i});for(const action of timeline[i].actions)scheduledInput.push({batch:i*(gap?2:1)+(gap?1:0),action,index:i});}
 const defer=new Function('scheduledInput',canonical+';return deferScheduledWait;')(scheduledInput);
 const observed=[];let go=0,next=0;
 // Every batch is one millisecond in this pure scheduling model. IPC comes
 // at the documented wall timestamps; no guest clocks are inferred here.
 for(let batch=0;batch<=72000;batch++){
  while(next<timeline.length&&timeline[next].ms<=batch){go++;next++;}
  while(scheduledInput.length&&scheduledInput[0].batch<=batch){const ev=scheduledInput.shift();if(ev.wait){if(go)go--;else defer(ev,batch);}else observed.push({index:ev.index,action:ev.action,at:batch,expected:timeline[ev.index].ms});}
 }
 return observed;
}
const old=replay(false);assert(old.some(e=>e.at<e.expected),'same-batch negative control must expose early action');
const fixed=replay(true);assert.equal(fixed.length,timeline.reduce((n,e)=>n+e.actions.length,0));for(const e of fixed)assert(e.at>=e.expected&&e.at<=e.expected+1,JSON.stringify(e));
console.log(JSON.stringify({pass:true,canonicalDeferralSHA256:require('crypto').createHash('sha256').update(canonical).digest('hex'),sameBatchRejected:true,oldFirst:old[0],correctedFirst:fixed[0],correctedActions:fixed.length,guestExecuted:false}));
