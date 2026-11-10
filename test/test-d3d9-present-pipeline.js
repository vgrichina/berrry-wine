#!/usr/bin/env node
'use strict';
// Every top-level asynchronous software Present fences its own frame, even
// when the guest draws no next frame. Nested synchronous sends remain detached.
const assert=require('assert');
const {Bridge}=require('../lib/d3d9-host');
const {OPCODES:OP}=require('../lib/d3d-command-stream');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  const memory=new ArrayBuffer(65536),v=new DataView(memory),commands=[],gates=[];
  const desc=64,program=1024,vertices=30000,target=32000;
  const set=(p,n)=>v.setUint32(p,n,true);
  [7,program,target,2,2,1,4,1,vertices,16].forEach((n,i)=>set(desc+i*4,n));
  set(program+12,0x42);v.setFloat32(program+1696,1,true);
  set(program+21784,0x80000000);
  const initialized=deferred();
  // Ordered, like the worker proxy: the next command is handed over without
  // waiting for the previous completion.
  const consumer={ready:initialized.promise,ordered:true,execute(command){
    commands.push(command);const gate=deferred();gates.push(gate);
    return {completion:gate.promise,value:gate.promise};
  },async cancel(){for(const gate of gates)gate.reject(new Error('cancelled'));}};
  const bridge=new Bridge({backend:'software',createSoftwareWorker:()=>consumer,
    getMemory:()=>memory,guestToWasm:p=>p});
  const advance=async value=>{const gate=gates.shift();assert(gate,'command is executing');gate.resolve(value);await tick();};
  const last=()=>commands[commands.length-1];
  const dest=()=>Array.from(new Uint8Array(memory,target,16));
  const frame=n=>new Uint8Array(16).fill(n);
  const draw=async()=>{
    // Frames already in flight keep their gates: the consumer takes the next
    // command without waiting for the previous completion, so only resolve
    // what the bridge queued for this call, until the draw's own token is ready.
    const held=gates.length;
    const token=bridge.call(0x30001,desc,0);
    if(!initialized.settled){initialized.settled=true;initialized.resolve();await tick();}
    if(token===1){
      // Deferred, as in production: the draw's own gate opens whenever.
      for(let i=0;i<8&&gates.length<=held;i++)await tick();
      assert(gates.length>held,'draw reached the consumer');
      while(gates.length>held){gates.splice(held,1)[0].resolve(1);await tick();}
      return;
    }
    assert(token<=-2);
    let done=false;bridge.wait(token).then(()=>{done=true;});
    for(let i=0;i<16&&!done;i++){if(gates.length>held)gates.splice(held,1)[0].resolve(1);await tick();}
    assert(done,'draw completed');assert.strictEqual(bridge.call(0x30007,0,token),1);
  };
  const poll=async token=>{await bridge.wait(token);return bridge.call(0x30007,0,token);};
  return {bridge,desc,commands,gates,advance,last,dest,frame,draw,poll,memory,set};
}
(async()=>{
  const f=fixture();
  await f.draw();
  for(let n=1;n<=3;n++){
    const previous=f.dest();
    const token=f.bridge.call(0x30002,f.desc,0);
    assert(token<=-2,'each top-level Present waits for its own frame');
    await tick();assert.strictEqual(f.last().opcode,OP.PRESENT);
    assert.deepStrictEqual(f.dest(),previous,'in-flight pixels are unpublished');
    await f.advance({pixels:f.frame(n)});
    assert.deepStrictEqual(f.dest(),previous,'publication waits for guest poll');
    assert.strictEqual(await f.poll(token),0);
    assert.deepStrictEqual(f.dest(),Array.from(f.frame(n)),
      'final completed frame is visible without any later Present');
    assert.strictEqual(f.gates.length,0);
  }
  // The nested-send exception cannot block its wndproc. Its successor
  // fences the ordered queue and displays the current, rather than old frame.
  f.set(f.desc+60,1);
  assert.strictEqual(f.bridge.call(0x30002,f.desc,0),0);
  await tick();await f.advance({pixels:f.frame(4)});
  assert.deepStrictEqual(f.dest(),Array.from(f.frame(3)));
  f.set(f.desc+60,0);
  const top=f.bridge.call(0x30002,f.desc,0);assert(top<=-2);
  await tick();await f.advance({pixels:f.frame(5)});
  assert.strictEqual(await f.poll(top),0);
  assert.deepStrictEqual(f.dest(),Array.from(f.frame(5)));
  assert.strictEqual(f.bridge.devices.get(7).pendingPresent,null);
  // Each Present keeps its own destination; no late copy follows release.
  const other=40000;f.set(f.desc+8,other);
  const moved=f.bridge.call(0x30002,f.desc,0);assert(moved<=-2);
  await tick();await f.advance({pixels:f.frame(6)});
  assert.strictEqual(await f.poll(moved),0);
  assert.deepStrictEqual(f.dest(),Array.from(f.frame(5)));
  assert(new Uint8Array(f.memory,other,16).every(b=>b===6));
  f.set(f.desc+60,1);
  assert.strictEqual(f.bridge.call(0x30002,f.desc,0),0);await tick();
  const release=f.bridge.call(0x30004,0,7);assert(release<=-2);await tick();
  await f.advance({pixels:f.frame(7)});await f.advance(1);
  assert.strictEqual(await f.poll(release),1);
  assert(!f.bridge.devices.has(7));
  assert(new Uint8Array(f.memory,other,16).every(b=>b===6));
  await f.bridge.close();

  const g=fixture();await g.draw();
  const failed=g.bridge.call(0x30002,g.desc,0);assert(failed<=-2);await tick();
  g.gates.shift().reject(new Error('rasterizer fault'));await tick();
  assert.strictEqual(await g.poll(failed),-1,'failed Present remains a failure');
  assert.match(String(g.bridge.lastError),/rasterizer fault/);
  await g.bridge.close();
  console.log('PASS d3d9 final-frame Present fence, nested send, destination ownership, release and failure');
})().catch(error=>{console.error(error);process.exit(1);});
