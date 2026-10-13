#!/usr/bin/env node
'use strict';
// Validate fixed-work P/PC game groups before reporting process CPU.
const fs=require('fs'),path=require('path'),assert=require('assert');
const {diffPng}=require('./png-diff');
const root=path.resolve(process.argv[2]);
const expected={mw3:1750,jazz2g:3000,sc:3500,blobby:1100,q2:1400,mh3:2270};
const result={};
for(const game of process.argv[3]?.split(',')||Object.keys(expected)){
  assert(expected[game],`unknown game ${game}`);
  const files=fs.readdirSync(root).filter(f=>f.startsWith(game+'-')&&f.endsWith('.log'));
  if(!files.length)continue;
  const rows=files.map(f=>{
    const log=fs.readFileSync(path.join(root,f),'utf8');
    assert(!/RuntimeError|ENOENT|WASM CRASH|FPU_UNIMPL|crash_unimplemented/.test(log),f);
    const stats=log.match(/^Stats: (\d+) API calls, (\d+) batches/m);
    assert(stats,`missing stats ${f}`);assert.equal(+stats[2],expected[game],`route truncated ${f}`);
    const cpu=log.match(/^user\s+([\d.]+)$/m);assert(cpu,f);
    const counters=log.match(/^uop(?:\[thread [^\]]+\])?: .*$/mg);assert(counters,f);
    const phases=[...log.matchAll(/batches (\d+)\.\.(\d+)\s+\d+ batches\s+guest ([\d.]+)s/g)]
      .map(m=>({from:+m[1],to:+m[2],guestWallSeconds:+m[3]}));
    const arm=f.slice(game.length+1,-4);
    assert(/^(p|pc)\d*$/.test(arm),arm);
    return {arm,variant:arm.replace(/\d+$/,''),userSeconds:+cpu[1],apiCalls:+stats[1],batches:+stats[2],counters,phases,png:path.join(root,f.replace(/\.log$/,'.png'))};
  });
  for(const r of rows){
    const d=diffPng(rows[0].png,r.png);
    r.matches={api:r.apiCalls===rows[0].apiCalls,
      counters:JSON.stringify(r.counters)===JSON.stringify(rows[0].counters),
      pixels:!d.sizeMismatch&&d.changed===0};
    r.changedPixels=d.changed;
    r.cpuWindows=[...fs.readFileSync(r.png.replace(/\.png$/,'.log'),'utf8').matchAll(
      /\[cpu-window\] batches (\d+)\.\.(?:run end \(asked (\d+)\)|(\d+)): user ([\d.]+)s sys ([\d.]+)s wall ([\d.]+)s/g)]
      .map(m=>({from:+m[1],to:+(m[2]||m[3]),user:+m[4],system:+m[5],wall:+m[6]}));
  }
  const summary={};
  for(const v of ['p','pc']){
    const samples=rows.filter(r=>r.variant===v).map(r=>r.userSeconds);assert(samples.length,v);
    const mean=samples.reduce((a,b)=>a+b,0)/samples.length;
    summary[v]={samples,mean,spreadPercent:100*(Math.max(...samples)-Math.min(...samples))/mean};
  }
  result[game]={acceptedFixedWork:rows.every(r=>Object.values(r.matches).every(Boolean)),
    rows,summary,changePercent:100*(summary.pc.mean/summary.p.mean-1)};
}
assert(Object.keys(result).length,'no game logs');
console.log(JSON.stringify(result,null,2));
