#!/usr/bin/env node
'use strict';
// Source/JS contract only: real producer, command queue and worker endpoint;
// mock device records RGBA bindings. No native executor or GPU is created.
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {Bridge,DrawProducer} = require('../lib/d3d9-host');
const Worker = require('../lib/d3d9-render-worker');
const {OPCODES: OP,SnapshotState} = require('../lib/d3d-command-stream');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };

function fixture(options = {}) {
  const memory = options.guestMemory || new ArrayBuffer(262144), view = new DataView(memory);
  const desc = 64, program = 1024, record = 40000, texels = 50000, mip = record + 64;
  const set = (p, n) => view.setUint32(p, n, true);
  [7, program, 32000, 2, 2, 1, 4, 1, 30000, 16].forEach((n, i) => set(desc + i * 4, n));
  set(program + 12, 0x42); view.setFloat32(program + 1696, 1, true);
  const texture = (stage, at, bits, width = 64, height = 64) => {
    set(program + 1700 + stage * 4, at);
    for (const [offset, value] of [[12,3],[24,width],[28,height],[32,1],[36,21],
      [64,width],[68,height],[72,width*4],[76,width*height*4],[80,bits],[92,1]]) set(at + offset, value);
  };
  texture(0, record, texels);
  const rgba = [10,20,30,255];
  const fill = (bits, bytes, color) => {
    const dest = new Uint8Array(memory, bits, bytes);
    for (let i = 0; i < bytes; i += 4) dest.set([color[2],color[1],color[0],color[3]], i);
  };
  fill(texels, 16384, rgba);
  const observations = [], commands = [], instances = [];
  class MockDevice {
    constructor() { this.levels = new Map(); this.destroyed = false; instances.push(this); }
    execute(command) {
      const p = command.payload;
      assert.equal(this.destroyed, false, 'no command executes after device destruction');
      if (command.opcode === OP.DRAW) {
        for (const key of p.textureReleases || []) this.levels.delete(key);
        const textures = p.textures.map(texture => texture && texture.levels.map(level => {
          if (level.pixels && level.key) this.levels.set(level.key, level.pixels.slice());
          const pixels = level.key ? this.levels.get(level.key) : level.pixels;
          assert(pixels, 'every queued reference has a definition in its device');
          return {key: level.key, pixels: pixels.slice()};
        }));
        observations.push({deviceId:command.deviceId, generation:command.generation, textures});
      } else if (command.opcode === OP.RESOURCE_RELEASE && p.kind === 'device') this.destroy();
      else if (command.opcode === OP.RESOURCE_UPDATE && p.kind === 'reset') this.levels.clear();
      return {value:1, complete:true};
    }
    destroy() { this.levels.clear(); this.destroyed = true; }
  }
  const endpoint = Worker.create({instance:{exports:{}}, memory:{buffer:memory}, backend:'software',
    options:{SoftwareDevice:MockDevice}});
  let hold = null, serial = Promise.resolve();
  const consumer = {ready:Promise.resolve(), execute(command) {
    commands.push(command);
    const gate = command.opcode === OP.DRAW && hold;
    const result = serial.then(async () => { if (gate) await gate.promise; return endpoint.execute(command); });
    serial = result.then(() => {}, () => {});
    return result;
  }, cancel() { hold?.resolve(); endpoint.destroy(); }};
  const bridge = new Bridge({backend:'software',createSoftwareWorker:()=>consumer,
    getMemory:()=>memory,guestToWasm:p=>p,...options});
  const draw = () => bridge.call(0x30001, desc, 0);
  const drain = async () => {
    for (const entry of bridge.devices.values()) await entry.queue.fence();
    await serial; await tick();
  };
  return {bridge,endpoint,memory,set,desc,program,mip,texels,record,texture,fill,rgba,commands,observations,instances,draw,drain,
    hold() { hold = deferred(); return () => { hold.resolve(); hold = null; }; }};
}
const level = (draw, stage = 0, mip = 0) => draw.textures[stage][mip];
const pixel = (draw, at = 0, stage = 0) => [...level(draw, stage).pixels.slice(at, at + 4)];

test('snapshot channel preserves full epochs and retirement cannot be reopened',()=>{
  const state=new SnapshotState(7,Number.MAX_SAFE_INTEGER);
  assert.equal(SnapshotState.read(state.channel),null);
  state.update(0x100000001,true);
  assert.deepEqual(SnapshotState.read(state.channel),{deviceId:7,generation:Number.MAX_SAFE_INTEGER,snapshotEpoch:0x100000001});
  state.update(Number.MAX_SAFE_INTEGER,false);
  assert.equal(SnapshotState.read(state.channel),null);
  assert.throws(()=>state.update(1,true),/backwards/);
  state.update(Number.MAX_SAFE_INTEGER,true);
  assert.equal(SnapshotState.read(state.channel).snapshotEpoch,Number.MAX_SAFE_INTEGER);
  state.close();assert.equal(state.update(Number.MAX_SAFE_INTEGER,true),false);
  assert.equal(SnapshotState.read(state.channel),null);
  assert.throws(()=>SnapshotState.read({...state.channel,buffer:new ArrayBuffer(8)}),/invalid/);
});

