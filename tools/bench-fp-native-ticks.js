#!/usr/bin/env node
'use strict';
// Attribute V8 --prof leaf PCs using the SAME run's --perf-prof code map.
// Samples outside emitted WASM objects remain unattributed (JS/host/compiler).
const fs=require('fs'),path=require('path'),assert=require('assert');
const dir=path.resolve(process.argv[2]);
const funcs=JSON.parse(fs.readFileSync(dir+'/all-functions.json'));
const logs=fs.readdirSync(dir).filter(n=>n.endsWith('v8.log'));assert.equal(logs.length,1);
const ticks=fs.readFileSync(dir+'/'+logs[0],'utf8').split('\n').filter(s=>s.startsWith('tick,'));
const counts=new Map(),pcs=new Map();let wasm=0;
for(const tick of ticks){
  const pc=Number(tick.split(',')[1]);
  const hit=funcs.find(f=>pc>=Number(f.address)&&pc<Number(f.address)+f.bytes);
  if(!hit)continue;wasm++;counts.set(hit.name,(counts.get(hit.name)||0)+1);
  if(hit.name.includes('x87_island_fast')){
    const offset=pc-Number(hit.address),key=hit.name+'+'+offset.toString(16);
    const v=pcs.get(key)||{name:hit.name,offset,address:pc,count:0};v.count++;pcs.set(key,v);
  }
}
const top=[...counts].sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count,percentAll:100*count/ticks.length,percentWasm:100*count/wasm}));
const hot=[...pcs.values()].sort((a,b)=>b.count-a.count).slice(0,30).map(v=>{
  const file=dir+'/'+v.name+'.asm';
  const asm=fs.existsSync(file)?fs.readFileSync(file,'utf8').split('\n'):[];
  const i=asm.findIndex(s=>s.trimStart().startsWith(v.address.toString(16)+':'));
  return {...v,context:i<0?[]:asm.slice(Math.max(0,i-3),i+4)};
});
console.log(JSON.stringify({ticks:ticks.length,wasmTicks:wasm,unattributed:ticks.length-wasm,top,hot},null,2));
