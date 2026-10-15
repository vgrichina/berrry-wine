#!/usr/bin/env node
'use strict';
// Host error transport only. The real WAT reader's reason classification and
// complete memory/global preservation live in test-d3d-render-lifetime.js.
const assert=require('assert');
const {Device}=require('../lib/d3d9-software-backend');
function harness(read){
  const device=Object.create(Device.prototype),calls=[];
  const native={d3d_render_coalesce_heap(){calls.push('coalesce');return -1;}};
  if(read)native.d3d_render_free_list_diagnostic=field=>{calls.push(field);return read(field);};
  device.options={getExports:()=>native};
  return {device,native,calls};
}
function reject(device){
  let caught;
  try{device.prepare({});}catch(error){caught=error;}
  assert(caught instanceof Error,'the invalid list still rejects submission');
  assert.match(caught.message,/^D3D9 software: invalid native free list; first failure /);
  // Error custom properties do not survive all worker paths; the record must
  // remain recoverable from the actual stack/string transport.
  const line=String(caught.stack).split('\n')[0];
  return JSON.parse(line.slice(line.indexOf('{')));
}
const fields=[3,0x8201000,0xf1234000|0,0,0,0,0,0,0,0,17,1024];
{
  const {device,calls}=harness(field=>fields[field]);
  assert.deepStrictEqual(reject(device),{atomic:false,reason:3,head:0x8201000,
    current:0xf1234000,wasmHeader:0,rawSize:0,next:0,arenaRecord:0,arenaBase:0,
    arenaEnd:0,allocatedHighWater:0,validatedNodes:17,arenaCount:1024});
  const first=device.nativeFreeListFailure;
  fields[0]=10;fields[2]=0x8500000;
  reject(device);
  assert.strictEqual(device.nativeFreeListFailure,first,'later failures retain the first observation');
  assert.deepStrictEqual(calls,['coalesce',...Array.from({length:12},(_,i)=>i),'coalesce'],
    'only one bounded passive field read set, guard remains active on each draw');
}
{
  const {device}=harness();
  assert.deepStrictEqual(reject(device),{atomic:false,unavailable:'native diagnostic export missing'});
}
{
  const {device,calls}=harness(field=>{if(field===2)throw Error('reader trap');return field+1;});
  assert.deepStrictEqual(reject(device),{atomic:false,reason:1,head:2,unavailable:'reader trap'});
  reject(device);
  assert.deepStrictEqual(calls,['coalesce',0,1,2,'coalesce'],'reader failure cannot replace guard or cause retry storms');
}
{
  const {device,native,calls}=harness(()=>{throw Error('must not diagnose valid heap');});
  native.d3d_render_coalesce_heap=()=>0;
  // A later validation error provides a real prepare boundary without native
  // allocation; successful coalescing must not invoke the failure reader.
  assert.throws(()=>device.prepare({textures:[{resource:{id:1}}],colorAttachment:{id:1}}),
    /render target sampler feedback/);
  assert.deepStrictEqual(calls,[]);
  assert.strictEqual(device.nativeFreeListFailure,undefined);
}
console.log('PASS native free-list failure evidence: first fields, unsigned addresses, stack transport, bounded reads and unchanged rejection');