test('real Worker sees reset finalization and permanent retirement without per-read RPC',async()=>{
  const {Worker:Thread}=require('node:worker_threads');
  const {once}=require('node:events');
  const f=fixture();let worker,resume;
  try {
    assert.equal(f.draw(),1);await f.drain();
    const channel=f.bridge.snapshotState(7);
    worker=new Thread(`
      const {parentPort,workerData:d}=require('node:worker_threads');
      const {SnapshotState}=require(d.module);
      parentPort.on('message',()=>parentPort.postMessage(SnapshotState.read(d.channel)));
    `,{eval:true,workerData:{module:require.resolve('../lib/d3d-command-stream'),channel}});
    const read=async()=>{const result=once(worker,'message');worker.postMessage('read');return (await result)[0];};
    const old=await read();assert.equal(old.snapshotEpoch,1);
    resume=f.hold();assert.equal(f.draw(),1);
    f.set(232,2);f.set(236,2);f.set(240,22);
    const reset=f.bridge.call(0x30009,200,7);assert(reset<=-2);
    assert.equal(await read(),null,'reset closes channel before queued work drains');
    resume();resume=null;await f.bridge.wait(reset);
    assert.equal(await read(),null,'renderer completion alone cannot validate native state');
    assert.equal(f.bridge.call(0x30007,0,reset),1);
    assert.deepEqual(await read(),{...old,snapshotEpoch:2});
    resume=f.hold();assert.equal(f.draw(),1);
    const release=f.bridge.call(0x30004,0,7);assert(release<=-2);
    assert.equal(await read(),null,'release invalidates before destroying queued resources');
    resume();resume=null;await f.bridge.wait(release);
    assert.equal(f.bridge.call(0x30007,0,release),1);
    assert.equal(f.draw(),1);await f.drain();
    const replacement=f.bridge.snapshotState(7),current=SnapshotState.read(replacement);
    assert.equal(current.generation,old.generation+1);
    assert.notEqual(replacement.buffer,channel.buffer);
    assert.equal(await read(),null,'reusing native device address cannot revive old channel');
    await f.bridge.close();assert.equal(SnapshotState.read(replacement),null);
  }finally{resume?.();await worker?.terminate();await f.bridge.close();}
});

test('asynchronous render failure invalidates the producer channel',async()=>{
  const f=fixture();
  try{
    assert.equal(f.draw(),1);await f.drain();
    const channel=f.bridge.snapshotState(7);
    assert(SnapshotState.read(channel));
    f.instances[0].execute=()=>{throw new Error('injected renderer failure');};
    assert.equal(f.draw(),1,'deferred submission precedes renderer failure');
    await assert.rejects(f.drain(),/injected renderer failure/);
    await tick();
    assert.equal(SnapshotState.read(channel),null);
    assert.equal(f.bridge.devices.get(7).snapshotReady,false);
  }finally{await f.bridge.close();}
});

