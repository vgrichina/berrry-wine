'use strict';
const assert=require('node:assert/strict');
const {fixture}=require('./strict-software-gate.test.cjs');
const {create}=require('./native-software-gate.cjs');
async function setup(hooks={},retentionHook=()=>{}) {
  const f=fixture(hooks),retained=[];
  const adapter=create({...f.options,retain:row=>{retained.push(row);return retentionHook(row);}});
  adapter.setPageSession('page');
  adapter.event({method:'Runtime.executionContextCreated',sessionId:'page',params:{context:{id:1,uniqueId:'page-epoch'}}});
  adapter.event({method:'Runtime.executionContextCreated',sessionId:'guest',params:{context:{id:7,uniqueId:'guest-epoch'}}});
  f.worker.scripts[0].executionContextId=7;
  for(const [scriptId,s] of f.scripts)adapter.event({method:'Debugger.scriptParsed',sessionId:'page',params:{scriptId,...s}});
  await adapter.install({...f.options,ownerExpression:'w'});f.copy();
  return {f,adapter,retained};
}
(async()=>{
  const {f,adapter:a,retained}=await setup();
  assert(!(await a.probe({phase:'beforeResume'})).living);
  f.setPixel([255,1,0,255]);f.copy();assert(!(await a.probe()).living);
  f.setPixel([255,2,0,255]);f.copy();assert((await a.probe()).living);
  assert.equal(retained.length,18);assert.equal(retained.filter(r=>r.response.scriptSource).length,12);
  assert(retained.every(r=>!r.refused&&r.responseAt>=r.requestAt));
  let negatives=0;
  for(const session of ['page','guest'])for(const method of ['Runtime.executionContextDestroyed','Runtime.executionContextsCleared']) {
    const {f,adapter}=await setup();await adapter.probe({phase:'beforeResume'});
    adapter.event({method,sessionId:session,params:{executionContextId:session==='page'?1:7}});
    assert.equal(session==='page'?adapter.scripts.size:f.worker.scripts.length,0);
    const n=f.calls.length;await assert.rejects(()=>adapter.probe(),/no replay/);assert.equal(f.calls.length,n);assert(adapter.closed);negatives++;
  }
  for(const phase of ['entry','owner','pixels','return']) {
    let adapter,enabled=false;
    const s=await setup({save(f,row){if(enabled&&row.phase===phase)adapter.event({method:'Runtime.executionContextsCleared',sessionId:'page'});}});
    adapter=s.adapter;await adapter.probe({phase:'beforeResume'});enabled=true;
    await assert.rejects(()=>adapter.probe());assert(adapter.closed);assert.equal(s.f.pending,0);negatives++;
  }
  const bad=await setup({source(f,id){if(id==='d')throw Error('actual transport refusal');}});
  await assert.rejects(()=>bad.adapter.probe({phase:'beforeResume'}),/transport refusal/);
  assert(bad.retained.some(r=>r.refused&&r.error.includes('actual transport refusal')));
  assert(bad.retained.some(r=>r.response?.scriptSource==='pinned compositor JS'));
  assert.equal(bad.f.pending,0);
  const count=bad.f.calls.length;await assert.rejects(()=>bad.adapter.probe(),/no replay/);assert.equal(bad.f.calls.length,count);negatives++;
  // A late reply cannot revive a retired WASM row.
  const late=await setup(),row=late.f.worker.scripts[0];
  late.adapter.event({method:'Runtime.executionContextsCleared',sessionId:'guest'});row.sha256='late response';
  assert.equal(late.f.worker.scripts.length,0);negatives++;
  const reused=await setup();reused.adapter.event({method:'Runtime.executionContextCreated',sessionId:'page',params:{context:{id:1,uniqueId:'new-epoch'}}});
  await assert.rejects(()=>reused.adapter.probe(),/no replay/);negatives++;
  const brokenSink=await setup({},()=>{throw Error('durable retention failed');});
  await assert.rejects(()=>brokenSink.adapter.probe({phase:'beforeResume'}),/retention failed/);
  assert(brokenSink.adapter.closed);assert.equal(brokenSink.f.pending,0);negatives++;
  let inFlight,retire=false;
  const replaced=await setup({source(){if(retire){retire=false;
    inFlight.event({method:'Runtime.executionContextsCleared',sessionId:'page'});
    inFlight.event({method:'Runtime.executionContextCreated',sessionId:'page',params:{context:{id:1,uniqueId:'replacement'}}});
    for(const [scriptId,s] of replaced.f.scripts)inFlight.event({method:'Debugger.scriptParsed',sessionId:'page',params:{scriptId,...s}});
  }}});
  inFlight=replaced.adapter;await inFlight.probe({phase:'beforeResume'});
  retire=true;replaced.f.setPixel([255,8,0,255]);replaced.f.copy();
  // Equal script IDs, URLs and numeric contexts cannot revive the old epoch.
  await assert.rejects(()=>inFlight.probe(),/no replay/);assert(inFlight.closed);assert.equal(replaced.f.pending,0);negatives++;
  console.log(JSON.stringify({passed:true,mockCDP:true,negatives,completeResponses:18,allSettledDrain:true,contextRetirement:true,lateResponseCannotRevive:true,stickyUnknown:true,noReplay:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
