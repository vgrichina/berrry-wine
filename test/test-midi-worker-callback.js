#!/usr/bin/env node
'use strict';
// Actual guest-worker.js, synchronous import broker, browser owner boundary,
// production MIDI handlers and x86 callback/return. No game or audio-output claim.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { compileSrcWasm } = require('./compile-src');
const { WorkerLink } = require('../lib/guest-thread-host');
const RPC = require('../lib/guest-rpc');
const { createHostImports } = require('../lib/host-imports');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;
const hostSource = process.env.MIDI_OWNER_GATE_BASELINE
  ? require('child_process').execFileSync('git',['show',process.env.MIDI_OWNER_GATE_BASELINE+':host.js'],{encoding:'utf8'})
  : fs.readFileSync(path.join(__dirname, '../host.js'), 'utf8');
const sandbox = {console, setTimeout, clearTimeout};
vm.runInNewContext(hostSource + '\n;globalThis.WineAssembly=WineAssembly;', sandbox);
const offerStart = hostSource.indexOf('offerMidiCallback:item=>');
const offerEnd = hostSource.indexOf('\n      wakeWaveCallback:', offerStart);
const offer = hostSource.slice(offerStart + 'offerMidiCallback:'.length, offerEnd).trim().replace(/,$/, '');
const names = ['midiStreamOpen','midiStreamOut','midiStreamPause','midiStreamRestart',
  'midiStreamStop','midiStreamClose','midiOutPrepareHeader','midiOutReset','waveOutOpen','waveOutClose'];
const extra = names.map(n => `(export "test_${n}" (func $handle_${n}))`).join('\n') + `
 (func (export "test_wait")
   (global.set $yield_reason (i32.const 1)) (global.set $yield_flag (i32.const 1))
   (global.set $wait_handle (i32.const 123)) (global.set $wait_timeout (i32.const -1))
   (global.set $wait_stack_bytes (i32.const 12)))
 (func (export "test_replace_root")
   (if (i32.eq (global.get $current_thread_id) (i32.const 1))
     (then (call $invocation_process_begin))
     (else (call $invocation_thread_begin (i32.sub (global.get $current_thread_id) (i32.const 1))))))
 (func (export "test_pop_post") (param $out i32) (result i32)
   (call $shared_post_queue_read (local.get $out) (i32.const 1)))
`;
const bytes = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + extra : source);
if (process.env.MIDI_WORKER_MODULE_OUT) fs.writeFileSync(process.env.MIDI_WORKER_MODULE_OUT,bytes);
const moduleUnderTest = new WebAssembly.Module(bytes);
const u32 = n => [n&255,(n>>>8)&255,(n>>>16)&255,n>>>24];