test('production RPC and WorkerLink deliver state once per device and Worker incarnation',async()=>{
  const {Worker:Thread}=require('node:worker_threads');
  const RPC=require('../lib/guest-rpc'),{WorkerLink}=require('../lib/guest-thread-host');
  const memory={buffer:new SharedArrayBuffer(RPC.RPC_BASE+RPC.RPC_STRIDE*RPC.RPC_MAX_SLOTS)};
  const f=fixture({guestMemory:memory.buffer}),publication=new SharedArrayBuffer(64+128);
  const sigs={gpu_gl_call:{params:['i32','i32','i32'],results:['i32']}};
  let posts=0,rpcs=0,worker,link,sequence=0,holdPublications=false;
  const pending=new Map();
  const broker=RPC.createMainBroker(memory,{
    gpu_gl_call:(...args)=>{rpcs++;return f.bridge.call(...args);},
    gpu_d3d9_snapshot_state:id=>f.bridge.snapshotState(id),
    gpu_d3d9_snapshot:command=>f.bridge.submitSnapshot(command),
  },sigs,{renderPublication:publication});
  const start=()=>{
    link=new WorkerLink({slot:1,memory,sigs,broker,renderPublication:publication});
    worker=new Thread(`
      const {parentPort,workerData:d}=require('node:worker_threads');
      const RPC=require(d.module);
      const built=RPC.createWorkerImports(d.memory,d.sigs,m=>parentPort.postMessage(m),
        {slot:1,renderPublication:d.publication,guestToWasm:p=>p,
          getExports:()=>({d3d_state_guard_held:()=>guardHeld})});
      let guardHeld=true;
      parentPort.on('message',m=>{
        if(m.t==='renderSnapshotState'){
          if(m.endpointIdentity===d.identity)built.receiveSnapshotState(m.channel);
          return;
        }
        try {
          guardHeld=m.t!=='unguardedClear';
          const value=m.t==='draw'?built.imports.host.gpu_gl_call(0x30001,d.desc,0):
            m.t==='clear'||m.t==='unguardedClear'?built.imports.host.gpu_gl_call(0x30003,d.desc,0):built.readSnapshotState(7);
          parentPort.postMessage({t:'result',id:m.id,value});
        }catch(e){parentPort.postMessage({t:'result',id:m.id,error:e.stack});}
      });
    `,{eval:true,workerData:{module:require.resolve('../lib/guest-rpc'),memory,sigs,publication,
      desc:f.desc,identity:link.endpointIdentity}});
    const active=link;
    link.worker={postMessage:m=>{posts++;worker.postMessage(m);}};
    worker.on('message',m=>{
      if(m.t==='rpc'||m.t==='renderSnapshot'||m.t==='renderPublished'&&!holdPublications)active._onMessage(m);
      else if(m.t==='result'){
        const p=pending.get(m.id);if(!p)return;
        pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error)):p.resolve(m.value);
      }
    });
  };
  const ask=t=>new Promise((resolve,reject)=>{
    const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('state transport timed out'));},5000);
    pending.set(id,{resolve,reject,timer});worker.postMessage({t,id});
  });
  try {
    start();assert.equal(await ask('read'),null);
    assert.equal(await ask('draw'),1);await f.drain();
    const original=await ask('read'),oldChannel=f.bridge.snapshotState(7);
    assert.equal(original.deviceId,7);assert.equal(posts,1);
    assert.equal(await ask('draw'),1);await f.drain();assert.equal(posts,1,'ordinary draws do not repost');
    const calls=rpcs;assert.deepEqual(await ask('read'),original);assert.equal(rpcs,calls,'read stays local');
    const saved=new Uint8Array(memory.buffer,f.desc,64).slice();
    f.set(f.desc+40,72000);f.set(72000+256+174*4,1);
    f.set(f.program+22016,1);[1,0,2,2].forEach((v,i)=>f.set(f.program+22000+i*4,v));
    f.set(f.desc+44,1);f.set(f.desc+48,0xff123456);f.set(f.desc+56,1);f.set(f.desc+60,80000);
    [-10,-10,2,2].forEach((v,i)=>f.set(80000+i*4,v));
    const expected=require('../lib/render-clear').captureNative({memory:memory.buffer,guestToWasm:p=>p,address:f.desc});
    holdPublications=true;
    assert.equal(await ask('clear'),1);assert.equal(rpcs,calls,'guarded clear bypasses page RPC');
    f.set(f.desc+48,0xffabcdef);f.set(80000,1);
    holdPublications=false;await broker.drainPublications();await f.drain();
    assert.deepEqual(f.commands.filter(c=>c.opcode===OP.CLEAR).at(-1).payload,expected,'consumer sees owned pre-mutation clear');
    assert.deepEqual(expected.rects,[[1,0,2,2]]);
    assert.equal(await ask('unguardedClear'),1);await f.drain();
    assert.equal(rpcs,calls+1,'missing native guard retains synchronous capture');
    const color=90000;
    for(const [offset,value] of [[8,7],[12,0xd3d90006],[20,2],[24,2],[28,21],[36,99],[40,91000],[48,8],[52,16]])f.set(color+offset,value);
    f.set(f.program+22020,color);
    assert.equal(await ask('clear'),1);await f.drain();
    assert.equal(rpcs,calls+2,'named color storage retains synchronous resource resolution');
    assert.equal(f.commands.filter(c=>c.opcode===OP.CLEAR).at(-1).payload.colorAttachment.id,99);
    f.set(f.program+22020,0);f.set(f.desc+56,65537);
    assert.equal(await ask('clear'),-1,'invalid clear retains broker error result');
    assert.equal(rpcs,calls+3);
    new Uint8Array(memory.buffer,f.desc,64).set(saved);f.set(f.program+22016,0);f.set(72000+256+174*4,0);
    f.set(232,2);f.set(236,2);f.set(240,22);
    const reset=f.bridge.call(0x30009,200,7);await f.bridge.wait(reset);
    assert.equal(await ask('read'),null);assert.equal(f.bridge._poll(reset),1);
    assert.equal((await ask('read')).snapshotEpoch,original.snapshotEpoch+1);
    assert.equal(posts,1,'reset propagates through shared state');
    const release=f.bridge.call(0x30004,0,7);await f.bridge.wait(release);assert.equal(f.bridge._poll(release),1);
    assert.equal(await ask('read'),null);
    assert.equal(await ask('draw'),1);await f.drain();
    const replacement=await ask('read');assert.equal(replacement.generation,original.generation+1);
    assert.equal(posts,2);
    worker.postMessage({t:'renderSnapshotState',endpointIdentity:link.endpointIdentity,channel:oldChannel});
    assert.deepEqual(await ask('read'),replacement,'late old generation cannot replace cache');
    await worker.terminate();start();
    assert.equal(await ask('draw'),1);await f.drain();
    assert.deepEqual(await ask('read'),replacement);assert.equal(posts,3,'reused routing slot gets a new delivery');
    new (require('../lib/render-worker').PublicationQueue)(publication).fail();
    await assert.rejects(ask('read'),/publication queue closed or failed/);
  }finally{
    await worker?.terminate();for(const p of pending.values())clearTimeout(p.timer);
    await f.bridge.close();
  }
});

