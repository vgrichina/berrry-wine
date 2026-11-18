'use strict';
const assert = require('node:assert/strict');

// A physical release belongs to the document/process that received DOWN.
// Dialog, window and GL endpoints may legitimately change before UP. Do not
// traverse their readiness state in this reader (even for diagnostics).
const PROCESS_READ = `(() => {
  const k='__mcmPassiveIdentityV1';
  if(!globalThis[k])Object.defineProperty(globalThis,k,{value:{epoch:crypto.randomUUID(),ids:new WeakMap(),next:0}});
  const s=globalThis[k],token=o=>{
    if(!o||!['object','function'].includes(typeof o))return null;
    if(!s.ids.has(o))s.ids.set(o,s.epoch+':'+(++s.next));
    return s.ids.get(o);
  };
  return {apps:(typeof runningApps==='undefined'?[]:runningApps).map(a=>{
    const w=a.wine,g=w?.guestWorker,l=g?.link;
    return {name:a.name,running:!!w?.running,stopped:!!w?._stopped,guestWorker:!!g,
      processId:w?.processId,processObject:token(w),endpoint:l?.endpointIdentity,
      endpointObject:token(l),workerObject:token(l?.worker),moduleObject:token(l?.module),
      epoch:s.epoch,pageRendererObject:token(w?.renderer),canvasObject:token(document.getElementById('screen'))};
  })};
})()`;
const FIELDS=Object.freeze(['name','processId','processObject','endpoint','endpointObject',
  'workerObject','moduleObject','epoch','pageRendererObject','canvasObject']);
function sameProcess(want,current){
  assert(current?.running&&!current.stopped&&current.guestWorker,'process input owner retired');
  for(const k of FIELDS){
    assert(want?.[k]!==null&&want?.[k]!==undefined&&want[k]!=='','missing process input owner '+k);
    assert.equal(current[k],want[k],'process input owner changed '+k);
  }
}
module.exports={PROCESS_READ,FIELDS,sameProcess};
