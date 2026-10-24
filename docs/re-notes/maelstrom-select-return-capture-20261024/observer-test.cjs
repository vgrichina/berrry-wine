const {createObserver}=require('./observer.cjs'),assert=require('assert');
const memory={buffer:new ArrayBuffer(4096)},dv=new DataView(memory.buffer);let counts=[0,0,0,0,0,0],eip=0x75040f8;
[0x7a3362,4,200,0,0,240].forEach((x,i)=>dv.setUint32(100+i*4,x,true));dv.setUint32(200,1,true);dv.setUint32(204,42,true);dv.setUint32(240,1,true);
const e=Object.freeze({get_count:i=>counts[i],get_eip:()=>eip,get_esp:()=>100,get_yield_reason:()=>8});let rows=[];const obs=createObserver(x=>rows.push(JSON.parse(x))),before=Buffer.from(memory.buffer).toString('hex');
obs(30000,e,memory,x=>x,{batch:30000,lastTick:6000000});assert.equal(rows.length,0);
counts=[4,0,1,1,1,1];obs(36000,e,memory,x=>x,{batch:36000,lastTick:7200000});
counts=[4,1,1,1,1,10];obs(36010,e,memory,x=>x,{batch:36010,lastTick:7202000});assert.equal(rows.length,2);assert.equal(rows[1].counts[1],1);assert.equal(rows[1].tick.lastTick,7202000);assert.equal(rows[0].frame[0],0x7a3362);assert.equal(before,Buffer.from(memory.buffer).toString('hex'));
assert.throws(()=>createObserver(()=>{})(36000,{...e,get_esp:()=>999999},memory,x=>x,{}));dv.setUint32(100,0xdead,true);assert.throws(()=>createObserver(()=>{})(36000,e,memory,x=>x,{}),/authentic select return/);
console.log(JSON.stringify({pass:true,reachable:true,phaseGate:true,completedReturnControl:true,badPointerRejected:true,wrongReturnRejected:true,readOnly:true,rows}));
