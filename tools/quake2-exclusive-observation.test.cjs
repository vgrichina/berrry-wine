'use strict';
// Actual shipped NodeWorker and CPU controls, without replaying accepted full
// native load/media experiments. Their PATH/HASH is pinned by the reused test.
const assert=require('node:assert/strict');
const {queuedWorker}=require('./quake2-owning-load-witness.test.cjs');
(async()=>{
  const results=[];
  for(const scenario of ['positive','reset','reload','disarm','rearm','readExportMutation',
    'code','module','memory','missingModule','missingMemory','import','missingCoverage',
    'noTrace','writerGap','executionError','use']) {
    const off=await queuedWorker(false,scenario),on=await queuedWorker(true,scenario);
    assert.deepEqual(on.state,off.state,scenario+' architectural parity');
    assert.deepEqual(on.outcome,off.outcome,scenario+' result/error parity');
    assert.equal(on.guestHash,off.guestHash,scenario+' direct guest memory parity');
    for(const arm of [off,on]) {
      assert.equal(arm.lifecycle.deadlineFired,false);
      assert.equal(arm.lifecycle.deadlineCleared,true);
      assert.equal(arm.lifecycle.terminationAwaited,true);
      assert.equal(arm.lifecycle.threadIdAfter,-1);
    }
    // Request sequence differs only within each identical off/on scenario;
    // diagnostic payload never authorizes continuity or writer coverage.
    results.push({scenario,off,on});
  }
  console.log(JSON.stringify({pass:true,results}));
})().catch(error=>{console.error(error);process.exitCode=1;});
