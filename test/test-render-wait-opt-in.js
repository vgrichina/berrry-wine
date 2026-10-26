'use strict';
// Offline production-hook contracts; no complete CLI/guest/renderer startup.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const {createRenderWaitAttribution} = require('../lib/render-wait-attribution');
const runner = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/render-park-control.json')));
const anchor = "  const renderWaitAttribution = hasFlag('trace-render-wait') ? createRenderWaitAttribution() : null;";
function cut(source, a, b) {
  assert.equal(source.split(a).length, 2, `unique production anchor: ${a}`);
  const i = source.indexOf(a), j = source.indexOf(b, i); assert(j > i);
  return source.slice(i, j);
}
const hooks = cut(runner, anchor, '  let lastSchedSig = null;');
const terminal = cut(runner, "  renderWaitAttribution?.close(deadlineMs", '  if (PRESENT_CAP &&');
const parser = cut(runner, 'const hasFlag = name =>', '\n');
const micro = async () => {for (let i=0;i<24;i++) await Promise.resolve();};
function harness(args, old=false, mutate=x=>x) {
  const clock={now:0}, trace=[], timers=[], logs=[], ctx={d3d9Bridge:{requests:new Map()}};
  let reason=16, token=-2, creates=0, resolve, reject;
  const pending=new Promise((a,b)=>{resolve=a;reject=b;});
  ctx.waitD3DRender = t => {trace.push(['wait',t]); return pending;};
  const sandbox={args, ctx, createRenderWaitAttribution:()=>{creates++; return createRenderWaitAttribution();},
    instance:{exports:{get_yield_reason:()=>reason,get_d3d_render_token:()=>token,clear_yield:()=>{reason=0;trace.push('clear');}}},
    threadManager:{isMainNamedEventWaiting:()=>false,_renderSendTargets:new Set(),noteMainSleep:()=>trace.push('sleep'),isMainSleeping:()=>false,isMainThreadSuspended:()=>false},
    tickState:{batch:3,pausedMs:0},REAL_TICK_SLEEPS:true,Date:{now:()=>clock.now},
    console:{error:(...x)=>trace.push(['error',x[1].message]),log:x=>logs.push(x)},
    setTimeout:(fn,ms)=>{trace.push(['timer',ms]);timers.push(fn);}};
  vm.createContext(sandbox);
  vm.runInContext(`${parser}\nlet stopped=false,deadlineMs=0;
    ${old ? baseline.hooks : mutate(hooks)}
    globalThis.api={check:mainExecutionSuspended,park:awaitMainRenderPark,wait:()=>mainRenderWait,
      stop:()=>{stopped=true;},deadline:n=>{deadlineMs=n;},
      close:()=>{${old?'':mutate(terminal)}},stats:renderParkStats};`,sandbox);
  return {...sandbox.api,ctx,clock,trace,timers,logs,resolve,reject,creates:()=>creates};
}
async function schedule(args, kind, old=false, mutate=x=>x) {
  const h=harness(args,old,mutate);
  const enabled=!old && args.includes('--trace-render-wait');
  assert.equal(h.creates(),enabled?1:0,'factory must be opt-in');
  assert.equal(Object.hasOwn(h.ctx,'renderWaitAttribution'),enabled,'ctx must be opt-in');
  if (kind==='idle') {
    h.close(); assert.deepEqual(h.logs,[]); return h;
  }
  const record={renderWaitOperation:'DRAW',renderWaitReadyAt:null};h.ctx.d3d9Bridge.requests.set(-2,record);
  assert.equal(h.check(),true); assert.equal(h.check(),true);
  const wait=h.wait();
  assert.equal(Object.hasOwn(wait,'attribution'),enabled,'begin must be opt-in');
  if(enabled) assert.equal(h.ctx.renderWaitAttribution.requests,1);
  const park=h.park();await micro();
  if(kind==='deadline'||kind==='stop') {
    if(kind==='deadline')h.deadline(99);else h.stop();
    h.clock.now=100;assert.equal(h.timers.length,1);h.timers.shift()();await park;h.close();
    if(enabled)assert.equal(h.ctx.renderWaitAttribution[kind==='stop'?'stopped':'deadline'],1);
    h.resolve(7);await micro();
    if(enabled)assert.equal(h.ctx.renderWaitAttribution.lateSettlements,1);
  } else {
    h.clock.now=25;record.renderWaitReadyAt=20;
    if(kind==='reject')h.reject(new Error('controlled rejection'));else h.resolve(7);
    await park;await micro();assert.equal(h.check(),false);h.close();
    if(enabled) {
      const s=h.ctx.renderWaitAttribution;
      assert.equal(s[kind==='reject'?'rejected':'completed'],1);
      assert.equal(s.parkMs,25);assert.equal(s.bridgePendingMs,20);assert.equal(s.readyToResumeMs,5);
    }
  }
  if(args.includes('--no-render-park-wait'))assert.equal(h.stats.waits,0);
  else {assert.equal(h.stats.waits,1);assert.equal(h.stats.wallMs,kind==='deadline'||kind==='stop'?100:25);}
  assert.equal(h.logs.length,enabled?1:0,'summary must be opt-in');
  if(enabled)assert.match(h.logs[0],/^render attribution:/);
  return h;
}
async function main() {
  const flags=[[],['--trace'],['--trace-render-wait=1'],['--trace-render-wait-extra'],['--trace-render-wait']];
  let count=0;
  for(const args of flags)for(const kind of ['idle','success','reject','deadline','stop']) {
    const h=await schedule(args,kind), b=await schedule(args,kind,true);
    assert.deepEqual(h.trace,b.trace,`legacy effects ${args}/${kind}`);
    assert.equal(JSON.stringify(h.stats),JSON.stringify(b.stats));count++;
  }
  // no-render-park-wait is independent from diagnostic opt-in.
  for(const args of [['--no-render-park-wait'],['--trace-render-wait','--no-render-park-wait']]) {
    const h=harness(args),b=harness(args,true);h.check();b.check();await h.park();await b.park();
    h.resolve(7);b.resolve(7);await micro();h.check();b.check();h.close();b.close();
    assert.equal(h.stats.waits,0);assert.deepEqual(h.trace,b.trace);count++;
  }
  console.log(`PASS ${count} actual CLI-parser/init/hooks/summary cases; baseline return/error/order/100ms/deadline/waits unchanged`);
  const challenges=[
    ['factory-gate',x=>x.replace("hasFlag('trace-render-wait') ? createRenderWaitAttribution() : null",'createRenderWaitAttribution()'),[], 'success'],
    ['factory-disabled',x=>x.replace("hasFlag('trace-render-wait') ? createRenderWaitAttribution() : null",'null'),['--trace-render-wait'],'success'],
    ['ctx-exposure',x=>x.replace('if (renderWaitAttribution) ctx.renderWaitAttribution = renderWaitAttribution.stats;',''),['--trace-render-wait'],'success'],
    ['begin-hook',x=>x.replace('renderWaitAttribution?.begin(wait, ctx.d3d9Bridge?.requests.get(token));',''),['--trace-render-wait'],'success'],
    ['reject-hook',x=>x.replace('renderWaitAttribution?.reject(wait);',''),['--trace-render-wait'],'reject'],
    ['settle-hook',x=>x.replace('renderWaitAttribution?.settle(wait);',''),['--trace-render-wait'],'success'],
    ['park-start',x=>x.replace('renderWaitAttribution?.parkStart(wait, started);',''),['--trace-render-wait'],'success'],
    ['park-end',x=>x.replace(/renderWaitAttribution\?\.parkEnd\(wait, renderParkEnded,[\s\S]*?'pending'\)\);/,''),['--trace-render-wait'],'success'],
    ['close-hook',x=>x.replace("renderWaitAttribution?.close(deadlineMs && Date.now() > deadlineMs ? 'deadline' : 'stopped');",''),['--trace-render-wait'],'idle'],
    ['summary-output',x=>x.replace('console.log(renderWaitAttribution.summary());',''),['--trace-render-wait'],'success'],
    ['summary-null-guard',x=>x.replace('renderWaitAttribution?.stats.requests','renderWaitAttribution.stats.requests'),[],'success'],
    ['legacy-waits',x=>x.replace('renderParkStats.waits++;',''),[],'success'],
  ];
  // close() has no visible idle output; challenge its invocation with a trap at
  // the actual terminal boundary, including default-off suppression.
  challenges.splice(challenges.findIndex(x=>x[0]==='close-hook'),1);
  for(const [name,mutate,args,kind] of challenges) {
    assert.notEqual(mutate(hooks)+mutate(terminal),hooks+terminal,`challenge matches ${name}`);
    await assert.rejects(()=>schedule(args,kind,false,mutate),undefined,`omitted ${name} must reject`);
  }
  // Terminal-close boundary with actual helper replaced by an observing delegate.
  for(const enabled of [false,true]) {
    const calls=[];const diag={stats:{requests:0},close:x=>calls.push(x)};
    const code=`const renderWaitAttribution=${enabled?'diag':'null'};const deadlineMs=9;${terminal}`;
    vm.runInNewContext(code,{diag,Date:{now:()=>10},console});
    assert.deepEqual(calls,enabled?['deadline']:[]);
    if(enabled) {
      calls.length=0;
      vm.runInNewContext(code.replace("renderWaitAttribution?.close(deadlineMs && Date.now() > deadlineMs ? 'deadline' : 'stopped');",''),{diag,Date:{now:()=>10},console});
      assert.throws(()=>assert.deepEqual(calls,['deadline']),assert.AssertionError);
    }
  }
  console.log(`PASS ${challenges.length+1} independent omitted-control rejections on production boundaries`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
