'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { WorkerLink, GuestThreadHost } = require('../lib/guest-thread-host');
const { SharedPacketPool, SubmissionQueue, PublicationQueue, SnapshotInbox } = require('../lib/render-worker');

async function testSnapshotPublication(){
  const q=new PublicationQueue(new SharedArrayBuffer(64+256)),inbox=new SnapshotInbox(q),messages=[],order=[];
  const value={vertices:new Uint8Array(1024*1024),constants:new Float32Array([1.25])};value.vertices[0]=91;
  q.publishSnapshot(4,2,{value,bytes:1024*1024+128},message=>messages.push(structuredClone(message)),()=>{});
  value.vertices[0]=0;value.constants[0]=9;
  q.publish(1,0,new Uint8Array([7]),()=>{});
  const drain=q.drain(group=>group.api===4?inbox.consume(group,packet=>{
    assert.equal(packet.vertices[0],91);assert.equal(packet.constants[0],1.25);order.push('snapshot');
  }):order.push('GL'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepStrictEqual(order,[],'other producer wake cannot overtake a late payload');
  assert.equal(Atomics.load(q.control,10),1024*1024+128,'unadmitted payload retains byte credit');
  inbox.receive(messages[0]);await drain;
  assert.deepStrictEqual(order,['snapshot','GL']);assert.equal(Atomics.load(q.control,10),0);
  assert.equal(Atomics.load(q.control,11),0);
  assert.throws(()=>inbox.receive(messages[0]),/duplicate/,'consumed identities cannot be replayed');

  const bad=new PublicationQueue(new SharedArrayBuffer(64+128)),badInbox=new SnapshotInbox(bad);
  bad.publishSnapshot(4,1,{value:{},bytes:32},message=>badInbox.receive({...message,owner:2}),()=>{});
  await assert.rejects(bad.drain(group=>badInbox.consume(group,()=>assert.fail('wrong owner admitted'))),/mismatch/);

  // An actual blocked producer must wake on either admission or failure.
  const {Worker}=require('worker_threads');
  for(const fail of [false,true]){
    const queue=new PublicationQueue(new SharedArrayBuffer(64+128)),receiver=new SnapshotInbox(queue),gate=deferred();
    let received=0,accepted=0;const errors=[];
    const worker=new Worker(`
      const {parentPort,workerData:d}=require('worker_threads');
      const {PublicationQueue}=require(d.module),q=new PublicationQueue(d.buffer);
      try {for(let i=0;i<2;i++)q.publishSnapshot(4,0,{value:i,bytes:40*1024*1024},
        packet=>parentPort.postMessage(packet),()=>parentPort.postMessage({wake:true}));
        q.fence(()=>parentPort.postMessage({wake:true}));parentPort.postMessage({done:true});
      }catch(error){parentPort.postMessage({error:error.message});}
    `,{eval:true,workerData:{module:require.resolve('../lib/render-worker'),buffer:queue.buffer}});
    const timer=setTimeout(()=>receiver.fail(Error('test timeout')),5000);
    try{
      const result=await new Promise((resolve,reject)=>{
        worker.on('error',reject);worker.on('message',message=>{
          if(message.t==='renderSnapshot'){
            received++;receiver.receive(message);
          }else if(message.wake){
            queue.drain(group=>receiver.consume(group,async()=>{
              if(!accepted){await gate.promise;if(fail)throw Error('consumer failed');}
              accepted++;
            })).catch(error=>errors.push(error.message));
          }else resolve(message);
        });
        const release=setInterval(()=>{
          if(received===1){clearInterval(release);
            setTimeout(()=>{assert.equal(received,1,'byte budget parks second snapshot');gate.resolve();},20);
          }
        },1);
        worker.once('exit',()=>clearInterval(release));
      });
      if(fail){assert.match(result.error,/closed or failed/);assert(errors.includes('consumer failed'));}
      else {assert(result.done);assert.equal(accepted,2);assert.equal(Atomics.load(queue.control,10),0);}
    }finally{clearTimeout(timer);receiver.fail();await worker.terminate();}
  }
}

async function testPublicationQueue(){
  const q=new PublicationQueue(new SharedArrayBuffer(64+256));let wakes=0;
  const notify=()=>wakes++,data=new Uint8Array([1,2,3,4]);
  assert.strictEqual(q.allocateProducerId(),1);
  assert.strictEqual(new PublicationQueue(q.buffer).allocateProducerId(),2,
    'producer incarnations belong to shared process storage');
  const exhausted=new PublicationQueue(new SharedArrayBuffer(64+64));
  Atomics.store(exhausted.control,9,-2);
  assert.strictEqual(exhausted.allocateProducerId(),0xffffffff);
  assert.throws(()=>exhausted.allocateProducerId(),/identity exhausted/,'identity must not wrap to another owner');
  q.publish(1,0,data,notify);data.fill(9);q.publish(1,0,data,notify);q.publish(2,1,data,notify);
  assert.strictEqual(wakes,1,'coalesce wake-ups across APIs');
  assert.strictEqual(q.withEmpty(()=>assert.fail('must retain dirty ownership')),false);
  const seen=[];await q.drain(group=>seen.push(group));
  assert.strictEqual(seen.length,2,'only adjacent packets of one API and owner coalesce');
  assert.deepStrictEqual([...seen[0].packets[0]],[1,2,3,4],'immutable after producer reuse');
  assert.strictEqual(seen[0].packets.length,2);
  let cleared=false;assert(q.withEmpty(()=>{cleared=true;}));assert(cleared);
  Atomics.store(q.control,0,1);
  assert.strictEqual(q.withEmpty(()=>assert.fail('producer owns publication lock')),false);
  Atomics.store(q.control,0,0);
  Atomics.store(q.control,1,-12);Atomics.store(q.control,2,-12);
  q.publish(3,7,data,notify);await q.drain(group=>assert.deepStrictEqual([...group.packets[0]],[9,9,9,9]));
  assert.strictEqual(Atomics.load(q.control,1),8,'cursor and split record wrap');
  assert.strictEqual(q.publish(1,0,data,notify,()=>false),false);
  assert.strictEqual(Atomics.load(q.control,1),Atomics.load(q.control,2),'rejected ownership does not publish');
  const {Worker}=require('worker_threads'),shared=new PublicationQueue(new SharedArrayBuffer(64+128));
  const code=`const {parentPort,workerData}=require('worker_threads');
    const {PublicationQueue}=require(workerData.module);
    const q=new PublicationQueue(workerData.buffer),notify=()=>parentPort.postMessage('wake');
    try{for(let i=0;i<100;i++)q.publish(workerData.api,workerData.api,new Uint8Array([i]),notify);
      q.fence(notify);parentPort.postMessage('done');}catch(e){parentPort.postMessage({error:e.message});}`;
  const workers=[],values=new Map([[1,[]],[2,[]]]),drains=[];
  const timeout=setTimeout(()=>shared.fail(),10000);
  try{await Promise.all([1,2].map(api=>new Promise((resolve,reject)=>{
    const worker=new Worker(code,{eval:true,workerData:{module:require.resolve('../lib/render-worker'),buffer:shared.buffer,api}});workers.push(worker);
    worker.on('error',reject);worker.on('message',message=>{
      if(message==='done')resolve();else if(message?.error)reject(new Error(message.error));
      else drains.push(shared.drain(async group=>{
        await new Promise(r=>setImmediate(r));
        for(const packet of group.packets)values.get(group.api).push(packet[0]);
      }));
    });
  })));await Promise.all(drains);
  for(const value of values.values())assert.deepStrictEqual(value,Array.from({length:100},(_,i)=>i));
  }finally{clearTimeout(timeout);shared.fail();await Promise.all(workers.map(w=>w.terminate()));}
  const bad=new PublicationQueue(new SharedArrayBuffer(64+128));bad.publish(1,0,data,()=>{});
  await assert.rejects(bad.drain(()=>{throw new Error('consumer failed');}),/consumer failed/);
  assert.throws(()=>bad.publish(1,0,data,()=>{}),/closed or failed/);
  assert.throws(()=>bad.fence(()=>{}),/closed or failed/);
  const lost=new PublicationQueue(new SharedArrayBuffer(64+128));
  assert.throws(()=>lost.publish(1,0,data,()=>{throw new Error('transport lost');}),/transport lost/);
  assert.throws(()=>lost.fence(()=>{}),/closed or failed/);
}

function testSharedPacketPool() {
  const pool = new SharedPacketPool(), buffer = new SharedArrayBuffer(256);
  const starts = [0, 32, 64];
  pool.register('gl', buffer, starts, 32);
  starts[0] = 128; // caller cannot change the registered layout
  assert.strictEqual(pool.register('gl', buffer, [64, 0, 32], 32), pool);
  assert.throws(() => pool.register('gl', buffer, [128], 32), /retire/);
  assert.throws(() => pool.register('d3d', buffer, [16], 32), /another owner/);
  pool.register('d3d', buffer, [96], 32); // touching boundaries do not overlap
  for (const offsets of [[0, 16], [0, 0]])
    assert.throws(() => new SharedPacketPool().register(1, buffer, offsets, 32), /overlapping/);
  for (const offsets of [[-1], [225], [0.5], [NaN], [Number.MAX_SAFE_INTEGER], []])
    assert.throws(() => new SharedPacketPool().register(1, buffer, offsets, 32));
  for (const capacity of [0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER])
    assert.throws(() => new SharedPacketPool().register(1, buffer, [0], capacity));
  assert.throws(() => pool.register(2, new ArrayBuffer(256), [0], 32), /shared/);
  assert.throws(() => pool.claim('missing', 0, 1), /unregistered/);
  for (const [offset, bytes] of [[1, 1], [128, 1], [0, 33], [0, -1], [0, 0.5], [0, NaN]])
    assert.throws(() => pool.claim('gl', offset, bytes), /invalid/);
  const leases = [0, 32, 64].map(offset => pool.claim('gl', offset, 32));
  for (const offset of [0, 32, 64]) assert.throws(() => pool.claim('gl', offset, 1), /busy/);
  assert.throws(() => pool.unregister('gl'), /active/);
  assert(Object.isFrozen(leases[0]));
  assert.strictEqual(leases[0].buffer, buffer, 'lease does not copy shared storage');
  new Uint8Array(buffer)[3] = 91;
  assert.equal(new Uint8Array(leases[0].buffer, leases[0].byteOffset, leases[0].bytes)[3], 91);
  assert.throws(() => pool.release({ ...leases[0] }), /invalid/);
  assert.throws(() => new SharedPacketPool().release(leases[0]), /invalid/);
  pool.release(leases[0]);
  const next = pool.claim('gl', 0, 8);
  assert.throws(() => pool.release(leases[0]), /stale/);
  assert.throws(() => pool.claim('gl', 0, 1), /busy/, 'old release cannot free a newer lease');
  pool.release(next);
  pool.release(leases[1]); pool.release(leases[2]);
  pool.unregister('gl');
  pool.register('gl', buffer, [128], 32);
  assert.throws(() => pool.release(leases[0]), /stale/);
  assert.throws(() => pool.claim('gl', 0, 1), /invalid/);
  const empty = pool.claim('gl', 128, 0);
  pool.release(empty); pool.unregister('gl');
  pool.unregister('d3d');
  assert.throws(() => pool.unregister('d3d'), /unregistered/);
  // Distinct shared allocations may use the same byte offsets.
  pool.register(1, buffer, [0], 32);
  pool.register(2, new SharedArrayBuffer(256), [0], 32);
  // Failed overlap registration is atomic; its unused span was not retained.
  assert.throws(() => pool.register(3, buffer, [0, 192], 32), /another owner/);
  pool.register(3, buffer, [192], 32);
}
testSharedPacketPool();
const sandbox = { console, URLSearchParams, setTimeout, clearTimeout };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8') +
  '\n;globalThis.WineAssembly = WineAssembly;', sandbox);
const deferred = () => {
  let resolve; const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};

(async () => {
  await testPublicationQueue();
  await testSnapshotPublication();
  // One contract for atomic producers and asynchronous page brokers. No
  // snapshot may run while credits are exhausted, even for a smaller packet
  // behind an exclusive oversized packet.
  const queue = new SubmissionQueue(3), first = deferred(), exclusive = deferred(), last = deferred();
  const snapshots = [];
  const packet = (name, done) => () => { snapshots.push(name); return {value: 1, done}; };
  assert.equal(queue.admit(packet('gl', first.promise), 2), 1);
  const large = queue.admit(packet('glide-large', exclusive.promise), 3);
  const small = queue.admit(packet('software', last.promise));
  assert.deepEqual(snapshots, ['gl']);
  const closing = queue.close(); let closed = false; closing.then(() => { closed = true; });
  await assert.rejects(queue.admit(packet('late', Promise.resolve())), /closed/);
  first.resolve(); assert.equal(await large, 1);
  assert.deepEqual(snapshots, ['gl', 'glide-large']); assert(!closed);
  exclusive.resolve(); assert.equal(await small, 1);
  assert.deepEqual(snapshots, ['gl', 'glide-large', 'software']); assert(!closed);
  last.resolve(); await closing; assert.equal(queue.used, 0);

  const atomic = new SubmissionQueue(1), ticket = atomic.reserve();
  assert.throws(() => atomic.reserve(), /full/);
  atomic.complete(ticket); const next = atomic.reserve();
  assert.throws(() => atomic.complete(ticket), /stale/);
  assert.equal(atomic.used, 1); atomic.complete(next);
  assert.throws(() => atomic.admit(() => { throw new Error('snapshot failed'); }), /snapshot failed/);
  assert.equal(atomic.used, 0, 'validation before publication returns credit');

  const failed = new SubmissionQueue(1), error = new Error('consumer failed');
  let reject;
  const execution = new Promise((_, no) => { reject = no; });
  assert.equal(failed.admit(packet('failed', execution)), 1);
  const waiting = failed.admit(() => { throw new Error('must not snapshot'); });
  reject(error); await assert.rejects(waiting, /consumer failed/);
  assert.equal(failed.used, 1, 'failure does not prove reader retirement');
  await assert.rejects(failed.close(), /consumer failed/);
  await assert.rejects(failed.admit(() => {}), /closed|consumer failed/);

  const bounded = new SubmissionQueue(1, 1), held = deferred();
  bounded.admit(packet('held', held.promise));
  const blocked = bounded.admit(packet('blocked', Promise.resolve()));
  await assert.rejects(bounded.admit(() => {}), /waiter limit/);
  held.resolve(); await blocked; await bounded.close();

  const ordered = new SubmissionQueue(2), fenceGate = deferred(), eventsInOrder = [];
  const before = ordered.ordered(() => ordered.execute(() => { eventsInOrder.push('draw'); }));
  const fence = ordered.ordered(() => ordered.execute(async () => {
    eventsInOrder.push('readback'); await fenceGate.promise; eventsInOrder.push('copied');
  }));
  const after = ordered.ordered(() => ordered.execute(() => { eventsInOrder.push('next'); }));
  await before; await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(eventsInOrder, ['draw', 'readback']);
  fenceGate.resolve(); await fence; await after;
  assert.deepEqual(eventsInOrder, ['draw', 'readback', 'copied', 'next']);

  const opening = new SubmissionQueue(1), openGate = deferred();
  const open = opening.execute(async () => { await openGate.promise; throw new Error('open failed'); });
  const closeDuringOpen = opening.close();
  openGate.resolve();
  await assert.rejects(open, /open failed/);
  await assert.rejects(closeDuringOpen, /open failed/, 'close also observes operations without packet tickets');

  const original = Object.fromEntries(['start', 'initGuestThread', 'callExport'].map(k => [k, WorkerLink.prototype[k]]));
  const initializing = deferred(), initGate = deferred(), settings = [];
  try {
    WorkerLink.prototype.start = async function () { this.enabled = this.d3dimLazySync; };
    WorkerLink.prototype.initGuestThread = async function () {
      if (this.slot === 1) { initializing.resolve(); await initGate.promise; }
      return {};
    };
    WorkerLink.prototype.callExport = async function (name, value) {
      assert.equal(name, 'd3dim_lazy_enable'); this.enabled = !!value; settings.push([this.slot, value]);
    };
    const host = new GuestThreadHost({ sharedRenderWorker: true, d3dimGpu: true });
    assert.equal(host.d3dimLazySync, true);
    const spawning = host.spawnThread({ tid: 1 });
    await initializing.promise;
    await host.setLazySync(false);
    initGate.resolve();
    const first = await spawning;
    assert.equal(first.enabled, false, 'opt-out during spawn is applied before the thread can run');
    const second = await host.spawnThread({ tid: 2 });
    assert.equal(second.enabled, false, 'future threads inherit opt-out');
    await host.setLazySync(true);
    assert(first.enabled && second.enabled, 'live switch reaches every existing guest thread');
    host.d3dimGpu = false;
    await host.setLazySync(true);
    assert(!first.enabled && !second.enabled, 'software remains eager');
    host.d3dimGpu = true; host.sharedRenderWorker = false;
    await host.setLazySync(true);
    assert(!first.enabled && !second.enabled, 'private executors remain eager');
  } finally { Object.assign(WorkerLink.prototype, original); }
  const portReady = deferred(), events = [];
  const endpoint = { ready: Promise.resolve(), addEventListener() {},
    postMessage(message) { events.push(message.t); },
    terminate() { events.push('close'); return Promise.resolve(); } };
  const link = new WorkerLink({ createRenderEndpoint: () => portReady.promise });
  link.worker = { postMessage() {}, terminate() { events.push('guest-stop'); } };
  link._forwardRenderLegacy({ t: 'init', control: new SharedArrayBuffer(64) });
  await Promise.resolve(); // Endpoint creation is in flight when the producer exits.
  link._forwardRenderLegacy({ t: 'batch' });
  const retired = link.stop();
  assert.strictEqual(link.stop(), retired, 'endpoint retirement is idempotent');
  portReady.resolve(endpoint);
  await retired;
  assert.deepStrictEqual(events, ['guest-stop', 'init', 'batch', 'close'],
    'already accepted batches must be posted before retiring only this endpoint');

  const logs = [], marker = {}, wine = Object.create(sandbox.WineAssembly.prototype);
  let stopped = 0;
  wine.memory = marker;
  wine._renderWorkerPreparationTimeoutMs = 10;
  wine.hostCtx = { closeGlide: () => new Promise(() => {}) };
  wine.logToUI = text => logs.push(text);
  wine._renderWorkerManager = { async stop() {
    stopped++;
    throw new Error('render worker shutdown timed out; heap not reclaimed');
  } };
  wine._renderWorkerManagerReady = Promise.resolve(wine._renderWorkerManager);
  wine._releaseGuestMemory();
  await wine._renderWorkerRetirement;
  assert.strictEqual(stopped, 1, 'unresponsive endpoint cannot prevent manager shutdown');
  assert.strictEqual(wine.memory, marker, 'failed retirement must retain live allocator memory');
  assert.notStrictEqual(wine._renderWorkerRetired, true);
  assert(logs.some(text => /endpoint drain timed out/.test(text)));
  assert.match(wine._renderWorkerRetirementError.message, /heap not reclaimed/);
  console.log('PASS producer endpoint drain and bounded process retirement');
})().catch(error => { console.error(error); process.exitCode = 1; });
