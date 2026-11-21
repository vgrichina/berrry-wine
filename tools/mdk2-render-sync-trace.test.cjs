'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const T=require('./mdk2-render-sync-trace.cjs'),GS=require('../lib/gpu-stream'),G=require('../lib/gpu-stream.generated');
const {makeProducer}=require('../test/gpu-stream-fixture');
function setup(on=true){
  const p=makeProducer(),rows=new SharedArrayBuffer(T.bytes),control=new Int32Array(new SharedArrayBuffer(4));control[0]=on?1:0;
  const gs=Object.freeze({...GS,Ring:class extends GS.Ring{}});
  const c={GpuStream:gs,GpuStreamGenerated:G,addEventListener(){},Atomics:Object.create(Atomics),performance,Int32Array,DataView,WeakSet,Proxy};
  vm.runInNewContext('('+T.workerBootstrap+')()',c);
  c.__mdk2GpuTrace.configure({rows,control:control.buffer,memory:{buffer:p.buffer},identity:11,role:2});
  return {p,rows,control,gs:c.GpuStream};
}
test('actual drain wrapper retains exact entry/return and completion header without altering output',()=>{
  const {p,rows,gs}=setup(),seq=p.emit('FENCE',{slot:0}),ring=new gs.Ring(()=>p.buffer,p.header);
  const before=Buffer.from(new Uint8Array(p.buffer)),seen=[];
  gs.drain([ring],{execute(rec){seen.push([rec.name,rec.seq,rec.size]);}});
  const r=T.read(rows);assert.equal(r.lost,0);assert.equal(r.incomplete,false);
  const entry=r.rows.find(r=>r.kind===5),ret=r.rows.find(r=>r.kind===6);
  assert.equal(entry.seq,seq);assert.equal(entry.bytes,seen[0][2]);assert.equal(ret.read_pos,entry.read_pos);assert.equal(ret.done_seq,entry.done_seq);
  assert.equal(ring.doneSeq,seq);assert.equal(ring.readPos,ring.writePos);
  assert(!before.equals(Buffer.from(p.buffer)),'actual drain publishes its ordinary completion');
});
test('observer OFF emits nothing; executor throws the exact original error and normal drain error code survives',()=>{
  const {p,rows,gs,control}=setup(false);p.emit('FENCE',{slot:0});const ring=new gs.Ring(()=>p.buffer,p.header),error=Error('same executor error');
  assert.throws(()=>gs.drain([ring],{execute(){throw error;}}),e=>e===error);assert.equal(T.read(rows).end,0);assert.equal(ring.errorCode,GS.ERR.EXECUTOR);
  control[0]=1;assert.throws(()=>gs.drain([ring],{execute(){}}));assert(T.read(rows).rows.some(r=>r.kind===10));
});
test('wrong source/module/role/identity and retired worker cannot qualify; overwritten and torn rows fail completeness',()=>{
  const pin={identity:1,role:2,source:'source',module:'module'};assert(T.validateIdentity(pin,pin));
  for(const delta of [{source:'wrong'},{module:'wrong'},{role:1},{identity:2},{retired:true},{module:null}])assert.throws(()=>T.validateIdentity({...pin,...delta},pin));
  const b=new SharedArrayBuffer(T.bytes),v=new Int32Array(b);v[0]=T.capacity+2;
  const r=T.read(b);assert.equal(r.lost,2);assert(r.incomplete);
  v[0]=1;v[T.header]=1;assert(T.read(b).incomplete,'missing terminal stamp is not a completed row');
});
test('wrapped position snapshot treats eight-byte WRAP as having no sequence',()=>{
  const {p,rows,gs}=setup();const ring=new gs.Ring(()=>p.buffer,p.header),rb=ring.ringBytes;
  ring.store('read_pos',rb-8);ring.store('write_pos',rb+24);
  const dv=new DataView(p.buffer);dv.setUint16(ring.ringData+rb-8,GS.OP.WRAP,true);dv.setUint32(ring.ringData+rb-4,8,true);
  // FENCE is 24 bytes; the consumer skips the WRAP ordinarily.
  dv.setUint16(ring.ringData,GS.OP.FENCE,true);dv.setUint32(ring.ringData+4,24,true);dv.setUint32(ring.ringData+8,0xffffffff,true);dv.setUint32(ring.ringData+12,0,true);
  gs.drain([ring],{execute(){}});const records=T.read(rows).rows;
  const entry=records.find(r=>r.kind===3);assert.equal(entry.op,GS.OP.WRAP);assert.equal(entry.bytes,8);assert.equal(entry.seq,0);
  assert.equal(ring.doneSeq,0xffffffff);assert.equal(ring.readPos,rb+24);
});
test('page bootstrap covers CPU through the poll bootstrap and renderer; original URLs/version and per-worker storage remain distinct',()=>{
  class Worker {constructor(url){this.url=url;}postMessage(m){this.message=m;}addEventListener(){}terminate(){return 7;}}
  const c={window:{Worker},location:{href:'http://local/'},URL,SharedArrayBuffer,Int32Array,WeakMap,Proxy,Atomics,console,setInterval(){}};
  vm.runInNewContext('('+T.installPage+')()',c);
  const cpu=new c.window.Worker('/lib/__mdk2_poll_bootstrap.js?v=pin&original=cpu'),render=new c.window.Worker('/lib/d3d-render-worker.js?v=pin');
  cpu.postMessage({t:'init',memory:1,slot:3,endpointIdentity:11});render.postMessage({t:'render-init',memory:1});
  assert.equal(new URL(cpu.url).pathname,'/lib/__mdk2_gpu_bootstrap.js');assert.equal(new URL(cpu.url).searchParams.get('v'),'pin');assert.equal(new URL(cpu.url).searchParams.get('original'),'http://local/lib/__mdk2_poll_bootstrap.js?v=pin&original=cpu');
  assert.equal(cpu.message.mdk2GpuTrace.role,1);assert.equal(render.message.mdk2GpuTrace.role,2);assert.notEqual(cpu.message.mdk2GpuTrace.rows,render.message.mdk2GpuTrace.rows);assert.equal(cpu.terminate(),7);assert(c.window.__mdk2GpuTimeline.summary()[0].retired);c.window.__mdk2GpuTimeline.terminal();
});
test('same-request refusal capture retains bounded exact command and is read only',()=>{
  const p=makeProducer();p.emit('FENCE',{slot:0});const before=Buffer.from(new Uint8Array(p.buffer));
  class Worker {postMessage(m){this.message=m;}addEventListener(){}terminate(){}}
  const c={window:{Worker},location:{href:'http://local/'},URL,SharedArrayBuffer,Int32Array,DataView,WeakMap,Proxy,Atomics,performance,GpuStreamGenerated:G,GpuStream:GS,console,setInterval(){}};
  vm.runInNewContext('('+T.installPage+')()',c);
  const worker=new c.window.Worker('/lib/guest-worker.js');worker.postMessage({t:'init'});const v=new Int32Array(worker.message.mdk2GpuTrace.rows);v[0]=1;v[T.header]=1;v[T.header+6]=p.header;v[T.header+18]=1;
  const capture=c.window.__mdk2GpuTimeline.capture({buffer:p.buffer}),h=capture.headers[0];assert(h.stable);assert.equal(h.command.name,'FENCE');assert.equal(h.command.raw.length,24);assert.equal(h.command.fields.slot,0);assert.equal(h.record.seq,1);assert(before.equals(Buffer.from(p.buffer)));
});
