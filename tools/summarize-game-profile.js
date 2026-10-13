#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path'), assert=require('assert');
const file=process.argv[2];
if(!file) throw Error('usage: summarize-game-profile.js RESULT.json');
const report=JSON.parse(fs.readFileSync(file));
const union = spans => {
  const out=[];
  for(const [a,b] of spans.sort((a,b)=>a[0]-b[0])) {
    if(b<=a)continue;
    if(out.length && a<=out.at(-1)[1])out.at(-1)[1]=Math.max(b,out.at(-1)[1]);
    else out.push([a,b]);
  }
  return out;
};
const duration = spans => spans.reduce((s,[a,b])=>s+b-a,0);
const intersection = (a,b) => {
  let i=0,j=0,ms=0;
  while(i<a.length && j<b.length) {
    ms+=Math.max(0,Math.min(a[i][1],b[j][1])-Math.max(a[i][0],b[j][0]));
    if(a[i][1]<b[j][1])i++;else j++;
  }
  return ms;
};
const results=report.results.map(s=>{
  const clip = spans => union(spans.map(([a,b])=>[Math.max(a,s.before.at),Math.min(b,s.after.at)]));
  const waits=clip(s.after.guest.flatMap(g=>g.waits||[]));
  const runs=clip(s.after.guest.flatMap(g=>g.runs||[]));
  assert(s.frameProducers.length===1 && s.after.guest.length===1, 'Single guest thread required for wall decomposition');
  const runMs=duration(runs),waitMs=duration(waits),overlap=intersection(runs,waits);
  const transfers={};
  for(const kind of ['readPixels','uploadGL']) {
    const spans=clip((s.after.renderSpans||[]).flatMap(w=>w.spans.filter(a=>a[0]===kind).map(a=>a.slice(1))));
    const ms=duration(spans),blocked=intersection(spans,waits);
    transfers[kind]={msPerPresent:ms/s.frames,overlappingGuestWaitMsPerPresent:blocked/s.frames,
      overlapFraction:ms?blocked/ms:null};
  }
  const profiles=(s.profiles||[]).map(p=>{
    const profile=JSON.parse(fs.readFileSync(path.join(path.dirname(file),p.file)));
    const nodes=new Map(profile.nodes.map(n=>[n.id,n]));
    const buckets={wasm:0,wait:0,host:0,idle:0,gc:0,program:0};
    for(let i=0;i<profile.samples.length;i++) {
      const f=nodes.get(profile.samples[i]).callFrame,ms=profile.timeDeltas[i]/1000;
      const k=f.functionName==='(idle)'?'idle':f.functionName==='(garbage collector)'?'gc':
        f.functionName==='(program)'?'program':f.functionName==='Atomics.wait'?'wait':
        f.url.startsWith('wasm:')?'wasm':'host';
      buckets[k]+=ms;
    }
    const total=Object.values(buckets).reduce((a,b)=>a+b,0);
    return {label:p.label,sampledMs:total,estimatedMsPerPresent:Object.fromEntries(Object.entries(buckets)
      .map(([k,v])=>[k,v/total*s.seconds*1000/s.frames]))};
  });
  return {frames:s.frames,fps:s.fps,p95:s.p95,load:s.loadAfter,
    guestWallMsPerPresent:runs.length?{runExcludingWait:(runMs-overlap)/s.frames,
      atomicWait:waitMs/s.frames,outsideRunAndWait:(s.seconds*1000-runMs-waitMs+overlap)/s.frames}:null,
    transfers,profiles};
});
console.log(JSON.stringify({wasmSha256:report.wasmSha256,results},null,2));