test('standalone producer resolves render-target aliases explicitly and owns their metadata',async()=>{
  const f=fixture(),alias=70000;
  try {
    f.set(f.record+56,alias);f.set(alias+72,f.record);f.set(alias+76,0);
    const producer=new DrawProducer({getMemory:()=>f.memory,guestToWasm:p=>p});
    const context={entry:{resident:new Map(),residentBytes:0},address:f.desc,
      program:f.program,id:7,width:2,height:2,depthAttachment:null};
    assert.throws(()=>producer.captureDraw(context),/color resource resolver required/);
    const resource={id:91,width:64,height:64,format:21},seen=[];
    const resolveColor=p=>{seen.push(p);return resource;};
    const {payload}=producer.captureDraw({...context,resolveColor});
    assert.deepEqual(seen,[alias]);
    assert.deepEqual(payload.textures[0].levels[0].resource,resource);
    resource.width=1;
    assert.equal(payload.textures[0].levels[0].resource.width,64,'snapshot owns resolved metadata');
    assert.throws(()=>producer.captureDraw({...context,resolveColor}),/invalid texture color alias/);
    resource.width=64;
    assert.throws(()=>producer.captureDraw({...context,resolveColor,colorAttachment:{id:91}}),/feedback/);
    f.set(f.mip+20,1);
    assert.throws(()=>producer.captureDraw({...context,resolveColor}),/locked texture/);
  } finally {await f.bridge.close();}
});

test('producer and texture identities fail before numerical reuse',()=>{
  for(const producerId of [-1,0x100000000,1.5,NaN,'1'])
    assert.throws(()=>new DrawProducer({producerId}),/invalid.*identity/);
  const producer=new DrawProducer({producerId:0xffffffff});
  producer._textureSerial=Number.MAX_SAFE_INTEGER;
  assert.throws(()=>producer._rememberTexture(1,{pixels:new Uint8Array(4)},new Uint8Array(4)),/identity exhausted/);
});

test('owned draw crosses publication broker with backpressure and device-generation checks',async()=>{
  const RPC=require('../lib/guest-rpc'),{PublicationQueue}=require('../lib/render-worker');
  const {copyPayload}=require('../lib/d3d-command-stream');
  const f=fixture({maxDeferredCommands:0}),q=new PublicationQueue(new SharedArrayBuffer(64+128));
  const rpcMemory={buffer:new SharedArrayBuffer(RPC.RPC_BASE+RPC.RPC_STRIDE*RPC.RPC_MAX_SLOTS)};
  const broker=RPC.createMainBroker(rpcMemory,{gpu_d3d9_snapshot:command=>f.bridge.submitSnapshot(command)},
    {},{renderPublication:q.buffer});
  let resume;
  try {
    const initial=f.draw();await f.drain();
    if(initial<=-2){await f.bridge.wait(initial);assert.equal(f.bridge._poll(initial),1);}
    const entry=f.bridge.devices.get(7),producer=new DrawProducer({producerId:q.allocateProducerId(),
      getMemory:()=>f.memory,guestToWasm:p=>p});
    const captured=producer.captureDraw({entry:{resident:new Map(),residentBytes:0},
      address:f.desc,program:f.program,id:7,width:2,height:2,depthAttachment:null});
    const command={deviceId:7,generation:entry.queue.generation,snapshotEpoch:entry.snapshotEpoch,
      opcode:OP.DRAW,payload:captured.payload};
    const snapshot=copyPayload(command,64*1024*1024);
    assert(snapshot.bytes>q.capacity,'owned payload is larger than the ring');
    resume=f.hold();
    q.publishSnapshot(4,0,snapshot,message=>broker.receiveRenderSnapshot(structuredClone(message)),()=>{});
    f.fill(f.texels,16384,[99,88,77,255]);
    const draining=broker.drainPublications();await tick();
    assert(Atomics.load(q.control,10)>0,'parked neutral admission retains payload credit');
    assert.equal(f.observations.length,1);
    resume();resume=null;await draining;await f.drain();
    assert.deepEqual(pixel(f.observations[1]),f.rgba,'decoder receives captured bytes');
    assert.equal(Atomics.load(q.control,10),0);
    assert.equal(f.bridge.requests.size,0,'adapter consumes its backpressure token');
    await assert.rejects(f.bridge.submitSnapshot({...command,generation:command.generation+1}),/stale/);
    await assert.rejects(f.bridge.submitSnapshot({...command,opcode:OP.RESOURCE_RELEASE}),/unsupported/);
    assert.equal(f.observations.length,2,'rejected identity/operation never reaches executor');
  }finally{resume?.();broker.failPublications();await f.bridge.close();}
});

