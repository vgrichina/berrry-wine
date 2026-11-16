#!/usr/bin/env node
'use strict';
// Uploads decode through the standalone build of the WAT decoder (slice 9.1).
require('./helpers/wat-texture-decoder').installStandalone();
// Texture residency: a converted mip level travels to the executor once under
// a host-assigned key and is referenced by the key alone afterwards. Covers
// the software Device's keyed bind/release path and the host bridge's keyed
// payloads and budget-driven release lists.
const assert=require('assert');
const {bootRenderHarness}=require('./render-helper');
const {Device}=require('../lib/d3d9-software-backend');
const {Bridge}=require('../lib/d3d9-host');
const {OPCODES:OP}=require('../lib/d3d-command-stream');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  const {exports:e,memory}=await bootRenderHarness({fonts:'none'});
  const device=new Device({getExports:()=>e,getMemory:()=>memory.buffer,width:8,height:8});
  const base=device.bytes;
  const vs=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40005,1,0xe00f0000,0x90e40007,0xffff]);
  const ps=new Uint32Array([0xffff0101,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
  function snapshot(level){
    const vertices=new Uint8Array(72),v=new DataView(vertices.buffer);
    [[-1,1],[1,1],[-1,-1]].forEach(([x,y],i)=>{
      v.setFloat32(i*24,x,true);v.setFloat32(i*24+4,y,true);v.setFloat32(i*24+8,.5,true);
      vertices.set([255,0,0,255],i*24+12);v.setFloat32(i*24+16,.5,true);v.setFloat32(i*24+20,.5,true);
    });
    return {primitive:4,primitiveCount:1,stride:24,vertices,
      attributes:[{register:0,usage:0,usageIndex:0,type:2,offset:0},
        {register:5,usage:10,usageIndex:0,type:4,offset:12},{register:7,usage:5,usageIndex:0,type:1,offset:16}],
      vertexShader:vs,pixelShader:ps,vertexConstants:new Float32Array(384),pixelConstants:new Float32Array(4),
      state:{zenable:true,zwrite:true,zfunc:4,blend:false,cull:1},
      textures:[{...level,sampler:{min:1,mag:1,mip:0,addressU:3,addressV:3}}]};
  }
  const pixel=()=>[...device.readPixels().slice(0,4)];
  const blue={width:1,height:1,key:'t1',pixels:new Uint8Array([0,128,255,255])};
  device.clear([0,0,0,1],3);device.draw(snapshot(blue));
  assert.deepStrictEqual(pixel(),[255,128,0,255],'keyed level samples like a plain one');
  const resident=device.bytes;
  assert.strictEqual(resident,base+4,'the level stays resident after the draw');
  device.clear([0,0,0,1],3);device.draw(snapshot({width:1,height:1,key:'t1'}));
  assert.deepStrictEqual(pixel(),[255,128,0,255],'a key alone samples the resident level');
  assert.strictEqual(device.bytes,resident,'a key hit allocates nothing');
  device.clear([0,0,0,1],3);device.draw(snapshot({width:1,height:1,key:'t1',pixels:new Uint8Array([9,9,9,9])}));
  assert.deepStrictEqual(pixel(),[255,128,0,255],'a resident key wins over redundant pixels');
  assert.throws(()=>device.draw(snapshot({width:1,height:1,key:'t2'})),/texture not resident/);
  assert.throws(()=>device.draw(snapshot({width:1,height:1,key:'t2',pixels:new Uint8Array(3)})),/texture not resident/);
  assert.strictEqual(device.bytes,resident,'rejected draws leave residency alone');
  const released=snapshot({width:1,height:1,key:'t2',pixels:new Uint8Array([255,0,0,255])});
  released.textureReleases=['t1'];
  device.clear([0,0,0,1],3);device.draw(released);
  assert.deepStrictEqual(pixel(),[0,0,255,255],'releases apply before the bind');
  assert.strictEqual(device.bytes,resident,'t1 freed, t2 resident');
  assert.throws(()=>device.draw(snapshot({width:1,height:1,key:'t1'})),/texture not resident/);
  const bad=snapshot({width:1,height:1,key:'t2'});bad.textureReleases=[3];
  assert.throws(()=>device.draw(bad),/invalid texture release list/);
  device.reset({width:8,height:8,depthAttachment:null});
  assert.strictEqual(device.bytes,base,'reset drops resident levels');
  assert.throws(()=>device.draw(snapshot({width:1,height:1,key:'t2'})),/texture not resident/);
  for(const format of [63,62,63]) {
    device.clear([0,0,0,1],3);
    device.draw(snapshot({width:1,height:1,key:'signed',format,pixels:new Uint8Array([128,127,64,64])}));
    assert.deepStrictEqual(pixel(),format===63?[129,255,0,129]:[64,255,0,255],'signed cached bytes retain per-draw decoding');
  }
  device.draw(snapshot(blue));device.destroy();
  assert.strictEqual(device.bytes,0,'destroy returns every resident byte');

  // Host side: the bridge keys the levels it snapshots, sends pixels once per
  // device, and releases the least recently drawn keys once over budget.
  function fixture(options={}){
    const memory=new ArrayBuffer(65536),v=new DataView(memory),commands=[],gates=[];
    const desc=64,program=1024,vertices=30000,target=32000;
    const set=(p,n)=>v.setUint32(p,n,true);
    [7,program,target,2,2,1,4,1,vertices,16].forEach((n,i)=>set(desc+i*4,n));
    set(program+12,0x42);v.setFloat32(program+1696,1,true);
    set(program+21784,0x80000000);
    new Uint8Array(memory,vertices,48).fill(0x31);
    const initialized=deferred();
    const consumer={ready:initialized.promise,execute(command){
      commands.push(command);const gate=deferred();gates.push(gate);
      return {completion:gate.promise,value:gate.promise};
    },async cancel(){for(const gate of gates)gate.reject(new Error('cancelled'));}};
    const bridge=new Bridge({backend:'software',createSoftwareWorker:()=>consumer,
      getMemory:()=>memory,guestToWasm:p=>p,maxDeferredCommands:0,...options});
    const advance=async value=>{const gate=gates.shift();assert(gate,'command is executing');gate.resolve(value);await tick();};
    const texture=(stage,record,pixels,bytes)=>{
      set(program+21792+(stage-4)*4,record);
      for(const [offset,value]of[[12,3],[24,1],[28,1],[32,1],[36,21],[64,1],[68,1],[72,4],[76,4],[80,pixels]])set(record+offset,value);
      new Uint8Array(memory,pixels,4).set(bytes);
    };
    const draw=async()=>{
      const before=commands.length;
      const token=bridge.call(0x30001,desc,0);assert(token<=-2);
      if(!initialized.settled){initialized.settled=true;initialized.resolve();await tick();}
      // Resolve whatever the bridge queued ahead of and around the draw
      // (device creation, fences); the draw is the DRAW command issued since.
      for(let i=0;i<8&&(gates.length||!commands.slice(before).some(c=>c.opcode===OP.DRAW));i++){if(gates.length)await advance(1);else await tick();}
      const command=commands.slice(before).find(c=>c.opcode===OP.DRAW);assert(command,'draw was issued');
      await bridge.wait(token);assert.strictEqual(bridge.call(0x30007,0,token),1);
      return command.payload;
    };
    // A deferred submission that failed after the bridge had already committed
    // its residency (the FULL-parked path in _issue). The bridge reports it at
    // the next call and must forget what it assumed the worker holds.
    const lateFailure=()=>{bridge.devices.get(7).deferredError=new Error('parked draw was refused');};
    return {bridge,set,texture,draw,lateFailure,program,desc};
  }
  const host=fixture();
  host.texture(4,40512,42064,[4,20,30,255]);
  const first=await host.draw();
  assert.deepStrictEqual(Array.from(first.textures[4].pixels),[30,20,4,255],'first use carries the converted pixels');
  assert.strictEqual(first.textures[4].key,'t1');
  assert.strictEqual(first.textureReleases,undefined);
  const second=await host.draw();
  assert.strictEqual(second.textures[4].key,'t1','same snapshot, same key');
  assert.strictEqual(second.textures[4].pixels,undefined,'second use carries the key alone');
  assert.strictEqual(second.textures[4].levels[0].pixels,undefined);
  // A deferred draw that failed late: the next call reports it (-1) and the
  // draw after that releases every key the bridge had assumed and re-sends.
  host.lateFailure();
  assert.strictEqual(host.bridge.call(0x30001,host.desc,0),-1,'the deferred failure surfaces on the next call');
  const recovered=await host.draw();
  assert.strictEqual(recovered.textures[4].key,'t1');
  assert.notStrictEqual(recovered.textures[4].pixels,undefined,'pixels are re-sent after a failure');
  assert.deepStrictEqual(recovered.textureReleases,['t1'],'and the assumed key is released first');
  const settled=await host.draw();
  assert.strictEqual(settled.textures[4].pixels,undefined);assert.strictEqual(settled.textureReleases,undefined);
  await host.bridge.close();
  // Zero budget: a key stays resident only while the draw in hand uses it.
  const tight=fixture({maxResidentTextureBytes:0});
  tight.texture(4,40512,42064,[4,20,30,255]);
  const a=await tight.draw();assert.strictEqual(a.textures[4].key,'t1');assert.strictEqual(a.textureReleases,undefined,'a used key is never released');
  tight.texture(4,40640,42080,[5,20,30,255]);
  const b=await tight.draw();
  assert.strictEqual(b.textures[4].key,'t2');assert.deepStrictEqual(Array.from(b.textures[4].pixels),[30,20,5,255]);
  assert.deepStrictEqual(b.textureReleases,['t1'],'the unused key is released to make room');
  tight.texture(4,40512,42064,[4,20,30,255]);
  const c=await tight.draw();
  assert.strictEqual(c.textures[4].key,'t1');assert.notStrictEqual(c.textures[4].pixels,undefined,'a released key is re-sent with pixels');
  assert.deepStrictEqual(c.textureReleases,['t2']);
  await tight.bridge.close();
  assert.throws(()=>fixture({maxResidentTextureBytes:-1}),/resident texture budget/);
  console.log('PASS d3d9 texture residency');
})().catch(error=>{console.error(error);process.exit(1);});
