'use strict';
// Independently authored literal fixtures; no production/reference imports.
const assert = require('node:assert/strict');
const MODE = ['points','lines','line-loop','line-strip','triangles','triangle-strip','triangle-fan','quads','quad-strip','polygon'];
const COUNTS = [3,4,4,4,6,5,5,8,6,5];
// Each entry is [ordered vertex IDs, flat-color vertex ID]. Zero based.
// GL 2.1 sections 2.6 and 2.14.7: polygon first; other polygons last.
const TOPOLOGY = [
  [[[0],0],[[1],1],[[2],2]],
  [[[0,1],1],[[2,3],3]],
  [[[0,1],1],[[1,2],2],[[2,3],3],[[3,0],0]],
  [[[0,1],1],[[1,2],2],[[2,3],3]],
  [[[0,1,2],2],[[3,4,5],5]],
  [[[0,1,2],2],[[2,1,3],3],[[2,3,4],4]],
  [[[0,1,2],2],[[0,2,3],3],[[0,3,4],4]],
  [[[0,1,2,3],3],[[4,5,6,7],7]],
  [[[0,1,3,2],3],[[2,3,5,4],5]],
  [[[0,1,2,3,4],0]],
];
const LOWERED = [
  [0,1,2], [0,1,2,3], [0,1,1,2,2,3,3,0], [0,1,1,2,2,3],
  [0,1,2,3,4,5], [0,1,2,2,1,3,2,3,4], [0,1,2,0,2,3,0,3,4],
  [0,1,2,0,2,3,4,5,6,4,6,7], [0,1,3,0,3,2,2,3,5,2,5,4],
  [0,1,2,0,2,3,0,3,4],
];
const FLAT_IDS = [
  [0,1,2], [1,1,3,3], [1,1,2,2,3,3,0,0], [1,1,2,2,3,3],
  [2,2,2,5,5,5], [2,2,2,3,3,3,4,4,4], [2,2,2,3,3,3,4,4,4],
  [3,3,3,3,3,3,7,7,7,7,7,7], [3,3,3,3,3,3,5,5,5,5,5,5],
  [0,0,0,0,0,0,0,0,0],
];
const COMPACT_MODES = [0,1,0x1000001,0x1000001,4,4,4,4,4,4];
// Binary32-exact, nondegenerate positions. Every polygon below faces CCW.
const POSITIONS = [
 [[-.5,-.5,0],[0,.5,0],[.5,-.5,0]],
 [[-.75,-.5,0],[.75,-.5,0],[-.75,.5,0],[.75,.5,0]],
 [[-.75,-.75,0],[.75,-.75,0],[.75,.75,0],[-.75,.75,0]],
 [[-.75,-.75,0],[.75,-.75,0],[.75,.75,0],[-.75,.75,0]],
 [[-.75,-.75,0],[.75,-.75,0],[-.75,.75,0],[.75,-.75,0],[.75,.75,0],[-.75,.75,0]],
 [[-.75,-.75,0],[.75,-.75,0],[-.75,0,0],[.75,0,0],[-.75,.75,0]],
 [[0,0,0],[-.75,-.75,0],[.75,-.75,0],[.75,.75,0],[-.75,.75,0]],
 [[-.75,-.75,0],[0,-.75,0],[0,.75,0],[-.75,.75,0],[0,-.75,0],[.75,-.75,0],[.75,.75,0],[0,.75,0]],
 [[-.75,-.75,0],[.75,-.75,0],[-.75,0,0],[.75,0,0],[-.75,.75,0],[.75,.75,0]],
 [[-.75,-.5,0],[0,-.75,0],[.75,-.5,0],[.5,.75,0],[-.5,.75,0]],
];
function attributes(i, colorId=i, mode=4, homogeneous=false) {
  // Every value is binary32-exact; interpolation/rounding is not the oracle.
  return [...POSITIONS[mode][i], (colorId+1)/16, (colorId+2)/16, (colorId+3)/16, homogeneous?(colorId+8)/16:1,
    i/8, (i+1)/8, i-2, 0.25, -0.75, (i+2)/8, (i+3)/8, homogeneous?1+i/8:1,
    (i+4)/8, (i+5)/8, (i+6)/8, (i+7)/8];
}
function decode(packets) {
  return packets.map(bytes=>{
    assert(Buffer.isBuffer(bytes)); const records=[];
    for(let at=0;at<bytes.length;){
      assert(at+32<=bytes.length,'complete header');
      const words=Array.from({length:8},(_,i)=>bytes.readUInt32LE(at+4*i));
      const [length,opcode,mode,stackBytes,guestPointer,payloadBytes,payloadAt,flags]=words;
      assert(length>=32 && length%4===0 && at+length<=bytes.length,'complete aligned record');
      if(stackBytes)assert(stackBytes%4===0 && at+32+stackBytes<=at+length,'owned stack');
      if(payloadBytes && !(flags&2))assert(payloadAt>=at+32 && payloadAt+payloadBytes<=at+length,'owned payload');
      const record={opcode,mode,words,at,length};
      if([65536,65538,65545].includes(opcode)){
        const stride=opcode===65536?19:opcode===65538?28:29;
        assert.equal(stackBytes,0); assert.equal(guestPointer,0); assert.equal(flags,1);
        assert.equal(payloadAt,at+32); assert.equal(length,32+payloadBytes);
        assert.equal(payloadBytes%(stride*4),0,'complete vertex stride; no indices');
        record.vertices=Array.from({length:payloadBytes/(stride*4)},(_,v)=>
          Array.from({length:stride},(_,i)=>bytes.readFloatLE(payloadAt+(v*stride+i)*4)));
      }
      records.push(record);at+=length;
    }
    return records;
  });
}
function assertGeometry(packets,mode,flat,boundary=false,flags=[],homogeneous=false) {
  const records=decode(packets).flat(),draws=records.filter(r=>r.vertices);
  if(boundary && mode>=4){
    assert.equal(draws.length,TOPOLOGY[mode].length,'one complete logical polygon per edge record');
    draws.forEach((record,n)=>{
      const [ids,prov]=TOPOLOGY[mode][n];
      assert.equal(record.opcode,65545);assert.equal(record.mode,9);
      assert.deepEqual(record.vertices,ids.map(i=>[...attributes(i,flat?prov:i,mode,homogeneous),...Array(9).fill(0),
        [4,7,9].includes(mode)?(flags[i]??1):1]),'literal edge topology/color/all attributes/outgoing boundary');
    });
  }else{
    assert.equal(draws.length,1,'one compact draw');
    assert.equal(draws[0].opcode,65536);assert.equal(draws[0].mode,COMPACT_MODES[mode]);
    assert.deepEqual(draws[0].vertices,LOWERED[mode].map((i,n)=>attributes(i,flat?FLAT_IDS[mode][n]:i,mode,homogeneous)),
      'literal ordered vertices and every current attribute');
  }
  return {draws:draws.length,vertices:draws.reduce((n,r)=>n+r.vertices.length,0)};
}
module.exports={POSITIONS,MODE,COUNTS,TOPOLOGY,LOWERED,FLAT_IDS,COMPACT_MODES,attributes,decode,assertGeometry};