async function run(slot) {
  const memory = new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const wine = new sandbox.WineAssembly();
  const backend = {audioRpcSlot:null,threadLinks:new Map()};
  const ctx = {getMemory:()=>memory.buffer, audioClockMs:()=>100, guestNowMs:()=>100,
    callbackHost:wine, callbackDocument:null, get processId() { return wine.processId; },
    // A shadow VM must never receive MIDI execution or window posts.
    exports:new Proxy({}, {get:()=>{throw Error('foreign page VM accessed');}}),
    get waveCallbackOwner() {
      return {kind:'worker',backend,slot:backend.audioRpcSlot,link:null};
    },
    offerMidiCallback:new Function('self','return '+offer)(wine),
    wakeWaveCallback:()=>{},
  };
  const host = createHostImports(ctx).host;
  const broker = RPC.createMainBroker(memory, host, sigs);
  const link = new WorkerLink({slot,memory,module:moduleUnderTest,sigs,broker,
    workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),
    onRpc:s=>{backend.audioRpcSlot=s;},onRpcEnd:()=>{backend.audioRpcSlot=null;}});
  backend.link=link; backend.threadLinks.set(slot,link);
  const thread = {link,state:'active',suspendCount:0,waitStartedAt:55,waitPolls:3};
  wine.running=true;wine.guestWorker=backend;wine._workerLastSlice={eip:1,yield:1};
  let mainSuspended=false;
  wine.threadManager={threads:new Map([[1,thread]]),isMainThreadSuspended:()=>mainSuspended};
  wine._wakeStep=()=>{};
  const call = (n,...args)=>link.callExport(n,...args);
  try {
    await link.start();
    const exe = fs.readFileSync(path.join(__dirname,'binaries/notepad.exe'));
    const staging = await call('get_staging');
    new Uint8Array(memory.buffer).set(exe,staging);
    assert(await call('load_pe',exe.length));
    if(slot) {
      const metadata=await Promise.all(['get_image_base','get_code_start','get_code_end',
        'get_thunk_base','get_thunk_end','get_num_thunks','get_rsrc_rva'].map(n=>call(n)));
      await call('init_thread',slot,...metadata);
    }
    assert.equal(await call('get_current_thread_id'),slot+1,'real native thread initialized');
    const alloc = async n => (await call('guest_alloc',n))>>>0;
    const stack = (await alloc(8192))+4096, out=await alloc(128), cb=await alloc(128), resume=await alloc(16);
    const ph=await alloc(4),dev=await alloc(4),hdr=await alloc(64),data=await alloc(12),msg=await alloc(16);
    const write = (p,v)=>call('guest_write32',p,v);
    const read = p=>call('guest_read32',p).then(v=>v>>>0);
    // Each real x86 callback copies its five ABI arguments, increments a count,
    // clobbers volatile EAX/ECX and returns through the production continuation.
    const code=[0xff,0x05,...u32(out)];
    for(let i=0;i<5;i++) code.push(0x8b,0x44,0x24,4+i*4,0xa3,...u32(out+4+i*4));
    code.push(0xb9,...u32(0xdeadbeef),0xc2,20,0);
    new Uint8Array(memory.buffer).set(code,await call('guest_to_wasm',cb));
    new Uint8Array(memory.buffer).set([0xeb,0xfe],await call('guest_to_wasm',resume));
    await call('set_eip',resume);
    async function api(n,...args) {
      await call('set_esp',stack);
      await call('test_'+n,...Array.from({length:6},(_,i)=>args[i]||0));
      return (await call('get_eax'))>>>0;
    }
    async function open(type=3) {
      await write(dev,0);await write(stack+24,type<<16);
      assert.equal(await api('midiStreamOpen',ph,dev,1,type===1?77:cb,0x98765),0);
      return read(ph);
    }
    async function queue(h) {
      await write(hdr,data);await write(hdr+4,12);await write(hdr+8,12);
      await write(data,480);await write(data+8,0x643c90);
      assert.equal(await api('midiOutPrepareHeader',h,hdr,64),0);
      assert.equal(await api('midiStreamOut',h,hdr,64),0);
    }
    async function finish(message,h,header=0) {
      assert.equal(await call('get_eip'),cb,'callback executes on owning Worker');
      const before=await read(out),sp=await call('get_esp');
      assert.deepEqual(await Promise.all([4,8,12,16,20].map(n=>read(sp+n))),[h,message,0x98765,header,0]);
      await call('run',10000);
      assert.equal(await read(out),before+1,'real x86 callback runs once');
      assert.deepEqual(await Promise.all([4,8,12,16,20].map(n=>read(out+n))),[h,message,0x98765,header,0]);
      assert.equal(await call('get_eip'),resume);assert.equal(await call('get_esp'),stack);
      assert.equal(await call('get_yield_reason'),1);assert.equal(await call('get_wait_handle'),123);
      assert.equal(await call('get_wait_stack_bytes'),12);
      assert.equal(await call('get_eax'),0x12345678,'interrupted registers restored');
      assert.equal(await call('get_ecx'),0x23456789);
    }
    const arm=async()=>{await call('set_esp',stack);await call('set_eax',0x12345678);await call('set_ecx',0x23456789);await call('test_wait');};
    const pump=()=>ctx.pumpWaveCallbacks();
    assert.equal(link.midiCallbacks,true,'receiving Worker negotiated invocation-aware MIDI support');
    link.midiCallbacks=false;
    await assert.rejects(open(),/midi_stream_open/);
    assert.equal(ctx._midiOut.devices.size,0,'unsupported receiving transport rejects before device allocation');
    link.midiCallbacks=true;
    const h=await open();await queue(h);
    // Close while all notifications are still queued: registration survives
    // close RPC until the ordered close notification is accepted.
    assert.equal(await api('midiStreamPause',h),0);
    assert.equal(await api('midiStreamRestart',h),0);
    assert.equal(await api('midiStreamStop',h),0);
    assert.equal(await api('midiOutReset',h),0);
    assert.equal(await api('midiStreamClose',h),0);
    await arm();
    if(slot) {
      thread.suspendCount=1;await pump();assert.equal(await call('get_eip'),resume);
      thread.suspendCount=0;thread.inFlight=true;await pump();assert.equal(await call('get_eip'),resume);thread.inFlight=false;
    } else {
      mainSuspended=true;await pump();assert.equal(await call('get_eip'),resume);mainSuspended=false;
    }
    const registration=link.midiRegistrations.get(h);assert(registration,'owning Worker published registration');
    assert.equal(registration.slot,slot);assert.equal(registration.endpointIdentity,link.endpointIdentity);
    assert(registration.root>0n && registration.invocation>0n);
    // Drop one real acceptance acknowledgement. The actual host keeps the same
    // offer/token, and the Worker deduplicates without entering a second time.
    const ask=link._ask.bind(link);let drop=true;
    link._ask=async (...args)=>{const result=await ask(...args);if(args[0].t==='waveCallback'&&result.status==='accepted'&&drop){drop=false;throw Error('lost MIDI acceptance ACK');}return result;};
    await pump();assert(link._waveOffer,'ambiguous acceptance retained');
    const acceptedToken=link._waveOffer.token;
    await pump();assert.equal(link._waveOffer,null);assert.equal(link._waveToken,acceptedToken+1,'only next busy notification uses a new token');
    await finish(0x3c7,h);
    await arm();await pump();await finish(0x3c9,h,hdr);
    await arm();drop=true;await pump();
    assert(link._waveOffer,'lost close acknowledgement retains offer after registration retirement');
    assert.equal(link.midiRegistrations.has(h),false);
    await pump();await finish(0x3c8,h);
    assert.equal(link.midiRegistrations.has(h),false,'close retires owner registration after acceptance');
    assert.equal(ctx._midiOut.callbacks.length,0);
    // A timed completion follows the same route; pause/restart shifts the
    // deadline and neither stopped service nor an early service fabricates DONE.
    const timed=await open();await queue(timed);await arm();await pump();await finish(0x3c7,timed);
    broker.publish({tickMs:100});await api('midiStreamRestart',timed);host.midi_stream_service(100);
    broker.publish({tickMs:200});await api('midiStreamPause',timed);host.midi_stream_service(600);
    assert.equal((await read(hdr+16))&0x10,0x10,'paused header remains queued');
    broker.publish({tickMs:300});await api('midiStreamRestart',timed);host.midi_stream_service(699);
    assert.equal((await read(hdr+16))&0x10,0x10,'restarted deadline retained');
    host.midi_stream_service(700);assert.equal((await read(hdr+16))&0x11,1);
    await arm();await pump();await finish(0x3c9,timed,hdr);
    await api('midiStreamClose',timed);await arm();await pump();await finish(0x3c8,timed);
    // Wave and MIDI share the ambiguity/scheduler fence and token sequence.
    // Exercise the real wave registration wrapper and owning x86 callback too.
    const fmt=await alloc(32);
    await write(fmt,0x00020001);await write(fmt+4,22050);await write(fmt+8,88200);await write(fmt+12,0x00100004);
    await write(stack+24,0x30000);
    assert.equal(await api('waveOutOpen',ph,-1,fmt,cb,0x98765),0);
    const wave=await read(ph),wr=link.waveRegistrations.get(wave);assert(wr);
    await arm();assert.equal((await link.offerWaveCallback(wr,hdr)).status,'accepted');
    await finish(0x3bd,wave,hdr);
    assert.equal(await api('waveOutClose',wave),0);assert.equal(link.waveRegistrations.has(wave),false);
    // A forged endpoint/root/type or an expired offer cannot mutate CPU state.
    const h2=await open();await arm();const r=link.midiRegistrations.get(h2),token=link._waveToken+100;
    const raw=(registration,overrides={})=>ask({t:'waveCallback',token,registration,waveHdr:0,midiMessage:0x3c7,...overrides});
    assert.equal((await raw(r,{token:link._waveToken})).status,'token-conflict');
    assert.equal((await raw(r,{token:link._waveToken-1})).status,'stale-token');
    for(const wrong of [{...r,root:r.root+1n},{...r,endpointIdentity:r.endpointIdentity+1},
      {...r,type:1},{...r,slot:slot+1},{...r,generation:r.generation+1},
      {...r,callback:r.callback+1},{...r,instance:r.instance+1}])
      assert.equal((await raw(wrong)).status,'retired');
    assert.equal((await raw({...r,type:5})).status,'invalid');
    assert.equal((await raw(r,{requestDeadline:Date.now()-1})).status,'expired');
    assert.equal(await call('get_eip'),resume);
    // Same instance, new process invocation: old callbacks are discarded.
    await call('test_replace_root');await pump();
    assert.equal(ctx._midiOut.callbacks.length,0);assert.equal(await call('get_eip'),resume);
    // Worker replacement under the same link object must not inherit an old
    // queued open, even when the slot and callback integers match.
    const h3=await open();await arm();const originalWorker=link.worker;
    link.worker={};await pump();link.worker=originalWorker;
    assert.equal(ctx._midiOut.callbacks.length,0);assert.equal(await call('get_eip'),resume);
    await open();await arm();const processId=wine.processId;
    wine.processId++;await pump();wine.processId=processId;
    assert.equal(ctx._midiOut.callbacks.length,0,'process replacement discards queued open');
    await open();await arm();sandbox.document={};await pump();delete sandbox.document;
    assert.equal(ctx._midiOut.callbacks.length,0,'document replacement discards queued open');
    await open();await arm();
    if(slot) thread.state='exited'; else wine.running=false;
    await pump();thread.state='active';wine.running=true;
    assert.equal(ctx._midiOut.callbacks.length,0,'owner retirement discards queued open');
    assert.equal(await call('get_eip'),resume);
    // Window mode posts all three lifecycle messages on the owner queue and
    // retains the interrupted wait/stack. No function callback is entered.
    await call('test_wnd_table_set',77,cb);
    const hw=await open(1);await queue(hw);await api('midiStreamStop',hw);await api('midiStreamClose',hw);await arm();
    await pump();
    for(const [message,header] of [[0x3c7,0],[0x3c9,hdr],[0x3c8,0]]) {
      assert.equal(await call('test_pop_post',msg),1);
      assert.deepEqual(await Promise.all([0,4,8,12].map(n=>read(msg+n))),[77,message,hw,header]);
    }
    assert.equal(await call('test_pop_post',msg),0);
    assert.equal(await call('get_eip'),resume);assert.equal(await call('get_esp'),stack);
    // A second real Worker takes this native thread lease. The old VM still
    // reports its old local root, so only validating the shared invocation
    // ownership can reject the stale delivery. Neither VM may execute it.
    await open();await arm();
    const replacement=new WorkerLink({slot,memory,module:moduleUnderTest,sigs,broker,
      workerUrl:path.resolve(__dirname,'../lib/guest-worker.js')});
    try {
      const metadata=await Promise.all(['get_image_base','get_code_start','get_code_end',
        'get_thunk_base','get_thunk_end','get_num_thunks','get_rsrc_rva'].map(n=>call(n)));
      await replacement.start();await replacement.callExport('init_thread',slot,...metadata);
      const before=await Promise.all(['get_eip','get_esp','get_eax'].map(n=>call(n)));
      const count=await read(out);
      await pump();assert.equal(ctx._midiOut.callbacks.length,0);
      assert.deepEqual(await Promise.all(['get_eip','get_esp','get_eax'].map(n=>call(n))),before);
      assert.equal(await replacement.callExport('get_eip'),0,'replacement VM never executes stale callback');
      assert.equal(await read(out),count);
    } finally { await replacement.stop(); }
    console.log('PASS actual MIDI Worker slot '+slot+': broker/open/done/close/x86 return, pause/restart/stop/reset, lost ACK, root/endpoint/replacement, window delivery');
  } finally { ctx.stopAudio?.(); await link.stop(); }
}
(async()=>{
  await run(0);await run(3);
  console.log(JSON.stringify({slots:[0,3],nativeThreadIds:[1,4],
    moduleSHA256:require('crypto').createHash('sha256').update(bytes).digest('hex'),
    boundary:'production handlers/broker/guest-worker/browser owner gate/x86 callback and return; generated callback, no game or audible-output claim'}));
})().catch(error=>{console.error(error);process.exitCode=1;});
