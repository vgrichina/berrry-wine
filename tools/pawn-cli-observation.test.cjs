'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {CliObservationLease, validateObservationArgs} = require('../lib/cli-observation-lease');
const {ThreadManager} = require('../lib/thread-manager');
const {createHostImports} = require('../lib/host-imports');
const {observeNative} = require('./pawn-cli-observation.cjs');
const delay = ms => new Promise(r => setTimeout(r,ms));
const le = n => [n&255,n>>>8&255,n>>>16&255,n>>>24&255];
(async () => {
  const cases=[];
  const pass = name => { cases.push(name); console.log('PASS '+name); };
  const baseArgs=['--cli-native-observation','--no-renderer','--frozen','--control-stdin'];
  validateObservationArgs(baseArgs);
  for (const arg of ['--threads','--d3d-worker','--lazy-ranges','--audio-out=x','--input=0:eval:x','--headless-gl'])
    assert.throws(() => validateObservationArgs([...baseArgs,arg]), /unsupported/);
  pass('unsupported configurations refused before instantiation');
  const module=await WebAssembly.compile(fs.readFileSync('build/wine-assembly.wasm'));
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  let tm, paused=true;
  const lease=new CliObservationLease({memory,module,paused:()=>paused,threads:()=>tm,timeoutMs:100});
  let hostEffects=0, hostWA=null;
  function imports() {
    const ctx={getMemory:()=>memory.buffer,exports:null};
    const imp=createHostImports(ctx); imp.host.memory=memory;
    imp.host.log=()=>{};imp.host.log_i32=()=>{};
    imp.host.log_eip=()=>{hostEffects++;if(hostWA!==null)new DataView(memory.buffer).setUint32(hostWA,23,true);};
    lease.wrapImports(imp);return {imp,ctx};
  }
  const mainImports=imports();
  assert.throws(()=>lease.instantiate(module,{host:{memory:new WebAssembly.Memory({initial:1})}}),/imported memory/);
  const instance=lease.instantiate(module,mainImports.imp);
  const e=instance.exports;mainImports.ctx.exports=e;
  const pe=fs.readFileSync('test/binaries/notepad.exe');
  new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
  tm=new ThreadManager(module,memory,instance,()=>{
    const {imp,ctx}=imports();imp.__setInstance=i=>{ctx.exports=i.exports;};return imp;
  },{instantiateCooperative:(mod,imp)=>lease.instantiate(mod,imp)});
  tm._log=()=>{};lease.bindThreads(tm);
  const area=e.guest_alloc(16384)>>>0,pc=area+128,data=area+2048;
  const put=(p,b)=>b.forEach((v,i)=>e.guest_write8(p+i,v));
  const code=[0x89,0x05,...le(data),0xeb,0xf8]; // MOV [data],EAX; JMP back
  put(pc,code);e.set_eip(pc);e.set_eax(0x12345678);e.set_esp(area+8192);
  const handle=tm.createThread(pc,0,65536,0);tm.spawnPending();
  const thread=tm.threads.get(handle);assert(thread?.instance.nativeInstance);
  thread.instance.exports.set_eax(0x76543210);
  // Real competing CPU and host callbacks admitted BEFORE the request. They
  // retain their async admission through drain and change the baseline bytes.
  const events=[];
  lease.parked=false;
  const admitted=lease.command(async()=>{
    await delay(5);e.run(1);events.push('main');
    await delay(5);tm.runSlice(4);events.push('cooperative');
    lease.hostWrite(()=>{new DataView(memory.buffer).setUint32(e.guest_to_wasm(data),0xabcdef01,true);});
    events.push('host');lease.parked=true;
  });
  const firstRequest=lease.run(instance,(owner,owned)=>{
    assert.deepEqual(events,['main','cooperative','host']);
    assert.equal(owner.guest_read32(data)>>>0,0xabcdef01);
    assert.equal(lease.pending.size,0);assert(owned());
    assert(tm._writerObservationBoundary);assert.equal(tm.writerObservation,lease.epoch);
    assert.throws(()=>e.run(1),/admission closed/);
    assert.throws(()=>thread.instance.exports.run(1),/admission closed/);
    assert.throws(()=>tm.runSlice(1),/admission closed/);
    assert.throws(()=>tm.createThread(pc,0,65536,0),/admission closed/);
    assert.throws(()=>lease.hostWrite(()=>{throw Error('must not run');}),/admission closed/);
    assert.throws(()=>lease.command(()=>{}),/admission closed/);
    assert.throws(()=>mainImports.imp.host.log(),/host import/);
    return observeNative(owner,memory,owned,{ranges:[{lo:data,hi:data+4}],maxSteps:4});
  });
  // Unadmitted callbacks cannot join even while the older batch is draining.
  assert.throws(()=>e.run(1),/admission closed/);
  assert.throws(()=>lease.hostWrite(()=>assert.fail('new drain writer')),/admission closed/);
  const result=await firstRequest;
  await admitted;assert.equal(result.status,'UNKNOWN');assert(result.records.length);
  assert.equal(tm._writerObservationBoundary,null);assert.equal(tm.writerObservation,null);
  e.run(1);tm.runSlice(2);
  pass('real main/cooperative/host work drained before baseline; competing entries refused; normal resumption');
  // Same-value writes are records, even though lifetime qualification stays open.
  e.set_eip(pc);e.set_eax(e.guest_read32(data));
  const same=await lease.run(instance,(owner,owned)=>observeNative(owner,memory,owned,
    {ranges:[{lo:data,hi:data+4}],maxSteps:1}));
  assert.equal(same.records.length,1);assert(same.records[0].sameValue);
  pass('normal native same-value store advances receipt without lifetime claim');
  let stale;
  await assert.rejects(lease.run(instance,owner=>{stale=owner;throw Error('owned failure');}),/owned failure/);
  assert.throws(()=>stale.run(1),/expired/);assert.equal(lease.state,'open');
  e.run(1);tm.runSlice(1);pass('failure releases finally and expires invocation exports');
  await lease.run(instance,()=>assert.throws(()=>stale.run(1),/expired/));
  pass('expired exports stay revoked during a later invocation');
  // UD2 exercises normal guest failure without changing protected policy.
  put(pc,[0x0f,0x0b]);e.invalidate_code_range(pc,128);e.set_eip(pc);
  const failed=await lease.run(instance,(owner,owned)=>observeNative(owner,memory,owned,
    {ranges:[{lo:data,hi:data+4}],maxSteps:1}));
  assert.equal(failed.reason,'refused-or-trapped');assert.equal(e.native_store_get(0),0);
  assert.equal(lease.state,'open');put(pc,code);e.invalidate_code_range(pc,128);e.set_eip(pc);e.run(1);
  pass('actual CPU trap disarms native observation and releases normal scheduling');
  e.set_eip(pc);hostWA=e.guest_to_wasm(data+4);e.set_trace_eip_range(1,pc,pc+128);
  const hostBefore=hostEffects;
  const hostRefused=await lease.run(instance,(owner,owned)=>observeNative(owner,memory,owned,
    {ranges:[{lo:data,hi:data+4}],maxSteps:1}));
  assert.equal(hostRefused.reason,'refused-or-trapped');assert.match(hostRefused.error,/host import/);
  assert.equal(hostEffects,hostBefore);e.run(1);assert(hostEffects>hostBefore);
  assert.equal(e.guest_read32(data+4),23);e.set_trace_eip_range(0,0,0);hostWA=null;
  pass('real CPU host-writer callback refused before effects and resumes after finally release');
  // During drain an ordinary delayed callback has no inherited admission.
  lease.parked=true;
  let finish;
  const pending=lease.command(()=>new Promise(resolve=>{finish=resolve;}));
  const request=lease.run(instance,()=>assert.fail('must time out'));
  assert.throws(()=>lease.command(()=>e.run(1)),/admission closed/);
  assert.throws(()=>lease.hostWrite(()=>{}),/admission closed/);
  assert.throws(()=>e.run(1),/admission closed/);
  await new Promise(resolve=>setTimeout(()=>{
    assert.throws(()=>lease.hostWrite(()=>assert.fail('late host effect')),/admission closed/);
    assert.throws(()=>tm.runSlice(1),/admission closed/);
    resolve();
  },5));
  await assert.rejects(request,/timed out/);finish();await pending;
  assert.equal(lease.state,'open');e.run(1);pass('new commands and delayed host/CPU callbacks denied during drain; timeout resumes');
  // A callback already admitted may retire a participant; no baseline or step.
  lease.parked=false;
  const retire=lease.command(async()=>{await delay(5);thread.state='exited';lease.parked=true;});
  await assert.rejects(lease.run(instance,()=>assert.fail('retired baseline')),/retired\/replaced/);
  await retire;thread.state='active';e.run(1);pass('retirement during admitted drain refuses observation before baseline');
  lease.parked=false;
  const old=thread.instance;
  const replace=lease.command(async()=>{await delay(5);thread.instance=instance;lease.parked=true;});
  await assert.rejects(lease.run(instance,()=>assert.fail('replacement baseline')),/retired\/replaced/);
  await replace;thread.instance=old;e.run(1);pass('instance replacement during drain refused');
  // Reentrant request from an actual import callback must fail before effects.
  let reentrant;
  const custom={host:{callback:()=>{reentrant=lease.run(instance,()=>assert.fail('reentrant'));}}};
  lease.wrapImports(custom);custom.host.callback();await assert.rejects(reentrant,/non-reentrant/);
  pass('host import reentrant observation refused');
  const savedModule=tm.module;tm.module={};
  await assert.rejects(lease.run(instance,()=>assert.fail('module pin')),/retired\/replaced/);
  tm.module=savedModule;e.run(1);pass('actual scheduler module identity pinned');
  paused=false;await assert.rejects(lease.run(instance,()=>{}),/paused/);paused=true;
  tm.workerBackend={};await assert.rejects(lease.run(instance,()=>{}),/cooperative/);tm.workerBackend=null;
  pass('running owner and Worker backend denied');
  e.set_eip(pc);put(pc,[0xf3,0xab,0x90]);e.invalidate_code_range(pc,128);
  e.set_edi(data);e.set_ecx(2);
  const rep=await lease.run(instance,(owner,owned)=>observeNative(owner,memory,owned,
    {ranges:[{lo:data,hi:data+8}],maxSteps:1}));
  assert.equal(rep.reason,'overflow-host-or-multiple-stores');assert.equal(rep.records.length,0);
  pass('unsplit real REP retains UNKNOWN instead of publishing one last writer');
  // Exact instruction form in a synthetic CPU fixture; no original game run.
  put(pc,[0x8f,0x44,0x1d,0x00]);e.invalidate_code_range(pc,128);e.set_eip(pc);
  e.set_ebp(data);e.set_ebx(0);e.set_esp(area+8192);e.guest_write32(area+8192,0x11223344);
  const pop=await lease.run(instance,(owner,owned)=>observeNative(owner,memory,owned,
    {ranges:[{lo:data,hi:data+4}],maxSteps:1}));
  assert.equal(pop.records.length,1);assert.equal(pop.records[0].pc,pc);
  assert.equal(e.guest_read32(data)>>>0,0x11223344);
  pass('normal interpreter POP receipt under actual lease; protected subset unchanged');
  lease.hostWrite(()=>new DataView(memory.buffer).setUint32(e.guest_to_wasm(data),9,true));
  assert.equal(e.guest_read32(data),9);pass('ordinary host writer resumes after release');
  // Actual CLI controller, not just the helper. All input is control protocol;
  // eval is refused before compilation/execution. One normal batch resumes.
  const {spawn} = require('node:child_process');
  const child=spawn(process.execPath,['test/run.js',...baseArgs,'--no-build',
    '--exe=test/binaries/notepad.exe','--max-seconds=5','--no-close','--quiet-api'],
    {stdio:['pipe','pipe','pipe']});
  let output='';child.stdout.on('data',b=>{output+=b;});child.stderr.on('data',b=>{output+=b;});
  const exit=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
  const commands=[{action:'ping'},{action:'eval',code:'throw Error("eval executed")'},
    {action:'native-observe',ranges:[{lo:0x401000,hi:0x401004}],maxSteps:32},
    {action:'snapshot'},{action:'step',n:1},{action:'quit'}];
  child.stdin.end(commands.map((c,id)=>JSON.stringify({...c,id})).join('\n')+'\n');
  assert.equal(await exit,0,output);
  const replies=output.split('\n').filter(l=>l.startsWith('[ctl] ')).map(l=>JSON.parse(l.slice(6)));
  assert.equal(replies.length,6,output);assert(replies[0].ok);assert(!replies[1].ok);
  assert(replies[2].ok);assert.equal(replies[2].value.status,'UNKNOWN');
  assert(['refused-or-trapped','invalid-host-or-instruction-scope'].includes(replies[2].value.reason));
  assert(replies[3].ok);assert(replies[3].value.frozen.frozen);
  assert(replies[4].ok);assert.equal(replies[4].value.ran,1);assert(replies[5].ok);
  pass('actual CLI frozen drain, eval denial, API boundary refusal, snapshot and ordinary batch resumption');
  console.log(JSON.stringify({cases,result,same,rep,pop,cli:replies},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