test('independent producer incarnations cannot alias resident textures on one device', async () => {
  const {Worker:Thread}=require('node:worker_threads');
  const {PublicationQueue}=require('../lib/render-worker');
  const queue=new PublicationQueue(),f=fixture(),workers=[];
  async function capture(color){
    const memory=new SharedArrayBuffer(f.memory.byteLength);
    new Uint8Array(memory).set(new Uint8Array(f.memory));
    for(let at=f.texels;at<f.texels+16384;at+=4)new Uint8Array(memory,at,4).set([color[2],color[1],color[0],255]);
    const worker=new Thread(`
      const {parentPort,workerData:d}=require('node:worker_threads');
      const {PublicationQueue}=require(d.transport),{DrawProducer}=require(d.module);
      try {
        const id=new PublicationQueue(d.queue).allocateProducerId();
        const producer=new DrawProducer({producerId:id,getMemory:()=>d.memory,guestToWasm:p=>p});
        const {payload}=producer.captureDraw({entry:{resident:new Map(),residentBytes:0},
          address:d.desc,program:d.program,id:7,width:2,height:2,depthAttachment:null});
        parentPort.postMessage({id,payload});
      } catch(e){parentPort.postMessage({error:e.stack});}
    `,{eval:true,workerData:{module:require.resolve('../lib/d3d9-host'),transport:require.resolve('../lib/render-worker'),
      queue:queue.buffer,memory,desc:f.desc,program:f.program}});
    workers.push(worker);
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('producer timed out')),5000);
      worker.on('error',error=>{clearTimeout(timer);reject(error);});
      worker.on('message',value=>{clearTimeout(timer);value.error?reject(Error(value.error)):resolve(value);});
    });
  }
  try {
    f.draw();await f.drain();
    const pair=await Promise.all([capture([220,10,20]),capture([30,210,40])]);
    await Promise.all(workers.map(worker=>worker.terminate()));
    const replacement=await capture([50,60,200]);
    const all=[...pair,replacement],entry=f.bridge.devices.get(7);
    assert.equal(new Set(all.map(item=>item.id)).size,3,'retired worker ID is never reassigned');
    assert.equal(new Set(all.map(item=>item.payload.textures[0].levels[0].key)).size,3);
    for(const item of all)f.bridge._issue(entry,OP.DRAW,item.payload);
    const reference=structuredClone(pair[0].payload);
    delete reference.textures[0].levels[0].pixels;
    delete reference.textures[0].pixels;
    f.bridge._issue(entry,OP.DRAW,reference);await f.drain();
    assert.deepEqual(f.observations.slice(1).map(draw=>pixel(draw)),
      [[220,10,20,255],[30,210,40,255],[50,60,200,255],[220,10,20,255]],
      'later producers cannot overwrite the first producer reference');
  } finally {await Promise.all(workers.map(worker=>worker.terminate()));await f.bridge.close();}
});

