'use strict';
// Real PE x86 WndProc -> SendMessageA, canonical interpreter, actual Workers.
// Window registration and initial parking use native test exports. Barriers
// delay transport only; no guest/API result or interpreter export is mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { context, CANONICAL, latch } = require('./test-scoped-dll-endpoints-candidate');
const { X86, pe, BASE, DATA } = require('./test-dll-lifecycle-real-pe');
const { ProcessSendBroker } = require('../lib/process-send-broker');
const { WorkerLink } = require('../lib/guest-thread-host');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;
const turn = () => new Promise(r => setImmediate(r));
const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24];
function images() {
  const x = new X86().emit(0x83, 0x7c, 0x24, 8, 0x01).branch([0x0f, 0x84], 'leaf');
  // SendMessageA(wParam, 1, 0, lParam), then increment the true LRESULT.
  x.emit(0x8b, 0x44, 0x24, 12, 0xff, 0x74, 0x24, 16).push(0).push(1)
    .emit(0x50, 0xff, 0x15, u32(BASE + 0x1900), 0x40, 0xc2, 16, 0);
  x.label('leaf').emit(0x8b, 0x44, 0x24, 16, 0x40, 0xc2, 16, 0);
  const ordinary = new X86().label('poll').emit(0xff,0x05,u32(DATA+0x100))
    .push(0).push(0).push(0).push(0).push(DATA+0x200)
    .emit(0xff,0x15,u32(BASE+0x1904)).branch(0xe9,'poll').finish();
  const exe = pe([[0x2000, x.finish()], [0x2200, ordinary]]);
  const raw = r => r - 0x1000 + 0x200;
  // Replace the fixture's import list with one actual USER32 import.
  exe.fill(0, raw(0x1900), raw(0x1d00));
  exe.writeUInt32LE(0x1a00, raw(0x1900)); exe.write('SendMessageA\0', raw(0x1a02));
  exe.writeUInt32LE(0x1a20, raw(0x1904)); exe.write('PeekMessageA\0', raw(0x1a22));
  exe.write('user32.dll\0', raw(0x1880));
  return { exe };
}
const state = link => Promise.all(['eip','esp','eax','ebx','ecx','edx','esi','edi','yield_reason']
  .map(n => link.callExport('get_' + n)));
