'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {validateACK,installReleaseWitness}=require('./mdk2-release-participant.cjs');
test('terminal release ACK requires exact trusted physical edge and unheld owner',()=>{
  const a={nonce:'one',code:13,domCode:'Enter',armed:10,fallback:1760},r={...a,kind:'key',at:20,trusted:true,down:false,stable:true,boundary:'trusted-dom-up-renderer-unheld',nativeGuardReceipt:false};
  assert(validateACK(a,r));
  for(const change of [{nonce:'other'},{code:14},{domCode:'Space'},{trusted:false},{down:true},{stable:false},{at:9},{at:1761},{nativeGuardReceipt:true},{boundary:'transport-only'}])assert(!validateACK(a,{...r,...change}));
});
test('prearmed witness ignores synthetic and wrong edge, observes no input or guard query',()=>{
  let listener,removed=0;const outputs=[],jobs=[];
  const wine={running:true,renderer:{peekKeyDownState:()=>0},memory:{},instance:{},_wasmModule:{},processId:1000};
  const context={window:{fixtureWine:wine,addEventListener:(type,fn)=>{assert.equal(type,'keyup');listener=fn;},removeEventListener:()=>removed++},queueMicrotask:f=>jobs.push(f),Date,console:{info:(...a)=>outputs.push(a)}};
  vm.runInNewContext('('+installReleaseWitness+')({nonce:"one",code:13,domCode:"Enter"})',context);
  listener({isTrusted:false,keyCode:13,code:'Enter'});listener({isTrusted:true,keyCode:14,code:'Enter'});assert.equal(removed,0);assert.equal(jobs.length,0);
  listener({isTrusted:true,keyCode:13,code:'Enter'});assert.equal(removed,1);assert.equal(outputs.length,0);jobs[0]();
  assert.equal(outputs.length,1);const r=JSON.parse(outputs[0][1]);assert(r.trusted&&!r.down&&r.stable&&!r.nativeGuardReceipt);
});
