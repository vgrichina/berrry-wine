'use strict';
// Replay recorded CPU/stack metadata, never a guest/module/renderer.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const install=require('./jig-owning-api-observer');
const {capture,diagnosticApis,CODE,NAME}=require('./army-bltfast-observer');
const apis=require('../src/api_table.json');
const bytes=fs.readFileSync(require.resolve('./fixtures/army-original-bltfast-20261020.json'));
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
  '4f41d0b3a54de1c33829188449d05a1c8e6f445594050c89f19256aab62cd6ca');
const saved=JSON.parse(bytes);
assert.equal(saved.accepted,false);
assert.equal(saved.records.length,8);
assert.equal(saved.observer.records.length,24);
for(const r of saved.records) {
  assert.equal(r.source,null);assert.equal(r.destination,null);
  assert.equal(r.samples,undefined);assert.equal(r.state,'rejected');
}
const before=JSON.stringify(apis), corrected=diagnosticApis(apis);
assert.equal(JSON.stringify(apis),before,'diagnostic correction must not mutate dispatch metadata');
assert.equal(corrected.find(a=>a.name===NAME).nargs,6);
assert.throws(()=>diagnosticApis(apis.filter(a=>a.name!==NAME)),/Unexpected/);
for(const patch of [{nargs:7},{convention:'cdecl'}])
  assert.throws(()=>diagnosticApis(apis.map(a=>a.name===NAME?{...a,...patch}:a)),/Unexpected/);

function replay(record,metadata,{adapter=false,inferFlags=false,delta=28}={}) {
  const buffer=new ArrayBuffer(8192),d=new DataView(buffer);
  const raw=new Uint8Array(buffer);
  raw.set(Buffer.from(CODE,'hex'),0x400);
  raw.set(Buffer.from('<ord>'),0x600);
  let cpu=record.entry,count=0;
  d.setUint32(0x1000,record.returnAddress,true);
  record.args.forEach((v,i)=>d.setUint32(0x1004+4*i,v,true));
  // NOT captured: infer only this literal push from the pinned original code.
  // No surface identity, dimensions, pitch, rect contents or pixels invented.
  if(inferFlags)d.setUint32(0x1018,0x10,true);
  const ex={get_api_calls:()=>count,get_esp:()=>cpu.esp,get_eip:()=>cpu.eip,
    get_eax:()=>cpu.eax,get_yield_reason:()=>cpu.yieldReason,get_image_base:()=>0x400000};
  const host={log(){},log_i32(){},log_api_exit(){}};
  const g2w=p=>{
    if(p>=record.entry.esp && p<record.entry.esp+(inferFlags?28:24))
      return 0x1000+p-record.entry.esp;
    if(p>=0x4074f1 && p<0x407506)return 0x400+p-0x4074f1;
    throw Error('Unavailable captured memory');
  };
  const o={host,getExports:()=>ex,getBuffer:()=>buffer,g2w,apis:metadata,
    names:[NAME],returnAddresses:[0x407506],context:'captured CPU replay; no pixels',
    regions:{BASE:{DX_OBJECTS:0,DX_SURF_FMT:0}}};
  const observer=adapter?capture(o):install(o);
  observer.arm();count++;
  host.log_i32(0xc0de0000|record.apiId);host.log(0x600,5);
  cpu={...record.exit,esp:record.entry.esp+delta};host.log_api_exit();
  return observer.close();
}
for(const record of saved.observer.records) {
  assert.equal(record.args.length,5);
  assert.equal(record.espDelta,28);assert.equal(record.expectedEspDelta,24);
  assert.equal(record.entry.eip,record.exit.eip);
  assert.equal(record.exit.yieldReason,0);assert.equal(record.exit.eax,0);
  const legacy=apis.map(a=>a.name===NAME?{...a,nargs:5}:a);
  const old=replay(record,legacy);
  assert.equal(old.records[0].completed,false,'negative: old nargs5 expects24, actual28');
  assert.equal(old.records[0].expectedEspDelta,24);
  const absent=replay(record,corrected);
  assert(absent.ambiguous);assert.match(absent.errors.join(),/Unavailable captured memory/);
  const fixed=replay(record,corrected,{inferFlags:true});
  assert.equal(fixed.records[0].completed,true);
  assert.equal(fixed.records[0].expectedEspDelta,28);
  assert.deepEqual(fixed.records[0].args,[...record.args,0x10]);
  assert.equal(replay(record,corrected,{inferFlags:true,delta:24}).records[0].completed,false);
  const noPixels=replay(record,apis,{adapter:true,inferFlags:true});
  assert.equal(noPixels.accepted,false);
  assert.equal(noPixels.observer.records[0].completed,true);
  assert.equal(noPixels.records[0].state,'rejected');
  assert.equal(noPixels.records[0].samples,undefined);
  assert.match(noPixels.records[0].error,/Unavailable captured memory/);
}
console.log('PASS 24 captured CPU/partial-stack replays: old ABI negative, absent sixth-word rejection, code-inferred flags ABI pairing, wrong cleanup rejection, absent pixels remain rejected; 8 original pixel records absent');