test('standalone worker producer owns vertices, constants and textures before guest reuse', async () => {
  const {Worker:Thread}=require('node:worker_threads');
  const f=fixture({guestMemory:new SharedArrayBuffer(262144)});
  const view=new DataView(f.memory);
  new Uint8Array(f.memory,30000,48).fill(0x5a);
  view.setFloat32(f.program+16,1.25,true);
  const worker=new Thread(`
    const {parentPort,workerData:d}=require('node:worker_threads');
    const {DrawProducer}=require(d.module);
    const producer=new DrawProducer({getMemory:()=>d.memory,guestToWasm:p=>p,
      createCanvas(){throw Error('producer attempted rendering');}});
    const entry={resident:new Map(),residentBytes:0};
    const context={entry,address:d.desc,program:d.program,id:7,width:2,height:2,depthAttachment:null};
    try {
      const first=producer.captureDraw(context);
      parentPort.postMessage({captured:true});
      parentPort.once('message',()=>{
        try { const next=producer.captureDraw(context);
          parentPort.postMessage({first:first.payload,next:next.payload});
        } catch(e) { parentPort.postMessage({error:e.stack}); }
      });
    } catch(e) { parentPort.postMessage({error:e.stack}); }
  `,{eval:true,workerData:{module:require.resolve('../lib/d3d9-host'),memory:f.memory,desc:f.desc,program:f.program}});
  try {
    const result=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('producer snapshot timed out')),5000);
      worker.on('error',error=>{clearTimeout(timer);reject(error);});
      worker.on('message',message=>{
        if(message.error){clearTimeout(timer);reject(Error(message.error));return;}
        if(message.captured){
          new Uint8Array(f.memory,30000,48).fill(0x3c);
          view.setFloat32(f.program+16,2.5,true);
          f.fill(f.texels,16384,[90,80,70,255]);f.set(f.mip+28,2);
          worker.postMessage('capture-again');
        } else {clearTimeout(timer);resolve(message);}
      });
    });
    assert.equal(result.first.vertices[0],0x5a);
    assert.equal(result.next.vertices[0],0x3c);
    assert.equal(result.first.vertexConstants[0],1.25);
    assert.equal(result.next.vertexConstants[0],2.5);
    assert.deepEqual([...result.first.textures[0].levels[0].pixels.slice(0,4)],f.rgba);
    assert.deepEqual([...result.next.textures[0].levels[0].pixels.slice(0,4)],[90,80,70,255]);
  } finally {await worker.terminate();await f.bridge.close();}
});

test('replacement at the same mip address cannot inherit a sparse fingerprint collision', async () => {
  const f = fixture();
  try {
    assert.equal(f.draw(), 1); await f.drain();
    const before = f.observations[0];
    // Old fingerprint: 32 bytes every 256 bytes. Offset 40 is unsampled.
    // A released record can be reallocated with the same dirty sequence and
    // bits pointer; a new allocation changes the device texture generation.
    new Uint8Array(f.memory, f.texels + 40, 4).set([90,80,70,255]);
    f.set(f.program + 25596, 1);
    assert.equal(f.draw(), 1); await f.drain();
    assert.deepEqual(pixel(f.observations[1], 40), [70,80,90,255]);
    assert.notEqual(level(f.observations[1]).key, level(before).key);
    assert.deepEqual(pixel(before, 40), f.rgba, 'published old definition stays immutable');
  } finally { await f.bridge.close(); }
});

test('queued update and device release retain both original byte snapshots in order', async () => {
  const f = fixture();
  try {
    const resume = f.hold();
    assert.equal(f.draw(), 1);
    f.fill(f.texels, 16384, [90,80,70,255]); f.set(f.mip + 28, 2);
    assert.equal(f.draw(), 1);
    // Model guest resource release: unbind and reclaim its bytes before either
    // draw reaches the device. No CPU Lock or native lifetime is simulated.
    f.set(f.program + 1700, 0); new Uint8Array(f.memory, f.texels, 16384).fill(0);
    const token = f.bridge.call(0x30004, 0, 7);
    assert(token <= -2); await tick();
    assert.equal(f.observations.length, 0);
    assert.equal(f.instances[0].destroyed, false, 'release is behind the held draws');
    resume(); await f.bridge.wait(token);
    assert.equal(f.bridge.call(0x30007, 0, token), 1);
    assert.deepEqual(f.observations.map(d => pixel(d)), [f.rgba,[90,80,70,255]]);
    assert.notEqual(level(f.observations[0]).key, level(f.observations[1]).key);
    assert.equal(f.instances[0].destroyed, true);
  } finally { await f.bridge.close(); }
});

