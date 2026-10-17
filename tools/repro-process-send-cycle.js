'use strict';

// Intentionally failing progress oracle for the HELD PID-owned broker.
// Uses real Node Workers for callback execution; does not execute guest WAT.
const assert = require('node:assert/strict');
const {Worker, isMainThread, parentPort} = require('node:worker_threads');

if (!isMainThread) {
  const replies = new Map();
  parentPort.on('message', async m => {
    if (m.type === 'reply') {
      const pending = replies.get(m.id);
      replies.delete(m.id);
      if (m.error) pending.reject(new Error(m.error));
      else pending.resolve(m.result);
      return;
    }
    if (m.type === 'invoke') {
      try {
        if (m.message.root) {
          const result = await new Promise((resolve, reject) => {
            replies.set(m.id, {resolve, reject});
            parentPort.postMessage({type:'entered', id:m.id});
          });
          parentPort.postMessage({type:'done', id:m.id, result:result + 1});
        } else parentPort.postMessage({type:'done', id:m.id, result:41});
      } catch (e) { parentPort.postMessage({type:'done', id:m.id, error:e.message}); }
    }
  });
} else {
  const {ProcessSendBroker} = require('../lib/process-send-broker');
  const admission = process.argv.includes('--admission');
  const turn = () => new Promise(resolve => setImmediate(resolve));
  const bounded = p => Promise.race([p, new Promise(resolve => setTimeout(() => resolve('blocked'), 150))]);
  async function scenario(kind) {
    const broker = new ProcessSendBroker(), workers = [], frames = new Map();
    let serial = 0, entered = 0, rootsReady;
    const ready = new Promise(resolve => { rootsReady = resolve; });
    const roots = kind === 'cycle' ? 2 : 1;
    function thread() {
      const worker = new Worker(__filename); workers.push(worker);
      worker.on('error', e => { for (const f of frames.values()) f.reject(e); });
      worker.on('message', m => {
        const f = frames.get(m.id);
        if (m.type === 'entered') {
          f.waiting = true;
          if (admission) f.leaveWait = broker.enterWait(f.context, worker,
            { frameToken: f.id, waitEpoch: f.id });
          if (++entered === roots) rootsReady();
        } else {
          frames.delete(m.id);
          if (m.error) f.reject(new Error(m.error));
          else f.resolve({done:true,result:m.result});
        }
      });
      const dispatch = (message, context) => new Promise((resolve, reject) => {
        const id = ++serial;
        frames.set(id, {id, worker, message, context, resolve, reject});
        worker.postMessage({type:'invoke', id, message});
      });
      dispatch.link = worker;
      return dispatch;
    }
    const aThread = thread(), bThread = thread();
    const a = broker.register(100, {dispatch:aThread,
      ...(admission ? {resolve: () => aThread.link} : {})});
    const b = broker.register(200, {dispatch:kind === 'cycle' ? bThread :
      (m,c) => (m.tid === 1 ? aThread : bThread)(m,c),
      ...(admission ? {resolve: m => kind === 'cycle' ? bThread.link :
        (m.tid === 1 ? aThread.link : bThread.link)} : {})});
    const source = broker.register(300, {dispatch:() => {throw new Error('unexpected callback');}});
    const pending = [], observe = p => { pending.push(p); p.catch(() => {}); return p; };
    try {
      if (kind === 'cycle') {
        // Independent incoming frames, then each receiver synchronously sends
        // to the other while waiting. Both sends retain their real contexts.
        observe(broker.send(source,a,{root:true}));
        observe(broker.send(source,b,{root:true}));
      } else observe(broker.send(source,b,{root:true,tid:1}));
      await ready;
      if (kind === 'cycle') {
        for (const f of frames.values()) {
          const sender = f.context.request.receiver;
          const nested = observe(broker.send(sender,sender === a ? b : a,{leaf:true},f.context,f.worker));
          nested.then(async result => {
            if (f.leaveWait) await f.leaveWait();
            f.worker.postMessage({type:'reply',id:f.id,result});
          },
            e => f.worker.postMessage({type:'reply',id:f.id,error:e.message}));
        }
      } else observe(broker.send(source,b,{leaf:true,tid:2}));
      await turn();
      // Readiness cannot bypass the chain predicate. No ordinary guest code
      // runs here; both root callbacks are parked awaiting replies.
      broker.notifyReady(a); broker.notifyReady(b);
      const progress = kind === 'cycle' ? Promise.all(pending) : pending[1];
      const result = await bounded(progress);
      console.log(JSON.stringify({kind, result, endpoints:[a,b].map(e => ({
        pid:e.pid, active:e.stack.length, queued:e.queue.length,
        deferred:e.queue.map(r => r.deferred),
        independent:e.queue.map(r => r.chain !== e.stack.at(-1)?.chain),
      })), callbackFrames:frames.size}));
      assert.notEqual(result,'blocked',kind === 'cycle'
        ? 'independent A -> B and B -> A sends must progress while both receiver threads wait'
        : 'receiver thread 2 must progress while receiver thread 1 has a suspended callback');
      if (kind === 'cycle') assert.deepEqual(result,[42,42,41,41]);
      else assert.equal(result,41);
    } finally {
      for (const e of [source,a,b]) broker.retire(e);
      for (const f of frames.values()) f.reject(new Error('reproducer cleanup'));
      await Promise.allSettled(pending);
      await Promise.all(workers.map(w => w.terminate()));
    }
  }
  const deadline = setTimeout(() => { console.error('reproducer setup stalled'); process.exit(2); },5000);
  (async () => {
    for (const kind of ['cycle','threads']) {
      try { await scenario(kind); }
      catch (e) { console.error(e.message); process.exitCode = 1; }
    }
  })().finally(() => clearTimeout(deadline));
}
