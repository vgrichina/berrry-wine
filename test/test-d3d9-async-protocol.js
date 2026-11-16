#!/usr/bin/env node
'use strict';
// Frontend continuation protocol only; production WAT/Worker pixel parity is
// covered separately by test-d3d9-software-worker and software-bridge.
const assert = require('assert');
const {Bridge} = require('../lib/d3d9-host');
require('./helpers/wat-texture-decoder').installStandalone(); // slice 9.1: texture uploads decode in WAT
const {OPCODES:OP} = require('../lib/d3d-command-stream');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(options={}) {
  const memory=new ArrayBuffer(65536),v=new DataView(memory),commands=[],gates=[];
  const desc=64,program=1024,vertices=30000,target=32000;
  const set=(p,n)=>v.setUint32(p,n,true);
  [7,program,target,2,2,1,4,1,vertices,16].forEach((n,i)=>set(desc+i*4,n));
  set(program+12,0x42);v.setFloat32(program+1696,1,true);
  set(program+21784,0x80000000); // isolate worker completion from presentation cadence
  new Uint8Array(memory,vertices,48).fill(0x31);
  const initialized=deferred();
  const consumer={ready:initialized.promise,execute(command){
    commands.push(command);const gate=deferred();gates.push(gate);
    return {completion:gate.promise,value:gate.promise};
  },async cancel(){for(const gate of gates)gate.reject(new Error('cancelled'));}};
  // The continuation protocol below is exercised with DRAW because a draw is
  // the cheapest command to build. A draw no longer fences by default, so the
  // fixture asks for the command-by-command form explicitly; the deferred
  // default has its own section at the end of this file.
  const bridge=new Bridge({backend:'software',createSoftwareWorker:()=>consumer,
    getMemory:()=>memory,guestToWasm:p=>p,maxDeferredCommands:0,...options});
  const advance=async value=>{const gate=gates.shift();assert(gate,'command is executing');gate.resolve(value);await tick();};
  return {bridge,memory,v,commands,gates,initialized,advance,desc,program,vertices,target,consumer};
}
(async()=>{
  const routed=[],imports=require('../lib/host-imports').createHostImports({getMemory:()=>new ArrayBuffer(65536),
    d3d9Bridge:{call:(...args)=>{routed.push(args);return 91;}}}).host;
  for(let opcode=0x30001;opcode<=0x30016;opcode++)assert.strictEqual(imports.gpu_gl_call(opcode,123,456),91);
  assert.deepStrictEqual(routed,Array.from({length:22},(_,i)=>[0x30001+i,123,456]),
    'production import routes depth/reset/query/color private commands, not just the original draw subset');
  const lit=fixture(),write=(p,n)=>lit.v.setUint32(p,n,true),lightNode=50000;
  for(const [id,value] of [[137,1],[139,0xff102030],[141,1],[145,1],[146,2],[147,0],[148,2]])write(256+id*4,value);
  new Float32Array(lit.memory,lit.program+21928,17).set(Array.from({length:17},(_,i)=>i/16));
  write(lit.program+21996,lightNode);write(lightNode+4,0xf1234567);write(lightNode+12,1);write(lightNode+16,3);
  new Float32Array(lit.memory,lightNode+20,25).set(Array.from({length:25},(_,i)=>i/8));
  write(256+174*4,1);[0,1,2,2,1].forEach((v,i)=>write(lit.program+22000+i*4,v));
  const floatWords=Uint32Array.from({length:1024},(_,i)=>i===1023?0x7fc01234:(0x3e800000+i)>>>0);
  const planeWords=Uint32Array.from({length:24},(_,i)=>i===23?0x7fc01234:(0x3f000000+i)>>>0);
  new Uint32Array(lit.memory,lit.program+25244,24).set(planeWords);write(256+152*4,33);
  new Uint32Array(lit.memory,lit.program+16,384).set(floatWords.subarray(0,384));
  new Uint32Array(lit.memory,lit.program+22684,640).set(floatWords.subarray(384));
  const litToken=lit.bridge.call(0x30001,lit.desc,0);assert(litToken<=-2);
  new Uint8Array(lit.memory,lit.program+25244,96).fill(0);write(256+152*4,0);
  new Uint8Array(lit.memory,lit.program+16,1536).fill(0);
  new Uint8Array(lit.memory,lit.program+22684,2560).fill(0);
  new Uint8Array(lit.memory,lightNode,120).fill(0x77);
  new Uint8Array(lit.memory,lit.program+21928,72).fill(0);
  new Uint8Array(lit.memory,lit.program+22000,20).fill(0);
  write(256+174*4,0);
  for(const id of[137,139,141,145,146,147,148])write(256+id*4,0);
  lit.initialized.resolve();await tick();await lit.advance(1);await lit.advance(1);
  const lighting=lit.commands.at(-1).payload.fixedFunction;
  const snapConstants=lit.commands.at(-1).payload.vertexConstants;
  const clip=lit.commands.at(-1).payload.userClipPlanes;
  assert.strictEqual(clip.space,'world');assert.strictEqual(clip.mask,33);
  assert.deepStrictEqual(new Uint32Array(clip.planes.buffer),planeWords,'enabled world planes detach raw bits before guest reuse');
  assert.strictEqual(snapConstants.length,1024);
  assert.deepStrictEqual(new Uint32Array(snapConstants.buffer,snapConstants.byteOffset,1024),floatWords,
    'all 256 VS float constants, including NaN bits, are detached before guest reuse');
  assert.deepStrictEqual(lit.commands.at(-1).payload.scissor,
    {enabled:true,left:0,top:1,right:2,bottom:2},'scissor is immutable across guest reuse');
  assert.strictEqual(lighting.ambientColor,0xff102030);assert.strictEqual(lighting.colorVertex,1);
  assert.deepStrictEqual([lighting.diffuseMaterialSource,lighting.specularMaterialSource,
    lighting.ambientMaterialSource,lighting.emissiveMaterialSource],[1,2,0,2]);
  assert.deepStrictEqual(Array.from(lighting.material.diffuse),[0,1/16,2/16,3/16]);
  assert.deepStrictEqual(Array.from(lighting.material.emissive),[12/16,13/16,14/16,15/16]);
  assert.strictEqual(lighting.material.power,1);
  assert.strictEqual(lighting.lights[0].index,0xf1234567);assert.strictEqual(lighting.lights[0].type,3);
  assert.deepStrictEqual(Array.from(lighting.lights[0].direction),[15/8,16/8,17/8]);
  assert.strictEqual(lighting.lights[0].phi,3);
  await lit.advance(1);await lit.bridge.wait(litToken);assert.strictEqual(lit.bridge.call(0x30007,0,litToken),1);
  await lit.bridge.close();
  const six=fixture(),set=(p,n)=>six.v.setUint32(p,n,true);
  set(six.program+12,0x642);set(six.desc+36,64); // XYZ, diffuse, six float2 UVs
  set(256+143*4,1); // fixture state descriptor is zero; NORMALIZENORMALS
  set(256+142*4,1);
  const fogStates=[[34,0xff123456],[35,0],[140,3],[48,1]];
  for(const [id,value]of fogStates)set(256+id*4,value);
  for(const [id,value]of[[36,.25],[37,.75],[38,.5]])six.v.setFloat32(256+id*4,value,true);
  for(const stage of[4,5]){
    const texture=40000+stage*128,pixels=42000+stage*16;
    set(six.program+21792+(stage-4)*4,texture);
    for(const [offset,value]of[[12,3],[24,1],[28,1],[32,1],[36,21],
      [64,1],[68,1],[72,4],[76,4],[80,pixels]])set(texture+offset,value);
    new Uint8Array(six.memory,pixels,4).set([stage,20,30,255]);
    set(six.program+21800+(stage-4)*64+4,3);
    six.v.setFloat32(six.program+20664+stage*132+28,stage+.5,true);
    set(six.program+20664+stage*132+44,stage);
    set(six.program+20664+stage*132+112,5);
    set(six.program+20664+stage*132+104,3);
    set(six.program+20664+stage*132+108,5);
    six.v.setFloat32(six.program+2068+(stage+2)*64,stage+.125,true);
    six.v.setFloat32(six.vertices+16+stage*8,stage+.25,true);
  }
  const sixToken=six.bridge.call(0x30001,six.desc,0);assert(sixToken<=-2);
  set(256+143*4,0);
  set(256+142*4,0);
  for(const id of[34,35,140,48,36,37,38])set(256+id*4,0);
  for(const stage of[4,5]){
    new Uint8Array(six.memory,42000+stage*16,4).fill(99);
    set(six.program+21792+(stage-4)*4,0);set(six.program+21800+(stage-4)*64+4,1);
    six.v.setFloat32(six.program+20664+stage*132+28,99,true);
    set(six.program+20664+stage*132+44,0);
    set(six.program+20664+stage*132+112,1);
    set(six.program+20664+stage*132+104,1);
    set(six.program+20664+stage*132+108,1);
    six.v.setFloat32(six.program+2068+(stage+2)*64,99,true);
    six.v.setFloat32(six.vertices+16+stage*8,99,true);
  }
  six.initialized.resolve();await tick();await six.advance(1);await six.advance(1);
  const payload=six.commands.at(-1).payload;assert.strictEqual(six.commands.at(-1).opcode,OP.DRAW);
  assert.strictEqual(payload.userClipPlanes,undefined,'disabled equations are not read or submitted');
  assert.strictEqual(payload.fixedFunction.normalizeNormals,1,'normal normalization is snapshotted before guest mutation');
  assert.strictEqual(payload.fixedFunction.localViewer,1,'local viewer is snapshotted before guest mutation');
  for(const [name,value]of Object.entries({fogColor:0xff123456,fogTableMode:0,fogVertexMode:3,
    rangeFog:1,fogStart:.25,fogEnd:.75,fogDensity:.5}))
    assert.strictEqual(payload.fixedFunction[name],value,`${name} is immutable across guest mutation`);
  for(const stage of[4,5]){
    assert.deepStrictEqual(Array.from(payload.textures[stage].pixels),[30,20,stage,255]);
    assert.strictEqual(payload.textures[stage].sampler.addressU,3);
    assert.strictEqual(payload.bumpStates[stage][0],stage+.5);
    assert.strictEqual(payload.fixedFunction.stages[stage].texCoordIndex,stage);
    assert.strictEqual(payload.fixedFunction.stages[stage].resultArg,5);
    assert.strictEqual(payload.fixedFunction.stages[stage].colorArg0,3);
    assert.strictEqual(payload.fixedFunction.stages[stage].alphaArg0,5);
    assert.strictEqual(payload.fixedFunction.stages[stage].transform[0],stage+.125);
    const attribute=payload.attributes.find(a=>a.usage===5&&a.usageIndex===stage);
    assert(attribute);assert.strictEqual(attribute.register,7+stage);
    assert.strictEqual(new DataView(payload.vertices.buffer,payload.vertices.byteOffset).getFloat32(attribute.offset,true),stage+.25);
  }
  await six.advance(1);await six.bridge.wait(sixToken);
  assert.strictEqual(six.bridge.call(0x30007,0,sixToken),1);await six.bridge.close();
  const both=fixture(),put=(p,n)=>both.v.setUint32(p,n,true);
  // Synthetic retained native tails for these known MOV shaders. Real native
  // production/legality is covered by the COM tests; drawing must not compile.
  both.bridge.options.getExports=()=>({d3d_shader_ir_compile(){throw Error('draw reparsed shader');}});
  for(const [offset,p,tokens]of[[0,50000,[0xfffe0101,1,0xc00f0000,0x90e40000,0xffff]],
    [4,51000,[0xffff0101,1,0x800f0000,0x90e40000,0xffff]]]){
    put(both.program+offset,p);put(p+16,tokens.length*4);new Uint32Array(both.memory,p+24,tokens.length).set(tokens);
    const at=p+24+tokens.length*4,pixel=offset===4;
    new Uint32Array(both.memory,at,8).set([0x44534952,1,pixel?1:0,tokens[0],1,5,160,0]);
    new Uint32Array(both.memory,at+32,4).set([1,1,2,0]);
    new Uint32Array(both.memory,at+48,4).set([pixel?0:4,0,15,0]);
    new Uint32Array(both.memory,at+64,4).set([1,0,228,0]);}
  put(256+28*4,1);put(256+34*4,0xffabcdef);put(256+35*4,0);
  for(const [id,value]of[[36,.25],[37,.75],[38,.5]])both.v.setFloat32(256+id*4,value,true);
  put(256+152*4,4);new Float32Array(both.memory,both.program+25244,24).fill(.25);
  const bothToken=both.bridge.call(0x30001,both.desc,0);assert(bothToken<=-2);
  put(256+152*4,0);new Float32Array(both.memory,both.program+25244,24).fill(99);
  put(256+28*4,0);put(256+34*4,0);put(256+35*4,3);
  for(const id of[36,37,38])put(256+id*4,0);
  both.initialized.resolve();await tick();await both.advance(1);await both.advance(1);
  const bothDraw=both.commands.at(-1).payload;
  assert.strictEqual(bothDraw.userClipPlanes.space,'clip');assert.strictEqual(bothDraw.userClipPlanes.mask,4);
  assert(bothDraw.userClipPlanes.planes.every(x=>x===.25),'programmable plane snapshot immutable');
  assert.strictEqual(bothDraw.fixedFunction,undefined,'both bound programs have no fixed-stage descriptor');
  assert(bothDraw.vertexShader&&bothDraw.pixelShader);
  assert.deepStrictEqual(bothDraw.fogState,{enabled:1,color:0xffabcdef,tableMode:0,start:.25,end:.75,density:.5,depthMode:0},'raster fog survives both-programmed binding and guest mutation');
  await both.advance(1);await both.bridge.wait(bothToken);assert.strictEqual(both.bridge.call(0x30007,0,bothToken),1);await both.bridge.close();
  const missing=fixture();missing.v.setUint32(missing.program,50000,true);missing.v.setUint32(50016,20,true);
  new Uint32Array(missing.memory,50024,5).set([0xfffe0101,1,0xc00f0000,0x90e40000,0xffff]);
  assert.strictEqual(missing.bridge.call(0x30001,missing.desc,0),-1,'no diagnostic token parser fallback');
  missing.initialized.resolve();await tick();
  assert(!missing.commands.some(c=>c.opcode===OP.DRAW),'missing validator cannot enqueue draw');
  await missing.bridge.close();
  const f=fixture(),b=f.bridge;
  const draw=b.call(0x30001,f.desc,0);assert(draw<=-2);
  const entry=b.devices.get(7);assert.strictEqual(entry.queue.submitted,3);
  assert(entry.queue.bytes>48,'snapshots charged while worker initializes');
  assert.strictEqual(b.call(0x30007,0,draw),draw);
  new Uint8Array(f.memory,f.vertices,48).fill(0x99);
  f.initialized.resolve();await tick();
  assert.strictEqual(f.commands[0].opcode,OP.RESOURCE_CREATE);
  await f.advance(1);assert.strictEqual(f.commands[1].opcode,OP.CLEAR);
  await f.advance(1);assert.strictEqual(f.commands[2].opcode,OP.DRAW);
  assert.strictEqual(f.commands[2].payload.vertices[0],0x31,'caller mutation cannot change queued input');
  let ready=false;b.wait(draw).then(()=>{ready=true;});await tick();assert(!ready);
  await f.advance(1);await b.wait(draw);
  assert.strictEqual(b.call(0x30007,0,draw),1);
  assert.strictEqual(b.call(0x30007,0,draw),-1,'terminal token consumed once');
  assert.strictEqual(entry.queue.submitted,3,'poll never resubmits draw');
  const present=b.call(0x30002,f.desc,0);await tick();
  const pixels=new Uint8Array(16).fill(0x57);
  await f.advance({pixels});await b.wait(present);
  assert.strictEqual(new Uint8Array(f.memory)[f.target],0,'readiness alone does not publish');
  f.v.setUint32(f.desc+8,f.target+32,true);
  const release=b.call(0x30004,0,7);await tick();await f.advance(1);
  let released=false;b.wait(release).then(()=>{released=true;});await tick();assert(!released,'release waits prior guest continuation');
  assert.strictEqual(b.call(0x30007,0,present),0);
  assert.strictEqual(new Uint8Array(f.memory)[f.target],0x57,'saved destination survives descriptor mutation');
  assert.strictEqual(new Uint8Array(f.memory)[f.target+32],0);
  await b.wait(release);assert.strictEqual(b.call(0x30007,0,release),1);assert(!b.devices.has(7));
  const failed=fixture();const token=failed.bridge.call(0x30001,failed.desc,0);
  failed.initialized.reject(new Error('worker boot failed'));await failed.bridge.wait(token);
  assert.strictEqual(failed.bridge.call(0x30007,0,token),-1);
  const bounded=fixture({maxPendingRequests:1});
  const pending=bounded.bridge.call(0x30001,bounded.desc,0);
  assert(pending<=-2);const submitted=bounded.bridge.devices.get(7).queue.submitted;
  assert.strictEqual(bounded.bridge.call(0x30002,bounded.desc,0),-1);
  assert.strictEqual(bounded.bridge.devices.get(7).queue.submitted,submitted,'limit rejects before submission');
  bounded.initialized.reject(new Error('stop'));await bounded.bridge.wait(pending);
  bounded.bridge.call(0x30007,0,pending);
  // Completed-but-unconsumed results cannot write into a closed guest process.
  const stale=fixture();const s=stale.bridge.call(0x30001,stale.desc,0);
  stale.initialized.resolve();await tick();await stale.advance(1);await stale.advance(1);await stale.advance(1);
  await stale.bridge.wait(s);stale.bridge.call(0x30007,0,s);
  const p=stale.bridge.call(0x30002,stale.desc,0);await tick();await stale.advance({pixels});await stale.bridge.wait(p);
  await stale.bridge.close();assert.strictEqual(stale.bridge.call(0x30007,0,p),-1);
  assert.strictEqual(new Uint8Array(stale.memory)[stale.target],0);
  const fault=fixture();const bad=fault.bridge.call(0x30001,fault.desc,0);
  fault.initialized.resolve();await tick();await fault.advance(1);await fault.advance(1);
  fault.gates.shift().reject(new Error('native execution fault'));await fault.bridge.wait(bad);
  assert.strictEqual(fault.bridge.call(0x30007,0,bad),-1);
  const retired=deferred();fault.consumer.cancel=()=>retired.promise;
  const teardown=fault.bridge.call(0x30004,0,7);assert(teardown<=-2);
  await tick();assert.strictEqual(fault.bridge.call(0x30007,0,teardown),teardown);
  assert(fault.bridge.devices.has(7),'failed stream keeps native owner until retirement proof');
  retired.resolve();await fault.bridge.wait(teardown);
  assert.strictEqual(fault.bridge.call(0x30007,0,teardown),1);
  assert.strictEqual(fault.bridge.call(0x30001,fault.desc,0),-1,'shared worker retirement is explicit device loss');
  const generation=fixture();const old=generation.bridge.call(0x30001,generation.desc,0);
  generation.initialized.resolve();await tick();await generation.advance(1);await generation.advance(1);await generation.advance(1);
  await generation.bridge.wait(old);generation.bridge.devices.get(7).queue.reset();
  assert.strictEqual(generation.bridge.call(0x30007,0,old),-1,'stale generation cannot finalize');
  // ---- The deferred default: a draw is recorded, not awaited ----------------
  //
  // D3D9 records a draw into a command buffer and returns D3D_OK. The guest
  // never reads a per-draw result -- the finalize for DRAW returns 1 whatever
  // the worker answers -- so parking on one bought nothing but the error, and
  // the error is kept: it is reported from the NEXT call on that device, the
  // way a driver reports at the next synchronization point.
  const pipe=fixture({maxDeferredCommands:32});
  pipe.initialized.resolve();await tick();
  const first=pipe.bridge.call(0x30001,pipe.desc,0);
  assert.strictEqual(first,1,'a deferred draw returns success immediately');
  assert.strictEqual(pipe.bridge.requests.size,0,'a deferred draw allocates no continuation token');
  for(let i=0;i<8;i++)assert.strictEqual(pipe.bridge.call(0x30001,pipe.desc,0),1);
  await tick();
  assert.strictEqual(pipe.bridge.devices.get(7).queue.submitted,11,
    'nine draws, plus the device create and its clear, reached the queue with no fence between them');

  // Backpressure: past the in-flight cap the guest parks again, so an outrun
  // worker can never be queued at without bound.
  const capped=fixture({maxDeferredCommands:2});
  capped.initialized.resolve();await tick();
  assert.strictEqual(capped.bridge.call(0x30001,capped.desc,0),1);
  assert.strictEqual(capped.bridge.call(0x30001,capped.desc,0),1);
  assert(capped.bridge.call(0x30001,capped.desc,0)<=-2,'the third in-flight draw parks for backpressure');

  // A deferred failure is reported once, verbatim, at the next call -- not
  // swallowed, and not replaced by the queue's own poisoned-stream text, which
  // names nothing.
  const late=fixture({maxDeferredCommands:32});
  late.initialized.resolve();await tick();
  assert.strictEqual(late.bridge.call(0x30001,late.desc,0),1);
  await tick();
  await late.advance(1);                       // the device create
  await late.advance(1);                       // its initial clear
  const gate=late.gates.shift();assert(gate,'the deferred draw is executing');
  gate.reject(new Error('D3D9 software: invalid NORMAL/specular input'));
  await tick();await tick();
  assert.strictEqual(late.bridge.call(0x30001,late.desc,0),-1,'the next call reports the deferred failure');
  assert.match(String(late.bridge.lastError),/invalid NORMAL\/specular input/,
    'the original message survives, not "earlier render command failed"');

  // Bytes are the real backpressure, and the command count is the weaker half.
  // The queue charges each payload against what is still FREE, and a deferred
  // command holds its copy until it retires -- so the capacity that the old
  // command-by-command fence always met empty is now shared. Measured on Black
  // & White 2: its land draws carry 2048x1024 texture payloads of about 8 MB,
  // eight in flight exhausted the 64 MB queue, and the refusal was FATAL rather
  // than slow because the queue's error is sticky (457 failed draws, then
  // "render worker stopped"). Past a quarter of the capacity, stop deferring.
  const tight=fixture({maxDeferredCommands:32,commandCapacityBytes:40000});
  tight.initialized.resolve();await tick();
  assert.strictEqual(tight.bridge.call(0x30001,tight.desc,0),1,'the first draw defers, well under the watermark');
  const fenced=tight.bridge.call(0x30001,tight.desc,0);
  assert(fenced<=-2,'past a quarter of the queue capacity a draw fences instead of deferring');
  assert.notStrictEqual(fenced,-1,'and it must fence, never fail -- a refused draw poisons the stream');

  // The watermark is checked before the payload size is known, so a draw that
  // is large relative to what the in-flight ones left can still come back FULL.
  // That is backpressure too, and must reach the guest as a park, not an error:
  // drain the deferred commands, which restores the empty queue the fencing
  // path always submitted into, then submit for real.
  {
    const bridge=fixture({maxDeferredCommands:32}).bridge;
    const gate=deferred();let calls=0;
    const full=Object.assign(new Error('render payload exceeds available byte budget'),{code:'FULL'});
    const entry={async:true,deferred:new Set([gate.promise]),queue:{generation:1,bytes:0,capacityBytes:1<<20,
      submit(){if(++calls===1)throw full;return {sequence:1,generation:1,value:{},status:'completed'};},
      fence(){return Promise.resolve();}}};
    const token=bridge._issue(entry,OP.DRAW,{});
    assert(token<=-2,'a FULL deferred draw parks the guest rather than failing it');
    assert.strictEqual(calls,1,'and does not retry until the in-flight commands have drained');
    gate.resolve();await tick();await tick();
    assert.strictEqual(calls,2,'the drained retry submits for real');
    assert.strictEqual(bridge._poll(token),1,'and the guest resumes with success');
    // A payload too large for an EMPTY queue is still a failure, exactly as it
    // was before deferral existed -- there is nothing left to drain for it.
    const alone={async:true,deferred:new Set(),queue:{generation:1,bytes:0,capacityBytes:1<<20,
      submit(){throw full;},fence(){return Promise.resolve();}}};
    assert.throws(()=>bridge._issue(alone,OP.DRAW,{}),/exceeds available byte budget/,
      'with nothing in flight, an oversized payload still fails');
  }

  console.log('PASS D3D9 async continuation protocol: snapshots, fences, single poll, Present lifetime, errors and bounds');
})().catch(error=>{console.error(error);process.exitCode=1;});
