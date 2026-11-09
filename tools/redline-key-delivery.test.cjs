'use strict';
// Execute the actual fixture controller, production caller, CDP sender,
// retained hold helper, numbered transport and joined cleanup. Only browser,
// page and Worker services are inert; no guest or Chrome is created.
const assert=require('node:assert/strict');
const {observeHold}=require('./redline-key-delivery.cjs');
async function suite(){
  const first=Error('first input error'),receipt={attempted:[','],samples:[]};
  first.holdReceipt=receipt;
  await assert.rejects(observeHold({hold:async()=>{throw first;},
    save:()=>{throw Error('inert disk failure');},holdMs:600}),error=>error===first);
  assert(first.deliveryEvidenceError.includes('inert disk failure'));
  await require('./redline-startup.test.cjs').productionFixtureSuite([
  'old-keydown-response-delay','positive','keydown-response-delay',
  'keydown-service-delay','keydown-stalled','release-failure'
  ]);
}
suite().catch(error=>{console.error(error);process.exitCode=1;});
