#!/usr/bin/env node
'use strict';
// Protocol regression: no browser/WASM required. Real pixel tests remain in
// the existing D3D9 web and native-worker suites.
const assert=require('assert');
const {Bridge}=require('../lib/d3d9-host');
const {create}=require('../lib/d3d9-render-worker');
const {OPCODES:OP}=require('../lib/d3d-command-stream');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const bitmap=()=>({width:2,height:2,closed:false,close(){this.closed=true;}});
async function settle(bridge,result){
  if(result<=-2){await bridge.wait(result);return bridge.call(0x30007,0,result);}
  return result;
}
async function hostProtocol(backend){
  const memory=new ArrayBuffer(65536),v=new DataView(memory),ports=[],windows={1:{isChild:true}},frames=[];
  const desc=64,program=1024,target=32000;
  const put=(p,n)=>v.setUint32(p,n,true);
  [7,program,target,2,2,1].forEach((n,i)=>put(desc+i*4,n));
  put(desc+44,1);put(desc+48,0xffff0000);put(program+21784,0x80000000);
  let syncDepth=0;
  const bridge=new Bridge({backend,enableProgrammable:true,maxDeferredCommands:0,
    getMemory:()=>memory,guestToWasm:p=>p,getExports:()=>({get_sync_msg_depth:()=>syncDepth}),
    renderer:()=>({windows,getWindowCanvas(){},scheduleRepaint(){}}),
    createCanvas(){throw new Error('main thread must not create a WebGL context');},
    createRenderWorker(options){
      const port={options,commands:[],cancelled:false,ready:Promise.resolve(),
        execute(command){
          assert(!this.cancelled);this.commands.push(command);
          if(this.fail)throw new Error('device failed');
          let value=1;
          if(command.opcode===OP.PRESENT){
            if(backend==='webgl'){const b=bitmap();frames.push(b);value={bitmap:b};}
            else value={pixels:new Uint8Array(16).fill(42)};
          }
          return {value,complete:true};
        },async cancel(){this.cancelled=true;}};
      ports.push(port);return port;
    }});
  assert.strictEqual(await settle(bridge,bridge.call(0x30003,desc,0)),1);
  assert.strictEqual(ports.length,1);assert.strictEqual(ports[0].options.backend,backend);
  assert.deepStrictEqual(ports[0].commands.map(c=>c.opcode),[OP.RESOURCE_CREATE,OP.CLEAR,OP.CLEAR]);
  assert.strictEqual(ports[0].commands.at(-1).payload.color[0],1);
  put(desc+48,0xff00ff00);
  assert.strictEqual(ports[0].commands.at(-1).payload.color[1],0,'queued snapshot owns its state');
  const first=await settle(bridge,bridge.call(0x30002,desc,0));
  assert.strictEqual(first,backend==='webgl'?1:0);
  if(backend==='webgl'){
    assert.strictEqual(windows[1]._gpuFrameLayer.canvas,frames[0]);
    assert(new Uint8Array(memory,target,16).every(x=>x===0),'GPU present must not copy pixels');
    await settle(bridge,bridge.call(0x30002,desc,0));
    assert(frames[0].closed,'replaced image is released');
    syncDepth=1;assert.strictEqual(bridge.call(0x30002,desc,0),1);
    await tick();syncDepth=0;
    assert.strictEqual(windows[1]._gpuFrameLayer.canvas,frames.at(-1),'recursive SendMessage presentation does not park');
  }else assert(new Uint8Array(memory,target,16).every(x=>x===42));
  put(desc,8);
  assert.strictEqual(await settle(bridge,bridge.call(0x30003,desc,0)),1);
  assert.strictEqual(ports.length,2,'each device gets a namespace in the shared worker');
  ports[0].fail=true;
  assert.strictEqual(await settle(bridge,bridge.call(0x30006,0,7)),-1);
  assert.strictEqual(await settle(bridge,bridge.call(0x30004,0,7)),1);
  assert(ports[0].cancelled);assert(!ports[1].cancelled,'failure retirement must preserve other devices');
  assert.strictEqual(await settle(bridge,bridge.call(0x30006,0,8)),1);
  put(desc,7);
  assert.strictEqual(await settle(bridge,bridge.call(0x30003,desc,0)),1);
  assert.strictEqual(ports[2].options.generation,2,'guest device identity reuse advances generation');
  await bridge.close();assert(ports.every(p=>p.cancelled));
  assert(frames.every(b=>b.closed),'close retires every published image');
}
function adapterProtocol(){
  let reads=0,draws=0,finishes=0,destroys=0;
  class GPUDevice{
    constructor(canvas){this.canvas=canvas;this.gpu={gl:{isContextLost:()=>false,flush(){}},finish(){finishes++;}};}
    draw(){draws++;}clear(){}readColor(){reads++;return {pixels:new Uint8Array(16)};}
    present(){return this.canvas;}destroy(){destroys++;}
  }
  const adapter=create({backend:'webgl',options:{GPUDevice,createCanvas:()=>({width:2,height:2,transferToImageBitmap:bitmap})}});
  const call=(opcode,payload={},generation=1)=>adapter.execute({deviceId:9,generation,opcode,payload});
  call(OP.RESOURCE_CREATE,{kind:'device',width:2,height:2});call(OP.DRAW);
  const frame=call(OP.PRESENT).value;assert(frame.bitmap);assert.strictEqual(reads,0);assert.strictEqual(finishes,0);
  assert.strictEqual(draws,1);call(OP.READBACK);assert.strictEqual(reads,1);assert.strictEqual(finishes,1);
  assert.throws(()=>call(OP.DRAW,{},2),/stale/);
  adapter.destroy();assert.strictEqual(destroys,1);assert.throws(()=>call(OP.DRAW),/closed/);
}
function retirementCompletion(worker){
  const events=[];let lost=false;
  class GPUDevice{
    constructor(){this.gpu={gl:{isContextLost:()=>lost},finish(){events.push('finish');}};}
    draw(){events.push('draw');}releaseColor(id){events.push('color:'+id);}
    releaseDepth(id){events.push('depth:'+id);}destroy(){events.push('destroy');}
    readColor(){events.push('readback');return {pixels:new Uint8Array(4)};}
  }
  const endpoint=worker?create({backend:'webgl',options:{GPUDevice,createCanvas:()=>({})}}):null;
  const bridge=worker?null:new Bridge({});
  const entry={kind:'webgl',device:new GPUDevice()};
  const call=(opcode,payload={})=>{
    const command={deviceId:9,generation:1,opcode,payload};
    return worker?endpoint.execute(command):bridge._execute(entry,command);
  };
  if(worker)call(OP.RESOURCE_CREATE,{kind:'device',width:1,height:1});
  call(OP.DRAW);
  call(OP.RESOURCE_RELEASE,{kind:'color',id:1});
  call(OP.RESOURCE_RELEASE,{kind:'color-set',ids:[2,3]});
  call(OP.RESOURCE_RELEASE,{kind:'depth',id:4});
  call(OP.DRAW);
  assert.deepStrictEqual(events,['draw','color:1','color:2','color:3','depth:4','draw'],
    'ordered retirement permits more work without forcing GPU completion');
  call(OP.FENCE);assert.strictEqual(events.at(-1),'finish');
  call(OP.READBACK);assert.deepStrictEqual(events.slice(-2),['readback','finish']);
  lost=true;assert.throws(()=>call(OP.RESOURCE_RELEASE,{kind:'color',id:5}),/context lost/);
  lost=false;call(OP.RESOURCE_RELEASE,{kind:'device'});
  assert.deepStrictEqual(events.slice(-2),['finish','destroy'],'device teardown retains completion boundary');
  endpoint?.destroy();
}
(async()=>{adapterProtocol();retirementCompletion(false);retirementCompletion(true);await hostProtocol('software');await hostProtocol('webgl');
  console.log('D3D9 shared render worker protocol PASS');})().catch(error=>{console.error(error);process.exitCode=1;});
