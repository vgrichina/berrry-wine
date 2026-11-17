'use strict';
const assert=require('node:assert/strict');
const {completeCapture}=require('../tools/gltron-current-capture.cjs');
// Independent standard PNG verifier: no pngjs decoding/filter implementation.
// The evidence encoder deliberately emits RGBA8, noninterlaced, filter 0 rows.
function verifyPNG(png,width,height,rgba) {
  assert.deepEqual(png.subarray(0,8),Buffer.from('89504e470d0a1a0a','hex'));
  const idat=[];let at=8,header=false,end=false;
  while(at<png.length){
    const size=png.readUInt32BE(at),type=png.toString('ascii',at+4,at+8),data=png.subarray(at+8,at+8+size);
    assert(at+12+size<=png.length,'complete chunk');
    let crc=0xffffffff;
    for(const byte of png.subarray(at+4,at+8+size)){
      crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
    }
    assert.equal((crc^0xffffffff)>>>0,png.readUInt32BE(at+8+size),'chunk CRC');
    if(type==='IHDR'){
      assert(!header&&at===8);header=true;
      assert.equal(data.readUInt32BE(0),width);assert.equal(data.readUInt32BE(4),height);
      assert.deepEqual([...data.subarray(8)],[8,6,0,0,0]);
    }else if(type==='IDAT'){assert(header&&!end);idat.push(data);}
    else if(type==='IEND'){assert.equal(size,0);end=true;}
    at+=12+size;
  }
  assert(header&&end&&idat.length);assert.equal(at,png.length);
  const rows=require('node:zlib').inflateSync(Buffer.concat(idat));
  assert.equal(rows.length,(width*4+1)*height);
  for(let y=0;y<height;y++){
    const offset=y*(width*4+1);assert.equal(rows[offset],0,'fixed filter 0');
    assert.deepEqual(rows.subarray(offset+1,offset+1+width*4),rgba.subarray(y*width*4,(y+1)*width*4));
  }
}
async function fixture(failure) {
  let at=0,fire,resolveLate,retained=0,closed=0,calls=[];const phases=[];
  const pending=new Promise(r=>resolveLate=r);
  const step=async(name,value)=>{calls.push(name);if(failure===name){await pending;return value;}return value;};
  const task=completeCapture({now:()=>at,timers:{set:(fn,ms)=>{assert.equal(ms,3000);fire=fn;return 1;},clear:()=>{}},
    record:v=>phases.push(v),close:()=>closed++,requestTicket:()=>step('request',true),
    readTicket:()=>step('ticket',{status:'complete',metadata:{publication:7},receipt:{publication:7}}),
    captureHost:()=>step('host',{data:'pixels'}),retain:()=>{retained++;}});
  if(failure){for(let n=0;n<20&&!calls.includes(failure);n++)await Promise.resolve();
    assert(calls.includes(failure));at=3000;fire();await assert.rejects(task,/DISPLAY_UNKNOWN/);
    const stopped=[...calls];resolveLate(true);for(let n=0;n<20;n++)await Promise.resolve();
    assert.deepEqual(calls,stopped,'no dependent call after UNKNOWN');assert.equal(retained,0);assert.equal(closed,1);
    assert.equal(phases.at(-1).phase,'UNKNOWN');
    assert.equal(phases.at(-1).pendingPhase,{request:'request-ticket',ticket:'read-ticket',host:'host-capture'}[failure]);
  }else{await task;assert.equal(retained,1);assert.equal(closed,0);assert.equal(phases.at(-1).phase,'complete');}
}
if(require.main===module)(async()=>{for(const mode of [null,'request','ticket','host'])await fixture(mode);
  for(const late of [false,true]){
    let hostDone,bytesDone,fire,clock=0,closed=0,retained=0;
    const began=[];
    const task=completeCapture({now:()=>clock,timers:{set:fn=>{fire=fn;return 1;},clear:()=>{}},
      requestTicket:async()=>{},readTicket:async()=>({status:'complete',metadata:{publication:19}}),
      captureHost:()=>{began.push('host');return new Promise(r=>hostDone=r);},
      transportTicket:shot=>{assert.equal(shot.metadata.publication,19);began.push('bytes');return new Promise(r=>bytesDone=r);},
      retain:shot=>{assert.equal(shot.source,'same-ticket');retained++;},close:()=>closed++,record:()=>{}});
    while(began.length<2)await Promise.resolve();assert.deepEqual(began,['host','bytes']);
    if(late){clock=3000;fire();await assert.rejects(task,/DISPLAY_UNKNOWN/);}
    hostDone({data:'whole-host'});bytesDone({source:'same-ticket'});
    if(!late)await task;else for(let i=0;i<10;i++)await Promise.resolve();
    assert.equal(retained,late?0:1);assert.equal(closed,late?1:0);
  }
  for(const status of ['failed','cancelled','unknown']){
    let reads=0,closed=0,host=0,retained=0;
    await assert.rejects(completeCapture({requestTicket:async()=>{},
      readTicket:async()=>{reads++;return {status,error:'producer context lost or retired'};},
      captureHost:async()=>host++,retain:async()=>retained++,close:()=>closed++,record:()=>{}}),/DISPLAY_UNKNOWN/);
    assert.equal(reads,1);assert.equal(closed,1);assert.equal(host,0);assert.equal(retained,0);
    await new Promise(r=>setTimeout(r,15));assert.equal(reads,1,'no query after terminal ticket');
  }
  {
    let clock=0,fire,finishRetain,closed=0;const phases=[];
    const task=completeCapture({now:()=>clock,timers:{set:(fn,ms)=>{assert.equal(ms,3000);fire=fn;return 1;},clear:()=>{}},
      requestTicket:async()=>{},readTicket:async()=>({status:'complete'}),captureHost:async()=>({}),
      retain:()=>new Promise(r=>finishRetain=r),close:()=>closed++,record:v=>phases.push(v)});
    while(!finishRetain)await Promise.resolve();clock=3000;fire();
    await assert.rejects(task,/DISPLAY_UNKNOWN/);const stopped=phases.length;
    finishRetain();for(let i=0;i<10;i++)await Promise.resolve();
    assert.equal(closed,1);assert.equal(phases.length,stopped);
    assert.equal(phases.at(-1).phase,'UNKNOWN','retention shares original deadline');
  }
  const {encodeCapturePNG}=require('../tools/gltron-current-capture.cjs'),{PNG}=require('pngjs');
  for(const [width,height]of [[1,1],[480,360],[1060,744]]){
    const bytes=Buffer.alloc(width*height*4);
    for(let n=0;n<bytes.length;n++)bytes[n]=(n*37+(n>>>9))&255;
    const encoded=encodeCapturePNG(width,height,bytes),decoded=PNG.sync.read(encoded);
    assert.equal(decoded.width,width);assert.equal(decoded.height,height);assert.deepEqual(decoded.data,bytes);
    verifyPNG(encoded,width,height,bytes);
  }
  // RGB under alpha zero must survive too; dense input may expand slightly.
  for(const dense of [false,true]){
    const width=257,height=129,bytes=Buffer.alloc(width*height*4);let state=0x12345678;
    for(let i=0;i<bytes.length;i++){
      state^=state<<13;state^=state>>>17;state^=state<<5;
      bytes[i]=dense?state&255:(i%4===3?0:(i>>>10)&255);
    }
    const before=Buffer.from(bytes),encoded=encodeCapturePNG(width,height,bytes);
    assert.deepEqual(bytes,before,'encoder does not mutate caller RGBA');
    assert.deepEqual(PNG.sync.read(encoded).data,bytes);verifyPNG(encoded,width,height,bytes);
    if(!dense)assert(encoded.length<bytes.length/10,'structured transparent evidence must compress');
  }
  assert.throws(()=>encodeCapturePNG(2,2,Buffer.alloc(4)),/invalid complete RGBA/);
  for(const [w,h]of [[0,1],[-1,1],[1,0],[1.5,1],[4097,4096]])
    assert.throws(()=>encodeCapturePNG(w,h,Buffer.alloc(0)),/invalid complete RGBA/);
  console.log('PASS bounded capture PNG codec preserves every RGBA byte, dimensions and alpha');
  console.log('PASS capture success and request/ticket/host deadline: phase retained, late pixels discarded, zero later calls');
})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={verifyPNG};