test('release closes admission for fences and resource operations before destruction',async()=>{
  const f=fixture();let resume;
  try{
    assert.equal(f.draw(),1);await f.drain();
    resume=f.hold();assert.equal(f.draw(),1);
    const entry=f.bridge.devices.get(7),token=f.bridge.call(0x30004,0,7);
    assert(token<=-2);assert.equal(entry.releasing,true);
    const submitted=entry.queue.submitted,requests=f.bridge.requests.size;
    assert.equal(f.bridge.call(0x30006,0,7),0,'event fence refuses admission after release');
    assert.equal(f.bridge.call(0x30008,200,7),-1,'depth retirement cannot follow device retirement');
    assert.equal(entry.queue.submitted,submitted,'refusal neither queues nor poisons work');
    assert.equal(f.bridge.requests.size,requests,'refusal creates no completion token');
    assert.equal(entry.queue.error,null);
    assert.equal(f.instances[0].destroyed,false,'older draw still owns the endpoint');
    resume();resume=null;await f.bridge.wait(token);
    assert.equal(f.bridge.call(0x30007,0,token),1,'already admitted release remains consumable');
    assert.equal(f.instances[0].destroyed,true);
    assert.equal(f.bridge.devices.has(7),false);
    assert.equal(f.bridge.requests.size,0);
    assert.throws(()=>f.bridge._submit(entry,OP.FENCE,{}),/retired|released/,'retained entry cannot submit after destruction');
  }finally{resume?.();await f.bridge.close();}
});

test('budget rejection publishes no partial definition or retirement and retry is complete', async () => {
  const f = fixture({commandCapacityBytes:49152, maxResidentTextureBytes:16384});
  try {
    assert.equal(f.draw(), 1); await f.drain();
    const entry = f.bridge.devices.get(7), submitted = entry.queue.submitted;
    const oldKey = level(f.observations[0]).key;
    // First stage produces a new definition; second stage exceeds the snapshot
    // budget. No DRAW, partial release or new key may reach the consumer.
    f.fill(f.texels, 16384, [90,80,70,255]); f.set(f.mip + 28, 2);
    f.texture(1, 100000, 120000, 128, 128);
    assert.equal(f.draw(), -1);
    assert.match(String(f.bridge.lastError), /snapshot exceeds command byte budget/);
    assert.equal(entry.queue.submitted, submitted);
    assert.equal(f.observations.length, 1);
    assert(f.instances[0].levels.has(oldKey), 'failed admission does not retire a live definition');
    assert.equal(entry.queue.error, null, 'builder rejection does not poison the queue');
    f.set(f.program + 1704, 0);
    assert.equal(f.draw(), 1); await f.drain();
    assert.deepEqual(pixel(f.observations[1]), [90,80,70,255]);
    assert.deepEqual(pixel(f.observations[0]), f.rgba);
    assert(!f.instances[0].levels.has(oldKey), 'accepted retry retires the stale key');
    assert.equal(entry.residentBytes, 16384);
  } finally { await f.bridge.close(); }
});

test('device incarnation and mip subresources have distinct references', async () => {
  const f = fixture();
  try {
    // Two mips, independently decoded, with the same dirty sequence.
    f.set(f.record + 32, 2);
    for (const [offset,value] of [[0,1],[4,1],[8,4],[12,4],[16,90000],[28,1]]) f.set(f.mip + 32 + offset, value);
    f.fill(90000, 4, [1,2,3,255]);
    assert.equal(f.draw(), 1); await f.drain();
    const before = f.observations[0];
    assert.notEqual(level(before,0,0).key, level(before,0,1).key);
    assert.deepEqual([...level(before,0,1).pixels], [1,2,3,255]);
    const token = f.bridge.call(0x30004, 0, 7);
    await f.bridge.wait(token); assert.equal(f.bridge.call(0x30007,0,token), 1);
    // Same guest ID and program storage, new endpoint generation.
    assert.equal(f.draw(), 1); await f.drain();
    const after = f.observations[1];
    assert.equal(after.deviceId, before.deviceId);
    assert.equal(after.generation, before.generation + 1);
    assert.notEqual(level(after).key, level(before).key);
    assert.deepEqual(pixel(after), f.rgba);
    assert.throws(() => f.endpoint.execute({deviceId:7,generation:before.generation,
      opcode:OP.DRAW,payload:{}}), /missing\/stale D3D9 worker device/);
  } finally { await f.bridge.close(); }
});

test('unchanged identity sends a reference without decoding or publishing RGBA again', async () => {
  const f = fixture();
  try {
    assert.equal(f.draw(), 1); await f.drain();
    const cached = f.bridge._textureSnapshots.get(f.mip);
    assert.equal(f.draw(), 1); await f.drain();
    assert.equal(f.bridge._textureSnapshots.get(f.mip), cached);
    const wire = f.commands.filter(c => c.opcode === OP.DRAW);
    assert.equal(wire[1].payload.textures[0].levels[0].pixels, undefined);
    assert.equal(level(f.observations[0]).key, level(f.observations[1]).key);
    assert.deepEqual(pixel(f.observations[1]), f.rgba);
  } finally { await f.bridge.close(); }
});

