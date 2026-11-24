'use strict';
const assert = require('node:assert/strict');
const { createAudioHost } = require('../lib/host-audio');
let checks=0; const failures=[], rows=[];
function check(label, actual, expected) {
  checks++;
  try { assert.deepStrictEqual(actual,expected,label); }
  catch(e) { failures.push({label,actual,expected,message:e.message}); }
}
class Node {
  constructor(){this.edges=[];}
  connect(n){this.edges.push(n);return n;}
  disconnect(){this.edges=[];}
}
class ClockContext {
  constructor(){this.time=8;this.wall=0;this.state='running';this.destination=new Node();this.started=[];}
  get currentTime(){return this.time;}
  advance(seconds){this.wall+=seconds;if(this.state==='running')this.time+=seconds;}
  suspend(){this.state='suspended';}
  resume(){this.state='running';}
  createGain(){const n=new Node();n.gain={value:1};return n;}
  createStereoPanner(){const n=new Node();n.pan={value:0};return n;}
  createBuffer(channels,length,sampleRate){
    const data=Array.from({length:channels},()=>new Float32Array(length));
    return {length,numberOfChannels:channels,sampleRate,duration:length/sampleRate,getChannelData:c=>data[c]};
  }
  createBufferSource(){
    const s=new Node();s.playbackRate={value:1};s.stops=[];
    s.start=(at,offset)=>{s.at=at;s.offset=offset;this.started.push(s);};
    s.stop=at=>s.stops.push(at); // ended is delivered separately and late
    return s;
  }
}
function make(channels,bits){
  const ac=new ClockContext(), memory=new ArrayBuffer(8192), bytes=new Uint8Array(memory);
  bytes.fill(73); const ptr=1024, frame=channels*bits/8, length=256*frame;
  if(bits===8)bytes.fill(192,ptr,ptr+length);
  else {const d=new DataView(memory);for(let i=0;i<256;i++){d.setInt16(ptr+i*4,8192,true);d.setInt16(ptr+i*4+2,-16384,true);}}
  const ctx={getMemory:()=>memory,_audioCtx:ac};
  const shared={profileNow:()=>0,profileEvent:()=>{},getHost:()=>host};
  const {imports:host}=createAudioHost(ctx,shared);
  const id=host.voice_open(1024,channels,bits);
  return {ac,ctx,host,id,bytes,frame,length,ptr,write:()=>host.voice_write_stream(id,ptr,length)};
}
function graph(x){const v=x.ctx._voices._map[x.id];return [v.gain.edges[0]===v.pan,v.pan.edges[0]===v.master,v.master===x.ac._wineWaveBus,x.ac._wineWaveBus.edges[0]===x.ac._wineMaster,x.ac._wineMaster.edges[0]===x.ac.destination,v.gain.gain.value,v.pan.pan.value];}
for(const [channels,bits] of [[1,8],[2,16]])for(const vector of [
  {name:'collision',before:0.25,start:8.25,rate:2048,half:0.0625,next:8.375},
  {name:'noncollision',before:0.125,start:8.125,rate:2048,half:0.0625,next:8.25},
  {name:'unchanged-rate',before:0.25,start:8.25,rate:1024,half:0.125,next:8.5}
]){
  const x=make(channels,bits), foreign=make(1,8), label=`${channels}ch/${bits}/${vector.name}`;
  const c=(s,a,e)=>check(label+': '+s,a,e);
  foreign.write();const fsrc=foreign.ac.started[0], foreignBytes=Array.from(foreign.bytes), fgraph=graph(foreign);
  x.write();const old=x.ac.started[0];
  c('first start',[old.at,old.offset,old.buffer.length,old.playbackRate.value],[8,0,256,1]);
  x.ac.advance(vector.before);x.ac.suspend();x.write();
  c('suspended submit schedules nothing',x.ac.started.length,1);
  const frozenPos=x.host.voice_get_pos(x.id);
  if(vector.rate===2048)for(const hz of [2048,1024,2048])x.host.voice_set_freq(x.id,hz);
  c('rate edit at frozen instant preserves cursor',x.host.voice_get_pos(x.id),frozenPos);
  x.ac.advance(9);c('wall time only',[x.ac.currentTime,x.ac.wall],[vector.start,9+vector.before]);
  c('no suspended progress',x.host.voice_get_pos(x.id),frozenPos);
  x.ac.resume();x.ctx._voices._resyncAfterResume();
  const v=x.ctx._voices._map[x.id];
  c('resume stops old source',old.stops,[0]);c('resume drops old chunks',v.streamChunks.length,0);
  c('resume frontier',x.host.voice_get_pos(x.id),512*x.frame);
  x.write();const live=x.ac.started[1];
  c('live scheduling',[live.at,live.offset,live.buffer.length,live.buffer.numberOfChannels,live.buffer.sampleRate,live.playbackRate.value],[vector.start,0,256,channels,1024,vector.rate/1024]);
  c('decoded left',Array.from(live.buffer.getChannelData(0)),Array(256).fill(bits===8?0.5:0.25));
  if(channels===2)c('decoded right',Array.from(live.buffer.getChannelData(1)),Array(256).fill(-0.5));
  c('source gain',live.edges[0]===v.gain,true);c('gain topology',graph(x),[true,true,true,true,true,1,0]);
  c('new epoch initial position',x.host.voice_get_pos(x.id),512*x.frame);
  x.ac.advance(vector.half);c('new epoch half chunk position',x.host.voice_get_pos(x.id),640*x.frame);
  x.write();c('second live starts contiguously',x.ac.started[2].at,vector.next);
  old.onended();c('late old callback keeps live sources',v.sources.has(live)&&v.sources.has(x.ac.started[2]),true);
  x.ac.advance(vector.half);c('new epoch first chunk end',x.host.voice_get_pos(x.id),768*x.frame);
  c('foreign unchanged',[foreign.ac.currentTime,foreign.host.voice_get_pos(foreign.id),foreign.ac.started.length,fsrc.stops,graph(foreign),Array.from(foreign.bytes)],[8,0,1,[],fgraph,foreignBytes]);
  rows.push({label,starts:x.ac.started.map(s=>s.at),position:x.host.voice_get_pos(x.id),expected:768*x.frame});
  x.host.voice_close(x.id);foreign.host.voice_close(foreign.id);
}
console.log(JSON.stringify({checks,failures,rows},null,2));
if(failures.length)process.exitCode=1;
