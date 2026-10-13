'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');

// Sampling is wall-time attribution, including blocking native calls. It is
// deliberately not labelled CPU utilization. Explicit waits are recorded too.
exports.start = async function start(page) {
  const targets = [{ label:'page', session:await page.target().createCDPSession() }];
  for (const [i,w] of page.workers().entries()) {
    assert(w.client, 'Worker CDP session unavailable');
    targets.push({label:`worker-${i}-${new URL(w.url()).pathname.split('/').pop()}`, session:w.client});
  }
  await Promise.all(targets.map(async t => {
    await t.session.send('Profiler.enable');
    await t.session.send('Profiler.setSamplingInterval',{interval:500});
    await t.session.send('Profiler.start');
  }));
  return async (output, sample) => Promise.all(targets.map(async t => {
    const {profile} = await t.session.send('Profiler.stop');
    const file = `profile-${sample}-${t.label}.cpuprofile`;
    fs.writeFileSync(path.join(output,file), JSON.stringify(profile));
    const nodes = new Map(profile.nodes.map(n=>[n.id,n]));
    const rows = new Map(), buckets = {};
    for(let i=0;i<profile.samples.length;i++) {
      const f=nodes.get(profile.samples[i]).callFrame, ms=(profile.timeDeltas[i]||0)/1000;
      const name=f.functionName||'(anonymous)', key=`${name} ${f.url}:${f.lineNumber+1}`;
      const bucket=name==='(idle)'?'idle':name==='(garbage collector)'?'gc':
        f.url.startsWith('wasm:')?'wasm':name==='(program)'?'program':'host';
      buckets[bucket]=(buckets[bucket]||0)+ms; rows.set(key,(rows.get(key)||0)+ms);
    }
    return {label:t.label,file,startTime:profile.startTime,endTime:profile.endTime,
      buckets,top:[...rows].sort((a,b)=>b[1]-a[1]).slice(0,35)};
  }));
};