test('reset retires consumer residency and the next draw republishes its definition', async () => {
  const f = fixture();
  try {
    assert.equal(f.draw(), 1); await f.drain();
    const reset = 200;
    f.set(reset + 32, 2); f.set(reset + 36, 2); f.set(reset + 40, 22);
    const token = f.bridge.call(0x30009, reset, 7);
    assert(token <= -2); await f.bridge.wait(token);
    assert.equal(f.bridge.call(0x30007, 0, token), 1);
    assert.equal(f.instances[0].levels.size, 0);
    assert.equal(f.bridge.devices.get(7).residentBytes, 0);
    assert.equal(f.draw(), 1); await f.drain();
    const wire = f.commands.filter(c => c.opcode === OP.DRAW);
    assert(wire[1].payload.textures[0].levels[0].pixels instanceof Uint8Array);
    assert.deepEqual(pixel(f.observations[1]), f.rgba);
  } finally { await f.bridge.close(); }
});

test('reset rejects captured snapshots until finalization and never revives an old epoch', async () => {
  const f=fixture();let resume;
  try {
    assert.equal(f.draw(),1);await f.drain();
    const entry=f.bridge.devices.get(7);
    const producer=new DrawProducer({producerId:1,getMemory:()=>f.memory,guestToWasm:p=>p});
    const {payload}=producer.captureDraw({entry:{resident:new Map(),residentBytes:0},
      address:f.desc,program:f.program,id:7,width:2,height:2,depthAttachment:null});
    const old={deviceId:7,generation:entry.queue.generation,snapshotEpoch:entry.snapshotEpoch,opcode:OP.DRAW,payload};
    resume=f.hold();assert.equal(f.draw(),1);
    const reset=200;f.set(reset+32,2);f.set(reset+36,2);f.set(reset+40,22);
    const token=f.bridge.call(0x30009,reset,7);assert(token<=-2);
    const fresh={...old,snapshotEpoch:entry.snapshotEpoch};
    assert.equal(fresh.snapshotEpoch,old.snapshotEpoch+1);
    await assert.rejects(f.bridge.submitSnapshot(old),/stale/);
    await assert.rejects(f.bridge.submitSnapshot(fresh),/stale/);
    assert.equal(f.bridge.call(0x30009,reset,7),-1,'overlapping reset refused');
    assert.equal(entry.snapshotEpoch,fresh.snapshotEpoch);
    resume();resume=null;await f.bridge.wait(token);
    await assert.rejects(f.bridge.submitSnapshot(fresh),/stale/,'completion alone does not finalize residency');
    assert.equal(f.bridge.call(0x30007,0,token),1);
    await assert.rejects(f.bridge.submitSnapshot(old),/stale/);
    await assert.rejects(f.bridge.submitSnapshot({...fresh,snapshotEpoch:undefined}),/stale/);
    assert.equal(await f.bridge.submitSnapshot(fresh),1);await f.drain();
    assert.deepEqual(pixel(f.observations.at(-1)),f.rgba);
  }finally{resume?.();await f.bridge.close();}
});

test('failed reset keeps snapshots closed but permits a successful reset retry',async()=>{
  const f=fixture();
  try{
    assert.equal(f.draw(),1);await f.drain();
    const entry=f.bridge.devices.get(7),submit=f.bridge._submit;
    const channel=f.bridge.snapshotState(7);
    f.bridge._submit=function(e,op,p){
      if(p.kind==='reset')return Promise.reject(new Error('reset failed'));
      return submit.call(this,e,op,p);
    };
    const token=f.bridge.call(0x30009,200,7);assert(token<=-2);
    await f.bridge.wait(token);assert.equal(f.bridge.call(0x30007,0,token),-1);
    assert.equal(SnapshotState.read(channel),null,'failed reset leaves producer channel unavailable');
    assert.equal(entry.resetting,false);
    const failed={deviceId:7,generation:entry.queue.generation,
      snapshotEpoch:entry.snapshotEpoch,opcode:OP.CLEAR,payload:{}};
    await assert.rejects(f.bridge.submitSnapshot(failed),/stale/);
    f.bridge._submit=submit;
    f.set(232,2);f.set(236,2);f.set(240,22);
    const retry=f.bridge.call(0x30009,200,7);assert(retry<=-2);
    await f.bridge.wait(retry);assert.equal(f.bridge.call(0x30007,0,retry),1);
    assert.equal(entry.snapshotReady,true);
    assert.equal(SnapshotState.read(channel).snapshotEpoch,entry.snapshotEpoch);
    assert.equal(entry.snapshotEpoch,failed.snapshotEpoch+1);
    await assert.rejects(f.bridge.submitSnapshot(failed),/stale/);
    assert.equal(await f.bridge.submitSnapshot({...failed,snapshotEpoch:entry.snapshotEpoch}),1);
    await f.drain();
  }finally{await f.bridge.close();}
});
