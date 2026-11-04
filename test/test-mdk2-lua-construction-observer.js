'use strict';
// Native fragments in ordinary queued Worker execution, never a fresh game.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {Worker,MessageChannel,isMainThread,parentPort,workerData}=require('worker_threads');
const {EXE_SHA256,SCRIPT_SHA256,PINS,CUTS,attach,decodeFileSnapshot}=require('../tools/mdk2-lua-construction-observer.cjs');
const ROOT=path.resolve(__dirname,'..'),H=b=>crypto.createHash('sha256').update(b).digest('hex');
const media='test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe',exe=fs.readFileSync(path.join(ROOT,media));
assert.equal(H(exe),EXE_SHA256);
const pe=require('../lib/pe').readPE(path.join(ROOT,media));
for(const {pc,hex}of PINS)assert.equal(exe.subarray(pe.va2off(pc),pe.va2off(pc)+hex.length/2).toString('hex'),hex,pc.toString(16));
const zip=fs.readFileSync(path.join(ROOT,path.dirname(media),'data/scripts.zip'));
assert.equal(H(zip),SCRIPT_SHA256);
const scriptPins={'menu.lua':'8ed69d83201f71940ff89e562dc44130a3b3d153ff7318ae1f3e6fa1d09b3a27',
  'level0.lua':'f5166d801b6aaf2d0c5cee17bc5d5b615b46f1b76c21641a70c89930b1871175',
  'mdk2.lua':'ac6c5e1705f48fee4d32c5420e51bfe6ea5639adaa5159d869310aaeef65e1dc'};
let scriptsChecked=0;
for(let p=0;p<zip.length-46;p++)if(zip.readUInt32LE(p)===0x02014b50){
  const name=zip.subarray(p+46,p+46+zip.readUInt16LE(p+28)).toString();if(!scriptPins[name])continue;
  assert.equal(zip.readUInt16LE(p+10),10);const o=zip.readUInt32LE(p+42),start=o+30+zip.readUInt16LE(o+26)+zip.readUInt16LE(o+28);
  const decoded=require('../tools/mpq').explode(zip.subarray(start,start+zip.readUInt32LE(p+20)));
  assert.equal(H(decoded),scriptPins[name]);scriptsChecked++;
}
assert.equal(scriptsChecked,3);

