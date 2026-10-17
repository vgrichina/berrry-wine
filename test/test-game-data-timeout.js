'use strict';
const assert = require('node:assert/strict');
const { HttpRangeProvider } = require('../lib/byte-provider');
const forever = () => new Promise(() => {});
const good = () => ({status:200,arrayBuffer:async()=>Uint8Array.of(1,2,3,4).buffer});
(async()=>{
  for(const stage of ['headers','body']) {
    let calls=0,signal,late;
    const p=new HttpRangeProvider(stage,4,{timeoutMs:20,fetch:async(_url,init)=>{
      signal=init.signal;
      if(++calls>1)return good();
      const pending=new Promise(r=>{late=r;});
      return stage==='headers'?pending:{status:200,arrayBuffer:()=>pending};
    }});
    await assert.rejects(p.readRange(0,4),{name:'TimeoutError'});
    assert(signal.aborted);
    assert.equal(p.readRangeSync(0,4),null);
    assert.deepEqual([...await p.readRange(0,4)],[1,2,3,4]);
    late(stage==='headers'?{status:200,arrayBuffer:async()=>Uint8Array.of(9,9,9,9).buffer}:Uint8Array.of(9,9,9,9).buffer);
    await new Promise(r=>setImmediate(r));
    assert.deepEqual([...p.readRangeSync(0,4)],[1,2,3,4],'late timed-out request cannot overwrite retry');
  }
  await assert.rejects(HttpRangeProvider.open('unknown',{timeoutMs:20,fetch:forever}),{name:'TimeoutError'});
  const controller=new AbortController();let calls=0;
  const p=new HttpRangeProvider('cancel',4,{timeoutMs:1000,signal:controller.signal,fetch:()=>{calls++;return forever();}});
  const pending=p.readRange(0,4);controller.abort();
  await assert.rejects(pending,{name:'AbortError'});
  await assert.rejects(p.readRange(0,4),{name:'AbortError'});assert.equal(calls,1);
  let splitCalls=0;
  const split=new HttpRangeProvider('split',4,{timeoutMs:20,partSize:4,partUrl:u=>u+'.part000',fetch:async u=>{
    if(u==='split')return {status:404};
    if(++splitCalls===1)return {status:200,arrayBuffer:forever};return good();
  }});
  await assert.rejects(split.readRange(0,4),{name:'TimeoutError'});
  assert.deepEqual([...await split.readRange(0,4)],[1,2,3,4]);assert.equal(splitCalls,2);
  console.log('PASS game-data deadlines: headers, body, unknown size, cancellation, late response, split retry');
})().catch(e=>{console.error(e);process.exitCode=1;});