async function main() {
  const wrapperDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'iw-native-receiver-'));
  const workerUrl = path.join(wrapperDir, 'worker.js');
  fs.writeFileSync(workerUrl, `require(${JSON.stringify(path.resolve(__dirname,'../lib/guest-worker.js'))});
    require('node:worker_threads').parentPort.on('message', m => {
      if(m.testTransportFailure === 'exit') process.exit(0);
      if(m.testTransportFailure === 'error') throw new Error('native receiver transport failure');
    });`);
  const bytes = fs.readFileSync(process.env.WA_TEST_WASM);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), CANONICAL);
  const module = await WebAssembly.compile(bytes);
  const sandbox = { console, URLSearchParams, setTimeout, clearTimeout, window: {}, ProcessSendBroker };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../host.js'),'utf8') +
    '\n;globalThis.WineAssembly=WineAssembly;', sandbox);
  const renderer = { windows: {} }, contexts = [];
  async function make(pid, own, other, otherPid) {
    const c = await context(module, true, images(), workerUrl); contexts.push(c);
    // The reused loader fixture normally keeps a local main endpoint. Supply
    // a real slot-0 Worker transport, initialized with native Win32 tid 1.
    const main = new WorkerLink({slot:0,memory:c.memory,module,sigs,broker:c.host.broker,
      workerUrl:path.resolve(__dirname,'../lib/guest-worker.js')});
    c.host.link=main;await main.start();
    await main.initGuestThread({tid:0,imageBase:BASE,codeStart:c.ex.get_code_start(),
      codeEnd:c.ex.get_code_end(),thunkBase:c.ex.get_thunk_base(),thunkEnd:c.ex.get_thunk_end(),
      numThunks:c.ex.get_num_thunks(),startAddr:BASE+0x2200,param:0,stackSize:0x10000});
    assert.equal(await main.callExport('get_current_thread_id'),1);
    assert.equal(await c.a.callExport('get_current_thread_id'),2);
    assert.equal(await c.b.callExport('get_current_thread_id'),3);
    assert.equal(await c.b.callExport('get_eip'),BASE+0x2200,'ordinary receiver starts at actual PeekMessage loop');
    for (const [hwnd, tid] of [[own,2],[own+1,3],[other,-otherPid]]) {
      c.ex.set_current_thread_id(tid); c.ex.test_wnd_table_set(hwnd,BASE+0x2000);
    }
    c.ex.set_current_thread_id(1);
    assert.equal(await main.callExport('get_window_thread',own),2);
    assert.equal(await main.callExport('get_window_thread',own+1),3);
    for (const l of [c.a,c.b]) await l.callExport('set_yield_state',7,1);
    for (const hwnd of [own,own+1]) renderer.windows[hwnd] = { processId:pid };
    const wine = Object.create(sandbox.WineAssembly.prototype);
    Object.assign(wine,{renderer,processId:pid}); wine._installProcessSendBroker(c.host);
    Object.assign(c,{pid,own,endpoint:wine._processSendEndpoint,resolver:c.host.processSendResolver});
    return c;
  }
  const releases = [];
  try {
    const a = await make(100,1000,2000,200), b = await make(200,2000,1000,100);
    const broker = renderer._processSendBroker;
    const source = broker.register(300,{dispatch(){throw Error('unexpected source callback');}});
    const send = (c,msg=1,wparam=0,lparam=41,hwnd=c.own,sender=source,senderLink) =>
      broker.send(sender,c.endpoint,{hwnd,msg,wparam,lparam,windowToken:renderer.windows[hwnd]},undefined,senderLink);
    const before = await Promise.all([state(a.a),state(b.a)]);
    const ready=latch(), go=latch(); releases.push(go); let entered=0;
    for (const c of [a,b]) c.host.processSendResolver=async (...args)=>{
      if (++entered===2) ready.release(); await go.promise; return c.resolver(...args);
    };
    const roots=[send(a,2,b.own),send(b,2,a.own)];
    await ready.promise; go.release();
    assert.deepEqual(await Promise.all(roots),[43,43]);
    assert.deepEqual(await Promise.all([state(a.a),state(b.a)]),before);
    console.log('PASS native independent A/B chains, actual SendMessageA and full register restoration');
    for(const c of [a,b]) c.host.processSendResolver=c.resolver;

    // Let the actual scheduler discover a sibling initially in ordinary code.
    for(const serial of [false,true]) {
      b.manager.serialSlices=serial; b.manager.threads.get(0x7002).inFlight=false;
      await b.b.callExport('set_yield_state',0,0);
      const slice=b.b.slice.bind(b.b), yields=[];
      let first=true;
      b.b.slice=async (...args)=>{
        if(first) {
          first=false;
          // Delay only transport until the actual receiver's rejected
          // admission has raised its native incoming flag. This separates
          // the intended 0->17 transition from an ordinary empty poll (15).
          const until=Date.now()+2000;
          while(!(await b.b.callExport('get_incoming_send_pending'))) {
            assert(Date.now()<until,'broker must publish native pending flag before receiver slice');
            await turn();
          }
        }
        const result=await slice(...args);yields.push(result.yield);return result;
      };
      try { assert.equal(await send(b,2,b.own+1,41),43); }
      finally {b.b.slice=slice;}
      assert(yields.includes(17),'actual ordinary Worker slice reached native incoming-send yield17');
      // Completion may have already cleared 17 and made another ordinary
      // slice. Observe the transient real reply above, not a late snapshot.
      console.log(JSON.stringify({localSerial:serial,ordinarySliceYields:yields}));
      assert.equal(b.b.threadSendDepth,0);
      await b.b.callExport('set_incoming_send_pending',0);
      await b.b.callExport('set_yield_state',7,1);
      b.manager.threads.get(0x7002).inFlight=true;
    }
    console.log('PASS native local different-TID ordinary-code admission, round and serial scheduling');

    const held=latch(), at=latch(), innerHeld=latch(), innerAt=latch(); releases.push(held,innerHeld);
    a.host.processSendResolver=async()=>{at.release();return held.promise;};
    const outer=send(a,2,b.own); await at.promise;
    a.host.processSendResolver=async()=>{innerAt.release();return innerHeld.promise;};
    const inner=send(a,2,b.own); await innerAt.promise;
    let done=false; outer.then(()=>{done=true;}); held.release(70); await turn(); await turn();
    assert.equal(done,false); assert.equal(a.a.threadSendDepth,2);
    innerHeld.release(8); assert.equal(await inner,9); assert.equal(await outer,71);
    assert.deepEqual(await state(a.a),before[0]); a.host.processSendResolver=a.resolver;
    console.log('PASS native early reply waits for nested x86 callback unwind');

    for (const change of ['same-tid','window-lifetime']) {
      const original=b.a.dispatchThreadSend.bind(b.a), at=latch(), go=latch(); releases.push(go);
      b.a.dispatchThreadSend=async args=>{const r=await original(args);at.release();await go.promise;return r;};
      const first=send(b);await at.promise;
      const stale=send(b), gone=assert.rejects(stale,{code:'receiver-gone'});
      while(!b.endpoint.threads.get(b.a).queue.length)await turn();
      const slot=[...b.host.threadLinks].find(([,link])=>link===b.a)[0];
      const window=renderer.windows[b.own];
      if(change==='same-tid')b.host.threadLinks.set(slot,b.b);
      else renderer.windows[b.own]={processId:b.pid};
      go.release();assert.equal(await first,42);await gone;
      b.host.threadLinks.set(slot,b.a);renderer.windows[b.own]=window;b.a.dispatchThreadSend=original;
    }
    console.log('PASS native queued same-TID replacement and window lifetime exclusion');

    const dispatch=b.a.dispatchThreadSend.bind(b.a), dispatched=latch(), release=latch(); releases.push(release);
    let staleEntries=0;
    b.a.dispatchThreadSend=async args=>{if(args.lparam===99)staleEntries++;const r=await dispatch(args);dispatched.release();await release.promise;return r;};
    const blocker=send(b); await dispatched.promise;
    const queued=send(b,1,0,99,b.own,a.endpoint,a.b);
    const rejected=assert.rejects(queued,{code:'sender-gone'});
    while(!b.endpoint.threads.get(b.a).queue.length)await turn();
    await a.b.stop(); release.release(); assert.equal(await blocker,42);await rejected;
    assert.equal(staleEntries,0);b.a.dispatchThreadSend=dispatch;
    console.log('PASS native queued retired sender never enters receiver WndProc');

    // Keep every admission scenario above, then exercise exact receiver
    // retirement with the same native PE, broker, host and actual Workers.
    const bounded = async (promise, label) => {
      let timer;
      try { return await Promise.race([promise, new Promise((_, reject) => {
        timer=setTimeout(()=>reject(new Error(label)), 1500);
      })]); } finally { clearTimeout(timer); }
    };
    for (const outcome of ['stop','exit','error']) {
      const c=await make(400,4000,1000,100), receiver=c.a;
      try {
        await receiver.callExport('set_yield_state',0,0);
        const queued=send(c);
        const rejection=assert.rejects(bounded(queued,'RECEIVER_RETIREMENT_DID_NOT_SETTLE'),
          {code:'receiver-gone'});
        await bounded((async()=>{
          while(!c.endpoint.threads.get(receiver)?.queue.some(r=>r.deferred)) await turn();
        })(),'RECEIVER_NEVER_DEFERRED');
        assert.equal(receiver.threadSendDepth,0);
        assert.equal(receiver._scopedLoaderUsed,undefined);
        let pendingRejected;
        if(outcome==='stop') await receiver.stop();
        else {
          // A genuine unanswered RPC must be rejected and its timer cleared
          // by transport failure, without pretending native loader cleanup ran.
          const pending=receiver._ask({t:'testUnanswered'},30000);
          pendingRejected=assert.rejects(pending,/exited|transport failure/);
          receiver.worker.postMessage({testTransportFailure:outcome});
        }
        await rejection; if(pendingRejected) await pendingRejected;
        assert.equal(broker.hasPending(c.endpoint,receiver),false);
        assert.equal(c.endpoint.threads.get(receiver).queue.length,0);
        assert.equal(receiver._pending.size,0);
        assert.equal(receiver._retiringListeners.size,0);
        assert.equal(receiver._loaderRetirementReceipt,undefined);
        assert.deepEqual(c.gate(),[0,0]);
        await receiver.stop();
        if(outcome==='stop') assert.equal(receiver._transportFailure,undefined,
          'normal terminate exit is not unexpected transport failure');
        assert.equal(receiver.worker,null);
        console.log('PASS native deferred receiver '+outcome+' cancels exact link and RPC timers');
      } finally {
        broker.retire(c.endpoint);await c.close();contexts.splice(contexts.indexOf(c),1);
      }
    }
    for (const outcome of ['stop','exit','error']) {
      const c=await make(500,5000,1000,100), receiver=c.a;
      const at=latch(), release=latch();releases.push(release);
      c.host.processSendResolver=async()=>{at.release();return release.promise;};
      const executing=send(c,2,a.own);
      const rejection=assert.rejects(bounded(executing,'ACTIVE_RECEIVER_DID_NOT_UNWIND'),
        /retired|stopped|exited|transport failure/);
      try {
        await at.promise;
        const request=c.endpoint.threads.get(receiver).stack[0];
        assert.equal(receiver.threadSendDepth,1);
        if(outcome==='stop') await receiver.stop();
        else {
          receiver.worker.postMessage({testTransportFailure:outcome});
          await bounded((async()=>{while(!receiver._transportFailure)await turn();})(),
            'TRANSPORT_FAILURE_NOT_OBSERVED');
        }
        assert.equal(request.settled,false,'active adapter still owns unwind');
        assert.equal(c.endpoint.threads.get(receiver).stack.length,1);
        assert.equal(receiver.threadSendDepth,1);
        assert.equal(receiver._loaderRetirementReceipt,undefined);
        release.release(4);await rejection;
        await bounded((async()=>{while(c.endpoint.threads.get(receiver).stack.length)await turn();})(),
          'ACTIVE_STACK_NOT_RELEASED');
        assert.equal(receiver.threadSendDepth,0);
        assert.equal(receiver._retiringListeners.size,0);
        assert.deepEqual(c.gate(),[0,0]);
        await receiver.stop();
        console.log('PASS native active receiver '+outcome+' retains adapter stack until unwind');
      } finally {
        release.release(0);broker.retire(c.endpoint);await c.close();contexts.splice(contexts.indexOf(c),1);
      }
    }
  } finally {
    for(const r of releases)r.release(0);
    try { for(const c of contexts)await c.close(); }
    finally { fs.rmSync(wrapperDir,{recursive:true,force:true}); }
  }
}
const deadline=setTimeout(()=>{console.error('Native receiver retirement stalled');process.exit(2);},60000);
deadline.unref();
main().then(()=>clearTimeout(deadline),error=>{console.error(error);process.exitCode=1;});
