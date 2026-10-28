// Offline oracle over real captured evidence. No browser/guest execution.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
function observed(result,production){
 const b=Object.fromEntries(result.boundaries.map(x=>[x.label,x]));
 const held=b['production-after-real-down'], moved=b['production-after-held-move-explicit-left'], lost=b['production-after-browser-lost'];
 assert(held.capture.sameBinderCanvas&&held.capture.ownerDocument&&held.capture.connected&&held.capture.documentFocus);
 assert.equal(held.capture.pointerType,'mouse');assert.equal(held.capture.buttons,1);assert.equal(held.state.int33.bx,1);
 assert(moved.capture.hasCapture);assert.equal(moved.capture.id,held.capture.id);
 const got=production.events.findIndex(e=>e.type==='gotpointercapture'&&e.trusted&&e.pointerType==='mouse'&&e.pointerId===held.capture.id&&e.buttons===1);
 const gone=production.events.findIndex(e=>e.type==='lostpointercapture'&&e.trusted&&e.pointerType==='mouse'&&e.pointerId===held.capture.id&&e.buttons===1);
 assert(got>=0&&gone>got);assert.equal(lost.state.int33.bx,0);assert.equal(lost.release.bx,1);
 for(const label of ['production-stale-held-move','production-stale-up']){assert.equal(b[label].state.int33.bx,0);assert.equal(b[label].press.bx,0);assert.equal(b[label].release.bx,0);}
 assert(production.calls.some(c=>c.name==='bindPointer'&&c.stack.includes('/toyvm/live.js')));
 const [omitted,explicit]=result.controls;assert.equal(omitted.explicitButton,false);assert(omitted.before.capture&&!omitted.after.capture);assert(explicit.before.capture&&explicit.after.capture);
 return true;
}
function qualified(result,production,guard){observed(result,production);assert.equal(guard.stopReason,null);assert.equal(guard.exit,0);assert(guard.cleanupComplete);return true;}
if(require.main===module){
 const dir=process.argv[2],read=n=>JSON.parse(fs.readFileSync(path.join(dir,n)));
 const r=read('result.json'),p=read('production-events.json'),g=read('browser-guard.json');observed(r,p);
 const controls=[
  (r,p)=>{p.events.filter(e=>e.type==='lostpointercapture').forEach(e=>e.trusted=false)},
  (r,p)=>{p.events.filter(e=>e.type==='gotpointercapture').forEach(e=>e.pointerId=999)},
  r=>{r.boundaries[0].capture.sameBinderCanvas=false},
  r=>{r.boundaries.find(b=>b.label==='production-after-browser-lost').release.bx=2},
  r=>{r.boundaries.find(b=>b.label==='production-stale-held-move').state.int33.bx=1},
  r=>{r.boundaries.find(b=>b.label==='production-stale-up').press.bx=1},
 ];
 controls.forEach(change=>{const rr=structuredClone(r),pp=structuredClone(p);change(rr,pp);assert.throws(()=>observed(rr,pp))});
 assert.throws(()=>qualified(r,p,g));
 console.log(JSON.stringify({rawObservation:true,negativeControls:controls.length,resourceRejectionPreserved:true,qualified:false,mousePointercancelObserved:r.mousePointercancelObserved}));
}
module.exports={observed,qualified};
