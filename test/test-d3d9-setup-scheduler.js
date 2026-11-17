#!/usr/bin/env node
'use strict';
const assert=require('assert');
const {Device,copyPayload}=require('../lib/d3d9-software-backend');

// A scheduling oracle, not a replacement for actual WAT pixel tests.
function fixture(results=[1,0,1,0]){
  const events=[],draw={context:0,contexts:[],setup:{snapshot:{},batches:[{id:1},{id:2}],index:0}};
  const device={quadBudget:3,prepareBatch(batch,d){
    events.push(['create',batch.id]);d.context=batch.id;d.contexts.push(batch.id);
    d.finishSetup=()=>events.push(['bind',batch.id]);
  },exports(){return {
    d3d_software_prepare_step(ctx,packets,primitives){
      assert.strictEqual(packets,1024);assert.strictEqual(primitives,8);
      events.push(['setup',ctx]);return results.shift();
    },
    d3d_software_step(ctx,quads){assert.strictEqual(quads,3);events.push(['raster',ctx]);return 0;},
  };}};
  return {draw,events,step:()=>Device.prototype.step.call(device,draw)};
}
{
  const f=fixture();
  assert.strictEqual(f.step(),1);assert.deepStrictEqual(f.events,[['create',1],['setup',1]]);
  assert.strictEqual(f.step(),1);assert.strictEqual(f.draw.context,0);
  assert.strictEqual(f.step(),1);assert.strictEqual(f.step(),1);
  assert.strictEqual(f.draw.setup,null);
  assert.deepStrictEqual(f.events,[['create',1],['setup',1],['setup',1],['bind',1],
    ['create',2],['setup',2],['setup',2],['bind',2]]);
  assert.strictEqual(f.step(),1);assert.strictEqual(f.step(),0);
  assert.deepStrictEqual(f.events.slice(-2),[['raster',1],['raster',2]]);
}
for(const failure of [-1,-2]){
  const f=fixture([0,failure]);
  assert.strictEqual(f.step(),1);assert.strictEqual(f.step(),failure);
  assert(!f.events.some(([kind])=>kind==='raster'),'failed later batch cannot publish earlier pixels');
  assert(!f.events.some(([kind,id])=>kind==='bind'&&id===2));
}
{
  const values=new Int32Array([1,-2147483648]),source={values,nested:{enabled:true}};
  const copied=copyPayload(source,1024);
  source.values.fill(0);source.nested.enabled=false;
  assert.deepStrictEqual([...copied.value.values],[1,-2147483648]);
  assert.strictEqual(copied.value.nested.enabled,true);
  assert(copied.bytes>values.byteLength);
  assert.throws(()=>copyPayload(source,1),/budget/);
}
console.log('PASS deferred setup scheduling: bounded steps, serial compaction/binding, all-ready raster barrier, failure and snapshot ownership');
