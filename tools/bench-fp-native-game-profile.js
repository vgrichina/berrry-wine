#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const [profileDir,nativeDir]=process.argv.slice(2);
const result={};
for(const variant of ['control','p','a','pa']){
  const dir=path.join(profileDir,'mh3-'+variant+'.cpuprofile');
  const profile=JSON.parse(fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(n=>n.endsWith('.cpuprofile')))));
  const names=new Map(JSON.parse(fs.readFileSync(path.join(nativeDir,variant,'all-functions.json'))).map(f=>[f.index,f.name]));
  const nodes=new Map(profile.nodes.map(n=>[n.id,n.callFrame]));const sums=new Map();let total=0,wasm=0;
  for(let i=0;i<profile.samples.length;i++){
    const f=nodes.get(profile.samples[i]),ms=profile.timeDeltas[i]/1000;
    const m=/wasm-function\[(\d+)\]/.exec(f.functionName);
    const name=m?(names.get(+m[1])||f.functionName):f.functionName;
    total+=ms;if(m)wasm+=ms;sums.set(name,(sums.get(name)||0)+ms);
  }
  const top=[...sums].sort((a,b)=>b[1]-a[1]).map(([name,ms])=>({name,ms,percentTotal:100*ms/total}));
  result[variant]={totalMs:total,wasmMs:wasm,top};
}
console.log(JSON.stringify(result,null,2));
