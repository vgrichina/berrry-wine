'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {createWorkerTasks} = require('./mw3-private-worker-tasks.cjs');
const attach = (sessionId, url='/lib/guest-worker.js?integration=1') => ({
  method:'Target.attachedToTarget', params:{sessionId,
    targetInfo:{targetId:'target-'+sessionId,type:'worker',url}},
});
const include = t => t.url.includes('integration=1') || t.url.includes('d3d-render-worker');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('short-lived scoped controls issue no background debugger requests', async () => {
  const calls=[], t=createWorkerTasks({send:async(...args)=>calls.push(args),include});
  t.handle(attach('fixture','/lib/guest-worker.js?fixtureMode=active'));
  t.handle({method:'Debugger.scriptParsed',sessionId:'fixture',params:{scriptId:'gone',url:'wasm://module'}});
  t.handle({method:'Target.detachedFromTarget',params:{sessionId:'fixture'}});
  await t.drain();assert.equal(t.workers.size,0);assert.deepEqual(calls,[]);
});

test('actual Session-not-found rejection wakes awaiting owner and permits awaited cleanup', async () => {
  const fault=Error('Session with given id not found.'), calls=[], cleanup=[];
  let rejectTransport;
  const t=createWorkerTasks({include,send:(...args)=>{
    calls.push(args);return new Promise((resolve,reject)=>{rejectTransport=reject;});
  }});
  const unhandled=[];const onUnhandled=e=>unhandled.push(e);
  process.on('unhandledRejection',onUnhandled);
  try {
    const owner=(async()=>{
      try { await t.run(async()=>{t.handle(attach('owned'));await new Promise(()=>{});}); }
      finally { await tick();cleanup.push('Chrome close/wait');await tick();cleanup.push('stdout EOF','stderr EOF'); }
    })();
    const outcome=assert.rejects(owner,e=>e===fault);
    await tick();rejectTransport(fault);await outcome;await tick();
    assert.deepEqual(cleanup,['Chrome close/wait','stdout EOF','stderr EOF']);
    assert.deepEqual(unhandled,[]);assert.equal(calls.length,1);
    assert.throws(()=>t.handle(attach('later')),e=>e===fault);
    await assert.rejects(t.drain(),e=>e===fault);
    await assert.rejects(t.run(()=>assert.fail('no later work')),e=>e===fault);
    assert.equal(calls.length,1);
  } finally {process.removeListener('unhandledRejection',onUnhandled);}
});

test('module source capture retains exact session and authentic byte hash', async () => {
  const bytes=Buffer.from('actual supplied module bytes'),calls=[];
  const t=createWorkerTasks({include,send:async(...args)=>{calls.push(args);return {bytecode:bytes.toString('base64')};}});
  t.handle(attach('guest'));t.handle(attach('render','/lib/d3d-render-worker.js'));
  t.handle({method:'Debugger.scriptParsed',sessionId:'render',params:{scriptId:'wasm-1',scriptLanguage:'WebAssembly',url:'wasm://module'}});
  await t.run(()=>t.drain());
  assert.deepEqual(calls.at(-1),['Debugger.getScriptSource',{scriptId:'wasm-1'},'render']);
  assert.equal(t.workers.get('render').scripts[0].sha256,require('node:crypto').createHash('sha256').update(bytes).digest('hex'));
  t.handle({method:'Target.detachedFromTarget',params:{sessionId:'render'}});
  assert(t.workers.get('render').closed);assert(!t.workers.get('guest').closed);
});

test('synchronous transport throws and missing module bytes remain terminal', async () => {
  for(const mode of ['throw','missing']){
    const fault=Error('transport');
    const t=createWorkerTasks({include,send:()=>{if(mode==='throw')throw fault;return {};}});
    t.handle(attach('owned'));
    if(mode==='missing'){
      await t.drain();t.handle({method:'Debugger.scriptParsed',sessionId:'owned',params:{scriptId:'wasm',url:'wasm://x'}});
    }
    await assert.rejects(t.drain(),mode==='throw'?e=>e===fault:/actual private Worker module bytes/);
    assert.throws(t.check);
  }
});

test('event listener faults wake the owner without throwing out of its cleanup scope', async () => {
  const t=createWorkerTasks({include,send:async()=>({})});
  t.observe(attach('same'));await t.drain();
  const owner=t.run(()=>new Promise(()=>{}));
  const outcome=assert.rejects(owner,/duplicate private Worker session/);
  assert.doesNotThrow(()=>t.observe(attach('same')));
  await outcome;
  assert.doesNotThrow(()=>t.observe(attach('later')));
  assert.equal(t.workers.size,1);
});

test('a resumed in-flight body cannot send after background failure when transport is guarded', async () => {
  const fault=Error('Session with given id not found.');
  let releaseBody, rejectBackground, t, calls=0;
  const send=()=>{t.check();calls++;return new Promise((resolve,reject)=>{rejectBackground=reject;});};
  t=createWorkerTasks({include,send});
  const suspended=new Promise(resolve=>{releaseBody=resolve;});
  const owner=t.run(async()=>{
    t.observe(attach('owned'));
    await suspended;
    await send('later');
  });
  const outcome=assert.rejects(owner,e=>e===fault);
  await tick();rejectBackground(fault);await outcome;
  releaseBody();await tick();assert.equal(calls,1);
});