async function fixture(access){
  const {e,memory,host,observer}=access(),b=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
  const wa=a=>{const w=e.guest_to_wasm(a)>>>0;assert.notEqual(w,0xf0);return w;};
  const put=(a,v)=>b.set(v,wa(a)),u=(a,v)=>dv.setUint32(wa(a),v>>>0,true),get=a=>e.guest_read32(a)>>>0;
  b.set(exe,e.get_staging());assert(e.load_pe(exe.length));e.set_api_log(0);
  const entry=0x1800000,out=entry+0x1000,stack=0x74ff000,caller=0x401800;
  // Explicit synthetic fixture data; original executable instructions unchanged.
  put(caller,[0xeb,0xfe]);e.invalidate_code_range(caller,2);
  u(entry,out);u(entry+8,192320);put(entry+12,Buffer.from('level1\0'));put(entry+28,[10,1,2,0]);
  for(const [a,v]of [[0x4b87d4,entry],[0x4b87cc,0],[0x4b87d0,1],[0x4b7d14,entry],[0x5ce08c,1175012],[0x4b7ce4,0]])u(a,v);
  e.set_current_thread_id(1);e.set_trace_esp(1,0x400000,0x480000);
  const opts={host,getExports:()=>e,workerSlot:0,exeSha256:EXE_SHA256,wasmSha256:workerData.wasmHash,deadline:performance.now()+30000};
  const state=()=>Object.fromEntries(['eip','esp','ebp','eax','ebx','ecx','edx','esi','edi','flag_op','flag_a','flag_b','flag_res','flag_sign_shift','yield_reason','last_run_blocks','last_run_halt'].map(n=>[n,e['get_'+n]()>>>0]));
  let pending;const slice=()=>new Promise((resolve,reject)=>{pending={resolve,reject};parentPort.postMessage({t:'fixtureSliceRequest'});});
  workerData.port.on('message',m=>{if(m.t==='slice'){const p=pending;pending=null;m.message.trapped?p.reject(Error(m.message.trapped)):p.resolve(m.message);}});
  const segments=[];
  async function run(name,start,stop){e.set_eip(start);let steps=0;const trace=[];
    while(e.get_eip()>>>0!==stop&&steps++<100){const {ms,...result}=await slice();trace.push({result,state:state()});}
    assert.equal(e.get_eip()>>>0,stop,JSON.stringify({name,state:state(),observer:observer?.report}));
    segments.push({name,trace,hash:H(b),state:state()});
  }
  e.set_esp(stack);u(stack,caller);u(stack+4,entry);
  await run('type10-finalizer',CUTS.finalize,caller);
  await slice();
  e.set_esp(stack);u(stack,caller);e.set_ebx(0);e.set_edi(1);e.set_esi(entry);
  // Actual completion branch writes status2, calls type10 finalizer, clears active,
  // then executes the original saved-register return epilogue.
  put(entry+30,[1]);u(stack,0x111);u(stack+4,0x222);u(stack+8,0x333);u(stack+12,caller);
  await run('synchronous-completion',CUTS.consume,caller);
  assert.equal(get(0x4b7d14),0);assert.equal(b[wa(entry+30)],2);
  // Original poll read/return uses real SleepEx; no callback is synthesized.
  e.set_esp(stack);u(stack,caller);
  await run('poll',CUTS.poll,caller);
  await slice(); // Deliver the saved-return boundary through the ordinary queue.
  e.set_esp(stack);e.set_esi(entry);e.set_edi(entry+12);
  await run('demand-load-return',CUTS.loadCall,0x41fcf4);
  e.set_esp(stack);e.set_esi(entry);e.set_edi(entry+12);
  // Only the original buffer setup and stream initializer execute. Stop before
  // protected parse/run; no Lua state, program or callback is synthesized.
  await run('script-buffer-and-stream',CUTS.bufferCall,0x444dc0);
  if(workerData.timerFixtures){
    // Independent native fragments with explicit fixture objects. These are
    // original instructions, never reconstructed historical timer/Lua state.
    const gob=entry+0x4000,handlers=gob+0x1000;
    e.set_esp(stack);u(stack,0x41e9b2);u(stack+4,gob);u(stack+8,0x3f99999a);u(stack+40,caller);
    await run('native-countdown-set',0x46cb20,caller);await slice();
    assert.equal(get(gob+0xa0),0x3f99999a);
    u(gob+0xa0,0);u(gob+0x84,handlers);u(handlers+0x60,0);
    e.set_esp(stack);u(stack,0x46b693);u(stack+4,gob);
    await run('native-timer-no-handler',0x42b0c0,0x46b693);
    e.set_edi(gob);
    await run('native-timer-return-tail',0x46b693,0x42acc0);
    e.set_esp(stack);u(stack,0x42bc2c);u(stack+4,1);u(stack+8,9);u(stack+20,caller);
    await run('native-deferred-store',0x42cc80,caller);await slice();
    assert.equal(get(0x4b712c),1);assert.equal(get(0x4b7494),9);assert.equal(get(0x5ccb48),1);
    if(observer)for(const kind of ['timer-armed','timer-firing','timerHandler-return','deferredStore-return'])
      assert(observer.report.records.some(r=>r.kind===kind),JSON.stringify(observer.report));
  }
  const before={hash:H(b),state:state()};observer?.sample();observer?.sample();assert.deepEqual({hash:H(b),state:state()},before);
  const report=observer?.finish('fixture-end');
  if(report){assert.equal(report.status,'fixture-end',JSON.stringify(report));
    for(const kind of ['completion-consume','completion-finalizer-entry','completion-finalizer-return','poll-return','demand-return','script-buffer-entry','sample'])assert(report.records.some(r=>r.kind===kind),kind);}
  // Diagnostic failures preserve the underlying import result/exception.
  const negatives={};host.log_block=()=>37;
  const reject=(name,setup,pc,pattern)=>{e.set_current_thread_id(1);e.set_esp(stack);u(stack,caller);u(0x4b7d14,entry);u(0x4b87d0,1);put(entry+30,[2]);
    const o=attach(opts);setup?.();e.set_eip(pc);const before=H(b),s=state();assert.equal(host.log_block(pc,e.get_esp()),37);assert.equal(H(b),before);assert.deepEqual(state(),s);
    assert.match(o.report.error,pattern,JSON.stringify(o.report));negatives[name]=o.report.error;o.finish();};
  reject('wrong-thread',()=>e.set_current_thread_id(2),CUTS.finalize,/thread/);
  const header=get(0x400000);reject('wrong-loader',()=>u(0x400000,0),CUTS.finalize,/loader/);u(0x400000,header);
  const saved=get(CUTS.poll);reject('wrong-bytes',()=>u(CUTS.poll,0),CUTS.finalize,/bytes/);u(CUTS.poll,saved);
  reject('missing-finalizer-history',null,CUTS.finalizeType10,/history/);
  reject('missing-poll-history',null,CUTS.pollRead,/history/);
  reject('wrong-branch',()=>u(0x4b87d0,0),CUTS.consume,/branch/);
  reject('wrong-request',()=>u(0x4b7d14,entry+32),CUTS.consume,/request/);
  reject('wrong-type',()=>put(entry+28,[1]),CUTS.finalize,/type10/);put(entry+28,[10]);
  reject('missing-load-history',null,CUTS.loadReturned,/history/);
  reject('missing-buffer-history',null,CUTS.buffer,/history/);
  assert.throws(()=>attach({...opts,workerSlot:1}),/pin/);assert.throws(()=>attach({...opts,exeSha256:'0'.repeat(64)}),/pin/);
  const noTrace=attach(opts);assert.match(noTrace.check().error,/mandatory/);negatives.noTrace=noTrace.report.error;
  // Original undefined instruction trap parity after identical fixture setup.
  put(caller+16,[0x0f,0x0b]);e.invalidate_code_range(caller+16,2);e.set_eip(caller+16);
  let trap;try{await slice();}catch(error){trap=String(error);}assert(trap);
  parentPort.postMessage({pass:true,segments,before,trap:{text:trap,hash:H(b),state:state()},report,negatives,workerSource:access().workerSource});
}
if(!isMainThread){
  let captured;const instantiate=WebAssembly.instantiate;
  WebAssembly.instantiate=async function(module,imports,...args){let instance;
    const observer=workerData.observed?attach({host:imports.host,getExports:()=>instance?.exports,workerSlot:0,exeSha256:EXE_SHA256,wasmSha256:workerData.wasmHash,deadline:performance.now()+30000}):null;
    const result=await Reflect.apply(instantiate,this,[module,imports,...args]);instance=result.instance||result;
    captured={e:instance.exports,memory:imports.host.memory,host:imports.host,observer};return result;};
  const filename=path.join(ROOT,'lib/guest-worker.js'),Module=require('module'),entry=new Module(filename,module);entry.filename=filename;entry.paths=module.paths;
  const workerSource=fs.readFileSync(filename,'utf8');entry._compile(workerSource,filename);
  const sourceHash=H(workerSource);
  workerData.port.once('message',()=>fixture(()=>({...captured,workerSource:{path:'lib/guest-worker.js',sha256:sourceHash}})).catch(error=>parentPort.postMessage({t:'fixtureFailure',error:error.stack})));
}else{
  function retainedEvidence(){
    const base=path.join(ROOT,'scratch/runs/20261104-mdk2-measured-escape-original');
    const retained=name=>{const p=path.join(base,name);return fs.existsSync(p)?fs.readFileSync(p):require('zlib').gunzipSync(fs.readFileSync(p+'.gz'));};
    const seal=JSON.parse(retained('seal.json'));
    const inventoryBytes=retained('remote-recovery-inventory.json');
    const pin=seal.files.find(r=>r.path==='remote-recovery-inventory.json');assert(pin);assert.equal(H(inventoryBytes),pin.sha256);assert.equal(inventoryBytes.length,pin.bytes);
    const inventory=JSON.parse(inventoryBytes);
    function json(name){const p=path.join(base,'recovered/browser',name+'.json'),pin=inventory.find(r=>r.path==='browser/'+name+'.json');assert(pin);
      const b=fs.existsSync(p)?fs.readFileSync(p):require('zlib').gunzipSync(fs.readFileSync(p+'.gz'));
      assert.equal(b.length,pin.bytes);assert.equal(H(b),pin.sha256);return JSON.parse(b);}
    const rows=[];for(const name of ['comic-control-106','comic-control-109','comic-control-112']){
      const main=json(name+'-native-main'),file=json(name+'-owner'),r=decodeFileSnapshot(main,file);rows.push(r);
      for(const mutate of [f=>{f.values.get_current_thread_id=1;},f=>{f.frozen.steps++;},f=>{f.stack[0]=0x4522d7;},f=>{const p=f.stack[f.stack[0]===0x45774a?8:6];f.stack[(p-f.values.get_esp)/4+5]++;}]){
        const changed=structuredClone(file);mutate(changed);assert.throws(()=>decodeFileSnapshot(main,changed),/wrong|uncorrelated|unknown/);
      }
    }
    assert.equal(rows.at(-1).decode.remaining,8000);assert.equal(rows.at(-1).decode.outputCopied,184320);
    console.log('PASS sealed actual main/file callback readbacks and ownership/history/branch/request negatives');
  }
  function readOnlyModel(){
    const realm={};require('vm').runInNewContext(fs.readFileSync(path.join(ROOT,'tools/mdk2-lua-construction-observer.cjs'),'utf8'),realm);
    assert.equal(typeof realm.Mdk2LuaConstructionObserver.attach,'function');
    // Immutable readback models, not a guest instance or injected Lua state.
    const models=[-6,-3].map(tag=>{
      const bytes=Buffer.alloc(exe.length+4096);exe.copy(bytes);let next=exe.length;const addresses=new Map();
      const word=(a,v)=>{addresses.set(a,next);bytes.writeUInt32LE(v>>>0,next);next+=4;};
      for(const a of [0x4b87d4,0x4b7d14,0x4b87cc,0x4b87d0,0x5ce08c,0x4b712c,0x4b7494,0x5ccb48])word(a,0);
      word(0x4b7ce4,0x1800000);word(0x18000d4,0x1801000);word(0x1801000+15*12,1);word(0x1801000+15*12+8,0x1802000);
      word(0x1802000,0x1803000);word(0x180300c,0);word(0x180301c,5);word(0x1803010,tag);word(0x1803014,0x1804000);
      for(const [i,c]of [...Buffer.from('Level')].entries()){addresses.set(0x1803020+i,next);bytes[next++]=c;}
      return {bytes,word,wa:a=>{for(const [p,o]of addresses)if(a>=p&&a<p+(p>=0x1803020&&p<0x1803025?1:4))return o+a-p;
        if(a>=0x400000&&a<0x400400)return a-0x400000;
        try{return pe.va2off(a);}catch{return 0xf0;}}};
    });let current=0,clock=0,pc=0x4515cd,esp=0x74ffc24;
    const ex={memory:{get buffer(){return models[current].bytes.buffer;}},guest_to_wasm:a=>models[current].wa(a),get_current_thread_id:()=>1,get_image_base:()=>0x400000,get_eip:()=>pc,get_esp:()=>esp,get_edi:()=>0x1804000,get_esi:()=>0x1805000};
    const host={log_block:()=>37},opts={host,getExports:()=>ex,workerSlot:0,exeSha256:EXE_SHA256,wasmSha256:'a'.repeat(64),now:()=>clock,deadline:10};
    const hashes=models.map(m=>H(m.bytes)),o=attach(opts);o.sample();current=1;o.sample();assert.equal(o.report.status,'running',JSON.stringify(o.report));
    assert.equal(o.report.records[0].levelCreatedSincePreviousSample,false);assert.equal(o.report.records[1].levelCreatedSincePreviousSample,true);
    assert.deepEqual(models.map(m=>H(m.bytes)),hashes);o.finish();
    for(const extra of [{maxBoundaries:50000001},{maxRecords:513},{deadline:360001}])assert.throws(()=>attach({...opts,...extra}),/bound/);
    const startedWithTable=attach(opts);startedWithTable.sample();assert.equal(startedWithTable.report.records[0].levelCreatedSincePreviousSample,false);startedWithTable.finish();
    const foreign=attach({...opts,getExports:()=>current?{...ex}:ex});current=0;foreign.sample();current=1;foreign.sample();assert.match(foreign.report.error,/instance/);
    const bounded=attach({...opts,maxRecords:1});assert.throws(()=>attach(opts),/occupied/);bounded.sample();bounded.sample();assert.equal(bounded.report.status,'record-limit');
    const blocks=attach({...opts,maxBoundaries:1});host.log_block(0x4515cd,0x74ffc24);host.log_block(0x4515cd,0x74ffc24);assert.equal(blocks.report.status,'boundary-limit');
    const thrown=Error('original import failure');host.log_block=()=>{throw thrown;};const passthrough=attach(opts);
    assert.throws(()=>host.log_block(0,0),e=>e===thrown);assert.equal(passthrough.report.status,'unsupported-or-unobservable');host.log_block=()=>37;
    const timed=attach(opts);clock=10;timed.sample();assert.equal(timed.report.status,'deadline');
    clock=0;current=0;host.log_block=()=>37;
    const word=(a,v)=>models[current].word(a,v),fire=(p,s=0x74ffc24)=>{pc=p;esp=s;return host.log_block(pc,esp);};
    const checkFailure=(name,setup,action,pattern)=>{pc=0x4515cd;esp=0x74ffc24;const o=attach(opts);setup?.();action(o);assert.match(o.report.error,pattern,name+JSON.stringify(o.report));o.finish();};
    checkFailure('missing GC entry',null,()=>fire(0x40218c),/history/);
    checkFailure('wrong GC return stack',()=>{word(esp,0x40218c);fire(0x443070);},()=>fire(0x40218c,esp+8),/stack/);
    const gc=attach(opts);word(0x74ffc24,0x40218c);fire(0x443070);fire(0x40218c,0x74ffc28);assert.equal(gc.report.records.at(-1).kind,'gc-return');gc.finish();
    let epoch=1;const changedEpoch=attach({...opts,getEpoch:()=>epoch});epoch++;changedEpoch.sample();assert.match(changedEpoch.report.error,/epoch/);
    let ordinal=2;const stale=attach({...opts,getSlice:()=>({ordinal})});stale.sample();ordinal=1;stale.sample();assert.match(stale.report.error,/stale/);
    checkFailure('malformed GC suffix',null,o=>{pc=0x4434a0;word(esp+16,0);o.sample();},/suffix frame/);
    checkFailure('missing dispatch entry',null,()=>fire(0x46d0c4),/history/);
    checkFailure('wrong dispatch phase',()=>{word(0x74ffc24,0x46d0c4);word(0x74ffc28,62);word(0x180500c,4);},()=>fire(0x42ae70),/context/);
    checkFailure('missing deferred store entry',null,()=>fire(0x42bc2c),/history/);
    checkFailure('wrong deferred globals',()=>{word(0x74ffc24,0x42bc2c);word(0x74ffc28,1);word(0x74ffc2c,9);fire(0x42cc80);},()=>fire(0x42bc2c,0x74ffc28),/globals/);
    checkFailure('timer object bounds',()=>{word(0x74ffc24,0x46b693);word(0x74ffc28,0xfffffffe);},()=>fire(0x42b0c0),/native read/);
    checkFailure('missing timer return',null,()=>fire(0x46b693),/history/);
    checkFailure('missing timer callback',()=>word(0x74ffc24,0x42b0f2),()=>fire(0x40daf0),/owning frame/);
    checkFailure('global flag bounds',()=>word(0x5ccb48,2),o=>o.sample(),/flag bound/);word(0x5ccb48,0);
    const ownerChanged=attach(opts);host.log_block=()=>37;ownerChanged.sample();assert.match(ownerChanged.report.error,/import replaced/);
    // Exact retained GC stack suffix authorizes only a suffix return witness.
    pc=0x4434a0;esp=0x74ffc24;
    for(const [off,ret]of [[16,0x44334d],[24,0x444ae3],[48,0x44324a],[56,0x443085],[80,0x40218c],[20,0x1804000]])word(esp+off,ret);
    const suffix=attach(opts);suffix.sample();fire(0x40218c,0x74ffc24+84);
    assert.equal(suffix.report.records[0].kind,'gc-prefix-unobserved');assert.equal(suffix.report.records.at(-1).frame.prefixUnknown,true);suffix.finish();
    const dispatch=attach(opts);word(0x74ffc24,0x46d0c4);word(0x74ffc28,62);word(0x180500c,2);word(0x1805024,0);
    fire(0x42ae70);fire(0x46d0c4,0x74ffc28);assert.equal(dispatch.report.records.at(-1).kind,'dispatch-return');dispatch.finish();
    const handler=attach(opts);word(0x74ffc24,0x46b693);word(0x74ffc28,0x1806000);word(0x18060a0,0);
    fire(0x42b0c0);word(0x74ffc04,0x42b0f2);word(0x74ffc08,0x1806000);word(0x74ffc0c,7);fire(0x40daf0,0x74ffc04);
    word(0x74ffbe4,0x40db0e);word(0x74ffbe8,0x1807000);fire(0x442370,0x74ffbe4);fire(0x40db0e,0x74ffbe8);
    fire(0x42b0f2,0x74ffc08);fire(0x46b693,0x74ffc28);
    for(const name of ['timerLua-return','timerCallback-return','timerHandler-return'])assert(handler.report.records.some(r=>r.kind===name),JSON.stringify(handler.report));handler.finish();
    const unrelated=attach(opts);word(0x74ffc24,0x40db0e);fire(0x442370);fire(0x40db0e);assert.equal(unrelated.report.status,'running');unrelated.finish();
    const consume=attach(opts);word(0x74ffc24,0x401a2d);word(0x5ccb48,1);fire(0x42c990);fire(0x401a2d,0x74ffc28);word(0x5ccb48,0);fire(0x401a33,0x74ffc28);
    assert.equal(consume.report.records.at(-1).kind,'deferred-load-consumed');consume.finish();
    const bytesBound=attach({...opts,maxRecordBytes:1});bytesBound.sample();assert.equal(bytesBound.report.status,'record-byte-limit');assert.equal(bytesBound.report.records.length,0);
    assert.throws(()=>attach({...opts,maxRecordBytes:8193}),/bound/);
    const terminal=attach(opts);terminal.finish('terminal');const beforeTerminal=JSON.stringify(terminal.report);fire(0x40218c);terminal.sample();assert.equal(JSON.stringify(terminal.report),beforeTerminal);
    console.log('PASS getter-only Level absent/table readback, missing history, foreign instance and deadline models');
  }
  async function one(observed,bytes){
    const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),{port1,port2}=new MessageChannel();
    const sigs=require('../lib/host-import-sigs.generated.json').sigs;
    const broker=require('../lib/guest-rpc').createMainBroker(memory,Object.fromEntries(Object.keys(sigs).map(n=>[n,()=>0])),sigs);
    const module=await WebAssembly.compile(bytes);
    const w=new Worker(__filename,{workerData:{observed,timerFixtures:true,port:port2,wasmHash:H(bytes)},transferList:[port2]});
    return new Promise((resolve,reject)=>{let seq=0;const commands=[];
      const finish=async(error,value)=>{clearTimeout(timer);await w.terminate();port1.close();error?reject(error):resolve(value);};
      const timer=setTimeout(()=>finish(Error('queued Worker timeout')),45000);
      w.on('error',e=>finish(e));w.on('message',m=>{
        if(m.t==='ready')port1.postMessage({t:'start'});
        else if(m.t==='rpc')broker.serveRpc(m.slot,m.waitEntry);else if(m.t==='call')broker.serveCall(m);else if(m.t==='calls')broker.serveCalls(m);
        else if(m.t==='fixtureSliceRequest'){const c={t:'slice',seq:++seq,steps:1};commands.push(c);w.postMessage(c);}
        else if(m.t==='sliceDone')port1.postMessage({t:'slice',message:m});
        else if(m.t==='fixtureFailure'||m.t==='error')finish(Error(JSON.stringify(m)));
        else if(m.pass)finish(null,{...m,commands,wasmHash:H(bytes)});
      });w.postMessage({t:'init',seq:0,module,memory,sigs,slot:0,endpointIdentity:1});
    });
  }
  (async()=>{retainedEvidence();readOnlyModel();const results=[];for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
    // Shared build outputs may change while another worker builds. Pin this
    // pair once in memory; never copy or restore a module on disk.
    const bytes=fs.readFileSync(path.join(ROOT,'build',variant));
    const control=await one(false,bytes),observed=await one(true,bytes);
    for(const k of ['segments','before','trap','commands','workerSource'])assert.deepEqual(observed[k],control[k],k);
    results.push({variant,control,observed});console.log('PASS ordinary queued Worker native fragments normal/observer full-memory, registers, lazy flags, returned commands and trap parity',variant);
  }if(process.env.MDK2_LUA_RESULT)fs.writeFileSync(process.env.MDK2_LUA_RESULT,JSON.stringify({pass:true,fixtureOnly:true,results},null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
}
